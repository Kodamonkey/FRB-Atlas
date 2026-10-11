import { describe, expect, it } from 'vitest';
import { ACTS, ACT_STARTS, STORY, scrollSegments, splitProgress, stageTiming } from '../src/story';

describe('cinematic narrative', () => {
  it('has six acts and twenty-four unique phases with short principal captions', () => {
    expect(ACTS).toHaveLength(6); expect(STORY).toHaveLength(24);
    expect(new Set(STORY.map(step => step.id)).size).toBe(STORY.length);
    expect(ACT_STARTS).toEqual([0, 2, 4, 10, 12, 15]);
    for (const step of STORY) {
      expect(step.caption.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(step.title.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(step.detail.length).toBeGreaterThan(25);
    }
  });
  it('clamps boundaries without wrapping the last sequence', () => {
    expect(splitProgress(-1)).toEqual({ global: 0, sequence: 0, local: 0 });
    expect(splitProgress(4.3).sequence).toBe(4);
    expect(splitProgress(STORY.length).sequence).toBe(STORY.length - 1);
    expect(splitProgress(STORY.length).local).toBeGreaterThan(.99);
    expect(splitProgress(NaN).global).toBe(0);
    expect(splitProgress(8).local).toBe(0);
  });
  it('completes the operation and holds its output before moving to the next phase', () => {
    expect(stageTiming(.08)).toEqual({ operation: 0, handoff: 0 });
    expect(stageTiming(.56).operation).toBeCloseTo(1);
    expect(stageTiming(.65)).toEqual({ operation: 1, handoff: 0 });
    expect(stageTiming(.72)).toEqual({ operation: 1, handoff: 0 });
    expect(stageTiming(.86)).toEqual({ operation: 1, handoff: .5 });
    expect(stageTiming(1)).toEqual({ operation: 1, handoff: 1 });
  });
  it('preserves unequal hero and final scroll durations', () => {
    expect(scrollSegments([0, 920, 2170], 2700)).toEqual([920, 1250, 530]);
    expect(scrollSegments([0, 920], 800)).toEqual([920, 1]);
  });
});
