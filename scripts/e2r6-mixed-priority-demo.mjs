// Frozen, predeclared E2-R6 run. Full paired trial rows are reproducible
// by runPriorityMix with the disclosed settings or via the offline React export.
import {createHash} from "node:crypto";
import {runPriorityMix} from "../site/src/mixed-priority.js";
const report=runPriorityMix({baseSeed:369,seeds:3,trials:3,attempts:12,budget:24,
  families:["modular","preferential"],mixes:["balanced","cluster_heavy"]});
const digest=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const ledger={
 schema:"NBGPocketMesh.E2R6.FrozenDemo.v1",
 classification:"SIMULATED_ANALYZE_ONLY",
 authority:"NONE",canRoute:false,canExecute:false,canAuthorize:false,
 settings:report.settings,
 groups:report.groups.map(g=>({
   family:g.family,mix:g.mix,leader:g.leader,leaders:g.leaders,
   exactFundedSpend:g.exactFundedSpend,primary:g.metric,
   meanTraffic:Object.fromEntries(Object.entries(g.summary).map(([policy,m])=>[
     policy,{original:m.original,priority_first:m.priority_first}
   ])),
   priorityExposureComparisons:g.comparisons,
   subtypeCounts:Object.fromEntries(["uniform","risk_weighted","clustered"].map(type=>[
     type,g.seedRows.reduce((sum,row)=>sum+
       row.trials.filter(t=>t.subtype===type).length,0)
   ]))
 })),
 completeReportSha256Unsigned:digest,
 limitations:"All routes, classes, risk weights, outages and services are fabricated. This is not live networking or a routing authorization."
};
console.log(JSON.stringify(ledger,null,2));
