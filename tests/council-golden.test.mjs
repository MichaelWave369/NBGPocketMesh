import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COUNCIL_CONSUMER_PINS, GOLDEN_PATH,
  councilGoldenInput, generateCouncilGolden, goldenJson
} from "../scripts/council-e1-golden.mjs";
import { buildCouncilEvidenceExchange, reviewCouncilEvidenceExchange } from "../src/council-e1.mjs";

test("frozen E1 JSON is byte-exact replay from the real E0/E1 producer code", () => {
  const onDisk = readFileSync(GOLDEN_PATH, "utf8");
  assert.equal(onDisk, goldenJson());
  const packet = JSON.parse(onDisk);
  assert.deepEqual(packet, generateCouncilGolden());
  assert.equal(packet.caseId, "fleet-interop-synthetic-001");
  assert.equal(packet.receipts.length, 3);
  assert.equal(packet.receipts[0].action, "CHALLENGE_AGGREGATE_EQUIVALENCE");
  assert.equal(packet.receipts[1].action, "DISPLAY_K0_K1_CONTRAST");
  assert.equal(packet.receipts[2].action, "HOLD_FOR_OPERATOR_REVIEW");
});

test("golden declares exactly three full source revisions, never attests them", () => {
  const packet = generateCouncilGolden();
  for (const receipt of packet.receipts) {
    assert.match(receipt.sourceSha, /^[a-f0-9]{40}$/);
    assert.equal(receipt.sourceIdentity, "DECLARED_UNVERIFIED");
    assert.equal(receipt.evidenceAuthenticated, false);
    assert.equal(receipt.operatorApproved, false);
    assert.equal(receipt.modelExecuted, false);
    assert.equal(receipt.transportPerformed, false);
  }
  assert.deepEqual(
    packet.receipts.map(r => r.sourceSha),
    [
      COUNCIL_CONSUMER_PINS.ThinkTank,
      COUNCIL_CONSUMER_PINS.PocketBrain,
      COUNCIL_CONSUMER_PINS.Vessie
    ]
  );
});

test("matching producer replay never provides execution, merge, share or science authority", () => {
  const input = councilGoldenInput();
  const packet = generateCouncilGolden();
  const result = reviewCouncilEvidenceExchange(input, packet);
  assert.equal(result.integrityMatches, true);
  for (const flag of ["provenanceAuthenticated", "executionAuthorized",
    "shareAuthorized", "sourceIndependent", "scientificEvidence"]) {
    assert.equal(result[flag], false);
  }
  for (const flag of ["executionAuthorized", "mergeAuthorized",
    "sharingAuthorized", "independentEvidence"]) {
    assert.equal(packet[flag], false);
  }
});

test("negative-control E0 with identical strata never claims hidden witness", () => {
  const negative = buildCouncilEvidenceExchange(councilGoldenInput({sameSubgroups:true}));
  assert.equal(negative.receipts[0].action, "REVIEW_E0_RESULT");
  assert.equal(negative.receipts[1].action, "DISPLAY_E0_RESULT");
  assert.equal(negative.receipts[2].action, "HOLD_FOR_OPERATOR_REVIEW");
  assert.notEqual(negative.exchangeSha256, generateCouncilGolden().exchangeSha256);
});

test("mutating cohort, source revision or approval fails exact producer replay", () => {
  const packet = generateCouncilGolden();
  const drift = structuredClone(packet);
  drift.receipts[1].sourceSha = "f".repeat(40);
  assert.equal(reviewCouncilEvidenceExchange(councilGoldenInput(), drift).integrityMatches, false);
  const forged = structuredClone(packet);
  forged.executionAuthorized = true;
  assert.equal(reviewCouncilEvidenceExchange(councilGoldenInput(), forged).integrityMatches, false);
  const changedInput = councilGoldenInput();
  changedInput.e0Input.candidates[1].metrics.ordinary.correct = 89;
  assert.equal(reviewCouncilEvidenceExchange(changedInput, packet).integrityMatches, false);
});
