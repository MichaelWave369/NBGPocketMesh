// E2-R7: minimum standard-service floor vs priority-service tradeoff study.
// Standalone public-synthetic, READ-ONLY experiment; never invokes E0 routing.
import {makeIrregularFixture} from "./irregular-resilience.js";
import {inspectSyntheticServiceFloor} from "./bridge-failover.js";
import {runPriorityMix,PRIORITY_POLICIES,getSyntheticServiceClasses as priorityLabelsForFixture} from "./mixed-priority.js";

export const FLOOR_SCHEMA="NBGPocketMesh.E2R7.StandardFloors.v1";
export const FLOOR_LEVELS=Object.freeze([0,20,30,40]);
export const FLOOR_POLICIES=PRIORITY_POLICIES;
const FUNDED=FLOOR_POLICIES.filter(p=>p!=="unprotected");
const UINT=x=>Number.isSafeInteger(x)&&x>=0&&x<=0xffffffff;
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
const fields=["priorityFraction","standardFraction","totalFraction"];
function parameters({baseSeed,seeds,trials,attempts,budget,families,mixes,floors}){
 if(!UINT(baseSeed)||!integer(seeds,2,6)||!integer(trials,2,6)||
   !integer(attempts,6,24)||!integer(budget,8,36)||
   !Array.isArray(families)||families.length<1||families.length>2||
   new Set(families).size!==families.length||
   families.some(f=>!["modular","preferential"].includes(f))||
   !Array.isArray(mixes)||mixes.length<1||mixes.length>2||
   new Set(mixes).size!==mixes.length||
   mixes.some(x=>!["balanced","cluster_heavy"].includes(x))||
   !Array.isArray(floors)||floors.length<2||floors.length>5||
   floors[0]!==0||new Set(floors).size!==floors.length||
   floors.some((v,i)=>!integer(v,0,70)||(i>0&&v<=floors[i-1])))
   throw new TypeError("Invalid bounded E2-R7 research configuration.");
}
function averageFor(rows,policy,floor,field){
 return mean(rows.map(r=>r.outcomes[policy][floor][field]));
}
function seedMeans(seedRows,policy,floor,field){
 return mean(seedRows.map(row=>averageFor(row.trials,policy,floor,field)));
}
export function runServiceFloorCohort({
  baseSeed=369,seeds=3,trials=3,attempts=12,budget=24,
  families=["modular","preferential"],mixes=["balanced","cluster_heavy"],
  floors=[...FLOOR_LEVELS]
}={}){
 parameters({baseSeed,seeds,trials,attempts,budget,families,mixes,floors});
 // E2-R6's already-tested generator makes the fixture, preselects every policy
 // BEFORE each outage, and freezes the same attempted failure IDs for all.
 const baseline=runPriorityMix({baseSeed,seeds,trials,attempts,budget,families,mixes});
 const groups=[];
 for(const source of baseline.groups){
   const seedRows=[];
   for(const oldSeed of source.seedRows){
     const fixture=makeIrregularFixture(source.family,oldSeed.seed);
     // Reuse the audited E2-R6 labels exactly, without reassignment or tuning.
     const planned=oldSeed.selectedProtection;
     const classes=priorityLabelsForFixture(fixture);
     if(Object.keys(classes).length!==fixture.demands.length)
       throw new Error("Demand label counts diverged.");
     const trialRows=[];
     for(const sourceTrial of oldSeed.trials){
       const outcomes={};
       for(const policy of FLOOR_POLICIES){
         const protection=planned[policy],protectedSet=new Set(protection.protectedIds);
         const failed=sourceTrial.attemptedFailedEdgeIds.filter(id=>!protectedSet.has(id));
         outcomes[policy]={};
         for(const floor of floors){
           const result=inspectSyntheticServiceFloor(fixture,failed,classes,floor);
           if(floor===0){
             // Hard non-regression: new stage scheduler MUST match E2-R6's
             // previously frozen priority-first greedy allocation.
             const old=sourceTrial.results[policy].priority_first;
             for(const f of fields)if(Math.abs(result[f]-old[f])>1e-12)
               throw new Error("E2-R7 zero-floor baseline drift: "+policy+" "+f);
           }
           if(result.attainableUnderGreedy&&!result.floorSatisfied)
             throw new Error("Attainable synthetic floor violated.");
           outcomes[policy][floor]=result;
         }
       }
       trialRows.push({trial:sourceTrial.trial,
         trialSeed:sourceTrial.trialSeed,subtype:sourceTrial.subtype,
         attemptedFailedEdgeIds:sourceTrial.attemptedFailedEdgeIds,
         outcomes});
     }
     seedRows.push({seed:oldSeed.seed,selectedProtection:planned,
       demandCounts:oldSeed.classDemandCounts,trials:trialRows});
   }
   const summaries={};
   for(const floor of floors){
     const policies={};
     for(const policy of FLOOR_POLICIES){
       const all=seedRows.flatMap(r=>r.trials.map(t=>t.outcomes[policy][floor]));
       const attainable=all.filter(x=>x.attainableUnderGreedy);
       const reference=seedMeans(seedRows,policy,0,"priorityFraction");
       policies[policy]={
         spent:policy==="unprotected"?0:budget,
         meanPriorityFraction:seedMeans(seedRows,policy,floor,"priorityFraction"),
         meanStandardFraction:seedMeans(seedRows,policy,floor,"standardFraction"),
         meanTotalFraction:seedMeans(seedRows,policy,floor,"totalFraction"),
         meanPriorityDeltaPP:100*(seedMeans(seedRows,policy,floor,"priorityFraction")-reference),
         meanStandardDeltaPP:100*(seedMeans(seedRows,policy,floor,"standardFraction")-
           seedMeans(seedRows,policy,0,"standardFraction")),
         meanTotalDeltaPP:100*(seedMeans(seedRows,policy,floor,"totalFraction")-
           seedMeans(seedRows,policy,0,"totalFraction")),
         attempts:all.length,
         floorAttainableTrials:attainable.length,
         floorSatisfiedWhenAttainable:attainable.filter(x=>x.floorSatisfied).length,
         floorSatisfiedAllTrials:all.filter(x=>x.floorSatisfied).length,
         belowGreedyPotentialTrials:all.length-attainable.length,
         meanShortfallUnits:mean(all.map(x=>x.shortfallUnits)),
         meanGreedyStandardFirstPotentialUnits:mean(all.map(x=>x.standardFirstGreedyPotentialUnits))
       };
     }
     const ranked=FUNDED.slice().sort((a,b)=>
       policies[b].meanPriorityFraction-policies[a].meanPriorityFraction||
       a.localeCompare(b));
     const top=policies[ranked[0]].meanPriorityFraction;
     const tied=ranked.filter(p=>Math.abs(policies[p].meanPriorityFraction-top)<1e-12);
     summaries[floor]={floorPercent:floor,policies,
       bestMeanPriorityPolicy:ranked[0],tiedPriorityLeaders:tied,
       note:"Highest mean priority service, NOT an optimal or guaranteed constrained winner. Compare standard floors and unattainable trials separately."};
   }
   const allExactSpend=seedRows.every(r=>FUNDED.every(p=>
     r.selectedProtection[p].spent===budget));
   if(!allExactSpend)throw new Error("Funded policy spend not exactly matched.");
   groups.push({family:source.family,mix:source.mix,
     exactFundedSpend:allExactSpend,floors:summaries,seedRows});
 }
 return {
   schema:FLOOR_SCHEMA,origin:"SIMULATED",privacy:"public-synthetic",
   authority:"NONE",action:"ANALYZE_ONLY",
   canRoute:false,canExecute:false,canAuthorize:false,
   settings:{baseSeed,seeds,trials,attempts,budget,
     fixtureSeeds:baseline.settings.fixtureSeeds,
     families:[...families],mixes:[...mixes],floors:[...floors],
     policies:[...FLOOR_POLICIES],floorDefinition:"percentage of STANDARD requested units",
     guarantee:"only relative to the deterministic greedy standard-first reference on each failed synthetic fixture"},
   groups,
   limitations:[
     "The standard-service floor is conditional on greedy standard-first attainability, not a mathematical optimum, feasibility theorem or production SLA.",
     "A floor may be unattainable under this fixed greedy path allocator after severe failures. Shortfall and attainability are reported, never hidden.",
     "The reservation algorithm preserves standard admissions until its requested floor is reached, then serves priority and remaining standard flows.",
     "Priority gains, standard losses and TOTAL service changes are all recorded; no single metric is proof of operational benefit.",
     "All failures, route demands, class priorities, link capacities and cost units are fabricated. No real network is read or modified.",
     "Each policy selects protection BEFORE future outages; identical trial failure IDs and exact funded spending are preserved from E2-R6.",
     "A policy's use of bridge-cut knowledge is not information matched to the exposure and risk controls.",
     "No measured packet QoS, queueing, switch delay, recovery time, physical topology, quantum effect, E0 route or authorization."
   ]
 };
}
