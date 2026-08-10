'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FEATURE_KEY,
  NoOtherRepsFraudReviewProjectionError,
  OBSERVED_CLAIMS,
  projectNoOtherRepsFraudReviewSurfaces,
} = require('../lib/canonical-v2/no-other-reps-fraud-review-projection');

function entry(definitionKey, { side = 'TARGET', suffix = definitionKey.toLowerCase(), claim = {} } = {}) {
  const provisionId = `provision-${suffix}`;
  const quote = `Exact ${definitionKey} evidence.`;
  const conceptKey = OBSERVED_CLAIMS[definitionKey]?.conceptBySide[side] || 'REP-T-INDEPINVEST';
  const party = {
    role: 'REPRESENTATION_MAKER',
    value: side === 'TARGET' ? 'Company' : 'Parent',
    capacity: side,
  };
  return {
    resolved_claim_definition_key: definitionKey,
    concept_key: conceptKey,
    section_reference: 'Section 4.20',
    party,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
      party,
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
      attributes: { representation_side: side },
      ...claim,
    },
  };
}

function projectionError(code) {
  return (error) => error instanceof NoOtherRepsFraudReviewProjectionError
    && error.code === code;
}

test('observed no-other-reps claims project to atomic exact-evidence cards', () => {
  const entries = Object.keys(OBSERVED_CLAIMS).flatMap((definitionKey) => [
    entry(definitionKey, { side: 'TARGET', suffix: `${definitionKey}-target` }),
    entry(definitionKey, { side: 'BUYER', suffix: `${definitionKey}-buyer` }),
  ]);
  const projection = projectNoOtherRepsFraudReviewSurfaces({
    deal_id: 'deal:no-other-reps',
    resolution: { resolved: entries },
  });

  assert.equal(projection.cards.length, entries.length);
  for (const source of entries) {
    const claimId = source.claim.claim_revision_id;
    const card = projection.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(claimId),
    );
    assert.ok(card, claimId);
    assert.equal(card.authority_state, 'VALIDATED_NOT_SERVED');
    assert.equal(card.primary_quote, source.claim.raw_value);
    assert.equal(card.features[FEATURE_KEY], source.claim.raw_value);
    assert.equal(card.concept_key, source.concept_key);
    assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids[FEATURE_KEY], [claimId]);
  }
});

test('review projection fails closed for an unobserved claim definition', () => {
  assert.throws(
    () => projectNoOtherRepsFraudReviewSurfaces({
      deal_id: 'deal:unobserved',
      resolution: { resolved: [entry('INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_PRESENT')] },
    }),
    projectionError('UNOBSERVED_NO_OTHER_REPS_FRAUD_CLAIM'),
  );
});

test('review projection rejects wrong side ownership and broken provision lineage', () => {
  const wrongConcept = entry('NON_RELIANCE_ACKNOWLEDGMENT_PRESENT');
  wrongConcept.concept_key = 'REP-B-NONRELIANCE';
  assert.throws(
    () => projectNoOtherRepsFraudReviewSurfaces({
      deal_id: 'deal:wrong-side', resolution: { resolved: [wrongConcept] },
    }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );

  const brokenLineage = entry('NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT');
  brokenLineage.claim.subject_occurrence_id = 'other-provision';
  assert.throws(
    () => projectNoOtherRepsFraudReviewSurfaces({
      deal_id: 'deal:broken-lineage', resolution: { resolved: [brokenLineage] },
    }),
    projectionError('INVALID_PROVISION_BINDING'),
  );
});

test('review projection rejects a claim bound to the wrong representation party', () => {
  const wrongProvisionParty = entry('NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT');
  wrongProvisionParty.provision_instance.party = {
    role: 'REPRESENTATION_MAKER', value: 'Parent', capacity: 'BUYER',
  };
  assert.throws(
    () => projectNoOtherRepsFraudReviewSurfaces({
      deal_id: 'deal:wrong-provision-party', resolution: { resolved: [wrongProvisionParty] },
    }),
    projectionError('INVALID_INHERITED_PARTY'),
  );

  const wrongEntrySide = entry('NON_RELIANCE_ACKNOWLEDGMENT_PRESENT', { side: 'BUYER' });
  wrongEntrySide.party = {
    role: 'REPRESENTATION_MAKER', value: 'Company', capacity: 'TARGET',
  };
  assert.throws(
    () => projectNoOtherRepsFraudReviewSurfaces({
      deal_id: 'deal:wrong-entry-party', resolution: { resolved: [wrongEntrySide] },
    }),
    projectionError('INVALID_INHERITED_PARTY'),
  );
});
