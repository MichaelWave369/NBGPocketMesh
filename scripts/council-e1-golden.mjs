import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { evaluateCouncilKeyholes, SCHEMA as E0_SCHEMA } from "../src/council-e0.mjs";
import { buildCouncilEvidenceExchange, reviewCouncilEvidenceExchange } from "../src/council-e1.mjs";

// These SHAs identify reviewed, merged consumer implementations; the E1 packet
// intentionally labels sourceIdentity DECLARED_UNVERIFIED. The SHA strings are
// NOT signatures or proof that an external source participated in the run.
export const COUNCIL_CONSUMER_PINS = Object.freeze({
  ThinkTank: "b0180823ba0c7ffe0842cb0c1999497226ba1d9d",
  PocketBrain: "30c6a2b1acbddf20a0c968aba145f7c85c1a6632",
  Vessie: "8acc84e517a4acf217aba27fccf4232615fc33dd"
});

export const GOLDEN_PATH = fileURLToPath(
  new URL("../tests/fixtures/council-e1-source-golden.json", import.meta.url)
);

export function councilGoldenInput({ sameSubgroups = false } = {}) {
  const first = {
    ordinary: { correct: 95, total: 95 },
    rare: { correct: 0, total: 5 }
  };
  const second = sameSubgroups
    ? structuredClone(first)
    : {
        ordinary: { correct: 90, total: 95 },
        rare: { correct: 5, total: 5 }
      };
  return {
    policyEpoch: 1,
    e0Input: {
      schema: E0_SCHEMA,
      caseId: "fleet-interop-synthetic-001",
      origin: "SIMULATED",
      authority: "NONE",
      privacy: "PUBLIC_SYNTHETIC",
      candidates: [
        { id: "CandidateA", producer: "synthetic-fixture",
          origin: "SIMULATED", authority: "NONE", metrics: first },
        { id: "CandidateB", producer: "synthetic-fixture",
          origin: "SIMULATED", authority: "NONE", metrics: second }
      ]
    },
    participants: [
      { project: "ThinkTank", repository: "MichaelWave369/think-tank",
        sourceSha: COUNCIL_CONSUMER_PINS.ThinkTank },
      { project: "PocketBrain", repository: "MichaelWave369/PocketBrain",
        sourceSha: COUNCIL_CONSUMER_PINS.PocketBrain },
      { project: "Vessie", repository: "MichaelWave369/SuperPhiVessel",
        sourceSha: COUNCIL_CONSUMER_PINS.Vessie }
    ]
  };
}

export function generateCouncilGolden() {
  const input = councilGoldenInput();
  const e0 = evaluateCouncilKeyholes(input.e0Input);
  if (!e0.hiddenDistinctionWitness || !e0.keyholes.K0.equivalent ||
      e0.keyholes.K1.equivalent) {
    throw new Error("GOLDEN_E0_WITNESS_REQUIRED");
  }
  const generated = buildCouncilEvidenceExchange(input);
  const replay = reviewCouncilEvidenceExchange(input, generated);
  if (!replay.integrityMatches || replay.executionAuthorized ||
      replay.provenanceAuthenticated || replay.scientificEvidence) {
    throw new Error("GOLDEN_SOURCE_REPLAY_REFUSED");
  }
  return generated;
}

export function goldenJson() {
  return JSON.stringify(generateCouncilGolden(), null, 2) + "\n";
}

// No user-controlled paths. Generation requires a deliberate explicit command.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flag = process.argv[2];
  if (process.argv.length !== 3 || !["--verify", "--write", "--stdout"].includes(flag)) {
    console.error("Use --verify, --write or --stdout (fixed public-synthetic fixture only)");
    process.exitCode = 2;
  } else if (flag === "--stdout") {
    process.stdout.write(goldenJson());
  } else if (flag === "--write") {
    writeFileSync(GOLDEN_PATH, goldenJson(), { encoding: "utf8", flag: "w" });
    console.log("PUBLIC_SYNTHETIC_E1_GOLDEN_WRITTEN");
  } else if (readFileSync(GOLDEN_PATH, "utf8") !== goldenJson()) {
    console.error("COUNCIL_GOLDEN_DRIFT: producer output differs from reviewed fixture");
    process.exitCode = 1;
  } else {
    console.log("COUNCIL_GOLDEN_EXACT_PRODUCER_REPLAY_PASS");
  }
}
