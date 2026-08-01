/**
 * lib/canonical-v2/verified-pin-sweep.js
 *
 * The SOURCE_SUPERSEDED executor (docs/superpowers/specs/2026-08-01-claim-
 * identity-provenance-design.md, section 5; round-2 audit finding 5: "the
 * rule needs an executor, not just a rule").
 *
 * Spec section 5's transition rule: "On source re-admission (a new canonical
 * text for the same filing), code compares the pinned hash: every VERIFIED
 * answer whose pin no longer matches routes back to review with a typed
 * `SOURCE_SUPERSEDED` reason -- it is never silently carried forward and
 * never silently dropped." This module is exactly that comparison, and
 * nothing else: no I/O, no model call, a pure function of its two inputs.
 *
 * WHAT "STORED VERIFIED ANSWER" MEANS HERE. Each entry is whatever shape a
 * caller's own storage layer keeps for an answer that carries a VERIFIED
 * `answer_provenance` (candidate-resolution.js's `buildVerifiedAnswerProvenance`
 * mints the shape this module expects: `{tag: 'VERIFIED', pins: {reviewer,
 * verified_at, canonical_text_hash, evidence_excerpt_id}}`). This module
 * does not care what else the entry carries -- it reads `answer_provenance`
 * and an `answer_id` (for reporting) and passes everything else through
 * unchanged in its outputs.
 *
 * FAIL CLOSED, TYPED, NEVER SILENT (house rule, this file's own instance of
 * it): an entry whose `answer_provenance.tag` is not `VERIFIED`, or whose
 * VERIFIED pins are missing the hash/excerpt this sweep needs to compare, is
 * NEVER silently treated as "unaffected" -- it is a typed residual of its
 * own, distinct from a genuine hash match.
 */

'use strict';

const SOURCE_SUPERSEDED_REASON = 'SOURCE_SUPERSEDED';
const PIN_SWEEP_RESULT_SCHEMA = 'VERIFIED_PIN_SWEEP_RESULT/V1';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function answerId(answer) {
  return answer && answer.answer_id != null ? answer.answer_id : null;
}

/**
 * @param {object} args
 * @param {object[]} args.stored_verified_answers   stored answers to sweep. Each
 *   is expected to carry `answer_provenance` (spec section 5 shape); an
 *   `answer_id` is used for reporting only, never for the comparison itself.
 * @param {object} args.readmitted_source_context    the re-admitted source's own
 *   context, carrying `canonical_text_hash` -- the SAME field name pinned
 *   inside a VERIFIED `answer_provenance.pins.canonical_text_hash`, so the
 *   comparison is a plain string equality, never a re-derivation.
 * @returns {{
 *   schema_version: string,
 *   routed: object[],
 *   unaffected: object[],
 *   residuals: object[],
 *   counts: object,
 * }}
 */
function sweepVerifiedPins({
  stored_verified_answers: storedVerifiedAnswers,
  readmitted_source_context: readmittedSourceContext,
} = {}) {
  if (!Array.isArray(storedVerifiedAnswers)) {
    throw new TypeError('stored_verified_answers must be an array');
  }
  if (!readmittedSourceContext || typeof readmittedSourceContext !== 'object'
    || Array.isArray(readmittedSourceContext)) {
    throw new TypeError('readmitted_source_context must be an object');
  }
  const readmittedHash = readmittedSourceContext.canonical_text_hash;
  if (!isNonEmptyString(readmittedHash)) {
    throw new TypeError('readmitted_source_context.canonical_text_hash must be a non-empty string');
  }

  const routed = [];
  const unaffected = [];
  const residuals = [];

  for (const answer of storedVerifiedAnswers) {
    const provenance = answer && typeof answer === 'object' ? answer.answer_provenance : undefined;

    // Not a VERIFIED answer at all: this sweep has nothing to compare, and
    // an entry with no VERIFIED tag is never routed as though it survived a
    // pin check it never had -- typed residual, not a silent pass-through.
    if (!provenance || provenance.tag !== 'VERIFIED') {
      residuals.push(Object.freeze({
        residual_type: 'PIN_SWEEP_NOT_VERIFIED',
        answer_id: answerId(answer),
        tag: provenance ? provenance.tag : null,
      }));
      continue;
    }

    const pins = provenance.pins;
    const pinnedHash = pins && pins.canonical_text_hash;
    const pinnedExcerptId = pins && pins.evidence_excerpt_id;

    // A VERIFIED tag with no pin to compare is exactly the "answers without
    // pins are typed residuals, never silently passed" case (plan Task 5
    // acceptance criteria) -- distinct from both a match and a supersession.
    if (!isNonEmptyString(pinnedHash) || !isNonEmptyString(pinnedExcerptId)) {
      residuals.push(Object.freeze({
        residual_type: 'PIN_SWEEP_MISSING_PIN',
        answer_id: answerId(answer),
      }));
      continue;
    }

    if (pinnedHash !== readmittedHash) {
      routed.push(Object.freeze({
        answer_id: answerId(answer),
        reason: SOURCE_SUPERSEDED_REASON,
        pinned_canonical_text_hash: pinnedHash,
        readmitted_canonical_text_hash: readmittedHash,
        evidence_excerpt_id: pinnedExcerptId,
        answer,
      }));
    } else {
      unaffected.push(answer);
    }
  }

  return Object.freeze({
    schema_version: PIN_SWEEP_RESULT_SCHEMA,
    routed: Object.freeze(routed),
    unaffected: Object.freeze(unaffected),
    residuals: Object.freeze(residuals),
    counts: Object.freeze({
      total: storedVerifiedAnswers.length,
      routed: routed.length,
      unaffected: unaffected.length,
      residuals: residuals.length,
    }),
  });
}

module.exports = {
  SOURCE_SUPERSEDED_REASON,
  PIN_SWEEP_RESULT_SCHEMA,
  sweepVerifiedPins,
};
