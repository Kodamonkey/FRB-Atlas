import * as THREE from 'three';
import katex from 'katex';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formulaSprite, SCENE_FORMULAS } from '../src/cinema/formulaSprite';
import { createPhysicalStages } from '../src/cinema/physicalStages';
import type { Stage } from '../src/cinema/types';

const calls: Array<{ text: string; x: number; y: number; font: string }> = [];
const strokes: Array<[number, number]> = [];
const context = {
  font: '', fillStyle: '', strokeStyle: '', textBaseline: '', textAlign: '', lineWidth: 0,
  measureText(text: string) { return { width: text.length * Number.parseFloat(this.font.replace('italic ', '')) * .5 }; },
  fillText(text: string, x: number, y: number) { calls.push({ text, x, y, font: this.font }); },
  beginPath() {}, moveTo(x: number, y: number) { strokes.push([x, y]); }, lineTo(x: number, y: number) { strokes.push([x, y]); }, stroke() {},
};
let stages: Stage[] = [];
const labels: ReturnType<typeof formulaSprite>[] = [];

beforeEach(() => {
  calls.length = 0; strokes.length = 0;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});
afterEach(() => {
  labels.splice(0).forEach(label => { label.texture?.dispose(); label.sprite.material.dispose(); });
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  stages.forEach(stage => { stage.dispose?.(); stage.root.traverse(object => {
    const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  }); });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  stages = []; vi.unstubAllGlobals();
});

describe('mathematical labels inside the physical animation', () => {
  it('uses a rendered integral and positioned electron-density subscript, not pseudo-code', () => {
    const label = formulaSprite('dm', -.4, -2.85); labels.push(label);
    expect(calls.map(call => call.text)).toEqual(['DM', '=', '∫', 'n', 'e', 'dℓ']);
    expect(calls.find(call => call.text === 'e')!.y).toBeGreaterThan(calls.find(call => call.text === 'n')!.y);
    expect(calls.some(call => call.text.includes('sum') || call.text.includes('_') || call.text.includes('\\'))).toBe(false);
    expect(label.texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(label.sprite.userData.formulaTex).toBe(String.raw`\mathrm{DM}=\int n_e\,d\ell`);
  });
  it('draws the cosmological denominator as a fraction and preserves proper path notation', () => {
    labels.push(formulaSprite('dm-observed', 0, 0));
    expect(strokes).toHaveLength(2);
    expect(strokes[1][0]).toBeGreaterThan(strokes[0][0]);
    const numerator = calls.find(call => call.text === 'n')!, denominator = calls.find(call => call.text === 'z(ℓ)')!;
    expect(numerator.y).toBeLessThan(denominator.y);
    expect(calls.some(call => call.text === 'proper')).toBe(true);
    expect(calls.some(call => call.text === 'host,obs')).toBe(true);
  });
  it('renders correlation conjugation and averaging with real scripts and brackets', () => {
    labels.push(formulaSprite('visibility', 0, 0));
    expect(calls.map(call => call.text)).toEqual(['V', 'ij', '=', '⟨', 'v', 'i', 'v', 'j', '∗', '⟩']);
    const conjugate = calls.find(call => call.text === '∗')!, voltages = calls.filter(call => call.text === 'v');
    expect(conjugate.y).toBeLessThan(voltages[1].y);
    expect(calls.find(call => call.text === 'ij')!.y).toBeGreaterThan(calls[0].y);
  });
  it('keeps every canonical equation valid in KaTeX and every glyph inside its texture', () => {
    for (const id of Object.keys(SCENE_FORMULAS) as Array<keyof typeof SCENE_FORMULAS>) {
      calls.length = 0; strokes.length = 0;
      const label = formulaSprite(id, 1, 2, 3); labels.push(label);
      expect(() => katex.renderToString(SCENE_FORMULAS[id].tex, { throwOnError: true })).not.toThrow();
      const image = label.texture!.image as HTMLCanvasElement;
      calls.forEach(call => { expect(call.x).toBeGreaterThanOrEqual(0); expect(call.y).toBeGreaterThan(0); expect(call.y).toBeLessThan(image.height); });
      expect(label.sprite.scale.y).toBeCloseTo(3 * image.height / image.width, 12);
    }
  });
  it('selects observer-frame DM for the global journey without changing scientific outputs', () => {
    stages = createPhysicalStages({ propagationDm: 380, incomingDm: 100 });
    const plasma = stages.find(stage => stage.id === 'plasma')!, formulas: THREE.Object3D[] = [];
    plasma.root.traverse(object => { if (object.userData.formulaId) formulas.push(object); });
    expect(formulas.map(object => object.userData.formulaId)).toEqual(['dm-observed']);
    plasma.update(.5, 0); expect(plasma.root.userData.dmAccumulated).toBe(240);
    plasma.update(1, 0); expect(plasma.root.userData.dmAccumulated).toBe(380);
    expect(plasma.root.userData.dmUnits).toBe('pc cm^-3');
  });
  it('keeps a semantic equation if a canvas context is unavailable', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
    const label = formulaSprite('dm', 0, 0); labels.push(label);
    expect(label.texture).toBeNull(); expect(label.sprite.userData.formulaTex).toContain('\\int');
  });
  it('retains array geometry and identifies Chajnantor as an illustrative millimetre-wave site', () => {
    stages = createPhysicalStages();
    const array = stages.find(stage => stage.id === 'antenas')!; array.update(1, 0);
    const terrain = array.root.getObjectByName('chajnantor:terrain') as THREE.Mesh;
    expect(terrain.geometry.getAttribute('position').count).toBeGreaterThan(9000);
    expect(array.root.userData.site.altitudeMeters).toBe(5000);
    expect(array.root.userData.site.bandNote).toContain('no observacion');
    expect(array.root.userData.baselineVector).toEqual([5.4, 0, -.1]);
    expect(array.root.userData.propagationDirection).toEqual([1, 0, 0]);
    array.setFocus?.('delay'); expect((terrain.material as THREE.Material).opacity).toBe(.72);
    array.setFocus?.(null); expect((terrain.material as THREE.Material).opacity).toBe(1);
  });
});
