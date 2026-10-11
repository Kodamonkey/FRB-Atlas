import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COSMIC_CHANNEL_INDICES, COSMIC_FREQUENCIES_MHZ, COSMIC_FOCUS_TERMS, COSMIC_STAGE_IDS, createCosmicStages, resolveCosmicFocus } from '../src/cinema/cosmicStages';
import { createPhysicalStages } from '../src/cinema/physicalStages';
import { COSMIC_MATH, faradayAngle, observedDispersion, observedRotation, rotateJones, stokesFromJones } from '../src/math/cosmicMath';
import { equationMarkup } from '../src/math/render';
import type { Stage } from '../src/cinema/types';
import type { EventEvidence, EvidenceArrays } from '../src/evidence/types';

const evidence = JSON.parse(readFileSync(new URL('../public/evidence/event.json', import.meta.url), 'utf8')) as EventEvidence;
const emptyArrays: EvidenceArrays = { waterfall: new Float32Array(), dmMap: new Float32Array(), originalCrop: new Float32Array(),
  preparedCrop: new Float32Array(), profile: new Float32Array(), rgb: new Uint8Array() };

describe('cosmic physical quantities', () => {
  it('separates observer DM from source-frame DM with only one redshift factor', () => {
    expect(observedDispersion(70, 50, 280, 130, .3)).toBe(500);
    expect(observedDispersion(70, 50, 280, 130, 0)).toBe(530);
    expect(observedDispersion(0, 0, 0, 130, .3)).toBe(100);
    expect(() => observedDispersion(-1, 0, 0, 0, 0)).toThrow(RangeError);
    expect(() => observedDispersion(0, 0, 0, 0, Infinity)).toThrow(RangeError);
  });
  it('uses wavelength squared for Faraday rotation and redshift squared for a local RM', () => {
    expect(faradayAngle(.3, 100, .2)).toBeCloseTo(4.3, 12);
    expect(faradayAngle(.3, -100, .2)).toBeCloseTo(-3.7, 12);
    expect(faradayAngle(.3, 100, 0)).toBe(.3);
    expect(observedRotation(144, .2)).toBeCloseTo(100, 12);
    expect(observedRotation(-144, .2)).toBeCloseTo(-100, 12);
    expect(() => faradayAngle(0, 0, -.1)).toThrow(RangeError);
    expect(() => observedRotation(1, -1)).toThrow(RangeError);
  });
  it('computes normalized Stokes and documents the conjugation sign', () => {
    expect(stokesFromJones({ y: [1, 0], z: [0, 0] })).toEqual({ I: 1, Q: 1, U: 0, V: 0 });
    expect(stokesFromJones({ y: [1, 0], z: [1, 0] })).toEqual({ I: 2, Q: 0, U: 2, V: 0 });
    expect(stokesFromJones({ y: [1, 0], z: [0, -1] })).toEqual({ I: 2, Q: 0, U: 0, V: 2 });
    expect(stokesFromJones({ y: [1, 0], z: [0, 1] })).toEqual({ I: 2, Q: 0, U: 0, V: -2 });
    expect(() => stokesFromJones({ y: [NaN, 0], z: [1, 0] })).toThrow(RangeError);
  });
  it('rotates Q/U by twice the angle while preserving I, V and polarized magnitude', () => {
    const input = { y: [1, .2] as const, z: [.4, -.3] as const }, angle = .73;
    const before = stokesFromJones(input), after = stokesFromJones(rotateJones(input, angle));
    expect(after.I).toBeCloseTo(before.I, 12); expect(after.V).toBeCloseTo(before.V, 12);
    expect(after.Q).toBeCloseTo(before.Q * Math.cos(2 * angle) - before.U * Math.sin(2 * angle), 12);
    expect(after.U).toBeCloseTo(before.Q * Math.sin(2 * angle) + before.U * Math.cos(2 * angle), 12);
    expect(after.I ** 2).toBeCloseTo(after.Q ** 2 + after.U ** 2 + after.V ** 2, 12);
  });
  it('renders every equation and binds exactly the same stage/term IDs', () => {
    expect(COSMIC_MATH.map(stage => stage.id)).toEqual(COSMIC_STAGE_IDS);
    COSMIC_MATH.forEach(stage => {
      expect(stage.terms.map(term => term.id)).toEqual(COSMIC_FOCUS_TERMS[stage.id as keyof typeof COSMIC_FOCUS_TERMS]);
      expect(stage.relation.split(/\s+/).length).toBeLessThanOrEqual(18);
      stage.terms.forEach(term => { expect(term.unit).not.toBe(''); expect(equationMarkup(stage, term.id)).toContain('is-active'); });
    });
  });
});

let stages: Stage[] = [];
beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture());
  stages = createCosmicStages();
});
afterEach(() => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  stages.forEach(stage => { stage.dispose?.(); stage.root.traverse(object => {
    const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  }); });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('reversible cosmic scenes', () => {
  it('builds nonblank scenes with deterministic buffers and focus targets', () => {
    expect(stages.map(stage => stage.id)).toEqual(COSMIC_STAGE_IDS);
    stages.forEach(stage => {
      const positions: THREE.BufferAttribute[] = []; stage.root.traverse(object => { const geometry = (object as THREE.Mesh).geometry;
        if (geometry?.getAttribute('position')) positions.push(geometry.getAttribute('position') as THREE.BufferAttribute); });
      expect(positions.length).toBeGreaterThan(5); expect(positions.some(attribute => attribute.count > 90)).toBe(true);
      expect(stage.mobileScale).toBeGreaterThan(1); expect(stage.camera.z).toBeGreaterThan(9);
      const snapshots = new Map<THREE.Material, number>(); stage.update(.6, 0); stage.root.traverse(object => {
        const material = (object as THREE.Mesh).material; if (material) (Array.isArray(material) ? material : [material]).forEach(value => snapshots.set(value, value.opacity)); });
      for (const term of COSMIC_FOCUS_TERMS[stage.id as keyof typeof COSMIC_FOCUS_TERMS]) {
        stage.setFocus?.(term); expect(stage.root.userData.focus).toBe(term);
        const targets: THREE.Object3D[] = []; stage.root.traverse(object => { if (object !== stage.root && object.userData.focusTerms?.includes(term)) targets.push(object); });
        expect(targets.length).toBeGreaterThan(0); expect([...snapshots].some(([material, initial]) => material.opacity < initial)).toBe(true);
        stage.setFocus?.(null); snapshots.forEach((initial, material) => expect(material.opacity).toBe(initial));
      }
      stage.setFocus?.('unrelated'); expect(stage.root.userData.focus).toBeNull();
      expect(resolveCosmicFocus(stage.id, 'unrelated')).toBeNull();
      for (const progress of [0, .2, 1, .2, 0]) stage.update(progress, 0);
      positions.forEach(attribute => expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true));
    });
  });
  it('tracks cumulative Galactic electron column without claiming a measured partition', () => {
    const galaxy = stages[1]; galaxy.update(0, 0); expect(galaxy.root.userData.dmObserved).toBe(380);
    const incomingDelays = Array.from(galaxy.root.userData.delaySeconds as Float64Array);
    galaxy.update(1, 0); expect(galaxy.root.userData.dmObserved).toBe(500);
    expect(galaxy.root.userData.dmComponents).toEqual({ hostObserved: 100, igmObserved: 280, halo: 50, disk: 70 });
    galaxy.update(1.9 / 5.55, 0); expect(galaxy.root.userData.dmObserved).toBeCloseTo(430, 12);
    expect(galaxy.root.userData.provenance).toContain('Ilustracion');
    expect(galaxy.root.userData.frequencyMHz).toEqual(COSMIC_FREQUENCIES_MHZ);
    galaxy.update(1, 0);
    const finalDelays = galaxy.root.userData.delaySeconds as Float64Array;
    expect(incomingDelays[0]).toBeCloseTo(4148.808 * 380 * ((32 / 38500) ** 2 - (32 / 51100) ** 2), 12);
    expect(finalDelays[0]).toBeCloseTo(4148.808 * 500 * ((32 / 38500) ** 2 - (32 / 51100) ** 2), 12);
    const packets = galaxy.root.children.filter(object => object.type === 'Line' && object.userData.frequencyMHz !== undefined);
    expect(packets).toHaveLength(6);
    expect(packets.map(packet => packet.userData.channelIndex)).toEqual(COSMIC_CHANNEL_INDICES);
    for (let i = 1; i < 6; i++) expect(packets[i].position.x).toBeGreaterThan(packets[i - 1].position.x);
    expect(packets[5].position.x - packets[0].position.x).toBeCloseTo(finalDelays[0] * 2.25, 12);
  });
  it('preserves the optional 100 to 380 DM path after applying native evidence', () => {
    const physical = createPhysicalStages({ propagationDm: 380, incomingDm: 100 }); stages.push(...physical);
    const plasma = physical.find(stage => stage.id === 'plasma')!;
    plasma.setEvidence?.(evidence, emptyArrays);
    for (const progress of [0, .25, .5, 1, .5, 0]) {
      plasma.update(progress, 0); expect(plasma.root.userData.dmAccumulated).toBe(100 + 280 * progress);
      expect(plasma.root.userData.dmTarget).toBe(380); expect(plasma.root.userData.dmIncoming).toBe(100);
      expect(plasma.root.userData.dmAdded).toBe(280 * progress);
    }
    plasma.update(1, 0);
    const expected = COSMIC_CHANNEL_INDICES.map(index => evidence.axes.frequenciesMHz[index]);
    expect(plasma.root.userData.frequencyMHz).toEqual(expected); expect(COSMIC_FREQUENCIES_MHZ).toEqual(expected);
    const galaxy = stages[1]; galaxy.update(0, 0);
    expect(Array.from(plasma.root.userData.accumulatedDelaySeconds as Float64Array)).toEqual(Array.from(galaxy.root.userData.delaySeconds as Float64Array));
    expect(() => createPhysicalStages({ propagationDm: 50, incomingDm: 100 })).toThrow(RangeError);
    expect(() => createPhysicalStages({ propagationDm: NaN })).toThrow(RangeError);
  });
  it('keeps propagation rightward and low radio frequencies behind high frequencies at Earth', () => {
    const earth = stages[3]; earth.update(0, 0); const start = earth.root.userData.eventLocalX;
    earth.update(1, 0); expect(earth.root.userData.eventLocalX).toBeGreaterThan(start);
    const frequencies = earth.root.userData.frequencyMHz as number[], delays = earth.root.userData.delaySeconds as number[];
    expect(frequencies[0]).toBe(1203.125); expect(frequencies[5]).toBe(1596.875);
    const oracle = 4148.808 * 500 * ((32 / 38500) ** 2 - (32 / 51100) ** 2);
    expect(delays[0]).toBeCloseTo(oracle, 12); expect(delays[5]).toBe(0);
    for (let i = 1; i < 6; i++) expect(delays[i]).toBeLessThan(delays[i - 1]);
    const galaxy = stages[1]; galaxy.update(1, 0);
    expect(delays).toEqual(Array.from(galaxy.root.userData.delaySeconds as Float64Array));
    expect(frequencies).toEqual(COSMIC_CHANNEL_INDICES.map(index => evidence.axes.frequenciesMHz[index]));
  });
  it('receives high bands first, then all six bands before the Earth scene completes', () => {
    const earth = stages[3]; earth.update(.5, 0);
    expect(earth.root.userData.receivedCount).toBeGreaterThan(0);
    expect(earth.root.userData.receivedCount).toBeLessThan(6);
    expect(earth.root.userData.receivedBands[5]).toBe(1); expect(earth.root.userData.receivedBands[0]).toBe(0);
    const arrivals = earth.root.userData.arrivalProgress as Float64Array;
    for (let i = 1; i < 6; i++) expect(arrivals[i]).toBeLessThan(arrivals[i - 1]);
    earth.update(1, 0); expect(earth.root.userData.receivedCount).toBe(6);
    expect(Array.from(earth.root.userData.receivedBands as Uint8Array)).toEqual([1, 1, 1, 1, 1, 1]);
    const packets = earth.root.children.filter(object => object.type === 'Line' && object.userData.frequencyMHz !== undefined);
    expect(packets).toHaveLength(6);
    packets.forEach(packet => { expect(packet.visible).toBe(false); expect(packet.position.x).toBe(earth.root.userData.receiverX); });
    earth.update(.3, 0); expect(earth.root.userData.receivedCount).toBe(0); packets.forEach(packet => expect(packet.visible).toBe(true));
  });
  it('enters the Galaxy and descends from orbit into an inspectable Chajnantor valley', () => {
    const galaxy = stages[1], earth = stages[3]; expect(galaxy.cameraAt).toBeTypeOf('function'); expect(earth.cameraAt).toBeTypeOf('function');
    galaxy.update(0, 0); expect(galaxy.root.userData.travelPhase).toBe('halo exterior');
    galaxy.update(1, 0); expect(galaxy.root.userData.travelPhase).toBe('vecindad solar');
    const stars: THREE.Points[] = []; galaxy.root.traverse(object => { if (object instanceof THREE.Points) stars.push(object); });
    expect(stars.length).toBeGreaterThan(1);
    stars.forEach(star => { const material = star.material as THREE.PointsMaterial;
      expect(material.userData.pointShape).toBe('circular-soft-edge'); expect(material.customProgramCacheKey()).toBe('cosmic-circular-points-v1'); });
    const globe = earth.root.getObjectByName('earth:surface') as THREE.Mesh;
    const observatory = earth.root.getObjectByName('chajnantor:observatory')!;
    earth.update(0, 0); expect(globe.visible).toBe(true); expect(observatory.visible).toBe(false);
    expect(earth.root.userData.travelPhase).toBe('orbita terrestre');
    const packets = earth.root.children.filter(object => object.type === 'Line' && object.userData.frequencyMHz !== undefined);
    const startY = packets[5].position.y;
    earth.update(.5, 0); expect(packets[5].position.y).toBeLessThan(startY);
    expect(earth.root.userData.travelPhase).toBe('descenso a Chile');
    earth.update(1, 0); expect(globe.visible).toBe(false); expect(observatory.visible).toBe(true);
    expect(earth.root.userData.valleyReveal).toBe(1); expect(earth.root.userData.surfaceOpacity).toBe(0);
    expect(earth.root.userData.receivedCount).toBe(6); expect(earth.root.userData.site.altitudeMeters).toBe(5000);
    expect(earth.root.userData.site.bandNote).toContain('no observacion del fixture LF');
    earth.setFocus?.('frequency');
    observatory.traverse(object => { const material = (object as THREE.Mesh).material;
      if (material) (Array.isArray(material) ? material : [material]).forEach(value => expect(value.opacity).toBeGreaterThanOrEqual(.6)); });
    earth.update(0, 0); expect(globe.visible).toBe(true); expect(observatory.visible).toBe(false);
    expect(earth.root.userData.receivedCount).toBe(0);
  });
  it('computes Stokes and frequency-specific angles from the same illustrated Faraday screen', () => {
    const polar = stages[2]; polar.update(0, 0); const zero = { ...polar.root.userData.stokes };
    polar.update(1, 0); const end = polar.root.userData.stokes;
    expect(end.I).toBeCloseTo(zero.I, 12); expect(end.V).toBeCloseTo(zero.V, 12);
    expect(end.Q).not.toBe(zero.Q); expect(polar.root.userData.rotationMeasure).toBe(24);
    expect(polar.root.userData.outputAngles[0]).toBeGreaterThan(polar.root.userData.outputAngles[2]);
    polar.update(0, 0); expect(polar.root.userData.stokes).toEqual(zero);
  });
  it('loads the NASA surface only when Earth first updates and reuses that texture', () => {
    expect(THREE.TextureLoader.prototype.load).not.toHaveBeenCalled();
    stages[3].update(0, 0); expect(THREE.TextureLoader.prototype.load).toHaveBeenCalledTimes(1);
    expect(THREE.TextureLoader.prototype.load).toHaveBeenCalledWith('/media/earth-blue-marble.png', expect.any(Function));
    stages[3].update(.5, 0); stages[3].update(1, 0); expect(THREE.TextureLoader.prototype.load).toHaveBeenCalledTimes(1);
  });
});
