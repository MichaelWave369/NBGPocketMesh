# E2-R R1 · Frozen synthetic graph link-protection benchmark

## Purpose and authority
Can *unweighted edge-betweenness centrality* help select a limited set of links to protect against synthetic outages, compared with equally budgeted degree and randomized baselines?

This is an original, offline, deterministic, classical graph experiment with:
- origin SIMULATED, privacy public-synthetic, action ANALYZE_ONLY, authority NONE;
- canRoute false, canExecute false, canAuthorize false;
- no modification to E0 routing, E2-T topology invariants, R8–R14 trust processes, Φ47 receipts or Pocket Albums;
- no real link protection, network operations, identity, hardware measurement, model inference or quantum OAM phenomena.

## Frozen fixtures and policies
Use exactly the two existing E2-T undirected 47-node, eight-regular graphs: ring offsets A = ±1, ±2, ±3, ±4, and B = ±1, ±2, ±3, ±5. Both have 188 edges; all edge weights are deliberately **ignored** by this *unweighted hop* experiment.

At the default budget of **12 protected links**, methods choose all their protected links **before** any test outage is generated:
1. TOPOLOGY: exact unweighted Brandes edge-betweenness on the intact graph. Score is the sum of fractional shortest-path dependencies for every source-target pair. Ties resolve by a deterministic edge identifier/hash, not future failures.
2. DEGREE: sum of the two endpoint degrees. This is a deliberately simple baseline; every endpoint degree equals eight, so the method has no discriminating degree signal and must break ties with a seeded hash.
3. RANDOM: a separate deterministic seeded-hash ranking, giving each edge an arbitrary priority independent of graph metrics and failures.
4. UNPROTECTED: zero protected links, as a **lower-resource reference**, not an equal-budget comparator.

Equal budget applies only to TOPOLOGY, DEGREE and RANDOM. The distinct seeded tie-breakers are predetermined, not tuned on trial outcomes.

## Outage models and holdout procedure

For every graph/outage combination:
- Default **24 paired trials** with precommitted seed 369, 20 attempted failed edges and a budget of 12.
- Uniform: shuffle all edge identifiers using an independent seeded RNG and select 20.
- Regional: draw a seed-selected starting vertex, define an eight-node consecutive segment of ring labels, then shuffle candidate edges incident to that segment and select 20. This is an intentionally synthetic label-based *stress scenario*, **not** a physical outage distribution or geographical truth.
- For a given trial, apply the **identical outage list** to all four protection methods. A protected link survives a failed-edge attempt; all other failed edges are removed.
- Recompute **all unordered 47×46/2 = 1,081 vertex-pair** shortest-path hop counts using BFS. Record unreachable pairs and assign 47 hops as a fixed disconnection penalty in the comparison metric.
- Primary descriptive metric: average *penalized hop inflation* relative to the same graph without failures. Lower is better **within this synthetic objective**.
- Secondary descriptive metrics: mean failed edges remaining, mean saved failed edges, fraction of reachable pairs, mean unreachable pairs.
- Report arithmetic paired differences. Negative differences are possible and must not be concealed.

There is **no training, tuning, or search over test failures** performed by the protection policies. The simulated failure generator and policies are separately seeded but not certified as physically independent random sources. The deterministic fixture repetitions are not a real-world held-out distribution, and results have no error bars or statistical generalization claims.

## Run and audit

From the repo root:

    npm test
    npm run demo:e2r

For the React site:

    npm run test --prefix site
    npm run build --prefix site

The CLI runs the four predeclared graph/outage combinations and prints a deterministic JSON report with trial-level outage IDs, protected edge sets, paired metrics, source labels and a SHA-256 digest. A digest is recomputable and **does not authenticate an execution or source provenance**. The browser's Resilience tab shares the exact same engine and exports all trial rows locally. Nothing is uploaded by the benchmark.

## Important limitations and negative controls
- Topological betweenness is a conventional graph algorithm; an improvement would not prove new NBG mathematics, model intelligence, unique topological identity or a verified hardware advantage.
- The endpoints all have degree eight. Degree is intentionally a weak control here. Add degree-heterogeneous networks before comparing generalized degree heuristics.
- These graphs are fairly dense; most small outages may not disconnect them. Small or zero differences should be reported, not reinterpreted as positive results.
- Average hop count does not measure physical packet latency, throughput, energy, error rate, security or real routing protocol cost.
- Structural computations on the intact graph cannot know real future failures. Protection has no per-edge implementation cost model beyond the identical link-count budget.
- Repeated fixture seeds, vertex relabeling and synthetic edge weights do not represent measured network traffic or learned paths.
- The control tests require same-seed repeatability, matching outage lists across policies, budget equality, nonnegative path inflation under edge deletion, malicious input refusal and no authority escalation.

## Next real engineering gate
Apply the same *fixed* policy family to independently collected, consented **public** network topologies and independent fault logs, with edge capacities, heterogeneous link cost, traffic demands and privacy review. Keep real network access out of this experimental repo until separately authorized. Compare credible same-budget degree, random, demand-based and network-engineering baselines. Only then discuss whether topology adds practical value.
