import test from 'node:test';
import assert from 'node:assert/strict';
import {trial,cohort,POLICIES} from '../src/phi-mycelium-r7.mjs';

test('paired local observations and permitted edges with bounded moves',()=>{
  const t=trial({damage:true});
  for(const r of t.results)for(const [phase,edges,hidden] of [[r.training,t.trainingEdges,t.trainingHidden],[r.testing,t.evaluationEdges,t.evaluationHidden]]){
    const ids=new Set(edges.map(e=>e.id)),seen=new Set();
    let score=0;
    assert.equal(phase.trace[0].frame.id,0);
    assert.ok(phase.moves<=t.budget);
    assert.equal(phase.observations,phase.moves+1);
    for(let i=0;i<phase.trace.length;i++){
      const {frame,first,step}=phase.trace[i];
      assert.equal(step,i);assert.deepEqual(Object.keys(frame),['id','signal','neighbors']);
      assert.equal(frame.signal,hidden[frame.id]);
      assert.equal(first,!seen.has(frame.id));
      if(first)score+=frame.signal;
      seen.add(frame.id);
      const expected=edges.filter(e=>e.u===frame.id||e.v===frame.id).map(e=>e.u===frame.id?e.v:e.u).sort((a,b)=>a-b);
      assert.deepEqual(frame.neighbors,expected);
      if(i)assert.ok(ids.has([phase.trace[i-1].frame.id,frame.id].sort((a,b)=>a-b).join(':')));
    }
    assert.equal(score,phase.score);assert.equal(seen.size,phase.unique);
    assert.ok(r.checkpointBytes>0);assert.match(r.finalChecksum,/^[a-f0-9]{64}$/);
  }
});
test('training is matched and retained policy uses only locally learned values',()=>{
  const t=trial(),novel=t.results.find(r=>r.policy==='novelty'),retained=t.results.find(r=>r.policy==='retained');
  // Training can differ due to within-episode remembered signals.
  for(const r of t.results){
    const seen=new Map(r.training.trace.map(x=>[x.frame.id,x.frame.signal+1]));
    assert.deepEqual(r.training.observed,Array.from({length:34},(_,i)=>seen.get(i)??0));
  }
  assert.equal(novel.testing.trace[0].frame.id,retained.testing.trace[0].frame.id);
  assert.deepEqual(t,trial());
});
test('drift complements hidden signals and does not alter training',()=>{
  const a=trial(),b=trial({drift:true});
  assert.deepEqual(b.evaluationHidden,a.trainingHidden.map(v=>1-v));
  for(let i=0;i<POLICIES.length;i++)assert.deepEqual(a.results[i].training,b.results[i].training);
  assert.deepEqual(a.trainingEdges,b.trainingEdges);
});
test('cohort paired scenarios and costs are explicit',()=>{
  const c=cohort({seeds:[369,8288],budget:9});
  assert.equal(c.trials.length,8);assert.equal(c.summary.length,12);
  for(const row of c.summary){
    assert.equal(row.trials,2);
    assert.ok(row.score<=row.unique&&row.moves<=18&&row.trainingMoves<=18);
    assert.equal(row.observations,row.moves+2);
  }
  assert.deepEqual(c,cohort({seeds:[369,8288],budget:9}));
});
test('invalid budgets and seeds refuse',()=>{
  for(const opts of [{seed:0},{budget:0},{budget:91},{drift:'yes'},{damage:1}])assert.throws(()=>trial(opts),RangeError);
  for(const opts of [{seeds:[]},{seeds:[1,1]},{seeds:[0]}])assert.throws(()=>cohort(opts),RangeError);
});
