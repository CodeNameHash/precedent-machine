const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  bindSharedAuthorityConsumerRelease,
  buildSharedAuthorityConsumedContractManifest,
} = require('../lib/canonical-v2/shared-authority-consumed-contract-manifest');
const {
  buildProcessDealFactProjection,
  validateProcessDealFactProjection,
} = require('../lib/canonical-v2/process-deal-fact-projection');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const CONTRACT_FINGERPRINT = 'a'.repeat(64);
const SERVING_NAMESPACE_ID = 'b'.repeat(64);
const CORPUS_RELEASE_ID = 'c'.repeat(64);

const TERMINAL_BY_FIELD = Object.freeze({
  deal: 'ENTITY_REVISION',
  signed: 'DEAL_FACT_RESOLUTION_REVISION',
  buyer: 'PARTICIPANT_RELATIONSHIP_REVISION',
  value: 'REGISTERED_DERIVATION',
  type: 'DEAL_FACT_RESOLUTION_REVISION',
  structure: 'TRANSACTION_STRUCTURE_RESOLUTION_REVISION',
  buyer_type: 'PARTICIPANT_RELATIONSHIP_REVISION',
  sector: 'DEAL_FACT_RESOLUTION_REVISION',
  law_firm: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  lawyer: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  law_firm_buyer: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  law_firm_target: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  lawyers_buyer: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  lawyers_target: 'PROFESSIONAL_ASSIGNMENT_REVISION',
  merger_form: 'TRANSACTION_LEG_RESOLUTION_REVISION',
});

const ACTION_BY_TERMINAL = Object.freeze({
  ENTITY_REVISION: 'ENTITY_SUBJECT_EVIDENCE',
  DEAL_FACT_RESOLUTION_REVISION: 'DEAL_FACT_RESOLUTION_EVIDENCE',
  PARTICIPANT_RELATIONSHIP_REVISION: 'DEAL_PARTICIPANT_RELATIONSHIP_EVIDENCE',
  REGISTERED_DERIVATION: 'REGISTERED_DERIVATION_EVIDENCE',
  TRANSACTION_STRUCTURE_RESOLUTION_REVISION:
    'TRANSACTION_STRUCTURE_RESOLUTION_EVIDENCE',
  PROFESSIONAL_ASSIGNMENT_REVISION: 'PROFESSIONAL_ASSIGNMENT_EVIDENCE',
  TRANSACTION_LEG_RESOLUTION_REVISION: 'TRANSACTION_LEG_RESOLUTION_EVIDENCE',
});

const PROFESSIONAL_FIELD_KEYS = new Set([
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function syntheticId(label) {
  return contentId('SYNTHETIC_PROCESS_SHARED_AUTHORITY_TEST_ID/V1', { label });
}

function manifest() {
  return buildSharedAuthorityConsumedContractManifest({
    root_directory: ROOT,
  });
}

function releaseBinding(sharedManifest = manifest()) {
  return bindSharedAuthorityConsumerRelease({
    manifest: sharedManifest,
    canonical_contract_fingerprint: CONTRACT_FINGERPRINT,
    serving_namespace_id: SERVING_NAMESPACE_ID,
    corpus_release_id: CORPUS_RELEASE_ID,
  });
}

function releaseIdentity() {
  return {
    canonical_contract_fingerprint: CONTRACT_FINGERPRINT,
    serving_namespace_id: SERVING_NAMESPACE_ID,
    corpus_release_id: CORPUS_RELEASE_ID,
    governed_deal_id: 'deal:synthetic-combination',
    projection_version: 1,
  };
}

function professionalAssignments(fieldKey) {
  return [
    {
      professional_assignment_relationship_id:
        syntheticId(`${fieldKey}:assignment:1`),
      professional_entity_id: syntheticId(`${fieldKey}:professional:1`),
      represented_entity_id: syntheticId('combination-party:1'),
      professional_role:
        fieldKey.includes('lawyer') ? 'NAMED_LAWYER' : 'LEGAL_COUNSEL',
      represented_party_role: 'COMBINATION_PARTY',
      state: 'PRESENT',
    },
    {
      professional_assignment_relationship_id:
        syntheticId(`${fieldKey}:assignment:2`),
      professional_entity_id: syntheticId(`${fieldKey}:professional:2`),
      represented_entity_id: syntheticId('combination-party:2'),
      professional_role:
        fieldKey.includes('lawyer') ? 'NAMED_LAWYER' : 'LEGAL_COUNSEL',
      represented_party_role: 'COMBINATION_PARTY',
      state: 'PRESENT',
    },
  ];
}

function canonicalValue(fieldKey) {
  const values = {
    deal: {
      governed_deal_id: 'deal:synthetic-combination',
      target_entity_id: syntheticId('target'),
      combination_party_entity_ids: [
        syntheticId('combination-party:1'),
        syntheticId('combination-party:2'),
      ],
      selling_shareholder_entity_ids: [syntheticId('selling-shareholder')],
      other_named_bidder_entity_ids: [syntheticId('other-bidder')],
      source_local_bidder_labels: ['Synthetic Party A'],
    },
    signed: '2026-01-02',
    value: {
      amount: 65000000000,
      basis: 'NORMALISED_EQUITY_VALUE',
      currency: 'USD',
      derivation_state: 'SELECTED_REGISTERED_DERIVATION',
    },
    type: {
      consideration_form: 'CASH_PLUS_CVR',
      components: [
        { component_type: 'CASH', amount_per_share: 10 },
        { component_type: 'CVR', stated_ceiling_per_share: 4 },
      ],
    },
    structure: {
      legal_structure: 'SHARE_PURCHASE',
      source_characterisation: 'REVERSE_MERGER',
      transaction_legs: [
        {
          transaction_leg_resolution_occurrence_id: syntheticId('rmt-leg'),
          leg_type: 'REVERSE_MORRIS_TRUST_COMBINATION',
        },
        {
          transaction_leg_resolution_occurrence_id:
            syntheticId('share-purchase-leg'),
          leg_type: 'SHARE_PURCHASE',
        },
      ],
      control_outcome: {
        transaction_control_outcome_occurrence_id: syntheticId('control'),
        controller_state: 'JOINT_OR_UNRESOLVED',
      },
      share_purchase_interest_components: [
        {
          share_purchase_interest_component_id: syntheticId('share-class-a'),
          interest_type: 'SHARE_CLASS',
        },
      ],
    },
    sector: 'BIOPHARMA',
    merger_form: 'REVERSE_MERGER',
  };
  if (PROFESSIONAL_FIELD_KEYS.has(fieldKey)) {
    return professionalAssignments(fieldKey);
  }
  return values[fieldKey];
}

function typedState(fieldKey) {
  if (fieldKey === 'buyer' || fieldKey === 'buyer_type') return 'NOT_APPLICABLE';
  return 'PRESENT';
}

function fieldEntry(field, index, identity) {
  const terminalType = TERMINAL_BY_FIELD[field.field_key];
  const state = typedState(field.field_key);
  const exactDetailAction = ACTION_BY_TERMINAL[terminalType];
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    canonical_value: state === 'PRESENT' ? canonicalValue(field.field_key) : null,
    display_label: state === 'PRESENT' ? field.field_key : null,
    typed_state: state,
    typed_lineage: {
      terminal_type: terminalType,
      stable_occurrence_or_subject_id:
        syntheticId(`${field.field_key}:occurrence:${index}`),
      selected_revision_id: syntheticId(`${field.field_key}:revision:${index}`),
      canonical_payload_digest:
        syntheticId(`${field.field_key}:payload:${index}`),
      exact_detail_action: exactDetailAction,
      release_identity: identity,
    },
    exact_detail_action: exactDetailAction,
    conflict_indicator: field.field_key === 'structure',
    derivation_reference:
      terminalType === 'REGISTERED_DERIVATION'
        ? syntheticId(`${field.field_key}:derivation`)
        : null,
    release_identity: identity,
  };
}

function canonicalProjectionRevision(sharedManifest = manifest()) {
  const identity = releaseIdentity();
  const fieldEntries = sharedManifest.field_catalogue_contract.field_bindings
    .map((field, index) => fieldEntry(field, index, identity));
  const canonicalDealFactProjectionId = contentId(
    'CANONICAL_DEAL_FACT_PROJECTION/V1',
    identity,
  );
  const projectionPayloadDigest = sha256Hex(canonicalJson(fieldEntries));
  const revisionStatus = 'SELECTED';
  const revisionIdentity = {
    canonical_deal_fact_projection_id: canonicalDealFactProjectionId,
    field_entries: fieldEntries,
    projection_payload_digest: projectionPayloadDigest,
    release_identity: identity,
    revision_status: revisionStatus,
  };
  return {
    schema_version: 'CANONICAL_DEAL_FACT_PROJECTION_REVISION/V1',
    projection_type: 'CanonicalDealFactProjection',
    canonical_deal_fact_projection_id: canonicalDealFactProjectionId,
    canonical_deal_fact_projection_revision_id: contentId(
      'CANONICAL_DEAL_FACT_PROJECTION_REVISION/V1',
      revisionIdentity,
    ),
    field_entries: fieldEntries,
    projection_payload_digest: projectionPayloadDigest,
    release_identity: identity,
    revision_status: revisionStatus,
  };
}

function build() {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);
  const revision = canonicalProjectionRevision(sharedManifest);
  return {
    sharedManifest,
    binding,
    revision,
    processProjection: buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: revision,
    }),
  };
}

test('builds one deterministic read-only Process view of the exact shared projection', () => {
  const first = build();
  const second = build();

  assert.deepEqual(first.processProjection, second.processProjection);
  assert.equal(
    first.processProjection.schema_version,
    'PROCESS_DEAL_FACT_PROJECTION/V1',
  );
  assert.equal(first.processProjection.consumer_domain, 'PROCESS');
  assert.equal(first.processProjection.authority, 'READ_ONLY_SHARED_PROJECTION');
  assert.equal(
    first.processProjection.canonical_deal_fact_projection_revision_id,
    first.revision.canonical_deal_fact_projection_revision_id,
  );
  assert.deepEqual(first.processProjection.field_entries, first.revision.field_entries);
  assert.deepEqual(
    first.processProjection.field_catalogue.field_bindings,
    first.sharedManifest.field_catalogue_contract.field_bindings,
  );
  assert.equal(first.processProjection.authority_limits.canonical_write, 'NONE');
  assert.equal(first.processProjection.authority_limits.activation, 'NONE');
  assert.equal(Object.isFrozen(first.processProjection), true);
  assert.equal(Object.isFrozen(first.processProjection.field_entries), true);
  assert.doesNotThrow(() => validateProcessDealFactProjection({
    manifest: first.sharedManifest,
    binding: first.binding,
    projection: first.processProjection,
  }));
});

test('preserves merger-of-equals, reverse-merger, RMT and share-purchase structures', () => {
  const { processProjection } = build();
  const deal = processProjection.field_entries.find(
    (entry) => entry.field_key === 'deal',
  );
  const buyer = processProjection.field_entries.find(
    (entry) => entry.field_key === 'buyer',
  );
  const structure = processProjection.field_entries.find(
    (entry) => entry.field_key === 'structure',
  );

  assert.equal(buyer.typed_state, 'NOT_APPLICABLE');
  assert.equal(deal.canonical_value.combination_party_entity_ids.length, 2);
  assert.equal(deal.canonical_value.selling_shareholder_entity_ids.length, 1);
  assert.equal(structure.canonical_value.source_characterisation, 'REVERSE_MERGER');
  assert.deepEqual(
    structure.canonical_value.transaction_legs.map((leg) => leg.leg_type),
    ['REVERSE_MORRIS_TRUST_COMBINATION', 'SHARE_PURCHASE'],
  );
  assert.equal(
    structure.canonical_value.control_outcome.controller_state,
    'JOINT_OR_UNRESOLVED',
  );
  assert.equal(
    structure.canonical_value.share_purchase_interest_components[0].interest_type,
    'SHARE_CLASS',
  );
});

test('preserves role-aware professional assignment components without parallel arrays', () => {
  const { processProjection } = build();
  const professionalEntries = processProjection.field_entries.filter(
    (entry) => PROFESSIONAL_FIELD_KEYS.has(entry.field_key),
  );

  assert.equal(professionalEntries.length, 6);
  for (const entry of professionalEntries) {
    assert.equal(Array.isArray(entry.canonical_value), true);
    assert.equal(entry.typed_lineage.terminal_type, 'PROFESSIONAL_ASSIGNMENT_REVISION');
    for (const assignment of entry.canonical_value) {
      assert.equal(typeof assignment.professional_assignment_relationship_id, 'string');
      assert.equal(typeof assignment.professional_entity_id, 'string');
      assert.equal(typeof assignment.represented_entity_id, 'string');
      assert.equal(assignment.represented_party_role, 'COMBINATION_PARTY');
      assert.ok(['LEGAL_COUNSEL', 'NAMED_LAWYER'].includes(
        assignment.professional_role,
      ));
    }
  }
});

test('preserves typed missing states, conflicts, derivations and exact-detail actions', () => {
  const { processProjection } = build();
  const buyer = processProjection.field_entries.find(
    (entry) => entry.field_key === 'buyer',
  );
  const value = processProjection.field_entries.find(
    (entry) => entry.field_key === 'value',
  );
  const structure = processProjection.field_entries.find(
    (entry) => entry.field_key === 'structure',
  );

  assert.deepEqual(
    {
      typed_state: buyer.typed_state,
      canonical_value: buyer.canonical_value,
    },
    {
      typed_state: 'NOT_APPLICABLE',
      canonical_value: null,
    },
  );
  assert.equal(structure.conflict_indicator, true);
  assert.equal(value.typed_lineage.terminal_type, 'REGISTERED_DERIVATION');
  assert.equal(typeof value.derivation_reference, 'string');
  assert.equal(
    value.exact_detail_action,
    value.typed_lineage.exact_detail_action,
  );
});

test('fails when the promised shared projection is absent or is not selected', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);

  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: null,
    }),
    (error) => error.code === 'SHARED_PROJECTION_REQUIRED',
  );

  const revision = canonicalProjectionRevision(sharedManifest);
  revision.revision_status = 'CANDIDATE';
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: revision,
    }),
    (error) => error.code === 'SHARED_PROJECTION_NOT_SELECTED',
  );
});

test('rejects a release, projection ID or revision ID mismatch', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);

  const wrongRelease = canonicalProjectionRevision(sharedManifest);
  wrongRelease.release_identity.corpus_release_id = 'd'.repeat(64);
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: wrongRelease,
    }),
    (error) => error.code === 'SHARED_PROJECTION_RELEASE_MISMATCH',
  );

  const wrongProjectionId = canonicalProjectionRevision(sharedManifest);
  wrongProjectionId.canonical_deal_fact_projection_id = 'd'.repeat(64);
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: wrongProjectionId,
    }),
    (error) => error.code === 'SHARED_PROJECTION_IDENTITY_MISMATCH',
  );

  const wrongRevisionId = canonicalProjectionRevision(sharedManifest);
  wrongRevisionId.canonical_deal_fact_projection_revision_id = 'e'.repeat(64);
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: wrongRevisionId,
    }),
    (error) => error.code === 'SHARED_PROJECTION_REVISION_MISMATCH',
  );
});

test('rejects missing, extra, duplicate, reordered or wrong-version fields', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);

  const cases = [
    {
      code: 'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      mutate(revision) {
        revision.field_entries.pop();
      },
    },
    {
      code: 'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      mutate(revision) {
        revision.field_entries.push(clone(revision.field_entries[0]));
      },
    },
    {
      code: 'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      mutate(revision) {
        revision.field_entries[0].field_key = 'future_unadmitted_field';
      },
    },
    {
      code: 'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      mutate(revision) {
        [revision.field_entries[0], revision.field_entries[1]] = [
          revision.field_entries[1],
          revision.field_entries[0],
        ];
      },
    },
    {
      code: 'SHARED_PROJECTION_FIELD_VERSION_MISMATCH',
      mutate(revision) {
        revision.field_entries[0].field_version += 1;
      },
    },
  ];

  for (const fixture of cases) {
    const revision = canonicalProjectionRevision(sharedManifest);
    fixture.mutate(revision);
    assert.throws(
      () => buildProcessDealFactProjection({
        manifest: sharedManifest,
        binding,
        canonical_projection_revision: revision,
      }),
      (error) => error.code === fixture.code,
    );
  }
});

test('fails closed with a controlled error for a malformed field member', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);
  const revision = canonicalProjectionRevision(sharedManifest);
  revision.field_entries[0] = null;

  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: revision,
    }),
    (error) => (
      error.name === 'ProcessDealFactProjectionError'
      && error.code === 'SHARED_PROJECTION_FIELD_SET_MISMATCH'
    ),
  );
});

test('rejects generic lineage, mismatched source actions and incomplete derivations', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);

  const generic = canonicalProjectionRevision(sharedManifest);
  generic.field_entries[0].typed_lineage.terminal_type = 'GENERIC_REVISION';
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: generic,
    }),
    (error) => error.code === 'SHARED_PROJECTION_LINEAGE_MISMATCH',
  );

  const wrongAction = canonicalProjectionRevision(sharedManifest);
  wrongAction.field_entries[0].exact_detail_action = 'OTHER_ACTION';
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: wrongAction,
    }),
    (error) => error.code === 'SHARED_PROJECTION_EXACT_DETAIL_MISMATCH',
  );

  const missingDerivation = canonicalProjectionRevision(sharedManifest);
  missingDerivation.field_entries
    .find((entry) => entry.field_key === 'value')
    .derivation_reference = null;
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: missingDerivation,
    }),
    (error) => error.code === 'SHARED_PROJECTION_DERIVATION_MISMATCH',
  );
});

test('rejects a value in a non-present state and missing evidence in a present state', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);

  const valueWhenMissing = canonicalProjectionRevision(sharedManifest);
  valueWhenMissing.field_entries
    .find((entry) => entry.field_key === 'buyer')
    .canonical_value = { entity_id: syntheticId('invented-buyer') };
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: valueWhenMissing,
    }),
    (error) => error.code === 'SHARED_PROJECTION_STATE_MISMATCH',
  );

  const missingValue = canonicalProjectionRevision(sharedManifest);
  missingValue.field_entries
    .find((entry) => entry.field_key === 'signed')
    .canonical_value = null;
  assert.throws(
    () => buildProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      canonical_projection_revision: missingValue,
    }),
    (error) => error.code === 'SHARED_PROJECTION_STATE_MISMATCH',
  );
});

test('rejects credentials, database IDs and legacy fact fallbacks at any depth', () => {
  const sharedManifest = manifest();
  const binding = releaseBinding(sharedManifest);
  const forbiddenKeys = [
    'write_credentials',
    'service_role_key',
    'database_row_id',
    'legacy_deal_facts',
  ];

  for (const forbiddenKey of forbiddenKeys) {
    const revision = canonicalProjectionRevision(sharedManifest);
    revision.field_entries[0].canonical_value[forbiddenKey] = 'forbidden';
    assert.throws(
      () => buildProcessDealFactProjection({
        manifest: sharedManifest,
        binding,
        canonical_projection_revision: revision,
      }),
      (error) => error.code === 'SHARED_PROJECTION_FORBIDDEN_INPUT',
    );
  }
});

test('detects a re-signed mutation of the Process read-only view', () => {
  const {
    sharedManifest,
    binding,
    processProjection,
  } = build();
  const changed = clone(processProjection);
  changed.field_entries[0].display_label = 'Changed';
  const body = clone(changed);
  delete body.process_deal_fact_projection_id;
  delete body.canonical_payload_digest;
  changed.process_deal_fact_projection_id = contentId(
    'PROCESS_DEAL_FACT_PROJECTION/V1',
    body,
  );
  changed.canonical_payload_digest = contentId(
    'PROCESS_DEAL_FACT_PROJECTION_PAYLOAD/V1',
    body,
  );

  assert.throws(
    () => validateProcessDealFactProjection({
      manifest: sharedManifest,
      binding,
      projection: changed,
    }),
    (error) => error.code === 'PROCESS_PROJECTION_SOURCE_MISMATCH',
  );
});
