import { createHash } from 'node:crypto';

export const SCHEMA = 'NBGPocketMesh.E0.v1';
export const EPOCH = 1;

const modalities = new Set(['text', 'image', 'audio', 'spatial']);
const privacyLevels = new Set(['public', 'private']);
const transports = new Set(['local', 'remote']);
const stable = (obj) => JSON.stringify(obj, (_, v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]));
  }
  return v;
});
const sha = (obj) => createHash('sha256').update(stable(obj)).digest('hex');
const isPlain = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const uint = (v) => Number.isSafeInteger(v) && v >= 0;
const posint = (v) => Number.isSafeInteger(v) && v > 0;
const token = (v) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(v);
const listOfTokens = (v) => Array.isArray(v) && v.length > 0 && v.length <= 12 && v.every(token) && new Set(v).size === v.length;
const allowedKeys = (v, keys) => Object.keys(v).every(key => keys.includes(key));

function validateTask(task) {
  if (!isPlain(task) || !allowedKeys(task, ['id','capability','input','output','privacy','remoteConsent','requiredLineages','latencyBudgetMs','memoryBudgetMiB']) ||
      !token(task.id) || !token(task.capability) || !modalities.has(task.input) || !modalities.has(task.output) ||
      !privacyLevels.has(task.privacy) || typeof task.remoteConsent !== 'boolean' ||
      ![1,2].includes(task.requiredLineages) || !posint(task.latencyBudgetMs) || !posint(task.memoryBudgetMiB)) {
    throw new TypeError('Invalid E0 task contract');
  }
}

function validateManifest(m) {
  if (!isPlain(m) || !allowedKeys(m, ['id','revision','capabilities','inputs','outputs','transport','status','validThroughEpoch','estimatedLatencyMs','workingSetMiB','lineage','resident']) ||
      !token(m.id) || !token(m.revision) || !listOfTokens(m.capabilities) || !listOfTokens(m.inputs) || !listOfTokens(m.outputs) ||
      !m.inputs.every(x=>modalities.has(x)) || !m.outputs.every(x=>modalities.has(x)) ||
      !transports.has(m.transport) || !['admitted','revoked'].includes(m.status) ||
      !uint(m.validThroughEpoch) || !posint(m.estimatedLatencyMs) || !posint(m.workingSetMiB) ||
      !token(m.lineage) || typeof m.resident !== 'boolean') return false;
  return true;
}

function denyReason(task, m) {
  if (!validateManifest(m)) return 'INVALID_MANIFEST';
  if (m.status !== 'admitted') return 'NOT_ADMITTED';
  if (m.validThroughEpoch < EPOCH) return 'STALE_MANIFEST';
  if (!m.capabilities.includes(task.capability)) return 'MISSING_CAPABILITY';
  if (!m.inputs.includes(task.input) || !m.outputs.includes(task.output)) return 'INCOMPATIBLE_INTERFACE';
  if (m.transport === 'remote' && (!task.remoteConsent || task.privacy !== 'public')) return 'REMOTE_NOT_AUTHORIZED';
  if (m.estimatedLatencyMs > task.latencyBudgetMs) return 'LATENCY_BUDGET';
  if ((m.resident ? 0 : m.workingSetMiB) > task.memoryBudgetMiB) return 'MEMORY_BUDGET';
  return null;
}

// Routing only; never loads models, calls networks, executes tools, or evaluates supplied code.
export function route(task, manifests) {
  validateTask(task);
  if (!Array.isArray(manifests) || manifests.length > 32 || !manifests.every(isPlain)) {
    throw new TypeError('Expected at most 32 E0 manifest objects');
  }
  const names = manifests.map(m => m.id);
  if (names.some(n => !token(n)) || new Set(names).size !== names.length) {
    throw new TypeError('Manifest IDs must be valid and unique');
  }
  const excluded = [];
  const eligible = [];
  for (const m of [...manifests].sort((a,b)=>a.id.localeCompare(b.id,'en'))) {
    const reason = denyReason(task, m);
    if (reason) excluded.push({ id: m.id, reason });
    else eligible.push(m);
  }
  const paths = [];
  for (let i=0; i<eligible.length; i++) {
    for (let j=i; j<eligible.length; j++) {
      if (j===i && task.requiredLineages===2) continue;
      if (j>i && task.requiredLineages===1) continue;
      const pair = j===i ? [eligible[i]] : [eligible[i],eligible[j]];
      if (new Set(pair.map(m=>m.lineage)).size !== task.requiredLineages) continue;
      const latencyMs = pair.reduce((s,m)=>s+m.estimatedLatencyMs,0); // serial execution assumption
      const additionalMemoryMiB = pair.reduce((s,m)=>s+(m.resident ? 0 : m.workingSetMiB),0); // conservative sum
      if (latencyMs > task.latencyBudgetMs || additionalMemoryMiB > task.memoryBudgetMiB) continue;
      paths.push({ nodes:pair.map(m=>m.id), lineages:pair.map(m=>m.lineage), latencyMs, additionalMemoryMiB });
    }
  }
  paths.sort((a,b)=>a.additionalMemoryMiB-b.additionalMemoryMiB || a.latencyMs-b.latencyMs || a.nodes.join('|').localeCompare(b.nodes.join('|'),'en'));
  const selected = paths[0] ?? null;
  const decision = selected ? 'ROUTE' : 'REFUSE';
  const reason = selected ? 'COMPATIBLE_PATH' : (eligible.length > 0 ? 'NO_PATH_WITHIN_BUDGET_OR_DISTINCT_LINEAGE' : 'NO_ELIGIBLE_NODE');
  // Receipts contain only validated routing metadata, not user prompts or image contents.
  const unsigned = {
    schema:SCHEMA, origin:'SIMULATED', authority:'NONE', policyEpoch:EPOCH,
    task, manifestDigest: sha([...manifests].sort((a,b)=>a.id.localeCompare(b.id,'en'))),
    decision, reason, selected, excluded
  };
  return { ...unsigned, receiptSha256: sha(unsigned) };
}

export function verifyReceipt(receipt, task, manifests) {
  if (!isPlain(receipt)) return false;
  const expected = route(task, manifests);
  return stable(receipt) === stable(expected);
}
