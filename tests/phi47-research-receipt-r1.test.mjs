import test from 'node:test';
import assert from 'node:assert/strict';
import {sealResearchData,inspectResearchReceipt} from '../src/phi47-research-receipt-r1.mjs';
const data={schema:'phi47-synthetic-observation-v1',origin:'SIMULATED',authority:'NONE',
  privacy:'public-synthetic',source:'NestedBubbleGear',revision:'unverified',
  nodes:47,degree:8,metrics:{observationEntropyBits:0.5,conservationError:0}};
test('receipt is deterministic, digest bound, always nonexecuting',()=>{
  const a=sealResearchData(data),b=sealResearchData(data);
  assert.deepEqual(a,b);
  const r=inspectResearchReceipt(a);
  assert.equal(r.action,'ANALYZE_ONLY');
  assert.equal(r.canExecute,false);
  assert.equal(r.canAuthorize,false);
  assert.equal(r.verifiedProvenance,false);
});
test('tampering with a numerical result invalidates digest',()=>{
  const forged=structuredClone(sealResearchData(data));
  forged.data.metrics.observationEntropyBits=1.0;
  assert.throws(()=>inspectResearchReceipt(forged),/integrity/);
});
test('fail closed on authority, privacy, source and injected payloads',()=>{
  for(const patch of [{authority:'PRODUCTION'},{privacy:'private'},{source:'unknown'},{rawPrompt:'sensitive'},
    {nodes:48},{degree:7}]){
    assert.throws(()=>sealResearchData({...data,...patch}),/Unknown|Untrusted/);
  }
  assert.throws(()=>sealResearchData({...data,metrics:{...data.metrics,canRoute:true}}),/Unknown/);
  assert.throws(()=>sealResearchData({...data,metrics:{...data.metrics,observationEntropyBits:Infinity}}),/Untrusted/);
});
test('a freshly recomputed public hash still cannot establish provenance or authority',()=>{
  const fabricated=sealResearchData({...data,source:'Altermath',revision:'unverified'});
  const r=inspectResearchReceipt(fabricated);
  assert.equal(r.verifiedProvenance,false);
  assert.equal(r.canAuthorize,false);
});
