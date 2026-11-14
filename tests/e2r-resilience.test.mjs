import test from "node:test";
import assert from "node:assert/strict";
import {ringGraph} from "../site/src/topology-keyhole.js";
import {
  edgeBetweenness,protectionSet,runResilience,RESILIENCE_SCHEMA,POLICIES
} from "../site/src/link-resilience.js";

test("unweighted Brandes centrality returns finite nonnegative score on every edge",()=>{
  for(const offsets of [[1,2,3,4],[1,2,3,5]]){
    const g=ringGraph(offsets),scores=edgeBetweenness(g);
    assert.equal(scores.size,188);
    assert.ok([...scores.values()].every(v=>Number.isFinite(v)&&v>=0));
    // Connected graph: all ordered vertex pairs are accounted for by shortest path dependency.
    const total=[...scores.values()].reduce((s,v)=>s+v,0);
    assert.ok(total>47*46/2);
  }
});
test("same-budget protection is selected before outcomes; controls are independent",()=>{
  const g=ringGraph();
  const lists=POLICIES.map(p=>protectionSet(g,p,12));
  assert.deepEqual(lists.map(x=>x.length),[12,12,12,0]);
  for(const p of lists){
    assert.equal(p.length,new Set(p).size);
    assert.deepEqual(p,[...p].sort());
  }
  assert.deepEqual(protectionSet(g,"topology",12),lists[0]);
  assert.notDeepEqual(lists[0],lists[2]);
});
test("paired outage benchmark deterministic with no fabricated authority",()=>{
  const config={graph:"A",outage:"uniform",trials:6,failures:24,budget:12,seed:369};
  const a=runResilience(config),b=runResilience(config);
  assert.deepEqual(a,b);
  assert.equal(a.schema,RESILIENCE_SCHEMA);
  assert.equal(a.action,"ANALYZE_ONLY");
  assert.equal(a.canRoute,false);
  assert.equal(a.canExecute,false);
  assert.equal(a.canAuthorize,false);
  assert.equal(a.trialRows.length,6);
  assert.equal(a.intact.unreachablePairs,0);
  assert.equal(a.intact.pairCount,1081);
  for(const trial of a.trialRows){
    assert.equal(trial.outages.length,24);
    assert.equal(new Set(trial.outages).size,24);
    for(const policy of POLICIES){
      const x=trial.results[policy];
      assert.ok(x.failedEdges<=24 && x.failedEdges>=0);
      assert.equal(x.savedFailures+x.failedEdges,24);
      assert.ok(x.meanPenalizedHopInflation>=-1e-10);
      assert.ok(x.pairReachability>=0&&x.pairReachability<=1);
      assert.equal(x.protectedCount,policy==="unprotected"?0:12);
    }
    assert.equal(trial.results.unprotected.failedEdges,24);
    assert.equal(trial.results.unprotected.savedFailures,0);
  }
});
test("regional and uniform outages use the same scenario samples for every policy",()=>{
  for(const graph of ["A","B"])for(const outage of ["uniform","regional"]){
    const out=runResilience({graph,outage,trials:4,failures:20,budget:8,seed:2026});
    for(const trial of out.trialRows){
      assert.equal(trial.outages.length,20);
      assert.equal(new Set(trial.outages).size,20);
    }
    for(const policy of ["topology","degree","random"]){
      assert.equal(out.summary[policy].protectionBudget,8);
    }
    assert.equal(out.summary.unprotected.protectionBudget,0);
  }
});
test("a no-failure or an over-budget scenario refuses instead of quietly substituting",()=>{
  for(const patch of [
    {graph:"C"},{outage:"quantum"},{trials:1},{trials:41},
    {failures:0},{failures:41},{budget:0},{budget:21},
    {seed:-1},{seed:2**32}
  ])assert.throws(()=>runResilience({...patch}),/Unknown|Trials|Failures|Budget|Seed/);
  assert.throws(()=>protectionSet(ringGraph(),"oracle",10),/policy/);
  assert.throws(()=>protectionSet(ringGraph(),"topology",50),/budget/);
});
test("damaged graph control cannot beat intact hop distances in an unweighted path model",()=>{
  const out=runResilience({graph:"B",outage:"regional",trials:5,failures:36,budget:10});
  for(const summary of Object.values(out.summary)){
    assert.ok(summary.meanPenalizedHops>=out.intact.meanPenalizedHops-1e-10);
    assert.ok(summary.meanUnreachablePairs>=0);
  }
});
