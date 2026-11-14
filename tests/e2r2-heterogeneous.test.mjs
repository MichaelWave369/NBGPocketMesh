import test from "node:test";
import assert from "node:assert/strict";
import {
  HETERO_SCHEMA,HETERO_POLICIES,HETERO_OUTAGES,
  heterogeneousFixture,chooseProtection,runHeterogeneousResilience
} from "../site/src/heterogeneous-resilience.js";
const byId=fixture=>new Map(fixture.edges.map(e=>[e.id,e]));
test("heterogeneous fixture has 47 nodes, 188 links and fixed unequal attributes",()=>{
  const f=heterogeneousFixture("A",369),g=heterogeneousFixture("A",369);
  assert.deepEqual(f,g);
  assert.equal(f.nodes,47);
  assert.equal(f.edges.length,188);
  assert.equal(f.demands.length,94);
  assert.equal(new Set(f.edges.map(e=>e.id)).size,188);
  assert.ok(new Set(f.edges.map(e=>e.capacity)).size>=3);
  assert.ok(new Set(f.edges.map(e=>e.latency)).size>=3);
  assert.ok(new Set(f.edges.map(e=>e.protectionCost)).size>=2);
  assert.ok(new Set(f.edges.map(e=>e.riskWeight)).size>=3);
  assert.notDeepEqual(f,heterogeneousFixture("B",369));
  assert.notDeepEqual(f,heterogeneousFixture("A",370));
  for(const e of f.edges){
    assert.ok(e.capacity>=2&&e.capacity<=9);
    assert.ok(e.latency>=1&&e.latency<=7);
    assert.ok(e.protectionCost>=1&&e.protectionCost<=4);
    assert.ok(e.riskWeight>=1&&e.riskWeight<=9);
  }
  for(const d of f.demands){
    assert.notEqual(d.from,d.to);
    assert.ok(d.units>=1&&d.units<=3);
  }
});
test("preselected protection sets respect equal cost ceiling and never overlap within themselves",()=>{
  const fixture=heterogeneousFixture("A",2026),edges=byId(fixture);
  const budget=24;
  for(const policy of HETERO_POLICIES){
    const p=chooseProtection(fixture,policy,budget);
    assert.equal(p.policy,policy);
    assert.ok(p.spent<=budget);
    assert.equal(p.protectedIds.length,new Set(p.protectedIds).size);
    const actual=p.protectedIds.reduce((s,id)=>s+edges.get(id).protectionCost,0);
    assert.equal(p.spent,actual);
    assert.deepEqual(p,chooseProtection(fixture,policy,budget));
    if(policy==="unprotected"){assert.equal(p.spent,0);assert.equal(p.protectedIds.length,0);}
    else{assert.ok(p.protectedIds.length>0);assert.ok(p.spent>=budget-3);}
  }
});
test("all strategies face exactly the same attempted failures within every trial",()=>{
  const a=runHeterogeneousResilience({trials:5,failures:26,budget:24,seed:369});
  const b=runHeterogeneousResilience({trials:5,failures:26,budget:24,seed:369});
  assert.deepEqual(a,b);
  assert.equal(a.schema,HETERO_SCHEMA);
  assert.equal(a.action,"ANALYZE_ONLY");
  assert.equal(a.authority,"NONE");
  assert.equal(a.canRoute,false);
  assert.equal(a.canExecute,false);
  assert.equal(a.canAuthorize,false);
  assert.equal(a.baselineIntact.requestedUnits,a.fixture.demands.reduce((s,d)=>s+d.units,0));
  for(const trial of a.trialRows){
    assert.equal(trial.attemptedFailedEdgeIds.length,26);
    assert.equal(new Set(trial.attemptedFailedEdgeIds).size,26);
    for(const policy of HETERO_POLICIES){
      const x=trial.results[policy],p=a.protections[policy];
      const saved=trial.attemptedFailedEdgeIds.filter(id=>p.protectedIds.includes(id)).length;
      assert.equal(x.protectedFailureAttempts,saved);
      assert.equal(x.remainingFailedEdges+saved,26);
      assert.ok(x.servedUnits<=x.requestedUnits);
      assert.ok(x.servedFraction>=0&&x.servedFraction<=1);
      assert.ok(Number.isFinite(x.meanPenalizedLatency)&&x.meanPenalizedLatency>=0);
    }
    assert.equal(trial.results.unprotected.remainingFailedEdges,26);
    assert.equal(trial.results.unprotected.protectedFailureAttempts,0);
  }
  for(const policy of HETERO_POLICIES){
    const s=a.summary[policy];
    assert.equal(s.protectionCostSpent,a.protections[policy].spent);
    assert.ok(s.meanServedFraction>=0&&s.meanServedFraction<=1);
  }
});
test("uniform and regional, A and B, are valid distinct reproducible trial families",()=>{
  const cases=[];
  for(const graph of ["A","B"])for(const outage of HETERO_OUTAGES){
    const r=runHeterogeneousResilience({graph,outage,trials:4,failures:20,budget:12,seed:2026});
    assert.equal(r.trialRows.length,4);
    assert.equal(r.settings.graph,graph);
    assert.equal(r.settings.outage,outage);
    cases.push(r.trialRows.map(t=>t.attemptedFailedEdgeIds).flat().join(","));
  }
  assert.equal(new Set(cases).size,4);
});
test("input validation refuses invalid parameters and budgets, no silent fallback",()=>{
  for(const patch of [
    {graph:"unknown"},{outage:"oracle"},{trials:0},{trials:41},
    {failures:5},{failures:37},{budget:0},{budget:61},
    {seed:-1},{seed:2**32},{seed:Infinity}
  ])assert.throws(()=>runHeterogeneousResilience(patch),/Unsupported|Trials|Failures|budget|Seed/);
  assert.throws(()=>heterogeneousFixture("A",-1),/seed/);
  assert.throws(()=>chooseProtection(heterogeneousFixture(),"power",24),/Invalid/);
  assert.throws(()=>chooseProtection(heterogeneousFixture(),"topology_risk",61),/Invalid/);
});
test("zero resource reference never claims protected edges or money spent",()=>{
  const r=runHeterogeneousResilience({graph:"B",outage:"regional_risk_weighted",
    trials:4,failures:32,budget:18,seed:717});
  assert.deepEqual(r.protections.unprotected,{policy:"unprotected",spent:0,protectedIds:[]});
  assert.equal(r.summary.unprotected.meanProtectedFailureAttempts,0);
});
