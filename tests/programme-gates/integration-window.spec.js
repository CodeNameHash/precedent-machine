const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const registry = YAML.parse(
  fs.readFileSync(path.join(ROOT, 'docs/codex-program/programme-gates.yaml'), 'utf8'),
).programme_gate_registry;
const programme = fs.readFileSync(path.join(ROOT, 'docs/CODEX-PROGRAM.md'), 'utf8');

test('routine branch, integration, deployment and ledger work needs no Ben action', () => {
  assert.equal(
    registry.routine_branch_integration_deployment_or_ledger_work_requires_ben,
    false,
  );
  assert.match(programme, /Work proceeds continuously on bounded `wp\/\*` branches/);
  assert.match(programme, /Every merge leaves\s+`main` deployable/);
});

test('only material governance and production decisions are reserved for Ben', () => {
  assert.deepEqual(registry.ben_approval_points, [
    'MATERIAL_CONTRACT_BUNDLE_FREEZE',
    'MATERIAL_TAXONOMY_OR_CODEBOOK_CHANGE',
    'PRODUCTION_IMPORT_WHERE_REQUIRED_BY_IMPORT_CONTRACT',
    'ONE_USE_PRODUCTION_CUTOVER',
  ]);
});
