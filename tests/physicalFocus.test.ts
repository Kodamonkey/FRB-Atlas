import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { averageComplexVisibility, complexProductConjugate, createPhysicalStages,
  PHYSICAL_FOCUS_TERMS, PHYSICAL_STAGE_IDS, resolvePhysicalFocus } from '../src/cinema/physicalStages';
import type { Stage } from '../src/cinema/types';
import type { EventEvidence, EvidenceArrays } from '../src/evidence/types';

const evidence = JSON.parse(readFileSync(new URL('../public/evidence/event.json', import.meta.url), 'utf8')) as EventEvidence;
const arrays: EvidenceArrays = { waterfall: new Float32Array(), dmMap: new Float32Array(), originalCrop: new Float32Array(),
  preparedCrop: new Float32Array(), profile: new Float32Array(), rgb: new Uint8Array() };
let stages: Stage[];

function materials(stage: Stage) {
  const result = new Set<THREE.Material>();
  stage.root.traverse(object => {
    const material = (object as THREE.Mesh).material;
    if (material) (Array.isArray(material) ? material : [material]).forEach(value => result.add(value));
  });
  return [...result];
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
  stages = createPhysicalStages();
});
afterEach(() => {
  const geometries = new Set<THREE.BufferGeometry>();
  stages.forEach(stage => {
    stage.dispose?.(); materials(stage).forEach(material => material.dispose());
    stage.root.traverse(object => { if ((object as THREE.Mesh).geometry) geometries.add((object as THREE.Mesh).geometry); });
  });
  geometries.forEach(geometry => geometry.dispose()); vi.unstubAllGlobals();
});

describe('reversible physical term focus', () => {
  it('uses the two signal bins from the serialized ADC example for its Fourier bases', () => {
    const bins: number[] = [];
    stages.find(stage => stage.id === 'fft')!.root.traverse(object => {
      if (object.userData.fftBin !== undefined) bins.push(object.userData.fftBin);
    });
    expect(bins).toEqual([5, 13]);
  });
  it('keeps the exact ten-stage order and rejects terms from another scene', () => {
    expect(stages.map(stage => stage.id)).toEqual(PHYSICAL_STAGE_IDS);
    expect(PHYSICAL_FOCUS_TERMS).toEqual({
      faro: ['rotation', 'field'], pulso: ['field', 'envelope', 'intensity'], vuelo: ['distance', 'speed', 'time'],
      plasma: ['density', 'path', 'dm', 'frequency', 'delay'], antenas: ['baseline', 'direction', 'delay'],
      fase: ['voltage', 'product', 'average', 'visibility'], suma: ['voltage', 'phase', 'power'],
      receptor: ['voltage', 'code', 'bits'], fft: ['window', 'frequency', 'amplitude'], potencia: ['amplitude', 'power', 'average'],
    });
    expect(resolvePhysicalFocus('plasma', 'density')).toBe('density');
    expect(resolvePhysicalFocus('plasma', 'voltage')).toBeNull();
    expect(resolvePhysicalFocus('missing', 'density')).toBeNull();
    expect(resolvePhysicalFocus('faro', null)).toBeNull();
  });

  it('applies every term immediately, dims other content, and restores exact opacities', () => {
    stages.forEach(stage => {
      stage.setEvidence?.(evidence, arrays); stage.update(.75, 0);
      const values = materials(stage), original = values.map(material => material.opacity);
      const signatures = new Set<string>();
      for (const term of PHYSICAL_FOCUS_TERMS[stage.id as keyof typeof PHYSICAL_FOCUS_TERMS]) {
        stage.setFocus?.(term);
        expect(stage.root.userData.focus).toBe(term);
        const selected: THREE.Object3D[] = [];
        stage.root.traverse(object => { if (object !== stage.root && object.userData.focusTerms?.includes(term)) selected.push(object); });
        expect(selected.some(object => object.visible)).toBe(true);
        expect(values.some((material, index) => material.opacity < original[index])).toBe(true);
        signatures.add(JSON.stringify(values.map(material => material.opacity)));
        stage.update(.75, 0);
        expect(stage.root.userData.focus).toBe(term);
        stage.setFocus?.(null);
        expect(values.map(material => material.opacity)).toEqual(original);
        values.forEach(material => {
          if (material instanceof THREE.ShaderMaterial && material.uniforms.uFocus) expect(material.uniforms.uFocus.value).toBe(1);
        });
      }
      expect(signatures.size).toBe(PHYSICAL_FOCUS_TERMS[stage.id as keyof typeof PHYSICAL_FOCUS_TERMS].length);
      stage.setFocus?.('not-a-term'); expect(stage.root.userData.focus).toBeNull();
    });
  });

  it('reuses all geometry and position buffers throughout scrubbing and focus changes', () => {
    stages.forEach(stage => {
      stage.setEvidence?.(evidence, arrays);
      const buffers = new Map<THREE.Object3D, { geometry: THREE.BufferGeometry; position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute }>();
      stage.root.traverse(object => {
        const geometry = (object as THREE.Mesh).geometry;
        if (geometry) buffers.set(object, { geometry, position: geometry.getAttribute('position') });
      });
      for (const progress of [0, .2, .65, 1, .4, 0]) {
        stage.update(progress, 1); stage.setFocus?.(PHYSICAL_FOCUS_TERMS[stage.id as keyof typeof PHYSICAL_FOCUS_TERMS][0]);
      }
      buffers.forEach((original, object) => {
        expect((object as THREE.Mesh).geometry).toBe(original.geometry);
        expect((object as THREE.Mesh).geometry.getAttribute('position')).toBe(original.position);
      });
    });
  });
});

describe('column, normalized acquisition, and parallel correlator', () => {
  it('accumulates DM and its frequency-dependent delay together, preserving the held arrivals', () => {
    const plasma = stages[3]; plasma.setEvidence?.(evidence, arrays);
    const waves = plasma.root.children.slice(0, 6);
    for (const progress of [0, .25, .5, .75, 1]) {
      plasma.update(progress, 0);
      expect(plasma.root.userData.dmAccumulated).toBe(evidence.truth.dm * progress);
      const frequencies = plasma.root.userData.frequencyMHz as number[];
      const delays = plasma.root.userData.accumulatedDelaySeconds as Float64Array;
      frequencies.forEach((frequency, index) => {
        expect(delays[index]).toBeCloseTo(4148.808 * evidence.truth.dm * progress * (frequency ** -2 - frequencies[5] ** -2), 12);
      });
      expect(plasma.root.userData.dmUnits).toBe('pc cm^-3');
    }
    const arrivals = waves.map(wave => wave.position.x);
    arrivals.slice(1).forEach((x, index) => expect(x).toBeGreaterThan(arrivals[index]));
    expect(arrivals[5]).toBeCloseTo(1.6, 12);
    plasma.setFocus?.('density'); const density = materials(plasma).map(material => material.opacity);
    plasma.setFocus?.('delay'); expect(materials(plasma).map(material => material.opacity)).not.toEqual(density);
    plasma.update(1, 12); expect(waves.map(wave => wave.position.x)).toEqual(arrivals);
  });

  it('uses the correct conjugation sign and complex temporal mean, not voltage summation', () => {
    expect(complexProductConjugate({ real: 1, imag: 2 }, { real: 3, imag: 4 })).toEqual({ real: 11, imag: 2 });
    const left = [{ real: 1, imag: 0 }, { real: 0, imag: 1 }];
    const right = [{ real: 0, imag: 1 }, { real: 0, imag: -1 }];
    expect(averageComplexVisibility(left, right, 1)).toEqual({ real: 0, imag: -1 });
    expect(averageComplexVisibility(left, right)).toEqual({ real: -.5, imag: -.5 });
    expect(averageComplexVisibility([], [])).toEqual({ real: 0, imag: 0 });
    expect(averageComplexVisibility(left, right, 99)).toEqual({ real: -.5, imag: -.5 });
    const phase = stages[5]; phase.update(.5, 0);
    expect(phase.root.children.filter(object => object.userData.focusTerms?.includes('voltage') && object.type === 'Line')).toHaveLength(6);
    expect(phase.root.userData.correlationSamples).toBe(32);
    expect(phase.root.userData.correlationUnits).toBe('normalized');
    expect(phase.root.userData.correlationKind).toContain('parallel voltage branch');
    const midVisibility = { ...phase.root.userData.visibility }; phase.update(1, 0);
    expect(phase.root.userData.correlationSamples).toBe(64);
    expect(phase.root.userData.visibility).not.toEqual(midVisibility);
    expect(Math.hypot(phase.root.userData.visibility.real, phase.root.userData.visibility.imag)).toBeLessThanOrEqual(.8);
    expect(phase.root.userData.normalizedPower).toBe(1);
  });

  it('retains fixture acquisition, exact ADC codes, Hann weighting, and dimensionless amplitudes', () => {
    const frozen = JSON.stringify(evidence.acquisition);
    const adc = stages[7]; adc.setEvidence?.(evidence, arrays); adc.update(.5, 0);
    expect(adc.root.userData.adcBits).toBe(4); expect(adc.root.userData.adcSample).toBe(31);
    expect(adc.root.userData.adcCode).toBe(Math.round((evidence.acquisition.quantized[31] + 1) * 7.5));
    const fft = stages[8]; fft.setEvidence?.(evidence, arrays); fft.setFocus?.('window'); fft.update(1, 0);
    const weighted = fft.root.children.find(object => object.type === 'Line' && object.userData.focusTerms?.includes('window')) as THREE.Line;
    const positions = weighted.geometry.getAttribute('position');
    for (let n = 0; n < 64; n++) {
      const hann = .5 - .5 * Math.cos(n / 63 * Math.PI * 2);
      expect(positions.getY(n)).toBeCloseTo(evidence.acquisition.quantized[n] * hann * .72, 6);
    }
    const power = stages[9]; power.setEvidence?.(evidence, arrays); power.update(1, 0); power.setFocus?.('average');
    expect(power.root.userData.acquisitionUnits).toBe('normalized');
    expect(power.root.userData.amplitudeConvention).toContain('no recovered phase');
    expect(power.root.userData.integrationKind).toBe('8 repeated illustrative windows');
    expect(JSON.stringify(evidence.acquisition)).toBe(frozen);
  });
});
