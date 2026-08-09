'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUTHORITY_STATE,
  RepresentationsProductProjectionError,
  projectRepresentationClaims,
} = require('../lib/canonical-v2/representations-product-projection');
const {
  REPRESENTATION_TOPIC_REGISTRY_BINDING_V1,
} = require('../lib/canonical-v2/contract-bundle');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

function entry({
  side = 'TARGET',
  key = 'REPRESENTATION_ACCURACY_STANDARD',
  value = 'MAT_ALL_MATERIAL',
  suffix = `${side.toLowerCase()}-${key.toLowerCase()}`,
  conceptKey = side === 'TARGET' ? 'REP-T-CAP' : 'REP-B-ORG',
  attributes = {},
} = {}) {
  const provisionId = `provision-${suffix}`;
  const parent = side === 'PARENT';
  const topic = key === 'REPRESENTATION_TOPIC_PRESENT';
  const quote = topic
    ? `${parent ? 'Parent' : 'the Company'} has complied with applicable Law.`
    : key === 'KNOWLEDGE_QUALIFIER'
      ? `to the Knowledge of ${parent ? 'Parent' : 'the Company'}`
      : 'true and correct in all material respects';
  return {
    resolved_claim_definition_key: key,
    concept_key: conceptKey,
    section_reference: parent ? 'Section 4.2(a)' : 'Section 3.1(b)',
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
      party: {
        role: 'REPRESENTATION_MAKER',
        value: parent ? 'Parent' : 'the Company',
        capacity: parent ? 'BUYER' : 'TARGET',
      },
    },
    claim: {
      schema_version: 'CLAIM/V1',
      claim_revision_id: `claim-${suffix}`,
      subject_occurrence_id: provisionId,
      claim_definition_key: key,
      state: 'PRESENT',
      canonical_value: value,
      raw_value: quote,
      evidence: [{ start: 0, end: Buffer.byteLength(quote, 'utf8') }],
      attributes: {
        party_making: parent ? 'Parent' : 'the Company',
        qualifier_kind: key === 'KNOWLEDGE_QUALIFIER' ? 'KNOWLEDGE' : 'ACCURACY',
        attachment: { position: 'CHAPEAU', governs_path: null },
        ...(topic ? {
          topic_registry_version: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version,
          topic_registry_digest: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest,
        } : {}),
        ...attributes,
      },
    },
  };
}

function projectionError(code) {
  return (error) => error instanceof RepresentationsProductProjectionError && error.code === code;
}

test('target and parent governed qualifiers reach Review, Query, Compare and market statistics without losing side', () => {
  const parentKnowledge = entry({
    side: 'PARENT',
    key: 'KNOWLEDGE_QUALIFIER',
    value: true,
    attributes: {
      knowledge_standard: 'ACTUAL',
      attachment: { position: 'ITEM', governs_path: ['(a)'] },
    },
  });
  parentKnowledge.claim.subject_occurrence_id = 'component-parent-knowledge-item';
  const projection = projectRepresentationClaims({
    resolved_entries: [
      entry(),
      parentKnowledge,
    ],
  });
  assert.equal(projection.authority_state, AUTHORITY_STATE);
  assert.equal(projection.records.length, 2);
  const target = projection.records.find((record) => record.representation_side === 'TARGET');
  const parent = projection.records.find((record) => record.representation_side === 'PARENT');
  assert.equal(target.review.section_key, 'target-representations');
  assert.equal(target.query.field_key, 'targetRepresentationFact');
  assert.deepEqual(target.query, target.compare);
  assert.equal(target.market.breakdown.representation_side, 'TARGET');
  assert.equal(target.market.canonical_unit, 'ACCURACY_STANDARD_CODE');
  assert.equal(parent.review.section_key, 'parent-representations');
  assert.equal(parent.query.field_key, 'parentRepresentationFact');
  assert.deepEqual(parent.query, parent.compare);
  assert.equal(parent.market.breakdown.knowledge_standard, 'ACTUAL');
  assert.equal(parent.market.breakdown.qualifier_position, 'ITEM');
  assert.equal(parent.subject_occurrence_id, 'component-parent-knowledge-item');
  assert.equal(parent.market.canonical_unit, 'PRESENT_TRUE');
});

test('Query and Compare expose both side-specific representation fields', () => {
  const fields = fieldsForCompareCell('REPRESENTATION', ['all']);
  assert.ok(fields.includes('targetRepresentationFact'));
  assert.ok(fields.includes('parentRepresentationFact'));
  assert.notEqual(fields.indexOf('targetRepresentationFact'), fields.indexOf('parentRepresentationFact'));
});

test('missing qualifiers stay unknown and cannot be projected as absence', () => {
  for (const key of ['REPRESENTATION_ACCURACY_STANDARD', 'KNOWLEDGE_QUALIFIER']) {
    const candidate = entry({ key, value: key === 'KNOWLEDGE_QUALIFIER' ? false : null, suffix: `absent-${key}` });
    candidate.claim.state = 'ABSENT';
    assert.throws(
      () => projectRepresentationClaims({ resolved_entries: [candidate] }),
      projectionError('INVALID_GOVERNED_CLAIM'),
    );
  }
});

test('material contracts and no-other-representations concepts retain their separate owners', () => {
  for (const conceptKey of ['REP-T-CONTRACTS', 'REP-B-NOOTHERREPS', 'REP-T-FRAUDCARVEOUT']) {
    assert.throws(
      () => projectRepresentationClaims({ resolved_entries: [entry({ conceptKey, suffix: conceptKey.toLowerCase() })] }),
      projectionError('EXCLUDED_FAMILY_OWNERSHIP'),
    );
  }
});

test('side identity is controlled by the representation maker and must agree with an explicit concept side', () => {
  const mismatch = entry({ side: 'PARENT', conceptKey: 'REP-T-ORG', suffix: 'side-mismatch' });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [mismatch] }),
    projectionError('SIDE_IDENTITY_MISMATCH'),
  );
  const unresolved = entry({ suffix: 'unresolved-side' });
  unresolved.provision_instance.party.capacity = 'SELLER';
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [unresolved] }),
    projectionError('UNRESOLVED_REPRESENTATION_SIDE'),
  );
});

test('target and parent topic tuples project only with the bound registry identity', () => {
  const projection = projectRepresentationClaims({
    resolved_entries: [
      entry({
        key: 'REPRESENTATION_TOPIC_PRESENT',
        value: 'TAX',
        conceptKey: 'REP-T-TOPIC',
        suffix: 'target-topic',
      }),
      entry({
        side: 'PARENT',
        key: 'REPRESENTATION_TOPIC_PRESENT',
        value: 'SEC_DISCLOSURE',
        conceptKey: 'REP-B-TOPIC',
        suffix: 'parent-topic',
      }),
    ],
  });
  assert.equal(projection.records.length, 2);
  const target = projection.records.find((record) => record.representation_side === 'TARGET');
  const parent = projection.records.find((record) => record.representation_side === 'PARENT');
  assert.equal(target.review.row_key, 'TARGET:REPRESENTATION_TOPIC_PRESENT');
  assert.equal(parent.review.row_key, 'PARENT:REPRESENTATION_TOPIC_PRESENT');
  assert.equal(target.market.canonical_unit, 'REPRESENTATION_TOPIC_CODE');
  assert.equal(parent.query.field_key, 'parentRepresentationFact');
  assert.equal(target.query.value.dimensions.topic_registry_digest, REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest);
  assert.equal(parent.query.value.dimensions.topic_registry_version, REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version);
});

test('topic tuples reject wrong concepts, out-of-enum values, and registry drift', () => {
  const wrongConcept = entry({
    side: 'PARENT',
    key: 'REPRESENTATION_TOPIC_PRESENT',
    value: 'TAX',
    conceptKey: 'REP-T-TOPIC',
    suffix: 'wrong-topic-concept',
  });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [wrongConcept] }),
    projectionError('SIDE_IDENTITY_MISMATCH'),
  );
  const unrelatedConcept = entry({
    key: 'REPRESENTATION_TOPIC_PRESENT',
    value: 'TAX',
    conceptKey: 'REP-T-CAP',
    suffix: 'unrelated-topic-concept',
  });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [unrelatedConcept] }),
    projectionError('TOPIC_CONCEPT_MISMATCH'),
  );
  const outOfEnum = entry({
    key: 'REPRESENTATION_TOPIC_PRESENT',
    value: 'NOT_A_TOPIC',
    conceptKey: 'REP-T-TOPIC',
    suffix: 'topic-out-of-enum',
  });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [outOfEnum] }),
    projectionError('INVALID_GOVERNED_CLAIM'),
  );
  const registryDrift = entry({
    key: 'REPRESENTATION_TOPIC_PRESENT',
    value: 'TAX',
    conceptKey: 'REP-T-TOPIC',
    suffix: 'topic-registry-drift',
    attributes: { topic_registry_digest: '0'.repeat(64) },
  });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [registryDrift] }),
    projectionError('TOPIC_REGISTRY_BINDING_MISMATCH'),
  );
  const duplicate = entry({
    key: 'REPRESENTATION_TOPIC_PRESENT',
    value: 'TAX',
    conceptKey: 'REP-T-TOPIC',
    suffix: 'duplicate-topic',
  });
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [duplicate, structuredClone(duplicate)] }),
    projectionError('DUPLICATE_PRODUCT_CLAIM'),
  );
});

test('topic concepts reject every non-topic representation claim', () => {
  for (const [side, conceptKey] of [
    ['TARGET', 'REP-T-TOPIC'],
    ['PARENT', 'REP-B-TOPIC'],
  ]) {
    for (const [key, value] of [
      ['REPRESENTATION_ACCURACY_STANDARD', 'MAT_ALL_MATERIAL'],
      ['KNOWLEDGE_QUALIFIER', true],
    ]) {
      assert.throws(
        () => projectRepresentationClaims({
          resolved_entries: [entry({ side, key, value, conceptKey, suffix: `${side}-${key}-topic-concept` })],
        }),
        projectionError('TOPIC_CONCEPT_MISMATCH'),
      );
    }
  }
});

test('scope, lookbacks, bring-downs and unfamiliar standards do not enter the governed projection', () => {
  for (const key of [
    'REPRESENTATION_MEASUREMENT_DATE',
    'RETROSPECTIVE_LOOKBACK',
    'DISCLOSURE_SCHEDULE_CARVEOUT',
    'REPRESENTATION_MATERIALITY_SCRAPE',
    'NO_OTHER_REPRESENTATIONS_PRESENT',
  ]) {
    assert.throws(
      () => projectRepresentationClaims({ resolved_entries: [entry({ key, value: true, suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [entry({
      key: 'KNOWLEDGE_QUALIFIER', value: true, attributes: { knowledge_standard: 'REASONABLE_BELIEF' }, suffix: 'unknown-standard',
    })] }),
    projectionError('INVALID_KNOWLEDGE_STANDARD'),
  );
});

test('duplicate side-specific claim revisions fail closed', () => {
  const candidate = entry();
  assert.throws(
    () => projectRepresentationClaims({ resolved_entries: [candidate, structuredClone(candidate)] }),
    projectionError('DUPLICATE_PRODUCT_CLAIM'),
  );
});
