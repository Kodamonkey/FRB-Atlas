import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { InstancedBufferGeometry, NearestFilter, ShaderMaterial } from 'three';
import { candidateMapPosition, createDataStages, DATA_STAGE_IDS, GUIDED_DM_ROW, reshapeWaterfall, sourceSample, trialDelays, trialProfile } from '../src/cinema/dataStages';
import type { EvidenceArrays, EventEvidence } from '../src/evidence/types';

const evidence: EventEvidence = JSON.parse(readFileSync(resolve('public/evidence/event.json'),'utf8'));
function floats(name: string): Float32Array {
  const bytes=readFileSync(resolve('public/evidence',name));
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
}
const arrays: EvidenceArrays = {
  waterfall:floats('waterfall.f32'),dmMap:floats('dm-map.f32'),originalCrop:floats('original-crop.f32'),
  preparedCrop:floats('prepared-crop.f32'),profile:floats('profile.f32'),rgb:Uint8Array.from(readFileSync(resolve('public/evidence/rgb.u8'))),
};

describe('Cinematic stages preserve the single event',()=>{
  it('transposes only the texture layout, preserving physical time/channel samples',()=>{
    expect(Array.from(reshapeWaterfall(new Float32Array([1,10,2,20,3,30]),3,2))).toEqual([1,2,3,10,20,30]);
    expect(()=>reshapeWaterfall(new Float32Array(3),3,2)).toThrow(RangeError);
    const pixels=reshapeWaterfall(arrays.waterfall,evidence.axes.samples,evidence.axes.channels);
    expect(pixels[34*evidence.axes.samples+551]).toBe(arrays.waterfall[551*evidence.axes.channels+34]);
  });
  it('maps the real dedispersed crop to its per-channel source samples',()=>{
    const localCandidate=evidence.crop.candidateSample-evidence.crop.startSample+evidence.crop.paddingLeft;
    expect(localCandidate).toBe(256);
    for(const channel of [0,31,63]){
      const originalIndex=sourceSample(evidence,localCandidate,channel);
      expect(arrays.originalCrop[localCandidate*64+channel]).toBe(arrays.waterfall[originalIndex*64+channel]);
    }
    expect(sourceSample(evidence,256,0)).toBeGreaterThan(sourceSample(evidence,256,63));
  });
  it('keeps physical DM coordinates distinct from the CenterNet image coordinates',()=>{
    const marker=candidateMapPosition(evidence);
    expect(marker.x).toBeCloseTo((evidence.candidate.timeSeconds/2.048-.5)*8.4,12);
    expect(marker.y).toBeCloseTo((evidence.candidate.dm/1000-.5)*3.8,12);
    expect(evidence.candidate.decode?.imgSize).toBe(512);
    expect(evidence.candidate.decode?.centerCNN[1]).not.toBe(evidence.candidate.dm);
  });
  it('uses the true SNR maximum without forcing it onto the detector center',()=>{
    const maximum=Math.max(...arrays.profile);
    const peak=arrays.profile.indexOf(maximum);
    expect(maximum).toBe(evidence.candidate.snr);
    expect(peak).toBe(259);
    expect(evidence.crop.startSample+peak).toBe(554);
    expect(evidence.candidate.timeIndex).toBe(551);
  });
  it('creates fourteen ordered, lazy data stages and caches geometry/textures across updates',()=>{
    const stages=createDataStages();
    expect(stages.map(stage=>stage.id)).toEqual(DATA_STAGE_IDS);
    expect(stages.map(stage=>stage.root.name)).toEqual(DATA_STAGE_IDS);
    expect(stages).toHaveLength(14);
    for(const stage of stages){
      expect(stage.root.children).toHaveLength(0);
      expect(stage.continuous).toBe(false);
      expect(stage.mobileScale).toBe(2.2);
      expect(stage.camera.toArray()).toEqual([0,2,9]);
      expect(stage.target.toArray()).toEqual([0,0,0]);
      stage.setEvidence?.(evidence,arrays);
      const children=stage.root.children.length;
      const geometries:unknown[]=[],materials:ShaderMaterial[]=[];
      stage.root.traverse(object=>{
        const mesh=object as import('three').Mesh;
        if(mesh.geometry)geometries.push(mesh.geometry);
        if(mesh.material instanceof ShaderMaterial)materials.push(mesh.material);
      });
      expect(materials.every(material=>'uFade' in material.uniforms)).toBe(true);
      stage.setEvidence?.(evidence,arrays);
      expect(stage.root.children).toHaveLength(children);
      for(const p of [0,.25,.5,.99,1])stage.update(p,4);
      const after:unknown[]=[];
      stage.root.traverse(object=>{const mesh=object as import('three').Mesh;if(mesh.geometry)after.push(mesh.geometry);});
      expect(after).toEqual(geometries);
      stage.dispose?.();
    }
  });
  it('preserves every native source value while tessellating relief by row',()=>{
    const stages=createDataStages();
    stages[0].setEvidence?.(evidence,arrays);
    stages[4].setEvidence?.(evidence,arrays);
    const waterfall=stages[0].root.children.find(object=>(object as import('three').Mesh).geometry instanceof InstancedBufferGeometry) as import('three').Mesh<InstancedBufferGeometry>;
    const map=stages[4].root.children.find(object=>(object as import('three').Mesh).geometry instanceof InstancedBufferGeometry) as import('three').Mesh<InstancedBufferGeometry>;
    for(const [mesh,rows,values] of [[waterfall,64,reshapeWaterfall(arrays.waterfall,2048,64)],[map,96,arrays.dmMap]] as const){
      expect(mesh.geometry.instanceCount).toBe(rows);
      expect(Array.from(mesh.geometry.getAttribute('aRow').array)).toEqual(Array.from({length:rows},(_,row)=>row));
      expect(mesh.geometry.getAttribute('uv').count).toBe(514);
      expect(mesh.geometry.getAttribute('position').count*rows).toBeLessThan(2048*rows*4/10);
      expect(mesh.geometry.getIndex()?.count).toBe(256*6);
      const material=mesh.material as ShaderMaterial;
      const texture=material.uniforms.uData.value as import('three').DataTexture;
      expect(texture.image.width).toBe(2048);
      expect(texture.image.height).toBe(rows);
      expect(texture.image.data.length).toBe(values.length);
      expect(values.every((value,index)=>texture.image.data[index]===value)).toBe(true);
      expect(texture.minFilter).toBe(NearestFilter);
      expect(texture.magFilter).toBe(NearestFilter);
      expect(material.fragmentShader).toContain('float value=texture2D(uData,vUv).r');
      expect(material.fragmentShader).not.toContain('varying float vValue');
      expect(material.vertexShader).toContain('(aRow + .5) / uShape.y');
    }
    stages.forEach(stage=>stage.dispose?.());
  });
  it('aligns the full observation under the guided trial without using a future candidate crop',()=>{
    const stage=createDataStages()[2];stage.setEvidence?.(evidence,arrays);
    const strips=stage.root.children.find(object=>(object as import('three').Mesh).geometry instanceof InstancedBufferGeometry) as import('three').Mesh<InstancedBufferGeometry,ShaderMaterial>;
    const texture=strips.material.uniforms.uData.value as import('three').DataTexture;
    const delays=strips.material.uniforms.uDelay.value as import('three').DataTexture;
    expect(strips.geometry.instanceCount).toBe(64);
    expect([texture.image.width,texture.image.height]).toEqual([2048,64]);
    const expected=reshapeWaterfall(arrays.waterfall,2048,64);
    expect(expected.every((value,index)=>texture.image.data[index]===value)).toBe(true);
    expect(Array.from(delays.image.data)).toEqual(evidence.crop.delaySamples);
    expect(trialDelays(evidence)).toEqual(evidence.crop.delaySamples);
    const withoutCandidateCrop={...evidence,crop:{...evidence.crop,delaySamples:new Array(64).fill(0)}};
    expect(trialDelays(withoutCandidateCrop)).toEqual(evidence.crop.delaySamples);
    stage.update(0,0);expect(strips.material.uniforms.uSourceSpan.value).toBe(2048);
    stage.update(1,0);expect(strips.material.uniforms.uSourceSpan.value).toBe(1435);
    expect(strips.material.vertexShader).toContain('uv.x*uShape.x - vDelay');
    expect(strips.material.vertexShader).toContain('rowAlign=clamp(uAlign*uShape.y-aRow,0.,1.)');
    expect(strips.material.fragmentShader).toContain('sampleIndex>=uSourceSpan');
    expect(stage.root.scale.toArray()).toEqual([.67,.67,.67]);
    stage.dispose?.();
  });
  it('samples crop and activation values per fragment instead of interpolating four texture corners',()=>{
    const stage=createDataStages()[11];
    stage.setEvidence?.(evidence,arrays);
    const planes=stage.root.children.filter(object=>{
      const material=(object as import('three').Mesh).material;
      return material instanceof ShaderMaterial && 'uData' in material.uniforms;
    }) as import('three').Mesh<import('three').BufferGeometry,ShaderMaterial>[];
    expect(planes).toHaveLength(4);
    for(const plane of planes){
      expect(plane.material.vertexShader).toContain('texture2D');
      expect(plane.material.uniforms.uLift.value).toBe(0);
      expect(plane.material.fragmentShader).toContain('float value=texture2D(uData,vUv).r');
    }
    stage.dispose?.();
  });
  it('shows the exact exposed-intensity trial profile before the detector, not candidate SNR',()=>{
    const values=trialProfile(evidence,arrays);
    expect(GUIDED_DM_ROW).toBe(47);
    expect(values.length).toBe(2048);
    expect(values.every((value,index)=>value===arrays.dmMap[47*2048+index])).toBe(true);
    expect(values.buffer).toBe(arrays.dmMap.buffer);
    const stage=createDataStages()[3];stage.setEvidence?.(evidence,arrays);
    const curve=stage.root.getObjectByName('recorded-profile')!;
    expect(curve.userData.values).toEqual(values);
    expect(stage.root.getObjectByName('label:2.047 s')).toBeDefined();
    expect(stage.root.getObjectByName('label:2.048 s')).toBeUndefined();
    expect(stage.root.children.some(object=>object.name.includes('SNR'))).toBe(false);
    stage.dispose?.();
  });
  it('prepares one exact RGB input image, never three spatial input planes',()=>{
    const stage=createDataStages()[5];stage.setEvidence?.(evidence,arrays);
    const images=stage.root.children.filter(object=>object.name==='detector-rgb-input') as import('three').Mesh<import('three').BufferGeometry,ShaderMaterial>[];
    expect(images).toHaveLength(1);
    const texture=images[0].material.uniforms.uData.value as import('three').DataTexture;
    expect([texture.image.width,texture.image.height]).toEqual([512,512]);
    expect(images[0].userData.originalShape).toEqual([1,3,512,512]);
    expect(arrays.rgb.every((value,index)=>texture.image.data[Math.floor(index/3)*4+index%3]===value)).toBe(true);
    expect(images[0].material.fragmentShader).toContain('texture2D(uData,vUv).rgb');
    expect(images[0].material.uniforms).not.toHaveProperty('uChannel');
    stage.dispose?.();
  });
  it('uses only recorded activation maps and marks architecture separately',()=>{
    const stages=createDataStages();
    for(const stage of stages){
      stage.setEvidence?.(evidence,arrays);
      stage.root.traverse(object=>{
        const recorded=evidence.snapshots.find(snapshot=>snapshot.id===object.name);
        const material=(object as import('three').Mesh).material;
        if(recorded&&material instanceof ShaderMaterial){
          const texture=material.uniforms.uData.value as import('three').DataTexture;
          expect([texture.image.width,texture.image.height]).toEqual([recorded.width,recorded.height]);
          expect(recorded.values.every((value,index)=>texture.image.data[index]===Math.fround(value))).toBe(true);
          expect(object.userData.originalShape).toEqual(recorded.shape);
        }
        if(object.name.startsWith('operator-'))expect(object.userData.quantity).toBe('architecture, not activation');
      });
      stage.dispose?.();
    }
  });
  it('retains the original 512x64 candidate crop and distinct detector/SNR positions',()=>{
    const cropStage=createDataStages()[10];cropStage.setEvidence?.(evidence,arrays);
    const crop=cropStage.root.getObjectByName('original-candidate-crop') as import('three').Mesh<import('three').BufferGeometry,ShaderMaterial>;
    const texture=crop.material.uniforms.uData.value as import('three').DataTexture;
    expect([texture.image.width,texture.image.height]).toEqual([512,64]);
    const expected=reshapeWaterfall(arrays.originalCrop,512,64);
    expect(expected.every((value,index)=>texture.image.data[index]===value)).toBe(true);
    expect(crop.geometry.getAttribute('position').count).toBe((128+1)*(64+1));
    const dimensions=(crop.geometry as import('three').PlaneGeometry).parameters;
    expect(dimensions.width).toBeGreaterThan(dimensions.height);
    const finalStage=createDataStages()[13];finalStage.setEvidence?.(evidence,arrays);
    expect(finalStage.root.getObjectByName('snr-maximum')?.userData.sampleIndex).toBe(259);
    expect(finalStage.root.getObjectByName('detector-crop-center')?.userData.sampleIndex).toBe(256);
    expect(finalStage.root.getObjectByName('candidate-snr-profile')?.userData.values).toBe(arrays.profile);
    cropStage.dispose?.();finalStage.dispose?.();
  });
  it('keeps all 512 real GAP values, two signed logits and exact softmax outputs',()=>{
    const stage=createDataStages()[12];stage.setEvidence?.(evidence,arrays);
    const gap=evidence.snapshots.find(snapshot=>snapshot.id==='classifier-gap-vector')!;
    const bars=stage.root.getObjectByName(gap.id) as import('three').InstancedMesh;
    expect(bars.count).toBe(512);
    expect(bars.userData.values).toEqual(gap.values);
    expect(stage.root.getObjectByName('classifier-logits')?.userData.values).toEqual(evidence.inference.logits);
    expect(stage.root.getObjectByName('classifier-softmax')?.userData.values).toEqual(evidence.inference.probabilities);
    stage.dispose?.();
  });
  it('keeps glyphs at native aspect ratio and shrinks both dimensions together',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({
      measureText:(text:string)=>({width:text.length*24}),fillText:()=>{},
    })})});
    const stage=createDataStages()[0];
    try{
      stage.setEvidence?.(evidence,arrays);
      const labels=stage.root.children.filter(object=>object.children.length===1 && object.name.startsWith('label:'));
      expect(labels.length).toBeGreaterThan(0);
      for(const label of labels){
        const mesh=label.children[0] as import('three').Mesh<import('three').PlaneGeometry,import('three').MeshBasicMaterial>;
        const canvas=mesh.material.map!.image;
        expect(canvas.height).toBe(64);
        expect(mesh.geometry.parameters.height).toBeLessThanOrEqual(.23);
        expect(mesh.geometry.parameters.width/mesh.geometry.parameters.height).toBeCloseTo(canvas.width/canvas.height,12);
      }
    }finally{stage.dispose?.();vi.unstubAllGlobals();}
  });
});
