import { describe, expect, it } from 'vitest';
import { readReloadPosition, saveReloadPosition } from '../src/navigation/reload';

const observation = 'arecibo-lf';
const story = ['faro', 'plasma', 'candidato'] as const;
const checkpoint = (progress = 1.64) => saveReloadPosition(null, observation, story, progress);

describe('Reload-only scientific route position', () => {
  it('round-trips continuous progress without publishing evidence or scores', () => {
    expect(checkpoint()).toEqual({ frbAtlasScroll: {
      version: 1, observationId: observation, signature: 'faro|plasma|candidato', progress: 1.64,
    } });
    expect(readReloadPosition(checkpoint(), 'reload', observation, story)).toBe(1.64);
    expect(readReloadPosition(checkpoint(0), 'reload', observation, story)).toBe(0);
    expect(readReloadPosition(checkpoint(2.999999), 'reload', observation, story)).toBe(2.999999);
  });

  it('preserves unrelated history fields without mutating previous state', () => {
    const router = { key: 'route-7' };
    const previous = { router, userChoice: 4, frbAtlasScroll: { stale: true, evidence: 'old', score: .9 } };
    const original = structuredClone(previous);
    const saved = saveReloadPosition(previous, observation, story, 1.2) as Record<string, unknown>;
    expect(saved).not.toBe(previous);
    expect(saved.router).toBe(router);
    expect(saved.userChoice).toBe(4);
    expect(saved.frbAtlasScroll).toEqual({ version: 1, observationId: observation, signature: story.join('|'), progress: 1.2 });
    expect(previous).toEqual(original);
  });

  it('leaves non-object, array and non-plain history state untouched', () => {
    for (const previous of [undefined, false, 12, 'router-state', [1, 2], new Date(0), new Map([['router', 4]])]) {
      expect(saveReloadPosition(previous, observation, story, 1.2)).toBe(previous);
      expect(readReloadPosition(previous, 'reload', observation, story)).toBeNull();
    }
    const empty = Object.create(null) as Record<string, unknown>;
    const saved = saveReloadPosition(empty, observation, story, 1.2);
    expect(readReloadPosition(saved, 'reload', observation, story)).toBe(1.2);
    expect(Object.keys(empty)).toEqual([]);
  });

  it('does not restore normal navigation, history traversal or unspecified navigation types', () => {
    for (const type of ['navigate', 'back_forward', 'prerender', '', 'Reload']) {
      expect(readReloadPosition(checkpoint(), type, observation, story)).toBeNull();
    }
  });

  it('rejects malformed state, checkpoints, versions and required fields', () => {
    const valid = { version: 1, observationId: observation, signature: story.join('|'), progress: 1.2 };
    for (const state of [null, {}, { frbAtlasScroll: null }, { frbAtlasScroll: [] }, { frbAtlasScroll: '1.2' },
      { frbAtlasScroll: { ...valid, version: 2 } }, { frbAtlasScroll: { ...valid, version: '1' } },
      { frbAtlasScroll: { ...valid, observationId: undefined } }, { frbAtlasScroll: { ...valid, signature: undefined } },
      { frbAtlasScroll: { ...valid, progress: undefined } }, { frbAtlasScroll: { ...valid, progress: '1.2' } }]) {
      expect(readReloadPosition(state, 'reload', observation, story)).toBeNull();
    }
    expect(readReloadPosition(Object.create({ frbAtlasScroll: valid }), 'reload', observation, story)).toBeNull();
  });

  it('rejects a different observing case, route length or route order', () => {
    expect(readReloadPosition(checkpoint(), 'reload', 'alma-hf', story)).toBeNull();
    expect(readReloadPosition(checkpoint(), 'reload', observation, ['faro', 'plasma'])).toBeNull();
    expect(readReloadPosition(checkpoint(), 'reload', observation, ['plasma', 'faro', 'candidato'])).toBeNull();
    expect(readReloadPosition(checkpoint(), 'reload', observation, ['faro', 'plasma', 'candidate-didactic'])).toBeNull();
  });

  it('rejects non-finite and out-of-range progress without clamping to another scene', () => {
    for (const progress of [NaN, Infinity, -Infinity, -1, -.000001, story.length, story.length + .1]) {
      expect(readReloadPosition(checkpoint(progress), 'reload', observation, story)).toBeNull();
    }
    expect(readReloadPosition(saveReloadPosition(null, observation, [], 0), 'reload', observation, [])).toBeNull();
  });
});
