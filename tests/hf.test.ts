import { describe, expect, it } from 'vitest';
import { channelShifts, computeSNR } from '../src/science/pipeline';
import { buildHFFixture, getHFFixture, hfConstruction, selectHFCandidate, HF_SEED, HF_WIDTH_SAMPLES } from '../src/hf/model';
import { createHFStages, HF_FOCUS_TERMS, HF_STAGE_IDS } from '../src/hf/stages';
import { HF_MATH } from '../src/hf/math';
import { equationMarkup } from '../src/math/render';
import { OBSERVATIONS, effectiveDt } from '../src/observations';

describe('Galactic synthetic HF observation',()=>{
  it('keeps the ALMA Band3 setup, native and effective resolution explicit',()=>{
    const f=getHFFixture();expect(f.seed).toBe(HF_SEED);expect(f.samples).toBe(128);expect(f.channels).toBe(32);
    expect(f.dtSeconds).toBe(.004096);expect(effectiveDt(OBSERVATIONS['alma-hf'])).toBe(f.dtSeconds);
    expect(f.frequenciesMHz[0]).toBe(85299.25);expect(f.frequenciesMHz[31]).toBe(87236.75);
    expect(f.dmKnown).toBe(1770);expect(f.dmEstimated).toBeNull();expect(f.dmResolved).toBe(false);
    expect(f.provenance).toContain('PSR J1745−2900');expect(f.provenance).toContain('no FRB observado');
    expect(f.provenance).toContain('fondo sustraído');
  });
  it('reproduces the cold plasma delay with an independent direct formula and no graphic exaggeration',()=>{
    const f=getHFFixture(),direct=4148.808*1770*(1/85299.25**2-1/87236.75**2);
    expect(f.delaysSeconds[0]).toBeCloseTo(direct,15);expect(f.delaysSeconds[0]*1e6).toBeCloseTo(44.333157045,8);
    expect(f.delaysSeconds[31]).toBe(0);expect(f.ratio).toBeCloseTo(direct/.004096,15);
    expect(f.ratioAtMaximumDM).toBeCloseTo(f.ratio*3000/1770,15);
    const resolution=HF_MATH.find(stage=>stage.id==='hf-resolution')!;
    expect(resolution.formula).toContain('k_{\\rm DM}@{dm}');
    expect(resolution.terms.find(term=>term.id==='dm')!.symbol).toBe(String.raw`\mathrm{DM}_{max}`);
    expect(resolution.terms.find(term=>term.id==='known')!.symbol).toBe(String.raw`\mathrm{DM}_{conocida}`);
    expect(resolution.units).toContain('DMmax=3000: R_search=0.018344957');
    expect(resolution.units).toContain('1770: Δt/Δt_ef=0.010823525');
    expect(resolution.source.url).toContain('src/core/pipeline_parameters.py');
    expect(f.ratioAtMaximumDM).toBeLessThan(2);expect(f.ratio).toBeLessThan(1);
    for(let i=1;i<f.delaysSeconds.length;i++)expect(f.delaysSeconds[i]).toBeLessThan(f.delaysSeconds[i-1]);
  });
  it('preserves ties-to-even channel shifts and explicitly loses effective DM resolution',()=>{
    const f=getHFFixture();expect(Array.from(f.shifts)).toEqual(Array(32).fill(0));
    expect(Array.from(channelShifts(f.frequenciesMHz,3000,f.dtSeconds))).toEqual(Array(32).fill(0));
    expect(Math.max(...f.nativeShifts)).toBe(1);expect(Math.min(...f.nativeShifts)).toBe(0);
    expect(channelShifts(f.frequenciesMHz,1770,.000032)).toEqual(f.nativeShifts);
  });
  it('is reproducible and bounded; seed changes do not borrow any LF arrays',()=>{
    const a=buildHFFixture(),b=buildHFFixture(),other=buildHFFixture(7);
    expect(a.waterfall).toEqual(b.waterfall);expect(a.snr).toEqual(b.snr);expect(a.bank).toEqual(b.bank);
    expect(other.waterfall).not.toEqual(a.waterfall);expect(a.waterfall).toHaveLength(4096);expect(a.bank).toHaveLength(768);
    expect(getHFFixture()).toBe(getHFFixture());expect(a.eventId).toBe('HF-17452900');
    for(const value of a.waterfall)expect(Number.isFinite(value)).toBe(true);
  });
  it('transposes actual channel-time values without changing pixel times',()=>{
    const f=getHFFixture();for(const t of[0,61,127])for(const ch of[0,15,31]){
      expect(f.waterfallRows[ch*128+t]).toBe(f.waterfall[t*32+ch]);
      const centre=f.timeBounds[0]+(t+.5)/f.samples*(f.timeBounds[1]-f.timeBounds[0]);
      expect(centre).toBeCloseTo(f.timesSeconds[t],15);
    }
  });
});

describe('Reused classical HF signal processing',()=>{
  it('matches the original Explorer SNR operator exactly, with no inference checkpoint',()=>{
    const f=getHFFixture(),direct=computeSNR(f.waterfall,f.samples,f.channels,f.dtSeconds,Array.from(f.widthsMs));
    expect(f.snr).toEqual(direct.snr);expect(f.normalized).toEqual(direct.series);expect(f.bestWidths).toEqual(direct.bestWidths);
    expect(f.weights).toEqual(direct.weights);expect(f.widthSamples).toEqual([1,2,3,5,8,15]);
    expect(f.widthsMs[3]).toBeCloseTo(20.48,14);expect(f.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1,6);
  });
  it('constructs a width-time bank whose per-time maxima equal the SNR profile',()=>{
    const f=getHFFixture();for(let sample=0;sample<f.samples;sample++){
      let best=-Infinity,width=0;for(let row=0;row<HF_WIDTH_SAMPLES.length;row++){
        const value=f.bank[row*f.samples+sample];if(value>best){best=value;width=HF_WIDTH_SAMPLES[row];}
      }expect(best).toBe(f.snr[sample]);expect(width).toBe(f.bestWidths[sample]);
    }
  });
  it('preserves the NumPy same convention including even widths and zero padding',()=>{
    const f=getHFFixture(),row=1,width=2,coefficient=Math.fround(1/Math.sqrt(width));
    expect(f.bank[row*f.samples]).toBe(Math.fround(f.normalized[0]*coefficient));
    expect(f.bank[row*f.samples+61]).toBe(Math.fround((f.normalized[60]+f.normalized[61])*coefficient));
  });
  it('reuses cached outputs when the threshold selects or rejects a proposal',()=>{
    const f=getHFFixture(),candidate=selectHFCandidate(f,6),snr=f.snr,bank=f.bank;
    expect(candidate.sample).toBe(61);expect(candidate.timeSeconds).toBe(.249856);
    expect(candidate.snr).toBeCloseTo(9.691651344299316,12);expect(candidate.widthSamples).toBe(5);
    expect(candidate.widthMs).toBeCloseTo(20.48,14);expect(candidate.window[0]).toBeCloseTo(.239616,14);
    expect(candidate.window[1]).toBeCloseTo(.260096,14);expect((candidate.window[0]+candidate.window[1])/2).toBe(candidate.timeSeconds);
    expect(candidate.accepted).toBe(true);expect(selectHFCandidate(f,candidate.snr).accepted).toBe(true);
    expect(selectHFCandidate(f,candidate.snr+.001).accepted).toBe(false);
    expect(selectHFCandidate(f,15).accepted).toBe(false);expect(f.snr).toBe(snr);expect(f.bank).toBe(bank);
    expect(candidate.dmEstimated).toBeNull();expect(candidate.score).toBeNull();expect(candidate.confirmed).toBe(false);
    expect(()=>selectHFCandidate(f,NaN)).toThrow(RangeError);expect(()=>selectHFCandidate(f,-1)).toThrow(RangeError);
  });
});

describe('HF animation and equation contracts',()=>{
  it('provides short physical explanations, units, equations and exact focus associations',()=>{
    expect(HF_STAGE_IDS).toEqual(['hf-resolution','hf-matriz','hf-profile','hf-boxcar','hf-candidato']);
    for(const stage of HF_MATH){expect(stage.relation.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(stage.source.url).toMatch(/^https:\/\//);expect(stage.units.length).toBeGreaterThan(15);
      expect(HF_FOCUS_TERMS[stage.id]).toEqual(stage.terms.map(term=>term.id));
      for(const term of stage.terms){expect(stage.formula).toContain(`@{${term.id}}`);expect(equationMarkup(stage,term.id)).not.toContain('katex-error');}
    }
  });
  it('never constructs a DM Bow Tie or attaches an LF learned score',()=>{
    const stages=createHFStages();expect(stages.map(s=>s.id)).toEqual(HF_STAGE_IDS);
    for(const stage of stages){expect(stage.root.userData.dmResolved).toBe(false);expect(stage.root.userData.dmEstimated).toBeNull();
      expect(stage.root.userData.hasRecordedScore).toBe(false);expect(stage.root.userData.eventId).toBe('HF-17452900');
      for(const term of HF_FOCUS_TERMS[stage.id]){stage.setFocus?.(term);expect(stage.root.userData.focusedObjects.length).toBeGreaterThan(0);}
      stage.update(.25,0);const early={...stage.root.userData.construction};stage.update(.9,0);expect(stage.root.userData.construction.completed).toBeGreaterThanOrEqual(early.completed);
      stage.update(.25,0);expect(stage.root.userData.construction).toEqual(early);stage.update(1,0);expect(stage.root.userData.construction.completed).toBe(stage.root.userData.construction.total);
      stage.dispose?.();
    }
  });
  it('reveals cached integer plot samples reversibly and leaves time for inspection',()=>{
    const f=getHFFixture();expect(hfConstruction(0,f)).toEqual({profile:0,bank:0,waterfall:0,classification:false});
    expect(hfConstruction(1,f)).toEqual({profile:128,bank:768,waterfall:4096,classification:true});
    const early=hfConstruction(.4,f);expect(hfConstruction(.9,f).bank).toBeGreaterThan(early.bank);expect(hfConstruction(.4,f)).toEqual(early);
    for(const t of[.13,.45,.77])for(const [key,value]of Object.entries(hfConstruction(t,f)))if(key!=='classification')expect(Number.isInteger(value)).toBe(true);
  });
});
