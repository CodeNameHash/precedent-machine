'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  PUBLICATION_DISPOSITION_V2_SCHEMA,
} = require('../lib/canonical-v2/publication-disposition');
const {
  AUTHORITY_STATE,
  CARD_SCHEMA,
  IocWaveAProjectionError,
  NATIVE_SOURCE,
  RECORD_SCHEMA,
  projectIocWaveAClaims,
} = require('../lib/canonical-v2/ioc-wave-a-product-projection');

const party = Object.freeze({
  role: 'IOC_COVENANT_OBLIGOR',
  value: 'Parent',
  capacity: 'BUYER',
});
const provision = Object.freeze({
  schema_version: 'PROVISION_INSTANCE/V1',
  provision_instance_id: 'ioc-parent-provision',
  party,
});
const PUBLICATION_TIME = '2026-08-10T12:00:00.000Z';

function eligibleSidecar(claimRevisionId) {
  const body = {
    schema_version: PUBLICATION_DISPOSITION_V2_SCHEMA,
    claim_revision_id: claimRevisionId,
    run_receipt_id: 'b'.repeat(64),
    resolution_receipt_id: 'c'.repeat(64),
    review_queue_artifact_id: null,
    publication_input_digest: 'd'.repeat(64),
    canonical_validation_state: 'VALIDATED',
    family: 'INTERIM_OPERATING_COVENANTS',
    claim_kind: 'IOC_RESTRICTION_PRESENT',
    mechanism: 'EXACT_BOUND_DIGESTS',
    selected_rung: 2,
    risk_signals: {
      structural_uncertainty: false,
      definition_ambiguity: false,
      model_fallback: false,
      party_attribution_risk: false,
    },
    evaluated_at: PUBLICATION_TIME,
    authority_id: 'e'.repeat(64),
    disposition: 'ELIGIBLE',
    reason_codes: ['CALIBRATION_AUTHORITY_MATCHED'],
    prior_eligible_decision_id: null,
    prior_eligible_decision: null,
  };
  return { ...body, decision_id: contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, body) };
}

function fixtureEntry({ componentId, claimRevisionId, category, quote }) {
  return {
    section_reference: '6.1',
    resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
    concept_key: 'IOC-MERGE',
    party,
    provision_instance: provision,
    claim: {
      claim_revision_id: claimRevisionId,
      claim_definition_key: 'IOC_RESTRICTION_PRESENT',
      subject_occurrence_id: componentId,
      state: 'PRESENT',
      raw_value: quote,
      canonical_value: true,
      attributes: { restriction_category: category },
      evidence: [{ excerpt_id: `excerpt-${componentId}` }],
    },
  };
}

function fixtureComponent(componentId, ordinal) {
  return {
    schema_version: 'PROVISION_COMPONENT/V1',
    provision_component_id: componentId,
    parent_provision_instance_id: provision.provision_instance_id,
    component_key: 'RESTRICTED_ACTION',
    ordinal,
  };
}

function expectedRecord(entry) {
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    claim_revision_id: entry.claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    provision_component_id: entry.claim.subject_occurrence_id,
    concept_key: 'IOC-MERGE',
    obligor_capacity: 'BUYER',
    review: {
      row_key: 'IOC-MERGE',
      label: 'Mergers, acquisitions and dispositions',
      value: true,
      obligor_capacity: 'BUYER',
      source_section_reference: '6.1',
    },
    query: {
      field_key: 'iocRestrictionPresent',
      value: { concept_key: 'IOC-MERGE', obligor_capacity: 'BUYER' },
    },
    compare: {
      field_key: 'iocRestrictionPresent',
      value: { concept_key: 'IOC-MERGE', obligor_capacity: 'BUYER' },
    },
    market: {
      metric_key: 'IOC_RESTRICTION_PRESENCE_BY_CONCEPT_AND_SIDE',
      metric_version: 1,
      value_dimension: 'BOOLEAN_PRESENCE',
      canonical_unit: 'PRESENT_TRUE',
      canonical_value: true,
      breakdown: { concept_key: 'IOC-MERGE', obligor_capacity: 'BUYER' },
      per_deal_rollup: 'ANY_TRUE',
      weighting: 'DEAL',
    },
  };
  return { ...body, projection_record_id: contentId(RECORD_SCHEMA, body) };
}

test('IOC adapter keeps every governed restriction limb and adds exact-lineage review cards', async () => {
  const entries = [
    fixtureEntry({
      componentId: 'ioc-component-acquisition',
      claimRevisionId: 'ioc-claim-acquisition',
      category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
      quote: 'acquire control of any other Person',
    }),
    fixtureEntry({
      componentId: 'ioc-component-disposition',
      claimRevisionId: 'ioc-claim-disposition',
      category: 'DISPOSITIONS_ASSET_SALES',
      quote: 'sell or dispose of any material assets',
    }),
  ];
  const components = [
    fixtureComponent('ioc-component-acquisition', 1),
    fixtureComponent('ioc-component-disposition', 2),
  ];
  const sourceSnapshot = structuredClone({ entries, components });

  const direct = projectIocWaveAClaims({
    resolved_entries: entries,
    ioc_restriction_components: components,
  });
  const fromResolution = projectIocWaveAClaims({
    resolution: { resolved: entries, ioc_restriction_components: components },
  });

  assert.deepEqual(fromResolution, direct);
  assert.deepEqual({ entries, components }, sourceSnapshot);
  assert.deepEqual(direct.ioc_restriction_components, components);
  assert.notEqual(direct.ioc_restriction_components, components);
  assert.deepEqual(direct.records, entries.map(expectedRecord).sort(
    (left, right) => left.projection_record_id.localeCompare(right.projection_record_id),
  ));
  assert.equal(direct.cards.length, components.length);
  assert.deepEqual(
    direct.cards.map((card) => card.provision_component_id).sort(),
    components.map((component) => component.provision_component_id).sort(),
  );

  for (const card of direct.cards) {
    const entry = entries.find((candidate) => candidate.claim.subject_occurrence_id === card.provision_component_id);
    assert.equal(card.id, contentId(CARD_SCHEMA, {
      claim_revision_id: entry.claim.claim_revision_id,
      provision_component_id: entry.claim.subject_occurrence_id,
      concept_key: entry.concept_key,
    }));
    assert.equal(card.provision_instance_id, provision.provision_instance_id);
    assert.equal(card.provision_type, 'COVENANT_INTERIM_OPERATING');
    assert.equal(card.provision_subtype, 'IOC-MERGE');
    assert.deepEqual(card.party, party);
    assert.equal(card.primary_quote, entry.claim.raw_value);
    assert.deepEqual(card.features, {
      restrictionComponents: [entry.claim.attributes.restriction_category],
      mainObligation: entry.claim.raw_value,
    });
    assert.deepEqual(card.canonical_v2_lineage, {
      source: NATIVE_SOURCE,
      claim_revision_ids: [entry.claim.claim_revision_id],
      claim_definition_keys: ['IOC_RESTRICTION_PRESENT'],
      provision_component_ids: [entry.claim.subject_occurrence_id],
    });
  }

  const { negativeCovenantGroups } = await import(path.join(
    '..', 'components', 'review', 'table-configs', 'ioc-exceptions.config.js',
  ));
  const groups = negativeCovenantGroups(direct.cards);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].code, 'IOC-MERGE');
  assert.equal(groups[0].cards.length, 2);
});

test('IOC adapter fails when preview input drops a claim but keeps its component', () => {
  const entry = fixtureEntry({
    componentId: 'ioc-component-acquisition',
    claimRevisionId: 'ioc-claim-acquisition',
    category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
    quote: 'acquire control of any other Person',
  });
  assert.throws(
    () => projectIocWaveAClaims({
      resolution: {
        resolved: [entry],
        ioc_restriction_components: [
          fixtureComponent('ioc-component-acquisition', 1),
          fixtureComponent('ioc-component-dropped', 2),
        ],
      },
    }),
    (error) => error instanceof IocWaveAProjectionError
      && error.code === 'UNBOUND_RESTRICTION_COMPONENT',
  );
});

test('IOC adapter refuses a card when the governed restriction category is absent', () => {
  const entry = fixtureEntry({
    componentId: 'ioc-component-acquisition',
    claimRevisionId: 'ioc-claim-acquisition',
    category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
    quote: 'acquire control of any other Person',
  });
  delete entry.claim.attributes.restriction_category;
  assert.throws(
    () => projectIocWaveAClaims({
      resolved_entries: [entry],
      ioc_restriction_components: [fixtureComponent('ioc-component-acquisition', 1)],
    }),
    (error) => error instanceof IocWaveAProjectionError && error.code === 'INVALID_CARD_SOURCE',
  );
});

test('IOC publication filtering removes components owned only by withheld claims', () => {
  const eligible = fixtureEntry({
    componentId: 'ioc-component-eligible',
    claimRevisionId: 'a'.repeat(64),
    category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
    quote: 'acquire control of any other Person',
  });
  eligible.publication_disposition = eligibleSidecar(eligible.claim.claim_revision_id);
  const withheld = fixtureEntry({
    componentId: 'ioc-component-withheld',
    claimRevisionId: 'f'.repeat(64),
    category: 'DISPOSITIONS_ASSET_SALES',
    quote: 'sell or dispose of any material assets',
  });
  const projection = projectIocWaveAClaims({
    resolved_entries: [eligible, withheld],
    ioc_restriction_components: [
      fixtureComponent('ioc-component-eligible', 1),
      fixtureComponent('ioc-component-withheld', 2),
    ],
    publication_filter: 'CANDIDATE_ELIGIBLE',
    publication_evaluation_time: PUBLICATION_TIME,
  });

  assert.deepEqual(
    projection.ioc_restriction_components.map((component) => component.provision_component_id),
    ['ioc-component-eligible'],
  );
  assert.deepEqual(projection.records.map((record) => record.claim_revision_id), ['a'.repeat(64)]);
});
