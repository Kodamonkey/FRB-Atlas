import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LocateFixed } from 'lucide-react';
import { getHFFixture, hfConstruction, selectHFCandidate, HF_DEFAULT_THRESHOLD, type HFFixture } from './model';
import '../finale/finale.css';
import './hf.css';

export interface HFFinalePanelHandle { setOperation(value: number): void }
export interface HFFinalePanelProps { operation: number }
type PlotKind = 'profile' | 'bank' | 'waterfall';
const number = (value: number, digits = 3) => value.toLocaleString('es-CL', { maximumFractionDigits: digits });
const CORAL = '#ff957e', CYAN = '#72e2c7', YELLOW = '#f0d568';

function raster(values: Float32Array, columns: number, rows: number) {
  const canvas = document.createElement('canvas'); canvas.width=columns;canvas.height=rows;
  const context=canvas.getContext('2d');if(!context)return canvas;
  const sorted=Array.from(values).sort((a,b)=>a-b),minimum=sorted[Math.floor(sorted.length*.02)],maximum=sorted[Math.floor(sorted.length*.995)];
  const image=context.createImageData(columns,rows),range=Math.max(1e-9,maximum-minimum);
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const value=Math.max(0,Math.min(1,(values[row*columns+column]-minimum)/range)),pixel=((rows-1-row)*columns+column)*4;
    image.data[pixel]=Math.round(16+239*value);image.data[pixel+1]=Math.round(31+173*value);image.data[pixel+2]=Math.round(38+94*value);image.data[pixel+3]=255;
  }context.putImageData(image,0,0);return canvas;
}

function draw(canvas: HTMLCanvasElement, kind: PlotKind, fixture: HFFixture, threshold: number, selection: {sample:number;row:number},
  operation: number, bitmap: HTMLCanvasElement | null) {
  const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(width<1||height<1)return;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const plot={x:width<350?39:46,y:8,width:width-(width<350?49:57),height:height-31};
  const construction=hfConstruction(operation,fixture),candidate=selectHFCandidate(fixture,threshold);
  const x=(time:number)=>plot.x+(time-fixture.timeBounds[0])/(fixture.timeBounds[1]-fixture.timeBounds[0])*plot.width;
  ctx.font='10px "IBM Plex Mono", monospace';ctx.fillStyle='#0e191c';ctx.fillRect(plot.x,plot.y,plot.width,plot.height);
  ctx.save();ctx.beginPath();ctx.rect(plot.x,plot.y,plot.width,plot.height);ctx.clip();
  if(kind==='profile'){
    const maximum=Math.ceil(Math.max(candidate.snr,threshold,6)*1.13),minimum=Math.floor(Math.min(-1,...fixture.snr));
    const y=(value:number)=>plot.y+plot.height*(1-(value-minimum)/(maximum-minimum));
    ctx.strokeStyle='rgba(234,242,239,.1)';ctx.lineWidth=1;
    for(let tick=0;tick<4;tick++){const py=plot.y+tick/3*plot.height;ctx.beginPath();ctx.moveTo(plot.x,py);ctx.lineTo(plot.x+plot.width,py);ctx.stroke();}
    ctx.fillStyle='rgba(255,149,126,.16)';ctx.fillRect(x(candidate.window[0]),plot.y,x(candidate.window[1])-x(candidate.window[0]),plot.height);
    ctx.strokeStyle=YELLOW;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(plot.x,y(threshold));ctx.lineTo(plot.x+plot.width,y(threshold));ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle=CORAL;ctx.lineWidth=1.6;ctx.beginPath();
    for(let sample=0;sample<construction.profile;sample++){if(sample===0)ctx.moveTo(x(fixture.timesSeconds[sample]),y(fixture.snr[sample]));
      else ctx.lineTo(x(fixture.timesSeconds[sample]),y(fixture.snr[sample]));}ctx.stroke();
    if(construction.profile>candidate.sample){ctx.fillStyle=CORAL;ctx.beginPath();ctx.arc(x(candidate.timeSeconds),y(candidate.snr),4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#eaf2ef';ctx.fillText(`SNR ${number(candidate.snr,2)} · ${number(candidate.widthMs)} ms`,
        Math.max(plot.x+4,Math.min(plot.x+plot.width-149,x(candidate.timeSeconds)+8)),Math.max(plot.y+12,y(candidate.snr)-9));}
    ctx.restore();ctx.fillStyle='#a8b8b8';ctx.textAlign='right';ctx.fillText(String(maximum),plot.x-5,plot.y+10);ctx.fillText(String(minimum),plot.x-5,plot.y+plot.height-2);ctx.textAlign='left';
  }else{
    const rows=kind==='bank'?fixture.widthSamples.length:fixture.channels,total=kind==='bank'?fixture.bank.length:fixture.waterfallRows.length;
    const completed=kind==='bank'?construction.bank:construction.waterfall;
    ctx.imageSmoothingEnabled=false;
    if(bitmap&&completed){
      if(kind==='bank'){
        const completedRows=Math.floor(completed/fixture.samples),columns=completed%fixture.samples;
        if(completedRows)ctx.drawImage(bitmap,0,rows-completedRows,fixture.samples,completedRows,plot.x,plot.y+plot.height*(1-completedRows/rows),plot.width,plot.height*completedRows/rows);
        if(columns&&completedRows<rows)ctx.drawImage(bitmap,0,rows-completedRows-1,columns,1,plot.x,plot.y+plot.height*(1-(completedRows+1)/rows),plot.width*columns/fixture.samples,plot.height/rows);
      }else{
        const columns=Math.floor(completed/rows),completedRows=completed%rows;
        if(columns)ctx.drawImage(bitmap,0,0,columns,rows,plot.x,plot.y,plot.width*columns/fixture.samples,plot.height);
        if(completedRows&&columns<fixture.samples)ctx.drawImage(bitmap,columns,rows-completedRows,1,completedRows,plot.x+plot.width*columns/fixture.samples,plot.y+plot.height*(1-completedRows/rows),plot.width/fixture.samples,plot.height*completedRows/rows);
      }
    }
    ctx.fillStyle='rgba(255,149,126,.15)';ctx.fillRect(x(candidate.window[0]),plot.y,x(candidate.window[1])-x(candidate.window[0]),plot.height);
    if(kind==='bank'&&completed===total){const py=plot.y+plot.height*(1-(selection.row+.5)/rows);
      ctx.strokeStyle=YELLOW;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(plot.x,py);ctx.lineTo(plot.x+plot.width,py);ctx.stroke();ctx.setLineDash([]);
      const candidateRow=fixture.widthSamples.indexOf(candidate.widthSamples);ctx.strokeStyle=CORAL;ctx.lineWidth=1.8;ctx.beginPath();
      ctx.arc(x(candidate.timeSeconds),plot.y+plot.height*(1-(candidateRow+.5)/rows),5,0,Math.PI*2);ctx.stroke();}
    ctx.restore();ctx.fillStyle='#a8b8b8';ctx.textAlign='right';
    if(kind==='bank'){
      const fontSize=Math.max(6,Math.min(9,plot.height/rows-1));ctx.font=`${fontSize}px "IBM Plex Mono", monospace`;
      for(let row=0;row<rows;row++)ctx.fillText(number(fixture.widthsMs[row],3),plot.x-5,plot.y+plot.height*(1-(row+.5)/rows)+fontSize*.35);
      ctx.font='10px "IBM Plex Mono", monospace';
    }else{
      ctx.fillText(number(fixture.frequenciesMHz[rows-1]/1000,2),plot.x-5,plot.y+10);
      ctx.fillText(number(fixture.frequenciesMHz[0]/1000,2),plot.x-5,plot.y+plot.height-2);
    }ctx.textAlign='left';
  }
  ctx.strokeStyle=YELLOW;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(fixture.timesSeconds[selection.sample]),plot.y);ctx.lineTo(x(fixture.timesSeconds[selection.sample]),plot.y+plot.height);ctx.stroke();
  ctx.strokeStyle='rgba(234,242,239,.35)';ctx.beginPath();ctx.moveTo(plot.x,plot.y);ctx.lineTo(plot.x,plot.y+plot.height);ctx.lineTo(plot.x+plot.width,plot.y+plot.height);ctx.stroke();
  ctx.fillStyle='#a8b8b8';ctx.fillText(number(fixture.timeBounds[0]*1000,1),plot.x,height-5);ctx.textAlign='right';
  ctx.fillText(`${number(fixture.timeBounds[1]*1000,1)} ms`,plot.x+plot.width,height-5);ctx.textAlign='left';
  canvas.dataset.completed=String(kind==='bank'?construction.bank:construction[kind]);
  canvas.dataset.selectedTime=String(fixture.timesSeconds[selection.sample]);canvas.dataset.selectedWidthMs=String(fixture.widthsMs[selection.row]);
}

export const HFFinalePanel=forwardRef<HFFinalePanelHandle,HFFinalePanelProps>(function HFFinalePanel({operation},ref){
  const fixture=getHFFixture(),candidate=selectHFCandidate(fixture);
  const [threshold,setThreshold]=useState(HF_DEFAULT_THRESHOLD);
  const [selection,setSelection]=useState({sample:candidate.sample,row:fixture.widthSamples.indexOf(candidate.widthSamples)});
  const panel=useRef<HTMLElement>(null),profile=useRef<HTMLCanvasElement>(null),bank=useRef<HTMLCanvasElement>(null),waterfall=useRef<HTMLCanvasElement>(null);
  const operationRef=useRef(operation),drawRef=useRef<()=>void>(()=>{}),settingsRef=useRef({threshold,selection});settingsRef.current={threshold,selection};
  useImperativeHandle(ref,()=>({setOperation(value){operationRef.current=value;drawRef.current();}}),[]);
  useEffect(()=>{operationRef.current=operation;drawRef.current();},[operation]);
  useEffect(()=>{
    const bankRaster=raster(fixture.bank,fixture.samples,fixture.widthSamples.length),waterfallRaster=raster(fixture.waterfallRows,fixture.samples,fixture.channels);
    const render=()=>{
      const state=settingsRef.current;
      if(profile.current)draw(profile.current,'profile',fixture,state.threshold,state.selection,operationRef.current,null);
      if(bank.current)draw(bank.current,'bank',fixture,state.threshold,state.selection,operationRef.current,bankRaster);
      if(waterfall.current)draw(waterfall.current,'waterfall',fixture,state.threshold,state.selection,operationRef.current,waterfallRaster);
      if(panel.current){panel.current.dataset.operation=String(operationRef.current);panel.current.dataset.classificationVisible=String(hfConstruction(operationRef.current,fixture).classification);
        panel.current.dataset.accepted=String(selectHFCandidate(fixture,state.threshold).accepted);}
    };drawRef.current=render;render();const observer=new ResizeObserver(render);
    for(const canvas of[profile.current,bank.current,waterfall.current])if(canvas)observer.observe(canvas);
    return()=>{observer.disconnect();drawRef.current=()=>{};bankRaster.width=waterfallRaster.width=0;};
  },[fixture]);
  useEffect(()=>{drawRef.current();},[threshold,selection]);
  const choose=(kind:PlotKind,event:PointerEvent<HTMLCanvasElement>)=>{
    if(event.type==='pointermove'&&!event.buttons)return;
    const bounds=event.currentTarget.getBoundingClientRect(),left=bounds.width<350?39:46,width=bounds.width-(bounds.width<350?49:57);
    const fraction=Math.max(0,Math.min(1,(event.clientX-bounds.left-left)/width));
    const time=fixture.timeBounds[0]+fraction*(fixture.timeBounds[1]-fixture.timeBounds[0]);
    const sample=Math.max(0,Math.min(fixture.samples-1,Math.round(time/fixture.dtSeconds)));
    let row=selection.row;if(kind==='bank')row=Math.max(0,Math.min(fixture.widthSamples.length-1,
      Math.floor((1-(event.clientY-bounds.top-8)/(bounds.height-31))*fixture.widthSamples.length)));
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);setSelection({sample,row});
  };
  const keyboard=(kind:PlotKind,event:KeyboardEvent<HTMLCanvasElement>)=>{
    const samples=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
    const rows=kind==='bank'?(event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0):0;
    if(samples||rows){event.preventDefault();event.stopPropagation();setSelection({sample:Math.max(0,Math.min(fixture.samples-1,selection.sample+samples)),
      row:Math.max(0,Math.min(fixture.widthSamples.length-1,selection.row+rows))});}
    if(event.key==='Home'){event.preventDefault();event.stopPropagation();setSelection({sample:candidate.sample,row:fixture.widthSamples.indexOf(candidate.widthSamples)});}
  };
  const selected=selectHFCandidate(fixture,threshold);
  const plots=[{kind:'profile' as const,canvas:profile,title:'Perfil SNR · máximo boxcar',unit:'adimensional'},
    {kind:'bank' as const,canvas:bank,title:'Anchura × tiempo · banco',unit:'ms · NO DM'},
    {kind:'waterfall' as const,canvas:waterfall,title:'Frecuencia × tiempo · HF',unit:'GHz · ΔI'}];
  return <section ref={panel} className="finale-panel hf-finale hf-finale-panel" aria-label="Candidato clásico HF" data-mode="hf" data-event-id={fixture.eventId} data-dm-resolved="false" data-dm-status="unresolved_high_freq" data-confirmation="not-confirmed">
    <header className="finale-heading"><div><span className="finale-eyebrow">ALMA / HF · PULSO GALÁCTICO SINTÉTICO</span><h2>Candidato temporal. DM no resuelta.</h2></div>
      <button type="button" title="Restaurar pico SNR HF" aria-label="Restaurar selección HF" onClick={()=>setSelection({sample:candidate.sample,row:fixture.widthSamples.indexOf(candidate.widthSamples)})}><LocateFixed size={17}/></button></header>
    <div className="finale-body">
    <div className="finale-charts">{plots.map(({kind,canvas,title,unit},index)=><figure key={kind} className={`finale-chart finale-chart-${kind}`}>
      <figcaption><span><b>{index+1}</b> {title}</span><small>{unit}</small></figcaption>
      <canvas ref={canvas} data-kind={kind==='bank'?'width-map':kind} tabIndex={0} role="img" aria-label={`${title}. Pulso sintético inspirado en PSR J1745−2900. Intensidad residual con fondo sustraído. SNR máxima ${number(candidate.snr,2)}, anchura ${number(candidate.widthMs)} ms. DM conocida 1770 pc cm⁻³; DM no resuelta.`}
        onPointerDown={event=>choose(kind,event)} onPointerMove={event=>choose(kind,event)} onKeyDown={event=>keyboard(kind,event)}/>
    </figure>)}</div>
    <div className="finale-selection" aria-live="polite"><span><i className="finale-marker"/> t {number(fixture.timesSeconds[selection.sample]*1000)} ms</span>
      <span>W {number(fixture.widthsMs[selection.row])} ms</span><span>SNR {number(fixture.bank[selection.row*fixture.samples+selection.sample],2)}</span></div>
    <label className="hf-threshold"><span>Umbral η <b>{number(threshold,2)}</b></span>
      <input type="range" min="0" max={Math.max(15,Math.ceil(candidate.snr)+5)} step="0.25" value={threshold}
        aria-label="Umbral SNR HF" onChange={event=>setThreshold(Number(event.currentTarget.value))}/></label>
    <div className="finale-outcome"><span className="finale-methods">Integración · boxcars · inspección radio</span>
      <strong>{selected.accepted?'Propuesta por SNR':'Sin propuesta a este umbral'}</strong>
      <p>DM conocida/inyectada: 1770 pc cm⁻³. Este ejemplo no estima DM ni ejecuta clasificación neuronal.</p></div>
    <div className="finale-legend"><span><i className="finale-window"/> W {number(candidate.widthMs)} ms · pico {number(candidate.timeSeconds*1000)} ms</span>
      <span>Δt {number(fixture.delaysSeconds[0]*1e6,2)} µs &lt; celda 4.096 ms</span></div>
    <p className="finale-provenance">{fixture.provenance}.</p>
    </div>
    <p className="finale-confirmation">Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.</p>
  </section>;
});
