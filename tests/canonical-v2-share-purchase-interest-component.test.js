const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildSharePurchaseInterestComponent,
  buildSharePurchaseInterestComponentRevision,
  validateSharePurchaseInterestComponent,
  validateSharePurchaseInterestComponentLegBinding,
  validateSharePurchaseInterestComponentRevision,
} = require('../lib/canonical-v2/share-purchase-interest-component');
const {
  buildSourceTransactionLegOccurrence,
  buildSourceTransactionLegRevision,
  buildTransactionLegResolutionOccurrence,
  buildTransactionLegResolutionRevision,
} = require('../lib/canonical-v2/transaction-leg');

const id = (value) => contentId('SHARE_PURCHASE_COMPONENT_TEST/V1', value);

function component(ordinal = 0, overrides = {}) {
  return buildSharePurchaseInterestComponent({
    acquired_entity_endpoint_key: 'ACQUIRED_ENTITY_ENDPOINT',
    buyer_endpoint_key: 'BUYER_ENDPOINT',
    expected_component_slot_key: `SHARE_PURCHASE_COMPONENT_${ordinal}`,
    expected_security_class_slot_key: `PURCHASED_SECURITY_CLASS_${ordinal}`,
    governed_deal_id: id('deal'),
    governed_ordinal: ordinal,
    selling_shareholder_endpoint_key: 'SELLING_SHAREHOLDER_ENDPOINT',
    transaction_leg_resolution_occurrence_id: id('share-purchase-leg'),
    ...overrides,
  });
}

function endpoint(roleCode, entityLabel) {
  return {
    entity_subject_id: id(`entity-${entityLabel}`),
    participant_relationship_revision_id: id(`relationship-${roleCode}-${entityLabel}`),
    role_code: roleCode,
  };
}

function percentageAmount(basisPoints, statedText = `${basisPoints / 100}%`) {
  return {
    percentage_basis_points: basisPoints,
    security_count_text: null,
    stated_kind: 'PERCENTAGE',
    stated_text: statedText,
  };
}

function securityCountAmount(countText) {
  return {
    percentage_basis_points: null,
    security_count_text: countText,
    stated_kind: 'SECURITY_COUNT',
    stated_text: countText,
  };
}

function revision(overrides = {}) {
  return buildSharePurchaseInterestComponentRevision({
    share_purchase_interest_component: component(),
    acquired_entity: endpoint('ACQUIRED_ENTITY', 'acquired'),
    buyer: endpoint('BUYER', 'buyer'),
    consideration: {
      canonical_deal_fact_projection_revision_id: id('consideration'),
      consideration_component_slot_key: 'CASH_CONSIDERATION',
    },
    evidence_edges: [id('share-purchase-evidence')],
    number_or_percentage_purchased: percentageAmount(6500, '65%'),
    ownership_path: 'DIRECT',
    partial_or_full_acquisition_state: 'PARTIAL',
    purchased_security_or_share_class: 'Class A ordinary shares',
    resolver_version: 'share-purchase-component-resolver/v1',
    selling_shareholder: endpoint('SELLING_SHAREHOLDER', 'seller'),
    state: { code: 'PRESENT' },
    ...overrides,
  });
}

function resolvedLeg(resolvedLegType, conflictDisposition = 'CLEAR') {
  const sourceOccurrence = buildSourceTransactionLegOccurrence({
    admitted_source_occurrence_id: id(`source-${resolvedLegType}`),
    expected_source_leg_slot_key: 'SOURCE_TRANSACTION_LEG',
    governed_deal_id: id('deal'),
    governed_repeatable_ordinal: 0,
    leg_definition_and_version: {
      definition_key: 'SOURCE_TRANSACTION_LEG',
      definition_version: 1,
    },
  });
  const participantRefs = [
    {
      deal_participant_relationship_revision_id: id('source-buyer-role'),
      role_code: 'BUYER',
      role_layer: 'TRANSACTION_ROLE',
    },
    {
      deal_participant_relationship_revision_id: id('source-target-role'),
      role_code: 'TARGET',
      role_layer: 'TRANSACTION_ROLE',
    },
  ];
  const sourceRevision = buildSourceTransactionLegRevision({
    source_transaction_leg_occurrence: sourceOccurrence,
    closing_condition: null,
    effective_time_expression: id('source-effective-time'),
    evidence_edges: [id(`source-evidence-${resolvedLegType}`)],
    leg_type: resolvedLegType,
    observed_participant_roles: participantRefs,
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [],
    },
    resolver_version: 'source-leg-resolver/v1',
    source_endpoints: [
      {
        endpoint_slot_key: 'SOURCE_ENDPOINT',
        endpoint_role: 'BUYER',
        entity_subject_id: id('source-entity'),
        source_local_subject_occurrence_id: null,
      },
      {
        endpoint_slot_key: 'TARGET_ENDPOINT',
        endpoint_role: 'TARGET',
        entity_subject_id: id('target-entity'),
        source_local_subject_occurrence_id: null,
      },
    ],
    source_order: 0,
    state: { code: 'PRESENT' },
  });
  const legOccurrence = buildTransactionLegResolutionOccurrence({
    expected_deal_leg_slot_key: 'SHARE_PURCHASE_LEG',
    governed_deal_id: id('deal'),
    governed_repeatable_ordinal: 0,
    leg_definition_and_version: {
      definition_key: 'TRANSACTION_LEG_RESOLUTION',
      definition_version: 1,
    },
  });
  const legRevision = buildTransactionLegResolutionRevision({
    transaction_leg_resolution_occurrence: legOccurrence,
    closing_conditions: [],
    conflict_disposition: conflictDisposition,
    effective_time_expression: id('resolved-effective-time'),
    evidence_edges: [id(`resolved-evidence-${resolvedLegType}`)],
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [],
    },
    resolved_participant_relationships: participantRefs,
    resolved_source_and_target_entities: {
      source_entity_ids: [id('source-entity')],
      target_entity_ids: [id('target-entity')],
    },
    resolver_version: 'transaction-leg-resolver/v1',
    state: { code: 'PRESENT' },
    supporting_source_leg_revisions: [{
      source_transaction_leg_revision_id:
        sourceRevision.source_transaction_leg_revision_id,
      leg_type: sourceRevision.leg_type,
      source_order: sourceRevision.source_order,
    }],
  });
  return { legOccurrence, legRevision };
}

test('a partial share purchase preserves one complete class-specific component', () => {
  const purchaseComponent = component();
  const purchaseRevision = revision({
    share_purchase_interest_component: purchaseComponent,
  });
  assert.equal(purchaseRevision.number_or_percentage_purchased.percentage_basis_points, 6500);
  assert.equal(purchaseRevision.partial_or_full_acquisition_state, 'PARTIAL');
  assert.equal(purchaseRevision.purchased_security_or_share_class, 'Class A ordinary shares');
  assert.equal(purchaseRevision.consideration.consideration_component_slot_key,
    'CASH_CONSIDERATION');
  assert.equal(validateSharePurchaseInterestComponentRevision({
    revision: purchaseRevision,
    share_purchase_interest_component: purchaseComponent,
  }), true);
});

test('full acquisitions accept 100 percent or a stated security count', () => {
  const percentageRevision = revision({
    number_or_percentage_purchased: percentageAmount(10000, '100%'),
    partial_or_full_acquisition_state: 'FULL',
  });
  const countRevision = revision({
    number_or_percentage_purchased: securityCountAmount('12,500,000 shares'),
    partial_or_full_acquisition_state: 'FULL',
  });
  assert.equal(
    percentageRevision.number_or_percentage_purchased.percentage_basis_points,
    10000,
  );
  assert.equal(
    countRevision.number_or_percentage_purchased.security_count_text,
    '12,500,000 shares',
  );
});

test('separate security classes produce separate stable component identities', () => {
  const classA = component(0, {
    expected_security_class_slot_key: 'CLASS_A_SHARES',
  });
  const preferred = component(1, {
    expected_security_class_slot_key: 'SERIES_B_PREFERRED',
  });
  assert.notEqual(
    classA.share_purchase_interest_component_id,
    preferred.share_purchase_interest_component_id,
  );
  assert.throws(() => component(0, {
    purchased_security_or_share_class: 'Class A ordinary shares',
  }), (error) => error.code === 'INVALID_SHARE_PURCHASE_COMPONENT');
});

test('buyer, acquired entity and selling shareholder roles are not interchangeable', () => {
  assert.throws(() => revision({
    buyer: endpoint('SELLING_SHAREHOLDER', 'buyer'),
  }), (error) => error.code === 'SHARE_PURCHASE_ROLE_MISMATCH');
  assert.throws(() => revision({
    acquired_entity: endpoint('TARGET', 'acquired'),
  }), (error) => error.code === 'SHARE_PURCHASE_ROLE_MISMATCH');
  assert.throws(() => revision({
    selling_shareholder: endpoint('BUYER', 'seller'),
  }), (error) => error.code === 'SHARE_PURCHASE_ROLE_MISMATCH');
});

test('one entity can hold two roles, but each role keeps a separate relationship', () => {
  const result = revision({
    acquired_entity: endpoint('ACQUIRED_ENTITY', 'same'),
    selling_shareholder: endpoint('SELLING_SHAREHOLDER', 'same'),
  });
  assert.equal(
    result.acquired_entity.entity_subject_id,
    result.selling_shareholder.entity_subject_id,
  );
  assert.notEqual(
    result.acquired_entity.participant_relationship_revision_id,
    result.selling_shareholder.participant_relationship_revision_id,
  );
  assert.throws(() => revision({
    acquired_entity: {
      ...endpoint('ACQUIRED_ENTITY', 'acquired'),
      participant_relationship_revision_id:
        endpoint('BUYER', 'buyer').participant_relationship_revision_id,
    },
  }), (error) => error.code === 'SHARE_PURCHASE_ENDPOINT_COLLISION');
});

test('a present component requires one security class and rejects parallel arrays', () => {
  assert.throws(() => revision({
    purchased_security_or_share_class: null,
  }), (error) => error.code === 'INCOMPLETE_SHARE_PURCHASE_COMPONENT');
  assert.throws(() => revision({
    number_or_percentage_purchased: {
      percentages: [6500, 3500],
      security_classes: ['Class A', 'Class B'],
    },
  }), (error) => error.code === 'INVALID_SHARE_PURCHASE_COMPONENT');
});

test('stated percentage and partial-or-full state must agree', () => {
  assert.throws(() => revision({
    number_or_percentage_purchased: percentageAmount(10000, '100%'),
    partial_or_full_acquisition_state: 'PARTIAL',
  }), (error) => error.code === 'SHARE_PURCHASE_AMOUNT_STATE_MISMATCH');
  assert.throws(() => revision({
    number_or_percentage_purchased: percentageAmount(6500, '65%'),
    partial_or_full_acquisition_state: 'FULL',
  }), (error) => error.code === 'SHARE_PURCHASE_AMOUNT_STATE_MISMATCH');
});

test('a component binds only to a terminal SHARE_PURCHASE leg', () => {
  const purchaseLeg = resolvedLeg('SHARE_PURCHASE');
  const purchaseComponent = component(0, {
    transaction_leg_resolution_occurrence_id:
      purchaseLeg.legOccurrence.transaction_leg_resolution_occurrence_id,
  });
  assert.equal(validateSharePurchaseInterestComponentLegBinding({
    share_purchase_interest_component: purchaseComponent,
    transaction_leg_resolution_occurrence: purchaseLeg.legOccurrence,
    transaction_leg_resolution_revision: purchaseLeg.legRevision,
  }), true);
  const assetLeg = resolvedLeg('ASSET_TRANSFER');
  const assetBoundComponent = component(0, {
    transaction_leg_resolution_occurrence_id:
      assetLeg.legOccurrence.transaction_leg_resolution_occurrence_id,
  });
  assert.throws(() => validateSharePurchaseInterestComponentLegBinding({
    share_purchase_interest_component: assetBoundComponent,
    transaction_leg_resolution_occurrence: assetLeg.legOccurrence,
    transaction_leg_resolution_revision: assetLeg.legRevision,
  }), (error) => error.code === 'INVALID_SHARE_PURCHASE_LEG_BINDING');
  const blockedLeg = resolvedLeg('SHARE_PURCHASE', 'CONFLICTING');
  const blockedBoundComponent = component(0, {
    transaction_leg_resolution_occurrence_id:
      blockedLeg.legOccurrence.transaction_leg_resolution_occurrence_id,
  });
  assert.throws(() => validateSharePurchaseInterestComponentLegBinding({
    share_purchase_interest_component: blockedBoundComponent,
    transaction_leg_resolution_occurrence: blockedLeg.legOccurrence,
    transaction_leg_resolution_revision: blockedLeg.legRevision,
  }), (error) => error.code === 'INVALID_SHARE_PURCHASE_LEG_BINDING');
});

test('component occurrences are deterministic and value-independent', () => {
  const purchaseComponent = component();
  assert.equal(validateSharePurchaseInterestComponent(purchaseComponent), true);
  assert.equal(canonicalJson(purchaseComponent), canonicalJson(component()));
  assert.throws(() => component(0, { consideration: '$50 per share' }),
    (error) => error.code === 'INVALID_SHARE_PURCHASE_COMPONENT');
});

test('validators reject a stale component revision', () => {
  const purchaseComponent = component();
  const purchaseRevision = revision({
    share_purchase_interest_component: purchaseComponent,
  });
  assert.throws(() => validateSharePurchaseInterestComponentRevision({
    revision: {
      ...structuredClone(purchaseRevision),
      share_purchase_interest_component_revision_id: id('stale-component'),
    },
    share_purchase_interest_component: purchaseComponent,
  }), (error) => error.code === 'STALE_SHARE_PURCHASE_COMPONENT_REVISION');
});

test('an absent component cannot encode NO purchase as a value', () => {
  assert.throws(() => buildSharePurchaseInterestComponentRevision({
    share_purchase_interest_component: component(),
    acquired_entity: null,
    buyer: null,
    consideration: null,
    evidence_edges: [id('absent-evidence')],
    number_or_percentage_purchased: null,
    ownership_path: null,
    partial_or_full_acquisition_state: 'NOT_STATED',
    purchased_security_or_share_class: null,
    resolver_version: 'share-purchase-component-resolver/v1',
    selling_shareholder: null,
    state: {
      code: 'ABSENT',
      complete_scope_id: id('complete-share-purchase-scope'),
    },
  }), (error) => error.code === 'NON_PRESENT_SHARE_PURCHASE_VALUE');
});
