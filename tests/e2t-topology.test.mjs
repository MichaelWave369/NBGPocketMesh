import test from "node:test";
import assert from "node:assert/strict";
import {
  ringGraph,validateGraph,seededPermutation,relabelGraph,analyzeGraph,
  compareGraphAnalyses,degreePreservingSwap,dropEdges,FILTER_THRESHOLDS
} from "../site/src/topology-keyhole.js";
const summarize=g=>analyzeGraph(g);
test("two 47-node eight-regular meshes have the same coarse metrics but different triangles",()=>{
  const a=summarize(ringGraph([1,2,3,4]));
  const b=summarize(ringGraph([1,2,3,5]));
  for(const m of [a,b]){
    assert.equal(m.measurements.vertices,47);
    assert.equal(m.measurements.edges,188);
    assert.equal(m.measurements.components,1);
    assert.equal(m.measurements.cycleRank,142);
    assert.deepEqual(m.measurements.degreeHistogram,{"8":47});
    assert.equal(m.canRoute,false);
    assert.equal(m.canExecute,false);
    assert.equal(m.canAuthorize,false);
    assert.equal(m.action,"ANALYZE_ONLY");
    assert.equal(m.filtration.length,FILTER_THRESHOLDS.length);
    for(const level of m.filtration) {
      assert.equal(level.cycleRank,level.edges-47+level.components);
      assert.ok(level.cliqueBetti1>=0 && level.cliqueBetti1<=level.cycleRank);
    }
  }
  assert.equal(a.measurements.triangles,282);
  assert.equal(b.measurements.triangles,235);
  assert.equal(compareGraphAnalyses(a,b).basicMatches,true);
  assert.equal(compareGraphAnalyses(a,b).richerMatches,false);
  assert.ok(compareGraphAnalyses(a,b).differences.includes("triangles"));
});
test("deterministic relabeling leaves complete structural signature unchanged",()=>{
  const g=ringGraph();
  const perm=seededPermutation(123456);
  const relabeled=relabelGraph(g,perm);
  assert.notDeepEqual(relabeled.edges,g.edges);
  assert.deepEqual(summarize(relabeled),summarize(g));
  assert.deepEqual(seededPermutation(123456),perm);
  assert.notDeepEqual(seededPermutation(7),perm);
});
test("degree-preserving 2-switch changes short-loop structure without changing basic counts",()=>{
  const g=ringGraph();
  const modified=degreePreservingSwap(g);
  const a=summarize(g),b=summarize(modified);
  assert.equal(compareGraphAnalyses(a,b).basicMatches,true);
  assert.notEqual(a.measurements.triangles,b.measurements.triangles);
  assert.equal(compareGraphAnalyses(a,b).richerMatches,false);
  assert.deepEqual(b.measurements.degreeHistogram,{"8":47});
});
test("edge deletion breaks basic summary while keeping graph metrics internally consistent",()=>{
  const g=ringGraph();
  const removed=summarize(dropEdges(g,6));
  assert.equal(removed.measurements.edges,182);
  assert.equal(removed.measurements.cycleRank,removed.measurements.edges-47+removed.measurements.components);
  assert.equal(compareGraphAnalyses(summarize(g),removed).basicMatches,false);
});
test("triangle fills one graph cycle over GF(2); square remains one cycle",()=>{
  const base=ringGraph();
  const triangle=summarize({...base,edges:[[0,1,1],[0,2,1],[1,2,1]]});
  assert.equal(triangle.measurements.edges,3);
  assert.equal(triangle.measurements.components,45);
  assert.equal(triangle.measurements.cycleRank,1);
  assert.equal(triangle.measurements.triangles,1);
  assert.equal(triangle.measurements.triangleBoundaryRank,1);
  assert.equal(triangle.measurements.cliqueBetti1,0);
  const square=summarize({...base,edges:[[0,1,1],[1,2,1],[2,3,1],[0,3,1]]});
  assert.equal(square.measurements.cycleRank,1);
  assert.equal(square.measurements.triangles,0);
  assert.equal(square.measurements.fourCycles,1);
  assert.equal(square.measurements.cliqueBetti1,1);
});
test("rejects malformed, untrusted or unsafely oversized graph requests",()=>{
  const g=ringGraph();
  for(const patch of [
    {authority:"ROUTE"},{origin:"PHYSICAL"},{privacy:"private"},
    {rawPrompt:"inject"},{nodes:48},{edges:[[0,0,1]]},
    {edges:[[0,1,1],[1,0,1]]},{edges:[[0,1,Number.NaN]]},
    {edges:[[0,2,1.1]]},{edges:[[0,48,.5]]},
    {edges:Array.from({length:301},()=>[0,1,.9])}
  ])assert.throws(()=>validateGraph({...g,...patch}),/Invalid|Duplicate|unauthorized/);
  assert.throws(()=>ringGraph([1,2,2,4]),/four distinct/);
  assert.throws(()=>relabelGraph(g,Array(47).fill(0)),/bijection/);
  assert.throws(()=>dropEdges(g,13),/Drop count/);
  assert.throws(()=>seededPermutation(-1),/seed/);
});
test("filtration thresholds contain all links at zero and progressively fewer at larger thresholds",()=>{
  const a=summarize(ringGraph());
  assert.deepEqual(a.filtration.map(f=>f.edges),[47,94,141,188,188]);
  for(let i=1;i<a.filtration.length;i++)assert.ok(a.filtration[i].edges>=a.filtration[i-1].edges);
  assert.equal(a.filtration[0].cycleRank,1);
  assert.equal(a.filtration.at(-1).cycleRank,142);
});
