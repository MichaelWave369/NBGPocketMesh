// E2-R: offline, synthetic link-protection experiment. NEVER routes live traffic.
// Fixed graph fixture; preselected protection sets do not inspect held-out outages.
import {ringGraph,validateGraph} from "./topology-keyhole.js";

export const RESILIENCE_SCHEMA="NBGPocketMesh.E2R.Resilience.v1";
export const POLICIES=Object.freeze(["topology","degree","random","unprotected"]);
export const OUTAGES=Object.freeze(["uniform","regional"]);
const N=47;
const key=(a,b)=>Math.min(a,b)+"-"+Math.max(a,b);
const isUInt=x=>Number.isSafeInteger(x)&&x>=0;
function random(seed){
  let state=(seed>>>0)||0x6d2b79f5;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
}
function shuffled(input,seed){
  const out=[...input],next=random(seed);
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(next()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function tieHash(str,seed){
  let h=(0x811c9dc5^(seed>>>0))>>>0;
  for(let i=0;i<str.length;i++)h=Math.imul((h^str.charCodeAt(i))>>>0,0x01000193)>>>0;
  return h>>>0;
}
function adjacencies(graph){
  const adj=Array.from({length:N},()=>[]);
  for(const [a,b] of graph.edges){
    const id=key(a,b);
    adj[a].push({to:b,id});adj[b].push({to:a,id});
  }
  for(const entries of adj)entries.sort((a,b)=>a.to-b.to);
  return adj;
}
/** Exact unweighted Brandes edge betweenness for the supplied small graph. */
export function edgeBetweenness(input){
  const graph=validateGraph(input),adj=adjacencies(graph);
  const scores=new Map(graph.edges.map(([a,b])=>[key(a,b),0]));
  for(let s=0;s<N;s++){
    const distance=new Int32Array(N).fill(-1),sigma=new Float64Array(N);
    const preds=Array.from({length:N},()=>[]);
    const queue=[s],stack=[];
    sigma[s]=1;distance[s]=0;
    for(let qi=0;qi<queue.length;qi++){
      const v=queue[qi];stack.push(v);
      for(const {to:w,id} of adj[v]){
        if(distance[w]<0){distance[w]=distance[v]+1;queue.push(w);}
        if(distance[w]===distance[v]+1){
          sigma[w]+=sigma[v];preds[w].push({from:v,id});
        }
      }
    }
    const delta=new Float64Array(N);
    while(stack.length){
      const w=stack.pop();
      for(const {from:v,id} of preds[w]){
        const contribution=(sigma[v]/sigma[w])*(1+delta[w]);
        scores.set(id,scores.get(id)+contribution);
        delta[v]+=contribution;
      }
    }
  }
  // Every unordered source/target pair was counted in both orientations.
  for(const [id,score] of scores)scores.set(id,score/2);
  return scores;
}
export function protectionSet(input,policy,budget=12){
  const graph=validateGraph(input);
  if(!POLICIES.includes(policy))throw new TypeError("Unknown protection policy.");
  if(!isUInt(budget)||budget>20)throw new TypeError("Protection budget must be 0..20.");
  if(policy==="unprotected")return [];
  const degrees=new Int32Array(N);
  for(const [a,b] of graph.edges){degrees[a]++;degrees[b]++;}
  const topo=policy==="topology"?edgeBetweenness(graph):null;
  const pairs=graph.edges.map(([a,b])=>{
    const id=key(a,b);
    return {id,score:policy==="topology"?topo.get(id):
      policy==="degree"?degrees[a]+degrees[b]:0,
      tie:tieHash(id,policy==="degree"?81291:policy==="random"?91733:369)};
  });
  pairs.sort((a,b)=>b.score-a.score || a.tie-b.tie || a.id.localeCompare(b.id));
  return pairs.slice(0,budget).map(p=>p.id).sort();
}
function routeStats(graph){
  const adj=adjacencies(graph),total=N*(N-1)/2;
  let sum=0,missing=0;
  for(let s=0;s<N;s++){
    const dist=new Int16Array(N).fill(-1),queue=[s];dist[s]=0;
    for(let qi=0;qi<queue.length;qi++){
      const v=queue[qi];
      for(const {to:w} of adj[v])if(dist[w]===-1){
        dist[w]=dist[v]+1;queue.push(w);
      }
    }
    for(let t=s+1;t<N;t++){
      if(dist[t]===-1){missing++;sum+=N;}
      else sum+=dist[t];
    }
  }
  return {pairCount:total,unreachablePairs:missing,
    pairReachability:(total-missing)/total,meanPenalizedHops:sum/total};
}
function outageEdges(graph,mode,seed,count){
  const list=graph.edges.map(([a,b])=>key(a,b));
  if(mode==="uniform")return shuffled(list,seed).slice(0,count);
  const windowStart=Math.floor(random(seed)()*N);
  const near=i=>(i-windowStart+N)%N<8;
  const region=graph.edges.filter(([a,b])=>near(a)||near(b)).map(([a,b])=>key(a,b));
  if(region.length<count)throw new Error("Regional outage fixture too small.");
  return shuffled(region,seed^0x9e3779b9).slice(0,count);
}
function damagedGraph(graph,failures,protectedEdges){
  const failed=new Set(failures),protectedIds=new Set(protectedEdges);
  return validateGraph({...graph,edges:graph.edges.filter(([a,b])=>
    !failed.has(key(a,b))||protectedIds.has(key(a,b)))});
}
function mean(rows,k){
  return rows.reduce((sum,row)=>sum+row[k],0)/rows.length;
}
/** Evaluate every policy against the EXACT same predeclared outage trials. */
export function runResilience({
  graph="A",outage="uniform",trials=24,failures=20,budget=12,seed=369
}={}){
  if(!["A","B"].includes(graph)||!OUTAGES.includes(outage))throw new TypeError("Unknown graph or outage fixture.");
  if(!isUInt(trials)||trials<4||trials>40)throw new TypeError("Trials must be 4..40.");
  if(!isUInt(failures)||failures<1||failures>40)throw new TypeError("Failures must be 1..40.");
  if(!isUInt(budget)||budget<1||budget>20)throw new TypeError("Budget must be 1..20.");
  if(!isUInt(seed)||seed>4294967295)throw new TypeError("Seed must be a uint32.");
  const g=ringGraph(graph==="A"?[1,2,3,4]:[1,2,3,5]);
  const intact=routeStats(g);
  const selected=Object.fromEntries(POLICIES.map(p=>[p,protectionSet(g,p,budget)]));
  const trialRows=[];
  for(let i=0;i<trials;i++){
    const sampleSeed=(seed+Math.imul(7919,i)+ (graph==="A"?0:13027))>>>0;
    const outages=outageEdges(g,outage,sampleSeed,failures);
    const results={};
    for(const policy of POLICIES){
      const remaining=damagedGraph(g,outages,selected[policy]);
      const stats=routeStats(remaining);
      const saved=outages.filter(id=>selected[policy].includes(id)).length;
      results[policy]={
        protectedCount:selected[policy].length,
        failedEdges:failures-saved,savedFailures:saved,
        ...stats,
        meanPenalizedHopInflation:stats.meanPenalizedHops-intact.meanPenalizedHops
      };
    }
    trialRows.push({trial:i+1,seed:sampleSeed,outages,results});
  }
  const summary=Object.fromEntries(POLICIES.map(policy=>{
    const rows=trialRows.map(t=>t.results[policy]);
    return [policy,{
      protectionBudget:selected[policy].length,
      meanFailedEdges:mean(rows,"failedEdges"),
      meanSavedFailures:mean(rows,"savedFailures"),
      meanPairReachability:mean(rows,"pairReachability"),
      meanUnreachablePairs:mean(rows,"unreachablePairs"),
      meanPenalizedHops:mean(rows,"meanPenalizedHops"),
      meanPenalizedHopInflation:mean(rows,"meanPenalizedHopInflation")
    }];
  }));
  return {
    schema:RESILIENCE_SCHEMA,
    origin:"SIMULATED",authority:"NONE",privacy:"public-synthetic",
    action:"ANALYZE_ONLY",canRoute:false,canExecute:false,canAuthorize:false,
    description:"Offline unweighted shortest-hop network impairment with preselected protection.",
    settings:{graph,outage,trials,failures,budget,seed,
      graphNodes:N,originalEdges:g.edges.length,
      protectionChosenBeforeOutages:true,
      disconnectedPairPenaltyHops:N},
    intact,
    protectedEdgeIds:selected,
    summary,trialRows,
    warnings:[
      "No live network or physical outage is measured. Edge weights are deliberately ignored by the hop evaluator.",
      "Policies have equal protection budgets except the explicit unprotected reference.",
      "Degree scores tie on eight-regular graphs; a seeded hash breaks ties, so degree and random controls may be similar.",
      "Outages use synthetic uniform or vertex-label regional stress, not calibrated hardware failure probabilities.",
      "Centrality is computed on intact topology before failures; outcomes are paired on identical scenario seeds.",
      "A low hop inflation is not a routing speedup, learned capability, security guarantee, quantum invariant or production reliability claim."
    ]
  };
}
