import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Box, Check, ChevronRight, Circle, Info, PanelRight, PanelTop, Pause, Play, Radio, Rotate3D, RotateCcw, SlidersHorizontal, Square, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS, GUIDED_DM_ROW, scrollSegments, splitProgress, stageTiming } from './story';
import { actStartsFor, isRecordedRoute, storyFor, type MethodChoice } from './routes';
import { DEFAULT_METHODS, DETECTION_METHODS, CLASSIFICATION_METHODS,
  type DetectionMethod, type ClassificationMethod } from './methods/catalog';
import { TransportBar, type TransportBarHandle } from './navigation/TransportBar';
import { createSmoothWheelTransport, FINE_STEP, targetScroll, wheelStageDelta, type SmoothWheelTransport } from './navigation/transport';
import { readReloadPosition, saveReloadPosition } from './navigation/reload';
import type { InspectionView, RenderQuality, World } from './cinema/types';
import { hasInspectionRelief, isInspectionStage } from './cinema/plotInspection';
import type { EventEvidence, EvidenceArrays } from './evidence/types';
import { MathPanel, type MathPanelHandle } from './math/MathPanel';
import { globalMathFor } from './math/model';
import { equationMarkup } from './math/render';
import { FinalePanel, type FinalePanelHandle } from './finale/FinalePanel';
import { DEFAULT_OBSERVATION, OBSERVATIONS, effectiveDt, isObservationCase, resolutionRatio, type ObservationCaseId } from './observations';
import { observationMathFor } from './math/observationMath';
import { HF_MATH } from './hf/math';

const HFFinalePanel = lazy(() => import('./hf/HFFinalePanel').then(module => ({ default: module.HFFinalePanel })));

gsap.registerPlugin(ScrollTrigger);
const LAB_URL = import.meta.env.VITE_LAB_URL || 'http://127.0.0.1:5173/';
const TENSOR_SHAPES: Record<string, string> = { rgb: '3 × 512 × 512', backbone: '64 × 256 × 256',
  upsampling: '256 × 128 × 128', cabezas: '128 × 128', recorte: '1 × 512 × 64',
  resnet: '512 × 16 × 2', decision: '512 / 2 logits' };
type LoadedEvidence = { evidence: EventEvidence; arrays: EvidenceArrays };
type EvidenceStatus = 'idle' | 'loading' | 'verified' | 'error';
const format = (value: number, digits = 3) => value.toLocaleString('es-CL', { maximumFractionDigits: digits });

function readScrollProgress() {
  const steps = Array.from(document.querySelectorAll<HTMLElement>('.story-step'));
  if (!steps.length) return 0;
  let index = 0;
  for (let i = 1; i < steps.length && steps[i].offsetTop <= scrollY; i++) index = i;
  const end = steps[index + 1]?.offsetTop ?? document.documentElement.scrollHeight - innerHeight;
  return index + (scrollY - steps[index].offsetTop) / Math.max(1, end - steps[index].offsetTop);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function App() {
  const reduced = useReducedMotion();
  const [observationId, setObservationId] = useState<ObservationCaseId>(() => {
    const value = new URLSearchParams(location.search).get('observation');
    return isObservationCase(value) ? value : DEFAULT_OBSERVATION;
  });
  const observation = OBSERVATIONS[observationId];
  const hf = observationId === 'alma-hf';
  const [methods, setMethods] = useState<MethodChoice>(() => {
    const query = new URLSearchParams(location.search);
    return { detection: DETECTION_METHODS.some(item => item.id === query.get('detector'))
      ? query.get('detector') as DetectionMethod : DEFAULT_METHODS.detection,
      classification: CLASSIFICATION_METHODS.some(item => item.id === query.get('classifier'))
        ? query.get('classifier') as ClassificationMethod : DEFAULT_METHODS.classification };
  });
  const STORY = useMemo(() => storyFor(methods, observationId), [methods, observationId]);
  const ACT_STARTS = useMemo(() => actStartsFor(STORY), [STORY]);
  const EVIDENCE_PREFETCH = STORY.findIndex(step => step.id === 'antenas');
  const recorded = isRecordedRoute(methods, observationId);
  const [sequence, setSequence] = useState(0);
  const [paused, setPaused] = useState(() => new URLSearchParams(location.search).has('still'));
  const [quality, setQuality] = useState<RenderQuality>('standard');
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [relief, setRelief] = useState(1);
  const inspectionRef = useRef(false);
  const inspectionButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<EvidenceStatus>('idle');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<LoadedEvidence | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const math = useRef<MathPanelHandle>(null);
  const finale = useRef<FinalePanelHandle>(null);
  const transport = useRef<TransportBarHandle>(null);
  const focus = useRef({ stageId: 'faro', term: 'rotation' });
  const navigationTween = useRef<gsap.core.Tween | null>(null);
  const smoothWheel = useRef<SmoothWheelTransport | null>(null);
  const world = useRef<World | null>(null);
  const progress = useRef(0);
  const reloadPosition = useRef(readReloadPosition(history.state,
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'navigate',
    observationId, STORY.map(step => step.id)));
  const currentSequence = useRef(0);
  const evidenceRef = useRef<LoadedEvidence | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const evidenceStatus = useRef<EvidenceStatus>('idle');
  const renderOptions = useRef({ quality, paused: paused || reduced });
  renderOptions.current = { quality, paused: paused || reduced };
  const dialog = useRef<HTMLDialogElement>(null);
  const active = STORY[Math.min(sequence, STORY.length - 1)];
  const activeMath = observationMathFor(active.id, observationId)
    ?? HF_MATH.find(definition => definition.id === active.id) ?? globalMathFor(active.id);
  const final = active.id === 'candidato' || active.id === 'candidate-didactic' || active.id === 'hf-candidato';
  const posterId = hf || ['tierra', 'antenas'].includes(active.id) ? `${observationId}-${active.id}` : active.id;
  const inspectable = isInspectionStage(active.id);
  const stopInspection = useCallback(() => {
    inspectionRef.current = false; setInspecting(false); world.current?.setInspection(false);
    world.current?.setProgress(progress.current);
  }, []);
  useEffect(() => { stopInspection(); }, [active.id, stopInspection]);

  const prepareEvidence = useCallback(async (retry = false) => {
    if (observationId !== 'arecibo-lf') return;
    if (evidenceStatus.current === 'verified') return;
    if (evidenceStatus.current === 'loading' && !abortRef.current?.signal.aborted) return;
    if (evidenceStatus.current === 'error' && !retry) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    evidenceStatus.current = 'loading'; setStatus('loading'); setError('');
    try {
      const { loadEvidence } = await import('./evidence/load');
      const result = await loadEvidence(`${import.meta.env.BASE_URL}evidence`, controller.signal);
      if (controller.signal.aborted) return;
      evidenceRef.current = result;
      world.current?.setEvidence(result.evidence, result.arrays);
      setLoaded(result); evidenceStatus.current = 'verified'; setStatus('verified');
    } catch (failure) {
      if (controller.signal.aborted) return;
      evidenceStatus.current = 'error'; setStatus('error');
      setError(failure instanceof Error ? failure.message : 'No se pudo verificar la evidencia.');
    }
  }, [observationId]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (evidenceStatus.current === 'loading') evidenceStatus.current = 'idle';
  }, []);

  useEffect(() => {
    // Native SPA restoration can run before the story has height. Save position, never evidence.
    const save = () => history.replaceState(saveReloadPosition(history.state, observationId,
      STORY.map(step => step.id), progress.current), '');
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('beforeunload', save); window.removeEventListener('pagehide', save);
    };
  }, [observationId, STORY]);

  useEffect(() => {
    if (!host.current || fallback) return;
    let cancelled = false;
    let instance: World | null = null;
    const element = host.current;
    setReady(false);
    import('./cinema/World').then(({ createWorld }) => {
      if (cancelled) return;
      instance = createWorld(element, { story: STORY, observation, quality: renderOptions.current.quality, onFailure: () => { if (!cancelled) setFallback(true); } });
      world.current = instance;
      instance.setProgress(progress.current);
      instance.setPaused(renderOptions.current.paused);
      instance.setFocus(focus.current.stageId, focus.current.term);
      instance.setInspectionRelief(relief);
      if (!hf && evidenceRef.current) instance.setEvidence(evidenceRef.current.evidence, evidenceRef.current.arrays);
      setReady(true);
    }).catch(() => { if (!cancelled) setFallback(true); });
    return () => { cancelled = true; instance?.dispose(); if (world.current === instance) world.current = null; };
    // Quality, pause and reduced motion update the persistent renderer separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, STORY]);

  useEffect(() => world.current?.setPaused(paused || reduced), [paused, reduced]);
  useEffect(() => world.current?.setQuality(quality), [quality]);
  useEffect(() => { if (reduced || fallback) setSettings(false); }, [reduced, fallback]);
  useEffect(() => { if (fallback) stopInspection(); }, [fallback, stopInspection]);

  useLayoutEffect(() => {
    if (!main.current) return;
    const element = main.current;
    let trigger: ScrollTrigger | undefined;
    let timeline: gsap.core.Timeline | undefined;
    let resizeTimer = 0;
    const update = (value: number) => {
      const state = splitProgress(value, STORY.length);
      progress.current = state.global;
      transport.current?.setProgress(state.global);
      const timing = stageTiming(reduced || fallback ? .65 : state.local);
      math.current?.setOperation(timing.operation);
      finale.current?.setOperation(timing.operation);
      world.current?.setProgress(reduced ? state.sequence + 0.65 : state.global);
      if (meter.current) meter.current.style.transform = `scaleX(${state.global / STORY.length})`;
      if (flow.current) {
        flow.current.dataset.phase = timing.handoff > 0 ? 'handoff' : timing.operation >= 1 ? 'output' : 'operation';
        flow.current.style.setProperty('--operation', String(timing.operation));
      }
      if (copy.current) {
        const arrival = state.sequence === 0 ? 1 : Math.min(1, state.local / .08);
        const departure = Math.max(0, 1 - (state.local - .72) / .06);
        const fade = reduced ? 1 : Math.min(arrival, departure);
        copy.current.style.opacity = String(fade);
        copy.current.style.transform = `translateY(${reduced ? 0 : (0.5 - state.local) * 12}px)`;
      }
      if (currentSequence.current !== state.sequence) { currentSequence.current = state.sequence; setSequence(state.sequence); }
      if (state.sequence >= EVIDENCE_PREFETCH) void prepareEvidence();
      if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
        Object.assign(window, { __CINEMA__: { ...state, evidenceStatus: evidenceStatus.current, reducedMotion: reduced,
          stageId: STORY[state.sequence].id, detection: hf ? 'boxcar' : methods.detection,
          classification: hf ? 'radio' : methods.classification, recorded, observation: observationId,
          resolutionRatio: resolutionRatio(observation) } });
      }
    };
    const setup = () => {
      trigger?.kill(); timeline?.kill();
      const starts = Array.from(element.querySelectorAll<HTMLElement>('.story-step'), item => item.offsetTop);
      const maxScroll = document.documentElement.scrollHeight - innerHeight;
      const durations = scrollSegments(starts, maxScroll);
      const director = { value: 0 };
      timeline = gsap.timeline({ paused: true, onUpdate: () => update(director.value) });
      durations.forEach((duration, index) => timeline!.to(director, { value: index + 1, duration: duration / 1000, ease: 'none' }));
      trigger = ScrollTrigger.create({ trigger: element, start: 'top top', end: 'max', animation: timeline,
        scrub: true, invalidateOnRefresh: true });
      ScrollTrigger.refresh();
      if (reloadPosition.current !== null) {
        const saved = reloadPosition.current; reloadPosition.current = null;
        scrollTo({ top: targetScroll(saved, starts, maxScroll), behavior: 'instant' });
        ScrollTrigger.update();
      }
      timeline.progress(Math.min(1, scrollY / Math.max(1, maxScroll)));
      update(director.value);
    };
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(setup, 160); };
    setup(); window.addEventListener('resize', resize);
    return () => { clearTimeout(resizeTimer); window.removeEventListener('resize', resize); trigger?.kill(); timeline?.kill(); };
  }, [reduced, fallback, prepareEvidence, STORY, EVIDENCE_PREFETCH, methods, recorded, observation, observationId, hf]);

  const goTo = useCallback((index: number) => {
    stopInspection();
    smoothWheel.current?.stop();
    setSettings(false);
    const clamped = Math.max(0, Math.min(STORY.length - 1, index));
    const target = document.getElementById(STORY[clamped].id);
    if (!target) return;
    navigationTween.current?.kill();
    const end = target.nextElementSibling instanceof HTMLElement ? target.nextElementSibling.offsetTop
      : document.documentElement.scrollHeight - innerHeight;
    const destination = target.offsetTop + (clamped ? (end - target.offsetTop) * .6 : 0);
    if (reduced || fallback) { window.scrollTo({ top: destination, behavior: 'instant' }); return; }
    const director = { y: scrollY };
    navigationTween.current = gsap.to(director, { y: destination,
      duration: Math.min(4.2, 2.8 + Math.abs(clamped - currentSequence.current) * .15), ease: 'power2.inOut',
      onUpdate: () => window.scrollTo({ top: director.y, behavior: 'instant' }),
      onComplete: () => { navigationTween.current = null; } });
  }, [reduced, fallback, STORY]);

  const applyProgress = useCallback((value: number) => {
    navigationTween.current?.kill(); navigationTween.current = null;
    const starts = Array.from(document.querySelectorAll<HTMLElement>('.story-step'), step => step.offsetTop);
    scrollTo({ top: targetScroll(value, starts, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
  }, []);
  const moveToProgress = useCallback((value: number) => {
    smoothWheel.current?.stop();
    applyProgress(value);
  }, [applyProgress]);
  const nudge = useCallback((delta: number) => {
    moveToProgress(readScrollProgress() + delta);
  }, [moveToProgress]);

  useEffect(() => {
    const controller = createSmoothWheelTransport(readScrollProgress, applyProgress, STORY.length, {
      now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    });
    smoothWheel.current = controller;
    const cancel = () => { controller.stop(); navigationTween.current?.kill(); navigationTween.current = null; };
    const visibility = () => { if (document.hidden) cancel(); };
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || dialog.current?.open) return;
      if (event.key === 'Escape' && inspectionRef.current) {
        event.preventDefault(); stopInspection(); inspectionButton.current?.focus(); return;
      }
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable],.transport-bar,.plot-toolbar,.cinema-canvas[data-inspection="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); nudge(event.key === 'ArrowRight' ? FINE_STEP : -FINE_STEP);
      } else if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) cancel();
    };
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('.finale-body,.cinema-canvas[data-inspection="true"]')) { cancel(); return; }
      const delta = wheelStageDelta(event, innerHeight);
      if (!delta || Math.abs(event.deltaX) < Math.abs(event.deltaY) || dialog.current?.open
        || event.target instanceof Element && event.target.closest('input,select,textarea,.evidence-dialog')) { cancel(); return; }
      event.preventDefault();
      navigationTween.current?.kill(); navigationTween.current = null;
      if (reduced) nudge(delta);
      else controller.add(delta);
    };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', key);
    return () => {
      cancel();
      if (smoothWheel.current === controller) smoothWheel.current = null;
      window.removeEventListener('wheel', wheel); window.removeEventListener('touchstart', cancel);
      window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', key);
    };
  }, [nudge, applyProgress, STORY.length, reduced, stopInspection]);
  const chooseMethod = (key: keyof MethodChoice, value: DetectionMethod | ClassificationMethod) => {
    stopInspection();
    navigationTween.current?.kill(); navigationTween.current = null;
    const branch = STORY.findIndex(step => step.id === 'metodos');
    moveToProgress(branch + .6);
    setMethods(previous => ({ ...previous, [key]: value }));
    setSequence(branch); currentSequence.current = branch; progress.current = branch + .6;
    const query = new URLSearchParams(location.search);
    query.set(key === 'detection' ? 'detector' : 'classifier', value);
    history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
  };
  const chooseObservation = (value: ObservationCaseId) => {
    if (value === observationId) return;
    stopInspection();
    smoothWheel.current?.stop();
    navigationTween.current?.kill(); navigationTween.current = null;
    abortRef.current?.abort(); abortRef.current = null;
    evidenceRef.current = null; evidenceStatus.current = 'idle';
    setLoaded(null); setStatus('idle'); setError(''); setSettings(false);
    progress.current = 0; currentSequence.current = 0; setSequence(0);
    focus.current = { stageId: 'faro', term: 'rotation' };
    scrollTo({ top: 0, behavior: 'instant' });
    setObservationId(value);
    const query = new URLSearchParams(location.search);
    query.set('observation', value);
    history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
  };
  const showEvidence = () => { stopInspection(); smoothWheel.current?.stop(); setSettings(false); void prepareEvidence(); dialog.current?.showModal(); };
  const focusTerm = useCallback((stageId: string, term: string) => {
    focus.current = { stageId, term }; world.current?.setFocus(stageId, term);
  }, []);
  useEffect(() => {
    if (!inspecting) math.current?.setOperation(stageTiming(reduced || fallback ? .65 : progress.current - sequence).operation);
  }, [sequence, reduced, fallback, inspecting]);
  const replay = () => {
    smoothWheel.current?.stop();
    navigationTween.current?.kill();
    const target = document.getElementById(active.id);
    if (!target) return;
    const end = target.nextElementSibling instanceof HTMLElement ? target.nextElementSibling.offsetTop
      : document.documentElement.scrollHeight - innerHeight;
    const span = end - target.offsetTop;
    if (reduced || fallback) { scrollTo({ top: target.offsetTop + span * .6, behavior: 'instant' }); return; }
    const director = { y: target.offsetTop + span * .08 };
    scrollTo({ top: director.y, behavior: 'instant' });
    navigationTween.current = gsap.to(director, { y: target.offsetTop + span * .64, duration: 8, ease: 'none',
      onUpdate: () => scrollTo({ top: director.y, behavior: 'instant' }),
      onComplete: () => { navigationTween.current = null; } });
  };
  const showPoster = fallback || (reduced && !ready);
  const toggleInspection = () => {
    smoothWheel.current?.stop(); navigationTween.current?.kill(); navigationTween.current = null;
    const enabled = !inspectionRef.current;
    inspectionRef.current = enabled; setInspecting(enabled);
    world.current?.setInspection(enabled);
    if (!enabled) world.current?.setProgress(progress.current);
  };
  const inspectionViews: { id: InspectionView; label: string; Icon: typeof Box }[] = [
    { id: 'perspective', label: 'Vista perspectiva', Icon: Box }, { id: 'front', label: 'Vista frontal', Icon: Square },
    { id: 'side', label: 'Vista lateral', Icon: PanelRight }, { id: 'top', label: 'Vista superior', Icon: PanelTop },
  ];

  return <>
    <a className="skip-link" href="#story">Ir al relato</a>
    <div className="cinema-canvas" ref={host} data-ready={ready} data-evidence={status} aria-hidden={!inspecting} />
    {showPoster && (!active.requiresEvidence || status === 'verified') && <div className="poster-surface" aria-hidden="true">
      <picture key={sequence}>
        <source media="(max-width: 759px)" srcSet={`${import.meta.env.BASE_URL}posters/mobile-${posterId}.jpg`} />
        <img src={`${import.meta.env.BASE_URL}posters/desktop-${posterId}.jpg`} alt="" />
      </picture>
    </div>}
    <div className="scene-shade" data-scene={active.id} aria-hidden="true" />
    <header className="site-header">
      <a href="#faro" className="wordmark" aria-label="FRB Atlas, volver al inicio" onClick={event => { event.preventDefault(); goTo(0); }}>
        <Radio size={17} strokeWidth={1.5} /><span>FRB ATLAS</span><i>DEL COSMOS AL CANDIDATO</i>
      </a>
      <label className="observation-switcher">
        <span className="sr-only">Caso de observación</span>
        <select aria-label="Caso de observación" value={observationId} onChange={event => chooseObservation(event.target.value as ObservationCaseId)}>
          {Object.values(OBSERVATIONS).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="header-actions">
        <a className="lab-link" href={LAB_URL} target="_blank" rel="noreferrer">Laboratorio <ArrowUpRight size={15} /></a>
        <button className="icon-button" title="Ver evidencia y fuentes" aria-label="Ver evidencia y fuentes" onClick={showEvidence}><Info size={18} /></button>
        <button className="icon-button" title={paused || reduced || fallback ? 'Reanudar movimiento' : 'Pausar movimiento'} aria-label={paused || reduced || fallback ? 'Reanudar movimiento' : 'Pausar movimiento'}
          disabled={reduced || fallback} onClick={() => setPaused(value => !value)}>{paused || reduced || fallback ? <Play size={18} /> : <Pause size={18} />}</button>
        <button className="icon-button settings-toggle" title="Calidad visual" aria-label="Calidad visual" aria-expanded={settings}
          disabled={reduced || fallback} onClick={() => setSettings(value => !value)}><SlidersHorizontal size={18} /></button>
      </div>
      {settings && <div className="quality-menu" onKeyDown={event => { if (event.key === 'Escape') setSettings(false); }}>
        <span>CALIDAD</span><div className="segmented" role="group" aria-label="Calidad visual">
          {(['standard', 'high'] as const).map(value => <button key={value} aria-pressed={quality === value} onClick={() => setQuality(value)}>
            {quality === value && <Check size={13} />}{value === 'standard' ? 'Estándar' : 'Alta'}</button>)}
        </div>
      </div>}
    </header>

    <main id="story" ref={main} tabIndex={-1} aria-label="Del pulso al candidato">
      {STORY.map((step, index) => <section key={step.id} id={step.id} data-story-id={step.id} className={`story-step ${index === 0 ? 'first-step' : index === STORY.length - 1 ? 'last-step' : ''}`} aria-label={`${index + 1}. ${step.title}`}>
        <div className="sr-only"><h2>{step.title}</h2><p>{step.caption}</p><p>{step.detail}</p></div>
      </section>)}
    </main>

    {inspectable && ready && !fallback && <section className="plot-toolbar" aria-label="Vista del gráfico" data-active={inspecting}>
      <div className="plot-tool-buttons">
        <button ref={inspectionButton} className="icon-button" title={inspecting ? 'Volver al recorrido' : 'Explorar gráfico en 3D'}
          aria-label={inspecting ? 'Volver al recorrido' : 'Explorar gráfico en 3D'} aria-pressed={inspecting}
          disabled={Boolean(active.requiresEvidence && status !== 'verified')} onClick={toggleInspection}><Rotate3D size={19} /></button>
        {inspecting && <>
          {inspectionViews.map(({ id, label, Icon }) => <button key={id} className="icon-button" title={label} aria-label={label}
            onClick={() => world.current?.setInspectionView(id)}><Icon size={17} /></button>)}
          <button className="icon-button" title="Restaurar vista" aria-label="Restaurar vista" onClick={() => {
            setRelief(1); world.current?.resetInspection(); world.current?.setInspectionRelief(1);
          }}><RotateCcw size={17} /></button>
        </>}
      </div>
      {inspecting && hasInspectionRelief(active.id) && <label className="plot-relief"><span>Relieve normalizado (u.a.)</span><input type="range" min="0" max="3" step=".05"
        aria-label="Relieve de amplitud" value={relief} onChange={event => { const value = Number(event.target.value);
          setRelief(value); world.current?.setInspectionRelief(value); }} /><output>{format(relief, 2)}</output></label>}
    </section>}
    {!final && !inspecting && <div className={`explanation-stack ${sequence === 0 ? 'intro-stack' : ''} ${active.id === 'metodos' ? 'methods-stack' : ''}`}>
    <div className={`story-copy ${sequence === 0 ? 'first-copy' : final ? 'last-copy' : ''}`} ref={copy} data-sequence={sequence}>
      <span className="kicker"><i />{active.kicker}</span>
      {sequence === 0 ? <><h1>FRB Atlas</h1><h2>{active.title}</h2></> : <h2>{active.title}</h2>}
      <p className="caption">{active.caption}</p>
      {sequence === 0 && <span className="hero-subtitle">DEL PULSO AL CANDIDATO</span>}
      {final && <div className={`candidate-close ${recorded ? '' : 'candidate-didactic'}`}>
        {loaded && recorded ? <dl>
          <div><dt>DM estimada</dt><dd>{format(loaded.evidence.candidate.dm, 2)}<small>pc cm⁻³</small></dd></div>
          <div><dt>SNR del recorte</dt><dd>{format(loaded.evidence.candidate.snr, 2)}</dd></div>
          <div><dt>Salida clase 1</dt><dd>{format(loaded.evidence.inference.probabilities[1], 4)}</dd></div>
        </dl> : <p className="data-status">{hf ? 'DM no resuelta. Candidato por SNR, no FRB confirmado.'
          : recorded ? status === 'error' ? 'Evidencia no disponible' : 'Verificando evidencia…' : 'Ejemplo didáctico. Sin inferencia entrenada.'}</p>}
        <div className="trace-navigation" aria-label="Ruta del candidato">
          {['recorte', 'centernet', 'bowtie', 'bloques', 'matriz'].filter(id => STORY.some(step => step.id === id)).map(id => <button key={id} onClick={() => goTo(STORY.findIndex(step => step.id === id))}>
            {({ recorte: 'Recorte', centernet: 'Caja', bowtie: 'Mapa', bloques: 'Bloque', matriz: 'Observación' } as Record<string, string>)[id]}</button>)}
        </div>
        <a href={LAB_URL} className="final-link" target="_blank" rel="noreferrer">Explorar laboratorio <ArrowUpRight size={18} /></a>
      </div>}
    </div>
    {!hf && (active.id === 'metodos' || final) && <section className="method-switcher" aria-label="Métodos del recorrido">
      <label>Detección<select aria-label="Método de detección" value={methods.detection} onChange={event => chooseMethod('detection', event.target.value as DetectionMethod)}>
        {DETECTION_METHODS.map(method => <option key={method.id} value={method.id}>{method.label}</option>)}
      </select></label>
      <label>Clasificación<select aria-label="Método de clasificación" value={methods.classification} onChange={event => chooseMethod('classification', event.target.value as ClassificationMethod)}>
        {CLASSIFICATION_METHODS.map(method => <option key={method.id} value={method.id}>{method.label}</option>)}
      </select></label>
      <span className="method-origin">{recorded ? 'DRAFTS: traza CPU fija, no nueva inferencia.' : methods.detection === 'cnn'
        ? 'Detección CPU fija. Clasificación didáctica; sin nueva inferencia.' : 'Ejemplos didácticos: matemática real, sin modelo entrenado.'}</span>
    </section>}
    {!final && <MathPanel key={active.id} ref={math} stageId={active.id} definition={activeMath} provenance={active.provenance} onFocus={focusTerm} onReplay={replay} />}
    </div>}
    {final && !hf && <FinalePanel ref={finale} methods={methods} evidence={loaded?.evidence ?? null} arrays={loaded?.arrays ?? null}
      evidenceStatus={status} onRetry={() => void prepareEvidence(true)}
      onNavigate={id => { const index = STORY.findIndex(step => step.id === id); if (index >= 0) goTo(index); }}
      operation={stageTiming(reduced || fallback ? .65 : progress.current - sequence).operation} />}
    {final && hf && <Suspense fallback={<p className="hf-loading" role="status">Preparando plots HF…</p>}>
      <HFFinalePanel ref={finale} operation={stageTiming(reduced || fallback ? .65 : progress.current - sequence).operation} />
    </Suspense>}

    {!final && !inspecting && <aside className="scientific-readout" aria-label="Estado científico">
      <span className="readout-label">{{ event: `EVENTO / ${observation.eventId}`, acquisition: 'ADQUISICIÓN ILUSTRATIVA', waterfall: 'TIEMPO × FRECUENCIA', profile: hf ? 'PERFIL / BOXCARS HF' : 'PERFIL / MEDIA EXPUESTA', map: 'DM × TIEMPO', network: 'TRAZA / CPU FLOAT32' }[active.readout]}</span>
      <span className="readout-value">{active.readout === 'event' ? <>{observation.dm} <small>pc cm⁻³ · {hf ? 'conocida / inyectada' : 'inyectada'}</small></>
        : active.readout === 'acquisition' ? <>64 <small>muestras</small><i> / </i>4 <small>bits ADC</small></>
        : active.readout === 'waterfall' || active.readout === 'map' ? <>{active.readout === 'map' ? 96 : observation.channels} <small>{active.readout === 'map' ? 'DM' : 'canales'}</small><i> / </i>{hf ? 128 : 2048} <small>muestras</small></>
        : hf ? <>{format(effectiveDt(observation) * 1000, 3)} <small>ms / muestra · DM no resuelta</small></>
        : loaded ? active.readout === 'profile' ? <>{format(loaded.evidence.axes.dmValues[GUIDED_DM_ROW], 2)} <small>pc cm⁻³ · DM de prueba</small></>
          : TENSOR_SHAPES[active.id] ? <>{TENSOR_SHAPES[active.id]}</>
            : <>{format(loaded.evidence.candidate.timeSeconds * 1000, 3)} <small>ms</small></> : <small>Verificando</small>}</span>
      <span className="provenance">{active.provenance}</span>
      {active.requiresEvidence && status === 'loading' && <span className="evidence-state" role="status">Preparando evidencia…</span>}
    </aside>}

    <div className={`event-flow ${final ? 'final-flow' : ''}`} ref={flow} aria-label={`${!hf && active.act === 5 && !recorded ? 'Ejemplo didáctico' : `Evento ${observation.eventId}`}: ${active.input}, ${active.operation}, ${active.output}`}>
      <span className="event-identity"><i />{!hf && active.act === 5 && !recorded ? 'EJEMPLO' : observation.eventId.replace('-', '–')}</span>
      <span className="flow-input">{active.input}</span><ChevronRight size={13} aria-hidden="true" />
      <span className="flow-operation">{active.operation}</span><ChevronRight size={13} aria-hidden="true" />
      <span className="flow-output">{active.output}</span>
    </div>

    <nav className={`act-navigation ${final ? 'final-acts' : ''}`} aria-label="Actos">
      {ACTS.map((act, index) => <button key={act} title={act} aria-label={`Ir a ${act}`} aria-current={active.act === index ? 'step' : undefined}
        onClick={() => goTo(ACT_STARTS[index])}><Circle size={9} fill={active.act === index ? 'currentColor' : 'none'} /><span>{act}</span></button>)}
    </nav>
    <footer className="journey-footer">
      <div className="sequence-controls">
        <button className="icon-button" title="Volver al pulso" aria-label="Volver al pulso" disabled={sequence === 0} onClick={() => goTo(0)}><RotateCcw size={16} /></button>
      </div>
      <TransportBar ref={transport} progress={progress.current} count={STORY.length} onChange={moveToProgress} onNudge={nudge} reduced={reduced} paused={paused} />
    </footer>
    {sequence === 0 && <span className="next-hint" aria-hidden="true">01.2 <i /> La señal abandona la estrella</span>}

    <dialog ref={dialog} className="evidence-dialog" aria-label="Evidencia y fuentes">
      <div className="dialog-heading"><span className="kicker">PROCEDENCIA</span><button className="icon-button" aria-label="Cerrar evidencia" title="Cerrar evidencia" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <h2>El dato detrás del relato.</h2>
      <p>{active.detail}</p>
      <div className="complete-equation" dangerouslySetInnerHTML={{ __html: equationMarkup(activeMath, '') }} />
      <p>{activeMath.units}</p>
      {(!active.requiresEvidence || status === 'verified') && activeMath.example !== observation.provenance && <p>{activeMath.example}</p>}
      <p>{observation.provenance} Señal sintética, no observación confirmada. DM y RM no son la misma magnitud.</p>
      {hf && <p>R={format(resolutionRatio(observation), 9)}. El muestreo nativo es 32 µs; la resolución efectiva es 4,096 ms tras ×128. ALMA no implica siempre HF no resuelto.</p>}
      {!hf && !recorded && <p>{methods.detection === 'cnn' ? 'Detector CNN: traza CPU registrada. Clasificación alternativa didáctica, sin aplicar pesos entrenados a otra entrada.'
        : 'Método seleccionado didáctico. No usa pesos entrenados ni produce una nueva puntuación científica.'}</p>}
      {loaded && recorded ? <>
        <dl className="evidence-facts">
          <div><dt>Evento</dt><dd>{loaded.evidence.eventId}</dd></div>
          <div><dt>DM inyectada / estimada</dt><dd>{loaded.evidence.truth.dm} / {format(loaded.evidence.candidate.dm, 6)} pc cm⁻³</dd></div>
          <div><dt>Recorte original / entrada</dt><dd>512 × 64 / 1 × 512 × 64</dd></div>
          <div><dt>SNR / filtro</dt><dd>{format(loaded.evidence.candidate.snr, 6)} / {loaded.evidence.candidate.widthMs} ms</dd></div>
          <div><dt>Score CenterNet</dt><dd>{format(loaded.evidence.candidate.score, 6)}</dd></div>
          <div><dt>Logits ResNet</dt><dd>{loaded.evidence.inference.logits.map(value => format(value, 6)).join(' · ')}</dd></div>
        </dl>
        <div className="hashes"><span>SHA256 / CHECKPOINTS</span>
          <code>{loaded.evidence.inference.checkpoints.detector}</code><code>{loaded.evidence.inference.checkpoints.classifier}</code>
          <small>Waterfall y recortes verificados antes de mostrarse.</small>
        </div>
        <div className="source-links">{loaded.evidence.sources.map(source => /^https:\/\//.test(source.url)
          ? <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={15} /></a>
          : <div className="local-source" key={source.url}><span>{source.label}</span><code>{source.url}</code></div>)}</div>
      </> : recorded && <p role="status">{status === 'error' ? error : 'Verificando arrays y hashes…'}</p>}
      <div className="source-links">
        {[activeMath.source, observation.source, ...(!hf && active.act === 5 ? [DETECTION_METHODS.find(item => item.id === methods.detection)!.source,
          CLASSIFICATION_METHODS.find(item => item.id === methods.classification)!.source] : [])]
          .filter((source, index, all) => all.findIndex(item => item.url === source.url) === index)
          .map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={15} /></a>)}
      </div>
      {status === 'error' && <button className="retry" onClick={() => void prepareEvidence(true)}>Reintentar evidencia</button>}
    </dialog>
  </>;
}
