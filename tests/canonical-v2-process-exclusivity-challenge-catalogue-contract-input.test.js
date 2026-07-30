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
  validateProcessExclusivityCompletenessChallengeReconciliation,
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
  const activeOverrides = [
    loadMember('process/occurrence-slots/process-event.v1.json'),
    loadMember('process/predicates/exclusivity-completeness-challenge-catalogue.v1.json'),
    loadMember('process/predicates/exclusivity-predicate-catalogue.v2.json'),
    loadMember('process/predicates/process-predicate-witness.v2.json'),
    loadMember('process/registries/process-controlled-code-registry.v2.json'),
    loadMember('process/relationships/process-relationship.v2.json'),
  ];
  const overrideKeys = new Set(activeOverrides.map(
    (member) => `${member.object_kind}\0${member.canonical_value.stable_id}`,
  ));
  return [
    ...manifest.members
      .filter((entry) => fs.existsSync(path.join(ROOT, entry.relative_path)))
      .map((entry) => loadMember(entry.relative_path))
      .filter((member) => member.object_kind.startsWith('PROCESS_'))
      .filter((member) => !overrideKeys.has(
        `${member.object_kind}\0${member.canonical_value.stable_id}`,
      )),
    ...activeOverrides,
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalogue(values) {
  return values.find((member) => member.canonical_value.object_kind
    === 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE').canonical_value;
}

function reconciliation() {
  return JSON.parse(fs.readFileSync(RECONCILIATION_PATH, 'utf8'));
}

function replaceReconciliationDigest(value) {
  value.deterministic_content_digest = `sha256:${sha256Hex(Buffer.from(
    canonicalJson(Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => key !== 'deterministic_content_digest',
      ),
    )),
    'utf8',
  ))}`;
}

function assertInvalidReconciliation(value, challengeCatalogue = catalogue(members())) {
  assert.throws(
    () => validateProcessExclusivityCompletenessChallengeReconciliation(
      value,
      challengeCatalogue,
    ),
    (error) => error.code
      === 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION',
  );
}

test('validates the exact sealed challenge catalogue and its reconciliation binding', () => {
  const values = members();
  const value = catalogue(values);
  const evidence = reconciliation();

  assert.doesNotThrow(() => validateAuthoredProcessPredicateInputs(values));
  assert.doesNotThrow(
    () => validateProcessExclusivityCompletenessChallengeReconciliation(
      evidence,
      value,
    ),
  );
  assert.equal(value.challenge_questions.length, 48);
  assert.equal(value.challenge_questions.flatMap((question) => question.answer_slots).length, 190);
  assert.equal(
    evidence.deterministic_content_digest,
    `sha256:${PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST}`,
  );
  assert.equal(
    evidence.source_bindings.challenge_catalogue.declared_sealed_catalogue_digest,
    value.sealed_catalogue_digest,
  );
});

test('rejects absent, non-object, open and incomplete reconciliation evidence', () => {
  for (const value of [undefined, null, []]) {
    assertInvalidReconciliation(value);
  }

  const added = reconciliation();
  added.unrecognised = true;
  assertInvalidReconciliation(added);

  const deleted = reconciliation();
  delete deleted.blockers;
  assertInvalidReconciliation(deleted);
});

test('rejects reconciliation identity and digest attacks', () => {
  const mutations = [
    (value) => { value.object_kind += '_NEAR'; },
    (value) => { value.stable_id += '_NEAR'; },
    (value) => { value.schema_version += '_NEAR'; },
    (value) => { value.deterministic_content_digest = `${value.deterministic_content_digest.slice(0, -1)}0`; },
  ];
  for (const mutate of mutations) {
    const value = reconciliation();
    mutate(value);
    assertInvalidReconciliation(value);
  }

  const bodyMutation = reconciliation();
  bodyMutation.freeze_disposition = 'PERMIT_CONTRACT_FREEZE';
  assertInvalidReconciliation(bodyMutation);

  const forgedDigest = reconciliation();
  forgedDigest.freeze_disposition = 'PERMIT_CONTRACT_FREEZE';
  replaceReconciliationDigest(forgedDigest);
  assertInvalidReconciliation(forgedDigest);
});

test('rejects reordered reconciliation arrays', () => {
  const mutations = [
    (value) => { value.ordinary_predicate_reconciliations.reverse(); },
    (value) => { value.challenge_question_reconciliations.reverse(); },
    (value) => {
      value.challenge_question_reconciliations[0]
        .answer_slot_reconciliations.reverse();
    },
  ];
  for (const mutate of mutations) {
    const value = reconciliation();
    mutate(value);
    assertInvalidReconciliation(value);
  }
});

test('rejects substituted or mutated challenge-catalogue bindings', () => {
  const substituted = reconciliation();
  substituted.source_bindings.challenge_catalogue =
    clone(substituted.source_bindings.ordinary_catalogue);
  assertInvalidReconciliation(substituted);

  const fields = [
    'repository_path',
    'stable_id',
    'schema_version',
    'declared_sealed_catalogue_digest',
    'recalculated_sealed_catalogue_digest',
  ];
  for (const field of fields) {
    const value = reconciliation();
    value.source_bindings.challenge_catalogue[field] += '_NEAR';
    assertInvalidReconciliation(value);
  }

  const unsealed = reconciliation();
  unsealed.source_bindings.challenge_catalogue.seal_verified = false;
  assertInvalidReconciliation(unsealed);
});

test('rejects a substituted challenge catalogue', () => {
  const substitutedCatalogue = clone(catalogue(members()));
  substitutedCatalogue.challenge_questions[0].user_question += ' ';
  assertInvalidReconciliation(reconciliation(), substitutedCatalogue);
});

test('rejects mutated claimed completeness counts', () => {
  const fields = [
    'ordinary_predicates_expected',
    'ordinary_predicates_reconciled',
    'challenge_questions_expected',
    'challenge_questions_reconciled',
    'challenge_answer_slots_expected',
    'challenge_answer_slots_reconciled',
  ];
  for (const field of fields) {
    const value = reconciliation();
    value.completeness_counts[field] += 1;
    assertInvalidReconciliation(value);
  }
});

test('rejects missing or duplicated reconciliation members', () => {
  const mutations = [
    (value) => { value.ordinary_predicate_reconciliations.pop(); },
    (value) => {
      value.ordinary_predicate_reconciliations.push(
        clone(value.ordinary_predicate_reconciliations[0]),
      );
    },
    (value) => { value.challenge_question_reconciliations.pop(); },
    (value) => {
      value.challenge_question_reconciliations.push(
        clone(value.challenge_question_reconciliations[0]),
      );
    },
    (value) => {
      value.challenge_question_reconciliations[0]
        .answer_slot_reconciliations.pop();
    },
    (value) => {
      const slots = value.challenge_question_reconciliations[0]
        .answer_slot_reconciliations;
      slots.push(clone(slots[0]));
    },
  ];
  for (const mutate of mutations) {
    const value = reconciliation();
    mutate(value);
    assertInvalidReconciliation(value);
  }
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
