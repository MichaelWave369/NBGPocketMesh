import test from 'node:test';
import assert from 'node:assert/strict';
import { route, verifyReceipt } from '../src/router.mjs';
import { TASK, MANIFESTS } from '../src/fixtures.mjs';
const withTask = (diff={}) => ({...TASK,...diff});
const edit = (id,diff) => MANIFESTS.map(m=>m.id===id?{...m,...diff}:m);

test('stable deterministic receipt, no prompt contents',()=>{
  const a=route(TASK,MANIFESTS);
  assert.equal(a.decision,'ROUTE');
  assert.deepEqual(a.selected.nodes,['tiny-local']);
  assert.equal(a.schema,'NBGPocketMesh.E0.v1');
  assert.equal(a.origin,'SIMULATED');
  assert.equal(a.authority,'NONE');
  assert.match(a.receiptSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(route(TASK,[...MANIFESTS].reverse()),a);
  assert.equal(verifyReceipt(a,TASK,MANIFESTS),true);
});

test('missing capability refuses',()=>{
  const receipt=route(withTask({capability:'nonexistent'}),MANIFESTS);
  assert.equal(receipt.decision,'REFUSE');
  assert.equal(receipt.reason,'NO_ELIGIBLE_NODE');
});

test('remote denied for private and without explicit consent',()=>{
  const onlyRemote=MANIFESTS.filter(m=>m.transport==='remote');
  assert.equal(route(TASK,onlyRemote).decision,'REFUSE');
  assert.equal(route(withTask({privacy:'public'}),onlyRemote).decision,'REFUSE');
  assert.deepEqual(route(withTask({privacy:'public',remoteConsent:true}),onlyRemote).selected.nodes,['cloud-summarizer']);
});

test('incompatible modality cannot mesh',()=>{
  assert.equal(route(withTask({input:'image',capability:'summarize'}),MANIFESTS).decision,'REFUSE');
});

test('stale, revoked, malformed manifests fail closed',()=>{
  for (const patch of [{validThroughEpoch:0},{status:'revoked'},{workingSetMiB:-1},{unexpected:true}]) {
    const result=route(TASK,edit('tiny-local',patch));
    assert.equal(result.decision,'REFUSE');
    assert.equal(result.excluded.find(x=>x.id==='tiny-local').reason.includes('MANIFEST') || result.excluded.find(x=>x.id==='tiny-local').reason==='NOT_ADMITTED',true);
  }
});

test('insufficient memory and time budget refuse',()=>{
  assert.equal(route(withTask({latencyBudgetMs:10}),MANIFESTS).decision,'REFUSE');
  assert.equal(route(withTask({memoryBudgetMiB:1}),edit('tiny-local',{resident:false})).decision,'REFUSE');
});

test('two independent evidence lineages required, duplicates do not count',()=>{
  const copy={...MANIFESTS[0],id:'tiny-copy',lineage:'fixture-family-a'};
  assert.equal(route(withTask({requiredLineages:2}),[MANIFESTS[0],copy]).decision,'REFUSE');
  const independent={...copy,id:'independent',lineage:'fixture-family-z',estimatedLatencyMs:40};
  const result=route(withTask({requiredLineages:2}),[MANIFESTS[0],independent]);
  assert.equal(result.decision,'ROUTE');
  assert.deepEqual(result.selected.lineages,['fixture-family-z','fixture-family-a']);
});

test('combined two-lineage budget checked before decision',()=>{
  const independent={...MANIFESTS[0],id:'second',lineage:'other',estimatedLatencyMs:80,resident:false,workingSetMiB:500};
  assert.equal(route(withTask({requiredLineages:2,memoryBudgetMiB:450}),[MANIFESTS[0],independent]).decision,'REFUSE');
});

test('receipt rejects tampering and changed manifests',()=>{
  const receipt=route(TASK,MANIFESTS);
  assert.equal(verifyReceipt({...receipt,decision:'ROUTE',selected:{nodes:['forged']}},TASK,MANIFESTS),false);
  assert.equal(verifyReceipt(receipt,TASK,edit('tiny-local',{estimatedLatencyMs:31})),false);
});

test('reject ambiguous inputs before routing',()=>{
  assert.throws(()=>route({...TASK,remoteConsent:'yes'},MANIFESTS),TypeError);
  assert.throws(()=>route({...TASK,secret:'unapproved'},MANIFESTS),TypeError);
  assert.throws(()=>route(TASK,[MANIFESTS[0],MANIFESTS[0]]),TypeError);
});
