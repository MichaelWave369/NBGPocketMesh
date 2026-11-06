# Pocket Album Protocol v0 — Score → Gears → Pocket → Performance

**Status: implemented offline Node.js prototype; origin `SIMULATED_LOCAL`, authority `NONE`.** This is a new experiment inside **NBGPocketMesh**, not a deployed plugin, network service, model router, authentication service, or scientific theory of consciousness.

## Components

- **Pocket**: a logical path (`root/3/6/9`) to a versioned, SHA-256 content-addressed album descriptor; this experiment does not yet implement an infinite spatial grid or persistent pocket store.
- **Album**: three fixed typed stages: `observe → diagnose → report`. The album holds source digests and an ordered score, not arbitrary executable module URLs.
- **Track**: a locally allowlisted ES module with an explicit input and output type; only approved, repository-pinned paths are importable. `observe` parses a small network-status fixture, `diagnose` classifies a fixed threshold, and `report` formats fixed actions. No network device, AI model, shell command, model weights or remote endpoint is used.
- **Score**: ordered contract composition. Adjacent output and input types must match; unrecognized descriptors and source changes fail closed.
- **Gear / Keyhole**: interface/type check before and after each execution plus an independent boolean permission gate and declared working-set ceiling.
- **Performance**: selected stages run on fixture data; the result and its complete input-to-output hash chain are recorded in a deterministic receipt containing **only hashes and metadata**, not raw observations.

## Use

Node.js 20+; no dependencies or network calls:

```bash
npm test
npm run demo:album
```

`demo:album` compares **selective** (imports only the needed score prefix) and **eager** (imports all three track implementations, then executes the same prefix) at three targets: observe, diagnose, report. Outputs should match exactly for each target.

| Target | Selective import requests | Eager import requests | Declared synthetic load units (selective/eager) |
|---|---:|---:|---:|
| Observe | 1 | 3 | 2 / 10 MiB |
| Diagnose | 2 | 3 | 5 / 10 MiB |
| Report | 3 | 3 | 10 / 10 MiB |

The *MiB numbers are invented manifest planning inputs*, not measured resident memory. `requestedModules` counts imports requested by the runner, not how many unique modules were physically loaded in a warm process. `wallTimeMsIllustrative` is a one-shot, module-cache-sensitive debug metric and is **not** evidence of a performance gain. Eager-vs-selective comparison uses identical functions for each requested target; runtime caching must be accounted for before real cold-start benchmarks.

## Tamper and refusal controls

- Modified album digest, source digests, unexpected fields, unknown implementations, mismatched types and source-file drift are rejected before execution.
- No file path or remote URL is accepted from a supplied manifest. The registry is fixed in the source code.
- Invalid input and output contracts are rejected (including a deliberately broken `report-broken` fixture).
- Closed permission or insufficient declared memory returns a deterministic `REFUSE` receipt and performs zero module imports.
- Receipt exact replay is bound to the full declared input and album, rejecting changed evidence or fabricated decisions.
- An alternate `report-v2` source renders the same observable output as `report-v1` for the frozen fixture; the album and source digests differ. **Matching a small test suite is not behavioral equivalence across all possible inputs.**

## Limitations and next gates

- SHA-256 detects drift under the local descriptor. It does **not** authenticate an author or protect against an attacker able to change the code and regenerate manifests. The modules execute with ordinary Node.js privileges; this is **not a sandbox**. Trusted, reviewed repo sources only.
- The existing E0 router selects synthetic capability manifests but does not execute modules; Pocket Album v0 is an **isolated local runner**, not a production bridge to E0, PhiKernel, PhiStream, PocketBrain or PhiOS.
- There is no recursive quadtree allocator, persisted object database, network transport, live permission identity, dynamic remote adapters, learned teeth, GPU/VRAM scheduling, or user-data storage.
- The score/melody metaphor is a design vocabulary. The prototype makes no claim about reincarnation, persistent subjective experience, fundamental magnetism, or physical nested realities.
- Next steps require a **signed approval chain**, sandboxed execution, independent contract compatibility suite, persistent content-addressed storage, separate cold-process timing/memory benchmarks, and explicit operator consent before any live integration.
