# E2-R7 · Minimum standard-service floor research

**Classification:** SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.

## Research question

Can modeled priority traffic service be improved while honoring a **declared minimum share of standard traffic** under the same failed network and exactly funded protection budgets? Is the requested standard-service floor even achievable under the **existing fixed-order greedy flow placement method** after an outage?

E2-R6 found that priority-first scheduling dramatically increased synthetic priority service but often reduced standard traffic and sometimes reduced total throughput. E2-R7 makes the sacrifice visible and tests a deterministic three-stage reservation heuristic. No actual packet QoS, SLA enforcement, network controller, device, quantum mechanism, model weights, private traffic, or E0 permission is involved.

## Boundary and precise definition of a "guarantee"

A chosen floor is an integer percentage of total **requested standard-class synthetic demand units**.

    targetStandardUnits = ceil(standardRequestedUnits * floorPercent / 100)

The study freezes the tiers **0%, 20%, 30%, 40%**, before observing the new results. A value of 0% means no standard reservation and MUST exactly reproduce E2-R6's priority-first full allocation.

A floor is **greedy-attainable** only when the preexisting greedy shortest-delay, capacity-feasible synthetic allocator, run with **all standard demands first in their original order** on the already-failed fixture, can serve at least the target amount. This is an *algorithm-relative reference*, NOT the mathematical maximum possible network flow or proof of physical feasibility.

For each link-protection policy, failed network and requested floor, three phases run using the SAME E2-R5 shortest-model-delay, unsplittable, capacity-constrained path logic:

1. **Reserve standard capacity:** admit standard demands in original order, stopping as soon as the accumulated admitted standard units reach or exceed the target. If some demands cannot be admitted, keep trying subsequent standard demands until target reached or all attempted. This may overshoot the target by one whole request.
2. **Serve priority:** greedily admit all priority requests in original relative order using surviving residual link capacities.
3. **Admit remaining standard:** retry any unserved standard demands using leftover residual capacity, without evicting admitted priority or reserved standard demands.

If the standard-first greedy reference can meet the target, the same initial admission sequence in phase 1 will meet it. The implementation asserts this **per trial** and fails testing if it does not. If the reference cannot meet the requested amount after that outage, the result records the **unattainable-under-greedy** flag, the actual standard shortfall, and both class fractions rather than inventing a successful guarantee. Another optimized multicommodity network allocation could theoretically meet such a target; this study does not rule that out.

This is a heuristic constrained allocation problem, **not an optimizer proving global Pareto efficiency**.

## Frozen paired experiment

Reuse **unchanged E2-R6** generated trials and protection lists with the existing E2-R4 graph fixtures and E2-R5 route evaluator:

- Three deterministic synthetic fixture seeds: 369, 8288 and 16207.
- Two irregular 47-node structures: three-community modular bridge graph and hub-skewed preferential graph.
- Two disclosed mixture models: balanced or cluster-heavy uniform/risk-weighted/clustered failures. The **specific future subtype and link IDs are unknown when policies choose protection**.
- Three paired outage trials per fixture and mixture; 12 attempted failures per trial.
- **36 paired simulated outage scenarios** across four graph/mixture families.
- Five funded policies plus the unprotected zero-cost reference, each evaluated at 0%, 20%, 30%, and 40% standard-demand floor targets.
- Every funded policy spends exactly **24 synthetic cost units** in the frozen CLI. The unprotected reference spends zero and is never described as an equal-budget competitor.
- Each policy receives identical attempted failure IDs within each paired trial, after its protection list was frozen.
- Service classes use the same fixture-seeded E2-R6 labels (roughly a quarter priority), not newly selected outcomes.

The policies are unchanged from E2-R6: priority-exposure × risk, all-demand exposure × risk, bridge-priority × risk, hazard only, seeded random, zero-spend unprotected. The **two exposure controls share baseline route/risk/cost information**, but bridge-priority has structural cut-edge knowledge and not all strategies are information-matched.

## Results and avoidance of misleading metrics

For every policy and requested tier, report:

- Priority fraction served, standard fraction served, and total fraction served (with distinct class denominators).
- Differences against **0%-floor priority-first** on the exact same seed/outage/policy, in percentage points for all three class/total measures. Negative results are always visible.
- Target standard units, actual standard units served, per-stage admitted units, standard-first greedy-reference potential units and remaining standard shortfall.
- Whether the requested floor was greedy-attainable and whether actually met, **per trial**.
- Count of trials with attainable floor, count of attainable trials that met the floor, total met count and unattainable-under-greedy count.
- Actual protection spending per policy, selected edge IDs, trial subtype, failed-edge IDs and complete local exported JSON.

A descriptive policy leader may be identified by highest **mean synthetic priority fraction** at each floor. This does NOT prove that strategy satisfies a common operational target, is globally optimal, or dominates the standard-service/total-service tradeoff. Inspect floor-attainability and shortfalls too. The exact same requested floor can be attainable for one protection method but not another because the surviving protected links differ.

The 0%-floor result is checked numerically against the **preexisting E2-R6** priority-first outcomes for every policy/seed/trial, so the new floor experiment cannot quietly rewrite the baseline.

## Reproduction

From root:

    npm test
    npm run demo:e2r7

React console:

    npm run test --prefix site
    npm run build --prefix site

The frozen Node CLI emits a concise evidence ledger and **unsigned** SHA-256 digest of the complete deterministic report. This is a consistency check, not independent attestation. The React **Service Floors** section exports all research trials and floor conditions locally. No data uploads, sensors, live network adapters, credentials or operational route changes.

## Limitations and future gates

The synthetic fixtures have just two small graph families. The outage generator's probability weights are arbitrary, not measured link reliability. Traffic and priorities are fabricated, the path allocator is fixed-order greedy and does not model queueing, preemption, packets, traffic shaping, convergence time, true multicommodity flow optimality or application SLAs.

A **greedy-unattainable** floor is not a proof that no better scheduler exists. Conversely an attainable and met synthetic floor is **not** a real-world service guarantee. The percentage floor and 3:1 weighted objective from earlier rungs remain modeling choices, not business requirements.

Next rigor: compare against a small exact or integer-programming solution on bounded synthetic graphs to quantify the greedy optimality gap, run held-out graph families and fault distributions, and only evaluate separately authorized public real infrastructure datasets with provenance, privacy review and independent validation. Never promote research policy into live E0 without a separate security and authority gate.
