import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeTinyFixture,compareTinyGap,runOptimizationGap} from "../src/exact-optimization-gap.js";
test("tiny optimizer is deterministic, read-only and catches greedy false infeasibility",()=>{
  const fixture=makeTinyFixture("fork",369);
  const gap=compareTinyGap(fixture,[],100);
  assert.equal(gap.classification,"greedy_missed_feasible_floor");
  assert.equal(gap.proof.certified,true);
  assert.equal(gap.canRoute,false);
  assert.deepEqual(runOptimizationGap({fixtures:["fork"],faults:["intact"],floors:[100]}),
    runOptimizationGap({fixtures:["fork"],faults:["intact"],floors:[100]}));
});
test("E2-R8 React research section mounted and isolated from live route control",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../src/ExactGapLab.jsx",import.meta.url),"utf8");
  assert.match(app,/import ExactGapLab/);
  assert.match(app,/<ExactGapLab\/>/);
  assert.match(app,/href="#exactgap"/);
  assert.match(ui,/READ-ONLY/);
  assert.match(ui,/exhaustive/i);
  assert.doesNotMatch(ui,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
