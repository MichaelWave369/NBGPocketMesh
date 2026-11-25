import test from 'node:test';
import assert from 'node:assert/strict';
import {grow,compareGrowth} from '../src/phi-mycelium-r1.mjs';
import {route} from '../src/phi-mycelium-r0.mjs';

test('nine Fibonacci ceilings and persistent identities',()=>{
  const requests=Array(9).fill(729),r=grow({requests});
  assert.deepEqual(r.stages.map(s=>s.active),[1,1,2,3,5,8,13,21,34]);
  for(let i=1;i<=9;i++){
    const prefix=grow({requests:requests.slice(0,i),maxEdges:1456});
    assert.deepEqual(prefix.nodes,r.nodes.filter(n=>n.born<i));
  }
  assert.deepEqual(r,grow({requests}));
});
test('strict budgets, mandatory links and root reachability',()=>{
  for(const maxEdges of [0,1,3,10,33,66,1456]){
    const r=grow({requests:Array(9).fill(729),maxNodes:34,maxEdges,maxNewNodes:4});
    assert.ok(r.nodes.length<=34&&r.edges.length<=maxEdges);
    assert.equal(new Set(r.edges.map(e=>e.id)).size,r.edges.length);
    for(const s of r.stages) assert.ok(s.newNodes<=4&&s.active<=s.ceiling&&s.edgeCount<=maxEdges);
    for(const n of r.nodes.slice(1)){
      assert.ok(n.parent<n.id);
      assert.ok(r.edges.some(e=>e.u===n.parent&&e.v===n.id&&e.kind==='parent'));
      assert.ok(route(r,0,n.id));
    }
  }
  assert.equal(grow({requests:[729,729],maxNewNodes:0}).nodes.length,0);
});
test('falling demand does not erase pockets or links',()=>{
  const r=grow({requests:[1,1,2,3,0,0,13,0,34]});
  assert.deepEqual(r.stages.map(s=>s.active),[1,1,2,3,3,3,13,13,34]);
  for(let i=1;i<r.stages.length;i++){
    assert.ok(r.stages[i].active>=r.stages[i-1].active);
    assert.ok(r.stages[i].edgeCount>=r.stages[i-1].edgeCount);
  }
});
test('paired linear baseline has same final ceiling and inputs',()=>{
  const c=compareGrowth({requests:Array(9).fill(34)});
  assert.equal(c.fibonacci.finalNodes,34);
  assert.equal(c.linear.finalNodes,34);
  assert.equal(c.fibonacci.activePocketStages,88);
  assert.ok(c.linear.activePocketStages>c.fibonacci.activePocketStages);
  for(let i=0;i<9;i++) assert.equal(c.traces.fibonacci.stages[i].requested,c.traces.linear.stages[i].requested);
  assert.deepEqual(c,compareGrowth({requests:Array(9).fill(34)}));
});
test('invalid input rejected',()=>{
  for(const options of [{requests:[]},{requests:[NaN]},{requests:[730]},{maxNodes:0},{maxEdges:-1},{maxNewNodes:1.2},{policy:'unknown'}]){
    assert.throws(()=>grow(options),RangeError);
  }
});
