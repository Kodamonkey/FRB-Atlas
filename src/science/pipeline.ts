// Operadores puros copiados de frb-explorer para construir este sitio sin ese proyecto hermano.
import { DISPERSION_SECONDS_MHZ, roundTiesToEven } from './physics';

export interface SNRResult {
  snr: Float32Array; sigma: number; bestWidths: Int32Array; series: Float32Array; weights: Float32Array;
}

export function channelShifts(frequenciesMHz: ArrayLike<number>, dm: number, dtSeconds: number): Int32Array {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) throw new RangeError('Time resolution must be finite and positive');
  if (!Number.isFinite(dm)) throw new RangeError('Dispersion measure must be finite');
  for (let j = 0; j < frequenciesMHz.length; j++) {
    if (!Number.isFinite(frequenciesMHz[j]) || !(frequenciesMHz[j] > 0)) throw new RangeError('Frequency must be finite and positive');
  }
  let reference = -Infinity;
  for (let j = 0; j < frequenciesMHz.length; j++) reference = Math.max(reference, frequenciesMHz[j]);
  return Int32Array.from({ length: frequenciesMHz.length }, (_, j) => {
    const shift = roundTiesToEven(DISPERSION_SECONDS_MHZ * dm * (frequenciesMHz[j] ** -2 - reference ** -2) / dtSeconds);
    // Typed arrays wrap large integers, which would turn out-of-observation delays into valid samples.
    if (!Number.isFinite(shift) || shift < -2_147_483_648 || shift > 2_147_483_647) {
      throw new RangeError('Channel delay exceeds the supported Int32 sample range');
    }
    return shift;
  });
}

export function median(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function normalizeBlocks(series: Float32Array, blockLength = 1000): Float32Array {
  const out = new Float32Array(series.length);
  const length = Math.max(32, Math.min(blockLength, series.length));
  const blocks: { start: number; end: number; sigma: number }[] = [];
  for (let start = 0; start < series.length; start += length) {
    const end = Math.min(series.length, start + length);
    const block = series.slice(start, end);
    const center = Math.fround(median(block));
    for (let i = 0; i < block.length; i++) block[i] = Math.fround(block[i] - center);
    const sorted = Array.from(block).sort((a, b) => a - b);
    const clip = Math.floor(block.length / 40);
    let squareSum = 0;
    for (let i = clip; i < block.length - clip; i++) squareSum += sorted[i] ** 2;
    let sigma = Math.sqrt(squareSum / (0.95 * block.length)) * 1.148;
    if (!(sigma > 0) || !Number.isFinite(sigma)) sigma = 1;
    const sigma32 = Math.fround(sigma);
    for (let i = 0; i < block.length; i++) out[start + i] = block[i] / sigma32;
    blocks.push({ start, end, sigma: sigma32 });
  }
  if (blocks.length >= 3) {
    const sigmas = blocks.map(block => block.sigma);
    const mean = sigmas.reduce((sum, sigma) => sum + sigma, 0) / sigmas.length;
    const spread = Math.sqrt(sigmas.reduce((sum, sigma) => sum + (sigma - mean) ** 2, 0) / sigmas.length);
    const center = median(sigmas);
    for (const block of blocks) {
      if (block.sigma < center - 4 * spread || block.sigma > center + 4 * spread) out.fill(0, block.start, block.end);
    }
  }
  return out;
}

export function computeSNR(
  waterfall: ArrayLike<number>, samples: number, channels: number, dtSeconds: number,
  widthsMs?: number[], channelMask?: ArrayLike<boolean>,
): SNRResult {
  if (!waterfall.length || samples <= 0) throw new RangeError('waterfall is None or empty in compute_snr_profile');
  if (waterfall.length !== samples * channels) throw new RangeError('waterfall must be 2D (time, freq)');
  const valid = Array.from({ length: channels }, (_, j) => j)
    .filter(j => !channelMask || channelMask.length !== channels || channelMask[j]);
  if (!valid.length) throw new RangeError('waterfall has no valid frequency channels');
  const weights = new Float32Array(channels);
  let weightSum = 0;
  for (const j of valid) {
    const column = Float32Array.from({ length: samples }, (_, t) => waterfall[t * channels + j]);
    const center = Math.fround(median(column));
    const deviation = Float32Array.from(column, value => Math.abs(Math.fround(value - center)));
    const sigma = Math.fround(1.4826 * Math.fround(median(deviation)));
    if (Number.isFinite(sigma) && sigma > 1e-6) {
      weights[j] = Math.fround(1 / Math.fround(sigma * sigma));
      weightSum += weights[j];
    }
  }
  if (weightSum) {
    const denominator = Math.fround(weightSum);
    for (const j of valid) weights[j] = weights[j] / denominator;
  } else {
    for (const j of valid) weights[j] = 1 / valid.length;
  }
  const integrated = new Float32Array(samples);
  for (let t = 0; t < samples; t++) {
    let sum = 0;
    for (const j of valid) sum += Math.fround(waterfall[t * channels + j] * weights[j]);
    integrated[t] = sum;
  }
  const series = normalizeBlocks(integrated);
  const configured = widthsMs?.length && dtSeconds > 0
    ? [...new Set(widthsMs.map(width => Math.max(1, roundTiesToEven(width / 1000 / dtSeconds))))].sort((a, b) => a - b)
    : [1, 2, 3, 4, 6, 9, 14, 20, 30, 45, 70, 100, 150, 220, 300];
  const widths = configured.filter(width => width <= samples);
  if (!widths.length) widths.push(1);
  const snr = new Float32Array(samples).fill(-Infinity);
  const bestWidths = new Int32Array(samples);
  for (const width of widths) {
    const coefficient = Math.fround(1 / Math.sqrt(width));
    // NumPy 'same' places the extra sample of even kernels on the left.
    const left = Math.floor(width / 2);
    for (let t = 0; t < samples; t++) {
      let sum = 0;
      for (let r = 0; r < width; r++) {
        const index = t + r - left;
        if (index >= 0 && index < samples) sum += series[index] * coefficient;
      }
      const value = Math.fround(sum);
      if (value > snr[t]) { snr[t] = value; bestWidths[t] = width; }
    }
  }
  return { snr, sigma: 1, bestWidths, series, weights };
}
