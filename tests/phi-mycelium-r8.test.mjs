import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from '../src/phi-mycelium-r5.mjs';
import {orchestrate,verifyOrchestration} from '../src/phi-mycelium-r8.mjs';
const fixture={growth:{requests:[1,1,2,3,5],maxEdges:4},failed:['0:4']};
const program='PROPAGATE 4\nOBSERVE id\nPROPAGATE 0\nRETURN';
function input(){
  const s=prepare(fixture);
  const grant={snapshot:s.snapshot,maxSteps:9,maxHops:9,nodes:s.pockets.map(p=>p.id),links:s.edges.map(e=>e.id),observations:[{id:4,fields:['id']}]};
  return {fixture,expectedSnapshot:s.snapshot,budget:{steps:8,hops:18},grants:['a','b','c'].map(id=>({id,grant:structuredClone(grant)})),events:[]};
}
const submit=id=>({op:'SUBMIT',id,program}),tick={op:'TICK'};
test('FIFO admission, reservation, cancellation and actual charge',()=>{
  const i=input();
  i.events=[submit('a'),submit('b'),submit('c'),{op:'CANCEL',id:'a'},submit('c'),tick,tick,tick];
  const r=orchestrate(i);
  assert.deepEqual(r.receipts.map(x=>x.outcome),['ADMITTED','ADMITTED','INSUFFICIENT_BUDGET','CANCELLED','ADMITTED','COMPLETED','COMPLETED','IDLE']);
  assert.deepEqual(r.tasks.map(t=>[t.id,t.status]),[['a','CANCELLED'],['b','COMPLETED'],['c','COMPLETED']]);
  assert.equal(r.spent.steps,8);assert.equal(r.reserved.steps,0);
  assert.equal(r.spent.hops,r.tasks[1].receipt.hops+r.tasks[2].receipt.hops);
  assert.ok(verifyOrchestration(i,r));
  assert.equal(verifyOrchestration(i,{...r,spent:{steps:0,hops:0}}),false);
  assert.deepEqual(r,orchestrate(i));
});
test('resource conservation on every event and pending reservations retained',()=>{
  const i=input();i.events=[submit('a'),tick,submit('b')];
  const r=orchestrate(i);
  assert.equal(r.tasks[1].status,'QUEUED');
  assert.deepEqual(r.reserved,{steps:4,hops:9});
  for(const e of r.receipts)for(const key of ['steps','hops']){
    assert.equal(e.spent[key]+e.reserved[key]+e.available[key],i.budget[key]);
    assert.ok(e.spent[key]>=0&&e.reserved[key]>=0&&e.available[key]>=0);
  }
});
test('refusal charges reservation without fake execution receipt',()=>{
  const i=input();i.grants[0].grant.links=[];
  i.events=[submit('a'),tick,submit('a'),{op:'CANCEL',id:'a'}];
  const r=orchestrate(i);
  assert.deepEqual(r.receipts.map(x=>x.outcome),['ADMITTED','REFUSED','DUPLICATE','NOT_QUEUED']);
  assert.deepEqual(r.spent,{steps:4,hops:9});
  assert.equal(r.tasks[0].receipt,null);
});
test('missing grants and malformed programs do not reserve',()=>{
  const i=input();
  i.events=[submit('unknown'),{op:'SUBMIT',id:'a',program:'EXECUTE shell\nRETURN'},tick];
  const r=orchestrate(i);
  assert.deepEqual(r.receipts.map(x=>x.outcome),['DENIED','INVALID_PROGRAM','IDLE']);
  assert.deepEqual(r.available,i.budget);assert.deepEqual(r.tasks,[]);
});
test('invalid outer contracts fail closed',()=>{
  for(const change of [i=>i.expectedSnapshot='stale',i=>i.budget.steps=-1,i=>i.grants.push(i.grants[0]),i=>i.grants[0].grant.snapshot='stale',i=>i.events=[{op:'TICK',extra:true}],i=>i.events=Array(37).fill(tick)]){
    const i=input();change(i);assert.throws(()=>orchestrate(i),/ORCHESTRATION_REFUSE/);
  }
});
test('caller state is unchanged and zero budgets cannot admit',()=>{
  const i=input();i.budget={steps:0,hops:0};i.events=[submit('a'),tick];
  const before=structuredClone(i),r=orchestrate(i);
  assert.deepEqual(i,before);assert.deepEqual(r.available,i.budget);
  assert.equal(r.receipts[0].outcome,'INSUFFICIENT_BUDGET');
});
