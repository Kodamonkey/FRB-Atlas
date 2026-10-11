import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ALMA_OPTICS, ARECIBO, CHAJNANTOR, areciboReflectorHeight,
  createAlmaObservatory, createAreciboObservatory, createObservatory, geographicalNormal,
  type Observatory,
} from '../src/cinema/observatory';

function resources(observatory: Observatory) {
  const geometries = new Set<THREE.BufferGeometry>(), instances: THREE.InstancedMesh[] = [];
  observatory.root.updateMatrixWorld(true);
  observatory.root.traverse(object => {
    expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    if (object instanceof THREE.InstancedMesh) {
      instances.push(object);
      expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    }
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      for (const name of Object.keys(object.geometry.attributes)) {
        const attribute = object.geometry.getAttribute(name);
        const array = attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.array : attribute.array;
        expect(Array.from(array).every(Number.isFinite)).toBe(true);
      }
    }
  });
  observatory.feeds.forEach(feed => expect(feed.toArray().every(Number.isFinite)).toBe(true));
  return { geometries: [...geometries], instances };
}

describe('case-specific observatory geometry', () => {
  it('keeps the ALMA alias and exactly three six-antenna batches', () => {
    expect(createObservatory).toBe(createAlmaObservatory);
    const observatory = createObservatory(), { instances } = resources(observatory);
    expect(instances.map(instance => instance.count)).toEqual([6, 6, 6]);
    expect(observatory.feeds).toHaveLength(6);
    expect(observatory.root.userData.site).toBe(CHAJNANTOR);
    expect(observatory.root.userData.optics).toBe(ALMA_OPTICS);
    expect(ALMA_OPTICS.focalLengthMeters / ALMA_OPTICS.primaryDiameterMeters).toBeCloseTo(.4, 14);
    expect(ALMA_OPTICS.supportLegs).toBe(4);
    expect(observatory.dishes.getObjectByName('alma:altazimuth-yokes-pedestals')).toBeInstanceOf(THREE.InstancedMesh);
    const support = observatory.dishes.getObjectByName('alma:backing-truss-quadripod') as THREE.LineSegments;
    expect(support.geometry.getAttribute('position').count).toBeGreaterThan(6 * 4 * 2);
    expect(observatory.terrain.userData.provenance).toContain('not surveyed');
    observatory.dispose();
  });

  it('models one historical spherical Arecibo aperture, not an ALMA mount array', () => {
    const observatory = createAreciboObservatory(); resources(observatory);
    const primary = observatory.dishes.getObjectByName('arecibo:fixed-spherical-reflector') as THREE.Mesh;
    primary.geometry.computeBoundingBox();
    expect(primary.geometry.boundingBox!.max.x - primary.geometry.boundingBox!.min.x).toBeCloseTo(10, 5);
    expect(observatory.root.userData.metersPerUnit * 10).toBe(ARECIBO.primaryDiameterMeters);
    expect(observatory.feeds).toHaveLength(1);
    expect(observatory.dishes.getObjectByName('alma:altazimuth-yokes-pedestals')).toBeUndefined();
    const towers = observatory.dishes.getObjectByName('arecibo:suspension-towers') as THREE.InstancedMesh;
    expect(towers.count).toBe(3);
    const cables = observatory.dishes.getObjectByName('arecibo:main-suspension-cables') as THREE.LineSegments;
    expect(cables.userData.cableCount).toBe(18);
    expect(cables.geometry.getAttribute('position').count).toBe(18 * 24 * 2);
    expect(observatory.dishes.getObjectByName('arecibo:suspended-platform')).toBeInstanceOf(THREE.Mesh);
    const dome = observatory.dishes.getObjectByName('arecibo:gregorian-receiver-dome')!;
    expect(dome.userData.feedArray).toContain('not seven independent antennas');
    expect(observatory.root.userData.layout).toContain('Historical pre-2020');
    expect(observatory.root.userData.provenance).toContain('Not observed FRB 121102 data');
    expect(ARECIBO.discoverySource).toBe('https://arxiv.org/abs/1404.2934');
    const puertoRico = geographicalNormal(ARECIBO.latitudeDegrees, ARECIBO.longitudeDegrees);
    expect(puertoRico.y).toBeGreaterThan(0); expect(puertoRico.z).toBeGreaterThan(0);
    observatory.dispose();
  });

  it('uses the measured spherical curvature rather than a parabolic approximation', () => {
    const curvature = ARECIBO.curvatureRadiusMeters / (ARECIBO.primaryDiameterMeters / 10);
    const centerY = curvature + areciboReflectorHeight(0);
    expect(areciboReflectorHeight(5)).toBeCloseTo(0, 14);
    expect(areciboReflectorHeight(0)).toBeLessThan(-1.5);
    for (const radius of [0, .5, 1, 2, 3, 4, 5]) {
      expect(radius ** 2 + (areciboReflectorHeight(radius) - centerY) ** 2).toBeCloseTo(curvature ** 2, 12);
    }
    expect(() => areciboReflectorHeight(5.01)).toThrow(RangeError);
    expect(() => areciboReflectorHeight(-1)).toThrow(RangeError);
    expect(() => areciboReflectorHeight(NaN)).toThrow(RangeError);
  });

  it('keeps feed coordinates local when applying caller-requested Arecibo scale', () => {
    const original = createAreciboObservatory(), scaled = createAreciboObservatory(.3);
    expect(scaled.root.scale.toArray()).toEqual([.3, .3, .3]);
    expect(scaled.feeds[0]).toEqual(original.feeds[0]);
    scaled.root.updateMatrixWorld(true);
    expect(scaled.feeds[0].clone().applyMatrix4(scaled.root.matrixWorld)).toEqual(original.feeds[0].clone().multiplyScalar(.3));
    for (const badScale of [0, -1, NaN, Infinity]) expect(() => createAreciboObservatory(badScale)).toThrow(RangeError);
    original.dispose(); scaled.dispose();
  });
});

describe.each([['ALMA', createAlmaObservatory], ['Arecibo', createAreciboObservatory]] as const)('%s resources', (_name, factory) => {
  it('reveals reversibly without rebuilding buffers and handles nonfinite progress', () => {
    const observatory = factory(), { geometries } = resources(observatory);
    const positions = geometries.map(geometry => geometry.getAttribute('position'));
    const originalOpacity = observatory.materials.map(material => material.opacity);
    observatory.setReveal(0); expect(observatory.root.visible).toBe(false);
    observatory.setReveal(.25); expect(observatory.root.visible).toBe(true);
    observatory.materials.forEach((material, i) => {
      expect(material.opacity).toBeCloseTo(originalOpacity[i] * .25, 14);
      expect(material.userData.minimumFocusOpacity).toBeGreaterThanOrEqual(.6);
    });
    observatory.setReveal(1);
    observatory.materials.forEach((material, i) => expect(material.opacity).toBe(originalOpacity[i]));
    expect(geometries.map(geometry => geometry.getAttribute('position'))).toEqual(positions);
    observatory.setReveal(NaN); expect(observatory.root.visible).toBe(false);
    observatory.dispose();
  });

  it('owns independent resources and disposes geometry, instances and materials exactly once', () => {
    const observatory = factory(), other = factory(), { geometries, instances } = resources(observatory);
    const otherGeometry = new Set(resources(other).geometries);
    geometries.forEach(geometry => expect(otherGeometry.has(geometry)).toBe(false));
    observatory.materials.forEach(material => expect(other.materials.includes(material)).toBe(false));
    const counts = new Map<object, number>();
    const watch = (resource: object) => {
      counts.set(resource, 0);
      return () => { counts.set(resource, counts.get(resource)! + 1); };
    };
    geometries.forEach(geometry => geometry.addEventListener('dispose', watch(geometry)));
    instances.forEach(instance => instance.addEventListener('dispose', watch(instance)));
    observatory.materials.forEach(material => material.addEventListener('dispose', watch(material)));
    observatory.dispose(); observatory.dispose(); observatory.setReveal(1);
    expect(observatory.root.visible).toBe(false);
    expect([...counts.values()].every(count => count === 1)).toBe(true);
    expect(other.root.visible).toBe(true);
    other.dispose();
  });
});
