/**
 * R13 executor-side anchor continuity floor (local owner-only history).
 *
 * After a FRESH, VALID R11 signature over R12 mutual TLS is checked, retain
 * its accepted epoch and R9 witness hash. Reject lower or equivocated epochs
 * across independent one-shot worker processes. This is not an independently
 * secured monotonic counter: a host admin can restore/delete this directory.
 */
import {createHash} from 'node:crypto';
import {
  lstatSync,readdirSync,readFileSync,openSync,closeSync,
  writeFileSync,fsyncSync
} from 'node:fs';
import {isAbsolute,join} from 'node:path';

export const ANCHOR_CONTINUITY_SCHEMA='NBGPocketMesh.AnchorContinuity.v1';
const HASH=/^[a-f0-9]{64}$/;
const NAME=/^epoch-([0-9]{6})\.json$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=v=>{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')
    return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(plain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  throw new TypeError('Invalid anchor continuity type');
};
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
const filename=epoch=>'epoch-'+String(epoch).padStart(6,'0')+'.json';
function protectedPath(path,dir){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Absolute continuity directory required');
  const st=lstatSync(path);
  if(dir?!st.isDirectory():!st.isFile())
    throw new TypeError('Invalid, missing or symbolic-linked continuity path');
  if(process.platform!=='win32'&&
     ((st.mode&0o077)!==0||
       (typeof process.getuid==='function'&&st.uid!==process.getuid())))
    throw new TypeError('Continuity path owner or mode invalid');
  return st;
}
function readRecord(path){
  const st=protectedPath(path,false);
  if(st.size<50||st.size>1024)
    throw new TypeError('Oversized or missing continuity record');
  const r=JSON.parse(readFileSync(path,'utf8'));
  if(!plain(r)||JSON.stringify(Object.keys(r).sort())!==
     JSON.stringify(['schema','epoch','witnessSha256','anchorAttestationSha256',
       'previousSha256','recordedAtMs','recordSha256'].sort()))
    throw new TypeError('Malformed continuity record');
  if(r.schema!==ANCHOR_CONTINUITY_SCHEMA||
     !Number.isSafeInteger(r.epoch)||r.epoch<1||r.epoch>256||
     !HASH.test(r.witnessSha256)||!HASH.test(r.anchorAttestationSha256)||
     (r.previousSha256!==null&&!HASH.test(r.previousSha256))||
     !Number.isSafeInteger(r.recordedAtMs)||r.recordedAtMs<0||
     !HASH.test(r.recordSha256))
    throw new TypeError('Invalid continuity record');
  const {recordSha256,...unsigned}=r;
  if(digest(unsigned)!==recordSha256)
    throw new TypeError('Continuity record hash mismatch');
  return r;
}
export function inspectAnchorContinuity(dir){
  protectedPath(dir,true);
  const names=readdirSync(dir).sort();
  if(names.length>256)throw new TypeError('Continuity directory exceeds bound');
  let previous=null;
  for(const name of names){
    const match=NAME.exec(name);
    if(!match)throw new TypeError('Unexpected continuity directory entry');
    const record=readRecord(join(dir,name));
    if(name!==filename(record.epoch)||
       (previous&&record.epoch<=previous.epoch)||
       record.previousSha256!==(previous?.recordSha256??null))
      throw new TypeError('Continuity history broken or equivocated');
    previous=record;
  }
  return previous?{
    epoch:previous.epoch,witnessSha256:previous.witnessSha256,
    recordSha256:previous.recordSha256,records:names.length
  }:{epoch:0,witnessSha256:null,recordSha256:null,records:0};
}
function syncDir(dir){
  if(process.platform==='win32')return;
  const fd=openSync(dir,'r');
  try{fsyncSync(fd);}finally{closeSync(fd);}
}
export function acceptAnchorContinuity(dir,{epoch,witnessSha256,anchorAttestationSha256}={}){
  if(!Number.isSafeInteger(epoch)||epoch<1||epoch>256||
     !HASH.test(witnessSha256||'')||!HASH.test(anchorAttestationSha256||''))
    throw new TypeError('Invalid verified anchor continuity inputs');
  // A small retry window supports two cooperative workers verifying the same
  // signed current authority state concurrently. Only O_EXCL writes new epochs.
  for(let attempt=0;attempt<5;attempt++){
    const tip=inspectAnchorContinuity(dir);
    if(epoch<tip.epoch)throw new TypeError('Anchor epoch decreased below remembered floor');
    if(epoch===tip.epoch){
      if(tip.witnessSha256!==witnessSha256)
        throw new TypeError('Anchor equivocated at an already accepted epoch');
      return {epoch,recordSha256:tip.recordSha256,advanced:false};
    }
    const unsigned={
      schema:ANCHOR_CONTINUITY_SCHEMA,epoch,witnessSha256,
      anchorAttestationSha256,previousSha256:tip.recordSha256,
      recordedAtMs:Date.now()
    };
    const record={...unsigned,recordSha256:digest(unsigned)};
    let fd;
    try{fd=openSync(join(dir,filename(epoch)),'wx',0o600);}
    catch(error){
      if(error.code==='EEXIST')continue;
      throw error;
    }
    try{
      writeFileSync(fd,JSON.stringify(record)+'\n','utf8');
      fsyncSync(fd);
    }finally{closeSync(fd);}
    syncDir(dir);
    // If an unrelated epoch was concurrently appended or contents changed,
    // fail closed. No permit nonce has been spent before this check.
    const newest=inspectAnchorContinuity(dir);
    if(newest.epoch!==epoch||newest.witnessSha256!==witnessSha256)
      throw new TypeError('Anchor continuity changed during acceptance');
    return {epoch,recordSha256:record.recordSha256,advanced:true};
  }
  throw new TypeError('Concurrent anchor continuity update did not stabilize');
}
