const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
async function load() { return import(path.join(ROOT, 'scripts/stage-2y-phase-b-sol-financing-continuation.mjs')); }
function call(beforeOpen, afterOpen, changes = []) {
  return {
    state: 'COMPLETE',
    output: { comparison: {
      before: { attempted: 0, resolved: 0, open_world: beforeOpen, review: 0 },
      after: { attempted: 0, resolved: 0, open_world: afterOpen, review: 0 },
      previously_resolved_changes: changes,
    } },
  };
}

test('open-world rise is assessed only at the completed family boundary', async () => {
  const { familyStop } = await load();
  assert.equal(familyStop([call(0, 1)], 2), null);
  assert.equal(familyStop([call(0, 1), call(1, 1)], 2), 'OPEN_WORLD_RISE');
  assert.equal(familyStop([call(0, 1), call(1, 0)], 2), null);
});

test('resolved regression stops immediately and outranks open-world rise', async () => {
  const { familyStop } = await load();
  const changes = [{ identity: 'same', kind: 'PREVIOUSLY_RESOLVED_MISSING' }];
  assert.equal(familyStop([call(0, 1, changes)], 2), 'PREVIOUSLY_RESOLVED_CHANGED');
});

test('continuation is bound to the frozen V1 stop and exactly eight Financing sections', async () => {
  const { FAMILY, initial, check } = await load(); const artifact = initial();
  assert.equal(artifact.expected_call_count, 8);
  assert.equal(artifact.calls.length, 1);
  assert.equal(artifact.source_probe.sha256, 'e8629803e242347e955a6c65fcac16316ad3fb161000bdf126c6975418bdd4a7');
  assert.ok(artifact.call_manifest.every((row) => row.family === FAMILY));
  assert.deepEqual(check(artifact), { ok: true, errors: [], status: 'READY_OR_PARTIAL' });
  const sealed = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence/canonical-v2/stage-2y-phase-b/sol-financing-continuation.json',
  ), 'utf8'));
  assert.deepEqual(check(sealed), { ok: true, errors: [], status: 'STOPPED' });
});
