# PhiMycelium R8 — bounded synthetic orchestration
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R8 closes the initial nine-rung research ladder by scheduling actual R5 circulation calls against a fixed, regenerated fixture. It takes an expected snapshot, explicit batch step/hop budgets, separate per-task fixture grants, and an ordered event list. SUBMIT validates program syntax and reserves its parsed step count and granted maximum hops; CANCEL releases a queued task's reservation; TICK runs one queued task in FIFO order. No implicit dispatch. Duplicate admitted IDs cannot execute again within the batch. Rejected submissions can be retried. A successful call charges actual steps/hops and releases unused reservation; a refused call charges its entire reservation because R5 does not expose partial consumption. Cancellation is pre-dispatch only, not interruption of a running task. Pending work remains reserved in the report; no resume API.

Every event records outcome, available/reserved/spent balances and chained checksum; successful tasks retain the full R5 receipt. Replay recomputes the complete report, not just its hashes. Per-event invariant: initial budget = available + reserved + spent for each resource. These are abstract instruction and hop budgets, NOT measured CPU, GPU, storage or wall-clock limits. R5 independently enforces node/link/observation grants at dispatch. Grants are unsigned fixture data, not authenticated permission. Snapshot and report checksums are consistency receipts, not authority or durable replay protection. No disk, network, process, real executor, priority scheduler, concurrent worker or PhiOS integration.

Limits: 9 distinct task grants, 36 events, total steps 0–576, hops 0–2304, R5's 89-pocket limit. Events must have exact known fields. No new authority-bearing opcodes. Inputs must be ordinary JSON-like fixture values.

PhiOS design reference (inspected revision 5adbd9535302966e0b660dbbc8dfa74bc9fbf076): docs/PHIOS_GOVERNED_EXECUTION_HANDOFF_V0.8.md separates bound actions from live execution and delegates to Spine PermissionGate; docs/NBGA_RUNTIME_CONTRACT_V0.1.md separates observable, identity and authority. This lab never bypasses or implements a competing real permission system. No changes to PhiOS, R0–R7 or existing signed gates.

Run:
    node --test tests/phi-mycelium-r8.test.mjs
    node scripts/phi-mycelium-r8-demo.mjs

Next evidence gates: reproduce and publish R4/R7 cohort outcomes including negative results; fix known methodological gaps with matched post-repair capacity and a pure memory ablation; implement independently reviewed read-only cross-repo contracts, persistent transaction/crash recovery and real resource measurements before discussing runtime adoption. The nine-rung ladder is a research scaffold, not an end-to-end deployed system.
