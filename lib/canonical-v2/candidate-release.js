const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  validateValidatedDefinitionGraph,
  validateValidatedDefinitionGraphIdentity,
} = require('./definition-graph');
const { validateFixtureExactDetailPackage } = require('./exact-detail');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { projectSharedServingRowRecord } = require('./query-result');
const {
  projectReviewedSourceSpecificRecord,
  validateReviewedSourceSpecificRecord,
} = require('./source-specific-context');
const {
  assertMetricSlotPartition,
  validateProjectedMetricSlotOutput,
} = require('./serving-projection');
const { validateSharedServingRow } = require('./shared-serving-row');

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

function entryRoot(domain, entries) {
  return contentId(domain, entries);
}

function graphLineageFromMember(member) {
  const source = member?.exact_detail?.source;
  const sourceAdmission = member?.exact_detail?.source_admission;
  const row = member?.shared_row;
  if (!source?.document_hash || !source?.canonical_text_id
    || !sourceAdmission?.source_admission_manifest_id
    || !row?.governed_deal_key || !row?.deal_admission_id) return null;
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
    .map((payload) => payload?.response_body?.source_lineage)
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
  requireExactKeys(member.exact_detail, [
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
  });
  if (canonicalJson(member.exact_detail.package.row) !== canonicalJson(member.shared_row)) {
    throw new TypeError('exact-detail package and shared row are not the same release member');
  }
  return projectSharedServingRowRecord({
    row: member.shared_row,
    serving_namespace_id: servingNamespaceId,
  });
}

function validateExclusionMember(member) {
  if (member.shared_row !== null || member.exact_detail !== null) {
    throw new TypeError('an excluded metric slot cannot carry a plausible shared row or source action');
  }
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
  const compiled = compileMarketCohortRequest({
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: row.provenance.contract_fingerprint,
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    subject_deal_key: row.governed_deal_key,
    filters: {},
  });
  const cohort = [
    ...observations.map((terminal) => ({ terminal, excluded: false })),
    ...exclusions.map((terminal) => ({ terminal, excluded: true })),
  ].filter((item) => (
    item.terminal.deal_key !== row.governed_deal_key
      && sameCohortBasis(row, item.terminal)
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
  return {
    ...clone(market),
    cohort: {
      cohort_digest: compiled.cohort_digest,
      counts,
      distribution,
      exclusions: groupedExclusions,
    },
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

function buildFixtureCandidateRelease({
  contract_bundle: contractBundle,
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  members,
  source_specific_members: sourceSpecificMembers = [],
  validated_semantic_graphs: validatedSemanticGraphs = [],
  deal_directory_entries: dealDirectoryEntries = [],
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(servingNamespaceId, 'serving_namespace_id');
  requireDigest(corpusReleaseId, 'corpus_release_id');
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
      });
      marketObservations.push(output.observation);
      sharedRows.push(member.shared_row);
      exactDetailPackages.push(member.exact_detail.package);
      queryRecords.push(queryRecord);
    } else {
      validateExclusionMember(member);
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
  ].filter(Boolean);
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
  exactDetailPackages.sort((left, right) => left.row.row_serving_key.localeCompare(right.row.row_serving_key));
  queryRecords.sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));

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
  const sourceSpecificServingEntries = sourceSpecificServingRecords.map((record) => ({
    reviewed_source_specific_serving_key: record.reviewed_source_specific_serving_key,
    row_serving_key: record.row_serving_key,
    open_world_candidate_occurrence_id: record.open_world_candidate_occurrence_id,
    final_disposition_id: record.final_disposition_id,
    payload_digest: record.canonical_payload_digest,
  })).sort((left, right) => (
    left.reviewed_source_specific_serving_key.localeCompare(right.reviewed_source_specific_serving_key)
  ));
  const detailEntries = exactDetailPackages.map((detailPackage) => ({
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: detailPackage.references[0].source_detail_reference_id,
    source_detail_payload_id: detailPackage.detail_payloads[0].source_detail_payload_id,
    parent_edge_id: detailPackage.parent_edges[0].parent_edge_id,
  }));
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
  };
  const manifestBody = {
    schema_version: 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    release_state: 'CERTIFIED_OFFLINE_FIXTURE',
    contract_fingerprint: contractBundle.fingerprint,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    deal_keys: dealKeys,
    counts: {
      deals: dealKeys.length,
      deal_directory_records: dealDirectoryRecords.length,
      metric_slots: members.length,
      observations: marketObservations.length,
      exclusions: marketExclusions.length,
      shared_rows: sharedRows.length,
      source_specific_rows: sourceSpecificRows.length,
      source_specific_serving_records: sourceSpecificServingRecords.length,
      exact_detail_packages: exactDetailPackages.length,
      query_records: queryRecords.length,
      validated_semantic_graphs: releaseSemanticGraphs.length,
      unresolved: 0,
      failed: 0,
      duplicates: 0,
    },
    roots,
  };
  const manifest = Object.freeze({
    ...manifestBody,
    candidate_release_manifest_id: contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1', manifestBody),
    canonical_payload_digest: contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1', manifestBody),
  });
  return Object.freeze({
    schema_version: 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V1',
    manifest,
    deal_directory_records: Object.freeze(dealDirectoryRecords.map((row) => Object.freeze(clone(row)))),
    market_observations: Object.freeze(marketObservations.map((row) => Object.freeze(clone(row)))),
    market_exclusions: Object.freeze(marketExclusions.map((row) => Object.freeze(clone(row)))),
    shared_rows: Object.freeze(sharedRows.map((row) => Object.freeze(clone(row)))),
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
  requireExactKeys(manifest, [
    'schema_version',
    'release_state',
    'contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
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
  requireDigest(manifestId, 'manifest.candidate_release_manifest_id');
  requireDigest(payloadDigest, 'manifest.canonical_payload_digest');
  requireExactKeys(manifest.counts, [
    'deals',
    'deal_directory_records',
    'metric_slots',
    'observations',
    'exclusions',
    'shared_rows',
    'source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'validated_semantic_graphs',
    'unresolved',
    'failed',
    'duplicates',
  ], 'candidate release counts');
  requireExactKeys(manifest.roots, [
    'deal_directory_root',
    'observation_root',
    'exclusion_root',
    'shared_row_root',
    'source_specific_row_root',
    'source_specific_serving_projection_root',
    'exact_detail_root',
    'query_projection_root',
    'validated_semantic_graph_root',
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
  if (manifest.schema_version !== 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1'
    || manifest.release_state !== 'CERTIFIED_OFFLINE_FIXTURE'
    || manifest.counts.unresolved !== 0
    || manifest.counts.failed !== 0
    || manifest.counts.duplicates !== 0
    || manifest.counts.deals !== manifest.deal_keys.length
    || manifest.counts.deal_directory_records !== manifest.counts.deals
    || manifest.counts.metric_slots !== manifest.counts.observations + manifest.counts.exclusions
    || manifest.counts.shared_rows !== manifest.counts.observations + manifest.counts.source_specific_rows
    || manifest.counts.source_specific_rows !== manifest.counts.source_specific_serving_records
    || manifest.counts.shared_rows !== manifest.counts.exact_detail_packages
    || manifest.counts.observations !== manifest.counts.query_records
    || manifestId !== contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1', body)
    || payloadDigest !== contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1', body)) {
    throw new TypeError('candidate release manifest is not a complete certified release');
  }
  return true;
}

function validateCandidateReleaseBundle(release) {
  requireExactKeys(release, [
    'schema_version',
    'manifest',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
    'reviewed_source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'validated_semantic_graphs',
  ], 'candidate release bundle');
  if (release.schema_version !== 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V1') {
    throw new TypeError('candidate release bundle schema is invalid');
  }
  validateCandidateReleaseManifest(release.manifest);
  for (const key of [
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
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
    deal_directory_records: release.deal_directory_records.length,
    observations: release.market_observations.length,
    exclusions: release.market_exclusions.length,
    shared_rows: release.shared_rows.length,
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
  const sourceSpecificRows = release.shared_rows.filter((row) => row.row_kind === 'REVIEWED_SOURCE_SPECIFIC');
  if (canonicalRows.length !== release.market_observations.length
    || sourceSpecificRows.length !== release.reviewed_source_specific_rows.length
    || canonicalJson(sourceSpecificRows) !== canonicalJson(release.reviewed_source_specific_rows)
    || new Set(release.shared_rows.map((row) => row.row_serving_key)).size !== release.shared_rows.length) {
    throw new TypeError('candidate release shared-row partition is incomplete or duplicated');
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
  for (const record of release.query_records) {
    const row = canonicalRowsByKey.get(record.row_serving_key);
    if (!row || canonicalJson(record) !== canonicalJson(projectSharedServingRowRecord({
      row,
      serving_namespace_id: manifest.serving_namespace_id,
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
  const sourceSpecificServingEntries = release.source_specific_serving_records.map((record) => ({
    reviewed_source_specific_serving_key: record.reviewed_source_specific_serving_key,
    row_serving_key: record.row_serving_key,
    open_world_candidate_occurrence_id: record.open_world_candidate_occurrence_id,
    final_disposition_id: record.final_disposition_id,
    payload_digest: record.canonical_payload_digest,
  })).sort((left, right) => (
    left.reviewed_source_specific_serving_key.localeCompare(right.reviewed_source_specific_serving_key)
  ));
  const detailEntries = release.exact_detail_packages.map((detailPackage) => ({
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: detailPackage.references[0].source_detail_reference_id,
    source_detail_payload_id: detailPackage.detail_payloads[0].source_detail_payload_id,
    parent_edge_id: detailPackage.parent_edges[0].parent_edge_id,
  }));
  const queryEntries = release.query_records.map((record) => ({
    row_serving_key: record.row_serving_key,
    payload_digest: record.canonical_payload_digest,
    record_digest: contentId('FIXTURE_QUERY_RECORD/V1', record),
  }));
  const expectedRoots = {
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
  requireExactKeys(pointer, [
    'schema_version',
    'environment',
    'generation',
    'corpus_release_id',
    'serving_namespace_id',
    'candidate_release_manifest_id',
    'previous_pointer_id',
    'pointer_id',
    'canonical_payload_digest',
  ], 'active release pointer');
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
    schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V1',
    environment: currentPointer.environment,
    generation: currentPointer.generation + 1,
    corpus_release_id: candidateManifest.corpus_release_id,
    serving_namespace_id: candidateManifest.serving_namespace_id,
    candidate_release_manifest_id: candidateManifest.candidate_release_manifest_id,
    previous_pointer_id: currentPointer.pointer_id,
  };
  const nextPointer = Object.freeze({
    ...nextBody,
    pointer_id: contentId('FIXTURE_ACTIVE_RELEASE_POINTER/V1', nextBody),
    canonical_payload_digest: contentId('FIXTURE_ACTIVE_RELEASE_POINTER_PAYLOAD/V1', nextBody),
  });
  const commandBody = {
    schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER_SWAP/V1',
    environment: currentPointer.environment,
    expected_current_pointer_id: currentPointer.pointer_id,
    next_pointer_id: nextPointer.pointer_id,
    candidate_release_manifest_id: candidateManifest.candidate_release_manifest_id,
  };
  return Object.freeze({
    ...commandBody,
    pointer_swap_command_id: contentId('FIXTURE_ACTIVE_RELEASE_POINTER_SWAP/V1', commandBody),
    next_pointer: nextPointer,
  });
}

module.exports = {
  buildValidatedSemanticGraphEntries,
  MAX_RELEASE_MEMBERS,
  buildDealServingDirectoryRecord,
  buildFixtureCandidateRelease,
  buildInitialActiveReleasePointer,
  planActiveReleasePointerSwap,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
  validateDealServingDirectoryRecord,
};
