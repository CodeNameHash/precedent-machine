'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SOURCE_VERIFICATION_STATE_SCHEMA,
  DOCUMENT_VERIFICATION_STATES,
  CORPUS_COMPLETENESS_STATES,
  DEFAULT_CORPUS_COMPLETENESS_STATE,
  CORPUS_COMPLETENESS_TRANSITIONS,
  SourceVerificationStateError,
  assertDisjointVocabularies,
  assertLegalCorpusCompletenessTransition,
  buildInitialSourceVerificationState,
  buildSourceVerificationState,
  isLegalCorpusCompletenessTransition,
  transitionCorpusCompletenessState,
  validateSourceVerificationState,
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

function validRecord(overrides = {}) {
  return buildSourceVerificationState({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
    ...overrides,
  });
}

function initialRecord(overrides = {}) {
  return buildInitialSourceVerificationState({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
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

// ---- defaults -----------------------------------------------------------

test('the default corpus-completeness state is not-human-verified with no asserter', () => {
  assert.equal(DEFAULT_CORPUS_COMPLETENESS_STATE, 'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED');
  const record = initialRecord();
  assert.equal(record.schema_version, SOURCE_VERIFICATION_STATE_SCHEMA);
  assert.equal(record.corpus_completeness_state, DEFAULT_CORPUS_COMPLETENESS_STATE);
  assert.equal(record.corpus_completeness_asserted_by, null);
  assert.equal(record.corpus_completeness_asserted_at, null);
  assert.equal(record.deal_id, DEAL_ID);
  assert.equal(record.source_document_id, SOURCE_DOCUMENT_ID);
  assert.equal(record.document_verification_state, DOCUMENT_VERIFIED);
  assert.match(record.source_verification_state_id, /^[a-f0-9]{64}$/);
  assert.doesNotThrow(() => validateSourceVerificationState(record));
});

test('buildInitialSourceVerificationState rejects a non-plain input', () => {
  for (const bad of [null, 'x', 42, ['a']]) {
    assert.throws(
      () => buildInitialSourceVerificationState(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
  }
});

// ---- field-level validation ----------------------------------------------

test('deal_id and source_document_id must be non-empty trimmed strings', () => {
  for (const bad of ['', '   ', ' deal', 'deal ', 42, null, undefined, {}]) {
    assert.throws(
      () => buildSourceVerificationState({
        deal_id: bad,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: DOCUMENT_VERIFIED,
        corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
        corpus_completeness_asserted_by: null,
        corpus_completeness_asserted_at: null,
      }),
      (error) => error.code === 'INVALID_DEAL_ID',
      String(bad),
    );
    assert.throws(
      () => buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: bad,
        document_verification_state: DOCUMENT_VERIFIED,
        corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
        corpus_completeness_asserted_by: null,
        corpus_completeness_asserted_at: null,
      }),
      (error) => error.code === 'INVALID_SOURCE_DOCUMENT_ID',
      String(bad),
    );
  }
});

test('document_verification_state must be a member of its own closed vocabulary', () => {
  for (const bad of ['NOT_A_STATE', HUMAN_VERIFIED_COMPLETE, null, undefined, 1, {}]) {
    assert.throws(
      () => buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: bad,
        corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
        corpus_completeness_asserted_by: null,
        corpus_completeness_asserted_at: null,
      }),
      (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
      String(bad),
    );
  }
});

test('corpus_completeness_state must be a member of its own closed vocabulary', () => {
  for (const bad of ['NOT_A_STATE', DOCUMENT_VERIFIED, null, undefined, 1, {}]) {
    assert.throws(
      () => buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: DOCUMENT_VERIFIED,
        corpus_completeness_state: bad,
        corpus_completeness_asserted_by: null,
        corpus_completeness_asserted_at: null,
      }),
      (error) => error.code === 'INVALID_CORPUS_COMPLETENESS_STATE',
      String(bad),
    );
  }
});

test('the two vocabularies cannot be swapped into the wrong field', () => {
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: CORPUS_COMPLETENESS_STATES[0],
      corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
  );
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
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
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
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
  const hostile = {
    schema_version: SOURCE_VERIFICATION_STATE_SCHEMA,
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: null,
    corpus_completeness_asserted_at: null,
    source_verification_state_id: 'a'.repeat(64),
  };
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
  );
});

test('flagging a corpus incomplete is just as much a human judgement: it also requires an asserter', () => {
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
      corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: ASSERTED_AT,
    }),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
  );
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
      corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_TIMESTAMP',
  );
});

test('the default state cannot carry a dangling asserter or timestamp', () => {
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
      corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
      corpus_completeness_asserted_by: ASSERTER,
      corpus_completeness_asserted_at: null,
    }),
    (error) => error.code === 'CORPUS_DEFAULT_STATE_MUST_NOT_CARRY_ASSERTER',
  );
  assert.throws(
    () => buildSourceVerificationState({
      deal_id: DEAL_ID,
      source_document_id: SOURCE_DOCUMENT_ID,
      document_verification_state: DOCUMENT_VERIFIED,
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
      () => buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: DOCUMENT_VERIFIED,
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
      () => buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: DOCUMENT_VERIFIED,
        corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
        corpus_completeness_asserted_by: ASSERTER,
        corpus_completeness_asserted_at: bad,
      }),
      (error) => error.code === 'CORPUS_ASSERTION_REQUIRES_TIMESTAMP',
      String(bad),
    );
  }
});

// ---- axis independence ----------------------------------------------------

test('no combination of document-level verification implies corpus completeness', () => {
  for (const documentState of DOCUMENT_VERIFICATION_STATES) {
    for (const corpusState of CORPUS_COMPLETENESS_STATES) {
      const isDefault = corpusState === DEFAULT_CORPUS_COMPLETENESS_STATE;
      const record = buildSourceVerificationState({
        deal_id: DEAL_ID,
        source_document_id: SOURCE_DOCUMENT_ID,
        document_verification_state: documentState,
        corpus_completeness_state: corpusState,
        corpus_completeness_asserted_by: isDefault ? null : ASSERTER,
        corpus_completeness_asserted_at: isDefault ? null : ASSERTED_AT,
      });
      assert.equal(record.document_verification_state, documentState);
      assert.equal(record.corpus_completeness_state, corpusState);
      assert.doesNotThrow(() => validateSourceVerificationState(record));
    }
  }
  assert.doesNotThrow(() => buildSourceVerificationState({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_NOT_VERIFIED,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  }), 'an unverified document can still belong to a human-verified-complete corpus');
  assert.doesNotThrow(() => buildSourceVerificationState({
    deal_id: DEAL_ID,
    source_document_id: SOURCE_DOCUMENT_ID,
    document_verification_state: DOCUMENT_VERIFIED,
    corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
    corpus_completeness_asserted_by: null,
    corpus_completeness_asserted_at: null,
  }), 'a verified document does not by itself make its corpus human-verified');
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
  const initial = initialRecord();
  const verified = transitionCorpusCompletenessState({
    previous: initial,
    corpus_completeness_state: HUMAN_VERIFIED_COMPLETE,
    corpus_completeness_asserted_by: ASSERTER,
    corpus_completeness_asserted_at: ASSERTED_AT,
  });
  assert.equal(verified.corpus_completeness_state, HUMAN_VERIFIED_COMPLETE);
  assert.equal(verified.corpus_completeness_asserted_by, ASSERTER);
  assert.notEqual(verified.source_verification_state_id, initial.source_verification_state_id);

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
  const initial = initialRecord();
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

test('transitionCorpusCompletenessState preserves deal, document and document-verification fields', () => {
  const verified = validRecord();
  const flagged = transitionCorpusCompletenessState({
    previous: verified,
    corpus_completeness_state: HUMAN_FLAGGED_INCOMPLETE,
    corpus_completeness_asserted_by: OTHER_ASSERTER,
    corpus_completeness_asserted_at: LATER_ASSERTED_AT,
  });
  assert.equal(flagged.deal_id, verified.deal_id);
  assert.equal(flagged.source_document_id, verified.source_document_id);
  assert.equal(flagged.document_verification_state, verified.document_verification_state);
  assert.notEqual(flagged.source_verification_state_id, verified.source_verification_state_id);
});

test('transitionCorpusCompletenessState rejects a no-op transition on the default state', () => {
  const initial = initialRecord();
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
  const corrupted = shallowCopyWithout(initialRecord(), 'document_verification_state');
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

// ---- validator: closed exact-field-set ------------------------------------

test('validator rejects a record missing a required field', () => {
  const missing = shallowCopyWithout(validRecord(), 'source_document_id');
  assert.throws(
    () => validateSourceVerificationState(missing),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.missing.includes('source_document_id')
      && error.details.unexpected.length === 0,
  );
});

test('validator rejects a record with an unexpected extra field', () => {
  const extra = { ...validRecord(), extra_field: 'not part of the schema' };
  assert.throws(
    () => validateSourceVerificationState(extra),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET'
      && error.details.unexpected.includes('extra_field')
      && error.details.missing.length === 0,
  );
});

test('validator rejects wrong-value fields with the same specific codes as the builder', () => {
  const wrongState = { ...validRecord(), document_verification_state: 'NOT_A_STATE' };
  assert.throws(
    () => validateSourceVerificationState(wrongState),
    (error) => error.code === 'INVALID_DOCUMENT_VERIFICATION_STATE',
  );
});

// ---- validator: prototype pollution ---------------------------------------

test('validator rejects a record whose prototype has been tampered with', () => {
  const valid = validRecord();
  const maliciousProto = { extra_authority: 'granted' };
  const hostile = Object.assign(Object.create(maliciousProto), valid);
  assert.deepEqual(Object.keys(hostile).sort(), Object.keys(valid).sort());
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('validator rejects a null-prototype record', () => {
  const hostile = Object.assign(Object.create(null), validRecord());
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('validator rejects the object-literal __proto__ prototype-injection vector', () => {
  const valid = validRecord();
  const hostile = { __proto__: { extra_authority: 'granted' }, ...valid };
  assert.notEqual(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('validator rejects an ordinary own "__proto__" data property as an unexpected field', () => {
  const hostile = { ...validRecord() };
  Object.defineProperty(hostile, '__proto__', { value: 'evil', enumerable: true, configurable: true });
  assert.equal(Object.getPrototypeOf(hostile), Object.prototype);
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'INVALID_RECORD_FIELD_SET' && error.details.unexpected.includes('__proto__'),
  );
});

test('validator rejects a getter-backed field instead of a plain data property', () => {
  const hostile = { ...validRecord() };
  delete hostile.corpus_completeness_state;
  Object.defineProperty(hostile, 'corpus_completeness_state', {
    enumerable: true,
    configurable: true,
    get() { return HUMAN_VERIFIED_COMPLETE; },
  });
  assert.throws(
    () => validateSourceVerificationState(hostile),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('builder rejects input whose fields are only inherited, never its own', () => {
  const valid = validRecord();
  const inheritedOnly = Object.create({ ...valid });
  assert.deepEqual(Object.keys(inheritedOnly), []);
  assert.equal(inheritedOnly.deal_id, valid.deal_id); // inherited, not own
  assert.throws(
    () => buildSourceVerificationState(inheritedOnly),
    (error) => error.code === 'INVALID_RECORD_SHAPE',
  );
});

test('validator and builder reject non-plain-object records outright', () => {
  for (const bad of [null, undefined, 'x', 42, ['a'], () => {}]) {
    assert.throws(
      () => validateSourceVerificationState(bad),
      (error) => error.code === 'INVALID_RECORD_SHAPE',
      String(bad),
    );
  }
});

// ---- content identity: stability and drift detection -----------------------

test('content identity is stable for identical input', () => {
  const first = validRecord();
  const second = validRecord();
  assert.equal(first.source_verification_state_id, second.source_verification_state_id);
  assert.match(first.source_verification_state_id, /^[a-f0-9]{64}$/);
});

test('content identity changes whenever any bound field changes', () => {
  const base = validRecord();
  const differentAssertedAt = validRecord({ corpus_completeness_asserted_at: LATER_ASSERTED_AT });
  const differentAsserter = validRecord({ corpus_completeness_asserted_by: OTHER_ASSERTER });
  const differentDeal = validRecord({ deal_id: 'deal-beta' });
  const differentDocument = validRecord({ source_document_id: 'doc-beta-1' });
  const differentDocState = validRecord({ document_verification_state: DOCUMENT_NOT_VERIFIED });
  const ids = new Set([
    base.source_verification_state_id,
    differentAssertedAt.source_verification_state_id,
    differentAsserter.source_verification_state_id,
    differentDeal.source_verification_state_id,
    differentDocument.source_verification_state_id,
    differentDocState.source_verification_state_id,
  ]);
  assert.equal(ids.size, 6);
});

test('validator detects content whose fields no longer match its stale identity', () => {
  const valid = validRecord();
  const other = validRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, deal_id: other.deal_id }; // content changed, id left stale
  assert.throws(
    () => validateSourceVerificationState(tampered),
    (error) => error.code === 'SOURCE_VERIFICATION_STATE_MISMATCH',
  );
});

test('validator detects a directly tampered identity on an otherwise-correct record', () => {
  const valid = validRecord();
  const other = validRecord({ deal_id: 'deal-beta' });
  const tampered = { ...valid, source_verification_state_id: other.source_verification_state_id };
  assert.throws(
    () => validateSourceVerificationState(tampered),
    (error) => error.code === 'SOURCE_VERIFICATION_STATE_MISMATCH',
  );
});

test('a validated record round-trips to an identical expected record', () => {
  const valid = validRecord();
  const revalidated = validateSourceVerificationState(valid);
  assert.deepEqual(revalidated, valid);
});

// ---- immutability -----------------------------------------------------

test('built records and exported vocabularies are frozen', () => {
  const record = validRecord();
  assert.ok(Object.isFrozen(record));
  assert.throws(() => { record.deal_id = 'other'; }, /read only|Cannot assign/);
  assert.ok(Object.isFrozen(CORPUS_COMPLETENESS_TRANSITIONS));
  assert.ok(Object.isFrozen(CORPUS_COMPLETENESS_TRANSITIONS[DEFAULT_CORPUS_COMPLETENESS_STATE]));
});
