import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Gauge } from 'lucide-react';
import { clampProgress, createHeldTransport, DEFAULT_SPEED, FINE_STEP, keyboardProgress, PROGRESS_EPSILON, type HeldTransport } from './transport';

export interface TransportBarHandle { setProgress: (progress: number) => void }
export interface TransportBarProps {
  progress: number;
  count: number;
  onChange: (value: number) => void;
  onNudge: (delta: number) => void;
  reduced: boolean;
  paused?: boolean;
}

export const TransportBar = forwardRef<TransportBarHandle, TransportBarProps>(function TransportBar({ progress, count, onChange, onNudge, reduced, paused = false }, ref) {
  const slider = useRef<HTMLInputElement>(null);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const position = useRef<HTMLOutputElement>(null);
  const value = useRef(clampProgress(progress, count));
  const callbacks = useRef({ onChange, onNudge });
  callbacks.current = { onChange, onNudge };
  const held = useRef<HeldTransport | null>(null);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const paint = useCallback((requested: number) => {
    const current = clampProgress(requested, count);
    value.current = current;
    if (slider.current) {
      slider.current.value = String(current);
      slider.current.setAttribute('aria-valuetext', `Fase ${Math.floor(current) + 1} de ${count}, ${Math.round((current % 1) * 100)} por ciento`);
      slider.current.style.setProperty('--transport-progress', `${current / count * 100}%`);
    }
    if (previous.current) previous.current.disabled = current <= 0;
    if (next.current) next.current.disabled = current >= count - PROGRESS_EPSILON;
    if (position.current) position.current.textContent = `${String(Math.floor(current) + 1).padStart(2, '0')} / ${count}`;
  }, [count]);
  useImperativeHandle(ref, () => ({ setProgress: paint }), [paint]);
  useEffect(() => { paint(progress); }, [paint, progress]);
  useEffect(() => {
    const controller = createHeldTransport(delta => callbacks.current.onNudge(delta), {
      now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    });
    held.current = controller;
    const stop = () => controller.stop();
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility);
      if (held.current === controller) held.current = null;
    };
  }, []);
  const change = (requested: number) => {
    held.current?.stop();
    const current = clampProgress(requested, count);
    paint(current);
    callbacks.current.onChange(current);
  };
  const arrow = (direction: -1 | 1, reference: typeof previous) => <button ref={reference} type="button" className="icon-button transport-arrow"
    title={direction < 0 ? 'Retroceder con precisión' : 'Avanzar con precisión'}
    aria-label={direction < 0 ? 'Retroceder con precisión' : 'Avanzar con precisión'}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      held.current?.start(direction, speed);
    }} onPointerUp={() => held.current?.stop()} onPointerCancel={() => held.current?.stop()}
    onLostPointerCapture={() => held.current?.stop()} onBlur={() => held.current?.stop()}
    onClick={event => { if (event.detail === 0) callbacks.current.onNudge(direction * FINE_STEP); }}>
    {direction < 0 ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
  </button>;

  return <div className="transport-bar" role="group" aria-label="Control preciso del recorrido" data-reduced={reduced} data-paused={paused}>
    {arrow(-1, previous)}
    <input ref={slider} className="transport-range" type="range" min={0} max={count - PROGRESS_EPSILON} step="any" defaultValue={progress}
      aria-label="Posición en el recorrido" onInput={event => change(Number(event.currentTarget.value))} onPointerDown={() => held.current?.stop()}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const requested = keyboardProgress(value.current, count, event.key);
        if (requested === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        change(requested);
      }} />
    {arrow(1, next)}
    <output ref={position} className="transport-position" aria-hidden="true" />
    <label className="transport-speed" title="Velocidad al mantener una flecha">
      <Gauge size={15} aria-hidden="true" />
      <input type="range" min={0.1} max={1} step={0.01} value={speed} aria-label="Velocidad de avance"
        aria-valuetext={`${speed.toFixed(2)} fases por segundo`} onChange={event => { held.current?.stop(); setSpeed(Number(event.target.value)); }} />
      <output>{speed.toFixed(2)}<span> fases/s</span></output>
    </label>
  </div>;
});
