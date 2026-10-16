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

## Live React research console (GitHub Pages)

The `site/` folder contains an original React/Vite research dashboard for E2-A: responsive radial gear topology, interactive synthetic threshold/budget routing controls, and a transparent comparison chart of all seven frozen numerical baselines. **The browser's visual route sandbox is illustrative fixed-threshold logic, not actual pretrained or learned E2-A model inference.** The dashboard labels the privileged teacher supervision and the fixed-rule router's tie with the learned hierarchy.

Local development:

```sh
npm install --prefix site
npm run dev --prefix site
npm run test --prefix site
npm run build --prefix site
```

After the site PR is merged and GitHub Pages is configured to use **GitHub Actions**, the intended public location is [PocketMesh Pages](https://michaelwave369.github.io/NBGPocketMesh/). If that URL does not yet resolve, check **Settings → Pages → Build and deployment → GitHub Actions** and the `PocketMesh React Pages` workflow. The link is a deployment target, not proof the page is currently online.

## E2-P/C: Quantized nested teeth and contradiction-proxy experiment

**Status: isolated, CPU synthetic numerical experiment. No production or GPU inference claim.** Extends trained E2-A tooth bundles into real numeric INT4 (signed packed), INT8 and FP32 representations with a conservative quantization-error-bound precision escalation policy. It also tests an opposing-sign `conflict` proxy suggested by conceptual Super Φ.Vessel work. That proxy is **not** verified truth detection or real coherence.

```sh
npm test
npm run demo:e2pc
```

On the frozen synthetic holdout, INT4 changed 3 of 384 FP32 decisions; bounded selective escalation restored FP32 agreement with 6 escalations. Conflict-only escalation still missed one error and unnecessarily escalated 68 cases. The reported selected-payload bytes exclude bound metadata, the shared router, object memory and real transfer costs. All precision bundles stay resident, so **no physical RAM/VRAM saving or latency advantage is claimed**. Read [E2-P/C protocol](docs/E2PC_PROTOCOL.md) for the exact evaluation, caveats, negative controls and frozen results.

The companion React console presents these values as **recorded experiment results** separate from its fixed-threshold browser visualization. Original E0/E1/E2-A code is unchanged.

## E2-K: Numerical Keyhole / Pattern vs Structure

**Status: separate, deterministic algebraic fixture lab, not neural model inference.**
The new `site/src/pattern-keyhole.js` is shared by the Node E2-K experiment
and the React **Pattern vs Structure** page section.

- Unit and common-scale invariance of a dimensionless pyramid-style ratio
- Rotation-invariant length versus frame-dependent coordinates
- Deliberately misleading decimal-digit coincidences (including a Great Pyramid latitude / SI light-speed *digit resemblance*)
- A separate conservative scalar quantization-boundary escalation control
- K0/K1/K2 synthetic budgets and a deliberately naive surface-display baseline

Run `npm run demo:e2k` and `npm test`. Outputs are marked
`SIMULATED` / authority `NONE`; the CLI prints deterministic SHA-256
case/precision fixture hashes and a receipt. The site runs these same algebraic
fixtures in-browser. No user data, real models, trained E2-P/C modules,
GPU timing, RAM or history claims are involved.
See [frozen E2-K protocol](docs/E2K_PROTOCOL.md).

This is *not* evidence that ancient pyramid builders knew modern physics,
that number coincidences are causal, or that an NBG router outperforms simple
unit normalization. Future untyped and noisy tests must be independently gated.
