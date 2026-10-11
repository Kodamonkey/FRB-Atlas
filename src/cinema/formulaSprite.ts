import * as THREE from 'three';

type FormulaNode =
  | { kind: 'glyph'; text: string; italic?: boolean; scale?: number }
  | { kind: 'scripts'; base: FormulaNode; sub?: FormulaNode; sup?: FormulaNode }
  | { kind: 'row'; children: readonly FormulaNode[] }
  | { kind: 'fraction'; numerator: FormulaNode; denominator: FormulaNode };

const glyph = (text: string, italic = false, scale = 1): FormulaNode => ({ kind: 'glyph', text, italic, scale });
const row = (...children: FormulaNode[]): FormulaNode => ({ kind: 'row', children });
const scripts = (base: FormulaNode, sub?: FormulaNode, sup?: FormulaNode): FormulaNode => ({ kind: 'scripts', base, sub, sup });
const fraction = (numerator: FormulaNode, denominator: FormulaNode): FormulaNode => ({ kind: 'fraction', numerator, denominator });
const dm = (sub?: string) => sub ? scripts(glyph('DM'), glyph(sub)) : glyph('DM');
const density = () => scripts(glyph('n', true), glyph('e', true));
const integral = () => glyph('∫', false, 1.6);
const path = (proper = false) => proper ? scripts(glyph('dℓ', true), glyph('proper')) : glyph('dℓ', true);
const voltage = (index: string, conjugate = false) => scripts(glyph('v', true), glyph(index, true), conjugate ? glyph('∗') : undefined);
const product = () => row(voltage('i'), voltage('j', true));

// The finite scene vocabulary is typeset directly into a reusable texture. It is not a TeX parser.
export const SCENE_FORMULAS = {
  dm: { tex: String.raw`\mathrm{DM}=\int n_e\,d\ell`, node: row(dm(), glyph('='), integral(), density(), path()) },
  'dm-observed': {
    tex: String.raw`\mathrm{DM}=\mathrm{DM}_{\rm host,obs}+\int\frac{n_e}{1+z(\ell)}\,d\ell_{\rm proper}`,
    node: row(dm(), glyph('='), dm('host,obs'), glyph('+'), integral(),
      fraction(density(), row(glyph('1+'), glyph('z(ℓ)', true))), path(true)),
  },
  'host-dm': {
    tex: String.raw`\mathrm{DM}_{\rm host,obs}=\frac{\mathrm{DM}_{\rm host,rest}}{1+z}`,
    node: row(dm('host,obs'), glyph('='), fraction(dm('host,rest'), row(glyph('1+'), glyph('z', true)))),
  },
  delay: { tex: String.raw`\Delta t=0.620\,\mathrm{s}`, node: row(glyph('Δt', true), glyph('='), glyph('0.620'), glyph('s')) },
  'delay-law': {
    tex: String.raw`\Delta t=K\,\mathrm{DM}\,(\nu^{-2}-\nu_{\rm ref}^{-2})`,
    node: row(glyph('Δt', true), glyph('='), glyph('K', true), dm(), glyph('('),
      scripts(glyph('ν', true), undefined, glyph('−2')), glyph('−'), scripts(glyph('ν', true), glyph('ref'), glyph('−2')), glyph(')')),
  },
  'voltage-i': { tex: String.raw`v_i`, node: voltage('i') },
  'voltage-j-conjugate': { tex: String.raw`v_j^*`, node: voltage('j', true) },
  'voltage-product': { tex: String.raw`v_i v_j^*`, node: product() },
  visibility: { tex: String.raw`V_{ij}=\langle v_i v_j^*\rangle`,
    node: row(scripts(glyph('V', true), glyph('ij', true)), glyph('='), glyph('⟨', false, 1.18), product(), glyph('⟩', false, 1.18)) },
  power: { tex: String.raw`|v|^2\quad\text{normalizado}`, node: row(scripts(glyph('|v|', true), undefined, glyph('2')), glyph('normalizado')) },
} satisfies Record<string, { tex: string; node: FormulaNode }>;

export type SceneFormulaId = keyof typeof SCENE_FORMULAS;
interface FormulaBox { width: number; top: number; bottom: number; draw: (x: number, baseline: number) => void }

function formulaBox(node: FormulaNode, context: CanvasRenderingContext2D, size: number): FormulaBox {
  if (node.kind === 'glyph') {
    const fontSize = size * (node.scale ?? 1);
    const font = `${node.italic ? 'italic ' : ''}${fontSize}px "Times New Roman", serif`;
    context.font = font;
    const width = context.measureText(node.text).width;
    return { width, top: -fontSize * .82, bottom: fontSize * .24, draw: (x, baseline) => {
      context.font = font; context.fillText(node.text, x, baseline);
    } };
  }
  if (node.kind === 'row') {
    const children = node.children.map(child => formulaBox(child, context, size));
    const gap = size * .11;
    return { width: children.reduce((width, child) => width + child.width, 0) + gap * Math.max(0, children.length - 1),
      top: Math.min(...children.map(child => child.top)), bottom: Math.max(...children.map(child => child.bottom)),
      draw: (x, baseline) => { children.forEach(child => { child.draw(x, baseline); x += child.width + gap; }); } };
  }
  if (node.kind === 'scripts') {
    const base = formulaBox(node.base, context, size);
    const sub = node.sub && formulaBox(node.sub, context, size * .62);
    const sup = node.sup && formulaBox(node.sup, context, size * .62);
    const scriptX = base.width + size * .025, subY = size * .32, supY = -size * .55;
    return { width: scriptX + Math.max(sub?.width ?? 0, sup?.width ?? 0),
      top: Math.min(base.top, sup ? supY + sup.top : base.top),
      bottom: Math.max(base.bottom, sub ? subY + sub.bottom : base.bottom),
      draw: (x, baseline) => {
        base.draw(x, baseline); sub?.draw(x + scriptX, baseline + subY); sup?.draw(x + scriptX, baseline + supY);
      } };
  }
  const numerator = formulaBox(node.numerator, context, size * .79), denominator = formulaBox(node.denominator, context, size * .79);
  const width = Math.max(numerator.width, denominator.width) + size * .2;
  const ruleY = -size * .24;
  const numeratorY = ruleY - size * .14 - numerator.bottom, denominatorY = ruleY + size * .15 - denominator.top;
  return { width, top: numeratorY + numerator.top, bottom: denominatorY + denominator.bottom,
    draw: (x, baseline) => {
      numerator.draw(x + (width - numerator.width) / 2, baseline + numeratorY);
      denominator.draw(x + (width - denominator.width) / 2, baseline + denominatorY);
      context.beginPath(); context.moveTo(x, baseline + ruleY); context.lineTo(x + width, baseline + ruleY);
      context.lineWidth = Math.max(1.5, size * .027); context.stroke();
    } };
}

export function formulaSprite(id: SceneFormulaId, x: number, y: number, width = 2.75, color = '#b6ccd2') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let texture: THREE.CanvasTexture | null = null;
  canvas.width = 512; canvas.height = 128;
  if (context) {
    const box = formulaBox(SCENE_FORMULAS[id].node, context, 80), padding = 20;
    canvas.width = Math.ceil(box.width + padding * 2); canvas.height = Math.ceil(box.bottom - box.top + padding * 2);
    context.fillStyle = color; context.strokeStyle = color; context.textBaseline = 'alphabetic'; context.textAlign = 'left';
    box.draw(padding, padding - box.top);
    texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.name = `formula:${id}`; sprite.position.set(x, y, .16); sprite.scale.set(width, width * canvas.height / canvas.width, 1);
  sprite.userData.formulaId = id; sprite.userData.formulaTex = SCENE_FORMULAS[id].tex;
  sprite.userData.typesetting = 'synchronous canvas math; scripts, integrals and fractions';
  return { sprite, texture };
}
