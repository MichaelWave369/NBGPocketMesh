# E2-K Numerical Keyhole and representation invariance

**Status:** Isolated deterministic, dependency-free algebraic/metamorphic test suite. Origin `SIMULATED`; authority `NONE`. **Not** an LLM or independently learned router, NBG closure theorem, historical archaeology result, or real throughput/VRAM optimization.

## Research question

Can a typed Keyhole distinguish an invariant quantity from a frame-dependent observable and from a superficial numeral resemblance, while a coarse display-based observer misclassifies some of those cases? Separately, can a conservative quantization-error bound preserve a scalar sign where low precision alone is uncertain?

The inspiration is a hand-drawn pyramid numerology diagram that juxtaposes the pyramid's approximate 440:280 cubit dimensions, decimal light-speed/latitude digits, and numerical cycles. It is a **test-case inspiration**, not a historical or scientific source of proof. Architectural intentionality, ancient units and physical connections cannot be inferred from this fixture.

## Frozen test cases (15), with no model training

- **6 ratio fixtures:** A stylized pyramid perimeter/(2 height) calculated from base 440 and height 280. Scale both dimensions by a common factor, including illustrative cubit/metre/foot conversions with an *assumed* 0.5236 m/cubit. The ratio = 22/7 under those assumptions; its proximity to π does not demonstrate historical intent. The ratio is **dimensionless**, so a common change of scale should preserve it.
- **6 rotation fixtures:** Apply 90, 180, or 270-degree planar rotations to vector (3,4). Its Euclidean norm stays invariant; its X component changes in the reference frame. This is expected covariance, **not** an error of geometry.
- **3 numerical decoys:** Deliberately choose digit sequences that match after deleting decimal punctuation. One resembles a commonly cited Great Pyramid latitude (29.9792458°) and speed of light in modern metres per second (299,792,458). Another uses 72.432 vs 72432; another 51.840 vs 51840. Their mere display-digit resemblance has no physical or causal interpretation. Convert the speed-like number by the exact convention 1609.344 metres/mile to challenge the digit match (not a power-of-ten rescaling). Different dimensional types are never equated.

The fixtures are hand-authored and contain explicit family/type metadata. The typed validator has more information than the coarse observer. **These are software invariance tests, not a fair learned-vs-fixed machine-learning evaluation.**

## Policies, budgets and claims

- **K0 (cost 1 synthetic unit)**: naïvely compare written values/digits; this produces a *preliminary guess only*. Public API returns `UNRESOLVED`, regardless of resemblance.
- **K1 (cumulative cost 3)**: use declared structural/units/frame metadata and compare the numerical contract. May return `INVARIANT`, `FRAME_DEPENDENT`, `SURFACE_ONLY`, or `CHANGED`.
- **K2 (cumulative cost 6)**: run an additional deterministic adversarial challenge beyond K1. Ratio cases apply a second common scale to the transformed dimensions; rotation cases use a second quarter-turn reference frame; digit decoys additionally convert the SI speed-like number to kilometres/hour (distinct from K1's miles/second conversion). This checks **specified metamorphic contracts**, not independent observational evidence. K2 does not authenticate historical claims, measurement sources or provenance.
- **Baseline:** a deliberately naive raw visual matching method. It is *supposed* to be susceptible to superficial matches and unit transforms.
- **Typed and challenged:** same mathematically typed validator; comparing these to naive is a demonstration of extra input information, **not** evidence of a smarter router. K2 primarily adds visibility and stress-test evidence.

The `npm run demo:e2k` CLI emits the full frozen per-case results, per-family counts, a SHA-256 fingerprint for all case fixtures and precision fixtures, and a canonical deterministic receipt. The React "Pattern vs Structure" module imports the **exact same pure JS** as the CLI, rather than embedding a second set of hard-coded numbers.

## Precision stress control (separate from E2-P/C)

Fourteen signed scalar inputs near and far from zero are quantized in an independently defined toy uniform step of 0.125. A conservative half-step error bound is used: if the low-precision absolute value exceeds the bound, its sign is certified relative to the full precision **scalar reference**. Otherwise, escalate to the original full precision scalar. Report uncorrected sign mismatches, escalations, and disagreements after escalation.

This is **not** using E2-P/C's learned 8-weight gears, quantization bundles or FP32 execution, and it is not a measured neural inference or memory saving. Reference sign preservation is not necessarily ground-truth task correctness.

## Mandatory negative controls

- K0 must not declare a verified structural result.
- Wrong scale applied only to pyramid base must be detected as `CHANGED`.
- Perturb a rotated vector norm so it no longer matches and verify detection.
- Exactly valid Keyhole budgets of 1/3/6, rejecting any other budget.
- Unknown fixture IDs and changed expected-label metadata must be rejected.
- Surface-digit match breaks under conversion to a different unit family.
- Uncertain low-precision cases escalate; every bounded sign must match the explicit scalar reference.
- Identical fixtures yield an identical SHA-256 receipt.
- No external models, downloads, services, secrets, user prompts or network calls.

## Next research, **not** included

1. Remove explicit fixture-family labels and assess routing by observable features.
2. Test robustness to noisy, imprecise or incorrect geometry/units, with tolerances and refusal.
3. Compare equally informed normalization-only, fixed, random, and learned routers on disjoint data.
4. Replay real E2-P/C trained gears under benign reparametrization and report actual precision/regret.
5. Test real PhiStream load costs and LoRA adapters on operator-controlled hardware only after their separate gates.

**Rule:** Observational invariance is evidence about the mathematical quantity under a specified transformation; it cannot prove a cause, human intention, physical phenomenon, or the truth of all possible hypotheses.
