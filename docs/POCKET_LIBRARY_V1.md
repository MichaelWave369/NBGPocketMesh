# Pocket Album v1: The Living Library

**Scope:** Node.js 20+ / offline / trusted local modules / deterministic demonstration.
**Authority:** `NONE`. **Origin:** `SIMULATED_LOCAL`.

v1 extends the merged [Pocket Album v0](POCKET_ALBUM_V0.md). A track is still a fixed, reviewed local JavaScript module. A score is still a typed series of transformations. The new component is a **content-addressed catalog of albums** with bounded recursive pocket addressing, track deduplication, append-only versions, search, and opt-in snapshots.

This is a **local capability library**, not a physical infinite grid, neural consciousness model, cloud storage system, sandbox, signed package manager, general plugin host, or network service.

## Try it

```sh
npm test
npm run demo:library
# Explicitly create a snapshot. Refuses to overwrite existing files.
npm run demo:library -- --save my-library.json
# Explicitly reload the saved snapshot.
npm run demo:library -- --load my-library.json
```

All paths above are local, user-supplied CLI paths; the library itself contains no filesystem paths, executable module URLs, credentials, shell commands, or remote endpoints.

## V1 data model

- **Pocket address:** `root/0/1/3` is a *logical quadtree address*, not a file path. Digits 0–3 designate four child quadrants at each level. The current address depth is **1–12**, not truly infinite. A pocket belongs to one album family; successive revisions share that pocket.
- **Track:** a typed v0 track descriptor containing name, reviewed implementation ID, input/output contracts, declared planning memory, and the actual local source SHA-256. V1 stores one copy per **descriptor hash**, and albums refer to it by hash. The catalog cannot introduce new executable modules.
- **Album:** `id`, `title`, increasing integer `revision`, `pocket`, `tags`, an execution `target` (observe/diagnose/report), and `reportImplementation` (allowlisted v1/v2). The descriptor includes source-album SHA-256, ordered shared `trackRefs`, and an independent content digest.
- **Library snapshot:** sorted albums and deduplicated tracks, tagged `NBGPocketMesh.PocketLibrary.v1` with a SHA-256 digest. The digest covers all catalog content; a changed title, address, track reference, revision, or source file makes the validated snapshot mismatch.
- **Performance:** resolve an album by ID and explicit revision, or default to the highest revision. Rebuild the approved v0 album, verify every source digest and track ref, execute only the selected score prefix through the v0 Keyhole, and wrap its receipt in a library/album-bound receipt.
- **Search:** exact tag, lowercase substring of title/ID/tag, descendant pocket, latest-only toggle. This is deterministic lexical lookup, not semantic inference.

The demo creates three album families at `root/0`, `root/1/0`, and `root/1/1`: observe, diagnose, and report. The report family has two immutable revisions. Revision 2 selects the alternate reviewed report implementation. Both revisions share the first two tracks, while the report track hash changes. Their frozen output fixtures match, but equal output on a few fixtures is **not** proof of universal program equivalence.

## Safety and limits

- **Only compiled-in, reviewed v0 modules run.** A catalog cannot specify an arbitrary path, import URL, shell command, network address, or arbitrary JSON program. Editing trusted sources and recomputing all digests is not prevented. The existing Node modules run **without a sandbox**.
- **Explicit refusal:** invalid schema, duplicate addresses between album families, unauthorized revisions, missing/changed track hashes, unknown source implementation, malformed input/output, closed permission gate, or declared budget violations fail closed.
- **Tight bounds:** at most 32 album revisions and 16 distinct track digests; positive revisions at most 1,000,000; addresses at most 12 quadrants; snapshots at most 512,000 UTF-8 bytes. Strict key validation rejects unexpected fields.
- **Snapshots:** only explicit `--save path` writes a new file with create-only semantics; `--load path` reads and revalidates. There is no automatic update, synchronization, locking, conflict resolution, encryption, key management, or durable transaction journal. The file is just JSON. Avoid putting confidential information inside it.
- **Receipts:** hash-linked, deterministic metadata only, and rechecked by local replay. They do **not** attest source authorship, runtime isolation, actual execution by a remote agent, semantic correctness, true independence of evidence, or cryptographic authorization.
- **Performance:** selective/eager is a comparison of requested module imports and **invented declared MiB planning units**. It is not a valid RAM/VRAM measurement or cold-load speedup benchmark. Existing v0 caveats still apply.
- **No live integrations:** no PhiOS, PhiStream, PocketBrain, hardware device, real network diagnostic, agent dispatch, remote models, or AI decision-making are involved.

## Verified local boundaries

The catalog directly reuses v0's typed runner and source digests. It does **not** bypass the existing `NBGPocketMesh.E0.v1` router's permission rules or impersonate its routing receipts. The two labs remain separate until a verified bridge explicitly checks both contracts.

## Next measurable gates, not implemented

1. Property-based multi-album invariants and independent corpus test cases, including path collisions, digest drift, and revision rollback.
2. Independent *cold-process* memory and load-time benchmarks with measurement tools, controls, and uncertainty.
3. Durable content-addressed storage with authenticated signatures, an explicit trust root, and atomic updates.
4. Sandboxed execution with executable permissions independent of the catalog, plus real PhiOS/PhiStream/PocketBrain integration tests.

## Code map

- `src/pocket-library.mjs`: pure catalog contract, approved v0 score references, search, execution, receipts, and explicit snapshot I/O.
- `tests/pocket-library.test.mjs`: deterministic positive and adversarial tests.
- `scripts/pocket-library-demo.mjs`: runnable demo and optional local snapshot.
- `src/pocket-album.mjs`: unchanged, original approved execution engine.

**Working maxim:** *The library remembers the album; the score picks the tracks; the Keyhole decides what may play; the receipt records what actually ran.*
