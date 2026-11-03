import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import {
  COUNCIL_CONSUMER_PINS, GOLDEN_PATH, councilGoldenInput, generateCouncilGolden
} from "./council-e1-golden.mjs";
import { buildCouncilEvidenceExchange } from "../src/council-e1.mjs";

// The three sources are checked out independently by the *read-only*
// pull_request workflow at exact reviewed merge SHAs. This script has
// no API credentials, model calls, uploads, network requests or writes.
const root = resolve(".council-interop");
const paths = {
  ThinkTank: join(root,"thinktank","scripts","pocketmesh-e1-consumer.mjs"),
  PocketBrain: join(root,"pocketbrain","src","research","councilE1.ts"),
  Vessie: join(root,"vessie","packages","vessie-local-console","ui","council-review.mjs")
};

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ":" + canonical(value[k])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}
function hash(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function resign(value) {
  for (const rec of value.receipts) {
    const { receiptSha256: ignored, ...unsigned } = rec;
    rec.receiptSha256 = hash(unsigned);
  }
  const { exchangeSha256: ignored, ...unsigned } = value;
  value.exchangeSha256 = hash(unsigned);
  return value;
}
async function loadConsumers() {
  const t = await import(pathToFileURL(paths.ThinkTank).href);
  const v = await import(pathToFileURL(paths.Vessie).href);
  const requirePocketBrain = createRequire(
    join(root,"pocketbrain","package.json")
  );
  const ts = requirePocketBrain("typescript");
  const source = readFileSync(paths.PocketBrain, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext
    }
  }).outputText;
  const pocket = await import("data:text/javascript;base64," +
    Buffer.from(javascript).toString("base64"));
  return {
    ThinkTank: t.reviewPocketMeshE1,
    PocketBrain: pocket.inspectCouncilE1,
    Vessie: v.inspectVessieCouncilE1
  };
}

const consumers = await loadConsumers();
const cases = [
  { label: "golden", payload: generateCouncilGolden(), expectedWitness: true },
  { label: "null", payload: buildCouncilEvidenceExchange(
    councilGoldenInput({sameSubgroups:true})), expectedWitness: false }
];

test("producer fixture is the byte-exact reviewed JSON, not another invented fixture", () => {
  assert.equal(readFileSync(GOLDEN_PATH,"utf8"),
    JSON.stringify(cases[0].payload,null,2)+"\n");
  const sourceShas = cases[0].payload.receipts.map(x => x.sourceSha);
  assert.deepEqual(sourceShas, [
    COUNCIL_CONSUMER_PINS.ThinkTank,
    COUNCIL_CONSUMER_PINS.PocketBrain,
    COUNCIL_CONSUMER_PINS.Vessie
  ]);
});

for (const {label, payload, expectedWitness} of cases) {
  test("all three actual consumers accept producer-generated " + label +
       " packet, as review-only", async () => {
    const results = await Promise.all([
      consumers.ThinkTank(structuredClone(payload)),
      consumers.PocketBrain(structuredClone(payload)),
      consumers.Vessie(structuredClone(payload))
    ]);
    assert.deepEqual(results.map(x => x.disposition),
      Array(3).fill("HELD_UNTRUSTED_REVIEW_ONLY"));
    assert.equal(results[0].hypothesisChallengeSuggested,expectedWitness);
    assert.equal(results[1].distinctionSuggested,expectedWitness);
    assert.equal(results[2].keyholeContrastSuggested,expectedWitness);
    assert.equal(results[0].sourceAuthenticated,false);
    assert.equal(results[1].sourceAuthenticated,false);
    assert.equal(results[2].sourceAuthenticated,false);
    assert.equal(results[0].scientificEvidence,false);
    assert.equal(results[1].verifiedScience,false);
    assert.equal(results[2].scientificEvidence,false);
    assert.equal(results[0].executionAuthorized,false);
    assert.equal(results[1].executionAuthorized,false);
    assert.equal(results[2].executionAuthorized,false);
  });
}

for (const project of ["ThinkTank", "PocketBrain", "Vessie"]) {
  const consumer=consumers[project];
  test(project + " refuses tampered producer receipt", async () => {
    const tampered=structuredClone(cases[0].payload);
    tampered.receipts[0].sourceSha="f".repeat(40);
    await assert.rejects(async () => consumer(tampered));
  });
  test(project + " refuses recomputed forged approval", async () => {
    const forged=structuredClone(cases[0].payload);
    forged.executionAuthorized=true;
    resign(forged);
    await assert.rejects(async () => consumer(forged));
  });
  test(project + " refuses injected private prompt", async () => {
    const injected=structuredClone(cases[0].payload);
    injected.receipts[0].prompt="REJECT_PRIVATE_PAYLOAD";
    resign(injected);
    await assert.rejects(async () => consumer(injected));
  });
  test(project + " never mistakes a fabricated but consistent source for authentication", async () => {
    const fabricated=structuredClone(cases[0].payload);
    for(const rec of fabricated.receipts)rec.sourceSha="b".repeat(40);
    resign(fabricated);
    const result=await consumer(fabricated);
    assert.equal(result.disposition,"HELD_UNTRUSTED_REVIEW_ONLY");
    assert.equal(result.sourceAuthenticated,false);
  });
}
