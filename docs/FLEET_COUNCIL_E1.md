# NBG-FLEET-OBS-01 E1 — Synthetic Research Council Evidence Exchange

**Status: PROPOSED INTEROPERABILITY CONTRACT · SIMULATED · AUTHORITY NONE.** E1 implements a pure, offline JavaScript receipt producer and reviewer. It is **not** a live ThinkTank/PocketBrain/Vessie integration, not a network protocol, not a verified GitHub run, and not particle-physics evidence.

## Why

E0 showed that synthetic candidates with identical pooled performance can have different rare-subgroup performance. E1 preserves that E0 observation as an exact-parent, source-revision-declared, role-typed record for three proposed council seats. It is intended to make the next live integration stage reviewable without sharing memory, prompts, tokens, external data, model outputs or execution permissions.

## Entry points

- `src/council-e1.mjs`: `buildCouncilEvidenceExchange(input)` and `reviewCouncilEvidenceExchange(input, claimedExchange)`.
- `tests/council-e1.test.mjs`: executable E1 contracts and adversarial/null controls.
- Run `node --test tests/council-e1.test.mjs` or `npm test`. No extra dependencies, network requests, downloads, live models, writes or secrets.

Input is exactly `{ policyEpoch:1, e0Input, participants }`. `e0Input` must pass the frozen E0 synthetic-only validation. Participants must be **exactly** these identities, each once, with a declared, complete lowercase 40-character Git SHA:

| Participant | Fixed repository | Receipt role | Permitted interpretation |
| --- | --- | --- | --- |
| ThinkTank | `MichaelWave369/think-tank` | HYPOTHESIS_CHALLENGER | HYPOTHESIS_ONLY |
| PocketBrain | `MichaelWave369/PocketBrain` | LOCAL_OBSERVER | DISPLAY_ONLY |
| Vessie | `MichaelWave369/SuperPhiVessel` | GOVERNANCE_REVIEWER | REVIEW_ONLY |

The declared commit SHA is **not verified against GitHub**. The runner does not check the repository exists, load source, discover running systems or issue signatures. A matching SHA-256 deterministic record only demonstrates self-consistency under the same input. Never label it as signed, independent, source-attested or completed field acceptance.

## Output contract

The deterministic envelope includes the E0 schema and exact receipt digest, source revision declarations, a fixed action per role, simulation/privacy/authority labels and per-receipt SHA-256 digests. The collective decision remains `HELD_FOR_OPERATOR_REVIEW` even for a replay match.

- ThinkTank: suggests checking aggregate equivalence against the richer Keyhole when the E0 witness exists.
- PocketBrain: can display the contrasting Keyholes; it does not make scientific determinations.
- Vessie: holds the record for operator review; it does not authorize action.
- All seats are modeled test doubles. No requests reach the real projects.
- BrainC is reserved for a later opt-in local specialist adapter.
- GAIA is reserved for clearly marked symbolic/creative ideation, **not** scientific evidence or confidence scoring.

`reviewCouncilEvidenceExchange` recomputes the entire result and refuses mutated, missing, reordered-field-irrelevant yet content-changing, authority-forged, or stale-input envelopes. Exact replay does **not** certify external provenance, participant independence, physical truth or correctness of a model answer.

## Safety invariants

- No private data. Only `PUBLIC_SYNTHETIC`; no prompt, image, memory, location, personal datum or raw model output fields.
- No real model or tool runs, no external calls, no sharing, no source attestation, no grants, no merge/deploy privileges.
- Version and role/identity allowlists are fixed; unknown keys, malformed counts, duplicate participants, altered SHA, changes to E0 fixture or invented evidence tiers fail closed.
- No inference of independent testimony from multiple model labels. Shared lineage or correlated training must be separately established when using real evidence.
- The E0 fixture is a generic software observation example; it is **not** an LHCb dataset or a new beauty-meson prediction.

## Next, only after this rung passes

**E1-A:** write a separate read-only test-double consumer for the same receipt schema in one receiving project, with explicit integration-version negotiation and tamper controls.

**E1-B:** locally validate a PhiServe-linked ThinkTank seat under real operator consent; then add private-preserving PocketBrain presentation and Vessie review one at a time. Preserve each project's original authorization system. Carry signed/corroborated source evidence only once genuine mechanisms exist.

**E2:** pre-register accuracy/quality and compute-resource comparisons against ordinary stratified evaluation and Bayesian value-of-information baselines, with real local checkpoints and independently verified device execution.

**Agentora/PhiMada:** continue as source-bound job verifier and read-only Evidence Bay; don't generalize Agentora's existing single-repo execution pilot or imply PhiMada can authorize work.
