# E2-KB: Text-only (blind) Keyhole-family routing

**Status:** Deterministic, locally trained miniature classifier on manually authored text.
**Origin:** SIMULATED. **Authority:** NONE.

## Question

Can a small learned router select a potential math inspection family from the
words of a request, without reading an explicit family label, answer, or task ID
at inference time? This extends the fixed typed E2-K mathematical fixtures;
it does **not** replace or modify them.

## Frozen partitions

Five predeclared classes: ratio, rotation, digits, precision, and unknown.
The unknown class maps to an explicit ABSTAIN decision.

- 60 authored training requests (12/class).
- 20 separate authored validation requests (4/class).
- 40 separate authored held-out requests (8/class).
- Cases are frozen in site/src/blind-keyhole.js and checked for uniqueness.
- Gold labels are used for **offline training and evaluation only**. The
  inference function takes the request's text and a trained parameter map.
- Related words and phrasing occur across splits. This is neither real-world
  sampling nor a strong out-of-distribution benchmark.

## Policies and objective

1. Always ABSTAIN, a safety floor (NOT a majority classifier).
2. Hand-coded lexical rules, abstaining on multiple or missing recognized cues.
3. Original multinomial Naive Bayes code fitted to training word unigrams and
   character trigrams with Laplace smoothing. No external model/code/weights.

The learned classifier selects its abstention gap from the frozen set
[0, 0.5, 1.5, 3, 6, 12, 24] by scoring the **validation** split, never holdout.
Validation utility is correct - 2*wrong - 0.25*known_task_abstention.
An 'unknown' top class or gap smaller than the chosen threshold abstains.
The score gap is *not a calibrated probability or reliable uncertainty measure*.

Compare all policies on the same 40 holdout requests; record correct,
confidently wrong and known-task abstentions separately. Because the test
cases are small and hand-designed, success provides only a sanity check for
a learned router, not an ML generalization or production-routing claim.

## Reproduction

Use Node.js >=20; no dependencies or model downloads are needed.

    npm test
    npm run demo:e2kb
    npm run test --prefix site

The demo prints SHA-256 digests for frozen training/validation/holdout
datasets and a deterministic JSON receipt including every holdout prediction.
The React console imports the exact same browser-compatible classifier.

## Negative controls

- Reject missing, short, oversized or malformed input.
- Reject thresholds outside the declared set.
- Reject training split as a heldout evaluation.
- Require no duplicate case IDs or texts across splits.
- Ensure replay determinism.
- Log wrong routing separately from uncertainty abstention.
- Fixed-rule requests with multiple contradictory type hints must abstain.
- Existing E0, E1, E2-A, E2-P/C and E2-K code/receipts remain unchanged.

## Claim firewall

This experiment only proposes a mathematical specialist **by name**.
It neither parses actual typed quantities nor executes the E2-K math probe
on free text. It does not test real neural language-model adapters, GPU
latency, PhiStream, LightBridge, archaeological intentionality, or formal
NBG closure.

## Next tests

Use independently authored paraphrases, intentionally ambiguous mixed
questions, unit/measurement corruption, equal-information controls,
calibration curves, cost-sensitive routing and end-to-end actual math with
refusal on unparseable inputs. Do not promote any real-world performance
claim from this hand-authored test alone.
