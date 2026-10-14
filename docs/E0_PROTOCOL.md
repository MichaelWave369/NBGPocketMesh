# NBG PocketMesh E0 · frozen simulation protocol

**Status:** E0 candidate; simulation-only. **Origin:** `SIMULATED`. **Authority:** `NONE`.

## Research question

Can a typed, budget-bounded, deterministic routing policy select an admissible single node or two differently declared lineage nodes and refuse inadmissible requests, producing a reproducible decision receipt? This is a software-contract question, **not** a result about AI intelligence or NBG's formal closure properties.

## Vocabularies

- **Bubble**: Manifest describing a bounded task capability. Not an individual consciousness or necessarily a real neural model.
- **Gear**: Typed interface matching between task and capability; no hidden cross-architecture tensor compatibility assumed.
- **Tooth**: Speculative label for an independently trained bounded adapter parameter group, *not part of E0 execution*.
- **Keyhole**: Explicitly declared routing observations: capability, modality, lineage, privacy, resource estimates, and admission state.
- **Closure receipt**: Deterministic route/refusal record, *not* proof of NBG mathematical closure or semantic truth.

## Task contract

`id`, `capability`, `input`, `output`, `privacy`, `remoteConsent`, `requiredLineages` (1 or 2), `latencyBudgetMs`, and `memoryBudgetMiB` are required. Unknown task keys are rejected; raw prompt or image payloads are not accepted. Limits are positive integer synthetic planning units.

## Manifest contract

Unique `id`, `revision`, `capabilities`, `inputs`, `outputs`, `transport` (local/remote), `status` (admitted/revoked), `validThroughEpoch`, `estimatedLatencyMs`, `workingSetMiB`, `lineage`, and `resident`. Unknown keys make a manifest ineligible. E0 uses a **fixed logical epoch** of 1 to keep replay deterministic; no external clock or network services. These manifests are local test data, not trusted attestations. An `admitted` fixture is not production approval.

## Selection rule

1. Parse/validate task and manifest collection (maximum 32; duplicate or invalid IDs rejected).
2. Refuse revoked, stale, incompatible, out-of-budget or unauthorized candidates. Private data cannot be sent to remote nodes even with `remoteConsent` true.
3. Form a single-node path, or all two-node paths with distinct declared lineage IDs. Aggregate estimates conservatively: sequential latency sums and additional memory sums (resident nodes add zero incremental working-set estimate).
4. Keep paths within the task's aggregate limits.
5. Rank by least estimated additional memory, then least estimated latency, then lexical node ID pair. Return `ROUTE` or `REFUSE`.
6. Serialize only routing metadata, the full validated task contract and an SHA-256 digest of the manifest set. Prefix the receipt with schema, policy epoch, `SIMULATED` and `NONE` authority; hash the canonical record. Receipt replay recomputes and compares the whole object.

## Mandatory negative controls

- Missing capability and wrong input modality -> refuse.
- Remote endpoint without consent, or any private task -> refuse remote.
- Revoked, stale, malformed manifests -> refuse those candidates.
- Single-node and combined-path resource overrun -> refuse.
- Two nodes with the *same declared lineage* do not satisfy a two-lineage requirement.
- Mutated decisions or changed manifests invalidate the receipt.
- Duplicate manifest IDs, unknown task fields and invalid task types -> explicit errors.

## Explicit nonclaims and open questions

E0 does not execute AI inference, evaluate specialist quality, prevent forged manifests, prove observation independence, measure disk or VRAM usage, authenticate identity, enforce runtime resource bounds, verify safety of model outputs, or implement learned gear teeth. A later E1 needs held-out real-model tasks and opt-in execution. PhiStream and LightBridge have independent validation gates and must not be assumed ready as dependencies. Upstream NBG synthetic experiments remain independent with their original limitations.
