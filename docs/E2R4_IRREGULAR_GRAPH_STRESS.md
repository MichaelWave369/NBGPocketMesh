# E2-R4 Irregular Graph Stress Lab

**Evidence classification: SIMULATED / ANALYZE_ONLY / authority NONE.**

## Purpose

Earlier E2-R1 through E2-R3 relied on *two fixed eight-regular circulant* 47-node graphs. Those networks conceal actual degree heterogeneity and lack the kinds of bridges that can make clustered infrastructure fragile. E2-R4 adds two deterministic, connected, **classical graph** generators with the same 47-node envelope and genuine unequal-degree structures.

This is NOT a measured network, a real optical mesh, a 48-dimensional OAM quantum system, a deployed routing strategy, an authenticated experiment, or a new topology theorem. It never talks to live routing and retains all PocketMesh authorization/trust boundaries.

## Structural families

1. **Preferential attachment**: start with a 3-clique; add vertices 3 through 46, each connecting to 2 existing vertices, or 3 at multiples of 5. Targets are sampled without replacement in proportion to existing degree plus one, using a seeded xorshift pseudorandom generator. This makes a connected *hub-skewed* graph. It is not claimed to fit an observed scale-free power law.

2. **Modular bridge**: build separate local ring communities of 15, 16 and 16 vertices, with each vertex linked to its ±1 and ±2 neighbors within its own community. Link community 1 to community 2 once, then community 2 to community 3 once. The resulting graph has **two graph-theoretic bridge edges**, and its non-regular degrees are confirmed through exact graph algorithms. Communities, bridge placements and labels are entirely synthetic.

Every fixture measures edge count, degree minimum/maximum/variance, connected components, cycle rank and graph bridge count. Both are connected and degree-heterogeneous. Network link attributes, demands and failures vary by fixture seed. These are not independent physical deployments.

## Reused E2-R2 traffic evaluator

E2-R4 adds a narrow validation-checked evaluation adapter to the pre-existing E2-R2 capacity-aware shortest-latency greedy synthetic traffic model. It accepts ONLY the bounded, explicitly SIMULATED E2-R4 fixture schema and rejects invalid nodes, duplicate edge IDs, unknown failure IDs, invalid ranges, malformed demand counts and unauthorized flags. The original E2-R2 engine, E2-R3 outcomes, E0 router, and all signed gates continue to work unchanged.

Each edge has deliberately fabricated:
- capacity 2–9 whole flow units;
- latency 1–7 arbitrary units;
- protection cost 1–4 synthetic spend units;
- relative outage weight 1–9, NOT a probability.

Every graph has 94 ordered, unsplittable demands using the same (relative) destination offsets as earlier experiments. Each source demand is placed on a deterministic shortest-latency, residual-capacity-feasible path, if one exists. The primary outcome is the mean *fraction of traffic units served*, which is not physical packet delivery, measured latency or throughput.

## Exact-cost protection policies

**All FUNDED policies spend precisely the same synthetic cost**, not just the same ceiling, using a deterministic exact-cost 0/1 knapsack solver over their independently preselected link scores. A zero-cost unprotected strategy is provided as a distinct lower-resource reference.

Predeclared policies:
- **centrality_risk**: normalized exact unweighted Brandes edge betweenness of the intact graph times declared relative hazard.
- **exposure_risk**: normalized intact greedy-routed flow use per edge times relative hazard, using the same E2-R2 traffic evaluator.
- **matched_additive**: mean of normalized routed exposure and normalized risk.
- **matched_harmonic**: harmonic mean of normalized routed exposure and risk.
- **degree_risk**: normalized sum of endpoint degrees times relative hazard.
- **capacity_risk**: normalized modeled link capacity times relative hazard.
- **risk_only**: normalized relative hazard.
- **random**: seeded hash priority.
- **unprotected**: no protected edges and zero spend.

*Not all strategies have identical information.* Centrality uses an unweighted graph betweenness feature, exposure uses intact traffic flow, others use combinations or subsets of cost/risk/capacity/degree. Thus neither a centrality win nor a centrality loss isolates the causal contribution of pure graph topology. The exact-cost control improves expenditure fairness, not feature-information fairness.

Selection uses only the intact network fixture and declared link properties, **before any trial-specific outage is sampled**. No policies train on or inspect future failures.

## Frozen paired synthetic stress experiment

The initial CLI freezes:
- seed 369, then five additional pseudo-fixture seeds spaced by 7919;
- both graph families × **two** outage families: whole-graph risk-weighted without replacement, and synthetic vertex-label-localized risk-weighted without replacement;
- **6 fixture seeds × 6 attempted outages = 36 paired trials per family, or 144 paired synthetic scenarios across four families**;
- 20 attempted failed edges per trial;
- exact funded protection spend 24 abstract units.

For each trial, all policies see **the identical attempted failures**. Protected attempted edges remain available. Localized failures sample candidates incident to an 18-vertex contiguous range of *synthetic labels*, not real geographical locations. Weighted draws use exponential racing with risk-weight proxies, not calibrated physical failure probabilities.

Per-seed results include graph structure, protected edge lists, selected spending, failed edge IDs and per-policy served fraction. Aggregate policy averages first summarize trials within each fixture seed, then summarize across seeds. Seed-cluster percentile bootstrap differences are reported for centrality × risk against alternatives, but these merely describe synthetic fixture variation. They are not population confidence intervals, significance tests or measured resilience.

## Reproduction

From repo root:

    npm test
    npm run demo:e2r4

For the existing React console:

    npm run test --prefix site
    npm run build --prefix site

The CLI prints a concise, frozen result ledger plus the SHA-256 digest of a full recomputable result. This digest is unsigned, so it establishes neither provenance nor factual authenticity. The new **Irregular** React section runs smaller default cohorts and can export the complete trial record locally. It never uploads anything.

## Future evidence gates

- Widen graph families and include degree-matched but topologically distinct negative controls.
- Give competing policies genuinely matched access to each candidate feature, perform ablation analysis, and check selection bias from the knapsack objective.
- Test independently authorized **public** graphs with plausible failure-correlation and traffic patterns, keeping the policy-design data separate from test data.
- Simulate actual queueing, per-link traffic windows, failover control-plane convergence and routing costs before proposing any production strategy.
- Preserve the separation between the optical/OAM research analogy and classical network-graph evidence.

No claim of practical topology-guided speedup, reliability improvement or quantum information transfer follows from this laboratory alone.
