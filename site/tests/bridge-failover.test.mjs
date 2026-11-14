import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runBridgeFailover,FAILOVER_SCHEMA} from "../src/bridge-failover.js";

test("browser and CLI share immutable synthetic failover engine",()=>{
  const r=runBridgeFailover({baseSeed:369,seeds:2,trials:2,attempts:8,budget:18,
    families:[["modular","bridge_attack"]]});
  assert.equal(r.schema,FAILOVER_SCHEMA);
  assert.equal(r.scenarios.length,1);
  assert.equal(r.scenarios[0].seedRows[0].bridgeAnalysis.bridges.length,2);
  assert.equal(r.canRoute,false);
  assert.equal(r.canExecute,false);
  assert.equal(r.canAuthorize,false);
});
test("React failover dashboard is mounted but imports no routing executors",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const component=readFileSync(new URL("../src/BridgeFailoverLab.jsx",import.meta.url),"utf8");
  assert.match(app,/import BridgeFailoverLab/);
  assert.match(app,/<BridgeFailoverLab\/>/);
  assert.match(app,/href="#failover"/);
  assert.match(component,/READ-ONLY/);
  assert.match(component,/Repair-only/);
  assert.doesNotMatch(component,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
