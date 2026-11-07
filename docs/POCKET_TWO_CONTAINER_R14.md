# R14 · Isolated-Container Trust Boundary Acceptance Lab

**Status:** a reproducible CI and local Docker Compose acceptance test that uses **two runtime roles on one Docker host**. It is not a verified deployment across two physical hosts or two independent administrators, and it does not authorize real PhiOS, network devices, cloud accounts, arbitrary JavaScript, or any action outside the reviewed synthetic Pocket Album fixture.

## Mission

R11–R13 added a signed independent authority, mTLS, certificate-specific client admission/revocation, private-address deployment references and an executor high-water record of signed epochs. Those rungs ran separate processes on the *same runner*, usually with the same OS identity. R14 provides a stronger isolation experiment using separate Linux container UIDs, mount namespaces, and a private Docker bridge to demonstrate that the authority and executor communicate with the **real R13 protocol** while keeping each other's private files unmounted.

The user-visible command is:

```sh
npm run demo:two-container
```

Requirements: **Node.js 22+, OpenSSL, Docker Engine and Docker Compose v2**, permission to use the local Docker daemon and a trusted disposable development host. GitHub Actions runs it as the separate `r14-container-isolation` Linux job. The ordinary `npm test` suite needs no Docker.

The lab image is `node:22-bookworm-slim`. Pulling a registry image and creating Docker networks requires ordinary connectivity to the Docker registry. No HSM, real Keycloak connection, live PhiOS credentials, or public network listener is involved.

## Isolated topology

```text
                         GitHub Actions / trusted Docker host
             (operator owns ALL ephemeral files and Docker daemon)
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  AUTHORITY runtime                 EXECUTOR runtime           │
   │  UID 10001                          UID 10002                  │
   │  /authority : read-only             /trust : read-write       │
   │  Ed25519 anchor PRIVATE key         ONLY anchor PUBLIC key    │
   │  independent epoch history          local R8/R9/R10 trust     │
   │  mTLS server private key            client mTLS credential    │
   │  client certificate allowlist       one-use ledger/audit      │
   │         │                                   │                 │
   │         └──── Docker internal bridge ───────┘                 │
   │              172.29.77.10:8788, TLS 1.3                      │
   │                                                              │
   │  OPERATOR helper container (not network-connected)          │
   │  UID 10001, writable /authority only while invoked          │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

The authority service binds a *fixed literal RFC1918 IPv4 address* on an internal Docker bridge. No Docker host port is published. Client server-identity verification uses a disposable X.509 leaf whose **IP SAN equals that same private-network address**, a pinned SHA-256 leaf digest, the private lab CA, and a client cert explicitly allowlisted by the authority. Each request additionally requires R11's fresh Ed25519-signed challenge and matching epoch/witness digest.

The authority container mounts its epoch history, certificate allowlist and signing material **read-only** and starts without elevated Linux capabilities or new-privilege escalation. An ephemeral, operator-only helper container has a writable mount of that authority directory but **no network namespace**. It advances the independent epoch and revokes the mTLS client only when invoked by the test controller, never by a remote HTTP request.

The executor container sees only the repository's @src/@ and @scripts/@ directories as read-only mounts (no @.git/@ or workspace secrets). CI also sets @persist-credentials: false@ for checkout. It receives a *different* owner-restricted volume containing R8 permit ledger, attempt audit, R9 witness, R10 signed checkpoint, TLS client credentials and R13 high-water continuity. The authority's signing key and directory are **not mounted into it**. The test independently verifies that each runtime cannot access the other's sensitive mount.

There are two executor volumes:
- `executor-old`: complete, internally valid R8/R9/R10 **epoch-1** policy/witness/checkpoint snapshot
- `executor-new`: independently prepared, internally valid **epoch-2** snapshot, with the old permit/approval key IDs retired and new IDs active

Both use ephemeral test roots. The operator controller creates signing keys *outside* the containers and provides only the final R7 dual-signed envelopes to the executor through stdin. No API is introduced for users to sign, choose a module, or override a trust policy.

## Acceptance sequence

The lab performs these assertions against **real Docker containers and the existing PocketMesh R13 one-shot worker**:

1. Build owner-only operator state and generate a disposable CA, private-IP-SAN server certificate, mTLS client certificate, and **four separate Ed25519 application-signing roles**. Copy only necessary **public** trust material and TLS credentials to the executor volume.
2. Prepare and cryptographically validate complete R9/R10 snapshots at epochs 1 and 2. Initialize independent authority history at epoch 1. Change container volume ownership to distinct UIDs.
3. Start the read-only authority on Docker's **internal network**, and verify neither runtime mounts the other side's signing keys.
4. Execute one valid synthetic network-health album against epoch-1 authority and executor. Require **PERFORM**.
5. Try the internally valid **epoch-2** executor before the authority has been promoted. Require **REFUSE** on epoch/witness disagreement.
6. From the separate operator container, **advance the authority's own history to epoch 2**. The old epoch-1 executor still has an entirely valid old policy, witness and signed checkpoint, yet MUST **REFUSE** when querying the now-newer authority. This simulates a complete local trust-bundle rollback without asking the authority to forget the new epoch.
7. Execute a new approved epoch-2 album and require **PERFORM**. Replay that exact same signed envelope in another one-shot process, require **REFUSE** (existing R7 spent-nonce ledger).
8. Stop the authority and attempt another freshly signed epoch-2 action. Require **REFUSE**, with no cached trust fallback. Restart the authority, and require a fresh signed action to **PERFORM**.
9. Use the **network-disabled operator container** to revoke the exact client-leaf certificate fingerprint (not its CA). With the same TLS certificate, a new signed execution attempt MUST **REFUSE** even though the X.509 trust chain is otherwise valid.
10. Stop all containers, return ownership of **only the test-owned temporary tree**, verify R8 audit results and the count of spent permit nonces, and delete all disposable files. Cleanup is attempted even when a test fails.

Expected audit evidence: two epoch-1 attempts (one PERFORM, one REFUSE) and six epoch-2 attempts (two PERFORM, four REFUSE). Each *successful* album is synthetic and metadata-only at the worker output boundary.

The authority operator is the same CI controller that owns the Docker daemon, so this tests **container isolation and protocol behavior**, not independent human authorization or adversarial resistance against the Docker administrator.

## Security and operational limits

**Not a physical two-host deployment.** All containers share one Docker kernel and a single administrator-capable Docker daemon. Docker daemon access is effectively host-level privilege. Separate container UIDs and mounts reduce accidental cross-service access, but a hostile Docker host administrator can access or restore both histories, alter trust roots, replace software or obtain all test credentials.

**Not a durable hardware monotonic authority.** The authority epoch history still uses ordinary owner-owned create-only JSON files. It is only independently stored relative to the executor container, not tamperproof against the test host.

**Not production PKI.** The ephemeral CA/server/client certificates are generated using OpenSSL and destroyed. Certificate rotation is manually modeled by individual authority leaf revocation. No OCSP, enterprise PKI, CRL enforcement, HSM, secure time, or intermediate trust-chain management is deployed.

**Not a production authorization service.** The simulated test principal is Keycloak-shaped but R14 does *not* perform a live Keycloak login. R7's separate real-Keycloak/PhiID test remains the identity acceptance reference. The arbitrary host OS, network devices, PhiMail and PhiCloud, unreviewed modules, remote GPUs and other real PhiOS capabilities are outside this execution boundary.

**Not a complete policy rollback guarantee.** A malicious Docker daemon owner can roll back both the authority state and executor history. The R13 high-water continuity remains a local diagnostic that works only while its host-owned history survives. Cross-host consistency, instant revocation of already-running work, and full policy distribution remain unsolved.

**No production deployment by this PR.** The prior [R13 operator runbook](POCKET_REMOTE_AUTHORITY_R13.md) describes a separate-machine target, but this PR does not provision, connect, or inspect any actual second machine. It adds a **reproducible containerized acceptance gate** for the next real deployment.

## Paths

- `deploy/r14/compose.yaml`: private-network, separate-UID, read-only authority and one-shot executor service definitions
- `scripts/pocket-two-container-trust-lab.mjs`: disposable fixture generation, Docker orchestration, attack sequence and audit verification
- `scripts/pocket-r14-revoke-client.mjs`: opt-in **operator-only** local lab policy-revocation helper, no network endpoint
- `scripts/dev-mtls-fixture.mjs`: optional additional private-IP-SAN server certificate, without changing R12 tests
- `.github/workflows/test.yml`: separate Docker isolation acceptance job
- `package.json`: `npm run demo:two-container` command

## After R14

The meaningful next test should deploy a dedicated **authority VM or physical host** on a genuinely separate administrator-controlled account, with firewall restrictions and TLS cert lifecycle exercised across a real network. That future acceptance should verify asymmetric administration, off-host fault isolation, restored snapshots, and hardware-backed or independently logged monotonic epoch continuity. It must retain the fail-closed behavior already tested here before moving toward any real PhiOS side-effect.

**Design:** An authority is only meaningfully independent when the operator controlling the executor cannot simply rewrite the authority's memory too.
