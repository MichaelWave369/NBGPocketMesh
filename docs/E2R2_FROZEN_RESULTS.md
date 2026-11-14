# E2-R2 Frozen Result Ledger: first reproducible synthetic run

**Classification:** OBSERVED_FROM_GITHUB_ACTIONS / SIMULATED_SOFTWARE_ONLY / ANALYZE_ONLY / authority NONE.

Source: PR #32 exact-head CI job "E0 and E1-A experiments" on run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43644848062, which executed npm run demo:e2r2 and passed. The frozen demo emits the complete input fixtures, all selected protected edge sets, every individual trial and deterministic JSON hashes. The figures here summarize its descriptiveSummary fields; this document is not a separate independent experiment.

**Frozen design:** seed 369, 24 paired trials per graph/outage family, 26 attempted failures per trial, identical synthetic traffic (94 flows, 185 requested flow units) and same cost ceiling (24 units) for all five protection policies. Every protection policy happened to spend exactly 24 units on these frozen fixtures; the unprotected reference spent zero.

## Mean synthetic traffic-served fraction

| Graph / outage | Topology × risk | Demand-only | Risk-only | Capacity × risk | Seeded random | Unprotected | Highest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A / risk-weighted mesh | **64.10%** | 62.77% | 62.97% | 63.20% | 61.89% | 60.90% | Topology × risk |
| A / regional risk-weighted | 58.60% | 58.49% | 58.54% | **60.27%** | 56.19% | 55.18% | Capacity × risk |
| B / risk-weighted mesh | 70.16% | 69.64% | **70.88%** | 70.45% | 67.84% | 67.16% | Risk-only |
| B / regional risk-weighted | 65.47% | 65.32% | 66.31% | **66.71%** | 61.10% | 60.68% | Capacity × risk |

Values are mean served units / requested units over 24 paired synthetic trials in each family, rounded to two decimal places for readability. Re-running the frozen CLI generates more precision, exact trial rows and selected edge IDs.

The primary observation is a one / two / one split in four frozen scenarios: topology × risk led once, capacity × risk twice, and risk-only once. These ablations are meaningful alternatives; these fixtures DO NOT demonstrate universal superiority from adding the topology-derived route-use term.

## Why this remains a very narrow result

- These numbers come from four synthetic deterministic fixture families, not held-out real network logs, independently calibrated failure distributions or hardware measurements.
- Seed and traffic order were fixed for the frozen experiment. Small differences can change with new seeds, traffic mixes and spending ceilings. No statistical confidence intervals or broad policy superiority claims are provided.
- All policies see the same per-trial failures. This tests internal fairness but does not guarantee realistic outage behavior or fair information availability across heuristics.
- Topology × risk deliberately receives baseline route exposure plus declared risk, while simpler alternatives use fewer inputs. An eventual matched-information and matched-expense control is needed for stronger causal attribution.
- The unprotected reference has zero cost, not an equal budget.
- The simulator has no queueing, packet-level delivery, traffic splitting, real link telemetry, optical/quantum hardware, authenticated provenance, operational routing or model execution.
- The source demo's unsigned SHA-256 digest is only a deterministic consistency check; anyone controlling the source can freely recompute it.

## Next rigorous gate

1. Repeat over a preregistered larger grid of fixture seeds, variable traffic mixes and outage intensities.
2. Add combined risk + traffic + capacity baselines with exactly matched access to inputs.
3. Examine Pareto tradeoffs in cost-spend, traffic served and latency, including confidence intervals across independent synthetic seeds.
4. Only then use independently approved public network measurements, with validation against failure/traffic logs that were not used to construct policy priorities.

This is software research with no routing or authorization power, and the original E0 and E2-R1 modules remain unchanged.
