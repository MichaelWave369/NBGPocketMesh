import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/e1b-route.mjs', import.meta.url));
for (const domain of ['vowel-start', 'ends-s']) {
  test('E1-B local-only E0 route for ' + domain, () => {
    const run = spawnSync(process.execPath, [script, domain], {encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr);
    const decision = JSON.parse(run.stdout);
    assert.equal(decision.decision, 'ROUTE');
    assert.equal(decision.origin, 'SIMULATED');
    assert.equal(decision.authority, 'NONE');
    assert.equal(decision.task.remoteConsent, false);
    assert.equal(decision.task.privacy, 'private');
    assert.deepEqual(decision.selected.nodes, [
      domain === 'vowel-start' ? 'tooth-vowel' : 'tooth-suffix'
    ]);
    assert.match(decision.receiptSha256, /^[a-f0-9]{64}$/);
  });
}
test('unknown E1-B capability refuses', () => {
  const run = spawnSync(process.execPath,[script,'arbitrary-remote'],{encoding:'utf8'});
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
});
