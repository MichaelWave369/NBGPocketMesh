import test from "node:test";
import assert from "node:assert/strict";
import {
  runHeterogeneousResilience,heterogeneousFixture,inspectIntactExposure,
  scoreProtectedTrial
} from "../site/src/heterogeneous-resilience.js";
import {
  COHORT_SCHEMA,COHORT_POLICIES,selectMatchedPolicy,
  seedClusterInterval,runE2R3
} from "../site/src/resilience-cohort.js";

test("read-only score adapter exactly reproduces original E2-R2 trial decisions",()=>{
  const original=runHeterogeneousResilience({
    graph:"A",outage:"regional_risk_weighted",seed:369,
    budget:24,failures:20,trials:4
  });
  const trial=original.trialRows[0];
  for(const [policy,protection] of Object.entries(original.protections)){
    const observed=scoreProtectedTrial({
      graph:"A",seed:369,attemptedFailedEdgeIds:trial.attemptedFailedEdgeIds,
      protectedEdgeIds:protection.protectedIds
    });
    for(const field of [
      "servedFraction","servedUnits","requestedUnits","meanPenalizedLatency",
      "remainingFailedEdges","protectedFailureAttempts"
    ])assert.equal(observed[field],trial.results[policy][field],field+" "+policy);
  }
  const exposure=inspectIntactExposure("A",369);
  assert.equal(Object.keys(exposure).length,188);
  assert.ok(Object.values(exposure).every(x=>Number.isInteger(x)&&x>=0));
});
test("matched-information policies use only frozen baseline exposure, risk and cost",()=>{
  const f=heterogeneousFixture("A",8129);
  const ids=new Set(f.edges.map(e=>e.id));
  for(const policy of ["matched_additive","matched_harmonic"]){
    const selected=selectMatchedPolicy("A",8129,policy,24);
    assert.equal(selected.policy,policy);
    assert.ok(selected.spent<=24&&selected.spent>=21);
    assert.equal(selected.spent,
      selected.protectedIds.reduce((s,id)=>
        s+f.edges.find(e=>e.id===id).protectionCost,0));
    assert.ok(selected.protectedIds.every(x=>ids.has(x)));
    assert.equal(selected.protectedIds.length,new Set(selected.protectedIds).size);
    assert.deepEqual(selectMatchedPolicy("A",8129,policy,24),selected);
    assert.deepEqual(selected.information,
      ["intact-demand-exposure","relative-hazard","protection-cost"]);
    assert.equal(selected.selectedBeforeOutages,true);
  }
  assert.throws(()=>selectMatchedPolicy("A",369,"oracle",24),/policy/);
  assert.throws(()=>selectMatchedPolicy("A",369,"matched_additive",61),/ceiling/);
});
test("cluster bootstrap is deterministic and groups data by seed, not individual failures",()=>{
  const a=seedClusterInterval([1,1,1,1],{bootstrap:200,seed:42});
  assert.deepEqual(a,seedClusterInterval([1,1,1,1],{bootstrap:200,seed:42}));
  assert.equal(a.mean,1);
  assert.equal(a.lower,1);
  assert.equal(a.upper,1);
  const b=seedClusterInterval([-2,-1,2,3],{bootstrap:400,seed:2026});
  assert.ok(b.lower<=b.mean);
  assert.ok(b.upper>=b.mean);
  assert.equal(b.unit,"percentage_points");
  assert.throws(()=>seedClusterInterval([1],{}),/bootstrap/);
  assert.throws(()=>seedClusterInterval([1,Number.NaN],{}),/bootstrap/);
});
test("multi-seed cohort is repeatable and equal-information rivals see identical outage lists",()=>{
  const cfg={
    baseSeed:369,seedCount:2,trials:4,failures:20,budget:24,
    graphs:["A"],outages:["risk_weighted"]
  };
  const a=runE2R3(cfg),b=runE2R3(cfg);
  assert.deepEqual(a,b);
  assert.equal(a.schema,COHORT_SCHEMA);
  assert.equal(a.canRoute,false);
  assert.equal(a.canExecute,false);
  assert.equal(a.canAuthorize,false);
  assert.deepEqual(a.frozenParameters.fixtureSeeds,[369,8288]);
  assert.equal(a.families.length,1);
  const family=a.families[0];
  assert.equal(family.fixtureSeedCount,2);
  assert.equal(family.seedRows.length,2);
  assert.equal(family.budgetViolations,0);
  assert.ok(COHORT_POLICIES.includes(family.leader));
  assert.notEqual(family.leader,"unprotected");
  for(const row of family.seedRows){
    assert.equal(row.pairedTrials.length,4);
    for(const [policy,spent] of Object.entries(row.spent)){
      assert.ok(spent<=24);
      assert.equal(policy==="unprotected",spent===0);
      assert.ok(Number.isFinite(row.averageServedFraction[policy]));
    }
    for(const trial of row.pairedTrials){
      assert.equal(trial.attemptedFailedEdgeIds.length,20);
      assert.equal(new Set(trial.attemptedFailedEdgeIds).size,20);
      assert.deepEqual(Object.keys(trial.outcomes),[...COHORT_POLICIES]);
      assert.ok(Object.values(trial.outcomes).every(x=>x>=0&&x<=1));
    }
  }
  for(const metric of Object.values(family.contrasts)){
    assert.equal(metric.seedsBetter+metric.seedsWorse+metric.seedsTied,2);
    assert.ok(Number.isFinite(metric.lower)&&Number.isFinite(metric.upper));
  }
});
test("cohort settings reject unbounded, unauthorized or duplicated scenario sets",()=>{
  for(const patch of [
    {seedCount:1},{seedCount:13},{trials:3},{trials:13},
    {failures:5},{failures:37},{budget:0},{budget:61},
    {baseSeed:-1},{baseSeed:2**32},
    {graphs:[]},{graphs:["A","A"]},{graphs:["C"]},
    {outages:[]},{outages:["risk_weighted","risk_weighted"]},
    {outages:["physical"]}
  ])assert.throws(()=>runE2R3(patch),/Invalid/);
  const expected=heterogeneousFixture("A",369);
  const known=expected.edges.map(e=>e.id);
  assert.throws(()=>scoreProtectedTrial({
    graph:"A",seed:369,attemptedFailedEdgeIds:[known[0],known[0]],protectedEdgeIds:[]
  }),/Invalid/);
  assert.throws(()=>scoreProtectedTrial({
    graph:"A",seed:369,attemptedFailedEdgeIds:[known[0]],protectedEdgeIds:["inject"]
  }),/Invalid/);
});
