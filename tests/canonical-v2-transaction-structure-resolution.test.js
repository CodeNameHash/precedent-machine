const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildTransactionStructureResolutionOccurrence,
  buildTransactionStructureResolutionRevision,
  validateTransactionStructureResolutionOccurrence,
  validateTransactionStructureResolutionRevision,
} = require('../lib/canonical-v2/transaction-structure-resolution');

const id = (value) => contentId('TRANSACTION_STRUCTURE_TEST/V1', value);

function occurrence(overrides = {}) {
  return buildTransactionStructureResolutionOccurrence({
    effective_time_slot: 'SIGNING_TIME',
    expected_structure_resolution_slot_key: 'PRIMARY_TRANSACTION_STRUCTURE',
    governed_deal_id: id('deal'),
    governed_ordinal: 0,
    structure_resolution_definition_and_version: {
      definition_key: 'TRANSACTION_STRUCTURE_RESOLUTION',
      definition_version: 1,
    },
    ...overrides,
  });
}

function participant(roleCode, ordinal, roleLayer = 'TRANSACTION_ROLE') {
  return {
    deal_participant_relationship_revision_id: id(
      `${roleLayer}-${roleCode}-${ordinal}`,
    ),
    role_code: roleCode,
    role_layer: roleLayer,
  };
}

function leg(resolvedLegType, sequenceOrdinal, label = resolvedLegType) {
  return {
    resolved_leg_type: resolvedLegType,
    sequence_ordinal: sequenceOrdinal,
    terminal_eligible: true,
    transaction_leg_resolution_occurrence_id: id(`leg-occurrence-${label}`),
    transaction_leg_resolution_revision_id: id(`leg-revision-${label}`),
  };
}

function characterisation(characterisationCode, evidenceId, label) {
  return {
    canonical_deal_fact_projection_revision_id: id(
      `characterisation-${label}`,
    ),
    characterisation_code: characterisationCode,
    exact_source_language_evidence_ids: [evidenceId],
  };
}

const fixtures = [
  {
    name: 'direct merger',
    legal_structure_code: 'DIRECT_MERGER',
    legs: [leg('DIRECT_MERGER', 0, 'direct')],
    participants: [
      participant('BUYER', 0),
      participant('TARGET', 0),
    ],
  },
  {
    name: 'forward triangular merger',
    legal_structure_code: 'FORWARD_TRIANGULAR_MERGER',
    legs: [leg('FORWARD_TRIANGULAR_MERGER', 0, 'forward')],
    participants: [
      participant('BUYER', 1),
      participant('TARGET', 1),
      participant('MERGER_SUB', 1, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'reverse triangular merger',
    legal_structure_code: 'REVERSE_TRIANGULAR_MERGER',
    legs: [leg('REVERSE_TRIANGULAR_MERGER', 0, 'reverse-triangular')],
    participants: [
      participant('BUYER', 2),
      participant('TARGET', 2),
      participant('MERGER_SUB', 2, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'merger of equals',
    legal_structure_code: 'NEW_HOLDCO_COMBINATION',
    legs: [
      leg('NEW_HOLDCO_FORMATION', 0, 'moe-holdco'),
      leg('DIRECT_MERGER', 1, 'moe-merger'),
    ],
    participants: [
      participant('COMBINATION_PARTY', 30),
      participant('COMBINATION_PARTY', 31),
      participant('NEW_HOLDCO', 3, 'LEGAL_DOCUMENT_ROLE'),
    ],
    characterisation_code: 'MERGER_OF_EQUALS_STATED',
  },
  {
    name: 'reverse merger',
    legal_structure_code: 'REVERSE_MERGER',
    legs: [leg('DIRECT_MERGER', 0, 'reverse-merger')],
    participants: [
      participant('COMBINATION_PARTY', 40),
      participant('COMBINATION_PARTY', 41),
      participant('SURVIVING_ENTITY', 4, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'Reverse Morris Trust',
    legal_structure_code: 'REVERSE_MORRIS_TRUST',
    legs: [
      leg('DISTRIBUTION_OR_SPIN_OFF', 0, 'rmt-distribution'),
      leg('CONTRIBUTION', 1, 'rmt-contribution'),
      leg('REVERSE_TRIANGULAR_MERGER', 2, 'rmt-merger'),
    ],
    participants: [
      participant('DIVESTING_PARENT', 5),
      participant('CONTRIBUTING_PARTY', 5),
      participant('MERGER_COUNTERPARTY', 5),
      participant('SPINCO', 5, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'tender offer and second-step merger',
    legal_structure_code: 'TENDER_OFFER_WITH_SECOND_STEP_MERGER',
    legs: [
      leg('TENDER_OFFER', 0, 'tender'),
      leg('SECOND_STEP_MERGER', 1, 'second-step'),
    ],
    participants: [
      participant('BIDDER', 6),
      participant('TARGET', 6),
    ],
  },
  {
    name: 'new holdco stock combination',
    legal_structure_code: 'NEW_HOLDCO_COMBINATION',
    legs: [
      leg('NEW_HOLDCO_FORMATION', 0, 'holdco-formation'),
      leg('SHARE_EXCHANGE', 1, 'holdco-share-exchange'),
    ],
    participants: [
      participant('COMBINATION_PARTY', 70),
      participant('COMBINATION_PARTY', 71),
      participant('NEW_HOLDCO', 7, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'stock-for-stock exchange',
    legal_structure_code: 'SHARE_EXCHANGE',
    legs: [leg('SHARE_EXCHANGE', 0, 'stock-for-stock')],
    participants: [
      participant('COMBINATION_PARTY', 80),
      participant('COMBINATION_PARTY', 81),
    ],
  },
  {
    name: 'spin-merge',
    legal_structure_code: 'SPIN_MERGE',
    legs: [
      leg('DISTRIBUTION_OR_SPIN_OFF', 0, 'spin-merge-spin'),
      leg('DIRECT_MERGER', 1, 'spin-merge-merger'),
    ],
    participants: [
      participant('DIVESTING_PARENT', 9),
      participant('CONTRIBUTING_PARTY', 9),
      participant('MERGER_COUNTERPARTY', 9),
    ],
  },
  {
    name: 'share purchase',
    legal_structure_code: 'SHARE_PURCHASE',
    legs: [leg('SHARE_PURCHASE', 0, 'share-purchase')],
    participants: [
      participant('BUYER', 10),
      participant('ACQUIRED_ENTITY', 10),
      participant('SELLING_SHAREHOLDER', 10),
    ],
  },
  {
    name: 'asset acquisition',
    legal_structure_code: 'ASSET_ACQUISITION',
    legs: [leg('ASSET_TRANSFER', 0, 'asset-acquisition')],
    participants: [
      participant('BUYER', 11),
      participant('ACQUIRED_BUSINESS', 11),
      participant('SELLER', 11, 'LEGAL_DOCUMENT_ROLE'),
    ],
  },
  {
    name: 'de-SPAC',
    legal_structure_code: 'DE_SPAC',
    legs: [leg('DIRECT_MERGER', 0, 'de-spac')],
    participants: [
      participant('SPONSOR', 12),
      participant('COMBINATION_PARTY', 12),
    ],
  },
  {
    name: 'sponsor consortium',
    legal_structure_code: 'DE_SPAC',
    legs: [leg('DIRECT_MERGER', 0, 'sponsor-consortium')],
    participants: [
      participant('SPONSOR', 13),
      participant('CONSORTIUM_MEMBER', 13),
      participant('COMBINATION_PARTY', 13),
    ],
  },
  {
    name: 'joint venture combination',
    legal_structure_code: 'JOINT_VENTURE_COMBINATION',
    legs: [leg('CONTRIBUTION', 0, 'joint-venture')],
    participants: [
      participant('COMBINATION_PARTY', 140),
      participant('COMBINATION_PARTY', 141),
    ],
  },
];

function revisionForFixture(fixture, overrides = {}) {
  const evidenceId = id(`evidence-${fixture.name}`);
  const structureOccurrence = occurrence();
  const characterisations = fixture.characterisation_code
    ? [characterisation(
      fixture.characterisation_code,
      evidenceId,
      fixture.name,
    )]
    : [];
  return buildTransactionStructureResolutionRevision({
    transaction_structure_resolution_occurrence: structureOccurrence,
    conflict_disposition: 'CLEAR',
    evidence_edges: [evidenceId],
    legal_structure_code: fixture.legal_structure_code,
    participant_relationship_revisions: fixture.participants,
    resolver_version: 'transaction-structure-resolver/v1',
    source_characterisation_fact_resolutions: characterisations,
    state: { code: 'PRESENT' },
    transaction_leg_resolution_revisions: fixture.legs,
    ...overrides,
  });
}

test('all approved transaction structures resolve from separate legs and correct roles', () => {
  fixtures.forEach((fixture) => {
    const revision = revisionForFixture(fixture);
    assert.equal(revision.legal_structure_code, fixture.legal_structure_code);
    assert.equal(revision.terminal_eligible, true);
  });
});

test('every approved structure fails closed when a required role is removed', () => {
  fixtures.forEach((fixture) => {
    assert.throws(() => revisionForFixture(fixture, {
      participant_relationship_revisions: fixture.participants.slice(1),
    }), (error) => error.code === 'TRANSACTION_STRUCTURE_ROLE_MISMATCH');
  });
});

test('structure occurrences are deterministic and exclude value fields', () => {
  const structureOccurrence = occurrence();
  assert.equal(validateTransactionStructureResolutionOccurrence(structureOccurrence), true);
  assert.equal(canonicalJson(structureOccurrence), canonicalJson(occurrence()));
  assert.throws(() => occurrence({ legal_structure_code: 'DIRECT_MERGER' }),
    (error) => error.code === 'INVALID_TRANSACTION_STRUCTURE');
  assert.throws(() => occurrence({ participant_name: 'Example Corp.' }),
    (error) => error.code === 'INVALID_TRANSACTION_STRUCTURE');
});

test('merger-of-equals characterisation requires exact source language evidence', () => {
  const fixture = fixtures.find((item) => item.name === 'merger of equals');
  const evidenceId = id('evidence-merger of equals');
  assert.throws(() => revisionForFixture(fixture, {
    source_characterisation_fact_resolutions: [{
      canonical_deal_fact_projection_revision_id: id('moe-characterisation'),
      characterisation_code: 'MERGER_OF_EQUALS_STATED',
      exact_source_language_evidence_ids: [],
    }],
  }), (error) => error.code === 'UNBOUND_TRANSACTION_CHARACTERISATION_EVIDENCE');
  assert.throws(() => revisionForFixture(fixture, {
    source_characterisation_fact_resolutions: [{
      canonical_deal_fact_projection_revision_id: id('moe-characterisation'),
      characterisation_code: 'MERGER_OF_EQUALS_STATED',
      exact_source_language_evidence_ids: [id('different-evidence')],
    }],
    evidence_edges: [evidenceId],
  }), (error) => error.code === 'UNBOUND_TRANSACTION_CHARACTERISATION_EVIDENCE');
});

test('merger-of-equals characterisation does not hide required legal roles', () => {
  const fixture = fixtures.find(
    (item) => item.name === 'forward triangular merger',
  );
  const evidenceId = id('moe-forward-evidence');
  assert.throws(() => revisionForFixture(fixture, {
    evidence_edges: [evidenceId],
    participant_relationship_revisions: [
      participant('COMBINATION_PARTY', 200),
      participant('COMBINATION_PARTY', 201),
    ],
    source_characterisation_fact_resolutions: [
      characterisation('MERGER_OF_EQUALS_STATED', evidenceId, 'moe-forward'),
    ],
  }), (error) => error.code === 'TRANSACTION_STRUCTURE_ROLE_MISMATCH');
});

test('Reverse Morris Trust and tender structures cannot collapse their leg sequences', () => {
  const rmt = fixtures.find((item) => item.name === 'Reverse Morris Trust');
  const tender = fixtures.find(
    (item) => item.name === 'tender offer and second-step merger',
  );
  assert.throws(() => revisionForFixture(rmt, {
    transaction_leg_resolution_revisions: [
      rmt.legs[0],
      rmt.legs[2],
    ],
  }), (error) => error.code === 'TRANSACTION_STRUCTURE_LEG_MISMATCH');
  assert.throws(() => revisionForFixture(tender, {
    transaction_leg_resolution_revisions: [tender.legs[0]],
  }), (error) => error.code === 'TRANSACTION_STRUCTURE_LEG_MISMATCH');
});

test('reverse merger and new holdco structures do not require or infer a buyer role', () => {
  const reverse = revisionForFixture(
    fixtures.find((item) => item.name === 'reverse merger'),
  );
  const newHoldco = revisionForFixture(
    fixtures.find((item) => item.name === 'new holdco stock combination'),
  );
  [reverse, newHoldco].forEach((revision) => {
    assert.equal(revision.participant_relationship_revisions.some(
      (participantRef) => participantRef.role_code === 'BUYER',
    ), false);
  });
});

test('share purchase cannot use an asset-transfer leg', () => {
  const fixture = fixtures.find((item) => item.name === 'share purchase');
  assert.throws(() => revisionForFixture(fixture, {
    transaction_leg_resolution_revisions: [
      leg('ASSET_TRANSFER', 0, 'false-share-purchase'),
    ],
  }), (error) => error.code === 'TRANSACTION_STRUCTURE_LEG_MISMATCH');
});

test('blocked or duplicate legs cannot become a terminal structure', () => {
  const fixture = fixtures[0];
  assert.throws(() => revisionForFixture(fixture, {
    transaction_leg_resolution_revisions: [{
      ...fixture.legs[0],
      terminal_eligible: false,
    }],
  }), (error) => error.code === 'TRANSACTION_STRUCTURE_LEG_MISMATCH');
  assert.throws(() => revisionForFixture(fixture, {
    transaction_leg_resolution_revisions: [
      fixture.legs[0],
      { ...fixture.legs[0], sequence_ordinal: 1 },
    ],
  }), (error) => error.code === 'DUPLICATE_TRANSACTION_STRUCTURE_INPUT');
});

test('validators reject a stale structure revision', () => {
  const structureOccurrence = occurrence();
  const revision = revisionForFixture(fixtures[0], {
    transaction_structure_resolution_occurrence: structureOccurrence,
  });
  assert.equal(validateTransactionStructureResolutionRevision({
    revision,
    transaction_structure_resolution_occurrence: structureOccurrence,
  }), true);
  assert.throws(() => validateTransactionStructureResolutionRevision({
    revision: {
      ...structuredClone(revision),
      transaction_structure_resolution_revision_id: id('stale-structure'),
    },
    transaction_structure_resolution_occurrence: structureOccurrence,
  }), (error) => error.code === 'STALE_TRANSACTION_STRUCTURE_REVISION');
});
