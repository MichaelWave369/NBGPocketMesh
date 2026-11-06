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

## E2-KB: blind-text Keyhole selection (synthetic)

A separate, locally trained multinomial Naive Bayes router now takes **only
question text**, not an E2-K fixture family label, and selects a possible
mathematical inspection category or abstains. Its learned scores are not
calibrated confidence and **it does not execute a math solver**.

It uses a frozen 60/20/40 train/validation/holdout partition and compares
the learned route with fixed lexical rules and always-abstain. The React
research console also includes a **Which gear should wake?** text-only
sandbox and recorded results.

Run `npm run demo:e2kb` to see the reproducible, SHA-256-stamped
synthetic comparison. See [the E2-KB protocol](docs/E2KB_PROTOCOL.md).
No prior experiment, model checkpoint or adjoining repository is changed.

## NBG-FLEET-OBS-01 E0 · Five-project Research Council (synthetic)

The [frozen Research Council Keyhole protocol](docs/FLEET_COUNCIL_E0.md) adds a deterministic, test-covered comparison where equal aggregate performance conceals different subgroup outcomes. Proposed ThinkTank, PocketBrain, Vessie, BrainC, and GAIA roles are kept separate from actual integration, execution authority, and scientific evidence. Run `node --test tests/council-e0.test.mjs` or `npm test`. **SIMULATED / authority NONE; no live model, network or physics experiment.**

## NBG-FLEET-OBS-01 E1 · Typed Research Council Evidence Exchange

The [E1 contract](docs/FLEET_COUNCIL_E1.md) adds an offline, deterministic, test-double evidence envelope for proposed ThinkTank, PocketBrain and Vessie roles, all bound to the exact synthetic E0 parent digest and operator-declared source revisions. It includes adversarial negative tests for forged authority, malformed participant identity, input drift, private payloads and misleading source tiers. Run `node --test tests/council-e1.test.mjs` or `npm test`. **No live cross-repo communication, authenticated provenance, inference, sharing or execution is implemented.**

## Research Council E1-D · Pinned three-consumer interoperability

The [source-generated, public-synthetic golden receipt](tests/fixtures/council-e1-source-golden.json) and [interop protocol](docs/FLEET_COUNCIL_E1D.md) test one **actual NBGPocketMesh E0/E1 output** against pinned, merged versions of ThinkTank, PocketBrain and Vessie's independent receipt consumers. The dedicated CI runs accepted, null and adversarial cases against the real consumer modules; no live network, models, private memory or authority grants are involved. Source revision strings are declared rather than authenticated. For exact producer replay, run `node scripts/council-e1-golden.mjs --verify`; the three-consumer test runs only in the separately provisioned pinned checkout workflow.


## Pocket Album Protocol v0 · portable capability compositions

**New isolated Node.js pilot:** [Pocket Album v0 protocol](docs/POCKET_ALBUM_V0.md). A pocket points to a SHA-256 content-addressed manifest describing an original **Observe → Diagnose → Report** score. Three locally allowlisted modules run as typed stages, with interface checks, a permission Keyhole, deterministic receipt hashing, and source-file drift detection. No raw observations enter receipts.

```sh
npm test
npm run demo:album
```

The demo compares **selective imports** against an **eager baseline** at each target, showing module-request counts, declared synthetic working-set estimates and output digest equivalence. Alternate `report-v2` code preserves the declared report output for frozen fixtures while source/album digests change. A broken report, tampered manifests, incompatible types, closed policy, and insufficient budget fail closed. One-shot timings are *not* performance evidence; no live network, LLM, dynamic untrusted code, measured memory savings or production integrations are claimed. See [tests](tests/pocket-album.test.mjs).

**Metaphor:** score = workflow, track = local capability, gear = typed transform, Keyhole = permission and compatibility, pocket = logical content-addressed album. A "melody" is the measured output or invariant, **not** a claim of subjective continuity.


## Pocket Album v1 · The Living Library (offline research)

[Read the v1 Living Library protocol](docs/POCKET_LIBRARY_V1.md).

The local Pocket Album v0 runner now has an **additive, content-addressed catalog**. It supports bounded four-way pocket addresses, multiple album families, append-only revisions, hashed shared track references, exact/tag/subtree search, verified score resolution, and optional JSON snapshots. A different allowlisted Report implementation can preserve the tested output while its source and album digests record the change. The approved v0 modules are still the **only** executable tracks.

```sh
npm test
npm run demo:library
npm run demo:library -- --save my-library.json
npm run demo:library -- --load my-library.json
```

This is not an infinite physical grid, real dynamic plugin loader, sandbox, authentication, live PhiOS/PhiStream/PocketBrain connection, or demonstrated memory/latency speedup. [Browse the implementation](src/pocket-library.mjs) and [negative-control tests](tests/pocket-library.test.mjs).

## E0 → Pocket Album verified local handoff (experimental)

[Read the E0 / Living Library bridge protocol](docs/POCKET_E0_BRIDGE.md). The unchanged E0 router now has a **separate, explicit, local-only bridge** to approved Living Library albums. It plans a synthetic capability route, rechecks its receipt, independently matches the exact approved local manifest, requires an explicit operator flag and an open Keyhole, then invokes the existing v1/v0 typed album runner. **An E0 ROUTE is never itself execution permission.**

Run `npm test` and `npm run demo:bridge`. Tests cover fake/altered manifest routing, revocation, remote/private refusal, separate memory policy checks, deterministic receipt replay, and no operator approval. This is local-fixture software, not authenticated production permissions, real network diagnostics, untrusted-code sandboxing, PhiOS integration, or measured performance.

## Pocket Signed Execution Gate v1 · offline one-use permits

[Protocol, refusal controls and trust limitations](docs/POCKET_SIGNED_GATE_V1.md). The local E0 → Living Library execution stack now has a **new, signed entrypoint** that accepts Ed25519 permits bound to an exact route, album revision, task, fixture digest, execution mode, and short expiration. A user-supplied manifest or plain `operatorApproved` flag cannot satisfy this entrypoint. A private operator-owned nonce directory tracks consumed permits using atomic create-only files, and a failed post-signature validation still burns its nonce.

```sh
npm test
npm run demo:signed
```

The demonstration generates a temporary signing key in memory, signs one approved local score, performs it once, and refuses an identical replay. **Not a sandbox or production identity system:** the public trust root and ledger are configured by the trusted host; the private key must remain with the independent signer. Existing unsigned research APIs remain available separately. No live PhiOS, real network device, cloud service, or model inference is involved.

## Pocket Executor Process Boundary v1 · Permit-only subprocess

[Read the isolated executor process protocol](docs/POCKET_EXECUTOR_PROCESS_V1.md). An **additive one-shot local worker** accepts exactly one signed permit via stdin, reads a protected **public-key-only** operator config and persistent replay ledger outside the request, checks a fixed profile allowlist, then dispatches to the existing signed E0 → Living Library → Keyhole stack. No old unsigned routing interface is exposed over the worker's request channel.

```sh
npm test
npm run demo:executor
```

The demo signs one synthetic network-health execution **in a separate parent process** and verifies that a second child refuses the replay. Cross-process tests cover spoofed trust roots, unsigned flags, changed signatures, shared-ledger races, expired permits, untrusted profiles, misconfigured files and oversized inputs. **Not** a sandbox, production service, real PhiID authentication, live hardware integration, or measured performance improvement. Trusted local modules still run with ordinary Node privileges.

## PhiID-compatible approval handshake v0 (synthetic, two signatures)

[Protocol and security limitations](docs/POCKET_PHIID_APPROVAL_V0.md). A **new optional one-shot local worker** requires both the existing signed Pocket Album execution permit **and** an independent Ed25519 approval statement. The approval is scoped to the entire permit hash and declares an OIDC-shaped `iss`/`sub` pair, purpose, scope, short validity, and a revocable approval ID. Protected operator policy lists approved **synthetic** principals and trusted public approver keys. It rejects PhiID R2 consent receipts, which deliberately grant no execution authority.

```sh
npm test
npm run demo:phiid
```

**Not a real PhiID login or authentication bridge.** Signers in this offline demonstration declare synthetic identities without validating OIDC tokens. The original permit-only worker and older research APIs remain available separately, so this is not an enforced production boundary. Real integration requires authenticated OIDC verification, human-reviewed approval UX, persistent revocation and isolated deployment.


### PhiID localhost issuer compatibility (development only)

[See the strict dev-issuer compatibility contract](docs/PHIID_LOOPBACK_ISSUER_COMPAT.md). The existing Ed25519 approval verifier now recognizes only PhiID's exact `http://127.0.0.1:8080/realms/phiid-dev` test issuer in addition to normal HTTPS issuers. The operator must still explicitly allow the exact `(iss, sub)` pair and pin two independent signing keys. All other HTTP issuers fail closed; this is **not** live OIDC verification or production authorization.
