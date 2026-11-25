# PhiMycelium R7 — bounded inhabitant exploration
**SIMULATED / ANALYZE_ONLY / authority NONE.**

Inspired by PhiGenesis's local discovery and negative-control research, but not an import of its runtime. R7 places a deterministic rule-based explorer in the actual R3 34-pocket fixture. The world broker exposes only current identity, binary local signal and adjacent IDs. Movement must follow current links. The experiment harness owns the whole graph and hidden labels; it is not a security sandbox. No model, autonomous code generation, external calls, real authority, or consciousness claim.

Each episode starts at root and allows up to 27 moves by default (1–90). One observation at start and after each move. Score is the count of unique signal-positive pockets visited; repeated visits do not reward. Signals are seeded synthetic labels, not physical or fractal properties. Training and evaluation both receive the same move budget and local frame format. Random chooses a seeded neighbor; novelty prefers least-visited neighbors with ID tie-break; retained adds a secondary preference for previously observed positive signals, then unknown, then negative. Retained uses both within-episode and previous-episode observations, so this is not a pure cross-episode memory ablation. Training trajectories may differ. No global map or future signal supplied to the decision rule.

All policies record training observations in R6 memory and restore a canonical checkpoint before evaluation; only retained uses that prior in its decision rule. The 34 slots of logical memory pocket 0 encode 0 unknown, 1 observed absent, 2 observed present; this is a lab-specific overlay, not a new memory schema. Current observations replace stale values; unobserved prior entries remain in the final checkpoint. No persistent disk writes or replica network. Checkpoint byte counts and both episode move counts are reported, not measured CPU time.

Default six seeds, four evaluation scenarios (unchanged/drift x intact/damaged) and three policies. Drift flips all labels, intentionally hostile to historical knowledge; damage removes every fifth intact link and uses R3 bounded regrafting. All policies see the same evaluation fixture and labels per scenario. Training repeated for each scenario, not pooled as independent samples. Scores and costs are descriptive, no superiority claimed. R4 topology results still require analysis. R5 circulation and ABL adapter are not invoked by this explorer: its movement broker is a local restricted interface, not a new Altermath opcode or integration.

Run:
    node --test tests/phi-mycelium-r7.test.mjs
    node scripts/phi-mycelium-r7-demo.mjs

Next: R8 bounded orchestration with explicit task admission, resource accounting, cancellation and replay; a true PhiGenesis runtime adapter requires an independent pinned contract and comparison against memory-only and conventional traversal controls. Preserve the relational-universe proposal and all existing gates.
