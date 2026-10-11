import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTS, ACT_STARTS, EVIDENCE_PREFETCH, STORY, scrollSegments, splitProgress, stageTiming } from '../src/story';
import { PHYSICAL_STAGE_IDS } from '../src/cinema/physicalStages';
import { DATA_STAGE_IDS, GUIDED_DM_ROW, trialDelays, trialProfile } from '../src/cinema/dataStages';
import { EVENT_PORT, STAGE_PITCH, assertStageOrder, eventRouteX } from '../src/cinema/World';
import type { EventEvidence, EvidenceArrays } from '../src/evidence/types';

const IDS = ['faro', 'pulso', 'vuelo', 'plasma', 'antenas', 'fase', 'suma', 'receptor', 'fft', 'potencia',
  'matriz', 'bloques', 'alineacion', 'perfil', 'bowtie', 'rgb', 'backbone', 'upsampling', 'cabezas',
  'centernet', 'recorte', 'resnet', 'decision', 'candidato'];
const root = new URL('../public/evidence/', import.meta.url);
const evidence = JSON.parse(readFileSync(new URL('event.json', root), 'utf8')) as EventEvidence;
function floats(name: string): Float32Array {
  const data = readFileSync(new URL(name, root));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return Float32Array.from({ length: data.byteLength / 4 }, (_, i) => view.getFloat32(i * 4, true));
}
const arrays: EvidenceArrays = { waterfall: floats('waterfall.f32'), dmMap: floats('dm-map.f32'),
  originalCrop: floats('original-crop.f32'), preparedCrop: floats('prepared-crop.f32'),
  profile: floats('profile.f32'), rgb: Uint8Array.from(readFileSync(new URL('rgb.u8', root))) };

describe('24-phase event continuity', () => {
  it('matches story and physical/data stage ordering without missing or duplicate phases', () => {
    expect(STORY.map(step => step.id)).toEqual(IDS);
    expect([...PHYSICAL_STAGE_IDS, ...DATA_STAGE_IDS]).toEqual(IDS);
    expect(new Set(STORY.map(step => step.id)).size).toBe(24);
    expect(ACTS.length).toBe(6);
    expect(ACT_STARTS).toEqual([0, 2, 4, 10, 12, 15]);
    expect(() => assertStageOrder(IDS.map(id => ({ id })))).not.toThrow();
    expect(() => assertStageOrder(IDS.slice(1).map(id => ({ id })))).toThrow(/orden/);
    const incorrect = IDS.map(id => ({ id }));
    [incorrect[12], incorrect[13]] = [incorrect[13], incorrect[12]];
    expect(() => assertStageOrder(incorrect)).toThrow(/orden/);
  });

  it('keeps every visible interface brief and transfers its exact output label to the next input', () => {
    for (const [index, step] of STORY.entries()) {
      for (const label of [step.input, step.operation, step.output]) {
        const words = label.trim().split(/\s+/).length;
        expect(words).toBeGreaterThanOrEqual(1);
        expect(words).toBeLessThanOrEqual(4);
      }
      expect(step.caption.trim().split(/\s+/).length).toBeLessThanOrEqual(18);
      if (index < STORY.length - 1) expect(step.output).toBe(STORY[index + 1].input);
    }
  });

  it('prefetches before verified acquisition while preserving the illustrative-to-dataset boundary', () => {
    expect(EVIDENCE_PREFETCH).toBe(4);
    expect(STORY.slice(0, 7).every(step => !step.requiresEvidence)).toBe(true);
    expect(STORY.slice(7).every(step => step.requiresEvidence)).toBe(true);
    expect(STORY.slice(7, 10).every(step => step.readout === 'acquisition')).toBe(true);
    expect(STORY[9].detail.toLocaleLowerCase('es')).toMatch(/ilustrativ/);
    expect(STORY[9].detail.toLocaleLowerCase('es')).toMatch(/independiente/);
    expect(STORY[10].readout).toBe('waterfall');
    expect(STORY[10].provenance.toLocaleLowerCase('es')).toMatch(/sintétic/);
    expect(STORY[10].detail).toContain('2048');
    expect(STORY[10].detail).toContain('64');
  });

  it('keeps the guided intensity profile identical to one scientific DM-map row, not the candidate SNR crop', () => {
    expect(GUIDED_DM_ROW).toBe(47);
    const profile = trialProfile(evidence, arrays);
    const expected = arrays.dmMap.subarray(47 * evidence.axes.samples, 48 * evidence.axes.samples);
    expect(profile.length).toBe(2048);
    expect(Array.from(profile)).toEqual(Array.from(expected));
    expect(profile.buffer).toBe(arrays.dmMap.buffer);
    expect(profile).not.toBe(arrays.profile);
    expect(arrays.profile.length).toBe(512);
    expect(STORY[13].readout).toBe('profile');
    expect(STORY[13].operation.toLocaleLowerCase('es')).toMatch(/media/);
    expect(STORY[13].detail.toLocaleLowerCase('es')).toMatch(/no es snr/);
    expect(STORY[14].readout).toBe('map');
    expect(() => trialProfile(evidence, { ...arrays, dmMap: arrays.dmMap.slice(1) })).toThrow(/shape/);
  });

  it('retains measured decode vectors and snapshots without inventing WH or offset maps', () => {
    expect(STORY[18].id).toBe('cabezas');
    expect(STORY[18].detail.toLocaleLowerCase('es')).toMatch(/no mapas completos/);
    expect(evidence.candidate.decode?.size).toEqual([25.168102264404297, 85.68080139160156]);
    expect(evidence.candidate.decode?.offset).toEqual([0.45134857296943665, 0.40629106760025024]);
    expect(evidence.snapshots.some(snapshot => snapshot.id === 'detector-sigmoid')).toBe(true);
    expect(evidence.snapshots.some(snapshot => /wh_head|offset_head/.test(snapshot.id))).toBe(false);
    expect(evidence.snapshots.find(snapshot => snapshot.id === 'classifier-gap-vector')?.values.length).toBe(512);
    expect(evidence.inference.logits.length).toBe(2);
    expect(evidence.inference.probabilities.length).toBe(2);
    expect(STORY[23].provenance.toLocaleLowerCase('es')).toMatch(/sintétic/);
    expect(STORY[23].detail.toLocaleLowerCase('es')).toMatch(/confirmación/);
  });

  it('derives the guided alignment from its DM hypothesis rather than later candidate-crop metadata', () => {
    const delays = trialDelays(evidence);
    expect(delays).toEqual(evidence.crop.delaySamples);
    expect(Math.min(...delays)).toBe(0);
    expect(Math.max(...delays)).toBe(613);
    const otherCrop = { ...evidence, crop: { ...evidence.crop, delaySamples: new Array(64).fill(0) } };
    expect(trialDelays(otherCrop)).toEqual(delays);
  });
});

describe('operation, hold, then horizontal handoff', () => {
  it('finishes each operation by 0.56 and holds the complete output through 0.72 before advancing', () => {
    expect(stageTiming(0)).toEqual({ operation: 0, handoff: 0 });
    expect(stageTiming(0.08)).toEqual({ operation: 0, handoff: 0 });
    expect(stageTiming(0.32).operation).toBeCloseTo(0.5, 12);
    for (const local of [0.56, 0.6, 0.65, 0.72]) {
      expect(stageTiming(local).operation).toBeCloseTo(1, 12);
      expect(stageTiming(local).handoff).toBe(0);
    }
    expect(stageTiming(0.86).handoff).toBeCloseTo(0.5, 12);
    expect(stageTiming(1)).toEqual({ operation: 1, handoff: 1 });
    expect(stageTiming(-10)).toEqual({ operation: 0, handoff: 0 });
    expect(stageTiming(10)).toEqual({ operation: 1, handoff: 1 });
  });

  it('is bounded, monotonic, and reversible with no advancement while a calculation is incomplete', () => {
    const forward = Array.from({ length: 1001 }, (_, i) => stageTiming(i / 1000));
    const backward = Array.from({ length: 1001 }, (_, i) => stageTiming((1000 - i) / 1000));
    expect(backward.reverse()).toEqual(forward);
    for (const [i, result] of forward.entries()) {
      expect(result.operation).toBeGreaterThanOrEqual(0); expect(result.operation).toBeLessThanOrEqual(1);
      expect(result.handoff).toBeGreaterThanOrEqual(0); expect(result.handoff).toBeLessThanOrEqual(1);
      if (result.operation < 1) expect(result.handoff).toBe(0);
      if (result.handoff > 0) expect(result.operation).toBe(1);
      if (i) {
        expect(result.operation).toBeGreaterThanOrEqual(forward[i - 1].operation);
        expect(result.handoff).toBeGreaterThanOrEqual(forward[i - 1].handoff);
      }
    }
  });

  it('maps long scroll segments and reverse positions to all 24 phases, including the final phase', () => {
    const starts = Array.from({ length: 24 }, (_, i) => i * 1500);
    expect(scrollSegments(starts, 24 * 1500)).toEqual(new Array(24).fill(1500));
    for (let sequence = 0; sequence < 24; sequence++) {
      const value = splitProgress(sequence + 0.56);
      expect(value.sequence).toBe(sequence);
      expect(value.local).toBeCloseTo(0.56, 12);
      expect(stageTiming(value.local).handoff).toBe(0);
    }
    expect(splitProgress(24).sequence).toBe(23);
    expect(splitProgress(-1).sequence).toBe(0);
    expect(splitProgress(NaN).global).toBe(0);
  });

  it('holds the tracked event at the output and joins every horizontal handoff to the next input without a jump', () => {
    for (let sequence = 0; sequence < 24; sequence++) {
      const output = eventRouteX(sequence, 1, 0, 24);
      expect(output).toBe(sequence * STAGE_PITCH + EVENT_PORT);
      for (const local of [0.56, 0.6, 0.65, 0.72]) {
        const { operation, handoff } = stageTiming(local);
        expect(eventRouteX(sequence, operation, handoff, 24)).toBeCloseTo(output, 10);
      }
      if (sequence === 23) continue;
      expect(eventRouteX(sequence, 1, 1, 24)).toBe(eventRouteX(sequence + 1, 0, 0, 24));
      const halfway = eventRouteX(sequence, 1, 0.5, 24);
      expect(halfway).toBeGreaterThan(output);
      expect(halfway).toBeLessThan(eventRouteX(sequence + 1, 0, 0, 24));
    }
  });
});
