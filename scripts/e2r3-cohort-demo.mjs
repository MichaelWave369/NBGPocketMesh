// Reproduce the predeclared E2-R3 multi-seed experiment without massive CI logs.
// Detailed paired trial rows are recomputable via runE2R3 or exported in the browser.
import {createHash} from "node:crypto";
import {runE2R3} from "../site/src/resilience-cohort.js";
const result=runE2R3({
  baseSeed:369,seedCount:8,trials:8,failures:26,budget:24,
  graphs:["A","B"],outages:["risk_weighted","regional_risk_weighted"]
});
const digest=createHash("sha256").update(JSON.stringify(result)).digest("hex");
const summary={
  schema:"NBGPocketMesh.E2R3.FrozenDemo.v1",
  classification:"SIMULATED_ANALYZE_ONLY",
  authority:"NONE",canRoute:false,canExecute:false,canAuthorize:false,
  frozenParameters:result.frozenParameters,
  families:result.families.map(f=>({
    graph:f.graph,outage:f.outage,fixtureSeedCount:f.fixtureSeedCount,
    allFundedPoliciesSpentBudget:f.allFundedPoliciesSpentBudget,
    budgetViolations:f.budgetViolations,leader:f.leader,
    averageServedFraction:f.averageServedFraction,
    topologyMinusComparatorsPP:Object.fromEntries(
      Object.entries(f.contrasts).map(([key,c])=>
        [key,{mean:c.mean,lower:c.lower,upper:c.upper,
          seedsBetter:c.seedsBetter,seedsTied:c.seedsTied,seedsWorse:c.seedsWorse}]))
  })),
  completeRecomputableReportSha256:digest,
  limitations:"Unsigned, deterministic synthetic software study; cluster bootstrap only describes fixture-seed variation and provides no physical population inference."
};
console.log(JSON.stringify(summary,null,2));
