const NAMESPACE = 'frbAtlasScroll';

function plainObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value as Record<string, unknown> : null;
}

export function saveReloadPosition(
  state: unknown, observationId: string, storyIds: readonly string[], progress: number,
): unknown {
  const existing = plainObject(state);
  if (state !== null && !existing) return state;
  return {
    ...existing,
    [NAMESPACE]: { version: 1, observationId, signature: storyIds.join('|'), progress },
  };
}

export function readReloadPosition(
  state: unknown, navigationType: string, observationId: string, storyIds: readonly string[],
): number | null {
  if (navigationType !== 'reload') return null;
  const saved = plainObject(plainObject(state)?.[NAMESPACE]);
  if (!saved || saved.version !== 1 || saved.observationId !== observationId
    || saved.signature !== storyIds.join('|') || typeof saved.progress !== 'number'
    || !Number.isFinite(saved.progress) || saved.progress < 0 || saved.progress >= storyIds.length) return null;
  return saved.progress;
}
