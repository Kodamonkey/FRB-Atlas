import type { Group, Vector3 } from 'three';
import type { EventEvidence, EvidenceArrays } from '../evidence/types';

export type RenderQuality = 'standard' | 'high';
export type InspectionView = 'perspective' | 'front' | 'side' | 'top';
export interface StoryProgress { sequence: number; local: number; global: number }
export interface CameraPose { camera: Vector3; target: Vector3 }
export interface Stage {
  id: string;
  continuous?: boolean;
  mobileScale?: number;
  root: Group;
  camera: Vector3;
  target: Vector3;
  // Local scene coordinates. Callers copy the pose because implementations may reuse its vectors.
  cameraAt?: (progress: number) => CameraPose;
  update: (progress: number, ambientSeconds: number) => void;
  setFocus?: (term: string | null) => void;
  setEvidence?: (evidence: EventEvidence, arrays: EvidenceArrays) => void;
  dispose?: () => void;
}
export interface World {
  setProgress: (progress: number) => void;
  setEvidence: (evidence: EventEvidence, arrays: EvidenceArrays) => void;
  setPaused: (paused: boolean) => void;
  setQuality: (quality: RenderQuality) => void;
  setFocus: (stageId: string, term: string | null) => void;
  setInspection: (enabled: boolean) => void;
  resetInspection: () => void;
  setInspectionView: (view: InspectionView) => void;
  setInspectionRelief: (amount: number) => void;
  dispose: () => void;
}
