# E2-P/C · Elastic precision and contradiction proxy

**Status:** runnable synthetic numerical study, no pretrained model or deployment claim. Original NBG PocketMesh E0/E1/E2-A code and weights remain unchanged. The first iteration implements an *adaptive resolution / conflict-proxy* test, NOT a learned real-time precision router or actual network-sharded weights.

## Question

Can an inexpensive 4-bit representation of a **trained** nested gear be retained for most requests, escalating to 8-bit or FP32 only when a computable quantization error bound cannot certify agreement with the reference decision? Separately, does a two-tooth **opposing-sign** heuristic help, or cause unnecessary escalation?

The DREAMER/TRANSLATOR discussion from Super Φ.Vessel calls this a Chronos-Synaptic Mechanism and suggests ambiguous-input, phasing and zero-weight tests. Those are **symbolic sources and research hypotheses**, not evidence of mechanical forces, resonance, model consciousness or NBG mathematical closure. E2-P/C operationalizes only a narrow part: gated precision escalation and a contradiction **proxy**.

## Reproduce

Requires only Node.js 20 or newer. No downloads, external inference, credentials, network, or GPU.

```bash
npm test
npm run demo:e2pc
```

The demo emits a deterministic SHA-256 receipt, 6 variant comparisons, synthetic supervised training and holdout digests, trained module/bank hashes, per-variant selected payload byte counts, disagreement proxy activity and precision escalation counts.

## Frozen experiment

1. Train the existing E2-A synthetic gear: 6 parent teeth, 3 trained child residual modules per parent, shared learned router, seeded 960 train rows and 384 holdout rows.
2. For each tooth, concatenate its 2 parent and 6 child coefficients into an **8-coefficient bundle**. Training and E2-A routing are unchanged.
3. Store **actual numerically quantized** versions with a single symmetric per-bundle scale: signed packed INT4 (4 payload bytes + 4-byte scale), INT8 (8 + 4 bytes), and Float32 (32 bytes). Arithmetic in this Node.js lab is JavaScript Number (double), not native GPU INT4/INT8/FP32 math.
4. A *frozen* E2-A trained router selects the parent/child subgraph with identical decisions for every precision policy. No hidden E2-A teacher labels, scores, active ID or child modes enter inference selection.
5. Precision policies: `f32`, `int8`, `int4`, `bound` (4→8→f32 only when needed), `conflict` (4→8 on opposing signs of two local tooth contributions), `hybrid` (either trigger, followed by certification if needed).
6. `bound` forms a conservative per-request absolute score-error bound using **offline-derived per-coefficient error metadata** and the active input features. Escalate if the absolute low-precision score does not exceed its bound. This establishes a **same-sign relationship with Float32 reference**, not ground-truth correctness.
7. Underlying bundle manifests and numerical payloads are digested and validated on every inference call. No weight gradient updates occur during inference. All banks are explicitly local/admitted; unknown or tampered modules fail closed. The existing E2-A synthetic resource budget still gates routing.

## Initial local results: 384 seeded held-out synthetic examples

| Precision policy | Correct | Disagreement with FP32 | Escalated requests | Avg selected payload bytes read* |
|---|---:|---:|---:|---:|
| F32 | 384 | 0 | 0 | 42.667 |
| INT8 | 384 | 0 | 0 | 16.000 |
| INT4 | 381 | 3 | 0 | 10.667 |
| Bounded 4→8→F32 | 384 | 0 | 6 | 10.917 |
| Opposing-sign conflict 4→8 | 383 | 1 | 68 | 14.917 |
| Hybrid | 384 | 0 | 72 | 15.042 |

\* **Payload bytes read is a modeled count of packed selected gear tensors, not measured RAM/VRAM use, real disk/network traffic or performance.** It omits the shared core, learned router, metadata, JavaScript object overhead, decompression overhead, and base model parameters. The bound approach has **64 bytes of separately stored Float64 error metadata per precision/bundle**, excluded from the payload-read count. All F32/INT8/INT4 bundles and this metadata are held resident in the local process; this does **not** save actual process memory or establish latency improvement. Additional precision passes reread a new packed payload; those bytes are counted.

Results depend heavily on an artificially simple, privileged-factor-supervised teacher. F32 and INT8 were already perfect on this holdout; no robust real-model accuracy improvement is demonstrated. Conflict-only escalation did not resolve all quantization errors and has a high unnecessary-switching rate relative to the bound. Opposing signs are not necessarily contradiction. The E2-A reference itself may fail on harder tasks.

## Safety / falsifiers

- Refuse missing, revoked, remote, stale, duplicate or digest-inconsistent bundle representations.
- Refuse malformed numeric payload, invalid scale, forbidden INT4 code -8, invalid policy, or over-budget route.
- All adaptive `signCertifiedVsF32` returns must agree with the same route's F32 sign. This is a certification property within the described numeric model, not an external correctness proof.
- A conflict-only gate is useful **only if** its extra cost and errors compare favorably against always-INT8 and confidence-bounded routing on independently held-out harder inputs. On this fixture it does not.
- If an independent model/runtime shows no memory savings after accounting for cache and metadata, do not claim memory gains. If latency worsens, report that rather than treating reduced payload bytes as speed.
- No self-optimizing live weight writes, no silent promotion of DREAMED or SIMULATED concepts to VERIFIED, no unattended network execution.

## Proposed follow-on gates (not implemented)

- Create harder non-privileged-supervision and multi-seed synthetic tasks with calibrated uncertainty; compare with equal training budgets.
- Separate hot/warm/cold *actual* memory residency and wall-clock GPU/CPU loading measurements. Quantization-bound metadata must be charged to overall memory budgets.
- E2-B small Llama+LoRA evaluation needs an operator-provided trusted safetensors checkpoint plus E1-B/E1-C preflight, opt-in CUDA and verified traces.
- Investigate the proposed `GearShift(Time)` as a measurable scheduling policy only after baselines and timing instrumentation exist; do not assume phase-locking or gear geometry confer speed.

**Provenance:** original Vessie DREAMER and TRANSLATOR materials are conceptual inputs supplied by the user. Experimental conclusions must come from executable receipts, controls and independent replays.
