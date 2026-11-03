import { createHash } from "node:crypto";

// Research-only, dependency-free synthetic Keyhole comparison.
// This module never calls models, networks, agents, or other repositories.
export const SCHEMA = "nbg-pocketmesh.council-keyhole-e0.v0.1";
export const COUNCIL_ROLES = Object.freeze({
  ThinkTank: "HYPOTHESIS_CHALLENGER_CANDIDATE",
  PocketBrain: "LOCAL_OBSERVER_UI_CANDIDATE",
  Vessie: "GOVERNANCE_REVIEW_CANDIDATE",
  BrainC: "LATER_LOCAL_SPECIALIST_CANDIDATE",
  GAIA: "LATER_SYMBOLIC_IDEATION_ONLY"
});

function keys(object, exact, label) {
  if (object === null || typeof object !== "object" || Array.isArray(object)) {
    throw new TypeError(label + " must be an object");
  }
  const actual = Object.keys(object).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...exact].sort())) {
    throw new TypeError(label + " has missing or unsupported fields");
  }
}

function limitedId(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]{1,64}$/.test(value)) {
    throw new TypeError(label + " must be a bounded opaque identifier");
  }
}

function metric(value, label) {
  keys(value, ["correct", "total"], label);
  if (!Number.isSafeInteger(value.correct) || !Number.isSafeInteger(value.total) ||
      value.total < 1 || value.total > 1000000 ||
      value.correct < 0 || value.correct > value.total) {
    throw new TypeError(label + " requires integer counts with 0 <= correct <= total");
  }
}

function candidate(c, label) {
  keys(c, ["id", "producer", "origin", "authority", "metrics"], label);
  limitedId(c.id, label + ".id");
  if (c.producer !== "synthetic-fixture" || c.origin !== "SIMULATED" ||
      c.authority !== "NONE") {
    throw new TypeError(label + " must be simulated fixture data without authority");
  }
  keys(c.metrics, ["ordinary", "rare"], label + ".metrics");
  metric(c.metrics.ordinary, label + ".ordinary");
  metric(c.metrics.rare, label + ".rare");
}

// Integer cross-multiplication avoids float rounding when comparing ratios.
function equalRate(a, b) {
  return BigInt(a.correct) * BigInt(b.total) ===
    BigInt(b.correct) * BigInt(a.total);
}

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(
      key => JSON.stringify(key) + ":" + canonical(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function evaluateCouncilKeyholes(input) {
  keys(input, ["schema", "caseId", "origin", "authority", "privacy", "candidates"], "input");
  if (input.schema !== SCHEMA || input.origin !== "SIMULATED" ||
      input.authority !== "NONE" || input.privacy !== "PUBLIC_SYNTHETIC") {
    throw new TypeError("E0 accepts only public synthetic cases without authority");
  }
  limitedId(input.caseId, "caseId");
  if (!Array.isArray(input.candidates) || input.candidates.length !== 2) {
    throw new TypeError("E0 requires exactly two candidates");
  }
  const [a, b] = input.candidates;
  candidate(a, "candidate A");
  candidate(b, "candidate B");
  if (a.id === b.id) throw new TypeError("candidate identities must differ");
  for (const group of ["ordinary", "rare"]) {
    if (a.metrics[group].total !== b.metrics[group].total) {
      throw new TypeError("matched cohorts are required for each group");
    }
  }
  const totals = [a, b].map(c => ({
    correct: c.metrics.ordinary.correct + c.metrics.rare.correct,
    total: c.metrics.ordinary.total + c.metrics.rare.total
  }));
  const coarseEquivalent = equalRate(totals[0], totals[1]);
  const stratifiedEquivalent = ["ordinary", "rare"].every(group =>
    equalRate(a.metrics[group], b.metrics[group])
  );
  const record = {
    schema: SCHEMA,
    caseId: input.caseId,
    origin: "SIMULATED",
    authority: "NONE",
    executionAuthorized: false,
    shareAuthorized: false,
    independentlyVerified: false,
    candidateIds: [a.id, b.id],
    keyholes: {
      K0: { observation: "pooled accuracy", equivalent: coarseEquivalent,
        correct: totals.map(x => x.correct), total: totals[0].total },
      K1: { observation: "matched ordinary/rare subgroup accuracy",
        equivalent: stratifiedEquivalent,
        ordinaryCorrect: [a.metrics.ordinary.correct, b.metrics.ordinary.correct],
        rareCorrect: [a.metrics.rare.correct, b.metrics.rare.correct],
        ordinaryTotal: a.metrics.ordinary.total,
        rareTotal: a.metrics.rare.total }
    },
    hiddenDistinctionWitness: coarseEquivalent && !stratifiedEquivalent,
    recommendation: coarseEquivalent && !stratifiedEquivalent
      ? "REVIEW_STRATIFIED_OBSERVATION"
      : "NO_HIDDEN_DISTINCTION_ESTABLISHED",
    councilRoles: COUNCIL_ROLES,
    limitations: "No live providers, source independence, model quality, NBG-specific physics, or permission to execute"
  };
  return { ...record, receiptSha256: createHash("sha256").update(canonical(record)).digest("hex") };
}
