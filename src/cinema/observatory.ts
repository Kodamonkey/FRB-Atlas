import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CHAJNANTOR = {
  latitudeDegrees: -23.029, longitudeDegrees: -67.755, altitudeMeters: 5000,
  source: 'https://almascience.eso.org/about-alma/alma-site',
  bandNote: 'ALMA mm/submm: ubicacion ilustrativa, no observacion del fixture LF 1.2-1.6 GHz.',
} as const;

export const OBSERVATORY_LAYOUT: readonly (readonly [number, number])[] = [
  [-3.2, -1.7], [-.6, -2.1], [2.2, -1.8], [-2.3, 1.3], [.4, 1.5], [3.2, 1.2],
];

export const ALMA_OPTICS = {
  primaryDiameterMeters: 12, focalLengthMeters: 4.8, secondaryDiameterMeters: .75,
  shape: 'paraboloid', mount: 'altazimuth', supportLegs: 4,
  source: 'https://safe.nrao.edu/wiki/pub/Main/AlmaReference/ALMA-34.00.00.00-006-A-SPE.pdf',
} as const;

export const ARECIBO = {
  latitudeDegrees: 18.34422, longitudeDegrees: -66.7527,
  primaryDiameterMeters: 305, curvatureRadiusMeters: 265.176,
  towerOffsetMeters: 213.36, mainCableCount: 18, feedBeamCount: 7,
  shape: 'fixed spherical reflector', historical: true,
  source: 'https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn:nasa:pds:context:telescope:arecibo.305m',
  engineeringSource: 'https://www.naic.edu/arecibo/phil/hardware/arecibo2.0/arecibo2.0.html',
  discoverySource: 'https://arxiv.org/abs/1404.2934',
  receiverSource: 'https://www.nsf.gov/funding/opportunities/management-operations-arecibo-observatory/505401/nsf17-538/solicitation',
  bandNote: 'FRB 121102 fue descubierto con Arecibo/PALFA a 1.4 GHz. El fixture LF es sintetico, no sus datos observados.',
} as const;

export interface Observatory {
  root: THREE.Group;
  terrain: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  dishes: THREE.Group;
  /** Optical reception points in root-local coordinates; callers apply root.matrixWorld. */
  feeds: THREE.Vector3[];
  materials: THREE.Material[];
  setReveal: (progress: number) => void;
  dispose: () => void;
}
const TERRAIN_PEAKS = [[-8.5, -9, 2.9, 3.2], [2.8, -12.5, 4.4, 3.5], [9.5, -8.5, 3.6, 3.2], [-11.4, -3.5, 1.9, 2.8]] as const;

export function geographicalNormal(latitudeDegrees: number, longitudeDegrees: number): THREE.Vector3 {
  if (![latitudeDegrees, longitudeDegrees].every(Number.isFinite) || Math.abs(latitudeDegrees) > 90) throw new RangeError('Invalid geographic coordinates.');
  const lat = THREE.MathUtils.degToRad(latitudeDegrees), lon = THREE.MathUtils.degToRad(longitudeDegrees);
  // SphereGeometry's equirectangular UV convention: longitude zero lies at +x and east points toward -z.
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

export function chajnantorHeight(x: number, z: number): number {
  let height = -.28;
  for (const [cx, cz, amplitude, width] of TERRAIN_PEAKS) {
    const distance = ((x - cx) ** 2 + (z - cz) ** 2) / width ** 2;
    height += amplitude * Math.exp(-distance) * (1 + .06 * Math.sin(x * 2.6 + z * 3.1));
  }
  const centralFlatness = Math.min(1, Math.max(0, (Math.hypot(x, z) - 3.3) / 4));
  return height + centralFlatness * (.055 * Math.sin(x * 2.1) * Math.cos(z * 1.8) + .032 * Math.sin(x * 6.4 + z * 4.8));
}

export function createChajnantorTerrain(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.PlaneGeometry(30, 34, 96, 100); geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, -3);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3), color = new THREE.Color(), low = new THREE.Color('#343c3a'), high = new THREE.Color('#6e625c');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), height = chajnantorHeight(x, z);
    position.setY(i, height);
    const roughness = .08 * Math.sin(x * 13.4 + z * 8.7) + .06 * Math.cos(x * 2.7 - z * 3.3);
    color.lerpColors(low, high, Math.max(0, Math.min(1, .28 + height / 5 + roughness)));
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  terrain.name = 'chajnantor:terrain'; terrain.userData.provenance = 'Procedural terrain: qualitative plateau and ridges, not surveyed topography.';
  terrain.material.userData.minimumFocusOpacity = .72;
  return terrain;
}

function surfaceGeometry(radius: number, heightAt: (radius: number) => number, rings: number, sectors: number, hole = 0): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) for (let sector = 0; sector <= sectors; sector++) {
    const r = hole + ring / rings * (radius - hole), phi = sector / sectors * Math.PI * 2;
    positions.push(r * Math.cos(phi), heightAt(r), r * Math.sin(phi));
    uv.push(.5 + r * Math.cos(phi) / (radius * 2), .5 + r * Math.sin(phi) / (radius * 2));
    if (ring < rings && sector < sectors) {
      const i = ring * (sectors + 1) + sector;
      indices.push(i, i + sectors + 1, i + 1, i + 1, i + sectors + 1, i + sectors + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function mergeOwned(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Incompatible observatory geometry.');
  return geometry;
}

function lines(points: number[], color: string, name: string, opacity = 1): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  object.name = name; return object;
}

function addSegment(points: number[], a: THREE.Vector3, b: THREE.Vector3): void {
  points.push(a.x, a.y, a.z, b.x, b.y, b.z);
}

function finishObservatory(root: THREE.Group, terrain: Observatory['terrain'], dishes: THREE.Group, feeds: THREE.Vector3[]): Observatory {
  const geometries = new Set<THREE.BufferGeometry>(), uniqueMaterials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  root.traverse(object => {
    if (object instanceof THREE.InstancedMesh) instances.push(object);
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => uniqueMaterials.add(material));
    }
  });
  const materials = [...uniqueMaterials], initialOpacities = materials.map(material => material.opacity);
  materials.forEach(material => { material.transparent = true; material.userData.minimumFocusOpacity = .72; });
  let disposed = false;
  const setReveal = (p: number) => {
    if (disposed) return;
    const reveal = Number.isFinite(p) ? THREE.MathUtils.clamp(p, 0, 1) : 0;
    root.visible = reveal > 0;
    materials.forEach((material, i) => { material.opacity = initialOpacities[i] * reveal; });
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; root.visible = false;
    instances.forEach(instance => instance.dispose());
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };
  return { root, terrain, dishes, feeds, materials, setReveal, dispose };
}

export function createAlmaObservatory(): Observatory {
  const root = new THREE.Group(), terrain = createChajnantorTerrain(), dishes = new THREE.Group();
  const radius = .46, focalLength = radius * ALMA_OPTICS.focalLengthMeters / (ALMA_OPTICS.primaryDiameterMeters / 2);
  const heightAt = (r: number) => r * r / (4 * focalLength);
  const secondary = new THREE.SphereGeometry(radius * ALMA_OPTICS.secondaryDiameterMeters / ALMA_OPTICS.primaryDiameterMeters, 12, 8);
  secondary.scale(1, .36, 1); secondary.translate(0, .335, 0);
  const rim = new THREE.TorusGeometry(radius, .007, 4, 48); rim.rotateX(Math.PI / 2); rim.translate(0, heightAt(radius), 0);
  const reflector = mergeOwned([surfaceGeometry(radius, heightAt, 16, 48, radius * .75 / 12), rim, secondary]);
  reflector.userData.optics = ALMA_OPTICS;
  const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(.64, .64, .04, 24), new THREE.MeshStandardMaterial({ color: '#9dabae', roughness: .95 }), 6);
  const reflectors = new THREE.InstancedMesh(reflector, new THREE.MeshStandardMaterial({ color: '#e1e8e9', metalness: .48, roughness: .32, side: THREE.DoubleSide }), 6);
  const mountParts = [new THREE.CylinderGeometry(.11, .2, .34, 16).translate(0, .19, 0),
    new THREE.CylinderGeometry(.2, .2, .075, 16).translate(0, .4, 0),
    new THREE.BoxGeometry(.35, .2, .3).translate(0, .49, 0),
    new THREE.BoxGeometry(.065, .31, .15).translate(-.235, .625, 0),
    new THREE.BoxGeometry(.065, .31, .15).translate(.235, .625, 0),
    new THREE.CylinderGeometry(.04, .04, .55, 12).rotateZ(Math.PI / 2).translate(0, .76, 0),
    new THREE.BoxGeometry(.15, .14, .15).translate(0, .67, 0)];
  const mounts = new THREE.InstancedMesh(mergeOwned(mountParts), new THREE.MeshStandardMaterial({ color: '#aab6b9', metalness: .27, roughness: .56 }), 6);
  pads.name = 'alma:concrete-pads'; reflectors.name = 'alma:parabolic-reflectors'; mounts.name = 'alma:altazimuth-yokes-pedestals';
  const supports: number[] = [], feeds: THREE.Vector3[] = [], matrix = new THREE.Matrix4(), scale = new THREE.Vector3(1, 1, 1);
  OBSERVATORY_LAYOUT.forEach(([x, z], i) => {
    const floor = chajnantorHeight(x, z), yaw = -.25 + i * .13;
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, yaw, 0)), pivot = new THREE.Vector3(x, floor + .76, z);
    const local = (r: number, angle: number, y: number) => new THREE.Vector3(r * Math.cos(angle), y, r * Math.sin(angle)).applyQuaternion(orientation).add(pivot);
    pads.setMatrixAt(i, matrix.makeTranslation(x, floor + .02, z));
    mounts.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, floor, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), scale));
    reflectors.setMatrixAt(i, matrix.compose(pivot, orientation, scale));
    feeds.push(local(0, 0, .335));
    for (let arm = 0; arm < 4; arm++) {
      const angle = arm / 4 * Math.PI * 2 + Math.PI / 4;
      addSegment(supports, local(.43, angle, heightAt(.43)), local(.022, angle, .335));
    }
    for (let sector = 0; sector < 24; sector++) {
      const a = sector / 24 * Math.PI * 2, b = (sector + 1) / 24 * Math.PI * 2;
      for (const r of [.23, .43]) addSegment(supports, local(r, a, heightAt(r) - .045), local(r, b, heightAt(r) - .045));
      addSegment(supports, local(.09, a, -.045), local(.43, a, heightAt(.43) - .045));
      if (sector % 3 === 0) {
        addSegment(supports, local(.09, a, -.1), local(.43, b, heightAt(.43) - .045));
        addSegment(supports, local(.43, a, heightAt(.43) - .045), local(.43, a, heightAt(.43)));
      }
    }
  });
  const struts = lines(supports, '#66777c', 'alma:backing-truss-quadripod', .9);
  dishes.name = 'alma:antenna-array'; dishes.add(pads, reflectors, mounts, struts); root.add(terrain, dishes);
  root.name = 'chajnantor:observatory'; root.userData.site = CHAJNANTOR; root.userData.optics = ALMA_OPTICS;
  root.userData.layout = 'Six illustrative antennas, not the surveyed 66-antenna ALMA configuration.';
  root.userData.provenance = '12 m parabolic Cassegrain reflectors, quadripods and altazimuth mounts; qualitative pointing and layout.';
  return finishObservatory(root, terrain, dishes, feeds);
}

export const createObservatory = createAlmaObservatory;

const ARECIBO_METERS_PER_UNIT = ARECIBO.primaryDiameterMeters / 10;
const ARECIBO_RADIUS = 5;
const ARECIBO_CURVATURE = ARECIBO.curvatureRadiusMeters / ARECIBO_METERS_PER_UNIT;
const ARECIBO_SAG = ARECIBO_CURVATURE - Math.sqrt(ARECIBO_CURVATURE ** 2 - ARECIBO_RADIUS ** 2);
const TOWER_ANGLES = [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 3 / 2];
const TOWER_BASE_HEIGHTS = [114.603, 115.103, 80.023].map(height => height / ARECIBO_METERS_PER_UNIT - ARECIBO_SAG);
const TOWER_TOP = 190.888 / ARECIBO_METERS_PER_UNIT - ARECIBO_SAG;
const PLATFORM_HEIGHT = 150 / ARECIBO_METERS_PER_UNIT - ARECIBO_SAG;

/** Spherical cap, rim at y=0; one model unit represents 30.5 m. */
export function areciboReflectorHeight(radius: number): number {
  if (!Number.isFinite(radius) || radius < 0 || radius > ARECIBO_RADIUS) throw new RangeError('Radius must lie within the Arecibo aperture.');
  return ARECIBO_CURVATURE - Math.sqrt(ARECIBO_CURVATURE ** 2 - radius ** 2) - ARECIBO_SAG;
}

function areciboKarstHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= ARECIBO_RADIUS) return areciboReflectorHeight(r) - .25;
  let height = -.25;
  const offset = ARECIBO.towerOffsetMeters / ARECIBO_METERS_PER_UNIT;
  TOWER_ANGLES.forEach((angle, i) => {
    const cx = Math.cos(angle) * offset, cz = Math.sin(angle) * offset;
    height += (TOWER_BASE_HEIGHTS[i] + .25) * Math.exp(-(((x - cx) ** 2 + (z - cz) ** 2) / 2.7));
  });
  const outerRelief = THREE.MathUtils.smoothstep(r, 5, 7);
  return height * THREE.MathUtils.smoothstep(r, 5, 6) - .25 * (1 - THREE.MathUtils.smoothstep(r, 5, 6))
    + outerRelief * (.16 * Math.sin(x * .85 + z * .4) ** 2 + .07 * Math.cos(x * 2.5 - z * 1.1));
}

function createAreciboTerrain(): Observatory['terrain'] {
  const geometry = new THREE.PlaneGeometry(30, 32, 96, 100); geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute, colors = new Float32Array(position.count * 3);
  const low = new THREE.Color('#163d31'), high = new THREE.Color('#527559'), rock = new THREE.Color('#788376'), color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), height = areciboKarstHeight(x, z);
    position.setY(i, height);
    color.lerpColors(low, high, THREE.MathUtils.clamp(.35 + height / 4 + .1 * Math.sin(x * 6.1 + z * 8.5), 0, 1));
    color.lerp(rock, THREE.MathUtils.clamp((height - 1.25) * .3, 0, .4));
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  terrain.name = 'arecibo:karst-depression';
  terrain.userData.provenance = 'Procedural Puerto Rico karst depression and vegetated mogotes, not surveyed topography.';
  return terrain;
}

export function createAreciboObservatory(scale = 1): Observatory {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Observatory scale must be finite and positive.');
  const root = new THREE.Group(), terrain = createAreciboTerrain(), dishes = new THREE.Group();
  root.scale.setScalar(scale); root.name = 'arecibo:observatory'; dishes.name = 'arecibo:fixed-aperture-and-suspension';
  root.userData.site = ARECIBO;
  root.userData.metersPerUnit = ARECIBO_METERS_PER_UNIT;
  root.userData.layout = 'Historical pre-2020 Arecibo: one 305 m fixed spherical aperture, three suspension towers, one receiver platform.';
  root.userData.provenance = 'Historical engineering schematic; approximate platform height, tower azimuths and terrain. Not observed FRB 121102 data.';
  const primary = new THREE.Mesh(surfaceGeometry(ARECIBO_RADIUS, areciboReflectorHeight, 40, 96),
    new THREE.MeshStandardMaterial({ color: '#d4dcdd', roughness: .43, metalness: .45, side: THREE.DoubleSide }));
  primary.name = 'arecibo:fixed-spherical-reflector'; primary.userData.optics = ARECIBO;
  const panelPoints: number[] = [];
  for (let axis = 0; axis < 2; axis++) for (let strip = -19; strip <= 19; strip++) {
    const fixed = strip * .25, half = Math.sqrt(ARECIBO_RADIUS ** 2 - fixed ** 2);
    for (let segment = 0; segment < 40; segment++) {
      const a = -half + segment / 40 * half * 2, b = -half + (segment + 1) / 40 * half * 2;
      const point = (v: number) => new THREE.Vector3(axis === 0 ? fixed : v, areciboReflectorHeight(Math.min(ARECIBO_RADIUS, Math.hypot(fixed, v))) + .006, axis === 0 ? v : fixed);
      addSegment(panelPoints, point(a), point(b));
    }
  }
  const panels = lines(panelPoints, '#889a9c', 'arecibo:reflector-panel-grid', .65);
  const towerRadius = ARECIBO.towerOffsetMeters / ARECIBO_METERS_PER_UNIT, matrix = new THREE.Matrix4();
  const towerMaterial = new THREE.MeshStandardMaterial({ color: '#c3c2b5', roughness: .86 });
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), towerMaterial, 3);
  towers.name = 'arecibo:suspension-towers'; towers.userData.count = 3;
  const mainCables: number[] = [], backstays: number[] = [], truss: number[] = [];
  const deckVertices = TOWER_ANGLES.map(angle => new THREE.Vector3(Math.cos(angle) * 1.12, PLATFORM_HEIGHT, Math.sin(angle) * 1.12));
  const addCable = (points: number[], start: THREE.Vector3, end: THREE.Vector3, sag: number) => {
    const point = (t: number) => start.clone().lerp(end, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
    for (let segment = 0; segment < 24; segment++) addSegment(points, point(segment / 24), point((segment + 1) / 24));
  };
  TOWER_ANGLES.forEach((angle, i) => {
    const x = Math.cos(angle) * towerRadius, z = Math.sin(angle) * towerRadius, base = TOWER_BASE_HEIGHTS[i];
    towers.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, (base + TOWER_TOP) / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle), new THREE.Vector3(.32, TOWER_TOP - base, .4)));
    const top = new THREE.Vector3(x, TOWER_TOP, z);
    for (let cable = 0; cable < 6; cable++) {
      const lateral = (cable - 2.5) * .027, start = top.clone().add(new THREE.Vector3(-Math.sin(angle) * lateral, 0, Math.cos(angle) * lateral));
      const end = deckVertices[i].clone().add(new THREE.Vector3(-Math.sin(angle) * lateral, 0, Math.cos(angle) * lateral));
      addCable(mainCables, start, end, .12);
    }
    for (const offset of [-.22, .22]) {
      const anchorAngle = angle + offset, ax = Math.cos(anchorAngle) * 10.2, az = Math.sin(anchorAngle) * 10.2;
      addCable(backstays, top, new THREE.Vector3(ax, areciboKarstHeight(ax, az) + .03, az), .07);
    }
    for (let rung = 0; rung < 12; rung++) {
      const y = base + (TOWER_TOP - base) * rung / 12;
      addSegment(truss, new THREE.Vector3(x - .09, y, z + .23), new THREE.Vector3(x + .09, y, z + .23));
    }
  });
  const cableObject = lines(mainCables, '#b4c4c5', 'arecibo:main-suspension-cables', .95);
  cableObject.userData.cableCount = ARECIBO.mainCableCount;
  const anchors = lines(backstays, '#849d9e', 'arecibo:tower-backstays', .85);
  const shape = new THREE.Shape();
  deckVertices.forEach((vertex, i) => { if (i === 0) shape.moveTo(vertex.x, -vertex.z); else shape.lineTo(vertex.x, -vertex.z); }); shape.closePath();
  const deckGeometry = new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: false });
  deckGeometry.rotateX(-Math.PI / 2); deckGeometry.translate(0, PLATFORM_HEIGHT - .055, 0);
  const platform = new THREE.Mesh(deckGeometry, new THREE.MeshStandardMaterial({ color: '#708389', roughness: .65, metalness: .6 }));
  platform.name = 'arecibo:suspended-platform'; platform.userData.heightIsIllustrative = true;
  deckVertices.forEach((a, i) => {
    const b = deckVertices[(i + 1) % 3], belowA = a.clone().add(new THREE.Vector3(0, -.27, 0)), belowB = b.clone().add(new THREE.Vector3(0, -.27, 0));
    addSegment(truss, a, b); addSegment(truss, belowA, belowB); addSegment(truss, a, belowA);
    for (let panel = 0; panel < 5; panel++) {
      const t = panel / 5, next = (panel + 1) / 5;
      addSegment(truss, a.clone().lerp(b, t), belowA.clone().lerp(belowB, next));
      addSegment(truss, belowA.clone().lerp(belowB, t), a.clone().lerp(b, next));
    }
  });
  const armLength = 100 / ARECIBO_METERS_PER_UNIT;
  for (let panel = 0; panel < 10; panel++) {
    const x = -armLength / 2 + panel / 10 * armLength, nx = x + armLength / 10;
    for (const z of [-.09, .09]) {
      addSegment(truss, new THREE.Vector3(x, PLATFORM_HEIGHT - .18, z), new THREE.Vector3(nx, PLATFORM_HEIGHT - .18, z));
      addSegment(truss, new THREE.Vector3(x, PLATFORM_HEIGHT - .42, z), new THREE.Vector3(nx, PLATFORM_HEIGHT - .42, z));
      addSegment(truss, new THREE.Vector3(x, PLATFORM_HEIGHT - .18, z), new THREE.Vector3(nx, PLATFORM_HEIGHT - .42, z));
    }
  }
  const steelwork = lines(truss, '#d3dedf', 'arecibo:platform-azimuth-arm-truss', .9);
  const receiverCenter = new THREE.Vector3(.55, PLATFORM_HEIGHT - .61, .12);
  const receiverDome = new THREE.SphereGeometry(.36, 24, 14); receiverDome.scale(1, 1.22, 1);
  const dome = new THREE.Mesh(receiverDome, new THREE.MeshStandardMaterial({ color: '#e2e5e2', roughness: .35, metalness: .15 }));
  dome.position.copy(receiverCenter); dome.name = 'arecibo:gregorian-receiver-dome';
  dome.userData.feedArray = 'ALFA: seven beams on one primary aperture, not seven independent antennas.';
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(.25, .19, .26), new THREE.MeshStandardMaterial({ color: '#61787d', roughness: .58, metalness: .4 }));
  carriage.position.set(.55, PLATFORM_HEIGHT - .21, .12); carriage.name = 'arecibo:feed-carriage';
  const feeds = [new THREE.Vector3(.55, PLATFORM_HEIGHT - .48, .12)];
  dishes.add(primary, panels, towers, cableObject, anchors, platform, steelwork, dome, carriage); root.add(terrain, dishes);
  return finishObservatory(root, terrain, dishes, feeds);
}
