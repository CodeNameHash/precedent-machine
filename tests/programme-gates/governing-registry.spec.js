const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('the ledger is the human-readable current-state source', () => {
  assert.equal(registry.status_source, 'docs/codex-program/EXECUTION-LEDGER.md');
  assert.equal(registry.status_format, 'HUMAN_READABLE_MARKDOWN_TABLE');
  assert.equal(registry.default_state, 'OPEN');
  assert.deepEqual(
    registry.allowed_states,
    ['OPEN', 'PASS', 'FAIL', 'BLOCKED', 'DEFERRED_POST_CUTOVER'],
  );
});

test('current work classes permit bounded work but keep import and cutover closed', () => {
  assert.equal(registry.work_classes.canonical_work_start.state, 'PASS');
  assert.equal(registry.work_classes.vertical_slice_execution.state, 'OPEN');
  assert.equal(registry.work_classes.production_import.state, 'OPEN');
  assert.equal(registry.work_classes.production_cutover.state, 'OPEN');
  assert.equal(registry.work_classes.security_hardening.state, 'DEFERRED_POST_CUTOVER');
});
