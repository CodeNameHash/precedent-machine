'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { projectRepresentationClaims } = require('../lib/canonical-v2/representations-product-projection');
const {
  bridgeRepresentationRecordsToLegacyShape,
  mergeCanonicalV2CardsIntoReviewDeal,
} = require('../lib/canonical-v2/representations-dark-bridge');

const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'the Company', capacity: 'TARGET' });
const CASES = Object.freeze([
  Object.freeze({
    name: 'materiality',
    definition: 'GENERAL_MATERIALITY_QUALIFIER',
    attribute: 'generalMaterialityQualifier',
    value: true,
    quote: 'in all material respects',
    dispatch: 'THRESHOLD_MATERIALITY',
    attachment: Object.freeze({ position: 'ITEM', governs_path: Object.freeze(['(a)']) }),
    title: 'Organisation',
    subtype: 'REP-T-ORG',
  }),
  Object.freeze({
    name: 'measurement',
    definition: 'REPRESENTATION_MEASUREMENT_DATE',
    attribute: 'representationMeasurementDate',
    value: '2026-04-17',
    quote: 'as of April 17, 2026',
    dispatch: 'TEMPORAL_MEASUREMENT_DATE',
    attachment: Object.freeze({ position: 'CHAPEAU', governs_path: null }),
    title: 'Capitalisation',
    subtype: 'REP-T-CAP',
  }),
  Object.freeze({
    name: 'lookback',
    definition: 'RETROSPECTIVE_LOOKBACK',
    attribute: 'retrospectiveLookback',
    value: true,
    quote: 'since January 1, 2024',
    dispatch: 'TEMPORAL_RETROSPECTIVE_LOOKBACK',
    temporal_form: 'LOOKBACK',
    attachment: Object.freeze({ position: 'TRAILING', governs_path: Object.freeze(['(c)']) }),
    title: 'Compliance with Laws',
    subtype: 'REP-T-LAW',
  }),
]);

function provisionId(item) {
  return sha256Hex(`qualifier-card-provision-${item.name}`);
}

function claimId(item) {
  return sha256Hex(`qualifier-card-claim-${item.name}`);
}

function entry(item) {
  const id = provisionId(item);
  return {
    resolved_claim_definition_key: item.definition,
    concept_key: 'REP-T-QUALIFIER',
    section_reference: `3.${CASES.indexOf(item) + 1}`,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: id,
      party: PARTY,
    },
    claim: {
      state: 'PRESENT',
      claim_definition_key: item.definition,
      claim_revision_id: claimId(item),
      subject_occurrence_id: item.attachment.position === 'CHAPEAU' ? id : sha256Hex(`qualifier-subject-${item.name}`),
      canonical_value: item.value,
      raw_value: item.quote,
      evidence: [{ quote: item.quote }],
      attributes: {
        party_making: PARTY.value,
        representation_side: 'TARGET',
        qualifier_kind: item.definition === 'GENERAL_MATERIALITY_QUALIFIER' ? 'THRESHOLD' : 'TEMPORAL',
        attachment: item.attachment,
        qualifier_dispatch: item.dispatch,
        ...(item.temporal_form ? { temporal_form: item.temporal_form } : {}),
      },
    },
  };
}

function reviewDeal() {
  return {
    dealId: 'qualifier-card-deal',
    cards: CASES.map((item, index) => ({
      id: provisionId(item),
      deal_id: 'qualifier-card-deal',
      provision_instance_id: provisionId(item),
      excerpt_id: `legacy-qualifier:${index}`,
      section_ref: `3.${index + 1}`,
      short_title: item.title,
      type: 'REPRESENTATION',
      provision_type: 'REPRESENTATION',
      provision_subtype: item.subtype,
      primary_quote: item.quote,
      region_full_text: item.quote,
      features: {},
    })),
    claims: [],
    cardCount: CASES.length,
  };
}

test('the three governed qualifier outputs retain exact values, party, attachment, evidence and feature lineage', () => {
  const projection = projectRepresentationClaims({ resolved_entries: CASES.map(entry) });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal(), ENABLED_ENV);

  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(bridge.cards.length, 3);
  for (const item of CASES) {
    const record = projection.records.find((candidate) => candidate.claim_revision_id === claimId(item));
    const card = bridge.cards.find((candidate) => candidate.provision_instance_id === `cv2:${provisionId(item)}`);
    const claim = bridge.claims.find((candidate) => candidate.attribute === item.attribute);
    const expectedFeature = {
      value: item.value,
      text: item.quote,
      party: PARTY,
      attachment: item.attachment,
      qualifier_dispatch: item.dispatch,
      ...(item.temporal_form ? { temporal_form: item.temporal_form } : {}),
    };

    assert.deepEqual(record.query.value.dimensions.representation_party, PARTY);
    assert.deepEqual(record.query.value.dimensions.attachment, item.attachment);
    assert.equal(record.query.value.dimensions.qualifier_dispatch, item.dispatch);
    assert.deepEqual(card.features[item.attribute], expectedFeature);
    assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids[item.attribute], [claimId(item)]);
    assert.deepEqual(claim.canonical, expectedFeature);
    assert.equal(claim.verbatim, item.quote);
    assert.deepEqual(claim.provenance.source_claim_revision_ids, [claimId(item)]);
  }
});

test('the three qualifier outputs use existing dark review rows without entering serving or comparison', async () => {
  const projection = projectRepresentationClaims({ resolved_entries: CASES.map(entry) });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal(), ENABLED_ENV);
  const merged = mergeCanonicalV2CardsIntoReviewDeal(reviewDeal(), bridge, { env: ENABLED_ENV });
  const { representationsQualifiersConfig } = await import('../components/review/table-configs/representations-qualifiers.config.js');

  const rows = representationsQualifiersConfig.selectRows({
    ...merged,
    canonical_v2_preview_enabled: true,
  }).filter((row) => row.marketSkip === true);
  assert.equal(rows.length, 3);

  const materiality = rows.find((row) => row.card.features.generalMaterialityQualifier);
  assert.equal(materiality.materiality.label, 'General materiality qualifier');
  assert.equal(materiality.materiality.evidence, CASES[0].quote);
  assert.deepEqual(materiality.featureKeys, ['generalMaterialityQualifier']);

  const measurement = rows.find((row) => row.card.features.representationMeasurementDate);
  assert.equal(measurement.lookback.label, 'As of Apr 17, 2026');
  assert.equal(measurement.lookback.evidence, CASES[1].quote);
  assert.deepEqual(measurement.featureKeys, ['representationMeasurementDate']);

  const lookback = rows.find((row) => row.card.features.retrospectiveLookback);
  assert.equal(lookback.lookback.label, CASES[2].quote);
  assert.equal(lookback.lookback.evidence, CASES[2].quote);
  assert.deepEqual(lookback.featureKeys, ['retrospectiveLookback']);

  for (const row of rows) {
    assert.equal(row.authorityState, 'VALIDATED_NOT_SERVED');
    assert.equal(row.comparisonState, 'NOT_ADMITTED');
    assert.deepEqual(row.marketProvisionCodes, []);
  }
});
