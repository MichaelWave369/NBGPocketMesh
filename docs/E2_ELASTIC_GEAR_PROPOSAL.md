# E2 proposal: Elastic Nested Gear Architecture (ENGA)

**Status: DRAFT SPECIFICATION; NOT IMPLEMENTED OR FROZEN.**  
**Project:** NBG PocketMesh | **Date:** 2026-10-16  
**Evidence authority:** NONE for E2 architectural performance claims.

## Research question

Can a small shared computational core dynamically activate a bounded *hierarchy* of separately trained neural parameter modules ("teeth" and "sub-teeth"), improving **held-out task quality per measured active compute and end-to-end latency** compared with matched dense and flat sparse baselines?

This is a falsifiable engineering hypothesis, not a claim of new general intelligence, NBG mathematical closure, or proven efficiency.

## Parent experiments and evidence boundaries

- **E0:** deterministic, synthetic, fail-closed capability routing and replay receipts. No inference.
- **E1-A:** nine genuinely learned synthetic linear weights; a deliberate implementation-scale toy.
- **E1-B:** optional real-model LoRA training/evaluation harness requiring an independently supplied compatible, trusted local Llama safetensors checkpoint. No successful operator-run checkpoint is yet independently recorded in this repository.
- **E1-C:** offline Windows runner and consistency audit. A matching receipt does not authenticate the actual GPU run.
- **External squad toy report (user-supplied, not independently reproduced):** reports a 6-tooth ring, 3-child splitting, nine-cycle sync, loss 0.270 for a learned router vs 0.294 fixed golden-angle and 0.287 dense at a claimed matched active width. Dataset, source, execution log, seed, baseline parity, and artifact hashes are not provided. Classification: `REPORTED_UNVERIFIED`. Do **not** cite as an established PocketMesh result.

E2 must not modify E0 routing semantics, E1 protocols, adjacent NBG, PocketBrain, PhiStream, or LightBridge without separate scoped review.

## Core terminology and two different kinds of expansion

- **Hub / core:** permanently resident small computation that produces a shared latent representation and maintains limited task state. The **Router** proposes a subgraph, the **Keeper** pins versioned compatibility and context, and the **Gate** enforces resource, privacy, and admission constraints.
- **Tooth:** a compatible trained expert/residual module, *not* an arbitrary slice cut from a dense model. Its weights and metadata have immutable identifiers and hashes.
- **Micro expansion:** refine one selected tooth through one or more pretrained child modules, conditional on a budgeted expected benefit. In v1, depth is capped at two (tooth + child).
- **Macro expansion:** combine two or more independently capable compatible teeth for a multi-capability request. This is *not* dynamically inflating parameter values or inventing trained expertise.
- **Capacity growth:** creating or replacing trained teeth is a **separate offline training/approval operation**, never an untrained split during live inference. Copy-initialization is only a proposed training starting point; validation is mandatory before admission.
- **Bubble:** a bounded capability/node contract. NBG bubble geometry is a research metaphor and optional inductive bias, not a proven neural identity.

A nested representation (e.g., Matryoshka embeddings) is relevant precedent for coarse-to-fine computation but does not alone establish hierarchical weight-shard compatibility.

## Proposed dataflow

```text
Task + budget + privacy
         |
  HUB [Keeper / Router / Gate]   <- always-resident shared representation
         |
  shortlist compatible teeth
         |
  choose flat vs micro refinement vs multi-tooth macro composition
         |
  reserve/prefetch hot/warm/cold modules (only if within budget)
         |
  RUN the selected bounded neural subgraph
         |
  compose compatible outputs through trained, gated residuals
         |
  check quality proxy + budget + version consistency
         |
  optional bounded refinement or stop -> result + evidence receipt
```

The route decision need not occur at every token. Compare task-level, segment-level, and token-level rerouting, including their overhead. No online gradient or ground-truth loss is presumed available at inference.

### Resource tiers

- **HOT:** weight module already GPU-resident (could be idle; residency is distinct from active computation).
- **WARM:** validated module in host RAM, not yet GPU-resident.
- **COLD:** local disk by default; future explicitly authorized remote tier only for public tasks with per-task consent.
- All tiers have nonzero operational/storage costs. Quantization, page faults, network transfer, and loading must be measured rather than assumed negligible.

### Proposed versioned module manifest

`id`, `version`, `parent_id` (optional), `capabilities`, `base_model_sha256`, `tokenizer_sha256`, `latent_dim`, `input_contract`, `output_contract`, `adapter_kind`, `insertion_points`, `rank`, `dtype`, `parameter_digest`, `training_dataset_digest`, `provenance`, `status`, `transport`, `privacy_class`, `estimated_load_ms`, `estimated_compute_ms`, `working_set_mib`.

The manifest's labels are claims unless independently checked. E2 never interprets manifest lineage as authenticated independent evidence. Exact compatible model/tokenizer/adapter interfaces are necessary; equal shape by itself does not establish semantic compatibility. Pin the entire chosen subgraph's revisions for each request. Reject stale, revoked, inconsistent, unauthorized, or over-budget paths before executing them.

## Selection and composition proposal

For a compatible activation candidate `a`, assess the *predicted*, calibrated marginal task benefit and the full switching cost:

```text
utility(a) =
    predicted_quality_gain(a)
    - λ * predicted_incremental_latency_ms(a)
    - μ * predicted_incremental_memory_mib(a)
    - ν * expected_load_or_transfer_ms(a)
    - ρ * measured_or_predicted_composition_drift(a)
```

Only activate candidate `a` when utility is positive, the total cap is respected, and a fallback path is available. The predicted gain is not assumed to be an oracle; train it from disjoint data and test calibration and bad-route rates. Compare against cheap fixed top-k, random, and learned flat baselines.

For a residual-style compatible child module, one candidate composition is `h' = h + g(h) * f_child(h)`, where the gate `g(h)` is bounded and learned. Other compositions, especially chained adapters, must have their own held-out compatibility tests. An unconditional requirement `parent == sum(children)` is valid only for an **explicitly additive decomposition**; for generic nonlinear neural experts it is not a general invariant. Track logit/embedding drift and output behavior empirically.

Keep structural mutation outside the active inference path. A proposed new tooth is trained, evaluated, hashed, audited, and explicitly admitted before routing may use it.

## E2-A: dependency-free synthetic learned-hierarchy pilot

Start with a small CPU-runnable research implementation independent of pretrained LLM files and external network access. Use genuinely learned numerical parameters (not only simulated route flags). Suggested v1 scope:

- One shared learned core, six parent teeth, up to three pretrained child modules per parent, maximum activation depth two.
- Top-1 and top-2 parent routing; optional single-parent child refinement; a bounded trained macro composer for tasks needing two different capabilities.
- At least one *cross-domain compositional* held-out task whose solution genuinely requires information represented by two different specialists, plus single-domain controls. Avoid leaking oracle task IDs or answer labels to learned routing.
- Train all compared variants with documented fixed seeds, identical train/holdout partitions and comparable training budgets; report multiple seeds rather than cherry-picking.
- Always preserve an inexpensive core-only safe fallback, plus explicit refusals when constraints cannot be satisfied.
- Keep E0 API and receipts unchanged; E2 uses a new schema and namespaced modules.

The E2-A demo should produce reproducible config/data/weight/code hashes, activation traces, counts, all baselines, measured CPU wall-clock and memory where trustworthy, plus clear provenance `OBSERVED_LOCAL_UNVERIFIED` for executed runs. If a metric is not instrumented, record `null`, not a synthetic measurement disguised as observed.

### Mandatory comparisons / ablations

| Variant | Purpose |
|---|---|
| Core only | Minimal-capacity quality floor |
| Dense matched active compute | Test whether routing has any quality/efficiency value |
| Flat top-k experts | Test **hierarchy** specifically, not merely sparse MoE |
| Hierarchical learned routing | Proposed E2 candidate |
| Hierarchical fixed/random routing | Measure dependence on learned selection |
| Hierarchical without child expansion | Is micro refinement useful? |
| Hierarchical without multi-tooth compose | Is macro reasoning useful? |
| Hysteresis vs no hysteresis | Does expansion flap or stabilize? |
| Phi-ratio thresholds vs neutral tuned thresholds | Does geometric-inspired governance help? |

Match both total training parameter budget and *active inference* cost where possible; if one baseline cannot match both simultaneously, disclose the mismatch and report separate controlled experiments. Evaluate accuracy, latency (p50/p95 across cold and warm states), active FLOPs or defensible operation counts, module load bytes, memory high-water mark, routing regret, expert utilization, cache hits, failures/refusals, and **cost per correct task**.

### Phi / 3-6-9 governance as an explicit hypothesis

The ratios `0.618`, `0.382`, a nine-cycle sync cadence, Fibonacci ring sizes, and golden-angle placement are **candidate heuristics only**. They have no privileged evidence-based status in this architecture. Compare them to `0.5`, uniformly spaced ring layouts, independently optimized thresholds, and learned routing. A golden-angle visual arrangement is not the same as efficient memory placement or a learned neural connection. Capacity scaling should depend on validated improvement, not a numerological schedule.

In inference, **do not write learned weight deltas back every nine cycles**. If a periodic accounting checkpoint is useful, settle *metadata/receipts only*. Actual parameter updates occur in a separate frozen-snapshot training flow with explicit operator approval and regression tests.

## E2-B: opt-in real-model compatibility trial (after E2-A)

Reuse E1-B's local-only safety posture: a trusted compatible operator-provided HF Llama safetensors model, no auto-download, opt-in explicit CUDA, unique local artifact directories. Demonstrate two actual trained compatible LoRA teeth and one independently trained child refinement (if hardware allows). Compare core-only, flat adapter, routed adapter, and hierarchical refinement on a stronger held-out task. Record true cold/warm load times and peak observed VRAM, including notes about allocator vs device-wide limits.

Do not assume GGUF / ONNX checkpoint formats are interchangeable with E1-B. A 12 GB RTX 5070 may require genuinely small checkpoints, quantization-aware implementation or CPU-only development; the current E1-B code uses FP32 base weights.

## E2-C / E2-D: optional later experiments

- **E2-C local residency:** evaluate hot GPU / warm RAM / cold SSD prefetch, budget rejection and eviction. Interfacing with PhiStream requires its own benchmark and acceptance gate. Disclose prefetch hit/miss and transfer overhead.
- **E2-D distributed execution:** only after local behavior is reproduced. Test a second worker with version pinning, bounded activation-message protocol, explicit authorization and private-task local-only policy. LightBridge pairing, remote identities, and network claims remain unverified independent gates.

## Required negative controls and falsifiers

1. Wrong adapter/base/tokenizer hashes, incompatible latent/output schema, missing child, revoked revision, duplicate module, lineage claims, remote private task, no remote consent, or exceeded budget must fail closed.
2. Held-out routing results must not be inflated by training/holdout leakage, oracle task labels, or unlogged switching penalties.
3. Random/fixed routing and no-hierarchy controls must execute on the same data and truthful budgets.
4. Reject an untrained, miscalibrated or regressed newly grown child; never automatically promote it.
5. Swapping a tooth cannot silently mutate other teeth, hub parameters or prior receipts.
6. If flat or dense baselines match or beat E2 on task quality per actual cost, record **NO E2 GAIN** instead of promoting a performance claim.
7. Parent-child numerical closeness alone does not establish functional task coherence or NBG formal closure.

## Proposed acceptance gates

- **E2-A READY:** reviewable protocol, deterministic trained-module pilot, frozen split, measurable traces, same-batch baselines, negative controls, no I/O outside local sandbox.
- **E2-A EVIDENCE:** reproducible independently rerunnable outputs for multiple seeds; no false claims of speedup or general intelligence. Failure results published as such.
- **E2-B READY:** trusted operator-supplied model, explicit preflight, isolated opt-in training and audit; E1-C receipt guard retained.
- **E2 PROVEN EFFICIENCY:** *only* after repeated held-out real-model evaluations show a predeclared improvement in quality/cost vs matched baselines with confidence intervals and realistic cold/warm timings. A green CI check alone does not satisfy this gate.

## Practical implementation sequence

1. Land this draft spec for review; no runtime changes.
2. Implement isolated E2-A deterministic core + trained parent/child modules + replayable traces and negative controls.
3. Add matched dense/flat/hierarchical comparisons and cross-domain compositional tasks.
4. Tune, ablate and report thresholds including φ vs neutral values without privileging either.
5. Only then extend E1-B with an operator-run small-model hierarchical adapter pilot.

## Supporting research context (references, not code dependencies)

- Kusupati et al., *Matryoshka Representation Learning* (2022), https://arxiv.org/abs/2205.13147
- Bussmann et al., *Learning Multi-Level Features with Matryoshka Sparse Autoencoders* (ICML 2025), https://proceedings.mlr.press/v267/bussmann25a.html
- Ma et al., *Stabilizing MoE Reinforcement Learning by Aligning Training and Inference Routers* (ICML 2026), https://proceedings.mlr.press/v306/ma26aw.html

**Licensing:** all eventual PocketMesh implementation code is written independently. Model weights, if separately supplied, retain their original licenses. No third-party model or code is included in this spec.
