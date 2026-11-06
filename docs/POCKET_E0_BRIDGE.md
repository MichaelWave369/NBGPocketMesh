# E0 to Pocket Album Bridge: Verified Local Handoff

**Status:** offline research pilot, origin SIMULATED_LOCAL, authority NONE. Built on the existing E0 router, Pocket Album v0 and Living Library v1. **A route recommendation is not execution permission.**

## Protocol

1. Generate three synthetic, private, local-only routing profiles for the existing approved album families: `observe` → `network-observe`, `triage` → `network-triage`, and `health` → `network-health`.
2. Run the unchanged E0 policy and recheck its deterministic routing receipt. A plan is a declared choice, not an execution grant.
3. Independently match E0's selected node to the exact reviewed local manifest. Neither another cheaper node, an altered manifest, nor an arbitrary album ID can authorize execution.
4. Default to **HOLD**. Require `operatorApproved:true` and `boundaryOpen:true` before attempting a local score.
5. Execute only through Living Library v1 and the existing v0 Keyhole, which rechecks local source hashes, typed stages, and the declared memory limit. A v0 refusal remains a refusal.
6. Emit a deterministic, hash-linked bridge receipt including E0 routing metadata and any downstream v1/v0 receipts. The receipt contains neither raw fixture observations nor generated report text.

## Reproduce

Node 20+; CI uses Node 22.

```bash
npm test
npm run demo:bridge
```

Example:

```js
import {createDemoLibrary} from './src/pocket-library.mjs';
import {routeAndPlayAlbum} from './src/pocket-e0-bridge.mjs';

const library=createDemoLibrary();
const plan=await routeAndPlayAlbum({library,profile:'health'});
// plan.receipt.decision === 'HOLD'; plan.output === null

const result=await routeAndPlayAlbum({
  library,profile:'health',operatorApproved:true,boundaryOpen:true
});
// reviewed synthetic fixtures: result.receipt.decision === 'PERFORM'
```

The E0 `text` input/output modality is a **routing-contract label**, not a raw device payload. The separate v0 runner receives only the predeclared local synthetic network fixture.

## Negative controls

- No operator flag or closed secondary Keyhole: no module execution
- Revoked/stale E0 manifest or impossible E0 planning budget: refusal
- A forged cheaper local E0 route or altered approved manifest: independent binding refusal
- Remote-only option for a private task, or public/remote-consenting task: refusal
- E0 plans a small observe request but v0 rejects eager imports exceeding the same declared planning budget
- Tampered bridge or nested receipt, changed fixture, changed policy, missing catalog family: replay mismatch or fail-closed validation

## Limitations

This pilot is **not** production authorization. `operatorApproved:true` is an in-process simulation flag, not an authenticated human identity or signed consent. E0 estimates are synthetic; it does not measure latency, memory or GPU savings. The executable modules remain pre-reviewed local JavaScript running with ordinary Node.js privileges, **not sandboxed**. The bridge never imports arbitrary paths from a catalog, calls a remote service, probes real network devices, runs an LLM, or integrates with live PhiOS, PhiStream or PocketBrain. SHA-256 and exact replay protect deterministic consistency only; neither authenticates source authorship nor proves correctness of the underlying result.

Future gates: independently authenticated operator permissions; sandboxed arbitrary-module execution (if ever allowed); pinned integration tests with real consumer projects; independent process-level memory/latency measurements.

**Working maxim:** The router can choose the album. Only a separately approved Keyhole can start the performance.
