const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  buildExactDetailReleaseEntry,
  buildValidatedSemanticGraphEntries,
  planActiveReleasePointerSwap,
  validateDealServingDirectoryRecord,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
} = require('./candidate-release');
const {
  validateCorrectionDischargeIdentity,
} = require('./candidate-correction-input');
const { validateCandidateCorrectionInputSealV2 } = require('./candidate-input-authority');
const { validateSharedServingRow } = require('./shared-serving-row');
const { validateReviewedSourceSpecificRecord } = require('./source-specific-context');

const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_IMPORT_TIMEOUT_MS = 15_000;
const DEFAULT_ROLLBACK_TIMEOUT_MS = 10_000;

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

function projectIncompleteCanonicalRecord({ row, exclusion, servingNamespaceId }) {
  validateSharedServingRow(row);
  if (row.row_kind !== 'INCOMPLETE_CANONICAL_RESULT') {
    throw new TypeError('incomplete canonical import record requires an incomplete canonical row');
  }
  const body = row.incomplete_canonical_result;
  if (!exclusion
    || exclusion.metric_slot_key !== body.metric_exclusion.metric_slot_key
    || exclusion.exclusion_serving_key !== body.metric_exclusion.exclusion_serving_key
    || exclusion.deal_key !== row.governed_deal_key
    || exclusion.deal_admission_id !== row.deal_admission_id
    || exclusion.concept_key !== body.concept_key
    || canonicalJson(exclusion.party) !== canonicalJson(body.party)
    || canonicalJson(exclusion.dimensions) !== canonicalJson(body.refinable_dimensions)
    || exclusion.comparability_state !== 'NOT_CERTIFIED'
    || body.metric_exclusion.cohort_membership !== 'NO_COHORT_MEMBERSHIP'
    || body.metric_exclusion.aggregate_authority !== 'NO_AGGREGATE_AUTHORITY') {
    throw new TypeError('incomplete canonical import record is outside its excluded metric slot');
  }
  const dimensions = body.refinable_dimensions;
  return Object.freeze({
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    row_serving_key: row.row_serving_key,
    contract_fingerprint: row.provenance.contract_fingerprint,
    governed_deal_key: row.governed_deal_key,
    concept_key: body.concept_key,
    metric_key: body.metric_exclusion.metric_key,
    metric_version: body.metric_exclusion.metric_version,
    party_role: body.party.role,
    party_value: body.party.value,
    party_capacity: body.party.capacity,
    basis_key: exclusion.basis_key,
    sector: dimensions.sector,
    buyer: dimensions.buyer,
    merger_form: dimensions.merger_form,
    adviser_firms: [...dimensions.adviser_firms],
    lawyers: [...dimensions.lawyers],
    announce_year: dimensions.announce_year,
    deal_value_usd: dimensions.deal_value_usd,
    canonical_numeric_value: null,
    fee_side: null,
    payer_capacity: null,
    payee_capacity: null,
    trigger_codes: [],
    payment_timings: [],
    trigger_conditions: [],
    criterion_code: null,
    contract_scope_code: null,
    cash_flow_direction_code: null,
    measurement_period_code: null,
    comparison_operator: null,
    canonical_payload: row,
    canonical_payload_digest: row.canonical_payload_digest,
  });
}

function incompleteExclusion(row, exclusions) {
  const body = row.incomplete_canonical_result;
  const matches = exclusions.filter((exclusion) => (
    exclusion.metric_slot_key === body.metric_exclusion.metric_slot_key
      && exclusion.exclusion_serving_key === body.metric_exclusion.exclusion_serving_key
      && exclusion.deal_key === row.governed_deal_key
      && exclusion.deal_admission_id === row.deal_admission_id
      && exclusion.concept_key === body.concept_key
      && canonicalJson(exclusion.party) === canonicalJson(body.party)
      && exclusion.comparability_state === 'NOT_CERTIFIED'
  ));
  if (matches.length !== 1) {
    throw new TypeError('incomplete canonical row does not select exactly one excluded metric slot');
  }
  return matches[0];
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

function projectValidatedSemanticGraphRecords({
  graphs,
  exactDetailPackages,
  manifest,
}) {
  const lineages = exactDetailPackages.flatMap((detailPackage) => {
    const row = detailPackage.row;
    return (detailPackage.detail_payloads || [])
      .flatMap((payload) => {
        const body = payload?.response_body;
        if (Array.isArray(body?.source_lineages)) return body.source_lineages;
        return body?.source_lineage ? [body.source_lineage] : [];
      })
      .filter(Boolean)
      .map((lineage) => ({
        document_hash: lineage.document_hash,
        canonical_text_id: lineage.canonical_text_id,
        governed_deal_key: row.governed_deal_key,
        deal_admission_id: row.deal_admission_id,
        source_admission_manifest_id: lineage.source_admission_manifest_id,
      }));
  });
  const { sortedGraphs, entries } = buildValidatedSemanticGraphEntries({ graphs, lineages });
  const graphsById = new Map(sortedGraphs.map((graph) => [graph.validated_semantic_graph_id, graph]));
  return entries.map((entry) => Object.freeze({
    serving_namespace_id: manifest.serving_namespace_id,
    corpus_release_id: manifest.corpus_release_id,
    contract_fingerprint: manifest.contract_fingerprint,
    validated_semantic_graph_id: entry.validated_semantic_graph_id,
    governed_deal_key: entry.governed_deal_key,
    deal_admission_id: entry.deal_admission_id,
    source_admission_manifest_id: entry.source_admission_manifest_id,
    document_hash: entry.document_hash,
    canonical_text_id: entry.canonical_text_id,
    definition_cue_count: entry.definition_cue_count,
    definition_use_cue_count: entry.definition_use_cue_count,
    canonical_payload: graphsById.get(entry.validated_semantic_graph_id),
    canonical_payload_digest: entry.payload_digest,
  }));
}

function projectCandidateCorrectionInputSeal({ seal, manifest }) {
  validateCandidateCorrectionInputSealV2(seal);
  const correctionInputRoot = contentId('FIXTURE_RELEASE_CORRECTION_INPUT/V2', {
    candidate_correction_input_seal_id: seal.candidate_correction_input_seal_id,
    canonical_payload_digest: seal.canonical_payload_digest,
    candidate_input_head_id: seal.candidate_input_head_id,
    candidate_input_head_payload_digest: seal.candidate_input_head_payload_digest,
    correction_discharge_map_id: seal.correction_discharge_map_id,
    correction_discharge_map_payload_digest: seal.correction_discharge_map_payload_digest,
    authority_active_correction_application_root:
      seal.roots.authority_active_correction_application_root,
    correction_authority_materialisation_root:
      seal.roots.correction_authority_materialisation_root,
    authority_correction_discharge_root: seal.roots.authority_correction_discharge_root,
    expected_active_application_root: seal.roots.expected_active_application_root,
    correction_entry_root: seal.roots.correction_entry_root,
    correction_discharge_root: seal.roots.correction_discharge_root,
  });
  if (seal.candidate_correction_input_seal_id !== manifest.correction_input_seal_id
    || seal.contract_fingerprint !== manifest.contract_fingerprint
    || correctionInputRoot !== manifest.roots.correction_input_root
    || seal.counts.expected_active_applications !== manifest.counts.correction_applications
    || seal.counts.correction_discharges !== manifest.counts.correction_discharges) {
    throw new TypeError('candidate correction input seal is outside its certified manifest');
  }
  return Object.freeze({
    serving_namespace_id: manifest.serving_namespace_id,
    corpus_release_id: manifest.corpus_release_id,
    contract_fingerprint: manifest.contract_fingerprint,
    correction_input_seal_id: seal.candidate_correction_input_seal_id,
    correction_input_root: manifest.roots.correction_input_root,
    canonical_payload: seal,
    canonical_payload_digest: seal.canonical_payload_digest,
  });
}

function projectCorrectionDischarge({ discharge, manifest }) {
  validateCorrectionDischargeIdentity(discharge);
  if (discharge.contract_fingerprint !== manifest.contract_fingerprint) {
    throw new TypeError('candidate correction discharge is outside its certified manifest');
  }
  return Object.freeze({
    serving_namespace_id: manifest.serving_namespace_id,
    corpus_release_id: manifest.corpus_release_id,
    contract_fingerprint: manifest.contract_fingerprint,
    correction_application_id: discharge.correction_application_id,
    correction_discharge_id: discharge.correction_discharge_id,
    canonical_payload: discharge,
    canonical_payload_digest: discharge.canonical_payload_digest,
  });
}

function projectCandidateInputAuthority({ seal, manifest }) {
  const authority = {
    contract_fingerprint: seal.contract_fingerprint,
    candidate_input_head_id: seal.candidate_input_head_id,
    candidate_input_head_payload_digest: seal.candidate_input_head_payload_digest,
    correction_discharge_map_id: seal.correction_discharge_map_id,
    correction_discharge_map_payload_digest: seal.correction_discharge_map_payload_digest,
  };
  Object.entries(authority).forEach(([key, value]) => requireDigest(value, key));
  if (authority.contract_fingerprint !== manifest.contract_fingerprint) {
    throw new TypeError('candidate input authority is outside its certified manifest');
  }
  return Object.freeze(authority);
}

function buildCandidateReleaseImportPlan({ release, environment = 'staging' } = {}) {
  if (environment !== 'staging') throw new TypeError('candidate release imports are staging-only');
  validateCandidateReleaseBundle(release);
  const { manifest } = release;
  const isV5 = release.schema_version === 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V2';
  const incompleteCanonicalRecords = isV5 ? release.incomplete_canonical_rows.map((row) => (
    projectIncompleteCanonicalRecord({
      row,
      exclusion: incompleteExclusion(row, release.market_exclusions),
      servingNamespaceId: manifest.serving_namespace_id,
    })
  )) : [];
  const frozenPairIds = [...new Set(release.shared_rows.map((row) => row.frozen_pair_id))].sort();
  const body = {
    schema_version: isV5 ? 'CANDIDATE_RELEASE_IMPORT_PLAN/V5' : 'CANDIDATE_RELEASE_IMPORT_PLAN/V4',
    environment,
    candidate_input_authority: projectCandidateInputAuthority({
      seal: release.candidate_correction_input_seal,
      manifest,
    }),
    release_record: {
      corpus_release_id: manifest.corpus_release_id,
      candidate_manifest_id: manifest.candidate_release_manifest_id,
      correction_input_seal_id: manifest.correction_input_seal_id,
      correction_input_root: manifest.roots.correction_input_root,
      frozen_pair_root_id: contentId('FROZEN_PAIR_SET/V1', frozenPairIds),
      contract_fingerprint: manifest.contract_fingerprint,
      projection_version: 'canonical-v2-serving/v1',
      response_schema_version: 'MARKET_COHORT_RESULT/V1',
      canonical_payload: manifest,
      canonical_payload_digest: manifest.canonical_payload_digest,
    },
    correction_input_seal_record: projectCandidateCorrectionInputSeal({
      seal: release.candidate_correction_input_seal,
      manifest,
    }),
    correction_discharge_records: release.correction_discharges.map((discharge) => (
      projectCorrectionDischarge({ discharge, manifest })
    )),
    deal_directory_records: release.deal_directory_records,
    market_observations: release.market_observations.map((row) => (
      projectMarketObservation(row, manifest.serving_namespace_id)
    )),
    market_exclusions: release.market_exclusions.map((row) => (
      projectMarketExclusion(row, manifest.serving_namespace_id)
    )),
    query_records: release.query_records,
    ...(isV5 ? { incomplete_canonical_records: incompleteCanonicalRecords } : {}),
    source_specific_records: release.source_specific_serving_records,
    exact_detail_packages: release.exact_detail_packages.map((detailPackage) => (
      projectExactDetailPackage(detailPackage, manifest)
    )),
    validated_semantic_graph_records: projectValidatedSemanticGraphRecords({
      graphs: release.validated_semantic_graphs,
      exactDetailPackages: release.exact_detail_packages,
      manifest,
    }),
    expected_counts: {
      correction_input_seal_records: 1,
      correction_discharge_records: release.correction_discharges.length,
      deal_directory_records: release.deal_directory_records.length,
      market_observations: release.market_observations.length,
      market_exclusions: release.market_exclusions.length,
      query_records: release.query_records.length,
      ...(isV5 ? { incomplete_canonical_records: incompleteCanonicalRecords.length } : {}),
      source_specific_records: release.source_specific_serving_records.length,
      exact_detail_packages: release.exact_detail_packages.length,
      validated_semantic_graph_records: release.validated_semantic_graphs.length,
    },
  };
  const plan = Object.freeze({
    ...body,
    candidate_release_import_plan_id: contentId(
      isV5 ? 'CANDIDATE_RELEASE_IMPORT_PLAN/V5' : 'CANDIDATE_RELEASE_IMPORT_PLAN/V4',
      body,
    ),
  });
  validateCandidateReleaseImportPlan(plan);
  return plan;
}

function validateCandidateReleaseImportPlan(plan) {
  const isV5 = plan?.schema_version === 'CANDIDATE_RELEASE_IMPORT_PLAN/V5';
  requireExactKeys(plan, [
    'schema_version',
    'environment',
    'candidate_input_authority',
    'release_record',
    'correction_input_seal_record',
    'correction_discharge_records',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'query_records',
    ...(isV5 ? ['incomplete_canonical_records'] : []),
    'source_specific_records',
    'exact_detail_packages',
    'validated_semantic_graph_records',
    'expected_counts',
    'candidate_release_import_plan_id',
  ], 'candidate release import plan');
  if (!['CANDIDATE_RELEASE_IMPORT_PLAN/V4', 'CANDIDATE_RELEASE_IMPORT_PLAN/V5']
    .includes(plan.schema_version) || plan.environment !== 'staging') {
    throw new TypeError('candidate release import plan is staging-only');
  }
  requireExactKeys(plan.candidate_input_authority, [
    'contract_fingerprint',
    'candidate_input_head_id',
    'candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
  ], 'candidate_input_authority');
  Object.entries(plan.candidate_input_authority).forEach(([key, value]) => (
    requireDigest(value, `candidate_input_authority.${key}`)
  ));
  requireExactKeys(plan.release_record, [
    'corpus_release_id',
    'candidate_manifest_id',
    'correction_input_seal_id',
    'correction_input_root',
    'frozen_pair_root_id',
    'contract_fingerprint',
    'projection_version',
    'response_schema_version',
    'canonical_payload',
    'canonical_payload_digest',
  ], 'release_record');
  requireExactKeys(plan.expected_counts, [
    'correction_input_seal_records',
    'correction_discharge_records',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'query_records',
    ...(isV5 ? ['incomplete_canonical_records'] : []),
    'source_specific_records',
    'exact_detail_packages',
    'validated_semantic_graph_records',
  ], 'expected_counts');
  for (const key of [
    'corpus_release_id',
    'candidate_manifest_id',
    'correction_input_seal_id',
    'correction_input_root',
    'frozen_pair_root_id',
    'contract_fingerprint',
    'canonical_payload_digest',
  ]) requireDigest(plan.release_record[key], `release_record.${key}`);
  requireDigest(plan.candidate_release_import_plan_id, 'candidate_release_import_plan_id');
  const { candidate_release_import_plan_id: planId, ...body } = plan;
  if (planId !== contentId(
    isV5 ? 'CANDIDATE_RELEASE_IMPORT_PLAN/V5' : 'CANDIDATE_RELEASE_IMPORT_PLAN/V4',
    body,
  )) {
    throw new TypeError('candidate release import plan identity mismatch');
  }
  if (plan.release_record.candidate_manifest_id
      !== plan.release_record.canonical_payload.candidate_release_manifest_id
    || plan.release_record.corpus_release_id !== plan.release_record.canonical_payload.corpus_release_id
    || plan.release_record.contract_fingerprint !== plan.release_record.canonical_payload.contract_fingerprint
    || plan.release_record.correction_input_seal_id
      !== plan.release_record.canonical_payload.correction_input_seal_id
    || plan.release_record.correction_input_root
      !== plan.release_record.canonical_payload.roots.correction_input_root
    || plan.release_record.canonical_payload_digest
      !== plan.release_record.canonical_payload.canonical_payload_digest) {
    throw new TypeError('release record does not close over its certified manifest');
  }
  validateCandidateReleaseManifest(plan.release_record.canonical_payload);
  if (isV5 !== (plan.release_record.canonical_payload.schema_version
      === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2')
    || (isV5 && plan.expected_counts.incomplete_canonical_records
      !== plan.release_record.canonical_payload.counts.incomplete_canonical_rows)) {
    throw new TypeError('incomplete canonical import partition does not equal its certified manifest');
  }
  const collections = [
    'correction_discharge_records',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'query_records',
    ...(isV5 ? ['incomplete_canonical_records'] : []),
    'source_specific_records',
    'exact_detail_packages',
    'validated_semantic_graph_records',
  ];
  if (plan.expected_counts.correction_input_seal_records !== 1) {
    throw new TypeError('candidate release import requires exactly one correction input seal');
  }
  for (const key of collections) {
    if (!Array.isArray(plan[key]) || plan.expected_counts[key] !== plan[key].length) {
      throw new TypeError(`candidate release import ${key} count mismatch`);
    }
  }
  const expectedSealRecord = projectCandidateCorrectionInputSeal({
    seal: plan.correction_input_seal_record?.canonical_payload,
    manifest: plan.release_record.canonical_payload,
  });
  if (canonicalJson(plan.correction_input_seal_record) !== canonicalJson(expectedSealRecord)) {
    throw new TypeError('candidate correction input seal import record drift');
  }
  const expectedCandidateInputAuthority = projectCandidateInputAuthority({
    seal: plan.correction_input_seal_record.canonical_payload,
    manifest: plan.release_record.canonical_payload,
  });
  if (canonicalJson(plan.candidate_input_authority)
      !== canonicalJson(expectedCandidateInputAuthority)) {
    throw new TypeError('candidate input authority does not equal its certified correction seal');
  }
  const expectedDischargeRecords = plan.correction_discharge_records.map((record) => (
    projectCorrectionDischarge({
      discharge: record.canonical_payload,
      manifest: plan.release_record.canonical_payload,
    })
  ));
  if (canonicalJson(plan.correction_discharge_records) !== canonicalJson(expectedDischargeRecords)) {
    throw new TypeError('candidate correction discharge import record drift');
  }
  const sealedDischarges = plan.correction_input_seal_record.canonical_payload.correction_entries.map((entry) => ({
    correction_application_id: entry.correction_application_id,
    correction_discharge_id: entry.correction_discharge_id,
    canonical_payload_digest: entry.correction_discharge_payload_digest,
  }));
  const importedDischarges = plan.correction_discharge_records.map((record) => ({
    correction_application_id: record.correction_application_id,
    correction_discharge_id: record.correction_discharge_id,
    canonical_payload_digest: record.canonical_payload_digest,
  }));
  if (canonicalJson(sealedDischarges) !== canonicalJson(importedDischarges)) {
    throw new TypeError('candidate correction discharge import set does not equal its seal');
  }
  plan.deal_directory_records.forEach(validateDealServingDirectoryRecord);
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
  for (const record of plan.incomplete_canonical_records || []) {
    const exclusion = incompleteExclusion(
      record.canonical_payload,
      plan.market_exclusions.map((item) => item.canonical_payload),
    );
    if (canonicalJson(record) !== canonicalJson(projectIncompleteCanonicalRecord({
      row: record.canonical_payload,
      exclusion,
      servingNamespaceId: record.serving_namespace_id,
    }))) {
      throw new TypeError('incomplete canonical import record drift');
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
  const exactDetailRoot = contentId(
    'FIXTURE_RELEASE_EXACT_DETAILS/V1',
    plan.exact_detail_packages.map((record) => buildExactDetailReleaseEntry(record.canonical_payload)),
  );
  if (exactDetailRoot !== plan.release_record.canonical_payload.roots.exact_detail_root) {
    throw new TypeError('exact-detail import records do not equal the certified release package set');
  }
  const certifiedRowsByKey = new Map([
    ...plan.query_records.map((record) => record.canonical_payload),
    ...(plan.incomplete_canonical_records || []).map((record) => record.canonical_payload),
    ...plan.source_specific_records.map((record) => record.canonical_payload),
  ].map((row) => [row.row_serving_key, row]));
  if (certifiedRowsByKey.size !== plan.query_records.length
      + (plan.incomplete_canonical_records?.length || 0)
      + plan.source_specific_records.length) {
    throw new TypeError('candidate release import row partitions overlap');
  }
  for (const record of plan.exact_detail_packages) {
    const detailRow = record.canonical_payload.row;
    const certifiedRow = certifiedRowsByKey.get(detailRow.row_serving_key);
    if (!certifiedRow || canonicalJson(detailRow) !== canonicalJson(certifiedRow)) {
      throw new TypeError('exact-detail import package row is not its independently certified shared row');
    }
  }
  const expectedGraphRecords = projectValidatedSemanticGraphRecords({
    graphs: plan.validated_semantic_graph_records.map((record) => record.canonical_payload),
    exactDetailPackages: plan.exact_detail_packages.map((record) => record.canonical_payload),
    manifest: plan.release_record.canonical_payload,
  });
  if (canonicalJson(plan.validated_semantic_graph_records) !== canonicalJson(expectedGraphRecords)) {
    throw new TypeError('validated semantic graph import record drift');
  }
  const releaseId = plan.release_record.corpus_release_id;
  const namespaceId = plan.release_record.canonical_payload.serving_namespace_id;
  const contractFingerprint = plan.release_record.contract_fingerprint;
  for (const record of [plan.correction_input_seal_record, ...collections.flatMap((key) => plan[key])]) {
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
    'candidate_input_authority',
    'correction_input_seal_id',
    'correction_input_root',
    'corpus_release_id',
    'serving_namespace_id',
    'candidate_release_import_plan_id',
    'expected_counts',
    'imported_at',
  ], 'candidate release import receipt');
  const expectedReceiptSchema = plan.schema_version === 'CANDIDATE_RELEASE_IMPORT_PLAN/V5'
    ? 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V5'
    : 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V4';
  if (receipt.schema_version !== expectedReceiptSchema
    || receipt.import_state !== 'IMPORTED_COMPLETE'
    || typeof receipt.replayed !== 'boolean'
    || receipt.candidate_manifest_id !== plan.release_record.candidate_manifest_id
    || canonicalJson(receipt.candidate_input_authority)
      !== canonicalJson(plan.candidate_input_authority)
    || receipt.correction_input_seal_id !== plan.release_record.correction_input_seal_id
    || receipt.correction_input_root !== plan.release_record.correction_input_root
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

async function withDeadline(promise, timeoutMs, message) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CandidateReleaseImportError(
      'DEADLINE_EXCEEDED',
      message,
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
    })), timeoutMs, 'Candidate release import exceeded its deadline.');
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

function validateCandidateReleaseRollbackReceipt(receipt, plan) {
  requireExactKeys(receipt, [
    'schema_version',
    'rollback_state',
    'candidate_manifest_id',
    'corpus_release_id',
    'serving_namespace_id',
    'candidate_release_import_plan_id',
    'active_pointer_id',
    'deleted_counts',
    'rolled_back_at',
  ], 'candidate release rollback receipt');
  const expectedDeletedCounts = {
    ...plan.expected_counts,
    import_receipts: 1,
    release_records: 1,
  };
  if (receipt.schema_version !== 'CANDIDATE_RELEASE_ROLLBACK_RECEIPT/V1'
    || receipt.rollback_state !== 'REMOVED_INACTIVE'
    || receipt.candidate_manifest_id !== plan.release_record.candidate_manifest_id
    || receipt.corpus_release_id !== plan.release_record.corpus_release_id
    || receipt.serving_namespace_id !== plan.release_record.canonical_payload.serving_namespace_id
    || receipt.candidate_release_import_plan_id !== plan.candidate_release_import_plan_id
    || canonicalJson(receipt.deleted_counts) !== canonicalJson(expectedDeletedCounts)
    || typeof receipt.rolled_back_at !== 'string'
    || !receipt.rolled_back_at) {
    throw new CandidateReleaseImportError(
      'INVALID_RESPONSE',
      'Candidate release rollback receipt does not close over the exact imported partition.',
    );
  }
  try {
    requireDigest(receipt.active_pointer_id, 'active_pointer_id');
  } catch {
    throw new CandidateReleaseImportError(
      'INVALID_RESPONSE',
      'Candidate release rollback receipt does not preserve the active pointer identity.',
    );
  }
  return receipt;
}

async function rollbackInactiveCandidateRelease({
  client,
  release,
  timeoutMs = DEFAULT_ROLLBACK_TIMEOUT_MS,
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
    response = await withDeadline(Promise.resolve(client.rpc(
      'canonical_v2_rollback_inactive_candidate_release',
      {
        p_environment: 'staging',
        p_candidate_manifest_id: plan.release_record.candidate_manifest_id,
        p_corpus_release_id: plan.release_record.corpus_release_id,
        p_serving_namespace_id: plan.release_record.canonical_payload.serving_namespace_id,
        p_candidate_release_import_plan_id: plan.candidate_release_import_plan_id,
      },
    )), timeoutMs, 'Candidate release rollback exceeded its deadline.');
  } catch (error) {
    if (error instanceof CandidateReleaseImportError) throw error;
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Inactive candidate release could not be rolled back.');
  }
  if (!response || response.error) {
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Inactive candidate release could not be rolled back.');
  }
  return {
    plan,
    receipt: validateCandidateReleaseRollbackReceipt(response.data, plan),
  };
}

async function activateCandidateRelease({
  client,
  currentPointer,
  release,
  timeoutMs = 2500,
} = {}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new CandidateReleaseImportError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical writer RPC client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new CandidateReleaseImportError('INVALID_REQUEST', 'timeoutMs must be between 1 and 10000.');
  }
  validateActiveReleasePointer(currentPointer);
  validateCandidateReleaseBundle(release);
  const transition = planActiveReleasePointerSwap({
    current_pointer: currentPointer,
    expected_current_pointer_id: currentPointer.pointer_id,
    candidate_manifest: release.manifest,
  });
  let response;
  try {
    response = await withDeadline(Promise.resolve(client.rpc('canonical_v2_activate_candidate_release', {
      p_environment: 'staging',
      p_expected_current_pointer: currentPointer,
      p_next_pointer: transition.next_pointer,
    })), timeoutMs, 'Candidate release activation exceeded its deadline.');
  } catch (error) {
    if (error instanceof CandidateReleaseImportError) throw error;
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Candidate release could not be activated.');
  }
  if (!response || response.error) {
    throw new CandidateReleaseImportError('DATA_SOURCE_ERROR', 'Candidate release could not be activated.');
  }
  try {
    validateActiveReleasePointer(response.data);
  } catch {
    throw new CandidateReleaseImportError('INVALID_RESPONSE', 'Active release response is not a valid pointer.');
  }
  if (canonicalJson(response.data) !== canonicalJson(transition.next_pointer)) {
    throw new CandidateReleaseImportError('INVALID_RESPONSE', 'Active release response does not match the planned pointer.');
  }
  return { transition, pointer: response.data };
}

module.exports = {
  activateCandidateRelease,
  CandidateReleaseImportError,
  DEFAULT_IMPORT_TIMEOUT_MS,
  DEFAULT_ROLLBACK_TIMEOUT_MS,
  buildCandidateReleaseImportPlan,
  importCandidateRelease,
  projectCandidateCorrectionInputSeal,
  projectCorrectionDischarge,
  projectExactDetailPackage,
  projectIncompleteCanonicalRecord,
  projectMarketExclusion,
  projectMarketObservation,
  projectValidatedSemanticGraphRecords,
  rollbackInactiveCandidateRelease,
  validateCandidateReleaseImportReceipt,
  validateCandidateReleaseImportPlan,
  validateCandidateReleaseRollbackReceipt,
};
