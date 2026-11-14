import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runE2R3,COHORT_POLICIES} from "../src/resilience-cohort.js";
test("site and Node use the same reproducible, read-only cohort engine",()=>{
  const result=runE2R3({
    baseSeed:369,seedCount:2,trials:4,failures:20,budget:18,
    graphs:["A"],outages:["risk_weighted"]
  });
  assert.equal(result.families.length,1);
  assert.equal(result.families[0].seedRows.length,2);
  assert.equal(result.canRoute,false);
  assert.equal(result.canExecute,false);
  assert.deepEqual(Object.keys(result.families[0].averageServedFraction),[...COHORT_POLICIES]);
});
test("React Cohort section is linked and does not invoke real routing",()=>{
  const component=readFileSync(new URL("../src/ResilienceCohort.jsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(app,/import ResilienceCohort/);
  assert.match(app,/<ResilienceCohort\/>/);
  assert.match(app,/href="#cohort"/);
  assert.match(component,/READ-ONLY/);
  assert.match(component,/matched-information controls/i);
  assert.doesNotMatch(component,/(?:from|import)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
