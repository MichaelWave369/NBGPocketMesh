"""Frozen E1-B toy text tasks. This is deliberately not real-world benchmark data."""
from __future__ import annotations
from hashlib import sha256
import json

TRAIN_WORDS = (
    "ants", "eagles", "igloos", "oranges", "islands", "apples",
    "apple", "eagle", "igloo", "orange", "island", "otter",
    "books", "dogs", "pens", "rocks", "maps", "tents",
    "book", "dog", "pen", "rock", "map", "tent",
)
HOLDOUT_WORDS = (
    "umbrellas", "eyes", "engines",
    "umbrella", "eye", "engine",
    "chairs", "bells", "trucks",
    "chair", "bell", "truck",
)
DOMAINS = ("vowel-start", "ends-s")
TASK_TEXT = {
    "vowel-start": "Does the word begin with a vowel (a, e, i, o, u)?",
    "ends-s": "Does the word end with the lowercase letter s?",
}

def rows(split: str) -> list[dict]:
    if split not in ("train", "holdout"):
        raise ValueError("Unknown split")
    words = TRAIN_WORDS if split == "train" else HOLDOUT_WORDS
    return [
        {"id": split + "-" + domain + "-" + word, "domain": domain,
         "word": word, "answer": "yes" if
         (word[0] in "aeiou" if domain == "vowel-start" else word.endswith("s"))
         else "no"}
        for domain in DOMAINS for word in words
    ]

def prompt(row: dict) -> str:
    return "Answer only yes or no.\nQuestion: " + TASK_TEXT[row["domain"]] + "\nWord: " + row["word"] + "\nAnswer:"

def digest(value) -> str:
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
