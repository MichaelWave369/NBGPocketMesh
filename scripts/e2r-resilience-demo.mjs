import {createHash} from "node:crypto";
import {runResilience} from "../site/src/link-resilience.js";
const cases=[
  {graph:"A",outage:"uniform"},{graph:"A",outage:"regional"},
  {graph:"B",outage:"uniform"},{graph:"B",outage:"regional"}
];
const results=cases.map(settings=>runResilience({...settings,trials:24,failures:20,budget:12,seed:369}));
const output={
  schema:"NBGPocketMesh.E2R.Demo.v1",
  origin:"SIMULATED",authority:"NONE",action:"ANALYZE_ONLY",
  canRoute:false,canExecute:false,canAuthorize:false,
  predeclaredSettings:{trialsPerCase:24,failures:20,budget:12,seed:369},
  interpretation:"Paired synthetic shortest-hop trials. Lower mean inflation may or may not favor topology; no hypothesis of superiority is assumed.",
  results
};
const digest=createHash("sha256").update(JSON.stringify(output)).digest("hex");
console.log(JSON.stringify({...output,receiptDigestSha256:digest},null,2));
