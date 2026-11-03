import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCouncilKeyholes as evaluate, SCHEMA, COUNCIL_ROLES } from "../src/council-e0.mjs";

function fixture() {
  return {
    schema: SCHEMA, caseId: "lhcb-inspired-synthetic-001",
    origin: "SIMULATED", authority: "NONE", privacy: "PUBLIC_SYNTHETIC",
    candidates: [
      { id: "A", producer: "synthetic-fixture", origin: "SIMULATED", authority: "NONE",
        metrics: { ordinary: { correct: 95, total: 95 }, rare: { correct: 0, total: 5 } } },
      { id: "B", producer: "synthetic-fixture", origin: "SIMULATED", authority: "NONE",
        metrics: { ordinary: { correct: 90, total: 95 }, rare: { correct: 5, total: 5 } } }
    ]
  };
}

test("same aggregate conceals a distinguishable subgroup failure", () => {
  const r = evaluate(fixture());
  assert.equal(r.keyholes.K0.equivalent, true);
  assert.equal(r.keyholes.K1.equivalent, false);
  assert.equal(r.hiddenDistinctionWitness, true);
  assert.deepEqual(r.keyholes.K0.correct, [95, 95]);
  assert.equal(r.recommendation, "REVIEW_STRATIFIED_OBSERVATION");
});

test("identical strata do not invent a hidden distinction", () => {
  const f = fixture();
  f.candidates[1].metrics = structuredClone(f.candidates[0].metrics);
  const r = evaluate(f);
  assert.equal(r.keyholes.K0.equivalent, true);
  assert.equal(r.keyholes.K1.equivalent, true);
  assert.equal(r.hiddenDistinctionWitness, false);
});

test("already-distinct coarse observations do not masquerade as Altermath witness", () => {
  const f = fixture();
  f.candidates[1].metrics.rare.correct = 4;
  const r = evaluate(f);
  assert.equal(r.keyholes.K0.equivalent, false);
  assert.equal(r.hiddenDistinctionWitness, false);
});

test("receipt is deterministic, source changes alter digest", () => {
  const a = evaluate(fixture());
  assert.deepEqual(a, evaluate(fixture()));
  const f = fixture();
  f.candidates[1].metrics.ordinary.correct -= 1;
  assert.notEqual(a.receiptSha256, evaluate(f).receiptSha256);
  assert.match(a.receiptSha256, /^[a-f0-9]{64}$/);
});

test("all execution and sharing authority remains false", () => {
  const r = evaluate(fixture());
  assert.equal(r.authority, "NONE");
  assert.equal(r.executionAuthorized, false);
  assert.equal(r.shareAuthorized, false);
  assert.equal(r.independentlyVerified, false);
  assert.equal(COUNCIL_ROLES.GAIA, "LATER_SYMBOLIC_IDEATION_ONLY");
});

test("reject measured and verified claims in synthetic fixture contract", () => {
  for (const key of ["origin", "authority", "privacy"]) {
    const f = fixture();
    f[key] = "VERIFIED";
    assert.throws(() => evaluate(f), /synthetic cases/);
  }
  const f = fixture();
  f.candidates[0].origin = "MEASURED";
  assert.throws(() => evaluate(f), /simulated fixture/);
});

test("reject generative and symbolic output promoted to dataset evidence", () => {
  for (const producer of ["GAIA", "ThinkTank", "Vessie", "PhiServe"]) {
    const f = fixture();
    f.candidates[0].producer = producer;
    assert.throws(() => evaluate(f), /simulated fixture/);
  }
});

test("refuse unequal cohort denominators, duplicate IDs and malformed metrics", () => {
  const x = fixture();
  x.candidates[1].metrics.rare.total = 6;
  assert.throws(() => evaluate(x), /matched cohorts/);
  const y = fixture();
  y.candidates[1].id = "A";
  assert.throws(() => evaluate(y), /identities/);
  const z = fixture();
  z.candidates[0].metrics.rare.correct = 6;
  assert.throws(() => evaluate(z), /integer counts/);
});

test("fail closed on extra fields and accidental sensitive input", () => {
  const f = fixture();
  f.prompt = "private content";
  assert.throws(() => evaluate(f), /unsupported fields/);
  const g = fixture();
  g.candidates[0].prompt = "private content";
  assert.throws(() => evaluate(g), /unsupported fields/);
});

test("case identity, role naming and cohort bounds are typed", () => {
  const f = fixture();
  f.caseId = "../unexpected";
  assert.throws(() => evaluate(f), /opaque identifier/);
  const g = fixture();
  g.candidates[0].metrics.rare.total = 1000001;
  assert.throws(() => evaluate(g), /integer counts/);
});
