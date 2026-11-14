// E2-R5: simulated bridge-critical demand / failover research.
// Standalone read-only policy experiment; NEVER invokes PocketMesh E0 routing.
import {makeIrregularFixture,selectIrregularPolicies} from "./irregular-resilience.js";
import {evaluateIrregularSyntheticFixture} from "./heterogeneous-resilience.js";

export const FAILOVER_SCHEMA="NBGPocketMesh.E2R5.BridgeFailover.v1";
export const FAILOVER_FAMILIES=Object.freeze([
  ["modular","bridge_attack"],
  ["modular","nonbridge_control"],
  ["preferential","nonbridge_control"]
]);
export const FAILOVER_POLICIES=Object.freeze([
  "bridge_guard","centrality_risk","exposure_risk","risk_only","random","unprotected"
]);
export const FAILOVER_MODES=Object.freeze(["static","repair","full"]);
const N=47,EPS=1e-10;
const validInt=(v,low,high)=>Number.isSafeInteger(v)&&v>=low&&v<=high;
const id=(a,b)=>Math.min(a,b)+"-"+Math.max(a,b);
function hash(value){
  let h=2166136261;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
function random(seed){
  let s=(seed>>>0)||0x6d2b79f5;
  return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
}
const average=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function adjacency(fixture,failed){
  const table=Array.from({length:N},()=>[]);
  const links=fixture.edges.filter(e=>!failed.has(e.id));
  links.forEach((e,i)=>{
    table[e.a].push({to:e.b,index:i});
    table[e.b].push({to:e.a,index:i});
  });
  for(const neighbors of table)neighbors.sort((a,b)=>a.to-b.to);
  return {links,table};
}
function reachableWithout(fixture,blockedId,start){
  const {table}=adjacency(fixture,new Set([blockedId]));
  const seen=new Uint8Array(N),queue=[start];seen[start]=1;
  for(let i=0;i<queue.length;i++)for(const {to} of table[queue[i]]){
    if(!seen[to]){seen[to]=1;queue.push(to);}
  }
  return seen;
}
/** Exact DFS graph bridge analysis, plus critical demand crossing each cut.
 * A demand is 'bridge-critical' iff removing some bridge disconnects its endpoints.
 */
export function analyzeBridgeDemand(fixture){
  if(!fixture||fixture.schema!=="NBGPocketMesh.E2R4.IrregularFixture.v1"||
     fixture.origin!=="SIMULATED"||fixture.authority!=="NONE"||
     fixture.nodes!==N||!Array.isArray(fixture.edges)||
     !Array.isArray(fixture.demands))
    throw new TypeError("Invalid E2-R5 synthetic fixture.");
  // Delegate full validation to the already bounded E2-R4 adapter.
  evaluateIrregularSyntheticFixture(fixture,[]);
  const {table,links}=adjacency(fixture,new Set());
  const tin=new Int32Array(N).fill(-1),low=new Int32Array(N);
  let timer=0;
  const bridgeIds=[];
  function dfs(vertex,parentIndex){
    tin[vertex]=low[vertex]=timer++;
    for(const {to,index} of table[vertex]){
      if(index===parentIndex)continue;
      if(tin[to]===-1){
        dfs(to,index);low[vertex]=Math.min(low[vertex],low[to]);
        if(low[to]>tin[vertex])bridgeIds.push(links[index].id);
      }else low[vertex]=Math.min(low[vertex],tin[to]);
    }
  }
  for(let i=0;i<N;i++)if(tin[i]===-1)dfs(i,-1);
  bridgeIds.sort();
  const bridgeCuts=bridgeIds.map(bridgeId=>{
    const edge=fixture.edges.find(e=>e.id===bridgeId);
    const side=reachableWithout(fixture,bridgeId,edge.a);
    const cross=fixture.demands.filter(d=>side[d.from]!==side[d.to]);
    return {id:bridgeId,
      componentSizes:[side.reduce((sum,x)=>sum+x,0),
        N-side.reduce((sum,x)=>sum+x,0)].sort((a,b)=>a-b),
      criticalDemandIds:cross.map(d=>d.id),
      criticalUnits:cross.reduce((sum,d)=>sum+d.units,0)};
  });
  const allCritical=new Set(bridgeCuts.flatMap(c=>c.criticalDemandIds));
  const totalCriticalUnits=fixture.demands.filter(d=>allCritical.has(d.id))
    .reduce((sum,d)=>sum+d.units,0);
  return {schema:"NBGPocketMesh.E2R5.BridgeDemandAnalysis.v1",
    origin:"SIMULATED",authority:"NONE",bridges:bridgeCuts,
    criticalDemandIds:[...allCritical].sort(),totalCriticalUnits,
    totalDemandUnits:fixture.demands.reduce((sum,d)=>sum+d.units,0),
    warning:"Bridge-critical means mathematical disconnection upon a cut; it does not establish measured priority, economic importance, or actual traffic behavior."};
}
function sortedSelection(fixture,policy,budget,bridges){
  const critical=new Map(bridges.bridges.map(b=>[b.id,b.criticalUnits]));
  const ranked=fixture.edges.map(e=>{
    const amount=critical.get(e.id)??0;
    return {
      id:e.id,cost:e.protectionCost,
      score:amount>0?100+amount+e.riskWeight/9:e.riskWeight/900,
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  // Exact-cost knapsack, chosen on intact graph only, no trial input.
  const dp=Array.from({length:budget+1},()=>null);
  dp[0]={value:0,ids:[]};
  for(const e of ranked)for(let cost=budget;cost>=e.cost;cost--){
    const prev=dp[cost-e.cost];if(!prev)continue;
    const value=prev.value+e.score;
    if(!dp[cost]||value>dp[cost].value+1e-12){
      dp[cost]={value,ids:[...prev.ids,e.id]};
    }
  }
  if(!dp[budget])throw new Error("Exact-cost bridge guard budget cannot be reached.");
  return {policy,spent:budget,protectedIds:dp[budget].ids.sort(),
    selectedBeforeOutage:true,
    method:"Bridge-cut demand importance, then synthetic relative hazard."};
}
export function chooseFailoverProtection(fixture,budget=24){
  if(!validInt(budget,8,36))throw new TypeError("Invalid exact-cost budget.");
  const bridges=analyzeBridgeDemand(fixture);
  const original=selectIrregularPolicies(fixture,budget);
  const selected=Object.fromEntries(FAILOVER_POLICIES.map(policy=>[
    policy,policy==="bridge_guard"?sortedSelection(fixture,policy,budget,bridges):
      {...original[policy],selectedBeforeOutage:true}
  ]));
  for(const policy of FAILOVER_POLICIES){
    const s=selected[policy],cost=new Map(fixture.edges.map(e=>[e.id,e.protectionCost]));
    const actual=s.protectedIds.reduce((sum,edge)=>sum+cost.get(edge),0);
    if(actual!==s.spent||s.spent!==(policy==="unprotected"?0:budget))
      throw new Error("Exact-spend fairness contract violated.");
  }
  return {bridgeAnalysis:bridges,selections:selected};
}
function shortestRoute({links,table},residual,src,dest,units){
  const distance=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1);
  const visited=new Uint8Array(N);distance[src]=0;
  for(let step=0;step<N;step++){
    let v=-1;
    for(let j=0;j<N;j++)if(!visited[j]&&
      (v<0||distance[j]<distance[v]-EPS||
      (Math.abs(distance[j]-distance[v])<=EPS&&j<v)))v=j;
    if(v<0||!Number.isFinite(distance[v]))break;
    if(v===dest)break;
    visited[v]=1;
    for(const {to:w,index} of table[v]){
      if(visited[w]||residual[index]<units)continue;
      const candidate=distance[v]+links[index].latency;
      if(candidate<distance[w]-EPS||
        (Math.abs(candidate-distance[w])<=EPS&&
          (prev[w]<0||v<links[prev[w]][links[prev[w]].a===w?"b":"a"]))){
        distance[w]=candidate;prev[w]=index;
      }
    }
  }
  if(!Number.isFinite(distance[dest]))return null;
  const path=[];let current=dest;
  for(let k=0;k<N&&current!==src;k++){
    const idx=prev[current];if(idx<0)return null;
    const edge=links[idx];
    path.push(edge.id);current=edge.a===current?edge.b:edge.a;
  }
  if(current!==src)throw new Error("Route reconstruction loop.");
  return {path:path.reverse(),latency:distance[dest]};
}
function allocate(fixture,failedIds){
  const {links,table}=adjacency(fixture,failedIds);
  const remaining=links.map(e=>e.capacity);
  const index=new Map(links.map((e,i)=>[e.id,i]));
  const assignments=[];
  for(const d of fixture.demands){
    const path=shortestRoute({links,table},remaining,d.from,d.to,d.units);
    if(path)for(const edgeId of path.path)remaining[index.get(edgeId)]-=d.units;
    assignments.push({id:d.id,from:d.from,to:d.to,units:d.units,
      path:path?.path??null,latency:path?.latency??null});
  }
  return assignments;
}
function repair(fixture,baseline,failedIds){
  const {links,table}=adjacency(fixture,failedIds);
  const remaining=links.map(e=>e.capacity);
  const index=new Map(links.map((e,i)=>[e.id,i]));
  const kept=new Map(),disrupted=[];
  // First keep ALL baseline placements whose exact paths are still alive.
  for(const a of baseline){
    if(a.path&&a.path.every(id=>index.has(id))){
      kept.set(a.id,a);
      for(const edgeId of a.path)remaining[index.get(edgeId)]-=a.units;
    }else if(a.path)disrupted.push(a);
  }
  // Repair only flows actually interrupted by failures; previously unserved
  // demand is not admitted, and no surviving route is disturbed.
  for(const d of disrupted){
    const next=shortestRoute({links,table},remaining,d.from,d.to,d.units);
    if(!next)continue;
    for(const edgeId of next.path)remaining[index.get(edgeId)]-=d.units;
    kept.set(d.id,{...d,path:next.path,latency:next.latency});
  }
  return baseline.map(a=>kept.get(a.id)??{...a,path:null,latency:null});
}
function summary(fixture,analysis,assignments,baseline,mode){
  const critical=new Set(analysis.criticalDemandIds);
  let served=0,criticalServed=0,recoveredUnits=0,retainedUnits=0,delaySum=0;
  const original=new Map(baseline.map(a=>[a.id,a]));
  for(const a of assignments){
    if(!a.path)continue;
    served+=a.units;delaySum+=a.latency*a.units;
    if(critical.has(a.id))criticalServed+=a.units;
    const first=original.get(a.id);
    if(first?.path&&first.path.join(",")!==a.path.join(","))recoveredUnits+=a.units;
    if(first?.path&&first.path.join(",")===a.path.join(","))retainedUnits+=a.units;
  }
  return {mode,
    requestedUnits:analysis.totalDemandUnits,
    servedUnits:served,servedFraction:served/analysis.totalDemandUnits,
    criticalRequestedUnits:analysis.totalCriticalUnits,
    criticalServedUnits:criticalServed,
    criticalServedFraction:analysis.totalCriticalUnits?
      criticalServed/analysis.totalCriticalUnits:null,
    recoveredViaDifferentPathUnits:recoveredUnits,retainedBaselinePathUnits:retainedUnits,
    meanServedLatency:served?delaySum/served:null};
}
function evaluateModes(fixture,analysis,baseline,removed){
  const failed=new Set(removed);
  const keep=baseline.map(a=>a.path&&a.path.every(id=>!failed.has(id))?
    a:{...a,path:null,latency:null});
  const repaired=repair(fixture,baseline,failed);
  const full=allocate(fixture,failed);
  const result={
    static:summary(fixture,analysis,keep,baseline,"static"),
    repair:summary(fixture,analysis,repaired,baseline,"repair"),
    full:summary(fixture,analysis,full,baseline,"full")
  };
  // Cross-check the full reroute against the already-tested E2-R2 model.
  const reference=evaluateIrregularSyntheticFixture(fixture,removed);
  if(Math.abs(reference.servedFraction-result.full.servedFraction)>1e-9||
    reference.servedUnits!==result.full.servedUnits)
    throw new Error("Full failover recomputation deviates from frozen E2-R2 evaluator.");
  if(result.repair.servedUnits+1e-9<result.static.servedUnits)
    throw new Error("Repair cannot reduce static service.");
  return result;
}
function weightedSample(pool,seed,count){
  if(count>pool.length)throw new Error("Not enough eligible outage links.");
  const rng=random(seed^0x23f1a);
  return pool.map(e=>({
    id:e.id,priority:-Math.log(Math.max(rng(),1/4294967296))/e.riskWeight
  })).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))
    .slice(0,count).map(e=>e.id);
}
function attemptedFailures(fixture,analysis,outage,seed,count){
  const bridgeSet=new Set(analysis.bridges.map(x=>x.id));
  const nonbridges=fixture.edges.filter(e=>!bridgeSet.has(e.id));
  if(outage==="nonbridge_control")
    return weightedSample(nonbridges,seed,count).sort();
  if(outage!=="bridge_attack"||analysis.bridges.length===0)
    throw new TypeError("Bridge attack requires a bridge-containing graph.");
  // One targeted known structural cut, other failures drawn from nonbridges.
  const target=analysis.bridges[seed%analysis.bridges.length].id;
  return [target,...weightedSample(nonbridges,seed,count-1)].sort();
}
function aggregate(seedRows,policy,mode,field){
  const values=seedRows.map(row=>{
    const perTrial=row.trials.map(t=>t.outcomes[policy][mode][field]);
    // Absent bridge-dependent demand means UNDEFINED, not a numeric zero.
    // Never coerce null into 0 via JavaScript addition before checking.
    if(perTrial.some(v=>v===null||!Number.isFinite(v)))return null;
    return average(perTrial);
  });
  if(values.some(v=>v===null||!Number.isFinite(v)))return null;
  return average(values);
}
export function runBridgeFailover({
  baseSeed=369,seeds=4,trials=4,attempts=12,budget=24,
  families=FAILOVER_FAMILIES
}={}){
  if(!validInt(baseSeed,0,0xffffffff)||!validInt(seeds,2,8)||
    !validInt(trials,2,8)||!validInt(attempts,6,24)||
    !validInt(budget,8,36)||!Array.isArray(families)||
    families.length<1||families.length>3||
    families.some(f=>!Array.isArray(f)||f.length!==2||
      !FAILOVER_FAMILIES.some(g=>g[0]===f[0]&&g[1]===f[1]))||
    new Set(families.map(f=>f.join("/"))).size!==families.length)
    throw new TypeError("Invalid bounded bridge failover configuration.");
  const fixtureSeeds=Array.from({length:seeds},(_,i)=>
    (baseSeed+Math.imul(i,7919))>>>0);
  const scenarios=[];
  for(const [family,outage] of families){
    const seedRows=[];
    for(const seed of fixtureSeeds){
      const fixture=makeIrregularFixture(family,seed);
      const {bridgeAnalysis,selections}=chooseFailoverProtection(fixture,budget);
      if(family==="modular"&&bridgeAnalysis.bridges.length!==2)
        throw new Error("Modular fixture lost a structural bridge.");
      if(family==="preferential"&&bridgeAnalysis.bridges.length!==0)
        throw new Error("Hub fixture unexpectedly contains a bridge.");
      const baseline=allocate(fixture,new Set());
      const baseSummary=summary(fixture,bridgeAnalysis,baseline,baseline,"intact");
      const trialRows=[];
      for(let t=0;t<trials;t++){
        const trialSeed=(seed+Math.imul(t+1,15427)+hash(family+"/"+outage))>>>0;
        const failures=attemptedFailures(fixture,bridgeAnalysis,outage,trialSeed,attempts);
        const outcomes={};
        for(const policy of FAILOVER_POLICIES){
          const selected=selections[policy];
          const protectedSet=new Set(selected.protectedIds);
          const removed=failures.filter(id=>!protectedSet.has(id));
          const affectedBridges=removed.filter(id=>
            bridgeAnalysis.bridges.some(b=>b.id===id));
          outcomes[policy]={
            protectionSpent:selected.spent,
            protectedCount:selected.protectedIds.length,
            preventedFailureAttempts:attempts-removed.length,
            removedEdgeCount:removed.length,
            removedBridges:affectedBridges,
            ...evaluateModes(fixture,bridgeAnalysis,baseline,removed)
          };
        }
        trialRows.push({trial:t+1,trialSeed,attemptedFailedEdgeIds:failures,outcomes});
      }
      seedRows.push({seed,graphMetrics:fixture.graphMetrics,
        bridgeAnalysis,baseSummary,
        selectedProtection:Object.fromEntries(FAILOVER_POLICIES.map(policy=>
          [policy,selections[policy].protectedIds])),
        trials:trialRows});
    }
    const byPolicy=Object.fromEntries(FAILOVER_POLICIES.map(policy=>[
      policy,Object.fromEntries(FAILOVER_MODES.map(mode=>[mode,{
        meanServedFraction:aggregate(seedRows,policy,mode,"servedFraction"),
        meanCriticalServedFraction:aggregate(seedRows,policy,mode,
          "criticalServedFraction"),
        meanRecoveredViaDifferentPathUnits:aggregate(seedRows,policy,mode,
          "recoveredViaDifferentPathUnits")
      }]))
    ]));
    const criticalTotal=seedRows.reduce((total,row)=>
      total+row.bridgeAnalysis.totalCriticalUnits,0);
    const primary=criticalTotal>0?"meanCriticalServedFraction":"meanServedFraction";
    const funded=FAILOVER_POLICIES.filter(p=>p!=="unprotected");
    const best=Math.max(...funded.map(p=>byPolicy[p].full[primary]));
    const leaders=funded.filter(p=>Math.abs(byPolicy[p].full[primary]-best)<=1e-12);
    const leader=leaders[0];
    scenarios.push({
      family,outage,primaryMetric:primary,leader,leaders,
      allFundedExactSpend:seedRows.every(row=>row.trials.every(t=>
        FAILOVER_POLICIES.filter(p=>p!=="unprotected")
          .every(p=>t.outcomes[p].protectionSpent===budget))),
      byPolicy,seedRows
    });
  }
  return {
    schema:FAILOVER_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
    authority:"NONE",action:"ANALYZE_ONLY",
    canRoute:false,canExecute:false,canAuthorize:false,
    settings:{baseSeed,seeds,trials,attempts,budget,fixtureSeeds,
      scenarioFamilies:families.map(x=>[...x]),policies:[...FAILOVER_POLICIES],
      modes:[...FAILOVER_MODES]},
    scenarios,
    limitations:[
      "Only 47-node synthetic classical networks, costs, relative hazards, demand and outages.",
      "Bridge-critical means graph-theoretically dependent on at least one cut edge; not human-assigned priority.",
      "The bridge-attack family purposely targets one known cut edge, favoring bridge-aware protection by design. The nonbridge family is a negative control.",
      "Repair-only keeps surviving baseline allocations, then tries only interrupted previously served flows. Full recompute reallocates all flows from scratch in fixed order.",
      "Neither failover mode measures controller convergence time, packets, bandwidth over time, security, optical quantum states or actual hardware.",
      "All funded policies have exactly equal synthetic spend; strategy information access is NOT matched because bridge guard knows structural cuts.",
      "No real network execution, routing or authorization; the E0 router and signed trust gates are unchanged."
    ]
  };
}
