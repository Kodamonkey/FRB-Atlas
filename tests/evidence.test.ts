import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEvidence, loadEvidenceArrays, loadEvidenceMetadata, validateEvidence } from '../src/evidence/load';
import type { EventEvidence } from '../src/evidence/types';

const directory = new URL('../public/evidence/', import.meta.url);
const original = JSON.parse(readFileSync(new URL('event.json', directory), 'utf8')) as EventEvidence;
const copy = () => structuredClone(original);
const bytes = (name: string) => Uint8Array.from(readFileSync(new URL(name, directory)));
const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');

function localFetch(metadata = original, transform?: (url: string, bytes: Uint8Array) => Uint8Array) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    const path = String(input);
    if (path.endsWith('/event.json')) return new Response(JSON.stringify(metadata), { headers: { 'Content-Type': 'application/json' } });
    const name = path.slice(path.lastIndexOf('/') + 1);
    const value = transform ? transform(name, bytes(name)) : bytes(name);
    return new Response(value.buffer as ArrayBuffer);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('frozen LF evidence', () => {
  it('loads all float32 LE assets and RGB with exact frozen hashes and shapes', async () => {
    vi.stubGlobal('fetch', localFetch());
    const { evidence, arrays } = await loadEvidence('/evidence');
    expect(evidence.eventId).toBe('lf-241032');
    expect(evidence.assets.waterfall.sha256).toBe('4509c6a07c7c8eaddba285b1c5167a585926d70e188d6c001515bcd5037fe90f');
    expect(evidence.assets.dmMap.sha256).toBe('12d42a1c9c347f584e72bf691a0406f9917adcc32de2b3fbea3d22fe42640fa5');
    expect(arrays.waterfall).toBeInstanceOf(Float32Array);
    expect(arrays.waterfall.length).toBe(2048 * 64);
    expect(arrays.dmMap.length).toBe(96 * 2048);
    expect(arrays.originalCrop.length).toBe(512 * 64);
    expect(arrays.preparedCrop.length).toBe(512 * 64);
    expect(arrays.profile.length).toBe(512);
    expect(arrays.rgb).toBeInstanceOf(Uint8Array);
    expect(arrays.rgb.length).toBe(512 * 512 * 3);
    const view = new DataView(bytes('waterfall.f32').buffer);
    for (let i = 0; i < 64; i++) expect(arrays.waterfall[i]).toBe(view.getFloat32(i * 4, true));
  });

  it('separates metadata-only loading from deferred arrays without fetching tensors', async () => {
    const fetcher = localFetch();
    vi.stubGlobal('fetch', fetcher);
    const metadata = await loadEvidenceMetadata('/evidence/');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loadEvidenceArrays('/evidence', metadata);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it('uses the estimated candidate crop, exact source copy bounds, and its real SNR rather than injected DM', async () => {
    vi.stubGlobal('fetch', localFetch());
    const { evidence, arrays } = await loadEvidence();
    expect(evidence.truth.dm).toBe(500);
    expect(evidence.candidate.dm).toBe(494.7368469238281);
    expect(evidence.candidate.timeIndex).toBe(551);
    expect(evidence.crop.startSample).toBe(295);
    expect(evidence.crop.paddingLeft + evidence.crop.paddingRight).toBe(0);
    for (let t = 0; t < 512; t++) for (let channel = 0; channel < 64; channel++) {
      expect(arrays.originalCrop[t * 64 + channel]).toBe(
        arrays.waterfall[(evidence.crop.startSample + t + evidence.crop.delaySamples[channel]) * 64 + channel]);
    }
    expect(Math.max(...arrays.profile)).toBe(evidence.candidate.snr);
    expect(arrays.profile.indexOf(evidence.candidate.snr)).toBe(259);
    expect(evidence.candidate.widthMs).toBe(14);
    expect(evidence.assets.preparedCrop.sha256).toBe(evidence.inference.inputHashes.classifierNCHW);
  });

  it('retains original activation shapes, the real sigmoid heatmap, and all512 GAP features', () => {
    const evidence = validateEvidence(original);
    expect(evidence.snapshots).toHaveLength(8);
    const heatmap = evidence.snapshots.find(value => value.id === 'detector-sigmoid')!;
    expect(heatmap.shape).toEqual([1, 1, 128, 128]);
    expect([heatmap.height, heatmap.width]).toEqual([24, 24]);
    expect(heatmap.values.every(value => value >= 0 && value <= 1)).toBe(true);
    const gap = evidence.snapshots.find(value => value.id === 'classifier-gap-vector')!;
    expect(gap.shape).toEqual([1, 512]);
    expect(gap.values.length).toBe(512);
    expect(evidence.inference.logits).toEqual([-29.15385627746582, 28.75644302368164]);
    expect(evidence.inference.probabilities[1]).toBe(1);
  });

  it('keeps detector decode fractional time distinct from the truncated sample and discrete DM grid', () => {
    const decode = original.candidate.decode!;
    const x = (decode.peak[1] + decode.offset[0]) * decode.imgSize / decode.mapSize;
    const y = (decode.peak[0] + decode.offset[1]) * decode.imgSize / decode.mapSize;
    expect(x).toBeCloseTo(decode.centerCNN[0], 4);
    expect(y).toBeCloseTo(decode.centerCNN[1], 4);
    const sample = decode.centerCNN[0] * original.axes.samples / decode.imgSize;
    expect(Math.trunc(sample)).toBe(original.candidate.timeIndex);
    expect(sample * original.axes.dtSeconds).toBe(original.candidate.timeSeconds);
    const row = Math.round(decode.centerCNN[1] / (decode.imgSize - 1) * (original.axes.dmValues.length - 1));
    expect(original.axes.dmValues[row]).toBe(original.candidate.dm);
  });

  it('covers full valid windows with maximum DM1239 samples plus boxcar30, not legacy160 context', () => {
    expect(original.stream.contextSamples).toBe(1269);
    expect(original.stream.contextSamples).toBeGreaterThan(160);
    const coverage = new Uint8Array(original.axes.samples);
    for (const chunk of original.stream.chunks) for (let t = chunk.start; t < chunk.end; t++) coverage[t]++;
    expect(coverage.every(value => value === 1)).toBe(true);
    const modified = copy();
    modified.stream.contextSamples = 160;
    expect(() => validateEvidence(modified)).toThrow(/context/);
  });

  it('reconstructs full versus contextual chunked means at low, candidate, and maximum DM', async () => {
    vi.stubGlobal('fetch', localFetch());
    const { evidence, arrays } = await loadEvidence();
    const { samples, channels, frequenciesMHz, dmValues, dtSeconds } = evidence.axes;
    for (const row of [0, 47, 95]) {
      const shifts = frequenciesMHz.map(frequency => Math.round(4.148808e3 * dmValues[row] *
        (frequency ** -2 - frequenciesMHz[channels - 1] ** -2) / dtSeconds));
      for (const chunk of evidence.stream.chunks) for (let t = chunk.start; t < chunk.end; t++) {
        let sum = 0;
        let exposure = 0;
        for (let channel = 0; channel < channels; channel++) {
          const source = t + shifts[channel];
          if (source < chunk.blockStart || source >= chunk.blockEnd || source >= samples) continue;
          sum = Math.fround(sum + arrays.waterfall[source * channels + channel]);
          exposure++;
        }
        expect(Math.fround(sum / (exposure || 1))).toBe(arrays.dmMap[row * samples + t]);
      }
    }
  });

  it('exports a stated illustrative ADC/FFT without pretending these are recovered event voltages', () => {
    const { acquisition } = original;
    expect(acquisition.bits).toBe(4);
    expect(acquisition.voltages.length).toBe(64);
    expect(acquisition.quantized.every(value => value >= -1 && value <= 1)).toBe(true);
    expect(acquisition.fftPower.every(value => value >= 0)).toBe(true);
    expect(acquisition.fftPower[5]).toBeGreaterThan(acquisition.fftPower[8]);
    expect(original.sources.some(value => value.label.includes('not recovered voltages'))).toBe(true);
  });
});

describe('evidence failures and cancellation', () => {
  it('rejects shape, dtype, byte-count, hash metadata, malformed snapshots, and mismatched classifier probabilities', () => {
    const mutations = [
      (value: EventEvidence) => { value.assets.waterfall.shape[0]--; },
      (value: EventEvidence) => { value.assets.dmMap.dtype = 'uint8'; },
      (value: EventEvidence) => { value.assets.rgb.bytes--; },
      (value: EventEvidence) => { value.assets.profile.sha256 = 'not-a-hash'; },
      (value: EventEvidence) => { value.snapshots[0].values.pop(); },
      (value: EventEvidence) => { value.inference.probabilities = [0.5, 0.5]; },
      (value: EventEvidence) => { value.assets.waterfall.url = '../waterfall.f32'; },
    ];
    for (const mutate of mutations) { const changed = copy(); mutate(changed); expect(() => validateEvidence(changed)).toThrow(); }
  });

  it('rejects corrupted tensor bytes, truncated downloads, and verified but nonfinite float32', async () => {
    vi.stubGlobal('fetch', localFetch(original, (name, values) => { if (name === 'waterfall.f32') values[0] ^= 1; return values; }));
    await expect(loadEvidence()).rejects.toThrow(/SHA-256/);
    vi.stubGlobal('fetch', localFetch(original, (name, values) => name === 'waterfall.f32' ? values.slice(4) : values));
    await expect(loadEvidence()).rejects.toThrow(/byte count/);
    const changed = copy();
    const nonfinite = bytes('waterfall.f32');
    new DataView(nonfinite.buffer).setFloat32(0, NaN, true);
    changed.assets.waterfall.sha256 = digest(nonfinite);
    changed.inference.inputHashes.waterfallFloat32 = changed.assets.waterfall.sha256;
    vi.stubGlobal('fetch', localFetch(changed, (name, values) => name === 'waterfall.f32' ? nonfinite : values));
    await expect(loadEvidence()).rejects.toThrow(/non-finite/);
  });

  it('surfaces HTTP errors and aborts before or during load, never returning stale arrays', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(loadEvidence()).rejects.toThrow(/503/);
    const controller = new AbortController();
    controller.abort();
    const fetcher = localFetch();
    vi.stubGlobal('fetch', fetcher);
    await expect(loadEvidence('/evidence', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
    const pending = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    })));
    const loading = loadEvidence('/evidence', pending.signal);
    pending.abort();
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
  });
});
