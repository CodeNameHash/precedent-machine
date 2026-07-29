const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const YAML = require('yaml');
const { domainDigest } = require('../../lib/programme-gates/bytes');

const {
  MANDATORY_ADVERSARIAL_TEST_IDS,
  TEST_EXECUTABLE_DIGESTS,
  TEST_EXECUTABLE_FILES,
  testExecutableState,
} = require('../../lib/programme-gates/test-executable-registry');

const ROOT = path.resolve(__dirname, '../..');

test('gate registry is strict YAML 1.2 and bootstrap predicates use EQUALS', () => {
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
  const registry = document.toJS().programme_gate_registry;
  assert.deepEqual(registry.yaml_parser_binding, {
    yaml_version: '1.2',
    package: 'yaml',
    package_version: '2.9.0',
    options: ['STRICT', 'UNIQUE_KEYS', 'NO_ALIASES'],
  });
  assert.equal(
    registry.gate_evidence_validation.claim_ast_derivation.comparison_operator,
    'EQUALS',
  );
  const bootstrap = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'docs/codex-program/bootstrap-acceptance-source.json'),
    'utf8',
  ));
  assert.ok(bootstrap.definitions.every((definition) => (
    definition.ordered_claim_predicates.every(
      (predicate) => predicate.comparison_operator === 'EQUALS',
    )
  )));
});

test('all 289 adversarial IDs have an exact executable mapping and placeholders fail closed', () => {
  assert.equal(MANDATORY_ADVERSARIAL_TEST_IDS.length, 289);
  assert.equal(Object.keys(TEST_EXECUTABLE_FILES).length, 289);
  assert.equal(Object.keys(TEST_EXECUTABLE_DIGESTS).length, 289);
  for (const testId of MANDATORY_ADVERSARIAL_TEST_IDS) {
    const members = TEST_EXECUTABLE_FILES[testId].map((file) => {
      const bytes = fs.readFileSync(path.join(ROOT, file));
      return {
        path: file,
        byte_length: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      };
    });
    assert.equal(
      TEST_EXECUTABLE_DIGESTS[testId],
      domainDigest('PROGRAMME_GATE_TEST_EXECUTABLE_SET/V1', members),
    );
  }
  const unimplemented = MANDATORY_ADVERSARIAL_TEST_IDS.find(
    (testId) => testExecutableState(testId) === 'BOUND_FAIL_CLOSED_UNIMPLEMENTED',
  );
  assert.ok(unimplemented);
  const result = spawnSync(process.execPath, TEST_EXECUTABLE_FILES[unimplemented], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
});
