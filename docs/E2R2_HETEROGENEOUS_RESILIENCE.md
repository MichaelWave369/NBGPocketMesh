# E2-R2 · Heterogeneous network resilience (frozen synthetic R2 experiment)

**Classification:** SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.
**Location:** independently added site/src/heterogeneous-resilience.js and React Heterogeneous lab. No changes to the E0 router, E2-R1, E2-T graph signatures, execution gates, trust roots, approvals, or live networking.

## Research question

Does a preselected cost-bounded protection policy based on expected traffic exposure and synthetic failure hazard keep more *modeled* traffic serviceable during identical edge-failure attempts than simpler same-budget alternatives?

The model is explicitly not a calibrated physical link/network reliability model, not a quantum OAM system, not measured AI inference or mesh resiliency, and not a safe deployment policy. A superior score here does not establish general superiority.

## Fixed network and deterministic heterogeneous attributes

Reuse E2-T's A/B 47-node eight-regular 188-edge undirected circulant graphs:
- A offsets ±1, ±2, ±3, ±4;
- B offsets ±1, ±2, ±3, ±5.

For every edge, a deterministic hash of the fixture seed and original endpoint IDs generates five original fields:
- latency 1..7 arbitrary hop-delay units;
- capacity 2..9 whole flow units;
- protectionCost 1..4 abstract expense units;
- riskWeight 1..9 relative *sampling weight*, **not an observed or calibrated per-edge probability**.

The fixture includes **94 directed flows**, two fixed destination offsets per vertex, with 1..3 whole units of demand each. All policies use the SAME graph, attributes, demand order and traffic demands.

These attributes are arbitrary, unmeasured, and not independent samples from real infrastructure. No operator-submitted topology or data file is accepted in this rung.

## Routing evaluator (not the PocketMesh E0 router)

The evaluator uses deterministic lowest-aggregate-latency shortest paths on a surviving graph. Each flow is unsplittable, and a path is feasible only if **every edge's residual capacity can carry the entire flow**. Flows are assigned in fixed ID generation order; once assigned, each edge's residual capacity is decreased by the flow units. A flow without a capacity-feasible route is unserved.

The result measures:
1. **Primary metric:** served-demand fraction = served units / total requested units (larger is better).
2. **Secondary metric:** mean penalized latency, where a served flow contributes route latency per demand unit, and an unserved flow contributes a fixed penalty of 100 per unit. This is *not measured latency* and the penalty is explicitly arbitrary.
3. Failure attempts actually averted by protection, failed edges remaining, spending and protected-link count.

No packet-level routing, queuing, retries, split flows, real hardware delay, bandwidth time window, congestion optimization, protocol interoperability or production transport behavior is simulated.

## Before-the-outage protection policies

All policies select their protected edge IDs **before** any trial's attempted failures are generated or inspected. They share the same **maximum spending ceiling** of 24 cost units by default. Greedy cost-based selection may spend different *exact* amounts and protect different numbers of links; both are reported.

- **topology_risk:** sum of baseline-capacity allocated demand units on an edge × its relative failure weight / protection cost. This is a demand-exposure-and-risk heuristic based on graph routes, *not topology alone*.
- **demand_only:** baseline route exposure / cost.
- **risk_only:** relative failure weight / cost.
- **capacity_only:** capacity × relative failure weight / cost.
- **random:** fixed seeded edge hash ranking, no graph score.
- **unprotected:** zero-cost/zero-links reference, clearly not an equally budgeted competitor.

Tie breaking and random policy priorities depend only on the fixture seed/edge IDs, not the future attempted outages. No model training, online selection or experiment-outcome retuning occurs.

## Paired synthetic failure generator

For each graph × outage setting, all policies encounter the **identical attempted failure list** for each trial:
- **risk_weighted:** sample 26 distinct edges from all 188, without replacement, weighted by relative risk.
- **regional_risk_weighted:** choose an eight-node contiguous ring-label region using the trial seed, consider edges touching that region and draw 26 weighted attempts without replacement.

Sampling uses exponential racing. Protecting an attempted edge prevents it from being removed for that particular scenario; other attempted edges disappear. This is a stylized engineered failure model. The counts are fixed, not Bernoulli rates, and the declared risk weights are not measured probabilities.

Use 24 frozen paired trials by default (seed 369) for each of the four graph/outage combinations. Other bounded settings may be selected in the local React laboratory and exported independently; compare only the predefined frozen runs when discussing the initial outcomes.

## Software and fairness validation

From repository root:

    npm test
    npm run demo:e2r2

From site:

    npm run test --prefix site
    npm run build --prefix site

Test cases enforce deterministic reproduction, 47/188/94 fixture dimensions, heterogeneous bounded attribute fields, equal maximum protection cost ceilings, selection before failures, identical outage attempts across policies, correct per-trial survival arithmetic, frozen unprotected reference, A/B and regional/uniform families, and strict parameter validation.

The CLI exports four full frozen scenario records and SHA-256 digest for accidental tampering detection. Hashes are **unsigned** and re-computable, so they do not establish provenance, network measurement authenticity or superiority. The React view keeps everything inside the browser and exports JSON locally. No private packets, operator data or connection credentials are used.

## Essential caveats

- This model evaluates a **single synthetic demand distribution and greedy flow ordering**. Non-optimal greedy allocation can occasionally make aggregate penalized latency change counterintuitively after failures.
- Graph A/B differ only by one ring-offset class. Their degree distributions are identical, even though link attributes vary with endpoint IDs.
- The topology_risk policy has access to baseline demand routing exposure AND known relative risk weights; this advantage in available information must be disclosed when comparing it to policies that use only one feature. Demand-only, risk-only and capacity-only are essential ablations.
- Spending ceilings are equal, but *exact costs* can differ. Normalize or matched-spend testing may be needed for stronger policy comparisons.
- Repeated deterministic seeds are not an independent real-world held-out sample; no error bars, causal conclusions, field failure prediction or verified operational advantage are asserted.
- There is no LightBridge optical transfer, quantum entanglement, 48-dimensional Hilbert-space topology, security authentication, learned inference or new physical phenomenon in this module.

## Next gate

Introduce topology datasets from independently authorized, public-source engineering measurements only after permission and privacy review. Add held-out, unseen network structures, independent time-disjoint failure logs, realistic unit-consistent link costs, route congestion, queuing and actual throughput/latency accounting. Keep user controls local and route authority separate. Benchmark a genuinely matched equal-spend risk+traffic baseline before elevating any efficiency claim.
