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

## E1-A: First learned teeth (isolated synthetic experiment)

Run `npm run demo:e1a` to train and evaluate a **nine-scalar learned linear system**: three pooled base weights, plus two separate three-scalar specialist deltas. Unlike E0's route-only fixtures, these numerical weights are actually updated by training. E0 selects the declared task specialist; results are compared against pooled, fixed-specialist, and intentionally swapped controls using a disjoint synthetic holdout. The output includes dataset, weight and decision-receipt hashes.

**Not** LoRA, an LLM, a portable PocketBrain adapter, a PhiStream benchmark, or an NBG proof. No network calls or GPU claims. Read the [frozen E1-A protocol](docs/E1A_PROTOCOL.md). Full real-model E1 remains a future validation gate.

## E1-B (opt-in): Real small-model LoRA laboratory

**Status: offline-capable evaluation code; no real checkpoint is bundled or exercised by CI.** An independently obtained, locally stored **trusted LlamaForCausalLM Hugging Face safetensors** checkpoint is required. ONNX/GGUF checkpoints do not work with this gate.

Optional prerequisites: Python 3.10+, Node 20+, locally installed packages listed in `requirements-e1b.txt`. For CUDA, install a suitable PyTorch build before installing other dependencies. Nothing is installed by the repo's scripts and **no model download is attempted**.

```bash
python scripts/e1b_lab.py preflight --model-dir "/path/to/trusted-hf-model"
python scripts/e1b_lab.py train --model-dir "/path/to/trusted-hf-model" --work-dir "artifacts/local/e1b-new" --device cpu
python scripts/e1b_lab.py evaluate --model-dir "/path/to/trusted-hf-model" --work-dir "artifacts/local/e1b-new" --device cpu
```

Use `--device cuda` explicitly for a CUDA-enabled local installation; a failed CUDA request never silently becomes CPU. Training requires a **new, empty work directory** so existing model/adapter files are not overwritten. Outputs stay in ignored `artifacts/local` and include hashes, results and clearly labeled operator-unverified receipts.

Run `python -m unittest discover -s tests_py -v` for the pure-Python frozen-data contract tests (no model installed). E0 Node routing chooses which local adapter to activate based on declared capability. See [E1-B protocol](docs/E1B_PROTOCOL.md) for all caveats. This is not yet a confirmed LLM inference result, weight transfer improvement, or NBG mathematical validation.

## E1-C: Windows local pilot and receipt audit

PR #4 adds an explicit, **operator-controlled** PowerShell wrapper for E1-B
(`scripts/run-e1b-windows.ps1`) and a dependency-free receipt-consistency
checker (`scripts/e1c_audit.py`). The wrapper defaults to **preflight only**.
Training requires `-Action train`, a deliberately supplied local checkpoint,
and a new output directory. Evaluation and audit are separate commands.

After the local E1-B training and evaluation complete, run:

```powershell
.\scripts\run-e1b-windows.ps1 -Action audit -ModelDir "D:\Models\TrustedSmallLlama" -WorkDir "D:\PocketMeshTrials\e1b-001"
```

The audit detects receipt tampering, missing baselines, changed adapter/model
files, dataset drift, and invalid outcome arithmetic, but **does not** prove
the underlying model execution occurred or establish performance improvement.
See [E1-C Windows pilot protocol](docs/E1C_PROTOCOL.md).

## E2-A: Elastic nested teeth (CPU synthetic numerical pilot)

**Status: runnable isolated experiment, not an LLM or verified performance gain.** Six trained parent modules, three trained potential child residuals per parent, two learned cue routers, and two-parent macro tasks. No third-party packages or checkpoint download.

```sh
npm test
npm run demo:e2a
npm run demo:e2a -- --timed
```

Seven frozen comparisons: core, dense, flat specialist, learned hierarchy, no child, no macro, and fixed-rule routing. The first 384-example synthetic holdout gave 384/384 for both the learned hierarchy **and the fixed-rule hierarchy**; learned routing showed **no advantage** on this easy task. Training uses privileged teacher-factor targets, so these results do not validate superior intelligence, fair model efficiency, NBG mathematical closure, real neural weight streaming, or GPU inference. See [E2-A protocol](docs/E2A_PROTOCOL.md) for data, metrics, failure controls, and explicit nonclaims. Broader speculative design remains [E2 draft PR #5](https://github.com/MichaelWave369/NBGPocketMesh/pull/5).
