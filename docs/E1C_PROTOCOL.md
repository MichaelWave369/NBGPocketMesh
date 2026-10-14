# E1-C · Offline Windows pilot and receipt-consistency audit

**Status:** reviewable local operator workflow, no confirmed GPU execution.

E1-B training and evaluation still require a trusted, operator-supplied
**Hugging Face-format LlamaForCausalLM safetensors checkpoint**,
Node.js 20+ and opt-in PyTorch, Transformers and PEFT installation.
Ollama GGUF and PocketBrain ONNX are **not** compatible as-is.
E1-C neither supplies weights nor downloads/converts checkpoints.
For a 12 GB RTX 5070, begin with a genuinely small compatible checkpoint;
E1-B currently forces FP32 weights, so a large model may exceed VRAM.

## On Windows, from the repository root

1. Confirm installed Python 3.10+, Node 20+, and a working CUDA-enabled
   PyTorch build appropriate for your installed NVIDIA driver. Installing
   dependencies is a separate operator action.
2. Select and inspect a trusted local HF checkpoint directory, then run
   the preflight before training:

   ```powershell
   .\scripts\run-e1b-windows.ps1 -ModelDir "D:\Models\TrustedSmallLlama"
   ```

3. Choose a **new empty** local output directory (not an original model
   directory). Start training only if explicitly intended:

   ```powershell
   .\scripts\run-e1b-windows.ps1 -Action train -Device cuda -ModelDir "D:\Models\TrustedSmallLlama" -WorkDir "D:\PocketMeshTrials\e1b-001"
   ```

4. Evaluate with the same checkpoint and output directory, then audit both
   receipts and the current local file hashes:

   ```powershell
   .\scripts\run-e1b-windows.ps1 -Action evaluate -Device cuda -ModelDir "D:\Models\TrustedSmallLlama" -WorkDir "D:\PocketMeshTrials\e1b-001"
   .\scripts\run-e1b-windows.ps1 -Action audit -ModelDir "D:\Models\TrustedSmallLlama" -WorkDir "D:\PocketMeshTrials\e1b-001"
   ```

   Replace all example paths with actual local paths. Neither checkpoint
   nor output path is auto-detected or auto-downloaded.

## Audit contract

`scripts/e1c_audit.py` is pure Python stdlib and **never runs model
inference**. It loads original E1-B JSON receipts, checks duplicate JSON
keys, canonical SHA-256 digests, schema/provenance labels, current checkpoint
and both adapter folder hashes, fixed dataset fingerprints, all five control
counts/accuracies/latency summaries, and the E0 route receipt-hash shape.
On success it emits a new JSON report with
`CONSISTENT_LOCAL_RECORDS_ONLY`, origin `LOCAL_RECEIPT_COMPARISON`,
and authority `NONE`. It prints that report to stdout and does not edit
the training outputs. On mismatch it exits nonzero.

### Critical epistemic limitations

- Matching receipts **do not independently prove** that a pretrained
  model trained or ran. A single actor can fabricate mutually consistent
  JSON and adapter bytes. The audit checks coherence, not authenticity.
- This gate does not establish routing gains; compare observed baselines
  on the same holdout and investigate failures before claiming usefulness.
- Reported evaluation timing is wall clock with the current order and
  simultaneously resident adapters; it is **not** cold-load, optimized
  inference, or production latency.
- CUDA allocator peak does not cover all VRAM. No hard memory limit exists.
- No third-party license or model safety review is supplied by the repo.
- CI tests a synthetic fixture and PowerShell parsing only; **it cannot
  assert that your RTX training/evaluation succeeded**.

## Negative controls

The tests must refuse missing/tampered receipts, changed adapter bytes,
changed checkpoint bytes, dataset hash drift, incorrect accuracy arithmetic,
and omitted baselines. All fixture files are synthetic and are never loaded
as a neural model.
