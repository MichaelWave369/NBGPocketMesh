# E2-R7 Frozen Results: Standard-Service Floors

**Evidence:** GITHUB_ACTIONS_SOFTWARE_RUN / SIMULATED_ONLY / ANALYZE_ONLY / authority NONE.

Source: PR #37, GitHub Actions E0 and E1-A experiments run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43665263325, executing the frozen E2-R7 demo. The study passed regression checks. Subsequent code cleanup removed an unused temporary class-count map without changing the experiment; review final exact-head CI to confirm.

**Unsigned reproducibility SHA-256 (full synthetic report):**

    770731a91ae3b52fe200104b95c646f2472c5fd376e894ea844a8a095a4218ae

This is not independent authenticated provenance.

## Frozen design

- Graphs: two synthetic 47-node fixtures, modular bridge-connected and preferential hub-skewed.
- Three fixture seeds: 369, 8288, 16207; three paired failure trials each.
- Two disclosed hidden-per-trial mixture types, balanced and cluster-heavy, with fixed 12 attempted link failures per trial.
- Four graph/mixture families × 9 trials = **36 paired synthetic outage scenarios**.
- Six protection policies, five spending **exactly 24 abstract cost units** and a separately identified zero-cost unprotected reference.
- Requested minimum standard-demand service floors: **0%, 20%, 30%, 40%**, preregistered before the new simulation.
- Every 0% floor outcome numerically reproduces the prior E2-R6 priority-first greedy allocator, per policy and trial.
- A floor is **greedy-attainable** iff the standard-first, fixed-order version of this SAME synthetic allocator can serve the target. This is NOT a mathematical/global or physical feasibility bound.

## Priority-exposure policy: class-specific service and attainable floors

Follow one fixed protection policy rather than choosing a different winner for every target.

| Graph / mixture | Floor | Priority served | Standard served | Total served | Greedy-attainable trials |
|---|---:|---:|---:|---:|---:|
| Modular / balanced | 0% | 43.90% | 15.22% | 22.23% | 9/9 |
| Modular / balanced | 20% | 17.63% | 25.14% | 23.30% | 9/9 |
| Modular / balanced | 30% | 15.67% | 25.77% | 23.30% | **0/9** |
| Modular / balanced | 40% | 15.67% | 25.77% | 23.30% | **0/9** |
| Modular / cluster-heavy | 0% | 43.90% | 17.83% | 24.20% | 9/9 |
| Modular / cluster-heavy | 20% | 16.65% | 24.62% | 22.67% | 9/9 |
| Modular / cluster-heavy | 30% | 13.73% | 25.79% | 22.85% | **0/9** |
| Modular / cluster-heavy | 40% | 13.73% | 25.79% | 22.85% | **0/9** |
| Hub / balanced | 0% | 94.58% | 43.47% | 55.93% | 9/9 |
| Hub / balanced | 20% | 82.64% | 48.02% | 56.50% | 9/9 |
| Hub / balanced | 30% | 75.32% | 50.17% | 56.34% | 9/9 |
| Hub / balanced | 40% | 66.47% | 54.58% | 57.49% | 9/9 |
| Hub / cluster-heavy | 0% | 94.09% | 45.92% | 57.65% | 9/9 |
| Hub / cluster-heavy | 20% | 82.13% | 51.09% | 58.68% | 9/9 |
| Hub / cluster-heavy | 30% | 80.88% | 52.22% | 59.22% | 9/9 |
| Hub / cluster-heavy | 40% | 68.39% | 54.41% | 57.81% | 9/9 |

Fractions have **distinct demand-class denominators**. Means average trials within a fixture seed and then average across three seeds. They are not empirical uptime, throughput or SLA probabilities.

## Uncomfortable result: strong structural limits

All five funded policies and the zero-spend reference met the **20% minimum standard floor on all nine modular trials per mixture**. At **30%**, most modular policy/mixture combinations were **greedy-unattainable on all 9/9 trials**. Just two cases, bridge-priority in modular/balanced and all-demand exposure in modular/cluster-heavy, had **1/9** attainable trials each.

At **40%**, the modular graph had **zero greedy-attainable trials for every policy in both mixtures**. All recorded standard-demand shortfalls rather than pretending to satisfy an impossible-with-this-greedy-method quota.

The **hub graph**, by contrast, attained all four requested floors in all nine trials per family under every policy. This graph distinction is **not a physical impossibility proof** for the modular network: a better allocator might find solutions beyond the current fixed greedy standard-first reference.

For the priority-exposure policy, the 20%-floor change compared with zero floor was:

| Graph / mixture | Priority change | Standard change | Total change |
|---|---:|---:|---:|
| Modular / balanced | **−26.27 percentage points** | **+9.91 pp** | +1.07 pp |
| Modular / cluster-heavy | **−27.25 pp** | **+6.79 pp** | −1.53 pp |
| Hub / balanced | **−11.95 pp** | **+4.56 pp** | +0.57 pp |
| Hub / cluster-heavy | **−11.96 pp** | **+5.17 pp** | +1.03 pp |

**Priority service was reduced substantially when the standard floor was reserved.** Standard service increased, while total service could rise or fall. This is a real result of the synthetic program, not a real-network benefit.

At the 20% floor, the highest *mean priority fractions* among funded strategies were:
- Modular/balanced: bridge-priority × risk, **18.36%**.
- Modular/cluster-heavy: hazard-only, **19.08%**.
- Hub/balanced: priority-exposure and hazard-only both round to **82.64%**; exact precision determines scripted ordering.
- Hub/cluster-heavy: hazard-only, **84.32%**.

These are descriptive ranking labels, not Pareto-efficient or globally optimal policy conclusions.

## Caveats and next scientific gate

1. Every traffic demand, service label, capacity, cost, risk, graph and outage is fictional.
2. A floor is **conditionally guaranteed only when the fixed-order greedy standard-first benchmark reaches it**; otherwise a measured shortfall is mandatory. Global flow feasibility and packet QoS are **not proven**.
3. All funded strategies have exact equal protection spending, but some use different features/knowledge.
4. The unprotected strategy has zero spending, so is never an equal-resource comparator.
5. Prior policies are frozen before future failures; per-trial failure IDs and subtype are identical for every policy.
6. No real packets, queueing, wireless hardware, network router, quantum light, authentication or E0 authority is touched.
7. SHA-256 is a reproducibility checksum, not an external signature.

Next gate: compare the current greedy quota algorithm against **exact or bounded integer-programming flow admission** on small synthetic graphs to quantify its optimization gap. Expand into held-out heterogeneous topologies and only use independently approved public measurements with privacy review before any operational use.
