import { describe, expect, it } from 'vitest';
import { MATH_STAGES } from '../src/math/model';
import { equationMarkup, focusedEquationMarkup, symbolMarkup, termAtOperation } from '../src/math/render';

describe('formula presentation', () => {
  it('renders every formula and each active term as accessible math without errors', () => {
    for (const stage of MATH_STAGES) for (const term of stage.terms) {
      const markup = equationMarkup(stage, term.id);
      expect(markup).toContain('<math');
      expect(markup).toContain(`term-${term.id} is-active`);
      expect(markup).not.toContain('katex-error');
      expect(markup).not.toContain('@{');
      expect(symbolMarkup(term.symbol)).toContain('katex');
      expect(focusedEquationMarkup(stage, term.id)).toContain(`term-${term.id} is-active`);
    }
  });
  it('maps operation to a bounded, deterministic term without a new playback clock', () => {
    expect([0, .19, .20, .40, .60, .80, 1].map(value => termAtOperation(value, 5))).toEqual([0, 0, 1, 2, 3, 4, 4]);
    expect(termAtOperation(-1, 3)).toBe(0);
    expect(termAtOperation(Infinity, 3)).toBe(0);
    expect(termAtOperation(9, 3)).toBe(2);
  });
  it('rejects a missing term contract', () => {
    expect(() => equationMarkup({ ...MATH_STAGES[0], formula: '@{unknown}' }, '')).toThrow(/Unknown/);
  });
});
