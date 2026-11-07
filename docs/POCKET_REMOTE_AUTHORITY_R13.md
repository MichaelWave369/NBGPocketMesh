# R13 · Private-Network Authority Deployment and Trust Continuity

**Status:** reviewed *deployment reference* and working local CI integration. The reference server can bind an explicitly approved private IPv4 interface, but **we have not installed or tested it on two independently administered machines**. The suite executes only the built-in synthetic network-health Pocket Album. This is not production authority over PhiOS, real devices, user accounts or arbitrary code.

## Why R13

R12 secured the anchor connection using TLS 1.3, mutual X.509 authentication, an exact server leaf-certificate pin and a fresh Ed25519-signed authority challenge. But a client certificate trusted by the authority's CA was automatically admitted, and the one-shot executor did not preserve a local record of the highest signed anchor epoch it previously accepted.

R13 adds three **opt-in** boundaries without changing R7–R12 research workers or their tests:

1. **Explicit authority-side client allowlist.** Each mTLS client certificate must have its *exact X.509 DER SHA-256* listed as active in a protected authority-owned policy. The server reloads the policy on every request, allowing client-specific revocation and controlled overlapping certificate rotation without trusting all certs issued by the same CA. Revoked, missing, symlinked or insecure policy files fail closed. Its client-policy revision is descriptive metadata; it **does not prevent a hostile authority administrator from restoring a prior policy**.
2. **Private-network bind and reference service unit.** A new CLI requires a canonical, literal RFC1918 IPv4 listen address, a fixed nonzero port and explicit `POCKET_ANCHOR_PRIVATE_BIND_APPROVED=1` for a nonloopback bind. Wildcard, public, link-local, DNS and IPv6 listeners are refused in this reference. The separate systemd example can be installed on a distinct authority host, with a read-only service mount and operator-only CLI promotion of the epoch history. The environment flag is *intentional operator consent*, not an authentication mechanism or network firewall.
3. **Executor-side continuity high-water.** An additional one-shot worker verifies the independent mTLS + Ed25519 attestation and *then*, before consuming any permit nonce, records the accepted epoch and witness digest under its own protected local continuity directory. A later lower epoch or different witness for an already accepted epoch fails. Records use create-only owner-restricted files, SHA-256 linkage and file/dir flushing on POSIX. This is **local accidental-regression/equivocation detection**, not an immutable monotonic counter or protection against full executor-host snapshot rollback.

## Client access policy on the authority

A restricted (mode `0600` POSIX) operator-owned file has the exact schema:

```json
{
  "schema": "NBGPocketMesh.AnchorClientAccessPolicy.v1",
  "policyRevision": 1,
  "clients": [
    {"certSha256": "<64 lowercase hex characters>", "state": "active"},
    {"certSha256": "<second-client-leaf-sha256>", "state": "revoked"}
  ]
}
```

The fingerprints are SHA-256 of **complete DER-encoded X.509 leaf certificates**, not SPKI fingerprints or arbitrary subjects/CNs. Signers from the same CA remain distinct. To rotate a client: first issue a new certificate under the reviewed CA, add its exact leaf digest as active, test it, then mark the prior digest revoked and increment the policy revision. The server reloads the policy on each request, so a revoked certificate stops receiving attestations even if its TLS handshake is still CA-valid.

The server's CA remains a separate authentication layer and its independent **R11 Ed25519 signer** still signs fresh challenges. Merely adding a client fingerprint does not authorize any Pocket Album; the executor checks the original PhiID approval, permit, R8/R9/R10 state and trusted module routing before execution.

## Separate-machine reference deployment

The intended trust boundary is:

- **Authority host A:** privately addressed Linux system under a *different administrative trust domain*, with its own R11 epoch history, Ed25519 anchor private key, TLS server identity and protected client-access file. No original PocketMesh execution modules, local R8 replay ledger, or PhiID login session are needed on this host.
- **Executor host B:** separate machine with R7–R10 policy/witness/checkpoint, a pinned R12 HTTPS endpoint/CA/leaf digest, approved client X.509 key, and the new R13 continuity directory. Only the **public** anchor Ed25519 root is present on this host, not its private signing key.

**No two-machine deployment has been performed here.** The included tests use different processes and protected temporary directories on the same GitHub-hosted runner. The example addresses below are placeholders and must match *your own* network topology and X.509 IP SANs.

### Authority host A

Provision an owner-only authority epoch directory such as `/var/lib/pocket-anchor/epochs` and owner-restricted key/config files in `/etc/pocket-anchor`. Use the previous **R11 operator-only** `init` and `advance` commands to manage the authority history outside the daemon's service sandbox. Review the R9 witness digest before each promotion; the authority server offers no mutation endpoint.

For example, after setting up a local service account, certificate chain and binding interface, run from an approved private-network host:

```sh
POCKET_ANCHOR_PRIVATE_BIND_APPROVED=1 node scripts/pocket-remote-anchor-authority.mjs \
  /var/lib/pocket-anchor/epochs \
  /etc/pocket-anchor/anchor-ed25519-private.pem anchor-operator \
  /etc/pocket-anchor/tls-server.key /etc/pocket-anchor/tls-server.crt \
  /etc/pocket-anchor/client-ca.crt /etc/pocket-anchor/client-access.json \
  10.20.30.40 8788
```

A nonloopback bind cannot start without explicit opt-in. The authority must bind an IP address actually assigned to its own interface. **Configure host firewall and any VPN to allow only the specific executor host(s)**. The Node process does *not* create firewall rules, verify physical host separation or configure VPN identity.

See [the illustrative systemd unit](../deploy/r13/pocket-anchor.service.example). The unit uses a dedicated service account, restricted file modes and a read-only mount namespace for state and keys, while permitting manually authorized administrative changes outside that service. Its exact behavior depends on the host's systemd, POSIX ownership and policy setup. It is **not installation automation or evidence that a hardened service was deployed**.

### Executor host B

Continue to use the reviewed **R12 client trust config**. Point its `endpoint` at the authority's actual private address, for example `https://10.20.30.40:8788/v1/attest`, and issue a server TLS certificate whose SAN contains `IP:10.20.30.40`. Pin the exact DER SHA-256 of that server leaf. Provision the already-approved TLS client certificate and key; never copy the R11 private Ed25519 signer to this host.

Create a dedicated, initially empty owner-only (0700 POSIX) directory for **executor continuity**, separate from R8 audit, R9 witness, R11 authority history and the replay ledger. The R13 worker **never creates or resets it**.

The one-shot executor receives **seven supervisor-selected operator paths**:

```sh
node scripts/pocket-continuity-worker.mjs \
  /operator/executor.json /operator/phiid-approval-policy.json \
  /operator/lifecycle.json /operator/witness \
  /operator/checkpoint-config.json /operator/tls-anchor-client.json \
  /operator/anchor-continuity < signed-envelope.json
```

The unchanged client envelope contains only the original signed, typed `schema/permit/approval` request. It cannot choose the authority URL, client key, trust roots, history directory, host bind or policy promotion.

### Continuity behavior

- A fresh, valid, mutually authenticated and independently Ed25519-signed anchor state may establish the **initial high-water** of an empty operator-provisioned continuity directory.
- A subsequent signed attestation at the same epoch with the *same witness digest* is accepted without rewriting the old evidence.
- A larger epoch is appended (potentially skipping epochs while the executor is offline); a smaller epoch, or a conflicting witness for the already accepted epoch, is rejected.
- Corrupted record, missing directory, unexpected file, wrong ownership, symlink or broad permissions refuse before performing an album.
- Concurrent cooperative workers may accept the same signed epoch, but the original R7 single-use permit ledger still allows only one execution.

This continuity directory lives on the **executor host**, so an adversary who can restore *both* that directory and all other local trust files may erase its high-water. While a **separately administered authority** remains trustworthy and remembers the newer epoch, its fresh R11 challenge still rejects the old bundle. R13 continuity is therefore a **second local diagnostic**, not a substitute for the independent authority.

## Reproducible proof

```sh
npm test
npm run demo:remote
```

The demo runs on a single machine using disposable CA/server/client certs generated at runtime by OpenSSL. It exercises:

- R12 TLS 1.3, CA trust, exact server pin and a fresh Ed25519 anchor challenge.
- The **R13 client-certificate fingerprint allowlist**, separate from CA trust.
- A one-shot signed synthetic network-health album and persisted continuity floor.
- Independent authority advancement to epoch 2, failed R10 stale checkpoint, failed complete R8/R9/R10 local rollback, old-key retirement and continued execution with permitted keys.
- Original R8 refusal audit and R7 replay ledger.

R13 tests additionally refuse a second *CA-valid* but **unlisted** client, verify admission/overlap and immediate revocation by policy-file update, reject missing/corrupt continuity history, and enforce safe literal IPv4 private binding. All changes to R7–R12 behavior remain additive.

## Important limits

- **Not an actual separate authority deployment:** neither host A nor host B has been provisioned by this PR. A static service-unit example and local tests are not evidence of off-host administrative independence.
- **Not tamperproof client revocation or continuity:** both records live in ordinary operator-controlled files. A privileged administrator can restore, rewrite or delete them. The authority history is also not hardware-monotonic.
- **Not automated PKI:** certificate issuance, CRLs/OCSP, client credential custody, pin rollover, DNS, firewall rules, secure time and emergency key rotation require operator procedures and additional testing.
- **No high-privilege execution:** Node's reviewed synthetic albums still run with ordinary Node privileges. The mTLS client key remains readable to the worker, while the four Ed25519 application-signing private keys are not loaded there.
- **No production PhiOS action authority:** no real network device, cloud mailbox, operating-system action, remote model, arbitrary plug-in or production human approval is authorized. Prior research worker entrypoints still exist and must not be exposed as bypasses.

**Next gate:** install and test authority and executor on *genuinely separate machines*, verify firewall isolation and certificate lifecycle, provide an independent protected monotonic epoch source, and design a least-privilege real-action sandbox under a reviewed threat model.

**Engineering rule:** Valid TLS certificates do not automatically imply permission, and remembered authority history cannot silently move backwards.
