import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runPriorityMix} from "../src/mixed-priority.js";
test("shared browser engine runs bounded paired synthetic mixed failure conditions",()=>{
 const r=runPriorityMix({baseSeed:123,seeds:2,trials:2,attempts:8,budget:18,
   families:["modular"],mixes:["balanced"]});
 assert.equal(r.groups.length,1);
 assert.equal(r.groups[0].exactFundedSpend,true);
 assert.equal(r.canRoute,false);assert.equal(r.canAuthorize,false);
});
test("React lab is mounted and isolated from production E0 routing",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const component=readFileSync(new URL("../src/MixedPriorityLab.jsx",import.meta.url),"utf8");
 assert.match(app,/import MixedPriorityLab/);
 assert.match(app,/<MixedPriorityLab\/>/);
 assert.match(app,/href="#mixedpriority"/);
 assert.match(component,/READ-ONLY/);
 assert.match(component,/Standard traffic/);
 assert.doesNotMatch(component,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
