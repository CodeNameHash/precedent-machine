const assert = require('node:assert/strict');
const test = require('node:test');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessNarrationOccurrence,
  freezeProcessNarrationOccurrenceSet,
  validateProcessNarrationOccurrence,
} = require('../lib/canonical-v2/process-narration-occurrence');

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);
const NARRATION_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_NARRATION_OCCURRENCE',
  definition_version: 1,
});

function syntheticId(label) {
  return contentId('SYNTHETIC_PROCESS_NARRATION_TEST_ID/V1', { label });
}

function interval({
  label,
  documentOrdinal = 0,
  start,
  end,
}) {
  return {
    admitted_source_occurrence_id: syntheticId(`${label}:source`),
    document_hash: syntheticId(`${label}:document`),
    document_ordinal: documentOrdinal,
    absolute_start: start,
    absolute_end: end,
    exact_bytes_digest: syntheticId(`${label}:bytes:${start}:${end}`),
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
    narration_definition_key_and_version: NARRATION_DEFINITION,
    canonical_source_interval_set: intervalSet(
      interval({ label: 'first', start: 100, end: 160 }),
    ),
    governed_ordinal: 0,
    ...overrides,
  };
}

function candidate(sourceIntervalSet) {
  return {
    canonical_source_interval_set: sourceIntervalSet,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('builds one deterministic source-local narration identity without event authority', () => {
  const first = buildProcessNarrationOccurrence(baseIdentity());
  const second = buildProcessNarrationOccurrence(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_NARRATION_OCCURRENCE/V1');
  assert.equal(first.logical_type, 'ProcessNarrationOccurrence');
  assert.equal(
    first.process_narration_occurrence_id,
    contentId('PROCESS_NARRATION_OCCURRENCE/V1', {
      frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
      governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
      narration_definition_key_and_version: NARRATION_DEFINITION,
      canonical_source_interval_set: baseIdentity().canonical_source_interval_set,
      governed_ordinal: 0,
    }),
  );
  assert.equal(first.authority_limits.event_identity, 'NONE');
  assert.equal(first.authority_limits.writer, 'NONE');
  assert.equal(first.authority_limits.serving, 'NONE');
  assert.equal(first.authority_limits.release, 'NONE');
  assert.equal(Object.hasOwn(first, 'process_event_id'), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.canonical_source_interval_set), true);
  assert.doesNotThrow(() => validateProcessNarrationOccurrence(first));
});

test('assigns ordinals from the canonical source comparator, not worker order', () => {
  const early = intervalSet(
    interval({ label: 'document', start: 100, end: 120 }),
  );
  const middle = intervalSet(
    interval({ label: 'document', start: 300, end: 330 }),
  );
  const late = intervalSet(
    interval({ label: 'document', start: 500, end: 540 }),
  );

  const first = freezeProcessNarrationOccurrenceSet({
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    narration_definition_key_and_version: NARRATION_DEFINITION,
    candidates: [candidate(late), candidate(early), candidate(middle)],
  });
  const second = freezeProcessNarrationOccurrenceSet({
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    narration_definition_key_and_version: NARRATION_DEFINITION,
    candidates: [candidate(middle), candidate(late), candidate(early)],
  });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((occurrence) => ({
      ordinal: occurrence.governed_ordinal,
      start:
        occurrence.canonical_source_interval_set.intervals[0].absolute_start,
    })),
    [
      { ordinal: 0, start: 100 },
      { ordinal: 1, start: 300 },
      { ordinal: 2, start: 500 },
    ],
  );
});

test('keeps a later retelling as separate source narration without creating an event', () => {
  const original = buildProcessNarrationOccurrence(baseIdentity());
  const retelling = buildProcessNarrationOccurrence(baseIdentity({
    canonical_source_interval_set: intervalSet(
      interval({ label: 'retelling', start: 800, end: 870 }),
    ),
    governed_ordinal: 1,
  }));

  assert.notEqual(
    original.process_narration_occurrence_id,
    retelling.process_narration_occurrence_id,
  );
  assert.equal(Object.hasOwn(original, 'process_event_id'), false);
  assert.equal(Object.hasOwn(retelling, 'process_event_id'), false);
});

test('does not use paragraph boundaries or source text as identity inputs', () => {
  const identity = baseIdentity({
    canonical_source_interval_set: intervalSet(
      interval({ label: 'multi-paragraph', start: 100, end: 280 }),
    ),
  });
  const occurrence = buildProcessNarrationOccurrence(identity);

  assert.equal(
    Object.hasOwn(occurrence.canonical_source_interval_set, 'paragraph_id'),
    false,
  );
  assert.equal(
    Object.hasOwn(occurrence.canonical_source_interval_set, 'source_text'),
    false,
  );
  assert.equal(
    occurrence.canonical_source_interval_set.intervals[0].absolute_start,
    100,
  );
  assert.equal(
    occurrence.canonical_source_interval_set.intervals[0].absolute_end,
    280,
  );
});

test('rejects candidate values, extracted attributes, model output and inferred events', () => {
  const forbiddenInputs = [
    'candidate_values',
    'extracted_attributes',
    'inferred_event_id',
    'model_output',
    'selected_revision_id',
  ];

  for (const key of forbiddenInputs) {
    assert.throws(
      () => buildProcessNarrationOccurrence({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => error.code === 'PROCESS_NARRATION_VALUE_DERIVED_IDENTITY',
    );
  }

  assert.throws(
    () => freezeProcessNarrationOccurrenceSet({
      frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
      governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
      narration_definition_key_and_version: NARRATION_DEFINITION,
      candidates: [{
        ...candidate(baseIdentity().canonical_source_interval_set),
        model_output: 'forbidden',
      }],
    }),
    (error) => error.code === 'PROCESS_NARRATION_VALUE_DERIVED_IDENTITY',
  );
});

test('rejects an unordered, overlapping, empty or malformed interval set', () => {
  const fixtures = [
    intervalSet(
      interval({ label: 'same', start: 300, end: 340 }),
      interval({ label: 'same', start: 100, end: 140 }),
    ),
    intervalSet(
      interval({ label: 'same', start: 100, end: 180 }),
      interval({ label: 'same', start: 160, end: 220 }),
    ),
    intervalSet(),
    {
      coordinate_space: 'UNICODE_CODE_POINTS',
      intervals: [interval({ label: 'wrong-space', start: 1, end: 2 })],
    },
    {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        ...interval({ label: 'bad-span', start: 10, end: 20 }),
        absolute_end: 5,
      }],
    },
  ];

  for (const canonicalSourceIntervalSet of fixtures) {
    assert.throws(
      () => buildProcessNarrationOccurrence(baseIdentity({
        canonical_source_interval_set: canonicalSourceIntervalSet,
      })),
      (error) => error.code === 'INVALID_PROCESS_NARRATION_SOURCE_INTERVAL_SET',
    );
  }
});

test('rejects duplicate narration members before ordinal assignment', () => {
  const sourceIntervalSet = intervalSet(
    interval({ label: 'duplicate', start: 100, end: 150 }),
  );

  assert.throws(
    () => freezeProcessNarrationOccurrenceSet({
      frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
      governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
      narration_definition_key_and_version: NARRATION_DEFINITION,
      candidates: [candidate(sourceIntervalSet), candidate(sourceIntervalSet)],
    }),
    (error) => error.code === 'DUPLICATE_PROCESS_NARRATION_OCCURRENCE',
  );
});

test('rejects a non-canonical ordinal and invalid frozen identities', () => {
  assert.throws(
    () => buildProcessNarrationOccurrence(baseIdentity({
      governed_ordinal: -1,
    })),
    (error) => error.code === 'INVALID_PROCESS_NARRATION_IDENTITY',
  );
  assert.throws(
    () => buildProcessNarrationOccurrence(baseIdentity({
      frozen_contract_pair_digest: 'not-a-digest',
    })),
    (error) => error.code === 'INVALID_PROCESS_NARRATION_IDENTITY',
  );
  assert.throws(
    () => buildProcessNarrationOccurrence(baseIdentity({
      governed_deal_admission_id: '',
    })),
    (error) => error.code === 'INVALID_PROCESS_NARRATION_IDENTITY',
  );
});

test('detects a re-signed mutation of the source interval identity', () => {
  const occurrence = clone(buildProcessNarrationOccurrence(baseIdentity()));
  occurrence.canonical_source_interval_set.intervals[0].absolute_end += 1;
  const body = clone(occurrence);
  delete body.process_narration_occurrence_id;
  delete body.canonical_payload_digest;
  occurrence.canonical_payload_digest = contentId(
    'PROCESS_NARRATION_OCCURRENCE_PAYLOAD/V1',
    body,
  );

  assert.throws(
    () => validateProcessNarrationOccurrence(occurrence),
    (error) => error.code === 'PROCESS_NARRATION_OCCURRENCE_ID_MISMATCH',
  );
});
