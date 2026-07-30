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

test('vertical-slice execution opens only after M1 and exact bundle approval', () => {
  assert.equal(registry.work_classes.vertical_slice_execution.state, 'OPEN');
  assert.equal(
    registry.work_classes.vertical_slice_execution.opens_when,
    'M1_CONTRACT_FREEZE_PASS_AND_BEN_BUNDLE_APPROVAL',
  );
});

test('pilot completion requires both real slices and M2 review', () => {
  const gate = registry.preproduction_gates.find(
    ({ id }) => id === 'P1_VERTICAL_SLICE_PASS',
  );
  assert.deepEqual(gate, {
    id: 'P1_VERTICAL_SLICE_PASS',
    state: 'OPEN',
    acceptance: [
      'QXO_AGREEMENT_CONTROL_SLICE_PASS',
      'METSERA_PROCESS_SLICE_PASS',
      'M2_ACK_PASS',
    ],
  });
});
