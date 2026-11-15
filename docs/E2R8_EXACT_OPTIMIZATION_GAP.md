# E2-R8 · Exhaustive Tiny-Graph Optimization Gap Lab

**Classification:** SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.

## Research question

E2-R7 called a standard-service floor *unattainable under greedy* when its fixed-order capacity-aware flow allocator could not meet the target. That does NOT establish mathematical infeasibility. E2-R8 tests the distinction on tiny, artificial networks where every whole-flow admit/reject choice and every simple path can be examined.

This **does not** solve or certify the original 47-node E2-R7 optimization problem.

## Frozen tiny fixtures

1. **Fork:** four nodes, four edges, two standard demands and one priority demand. A short path blocks two later flows, but a slower alternate path admits all three.
2. **Bridge:** six nodes in two triangles joined by one cut edge, five demands and capacity-one bridge.
3. **Mesh:** six nodes and nine links with multiple alternate routes and six demands. Artificial delays vary deterministically by seed.

Each structure is evaluated with links **intact** and with one predeclared failed edge (fork 0-2, bridge 2-3, mesh 1-4). All capacities lie in 1–3 whole flow units and all demands are unsplittable. Requested standard-class floors are **0%, 40%, 70%, and 100%**, with a target equal to the ceiling of floor percentage times standard requested units. That creates 3 graph types × 2 fault cases × 4 floors = **24 paired synthetic comparisons**.

## Greedy and exhaustive methods

The **greedy** model mimics E2-R7's three-stage admission order on this separately validated tiny fixture: (1) reserve standard traffic until the floor or exhaustion, (2) admit priority demands, then (3) retry remaining standard demands. It chooses the first capacity-feasible simple path sorted by total modeled path latency and deterministic tie ordering. The independent standard-first greedy allocator supplies an algorithm-relative floor attainability estimate.

The **exact** model enumerates all simple source-to-destination paths and a reject option for each demand, then explores all route/admission combinations under exact per-link capacity constraints. Its lexicographic optimization objective is:
1. maximize priority units served **subject to** satisfying the standard floor;
2. for equal priority units, maximize all served units;
3. then minimize the sum of modeled route latencies weighted by admitted units.

It separately records the greatest standard-demand units attainable by any admissible assignment. Consequently it distinguishes **mathematically infeasible within this exact tiny model** from **feasible but missed by greedy**. Among floor-satisfying greedy cases, it reports priority-service gaps, total-service gaps or matched service counts.

**Proof limits are strict:** no more than 7 vertices, 10 links, 7 demands, 128 simple paths per demand or 2,500,000 exhaustive search states. The solver fails closed with EXACT_NOT_CERTIFIED if the path or search cap is reached. It must not present a partial search as proof.

## Constructive counterexample

The intact **fork** has links:
- 0-1: capacity one, latency one;
- 1-3: capacity one, latency one;
- 0-2: capacity one, latency two;
- 2-3: capacity one, latency two.

Standard s-through travels 0 to 3, standard s-local travels 0 to 1, and priority p-direct travels 1 to 3; each requests one whole unit.

Greedy standard-first routes s-through along faster 0-1-3 and blocks s-local as well as p-direct, so it serves only 1/2 requested standard units. An exhaustive alternative routes s-through along 0-2-3, s-local along 0-1 and priority along 1-3: **all three demands fit**, meeting the 100% standard floor.

If link **0-2 is removed**, both standard demands must share capacity-one edge 0-1; the 100% standard floor becomes **provably infeasible within this tiny model**. These two situations are intentionally contrasted.

## Verification and reproducibility

Tests assert both constructive claims, deterministic full-run hashes, path continuity and simplicity, no failed-link traversal, exact shared edge capacities, bounded fixture validation, trusted synthetic-only inputs and that greedy never exceeds the lexicographic proven optimum when it meets the requested floor. The site regression checks that the lab never imports production route/execution modules.

Run from root:

    npm test
    npm run demo:e2r8

Run from React site:

    npm run test --prefix site
    npm run build --prefix site

The offline browser **Exact Gap** section allows choosing a tiny fixture, failure case, floor and synthetic seed. It visualizes the tiny graph, displays the paired service unit counts and exposes the number of exhaustive search states plus a locally downloadable witness/metadata report.

The CLI computes an unsigned SHA-256 hash over the complete deterministic report. The hash is a **consistency checksum only**, not independently verified provenance or a physical proof.

## No generalization beyond these bounds

The exhaustive model certifies only **small synthetic whole-flow routing with all simple paths** and the stated lexicographic objective. It is not proof about any 47-node flow allocation, real SLA guarantee, optimal packet QoS, online controller, graph-wide traffic engineering, physical reliability, optical OAM or quantum processor. E0 routing, signed gates, authorization and existing E2-R1 through E2-R7 code paths remain untouched.

Future work: compare exact bounded optimizers on carefully extracted small subgraphs from the original 47-node fixtures and cross-check against an independent solver formulation before discussing broader generalization.
