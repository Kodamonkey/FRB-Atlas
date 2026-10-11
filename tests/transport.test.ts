import { describe, expect, it } from 'vitest';
import { clampProgress, createHeldTransport, createSmoothWheelTransport, FINE_STEP, HOLD_DELAY_MS, keyboardProgress, MAX_FRAME_STEP, PROGRESS_EPSILON, targetScroll, wheelStageDelta, type FrameClock } from '../src/navigation/transport';

function frameClock() {
  let time = 0;
  let id = 0;
  const pending = new Map<number, (time: number) => void>();
  const cancelled: number[] = [];
  const clock: FrameClock = {
    now: () => time,
    request: callback => { const key = ++id; pending.set(key, callback); return key; },
    cancel: key => { cancelled.push(key); pending.delete(key); },
  };
  return { clock, pending, cancelled, tick(next: number) {
    time = next;
    const frames = [...pending.values()];
    pending.clear();
    frames.forEach(callback => callback(time));
  } };
}

describe('precision transport coordinates', () => {
  it('clamps inside the final phase without introducing a phantom phase', () => {
    expect(clampProgress(-1, 28)).toBe(0);
    expect(clampProgress(3.00125, 28)).toBe(3.00125);
    expect(clampProgress(28, 28)).toBe(28 - PROGRESS_EPSILON);
    expect(Math.floor(clampProgress(999, 28))).toBe(27);
    expect(() => clampProgress(NaN, 28)).toThrow(RangeError);
    expect(() => clampProgress(1, 0)).toThrow(RangeError);
  });

  it('maps fractional phase progress through unequal native scroll sections', () => {
    const starts = [0, 500, 1700];
    expect(targetScroll(0, starts, 3000)).toBe(0);
    expect(targetScroll(0.5, starts, 3000)).toBe(250);
    expect(targetScroll(1.5, starts, 3000)).toBe(1100);
    expect(targetScroll(2.5, starts, 3000)).toBe(2350);
    expect(targetScroll(3, starts, 3000)).toBeCloseTo(2999.9987, 8);
    expect(targetScroll(10, [0, 1000], 600)).toBe(600);
    expect(targetScroll(1, [], 0)).toBe(0);
    expect(() => targetScroll(1, [0, 100, 90], 1000)).toThrow(RangeError);
  });

  it('keeps precise keyboard steps reversible and handles endpoint keys', () => {
    expect(keyboardProgress(4.6, 28, 'ArrowRight')).toBeCloseTo(4.6125, 12);
    expect(keyboardProgress(4.6125, 28, 'ArrowLeft')).toBeCloseTo(4.6, 12);
    expect(keyboardProgress(4.6, 28, 'PageDown')).toBeCloseTo(4.7, 12);
    expect(keyboardProgress(4.6, 28, 'PageUp')).toBeCloseTo(4.5, 12);
    expect(keyboardProgress(4.6, 28, 'Home')).toBe(0);
    expect(keyboardProgress(4.6, 28, 'End')).toBe(28 - PROGRESS_EPSILON);
    expect(keyboardProgress(0, 28, 'ArrowLeft')).toBe(0);
    expect(keyboardProgress(4.6, 28, 'Enter')).toBeUndefined();
  });

  it('normalizes horizontal wheel pixels, lines and pages without losing direction', () => {
    expect(wheelStageDelta({ deltaX: 1, deltaMode: 0 })).toBeCloseTo(1 / 1200, 12);
    expect(wheelStageDelta({ deltaX: -3, deltaMode: 1 })).toBeCloseTo(-48 / 1200, 12);
    expect(wheelStageDelta({ deltaX: 0.03, deltaMode: 2 }, 1000)).toBeCloseTo(30 / 1200, 12);
    expect(wheelStageDelta({ deltaX: 10000, deltaMode: 0 })).toBe(0.05);
    expect(wheelStageDelta({ deltaX: -10000, deltaMode: 0 })).toBe(-0.05);
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      expect(wheelStageDelta({ deltaX: 10, deltaMode: 0, [modifier]: true })).toBe(0);
    }
    expect(wheelStageDelta({ deltaX: NaN, deltaMode: 0 })).toBe(0);
  });
});

describe('held-arrow lifecycle', () => {
  it('nudges once, waits 250 ms, then advances in small time-based increments', () => {
    const frames = frameClock();
    const steps: number[] = [];
    const transport = createHeldTransport(delta => steps.push(delta), frames.clock);
    transport.start(1);
    expect(steps).toEqual([FINE_STEP]);
    frames.tick(HOLD_DELAY_MS - 1);
    expect(steps).toHaveLength(1);
    frames.tick(HOLD_DELAY_MS + 100);
    expect(steps[1]).toBeCloseTo(0.012, 12);
    frames.tick(HOLD_DELAY_MS + 200);
    expect(steps[2]).toBeCloseTo(0.012, 12);
    transport.stop();
    expect(transport.active).toBe(false);
    expect(frames.pending.size).toBe(0);
  });

  it('caps jumps after a delayed frame and ignores cancelled callbacks', () => {
    const frames = frameClock();
    const steps: number[] = [];
    const transport = createHeldTransport(delta => steps.push(delta), frames.clock);
    transport.start(-1, 1);
    frames.tick(10000);
    expect(steps).toEqual([-FINE_STEP, -MAX_FRAME_STEP]);
    const stale = [...frames.pending.values()][0];
    transport.stop();
    stale(20000);
    expect(steps).toHaveLength(2);
    expect(frames.pending.size).toBe(0);
    expect(frames.cancelled).toHaveLength(1);
  });

  it('cancels an old direction before starting another', () => {
    const frames = frameClock();
    const steps: number[] = [];
    const transport = createHeldTransport(delta => steps.push(delta), frames.clock);
    transport.start(1);
    const stale = [...frames.pending.values()][0];
    transport.start(-1);
    stale(350);
    expect(steps).toEqual([FINE_STEP, -FINE_STEP]);
    expect(frames.pending.size).toBe(1);
    frames.tick(350);
    expect(steps[2]).toBeCloseTo(-0.012, 12);
    transport.stop();
  });

  it('does not reschedule when the callback stops during a frame or initial press', () => {
    const frames = frameClock();
    let calls = 0;
    const transport = createHeldTransport(() => { if (++calls === 2) transport.stop(); }, frames.clock);
    transport.start(1);
    frames.tick(350);
    expect(calls).toBe(2);
    expect(frames.pending.size).toBe(0);
    const immediate = createHeldTransport(() => immediate.stop(), frames.clock);
    immediate.start(1);
    expect(immediate.active).toBe(false);
    expect(frames.pending.size).toBe(0);
  });
});

describe('smooth horizontal wheel', () => {
  it('accumulates input and approaches the exact target monotonically without overshoot', () => {
    const frames = frameClock();
    let progress = 4;
    const values: number[] = [];
    const wheel = createSmoothWheelTransport(() => progress, value => { progress = value; values.push(value); }, 25, frames.clock);
    wheel.add(.02); wheel.add(.03);
    expect(progress).toBe(4);
    frames.tick(16);
    expect(progress).toBeGreaterThan(4);
    expect(progress).toBeLessThan(4.02);
    for (let time = 32; time <= 800; time += 16) frames.tick(time);
    expect(progress).toBeCloseTo(4.05, 12);
    expect(values.every((value, index) => value <= 4.05 && (!index || value >= values[index - 1]))).toBe(true);
    expect(wheel.active).toBe(false);
    expect(frames.pending.size).toBe(0);
  });

  it('reverses immediately and drops unfinished momentum', () => {
    const frames = frameClock();
    let progress = 5;
    const wheel = createSmoothWheelTransport(() => progress, value => { progress = value; }, 25, frames.clock);
    wheel.add(.05); frames.tick(16);
    const turn = progress;
    wheel.add(-.0125); frames.tick(32);
    expect(progress).toBeLessThan(turn);
    for (let time = 48; time <= 800; time += 16) frames.tick(time);
    expect(progress).toBeCloseTo(turn - .0125, 12);
  });

  it('clamps endpoints and ignores cancelled callbacks', () => {
    const frames = frameClock();
    let progress = 0;
    const wheel = createSmoothWheelTransport(() => progress, value => { progress = value; }, 25, frames.clock);
    wheel.add(-.05); frames.tick(16);
    expect(progress).toBe(0);
    progress = 24.999;
    wheel.add(.05);
    const stale = [...frames.pending.values()][0];
    wheel.stop(); stale(32);
    expect(progress).toBe(24.999);
    expect(frames.pending.size).toBe(0);
    wheel.add(.05);
    for (let time = 48; time <= 1000; time += 16) frames.tick(time);
    expect(progress).toBe(25 - PROGRESS_EPSILON);
  });

  it('supports cancellation by the writer and rejects invalid impulses', () => {
    const frames = frameClock();
    let progress = 3;
    const wheel = createSmoothWheelTransport(() => progress, value => { progress = value; wheel.stop(); }, 25, frames.clock);
    wheel.add(NaN); wheel.add(0);
    expect(frames.pending.size).toBe(0);
    wheel.add(.05); frames.tick(16);
    expect(progress).toBeGreaterThan(3);
    expect(frames.pending.size).toBe(0);
    expect(wheel.active).toBe(false);
  });
});
