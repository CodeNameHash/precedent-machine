const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');

function registry() {
  const source = fs.readFileSync(
    path.join(ROOT, 'docs/codex-program/programme-gates.yaml'),
    'utf8',
  );
  const document = YAML.parseDocument(source, {
    customTags: [],
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
    version: '1.2',
  });
  assert.deepEqual(document.errors, []);
  return document.toJS().programme_gate_registry;
}

test('governance uses exactly four review milestones', () => {
  assert.deepEqual(
    registry().review_model.exact_milestones.map(({ id }) => id),
    [
      'M1_CONTRACT_FREEZE',
      'M2_VERTICAL_SLICE',
      'M3_FULL_CORPUS_CERTIFICATION',
      'M4_PRE_CUTOVER',
    ],
  );
  assert.equal(registry().review_model.additional_milestones_permitted, false);
});

test('pre-production work does not depend on signed status publication', () => {
  const value = registry();
  assert.equal(value.status_source, 'docs/codex-program/EXECUTION-LEDGER.md');
  assert.equal(value.signed_status_required_before_preproduction_work, false);
});
