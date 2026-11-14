import test from "node:test";
import assert from "node:assert/strict";
import {makeIrregularFixture} from "../site/src/irregular-resilience.js";
import {evaluateIrregularSyntheticFixture} from "../site/src/heterogeneous-resilience.js";
import {
  FAILOVER_SCHEMA,FAILOVER_POLICIES,FAILOVER_MODES,
  analyzeBridgeDemand,chooseFailoverProtection,runBridgeFailover
} from "../site/src/bridge-failover.js";

test("exact bridge cut analysis on modular structure, and no hub-fixture cuts",()=>{
  const modular=makeIrregularFixture("modular",369);
  const b=analyzeBridgeDemand(modular);
  assert.equal(b.bridges.length,2);
  assert.equal(b.totalDemandUnits,modular.demands.reduce((sum,d)=>sum+d.units,0));
  assert.ok(b.totalCriticalUnits>0);
  assert.ok(b.totalCriticalUnits<b.totalDemandUnits);
  for(const cut of b.bridges){
    assert.equal(cut.componentSizes.reduce((s,x)=>s+x,0),47);
    assert.ok(cut.componentSizes[0]>0&&cut.componentSizes[1]>0);
    assert.ok(cut.criticalUnits>0);
    const removed=evaluateIrregularSyntheticFixture(modular,[cut.id]);
    assert.ok(removed.servedFraction<=1);
  }
  const hub=analyzeBridgeDemand(makeIrregularFixture("preferential",369));
  assert.equal(hub.bridges.length,0);
  assert.equal(hub.totalCriticalUnits,0);
  assert.deepEqual(hub.criticalDemandIds,[]);
});

test("bridge guard and other funded policies spend exactly matched synthetic cost",()=>{
  for(const family of ["modular","preferential"]){
    const fixture=makeIrregularFixture(family,369),lookup=new Map(fixture.edges.map(e=>[e.id,e.protectionCost]));
    const a=chooseFailoverProtection(fixture,24);
    assert.deepEqual(a,chooseFailoverProtection(fixture,24));
    for(const [policy,selected] of Object.entries(a.selections)){
      const actual=selected.protectedIds.reduce((s,id)=>s+lookup.get(id),0);
      assert.equal(actual,selected.spent);
      assert.equal(selected.spent,policy==="unprotected"?0:24);
      assert.equal(selected.protectedIds.length,new Set(selected.protectedIds).size);
      assert.equal(selected.selectedBeforeOutage,true);
    }
    if(family==="modular"){
      for(const bridge of a.bridgeAnalysis.bridges){
        assert.ok(a.selections.bridge_guard.protectedIds.includes(bridge.id),
          "Guard should protect each structurally identified bridge under 24-cost ceiling.");
      }
    }
  }
});

test("paired bridge-targeted and nonbridge control outages preserve authority boundary",()=>{
  const args={baseSeed:369,seeds:2,trials:2,attempts:10,budget:24,
    families:[["modular","bridge_attack"],["modular","nonbridge_control"],
      ["preferential","nonbridge_control"]]};
  const r=runBridgeFailover(args);
  assert.deepEqual(r,runBridgeFailover(args),"same fixture seeds reproduce every demand and outage");
  assert.equal(r.schema,FAILOVER_SCHEMA);
  assert.equal(r.action,"ANALYZE_ONLY");
  assert.equal(r.authority,"NONE");
  assert.equal(r.canRoute,false);
  assert.equal(r.canExecute,false);
  assert.equal(r.canAuthorize,false);
  assert.equal(r.scenarios.length,3);
  for(const scenario of r.scenarios){
    assert.equal(scenario.seedRows.length,2);
    assert.equal(scenario.allFundedExactSpend,true);
    assert.ok(FAILOVER_POLICIES.includes(scenario.leader));
    assert.ok(Array.isArray(scenario.leaders)&&scenario.leaders.includes(scenario.leader));
    if(scenario.family==="preferential"){
      assert.equal(scenario.primaryMetric,"meanServedFraction");
      assert.equal(scenario.byPolicy.unprotected.full.meanCriticalServedFraction,null);
    }
    assert.notEqual(scenario.leader,"unprotected");
    assert.deepEqual(Object.keys(scenario.byPolicy),[...FAILOVER_POLICIES]);
    for(const row of scenario.seedRows){
      assert.equal(row.trials.length,2);
      for(const trial of row.trials){
        assert.equal(trial.attemptedFailedEdgeIds.length,10);
        assert.equal(new Set(trial.attemptedFailedEdgeIds).size,10);
        for(const policy of FAILOVER_POLICIES){
          const outcome=trial.outcomes[policy];
          assert.equal(outcome.removedEdgeCount+outcome.preventedFailureAttempts,10);
          assert.equal(outcome.protectionSpent,policy==="unprotected"?0:24);
          assert.deepEqual(Object.keys(outcome).slice(-3),FAILOVER_MODES);
          assert.ok(outcome.static.servedUnits<=outcome.repair.servedUnits);
          for(const mode of FAILOVER_MODES){
            const metric=outcome[mode];
            assert.ok(metric.servedUnits<=metric.requestedUnits);
            assert.ok(metric.servedFraction>=0&&metric.servedFraction<=1);
            assert.equal(metric.criticalServedFraction===null,
              metric.criticalRequestedUnits===0);
          }
        }
        if(scenario.outage==="bridge_attack"){
          assert.equal(trial.outcomes.unprotected.removedBridges.length,1);
          assert.equal(trial.outcomes.bridge_guard.removedBridges.length,0);
        }else{
          assert.equal(trial.outcomes.unprotected.removedBridges.length,0);
        }
      }
    }
  }
});
test("strict malformed and fake-authority inputs fail closed",()=>{
  const fixture=makeIrregularFixture("modular");
  for(const bad of [
    {...fixture,authority:"ALLOW"},
    {...fixture,origin:"PHYSICAL"},
    {...fixture,nodes:48},
    {...fixture,edges:[...fixture.edges,fixture.edges[0]]},
    {...fixture,demands:[...fixture.demands,{id:"inject",from:0,to:1,units:2}]}
  ])assert.throws(()=>analyzeBridgeDemand(bad),/Invalid/);
  assert.throws(()=>chooseFailoverProtection(fixture,37),/budget/);
  for(const invalid of [
    {baseSeed:-1},{baseSeed:2**32},{seeds:1},{seeds:9},
    {trials:1},{trials:9},{attempts:5},{attempts:25},
    {budget:7},{budget:37},{families:[]},
    {families:[["modular","bridge_attack"],["modular","bridge_attack"]]},
    {families:[["preferential","bridge_attack"]]},
    {families:[["quantum","real_network"]]}
  ])assert.throws(()=>runBridgeFailover(invalid),/Invalid/);
});
