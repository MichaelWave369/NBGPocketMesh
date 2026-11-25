// RM-369 E3-B: offline observation broker, not live routing authority.
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const int = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const tiles = Array.from({ length: 8 }, (_, g) => {
  let a = [[6, 1, 8], [7, 5, 3], [2, 9, 4]];
  if (g >= 4) a = a.map(row => row.slice().reverse());
  for (let i = 0; i < g % 4; i++) a = a[0].map((_, j) => a.map(row => row[j]).reverse());
  return a.flat();
});
const canonical = value => Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']'
  : value !== null && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
    : JSON.stringify(value);

function decode(snapshot) {
  must(Buffer.isBuffer(snapshot) && snapshot.length >= 8 &&
    snapshot.subarray(0, 3).equals(Buffer.from('RM1')), 'invalid RM1 header');
  const depth = snapshot[3];
  must(int(depth, 1, 64), 'invalid depth');
  const nodes = (9n ** BigInt(depth) - 1n) / 8n;
  const width = Math.max(1, Math.ceil((nodes - 1n).toString(2).length / 8));
  const count = snapshot.readUInt32BE(4);
  must(count <= 1_000_000 && BigInt(count) <= nodes &&
    snapshot.length === 8 + count * (width + 1), 'invalid RM1 count or length');
  const records = new Map();
  let previous = -1n;
  for (let offset = 8; offset < snapshot.length; offset += width + 1) {
    let key = 0n;
    for (let i = 0; i < width; i++) key = 256n * key + BigInt(snapshot[offset + i]);
    const gear = snapshot[offset + width];
    must(key > previous && key < nodes && int(gear, 1, 7), 'invalid RM1 record');
    records.set(key, gear);
    previous = key;
  }
  return { depth, records };
}

function pathId(depth, path) {
  must(Array.isArray(path) && path.length < depth &&
    Array.from(path).every(v => int(v, 0, 8)), 'invalid physical path');
  return path.reduce((key, slot) => 9n * key + 1n + BigInt(slot), 0n);
}

// Grants are externally supplied fixture policy; no authentication is implied.
// A cell probe observes the local seed digit, not a global recursive cell value.
// Direct lookup is a separately granted observation channel.
export function observeRM3(snapshot, request, grant) {
  must(request && grant && typeof request === 'object' && typeof grant === 'object',
    'request and grant required');
  must(Buffer.isBuffer(snapshot), 'invalid snapshot');
  const stateHash = sha(snapshot);
  must(request.expected_sha256 === stateHash && grant.snapshot_sha256 === stateHash,
    'stale snapshot or grant');
  const { depth, records } = decode(snapshot);
  const key = pathId(depth, request.path);
  must(pathId(depth, grant.path) === key, 'path not granted');
  must(int(request.budget, 0, 9) && int(grant.max_probes, 0, 9) &&
    request.budget <= grant.max_probes, 'budget not granted');
  must(Array.isArray(grant.cells) && Array.from(grant.cells).every(v => int(v, 0, 8)) &&
    new Set(grant.cells).size === grant.cells.length && typeof grant.direct === 'boolean',
    'invalid grant');
  const strategies = {
    center: [4], corner: [0], pair: [0, 1], full: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };
  const strategy = request.strategy;
  must(typeof strategy === 'string' &&
    (strategy === 'direct' || Object.hasOwn(strategies, strategy)), 'unknown strategy');
  const indices = strategy === 'direct' ? [] : strategies[strategy];
  const cost = strategy === 'direct' ? 1 : indices.length;
  must(cost <= request.budget, 'insufficient observation budget');
  must(strategy === 'direct' ? grant.direct : indices.every(v => grant.cells.includes(v)),
    'observation not granted');
  const hidden = records.get(key) ?? 0;
  const observations = indices.map(index => ({ index, value: tiles[hidden][index] }));
  const direct = strategy === 'direct' ? hidden : null;
  const candidates = strategy === 'direct' ? [direct] :
    tiles.map((_, g) => g).filter(g => observations.every(o => tiles[g][o.index] === o.value));
  const receipt = {
    schema: 'rm369/e3b', evidence: 'SIMULATED', authority: 'NONE',
    snapshot_sha256: stateHash, path: [...request.path], strategy,
    budget: request.budget, used: cost, remaining: request.budget - cost,
    observation_channel: strategy === 'direct' ? 'orientation' : 'local_seed_digit',
    observations, direct_orientation: direct, candidates,
    resolved_orientation: candidates.length === 1 ? candidates[0] : null,
  };
  receipt.receipt_sha256 = sha(canonical(receipt));
  return receipt;
}

export function verifyRM3(snapshot, request, grant, receipt) {
  try { return canonical(observeRM3(snapshot, request, grant)) === canonical(receipt); }
  catch { return false; }
}

// Exhaustive known-family fixture. No timings or real routing claims.
export function report() {
  const rows = [];
  for (const [strategy, budget] of [['center', 1], ['corner', 1], ['pair', 2], ['full', 9], ['direct', 1]]) {
    let resolved = 0, probes = 0, classes = new Set();
    for (let g = 0; g < 8; g++) {
      const snapshot = Buffer.from(g ? [82, 77, 49, 1, 0, 0, 0, 1, 0, g] : [82, 77, 49, 1, 0, 0, 0, 0]);
      const hash = sha(snapshot);
      const receipt = observeRM3(snapshot, { expected_sha256: hash, path: [], strategy, budget },
        { snapshot_sha256: hash, path: [], max_probes: 9, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], direct: true });
      if (receipt.resolved_orientation === g) resolved++;
      probes += receipt.used;
      classes.add(receipt.candidates.join(','));
    }
    rows.push({ strategy, resolved, cases: 8, total_probes: probes, classes: classes.size });
  }
  return { schema: 'rm369/e3b-report', evidence: 'SIMULATED', authority: 'NONE', rows };
}
