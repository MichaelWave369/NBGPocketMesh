# E2-T Topological Keyhole R1: classical Phi47 graph invariants

Evidence: SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.

**Scope:** an independent classical graph research experiment, not a quantum state, real mesh routing policy, trust protocol, OAM communication scheme, or verified performance improvement.

## Motivation and boundaries

The paper "Revealing the topological nature of entangled orbital angular momentum states of light" (Nature Communications, 2025, https://www.nature.com/articles/s41467-025-66066-3) suggests an appealing research METHOD: compare transformations using invariants and perturbations. The paper's SU(7) 48-dimensional state-space coordinates are NOT the same mathematical object as a classical 47-node graph. The numerical resemblance of 47 and 48 is not evidence of a physical relationship.

Pocket Mesh already distinguishes representation invariance through E2-K. E2-T is additive and never calls E0 routing, execution, approvals or signed gates.

## Frozen fixtures

Two undirected 47-vertex 8-regular circulant graphs:

- A: ring offsets +1, +2, +3, +4 and corresponding negative directions.
- B: ring offsets +1, +2, +3, +5 and corresponding negative directions.

Both have E=188, V=47, one component and ordinary graph cycle-space dimension beta1=E-V+C=142. A has 282 triangles, B has 235. The simple coarse statistics match, but the structural triangle count differs.

Synthetic edge weights are assigned by offset class as 0.95, 0.80, 0.65 and 0.50. These are not measured link reliability, performance, quantum amplitudes or confidence. The fixed filtration thresholds are 0.90, 0.75, 0.60, 0.45 and 0.00, including edges whose weight is >= the threshold.

## Invariants measured

For each threshold, the standalone site/src/topology-keyhole.js module computes:
- beta0: connected component count, including isolated vertices.
- Degree histogram and undirected edge count.
- Graph cycle rank: E - V + beta0.
- Exact triangle count and exact undirected 4-cycle count, including chorded cycles.
- Rank over GF(2) of the triangle boundary matrix.
- Clique-complex first Betti number through the 2-skeleton: graph cycle rank minus triangle boundary rank.

Clique-complex H1 is NOT equivalent to the unfilled graph cycle rank. This is a finite threshold sequence, NOT a complete persistence barcode or a proof of isomorphism. Non-isomorphic graphs may share all listed descriptors. No higher homology is claimed.

## Negative and perturbation controls

1. Relabel vertices with deterministic seeded Fisher-Yates permutation while preserving each edge and weight. Every structural metric must remain identical. Raw adjacency hashes generally change.
2. Compare degree-matched A and B; coarse statistics agree but triangles differ.
3. Apply a deterministic degree-preserving 2-switch to A. Preserve all degree-eight nodes and connectivity, but change triangles.
4. Delete six selected edges and inspect changes in basic statistics and topology.

No edge is added to a real network, no provider interface is called, no trained model is executed.

## Source, tests and receipts

At repo root run:

    npm test
    npm run demo:e2t

Regression tests check A/B degree and triangle counts, exact relabeling invariance, degree-preserving rewiring, deletion, the filled-triangle and unfilled-square clique H1 cases, threshold monotonicity, Euler identities and hostile malformed input rejection.

The deterministic CLI prints THREE unsigned SHA-256 values:
- adjacencyDigestSha256 depends on actual numbered endpoints and weights. It changes under most relabelings.
- structuralDigestSha256 hashes only the measured invariant summary and threshold series. It is stable under relabeling but is not unique to isomorphism classes.
- receiptDigestSha256 hashes the demo output. Its creator can recompute it freely, so it does not establish provenance or truth.

The module's analysis returns authority NONE, action ANALYZE_ONLY, canRoute:false, canExecute:false, canAuthorize:false. No model weights, execution, network traffic, permissions, identity or private payloads are involved.

The merged Phi47 research receipt from PR #29 stays independent. We do not alter its frozen two-metric input schema or promote these new graph results into an execution gate.

## Future research milestones

- Widen the family of hard, degree-matched negative controls and report collisions.
- Add a full persistence pairing/barcode implementation with numerical and benchmark tests.
- Independently benchmark graph descriptors against simple routing or fault tolerance baselines before claiming practical benefit.
- Investigate OAM quantum topology only in a separate SU(d) state-space model aligned to published definitions. Graph invariants here are not quantum-entanglement invariants.
