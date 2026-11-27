# ΦNullMesh R7 — formal theorem candidates

Research-only continuation of merged R6 (#57), 19/19 exact-head workflow runs succeeded. This module uses Lean core (import Lean) without Mathlib, a fixed released Lean 4.19.0 toolchain (https://lean-lang.org/doc/reference/4.19.0/), and nine explicit theorem statements with proof terms. No custom axioms or admitted proofs are intended. CI treats warnings as errors, checks toolchain version, prints each theorem's axiom dependencies, rejects sorryAx, and retains the report. Version pin is not a cryptographic binary digest; trusted upstream release distribution and hosted runner remain supply-chain assumptions. No root toolchain change.

| Theorem | Actual mathematical statement | Connection |
|---|---|---|
| composition_assoc | Typed function composition associates | R0/R5 conceptual composition |
| identity_left | Left identity | R0 |
| identity_right | Right identity | R0 |
| reframe_gluing | Intermediate inverse cancels | R1 |
| reframe_roundtrip | Left-inverse round trip | R1 |
| path_conservation | Edgewise preservation of arbitrary quantity implies preservation along any finite list | R3 |
| potential_path | Root-coordinate factorization telescopes | R2 |
| closed_path_identity | Closed list has identity under root-potential assumptions | R2 |
| reversible_noncommutativity | Two involutive transpositions do not commute | R4 conceptual counterexample |

Explicit assumptions: typed functions are total; no matrix entries, bounded rational arithmetic, floating point, serialization, graph membership, physical geometry or execution authorization are formalized. Path laws assume the edge equation/preservation for every transition; they do not prove that the JS graph audit establishes those assumptions. Functional composition is not a formal proof of the R5 tensor contraction algorithm, arbitrary matrix multiplication implementation, trace/determinant invariance, Sylvester criterion or gravitational equations. No claim of Lean verification of R0–R6 software. The examples separate generic algebraic statements from empirical implementation checks. Function extensionality can introduce standard Lean kernel dependencies (e.g. Quot.sound); report actual dependencies after CI rather than asserting axiom-free status.

Local authoring environment has no Lean executable and DNS to releases.lean-lang.org failed. The nine proofs are IMPLEMENTED—UNVERIFIED until native Lean CI succeeds. No runtime, dependencies in existing modules, external repository or authority changes. Production BLOCKED.

Reproduce with an installed pinned Lean:
    lean --version
    lean research/phi-nullmesh-r7/BoundaryLaws.lean

Next R8: integrated evidence inventory with exact-head CI logs, R6 oracle outputs, Lean proof dependency audit, explicit claim-to-evidence mapping and retained limitations. Do not promote a candidate based solely on CI without reviewing its actual scope.
