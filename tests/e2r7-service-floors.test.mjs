import test from "node:test";
import assert from "node:assert/strict";
import {makeIrregularFixture} from "../site/src/irregular-resilience.js";
import {inspectSyntheticPathAllocation,inspectSyntheticServiceFloor}
  from "../site/src/bridge-failover.js";
import {getSyntheticServiceClasses,priorityDemandOrder}
  from "../site/src/mixed-priority.js";
import {FLOOR_SCHEMA,FLOOR_LEVELS,runServiceFloorCohort}
  from "../site/src/service-floors.js";

test("zero reservation reproduces original priority-first flow placements",()=>{
 for(const family of ["modular","preferential"]){
   const fixture=makeIrregularFixture(family,369);
   const labels=getSyntheticServiceClasses(fixture);
   const order=priorityDemandOrder(fixture);
   const reference=inspectSyntheticPathAllocation(fixture,[],order);
   const priority=reference.assignments.filter(x=>labels[x.id]==="priority");
   const standard=reference.assignments.filter(x=>labels[x.id]==="standard");
   const result=inspectSyntheticServiceFloor(fixture,[],labels,0);
   assert.equal(result.priorityServed,priority.reduce((s,a)=>s+(a.path?a.units:0),0));
   assert.equal(result.standardServed,standard.reduce((s,a)=>s+(a.path?a.units:0),0));
   assert.equal(result.floorSatisfied,true);
   assert.equal(result.attainableUnderGreedy,true);
   assert.equal(result.stageServedUnits.reservedStandard,0);
   assert.equal(result.authority,"NONE");
   assert.equal(result.action,"ANALYZE_ONLY");
   assert.equal(result.canRoute,false);
   assert.equal(result.canExecute,false);
   assert.equal(result.canAuthorize,false);
 }
});
test("greedy-attainable standard floor is met; unmet floor is recorded honestly",()=>{
 const fixture=makeIrregularFixture("modular",369);
 const labels=getSyntheticServiceClasses(fixture);
 const floors=[0,20,30,40,70];
 let potential=null;
 for(const percent of floors){
   const got=inspectSyntheticServiceFloor(fixture,[],labels,percent);
   assert.ok(Number.isFinite(got.priorityFraction));
   assert.ok(Number.isFinite(got.standardFraction));
   assert.ok(Number.isFinite(got.totalFraction));
   assert.equal(got.totalServed,got.standardServed+got.priorityServed);
   assert.equal(got.standardServed,got.stageServedUnits.reservedStandard+
     got.stageServedUnits.finalStandard);
   assert.equal(got.priorityServed,got.stageServedUnits.priority);
   assert.equal(got.targetStandardUnits,Math.ceil(got.standardRequested*percent/100));
   assert.equal(got.shortfallUnits,Math.max(0,got.targetStandardUnits-got.standardServed));
   if(potential!==null)assert.equal(got.standardFirstGreedyPotentialUnits,potential);
   potential=got.standardFirstGreedyPotentialUnits;
   if(got.attainableUnderGreedy)assert.equal(got.floorSatisfied,true);
   else assert.ok(got.standardFirstGreedyPotentialUnits<got.targetStandardUnits);
 }
});
test("cohort is deterministic, paired, exactly funded and honest about feasibility",()=>{
 const args={baseSeed:369,seeds:2,trials:2,attempts:12,budget:24,
   families:["modular"],mixes:["balanced"],floors:[0,20,40]};
 const run=runServiceFloorCohort(args);
 assert.deepEqual(run,runServiceFloorCohort(args));
 assert.equal(run.schema,FLOOR_SCHEMA);
 assert.deepEqual(FLOOR_LEVELS,[0,20,30,40]);
 assert.equal(run.origin,"SIMULATED");
 assert.equal(run.authority,"NONE");
 assert.equal(run.action,"ANALYZE_ONLY");
 assert.equal(run.canRoute,false);
 assert.equal(run.canExecute,false);
 assert.equal(run.canAuthorize,false);
 assert.equal(run.groups.length,1);
 const family=run.groups[0];
 assert.equal(family.exactFundedSpend,true);
 assert.equal(family.seedRows.length,2);
 for(const row of family.seedRows){
   assert.equal(row.trials.length,2);
   for(const trial of row.trials){
     assert.equal(trial.attemptedFailedEdgeIds.length,12);
     assert.equal(new Set(trial.attemptedFailedEdgeIds).size,12);
     for(const [policy,levels] of Object.entries(trial.outcomes)){
       for(const [level,metric] of Object.entries(levels)){
         assert.equal(metric.floorPercent,Number(level));
         assert.equal(metric.canRoute,false);
         assert.equal(metric.totalServed,metric.priorityServed+metric.standardServed);
         if(metric.attainableUnderGreedy)assert.equal(metric.floorSatisfied,true);
         if(!metric.floorSatisfied)assert.ok(metric.shortfallUnits>0);
         if(level==="0")assert.equal(metric.stageServedUnits.reservedStandard,0);
       }
     }
   }
 }
 for(const level of [0,20,40]){
   const summary=family.floors[level];
   assert.ok(summary.bestMeanPriorityPolicy!=="unprotected");
   for(const [policy,metric] of Object.entries(summary.policies)){
     assert.equal(metric.spent,policy==="unprotected"?0:24);
     assert.equal(metric.attempts,4);
     assert.equal(metric.floorAttainableTrials,
       metric.floorSatisfiedWhenAttainable);
     assert.equal(metric.floorAttainableTrials+metric.belowGreedyPotentialTrials,4);
     assert.ok(metric.meanPriorityFraction>=0&&metric.meanPriorityFraction<=1);
     assert.ok(metric.meanStandardFraction>=0&&metric.meanStandardFraction<=1);
   }
 }
});
test("unknown or unauthorized fixture, label map and floor inputs fail closed",()=>{
 const fixture=makeIrregularFixture("modular",369);
 const labels=getSyntheticServiceClasses(fixture);
 for(const badFloor of [-1,71,10.1,NaN,Infinity,"30"])
   assert.throws(()=>inspectSyntheticServiceFloor(fixture,[],labels,badFloor),/floor/);
 assert.throws(()=>inspectSyntheticServiceFloor(fixture,[],{},30),/Class labels/);
 assert.throws(()=>inspectSyntheticServiceFloor(fixture,[],{...labels,phantom:"priority"},30),/Class labels/);
 assert.throws(()=>inspectSyntheticServiceFloor({...fixture,authority:"LIVE"},[],labels,30),/Invalid/);
 assert.throws(()=>inspectSyntheticServiceFloor(fixture,["not-an-edge"],labels,30),/Invalid/);
});
test("cohort refuses configuration drift and unsupported floors",()=>{
 for(const patch of [
   {baseSeed:-1},{seeds:1},{seeds:7},{trials:1},{trials:7},
   {attempts:5},{attempts:25},{budget:7},{budget:37},
   {families:[]},{families:["modular","modular"]},{families:["real-network"]},
   {mixes:[]},{mixes:["balanced","balanced"]},{mixes:["physical"]},
   {floors:[20,30]},{floors:[0,30,20]},{floors:[0,20,20]},
   {floors:[0,80]},{floors:[0]},{floors:[0,10,20,30,40,50]}
 ])assert.throws(()=>runServiceFloorCohort(patch),/Invalid/);
});
