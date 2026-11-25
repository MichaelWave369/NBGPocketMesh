import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES,topology,trial,cohort} from '../src/phi-mycelium-r4.mjs';

test('six distinct connected topologies with exactly matched initial budgets',()=>{
  const signatures=new Set();
  for(const family of FAMILIES){
    const edges=topology(family);
    assert.equal(edges.length,60);
    assert.equal(new Set(edges.map(e=>e.id)).size,60);
    assert.ok(edges.every(e=>e.u>=0&&e.u<e.v&&e.v<36&&e.capacity===2));
    const seen=new Set([0]);
    for(let i=0;i<36;i++)for(const e of edges){
      if(seen.has(e.u))seen.add(e.v);
      if(seen.has(e.v))seen.add(e.u);
    }
    assert.equal(seen.size,36);
    signatures.add(edges.map(e=>e.id).join(','));
  }
  assert.equal(signatures.size,6);
});
test('paired workload, equal fault counts and constrained repairs',()=>{
  const r=trial();
  assert.equal(r.demands.length,36);
  for(const f of r.results){
    assert.equal(f.failed.length,12);
    assert.equal(f.phases[0].capacity,120);
    assert.equal(f.phases[1].capacity,96);
    assert.ok(f.regrafted.length<=9);
    assert.equal(f.phases[2].edges.length,48+f.regrafted.length);
    assert.ok(f.phases[2].components<=f.phases[1].components);
    assert.ok(f.phases[2].edges.every(e=>!f.failed.includes(e.id)));
  }
  assert.deepEqual(r,trial());
});
test('all admitted paths respect continuity, simple paths and shared capacity',()=>{
  for(const f of trial().results)for(const phase of f.phases)for(const key of ['shortest','loadAware']){
    const r=phase[key],byId=new Map(phase.edges.map(e=>[e.id,e])),usage=new Map();
    let count=0,hops=0;
    for(const row of r.records){
      if(row.path===null)continue;
      count++;hops+=row.path.length;
      let u=row.src;const seen=new Set([u]);
      for(const id of row.path){
        const e=byId.get(id);assert.ok(e);
        assert.ok(e.u===u||e.v===u);
        u=e.u===u?e.v:e.u;assert.ok(!seen.has(u));seen.add(u);
        usage.set(id,(usage.get(id)??0)+row.units);
      }
      assert.equal(u,row.dst);
    }
    assert.equal(count,r.served);assert.equal(hops,r.hops);
    for(const e of phase.edges)assert.ok((usage.get(e.id)??0)<=e.capacity);
    for(const e of r.usage)assert.equal(e.used,usage.get(e.id)??0);
  }
});
test('total outage and zero repair limits do not invent capacity',()=>{
  const r=trial({failCount:60,maxRepairs:0});
  for(const f of r.results)for(const p of f.phases.slice(1)){
    assert.equal(p.components,36);assert.equal(p.capacity,0);
    assert.equal(p.shortest.served,0);assert.equal(p.loadAware.served,0);
  }
  for(const f of trial({failCount:0}).results)assert.deepEqual(f.regrafted,[]);
});
test('cohort aggregates and inputs are reproducible and bounded',()=>{
  const r=cohort({seeds:[369,8288]});
  for(const f of r.summary)for(const p of f.phases){
    assert.equal(p.attempts,72);
    assert.ok(p.shortestServed<=72&&p.loadAwareServed<=72);
  }
  assert.deepEqual(r,cohort({seeds:[369,8288]}));
  for(const opts of [{seeds:[]},{seeds:[1,1]},{seeds:[0]},{failCount:61},{maxRepairs:-1}])assert.throws(()=>cohort(opts),RangeError);
  assert.throws(()=>topology('unknown'),RangeError);
});
