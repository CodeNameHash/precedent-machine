'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateM3SourceScopeCertificationSet,
} = require('./native-producer/m3-source-scope-certification');

const BUNDLE_SCHEMA = 'M3_PREVIEW_SOURCE_BUNDLE/V1';
const COHORT_SCHEMA = 'M3_PREVIEW_COHORT/V1';
const CANDIDATE_SET_SCHEMA = 'M3_PREVIEW_CANDIDATE_SET_BINDING/V1';
const REVIEW_FINDING_SCHEMA = 'M3_PREVIEW_REVIEW_FINDING/V1';
const PRESENTATION_SIDECAR_SCHEMA = 'M3_PREVIEW_PRESENTATION_SIDECAR/V1';
const DIGEST = /^[a-f0-9]{64}$/;
const APPLICATION_DEAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROVENANCE_TAGS = new Set(['MECHANICAL', 'AI', 'VERIFIED']);
const REVIEW_REQUIREMENTS = new Set(['NOT_REQUIRED', 'REQUIRED']);
const REVIEW_FINDING_STATUSES = new Set(['RESOLVED', 'WAIVED']);

const CANDIDATE_KEYS = Object.freeze([
  'candidate_id',
  'governed_deal_key',
  'deal_admission_id',
]);
const CANDIDATE_SET_KEYS = Object.freeze([
  'schema_version',
  'contract_fingerprint',
  'candidates',
  'candidate_set_id',
]);
const SOURCE_AUTHORITY_KEYS = Object.freeze([
  'source_occurrence_id',
  'source_document_id',
  'canonical_text_id',
  'evidence_closure_id',
]);
const REVIEW_FINDING_KEYS = Object.freeze([
  'schema_version',
  'review_finding_id',
  'status',
  'rationale_digest',
]);
const PRESENTATION_SIDECAR_KEYS = Object.freeze([
  'schema_version',
  'presentation_sidecar_id',
]);
const ROW_KEYS = Object.freeze([
  'row_serving_key',
  'row_kind',
  'canonical_value',
  'raw_value',
  'source_occurrence_id',
  'source_detail_reference_id',
  'source_document_id',
  'canonical_text_id',
  'evidence_closure_id',
  'candidate_id',
  'claim_revision_id',
  'classification',
  'answer_provenance_tag',
  'review_requirement',
  'review_finding',
  'presentation_sidecar',
]);
const DEAL_KEYS = Object.freeze([
  'application_deal_id',
  'governed_deal_key',
  'deal_admission_id',
  'candidate_id',
  'source_scope_certification_set_id',
  'source_scope_certification_set',
  'source_authority',
  'rows',
]);
const COHORT_KEYS = Object.freeze([
  'schema_version',
  'application_deal_ids',
  'm3_preview_cohort_id',
]);
const BUNDLE_KEYS = Object.freeze([
  'schema_version',
  'preview_epoch',
  'contract_fingerprint',
  'candidate_set',
  'cohort',
  'deals',
  'm3_preview_source_bundle_id',
]);

class M3PreviewSourceBundleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3PreviewSourceBundleError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new M3PreviewSourceBundleError(code, message, details);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function requireDigest(value, label) {
  if (!DIGEST.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_STRING', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireApplicationDealId(value, label) {
  if (!APPLICATION_DEAL_ID.test(value || '')) {
    fail('INVALID_APPLICATION_DEAL_ID', `${label} must be a lowercase UUID application deal ID.`);
  }
  return value;
}

function unique(values, code, message) {
  if (new Set(values).size !== values.length) fail(code, message);
}

function candidateKey(candidate) {
  return `${candidate.governed_deal_key}\u0000${candidate.deal_admission_id}`;
}

function normaliseCandidate(candidate, label) {
  if (!exactKeys(candidate, CANDIDATE_KEYS)) {
    fail('INVALID_CANDIDATE_BINDING', `${label} must match the closed candidate binding contract.`);
  }
  requireDigest(candidate.candidate_id, `${label}.candidate_id`);
  requireString(candidate.governed_deal_key, `${label}.governed_deal_key`);
  requireDigest(candidate.deal_admission_id, `${label}.deal_admission_id`);
  return { ...candidate };
}

function buildM3PreviewCandidateSetBinding({ contract_fingerprint: contractFingerprint, candidates } = {}) {
  requireDigest(contractFingerprint, 'contract_fingerprint');
  if (!Array.isArray(candidates) || candidates.length === 0) {
    fail('INVALID_CANDIDATE_SET', 'candidate set must contain one or more candidate bindings.');
  }
  const ordered = candidates.map((candidate, index) => normaliseCandidate(candidate, `candidates[${index}]`))
    .sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  unique(ordered.map((candidate) => candidate.candidate_id), 'DUPLICATE_CANDIDATE_ID', 'candidate set repeats a candidate identity.');
  unique(ordered.map(candidateKey), 'AMBIGUOUS_CANDIDATE_DEAL_MAPPING', 'candidate set maps more than one candidate to one governed deal admission.');
  const body = {
    schema_version: CANDIDATE_SET_SCHEMA,
    contract_fingerprint: contractFingerprint,
    candidates: ordered,
  };
  return freeze({
    ...body,
    candidate_set_id: contentId(CANDIDATE_SET_SCHEMA, body),
  });
}

function validateM3PreviewCandidateSetBinding(binding) {
  if (!exactKeys(binding, CANDIDATE_SET_KEYS) || binding.schema_version !== CANDIDATE_SET_SCHEMA) {
    fail('INVALID_CANDIDATE_SET', 'candidate set must match the closed V1 contract.');
  }
  requireDigest(binding.candidate_set_id, 'candidate_set_id');
  const rebuilt = buildM3PreviewCandidateSetBinding({
    contract_fingerprint: binding.contract_fingerprint,
    candidates: binding.candidates,
  });
  if (!same(binding, rebuilt)) {
    fail('CANDIDATE_SET_IDENTITY_MISMATCH', 'candidate set identity or ordering does not match its payload.');
  }
  return true;
}

function normaliseSourceAuthority(authority, label) {
  if (!exactKeys(authority, SOURCE_AUTHORITY_KEYS)) {
    fail('INVALID_SOURCE_AUTHORITY', `${label} must match the closed source authority contract.`);
  }
  for (const key of SOURCE_AUTHORITY_KEYS) requireDigest(authority[key], `${label}.${key}`);
  return { ...authority };
}

function normaliseReviewFinding(finding, label, requirement) {
  if (requirement === 'NOT_REQUIRED') {
    if (finding !== null) fail('INVALID_REVIEW_FINDING', `${label} must be null when review is not required.`);
    return null;
  }
  if (!exactKeys(finding, REVIEW_FINDING_KEYS) || finding.schema_version !== REVIEW_FINDING_SCHEMA) {
    fail('INVALID_REVIEW_FINDING', `${label} must be a sealed resolved or waived review finding.`);
  }
  requireDigest(finding.review_finding_id, `${label}.review_finding_id`);
  requireDigest(finding.rationale_digest, `${label}.rationale_digest`);
  if (!REVIEW_FINDING_STATUSES.has(finding.status)) {
    fail('INVALID_REVIEW_FINDING', `${label}.status must be RESOLVED or WAIVED.`);
  }
  const { review_finding_id: reviewFindingId, ...body } = finding;
  if (reviewFindingId !== contentId(REVIEW_FINDING_SCHEMA, body)) {
    fail('REVIEW_FINDING_IDENTITY_MISMATCH', `${label} identity does not match its payload.`);
  }
  return { ...finding };
}

function normalisePresentationSidecar(sidecar, label) {
  if (sidecar === null) return null;
  if (!exactKeys(sidecar, PRESENTATION_SIDECAR_KEYS)
    || sidecar.schema_version !== PRESENTATION_SIDECAR_SCHEMA) {
    fail('INVALID_PRESENTATION_SIDECAR', `${label} must be null or a sealed V1 presentation sidecar.`);
  }
  requireDigest(sidecar.presentation_sidecar_id, `${label}.presentation_sidecar_id`);
  return { ...sidecar };
}

function normaliseRow(row, label) {
  if (!exactKeys(row, ROW_KEYS)) fail('INVALID_SERVING_ROW', `${label} must match the closed serving-row contract.`);
  for (const key of [
    'row_serving_key', 'source_occurrence_id', 'source_detail_reference_id', 'source_document_id',
    'canonical_text_id', 'evidence_closure_id', 'candidate_id',
  ]) requireDigest(row[key], `${label}.${key}`);
  if (row.claim_revision_id !== null) requireDigest(row.claim_revision_id, `${label}.claim_revision_id`);
  requireString(row.row_kind, `${label}.row_kind`);
  requireString(row.canonical_value, `${label}.canonical_value`);
  if (row.raw_value !== null) requireString(row.raw_value, `${label}.raw_value`);
  requireString(row.classification, `${label}.classification`);
  if (!PROVENANCE_TAGS.has(row.answer_provenance_tag)) {
    fail('INVALID_PROVENANCE_TAG', `${label}.answer_provenance_tag is not recognised.`);
  }
  if (!REVIEW_REQUIREMENTS.has(row.review_requirement)) {
    fail('INVALID_REVIEW_REQUIREMENT', `${label}.review_requirement is not recognised.`);
  }
  return {
    ...row,
    review_finding: normaliseReviewFinding(row.review_finding, `${label}.review_finding`, row.review_requirement),
    presentation_sidecar: normalisePresentationSidecar(row.presentation_sidecar, `${label}.presentation_sidecar`),
  };
}

function certificateSources(set) {
  return set.certificates.map((certificate) => ({
    source_occurrence_id: certificate.admitted_source_context.source_occurrence_id,
    canonical_text_id: certificate.admitted_source_context.canonical_text_id,
  })).sort((left, right) => left.source_occurrence_id.localeCompare(right.source_occurrence_id));
}

function normaliseDeal(deal, index) {
  const label = `deals[${index}]`;
  if (!exactKeys(deal, DEAL_KEYS)) fail('INVALID_DEAL_BINDING', `${label} must match the closed deal contract.`);
  requireApplicationDealId(deal.application_deal_id, `${label}.application_deal_id`);
  requireString(deal.governed_deal_key, `${label}.governed_deal_key`);
  requireDigest(deal.deal_admission_id, `${label}.deal_admission_id`);
  requireDigest(deal.candidate_id, `${label}.candidate_id`);
  requireDigest(deal.source_scope_certification_set_id, `${label}.source_scope_certification_set_id`);
  try {
    validateM3SourceScopeCertificationSet(deal.source_scope_certification_set);
  } catch (error) {
    fail('INVALID_SOURCE_SCOPE_CERTIFICATION', `${label}.source_scope_certification_set is invalid.`, { cause: error.code });
  }
  const scope = deal.source_scope_certification_set;
  if (scope.certification_status !== 'CERTIFIED'
    || scope.m3_source_scope_certification_set_id !== deal.source_scope_certification_set_id
    || scope.governed_deal_key !== deal.governed_deal_key
    || scope.deal_admission_id !== deal.deal_admission_id) {
    fail('SOURCE_SCOPE_DRIFT', `${label} does not bind its certified governed deal source scope.`);
  }
  if (!Array.isArray(deal.source_authority) || deal.source_authority.length === 0) {
    fail('MISSING_SOURCE_AUTHORITY', `${label}.source_authority must contain the complete certified source scope.`);
  }
  const sourceAuthority = deal.source_authority.map((value, authorityIndex) => (
    normaliseSourceAuthority(value, `${label}.source_authority[${authorityIndex}]`)
  )).sort((left, right) => left.source_occurrence_id.localeCompare(right.source_occurrence_id));
  unique(sourceAuthority.map((value) => value.source_occurrence_id), 'DUPLICATE_SOURCE_AUTHORITY', `${label} repeats a source occurrence authority.`);
  const certifiedSources = certificateSources(scope);
  if (!same(sourceAuthority.map(({ source_occurrence_id, canonical_text_id }) => ({ source_occurrence_id, canonical_text_id })), certifiedSources)) {
    fail('SOURCE_SCOPE_DRIFT', `${label}.source_authority has a missing, extra or changed certified source.`);
  }
  if (!Array.isArray(deal.rows) || deal.rows.length === 0) {
    fail('MISSING_SERVING_ROWS', `${label}.rows must contain at least one source-bound serving row.`);
  }
  const authorityByOccurrence = new Map(sourceAuthority.map((value) => [value.source_occurrence_id, value]));
  const rows = deal.rows.map((value, rowIndex) => normaliseRow(value, `${label}.rows[${rowIndex}]`))
    .sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  unique(rows.map((row) => row.row_serving_key), 'DUPLICATE_ROW_SERVING_KEY', `${label} repeats a serving row identity.`);
  for (const row of rows) {
    const authority = authorityByOccurrence.get(row.source_occurrence_id);
    if (!authority
      || row.candidate_id !== deal.candidate_id
      || row.source_document_id !== authority.source_document_id
      || row.canonical_text_id !== authority.canonical_text_id
      || row.evidence_closure_id !== authority.evidence_closure_id) {
      fail('UNBOUND_SERVING_ROW', `${label} contains a row not bound to its deal candidate and certified source authority.`);
    }
  }
  return {
    ...deal,
    source_authority: sourceAuthority,
    rows,
  };
}

function buildCohort(deals) {
  const applicationDealIds = deals.map((deal) => deal.application_deal_id).sort();
  const body = {
    schema_version: COHORT_SCHEMA,
    application_deal_ids: applicationDealIds,
  };
  return {
    ...body,
    m3_preview_cohort_id: contentId(COHORT_SCHEMA, body),
  };
}

function validateCohort(cohort, deals) {
  if (!exactKeys(cohort, COHORT_KEYS) || cohort.schema_version !== COHORT_SCHEMA) {
    fail('INVALID_COHORT', 'cohort must match the closed V1 contract.');
  }
  requireDigest(cohort.m3_preview_cohort_id, 'cohort.m3_preview_cohort_id');
  const expected = buildCohort(deals);
  if (!same(cohort, expected)) fail('COHORT_DRIFT', 'cohort does not match the exact bundle deal cohort.');
}

function normaliseBundleInput({ preview_epoch: previewEpoch, contract_fingerprint: contractFingerprint, candidate_set: candidateSet, deals } = {}) {
  requireString(previewEpoch, 'preview_epoch');
  requireDigest(contractFingerprint, 'contract_fingerprint');
  validateM3PreviewCandidateSetBinding(candidateSet);
  if (candidateSet.contract_fingerprint !== contractFingerprint) {
    fail('CANDIDATE_SET_DRIFT', 'candidate set contract fingerprint does not bind this bundle.');
  }
  if (!Array.isArray(deals) || deals.length !== 4) {
    fail('INVALID_COHORT', 'M3 preview source bundle must contain exactly four deals.');
  }
  const orderedDeals = deals.map(normaliseDeal)
    .sort((left, right) => left.application_deal_id.localeCompare(right.application_deal_id));
  unique(orderedDeals.map((deal) => deal.application_deal_id), 'DUPLICATE_APPLICATION_DEAL_ID', 'cohort repeats an application deal identity.');
  unique(orderedDeals.map((deal) => deal.governed_deal_key), 'AMBIGUOUS_APPLICATION_GOVERNED_MAPPING', 'cohort maps application deals ambiguously to governed deals.');
  unique(orderedDeals.map((deal) => deal.deal_admission_id), 'AMBIGUOUS_DEAL_ADMISSION_MAPPING', 'cohort repeats a governed deal admission identity.');
  unique(orderedDeals.map((deal) => deal.candidate_id), 'DUPLICATE_CANDIDATE_ID', 'cohort repeats a candidate identity.');
  unique(orderedDeals.flatMap((deal) => deal.rows.map((row) => row.row_serving_key)), 'DUPLICATE_ROW_SERVING_KEY', 'cohort repeats a serving row identity.');
  const expectedCandidates = orderedDeals.map((deal) => ({
    candidate_id: deal.candidate_id,
    governed_deal_key: deal.governed_deal_key,
    deal_admission_id: deal.deal_admission_id,
  })).sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  if (!same(candidateSet.candidates, expectedCandidates)) {
    fail('CANDIDATE_SET_DRIFT', 'candidate set has a missing, extra or changed deal candidate binding.');
  }
  return {
    preview_epoch: previewEpoch,
    contract_fingerprint: contractFingerprint,
    candidate_set: candidateSet,
    deals: orderedDeals,
  };
}

function buildM3PreviewSourceBundle(input = {}) {
  const normalised = normaliseBundleInput(input);
  const body = {
    schema_version: BUNDLE_SCHEMA,
    preview_epoch: normalised.preview_epoch,
    contract_fingerprint: normalised.contract_fingerprint,
    candidate_set: normalised.candidate_set,
    cohort: buildCohort(normalised.deals),
    deals: normalised.deals,
  };
  return freeze({
    ...body,
    m3_preview_source_bundle_id: contentId(BUNDLE_SCHEMA, body),
  });
}

function validateM3PreviewSourceBundle(bundle) {
  if (!exactKeys(bundle, BUNDLE_KEYS) || bundle.schema_version !== BUNDLE_SCHEMA) {
    fail('INVALID_BUNDLE', 'M3 preview source bundle must match the closed V1 contract.');
  }
  requireDigest(bundle.m3_preview_source_bundle_id, 'm3_preview_source_bundle_id');
  const { m3_preview_source_bundle_id: bundleId, cohort, ...input } = bundle;
  const rebuilt = buildM3PreviewSourceBundle(input);
  validateCohort(cohort, rebuilt.deals);
  if (bundleId !== rebuilt.m3_preview_source_bundle_id || !same(bundle, rebuilt)) {
    fail('BUNDLE_IDENTITY_MISMATCH', 'M3 preview source bundle identity or canonical ordering does not match its payload.');
  }
  return true;
}

module.exports = {
  BUNDLE_SCHEMA,
  CANDIDATE_SET_SCHEMA,
  COHORT_SCHEMA,
  M3PreviewSourceBundleError,
  PRESENTATION_SIDECAR_SCHEMA,
  REVIEW_FINDING_SCHEMA,
  buildM3PreviewCandidateSetBinding,
  buildM3PreviewSourceBundle,
  validateM3PreviewCandidateSetBinding,
  validateM3PreviewSourceBundle,
};
