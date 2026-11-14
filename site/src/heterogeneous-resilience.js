// E2-R2: synthetic, offline heterogeneous link-protection benchmark.
// Read-only research ONLY: no networking, E0 routing, permissions or ML execution.
import {ringGraph} from "./topology-keyhole.js";

export const HETERO_SCHEMA="NBGPocketMesh.E2R2.Heterogeneous.v1";
export const HETERO_POLICIES=Object.freeze([
  "topology_risk","demand_only","risk_only","capacity_only","random","unprotected"
]);
export const HETERO_OUTAGES=Object.freeze(["risk_weighted","regional_risk_weighted"]);
const N=47,DISCONNECT_PENALTY=100,EPS=1e-10;
const finiteInt=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const edgeId=(a,b)=>Math.min(a,b)+"-"+Math.max(a,b);
function hash(value){
  let h=0x811c9dc5;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),0x01000193)>>>0;
  return h>>>0;
}
function random(seed){
  let x=(seed>>>0)||0x6d2b79f5;
  return ()=>{
    x^=x<<13;x^=x>>>17;x^=x<<5;
    return (x>>>0)/4294967296;
  };
}
function assertConfig({graph,outage,trials,failures,budget,seed}){
  if(!["A","B"].includes(graph)||!HETERO_OUTAGES.includes(outage))
    throw new TypeError("Unsupported synthetic graph or outage type.");
  if(!finiteInt(trials,4,40))throw new TypeError("Trials must be 4..40.");
  if(!finiteInt(failures,6,36))throw new TypeError("Failures must be 6..36.");
  if(!finiteInt(budget,6,60))throw new TypeError("Cost budget must be 6..60.");
  if(!finiteInt(seed,0,0xffffffff))throw new TypeError("Seed must be an unsigned 32-bit integer.");
}
export function heterogeneousFixture(graph="A",seed=369){
  if(!["A","B"].includes(graph)||!finiteInt(seed,0,0xffffffff))
    throw new TypeError("Unsupported fixture or seed.");
  const topology=ringGraph(graph==="A"?[1,2,3,4]:[1,2,3,5]);
  const edges=topology.edges.map(([a,b])=>{
    const h=hash("ATTR|"+seed+"|"+edgeId(a,b));
    return {
      id:edgeId(a,b),a,b,
      latency:1+(h%7), // synthetic hop-delay units
      capacity:2+((h>>>5)%8), // whole flow units, 2..9
      protectionCost:1+((h>>>11)%4), // abstract spend units, 1..4
      riskWeight:1+((h>>>17)%9) // outage sampling *weight*, not probability
    };
  });
  const demands=[];
  for(let i=0;i<N;i++)for(const shift of [9,21]){
    demands.push({id:"flow-"+i+"-"+shift,from:i,to:(i+shift)%N,
      units:1+(hash("DEMAND|"+seed+"|"+i+"|"+shift)%3)});
  }
  return {schema:"NBGPocketMesh.E2R2.Fixture.v1",origin:"SIMULATED",
    authority:"NONE",graph,seed,nodes:N,edges,demands};
}
function adjacency(links){
  const adj=Array.from({length:N},()=>[]);
  links.forEach((e,index)=>{
    adj[e.a].push({to:e.b,index});
    adj[e.b].push({to:e.a,index});
  });
  for(const list of adj)list.sort((a,b)=>a.to-b.to);
  return adj;
}
function bestPath(adj,links,src,dest,units,residual=null){
  const dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1);
  const used=new Uint8Array(N);dist[src]=0;
  for(let step=0;step<N;step++){
    let v=-1;
    for(let i=0;i<N;i++)if(!used[i]&&(v<0||dist[i]<dist[v]-EPS||
      (Math.abs(dist[i]-dist[v])<=EPS&&i<v)))v=i;
    if(v<0||!Number.isFinite(dist[v]))break;
    if(v===dest)break;
    used[v]=1;
    for(const {to:w,index} of adj[v]){
      if(used[w]||(residual!==null&&residual[index]<units))continue;
      const d=dist[v]+links[index].latency;
      if(d<dist[w]-EPS || (Math.abs(d-dist[w])<=EPS && (prev[w]<0||v<links[prev[w]][
        links[prev[w]].a===w?"b":"a"]))) {
        dist[w]=d;prev[w]=index;
      }
    }
  }
  if(!Number.isFinite(dist[dest]))return null;
  const path=[];let at=dest;
  for(let hops=0;at!==src&&hops<N;hops++){
    const index=prev[at];
    if(index<0)return null;
    const e=links[index];path.push(index);
    at=e.a===at?e.b:e.a;
  }
  if(at!==src)throw new Error("Path reconstruction exceeded vertex bound.");
  return {path:path.reverse(),latency:dist[dest]};
}
function routeDemand(fixture,failedIds=new Set(),recordExposure=false){
  const links=fixture.edges.filter(e=>!failedIds.has(e.id));
  const graph=adjacency(links);
  const residual=links.map(e=>e.capacity);
  let requested=0,served=0,penalized=0,servedLatencySum=0;
  const exposure=new Map(fixture.edges.map(e=>[e.id,0]));
  for(const demand of fixture.demands){
    requested+=demand.units;
    const routed=bestPath(graph,links,demand.from,demand.to,demand.units,residual);
    if(routed){
      served+=demand.units;servedLatencySum+=routed.latency*demand.units;
      penalized+=routed.latency*demand.units;
      for(const idx of routed.path){
        residual[idx]-=demand.units;
        if(recordExposure)exposure.set(links[idx].id,exposure.get(links[idx].id)+demand.units);
      }
    }else penalized+=DISCONNECT_PENALTY*demand.units;
  }
  return {requestedUnits:requested,servedUnits:served,
    servedFraction:served/requested,
    meanPenalizedLatency:penalized/requested,
    meanServedLatency:served>0?servedLatencySum/served:null,
    exposure};
}
// A route's modeled capacity is decremented after accepting each whole flow;
// demand order is frozen, and neither splitting nor congestion optimization occurs.
function protectionScores(fixture,policy){
  const exposure=routeDemand(fixture,new Set(),true).exposure;
  return fixture.edges.map(e=>{
    const usage=exposure.get(e.id),price=e.protectionCost;
    const value=policy==="topology_risk"?usage*e.riskWeight/price:
      policy==="demand_only"?usage/price:
      policy==="risk_only"?e.riskWeight/price:
      policy==="capacity_only"?e.capacity*e.riskWeight/price:
      hash("RANDOM|"+fixture.seed+"|"+e.id)/4294967296;
    return {id:e.id,price,value,
      tie:hash("TIE|"+policy+"|"+fixture.seed+"|"+e.id)};
  });
}
export function chooseProtection(fixture,policy,budget){
  if(!fixture||fixture.schema!=="NBGPocketMesh.E2R2.Fixture.v1"||
    !HETERO_POLICIES.includes(policy)||!finiteInt(budget,0,60))
    throw new TypeError("Invalid protection policy, fixture or cost budget.");
  if(policy==="unprotected")return {policy,spent:0,protectedIds:[]};
  const ranked=protectionScores(fixture,policy).sort((a,b)=>
    b.value-a.value||a.tie-b.tie||a.id.localeCompare(b.id));
  const chosen=[];let spent=0;
  for(const e of ranked){
    if(spent+e.price>budget)continue;
    spent+=e.price;chosen.push(e.id);
  }
  return {policy,spent,protectedIds:chosen.sort()};
}
function drawFailures(fixture,outage,seed,count){
  let candidates=fixture.edges;
  if(outage==="regional_risk_weighted"){
    const start=Math.floor(random(seed^0x51ab9)()*N);
    const local=i=>(i-start+N)%N<8;
    candidates=candidates.filter(e=>local(e.a)||local(e.b));
  }
  if(candidates.length<count)throw new Error("Insufficient edges in outage region.");
  const next=random(seed^0x9e3779b9);
  // Weighted sampling without replacement via exponential race; a weight is
  // a relative fixture hazard, NOT a calibrated failure probability.
  return candidates.map(e=>({
    id:e.id,rank:-Math.log(Math.max(next(),1/4294967296))/e.riskWeight
  })).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id))
    .slice(0,count).map(v=>v.id).sort();
}
function average(rows,field){return rows.reduce((sum,r)=>sum+r[field],0)/rows.length;}
export function runHeterogeneousResilience({
  graph="A",outage="risk_weighted",trials=24,failures=26,budget=24,seed=369
}={}){
  assertConfig({graph,outage,trials,failures,budget,seed});
  const fixture=heterogeneousFixture(graph,seed);
  const intact=routeDemand(fixture);
  delete intact.exposure;
  const selected=Object.fromEntries(HETERO_POLICIES.map(policy=>
    [policy,chooseProtection(fixture,policy,budget)]));
  const trialRows=[];
  for(let trial=0;trial<trials;trial++){
    const outageSeed=(seed+Math.imul(7919,trial+1)+
      (outage==="risk_weighted"?0x91a:0x47b)+
      (graph==="A"?0:0x2783))>>>0;
    const attempted=drawFailures(fixture,outage,outageSeed,failures);
    const results={};
    for(const policy of HETERO_POLICIES){
      const protectedIds=new Set(selected[policy].protectedIds);
      const removed=attempted.filter(id=>!protectedIds.has(id));
      const measured=routeDemand(fixture,new Set(removed));
      delete measured.exposure;
      results[policy]={
        ...measured,remainingFailedEdges:removed.length,
        protectedFailureAttempts:failures-removed.length,
        incrementalPenalizedLatency:measured.meanPenalizedLatency-intact.meanPenalizedLatency
      };
    }
    trialRows.push({trial:trial+1,outageSeed,attemptedFailedEdgeIds:attempted,results});
  }
  const summary=Object.fromEntries(HETERO_POLICIES.map(policy=>{
    const rows=trialRows.map(r=>r.results[policy]);
    return [policy,{
      protectionCostSpent:selected[policy].spent,
      protectedLinkCount:selected[policy].protectedIds.length,
      meanServedFraction:average(rows,"servedFraction"),
      meanPenalizedLatency:average(rows,"meanPenalizedLatency"),
      meanIncrementalPenalizedLatency:average(rows,"incrementalPenalizedLatency"),
      meanRemainingFailedEdges:average(rows,"remainingFailedEdges"),
      meanProtectedFailureAttempts:average(rows,"protectedFailureAttempts")
    }];
  }));
  return {
    schema:HETERO_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
    authority:"NONE",action:"ANALYZE_ONLY",canRoute:false,
    canExecute:false,canAuthorize:false,
    settings:{graph,outage,trials,failures,costBudget:budget,seed,
      edges:fixture.edges.length,nodes:N,demandCount:fixture.demands.length,
      protectionChosenBeforeOutages:true,disconnectionPenalty:DISCONNECT_PENALTY},
    fixture,baselineIntact:intact,protections:selected,summary,trialRows,
    warnings:[
      "Fully synthetic weighted failure and flow model; no calibrated device, optical or network observations.",
      "Equal maximum cost budgets, not necessarily equal exact cost spend or protected edge counts.",
      "Topology+risk policy uses baseline-capacity route exposure times relative hazard divided by protection cost.",
      "Other controls are demand exposure only, relative hazard only, capacity×hazard, seeded random and unprotected.",
      "All policies encounter the exact same attempted failures within each paired trial.",
      "Flows use deterministic shortest-latency capacity-feasible greedy routing; no split flows or optimized congestion control.",
      "Relative hazard weights select a fixed failure count; they are not measured probabilities.",
      "No physical throughput, security, quantum entanglement, ML advantage, routing permission or real resilience established."
    ]
  };
}


// E2-R3 additive, audit-only adapters: preserve E2-R2 behavior and expose
// deterministic intact traffic exposure / outcomes for frozen policy ablations.
// They never authorize an action or accept an operator-supplied network.
export function inspectIntactExposure(graph="A",seed=369){
  const fixture=heterogeneousFixture(graph,seed);
  const observed=routeDemand(fixture,new Set(),true);
  return Object.fromEntries([...observed.exposure.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
}
export function scoreProtectedTrial({
  graph="A",seed=369,attemptedFailedEdgeIds,protectedEdgeIds
}={}){
  const fixture=heterogeneousFixture(graph,seed);
  const allowed=new Set(fixture.edges.map(e=>e.id));
  const check=ids=>Array.isArray(ids)&&ids.length<=fixture.edges.length&&
    ids.every(id=>typeof id==="string"&&allowed.has(id))&&
    new Set(ids).size===ids.length;
  if(!check(attemptedFailedEdgeIds)||!check(protectedEdgeIds))
    throw new TypeError("Invalid duplicate, unknown, or unbounded synthetic edge identifiers.");
  const protectedSet=new Set(protectedEdgeIds);
  const remaining=attemptedFailedEdgeIds.filter(id=>!protectedSet.has(id));
  const result=routeDemand(fixture,new Set(remaining));
  delete result.exposure;
  return {...result,remainingFailedEdges:remaining.length,
    protectedFailureAttempts:attemptedFailedEdgeIds.length-remaining.length};
}


// E2-R4 additive adapter: evaluate a strictly bounded, explicitly synthetic
// external fixture using the same greedy capacity-aware E2-R2 traffic engine.
// This NEVER changes E2-R2 fixtures, E0 routing, network state, or permissions.
export function evaluateIrregularSyntheticFixture(fixture,failedEdgeIds=[],recordExposure=false){
  if(!fixture||fixture.schema!=="NBGPocketMesh.E2R4.IrregularFixture.v1"||
    fixture.origin!=="SIMULATED"||fixture.authority!=="NONE"||
    fixture.nodes!==47||!Array.isArray(fixture.edges)||
    fixture.edges.length<46||fixture.edges.length>250||
    !Array.isArray(fixture.demands)||fixture.demands.length!==94||
    typeof recordExposure!=="boolean"||
    !Array.isArray(failedEdgeIds)||failedEdgeIds.length>fixture.edges.length)
    throw new TypeError("Invalid or unauthorized synthetic irregular fixture.");
  const known=new Set();
  for(const e of fixture.edges){
    if(!e||!Number.isSafeInteger(e.a)||!Number.isSafeInteger(e.b)||
       e.a<0||e.b<0||e.a>=47||e.b>=47||e.a===e.b||
       e.id!==edgeId(e.a,e.b)||known.has(e.id)||
       ![e.latency,e.capacity,e.protectionCost,e.riskWeight].every(Number.isFinite)||
       e.latency<1||e.latency>7||e.capacity<2||e.capacity>9||
       e.protectionCost<1||e.protectionCost>4||e.riskWeight<1||e.riskWeight>9)
      throw new TypeError("Invalid synthetic irregular edge.");
    known.add(e.id);
  }
  for(const d of fixture.demands){
    if(!d||!Number.isInteger(d.from)||!Number.isInteger(d.to)||
       d.from<0||d.to<0||d.from>=47||d.to>=47||d.from===d.to||
       !Number.isInteger(d.units)||d.units<1||d.units>3)
      throw new TypeError("Invalid synthetic irregular demand.");
  }
  if(failedEdgeIds.some(id=>!known.has(id))||
     new Set(failedEdgeIds).size!==failedEdgeIds.length)
    throw new TypeError("Invalid duplicate or unknown failure edge ID.");
  const m=routeDemand(fixture,new Set(failedEdgeIds),recordExposure);
  if(recordExposure)m.exposure=Object.fromEntries(m.exposure);
  else delete m.exposure;
  return m;
}
