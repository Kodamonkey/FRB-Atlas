import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { channelize, channelShifts, computeScience, planChunks, quantize, roundTiesToEven, scienceKey }
  from '../../frb-explorer/src/science/index';
import type { EventEvidence, EvidenceAsset } from '../src/evidence/types';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(project, '../..');
const original = resolve(project, '../frb-explorer');
const trace = resolve(original, 'public/traces');
const destination = resolve(project, 'public/evidence');
const manifest = JSON.parse(readFileSync(resolve(trace, 'manifest.json'), 'utf8'));
const crop = JSON.parse(readFileSync(resolve(trace, 'crops/candidate.json'), 'utf8'));
if (manifest.state.scenario !== 'lf' || manifest.state.seed !== 241032 || manifest.candidate.source !== 'detector') {
  throw new Error('The fixed LF trace and detected candidate are required');
}
const state = manifest.state;
if (scienceKey(state) !== manifest.stateKey) throw new Error('Scientific state does not match the recorded model input');
const result = computeScience(state);
mkdirSync(destination, { recursive: true });
const assets: Record<string, EvidenceAsset> = {};
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');

function binary(name: string, values: ArrayLike<number>, shape: number[], expectedHash?: string) {
  if (shape.reduce((product, axis) => product * axis, 1) !== values.length) throw new Error(`${name}: shape mismatch`);
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) throw new Error(`${name}: non-finite value`);
    view.setFloat32(i * 4, values[i], true);
  }
  const bytes = new Uint8Array(buffer);
  const hash = sha(bytes);
  if (expectedHash && hash !== expectedHash) throw new Error(`${name}: frozen trace hash mismatch`);
  const url = `${name}.f32`;
  writeFileSync(resolve(destination, url), bytes);
  return { url, shape, sha256: hash, bytes: bytes.byteLength, dtype: 'float32' as const };
}

assets.waterfall = binary('waterfall', result.waterfall, [state.samples, state.channels], manifest.inputHashes.waterfallFloat32);
assets.dmMap = binary('dm-map', result.cube.subarray(0, state.dmCount * state.samples), [state.dmCount, state.samples]);
assets.originalCrop = binary('original-crop', crop.originalValues, crop.originalShape, crop.hashes.originalFloat32);
assets.preparedCrop = binary('prepared-crop', crop.preparedValues, crop.preparedShape, crop.hashes.preparedFloat32);
if (assets.preparedCrop.sha256 !== manifest.inputHashes.classifierNCHW) throw new Error('Classifier tensor hash mismatch');

const python = process.env.DRAFTS_EVIDENCE_PYTHON ?? resolve(original, '.venv-traces/Scripts/python.exe');
if (!existsSync(python)) throw new Error('Set DRAFTS_EVIDENCE_PYTHON to the DRAFTS Python 3.12 trace environment');
execFileSync(python, [resolve(project, 'scripts/export_evidence_arrays.py'), '--output', destination], {
  cwd: repository, env: { ...process.env, MPLBACKEND: 'Agg' }, stdio: 'inherit',
});
for (const [name, url, shape, dtype] of [
  ['profile', 'profile.f32', [crop.originalShape[0]], 'float32'],
  ['rgb', 'rgb.u8', [512, 512, 3], 'uint8'],
] as const) {
  const bytes = readFileSync(resolve(destination, url));
  assets[name] = { url, shape: [...shape], dtype, bytes: bytes.byteLength, sha256: sha(bytes) };
}

const snapshotIds = ['detector-base_model-0-1', 'detector-up3-1', 'detector-sigmoid',
  'classifier-base_model-conv1-1', 'classifier-base_model-layer4-1',
  'classifier-base_model-avgpool-1', 'classifier-base_model-fc-1'];
const snapshots = snapshotIds.map(id => {
  const layer = manifest.layers.find((value: { id: string }) => value.id === id);
  if (!layer) throw new Error(`Missing recorded activation ${id}`);
  const map = JSON.parse(readFileSync(resolve(trace, layer.mapUrl), 'utf8'));
  if (map.height < 1 || map.width < 1 || map.values[0].length !== map.height * map.width) throw new Error(`Invalid activation thumbnail ${id}`);
  return { id, kind: layer.kind, shape: map.shape, height: map.height, width: map.width, values: map.values[0] };
});
const fcOperation = JSON.parse(readFileSync(resolve(trace, 'operators/classifier-base_model-fc-1.json'), 'utf8'));
if (fcOperation.input.length !== 512) throw new Error('Missing exact GAP feature vector at the Linear input');
snapshots.push({ id: 'classifier-gap-vector', kind: 'GAP vector', shape: [1, 512],
  height: 1, width: 512, values: fcOperation.input });
const shifts = channelShifts(result.frequenciesMHz, state.dmMax, result.dtEffSeconds);
const maxShift = Math.max(...shifts);
const maxWidth = Math.max(...state.boxcarWidthsMs.map((ms: number) => Math.max(1, roundTiesToEven(ms / 1000 / result.dtEffSeconds))));
const contextSamples = maxShift + maxWidth;
const voltages = Array.from({ length: 64 }, (_, n) =>
  0.65 * Math.cos(2 * Math.PI * 5 * n / 64) + 0.25 * Math.sin(2 * Math.PI * 13 * n / 64));
const quantized = quantize(voltages, state.adcBits);
const fft = channelize(quantized, 64, 'hann');
const commitSource = `https://github.com/Kodamonkey/DRAFTS-UC/blob/${manifest.commit}`;
const evidence: EventEvidence = {
  version: 1, eventId: 'lf-241032', commit: manifest.commit, stateKey: manifest.stateKey,
  axes: { samples: state.samples, channels: state.channels, dtSeconds: result.dtEffSeconds,
    frequenciesMHz: Array.from(result.frequenciesMHz), dmValues: Array.from(result.dmValues) },
  truth: { dm: state.dmTrue, timeSeconds: state.t0Seconds, widthMs: state.widthMs },
  candidate: { timeIndex: manifest.candidate.timeIndex, timeSeconds: manifest.candidate.timeSeconds,
    dm: manifest.candidate.dm, snr: manifest.candidate.snr,
    widthMs: manifest.candidate.widthSamples * manifest.candidate.dtSeconds * 1000,
    score: manifest.candidate.detectorScore, source: manifest.candidate.source, decode: manifest.candidate.decode },
  inference: { detectorInputShape: manifest.detector.inputShape, classifierInputShape: manifest.classifier.inputShape,
    logits: manifest.classifier.logits, probabilities: manifest.classifier.probabilities,
    checkpoints: { detector: manifest.checkpoints.detector.sha256, classifier: manifest.checkpoints.classifier.sha256 },
    inputHashes: manifest.inputHashes },
  crop: { startSample: crop.startSample, candidateSample: crop.candidateSample,
    paddingLeft: crop.paddingLeft, paddingRight: crop.paddingRight, delaySamples: crop.delaySamples },
  assets, snapshots,
  stream: { contextSamples, chunks: planChunks(state.samples, state.chunkSamples, contextSamples) },
  acquisition: { voltages, quantized: Array.from(quantized), fftPower: Array.from(fft.power), bits: state.adcBits },
  sources: [
    { label: 'NRAO: pulsar lighthouse model and cold-plasma dispersion', url: 'https://www.cv.nrao.edu/~sransom/web/Ch6.html' },
    { label: 'DRAFTS: A Deep Learning-Based Radio Fast Transient Search Pipeline', url: 'https://arxiv.org/abs/2410.03200' },
    { label: 'CenterNet: Objects as Points', url: 'https://arxiv.org/abs/1904.07850' },
    { label: 'ResNet: Deep Residual Learning for Image Recognition', url: 'https://arxiv.org/abs/1512.03385' },
    { label: 'Synthetic LF seed 241032; offline deterministic generator; not an observed FRB', url: '../frb-explorer/src/science/index.ts' },
    { label: 'Fixed CPU inference manifest; candidate selected by highest eligible CenterNet score', url: '../frb-explorer/public/traces/manifest.json' },
    { label: 'Original dedispersed candidate crop, padding and prepared NCHW hashes', url: '../frb-explorer/public/traces/crops/candidate.json' },
    { label: 'profile.f32: real compute_snr_profile(original candidate crop), maximum boxcar SNR at each sample', url: `${commitSource}/src/analysis/snr_utils.py#L16` },
    { label: 'rgb.u8: inverse ImageNet normalization of the actual preprocess_img detector input, HWC RGB', url: `${commitSource}/src/visualization/visualization_unified.py#L38` },
    { label: 'Illustrative ADC and fft.js Hann FFT only; not recovered voltages of this intensity dataset', url: '../frb-explorer/src/science/acquisition.ts' },
    ...snapshotIds.map(id => ({ label: `${id}: real CPU hook, selected channel 0, adaptive mean thumbnail up to24x24 (FC exact vector); full shape retained`,
      url: `../frb-explorer/public/traces/layers/${id}.json` })),
    { label: 'classifier-gap-vector: all512 exact pooled channels captured at the real Linear pre-hook; not a spatial thumbnail',
      url: '../frb-explorer/public/traces/operators/classifier-base_model-fc-1.json' },
  ],
};
writeFileSync(resolve(destination, 'event.json'), JSON.stringify(evidence));
console.log(JSON.stringify({ event: evidence.eventId, candidate: evidence.candidate,
  contextSamples, maxShift, maxWidth, assets: Object.fromEntries(Object.entries(assets).map(([key, value]) =>
    [key, { bytes: value.bytes, sha256: value.sha256, shape: value.shape }])), snapshots: snapshots.length }, null, 2));
