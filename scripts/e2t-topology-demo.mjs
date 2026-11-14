// E2-T isolated read-only graph research demonstration. NEVER calls E0 or an executor.
import {createHash} from "node:crypto";
import {
  ringGraph,relabelGraph,seededPermutation,dropEdges,degreePreservingSwap,
  analyzeGraph,compareGraphAnalyses
} from "../site/src/topology-keyhole.js";
const A=ringGraph([1,2,3,4]),B=ringGraph([1,2,3,5]);
const variants={
  ringA:A,
  ringB:B,
  relabeledA:relabelGraph(A,seededPermutation(369)),
  rewiredA:degreePreservingSwap(A),
  damagedA:dropEdges(A,6)
};
const fingerprint=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const analyses=Object.fromEntries(Object.entries(variants).map(([name,graph])=>{
  const analysis=analyzeGraph(graph);
  return [name,{
    adjacencyDigestSha256:fingerprint(graph.edges), // label-dependent; not a structural invariant
    structuralDigestSha256:fingerprint({measurements:analysis.measurements,filtration:analysis.filtration}),
    measurements:analysis.measurements,filtration:analysis.filtration
  }];
}));
const report={
  schema:"NBGPocketMesh.E2T.Demo.v1",origin:"SIMULATED",authority:"NONE",
  action:"ANALYZE_ONLY",canRoute:false,canExecute:false,canAuthorize:false,
  description:"47-node eight-regular synthetic ring graphs with 8-degree controls",
  comparisons:{
    A_vs_B:compareGraphAnalyses(analyzeGraph(A),analyzeGraph(B)),
    A_vs_relabel:compareGraphAnalyses(analyzeGraph(A),analyzeGraph(variants.relabeledA)),
    A_vs_rewire:compareGraphAnalyses(analyzeGraph(A),analyzeGraph(variants.rewiredA)),
    A_vs_damage:compareGraphAnalyses(analyzeGraph(A),analyzeGraph(variants.damagedA))
  },
  analyses,
  limitations:[
    "This is deterministic synthetic graph topology, not a physical network measurement.",
    "A stable structural digest does not prove graph isomorphism, identity, provenance, security or execution authority.",
    "The SHA256 hashes are unsigned and recomputable; a fabricated report may have valid hashes.",
    "No OAM quantum-state invariant, entanglement, photonic information capacity, LLM performance or speedup is demonstrated."
  ]
};
console.log(JSON.stringify({...report,receiptDigestSha256:fingerprint(report)},null,2));
