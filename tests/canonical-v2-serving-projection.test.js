const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('../lib/canonical-v2/claims-relationships');
const {
  compileFixtureContract,
  compileFixtureContractV4,
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  assertMetricSlotPartition,
  buildFixtureResultComponent,
  projectMarketMetricSlot,
} = require('../lib/canonical-v2/serving-projection');
const { buildCanonicalResultServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { buildImmutableSource, buildSemanticSpan } = require('../lib/canonical-v2/source-structure');

const contractBundle = compileFixtureContract();
const id = (domain, value) => contentId(`${domain}/V1`, value);

function evidence(value, start = 0, end = 10) {
  return {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: id('EXCERPT', value),
    document_ordinal: 0,
    absolute_start: start,
    absolute_end: end,
  };
}

function completeInput(overrides = {}) {
  const subjectOccurrenceId = id('CONDITION_TIER_OCCURRENCE', 'complete-tier');
  const claimEvidence = evidence('complete-claim');
  const relationshipEvidence = evidence('complete-relationship', 11, 20);
  const claim = buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: 'in all material respects',
    canonical_value: 'MAT_ALL_MATERIAL',
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_MATERIAL' },
    codebooks: { accuracy_standard: ['MAT_ALL_MATERIAL'] },
    evidence: [claimEvidence],
    scope: {
      scope_closure_id: id('CLAIM_SCOPE_CLOSURE', 'complete-tier'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [claimEvidence.excerpt_id],
      examined_interval_ids: [claimEvidence.excerpt_id],
    },
  });
  const relationship = buildRelationshipRevision({
    source_occurrence_id: subjectOccurrenceId,
    relationship_definition_key: 'BRINGS_DOWN',
    state: 'PRESENT',
    target_occurrence_ids: [id('PROVISION_INSTANCE', 'capitalisation-representation')],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_CLOSING',
      accuracy_standard: 'MAT_ALL_MATERIAL',
    },
    evidence: [relationshipEvidence],
  });
  const deal = {
    deal_key: 'deal:qxo',
    deal_admission_id: id('DEAL_ADMISSION', 'qxo'),
    dimensions: {
      sector: 'Industrials',
      buyer: 'QXO',
      merger_form: 'Reverse triangular merger',
      adviser_firms: ['Paul Weiss', 'Wachtell'],
      lawyers: ['Ben Goodchild', 'Partner Two'],
      announce_year: 2025,
      deal_value_usd: '5000000000',
    },
  };
  const party = { role: 'CONDITION_BENEFICIARY', value: 'BUYER', capacity: 'ACQUIRER' };
  const result = buildFixtureResultComponent({
    deal_admission_id: deal.deal_admission_id,
    result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    result_version: 1,
    concept_key: 'COND-B-REP',
    party,
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
    claim,
    relationships: [relationship],
    composition_scope_closure_id: id('COMPOSITION_SCOPE_CLOSURE', 'qxo-tier-a'),
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  return {
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: id('CORPUS_RELEASE', 'candidate-a'),
    deal,
    concept_key: 'COND-B-REP',
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    party,
    result,
    claim,
    relationships: [relationship],
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
    ...overrides,
  };
}

function moneyInput({
  contract = compileFixtureContractV5(),
  denominatorPrecision,
  compatibilityPrecision = denominatorPrecision,
} = {}) {
  const base = completeInput();
  const sourceEvidence = base.claim.evidence[0];
  const denominator = {
    value: '5000000000',
    currency: 'USD',
    basis: 'HEADLINE_TRANSACTION_VALUE',
    source_lineage_ids: [sourceEvidence.excerpt_id],
  };
  if (denominatorPrecision !== undefined) denominator.precision = denominatorPrecision;
  const attributes = {
    basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
  };
  if (compatibilityPrecision !== undefined) {
    attributes.denominator_precision = compatibilityPrecision;
  }
  const claim = buildClaimRevision({
    subject_occurrence_id: base.claim.subject_occurrence_id,
    claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$100 million',
    canonical_value: '2',
    unit: 'PERCENT_OF_DEAL_VALUE',
    denominator,
    attributes,
    allowed_attributes: ['basis_key', 'denominator_precision'],
    evidence: [{
      evidence_role: sourceEvidence.evidence_role,
      excerpt_id: sourceEvidence.excerpt_id,
      document_ordinal: sourceEvidence.document_ordinal,
      absolute_start: sourceEvidence.absolute_start,
      absolute_end: sourceEvidence.absolute_end,
    }],
  });
  const party = { role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' };
  const result = buildFixtureResultComponent({
    deal_admission_id: base.deal.deal_admission_id,
    result_key: 'TARGET_CAPEX_THRESHOLD',
    result_version: 1,
    concept_key: 'IOC-CAPEX',
    party,
    value_slot_key: 'CAPEX_THRESHOLD',
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: id('COMPOSITION_SCOPE_CLOSURE', 'qxo-capex-threshold'),
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  return {
    ...base,
    contract_bundle: contract,
    concept_key: 'IOC-CAPEX',
    metric_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    party,
    result,
    claim,
    relationships: [],
    value_slot_key: 'CAPEX_THRESHOLD',
  };
}

test('a complete relationship-owned result becomes one release-keyed market observation', () => {
  const output = projectMarketMetricSlot(completeInput());

  assert.equal(output.exclusion, null);
  assert.equal(output.observation.canonical_value, 'MAT_ALL_MATERIAL');
  assert.equal(output.observation.owner_type, 'RESULT_COMPONENT_OCCURRENCE');
  assert.equal(output.observation.result_completeness, 'COMPLETE');
  assert.equal(output.observation.market_comparability, 'COMPARABLE');
  assert.equal(output.observation.relationship_revision_ids.length, 1);
  assert.equal(output.observation.relationship_effect_digests.length, 1);
  assert.deepEqual(output.observation.adviser_firms, ['Paul Weiss', 'Wachtell']);
  assertMetricSlotPartition([output]);
});

test('observation occurrence identity is stable across revisions and serving identity is isolated by release', () => {
  const first = projectMarketMetricSlot(completeInput());
  const changedRevisionInput = completeInput();
  changedRevisionInput.result = buildFixtureResultComponent({
    deal_admission_id: changedRevisionInput.deal.deal_admission_id,
    result_key: changedRevisionInput.result.result_key,
    result_version: changedRevisionInput.result.result_version,
    concept_key: changedRevisionInput.concept_key,
    party: changedRevisionInput.party,
    value_slot_key: changedRevisionInput.value_slot_key,
    ordinal: changedRevisionInput.ordinal,
    claim: changedRevisionInput.claim,
    relationships: changedRevisionInput.relationships,
    composition_scope_closure_id: id('COMPOSITION_SCOPE_CLOSURE', 'qxo-tier-a-v2'),
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const changedRevision = projectMarketMetricSlot(changedRevisionInput);
  const otherRelease = projectMarketMetricSlot(completeInput({
    corpus_release_id: id('CORPUS_RELEASE', 'candidate-b'),
  }));

  assert.equal(
    first.observation.metric_observation_occurrence_id,
    changedRevision.observation.metric_observation_occurrence_id,
  );
  assert.equal(
    first.observation.market_observation_serving_key,
    changedRevision.observation.market_observation_serving_key,
  );
  assert.notEqual(first.observation.canonical_payload_digest, changedRevision.observation.canonical_payload_digest);
  assert.equal(
    first.observation.metric_observation_occurrence_id,
    otherRelease.observation.metric_observation_occurrence_id,
  );
  assert.notEqual(
    first.observation.market_observation_serving_key,
    otherRelease.observation.market_observation_serving_key,
  );
});

test('the exact QXO Section 5.2 tier is excluded while its Section 3.1 relationship is not examined', () => {
  const fixtureDir = path.join(__dirname, 'fixtures', 'canonical-v2');
  const sourceText = fs.readFileSync(path.join(fixtureDir, 'foundation-source.txt'), 'utf8').replace(/\n$/, '');
  const reviewed = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'foundation-reviewed-payload.json'), 'utf8'));
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'QXO_5_2_FOUNDATION' });
  const tier = reviewed.tiers[0];
  const tierSpan = buildSemanticSpan(source, tier.span[0], tier.span[1]);
  const subjectOccurrenceId = id('CONDITION_TIER_OCCURRENCE', {
    document_hash: source.document_hash,
    span_id: tierSpan.semantic_span_id,
    tier_key: tier.key,
  });
  const sourceEvidence = {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: tierSpan.semantic_span_id,
    document_ordinal: 0,
    absolute_start: tierSpan.absolute_start,
    absolute_end: tierSpan.absolute_end,
  };
  const claim = buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: sourceText.slice(tierSpan.absolute_start, tierSpan.absolute_end),
    canonical_value: tier.standard,
    taxonomy_codes: { accuracy_standard: tier.standard },
    codebooks: { accuracy_standard: reviewed.tiers.map((item) => item.standard) },
    evidence: [sourceEvidence],
    scope: {
      scope_closure_id: id('CLAIM_SCOPE_CLOSURE', subjectOccurrenceId),
      coverage_status: 'COMPLETE',
      required_interval_ids: [tierSpan.semantic_span_id],
      examined_interval_ids: [tierSpan.semantic_span_id],
    },
  });
  const relationship = buildRelationshipRevision({
    source_occurrence_id: subjectOccurrenceId,
    relationship_definition_key: 'BRINGS_DOWN',
    state: 'NOT_EXAMINED',
    raw_scope: tier.raw_scope,
    not_examined: {
      reason: 'REFERENCED_SOURCE_NOT_IN_FIXTURE',
      intended_scope: tier.raw_scope,
      missing_source_section: '3.1',
    },
    evidence: [sourceEvidence],
  });
  const base = completeInput();
  const result = buildFixtureResultComponent({
    deal_admission_id: base.deal.deal_admission_id,
    result_key: base.result.result_key,
    result_version: base.result.result_version,
    concept_key: base.concept_key,
    party: base.party,
    value_slot_key: base.value_slot_key,
    ordinal: base.ordinal,
    claim,
    relationships: [relationship],
    composition_scope_closure_id: id('COMPOSITION_SCOPE_CLOSURE', 'qxo-reviewed-tier-a'),
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  const output = projectMarketMetricSlot({
    ...base,
    claim,
    relationships: [relationship],
    result,
  });

  assert.equal(output.observation, null);
  assert.equal(output.exclusion.exclusion_reason, 'OWNER_RELATIONSHIP_NOT_EXAMINED');
  assert.equal(output.exclusion.examination_state, 'NOT_EXAMINED');
  assert.equal(output.exclusion.cohort_membership, 'NO_COHORT_MEMBERSHIP');
  assert.equal(output.exclusion.aggregate_authority, 'NO_AGGREGATE_AUTHORITY');
  assert.equal(output.exclusion.unresolved_basis.missing_source_section, '3.1');
  assertMetricSlotPartition([output]);
  assert.throws(() => buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: id('FROZEN_PAIR', 'fixture'),
    projection_output: output,
  }), /only a comparable market observation/);
});

test('unrecognised values and malformed dimensions cannot become plausible market observations', () => {
  const invalidValue = completeInput();
  const priorEvidence = invalidValue.claim.evidence[0];
  invalidValue.claim = buildClaimRevision({
    subject_occurrence_id: invalidValue.claim.subject_occurrence_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: 'nearest plausible tier',
    canonical_value: 'NEAREST_PLAUSIBLE_TIER',
    taxonomy_codes: { accuracy_standard: 'NEAREST_PLAUSIBLE_TIER' },
    codebooks: { accuracy_standard: ['NEAREST_PLAUSIBLE_TIER'] },
    evidence: [{
      evidence_role: priorEvidence.evidence_role,
      excerpt_id: priorEvidence.excerpt_id,
      document_ordinal: priorEvidence.document_ordinal,
      absolute_start: priorEvidence.absolute_start,
      absolute_end: priorEvidence.absolute_end,
    }],
    scope: invalidValue.claim.scope,
  });
  invalidValue.result = buildFixtureResultComponent({
    deal_admission_id: invalidValue.deal.deal_admission_id,
    result_key: invalidValue.result.result_key,
    result_version: invalidValue.result.result_version,
    concept_key: invalidValue.concept_key,
    party: invalidValue.party,
    value_slot_key: invalidValue.value_slot_key,
    ordinal: invalidValue.ordinal,
    claim: invalidValue.claim,
    relationships: invalidValue.relationships,
    composition_scope_closure_id: invalidValue.result.composition_scope_closure_id,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const excluded = projectMarketMetricSlot(invalidValue);
  assert.equal(excluded.observation, null);
  assert.equal(excluded.exclusion.exclusion_reason, 'VALUE_OUTSIDE_METRIC_CONTRACT');

  const invalidDimensions = completeInput();
  invalidDimensions.deal.dimensions = { ...invalidDimensions.deal.dimensions, law_firm_guess: 'Unknown' };
  assert.throws(() => projectMarketMetricSlot(invalidDimensions), /unsupported serving dimension/);

  const forgedResult = completeInput();
  forgedResult.result = { ...forgedResult.result, component_revision_id: id('RESULT_COMPONENT_REVISION', 'forged') };
  assert.throws(() => projectMarketMetricSlot(forgedResult), /result component identity or input lineage/);
});

test('F5 money projection accepts exact and approximate precision but excludes missing, invalid or mismatched precision', () => {
  for (const precision of ['EXACT', 'APPROXIMATE']) {
    const output = projectMarketMetricSlot(moneyInput({
      denominatorPrecision: precision,
    }));
    assert.equal(output.exclusion, null);
    assert.equal(output.observation.denominator.precision, precision);
    assert.equal(output.observation.claim_attributes.denominator_precision, precision);
  }

  for (const invalidCase of [
    {},
    { denominatorPrecision: 'ESTIMATED' },
    { denominatorPrecision: 'EXACT', compatibilityPrecision: 'APPROXIMATE' },
  ]) {
    const output = projectMarketMetricSlot(moneyInput(invalidCase));
    assert.equal(output.observation, null);
    assert.equal(output.exclusion.exclusion_reason, 'VALUE_OUTSIDE_METRIC_CONTRACT');
  }
});

test('F4 money projection preserves its historical denominator shape without inventing precision', () => {
  const output = projectMarketMetricSlot(moneyInput({
    contract: compileFixtureContractV4(),
  }));
  assert.equal(output.exclusion, null);
  assert.equal(output.observation.denominator.precision, undefined);
  assert.equal(output.observation.claim_attributes.denominator_precision, undefined);
});

test('the metric-slot partition rejects duplicates and missing terminal outputs', () => {
  const output = projectMarketMetricSlot(completeInput());
  assert.throws(() => assertMetricSlotPartition([output, output]), /duplicate market metric slot/);
  assert.throws(() => assertMetricSlotPartition([{
    metric_slot_key: id('MARKET_METRIC_SLOT', 'missing-output'),
    observation: null,
    exclusion: null,
  }]), /exactly one observation or exclusion/);
});
