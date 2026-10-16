import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioAt,routeScenario,RESULTS,accuracy } from '../src/sim.js';

test('frozen public synthetic fixture observations are repeatable',()=>{
  assert.deepEqual(scenarioAt(0),scenarioAt(0));
  assert.deepEqual(scenarioAt(383),scenarioAt(383));
  assert.notDeepEqual(scenarioAt(0),scenarioAt(1));
  assert.throws(()=>scenarioAt(-1),TypeError);
  assert.throws(()=>scenarioAt(384),TypeError);
});
test('sparse simulator never selects more than two parents or depth beyond two',()=>{
  for(let i=0;i<384;i++){
    const out=routeScenario(scenarioAt(i),{});
    assert.ok(out.selected.length<=2);
    assert.ok(out.selected.every(x=>!x.child||/^P[0-5]\.C[0-2]$/.test(x.child)));
  }
});
test('budget cap refuses rather than silently overcommitting',()=>{
  const out=routeScenario(scenarioAt(0),{memoryBudget:0,threshold:0});
  assert.equal(out.decision,'REFUSE');
  assert.deepEqual(out.selected,[]);
  assert.ok(out.memoryUnits>0);
});
test('micro and macro controls change activation limits',()=>{
  const s=scenarioAt(0);
  const flat=routeScenario(s,{allowChildren:false});
  assert.ok(flat.selected.every(t=>!t.child));
  const single=routeScenario(s,{allowMacro:false});
  assert.ok(single.selected.length<=1);
});
test('recorded evidence is complete and learned router does not exceed fixed-rule control',()=>{
  assert.equal(RESULTS.length,7);
  assert.equal(RESULTS.find(x=>x.id==='hier').correct,384);
  assert.equal(RESULTS.find(x=>x.id==='fixed').correct,384);
  assert.equal(accuracy(RESULTS.find(x=>x.id==='flat')),'90.63');
});
