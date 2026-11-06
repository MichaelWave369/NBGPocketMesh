# Pocket Executor / PhiID-Compatible Authorization Handshake v0

**Status:** offline synthetic integration contract only. **NOT real PhiID login, authenticated human approval, production identity, or an OAuth grant.** Original signed Gate + one-shot local executor remain unchanged.

## Why this exists

PhiID's identity contract defines principal identity using the cryptographically validated OpenID Connect `(iss, sub)` pair. Crucially, PhiID explicitly separates **identity** from **authorization of local PhiOS effects**. Its R2 `phiid.local-consent-receipt/0.1` records review of proposed PhiMail/PhiCloud profile sharing, with `authority_granted:false`, and is **not a valid Pocket Album execution grant**.

This new protocol is a standalone, PhiID-shaped **authorization handshake experiment**, not a claim that PhiID's current OIDC lab has issued approvals. It introduces separate, operator-pinned Ed25519 approval evidence **in addition to** the existing signed execution permit.

## Sequence

1. An unprivileged planner uses the merged E0 → Pocket Library approved route and obtains a scoped signed execution request.
2. A **permit signer** issues the existing Ed25519 one-use execution permit. It binds the exact album, code, fixture digest, route, mode, audience, lifetime and nonce.
3. An **independent approval signer** receives the permit and, after whatever human authentication and approval review its own operator requires, signs a second statement. This v0 demo DOES NOT implement that authentication or review; it explicitly labels its issuer and subject **DECLARED_BY_SIGNER_UNVERIFIED**.
4. The approval statement binds the hash of the *entire signed permit*, plus:
   - principal: `{iss,sub}` pair, using the future PhiID identity shape, never email or username
   - fixed purpose: `execute-reviewed-pocket-album`
   - fixed scope: `pocket.album.execute`
   - fixed audience: `NBGPocketMesh.local-signed-executor.v0`
   - 128-bit unique approval ID, current policy epoch, issue time and expiry (at most 60 seconds)
5. The **new one-shot worker** accepts exactly `{schema,permit,approval}` from stdin. It loads two separate trusted, operator-owned config files: the existing signed executor public keys/ledger/profile policy, and a new approval policy containing **public** approver keys, allowed principal pairs, revoked approval IDs and the current policy epoch.
6. Before spending the permit nonce, the worker verifies the approval signature, entire permit digest, pinned principal, purpose/scope/audience, lifetime and policy epoch, and **requires different Ed25519 keys for the permit and approval**.
7. Only then does it invoke the merged signed executor, which independently verifies the permit, checks its one-use ledger, validates the approved E0 route, and runs the reviewed typed Album score.
8. The worker returns only status plus cryptographic hashes of the approval, principal, approver key, underlying execution receipt and output. It never returns raw fixture observations or reports.

## What *exactly* is proven?

A valid v0 approval means **a configured approval key signed this exact permit**, and the operator policy currently permits the declared synthetic principal. It does **not** prove that a person owns the OIDC subject, that PhiID verified a login, that MFA or WebAuthn occurred, or that a real user understood/approved a request. A malicious or carelessly managed approval signer could claim arbitrary issuer/subject values. Future real integration must use an independently authenticated OIDC session through audited issuer/audience/signature/expiry validation **before** an approval service signs any statement.

Neither a PhiID R2 consent record nor a raw `iss`/`sub` JSON object can pass this execution gate.

## Use

Node 22 is used in CI; no packages, Docker containers, real Keycloak users or network access are required.

```sh
npm test
npm run demo:phiid
```

The demo generates **two independent ephemeral Ed25519 key pairs in the separate parent process**, writes protected public-key-only config files, requests one synthetic network-health album from the one-shot child and verifies that (a) the signed approval + signed permit succeeds, (b) replay fails, and (c) an R2 consent-shaped receipt fails.

The service executable is:

```sh
node scripts/pocket-phiid-executor-worker.mjs /operator/executor.json /operator/approval-policy.json < signed-envelope.json
```

Both configuration paths are supplied by a **trusted launcher**, never by the stdin client. The approval policy has the following schema:

```json
{
  "schema": "NBGPocketMesh.PhiIDApprovalPolicy.v0",
  "policyEpoch": 1,
  "allowedSubjects": [
    {"iss":"https://phiid.example.invalid/realms/demo","sub":"synthetic-user-369"}
  ],
  "revokedApprovalIds": [],
  "trustedApprovers": {
    "approval-local": "-----BEGIN PUBLIC KEY-----\n...operator-owned Ed25519 public key...\n-----END PUBLIC KEY-----\n"
  }
}
```

This is a local operator config example with a **fake** .invalid issuer and placeholder key. No valid credential is included.

## Refusal and revocation cases

- Missing/forged/altered approval, unknown approver, wrong signer key, modified principal, wrong scope/purpose/audience, changed permit, injected code or extra protocol fields: **REFUSE**
- A PhiID R2 consent receipt, raw profile, browser export or email address: **REFUSE** (not an execution grant)
- Expired/future approval; a new policy epoch or removed allowed principal: **REFUSE** using the worker's clock and operator policy
- A revoked approval ID: **REFUSE** before consuming the permit
- The same Ed25519 key used as permit signer and approver: **REFUSE**
- Replay of an authorized request in a second/concurrent process: **REFUSE** through the existing protected one-use permit nonce ledger
- Executor's own allowed profile list and downstream memory/typed/source/route checks still run independently; a valid approval never bypasses them

## Security and implementation limits

- **No real PhiID OIDC integration:** the schema aligns with PhiID's durable `iss`/`sub` principal model, but no ID token is validated and no PhiID identity record is fetched. This prototype must not accept real account credentials.
- **Old workers still exist:** the earlier signed-permit-only worker and unsigned research functions remain accessible for backward-compatible tests. A production launcher must expose **only** an appropriately gated worker and prevent launching legacy bypasses. There is no production security guarantee until that deployment model is enforced.
- **No network daemon:** this is a stdin-only, one-request local child with operator-controlled file permissions, not an HTTP API or cloud authorization service.
- **Not an OS sandbox:** trusted checked-in JavaScript modules still execute with ordinary Node privileges. Do not run untrusted user code.
- **No real durable revocation service:** the operator policy file is loaded per child and its static allowlist/revocations are local. There is no central PhiID event propagation, OAuth token revocation or distributed key rotation.
- **No signed audit chain beyond local receipts:** hashes and Ed25519 attest key possession and exact bytes, not human approval, source provenance, real-world correctness, or tamperproof durable logs.
- **No real diagnostics or inference:** albums operate on synthetic network fixture input. No PhiMail, PhiCloud, PhiOS, PhiStream or PocketBrain execution is connected.

## Future acceptance criteria

A real PhiID authorization issuer would need audited OIDC/PKCE session verification, strong subject binding, explicit display of action purpose and scope, consent-to-action confirmation, trusted service-to-service signer authentication, key rotation, user-controlled revocation, durable audit evidence, and separate production-grade OS isolation.

**Design rule:** PhiID can establish *who*. An independently scoped, explicitly approved and signed action decides *what*. A Pocket Keyhole still decides *whether the specific performance is allowed*.
