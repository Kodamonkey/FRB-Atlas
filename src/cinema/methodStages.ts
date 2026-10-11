import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, InstancedMesh,
  Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, Vector3,
} from 'three';
import type { Stage } from './types';
import {
  boxcarFilter, METHOD_MATH, TOY_CROP, TOY_FEATURES, TOY_MAP, TOY_PROFILE, TOY_RESIDUAL_INPUT,
  toyForest, toyResidual, toyTransformer,
} from '../methods/math';

const CYAN = '#72e2c7', CORAL = '#ff957e', YELLOW = '#ffdb75', WHITE = '#eef6f2', MUTED = '#85999f';
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const phase = (p: number, start: number, end: number) => clamp((p - start) / (end - start));
export const METHOD_STAGE_IDS = METHOD_MATH.map(stage => stage.id);
export const METHOD_FOCUS_TERMS: Record<string, readonly string[]> = Object.fromEntries(
  METHOD_MATH.map(stage => [stage.id, stage.terms.map(term => term.id)]));
const WIDTHS = [1,2,4,8,14,20];

function tag<T extends Object3D>(object: T, ...terms: string[]): T { object.userData.focusTerms = terms; return object; }
function line(points: number[], color = CYAN): Line<BufferGeometry, LineBasicMaterial> {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
}
function box(x: number, y: number, width: number, height: number, color = MUTED) {
  return line([x-width/2,y-height/2,.1,x+width/2,y-height/2,.1,x+width/2,y+height/2,.1,
    x-width/2,y+height/2,.1,x-width/2,y-height/2,.1], color);
}
function curve(values: ArrayLike<number>, x: number, y: number, width: number, height: number, color = CYAN,
  denominator?: number, inputSamples = values.length) {
  let maximum = denominator ?? 1;
  if (denominator === undefined) for (let n = 0; n < values.length; n++) maximum = Math.max(maximum, Math.abs(values[n]));
  const points: number[] = [];
  for (let n = 0; n < values.length; n++) points.push(x + (n / Math.max(1, inputSamples - 1) - .5) * width,
    y + values[n] / maximum * height, .2);
  const object = line(points, color); object.userData.values = Array.from(values); object.userData.inputSamples = inputSamples; return object;
}
function reveal(object: Line, amount: number) {
  const total = object.geometry.getAttribute('position').count;
  object.geometry.setDrawRange(0, Math.floor(clamp(amount) * total));
  return Math.floor(clamp(amount) * total);
}

interface MatrixPlot { object: InstancedMesh; cursor: Line; total: number; write: (p: number) => number }
function matrix(values: ArrayLike<number>, columns: number, rows: number, width: number, height: number,
  x: number, y: number): MatrixPlot {
  const total = rows * columns;
  if (values.length !== total) throw new RangeError('Method matrix dimensions mismatch');
  const object = new InstancedMesh(new BoxGeometry(width / columns * .86, height / rows * .86, .035),
    new MeshBasicMaterial({ color: WHITE, transparent: true, opacity: .94, depthWrite: false }), total);
  const transform = new Object3D(); const cool = new Color('#1d615d'), hot = new Color(CORAL);
  let maximum = 1e-8, minimum = Infinity;
  for (let i = 0; i < total; i++) { maximum = Math.max(maximum, values[i]); minimum = Math.min(minimum, values[i]); }
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / columns), column = i % columns;
    transform.position.set(x + ((column + .5) / columns - .5) * width, y + (.5 - (row + .5) / rows) * height, .2);
    transform.updateMatrix(); object.setMatrixAt(i, transform.matrix);
    object.setColorAt(i, cool.clone().lerp(hot, clamp((values[i] - minimum) / Math.max(1e-9, maximum - minimum))));
  }
  object.instanceMatrix.needsUpdate = true; if (object.instanceColor) object.instanceColor.needsUpdate = true;
  object.userData.shape = [rows, columns]; object.userData.values = Array.from(values);
  const cursor = box(0,0,width / columns,height / rows,YELLOW); cursor.name = 'method-write-cursor';
  object.count = 0;
  return { object, cursor, total, write(p) {
    const count = Math.floor(clamp(p) * total); object.count = count;
    const active = Math.min(total - 1, count), row = Math.floor(active / columns), column = active % columns;
    cursor.position.set(x + ((column + .5) / columns - .5) * width, y + (.5 - (row + .5) / rows) * height, .5);
    cursor.visible = count < total; return count;
  } };
}
function vector(values: readonly number[], width: number, height: number, x: number, y: number) {
  const object = new InstancedMesh(new BoxGeometry(width / values.length * .7,1,.08),
    new MeshBasicMaterial({ color: CYAN, transparent: true, opacity: .94, depthWrite: false }), values.length);
  const maximum = Math.max(1e-8,...values.map(Math.abs)), transform = new Object3D();
  values.forEach((value, i) => {
    const h = Math.max(.025, Math.abs(value) / maximum * height);
    transform.position.set(x + ((i + .5) / values.length - .5) * width,y + Math.sign(value) * h / 2,.2);
    transform.scale.set(1,h,1);transform.updateMatrix();object.setMatrixAt(i,transform.matrix);
    object.setColorAt(i,new Color(value >= 0 ? CYAN : CORAL));
  });
  object.instanceMatrix.needsUpdate = true; if (object.instanceColor) object.instanceColor.needsUpdate = true;
  object.userData.values = [...values]; object.count = 0; return object;
}
function writeVector(object: InstancedMesh, p: number) {
  const total = object.userData.values.length; object.count = Math.floor(clamp(p) * total); return object.count;
}

function makeStage(id: string, build: (root: Group, label: Label) => (p: number) => void): Stage {
  const root = new Group(), textures: CanvasTexture[] = [];
  root.name = id; root.scale.setScalar(.67); root.userData.focus = null;
  root.userData.inferenceMode = 'didactic'; root.userData.sourceKind = 'fixed published toy example';
  root.userData.focusedObjects = []; root.userData.construction = { completed: 0, total: 1, unit: 'illustrative operations' };
  const label: Label = (text, x, y, width = 2, color = WHITE) => {
    const group = new Group(); group.name = `label:${text}`; group.position.set(x,y,.45);
    if (typeof document === 'undefined') return group;
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context) return group;
    canvas.width = 768;canvas.height = 120;context.font = '36px monospace';context.textAlign = 'center';context.textBaseline = 'middle';
    context.fillStyle = color;context.fillText(text,384,60);
    const texture = new CanvasTexture(canvas);texture.colorSpace = SRGBColorSpace;textures.push(texture);
    group.add(new Mesh(new PlaneGeometry(width,width*120/768),new MeshBasicMaterial({ map: texture,transparent: true,depthWrite: false })));
    return group;
  };
  const update = build(root,label);
  root.add(label('EJEMPLO DIDACTICO / SIN PESOS ENTRENADOS',0,-2.65,6.5,MUTED));
  const bindings: { object: Object3D; materials: (MeshBasicMaterial | LineBasicMaterial)[] }[] = [];
  const bases = new Map<MeshBasicMaterial | LineBasicMaterial, Color>();
  const focusColor = new Color(YELLOW);
  root.traverse(object => {
    if (!object.userData.focusTerms) return;
    const materials: (MeshBasicMaterial | LineBasicMaterial)[] = [];
    object.traverse(child => {
      const material = (child as Mesh).material;
      if (material instanceof MeshBasicMaterial || material instanceof LineBasicMaterial) {
        materials.push(material); if (!bases.has(material)) bases.set(material,material.color.clone());
      }
    }); bindings.push({ object,materials });
  });
  const focus = () => {
    const selected: string[] = root.userData.focusedObjects; selected.length = 0;
    for (const binding of bindings) {
      const active = root.userData.focus !== null && binding.object.userData.focusTerms.includes(root.userData.focus);
      binding.object.userData.focusActive = active;
      if (active) selected.push(binding.object.name || binding.object.type);
      for (const material of binding.materials) material.color.copy(bases.get(material)!).lerp(focusColor,active ? .75 : 0);
    }
  };
  return { id, root, camera: new Vector3(0,1.6,9), target: new Vector3(), continuous: false, mobileScale: 2.2,
    setFocus(term) { root.userData.focus = term && METHOD_FOCUS_TERMS[id].includes(term) ? term : null;focus(); },
    update(p) { update(clamp(p));focus(); }, dispose() { textures.forEach(texture => texture.dispose()); } };
}
type Label = (text: string, x: number, y: number, width?: number, color?: string) => Group;
function state(root: Group, completed: number, total: number, unit: string) {
  Object.assign(root.userData.construction,{ completed,total,unit });
}

function methodsStage() {
  return makeStage('metodos',(root,label) => {
    const input = matrix(TOY_MAP,16,16,1.65,1.65,-3.2,0);tag(input.object,'input');
    const routes = [-1.45,0,1.45].map((y,i) => tag(line([-2.25,0,.2,-1.25,y,.2,.45,y,.2], [CYAN,CORAL,YELLOW][i]),'detection'));
    const convergence = routes.map((_,i) => tag(line([.85,[-1.45,0,1.45][i],.2,2.45,0,.2,3.7,0,.2],MUTED),'classification'));
    root.add(input.object,input.cursor,...routes,...convergence,label('PERFIL / MAPA',-3.2,1.45,2),
      label('BOXCAR',.2,-1.45,1.45,CYAN),label('CNN',.2,0,1.2,CORAL),label('ATENCION',.2,1.45,1.8,YELLOW),
      tag(label('INSPECCION',3.2,.65,2.1),'classification'));
    return p => { const count = input.write(phase(p,0,.3));routes.forEach(route => reveal(route,phase(p,.2,.65)));
      convergence.forEach(route => reveal(route,phase(p,.55,.95)));state(root,count,input.total,'illustrative input cells'); };
  });
}
function boxcarStage() {
  return makeStage('boxcar',(root,label) => {
    const width = 8, filtered = boxcarFilter(TOY_PROFILE,width), denominator = Math.max(...filtered.map(Math.abs));
    const input = tag(curve(TOY_PROFILE,0,.75,7.4,1,CYAN,6),'sample');
    const output = tag(curve(filtered,0,-1.5,7.4,1.5,CORAL,denominator,TOY_PROFILE.length),'snr');
    const window = tag(box(0,.8,7.4 * width / 64,1.7,YELLOW),'width');
    const normalization = tag(label('sigma sqrt(W)',2.8,2,2.4),'noise');
    root.add(input,output,window,normalization,label('x[n] / u.a.',-2.75,2,2),label('rho_W[n] / adimensional',0,-2,4),
      label('8 muestras / 8 ms',0,.1,3.1,YELLOW));
    root.userData.profile = TOY_PROFILE;root.userData.filtered = filtered;root.userData.width = width;
    return p => { const count = reveal(output,phase(p,.12,.98));const n = Math.min(filtered.length-1,count);
      window.position.x = ((n + (width-1)/2) / (TOY_PROFILE.length-1) - .5) * 7.4;state(root,count,filtered.length,'completed illustrative windows'); };
  });
}
function boxcarBankStage() {
  return makeStage('boxcar-bank',(root,label) => {
    const bank = WIDTHS.map(width => boxcarFilter(TOY_PROFILE,width));
    const maximum = Math.max(...bank.flatMap(values => Array.from(values).map(Math.abs)));
    const curves = bank.map((values,i) => tag(curve(values,.45,1.5-i*.58,6.9,.48,i%2?CORAL:CYAN,maximum,TOY_PROFILE.length),'snr','best'));
    root.add(...curves,...WIDTHS.map((width,i) => tag(label(`${width} ms`,-3.65,1.5-i*.58,.9,i%2?CORAL:CYAN),'width')),
      label('MISMO PERFIL / SEIS ANCHURAS',0,2.2,5));
    root.userData.widths = WIDTHS;root.userData.bank = bank;
    const total = bank.reduce((sum,values) => sum+values.length,0);
    return p => { let completed = 0;curves.forEach((curve,i) => { completed += reveal(curve,clamp(p*6-i)); });
      state(root,completed,total,'illustrative filter bank samples'); };
  });
}
function boxcarThresholdStage() {
  return makeStage('boxcar-threshold',(root,label) => {
    const values = boxcarFilter(TOY_PROFILE,8), threshold = 6, maximum = Math.max(...values.map(Math.abs));
    const profile = tag(curve(values,0,-.7,7.6,2.1,CYAN,maximum,TOY_PROFILE.length),'snr');
    const boundary = tag(line([-3.8,-.7+threshold/maximum*2.1,.4,3.8,-.7+threshold/maximum*2.1,.4],YELLOW),'threshold');
    const candidates = Array.from(values,(value,n) => ({ value,n })).filter(item => item.value > threshold);
    const markers = candidates.map(item => {
      const x = (item.n/(TOY_PROFILE.length-1)-.5)*7.6;
      return tag(line([x,-1.2,.4,x,-.7+item.value/maximum*2.1,.4],CORAL),'candidate','time');
    });
    root.add(profile,boundary,...markers,label('eta = 6 / adimensional',2.4,2,3.5,YELLOW),
      tag(label('t = n Delta t / s',0,-1.9,3.5),'time'),label('Propuestas solapadas, no confirmaciones',0,-2.3,6.6,MUTED));
    root.userData.threshold = threshold;root.userData.proposals = candidates.map(item => item.n);
    return p => { const count = reveal(profile,phase(p,0,.8));markers.forEach((marker,i) => marker.visible = candidates[i].n < count);
      state(root,count,values.length,'illustrative threshold evaluations'); };
  });
}
function patchStage() {
  return makeStage('vit-patches',(root,label) => {
    const map = matrix(TOY_MAP,16,16,3.1,3.1,-2.3,.15);tag(map.object,'patch');
    const example = toyTransformer(TOY_MAP), tokens = matrix(example.tokens.flat(),4,16,2.1,3.1,2.4,.15);tag(tokens.object,'token','projection');
    const divisions: Line[] = [];
    for (let i = 0; i <= 4; i++) {
      divisions.push(tag(line([-3.85+i*3.1/4,-1.4,.5,-3.85+i*3.1/4,1.7,.5],YELLOW),'patch','position'));
      divisions.push(tag(line([-3.85,-1.4+i*3.1/4,.5,-.75,-1.4+i*3.1/4,.5],YELLOW),'patch','position'));
    }
    const projection = tag(line([-.5,.15,.4,.75,.15,.4],CORAL),'projection');
    root.add(map.object,map.cursor,tokens.object,tokens.cursor,...divisions,projection,
      label('16 x 16 / MAPA ESQUEMATICO',-2.3,2.1,3.5),label('16 TOKENS / d = 4',2.4,2.1,3),
      label('P = 4 / E: 16 x 4',0,-1.9,3.5,YELLOW));
    root.userData.tokens = example.tokens;
    return p => { const a=map.write(phase(p,0,.4)),b=tokens.write(phase(p,.35,.98));
      divisions.forEach(divider => divider.visible = p>.15);reveal(projection,phase(p,.2,.6));
      state(root,a+b,map.total+tokens.total,'illustrative patch and token cells'); };
  });
}
function attentionStage() {
  return makeStage('vit-detection',(root,label) => {
    const example = toyTransformer(TOY_MAP);
    const queries = matrix(example.query.flat(),4,16,1.3,2.4,-3.6,.3);tag(queries.object,'query');
    const keys = matrix(example.key.flat(),4,16,1.3,2.4,-1.9,.3);tag(keys.object,'key');
    const weights = matrix(example.weights.flat(),16,16,2.35,2.4,.5,.3);tag(weights.object,'weights');
    const values = matrix(example.value.flat(),4,16,.6,2.4,2.3,.3);tag(values.object,'value');
    const output = matrix(example.output.flat(),4,16,.85,2.4,3.5,.3);tag(output.object,'output');
    root.add(queries.object,queries.cursor,keys.object,keys.cursor,weights.object,weights.cursor,values.object,values.cursor,output.object,output.cursor,
      label('Q',-3.6,1.85,.6),label('K',-1.9,1.85,.6),label('A / filas suman 1',.5,1.85,2.5,YELLOW),
      label('V',2.3,1.85,.6),label('Y',3.5,1.85,.6),label('Q K^T / sqrt(4)',-2.8,-1.45,2.4),label('softmax / A V',1.7,-1.45,3));
    root.userData.attention = example;root.userData.dimensions = { Q:[16,4],K:[16,4],A:[16,16],V:[16,4],Y:[16,4] };
    const total = queries.total+keys.total+weights.total+values.total+output.total;
    return p => { const completed = queries.write(phase(p,0,.2))+keys.write(phase(p,.05,.25))+
      weights.write(phase(p,.2,.7))+values.write(phase(p,.3,.6))+output.write(phase(p,.7,.98));
      state(root,completed,total,'illustrative attention cells'); };
  });
}
function proposalsStage() {
  return makeStage('vit-proposals',(root,label) => {
    const tokens = matrix(toyTransformer(TOY_MAP).output.flat(),4,16,1.25,2.2,-3.1,.35);tag(tokens.object,'token');
    const connector = tag(line([-2.25,.35,.3,-.8,.35,.3,.7,.35,.3],CORAL),'head');
    const head = tag(box(-.6,.35,1.5,1.2,YELLOW),'head');
    const map = matrix(TOY_MAP,16,16,2.55,2.2,2.5,.35);
    const proposal = tag(box(2.5,.35,1.1,1.3,CORAL),'extent');
    const center = tag(line([2.25,.35,.7,2.75,.35,.7,2.5,.35,.7,2.5,.1,.7,2.5,.6,.7],YELLOW),'center');
    root.add(tokens.object,tokens.cursor,map.object,map.cursor,connector,head,proposal,center,
      label('TOKENS',-3.1,1.9,1.8),label('g_theta',-.6,.35,1.5,YELLOW),label('CAJA ESQUEMATICA',2.5,1.9,3.1),
      label('Sin pesos / sin score / sin coordenadas fisicas',0,-1.7,7,MUTED));
    root.userData.proposalKind='hand-drawn schematic, not model prediction';
    return p => { const count=tokens.write(phase(p,0,.35))+map.write(phase(p,.25,.6));
      reveal(connector,phase(p,.2,.55));head.visible=p>.35;proposal.visible=p>.65;center.visible=p>.8;
      state(root,count,tokens.total+map.total,'schematic proposal context cells'); };
  });
}
function radioStage() {
  return makeStage('radio-checks',(root,label) => {
    const before = tag(curve(TOY_PROFILE,-2.8,.4,2.4,1,CYAN,6),'delay');
    const map = matrix(TOY_MAP,16,16,2.4,2.3,.1,.5);tag(map.object,'observed');
    const reference = tag(line([2,0,.4,4.1,0,.4],MUTED),'galactic');
    const difference = tag(line([2.7,0,.4,2.7,1.45,.4],CORAL),'excess');
    root.add(before,map.object,map.cursor,reference,difference,
      label('DISPERSION',-2.8,1.95,2.2),label('DM / ANCHURA',.1,1.95,2.6),label('CONTEXTO',3.1,1.95,2.2),
      tag(label('DM_MW: modelo',3.1,-.35,2.5,MUTED),'galactic'),tag(label('DM_exc: no estimada',3.1,1.05,2.9,CORAL),'excess'),
      label('RFI / localizacion / datos calibrados',0,-1.4,6.5),label('Ningun criterio confirma por si solo',0,-2.05,6.5,MUTED));
    return p => { const count=reveal(before,phase(p,0,.35))+map.write(phase(p,.2,.75));
      reveal(reference,phase(p,.5,.85));reveal(difference,phase(p,.65,.98));state(root,count,64+map.total,'illustrative inspection values'); };
  });
}
function featuresStage() {
  return makeStage('forest-features',(root,label) => {
    const names=['SNR','6 ms','500 pc cm^-3','f_B = .75'], normalized=[.8,.6,1,.75];
    const features=tag(vector(normalized,7,1.7,0,-.4),'features');features.userData.physicalValues=[...TOY_FEATURES];
    const labels=names.map((name,i)=>tag(label(name,((i+.5)/4-.5)*7,-.85,i===2?2.2:1.6),['snr','width','dm','occupancy'][i]));
    root.add(features,...labels,label('VECTOR ILUSTRATIVO / 4 RASGOS',0,2,5.8),
      label('Alturas graficas reescaladas, unidades conservadas',0,-1.8,7,MUTED));
    return p => { const count=writeVector(features,phase(p,.05,.9));labels.forEach((label,i)=>label.visible=i<count);
      state(root,count,4,'illustrative features'); };
  });
}
function forestStage() {
  return makeStage('forest',(root,label) => {
    const forest=toyForest(TOY_FEATURES), features=tag(vector([.8,.6,1,.75],1.5,1.25,-3.25,-.1),'features');
    const roots=[1.4,0,-1.4].map(y=>tag(box(-.75,y,.85,.5,CYAN),'tree'));
    const branches=roots.map((_,i)=>tag(line([-2.3,0,.3,-1.3,[1.4,0,-1.4][i],.3,-.35,[1.4,0,-1.4][i],.3,1,[1.4,0,-1.4][i]+.3,.3],YELLOW),'tree'));
    const votes=forest.votes.map((value,i)=>tag(label(`T${i+1}: voto ${value}`,1.65,[1.4,0,-1.4][i]+.3,2.1,CORAL),'count'));
    const aggregate=tag(vector([forest.fraction],.6,1.4,3.4,-.7),'vote');
    root.add(features,...roots,...branches,...votes,aggregate,label('REGLAS PUBLICADAS',-.75,2.05,3.5),
      label('f',-3.25,1.7,.6),label('votos / 3',3.4,1.5,1.6),label('No entrenado / no probabilidad calibrada',0,-2.15,6.8,MUTED));
    root.userData.forest=forest;root.userData.features=TOY_FEATURES;
    return p => {writeVector(features,phase(p,0,.2));let complete=0;branches.forEach((branch,i)=>{
      const local=phase(p,.15+i*.2,.35+i*.2);reveal(branch,local);votes[i].visible=local===1;roots[i].visible=p>.1+i*.2;if(local===1)complete++;});
      writeVector(aggregate,phase(p,.8,.98));state(root,complete,3,'illustrative tree votes'); };
  });
}
function classifierStage() {
  return makeStage('vit-classification',(root,label) => {
    const example=toyTransformer(TOY_CROP),crop=matrix(TOY_CROP,16,16,1.9,2,-3.25,.45);tag(crop.object,'token');
    const tokens=matrix(example.output.flat(),4,16,1.35,2,-.85,.45);tag(tokens.object,'token');
    const pool=tag(vector(example.pool,1.25,1.2,1,.0),'pool');
    const logits=tag(vector(example.logits,.7,1.25,2.5,0),'logit'),probabilities=tag(vector(example.probabilities,.7,1.4,3.75,-.3),'probability');
    root.add(crop.object,crop.cursor,tokens.object,tokens.cursor,pool,logits,probabilities,
      label('RECORTE TOY',-3.25,1.85,2.4),label('16 x 4',-.85,1.85,1.5),label('media',1,1.85,1.3),
      label('logits',2.5,1.85,1.4),label('softmax',3.75,1.85,1.5),label('Cabeza fija 4 x 2 / sin aprendizaje',0,-1.75,6));
    root.userData.example=example;root.userData.cropKind='fixed synthetic crop, no detector coordinate adapter';
    return p => { const count=crop.write(phase(p,0,.3))+tokens.write(phase(p,.25,.55))+
      writeVector(pool,phase(p,.5,.7))+writeVector(logits,phase(p,.65,.85))+writeVector(probabilities,phase(p,.8,.98));
      state(root,count,crop.total+tokens.total+8,'illustrative classifier values'); };
  });
}
function residualStage() {
  return makeStage('resnet-didactic',(root,label) => {
    const example=toyResidual(),input=tag(vector([...TOY_RESIDUAL_INPUT],2,1.15,-3,.25),'identity'),
      convolution=tag(vector(example.convolution,1.8,1.15,0,.25),'convolution'),output=tag(vector(example.output,2,1.35,3,.25),'output');
    const skip=tag(line([-1.95,.25,.3,-1.95,-1.05,.3,2,-1.05,.3,2,.25,.3],CORAL),'identity');
    const through=tag(line([-1.95,.25,.3,-1.1,.25,.3,1.1,.25,.3,2,.25,.3],CYAN),'convolution');
    root.add(input,convolution,output,skip,through,label('x / 8',-3,1.9,1.5),label('F(x) / 8',0,1.9,2),
      label('ReLU(x + F(x))',3,1.9,3),label('Kernel .25 / .5 / .25',0,2.25,3.6),label('padding cero / paso uno',0,-1.65,4.7,MUTED));
    root.userData.residual=example;
    return p => {const count=writeVector(input,phase(p,0,.25))+writeVector(convolution,phase(p,.25,.6))+writeVector(output,phase(p,.65,.98));
      reveal(through,phase(p,.2,.65));reveal(skip,phase(p,.2,.65));state(root,count,24,'illustrative residual scalar values');};
  });
}
function candidateStage() {
  return makeStage('candidate-didactic',(root,label) => {
    const proposal=tag(box(-2.45,.45,2.1,1.7,CORAL),'proposal');
    const paths=[1.1,0,-1.1].map(y=>tag(line([-.95,.45,.3,.35,y,.3,1.8,y,.3],CYAN),'inspection'));
    const boundary=tag(line([2.4,-1.4,.3,2.4,1.5,.3],YELLOW),'confirmation');
    root.add(proposal,...paths,boundary,label('PROPUESTA',-2.45,.45,2.1,CORAL),
      label('DATOS',1,1.45,1.5),label('RFI',1,.25,1),label('CONTEXTO',1,-.85,1.8),
      label('NO CONFIRMADO',3.35,.2,2.5,YELLOW),label('Sin score entrenado / evidencia independiente pendiente',0,-2.05,7.3,MUTED));
    root.userData.confirmed=false;root.userData.hasRecordedScore=false;
    return p=>{reveal(proposal,phase(p,0,.35));let complete=0;paths.forEach((path,i)=>{const local=phase(p,.2+i*.15,.5+i*.15);reveal(path,local);if(local===1)complete++;});
      reveal(boundary,phase(p,.7,.98));state(root,complete,3,'illustrative inspection branches');};
  });
}

export function createMethodStages(): Stage[] {
  return [methodsStage(),boxcarStage(),boxcarBankStage(),boxcarThresholdStage(),patchStage(),attentionStage(),proposalsStage(),
    radioStage(),featuresStage(),forestStage(),classifierStage(),residualStage(),candidateStage()];
}
