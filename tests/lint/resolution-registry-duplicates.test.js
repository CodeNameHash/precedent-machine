'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('resolution registry duplicate lint passes the runtime tree', () => {
  const root = path.resolve(__dirname, '..', '..');
  const run = spawnSync(process.execPath, [path.join(root, 'scripts/lint/resolution-registry-duplicates.js'), root], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /PASS/);
});

function lintFixture(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-lint-'));
  const lib = path.join(root, 'lib');
  fs.mkdirSync(lib);
  fs.writeFileSync(path.join(lib, 'fixture.js'), source);
  return spawnSync(process.execPath, [path.resolve(__dirname, '..', '..', 'scripts/lint/resolution-registry-duplicates.js'), root], { encoding: 'utf8' });
}

test('a copied party-capacity lexicon fails', () => {
  const run = lintFixture(String.raw`const PARTY_CAPACITY_SOURCE = ['\bcompany\b','\btarget\b','\bparent\b','\bpurchaser\b','\bbuyer\b','\bpubco\b','merger\s*sub','\bseller\b','\bpartnership\b'];`);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /REGISTRY_INLINE_DUPLICATE:party-capacity/);
});

test('a copied closing-condition list fails and an import passes', () => {
  const copied = lintFixture("const CLOSING_CONDITION_ASSERTION_KINDS = ['BRING_DOWN_TIER','NO_MAE_CONDITION','MAE_CONTINUING','COVENANT_COMPLIANCE','REGULATORY_APPROVAL','STOCKHOLDER_APPROVAL','LEGAL_RESTRAINT','GOVERNMENT_PROCEEDING','S4_COMPONENT','LISTING','FUNDS','OFFICER_CERTIFICATE','FRUSTRATION_CAUSATION','FRUSTRATION_BREACH','DOLLAR_THRESHOLD','BURDENSOME_CONDITION'];");
  assert.notEqual(copied.status, 0);
  assert.match(copied.stderr, /REGISTRY_INLINE_DUPLICATE:closing-condition-kinds/);
  const imported = lintFixture("const { CLOSING_CONDITION_ASSERTION_KINDS } = require('../vocab/resolution/closing-condition-kinds-registry');");
  assert.equal(imported.status, 0, imported.stderr);
});

for (const [concern, source] of [
  ['general-covenant', String.raw`const GENERAL_COVENANT_CODE_PATTERNS = { 'COV-16B': [/short-?swing\s+profit/], 'COV-ACCESS': [/contingent\s+value\s+rights/] };`],
  ['material-contract', String.raw`const MATERIAL_CONTRACT_BUCKET_META = { AGGREGATE_PAYMENTS: [], IP_LICENSES_IN: [], NONCOMPETE: [/affiliate\s+(?:transaction|agreement|contract)/] };`],
  ['interim-operating', String.raw`const CATEGORY_TESTS = { DIVIDENDS_DISTRIBUTIONS: [], ACQUISITIONS_BUSINESS_COMBINATIONS: [], OTHER_ORDINARY_COURSE: [/\bordinary\s+course\b/] };`],
  ['materiality-qualifier', String.raw`const MATERIALITY_TABLE = { MAT_ALL_RESPECTS: 1, MAT_MAE_QUALIFIED: 2, CAPITAL_STRUCTURE: 3, KNOWLEDGE_STANDARD_META: 4 };`],
  ['representation-topic', String.raw`const TOPIC_RULES = { REP_TOPIC_V1_CORPORATE_ORGANISATION: [], REP_TOPIC_V1_TAX: [], REP_TOPIC_V1_FINANCING: [], REP_TOPIC_V1_TRANSACTION_PROCESS: [] };`],
]) {
  test(`a copied ${concern} controlled vocabulary fails`, () => {
    const run = lintFixture(source);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, new RegExp(`REGISTRY_INLINE_DUPLICATE:${concern}`));
  });
}
