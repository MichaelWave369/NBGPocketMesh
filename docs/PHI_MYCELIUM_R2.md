# PhiMycelium R2 — Mandelbrot germination
**SIMULATED / ANALYZE_ONLY / authority NONE.**

R2 maps the R1 nine-way containment tree onto a 3-by-3 spatial subdivision of the complex plane, starting at real [-2.25,0.75] and imaginary [-1.5,1.5]. Root address r; child digits 0–8, row-major. Address identity is independent of growth stage or displayed golden-angle coordinates. A versioned descriptor stores address, resolution and iteration limit. The bounded recurrence starts at z=0 and reports the first iteration at which |z|^2>4, or 0 if not escaped within the limit. Zero is not proof of Mandelbrot membership.

Exact integer ternary region indices are retained through depth 12; sampling uses binary64, not arbitrary precision. Reproducibility is specified for the same algorithm and compatible numeric runtime, not all implementations or arbitrarily deep zooms. SHA-256 checksums are unsigned consistency receipts only. R2 implements a procedural grid of numeric cells, not executable environments, physical holograms or compression of arbitrary data.

Sparse overlays store sorted unique changed cell indices and values separately; unchanged edits are omitted. Reconstruction regenerates the base and applies edits; it does not persist to disk. Descriptor/cell-array byte counts compare UTF-8 JSON arrays only, excluding indexes, receipts, edits and runtime memory; these are not general compression benchmarks.

Limits: 729 R1 pocket IDs; address depth 12 for standalone descriptors; resolution 1–27 per side; 1–256 iterations per cell; cohort upper bound 3,000,000 iterations per materialization pass. Cohort currently performs two passes to calculate byte counts, so total recurrence iterations are bounded by twice the reported work upper bound. R0/R1 and production authorization remain untouched.

Run:
    node --test tests/phi-mycelium-r2.test.mjs
    node scripts/phi-mycelium-r2-demo.mjs
Root npm test discovers tests automatically.

Next: R3 branch pruning/regrafting with independent containment, preserved pocket descriptors and explicit connectivity constraints; later compare resource-matched topology families and add a permission-scoped Altermath adapter. No live execution.
