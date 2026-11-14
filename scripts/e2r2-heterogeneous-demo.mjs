// Frozen four-family E2-R2 experiment. Original E2-R1 stays unchanged.
import {createHash} from "node:crypto";
import {runHeterogeneousResilience} from "../site/src/heterogeneous-resilience.js";
const settings=[
  {graph:"A",outage:"risk_weighted"},
  {graph:"A",outage:"regional_risk_weighted"},
  {graph:"B",outage:"risk_weighted"},
  {graph:"B",outage:"regional_risk_weighted"}
];
const results=settings.map(family=>runHeterogeneousResilience({
  ...family,trials:24,failures:26,budget:24,seed:369
}));
const summary=results.map(r=>({
  graph:r.settings.graph,outage:r.settings.outage,
  requestedUnits:r.baselineIntact.requestedUnits,
  servedFractionByPolicy:Object.fromEntries(
    Object.entries(r.summary).map(([policy,x])=>[policy,x.meanServedFraction])),
  spentByPolicy:Object.fromEntries(
    Object.entries(r.summary).map(([policy,x])=>[policy,x.protectionCostSpent]))
}));
const report={
  schema:"NBGPocketMesh.E2R2.FrozenDemo.v1",
  classification:"SIMULATED_ANALYZE_ONLY",
  authority:"NONE",canRoute:false,canExecute:false,canAuthorize:false,
  predefinedTrialsPerFamily:24,
  descriptiveSummary:summary,
  results,
  warnings:[
    "No real network traffic, calibrated probabilities, latency benchmarks or quantum topology.",
    "Small fixed graph fixtures, one traffic ordering, synthetic failure-weight draw.",
    "Equal cost ceilings, not necessarily equal exact expenditure.",
    "A result from this frozen fixture is not a claim of general policy superiority."
  ]
};
const sha=createHash("sha256").update(JSON.stringify(report)).digest("hex");
console.log(JSON.stringify({...report,receiptDigestSha256:sha},null,2));
