import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_METHODS, classificationStages, DEFAULT_METHODS, DETECTION_METHODS, detectionStages,
  hasRecordedInference, METHOD_SEQUENCES,
} from '../src/methods/catalog';
import {
  boxcarFilter, METHOD_MATH, multiplyMatrices, patchify, scaledDotAttention, stableSoftmax,
  TOY_CROP, TOY_FEATURES, TOY_MAP, TOY_PROFILE, TOY_PROJECTION, TOY_RESIDUAL_INPUT,
  toyForest, toyResidual, toyTokens, toyTransformer,
} from '../src/methods/math';
import { createMethodStages, METHOD_FOCUS_TERMS, METHOD_STAGE_IDS } from '../src/cinema/methodStages';
import { equationMarkup } from '../src/math/render';

describe('Selectable pedagogical methods', () => {
  it('starts with the recorded CNN and ResNet route while retaining classical alternatives', () => {
    expect(DEFAULT_METHODS).toEqual({ detection:'cnn',classification:'resnet' });
    expect(hasRecordedInference(DEFAULT_METHODS)).toBe(true);
    expect(detectionStages('cnn')).toEqual(['rgb','backbone','upsampling','cabezas','centernet']);
    expect(classificationStages('resnet','cnn')).toEqual(['recorte','resnet','decision']);
    expect(classificationStages('resnet','boxcar')).toEqual(['resnet-didactic']);
    expect(classificationStages('resnet','transformer')).toEqual(['resnet-didactic']);
    expect(hasRecordedInference({detection:'cnn',classification:'resnet'})).toBe(true);
    for(const detection of DETECTION_METHODS)for(const classification of CLASSIFICATION_METHODS){
      if(detection.id!=='cnn'||classification.id!=='resnet')expect(hasRecordedInference({detection:detection.id,classification:classification.id})).toBe(false);
    }
  });
  it('keeps complete scene, formula, source, focus and short-copy contracts', () => {
    expect(METHOD_SEQUENCES.map(step=>step.id)).toEqual(METHOD_STAGE_IDS);
    for(const sequence of METHOD_SEQUENCES){
      expect(sequence.title.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(sequence.caption.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(sequence.requiresEvidence).toBe(false);
      const math=METHOD_MATH.find(stage=>stage.id===sequence.id)!;
      expect(math.units.length).toBeGreaterThan(12);
      expect(math.source.url).toMatch(/^https:\/\//);
      expect(math.relation.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(METHOD_FOCUS_TERMS[sequence.id]).toEqual(math.terms.map(term=>term.id));
      for(const term of math.terms){
        expect(math.formula).toContain(`@{${term.id}}`);
        expect(equationMarkup(math,term.id)).not.toContain('katex-error');
      }
    }
  });
  it('does not reuse the recorded candidate or score on alternative final scenes', () => {
    const candidate=createMethodStages().find(stage=>stage.id==='candidate-didactic')!;
    expect(candidate.root.userData.hasRecordedScore).toBe(false);
    expect(candidate.root.userData.confirmed).toBe(false);
    expect(candidate.root.userData.inferenceMode).toBe('didactic');
    expect(candidate.root.userData).not.toHaveProperty('eventId');
    candidate.dispose?.();
  });
});

describe('Boxcar: physical normalization and complete-window edges', () => {
  it('sums signal above the background and divides by sigma sqrt(W)', () => {
    const normalized=boxcarFilter([3,3,1,1],2,1,2);
    expect(normalized[0]).toBeCloseTo(Math.SQRT2,14);expect(normalized[1]).toBeCloseTo(Math.SQRT1_2,14);expect(normalized[2]).toBe(0);
    expect(Array.from(boxcarFilter([2,2,2,2],4))).toEqual([4]);
    expect(Array.from(boxcarFilter([2,2,2,2],1))).toEqual([2,2,2,2]);
    expect(Array.from(boxcarFilter([1,2,3,4,5],3))).toEqual([6/Math.sqrt(3),9/Math.sqrt(3),12/Math.sqrt(3)]);
  });
  it('handles only valid windows, without wrap, shortening or invented exposure', () => {
    expect(boxcarFilter([0,0,8],2)).toHaveLength(2);
    expect(boxcarFilter([0,0,8],2)[0]).toBe(0);
    for(const width of [0,-1,1.5,4])expect(()=>boxcarFilter([1,2,3],width)).toThrow(RangeError);
    expect(()=>boxcarFilter([1,2],1,0,0)).toThrow(RangeError);
    expect(()=>boxcarFilter([1,NaN],1)).toThrow(RangeError);
  });
  it('keeps the demonstration signal fixed and publishes its complete numeric samples', () => {
    expect(TOY_PROFILE).toHaveLength(64);
    expect(TOY_PROFILE[31]).toBeCloseTo((Math.sin(1.7*31)+.7*Math.cos(.47*31))/Math.sqrt(.745)+4,14);
    const stages=createMethodStages(),boxcar=stages.find(stage=>stage.id==='boxcar')!;
    expect(boxcar.root.userData.profile).toBe(TOY_PROFILE);
    expect(boxcar.root.userData.filtered).toHaveLength(57);
    stages.forEach(stage=>stage.dispose?.());
  });
});

describe('Attention: stable products and published demonstration weights', () => {
  it('computes stable softmax on large or equal logits', () => {
    expect(Array.from(stableSoftmax([10000,10000]))).toEqual([.5,.5]);
    expect(stableSoftmax([-10000,10000])[1]).toBe(1);
    expect(stableSoftmax([1,2,3]).reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,15);
    expect(()=>stableSoftmax([])).toThrow(RangeError);
    expect(()=>stableSoftmax([Infinity,0])).toThrow(RangeError);
  });
  it('divides QK products by sqrt(d), normalizes each row, then combines V', () => {
    const result=scaledDotAttention([[1,0],[0,1]],[[1,0],[0,1]],[[2,3],[4,7]]);
    expect(result.scores[0][0]).toBeCloseTo(Math.SQRT1_2,14);expect(result.scores[1][1]).toBeCloseTo(Math.SQRT1_2,14);
    expect(result.scores[0][1]).toBe(0);expect(result.scores[1][0]).toBe(0);
    const e=Math.exp(Math.SQRT1_2),a=e/(e+1),b=1/(e+1);
    expect(result.weights[0][0]).toBeCloseTo(a,14);
    expect(result.output[0][0]).toBeCloseTo(2*a+4*b,14);
    expect(result.output[0][1]).toBeCloseTo(3*a+7*b,14);
    for(const row of result.weights)expect(row.reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,15);
    expect(()=>scaledDotAttention([[1]],[[1,2]],[[3]])).toThrow(RangeError);
    expect(()=>scaledDotAttention([[1,2]],[[1,2],[3,4]],[[3]])).toThrow(RangeError);
  });
  it('preserves raster patch order and exact projected dimensions', () => {
    expect(patchify([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],4,4,2))
      .toEqual([[0,1,4,5],[2,3,6,7],[8,9,12,13],[10,11,14,15]]);
    expect(()=>patchify([1,2,3,4,5,6],3,2,2)).toThrow(RangeError);
    expect(TOY_PROJECTION).toHaveLength(16);
    expect(TOY_PROJECTION[0][0]).toBe(Math.cos(1)/4);
    expect(multiplyMatrices([[1,2]],[[3],[4]])).toEqual([[11]]);
    expect(()=>multiplyMatrices([[1,2]],[[3]])).toThrow(RangeError);
    const tokens=toyTokens(TOY_MAP);
    expect(tokens).toHaveLength(16);expect(tokens[0]).toHaveLength(4);
  });
  it('reproduces attention and classifier arrays without checkpoints or inference services', () => {
    expect(toyTransformer(TOY_CROP)).toEqual(toyTransformer(TOY_CROP));
    const result=toyTransformer(TOY_MAP);
    expect(result.weights).toHaveLength(16);expect(result.weights[0]).toHaveLength(16);
    expect(result.output).toHaveLength(16);expect(result.output[0]).toHaveLength(4);
    expect(result.pool).toHaveLength(4);expect(result.logits).toHaveLength(2);
    expect(result.probabilities.reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,15);
  });
});

describe('Classification: explicit rules and residual operators', () => {
  it('evaluates published trees and accumulates votes, not calibrated probabilities', () => {
    expect(toyForest(TOY_FEATURES).votes).toEqual([1,1,1]);
    expect(toyForest([1,100,0,.01]).votes).toEqual([0,0,0]);
    expect(toyForest([8,100,500,.1]).votes).toEqual([1,0,0]);
    expect(toyForest([8,100,500,.1]).fraction).toBe(1/3);
    expect(toyForest([6,30,20,.35]).votes).toEqual([1,0,1]);
    expect(toyForest(TOY_FEATURES).paths[0]).toEqual([{feature:0,threshold:6,direction:'above'},{feature:2,threshold:10,direction:'above'}]);
    expect(()=>toyForest([1,2,3])).toThrow(RangeError);
    expect(()=>toyForest([1,NaN,3,4])).toThrow(RangeError);
  });
  it('uses zero-padding convolution, identity addition and ReLU on equal dimensions', () => {
    const result=toyResidual([1,-2,3]);
    expect(result.convolution).toEqual([0,0,1]);
    expect(result.output).toEqual([1,0,4]);
    expect(toyResidual().output).toHaveLength(TOY_RESIDUAL_INPUT.length);
  });
});

describe('Stepwise method animation', () => {
  it('matches every focus term to objects without changing published data', () => {
    const stages=createMethodStages();
    expect(stages.map(stage=>stage.id)).toEqual(METHOD_STAGE_IDS);
    for(const stage of stages){
      stage.update(.7,0);
      for(const term of METHOD_FOCUS_TERMS[stage.id]){
        stage.setFocus?.(term);expect(stage.root.userData.focus).toBe(term);
        expect(stage.root.userData.focusedObjects.length,`${stage.id}/${term}`).toBeGreaterThan(0);
      }
      stage.setFocus?.('unknown');expect(stage.root.userData.focus).toBe(null);
      expect(stage.continuous).toBe(false);expect(stage.root.userData.inferenceMode).toBe('didactic');
      stage.dispose?.();
    }
  });
  it('commits integers reversibly and holds completed output for inspection', () => {
    for(const stage of createMethodStages()){
      stage.update(.36,0);const early={...stage.root.userData.construction};
      stage.update(.9,0);const late={...stage.root.userData.construction};
      expect(Number.isInteger(early.completed)).toBe(true);expect(late.completed).toBeGreaterThanOrEqual(early.completed);
      stage.update(.36,0);expect(stage.root.userData.construction).toEqual(early);
      stage.update(1,0);expect(stage.root.userData.construction.completed).toBe(stage.root.userData.construction.total);
      stage.dispose?.();
    }
  });
});
