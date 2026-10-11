import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStageOrder, eventRouteX, EVENT_PORT, STAGE_PITCH } from '../src/cinema/World';
import { createPhysicalStages, normalizedPhasorPower, PHYSICAL_STAGE_IDS } from '../src/cinema/physicalStages';
import { STORY, stageTiming } from '../src/story';

describe('continuous event route', () => {
  it('advances only to the right and preserves the carrier at stage boundaries', () => {
    let previous = -Infinity;
    for (let index = 0; index < STORY.length; index++) {
      for (let sample = 0; sample <= 100; sample++) {
        const { operation, handoff } = stageTiming(sample / 100);
        const x = eventRouteX(index, operation, handoff, STORY.length);
        expect(x).toBeGreaterThanOrEqual(previous - 1e-10);
        previous = x;
      }
      if (index < STORY.length - 1) {
        expect(eventRouteX(index, 1, 1, STORY.length)).toBe(eventRouteX(index + 1, 0, 0, STORY.length));
      }
    }
  });

  it('holds the output before the camera handoff', () => {
    for (const local of [.56, .60, .67, .72]) {
      const { operation, handoff } = stageTiming(local);
      expect(operation).toBe(1);
      expect(handoff).toBe(0);
      expect(eventRouteX(5, operation, handoff, STORY.length)).toBe(5 * STAGE_PITCH + EVENT_PORT);
    }
  });

  it('refuses an incomplete or reordered scene route', () => {
    expect(() => assertStageOrder(STORY)).not.toThrow();
    expect(() => assertStageOrder(STORY.slice(1))).toThrow(/orden/);
    expect(() => assertStageOrder([...STORY].reverse())).toThrow(/orden/);
    expect(STORY.slice(0, PHYSICAL_STAGE_IDS.length).map(step => step.id)).toEqual(PHYSICAL_STAGE_IDS);
  });
});

describe('illustrative coherent fields', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('holds six distinct dispersed arrivals inside the frame, with lower frequencies behind', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
    const stages = createPhysicalStages();
    const plasma = stages[3];
    const waves = plasma.root.children.slice(0, 6);
    let previous = waves.map(() => -Infinity);
    for (const operation of [0, .25, .5, .75, 1]) {
      plasma.update(operation, 0);
      const positions = waves.map(wave => wave.position.x);
      positions.forEach((x, index) => {
        expect(x).toBeGreaterThanOrEqual(previous[index]);
        expect(x).toBeGreaterThanOrEqual(-2.6);
        expect(x).toBeLessThanOrEqual(1.6 + 1e-12);
      });
      previous = positions;
    }
    previous.slice(1).forEach((x, index) => expect(x).toBeGreaterThan(previous[index]));
    expect(previous[5]).toBeCloseTo(1.6, 12);
    expect(previous[5] - previous[0]).toBeGreaterThan(.5);
    plasma.update(1, 8);
    expect(waves.map(wave => wave.position.x)).toEqual(previous);
    stages.forEach(stage => stage.dispose?.());
  });

  it('includes the imaginary component of the normalized coherent sum', () => {
    const phase = Math.PI / 2;
    expect(normalizedPhasorPower([0, 0, 0, 0, 0, phase])).toBeCloseTo((26 + 10 * Math.cos(phase)) / 36, 12);
    expect(normalizedPhasorPower([0, 0, 0, 0, 0, 0])).toBe(1);
    expect(normalizedPhasorPower([0, Math.PI])).toBeCloseTo(0, 12);
    expect(normalizedPhasorPower([])).toBe(0);
  });
});
