import type { EventEvidence, EvidenceArrays } from '../evidence/types';
import type { MethodChoice } from '../routes';
import { isRecordedRoute } from '../routes';
import { boxcarFilter, TOY_CROP, TOY_FEATURES, TOY_MAP, TOY_PROFILE, toyForest, toyTransformer } from '../methods/math';

export interface FinaleMatrix {
  values: Float32Array;
  columns: number;
  rows: number;
  times: Float64Array;
  coordinates: Float64Array;
}
export interface FinaleModel {
  mode: 'recorded' | 'didactic';
  eventId: string;
  provenance: string;
  profile: Float32Array;
  times: Float64Array;
  timeBounds: [number, number];
  dtSeconds: number;
  map: FinaleMatrix;
  waterfall: FinaleMatrix;
  frequencyUnit: 'MHz' | 'canal';
  dm: number;
  peak: { index: number; time: number; snr: number; widthSamples: number; widthMs: number };
  window: [number, number];
  detectorTime: number | null;
  detectorScore: number | null;
  threshold: number | null;
  classification: { label: string; detail: string; recorded: boolean };
}
export interface FinaleSelection { timeIndex: number; dmRow: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
export function nearestIndex(values: ArrayLike<number>, coordinate: number): number {
  if (!values.length || !Number.isFinite(coordinate)) throw new RangeError('Invalid selection coordinate');
  let best = 0;
  for (let index = 1; index < values.length; index++) {
    if (Math.abs(values[index] - coordinate) < Math.abs(values[best] - coordinate)) best = index;
  }
  return best;
}

function maximumIndex(values: ArrayLike<number>): number {
  if (!values.length) throw new RangeError('Empty profile');
  let peak = 0;
  for (let index = 0; index < values.length; index++) {
    if (!Number.isFinite(values[index])) throw new RangeError('Nonfinite profile');
    if (values[index] > values[peak]) peak = index;
  }
  return peak;
}

function didacticClassification(methods: MethodChoice): FinaleModel['classification'] {
  if (methods.classification === 'forest') {
    const votes = toyForest(TOY_FEATURES);
    return { label: `${votes.votes.reduce<number>((sum, vote) => sum + vote, 0)}/3 votos ilustrativos`,
      detail: 'Reglas fijas sobre [8, 6 ms, 500 pc cm⁻³, 0.75]; no clasifican estos plots.', recorded: false };
  }
  if (methods.classification === 'transformer') {
    const result = toyTransformer(TOY_CROP);
    return { label: `Softmax didáctica: ${result.probabilities[0].toFixed(3)} / ${result.probabilities[1].toFixed(3)}`,
      detail: 'Pesos publicados, sin entrenamiento; salida del recorte TOY_CROP, no probabilidad astrofísica.', recorded: false };
  }
  if (methods.classification === 'resnet') return { label: 'Residual ilustrativo · sin clase inferida',
    detail: 'El bloque residual de juguete no reproduce la entrada ni el checkpoint de ResNet.', recorded: false };
  return { label: 'Inspección radio · RFI y contexto pendientes',
    detail: 'La concentración en DM y tiempo orienta inspección. Ningún rasgo confirma un FRB.', recorded: false };
}

function recordedModel(evidence: EventEvidence, arrays: EvidenceArrays): FinaleModel {
  const { channels, samples, dtSeconds, dmValues, frequenciesMHz } = evidence.axes;
  const length = arrays.profile.length;
  if (!length || arrays.originalCrop.length !== length * channels || arrays.dmMap.length !== samples * dmValues.length) {
    throw new RangeError('Finale evidence shape mismatch');
  }
  const firstSample = evidence.crop.startSample - evidence.crop.paddingLeft;
  const times = Float64Array.from({ length }, (_, index) => (firstSample + index) * dtSeconds);
  const map = new Float32Array(length * dmValues.length);
  for (let row = 0; row < dmValues.length; row++) for (let index = 0; index < length; index++) {
    const source = firstSample + index;
    map[row * length + index] = source >= 0 && source < samples ? arrays.dmMap[row * samples + source] : 0;
  }
  const waterfall = new Float32Array(length * channels);
  for (let channel = 0; channel < channels; channel++) for (let index = 0; index < length; index++) {
    waterfall[channel * length + index] = arrays.originalCrop[index * channels + channel];
  }
  const peakIndex = maximumIndex(arrays.profile), peakTime = times[peakIndex];
  const widthSamples = Math.max(1, Math.round(evidence.candidate.widthMs / (dtSeconds * 1000)));
  // NumPy's even-width "same" convolution includes W/2 preceding samples and W/2-1 following samples.
  const windowStart = peakTime - (Math.floor(widthSamples / 2) + .5) * dtSeconds;
  const probabilities = evidence.inference.probabilities;
  const predicted = maximumIndex(probabilities);
  return {
    mode: 'recorded', eventId: evidence.eventId,
    provenance: 'LF simulado · entrada y traza CPU verificadas · CenterNet + ResNet',
    profile: arrays.profile, times, timeBounds: [times[0] - dtSeconds / 2, times[length - 1] + dtSeconds / 2], dtSeconds,
    map: { values: map, columns: length, rows: dmValues.length, times, coordinates: Float64Array.from(dmValues) },
    waterfall: { values: waterfall, columns: length, rows: channels, times, coordinates: Float64Array.from(frequenciesMHz) },
    frequencyUnit: 'MHz', dm: evidence.candidate.dm,
    peak: { index: peakIndex, time: peakTime, snr: arrays.profile[peakIndex], widthSamples, widthMs: evidence.candidate.widthMs },
    window: [windowStart, windowStart + widthSamples * dtSeconds],
    detectorTime: evidence.candidate.timeSeconds, detectorScore: evidence.candidate.score, threshold: null,
    classification: { label: `ResNet · clase ${predicted} · softmax ${probabilities[predicted].toFixed(4)}`,
      detail: 'Salida registrada del recorte exacto; clase de modelo, no confirmación astrofísica.', recorded: true },
  };
}

function didacticModel(methods: MethodChoice): FinaleModel {
  const dtSeconds = .001, widths = [1, 2, 4, 8, 14, 20];
  const profile = new Float32Array(TOY_PROFILE.length); profile.fill(NaN);
  const bestWidth = new Uint8Array(profile.length);
  // Complete windows are placed at their time-centres; missing edge exposure is not padded into the filter.
  for (const width of widths) {
    const filtered = boxcarFilter(TOY_PROFILE, width);
    for (let start = 0; start < filtered.length; start++) {
      const index = start + Math.floor((width - 1) / 2);
      if (!Number.isFinite(profile[index]) || filtered[start] > profile[index]) {
        profile[index] = filtered[start]; bestWidth[index] = width;
      }
    }
  }
  const peakIndex = maximumIndex(profile), widthSamples = bestWidth[peakIndex];
  const start = peakIndex - Math.floor((widthSamples - 1) / 2);
  const peakTime = (start + (widthSamples - 1) / 2) * dtSeconds;
  const times = Float64Array.from({ length: profile.length }, (_, index) =>
    (index + (bestWidth[index] % 2 === 0 ? .5 : 0)) * dtSeconds);
  const matrixTimes = Float64Array.from({ length: 16 }, (_, index) => (index + .5) * .004);
  return {
    mode: 'didactic', eventId: 'toy-published',
    provenance: 'TOY_PROFILE / TOY_MAP / TOY_CROP · ejemplos fijos independientes · sin inferencia entrenada',
    profile, times, timeBounds: [0, profile.length * dtSeconds], dtSeconds,
    map: { values: Float32Array.from(TOY_MAP), columns: 16, rows: 16, times: matrixTimes,
      coordinates: Float64Array.from({ length: 16 }, (_, row) => (row + .5) * 1000 / 16) },
    waterfall: { values: Float32Array.from(TOY_CROP), columns: 16, rows: 16, times: matrixTimes,
      coordinates: Float64Array.from({ length: 16 }, (_, channel) => channel) },
    frequencyUnit: 'canal', dm: 500,
    peak: { index: peakIndex, time: peakTime, snr: profile[peakIndex], widthSamples, widthMs: widthSamples },
    window: [(start - .5) * dtSeconds, (start + widthSamples - .5) * dtSeconds],
    detectorTime: null, detectorScore: null, threshold: methods.detection === 'boxcar' ? 6 : null,
    classification: didacticClassification(methods),
  };
}

export function buildFinaleModel(methods: MethodChoice, evidence: EventEvidence | null, arrays: EvidenceArrays | null): FinaleModel | null {
  if (isRecordedRoute(methods)) return evidence && arrays ? recordedModel(evidence, arrays) : null;
  return didacticModel(methods);
}

export function initialFinaleSelection(model: FinaleModel): FinaleSelection {
  return { timeIndex: model.peak.index, dmRow: nearestIndex(model.map.coordinates, model.dm) };
}
export function selectFinale(model: FinaleModel, time: number, dm = model.dm): FinaleSelection {
  return { timeIndex: nearestIndex(model.times, time), dmRow: nearestIndex(model.map.coordinates, dm) };
}
export function moveFinaleSelection(model: FinaleModel, selection: FinaleSelection, samples: number, rows = 0): FinaleSelection {
  return { timeIndex: clamp(selection.timeIndex + samples, 0, model.profile.length - 1),
    dmRow: clamp(selection.dmRow + rows, 0, model.map.rows - 1) };
}
export function finaleConstruction(operation: number, model: FinaleModel) {
  const fraction = (start: number, end: number) => clamp((operation - start) / (end - start), 0, 1);
  return { profile: Math.floor(fraction(0, .45) * model.profile.length),
    map: Math.floor(fraction(.15, .7) * model.map.values.length),
    waterfall: Math.floor(fraction(.35, .9) * model.waterfall.values.length),
    classification: operation >= .88 };
}
