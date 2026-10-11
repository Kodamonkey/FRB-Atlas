import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataTexture, Mesh, ShaderMaterial } from 'three';
import { channelAccumulation, constructionIndex, createDataStages, DATA_FOCUS_TERMS, DATA_STAGE_IDS, trialDelays, trialProfile } from '../src/cinema/dataStages';
import type { EvidenceArrays, EventEvidence } from '../src/evidence/types';

const evidence:EventEvidence=JSON.parse(readFileSync(resolve('public/evidence/event.json'),'utf8'));
function floats(name:string):Float32Array {
  const bytes=readFileSync(resolve('public/evidence',name));
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
}
const arrays:EvidenceArrays={waterfall:floats('waterfall.f32'),dmMap:floats('dm-map.f32'),originalCrop:floats('original-crop.f32'),
  preparedCrop:floats('prepared-crop.f32'),profile:floats('profile.f32'),rgb:Uint8Array.from(readFileSync(resolve('public/evidence/rgb.u8')))};

function stage(id:typeof DATA_STAGE_IDS[number]) {
  const value=createDataStages().find(stage=>stage.id===id)!;value.setEvidence?.(evidence,arrays);return value;
}

describe('Discrete scientific plot construction',()=>{
  it('writes temporal samples by channels and DM trials by time cells',()=>{
    expect(constructionIndex(1/12,4,3,'time')).toMatchObject({completed:1,column:0,row:1,completedColumns:0});
    expect(constructionIndex(3/12,4,3,'time')).toMatchObject({completed:3,column:1,row:0,completedColumns:1});
    expect(constructionIndex(4/12,4,3,'rows')).toMatchObject({completed:4,column:0,row:1,completedRows:1});
    expect(constructionIndex(-1,4,3).completed).toBe(0);
    expect(constructionIndex(2,4,3).completed).toBe(12);
    const cached=constructionIndex(0,4,3);
    expect(constructionIndex(.5,4,3,'rows',cached)).toBe(cached);
    expect(cached.completed).toBe(6);
  });

  it('commits integer counts reversibly while preserving texture and geometry identities',()=>{
    for(const id of ['matriz','perfil','bowtie','recorte'] as const){
      const current=stage(id),geometries:unknown[]=[],textures:DataTexture[]=[];
      current.root.traverse(object=>{
        if(object instanceof Mesh)geometries.push(object.geometry);
        if(object instanceof Mesh&&object.material instanceof ShaderMaterial){
          for(const uniform of Object.values(object.material.uniforms))if(uniform.value instanceof DataTexture)textures.push(uniform.value);
        }
      });
      const data=textures.map(texture=>texture.image.data),metadata=current.root.userData.construction;
      const counts:number[]=[];
      for(const progress of [0,.25,.75,1,.75,.25,0]){
        current.update(progress,0);const construction=current.root.userData.construction;
        expect(construction).toBe(metadata);expect(Number.isInteger(construction.completed)).toBe(true);
        expect(Number.isInteger(construction.total)).toBe(true);expect(construction.completed).toBeGreaterThanOrEqual(0);
        expect(construction.completed).toBeLessThanOrEqual(construction.total);counts.push(construction.completed);
      }
      expect(counts[0]).toBe(0);expect(counts[3]).toBe(metadata.total);
      expect(counts[1]).toBe(counts[5]);expect(counts[2]).toBe(counts[4]);expect(counts[6]).toBe(0);
      const after:unknown[]=[];current.root.traverse(object=>{if(object instanceof Mesh)after.push(object.geometry);});
      expect(after).toEqual(geometries);expect(textures.map(texture=>texture.image.data)).toEqual(data);
      current.dispose?.();
    }
  });

  it('masks native texture cells with an explicit writing order, never a continuous-only wipe',()=>{
    for(const [id,name,order] of [['matriz','observed-waterfall',1],['bowtie','physical-dm-map',0],['recorte','original-candidate-crop',0]] as const){
      const current=stage(id);current.update(.7,0);
      const mesh=current.root.getObjectByName(name) as Mesh<import('three').BufferGeometry,ShaderMaterial>;
      const uniforms=mesh.material.uniforms;
      expect(uniforms.uWriteOrder.value).toBe(order);expect(Number.isInteger(uniforms.uCommitted.value)).toBe(true);
      expect(uniforms.uReveal.value).toBe(1);expect(uniforms.uRowReveal.value).toBe(1);
      expect(mesh.material.fragmentShader).toContain('floor(vUv*uShape)');
      expect(mesh.material.fragmentShader).toContain('cell.x*uShape.y+cell.y');
      expect(mesh.material.fragmentShader).toContain('float value=texture2D(uData,vUv).r');
      expect(mesh.getObjectByName('write-cursor')).toBeDefined();current.dispose?.();
    }
  });

  it('accumulates actual valid channel samples using float32 sums and exposed means',()=>{
    const cache=channelAccumulation(evidence,arrays),delays=trialDelays(evidence),recorded=trialProfile(evidence,arrays);
    expect(cache.means.every((value,index)=>value===recorded[index])).toBe(true);
    for(const sample of [0,551,1435,2047]){
      let sum=0,exposure=0;
      for(let channel=0;channel<64;channel++){
        const source=sample+delays[channel],valid=source<2048;
        const input=valid?arrays.waterfall[source*64+channel]:0;
        expect(cache.values[channel*2048+sample]).toBe(input);
        if(valid){sum=Math.fround(sum+input);exposure++;}
        const prefix=sample*65+channel+1;
        expect(cache.sums[prefix]).toBe(sum);expect(cache.exposure[prefix]).toBe(exposure);
      }
    }
    expect(cache.exposure[2047*65+64]).toBe(1);
  });

  it('commits profile means only after their channels have been accumulated',()=>{
    const current=stage('perfil');current.update(.4,0);
    const construction=current.root.userData.construction;
    const curve=current.root.getObjectByName('recorded-profile') as import('three').Line<import('three').BufferGeometry,ShaderMaterial>;
    expect(curve.material.uniforms.uCommitCount.value).toBe(construction.committedSamples);
    expect(construction.committedSamples).toBe(Math.floor(construction.completed/64));
    expect(construction.channel).toBe(construction.completed%64);
    expect(construction.meanRecorded).toBe(arrays.dmMap[47*2048+construction.sample]);
    expect(construction.exposure).toBeLessThanOrEqual(construction.channel);
    expect(current.root.getObjectByName('channel-accumulation')).toBeDefined();
    current.dispose?.();
  });

  it('applies all exact formula focus terms immediately and preserves the input data',()=>{
    for(const id of DATA_STAGE_IDS){
      const current=stage(id);current.update(.5,0);
      for(const term of DATA_FOCUS_TERMS[id]){
        current.setFocus?.(term);
        expect(current.root.userData.focus).toBe(term);
        expect(current.root.userData.focusedObjects.length).toBeGreaterThan(0);
      }
      current.setFocus?.(null);expect(current.root.userData.focus).toBeNull();
      expect(current.root.userData.focusedObjects).toHaveLength(0);
      expect(current.root.userData.inferenceMode).toBe('precomputed');current.dispose?.();
    }
  });

  it('links sample/frequency focus to the current native cell and clears it without another frame',()=>{
    const current=stage('matriz');current.update(.32,0);
    const mesh=current.root.getObjectByName('observed-waterfall') as Mesh<import('three').BufferGeometry,ShaderMaterial>;
    const texture=mesh.material.uniforms.uData.value as DataTexture,data=texture.image.data;
    current.setFocus?.('sample');expect(mesh.material.uniforms.uFocusColumn.value).toBe(mesh.userData.construction.column);
    current.setFocus?.('frequency');expect(mesh.material.uniforms.uFocusRow.value).toBe(mesh.userData.construction.row);
    expect(mesh.material.uniforms.uFocusColumn.value).toBe(-1);
    current.setFocus?.(null);expect(mesh.material.uniforms.uFocus.value).toBe(0);
    expect(mesh.material.uniforms.uFocusRow.value).toBe(-1);expect(texture.image.data).toBe(data);
    expect([texture.image.width,texture.image.height]).toEqual([2048,64]);current.dispose?.();
  });

  it('reveals real precomputed network outputs discretely without creating free inference',()=>{
    const current=stage('decision');current.update(.2,0);
    const features=current.root.getObjectByName('classifier-gap-vector') as import('three').InstancedMesh;
    const firstCount=features.count;expect(Number.isInteger(firstCount)).toBe(true);expect(firstCount).toBeLessThan(512);
    current.update(1,0);expect(features.count).toBe(512);
    expect(current.root.userData.construction.completed).toBe(516);
    current.update(.2,0);expect(features.count).toBe(firstCount);
    expect(current.root.getObjectByName('classifier-logits')?.userData.values).toEqual(evidence.inference.logits);
    expect(current.root.getObjectByName('classifier-softmax')?.userData.values).toEqual(evidence.inference.probabilities);
    current.dispose?.();
  });
});
