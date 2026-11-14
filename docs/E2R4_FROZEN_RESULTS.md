# E2-R4 Frozen Irregular Stress Result Ledger

**Evidence classification:** OBSERVED_FROM_GITHUB_ACTIONS / SYNTHETIC_SOFTWARE_ONLY / ANALYZE_ONLY / authority NONE.

Initial frozen results from PR #34 GitHub Actions E0 and E1-A experiments, https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43649082160, executing the predeclared npm run demo:e2r4 under the research test workflow. All original code under test in that run completed successfully; only a separate React UI string-matching smoke assertion needed correction afterward.

**Recomputation digest of the full original software trial record (SHA-256, unsigned):**
5e30e25d3e1e20601fbfd196f25b3fee97e6be424c5b443ad2972c40ba212f7b

## Frozen design and exact-spend audit

- 47-node connected synthetic irregular graphs, preferential hub-skew and modular three-community types.
- Six fixture seeds 369, 8288, 16207, 24126, 32045, 39964.
- Two graph types × two synthetic outages (risk-weighted whole-network or label-localized).
- Six attempted failures trials per seed, 20 distinct attempted edge failures per trial.
- 6 seeds × 6 paired failures × 4 families = **144 paired synthetic scenarios**.
- Protection selected before failures under the same exact 0/1 knapsack spending rule, cost=24 arbitrary units per funded policy; the unprotected reference costs zero.
- All eight funded strategies passed the exact-spend check in all four frozen families.
- Synthetic preferential-attachment graph variance in vertex degree averaged 10.4313; no bridges found.
- Three-module graph degree variance averaged 0.0779 and each generated fixture contained exactly **two graph-theoretic bridge edges**. It is still degree-heterogeneous but most vertices have similar local degree.

## Mean proportion of artificial requested traffic units served

| Network / synthetic outage | Centrality × risk | Route-exposure × risk | Matched additive | Matched harmonic | Degree × risk | Capacity × risk | Risk-only | Random | Unprotected | Highest funded |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Preferential / global | 54.11% | 54.31% | 53.90% | **54.55%** | 53.46% | 53.97% | 53.50% | 51.95% | 48.69% | Matched harmonic |
| Preferential / localized | 53.10% | **54.19%** | 53.57% | 54.07% | 52.52% | 53.92% | 53.73% | 52.84% | 49.26% | Route-exposure × risk |
| Modular / global | 19.85% | 20.68% | **20.77%** | 20.57% | 20.21% | 20.41% | 20.12% | 19.45% | 17.94% | Matched additive |
| Modular / localized | 19.03% | 19.61% | 19.75% | 19.81% | 19.68% | **19.94%** | 19.70% | 18.87% | 17.06% | Capacity × risk |

Values average across paired failures within a synthetic seed then across six seeds, rounded to two decimal places.

**Negative-control result:** The unweighted graph-centrality × relative hazard policy was **not** the top mean performer in any of the four frozen network/outage families. The best strategies varied. The low service fractions in bridge-connected communities should not be interpreted as measured reliability or a validated diagnosis of physical mesh weakness; the synthetic community structure and fixed demand allocation cause these outcomes in the toy model.

## Interpretation and limitations

1. This is a *deterministic, fabricated* set of graph, capacity, latency, cost, hazard and traffic fixtures. It is not six real independent physical networks, nor a representative statistical sampling of infrastructure.
2. Centrality uses *unweighted shortest-path edge betweenness*; route-exposure uses capacity-feasible demand allocation. They do not have identical informational inputs. Exact spend fairness does NOT make it a fully matched-information scientific comparison.
3. The synthetic knapsack policy chooses links before attempted failures; its objective scores and inputs are not optimized against these outcomes. All policies face the same failures in a given trial.
4. Localized outage uses neighboring vertex labels, not measured geography; relative risk is a draw weight, not a real failure rate.
5. Route evaluation inherits E2-R2's greedy unsplittable capacity-aware shortest-latency model. It does not simulate packet scheduling, controller convergence, real throughput, measured signal behavior or quantum communication.
6. Any seed-bootstrap confidence-style bands produced by this lab are **descriptive** of synthetic fixture-seed variability only. They provide no measured physical-world confidence guarantee or scientific proof of comparative superiority.
7. The SHA-256 checksum is untrusted and freely recomputable by the author; no independent identity or experimental provenance is established.
8. The independent E0 router, execution and trust boundaries remain untouched.

## Next rigorous experiment

Challenge these policies with genuinely held-out graph structures, controlled bridge targeting, traffic-demand reordering and **feature-matched** candidate strategies with identical cost. Specifically test the difference between topological centrality and *capacity-constrained traffic criticality*. Only with separately authorized public empirical topology/traffic/failure data and honest calibration could any production recommendation be considered.

**Conclusion:** The new graph structures made the resilience policy comparison harder. Under these frozen synthetic conditions, purely structural edge-betweenness multiplied by relative risk was **not** sufficient to beat alternative, demand-aware or capacity-aware allocation policies.
