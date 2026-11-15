// E2-R8: 3 synthetic tiny graphs × 2 fixed outage types × 4 floor tiers.
// All simple paths and accept/reject allocations exhaustively enumerated.
import {createHash} from "node:crypto";
import {runOptimizationGap} from "../site/src/exact-optimization-gap.js";
const report=runOptimizationGap({seed:369,
  fixtures:["fork","bridge","mesh"],
  faults:["intact","single_cut"],
  floors:[0,40,70,100]});
const digest=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const ledger={
  schema:"NBGPocketMesh.E2R8.FrozenDemo.v1",
  origin:"SIMULATED",authority:"NONE",action:"ANALYZE_ONLY",
  canRoute:false,canExecute:false,canAuthorize:false,
  config:report.config,counts:report.counts,
  scenarios:report.cases.map(c=>({
    fixture:c.name,fault:c.fault,floor:c.floor,
    classification:c.classification,targetStandardUnits:c.greedy.targetStandardUnits,
    greedy:{priority:c.greedy.priorityUnits,standard:c.greedy.standardUnits,
      total:c.greedy.totalUnits,floorSatisfied:c.greedy.floorSatisfied,
      greedyAttainable:c.greedy.greedyAttainable},
    exact:{feasible:c.proof.globallyFeasibleWithinTinyModel,
      maximumStandard:c.proof.maximumStandardUnits,
      priority:c.proof.exact?.priorityUnits??null,
      standard:c.proof.exact?.standardUnits??null,
      total:c.proof.exact?.totalUnits??null,
      exploredStates:c.proof.exploredStates,completeLeaves:c.proof.completeLeaves}
  })),
  fullReportSha256Unsigned:digest,
  proofBoundary:"Exhaustive proof only for three bounded synthetic fixtures, no general real network or 47-node optimality claim."
};
console.log(JSON.stringify(ledger,null,2));
