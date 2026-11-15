// E2-R6: reproducible mixed-outage + explicit simulated service-priority study.
// Read-only, offline, public-synthetic. Never invokes E0, trust, identities or links.
import {makeIrregularFixture} from "./irregular-resilience.js";
import {analyzeBridgeDemand,inspectSyntheticPathAllocation} from "./bridge-failover.js";
import {evaluateIrregularSyntheticFixture} from "./heterogeneous-resilience.js";

export const PRIORITY_SCHEMA="NBGPocketMesh.E2R6.MixedPriority.v1";
export const PRIORITY_POLICIES=Object.freeze([
 "priority_exposure_risk","equal_exposure_risk","bridge_priority_risk",
 "risk_only","seeded_random","unprotected"
]);
export const PRIORITY_FAMILIES=Object.freeze(["modular","preferential"]);
export const PRIORITY_MIXES=Object.freeze(["balanced","cluster_heavy"]);
export const PRIORITY_ORDERS=Object.freeze(["original","priority_first"]);
const funded=PRIORITY_POLICIES.filter(x=>x!=="unprotected");
const N=47,EPS=1e-12;
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function hash(value){
 let h=2166136261;
 for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;
 return h>>>0;
}
function rng(seed){
 let state=(seed>>>0)||0x6d2b79f5;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
}
const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
function classMap(fixture){
 const result=new Map(fixture.demands.map(d=>[
   d.id,hash("E2R6|CLASS|"+fixture.seed+"|"+d.id)%4===0?"priority":"standard"
 ]));
 if(result.size!==94||![...result.values()].includes("priority")||
   ![...result.values()].includes("standard"))
   throw new Error("Synthetic demand class fixture invariant failed.");
 return result;
}
export function priorityDemandOrder(fixture){
 if(!fixture||fixture.schema!=="NBGPocketMesh.E2R4.IrregularFixture.v1"||
   fixture.origin!=="SIMULATED"||fixture.authority!=="NONE")
   throw new TypeError("Invalid synthetic fixture.");
 const labels=classMap(fixture);
 return fixture.demands.filter(d=>labels.get(d.id)==="priority")
   .concat(fixture.demands.filter(d=>labels.get(d.id)==="standard"))
   .map(d=>d.id);
}
function baselineExposure(fixture,labels,order){
 const rows=inspectSyntheticPathAllocation(fixture,[],order).assignments;
 const edgeUsage=new Map(fixture.edges.map(e=>[e.id,{all:0,priority:0}]));
 for(const a of rows)if(a.path){
   for(const e of a.path){
     const v=edgeUsage.get(e);
     v.all+=a.units;
     if(labels.get(a.id)==="priority")v.priority+=a.units;
   }
 }
 return edgeUsage;
}
function exactBudget(fixture,budget,values){
 const sorted=fixture.edges.slice().sort((a,b)=>a.id.localeCompare(b.id));
 const dp=new Array(budget+1).fill(null);dp[0]={score:0,ids:[]};
 for(const edge of sorted){
   const score=values.get(edge.id);
   if(!Number.isFinite(score)||score<0)throw new Error("Invalid pre-outage policy score.");
   for(let money=budget;money>=edge.protectionCost;money--){
     const prev=dp[money-edge.protectionCost];if(!prev)continue;
     const candidate=prev.score+score;
     if(!dp[money]||candidate>dp[money].score+EPS)
       dp[money]={score:candidate,ids:[...prev.ids,edge.id]};
   }
 }
 if(!dp[budget])throw new Error("Exact-cost protection budget unreachable.");
 return dp[budget].ids.sort();
}
export function selectPriorityProtection(fixture,budget=24){
 if(!fixture||fixture.schema!=="NBGPocketMesh.E2R4.IrregularFixture.v1"||
    fixture.origin!=="SIMULATED"||fixture.authority!=="NONE"||
    !integer(budget,8,36))
   throw new TypeError("Invalid synthetic priority protection fixture or cost.");
 // Both exposure policies consume the same baseline path records, risk weights
 // and edge costs. Only use of the PREASSIGNED class label differs.
 const labels=classMap(fixture),order=priorityDemandOrder(fixture);
 const usage=baselineExposure(fixture,labels,order);
 const bridges=analyzeBridgeDemand(fixture);
 const cutPriority=new Map(bridges.bridges.map(c=>[c.id,
   fixture.demands.filter(d=>labels.get(d.id)==="priority"&&
     c.criticalDemandIds.includes(d.id)).reduce((s,d)=>s+d.units,0)
 ]));
 const maxAll=Math.max(1,...[...usage.values()].map(x=>x.all));
 const maxPriority=Math.max(1,...[...usage.values()].map(x=>x.priority));
 const maxCut=Math.max(1,...cutPriority.values());
 const selected={};
 for(const policy of PRIORITY_POLICIES){
   if(policy==="unprotected"){
     selected[policy]={spent:0,protectedIds:[],selectedBeforeOutage:true};
     continue;
   }
   const scores=new Map(fixture.edges.map(e=>{
     const flow=usage.get(e.id),risk=e.riskWeight/9;
     const value=policy==="priority_exposure_risk"?(flow.priority/maxPriority)*risk:
       policy==="equal_exposure_risk"?(flow.all/maxAll)*risk:
       policy==="bridge_priority_risk"?((cutPriority.get(e.id)??0)/maxCut)*risk:
       policy==="risk_only"?risk:
       hash("E2R6|RANDOM|"+fixture.seed+"|"+e.id)/4294967296;
     return [e.id,value];
   }));
   const ids=exactBudget(fixture,budget,scores);
   selected[policy]={spent:budget,protectedIds:ids,selectedBeforeOutage:true};
 }
 const costs=new Map(fixture.edges.map(e=>[e.id,e.protectionCost]));
 for(const [policy,p] of Object.entries(selected)){
   const spent=p.protectedIds.reduce((s,id)=>s+costs.get(id),0);
   if(spent!==p.spent||p.spent!==(policy==="unprotected"?0:budget))
     throw new Error("Exact resource spending mismatch.");
 }
 return {labels:Object.fromEntries(labels),selected,
   bridgeCount:bridges.bridges.length,
   informationBoundary:"No failure realization or mixture subtype was used for selecting protections."};
}
function weightedSample(links,count,seed,weighted){
 if(count>links.length)throw new Error("Unbounded failure sample.");
 const random=rng(seed),scores=links.map(e=>{
   const u=Math.max(random(),1/4294967296);
   return {id:e.id,key:-Math.log(u)/(weighted?e.riskWeight:1)};
 });
 return scores.sort((a,b)=>a.key-b.key||a.id.localeCompare(b.id))
   .slice(0,count).map(x=>x.id);
}
function attemptedOutage(fixture,mix,seed,count){
 const draw=rng(seed^0x5139cc)();
 const subtype=mix==="balanced"?
   (draw<1/3?"uniform":draw<2/3?"risk_weighted":"clustered"):
   (draw<.15?"uniform":draw<.3?"risk_weighted":"clustered");
 let ids=[];
 if(subtype==="uniform"||subtype==="risk_weighted"){
   ids=weightedSample(fixture.edges,count,seed^0x315a,subtype==="risk_weighted");
 }else{
   // Location is synthetic node-label proximity, not geography.
   const first=Math.floor(rng(seed^0xcafebabe)()*N);
   const near=v=>(v-first+N)%N<14;
   const local=fixture.edges.filter(e=>near(e.a)||near(e.b));
   const outside=fixture.edges.filter(e=>!near(e.a)&&!near(e.b));
   const localCount=Math.min(Math.ceil(count*.65),local.length);
   const localIds=weightedSample(local,localCount,seed^0x42d9,true);
   ids=localIds.concat(weightedSample(outside,count-localCount,seed^0x3e71,true));
 }
 ids.sort();
 if(ids.length!==count||new Set(ids).size!==count)
   throw new Error("Failure generator produced duplicate or omitted edges.");
 return {subtype,attemptedFailedEdgeIds:ids};
}
function serviceMetrics(fixture,assignments,labels){
 const demandMap=new Map(fixture.demands.map(d=>[d.id,d]));
 const totals={priority:{requested:0,served:0},standard:{requested:0,served:0}};
 for(const d of fixture.demands)totals[labels.get(d.id)].requested+=d.units;
 if(assignments.length!==fixture.demands.length)
   throw new Error("Incomplete synthetic placement report.");
 const seen=new Set();
 for(const a of assignments){
   const d=demandMap.get(a.id);
   if(!d||seen.has(a.id)||d.units!==a.units)throw new Error("Unexpected synthetic demand assignment.");
   seen.add(a.id);
   if(a.path)totals[labels.get(a.id)].served+=a.units;
 }
 const p=totals.priority,s=totals.standard;
 return {
   priorityRequested:p.requested,priorityServed:p.served,
   priorityFraction:p.served/p.requested,
   standardRequested:s.requested,standardServed:s.served,
   standardFraction:s.served/s.requested,
   totalRequested:p.requested+s.requested,totalServed:p.served+s.served,
   totalFraction:(p.served+s.served)/(p.requested+s.requested),
   weightedFraction:(3*p.served+s.served)/(3*p.requested+s.requested)
 };
}
function evaluateFixture(fixture,failed,labels,priorityOrder){
 const result={};
 for(const order of PRIORITY_ORDERS){
   const demandOrder=order==="priority_first"?priorityOrder:null;
   const observed=inspectSyntheticPathAllocation(fixture,failed,demandOrder);
   result[order]=serviceMetrics(fixture,observed.assignments,labels);
 }
 return result;
}
function selectLeader(summary,mode,field){
 const max=Math.max(...funded.map(policy=>summary[policy][mode][field]));
 const leaders=funded.filter(p=>Math.abs(summary[p][mode][field]-max)<=1e-12);
 return {max,leader:leaders[0],leaders};
}
function bootstrapCluster(differences,seed){
 const random=rng(seed);const n=differences.length,means=[];
 for(let b=0;b<300;b++){
   let total=0;
   for(let j=0;j<n;j++)total+=differences[Math.floor(random()*n)];
   means.push(total/n);
 }
 means.sort((a,b)=>a-b);
 const quant=p=>{
   const at=p*(means.length-1),lo=Math.floor(at),hi=Math.ceil(at);
   return means[lo]+(at-lo)*(means[hi]-means[lo]);
 };
 return {mean:mean(differences),lower:quant(.025),upper:quant(.975),
   better:differences.filter(x=>x>1e-9).length,
   tied:differences.filter(x=>Math.abs(x)<=1e-9).length,
   worse:differences.filter(x=>x<-1e-9).length,
   boundary:"Percentile bootstrap across synthetic fixture seeds only. Not a real-world confidence interval."};
}
export function runPriorityMix({
 baseSeed=369,seeds=3,trials=3,attempts=12,budget=24,
 families=["modular","preferential"],mixes=["balanced","cluster_heavy"]
}={}){
 if(!integer(baseSeed,0,0xffffffff)||!integer(seeds,2,6)||
   !integer(trials,2,6)||!integer(attempts,6,24)||!integer(budget,8,36)||
   !Array.isArray(families)||families.length<1||families.length>2||
   new Set(families).size!==families.length||families.some(x=>!PRIORITY_FAMILIES.includes(x))||
   !Array.isArray(mixes)||mixes.length<1||mixes.length>2||
   new Set(mixes).size!==mixes.length||mixes.some(x=>!PRIORITY_MIXES.includes(x)))
   throw new TypeError("Invalid bounded E2-R6 synthetic study configuration.");
 const fixtureSeeds=Array.from({length:seeds},(_,i)=>
   (baseSeed+Math.imul(i,7919))>>>0);
 const groups=[];
 for(const family of families)for(const mix of mixes){
   const seedRows=[];
   for(const seed of fixtureSeeds){
     const fixture=makeIrregularFixture(family,seed);
     const plan=selectPriorityProtection(fixture,budget);
     const labels=new Map(Object.entries(plan.labels));
     const order=priorityDemandOrder(fixture);
     const trialRows=[];
     for(let t=0;t<trials;t++){
       const trialSeed=(seed+Math.imul(t+1,15427)+hash("E2R6|"+family+"|"+mix))>>>0;
       const outage=attemptedOutage(fixture,mix,trialSeed,attempts);
       const results={};
       for(const policy of PRIORITY_POLICIES){
         const protection=plan.selected[policy],kept=new Set(protection.protectedIds);
         const actuallyFailed=outage.attemptedFailedEdgeIds.filter(id=>!kept.has(id));
         results[policy]={
           spent:protection.spent,blockedAttempts:attempts-actuallyFailed.length,
           failedEdges:actuallyFailed.length,
           ...evaluateFixture(fixture,actuallyFailed,labels,order)
         };
       }
       // Independent frozen evaluator cross-check (original demand order).
       const reference=evaluateIrregularSyntheticFixture(
         fixture,outage.attemptedFailedEdgeIds.filter(
           id=>!plan.selected.unprotected.protectedIds.includes(id)));
       const original=results.unprotected.original;
       if(Math.abs(reference.servedFraction-original.totalFraction)>1e-10||
         reference.servedUnits!==original.totalServed)
         throw new Error("Priority study changed frozen E2-R2 traffic behavior.");
       trialRows.push({
         trial:t+1,trialSeed,subtype:outage.subtype,
         attemptedFailedEdgeIds:outage.attemptedFailedEdgeIds,results
       });
     }
     const averages=Object.fromEntries(PRIORITY_POLICIES.map(policy=>[
       policy,Object.fromEntries(PRIORITY_ORDERS.map(order=>[
         order,Object.fromEntries(["priorityFraction","standardFraction","totalFraction","weightedFraction"]
           .map(field=>[field,mean(trialRows.map(r=>r.results[policy][order][field]))]))
       ]))
     ]));
     seedRows.push({seed,bridgeCount:plan.bridgeCount,
       classDemandCounts:{
         priority:Object.values(plan.labels).filter(x=>x==="priority").length,
         standard:Object.values(plan.labels).filter(x=>x==="standard").length
       },
       selectedProtection:plan.selected,averages,trials:trialRows});
   }
   const summary=Object.fromEntries(PRIORITY_POLICIES.map(policy=>[
     policy,Object.fromEntries(PRIORITY_ORDERS.map(order=>[
       order,Object.fromEntries(["priorityFraction","standardFraction","totalFraction","weightedFraction"]
         .map(field=>[field,mean(seedRows.map(r=>r.averages[policy][order][field]))]))
     ]))
   ]));
   const {leader,leaders}=selectLeader(summary,"priority_first","priorityFraction");
   const comparisons=Object.fromEntries(
     ["equal_exposure_risk","risk_only","bridge_priority_risk","seeded_random"].map(other=>[
       other,bootstrapCluster(seedRows.map(r=>100*(
         r.averages.priority_exposure_risk.priority_first.priorityFraction-
         r.averages[other].priority_first.priorityFraction)),
         (baseSeed+hash("E2R6|BOOT|"+family+"|"+mix+"|"+other))>>>0)
     ]));
   groups.push({family,mix,leader,leaders,
     metric:"priority_first.priorityFraction",
     exactFundedSpend:seedRows.every(r=>funded.every(p=>
       r.selectedProtection[p].spent===budget)),
     summary,comparisons,seedRows});
 }
 return {
   schema:PRIORITY_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
   authority:"NONE",action:"ANALYZE_ONLY",canRoute:false,
   canExecute:false,canAuthorize:false,
   settings:{baseSeed,seeds,trials,attempts,budget,
     fixtureSeeds,families:[...families],mixes:[...mixes],
     policies:[...PRIORITY_POLICIES],orders:[...PRIORITY_ORDERS],
     priorityWeight:3,standardWeight:1,
     failureMixDisclosedBeforeExperiments:true,
     exactSubtypeKnownToPoliciesBeforeOutage:false},
   groups,
   limitations:[
     "Only synthetic 47-node modular or preferential fixture graph families and arbitrary service classes.",
     "High-priority labels are seeded synthetic identifiers, not real user or operational needs.",
     "Priority-first scheduling may reduce standard-class or total service; all three metrics are reported.",
     "Paired attempted failures are sampled from known mixture rules, but no policy sees which specific links or subtype a future trial draws.",
     "A bridge-aware policy has cut information; exposure policies have route usage; strategies are NOT universally information-matched.",
     "All funded policies spend the same exact simulated protection cost; unprotected spends zero.",
     "Flow placement is greedy, capacity-feasible, unsplittable and has no latency/queueing/recovery-time realism.",
     "Descriptive seed-cluster bootstrap does not justify confidence about physical networks or production routing.",
     "No connections, identity, E0 routing, signing, authorizations, packet measurement or quantum information are accessed."
   ]
 };
}
