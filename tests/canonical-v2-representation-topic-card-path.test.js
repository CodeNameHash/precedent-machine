'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { REPRESENTATION_TOPIC_REGISTRY_BINDING_V1 } = require('../lib/canonical-v2/contract-bundle');
const { projectRepresentationClaims } = require('../lib/canonical-v2/representations-product-projection');
const {
  bridgeRepresentationRecordsToLegacyShape,
  mergeCanonicalV2CardsIntoReviewDeal,
} = require('../lib/canonical-v2/representations-dark-bridge');

const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const PROVISION_ID = sha256Hex('joined-topic-provision');
const TOPIC_CLAIM_ID = sha256Hex('joined-topic-claim');
const ACCURACY_CLAIM_ID = sha256Hex('joined-accuracy-claim');
const TOPIC_QUOTE = 'The Company has timely filed all material Tax Returns required to be filed.';
const ACCURACY_QUOTE = 'except where the failure to do so would not be material to the Company';
const FULL_TEXT = `${TOPIC_QUOTE} ${ACCURACY_QUOTE}.`;
const PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'the Company', capacity: 'TARGET' });

function topicEntry() {
  return {
    concept_key: 'REP-T-TOPIC',
    section_reference: '3.12',
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: PROVISION_ID,
      party: PARTY,
    },
    claim: {
      state: 'PRESENT',
      claim_definition_key: 'REPRESENTATION_TOPIC_PRESENT',
      claim_revision_id: TOPIC_CLAIM_ID,
      subject_occurrence_id: PROVISION_ID,
      canonical_value: 'TAX',
      raw_value: TOPIC_QUOTE,
      evidence: [{ quote: TOPIC_QUOTE }],
      attributes: {
        party_making: 'the Company',
        topic_registry_version: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version,
        topic_registry_digest: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest,
      },
    },
  };
}

function accuracyEntry() {
  return {
    concept_key: 'REP-T-TAX',
    section_reference: '3.12',
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: PROVISION_ID,
      party: PARTY,
    },
    claim: {
      state: 'PRESENT',
      claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      claim_revision_id: ACCURACY_CLAIM_ID,
      subject_occurrence_id: PROVISION_ID,
      canonical_value: 'MAT_ALL_MATERIAL',
      raw_value: ACCURACY_QUOTE,
      evidence: [{ quote: ACCURACY_QUOTE }],
      attributes: {
        party_making: 'the Company',
        qualifier_kind: 'ACCURACY',
        attachment: { position: 'CHAPEAU', governs_path: null },
      },
    },
  };
}

function reviewDeal() {
  return {
    dealId: 'joined-topic-deal',
    cards: [{
      id: PROVISION_ID,
      deal_id: 'joined-topic-deal',
      provision_instance_id: PROVISION_ID,
      excerpt_id: 'legacy-tax-representation:0',
      section_ref: '3.12',
      short_title: 'Tax matters',
      type: 'REPRESENTATION',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-TAX',
      primary_quote: FULL_TEXT,
      region_full_text: FULL_TEXT,
      features: {},
    }],
    claims: [],
    cardCount: 1,
  };
}

test('a governed topic joins its exact legacy route and sibling qualifier onto one dark native card', () => {
  const projection = projectRepresentationClaims({
    resolved_entries: [topicEntry(), accuracyEntry()],
  });
  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(projection.records.length, 2);

  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal(), ENABLED_ENV);
  assert.equal(bridge.cards.length, 1);
  assert.equal(bridge.claims.length, 2);
  const [card] = bridge.cards;
  assert.equal(card.provision_subtype, 'REP-T-TAX');
  assert.equal(card.short_title, 'Tax matters');
  assert.deepEqual(card.features.representationTopic, { code: 'TAX', text: TOPIC_QUOTE });
  assert.deepEqual(card.features.materialityQualifier, { code: 'MAT_ALL_MATERIAL', text: ACCURACY_QUOTE });
  assert.deepEqual(card.canonical_v2_lineage.claim_revision_ids, [ACCURACY_CLAIM_ID, TOPIC_CLAIM_ID].sort());
  assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids, {
    materialityQualifier: [ACCURACY_CLAIM_ID],
    representationTopic: [TOPIC_CLAIM_ID],
  });
  const topicClaim = bridge.claims.find((claim) => claim.attribute === 'representationTopic');
  assert.equal(topicClaim.verbatim, TOPIC_QUOTE);
  assert.deepEqual(topicClaim.provenance.source_claim_revision_ids, [TOPIC_CLAIM_ID]);
  assert.equal(topicClaim.authority_state, 'VALIDATED_NOT_SERVED');
});

test('the joined topic card uses the existing reps row and stays hidden unless dark preview is enabled', async () => {
  const projection = projectRepresentationClaims({ resolved_entries: [topicEntry()] });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal(), ENABLED_ENV);
  const merged = mergeCanonicalV2CardsIntoReviewDeal(reviewDeal(), bridge, { env: ENABLED_ENV });
  const { representationsQualifiersConfig } = await import('../components/review/table-configs/representations-qualifiers.config.js');

  const hiddenRows = representationsQualifiersConfig.selectRows(merged).filter((row) => row.kind === 'rep');
  assert.equal(hiddenRows.length, 1);
  assert.equal(hiddenRows.some((row) => row.marketSkip), false);

  const previewRows = representationsQualifiersConfig.selectRows({
    ...merged,
    canonical_v2_preview_enabled: true,
  }).filter((row) => row.kind === 'rep');
  const topicRow = previewRows.find((row) => row.marketSkip === true);
  assert.ok(topicRow);
  assert.equal(topicRow.label, 'Tax matters (Canonical V2 preview)');
  assert.equal(topicRow.materiality, null);
  assert.deepEqual(topicRow.featureKeys, ['representationTopic']);
  assert.equal(topicRow.card.features.representationTopic.code, 'TAX');
  assert.equal(topicRow.card.features.representationTopic.text, TOPIC_QUOTE);
  assert.equal(topicRow.authorityState, 'VALIDATED_NOT_SERVED');
  assert.equal(topicRow.comparisonState, 'NOT_ADMITTED');
});

test('a generic join target cannot become a topic route through an invented legal mapping', () => {
  const projection = projectRepresentationClaims({ resolved_entries: [topicEntry()] });
  const unresolvedRoute = reviewDeal();
  unresolvedRoute.cards[0].provision_subtype = 'REP-T-TOPIC';
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(projection, unresolvedRoute, ENABLED_ENV),
    (error) => error?.code === 'TOPIC_ROUTE_NOT_FOUND',
  );
});
