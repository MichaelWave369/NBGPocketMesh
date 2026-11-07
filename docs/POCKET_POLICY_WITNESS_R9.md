# R9 · Policy Witness and Stale-Policy Refusal

**Status:** working **offline, operator-maintained** policy witness for the local NBGPocketMesh dual-signature executor. **This is rollback detection while the witness survives unchanged, not a tamperproof anti-rollback security primitive.** No live PhiOS capability, production signing service, HSM, TPM counter, hardened OS sandbox or externally administered audit authority is implemented.

## Why R9 exists

R8 provides manual Ed25519 signing-key rotation, revocation, per-attempt local audit records and a one-use nonce ledger. Its lifecycle policy is a local JSON file. If someone accidentally restores an *older* JSON file, an old retired key can appear active again. R8 checks the current configured file but does not have an independent local memory of which policy revision the operator previously approved.

**R9 adds a separate, operator-owned witness directory** containing create-only, hash-linked **policy epoch** records. The worker reads the complete chain and requires its current R8 policy to match the newest witnessed epoch exactly. Nothing in a client request can select the witness directory or advance its history.

### What is actually checked

Each epoch record contains:

- Versioned schema `NBGPocketMesh.PolicyWitness.v1` and contiguous integer epoch (1..256)
- SHA-256 of the complete R8 lifecycle policy JSON object, using canonical object-key ordering
- SHA-256 of the *fixed audit destination path* and the public permit/approval key fingerprints and active/revoked states
- SHA-256 of the previous epoch record (null only for epoch 1)
- Recording timestamp and the record's own SHA-256

No private keys, signed permits, subjects, ID tokens, raw observations, execution outputs or signature secrets are stored in the witness.

Before the existing audited R8 executor runs an album, it rechecks the witness against the configured lifecycle policy. A mismatch yields **REFUSE**, without consuming the execution permit nonce. The R8 START and REFUSE audit records are still written when this pre-execution guard rejects a request.

The witness also enforces signer lifecycle invariants:

- Epochs must increase by **exactly one**, from epoch 1. Missing, extra or changed records fail closed.
- Previously recorded signing-key IDs and public key fingerprints cannot be removed or rebound to new material.
- Once an approval or permit signer becomes **revoked**, the same key ID cannot become active again. For a new key, use a **new key ID**.
- Audit destination cannot change during witnessed rotation. A deliberate migration to a new audit host or destination requires a separately reviewed migration protocol, not silent config editing.
- A new signing-key ID starts active; all policy fingerprints must be explicitly enumerated (maximum 8 per signer role).
- New and existing active keys can overlap during the planned transition. The original policy may still retire individual keys before their Ed25519 permit expires.

These invariants are enforced in a **separate operator promotion step**. The one-shot worker reads the witness and does not contain a policy promotion command in its stdin interface.

## Operator-only deployment procedure (development host)

Use **three separate restricted directories** for the witness, R8 audit journal and the one-use nonce ledger. Ideally the witness is maintained under a **distinct OS administrative account**, with a supervisor making it readable to the executor but not writable by it. That separation is **not automatically configured** by this project and has to be designed for your OS.

Prepare the R8 policy file with `policyEpoch: 1` and keys already independently reviewed. Provision an **empty** witness directory with restrictive permissions (on POSIX, mode 0700 and appropriate ownership). The following explicit operator command creates `epoch-000001.json`:

```sh
POCKET_WITNESS_ADMIN_CONFIRM=1 node scripts/pocket-witness-admin.mjs init /operator/witness /operator/lifecycle.json
```

Run the new worker only with the **four trusted paths** provided by the supervisor:

```sh
node scripts/pocket-witness-worker.mjs \
  /operator/executor.json \
  /operator/approval-policy.json \
  /operator/lifecycle.json \
  /operator/witness < signed-envelope.json
```

For planned rotation, first create the next lifecycle policy, incrementing `policyEpoch` **exactly by one**; keep all old signer IDs and fingerprints, mark retired signers as revoked, and introduce new key IDs for new public key material. Then, from the trusted operator account:

```sh
POCKET_WITNESS_ADMIN_CONFIRM=1 node scripts/pocket-witness-admin.mjs advance /operator/witness /operator/lifecycle.json
node scripts/pocket-witness-admin.mjs inspect /operator/witness
```

The new worker requires that the loaded policy exactly match the latest witnessed epoch. **During the period before the promotion is complete, workers may refuse rather than run an older policy.** A restart of the one-shot worker reads the latest config and witness.

The explicit confirmation environment variable prevents accidental CLI invocation. It **is not authentication**. Only OS-enforced operator file ownership, least privilege, and a separately secured administrative action can protect promotion from an attacker.

## Test locally

```sh
npm test
npm run demo:witness
```

The demo uses synthetic Keycloak-shaped principal values, ephemeral in-memory private keys held **outside the worker**, temporary operator configs, separate temporary witness/audit/nonce directories and two independently signed execution roles. It performs an old-key and new-key overlap, witnesses epoch 2 with both old keys retired, verifies refusal of the old keys, performs with the new keys, and checks the local audit chain. Only the demo-owned temporary tree is deleted.

### Adversarial tests

The R9 suite checks an uninitialized witness, older policy file, same-epoch edited policy, new and retired key acceptance, revoked signer reactivation, key ID rebind, signer tombstone removal, audit destination swap, skipped epochs, concurrent admin promotion, missing/altered witness records, bad filesystem permissions, symlink directories and cross-process replay. R8's full existing tests still run.

## Critical nonclaims

**Not a cryptographic anti-rollback guarantee.** The witness records are keyed hashes of public/nonsecret metadata, not remotely witnessed or hardware-signed monotonic counters. Someone with sufficient filesystem rights can delete the last record, rewrite the complete chain, replace the worker binary or restore an older whole-host snapshot. The worker has no evidence of the erased history. It cannot prevent a privileged adversary from bypassing this experimental system. A **separate trust administrative domain** (protected remote checkpoint, TPM monotonic counter, or independently signed transparency log) is needed for robust rollback resistance.

**Not a transactional revocation service.** A trust-policy promotion and an in-flight worker can race. R9 rechecks immediately before downstream authorization, but does not lock the operator's policy history for the duration of execution, offer global propagation or guarantee instantaneous revocation of already-started work.

**Not durable audit in the adversarial sense.** The existing R8 journal and this witness both use create-only and POSIX fsync as best-effort local measures. Hardware/Windows durability and hostile-admin tamper resistance are not proven. The R8 audit directory must remain separate from the witness directory, and a crashed/partial epoch write deliberately blocks future execution until the operator reconciles it.

**Not an isolated signer implementation.** The PocketMesh worker uses **public trust keys only**, as in R7/R8; the external PhiID development approval signer still has a private-key file. This rung does **not** add hardware-backed key custody, WebAuthn step-up, secure remote attestation, or a dedicated signer daemon.

**Not production permission.** Reviewed JavaScript runs under normal Node privileges with synthetic network fixtures. The previous unsigned research APIs and R8 workers remain present for backward compatibility, so deployment must prevent them from being exposed as bypasses.

## Implementation

- `src/pocket-policy-witness.mjs`: validate/create/read chain, enforce no key reactivation/rebinding, assert current policy.
- `scripts/pocket-witness-admin.mjs`: explicitly opted-in operator-only initialize / advance / inspect commands.
- `scripts/pocket-witness-worker.mjs`: one-shot, permit-only, witnessed R8 execution; no writable trust policy action in request.
- `tests/pocket-policy-witness.test.mjs`: independent negative controls and cross-process behavior.
- `scripts/pocket-policy-witness-demo.mjs`: ephemeral operator promotion and execution demo.

**Design rule:** If the trust sheet says a conductor retired, the orchestra refuses any older score while its independent witness still remembers the retirement.
