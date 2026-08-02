/**
 * lib/canonical-v2/native-producer/review-queue-artifact.js
 *
 * The committed writer for the `RESOLUTION_REVIEW_QUEUE/V1` artifact (design
 * spec docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md,
 * "Pinned implementation decisions": "the resolver's `review_queue` bucket is
 * persisted by the run driver as a content-addressed
 * `RESOLUTION_REVIEW_QUEUE/V1` JSON artifact alongside the run receipt.
 * Tasks 4 and 7 read that artifact, not process memory." F28 third-live-run
 * handoff, known-limitations register item 3 / final-audit finding M4: "No
 * committed writer for the `RESOLUTION_REVIEW_QUEUE/V1` artifact ... three
 * scripts read it; the run driver writes `resolution.json` but not the
 * content-addressed queue artifact.")
 *
 * PURE, PASS-THROUGH BUILDER. This module mints no new fields on a queue
 * item and reshapes nothing -- `resolveCandidates`'s own `review_queue`
 * entries already carry `normalised_phrase` / `attachment_position` /
 * `concept_family` (the ruling-corpus key triple, spec section "4. Ruling
 * corpus") plus whatever other fields candidate-resolution.js put on them.
 * They pass through into the artifact's `review_queue` array verbatim, in
 * the order `resolveCandidates` already sorted them (materiality rank; see
 * candidate-resolution.js's own `reviewQueue.sort(...)`). This module does
 * not touch candidate-resolution.js and does not re-derive anything it
 * already computed.
 *
 * CONSUMER SHAPE, PINNED. The three scripts that read this artifact --
 * scripts/confirm-kind-ruling.mjs, scripts/draft-kind-rulings.mjs,
 * scripts/queue-volume-dry-run.mjs -- all expect exactly
 * `{schema_version: 'RESOLUTION_REVIEW_QUEUE/V1', review_queue: [...]}` at
 * the top level (queue-volume-dry-run.mjs additionally reads an optional
 * `deal_key` / `document_hash` for its deal-id fallback chain, which this
 * builder does not populate -- the run driver may add those itself before
 * writing to disk, this module does not need to know about deal identity).
 * Nothing in those three scripts changes.
 *
 * CONTENT-ADDRESSED, DETERMINISTIC. `review_queue_artifact_id` is derived
 * via the repo's own `contentId(domain, payload)` convention (canonical-
 * bytes.js), over the artifact's own schema-bearing body -- same run receipt
 * id and same review-queue contents always produce the same artifact id.
 *
 * COUNTS (docs/superpowers/specs/2026-08-02-lexical-disagreement-net-design
 * .md, "Auto-pass arithmetic"): the artifact's own top-level `counts`
 * aggregates `review_queue.length` and how many queue items carry the
 * lexical-disagreement wiring's `both_nets_clean: true` instrumentation
 * marker (candidate-resolution.js's `applyLexicalDisagreementWiring`) --
 * still purely a read of a field items already carry, never a re-derivation
 * of what "clean" means.
 *
 * STRICTLY ADDITIVE, OMITTED-WHEN-ABSENT (same convention `resolution_
 * receipt.lexical_disagreement_counts` uses): `counts` is added to the
 * CONTENT-ADDRESSED `artifactBody` ONLY when at least one queue item
 * actually carries `both_nets_clean: true`. `REVIEW_QUEUE_ARTIFACT_SCHEMA`
 * stays `RESOLUTION_REVIEW_QUEUE/V1` (unbumped) precisely because this
 * keeps every no-input / pre-lexical-net call byte-identical: a run whose
 * queue items carry no such marker at all produces the EXACT SAME
 * `artifactBody` (no `counts` key at all) this module produced before this
 * field existed, so committed pinned ids (e.g. tests/fixtures/canonical-v2/
 * skechers-first-live-run/review-queue.json) keep reproducing byte-for-byte
 * from identical inputs. Unconditionally adding `counts` under an unbumped
 * schema would have silently changed every existing artifact id -- exactly
 * the hazard this convention exists to avoid.
 */

'use strict';

const { contentId } = require('../canonical-bytes');

const REVIEW_QUEUE_ARTIFACT_SCHEMA = 'RESOLUTION_REVIEW_QUEUE/V1';

class ReviewQueueArtifactError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ReviewQueueArtifactError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ReviewQueueArtifactError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

/**
 * Builds a frozen, content-addressed `RESOLUTION_REVIEW_QUEUE/V1` artifact
 * out of one `resolveCandidates(...)` result.
 *
 * @param {object} args
 * @param {object} args.resolution     the object returned by
 *   `resolveCandidates(...)` (candidate-resolution.js); only its
 *   `review_queue` array is read, and its items pass through UNCHANGED.
 * @param {string} args.run_receipt_id the native-extraction run receipt id
 *   this resolution was computed from -- pinned onto the artifact so a later
 *   reader can trace the queue back to the exact run that produced it.
 * @returns {object} frozen `{schema_version, run_receipt_id, review_queue,
 *   counts, review_queue_artifact_id}`
 */
function buildReviewQueueArtifact({ resolution, run_receipt_id: runReceiptId } = {}) {
  if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
    fail('INVALID_INPUT', 'resolution must be a plain object', {});
  }
  if (!Array.isArray(resolution.review_queue)) {
    fail('INVALID_INPUT', "resolution.review_queue must be an array", {});
  }
  if (typeof runReceiptId !== 'string' || runReceiptId.length === 0) {
    fail('INVALID_INPUT', 'run_receipt_id must be a non-empty string', {});
  }

  // Pass-through, verbatim, preserving order: no reshaping, no re-sorting,
  // no dropped or added fields -- resolveCandidates already did the
  // materiality-rank ordering and already attached the ruling-corpus key
  // triple to every item that has one.
  const reviewQueue = [...resolution.review_queue];
  const bothNetsCleanCount = reviewQueue.filter((item) => item && item.both_nets_clean === true).length;

  const artifactBody = {
    schema_version: REVIEW_QUEUE_ARTIFACT_SCHEMA,
    run_receipt_id: runReceiptId,
    review_queue: reviewQueue,
    // Strictly additive: OMITTED entirely (not present-as-zero) when no
    // queue item carries both_nets_clean: true, so artifactBody -- and
    // hence review_queue_artifact_id -- stays byte-identical to pre-
    // lexical-net code for every run the lexical wiring never touched.
    ...(bothNetsCleanCount > 0 ? { counts: { review_queue: reviewQueue.length, both_nets_clean: bothNetsCleanCount } } : {}),
  };
  const reviewQueueArtifactId = contentId(REVIEW_QUEUE_ARTIFACT_SCHEMA, artifactBody);

  return deepFreeze({ ...artifactBody, review_queue_artifact_id: reviewQueueArtifactId });
}

/**
 * Stable JSON serialisation of a `RESOLUTION_REVIEW_QUEUE/V1` artifact, for
 * writing to disk. Uses the same key ordering every time a given artifact is
 * serialised (schema_version, run_receipt_id, review_queue,
 * review_queue_artifact_id -- the artifact's own natural field order),
 * pretty-printed for human readability in the repo's out-dir convention
 * (matches every other JSON.stringify(..., null, 2) call in the F28 driver
 * scripts).
 *
 * @param {object} artifact a `RESOLUTION_REVIEW_QUEUE/V1` artifact, as
 *   returned by `buildReviewQueueArtifact`.
 * @returns {string}
 */
function serialiseReviewQueueArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    fail('INVALID_INPUT', 'artifact must be a plain object', {});
  }
  const ordered = {
    schema_version: artifact.schema_version,
    run_receipt_id: artifact.run_receipt_id,
    review_queue: artifact.review_queue,
    // Same omit-when-absent convention as buildReviewQueueArtifact itself
    // -- 'counts' in artifact is the correct presence check (not a
    // truthiness check on artifact.counts) so an artifact that legitimately
    // never computed it never gains a `"counts": undefined` key here.
    ...('counts' in artifact ? { counts: artifact.counts } : {}),
    review_queue_artifact_id: artifact.review_queue_artifact_id,
  };
  return JSON.stringify(ordered, null, 2);
}

module.exports = {
  REVIEW_QUEUE_ARTIFACT_SCHEMA,
  ReviewQueueArtifactError,
  buildReviewQueueArtifact,
  serialiseReviewQueueArtifact,
};
