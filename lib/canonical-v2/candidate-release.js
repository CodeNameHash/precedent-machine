const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const { validateFixtureExactDetailPackage } = require('./exact-detail');
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
const MAX_RELEASE_MEMBERS = 5000;

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

function buildFixtureCandidateRelease({
  contract_bundle: contractBundle,
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  members,
  source_specific_members: sourceSpecificMembers = [],
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
  for (const member of members) {
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
  const roots = {
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
  const manifestBody = {
    schema_version: 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    release_state: 'CERTIFIED_OFFLINE_FIXTURE',
    contract_fingerprint: contractBundle.fingerprint,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    deal_keys: dealKeys,
    counts: {
      deals: dealKeys.length,
      metric_slots: members.length,
      observations: marketObservations.length,
      exclusions: marketExclusions.length,
      shared_rows: sharedRows.length,
      source_specific_rows: sourceSpecificRows.length,
      source_specific_serving_records: sourceSpecificServingRecords.length,
      exact_detail_packages: exactDetailPackages.length,
      query_records: queryRecords.length,
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
    market_observations: Object.freeze(marketObservations.map((row) => Object.freeze(clone(row)))),
    market_exclusions: Object.freeze(marketExclusions.map((row) => Object.freeze(clone(row)))),
    shared_rows: Object.freeze(sharedRows.map((row) => Object.freeze(clone(row)))),
    reviewed_source_specific_rows: Object.freeze(sourceSpecificRows.map((row) => Object.freeze(clone(row)))),
    source_specific_serving_records: Object.freeze(
      sourceSpecificServingRecords.map((row) => Object.freeze(clone(row))),
    ),
    exact_detail_packages: Object.freeze(exactDetailPackages.map((row) => Object.freeze(clone(row)))),
    query_records: Object.freeze(queryRecords.map((row) => Object.freeze(clone(row)))),
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
    'metric_slots',
    'observations',
    'exclusions',
    'shared_rows',
    'source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
    'unresolved',
    'failed',
    'duplicates',
  ], 'candidate release counts');
  requireExactKeys(manifest.roots, [
    'observation_root',
    'exclusion_root',
    'shared_row_root',
    'source_specific_row_root',
    'source_specific_serving_projection_root',
    'exact_detail_root',
    'query_projection_root',
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
    'market_observations',
    'market_exclusions',
    'shared_rows',
    'reviewed_source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
  ], 'candidate release bundle');
  if (release.schema_version !== 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V1') {
    throw new TypeError('candidate release bundle schema is invalid');
  }
  validateCandidateReleaseManifest(release.manifest);
  for (const key of [
    'market_observations',
    'market_exclusions',
    'shared_rows',
    'reviewed_source_specific_rows',
    'source_specific_serving_records',
    'exact_detail_packages',
    'query_records',
  ]) {
    if (!Array.isArray(release[key])) throw new TypeError(`candidate release ${key} must be an array`);
  }
  const manifest = release.manifest;
  const countChecks = {
    observations: release.market_observations.length,
    exclusions: release.market_exclusions.length,
    shared_rows: release.shared_rows.length,
    source_specific_rows: release.reviewed_source_specific_rows.length,
    source_specific_serving_records: release.source_specific_serving_records.length,
    exact_detail_packages: release.exact_detail_packages.length,
    query_records: release.query_records.length,
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
  const expectedDealKeys = [...new Set([
    ...release.market_observations.map((row) => row.deal_key),
    ...release.market_exclusions.map((row) => row.deal_key),
    ...release.reviewed_source_specific_rows.map((row) => row.governed_deal_key),
  ])].sort();
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
  MAX_RELEASE_MEMBERS,
  buildFixtureCandidateRelease,
  buildInitialActiveReleasePointer,
  planActiveReleasePointerSwap,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
};
