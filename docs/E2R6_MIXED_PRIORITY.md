# E2-R6 · Unknown Mixed Failures and Priority Traffic

**Classification: SIMULATED / public-synthetic / ANALYZE_ONLY / authority NONE.**

## Question

Can a link-protection policy selected **before a trial's unknown outage realization** preserve more important simulated service requests than simpler alternatives? How much does that protection choice matter compared with **allocating scarce surviving capacity in a priority-first order**?

This experiment is intentionally separate from real PocketMesh E0 routing, signed execution, credentials, network interfaces, machine learning and quantum light. It **does not** use operator data, claim real SLA compliance, demonstrate real failover timing, or recommend a production algorithm.

## Unmodified graph fixtures and model

Reuse the previous E2-R4 modular-bridge and hub-skewed preferential **47-node synthetic network structures**. All links retain the same fabricated capacity (2–9), delay (1–7), hazard weight (1–9) and protection cost (1–4). There are 94 deterministic directed whole-flow demands with synthetic capacities.

The previous E2-R5 allocation engine now exposes one narrow read-only observation function: it accepts the validated E2-R4 fixture and an OPTIONAL **permutation of existing demand IDs**, and returns synthetic path placements. No unauthorized demands, new links, unknown failures or privilege changes are accepted. The ordinary original-order placements are independently checked against the frozen E2-R2 evaluator, to catch model drift.

## Preassigned service classes

A deterministic fixture-seeded hash assigns roughly one-quarter of demands the label **priority** and the remainder **standard**. Neither label represents personal data, an emergency call, a user identity, measured importance or an actual contractual SLA. The labels are frozen before the failure trials and fully disclosed in the JSON.

Two allocation orders are independently evaluated **against every policy and outage**:

- **original:** original E2-R4 flow order, with its existing greedy, capacity-feasible, unsplittable shortest-model-latency routing.
- **priority_first:** process all priority requests first (preserving their original relative order), then all standard requests (also preserving relative order), using the EXACT SAME allocator.

This is a synthetic scheduling experiment rather than packet-level quality of service, latency budgeting, preemption, queueing, rate shaping or convergence time.

Report, with denominators separately labeled:
1. Fraction of requested **priority units** served (main predeclared outcome under priority-first scheduling).
2. Fraction of requested **standard units** served, to expose whether priority scheduling sacrifices ordinary traffic.
3. Fraction of **all requested units** served.
4. Arbitrary 3:1 priority/standard weighted-service fraction, a secondary descriptive metric, **not an observed objective or formal optimization**.

No class may be silently dropped from reporting, even if its rate gets worse.

## Preselected exact-cost protection policies

Before any future outage subtype or failed edge IDs are drawn, each policy selects its own link protection set on intact simulated graph and preassigned classes. A deterministic 0/1 knapsack forces **exactly equal total cost**, default 24 abstract units, for all five funded policies.

- **priority_exposure_risk:** baseline priority-demand units actually routed along an intact link under priority-first scheduling, normalized across links, times modeled relative hazard.
- **equal_exposure_risk:** baseline **all-demand** units on those SAME intact priority-first paths, normalized across links, times the SAME modeled relative hazard. Both exposure policies have the same path, cost, hazard and label information; the second deliberately ignores the label when scoring.
- **bridge_priority_risk:** known exact graph bridge cut and the preassigned priority-demand units crossing it, normalized, times modeled relative hazard. This policy has explicit topological cut information and is NOT strictly matched in features to the exposure policies.
- **risk_only:** modeled hazard weight, with no demand exposure.
- **seeded_random:** stable pseudorandom score per link, with no demands or hazard.
- **unprotected:** zero-cost and zero-protection reference only, NOT an equal-resource competitor.

Every funded policy has identical spend, but not necessarily the same number of protected links. Strategies differ in feature access. Specifically, E2-R6 does NOT certify all six policies as equal-information baselines. The two exposed-demand controls are the intended matched-input comparison.

## Mixed unknown outage generator

The study **publishes its mixture rules in advance**. What is unknown to a policy is the specific subtype and failed links selected later in an individual trial.

Each trial selects ONE subtype:
- **Uniform:** equally weighted edge sampling without replacement.
- **Risk-weighted:** sample proportionally to declared *relative* hazard weights (not physically measured failure probabilities).
- **Clustered:** choose a synthetic 14-vertex consecutive **label** region; attempt approximately 65% of failures on edges incident to it and the remainder on edges outside, weighted by relative hazard. These vertex labels are **not geography**.

Predeclared distributions:
- **balanced:** one-third chance of each subtype.
- **cluster_heavy:** 15% uniform, 15% risk-weighted and 70% clustered.

The draws are reproducible from trial seed. Per fixture and trial, every policy faces **exactly the same attempted failed-edge IDs and subtype**. A protected attempted failure keeps its link available; unprotected attempted links are removed. No policy is allowed to inspect the future draws before making its protection list.

This is not an adversarial production threat model or independent stochastic validation, and no algorithm is tuned on evaluation outcomes.

## Frozen execution

The Node CLI freezes:
- three synthetic fixture seeds, starting at 369 and spaced by 7919;
- three paired outage trials per fixture;
- two graph structures × two mixture distributions = **four scenario families**;
- **36 distinct paired synthetic outage scenarios** in total;
- 12 attempted link failures per scenario and exact cost 24 for each funded method;
- six protection methods × two traffic allocation modes per scenario.

The primary comparison is mean **priority-demand service fraction using priority-first ordering**. Means first average trials within fixture seeds, then average fixture seeds; results include ties. For the priority-exposure policy, seeded paired differences relative to equal-exposure, bridge-priority, risk-only and random competitors include a **descriptive** bootstrap across synthetic fixture seed clusters only.

Because only three synthetic seeds are used in the frozen study, bootstrap intervals cannot establish a real-world population confidence interval or significance. All negative or small results should be retained, and standard-demand/total-demand tradeoffs shown alongside any priority gains.

## Reproduction

From repo root:

    npm test
    npm run demo:e2r6

React console:

    npm run test --prefix site
    npm run build --prefix site

The standalone new React **Mixed Priority** section presents class-specific metrics, the two scheduling modes, policy comparisons, and a full local JSON export with selected protected links, demand labels, trial subtype and attempted failures.

The frozen CLI prints an evidence-limited summary plus the **unsigned**, recomputable SHA-256 of the complete deterministic report. A self-produced hash is not an independently authenticated observation.

## Scientific and engineering boundaries

- This is a toy model, not observed failover service quality.
- Unknown means **unknown realized failure IDs/subtype**, not unknown physics, unknown model assumptions, or a secret adversarial distribution.
- Critical simulated demand classes are **not** actual emergency services or customer priorities.
- Scheduler differences can redistribute served capacity and even lower total throughput. This is reported, not disguised.
- No packet-level timing, energy, retries, optical/quantum transfer, end-device network telemetry or secure routing is measured.
- Exact spending does not imply matched-information fairness across all policies.
- No existing E0 route executor, authorization gate, trust identity, checkpoints or historical E2-R1–R5 frozen model is changed.

## Next evidence gate

Extend beyond two synthetic graph families, introduce held-out topology families, independently sourced and authorized public traffic/failure data, correct engineering cost units, service-level constraints and realistic recovery-time measurements. Keep decisions read-only and subject to separate authorization before considering deployment.
