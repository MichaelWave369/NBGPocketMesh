import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,trainE2A,digest} from '../src/e2a-gears.mjs';
import {encodeTensor,decodeTensor,createPrecisionBank,verifyPrecisionBank,inferPrecision,experimentE2PC,verifyE2PCReceipt} from '../src/e2pc-precision.mjs';
const model=trainE2A(),bank=createPrecisionBank(model);

test('four-bit weights are actually packed and signed; storage sizes are honest',()=>{
  const values=[1,-.7,.33,-.14,.12,-.9,0,.005];
  const q4=encodeTensor(values,'int4'),q8=encodeTensor(values,'int8'),f32=encodeTensor(values,'f32');
  assert.equal(q4.data.length,4);assert.equal(q4.payloadBytes,8);
  assert.equal(q8.data.length,8);assert.equal(q8.payloadBytes,12);
  assert.equal(f32.data.length,8);assert.equal(f32.payloadBytes,32);
  const back=decodeTensor(q4);assert.equal(back.length,8);assert.ok(back.some(x=>x<0));
  assert.ok(back.some((x,i)=>Math.abs(x-values[i])>.005));
  assert.throws(()=>encodeTensor(values,'int3'),TypeError);
  assert.throws(()=>decodeTensor({...q4,data:[136,255,255,255]}),TypeError);
});
test('bundle hashes bind all six parents and 18 children and fail on corruption',()=>{
  assert.equal(verifyPrecisionBank(bank),true);
  for(const mutation of [b=>{b.weights[0].int4.data[0]^=1;},b=>{b.manifest.status='revoked';},
    b=>{b.manifest.baseDigest='wrong';},b=>{b.weights[0].int4.errorAbs[0]=0;}]) {
    const c=structuredClone(bank);mutation(c);assert.throws(()=>verifyPrecisionBank(c),TypeError);
  }
});
test('inference ignores teacher-only fields and rejects overbudget routes',()=>{
  const row=dataset('holdout')[0];
  const clean={channels:row.channels.map(({x,z,cue,hints})=>({x,z,cue,hints}))};
  assert.deepEqual(inferPrecision(row,model,bank,{mode:'hybrid'}),inferPrecision(clean,model,bank,{mode:'hybrid'}));
  const noBudget=inferPrecision(clean,model,bank,{mode:'bound',memoryBudgetUnits:0});
  assert.equal(noBudget.decision,'REFUSE');assert.equal(noBudget.score,null);
  assert.throws(()=>inferPrecision(clean,model,bank,{mode:'oracle'}),TypeError);
});
test('certified adaptive outputs preserve F32 decisions even near boundaries',()=>{
  let escalations=0;
  for(const row of dataset('holdout')){
    const ref=inferPrecision(row,model,bank,{mode:'f32'});
    const adaptive=inferPrecision(row,model,bank,{mode:'bound'});
    assert.equal(adaptive.decision,'ROUTE');
    assert.equal(adaptive.signCertifiedVsF32,true);
    assert.equal(adaptive.score>=0,ref.score>=0);
    assert.ok(adaptive.passes>=1&&adaptive.passes<=3);
    escalations+=Number(adaptive.passes>1);
  }
  assert.ok(escalations>0);
});
test('conflict heuristic is not treated as proven contradiction or oracle',()=>{
  const r=experimentE2PC();
  assert.ok(r.observations.conflict.conflictSignals>0);
  assert.ok(r.observations.conflict.escalations>0);
  assert.ok(r.observations.conflict.mismatchesVsF32>=0);
  assert.equal(r.observations.bound.mismatchesVsF32,0);
  assert.equal(r.observations.hybrid.mismatchesVsF32,0);
  assert.ok(r.observations.int4.mismatchesVsF32>0);
});
test('the same held-out examples compare all six numerical variants',()=>{
  const r=experimentE2PC();
  assert.equal(r.observations.f32.total,384);
  for(const v of Object.values(r.observations)) assert.equal(v.total,384);
  assert.equal(r.observations.int8.mismatchesVsF32,0);
  assert.ok(r.observations.int4.meanSelectedPayloadReadBytes<r.observations.f32.meanSelectedPayloadReadBytes);
  assert.ok(r.observations.bound.meanSelectedPayloadReadBytes<r.observations.int8.meanSelectedPayloadReadBytes);
  assert.equal(r.origin,'OBSERVED_LOCAL_UNVERIFIED');assert.equal(r.authority,'NONE');
  assert.equal(r.realLLM,false);
});
test('receipt is reproducible, bound to the full report, and detects tampering',()=>{
  const a=experimentE2PC(),b=experimentE2PC();
  assert.deepEqual(a,b);assert.match(a.receiptSha256,/^[a-f0-9]{64}$/);
  assert.equal(verifyE2PCReceipt(a),true);
  const changed=structuredClone(a);changed.observations.int4.correct+=1;
  assert.equal(verifyE2PCReceipt(changed),false);
});
