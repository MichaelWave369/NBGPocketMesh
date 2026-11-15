# E2-R8 Frozen Results: Greedy Versus Exhaustive Tiny Optimization

**Evidence classification:** OBSERVED_FROM_GITHUB_ACTIONS / SIMULATED_SOFTWARE_ONLY / ANALYZE_ONLY / authority NONE.

The frozen E2-R8 Node demonstration ran successfully in PR #38, GitHub Actions E0 and E1-A experiments run https://github.com/MichaelWave369/NBGPocketMesh/actions/runs/43672572595. It executed npm run demo:e2r8 after the complete root Node regression suite, including exact witness route and shared capacity validation. This ledger summarizes the locked synthetic results, **not independent field measurements**.

**Unsigned SHA-256 digest of the complete synthetic report:**

    ffba139fbf7ac9ebf0aeab18f9ef205bc425d8370c9bac4fad9447eb92afd8d6

This digest is freely recomputable and establishes only consistency if the source is trusted separately. No independent attestation or cryptographic proof is claimed.

## Frozen inputs

- Synthetic fixture seed 369.
- Three tiny graphs: 4-node fork, 6-node one-bridge structure, and 6-node multi-route mesh.
- Two failure conditions: intact, or one predeclared removed link (fork 0-2, bridge 2-3, mesh 1-4).
- Four requested standard-demand service floors: **0%, 40%, 70%, 100%**.
- **24 paired comparisons**, same synthetic graph, surviving links, demands and requested floor for greedy and exhaustive allocation in each case.
- Exact solver includes **all simple source-to-destination paths** and explicit rejection choices per whole-flow request.
- The lexicographic objective is maximum priority units satisfying floor, then maximum total served units, then minimum artificial route latency.
- The maximum exhaustive tree in this frozen run was the intact mesh: **6,305 search states and 3,695 complete assignments**, well below the strict 2,500,000-state certification limit.

## Summary of all 24 classifications

| Exact classification | Cases |
|---|---:|
| Greedy matches exact priority and total units | **13** |
| Greedy meets floor but loses priority units to exact | **5** |
| Greedy meets floor but loses total units at equal priority | **0** |
| Greedy wrongly considers a truly feasible floor unattainable | **2** |
| Floor provably infeasible within tiny all-simple-path model | **4** |
| **Total** | **24** |

**There is NO claim that 47-node E2-R7 floors were proved feasible or infeasible.** These results apply only to the tiny synthetic fixtures and declared whole-flow capacity model.

## Constructive fork counterexample

| Condition | Requested standard floor | Greedy priority | Greedy standard | Exact priority | Exact standard | Classification |
|---|---:|---:|---:|---:|---:|---|
| Fork, intact | 40% (1 unit) | 0 | 1 | **1** | **2** | Greedy priority gap |
| Fork, intact | 70% (2 units) | 0 | 1 | **1** | **2** | Greedy missed feasible floor |
| Fork, intact | 100% (2 units) | 0 | 1 | **1** | **2** | Greedy missed feasible floor |
| Fork, link 0-2 removed | 100% (2 units) | 0 | 1 | Not feasible | Not feasible | Proven tiny-model infeasible |

The intact fork offers an alternate route 0-2-3 for the first standard flow, freeing both 0-1 and 1-3 for the second standard and the priority flow. The fixed-order greedy allocator chooses the faster 0-1-3 instead, consuming both links prematurely. Exhaustive routing serves **all three** one-unit requests. This is a reproducible algorithmic counterexample, not a stochastic claim.

After removal of 0-2, both standard flows necessarily use capacity-one edge 0-1 and therefore cannot both be admitted. The 100% standard target is **infeasible inside that exact tiny graph model**.

## Other instructive cases

| Synthetic graph / fault | Standard floor | Greedy priority / standard | Exact priority / standard | Interpretation |
|---|---:|---:|---:|---|
| Bridge, intact | 40% | 1 / 3 | **2 / 2** | Greedy satisfies floor but sacrifices a priority unit |
| Bridge, bridge removed | 100% | 1 / 2 | Infeasible | Standard crossing demand cannot be carried |
| Mesh, intact | 70% | 1 / 3 | **3 / 3** | Exact routing recovers two priority units without sacrificing standard |
| Mesh, intact | 100% | 1 / 3 | **3 / 3** | Same greedy priority gap with all standard demand served |
| Mesh, link 1-4 removed | 100% | 2 / 3 | **2 / 3** | Greedy matches optimal priority and total service for this condition |

For all feasible solutions, exhaustive path witnesses pass capacity, contiguity, simple-path, failed-edge exclusion and declared-demand tests. When greedy satisfies a floor, its lexicographic priority and total served units never exceed the certified exact optimum.

## Fundamental scope restrictions

1. **Exact** means exhaustive **only inside a tiny bounded, fabricated, unsplittable whole-flow model**: at most 7 vertices, 10 edges, 7 demands, 128 simple paths per demand, 2.5 million search states.
2. A search that would exceed a bound is rejected as **EXACT_NOT_CERTIFIED**, not quietly returned as an optimum.
3. These cases contain no real traffic, network reliability, physical failure measurements, customer demand classes, packet timing, queueing or operational cost units.
4. The independent mini-greedy algorithm follows the **three-stage design** of E2-R7 but does not literally solve E2-R7's 47-node fixture. This is **not** an exact rerun of those earlier floor results.
5. The exact lexicographic objective is one explicit modeling choice; other objectives or split/multipath flows may have different optima.
6. The same codebase implements enumeration and its tests, so no independent solver implementation has yet cross-checked all results. The constructed counterexample offers a directly inspectable witness.
7. A checksum from the code author is not external identity/provenance evidence.
8. Nothing touches Pocket Mesh E0 routing, trust gates, signing, authorization, real devices, AI weights or optical/quantum technology.

## Next rigorous gate

Use an independent exact solver or reference formulation on the same small cases, then compare carefully extracted bounded subgraphs of the 47-node fixtures. Explicitly account for edge-boundary effects, demands crossing the subgraph, and original protection decisions. Keep all experimentation read-only and synthetic unless separately authorized empirical data is supplied.

**Conclusion:** In this controlled small software model, greedy reservation can fail to find a feasible standard-service floor even when one exists, and can forgo priority-service units even when the floor is met. Conversely, some floors really are infeasible within the exact tiny model. That is a meaningful algorithmic distinction, with no implied real-world deployment result.
