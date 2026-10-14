"""E1-C local receipt consistency audit.

Checks receipt integrity and coherence against a supplied local checkpoint and adapters.
Does NOT authenticate execution, independent evidence, or the truth of model outputs.
No torch/transformers dependency, model execution, networking, or files written.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from e1b_dataset import DOMAINS, digest, rows
from e1b_lab import folder_digest, inspect_model, require_adapter, require_directory

SCHEMA = "NBGPocketMesh.E1C.AUDIT.v1"
TRAIN_KIND = "E1B_LOCAL_REAL_MODEL_TRAINING"
EVAL_KIND = "E1B_LOCAL_REAL_MODEL_EVALUATION"
POLICIES = frozenset({"base", "fixed-vowel", "fixed-suffix", "wrong-tooth", "routed"})


def refuse_if(condition: bool, message: str) -> None:
    if condition:
        raise ValueError(message)


def sha_string(value: object) -> bool:
    return (
        isinstance(value, str) and len(value) == 64
        and all(c in "0123456789abcdef" for c in value)
    )


def no_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    out = {}
    for key, value in pairs:
        refuse_if(key in out, "Duplicate receipt key: " + key)
        out[key] = value
    return out


def read_receipt(path: Path, kind: str) -> dict:
    refuse_if(path.is_symlink() or not path.is_file(), "Missing or symlinked receipt: " + str(path))
    refuse_if(path.stat().st_size > 2_000_000, "Oversized receipt: " + path.name)
    doc = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_keys)
    refuse_if(not isinstance(doc, dict), "Expected JSON object: " + path.name)
    claimed_hash = doc.get("receiptSha256")
    unsigned = {key: value for key, value in doc.items() if key != "receiptSha256"}
    refuse_if(not sha_string(claimed_hash) or digest(unsigned) != claimed_hash,
              "Receipt digest mismatch: " + path.name)
    refuse_if(doc.get("schema") != "NBGPocketMesh.E1B.v1" or doc.get("kind") != kind,
              "Unexpected E1-B schema or receipt kind: " + path.name)
    refuse_if(doc.get("origin") != "OBSERVED_LOCAL_UNVERIFIED" or doc.get("authority") != "NONE",
              "Incorrect provenance or authority label: " + path.name)
    return doc


def nonnegative_number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def audit(model_dir: str, work_dir: str) -> dict:
    model = require_directory(model_dir)
    inspect_model(model)
    work_path = require_directory(work_dir)
    training = read_receipt(work_path / "training-receipt.json", TRAIN_KIND)
    evaluation = read_receipt(work_path / "evaluation-receipt.json", EVAL_KIND)

    model_hash = folder_digest(model)
    refuse_if(
        training.get("modelSha256") != model_hash or evaluation.get("modelSha256") != model_hash,
        "Local checkpoint digest does not match both original receipts"
    )
    refuse_if(training.get("trainDataSha256") != digest(rows("train")) or
              evaluation.get("trainDataSha256") != digest(rows("train")) or
              evaluation.get("holdoutDataSha256") != digest(rows("holdout")),
              "Frozen data digest mismatch")

    trained_adapters = training.get("adapterSha256")
    evaluated_adapters = evaluation.get("adapterSha256")
    refuse_if(not isinstance(trained_adapters, dict) or not isinstance(evaluated_adapters, dict)
              or set(trained_adapters) != set(DOMAINS) or
              set(evaluated_adapters) != set(DOMAINS),
              "Missing or extra adapter digest")
    for domain in DOMAINS:
        adapter_path = work_path / "adapters" / domain
        require_adapter(adapter_path)
        current = folder_digest(adapter_path)
        refuse_if(not sha_string(trained_adapters.get(domain)) or
                  trained_adapters[domain] != current or evaluated_adapters[domain] != current,
                  "Adapter digest mismatch: " + domain)

    logs = training.get("training")
    refuse_if(not isinstance(logs, list) or len(logs) != len(DOMAINS)
              or {log.get("domain") for log in logs if isinstance(log, dict)} != set(DOMAINS),
              "Invalid or incomplete training metadata")
    for log in logs:
        refuse_if(type(log.get("steps")) is not int or log["steps"] <= 0 or
                  type(log.get("trainableScalars")) is not int or log["trainableScalars"] <= 0 or
                  not nonnegative_number(log.get("trainingSeconds")),
                  "Invalid training step count, trainable parameter count, or duration")

    stats = evaluation.get("baselineAndControls")
    refuse_if(not isinstance(stats, dict) or set(stats) != POLICIES,
              "Expected all five frozen baseline/control policies")
    expected_count = len(rows("holdout"))
    for name, record in stats.items():
        refuse_if(not isinstance(record, dict), "Invalid policy observation: " + name)
        correct, total, accuracy = record.get("correct"), record.get("total"), record.get("accuracy")
        p50, p95 = record.get("p50Ms"), record.get("p95Ms")
        refuse_if(type(correct) is not int or type(total) is not int
                  or total != expected_count or not 0 <= correct <= total
                  or not nonnegative_number(accuracy)
                  or abs(accuracy - correct / total) > 1e-12
                  or not nonnegative_number(p50) or not nonnegative_number(p95)
                  or p95 < p50, "Invalid count, accuracy, or latency in " + name)
    route_hashes = evaluation.get("e0RouteReceiptHashes")
    refuse_if(not isinstance(route_hashes, dict) or set(route_hashes) != set(DOMAINS)
              or any(not sha_string(v) for v in route_hashes.values()),
              "Missing or malformed E0 route receipt hashes")
    refuse_if(evaluation.get("device") not in ("cpu", "cuda"),
              "Invalid evaluation device label")
    refuse_if(not nonnegative_number(evaluation.get("baseLoadSeconds")) or
              not nonnegative_number(evaluation.get("adapterLoadSeconds")),
              "Missing or invalid load timings")
    peak = evaluation.get("peakCudaAllocatedBytes")
    refuse_if((evaluation["device"] == "cpu" and peak is not None) or
              (evaluation["device"] == "cuda" and (type(peak) is not int or peak < 0)),
              "Invalid CUDA memory field")
    # Hash comparison checks only byte coherence of local artifacts and JSON
    # arithmetic. Both original receipts could still be forged together.
    result = {
        "schema": SCHEMA,
        "origin": "LOCAL_RECEIPT_COMPARISON",
        "authority": "NONE",
        "status": "CONSISTENT_LOCAL_RECORDS_ONLY",
        "trainingReceiptSha256": training["receiptSha256"],
        "evaluationReceiptSha256": evaluation["receiptSha256"],
        "modelSha256": model_hash,
        "adapterSha256": {d: trained_adapters[d] for d in DOMAINS},
        "holdoutRowsPerPolicy": expected_count,
        "routedCorrect": stats["routed"]["correct"],
        "routedTotal": stats["routed"]["total"],
        "deviceClaimedByLocalReceipt": evaluation["device"],
        "limitation": (
            "Integrity and numerical consistency only; cannot authenticate "
            "execution, hardware, models, training, evidence independence, "
            "real-world capability or NBG formal claims"
        )
    }
    return {**result, "receiptSha256": digest(result)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", required=True, help="original trusted local HF checkpoint")
    parser.add_argument("--work-dir", required=True, help="original local E1-B training/evaluation output")
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.model_dir, args.work_dir), indent=2))
    except (ValueError, OSError, TypeError, json.JSONDecodeError) as exc:
        print("E1-C audit REFUSED: " + str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
