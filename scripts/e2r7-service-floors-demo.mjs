// Frozen E2-R7: 3 seeds × 3 paired outages × 4 graph/mix families.
// Summaries preserve negative standard-class effects and unattainable floor cases.
import {createHash} from "node:crypto";
import {runServiceFloorCohort} from "../site/src/service-floors.js";
const report=runServiceFloorCohort({
 baseSeed:369,seeds:3,trials:3,attempts:12,budget:24,
 families:["modular","preferential"],mixes:["balanced","cluster_heavy"],
 floors:[0,20,30,40]
});
const digest=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const ledger={
 schema:"NBGPocketMesh.E2R7.FrozenDemo.v1",
 origin:"SIMULATED",authority:"NONE",action:"ANALYZE_ONLY",
 canRoute:false,canExecute:false,canAuthorize:false,
 settings:report.settings,
 families:report.groups.map(group=>({
   family:group.family,mix:group.mix,exactFundedSpend:group.exactFundedSpend,
   floors:Object.fromEntries(Object.entries(group.floors).map(([floor,summary])=>[
     floor,{bestMeanPriorityPolicy:summary.bestMeanPriorityPolicy,
       tiedPriorityLeaders:summary.tiedPriorityLeaders,
       policies:Object.fromEntries(Object.entries(summary.policies).map(([policy,p])=>[
         policy,{
           priority:p.meanPriorityFraction,standard:p.meanStandardFraction,
           total:p.meanTotalFraction,
           priorityDeltaPP:p.meanPriorityDeltaPP,
           standardDeltaPP:p.meanStandardDeltaPP,
           totalDeltaPP:p.meanTotalDeltaPP,
           floorAttainableTrials:p.floorAttainableTrials,
           floorSatisfiedWhenAttainable:p.floorSatisfiedWhenAttainable,
           floorSatisfiedAllTrials:p.floorSatisfiedAllTrials,
           belowGreedyPotentialTrials:p.belowGreedyPotentialTrials,
           meanShortfallUnits:p.meanShortfallUnits
         }
       ]))}
   ]))
 })),
 fullReportSha256Unsigned:digest,
 warning:"All metrics describe fabricated greedy flow placements, not real SLA guarantees, optimization optima, packet timing or network control."
};
console.log(JSON.stringify(ledger,null,2));
