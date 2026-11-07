# R10 · Independently Signed Trust Checkpoints

**Status:** offline, opt-in security research layer. **No production authorization or proof of monotonic rollback resistance.**

R9 added an operator-maintained local trust-policy witness, but an actor able to rewrite the whole witness history can recompute its unauthenticated SHA-256 hashes. R10 adds a **third, independent Ed25519 operator signature** binding the latest R9 policy epoch and exact witness tip to an expiring statement. The R10 executor verifies a pinned, operator-supplied **public checkpoint key** against a locally supplied, signed checkpoint before any Pocket Album permit nonce is consumed. It continues to enforce the existing **two other independent keys**, PhiID approval protocol, R8 audit, R9 witness policy, E0 routing, code allowlist and one-use nonce.

## Exact trust chain

1. The **permit signer** signs one typed Pocket Album request.
2. The separate **PhiID approval signer** approves the entire permit with a scoped Ed25519 statement.
3. An offline **checkpoint operator signer**, using an **independent third key**, signs a snapshot of the latest witnessed trust-policy epoch and R9 witness digest. This key is not loaded by the worker.
4. The one-shot worker reads only supervisor-selected public trust roots, R8 lifecycle policy, R9 witness directory, and an operator-approved signed checkpoint file.
5. The checkpoint is checked against its strict audience, key ID, Ed25519 signature, 128-bit checkpoint ID, issue/expiry timestamps, host-configured freshness limit, **latest witnessed epoch and exact witness SHA-256**.
6. The R8 executor journals a START event and runs the checkpoint verifier *twice* during its existing pre-execution checks. A bad signature, stale epoch, expired checkpoint, missing witness or untrusted key refuses the request before consuming the execution permit.
7. If valid, only the existing one-shot synthetic local score may run. Receipt metadata still contains no raw identity or diagnostic fixture.

**Important:** A checkpoint operator signing key is **not** a PhiID approval signer or a Pocket Album execution-permit signer. The R10 worker explicitly compares all configured Ed25519 SPKI public keys and refuses a reused key across those roles.

## What gets signed

`NBGPocketMesh.CheckpointStatement.v1` fields:
- audience: `NBGPocketMesh.witnessed-local-executor.v1`
- checkpoint ID: 128-bit random hexadecimal
- policy epoch: 1..256
- latest witnessed record SHA-256
- issue and expiration time in Unix milliseconds (max 24-hour lifetime)

The exact statement, `NBGPocketMesh.SignedTrustCheckpoint.v1` envelope, algorithm, and checkpoint key ID are covered by Ed25519. Its signature is checked using a **pinned public key**, not an identity string supplied by the request. The checkpoint contains no signing private keys, user credentials, raw permit, subject, network observations, or album report.

### Operator-owned checkpoint config

Create an owner-protected config file (POSIX 0600) with this schema:

```json
{
  "schema": "NBGPocketMesh.CheckpointTrustConfig.v1",
  "keyId": "offline-checkpoint-operator",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...real Ed25519 public key...\n-----END PUBLIC KEY-----\n",
  "checkpointFile": "/operator/protected/checkpoint-epoch-001.json",
  "maxAgeMs": 600000
}
```

The checkpoint path, config path and witness path must come from the trusted supervisor, **never client JSON**. Checkpoint files are **create-only** and owner-protected, with positive bounded freshness. If the checkpoint expires, R10 refuses until a new operator-approved checkpoint is issued. Do **not** overwrite an existing checkpoint; publish to a new path and update the protected operator configuration.

### Explicit offline signing and renewal

The operator prepares the R8 lifecycle policy and advances the R9 witnessed policy using the R9 admin command. The checkpoint operator then signs **only the current** witnessed policy with a separate private Ed25519 key held outside the PocketMesh executor process and its working directory.

For the operator-only signing helper (not an endpoint):

```sh
POCKET_CHECKPOINT_OPERATOR_CONFIRM=1 node scripts/pocket-checkpoint-admin.mjs issue \
  /operator/lifecycle.json \
  /operator/witness \
  /operator/checkpoint-config.json \
  /operator/checkpoint-private-key.pem
```

Before issuing, the helper checks exact current witness/epoch, strict signer-file ownership/mode, Ed25519 algorithm and that the private key's public identity matches the pinned public checkpoint config. The helper writes the checkpoint file using create-only semantics. The confirmation environment variable is **accident prevention, not authentication**. The operator must protect and separately administer the signing key and checkpoint configuration.

A renewal requires selecting a **new checkpoint filename** and explicitly updating the protected configuration before running the signing command. If a policy promotion happens before a corresponding newly signed checkpoint, the R10 executor **fails closed**, while the older R9/R8 research workers remain separate.

The one-shot R10 executor takes **five trusted host paths**:

```sh
node scripts/pocket-checkpoint-worker.mjs \
  /operator/executor.json \
  /operator/approval-policy.json \
  /operator/lifecycle.json \
  /operator/witness \
  /operator/checkpoint-config.json < signed-envelope.json
```

It accepts the same fixed `NBGPocketMesh.PhiIDAuthorizedRequest.v0` client envelope as the older one-shot workers. No custom checkpoint, arbitrary module, private key or trust root can be supplied in the request.

## Reproduce offline

```sh
npm test
npm run demo:checkpoint
```

The demo uses disposable test keys and temporary operator-owned files only. It demonstrates old/new permit-signing keys initially allowed, then an R9 policy promotion which immediately invalidates the older checkpoint. The operator issues a replacement checkpoint, retiring old permit and approval keys, and the R10 worker accepts the surviving keys while refusing retired keys. All attempts are recorded in the original R8 local audit journal.

14 new R10 tests cover real signed synthetic execution, absent/expired/future checkpoints, key substitution, tampering, strict host-configured maximum age, retired-key independence, stale policy and witness, operator-only create-only issuance, symlink/permission refusal, and parallel one-use replay across child processes.

## Security limitations (do not confuse a signed file with immutable history)

- **Improved:** local witness/policy edits cannot pass checkpoint verification without the separately controlled Ed25519 private key. A current checkpoint binds the latest recorded R9 witness epoch, is short-lived, and can be renewed by a separate explicit operator action.
- **Not a monotonic trust anchor:** an attacker who restores an *old complete bundle* containing an old policy, old witness history, a then-valid signed checkpoint and matching operator config may replay that bundle **until the checkpoint expires**. A sufficiently privileged attacker can replace code, roll back the executor clock or alter the configured trust root. No TPM counter, remote independently administered log or secure hardware clock exists here.
- **No exclusive signer custody enforcement:** this code supplies an offline signing CLI and a worker that reads **only public keys**. It does not set up separate OS users, an HSM, remote signer ACLs or an audited key service. The operator must enforce actual private key isolation; the same-UID lab fixtures deliberately do not.
- **No complete transactional authorization:** expiry and witness checks cannot guarantee revocation of already-started work; the worker does not lock policy state throughout execution or coordinate multiple hosts. The R8 file audit is still not tamperproof.
- **No protected real work:** the only executable tracks are the reviewed synthetic Observe/Diagnose/Report modules running with ordinary Node privileges. No real PhiOS action, remote network probe, GPU inference, arbitrary plugin, authenticated production identity or OS sandbox has been added.
- **Old APIs exist:** the original R7/R8/R9 workers are retained for backward-compatible research. Any real supervisor must expose only the intended R10 worker and block alternate routes.

## Implementation map

- `src/pocket-signed-checkpoint.mjs`: strict checkpoint contract, operator-side offline issuance helper, create-only publication, executor-side public signature and witness verification
- `scripts/pocket-checkpoint-admin.mjs`: explicit operator-only issuance and matching pinned public-key check
- `scripts/pocket-checkpoint-worker.mjs`: one-shot third-signature + prior two-signature, witnessed local executor
- `tests/pocket-signed-checkpoint.test.mjs`: real child process negative controls and receipt evidence
- `scripts/pocket-signed-checkpoint-demo.mjs`: ephemeral key transition, signing renewal and journal verification

**Design principle:** A witnessed policy is a memory of the approved score; an independent signed checkpoint is the operator's time-limited attestation that this is the score the orchestra should still trust.
