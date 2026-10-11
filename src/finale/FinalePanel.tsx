import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LocateFixed, RotateCcw, Route } from 'lucide-react';
import type { EventEvidence, EvidenceArrays } from '../evidence/types';
import type { MethodChoice } from '../routes';
import { DETECTION_METHODS, CLASSIFICATION_METHODS } from '../methods/catalog';
import { buildFinaleModel, finaleConstruction, initialFinaleSelection, moveFinaleSelection, selectFinale,
  type FinaleMatrix, type FinaleModel, type FinaleSelection } from './model';
import './finale.css';

export interface FinalePanelHandle { setOperation(value: number): void }
export interface FinalePanelProps {
  methods: MethodChoice;
  evidence: EventEvidence | null;
  arrays: EvidenceArrays | null;
  operation?: number;
  evidenceStatus?: 'idle' | 'loading' | 'verified' | 'error';
  onRetry?: () => void;
  onNavigate?: (id: string) => void;
}
type PlotKind = 'profile' | 'map' | 'waterfall';
const CYAN = '#72e2c7', CORAL = '#ff957e', YELLOW = '#f0d568', WHITE = '#eaf2ef';
const number = (value: number, digits = 2) => value.toLocaleString('es-CL', { maximumFractionDigits: digits });
const timeLabel = (model: FinaleModel, value: number) => model.mode === 'recorded' ? number(value, 3) : number(value * 1000, 1);
const TRACE_STOPS = [{ id: 'recorte', label: 'Recorte' }, { id: 'centernet', label: 'Caja' },
  { id: 'bowtie', label: 'Mapa' }, { id: 'bloques', label: 'Bloque' }, { id: 'matriz', label: 'Observación' }] as const;

function raster(matrix: FinaleMatrix): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = matrix.columns; canvas.height = matrix.rows;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const sorted = Array.from(matrix.values).filter(Number.isFinite).sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * .02)] ?? 0;
  const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .995))] ?? 1;
  const range = Math.max(1e-9, high - low), image = context.createImageData(matrix.columns, matrix.rows);
  for (let row = 0; row < matrix.rows; row++) for (let column = 0; column < matrix.columns; column++) {
    const value = Math.max(0, Math.min(1, (matrix.values[row * matrix.columns + column] - low) / range));
    const pixel = ((matrix.rows - 1 - row) * matrix.columns + column) * 4;
    image.data[pixel] = Math.round(17 + value * (value > .65 ? 228 : 76));
    image.data[pixel + 1] = Math.round(30 + value * 178);
    image.data[pixel + 2] = Math.round(37 + value * 134);
    image.data[pixel + 3] = 255;
  }
  context.putImageData(image, 0, 0); return canvas;
}

function frame(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
  const context = canvas.getContext('2d');
  if (!context || width < 1 || height < 1) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
  const plot = { x: width < 350 ? 36 : 44, y: 8, width: width - (width < 350 ? 46 : 55), height: height - 31 };
  context.fillStyle = 'rgba(11,18,21,.94)'; context.fillRect(plot.x, plot.y, plot.width, plot.height);
  context.font = '10px "IBM Plex Mono", monospace'; context.lineWidth = 1;
  return { context, plot, width, height };
}

function drawPlot(canvas: HTMLCanvasElement, kind: PlotKind, model: FinaleModel, selection: FinaleSelection,
  operation: number, matrixRaster: HTMLCanvasElement | null) {
  const view = frame(canvas); if (!view) return;
  const { context: ctx, plot, height } = view, construction = finaleConstruction(operation, model);
  const x = (time: number) => plot.x + (time - model.timeBounds[0]) / (model.timeBounds[1] - model.timeBounds[0]) * plot.width;
  const selectedTime = model.times[selection.timeIndex];
  let profileMinimum = 0, profileMaximum = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.width, plot.height); ctx.clip();
  if (kind === 'profile') {
    profileMaximum = Math.ceil(Math.max(6, model.peak.snr) * 1.16);
    profileMinimum = Math.floor(Math.min(-1, ...model.profile));
    const y = (value: number) => plot.y + plot.height * (1 - (value - profileMinimum) / (profileMaximum - profileMinimum));
    ctx.strokeStyle = 'rgba(234,242,239,.10)';
    for (let tick = 0; tick < 4; tick++) { const line = plot.y + tick / 3 * plot.height; ctx.beginPath(); ctx.moveTo(plot.x, line); ctx.lineTo(plot.x + plot.width, line); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,149,126,.13)'; ctx.fillRect(x(model.window[0]), plot.y, x(model.window[1]) - x(model.window[0]), plot.height);
    if (model.threshold !== null) {
      ctx.strokeStyle = YELLOW; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(plot.x, y(model.threshold));
      ctx.lineTo(plot.x + plot.width, y(model.threshold)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = CORAL; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let index = 0; index < construction.profile; index++) {
      const px = x(model.times[index]), py = y(model.profile[index]); if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (construction.profile > model.peak.index) {
      ctx.fillStyle = CORAL; ctx.beginPath(); ctx.arc(x(model.peak.time), y(model.peak.snr), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WHITE; ctx.fillText(`SNR ${number(model.peak.snr)} · ${number(model.peak.widthMs)} ms`,
        Math.max(plot.x + 5, Math.min(plot.x + plot.width - 150, x(model.peak.time) + 9)), Math.max(plot.y + 12, y(model.peak.snr) - 8));
    }
    if (construction.profile > selection.timeIndex) { ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(x(selectedTime), y(model.profile[selection.timeIndex]), 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const matrix = kind === 'map' ? model.map : model.waterfall;
    const completed = kind === 'map' ? construction.map : construction.waterfall;
    ctx.imageSmoothingEnabled = false;
    if (matrixRaster && completed) {
      if (kind === 'map') {
        const rows = Math.floor(completed / matrix.columns), columns = completed % matrix.columns;
        if (rows) ctx.drawImage(matrixRaster, 0, matrix.rows - rows, matrix.columns, rows,
          plot.x, plot.y + plot.height * (1 - rows / matrix.rows), plot.width, plot.height * rows / matrix.rows);
        if (columns && rows < matrix.rows) ctx.drawImage(matrixRaster, 0, matrix.rows - rows - 1, columns, 1,
          plot.x, plot.y + plot.height * (1 - (rows + 1) / matrix.rows), plot.width * columns / matrix.columns, plot.height / matrix.rows);
      } else {
        const columns = Math.floor(completed / matrix.rows), rows = completed % matrix.rows;
        if (columns) ctx.drawImage(matrixRaster, 0, 0, columns, matrix.rows, plot.x, plot.y, plot.width * columns / matrix.columns, plot.height);
        if (rows && columns < matrix.columns) ctx.drawImage(matrixRaster, columns, matrix.rows - rows, 1, rows,
          plot.x + plot.width * columns / matrix.columns, plot.y + plot.height * (1 - rows / matrix.rows), plot.width / matrix.columns, plot.height * rows / matrix.rows);
      }
    }
    ctx.fillStyle = 'rgba(255,149,126,.16)'; ctx.fillRect(x(model.window[0]), plot.y, x(model.window[1]) - x(model.window[0]), plot.height);
    if (kind === 'map' && completed === matrix.values.length) {
      const rowY = plot.y + plot.height * (1 - (selection.dmRow + .5) / matrix.rows);
      ctx.strokeStyle = YELLOW; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(plot.x, rowY); ctx.lineTo(plot.x + plot.width, rowY); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = CORAL; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x(model.detectorTime ?? model.peak.time),
        plot.y + plot.height * (1 - (initialFinaleSelection(model).dmRow + .5) / matrix.rows), 5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (model.detectorTime !== null) {
    ctx.strokeStyle = CYAN; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x(model.detectorTime), plot.y);
    ctx.lineTo(x(model.detectorTime), plot.y + plot.height); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(selectedTime), plot.y);
  ctx.lineTo(x(selectedTime), plot.y + plot.height); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = 'rgba(234,242,239,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.height); ctx.lineTo(plot.x + plot.width, plot.y + plot.height); ctx.stroke();
  ctx.fillStyle = '#a8b8b8'; ctx.textAlign = 'left'; ctx.fillText(timeLabel(model, model.timeBounds[0]), plot.x, height - 5);
  ctx.textAlign = 'right'; ctx.fillText(`${timeLabel(model, model.timeBounds[1])} ${model.mode === 'recorded' ? 's' : 'ms'}`, plot.x + plot.width, height - 5);
  if (kind === 'profile') {
    ctx.fillText(number(profileMaximum, 0), plot.x - 5, plot.y + 10);
    ctx.fillText(number(profileMinimum, 0), plot.x - 5, plot.y + plot.height - 2);
  } else {
    const matrix = kind === 'map' ? model.map : model.waterfall;
    ctx.fillText(number(matrix.coordinates[matrix.rows - 1], kind === 'waterfall' && model.frequencyUnit === 'MHz' ? 0 : 0), plot.x - 5, plot.y + 10);
    ctx.fillText(number(matrix.coordinates[0], 0), plot.x - 5, plot.y + plot.height - 2);
  }
  ctx.textAlign = 'left';
  canvas.dataset.completed = String(construction[kind]);
  canvas.dataset.selectedTime = String(selectedTime);
  canvas.dataset.selectedDm = String(model.map.coordinates[selection.dmRow]);
}

export const FinalePanel = forwardRef<FinalePanelHandle, FinalePanelProps>(function FinalePanel({ methods, evidence, arrays,
  operation = 1, evidenceStatus = 'loading', onRetry, onNavigate }, ref) {
  const model = useMemo(() => buildFinaleModel(methods, evidence, arrays), [methods, evidence, arrays]);
  const panel = useRef<HTMLElement>(null), profile = useRef<HTMLCanvasElement>(null), map = useRef<HTMLCanvasElement>(null), waterfall = useRef<HTMLCanvasElement>(null);
  const operationRef = useRef(operation), drawRef = useRef<() => void>(() => {});
  const [selection, setSelection] = useState<FinaleSelection>({ timeIndex: 0, dmRow: 0 });
  const [traceOpen, setTraceOpen] = useState(false);
  const traceContainer = useRef<HTMLDivElement>(null), traceToggle = useRef<HTMLButtonElement>(null);
  const traceItems = useRef<(HTMLButtonElement | null)[]>([]);
  const selectionRef = useRef(selection); selectionRef.current = selection;
  useImperativeHandle(ref, () => ({ setOperation(value) { operationRef.current = value; drawRef.current(); } }), []);
  useEffect(() => { operationRef.current = operation; drawRef.current(); }, [operation]);
  useEffect(() => {
    if (!model) return;
    const initial = initialFinaleSelection(model); selectionRef.current = initial; setSelection(initial);
    const mapRaster = raster(model.map), waterfallRaster = raster(model.waterfall);
    const draw = () => {
      if (profile.current) drawPlot(profile.current, 'profile', model, selectionRef.current, operationRef.current, null);
      if (map.current) drawPlot(map.current, 'map', model, selectionRef.current, operationRef.current, mapRaster);
      if (waterfall.current) drawPlot(waterfall.current, 'waterfall', model, selectionRef.current, operationRef.current, waterfallRaster);
      if (panel.current) {
        const construction = finaleConstruction(operationRef.current, model);
        panel.current.dataset.operation = String(operationRef.current);
        panel.current.dataset.classificationVisible = String(construction.classification);
      }
    };
    drawRef.current = draw; draw();
    const observer = new ResizeObserver(draw);
    for (const canvas of [profile.current, map.current, waterfall.current]) if (canvas) observer.observe(canvas);
    return () => { observer.disconnect(); drawRef.current = () => {}; mapRaster.width = waterfallRaster.width = 0; };
  }, [model]);
  useEffect(() => { drawRef.current(); }, [selection]);
  useEffect(() => {
    if (!traceOpen) return;
    traceItems.current[0]?.focus();
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!traceContainer.current?.contains(event.target as Node)) setTraceOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [traceOpen]);
  useEffect(() => { setTraceOpen(false); }, [model]);

  const choose = (kind: PlotKind, event: PointerEvent<HTMLCanvasElement>) => {
    if (!model || (event.type === 'pointermove' && !event.buttons)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const left = bounds.width < 350 ? 36 : 44, width = bounds.width - (bounds.width < 350 ? 46 : 55);
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left - left) / width));
    const time = model.timeBounds[0] + fraction * (model.timeBounds[1] - model.timeBounds[0]);
    let dm = model.map.coordinates[selectionRef.current.dmRow];
    if (kind === 'map') {
      const rowFraction = Math.max(0, Math.min(.99999, 1 - (event.clientY - bounds.top - 8) / (bounds.height - 31)));
      dm = model.map.coordinates[Math.floor(rowFraction * model.map.rows)];
    }
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId);
    setSelection(selectFinale(model, time, dm));
  };
  const keyboard = (kind: PlotKind, event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!model) return;
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const row = kind === 'map' ? event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0 : 0;
    if (direction || row) { event.preventDefault(); event.stopPropagation(); setSelection(moveFinaleSelection(model, selectionRef.current, direction, row)); }
    if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); setSelection(initialFinaleSelection(model)); }
  };
  if (!model) return <section className={`finale-panel finale-loading ${evidenceStatus === 'error' ? 'finale-error' : ''}`}
    aria-label="Evidencia del candidato" aria-live="polite">
    {evidenceStatus === 'error' ? <><h2>Evidencia no disponible</h2><p>La traza no pasó la verificación.</p>
      {onRetry && <button className="finale-retry" type="button" onClick={onRetry} title="Reintentar evidencia">
        <RotateCcw size={16} aria-hidden="true" /> Reintentar evidencia</button>}</>
      : 'Verificando plots y traza CPU…'}
  </section>;
  const displayedSelection = moveFinaleSelection(model, selection, 0);
  const detector = DETECTION_METHODS.find(method => method.id === methods.detection)!.label;
  const classifier = CLASSIFICATION_METHODS.find(method => method.id === methods.classification)!.label;
  const plots: { kind: PlotKind; title: string; unit: string; canvas: typeof profile }[] = [
    { kind: 'profile', title: model.mode === 'recorded' ? 'SNR del recorte · banco boxcar' : 'SNR del perfil · banco boxcar', unit: 'adimensional', canvas: profile },
    { kind: 'map', title: 'Bow Tie · DM × tiempo', unit: model.mode === 'recorded' ? 'pc cm⁻³ · media' : 'pc cm⁻³ · ilustrativa', canvas: map },
    { kind: 'waterfall', title: 'Frecuencia × tiempo', unit: model.frequencyUnit === 'MHz' ? 'MHz · dedispersado' : 'canales · TOY_CROP', canvas: waterfall },
  ];
  return <section ref={panel} className="finale-panel" aria-label="Plots vinculados del candidato" data-mode={model.mode} data-event-id={model.eventId} data-confirmation="not-confirmed">
    <header className="finale-heading"><div><span className="finale-eyebrow">CIERRE / {model.mode === 'recorded' ? 'LF SINTÉTICO · TRAZA CPU' : 'EJEMPLO DIDÁCTICO'}</span>
      <h2>Candidato detectado.</h2></div><div className="finale-actions">
      {model.mode === 'recorded' && onNavigate && <div className="finale-trace" ref={traceContainer}>
        <button type="button" ref={traceToggle} title="Ruta del candidato" aria-label="Ruta del candidato"
          aria-expanded={traceOpen} aria-controls="finale-trace-navigation" onClick={() => setTraceOpen(value => !value)}><Route size={17} /></button>
        {traceOpen && <nav id="finale-trace-navigation" className="finale-trace-menu" aria-label="Origen del candidato"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTraceOpen(false); traceToggle.current?.focus(); }
            const focused = traceItems.current.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'ArrowDown' ? (focused + 1) % TRACE_STOPS.length
              : event.key === 'ArrowUp' ? (focused + TRACE_STOPS.length - 1) % TRACE_STOPS.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? TRACE_STOPS.length - 1 : -1;
            if (next >= 0) { event.preventDefault(); event.stopPropagation(); traceItems.current[next]?.focus(); }
          }}>{TRACE_STOPS.map((stop, index) => <button type="button" key={stop.id}
            ref={element => { traceItems.current[index] = element; }}
            onClick={() => { setTraceOpen(false); onNavigate(stop.id); }}>{stop.label}</button>)}</nav>}
      </div>}
      <button type="button" title="Restaurar pico SNR y DM del ejemplo" aria-label="Restaurar selección del candidato"
        onClick={() => setSelection(initialFinaleSelection(model))}><LocateFixed size={17} /></button></div></header>
    <div className="finale-body">
    <div className="finale-charts">{plots.map(({ kind, title, unit, canvas }, index) => <figure key={kind} className={`finale-chart finale-chart-${kind}`}>
      <figcaption><span><b>{String(index + 1).padStart(2, '0')}</b> {title}</span><small>{unit}</small></figcaption>
      <canvas ref={canvas} tabIndex={0} role="img" aria-label={`${title}. Tiempo ${timeLabel(model, model.timeBounds[0])} a ${timeLabel(model, model.timeBounds[1])} ${model.mode === 'recorded' ? 'segundos' : 'milisegundos'}. Pico SNR ${number(model.peak.snr)}, anchura ${model.peak.widthMs} milisegundos, DM ${number(model.dm, 2)} parsecs por centímetro cúbico. ${model.mode === 'didactic' ? 'Ejemplo ilustrativo independiente.' : 'Recorte registrado dedispersado.'}`}
        onPointerDown={event => choose(kind, event)} onPointerMove={event => choose(kind, event)} onKeyDown={event => keyboard(kind, event)} />
    </figure>)}</div>
    <div className="finale-selection" aria-live="polite"><span><i className="finale-marker" /> t {timeLabel(model, model.times[displayedSelection.timeIndex])} {model.mode === 'recorded' ? 's' : 'ms'}</span>
      <span>DM {number(model.map.coordinates[displayedSelection.dmRow], 1)} <small>pc cm⁻³</small></span>
      <span>{model.mode === 'recorded' ? 'SNR del recorte' : 'SNR del perfil'} {number(model.profile[displayedSelection.timeIndex])}</span></div>
    <div className="finale-outcome"><span className="finale-methods">{detector} · {classifier}</span>
      <strong>{model.classification.label}</strong><p>{model.classification.detail}</p></div>
    <div className="finale-legend"><span><i className="finale-window" /> W = {number(model.peak.widthMs)} ms · pico SNR {timeLabel(model, model.peak.time)} {model.mode === 'recorded' ? 's' : 'ms'}</span>
      {model.detectorTime !== null && <span><i className="finale-detector" /> Centro CNN {timeLabel(model, model.detectorTime)} s · score {number(model.detectorScore!, 4)}</span>}</div>
    <p className="finale-provenance">{model.provenance}{model.mode === 'didactic' ? ' · DM y tiempo de mapa ilustrativos.' : ` · SNR a DM ${number(model.dm, 2)}; mapa de media expuesta.`}</p>
    </div>
    <p className="finale-confirmation">Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.</p>
  </section>;
});
