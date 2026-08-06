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
// scale, and -- as of this revision -- must never collapse into one RECORD
// TYPE either:
//
//   1. Document verification -- is THIS individual filing's text genuinely
//      what was captured from its source? Mechanical, already implemented
//      and independently double-enforced (JS + SQL) elsewhere -- see
//      admission_state: 'VERIFIED' in lib/canonical-v2/sec-source-admission.js.
//      This module does not re-verify anything; it only records, in a closed
//      vocabulary, which side of that already-enforced fact a document is on.
//      Modelled below as Axis 1 records: one per (deal, source document).
//   2. Corpus completeness -- has a human confirmed the deal's document set
//      is all of it? A revisable human judgement, never a proof. This is the
//      axis the rejected proposal tried to make a signed authority answer.
//      Modelled below as Axis 2 records: one per DEAL, full stop.
//
// Earlier revisions of this module bound both axes into one per-document
// record (deal_id + source_document_id + both states together). That let a
// deal's corpus-completeness assertion silently vary per document:
// re-verifying a deal's corpus wrote the same assertion onto every document
// record in it, one at a time, and nothing stopped two documents in the same
// deal from disagreeing about their shared deal's completeness -- an
// incoherent state the model should make unrepresentable rather than merely
// discourage. Corpus completeness is a fact about the deal, not about any one
// filing in it, so it is now its own deal-keyed record type, independent of
// -- and structurally unable to reference -- the per-document record type.
//
// A document can be verified while its deal's corpus is not, and vice versa.
// The two record types below do not share a field: neither validator can
// read a value the other axis owns, because that value has nowhere to live
// on its record. assertDisjointVocabularies below is the load-time proof
// that the two closed STATE VOCABULARIES themselves can never collide either
// -- structural independence at both the record-shape layer and the
// vocabulary layer.
// ============================================================================

// ============================================================================
// ADVISORY, NOT A GATE -- read this before adding any function to this file
// ----------------------------------------------------------------------------
// corpus_completeness_state is a health warning surfaced ALONGSIDE a
// document, never a precondition for using it. The product owner was
// explicit: a filing is deemed verified on its own merits (Axis 1, above);
// the deal's corpus-completeness state is shown next to it so work can
// proceed with eyes open. It must never block, fence, or refuse anything.
//
// Concretely:
//   - this module must contain no admission-control language: no function
//     that throws because a corpus is unverified, and nothing named or
//     shaped like assertServable / isAdmissible / canServe;
//   - contrast lib/query/dark-authority-fence.js, which legitimately DOES
//     reject records over a *different* axis (document authenticity at the
//     query boundary) -- assertRowIsServable and assertNoDarkAuthorityRecords
//     there throw DarkAuthorityNotServableError on purpose. That is a real
//     admission-control fence. Nothing in *this* file may be mistaken for
//     that pattern, or grow into it by accretion;
//   - validateDocumentVerificationRecord and validateCorpusCompletenessRecord
//     below reject MALFORMED records: wrong shape, wrong field set,
//     wrong-typed value, drifted content identity. They must never reject a
//     well-formed record on the grounds that its corpus is unverified --
//     CORPUS_COMPLETENESS_NOT_HUMAN_VERIFIED is exactly as valid, and
//     exactly as accepted, as either human-judgement state. "Malformed" and
//     "unverified" are different questions; only the first one is this
//     module's business.
// ============================================================================

const DOCUMENT_VERIFICATION_RECORD_SCHEMA = 'DOCUMENT_VERIFICATION_RECORD/V1';
const CORPUS_COMPLETENESS_RECORD_SCHEMA = 'CORPUS_COMPLETENESS_RECORD/V1';

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
// Shared, unchanged, by both record types' builders and validators below.

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

// ---- Axis 1 vocabulary: document verification ------------------------------
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
  'DOCUMENT_TEXT_VERIFIED_AGAINST_SOURCE_BYTES',
  'DOCUMENT_TEXT_NOT_VERIFIED_AGAINST_SOURCE_BYTES',
]);

// ---- Axis 2 vocabulary: corpus completeness ---------------------------------
// Human judgement, never a proof: has a human confirmed we hold every
// relevant document for this deal? Per the ruling, the document set is
// legitimately open (amendments and further documents can always appear), so
// this can never be a permanent, mechanically-derived fact -- it is always
// somebody's current, revisable belief about the DEAL, not about any one
// document in it.
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
//   - This state is ADVISORY. See the "ADVISORY, NOT A GATE" banner above:
//     nothing in this module may treat this vocabulary as a precondition for
//     serving, using, or displaying anything.
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

assertDisjointVocabularies(
  DOCUMENT_VERIFICATION_STATES,
  CORPUS_COMPLETENESS_STATES,
  'The document-verification and corpus-completeness state vocabularies',
);

// ---- record field sets ------------------------------------------------------
// Two closed, disjoint field sets, one per record type. Neither list
// mentions a field the other axis owns: a corpus-completeness field cannot
// appear on a document-verification record (and vice versa) without failing
// the exact-field-set check in that record type's own validator, below.

const DOCUMENT_VERIFICATION_RECORD_FIELDS = Object.freeze([
  'schema_version',
  'deal_id',
  'source_document_id',
  'document_verification_state',
  'document_verification_record_id',
]);

const CORPUS_COMPLETENESS_RECORD_FIELDS = Object.freeze([
  'schema_version',
  'deal_id',
  'corpus_completeness_state',
  'corpus_completeness_asserted_by',
  'corpus_completeness_asserted_at',
  'corpus_completeness_record_id',
]);

// ============================================================================
// Axis 1 records: per-document verification
// ----------------------------------------------------------------------------
// One record per (deal, source document): does this filing's captured text
// match its original source bytes? See DOCUMENT_VERIFICATION_STATES above.
// This record type has no corpus-completeness field at all -- there is
// nothing here for a corpus-completeness reader to consult, accidentally or
// otherwise, and nothing here that could carry a stale corpus assertion
// forward when a document record is rebuilt.
// ============================================================================

// Builder: every field is required and explicitly validated. An omitted or
// explicitly-undefined field fails closed with a specific code rather than
// silently adopting a value nobody actually chose.
function buildDocumentVerificationRecord(input = {}) {
  requirePlainRecord(input, 'document-verification record input');
  const body = {
    schema_version: DOCUMENT_VERIFICATION_RECORD_SCHEMA,
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
  };
  return Object.freeze({
    ...body,
    document_verification_record_id: contentId(DOCUMENT_VERIFICATION_RECORD_SCHEMA, body),
  });
}

// Validator: closed exact-field-set check on an already-built record, then
// re-derives the expected record from the record's own field values through
// the same builder and requires byte-for-byte canonical agreement. This is
// deliberately delegated to the builder rather than duplicated: every
// field-level rule (INVALID_DEAL_ID, INVALID_SOURCE_DOCUMENT_ID,
// INVALID_DOCUMENT_VERIFICATION_STATE, ...) is enforced exactly once, and
// any record whose fields are individually valid but whose
// document_verification_record_id or overall bytes were nonetheless
// tampered with fails on the final comparison. Rejects MALFORMED records
// only -- see the "ADVISORY, NOT A GATE" banner above.
function validateDocumentVerificationRecord(record) {
  requirePlainRecord(record, 'document-verification record');
  requireOwnEnumerableDataFields(record, DOCUMENT_VERIFICATION_RECORD_FIELDS, 'document-verification record');
  exactFields(record, DOCUMENT_VERIFICATION_RECORD_FIELDS, 'document-verification record');
  const expected = buildDocumentVerificationRecord({
    deal_id: record.deal_id,
    source_document_id: record.source_document_id,
    document_verification_state: record.document_verification_state,
  });
  if (canonicalJson(record) !== canonicalJson(expected)) {
    fail(
      'DOCUMENT_VERIFICATION_RECORD_MISMATCH',
      'The record does not match its exact expected content, or its content identity has drifted from its current bytes.',
    );
  }
  return expected;
}

// ============================================================================
// Axis 2 records: deal-keyed corpus completeness
// ----------------------------------------------------------------------------
// One record per DEAL -- never per document: has a human confirmed we hold
// every relevant document for the deal? See CORPUS_COMPLETENESS_STATES
// above. Keying this record by deal_id alone is the fix this module exists
// to make: completeness is a fact about the deal's document set as a whole,
// so there is exactly one current corpus-completeness record per deal, and
// no per-document record can carry -- or disagree about -- its own copy of
// that fact. ADVISORY ONLY: see the banner at the top of this file.
// ============================================================================

// Binds the corpus-completeness state to its asserter/timestamp rule: the
// default state can never carry an asserter (nobody has judged anything),
// and both human-judgement states always must (see the Axis 2 vocabulary
// comment above). This is the single choke point that makes "a record
// asserting corpus-verified with no human asserter" impossible to construct.
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
// per-field default here (see buildInitialCorpusCompletenessRecord for the
// named convenience that supplies the documented default corpus state) --
// an omitted or explicitly-undefined field fails closed with a specific
// code rather than silently adopting a value nobody actually chose.
function buildCorpusCompletenessRecord(input = {}) {
  requirePlainRecord(input, 'corpus-completeness record input');
  const body = {
    schema_version: CORPUS_COMPLETENESS_RECORD_SCHEMA,
    deal_id: nonEmptyTrimmedString(input.deal_id, 'deal_id', 'INVALID_DEAL_ID'),
    ...corpusCompletenessAssertionFields({
      corpus_completeness_state: input.corpus_completeness_state,
      corpus_completeness_asserted_by: input.corpus_completeness_asserted_by,
      corpus_completeness_asserted_at: input.corpus_completeness_asserted_at,
    }),
  };
  return Object.freeze({
    ...body,
    corpus_completeness_record_id: contentId(CORPUS_COMPLETENESS_RECORD_SCHEMA, body),
  });
}

// Convenience for the common case -- establishing a deal's corpus-completeness
// record before any human has looked at it -- that makes the documented
// default (DEFAULT_CORPUS_COMPLETENESS_STATE) the only way to mint a
// "nobody has judged this deal's document set yet" record, rather than every
// call site having to spell out the null asserter/timestamp pair itself.
function buildInitialCorpusCompletenessRecord(input = {}) {
  requirePlainRecord(input, 'corpus-completeness record input');
  return buildCorpusCompletenessRecord({
    deal_id: input.deal_id,
    corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE,
    corpus_completeness_asserted_by: null,
    corpus_completeness_asserted_at: null,
  });
}

// Validator: closed exact-field-set check on an already-built record, then
// re-derives the expected record from the record's own field values through
// the same builder and requires byte-for-byte canonical agreement -- same
// idiom as validateDocumentVerificationRecord above, applied to this
// record's own field set. Rejects MALFORMED records only, and in particular
// NEVER rejects a well-formed record because its corpus_completeness_state
// happens to be the unverified default -- see the "ADVISORY, NOT A GATE"
// banner at the top of this file.
function validateCorpusCompletenessRecord(record) {
  requirePlainRecord(record, 'corpus-completeness record');
  requireOwnEnumerableDataFields(record, CORPUS_COMPLETENESS_RECORD_FIELDS, 'corpus-completeness record');
  exactFields(record, CORPUS_COMPLETENESS_RECORD_FIELDS, 'corpus-completeness record');
  const expected = buildCorpusCompletenessRecord({
    deal_id: record.deal_id,
    corpus_completeness_state: record.corpus_completeness_state,
    corpus_completeness_asserted_by: record.corpus_completeness_asserted_by,
    corpus_completeness_asserted_at: record.corpus_completeness_asserted_at,
  });
  if (canonicalJson(record) !== canonicalJson(expected)) {
    fail(
      'CORPUS_COMPLETENESS_RECORD_MISMATCH',
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

// Convenience that carries a previously-validated corpus-completeness
// record's deal_id forward unchanged and re-asserts only the corpus state,
// after checking the transition is legal. This is the explicit mechanism
// for the ruling's revocation requirement: e.g.
// transitionCorpusCompletenessState({ previous: verifiedRecord,
// corpus_completeness_state: DEFAULT_CORPUS_COMPLETENESS_STATE }) moves a
// deal's verified corpus back to not-human-verified when a later document
// appears. There is no document_verification_state to carry forward here --
// this record type never had one; see the Axis 2 records banner above.
function transitionCorpusCompletenessState({
  previous,
  corpus_completeness_state: corpusCompletenessState,
  corpus_completeness_asserted_by: corpusAssertedBy = null,
  corpus_completeness_asserted_at: corpusAssertedAt = null,
} = {}) {
  const validatedPrevious = validateCorpusCompletenessRecord(previous);
  assertLegalCorpusCompletenessTransition(validatedPrevious.corpus_completeness_state, corpusCompletenessState);
  return buildCorpusCompletenessRecord({
    deal_id: validatedPrevious.deal_id,
    corpus_completeness_state: corpusCompletenessState,
    corpus_completeness_asserted_by: corpusAssertedBy,
    corpus_completeness_asserted_at: corpusAssertedAt,
  });
}

module.exports = {
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
};
