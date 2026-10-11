import { describe, expect, it } from 'vitest';
import { OBSERVATIONS, channelCentre, dispersionSeconds, effectiveDt, isObservationCase, resolutionRatio } from '../src/observations';
import { isRecordedRoute, storyFor } from '../src/routes';

describe('Two scientifically distinct observing cases', () => {
  it('matches the independent GHz dispersion oracle and Python backend anchors', () => {
    for (const observation of Object.values(OBSERVATIONS)) {
      const lo = channelCentre(observation, 0), hi = channelCentre(observation, observation.channels - 1);
      const secondsFromGHz = .004148808 * observation.dm * ((lo / 1000) ** -2 - (hi / 1000) ** -2);
      expect(dispersionSeconds(observation.dm, lo, hi)).toBeCloseTo(secondsFromGHz, 14);
    }
    expect(resolutionRatio(OBSERVATIONS['arecibo-lf'], 500)).toBeCloseTo(619.5959828235446, 9);
    expect(resolutionRatio(OBSERVATIONS['arecibo-lf'])).toBeCloseTo(1239.1919656470892, 8);
    expect(resolutionRatio(OBSERVATIONS['alma-hf'])).toBeCloseTo(.018344957066, 12);
    expect(resolutionRatio(OBSERVATIONS['alma-hf'], 1770)).toBeCloseTo(.01082352467, 11);
  });

  it('does not mistake unresolved effective sampling for zero dispersion or a sub-native delay', () => {
    const observation = OBSERVATIONS['alma-hf'];
    expect(effectiveDt(observation)).toBe(.004096);
    const delay = dispersionSeconds(observation.dm, channelCentre(observation, 0), channelCentre(observation, 31));
    expect(delay).toBeGreaterThan(observation.dtNativeSeconds);
    expect(delay).toBeLessThan(effectiveDt(observation));
    expect(resolutionRatio({ ...observation, downTimeRate: 1 })).toBeGreaterThan(2);
    const boundary = { ...observation, dtNativeSeconds: dispersionSeconds(observation.dmMax,
      channelCentre(observation, 0), channelCentre(observation, 31)) / 2, downTimeRate: 1 };
    expect(resolutionRatio(boundary)).toBe(2);
    expect(resolutionRatio(boundary) < 2).toBe(false);
  });

  it('uses historical Arecibo only for LF and does not phase seven ALFA beams as separate dishes', () => {
    const lf = storyFor({ detection: 'cnn', classification: 'resnet' });
    expect(lf.some(step => step.id === 'fase' || step.id === 'suma')).toBe(false);
    expect(lf.find(step => step.id === 'antenas')?.detail).toContain('no siete antenas');
    expect(lf.find(step => step.id === 'tierra')?.detail).toContain('no datos del FRB121102 real');
    expect(OBSERVATIONS['arecibo-lf'].dm).toBe(500);
  });

  it('keeps HF independent of all LF checkpoint and DM-bow-tie branches', () => {
    const choice = { detection: 'cnn', classification: 'resnet' } as const;
    const hf = storyFor(choice, 'alma-hf');
    expect(hf).toHaveLength(18);
    expect(isRecordedRoute(choice, 'alma-hf')).toBe(false);
    expect(hf.every(step => !step.requiresEvidence)).toBe(true);
    expect(hf.map(step => step.id)).not.toContain('anfitriona');
    for (const id of ['bowtie', 'centernet', 'rgb', 'resnet', 'candidato']) expect(hf.map(step => step.id)).not.toContain(id);
    for (const id of ['fase', 'suma', 'hf-resolution', 'hf-boxcar', 'hf-candidato']) expect(hf.map(step => step.id)).toContain(id);
    for (const step of hf) expect(step.caption.trim().split(/\s+/).length, step.id).toBeLessThanOrEqual(18);
    expect(new Set(hf.map(step => step.id)).size).toBe(hf.length);
    expect(isObservationCase('alma-hf')).toBe(true); expect(isObservationCase('invalid')).toBe(false);
  });
});
