# E2-R6 Frozen Mixed-Failure and Priority-Traffic Results

**Evidence:** GITHUB_ACTIONS_SOFTWARE_RUN / SIMULATED_ONLY / ANALYZE_ONLY / authority NONE.

The predeclared E2-R6 CLI passed in PR #36 exact-code GitHub Actions (E0 and E1-A experiments, run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43661909999). Node regressions, Windows contracts and React tests/build passed. These findings are *not* independent hardware observations.

Unsigned SHA-256 digest of the complete deterministic run:
70d9c3eda629667eacd974fa657baa45c16778d17d43096a76b24ab587acc210

Anyone controlling the source can recompute this checksum. It is not authenticated provenance.

## Frozen design and budget audit

- Three fabricated fixture seeds: 369, 8288 and 16207.
- Two graph structures: **modular** (two mathematical bridge cuts) and **preferential** (hub-skewed, no graph bridge cuts).
- Two disclosed failure mixture rules: balanced (one-third each uniform/risk-weighted/clustered) and cluster-heavy (15% uniform, 15% risk-weighted, 70% clustered).
- Three attempted-failure trials per fixture/mix, twelve distinct attempted failures each.
- **36 paired synthetic outage scenarios** in all. Every policy sees the same attempted failure IDs and subtype within a scenario. No policy sees its future realized subtype when selecting protection.
- Six policies: **priority exposure × risk**, **all-demand exposure × risk**, **bridge-dependent priority × risk**, **risk-only**, **seeded random**, **unprotected**.
- Five funded policies spent exactly **24 synthetic cost units** in all frozen fixtures; the unprotected reference spent zero. Protected link counts may differ.
- 94 fictional directed demands per fixture are independently labeled priority or standard by seed hash. No personally identifiable or live service data was used.
- Every policy is evaluated using **original demand order** and **priority-first demand order** against the same surviving links.

## Primary result: priority-demand service under priority-first scheduling

| Graph / mixture | Priority exposure × risk | All-demand exposure × risk | Bridge-priority × risk | Risk-only | Random | Unprotected | Highest funded |
|---|---:|---:|---:|---:|---:|---:|---|
| Modular / balanced | 43.90% | 42.91% | **44.86%** | 42.91% | 42.91% | 42.91% | Bridge-priority × risk |
| Modular / cluster-heavy | 43.90% | 42.66% | **45.36%** | 42.66% | 41.43% | 40.69% | Bridge-priority × risk |
| Hub-skewed / balanced | 94.58% | 93.13% | 89.27% | **95.57%** | 94.58% | 89.27% | Risk-only |
| Hub-skewed / cluster-heavy | 94.09% | **94.83%** | 92.61% | 94.09% | 94.09% | 92.61% | All-demand exposure × risk |

Percentages represent **priority-class requested units served**, NOT all traffic, relative to each fixture's own priority-class denominator. Means are taken within each synthetic fixture seed's three paired outages and then across three seeds. Rounded to two decimals. Tiny differences and any bootstrap bands must not be interpreted as real-world significance.

**Negative-control observation:** The priority-exposure × risk method did **not** lead any of the four frozen scenario families. The bridge-priority method led on the modular graph twice; risk-only and all-demand exposure led once each on the hub graph. Bridge-priority on a bridge-free graph has zero cut score for every edge, so its deterministic exact-cost selection falls back to arbitrary fixed tie order; it must NOT be credited with identifying important links there.

## The real engineering tradeoff this model illustrates

For the **priority-exposure × risk** protection method:

| Graph / mix | Priority service, original order | Priority service, priority-first | Standard service, original order | Standard service, priority-first | Total served, original | Total served, priority-first |
|---|---:|---:|---:|---:|---:|---:|
| Modular / balanced | 24.49% | **43.90%** | **22.29%** | 15.22% | **22.82%** | 22.23% |
| Modular / cluster-heavy | 21.81% | **43.90%** | **22.87%** | 17.83% | 22.60% | **24.20%** |
| Hub-skewed / balanced | 57.87% | **94.58%** | **56.35%** | 43.47% | **56.72%** | 55.93% |
| Hub-skewed / cluster-heavy | 56.37% | **94.09%** | **56.31%** | 45.92% | 56.33% | **57.65%** |

Priority-first scheduling increased the modeled share of priority-class traffic served in these four frozen fixture families, but **reduced the standard-class served fraction** in every row above. Total flow service sometimes improved and sometimes worsened. The scheduler was not optimized against these outcomes; it uses the original greedy capacity-feasible flow allocator with a different fixed ordering.

These results demonstrate why reporting just the priority-class score would hide an important tradeoff. The arbitrary 3:1 weighted score is a secondary experiment metric, not a true operational SLA.

## Actual drawn outage subtypes

| Family | Uniform draws | Risk-weighted draws | Clustered draws |
|---|---:|---:|---:|
| Modular / balanced | 3 | 5 | 1 |
| Modular / cluster-heavy | 0 | 2 | 7 |
| Hub-skewed / balanced | 6 | 2 | 1 |
| Hub-skewed / cluster-heavy | 0 | 0 | 9 |

A nine-trial sample need not match its theoretical mixture proportions exactly. These observed counts are **not** measurements of real-world outage prevalence.

## Critical caveats

1. All demands, service classes, link capacities, risks, costs, delays, network structures and failures were **fabricated deterministically**.
2. Three fixture seeds do not represent three independently measured physical networks. No valid physical confidence interval or SLA improvement claim follows.
3. The mixture rules are disclosed in the protocol; only the individual future trial realization is unknown at protection selection time.
4. All funded strategies have exactly matched spending, but do not all have identical **information**. In particular, the bridge-priority policy has explicit cut-edge knowledge; the two route-exposure policies share the same baseline paths and risk/cost inputs.
5. Priority scheduling is a discrete **greedy allocation-order change**, not actual packet quality-of-service, queuing, preemptive prioritization, reroute convergence or measured response time.
6. In the bridge-free hub control, bridge-priority scores are identically zero, so the deterministic tie behavior is arbitrary and not a meaningful topology signal.
7. The unprotected strategy has **zero** cost, hence is not an equal-funded comparator.
8. All route choices remain read-only software observations; E0 routing, grants, trust signatures, real devices, photons and quantum OAM are untouched.
9. The source digest is unsigned and freely recomputable by an author; no independently authenticated field evidence is claimed.

## Next meaningful gate

Test predeclared traffic-priority policies with **minimum standard-service floors** or explicit Pareto constraints. Protecting high priority demand by severely starving standard traffic may be unacceptable. Add held-out synthetic graph families and genuinely matched-information scoring/selection controls, then independently sourced authorized public network traffic only with privacy review. Any production QoS or failover control requires a separate operational permission and validation gate.
