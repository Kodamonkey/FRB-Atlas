import { channelShifts, computeSNR } from '../science/pipeline';
import { dispersionDelaySeconds, integratedGaussian, intrachannelSmearingSeconds } from '../science/physics';
import { OBSERVATIONS, channelCentre, effectiveDt, resolutionRatio } from '../observations';

export const HF_SEED = 17452900;
export const HF_SAMPLES = 128;
export const HF_WIDTH_SAMPLES = [1, 2, 3, 5, 8, 15] as const;
export const HF_DEFAULT_THRESHOLD = 6;
export interface HFFixture {
  eventId: string;
  seed: number;
  samples: number;
  channels: number;
  dtSeconds: number;
  timesSeconds: Float64Array;
  timeBounds: [number, number];
  frequenciesMHz: Float64Array;
  delaysSeconds: Float64Array;
  shifts: Int32Array;
  nativeShifts: Int32Array;
  dmKnown: number;
  dmEstimated: null;
  dmResolved: false;
  ratio: number;
  ratioAtMaximumDM: number;
  waterfall: Float32Array;
  waterfallRows: Float32Array;
  integrated: Float32Array;
  normalized: Float32Array;
  snr: Float32Array;
  bestWidths: Int32Array;
  weights: Float32Array;
  bank: Float32Array;
  widthSamples: readonly number[];
  widthsMs: Float64Array;
  peakIndex: number;
  provenance: string;
}
export interface HFCandidate {
  sample: number;
  timeSeconds: number;
  snr: number;
  widthSamples: number;
  widthMs: number;
  window: [number, number];
  accepted: boolean;
  threshold: number;
  dmEstimated: null;
  score: null;
  confirmed: false;
}

// Same Mulberry32 generator as the original Explorer; the seed is published with this fixture.
function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ value >>> 15, value | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function buildHFFixture(seed = HF_SEED): HFFixture {
  const observation = OBSERVATIONS['alma-hf'];
  const dtSeconds = effectiveDt(observation), channels = observation.channels, samples = HF_SAMPLES;
  const frequenciesMHz = Float64Array.from({ length: channels }, (_, channel) => channelCentre(observation, channel));
  const reference = frequenciesMHz[channels - 1], random = seededRandom(seed);
  const delaysSeconds = Float64Array.from(frequenciesMHz, frequency => dispersionDelaySeconds(observation.dm, frequency, reference));
  const timesSeconds = Float64Array.from({ length: samples }, (_, sample) => sample * dtSeconds);
  const waterfall = new Float32Array(samples * channels), waterfallRows = new Float32Array(waterfall.length);
  const gaussianSigma = observation.widthMs / 1000 / 2.354820045;
  const noiseSumSigma = Math.sqrt(observation.downTimeRate), amplitudeNative = .12;
  for (let channel = 0; channel < channels; channel++) {
    const smear = intrachannelSmearingSeconds(observation.dm,
      (observation.frequencyHighMHz - observation.frequencyLowMHz) / channels, frequenciesMHz[channel]);
    const sigma = Math.sqrt(gaussianSigma ** 2 + smear ** 2 / 12);
    for (let sample = 0; sample < samples; sample++) {
      const noise = Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
      const integratedPulse = integratedGaussian(timesSeconds[sample], .25 + delaysSeconds[channel], sigma, dtSeconds);
      // Time downsampling SUM: pulse amplitude scales by r_t, independent Gaussian noise by sqrt(r_t).
      const value = Math.fround(amplitudeNative * observation.downTimeRate * integratedPulse + noiseSumSigma * noise);
      waterfall[sample * channels + channel] = value;
      waterfallRows[channel * samples + sample] = value;
    }
  }
  const widthsMs = Float64Array.from(HF_WIDTH_SAMPLES, width => width * dtSeconds * 1000);
  const result = computeSNR(waterfall, samples, channels, dtSeconds, Array.from(widthsMs));
  const integrated = new Float32Array(samples);
  for (let sample = 0; sample < samples; sample++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) sum += Math.fround(waterfall[sample * channels + channel] * result.weights[channel]);
    integrated[sample] = sum;
  }
  const bank = new Float32Array(samples * HF_WIDTH_SAMPLES.length);
  for (let row = 0; row < HF_WIDTH_SAMPLES.length; row++) {
    const width = HF_WIDTH_SAMPLES[row], coefficient = Math.fround(1 / Math.sqrt(width)), left = Math.floor(width / 2);
    for (let sample = 0; sample < samples; sample++) {
      let sum = 0;
      for (let offset = 0; offset < width; offset++) {
        const source = sample + offset - left;
        if (source >= 0 && source < samples) sum += result.series[source] * coefficient;
      }
      bank[row * samples + sample] = Math.fround(sum);
    }
  }
  let peakIndex = 0;
  for (let sample = 1; sample < samples; sample++) if (result.snr[sample] > result.snr[peakIndex]) peakIndex = sample;
  return {
    eventId: observation.eventId, seed, samples, channels, dtSeconds, timesSeconds,
    timeBounds: [-dtSeconds / 2, (samples - .5) * dtSeconds], frequenciesMHz, delaysSeconds,
    shifts: channelShifts(frequenciesMHz, observation.dm, dtSeconds),
    nativeShifts: channelShifts(frequenciesMHz, observation.dm, observation.dtNativeSeconds),
    dmKnown: observation.dm, dmEstimated: null, dmResolved: false,
    ratio: delaysSeconds[0] / dtSeconds, ratioAtMaximumDM: resolutionRatio(observation),
    waterfall, waterfallRows, integrated, normalized: result.series, snr: result.snr,
    bestWidths: result.bestWidths, weights: result.weights, bank,
    widthSamples: HF_WIDTH_SAMPLES, widthsMs, peakIndex,
    provenance: `HF sintético · semilla ${seed} · fondo sustraído · inspirado en PSR J1745−2900 · no FRB observado · sin red neuronal`,
  };
}

let cachedFixture: HFFixture | null = null;
export function getHFFixture(): HFFixture { return cachedFixture ??= buildHFFixture(); }

export function selectHFCandidate(fixture: HFFixture, threshold = HF_DEFAULT_THRESHOLD): HFCandidate {
  if (!Number.isFinite(threshold) || threshold < 0) throw new RangeError('Invalid HF threshold');
  const sample = fixture.peakIndex, widthSamples = fixture.bestWidths[sample];
  const start = sample - Math.floor(widthSamples / 2);
  const fullExposure = start >= 0 && start + widthSamples <= fixture.samples;
  return {
    sample, timeSeconds: fixture.timesSeconds[sample], snr: fixture.snr[sample],
    widthSamples, widthMs: widthSamples * fixture.dtSeconds * 1000,
    window: [(start - .5) * fixture.dtSeconds, (start + widthSamples - .5) * fixture.dtSeconds],
    accepted: fullExposure && fixture.snr[sample] >= threshold, threshold,
    dmEstimated: null, score: null, confirmed: false,
  };
}

export function hfConstruction(operation: number, fixture = getHFFixture()) {
  const fraction = (start: number, end: number) => Math.max(0, Math.min(1, (operation - start) / (end - start)));
  return { profile: Math.floor(fraction(0, .45) * fixture.samples), bank: Math.floor(fraction(.15, .7) * fixture.bank.length),
    waterfall: Math.floor(fraction(.35, .9) * fixture.waterfall.length), classification: operation >= .88 };
}
