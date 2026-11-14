// E2-R3: matched-information synthetic link-protection cohort.
// Uses the unchanged E2-R2 frozen evaluator plus additive, read-only observation adapters.
// NO real network, model weights, quantum topology, permission or live routing.
import {
  HETERO_POLICIES,heterogeneousFixture,inspectIntactExposure,
  runHeterogeneousResilience,scoreProtectedTrial
} from "./heterogeneous-resilience.js";

export const COHORT_SCHEMA="NBGPocketMesh.E2R3.MultiSeed.v1";
export const COHORT_POLICIES=Object.freeze([
  "topology_risk","matched_additive","matched_harmonic",
  "demand_only","risk_only","capacity_only","random","unprotected"
]);
const COMPARATORS=Object.freeze([
  "matched_additive","matched_harmonic","demand_only",
  "risk_only","capacity_only","random"
]);
const UINT=x=>Number.isSafeInteger(x)&&x>=0&&x<=0xffffffff;
const ISINT=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
function hash(str){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),0x01000193)>>>0;
  return h>>>0;
}
function random(seed){
  let x=(seed>>>0)||0x6d2b79f5;
  return ()=>{
    x^=x<<13;x^=x>>>17;x^=x<<5;
    return (x>>>0)/4294967296;
  };
}
function mean(values){return values.reduce((a,b)=>a+b,0)/values.length;}
const sum=(items,key)=>items.reduce((a,b)=>a+b[key],0);
/** Same modeled information for both controls and E2-R2 topology_risk:
 * per-edge intact routed demand, relative hazard, protection cost.
 * Their scoring formula differs, and future failure outcomes remain unseen.
 */
export function selectMatchedPolicy(graph,seed,policy,budget){
  if(!["matched_additive","matched_harmonic"].includes(policy))
    throw new TypeError("Unknown matched-information policy.");
  if(!ISINT(budget,6,60))throw new TypeError("Invalid cost ceiling.");
  const fixture=heterogeneousFixture(graph,seed);
  const exposure=inspectIntactExposure(graph,seed);
  const maxExposure=Math.max(1,...Object.values(exposure));
  const ranked=fixture.edges.map(e=>{
    const u=exposure[e.id]/maxExposure;
    const r=e.riskWeight/9;
    const score=policy==="matched_additive"?(u+r)/2:
      u+r>0?2*u*r/(u+r):0;
    return {id:e.id,cost:e.protectionCost,
      score:score/e.protectionCost,
      tie:hash("MATCHED|"+policy+"|"+seed+"|"+e.id)};
  }).sort((a,b)=>b.score-a.score||a.tie-b.tie||a.id.localeCompare(b.id));
  const protectedIds=[];
  let spent=0;
  for(const edge of ranked){
    if(spent+edge.cost>budget)continue;
    spent+=edge.cost;
    protectedIds.push(edge.id);
  }
  return {policy,spent,protectedIds:protectedIds.sort(),
    information:["intact-demand-exposure","relative-hazard","protection-cost"],
    selectedBeforeOutages:true};
}
/** Percentile cluster bootstrap across fixture seeds, NOT outage trials.
 * Conditional on an artificial seeded fixture family; not a field confidence claim.
 */
export function seedClusterInterval(values,{bootstrap=400,seed=1776}={}){
  if(!Array.isArray(values)||values.length<2||values.length>16||
     values.some(v=>!Number.isFinite(v))||!ISINT(bootstrap,100,2000)||
     !UINT(seed))throw new TypeError("Invalid cluster bootstrap inputs.");
  const rng=random(seed),n=values.length,means=[];
  for(let b=0;b<bootstrap;b++){
    let total=0;
    for(let j=0;j<n;j++)total+=values[Math.floor(rng()*n)];
    means.push(total/n);
  }
  means.sort((a,b)=>a-b);
  const quantile=p=>{
    const k=p*(means.length-1),lo=Math.floor(k),hi=Math.ceil(k);
    return means[lo]+(k-lo)*(means[hi]-means[lo]);
  };
  return {
    mean:mean(values),lower:quantile(.025),upper:quantile(.975),
    unit:"percentage_points",
    note:"Descriptive percentile bootstrap resampling fixture seeds; no physical population coverage claim."
  };
}
function rowMean(rows,policy){
  return mean(rows.map(r=>r.outcomes[policy]));
}
function scenario(graph,outage,seed,trials,failures,budget){
  const base=runHeterogeneousResilience({graph,outage,seed,trials,failures,budget});
  const matched={
    matched_additive:selectMatchedPolicy(graph,seed,"matched_additive",budget),
    matched_harmonic:selectMatchedPolicy(graph,seed,"matched_harmonic",budget)
  };
  const protections={...base.protections,...matched};
  const rows=base.trialRows.map(trial=>{
    const outcomes={};
    for(const policy of HETERO_POLICIES)
      outcomes[policy]=trial.results[policy].servedFraction;
    for(const policy of ["matched_additive","matched_harmonic"]){
      outcomes[policy]=scoreProtectedTrial({
        graph,seed,attemptedFailedEdgeIds:trial.attemptedFailedEdgeIds,
        protectedEdgeIds:matched[policy].protectedIds
      }).servedFraction;
    }
    return {
      trial:trial.trial,outageSeed:trial.outageSeed,
      attemptedFailedEdgeIds:trial.attemptedFailedEdgeIds,
      outcomes
    };
  });
  const spent=Object.fromEntries(COHORT_POLICIES.map(policy=>
    [policy,protections[policy].spent]));
  const selectedCounts=Object.fromEntries(COHORT_POLICIES.map(policy=>
    [policy,protections[policy].protectedIds.length]));
  const averageServedFraction=Object.fromEntries(COHORT_POLICIES.map(policy=>
    [policy,rowMean(rows,policy)]));
  return {seed,trials,spent,selectedCounts,averageServedFraction,
    chosenEdgeIds:Object.fromEntries(COHORT_POLICIES.map(policy=>
      [policy,protections[policy].protectedIds])),
    pairedTrials:rows
  };
}
function summarizeFamily(rows,graph,outage,budget,baseSeed){
  const averageServedFraction=Object.fromEntries(COHORT_POLICIES.map(policy=>
    [policy,mean(rows.map(row=>row.averageServedFraction[policy]))]));
  const contrasts={};
  for(const comparator of COMPARATORS){
    const differences=rows.map(row=>
      100*(row.averageServedFraction.topology_risk-row.averageServedFraction[comparator]));
    const threshold=1e-9;
    contrasts[comparator]={
      ...seedClusterInterval(differences,{seed:(baseSeed+hash(graph+"|"+outage+"|"+comparator))>>>0}),
      seedsBetter:differences.filter(x=>x>threshold).length,
      seedsTied:differences.filter(x=>Math.abs(x)<=threshold).length,
      seedsWorse:differences.filter(x=>x<-threshold).length
    };
  }
  const funded=COHORT_POLICIES.filter(p=>p!=="unprotected");
  const winner=Object.keys(averageServedFraction)
    .filter(p=>funded.includes(p))
    .sort((a,b)=>averageServedFraction[b]-averageServedFraction[a]||
      a.localeCompare(b))[0];
  const budgetViolations=rows.reduce((sum,row)=>
    sum+funded.filter(policy=>row.spent[policy]>budget).length,0);
  return {graph,outage,fixtureSeedCount:rows.length,budget,
    averageServedFraction,leader: winner,
    allFundedPoliciesSpentBudget:rows.every(row=>
      funded.every(policy=>row.spent[policy]===budget)),
    budgetViolations,contrasts,seedRows:rows};
}
/** Fixed policies, frozen information and scenarios; no training or tuning.
 * Every seed changes the synthetic topology attributes and traffic demands.
 * Clustering by seed avoids pretending 8 outage trials are 8 independent networks.
 */
export function runE2R3({
  baseSeed=369,seedCount=8,trials=8,failures=26,budget=24,
  graphs=["A","B"],outages=["risk_weighted","regional_risk_weighted"]
}={}){
  if(!UINT(baseSeed)||!ISINT(seedCount,2,12)||!ISINT(trials,4,12)||
     !ISINT(failures,6,36)||!ISINT(budget,6,60))
    throw new TypeError("Invalid bounded E2-R3 cohort parameters.");
  if(!Array.isArray(graphs)||graphs.length<1||graphs.length>2||
     new Set(graphs).size!==graphs.length||graphs.some(x=>!["A","B"].includes(x)))
    throw new TypeError("Invalid graph set.");
  if(!Array.isArray(outages)||outages.length<1||outages.length>2||
     new Set(outages).size!==outages.length||
     outages.some(x=>!["risk_weighted","regional_risk_weighted"].includes(x)))
    throw new TypeError("Invalid outage set.");
  const seeds=Array.from({length:seedCount},(_,i)=>
    (baseSeed+Math.imul(i,7919))>>>0);
  const families=[];
  for(const graph of graphs)for(const outage of outages){
    const rows=seeds.map(seed=>scenario(graph,outage,seed,trials,failures,budget));
    families.push(summarizeFamily(rows,graph,outage,budget,baseSeed));
  }
  return {
    schema:COHORT_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
    authority:"NONE",action:"ANALYZE_ONLY",canRoute:false,
    canExecute:false,canAuthorize:false,
    frozenParameters:{baseSeed,seedCount,trials,failures,costCeiling:budget,
      graphs:[...graphs],outages:[...outages],fixtureSeeds:seeds,
      policies:[...COHORT_POLICIES]},
    families,
    notes:[
      "All comparisons are in silico. No physical mesh, light, network transport or quantum-state data.",
      "Matched-information policies use the same intact flow exposure, hazard weights and protection costs as topology_risk; only the scoring combination differs.",
      "No strategy inspects future failures. Each policy faces identical attempted failures for each fixed graph/seed/outage/trial.",
      "Equality is a cost ceiling. All-fund-spend equality is checked and reported, not assumed.",
      "Bootstrap intervals resample synthetic fixture SEEDS, not correlated within-seed outage trials. They do not provide real-world coverage probabilities.",
      "No p-values, post-hoc tuning, certainty of improvements, graph identities, or permission to alter E0 routing."
    ]
  };
}
