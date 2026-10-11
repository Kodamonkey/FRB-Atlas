import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OBSERVATIONS, channelCentre, effectiveDt } from '../src/observations';
import { createCosmicStages, COSMIC_FOCUS_TERMS } from '../src/cinema/cosmicStages';
import { createPhysicalStages, PHYSICAL_FOCUS_TERMS } from '../src/cinema/physicalStages';
import { ARECIBO, CHAJNANTOR } from '../src/cinema/observatory';
import { observationMathFor } from '../src/math/observationMath';
import { equationMarkup } from '../src/math/render';
import type { Stage } from '../src/cinema/types';
import type { EventEvidence, EvidenceArrays } from '../src/evidence/types';

const lf = OBSERVATIONS['arecibo-lf'], hf = OBSERVATIONS['alma-hf'];
const evidence = JSON.parse(readFileSync(new URL('../public/evidence/event.json', import.meta.url), 'utf8')) as EventEvidence;
const arrays: EvidenceArrays = { waterfall: new Float32Array(), dmMap: new Float32Array(), originalCrop: new Float32Array(),
  preparedCrop: new Float32Array(), profile: new Float32Array(), rgb: new Uint8Array() };
let stages: Stage[] = [];
beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
});
afterEach(() => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  stages.forEach(stage => { stage.dispose?.(); stage.root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  }); });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  stages = []; vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('case-specific electron propagation', () => {
  it('preserves the LF host/IGM/Galaxy column and points the Earth arrival to historical Arecibo', () => {
    const cosmic = createCosmicStages(lf), physical = createPhysicalStages({ observation: lf, incomingDm: 100, propagationDm: 380 });
    stages.push(...cosmic, ...physical);
    const plasma = physical.find(stage => stage.id === 'plasma')!, galaxy = cosmic[1], earth = cosmic[3];
    plasma.setEvidence?.(evidence, arrays); plasma.update(1, 0); galaxy.update(0, 0);
    expect(plasma.root.userData.dmAccumulated).toBe(380);
    expect(Array.from(plasma.root.userData.accumulatedDelaySeconds)).toEqual(Array.from(galaxy.root.userData.delaySeconds));
    galaxy.update(1, 0); earth.update(1, 0);
    expect(galaxy.root.userData.dmComponents).toEqual({ hostObserved: 100, igmObserved: 280, halo: 50, disk: 70 });
    expect(earth.root.userData.dispersionDm).toBe(500); expect(earth.root.userData.receivedCount).toBe(6);
    expect(earth.root.userData.site).toBe(ARECIBO); expect(earth.root.userData.travelPhase).toBe('valle de Arecibo');
    expect(earth.root.getObjectByName('arecibo:observatory')).toBeDefined();
    expect(earth.root.getObjectByName('chajnantor:observatory')).toBeUndefined();
    expect(earth.root.userData.delaySeconds).toEqual(Array.from(galaxy.root.userData.delaySeconds));
  });
  it('uses actual HF channel centres and a Galactic column without host or IGM components', () => {
    const cosmic = createCosmicStages(hf), physical = createPhysicalStages({ observation: hf }); stages.push(...cosmic, ...physical);
    const plasma = physical.find(stage => stage.id === 'plasma')!, galaxy = cosmic[1], earth = cosmic[3];
    expect(plasma.setEvidence).toBeUndefined();
    const frequencies = [0, 6, 12, 19, 25, 31].map(index => channelCentre(hf, index));
    plasma.update(1, 0); galaxy.update(1, 0); earth.update(1, 0);
    expect(plasma.root.userData.frequencyMHz).toEqual(frequencies); expect(galaxy.root.userData.frequencyMHz).toEqual(frequencies);
    expect(earth.root.userData.frequencyMHz).toEqual(frequencies);
    expect(plasma.root.userData.dmAccumulated).toBe(1770);
    expect(galaxy.root.userData.origin).toBe('galactic'); expect(galaxy.root.userData.dmComponents).toEqual({ interstellar: 1770, hostObserved: 0, igmObserved: 0 });
    expect(earth.root.userData.dispersionDm).toBe(1770); expect(earth.root.userData.site).toBe(CHAJNANTOR);
    expect(earth.root.userData.delaySeconds).toEqual(Array.from(plasma.root.userData.accumulatedDelaySeconds));
    expect(earth.root.userData.delaySeconds).toEqual(Array.from(galaxy.root.userData.delaySeconds));
    const oracleSeconds = .004148808 * 1770 * (85.29925 ** -2 - 87.23675 ** -2);
    expect(earth.root.userData.delaySeconds[0]).toBeCloseTo(oracleSeconds, 16);
    expect(earth.root.userData.dispersionEffectiveBins).toBeCloseTo(oracleSeconds / .004096, 12);
    expect(earth.root.userData.dispersionEffectiveBins).toBeLessThan(.011);
  });
  it('does not magnify a 44-microsecond HF delay to the LF arrival sweep', () => {
    const cosmic = createCosmicStages(hf); stages.push(...cosmic); const earth = cosmic[3];
    earth.update(.479, 0); expect(earth.root.userData.receivedCount).toBe(0);
    earth.update(.481, 0); expect(earth.root.userData.receivedCount).toBeGreaterThan(0); expect(earth.root.userData.receivedCount).toBeLessThan(6);
    const arrivals = earth.root.userData.arrivalProgress as Float64Array;
    expect(arrivals[0] - arrivals[5]).toBeLessThan(.004);
    expect(arrivals[0] - arrivals[5]).toBeCloseTo(.36 * earth.root.userData.delaySeconds[0] / effectiveDt(hf), 12);
    earth.update(.485, 0); expect(earth.root.userData.receivedCount).toBe(6);
    earth.update(0, 0); expect(earth.root.userData.receivedCount).toBe(0);
  });
});

describe('case-specific telescope geometry and math', () => {
  it('shows one fixed Arecibo aperture and optical reception, not six phased-array branches', () => {
    const physical = createPhysicalStages({ observation: lf }); stages.push(...physical);
    const antenna = physical.find(stage => stage.id === 'antenas')!; antenna.update(1, 0);
    expect(antenna.root.userData.apertureMeters).toBe(305); expect(antenna.root.userData.feedCount).toBe(1);
    expect(antenna.root.userData.opticalModel).toContain('not interferometric');
    expect(antenna.root.getObjectByName('arecibo:observatory')).toBeDefined();
    expect(antenna.root.userData.baselineVector).toBeUndefined();
    const numeric = observationMathFor('antenas', lf.id)!;
    expect(numeric.formula).toContain('int_{A('); expect(numeric.formula).not.toContain('mathbf b');
    expect(numeric.units).toContain('no siete antenas');
  });
  it('keeps the HF illustrative array and correlator distinct from power acquisition', () => {
    const physical = createPhysicalStages({ observation: hf }); stages.push(...physical);
    const antenna = physical.find(stage => stage.id === 'antenas')!; antenna.update(1, 0);
    expect(antenna.root.userData.baselineVector).toEqual([5.4, 0, -.1]);
    expect(antenna.root.userData.site).toBe(CHAJNANTOR);
    antenna.setFocus?.('delay');
    const instrumentMaterials = antenna.root.children.filter(object => object instanceof THREE.InstancedMesh)
      .map(object => (object as THREE.InstancedMesh).material).filter(material => material instanceof THREE.MeshStandardMaterial);
    expect(instrumentMaterials.length).toBeGreaterThan(3);
    instrumentMaterials.forEach(material => { expect((material as THREE.Material).opacity).toBeGreaterThanOrEqual(.65); });
    const correlator = physical.find(stage => stage.id === 'fase')!; correlator.update(1, 0);
    expect(correlator.root.userData.correlationKind).toContain('parallel voltage branch');
    expect(observationMathFor('antenas', hf.id)!.example).toContain('37 antenas');
  });
  it('constructs finite reversible models and camera poses, then disposes their resources', () => {
    for (const observation of [lf, hf]) {
      const cosmic = createCosmicStages(observation), physical = createPhysicalStages({ observation }); stages.push(...cosmic, ...physical);
      for (const stage of [...cosmic, ...physical]) {
        for (const progress of [0, .25, .65, 1, .25, 0]) {
          stage.update(progress, 0);
          const pose = stage.cameraAt?.(progress);
          if (pose) expect([...pose.camera.toArray(), ...pose.target.toArray()].every(Number.isFinite)).toBe(true);
        }
        let count = 0; stage.root.traverse(object => { const geometry = (object as THREE.Mesh).geometry;
          if (geometry) { count++; expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true); } });
        expect(count).toBeGreaterThan(1); expect(stage.root.userData.observationCase).toBe(observation.id);
      }
      const earth = cosmic[3]; earth.update(1, 0);
      expect(earth.root.userData.valleyReveal).toBe(1); expect(earth.root.userData.receivedCount).toBe(6);
      const close = earth.cameraAt!(1), distance = close.camera.distanceTo(close.target);
      expect(distance).toBeGreaterThan(observation.id === 'arecibo-lf' ? 6 : 4);
      expect(distance).toBeLessThan(8); expect(close.camera.x).toBe(1.6);
      earth.update(0, 0); expect(earth.root.userData.valleyReveal).toBe(0);
    }
  });
  it('renders all case equations with matching visual focus IDs and correct units', () => {
    for (const observation of [lf, hf]) for (const id of ['faro', 'pulso', 'vuelo', 'plasma', 'galaxia', 'polarizacion', 'tierra', 'antenas']) {
      const stage = observationMathFor(id, observation.id)!;
      expect(stage.id).toBe(id); expect(stage.relation.split(/\s+/).length).toBeLessThanOrEqual(18);
      const expected = id in COSMIC_FOCUS_TERMS ? COSMIC_FOCUS_TERMS[id as keyof typeof COSMIC_FOCUS_TERMS]
        : PHYSICAL_FOCUS_TERMS[id as keyof typeof PHYSICAL_FOCUS_TERMS];
      expect(stage.terms.map(value => value.id)).toEqual(expected);
      stage.terms.forEach(value => { expect(value.unit).not.toBe(''); expect(equationMarkup(stage, value.id)).toContain('is-active'); });
    }
    expect(observationMathFor('unknown', hf.id)).toBeNull();
    expect(observationMathFor('plasma', hf.id)!.formula).toContain('10^{-3}');
    expect(observationMathFor('plasma', hf.id)!.example).toContain('0.010824');
    expect(observationMathFor('plasma', lf.id)!.formula).toContain('host,obs');
  });
});
