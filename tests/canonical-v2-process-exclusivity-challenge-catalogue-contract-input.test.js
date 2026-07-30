const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');
const {
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST,
  validateAuthoredProcessPredicateInputs,
} = require('../lib/canonical-v2/process-predicate-contract-input-validator');
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const CATALOGUE_PATH = path.join(
  ROOT,
  'process/predicates/exclusivity-completeness-challenge-catalogue.v1.json',
);
const RECONCILIATION_PATH = path.join(
  __dirname,
  '../evidence/process-intelligence/freeze/exclusivity-question-reconciliation.v1.json',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  return { object_kind: canonicalValue.object_kind, canonical_value: canonicalValue };
}

function members() {
  return [
    loadMember('process/predicates/exclusivity-completeness-challenge-catalogue.v1.json'),
    loadMember('process/predicates/exclusivity-completeness-challenge-protocol.v1.json'),
    loadMember('process/predicates/exclusivity-predicate-catalogue.v2.json'),
  ];
}

function processMembers() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  return [
    ...manifest.members
      .filter((entry) => fs.existsSync(path.join(ROOT, entry.relative_path)))
      .map((entry) => loadMember(entry.relative_path))
      .filter((member) => member.object_kind.startsWith('PROCESS_')),
    loadMember('process/occurrence-slots/process-event.v1.json'),
    loadMember('process/predicates/exclusivity-completeness-challenge-catalogue.v1.json'),
    loadMember('process/registries/process-controlled-code-registry.v1.json'),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalogue(values) {
  return values.find((member) => member.canonical_value.object_kind
    === 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE').canonical_value;
}

test('validates the exact sealed challenge catalogue and its reconciliation binding', () => {
  const values = members();
  const value = catalogue(values);
  const reconciliation = JSON.parse(fs.readFileSync(RECONCILIATION_PATH, 'utf8'));

  assert.doesNotThrow(() => validateAuthoredProcessPredicateInputs(values));
  assert.equal(value.challenge_questions.length, 48);
  assert.equal(value.challenge_questions.flatMap((question) => question.answer_slots).length, 190);
  assert.equal(
    reconciliation.deterministic_content_digest,
    `sha256:${PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST}`,
  );
  assert.equal(
    reconciliation.source_bindings.challenge_catalogue.declared_sealed_catalogue_digest,
    value.sealed_catalogue_digest,
  );
  assert.equal(
    `sha256:${sha256Hex(Buffer.from(canonicalJson(Object.fromEntries(
      Object.entries(reconciliation).filter(([key]) => key !== 'deterministic_content_digest'),
    )), 'utf8'))}`,
    reconciliation.deterministic_content_digest,
  );
});

test('admits the exact catalogue object kind through the Process input validator', () => {
  assert.doesNotThrow(() => validateAuthoredProcessInputs(processMembers()));
});

test('fails closed for unknown, missing, duplicated, reordered, near and mutated catalogue content', () => {
  const mutations = [
    (value) => { value.unrecognised = true; },
    (value) => { delete value.known_limits; },
    (value) => { value.challenge_questions[1].challenge_question_id = value.challenge_questions[0].challenge_question_id; },
    (value) => { value.challenge_questions.reverse(); },
    (value) => { value.object_kind = 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOG/V1'; },
    (value) => { value.challenge_questions[0].answer_slots[0].answer_meaning += ' '; },
  ];
  for (const mutate of mutations) {
    const values = clone(members());
    mutate(catalogue(values));
    assert.throws(
      () => validateAuthoredProcessPredicateInputs(values),
      (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE',
    );
  }
});

test('does not grant authority', () => {
  const value = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
  assert.equal(value.object_kind, 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE');
  assert.equal(value.authority_contract, undefined);
});
