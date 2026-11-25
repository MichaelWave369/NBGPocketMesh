# PhiMycelium R6 — versioned replica memory
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R6 uses R2's exact pocket-address mapping and deterministic numeric reconstruction. A genesis record has an empty sparse overlay. Each update stores a complete canonical sparse overlay (not a patch relative to the previous revision), a parent hash, revision, pocket ID and content checksum. Old versions remain in the ledger. Writes require an exact expected unique head. No-op writes are refused. Record hashes are content-addressed consistency receipts, not authenticated signatures.

Each simulated replica contains a complete, ancestry-closed record set for the pockets it holds. Reconciliation validates replicas then takes a deterministic union by record hash. Independent pockets coexist; concurrent children of one ancestor remain visible as conflicting heads. Reads and writes refuse ambiguous heads; R6 does not implement conflict resolution, multi-parent merging, consensus or authenticated replication. A surviving complete replica can reconstruct after another copy is lost. Missing ancestry, changed bytes and invalid checksums are rejected rather than silently repaired. Canonical JSON checkpoints can be saved by an external caller; this module performs no disk or network I/O, atomic write, fsync, crash-safe storage, or actual distributed synchronization. A caller can fabricate a self-consistent entire history, so hashes alone do not prove source truth.

Bounds: 729 records per replica or union, nine replicas per reconciliation, 2 MB canonical checkpoint text, 729 pocket IDs, fixed 9x9 grid and 96 iteration limit. Validation reconstructs each record; this is not measured storage or runtime efficiency. Replicas may contain conflicting histories, and a checkpoint does not establish freshness against rollback. Do not store personal or secret data in this simulator.

PhiMemory9's existing ENTER/BIRTH, TRANSFER, RENEW and LIBERATION lineage concepts are relevant design analogues (see its docs/ARCHITECTURE.md). This is a PocketMesh-specific research contract, not a PhiMemory9 database import or interop implementation. No changes to that repository, existing signed gates, or R0–R5. Future integration needs an explicit schema mapping and independently verified authorization, persistent transactions, version conflict resolution and fault injection.

Run:
    node --test tests/phi-mycelium-r6.test.mjs
    node scripts/phi-mycelium-r6-demo.mjs
