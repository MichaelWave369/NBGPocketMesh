import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {heterogeneousFixture,runHeterogeneousResilience,HETERO_POLICIES} from "../src/heterogeneous-resilience.js";
test("React and Node research share a deterministic bounded heterogeneous traffic engine",()=>{
  const f=heterogeneousFixture("B",2026);
  assert.equal(f.edges.length,188);
  const config={graph:"B",outage:"risk_weighted",trials:4,failures:20,budget:18,seed:2026};
  const a=runHeterogeneousResilience(config);
  assert.deepEqual(a,runHeterogeneousResilience(config));
  assert.deepEqual(Object.keys(a.summary),[...HETERO_POLICIES]);
  assert.equal(a.canExecute,false);
  assert.equal(a.canAuthorize,false);
  assert.equal(a.canRoute,false);
});
test("site has a separate, read-only heterogeneous lab link",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const component=readFileSync(new URL("../src/HeterogeneousResilience.jsx",import.meta.url),"utf8");
  assert.match(app,/import HeterogeneousResilience/);
  assert.match(app,/<HeterogeneousResilience\/>/);
  assert.match(app,/href="#heterogeneous"/);
  assert.match(component,/READ-ONLY/);
  assert.match(component,/Export all fixture, policy and trial rows/);
  assert.doesNotMatch(component,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
