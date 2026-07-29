const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredSharedAuthorityInputs,
} = require('../lib/canonical-v2/shared-authority-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function members() {
  return [
    loadMember('shared/entities/entity-identity-bridge.v1.json'),
    loadMember('shared/entities/entity-name-occurrence.v1.json'),
    loadMember('shared/entities/entity-subject.v1.json'),
  ];
}

test('keeps the shared entity family deterministic inside an incomplete successor root', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.authored_members
      .filter((member) => member.relative_path.startsWith('shared/entities/'))
      .map((member) => member.stable_id),
    ['ENTITY_IDENTITY_BRIDGE', 'ENTITY_NAME_OCCURRENCE', 'ENTITY_SUBJECT'],
  );
  assert.ok(
    first.canonical_bundle_input_identity.per_kind_counts
      .SHARED_AUTHORITY_LOGICAL_TYPE_INPUT >= 3,
  );
  assert.equal(first.authored_universe_assessment.status, 'NOT_ASSESSED');
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
});

test('accepts the exact entity, source-name and identity-bridge contracts', () => {
  const exactMembers = members();
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs(exactMembers));
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs([]));

  const subject = exactMembers.find(
    (member) => member.canonical_value.stable_id === 'ENTITY_SUBJECT',
  );
  assert.equal(subject.canonical_value.definition.evidence_rules.source_occurrence_required, false);
  assert.equal(
    subject.canonical_value.definition.evidence_rules.approved_seed_attestation_permitted,
    true,
  );
});

test('rejects use of a display name as EntitySubject identity authority', () => {
  const changed = members();
  const subject = changed.find(
    (member) => member.canonical_value.stable_id === 'ENTITY_SUBJECT',
  );
  subject.canonical_value.definition.type_contract.identity_authority_types[0] = 'DISPLAY_NAME';

  assert.throws(
    () => validateAuthoredSharedAuthorityInputs(changed),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects an extracted value in a stable occurrence identity', () => {
  const changed = members();
  const name = changed.find(
    (member) => member.canonical_value.stable_id === 'ENTITY_NAME_OCCURRENCE',
  );
  name.canonical_value.definition.occurrence_identity.stable_id_inputs[0] = 'exact_name_text';

  assert.throws(
    () => validateAuthoredSharedAuthorityInputs(changed),
    (error) => error.code === 'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
  );
});

test('rejects an unregistered logical type and an extra field', () => {
  const unknown = clone(members()[0]);
  unknown.canonical_value.definition.logical_type = 'UnknownEntityType';
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([unknown]),
    (error) => error.code === 'UNREGISTERED_SHARED_AUTHORITY_LOGICAL_TYPE',
  );

  const extra = clone(members()[0]);
  extra.canonical_value.definition.unregistered_rule = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([extra]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects silent citation redirection and a current-release writer path', () => {
  const redirect = clone(members()[0]);
  redirect.canonical_value.definition.release_treatment.exact_release_citation_redirect = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([redirect]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const currentWriter = clone(members()[0]);
  currentWriter.canonical_value.definition.writer_action.current_release_writer_path = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([currentWriter]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects a normalised-name-only identity bridge and conflicting terminal selection', () => {
  const normalisedName = clone(members()[0]);
  normalisedName.canonical_value.definition.type_contract.normalised_name_match_sufficient = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([normalisedName]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const conflictSelection = clone(members()[0]);
  conflictSelection.canonical_value.definition.type_contract.conflict_blocks_terminal_selection = false;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([conflictSelection]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});
