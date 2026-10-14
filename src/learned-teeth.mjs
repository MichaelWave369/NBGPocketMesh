import { createHash } from 'node:crypto';
import { route } from './router.mjs';

// E1-A: tiny learned linear weights over *synthetic* 2-feature classification.
// This is NOT LoRA, an LLM, pretrained weights, or evidence of generalized gains.
export const TRAIN_AXIS = Object.freeze([-3, -2, -1, 1, 2, 3]);
export const TEST_AXIS = Object.freeze([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]);
export const DOMAINS = Object.freeze(['x-sign', 'y-sign']);
export const TRAINING = Object.freeze({ baseEpochs: 200, toothEpochs: 180, rate: 0.035 });

const sha256 = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const sigmoid = (z) => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
const dot = (w, x) => w[0] * x[0] + w[1] * x[1] + w[2] * x[2];
const add = (a, b) => a.map((v, i) => v + b[i]);
const classify = (w, features) => dot(w, features) >= 0 ? 1 : 0;
const labelFor = (domain, x, y) => domain === 'x-sign' ? Number(x > 0) : Number(y > 0);

export function dataset(split) {
  if (split !== 'train' && split !== 'holdout') throw new TypeError('Unknown dataset split');
  const axis = split === 'train' ? TRAIN_AXIS : TEST_AXIS;
  const rows = [];
  for (const x of axis) for (const y of axis) for (const domain of DOMAINS) {
    rows.push({ id: `${split}-${domain}-${x}-${y}`, domain, x, y, features: [x, y, 1], label: labelFor(domain, x, y) });
  }
  return rows;
}

function fit(samples, epochs, rate, baseWeights) {
  const delta = [0, 0, 0];
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Fixed order is deliberate: reproducible, but not a benchmark of SGD convergence.
    for (const sample of samples) {
      const active = add(baseWeights, delta);
      const residual = sample.label - sigmoid(dot(active, sample.features));
      for (let i = 0; i < delta.length; i++) delta[i] += rate * residual * sample.features[i];
    }
  }
  if (!delta.every(Number.isFinite)) throw new Error('Non-finite learned weights');
  return delta;
}

export function learn() {
  const rows = dataset('train');
  const base = fit(rows, TRAINING.baseEpochs, TRAINING.rate, [0, 0, 0]);
  const teeth = Object.fromEntries(DOMAINS.map(domain => [
    domain, fit(rows.filter(r => r.domain === domain), TRAINING.toothEpochs, TRAINING.rate, base)
  ]));
  return { base, teeth, trainingRows: rows.length, weightCount: 9 };
}

// Both specialists share the same declared family: the router MUST NOT treat them
// as independently corroborating evidence.
const manifests = Object.freeze([
  { id:'tooth-x', revision:'e1a-synthetic-v1', capabilities:['x-sign'], inputs:['text'], outputs:['text'],
    transport:'local', status:'admitted', validThroughEpoch:1, estimatedLatencyMs:1,
    workingSetMiB:1, lineage:'shared-fixture-training', resident:true },
  { id:'tooth-y', revision:'e1a-synthetic-v1', capabilities:['y-sign'], inputs:['text'], outputs:['text'],
    transport:'local', status:'admitted', validThroughEpoch:1, estimatedLatencyMs:1,
    workingSetMiB:1, lineage:'shared-fixture-training', resident:true }
]);
const nodeDomain = { 'tooth-x':'x-sign', 'tooth-y':'y-sign' };
const taskFor = (row) => ({
  id:row.id.replace(/[^a-zA-Z0-9_.-]/g, '_'), capability:row.domain === 'x-sign' ? 'x-sign' : 'y-sign',
  input:'text', output:'text', privacy:'private', remoteConsent:false, requiredLineages:1,
  latencyBudgetMs:10, memoryBudgetMiB:8
});

export function experiment() {
  const trained = learn();
  const holdout = dataset('holdout');
  const sums = Object.fromEntries(['base', 'fixed-x', 'fixed-y', 'swapped', 'routed'].map(name => [name, {correct:0,total:0}]));
  let refusals = 0;
  const routingHashes = [];
  const weight = (domain) => add(trained.base, trained.teeth[domain]);
  for (const row of holdout) {
    const decision = route(taskFor(row), manifests);
    routingHashes.push(decision.receiptSha256);
    const selectedDomain = decision.selected?.nodes?.length === 1 ? nodeDomain[decision.selected.nodes[0]] : null;
    if (decision.decision !== 'ROUTE' || selectedDomain == null) refusals++;
    const methods = {
      base: trained.base,
      'fixed-x':weight('x-sign'),
      'fixed-y':weight('y-sign'),
      swapped:weight(row.domain === 'x-sign' ? 'y-sign' : 'x-sign'),
      routed: selectedDomain == null ? null : weight(selectedDomain)
    };
    for (const [name,w] of Object.entries(methods)) {
      sums[name].total++;
      if (w != null && classify(w,row.features) === row.label) sums[name].correct++;
    }
  }
  const unsigned = {
    schema:'NBGPocketMesh.E1A.v1', origin:'SIMULATED', authority:'NONE',
    execution:'LOCAL_SYNTHETIC_NUMERICAL_TRAINING', realLLM:false,
    protocol:'docs/E1A_PROTOCOL.md',
    training:TRAINING, trainRows:trained.trainingRows, holdoutRows:holdout.length,
    trainDatasetSha256:sha256(dataset('train')), holdoutDatasetSha256:sha256(holdout),
    learnedWeightSha256:sha256({base:trained.base,teeth:trained.teeth}),
    learnedScalars:trained.weightCount,
    observations:Object.fromEntries(Object.entries(sums).map(([key,val]) => [key,{...val, accuracy:val.correct / val.total}])),
    routingRefusals:refusals, routingReceiptCollectionSha256:sha256(routingHashes),
    limitations:[
      'Linearly separable synthetic sign tasks selected by explicit capability metadata',
      'Not an LLM, LoRA adapter, transferable foundation model, or independent evidence',
      'No GPU, memory residency, data transfer, wall-clock latency or deployment measurements',
      'Fixed-domain routing can exploit information a real-world router may not possess'
    ]
  };
  return {...unsigned, receiptSha256:sha256(unsigned)};
}
