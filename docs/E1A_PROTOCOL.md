# E1-A: First learned teeth (frozen synthetic linear lab)

**Research status:** E1-A demonstration, not E1 real-model validation. All observations are tagged `SIMULATED`, authority `NONE`.

## Objective

Demonstrate genuine parameter updates in a tiny locally trained classifier plus deterministic E0 routing between specialist *capabilities*, and compare to fixed-weight baselines. E1-A does not prove neural-network capacity, learned adapter interoperability, efficiency gains or the NBG hypothesis.

## Predeclared dataset and algorithm

- Input features: `[x, y, 1]`, no free-form prompts.
- Domains: `x-sign` label = `x > 0`; `y-sign` label = `y > 0`.
- Train Cartesian grid: `[-3,-2,-1,1,2,3]²`, each coordinate duplicated for both domains = **72 train observations**.
- Holdout Cartesian grid: `[-2.5,-1.5,-0.5,0.5,1.5,2.5]²` for both domains = **72 held-out observations**.
- These are researcher-authored, noiseless synthetic fixtures, and the domain is disclosed to the router as part of capability metadata. The router never examines the label.
- Train pooled **three-scalar base** with online logistic loss / deterministic SGD, 200 epochs, learning rate 0.035, starting at zeros.
- Freeze base; train one **three-scalar delta** per domain with online logistic SGD, 180 epochs, learning rate 0.035.
- Model prediction is binary threshold of `(base + domain delta) · [x,y,1]`. Nine learned scalar parameters total.
- Fixed nested-loop row order; no randomness, no model downloads, no third-party dependencies.
- This is a tiny linear adapter demonstration, **not** LoRA or a language-model parameter update.

## Predeclared comparison

1. **base**: the three-parameter pooled classifier, no adapter.
2. **fixed-x**: always use the x-specialist delta.
3. **fixed-y**: always use the y-specialist delta.
4. **swapped**: deliberately route to the incorrect specialist for each domain.
5. **routed**: E0's contract-matched capability route to the declared domain-specialist.

Report all five accuracy numerators/denominators on exactly the same frozen holdout. Both specialists share a declared training lineage; no independence claim is made.

## Evidence

`npm run demo:e1a` prints a deterministic JSON receipt with separate train/test hashes, trained-weight hash, route-receipt-collection hash, configuration, comparison numerators/denominators, refusal count, and limitations. `npm test` runs required negative controls. The receipt does not report latency or peak VRAM because these were not measured.

## Falsifiers and limitations

If training fails to learn nonzero differentiated parameters, route receipts drift across identical inputs, train/holdout overlap, E0 accepts duplicate declared lineage as independent, or the routing path cannot produce correct decisions, the gate fails.

Even if routing wins, this is **not a generalization or efficiency result**: it is a deliberately transparent two-task toy problem with trivial separability and an oracle-like declared capability. Later E1 requires a compatible open-weight language model, actual trained parameter-efficient adapters, held-out natural tasks, matched compute budgets, load/switch costs, VRAM observations, accuracy and failure measurement, and real control conditions.

## Isolation

No changes to E0's router, PocketBrain, PhiStream, LightBridge, or NBG. The learned weights exist only during this local CLI process and are not loaded into those apps.
