'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DOCUMENT_VERIFICATION_RECORD_SCHEMA,
  CORPUS_COMPLETENESS_RECORD_SCHEMA,
  DOCUMENT_VERIFICATION_STATES,
  CORPUS_COMPLETENESS_STATES,
  DEFAULT_CORPUS_COMPLETENESS_STATE,
  CORPUS_COMPLETENESS_TRANSITIONS,
  SourceVerificationStateError,
  assertDisjointVocabularies,
  assertLegalCorpusCompletenessTransition,
  buildCorpusCompletenessRecord,
  buildDocumentVerificationRecord,
  buildInitialCorpusCompletenessRecord,
  isLegalCorpusCompletenessTransition,
  transitionCorpusCompletenessState,
  validateCorpusCompletenessRecord,
  validateDocumentVerificationRecord,
} = require('../lib/canonical-v2/source-verification-state');

const DEAL_ID = 'deal-alpha';
const SOURCE_DOCUMENT_ID = 'doc-alpha-1';
const DOCUMENT_VERIFIED = 'DOCUMENT_TEXT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES';
const DOCUMENT_NOT_VERIFIED = 'DOCUMENT_TEXT_NOT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES';
const HUMAN_VERIFIED_COMPLETE = 'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE';
const HUMAN_FLAGGED_INCOMPLETE = 'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE';
const ASSERTER = 'ben-goodchild';
const OTHER_ASSERTER = 'associate-jones';
const ASSERTED_AT = '2026-08-04T12:00:00.000Z';
const LATER_ASSERTED_AT = '2026-08-05T09:30:00.000Z';

function validDocumentRecord(overrides = {}) {
  return buildDocumentVerificationRecord({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
    ...overrides,
  });
}

function validCorpusRecord(overrides = {}) {
  return buildCorpusCompletenessRecord({
    deal_id: DEAL_ID,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
    ...overrides,
  });
}

function initialCorpusRecord(overrides = {}) {
  return buildInitialCorpusCompletenessRecord({
    deal_id: DEAL_ID,
    ...overrides,
  });
}

function shallowCopyWithout(record, field) {
  const copy = { ...record };
  delete copy[field];
  return copy;
}

// ---- vocabularies -----------------------------------------------------

test('the two state vocabularies are closed, frozen and disjoint', () => {
  assert.deepEqual([...DOCUMENT_VERIFICATION_STATES], [
    'DOCUMENT_TEXT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES',
    'DOCUMENT_TEXT_NOT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES',
  ]);
  assert.deepEqual([...CORPUS_COMPLETENESS_STATES], [
    'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
  ]);
  assert.ok(Object.isFrozen(DOCUMENT_VERIFICATION_STATES));
  assert.ok(Object.isFrozen(CORPUS_COMPLETENESS_STATES));
  // The positive document-verification state is document-scoped in its own
  // name and says exactly what it means; it must not read as a corpus claim.
  assert.ok(DOCUMENT_VERIFIED.startsWith('DOCUMENT_TEXT_'));
  assert.ok(DOCUMENT_VERIFIED.includes('VERIFIED'));
  assert.ok(!DOCUMENT_VERIFIED.includes('CORPUS'));
  for (const state of CORPUS_COMPLETENESS_STATES) assert.ok(state.startsWith('CORPUS_COMPLETENESS_'));
  // Module load already asserted this; re-assert directly against the real
  // exported vocabularies too, not just relying on the load-time side effect.
  assert.equal(
    assertDisjointVocabularies(DOCUMENT_VERIFICATION_STATES, CORPUS_COMPLETENESS_STATES, 'real vocabularies'),
    true,
  );
});

test('assertDisjointVocabularies is a reusable, independently testable guard', () => {
  assert.equal(assertDisjointVocabularies(['A', 'B'], ['C', 'D'], 'disjoint pair'), true);
  assert.throws(
    () => assertDisjointVocabularies(['A', 'B'], ['B', 'C'], 'overlapping pair'),
    (error) => error instanceof SourceVerificationStateError
      && error.code === 'VOCABULARY_OVERLAP'
      && error.details.overlap.includes('B'),
  );
});

test('SourceVerificationStateError carries name, code and details', () => {
  const error = new SourceVerificationStateError('SOME_CODE', 'a message', { a: 1 });
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'SourceVerificationStateError');
  assert.equal(error.code, 'SOME_CODE');
  assert.equal(error.message, 'a message');
  assert.deepEqual(error.details, { a: 1 });
});

// ---- defaults: corpus-completeness record --------------------------------

test('the default corpus-completeness state is not-human-verified with no asserter', () => {
  assert.equal(DEFAULT_CORPUS_COMPLETENESS_STATE, 'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED');
  const record = initialCorpusRecord();
  assert.equal(record.schema_version, CORPUS_COMPLETENESS_RECORD_SCHEMA);
  assert.equal(record.corpus_completeness_state, DEFAULT_CORPUS_COMPLETENESS_STATE);
  assert.equal(record.corpus_completeness_asserted_by, null);
  assert.equal(record.corpus_completeness_asserted_at, null);
  assert.equal(record.deal_id, DEAL_ID);
  assert.match(record.corpus_completeness_record_id, /^[a-f0-9]{64}$/);
  assert.doesNotThrow(() => validateCorpusCompletenessRecord(record));
});

test('buildInitialCorpusCompletenessRecord rejects a non-plain input', () => {
  for (const bad of [null, 'x', 42, ['a']]) {
    assert.throws(
      () => buildInitialCorpusCompletenessRecord(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
  }
});

// ---- field-level validation: document-verification record ----------------

test('deal_id and source_document_id must be non-empty trimmed strings on a document-verification record', () => {
  for (const bad of ['', '   ', ' deal', 'deal ', 42, null, undefined, {}]) {
    assert.throws(
      () => buildDocumentVerificationRecord({
        deal_id: bad,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: DOCUMENT_VERIFIED,
      }),
      (error) => error.code === 'INVALID_DEAL_ID',
      String(bad),
    );
    assert.throws(
      () => buildDocumentVerificationRecord({
        deal_id: DEAL_ID,
        source_document_id: bad,
        document_verification_state: DOCUMENT_VERIFIED,
      }),
      (error) => error.code === 'INVALID_SOURCE_DOCUMENT_ID',
      String(bad),
    );
  }
});

test('document_verification_state must be a member of its own closed vocabulary', () => {
  for (const bad of ['NOT_A_STATE', HUMAN_VERIFIED_COMPLETE, null, undefined, 1, {}]) {
    assert.throws(
      () => buildDocumentVerificationRecord({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: bad,
      }),
      (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
      String(bad),
    );
  }
});

// ---- field-level validation: corpus-completeness record -------------------

test('deal_id must be a non-empty trimmed string on a corpus-completeness record', () => {
  for (const bad of ['', '   ', ' deal', 'deal ', 42, null, undefined, {}]) {
    assert.throws(
      () => buildCorpusCompletenessRecord({
        deal_id: bad,
        corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
        corpus_completeness_asserted_by: ASSERTER,
        corpus_completeness_asserted_at: ASSERTED_AT,
      }),
      (error) => error.code === 'INVALID_DEAL_ID',
      String(bad),
    );
  }
});

test('corpus_completeness_state must be a member of its own closed vocabulary', () => {
  for (const bad of ['NOT_A_STATE', DOCUMENT_VERIFIED, null, undefined, 1, {}]) {
    assert.throws(
      () => buildCorpusCompletenessRecord({
        deal_id: DEAL_ID,
        corpus_completeness_state: bad,
        corpus_completeness_asserted_by: null,
        corpus_completeness_asserted_at: null,
      }),
      (error) => error.code === 'INVALID_CORPUS_COMPLETENESS_STATE',
      String(bad),
    );
  }
});

// ---- the two vocabularies cannot be swapped into the wrong builder --------

test('the corpus-completeness vocabulary cannot be used as a document_verification_state', () => {
  assert.throws(
    () => buildDocumentVerificationRecord({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: CORPUS_COMPLETENESS_STATES[0],
    }),
    (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
  );
});

test('the document-verification vocabulary cannot be used as a corpus_completeness_state', () => {
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: DOCUMENT_VERIFICATION_STATES[0],
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'INVALID_CORPUS_COMPLETENESS_STATE',
  );
});

// ---- the central rule: no corpus assertion without a human asserter -----

test('a record asserting corpus-verified with no human asserter fails closed via the builder', () => {
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
  );
});

test('a record asserting corpus-verified with no human asserter fails closed via the validator', () => {
  // Hand-crafted, bypassing the builder entirely -- the validator must
  // independently refuse to certify this, not just trust a pre-existing id.
  // Note this hostile record also has no document-scoped field anywhere on
  // it: a corpus-completeness record never had one to bypass.
  const hostile = {
    schema_version: CORPUS_COMPLETENESS_RECORD_SCHEMA,
    deal_id: DEAL_ID,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: null,
    corpus_completeness_asserted_at: null,
    corpus_completeness_record_id: 'a'.repeat(64),
  };
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
  );
});

test('flagging a corpus incomplete is just as much a human judgement: it also requires an asserter', () => {
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: ASSERTED_AT,
    }),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
  );
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_TIMESTAMP',
  );
});

test('the default state cannot carry a dangling asserter or timestamp', () => {
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'CORPUS_DEFAULT_STATE_MUST_NOT_CARRY_ASSERTER',
  );
  assert.throws(
    () => buildCorpusCompletenessRecord({
      deal_id: DEAL_ID,
      corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: ASSERTED_AT,
    }),
    (error) => error.code === 'CORPUS_DEFAULT_STATE_MUST_NOT_CARRY_ASSERTER',
  );
});

test('the human asserter must be a non-empty trimmed string', () => {
  for (const bad of ['', '   ', ' ben', 'ben ', 42, {}, undefined]) {
    assert.throws(
      () => buildCorpusCompletenessRecord({
        deal_id: DEAL_ID,
        corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
        corpus_completeness_asserted_by: bad,
        corpus_completeness_asserted_at: ASSERTED_AT,
      }),
      (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
      String(bad),
    );
  }
});

test('the corpus assertion timestamp must be the canonical millisecond UTC form', () => {
  for (const bad of [
    '2026-08-04T12:00:00Z', // no milliseconds
    '2026-08-04T12:00:00.000+00:00', // offset instead of Z
    '2026-08-04', // date only
    'not-a-timestamp',
    '2026-13-40T99:99:99.000Z', // regex-shape-like but not a real calendar instant
    42,
    undefined,
  ]) {
    assert.throws(
      () => buildCorpusCompletenessRecord({
        deal_id: DEAL_ID,
        corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
        corpus_completeness_asserted_by: ASSERTER,
        corpus_completeness_asserted_at: bad,
      }),
      (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_TIMESTAMP',
      String(bad),
    );
  }
});

// ---- record-type independence ---------------------------------------------

test('a deal-keyed corpus record is valid without reference to any document', () => {
  const record = buildCorpusCompletenessRecord({
    deal_id: DEAL_ID,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  });
  assert.equal(Object.hasOwn(record, 'source_document_id'), false);
  assert.equal(Object.hasOwn(record, 'document_verification_state'), false);
  assert.deepEqual(Object.keys(record).sort(), [
    'corpus_completeness_asserted_at',
    'corpus_completeness_asserted_by',
    'corpus_completeness_record_id',
    'corpus_completeness_state',
    'deal_id',
    'schema_version',
  ].sort());
  assert.doesNotThrow(() => validateCorpusCompletenessRecord(record));
});

test('a per-document record is valid without reference to any corpus state', () => {
  const record = buildDocumentVerificationRecord({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
  });
  assert.equal(record.schema_version, DOCUMENT_VERIFICATION_RECORD_SCHEMA);
  assert.equal(Object.hasOwn(record, 'corpus_completeness_state'), false);
  assert.equal(Object.hasOwn(record, 'corpus_completeness_asserted_by'), false);
  assert.equal(Object.hasOwn(record, 'corpus_completeness_asserted_at'), false);
  assert.deepEqual(Object.keys(record).sort(), [
    'deal_id',
    'document_verification_record_id',
    'document_verification_state',
    'schema_version',
    'source_document_id',
  ].sort());
  assert.doesNotThrow(() => validateDocumentVerificationRecord(record));
});

test('validateDocumentVerificationRecord rejects a corpus-completeness record\'s field set', () => {
  const corpusRecord = validCorpusRecord();
  assert.throws(
    () => validateDocumentVerificationRecord(corpusRecord),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.missing.includes('source_document_id')
      && error.details.missing.includes('document_verification_state')
      && error.details.missing.includes('document_verification_record_id')
      && error.details.unexpected.includes('corpus_completeness_state')
      && error.details.unexpected.includes('corpus_completeness_asserted_by')
      && error.details.unexpected.includes('corpus_completeness_asserted_at')
      && error.details.unexpected.includes('corpus_completeness_record_id'),
  );
});

test('validateCorpusCompletenessRecord rejects a document-verification record\'s field set', () => {
  const documentRecord = validDocumentRecord();
  assert.throws(
    () => validateCorpusCompletenessRecord(documentRecord),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.missing.includes('corpus_completeness_state')
      && error.details.missing.includes('corpus_completeness_asserted_by')
      && error.details.missing.includes('corpus_completeness_asserted_at')
      && error.details.missing.includes('corpus_completeness_record_id')
      && error.details.unexpected.includes('source_document_id')
      && error.details.unexpected.includes('document_verification_state')
      && error.details.unexpected.includes('document_verification_record_id'),
  );
});

test('a well-formed record with an unverified corpus is ACCEPTED, proving the state is advisory rather than a gate', () => {
  const verifiedDocument = validDocumentRecord();
  const unverifiedCorpus = initialCorpusRecord();
  assert.equal(unverifiedCorpus.corpus_completeness_state, DEFAULT_CORPUS_COMPLETENESS_STATE);
  // Both are well-formed and both are ACCEPTED: an unverified corpus is a
  // health warning shown alongside a document, never a reason to refuse it.
  assert.doesNotThrow(() => validateDocumentVerificationRecord(verifiedDocument));
  assert.doesNotThrow(() => validateCorpusCompletenessRecord(unverifiedCorpus));
});

test('every document-verification state is independently valid alongside every corpus-completeness state', () => {
  for (const documentState of DOCUMENT_VERIFICATION_STATES) {
    const documentRecord = buildDocumentVerificationRecord({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: documentState,
    });
    assert.doesNotThrow(() => validateDocumentVerificationRecord(documentRecord));
    assert.equal(documentRecord.document_verification_state, documentState);
    for (const corpusState of CORPUS_COMPLETENESS_STATES) {
      const isDefault = corpusState === DEFAULT_CORPUS_COMPLETENESS_STATE;
      const corpusRecord = buildCorpusCompletenessRecord({
        deal_id: DEAL_ID,
        corpus_completeness_state: corpusState,
        corpus_completeness_asserted_by: isDefault ? null : ASSERTER,
        corpus_completeness_asserted_at: isDefault ? null : ASSERTED_AT,
      });
      assert.doesNotThrow(() => validateCorpusCompletenessRecord(corpusRecord));
      assert.equal(corpusRecord.corpus_completeness_state, corpusState);
    }
  }
  // Illustrative pairings from the pre-split combined-record model, now
  // expressed as two independently valid records sharing nothing but a
  // deal_id string value.
  assert.doesNotThrow(() => buildDocumentVerificationRecord({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_NOT_VERIFIED,
  }), 'an unverified document can coexist with a human-verified-complete corpus');
  assert.doesNotThrow(() => buildCorpusCompletenessRecord({
    deal_id: DEAL_ID,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  }), 'an unverified document can coexist with a human-verified-complete corpus');
  assert.doesNotThrow(() => buildDocumentVerificationRecord({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
  }), 'a verified document does not by itself make its deal\'s corpus human-verified');
  assert.doesNotThrow(() => buildInitialCorpusCompletenessRecord({ deal_id: DEAL_ID }),
    'a verified document does not by itself make its deal\'s corpus human-verified');
});

// ---- transition table -----------------------------------------------------

test('the corpus-completeness transition table is exactly the 8 documented legal edges', () => {
  const edges = [];
  for (const [from, tos] of Object.entries(CORPUS_COMPLETENESS_TRANSITIONS)) {
    for (const to of tos) edges.push(`${from} -> ${to}`);
  }
  assert.equal(edges.length, 8);
  assert.deepEqual([...edges].sort(), [
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE -> CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE -> CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE -> CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE -> CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE -> CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE -> CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
    'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED -> CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
    'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED -> CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
  ].sort());
});

test('every legal corpus-completeness transition is accepted', () => {
  for (const [from, tos] of Object.entries(CORPUS_COMPLETENESS_TRANSITIONS)) {
    for (const to of tos) {
      assert.equal(isLegalCorpusCompletenessTransition(from, to), true, `${from} -> ${to}`);
      assert.doesNotThrow(() => assertLegalCorpusCompletenessTransition(from, to), `${from} -> ${to}`);
    }
  }
});

test('every illegal transition is rejected with a specific code', () => {
  // In-vocabulary but banned: the default state has no assertion, so it
  // cannot "transition" to itself.
  assert.equal(isLegalCorpusCompletenessTransition(
    DEFAULT_CORPUS_COMPLETENESS_STATE,
    DEFAULT_CORPUS_COMPLETENESS_STATE,
  ), false);
  assert.throws(
    () => assertLegalCorpusCompletenessTransition(DEFAULT_CORPUS_COMPLETENESS_STATE, DEFAULT_CORPUS_COMPLETENESS_STATE),
    (error) => error.code === 'ILLEGAL_CORPUS_COMPLETENESS_TRANSITION',
  );

  // Garbage endpoints, including feeding a document-verification value into
  // a corpus-completeness transition -- the two axes must not be mixable
  // even at the transition layer.
  for (const badTo of ['NOT_A_STATE', null, undefined, 42, {}, DOCUMENT_VERIFIED]) {
    assert.equal(isLegalCorpusCompletenessTransition(DEFAULT_CORPUS_COMPLETENESS_STATE, badTo), false, String(badTo));
    assert.throws(
      () => assertLegalCorpusCompletenessTransition(DEFAULT_CORPUS_COMPLETENESS_STATE, badTo),
      (error) => error.code === 'INVALID_TRANSITION_STATE',
      String(badTo),
    );
  }
  for (const badFrom of ['NOT_A_STATE', null, undefined, 42, {}, 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(isLegalCorpusCompletenessTransition(badFrom, DEFAULT_CORPUS_COMPLETENESS_STATE), false, String(badFrom));
    assert.throws(
      () => assertLegalCorpusCompletenessTransition(badFrom, DEFAULT_CORPUS_COMPLETENESS_STATE),
      (error) => error.code === 'INVALID_TRANSITION_STATE',
      String(badFrom),
    );
  }
});

// ---- revocation: the whole point of the ruling ----------------------------

test('human verification is revocable back to the exact initial not-human-verified state', () => {
  const initial = initialCorpusRecord();
  const verified = transitionCorpusCompletenessState({
    previous: initial,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  });
  assert.equal(verified.corpus_completeness_state, HUMAN_VERIFIED_COMPLETE);
  assert.equal(verified.corpus_completeness_asserted_by, ASSERTER);
  assert.notEqual(verified.corpus_completeness_record_id, initial.corpus_completeness_record_id);

  // A later document appears -> revoke back to not-human-verified.
  const revoked = transitionCorpusCompletenessState({
    previous: verified,
    corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
  });
  assert.equal(revoked.corpus_completeness_state, DEFAULT_CORPUS_COMPLETENESS_STATE);
  assert.equal(revoked.corpus_completeness_asserted_by, null);
  assert.equal(revoked.corpus_completeness_asserted_at, null);
  assert.deepEqual(revoked, initial);
});

test('a human-flagged-incomplete corpus can be resolved to verified-complete and back', () => {
  const initial = initialCorpusRecord();
  const flagged = transitionCorpusCompletenessState({
    previous: initial,
    corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  });
  assert.equal(flagged.corpus_completeness_state, HUMAN_FLAGGED_INCOMPLETE);

  const resolved = transitionCorpusCompletenessState({
    previous: flagged,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: OTHER_ASSERTER,
    corpus_completeness_asserted_at: LATER_ASSERTED_AT,
  });
  assert.equal(resolved.corpus_completeness_state, HUMAN_VERIFIED_COMPLETE);
  assert.equal(resolved.corpus_completeness_asserted_by, OTHER_ASSERTER);

  // A human can also directly correct VERIFIED_COMPLETE back to
  // FLAGGED_INCOMPLETE without passing back through the default state.
  const reFlagged = transitionCorpusCompletenessState({
    previous: resolved,
    corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: LATER_ASSERTED_AT,
  });
  assert.equal(reFlagged.corpus_completeness_state, HUMAN_FLAGGED_INCOMPLETE);
});

test('transitionCorpusCompletenessState preserves the deal_id field', () => {
  const verified = validCorpusRecord();
  const flagged = transitionCorpusCompletenessState({
    previous: verified,
    corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
    corpus_completeness_asserted_by: OTHER_ASSERTER,
    corpus_completeness_asserted_at: LATER_ASSERTED_AT,
  });
  assert.equal(flagged.deal_id, verified.deal_id);
  assert.notEqual(flagged.corpus_completeness_record_id, verified.corpus_completeness_record_id);
});

test('transitionCorpusCompletenessState rejects a no-op transition on the default state', () => {
  const initial = initialCorpusRecord();
  assert.throws(
    () => transitionCorpusCompletenessState({
      previous: initial,
      corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
    }),
    (error) => error.code === 'ILLEGAL_CORPUS_COMPLETENESS_TRANSITION',
  );
});

test('transitionCorpusCompletenessState validates the previous record and fails closed on a corrupted one', () => {
  assert.throws(
    () => transitionCorpusCompletenessState({
      previous: null,
      corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: ASSERTED_AT,
    }),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
  const corrupted = shallowCopyWithout(initialCorpusRecord(), 'corpus_completeness_asserted_by');
  assert.throws(
    () => transitionCorpusCompletenessState({
      previous: corrupted,
      corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: ASSERTED_AT,
    }),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET',
  );
});

// ---- validator: closed exact-field-set (document-verification record) -----

test('validator rejects a document-verification record missing a required field', () => {
  const missing = shallowCopyWithout(validDocumentRecord(), 'source_document_id');
  assert.throws(
    () => validateDocumentVerificationRecord(missing),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.missing.includes('source_document_id')
      && error.details.unexpected.length === 0,
  );
});

test('validator rejects a document-verification record with an unexpected extra field', () => {
  const extra = { ...validDocumentRecord(), extra_field: 'not part of the schema' };
  assert.throws(
    () => validateDocumentVerificationRecord(extra),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.unexpected.includes('extra_field')
      && error.details.missing.length === 0,
  );
});

test('validator rejects a document-verification record with a wrong-value field using the builder\'s code', () => {
  const wrongState = { ...validDocumentRecord(), document_verification_state: 'NOT_A_STATE' };
  assert.throws(
    () => validateDocumentVerificationRecord(wrongState),
    (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
  );
});

// ---- validator: closed exact-field-set (corpus-completeness record) -------

test('validator rejects a corpus-completeness record missing a required field', () => {
  const missing = shallowCopyWithout(validCorpusRecord(), 'corpus_completeness_asserted_by');
  assert.throws(
    () => validateCorpusCompletenessRecord(missing),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.missing.includes('corpus_completeness_asserted_by')
      && error.details.unexpected.length === 0,
  );
});

test('validator rejects a corpus-completeness record with an unexpected extra field', () => {
  const extra = { ...validCorpusRecord(), extra_field: 'not part of the schema' };
  assert.throws(
    () => validateCorpusCompletenessRecord(extra),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.unexpected.includes('extra_field')
      && error.details.missing.length === 0,
  );
});

test('validator rejects a corpus-completeness record with a wrong-value field using the builder\'s code', () => {
  const wrongState = { ...validCorpusRecord(), corpus_completeness_state: 'NOT_A_STATE' };
  assert.throws(
    () => validateCorpusCompletenessRecord(wrongState),
    (error) => error.code === 'INVALID_CORPUS_COMPLETENESS_STATE',
  );
});

// ---- document-verification record: validator hardening --------------------

test('document-verification validator rejects a record whose prototype has been tampered with', () => {
  const valid = validDocumentRecord();
  const maliciousProto = { extra_authority: 'granted' };
  const hostile = Object.assign(Object.create(maliciousProto), valid);
  assert.deepEqual(Object.keys(hostile).sort(), Object.keys(valid).sort());
  assert.throws(
    () => validateDocumentVerificationRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('document-verification validator rejects a null-prototype record', () => {
  const hostile = Object.assign(Object.create(null), validDocumentRecord());
  assert.throws(
    () => validateDocumentVerificationRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('document-verification validator rejects the object-literal __proto__ prototype-injection vector', () => {
  const valid = validDocumentRecord();
  const hostile = { __proto__: { extra_authority: 'granted' }, ...valid };
  assert.notEqual(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateDocumentVerificationRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('document-verification validator rejects an ordinary own "__proto__" data property as an unexpected field', () => {
  const hostile = { ...validDocumentRecord() };
  Object.defineProperty(hostile, '__proto__', { value: 'evil', enumerable: true, configurable: true });
  assert.equal(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateDocumentVerificationRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET' && error.details.unexpected.includes('__proto__'),
  );
});

test('document-verification validator rejects a getter-backed field instead of a plain data property', () => {
  const hostile = { ...validDocumentRecord() };
  delete hostile.document_verification_state;
  Object.defineProperty(hostile, 'document_verification_state', {
    enumerable: true,
    configurable: true,
    get() { return DOCUMENT_VERIFIED; },
  });
  assert.throws(
    () => validateDocumentVerificationRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('document-verification builder rejects input whose fields are only inherited, never its own', () => {
  const valid = validDocumentRecord();
  const inheritedOnly = Object.create({ ...valid });
  assert.deepEqual(Object.keys(inheritedOnly), []);
  assert.equal(inheritedOnly.deal_id, valid.deal_id); // inherited, not own
  assert.throws(
    () => buildDocumentVerificationRecord(inheritedOnly),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('document-verification validator and builder reject non-plain-object records outright', () => {
  for (const bad of [null, 'x', 42, ['a'], () => {}]) {
    assert.throws(
      () => buildDocumentVerificationRecord(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
    assert.throws(
      () => validateDocumentVerificationRecord(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
  }
  // undefined is special-cased for the builder only: an omitted/undefined
  // top-level argument hits the documented `input = {}` default parameter
  // (the same convenience the header comment describes for individual
  // fields) and is then rejected per-field instead of at the shape gate.
  // The validator takes no such default, so undefined is exactly as
  // rejected there as any other non-plain value.
  assert.throws(
    () => validateDocumentVerificationRecord(undefined),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

// ---- corpus-completeness record: validator hardening -----------------------

test('corpus-completeness validator rejects a record whose prototype has been tampered with', () => {
  const valid = validCorpusRecord();
  const maliciousProto = { extra_authority: 'granted' };
  const hostile = Object.assign(Object.create(maliciousProto), valid);
  assert.deepEqual(Object.keys(hostile).sort(), Object.keys(valid).sort());
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('corpus-completeness validator rejects a null-prototype record', () => {
  const hostile = Object.assign(Object.create(null), validCorpusRecord());
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('corpus-completeness validator rejects the object-literal __proto__ prototype-injection vector', () => {
  const valid = validCorpusRecord();
  const hostile = { __proto__: { extra_authority: 'granted' }, ...valid };
  assert.notEqual(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('corpus-completeness validator rejects an ordinary own "__proto__" data property as an unexpected field', () => {
  const hostile = { ...validCorpusRecord() };
  Object.defineProperty(hostile, '__proto__', { value: 'evil', enumerable: true, configurable: true });
  assert.equal(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET' && error.details.unexpected.includes('__proto__'),
  );
});

test('corpus-completeness validator rejects a getter-backed field instead of a plain data property', () => {
  const hostile = { ...validCorpusRecord() };
  delete hostile.corpus_completeness_state;
  Object.defineProperty(hostile, 'corpus_completeness_state', {
    enumerable: true,
    configurable: true,
    get() { return HUMAN_VERIFIED_COMPLETE; },
  });
  assert.throws(
    () => validateCorpusCompletenessRecord(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('corpus-completeness builder rejects input whose fields are only inherited, never its own', () => {
  const valid = validCorpusRecord();
  const inheritedOnly = Object.create({ ...valid });
  assert.deepEqual(Object.keys(inheritedOnly), []);
  assert.equal(inheritedOnly.deal_id, valid.deal_id); // inherited, not own
  assert.throws(
    () => buildCorpusCompletenessRecord(inheritedOnly),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('corpus-completeness validator and builder reject non-plain-object records outright', () => {
  for (const bad of [null, 'x', 42, ['a'], () => {}]) {
    assert.throws(
      () => buildCorpusCompletenessRecord(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
    assert.throws(
      () => validateCorpusCompletenessRecord(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
  }
  // undefined is special-cased for the builder only: an omitted/undefined
  // top-level argument hits the documented `input = {}` default parameter
  // (the same convenience the header comment describes for individual
  // fields) and is then rejected per-field instead of at the shape gate.
  // The validator takes no such default, so undefined is exactly as
  // rejected there as any other non-plain value.
  assert.throws(
    () => validateCorpusCompletenessRecord(undefined),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

// ---- document-verification record: content identity ------------------------

test('document-verification content identity is stable for identical input', () => {
  const first = validDocumentRecord();
  const second = validDocumentRecord();
  assert.equal(first.document_verification_record_id, second.document_verification_record_id);
  assert.match(first.document_verification_record_id, /^[a-f0-9]{64}$/);
});

test('document-verification content identity changes whenever any bound field changes', () => {
  const base = validDocumentRecord();
  const differentDeal = validDocumentRecord({ deal_id: 'deal-beta' });
  const differentDocument = validDocumentRecord({ source_document_id: 'doc-beta-1' });
  const differentDocState = validDocumentRecord({ document_verification_state: DOCUMENT_NOT_VERIFIED });
  const ids = new Set([
    base.document_verification_record_id,
    differentDeal.document_verification_record_id,
    differentDocument.document_verification_record_id,
    differentDocState.document_verification_record_id,
  ]);
  assert.equal(ids.size, 4);
});

test('document-verification validator detects content whose fields no longer match its stale identity', () => {
  const valid = validDocumentRecord();
  const other = validDocumentRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, deal_id: other.deal_id }; // content changed, id left stale
  assert.throws(
    () => validateDocumentVerificationRecord(tampered),
    (error) => error.code === 'DOCUMENT_VERIFICATION_RECORD_MISMATCH',
  );
});

test('document-verification validator detects a directly tampered identity on an otherwise-correct record', () => {
  const valid = validDocumentRecord();
  const other = validDocumentRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, document_verification_record_id: other.document_verification_record_id };
  assert.throws(
    () => validateDocumentVerificationRecord(tampered),
    (error) => error.code === 'DOCUMENT_VERIFICATION_RECORD_MISMATCH',
  );
});

test('a validated document-verification record round-trips to an identical expected record', () => {
  const valid = validDocumentRecord();
  const revalidated = validateDocumentVerificationRecord(valid);
  assert.deepEqual(revalidated, valid);
});

// ---- corpus-completeness record: content identity ---------------------------

test('corpus-completeness content identity is stable for identical input', () => {
  const first = validCorpusRecord();
  const second = validCorpusRecord();
  assert.equal(first.corpus_completeness_record_id, second.corpus_completeness_record_id);
  assert.match(first.corpus_completeness_record_id, /^[a-f0-9]{64}$/);
});

test('corpus-completeness content identity changes whenever any bound field changes', () => {
  const base = validCorpusRecord();
  const differentDeal = validCorpusRecord({ deal_id: 'deal-beta' });
  const differentAsserter = validCorpusRecord({ corpus_completeness_asserted_by: OTHER_ASSERTER });
  const differentAssertedAt = validCorpusRecord({ corpus_completeness_asserted_at: LATER_ASSERTED_AT });
  const differentState = validCorpusRecord({ corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE });
  const ids = new Set([
    base.corpus_completeness_record_id,
    differentDeal.corpus_completeness_record_id,
    differentAsserter.corpus_completeness_record_id,
    differentAssertedAt.corpus_completeness_record_id,
    differentState.corpus_completeness_record_id,
  ]);
  assert.equal(ids.size, 5);
});

test('corpus-completeness validator detects content whose fields no longer match its stale identity', () => {
  const valid = validCorpusRecord();
  const other = validCorpusRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, deal_id: other.deal_id }; // content changed, id left stale
  assert.throws(
    () => validateCorpusCompletenessRecord(tampered),
    (error) => error.code === 'CORPUS_COMPLETENESS_RECORD_MISMATCH',
  );
});

test('corpus-completeness validator detects a directly tampered identity on an otherwise-correct record', () => {
  const valid = validCorpusRecord();
  const other = validCorpusRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, corpus_completeness_record_id: other.corpus_completeness_record_id };
  assert.throws(
    () => validateCorpusCompletenessRecord(tampered),
    (error) => error.code === 'CORPUS_COMPLETENESS_RECORD_MISMATCH',
  );
});

test('a validated corpus-completeness record round-trips to an identical expected record', () => {
  const valid = validCorpusRecord();
  const revalidated = validateCorpusCompletenessRecord(valid);
  assert.deepEqual(revalidated, valid);
});

// ---- immutability -----------------------------------------------------

test('built records and exported vocabularies are frozen', () => {
  const documentRecord = validDocumentRecord();
  assert.ok(Object.isFrozen(documentRecord));
  assert.throws(() => { documentRecord.deal_id = 'other'; }, /read only|Cannot assign/);

  const corpusRecord = validCorpusRecord();
  assert.ok(Object.isFrozen(corpusRecord));
  assert.throws(() => { corpusRecord.deal_id = 'other'; }, /read only|Cannot assign/);

  assert.ok(Object.isFrozen(CORPUS_COMPLETENESS_TRANSITIONS));
  assert.ok(Object.isFrozen(CORPUS_COMPLETENESS_TRANSITIONS[DEFAULT_CORPUS_COMPLETENESS_STATE]));
});
