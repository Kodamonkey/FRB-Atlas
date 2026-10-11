import { describe, expect, it } from 'vitest';
import { BufferGeometry, Line } from 'three';
import { actStartsFor, DEFAULT_STORY, isRecordedRoute, storyFor } from '../src/routes';
import { ACTS } from '../src/story';
import { CLASSIFICATION_METHODS, DETECTION_METHODS } from '../src/methods/catalog';
import { MATH_CATALOG, mathFor, globalMathFor, dispersionSeconds } from '../src/math/model';
import { equationMarkup, focusedEquationMarkup } from '../src/math/render';
import { createMethodStages } from '../src/cinema/methodStages';

describe('Global FRB routes', () => {
  it('keeps the cosmic and acquisition path stable across all 12 method pairs', () => {
    const common = DEFAULT_STORY.slice(0, 18).map(step => step.id);
    const used = new Set<string>();
    for (const detection of DETECTION_METHODS) for (const classification of CLASSIFICATION_METHODS) {
      const choice = { detection: detection.id, classification: classification.id };
      const story = storyFor(choice);
      expect(story.slice(0, 18).map(step => step.id)).toEqual(common);
      expect(new Set(story.map(step => step.id)).size).toBe(story.length);
      expect(story.at(-1)?.id).toBe(isRecordedRoute(choice) ? 'candidato' : 'candidate-didactic');
      expect(actStartsFor(story)).toHaveLength(ACTS.length);
      expect(actStartsFor(story).every(index => index >= 0)).toBe(true);
      for (const step of story) {
        used.add(step.id);
        expect(step.caption.trim().split(/\s+/).length, step.id).toBeLessThanOrEqual(18);
        expect(mathFor(step.id).units.length).toBeGreaterThan(0);
      }
    }
    expect(used.size).toBe(39);
    expect(storyFor({ detection: 'boxcar', classification: 'radio' })).toHaveLength(23);
    expect(DEFAULT_STORY).toHaveLength(27);
    expect(DEFAULT_STORY).toEqual(storyFor({ detection: 'cnn', classification: 'resnet' }));
  });

  it('renders complete and focused equations for every route without unresolved terms', () => {
    expect(new Set(MATH_CATALOG.map(stage => stage.id)).size).toBe(MATH_CATALOG.length);
    for (const stage of MATH_CATALOG) {
      expect(stage.relation.trim().split(/\s+/).length, stage.id).toBeLessThanOrEqual(18);
      expect(equationMarkup(stage, '')).not.toContain('@{');
      for (const term of stage.terms) {
        expect(focusedEquationMarkup(stage, term.id), `${stage.id}/${term.id}`).not.toContain('katex-error');
      }
    }
  });

  it('keeps illustrative pregalactic DM distinct from the complete scientific fixture', () => {
    const definition = globalMathFor('plasma');
    expect(definition.units).toContain('380');
    expect(mathFor('plasma').example).toContain('500');
    expect(definition.formula).toContain('1+z');
    expect(equationMarkup(definition, 'dm')).not.toContain('@{');
    expect(dispersionSeconds(380, 1203.125, 1596.875)).toBeCloseTo(.4708929469459208, 12);
  });

  it('keeps boxcar start times on the input sample grid without stretching valid windows', () => {
    const stages = createMethodStages();
    try {
      const boxcar = stages.find(stage => stage.id === 'boxcar')!;
      const output = boxcar.root.children.find(object => object.userData.focusTerms?.includes('snr')) as Line<BufferGeometry>;
      const positions = output.geometry.getAttribute('position');
      expect(positions.count).toBe(57);
      expect(output.userData.inputSamples).toBe(64);
      expect(positions.getX(0)).toBeCloseTo(-3.7, 6);
      expect(positions.getX(56)).toBeCloseTo((56 / 63 - .5) * 7.4, 6);
      expect(positions.getX(56)).toBeLessThan(3.7);
      boxcar.update(1, 0);
      expect(boxcar.root.userData.construction.completed).toBe(57);
    } finally { stages.forEach(stage => stage.dispose?.()); }
  });
});
