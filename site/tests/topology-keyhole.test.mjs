import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  ringGraph,analyzeGraph,relabelGraph,seededPermutation,
  compareGraphAnalyses,degreePreservingSwap,dropEdges
} from "../src/topology-keyhole.js";
test("browser and Node share the same deterministic classical graph engine",()=>{
  const base=ringGraph(),alt=ringGraph([1,2,3,5]);
  const a=analyzeGraph(base),b=analyzeGraph(alt);
  assert.deepEqual(a.measurements.degreeHistogram,{"8":47});
  assert.equal(a.measurements.edges,188);
  assert.equal(a.measurements.cycleRank,142);
  assert.equal(a.measurements.triangles,282);
  assert.equal(b.measurements.triangles,235);
  assert.equal(compareGraphAnalyses(a,b).basicMatches,true);
  assert.equal(compareGraphAnalyses(a,b).richerMatches,false);
});
test("read-only site model recognizes relabel and degree-matched rewiring",()=>{
  const g=ringGraph(),a=analyzeGraph(g);
  assert.deepEqual(analyzeGraph(relabelGraph(g,seededPermutation(369))),a);
  assert.equal(compareGraphAnalyses(a,analyzeGraph(degreePreservingSwap(g))).basicMatches,true);
  assert.equal(compareGraphAnalyses(a,analyzeGraph(dropEdges(g,6))).basicMatches,false);
  assert.equal(a.canAuthorize,false);
  assert.equal(a.canExecute,false);
  assert.equal(a.canRoute,false);
});
test("React console renders Topological Keyhole without importing executable router",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const component=readFileSync(new URL("../src/TopologicalKeyhole.jsx",import.meta.url),"utf8");
  assert.match(app,/import TopologicalKeyhole/);
  assert.match(app,/<TopologicalKeyhole\/>/);
  assert.match(app,/href="#topology"/);
  assert.match(component,/READ-ONLY/);
  assert.doesNotMatch(component,/(?:import|from)\s+['"](?:.*router|.*pocket-executor)/);
});
