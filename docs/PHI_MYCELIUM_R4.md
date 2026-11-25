# PhiMycelium R4 — resource-matched synthetic circulation cohort
**SIMULATED / ANALYZE_ONLY / authority NONE.**

Six connected undirected 36-node fixtures start with exactly 60 links, capacity two whole units each, unit hop cost, and identical ordered 36-request demand traces per seed. Grid is 6x6; random-ring is ring plus seeded chords; recursive is nine-way parent tree plus seeded chords; Fibonacci is ring plus sequential Fibonacci-offset chords; golden uses a Euclidean minimum spanning tree and nearest unused links from golden-angle coordinates; mycelium uses the R1 append-only growth ledger with 36-node/60-edge caps. Any residual edge budget is filled with seeded pairs; topology labels are generator descriptions, not claims of biological similarity. The Fibonacci generator's 60-edge cap is reached during the first offset family, so it is a limited Fibonacci-offset baseline, not an exhaustive Fibonacci sequence model.

Every topology experiences three independently reset admission batches: intact, faulted (12 links removed by default), and regrafted. Outage counts and random index permutations are paired across topologies, but endpoint failures differ because edge lists differ. Regrafting uses identical bounded R3-inspired cyclic offsets 1,3,9,27 and connects only distinct components, avoiding failed links. It stops at connectivity, edge cap or repair cap. Post-repair realized capacity may differ: report actual links/capacity and repair counts, not equal realized spend. No topology is given exclusive repair authority.

Both allocators see exactly the same topology, residual capacity and demand order. Shortest uses unit hop cost among feasible paths; load-aware uses 1+2*(capacity-free)/capacity to penalize existing load. No splitting, retries, background traffic, learning, or future demand visibility. Capacity persists across requests within a batch, resets between phases. This is finite-batch congestion, not continuous packet routing or physical latency. Load-aware is not R0's history reinforcement; it is a separately scoped policy comparison. Served counts and total hops must be interpreted together because policies may admit different requests. A disconnected graph can still serve local demands.

Default seeds: 369, 8288, 16207, 24126, 32045, 39964. Maximum 18 unique nonzero uint32 seeds; 36 demands each, six families, three phases, two policies. Aggregate counts are descriptive synthetic results, not statistical proof or production benchmarks. Repairs assume all fixture candidates permissible; no real authorization is inferred. No changes to existing execution gates or R0–R3.

Run:
    node --test tests/phi-mycelium-r4.test.mjs
    node scripts/phi-mycelium-r4-demo.mjs

Next gate: inspect per-seed outcomes, ablate repair and routing policies, compare matched post-repair capacity and add bounded Altermath analysis-only adapter. No superiority claim without results.
