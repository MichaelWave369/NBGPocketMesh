import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from e1b_dataset import DOMAINS, TRAIN_WORDS, HOLDOUT_WORDS, rows, prompt, digest


class FrozenFixtureTests(unittest.TestCase):
    def test_train_holdout_disjoint(self):
        self.assertTrue(set(TRAIN_WORDS).isdisjoint(HOLDOUT_WORDS))
        self.assertEqual(len(TRAIN_WORDS), 24)
        self.assertEqual(len(HOLDOUT_WORDS), 12)
        self.assertEqual(len(rows("train")), 48)
        self.assertEqual(len(rows("holdout")), 24)

    def test_labels_balanced_and_reproducible(self):
        for split in ("train", "holdout"):
            allrows = rows(split)
            self.assertEqual(allrows, rows(split))
            self.assertEqual(len(set(r["id"] for r in allrows)), len(allrows))
            for domain in DOMAINS:
                domainrows = [r for r in allrows if r["domain"] == domain]
                counts = [sum(r["answer"] == ans for r in domainrows)
                          for ans in ("yes", "no")]
                self.assertEqual(counts, [len(domainrows)//2] * 2)
                self.assertTrue(all(prompt(r).endswith("Answer:") for r in domainrows))

    def test_unsupported_split_refuses(self):
        with self.assertRaises(ValueError):
            rows("experimental")

    def test_canonical_hash_stable_and_sensitive(self):
        first = digest(rows("train"))
        self.assertEqual(first, digest(rows("train")))
        self.assertNotEqual(first, digest(rows("holdout")))
        self.assertEqual(len(first), 64)

if __name__ == "__main__":
    unittest.main()
