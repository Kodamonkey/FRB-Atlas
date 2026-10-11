import * as THREE from 'three';
import { faradayAngle, rotateJones, stokesFromJones, type JonesVector } from '../math/cosmicMath';
import { formulaSprite } from './formulaSprite';
import { ARECIBO, CHAJNANTOR, createAlmaObservatory, createAreciboObservatory, geographicalNormal } from './observatory';
import { createTravelCamera, EARTH_CAMERA, GALACTIC_CAMERA } from './travelCamera';
import { channelCentre, effectiveDt, type ObservationCase } from '../observations';
import type { Stage } from './types';

export const COSMIC_STAGE_IDS = ['anfitriona', 'galaxia', 'polarizacion', 'tierra'] as const;
export const COSMIC_FOCUS_TERMS = {
  anfitriona: ['host', 'redshift', 'frequency', 'duration'], galaxia: ['halo', 'disk', 'igm', 'total'],
  polarizacion: ['field', 'stokes', 'rotation', 'wavelength', 'angle'], tierra: ['frequency', 'delay', 'field', 'receiver'],
} as const;
type CosmicId = typeof COSMIC_STAGE_IDS[number];
const COLORS = ['#ee8c91', '#f1ba77', '#f1d88b', '#84d7ba', '#8ccde7', '#bdadf0'];
export const COSMIC_CHANNEL_INDICES = Object.freeze(Array.from({ length: 6 }, (_, i) => Math.round(i / 5 * 63)));
export const COSMIC_FREQUENCIES_MHZ = Object.freeze(COSMIC_CHANNEL_INDICES.map(index => 1203.125 + index * 6.25));
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
const channelIndices = (observation?: ObservationCase) => observation
  ? Array.from({ length: 6 }, (_, index) => Math.round(index / 5 * (observation.channels - 1))) : COSMIC_CHANNEL_INDICES;
const channelFrequencies = (observation?: ObservationCase) => observation
  ? channelIndices(observation).map(index => channelCentre(observation, index)) : COSMIC_FREQUENCIES_MHZ;

export function resolveCosmicFocus(id: string, term: string | null): string | null {
  const terms: readonly string[] | undefined = COSMIC_FOCUS_TERMS[id as CosmicId];
  return term && terms?.includes(term) ? term : null;
}

function randomSource(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function line(positions: number[], color: string, opacity = 1, segmented = false) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return segmented ? new THREE.LineSegments(geometry, material) : new THREE.Line(geometry, material);
}

function circularPoints(material: THREE.PointsMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float stellarRadiusSquared = dot(gl_PointCoord - vec2(0.5), gl_PointCoord - vec2(0.5));
      if (stellarRadiusSquared > 0.25) discard;
      diffuseColor.a *= 1.0 - smoothstep(0.10, 0.25, stellarRadiusSquared);`);
  };
  material.customProgramCacheKey = () => 'cosmic-circular-points-v1';
  material.userData.pointShape = 'circular-soft-edge';
  return material;
}

function points(positions: number[], color: string, size: number, opacity: number) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geometry, circularPoints(new THREE.PointsMaterial({ color, size, opacity, transparent: true, depthWrite: false })));
}

function label(text: string, x: number, y: number, width = 1.8, color = '#c9d9df') {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
  const context = canvas.getContext('2d'); let texture: THREE.CanvasTexture | null = null;
  if (context) { context.font = '37px monospace'; context.fillStyle = color; context.textAlign = 'center';
    context.textBaseline = 'middle'; context.fillText(text, 384, 48); texture = new THREE.CanvasTexture(canvas); }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.name = `label:${text}`; sprite.position.set(x, y, .5); sprite.scale.set(width, width / 8, 1);
  return { sprite, texture };
}

function withFocus(stage: Stage, targets: Record<string, THREE.Object3D[]>): Stage {
  const all = new Set<THREE.Material>(), byTerm = new Map<string, Set<THREE.Material>>();
  function collect(object: THREE.Object3D, target: Set<THREE.Material>) {
    object.traverse(child => { const material = (child as THREE.Mesh).material;
      if (material) (Array.isArray(material) ? material : [material]).forEach(value => target.add(value)); });
  }
  collect(stage.root, all);
  Object.entries(targets).forEach(([term, objects]) => {
    const materials = new Set<THREE.Material>();
    objects.forEach(object => { object.userData.focusTerms = [...(object.userData.focusTerms ?? []), term]; collect(object, materials); });
    byTerm.set(term, materials);
  });
  const base = new Map([...all].map(material => [material, { opacity: material.opacity,
    color: 'color' in material ? (material.color as THREE.Color).clone() : null }]));
  const highlight = new THREE.Color('#fff4cd');
  let focus: string | null = null;
  const apply = () => {
    const selected = focus ? byTerm.get(focus) : null;
    all.forEach(material => { const initial = base.get(material)!; const active = !focus || selected?.has(material);
      material.opacity = initial.opacity * (active ? 1 : Math.max(.23, Number(material.userData.minimumFocusOpacity ?? 0)));
      if (initial.color && 'color' in material) { (material.color as THREE.Color).copy(initial.color);
        if (focus && active) (material.color as THREE.Color).lerp(highlight, .25); }
    });
    stage.root.userData.focus = focus;
  };
  const update = stage.update;
  stage.update = (p, ambient) => { base.forEach((initial, material) => { material.opacity = initial.opacity; });
    update(clamp(p), ambient); base.forEach((initial, material) => { initial.opacity = material.opacity; }); apply(); };
  stage.setFocus = term => { focus = resolveCosmicFocus(stage.id, term); apply(); };
  stage.root.userData.focusTerms = COSMIC_FOCUS_TERMS[stage.id as CosmicId];
  stage.root.userData.provenance = 'Ilustracion fisica; no galaxia, redshift ni polarimetria observados del fixture.';
  return stage;
}

function spiral(seed: number, radius = 3.1) {
  const random = randomSource(seed), positions: number[] = [], colors: number[] = [];
  for (let i = 0; i < 5300; i++) {
    const central = i < 1400, r = central ? Math.pow(random(), 1.5) * .75 : (.16 + Math.pow(random(), .75) * .84) * radius;
    const arm = i % 4, angle = central ? random() * Math.PI * 2 : arm * Math.PI / 2 + r * 1.58 + (random() - .5) * .27;
    positions.push(Math.cos(angle) * r, (random() - .5) * (central ? .45 : .1), Math.sin(angle) * r * .79);
    const tint = new THREE.Color(central ? '#e9d8ae' : i % 7 === 0 ? '#f09ca0' : '#a3cde6');
    tint.multiplyScalar(.4 + random() * .6); colors.push(tint.r, tint.g, tint.b);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, circularPoints(new THREE.PointsMaterial({ size: .026, vertexColors: true, transparent: true, opacity: .92, depthWrite: false })));
}

function wave(length = 1.7, color = '#91d9e8') {
  const positions: number[] = [];
  for (let n = 0; n <= 96; n++) { const x = (n / 96 - .5) * length, envelope = Math.exp(-((x / length) ** 2) * 20);
    positions.push(x, Math.sin(n * .52) * envelope * .19, Math.cos(n * .52) * envelope * .08); }
  return line(positions, color, .98);
}

function hostStage(): Stage {
  const root = new THREE.Group(), disk = spiral(20200428, 2.55); disk.rotation.x = .32;
  disk.material.userData.minimumFocusOpacity = .65; root.add(disk);
  const source = new THREE.Mesh(new THREE.SphereGeometry(.072, 12, 8), new THREE.MeshBasicMaterial({ color: '#f7cc94' }));
  source.position.set(-1.05, .22, .35); root.add(source);
  const localGas: number[] = [], random = randomSource(130);
  for (let i = 0; i < 260; i++) localGas.push(-1.05 + (random() - .5) * 1.1, .22 + (random() - .5) * .75, .35 + (random() - .5) * .75);
  const gas = points(localGas, '#79d0c8', .034, .58); gas.material.userData.minimumFocusOpacity = .65; root.add(gas);
  const route = line([-1.05, .22, .4, 3.35, .22, .4], '#d0b484', .4); root.add(route);
  const pulse = wave(1.4); (pulse.material as THREE.LineBasicMaterial).userData.minimumFocusOpacity = .6;
  pulse.position.y = .22; pulse.position.z = .45; root.add(pulse);
  const sourceName = label('galaxia anfitriona', -.7, -1.75, 2.65);
  const relation = label('emitido / observado', 1.45, 1.48, 2.65);
  const hostDm = formulaSprite('host-dm', -.8, 1.02, 3, '#9edfd5'); root.add(sourceName.sprite, relation.sprite, hostDm.sprite);
  const width = line([-.5, -.9, .6, .5, -.9, .6, -.5, -.98, .6, -.5, -.82, .6, .5, -.98, .6, .5, -.82, .6], '#f1c783', .86, true); root.add(width);
  return withFocus({ id: 'anfitriona', mobileScale: 1.44, root, camera: v(1, 4.1, 10.4), target: v(.1, .1),
    update: p => { pulse.position.x = -1.05 + p * 4.1; pulse.scale.x = 1 + p * .3; width.scale.x = 1 + p * .3;
      width.position.x = pulse.position.x; root.userData.redshiftIllustrative = .3; root.userData.hostRestDm = 130;
      root.userData.hostObservedDm = 100; root.userData.eventLocalX = pulse.position.x; },
    dispose: () => [sourceName, relation, hostDm].forEach(value => value.texture?.dispose()),
  }, { host: [gas, disk, hostDm.sprite], redshift: [relation.sprite, route, pulse], frequency: [pulse], duration: [width, pulse] });
}

function milkyWayStage(observation?: ObservationCase): Stage {
  const galactic = observation?.origin === 'galactic', frequencies = channelFrequencies(observation), indices = channelIndices(observation);
  const root = new THREE.Group(), disk = spiral(1935); disk.rotation.x = .32;
  disk.material.userData.minimumFocusOpacity = .65; root.add(disk);
  const random = randomSource(50), haloPositions: number[] = [];
  for (let i = 0; i < 960; i++) { const angle = random() * Math.PI * 2, z = (random() - .5) * 2, r = Math.sqrt(1 - z * z);
    const radius = 3.3 + random() * .7; haloPositions.push(Math.cos(angle) * r * radius, z * radius * .51, Math.sin(angle) * r * radius * .82); }
  const halo = points(haloPositions, '#81c3ce', .028, .38); halo.material.userData.minimumFocusOpacity = .6; root.add(halo);
  const solar = new THREE.Mesh(new THREE.SphereGeometry(.064, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe28b' }));
  solar.position.set(1.55, .09, .06); root.add(solar);
  const source = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 8), new THREE.MeshBasicMaterial({ color: '#ed9b91' }));
  source.position.set(-.1, .1, .24); source.visible = galactic; root.add(source);
  const solarGuide = line([1.55, .09, .1, 2.1, .8, .1], '#eed898', .85); root.add(solarGuide);
  const solarLabel = label('Sol', 2.1, .93, .5, '#ffe28b'), galaxyLabel = label('Via Lactea', -.12, -1.95, 1.7);
  const sourceLabel = label('PSR J1745-2900', -.6, .61, 1.35, '#edaa9e'); sourceLabel.sprite.visible = galactic;
  root.add(solarLabel.sprite, galaxyLabel.sprite, sourceLabel.sprite);
  const incoming = line([-4, .1, .15, -3, .1, .15], '#c5bdab', .7), haloPath = line([-3, .1, .15, -2.1, .1, .15], '#8fd8db', .95);
  const diskPath = line([-2.1, .1, .15, 1.55, .1, .15], '#eed3a2', .95); root.add(incoming, haloPath, diskPath);
  const galacticPath = line([-.1, .1, .24, 1.55, .1, .24], '#edc283', .95); galacticPath.visible = galactic; root.add(galacticPath);
  incoming.visible = haloPath.visible = diskPath.visible = !galactic;
  const packets = frequencies.map((frequency, i) => {
    const packet = wave(.9, COLORS[i]); packet.position.set(-4, .1 + (i - 2.5) * .115, .24);
    (packet.material as THREE.LineBasicMaterial).userData.minimumFocusOpacity = .65;
    packet.userData.frequencyMHz = frequency; packet.userData.channelIndex = indices[i]; root.add(packet); return packet;
  });
  const delays = new Float64Array(6);
  const bars = new THREE.Group(), labels: ReturnType<typeof label>[] = [];
  const names = galactic ? ['ISM: DM 1770', '', '', ''] : ['host 100', 'IGM 280', 'halo 50', 'disco 70'];
  const values = galactic ? [observation!.dm, 0, 0, 0] : [100, 280, 50, 70], colors = ['#ed939a', '#e4c581', '#81c3ce', '#b6cfe7'];
  const fills = values.map((value, i) => { const fill = new THREE.Mesh(new THREE.BoxGeometry(1, .09, .035), new THREE.MeshBasicMaterial({ color: colors[i] }));
    fill.position.set(-.6, 2.12 - i * .22, .35); fill.scale.x = galactic ? 2.6 : value / 100; fill.visible = !galactic || i === 0; bars.add(fill);
    const name = label(names[i], 2.2, fill.position.y, 1.22, colors[i]); name.sprite.visible = !galactic || i === 0;
    labels.push(name); bars.add(name.sprite); return fill; });
  root.add(bars);
  return withFocus({ id: 'galaxia', mobileScale: 1.47, root, camera: v(1.55, 4.3, 12), target: v(.1, .1, .15),
    cameraAt: createTravelCamera(galactic ? GALACTIC_CAMERA.map((frame, i) => ({ ...frame,
      target: [[0, .1, .15], [.35, .1, .18], [.95, .1, .22], [1.25, .1, .24]][i] as [number, number, number] })) : GALACTIC_CAMERA),
    update: p => { const referenceX = galactic ? -.1 + p * 1.65 : -4 + p * 5.55;
      const haloProgress = clamp((referenceX + 3) / .9), diskProgress = clamp((referenceX + 2.1) / 3.65);
      const accumulatedDm = galactic ? observation!.dm : 380 + 50 * haloProgress + 70 * diskProgress;
      packets.forEach((packet, i) => {
        delays[i] = 4148.808 * accumulatedDm * (frequencies[i] ** -2 - frequencies[5] ** -2);
        packet.position.x = referenceX - delays[i] * 2.25; packet.userData.delaySeconds = delays[i];
      });
      fills[2].scale.x = Math.max(.001, haloProgress * .5); fills[3].scale.x = Math.max(.001, diskProgress * .7);
      root.userData.dmComponents = galactic ? { interstellar: observation!.dm, hostObserved: 0, igmObserved: 0 }
        : { hostObserved: 100, igmObserved: 280, halo: 50 * haloProgress, disk: 70 * diskProgress };
      root.userData.dmObserved = accumulatedDm; root.userData.eventLocalX = referenceX;
      root.userData.frequencyMHz = frequencies; root.userData.delaySeconds = delays;
      root.userData.travelPhase = galactic ? p < .3 ? 'fuente en la Via Lactea' : 'trayecto interestelar'
        : referenceX < -3 ? 'halo exterior' : referenceX < -2.1 ? 'entrada al halo' : p < .8 ? 'dentro del disco' : 'vecindad solar';
      root.userData.origin = galactic ? 'galactic' : 'extragalactic';
      root.userData.scale = 'Geometria ilustrativa; Sol fuera del centro; no linea de vision observada.'; },
    dispose: () => [solarLabel, galaxyLabel, sourceLabel, ...labels].forEach(value => value.texture?.dispose()),
  }, { halo: galactic ? [source, sourceLabel.sprite] : [halo, haloPath, fills[2], labels[2].sprite],
    disk: galactic ? [disk, galacticPath] : [disk, diskPath, fills[3], labels[3].sprite],
    igm: galactic ? [solar, solarGuide, solarLabel.sprite] : [incoming, fills[1], labels[1].sprite],
    total: [bars, solar, source, sourceLabel.sprite, galacticPath, solarGuide, solarLabel.sprite, ...packets] });
}

function polarizationStage(observation?: ObservationCase): Stage {
  const root = new THREE.Group(), waveGeometry = new THREE.BufferGeometry();
  const buffer = new Float32Array(192 * 3); waveGeometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
  const electric = new THREE.Line(waveGeometry, new THREE.LineBasicMaterial({ color: '#a3dfed', transparent: true, opacity: .95 })); root.add(electric);
  const axis = line([-3.1, 0, 0, 3.35, 0, 0, 3.35, 0, 0, 3.04, .14, 0, 3.35, 0, 0, 3.04, -.14, 0], '#798e9c', .65, true); root.add(axis);
  const fieldVector = line([0, 0, 0, 0, 1, 0], '#f2cb7c', 1), ellipse = line(Array(97 * 3).fill(0), '#f2cb7c', .95);
  const ellipseAttribute = ellipse.geometry.getAttribute('position') as THREE.BufferAttribute;
  const fieldAttribute = fieldVector.geometry.getAttribute('position') as THREE.BufferAttribute;
  const screenX = .7; root.add(fieldVector, ellipse);
  const stokesRoot = new THREE.Group(), stokesBars: THREE.Mesh[] = [], labels: ReturnType<typeof label>[] = [];
  ['I', 'Q', 'U', 'V'].forEach((name, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.15, 1, .05), new THREE.MeshBasicMaterial({ color: ['#d7e5e9', '#f1bc86', '#80d5bd', '#afa6df'][i] }));
    bar.position.set(1.55 + i * .44, -1.18, .65); stokesBars.push(bar); stokesRoot.add(bar);
    const text = label(name, bar.position.x, -1.83, .24); labels.push(text); stokesRoot.add(text.sprite);
  }); root.add(stokesRoot);
  const magnetized = line([-.2, .87, -.2, .55, .87, -.2, .55, .87, -.2, .37, .98, -.2, .55, .87, -.2, .37, .76, -.2], '#81c7bb', .97, true);
  const screen = line([.68, -1.05, -.9, .68, 1.05, -.9, .68, 1.05, -.9, .68, 1.05, .9,
    .68, 1.05, .9, .68, -1.05, .9, .68, -1.05, .9, .68, -1.05, -.9], '#83c9c2', .4, true); root.add(magnetized, screen);
  const sampled = channelFrequencies(observation);
  const output = new THREE.Group(), outputAngles = [0, 0, 0], frequencies = [sampled[0], (sampled[0] + sampled[5]) / 2, sampled[5]];
  const rays = frequencies.map((frequency, i) => { const ray = line([0, -.43, 0, 0, .43, 0], COLORS[i * 2], .98);
    ray.position.set(1.85 + i * .45, .3, 0); output.add(ray); return ray; }); root.add(output);
  const angleArc = line(Array(49 * 3).fill(0), '#ffe39c', .9), angleAttribute = angleArc.geometry.getAttribute('position') as THREE.BufferAttribute; root.add(angleArc);
  const annotations = [label('E transversal', -1.9, 1.33, 1.9), label('B paralelo', .22, 1.17, 1.45, '#8cdbca'),
    label('pantalla Faraday', .75, -1.37, 2.1), label(observation?.id === 'alma-hf' ? '85.30 / 86.27 / 87.24 GHz' : '1203 / 1400 / 1597 MHz', 2.07, 1.08, 2.35)];
  annotations.forEach(value => root.add(value.sprite));
  const base: JonesVector = { y: [1, 0], z: [0, -.32] }; const rm = 24, chi0 = .16;
  const diagnostics = { I: 0, Q: 0, U: 0, V: 0 };
  return withFocus({ id: 'polarizacion', mobileScale: 1.45, root, camera: v(2.5, 2.9, 10.5), target: v(.1, -.1),
    update: p => {
      const referenceMHz = observation ? (observation.frequencyLowMHz + observation.frequencyHighMHz) / 2 : 1500;
      const angle = faradayAngle(chi0, rm * p, 299792458 / (referenceMHz * 1e6)), rotated = rotateJones(base, angle);
      const phase = p * Math.PI * 4, screenPhase = (screenX + 3) / 6 * Math.PI * 10 - phase;
      const ey = rotated.y[0] * Math.cos(screenPhase) - rotated.y[1] * Math.sin(screenPhase);
      const ez = rotated.z[0] * Math.cos(screenPhase) - rotated.z[1] * Math.sin(screenPhase);
      for (let n = 0; n < 192; n++) { const x = -3 + n / 191 * 6, phi = n / 191 * Math.PI * 10 - phase;
        const localAngle = faradayAngle(chi0, rm * p * clamp((x + .2) / .9), 299792458 / (referenceMHz * 1e6));
        const c = Math.cos(localAngle), s = Math.sin(localAngle), cy = Math.cos(phi), sz = .32 * Math.sin(phi);
        buffer[n * 3] = x; buffer[n * 3 + 1] = (c * cy - s * sz) * .45;
        buffer[n * 3 + 2] = (s * cy + c * sz) * .45;
      } (waveGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      fieldAttribute.setXYZ(0, screenX, 0, 0); fieldAttribute.setXYZ(1, screenX, ey * .8, ez * .8); fieldAttribute.needsUpdate = true;
      for (let n = 0; n <= 96; n++) { const theta = n / 96 * Math.PI * 2;
        ellipseAttribute.setXYZ(n, screenX, (rotated.y[0] * Math.cos(theta) - rotated.y[1] * Math.sin(theta)) * .8,
          (rotated.z[0] * Math.cos(theta) - rotated.z[1] * Math.sin(theta)) * .8); } ellipseAttribute.needsUpdate = true;
      Object.assign(diagnostics, stokesFromJones(rotated));
      const values = [diagnostics.I, diagnostics.Q, diagnostics.U, diagnostics.V];
      stokesBars.forEach((bar, i) => { bar.scale.y = Math.max(.005, Math.abs(values[i]) * .75);
        bar.position.y = -1.18 + values[i] * .375; bar.userData.value = values[i]; });
      rays.forEach((ray, i) => { const angle = faradayAngle(chi0, rm * p, 299792458 / (frequencies[i] * 1e6));
        ray.rotation.x = angle; outputAngles[i] = angle; });
      for (let n = 0; n <= 48; n++) { const theta = n / 48 * angle;
        angleAttribute.setXYZ(n, screenX + .01, Math.cos(theta) * .95, Math.sin(theta) * .95); } angleAttribute.needsUpdate = true;
      root.userData.stokes = diagnostics; root.userData.rotationMeasure = rm * p; root.userData.polarizationAngle = angle;
      root.userData.outputAngles = outputAngles; root.userData.stokesConvention = 'V=2 Im(E_y conj(E_z)); normalized Jones amplitudes';
    }, dispose: () => [...labels, ...annotations].forEach(value => value.texture?.dispose()),
  }, { field: [electric, fieldVector, axis, annotations[0].sprite], stokes: [stokesRoot], rotation: [magnetized, screen, annotations[1].sprite, annotations[2].sprite],
    wavelength: [output, annotations[3].sprite], angle: [ellipse, angleArc] });
}

function earthStage(observation?: ObservationCase): Stage {
  const arecibo = observation?.observatory === 'arecibo', hf = observation?.id === 'alma-hf';
  const site = arecibo ? ARECIBO : CHAJNANTOR, finalScale = arecibo ? .32 : .52;
  const root = new THREE.Group();
  let texture: THREE.Texture | null = null, disposed = false;
  const surface = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9, metalness: 0, emissive: '#182637', emissiveIntensity: .24,
    transparent: true });
  surface.userData.minimumFocusOpacity = .62;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.42, 48, 32), surface);
  earth.name = 'earth:surface'; earth.position.set(1.77, -.46, -.2);
  const chileNormal = geographicalNormal(site.latitudeDegrees, site.longitudeDegrees);
  earth.quaternion.setFromUnitVectors(chileNormal, v(0, 0, 1)); root.add(earth);
  const chile = new THREE.Mesh(new THREE.RingGeometry(.05, .082, 32), new THREE.MeshBasicMaterial({ color: '#ffe39d',
    transparent: true, opacity: .96, depthWrite: false }));
  chile.name = arecibo ? 'earth:arecibo' : 'earth:chajnantor'; chile.position.set(earth.position.x, earth.position.y, earth.position.z + 1.425); root.add(chile);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.45, 32, 24), new THREE.MeshBasicMaterial({ color: '#88c8e7', opacity: .07, transparent: true, side: THREE.BackSide, depthWrite: false }));
  atmosphere.position.copy(earth.position); root.add(atmosphere);
  const observatory = arecibo ? createAreciboObservatory() : createAlmaObservatory();
  observatory.root.position.set(1.6, -.4, .55); observatory.root.scale.setScalar(.08); root.add(observatory.root);
  observatory.setReveal(0);
  const receiver = new THREE.Group(); receiver.name = hf ? 'earth:illustrative-hf-feed' : 'earth:illustrative-lf-feed';
  receiver.position.set(1.8, .06, 1.31); receiver.rotation.z = -Math.atan(.42);
  receiver.userData.provenance = observation?.provenance ?? 'LF reception schematic, not an ALMA measurement.';
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b9c7cc', side: THREE.DoubleSide, roughness: .55 }));
  dish.rotation.z = Math.PI / 2; receiver.add(dish); dish.visible = !observation;
  const feedOffset = observation ? 0 : -.24;
  const feed = line([feedOffset, -.12, 0, feedOffset, .12, 0, feedOffset, 0, -.12, feedOffset, 0, .12], '#ffe5a2', .96, true); receiver.add(feed);
  const support = line([0, 0, 0, .28, -.24, 0, -.25, 0, 0, .06, .18, .12, -.25, 0, 0, .06, -.18, -.12], '#d0dce0', .9, true);
  support.visible = !observation; receiver.add(support); root.add(receiver);
  const frequencies = channelFrequencies(observation), indices = channelIndices(observation), dm = observation?.dm ?? 500;
  const delays = frequencies.map(frequency => 4148.808 * dm * (frequency ** -2 - frequencies[5] ** -2));
  const downstream = new THREE.Quaternion().setFromUnitVectors(v(1, 0, 0), v(1, -.42, 0).normalize());
  const packetRotations = frequencies.map(frequency => downstream.clone().multiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0),
    faradayAngle(.16, 24, 299792458 / (frequency * 1e6)))));
  const packets = frequencies.map((frequency, i) => { const packet = wave(1.2, COLORS[i]); packet.position.set(-3, .5 + (i - 2.5) * .105, 1.31); root.add(packet);
    packet.userData.frequencyMHz = frequency; packet.userData.delaySeconds = delays[i]; packet.userData.channelIndex = indices[i]; return packet; });
  let feedX = receiver.position.x + feedOffset * Math.cos(receiver.rotation.z);
  let feedY = receiver.position.y + feedOffset * Math.sin(receiver.rotation.z);
  const arrivalTimeScale = hf ? effectiveDt(observation!) : Math.max(delays[0], .001);
  const arrivalProgress = new Float64Array(delays.map(delay => .48 + delay / arrivalTimeScale * .36));
  const receivedBands = new Uint8Array(6);
  const receptionGeometry = new THREE.SphereGeometry(.038, 10, 8);
  const receivedMarkers = frequencies.map((frequency, i) => {
    const marker = new THREE.Mesh(receptionGeometry, new THREE.MeshBasicMaterial({ color: COLORS[i], transparent: true, opacity: .9 }));
    marker.position.set(feedX + .03, feedY + (i - 2.5) * .065, 1.36); marker.visible = false;
    marker.userData.frequencyMHz = frequency; marker.userData.arrivalProgress = arrivalProgress[i]; root.add(marker); return marker;
  });
  const arrivals = line([-.1, -.78, 1.7, 3.5, -.78, 1.7], '#9aadb9', .6); root.add(arrivals);
  const timeMarkers = delays.map((delay, i) => line([3.2 - delay * 3, -.88, 1.7, 3.2 - delay * 3, -.66, 1.7], COLORS[i], .95)); timeMarkers.forEach(marker => root.add(marker));
  const labels = [label(arecibo ? 'Tierra / Puerto Rico' : 'Tierra / Chile', 2.1, 1.2, 1.65), label(hf ? 'frentes casi simultaneos' : 'frentes dispersos', -.8, 1.87, 2.15),
    label(hf ? '85.299 - 87.237 GHz' : '1203 - 1597 MHz', -.8, 1.62, 1.87), formulaSprite(hf ? 'delay-law' : 'delay', 1.45, -1.07, hf ? 3 : 2.16),
    label(hf ? 'feed HF ilustrativo' : 'recepcion LF ilustrativa', 1.85, .45, 2.5),
    label(arecibo ? 'Arecibo / Puerto Rico' : 'Chajnantor / 5000 m', 1.3, .88, .85),
    label(arecibo ? 'Historico: D = 305 m' : 'ALMA: mm/submm', 1.3, .74, .75)];
  labels.forEach(value => root.add(value.sprite));
  const labelScales = labels.map(value => value.sprite.scale.clone());
  const polarization = line([0, -.28, 0, 0, .28, 0], '#ffe5a2', .96); root.add(polarization);
  return withFocus({ id: 'tierra', mobileScale: 1.5, root, camera: v(1.6, 2.1, 11.5), target: v(.1, -.2),
    cameraAt: createTravelCamera(arecibo ? [EARTH_CAMERA[0],
      { progress: .3, camera: [1.6, 2.3, 8.4], target: [1.65, .3, 1.1] },
      { progress: .57, camera: [1.6, 1.8, 6.8], target: [1.65, .4, .6] },
      { progress: 1, camera: [1.6, 2.2, 6.7], target: [1.6, .25, .05] }] : EARTH_CAMERA),
    update: p => {
      if (!texture && !disposed) {
        texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}media/earth-blue-marble.png`, loaded => {
          if (disposed) { loaded.dispose(); return; }
          loaded.colorSpace = THREE.SRGBColorSpace; surface.map = loaded; surface.color.set('#ffffff'); surface.needsUpdate = true;
          root.userData.assetReady = true; root.userData.requestRender?.();
        });
        texture.colorSpace = THREE.SRGBColorSpace; surface.map = texture; surface.needsUpdate = true;
      }
      const valleyReveal = THREE.MathUtils.smoothstep(p, .3, .62), surfaceFade = 1 - THREE.MathUtils.smoothstep(p, .42, .72);
      surface.opacity = surfaceFade; earth.visible = surfaceFade > 0;
      atmosphere.material.opacity = .07 * surfaceFade; atmosphere.visible = surfaceFade > 0;
      chile.material.opacity = .96 * surfaceFade; chile.visible = surfaceFade > 0;
      observatory.setReveal(valleyReveal); observatory.root.scale.setScalar(.08 + (finalScale - .08) * valleyReveal);
      if (observation) {
        receiver.position.copy(observatory.feeds[arecibo ? 0 : 4]).multiplyScalar(observatory.root.scale.x).add(observatory.root.position);
        feedX = receiver.position.x; feedY = receiver.position.y;
      }
      labels[0].sprite.visible = surfaceFade > .1 && valleyReveal < .5;
      labels[1].sprite.visible = p < .68; labels[2].sprite.visible = p < .68;
      labels[3].sprite.visible = p < .82; labels[4].sprite.visible = p < .8;
      labels[5].sprite.visible = valleyReveal > .6; labels[6].sprite.visible = valleyReveal > .6;
      labels.slice(0, 5).forEach((value, i) => value.sprite.scale.copy(labelScales[i]).multiplyScalar(1 - .65 * valleyReveal));
      receiver.visible = valleyReveal > .15 && p < .85;
      let receivedCount = 0;
      packets.forEach((packet, i) => {
        packet.position.x = Math.min(feedX, feedX + (p - arrivalProgress[i]) * 5.6);
        packet.position.y = feedY + (i - 2.5) * .065 - (packet.position.x - feedX) * .42;
        packet.position.z = receiver.position.z;
        packet.quaternion.copy(packetRotations[i]);
        const opacity = 1 - clamp((p - arrivalProgress[i]) / .09);
        (packet.material as THREE.LineBasicMaterial).opacity = opacity; packet.visible = opacity > 0;
        receivedBands[i] = p >= arrivalProgress[i] ? 1 : 0; receivedCount += receivedBands[i];
        receivedMarkers[i].visible = Boolean(receivedBands[i]);
        receivedMarkers[i].position.set(feedX + .03, feedY + (i - 2.5) * .065, receiver.position.z + .05);
      });
      polarization.position.copy(packets[3].position); polarization.position.z += .03;
      polarization.quaternion.copy(packetRotations[3]); polarization.visible = packets[3].visible;
      root.userData.frequencyMHz = frequencies; root.userData.delaySeconds = delays; root.userData.dispersionDm = dm;
      root.userData.dispersionEffectiveBins = observation ? delays[0] / effectiveDt(observation) : delays[0] / .001;
      root.userData.arrivalProgress = arrivalProgress; root.userData.receivedBands = receivedBands; root.userData.receivedCount = receivedCount;
      root.userData.receiverX = feedX;
      root.userData.eventLocalX = packets[5].position.x;
      root.userData.earthAsset = 'NASA/GSFC SVS Blue Marble, 1024x512';
      root.userData.site = site; root.userData.geographicNormal = chileNormal;
      root.userData.valleyReveal = valleyReveal; root.userData.surfaceOpacity = surfaceFade;
      root.userData.travelPhase = p < .3 ? 'orbita terrestre' : p < .62 ? arecibo ? 'descenso a Puerto Rico' : 'descenso a Chile'
        : arecibo ? 'valle de Arecibo' : 'valle de Chajnantor';
      root.userData.scaleTransition = 'Cambio continuo de escala ilustrativo: orbita, Chile, valle; no trayectoria ni topografia medidas.';
    }, dispose: () => { disposed = true; texture?.dispose(); observatory.dispose?.(); labels.forEach(value => value.texture?.dispose()); },
  }, { frequency: [...packets, ...receivedMarkers, labels[1].sprite, labels[2].sprite], delay: [arrivals, ...timeMarkers, labels[3].sprite],
    field: [polarization], receiver: [earth, atmosphere, chile, receiver, observatory.root, ...receivedMarkers, labels[0].sprite,
      labels[4].sprite, labels[5].sprite, labels[6].sprite] });
}

export function createCosmicStages(observation?: ObservationCase): Stage[] {
  const stages = [hostStage(), milkyWayStage(observation), polarizationStage(observation), earthStage(observation)];
  if (observation) stages.forEach(stage => {
    stage.root.userData.observationCase = observation.id; stage.root.userData.provenance = observation.provenance;
  });
  return stages;
}
