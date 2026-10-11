import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EventEvidence, EvidenceArrays } from '../src/evidence/types';
import { buildFinaleModel, finaleConstruction, initialFinaleSelection, moveFinaleSelection, nearestIndex, selectFinale } from '../src/finale/model';
import { boxcarFilter, TOY_CROP, TOY_MAP, TOY_PROFILE } from '../src/methods/math';
import { CLASSIFICATION_METHODS, DETECTION_METHODS } from '../src/methods/catalog';

const root = new URL('../public/evidence/', import.meta.url);
const evidence = JSON.parse(readFileSync(new URL('event.json', root), 'utf8')) as EventEvidence;
const floats = (name: string) => {
  const bytes = readFileSync(new URL(name, root));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: bytes.byteLength / 4 }, (_, index) => view.getFloat32(index * 4, true));
};
const arrays: EvidenceArrays = {
  waterfall: floats('waterfall.f32'), dmMap: floats('dm-map.f32'), originalCrop: floats('original-crop.f32'),
  preparedCrop: floats('prepared-crop.f32'), profile: floats('profile.f32'), rgb: Uint8Array.from(readFileSync(new URL('rgb.u8', root))),
};
const recorded = { detection: 'cnn', classification: 'resnet' } as const;
const toy = { detection: 'boxcar', classification: 'radio' } as const;

describe('Final linked candidate evidence', () => {
  it('requires complete evidence for the only recorded inference route', () => {
    expect(buildFinaleModel(recorded, null, arrays)).toBeNull();
    expect(buildFinaleModel(recorded, evidence, null)).toBeNull();
    expect(() => buildFinaleModel(recorded, evidence, { ...arrays, dmMap: new Float32Array(2) })).toThrow(/shape/);
  });
  it('preserves the exact exported SNR array, peak and bank width', () => {
    const model = buildFinaleModel(recorded, evidence, arrays)!;
    expect(model.profile).toBe(arrays.profile);
    expect(model.peak.index).toBe(259); expect(model.peak.snr).toBe(evidence.candidate.snr);
    expect(model.peak.time).toBe(.554); expect(model.peak.widthSamples).toBe(14); expect(model.peak.widthMs).toBe(14);
    expect(model.window[0]).toBeCloseTo(.5465, 14); expect(model.window[1]).toBeCloseTo(.5605, 14);
    expect((model.window[0] + model.window[1]) / 2).toBeCloseTo(model.peak.time - model.dtSeconds / 2, 14);
  });
  it('does not conflate fractional CenterNet time, SNR peak time or injection truth', () => {
    const model = buildFinaleModel(recorded, evidence, arrays)!;
    expect(model.detectorTime).toBe(evidence.candidate.timeSeconds);
    expect(model.detectorTime).not.toBe(model.peak.time);
    expect(model.dm).toBe(evidence.candidate.dm); expect(model.dm).not.toBe(evidence.truth.dm);
    expect(model.classification.recorded).toBe(true);
    expect(model.classification.label).toBe('ResNet · clase 1 · softmax 1.0000');
  });
  it('uses one absolute time domain for profile, map slice and original dedispersed crop', () => {
    const model = buildFinaleModel(recorded, evidence, arrays)!;
    expect(model.timeBounds[0]).toBeCloseTo(.2945, 14); expect(model.timeBounds[1]).toBeCloseTo(.8065, 14);
    expect(model.map.times).toBe(model.times); expect(model.waterfall.times).toBe(model.times);
    expect(model.map.columns).toBe(512); expect(model.map.rows).toBe(96);
    for (const row of [0, 47, 95]) for (const index of [0, 256, 511]) {
      expect(model.map.values[row * 512 + index]).toBe(arrays.dmMap[row * 2048 + 295 + index]);
      const rasterCentre = model.timeBounds[0] + (index + .5) / model.map.columns * (model.timeBounds[1] - model.timeBounds[0]);
      expect(rasterCentre).toBeCloseTo(model.map.times[index], 14);
    }
    for (const channel of [0, 31, 63]) for (const index of [0, 256, 511]) {
      expect(model.waterfall.values[channel * 512 + index]).toBe(arrays.originalCrop[index * 64 + channel]);
    }
    expect(model.waterfall.coordinates).toEqual(Float64Array.from(evidence.axes.frequenciesMHz));
    expect(model.frequencyUnit).toBe('MHz');
  });
  it('never borrows learned scores, times, DM estimates or probabilities on other routes', () => {
    for (const detection of DETECTION_METHODS) for (const classification of CLASSIFICATION_METHODS) {
      if (detection.id === 'cnn' && classification.id === 'resnet') continue;
      const model = buildFinaleModel({ detection: detection.id, classification: classification.id }, evidence, arrays)!;
      expect(model.mode).toBe('didactic'); expect(model.eventId).toBe('toy-published');
      expect(model.detectorScore).toBeNull(); expect(model.detectorTime).toBeNull();
      expect(model.classification.recorded).toBe(false); expect(model.dm).toBe(500);
      expect(model.profile).not.toBe(arrays.profile); expect(model.frequencyUnit).toBe('canal');
      expect(model.provenance).toContain('independientes');
    }
  });
  it('uses the published matrices with explicit illustrative coordinates, not a synthesized measurement', () => {
    const model = buildFinaleModel(toy, null, null)!;
    expect(model.map.values).toEqual(Float32Array.from(TOY_MAP));
    expect(model.waterfall.values).toEqual(Float32Array.from(TOY_CROP));
    expect(model.map.coordinates[0]).toBe(31.25); expect(model.map.coordinates[15]).toBe(968.75);
    expect(model.map.times[0]).toBe(.002); expect(model.map.times[15]).toBe(.062);
    expect(model.timeBounds).toEqual([0,.064]); expect(model.threshold).toBe(6);
  });
  it('centres complete toy windows and recovers the selected width and sum exactly', () => {
    const model = buildFinaleModel(toy, null, null)!;
    const start = Math.round(model.window[0] / model.dtSeconds + .5);
    const filtered = boxcarFilter(TOY_PROFILE, model.peak.widthSamples);
    expect(model.peak.snr).toBe(Math.fround(filtered[start]));
    expect(model.peak.time).toBe((start + (model.peak.widthSamples - 1) / 2) * model.dtSeconds);
    expect(model.times[model.peak.index]).toBe(model.peak.time);
    expect((model.window[0] + model.window[1]) / 2).toBeCloseTo(model.peak.time, 14);
    expect(model.window[1] - model.window[0]).toBeCloseTo(model.peak.widthSamples * model.dtSeconds, 15);
    for (const value of model.profile) expect(Number.isFinite(value)).toBe(true);
  });
  it('keeps classifier provenance distinct from plot diagnostics', () => {
    expect(buildFinaleModel({ detection: 'boxcar', classification: 'forest' }, null, null)!.classification.detail).toContain('no clasifican estos plots');
    expect(buildFinaleModel({ detection: 'boxcar', classification: 'resnet' }, null, null)!.classification.label).toContain('sin clase inferida');
    expect(buildFinaleModel({ detection: 'transformer', classification: 'transformer' }, null, null)!.classification.detail).toContain('TOY_CROP');
    expect(buildFinaleModel({ detection: 'transformer', classification: 'radio' }, null, null)!.threshold).toBeNull();
  });
});

describe('Finale selection and construction', () => {
  it('selects nearest physical coordinates and keeps ties on the lower index', () => {
    expect(nearestIndex([10,20,30], 25)).toBe(1);
    expect(nearestIndex([30,20,10], 19)).toBe(1);
    expect(() => nearestIndex([], 0)).toThrow(RangeError);
    expect(() => nearestIndex([1], NaN)).toThrow(RangeError);
    const model = buildFinaleModel(recorded, evidence, arrays)!;
    const initial = initialFinaleSelection(model);
    expect(initial.timeIndex).toBe(259); expect(model.map.coordinates[initial.dmRow]).toBe(model.dm);
    expect(selectFinale(model, .296, 1000)).toEqual({ timeIndex: 1, dmRow: 95 });
    expect(moveFinaleSelection(model, initial, -1000, 1000)).toEqual({ timeIndex: 0, dmRow: 95 });
    expect(moveFinaleSelection(model, initial, 1000, -1000)).toEqual({ timeIndex: 511, dmRow: 0 });
  });
  it('commits integer counts reversibly without recomputing numerical matrices', () => {
    const model = buildFinaleModel(recorded, evidence, arrays)!;
    const early = finaleConstruction(.3, model), later = finaleConstruction(.7, model);
    expect(later.profile).toBeGreaterThanOrEqual(early.profile); expect(later.map).toBeGreaterThan(early.map);
    expect(later.waterfall).toBeGreaterThan(early.waterfall); expect(finaleConstruction(.3, model)).toEqual(early);
    for (const progress of [-3, 0, .17, .66, 1, 5]) {
      const state = finaleConstruction(progress, model);
      expect(Number.isInteger(state.profile)).toBe(true); expect(Number.isInteger(state.map)).toBe(true);
      expect(Number.isInteger(state.waterfall)).toBe(true);
    }
    expect(finaleConstruction(0, model)).toEqual({ profile: 0, map: 0, waterfall: 0, classification: false });
    expect(finaleConstruction(1, model)).toEqual({ profile: 512, map: 512*96, waterfall: 512*64, classification: true });
    expect(finaleConstruction(.87, model).classification).toBe(false);
    expect(finaleConstruction(.88, model).classification).toBe(true);
    expect(model.profile).toBe(arrays.profile);
  });
});
