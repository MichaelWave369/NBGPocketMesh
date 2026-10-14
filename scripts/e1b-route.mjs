import { route } from '../src/router.mjs';

const selectedDomain = process.argv[2];
const ids = Object.freeze({ 'vowel-start': 'tooth-vowel', 'ends-s': 'tooth-suffix' });
if (!Object.hasOwn(ids, selectedDomain)) {
  console.error('E1-B refused: unknown capability');
  process.exit(2);
}
const manifests = Object.entries(ids).map(([capability, id]) => ({
  id, revision: 'E1B-local-v1', capabilities: [capability], inputs: ['text'],
  outputs: ['text'], transport: 'local', status: 'admitted',
  validThroughEpoch: 1, estimatedLatencyMs: 1, workingSetMiB: 1,
  lineage: 'shared-model-base', resident: true
}));
const task = {
  id: 'e1b-' + selectedDomain, capability: selectedDomain,
  input: 'text', output: 'text', privacy: 'private', remoteConsent: false,
  requiredLineages: 1, latencyBudgetMs: 5, memoryBudgetMiB: 8
};
const receipt = route(task, manifests);
if (receipt.decision !== 'ROUTE') process.exitCode = 3;
console.log(JSON.stringify(receipt));
