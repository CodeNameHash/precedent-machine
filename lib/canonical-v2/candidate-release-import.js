const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateCandidateReleaseBundle } = require('./candidate-release');
const { validateSharedServingRow } = require('./shared-serving-row');
const { validateReviewedSourceSpecificRecord } = require('./source-specific-context');

const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_IMPORT_TIMEOUT_MS = 15_000;

class CandidateReleaseImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CandidateReleaseImportError';
    this.code = code;
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new TypeError(`${label} fields do not match the candidate release import contract`);
  }
}

function projectMarketObservation(observation, servingNamespaceId) {
  const dimensions = observation.dimensions;
  return Object.freeze({
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: observation.corpus_release_id,
    contract_fingerprint: observation.contract_fingerprint,
    metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
    market_observation_serving_key: observation.market_observation_serving_key,
    metric_slot_key: observation.metric_slot_key,
    governed_deal_key: observation.deal_key,
    deal_admission_id: observation.deal_admission_id,
    concept_key: observation.concept_key,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    party_role: observation.party.role,
    party_value: observation.party.value,
    party_capacity: observation.party.capacity,
    result_key: observation.result_key,
    result_version: observation.result_version,
    owner_type: observation.owner_type,
    owner_occurrence_id: observation.owner_occurrence_id,
    owner_revision_id: observation.owner_revision_id,
    scope_type: observation.scope_type,
    scope_id: observation.scope_id,
    value_slot_key: observation.value_slot_key,
    governed_ordinal: observation.ordinal,
    claim_state: observation.state,
    raw_value: observation.raw_value,
    canonical_value: observation.canonical_value,
    value_dimension: observation.value_dimension,
    canonical_unit: observation.canonical_unit,
    basis_key: observation.basis_key,
    eligibility_state: observation.eligibility_state,
    applicability_state: observation.applicability_state,
    examination_state: observation.examination_state,
    comparability_state: observation.comparability_state,
    sector: dimensions.sector,
    buyer: dimensions.buyer,
    merger_form: dimensions.merger_form,
    adviser_firms: [...dimensions.adviser_firms],
    lawyers: [...dimensions.lawyers],
    announce_year: dimensions.announce_year,
    deal_value_usd: dimensions.deal_value_usd,
    canonical_payload: observation,
    canonical_payload_digest: observation.canonical_payload_digest,
  });
}

function projectMarketExclusion(exclusion, servingNamespaceId) {
  const dimensions = exclusion.dimensions;
  return Object.freeze({
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: exclusion.corpus_release_id,
    contract_fingerprint: exclusion.contract_fingerprint,
    exclusion_serving_key: exclusion.exclusion_serving_key,
    metric_slot_key: exclusion.metric_slot_key,
    governed_deal_key: exclusion.deal_key,
    deal_admission_id: exclusion.deal_admission_id,
    concept_key: exclusion.concept_key,
    metric_key: exclusion.metric_key,
    metric_version: exclusion.metric_version,
    party_role: exclusion.party.role,
    party_value: exclusion.party.value,
    party_capacity: exclusion.party.capacity,
    basis_key: exclusion.basis_key,
    claim_state: exclusion.presence_state,
    eligibility_state: exclusion.eligibility_state,
    applicability_state: exclusion.applicability_state,
    examination_state: exclusion.examination_state,
    comparability_state: exclusion.comparability_state,
    exclusion_reason: exclusion.exclusion_reason,
    sector: dimensions.sector,
    buyer: dimensions.buyer,
    merger_form: dimensions.merger_form,
    adviser_firms: [...dimensions.adviser_firms],
    lawyers: [...dimensions.lawyers],
    announce_year: dimensions.announce_year,
    deal_value_usd: dimensions.deal_value_usd,
    canonical_payload: exclusion,
    canonical_payload_digest: exclusion.canonical_payload_digest,
  });
}

function projectExactDetailPackage(detailPackage, manifest) {
  validateSharedServingRow(detailPackage.row);
  const packageDigest = contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage);
  return Object.freeze({
    serving_namespace_id: manifest.serving_namespace_id,
    corpus_release_id: manifest.corpus_release_id,
    row_serving_key: detailPackage.row.row_serving_key,
    contract_fingerprint: manifest.contract_fingerprint,
    governed_deal_key: detailPackage.row.governed_deal_key,
    source_detail_reference_ids: detailPackage.references.map((reference) => reference.source_detail_reference_id),
    exact_detail_package_digest: packageDigest,
    canonical_payload: detailPackage,
    canonical_payload_digest: packageDigest,
  });
}

function buildCandidateReleaseImportPlan({ release, environment = 'staging' } = {}) {
  if (environment !== 'staging') throw new TypeError('candidate release imports are staging-only');
  validateCandidateReleaseBundle(release);
  const { manifest } = release;
  const frozenPairIds = [...new Set(release.shared_rows.map((row) => row.frozen_pair_id))].sort();
  const body = {
    schema_version: 'CANDIDATE_RELEASE_IMPORT_PLAN/V1',
    environment,
    release_record: {
      corpus_release_id: manifest.corpus_release_id,
      candidate_manifest_id: manifest.candidate_release_manifest_id,
      frozen_pair_root_id: contentId('FROZEN_PAIR_SET/V1', frozenPairIds),
      contract_fingerprint: manifest.contract_fingerprint,
      projection_version: 'canonical-v2-serving/v1',
      response_schema_version: 'MARKET_COHORT_RESULT/V1',
      canonical_payload: manifest,
      canonical_payload_digest: manifest.canonical_payload_digest,
    },
    market_observations: release.market_observations.map((row) => (
      projectMarketObservation(row, manifest.serving_namespace_id)
    )),
    market_exclusions: release.market_exclusions.map((row) => (
      projectMarketExclusion(row, manifest.serving_namespace_id)
    )),
    query_records: release.query_records,
    source_specific_records: release.source_specific_serving_records,
    exact_detail_packages: release.exact_detail_packages.map((detailPackage) => (
      projectExactDetailPackage(detailPackage, manifest)
    )),
    expected_counts: {
      market_observations: release.market_observations.length,
      market_exclusions: release.market_exclusions.length,
      query_records: release.query_records.length,
      source_specific_records: release.source_specific_serving_records.length,
      exact_detail_packages: release.exact_detail_packages.length,
    },
  };
  const plan = Object.freeze({
    ...body,
    candidate_release_import_plan_id: contentId('CANDIDATE_RELEASE_IMPORT_PLAN/V1', body),
  });
  validateCandidateReleaseImportPlan(plan);
  return plan;
}

function validateCandidateReleaseImportPlan(plan) {
  requireExactKeys(plan, [
    'schema_version',
    'environment',
    'release_record',
    'market_observations',
    'market_exclusions',
    'query_records',
    'source_specific_records',
    'exact_detail_packages',
    'expected_counts',
    'candidate_release_import_plan_id',
  ], 'candidate release import plan');
  if (plan.schema_version !== 'CANDIDATE_RELEASE_IMPORT_PLAN/V1' || plan.environment !== 'staging') {
    throw new TypeError('candidate release import plan is staging-only');
  }
  requireExactKeys(plan.release_record, [
    'corpus_release_id',
    'candidate_manifest_id',
    'frozen_pair_root_id',
    'contract_fingerprint',
    'projection_version',
    'response_schema_version',
    'canonical_payload',
    'canonical_payload_digest',
  ], 'release_record');
  requireExactKeys(plan.expected_counts, [
    'market_observations',
    'market_exclusions',
    'query_records',
    'source_specific_records',
    'exact_detail_packages',
  ], 'expected_counts');
  for (const key of [
    'corpus_release_id',
    'candidate_manifest_id',
    'frozen_pair_root_id',
    'contract_fingerprint',
    'canonical_payload_digest',
  ]) requireDigest(plan.release_record[key], `release_record.${key}`);
  requireDigest(plan.candidate_release_import_plan_id, 'candidate_release_import_plan_id');
  const { candidate_release_import_plan_id: planId, ...body } = plan;
  if (planId !== contentId('CANDIDATE_RELEASE_IMPORT_PLAN/V1', body)) {
    throw new TypeError('candidate release import plan identity mismatch');
  }
  if (plan.release_record.candidate_manifest_id
      !== plan.release_record.canonical_payload.candidate_release_manifest_id
    || plan.release_record.corpus_release_id !== plan.release_record.canonical_payload.corpus_release_id
    || plan.release_record.contract_fingerprint !== plan.release_record.canonical_payload.contract_fingerprint
    || plan.release_record.canonical_payload_digest
      !== plan.release_record.canonical_payload.canonical_payload_digest) {
    throw new TypeError('release record does not close over its certified manifest');
  }
  const collections = [
    'market_observations',
    'market_exclusions',
    'query_records',
    'source_specific_records',
    'exact_detail_packages',
  ];
  for (const key of collections) {
    if (!Array.isArray(plan[key]) || plan.expected_counts[key] !== plan[key].length) {
      throw new TypeError(`candidate release import ${key} count mismatch`);
    }
  }
  for (const record of plan.market_observations) {
    if (canonicalJson(record) !== canonicalJson(projectMarketObservation(
      record.canonical_payload,
      record.serving_namespace_id,
    ))) throw new TypeError('market observation import record drift');
  }
  for (const record of plan.market_exclusions) {
    if (canonicalJson(record) !== canonicalJson(projectMarketExclusion(
      record.canonical_payload,
      record.serving_namespace_id,
    ))) throw new TypeError('market exclusion import record drift');
  }
  for (const record of plan.query_records) {
    validateSharedServingRow(record.canonical_payload);
    if (record.canonical_payload.row_kind !== 'CANONICAL_RESULT') {
      throw new TypeError('query import record must contain a canonical result');
    }
  }
  plan.source_specific_records.forEach(validateReviewedSourceSpecificRecord);
  for (const record of plan.exact_detail_packages) {
    validateSharedServingRow(record.canonical_payload.row);
    if (canonicalJson(record) !== canonicalJson(projectExactDetailPackage(
      record.canonical_payload,
      plan.release_record.canonical_payload,
    ))) throw new TypeError('exact-detail import record drift');
  }
  const releaseId = plan.release_record.corpus_release_id;
  const namespaceId = plan.release_record.canonical_payload.serving_namespace_id;
  const contractFingerprint = plan.release_record.contract_fingerprint;
  for (const record of collections.flatMap((key) => plan[key])) {
    if (record.corpus_release_id !== releaseId
      || record.serving_namespace_id !== namespaceId
      || record.contract_fingerprint !== contractFingerprint) {
      throw new TypeError('candidate release import record is outside its release partition');
    }
  }
  return true;
}

function validateCandidateReleaseImportReceipt(receipt, plan) {
  requireExactKeys(receipt, [
    'schema_version',
    'import_state',
    'replayed',
    'candidate_manifest_id',
    'corpus_release_id',
    'serving_namespace_id',
    'candidate_release_import_plan_id',
    'expected_counts',
    'imported_at',
  ], 'candidate release import receipt');
  if (receipt.schema_version !== 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V1'
    || receipt.import_state !== 'IMPORTED_COMPLETE'
    || typeof receipt.replayed !== 'boolean'
    || receipt.candidate_manifest_id !== plan.release_record.candidate_manifest_id
    || receipt.corpus_release_id !== plan.release_record.corpus_release_id
    || receipt.serving_namespace_id !== plan.release_record.canonical_payload.serving_namespace_id
    || receipt.candidate_release_import_plan_id !== plan.candidate_release_import_plan_id
    || canonicalJson(receipt.expected_counts) !== canonicalJson(plan.expected_counts)
    || typeof receipt.imported_at !== 'string'
    || !receipt.imported_at) {
    throw new CandidateReleaseImportError(
      'INVALID_RESPONSE',
      'Candidate release import receipt does not close over the certified import plan.',
    );
  }
  return receipt;
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CandidateReleaseImportError(
      'DEADLINE_EXCEEDED',
      'Candidate release import exceeded its deadline.',
    )), timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function importCandidateRelease({
  client,
  release,
  timeoutMs = DEFAULT_IMPORT_TIMEOUT_MS,
} = {}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new CandidateReleaseImportError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical writer RPC client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new CandidateReleaseImportError('INVALID_REQUEST', 'timeoutMs must be between 1 and 30000.');
  }
  const plan = buildCandidateReleaseImportPlan({ release });
  let response;
  try {
    response = await withDeadline(Promise.resolve(client.rpc('canonical_v2_import_candidate_release', {
      p_environment: 'staging',
      p_import_plan: plan,
    })), timeoutMs);
  } catch (error) {
    if (error instanceof CandidateReleaseImportError) throw error;
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Candidate release could not be imported.');
  }
  if (!response || response.error) {
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Candidate release could not be imported.');
  }
  return {
    plan,
    receipt: validateCandidateReleaseImportReceipt(response.data, plan),
  };
}

module.exports = {
  CandidateReleaseImportError,
  DEFAULT_IMPORT_TIMEOUT_MS,
  buildCandidateReleaseImportPlan,
  importCandidateRelease,
  projectExactDetailPackage,
  projectMarketExclusion,
  projectMarketObservation,
  validateCandidateReleaseImportReceipt,
  validateCandidateReleaseImportPlan,
};
