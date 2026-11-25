import test from 'node:test';
import assert from 'node:assert/strict';
import {fibonacciBudgets,fixture,route,adapt,experiment} from '../src/phi-mycelium-r0.mjs';

test('bounded Fibonacci and acyclic containment',()=>{
  assert.deepEqual(fibonacciBudgets(9),[1,1,2,3,5,8,13,21,34]);
  assert.throws(()=>fixture(730),RangeError);
  assert.throws(()=>fibonacciBudgets(16),RangeError);
  const g=fixture(34);
  assert.equal(g.nodes[0].parent,null);
  for(const p of g.nodes.slice(1)) assert.ok(p.parent<p.id);
  assert.equal(new Set(g.edges.map(e=>e.id)).size,g.edges.length);
});
test('routes avoid failed links and terminate',()=>{
  const g=fixture(34);
  const first=route(g,0,33);
  assert.ok(first);
  const failed=new Set(first.edges);
  const second=route(g,0,33,new Map(),failed);
  if(second) assert.ok(second.edges.every(e=>!failed.has(e)));
  assert.equal(route(g,0,33,new Map(),new Set(g.edges.map(e=>e.id))),null);
  assert.deepEqual(route(g,0,0),{edges:[],cost:0});
  assert.throws(()=>route(g,-1,3),RangeError);
});
test('reinforcement bounded; unused links decay',()=>{
  const g=fixture(5),id=g.edges[0].id;
  let weights=new Map();
  for(let i=0;i<90;i++) weights=adapt(g,weights,[id]);
  assert.equal(weights.get(id),1);
  weights=adapt(g,weights,[]);
  assert.equal(weights.get(id),0.95);
  assert.ok([...weights.values()].every(x=>x>=0&&x<=1));
});
test('paired deterministic experiment validates every path and reports actual costs',()=>{
  const r=experiment(),g=fixture(r.n),byId=new Map(g.edges.map(e=>[e.id,e]));
  assert.deepEqual(r,experiment());
  assert.throws(()=>experiment({seed:0}),RangeError);
  assert.throws(()=>experiment({rounds:901}),RangeError);
  for(let i=0;i<r.static.records.length;i++){
    const a=r.static.records[i],b=r.adaptive.records[i];
    assert.deepEqual([a.src,a.dst,a.fault],[b.src,b.dst,b.fault]);
    assert.equal(a.result===null,b.result===null);
    if(a.result) assert.ok(a.result.cost<=b.result.cost);
    for(const row of [a,b]) if(row.result){
      let u=row.src,cost=0;const seen=new Set([u]);
      for(const id of row.result.edges){
        assert.ok(!row.fault||!r.failed.includes(id));
        const e=byId.get(id);assert.ok(e.u===u||e.v===u);
        u=e.u===u?e.v:e.u;assert.ok(!seen.has(u));seen.add(u);cost+=e.cost;
      }
      assert.equal(u,row.dst);assert.equal(cost,row.result.cost);
    }
  }
  assert.equal(r.static.intact.attempts+r.static.faulted.attempts,90);
});
