import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
from e1b_dataset import DOMAINS, digest, rows
from e1b_lab import folder_digest
from e1c_audit import audit


class LocalReceiptAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.model = self.root / "model"
        self.work = self.root / "work"
        self.model.mkdir()
        self.work.mkdir()
        (self.model / "config.json").write_text(
            json.dumps({"model_type": "llama", "architectures": ["LlamaForCausalLM"]}),
            encoding="utf-8")
        (self.model / "tokenizer.json").write_text("{}", encoding="utf-8")
        # These are synthetic digest bytes, NOT loadable safetensors checkpoints.
        (self.model / "model.safetensors").write_bytes(b"fixture-model")
        self.adapters = {}
        for domain in DOMAINS:
            d = self.work / "adapters" / domain
            d.mkdir(parents=True)
            (d / "adapter_config.json").write_text("{}", encoding="utf-8")
            (d / "adapter_model.safetensors").write_bytes(b"fixture-" + domain.encode())
            self.adapters[domain] = folder_digest(d)
        self.model_hash = folder_digest(self.model)
        self.training = {
            "schema": "NBGPocketMesh.E1B.v1",
            "kind": "E1B_LOCAL_REAL_MODEL_TRAINING",
            "origin": "OBSERVED_LOCAL_UNVERIFIED", "authority": "NONE",
            "modelSha256": self.model_hash, "trainDataSha256": digest(rows("train")),
            "adapterSha256": dict(self.adapters), "device": "cpu",
            "training": [
                {"domain": d, "steps": 144, "trainableScalars": 32, "trainingSeconds": 1.5}
                for d in DOMAINS
            ]
        }
        count = len(rows("holdout"))
        self.evaluation = {
            "schema": "NBGPocketMesh.E1B.v1",
            "kind": "E1B_LOCAL_REAL_MODEL_EVALUATION",
            "origin": "OBSERVED_LOCAL_UNVERIFIED", "authority": "NONE",
            "modelSha256": self.model_hash, "trainDataSha256": digest(rows("train")),
            "holdoutDataSha256": digest(rows("holdout")),
            "adapterSha256": dict(self.adapters), "device": "cpu",
            "baseLoadSeconds": 0.3, "adapterLoadSeconds": 0.2,
            "peakCudaAllocatedBytes": None,
            "e0RouteReceiptHashes": {d: "a" * 64 for d in DOMAINS},
            "baselineAndControls": {
                p: {"correct": 12, "total": count, "accuracy": 12 / count, "p50Ms": 10, "p95Ms": 11}
                for p in ("base", "fixed-vowel", "fixed-suffix", "wrong-tooth", "routed")
            }
        }
        self.write()

    def write(self):
        for name, doc in (("training", self.training), ("evaluation", self.evaluation)):
            unsigned = {k: v for k, v in doc.items() if k != "receiptSha256"}
            doc["receiptSha256"] = digest(unsigned)
            (self.work / (name + "-receipt.json")).write_text(json.dumps(doc), encoding="utf-8")

    def test_consistent_synthetic_receipts_are_labeled_not_verified(self):
        report = audit(str(self.model), str(self.work))
        self.assertEqual(report["status"], "CONSISTENT_LOCAL_RECORDS_ONLY")
        self.assertEqual(report["origin"], "LOCAL_RECEIPT_COMPARISON")
        self.assertEqual(report["authority"], "NONE")
        self.assertEqual(report["routedCorrect"], 12)
        self.assertEqual(report, audit(str(self.model), str(self.work)))

    def test_tamper_without_rehash_refuses(self):
        self.evaluation["baselineAndControls"]["routed"]["correct"] = 15
        path = self.work / "evaluation-receipt.json"
        path.write_text(json.dumps(self.evaluation), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Receipt digest mismatch"):
            audit(str(self.model), str(self.work))

    def test_wrong_accuracy_even_with_rehashed_receipts_refuses(self):
        self.evaluation["baselineAndControls"]["routed"]["accuracy"] = 0.99
        self.write()
        with self.assertRaisesRegex(ValueError, "Invalid count"):
            audit(str(self.model), str(self.work))

    def test_changed_adapter_bytes_refuses(self):
        (self.work / "adapters" / DOMAINS[0] / "adapter_model.safetensors").write_bytes(b"new")
        with self.assertRaisesRegex(ValueError, "Adapter digest mismatch"):
            audit(str(self.model), str(self.work))

    def test_changed_model_bytes_refuses(self):
        (self.model / "model.safetensors").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "Local checkpoint digest"):
            audit(str(self.model), str(self.work))

    def test_dataset_mismatch_even_after_rehash_refuses(self):
        self.evaluation["holdoutDataSha256"] = "0" * 64
        self.write()
        with self.assertRaisesRegex(ValueError, "Frozen data digest"):
            audit(str(self.model), str(self.work))

    def test_missing_policy_refuses(self):
        del self.evaluation["baselineAndControls"]["wrong-tooth"]
        self.write()
        with self.assertRaisesRegex(ValueError, "all five"):
            audit(str(self.model), str(self.work))

    def test_duplicate_json_keys_refuse(self):
        p = self.work / "training-receipt.json"
        text = p.read_text(encoding="utf-8")
        p.write_text(text.replace('"schema": ', '"schema": "bogus", "schema": ', 1), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Duplicate receipt key"):
            audit(str(self.model), str(self.work))


if __name__ == "__main__":
    unittest.main()
