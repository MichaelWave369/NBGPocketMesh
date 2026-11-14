// E2-R5: locked, deterministic software-only failover scenario.
import {createHash} from "node:crypto";
import {runBridgeFailover} from "../site/src/bridge-failover.js";
const report=runBridgeFailover({
  baseSeed:369,seeds:4,trials:4,attempts:12,budget:24
});
const digest=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const ledger={
  schema:"NBGPocketMesh.E2R5.FrozenDemo.v1",
  authority:"NONE",action:"ANALYZE_ONLY",canRoute:false,canExecute:false,
  classification:"SIMULATED_SOFTWARE_ONLY",
  frozen:report.settings,
  scenarios:report.scenarios.map(s=>({
    family:s.family,outage:s.outage,primaryMetric:s.primaryMetric,
    leader:s.leader,allFundedExactSpend:s.allFundedExactSpend,
    bridges:s.seedRows.map(r=>r.bridgeAnalysis.bridges.map(b=>b.id)),
    meanServiceByPolicy:Object.fromEntries(Object.entries(s.byPolicy).map(([p,x])=>
      [p,Object.fromEntries(Object.entries(x).map(([mode,stats])=>[mode,{
        served:stats.meanServedFraction,
        criticalServed:stats.meanCriticalServedFraction,
        reroutedUnits:stats.meanRecoveredViaDifferentPathUnits
      }]))]))
  })),
  fullReportSha256Unsigned:digest,
  warning:"Not a field measurement, router command, packet timing, failover convergence metric, quantum computation or security proof."
};
console.log(JSON.stringify(ledger,null,2));
