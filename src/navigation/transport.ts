export const PROGRESS_EPSILON = 0.000001;
export const FINE_STEP = 0.0125;
export const DEFAULT_SPEED = 0.12;
export const HOLD_DELAY_MS = 250;
export const MAX_FRAME_STEP = 0.025;

export function clampProgress(progress: number, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('El recorrido necesita al menos una fase.');
  if (!Number.isFinite(progress)) throw new RangeError('El progreso debe ser finito.');
  return Math.max(0, Math.min(count - PROGRESS_EPSILON, progress));
}

export function targetScroll(progress: number, starts: readonly number[], maxScroll: number): number {
  if (!Number.isFinite(maxScroll) || maxScroll < 0) throw new RangeError('El límite de scroll debe ser finito y positivo.');
  if (!starts.length) return 0;
  if (starts.some((start, index) => !Number.isFinite(start) || start < 0 || (index > 0 && start < starts[index - 1]))) {
    throw new RangeError('Las posiciones de las fases deben estar ordenadas.');
  }
  const value = clampProgress(progress, starts.length);
  const index = Math.floor(value);
  const start = Math.min(maxScroll, starts[index]);
  const end = Math.min(maxScroll, starts[index + 1] ?? maxScroll);
  return start + (end - start) * (value - index);
}

export interface HorizontalWheel {
  deltaX: number;
  deltaMode: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function wheelStageDelta(event: HorizontalWheel, pagePixels = 800): number {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  if (!Number.isFinite(event.deltaX) || !Number.isFinite(pagePixels) || pagePixels <= 0) return 0;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pagePixels : 1;
  return Math.max(-0.05, Math.min(0.05, event.deltaX * unit / 1200));
}

export function keyboardProgress(progress: number, count: number, key: string): number | undefined {
  const value = clampProgress(progress, count);
  if (key === 'Home') return 0;
  if (key === 'End') return count - PROGRESS_EPSILON;
  const delta = key === 'ArrowRight' || key === 'ArrowUp' ? FINE_STEP
    : key === 'ArrowLeft' || key === 'ArrowDown' ? -FINE_STEP
      : key === 'PageDown' ? 0.1 : key === 'PageUp' ? -0.1 : undefined;
  return delta === undefined ? undefined : clampProgress(value + delta, count);
}

export interface FrameClock {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
}

export interface SmoothWheelTransport {
  add: (delta: number) => void;
  stop: () => void;
  readonly active: boolean;
}

export function createSmoothWheelTransport(read: () => number, write: (value: number) => void,
  count: number, clock: FrameClock): SmoothWheelTransport {
  let frame: number | null = null;
  let target = 0;
  let current = 0;
  let last = 0;
  let direction = 0;
  let generation = 0;
  const stop = () => {
    generation++;
    if (frame !== null) clock.cancel(frame);
    frame = null;
    direction = 0;
  };
  const tick = (time: number, token: number) => {
    if (token !== generation) return;
    frame = null;
    const elapsed = Math.max(0, Math.min(100, time - last));
    last = time;
    // A short exponential response smooths wheel impulses without overshoot or long coasting.
    current += (target - current) * -Math.expm1(-elapsed / 65);
    if (Math.abs(target - current) < 0.00001) current = target;
    write(current);
    if (token !== generation) return;
    if (current !== target) frame = clock.request(next => tick(next, token));
    else direction = 0;
  };
  return {
    get active() { return frame !== null; },
    stop,
    add(delta) {
      if (!Number.isFinite(delta) || delta === 0) return;
      const nextDirection = Math.sign(delta);
      if (frame === null) {
        current = clampProgress(read(), count);
        target = current;
        last = clock.now();
      } else if (direction && nextDirection !== direction) {
        // Reversing input cancels the unfinished previous impulse immediately.
        current = clampProgress(read(), count);
        target = current;
      }
      direction = nextDirection;
      target = clampProgress(target + delta, count);
      if (frame === null) {
        const token = generation;
        frame = clock.request(time => tick(time, token));
      }
    },
  };
}

export interface HeldTransport {
  start: (direction: -1 | 1, speed?: number) => void;
  stop: () => void;
  readonly active: boolean;
}

export function createHeldTransport(onNudge: (delta: number) => void, clock: FrameClock): HeldTransport {
  let frame: number | null = null;
  let generation = 0;
  let active = false;
  const stop = () => {
    active = false;
    generation++;
    if (frame !== null) clock.cancel(frame);
    frame = null;
  };
  return {
    get active() { return active; },
    stop,
    start(direction, speed = DEFAULT_SPEED) {
      stop();
      active = true;
      const token = generation;
      const holdStart = clock.now() + HOLD_DELAY_MS;
      let last = holdStart;
      const rate = Number.isFinite(speed) ? Math.max(0.1, Math.min(1, speed)) : DEFAULT_SPEED;
      onNudge(direction * FINE_STEP);
      if (!active || token !== generation) return;
      const tick = (time: number) => {
        if (!active || token !== generation) return;
        frame = null;
        if (time >= holdStart) {
          const elapsed = Math.max(0, Math.min(100, time - last)) / 1000;
          last = time;
          if (elapsed > 0) onNudge(direction * Math.min(MAX_FRAME_STEP, elapsed * rate));
        }
        if (active && token === generation) frame = clock.request(tick);
      };
      frame = clock.request(tick);
    },
  };
}
