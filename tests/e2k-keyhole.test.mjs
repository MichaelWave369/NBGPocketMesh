import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYHOLE_CASES, CASE_FAMILIES, inspectCase, surfaceGuess, structuralProbe,
  experiment, precisionCheck, PRECISION_INPUTS } from '../site/src/pattern-keyhole.js';

test('frozen fixture IDs and all transformation families are present',()=>{
  assert.equal(KEYHOLE_CASES.length,15);
  assert.equal(new Set(KEYHOLE_CASES.map(c=>c.id)).size,15);
  assert.deepEqual(new Set(KEYHOLE_CASES.map(c=>c.family)),new Set(CASE_FAMILIES));
  assert.equal(KEYHOLE_CASES.filter(c=>c.family==='ratio').length,6);
  assert.equal(KEYHOLE_CASES.filter(c=>c.family==='rotation').length,6);
  assert.equal(KEYHOLE_CASES.filter(c=>c.family==='digits').length,3);
});

test('K0 cannot promote visually seductive digits to a verified claim',()=>{
  const c=KEYHOLE_CASES.find(c=>c.id==='latitude-light');
  assert.equal(surfaceGuess(c),'INVARIANT');
  assert.equal(inspectCase(c,1).decision,'UNRESOLVED');
  assert.equal(inspectCase(c,6).decision,'SURFACE_ONLY');
  assert.equal(structuralProbe(c).after,false);
});

test('unit changes preserve dimensionless pyramid-style ratios',()=>{
  for(const c of KEYHOLE_CASES.filter(c=>c.family==='ratio')) {
    const result=inspectCase(c,6);
    assert.equal(result.decision,'INVARIANT');
    assert.ok(Math.abs(result.observations.before-22/7)<1e-12);
    assert.ok(Math.abs(result.observations.after-22/7)<1e-12);
  }
});

test('rotation preserves lengths but not directional components',()=>{
  for(const c of KEYHOLE_CASES.filter(c=>c.family==='rotation')) {
    assert.equal(inspectCase(c,6).decision,c.expected);
  }
});

test('deliberately broken geometry and vector controls are not rubber-stamped',()=>{
  const ratio=KEYHOLE_CASES.find(c=>c.family==='ratio');
  const changed={...ratio,endBase:ratio.base*ratio.factor+4};
  assert.equal(structuralProbe(changed).decision,'CHANGED');
  const rotation=KEYHOLE_CASES.find(c=>c.id==='norm-90');
  assert.equal(structuralProbe({...rotation,endVector:[-4,4]}).decision,'FRAME_DEPENDENT');
});

test('budgets are explicit and inadequate probe budget stays unresolved',()=>{
  const sample=KEYHOLE_CASES[0];
  assert.equal(inspectCase(sample,1).depth,'K0');
  assert.equal(inspectCase(sample,3).depth,'K1');
  assert.equal(inspectCase(sample,6).depth,'K2');
  for(const v of [0,2,4,5,7,999]) assert.throws(()=>inspectCase(sample,v),RangeError);
  assert.throws(()=>inspectCase({id:'fake',family:'ratio',expected:'INVARIANT'},6),TypeError);
  assert.throws(()=>inspectCase({...sample,expected:'SURFACE_ONLY'},6),TypeError);
});

test('precision boundary escalates only uncertifiable signs',()=>{
  let errors=0, escalations=0;
  for(const value of PRECISION_INPUTS) {
    const p=precisionCheck(value);
    if(p.referenceSign!==p.lowPrecisionSign)errors++;
    if(p.escalated)escalations++;
    assert.equal(p.boundedSign,p.referenceSign);
    if(!p.escalated)assert.ok(Math.abs(p.rounded)>p.bound);
  }
  assert.ok(errors>0);
  assert.ok(escalations>=errors);
  assert.throws(()=>precisionCheck(NaN));
  assert.throws(()=>precisionCheck(1,-1));
});

test('all fixed algebraic controls have explicit baselines and stable outputs',()=>{
  const a=experiment(),b=experiment();
  assert.deepEqual(a,b);
  assert.equal(a.schema,'NBGPocketMesh.E2K.v1');
  assert.equal(a.origin,'SIMULATED');
  assert.equal(a.authority,'NONE');
  assert.equal(a.policies.typed.correct,a.fixtureCount);
  assert.equal(a.policies.challenged.correct,a.fixtureCount);
  assert.ok(a.policies.naive.correct < a.fixtureCount);
  assert.equal(a.quantization.boundedDisagreements,0);
});

test('K2 actually executes a second independently parameterized transform',()=>{
  for(const c of KEYHOLE_CASES){
    const k1=inspectCase(c,3),k2=inspectCase(c,6);
    assert.equal(k1.challenge,undefined);
    assert.ok(k2.challenge);
    assert.equal(k2.challenge.pass,true,c.id);
    assert.equal(k2.decision,c.expected);
    assert.ok(['SECOND_SCALE','INDEPENDENT_FRAME','ALTERNATE_UNITS'].includes(k2.challenge.kind));
  }
});
