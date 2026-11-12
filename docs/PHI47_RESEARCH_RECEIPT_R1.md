# PHI47-RECEIPT-R1 · Read-only research receipt boundary

This adapter **does not call the E0 router or an executor**. It accepts only a narrowly typed 47-node, eight-neighbor synthetic scalar/observability summary and returns `ANALYZE_ONLY`. The summary carries no prompts, keys, user information, task payloads or decision authority.

Run `node --test tests/phi47-research-receipt-r1.test.mjs` or `npm test`.

The input has `schema: phi47-synthetic-observation-v1`, `origin: SIMULATED`, `authority: NONE`, `privacy: public-synthetic`, declared source of NestedBubbleGear or Altermath, an unverified revision claim or an explicitly supplied 40-character commit SHA, `nodes: 47`, `degree: 8`, and exactly two finite metric numbers: `observationEntropyBits` and `conservationError`.

The SHA-256 digest detects accidental or adversarial modification **relative to a previously retained digest**. It is NOT a signature, authenticated GitHub provenance, genuine execution attestation, nor scientific correctness proof. Any author can fabricate a new valid hash. Revision and source labels are unverified assertions.

Even a syntactically valid receipt may only be inspected. It cannot:
- grant permission, consent, identity, or model execution;
- route private tasks or change the PocketMesh production E0 policy;
- claim quantum, consciousness or physical effects;
- be promoted without independent source pinning and held-out real-task tests.

This deliberate fail-closed boundary keeps the PHI47 experiment separate from the existing PocketMesh router, signed-gate stack, and E1/E2 training evidence.
