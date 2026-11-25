import {createHash} from 'node:crypto';
import {descriptor,overlay,pocketAddress} from './phi-mycelium-r2.mjs';

export const VERSION='PhiMycelium.R6';
const MAX_RECORDS=729,MAX_BYTES=2_000_000;
const refuse=reason=>{throw new Error('MEMORY_REFUSE: '+reason);};
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function make(id,parent,revision,edits){
  if(!integer(id,0,728)||!integer(revision,0,728))refuse('identity or revision');
  if(revision===0?parent!==null:typeof parent!=='string'||!/^[a-f0-9]{64}$/.test(parent))refuse('parent');
  const state=overlay(descriptor(pocketAddress(id)),edits);
  const body={version:VERSION,id,address:state.descriptor.address,revision,parent,descriptor:state.descriptor,edits:state.edits,contentChecksum:state.checksum};
  return {...body,hash:digest(body)};
}
export function genesis(id){return make(id,null,0,[]);}
function validateRecord(r){
  if(!r||typeof r!=='object'||!Array.isArray(r.edits))refuse('record');
  const expected=make(r.id,r.parent,r.revision,r.edits);
  if(JSON.stringify(r)!==JSON.stringify(expected))refuse('record integrity');
  if(r.revision===0&&r.edits.length)refuse('genesis edits');
  return expected;
}
// Immutable replica snapshots; no network, credentials or automatic conflict resolution.
export function recover(records){
  if(!Array.isArray(records)||records.length>MAX_RECORDS)refuse('record budget');
  const byHash=new Map(),children=new Map(),roots=new Map();
  for(const raw of records){
    const r=validateRecord(raw);
    if(byHash.has(r.hash))refuse('duplicate record');
    byHash.set(r.hash,r);
  }
  for(const r of byHash.values()){
    if(r.parent===null){
      if(roots.has(r.id))refuse('duplicate genesis');
      roots.set(r.id,r.hash);
    }else{
      const p=byHash.get(r.parent);
      if(!p||p.id!==r.id||p.revision+1!==r.revision)refuse('missing or invalid ancestry');
      if(!children.has(r.parent))children.set(r.parent,[]);
      children.get(r.parent).push(r.hash);
    }
  }
  const heads=new Map();
  for(const r of byHash.values())if(!children.has(r.hash)){
    if(!heads.has(r.id))heads.set(r.id,[]);
    heads.get(r.id).push(r.hash);
  }
  const ordered=[...byHash.values()].sort((a,b)=>a.id-b.id||a.revision-b.revision||a.hash.localeCompare(b.hash));
  const pockets=[...heads].sort((a,b)=>a[0]-b[0]).map(([id,h])=>({id,heads:h.sort(),status:h.length===1?'RESOLVED':'CONFLICT'}));
  const body={version:VERSION,records:ordered,pockets};
  return {...body,checksum:digest(body)};
}
export function commit(records,{id,expectedHead,edits}={}){
  const s=recover(records);
  const p=s.pockets.find(x=>x.id===id);
  if(!p||p.status!=='RESOLVED'||p.heads[0]!==expectedHead)refuse('stale or conflicting head');
  if(!Array.isArray(edits))refuse('complete overlay required');
  if(s.records.length>=MAX_RECORDS)refuse('record budget');
  const head=s.records.find(r=>r.hash===expectedHead);
  const next=make(id,head.hash,head.revision+1,edits);
  if(next.contentChecksum===head.contentChecksum)refuse('no content change');
  return recover([...s.records,next]);
}
export function reconcile(replicas){
  if(!Array.isArray(replicas)||replicas.length<1||replicas.length>9)refuse('replica budget');
  const union=new Map();
  for(const replica of replicas){
    const s=recover(replica);
    for(const r of s.records){
      if(!union.has(r.hash)&&union.size>=MAX_RECORDS)refuse('union budget');
      union.set(r.hash,r);
    }
  }
  return recover([...union.values()]);
}
export function readPocket(records,id){
  const s=recover(records),p=s.pockets.find(x=>x.id===id);
  if(!p||p.status!=='RESOLVED')refuse('missing or conflicting pocket');
  const r=s.records.find(x=>x.hash===p.heads[0]);
  return {record:r,cells:overlay(r.descriptor,r.edits).cells};
}
export function checkpoint(records){
  const s=recover(records),body=JSON.stringify(s);
  if(Buffer.byteLength(body)>MAX_BYTES)refuse('checkpoint budget');
  return body;
}
export function restore(text){
  if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES)refuse('checkpoint budget');
  let raw;
  try{raw=JSON.parse(text);}catch{refuse('checkpoint parse');}
  const expected=recover(raw?.records);
  if(JSON.stringify(expected)!==text)refuse('checkpoint integrity or canonical encoding');
  return expected;
}
