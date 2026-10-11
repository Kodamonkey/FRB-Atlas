import type { EventEvidence, EvidenceArrays, EvidenceAsset } from './types';

export class EvidenceError extends Error {
  constructor(message: string) { super(message); this.name = 'EvidenceError'; }
}

const ARRAY_KEYS = ['waterfall', 'dmMap', 'originalCrop', 'preparedCrop', 'profile', 'rgb'] as const;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
function fail(message: string): never { throw new EvidenceError(message); }

function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Evidence loading aborted', 'AbortError');
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: expected object`);
  return value as Record<string, unknown>;
}

function number(value: unknown, label: string, minimum = -Infinity, maximum = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) fail(`${label}: invalid finite number`);
  return value;
}

function integer(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = number(value, label, minimum, maximum);
  if (!Number.isInteger(result)) fail(`${label}: expected integer`);
  return result;
}

function numbers(value: unknown, label: string, count?: number): number[] {
  if (!Array.isArray(value) || (count !== undefined && value.length !== count)) fail(`${label}: invalid array length`);
  return value.map((entry, i) => number(entry, `${label}[${i}]`));
}

function shape(value: unknown, label: string): number[] {
  const result = numbers(value, label);
  if (!result.length || result.length > 4 || result.some(axis => !Number.isInteger(axis) || axis < 1 || axis > 65536)) fail(`${label}: invalid dimensions`);
  if (result.reduce((total, axis) => total * axis, 1) > MAX_ASSET_BYTES) fail(`${label}: excessive dimensions`);
  return result;
}

function assertShape(actual: number[], expected: number[], label: string) {
  if (actual.length !== expected.length || actual.some((axis, i) => axis !== expected[i])) fail(`${label}: shape mismatch`);
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(`${label}: invalid SHA-256`);
  return value;
}

export function validateEvidence(value: unknown): EventEvidence {
  const root = record(value, 'Evidence');
  if (root.version !== 1) fail('Unsupported evidence version');
  if (typeof root.eventId !== 'string' || !/^[a-z0-9-]+$/.test(root.eventId)) fail('Invalid event ID');
  if (typeof root.commit !== 'string' || !/^[a-f0-9]{40}$/.test(root.commit)) fail('Invalid source commit');
  if (typeof root.stateKey !== 'string') fail('Invalid scientific state key');
  let state: Record<string, unknown>;
  try { state = record(JSON.parse(root.stateKey), 'Scientific state'); } catch { return fail('Invalid scientific state key'); }
  const axes = record(root.axes, 'Axes');
  const samples = integer(axes.samples, 'Samples', 1, 8192);
  const channels = integer(axes.channels, 'Channels', 1, 128);
  const dt = number(axes.dtSeconds, 'dt', Number.MIN_VALUE);
  const frequencies = numbers(axes.frequenciesMHz, 'Frequencies', channels);
  if (frequencies.some((entry, i) => entry <= 0 || (i > 0 && entry <= frequencies[i - 1]))) fail('Frequencies must increase');
  const dms = numbers(axes.dmValues, 'DM grid');
  if (dms.length < 2 || dms.length > 256 || dms.some((entry, i) => entry < 0 || (i > 0 && entry <= dms[i - 1]))) fail('DM grid must increase');
  const truth = record(root.truth, 'Truth');
  number(truth.dm, 'Truth DM', 0); number(truth.timeSeconds, 'Truth time', 0); number(truth.widthMs, 'Truth width', Number.MIN_VALUE);
  const candidate = record(root.candidate, 'Candidate');
  const candidateSample = integer(candidate.timeIndex, 'Candidate sample', 0, samples - 1);
  const candidateTime = number(candidate.timeSeconds, 'Candidate time', 0, samples * dt);
  if (Math.floor(candidateTime / dt + 1e-8) !== candidateSample) fail('Candidate time does not match its sample');
  number(candidate.dm, 'Candidate DM', dms[0], dms[dms.length - 1]);
  number(candidate.snr, 'Candidate SNR'); number(candidate.widthMs, 'Candidate width', Number.MIN_VALUE);
  number(candidate.score, 'Detector score', 0, 1);
  if (candidate.source !== 'detector') fail('This evidence requires a real detected LF candidate');
  if (candidate.decode !== undefined) {
    const decode = record(candidate.decode, 'Decode');
    for (const key of ['peak', 'offset', 'size', 'centerCNN']) numbers(decode[key], `Decode ${key}`, 2);
    numbers(decode.boxCNN, 'Decode box', 4);
    integer(decode.imgSize, 'CNN image size', 1); integer(decode.mapSize, 'CNN map size', 1);
  }
  const crop = record(root.crop, 'Crop');
  const start = integer(crop.startSample, 'Crop start', 0, samples - 1);
  if (integer(crop.candidateSample, 'Crop candidate', 0, samples - 1) !== candidateSample) fail('Crop candidate mismatch');
  const left = integer(crop.paddingLeft, 'Left padding', 0, 512);
  const right = integer(crop.paddingRight, 'Right padding', 0, 512);
  if (left + right > 512) fail('Invalid total crop padding');
  const delays = numbers(crop.delaySamples, 'Crop delays', channels);
  if (delays.some(delay => !Number.isInteger(delay) || delay < 0 || delay > 2_147_483_647)) fail('Invalid quantized crop delays');
  if (start + 512 - left - right + Math.max(...delays) > samples) fail('Crop extends beyond source observation');
  const assets = record(root.assets, 'Assets');
  const expectedShapes: Record<string, number[]> = { waterfall: [samples, channels], dmMap: [dms.length, samples],
    originalCrop: [512, channels], preparedCrop: [1, 512, channels], profile: [512], rgb: [512, 512, 3] };
  for (const key of ARRAY_KEYS) {
    const asset = record(assets[key], key);
    const dimensions = shape(asset.shape, `${key} shape`);
    assertShape(dimensions, expectedShapes[key], key);
    const dtype = key === 'rgb' ? 'uint8' : 'float32';
    if (asset.dtype !== dtype) fail(`${key}: invalid dtype`);
    if (typeof asset.url !== 'string' || !/^[a-zA-Z0-9_-]+\.(f32|u8)$/.test(asset.url)) fail(`${key}: invalid local asset URL`);
    const expectedBytes = dimensions.reduce((total, axis) => total * axis, 1) * (dtype === 'float32' ? 4 : 1);
    if (integer(asset.bytes, `${key} bytes`, 1, MAX_ASSET_BYTES) !== expectedBytes) fail(`${key}: byte count does not match shape and dtype`);
    hash(asset.sha256, `${key} hash`);
  }
  const inference = record(root.inference, 'Inference');
  assertShape(shape(inference.detectorInputShape, 'Detector input'), [1, 3, 512, 512], 'Detector input');
  assertShape(shape(inference.classifierInputShape, 'Classifier input'), [1, 1, 512, channels], 'Classifier input');
  const logits = numbers(inference.logits, 'Logits', 2);
  const probabilities = numbers(inference.probabilities, 'Probabilities', 2);
  const exp = logits.map(logit => Math.exp(logit - Math.max(...logits)));
  if (probabilities.some((probability, i) => probability < 0 || probability > 1 || Math.abs(probability - exp[i] / (exp[0] + exp[1])) > 1e-6)) fail('Classifier probabilities do not match two-logit softmax');
  const checkpoints = record(inference.checkpoints, 'Checkpoints');
  hash(checkpoints.detector, 'Detector checkpoint'); hash(checkpoints.classifier, 'Classifier checkpoint');
  const inputHashes = record(inference.inputHashes, 'Input hashes');
  hash(inputHashes.detectorNCHW, 'Detector tensor hash');
  if (inputHashes.waterfallFloat32 !== record(assets.waterfall, 'Waterfall').sha256 ||
    inputHashes.classifierNCHW !== record(assets.preparedCrop, 'Prepared crop').sha256) fail('Asset hashes do not match the actual model input');
  if (!Array.isArray(root.snapshots) || root.snapshots.length < 6 || root.snapshots.length > 8) fail('Invalid activation snapshots');
  const snapshotIds = new Set<string>();
  for (const entry of root.snapshots) {
    const snapshot = record(entry, 'Snapshot');
    if (typeof snapshot.id !== 'string' || typeof snapshot.kind !== 'string' || snapshotIds.has(snapshot.id)) fail('Invalid snapshot identity');
    snapshotIds.add(snapshot.id);
    shape(snapshot.shape, 'Original snapshot shape');
    const height = integer(snapshot.height, 'Snapshot height', 1, 24);
    const width = integer(snapshot.width, 'Snapshot width', 1, snapshot.id === 'classifier-gap-vector' ? 512 : 24);
    if (snapshot.id === 'classifier-gap-vector') {
      assertShape(shape(snapshot.shape, 'GAP vector shape'), [1, 512], 'GAP vector');
      if (height !== 1 || width !== 512) fail('Invalid GAP channel vector');
    }
    numbers(snapshot.values, 'Snapshot values', height * width);
  }
  if (!snapshotIds.has('detector-sigmoid')) fail('Missing real detector heatmap');
  const stream = record(root.stream, 'Stream');
  const context = integer(stream.contextSamples, 'Stream context', 1, 2_147_483_647);
  const maxDM = number(state.dmMax, 'Maximum DM', 0);
  const widths = numbers(state.boxcarWidthsMs, 'Boxcar widths');
  if (!widths.length || widths.some(width => width <= 0)) fail('Invalid boxcar widths');
  const delay = 4.148808e3 * maxDM * (frequencies[0] ** -2 - frequencies[channels - 1] ** -2) / dt;
  const floor = Math.floor(delay);
  const maxShift = delay - floor === 0.5 ? floor + floor % 2 : Math.round(delay);
  const maxWidth = Math.ceil(Math.max(...widths) / 1000 / dt);
  if (context < maxShift + maxWidth) fail('Stream context cannot cover maximum DM and boxcar width');
  if (!Array.isArray(stream.chunks) || !stream.chunks.length || stream.chunks.length > samples) fail('Invalid stream chunks');
  let end = 0;
  for (const entry of stream.chunks) {
    const chunk = record(entry, 'Chunk');
    const chunkStart = integer(chunk.start, 'Chunk start', 0, samples - 1);
    const chunkEnd = integer(chunk.end, 'Chunk end', chunkStart + 1, samples);
    if (chunkStart !== end) fail('Chunk valid windows have gaps or duplication');
    if (integer(chunk.blockStart, 'Block start', 0, chunkStart) !== Math.max(0, chunkStart - context) ||
      integer(chunk.blockEnd, 'Block end', chunkEnd, samples) !== Math.min(samples, chunkEnd + context)) fail('Chunk context mismatch');
    end = chunkEnd;
  }
  if (end !== samples) fail('Chunks do not cover the observation');
  const acquisition = record(root.acquisition, 'Illustrative acquisition');
  const voltages = numbers(acquisition.voltages, 'Voltages', 64);
  numbers(acquisition.quantized, 'ADC', voltages.length); numbers(acquisition.fftPower, 'FFT power', voltages.length);
  integer(acquisition.bits, 'ADC bits', 1, 16);
  if (!Array.isArray(root.sources) || !root.sources.length) fail('Missing evidence provenance');
  for (const value of root.sources) {
    const source = record(value, 'Source');
    if (typeof source.label !== 'string' || typeof source.url !== 'string') fail('Invalid evidence source');
  }
  return value as EventEvidence;
}

function basePath(base: string) {
  if (!base || /[?#]/.test(base)) fail('Invalid evidence base URL');
  return base.replace(/\/+$/, '');
}

async function response(url: string, signal?: AbortSignal): Promise<Response> {
  abort(signal);
  const result = await fetch(url, { signal, credentials: 'same-origin' });
  abort(signal);
  if (!result.ok) fail(`Evidence request failed (${result.status}): ${url}`);
  return result;
}

export async function loadEvidenceMetadata(base = '/evidence', signal?: AbortSignal): Promise<EventEvidence> {
  const result = await response(`${basePath(base)}/event.json`, signal);
  const value: unknown = await result.json();
  abort(signal);
  return validateEvidence(value);
}

async function loadAsset(base: string, asset: EvidenceAsset, signal?: AbortSignal): Promise<Float32Array | Uint8Array> {
  const result = await response(`${basePath(base)}/${asset.url}`, signal);
  const buffer = await result.arrayBuffer();
  abort(signal);
  if (buffer.byteLength !== asset.bytes) fail(`${asset.url}: downloaded byte count mismatch`);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  abort(signal);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== asset.sha256) fail(`${asset.url}: SHA-256 mismatch`);
  if (asset.dtype === 'uint8') return new Uint8Array(buffer);
  const output = new Float32Array(buffer.byteLength / 4);
  const view = new DataView(buffer);
  for (let i = 0; i < output.length; i++) {
    output[i] = view.getFloat32(i * 4, true);
    if (!Number.isFinite(output[i])) fail(`${asset.url}: non-finite float32 value`);
  }
  return output;
}

export async function loadEvidenceArrays(base: string, evidence: EventEvidence, signal?: AbortSignal): Promise<EvidenceArrays> {
  abort(signal);
  validateEvidence(evidence);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const arrays = await Promise.all(ARRAY_KEYS.map(async key => [key, await loadAsset(base, evidence.assets[key], controller.signal)] as const));
    abort(signal);
    return Object.fromEntries(arrays) as unknown as EvidenceArrays;
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

export async function loadEvidence(base = '/evidence', signal?: AbortSignal): Promise<{ evidence: EventEvidence; arrays: EvidenceArrays }> {
  const evidence = await loadEvidenceMetadata(base, signal);
  const arrays = await loadEvidenceArrays(base, evidence, signal);
  return { evidence, arrays };
}
