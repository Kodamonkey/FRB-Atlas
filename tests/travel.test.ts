import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHAJNANTOR, OBSERVATORY_LAYOUT, chajnantorHeight, createChajnantorTerrain, createObservatory, geographicalNormal } from '../src/cinema/observatory';
import { createTravelCamera, EARTH_CAMERA, GALACTIC_CAMERA } from '../src/cinema/travelCamera';

describe('continuous local travel camera', () => {
  for (const [name, frames] of [['galaxy', GALACTIC_CAMERA], ['earth', EARTH_CAMERA]] as const) {
    it(`${name} travels closer, remains finite and never reverses local camera x`, () => {
      const cameraAt = createTravelCamera(frames), start = cameraAt(0), distance = start.camera.distanceTo(start.target);
      const startCamera = start.camera.clone(), startTarget = start.target.clone();
      let previousX = start.camera.x, previousCamera = start.camera.clone(), previousTarget = start.target.clone();
      for (let step = 1; step <= 1000; step++) {
        const pose = cameraAt(step / 1000);
        expect([...pose.camera.toArray(), ...pose.target.toArray()].every(Number.isFinite)).toBe(true);
        expect(pose.camera.x).toBeGreaterThanOrEqual(previousX);
        expect(pose.camera.distanceTo(previousCamera)).toBeLessThan(.04);
        expect(pose.target.distanceTo(previousTarget)).toBeLessThan(.02);
        previousX = pose.camera.x; previousCamera.copy(pose.camera); previousTarget.copy(pose.target);
      }
      expect(cameraAt(1).camera.distanceTo(cameraAt(1).target)).toBeLessThan(distance * .38);
      expect(cameraAt(0).camera).toEqual(startCamera); expect(cameraAt(0).target).toEqual(startTarget);
      expect(cameraAt(.63)).toBe(start); expect(cameraAt(.63).camera).toBe(start.camera);
      expect(cameraAt(-1).camera.toArray()).toEqual(frames[0].camera);
      expect(cameraAt(2).camera.toArray()).toEqual(frames[frames.length - 1].camera);
      expect(cameraAt(NaN).camera.toArray()).toEqual(frames[0].camera);
    });
    it(`${name} reaches every keyframe exactly with zero endpoint speed`, () => {
      const cameraAt = createTravelCamera(frames);
      frames.forEach(frame => {
        cameraAt(frame.progress).camera.toArray().forEach((value, i) => expect(value).toBeCloseTo(frame.camera[i], 14));
        cameraAt(frame.progress).target.toArray().forEach((value, i) => expect(value).toBeCloseTo(frame.target[i], 14));
        const center = cameraAt(frame.progress).camera.clone();
        expect(cameraAt(frame.progress + .00001).camera.distanceTo(center)).toBeLessThan(.000001);
        expect(cameraAt(frame.progress - .00001).camera.distanceTo(center)).toBeLessThan(.000001);
      });
    });
  }
  it('rejects malformed paths', () => {
    expect(() => createTravelCamera([])).toThrow(RangeError);
    expect(() => createTravelCamera([{ progress: 0, camera: [0, 0, 0], target: [0, 0, 0] }])).toThrow(RangeError);
    expect(() => createTravelCamera([{ progress: 0, camera: [NaN, 0, 0], target: [0, 0, 0] },
      { progress: 1, camera: [0, 0, 0], target: [0, 0, 0] }])).toThrow(RangeError);
    expect(() => createTravelCamera([GALACTIC_CAMERA[0], GALACTIC_CAMERA[0], GALACTIC_CAMERA[3]])).toThrow(RangeError);
  });
});

describe('Chajnantor illustrative arrival', () => {
  it('projects verified Chile coordinates onto the actual equirectangular sphere', () => {
    expect(geographicalNormal(0, 0).toArray()).toEqual([1, 0, -0]);
    expect(geographicalNormal(0, 90).z).toBe(-1);
    const chile = geographicalNormal(CHAJNANTOR.latitudeDegrees, CHAJNANTOR.longitudeDegrees);
    expect(chile.length()).toBeCloseTo(1, 14);
    expect(chile.y).toBeLessThan(0); expect(chile.z).toBeGreaterThan(0);
    const orientation = new THREE.Quaternion().setFromUnitVectors(chile, new THREE.Vector3(0, 0, 1));
    expect(chile.clone().applyQuaternion(orientation).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-14);
    expect(() => geographicalNormal(91, 0)).toThrow(RangeError);
    expect(() => geographicalNormal(0, NaN)).toThrow(RangeError);
    expect(CHAJNANTOR.bandNote).toContain('no observacion del fixture LF');
  });
  it('uses finite neutral plateau geometry with ridges rather than a decorative plane', () => {
    const terrain = createChajnantorTerrain(), position = terrain.geometry.getAttribute('position');
    expect(position.count).toBe(97 * 101);
    expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
    expect(chajnantorHeight(2.8, -12.5)).toBeGreaterThan(chajnantorHeight(0, 0) + 3);
    expect(terrain.geometry.getAttribute('color').count).toBe(position.count);
    expect(terrain.material.userData.minimumFocusOpacity).toBeGreaterThanOrEqual(.6);
    expect(terrain.userData.provenance).toContain('not surveyed');
    terrain.geometry.dispose(); terrain.material.dispose();
  });
  it('reveals six inspectable antennas reversibly and marks its illustrative layout', () => {
    const observatory = createObservatory(), geometries = new Set<THREE.BufferGeometry>();
    expect(observatory.feeds).toHaveLength(6); expect(OBSERVATORY_LAYOUT).toHaveLength(6);
    expect(observatory.root.userData.layout).toContain('not the surveyed 66-antenna');
    const instances: number[] = []; observatory.dishes.traverse(object => {
      if (object instanceof THREE.InstancedMesh) instances.push(object.count);
      if ((object as THREE.Mesh).geometry) geometries.add((object as THREE.Mesh).geometry);
    });
    expect(instances).toEqual([6, 6, 6]);
    observatory.setReveal(0); expect(observatory.root.visible).toBe(false);
    observatory.setReveal(1); expect(observatory.root.visible).toBe(true);
    observatory.materials.forEach(material => expect(material.userData.minimumFocusOpacity).toBeGreaterThanOrEqual(.6));
    observatory.setReveal(.25); expect(observatory.terrain.material.opacity).toBe(.25);
    observatory.setReveal(0); expect(observatory.root.visible).toBe(false);
    geometries.add(observatory.terrain.geometry); geometries.forEach(geometry => geometry.dispose());
    observatory.materials.forEach(material => material.dispose());
  });
});
