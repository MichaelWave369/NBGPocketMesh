import test from "node:test";
import assert from "node:assert/strict";
import {
  EXACT_GAP_SCHEMA,TINY_FIXTURES,TINY_FLOORS,TINY_FAULTS,
  makeTinyFixture,greedyTinyReservation,exactTinyAdmission,
  compareTinyGap,runOptimizationGap
} from "../site/src/exact-optimization-gap.js";

function verifySolution(fixture,failed,assignments){
  const prices=new Map(fixture.edges.filter(e=>!failed.includes(e.id))
    .map(e=>[e.id,e.capacity]));
  const edges=new Map(fixture.edges.map(e=>[e.id,e]));
  for(const demand of fixture.demands){
    const chosen=assignments[demand.id];
    if(!chosen)continue;
    assert.equal(chosen.units,demand.units);
    let current=demand.from;
    const visited=new Set([current]);
    for(const linkId of chosen.path){
      assert.ok(!failed.includes(linkId));
      const edge=edges.get(linkId);
      assert.ok(edge);
      assert.ok(edge.a===current||edge.b===current,"simple route must be continuous");
      current=edge.a===current?edge.b:edge.a;
      assert.ok(!visited.has(current),"no repeated path vertices");
      visited.add(current);
      prices.set(linkId,prices.get(linkId)-demand.units);
      assert.ok(prices.get(linkId)>=0,"edge capacity must not be violated");
    }
    assert.equal(current,demand.to);
  }
}
test("fork is a constructive feasible floor missed by greedy reservation",()=>{
  const fixture=makeTinyFixture("fork",369);
  const greedy=greedyTinyReservation(fixture,[],100);
  const exact=exactTinyAdmission(fixture,[],100);
  assert.equal(greedy.targetStandardUnits,2);
  assert.equal(greedy.greedyStandardFirstPotentialUnits,1);
  assert.equal(greedy.greedyAttainable,false);
  assert.equal(greedy.floorSatisfied,false);
  assert.equal(exact.certified,true);
  assert.equal(exact.globallyFeasibleWithinTinyModel,true);
  assert.equal(exact.maximumStandardUnits,2);
  assert.equal(exact.exact.priorityUnits,1);
  assert.equal(exact.exact.standardUnits,2);
  assert.equal(exact.exact.totalUnits,3);
  verifySolution(fixture,[],exact.exact.assignments);
  assert.deepEqual(exactTinyAdmission(fixture,[],100),exact);
  const comparison=compareTinyGap(fixture,[],100);
  assert.equal(comparison.schema,EXACT_GAP_SCHEMA);
  assert.equal(comparison.classification,"greedy_missed_feasible_floor");
  assert.equal(comparison.canRoute,false);
  assert.equal(comparison.canExecute,false);
  assert.equal(comparison.canAuthorize,false);
  assert.equal(comparison.action,"ANALYZE_ONLY");
  assert.equal(comparison.authority,"NONE");
});
test("fork loses the spare route and 100% standard floor becomes EXACTLY infeasible",()=>{
  const f=makeTinyFixture("fork");
  const failed=["0-2"];
  const proof=exactTinyAdmission(f,failed,100);
  assert.equal(proof.globallyFeasibleWithinTinyModel,false);
  assert.equal(proof.maximumStandardUnits,1);
  assert.equal(proof.exact,null);
  assert.equal(compareTinyGap(f,failed,100).classification,
    "proven_infeasible_within_tiny_model");
  const lower=exactTinyAdmission(f,failed,40);
  assert.equal(lower.globallyFeasibleWithinTinyModel,true);
  assert.ok(lower.exact);
  assert.ok(lower.exact.standardUnits>=1);
  verifySolution(f,failed,lower.exact.assignments);
});
test("each tiny network optimally compares greedy to all-simple-path exhaustive choices",()=>{
  for(const name of TINY_FIXTURES){
    const fixture=makeTinyFixture(name,369);
    for(const fault of TINY_FAULTS){
      const failed=fault==="intact"?[]:[fixture.failureEdge];
      for(const floor of TINY_FLOORS){
        const observed=compareTinyGap(fixture,failed,floor);
        assert.equal(observed.proof.certified,true);
        assert.ok(observed.proof.exploredStates>0);
        assert.ok(observed.proof.completeLeaves>0);
        assert.ok(observed.proof.exploredStates<=2500000);
        assert.ok(Object.values(observed.proof.pathCounts).every(n=>Number.isInteger(n)&&n>=0));
        if(observed.proof.exact){
          verifySolution(fixture,failed,observed.proof.exact.assignments);
          assert.ok(observed.proof.exact.standardUnits>=observed.greedy.targetStandardUnits);
        }
        if(observed.greedy.floorSatisfied){
          assert.ok(observed.proof.exact);
          assert.ok(observed.proof.exact.priorityUnits>=observed.greedy.priorityUnits);
          if(observed.proof.exact.priorityUnits===observed.greedy.priorityUnits)
            assert.ok(observed.proof.exact.totalUnits>=observed.greedy.totalUnits);
        }
      }
    }
  }
});
test("all 24 frozen cases reproducibly classify optimization gaps and proof failures",()=>{
  const r=runOptimizationGap();
  assert.deepEqual(r,runOptimizationGap());
  assert.equal(r.cases.length,24);
  assert.equal(Object.values(r.counts).reduce((sum,n)=>sum+n,0),24);
  assert.equal(r.canRoute,false);
  assert.equal(r.canAuthorize,false);
  assert.equal(r.config.maxSearchStates,2500000);
  assert.ok(r.counts.greedy_missed_feasible_floor>=1);
  assert.ok(r.counts.proven_infeasible_within_tiny_model>=1);
  assert.ok(r.cases.every(c=>c.proof.certified));
});
test("bounded exact checker rejects unauthorized or malformed inputs",()=>{
  const f=makeTinyFixture("fork");
  for(const bad of [
    {...f,authority:"LIVE"},{...f,origin:"HARDWARE"},
    {...f,nodes:8},{...f,edges:[...f.edges,{...f.edges[0]}]},
    {...f,edges:f.edges.map((e,i)=>i?e:{...e,capacity:0})},
    {...f,demands:[...f.demands,{id:"duplicate",from:0,to:1,units:1,service:"priority"}]},
    {...f,demands:f.demands.map((d,i)=>i?d:{...d,service:"CEO"})}
  ])assert.throws(()=>exactTinyAdmission(bad,[],40),/Invalid/);
  assert.throws(()=>exactTinyAdmission(f,["invented"],40),/Invalid/);
  assert.throws(()=>exactTinyAdmission(f,["0-2","0-2"],40),/Invalid/);
  assert.throws(()=>exactTinyAdmission(f,[],-1),/Invalid/);
  assert.throws(()=>exactTinyAdmission(f,[],101),/Invalid/);
  assert.throws(()=>makeTinyFixture("prod",369),/Invalid/);
  for(const patch of [
    {seed:-1},{fixtures:[]},{fixtures:["fork","fork"]},
    {faults:[]},{faults:["physical"]},{floors:[]},
    {floors:[20]},{floors:[0,0]},{floors:[0,20,40,70,100]}
  ])assert.throws(()=>runOptimizationGap(patch),/Invalid/);
});
