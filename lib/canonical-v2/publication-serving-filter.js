'use strict';

const {
  PUBLICATION_DISPOSITIONS,
  validatePublicationDispositionV2Identity,
} = require('./publication-disposition');

const PUBLICATION_FILTERS = Object.freeze({
  CANDIDATE_ELIGIBLE: 'CANDIDATE_ELIGIBLE',
  REQUIRE_PUBLISHED: 'REQUIRE_PUBLISHED',
});
const DIGEST_RE = /^[a-f0-9]{64}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isCanonicalUtcTimestamp(value) {
  return typeof value === 'string'
    && UTC_TIMESTAMP_RE.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(Date.parse(value)).toISOString() === value;
}

// A projection keeps its historical input when no publication filter is
// requested. Any requested filter is a serving boundary and must therefore
// prove the immutable sidecar before it returns an entry.
function publicationDispositionAllows(entry, publicationFilter, releaseReceiptId, publicationEvaluationTime) {
  if (publicationFilter === undefined || publicationFilter === null) return true;
  if (!Object.values(PUBLICATION_FILTERS).includes(publicationFilter)) return false;
  const sidecar = entry?.publication_disposition;
  const claimRevisionId = entry?.claim?.claim_revision_id;
  try {
    validatePublicationDispositionV2Identity(sidecar);
  } catch (_) {
    return false;
  }
  if (sidecar.claim_revision_id !== claimRevisionId) return false;
  if (publicationFilter === PUBLICATION_FILTERS.CANDIDATE_ELIGIBLE) {
    return isCanonicalUtcTimestamp(publicationEvaluationTime)
      && sidecar.evaluated_at === publicationEvaluationTime
      && sidecar.disposition === PUBLICATION_DISPOSITIONS.ELIGIBLE;
  }

  // V2 sidecars deliberately cannot carry PUBLISHED. A future serving
  // adapter must validate an immutable release receipt before changing this
  // branch. The receipt id is checked only to keep this API shape stable;
  // it cannot make a claim serve before that adapter exists.
  if (typeof releaseReceiptId !== 'string' || !DIGEST_RE.test(releaseReceiptId)) return false;
  return false;
}

function filterResolvedEntriesForPublication(entries, publicationFilter, releaseReceiptId, publicationEvaluationTime) {
  if (!Array.isArray(entries)) throw new TypeError('resolved entries must be an array');
  if (publicationFilter === undefined || publicationFilter === null) return entries;
  return entries.filter((entry) => publicationDispositionAllows(
    entry, publicationFilter, releaseReceiptId, publicationEvaluationTime,
  ));
}

module.exports = {
  PUBLICATION_FILTERS,
  publicationDispositionAllows,
  filterResolvedEntriesForPublication,
};
