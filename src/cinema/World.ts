import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPhysicalStages } from './physicalStages';
import { createDataStages } from './dataStages';
import { createCosmicStages } from './cosmicStages';
import { createMethodStages } from './methodStages';
import { STORY, stageTiming } from '../story';
import type { Sequence } from '../story';
import type { EventEvidence, EvidenceArrays } from '../evidence/types';
import type { InspectionView, RenderQuality, Stage, World } from './types';
import { createHFStages } from '../hf/stages';
import { resolutionRatio, type ObservationCase } from '../observations';
import { clampInspectionRelief, createPlotReliefController, inspectionViewPose, isInspectionStage } from './plotInspection';

type MaterialDefaults = { depthWrite: boolean };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const STAGE_PITCH = 12;
export const EVENT_PORT = 3.5;
const ROUTE_Y = -1.4;

export function eventRouteX(sequence: number, operation: number, handoff: number, count: number): number {
  const index = clamp(Math.floor(sequence), 0, Math.max(0, count - 1));
  const entrance = index * STAGE_PITCH + (index === 0 ? 0 : -EVENT_PORT);
  const exit = index * STAGE_PITCH + EVENT_PORT;
  const result = THREE.MathUtils.lerp(entrance, exit, clamp(operation, 0, 1));
  return index === count - 1 ? result : THREE.MathUtils.lerp(result, (index + 1) * STAGE_PITCH - EVENT_PORT, clamp(handoff, 0, 1));
}

export function assertStageOrder(stages: Pick<Stage, 'id'>[], ids = STORY.map(stage => stage.id)) {
  if (stages.length !== ids.length || stages.some((stage, index) => stage.id !== ids[index])) {
    throw new Error('El orden de escenas no coincide con el relato.');
  }
}

function eventCarrier() {
  const root = new THREE.Group();
  const points: number[] = [];
  for (let i = 0; i < 80; i++) {
    const x = (i / 79 - .5) * .5;
    points.push(x, Math.sin(i * .49) * Math.exp(-x * x * 12) * .10, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  root.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffbe7c', depthTest: false, transparent: true, opacity: .95 })));
  root.add(new THREE.Mesh(new THREE.SphereGeometry(.073, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff8d7b', depthTest: false })));
  root.renderOrder = 20;
  return root;
}

function stars() {
  let seed = 241032;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions: number[] = [], colors: number[] = [];
  for (let i = 0; i < 780; i++) {
    positions.push((random() - 0.5) * 120, (random() - 0.5) * 90, -30 - random() * 95);
    const tint = new THREE.Color(i % 7 === 0 ? '#e8d6bb' : i % 5 === 0 ? '#cfdfef' : '#73909f');
    tint.multiplyScalar(0.48 + random() * 0.5);
    colors.push(tint.r, tint.g, tint.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: 0.085, transparent: true, opacity: 0.7, depthWrite: false }));
}

export function createWorld(host: HTMLElement, options: { quality: RenderQuality; onFailure: (reason: string) => void; story?: Sequence[]; observation?: ObservationCase }): World {
  const story = options.story ?? STORY;
  const extragalactic = story.some(step => step.id === 'anfitriona');
  const hf = options.observation?.id === 'alma-hf';
  const availableStages = [...createPhysicalStages({ ...(extragalactic ? { propagationDm: 380, incomingDm: 100 } : {}), observation: options.observation }),
    ...(hf ? createHFStages() : [...createDataStages(), ...createMethodStages()]), ...createCosmicStages(options.observation)];
  const stagesById = new Map(availableStages.map(stage => [stage.id, stage]));
  const stages = story.map(step => {
    const stage = stagesById.get(step.id);
    if (!stage) throw new RangeError(`Missing visual stage: ${step.id}`);
    return stage;
  });
  for (const stage of availableStages) if (!stages.includes(stage)) stage.dispose?.();
  assertStageOrder(stages, story.map(stage => stage.id));
  const formulaTexts = stages.map(stage => {
    const formulas: string[] = [];
    stage.root.traverse(object => { if (object.userData.formulaTex) formulas.push(object.userData.formulaTex); });
    return formulas;
  });
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  } catch {
    for (const stage of stages) stage.dispose?.();
    options.onFailure('WebGL no disponible. Mostrando fotogramas verificados.');
    return { setProgress: () => {}, setEvidence: () => {}, setPaused: () => {}, setQuality: () => {}, setFocus: () => {},
      setInspection: () => {}, resetInspection: () => {}, setInspectionView: () => {}, setInspectionRelief: () => {}, dispose: () => {} };
  }
  renderer.setClearColor('#080c10');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block'; canvas.style.pointerEvents = 'none';
  host.append(canvas);

  const scene = new THREE.Scene();
  const sky = stars();
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#eff5fc', '#17252d', 2.3));
  const keyLight = new THREE.DirectionalLight('#eef7ff', 3.1);
  keyLight.position.set(-4, 8, 7); scene.add(keyLight);
  const edgeLight = new THREE.DirectionalLight('#98cbd6', 1.4);
  edgeLight.position.set(5, 2, -3); scene.add(edgeLight);
  stages.forEach((stage, index) => { stage.root.position.x += index * STAGE_PITCH; stage.root.visible = false; scene.add(stage.root); });
  const carrier = eventCarrier(); scene.add(carrier);
  const transferPositions: number[] = [];
  for (let index = 0; index < stages.length - 1; index++) {
    const x = index * STAGE_PITCH + EVENT_PORT;
    const gap = STAGE_PITCH - EVENT_PORT * 2;
    transferPositions.push(x, ROUTE_Y, 1.1, x + gap, ROUTE_Y, 1.1);
    const center = x + gap / 2;
    transferPositions.push(center + .22, ROUTE_Y, 1.1, center - .22, ROUTE_Y + .22, 1.1, center + .22, ROUTE_Y, 1.1, center - .22, ROUTE_Y - .22, 1.1);
  }
  const transferGeometry = new THREE.BufferGeometry();
  transferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transferPositions, 3));
  const transfer = new THREE.LineSegments(transferGeometry, new THREE.LineBasicMaterial({ color: '#bfa27d', transparent: true, opacity: .28, depthWrite: false }));
  scene.add(transfer);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 220);
  const poses = stages.map((stage, index) => ({
    camera: stage.camera.clone().add(new THREE.Vector3(index * STAGE_PITCH, 0, 0)),
    target: stage.target.clone().add(new THREE.Vector3(index * STAGE_PITCH, 0, 0)),
    mobileCamera: stage.camera.clone().sub(stage.target).multiplyScalar(stage.mobileScale ?? 1).add(stage.target).add(new THREE.Vector3(index * STAGE_PITCH, 0, 0)),
  }));
  function preparePose(index: number, operation: number) {
    const stage = stages[index];
    const local = stage.cameraAt?.(operation);
    if (!local) return;
    const pose = poses[index];
    pose.camera.copy(local.camera); pose.camera.x += index * STAGE_PITCH;
    pose.target.copy(local.target); pose.target.x += index * STAGE_PITCH;
    pose.mobileCamera.copy(local.camera).sub(local.target).multiplyScalar(stage.mobileScale ?? 1).add(pose.target);
  }
  const target = new THREE.Vector3();
  const defaults = new WeakMap<THREE.Material, MaterialDefaults>();
  let materialLists: THREE.Material[][] = [];
  function indexMaterials(stageIndex?: number) {
    const indexStage = (stage: Stage) => {
      const list = new Set<THREE.Material>();
      stage.root.traverse(object => {
        const material = (object as THREE.Mesh).material;
        if (!material) return;
        for (const entry of Array.isArray(material) ? material : [material]) {
          list.add(entry);
          if (!defaults.has(entry)) defaults.set(entry, { depthWrite: entry.depthWrite });
          entry.transparent = true;
        }
      });
      return [...list];
    };
    if (stageIndex === undefined) materialLists = stages.map(indexStage);
    else materialLists[stageIndex] = indexStage(stages[stageIndex]);
  }
  indexMaterials();

  let quality = options.quality;
  let progress = 0;
  let focus: { stageId: string; term: string | null } = { stageId: '', term: null };
  let loadedEvidence: { metadata: EventEvidence; arrays: EvidenceArrays } | null = null;
  const evidenceApplied = new Map<number, EventEvidence>();
  let paused = false;
  let ambient = 0;
  let frame = 0;
  let disposed = false;
  let contextLost = false;
  let lastFrame = performance.now();
  let lastDiagnostics = -Infinity;
  let renderedFrames = 0;
  let width = 1, height = 1;
  let viewOffsetY = NaN;
  let viewOffsetX = NaN;
  let inspectionIndex = -1;
  let inspectionProgress = 0;
  let inspectionView: InspectionView = 'perspective';
  let inspectionRelief = 1.5;
  let inspectionDistance = 9;
  let applyingInspectionPose = false;
  const relief = createPlotReliefController();
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = false;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = .65; controls.panSpeed = .7; controls.zoomSpeed = .65;
  controls.minDistance = 1.5; controls.maxDistance = 80;
  controls.listenToKeyEvents(canvas);
  function inspectionDiagnostics() {
    const enabled = inspectionIndex >= 0;
    host.dataset.inspection = String(enabled); canvas.dataset.inspection = String(enabled);
    host.dataset.inspectionView = inspectionView; canvas.dataset.inspectionView = inspectionView;
    host.dataset.inspectionRelief = String(inspectionRelief);
    host.dataset.camera = camera.position.toArray().map(value => value.toFixed(4)).join(',');
    host.dataset.target = target.toArray().map(value => value.toFixed(4)).join(',');
  }
  function onOrbitChange() {
    if (inspectionIndex < 0) return;
    target.copy(controls.target);
    if (!applyingInspectionPose) inspectionView = 'perspective';
    lastDiagnostics = -Infinity; inspectionDiagnostics(); schedule();
  }
  controls.addEventListener('change', onOrbitChange);
  function leaveInspection() {
    if (inspectionIndex < 0) return;
    inspectionIndex = -1; controls.enabled = false; relief.restore();
    canvas.style.pointerEvents = 'none'; canvas.tabIndex = -1;
    canvas.setAttribute('aria-hidden', 'true'); canvas.removeAttribute('role'); canvas.removeAttribute('aria-label');
    camera.up.set(0, 1, 0); viewOffsetX = viewOffsetY = NaN;
    inspectionView = 'perspective'; lastDiagnostics = -Infinity; inspectionDiagnostics();
  }
  function setInspectionPose(view: InspectionView) {
    if (inspectionIndex < 0) return;
    const pose = inspectionViewPose(view, poses[inspectionIndex].target, inspectionDistance);
    applyingInspectionPose = true; inspectionView = view;
    camera.position.copy(pose.camera); camera.up.copy(pose.up); target.copy(pose.target); controls.target.copy(target);
    camera.clearViewOffset(); viewOffsetX = viewOffsetY = 0;
    camera.lookAt(target); camera.updateProjectionMatrix(); controls.update();
    applyingInspectionPose = false; lastDiagnostics = -Infinity; inspectionDiagnostics(); schedule();
  }
  let resizeNeeded = true;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    const maxPixels = quality === 'high' ? 3_000_000 : 2_000_000;
    const limit = quality === 'high' ? 2 : 1.5;
    const ratio = Math.min(window.devicePixelRatio || 1, limit, Math.sqrt(maxPixels / (width * height)));
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 48 : 42;
    viewOffsetX = viewOffsetY = NaN;
    camera.updateProjectionMatrix(); resizeNeeded = false; lastDiagnostics = -Infinity;
  }
  function activateMaterials(stageIndex: number) {
    for (const material of materialLists[stageIndex]) {
      const initial = defaults.get(material)!;
      material.transparent = true;
      material.depthWrite = initial.depthWrite;
      const shader = material as THREE.ShaderMaterial;
      if (shader.uniforms?.uFade) shader.uniforms.uFade.value = 1;
    }
  }
  function diagnostics(now: number) {
    if (now - lastDiagnostics < 500) return;
    lastDiagnostics = now;
    host.dataset.camera = camera.position.toArray().map(value => value.toFixed(3)).join(',');
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.geometries = String(renderer.info.memory.geometries);
    host.dataset.textures = String(renderer.info.memory.textures);
    host.dataset.pixels = String(canvas.width * canvas.height);
    host.dataset.cameraX = camera.position.x.toFixed(4);
    host.dataset.eventX = carrier.position.x.toFixed(4);
  }
  function prepareStage(index: number) {
    if (!loadedEvidence || evidenceApplied.get(index) === loadedEvidence.metadata) return;
    stages[index].setEvidence?.(loadedEvidence.metadata, loadedEvidence.arrays);
    evidenceApplied.set(index, loadedEvidence.metadata);
    indexMaterials(index);
  }
  function paint(now: number) {
    frame = 0;
    if (disposed || contextLost || document.hidden) return;
    if (resizeNeeded) resize();
    const delta = clamp((now - lastFrame) / 1000, 0, 0.06);
    lastFrame = now;
    if (!paused && !reducedMotion && inspectionIndex < 0) ambient += delta;
    const displayProgress = inspectionIndex >= 0 ? inspectionProgress
      : reducedMotion ? Math.min(stages.length - 1, Math.floor(progress)) : progress;
    const sequence = Math.min(stages.length - 1, Math.floor(displayProgress));
    const local = clamp(displayProgress - sequence, 0, 1);
    const timing = stageTiming(reducedMotion ? .65 : local);
    const blend = inspectionIndex >= 0 || reducedMotion || sequence === stages.length - 1 ? 0 : timing.handoff;
    const next = Math.min(sequence + 1, stages.length - 1);
    preparePose(sequence, timing.operation);
    if (next !== sequence) preparePose(next, 0);
    const offsetFor = (index: number) => index === stages.length - 1 ? 0 : width < 760
      ? height * (story[index].id === 'metodos' ? height < 730 ? .48 : .32
        : height < 730 ? .32 : .22)
      : height * (height < 550 ? .055 : -.045);
    const requestedOffset = inspectionIndex >= 0 ? 0 : THREE.MathUtils.lerp(offsetFor(sequence), offsetFor(next), blend);
    const requestedOffsetX = inspectionIndex >= 0 || width < 760 ? 0
      : -width * .19 * THREE.MathUtils.lerp(sequence === stages.length - 1 ? 0 : 1, next === stages.length - 1 ? 0 : 1, blend);
    if (requestedOffset !== viewOffsetY || requestedOffsetX !== viewOffsetX) {
      viewOffsetY = requestedOffset; viewOffsetX = requestedOffsetX;
      camera.setViewOffset(width, height, viewOffsetX, viewOffsetY, width, height);
      camera.updateProjectionMatrix();
    }
    if (inspectionIndex < 0) {
      camera.position.lerpVectors(poses[sequence].camera, poses[next].camera, blend);
      target.lerpVectors(poses[sequence].target, poses[next].target, blend);
      if (width < 760) {
        camera.position.lerpVectors(poses[sequence].mobileCamera, poses[next].mobileCamera, blend);
        const sourceScale = THREE.MathUtils.lerp(sequence === 0 ? 1.8 : 1, next === 0 ? 1.8 : 1, blend);
        camera.position.sub(target).multiplyScalar(sourceScale).add(target);
        if (height < 730) camera.position.sub(target).multiplyScalar(1.28).add(target);
      }
      camera.position.z += Math.sin(blend * Math.PI) * (width < 760 ? 6 : 2);
      camera.lookAt(target);
    } else {
      target.copy(controls.target);
    }
    stages.forEach((stage, index) => {
      const available = !story[index].requiresEvidence || Boolean(loadedEvidence);
      stage.root.visible = available && (index === sequence || (index === sequence + 1 && blend > 0));
      if (!stage.root.visible) return;
      prepareStage(index);
      stage.update(index === sequence ? timing.operation : 0, ambient);
      stage.setFocus?.(stage.id === focus.stageId ? focus.term : null);
      activateMaterials(index);
    });
    if (inspectionIndex >= 0) relief.apply(stages[inspectionIndex].root, inspectionRelief);
    carrier.position.set(eventRouteX(sequence, timing.operation, blend, stages.length), ROUTE_Y, 1.1);
    const immersive = Boolean(stages[sequence].cameraAt) && blend < .8;
    carrier.visible = !immersive && inspectionIndex < 0; transfer.visible = !immersive && inspectionIndex < 0;
    sky.position.x = target.x;
    (sky.material as THREE.PointsMaterial).opacity = stages[sequence].continuous ? .72 : .24;
    renderer.render(scene, camera);
    host.dataset.frames = String(++renderedFrames);
    host.dataset.currentStage = stages[sequence].id;
    host.dataset.stageId = stages[sequence].id;
    host.dataset.formulas = JSON.stringify(formulaTexts[sequence]);
    host.dataset.event = options.observation?.eventId ?? loadedEvidence?.metadata.eventId ?? 'LF-241032';
    host.dataset.eventId = (options.observation?.eventId ?? loadedEvidence?.metadata.eventId ?? 'LF-241032').toUpperCase();
    host.dataset.observation = options.observation?.id ?? 'legacy';
    host.dataset.resolutionRatio = options.observation ? String(resolutionRatio(options.observation)) : '';
    host.dataset.handoff = blend.toFixed(4);
    host.dataset.operation = timing.operation.toFixed(4);
    host.dataset.stageCount = String(stages.length);
    host.dataset.focus = stages[sequence].id === focus.stageId ? focus.term ?? '' : '';
    const science = stages[sequence].root.userData;
    host.dataset.dmCurrent = String(science.dmAccumulated ?? science.dmObserved ?? '');
    host.dataset.receivedCount = String(science.receivedCount ?? '');
    host.dataset.assetReady = String(science.assetReady ?? '');
    const construction = stages[sequence].root.userData.construction as { completed: number; total: number; unit: string } | undefined;
    host.dataset.completed = construction ? String(construction.completed) : '';
    host.dataset.total = construction ? String(construction.total) : '';
    host.dataset.writeUnit = construction?.unit ?? '';
    host.dataset.cameraX = camera.position.x.toFixed(4);
    host.dataset.eventX = carrier.position.x.toFixed(4);
    host.dataset.cameraDistance = camera.position.distanceTo(target).toFixed(4);
    host.dataset.cameraTarget = target.toArray().map(value => value.toFixed(4)).join(',');
    host.dataset.travelPhase = String(science.travelPhase ?? '');
    const continuous = inspectionIndex < 0 && !paused && !reducedMotion && (stages[sequence].continuous || (blend > 0 && stages[next].continuous));
    host.dataset.renderMode = continuous ? 'continuous' : 'on-demand';
    diagnostics(now);
    inspectionDiagnostics();
    if (continuous) frame = requestAnimationFrame(paint);
  }
  function schedule() {
    if (!frame && !disposed && !contextLost && !document.hidden) frame = requestAnimationFrame(paint);
  }
  stages.forEach(stage => { stage.root.userData.requestRender = schedule; });
  function onVisibility() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { lastFrame = performance.now(); schedule(); }
  }
  function onMotion() { reducedMotion = motionQuery.matches; lastFrame = performance.now(); schedule(); }
  function onContextLost(event: Event) {
    event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0;
    options.onFailure('Contexto WebGL perdido. Mostrando fotogramas verificados.');
  }
  const observer = new ResizeObserver(() => { resizeNeeded = true; schedule(); });
  observer.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  motionQuery.addEventListener('change', onMotion);
  canvas.addEventListener('webglcontextlost', onContextLost);
  schedule();

  return {
    setProgress: value => {
      if (!Number.isFinite(value)) return;
      const nextIndex = Math.min(stages.length - 1, Math.floor(clamp(value, 0, stages.length)));
      if (inspectionIndex >= 0) {
        if (nextIndex === inspectionIndex) return;
        leaveInspection();
      }
      progress = clamp(value, 0, stages.length);
      host.dataset.progress = progress.toFixed(4); host.dataset.currentProgress = progress.toFixed(4);
      if (paused || reducedMotion) lastDiagnostics = -Infinity;
      schedule();
    },
    setEvidence: (evidence: EventEvidence, arrays: EvidenceArrays) => {
      if (hf) return;
      if (disposed) return;
      loadedEvidence = { metadata: evidence, arrays }; schedule();
    },
    setPaused: value => { paused = value; lastFrame = performance.now(); schedule(); },
    setQuality: value => { quality = value; resizeNeeded = true; schedule(); },
    setFocus: (stageId, term) => {
      if (focus.stageId === stageId && focus.term === term) return;
      focus = { stageId, term }; schedule();
    },
    setInspection: enabled => {
      if (!enabled) { leaveInspection(); schedule(); return; }
      if (inspectionIndex >= 0) return;
      const index = Math.min(stages.length - 1, Math.floor(progress));
      if (!isInspectionStage(stages[index].id)) return;
      inspectionIndex = index; inspectionProgress = reducedMotion ? index : progress;
      const operation = stageTiming(reducedMotion ? .65 : clamp(progress - index, 0, 1)).operation;
      preparePose(index, operation);
      inspectionDistance = (width < 760 ? poses[index].mobileCamera : poses[index].camera).distanceTo(poses[index].target);
      controls.enabled = true; canvas.style.pointerEvents = 'auto'; canvas.tabIndex = 0;
      canvas.removeAttribute('aria-hidden'); canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Gráfico tridimensional: rotación, desplazamiento y zoom.');
      setInspectionPose('perspective');
    },
    resetInspection: () => {
      if (inspectionIndex < 0) return;
      inspectionRelief = 1.5; relief.restore(); setInspectionPose('perspective');
    },
    setInspectionView: view => {
      if (['perspective', 'front', 'side', 'top'].includes(view)) setInspectionPose(view);
    },
    setInspectionRelief: amount => {
      inspectionRelief = clampInspectionRelief(amount); inspectionDiagnostics(); schedule();
    },
    dispose: () => {
      if (disposed) return;
      leaveInspection();
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      controls.removeEventListener('change', onOrbitChange); controls.dispose(); relief.restore();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      stages.forEach(stage => stage.dispose?.());
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
