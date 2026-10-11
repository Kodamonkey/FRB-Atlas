import * as THREE from 'three';
import { dispersionDelaySeconds } from '../science/physics';
import type { EventEvidence, EvidenceArrays } from '../evidence/types';
import type { Stage } from './types';
import { formulaSprite } from './formulaSprite';
import { ARECIBO, CHAJNANTOR, areciboReflectorHeight, createAreciboObservatory, createChajnantorTerrain } from './observatory';
import { channelCentre, effectiveDt, type ObservationCase } from '../observations';

const BAND = ['#eb6a88', '#ed9e66', '#e5ce79', '#70d1b9', '#77c2e7', '#a6a0dd'];
export const PHYSICAL_STAGE_IDS = ['faro', 'pulso', 'vuelo', 'plasma', 'antenas', 'fase', 'suma', 'receptor', 'fft', 'potencia'] as const;
export interface PhysicalStageOptions { propagationDm?: number; incomingDm?: number; observation?: ObservationCase }
export const PHYSICAL_FOCUS_TERMS = {
  faro: ['rotation', 'field'], pulso: ['field', 'envelope', 'intensity'], vuelo: ['distance', 'speed', 'time'],
  plasma: ['density', 'path', 'dm', 'frequency', 'delay'], antenas: ['baseline', 'direction', 'delay'],
  fase: ['voltage', 'product', 'average', 'visibility'], suma: ['voltage', 'phase', 'power'],
  receptor: ['voltage', 'code', 'bits'], fft: ['window', 'frequency', 'amplitude'], potencia: ['amplitude', 'power', 'average'],
} as const;
type PhysicalStageId = typeof PHYSICAL_STAGE_IDS[number];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function resolvePhysicalFocus(stageId: string, term: string | null): string | null {
  const terms: readonly string[] | undefined = PHYSICAL_FOCUS_TERMS[stageId as PhysicalStageId];
  return term && terms?.includes(term) ? term : null;
}

type FocusTargets = Record<string, THREE.Object3D[]>;
function withFocus(stage: Stage, targets: FocusTargets, focusOnly: THREE.Object3D[] = []): Stage {
  const allMaterials = new Set<THREE.Material>();
  const targetMaterials = new Map<string, Set<THREE.Material>>();
  const materialsOf = (object: THREE.Object3D, result: Set<THREE.Material>) => object.traverse(child => {
    const material = (child as THREE.Mesh).material;
    if (material) (Array.isArray(material) ? material : [material]).forEach(value => result.add(value));
  });
  materialsOf(stage.root, allMaterials);
  Object.entries(targets).forEach(([term, objects]) => {
    const materials = new Set<THREE.Material>();
    objects.forEach(object => {
      object.userData.focusTerms = [...(object.userData.focusTerms ?? []), term];
      materialsOf(object, materials);
    });
    targetMaterials.set(term, materials);
  });
  const baseline = new Map([...allMaterials].map(material => [material, {
    opacity: material.opacity,
    color: 'color' in material ? (material.color as THREE.Color).clone() : null,
    size: 'size' in material ? material.size as number : null,
  }]));
  let focus: string | null = null;
  const highlight = new THREE.Color('#ffffff');
  const apply = () => {
    const selected = focus ? targetMaterials.get(focus) : null;
    allMaterials.forEach(material => {
      const initial = baseline.get(material)!;
      const active = !focus || selected?.has(material);
      const factor = active ? 1 : Math.max(.19, material.userData.minimumFocusOpacity ?? 0);
      material.opacity = initial.opacity * factor;
      if ('color' in material && initial.color) {
        (material.color as THREE.Color).copy(initial.color);
        if (focus && active) (material.color as THREE.Color).lerp(highlight, .18);
      }
      if ('size' in material && initial.size !== null) material.size = initial.size * (focus && active ? 1.75 : 1);
      if (material instanceof THREE.ShaderMaterial && material.uniforms.uFocus) material.uniforms.uFocus.value = factor;
    });
    focusOnly.forEach(object => { object.visible = !!focus && object.userData.focusTerms?.includes(focus); });
    stage.root.userData.focus = focus;
  };
  const update = stage.update;
  stage.update = (progress, ambient) => {
    // Dynamic opacity (integration labels) is captured before applying the reversible focus.
    baseline.forEach((initial, material) => { material.opacity = initial.opacity; });
    update(progress, ambient);
    baseline.forEach((initial, material) => { initial.opacity = material.opacity; });
    apply();
  };
  stage.setFocus = term => { focus = resolvePhysicalFocus(stage.id, term); apply(); };
  stage.root.userData.focusTerms = PHYSICAL_FOCUS_TERMS[stage.id as PhysicalStageId];
  apply();
  return stage;
}

function stageLabel(text: string, x: number, y: number, width = 1.25, color = '#b6ccd2') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
  const context = canvas.getContext('2d');
  let texture: THREE.CanvasTexture | null = null;
  if (context) {
    context.font = '34px monospace'; context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 40); texture = new THREE.CanvasTexture(canvas);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.position.set(x, y, .16); sprite.scale.set(width, width * 80 / 512, 1);
  return { sprite, texture };
}

function lineAttribute(points: number[], color: string, opacity = .9) {
  const line = segments(points, color, opacity);
  return { line, attribute: line.geometry.getAttribute('position') as THREE.BufferAttribute };
}

function seeded(seed = 17452900) {
  let value = seed;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

function segments(points: number[], color: string, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function dipole() {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let shell = 0; shell < 4; shell++) {
    const radius = 1.9 + shell * 0.54;
    const theta0 = Math.asin(Math.sqrt(1.025 / radius));
    const tint = new THREE.Color(shell < 2 ? '#b1e1e8' : '#527c91');
    for (let meridian = 0; meridian < 16; meridian++) {
      const phi = meridian * Math.PI / 8;
      for (let step = 0; step < 88; step++) {
        for (const n of [step, step + 1]) {
          const theta = theta0 + (Math.PI - theta0 * 2) * n / 88;
          const r = radius * Math.sin(theta) ** 2;
          positions.push(r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi));
          colors.push(tint.r, tint.g, tint.b);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.54 }));
}

interface Pulsar {
  rig: THREE.Group;
  material: THREE.ShaderMaterial;
  beams: THREE.Mesh[];
  update: (local: number, ambient: number) => void;
}

function pulsar(size = 1): Pulsar {
  const rig = new THREE.Group();
  const obliquity = 0.58;
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uObliquity: { value: obliquity }, uFade: { value: 1 }, uFocus: { value: 1 } },
    vertexShader: `varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
      void main(){vLocal=normalize(position);vNormal=normalize(normalMatrix*normal);
      vec4 mv=modelViewMatrix*vec4(position,1.0);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;
      uniform float uTime;uniform float uObliquity;uniform float uFade;uniform float uFocus;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.73));p*=19.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=vLocal;float n=noise(p*28.)*.52+noise(p*67.)*.28+noise(p*141.)*.20;
      float striation=pow(abs(sin((p.y+noise(p*12.)*.1)*69.)),8.);
      vec3 pole=vec3(-sin(uObliquity),cos(uObliquity),0.);
      float cap=pow(abs(dot(p,pole)),24.);float rim=pow(1.-max(0.,dot(vNormal,vView)),3.);
      float light=.29+.71*max(0.,dot(vNormal,normalize(vec3(-.5,.7,1.))));
      vec3 silver=mix(vec3(.36,.44,.52),vec3(.91,.94,.96),smoothstep(.13,.84,n));
      silver*=light*(.93-.12*striation);silver+=vec3(.21,.32,.39)*rim;
      vec3 hot=vec3(1.,.92,.76)*(1.9+.16*sin(uTime*1.3));
      gl_FragColor=vec4(silver+hot*cap,uFade*uFocus);}`,
    transparent: true,
  });
  rig.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material));
  const magnetic = new THREE.Group();
  magnetic.rotation.z = obliquity;
  magnetic.add(dipole());
  const beams: THREE.Mesh[] = [];
  const beamGeometry = new THREE.CylinderGeometry(0.035, 0.9, 6, 32, 1, true);
  for (const direction of [-1, 1]) {
    const beamMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uFocus: { value: 1 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uFade;uniform float uFocus;
        void main(){float longitudinal=pow(vUv.y,1.5);float filaments=.55+.45*pow(abs(sin(vUv.x*31.416+uTime*.2)),8.);
        float pulses=.65+.35*sin(vUv.y*23.-uTime*2.);gl_FragColor=vec4(vec3(.65,.87,1.),(.08+.28*longitudinal)*filaments*pulses*uFade*uFocus);}`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = direction * 4;
    if (direction > 0) beam.rotation.z = Math.PI;
    magnetic.add(beam);
    beams.push(beam);
  }
  rig.add(magnetic);
  rig.scale.setScalar(size);
  return { rig, material, beams, update: (local, ambient) => {
    rig.rotation.y = 0.75 + ambient * 0.24 + local * 0.35;
    material.uniforms.uTime.value = ambient;
    beams.forEach(beam => { (beam.material as THREE.ShaderMaterial).uniforms.uTime.value = ambient + local * 3; });
  } };
}

function packet(length = 5.3, bands = 6) {
  const root = new THREE.Group();
  const curves: number[] = [];
  const colors: number[] = [];
  for (let band = 0; band < bands; band++) {
    const color = new THREE.Color(BAND[band % BAND.length]);
    for (let n = 0; n < 160; n++) {
      for (const i of [n, n + 1]) {
        const x = (i / 160 - 0.5) * length;
        const env = Math.exp(-((x / length) ** 2) * 22);
        curves.push(x, (band - (bands - 1) / 2) * 0.33 + Math.cos(i * (0.29 + band * 0.038)) * env * 0.42,
          Math.sin(i * (0.29 + band * 0.038)) * env * 0.21);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(curves, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  root.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 })));
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.1, 120, 16), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmplitude: { value: 0.5 }, uFade: { value: 1 }, uFocus: { value: 1 } },
    vertexShader: `varying vec2 vUv;uniform float uTime;uniform float uAmplitude;
      void main(){vUv=uv;vec3 p=position;float env=exp(-pow((uv.x-.5)*4.8,2.));
      p.z+=sin(uv.x*58.+uv.y*9.-uTime)*env*uAmplitude;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float uFade;uniform float uFocus;
      void main(){float env=exp(-pow((vUv.x-.5)*4.8,2.));float filaments=pow(abs(sin(vUv.y*56.55)),7.);
      vec3 c=mix(vec3(.30,.67,.82),vec3(.92,.79,.51),vUv.y);
      gl_FragColor=vec4(c,(.025+.12*filaments)*env*uFade*uFocus);}`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  root.add(ribbon);
  return { root, update: (time: number) => { (ribbon.material as THREE.ShaderMaterial).uniforms.uTime.value = time; } };
}

function sourceStage(): Stage {
  const root = new THREE.Group();
  const source = pulsar(1.1);
  source.rig.position.set(0.4, -0.3, 0);
  root.add(source.rig);
  const axis = segments([0.4, -2.5, 0, 0.4, 2.7, 0], '#7999a7', 0.36);
  root.add(axis);
  const rotation: number[] = [];
  for (let n = 0; n < 60; n++) for (const i of [n, n + 1]) {
    const a = i / 60 * Math.PI * 1.7;
    rotation.push(.4 + Math.cos(a) * 1.7, -.3, Math.sin(a) * 1.7);
  }
  rotation.push(1.4, -.3, -1.25, 1.13, -.3, -1.14, 1.4, -.3, -1.25, 1.48, -.3, -.93);
  const rotationGuide = segments(rotation, '#f8cb80', .94); root.add(rotationGuide);
  return withFocus({ id: 'faro', continuous: true, mobileScale: 1.13, root, camera: new THREE.Vector3(1.7, 1.9, 10.2), target: new THREE.Vector3(0.4, 0.1, 0),
    update: (local, ambient) => { source.update(local, ambient); } }, {
    rotation: [source.rig.children[0], axis, rotationGuide], field: [source.rig.children[1]],
  }, [rotationGuide]);
}

function emissionStage(): Stage {
  const root = new THREE.Group();
  const pulse = packet(5);
  pulse.root.position.set(0.7, -0.05, 0.3);
  root.add(pulse.root);
  const envelope: number[] = [];
  for (let n = 0; n < 160; n++) for (const i of [n, n + 1]) {
    const x = (i / 160 - 0.5) * 5;
    envelope.push(x + 0.7, 1.7 + Math.exp(-((x / 5) ** 2) * 22) * 0.65, 0.3);
  }
  const envelopeLine = segments(envelope, '#e5eaf0', .76); root.add(envelopeLine);
  const intensity: number[] = [];
  for (let n = 0; n < 160; n++) for (const i of [n, n + 1]) {
    const x = (i / 160 - .5) * 5, field = Math.exp(-((x / 5) ** 2) * 22);
    intensity.push(x + .7, -1.65 + field * field * .7, .3);
  }
  const intensityLine = segments(intensity, '#f3c776', .97); root.add(intensityLine);
  return withFocus({ id: 'pulso', continuous: true, mobileScale: 1.4, root, camera: new THREE.Vector3(1.4, 2.8, 10.6), target: new THREE.Vector3(0.4, 0.4, 0),
    update: (local, ambient) => {
      pulse.update(ambient * .5 + local * 3); pulse.root.position.x = -.45 + local * 1.15;
      pulse.root.rotation.x = .03 * Math.sin(ambient * .3);
      envelopeLine.position.x = intensityLine.position.x = pulse.root.position.x - .7;
      root.userData.intensityRelation = 'envelopeSquared';
    } }, { field: [pulse.root], envelope: [envelopeLine], intensity: [intensityLine] }, [intensityLine]);
}

function travelStage(): Stage {
  const root = new THREE.Group();
  const pulse = packet(4.6);
  pulse.root.rotation.z = -0.07;
  root.add(pulse.root);
  const rays: number[] = [];
  for (let i = 0; i < 6; i++) rays.push(-8, (i - 2.5) * 0.36, -0.18, 8, (i - 2.5) * 0.36, -0.18);
  const rayLines = segments(rays, '#3a5968', .2); root.add(rayLines);
  const distance = segments([-3.5, -1.6, 0, 3.5, -1.6, 0, -3.5, -1.8, 0, -3.5, -1.4, 0, 3.5, -1.8, 0, 3.5, -1.4, 0], '#efbf76', .9);
  const clock = new THREE.Group();
  const clockPoints: number[] = [];
  for (let n = 0; n < 48; n++) for (const i of [n, n + 1]) {
    const angle = i / 48 * Math.PI * 2; clockPoints.push(Math.cos(angle) * .38, Math.sin(angle) * .38, 0);
  }
  clock.add(segments(clockPoints, '#b5d1d6', .9)); clock.position.set(2.9, 1.45, 0);
  const hand = segments([0, 0, .02, 0, .31, .02], '#ffd18b', 1); clock.add(hand);
  const speed = lineAttribute([-1.3, .85, .25, -.4, .85, .25, -.4, .85, .25, -.63, 1.01, .25, -.4, .85, .25, -.63, .69, .25], '#ffd18b');
  root.add(distance, clock, speed.line);
  return withFocus({ id: 'vuelo', continuous: true, mobileScale: 1.5, root, camera: new THREE.Vector3(2.2, 1.8, 11.4), target: new THREE.Vector3(0, 0.1, 0),
    update: (local, ambient) => {
      pulse.root.position.x = -1.3 + local * 2;
      pulse.update(ambient * 0.5 + local * 4);
      speed.line.position.x = local * 2; hand.rotation.z = -local * Math.PI * 1.7;
      root.userData.travelFraction = local;
    } }, { distance: [distance, rayLines], speed: [pulse.root, speed.line], time: [clock, pulse.root] }, [distance, clock, speed.line]);
}

function dispersionStage(options: PhysicalStageOptions): Stage {
  const observation = options.observation;
  const root = new THREE.Group();
  const waves = Array.from({ length: 6 }, (_, i) => {
    const p = packet(2.6, 1);
    const material = (p.root.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    material.vertexColors = false; material.color.set(BAND[i]); material.opacity = 1;
    p.root.position.set(-3, (i - 2.5) * 0.7, 0.2);
    root.add(p.root);
    return p;
  });
  const paths: number[] = [];
  for (let i = 0; i < 6; i++) paths.push(-5, (i - 2.5) * 0.7, 0, 5, (i - 2.5) * 0.7, 0);
  const pathLines = segments(paths, '#568597', .23); root.add(pathLines);
  const random = seeded(500);
  const cloud: number[] = [];
  for (let i = 0; i < 230; i++) cloud.push((random() - 0.5) * 8.4, (random() - 0.5) * 4.9, -1.5 + random() * 2.4);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cloud, 3));
  const electrons = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: '#9cbbd2', size: .035, transparent: true, opacity: .45 })); root.add(electrons);
  const column = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, .42, .13),
    new THREE.MeshBasicMaterial({ color: '#e8c788', transparent: true, opacity: .9 }), 32);
  const columnBase = segments([-3.2, -2.45, 0, 3.2, -2.45, 0, 3.2, -2.45, 0, 3.55, -1.95, 0], '#88b6bf', .7);
  const pathGuide = segments([-4.2, 2.5, 0, 4.2, 2.5, 0, -4.2, 2.3, 0, -4.2, 2.7, 0, 4.2, 2.3, 0, 4.2, 2.7, 0], '#efc682', .9);
  const integralLabel = formulaSprite((options.incomingDm ?? 0) > 0 ? 'dm-observed' : 'dm', -.4, -2.85,
    (options.incomingDm ?? 0) > 0 ? 4.5 : 2.75);
  const delayGuide = lineAttribute(Array(5 * 18).fill(0), '#f4cd89', .92);
  root.add(column, columnBase, pathGuide, integralLabel.sprite, delayGuide.line);
  const matrix = new THREE.Matrix4(), identity = new THREE.Quaternion(), scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  let frequencies = observation ? Array.from({ length: 6 }, (_, i) => channelCentre(observation, Math.round(i / 5 * (observation.channels - 1))))
    : Array.from({ length: 6 }, (_, i) => 1203.125 + Math.round(i / 5 * 63) * 6.25);
  const referenceDm = observation?.dm ?? 500;
  const propagationFraction = (options.propagationDm ?? referenceDm) / referenceDm;
  const incomingFraction = (options.incomingDm ?? 0) / referenceDm;
  let dm = options.propagationDm ?? referenceDm;
  let incomingDm = options.incomingDm ?? 0;
  let duration = observation?.id === 'alma-hf' ? effectiveDt(observation) : 2.048;
  let delays = frequencies.map(frequency => dispersionDelaySeconds(dm, frequency, frequencies[5]));
  const accumulatedDelays = new Float64Array(6);
  return withFocus({ id: 'plasma', continuous: true, mobileScale: 1.9, root, camera: new THREE.Vector3(1.2, 2.8, 13.5), target: new THREE.Vector3(0, 0, 0),
    setEvidence: evidence => {
      if (observation?.id === 'alma-hf') return;
      const f = evidence.axes.frequenciesMHz;
      frequencies = Array.from({ length: 6 }, (_, i) => f[Math.round(i / 5 * (f.length - 1))]);
      dm = evidence.truth.dm * propagationFraction;
      incomingDm = evidence.truth.dm * incomingFraction;
      duration = evidence.axes.samples * evidence.axes.dtSeconds;
      delays = frequencies.map(frequency => dispersionDelaySeconds(dm, frequency, frequencies[5]));
    },
    update: (local, ambient) => {
      const reference = frequencies[5];
      const sweep = dispersionDelaySeconds(dm, frequencies[0], reference);
      const accumulatedDm = incomingDm + (dm - incomingDm) * local;
      waves.forEach((wave, i) => {
        const delay = dispersionDelaySeconds(accumulatedDm, frequencies[i], reference);
        const elapsed = (0.12 + local * 0.88) * (duration + sweep);
        wave.root.position.x = -2.6 + 4.2 * clamp((elapsed - delay) / (duration + sweep));
        wave.update(ambient * 0.35 + local * 3);
      });
      for (let cell = 0; cell < 32; cell++) {
        const filled = clamp((dm > 0 ? accumulatedDm / dm : 0) * 32 - cell);
        position.set(-3.1 + cell / 31 * 6.2, -2.45 + filled * .21, .15);
        scale.set(1, Math.max(.002, filled), 1);
        column.setMatrixAt(cell, matrix.compose(position, identity, scale));
      }
      column.instanceMatrix.needsUpdate = true;
      const referenceX = waves[5].root.position.x;
      for (let i = 0; i < 5; i++) {
        const x = waves[i].root.position.x, y = (i - 2.5) * .7 + .26;
        const offset = i * 6;
        delayGuide.attribute.setXYZ(offset, x, y, .5); delayGuide.attribute.setXYZ(offset + 1, referenceX, y, .5);
        delayGuide.attribute.setXYZ(offset + 2, x, y - .09, .5); delayGuide.attribute.setXYZ(offset + 3, x, y + .09, .5);
        delayGuide.attribute.setXYZ(offset + 4, referenceX, y - .09, .5); delayGuide.attribute.setXYZ(offset + 5, referenceX, y + .09, .5);
      }
      delayGuide.attribute.needsUpdate = true;
      root.userData.dmAccumulated = accumulatedDm;
      root.userData.dmTarget = dm;
      root.userData.dmIncoming = incomingDm;
      root.userData.dmAdded = accumulatedDm - incomingDm;
      root.userData.dmUnits = 'pc cm^-3';
      root.userData.dmModel = 'uniform illustrative electron column; no distance inference';
      root.userData.frequencyMHz = frequencies;
      accumulatedDelays.forEach((_, i) => { accumulatedDelays[i] = dispersionDelaySeconds(accumulatedDm, frequencies[i], reference); });
      root.userData.delaySeconds = delays;
      root.userData.accumulatedDelaySeconds = accumulatedDelays;
      root.userData.dispersionEffectiveBins = observation ? delays[0] / effectiveDt(observation) : delays[0] / .001;
    }, dispose: () => integralLabel.texture?.dispose() }, {
    density: [electrons], path: [pathLines, pathGuide], dm: [column, columnBase, integralLabel.sprite, delayGuide.line],
    frequency: waves.map(wave => wave.root), delay: [...waves.map(wave => wave.root), delayGuide.line],
  }, [pathGuide, delayGuide.line]);
}

function areciboStage(): Stage {
  const root = new THREE.Group(), observatory = createAreciboObservatory(); observatory.root.scale.setScalar(.62);
  observatory.setReveal(1); root.add(observatory.root);
  const feed = observatory.feeds[0].clone().multiplyScalar(.62);
  const aperture = segments([-3.1, .13, 0, 3.1, .13, 0, -3.1, -.03, 0, -3.1, .29, 0, 3.1, -.03, 0, 3.1, .29, 0], '#f3c57a', .95);
  const incoming: number[] = [], focused: number[] = [];
  for (let i = 0; i < 9; i++) {
    const x = -2.8 + i / 8 * 5.6, y = areciboReflectorHeight(Math.abs(x) / .62) * .62;
    incoming.push(x - 2.5, 4.3, .15, x, y, .15);
    focused.push(x, y, .15, feed.x, feed.y, feed.z);
  }
  const fronts = segments(incoming, '#8aceda', .8), optical = segments(focused, '#edc884', .94);
  fronts.material.userData.minimumFocusOpacity = .6; optical.material.userData.minimumFocusOpacity = .6;
  const output = segments([feed.x, feed.y, feed.z, 3.8, feed.y, feed.z], '#88d7bf', .8);
  const voltage = new THREE.Mesh(new THREE.SphereGeometry(.072, 12, 8), new THREE.MeshBasicMaterial({ color: '#f4c880' })); root.add(voltage);
  const labels = [stageLabel('Arecibo / Puerto Rico', .3, 4.3, 1.65), stageLabel('D = 305 m / receptor suspendido', .3, 4.09, 1.75)];
  labels.forEach(value => { value.sprite.material.userData.minimumFocusOpacity = .72; });
  root.add(aperture, fronts, optical, output, ...labels.map(value => value.sprite));
  return withFocus({ id: 'antenas', mobileScale: 1.4, root, camera: new THREE.Vector3(-3.5, 7.5, 13.9), target: new THREE.Vector3(0, .8, .2),
    update: local => {
      fronts.geometry.setDrawRange(0, Math.max(2, Math.ceil(clamp(local * 1.8) * 9) * 2));
      optical.geometry.setDrawRange(0, Math.ceil(clamp((local - .25) / .5) * 9) * 2);
      output.geometry.setDrawRange(0, local > .68 ? 2 : 0);
      voltage.visible = local > .4;
      voltage.position.copy(feed); voltage.position.x = THREE.MathUtils.lerp(feed.x, 3.8, smooth((local - .65) / .35));
      root.userData.site = ARECIBO; root.userData.apertureMeters = 305; root.userData.feedCount = 1;
      root.userData.propagationDirection = [.6, -.8, 0]; root.userData.eventLocalX = voltage.position.x;
      root.userData.opticalModel = 'Single fixed spherical aperture, suspended Gregorian correction; schematic optical paths, not interferometric baselines.';
      root.userData.siteProvenance = 'Historical Arecibo before 2020; synthetic fixture, not telescope data.';
    }, dispose: () => { observatory.dispose?.(); labels.forEach(value => value.texture?.dispose()); } },
  { baseline: [observatory.dishes, aperture], direction: [fronts], delay: [optical, output, voltage] }, [aperture]);
}

function dishGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = 20, sectors = 56, radius = 0.88, focalLength = 0.6;
  for (let ring = 0; ring <= rings; ring++) for (let sector = 0; sector <= sectors; sector++) {
    const r = radius * ring / rings, phi = sector * Math.PI * 2 / sectors;
    positions.push(r * Math.cos(phi), 0.2 + r * r / (4 * focalLength), r * Math.sin(phi));
    if (ring < rings && sector < sectors) {
      const a = ring * (sectors + 1) + sector;
      indices.push(a, a + 1, a + sectors + 1, a + 1, a + sectors + 2, a + sectors + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function arrayStage(observation?: ObservationCase): Stage {
  const root = new THREE.Group();
  const layout = [[-3.2, -1.7], [-0.6, -2.1], [2.2, -1.8], [-2.3, 1.3], [0.4, 1.5], [3.2, 1.2]];
  const silver = new THREE.MeshStandardMaterial({ color: '#cdd9df', metalness: 0.72, roughness: 0.28, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: '#566772', metalness: 0.65, roughness: 0.4 });
  const body = new THREE.InstancedMesh(dishGeometry(), silver, 6);
  const rim = new THREE.InstancedMesh(new THREE.TorusGeometry(0.88, 0.019, 8, 60), steel, 6);
  const pedestal = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.095, 0.19, 1.3, 14), steel, 6);
  const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.65, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: '#444e54', roughness: 0.93 }), 6);
  const feed = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: '#98d7df', emissive: '#17464c', emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 }), 6);
  [silver, steel, pads.material, feed.material].forEach(material => { material.userData.minimumFocusOpacity = .65; });
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const dishRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const rimRotation = dishRotation.clone().multiply(rotation);
  const unit = new THREE.Vector3(1, 1, 1);
  const localPosition = new THREE.Vector3();
  const support: number[] = [], wires: number[] = [];
  layout.forEach(([x, z], i) => {
    body.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, 1, z), dishRotation, unit));
    localPosition.set(0, .523, 0).applyQuaternion(dishRotation).add(new THREE.Vector3(x, 1, z));
    rim.setMatrixAt(i, matrix.compose(localPosition, rimRotation, unit));
    pedestal.setMatrixAt(i, matrix.makeTranslation(x, .38, z));
    pads.setMatrixAt(i, matrix.makeTranslation(x, -0.22, z));
    localPosition.set(0, .85, 0).applyQuaternion(dishRotation).add(new THREE.Vector3(x, 1, z));
    feed.setMatrixAt(i, matrix.compose(localPosition, dishRotation, unit));
    for (let strut = 0; strut < 3; strut++) {
      const angle = strut * Math.PI * 2 / 3;
      const end = new THREE.Vector3(Math.cos(angle) * .75, .43, Math.sin(angle) * .75).applyQuaternion(dishRotation).add(new THREE.Vector3(x, 1, z));
      support.push(end.x, end.y, end.z, localPosition.x, localPosition.y, localPosition.z);
    }
    wires.push(x, -.14, z, 4.9, -.14, z, 4.9, -.14, z, 4.9, -.14, 0);
  });
  root.add(body, rim, pedestal, pads, feed, segments(support, '#aebfc8', 0.9), segments(wires, '#577e89', 0.55));
  const ground = createChajnantorTerrain(); root.add(ground);
  const siteLabel = stageLabel('ALMA / Chajnantor', .65, 4.58, 3.4, '#e2e8e9');
  const siteUnits = stageLabel('5000 m, sitio mm/submm', .65, 4.18, 3.3, '#aebfc5');
  [siteLabel, siteUnits].forEach(label => { label.sprite.material.userData.minimumFocusOpacity = .9; });
  root.add(siteLabel.sprite, siteUnits.sprite);
  const fronts = new THREE.InstancedMesh(new THREE.PlaneGeometry(6.5, 6.5),
    new THREE.MeshBasicMaterial({ color: '#a4d9e8', transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false }), 4);
  const frontRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  root.add(fronts);
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#dceeea' }), 6);
  root.add(pulses);
  const baseline = segments([-3.2, .08, -1.7, 2.2, .08, -1.8, -3.2, -.05, -1.7, -3.2, .24, -1.7, 2.2, -.05, -1.8, 2.2, .24, -1.8], '#f8c978', .98);
  const direction = segments([-5, 2.5, 2.5, -2.4, 2.5, 2.5, -2.4, 2.5, 2.5, -2.75, 2.75, 2.5, -2.4, 2.5, 2.5, -2.75, 2.25, 2.5], '#f8d18a', .95);
  const delay = segments([-3.2, 1.9, -1.7, 2.2, 1.9, -1.7, -3.2, 1.75, -1.7, -3.2, 2.05, -1.7, 2.2, 1.75, -1.7, 2.2, 2.05, -1.7], '#8cddd8', .95);
  root.add(baseline, direction, delay);
  return withFocus({ id: 'antenas', mobileScale: 1.4, root, camera: new THREE.Vector3(-3.5, 7.5, 13.9), target: new THREE.Vector3(0, .8, .2),
    update: local => {
      for (let i = 0; i < 4; i++) fronts.setMatrixAt(i,
        matrix.compose(new THREE.Vector3(-6 + 12 * smooth((local - i * .06) / .82), 1.25, 0), frontRotation, unit));
      fronts.instanceMatrix.needsUpdate = true;
      layout.forEach(([x, z], i) => {
        const position = smooth((local - .3 - i * .025) / .5);
        pulses.setMatrixAt(i, matrix.makeTranslation(THREE.MathUtils.lerp(x, 4.9, position), -.11, THREE.MathUtils.lerp(z, 0, position)));
      });
      pulses.instanceMatrix.needsUpdate = true;
      root.userData.propagationDirection = [1, 0, 0];
      root.userData.baselineVector = [5.4, 0, -.1];
      root.userData.geometricDelayModel = 'dot(b,s)/c; illustration, no physical distance scale';
      root.userData.site = CHAJNANTOR;
      root.userData.feedCount = 6;
      root.userData.siteProvenance = observation ? observation.provenance
        : 'Illustrative ALMA site and six-antenna geometry; not surveyed terrain or a native LF observation.';
    }, dispose: () => { siteLabel.texture?.dispose(); siteUnits.texture?.dispose(); } },
  { baseline: [body, baseline], direction: [fronts, direction], delay: [fronts, pulses, delay] }, [baseline, direction, delay]);
}

const exampleVoltage = () => Array.from({ length: 64 }, (_, i) => Math.cos(i * Math.PI * 12 / 64) * .6 + Math.cos(i * Math.PI * 28 / 64) * .22);

function trace(values: number[], x: number, width: number, y: number, color: string, stepped = false) {
  const geometry = new THREE.BufferGeometry();
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .95 }));
  const setValues = (samples: number[]) => {
    const points: number[] = [];
    samples.forEach((value, index) => {
      const position = x + index / Math.max(1, samples.length - 1) * width;
      if (stepped && index > 0) points.push(position, y + samples[index - 1] * .72, 0);
      points.push(position, y + value * .72, 0);
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeBoundingSphere();
  };
  setValues(values);
  return { line, geometry, setValues };
}

export function normalizedPhasorPower(phases: number[]) {
  if (!phases.length) return 0;
  const real = phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / phases.length;
  const imag = phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / phases.length;
  return real * real + imag * imag;
}

export interface ComplexVoltage { real: number; imag: number }
export function complexProductConjugate(left: ComplexVoltage, right: ComplexVoltage): ComplexVoltage {
  return { real: left.real * right.real + left.imag * right.imag, imag: left.imag * right.real - left.real * right.imag };
}

export function averageComplexVisibility(left: readonly ComplexVoltage[], right: readonly ComplexVoltage[], samples = Math.min(left.length, right.length)): ComplexVoltage {
  const count = Math.max(0, Math.min(left.length, right.length, Math.floor(samples)));
  let real = 0, imag = 0;
  for (let n = 0; n < count; n++) {
    const product = complexProductConjugate(left[n], right[n]); real += product.real; imag += product.imag;
  }
  return count ? { real: real / count, imag: imag / count } : { real: 0, imag: 0 };
}

function phaseStage(): Stage {
  const root = new THREE.Group();
  root.scale.setScalar(.73);
  const rowY = (i: number) => (i - 2.5) * .55 + .7;
  const rows = Array.from({ length: 6 }, (_, i) => trace(Array(64).fill(0), -4.7, 7.7, rowY(i), BAND[i]));
  rows.forEach(row => root.add(row.line));
  const phasorPositions = new Float32Array(6 * 6);
  const phasorGeometry = new THREE.BufferGeometry();
  phasorGeometry.setAttribute('position', new THREE.BufferAttribute(phasorPositions, 3));
  const arrows = new THREE.LineSegments(phasorGeometry, new THREE.LineBasicMaterial({ color: '#f3cb7d', transparent: true, opacity: .95 }));
  root.add(arrows, segments([-4.7, -1.25, 0, 4.8, -1.25, 0], '#456678', .45));
  const circles: number[] = [];
  for (let row = 0; row < 6; row++) for (let n = 0; n < 36; n++) for (const step of [n, n + 1]) {
    const angle = step / 36 * Math.PI * 2;
    circles.push(3.8 + Math.cos(angle) * .28, rowY(row) + Math.sin(angle) * .28, 0);
  }
  root.add(segments(circles, '#547481', .55));
  // This parallel branch correlates illustrative I/Q voltages, never the intensity waterfall.
  const left: ComplexVoltage[] = [], right: ComplexVoltage[] = [], products: ComplexVoltage[] = [], means: ComplexVoltage[] = [];
  let accumulatedReal = 0, accumulatedImag = 0;
  for (let n = 0; n < 64; n++) {
    const angle = n / 64 * Math.PI * 12, relativePhase = .9 + .42 * Math.sin(n * .71) + .2 * Math.cos(n * 1.93);
    left.push({ real: Math.cos(angle), imag: Math.sin(angle) });
    right.push({ real: .8 * Math.cos(angle - relativePhase), imag: .8 * Math.sin(angle - relativePhase) });
    const product = complexProductConjugate(left[n], right[n]); products.push(product);
    accumulatedReal += product.real; accumulatedImag += product.imag;
    means.push({ real: accumulatedReal / (n + 1), imag: accumulatedImag / (n + 1) });
  }
  const centers = [-3.6, -2, -.1, 2.4], y = -2.15;
  const branchCircles: number[] = [];
  centers.forEach(x => {
    branchCircles.push(x - .43, y, 0, x + .43, y, 0, x, y - .43, 0, x, y + .43, 0);
    for (let n = 0; n < 48; n++) for (const i of [n, n + 1]) {
      const angle = i / 48 * Math.PI * 2; branchCircles.push(x + Math.cos(angle) * .35, y + Math.sin(angle) * .35, 0);
    }
  });
  root.add(segments(branchCircles, '#496c7c', .7));
  const inputArrows = centers.slice(0, 2).map(x => lineAttribute([x, y, .08, x, y, .08], '#91dbdf', .97));
  const productArrow = lineAttribute([centers[2], y, .08, centers[2], y, .08], '#edba86', .97);
  const visibilityArrow = lineAttribute([centers[3], y, .1, centers[3], y, .1], '#f5d284', .97);
  const meanPath = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9cdbb9', transparent: true, opacity: .92 }));
  meanPath.geometry.setAttribute('position', new THREE.Float32BufferAttribute(means.flatMap(value => [centers[3] + value.real * .35, y + value.imag * .35, .08]), 3));
  const accumulator: number[] = [];
  for (let n = 0; n < 32; n++) accumulator.push(.8 + n / 31 * 3.6, -2.9, 0, .8 + n / 31 * 3.6, -2.73, 0);
  const averageTicks = segments(accumulator, '#a2d5b7', .94);
  const branch = segments([-4.55, -.68, 0, -4.55, -2.15, 0, -4.55, -2.15, 0, -4.03, -2.15, 0,
    -3.17, y, 0, -3.17, -2.6, 0, -3.17, -2.6, 0, -.54, -2.6, 0, -.54, -2.6, 0, -.54, y, 0,
    -1.56, y, 0, -.54, y, 0, .34, y, 0, 1.96, y, 0], '#6da1a9', .65);
  const labels = [formulaSprite('voltage-i', -3.6, -1.52, .40), formulaSprite('voltage-j-conjugate', -2, -1.52, .57),
    formulaSprite('voltage-product', -.1, -1.52, .95), formulaSprite('visibility', 2.4, -1.52, 2.3),
    stageLabel('I/Q ilustrativo', -2.8, -2.88, 2.2), stageLabel('media de 64 productos', 2.6, -3.14, 2.9)];
  root.add(...inputArrows.map(arrow => arrow.line), productArrow.line, visibilityArrow.line, meanPath, averageTicks, branch, ...labels.map(label => label.sprite));
  const phases = new Array<number>(6).fill(0);
  const currentVisibility = { real: 0, imag: 0 };
  return withFocus({ id: 'fase', mobileScale: 1.55, root, camera: new THREE.Vector3(1.2, 2.1, 13.3), target: new THREE.Vector3(),
    update: local => {
      rows.forEach((_, i) => { phases[i] = i * .62 * (1 - local); });
      rows.forEach((row, i) => {
        const positions = row.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let n = 0; n < positions.count; n++) positions.setY(n, rowY(i) + Math.cos(n / 63 * Math.PI * 10 + phases[i]) * .23);
        positions.needsUpdate = true;
        phasorPositions.set([3.8, rowY(i), .05, 3.8 + Math.cos(phases[i]) * .28, rowY(i) + Math.sin(phases[i]) * .28, .05], i * 6);
      });
      phasorGeometry.attributes.position.needsUpdate = true;
      root.userData.normalizedPower = normalizedPhasorPower(phases);
      const count = Math.max(1, Math.ceil(local * 64)), index = count - 1;
      const values = [left[index], { real: right[index].real, imag: -right[index].imag }, products[index], means[index]];
      [...inputArrows, productArrow, visibilityArrow].forEach((arrow, i) => {
        arrow.attribute.setXYZ(1, centers[i] + values[i].real * .35, y + values[i].imag * .35, .1);
        arrow.attribute.needsUpdate = true;
      });
      meanPath.geometry.setDrawRange(0, count); averageTicks.geometry.setDrawRange(0, Math.ceil(count / 2) * 2);
      currentVisibility.real = means[index].real; currentVisibility.imag = means[index].imag;
      root.userData.visibility = currentVisibility;
      root.userData.correlationSamples = count;
      root.userData.correlationUnits = 'normalized';
      root.userData.correlationKind = 'illustrative I/Q; parallel voltage branch';
    }, dispose: () => labels.forEach(label => label.texture?.dispose()) }, {
    voltage: [...rows.map(row => row.line), arrows, ...inputArrows.map(arrow => arrow.line), labels[0].sprite, labels[1].sprite],
    product: [...inputArrows.map(arrow => arrow.line), productArrow.line, labels[2].sprite, branch],
    average: [productArrow.line, meanPath, averageTicks, labels[5].sprite],
    visibility: [visibilityArrow.line, meanPath, labels[3].sprite],
  });
}

function coherentStage(): Stage {
  const root = new THREE.Group();
  root.scale.setScalar(.8);
  const values = exampleVoltage();
  const rows = Array.from({ length: 6 }, (_, i) => trace(values.map(value => value / 6), -4.7, 3.5, (i - 2.5) * .59, BAND[i]));
  rows.forEach(row => root.add(row.line));
  const output = trace(values, 1, 3.8, 0, '#ffd18b'); root.add(output.line);
  const connections: number[] = [];
  for (let i = 0; i < 6; i++) connections.push(-1.2, (i - 2.5) * .59, 0, .3, 0, 0);
  connections.push(.3, 0, 0, 1, 0, 0);
  const branches = segments(connections, '#a7dacf', .65); root.add(branches);
  const sample = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshBasicMaterial({ color: '#f4c578' })); root.add(sample);
  const phasePoints: number[] = [];
  for (let i = 0; i < 6; i++) {
    const y = (i - 2.5) * .59;
    phasePoints.push(-1.02, y, .1, -.58, y, .1, -.58, y, .1, -.73, y + .1, .1, -.58, y, .1, -.73, y - .1, .1);
  }
  const phaseGuide = segments(phasePoints, '#ebd59a', .97);
  const power = trace(values.map(value => value * value), 1, 3.8, -1.9, '#efb78c');
  const powerLabel = formulaSprite('power', 2.9, -2.22, 2.8);
  root.add(phaseGuide, power.line, powerLabel.sprite);
  return withFocus({ id: 'suma', mobileScale: 1.65, root, camera: new THREE.Vector3(1.2, 2.1, 13.3), target: new THREE.Vector3(),
    setEvidence: evidence => {
      rows.forEach(row => row.setValues(evidence.acquisition.voltages.map(value => value / 6)));
      output.setValues(evidence.acquisition.voltages);
      power.setValues(evidence.acquisition.voltages.map(value => value * value));
    },
    update: local => {
      rows.forEach((row, i) => row.geometry.setDrawRange(0, Math.max(2, Math.floor(row.geometry.attributes.position.count * clamp(local * 1.6 - i * .035)))));
      branches.geometry.setDrawRange(0, Math.floor(clamp(local * 1.6 - .32) * 14));
      output.geometry.setDrawRange(0, Math.max(2, Math.floor(output.geometry.attributes.position.count * smooth((local - .35) / .65))));
      power.geometry.setDrawRange(0, Math.max(2, Math.floor(power.geometry.attributes.position.count * smooth((local - .35) / .65))));
      sample.position.set(-4.7 + local * 9.5, 0, .18);
      root.userData.normalizedPower = 1;
      root.userData.coherentNormalization = 'sum(v_i)/6';
    }, dispose: () => powerLabel.texture?.dispose() }, {
    voltage: [...rows.map(row => row.line), output.line, branches, sample],
    phase: [...rows.map(row => row.line), phaseGuide], power: [output.line, power.line, powerLabel.sprite],
  }, [phaseGuide, power.line, powerLabel.sprite]);
}

function acquisitionStage(kind: 'receptor' | 'fft' | 'potencia'): Stage {
  const root = new THREE.Group();
  root.scale.setScalar(kind === 'potencia' ? .61 : .8);
  const values = exampleVoltage();
  const analog = trace(values, -4.7, kind === 'receptor' ? 4 : 3.2, 0, '#a7e2e9');
  const digital = trace(values.map(value => Math.round((value + 1) * 7.5) / 7.5 - 1), .7, 4, 0, '#f3cf83', true);
  root.add(analog.line);
  let powers: number[] = Array(32).fill(0);
  const matrix = new THREE.Matrix4(), identity = new THREE.Quaternion();
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(.10, 1, .19),
    new THREE.MeshStandardMaterial({ color: kind === 'fft' ? '#a5dacf' : '#efaf80', emissive: '#244044', emissiveIntensity: .25, metalness: .25, roughness: .45 }), 32);
  if (kind === 'receptor') root.add(digital.line);
  else root.add(bars);
  const adcLevels: number[] = [];
  if (kind === 'receptor') for (let n = 0; n < 16; n++) {
    const y = (n / 15 * 2 - 1) * .72;
    adcLevels.push(.7, y, -.08, 4.7, y, -.08);
  }
  const axes = segments(kind === 'receptor' ? adcLevels : [-4.7, -.95, 0, -1.5, -.95, 0, 1.1, -1.5, 0, 5.1, -1.5, 0], '#426373', .4); root.add(axes);
  const basis: THREE.Line[] = [];
  let windows: THREE.InstancedMesh | null = null;
  let windowLabel: THREE.Sprite | null = null;
  let windowTexture: THREE.CanvasTexture | null = null;
  const ownedLabels: ReturnType<typeof stageLabel>[] = [];
  const focusOnly: THREE.Object3D[] = [];
  const focusTargets: FocusTargets = {};
  let bits: THREE.InstancedMesh | null = null;
  let quantized = values.map(value => Math.round((value + 1) * 7.5) / 7.5 - 1);
  let weighted: ReturnType<typeof trace> | null = null;
  let hannEnvelope: THREE.LineSegments | null = null;
  const hann = Array.from({ length: 64 }, (_, n) => .5 - .5 * Math.cos(n / 63 * Math.PI * 2));
  if (kind === 'receptor') {
    bits = new THREE.InstancedMesh(new THREE.BoxGeometry(.34, .27, .09), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 4);
    const bitLabel = stageLabel('b3  b2  b1  b0', 2.3, 2.03, 2.3);
    const levelsLabel = stageLabel('4 bits / 16 niveles', 2.7, -1.15, 2.9);
    root.add(bits, bitLabel.sprite, levelsLabel.sprite); ownedLabels.push(bitLabel, levelsLabel);
    focusOnly.push(bits, bitLabel.sprite, levelsLabel.sprite);
    focusTargets.voltage = [analog.line]; focusTargets.code = [digital.line, bits, bitLabel.sprite];
    focusTargets.bits = [axes, bits, bitLabel.sprite, levelsLabel.sprite];
  }
  if (kind === 'fft') {
    weighted = trace(values.map((value, n) => value * hann[n]), -4.7, 3.2, 0, '#f5ce84');
    const envelope: number[] = [];
    for (let n = 0; n < 63; n++) for (const i of [n, n + 1]) envelope.push(-4.7 + i / 63 * 3.2, 1.1 + hann[i] * .65, .05);
    hannEnvelope = segments(envelope, '#efdbb6', .95);
    root.add(weighted.line, hannEnvelope); focusOnly.push(weighted.line, hannEnvelope);
    for (let band = 0; band < 2; band++) {
      const bin = [5, 13][band];
      const wave = trace(Array.from({ length: 64 }, (_, n) => Math.cos(n / 64 * Math.PI * 2 * bin) * .27), -1.1, 1.55, (band - 1) * .73, BAND[band + 2]);
      wave.line.userData.fftBin = bin;
      root.add(wave.line); basis.push(wave.line);
    }
    root.add(segments([-1.5, 0, 0, -1.1, 0, 0, .5, 0, 0, 1.1, 0, 0], '#bcdbcf', .7));
    focusTargets.window = [weighted.line, hannEnvelope]; focusTargets.frequency = [...basis, bars, axes]; focusTargets.amplitude = [bars];
  }
  if (kind === 'potencia') {
    const transform = new THREE.Mesh(new THREE.TorusGeometry(.45, .035, 8, 36), new THREE.MeshBasicMaterial({ color: '#e6cf8a' }));
    transform.position.x = -.2; root.add(transform);
    const square = segments([-.45, .22, .08, -.45, -.22, .08, -.45, -.22, .08, -.06, -.22, .08, -.06, -.22, .08, -.06, .22, .08, -.06, .22, .08, -.45, .22, .08], '#eadac0', .85); root.add(square);
    windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(.25, .072), new THREE.MeshBasicMaterial({ transparent: true, opacity: .95, side: THREE.DoubleSide }), 8 * 32);
    root.add(windows);
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '28px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#adc0c5';
      context.fillText('8 ventanas repetidas', 240, 32);
      windowTexture = new THREE.CanvasTexture(canvas);
      windowLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: windowTexture, transparent: true, depthWrite: false }));
      windowLabel.position.set(3.7, 1.65, 0); windowLabel.scale.set(2.55, .34, 1); root.add(windowLabel);
    }
    root.add(segments([1.9, 0, 0, 2.35, 0, 0], '#bbcdca', .65));
    focusTargets.amplitude = [analog.line]; focusTargets.power = [transform, square, bars];
    focusTargets.average = windowLabel ? [windows, windowLabel] : [windows];
  }
  const bitPosition = new THREE.Vector3(), bitScale = new THREE.Vector3(1, 1, 1);
  const bitOn = new THREE.Color('#f4ce86'), bitOff = new THREE.Color('#294956');
  const barPosition = new THREE.Vector3(), barScale = new THREE.Vector3();
  const dark = new THREE.Color('#163f4b'), hot = new THREE.Color('#f7cc87'), color = new THREE.Color();
  return withFocus({ id: kind, mobileScale: kind === 'potencia' ? 1.3 : 1.65, root, camera: new THREE.Vector3(1.4, 2.3, 13.4), target: new THREE.Vector3(0, .1, 0),
    setEvidence: (evidence: EventEvidence, _arrays: EvidenceArrays) => {
      if (kind === 'potencia') {
        const maximum = Math.max(...evidence.acquisition.fftPower, 1e-12);
        analog.setValues(evidence.acquisition.fftPower.slice(0, 32).map(value => Math.sqrt(value / maximum)));
      }
      else analog.setValues(kind === 'fft' ? evidence.acquisition.quantized : evidence.acquisition.voltages);
      quantized = evidence.acquisition.quantized;
      digital.setValues(evidence.acquisition.quantized);
      weighted?.setValues(evidence.acquisition.quantized.map((value, n) => value * hann[n]));
      powers = evidence.acquisition.fftPower.slice(0, 32);
    },
    update: local => {
      analog.geometry.setDrawRange(0, Math.max(2, Math.floor(analog.geometry.attributes.position.count * clamp(local * 1.5))));
      digital.geometry.setDrawRange(0, Math.max(2, Math.floor(digital.geometry.attributes.position.count * smooth((local - .15) / .85))));
      weighted?.geometry.setDrawRange(0, Math.max(2, Math.floor(64 * clamp(local * 1.5))));
      if (bits) {
        const sample = Math.min(quantized.length - 1, Math.floor(local * (quantized.length - 1)));
        const code = Math.max(0, Math.min(15, Math.round((quantized[sample] + 1) * 7.5)));
        for (let bit = 0; bit < 4; bit++) {
          bitPosition.set(1.45 + bit * .57, 1.62, .05);
          bits.setMatrixAt(bit, matrix.compose(bitPosition, identity, bitScale)); bits.setColorAt(bit, code & (1 << (3 - bit)) ? bitOn : bitOff);
        }
        bits.instanceMatrix.needsUpdate = true;
        if (bits.instanceColor) bits.instanceColor.needsUpdate = true;
        root.userData.adcCode = code; root.userData.adcBits = 4; root.userData.adcSample = sample;
      }
      const max = Math.max(...powers, 1e-12);
      for (let bin = 0; bin < 32; bin++) {
        const normalized = kind === 'fft' ? Math.sqrt(powers[bin] / max) : powers[bin] / max;
        const h = Math.max(.014, normalized * 3.3 * smooth((local - .25) / .75));
        barPosition.set(1.2 + bin / 31 * 3.8, -1.5 + h / 2, .1); barScale.set(1, h, 1);
        bars.setMatrixAt(bin, matrix.compose(barPosition, identity, barScale));
      }
      bars.instanceMatrix.needsUpdate = true;
      basis.forEach((line, index) => { line.geometry.setDrawRange(0, Math.max(2, Math.floor(64 * clamp(local * 1.7 - index * .16)))); });
      if (windows) {
        const accumulation = smooth((local - .56) / .44);
        bars.scale.set(1 - accumulation * .7, 1 - accumulation * .35, 1);
        bars.position.x = accumulation * .4;
        for (let time = 0; time < 8; time++) for (let channel = 0; channel < 32; channel++) {
          const index = time * 32 + channel;
          const visible = clamp(accumulation * 8 - time);
          barPosition.set(2.45 + time / 7 * 2.5, -1.2 + channel / 31 * 2.4, .05); barScale.set(visible, visible, 1);
          windows.setMatrixAt(index, matrix.compose(barPosition, identity, barScale));
          color.lerpColors(dark, hot, Math.pow(powers[channel] / max, .32)); windows.setColorAt(index, color);
        }
        windows.instanceMatrix.needsUpdate = true;
        if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
        if (windowLabel) (windowLabel.material as THREE.SpriteMaterial).opacity = accumulation;
      }
      root.userData.acquisitionUnits = 'normalized';
      root.userData.amplitudeConvention = 'sqrt(fftPower / maxPower), no recovered phase';
      root.userData.integrationKind = '8 repeated illustrative windows';
    }, dispose: () => { windowTexture?.dispose(); ownedLabels.forEach(label => label.texture?.dispose()); } }, focusTargets, focusOnly);
}

export function createPhysicalStages(options: PhysicalStageOptions = {}): Stage[] {
  const target = options.propagationDm ?? options.observation?.dm ?? 500, incoming = options.incomingDm ?? 0;
  if (!Number.isFinite(target) || !Number.isFinite(incoming) || incoming < 0 || target < incoming) {
    throw new RangeError('La DM entrante debe ser no negativa y no superar la DM final de propagacion.');
  }
  const stages = [sourceStage(), emissionStage(), travelStage(), dispersionStage(options),
    options.observation?.observatory === 'arecibo' ? areciboStage() : arrayStage(options.observation), phaseStage(), coherentStage(), acquisitionStage('receptor'), acquisitionStage('fft'), acquisitionStage('potencia')];
  if (options.observation) stages.forEach(stage => {
    stage.root.userData.observationCase = options.observation!.id;
    stage.root.userData.provenance = options.observation!.provenance;
    if (options.observation!.id === 'alma-hf') stage.setEvidence = undefined;
  });
  return stages;
}
