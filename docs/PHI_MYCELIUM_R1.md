# PhiMycelium R1 — bounded growth ledger
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R1 adds append-only synthetic pocket admission to R0. The default nine generation ceilings are 1, 1, 2, 3, 5, 8, 13, 21, 34. Requests are desired cumulative active pocket counts, not incremental arrivals. A decrease in requests does not remove admitted pockets. Each admitted non-root pocket has an existing nine-way parent and mandatory communication link. Optional lateral predecessor links are added when capacity remains after reserving mandatory links up to the configured terminal ceiling. The stage ledger records demand, admitted nodes, unmet demand and edge counts. No physical allocation, pruning, congestion, authorization, real execution, or holographic storage is implemented.

Limits: at most 15 stages, 729 nodes, 1456 edges, and an explicit per-stage admission cap. Node IDs and coordinates are immutable within a run; edges are append-only. Optional links depend on the declared experiment horizon because the reserve depends on its terminal ceiling. A different horizon can change optional links, so edge-prefix equivalence between runs of different horizons is not promised.

The linear comparator uses ceil(terminal * (stage+1)/stages), with the same terminal ceiling, requests and resource limits. Report active-pocket-stages (a count, not byte-seconds), unmet-pocket-stages, peak admissions and final node/edge counts. Identical ceilings do not guarantee identical realized allocations under constrained demand. Compare these tradeoffs without interpreting lower allocation as better efficiency independent of unmet demand. No performance superiority is claimed.

Run: node --test tests/phi-mycelium-r1.test.mjs
Demo: node scripts/phi-mycelium-r1-demo.mjs
Root npm test automatically discovers the new tests.

Next: R2 deterministic Mandelbrot escape-time metadata with explicit precision and iteration bounds. Then R3 capacity-aware pruning/regrowth, matched topology cohorts and a separate Altermath adapter. No changes to R0, signed gates or live routing.
