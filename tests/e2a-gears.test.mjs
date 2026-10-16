import test from 'node:test';
import assert from 'node:assert/strict';
import {
  E2A,VARIANTS,dataset,trainE2A,manifestsE2A,validateManifestsE2A,
  planE2A,experimentE2A,verifyE2AReceipt,digest
} from '../src/e2a-gears.mjs';

const clone=o=>structuredClone(o);
let trained, manifests, train, holdout;
test.before(()=>{
  train=dataset('train');holdout=dataset('holdout');
  trained=trainE2A(train);manifests=manifestsE2A(trained);
});
test('train and holdout are seeded, disjoint, bounded, and include macro task',()=>{
  assert.equal(train.length,960);assert.equal(holdout.length,384);
  assert.equal(new Set([...train,...holdout].map(r=>r.id)).size,1344);
  assert.notEqual(digest(train),digest(holdout));
  assert.ok(holdout.some(r=>r.active.length===2));
  assert.ok(holdout.some(r=>r.active.length===1));
  assert.ok(holdout.some(r=>r.channels.some(c=>c.active && c.mode>=0)));
});
test('genuine learned parent, 3 children per tooth, flat baseline and router',()=>{
  assert.equal(trained.parent.length,6);assert.equal(trained.children.length,6);
  assert.ok(trained.children.every(a=>a.length===3));
  assert.ok(trained.parent.every(w=>w.every(Number.isFinite)&&w[0]>.5));
  assert.ok(trained.children.every(a=>a.every(w=>w.some(x=>Math.abs(x)>.05))));
  assert.ok(trained.parentRouter[0]>0&&trained.childRouter[0]>0);
  assert.equal(validateManifestsE2A(trained,manifests),true);
});
test('router never reads hidden labels, teacher outputs or active IDs',()=>{
  const row=clone(holdout[3]);
  const original=planE2A(row,trained,manifests);
  row.active=[999];row.score=999999;row.label=0;
  row.channels.forEach(c=>{c.active=!c.active;c.mode=999;c.local=99999});
  assert.deepEqual(planE2A(row,trained,manifests),original);
});
test('adaptive topology is bounded to two parents and depth two, with micro expansion',()=>{
  const plans=holdout.map(row=>planE2A(row,trained,manifests));
  assert.ok(plans.every(p=>p.decision==='ROUTE'&&p.selected.length<=E2A.topK));
  assert.ok(plans.some(p=>p.selected.some(s=>s.child!==null)));
  assert.ok(plans.some(p=>p.selected.length===2));
  assert.ok(plans.some(p=>p.selected.every(s=>s.child===null)));
});
test('tampered, stale, revoked and remote modules fail closed',()=>{
  const changes=[
    m=>m.parent[0].weightDigest='0'.repeat(64),
    m=>m.parent[0].status='revoked',
    m=>m.children[0].parentId='p3',
    m=>m.children[0].baseDigest='f'.repeat(64),
    m=>m.parent[1].transport='remote',
    m=>m.parent[0].revision='old',
    m=>m.parent[0].unexpected='x',
    m=>m.children.pop(),
    m=>m.parent[0].id='p1'
  ];
  for(const change of changes) {
    const bad=clone(manifests);change(bad);
    assert.throws(()=>planE2A(holdout[0],trained,bad),TypeError);
  }
});
test('bad input, unauthorized flags and hard resource budgets refuse',()=>{
  assert.throws(()=>planE2A({...holdout[0],channels:[]},trained,manifests),TypeError);
  assert.throws(()=>planE2A(holdout[0],trained,manifests,{secret:true}),TypeError);
  assert.throws(()=>planE2A(holdout[0],trained,manifests,{privacy:'other'}),TypeError);
  assert.equal(planE2A(holdout[0],trained,manifests,{computeBudgetUnits:0}).decision,'REFUSE');
  assert.equal(planE2A(holdout[0],trained,manifests,{memoryBudgetUnits:0}).decision,'REFUSE');
});
test('deterministic receipt captures all required ablations, no timing claims',()=>{
  const a=experimentE2A(),b=experimentE2A();
  assert.deepEqual(a,b);
  assert.equal(a.schema,E2A.schema);assert.equal(a.authority,'NONE');
  assert.equal(a.realLLM,false);
  assert.equal(a.trainingSupervision,'PRIVILEGED_TEACHER_FACTOR_TARGETS');
  assert.deepEqual(Object.keys(a.observations),[...VARIANTS]);
  assert.ok(verifyE2AReceipt(a));
  assert.ok(!verifyE2AReceipt({...a,observations:{...a.observations,core:{correct:900}}}));
  assert.match(a.receiptSha256,/^[0-9a-f]{64}$/);
  for(const name of VARIANTS) {
    assert.equal(a.observations[name].total,384);
    assert.equal(a.observations[name].refusals,0);
    assert.equal(a.timing[name],null);
    assert.equal(a.observations[name].groups.dual.total,128);
  }
  assert.ok(a.observations.hier.meanSelectedParents>1);
  assert.ok(a.observations.hier.meanSelectedChildren>0);
});
