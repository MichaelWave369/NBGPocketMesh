import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runServiceFloorCohort} from "../src/service-floors.js";
test("React and Node share deterministic, authority-free standard floor model",()=>{
 const out=runServiceFloorCohort({baseSeed:369,seeds:2,trials:2,attempts:8,budget:18,
   families:["preferential"],mixes:["balanced"],floors:[0,20,40]});
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].exactFundedSpend,true);
 assert.equal(out.canRoute,false);
 assert.equal(out.canExecute,false);
 assert.equal(out.canAuthorize,false);
});
test("React service floor lab mounts without E0 routing imports",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/ServiceFloorLab.jsx",import.meta.url),"utf8");
 assert.match(app,/import ServiceFloorLab/);
 assert.match(app,/<ServiceFloorLab\/>/);
 assert.match(app,/href="#servicefloors"/);
 assert.match(ui,/READ-ONLY/);
 assert.match(ui,/Standard traffic/);
 assert.doesNotMatch(ui,/(?:import|from)\s+['"][^'"]*(?:\/router|pocket-executor|pocket-anchor)/);
});
