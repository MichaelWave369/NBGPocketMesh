"""Explicit offline experiment with locally supplied Hugging Face safetensors and LoRA.

No downloads, cloud calls, pre-trained weight bundling, or automatic installs.
The operator supplies a TRUSTED local Llama-style checkpoint in HF layout.
"""
from __future__ import annotations
import argparse
import gc
import hashlib
import json
import math
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["WANDB_DISABLED"] = "true"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from e1b_dataset import DOMAINS, digest, prompt, rows

ROOT = Path(__file__).resolve().parent.parent
MODEL_EXTENSIONS = {".safetensors", ".json", ".model", ".txt", ".py"}
SCHEMA = "NBGPocketMesh.E1B.v1"

def require_directory(p: str) -> Path:
    raw_path = Path(p).expanduser()
    if raw_path.is_symlink():
        raise ValueError("Refusing symlinked model directory")
    path = raw_path.resolve(strict=True)
    if not path.is_dir() or path.is_symlink():
        raise ValueError("Directory must exist and not be a symlink")
    return path

def inspect_model(path: Path) -> dict:
    config_path = path / "config.json"
    if not config_path.is_file() or config_path.is_symlink():
        raise ValueError("Missing trusted local config.json")
    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    if cfg.get("model_type") != "llama" or "LlamaForCausalLM" not in cfg.get("architectures", []):
        raise ValueError("E1-B accepts only LlamaForCausalLM local checkpoints")
    if not list(path.glob("*.safetensors")) or not (
        (path / "tokenizer.json").is_file() or (path / "tokenizer.model").is_file()
    ):
        raise ValueError("Local model requires safetensors and tokenizer files")
    return {"architecture": cfg["architectures"], "modelType": cfg["model_type"]}

def folder_digest(path: Path) -> str:
    h = hashlib.sha256()
    files = sorted(p for p in path.rglob("*") if p.is_file())
    if not files:
        raise ValueError("Empty checkpoint folder")
    for p in files:
        if p.is_symlink():
            raise ValueError("Symlink in checkpoint folder forbidden")
        if p.suffix not in MODEL_EXTENSIONS:
            continue
        rel = p.relative_to(path).as_posix()
        h.update(rel.encode("utf-8") + b"\x00")
        with p.open("rb") as f:
            while True:
                block = f.read(1024 * 1024)
                if not block:
                    break
                h.update(block)
    return h.hexdigest()

def require_adapter(path: Path) -> None:
    for name in ("adapter_config.json", "adapter_model.safetensors"):
        if not (path / name).is_file() or (path / name).is_symlink():
            raise ValueError("Expected local PEFT adapter file: " + str(path / name))

def load_dependencies():
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import LoraConfig, TaskType, get_peft_model, PeftModel
    except ImportError as e:
        raise RuntimeError("Install opt-in dependencies from requirements-e1b.txt locally") from e
    return torch, AutoModelForCausalLM, AutoTokenizer, LoraConfig, TaskType, get_peft_model, PeftModel

def device_for(torch, requested: str):
    if requested == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA explicitly requested but unavailable; no silent CPU fallback")
    return torch.device(requested)

def load_base(model_dir: Path, device, torch, Model, Tokenizer):
    tokenizer = Tokenizer.from_pretrained(
        str(model_dir), local_files_only=True, trust_remote_code=False
    )
    model = Model.from_pretrained(
        str(model_dir), local_files_only=True,
        trust_remote_code=False, use_safetensors=True
    )
    model.float().to(device)
    if tokenizer.eos_token_id is None:
        raise ValueError("Tokenizer must define EOS token")
    return model, tokenizer

def train_one(model_dir, domain, output_dir, device, deps):
    torch, Model, Tokenizer, LoraConfig, TaskType, get_peft_model, _ = deps
    torch.manual_seed(7)
    model, tokenizer = load_base(model_dir, device, torch, Model, Tokenizer)
    cfg = LoraConfig(
        task_type=TaskType.CAUSAL_LM, r=4, lora_alpha=8,
        lora_dropout=0.0, bias="none", target_modules=["q_proj", "v_proj"]
    )
    model = get_peft_model(model, cfg)
    model.train()
    parameters = [p for p in model.parameters() if p.requires_grad]
    if not parameters:
        raise RuntimeError("LoRA adapter has no trainable parameters")
    optimizer = torch.optim.AdamW(parameters, lr=5e-4)
    samples = [x for x in rows("train") if x["domain"] == domain]
    t0 = time.perf_counter()
    for _epoch in range(6):
        for sample in samples:
            prefix = tokenizer.encode(prompt(sample), add_special_tokens=True)
            response = tokenizer.encode(" " + sample["answer"], add_special_tokens=False)
            if not prefix or not response:
                raise ValueError("Tokenizer returned empty tokens")
            tokens = torch.tensor([prefix + response], dtype=torch.long, device=device)
            labels = torch.tensor([[-100] * len(prefix) + response], dtype=torch.long, device=device)
            optimizer.zero_grad(set_to_none=True)
            loss = model(input_ids=tokens, labels=labels).loss
            if not bool(torch.isfinite(loss)):
                raise RuntimeError("Nonfinite loss")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(parameters, 1.0)
            optimizer.step()
    model.save_pretrained(str(output_dir), safe_serialization=True)
    if not (output_dir / "adapter_model.safetensors").exists():
        raise RuntimeError("Expected trained adapter_model.safetensors")
    info = {"domain": domain, "steps": 6 * len(samples),
            "trainableScalars": sum(p.numel() for p in parameters),
            "trainingSeconds": round(time.perf_counter() - t0, 5)}
    del model, optimizer, tokenizer
    gc.collect()
    if device.type == "cuda":
        torch.cuda.empty_cache()
    return info

def remote_free_route(domain: str) -> dict:
    # E0 runs as a controlled local subprocess with one frozen capability name.
    if domain not in DOMAINS:
        raise ValueError("Unsupported domain")
    result = subprocess.run(
        ["node", str(ROOT / "scripts" / "e1b-route.mjs"), domain],
        cwd=str(ROOT), check=True, capture_output=True, text=True, timeout=15
    )
    receipt = json.loads(result.stdout)
    expected = "tooth-vowel" if domain == "vowel-start" else "tooth-suffix"
    if receipt.get("decision") != "ROUTE" or receipt.get("selected", {}).get("nodes") != [expected]:
        raise RuntimeError("E0 refused or changed its expected domain route")
    return receipt

def candidate_score(model, tokenizer, torch, device, sample, choice: str) -> float:
    prefix = tokenizer.encode(prompt(sample), add_special_tokens=True)
    response = tokenizer.encode(" " + choice, add_special_tokens=False)
    if not prefix or not response:
        raise ValueError("Empty tokenized candidate")
    tokens = torch.tensor([prefix + response], dtype=torch.long, device=device)
    with torch.inference_mode():
        logits = model(input_ids=tokens).logits[0]
        predictions = logits[len(prefix) - 1:len(prefix) - 1 + len(response)]
        targets = torch.tensor(response, dtype=torch.long, device=device)
        log_prob = torch.log_softmax(predictions, dim=-1).gather(
            1, targets[:, None]
        ).sum()
    return float(log_prob.item()) / len(response)

def evaluate(model_dir, work_dir, device, deps):
    torch, Model, Tokenizer, _, _, _, PeftModel = deps
    tooth_vowel = work_dir / "adapters" / "vowel-start"
    tooth_suffix = work_dir / "adapters" / "ends-s"
    require_adapter(tooth_vowel)
    require_adapter(tooth_suffix)
    model_hash = folder_digest(model_dir)
    adapters_hash = {k: folder_digest(p) for k, p in
                     (("vowel-start", tooth_vowel), ("ends-s", tooth_suffix))}
    t0 = time.perf_counter()
    base, tokenizer = load_base(model_dir, device, torch, Model, Tokenizer)
    load_base_s = time.perf_counter() - t0
    t1 = time.perf_counter()
    model = PeftModel.from_pretrained(
        base, str(tooth_vowel), adapter_name="tooth-vowel",
        is_trainable=False, local_files_only=True
    )
    model.load_adapter(
        str(tooth_suffix), adapter_name="tooth-suffix",
        is_trainable=False, local_files_only=True
    )
    adapter_load_s = time.perf_counter() - t1
    model.eval()
    if device.type == "cuda":
        torch.cuda.reset_peak_memory_stats()
    route_map = {domain: remote_free_route(domain) for domain in DOMAINS}
    policies = ("base", "fixed-vowel", "fixed-suffix", "wrong-tooth", "routed")
    results = {policy: {"correct": 0, "total": 0, "times_ms": []} for policy in policies}
    for sample in rows("holdout"):
        true_tooth = "tooth-vowel" if sample["domain"] == "vowel-start" else "tooth-suffix"
        wrong_tooth = "tooth-suffix" if true_tooth == "tooth-vowel" else "tooth-vowel"
        selected = route_map[sample["domain"]]["selected"]["nodes"][0]
        if selected != true_tooth:
            raise RuntimeError("Wrong capability decision")
        for policy in policies:
            t = time.perf_counter()
            if policy == "base":
                with model.disable_adapter():
                    scores = {answer: candidate_score(model, tokenizer, torch, device, sample, answer)
                              for answer in ("yes", "no")}
            else:
                active = {"fixed-vowel": "tooth-vowel", "fixed-suffix": "tooth-suffix",
                          "wrong-tooth": wrong_tooth, "routed": selected}[policy]
                model.set_adapter(active)
                scores = {answer: candidate_score(model, tokenizer, torch, device, sample, answer)
                          for answer in ("yes", "no")}
            guess = max(("yes", "no"), key=lambda answer: scores[answer])
            result = results[policy]
            result["correct"] += int(guess == sample["answer"])
            result["total"] += 1
            # Includes tokenization and adapter switching; CUDA synchronization ensures meaningful wall time.
            if device.type == "cuda":
                torch.cuda.synchronize()
            result["times_ms"].append((time.perf_counter() - t) * 1000)
    summary = {}
    for policy, record in results.items():
        durations = sorted(record.pop("times_ms"))
        summary[policy] = {
            "correct": record["correct"], "total": record["total"],
            "accuracy": record["correct"] / record["total"],
            "p50Ms": round(statistics.median(durations), 3),
            "p95Ms": round(durations[math.ceil(0.95 * len(durations)) - 1], 3)
        }
    envelope = {
        "schema": SCHEMA, "origin": "OBSERVED_LOCAL_UNVERIFIED", "authority": "NONE",
        "kind": "E1B_LOCAL_REAL_MODEL_EVALUATION", "architecture": "LlamaForCausalLM",
        "modelSha256": model_hash, "adapterSha256": adapters_hash,
        "trainDataSha256": digest(rows("train")), "holdoutDataSha256": digest(rows("holdout")),
        "device": str(device), "runtime": {"python": sys.version.split()[0],
            "torch": torch.__version__}, "baselineAndControls": summary,
        "e0RouteReceiptHashes": {k: v["receiptSha256"] for k, v in route_map.items()},
        "baseLoadSeconds": round(load_base_s, 3),
        "adapterLoadSeconds": round(adapter_load_s, 3),
        "peakCudaAllocatedBytes": (torch.cuda.max_memory_allocated() if device.type == "cuda" else None),
        "limits": [
            "Researcher-designed toy text classification with declared capability labels",
            "No verified real-world improvement, independent observation, or NBG closure",
            "Adapters are simultaneously loaded: no cold-swap or PhiStream residency claim",
            "Evaluation is not independent of local operator or self-reported hardware",
            "Operator must respect separate pretrained checkpoint and adapter licenses"
        ]
    }
    return {**envelope, "receiptSha256": digest(envelope)}

def main():
    parser = argparse.ArgumentParser(description="Explicit offline E1-B small-model LoRA experiment")
    parser.add_argument("command", choices=("preflight", "train", "evaluate"))
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--work-dir")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()
    try:
        model_dir = require_directory(args.model_dir)
        arch = inspect_model(model_dir)
        model_hash = folder_digest(model_dir)
        if args.command == "preflight":
            print(json.dumps({"schema": SCHEMA, "status": "LOCAL_PREFLIGHT_ONLY",
                              "modelSha256": model_hash, **arch}, indent=2))
            return
        if not args.work_dir:
            parser.error("--work-dir is required for train and evaluate")
        work_dir = Path(args.work_dir).expanduser().resolve()
        if args.command == "train":
            if work_dir.exists() and any(work_dir.iterdir()):
                raise ValueError("Train work directory must be empty to avoid overwriting artifacts")
            work_dir.mkdir(parents=True, exist_ok=True)
            deps = load_dependencies()
            torch = deps[0]
            device = device_for(torch, args.device)
            logs = []
            for domain in DOMAINS:
                out = work_dir / "adapters" / domain
                out.mkdir(parents=True)
                logs.append(train_one(model_dir, domain, out, device, deps))
            result = {
                "schema": SCHEMA, "kind": "E1B_LOCAL_REAL_MODEL_TRAINING",
                "origin": "OBSERVED_LOCAL_UNVERIFIED", "authority": "NONE",
                "modelSha256": model_hash, "trainDataSha256": digest(rows("train")),
                "device": str(device), "torch": torch.__version__,
                "training": logs,
                "adapterSha256": {d: folder_digest(work_dir / "adapters" / d) for d in DOMAINS}
            }
            result["receiptSha256"] = digest(result)
            (work_dir / "training-receipt.json").write_text(
                json.dumps(result, indent=2) + "\n", encoding="utf-8"
            )
            print(json.dumps(result, indent=2))
        else:
            deps = load_dependencies()
            device = device_for(deps[0], args.device)
            result = evaluate(model_dir, work_dir, device, deps)
            (work_dir / "evaluation-receipt.json").write_text(
                json.dumps(result, indent=2) + "\n", encoding="utf-8"
            )
            print(json.dumps(result, indent=2))
    except (ValueError, RuntimeError, FileNotFoundError, subprocess.SubprocessError) as exc:
        print("E1-B refused: " + str(exc), file=sys.stderr)
        raise SystemExit(2) from None

if __name__ == "__main__":
    main()
