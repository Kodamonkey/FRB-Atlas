import { Mesh, ShaderMaterial, Vector3, type Object3D } from 'three';
import type { CameraPose, InspectionView } from './types';

export const PLOT_INSPECTION_STAGE_IDS = ['matriz', 'bloques', 'alineacion', 'perfil', 'bowtie', 'rgb',
  'backbone', 'upsampling', 'cabezas', 'centernet', 'recorte', 'resnet', 'decision',
  'boxcar', 'boxcar-bank', 'boxcar-threshold', 'vit-patches', 'vit-detection', 'vit-proposals',
  'hf-matriz', 'hf-profile', 'hf-boxcar'] as const;
export const PLOT_RELIEF_STAGE_IDS = ['matriz', 'alineacion', 'perfil', 'bowtie', 'backbone', 'upsampling',
  'cabezas', 'centernet', 'recorte', 'resnet', 'hf-matriz', 'hf-profile', 'hf-boxcar'] as const;
export const PLOT_RELIEF_LABEL = 'Relieve normalizado (u.a.)';

export function isInspectionStage(id: string): boolean {
  return (PLOT_INSPECTION_STAGE_IDS as readonly string[]).includes(id);
}
export function hasInspectionRelief(id: string): boolean {
  return (PLOT_RELIEF_STAGE_IDS as readonly string[]).includes(id);
}
export function clampInspectionRelief(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, Math.min(3, amount)) : 0;
}

export function inspectionViewPose(view: InspectionView, target: Vector3, distance: number): CameraPose & { up: Vector3 } {
  const radius = Number.isFinite(distance) ? Math.max(1.5, Math.min(80, distance)) : 9;
  // Slight obliquity keeps a zero-relief surface visible in lateral and upper projections.
  const direction = (view === 'front' ? new Vector3(0, 0, 1) : view === 'side' ? new Vector3(1, 0, .35)
    : view === 'top' ? new Vector3(0, 1, .35) : new Vector3(.35, .24, 1)).normalize();
  return { camera: direction.multiplyScalar(radius).add(target), target: target.clone(),
    up: view === 'top' ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0) };
}

// The slider changes a GPU visual uniform, never source intensities or scientific arrays.
export function createPlotReliefController() {
  const originals = new Map<ShaderMaterial, number>();
  return {
    apply(root: Object3D, amount: number) {
      const value = clampInspectionRelief(amount);
      root.traverse(object => {
        const material = (object as Mesh).material;
        for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
          if (!(entry instanceof ShaderMaterial) || !entry.uniforms.uLift) continue;
          if (!originals.has(entry)) originals.set(entry, entry.uniforms.uLift.value);
          entry.uniforms.uLift.value = value;
        }
      });
      return originals.size;
    },
    restore() {
      for (const [material, value] of originals) material.uniforms.uLift.value = value;
      originals.clear();
    },
    get size() { return originals.size; },
  };
}
