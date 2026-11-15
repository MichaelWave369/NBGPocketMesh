import test from "node:test";
import assert from "node:assert/strict";
import {makeIrregularFixture} from "../site/src/irregular-resilience.js";
import {evaluateIrregularSyntheticFixture} from "../site/src/heterogeneous-resilience.js";
import {inspectSyntheticPathAllocation} from "../site/src/bridge-failover.js";
import {
 PRIORITY_SCHEMA,PRIORITY_POLICIES,PRIORITY_ORDERS,priorityDemandOrder,
 selectPriorityProtection,runPriorityMix
} from "../site/src/mixed-priority.js";

test("priority order is a permutation of original 94 synthetic flow IDs",()=>{
 for(const family of ["modular","preferential"]){
   const fixture=makeIrregularFixture(family,369);
   const order=priorityDemandOrder(fixture);
   assert.equal(order.length,94);
   assert.equal(new Set(order).size,94);
   assert.deepEqual([...order].sort(),fixture.demands.map(x=>x.id).sort());
   const original=inspectSyntheticPathAllocation(fixture);
   const prioritized=inspectSyntheticPathAllocation(fixture,[],order);
   assert.equal(original.assignments.length,94);
   assert.equal(prioritized.assignments.length,94);
   assert.equal(original.action,"ANALYZE_ONLY");
   assert.equal(original.canRoute,false);
   const reference=evaluateIrregularSyntheticFixture(fixture);
   assert.equal(original.assignments.reduce((s,a)=>s+(a.path?a.units:0),0),
     reference.servedUnits);
   const labels=selectPriorityProtection(fixture,24).labels;
   assert.ok(Object.values(labels).includes("priority"));
   assert.ok(Object.values(labels).includes("standard"));
   assert.equal(Object.keys(labels).length,94);
 });
});
test("all policy protection costs are exactly matched, selected before failures",()=>{
 for(const family of ["modular","preferential"]){
   const fixture=makeIrregularFixture(family,8288);
   const plan=selectPriorityProtection(fixture,24);
   assert.deepEqual(plan,selectPriorityProtection(fixture,24));
   assert.equal(plan.bridgeCount,family==="modular"?2:0);
   const prices=new Map(fixture.edges.map(e=>[e.id,e.protectionCost]));
   assert.deepEqual(Object.keys(plan.selected),[...PRIORITY_POLICIES]);
   for(const [policy,result] of Object.entries(plan.selected)){
     assert.equal(result.selectedBeforeOutage,true);
     assert.equal(result.protectedIds.length,new Set(result.protectedIds).size);
     assert.equal(result.protectedIds.reduce((s,id)=>s+prices.get(id),0),
       policy==="unprotected"?0:24);
     assert.equal(result.spent,policy==="unprotected"?0:24);
   }
 }
});
test("paired unknown mixtures preserve synthetic boundaries and each class metric",()=>{
 const args={baseSeed:369,seeds:2,trials:2,attempts:12,budget:24,
   families:["modular","preferential"],mixes:["balanced","cluster_heavy"]};
 const r=runPriorityMix(args);
 assert.deepEqual(r,runPriorityMix(args));
 assert.equal(r.schema,PRIORITY_SCHEMA);
 assert.equal(r.origin,"SIMULATED");
 assert.equal(r.authority,"NONE");
 assert.equal(r.action,"ANALYZE_ONLY");
 assert.equal(r.canRoute,false);assert.equal(r.canExecute,false);
 assert.equal(r.canAuthorize,false);
 assert.equal(r.groups.length,4);
 for(const group of r.groups){
   assert.equal(group.exactFundedSpend,true);
   assert.ok(PRIORITY_POLICIES.includes(group.leader));
   assert.ok(group.leaders.includes(group.leader));
   assert.equal(group.metric,"priority_first.priorityFraction");
   for(const row of group.seedRows){
     assert.equal(row.trials.length,2);
     assert.equal(row.classDemandCounts.priority+row.classDemandCounts.standard,94);
     assert.ok(row.classDemandCounts.priority>0);
     assert.ok(row.classDemandCounts.standard>0);
     for(const trial of row.trials){
       assert.ok(["uniform","risk_weighted","clustered"].includes(trial.subtype));
       assert.equal(trial.attemptedFailedEdgeIds.length,12);
       assert.equal(new Set(trial.attemptedFailedEdgeIds).size,12);
       assert.deepEqual(Object.keys(trial.results),[...PRIORITY_POLICIES]);
       for(const policy of PRIORITY_POLICIES){
         const observation=trial.results[policy];
         assert.equal(observation.blockedAttempts+observation.failedEdges,12);
         assert.equal(observation.spent,policy==="unprotected"?0:24);
         assert.deepEqual(Object.keys(observation).slice(-2),PRIORITY_ORDERS);
         for(const order of PRIORITY_ORDERS){
           const m=observation[order];
           assert.equal(m.priorityRequested+m.standardRequested,m.totalRequested);
           assert.equal(m.priorityServed+m.standardServed,m.totalServed);
           assert.ok(m.priorityFraction>=0&&m.priorityFraction<=1);
           assert.ok(m.standardFraction>=0&&m.standardFraction<=1);
           assert.ok(m.totalFraction>=0&&m.totalFraction<=1);
           assert.ok(m.weightedFraction>=0&&m.weightedFraction<=1);
         }
       }
       assert.equal(trial.results.unprotected.failedEdges,12);
       assert.equal(trial.results.unprotected.blockedAttempts,0);
     }
   }
   for(const c of Object.values(group.comparisons)){
     assert.equal(c.better+c.tied+c.worse,2);
     assert.ok(c.lower<=c.upper);
     assert.ok(Number.isFinite(c.mean));
   }
 }
});
test("hard bounded inputs and unauthorized demand mutations refuse",()=>{
 for(const x of [
  {baseSeed:-1},{baseSeed:2**32},{seeds:1},{seeds:7},
  {trials:1},{trials:7},{attempts:5},{attempts:25},
  {budget:7},{budget:37},{families:[]},{families:["modular","modular"]},
  {families:["actual_network"]},{mixes:[]},{mixes:["balanced","balanced"]},
  {mixes:["oracle"]}
 ])assert.throws(()=>runPriorityMix(x),/Invalid/);
 const fixture=makeIrregularFixture("modular",369);
 assert.throws(()=>priorityDemandOrder({...fixture,authority:"E0_EXECUTE"}),/Invalid/);
 assert.throws(()=>selectPriorityProtection(fixture,37),/Invalid/);
 assert.throws(()=>inspectSyntheticPathAllocation(fixture,[],["invented"]),/permutation/);
 assert.throws(()=>inspectSyntheticPathAllocation(fixture,["invented"]),/Invalid/);
 assert.throws(()=>inspectSyntheticPathAllocation({...fixture,origin:"PHYSICAL"}),/Invalid/);
});
