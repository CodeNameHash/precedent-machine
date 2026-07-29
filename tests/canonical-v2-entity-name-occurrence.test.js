const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildEntityNameOccurrence,
  buildEntityNameRevision,
  validateEntityNameOccurrence,
  validateEntityNameRevision,
} = require('../lib/canonical-v2/entity-name-occurrence');

const id = (value) => contentId('ENTITY_NAME_TEST/V1', value);

function occurrence(overrides = {}) {
  return buildEntityNameOccurrence({
    expected_name_slot_key: 'PROCESS_PARTY_LABEL',
    governed_ordinal: 0,
    name_role: 'SOURCE_LOCAL_LABEL',
    source_occurrence_id: id('process-source-occurrence'),
    ...overrides,
  });
}

function presentRevision(entityNameOccurrence, overrides = {}) {
  return buildEntityNameRevision({
    entity_name_occurrence: entityNameOccurrence,
    entity_subject_id: null,
    evidence_state: { state: 'PRESENT' },
    exact_name_text: 'Party 3',
    extraction_version: 'entity-name-extractor/v1',
    language: 'en',
    source_interval: {
      source_occurrence_id: entityNameOccurrence.source_occurrence_id,
      start_byte: 120,
      end_byte: 127,
      evidence_edge_id: id('party-3-evidence'),
    },
    ...overrides,
  });
}

test('builds a deterministic, closed and deeply frozen name occurrence', () => {
  const nameOccurrence = occurrence();

  assert.equal(validateEntityNameOccurrence(nameOccurrence), true);
  assert.equal(canonicalJson(nameOccurrence), canonicalJson(occurrence()));
  assert.equal(Object.isFrozen(nameOccurrence), true);
});

test('exact name text cannot create or change the occurrence identity', () => {
  const nameOccurrence = occurrence();
  const sourceLocal = presentRevision(nameOccurrence);
  const named = presentRevision(nameOccurrence, {
    entity_subject_id: id('pfizer-entity'),
    exact_name_text: 'Pfizer Inc.',
    source_interval: {
      source_occurrence_id: nameOccurrence.source_occurrence_id,
      start_byte: 300,
      end_byte: 311,
      evidence_edge_id: id('pfizer-name-evidence'),
    },
  });

  assert.equal(
    sourceLocal.entity_name_occurrence_id,
    named.entity_name_occurrence_id,
  );
  assert.notEqual(sourceLocal.entity_name_revision_id, named.entity_name_revision_id);
  assert.throws(() => occurrence({ exact_name_text: 'Pfizer Inc.' }),
    (error) => error.code === 'INVALID_ENTITY_NAME');
  assert.throws(() => occurrence({ normalised_name: 'pfizer inc' }),
    (error) => error.code === 'INVALID_ENTITY_NAME');
});

test('source-local labels remain valid without an entity bridge', () => {
  const nameOccurrence = occurrence();
  const revision = presentRevision(nameOccurrence);

  assert.equal(revision.entity_subject_id, null);
  assert.equal(revision.exact_name_text, 'Party 3');
  assert.equal(validateEntityNameRevision({
    revision,
    entity_name_occurrence: nameOccurrence,
  }), true);
});

test('source interval must bind the admitted occurrence and exact UTF-8 length', () => {
  const nameOccurrence = occurrence();

  assert.throws(() => presentRevision(nameOccurrence, {
    source_interval: {
      source_occurrence_id: id('different-source'),
      start_byte: 120,
      end_byte: 127,
      evidence_edge_id: id('party-3-evidence'),
    },
  }), (error) => error.code === 'UNBOUND_ENTITY_NAME_SOURCE');
  assert.throws(() => presentRevision(nameOccurrence, {
    source_interval: {
      source_occurrence_id: nameOccurrence.source_occurrence_id,
      start_byte: 120,
      end_byte: 128,
      evidence_edge_id: id('party-3-evidence'),
    },
  }), (error) => error.code === 'INVALID_ENTITY_NAME_INTERVAL');
});

test('absence requires a complete scope and cannot assert text or an entity', () => {
  const nameOccurrence = occurrence();
  const absent = buildEntityNameRevision({
    entity_name_occurrence: nameOccurrence,
    entity_subject_id: null,
    evidence_state: {
      state: 'ABSENT',
      complete_scope_id: id('complete-name-scope'),
      evidence_edge_ids: [id('complete-name-scope-evidence')],
    },
    exact_name_text: null,
    extraction_version: 'entity-name-extractor/v1',
    language: 'und',
    source_interval: null,
  });

  assert.equal(absent.evidence_state.state, 'ABSENT');
  assert.throws(() => buildEntityNameRevision({
    entity_name_occurrence: nameOccurrence,
    entity_subject_id: id('improper-entity'),
    evidence_state: {
      state: 'ABSENT',
      complete_scope_id: id('complete-name-scope'),
      evidence_edge_ids: [id('complete-name-scope-evidence')],
    },
    exact_name_text: null,
    extraction_version: 'entity-name-extractor/v1',
    language: 'und',
    source_interval: null,
  }), (error) => error.code === 'NON_PRESENT_ENTITY_NAME_VALUE');
  assert.throws(() => buildEntityNameRevision({
    entity_name_occurrence: nameOccurrence,
    entity_subject_id: null,
    evidence_state: {
      state: 'ABSENT',
      complete_scope_id: id('complete-name-scope'),
      evidence_edge_ids: [],
    },
    exact_name_text: null,
    extraction_version: 'entity-name-extractor/v1',
    language: 'und',
    source_interval: null,
  }), (error) => error.code === 'INVALID_ENTITY_NAME_STATE');
});

test('unregistered roles, invalid language and extra revision fields fail closed', () => {
  const nameOccurrence = occurrence();

  assert.throws(() => occurrence({ name_role: 'CLEANED_NAME' }),
    (error) => error.code === 'INVALID_ENTITY_NAME_ROLE');
  assert.throws(() => presentRevision(nameOccurrence, { language: 'ENGLISH' }),
    (error) => error.code === 'INVALID_ENTITY_NAME_LANGUAGE');
  assert.throws(() => buildEntityNameRevision({
    entity_name_occurrence: nameOccurrence,
    entity_subject_id: null,
    evidence_state: { state: 'PRESENT' },
    exact_name_text: 'Party 3',
    extraction_version: 'entity-name-extractor/v1',
    language: 'en',
    source_interval: {
      source_occurrence_id: nameOccurrence.source_occurrence_id,
      start_byte: 120,
      end_byte: 127,
      evidence_edge_id: id('party-3-evidence'),
    },
    cleaned_name: 'party 3',
  }), (error) => error.code === 'INVALID_ENTITY_NAME');
});

test('validators reject stale occurrence and revision identities', () => {
  const nameOccurrence = occurrence();
  const revision = presentRevision(nameOccurrence);

  assert.throws(() => validateEntityNameOccurrence({
    ...structuredClone(nameOccurrence),
    entity_name_occurrence_id: id('stale-occurrence'),
  }), (error) => error.code === 'STALE_ENTITY_NAME_OCCURRENCE');
  assert.throws(() => validateEntityNameRevision({
    revision: {
      ...structuredClone(revision),
      entity_name_revision_id: id('stale-revision'),
    },
    entity_name_occurrence: nameOccurrence,
  }), (error) => error.code === 'STALE_ENTITY_NAME_REVISION');
});
