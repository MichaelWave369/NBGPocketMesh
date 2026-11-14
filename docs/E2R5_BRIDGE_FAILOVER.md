# E2-R5 · Bridge-critical demand and failover research

**Classification:** SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.

## Research question and key caveat

On an entirely artificial 47-node network, how does protection of graph-theoretic cut edges compare with normal structural/risk/traffic baselines when a bridge is deliberately attacked? How do static routing, limited repair and complete route recomputation differ?

A bridge-targeted outage is **predesigned to reward bridge-aware protection**. This is a controlled adversarial stress case, **not** a blinded demonstration of broad superiority. Nonbridge outages on the same modular graph and a hub-like graph with no bridges are mandatory negative controls. E2-R5 never changes live E0 routing or validates optical, wireless, quantum OAM or production network failover.

## Reused structural fixtures

E2-R5 uses unchanged E2-R4 generated fixtures:

- Modular: three local communities, sizes 15/16/16, connected by precisely **two graph-theoretic bridge edges**.
- Preferential: hub-skewed connected 47-node network with **zero bridges** in this predeclared generator.

An independent depth-first low-link algorithm finds exact graph bridges. For each, mathematical removal and a BFS identify pairs of demand endpoints that become disconnected. The union of these flows is labeled **bridge-dependent**; a flow crossing two bridge cuts is counted only once. This is graph structure, **not** an operator-assigned priority, SLA, protected emergency service or measured end-user importance.

Each fixture contains 94 directed deterministic unsplittable traffic demands, synthetic link capacities 2–9 whole units, delays 1–7 model units, costs 1–4 arbitrary spend units and relative hazard weights 1–9. The previous strict synthetic validation adapter and E2-R2 traffic evaluator remain in place.

## Failure families

Three predeclared scenario families:
1. **Modular + bridge attack:** deliberately target one of its two structural bridge edges, plus (N-1) nonbridge edges sampled with relative risk weights, without replacement. Which bridge is attacked is determined by the trial seed.
2. **Modular + nonbridge control:** the same N attempted failures drawn only from nonbridge links; both structural bridges remain intact.
3. **Preferential + nonbridge control:** the same N risk-weighted failures on the bridge-free hub network. There are no bridges to target.

All strategies experience the **identical attempted failed-edge IDs** within a given paired trial. Protection lists are selected before any trial's failures are drawn. A protected attempted link survives; another attempted link is removed.

Frozen CLI: **4 fixture seeds × 4 paired trials × 3 scenario families = 48 paired synthetic outage scenarios**, with seed 369, 12 attempted failed links per trial and an exact 24-unit synthetic protection expenditure for every funded policy.

## Preselected exact-spend policies

- bridge_guard: prioritizes graph cut edges weighted by affected synthetic demand units, then uses relative hazard to fill out its resource budget.
- centrality_risk: E2-R4 graph edge betweenness multiplied by relative hazard.
- exposure_risk: E2-R4 capacity-feasible intact route exposure multiplied by hazard.
- risk_only: declared relative hazard.
- random: seeded arbitrary priorities.
- unprotected: **zero-cost** reference, not an equal-resource competitor.

All five funded policies use an exact-cost 0/1 knapsack selection and are checked to spend exactly the same arbitrary cost. Policies may protect different numbers of edges. Policies do **not** have identical inputs: the bridge guard knows which intact graph links are cut edges. Equal cost does not mean a matched-information or unbiased superiority study.

## Three distinct recovery modes

Evaluate the same frozen traffic demands and surviving network for each funded and unprotected strategy:

1. **static (no reroute):** retain an originally admitted flow only when its exact old path survives; drop disrupted placements without attempting repair or admitting formerly unserved demand.
2. **repair (limited path repair):** reserve capacity for all surviving original placements, then try to reroute only disrupted originally served flows in frozen order; never move unaffected flows or admit formerly unserved flows.
3. **full (full reallocation):** reset and rerun all flows on surviving edges, in fixed order, using shortest-model-latency capacity-feasible paths. Numerically cross-check total served units against the frozen E2-R2 reference evaluator.

Full reallocation is not guaranteed to maximize total served units because the traffic allocator is fixed-order greedy. Limited repair cannot reduce served units below no reroute because it preserves every surviving baseline placement. None of these modes measures real recovery time, packet loss, retries, control-plane convergence or multipath splitting.

Outcomes: all-demand served units and fraction, requested/served bridge-dependent units and fraction (undefined when no bridges exist), retained original-route units, changed-path units, modeled successful-flow latency, failed edges prevented, removed edges and removed graph bridges.

Predeclared primary metric: for modular networks, **bridge-dependent fraction served after full reallocation**; for the bridge-free hub network, **all-demand fraction served after full reallocation**. This avoids treating an absent critical-demand class as zero service.

## Reproduce and review

Root repository:

    npm test
    npm run demo:e2r5

React research console:

    npm run test --prefix site
    npm run build --prefix site

The CLI prints a frozen concise ledger plus an **unsigned** SHA-256 digest over the full deterministic report. It is freely recomputable and not authenticated provenance. The React **Failover** panel exports all trial attempted failures, protective edge sets and scenario outcomes locally. No networking, secrets, private payloads or service identities are accessed.

Tests check exact bridge cuts and demand classification, zero bridges on the hub control, authoritative synthetic input rejection, deterministic equality across reruns, preselected equal spending, matching failed-edge attempts for every policy, bridge-free negative controls, full reallocation consistency with E2-R2, and non-regression from static to limited repair.

## Limitations and next gate

This is **entirely synthetic**. Bridge-targeted failures strongly favor advance bridge detection by experimental construction. The modular graph is deliberately small and simple. Link priorities, traffic, costs, delay units and failure weights are fabricated rather than drawn from measured infrastructure.

The experiment cannot establish production performance, faster recovery, quantum light topology, better encryption, real reliability, or permission to operate PocketMesh E0. Only independent authorized public datasets, representative network graph families, mixed blinded fault distributions, explicit critical-demand classification and realistic packet/convergence measurements could justify real deployment recommendations.
