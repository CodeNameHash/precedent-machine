const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  requireM1VerticalSliceExecutionPermission,
} = require('../../lib/programme-gates/m1-milestone-permission');

const ACKNOWLEDGEMENT = fs.readFileSync(
  'docs/acks/M1-CONTRACT-FREEZE-2026-07-30.md',
  'utf8',
);
const BUNDLE = Object.freeze({
  bundle_id: '8c765d52d3f95ebfc21b28b5bd0e71689a095c482e113a4329d33b0140dbe83d',
  contract_bundle_digest:
    'b990bf90f98fd83b9dfcf34912ec4b3cd42c37f3e693bee9796b1c63198edc84',
  canonical_payload_digest:
    '73a9023d3ef831e7a544664929385a1aa61af1efed58139d1cd54bf5985d3ab8',
  substantive_member_count: 171,
  dependency_edge_count: 285,
  compile_status: 'PASS',
  cycle_status: 'PASS',
});

test('M1 acknowledgement opens only the exact reviewed bundle for staging', () => {
  const permission = requireM1VerticalSliceExecutionPermission({
    acknowledgement_markdown: ACKNOWLEDGEMENT,
    current_bundle: BUNDLE,
  });
  assert.equal(permission.vertical_slice_execution, 'PASS');
  assert.equal(permission.bundle_id, BUNDLE.bundle_id);
  assert.equal(permission.production_authority, 'NONE');
  assert.match(permission.m1_acknowledgement_id, /^[a-f0-9]{64}$/);
});

test('M1 permission fails closed on review, approval, bundle or graph drift', () => {
  for (const [from, to] of [
    ['- result: `PASS`', '- result: `FAIL`'],
    ['- ben_approval_result: `APPROVED`', '- ben_approval_result: `OPEN`'],
    [BUNDLE.bundle_id, 'f'.repeat(64)],
    ['- dependency_edge_count: `285`', '- dependency_edge_count: `284`'],
  ]) {
    assert.throws(
      () => requireM1VerticalSliceExecutionPermission({
        acknowledgement_markdown: ACKNOWLEDGEMENT.replace(from, to),
        current_bundle: BUNDLE,
      }),
      { code: 'M1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED' },
    );
  }
  assert.throws(
    () => requireM1VerticalSliceExecutionPermission({
      acknowledgement_markdown: ACKNOWLEDGEMENT,
      current_bundle: { ...BUNDLE, cycle_status: 'FAIL' },
    }),
    { code: 'M1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED' },
  );
});
