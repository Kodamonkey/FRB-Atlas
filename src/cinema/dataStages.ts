import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, DataTexture, Float32BufferAttribute,
  DoubleSide, FloatType, Group, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Line, LineBasicMaterial,
  Mesh, MeshBasicMaterial, NearestFilter, Object3D, PlaneGeometry, RedFormat, RGBAFormat, ShaderMaterial,
  SRGBColorSpace, Texture, UnsignedByteType, Vector2, Vector3,
} from 'three';
import type { EventEvidence, EvidenceArrays } from '../evidence/types';
import type { Stage } from './types';
import { GUIDED_DM_ROW } from '../story';
export { GUIDED_DM_ROW } from '../story';

const TEAL = '#72e2c7', CORAL = '#ff957e', WHITE = '#eef6f2', MUTED = '#7e929b';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const phase = (value: number, start: number, end: number) => smooth((value - start) / (end - start));

export const DATA_STAGE_IDS = ['matriz', 'bloques', 'alineacion', 'perfil', 'bowtie', 'rgb', 'backbone',
  'upsampling', 'cabezas', 'centernet', 'recorte', 'resnet', 'decision', 'candidato'] as const;
export const DATA_FOCUS_TERMS: Record<typeof DATA_STAGE_IDS[number], readonly string[]> = {
  matriz:['sample','frequency','power'], bloques:['window','context','valid'], alineacion:['dm','delay','shift'],
  perfil:['channel','exposure','mean'], bowtie:['trial','time','mean'], rgb:['range','channel','resize'],
  backbone:['kernel','product','sum'], upsampling:['stride','kernel','output'], cabezas:['center','size','offset'],
  centernet:['peak','offset','scale'], recorte:['time','dm','extent'], resnet:['convolution','residual','activation'],
  decision:['feature','logit','probability'], candidato:['score','snr','confirmation'],
};

interface ConstructionState {completed:number;total:number;column:number;row:number;completedRows:number;completedColumns:number}
export function constructionIndex(progress: number, columns: number, rows: number, order:'rows'|'time'='rows',
  state:ConstructionState={completed:0,total:0,column:0,row:0,completedRows:0,completedColumns:0}) {
  const total=columns*rows, completed=Math.floor(clamp(progress)*total), active=Math.min(Math.max(0,total-1),completed);
  state.completed=completed;state.total=total;state.column=order==='rows'?active%columns:Math.floor(active/rows);
  state.row=order==='rows'?Math.floor(active/columns):active%rows;
  state.completedRows=order==='rows'?Math.floor(completed/columns):0;state.completedColumns=order==='time'?Math.floor(completed/rows):0;
  return state;
}

export function trialProfile(evidence: EventEvidence, arrays: EvidenceArrays): Float32Array {
  const { samples, dmValues } = evidence.axes;
  if (dmValues.length <= GUIDED_DM_ROW || arrays.dmMap.length !== samples * dmValues.length) throw new RangeError('DM map shape mismatch');
  return arrays.dmMap.subarray(GUIDED_DM_ROW * samples, (GUIDED_DM_ROW + 1) * samples);
}

export function trialDelays(evidence: EventEvidence): number[] {
  const { frequenciesMHz, dmValues, dtSeconds } = evidence.axes;
  const reference = Math.max(...frequenciesMHz), dm = dmValues[GUIDED_DM_ROW];
  // Same dispersion constant and NumPy-compatible rounding as the existing science kernel.
  return frequenciesMHz.map(frequency => {
    const value = 4.148808e3 * dm * (frequency ** -2 - reference ** -2) / dtSeconds;
    const floor = Math.floor(value), fraction = value - floor;
    return fraction < .5 ? floor : fraction > .5 ? floor + 1 : floor % 2 === 0 ? floor : floor + 1;
  });
}

export function channelAccumulation(evidence:EventEvidence,arrays:EvidenceArrays) {
  const {samples,channels}=evidence.axes,delays=trialDelays(evidence);
  const values=new Float32Array(samples*channels),sums=new Float32Array(samples*(channels+1));
  const exposure=new Uint16Array(sums.length),means=new Float32Array(samples);
  for(let n=0;n<samples;n++){
    let sum=0,count=0;
    for(let channel=0;channel<channels;channel++){
      const source=n+delays[channel],valid=source>=0&&source<samples;
      const value=valid?arrays.waterfall[source*channels+channel]:0;
      values[channel*samples+n]=value;
      if(valid){sum=Math.fround(sum+value);count++;}
      const prefix=n*(channels+1)+channel+1;sums[prefix]=sum;exposure[prefix]=count;
    }
    means[n]=sum/(count||1);
  }
  return {values,sums,exposure,means,delays};
}

export function reshapeWaterfall(values: Float32Array, samples: number, channels: number): Float32Array {
  if (values.length !== samples * channels) throw new RangeError('Waterfall shape mismatch');
  const pixels = new Float32Array(values.length);
  for (let t = 0; t < samples; t++) for (let channel = 0; channel < channels; channel++) {
    pixels[channel * samples + t] = values[t * channels + channel];
  }
  return pixels;
}

export function sourceSample(evidence: EventEvidence, n: number, channel: number): number {
  return evidence.crop.startSample + n - evidence.crop.paddingLeft + evidence.crop.delaySamples[channel];
}

export function candidateMapPosition(evidence: EventEvidence, width = 8.4, height = 3.8): Vector3 {
  const { axes, candidate } = evidence;
  const dmFirst = axes.dmValues[0], dmLast = axes.dmValues[axes.dmValues.length - 1];
  return new Vector3((candidate.timeSeconds / (axes.samples * axes.dtSeconds) - .5) * width,
    ((candidate.dm - dmFirst) / Math.max(1e-9, dmLast - dmFirst) - .5) * height, .95);
}

function limits(values: ArrayLike<number>): [number, number] {
  const ordered = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return [0, 1];
  const low = ordered[Math.floor((ordered.length - 1) * .02)];
  const high = ordered[Math.floor((ordered.length - 1) * .995)];
  return [low, high > low ? high : low + 1];
}

class TextureBank {
  readonly textures: Texture[] = [];
  float(values: Float32Array | number[], width: number, height: number): DataTexture {
    if (values.length !== width * height) throw new RangeError('Texture shape mismatch');
    const texture = new DataTexture(values instanceof Float32Array ? values : Float32Array.from(values), width, height, RedFormat, FloatType);
    texture.magFilter = texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }
  rgb(values: Uint8Array, width: number, height: number): DataTexture {
    if (values.length !== width * height * 3) throw new RangeError('RGB shape mismatch');
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) { rgba.set(values.subarray(i * 3, i * 3 + 3), i * 4); rgba[i * 4 + 3] = 255; }
    const texture = new DataTexture(rgba, width, height, RGBAFormat, UnsignedByteType);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }
  dispose() { this.textures.forEach(texture => texture.dispose()); this.textures.length = 0; }
}

const fieldVertex = `
attribute float aRow;
uniform sampler2D uData;
uniform sampler2D uDelay;
uniform vec2 uShape;
uniform vec2 uSize;
uniform vec2 uRange;
uniform float uLift;
uniform float uAlign;
uniform float uSourceSpan;
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, (aRow + .5) / uShape.y);
  float value = texture2D(uData, vUv).r;
  float delay = texture2D(uDelay, vec2(vUv.y,.5)).r;
  vec3 p = position;
  p.x = ((uv.x*uShape.x + delay*(1.-uAlign))/uSourceSpan-.5)*uSize.x;
  p.y = position.y*(uSize.y/uShape.y*.91)+(vUv.y-.5)*uSize.y;
  p.z += (clamp((value-uRange.x)/(uRange.y-uRange.x),0.,1.)-.25)*uLift;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
}`;

const plotFragment = `
uniform sampler2D uData;
uniform vec2 uRange;
uniform float uReveal;
uniform float uRowReveal;
uniform float uFade;
uniform float uAlpha;
uniform vec2 uShape;
uniform float uCommitted;
uniform float uWriteOrder;
uniform float uFocus;
uniform float uFocusRow;
uniform float uFocusColumn;
varying vec2 vUv;
void main() {
  if(vUv.x>uReveal || vUv.y>uRowReveal) discard;
  vec2 cell=min(floor(vUv*uShape),uShape-1.);
  float cellIndex=uWriteOrder<.5?cell.y*uShape.x+cell.x:cell.x*uShape.y+cell.y;
  if(uCommitted>=0. && cellIndex>=uCommitted)discard;
  float value=texture2D(uData,vUv).r;
  float q=clamp((value-uRange.x)/(uRange.y-uRange.x),0.,1.);
  vec3 color=mix(vec3(.07,.10,.13),vec3(.13,.58,.49),smoothstep(.06,.60,q));
  color=mix(color,vec3(1.,.51,.39),smoothstep(.62,.90,q));
  color=mix(color,vec3(.94,1.,.90),smoothstep(.9,1.,q));
  float selected=uFocusRow>=0.?1.-step(.5,abs(cell.y-uFocusRow)):uFocusColumn>=0.?1.-step(.5,abs(cell.x-uFocusColumn)):1.;
  color=mix(color,vec3(1.,.92,.75),uFocus*.5*selected);
  gl_FragColor=vec4(color,uFade*uAlpha*(.32+.68*q));
  #include <colorspace_fragment>
}`;

function field(bank: TextureBank, values: Float32Array | number[], columns: number, rows: number,
  width: number, height: number, delays?: number[]): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const texture = bank.float(values, columns, rows);
  // Only the graphical relief is tessellated coarsely; fragment colors retain native samples.
  const base = new PlaneGeometry(1, 1, Math.min(columns, 256), 1);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(base.index!.clone());
  geometry.setAttribute('position', base.getAttribute('position').clone());
  geometry.setAttribute('uv', base.getAttribute('uv').clone());
  geometry.setAttribute('aRow', new InstancedBufferAttribute(Float32Array.from({ length: rows }, (_, row) => row), 1));
  geometry.instanceCount = rows;
  base.dispose();
  const material = new ShaderMaterial({ vertexShader: fieldVertex, fragmentShader: plotFragment,
    transparent: true, depthWrite: false, side: DoubleSide, uniforms: {
      uData: { value: texture }, uDelay: { value: bank.float(delays ?? new Float32Array(rows), rows, 1) },
      uShape: { value: new Vector2(columns, rows) }, uSize: { value: new Vector2(width, height) },
      uRange: { value: new Vector2(...limits(values)) }, uLift: { value: 0 }, uAlign: { value: 1 },
      uSourceSpan: { value: columns }, uReveal: { value: 1 }, uRowReveal: { value: 1 }, uFade: { value: 1 }, uAlpha: { value: 1 },
      uCommitted:{value:-1},uWriteOrder:{value:0},uFocus:{value:0},uFocusRow:{value:-1},uFocusColumn:{value:-1},
    } });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

const flatVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const reliefVertex = `varying vec2 vUv;uniform sampler2D uData;uniform vec2 uRange;uniform float uLift;
  void main(){vUv=uv;float q=clamp((texture2D(uData,uv).r-uRange.x)/(uRange.y-uRange.x),0.,1.);
    vec3 p=position;p.z+=(q-.25)*uLift;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
// Corner interpolation would erase the matrix: sample each fragment's source cell.
const flatFragment = `
uniform sampler2D uData;
uniform vec2 uRange;
uniform float uReveal;
uniform float uRowReveal;
uniform float uFade;
uniform float uAlpha;
uniform vec2 uShape;
uniform float uCommitted;
uniform float uWriteOrder;
uniform float uFocus;
uniform float uFocusRow;
uniform float uFocusColumn;
varying vec2 vUv;
void main() {
  if(vUv.x>uReveal || vUv.y>uRowReveal) discard;
  vec2 cell=min(floor(vUv*uShape),uShape-1.);
  float cellIndex=uWriteOrder<.5?cell.y*uShape.x+cell.x:cell.x*uShape.y+cell.y;
  if(uCommitted>=0. && cellIndex>=uCommitted)discard;
  float value=texture2D(uData,vUv).r;
  float q=clamp((value-uRange.x)/(uRange.y-uRange.x),0.,1.);
  vec3 color=mix(vec3(.07,.10,.13),vec3(.13,.58,.49),smoothstep(.06,.60,q));
  color=mix(color,vec3(1.,.51,.39),smoothstep(.62,.90,q));
  color=mix(color,vec3(.94,1.,.90),smoothstep(.9,1.,q));
  float selected=uFocusRow>=0.?1.-step(.5,abs(cell.y-uFocusRow)):uFocusColumn>=0.?1.-step(.5,abs(cell.x-uFocusColumn)):1.;
  color=mix(color,vec3(1.,.92,.75),uFocus*.5*selected);
  gl_FragColor=vec4(color,uFade*uAlpha*(.32+.68*q));
  #include <colorspace_fragment>
}`;
function flat(bank: TextureBank, values: Float32Array | number[], columns: number, rows: number, width: number, height: number) {
  const texture = bank.float(values, columns, rows);
  const material = new ShaderMaterial({ vertexShader: reliefVertex,
    fragmentShader: flatFragment, transparent: true, depthWrite: false, side: DoubleSide, uniforms: {
      uLift: { value: 0 },
      uData: { value: texture }, uRange: { value: new Vector2(...limits(values)) }, uReveal: { value: 1 }, uRowReveal: { value: 1 }, uFade: { value: 1 }, uAlpha: { value: 1 },
      uShape:{value:new Vector2(columns,rows)},uCommitted:{value:-1},uWriteOrder:{value:0},uFocus:{value:0},uFocusRow:{value:-1},uFocusColumn:{value:-1},
    } });
  // Tessellation affects only inspection relief; source-cell fragment colors stay native.
  return new Mesh(new PlaneGeometry(width, height, Math.min(columns, 128), Math.min(rows, 64)), material);
}

function line(points: number[], color = MUTED, opacity = .5) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

function flow(points: number[], color = TEAL) {
  const geometry = new BufferGeometry();
  const count = points.length / 3, distances = new Float32Array(count);
  for (let i = 1; i < count; i++) distances[i] = distances[i - 1] + Math.hypot(
    points[i * 3] - points[(i - 1) * 3], points[i * 3 + 1] - points[(i - 1) * 3 + 1], points[i * 3 + 2] - points[(i - 1) * 3 + 2]);
  const total = distances[count - 1] || 1;
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setAttribute('aPhase', new BufferAttribute(distances.map(value => value / total), 1));
  return new Line(geometry, new ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uReveal: { value: 0 }, uFade: { value: 1 }, uColor: { value: new Color(color) },uFocus:{value:0} },
    vertexShader: 'attribute float aPhase;varying float vPhase;void main(){vPhase=aPhase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uReveal;uniform float uFade;uniform float uFocus;uniform vec3 uColor;varying float vPhase;void main(){float reached=1.-step(uReveal,vPhase);gl_FragColor=vec4(mix(uColor,vec3(1.),uFocus*.6),uFade*(.12+.88*reached));}',
  }));
}

function rgbPlane(bank: TextureBank, arrays: EvidenceArrays, width: number, height = width) {
  const material = new ShaderMaterial({ vertexShader: flatVertex, transparent: true, depthWrite: false,
    uniforms: { uData: { value: bank.rgb(arrays.rgb, 512, 512) }, uReveal: { value: 0 }, uFade: { value: 1 },uCommitted:{value:-1},uFocus:{value:0} },
    fragmentShader: `uniform sampler2D uData;uniform float uReveal;uniform float uFade;uniform float uCommitted;uniform float uFocus;varying vec2 vUv;
      void main(){if(vUv.x>uReveal)discard;vec2 cell=min(floor(vUv*512.),vec2(511.));if(uCommitted>=0.&&cell.y*512.+cell.x>=uCommitted)discard;
      gl_FragColor=vec4(mix(texture2D(uData,vUv).rgb,vec3(1.),uFocus*.15),uFade);
      #include <colorspace_fragment>
      }` });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.name = 'detector-rgb-input'; mesh.userData.originalShape = [1, 3, 512, 512];
  mesh.userData.write=matrixWriter(mesh,512,512,width,height);
  return mesh;
}

function label(bank: TextureBank, text: string, x: number, y: number, width = 2, color = WHITE): Group {
  const group = new Group(); group.position.set(x, y, .9); group.name = `label:${text}`;
  group.userData.text=text;group.userData.kind='label';
  if (typeof document === 'undefined') return group;
  const canvas = document.createElement('canvas'); canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.font = '500 48px monospace';
  canvas.width = Math.ceil(context.measureText(text).width + 32);
  context.font = '500 48px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = color; context.fillText(text, canvas.width / 2, 32);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; bank.textures.push(texture);
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const nativeWidth = .23 * canvas.width / canvas.height, planeWidth = Math.min(width, nativeWidth);
  group.add(new Mesh(new PlaneGeometry(planeWidth, .23 * planeWidth / nativeWidth), material));
  return group;
}

function marker(radius = .12, color = CORAL): Group {
  const group = new Group();
  const points: number[] = [];
  for (let i = 0; i <= 48; i++) { const theta = i / 48 * Math.PI * 2; points.push(Math.cos(theta) * radius, Math.sin(theta) * radius, 0); }
  group.add(line(points, color, 1), line([-radius * 1.7, 0, 0, radius * 1.7, 0, 0], color, .7), line([0, -radius * 1.7, 0, 0, radius * 1.7, 0], color, .7));
  return group;
}

function snapshot(bank: TextureBank, evidence: EventEvidence, id: string, width: number, height: number): Mesh | null {
  const map = evidence.snapshots.find(value => value.id === id);
  if (!map) return null;
  const mesh = flat(bank, map.values, map.width, map.height, width, height);
  mesh.name = id; mesh.userData.originalShape = map.shape; mesh.userData.quantity = 'recorded activation, spatial mean, selected channel';
  mesh.userData.write=matrixWriter(mesh,map.width,map.height,width,height);
  return mesh;
}

function tag<T extends Object3D>(object:T,...terms:string[]):T { object.userData.focusTerms=terms;return object; }

function matrixWriter(mesh:Mesh<BufferGeometry,ShaderMaterial>,columns:number,rows:number,width:number,height:number,order:'rows'|'time'='rows') {
  const cursor=marker(.055,WHITE);cursor.name='write-cursor';mesh.add(cursor);
  mesh.userData.writer={columns,rows,order};const state=constructionIndex(0,columns,rows,order);
  if(mesh.material.uniforms.uWriteOrder)mesh.material.uniforms.uWriteOrder.value=order==='time'?1:0;
  mesh.userData.construction=state;
  return (progress:number)=>{
    constructionIndex(progress,columns,rows,order,state);
    mesh.material.uniforms.uCommitted.value=state.completed;
    mesh.material.uniforms.uReveal.value=1;
    if(mesh.material.uniforms.uRowReveal)mesh.material.uniforms.uRowReveal.value=1;
    cursor.position.set(((state.column+.5)/columns-.5)*width,((state.row+.5)/rows-.5)*height,1.05);
    cursor.visible=state.completed<state.total;
    return state;
  };
}

function stage(name: string, build: (root: Group, bank: TextureBank, evidence: EventEvidence, arrays: EvidenceArrays) => (p: number, seconds: number) => void): Stage {
  const root = new Group(); root.name = name; root.scale.setScalar(.67);
  const bank = new TextureBank(); let tick: (p: number, seconds: number) => void = () => {};
  root.userData.focus=null;root.userData.inferenceMode='precomputed';
  root.userData.focusedObjects=[];const focusColor=new Color(CORAL);
  const bindings:{object:Object3D;materials:(ShaderMaterial|LineBasicMaterial|MeshBasicMaterial)[]}[]=[];
  const baseColors=new Map<LineBasicMaterial|MeshBasicMaterial,Color>();
  const applyFocus=()=>{
    const term=root.userData.focus as string|null,selected=root.userData.focusedObjects as string[];selected.length=0;
    for(const binding of bindings){
      const active=term!==null&&binding.object.userData.focusTerms.includes(term);
      binding.object.userData.focusActive=active;if(active)selected.push(binding.object.name||binding.object.type);
      for(const material of binding.materials){
        if(material instanceof ShaderMaterial){
          if(material.uniforms.uFocus)material.uniforms.uFocus.value=active?1:0;
          const cell=binding.object.userData.construction;
          if(material.uniforms.uFocusRow)material.uniforms.uFocusRow.value=active&&cell&&['frequency','trial','channel','delay','shift'].includes(term!)?cell.row:-1;
          if(material.uniforms.uFocusColumn)material.uniforms.uFocusColumn.value=active&&cell&&['sample','time'].includes(term!)?cell.column:-1;
          if(material.uniforms.uFocusMode)material.uniforms.uFocusMode.value=active?term==='context'?1:term==='valid'?2:term==='exposure'?4:term==='channel'?5:3:0;
        }else material.color.copy(baseColors.get(material)!).lerp(focusColor,active ? .6 : 0);
      }
    }
    root.userData.focusedObjects=selected;
  };
  return { id: name, continuous: false, mobileScale: 2.2, root, camera: new Vector3(0, 2, 9), target: new Vector3(),
    setEvidence(evidence, arrays) {
      if (root.userData.eventId) return;
      tick = build(root, bank, evidence, arrays); root.userData.eventId = evidence.eventId;
      if(!root.userData.construction){
        const target=root.userData.constructionTarget as Object3D|undefined ?? root.children.filter(object=>object.userData.write).at(-1);
        if(target){root.userData.constructionTarget=target;root.userData.construction={completed:0,total:target.userData.construction.total,unit:'recorded tensor cells'};}
      }
      root.traverse(object=>{
        if(!object.userData.focusTerms)return;
        const materials:(ShaderMaterial|LineBasicMaterial|MeshBasicMaterial)[]=[];
        object.traverse(child=>{
          const material=(child as Mesh).material;
          if(material instanceof ShaderMaterial||material instanceof LineBasicMaterial||material instanceof MeshBasicMaterial){
            materials.push(material);if(!(material instanceof ShaderMaterial))baseColors.set(material,material.color.clone());
          }
        });
        bindings.push({object,materials});
      });
      applyFocus();
    },
    setFocus(term){const next=term&&DATA_FOCUS_TERMS[name as keyof typeof DATA_FOCUS_TERMS].includes(term)?term:null;if(root.userData.focus!==next){root.userData.focus=next;applyFocus();}},
    update(p, seconds) { tick(clamp(p), seconds);
      const target=root.userData.constructionTarget as Object3D|undefined;
      if(target)Object.assign(root.userData.construction,target.userData.construction);
      applyFocus(); }, dispose() { bank.dispose(); },
  };
}

function waterfallStage(): Stage {
  return stage('matriz', (root, bank, evidence, arrays) => {
    const { samples, channels } = evidence.axes;
    const matrix = field(bank, reshapeWaterfall(arrays.waterfall, samples, channels), samples, channels, 8.4, 3.5);
    matrix.name='observed-waterfall';tag(matrix,'sample','frequency','power');
    const write=matrixWriter(matrix,samples,channels,8.4,3.5,'time');
    const construction=root.userData.construction={...constructionIndex(0,samples,channels,'time'),unit:'intensity cells',mode:'recorded samples',timeSeconds:0};
    root.add(matrix, label(bank, 'I[n, nu]', -3.4, 2.2, 1.4), label(bank, `${channels} x ${samples}`, 3.2, 2.2, 2));
    root.add(line([-4.2,-1.95,0,4.2,-1.95,0]), label(bank, '0 s', -4, -2.2, .7), label(bank, `${(samples * evidence.axes.dtSeconds).toFixed(3)} s`, 3.7, -2.2, 1));
    const cursor = tag(line([-4.2,0,1,4.2,0,1],CORAL,.5),'frequency'); root.add(cursor);
    return p => {
      const state=write(phase(p,0,.9));
      Object.assign(construction,state);construction.timeSeconds=state.column*evidence.axes.dtSeconds;
      matrix.material.uniforms.uLift.value = .85 * phase(p, .08, .65);
      matrix.rotation.y = -.10 * phase(p, .35, 1);
      cursor.position.y=((state.row+.5)/channels-.5)*3.5;cursor.visible=state.completed<state.total;
    };
  });
}

function streamStage(): Stage {
  return stage('bloques', (root, bank, evidence, arrays) => {
    const { samples, channels } = evidence.axes;
    const texture = bank.float(reshapeWaterfall(arrays.waterfall, samples, channels), samples, channels);
    const range = new Vector2(...limits(arrays.waterfall));
    const chunks = evidence.stream.chunks.map((chunk, i) => {
      const material = new ShaderMaterial({ vertexShader: flatVertex, transparent: true, depthWrite: false, uniforms: {
        uData:{value:texture},uRange:{value:range},uFade:{value:1},uProgress:{value:0},uFocusMode:{value:0},
        uCore:{value:new Vector2(chunk.start/samples,chunk.end/samples)},uContext:{value:new Vector2(chunk.blockStart/samples,chunk.blockEnd/samples)},
      }, fragmentShader:`uniform sampler2D uData;uniform vec2 uRange;uniform vec2 uCore;uniform vec2 uContext;uniform float uFade;uniform float uProgress;uniform float uFocusMode;varying vec2 vUv;
      void main(){if(vUv.x<uContext.x||vUv.x>uContext.y||vUv.x>uProgress)discard;
      float q=clamp((texture2D(uData,vUv).r-uRange.x)/(uRange.y-uRange.x),0.,1.);
      float valid=step(uCore.x,vUv.x)*step(vUv.x,uCore.y);
      vec3 color=mix(vec3(.24,.26,.36),mix(vec3(.12,.55,.46),vec3(1.,.65,.48),q),valid);
      float focused=uFocusMode<.5?0.:uFocusMode<1.5?1.-valid:uFocusMode<2.5?valid:1.;color=mix(color,vec3(1.,.9,.7),focused*.5);
      gl_FragColor=vec4(color,uFade*mix(.28,.92,valid));#include <colorspace_fragment>}`.replace(';#include', ';\n#include') });
      const mesh = tag(new Mesh(new PlaneGeometry(8.4,.64),material),'window','context','valid');mesh.name=`stream-window-${i}`; mesh.position.y = 1.3-i*.86;
      root.add(mesh, label(bank, String(i+1).padStart(2,'0'), -4.7, mesh.position.y, .45));
      const x0=(chunk.start/samples-.5)*8.4,x1=(chunk.end/samples-.5)*8.4;
      root.add(line([x0,mesh.position.y-.32,.2,x0,mesh.position.y+.32,.2],TEAL,.8),line([x1,mesh.position.y-.32,.2,x1,mesh.position.y+.32,.2],TEAL,.8));
      return mesh;
    });
    root.add(label(bank, 'NUCLEO', -2.8, 2.3, 1.3, TEAL),label(bank, `CONTEXTO ${evidence.stream.contextSamples} n`, 2.1, 2.3, 3, MUTED));
    const pointer = line([0,-2,1,0,1.8,1],CORAL,.9); root.add(pointer);
    const construction=root.userData.construction={completed:0,total:samples,unit:'time samples',context:evidence.stream.contextSamples};
    return p => { const completed=Math.floor(phase(p,0,.9)*samples),q=completed/samples;
      chunks.forEach(mesh=>{mesh.material.uniforms.uProgress.value=q;});pointer.position.x=(q-.5)*8.4;
      construction.completed=completed;
    };
  });
}

function alignmentStage(): Stage {
  return stage('alineacion', (root, bank, evidence, arrays) => {
    const { samples, channels, dtSeconds, dmValues } = evidence.axes;
    const delays = trialDelays(evidence), maximumDelay = Math.max(...delays);
    const strips = field(bank, reshapeWaterfall(arrays.waterfall, samples, channels), samples, channels, 8.4, 3.4, delays);
    strips.name='guided-channel-shifts';tag(strips,'dm','delay','shift');
    // This guided trial shifts the complete observation, not a future candidate crop.
    strips.material.vertexShader = fieldVertex.replace('varying vec2 vUv;', 'varying vec2 vUv;varying float vDelay;')
      .replace('vec3 p = position;', 'float rowAlign=clamp(uAlign*uShape.y-aRow,0.,1.);vDelay=delay*rowAlign;vec3 p = position;')
      .replace('uv.x*uShape.x + delay*(1.-uAlign)', 'uv.x*uShape.x - vDelay');
    strips.material.fragmentShader = plotFragment.replace('varying vec2 vUv;', 'varying vec2 vUv;varying float vDelay;uniform float uSourceSpan;')
      .replace('float value=texture2D', 'float sampleIndex=vUv.x*uShape.x-vDelay;if(sampleIndex<0.||sampleIndex>=uSourceSpan)discard;float value=texture2D');
    root.add(strips, label(bank, `HIPOTESIS DM ${dmValues[GUIDED_DM_ROW].toFixed(2)}`, 0, 2.4, 3.8));
    const rawTimes = new Group(), alignedTimes = new Group();
    rawTimes.add(label(bank, '0 s', -3.9, -2.15, .8), label(bank, `${(samples * dtSeconds).toFixed(3)} s`, 3.65, -2.15, 1.2));
    alignedTimes.add(label(bank, '0 s', -3.9, -2.15, .8), label(bank, `${((samples - maximumDelay) * dtSeconds).toFixed(3)} s`, 3.65, -2.15, 1.2));
    root.add(rawTimes, alignedTimes, label(bank, '64 retardos / region valida', 0, -2.6, 4, MUTED));
    const construction=root.userData.construction={completed:0,total:channels,unit:'channel shifts',row:0,delaySamples:delays[0],dm:dmValues[GUIDED_DM_ROW]};
    const cell=strips.userData.construction={row:0,column:0};
    return p => {
      const completed=Math.floor(phase(p,.08,.86)*channels),alignment=completed/channels;
      strips.material.uniforms.uAlign.value = alignment;
      strips.material.uniforms.uSourceSpan.value = samples - maximumDelay * alignment;
      strips.material.uniforms.uLift.value = .25 * phase(p, .12, .82);
      rawTimes.scale.setScalar(Math.max(.001, 1 - phase(p, .08, .16)));
      alignedTimes.scale.setScalar(Math.max(.001, phase(p, .86, .94)));
      const row=Math.min(channels-1,completed);cell.row=row;cell.column=Math.min(samples-1,delays[row]);
      construction.completed=completed;construction.row=row;construction.delaySamples=delays[row];
    };
  });
}

function profileLine(values: Float32Array, width: number, height: number, color = CORAL) {
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const positions: number[] = [];
  values.forEach((value, n) => positions.push((n / Math.max(1, values.length - 1) - .5) * width,
    (value - minimum) / Math.max(1e-9, maximum - minimum) * height, .45));
  const curve = flow(positions, color);
  curve.geometry.setAttribute('aIndex',new Float32BufferAttribute(Array.from({length:values.length},(_,n)=>n),1));
  curve.material.uniforms.uCommitCount={value:values.length};
  curve.material.vertexShader=curve.material.vertexShader.replace('attribute float aPhase;','attribute float aPhase;attribute float aIndex;varying float vIndex;')
    .replace('vPhase=aPhase;','vPhase=aPhase;vIndex=aIndex;');
  curve.material.fragmentShader=curve.material.fragmentShader.replace('uniform float uReveal;','uniform float uReveal;uniform float uCommitCount;varying float vIndex;')
    .replace('float reached=', 'if(vIndex>uCommitCount-1.)discard;float reached=');
  curve.name = 'recorded-profile'; curve.userData.values = values;
  curve.userData.range = [minimum, maximum];
  return curve;
}

function channelRail(bank:TextureBank,values:Float32Array,samples:number,channels:number,delays:number[]) {
  const geometry=new InstancedBufferGeometry(),base=new PlaneGeometry(1,1);
  geometry.setIndex(base.index!.clone());geometry.setAttribute('position',base.getAttribute('position').clone());
  geometry.setAttribute('aChannel',new InstancedBufferAttribute(Float32Array.from({length:channels},(_,channel)=>channel),1));
  geometry.instanceCount=channels;base.dispose();
  const material=new ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uData:{value:bank.float(values,samples,channels)},uShape:{value:new Vector2(samples,channels)},
      uDelay:{value:bank.float(delays,channels,1)},uRange:{value:new Vector2(...limits(values))},uSample:{value:0},uProcessed:{value:0},uFade:{value:1},uFocus:{value:0},uFocusMode:{value:0}},
    vertexShader:`attribute float aChannel;uniform sampler2D uData;uniform sampler2D uDelay;uniform vec2 uShape;uniform vec2 uRange;uniform float uSample;
      varying float vChannel;varying float vValue;varying float vValid;void main(){vChannel=aChannel;vValue=texture2D(uData,vec2((uSample+.5)/uShape.x,(aChannel+.5)/uShape.y)).r;
      float source=uSample+texture2D(uDelay,vec2((aChannel+.5)/uShape.y,.5)).r;vValid=step(0.,source)*step(source,uShape.x-1.);
      float height=.1+.45*clamp((vValue-uRange.x)/(uRange.y-uRange.x),0.,1.);vec3 p=position;
      p.x=p.x*8.4/uShape.y*.7+((aChannel+.5)/uShape.y-.5)*8.4;p.y=(p.y+.5)*height;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float uProcessed;uniform float uFade;uniform float uFocus;uniform float uFocusMode;varying float vChannel;varying float vValue;varying float vValid;
      void main(){float done=1.-step(uProcessed,vChannel);vec3 color=mix(vec3(.25,.35,.38),vec3(.45,.89,.76),done);
      float currentChannel=1.-step(.5,abs(vChannel-uProcessed));float focused=uFocusMode>3.5&&uFocusMode<4.5?vValid:currentChannel;
      gl_FragColor=vec4(mix(color,vec3(1.,.7,.5),focused*uFocus),uFade*mix(.12,.25+.75*done,vValid));}`,
  });
  const rail=tag(new Mesh(geometry,material),'channel','exposure');rail.name='channel-accumulation';rail.position.set(0,1.05,.6);rail.frustumCulled=false;
  return rail;
}

function profileStage(): Stage {
  return stage('perfil', (root, bank, evidence, arrays) => {
    const values = trialProfile(evidence, arrays), { samples, dmValues, dtSeconds } = evidence.axes;
    const cache=channelAccumulation(evidence,arrays),channels=evidence.axes.channels;
    const rail=channelRail(bank,cache.values,samples,channels,cache.delays);
    const slice = tag(flat(bank, values, samples, 1, 8.4, .3),'mean'); slice.position.set(0, 1.8, .1);
    const curve = tag(profileLine(values, 8.4, 2.5),'mean'); curve.position.y = -1.65;
    const cursor=tag(line([0,-1.65,.85,0,.85,.85],WHITE,.8),'mean');cursor.name='profile-write-cursor';
    root.add(slice, curve,rail,cursor, line([-4.2, -1.65, .3, 4.2, -1.65, .3]),
      label(bank, `DM ${dmValues[GUIDED_DM_ROW].toFixed(2)} / fila ${GUIDED_DM_ROW}`, 0, 2.4, 3.7),
      label(bank, 'INTENSIDAD MEDIA EXPUESTA', 0, -2.55, 4, TEAL),
      label(bank, '0 s', -3.95, -2.02, .75), label(bank, `${((samples - 1) * dtSeconds).toFixed(3)} s`, 3.7, -2.02, 1.2));
    const state=constructionIndex(0,channels,samples);
    const construction=root.userData.construction={completed:0,total:state.total,unit:'channel additions',sample:0,channel:0,sum:0,exposure:0,committedSamples:0,meanRecorded:values[0],mode:'replay of recorded mean'};
    return p => {
      constructionIndex(phase(p,0,.96),channels,samples,'rows',state);const processed=state.completed===state.total?channels:state.column;
      const prefix=state.row*(channels+1)+processed;
      rail.material.uniforms.uSample.value=state.row;rail.material.uniforms.uProcessed.value=processed;
      slice.material.uniforms.uCommitted.value=state.completedRows;slice.material.uniforms.uReveal.value=1;
      curve.material.uniforms.uCommitCount.value=state.completedRows;curve.material.uniforms.uReveal.value=1;
      cursor.position.x=(state.row/Math.max(1,samples-1)-.5)*8.4;cursor.visible=state.completed<state.total;
      construction.completed=state.completed;construction.sample=state.row;construction.channel=processed;construction.sum=cache.sums[prefix];
      construction.exposure=cache.exposure[prefix];construction.committedSamples=state.completedRows;construction.meanRecorded=values[state.row];
    };
  });
}

function dmStage(): Stage {
  return stage('bowtie', (root, bank, evidence, arrays) => {
    const {samples,dmValues}=evidence.axes;
    const map = field(bank,arrays.dmMap,samples,dmValues.length,8.4,3.8); root.add(map);
    map.name='physical-dm-map';tag(map,'trial','time','mean');const write=matrixWriter(map,samples,dmValues.length,8.4,3.8);
    const trial = line([-4.2,0,.9,4.2,0,.9], CORAL, .7);
    trial.position.y = (GUIDED_DM_ROW / Math.max(1,dmValues.length-1) - .5) * 3.8; root.add(trial);
    root.add(label(bank,'DM - tiempo',-2.95,2.55,2.3),label(bank,'Media fisica',2.9,2.55,2));
    root.add(label(bank,`${dmValues[0].toFixed(0)}`, -4.75,-1.9,.75),label(bank,`${dmValues.at(-1)!.toFixed(0)}`, -4.75,1.9,.75));
    const construction=root.userData.construction={...constructionIndex(0,samples,dmValues.length),unit:'DM/time cells',dm:0,timeSeconds:0,mean:0,mode:'recorded trials'};
    return p => {
      const state=write(phase(p,0,.96));Object.assign(construction,state);construction.dm=dmValues[state.row];
      construction.timeSeconds=state.column*evidence.axes.dtSeconds;construction.mean=arrays.dmMap[state.row*samples+state.column];
      map.material.uniforms.uLift.value=.7*phase(p,.1,.7);
      trial.scale.x = .01 + .99 * phase(p, .5, .95);
      map.rotation.x = -.1*phase(p,.15,.8);
    };
  });
}

function rgbStage(): Stage {
  return stage('rgb', (root, bank, evidence, arrays) => {
    const physical = flat(bank, arrays.dmMap, evidence.axes.samples, evidence.axes.dmValues.length, 3.1, 2.8);
    tag(physical,'range');physical.name='input-range';
    physical.position.set(-2.7, .15, .15);
    const rgb = rgbPlane(bank, arrays, 2.8); rgb.position.set(2.6, .15, .2);
    tag(rgb,'channel','resize');
    const connection = flow([-1.05,.15,.4,1.15,.15,.4]);
    root.add(physical, rgb, connection, label(bank, 'MEDIA FISICA', -2.7, 2, 2.2),
      label(bank, 'mako / resize', 0, 1.05, 2.1, TEAL), label(bank, 'RGB 3 x 512 x 512', 2.6, 2, 2.6),
      label(bank, 'RGB / una imagen', 0, -2.2, 2.5, MUTED));
    return p => { connection.material.uniforms.uReveal.value = phase(p, .05, .6);rgb.userData.write(phase(p,.35,.95)); };
  });
}

function operator(bank: TextureBank, name: string, shape: string, x: number, y = .2, width = .88) {
  const group = new Group(); group.position.set(x,y,.2); group.userData.quantity = 'architecture, not activation';
  group.name = `operator-${name}`;
  group.add(line([-width/2,-.45,0,width/2,-.45,0,width/2,.45,0,-width/2,.45,0,-width/2,-.45,0],TEAL,.65),
    label(bank, name, 0, .85, width+ .25), label(bank, shape, 0, -.85, width+ .35, MUTED));
  return group;
}

function revealSnapshot(mesh: Mesh | null, value: number) {
  if(mesh)mesh.userData.write(value);
}

function backboneStage(): Stage {
  return stage('backbone', (root, bank, evidence, arrays) => {
    const rgb = rgbPlane(bank, arrays, 1.4); rgb.position.set(-3.9,.2,.2);
    const conv = snapshot(bank,evidence,'detector-base_model-0-1',1.25,1.25);
    if(conv){conv.position.set(-2.25,.2,.2);tag(conv,'kernel','sum');root.add(conv);root.userData.constructionTarget=conv;}
    const xs = [-.6,.8,2.2,3.6], shapes = ['64 x 128^2','128 x 64^2','256 x 32^2','512 x 16^2'];
    const links = [[-3.15,-2.93],[-1.58,-1.06],[-.13,.34],[1.27,1.74],[2.67,3.14]].map(([x0,x1]) => flow([x0,.2,.2,x1,.2,.2]));
    links.forEach(link=>tag(link,'product','sum'));tag(rgb,'product');
    root.add(rgb, ...links, ...xs.map((x,i) => operator(bank,`layer${i+1}`,shapes[i],x)),
      label(bank, 'RGB', -3.9,1.5,1.1),label(bank,'Conv 7x7',-2.25,1.5,1.8),
      label(bank,'ResNet18 / arquitectura',1.5,2.3,3.7),
      label(bank,'Conv / canal 0',-2,-2,2.3,MUTED));
    return p => {rgb.userData.write(phase(p,0,.2));revealSnapshot(conv,phase(p,.08,.4));links.forEach((link,i)=>{link.material.uniforms.uReveal.value=phase(p,.08+i*.13,.35+i*.13);});};
  });
}

function upsamplingStage(): Stage {
  return stage('upsampling', (root,bank,evidence) => {
    const xs=[-3.7,-1.9,-.1], shapes=['512 x 32^2','256 x 64^2','256 x 128^2'];
    const links=xs.map(x=>flow([x+.55,.2,.2,x+1.2,.2,.2]));
    const up=snapshot(bank,evidence,'detector-up3-1',2.1,2.1);
    if(up){up.position.set(3,.2,.3);tag(up,'output');root.add(up);}
    root.add(...xs.map((x,i)=>tag(operator(bank,`up${i+1} x2`,shapes[i],x,.2,1.2),'stride','kernel')),...links,
      label(bank,'512 x 16^2',-3.7,2.2,2), label(bank,'SALIDA up3',3,1.85,2),
      label(bank,'Bilinear / Conv / BN / ReLU',-1.7,-2,3.7,MUTED),label(bank,'Canal 0 / media',3,-1.45,2.3,MUTED));
    return p=>{links.forEach((link,i)=>{link.material.uniforms.uReveal.value=phase(p,i*.19,.35+i*.19);});revealSnapshot(up,phase(p,.5,.97));};
  });
}

function headsStage(): Stage {
  return stage('cabezas',(root,bank,evidence)=>{
    const up=snapshot(bank,evidence,'detector-up3-1',2.15,2.15),heat=snapshot(bank,evidence,'detector-sigmoid',1.45,1.45);
    if(up){up.position.set(-3,.1,.2);root.add(up);}if(heat){heat.position.set(2.65,1.05,.2);tag(heat,'center');root.add(heat);}
    const branches=[1.05,-.55,-1.8].map(y=>flow([-1.9,.1,.3,-.75,.1,.3,-.75,y,.3,1.7,y,.3]));
    branches.forEach((branch,i)=>tag(branch,['center','size','offset'][i]));
    const decode=evidence.candidate.decode;
    root.add(...branches,label(bank,'up3 / 256 x 128^2',-3,1.8,2.7),label(bank,'H / sigmoid',2.65,2.15,1.9),
      tag(label(bank,'WH / 2 x 128^2',2.6,-.25,2.5,TEAL),'size'), tag(label(bank,decode?decode.size.map(v=>v.toFixed(2)).join(' / '):'sin traza',2.6,-.65,2.5),'size'),
      tag(label(bank,'offset / 2 x 128^2',2.6,-1.45,2.8,TEAL),'offset'),tag(label(bank,decode?decode.offset.map(v=>v.toFixed(3)).join(' / '):'sin traza',2.6,-1.85,2.5),'offset'),
      label(bank,'WH / offset en el pico',-1.2,-2.65,3.2,MUTED));
    return p=>{revealSnapshot(up,phase(p,0,.2));revealSnapshot(heat,phase(p,.22,.55));branches.forEach((branch,i)=>{branch.material.uniforms.uReveal.value=phase(p,.1+i*.22,.5+i*.22);});};
  });
}

function centerNetStage(): Stage {
  return stage('centernet',(root,bank,evidence)=>{
    const heat=snapshot(bank,evidence,'detector-sigmoid',2.8,2.8);
    if(heat){heat.position.set(-2.7,.2,.2);tag(heat,'peak');root.add(heat);}
    const decode=evidence.candidate.decode, chosen=tag(new Group(),'scale'); chosen.name='decoded-candidate';root.add(chosen);
    const position=(x:number,y:number):[number,number,number]=>[(x/(decode?.imgSize??512)-.5)*2.8-2.7,(y/(decode?.imgSize??512)-.5)*2.8+.2,.8];
    let center:Group|null=null;
    if(decode){
      const [x0,y0,x1,y1]=decode.boxCNN;
      chosen.add(line([...position(x0,y0),...position(x1,y0),...position(x1,y1),...position(x0,y1),...position(x0,y0)],CORAL,.95));
      center=tag(marker(.09),'peak','offset');center.name='decoded-center';root.add(center);
    }
    const connection=flow([-1.2,.2,.3,1.2,.2,.3],CORAL);
    root.add(connection,label(bank,'H / resumen real',-2.7,2,2.5),label(bank,'DECODE / NMS',2.6,2,2.4),
      label(bank,`DM ${evidence.candidate.dm.toFixed(4)}`,2.6,1,2.7),label(bank,`t ${evidence.candidate.timeSeconds.toFixed(6)} s`,2.6,.25,2.9),
      label(bank,`score ${evidence.candidate.score.toFixed(4)}`,2.6,-.5,2.6,CORAL),
      label(bank,'Caja retenida / NMS',1.6,-1.65,3,MUTED),label(bank,'WH + offset -> caja',-2.1,-2.15,2.8,MUTED));
    chosen.userData.boxCNN=decode?.boxCNN;
    return p=>{revealSnapshot(heat,phase(p,0,.3));chosen.scale.setScalar(.001+.999*phase(p,.4,.75));connection.material.uniforms.uReveal.value=phase(p,.45,.93);
      if(center&&decode){const q=phase(p,.24,.48),x=(decode.peak[1]+decode.offset[0]*q)*decode.imgSize/decode.mapSize,y=(decode.peak[0]+decode.offset[1]*q)*decode.imgSize/decode.mapSize;center.position.set(...position(x,y));center.scale.setScalar(.001+.999*phase(p,.22,.5));}
    };
  });
}

function cropStage(): Stage {
  return stage('recorte',(root,bank,evidence,arrays)=>{
    const {samples,channels,dtSeconds}=evidence.axes,length=arrays.originalCrop.length/channels;
    const raw=flat(bank,reshapeWaterfall(arrays.waterfall,samples,channels),samples,channels,3.4,2.3);raw.position.set(-2.65,.2,.2);
    const crop=flat(bank,reshapeWaterfall(arrays.originalCrop,length,channels),length,channels,3.3,1.3);crop.position.set(2.6,.2,.2);
    tag(crop,'time','dm','extent');const write=matrixWriter(crop,length,channels,3.3,1.3);
    crop.name='original-candidate-crop';crop.userData.originalShape=[length,channels];
    const boundaries=[0,length-1].map(n=>{const positions:number[]=[];
      for(let c=0;c<channels;c++)positions.push((sourceSample(evidence,n,c)/samples-.5)*3.4-2.65,((c+.5)/channels-.5)*2.3+.2,.8);
      return tag(flow(positions,CORAL),'extent');});
    const connection=flow([-.85,.2,.3,.85,.2,.3],CORAL);
    root.add(raw,crop,...boundaries,connection,label(bank,'OBSERVACION',-2.65,1.9,2.4),label(bank,'512 x 64 / ORIGINAL',2.6,1.45,3),
      label(bank,`DM ${evidence.candidate.dm.toFixed(4)}`,2.6,-1.05,2.6),label(bank,`${(evidence.crop.startSample*dtSeconds).toFixed(3)} - ${((evidence.crop.startSample+length-1)*dtSeconds).toFixed(3)} s`,2.6,-1.65,2.6),
      label(bank,'Recorte dedispersado',-1.1,-2.4,3,MUTED));
    const construction=root.userData.construction={...constructionIndex(0,length,channels),unit:'crop intensity cells',dm:evidence.candidate.dm};
    return p=>{boundaries.forEach(boundary=>{boundary.material.uniforms.uReveal.value=phase(p,.1,.5);});connection.material.uniforms.uReveal.value=phase(p,.3,.65);
      Object.assign(construction,write(phase(p,.45,.97)));};
  });
}

function featureBars(values: number[], width: number, height: number): InstancedMesh {
  const material=new MeshBasicMaterial({color:WHITE,transparent:true,opacity:.88,depthWrite:false});
  const bars=new InstancedMesh(new BoxGeometry(1,1,.06),material,values.length);
  const maximum=Math.max(1e-9,...values.map(Math.abs)); const transform=new Group();
  values.forEach((value,index)=>{
    const h=Math.max(.005,Math.abs(value)/maximum*height);
    transform.position.set((index/Math.max(1,values.length-1)-.5)*width,Math.sign(value)*h/2,0);
    transform.scale.set(width/Math.max(1,values.length)*.82,h,1);transform.updateMatrix();bars.setMatrixAt(index,transform.matrix);
    bars.setColorAt(index,new Color().set(TEAL).lerp(new Color(CORAL),Math.abs(value)/maximum));
  });
  bars.instanceMatrix.needsUpdate=true;if(bars.instanceColor)bars.instanceColor.needsUpdate=true;
  return bars;
}

function resnetStage(): Stage {
  return stage('resnet', (root,bank,evidence,arrays)=>{
    const n=arrays.originalCrop.length/evidence.axes.channels;
    const original=flat(bank,reshapeWaterfall(arrays.originalCrop,n,evidence.axes.channels),n,evidence.axes.channels,2.05,.95);
    const prepared=flat(bank,reshapeWaterfall(arrays.preparedCrop,n,evidence.axes.channels),n,evidence.axes.channels,2.05,.95);
    tag(prepared,'activation');const writePrepared=matrixWriter(prepared,n,evidence.axes.channels,2.05,.95);
    original.position.set(-3.65,.5,.2);prepared.position.set(-3.65,.5,.3);original.name='classifier-original';prepared.name='classifier-prepared';root.add(original,prepared);
    const conv=snapshot(bank,evidence,'classifier-base_model-conv1-1',1.1,1.45);if(conv){conv.position.set(-1.4,.5,.3);tag(conv,'convolution');root.add(conv);}
    const deep=snapshot(bank,evidence,'classifier-base_model-layer4-1',.2,1.6);if(deep){deep.position.set(3.5,.5,.3);tag(deep,'activation');root.add(deep);}
    const inputFlow=flow([-2.6,.5,.25,-2,.5,.25]);
    const blockFlow=flow([-.8,.5,.25,-.15,.5,.25,2.5,.5,.25,3.25,.5,.25]);
    const residual=tag(flow([.05,.5,.25,.05,-.7,.25,2.35,-.7,.25,2.35,.5,.25],CORAL),'residual');residual.name='residual-addition';
    root.add(inputFlow,blockFlow,residual,operator(bank,'F(x)','64 x 128 x 16',1.2,.5,1.7),
      label(bank,'512 x 64',-3.65,1.7,2),label(bank,'normalizacion',-3.65,-.35,2.2,MUTED),
      label(bank,'Conv / BN / ReLU',-1.4,1.7,2.2),label(bank,'x + F(x)',1.2,2.15,2.1,CORAL),
      label(bank,'512 x 16 x 2',3.5,1.7,2.3),label(bank,'BasicBlock / formas identicas',1.2,-1.2,3.7),
      label(bank,'pool',-.4,1.2,.7,MUTED),label(bank,'layer2-4',2.85,-.05,1.3,MUTED));
    return p=>{
      original.material.uniforms.uAlpha.value=1-phase(p,.03,.28);
      prepared.material.uniforms.uAlpha.value=phase(p,.03,.28);
      writePrepared(phase(p,.03,.28));
      revealSnapshot(conv,phase(p,.2,.5));revealSnapshot(deep,phase(p,.58,.96));
      inputFlow.material.uniforms.uReveal.value=phase(p,.16,.42);blockFlow.material.uniforms.uReveal.value=phase(p,.35,.85);residual.material.uniforms.uReveal.value=phase(p,.35,.92);
    };
  });
}

function decisionStage(): Stage {
  return stage('decision',(root,bank,evidence)=>{
    const gap=evidence.snapshots.find(value=>value.id==='classifier-gap-vector');
    let features:InstancedMesh|null=null;
    if(gap&&gap.values.length===512){features=tag(featureBars(gap.values,2.6,1.6),'feature');features.position.set(-3,.0,.35);features.name=gap.id;features.userData.values=gap.values;root.add(features);}
    const logits=featureBars(evidence.inference.logits,1.1,1.35);logits.position.set(.2,0,.35);logits.name='classifier-logits';logits.userData.values=evidence.inference.logits;
    const probabilities=featureBars(evidence.inference.probabilities,1.1,1.8);probabilities.position.set(3.35,-.55,.35);probabilities.name='classifier-softmax';probabilities.userData.values=evidence.inference.probabilities;
    tag(logits,'logit');tag(probabilities,'probability');
    const first=flow([-1.55,.3,.25,-.55,.3,.25]),second=flow([.95,.3,.25,2.65,.3,.25],CORAL);
    root.add(logits,probabilities,first,second,line([-.65,0,.2,1.05,0,.2]),line([2.55,-.55,.2,4.15,-.55,.2]),
      label(bank,'GAP / 512 valores',-3,2.25,2.8),label(bank,'Linear(512,2)',.2,2.25,2.5),label(bank,'softmax',3.35,2.25,2),
      label(bank,evidence.inference.logits.map(v=>v.toFixed(3)).join(' / '),.2,-1.85,2.7),
      label(bank,`p0 ${evidence.inference.probabilities[0].toExponential(2)}`,3.3,-1.45,2.5),
      label(bank,`p1 ${evidence.inference.probabilities[1].toFixed(4)}`,3.3,-1.95,2.5,CORAL),
      label(bank,'Salida del modelo',0,-2.6,2.5,MUTED));
    const construction=root.userData.construction={completed:0,total:(features?.count??0)+4,unit:'recorded scalar outputs'};
    return p=>{if(features)features.count=Math.floor(512*phase(p,0,.4));first.material.uniforms.uReveal.value=phase(p,.2,.58);
      logits.count=Math.floor(2*phase(p,.35,.7));second.material.uniforms.uReveal.value=phase(p,.55,.85);probabilities.count=Math.floor(2*phase(p,.7,.98));
      construction.completed=(features?.count??0)+logits.count+probabilities.count;};
  });
}

function candidateStage(): Stage {
  return stage('candidato',(root,bank,evidence,arrays)=>{
    const length=arrays.originalCrop.length/evidence.axes.channels;
    const crop=flat(bank,reshapeWaterfall(arrays.originalCrop,length,evidence.axes.channels),length,evidence.axes.channels,3.1,1);
    crop.position.set(-2.8,.9,.2);crop.name='candidate-original-crop';
    const write=matrixWriter(crop,length,evidence.axes.channels,3.1,1);
    const profile=tag(profileLine(arrays.profile,3.1,1.4),'snr');profile.position.set(-2.8,-1.25,.15);profile.name='candidate-snr-profile';
    const localCenter=evidence.crop.candidateSample-evidence.crop.startSample+evidence.crop.paddingLeft;
    const maximum=Math.max(...arrays.profile),peak=arrays.profile.indexOf(maximum);
    const peakMarker=marker(.085);peakMarker.position.set(-2.8+(peak/(length-1)-.5)*3.1,.15,.9);
    peakMarker.name='snr-maximum';peakMarker.userData.sampleIndex=peak;
    const centerLine=line([0,.38,.8,0,1.42,.8],CORAL,.8);centerLine.position.x=-2.8+(localCenter/(length-1)-.5)*3.1;
    centerLine.name='detector-crop-center';centerLine.userData.sampleIndex=localCenter;
    const connection=flow([-1.05,.9,.25,.8,.9,.25],CORAL);
    root.add(crop,profile,peakMarker,centerLine,connection,label(bank,'CANDIDATO RETENIDO',2.7,2.1,3.2,CORAL),
      label(bank,`DM ${evidence.candidate.dm.toFixed(4)}`,2.7,1.25,2.9),label(bank,`t ${evidence.candidate.timeSeconds.toFixed(6)} s`,2.7,.55,3.1),
      label(bank,`SNR ${evidence.candidate.snr.toFixed(4)}`,2.7,-.15,2.8),label(bank,`ancho ${evidence.candidate.widthMs.toFixed(1)} ms`,2.7,-.85,2.8),
      tag(label(bank,`score ${evidence.candidate.score.toFixed(4)}`,2.7,-1.55,2.8),'score'),label(bank,'512 x 64',-2.8,1.85,2),
      label(bank,`SNR: n ${peak} / ${((evidence.crop.startSample+peak)*evidence.axes.dtSeconds).toFixed(3)} s`,-2.8,-1.85,3.5,CORAL),
      tag(label(bank,'Candidato / no confirmacion',0,-2.6,3.6,MUTED),'confirmation'));
    const construction=root.userData.construction={completed:0,total:arrays.originalCrop.length+length,unit:'recorded candidate values'};
    return p=>{const state=write(phase(p,0,.3)),committed=Math.floor(length*phase(p,.15,.72));
      profile.material.uniforms.uReveal.value=1;profile.material.uniforms.uCommitCount.value=committed;construction.completed=state.completed+committed;
      peakMarker.scale.setScalar(.001+.999*phase(p,.65,.85));connection.material.uniforms.uReveal.value=phase(p,.4,.97);};
  });
}

export function createDataStages(): Stage[] {
  return [waterfallStage(),streamStage(),alignmentStage(),profileStage(),dmStage(),rgbStage(),backboneStage(),
    upsamplingStage(),headsStage(),centerNetStage(),cropStage(),resnetStage(),decisionStage(),candidateStage()];
}
