import { BufferGeometry, CanvasTexture, Color, DataTexture, DoubleSide, Float32BufferAttribute, FloatType, Group, Line,
  LineBasicMaterial, Mesh, MeshBasicMaterial, NearestFilter, Object3D, PlaneGeometry, RedFormat, ShaderMaterial,
  SRGBColorSpace, Vector3, type Texture } from 'three';
import type { Stage } from '../cinema/types';
import { getHFFixture, selectHFCandidate, type HFFixture } from './model';
import { HF_MATH } from './math';

const CYAN = '#72e2c7', CORAL = '#ff957e', YELLOW = '#f0d568', WHITE = '#eaf2ef';
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const phase = (p: number, start: number, end: number) => clamp((p - start) / (end - start));
export const HF_STAGE_IDS = HF_MATH.map(stage => stage.id);
export const HF_FOCUS_TERMS = Object.fromEntries(HF_MATH.map(stage => [stage.id, stage.terms.map(term => term.id)]));
const tag = <T extends Object3D>(object: T, ...terms: string[]) => { object.userData.focusTerms = terms; return object; };

function line(points: number[], color = CYAN) {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: .95, depthWrite: false }));
}
function rectangle(x: number, y: number, width: number, height: number, color = YELLOW) {
  return line([x-width/2,y-height/2,.4,x+width/2,y-height/2,.4,x+width/2,y+height/2,.4,
    x-width/2,y+height/2,.4,x-width/2,y-height/2,.4], color);
}
function curve(values: ArrayLike<number>, width: number, height: number, x = 0, y = 0, color = CORAL) {
  let maximum = 1e-9;
  for (let i = 0; i < values.length; i++) maximum = Math.max(maximum, Math.abs(values[i]));
  const points: number[] = [];
  for (let i = 0; i < values.length; i++) points.push(x + (i / (values.length - 1) - .5) * width, y + values[i] / maximum * height, .35);
  const object = line(points, color); object.geometry.setDrawRange(0, 0); object.userData.values = values;
  return { object, write(p: number) { const count = Math.floor(clamp(p) * values.length); object.geometry.setDrawRange(0,count); return count; } };
}

type Label = (text: string, x: number, y: number, width?: number, color?: string) => Group;
function matrix(values: Float32Array, columns: number, rows: number, width: number, height: number, textures: Texture[]) {
  const texture = new DataTexture(values, columns, rows, RedFormat, FloatType); texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true; textures.push(texture);
  let minimum = Infinity, maximum = -Infinity;
  for (const value of values) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { uValues: { value: texture }, uCount: { value: 0 }, uColumns: { value: columns }, uRows: { value: rows },
      uMinimum: { value: minimum }, uRange: { value: Math.max(1e-9,maximum-minimum) }, uTimeOrder: { value: 0 }, uFocus: { value: 0 }, uLift: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform sampler2D uValues;uniform float uMinimum,uRange,uLift;
      void main(){vUv=uv;float q=clamp((texture2D(uValues,uv).r-uMinimum)/uRange,0.,1.);vec3 p=position;
        p.z+=(q-.25)*uLift;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform sampler2D uValues;uniform float uCount,uColumns,uRows,uMinimum,uRange,uTimeOrder,uFocus;
      void main(){float col=min(uColumns-1.,floor(vUv.x*uColumns));float row=min(uRows-1.,floor(vUv.y*uRows));
      float cell=mix(row*uColumns+col,col*uRows+row,uTimeOrder);if(cell>=uCount)discard;
      float value=clamp((texture2D(uValues,(vec2(col,row)+.5)/vec2(uColumns,uRows)).r-uMinimum)/uRange,0.,1.);
      vec3 color=mix(vec3(.05,.14,.16),vec3(1.,.59,.49),value);color=mix(color,vec3(.94,.84,.41),uFocus*.28);
      gl_FragColor=vec4(color,.98);}`,
  });
  const object = new Mesh(new PlaneGeometry(width,height,Math.min(columns,128),Math.min(rows,64)), material);
  object.userData.values = values; object.userData.shape = [rows,columns];
  return { object, write(p: number, order: 'rows'|'time' = 'rows') { const count = Math.floor(clamp(p)*values.length);
    material.uniforms.uCount.value = count; material.uniforms.uTimeOrder.value = order === 'time' ? 1 : 0; return count; } };
}

function stage(id: string, fixture: HFFixture, build: (root: Group, label: Label, textures: Texture[]) => (p: number) => void): Stage {
  const root = new Group(), textures: Texture[] = []; root.name = id; root.scale.setScalar(.67);
  Object.assign(root.userData, { eventId: fixture.eventId, fixture, dmKnown: fixture.dmKnown, dmEstimated: null,
    dmResolved: false, inferenceMode: 'synthetic-classical-hf', hasRecordedScore: false, confirmed: false,
    focus: null, focusedObjects: [], construction: { completed: 0, total: 1, unit: 'HF samples' } });
  const label: Label = (text,x,y,width=3,color=WHITE) => {
    const group = new Group(); group.position.set(x,y,.5); group.name=`label:${text}`;
    if (typeof document === 'undefined') return group;
    const canvas = document.createElement('canvas'); canvas.width=1024; canvas.height=128;
    const context=canvas.getContext('2d');if(!context)return group;
    context.font='36px monospace';context.textAlign='center';context.textBaseline='middle';context.fillStyle=color;context.fillText(text,512,64);
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;textures.push(texture);
    group.add(new Mesh(new PlaneGeometry(width,width/8),new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false})));return group;
  };
  const update=build(root,label,textures), focusColor=new Color(YELLOW), baseColors=new Map<MeshBasicMaterial|LineBasicMaterial,Color>();
  const focus=()=>{
    const focused:string[]=[];
    root.traverse(object=>{
      const terms=object.userData.focusTerms as string[]|undefined;if(!terms)return;
      const active=root.userData.focus!==null&&terms.includes(root.userData.focus);object.userData.focusActive=active;
      if(active)focused.push(object.name||object.type);
      object.traverse(child=>{const material=(child as Mesh).material;
        if(material instanceof ShaderMaterial&&material.uniforms.uFocus)material.uniforms.uFocus.value=active?1:0;
        if(material instanceof MeshBasicMaterial||material instanceof LineBasicMaterial){if(!baseColors.has(material))baseColors.set(material,material.color.clone());
          material.color.copy(baseColors.get(material)!).lerp(focusColor,active?.6:0);}
      });
    });root.userData.focusedObjects=focused;
  };
  return {id,root,camera:new Vector3(0,1.6,9),target:new Vector3(),continuous:false,mobileScale:2.2,
    setFocus(term){root.userData.focus=term&&HF_FOCUS_TERMS[id].includes(term)?term:null;focus();},
    update(p){update(clamp(p));focus();},dispose(){textures.forEach(texture=>texture.dispose());}};
}
function construction(root: Group, completed: number, total: number, unit: string) {
  Object.assign(root.userData.construction,{completed,total,unit});
}

export function createHFStages(): Stage[] {
  const fixture=getHFFixture(),candidate=selectHFCandidate(fixture);
  const resolution=stage('hf-resolution',fixture,(root,label)=>{
    const cell=tag(rectangle(.8,0,5.8,2.8),'sample','ratio');
    const fronts=[0,Math.floor(fixture.channels/2),fixture.channels-1].map((channel,i)=>{
      const x=.8+fixture.delaysSeconds[channel]/fixture.dtSeconds*5.8;
      const front=tag(line([x,-.95,.5,x,.95,.5],[CORAL,CYAN,YELLOW][i]),'delay','known');root.add(front);return front;
    });
    root.add(cell,tag(label('DM conocida: 1770 pc cm^-3',0,2.4,6),'known'),
      tag(label(`Retardo: ${(fixture.delaysSeconds[0]*1e6).toFixed(2)} us`,0,-1.65,5.6,CORAL),'delay'),
      tag(label('Celda: 4.096 ms = 32 us x 128',0,-2.2,6.6),'sample'),
      tag(label(`R_search(DMmax=3000) = ${fixture.ratioAtMaximumDM.toFixed(6)} < 2`,0,1.8,7.5),'ratio','dm'));
    return p=>{cell.visible=p>.04;fronts.forEach(front=>{front.visible=p>.16;front.position.x=-5*(1-phase(p,.16,.78));});
      construction(root,Math.floor(p*3),3,'HF arrival fronts');};
  });
  const waterfall=stage('hf-matriz',fixture,(root,label,textures)=>{
    const image=matrix(fixture.waterfallRows,fixture.samples,fixture.channels,8,3.4,textures);tag(image.object,'cell','native');root.add(image.object);
    const window=tag(rectangle((candidate.timeSeconds/(fixture.samples*fixture.dtSeconds)-.5)*8,0,
      candidate.widthSamples/fixture.samples*8,3.5),'time');root.add(window,
      label('85.268 - 87.268 GHz / 32 canales',0,2.25,6.5),label('Delta I / fondo sustraido / HF sintetico',0,-2.35,7));
    return p=>{const count=image.write(phase(p,0,.95),'time');window.visible=p>.8;construction(root,count,fixture.waterfall.length,'HF intensity cells');};
  });
  const profile=stage('hf-profile',fixture,(root,label,textures)=>{
    const image=matrix(fixture.waterfallRows,fixture.samples,fixture.channels,3.4,2,textures);image.object.position.set(-2.3,.5,.1);tag(image.object,'cell');
    const values=tag(curve(fixture.integrated,4.3,1.6,2,-.85,CYAN).object,'profile');
    const weight=tag(label('w_j / suma = 1',-2.3,-1.2,3.5),'weight');
    root.add(image.object,values,weight,label('Delta I / u.a.',2,1.65,3.5),label('128 muestras / dt = 4.096 ms',0,-2.15,6.5));
    return p=>{const count=image.write(phase(p,0,.4),'time'),profileCount=Math.floor(phase(p,.3,.95)*fixture.samples);
      values.geometry.setDrawRange(0,profileCount);construction(root,count+profileCount,fixture.waterfall.length+fixture.samples,'HF integration values');};
  });
  const bank=stage('hf-boxcar',fixture,(root,label,textures)=>{
    const image=matrix(fixture.bank,fixture.samples,fixture.widthSamples.length,8,2.1,textures);image.object.position.y=.7;tag(image.object,'width','snr');
    const values=curve(fixture.snr,8,1.1,0,-2.1);tag(values.object,'best','sample');
    root.add(image.object,values.object,label('Anchura x tiempo / NO DM',0,2.25,6.5),
      label('W = 1, 2, 3, 5, 8, 15 muestras',0,-.6,6.5),label('SNR maxima / adimensional',0,-2.55,6,CORAL));
    return p=>{const count=image.write(phase(p,0,.7))+values.write(phase(p,.35,.96));construction(root,count,fixture.bank.length+fixture.samples,'HF bank responses');};
  });
  const final=stage('hf-candidato',fixture,(root,label,textures)=>{
    const image=matrix(fixture.waterfallRows,fixture.samples,fixture.channels,3.8,2,textures);image.object.position.set(-2.3,.75,.1);tag(image.object,'candidate','dm');
    const values=curve(fixture.snr,3.8,1.2,-2.3,-1.7);tag(values.object,'snr');
    const threshold=tag(line([-.2,-.7,.5,4.4,-.7,.5],YELLOW),'threshold');
    root.add(image.object,values.object,threshold,tag(label(`SNR ${candidate.snr.toFixed(2)}`,2.2,1.8,3.5,CORAL),'snr'),
      tag(label(`W = ${candidate.widthMs.toFixed(3)} ms`,2.2,1.15,4),'candidate'),tag(label('DM NO RESUELTA',2.2,.25,4,YELLOW),'dm'),
      tag(label('DM conocida: 1770',2.2,-.25,4),'dm'),tag(label('Candidato / no confirmado',0,-2.3,6.5),'candidate'));
    return p=>{const count=image.write(phase(p,0,.6),'time')+values.write(phase(p,.25,.95));threshold.visible=p>.8;
      construction(root,count,fixture.waterfall.length+fixture.samples,'HF final evidence values');};
  });
  return [resolution,waterfall,profile,bank,final];
}
