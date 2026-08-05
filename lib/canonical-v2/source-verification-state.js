'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

// ============================================================================
// Source Verification State
// ----------------------------------------------------------------------------
// Two independent trust axes over a deal's source documents. Conflating them
// is the central risk this module exists to prevent. The product owner
// rejected a prior cryptographic-controller/key-registry proposal
// (lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js) as the
// route to source trust, and ruled instead that:
//
//   - a deal's document set is legitimately OPEN: amendments and further
//     documents can always appear, so completeness can never be asserted as
//     a permanent fact;
//   - the default status is therefore NOT human verified;
//   - a human can verify the source set (a revisable judgement call, never a
//     signed authority's proof of completeness);
//   - a human can instruct an AI about other documents, rather than a signed
//     authority asserting completeness.
//
// That ruling separates two questions that must never collapse into one
// scale:
//
//   1. Document verification -- is THIS individual filing's text genuinely
//      what was captured from its source? Mechanical, already implemented
//      and independently double-enforced (JS + SQL) elsewhere -- see
//      admission_state: 'VERIFIED' in lib/canonical-v2/sec-source-admission.js.
//      This module does not re-verify anything; it only records, in a closed
//      vocabulary, which side of that already-enforced fact a document is on.
//   2. Corpus completeness -- has a human confirmed the deal's document set
//      is all of it? A revisable human judgement, never a proof. This is the
//      axis the rejected proposal tried to make a signed authority answer.
//
// A document can be verified while its deal's corpus is not, and vice versa.
// Nothing in this module ever derives one axis's value from the other's --
// see assertDisjointVocabularies below, enforced at module load.
// ============================================================================

const SOURCE_VERIFICATION_STATE_SCHEMA = 'SOURCE_VERIFICATION_STATE_RECORD/V1';

class SourceVerificationStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SourceVerificationStateError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new SourceVerificationStateError(code, message, details);
}

// ---- generic closed-shape helpers (small and local by design -- this
// module intentionally does not import validation helpers from sibling
// canonical-v2 modules; see the "copy small generic helpers, no cross-family
// runtime dependency" convention documented in legacy-card-bridge.js) -------

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function requirePlainRecord(value, label) {
  if (!isPlainRecord(value)) fail('INVALID_RECORD_SHAPE', `${label} must be a plain object.`);
  return value;
}

// Rejects a hostile record whose declared field is a getter/accessor (which
// could return a different value on each read -- e.g. once for the field
// checks below and again inside canonicalJson) rather than a plain,
// single-valued data property.
function requireOwnEnumerableDataFields(value, fields, label) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_RECORD_SHAPE', `${label}.${field} must be a plain enumerable data property.`, { field });
    }
  }
}

function exactFields(value, fields, label) {
  const expected = new Set(fields);
  const actual = Object.keys(value);
  const unexpected = actual.filter((field) => !expected.has(field));
  const missing = fields.filter((field) => !Object.hasOwn(value, field));
  if (unexpected.length || missing.length) {
    fail('INVALID_RECORD_FIELD_SET', `${label} does not have the exact closed field set.`, { missing, unexpected });
  }
}

function oneOf(value, allowed, label, code) {
  if (!allowed.includes(value)) {
    fail(code, `${label} must be one of the closed set: ${allowed.join(', ')}.`, { value });
  }
  return value;
}

function nonEmptyTrimmedString(value, label, code) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty, trimmed string.`);
  }
  return value;
}

// Strict canonical UTC form only (millisecond precision, literal Z): a
// content-addressed record must have exactly one valid string encoding of a
// given instant, or the same "when" could hash to two different content IDs.
const CANONICAL_ISO_UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function canonicalIsoTimestamp(value, label, code) {
  if (typeof value !== 'string' || !CANONICAL_ISO_UTC_TIMESTAMP_RE.test(value) || Number.isNaN(Date.parse(value))) {
    fail(code, `${label} must be a canonical ISO-8601 UTC timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).`);
  }
  return value;
}

// Structural proof that the two vocabularies below can never share a value:
// if they cannot share a value, no single state string can ever be
// simultaneously legal in both slots, so neither axis can silently stand in
// for the other. General-purpose (takes explicit vocabularies) so it is
// independently testable, not just a module-load side effect.
function assertDisjointVocabularies(vocabularyA, vocabularyB, label) {
  const overlap = vocabularyA.filter((value) => vocabularyB.includes(value));
  if (overlap.length > 0) {
    fail('VOCABULARY_OVERLAP', `${label} must never share a state value.`, { overlap });
  }
  return true;
}

// ---- Axis 1: document verification -----------------------------------------
// Mechanical fact, not a human judgement: has this document's captured text
// been independently verified against its original source bytes? (See
// lib/canonical-v2/sec-source-admission.js, which performs and
// double-enforces the actual verification; this vocabulary only records the
// outcome.) The positive value is deliberately DOCUMENT-scoped in its own
// name -- DOCUMENT_TEXT_... -- so it reads, on its own, as a claim about one
// filing's text and nothing about the deal's wider document set. It is the
// positive counterpart the codebase has lacked: today's only trust marker
// anywhere is the negative lib/query/dark-authority-fence.js
// SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY. This name must not be, and is
// not, read as "the corpus this document belongs to is complete."
const DOCUMENT_VERIFICATION_STATES = Object.freeze([
  'DOCUMENT_TEXT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES',
  'DOCUMENT_TEXT_NOT_VERIFIED_AGAINST_ORIGINAL_SOURCE_BYTES',
]);

// ---- Axis 2: corpus completeness --------------------------------------------
// Human judgement, never a proof: has a human confirmed we hold every
// relevant document for this deal? Per the ruling, the document set is
// legitimately open (amendments and further documents can always appear), so
// this can never be a permanent, mechanically-derived fact -- it is always
// somebody's current, revisable belief.
//
//   - CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED is the default: nobody has
//     passed judgement on the current document set. No asserter, ever (see
//     the builder below).
//   - CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE and
//     CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE are BOTH human judgements
//     under the ruling -- deciding something is missing is just as much a
//     human call as certifying completeness, so both require a real asserter
//     and a real timestamp. Neither is a passive default.
//   - Human verification is REVOCABLE (see CORPUS_COMPLETENESS_TRANSITIONS):
//     a later document appearing can move CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE
//     back to CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED. That revocability is
//     the whole point of the ruling -- completeness is never permanent.
const CORPUS_COMPLETENESS_STATES = Object.freeze([
  'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
  'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
  'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
]);

const DEFAULT_CORPUS_COMPLETENESS_STATE = 'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED';

// Design note -- "AI was instructed to look for further documents" is
// deliberately modelled as an EVENT, not a state, and does not appear in
// CORPUS_COMPLETENESS_STATES above.
//
// An instruction is a point-in-time act ("go look for more documents"), not
// a durable belief about completeness: it has no truth value of its own, and
// it must never be read as progress toward verification. The ruling is
// explicit that a human can instruct an AI INSTEAD OF a signed authority
// asserting completeness -- instructing is the low-ceremony alternative
// action, not a rung on a ladder toward the human judgement states. If it
// were promoted to a state it would need its own ad hoc expiry/overlap/
// supersession semantics that belong to an event log, not a state slot, and
// -- more importantly -- it would invite exactly the silent inference this
// module exists to forbid: treating AI activity as if it were evidence of
// (or progress toward) corpus completeness, when only a human judgement can
// move that axis. A durable audit trail of such instructions, if wanted,
// belongs in a separate append-only log keyed off this record's identity; it
// is out of scope for this state model.
const RECORD_FIELDS = Object.freeze([
  'schema_version',
  'deal_id',
  'source_document_id',
  'document_verification_state',
  'corpus_completeness_state',
  'corpus_completeness_asserted_by',
  'corpus_completeness_asserted_at',
  'source_verification_state_id',
]);

assertDisjointVocabularies(
  DOCUMENT_VERIFICATION_STATES,
  CORPUS_COMPLETENESS_STATES,
  'The document-verification and corpus-completeness state vocabularies',
);

// Binds the corpus-completeness state to its asserter/timestamp rule: the
// default state can never carry an asserter (nobody has judged anything),
// and both human-judgement states always must (see the axis-2 comment
// above). This is the single choke point that makes "a record asserting
// corpus-verified with no human asserter" impossible to construct.
function corpusCompletenessAssertionFields({
  corpus_completeness_state: corpusCompletenessState,
  corpus_completeness_asserted_by: assertedBy,
  corpus_completeness_asserted_at: assertedAt,
}) {
  oneOf(
    corpusCompletenessState,
    CORPUS_COMPLETENESS_STATES,
    'corpus_completeness_state',
    'INVALID_CORPUS_COMPLETENESS_STATE',
  );
  if (corpusCompletenessState === DEFAULT_CORPUS_COMPLETENESS_STATE) {
    if (assertedBy !== null || assertedAt !== null) {
      fail(
        'CORPUS_DEFAULT_STATE_MUST_NOT_CARRY_ASSERTER',
        'The not-human-verified default corpus state cannot carry a human asserter or timestamp.',
        { corpus_completeness_asserted_by: assertedBy, corpus_completeness_asserted_at: assertedAt },
      );
    }
    return {
      corpus_completeness_state: corpusCompletenessState,
      corpus_completeness_asserted_by: null,
      corpus_completeness_asserted_at: null,
    };
  }
  return {
    corpus_completeness_state: corpusCompletenessState,
    corpus_completeness_asserted_by: nonEmptyTrimmedString(
      assertedBy,
      'corpus_completeness_asserted_by',
      'CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER',
    ),
    corpus_completeness_asserted_at: canonicalIsoTimestamp(
      assertedAt,
      'corpus_completeness_asserted_at',
      'CORPUS_ASSERTION_REQUIRES_TIMESTAMP',
    ),
  };
}

// Builder: every field is required and explicitly validated. There is no
// per-field default here (see buildInitialSourceVerificationState for the
// named convenience that supplies the documented default corpus state) --
// an omitted or explicitly-undefined field fails closed with a specific
// code rather than silently adopting a value nobody actually chose.
function buildSourceVerificationState(input = {}) {
  requirePlainRecord(input, 'source-verification-state input');
  const body = {
    schema_version: SOURCE_VERIFICATION_STATE_SCHEMA,
    deal_id: nonEmptyTrimmedString(input.deal_id, 'deal_id', 'INVALID_DEAL_ID'),
    source_document_id: nonEmptyTrimmedString(
      input.source_document_id,
      'source_document_id',
      'INVALID_SOURCE_DOCUMENT_ID',
    ),
    document_verification_state: oneOf(
      input.document_verification_state,
      DOCUMENT_VERIFICATION_STATES,
      'document_verification_state',
      'INVALID_DOCUMENT_VERIFICATION_STATE',
    ),
    ...corpusCompletenessAssertionFields({
      corpus_completeness_state: input.corpus_completeness_state,
      corpus_completeness_asserted_by: input.corpus_completeness_asserted_by,
      corpus_completeness_asserted_at: input.corpus_completeness_asserted_at,
    }),
  };
  return Object.freeze({
    ...body,
    source_verification_state_id: contentId(SOURCE_VERIFICATION_STATE_SCHEMA, body),
  });
}

// Convenience for the common case -- a freshly admitted document, before any
// human has looked at corpus completeness -- that makes the documented
// default (DEFAULT_CORPUS_COMPLETENESS_STATE) the only way to mint a
// "nobody has judged this yet" record, rather than every call site having to
// spell out the null asserter/timestamp pair itself.
function buildInitialSourceVerificationState(input = {}) {
  requirePlainRecord(input, 'source-verification-state input');
  return buildSourceVerificationState({
    deal_id: input.deal_id,
    source_document_id: input.source_document_id,
    document_verification_state: input.document_verification_state,
    corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
    corpus_completeness_asserted_by: null,
    corpus_completeness_asserted_at: null,
  });
}

// Validator: closed exact-field-set check on an already-built record, then
// re-derives the expected record from the record's own field values through
// the same builder and requires byte-for-byte canonical agreement. This is
// deliberately delegated to the builder rather than duplicated: every
// field-level rule (INVALID_DEAL_ID, INVALID_CORPUS_COMPLETENESS_STATE,
// CORPUS_ASSERTION_REQUIRES_HUMAN_ASSERTER, ...) is enforced exactly once,
// and any record whose fields are individually valid but whose
// source_verification_state_id or overall bytes were nonetheless tampered
// with fails on the final comparison.
function validateSourceVerificationState(record) {
  requirePlainRecord(record, 'source-verification-state record');
  requireOwnEnumerableDataFields(record, RECORD_FIELDS, 'source-verification-state record');
  exactFields(record, RECORD_FIELDS, 'source-verification-state record');
  const expected = buildSourceVerificationState({
    deal_id: record.deal_id,
    source_document_id: record.source_document_id,
    document_verification_state: record.document_verification_state,
    corpus_completeness_state: record.corpus_completeness_state,
    corpus_completeness_asserted_by: record.corpus_completeness_asserted_by,
    corpus_completeness_asserted_at: record.corpus_completeness_asserted_at,
  });
  if (canonicalJson(record) !== canonicalJson(expected)) {
    fail(
      'SOURCE_VERIFICATION_STATE_MISMATCH',
      'The record does not match its exact expected content, or its content identity has drifted from its current bytes.',
    );
  }
  return expected;
}

// ---- corpus-completeness transitions ---------------------------------------
// Explicit adjacency table, not a rule derived purely from vocabulary
// membership: every legal corpus-completeness transition is listed here so
// the full legal graph is legible in one place and a future ruling can
// change it by editing this table alone.
//
// CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED -> itself is deliberately ABSENT.
// The default state carries no assertion (no asserter, no timestamp -- see
// corpusCompletenessAssertionFields above), so "transitioning" it to itself
// asserts nothing and corresponds to no real event. The two human-judgement
// states' self-loops, by contrast, ARE legal: re-entering the same judgement
// with a fresh asserter/timestamp is a genuine reaffirmation (e.g. a human
// re-confirming completeness later), not a no-op.
//
// Both human-judgement states can move back to
// CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED. That is the revocability the
// product owner's ruling turns on: a later document appearing must always be
// able to knock a verified (or flagged) corpus back to "nobody has judged
// the current document set" -- verification is never a permanent fact.
//
// Both human-judgement states can also move directly to each other
// (VERIFIED_COMPLETE <-> FLAGGED_INCOMPLETE): a human is free to correct
// their own prior judgement in either direction without an intervening
// "unjudged" step.
const CORPUS_COMPLETENESS_TRANSITIONS = Object.freeze({
  CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED: Object.freeze([
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
  ]),
  CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE: Object.freeze([
    'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
  ]),
  CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE: Object.freeze([
    'CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED',
    'CORPUS_COMPLETENESS_HUMAN_VERIFIED_COMPLETE',
    'CORPUS_COMPLETENESS_HUMAN_FLAGGED_INCOMPLETE',
  ]),
});

function isLegalCorpusCompletenessTransition(fromState, toState) {
  if (!Object.hasOwn(CORPUS_COMPLETENESS_TRANSITIONS, fromState)) return false;
  if (!CORPUS_COMPLETENESS_STATES.includes(toState)) return false;
  return CORPUS_COMPLETENESS_TRANSITIONS[fromState].includes(toState);
}

function assertLegalCorpusCompletenessTransition(fromState, toState) {
  if (!CORPUS_COMPLETENESS_STATES.includes(fromState) || !CORPUS_COMPLETENESS_STATES.includes(toState)) {
    fail(
      'INVALID_TRANSITION_STATE',
      'Both transition endpoints must be closed corpus-completeness states.',
      { from: fromState, to: toState },
    );
  }
  if (!isLegalCorpusCompletenessTransition(fromState, toState)) {
    fail(
      'ILLEGAL_CORPUS_COMPLETENESS_TRANSITION',
      `${fromState} cannot transition to ${toState}.`,
      { from: fromState, to: toState },
    );
  }
}

// Convenience that carries a previously-validated record's deal/document/
// document-verification fields forward unchanged and re-asserts only
// corpus-completeness, after checking the transition is legal. This is the
// explicit mechanism for the ruling's revocation requirement: e.g.
// transitionCorpusCompletenessState({ previous: verifiedRecord,
// corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE }) moves a
// verified corpus back to not-human-verified when a later document appears.
function transitionCorpusCompletenessState({
  previous,
  corpus_completeness_state: corpusCompletenessState,
  corpus_completeness_asserted_by: corpusAssertedBy = null,
  corpus_completeness_asserted_at: corpusAssertedAt = null,
} = {}) {
  const validatedPrevious = validateSourceVerificationState(previous);
  assertLegalCorpusCompletenessTransition(validatedPrevious.corpus_completeness_state, corpusCompletenessState);
  return buildSourceVerificationState({
    deal_id: validatedPrevious.deal_id,
    source_document_id: validatedPrevious.source_document_id,
    document_verification_state: validatedPrevious.document_verification_state,
    corpus_completeness_state: corpusCompletenessState,
    corpus_completeness_asserted_by: corpusAssertedBy,
    corpus_completeness_asserted_at: corpusAssertedAt,
  });
}

module.exports = {
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
};
