import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYHOLE_CASES, inspectCase, experiment, precisionCheck } from '../src/pattern-keyhole.js';

test('site E2-K inspector uses the same portable execution as CLI',()=>{
  const e=experiment();
  assert.equal(e.fixtureCount,15);
  for(const c of KEYHOLE_CASES){
    assert.equal(inspectCase(c,6).decision,c.expected);
    assert.equal(inspectCase(c,1).decision,'UNRESOLVED');
  }
});
test('digit coincidence changes when non-decimal unit conversion is used',()=>{
  const c=KEYHOLE_CASES.find(c=>c.id==='latitude-light');
  const d=inspectCase(c,6);
  assert.equal(d.observations.before,true);
  assert.equal(d.observations.after,false);
  assert.equal(d.decision,'SURFACE_ONLY');
});
test('independent numerical near-boundary control escalates',()=>{
  assert.equal(precisionCheck(-0.021).escalated,true);
  assert.equal(precisionCheck(-0.021).boundedSign,-1);
  assert.equal(precisionCheck(-0.45).escalated,false);
});
