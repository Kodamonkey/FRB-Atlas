import { readFileSync } from 'node:fs';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { STORY } from '../src/story';
import { DISPERSION_K_S_MHZ2, LIGHT_SPEED_M_S, MATH_STAGES, dispersionSeconds,
  geometricDelaySeconds, mathFor, visibilityComplex } from '../src/math/model';
import type { EventEvidence } from '../src/evidence/types';

const evidence = JSON.parse(readFileSync(new URL('../public/evidence/event.json', import.meta.url), 'utf8')) as EventEvidence;
const TERMS: Record<string, string[]> = {
  faro: ['rotation', 'field'], pulso: ['field', 'envelope', 'intensity'], vuelo: ['distance', 'speed', 'time'],
  plasma: ['density', 'path', 'dm', 'frequency', 'delay'], antenas: ['baseline', 'direction', 'delay'],
  fase: ['voltage', 'product', 'average', 'visibility'], suma: ['voltage', 'phase', 'power'],
  receptor: ['voltage', 'code', 'bits'], fft: ['window', 'frequency', 'amplitude'],
  potencia: ['amplitude', 'power', 'average'], matriz: ['sample', 'frequency', 'power'],
  bloques: ['window', 'context', 'valid'], alineacion: ['dm', 'delay', 'shift'],
  perfil: ['channel', 'exposure', 'mean'], bowtie: ['trial', 'time', 'mean'],
  rgb: ['range', 'channel', 'resize'], backbone: ['kernel', 'product', 'sum'],
  upsampling: ['stride', 'kernel', 'output'], cabezas: ['center', 'size', 'offset'],
  centernet: ['peak', 'offset', 'scale'], recorte: ['time', 'dm', 'extent'],
  resnet: ['convolution', 'residual', 'activation'], decision: ['feature', 'logit', 'probability'],
  candidato: ['score', 'snr', 'confirmation'],
};
const words = (value: string) => value.trim().split(/\s+/).length;

describe('mathematical scene catalogue', () => {
  it('matches all 24 story scenes and the exact visual term IDs', () => {
    expect(MATH_STAGES.map(stage => stage.id)).toEqual(STORY.map(stage => stage.id));
    expect(MATH_STAGES.length).toBe(24);
    expect(new Set(MATH_STAGES.map(stage => stage.id)).size).toBe(24);
    for (const stage of MATH_STAGES) {
      expect(stage.terms.map(term => term.id)).toEqual(TERMS[stage.id]);
      expect(mathFor(stage.id)).toBe(stage);
    }
    expect(() => mathFor('unknown')).toThrow(RangeError);
  });

  it('keeps relations and definitions brief without removing units or provenance', () => {
    for (const stage of MATH_STAGES) {
      expect(words(stage.relation)).toBeLessThanOrEqual(18);
      expect(stage.units.length).toBeGreaterThan(0);
      expect(stage.source.title.length).toBeGreaterThan(0);
      expect(new URL(stage.source.url).protocol).toBe('https:');
      for (const term of stage.terms) {
        expect(words(term.meaning)).toBeLessThanOrEqual(14);
        expect(words(term.visual)).toBeLessThanOrEqual(14);
        expect(term.label.length).toBeGreaterThan(0);
        expect(term.unit.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every formula placeholder and renders every symbol/formula with KaTeX', () => {
    for (const stage of MATH_STAGES) {
      const placeholders = Array.from(stage.formula.matchAll(/@\{([a-z]+)\}/g), match => match[1]);
      expect(new Set(placeholders)).toEqual(new Set(TERMS[stage.id]));
      const rendered = stage.formula.replace(/@\{([a-z]+)\}/g, (_, id: string) => {
        const term = stage.terms.find(entry => entry.id === id);
        if (!term) throw new Error(`Unknown formula term: ${id}`);
        return `{${term.symbol}}`;
      });
      expect(rendered).not.toContain('@{');
      expect(() => katex.renderToString(rendered, { throwOnError: true, strict: 'error', output: 'mathml' })).not.toThrow();
      for (const term of stage.terms) {
        expect(() => katex.renderToString(term.symbol, { throwOnError: true, strict: 'error' })).not.toThrow();
      }
    }
  });

  it('distinguishes uncalibrated acquisition bins from physical MHz channels', () => {
    expect(mathFor('fft').terms.find(term => term.id === 'frequency')?.unit).toBe('ciclos/muestra');
    expect(mathFor('matriz').terms.find(term => term.id === 'frequency')?.unit).toBe('MHz');
    expect(mathFor('receptor').units).toContain('Sin Fs fisica');
    expect(mathFor('potencia').units).toMatch(/no densidad espectral/);
    expect(mathFor('matriz').relation).toMatch(/previa no lo produjo/);
    expect(mathFor('plasma').units).toContain('4148.808 s');
  });

  it('keeps correlation parallel to normalized coherent summation', () => {
    expect(mathFor('fase').relation).toMatch(/Correlador paralelo/);
    expect(mathFor('fase').relation).toMatch(/no alimentan la suma/);
    expect(mathFor('fase').terms.find(term => term.id === 'visibility')?.unit).toBe('u.a.^2');
    expect(mathFor('suma').formula).toContain('\\frac16');
    expect(mathFor('suma').units).toContain('v/6');
  });

  it('does not relabel exposed intensity as SNR or invent upsampling/head operators', () => {
    expect(mathFor('perfil').units).toContain('sin boxcars');
    expect(mathFor('perfil').terms.find(term => term.id === 'mean')?.unit).toBe('u.a.');
    expect(mathFor('bowtie').example).toContain('no se construye desde SNR');
    expect(mathFor('upsampling').formula).toContain('Bilinear');
    expect(mathFor('upsampling').formula).toContain('DoubleConv');
    expect(mathFor('upsampling').units).toContain('align_corners=True');
    expect(mathFor('cabezas').terms.find(term => term.id === 'offset')?.visual).toContain('no mapa inventado');
    expect(mathFor('decision').example).toContain('no sigmoid binario unico');
    expect(mathFor('candidato').relation).toContain('no confirman');
  });
});

describe('dispersion with MHz and seconds', () => {
  it('has the independent 1-to-2 GHz anchor and SI light speed', () => {
    expect(DISPERSION_K_S_MHZ2).toBe(4148.808);
    expect(LIGHT_SPEED_M_S).toBe(299792458);
    expect(dispersionSeconds(1, 1000, 2000)).toBeCloseTo(0.003111606, 12);
    expect(dispersionSeconds(500, 1000, 2000)).toBeCloseTo(1.555803, 12);
  });

  it('matches exact LF channel centres, distinct from band edges, and quantified trial shifts', () => {
    const low = evidence.axes.frequenciesMHz[0], high = evidence.axes.frequenciesMHz.at(-1)!;
    expect([low, high]).toEqual([1203.125, 1596.875]);
    expect(dispersionSeconds(500, low, high)).toBeCloseTo(0.61959598282358, 13);
    expect(dispersionSeconds(evidence.axes.dmValues[47], low, high)).toBeCloseTo(0.6130739258176165, 13);
    expect(Math.round(dispersionSeconds(evidence.axes.dmValues[47], low, high) / evidence.axes.dtSeconds)).toBe(613);
    expect(Math.abs(dispersionSeconds(500, 1200, 1600) - dispersionSeconds(500, low, high))).toBeGreaterThan(0.01);
  });

  it('is linear in DM, signed by the reference, and zero at the reference', () => {
    expect(dispersionSeconds(0, 1200, 1600)).toBe(0);
    expect(dispersionSeconds(500, 1600, 1600)).toBe(0);
    expect(dispersionSeconds(500, 1600, 1200)).toBe(-dispersionSeconds(500, 1200, 1600));
    expect(dispersionSeconds(1000, 1200, 1600)).toBe(2 * dispersionSeconds(500, 1200, 1600));
  });

  it('rejects invalid DM, singular frequencies, nonfinite inputs and overflowing delays', () => {
    for (const args of [[-1, 1200, 1600], [NaN, 1200, 1600], [1, 0, 1600],
      [1, 1200, -1], [1, Infinity, 1600], [1, Number.MIN_VALUE, 1600]]) {
      expect(() => dispersionSeconds(args[0], args[1], args[2])).toThrow(RangeError);
    }
  });
});

describe('geometric delay and Gaussian widths', () => {
  it('returns light travel time for the projected baseline, not a plasma delay', () => {
    expect(geometricDelaySeconds(299792458, 1)).toBe(1);
    expect(geometricDelaySeconds(30, 0.5)).toBeCloseTo(5.0034614279722804e-8, 20);
    expect(geometricDelaySeconds(30, -0.5)).toBeCloseTo(-5.0034614279722804e-8, 20);
    expect(geometricDelaySeconds(30, 0)).toBe(0);
    expect(geometricDelaySeconds(0, 1)).toBe(0);
  });

  it('rejects a nonphysical projection or baseline', () => {
    for (const [baseline, cosine] of [[-1, 0], [1, 1.01], [1, -1.01], [NaN, 1], [1, Infinity]]) {
      expect(() => geometricDelaySeconds(baseline, cosine)).toThrow(RangeError);
    }
  });

  it('keeps intensity FWHM 6 ms distinct from Gaussian amplitude FWHM', () => {
    expect(evidence.truth.widthMs).toBe(6);
    const sigmaIntensity = 6 / (2 * Math.sqrt(2 * Math.log(2)));
    const sigmaAmplitude = Math.sqrt(2) * sigmaIntensity;
    expect(sigmaIntensity).toBeCloseTo(2.547965400864057, 12);
    expect(sigmaAmplitude).toBeCloseTo(3.6033672263593495, 12);
    const amplitudeAtHalfIntensity = Math.exp(-(3 ** 2) / (2 * sigmaAmplitude ** 2));
    expect(amplitudeAtHalfIntensity).toBeCloseTo(Math.SQRT1_2, 12);
    expect(amplitudeAtHalfIntensity ** 2).toBeCloseTo(0.5, 12);
  });
});

describe('complex visibility: mean(a conjugate(b))', () => {
  it('preserves the conjugation sign and the complex mean', () => {
    expect(visibilityComplex([[1, 0]], [[0, 1]])).toEqual([0, -1]);
    expect(visibilityComplex([[0, 1]], [[1, 0]])).toEqual([0, 1]);
    expect(visibilityComplex([[1, 2], [3, -1]], [[4, -2], [-1, 5]])).toEqual([-4, -2]);
  });

  it('returns mean power for autocorrelation and conjugates when antennas are swapped', () => {
    const a: [number, number][] = [[1, 2], [3, -1], [0.5, -0.5]];
    const b: [number, number][] = [[2, 1], [1, -3], [-0.5, 0.5]];
    expect(visibilityComplex(a, a)).toEqual([31 / 6, 0]);
    const ab = visibilityComplex(a, b), ba = visibilityComplex(b, a);
    expect(ab[0]).toBe(ba[0]); expect(ab[1]).toBe(-ba[1]);
  });

  it('retains a phase offset instead of replacing visibility with a beamformed voltage', () => {
    const a: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const b: [number, number][] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    expect(visibilityComplex(a, b)).toEqual([0, -1]);
    const [real, imag] = visibilityComplex(a, b);
    expect(Math.atan2(imag, real)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('rejects empty, unequal, nonfinite or overflowing voltage series', () => {
    expect(() => visibilityComplex([], [])).toThrow(RangeError);
    expect(() => visibilityComplex([[1, 0]], [])).toThrow(RangeError);
    expect(() => visibilityComplex([[NaN, 0]], [[1, 0]])).toThrow(RangeError);
    expect(() => visibilityComplex([[1, 0]], [[1, Infinity]])).toThrow(RangeError);
    expect(() => visibilityComplex([[1e308, 0]], [[1e308, 0]])).toThrow(RangeError);
  });
});

describe('independent fixture examples', () => {
  it('has the explicit 4-bit endpoint quantizer and a half-step error bound', () => {
    expect(evidence.acquisition.bits).toBe(4);
    expect(evidence.acquisition.voltages.length).toBe(64);
    for (const [n, value] of evidence.acquisition.voltages.entries()) {
      const clipped = Math.max(-1, Math.min(1, value));
      const code = Math.floor((clipped + 1) * 15 / 2 + 0.5);
      const decoded = Math.fround(2 * code / 15 - 1);
      expect(evidence.acquisition.quantized[n]).toBe(decoded);
      expect(Math.abs(decoded - clipped)).toBeLessThanOrEqual(1 / 15 + 1e-7);
      expect(code).toBeGreaterThanOrEqual(0); expect(code).toBeLessThanOrEqual(15);
    }
  });

  it('matches all stored FFT powers with an independent direct Hann-windowed DFT oracle', () => {
    const nSamples = 64;
    const samples = evidence.acquisition.quantized.map((value, n) =>
      value * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (nSamples - 1))));
    for (let k = 0; k < nSamples; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < nSamples; n++) {
        const angle = -2 * Math.PI * k * n / nSamples;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      const power = (real ** 2 + imag ** 2) / nSamples ** 2;
      expect(evidence.acquisition.fftPower[k]).toBeCloseTo(power, 12);
    }
  });

  it('decodes the measured centre using x/y order and scale4, without inventing new inference', () => {
    const decode = evidence.candidate.decode!;
    const scale = decode.imgSize / decode.mapSize;
    expect(scale).toBe(4);
    const x = (decode.peak[1] + decode.offset[0]) * scale;
    const y = (decode.peak[0] + decode.offset[1]) * scale;
    expect(x).toBeCloseTo(decode.centerCNN[0], 5);
    expect(y).toBeCloseTo(decode.centerCNN[1], 5);
    const time = decode.centerCNN[0] * evidence.axes.samples / decode.imgSize * evidence.axes.dtSeconds;
    expect(time).toBeCloseTo(evidence.candidate.timeSeconds, 12);
    expect(Math.trunc(time / evidence.axes.dtSeconds)).toBe(551);
    const row = Math.round(decode.centerCNN[1] / (decode.imgSize - 1) * (evidence.axes.dmValues.length - 1));
    expect(row).toBe(47);
    expect(evidence.axes.dmValues[row]).toBe(evidence.candidate.dm);
  });
});
