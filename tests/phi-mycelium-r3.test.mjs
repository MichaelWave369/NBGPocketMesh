import test from 'node:test';
import assert from 'node:assert/strict';
import {grow} from '../src/phi-mycelium-r1.mjs';
import {route} from '../src/phi-mycelium-r0.mjs';
import {reconstruct,descriptor} from '../src/phi-mycelium-r2.mjs';
import {regenerate} from '../src/phi-mycelium-r3.mjs';

test('regrafting restores a cut tree without changing pocket content',()=>{
  const growth={requests:[1,1,2,3,5],maxEdges:4};
  const value=(reconstruct(descriptor('r')).cells[0]+1)%97;
  const pocketEdits=[{id:0,edits:[{index:0,value}]}];
  const intact=regenerate({growth,pocketEdits});
  const repaired=regenerate({growth,pocketEdits,failed:['0:4']});
  assert.equal(repaired.connectivity.afterFailure,2);
  assert.equal(repaired.connectivity.final,1);
  assert.equal(repaired.regrafted.length,1);
  assert.deepEqual(repaired.pockets,intact.pockets);
  assert.equal(repaired.stateChecksum,intact.stateChecksum);
  assert.equal(repaired.pockets[4].parent,0);
  assert.ok(!repaired.activeEdges.some(e=>e.id==='0:4'));
  assert.ok(route({nodes:repaired.pockets,edges:repaired.activeEdges},0,4));
  assert.deepEqual(repaired,regenerate({growth,pocketEdits,failed:['0:4']}));
});
test('prune redundant lateral links but protect parent links',()=>{
  const growth={requests:[1,1,2,3,5],maxEdges:10};
  const r=regenerate({growth,prune:['1:2','0:1']});
  assert.deepEqual(r.pruned,['1:2']);
  assert.deepEqual(r.skipped,[{id:'0:1',reason:'protected-parent-link'}]);
  assert.equal(r.connectivity.afterPrune,1);
  assert.ok(!r.activeEdges.some(e=>e.id==='1:2'));
});
test('bridge-like lateral link is retained when parent communication fails',()=>{
  const growth={requests:[1,1,2,3],maxEdges:3};
  const r=regenerate({growth,failed:['0:2'],prune:['1:2'],maxRegrafts:0});
  assert.equal(r.connectivity.afterFailure,1);
  assert.deepEqual(r.skipped,[{id:'1:2',reason:'would-disconnect'}]);
  assert.equal(r.connectivity.final,1);
});
test('explicit repair limits and unresolved partitions are reported',()=>{
  const growth={requests:[1,1,2,3,5],maxEdges:4};
  const failed=grow(growth).edges.map(e=>e.id);
  const r=regenerate({growth,failed,maxRegrafts:1});
  assert.equal(r.connectivity.afterFailure,5);
  assert.equal(r.connectivity.final,4);
  assert.equal(r.connectivity.allConnected,false);
  assert.equal(r.regrafted.length,1);
  assert.ok(r.activeEdges.length<=4);
  assert.ok(r.activeEdges.every(e=>!failed.includes(e.id)));
  assert.equal(regenerate({growth,failed,maxRegrafts:0}).connectivity.final,5);
  assert.equal(regenerate({growth:{requests:[0]}}).connectivity.allConnected,false);
});
test('deterministic bounded candidate pool and unique edges',()=>{
  const graph=grow(),failed=graph.edges.filter((_,i)=>i%4===0).map(e=>e.id);
  const r=regenerate({failed});
  assert.ok(r.candidateCount<=4*r.pockets.length);
  assert.ok(r.regrafted.length<=9);
  assert.ok(r.activeEdges.length<=r.limits.maxEdges);
  assert.equal(new Set(r.activeEdges.map(e=>e.id)).size,r.activeEdges.length);
  assert.ok(r.connectivity.final<=r.connectivity.afterPrune);
  assert.ok(r.activeEdges.every(e=>!failed.includes(e.id)));
  assert.deepEqual(r,regenerate({failed:failed.slice().reverse()}));
});
test('invalid requests fail closed',()=>{
  for(const options of [{failed:['unknown']},{failed:['0:1','0:1']},{prune:['unknown']},{maxRegrafts:730},{pocketEdits:[{id:999,edits:[]}]},{pocketEdits:[{id:0,edits:[{index:81,value:1}]}]}]){
    assert.throws(()=>regenerate(options),RangeError);
  }
});
