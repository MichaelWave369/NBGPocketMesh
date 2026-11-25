import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { observeRM3, verifyRM3, report } from '../src/rm369-observation.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const context = (snapshot, path = [], strategy = 'pair', budget = 2) => {
  const hash = sha(snapshot);
  return {
    request: { expected_sha256: hash, path, strategy, budget },
    grant: { snapshot_sha256: hash, path, max_probes: 9,
      cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], direct: false },
  };
};

test('exhaustive strategy comparison includes cheaper direct baseline', () => {
  assert.deepEqual(report().rows, [
    { strategy: 'center', resolved: 0, cases: 8, total_probes: 8, classes: 1 },
    { strategy: 'corner', resolved: 0, cases: 8, total_probes: 8, classes: 4 },
    { strategy: 'pair', resolved: 8, cases: 8, total_probes: 16, classes: 8 },
    { strategy: 'full', resolved: 8, cases: 8, total_probes: 72, classes: 8 },
    { strategy: 'direct', resolved: 8, cases: 8, total_probes: 8, classes: 8 },
  ]);
});

test('local observations are bounded, scoped and stale-safe', () => {
  const snapshot = Buffer.from('524d31020000000200010907', 'hex');
  const { request, grant } = context(snapshot, [8]);
  const receipt = observeRM3(snapshot, request, grant);
  assert.equal(receipt.resolved_orientation, 7);
  assert.equal(receipt.direct_orientation, null);
  assert.equal(receipt.used, 2);
  assert.deepEqual(receipt.observations.map(o => o.index), [0, 1]);
  assert.equal(verifyRM3(snapshot, request, grant, receipt), true);
  assert.equal(verifyRM3(snapshot, request, grant, { ...receipt, authority: 'GRANTED' }), false);
  assert.throws(() => observeRM3(snapshot, { ...request, strategy: 'direct' }, grant));
  assert.throws(() => observeRM3(snapshot, { ...request, budget: 1 }, grant));
  assert.throws(() => observeRM3(snapshot, request, { ...grant, cells: [0] }));
  assert.throws(() => observeRM3(snapshot, request, { ...grant, max_probes: 1 }));
  assert.throws(() => observeRM3(snapshot, request, { ...grant, path: [7] }));
  assert.throws(() => observeRM3(snapshot, { ...request, expected_sha256: '0'.repeat(64) }, grant));
  assert.throws(() => observeRM3(snapshot, request, { ...grant, snapshot_sha256: '0'.repeat(64) }));
  assert.throws(() => observeRM3(snapshot, { ...request, strategy: 'constructor' }, grant));
  const changed = Buffer.from(snapshot);
  changed[changed.length - 1] = 6;
  assert.throws(() => observeRM3(changed, request, grant));
  assert.equal(verifyRM3(changed, request, grant, receipt), false);
});

test('malformed snapshot and malformed grants refuse', () => {
  for (const hex of ['524d31020000000200000907', '524d31020000000209070001',
    '524d31020000000200010908', '524d31020000000200010007',
    '524d31020000000200010a07', '524d3102000000020001']) {
    const b = Buffer.from(hex, 'hex');
    const { request, grant } = context(b);
    assert.throws(() => observeRM3(b, request, grant));
  }
  const snapshot = Buffer.from('524d310100000000', 'hex');
  const { request, grant } = context(snapshot);
  assert.throws(() => observeRM3(snapshot, request, { ...grant, cells: [0, 0, 1] }));
  assert.throws(() => observeRM3(snapshot, request, { ...grant, direct: 'true' }));
  assert.throws(() => observeRM3(snapshot, { ...request, path: [0] }, grant));
});

test('actual pinned Altermath producer output, including depth 64',
  { skip: !process.env.RM369_ALTERMATH_PATH }, async () => {
    const { encodeRM1, executeRM2, pocketId } = await import(
      pathToFileURL(resolve(process.env.RM369_ALTERMATH_PATH, 'src/rm369-interop.mjs')).href
    );
    for (const [depth, path] of [[1, []], [12, [8, 3, 6]], [64, Array(63).fill(8)]]) {
      for (let g = 0; g < 8; g++) {
        const input = encodeRM1(depth, new Map([[pocketId(depth, path), 7]]));
        const { output } = executeRM2(input, [[path, 7], [path, g]], 2);
        const { request, grant } = context(output, path);
        const receipt = observeRM3(output, request, grant);
        assert.equal(receipt.resolved_orientation, g);
        assert.equal(verifyRM3(output, request, grant, receipt), true);
      }
    }
  });
