/**
 * lib/canonical-v2/native-producer/ruling-corpus.js
 *
 * The ruling corpus turns a human's confirmed qualifier-kind decision into a
 * mechanical rule a later run can apply without asking the question again.
 * Design spec: docs/superpowers/specs/2026-08-01-claim-identity-provenance-
 * design.md, section "4. Ruling corpus"; plan:
 * docs/superpowers/plans/2026-08-01-claim-identity-provenance-plan.md,
 * "Task 4: ruling corpus".
 *
 * KEY: (exact normalised phrase, attachment position, concept family). Phrase
 * alone is too coarse -- "in all material respects" ruled in a cap-rep
 * chapeau must not silently apply ITEM-attached or in a different concept
 * family (2026-08-01 audit finding A4). Open-world items carry the concept
 * family of their governing section-level provision; there is no null-family
 * ruling (round-2 audit finding 8) -- callers must supply one.
 *
 * RECORD: ruled kind (+ code where applicable), who ruled, when, the
 * provenance tag, and the lexicon version in force at ruling time. Every
 * record this module will ever APPLY has `provenance_tag === 'VERIFIED'`;
 * `lookupRuling`/`applyRuling` ignore anything else, so an unverified record
 * can sit in the file (e.g. hand-inspected for debugging) without ever
 * taking effect. In production only `scripts/confirm-kind-ruling.mjs` writes
 * this file, and it only ever constructs VERIFIED records -- AI drafts
 * (Task 7) can never enter the corpus.
 *
 * LOOKUP IS EXACT-KEY ONLY. Near-match never applies -- a one-character
 * difference in the normalised phrase, or a different attachment position or
 * concept family, is a miss, not a fuzzy hit. Anything not exact goes to
 * review, same as an unruled quote.
 *
 * LEXICON-CONFLICT CHECK IS INJECTED, NOT IMPORTED. This module must not
 * depend on `qualifier-kind-lexicon.js` (built in parallel, Task 2 of the
 * same plan). Every call to `applyRuling` takes a `classifyKind(normalised
 * Quote) -> {kind: string|null, code?: string|null}` function from the
 * caller and runs it itself; only an AFFIRMATIVE different-kind classifier
 * result is a conflict (round-2 audit finding 10 -- abstention, i.e.
 * `kind: null`, is not a conflict, because the lexicon abstaining is not
 * evidence the ruling is wrong). A conflict routes to a typed
 * `RULING_LEXICON_CONFLICT` outcome instead of applying silently, so a stale
 * ruling can never permanently override a lexicon improvement.
 *
 * CONTENT-ADDRESSED, VERSIONED, PIN-ABLE. `buildRulingCorpus` produces a
 * frozen corpus whose `ruling_corpus_id` is `contentId(...)` over the
 * corpus's own version and rulings (via canonical-bytes.js's `contentId`,
 * the same convention used everywhere else in this directory, e.g.
 * known-defect-registry.js's `known_defect_registry_id`). A resolution
 * receipt pins `{ruling_corpus_version, ruling_corpus_id}` so every applied
 * ruling is traceable to the exact corpus state that produced it, and two
 * corpora with the same rulings in the same order are provably the same
 * corpus.
 *
 * PURE LIBRARY MODULE. No filesystem, no network, no process access. All
 * I/O (reading/writing contracts/ruling-corpus/ruling-corpus.v1.json,
 * reading the review-queue artifact) lives in scripts/confirm-kind-ruling.mjs.
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const { normaliseForMatching } = require('../zero-width-normalise');

const RULING_CORPUS_SCHEMA = 'RULING_CORPUS/V1';
const RULING_CORPUS_ENTRY_SCHEMA = 'RULING_CORPUS_ENTRY/V1';

// The qualifier-kind families from the design spec, section 2, extended to
// six by P2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md
// section 2, "ruling-corpus vocabulary", audit M-2): one vocabulary, two
// sites (this list and the lexicon's QUALIFIER_KINDS), a shared-vector test
// pins they agree -- the lockstep convention. This module owns its own copy
// deliberately -- see the file header on why it must not import
// qualifier-kind-lexicon.js.
const QUALIFIER_KINDS = Object.freeze([
  'KNOWLEDGE',
  'TEMPORAL',
  'ACCURACY',
  'THRESHOLD',
  'DISCLOSURE_SCHEDULE_CARVEOUT',
  'PERFORMANCE_ASSUMPTION',
]);

// Attachment positions the producer emits (capitalisation-producer-prompt.js,
// qualifier-attachment.js): CHAPEAU governs the whole node, ITEM governs one
// limb, TRAILING sits after the last enumerated limb.
const ATTACHMENT_POSITIONS = Object.freeze(['CHAPEAU', 'ITEM', 'TRAILING']);

const PROVENANCE_TAGS = Object.freeze(['MECHANICAL', 'AI', 'VERIFIED']);

const ENTRY_KEYS = Object.freeze([
  'schema_version',
  'normalised_phrase',
  'attachment_position',
  'concept_family',
  'ruled_kind',
  'ruled_code',
  'ruler',
  'ruled_at',
  'provenance_tag',
  'lexicon_version_at_ruling',
]);

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

class RulingCorpusError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RulingCorpusError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new RulingCorpusError(code, message, details);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_FIELD', `${label} must be a non-empty string`, { label, value });
  }
  return value;
}

/**
 * The exact-match key this module indexes and looks entries up by. Exposed
 * so callers (and the confirmation script) can compute it the same way the
 * corpus does, rather than re-deriving their own version.
 * @param {{normalised_phrase: string, attachment_position: string, concept_family: string}} args
 * @returns {string}
 */
function rulingKey({ normalised_phrase: normalisedPhrase, attachment_position: attachmentPosition, concept_family: conceptFamily } = {}) {
  requireNonEmptyString(normalisedPhrase, 'normalised_phrase');
  requireNonEmptyString(attachmentPosition, 'attachment_position');
  requireNonEmptyString(conceptFamily, 'concept_family');
  // JSON-array-encode the three parts rather than joining on a delimiter
  // character: JSON.stringify's per-element quoting keeps the three parts
  // unambiguously separable regardless of their contents.
  return JSON.stringify([normalisedPhrase, attachmentPosition, conceptFamily]);
}

function validateEntryShape(entry, index) {
  const label = `ruling_corpus.rulings[${index}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_ENTRY', `${label} must be an object`, { index });
  }
  const actualKeys = Object.keys(entry).sort();
  const expectedKeys = [...ENTRY_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, i) => key !== expectedKeys[i])) {
    fail('INVALID_ENTRY', `${label} fields do not match the closed ruling-entry contract`, {
      index, actualKeys, expectedKeys,
    });
  }
  if (entry.schema_version !== RULING_CORPUS_ENTRY_SCHEMA) {
    fail('INVALID_ENTRY', `${label}.schema_version must be ${RULING_CORPUS_ENTRY_SCHEMA}`, { index });
  }
  requireNonEmptyString(entry.normalised_phrase, `${label}.normalised_phrase`);
  if (entry.normalised_phrase !== normaliseForMatching(entry.normalised_phrase)) {
    fail('INVALID_ENTRY', `${label}.normalised_phrase must already be zero-width-normalised`, { index });
  }
  if (!ATTACHMENT_POSITIONS.includes(entry.attachment_position)) {
    fail('INVALID_ENTRY', `${label}.attachment_position must be one of ${ATTACHMENT_POSITIONS.join(', ')}`, { index });
  }
  requireNonEmptyString(entry.concept_family, `${label}.concept_family`);
  if (!QUALIFIER_KINDS.includes(entry.ruled_kind)) {
    fail('INVALID_ENTRY', `${label}.ruled_kind must be one of ${QUALIFIER_KINDS.join(', ')}`, { index });
  }
  if (entry.ruled_code !== null && (typeof entry.ruled_code !== 'string' || entry.ruled_code.length === 0)) {
    fail('INVALID_ENTRY', `${label}.ruled_code must be null or a non-empty string`, { index });
  }
  requireNonEmptyString(entry.ruler, `${label}.ruler`);
  if (typeof entry.ruled_at !== 'string' || !ISO_TIMESTAMP_RE.test(entry.ruled_at)) {
    fail('INVALID_ENTRY', `${label}.ruled_at must be an ISO-8601 UTC timestamp`, { index });
  }
  if (!PROVENANCE_TAGS.includes(entry.provenance_tag)) {
    fail('INVALID_ENTRY', `${label}.provenance_tag must be one of ${PROVENANCE_TAGS.join(', ')}`, { index });
  }
  if (!Number.isInteger(entry.lexicon_version_at_ruling) || entry.lexicon_version_at_ruling < 1) {
    fail('INVALID_ENTRY', `${label}.lexicon_version_at_ruling must be a positive integer`, { index });
  }
}

/**
 * Validates a ruling-corpus object's shape, including duplicate-key
 * detection (two entries at the same exact key is a corrupt corpus, not a
 * "last one wins" situation). Throws `RulingCorpusError`; returns the
 * corpus unchanged when valid.
 */
function validateRulingCorpus(corpus) {
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) {
    fail('INVALID_CORPUS', 'ruling_corpus must be an object');
  }
  if (corpus.schema_version !== RULING_CORPUS_SCHEMA) {
    fail('INVALID_CORPUS', `ruling_corpus.schema_version must be ${RULING_CORPUS_SCHEMA}`);
  }
  if (!Number.isInteger(corpus.version) || corpus.version < 1) {
    fail('INVALID_CORPUS', 'ruling_corpus.version must be a positive integer');
  }
  if (!Array.isArray(corpus.rulings)) {
    fail('INVALID_CORPUS', 'ruling_corpus.rulings must be an array');
  }
  const seenKeys = new Set();
  corpus.rulings.forEach((entry, index) => {
    validateEntryShape(entry, index);
    const key = rulingKey(entry);
    if (seenKeys.has(key)) {
      fail('DUPLICATE_RULING_KEY', `ruling_corpus.rulings[${index}] duplicates an earlier entry's key`, { index, key });
    }
    seenKeys.add(key);
  });
  return corpus;
}

/**
 * Builds a frozen, content-addressed ruling corpus from a version number and
 * a rulings array. `ruling_corpus_id` is content-addressed over the version
 * and rulings, so two corpora with the same rulings in the same order are
 * the same corpus, and any change to the ruling set changes the id -- a
 * resolution receipt that pins this id can never point silently at a
 * different ruling set later.
 */
function buildRulingCorpus({ version, rulings } = {}) {
  const body = {
    schema_version: RULING_CORPUS_SCHEMA,
    version,
    rulings: (rulings || []).map((entry) => ({ schema_version: RULING_CORPUS_ENTRY_SCHEMA, ...entry })),
  };
  validateRulingCorpus(body);
  const corpus = Object.freeze({
    ...body,
    rulings: Object.freeze(body.rulings.map((entry) => Object.freeze({ ...entry }))),
    ruling_corpus_id: contentId(RULING_CORPUS_SCHEMA, body),
  });
  return corpus;
}

// The initial corpus is intentionally empty: no ruling has been confirmed
// yet. This module never invents one -- see the file header.
const EMPTY_RULING_CORPUS = buildRulingCorpus({ version: 1, rulings: [] });

/**
 * Content-derived id for a single ruling entry, independent of the corpus it
 * currently lives in. Used as the "originating ruling" link an applied
 * MECHANICAL outcome points back to.
 */
function rulingEntryId(entry) {
  const { schema_version: schemaVersion, ...rest } = entry;
  return contentId(RULING_CORPUS_ENTRY_SCHEMA, { schema_version: schemaVersion, ...rest });
}

/**
 * Looks up the ruling for an exact key, returning the entry (with its own
 * `ruling_id` attached) or `null` if none applies. Exact match only, and
 * only a `VERIFIED` entry ever applies -- an unverified record sitting in
 * the corpus (e.g. hand-inspected, or written by a future non-conforming
 * caller) is treated as absent, never as a near-match candidate.
 */
function lookupRuling(corpus, { normalised_phrase: normalisedPhrase, attachment_position: attachmentPosition, concept_family: conceptFamily } = {}) {
  validateRulingCorpus(corpus);
  const key = rulingKey({ normalised_phrase: normalisedPhrase, attachment_position: attachmentPosition, concept_family: conceptFamily });
  const entry = corpus.rulings.find((candidate) => candidate.provenance_tag === 'VERIFIED' && rulingKey(candidate) === key);
  if (!entry) return null;
  return Object.freeze({ ...entry, ruling_id: rulingEntryId(entry) });
}

/**
 * Applies the corpus to one quote's resolved key. Runs the exact-key lookup
 * FIRST; if a VERIFIED ruling applies, it ALSO runs the caller-supplied
 * `classifyKind` (the current lexicon's classifier, injected so this module
 * never depends on qualifier-kind-lexicon.js) against the same normalised
 * phrase. Only an affirmative different-kind classification is a conflict;
 * abstention (`kind: null`) or agreement is not.
 *
 * @param {object} corpus                a corpus from buildRulingCorpus (or EMPTY_RULING_CORPUS)
 * @param {object} args
 * @param {string} args.normalised_phrase
 * @param {string} args.attachment_position   CHAPEAU | ITEM | TRAILING
 * @param {string} args.concept_family
 * @param {(normalisedQuote: string) => {kind: (string|null), code?: (string|null)}} args.classifyKind
 * @returns {
 *   {outcome: 'APPLIED', kind: string, code: (string|null), ruling: object, provenance: object} |
 *   {outcome: 'RULING_LEXICON_CONFLICT', ruling: object, lexicon_kind: string} |
 *   {outcome: 'NO_RULING'}
 * }
 */
function applyRuling(corpus, {
  normalised_phrase: normalisedPhrase,
  attachment_position: attachmentPosition,
  concept_family: conceptFamily,
  classifyKind,
} = {}) {
  requireNonEmptyString(normalisedPhrase, 'normalised_phrase');
  requireNonEmptyString(attachmentPosition, 'attachment_position');
  requireNonEmptyString(conceptFamily, 'concept_family');
  if (typeof classifyKind !== 'function') {
    fail('MISSING_CLASSIFIER', 'applyRuling requires a classifyKind(normalisedQuote) function');
  }

  const entry = lookupRuling(corpus, { normalised_phrase: normalisedPhrase, attachment_position: attachmentPosition, concept_family: conceptFamily });
  if (!entry) {
    return Object.freeze({ outcome: 'NO_RULING' });
  }

  const lexiconResult = classifyKind(normalisedPhrase) || {};
  const lexiconKind = lexiconResult.kind == null ? null : lexiconResult.kind;
  const isAffirmativeConflict = lexiconKind !== null && lexiconKind !== entry.ruled_kind;

  if (isAffirmativeConflict) {
    return Object.freeze({
      outcome: 'RULING_LEXICON_CONFLICT',
      ruling: entry,
      lexicon_kind: lexiconKind,
    });
  }

  return Object.freeze({
    outcome: 'APPLIED',
    kind: entry.ruled_kind,
    code: entry.ruled_code,
    ruling: entry,
    provenance: Object.freeze({
      tag: 'MECHANICAL',
      pins: Object.freeze({
        ruling_corpus_id: corpus.ruling_corpus_id,
        ruling_corpus_version: corpus.version,
        originating_ruling_id: entry.ruling_id,
      }),
    }),
  });
}

/**
 * Returns a NEW frozen corpus with `entry` (a VERIFIED ruling built by the
 * caller -- normally `scripts/confirm-kind-ruling.mjs`) appended, and its
 * content address recomputed. Never mutates `corpus`. Rejects a duplicate
 * key so the same phrase/position/family cannot silently be re-ruled --
 * callers that intend to correct a ruling must remove the old entry first
 * (out of scope for this module: the confirmation script only appends).
 */
function appendRuling(corpus, entry) {
  validateRulingCorpus(corpus);
  if (entry.provenance_tag !== 'VERIFIED') {
    fail('NON_VERIFIED_RULING', 'appendRuling only accepts VERIFIED entries', { provenance_tag: entry.provenance_tag });
  }
  const key = rulingKey(entry);
  if (corpus.rulings.some((existing) => rulingKey(existing) === key)) {
    fail('DUPLICATE_RULING_KEY', 'a ruling already exists for this exact key', { key });
  }
  return buildRulingCorpus({
    version: corpus.version,
    rulings: [...corpus.rulings.map((existing) => ({ ...existing })), { ...entry }],
  });
}

module.exports = {
  RULING_CORPUS_SCHEMA,
  RULING_CORPUS_ENTRY_SCHEMA,
  QUALIFIER_KINDS,
  ATTACHMENT_POSITIONS,
  PROVENANCE_TAGS,
  RulingCorpusError,
  EMPTY_RULING_CORPUS,
  buildRulingCorpus,
  validateRulingCorpus,
  rulingKey,
  rulingEntryId,
  lookupRuling,
  applyRuling,
  appendRuling,
};
