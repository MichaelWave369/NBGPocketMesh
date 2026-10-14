import test from 'node:test';
import assert from 'node:assert/strict';
import { dataset, learn, experiment, TRAIN_AXIS, TEST_AXIS } from '../src/learned-teeth.mjs';
import { route } from '../src/router.mjs';

test('frozen train and held-out axes are disjoint',()=>{
  assert.deepEqual(TRAIN_AXIS.filter(x=>TEST_AXIS.includes(x)),[]);
  const train=dataset('train'), holdout=dataset('holdout');
  assert.equal(train.length,72);
  assert.equal(holdout.length,72);
  assert.equal(new Set(train.map(r=>r.id)).size,72);
  assert.equal(new Set(holdout.map(r=>r.id)).size,72);
  assert.ok(train.every(r=>!TEST_AXIS.includes(r.x) && !TEST_AXIS.includes(r.y)));
  assert.ok(holdout.every(r=>!TRAIN_AXIS.includes(r.x) && !TRAIN_AXIS.includes(r.y)));
});

test('actual numeric weights are learned and specialist deltas differ',()=>{
  const weights=learn();
  assert.equal(weights.weightCount,9);
  assert.ok(weights.base.every(Number.isFinite));
  assert.ok(weights.teeth['x-sign'].every(Number.isFinite));
  assert.ok(weights.teeth['y-sign'].every(Number.isFinite));
  assert.notDeepEqual(weights.teeth['x-sign'],weights.teeth['y-sign']);
  assert.ok(weights.teeth['x-sign'].some(w=>Math.abs(w)>0.001));
});

test('reproducible experiment with complete, labelled numeric receipts',()=>{
  const first=experiment(),second=experiment();
  assert.deepEqual(first,second);
  assert.equal(first.schema,'NBGPocketMesh.E1A.v1');
  assert.equal(first.origin,'SIMULATED');
  assert.equal(first.authority,'NONE');
  assert.equal(first.realLLM,false);
  assert.equal(first.holdoutRows,72);
  assert.equal(first.routingRefusals,0);
  assert.match(first.receiptSha256,/^[a-f0-9]{64}$/);
  assert.match(first.learnedWeightSha256,/^[a-f0-9]{64}$/);
  for(const m of Object.values(first.observations)){
    assert.equal(m.total,72);
    assert.equal(m.accuracy,m.correct/72);
  }
});

test('routed synthetic classification is better than pooled baseline on this frozen fixture',()=>{
  const r=experiment();
  assert.ok(r.observations.routed.correct >= r.observations.base.correct);
  assert.ok(r.observations.routed.correct >= r.observations.swapped.correct);
  assert.ok(r.observations.routed.accuracy > 0.9);
});

test('E0 router refuses false claims of independent lineages',()=>{
  const duplicate=(id,capability)=>({
    id,revision:'fixture',capabilities:[capability],inputs:['text'],outputs:['text'],
    transport:'local',status:'admitted',validThroughEpoch:1,estimatedLatencyMs:1,
    workingSetMiB:1,lineage:'shared-fixture-training',resident:true
  });
  const task={id:'test',capability:'x-sign',input:'text',output:'text',
    privacy:'private',remoteConsent:false,requiredLineages:2,
    latencyBudgetMs:10,memoryBudgetMiB:8};
  assert.equal(route(task,[duplicate('a','x-sign'),duplicate('b','x-sign')]).decision,'REFUSE');
});
