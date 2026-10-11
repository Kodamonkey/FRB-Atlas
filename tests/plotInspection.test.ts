import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { clampInspectionRelief, createPlotReliefController, hasInspectionRelief, inspectionViewPose,
  isInspectionStage, PLOT_INSPECTION_STAGE_IDS } from '../src/cinema/plotInspection';
import { createHFStages } from '../src/hf/stages';
import { getHFFixture } from '../src/hf/model';

describe('Plot inspection preserves scientific evidence', () => {
  it('allows only graphical data stages, never celestial objects or confirmation cards', () => {
    expect(new Set(PLOT_INSPECTION_STAGE_IDS).size).toBe(PLOT_INSPECTION_STAGE_IDS.length);
    for (const id of ['matriz', 'perfil', 'bowtie', 'recorte', 'resnet', 'hf-matriz', 'hf-profile', 'hf-boxcar']) {
      expect(isInspectionStage(id)).toBe(true); expect(hasInspectionRelief(id)).toBe(true);
    }
    for (const id of ['faro', 'antenas', 'candidato', 'hf-candidato', 'absent']) expect(isInspectionStage(id)).toBe(false);
    expect(hasInspectionRelief('decision')).toBe(false);
  });
  it('centers each axis view on the same event and never mutates its target', () => {
    const target = new Vector3(24, 1, -2), before = target.clone();
    const front = inspectionViewPose('front', target, 9);
    const side = inspectionViewPose('side', target, 9);
    const top = inspectionViewPose('top', target, 9);
    expect(front.camera.toArray()).toEqual([24, 1, 7]); expect(side.camera.x-target.x).toBeGreaterThan(9 * .9);
    expect(side.camera.y).toBe(target.y); expect(side.camera.z).toBeGreaterThan(target.z);
    expect(top.camera.y-target.y).toBeGreaterThan(9 * .9); expect(top.camera.x).toBe(target.x);
    expect((side.camera.z-target.z)/(side.camera.x-target.x)).toBeCloseTo(.35, 12);
    expect((top.camera.z-target.z)/(top.camera.y-target.y)).toBeCloseTo(.35, 12);
    expect(top.up.toArray()).toEqual([0, 0, -1]);
    for (const view of ['perspective', 'front', 'side', 'top'] as const) {
      const pose = inspectionViewPose(view, target, 9);
      expect(pose.camera.distanceTo(target)).toBeCloseTo(9, 12); expect(pose.target).toEqual(target);
      expect(pose.target).not.toBe(target); expect(pose.up.clone().cross(pose.camera.clone().sub(target)).length()).toBeGreaterThan(0);
    }
    expect(target).toEqual(before);
    for (const distance of [NaN, Infinity, -1, 0, 1000]) {
      const pose = inspectionViewPose('top', target, distance);
      expect(pose.camera.toArray().every(Number.isFinite)).toBe(true);
      expect(pose.camera.distanceTo(target)).toBeGreaterThanOrEqual(1.5);
      expect(pose.camera.distanceTo(target)).toBeLessThanOrEqual(80);
    }
  });
  it('bounds graphical relief and restores exact native uniform values on exit', () => {
    expect([NaN, Infinity, -1, 0, 1.5, 9].map(clampInspectionRelief)).toEqual([0, 0, 0, 0, 1.5, 3]);
    const root = new Group(), values = new Float32Array([-2, 3, 9]);
    const material = new ShaderMaterial({ uniforms: { uLift: { value: .7 }, uData: { value: values } } });
    const geometry = new PlaneGeometry(2, 2), mesh = new Mesh(geometry, material);
    root.add(mesh, new Mesh(geometry, [material, material]));
    const controller = createPlotReliefController();
    expect(controller.apply(root, 2.2)).toBe(1); expect(controller.size).toBe(1);
    expect(material.uniforms.uLift.value).toBe(2.2); expect(material.uniforms.uData.value).toBe(values);
    expect(controller.apply(root, -1)).toBe(1); expect(material.uniforms.uLift.value).toBe(0);
    controller.restore(); expect(material.uniforms.uLift.value).toBe(.7); expect(controller.size).toBe(0);
    expect(Array.from(values)).toEqual([-2, 3, 9]); expect(mesh.geometry).toBe(geometry);
    geometry.dispose(); material.dispose();
  });
  it('gives HF matrices real vertex relief while preserving their cached intensity and SNR values', () => {
    const fixture = getHFFixture(), intensities = fixture.waterfall.slice(), bank = fixture.bank.slice();
    const stages = createHFStages(), controller = createPlotReliefController();
    for (const stage of stages.filter(stage => isInspectionStage(stage.id))) {
      stage.update(.85, 0); const geometries: unknown[] = [], materials: ShaderMaterial[] = [];
      stage.root.traverse(object => {
        const mesh = object as Mesh; if (mesh.geometry) geometries.push(mesh.geometry);
        if (mesh.material instanceof ShaderMaterial && mesh.material.uniforms.uLift) materials.push(mesh.material);
      });
      expect(materials.length).toBeGreaterThan(0); controller.apply(stage.root, 1.8);
      for (const material of materials) {
        expect(material.uniforms.uLift.value).toBe(1.8); expect(material.vertexShader).toContain('texture2D');
        expect(material.vertexShader).toContain('p.z+=(q-.25)*uLift');
        expect(material.fragmentShader).toContain('texture2D(uValues');
      }
      stage.update(.85, 0); controller.restore();
      const after: unknown[] = []; stage.root.traverse(object => { if ((object as Mesh).geometry) after.push((object as Mesh).geometry); });
      expect(after).toEqual(geometries); for (const material of materials) expect(material.uniforms.uLift.value).toBe(0);
      expect(stage.root.userData.dmResolved).toBe(false); expect(stage.root.userData.dmEstimated).toBeNull();
      const dispose = vi.spyOn(stage, 'dispose'); stage.dispose?.(); expect(dispose).toHaveBeenCalledOnce();
    }
    for (const stage of stages.filter(stage => !isInspectionStage(stage.id))) stage.dispose?.();
    expect(fixture.waterfall).toEqual(intensities); expect(fixture.bank).toEqual(bank);
  });
});
