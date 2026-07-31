const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  requireM1VerticalSliceExecutionPermission,
} = require('../../lib/programme-gates/m1-milestone-permission');

const ACKNOWLEDGEMENT = fs.readFileSync(
  'docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md',
  'utf8',
);
const PREDECESSOR_ACKNOWLEDGEMENT = fs.readFileSync(
  'docs/acks/M1-CONTRACT-FREEZE-2026-07-31.md',
  'utf8',
);
const BUNDLE = Object.freeze({
  bundle_id: '901d45871b90d0677dd3fdfa6b718cba1795c5393cbbe91412e05e9ea3f7bd76',
  contract_bundle_digest:
    '3b24070932af4ed946eb72b41fbaf9d9e77dd0eaa191af4dedbaeb7fe3f8f632',
  canonical_payload_digest:
    'b8c1d79b6f8e9e7d403246804d52f10c5b6976a8928ce7bb95ae6a3687045a9d',
  substantive_member_count: 178,
  dependency_edge_count: 324,
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
    ['- dependency_edge_count: `324`', '- dependency_edge_count: `323`'],
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

test('a predecessor acknowledgement cannot authorise a successor bundle', () => {
  assert.throws(
    () => requireM1VerticalSliceExecutionPermission({
      acknowledgement_markdown: PREDECESSOR_ACKNOWLEDGEMENT,
      current_bundle: BUNDLE,
    }),
    { code: 'M1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED' },
  );
  for (const currentBundle of [
    {
      ...BUNDLE,
      bundle_id: '1'.repeat(64),
      substantive_member_count: BUNDLE.substantive_member_count + 3,
      dependency_edge_count: BUNDLE.dependency_edge_count + 18,
    },
    {
      ...BUNDLE,
      contract_bundle_digest: '2'.repeat(64),
      substantive_member_count: BUNDLE.substantive_member_count + 3,
      dependency_edge_count: BUNDLE.dependency_edge_count + 18,
    },
    {
      ...BUNDLE,
      canonical_payload_digest: '3'.repeat(64),
      substantive_member_count: BUNDLE.substantive_member_count + 3,
      dependency_edge_count: BUNDLE.dependency_edge_count + 18,
    },
  ]) {
    assert.throws(
      () => requireM1VerticalSliceExecutionPermission({
        acknowledgement_markdown: ACKNOWLEDGEMENT,
        current_bundle: currentBundle,
      }),
      { code: 'M1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED' },
    );
  }
});

test('the Metsera staging runner compiles the current root before staging', () => {
  const source = fs.readFileSync(
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'utf8',
  );
  assert.match(source, /compileCanonicalContractInput/);
  assert.match(source, /assembleCanonicalContractBundleCurrentRootProposal/);
  assert.match(source, /compileCanonicalContractBundle/);
  assert.doesNotMatch(source, /const M1_BUNDLE/);
  assert.ok(
    source.indexOf('const m1Permission = currentM1Permission();')
      < source.indexOf('createCanonicalV2StagingRuntime({'),
  );
});
