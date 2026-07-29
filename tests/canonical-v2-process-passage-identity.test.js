const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessPassageIdentity,
  validateProcessPassageIdentity,
} = require('../lib/canonical-v2/process-passage-identity');
const passageContract = require(
  '../contracts/canonical-v2/successor/process/passages/process-passage.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);
const ADMITTED_SOURCE_OCCURRENCE_ID = 'c'.repeat(64);
const DOCUMENT_HASH = 'd'.repeat(64);
const PASSAGE_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_PASSAGE',
  definition_version: 1,
});

function interval({
  start,
  end,
  sourceId = ADMITTED_SOURCE_OCCURRENCE_ID,
  documentHash = DOCUMENT_HASH,
  documentOrdinal = 0,
}) {
  return {
    admitted_source_occurrence_id: sourceId,
    document_hash: documentHash,
    document_ordinal: documentOrdinal,
    absolute_start: start,
    absolute_end: end,
    exact_bytes_digest: contentId(
      'SYNTHETIC_PROCESS_PASSAGE_BYTES/V1',
      { sourceId, documentHash, documentOrdinal, start, end },
    ),
  };
}

function intervalSet(...intervals) {
  return {
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    intervals,
  };
}

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    admitted_source_occurrence_id: ADMITTED_SOURCE_OCCURRENCE_ID,
    canonical_source_interval_set: intervalSet(
      interval({ start: 100, end: 180 }),
    ),
    process_passage_definition_key_and_version: PASSAGE_DEFINITION,
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed ProcessPassage contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    passageContract.definition.passage_identity.stable_id_inputs,
  );
});

test('builds one deterministic frozen identity without treating coordinates as source proof', () => {
  const first = buildProcessPassageIdentity(baseIdentity());
  const second = buildProcessPassageIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_PASSAGE_IDENTITY/V1');
  assert.equal(first.logical_type, 'ProcessPassage');
  assert.equal(
    first.process_passage_id,
    contentId('PROCESS_PASSAGE/V1', baseIdentity()),
  );
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.source_provenance_validation_state, 'UNRESOLVED');
  assert.equal(first.passage_role_registry_state, 'UNRESOLVED');
  assert.equal(first.citation_binding_state, 'UNRESOLVED');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.canonical_source_interval_set), true);
  assert.doesNotThrow(() => validateProcessPassageIdentity(first));
});

test('preserves exact ordered non-contiguous spans from one admitted source document', () => {
  const identity = buildProcessPassageIdentity(baseIdentity({
    canonical_source_interval_set: intervalSet(
      interval({ start: 100, end: 140 }),
      interval({ start: 220, end: 280 }),
    ),
  }));

  assert.deepEqual(
    identity.canonical_source_interval_set.intervals.map((entry) => [
      entry.absolute_start,
      entry.absolute_end,
    ]),
    [[100, 140], [220, 280]],
  );
  assert.equal(Object.hasOwn(identity, 'source_text'), false);
  assert.equal(Object.hasOwn(identity, 'inline_preview_text'), false);
  assert.equal(Object.hasOwn(identity, 'paragraph_context'), false);
});

test('different exact spans, sources, definitions and ordinals remain different passages', () => {
  const identities = [
    buildProcessPassageIdentity(baseIdentity()),
    buildProcessPassageIdentity(baseIdentity({
      canonical_source_interval_set: intervalSet(
        interval({ start: 200, end: 280 }),
      ),
    })),
    buildProcessPassageIdentity(baseIdentity({
      admitted_source_occurrence_id: 'e'.repeat(64),
      canonical_source_interval_set: intervalSet(
        interval({ start: 100, end: 180, sourceId: 'e'.repeat(64) }),
      ),
    })),
    buildProcessPassageIdentity(baseIdentity({ governed_ordinal: 1 })),
  ];

  assert.equal(
    new Set(identities.map((identity) => identity.process_passage_id)).size,
    identities.length,
  );
});

test('rejects text, citations, roles, context, relationships and model output as identity inputs', () => {
  const prohibited = [...new Set([
    ...passageContract.definition.passage_identity.prohibited_inputs,
    'candidate_values',
    'citation_identity',
    'evidence_edges',
    'failure_detail',
    'passage_role_codes',
    'passage_state',
    'process_relationship_revision_ids',
    'source_map',
    'source_text',
    'source_text_digest',
  ])];

  for (const key of prohibited) {
    assert.throws(
      () => buildProcessPassageIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'PROCESS_PASSAGE_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects a mismatched admitted source occurrence or a cross-document passage', () => {
  assert.throws(
    () => buildProcessPassageIdentity(baseIdentity({
      canonical_source_interval_set: intervalSet(
        interval({ start: 100, end: 180, sourceId: 'e'.repeat(64) }),
      ),
    })),
    (error) => error.code === 'PROCESS_PASSAGE_SOURCE_OCCURRENCE_MISMATCH',
  );

  assert.throws(
    () => buildProcessPassageIdentity(baseIdentity({
      canonical_source_interval_set: intervalSet(
        interval({ start: 100, end: 180 }),
        interval({
          start: 220,
          end: 280,
          documentHash: 'e'.repeat(64),
          documentOrdinal: 1,
        }),
      ),
    })),
    (error) => error.code === 'PROCESS_PASSAGE_SOURCE_DOCUMENT_MISMATCH',
  );
});

test('rejects unordered, overlapping, malformed or value-enriched source intervals', () => {
  const invalidSets = [
    intervalSet(
      interval({ start: 220, end: 280 }),
      interval({ start: 100, end: 140 }),
    ),
    intervalSet(
      interval({ start: 100, end: 180 }),
      interval({ start: 160, end: 220 }),
    ),
    intervalSet(),
    {
      coordinate_space: 'CHARACTERS',
      intervals: [interval({ start: 100, end: 180 })],
    },
    {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        ...interval({ start: 100, end: 180 }),
        rendered_text: 'forbidden',
      }],
    },
  ];

  for (const canonicalSourceIntervalSet of invalidSets) {
    assert.throws(
      () => buildProcessPassageIdentity(baseIdentity({
        canonical_source_interval_set: canonicalSourceIntervalSet,
      })),
      (error) => (
        error.code === 'INVALID_PROCESS_PASSAGE_SOURCE_INTERVAL_SET'
      ),
    );
  }
});

test('rejects malformed identity fields and undeclared inputs', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ admitted_source_occurrence_id: 'wrong' }),
    baseIdentity({
      process_passage_definition_key_and_version: {
        definition_key: 'PROCESS_PASSAGE',
        definition_version: 2,
      },
    }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), result_type: 'NARRATIVE' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildProcessPassageIdentity(input),
      (error) => error.code === 'INVALID_PROCESS_PASSAGE_IDENTITY',
    );
  }
});

test('detects identity, boundary, payload and authority mutations', () => {
  const changedId = clone(buildProcessPassageIdentity(baseIdentity()));
  changedId.canonical_source_interval_set.intervals[0].absolute_end += 1;
  assert.throws(
    () => validateProcessPassageIdentity(changedId),
    (error) => error.code === 'PROCESS_PASSAGE_ID_MISMATCH',
  );

  const changedBoundary = clone(buildProcessPassageIdentity(baseIdentity()));
  changedBoundary.citation_binding_state = 'VERIFIED';
  assert.throws(
    () => validateProcessPassageIdentity(changedBoundary),
    (error) => error.code === 'INVALID_PROCESS_PASSAGE_IDENTITY',
  );

  const changedAuthority = clone(buildProcessPassageIdentity(baseIdentity()));
  changedAuthority.authority_limits.serving = 'ALLOWED';
  assert.throws(
    () => validateProcessPassageIdentity(changedAuthority),
    (error) => error.code === 'INVALID_PROCESS_PASSAGE_IDENTITY',
  );

  const changedDigest = clone(buildProcessPassageIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'e'.repeat(64);
  assert.throws(
    () => validateProcessPassageIdentity(changedDigest),
    (error) => error.code === 'PROCESS_PASSAGE_PAYLOAD_MISMATCH',
  );
});

test('grants no source, citation, context, materialisation, write or release authority', () => {
  const identity = buildProcessPassageIdentity(baseIdentity());

  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    source_provenance_validation: 'NONE',
    passage_role_registry: 'NONE',
    citation_binding: 'NONE',
    context_action_binding: 'NONE',
    passage_revision: 'NONE',
    materialisation: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    import: 'NONE',
    activation: 'NONE',
  });
  for (const key of [
    'citation_identity',
    'evidence_edges',
    'passage_role_codes',
    'passage_state',
    'process_relationship_revision_ids',
    'source_map',
    'source_text_digest',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
