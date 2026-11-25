# PhiMycelium R5 — scoped circulation instruction adapter
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R5 is a separate PocketMesh research language, not an extension of Altermath's ABL parser. It uses the R3 regenerated fixture and binds both request and independent fixture grant to a canonical snapshot digest over pocket records and active links. The grant is unsigned, caller-supplied and not a security boundary or authenticated identity. No execution, writes, network access, model calls, growth commands, remote authority or real data transfer.

Instructions: MOVE <numeric-id> traverses one permitted active link; PROPAGATE <numeric-id> moves the logical cursor along deterministic shortest-hop permitted links, not a packet broadcast or payload transfer; OBSERVE <id|degree|edit-count> reads an explicitly granted numeric field at the current pocket; RETURN terminates at root only. Movement invalidates the working scalar. Receipts report observations, paths and cumulative hops, and verification replays the complete deterministic request. Degree describes the whole public fixture, including links outside the traversal grant; do not treat this as topology privacy. Receipts disclose path and scalar metadata. No cryptographic authorization or replay prevention.

Limits: 89 pockets, nine regrafts, 64 instructions, 256 cumulative hops, 8192 source characters. Only explicitly granted nodes and links may be traversed. Both endpoints must be allowed; failed links are absent. A refusal throws and publishes no result, and the caller's fixture is not mutated.

ABL compatibility is deliberately narrow and real: each permitted numeric observation emits a single-pocket projection with exactly one field and an independent observe grant, using existing ABL OBSERVE and RETURN syntax. The local root is a projection, not a conversion of the source address. Dedicated CI checks actual runABL and verifyABLReceipts at Altermath commit dc085e86a62108dee585b16f5d26cbaedcbf8f49, including denied observations. The ordinary test suite skips the producer test without MYCELIUM_ALTERMATH_PATH. Cross-scale movement belongs to R5, not ABL R0. Neither existing interpreter nor signed gates are modified.

Run:
    node --test tests/phi-mycelium-r5.test.mjs
    node scripts/phi-mycelium-r5-demo.mjs

Future gates: R4 measured cohort results/ablation still required before performance claims; R6 persistent versioned pocket memory with conflict detection and recovery, then R7 limited inhabitants and R8 external orchestration. No real execution authority is granted.
