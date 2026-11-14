# E2-R3 Frozen Multi-Seed Results Ledger

**Classification:** OBSERVED_FROM_GITHUB_ACTIONS / SYNTHETIC_SOFTWARE_ONLY / ANALYZE_ONLY / authority NONE.

This report summarizes the first unchanged, frozen E2-R3 CLI run in PR #33. Source: GitHub Actions E0 and E1-A experiments, run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43646377019, executing npm run demo:e2r3.

**Reproducible full-report SHA-256** (unsigned, not authenticated): e4d0edbae42fd1c8a98f35512e9eabfecfa1a01067069dde7683e55d42885987

## Frozen protocol

- Synthetic graph/traffic seeds: 369, 8288, 16207, 24126, 32045, 39964, 47883, 55802
- Two 47-node/188-link graph families (A and B) and two modeled outages per graph (risk-weighted whole-mesh and regional).
- 8 synthetic network fixture seeds × 8 paired attempts per family = 64 paired failure scenarios per family, 256 across the four families.
- Each scenario has 26 attempted link failures and an equal maximum protection-cost budget of 24 for the funded policies.
- **All funded strategies spent the same exact 24 cost units** for every seeded fixture in this frozen run; the unprotected reference spent zero.
- The two newly added controls use the same intact-flow exposure, relative hazard and link protection cost as the original topology × risk scoring, but combine them via normalized additive or harmonic means.
- No future outage observations are supplied to any policy when its protection list is chosen.

## Mean synthetic demand served

| Graph and modeled outage | Topology × risk | Matched additive | Matched harmonic | Risk only | Capacity × risk | Best funded policy |
|---|---:|---:|---:|---:|---:|---|
| A / whole mesh | **64.67%** | 63.62% | 63.86% | 63.05% | 64.12% | Topology × risk |
| A / regional | 58.50% | 58.41% | 58.43% | 58.15% | **58.92%** | Capacity × risk |
| B / whole mesh | **67.46%** | 67.25% | 67.38% | 66.91% | 67.20% | Topology × risk |
| B / regional | 62.15% | **62.45%** | 62.42% | 61.92% | 61.94% | Matched additive |

Values are percentages of synthetic requested flow units, averaged first within each fixture seed's eight paired outages, then across eight fixture seeds, and rounded to two decimals. The table omits demand-only, seeded random and the zero-spend unprotected reference for compactness; all remain in the CLI output and full browser export.

## Relative topology × risk outcomes

Compared with the matched additive policy, topology × risk had mean differences:
- Graph A, whole mesh: +1.04 percentage points
- Graph A, regional: +0.09 percentage points
- Graph B, whole mesh: +0.21 percentage points
- Graph B, regional: −0.30 percentage points

Compared with the matched harmonic policy, topology × risk differed by:
- Graph A, whole mesh: +0.81 percentage points
- Graph A, regional: +0.07 percentage points
- Graph B, whole mesh: +0.08 percentage points
- Graph B, regional: −0.27 percentage points

Therefore the highest mean funded strategy was topology × risk in two families, capacity × risk in one, and the matched additive control in one. Even the two successes for topology are small to modest and must not be generalized to real network deployments.

## Scientific limitations

- All eight synthetic seeds produce deterministic variations of only two preselected degree-eight graph structures. They are not eight independently measured network deployments.
- The bootstrapped percentile ranges in the CLI describe resampled synthetic fixture seed means. They are not calibrated confidence intervals for physical systems, and no p-values or real-world inference are warranted.
- The routing evaluator uses unsplittable, deterministic greedy flows with fixed order, arbitrary link delay and failure weights, and no packet timing, reordering, congestion dynamics or operator network data.
- Exact spend equality happened in this frozen run and must be checked again for any different seed, graph or budget.
- A winning result here does not validate topological OAM quantum information, a real optical mesh, a learned routing agent, security, or permission to execute.
- The SHA-256 above establishes repeatability if the source and environment are trusted separately. Anyone can generate different JSON and recompute a valid digest.

## Next gate

Evaluate many independently generated, non-circulant, degree-heterogeneous graph families with preregistered traffic, realistic link correlation and true equal-access baselines. Keep all experiments isolated from E0 routing and signed control gates. Obtain authorized, public real-world network datasets and separate training vs held-out evaluation before suggesting production policy changes.
