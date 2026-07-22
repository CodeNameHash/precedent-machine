const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildFixtureCandidateInputAuthority } = require('../__fixtures__/canonical-v2/candidate-input-authority');
const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
  validateCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const { buildClaimRevision } = require('../lib/canonical-v2/claims-relationships');
const {
  buildFixtureResultCompositionDetailPackage,
} = require('../lib/canonical-v2/composition-exact-detail');
const {
  buildFixtureResultComponent,
  projectMarketMetricSlot,
} = require('../lib/canonical-v2/serving-projection');
const {
  buildIncompleteCanonicalResultServingRow,
} = require('../lib/canonical-v2/shared-serving-row');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildIncompleteFixture() {
  const base = buildLandosMaterialContractsServingFixture({
    corpusReleaseId: contentId('CORPUS_RELEASE/V1', 'incomplete-canonical-release-fixture'),
  });
  const original = base.thresholdClaim;
  const operativeEvidence = original.evidence[0];
  const attributes = {
    ...original.attributes,
    measurement_period_code: null,
  };
  const claim = buildClaimRevision({
    subject_occurrence_id: original.subject_occurrence_id,
    claim_definition_key: original.claim_definition_key,
    state: original.state,
    raw_value: original.raw_value,
    canonical_value: original.canonical_value,
    unit: original.unit,
    denominator: original.denominator,
    attributes,
    allowed_attributes: Object.keys(attributes),
    evidence: [{
      evidence_role: operativeEvidence.evidence_role,
      excerpt_id: operativeEvidence.excerpt_id,
      document_ordinal: operativeEvidence.document_ordinal,
      absolute_start: operativeEvidence.absolute_start,
      absolute_end: operativeEvidence.absolute_end,
    }],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', [operativeEvidence.excerpt_id]),
      coverage_status: 'COMPLETE',
      required_interval_ids: [operativeEvidence.excerpt_id],
      examined_interval_ids: [operativeEvidence.excerpt_id],
    },
    extraction_version: original.extraction_version,
    normalisation_version: original.normalisation_version,
    derivation_version: original.derivation_version,
  });
  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: claim.claim_revision_id,
    relationship_revision_ids: [],
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: base.canonicalWriteSet.deal.deal_admission_id,
    result_key: 'TARGET_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD',
    result_version: 1,
    concept_key: 'REP-T-CONTRACTS',
    party: base.provision.party,
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: compositionScopeClosureId,
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  const projection = projectMarketMetricSlot({
    contract_bundle: base.contract,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: base.projection.observation.corpus_release_id,
    deal: base.canonicalWriteSet.deal,
    concept_key: 'REP-T-CONTRACTS',
    metric_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    party: base.provision.party,
    result,
    claim,
    relationships: [],
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
  });
  const intersectingCandidate = {
    open_world_candidate_occurrence_id: contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', 'unmapped-period'),
    final_disposition_id: contentId('OPEN_WORLD_FINAL_DISPOSITION/V1', 'reviewed-source-specific-period'),
    semantic_impact_closure_id: contentId('SEMANTIC_IMPACT_CLOSURE/V1', 'material-contract-period'),
    impact_value: 'AFFECTS_CANONICAL_RESULT',
  };
  const baseRow = buildIncompleteCanonicalResultServingRow({
    contract_bundle: base.contract,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', 'incomplete-material-contract-period'),
    projection_output: projection,
    result,
    claim,
    relationships: [],
    governed_reason_codes: ['UNMAPPED_MEASUREMENT_PERIOD'],
    intersecting_candidates: [intersectingCandidate],
  });
  const components = [{ component: result, claim, relationships: [] }];
  const exactDetail = buildFixtureResultCompositionDetailPackage({
    contract_bundle: base.contract,
    row: baseRow,
    source: base.agreementSource,
    source_admission: base.agreementAdmission,
    components,
    relationship_targets: [],
    excerpts: [base.excerpts.criterion],
  });
  const member = {
    projection_output: projection,
    shared_row: exactDetail.row,
    exact_detail: {
      package: exactDetail,
      source: base.agreementSource,
      source_admission: base.agreementAdmission,
      components,
      relationship_targets: [],
      excerpts: [base.excerpts.criterion],
    },
  };
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'incomplete-canonical-release-fixture');
  const release = buildFixtureCandidateRelease({
    contract_bundle: base.contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: base.projection.observation.corpus_release_id,
    members: [member],
    correction_authority_selection: buildFixtureCandidateInputAuthority({
      contractBundle: base.contract,
    }),
    deal_directory_entries: [{
      application_deal_id: 'c34415ed-44f7-432f-8d7c-6464b0310239',
      governed_deal_key: base.canonicalWriteSet.deal.deal_key,
    }],
  });
  return { base, claim, result, projection, member, release };
}

test('an incomplete canonical result is certified as exact deal context and an explicit metric exclusion', () => {
  const first = buildIncompleteFixture();
  const second = buildIncompleteFixture();
  const { release } = first;

  assert.deepEqual(first.release, second.release);
  assert.equal(validateCandidateReleaseManifest(release.manifest), true);
  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.equal(release.schema_version, 'FIXTURE_CANDIDATE_RELEASE_BUNDLE/V2');
  assert.equal(release.manifest.schema_version, 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2');
  assert.deepEqual({
    observations: release.manifest.counts.observations,
    exclusions: release.manifest.counts.exclusions,
    shared_rows: release.manifest.counts.shared_rows,
    incomplete_canonical_rows: release.manifest.counts.incomplete_canonical_rows,
    source_specific_rows: release.manifest.counts.source_specific_rows,
    query_records: release.manifest.counts.query_records,
    exact_detail_packages: release.manifest.counts.exact_detail_packages,
  }, {
    observations: 0,
    exclusions: 1,
    shared_rows: 1,
    incomplete_canonical_rows: 1,
    source_specific_rows: 0,
    query_records: 0,
    exact_detail_packages: 1,
  });
  assert.match(release.manifest.roots.incomplete_canonical_row_root, /^[a-f0-9]{64}$/);
  assert.equal(release.market_observations.length, 0);
  assert.equal(release.query_records.length, 0);
  assert.equal(release.source_specific_serving_records.length, 0);
  assert.equal(release.market_exclusions[0].exclusion_reason, 'RESULT_INCOMPLETE');
  assert.equal(release.market_exclusions[0].cohort_membership, 'NO_COHORT_MEMBERSHIP');
  assert.equal(release.incomplete_canonical_rows[0].row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(
    release.incomplete_canonical_rows[0].incomplete_canonical_result.result_completeness,
    'INCOMPLETE_NOVEL_SEMANTIC',
  );
  assert.equal(
    release.incomplete_canonical_rows[0].incomplete_canonical_result.source_detail_state.state,
    'AVAILABLE',
  );
  assert.equal(
    release.deal_directory_records[0].governed_deal_key,
    release.incomplete_canonical_rows[0].governed_deal_key,
  );
  assert.equal(
    canonicalJson(release.exact_detail_packages[0].row),
    canonicalJson(release.incomplete_canonical_rows[0]),
  );
});

test('release validation fails closed if an incomplete row gains market or source-specific authority', () => {
  const { release } = buildIncompleteFixture();

  const missingDetail = clone(release);
  missingDetail.exact_detail_packages = [];
  assert.throws(() => validateCandidateReleaseBundle(missingDetail), /count does not match|exact-detail/i);

  const queryLeak = clone(release);
  queryLeak.query_records.push({
    row_serving_key: release.incomplete_canonical_rows[0].row_serving_key,
  });
  assert.throws(() => validateCandidateReleaseBundle(queryLeak), /count does not match|query/i);

  const sourceSpecificLeak = clone(release);
  sourceSpecificLeak.source_specific_serving_records.push({
    row_serving_key: release.incomplete_canonical_rows[0].row_serving_key,
  });
  assert.throws(() => validateCandidateReleaseBundle(sourceSpecificLeak), /count does not match|source-specific/i);

  const missingExclusion = clone(release);
  missingExclusion.market_exclusions = [];
  assert.throws(() => validateCandidateReleaseBundle(missingExclusion), /count does not match|exclusion/i);

  const rootDrift = clone(release);
  rootDrift.manifest.roots.incomplete_canonical_row_root = '0'.repeat(64);
  assert.throws(
    () => validateCandidateReleaseBundle(rootDrift),
    /identity mismatch|certified roots|complete certified release/i,
  );
});

test('import persists the incomplete result as a shared review row without a market query record', () => {
  const { release } = buildIncompleteFixture();
  const plan = buildCandidateReleaseImportPlan({ release });

  assert.equal(validateCandidateReleaseImportPlan(plan), true);
  assert.equal(plan.schema_version, 'CANDIDATE_RELEASE_IMPORT_PLAN/V5');
  assert.deepEqual({
    market_observations: plan.expected_counts.market_observations,
    market_exclusions: plan.expected_counts.market_exclusions,
    query_records: plan.expected_counts.query_records,
    incomplete_canonical_records: plan.expected_counts.incomplete_canonical_records,
    source_specific_records: plan.expected_counts.source_specific_records,
  }, {
    market_observations: 0,
    market_exclusions: 1,
    query_records: 0,
    incomplete_canonical_records: 1,
    source_specific_records: 0,
  });
  const record = plan.incomplete_canonical_records[0];
  assert.equal(record.canonical_payload.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(record.canonical_numeric_value, null);
  assert.equal(record.measurement_period_code, null);
  assert.equal(plan.query_records.length, 0);
  assert.equal(plan.source_specific_records.length, 0);

  const cohortLeak = clone(plan);
  cohortLeak.incomplete_canonical_records[0]
    .canonical_payload.incomplete_canonical_result.metric_exclusion.cohort_membership = 'INCLUDED';
  assert.throws(
    () => validateCandidateReleaseImportPlan(cohortLeak),
    /identity mismatch|cohort|SharedServingRow|payload digest/i,
  );
});

test('the staging projection stores incomplete rows for review but excludes them from Query cohorts', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');

  assert.match(sql, /INSERT INTO canonical_v2_staging\.shared_serving_rows[\s\S]*incomplete_canonical_records/);
  assert.match(sql, /canonical_v2_query_page[\s\S]*canonical_payload->>'row_kind' = 'CANONICAL_RESULT'/);
  assert.match(sql, /canonical_v2_active_review_context[\s\S]*FROM canonical_v2_staging\.shared_serving_rows/);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*incomplete_canonical/i);
  assert.match(sql, /NO_COHORT_MEMBERSHIP/);
});
