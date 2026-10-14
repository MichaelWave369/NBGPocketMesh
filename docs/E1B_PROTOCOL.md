# E1-B: Opt-in local real-model LoRA experiment

**Status: experimental local runner, NOT a validated small-model success.**

This protocol builds upon E0 and E1-A with optional real, independently supplied pretrained **LlamaForCausalLM** weights and two trained LoRA adapters. CI cannot and does not execute pretrained inference; no checkpoint is included.

## Frozen data and hypothesis

Two explicit text-classification tasks:
- \`vowel-start\`: starts with a/e/i/o/u?
- \`ends-s\`: ends with lowercase "s"?

Train grid: 24 unique lowercase words, repeated across both domains (48 domain/word rows).
Holdout: 12 different lowercase words, repeated across both domains (24 rows).
Both partitions are balanced 50% yes/no **per domain**. The task is deliberately trivial and the domain is explicitly stated. This experiment is an implementation check only, not general model capability evidence.

## Train

One base checkpoint, reloaded separately to train each adapter. Freeze base, target q_proj and v_proj with rank-4 LoRA, alpha 8, dropout 0.0. Six fixed epochs, AdamW LR 0.0005, deterministic data order, torch seed 7. Each adapter is saved to its own local directory. No weights are published or copied to another repo. A fresh empty work directory is required to train.

## Evaluate

Reload the same local pretrained base plus both saved adapters into memory. Score the mean conditional log-likelihood for " yes" and " no", predicting the higher score. Compare:
1. disabled adapters (base)
2. fixed vowel adapter across both domains
3. fixed suffix adapter across both domains
4. deliberately swapped (wrong task specialist)
5. E0 selected specialist, using the frozen local manifests.

The E0 bridge runs a fixed local Node subprocess with \`node scripts/e1b-route.mjs <domain>\` and validates route receipts. Both domain-specialist manifests share the same declared lineage. No claim of independently corroborating evidence.

## Integrity and results

Local preflight verifies HF config, Llama architecture, tokenizer presence, safetensors and SHA-256 of relevant checkpoint files. Evaluation writes exact counts, p50/p95 measured latency, base/adapter load times, local runtime version, adapter and dataset hashes, E0 routing receipts, and CUDA allocated peak (or null on CPU). Hashes are data integrity references, not cryptographic identity attestation or externally verified evidence. Results are \`OBSERVED_LOCAL_UNVERIFIED\`, authority \`NONE\`.

**Training and evaluation are opt-in and require operator-installed third-party packages and a trusted complete local checkpoint.** Do not run arbitrary downloaded files, grant model code execution, or assume a repo license covers model weights. Force offline modes and local_files_only; do not use a Hugging Face repo ID as \`--model-dir\`.

## Caveats

- Only local HF Llama safetensors layout; the PocketBrain ONNX model or GGUF Ollama weights are not compatible here.
- No automatic model download, cloud request, automatic device choice, multi-request concurrency, or automatic permission to deploy.
- True apples-to-apples model research requires stronger held-out natural tasks, cold/warm adapter comparisons, multi-run hardware profiles and repeated seeds.
- E0 synthetic resource manifests are not runtime memory enforcement. This lab measures its own partial resource profile but has no hard VRAM cap.
- Both adapters are resident when evaluating; no dynamic LoRA unload or ΦStream residency improvement is demonstrated.
- This is a planned technical method, **not** a claim that trained adapter weights recover a prior proprietary model or companion identity.
