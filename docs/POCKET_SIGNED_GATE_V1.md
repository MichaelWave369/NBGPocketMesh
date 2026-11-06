# Pocket Signed Execution Gate v1 · offline authorization research

**Status: implemented local crypto gate, not a production authenticated service.** Origin is SIMULATED_LOCAL and authority remains NONE. This is an additive entrypoint over the merged E0 → Living Library v1 → Pocket Album v0 bridge.

The core boundary is: **an E0 routing decision and an old boolean approval flag are not signed authorization.** The new entrypoint will perform a known, reviewed local score only after it validates an Ed25519 signature over the complete requested execution intent and atomically consumes a unique nonce.

## Protocol and actors

1. **Planner (unprivileged):** prepare a request after confirming a currently admissible E0 HOLD and locally validated network fixture. Preparation imports no executable track and grants no permission.
2. **Signer (separate responsibility):** a trusted operator-controlled process decides whether to sign the request. The code exposes a signing helper for the *demo*, but the private key must never be embedded in a real runner or shipped in its repository.
3. **Gate (trusted local executor entrypoint):** verify Ed25519 signature using an operator-configured pinned public key, exact audience, short lifetime and executor wall clock; spend a 128-bit random nonce in an operator-owned replay ledger using an atomic create-only file.
4. **Revalidation:** reconstruct E0 HOLD and verified v1 album/source refs; confirm the signed plan is still byte-for-byte equivalent. Any drift after nonce consumption refuses execution and burns the permit.
5. **Execution:** only then call the existing E0→v1→v0 bridge with its original typed Keyhole and source-digest checks. Emit a SHA-256-linked receipt including the public signer fingerprint and the downstream bridge receipt hash.

A signed request binds to these fields: schema, audience, policy epoch, unique nonce, issue and expiry timestamps, library digest, exact album ID/revision/digest, profile, selective/eager mode, E0 route receipt SHA, task digest, E0 manifest-set digest, and validated input digest. The separate key ID and algorithm string are also signature-protected.

### Failure behavior

- Missing signature, untrusted signer, altered algorithm, malformed signature, changed request or extra fields: **REFUSE via error before nonce consumption**.
- Expired or future permits: **REFUSE** using the executor clock, not a client-supplied timestamp.
- Replayed nonce: **REFUSE**, including concurrent attempts across cooperative local processes sharing the same protected ledger directory.
- Current route, input, source, budget, album revision or policy mismatch: **REFUSE after spending nonce**. Do not reuse a failed permit; obtain a newly approved one.
- Revoked E0 manifest or missing reviewed album: no approved HOLD can be prepared. An old signed permit cannot override a changed environment.
- Old unverified boolean flags are **not** accepted by this new signed entrypoint. The historical research bridge remains callable separately; a production service must not expose the old unsigned API to untrusted callers.

## Run the demonstration

Node.js 20+; CI runs Node.js 22. No dependency, network, live device, cloud identity or key file download.

```bash
npm test
npm run demo:signed
```

The demonstration generates an **ephemeral** Ed25519 key pair in memory, creates a temporary nonce directory, signs one local health-report request, executes the approved reviewed score once, and confirms the identical permit is refused on replay. It deletes that *demo-only* temporary directory on exit. Never delete or reset the replay ledger in a long-lived service.

In a real process, the trust roots and replay ledger must be configured by the operator and **must not be chosen by the API client**. Never allow caller-controlled clocks to alter validity checks. Real signing policies, authenticated human approval, key rotation, secure key storage, ledger ownership, atomic persistence and audit logging are still external tasks, not features of this demo.

## Security limitations and explicit nonclaims

- The implementation uses actual **Ed25519 verification** and atomically reserves a nonce via create-only local files. It does **not** prove a named human authorized anything: signatures identify possession of a configured key, not personhood, employee identity, or deliberate consent.
- Trusted local JavaScript modules run under regular Node privileges. They are not sandboxed; the v0 registry still disallows caller-chosen module URLs. A valid permit is permission to invoke these *reviewed demo modules*, not arbitrary shell commands, OS operations, network access or untrusted plugins.
- This is an **in-process library entrypoint**, not a network server, PhiID authentication provider, PhiCloud service, OS permission system or cloud HSM. The existing unsigned research APIs remain accessible inside the same process: production enforcement would require isolation and exclusive exposure of the gated entrypoint.
- The nonce ledger resists cooperative concurrent replays while the operator retains the directory. It is not a crash-consistent database, tamperproof audit log, cross-host distributed replay service, or defense against an attacker with directory deletion rights. Its path must be safe, protected and persistent. The signer and trust roots are supplied by a trusted host, never resolved automatically from untrusted permit metadata.
- Receipts hash metadata, not raw diagnostic observations or report text. They attest deterministic local consistency only, not physical device measurements, remote provenance, correctness of diagnosis, or measured speed/memory improvement.
- Everything still uses synthetic network fixtures. No real PhiOS/PhiStream/PocketBrain integration, live device monitoring, neural inference, actual Nested Bubble Gear physics, or continuity-of-consciousness claim.

## Files

- src/pocket-signed-gate.mjs: request preparation, Ed25519 signing helper, strict signature verification, nonce ledger and signed local runner.
- tests/pocket-signed-gate.test.mjs: tampering, replay/concurrency, nonce spend-on-failure, expiry, signer trust, audience/algorithm, altered input/route/budgets and unapproved code paths.
- scripts/pocket-signed-gate-demo.mjs: isolated in-memory-key demonstration.

Next milestones are authenticated key custody and approval UX through PhiID, a process-level service that exposes **only** the signed API, persistent replay state with tested durability, and a sandbox if third-party executable tracks are ever allowed.

**Working maxim:** The router may recommend the album; the signature authorizes a specific performance; the Keyhole still verifies its parts.
