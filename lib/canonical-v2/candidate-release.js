const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  buildCorrectionDischarge,
  buildCorrectionOutputRef,
  validateCandidateCorrectionInputSeal,
  validateCorrectionDischargeIdentity,
} = require('./candidate-correction-input');
const {
  buildCandidateCorrectionInputSealV2,
  validateCandidateCorrectionInputSealV2,
  validateCandidateInputAuthoritySelection,
} = require('./candidate-input-authority');
const { validateContractBundle } = require('./contract-bundle');
const {
  validateValidatedDefinitionGraph,
  validateValidatedDefinitionGraphIdentity,
} = require('./definition-graph');
const {
  COMPOSITION_ACTION_SLOT_KEY,
  TERMINATION_FEE_TRIGGER_ACTION_SLOT_KEY,
  validateFixtureExactDetailPackage,
} = require('./exact-detail');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { projectSharedServingRowRecord } = require('./query-result');
const {
  buildOfflineInterpretedQueryProjectionRecord,
  validateOfflineInterpretedQueryProjectionRecord,
} = require('./query-result');
const {
  validateOfflineInterpretedResultCompositionDetailPackageStructure,
} = require('./admitted-composition-exact-detail');
const {
  validateOfflineInterpretedMarketMetricSlot,
} = require('./serving-projection');
const {
  validateOfflineInterpretedMarketCohortRequest,
  validateOfflineInterpretedMarketCohortResult,
} = require('./market-cohort-query');
const {
  projectReviewedSourceSpecificRecord,
  validateReviewedSourceSpecificRecord,
} = require('./source-specific-context');
const {
  assertMetricSlotPartition,
  validateProjectedMetricSlotOutput,
} = require('./serving-projection');
const {
  buildSubjectCohortMembershipReceipt,
  validateSharedServingRow,
} = require('./shared-serving-row');
const {
  validateOfflineCandidateSharedServingRow,
} = require('./shared-serving-row');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V1,
  SERVING_PROJECTION_VERSION_V2,
} = require('./serving-projection-contract');

const SHA256_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RELEASE_MEMBERS = 5000;
const MAX_COHORT_GROUPS = 50;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new TypeError(`${label} fields do not match the candidate release contract`);
  }
}

function validateServingProjectionBindingV2(binding) {
  requireExactKeys(binding, [
    'serving_projection_version',
    'query_projection_contract_digest',
  ], 'serving projection binding');
  if (binding.serving_projection_version !== SERVING_PROJECTION_VERSION_V2
    || binding.query_projection_contract_digest !== QUERY_PROJECTION_CONTRACT_DIGEST_V2) {
    throw new TypeError('serving projection binding is not the frozen v2 contract');
  }
  return true;
}

function entryRoot(domain, entries) {
  return contentId(domain, entries);
}

function buildExactDetailReleaseEntry(detailPackage) {
  return {
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: detailPackage.references[0].source_detail_reference_id,
    source_detail_payload_id: detailPackage.detail_payloads[0].source_detail_payload_id,
    parent_edge_id: detailPackage.parent_edges[0].parent_edge_id,
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage),
  };
}

function graphLineageFromMember(member) {
  const admittedSources = member?.exact_detail?.sources;
  const row = member?.shared_row;
  if (Array.isArray(admittedSources)) {
    if (admittedSources.length < 2) {
      throw new TypeError('multi-source release member requires at least two admitted sources');
    }
    return admittedSources.map((entry, index) => {
      requireExactKeys(entry, ['source', 'source_admission'], `exact_detail.sources[${index}]`);
      const source = entry.source;
      const sourceAdmission = entry.source_admission;
      if (source?.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1'
        || sourceAdmission?.schema_version !== 'SOURCE_ADMISSION_MANIFEST/V2'
        || sourceAdmission.source_admission_manifest_id !== source.source_admission_manifest_id
        || sourceAdmission.immutable_source_document_id !== source.immutable_source_document_id
        || sourceAdmission.canonical_text_id !== source.canonical_text_id
        || source.governed_deal_key !== row?.governed_deal_key
        || source.deal_admission_id !== row?.deal_admission_id) {
        throw new TypeError('multi-source admitted release member does not close over its graph lineage');
      }
      return {
        source,
        document_hash: source.document_hash,
        canonical_text_id: source.canonical_text_id,
        governed_deal_key: row.governed_deal_key,
        deal_admission_id: row.deal_admission_id,
        source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
      };
    });
  }
  const source = member?.exact_detail?.source;
  const sourceAdmission = member?.exact_detail?.source_admission;
  if (!source?.document_hash || !source?.canonical_text_id
    || !sourceAdmission?.source_admission_manifest_id
    || !row?.governed_deal_key || !row?.deal_admission_id) return null;
  if (source.schema_version === 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1') {
    if (sourceAdmission.schema_version !== 'SOURCE_ADMISSION_MANIFEST/V2'
      || sourceAdmission.source_admission_manifest_id !== source.source_admission_manifest_id
      || sourceAdmission.immutable_source_document_id !== source.immutable_source_document_id
      || sourceAdmission.canonical_text_id !== source.canonical_text_id
      || source.governed_deal_key !== row.governed_deal_key
      || source.deal_admission_id !== row.deal_admission_id) {
      throw new TypeError('admitted release member source does not close over its graph lineage');
    }
    return {
      source,
      document_hash: source.document_hash,
      canonical_text_id: source.canonical_text_id,
      governed_deal_key: row.governed_deal_key,
      deal_admission_id: row.deal_admission_id,
      source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    };
  }
  if (sourceAdmission.document_hash !== source.document_hash
    || sourceAdmission.canonical_text_id !== source.canonical_text_id
    || sourceAdmission.governed_deal_key !== row.governed_deal_key
    || sourceAdmission.deal_admission_id !== row.deal_admission_id) {
    throw new TypeError('release member source admission does not close over its graph lineage');
  }
  return {
    source,
    document_hash: source.document_hash,
    canonical_text_id: source.canonical_text_id,
    governed_deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
  };
}

function graphLineageFromDetailPackage(detailPackage) {
  const row = detailPackage?.row;
  const sourceLineages = (detailPackage?.detail_payloads || [])
    .flatMap((payload) => {
      const body = payload?.response_body;
      if (Array.isArray(body?.source_lineages)) return body.source_lineages;
      return body?.source_lineage ? [body.source_lineage] : [];
    })
    .filter(Boolean);
  if (!row?.governed_deal_key || !row?.deal_admission_id || sourceLineages.length < 1) return [];
  return sourceLineages.map((lineage) => {
    requireDigest(lineage.document_hash, 'graph source lineage document_hash');
    requireDigest(lineage.canonical_text_id, 'graph source lineage canonical_text_id');
    requireDigest(lineage.source_admission_manifest_id, 'graph source lineage source_admission_manifest_id');
    if (lineage.deal_admission_id !== row.deal_admission_id) {
      throw new TypeError('exact-detail source admission does not close over its release deal');
    }
    return {
      source: null,
      document_hash: lineage.document_hash,
      canonical_text_id: lineage.canonical_text_id,
      governed_deal_key: row.governed_deal_key,
      deal_admission_id: row.deal_admission_id,
      source_admission_manifest_id: lineage.source_admission_manifest_id,
    };
  });
}

function buildValidatedSemanticGraphEntries({
  graphs,
  lineages,
  validateSourceBytes = false,
}) {
  if (!Array.isArray(graphs) || graphs.length > MAX_RELEASE_MEMBERS) {
    throw new TypeError(`validated_semantic_graphs must contain at most ${MAX_RELEASE_MEMBERS} graphs`);
  }
  graphs.forEach((graph) => validateValidatedDefinitionGraphIdentity({ graph }));
  const sortedGraphs = [...graphs].sort((left, right) => (
    (left?.validated_semantic_graph_id || '').localeCompare(right?.validated_semantic_graph_id || '')
  ));
  if (new Set(sortedGraphs.map((graph) => graph?.validated_semantic_graph_id)).size !== sortedGraphs.length) {
    throw new TypeError('candidate release contains a duplicate validated semantic graph');
  }
  const entries = sortedGraphs.map((graph) => {
    const matching = lineages.filter((lineage) => (
      lineage.document_hash === graph?.document_hash
        && lineage.canonical_text_id === graph?.canonical_text_id
    ));
    if (matching.length < 1) {
      throw new TypeError('validated semantic graph has no admitted release source lineage');
    }
    const lineageKeys = [...new Set(matching.map((lineage) => canonicalJson({
      governed_deal_key: lineage.governed_deal_key,
      deal_admission_id: lineage.deal_admission_id,
      source_admission_manifest_id: lineage.source_admission_manifest_id,
    })))];
    if (lineageKeys.length !== 1) {
      throw new TypeError('validated semantic graph source lineage is ambiguous across release deals');
    }
    if (validateSourceBytes) {
      const source = matching.find((lineage) => lineage.source)?.source;
      if (!source) throw new TypeError('validated semantic graph has no immutable source for validation');
      validateValidatedDefinitionGraph({ source, graph });
    }
    const lineage = JSON.parse(lineageKeys[0]);
    return {
      validated_semantic_graph_id: graph.validated_semantic_graph_id,
      document_hash: graph.document_hash,
      canonical_text_id: graph.canonical_text_id,
      governed_deal_key: lineage.governed_deal_key,
      deal_admission_id: lineage.deal_admission_id,
      source_admission_manifest_id: lineage.source_admission_manifest_id,
      definition_cue_count: graph.definition_cues?.length,
      definition_use_cue_count: graph.definition_use_cues?.length,
      payload_digest: contentId('FIXTURE_RELEASE_VALIDATED_SEMANTIC_GRAPH_PAYLOAD/V1', graph),
    };
  });
  return { sortedGraphs, entries };
}

function buildDealServingDirectoryRecord({
  servingNamespaceId,
  corpusReleaseId,
  contractFingerprint,
  applicationDealId,
  governedDealKey,
  dealAdmissionId,
}) {
  requireDigest(servingNamespaceId, 'serving_namespace_id');
  requireDigest(corpusReleaseId, 'corpus_release_id');
  requireDigest(contractFingerprint, 'contract_fingerprint');
  requireDigest(dealAdmissionId, 'deal_admission_id');
  if (!UUID_RE.test(applicationDealId || '')) throw new TypeError('application_deal_id must be a UUID');
  if (typeof governedDealKey !== 'string' || !governedDealKey.trim()) {
    throw new TypeError('governed_deal_key must be a non-empty string');
  }
  const body = {
    schema_version: 'DEAL_SERVING_DIRECTORY_RECORD/V1',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractFingerprint,
    application_deal_id: applicationDealId.toLowerCase(),
    governed_deal_key: governedDealKey.trim(),
    deal_admission_id: dealAdmissionId,
  };
  return Object.freeze({
    ...body,
    deal_serving_directory_record_id: contentId('DEAL_SERVING_DIRECTORY_RECORD/V1', body),
    canonical_payload_digest: contentId('DEAL_SERVING_DIRECTORY_RECORD_PAYLOAD/V1', body),
  });
}

function validateDealServingDirectoryRecord(record) {
  requireExactKeys(record, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'application_deal_id',
    'governed_deal_key',
    'deal_admission_id',
    'deal_serving_directory_record_id',
    'canonical_payload_digest',
  ], 'deal serving directory record');
  const expected = buildDealServingDirectoryRecord({
    servingNamespaceId: record.serving_namespace_id,
    corpusReleaseId: record.corpus_release_id,
    contractFingerprint: record.contract_fingerprint,
    applicationDealId: record.application_deal_id,
    governedDealKey: record.governed_deal_key,
    dealAdmissionId: record.deal_admission_id,
  });
  if (canonicalJson(record) !== canonicalJson(expected)) {
    throw new TypeError('deal serving directory record identity is invalid');
  }
  return true;
}

function validateObservationMember({
  member,
  observation,
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
  servingProjectionVersion = SERVING_PROJECTION_VERSION_V1,
}) {
  if (!member.shared_row || !member.exact_detail) {
    throw new TypeError('a comparable observation requires one shared row and one exact-detail package');
  }
  validateSharedServingRow(member.shared_row);
  if (member.shared_row.corpus_release_id !== corpusReleaseId
    || member.shared_row.provenance.contract_fingerprint !== contractBundle.fingerprint) {
    throw new TypeError('shared row is outside the candidate release identity');
  }
  const rowResult = member.shared_row.canonical_result;
  const rowMarket = rowResult.market_context;
  if (rowMarket.subject_observation.metric_slot_key !== observation.metric_slot_key
    || rowMarket.subject_observation.metric_observation_occurrence_id !== observation.metric_observation_occurrence_id
    || rowMarket.subject_observation.market_observation_serving_key !== observation.market_observation_serving_key
    || rowResult.concept_key !== observation.concept_key
    || canonicalJson(rowResult.party) !== canonicalJson(observation.party)) {
    throw new TypeError('shared row does not close over its market observation');
  }
  validateObservationRowParity(observation, member.shared_row);
  const compositionDetail = member.exact_detail.package?.row?.source_actions?.[0]?.action_slot_key
    === COMPOSITION_ACTION_SLOT_KEY;
  const terminationFeeTriggerDetail = member.exact_detail.package?.row?.source_actions?.[0]?.action_slot_key
    === TERMINATION_FEE_TRIGGER_ACTION_SLOT_KEY;
  const multiSourceCompositionDetail = compositionDetail && Array.isArray(member.exact_detail.sources);
  requireExactKeys(member.exact_detail, terminationFeeTriggerDetail ? [
    'package',
    'source',
    'source_admission',
    'relationships',
    'excerpts',
  ] : multiSourceCompositionDetail ? [
    'package',
    'sources',
    'components',
    'relationship_targets',
    'excerpts',
  ] : compositionDetail ? [
    'package',
    'source',
    'source_admission',
    'components',
    'relationship_targets',
    'excerpts',
  ] : [
    'package',
    'source',
    'source_admission',
    'excerpt',
    'claim',
  ], 'exact_detail');
  validateFixtureExactDetailPackage({
    package: member.exact_detail.package,
    contract_bundle: contractBundle,
    source: member.exact_detail.source,
    source_admission: member.exact_detail.source_admission,
    excerpt: member.exact_detail.excerpt,
    claim: member.exact_detail.claim,
    excerpts: member.exact_detail.excerpts,
    components: member.exact_detail.components,
    relationship_targets: member.exact_detail.relationship_targets,
    relationships: member.exact_detail.relationships,
    sources: member.exact_detail.sources,
  });
  if (canonicalJson(member.exact_detail.package.row) !== canonicalJson(member.shared_row)) {
    throw new TypeError('exact-detail package and shared row are not the same release member');
  }
  return projectSharedServingRowRecord({
    row: member.shared_row,
    serving_namespace_id: servingNamespaceId,
    projection_version: servingProjectionVersion,
  });
}

function validateObservationRowParity(observation, row) {
  const result = row?.canonical_result;
  const component = result?.components?.[0];
  const subject = result?.market_context?.subject_observation;
  const dimensions = result?.refinable_dimensions;
  const expectedComponent = {
    component_occurrence_id: observation.owner_occurrence_id,
    component_revision_id: observation.owner_revision_id,
    component_slot_key: observation.value_slot_key,
    governed_ordinal: observation.ordinal,
    component_state: observation.state,
    claim_occurrence_id: observation.claim_occurrence_id,
    claim_revision_id: observation.claim_revision_id,
    claim_definition_key: observation.claim_definition_key,
    claim_definition_version: observation.claim_definition_version,
    claim_attributes: observation.claim_attributes,
    claim_scope_closure_id: observation.claim_scope_closure_id,
    claim_scope: observation.claim_scope,
    composition_scope_closure_id: observation.composition_scope_closure_id,
    result_input_lineage_digest: observation.result_input_lineage_digest,
    relationship_revision_ids: observation.relationship_revision_ids,
    relationship_total: observation.relationship_revision_ids.length,
    relationship_set_digest: contentId('RESULT_RELATIONSHIP_SET/V1', {
      schema_version: 'RESULT_RELATIONSHIP_SET/V1',
      result_key: observation.result_key,
      result_version: observation.result_version,
      relationship_revision_ids: observation.relationship_revision_ids,
      relationship_effect_digests: observation.relationship_effect_digests,
      relationship_total: observation.relationship_revision_ids.length,
    }),
    bounded_relationship_effects: observation.relationship_effects.map((relationship) => ({
      relationship_revision_id: relationship.relationship_revision_id,
      relationship_definition_key: relationship.relationship_definition_key,
      state: relationship.state,
      effect: relationship.effect,
    })),
    raw_value: observation.raw_value,
    canonical_value: observation.canonical_value,
    unit: observation.unit,
    day_basis: observation.day_basis,
    denominator: observation.denominator,
    derivation_version: observation.derivation_version,
  };
  const expectedSubject = {
    market_observation_serving_key: observation.market_observation_serving_key,
    metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
    metric_slot_key: observation.metric_slot_key,
    canonical_value: observation.canonical_value,
    canonical_unit: observation.canonical_unit,
    basis_key: observation.basis_key,
    unit: observation.unit,
    day_basis: observation.day_basis,
    denominator: observation.denominator,
    derivation_version: observation.derivation_version,
  };
  const expectedDimensions = {
    sector: observation.sector,
    buyer: observation.buyer,
    merger_form: observation.merger_form,
    adviser_firms: observation.adviser_firms,
    lawyers: observation.lawyers,
    announce_year: observation.announce_year,
    deal_value_usd: observation.deal_value_usd,
  };
  if (canonicalJson(component) !== canonicalJson(expectedComponent)
    || canonicalJson(subject) !== canonicalJson(expectedSubject)
    || canonicalJson(dimensions) !== canonicalJson(expectedDimensions)) {
    throw new TypeError('market observation semantics do not match the canonical result row');
  }
  return true;
}

function validateExclusionMember(member) {
  if (member.shared_row !== null || member.exact_detail !== null) {
    throw new TypeError('an excluded metric slot cannot carry a plausible shared row or source action');
  }
}

function validateIncompleteCanonicalMember({
  member,
  contractBundle,
  corpusReleaseId,
}) {
  const row = member.shared_row;
  const exclusion = member.projection_output.exclusion;
  if (!row || !member.exact_detail?.package) {
    throw new TypeError('an incomplete canonical result requires one shared row and one exact-detail package');
  }
  validateSharedServingRow(row);
  const body = row.incomplete_canonical_result;
  if (row.row_kind !== 'INCOMPLETE_CANONICAL_RESULT'
    || row.corpus_release_id !== corpusReleaseId
    || row.provenance.contract_fingerprint !== contractBundle.fingerprint
    || row.governed_deal_key !== exclusion.deal_key
    || row.deal_admission_id !== exclusion.deal_admission_id
    || body.concept_key !== exclusion.concept_key
    || canonicalJson(body.party) !== canonicalJson(exclusion.party)
    || body.metric_exclusion.metric_definition_id !== exclusion.metric_definition_id
    || body.metric_exclusion.metric_key !== exclusion.metric_key
    || body.metric_exclusion.metric_version !== exclusion.metric_version
    || body.metric_exclusion.metric_slot_key !== exclusion.metric_slot_key
    || body.metric_exclusion.exclusion_serving_key !== exclusion.exclusion_serving_key
    || body.metric_exclusion.exclusion_reason !== exclusion.exclusion_reason
    || body.metric_exclusion.cohort_membership !== 'NO_COHORT_MEMBERSHIP'
    || body.metric_exclusion.aggregate_authority !== 'NO_AGGREGATE_AUTHORITY'
    || exclusion.comparability_state !== 'NOT_CERTIFIED') {
    throw new TypeError('incomplete canonical result is outside its explicit excluded metric slot');
  }
  const compositionDetail = member.exact_detail.package?.row?.source_actions?.[0]?.action_slot_key
    === COMPOSITION_ACTION_SLOT_KEY;
  const multiSourceCompositionDetail = compositionDetail && Array.isArray(member.exact_detail.sources);
  requireExactKeys(member.exact_detail, multiSourceCompositionDetail ? [
    'package',
    'sources',
    'components',
    'relationship_targets',
    'excerpts',
  ] : compositionDetail ? [
    'package',
    'source',
    'source_admission',
    'components',
    'relationship_targets',
    'excerpts',
  ] : [
    'package',
    'source',
    'source_admission',
    'excerpt',
    'claim',
  ], 'incomplete canonical exact_detail');
  validateFixtureExactDetailPackage({
    package: member.exact_detail.package,
    contract_bundle: contractBundle,
    source: member.exact_detail.source,
    source_admission: member.exact_detail.source_admission,
    excerpt: member.exact_detail.excerpt,
    claim: member.exact_detail.claim,
    excerpts: member.exact_detail.excerpts,
    components: member.exact_detail.components,
    relationship_targets: member.exact_detail.relationship_targets,
    sources: member.exact_detail.sources,
  });
  if (canonicalJson(member.exact_detail.package.row) !== canonicalJson(row)) {
    throw new TypeError('incomplete canonical exact-detail package and shared row are not the same release member');
  }
  return true;
}

function validateSourceSpecificMember({
  member,
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
}) {
  requireExactKeys(member, ['shared_row', 'exact_detail'], 'source_specific_members[]');
  validateSharedServingRow(member.shared_row);
  if (member.shared_row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC'
    || member.shared_row.corpus_release_id !== corpusReleaseId
    || member.shared_row.provenance.contract_fingerprint !== contractBundle.fingerprint) {
    throw new TypeError('reviewed source-specific row is outside the candidate release identity');
  }
  requireExactKeys(member.exact_detail, [
    'package',
    'source',
    'source_admission',
    'excerpts',
  ], 'source-specific exact_detail');
  validateFixtureExactDetailPackage({
    package: member.exact_detail.package,
    contract_bundle: contractBundle,
    source: member.exact_detail.source,
    source_admission: member.exact_detail.source_admission,
    excerpts: member.exact_detail.excerpts,
  });
  if (canonicalJson(member.exact_detail.package.row) !== canonicalJson(member.shared_row)) {
    throw new TypeError('source-specific exact-detail package and shared row are not the same release member');
  }
  return projectReviewedSourceSpecificRecord({
    row: member.shared_row,
    serving_namespace_id: servingNamespaceId,
  });
}

function sameCohortBasis(row, terminal) {
  const result = row.canonical_result;
  const market = result.market_context;
  return terminal.metric_key === market.metric_key
    && terminal.metric_version === market.metric_version
    && terminal.concept_key === result.concept_key
    && terminal.basis_key === market.subject_observation.basis_key
    && canonicalJson(terminal.party) === canonicalJson(result.party);
}

function dealCount(items) {
  return new Set(items.map((item) => item.terminal.deal_key)).size;
}

function claimState(terminal) {
  return terminal.claim_state || terminal.state || terminal.presence_state;
}

function releaseWideMarketContext({
  row,
  servingNamespaceId,
  observations,
  exclusions,
}) {
  if (!row || row.row_kind !== 'CANONICAL_RESULT') {
    throw new TypeError('release-wide cohorts require one canonical result row');
  }
  const market = row.canonical_result.market_context;
  const cohortRequest = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: row.provenance.contract_fingerprint,
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    subject_deal_key: row.governed_deal_key,
    filters: {},
  };
  const compiled = compileMarketCohortRequest(cohortRequest);
  const subjectMembership = market.subject_cohort_membership || null;
  if (subjectMembership?.status === 'EXCLUDED'
    && subjectMembership.cohort_digest !== compiled.cohort_digest) {
    throw new TypeError('release-wide cohort cannot carry a stale subject exclusion receipt');
  }
  const cohort = [
    ...observations.map((terminal) => ({ terminal, excluded: false })),
    ...exclusions.map((terminal) => ({ terminal, excluded: true })),
  ].filter((item) => (
    sameCohortBasis(row, item.terminal)
      && (
        item.terminal.deal_key !== row.governed_deal_key
        || subjectMembership?.status !== 'EXCLUDED'
      )
  ));
  const eligible = cohort.filter((item) => (
    !item.excluded || item.terminal.eligibility_state === 'ELIGIBLE'
  ));
  const applicable = eligible.filter((item) => (
    !item.excluded || item.terminal.applicability_state === 'APPLICABLE'
  ));
  const examined = applicable.filter((item) => (
    !item.excluded || item.terminal.examination_state === 'EXAMINED'
  ));
  const present = examined.filter((item) => claimState(item.terminal) === 'PRESENT');
  const comparable = cohort.filter((item) => !item.excluded);
  const distributed = comparable.filter((item) => claimState(item.terminal) === 'PRESENT');
  const excluded = cohort.filter((item) => item.excluded);
  const distributionGroups = new Map();
  for (const item of distributed) {
    if (item.terminal.canonical_value == null) continue;
    const key = canonicalJson(item.terminal.canonical_value);
    const existing = distributionGroups.get(key) || {
      canonical_value: clone(item.terminal.canonical_value),
      subject_count: 0,
      deals: new Set(),
    };
    existing.subject_count += 1;
    existing.deals.add(item.terminal.deal_key);
    distributionGroups.set(key, existing);
  }
  const distribution = [...distributionGroups.values()]
    .map((item) => ({
      canonical_value: item.canonical_value,
      subject_count: item.subject_count,
      deal_count: item.deals.size,
    }))
    .sort((left, right) => (
      right.deal_count - left.deal_count
        || canonicalJson(left.canonical_value).localeCompare(canonicalJson(right.canonical_value))
    ))
    .slice(0, MAX_COHORT_GROUPS);
  const exclusionGroups = new Map();
  for (const item of excluded) {
    const reason = item.terminal.exclusion_reason;
    const existing = exclusionGroups.get(reason) || { reason_code: reason, slot_count: 0, deals: new Set() };
    existing.slot_count += 1;
    existing.deals.add(item.terminal.deal_key);
    exclusionGroups.set(reason, existing);
  }
  const groupedExclusions = [...exclusionGroups.values()]
    .map((item) => ({
      reason_code: item.reason_code,
      slot_count: item.slot_count,
      deal_count: item.deals.size,
    }))
    .sort((left, right) => (
      right.slot_count - left.slot_count || left.reason_code.localeCompare(right.reason_code)
    ))
    .slice(0, MAX_COHORT_GROUPS);
  const counts = {
    eligible_deals: dealCount(eligible),
    applicable_deals: dealCount(applicable),
    examined_deals: dealCount(examined),
    present_deals: dealCount(present),
    comparable_deals: dealCount(comparable),
    distribution_deals: dealCount(distributed),
    excluded_deals: dealCount(excluded),
    observation_slots: comparable.length,
    excluded_slots: excluded.length,
  };
  const releaseSubjectMembership = subjectMembership?.status === 'INCLUDED'
    ? buildSubjectCohortMembershipReceipt({
      cohort_request: cohortRequest,
      observation: {
        deal_key: row.governed_deal_key,
        market_observation_serving_key:
          market.subject_observation.market_observation_serving_key,
      },
      status: 'INCLUDED',
      exclusion_reason: null,
    })
    : subjectMembership;
  return {
    ...clone(market),
    cohort: {
      cohort_digest: compiled.cohort_digest,
      counts,
      distribution,
      exclusions: groupedExclusions,
    },
    ...(releaseSubjectMembership
      ? { subject_cohort_membership: clone(releaseSubjectMembership) }
      : {}),
    denominators: {
      prevalence: {
        kind: 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS',
        deal_count: counts.examined_deals,
      },
      distribution: {
        kind: 'COMPARABLE_PRESENT_DEALS',
        deal_count: counts.distribution_deals,
      },
    },
  };
}

function rematerializeObservationMember({
  member,
  servingNamespaceId,
  observations,
  exclusions,
}) {
  if (!member.shared_row || !member.exact_detail?.package) {
    throw new TypeError('a comparable observation requires one shared row and one exact-detail package');
  }
  validateSharedServingRow(member.shared_row);
  const row = clone(member.shared_row);
  row.canonical_result.market_context = releaseWideMarketContext({
    row,
    servingNamespaceId,
    observations,
    exclusions,
  });
  delete row.canonical_payload_digest;
  row.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', row);
  validateSharedServingRow(row);
  return {
    projection_output: member.projection_output,
    shared_row: row,
    exact_detail: {
      ...member.exact_detail,
      package: {
        ...member.exact_detail.package,
        row: clone(row),
      },
    },
  };
}

function validateReleaseWideEmbeddedCohorts({
  rows,
  servingNamespaceId,
  observations,
  exclusions,
}) {
  for (const row of rows.filter((item) => item.row_kind === 'CANONICAL_RESULT')) {
    const expected = releaseWideMarketContext({ row, servingNamespaceId, observations, exclusions });
    if (canonicalJson(row.canonical_result.market_context) !== canonicalJson(expected)) {
      throw new TypeError('candidate release contains stale embedded market cohort statistics');
    }
  }
  return true;
}

function candidateMemberClaims(member) {
  const direct = member?.exact_detail?.claim ? [member.exact_detail.claim] : [];
  const composed = Array.isArray(member?.exact_detail?.components)
    ? member.exact_detail.components.map((item) => item?.claim).filter(Boolean)
    : [];
  return [...direct, ...composed];
}

function correctionDetailClaimOccurrences(detailPackage) {
  return (detailPackage?.detail_payloads || []).map((payload) => payload?.response_body)
    .filter((body) => body?.claim_occurrence_id && body?.claim_revision_id)
    .map((body) => ({
      claim_occurrence_id: body.claim_occurrence_id,
      claim_revision_id: body.claim_revision_id,
    }));
}

function correctionConsistencyRefs({
  observation,
  row,
  queryRecord,
  detailPackage,
  successorClaimRevisionId,
  correctionValueEvidenceProof = null,
}) {
  const components = row?.canonical_result?.components || [];
  const matching = components.filter((component) => component.claim_revision_id === successorClaimRevisionId);
  if (matching.length !== 1) {
    throw new TypeError('corrected release row must contain its successor claim exactly once');
  }
  const component = matching[0];
  const queryRecordDigest = contentId('FIXTURE_QUERY_RECORD/V1', queryRecord);
  const packageDigest = contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage);
  return [
    buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'RESULT_COMPONENT_REVISION',
      stable_key: component.component_occurrence_id,
      immutable_id: component.component_revision_id,
      canonical_payload_digest: contentId('CORRECTION_RESULT_COMPONENT_PAYLOAD/V1', component),
    }),
    buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'MARKET_OBSERVATION',
      stable_key: observation.market_observation_serving_key,
      immutable_id: observation.metric_observation_occurrence_id,
      canonical_payload_digest: observation.canonical_payload_digest,
    }),
    buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'SHARED_SERVING_ROW',
      stable_key: row.row_serving_key,
      immutable_id: row.canonical_result.derived_result_revision_id,
      canonical_payload_digest: row.canonical_payload_digest,
    }),
    buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'QUERY_PROJECTION_RECORD',
      stable_key: queryRecord.row_serving_key,
      immutable_id: queryRecordDigest,
      canonical_payload_digest: queryRecordDigest,
    }),
    buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'EXACT_DETAIL_PACKAGE',
      stable_key: detailPackage.row.row_serving_key,
      immutable_id: packageDigest,
      canonical_payload_digest: packageDigest,
    }),
    ...(correctionValueEvidenceProof ? [buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'CORRECTION_VALUE_EVIDENCE_PROOF',
      stable_key: correctionValueEvidenceProof.correction_application_id,
      immutable_id: correctionValueEvidenceProof.correction_value_evidence_proof_id,
      canonical_payload_digest: correctionValueEvidenceProof.canonical_payload_digest,
    })] : []),
  ].sort((left, right) => left.correction_output_ref_id.localeCompare(right.correction_output_ref_id));
}

function buildReleaseCorrectionMaterialisation({
  contract_bundle: contractBundle,
  correction_output: correctionOutput,
  member,
  query_record: queryRecord,
} = {}) {
  const predecessor = correctionOutput?.predecessor_claim_revision;
  const successor = correctionOutput?.successor_claim_revision;
  const observation = member?.projection_output?.observation;
  const row = member?.shared_row;
  const detailPackage = member?.exact_detail?.package;
  if (!predecessor || !successor
    || observation?.claim_occurrence_id !== successor.claim_occurrence_id
    || observation?.claim_revision_id !== successor.claim_revision_id) {
    throw new TypeError('release correction observation does not select the exact successor claim');
  }
  const rowClaims = candidateMemberClaims(member);
  if (rowClaims.filter((claim) => (
    claim.claim_occurrence_id === successor.claim_occurrence_id
      && claim.claim_revision_id === successor.claim_revision_id
  )).length !== 1
    || rowClaims.some((claim) => (
      claim.claim_occurrence_id === predecessor.claim_occurrence_id
        && claim.claim_revision_id === predecessor.claim_revision_id
    ))) {
    throw new TypeError('release correction member does not contain exactly one successor and no predecessor');
  }
  if (!queryRecord
    || queryRecord.row_serving_key !== row?.row_serving_key
    || canonicalJson(queryRecord.canonical_payload) !== canonicalJson(row)) {
    throw new TypeError('release correction query projection does not select the successor row');
  }
  const detailOccurrences = correctionDetailClaimOccurrences(detailPackage);
  if (detailOccurrences.filter((item) => (
    item.claim_occurrence_id === successor.claim_occurrence_id
      && item.claim_revision_id === successor.claim_revision_id
  )).length !== 1
    || detailOccurrences.some((item) => (
      item.claim_occurrence_id === predecessor.claim_occurrence_id
        && item.claim_revision_id === predecessor.claim_revision_id
    ))
    || row.governed_deal_key !== correctionOutput.application?.affected_subject?.deal_key) {
    throw new TypeError('release correction exact detail or governed deal does not select the successor');
  }
  const correctionDischarge = buildCorrectionDischarge({
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
    consistency_output_refs: correctionConsistencyRefs({
      observation,
      row,
      queryRecord,
      detailPackage,
      successorClaimRevisionId: successor.claim_revision_id,
      correctionValueEvidenceProof: correctionOutput.value_evidence_proof,
    }),
  });
  return Object.freeze({
    correction_output: correctionOutput,
    correction_discharge: correctionDischarge,
  });
}

function buildReleaseCorrectionMaterialisations({
  contract_bundle: contractBundle,
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  members,
  correction_outputs: correctionOutputs,
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(servingNamespaceId, 'serving_namespace_id');
  requireDigest(corpusReleaseId, 'corpus_release_id');
  if (!Array.isArray(members) || !Array.isArray(correctionOutputs)) {
    throw new TypeError('members and correction_outputs must be explicit arrays');
  }
  members.forEach((member, index) => {
    requireExactKeys(member, ['projection_output', 'shared_row', 'exact_detail'], `members[${index}]`);
    validateProjectedMetricSlotOutput(member.projection_output);
    const terminal = member.projection_output.observation || member.projection_output.exclusion;
    if (terminal.corpus_release_id !== corpusReleaseId
      || terminal.contract_fingerprint !== contractBundle.fingerprint) {
      throw new TypeError('metric slot is outside the candidate release identity');
    }
  });
  assertMetricSlotPartition(members.map((member) => member.projection_output));
  const observationUniverse = members
    .map((member) => member.projection_output.observation)
    .filter(Boolean);
  const exclusionUniverse = members
    .map((member) => member.projection_output.exclusion)
    .filter(Boolean);
  const releaseMembers = members.map((member) => (
    member.projection_output.observation
      ? rematerializeObservationMember({
        member,
        servingNamespaceId,
        observations: observationUniverse,
        exclusions: exclusionUniverse,
      })
      : member
  ));
  const queryRecords = releaseMembers.filter((member) => (
    Boolean(member.projection_output.observation)
  )).map((member) => validateObservationMember({
    member,
    observation: member.projection_output.observation,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  }));
  return Object.freeze(correctionOutputs.map((correctionOutput) => {
    const successor = correctionOutput?.successor_claim_revision;
    const matchingMembers = releaseMembers.filter((member) => candidateMemberClaims(member).some((claim) => (
      claim.claim_occurrence_id === successor?.claim_occurrence_id
        && claim.claim_revision_id === successor?.claim_revision_id
    )));
    if (matchingMembers.length !== 1) {
      throw new TypeError('release correction successor must select exactly one prepared member');
    }
    const queryMatches = queryRecords.filter((record) => (
      record.row_serving_key === matchingMembers[0].shared_row.row_serving_key
    ));
    if (queryMatches.length !== 1) {
      throw new TypeError('release correction successor must select exactly one prepared query record');
    }
    return buildReleaseCorrectionMaterialisation({
      contract_bundle: contractBundle,
      correction_output: correctionOutput,
      member: matchingMembers[0],
      query_record: queryMatches[0],
    });
  }).sort((left, right) => (
    left.correction_discharge.correction_application_id.localeCompare(
      right.correction_discharge.correction_application_id,
    )
  )));
}

function materialiseCandidateCorrectionInputs({
  contractBundle,
  authoritySelection,
  releaseMembers,
  queryRecords,
}) {
  validateCandidateInputAuthoritySelection({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
  });
  const correctionMaterialisations = authoritySelection.correction_materialisations;
  const sealedMaterialisations = correctionMaterialisations.map((materialisation, index) => {
    requireExactKeys(
      materialisation,
      ['correction_output', 'correction_discharge'],
      `authority_selection.correction_materialisations[${index}]`,
    );
    const output = materialisation.correction_output;
    const predecessor = output?.predecessor_claim_revision;
    const successor = output?.successor_claim_revision;
    const matchingMembers = releaseMembers.filter((member) => candidateMemberClaims(member).some((claim) => (
      claim.claim_occurrence_id === successor?.claim_occurrence_id
        && claim.claim_revision_id === successor?.claim_revision_id
    )));
    const predecessorMembers = releaseMembers.filter((member) => candidateMemberClaims(member).some((claim) => (
      claim.claim_occurrence_id === predecessor?.claim_occurrence_id
        && claim.claim_revision_id === predecessor?.claim_revision_id
    )));
    if (matchingMembers.length !== 1 || predecessorMembers.length !== 0) {
      throw new TypeError('candidate correction successor is omitted, duplicated or accompanied by its predecessor');
    }
    const member = matchingMembers[0];
    const successorObservations = releaseMembers.filter((candidate) => (
      candidate.projection_output?.observation?.claim_occurrence_id === successor.claim_occurrence_id
        && candidate.projection_output.observation.claim_revision_id === successor.claim_revision_id
    ));
    const predecessorObservations = releaseMembers.filter((candidate) => (
      candidate.projection_output?.observation?.claim_occurrence_id === predecessor.claim_occurrence_id
        && candidate.projection_output.observation.claim_revision_id === predecessor.claim_revision_id
    ));
    if (successorObservations.length !== 1 || predecessorObservations.length !== 0
      || successorObservations[0] !== member) {
      throw new TypeError('candidate correction observation does not select exactly one successor');
    }
    const observation = member.projection_output.observation;
    const queryMatches = queryRecords.filter((record) => record.row_serving_key === member.shared_row.row_serving_key);
    if (queryMatches.length !== 1
      || canonicalJson(queryMatches[0].canonical_payload) !== canonicalJson(member.shared_row)) {
      throw new TypeError('candidate correction query projection does not select the successor row');
    }
    const detailOccurrences = correctionDetailClaimOccurrences(member.exact_detail.package);
    const successorDetails = detailOccurrences.filter((item) => (
      item.claim_occurrence_id === successor.claim_occurrence_id
        && item.claim_revision_id === successor.claim_revision_id
    ));
    const predecessorDetails = detailOccurrences.filter((item) => (
      item.claim_occurrence_id === predecessor.claim_occurrence_id
        && item.claim_revision_id === predecessor.claim_revision_id
    ));
    if (successorDetails.length !== 1 || predecessorDetails.length > 0
      || member.shared_row.governed_deal_key !== output.application?.affected_subject?.deal_key) {
      throw new TypeError('candidate correction exact detail or governed deal does not select the successor');
    }
    const sealedMaterialisation = buildReleaseCorrectionMaterialisation({
      contract_bundle: contractBundle,
      correction_output: output,
      member,
      query_record: queryMatches[0],
    });
    if (canonicalJson(sealedMaterialisation) !== canonicalJson(materialisation)) {
      throw new TypeError(
        'candidate correction materialisation differs from the exact authority-selected discharge',
      );
    }
    return sealedMaterialisation;
  }).sort((left, right) => (
    left.correction_discharge.correction_application_id.localeCompare(
      right.correction_discharge.correction_application_id,
    )
  ));
  const discharges = sealedMaterialisations.map((materialisation) => materialisation.correction_discharge);
  const seal = buildCandidateCorrectionInputSealV2({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: sealedMaterialisations,
  });
  validateCandidateCorrectionInputSealV2(seal);
  return { seal, discharges };
}

function candidateCorrectionInputRoot(seal) {
  if (seal.schema_version === 'CANDIDATE_CORRECTION_INPUT_SEAL/V2') {
    return contentId('FIXTURE_RELEASE_CORRECTION_INPUT/V2', {
      candidate_correction_input_seal_id: seal.candidate_correction_input_seal_id,
      canonical_payload_digest: seal.canonical_payload_digest,
      candidate_input_head_id: seal.candidate_input_head_id,
      candidate_input_head_payload_digest: seal.candidate_input_head_payload_digest,
      correction_discharge_map_id: seal.correction_discharge_map_id,
      correction_discharge_map_payload_digest: seal.correction_discharge_map_payload_digest,
      authority_active_correction_application_root:
        seal.roots.authority_active_correction_application_root,
      correction_authority_materialisation_root: seal.roots.correction_authority_materialisation_root,
      authority_correction_discharge_root: seal.roots.authority_correction_discharge_root,
      expected_active_application_root: seal.roots.expected_active_application_root,
      correction_entry_root: seal.roots.correction_entry_root,
      correction_discharge_root: seal.roots.correction_discharge_root,
    });
  }
  return contentId('FIXTURE_RELEASE_CORRECTION_INPUT/V1', {
    candidate_correction_input_seal_id: seal.candidate_correction_input_seal_id,
    canonical_payload_digest: seal.canonical_payload_digest,
    expected_active_application_root: seal.roots.expected_active_application_root,
    correction_entry_root: seal.roots.correction_entry_root,
    correction_discharge_root: seal.roots.correction_discharge_root,
  });
}

function validateReleaseCorrectionInputs({
  seal,
  discharges,
  marketObservations,
  sharedRows,
  queryRecords,
  exactDetailPackages,
  manifest,
}) {
  if (seal.schema_version === 'CANDIDATE_CORRECTION_INPUT_SEAL/V2') {
    validateCandidateCorrectionInputSealV2(seal);
  } else {
    validateCandidateCorrectionInputSeal(seal);
  }
  if (seal.contract_fingerprint !== manifest.contract_fingerprint
    || seal.candidate_correction_input_seal_id !== manifest.correction_input_seal_id
    || candidateCorrectionInputRoot(seal) !== manifest.roots.correction_input_root
    || seal.counts.expected_active_applications !== manifest.counts.correction_applications
    || seal.counts.correction_discharges !== manifest.counts.correction_discharges
    || !Array.isArray(discharges)
    || discharges.length !== seal.correction_entries.length) {
    throw new TypeError('candidate correction input seal is outside the release manifest or incomplete');
  }
  const dischargeByApplication = new Map();
  for (const discharge of discharges) {
    validateCorrectionDischargeIdentity(discharge);
    if (dischargeByApplication.has(discharge.correction_application_id)) {
      throw new TypeError('candidate correction discharges contain a duplicate application');
    }
    dischargeByApplication.set(discharge.correction_application_id, discharge);
  }
  for (const entry of seal.correction_entries) {
    const discharge = dischargeByApplication.get(entry.correction_application_id);
    if (!discharge
      || discharge.correction_discharge_id !== entry.correction_discharge_id
      || discharge.canonical_payload_digest !== entry.correction_discharge_payload_digest
      || discharge.correction_id !== entry.correction_id
      || discharge.correction_approval_attestation_id !== entry.correction_approval_attestation_id
      || discharge.correction_lineage_id !== entry.correction_lineage_id
      || discharge.predecessor_claim_revision_id !== entry.predecessor_claim_revision_id
      || discharge.successor_claim_revision_id !== entry.successor_claim_revision_id) {
      throw new TypeError('candidate correction discharge does not close over its sealed application');
    }
    const rows = sharedRows.filter((row) => (row.canonical_result?.components || []).some((component) => (
      component.claim_occurrence_id === entry.claim_occurrence_id
        && component.claim_revision_id === entry.successor_claim_revision_id
    )));
    const predecessorRows = sharedRows.filter((row) => (row.canonical_result?.components || []).some((component) => (
      component.claim_occurrence_id === entry.claim_occurrence_id
        && component.claim_revision_id === entry.predecessor_claim_revision_id
    )));
    if (rows.length !== 1 || predecessorRows.length !== 0 || rows[0].governed_deal_key !== entry.governed_deal_key) {
      throw new TypeError('candidate release does not select exactly one corrected successor row');
    }
    const observations = marketObservations.filter((observation) => (
      observation.claim_occurrence_id === entry.claim_occurrence_id
        && observation.claim_revision_id === entry.successor_claim_revision_id
    ));
    const predecessorObservations = marketObservations.filter((observation) => (
      observation.claim_occurrence_id === entry.claim_occurrence_id
        && observation.claim_revision_id === entry.predecessor_claim_revision_id
    ));
    if (observations.length !== 1 || predecessorObservations.length !== 0
      || observations[0].market_observation_serving_key
        !== rows[0].canonical_result.market_context.subject_observation.market_observation_serving_key) {
      throw new TypeError('candidate release does not select exactly one corrected successor observation');
    }
    validateObservationRowParity(observations[0], rows[0]);
    const queryMatches = queryRecords.filter((record) => record.row_serving_key === rows[0].row_serving_key);
    if (queryMatches.length !== 1
      || canonicalJson(queryMatches[0].canonical_payload) !== canonicalJson(rows[0])) {
      throw new TypeError('candidate correction query projection does not select the successor row');
    }
    const detailPackages = exactDetailPackages.filter((detailPackage) => (
      detailPackage.row.row_serving_key === rows[0].row_serving_key
    ));
    if (detailPackages.length !== 1) {
      throw new TypeError('candidate corrected row does not have exactly one exact-detail package');
    }
    const detailOccurrences = correctionDetailClaimOccurrences(detailPackages[0]);
    const successorDetails = detailOccurrences.filter((item) => (
      item.claim_occurrence_id === entry.claim_occurrence_id
        && item.claim_revision_id === entry.successor_claim_revision_id
    ));
    if (successorDetails.length !== 1
      || detailOccurrences.some((item) => item.claim_revision_id === entry.predecessor_claim_revision_id)) {
      throw new TypeError('candidate correction exact detail does not select the sealed successor');
    }
    const expectedRefs = correctionConsistencyRefs({
      observation: observations[0],
      row: rows[0],
      queryRecord: queryMatches[0],
      detailPackage: detailPackages[0],
      successorClaimRevisionId: entry.successor_claim_revision_id,
      correctionValueEvidenceProof: discharge.correction_value_evidence_proof,
    });
    if (canonicalJson(discharge.ordered_consistency_output_refs) !== canonicalJson(expectedRefs)) {
      throw new TypeError('candidate correction discharge does not bind the corrected result, row and exact detail, including its value evidence proof');
    }
  }
  return true;
}

function buildFixtureCandidateRelease({
  contract_bundle: contractBundle,
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  serving_projection_binding: servingProjectionBinding,
  members,
  source_specific_members: sourceSpecificMembers = [],
  validated_semantic_graphs: validatedSemanticGraphs = [],
  deal_directory_entries: dealDirectoryEntries = [],
  expected_active_correction_application_ids: expectedActiveCorrectionApplicationIds,
  correction_materialisations: correctionMaterialisations,
  correction_authority_selection: correctionAuthoritySelection,
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(servingNamespaceId, 'serving_namespace_id');
  requireDigest(corpusReleaseId, 'corpus_release_id');
  const isProjectionBound = servingProjectionBinding !== undefined;
  if (isProjectionBound) validateServingProjectionBindingV2(servingProjectionBinding);
  const servingProjectionVersion = isProjectionBound
    ? servingProjectionBinding.serving_projection_version
    : SERVING_PROJECTION_VERSION_V1;
  if (expectedActiveCorrectionApplicationIds !== undefined || correctionMaterialisations !== undefined) {
    throw new TypeError(
      'naked correction IDs or materialisations are not authoritative; correction_authority_selection is required',
    );
  }
  validateCandidateInputAuthoritySelection({
    authority_selection: correctionAuthoritySelection,
    contract_bundle: contractBundle,
  });
  if (!Array.isArray(members) || members.length < 1 || members.length > MAX_RELEASE_MEMBERS) {
    throw new TypeError(`members must contain between 1 and ${MAX_RELEASE_MEMBERS} terminal metric slots`);
  }
  if (!Array.isArray(sourceSpecificMembers)
    || members.length + sourceSpecificMembers.length > MAX_RELEASE_MEMBERS) {
    throw new TypeError(`source_specific_members must keep the release within ${MAX_RELEASE_MEMBERS} members`);
  }
  if (!Array.isArray(dealDirectoryEntries)) throw new TypeError('deal_directory_entries must be an array');
  members.forEach((member, index) => {
    requireExactKeys(member, ['projection_output', 'shared_row', 'exact_detail'], `members[${index}]`);
    validateProjectedMetricSlotOutput(member.projection_output);
    const terminal = member.projection_output.observation || member.projection_output.exclusion;
    if (terminal.corpus_release_id !== corpusReleaseId
      || terminal.contract_fingerprint !== contractBundle.fingerprint) {
      throw new TypeError('metric slot is outside the candidate release identity');
    }
  });
  assertMetricSlotPartition(members.map((member) => member.projection_output));
  const observationUniverse = members
    .map((member) => member.projection_output.observation)
    .filter(Boolean);
  const exclusionUniverse = members
    .map((member) => member.projection_output.exclusion)
    .filter(Boolean);
  const releaseMembers = members.map((member) => (
    member.projection_output.observation
      ? rematerializeObservationMember({
        member,
        servingNamespaceId,
        observations: observationUniverse,
        exclusions: exclusionUniverse,
      })
      : member
  ));
  const sourceSpecificServingRecords = sourceSpecificMembers.map((member) => validateSourceSpecificMember({
    member,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  })).sort((left, right) => (
    left.reviewed_source_specific_serving_key.localeCompare(right.reviewed_source_specific_serving_key)
  ));

  const marketObservations = [];
  const marketExclusions = [];
  const sharedRows = [];
  const incompleteCanonicalRows = [];
  const sourceSpecificRows = [];
  const exactDetailPackages = [];
  const queryRecords = [];
  for (const member of releaseMembers) {
    const output = member.projection_output;
    if (output.observation) {
      const queryRecord = validateObservationMember({
        member,
        observation: output.observation,
        contractBundle,
        corpusReleaseId,
        servingNamespaceId,
        servingProjectionVersion,
      });
      marketObservations.push(output.observation);
      sharedRows.push(member.shared_row);
      exactDetailPackages.push(member.exact_detail.package);
      queryRecords.push(queryRecord);
    } else {
      if (member.shared_row?.row_kind === 'INCOMPLETE_CANONICAL_RESULT') {
        validateIncompleteCanonicalMember({ member, contractBundle, corpusReleaseId });
        sharedRows.push(member.shared_row);
        incompleteCanonicalRows.push(member.shared_row);
        exactDetailPackages.push(member.exact_detail.package);
      } else {
        validateExclusionMember(member);
      }
      marketExclusions.push(output.exclusion);
    }
  }
  for (const member of sourceSpecificMembers) {
    sourceSpecificRows.push(member.shared_row);
    sharedRows.push(member.shared_row);
    exactDetailPackages.push(member.exact_detail.package);
  }
  const graphLineages = [
    ...releaseMembers.map(graphLineageFromMember),
    ...sourceSpecificMembers.map(graphLineageFromMember),
  ].flatMap((lineage) => Array.isArray(lineage) ? lineage : [lineage]).filter(Boolean);
  const {
    sortedGraphs: releaseSemanticGraphs,
    entries: semanticGraphEntries,
  } = buildValidatedSemanticGraphEntries({
    graphs: validatedSemanticGraphs,
    lineages: graphLineages,
    validateSourceBytes: true,
  });
  validateReleaseWideEmbeddedCohorts({
    rows: sharedRows,
    servingNamespaceId,
    observations: marketObservations,
    exclusions: marketExclusions,
  });
  if (new Set(sharedRows.map((row) => row.row_serving_key)).size !== sharedRows.length
    || new Set(sourceSpecificRows.map((row) => (
      row.reviewed_source_specific.candidate_occurrence.open_world_candidate_occurrence_id
    ))).size !== sourceSpecificRows.length) {
    throw new TypeError('candidate release contains a duplicate shared or source-specific row');
  }

  marketObservations.sort((left, right) => left.market_observation_serving_key.localeCompare(right.market_observation_serving_key));
  marketExclusions.sort((left, right) => left.exclusion_serving_key.localeCompare(right.exclusion_serving_key));
  sharedRows.sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  sourceSpecificRows.sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  incompleteCanonicalRows.sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  exactDetailPackages.sort((left, right) => left.row.row_serving_key.localeCompare(right.row.row_serving_key));
  queryRecords.sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  const hasIncompleteCanonicalRows = incompleteCanonicalRows.length > 0;
  const carriesIncompletePartition = hasIncompleteCanonicalRows || isProjectionBound;
  const candidateCorrectionInputs = materialiseCandidateCorrectionInputs({
    contractBundle,
    authoritySelection: correctionAuthoritySelection,
    releaseMembers,
    queryRecords,
  });

  const observationEntries = marketObservations.map((row) => ({
    serving_key: row.market_observation_serving_key,
    occurrence_id: row.metric_observation_occurrence_id,
    metric_slot_key: row.metric_slot_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const exclusionEntries = marketExclusions.map((row) => ({
    serving_key: row.exclusion_serving_key,
    metric_slot_key: row.metric_slot_key,
    reason_code: row.exclusion_reason,
    payload_digest: row.canonical_payload_digest,
  }));
  const sharedRowEntries = sharedRows.map((row) => ({
    row_serving_key: row.row_serving_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const sourceSpecificEntries = sourceSpecificRows.map((row) => ({
    row_serving_key: row.row_serving_key,
    open_world_candidate_occurrence_id: row.reviewed_source_specific.candidate_occurrence.open_world_candidate_occurrence_id,
    final_disposition_id: row.reviewed_source_specific.final_disposition.final_disposition_id,
    payload_digest: row.canonical_payload_digest,
  }));
  const incompleteCanonicalEntries = incompleteCanonicalRows.map((row) => ({
    row_serving_key: row.row_serving_key,
    governed_deal_key: row.governed_deal_key,
    derived_result_occurrence_id: row.incomplete_canonical_result.derived_result_occurrence_id,
    derived_result_revision_id: row.incomplete_canonical_result.derived_result_revision_id,
    metric_slot_key: row.incomplete_canonical_result.metric_exclusion.metric_slot_key,
    exclusion_serving_key: row.incomplete_canonical_result.metric_exclusion.exclusion_serving_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const sourceSpecificServingEntries = sourceSpecificServingRecords.map((record) => ({
    reviewed_source_specific_serving_key: record.reviewed_source_specific_serving_key,
    row_serving_key: record.row_serving_key,
    open_world_candidate_occurrence_id: record.open_world_candidate_occurrence_id,
    final_disposition_id: record.final_disposition_id,
    payload_digest: record.canonical_payload_digest,
  })).sort((left, right) => (
    left.reviewed_source_specific_serving_key.localeCompare(right.reviewed_source_specific_serving_key)
  ));
  const detailEntries = exactDetailPackages.map(buildExactDetailReleaseEntry);
  const queryEntries = queryRecords.map((record) => ({
    row_serving_key: record.row_serving_key,
    payload_digest: record.canonical_payload_digest,
    record_digest: contentId('FIXTURE_QUERY_RECORD/V1', record),
  }));
  const dealKeys = [...new Set([
    ...marketObservations.map((row) => row.deal_key),
    ...marketExclusions.map((row) => row.deal_key),
    ...sourceSpecificRows.map((row) => row.governed_deal_key),
  ])].sort();
  const admissionIdByDeal = new Map();
  for (const row of sharedRows) {
    const existing = admissionIdByDeal.get(row.governed_deal_key);
    if (existing && existing !== row.deal_admission_id) {
      throw new TypeError('candidate release deal has multiple active admission identities');
    }
    admissionIdByDeal.set(row.governed_deal_key, row.deal_admission_id);
  }
  for (const row of [...marketObservations, ...marketExclusions]) {
    const existing = admissionIdByDeal.get(row.deal_key);
    if (existing && existing !== row.deal_admission_id) {
      throw new TypeError('candidate release deal has multiple active admission identities');
    }
    admissionIdByDeal.set(row.deal_key, row.deal_admission_id);
  }
  if (dealDirectoryEntries.length !== dealKeys.length) {
    throw new TypeError('deal_directory_entries must cover every release deal exactly once');
  }
  const dealDirectoryRecords = dealDirectoryEntries.map((entry) => {
    requireExactKeys(entry, ['application_deal_id', 'governed_deal_key'], 'deal_directory_entries[]');
    const admissionId = admissionIdByDeal.get(entry.governed_deal_key);
    if (!admissionId) throw new TypeError('deal directory entry is outside the release deal inventory');
    return buildDealServingDirectoryRecord({
      servingNamespaceId,
      corpusReleaseId,
      contractFingerprint: contractBundle.fingerprint,
      applicationDealId: entry.application_deal_id,
      governedDealKey: entry.governed_deal_key,
      dealAdmissionId: admissionId,
    });
  }).sort((left, right) => left.application_deal_id.localeCompare(right.application_deal_id));
  if (new Set(dealDirectoryRecords.map((row) => row.application_deal_id)).size !== dealDirectoryRecords.length
    || canonicalJson(dealDirectoryRecords.map((row) => row.governed_deal_key).sort()) !== canonicalJson(dealKeys)) {
    throw new TypeError('deal directory entries are duplicated or incomplete');
  }
  const dealDirectoryEntriesForRoot = dealDirectoryRecords.map((row) => ({
    application_deal_id: row.application_deal_id,
    governed_deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    record_id: row.deal_serving_directory_record_id,
    payload_digest: row.canonical_payload_digest,
  }));
  const roots = {
    deal_directory_root: entryRoot('FIXTURE_RELEASE_DEAL_DIRECTORY/V1', dealDirectoryEntriesForRoot),
    observation_root: entryRoot('FIXTURE_RELEASE_OBSERVATIONS/V1', observationEntries),
    exclusion_root: entryRoot('FIXTURE_RELEASE_EXCLUSIONS/V1', exclusionEntries),
    shared_row_root: entryRoot('FIXTURE_RELEASE_SHARED_ROWS/V1', sharedRowEntries),
    ...(carriesIncompletePartition ? {
      incomplete_canonical_row_root: entryRoot(
        'FIXTURE_RELEASE_INCOMPLETE_CANONICAL_ROWS/V1',
        incompleteCanonicalEntries,
      ),
    } : {}),
    source_specific_row_root: entryRoot('FIXTURE_RELEASE_SOURCE_SPECIFIC_ROWS/V1', sourceSpecificEntries),
    source_specific_serving_projection_root: entryRoot(
      'FIXTURE_RELEASE_SOURCE_SPECIFIC_SERVING_PROJECTION/V1',
      sourceSpecificServingEntries,
    ),
    exact_detail_root: entryRoot('FIXTURE_RELEASE_EXACT_DETAILS/V1', detailEntries),
    query_projection_root: entryRoot('FIXTURE_RELEASE_QUERY_PROJECTION/V1', queryEntries),
    validated_semantic_graph_root: entryRoot(
      'FIXTURE_RELEASE_VALIDATED_SEMANTIC_GRAPHS/V1',
      semanticGraphEntries,
    ),
    correction_input_root: candidateCorrectionInputRoot(candidateCorrectionInputs.seal),
  };
  const manifestBody = {
    schema_version: isProjectionBound
      ? 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3'
      : hasIncompleteCanonicalRows
        ? 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2'
        : 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    release_state: 'CERTIFIED_OFFLINE_FIXTURE',
    contract_fingerprint: contractBundle.fingerprint,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    ...(isProjectionBound ? {
      serving_projection_version: servingProjectionBinding.serving_projection_version,
      query_projection_contract_digest: servingProjectionBinding.query_projection_contract_digest,
    } : {}),
    correction_input_seal_id: candidateCorrectionInputs.seal.candidate_correction_input_seal_id,
    deal_keys: dealKeys,
    counts: {
      deals: dealKeys.length,
      deal_directory_records: dealDirectoryRecords.length,
      metric_slots: members.length,
      observations: marketObservations.length,
      exclusions: marketExclusions.length,
      shared_rows: sharedRows.length,
      ...(carriesIncompletePartition ? {
        incomplete_canonical_rows: incompleteCanonicalRows.length,
      } : {}),
      source_specific_rows: sourceSpecificRows.length,
      source_specific_serving_records: sourceSpecificServingRecords.length,
      exact_detail_packages: exactDetailPackages.length,
      query_records: queryRecords.length,
      validated_semantic_graphs: releaseSemanticGraphs.length,
      correction_applications: candidateCorrectionInputs.seal.expected_active_application_ids.length,
      correction_discharges: candidateCorrectionInputs.discharges.length,
      unresolved: 0,
      failed: 0,
      duplicates: 0,
    },
    roots,
  };
  const manifestIdentityVersion = isProjectionBound ? 'V3' : hasIncompleteCanonicalRows ? 'V2' : 'V1';
  const manifest = Object.freeze({
    ...manifestBody,
    candidate_release_manifest_id: contentId(
      `FIXTURE_CANDIDATE_RELEASE_MANIFEST/${manifestIdentityVersion}`,
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      `FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/${manifestIdentityVersion}`,
      manifestBody,
    ),
  });
  return Object.freeze({
    schema_version: isProjectionBound
      ? 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V3'
      : hasIncompleteCanonicalRows
        ? 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V2'
        : 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V1',
    manifest,
    candidate_correction_input_seal: candidateCorrectionInputs.seal,
    correction_discharges: Object.freeze(
      candidateCorrectionInputs.discharges.map((discharge) => Object.freeze(clone(discharge))),
    ),
    deal_directory_records: Object.freeze(dealDirectoryRecords.map((row) => Object.freeze(clone(row)))),
    market_observations: Object.freeze(marketObservations.map((row) => Object.freeze(clone(row)))),
    market_exclusions: Object.freeze(marketExclusions.map((row) => Object.freeze(clone(row)))),
    shared_rows: Object.freeze(sharedRows.map((row) => Object.freeze(clone(row)))),
    ...(carriesIncompletePartition ? {
      incomplete_canonical_rows: Object.freeze(
        incompleteCanonicalRows.map((row) => Object.freeze(clone(row))),
      ),
    } : {}),
    reviewed_source_specific_rows: Object.freeze(sourceSpecificRows.map((row) => Object.freeze(clone(row)))),
    source_specific_serving_records: Object.freeze(
      sourceSpecificServingRecords.map((row) => Object.freeze(clone(row))),
    ),
    exact_detail_packages: Object.freeze(exactDetailPackages.map((row) => Object.freeze(clone(row)))),
    query_records: Object.freeze(queryRecords.map((row) => Object.freeze(clone(row)))),
    validated_semantic_graphs: Object.freeze(
      releaseSemanticGraphs.map((graph) => Object.freeze(clone(graph))),
    ),
  });
}

function validateCandidateReleaseManifest(manifest) {
  const isV2 = manifest?.schema_version === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2';
  const isV3 = manifest?.schema_version === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3';
  const carriesIncompletePartition = isV2 || isV3;
  requireExactKeys(manifest, [
    'schema_version',
    'release_state',
    'contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
    ...(isV3 ? ['serving_projection_version', 'query_projection_contract_digest'] : []),
    'correction_input_seal_id',
    'deal_keys',
    'counts',
    'roots',
    'candidate_release_manifest_id',
    'canonical_payload_digest',
  ], 'candidate release manifest');
  const {
    candidate_release_manifest_id: manifestId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = manifest;
  requireDigest(manifest.contract_fingerprint, 'manifest.contract_fingerprint');
  requireDigest(manifest.serving_namespace_id, 'manifest.serving_namespace_id');
  requireDigest(manifest.corpus_release_id, 'manifest.corpus_release_id');
  requireDigest(manifest.correction_input_seal_id, 'manifest.correction_input_seal_id');
  requireDigest(manifestId, 'manifest.candidate_release_manifest_id');
  requireDigest(payloadDigest, 'manifest.canonical_payload_digest');
  requireExactKeys(manifest.counts, [
    'deals',
    'deal_directory_records',
    'metric_slots',
    'observations',
    'exclusions',
    'shared_rows',
    ...(carriesIncompletePartition ? ['incomplete_canonical_rows'] : []),
    'source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'validated_semantic_graphs',
    'correction_applications',
    'correction_discharges',
    'unresolved',
    'failed',
    'duplicates',
  ], 'candidate release counts');
  requireExactKeys(manifest.roots, [
    'deal_directory_root',
    'observation_root',
    'exclusion_root',
    'shared_row_root',
    ...(carriesIncompletePartition ? ['incomplete_canonical_row_root'] : []),
    'source_specific_row_root',
    'source_specific_serving_projection_root',
    'exact_detail_root',
    'query_projection_root',
    'validated_semantic_graph_root',
    'correction_input_root',
  ], 'candidate release roots');
  Object.entries(manifest.roots).forEach(([key, value]) => requireDigest(value, `manifest.roots.${key}`));
  Object.entries(manifest.counts).forEach(([key, value]) => {
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`manifest.counts.${key} must be a non-negative integer`);
  });
  if (!Array.isArray(manifest.deal_keys)
    || canonicalJson(manifest.deal_keys) !== canonicalJson([...new Set(manifest.deal_keys)].sort())
    || manifest.deal_keys.some((key) => typeof key !== 'string' || !key)) {
    throw new TypeError('candidate release deal keys must be a complete sorted set');
  }
  if (isV3) validateServingProjectionBindingV2({
    serving_projection_version: manifest.serving_projection_version,
    query_projection_contract_digest: manifest.query_projection_contract_digest,
  });
  const identityVersion = isV3 ? 'V3' : isV2 ? 'V2' : 'V1';
  if (![
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2',
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3',
  ]
    .includes(manifest.schema_version)
    || manifest.release_state !== 'CERTIFIED_OFFLINE_FIXTURE'
    || manifest.counts.unresolved !== 0
    || manifest.counts.failed !== 0
    || manifest.counts.duplicates !== 0
    || manifest.counts.deals !== manifest.deal_keys.length
    || manifest.counts.deal_directory_records !== manifest.counts.deals
    || manifest.counts.metric_slots !== manifest.counts.observations + manifest.counts.exclusions
    || manifest.counts.shared_rows !== manifest.counts.observations
      + (manifest.counts.incomplete_canonical_rows || 0)
      + manifest.counts.source_specific_rows
    || (manifest.counts.incomplete_canonical_rows || 0) > manifest.counts.exclusions
    || (isV2 && manifest.counts.incomplete_canonical_rows < 1)
    || manifest.counts.source_specific_rows !== manifest.counts.source_specific_serving_records
    || manifest.counts.shared_rows !== manifest.counts.exact_detail_packages
    || manifest.counts.observations !== manifest.counts.query_records
    || manifest.counts.correction_applications !== manifest.counts.correction_discharges
    || manifestId !== contentId(`FIXTURE_CANDIDATE_RELEASE_MANIFEST/${identityVersion}`, body)
    || payloadDigest !== contentId(`FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/${identityVersion}`, body)) {
    throw new TypeError('candidate release manifest is not a complete certified release');
  }
  return true;
}

function validateCandidateReleaseBundle(release) {
  const isV2 = release?.schema_version === 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V2';
  const isV3 = release?.schema_version === 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V3';
  const carriesIncompletePartition = isV2 || isV3;
  requireExactKeys(release, [
    'schema_version',
    'manifest',
    'candidate_correction_input_seal',
    'correction_discharges',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
    ...(carriesIncompletePartition ? ['incomplete_canonical_rows'] : []),
    'reviewed_source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'validated_semantic_graphs',
  ], 'candidate release bundle');
  if (![
    'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V1',
    'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V2',
    'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V3',
  ].includes(release.schema_version)
    || isV2 !== (release.manifest.schema_version === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2')
    || isV3 !== (release.manifest.schema_version === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3')) {
    throw new TypeError('candidate release bundle schema is invalid');
  }
  validateCandidateReleaseManifest(release.manifest);
  for (const key of [
    'correction_discharges',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
    ...(carriesIncompletePartition ? ['incomplete_canonical_rows'] : []),
    'reviewed_source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'validated_semantic_graphs',
  ]) {
    if (!Array.isArray(release[key])) throw new TypeError(`candidate release ${key} must be an array`);
  }
  const manifest = release.manifest;
  const countChecks = {
    correction_discharges: release.correction_discharges.length,
    deal_directory_records: release.deal_directory_records.length,
    observations: release.market_observations.length,
    exclusions: release.market_exclusions.length,
    shared_rows: release.shared_rows.length,
    ...(carriesIncompletePartition ? {
      incomplete_canonical_rows: release.incomplete_canonical_rows.length,
    } : {}),
    source_specific_rows: release.reviewed_source_specific_rows.length,
    source_specific_serving_records: release.source_specific_serving_records.length,
    exact_detail_packages: release.exact_detail_packages.length,
    query_records: release.query_records.length,
    validated_semantic_graphs: release.validated_semantic_graphs.length,
  };
  for (const [key, count] of Object.entries(countChecks)) {
    if (manifest.counts[key] !== count) throw new TypeError(`candidate release ${key} count does not match its manifest`);
  }

  const terminalOutputs = [
    ...release.market_observations.map((observation) => ({
      metric_slot_key: observation.metric_slot_key,
      observation,
      exclusion: null,
    })),
    ...release.market_exclusions.map((exclusion) => ({
      metric_slot_key: exclusion.metric_slot_key,
      observation: null,
      exclusion,
    })),
  ];
  assertMetricSlotPartition(terminalOutputs);
  for (const terminal of [...release.market_observations, ...release.market_exclusions]) {
    if (terminal.corpus_release_id !== manifest.corpus_release_id
      || terminal.contract_fingerprint !== manifest.contract_fingerprint) {
      throw new TypeError('candidate release metric slot is outside its release identity');
    }
  }

  release.shared_rows.forEach(validateSharedServingRow);
  const canonicalRows = release.shared_rows.filter((row) => row.row_kind === 'CANONICAL_RESULT');
  const incompleteCanonicalRows = release.shared_rows.filter(
    (row) => row.row_kind === 'INCOMPLETE_CANONICAL_RESULT',
  );
  const sourceSpecificRows = release.shared_rows.filter((row) => row.row_kind === 'REVIEWED_SOURCE_SPECIFIC');
  if (canonicalRows.length !== release.market_observations.length
    || canonicalJson(incompleteCanonicalRows) !== canonicalJson(release.incomplete_canonical_rows || [])
    || sourceSpecificRows.length !== release.reviewed_source_specific_rows.length
    || canonicalJson(sourceSpecificRows) !== canonicalJson(release.reviewed_source_specific_rows)
    || canonicalRows.length + incompleteCanonicalRows.length + sourceSpecificRows.length
      !== release.shared_rows.length
    || new Set(release.shared_rows.map((row) => row.row_serving_key)).size !== release.shared_rows.length) {
    throw new TypeError('candidate release shared-row partition is incomplete or duplicated');
  }
  for (const row of incompleteCanonicalRows) {
    const body = row.incomplete_canonical_result;
    const matchingExclusions = release.market_exclusions.filter((exclusion) => (
      exclusion.metric_slot_key === body.metric_exclusion.metric_slot_key
        && exclusion.exclusion_serving_key === body.metric_exclusion.exclusion_serving_key
        && exclusion.deal_key === row.governed_deal_key
        && exclusion.deal_admission_id === row.deal_admission_id
        && exclusion.concept_key === body.concept_key
        && canonicalJson(exclusion.party) === canonicalJson(body.party)
        && exclusion.comparability_state === 'NOT_CERTIFIED'
    ));
    if (matchingExclusions.length !== 1
      || release.query_records.some((record) => record.row_serving_key === row.row_serving_key)
      || release.source_specific_serving_records.some((record) => (
        record.row_serving_key === row.row_serving_key
      ))) {
      throw new TypeError(
        'incomplete canonical result must have one exclusion and no market or source-specific projection',
      );
    }
  }
  for (const row of release.shared_rows) {
    if (row.corpus_release_id !== manifest.corpus_release_id
      || row.provenance.contract_fingerprint !== manifest.contract_fingerprint) {
      throw new TypeError('candidate release shared row is outside its release identity');
    }
  }
  validateReleaseWideEmbeddedCohorts({
    rows: release.shared_rows,
    servingNamespaceId: manifest.serving_namespace_id,
    observations: release.market_observations,
    exclusions: release.market_exclusions,
  });

  const canonicalRowsByKey = new Map(canonicalRows.map((row) => [row.row_serving_key, row]));
  const servingProjectionVersion = manifest.schema_version === 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3'
    ? manifest.serving_projection_version
    : SERVING_PROJECTION_VERSION_V1;
  for (const record of release.query_records) {
    const row = canonicalRowsByKey.get(record.row_serving_key);
    if (!row || canonicalJson(record) !== canonicalJson(projectSharedServingRowRecord({
      row,
      serving_namespace_id: manifest.serving_namespace_id,
      projection_version: servingProjectionVersion,
    }))) {
      throw new TypeError('candidate release query projection is not derived from its canonical shared row');
    }
  }
  if (new Set(release.query_records.map((record) => record.row_serving_key)).size
    !== release.query_records.length) {
    throw new TypeError('candidate release query projection contains duplicate rows');
  }

  const sourceRowsByKey = new Map(sourceSpecificRows.map((row) => [row.row_serving_key, row]));
  for (const record of release.source_specific_serving_records) {
    validateReviewedSourceSpecificRecord(record);
    const row = sourceRowsByKey.get(record.row_serving_key);
    if (!row || canonicalJson(record) !== canonicalJson(projectReviewedSourceSpecificRecord({
      row,
      serving_namespace_id: manifest.serving_namespace_id,
    }))) {
      throw new TypeError('candidate release source-specific projection is not derived from its reviewed shared row');
    }
  }

  const sharedRowsByKey = new Map(release.shared_rows.map((row) => [row.row_serving_key, row]));
  const detailRowKeys = release.exact_detail_packages.map((detailPackage) => {
    if (!detailPackage || typeof detailPackage !== 'object' || !detailPackage.row) {
      throw new TypeError('candidate release exact-detail package is invalid');
    }
    validateSharedServingRow(detailPackage.row);
    if (!Array.isArray(detailPackage.references) || detailPackage.references.length < 1
      || !Array.isArray(detailPackage.detail_payloads) || detailPackage.detail_payloads.length < 1
      || !Array.isArray(detailPackage.parent_edges) || detailPackage.parent_edges.length < 1) {
      throw new TypeError('candidate release exact-detail package is incomplete');
    }
    const releaseRow = sharedRowsByKey.get(detailPackage.row.row_serving_key);
    if (!releaseRow || canonicalJson(detailPackage.row) !== canonicalJson(releaseRow)) {
      throw new TypeError('candidate release exact-detail package row is not its independently certified shared row');
    }
    return detailPackage.row.row_serving_key;
  });
  if (canonicalJson([...detailRowKeys].sort())
    !== canonicalJson(release.shared_rows.map((row) => row.row_serving_key).sort())) {
    throw new TypeError('candidate release exact-detail packages do not cover every shared row exactly once');
  }

  const observationEntries = release.market_observations.map((row) => ({
    serving_key: row.market_observation_serving_key,
    occurrence_id: row.metric_observation_occurrence_id,
    metric_slot_key: row.metric_slot_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const exclusionEntries = release.market_exclusions.map((row) => ({
    serving_key: row.exclusion_serving_key,
    metric_slot_key: row.metric_slot_key,
    reason_code: row.exclusion_reason,
    payload_digest: row.canonical_payload_digest,
  }));
  const sharedRowEntries = release.shared_rows.map((row) => ({
    row_serving_key: row.row_serving_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const sourceSpecificEntries = release.reviewed_source_specific_rows.map((row) => ({
    row_serving_key: row.row_serving_key,
    open_world_candidate_occurrence_id: row.reviewed_source_specific.candidate_occurrence.open_world_candidate_occurrence_id,
    final_disposition_id: row.reviewed_source_specific.final_disposition.final_disposition_id,
    payload_digest: row.canonical_payload_digest,
  }));
  const incompleteCanonicalEntries = (release.incomplete_canonical_rows || []).map((row) => ({
    row_serving_key: row.row_serving_key,
    governed_deal_key: row.governed_deal_key,
    derived_result_occurrence_id: row.incomplete_canonical_result.derived_result_occurrence_id,
    derived_result_revision_id: row.incomplete_canonical_result.derived_result_revision_id,
    metric_slot_key: row.incomplete_canonical_result.metric_exclusion.metric_slot_key,
    exclusion_serving_key: row.incomplete_canonical_result.metric_exclusion.exclusion_serving_key,
    payload_digest: row.canonical_payload_digest,
  }));
  const sourceSpecificServingEntries = release.source_specific_serving_records.map((record) => ({
    reviewed_source_specific_serving_key: record.reviewed_source_specific_serving_key,
    row_serving_key: record.row_serving_key,
    open_world_candidate_occurrence_id: record.open_world_candidate_occurrence_id,
    final_disposition_id: record.final_disposition_id,
    payload_digest: record.canonical_payload_digest,
  })).sort((left, right) => (
    left.reviewed_source_specific_serving_key.localeCompare(right.reviewed_source_specific_serving_key)
  ));
  const detailEntries = release.exact_detail_packages.map(buildExactDetailReleaseEntry);
  const queryEntries = release.query_records.map((record) => ({
    row_serving_key: record.row_serving_key,
    payload_digest: record.canonical_payload_digest,
    record_digest: contentId('FIXTURE_QUERY_RECORD/V1', record),
  }));
  const expectedRoots = {
    correction_input_root: candidateCorrectionInputRoot(release.candidate_correction_input_seal),
    deal_directory_root: entryRoot('FIXTURE_RELEASE_DEAL_DIRECTORY/V1', release.deal_directory_records.map((row) => ({
      application_deal_id: row.application_deal_id,
      governed_deal_key: row.governed_deal_key,
      deal_admission_id: row.deal_admission_id,
      record_id: row.deal_serving_directory_record_id,
      payload_digest: row.canonical_payload_digest,
    }))),
    observation_root: entryRoot('FIXTURE_RELEASE_OBSERVATIONS/V1', observationEntries),
    exclusion_root: entryRoot('FIXTURE_RELEASE_EXCLUSIONS/V1', exclusionEntries),
    shared_row_root: entryRoot('FIXTURE_RELEASE_SHARED_ROWS/V1', sharedRowEntries),
    ...(carriesIncompletePartition ? {
      incomplete_canonical_row_root: entryRoot(
        'FIXTURE_RELEASE_INCOMPLETE_CANONICAL_ROWS/V1',
        incompleteCanonicalEntries,
      ),
    } : {}),
    source_specific_row_root: entryRoot('FIXTURE_RELEASE_SOURCE_SPECIFIC_ROWS/V1', sourceSpecificEntries),
    source_specific_serving_projection_root: entryRoot(
      'FIXTURE_RELEASE_SOURCE_SPECIFIC_SERVING_PROJECTION/V1',
      sourceSpecificServingEntries,
    ),
    exact_detail_root: entryRoot('FIXTURE_RELEASE_EXACT_DETAILS/V1', detailEntries),
    query_projection_root: entryRoot('FIXTURE_RELEASE_QUERY_PROJECTION/V1', queryEntries),
  };
  const graphLineages = release.exact_detail_packages.flatMap(graphLineageFromDetailPackage);
  const { entries: semanticGraphEntries } = buildValidatedSemanticGraphEntries({
    graphs: release.validated_semantic_graphs,
    lineages: graphLineages,
  });
  expectedRoots.validated_semantic_graph_root = entryRoot(
    'FIXTURE_RELEASE_VALIDATED_SEMANTIC_GRAPHS/V1',
    semanticGraphEntries,
  );
  validateReleaseCorrectionInputs({
    seal: release.candidate_correction_input_seal,
    discharges: release.correction_discharges,
    marketObservations: release.market_observations,
    sharedRows: release.shared_rows,
    queryRecords: release.query_records,
    exactDetailPackages: release.exact_detail_packages,
    manifest,
  });
  const expectedDealKeys = [...new Set([
    ...release.market_observations.map((row) => row.deal_key),
    ...release.market_exclusions.map((row) => row.deal_key),
    ...release.reviewed_source_specific_rows.map((row) => row.governed_deal_key),
  ])].sort();
  release.deal_directory_records.forEach(validateDealServingDirectoryRecord);
  if (new Set(release.deal_directory_records.map((row) => row.application_deal_id)).size
      !== release.deal_directory_records.length
    || canonicalJson(release.deal_directory_records.map((row) => row.governed_deal_key).sort())
      !== canonicalJson(expectedDealKeys)
    || release.deal_directory_records.some((row) => (
      row.serving_namespace_id !== manifest.serving_namespace_id
      || row.corpus_release_id !== manifest.corpus_release_id
      || row.contract_fingerprint !== manifest.contract_fingerprint
    ))) {
    throw new TypeError('candidate release deal directory is incomplete or outside its release identity');
  }
  if (canonicalJson(expectedRoots) !== canonicalJson(manifest.roots)
    || canonicalJson(expectedDealKeys) !== canonicalJson(manifest.deal_keys)) {
    throw new TypeError('candidate release contents do not match its certified roots or deal inventory');
  }
  return true;
}

function buildInitialActiveReleasePointer({ environment = 'staging' } = {}) {
  if (environment !== 'staging') throw new TypeError('fixture active release pointers are staging-only');
  const body = {
    schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V1',
    environment,
    generation: 0,
    corpus_release_id: null,
    serving_namespace_id: null,
    candidate_release_manifest_id: null,
    previous_pointer_id: null,
  };
  return Object.freeze({
    ...body,
    pointer_id: contentId('FIXTURE_ACTIVE_RELEASE_POINTER/V1', body),
    canonical_payload_digest: contentId('FIXTURE_ACTIVE_RELEASE_POINTER_PAYLOAD/V1', body),
  });
}

function validateActiveReleasePointer(pointer) {
  const commonKeys = [
    'schema_version',
    'environment',
    'generation',
    'corpus_release_id',
    'serving_namespace_id',
    'candidate_release_manifest_id',
    'previous_pointer_id',
    'pointer_id',
    'canonical_payload_digest',
  ];
  const isV2 = pointer?.schema_version === 'FIXTURE_ACTIVE_RELEASE_POINTER/V2';
  requireExactKeys(pointer, isV2 ? [
    ...commonKeys,
    'correction_input_seal_id',
    'correction_input_root',
  ] : commonKeys, 'active release pointer');
  const { pointer_id: pointerId, canonical_payload_digest: payloadDigest, ...body } = pointer;
  requireDigest(pointerId, 'pointer.pointer_id');
  requireDigest(payloadDigest, 'pointer.canonical_payload_digest');
  for (const key of ['corpus_release_id', 'serving_namespace_id', 'candidate_release_manifest_id', 'previous_pointer_id']) {
    if (pointer[key] !== null) requireDigest(pointer[key], `pointer.${key}`);
  }
  const empty = pointer.corpus_release_id === null
    && pointer.serving_namespace_id === null
    && pointer.candidate_release_manifest_id === null
    && pointer.previous_pointer_id === null;
  const active = pointer.corpus_release_id !== null
    && pointer.serving_namespace_id !== null
    && pointer.candidate_release_manifest_id !== null
    && pointer.previous_pointer_id !== null;
  if (isV2) {
    requireDigest(pointer.correction_input_seal_id, 'pointer.correction_input_seal_id');
    requireDigest(pointer.correction_input_root, 'pointer.correction_input_root');
    if (pointer.environment !== 'staging'
      || !Number.isInteger(pointer.generation)
      || pointer.generation < 1
      || !active
      || pointerId !== contentId('FIXTURE_ACTIVE_RELEASE_POINTER/V2', body)
      || payloadDigest !== contentId('FIXTURE_ACTIVE_RELEASE_POINTER_PAYLOAD/V2', body)) {
      throw new TypeError('active release pointer identity is invalid');
    }
    return true;
  }
  if (pointer.schema_version !== 'FIXTURE_ACTIVE_RELEASE_POINTER/V1'
    || pointer.environment !== 'staging'
    || !Number.isInteger(pointer.generation)
    || pointer.generation < 0
    || (pointer.generation === 0 ? !empty : !active)
    || pointerId !== contentId('FIXTURE_ACTIVE_RELEASE_POINTER/V1', body)
    || payloadDigest !== contentId('FIXTURE_ACTIVE_RELEASE_POINTER_PAYLOAD/V1', body)) {
    throw new TypeError('active release pointer identity is invalid');
  }
  return true;
}

function planActiveReleasePointerSwap({
  current_pointer: currentPointer,
  expected_current_pointer_id: expectedCurrentPointerId,
  candidate_manifest: candidateManifest,
} = {}) {
  validateActiveReleasePointer(currentPointer);
  validateCandidateReleaseManifest(candidateManifest);
  if (expectedCurrentPointerId !== currentPointer.pointer_id) {
    throw new TypeError('active release pointer changed before the atomic swap');
  }
  const nextBody = {
    schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V2',
    environment: currentPointer.environment,
    generation: currentPointer.generation + 1,
    corpus_release_id: candidateManifest.corpus_release_id,
    serving_namespace_id: candidateManifest.serving_namespace_id,
    candidate_release_manifest_id: candidateManifest.candidate_release_manifest_id,
    correction_input_seal_id: candidateManifest.correction_input_seal_id,
    correction_input_root: candidateManifest.roots.correction_input_root,
    previous_pointer_id: currentPointer.pointer_id,
  };
  const nextPointer = Object.freeze({
    ...nextBody,
    pointer_id: contentId('FIXTURE_ACTIVE_RELEASE_POINTER/V2', nextBody),
    canonical_payload_digest: contentId('FIXTURE_ACTIVE_RELEASE_POINTER_PAYLOAD/V2', nextBody),
  });
  const commandBody = {
    schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER_SWAP/V2',
    environment: currentPointer.environment,
    expected_current_pointer_id: currentPointer.pointer_id,
    next_pointer_id: nextPointer.pointer_id,
    candidate_release_manifest_id: candidateManifest.candidate_release_manifest_id,
    correction_input_seal_id: candidateManifest.correction_input_seal_id,
    correction_input_root: candidateManifest.roots.correction_input_root,
  };
  return Object.freeze({
    ...commandBody,
    pointer_swap_command_id: contentId('FIXTURE_ACTIVE_RELEASE_POINTER_SWAP/V2', commandBody),
    next_pointer: nextPointer,
  });
}

function offlineReleaseRoots({
  observation,
  sharedRow,
  exactDetailPackage,
  cohortRequest,
  cohortResult,
  queryProjection,
  dealDirectoryEntry,
}) {
  return {
    observation_root: contentId('OFFLINE_RELEASE_OBSERVATIONS/V1', [
      observation.canonical_payload_digest,
    ]),
    shared_row_root: contentId('OFFLINE_RELEASE_ROWS/V1', [
      sharedRow.canonical_payload_digest,
    ]),
    exact_detail_root: contentId('OFFLINE_RELEASE_DETAILS/V1', [
      exactDetailPackage.detail_payloads[0].canonical_payload_digest,
    ]),
    cohort_request_root: contentId('OFFLINE_RELEASE_COHORT_REQUESTS/V1', [
      contentId('MARKET_COHORT_REQUEST_PAYLOAD/V2', cohortRequest),
    ]),
    cohort_result_root: contentId('OFFLINE_RELEASE_COHORT_RESULTS/V1', [
      contentId('MARKET_COHORT_RESULT_PAYLOAD/V2', cohortResult),
    ]),
    query_projection_root: contentId('OFFLINE_RELEASE_QUERY/V1', [
      queryProjection.canonical_payload_digest,
    ]),
    deal_directory_root: contentId('OFFLINE_RELEASE_DEALS/V1', [
      dealDirectoryEntry.canonical_payload_digest,
    ]),
  };
}

function buildOfflineCandidateRelease({
  contract_bundle: contractBundle,
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  observation,
  shared_row: sharedRow,
  exact_detail_package: exactDetailPackage,
  cohort_request: cohortRequest,
  cohort_result: cohortResult,
  query_projection: queryProjection,
  deal_directory_entry: dealDirectoryEntry,
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(servingNamespaceId, 'serving_namespace_id');
  requireDigest(corpusReleaseId, 'corpus_release_id');
  validateOfflineCandidateSharedServingRow(sharedRow);
  validateOfflineInterpretedMarketMetricSlot({
    metric_slot_key: observation?.metric_slot_key,
    observation,
    exclusion: null,
  });
  validateOfflineInterpretedMarketCohortRequest(cohortRequest);
  validateOfflineInterpretedMarketCohortResult(
    cohortResult,
    cohortRequest,
  );
  validateOfflineInterpretedQueryProjectionRecord(queryProjection);
  validateDealServingDirectoryRecord(dealDirectoryEntry);
  if (observation?.schema_version !== 'MARKET_OBSERVATION/V2'
    || exactDetailPackage?.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V2'
    || exactDetailPackage.row.row_serving_key !== sharedRow.row_serving_key
    || cohortRequest?.schema_version !== 'MARKET_COHORT_REQUEST/V2'
    || cohortResult?.schema_version !== 'MARKET_COHORT_RESULT/V2'
    || queryProjection?.schema_version !== 'QUERY_PROJECTION_RECORD/V3'
    || queryProjection.row_serving_key !== sharedRow.row_serving_key
    || dealDirectoryEntry?.governed_deal_key !== sharedRow.governed_deal_key) {
    throw new TypeError('offline candidate release partitions do not close');
  }
  const roots = offlineReleaseRoots({
    observation,
    sharedRow,
    exactDetailPackage,
    cohortRequest,
    cohortResult,
    queryProjection,
    dealDirectoryEntry,
  });
  const manifestBody = {
    schema_version: 'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    activation_eligibility:
      'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED',
    certification_state: 'CERTIFIED_OFFLINE_NOT_ACTIVATABLE',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    comparability_class_digest:
      cohortRequest.comparability_class_digest,
    counts: {
      deals: 1,
      metric_slots: 1,
      observations: 1,
      shared_rows: 1,
      exact_detail_packages: 1,
      cohort_requests: 1,
      cohort_results: 1,
      query_records: 1,
    },
    roots,
  };
  const manifest = {
    ...manifestBody,
    candidate_release_manifest_id: contentId(
      'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
      manifestBody,
    ),
  };
  const bundle = {
    schema_version: 'OFFLINE_CANDIDATE_RELEASE_BUNDLE/V1',
    manifest,
    market_observations: [clone(observation)],
    shared_rows: [clone(sharedRow)],
    exact_detail_packages: [clone(exactDetailPackage)],
    cohort_requests: [clone(cohortRequest)],
    cohort_results: [clone(cohortResult)],
    query_records: [clone(queryProjection)],
    deal_directory_entries: [clone(dealDirectoryEntry)],
  };
  validateOfflineCandidateRelease(bundle);
  return Object.freeze(bundle);
}

function validateOfflineCandidateRelease(bundle) {
  requireExactKeys(bundle, [
    'schema_version',
    'manifest',
    'market_observations',
    'shared_rows',
    'exact_detail_packages',
    'cohort_requests',
    'cohort_results',
    'query_records',
    'deal_directory_entries',
  ], 'offline candidate release bundle');
  requireExactKeys(bundle.manifest, [
    'schema_version',
    'authority_scope',
    'activation_eligibility',
    'certification_state',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'comparability_class_digest',
    'counts',
    'roots',
    'candidate_release_manifest_id',
    'canonical_payload_digest',
  ], 'offline candidate release manifest');
  if (!bundle
    || bundle.schema_version !== 'OFFLINE_CANDIDATE_RELEASE_BUNDLE/V1'
    || bundle.manifest?.certification_state
      !== 'CERTIFIED_OFFLINE_NOT_ACTIVATABLE'
    || bundle.manifest.activation_eligibility
      !== 'INELIGIBLE_CONTRACT_NOT_SERVING_ADMITTED'
    || bundle.market_observations?.length !== 1
    || bundle.shared_rows?.length !== 1
    || bundle.exact_detail_packages?.length !== 1
    || bundle.cohort_requests?.length !== 1
    || bundle.cohort_results?.length !== 1
    || bundle.query_records?.length !== 1
    || bundle.deal_directory_entries?.length !== 1) {
    throw new TypeError('invalid offline candidate release');
  }
  const observation = bundle.market_observations[0];
  const row = bundle.shared_rows[0];
  const detail = bundle.exact_detail_packages[0];
  const cohortRequest = bundle.cohort_requests[0];
  const cohortResult = bundle.cohort_results[0];
  const queryRecord = bundle.query_records[0];
  const directory = bundle.deal_directory_entries[0];
  validateOfflineInterpretedMarketMetricSlot({
    metric_slot_key: observation.metric_slot_key,
    observation,
    exclusion: null,
  });
  validateOfflineCandidateSharedServingRow(row);
  validateOfflineInterpretedResultCompositionDetailPackageStructure(detail);
  validateOfflineInterpretedMarketCohortRequest(cohortRequest);
  validateOfflineInterpretedMarketCohortResult(
    cohortResult,
    cohortRequest,
  );
  validateOfflineInterpretedQueryProjectionRecord(queryRecord);
  const expectedQueryRecord =
    buildOfflineInterpretedQueryProjectionRecord({
      row,
      observation,
    });
  validateDealServingDirectoryRecord(directory);
  if (detail?.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V2'
    || detail.row?.row_serving_key !== row.row_serving_key
    || canonicalJson(detail.row) !== canonicalJson(row)
    || detail.detail_payloads?.length !== 1
    || detail.detail_payloads[0].parent_row_serving_key
      !== row.row_serving_key
    || canonicalJson(queryRecord) !== canonicalJson(expectedQueryRecord)
    || queryRecord.row_serving_key !== row.row_serving_key
    || directory.corpus_release_id !== row.corpus_release_id
    || directory.serving_namespace_id
      !== bundle.manifest.serving_namespace_id
    || directory.governed_deal_key !== row.governed_deal_key
    || directory.deal_admission_id !== row.deal_admission_id
    || directory.contract_fingerprint
      !== bundle.manifest.contract_fingerprint
    || bundle.manifest.corpus_release_id !== row.corpus_release_id
    || bundle.manifest.contract_fingerprint
      !== row.provenance.contract_fingerprint
    || observation.contract_fingerprint
      !== bundle.manifest.contract_fingerprint
    || cohortRequest.contract_fingerprint
      !== bundle.manifest.contract_fingerprint
    || observation.corpus_release_id !== row.corpus_release_id
    || cohortRequest.corpus_release_id !== row.corpus_release_id
    || cohortRequest.serving_namespace_id
      !== bundle.manifest.serving_namespace_id
    || cohortResult.serving_namespace_id
      !== bundle.manifest.serving_namespace_id
    || cohortRequest.comparability_class_digest
      !== observation.comparability_context.comparability_class_digest
    || bundle.manifest.comparability_class_digest
      !== cohortRequest.comparability_class_digest) {
    throw new TypeError('offline candidate release lineage does not close');
  }
  const expectedRoots = offlineReleaseRoots({
    observation,
    sharedRow: row,
    exactDetailPackage: detail,
    cohortRequest,
    cohortResult,
    queryProjection: queryRecord,
    dealDirectoryEntry: directory,
  });
  const expectedCounts = {
    deals: 1,
    metric_slots: 1,
    observations: 1,
    shared_rows: 1,
    exact_detail_packages: 1,
    cohort_requests: 1,
    cohort_results: 1,
    query_records: 1,
  };
  const expectedCohortCounts = {
    eligible_deals: 1,
    applicable_deals: 1,
    examined_deals: 1,
    present_deals: 1,
    comparable_deals: 1,
    distribution_deals: 1,
    excluded_deals: 0,
    observation_slots: 1,
    excluded_slots: 0,
  };
  const manifestBody = { ...bundle.manifest };
  delete manifestBody.candidate_release_manifest_id;
  delete manifestBody.canonical_payload_digest;
  if (canonicalJson(bundle.manifest.roots) !== canonicalJson(expectedRoots)
    || canonicalJson(bundle.manifest.counts)
      !== canonicalJson(expectedCounts)
    || canonicalJson(cohortResult.counts)
      !== canonicalJson(expectedCohortCounts)
    || canonicalJson(cohortResult.distribution) !== canonicalJson([{
      canonical_value: observation.canonical_value,
      subject_count: 1,
      deal_count: 1,
    }])
    || canonicalJson(cohortResult.exclusions) !== '[]'
    || bundle.manifest.candidate_release_manifest_id !== contentId(
      'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
      manifestBody,
    )
    || bundle.manifest.canonical_payload_digest !== contentId(
      'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
      manifestBody,
    )) {
    throw new TypeError('offline candidate release manifest has drifted');
  }
  return true;
}

module.exports = {
  buildExactDetailReleaseEntry,
  buildValidatedSemanticGraphEntries,
  MAX_RELEASE_MEMBERS,
  buildDealServingDirectoryRecord,
  buildFixtureCandidateRelease,
  buildOfflineCandidateRelease,
  buildReleaseCorrectionMaterialisation,
  buildReleaseCorrectionMaterialisations,
  buildInitialActiveReleasePointer,
  planActiveReleasePointerSwap,
  releaseWideMarketContext,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
  validateDealServingDirectoryRecord,
  validateOfflineCandidateRelease,
};
