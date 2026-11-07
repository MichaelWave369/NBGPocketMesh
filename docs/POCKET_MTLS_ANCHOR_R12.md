# R12: Mutual-TLS Anchor Transport

**Status:** working TLS 1.3, mutually authenticated, certificate-pinned reference transport for R11's independent trust authority. **Not** a production off-host trust service, remote deployment, secure monotonic counter or privilege-isolated execution environment.

## What changed

R11 challenged a separately maintained trust authority over cleartext loopback HTTP. R12 adds a separate HTTPS authority and one-shot executor using the **same R11 Ed25519 challenge-response protocol**, with three independent layers of assurance:

1. **TLS 1.3 and server validation.** The client validates the authority's CA chain and DNS/IP subject alternative name, and *also* pins the exact SHA-256 of the server's leaf X.509 DER. Server certificate changes need an explicit operator trust-config update.
2. **Mutual TLS.** The authority requires a CA-issued client certificate. Clients lacking a certificate or presenting an untrusted certificate are refused before the read-only application handler. The client certificate/private key must match.
3. **Application Ed25519 signature.** After mutual TLS, the executor generates a fresh random 128-bit challenge and demands a recent, signed R11 attestation with matching nonce, fixed audience, authority key, epoch and R9 witness digest. An old valid response with a different nonce is refused.

The old R7-R11 rules remain mandatory: exact signed permit, independent PhiID action approval, R8 lifecycle and audit, R9 witness, R10 checkpoint, and one-use nonce ledger. The authority does not expose any mutation endpoint. The executor does not accept client-supplied URLs, trust roots, certificate paths, or unapproved tasks.

## Operator-owned client configuration

The trusted supervisor provides a mode-0600 config with:

```json
{
  "schema": "NBGPocketMesh.TlsAnchorClient.v1",
  "endpoint": "https://127.0.0.1:8788/v1/attest",
  "keyId": "anchor-operator",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...real Ed25519 public key...\n-----END PUBLIC KEY-----\n",
  "caFile": "/operator/mtls/anchor-ca.crt",
  "clientCertFile": "/operator/mtls/executor-client.crt",
  "clientKeyFile": "/operator/mtls/executor-client.key",
  "serverCertSha256": "<64 lowercase hex digits of server leaf DER SHA256>",
  "timeoutMs": 2500,
  "maxAgeMs": 5000
}
```

All credential paths must be absolute, regular, non-symlink, size-limited, owner-only files on POSIX. Windows ACL enforcement has **not** been audited. The endpoint URL is operator-pinned and must use HTTPS and exactly `/v1/attest`, without credentials, fragments, query data, or redirects.

The executor's TLS **client private key is present in its own process** to authenticate transport. It must never be confused with the four **separate Ed25519 application signer roles**: permit, PhiID approval, R10 checkpoint and independent R11/R12 authority. Those four signer private keys remain outside the executor process.

## Local reference run

Prepare operator-owned R8/R9/R10 policy, witness and signed checkpoint as documented in previous rungs. Initialize the independently maintained anchor state using the R11 offline admin CLI. Provision an independently controlled Ed25519 authority signer plus TLS server private key/certificate and CA trust for clients.

Start the R12 HTTPS reference authority, **bound to 127.0.0.1 only**:

```sh
node scripts/pocket-mtls-anchor-authority.mjs \
  /authority/epoch-history \
  /authority/anchor-signing-private.pem anchor-operator \
  /authority/server-tls.key /authority/server-tls.crt \
  /authority/client-trust-ca.crt 8788
```

Launch the one-shot R12 worker with **six supervisor-selected paths** and the unchanged signed action envelope on stdin:

```sh
node scripts/pocket-mtls-anchor-worker.mjs \
  /operator/executor.json /operator/approval-policy.json \
  /operator/lifecycle.json /operator/witness \
  /operator/checkpoint-config.json /operator/tls-anchor-client.json \
  < signed-envelope.json
```

Authority promotion still uses only the R11 operator CLI. It is not available over HTTPS. A local/remote epoch mismatch intentionally blocks execution. The reference server binds loopback; a genuinely remote host, firewall policy, independent admin identity, secure remote PKI lifecycle and production network deployment have **not** been implemented here.

## Reproduce the test

```sh
npm test
npm run demo:mtls
```

The test/demo-only `scripts/dev-mtls-fixture.mjs` runs the OpenSSL CLI in a temporary folder to generate a private disposable CA, a SAN-equipped localhost server certificate, an approved TLS client certificate and a rogue CA/client. All keys and certificates are generated at runtime, then removed. **No key or certificate is committed.**

The R12 process tests cover:
- TLS 1.3 with accepted client certificate, CA verification and exact server leaf pin
- No client certificate, invalid client CA, wrong client private key, hostname mismatch, changed server pin, untrusted server CA
- HTTP downgrade, URL injection, redirects, untrusted Ed25519 signer, oversized replies and replayed signed challenge
- Unavailable authority, complete rollback of local R8/R9/R10 files against a newer independent authority, and concurrent one-use nonce replay refusal

R11's original loopback-HTTP tests continue to run independently to preserve previous research behavior. The R12 demo proves a real authenticated TLS handshake and the same synthetic, reviewed network-health album, not an actual PhiOS action.

## Security boundaries

- **Not truly off-host:** the reference HTTPS authority and executor may share the same machine, UID, storage and clock. mTLS authenticates their connection; it does not isolate administration.
- **Not immutable external history:** authority epoch files remain create-only local records with hash chaining. An attacker with privileged authority-storage control can restore those records. A separately secured monotonic counter or audited external transparency service remains necessary.
- **Not hardware-backed key custody:** the mTLS client key is read from a protected PEM file by the worker. The authority TLS and Ed25519 keys are also file-backed in this prototype, not HSM-held.
- **Not an execution sandbox:** reviewed synthetic JavaScript modules still run under ordinary Node privileges. Older workers stay available for backward-compatible research and must be inaccessible from any production supervisor.
- **No live capability authority:** this introduces no production PhiID login, actual network-device operations, email actions, model execution or real PhiOS effects.
- **Not automatic certificate rotation:** renewing server certificates intentionally requires updating the explicit leaf pin; CA and client cert rotation need separate operator review and rollout.

**Next gate:** run the authority under a distinct host/administrator, build audited certificate issuance/rotation and revocation, establish protected monotonic epoch continuity, and enforce a least-privilege execution boundary.

**Design maxim:** the conductor now proves both their encrypted transport identity and a fresh cryptographic agreement on the score before PocketMesh plays a note.
