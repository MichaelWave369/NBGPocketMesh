import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {prepare,parseCirculation,runCirculation,verifyCirculation} from '../src/phi-mycelium-r5.mjs';

const fixture={growth:{requests:[1,1,2,3,5],maxEdges:4},failed:['0:4']};
function input(program='PROPAGATE 4\nOBSERVE id\nPROPAGATE 0\nOBSERVE degree\nRETURN'){
  const s=prepare(fixture);
  return {fixture,program,expectedSnapshot:s.snapshot,grant:{snapshot:s.snapshot,maxSteps:9,maxHops:9,nodes:s.pockets.map(p=>p.id),links:s.edges.map(e=>e.id),observations:[{id:4,fields:['id']},{id:0,fields:['degree']}]}};
}
test('bounded cross-scale circulation over repaired graph and replay',()=>{
  const i=input(),r=runCirculation(i);
  assert.equal(r.steps,5);assert.equal(r.receipts.at(-1).to,0);
  assert.equal(r.observations[0].value,4);
  assert.ok(r.hops>=4&&r.hops<=9);
  const s=prepare(fixture);
  assert.equal(r.stateChecksum,s.stateChecksum);
  assert.equal(r.snapshot,s.snapshot);
  assert.deepEqual(r,runCirculation(i));
  assert.ok(verifyCirculation(i,r));
  assert.equal(verifyCirculation(i,{...r,hops:0}),false);
  for(const receipt of r.receipts)if(receipt.detail?.path){
    const p=receipt.detail.path;
    for(let j=1;j<p.length;j++)assert.ok(i.grant.links.includes([p[j-1],p[j]].sort((a,b)=>a-b).join(':')));
  }
});
test('stale, over-budget, ungranted and unbalanced operations refuse',()=>{
  for(const change of [
    i=>i.expectedSnapshot='stale',
    i=>i.grant.snapshot='stale',
    i=>i.grant.maxSteps=1,
    i=>i.grant.maxHops=1,
    i=>i.grant.nodes=[0],
    i=>i.grant.links=[],
    i=>i.grant.observations=[],
    i=>i.program='PROPAGATE 4\nRETURN',
    i=>i.program='MOVE 4\nRETURN',
    i=>i.program='OBSERVE edit-count\nRETURN'
  ]){
    const i=input();change(i);assert.throws(()=>runCirculation(i),/MYCELIUM_REFUSE/);
  }
});
test('strict language and fixture limits',()=>{
  for(const p of ['EXECUTE shell\nRETURN','RETURN\nRETURN','MOVE 01\nRETURN','OBSERVE id extra\nRETURN','OBSERVE id','MOVE 1.0\nRETURN',Array(65).fill('OBSERVE id').join('\n')+'\nRETURN'])assert.throws(()=>parseCirculation(p),/MYCELIUM_REFUSE/);
  assert.throws(()=>prepare({growth:{maxNodes:90}}),/MYCELIUM_REFUSE/);
  assert.throws(()=>prepare({growth:{requests:[0]}}),/MYCELIUM_REFUSE/);
});
test('local observation projection contains only granted scalar',()=>{
  const r=runCirculation(input());
  for(const o of r.observations){
    assert.deepEqual(Object.keys(o.abl.pockets),['root']);
    assert.deepEqual(o.abl.pockets.root.fields,{[o.field]:o.value});
    assert.deepEqual(o.abl.grants.root.observe,[o.field]);
    assert.deepEqual(o.abl.pockets.root.links,[]);
  }
});
test('pinned actual Altermath ABL observation equivalence',{skip:!process.env.MYCELIUM_ALTERMATH_PATH},async()=>{
  const {runABL,verifyABLReceipts}=await import(pathToFileURL(resolve(process.env.MYCELIUM_ALTERMATH_PATH,'src/abl-belt.mjs')).href);
  for(const o of runCirculation(input()).observations){
    const actual=runABL(o.abl);
    assert.equal(actual.result,o.value);
    assert.equal(actual.resultType,'number');
    assert.ok(verifyABLReceipts(actual.receipts));
    assert.throws(()=>runABL({...o.abl,grants:{root:{observe:[]}}}),/ABL_REFUSE/);
  }
});
