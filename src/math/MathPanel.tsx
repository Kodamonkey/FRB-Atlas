import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Play, RotateCcw } from 'lucide-react';
import { mathFor, type StageMath } from './model';
import { focusedEquationMarkup, symbolMarkup, termAtOperation } from './render';
import 'katex/dist/katex.min.css';

export interface MathPanelHandle { setOperation: (operation: number) => void }
interface Props {
  stageId: string;
  provenance: string;
  onFocus: (stageId: string, term: string) => void;
  onReplay: () => void;
  definition?: StageMath;
}

export const MathPanel = forwardRef<MathPanelHandle, Props>(function MathPanel({ stageId, provenance, onFocus, onReplay, definition }, ref) {
  const stage = definition ?? mathFor(stageId);
  const [selected, setSelected] = useState(0);
  const [pinned, setPinned] = useState(false);
  const pin = useRef(false);
  const operation = useRef(0);
  const formula = useRef<HTMLDivElement>(null);
  const term = stage.terms[selected];
  const markup = useMemo(() => focusedEquationMarkup(stage, term.id), [stage, term.id]);
  const symbols = useMemo(() => stage.terms.map(item => symbolMarkup(item.symbol)), [stage]);
  const setOperation = useCallback((value: number) => {
    operation.current = value;
    if (!pin.current) setSelected(previous => {
      const next = termAtOperation(value, stage.terms.length);
      return next === previous ? previous : next;
    });
  }, [stage]);
  useImperativeHandle(ref, () => ({ setOperation }), [setOperation]);
  useEffect(() => { onFocus(stageId, term.id); }, [stageId, term.id, onFocus]);
  useLayoutEffect(() => {
    const element = formula.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = '20px';
      const content = element.querySelector<HTMLElement>('.katex');
      if (content) element.style.fontSize = `${Math.min(20, 20 * Math.max(1, element.clientWidth - 4) / Math.max(1, content.getBoundingClientRect().width))}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    void document.fonts.ready.then(fit);
    fit();
    return () => observer.disconnect();
  }, [markup]);
  const select = (index: number) => { pin.current = true; setPinned(true); setSelected(index); };
  const automatic = () => { pin.current = false; setPinned(false); setOperation(operation.current); };

  return <section className="math-panel" aria-label="Matemática y fenómeno" data-stage={stageId} data-term={term.id} data-mode={pinned ? 'manual' : 'automatic'}>
    <div className="math-heading"><span>{stage.relation}</span><div>
      <button className="icon-button" title="Repetir operación" aria-label="Repetir operación" onClick={() => { automatic(); onReplay(); }}><Play size={14} /></button>
      {pinned && <button className="icon-button" title="Seguir términos automáticamente" aria-label="Seguir términos automáticamente" onClick={automatic}><RotateCcw size={14} /></button>}
      <a className="icon-button" href={stage.source.url} title={stage.source.title} aria-label={`Fuente: ${stage.source.title}`} target="_blank" rel="noreferrer"><ArrowUpRight size={14} /></a>
    </div></div>
    <div className="math-equation" ref={formula} dangerouslySetInnerHTML={{ __html: markup }} onClick={event => {
      const target = (event.target as HTMLElement).closest('.equation-term');
      const index = stage.terms.findIndex(item => target?.classList.contains(`term-${item.id}`));
      if (index >= 0) select(index);
    }} />
    <div className="math-terms" role="group" aria-label="Términos de la ecuación">
      {stage.terms.map((item, index) => <button key={item.id} title={`${item.label} · ${item.unit}`} aria-label={`${item.label}: ${item.unit}`}
        aria-pressed={selected === index} onClick={() => select(index)}><span dangerouslySetInnerHTML={{ __html: symbols[index] }} /></button>)}
    </div>
    <div className="term-description"><strong>{term.label}</strong><span className="term-unit">{term.unit}</span>
      <p>{term.meaning} <span>{term.visual}</span></p>
    </div>
    <div className="math-units">{stage.units}</div>
    <div className="math-provenance">{provenance}</div>
  </section>;
});
