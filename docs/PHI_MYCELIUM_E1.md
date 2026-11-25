# PhiMycelium E1 — integrated experimental validation
**SIMULATED / ANALYZE_ONLY / authority NONE.**

Protocol frozen before this run: import actual R0–R8 modules and evaluate the existing defaults. R1 additionally compares ramp, burst and intermittent demand. R3 uses an explicit five-node cut tree; R5/R8 share its repaired fixture; R6 exercises exact recovery and concurrent conflict. R4 and R7 preserve full per-seed records. Execute twice and compare complete report and SHA-256 consistency digest. This is same-runtime deterministic replay, not independent implementation or a signature.

Run from repository root:
    node scripts/phi-mycelium-e1-report.mjs

The dedicated CI publishes full.json and summary.json artifacts and logs one compact E1_RESULT per summary key. Results must be read from a successful exact-head run before any performance claim. The artifact includes all cohorts and negative outcomes; it is not a deployed system. The modules are evaluated in one offline process, not an integrated end-to-end live runtime. No production execution or permissions changed.

Interpretation gates:
- R0 static original-cost shortest path is optimal under its assumptions. Reinforcement cannot beat that cost metric.
- R1 active pocket stages are not measured memory or throughput; unmet demand must be considered.
- R2 JSON sizes exclude receipts, edits, runtime costs and metadata outside compared arrays. No arbitrary-data compression claim.
- R3 repairs only connectivity within a limited candidate pool.
- R4 compare initial equal budgets; post-repair capacities can differ, failures are equal-count not same endpoints, Fibonacci offset baseline is limited, and hop totals are conditional on admitted requests.
- R7 retained policy is not a pure memory ablation; drift inverts labels and changes prevalence. Compare policies only within paired scenarios. Training cost and checkpoint bytes are retained. No intelligence claim.
- R5/R6/R8 checksums and fixture grants confer no authority, durability or real scheduling guarantee.

Next: independent oracle and matched-capacity / memory-ablation experiments. Preserve losses. No production integration without separate review.
