const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  LEGAL_ROLES,
  ROLE_LAYERS,
  TRANSACTION_ROLES,
} = require('./deal-participant-relationship');
const { LEG_TYPES } = require('./transaction-leg');

const TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE_SCHEMA_VERSION =
  'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE/V1';
const TRANSACTION_STRUCTURE_RESOLUTION_REVISION_SCHEMA_VERSION =
  'TRANSACTION_STRUCTURE_RESOLUTION_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const STRUCTURE_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const STRUCTURE_CONFLICT_DISPOSITIONS = Object.freeze([
  'CLEAR',
  'CONFLICTING',
  'INCOMPLETE_LEGS',
  'UNRESOLVED_PARTICIPANT_ROLE',
]);
const LEGAL_STRUCTURE_CODES = Object.freeze([
  'DIRECT_MERGER',
  'FORWARD_TRIANGULAR_MERGER',
  'REVERSE_TRIANGULAR_MERGER',
  'REVERSE_MERGER',
  'REVERSE_MORRIS_TRUST',
  'TENDER_OFFER_WITH_SECOND_STEP_MERGER',
  'NEW_HOLDCO_COMBINATION',
  'SHARE_PURCHASE',
  'ASSET_ACQUISITION',
  'SHARE_EXCHANGE',
  'SPIN_MERGE',
  'DE_SPAC',
  'JOINT_VENTURE_COMBINATION',
  'OTHER_REVIEWED_STRUCTURE',
]);
const CHARACTERISATION_CODES = Object.freeze([
  'ACQUISITION',
  'MERGER_OF_EQUALS_STATED',
  'COMBINATION',
  'STRATEGIC_MERGER',
  'DIVESTITURE',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'effective_time_slot',
  'expected_structure_resolution_slot_key',
  'governed_deal_id',
  'governed_ordinal',
  'structure_resolution_definition_and_version',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'transaction_structure_resolution_occurrence_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'transaction_structure_resolution_occurrence',
  'conflict_disposition',
  'evidence_edges',
  'legal_structure_code',
  'participant_relationship_revisions',
  'resolver_version',
  'source_characterisation_fact_resolutions',
  'state',
  'transaction_leg_resolution_revisions',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'transaction_structure_resolution_revision_id',
  'transaction_structure_resolution_occurrence_id',
  'characterisation_codes',
  'conflict_disposition',
  'evidence_edges',
  'legal_structure_code',
  'participant_relationship_revisions',
  'resolver_version',
  'source_characterisation_fact_resolutions',
  'state',
  'terminal_eligible',
  'transaction_leg_resolution_revisions',
]);
const PARTICIPANT_REF_KEYS = Object.freeze([
  'deal_participant_relationship_revision_id',
  'role_code',
  'role_layer',
]);
const LEG_REF_KEYS = Object.freeze([
  'resolved_leg_type',
  'sequence_ordinal',
  'terminal_eligible',
  'transaction_leg_resolution_occurrence_id',
  'transaction_leg_resolution_revision_id',
]);
const CHARACTERISATION_REF_KEYS = Object.freeze([
  'canonical_deal_fact_projection_revision_id',
  'characterisation_code',
  'exact_source_language_evidence_ids',
]);

class TransactionStructureResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TransactionStructureResolutionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new TransactionStructureResolutionError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_TRANSACTION_STRUCTURE', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      `${label} fields do not match the closed contract.`,
      { label },
    );
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_TRANSACTION_STRUCTURE', `${label} must be a SHA-256 content ID.`, {
      label,
    });
  }
  return value;
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail('INVALID_TRANSACTION_STRUCTURE', `${label} must be a governed uppercase key.`, {
      label,
    });
  }
  return value;
}

function requireText(value, label, maximumBytes = 256) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail('INVALID_TRANSACTION_STRUCTURE', `${label} must be bounded, trimmed text.`, {
      label,
    });
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_STRUCTURE', `${label} must be an array.`);
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_STRUCTURE_INPUT', `${label} contains a duplicate.`);
  }
  return selected;
}

function normaliseDefinition(value) {
  requireExactKeys(
    value,
    ['definition_key', 'definition_version'],
    'structure_resolution_definition_and_version',
  );
  if (!Number.isSafeInteger(value.definition_version) || value.definition_version < 1) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      'structure_resolution_definition_and_version.definition_version must be positive.',
    );
  }
  return {
    definition_key: requireGovernedKey(
      value.definition_key,
      'structure_resolution_definition_and_version.definition_key',
    ),
    definition_version: value.definition_version,
  };
}

function normaliseState(value) {
  requireObject(value, 'state');
  if (!STRUCTURE_STATES.includes(value.code)) {
    fail('INVALID_TRANSACTION_STRUCTURE_STATE', 'state.code is not governed.');
  }
  const keysByCode = {
    PRESENT: ['code'],
    ABSENT: ['code', 'complete_scope_id'],
    NOT_APPLICABLE: ['code', 'applicability_evidence_ids'],
    NOT_EXAMINED: ['code', 'reason'],
    FAILED: ['code', 'failure_code', 'attempted_resolver'],
  };
  requireExactKeys(value, keysByCode[value.code], 'state');
  if (value.code === 'ABSENT') {
    return {
      code: value.code,
      complete_scope_id: requireDigest(value.complete_scope_id, 'state.complete_scope_id'),
    };
  }
  if (value.code === 'NOT_APPLICABLE') {
    const evidenceIds = uniqueSortedDigests(
      value.applicability_evidence_ids,
      'state.applicability_evidence_ids',
    );
    if (evidenceIds.length === 0) {
      fail('INVALID_TRANSACTION_STRUCTURE_STATE', 'NOT_APPLICABLE requires evidence.');
    }
    return { code: value.code, applicability_evidence_ids: evidenceIds };
  }
  if (value.code === 'NOT_EXAMINED') {
    return { code: value.code, reason: requireText(value.reason, 'state.reason') };
  }
  if (value.code === 'FAILED') {
    return {
      code: value.code,
      failure_code: requireGovernedKey(value.failure_code, 'state.failure_code'),
      attempted_resolver: requireText(
        value.attempted_resolver,
        'state.attempted_resolver',
      ),
    };
  }
  return { code: value.code };
}

function normaliseParticipantRefs(values) {
  if (!Array.isArray(values)) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      'participant_relationship_revisions must be an array.',
    );
  }
  const selected = values.map((value, index) => {
    const label = `participant_relationship_revisions[${index}]`;
    requireExactKeys(value, PARTICIPANT_REF_KEYS, label);
    if (!ROLE_LAYERS.includes(value.role_layer)) {
      fail('INVALID_TRANSACTION_STRUCTURE_ROLE', `${label}.role_layer is not governed.`);
    }
    const roles = value.role_layer === 'LEGAL_DOCUMENT_ROLE'
      ? LEGAL_ROLES
      : TRANSACTION_ROLES;
    if (!roles.includes(value.role_code)) {
      fail(
        'INVALID_TRANSACTION_STRUCTURE_ROLE',
        `${value.role_code} is not permitted in ${value.role_layer}.`,
      );
    }
    return {
      deal_participant_relationship_revision_id: requireDigest(
        value.deal_participant_relationship_revision_id,
        `${label}.deal_participant_relationship_revision_id`,
      ),
      role_code: value.role_code,
      role_layer: value.role_layer,
    };
  }).sort((left, right) => (
    left.deal_participant_relationship_revision_id
      .localeCompare(right.deal_participant_relationship_revision_id)
  ));
  if (new Set(selected.map(
    (item) => item.deal_participant_relationship_revision_id,
  )).size !== selected.length) {
    fail(
      'DUPLICATE_TRANSACTION_STRUCTURE_INPUT',
      'participant_relationship_revisions contains a duplicate revision.',
    );
  }
  return selected;
}

function normaliseLegRefs(values) {
  if (!Array.isArray(values)) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      'transaction_leg_resolution_revisions must be an array.',
    );
  }
  const selected = values.map((value, index) => {
    const label = `transaction_leg_resolution_revisions[${index}]`;
    requireExactKeys(value, LEG_REF_KEYS, label);
    if (!LEG_TYPES.includes(value.resolved_leg_type)) {
      fail(
        'INVALID_TRANSACTION_STRUCTURE_LEG',
        `${label}.resolved_leg_type is not governed.`,
      );
    }
    if (!Number.isSafeInteger(value.sequence_ordinal) || value.sequence_ordinal < 0) {
      fail(
        'INVALID_TRANSACTION_STRUCTURE_LEG',
        `${label}.sequence_ordinal must be a non-negative safe integer.`,
      );
    }
    if (typeof value.terminal_eligible !== 'boolean') {
      fail(
        'INVALID_TRANSACTION_STRUCTURE_LEG',
        `${label}.terminal_eligible must be boolean.`,
      );
    }
    return {
      resolved_leg_type: value.resolved_leg_type,
      sequence_ordinal: value.sequence_ordinal,
      terminal_eligible: value.terminal_eligible,
      transaction_leg_resolution_occurrence_id: requireDigest(
        value.transaction_leg_resolution_occurrence_id,
        `${label}.transaction_leg_resolution_occurrence_id`,
      ),
      transaction_leg_resolution_revision_id: requireDigest(
        value.transaction_leg_resolution_revision_id,
        `${label}.transaction_leg_resolution_revision_id`,
      ),
    };
  }).sort((left, right) => (
    left.sequence_ordinal - right.sequence_ordinal
      || left.transaction_leg_resolution_revision_id
        .localeCompare(right.transaction_leg_resolution_revision_id)
  ));
  if (new Set(selected.map(
    (item) => item.transaction_leg_resolution_occurrence_id,
  )).size !== selected.length
    || new Set(selected.map(
      (item) => item.transaction_leg_resolution_revision_id,
    )).size !== selected.length
    || new Set(selected.map(
      (item) => item.sequence_ordinal,
    )).size !== selected.length) {
    fail(
      'DUPLICATE_TRANSACTION_STRUCTURE_INPUT',
      'transaction_leg_resolution_revisions contains a duplicate occurrence, revision, or sequence ordinal.',
    );
  }
  return selected;
}

function normaliseCharacterisationRefs(values, evidenceEdges) {
  if (!Array.isArray(values)) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      'source_characterisation_fact_resolutions must be an array.',
    );
  }
  const selected = values.map((value, index) => {
    const label = `source_characterisation_fact_resolutions[${index}]`;
    requireExactKeys(value, CHARACTERISATION_REF_KEYS, label);
    if (!CHARACTERISATION_CODES.includes(value.characterisation_code)) {
      fail(
        'INVALID_TRANSACTION_CHARACTERISATION',
        `${label}.characterisation_code is not governed.`,
      );
    }
    const exactEvidenceIds = uniqueSortedDigests(
      value.exact_source_language_evidence_ids,
      `${label}.exact_source_language_evidence_ids`,
    );
    if (exactEvidenceIds.length === 0
      || exactEvidenceIds.some((id) => !evidenceEdges.includes(id))) {
      fail(
        'UNBOUND_TRANSACTION_CHARACTERISATION_EVIDENCE',
        'Each source characterisation requires exact evidence in the structure evidence set.',
      );
    }
    return {
      canonical_deal_fact_projection_revision_id: requireDigest(
        value.canonical_deal_fact_projection_revision_id,
        `${label}.canonical_deal_fact_projection_revision_id`,
      ),
      characterisation_code: value.characterisation_code,
      exact_source_language_evidence_ids: exactEvidenceIds,
    };
  }).sort((left, right) => (
    left.canonical_deal_fact_projection_revision_id
      .localeCompare(right.canonical_deal_fact_projection_revision_id)
  ));
  if (new Set(selected.map(
    (item) => item.canonical_deal_fact_projection_revision_id,
  )).size !== selected.length) {
    fail(
      'DUPLICATE_TRANSACTION_STRUCTURE_INPUT',
      'source_characterisation_fact_resolutions contains a duplicate revision.',
    );
  }
  return selected;
}

function roleCount(participants, roleLayer, roleCode) {
  return participants.filter(
    (participant) => participant.role_layer === roleLayer
      && participant.role_code === roleCode,
  ).length;
}

function requireRoles(participants, requirements, legalStructureCode) {
  const missing = requirements.filter((requirement) => (
    roleCount(participants, requirement.role_layer, requirement.role_code)
      < (requirement.minimum || 1)
  ));
  if (missing.length > 0) {
    fail(
      'TRANSACTION_STRUCTURE_ROLE_MISMATCH',
      `${legalStructureCode} does not have its required participant roles.`,
      { missing },
    );
  }
}

function requireLegGroups(legs, groups, legalStructureCode) {
  let previousIndex = -1;
  groups.forEach((group) => {
    const nextIndex = legs.findIndex(
      (leg, index) => index > previousIndex && group.includes(leg.resolved_leg_type),
    );
    if (nextIndex === -1) {
      fail(
        'TRANSACTION_STRUCTURE_LEG_MISMATCH',
        `${legalStructureCode} does not have its required separate leg sequence.`,
        { required_group: group },
      );
    }
    previousIndex = nextIndex;
  });
}

function validateStructurePattern({
  characterisationCodes,
  legalStructureCode,
  legs,
  participants,
}) {
  if (legs.length === 0 || legs.some((leg) => leg.terminal_eligible !== true)) {
    fail(
      'TRANSACTION_STRUCTURE_LEG_MISMATCH',
      'A clear structure requires at least one terminal eligible transaction leg.',
    );
  }

  const mergerTypes = [
    'DIRECT_MERGER',
    'FORWARD_TRIANGULAR_MERGER',
    'REVERSE_TRIANGULAR_MERGER',
    'OTHER_GOVERNED_STEP',
  ];
  const legGroupsByStructure = {
    DIRECT_MERGER: [['DIRECT_MERGER']],
    FORWARD_TRIANGULAR_MERGER: [['FORWARD_TRIANGULAR_MERGER']],
    REVERSE_TRIANGULAR_MERGER: [['REVERSE_TRIANGULAR_MERGER']],
    REVERSE_MERGER: [[
      'DIRECT_MERGER',
      'FORWARD_TRIANGULAR_MERGER',
      'REVERSE_TRIANGULAR_MERGER',
      'SHARE_EXCHANGE',
      'OTHER_GOVERNED_STEP',
    ]],
    REVERSE_MORRIS_TRUST: [
      ['DISTRIBUTION_OR_SPIN_OFF'],
      ['CONTRIBUTION', 'OTHER_GOVERNED_STEP'],
      mergerTypes,
    ],
    TENDER_OFFER_WITH_SECOND_STEP_MERGER: [
      ['TENDER_OFFER'],
      ['SECOND_STEP_MERGER'],
    ],
    NEW_HOLDCO_COMBINATION: [
      ['NEW_HOLDCO_FORMATION'],
      [...mergerTypes, 'SHARE_EXCHANGE'],
    ],
    SHARE_PURCHASE: [['SHARE_PURCHASE']],
    ASSET_ACQUISITION: [['ASSET_TRANSFER']],
    SHARE_EXCHANGE: [['SHARE_EXCHANGE']],
    SPIN_MERGE: [
      ['DISTRIBUTION_OR_SPIN_OFF'],
      mergerTypes,
    ],
    DE_SPAC: [[...mergerTypes, 'SHARE_EXCHANGE']],
    JOINT_VENTURE_COMBINATION: [[
      'CONTRIBUTION',
      'SHARE_EXCHANGE',
      'OTHER_GOVERNED_STEP',
    ]],
    OTHER_REVIEWED_STRUCTURE: [LEG_TYPES],
  };
  requireLegGroups(
    legs,
    legGroupsByStructure[legalStructureCode],
    legalStructureCode,
  );

  const transaction = (roleCode, minimum = 1) => ({
    role_layer: 'TRANSACTION_ROLE',
    role_code: roleCode,
    minimum,
  });
  const legal = (roleCode, minimum = 1) => ({
    role_layer: 'LEGAL_DOCUMENT_ROLE',
    role_code: roleCode,
    minimum,
  });
  const roleRequirementsByStructure = {
    DIRECT_MERGER: [transaction('BUYER'), transaction('TARGET')],
    FORWARD_TRIANGULAR_MERGER: [
      transaction('BUYER'),
      transaction('TARGET'),
      legal('MERGER_SUB'),
    ],
    REVERSE_TRIANGULAR_MERGER: [
      transaction('BUYER'),
      transaction('TARGET'),
      legal('MERGER_SUB'),
    ],
    REVERSE_MERGER: [
      transaction('COMBINATION_PARTY', 2),
      legal('SURVIVING_ENTITY'),
    ],
    REVERSE_MORRIS_TRUST: [
      transaction('DIVESTING_PARENT'),
      transaction('CONTRIBUTING_PARTY'),
      transaction('MERGER_COUNTERPARTY'),
      legal('SPINCO'),
    ],
    TENDER_OFFER_WITH_SECOND_STEP_MERGER: [
      transaction('BIDDER'),
      transaction('TARGET'),
    ],
    NEW_HOLDCO_COMBINATION: [
      transaction('COMBINATION_PARTY', 2),
      legal('NEW_HOLDCO'),
    ],
    SHARE_PURCHASE: [
      transaction('BUYER'),
      transaction('ACQUIRED_ENTITY'),
      transaction('SELLING_SHAREHOLDER'),
    ],
    ASSET_ACQUISITION: [
      transaction('BUYER'),
      transaction('ACQUIRED_BUSINESS'),
      legal('SELLER'),
    ],
    SHARE_EXCHANGE: [transaction('COMBINATION_PARTY', 2)],
    SPIN_MERGE: [
      transaction('DIVESTING_PARENT'),
      transaction('CONTRIBUTING_PARTY'),
      transaction('MERGER_COUNTERPARTY'),
    ],
    DE_SPAC: [transaction('SPONSOR'), transaction('COMBINATION_PARTY')],
    JOINT_VENTURE_COMBINATION: [transaction('COMBINATION_PARTY', 2)],
    OTHER_REVIEWED_STRUCTURE: [],
  };

  let roleRequirements = roleRequirementsByStructure[legalStructureCode];
  if (characterisationCodes.includes('MERGER_OF_EQUALS_STATED')) {
    roleRequirements = [
      transaction('COMBINATION_PARTY', 2),
      ...roleRequirements.filter((requirement) => !(
        requirement.role_layer === 'TRANSACTION_ROLE'
        && ['BUYER', 'TARGET'].includes(requirement.role_code)
      )),
    ];
    requireRoles(
      participants,
      roleRequirements,
      'MERGER_OF_EQUALS_STATED',
    );
  } else {
    requireRoles(
      participants,
      roleRequirements,
      legalStructureCode,
    );
  }
  if (legalStructureCode === 'OTHER_REVIEWED_STRUCTURE'
    && participants.filter(
      (participant) => participant.role_layer === 'TRANSACTION_ROLE',
    ).length < 2) {
    fail(
      'TRANSACTION_STRUCTURE_ROLE_MISMATCH',
      'OTHER_REVIEWED_STRUCTURE requires at least two transaction participants.',
    );
  }
}

function buildTransactionStructureResolutionOccurrence(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'transaction structure input');
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE',
      'governed_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    effective_time_slot: requireGovernedKey(
      input.effective_time_slot,
      'effective_time_slot',
    ),
    expected_structure_resolution_slot_key: requireGovernedKey(
      input.expected_structure_resolution_slot_key,
      'expected_structure_resolution_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_ordinal: input.governed_ordinal,
    structure_resolution_definition_and_version: normaliseDefinition(
      input.structure_resolution_definition_and_version,
    ),
  };
  return deepFreeze({
    schema_version: TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE_SCHEMA_VERSION,
    transaction_structure_resolution_occurrence_id: contentId(
      'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE/V1',
      body,
    ),
    ...body,
  });
}

function validateTransactionStructureResolutionOccurrence(occurrence) {
  requireExactKeys(occurrence, OCCURRENCE_KEYS, 'transaction structure occurrence');
  const rebuilt = buildTransactionStructureResolutionOccurrence({
    effective_time_slot: occurrence.effective_time_slot,
    expected_structure_resolution_slot_key:
      occurrence.expected_structure_resolution_slot_key,
    governed_deal_id: occurrence.governed_deal_id,
    governed_ordinal: occurrence.governed_ordinal,
    structure_resolution_definition_and_version:
      occurrence.structure_resolution_definition_and_version,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(occurrence)) {
    fail(
      'STALE_TRANSACTION_STRUCTURE_OCCURRENCE',
      'Transaction structure occurrence identity or content is stale.',
    );
  }
  return true;
}

function buildTransactionStructureResolutionRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'transaction structure revision input');
  validateTransactionStructureResolutionOccurrence(
    input.transaction_structure_resolution_occurrence,
  );
  const occurrence = input.transaction_structure_resolution_occurrence;
  const state = normaliseState(input.state);
  if (!STRUCTURE_CONFLICT_DISPOSITIONS.includes(input.conflict_disposition)) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE_CONFLICT',
      'conflict_disposition is not governed.',
    );
  }
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const participants = normaliseParticipantRefs(
    input.participant_relationship_revisions,
  );
  const legs = normaliseLegRefs(input.transaction_leg_resolution_revisions);
  const characterisations = normaliseCharacterisationRefs(
    input.source_characterisation_fact_resolutions,
    evidenceEdges,
  );
  const characterisationCodes = [...new Set(
    characterisations.map((item) => item.characterisation_code),
  )].sort();
  const isPresent = state.code === 'PRESENT';
  const legalStructureCode = input.legal_structure_code;
  const terminalEligible = isPresent && input.conflict_disposition === 'CLEAR';

  if (isPresent && !LEGAL_STRUCTURE_CODES.includes(legalStructureCode)) {
    fail(
      'INVALID_TRANSACTION_STRUCTURE_CODE',
      'legal_structure_code is not governed.',
    );
  }
  if (isPresent && evidenceEdges.length === 0) {
    fail(
      'TRANSACTION_STRUCTURE_EVIDENCE_REQUIRED',
      'A present transaction structure requires exact evidence.',
    );
  }
  if (terminalEligible) {
    validateStructurePattern({
      characterisationCodes,
      legalStructureCode,
      legs,
      participants,
    });
  }
  if (!isPresent && (
    legalStructureCode !== null
    || participants.length !== 0
    || legs.length !== 0
    || characterisations.length !== 0
    || input.conflict_disposition !== 'CLEAR'
  )) {
    fail(
      'NON_PRESENT_TRANSACTION_STRUCTURE_VALUE',
      'A non-present transaction structure cannot assert structure values.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail(
      'TRANSACTION_STRUCTURE_EVIDENCE_REQUIRED',
      `${state.code} requires exact evidence.`,
    );
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_TRANSACTION_STRUCTURE_EVIDENCE',
      'Applicability evidence must be in the structure evidence set.',
    );
  }

  const body = {
    characterisation_codes: characterisationCodes,
    conflict_disposition: input.conflict_disposition,
    evidence_edges: evidenceEdges,
    legal_structure_code: legalStructureCode,
    participant_relationship_revisions: participants,
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    source_characterisation_fact_resolutions: characterisations,
    state,
    terminal_eligible: terminalEligible,
    transaction_leg_resolution_revisions: legs,
    transaction_structure_resolution_occurrence_id:
      occurrence.transaction_structure_resolution_occurrence_id,
  };
  return deepFreeze({
    schema_version: TRANSACTION_STRUCTURE_RESOLUTION_REVISION_SCHEMA_VERSION,
    transaction_structure_resolution_revision_id: contentId(
      'TRANSACTION_STRUCTURE_RESOLUTION_REVISION/V1',
      body,
    ),
    ...body,
  });
}

function validateTransactionStructureResolutionRevision({
  revision,
  transaction_structure_resolution_occurrence: occurrence,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'transaction structure resolution revision');
  validateTransactionStructureResolutionOccurrence(occurrence);
  if (revision.transaction_structure_resolution_occurrence_id
    !== occurrence.transaction_structure_resolution_occurrence_id) {
    fail(
      'STALE_TRANSACTION_STRUCTURE_REVISION',
      'Revision refers to another structure occurrence.',
    );
  }
  const rebuilt = buildTransactionStructureResolutionRevision({
    transaction_structure_resolution_occurrence: occurrence,
    conflict_disposition: revision.conflict_disposition,
    evidence_edges: revision.evidence_edges,
    legal_structure_code: revision.legal_structure_code,
    participant_relationship_revisions: revision.participant_relationship_revisions,
    resolver_version: revision.resolver_version,
    source_characterisation_fact_resolutions:
      revision.source_characterisation_fact_resolutions,
    state: revision.state,
    transaction_leg_resolution_revisions:
      revision.transaction_leg_resolution_revisions,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail(
      'STALE_TRANSACTION_STRUCTURE_REVISION',
      'Transaction structure revision identity or content is stale.',
    );
  }
  return true;
}

module.exports = {
  CHARACTERISATION_CODES,
  LEGAL_STRUCTURE_CODES,
  STRUCTURE_CONFLICT_DISPOSITIONS,
  STRUCTURE_STATES,
  TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE_SCHEMA_VERSION,
  TRANSACTION_STRUCTURE_RESOLUTION_REVISION_SCHEMA_VERSION,
  TransactionStructureResolutionError,
  buildTransactionStructureResolutionOccurrence,
  buildTransactionStructureResolutionRevision,
  validateTransactionStructureResolutionOccurrence,
  validateTransactionStructureResolutionRevision,
};
