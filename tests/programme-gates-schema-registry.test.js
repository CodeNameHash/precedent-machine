const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('production import and cutover retain the complete strict control set', () => {
  assert.deepEqual(registry.production_import_and_cutover, {
    strictness: 'UNCHANGED',
    required_controls: [
      'EXACT_BUNDLE_DIGEST_VERIFICATION',
      'COMPLETE_MEMBER_PARITY',
      'CHECKPOINTED_RESUMABLE_IMPORT',
      'IMPORT_CHECKPOINT_REPLAY_NO_OP',
      'CONFLICTING_REPLAY_FAILS_CLOSED',
      'ATOMIC_WHOLE_TUPLE_ACTIVATION',
      'POST_CUTOVER_SMOKE_WITH_ROLLBACK',
      'ONE_USE_BEN_CUTOVER_AUTHORISATION',
      'P9_SECURITY_AUTH_PASS_BEFORE_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE',
    ],
  });
});

test('Ben retains the exact material approval points', () => {
  assert.deepEqual(registry.ben_approval_points, [
    'MATERIAL_CONTRACT_BUNDLE_FREEZE',
    'MATERIAL_TAXONOMY_OR_CODEBOOK_CHANGE',
    'PRODUCTION_IMPORT_WHERE_REQUIRED_BY_IMPORT_CONTRACT',
    'ONE_USE_PRODUCTION_CUTOVER',
  ]);
});
