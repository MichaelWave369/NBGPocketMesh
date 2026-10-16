# E2-A · Trained Elastic Nested Gear pilot

**Status:** Independently runnable local synthetic numerical study. **NOT** an LLM, real-time weight-streaming benchmark, NBG mathematical closure proof, or validated AI efficiency advantage.

**Evidence:** locally executed synthetic regression; origin `OBSERVED_LOCAL_UNVERIFIED`, authority `NONE`. No model files, dependencies, network calls, GPU or pretrained weights.

## Reproduce

Requires Node.js 20 or newer, no packages to install.

~~~sh
npm test
npm run demo:e2a
npm run demo:e2a -- --timed
~~~

The ordinary demo prints a deterministic SHA-256 receipt with train/holdout/weight/manifest digests, seven controlled variants, routing traces and per-subgroup accuracy. Optional --timed gives observed JavaScript process timings *outside* the receipt hash; these do **not** measure cold loading, GPU execution or end-to-end generation.

## Frozen numerical experiment

- Separate seeded synthetic train (960 rows; seed 36916) and holdout (384 rows; seed 10369); disjoint IDs, similar feature distributions.
- Six sensor channels each have two scalar signals, an activation cue and three refinement cues. A synthetic teacher generates targets by summing contributions from one or two active channels, making 128 held-out examples require **macro** two-tooth composition.
- Each active local teacher value is x, optionally refined by one of three nonlinear corrections: 0.72*x*z; -0.67*(x*x-1/3); 0.58*(z*z-1/3). Six learned parent modules each have three separately trained potential child residual modules. Maximum inference depth is two.
- All parent, child, flat and core/dense regression parameters are fitted numerically with deterministic SGD. Parent and child routing is also learned through logistic SGD on synthetic cue/activation training labels. During inference the router reads only observable x,z,cue and child hints; it never reads active IDs, hidden mode, answer label or teacher score.
- **Critical advantage / limitation:** each parent and child is trained using *privileged teacher factor-level regression targets*. Dense and core use the global score; flat teeth get per-channel targets. Model capacities, parameter totals and supervision differ. This is a correctness exercise, **not** a matched-capacity or matched-training scientific comparison.
- The manifest contract pins all 6 parent and 18 child weights to local, admitted, hashed compatible interfaces. Any revoked, remote, stale, duplicated, wrong-parent, mismatched-weight or unrecognized manifest fails closed. Memory/compute limits are synthetic budget units, not reservations or measured RAM/VRAM.

## Mandatory comparators

| Variant | Meaning |
|---|---|
| core | Trained small pooled predictor |
| dense | Full-input trained linear regression |
| flat | Top-k routed flat specialists (no nested child run) |
| hier | Learned parent and child selection, additive residual composition |
| hier-no-child | Disable micro refinement |
| hier-no-macro | Allow only one parent; test two-domain cases |
| fixed | Fixed cue thresholds in place of learned router |

Every variant sees the same 384 held-out inputs and emits overall/group accuracies, score MSE, parent/child selections, false selections and a rough **scalar dot-op count**. These dot-op counts omit exp/sigmoid, input-feature construction, interpreter overhead, memory traffic and transfers; they are not full FLOPs.

## Initial independently rerunnable local implementation result

| Variant | Correct / 384 | Accuracy | Dot ops / sample |
|---|---:|---:|---:|
| core | 304 | 79.17% | 4.000 |
| dense | 310 | 80.73% | 50.000 |
| flat | 348 | 90.63% | 54.667 |
| hier | 384 | **100%** | 53.344 |
| hier-no-child | 340 | 88.54% | 49.333 |
| hier-no-macro | 348 | 90.63% | 46.969 |
| fixed | 384 | **100%** | 53.344 |

**Negative finding:** the learned router did **not** outperform a trivial fixed-rule router on these easy generated cue distributions. Hierarchical gains here are primarily consequences of structured teacher targets and appropriate factorization, not evidence of superior general intelligence. Do not compare timing or operation counts as claims of production speedup.

## Testable failure conditions

- Any train/holdout ID collision, absent macro case, NaN/untrained weight, or nondeterministic receipt.
- Any route influenced by hidden teacher score, active IDs, hidden child mode or answer labels.
- More than two parents, depth beyond two, unauthorized modules, invalid hashes, wrong lineage/parent ID or over-budget execution.
- Missing dense/flat/fixed/child-off/macro-off comparisons; accepting a tampered receipt.
- Promoting this experiment to real-weight, model-quality, general-intelligence, Phi-geometric or NBG closure evidence.

For harder E2 experiments: hide or corrupt routing hints, remove privileged factor-label supervision, compare equally supervised matched-budget experts, test multiple seeds and true cold/warm weight loading. E2-B must first satisfy the existing operator-controlled E1-B/E1-C trusted checkpoint prerequisites. See the broader [E2 architectural draft PR #5](https://github.com/MichaelWave369/NBGPocketMesh/pull/5).

**Isolation:** This module does not import or alter E0/E1 code, PocketBrain, NBG, PhiStream or LightBridge.