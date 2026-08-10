'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FEATURE_BY_ASSERTION_KIND,
  MergerStructureClosingProductProjectionError,
  NATIVE_SOURCE,
  projectMergerStructureClosingProductSurfaces,
} = require('../lib/canonical-v2/merger-structure-closing-product-projection');

function entry({
  assertionKind = 'EFFECTIVE_TIME',
  definitionKey = 'MERGER_STRUCTURE_MECHANIC_PRESENT',
  suffix = assertionKind.toLowerCase(),
  attributes = {},
  claim = {},
} = {}) {
  const provisionId = `provision-${suffix}`;
  const quote = definitionKey === 'MERGER_TRANSACTION_STEP'
    ? 'Merger Sub shall merge with and into the Company, with the Company surviving.'
    : `Exact ${assertionKind} provision text.`;
  return {
    resolved_claim_definition_key: definitionKey,
    concept_key: 'MERGER-STRUCTURE',
    section_reference: 'Section 2.1',
    provision_instance: {
      schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
    },
    claim: {
      schema_version: 'CLAIM_REVISION/V1',
      claim_revision_id: `claim-${suffix}`,
      subject_occurrence_id: provisionId,
      claim_definition_key: definitionKey,
      state: 'PRESENT',
      canonical_value: true,
      raw_value: quote,
      evidence: [{ excerpt_id: `excerpt-${suffix}` }],
      attributes: definitionKey === 'MERGER_TRANSACTION_STEP'
        ? {
          step_order: 1,
          step_kind: 'MERGER',
          disappearing_entity: 'Merger Sub',
          surviving_entity: 'Company',
          parent_entity: 'Parent',
          concurrency: 'SEQUENTIAL',
          ...attributes,
        }
        : { assertion_kind: assertionKind, ...attributes },
      ...claim,
    },
  };
}

function projectionError(code) {
  return (error) => error instanceof MergerStructureClosingProductProjectionError
    && error.code === code;
}

test('observed structure assertions project to exact Review V2 features with one-claim lineage', () => {
  const entries = Object.keys(FEATURE_BY_ASSERTION_KIND).map((assertionKind) => entry({ assertionKind }));
  const projection = projectMergerStructureClosingProductSurfaces({
    deal_id: 'deal:structure',
    resolution: { resolved: entries },
  });

  assert.equal(projection.source, NATIVE_SOURCE);
  assert.equal(projection.cards.length, entries.length);
  for (const source of entries) {
    const claimId = source.claim.claim_revision_id;
    const featureKey = FEATURE_BY_ASSERTION_KIND[source.claim.attributes.assertion_kind];
    const card = projection.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(claimId),
    );
    assert.ok(card, claimId);
    assert.equal(card.features[featureKey], source.claim.raw_value);
    assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids[featureKey], [claimId]);
    assert.equal(card.primary_quote, source.claim.raw_value);
  }
});

test('transaction steps keep governed attributes and exact claim lineage', () => {
  const source = entry({ definitionKey: 'MERGER_TRANSACTION_STEP', suffix: 'step' });
  const projection = projectMergerStructureClosingProductSurfaces({
    deal_id: 'deal:step',
    resolution: { resolved: [source] },
  });
  const card = projection.cards[0];
  assert.deepEqual(card.features.transactionSteps, [{
    step_order: 1,
    step_kind: 'MERGER',
    disappearing_entity: 'Merger Sub',
    surviving_entity: 'Company',
    parent_entity: 'Parent',
    concurrency: 'SEQUENTIAL',
  }]);
  assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids.transactionSteps, ['claim-step']);
  assert.equal(card.primary_quote, source.claim.raw_value);
});

test('projection fails closed for an unobserved assertion kind instead of assigning legal meaning', () => {
  assert.throws(
    () => projectMergerStructureClosingProductSurfaces({
      deal_id: 'deal:unmapped',
      resolution: { resolved: [entry({ assertionKind: 'TOP_UP' })] },
    }),
    projectionError('UNMAPPED_STRUCTURE_ASSERTION'),
  );
});

test('projection rejects wrong ownership and broken provision lineage', () => {
  const wrongConcept = entry();
  wrongConcept.concept_key = 'CONS-CASH';
  assert.throws(
    () => projectMergerStructureClosingProductSurfaces({
      deal_id: 'deal:wrong-concept', resolution: { resolved: [wrongConcept] },
    }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );

  const brokenLineage = entry();
  brokenLineage.claim.subject_occurrence_id = 'other-provision';
  assert.throws(
    () => projectMergerStructureClosingProductSurfaces({
      deal_id: 'deal:broken-lineage', resolution: { resolved: [brokenLineage] },
    }),
    projectionError('INVALID_PROVISION_BINDING'),
  );
});
