# Pocket Executor Process Boundary v1

**Status:** offline one-request stdin-only Node.js executor, origin SIMULATED_LOCAL, authority NONE. This is not a production OS sandbox, a network service, or a PhiID identity integration.

## Why this exists

The merged Signed Gate is an exported research library API alongside older unsigned research functions. This adds a **separate executable process** whose external request surface accepts only one signed execution permit. The worker does not expose an unsigned E0 route, free-form task, remote plugin path, private key, operator flag, arbitrary input data, custom clock, trust root or replay-ledger directory.

## Execution protocol

1. A separate planner prepares a scoped signed-gate request; an independent, operator-controlled signer signs it with an Ed25519 private key. The key must **never be placed inside the executor**.
2. The operator supplies a protected local config file holding only **public** Ed25519 trust roots, a protected persistent replay-ledger directory, and an explicit allowlist of approved album profiles. The config path is chosen by the service supervisor, **not** supplied by the stdin client.
3. The worker checks the config schema, public key types, file ownership/mode where available, symlinks, and replay-ledger directory restrictions. It accepts at most 8 KiB of config and 16 KiB of stdin input.
4. Exactly one JSON request containing a signed permit is accepted per process. The worker uses the existing Signed Gate to verify signature, audience, expiration on the executor clock, input hash, source, album, E0 routing and typed Keyholes.
5. A signed permit's nonce is atomically marked spent in the local ledger before execution. A second or concurrent child using the same permit refuses.
6. The worker emits exactly one JSON response with decision, origin and hash-only receipt metadata. It never emits raw fixture observations or the generated report.

## Operator configuration example

This is an illustrative shape with a placeholder public key, not an actual credential.

```json
{
  "schema": "NBGPocketMesh.ExecutorConfig.v1",
  "ledgerDir": "/operator/protected/pocket-ledger",
  "trustedKeys": {
    "trusted-signer": "-----BEGIN PUBLIC KEY-----\n...public Ed25519 key PEM...\n-----END PUBLIC KEY-----\n"
  },
  "allowedProfiles": ["observe", "triage", "health"]
}
```

Only a configuration file path (not key material) goes on the worker command line.

## Request example

The request envelope contains exactly two keys: schema and permit. The permit must have all original signed-gate fields and a valid signature. This skeleton alone will refuse.

```json
{
  "schema": "NBGPocketMesh.ExecutorRequest.v1",
  "permit": {}
}
```

Any extra client keys, including operatorApproved, trustedKeys, modulePath, task, mode or ledgerDir, are rejected.

## Run locally

```bash
npm test
npm run demo:executor
```

The demo keeps an ephemeral private signer in the parent process, spawns a separate Node child with a temporary public-key-only config, executes one original synthetic network-health score and confirms a second child refuses the already-used permit. Only its own temporary test directory is removed. **Never reset a persistent replay ledger.**

Manual invocation with your own operator-owned public-key config and *valid signed* request:

```bash
node scripts/pocket-executor-worker.mjs /absolute/path/to/config.json < signed-envelope.json
```

## Defense-in-depth and limitations

- **Improved:** no unsigned route or arbitrary module path is reachable from the worker's one-request stdin protocol; trust root and ledger cannot be changed by client JSON; separate processes share one atomic replay ledger; expired permits use the executor clock.
- **Not solved:** secure human identity, PhiID approval, network caller authentication, key management or rotation, confidential transport, tamperproof audit, persistent crash-consistent ledger, remote services, sandboxing of trusted Node modules, OS-level least privilege, or real model/network device execution.
- **Operator assumptions:** the launcher must pin a trusted executable and config, protect the config and nonce directory, run under a restricted OS account and keep the private signing key in a separate process. Someone who can edit code, control the executable, erase the ledger, or replace the supervisor config is outside this prototype's threat model.
- **Platform:** owner-only 0600 files and 0700 ledger directories are checked on POSIX. Windows security needs its own ACL audit before any operational deployment.
- **No live systems:** the only outputs are deterministic synthetic network-fixture analyses and their hashes. Memory estimates remain invented planning quantities, not measured savings.
- **Not a daemon:** exactly one stdin request, no HTTP listener, no sockets, no remote authorization or background operation.

## Source map

- src/pocket-executor-protocol.mjs: operator config parser and fixed permit-only dispatch
- scripts/pocket-executor-worker.mjs: one-shot stdin worker, generic refusal output
- scripts/pocket-executor-process-demo.mjs: external in-memory signer and child-process replay demo
- tests/pocket-executor-process.test.mjs: cross-process positive/negative controls

**Next gated milestone:** define PhiID-style authorization semantics (human actor, trusted signer, policy scope, revocation and approval evidence) without suggesting that this local prototype already has live identity integration.

**Maxim:** The conductor may request the performance, but only the signed ticket reaches the stage.
