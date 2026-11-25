# PhiMycelium R3 — bounded branch regeneration
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R3 separates immutable containment and procedural pocket state from communication connectivity. It consumes the R1 growth ledger, reconstructs R2 pocket descriptors and canonical sparse edits, and reports a SHA-256 checksum of the retained pocket records. This checksum is an unsigned consistency receipt, not proof of authority. No physical network, live execution, persistence, or migration is performed.

Algorithm:
1. Remove explicitly named failed communication links. Parent containment remains intact even if its communication link fails.
2. Consider explicitly nominated lateral links for pruning in lexicographic order. Preserve parent communication links and reject any pruning that increases the surviving graph's component count. A nominated link is not inferred to be low-use; R0 adaptive weights are not yet integrated.
3. Build a fixed candidate pool of undirected cyclic index offsets 1, 3, 9 and 27, at most four candidates per node before deduplication. Sort by modeled cost then endpoints.
4. Regraft only candidates joining distinct current components, excluding failed and pruned links. Stop when connected or when the edge cap, regraft cap, or candidate pool is exhausted. Report remaining partitions honestly.

All candidate links are assumed permissible within this synthetic fixture. No existing trust or authorization gate is changed; these candidates are not authorization for real connections. The policy is a deterministic greedy connector over a restricted candidate pool, not a globally optimal repair algorithm. Existing edges count toward the same R1 edge cap. Failed links cannot be reused in the same run. A regraft is not a recreated containment relationship. Zero pockets is not reported as connected.

Fixed procedural parameters: 9x9 cells, 96 recurrence iterations per cell; work upper bound is active pockets × 81 × 96. With R1's current 15-stage Fibonacci maximum of 610 pockets, at most 4,743,360 recurrence iterations are evaluated. Node/edge/regraft bounds derive from R1 (729/1456/729). The candidate pool is index-based, not geometric or a biological growth simulation.

Run:
    node --test tests/phi-mycelium-r3.test.mjs
    node scripts/phi-mycelium-r3-demo.mjs

R4 should introduce paired, resource-matched routing workloads with congestion, failure/recovery cost, observation budgets, and negative controls. R5 may expose permission-scoped Altermath commands after separate contract validation.
