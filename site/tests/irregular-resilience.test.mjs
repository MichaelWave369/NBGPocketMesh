import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runIrregularStress} from "../src/irregular-resilience.js";
test("irregular resilience UI uses same deterministic read-only computation as Node",()=>{
  const config={baseSeed:369,seeds:2,trials:2,failures:20,budget:24,
    families:["modular"],outages:["localized_risk"]};
  const a=runIrregularStress(config);
  assert.deepEqual(a,runIrregularStress(config));
  assert.equal(a.scenarios[0].exactSpendAcrossFunded,true);
  assert.equal(a.canRoute,false);
  assert.equal(a.canExecute,false);
});
test("React page exposes E2-R4 without importing the production router",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../src/IrregularStressLab.jsx",import.meta.url),"utf8");
  assert.match(app,/import IrregularStressLab/);
  assert.match(app,/<IrregularStressLab\/>/);
  assert.match(app,/href="#irregular"/);
  assert.match(ui,/READ-ONLY/);
  assert.match(ui,/exact protection spend/i);
  assert.doesNotMatch(ui,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
