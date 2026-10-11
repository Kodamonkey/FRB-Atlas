export interface EvidenceAsset {
  url: string;
  shape: number[];
  sha256: string;
  bytes: number;
  dtype: 'float32' | 'uint8';
}
export interface ActivationSnapshot {
  id: string;
  kind: string;
  shape: number[];
  height: number;
  width: number;
  values: number[];
}
export interface EventEvidence {
  version: number;
  eventId: string;
  commit: string;
  stateKey: string;
  axes: { samples: number; channels: number; dtSeconds: number; frequenciesMHz: number[]; dmValues: number[] };
  truth: { dm: number; timeSeconds: number; widthMs: number };
  candidate: { timeIndex: number; timeSeconds: number; dm: number; snr: number; widthMs: number; score: number; source: string;
    decode?: { peak: number[]; offset: number[]; size: number[]; centerCNN: number[]; boxCNN: number[]; imgSize: number; mapSize: number } };
  inference: { detectorInputShape: number[]; classifierInputShape: number[]; logits: number[]; probabilities: number[];
    checkpoints: { detector: string; classifier: string }; inputHashes: Record<string, string | null> };
  crop: { startSample: number; candidateSample: number; paddingLeft: number; paddingRight: number; delaySamples: number[] };
  assets: Record<string, EvidenceAsset>;
  snapshots: ActivationSnapshot[];
  stream: { contextSamples: number; chunks: { start: number; end: number; blockStart: number; blockEnd: number }[] };
  acquisition: { voltages: number[]; quantized: number[]; fftPower: number[]; bits: number };
  sources: { label: string; url: string }[];
}
export interface EvidenceArrays {
  waterfall: Float32Array;
  dmMap: Float32Array;
  originalCrop: Float32Array;
  preparedCrop: Float32Array;
  profile: Float32Array;
  rgb: Uint8Array;
}
