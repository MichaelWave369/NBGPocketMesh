# E2-R5 Frozen Bridge Failover Evidence Ledger

**Classification:** OBSERVED_FROM_GITHUB_ACTIONS / SYNTHETIC_SOFTWARE_ONLY / ANALYZE_ONLY / authority NONE.

This summarizes the frozen E2-R5 Node demo on PR #35, GitHub Actions run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43651048983, which passed. The original synthetic failure engine and corrected null-vs-zero reporting were both verified.

Unsigned, recomputable full-report SHA-256:
9cebd6ea67b60d334767e8dd8316b08e4cbeb3ab110d9ef0e6e005386fbef350

The digest is a reproducibility checksum, not authenticated provenance.

## Locked experimental design

- Four fabricated fixture seeds: 369, 8288, 16207, 24126.
- Four paired outages per seed across three predeclared scenario families: **48 paired synthetic scenarios**.
- Twelve attempted link failures per trial, with identical failed-edge attempts replayed for every policy.
- Five funded link-protection policies spent **exactly 24 arbitrary cost units** in every fixture; the unprotected reference spent zero.
- Every modular graph has exactly two structural bridges (edge IDs 2-16 and 24-34). Every preferential hub-skewed graph in the frozen run has zero.
- All payloads, capacities, risk weights, costs, delays and flows are synthetic. No operator-supplied data is used.

## Mean fraction of requested synthetic demand served with FULL reallocation

| Graph and outage | Bridge guard | Centrality × risk | Route exposure × risk | Risk only | Random | Unprotected | Highest funded |
|---|---:|---:|---:|---:|---:|---:|---|
| Modular / bridge-targeted | **7.39%** | 6.45% | 5.53% | 4.76% | 5.44% | 3.74% | Bridge guard |
| Modular / nonbridge control | **7.48%** | **7.48%** | **7.48%** | **7.48%** | 7.43% | 7.43% | Four-way tie |
| Hub-skewed / nonbridge control | 56.93% | **57.22%** | 56.94% | 56.93% | 56.92% | 53.55% | Centrality × risk |

**Crucial denominator distinction:** For the first two MODULAR scenarios the percentages describe **graph bridge-dependent requested demand units**, not all traffic. On the HUB graph the critical class is undefined (there are no graph bridges), so its percentages describe **ALL requested demand units**. The values cannot be compared directly across graph families as if they measured the same physical quantity.

Means average the four outage trials within each synthetic fixture seed, then average four seeds. Figures are rounded to two decimals. Full per-trial outcomes and exact protection lists are reproducible via the frozen CLI and locally exportable from the React laboratory.

## Recovery mode comparison, modular bridge-targeted attack

| Mode | Bridge guard: critical service | Unprotected: critical service |
|---|---:|---:|
| Retain original paths, no reroute | 4.74% | 2.05% |
| Repair interrupted original flows | 7.00% | 3.74% |
| Reallocate ALL demand greedily | 7.39% | 3.74% |

These percentages are NOT network recovery times, packet loss or control-plane convergence measurements. The repaired mode preserves unaffected original placements; the fully recomputed mode is still a fixed-order greedy shortest-model-latency capacity allocation, not an optimal global network route planner.

## Interpretation

1. The guard wins the **deliberately bridge-targeted** scenario, which is expected from this adversarial design. It is not a blind external validation of topology superiority.
2. In the modular **nonbridge negative control**, guard ties with centrality × risk, route-exposure × risk and risk-only on the predeclared bridge-dependent service metric. They need not tie on other metrics.
3. On the **bridge-free hub negative control**, conventional centrality × risk has the highest mean all-demand service, beating the guard by roughly **0.29 percentage points**, which is a small synthetic difference.
4. Even with bridges intact, mean bridge-dependent service in the modular graph is below 8%. **Low fabricated bridge capacity constrains throughput**, regardless of graph connectivity protection.
5. All funded strategies spend exactly the same synthetic budget, but use different available attributes. A fair cost does not imply a controlled matched-information experiment.
6. Actual trial outage IDs are equal across policies. A policy's link choices are frozen before its trial outages.
7. The unprotected reference spends nothing and is NOT an equal-spend competitor. Graph-determined criticality is NOT a human-designated SLA or measured application priority.
8. Bridge-free critical-demand fractions remain **undefined**, not numerically zero. A reporting regression test enforces this.
9. Full recomputation is checked against the preexisting E2-R2 synthetic traffic evaluator; production E0 routing was not used or changed.

## Limitations and next gate

No real infrastructure, physical reliability or packet recovery data was tested. The bridge-targeted design deliberately exploits knowledge of the network's cut links. Synthetic seeds are not a population of physical networks. There is no quantum or orbital-angular-momentum computation here.

The next rigorous gate is a predeclared **mixed unknown fault distribution** across independent degree-heterogeneous graph families, with explicit demand priorities and genuinely feature-matched competing strategies. Only separately authorized public network data and independently evaluated real measurements could inform deployment.
