# NBG PocketMesh · E0

**An original, deterministic, simulation-only study of sparse capability routing.**

Bubbles describe bounded capability nodes; gears are typed interfaces or transformations; *teeth* are a **proposed** way to group learned adapter parameters in later experiments. E0 does **not** train, load, or execute neural models. The naming does not mean that NBG mathematics has been demonstrated to apply to neural-network weights.

## Run it

Requires Node.js 20 or newer. No dependencies, account, network access, model download, or credentials are required.

```bash
npm test
npm run demo
```

The demo produces a deterministic SHA-256-linked JSON decision receipt for a synthetic private text task. The tests cover authorization, interface mismatch, stale manifests, insufficient resources, duplicate lineage, reproducibility and tampering.

## E0 boundaries

- **SIMULATED / authority NONE**: All provided nodes, latency figures and memory costs are synthetic fixtures, not benchmark measurements or attestations.
- **Router only**: It never imports weights, performs inference, trains adapters, calls a provider, opens a network connection, or invokes other repos.
- **Fail closed**: Invalid contracts throw; unavailable, unsuitable, unauthorized, or over-budget paths are refused.
- **Privacy**: Private tasks always disallow remote nodes. Public tasks require explicit per-task consent before remote nodes are eligible.
- **Determinism**: Stable manifest ordering, fixed policy epoch, fixed tie breaks and canonicalized SHA-256 receipts. No wall-clock data or random IDs.
- **Independent lineage**: Distinct *declared* lineage identifiers in synthetic manifests are only a routing constraint. They do not establish genuinely independent observations, security, or truth.
- **Memory and time**: Estimated added memory and serial latency are planning inputs. E0 does not measure or reserve hardware resources.

See [the frozen E0 protocol](docs/E0_PROTOCOL.md) and upstream [NBG research issue #124](https://github.com/MichaelWave369/NestedBubbleGear/issues/124).

## Adjacent projects (none modified)

- [NestedBubbleGear](https://github.com/MichaelWave369/NestedBubbleGear) — interfaces, Keyholes, provenance and mathematical research.
- [PocketBrain](https://github.com/MichaelWave369/PocketBrain) — local-first inference and Tiny SDK candidate.
- [PhiStream](https://github.com/MichaelWave369/PhiStream) — experimental layer streaming and weight residency measurement.
- [LightBridge](https://github.com/MichaelWave369/LightBridge) — experimental optical transfer, not yet a verified identity/pairing channel.

## What counts as progress?

E0: deterministic receipt and negative-control unit tests. **E1 requires separate held-out real-inference evaluations**: compare fixed-model, fixed-adapter and routed-adapter baselines with model hashes, accuracy, latency, load overhead, VRAM, failures and cost per correct task. No performance or production claim before those tests.

Original NBG PocketMesh code: MIT. Third-party model weights, if ever used, retain their own licenses. No model weights are included.
