// E2-R4: public-synthetic irregular 47-node network stress test.
// All policies select edges on the INTACT network, before paired failures.
// No live network, E0 router, authorizations, trained model or quantum link.
import {edgeBetweenness} from "./link-resilience.js";
import {evaluateIrregularSyntheticFixture} from "./heterogeneous-resilience.js";

export const IRREGULAR_SCHEMA="NBGPocketMesh.E2R4.IrregularStress.v1";
export const IRREGULAR_FAMILIES=Object.freeze(["preferential","modular"]);
export const IRREGULAR_OUTAGES=Object.freeze(["uniform_risk","localized_risk"]);
export const IRREGULAR_POLICIES=Object.freeze([
  "centrality_risk","exposure_risk","matched_additive","matched_harmonic",
  "degree_risk","capacity_risk","risk_only","random","unprotected"
]);
const FUNDED=IRREGULAR_POLICIES.filter(x=>x!=="unprotected");
const N=47,EPS=1e-10;
const inInt=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const id=(a,b)=>Math.min(a,b)+"-"+Math.max(a,b);
function hash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
function random(seed){
  let s=(seed>>>0)||0x6d2b79f5;
  return ()=>{
    s^=s<<13;s^=s>>>17;s^=s<<5;
    return (s>>>0)/4294967296;
  };
}
function graphEdges(family,seed){
  const edges=new Map();
  const degrees=new Int32Array(N);
  const put=(a,b)=>{
    if(a===b||a<0||b<0||a>=N||b>=N)return false;
    const k=id(a,b);
    if(edges.has(k))return false;
    const u=Math.min(a,b),v=Math.max(a,b);
    edges.set(k,[u,v]);degrees[u]++;degrees[v]++;
    return true;
  };
  if(family==="preferential"){
    // Seeded attachment from a 3-clique: hub-skewed, connected, non-regular.
    put(0,1);put(1,2);put(0,2);
    const rng=random(seed^0x1421d9);
    for(let v=3;v<N;v++){
      const required=2+(v%5===0?1:0);
      for(let j=0;j<required;j++){
        const candidates=[];
        let total=0;
        for(let u=0;u<v;u++)if(!edges.has(id(u,v))){
          total+=degrees[u]+1;candidates.push({u,cumulative:total});
        }
        if(!candidates.length)throw new Error("Attachment candidate exhaustion.");
        const roll=rng()*total;
        const target=candidates.find(c=>c.cumulative>roll)??candidates.at(-1);
        if(!put(v,target.u))throw new Error("Duplicate preferential link.");
      }
    }
  }else if(family==="modular"){
    // Three ring-like local communities, joined by exactly two bridges.
    // 4-neighbor rings create clusters without enforcing global degree-regularity.
    const starts=[0,15,31,47];
    for(let g=0;g<3;g++){
      const start=starts[g],size=starts[g+1]-start;
      for(let i=0;i<size;i++){
        put(start+i,start+(i+1)%size);
        put(start+i,start+(i+2)%size);
      }
    }
    put(2,16);put(24,34);
  }else throw new TypeError("Invalid irregular graph family.");
  return [...edges.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
function graphMetrics(edges){
  const neighbors=Array.from({length:N},()=>[]);
  for(const [a,b] of edges){neighbors[a].push(b);neighbors[b].push(a);}
  const deg=neighbors.map(x=>x.length);
  const seen=new Uint8Array(N),disc=new Int32Array(N).fill(-1);
  const low=new Int32Array(N);let clock=0,components=0,bridges=0;
  function visit(v,parent){
    seen[v]=1;disc[v]=low[v]=clock++;
    for(const w of neighbors[v]){
      if(w===parent)continue;
      if(!seen[w]){
        visit(w,v);low[v]=Math.min(low[v],low[w]);
        if(low[w]>disc[v])bridges++;
      }else low[v]=Math.min(low[v],disc[w]);
    }
  }
  for(let i=0;i<N;i++)if(!seen[i]){components++;visit(i,-1);}
  const averageDegree=deg.reduce((s,v)=>s+v,0)/N;
  const degreeVariance=deg.reduce((s,v)=>s+(v-averageDegree)**2,0)/N;
  return {nodes:N,edges:edges.length,components,
    minDegree:Math.min(...deg),maxDegree:Math.max(...deg),
    averageDegree,degreeVariance,bridgeCount:bridges,
    cycleRank:edges.length-N+components};
}
/** Exactly 47 nodes, real graph heterogeneity but fabricated attributes. */
export function makeIrregularFixture(family="preferential",seed=369){
  if(!IRREGULAR_FAMILIES.includes(family)||!inInt(seed,0,0xffffffff))
    throw new TypeError("Invalid irregular fixture options.");
  const base=graphEdges(family,seed),stats=graphMetrics(base);
  if(stats.components!==1||stats.degreeVariance<=0)
    throw new Error("Generated graph is not a connected heterogeneous fixture.");
  const edges=base.map(([a,b])=>{
    const h=hash("R4|ATTR|"+seed+"|"+id(a,b));
    return {id:id(a,b),a,b,
      latency:1+(h%7),capacity:2+((h>>>5)%8),
      protectionCost:1+((h>>>11)%4),
      riskWeight:1+((h>>>17)%9)};
  });
  const demands=[];
  for(let i=0;i<N;i++)for(const shift of [9,21])
    demands.push({id:"r4-flow-"+i+"-"+shift,from:i,
      to:(i+shift)%N,
      units:1+(hash("R4|DEMAND|"+seed+"|"+i+"|"+shift)%3)});
  return {
    schema:"NBGPocketMesh.E2R4.IrregularFixture.v1",
    origin:"SIMULATED",authority:"NONE",family,seed,nodes:N,
    graphMetrics:stats,edges,demands
  };
}
function scores(fixture){
  const graph={
    schema:"NBGPocketMesh.E2T.Graph.v1",
    origin:"SIMULATED",authority:"NONE",privacy:"public-synthetic",
    nodes:N,edges:fixture.edges.map(e=>[e.a,e.b,.5])
  };
  const centrality=edgeBetweenness(graph);
  const exposure=evaluateIrregularSyntheticFixture(fixture,[],true).exposure;
  const deg=new Int32Array(N);
  for(const e of fixture.edges){deg[e.a]++;deg[e.b]++;}
  const maxCentral=Math.max(1,...centrality.values());
  const maxExposure=Math.max(1,...Object.values(exposure));
  const maxDegree=Math.max(...deg)*2;
  return fixture.edges.map(e=>{
    const c=centrality.get(e.id)/maxCentral;
    const u=exposure[e.id]/maxExposure;
    const r=e.riskWeight/9;
    const d=(deg[e.a]+deg[e.b])/maxDegree;
    const cap=e.capacity/9;
    return {id:e.id,cost:e.protectionCost,values:{
      centrality_risk:c*r,
      exposure_risk:u*r,
      matched_additive:(u+r)/2,
      matched_harmonic:u+r===0?0:2*u*r/(u+r),
      degree_risk:d*r,
      capacity_risk:cap*r,
      risk_only:r,
      random:hash("R4|RANDOM|"+fixture.seed+"|"+e.id)/4294967296
    }};
  });
}
/** Exact-cost 0/1 knapsack: every funded policy must spend EXACTLY the same
 * synthetic amount. No policy looks at future outage selections.
 */
export function selectIrregularPolicies(fixture,budget=24){
  if(!fixture||fixture.schema!=="NBGPocketMesh.E2R4.IrregularFixture.v1"||
    fixture.origin!=="SIMULATED"||fixture.authority!=="NONE"||
    !inInt(budget,6,48))throw new TypeError("Invalid bounded protection fixture or budget.");
  const scored=scores(fixture).sort((a,b)=>a.id.localeCompare(b.id));
  const selections={};
  for(const policy of FUNDED){
    const dp=new Array(budget+1).fill(null);
    dp[0]={score:0,ids:[]};
    for(const edge of scored){
      for(let money=budget;money>=edge.cost;money--){
        const prev=dp[money-edge.cost];if(!prev)continue;
        const candidate=prev.score+edge.values[policy];
        if(!dp[money]||candidate>dp[money].score+1e-12){
          dp[money]={score:candidate,ids:[...prev.ids,edge.id]};
        }
      }
    }
    if(!dp[budget])throw new Error("Exact synthetic cost budget unreachable.");
    selections[policy]={
      policy,spent:budget,
      protectedIds:dp[budget].ids.sort(),
      plannedWithoutFailureKnowledge:true
    };
  }
  selections.unprotected={policy:"unprotected",spent:0,
    protectedIds:[],plannedWithoutFailureKnowledge:true};
  return selections;
}
function weightedOutage(fixture,mode,seed,count){
  if(!IRREGULAR_OUTAGES.includes(mode)||!inInt(seed,0,0xffffffff)||
    !inInt(count,6,30))throw new TypeError("Invalid synthetic outage settings.");
  let pool=fixture.edges;
  if(mode==="localized_risk"){
    const start=Math.floor(random(seed^0x4e77c)()*N);
    const region=i=>(i-start+N)%N<18;
    pool=pool.filter(e=>region(e.a)||region(e.b));
  }
  if(pool.length<count)throw new Error("Outage region has too few eligible links.");
  const rng=random(seed^0x95f4a);
  return pool.map(e=>({
    id:e.id,priority:-Math.log(Math.max(rng(),1/4294967296))/e.riskWeight
  })).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))
    .slice(0,count).map(e=>e.id).sort();
}
function mean(x){return x.reduce((s,v)=>s+v,0)/x.length;}
function bootstrap(diff,seed){
  if(diff.length<2)throw new TypeError("At least two fixture seeds required.");
  const rng=random(seed),n=diff.length,values=[];
  for(let k=0;k<400;k++){
    let total=0;
    for(let j=0;j<n;j++)total+=diff[Math.floor(rng()*n)];
    values.push(total/n);
  }
  values.sort((a,b)=>a-b);
  function percentile(p){
    const pos=p*(values.length-1),lo=Math.floor(pos),hi=Math.ceil(pos);
    return values[lo]+(pos-lo)*(values[hi]-values[lo]);
  }
  return {mean:mean(diff),lower:percentile(.025),upper:percentile(.975),
    better:diff.filter(v=>v>1e-9).length,
    tied:diff.filter(v=>Math.abs(v)<=1e-9).length,
    worse:diff.filter(v=>v<-1e-9).length,
    unit:"percentage_points",
    boundary:"Synthetic fixture-seed percentile bootstrap ONLY; no physical-network CI."};
}
/** Fixed paired trials over two irregular graph families and weighted hazards. */
export function runIrregularStress({
  baseSeed=369,seeds=4,trials=4,failures=20,budget=24,
  families=["preferential","modular"],
  outages=["uniform_risk","localized_risk"]
}={}){
  if(!inInt(baseSeed,0,0xffffffff)||!inInt(seeds,2,8)||
    !inInt(trials,2,8)||!inInt(failures,6,30)||!inInt(budget,6,48)||
    !Array.isArray(families)||families.length<1||families.length>2||
    new Set(families).size!==families.length||
    families.some(x=>!IRREGULAR_FAMILIES.includes(x))||
    !Array.isArray(outages)||outages.length<1||outages.length>2||
    new Set(outages).size!==outages.length||
    outages.some(x=>!IRREGULAR_OUTAGES.includes(x)))
    throw new TypeError("Invalid bounded irregular stress configuration.");
  const fixtureSeeds=Array.from({length:seeds},(_,i)=>
    (baseSeed+Math.imul(i,7919))>>>0);
  const scenarios=[];
  for(const family of families)for(const outage of outages){
    const seedRows=[];
    for(const seed of fixtureSeeds){
      const fixture=makeIrregularFixture(family,seed);
      const planned=selectIrregularPolicies(fixture,budget);
      const attempts=[];
      for(let t=0;t<trials;t++){
        const outageSeed=(seed+Math.imul(15427,t+1)+
          hash("R4|OUTAGE|"+family+"|"+outage))>>>0;
        const failed=weightedOutage(fixture,outage,outageSeed,failures);
        const outcomes={};
        for(const policy of IRREGULAR_POLICIES){
          const protectedSet=new Set(planned[policy].protectedIds);
          const actual=failed.filter(id=>!protectedSet.has(id));
          const result=evaluateIrregularSyntheticFixture(fixture,actual);
          outcomes[policy]={
            servedFraction:result.servedFraction,
            servedUnits:result.servedUnits,
            remainingFailedEdges:actual.length,
            blockedFailureAttempts:failed.length-actual.length
          };
        }
        attempts.push({outageSeed,failedEdgeIds:failed,outcomes});
      }
      const means=Object.fromEntries(IRREGULAR_POLICIES.map(policy=>
        [policy,mean(attempts.map(t=>t.outcomes[policy].servedFraction))]));
      seedRows.push({seed,graphMetrics:fixture.graphMetrics,
        costSpent:Object.fromEntries(IRREGULAR_POLICIES.map(p=>[p,planned[p].spent])),
        protectedEdgeIds:Object.fromEntries(IRREGULAR_POLICIES.map(p=>[p,planned[p].protectedIds])),
        means,attempts});
    }
    const meanServed=Object.fromEntries(IRREGULAR_POLICIES.map(p=>
      [p,mean(seedRows.map(row=>row.means[p]))]));
    const leader=FUNDED.slice().sort((a,b)=>meanServed[b]-meanServed[a]||a.localeCompare(b))[0];
    const comparisons=Object.fromEntries(FUNDED.filter(p=>p!=="centrality_risk").map(p=>
      [p,bootstrap(seedRows.map(row=>100*(row.means.centrality_risk-row.means[p])),
        (baseSeed+hash("R4|BOOT|"+family+"|"+outage+"|"+p))>>>0)]));
    const exactSpend=seedRows.every(row=>FUNDED.every(p=>row.costSpent[p]===budget));
    scenarios.push({family,outage,seedRows,meanServed,leader,comparisons,
      exactSpendAcrossFunded:exactSpend});
  }
  return {
    schema:IRREGULAR_SCHEMA,origin:"SIMULATED",authority:"NONE",
    privacy:"public-synthetic",action:"ANALYZE_ONLY",
    canRoute:false,canExecute:false,canAuthorize:false,
    settings:{baseSeed,seeds,trials,failures,budget,fixtureSeeds,
      families:[...families],outages:[...outages],policies:[...IRREGULAR_POLICIES]},
    scenarios,
    warnings:[
      "No live network or physical outages: these are fabricated irregular graph and traffic fixtures.",
      "The centrality strategy is UNWEIGHTED graph edge betweenness × relative hazard; exposure strategy instead uses capacity-feasible routed demand × hazard.",
      "The matched additive/harmonic scores use the same declared risk, intact routed exposure and protection costs as exposure_risk, but NOT identical graph-centrality information.",
      "Exact-cost 0/1 knapsack forces equal funded spend, excluding zero-spend unprotected reference.",
      "Traffic service uses the existing E2-R2 fixed-order greedy unsplittable capacity-feasible routing evaluator; it is NOT production routing.",
      "Paired failures are sampled using fictional relative risk weights; localized failures use synthetic vertex-label proximity.",
      "Intervals resample synthetic fixture seeds only, not real network observations, and do not establish general policy superiority.",
      "No quantum light, OAM topology, network authentication, model inference or execution authority."
    ]
  };
}
