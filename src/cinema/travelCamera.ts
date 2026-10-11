import { Vector3 } from 'three';
import type { CameraPose } from './types';

export interface TravelKeyframe {
  progress: number;
  camera: readonly [number, number, number];
  target: readonly [number, number, number];
}

export const GALACTIC_CAMERA: readonly TravelKeyframe[] = [
  { progress: 0, camera: [1.55, 4.3, 12], target: [.1, .1, .15] },
  { progress: .27, camera: [1.55, 2.2, 8.1], target: [-1.6, .1, .18] },
  { progress: .63, camera: [1.55, 1.05, 5], target: [-.1, .1, .22] },
  { progress: 1, camera: [1.55, .62, 3.2], target: [.95, .1, .24] },
];

export const EARTH_CAMERA: readonly TravelKeyframe[] = [
  { progress: 0, camera: [1.6, 2.1, 11.5], target: [.1, -.2, 0] },
  { progress: .3, camera: [1.6, .82, 7.2], target: [1.65, -.42, 1.1] },
  { progress: .57, camera: [1.6, .3, 4.6], target: [1.65, -.42, 1.2] },
  { progress: 1, camera: [1.6, .74, 4.3], target: [1.6, -.32, .05] },
];

export function createTravelCamera(keyframes: readonly TravelKeyframe[]): (progress: number) => CameraPose {
  if (keyframes.length < 2 || keyframes[0].progress !== 0 || keyframes[keyframes.length - 1].progress !== 1
    || keyframes.some((frame, index) => !Number.isFinite(frame.progress)
      || [...frame.camera, ...frame.target].some(value => !Number.isFinite(value))
      || (index > 0 && frame.progress <= keyframes[index - 1].progress))) throw new RangeError('Invalid travel keyframes.');
  const pose = { camera: new Vector3(), target: new Vector3() };
  return progress => {
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    let index = 0;
    while (index < keyframes.length - 2 && p > keyframes[index + 1].progress) index++;
    const a = keyframes[index], b = keyframes[index + 1];
    const t = (p - a.progress) / (b.progress - a.progress), blend = t * t * (3 - 2 * t);
    pose.camera.set(a.camera[0] + (b.camera[0] - a.camera[0]) * blend,
      a.camera[1] + (b.camera[1] - a.camera[1]) * blend, a.camera[2] + (b.camera[2] - a.camera[2]) * blend);
    pose.target.set(a.target[0] + (b.target[0] - a.target[0]) * blend,
      a.target[1] + (b.target[1] - a.target[1]) * blend, a.target[2] + (b.target[2] - a.target[2]) * blend);
    return pose;
  };
}
