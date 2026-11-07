# R8 · Pocket Trust Lifecycle and Local Audit Journal

**Status:** optional **offline, local-only** dual-signature execution worker for reviewed synthetic Pocket Albums. This is *not* a production identity service, HSM-backed key management, tamperproof log, crash-safe transactional database, least-privilege OS sandbox, or real PhiOS action controller.

R7 demonstrated real disposable Keycloak → PhiID approval → PocketMesh one-use synthetic execution. R8 addresses a separate operator problem: how to stop accepting compromised or superseded signing keys **without editing code**, and how to preserve limited evidence of both permitted and refused execution attempts.

## Entry point

```sh
node scripts/pocket-trust-worker.mjs /operator/executor.json /operator/approver-policy.json /operator/trust-lifecycle.json < signed-envelope.json
```

The three config paths come from a **trusted supervisor** as process arguments and are not supplied in the request envelope. The worker accepts only the existing `NBGPocketMesh.PhiIDAuthorizedRequest.v0` `schema/permit/approval` envelope through bounded stdin. It reads public key trust roots and protected local replay/audit paths, **never any signing private key**. The old R7 worker remains available for backward compatibility and CI; a real deployment must expose only the intended new worker.

For an ephemeral local demonstration, including overlapping keys, retirement, and verified audit records:

```sh
npm test
npm run demo:trust
```

The demo creates only **temporary fixtures** and removes only the temporary directory it owns. Never clear an operator's real replay ledger or audit directory.

## Trust policy format

```json
{
  "schema": "NBGPocketMesh.TrustLifecyclePolicy.v1",
  "policyEpoch": 1,
  "auditDir": "/operator/protected/pocket-audit",
  "permitSigners": {
    "permit-old": {"fingerprintSha256": "<64-character-SHA256-of-public-SPKI-DER>", "state": "active"},
    "permit-new": {"fingerprintSha256": "<64-character-SHA256-of-public-SPKI-DER>", "state": "active"}
  },
  "approvalSigners": {
    "approval-old": {"fingerprintSha256": "<64-character-SHA256-of-public-SPKI-DER>", "state": "active"},
    "approval-new": {"fingerprintSha256": "<64-character-SHA256-of-public-SPKI-DER>", "state": "active"}
  }
}
```

The lifecycle policy and referenced audit directory **must already exist** at trusted absolute paths, and POSIX permissions are checked as owner-only (`0600` file, `0700` directory). Key IDs must also be present in the existing executor and approval public trust maps. A matching ID alone is insufficient: the *actual loaded Ed25519 public key* must have the exact pinned fingerprint. The original dual Ed25519 signatures, separate trust roots, permission scopes, operator principal allowlists, approval-ID revocation, approval-policy epoch and nonce replay ledger remain mandatory.

### Operator rotation procedure

1. Independently create a new Ed25519 permit signer and **different** approval signer, keeping their private keys outside the worker. Distribute the correct public keys into the existing trusted executor/approver configs under **new key IDs**.
2. Add their exact SPKI DER SHA-256 fingerprints to the lifecycle config with `state: active`. Keep the old keys active **only during an intentional overlap period**.
3. Exercise the new keys using the approved test fixture and check audit results, including one-use denial on replay.
4. Change old keys to `state: revoked` and increment the operator's lifecycle policy epoch, then restart the one-shot workers with the latest protected config. A retired key is refused **before its permit nonce is spent**.
5. Remove retired signer keys from other trusted roots when the operator has completed cutover. Retain necessary audit evidence securely.

**Important:** The lifecycle epoch is recorded in the audit, but it is **not an anti-rollback guarantee**. An attacker able to replace protected operator configs or executable files can reinstall old trusted keys/policies. Anti-rollback requires a separately protected monotonic state or centrally managed trust distribution. Ordinary process restart is not enough if old supervisors/configs remain reachable.

This v1 lifecycle layer is intentionally an *additional enforcement path*, not a unilateral revocation propagation service. The earlier worker still accepts any trusted key configured for it. Production launches **must not expose bypass paths**.

## Audit format and local validation

Each attempt gets a random 128-bit identifier and two separate restricted files under the protected audit directory:

- `<id>.start.json` written using create-only semantics, flushed to file and POSIX directory **before permission checks or any album execution**.
- `<id>.final.json` written after the attempt with status `PERFORM` or `REFUSE` and the hash of its START record. Post-execution journal failures are **hard errors**; the START remains and the caller never receives an unaudited success acknowledgment.

Both records have a canonical SHA-256 digest and include only record type, attempt ID, policy epoch, timestamps, hashes, and result. They deliberately do **not** record raw permit JSON, signatures, private keys, issuer/subject strings, identities, album reports or fixture contents.

`verifyTrustAuditDirectory(dir)` independently checks local record hashes, field schemas, filenames, start/final linkage and identifies incomplete START records. It reports totals for attempts, performed, refused and orphaned. **It is not a tamperproof ledger:** a hostile filesystem owner can replace both record and hash, delete records, or restore an earlier snapshot. An external write-once/remote signed audit sink and protected key custody would be required for stronger guarantees.

### Failure boundaries

- Missing, symlink, over-permissive or malformed operator lifecycle configuration: **REFUSE at startup**; no album can execute.
- Missing or insecure audit directory: **REFUSE**; no album can execute.
- Revoked permit or approver signer, changed public key fingerprint, missing key ID, wrong role: **REFUSE** before consuming execution nonce.
- Invalid signed permit, missing or revoked approval, expired scope, unapproved subject, E0 mismatch or typed Keyhole refusal: **REFUSE**; attempted execution is logged.
- Replay of the same signed envelope across independent local processes: only one cooperative execution can win the existing nonce ledger, while each attempt gets a separate journal entry.
- Disk-full or other audit write failure **before execution**: refuse without running an album. Failure writing FINAL after execution can leave an orphaned START and ambiguous result, never proof that no effect occurred.
- Worker outputs only the existing hash-linked execution receipt and the two journal-record hashes, never raw synthetic report text.

## What is *not* established

- **No production-key rotation authority:** operator manually edits protected, static files. No PhiID-managed distribution, automatic revocation, trusted timestamp authority, expiry windows on public roots, or hardware-backed signing keys.
- **No secure log immutability:** filesystem permissions plus SHA-256 permit local accidental-drift checking, not adversarial evidence retention or guaranteed crash durability, especially on Windows.
- **No code sandbox:** local Node modules run with ordinary process privileges. The runner only allows reviewed fixed modules; it cannot safely import arbitrary community code.
- **No authenticated real PhiOS capability:** the only workload is the reviewed synthetic network-status album. Nothing touches a router, user mailbox, GPU model weights, or external service.
- **Not an end-user signing UI:** R7's existing PhiID verified development session is independent; this R8 role policy verifies the resulting two signatures and does not revalidate OIDC tokens itself.
- **No guarantees under hostile host control:** tamperproof audit and secure anti-rollback would require a separately secured trust anchor and protected OS account.

## Files

- `src/pocket-trust-lifecycle.mjs`: strict operator policy loading, signer state/fingerprint matching, journal writes and local verification.
- `scripts/pocket-trust-worker.mjs`: one-shot permit-only executor with three protected operator config paths.
- `tests/pocket-trust-lifecycle.test.mjs`: rotation/retirement, revocation, replay concurrency, audit integrity, tampering and startup refusal.
- `scripts/pocket-trust-lifecycle-demo.mjs`: opt-in original synthetic two-key rotation test.

**Design rule:** The signer may change; the authorization contract must not. Every attempted performance leaves local evidence before the orchestra plays.
