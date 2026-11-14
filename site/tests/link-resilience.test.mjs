import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runResilience,protectionSet} from "../src/link-resilience.js";
import {ringGraph} from "../src/topology-keyhole.js";
test("browser shares reproducible, synthetic resilience policy comparisons",()=>{
  const r=runResilience({graph:"A",outage:"uniform",trials:4,failures:18,budget:8,seed:71});
  assert.equal(r.trialRows.length,4);
  assert.deepEqual(runResilience({graph:"A",outage:"uniform",trials:4,failures:18,budget:8,seed:71}),r);
  assert.equal(protectionSet(ringGraph(),"degree",8).length,8);
  assert.equal(r.canRoute,false);
  assert.equal(r.canAuthorize,false);
});
test("React page contains explicit read-only controls and does not import routing",()=>{
  const component=readFileSync(new URL("../src/ResilienceLab.jsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(component,/SIMULATED/);
  assert.match(component,/Read-only|read-only|READ-ONLY/);
  assert.doesNotMatch(component,/(?:from|import)\s+['"][^'"]*(?:\/router|pocket-executor)/);
  assert.match(app,/<ResilienceLab\/>/);
  assert.match(app,/href="#resilience"/);
});
