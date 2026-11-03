import test from "node:test";
import assert from "node:assert/strict";
import { COUNCIL_E1_SCHEMA, COUNCIL_PROJECTS, buildCouncilEvidenceExchange as build, reviewCouncilEvidenceExchange as review } from "../src/council-e1.mjs";
import { SCHEMA as E0_SCHEMA } from "../src/council-e0.mjs";

const sourceSha = "a".repeat(40); // Explicitly fixture-only, not an observed GitHub HEAD.
function fixture() {
  return {
    policyEpoch: 1,
    e0Input: {
      schema: E0_SCHEMA, caseId: "council-sim-001",
      origin: "SIMULATED", authority: "NONE", privacy: "PUBLIC_SYNTHETIC",
      candidates: [
        { id: "A", producer: "synthetic-fixture", origin: "SIMULATED", authority: "NONE",
          metrics: { ordinary: { correct: 95, total: 95 }, rare: { correct: 0, total: 5 } } },
        { id: "B", producer: "synthetic-fixture", origin: "SIMULATED", authority: "NONE",
          metrics: { ordinary: { correct: 90, total: 95 }, rare: { correct: 5, total: 5 } } }
      ]
    },
    participants: COUNCIL_PROJECTS.map(({project, repository}) => ({
      project, repository, sourceSha
    }))
  };
}

test("three role receipts carry the same exact E0 parent without granting powers", () => {
  const x = build(fixture());
  assert.equal(x.schema, COUNCIL_E1_SCHEMA);
  assert.equal(x.state, "HELD_FOR_OPERATOR_REVIEW");
  assert.equal(x.origin, "SIMULATED");
  assert.equal(x.externalCalls, 0);
  assert.equal(x.receipts.length, 3);
  assert.deepEqual(x.receipts.map(r => r.participant), ["ThinkTank", "PocketBrain", "Vessie"]);
  assert.equal(new Set(x.receipts.map(r => r.parentE0Sha256)).size, 1);
  assert.equal(x.receipts[0].action, "CHALLENGE_AGGREGATE_EQUIVALENCE");
  assert.equal(x.receipts[1].action, "DISPLAY_K0_K1_CONTRAST");
  assert.equal(x.receipts[2].action, "HOLD_FOR_OPERATOR_REVIEW");
  for (const r of x.receipts) {
    assert.equal(r.authority, "NONE");
    assert.equal(r.sourceIdentity, "DECLARED_UNVERIFIED");
    assert.equal(r.evidenceAuthenticated, false);
    assert.equal(r.modelExecuted, false);
    assert.equal(r.transportPerformed, false);
    assert.match(r.receiptSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(x.executionAuthorized, false);
  assert.equal(x.sharingAuthorized, false);
  assert.equal(x.mergeAuthorized, false);
});

test("receipt replay is deterministic and participant order is canonical", () => {
  const f = fixture();
  assert.deepEqual(build(f), build(f));
  const g = fixture();
  g.participants.reverse();
  assert.deepEqual(build(f), build(g));
});

test("review only checks deterministic integrity and refuses forged output", () => {
  const f = fixture(), x = build(f);
  assert.deepEqual(review(f, x), {
    schema: COUNCIL_E1_SCHEMA, integrityMatches: true,
    disposition: "REPLAY_MATCH_REVIEW_ONLY", provenanceAuthenticated: false,
    executionAuthorized: false, shareAuthorized: false,
    sourceIndependent: false, scientificEvidence: false
  });
  const forged = structuredClone(x);
  forged.receipts[2].action = "APPROVED";
  assert.equal(review(f, forged).disposition, "REFUSE_MISMATCH");
  assert.equal(review(f, null).integrityMatches, false);
});

test("source revision drift changes digest and invalidates old bundle", () => {
  const f = fixture(), old = build(f);
  const newer = fixture();
  newer.participants[0].sourceSha = "b".repeat(40);
  const next = build(newer);
  assert.notEqual(old.exchangeSha256, next.exchangeSha256);
  assert.equal(review(newer, old).disposition, "REFUSE_MISMATCH");
});

test("E0 data drift changes lineage and invalidates old bundle", () => {
  const f = fixture(), old = build(f);
  const other = fixture();
  other.e0Input.candidates[1].metrics.ordinary.correct = 89;
  assert.notEqual(build(other).e0ReceiptSha256, old.e0ReceiptSha256);
  assert.equal(review(other, old).integrityMatches, false);
});

test("null and already-distinct K0 outcomes do not invent a hidden witness", () => {
  const identical = fixture();
  identical.e0Input.candidates[1].metrics =
    structuredClone(identical.e0Input.candidates[0].metrics);
  const ri = build(identical);
  assert.equal(ri.receipts[0].action, "REVIEW_E0_RESULT");
  assert.equal(ri.receipts[1].action, "DISPLAY_E0_RESULT");
  const distinct = fixture();
  distinct.e0Input.candidates[1].metrics.rare.correct = 4;
  assert.equal(build(distinct).receipts[0].action, "REVIEW_E0_RESULT");
});

test("refuse unknown council seat even if the claimed repository exists", () => {
  const f = fixture();
  f.participants[2].project = "GAIA";
  f.participants[2].repository = "MichaelWave369/GypsyAI";
  assert.throws(() => build(f), /unknown participant/);
});

test("refuse wrong repository pairing and duplicate participants", () => {
  const f = fixture();
  f.participants[0].repository = "MichaelWave369/SuperPhiVessel";
  assert.throws(() => build(f), /repository identity/);
  const g = fixture();
  g.participants[1].project = "ThinkTank";
  assert.throws(() => build(g), /duplicate/);
});

test("refuse missing or overcomplete council", () => {
  const f = fixture();
  f.participants.pop();
  assert.throws(() => build(f), /exactly three/);
  const g = fixture();
  g.participants.push(g.participants[0]);
  assert.throws(() => build(g), /exactly three/);
});

test("reject SHA abbreviations, uppercase and non-hex", () => {
  for (const sourceSha of ["abcdef", "A".repeat(40), "g".repeat(40)]) {
    const f = fixture();
    f.participants[0].sourceSha = sourceSha;
    assert.throws(() => build(f), /sourceSha/);
  }
});

test("reject private and real-origin E0 attempts", () => {
  for (const [key, value] of [["privacy", "PRIVATE"], ["origin", "MEASURED"], ["authority", "VERIFIED"]]) {
    const f = fixture();
    f.e0Input[key] = value;
    assert.throws(() => build(f), /synthetic cases/);
  }
});

test("reject payload smuggling in participants and exchange input", () => {
  const f = fixture();
  f.participants[0].privatePrompt = "secret";
  assert.throws(() => build(f), /unknown or missing fields/);
  const g = fixture();
  g.rawPrompt = "secret";
  assert.throws(() => build(g), /unknown or missing fields/);
});

test("reject missing/extra E0 fields and generative source-laundering", () => {
  const f = fixture();
  f.e0Input.candidates[0].producer = "ThinkTank";
  assert.throws(() => build(f), /simulated fixture/);
  const g = fixture();
  g.e0Input.candidates[0].rawText = "untrusted source";
  assert.throws(() => build(g), /unsupported fields/);
});

test("no mode may grant human approval or run outside policy epoch", () => {
  const f = fixture();
  f.policyEpoch = 2;
  assert.throws(() => build(f), /policy epoch/);
  const g = fixture();
  g.operatorApproved = true;
  assert.throws(() => build(g), /unknown or missing fields/);
});

test("tampered claimed authority is refused, even if its digest is also modified", () => {
  const f = fixture(), x = build(f);
  const forged = structuredClone(x);
  forged.executionAuthorized = true;
  forged.exchangeSha256 = "f".repeat(64);
  assert.equal(review(f, forged).disposition, "REFUSE_MISMATCH");
  assert.equal(review(f, forged).executionAuthorized, false);
});

test("output receipts carry only categorical content and declarations", () => {
  const json = JSON.stringify(build(fixture()));
  assert.equal(json.includes("privatePrompt"), false);
  assert.equal(json.includes("rawText"), false);
  assert.equal(json.includes("modelExecuted\":true"), false);
  assert.equal(json.includes("sourceIdentity\":\"DECLARED_UNVERIFIED"), true);
});
