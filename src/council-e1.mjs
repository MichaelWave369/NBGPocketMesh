import { createHash } from "node:crypto";
import { evaluateCouncilKeyholes, SCHEMA as E0_SCHEMA } from "./council-e0.mjs";

// E1 is a local, deterministic *exchange contract*, not a network adapter.
// Project source revisions are operator-declared and NEVER independently attested.
export const COUNCIL_E1_SCHEMA = "nbg-pocketmesh.council-evidence-exchange-e1.v0.1";
export const COUNCIL_PROJECTS = Object.freeze([
  Object.freeze({
    project: "ThinkTank", repository: "MichaelWave369/think-tank",
    role: "HYPOTHESIS_CHALLENGER", tier: "HYPOTHESIS_ONLY"
  }),
  Object.freeze({
    project: "PocketBrain", repository: "MichaelWave369/PocketBrain",
    role: "LOCAL_OBSERVER", tier: "DISPLAY_ONLY"
  }),
  Object.freeze({
    project: "Vessie", repository: "MichaelWave369/SuperPhiVessel",
    role: "GOVERNANCE_REVIEWER", tier: "REVIEW_ONLY"
  })
]);

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(label + ": expected plain object");
  }
  const a = JSON.stringify(Object.keys(value).sort());
  const b = JSON.stringify([...expected].sort());
  if (a !== b) throw new TypeError(label + ": unknown or missing fields");
}

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort()
      .map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function parseParticipants(participants) {
  if (!Array.isArray(participants) || participants.length !== COUNCIL_PROJECTS.length) {
    throw new TypeError("exactly three declared participant descriptors required");
  }
  const seen = new Map();
  for (const entry of participants) {
    exactKeys(entry, ["project", "repository", "sourceSha"], "participant");
    if (typeof entry.project !== "string" || seen.has(entry.project)) {
      throw new TypeError("duplicate or malformed participant");
    }
    const known = COUNCIL_PROJECTS.find(x => x.project === entry.project);
    if (!known || entry.repository !== known.repository) {
      throw new TypeError("unknown participant or repository identity");
    }
    if (typeof entry.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(entry.sourceSha)) {
      throw new TypeError("sourceSha must be a full lowercase git SHA; source is not attested");
    }
    seen.set(entry.project, { ...entry, role: known.role, tier: known.tier });
  }
  if (seen.size !== COUNCIL_PROJECTS.length) throw new TypeError("missing council participant");
  return COUNCIL_PROJECTS.map(x => seen.get(x.project));
}

function action(project, witness) {
  if (project === "Vessie") return "HOLD_FOR_OPERATOR_REVIEW";
  if (project === "PocketBrain") return witness ? "DISPLAY_K0_K1_CONTRAST" : "DISPLAY_E0_RESULT";
  return witness ? "CHALLENGE_AGGREGATE_EQUIVALENCE" : "REVIEW_E0_RESULT";
}

export function buildCouncilEvidenceExchange(input) {
  exactKeys(input, ["e0Input", "participants", "policyEpoch"], "exchange input");
  if (input.policyEpoch !== 1) throw new TypeError("unsupported policy epoch");
  const participants = parseParticipants(input.participants);
  // E0 refuses any extra prompt, real-observation or authority fields itself.
  const e0 = evaluateCouncilKeyholes(input.e0Input);
  if (e0.schema !== E0_SCHEMA || e0.origin !== "SIMULATED" ||
      e0.authority !== "NONE") {
    throw new TypeError("E0 contract mismatch");
  }
  if (input.e0Input.privacy !== "PUBLIC_SYNTHETIC") {
    throw new TypeError("private exchange prohibited");
  }

  const receipts = participants.map(p => {
    const rec = {
      schema: COUNCIL_E1_SCHEMA,
      caseId: e0.caseId,
      participant: p.project,
      repository: p.repository,
      sourceSha: p.sourceSha,
      sourceIdentity: "DECLARED_UNVERIFIED",
      role: p.role,
      claimTier: p.tier,
      action: action(p.project, e0.hiddenDistinctionWitness),
      parentE0Sha256: e0.receiptSha256,
      origin: "SIMULATED",
      privacy: "PUBLIC_SYNTHETIC",
      authority: "NONE",
      modelExecuted: false,
      operatorApproved: false,
      evidenceAuthenticated: false,
      transportPerformed: false,
      interpretation: "Synthetic contract output; no scientific corroboration"
    };
    return { ...rec, receiptSha256: sha256(rec) };
  });
  const exchange = {
    schema: COUNCIL_E1_SCHEMA,
    policyEpoch: 1,
    caseId: e0.caseId,
    e0Schema: E0_SCHEMA,
    e0ReceiptSha256: e0.receiptSha256,
    origin: "SIMULATED",
    privacy: "PUBLIC_SYNTHETIC",
    authority: "NONE",
    state: "HELD_FOR_OPERATOR_REVIEW",
    sourceProvenance: "DECLARED_UNVERIFIED",
    independentEvidence: false,
    executionAuthorized: false,
    mergeAuthorized: false,
    sharingAuthorized: false,
    externalCalls: 0,
    receipts
  };
  return { ...exchange, exchangeSha256: sha256(exchange) };
}

// Match against the known expected shape, rather than recursively serializing
// arbitrary untrusted objects (including cycles, very deep trees, or prototypes).
function exactReplay(expected, actual) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length &&
      expected.every((value, index) => exactReplay(value, actual[index]));
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual) ||
        Object.getPrototypeOf(actual) !== Object.prototype) return false;
    const keys = Object.keys(expected).sort();
    if (JSON.stringify(keys) !== JSON.stringify(Object.keys(actual).sort())) return false;
    return keys.every(key => exactReplay(expected[key], actual[key]));
  }
  return Object.is(expected, actual);
}

// The review verifies exact deterministic replay, not GitHub source provenance,
// signatures, participant existence, real inference, or correctness of claims.
export function reviewCouncilEvidenceExchange(input, claimedExchange) {
  const expected = buildCouncilEvidenceExchange(input);
  const integrityMatches = exactReplay(expected, claimedExchange);
  return {
    schema: COUNCIL_E1_SCHEMA,
    integrityMatches,
    disposition: integrityMatches ? "REPLAY_MATCH_REVIEW_ONLY" : "REFUSE_MISMATCH",
    provenanceAuthenticated: false,
    executionAuthorized: false,
    shareAuthorized: false,
    sourceIndependent: false,
    scientificEvidence: false
  };
}
