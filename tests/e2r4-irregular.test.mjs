import test from "node:test";
import assert from "node:assert/strict";
import {edgeBetweenness} from "../site/src/link-resilience.js";
import {evaluateIrregularSyntheticFixture} from "../site/src/heterogeneous-resilience.js";
import {
  IRREGULAR_SCHEMA,IRREGULAR_POLICIES,
  makeIrregularFixture,selectIrregularPolicies,runIrregularStress
} from "../site/src/irregular-resilience.js";

test("two irregular families are connected, reproducible and non-regular",()=>{
  for(const family of ["preferential","modular"]){
    const f=makeIrregularFixture(family,369);
    assert.deepEqual(f,makeIrregularFixture(family,369));
    assert.equal(f.nodes,47);
    assert.equal(f.demands.length,94);
    assert.ok(f.edges.length>=46&&f.edges.length<250);
    assert.ok(f.graphMetrics.degreeVariance>0);
    assert.equal(f.graphMetrics.components,1);
    assert.ok(f.graphMetrics.maxDegree>f.graphMetrics.minDegree);
    assert.equal(f.graphMetrics.cycleRank,f.edges.length-47+1);
    assert.ok(f.edges.every(e=>e.capacity>=2&&e.capacity<=9&&
      e.latency>=1&&e.latency<=7&&e.protectionCost>=1&&
      e.protectionCost<=4&&e.riskWeight>=1&&e.riskWeight<=9));
    const base=evaluateIrregularSyntheticFixture(f,[],true);
    assert.ok(base.requestedUnits>0);
    assert.ok(base.servedFraction>=0&&base.servedFraction<=1);
    assert.equal(Object.keys(base.exposure).length,f.edges.length);
    assert.ok(Number.isFinite(base.meanPenalizedLatency));
    const scores=edgeBetweenness({
      schema:"NBGPocketMesh.E2T.Graph.v1",origin:"SIMULATED",
      authority:"NONE",privacy:"public-synthetic",nodes:47,
      edges:f.edges.map(e=>[e.a,e.b,.5])
    });
    assert.equal(scores.size,f.edges.length);
  }
  assert.equal(makeIrregularFixture("modular",369).graphMetrics.bridgeCount,2);
  assert.notDeepEqual(makeIrregularFixture("preferential",369),
    makeIrregularFixture("preferential",370));
});
test("every funded protection policy spends EXACTLY the same cost",()=>{
  for(const family of ["preferential","modular"]){
    const f=makeIrregularFixture(family,369),catalog=new Map(f.edges.map(e=>[e.id,e]));
    const selected=selectIrregularPolicies(f,24);
    for(const policy of IRREGULAR_POLICIES){
      const result=selected[policy];
      assert.equal(result.plannedWithoutFailureKnowledge,true);
      assert.equal(result.protectedIds.length,new Set(result.protectedIds).size);
      const money=result.protectedIds.reduce((s,id)=>s+catalog.get(id).protectionCost,0);
      assert.equal(result.spent,money);
      assert.equal(money,policy==="unprotected"?0:24);
    }
    assert.deepEqual(selectIrregularPolicies(f,24),selected);
  }
});
test("seed-paired stress is reproducible, bounded and has no authority",()=>{
  const args={baseSeed:369,seeds:2,trials:2,failures:20,budget:24,
    families:["preferential"],outages:["uniform_risk"]};
  const a=runIrregularStress(args);
  assert.deepEqual(runIrregularStress(args),a);
  assert.equal(a.schema,IRREGULAR_SCHEMA);
  assert.equal(a.action,"ANALYZE_ONLY");
  assert.equal(a.authority,"NONE");
  assert.equal(a.canRoute,false);
  assert.equal(a.canExecute,false);
  assert.equal(a.canAuthorize,false);
  assert.equal(a.scenarios.length,1);
  assert.equal(a.scenarios[0].seedRows.length,2);
  assert.equal(a.scenarios[0].exactSpendAcrossFunded,true);
  assert.ok(IRREGULAR_POLICIES.includes(a.scenarios[0].leader));
  assert.notEqual(a.scenarios[0].leader,"unprotected");
  for(const row of a.scenarios[0].seedRows){
    assert.equal(row.attempts.length,2);
    assert.equal(row.graphMetrics.nodes,47);
    for(const trial of row.attempts){
      assert.equal(trial.failedEdgeIds.length,20);
      assert.equal(new Set(trial.failedEdgeIds).size,20);
      assert.deepEqual(Object.keys(trial.outcomes),IRREGULAR_POLICIES);
      for(const [policy,details] of Object.entries(trial.outcomes)){
        const saved=trial.failedEdgeIds.filter(id=>row.protectedEdgeIds[policy].includes(id)).length;
        assert.equal(details.blockedFailureAttempts,saved);
        assert.equal(details.remainingFailedEdges,20-saved);
        assert.ok(details.servedFraction>=0&&details.servedFraction<=1);
      }
    }
  }
  for(const comparison of Object.values(a.scenarios[0].comparisons)){
    assert.equal(comparison.better+comparison.tied+comparison.worse,2);
    assert.ok(Number.isFinite(comparison.mean));
    assert.ok(comparison.lower<=comparison.upper);
  }
});
test("regional outages and both structures support complete paired trials",()=>{
  const out=runIrregularStress({
    baseSeed:1205,seeds:2,trials:2,failures:26,budget:18
  });
  assert.equal(out.scenarios.length,4);
  for(const family of out.scenarios){
    assert.equal(family.exactSpendAcrossFunded,true);
    assert.equal(family.seedRows.length,2);
    for(const row of family.seedRows){
      assert.equal(row.attempts.length,2);
      assert.equal(row.attempts[0].failedEdgeIds.length,26);
    }
  }
});
test("reject malformed trust flags, fake edges and bad parameters",()=>{
  const f=makeIrregularFixture();
  for(const patch of [{authority:"GRANTED"},{origin:"PHYSICAL"},
    {schema:"quantum"},{nodes:48},
    {edges:[...f.edges,{...f.edges[0]}]},
    {demands:[...f.demands,{from:0,to:1,units:1}]}]){
    assert.throws(()=>evaluateIrregularSyntheticFixture({...f,...patch},[]),
      /Invalid/);
  }
  assert.throws(()=>evaluateIrregularSyntheticFixture(f,["phantom"]),/Invalid/);
  assert.throws(()=>evaluateIrregularSyntheticFixture(f,[f.edges[0].id,f.edges[0].id]),/Invalid/);
  for(const patch of [
    {baseSeed:-1},{baseSeed:2**32},{seeds:1},{seeds:9},
    {trials:1},{trials:9},{failures:5},{failures:31},
    {budget:5},{budget:49},{families:[]},{families:["modular","modular"]},
    {outages:[]},{outages:["physical"]}
  ])assert.throws(()=>runIrregularStress(patch),/Invalid/);
  assert.throws(()=>makeIrregularFixture("quantum",369),/Invalid/);
  assert.throws(()=>selectIrregularPolicies(f,50),/Invalid/);
});
