/**
 * E2-P/C: quantized trained gear bundles and bounded, contradiction-aware precision escalation.
 * Offline synthetic numerical laboratory ONLY. No neural checkpoint, GPU, distributed inference,
 * actual VRAM residency, online weight writes, or proof of NBG closure.
 */
import { E2A, dataset, trainE2A, manifestsE2A, planE2A, digest } from './e2a-gears.mjs';

export const E2PC = Object.freeze({
  schema:'NBGPocketMesh.E2PC.v1', precisionLevels:['int4','int8','f32'],
  policyModes:['f32','int8','int4','bound','conflict','hybrid'],
  source:'E2A-LOCAL-SYNTHETIC', threshold:'strict-sign-certification',
  bundledCoefficients:8, totalBundles:6, maxDepth:2
});
const dot=(w,x)=>w.reduce((sum,v,i)=>sum+v*x[i],0);
const basis=(x,z)=>[x*z,x*x-1/3,z*z-1/3];
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
const decodeNibble=n=>n>=8?n-16:n;

/** True numerical quantization with packed signed four-bit storage and an explicit scale. */
export function encodeTensor(values,level) {
  if(!Array.isArray(values)||values.length!==8||!values.every(validNumber)) throw new TypeError('Expected eight finite weights');
  if(level==='f32') {
    const payload=Float32Array.from(values);
    return {level,scale:null,data:Array.from(payload),payloadBytes:payload.byteLength};
  }
  if(!['int4','int8'].includes(level)) throw new TypeError('Unknown precision');
  const bound=level==='int4'?7:127;
  const scale=Math.fround(Math.max(...values.map(x=>Math.abs(x)))/bound||1);
  const q=values.map(x=>Math.max(-bound,Math.min(bound,Math.round(x/scale))));
  const data=level==='int8'?Array.from(Int8Array.from(q)):
    Array.from(Uint8Array.from({length:4},(_,i)=>(q[2*i]&15)|((q[2*i+1]&15)<<4)));
  return {level,scale,data,payloadBytes:data.length+4}; // Four bytes include FP32 scale
}
export function decodeTensor(t) {
  if(!t || !Array.isArray(t.data) || !['int4','int8','f32'].includes(t.level)) throw new TypeError('Invalid packed tensor');
  if(t.level==='f32') {
    if(t.data.length!==8||!t.data.every(validNumber)||t.payloadBytes!==32||t.scale!==null) throw new TypeError('Invalid float tensor');
    return t.data.map(Math.fround);
  }
  const length=t.level==='int4'?4:8;
  if(!validNumber(t.scale)||t.scale<=0||t.data.length!==length||t.payloadBytes!==length+4||
    !t.data.every(x=>Number.isInteger(x)&&(t.level==='int4'?x>=0&&x<=255:x>=-127&&x<=127))) throw new TypeError('Invalid quantized tensor');
  const q=t.level==='int4'?t.data.flatMap(x=>[decodeNibble(x&15),decodeNibble((x>>4)&15)]):t.data;
  if(t.level==='int4'&&q.some(x=>x===-8)) throw new TypeError('Invalid signed int4 code');
  return q.map(x=>x*t.scale);
}
function bundlesOf(model) {return model.parent.map((parent,i)=>[...parent,...model.children[i].flat()]);}
export function createPrecisionBank(model=trainE2A()) {
  const bundles=bundlesOf(model);
  const weights=bundles.map(w=>{
    const f32=encodeTensor(w,'f32');
    const quant=(level)=>{
      const t=encodeTensor(w,level),decoded=decodeTensor(t);
      // Bound metadata is created offline. At inference it avoids reading F32 coefficients.
      t.errorAbs=f32.data.map((x,i)=>Math.abs(x-decoded[i])+1e-12);
      t.boundMetadataBytes=8*8; // Eight Float64 bound coefficients, not included in payload tally.
      return t;
    };
    return {f32,int8:quant('int8'),int4:quant('int4')};
  });
  const hashes=weights.map(w=>digest(w));
  return {weights,manifest:{schema:'E2PC.BANK.v1',baseDigest:E2A.baseDigest,revision:'e2pc-synthetic-v1',
    status:'admitted',transport:'local',bundleHashes:hashes,combinedDigest:digest(hashes)}};
}
export function verifyPrecisionBank(bank) {
  if(!bank||!Array.isArray(bank.weights)||bank.weights.length!==6||!bank.manifest||
    bank.manifest.schema!=='E2PC.BANK.v1'||bank.manifest.baseDigest!==E2A.baseDigest||
    bank.manifest.revision!=='e2pc-synthetic-v1'||bank.manifest.status!=='admitted'||
    bank.manifest.transport!=='local'||!Array.isArray(bank.manifest.bundleHashes)||
    bank.manifest.bundleHashes.length!==6) throw new TypeError('Untrusted precision bank manifest');
  for(let i=0;i<6;i++) {
    const w=bank.weights[i];
    if(!w||Object.keys(w).sort().join(',')!=='f32,int4,int8') throw new TypeError('Missing precision level');
    for(const level of E2PC.precisionLevels) {
      decodeTensor(w[level]);
      if(level!=='f32' && (!Array.isArray(w[level].errorAbs)||w[level].errorAbs.length!==8||
        !w[level].errorAbs.every(validNumber)||w[level].errorAbs.some(x=>x<0)||
        w[level].boundMetadataBytes!==64)) throw new TypeError('Invalid error bound metadata');
    }
    if(digest(w)!==bank.manifest.bundleHashes[i]) throw new TypeError('Tampered or stale precision bundle');
  }
  if(digest(bank.manifest.bundleHashes)!==bank.manifest.combinedDigest) throw new TypeError('Precision bank digest mismatch');
  return true;
}
function terms(row,selected) {
  return selected.map(s=>{
    const channel=row.channels[s.tooth],f=Array(8).fill(0);
    f[0]=channel.x;f[1]=1;
    if(s.child){const j=Number(s.child.split('.c')[1]);
      if(!Number.isInteger(j)||j<0||j>2) throw new TypeError('Invalid child index');
      f[2+2*j]=basis(channel.x,channel.z)[j];f[3+2*j]=1;
    }
    return {tooth:s.tooth,features:f};
  });
}
function scoreAt(parts,bank,level){
  let score=0,bound=0,bytes=0;const contributions=[];
  for(const {tooth,features} of parts){
    const packed=bank.weights[tooth][level],values=decodeTensor(packed);
    const v=dot(values,features);
    score+=v;contributions.push(v);bytes+=packed.payloadBytes;
    // Offline-derived maximum coefficient errors are an uncertainty certificate,
    // not an additional inference pass through high-precision expert weights.
    if(level!=='f32') {
      bound+=packed.errorAbs.reduce((s,e,i)=>s+e*Math.abs(features[i]),0);
    }
  }
  return {score,bound,bytes,contributions};
}
function conflictProxy(contributions) {
  // Two opposing local signs can be normal additive evidence, not a logical contradiction.
  return contributions.length>=2&&contributions.some(x=>x>0)&&contributions.some(x=>x<0);
}
/** Runs only the chosen E2-A learned route. The caller must not give this function teacher labels. */
export function inferPrecision(row,model,bank,{mode='hybrid',memoryBudgetUnits=8,computeBudgetUnits=80}={}) {
  if(!E2PC.policyModes.includes(mode)) throw new TypeError('Invalid precision policy');
  verifyPrecisionBank(bank);
  const route=planE2A(row,model,manifestsE2A(model),{memoryBudgetUnits,computeBudgetUnits});
  if(route.decision!=='ROUTE') return {decision:'REFUSE',reason:route.reason,selected:[],score:null};
  const parts=terms(row,route.selected);
  let step=mode==='f32'?'f32':mode==='int8'?'int8':'int4';
  let result=scoreAt(parts,bank,step),bytes=result.bytes,passes=1;
  const conflict=conflictProxy(result.contributions);
  let certified=step==='f32'||Math.abs(result.score)>result.bound;
  if((mode==='bound'||mode==='hybrid')&&!certified ||
     (mode==='conflict'||mode==='hybrid')&&conflict && step==='int4') {
    step='int8';result=scoreAt(parts,bank,step);bytes+=result.bytes;passes++;
    certified=Math.abs(result.score)>result.bound;
  }
  if((mode==='bound'||mode==='hybrid')&&!certified&&step!=='f32') {
    step='f32';result=scoreAt(parts,bank,step);bytes+=result.bytes;passes++;
    certified=true;
  }
  return {decision:'ROUTE',reason:route.reason,score:result.score,selected:route.selected.map(s=>s.id),
    precision:step,passes,payloadReadBytes:bytes,selectedBundles:parts.length,
    conflictProxy:conflict,signCertifiedVsF32:certified,uncertaintyBound:result.bound};
}
const MODES=E2PC.policyModes;
function summarize(values) {const n=values.length;return n?Math.round(values.reduce((a,b)=>a+b,0)*1e6/n)/1e6:null;}
/** Only the reporting layer reads teacher labels/score; the inference layer cannot. */
export function experimentE2PC({holdout=dataset('holdout')}={}) {
  const train=dataset('train'),model=trainE2A(train),bank=createPrecisionBank(model);
  verifyPrecisionBank(bank);
  if(!Array.isArray(holdout)||holdout.length===0) throw new TypeError('Missing holdout');
  const results=Object.fromEntries(MODES.map(mode=>[mode,{correct:0,total:0,refusals:0,
    mismatchesVsF32:0,conflictSignals:0,escalations:0,fullPrecisionEscalations:0,
    precisionCounts:{int4:0,int8:0,f32:0},payloadReadBytes:[],absoluteScoreError:[],trace:[]}]));
  for(const row of holdout) {
    const outputs=Object.fromEntries(MODES.map(mode=>[mode,inferPrecision(row,model,bank,{mode})]));
    const ref=outputs.f32;
    for(const mode of MODES) {
      const r=outputs[mode],s=results[mode];
      if(r.decision!=='ROUTE'){s.refusals++;continue;}
      s.total++;s.correct+=Number((r.score>=0)===Boolean(row.label));
      s.mismatchesVsF32+=Number((r.score>=0)!==(ref.score>=0));
      s.conflictSignals+=Number(r.conflictProxy);
      s.escalations+=Number(r.passes>1);
      s.fullPrecisionEscalations+=Number(r.passes>1&&r.precision==='f32');
      s.precisionCounts[r.precision]++;
      s.payloadReadBytes.push(r.payloadReadBytes);
      s.absoluteScoreError.push(Math.abs(r.score-ref.score));
      if(s.trace.length<6) s.trace.push({id:row.id,selected:r.selected,precision:r.precision,
        conflictProxy:r.conflictProxy,certified:r.signCertifiedVsF32,passes:r.passes});
    }
  }
  const observations=Object.fromEntries(MODES.map(mode=>{
    const r=results[mode];return [mode,{correct:r.correct,total:r.total,refusals:r.refusals,
      accuracy:r.total?r.correct/r.total:null,mismatchesVsF32:r.mismatchesVsF32,
      conflictSignals:r.conflictSignals,escalations:r.escalations,
      fullPrecisionEscalations:r.fullPrecisionEscalations,precisionCounts:r.precisionCounts,
      meanSelectedPayloadReadBytes:summarize(r.payloadReadBytes),meanAbsoluteScoreDeltaVsF32:summarize(r.absoluteScoreError),
      sampleTrace:r.trace}];
  }));
  const unsigned={schema:E2PC.schema,origin:'OBSERVED_LOCAL_UNVERIFIED',authority:'NONE',
    experiment:'REAL_NUMERIC_QUANTIZATION_OF_E2A_SYNTHETIC_LEARNED_WEIGHTS',
    trainingSupervision:'PRIVILEGED_TEACHER_FACTOR_TARGETS',realLLM:false,
    trainDigest:digest(train),holdoutDigest:digest(holdout),modelDigest:digest(model),
    bankDigest:bank.manifest.combinedDigest,config:E2PC,observations,
    limitations:[
      'Precision estimates concern packed selected eight-weight payloads only, not total live RAM/VRAM or latency; 64-byte per bundle/level bound metadata is excluded.',
      'All precision versions and reference FP32 weights are kept resident for this laboratory; no real loading or offloading.',
      'E2-A trained experts are tiny and use privileged synthetic factor targets; this is not a robust intelligence benchmark.',
      'Conflict is an opposing-sign heuristic on two local contributions, not a proven contradiction or failure.',
      'Certified sign agrees with FP32 within conservative quantization bound, not necessarily with teacher truth.',
      'No GPU, neural checkpoints, multi-node execution, online learning, independent evidence, or NBG closure claim.'
    ]};
  return {...unsigned,receiptSha256:digest(unsigned)};
}
export function verifyE2PCReceipt(receipt){
  if(!receipt||typeof receipt!=='object') return false;
  const {receiptSha256,...unsigned}=receipt;
  if(typeof receiptSha256!=='string'||receiptSha256!==digest(unsigned))return false;
  return digest(receipt)===digest(experimentE2PC());
}
