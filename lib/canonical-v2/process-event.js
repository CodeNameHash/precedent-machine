const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateProcessNarrationOccurrence,
} = require('./process-narration-occurrence');

const EVENT_IDENTITY_SCHEMA = 'PROCESS_EVENT_IDENTITY/V1';
const EVENT_SLOT_UNIVERSE_SCHEMA = 'PROCESS_EVENT_SLOT_UNIVERSE/V1';
const EVENT_ID_DOMAIN = 'PROCESS_EVENT/V1';
const EVENT_PAYLOAD_DOMAIN = 'PROCESS_EVENT_IDENTITY_PAYLOAD/V1';
const EVENT_SLOT_DOMAIN = 'PROCESS_EVENT_EXPECTED_SLOT/V1';
const EVENT_SLOT_UNIVERSE_DOMAIN = 'PROCESS_EVENT_SLOT_UNIVERSE/V1';
const EVENT_SLOT_UNIVERSE_PAYLOAD_DOMAIN =
  'PROCESS_EVENT_SLOT_UNIVERSE_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessEvent';
const MAX_EVENT_NARRATIONS = 1024;
const MAX_EVENT_CANDIDATES = 4096;
const MAX_EVENT_SET_NARRATIONS = 8192;

const EVENT_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_EVENT',
  definition_version: 1,
});

const SLOT_UNIVERSE_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'frozen_narration_occurrence_universe',
  'candidates',
]);

const EVENT_CANDIDATE_KEYS = Object.freeze([
  'process_event_slot_key',
  'event_definition_key_and_version',
  'process_narration_occurrences',
  'event_grouping_evidence_ids',
  'expected_result_slot_key',
]);

const EVENT_BUILD_INPUT_KEYS = Object.freeze([
  'frozen_event_slot_universe',
  'frozen_narration_occurrence_universe',
  'process_event_slot_key',
]);

const EVENT_SET_INPUT_KEYS = Object.freeze([
  'frozen_event_slot_universe',
  'frozen_narration_occurrence_universe',
]);

const NARRATION_REFERENCE_KEYS = Object.freeze([
  'process_narration_occurrence_id',
  'canonical_payload_digest',
  'governed_ordinal',
]);

const EVENT_SLOT_KEYS = Object.freeze([
  'process_event_slot_key',
  'event_definition_key_and_version',
  'narration_occurrence_references',
  'ordered_process_narration_occurrence_ids',
  'event_grouping_evidence_ids',
  'expected_result_slot_key',
  'governed_ordinal',
  'precomputed_process_event_id',
  'expected_slot_digest',
]);

const PROHIBITED_VALUE_INPUTS = new Set([
  'candidate_values',
  'event_date',
  'event_type_code',
  'extracted_attributes',
  'model_output',
  'participant_revision_ids',
  'selected_revision_id',
]);

const PROHIBITED_GRANULARITY_INPUTS = new Set([
  'paragraph_id',
  'paragraph_number',
  'same_date_group',
]);

const AUTHORITY_LIMITS = Object.freeze({
  runtime_event: 'NONE',
  event_revision: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  activation: 'NONE',
});

class ProcessEventError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessEventError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessEventError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      expected: required,
      actual,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  let equal = false;
  try {
    equal = canonicalJson(actual) === canonicalJson(expected);
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
  if (!equal) {
    fail(code, `${label} is not the approved value.`, { expected, actual });
  }
}

function requireSha256(value, label, code) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
  return value;
}

function requireGovernedKey(value, label, code) {
  if (
    typeof value !== 'string'
    || !/^[A-Z0-9][A-Z0-9_-]*$/.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed key.`);
  }
  return value;
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function rejectProhibitedInputs(input) {
  requireObject(input, 'Process event candidate', 'INVALID_PROCESS_EVENT_SLOT');
  const valueInputs = Object.keys(input).filter(
    (key) => PROHIBITED_VALUE_INPUTS.has(key),
  );
  if (valueInputs.length > 0) {
    fail(
      'PROCESS_EVENT_VALUE_DERIVED_IDENTITY',
      'Dates, event labels, participants, extracted values and model output cannot define ProcessEvent identity.',
      { forbidden_identity_inputs: valueInputs.sort() },
    );
  }
  const granularityInputs = Object.keys(input).filter(
    (key) => PROHIBITED_GRANULARITY_INPUTS.has(key),
  );
  if (granularityInputs.length > 0) {
    fail(
      'PROCESS_EVENT_GRANULARITY_DERIVED_IDENTITY',
      'Paragraph boundaries and same-date grouping cannot define ProcessEvent identity.',
      { forbidden_identity_inputs: granularityInputs.sort() },
    );
  }
}

function normaliseEvidenceIds(values) {
  const code = 'INVALID_PROCESS_EVENT_GROUPING_EVIDENCE';
  if (
    !Array.isArray(values)
    || values.length === 0
    || values.length > MAX_EVENT_NARRATIONS
  ) {
    fail(code, 'ProcessEvent grouping requires a bounded non-empty evidence set.');
  }
  const selected = values.map((value, index) => (
    requireSha256(value, `Process event grouping evidence ${index}`, code)
  )).sort();
  if (new Set(selected).size !== selected.length) {
    fail(code, 'ProcessEvent grouping evidence contains a duplicate.');
  }
  return selected;
}

function narrationReference(occurrence, index, frozenContractPairDigest, dealId) {
  const code = 'INVALID_PROCESS_EVENT_NARRATION_MEMBER';
  try {
    validateProcessNarrationOccurrence(occurrence);
  } catch (error) {
    fail(code, `Process event narration ${index} is invalid.`, {
      cause_code: error.code || error.name,
    });
  }
  if (
    occurrence.frozen_contract_pair_digest !== frozenContractPairDigest
    || occurrence.governed_deal_admission_id !== dealId
  ) {
    fail(
      'PROCESS_EVENT_NARRATION_SCOPE_MISMATCH',
      'Every ProcessEvent narration must bind the same frozen contract pair and admitted deal.',
    );
  }
  return {
    process_narration_occurrence_id:
      occurrence.process_narration_occurrence_id,
    canonical_payload_digest: occurrence.canonical_payload_digest,
    governed_ordinal: occurrence.governed_ordinal,
  };
}

function normaliseNarrationReferences(
  occurrences,
  frozenContractPairDigest,
  dealId,
  maximum,
) {
  const code = 'INVALID_PROCESS_EVENT_NARRATION_MEMBER';
  if (
    !Array.isArray(occurrences)
    || occurrences.length === 0
    || occurrences.length > maximum
  ) {
    fail(code, 'A ProcessEvent requires a bounded non-empty narration set.');
  }
  const references = occurrences.map((occurrence, index) => narrationReference(
    occurrence,
    index,
    frozenContractPairDigest,
    dealId,
  )).sort((left, right) => (
    left.governed_ordinal - right.governed_ordinal
      || left.process_narration_occurrence_id.localeCompare(
        right.process_narration_occurrence_id,
      )
  ));
  const ids = references.map((reference) => (
    reference.process_narration_occurrence_id
  ));
  const ordinals = references.map((reference) => reference.governed_ordinal);
  if (
    new Set(ids).size !== references.length
    || new Set(ordinals).size !== references.length
  ) {
    fail(
      'DUPLICATE_PROCESS_EVENT_NARRATION_MEMBER',
      'A ProcessEvent cannot contain a duplicate narration identity or governed narration ordinal.',
    );
  }
  return references;
}

function eventIdentity({
  frozen_contract_pair_digest: frozenContractPairDigest,
  governed_deal_admission_id: governedDealAdmissionId,
  event_definition_key_and_version: eventDefinition,
  ordered_process_narration_occurrence_ids: narrationIds,
  governed_ordinal: governedOrdinal,
}) {
  return {
    frozen_contract_pair_digest: frozenContractPairDigest,
    governed_deal_admission_id: governedDealAdmissionId,
    event_definition_key_and_version: eventDefinition,
    ordered_process_narration_occurrence_ids: narrationIds,
    governed_ordinal: governedOrdinal,
  };
}

function slotCore(slot) {
  return {
    process_event_slot_key: slot.process_event_slot_key,
    event_definition_key_and_version:
      slot.event_definition_key_and_version,
    narration_occurrence_references:
      slot.narration_occurrence_references,
    ordered_process_narration_occurrence_ids:
      slot.ordered_process_narration_occurrence_ids,
    event_grouping_evidence_ids: slot.event_grouping_evidence_ids,
    expected_result_slot_key: slot.expected_result_slot_key,
    governed_ordinal: slot.governed_ordinal,
    precomputed_process_event_id: slot.precomputed_process_event_id,
  };
}

function validateNarrationReference(reference, index) {
  const code = 'INVALID_PROCESS_EVENT_SLOT_UNIVERSE';
  requireExactKeys(
    reference,
    NARRATION_REFERENCE_KEYS,
    `Process narration reference ${index}`,
    code,
  );
  requireSha256(
    reference.process_narration_occurrence_id,
    `Process narration reference ${index} ID`,
    code,
  );
  requireSha256(
    reference.canonical_payload_digest,
    `Process narration reference ${index} payload digest`,
    code,
  );
  if (!Number.isSafeInteger(reference.governed_ordinal)
    || reference.governed_ordinal < 0) {
    fail(code, `Process narration reference ${index} ordinal is invalid.`);
  }
}

function validateSlot(slot, index, frozenContractPairDigest, dealId) {
  const code = 'INVALID_PROCESS_EVENT_SLOT_UNIVERSE';
  requireExactKeys(slot, EVENT_SLOT_KEYS, `Process event slot ${index}`, code);
  requireGovernedKey(
    slot.process_event_slot_key,
    `Process event slot ${index} key`,
    code,
  );
  requireExactValue(
    slot.event_definition_key_and_version,
    EVENT_DEFINITION,
    `Process event slot ${index} definition`,
    code,
  );
  if (
    !Array.isArray(slot.narration_occurrence_references)
    || slot.narration_occurrence_references.length === 0
    || slot.narration_occurrence_references.length > MAX_EVENT_NARRATIONS
  ) {
    fail(code, `Process event slot ${index} narration references are invalid.`);
  }
  slot.narration_occurrence_references.forEach(validateNarrationReference);
  const sortedReferences = [...slot.narration_occurrence_references].sort(
    (left, right) => (
      left.governed_ordinal - right.governed_ordinal
        || left.process_narration_occurrence_id.localeCompare(
          right.process_narration_occurrence_id,
        )
    ),
  );
  requireExactValue(
    slot.narration_occurrence_references,
    sortedReferences,
    `Process event slot ${index} narration order`,
    code,
  );
  const orderedIds = sortedReferences.map(
    (reference) => reference.process_narration_occurrence_id,
  );
  requireExactValue(
    slot.ordered_process_narration_occurrence_ids,
    orderedIds,
    `Process event slot ${index} ordered narration IDs`,
    code,
  );
  requireExactValue(
    slot.event_grouping_evidence_ids,
    normaliseEvidenceIds(slot.event_grouping_evidence_ids),
    `Process event slot ${index} grouping evidence`,
    code,
  );
  requireGovernedKey(
    slot.expected_result_slot_key,
    `Process event slot ${index} expected result slot`,
    code,
  );
  if (!Number.isSafeInteger(slot.governed_ordinal)
    || slot.governed_ordinal !== index) {
    fail(code, `Process event slot ${index} governed ordinal is invalid.`);
  }
  const identity = eventIdentity({
    frozen_contract_pair_digest: frozenContractPairDigest,
    governed_deal_admission_id: dealId,
    ...slot,
  });
  requireSha256(
    slot.precomputed_process_event_id,
    `Process event slot ${index} precomputed event ID`,
    code,
  );
  if (
    slot.precomputed_process_event_id
    !== contentId(EVENT_ID_DOMAIN, identity)
  ) {
    fail(
      'PROCESS_EVENT_SLOT_ID_MISMATCH',
      'A precomputed ProcessEvent ID does not match its exact expected slot.',
    );
  }
  if (
    slot.expected_slot_digest
    !== contentId(EVENT_SLOT_DOMAIN, slotCore(slot))
  ) {
    fail(
      'PROCESS_EVENT_SLOT_DIGEST_MISMATCH',
      'A ProcessEvent expected-slot digest is invalid.',
    );
  }
}

function freezeProcessEventSlotUniverse(input) {
  const code = 'INVALID_PROCESS_EVENT_SLOT_UNIVERSE';
  requireExactKeys(
    input,
    SLOT_UNIVERSE_INPUT_KEYS,
    'Process event slot-universe input',
    code,
  );
  const frozenContractPairDigest = requireSha256(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  const dealId = requireSha256(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  const universeReferences = normaliseNarrationReferences(
    input.frozen_narration_occurrence_universe,
    frozenContractPairDigest,
    dealId,
    MAX_EVENT_SET_NARRATIONS,
  );
  if (
    !Array.isArray(input.candidates)
    || input.candidates.length === 0
    || input.candidates.length > MAX_EVENT_CANDIDATES
  ) {
    fail(code, 'Process event expected-slot candidates must be bounded and non-empty.');
  }
  const universeById = new Map(universeReferences.map((reference) => [
    reference.process_narration_occurrence_id,
    reference,
  ]));
  const normalisedCandidates = input.candidates.map((candidate, index) => {
    rejectProhibitedInputs(candidate);
    requireExactKeys(
      candidate,
      EVENT_CANDIDATE_KEYS,
      `Process event slot candidate ${index}`,
      code,
    );
    requireGovernedKey(
      candidate.process_event_slot_key,
      `Process event slot candidate ${index} key`,
      code,
    );
    requireExactValue(
      candidate.event_definition_key_and_version,
      EVENT_DEFINITION,
      `Process event slot candidate ${index} definition`,
      code,
    );
    const references = normaliseNarrationReferences(
      candidate.process_narration_occurrences,
      frozenContractPairDigest,
      dealId,
      MAX_EVENT_NARRATIONS,
    );
    for (const reference of references) {
      const frozenReference = universeById.get(
        reference.process_narration_occurrence_id,
      );
      if (!frozenReference
        || canonicalJson(frozenReference) !== canonicalJson(reference)) {
        fail(
          'PROCESS_EVENT_NARRATION_OUTSIDE_FROZEN_UNIVERSE',
          'An event slot uses a narration outside the frozen narration universe.',
        );
      }
    }
    return {
      process_event_slot_key: candidate.process_event_slot_key,
      event_definition_key_and_version: cloneCanonical(
        EVENT_DEFINITION,
        'Process event definition',
        code,
      ),
      narration_occurrence_references: references,
      ordered_process_narration_occurrence_ids: references.map(
        (reference) => reference.process_narration_occurrence_id,
      ),
      event_grouping_evidence_ids: normaliseEvidenceIds(
        candidate.event_grouping_evidence_ids,
      ),
      expected_result_slot_key: requireGovernedKey(
        candidate.expected_result_slot_key,
        `Process event slot candidate ${index} result slot`,
        code,
      ),
    };
  }).sort((left, right) => (
    left.narration_occurrence_references[0].governed_ordinal
      - right.narration_occurrence_references[0].governed_ordinal
    || canonicalJson(left.ordered_process_narration_occurrence_ids)
      .localeCompare(canonicalJson(
        right.ordered_process_narration_occurrence_ids,
      ))
    || left.process_event_slot_key.localeCompare(right.process_event_slot_key)
  ));
  const slotKeys = normalisedCandidates.map(
    (candidate) => candidate.process_event_slot_key,
  );
  if (new Set(slotKeys).size !== slotKeys.length) {
    fail('DUPLICATE_PROCESS_EVENT_SLOT', 'Process event slot keys must be unique.');
  }
  const claimedNarrationIds = new Set();
  for (const candidate of normalisedCandidates) {
    for (const narrationId of candidate.ordered_process_narration_occurrence_ids) {
      if (claimedNarrationIds.has(narrationId)) {
        fail(
          'PROCESS_EVENT_NARRATION_MEMBER_REUSED',
          'One frozen narration occurrence cannot enter two ProcessEvent slots.',
        );
      }
      claimedNarrationIds.add(narrationId);
    }
  }
  if (
    claimedNarrationIds.size !== universeById.size
    || [...universeById.keys()].some(
      (narrationId) => !claimedNarrationIds.has(narrationId),
    )
  ) {
    fail(
      'INCOMPLETE_PROCESS_EVENT_NARRATION_PARTITION',
      'Expected ProcessEvent slots must partition every frozen narration occurrence exactly once.',
    );
  }
  const slots = normalisedCandidates.map((candidate, governedOrdinal) => {
    const withoutDigest = {
      ...candidate,
      governed_ordinal: governedOrdinal,
      precomputed_process_event_id: contentId(
        EVENT_ID_DOMAIN,
        eventIdentity({
          frozen_contract_pair_digest: frozenContractPairDigest,
          governed_deal_admission_id: dealId,
          ...candidate,
          governed_ordinal: governedOrdinal,
        }),
      ),
    };
    return {
      ...withoutDigest,
      expected_slot_digest: contentId(EVENT_SLOT_DOMAIN, withoutDigest),
    };
  });
  const body = {
    schema_version: EVENT_SLOT_UNIVERSE_SCHEMA,
    frozen_contract_pair_digest: frozenContractPairDigest,
    governed_deal_admission_id: dealId,
    narration_occurrence_references: universeReferences,
    expected_event_slots: slots,
    partition_status: 'COMPLETE_EXACT',
    unresolved_member_count: 0,
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process event authority limits',
      code,
    ),
  };
  return deepFreeze({
    ...body,
    scope_stage_freeze_id: contentId(EVENT_SLOT_UNIVERSE_DOMAIN, body),
    canonical_payload_digest: contentId(
      EVENT_SLOT_UNIVERSE_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessEventSlotUniverse(universe) {
  const code = 'INVALID_PROCESS_EVENT_SLOT_UNIVERSE';
  requireExactKeys(universe, [
    'schema_version',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'narration_occurrence_references',
    'expected_event_slots',
    'partition_status',
    'unresolved_member_count',
    'authority_limits',
    'scope_stage_freeze_id',
    'canonical_payload_digest',
  ], 'Process event slot universe', code);
  if (
    universe.schema_version !== EVENT_SLOT_UNIVERSE_SCHEMA
    || universe.partition_status !== 'COMPLETE_EXACT'
    || universe.unresolved_member_count !== 0
  ) {
    fail(code, 'The Process event slot universe is not complete and frozen.');
  }
  requireSha256(
    universe.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireSha256(
    universe.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  if (
    !Array.isArray(universe.narration_occurrence_references)
    || universe.narration_occurrence_references.length === 0
    || universe.narration_occurrence_references.length > MAX_EVENT_SET_NARRATIONS
  ) {
    fail(code, 'The frozen narration reference universe is invalid.');
  }
  universe.narration_occurrence_references.forEach(validateNarrationReference);
  const sortedUniverseReferences = [...universe.narration_occurrence_references]
    .sort((left, right) => (
      left.governed_ordinal - right.governed_ordinal
        || left.process_narration_occurrence_id.localeCompare(
          right.process_narration_occurrence_id,
        )
    ));
  requireExactValue(
    universe.narration_occurrence_references,
    sortedUniverseReferences,
    'Process event frozen narration reference order',
    code,
  );
  if (
    !Array.isArray(universe.expected_event_slots)
    || universe.expected_event_slots.length === 0
    || universe.expected_event_slots.length > MAX_EVENT_CANDIDATES
  ) {
    fail(code, 'The expected ProcessEvent slot set is invalid.');
  }
  universe.expected_event_slots.forEach((slot, index) => validateSlot(
    slot,
    index,
    universe.frozen_contract_pair_digest,
    universe.governed_deal_admission_id,
  ));
  const universeIds = universe.narration_occurrence_references.map(
    (reference) => reference.process_narration_occurrence_id,
  );
  const slotIds = universe.expected_event_slots.flatMap(
    (slot) => slot.ordered_process_narration_occurrence_ids,
  );
  if (
    new Set(universeIds).size !== universeIds.length
    || new Set(slotIds).size !== slotIds.length
    || canonicalJson([...universeIds].sort())
      !== canonicalJson([...slotIds].sort())
  ) {
    fail(
      'INCOMPLETE_PROCESS_EVENT_NARRATION_PARTITION',
      'The expected ProcessEvent slots do not partition the frozen narration universe.',
    );
  }
  const slotKeys = universe.expected_event_slots.map(
    (slot) => slot.process_event_slot_key,
  );
  if (new Set(slotKeys).size !== slotKeys.length) {
    fail('DUPLICATE_PROCESS_EVENT_SLOT', 'Expected ProcessEvent slot keys are not unique.');
  }
  requireExactValue(
    universe.authority_limits,
    AUTHORITY_LIMITS,
    'Process event authority limits',
    code,
  );
  const body = { ...universe };
  delete body.scope_stage_freeze_id;
  delete body.canonical_payload_digest;
  if (
    universe.scope_stage_freeze_id
      !== contentId(EVENT_SLOT_UNIVERSE_DOMAIN, body)
    || universe.canonical_payload_digest
      !== contentId(EVENT_SLOT_UNIVERSE_PAYLOAD_DOMAIN, body)
  ) {
    fail(
      'PROCESS_EVENT_SLOT_UNIVERSE_DIGEST_MISMATCH',
      'The ProcessEvent slot universe does not bind its exact frozen payload.',
    );
  }
  return universe;
}

function verifiedNarrationUniverse(universe, occurrences) {
  const references = normaliseNarrationReferences(
    occurrences,
    universe.frozen_contract_pair_digest,
    universe.governed_deal_admission_id,
    MAX_EVENT_SET_NARRATIONS,
  );
  requireExactValue(
    references,
    universe.narration_occurrence_references,
    'Process event frozen narration universe',
    'PROCESS_EVENT_NARRATION_UNIVERSE_MISMATCH',
  );
  return new Map(occurrences.map((occurrence) => [
    occurrence.process_narration_occurrence_id,
    occurrence,
  ]));
}

function eventBodyFromSlot(universe, slot) {
  return {
    schema_version: EVENT_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    process_event_slot_key: slot.process_event_slot_key,
    ...eventIdentity({
      frozen_contract_pair_digest: universe.frozen_contract_pair_digest,
      governed_deal_admission_id: universe.governed_deal_admission_id,
      ...slot,
    }),
    narration_occurrence_references: slot.narration_occurrence_references,
    scope_stage_freeze: {
      scope_stage_freeze_id: universe.scope_stage_freeze_id,
      expected_slot_digest: slot.expected_slot_digest,
      expected_result_slot_key: slot.expected_result_slot_key,
      member_universe_status: 'COMPLETE_EXACT_PARTITION',
    },
    event_grouping_evidence_ids: slot.event_grouping_evidence_ids,
    materialisation_state: 'IDENTITY_ONLY',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process event authority limits',
      'INVALID_PROCESS_EVENT_IDENTITY',
    ),
  };
}

function buildProcessEventIdentity(input) {
  const code = 'INVALID_PROCESS_EVENT_IDENTITY';
  requireExactKeys(input, EVENT_BUILD_INPUT_KEYS, 'Process event build input', code);
  validateProcessEventSlotUniverse(input.frozen_event_slot_universe);
  verifiedNarrationUniverse(
    input.frozen_event_slot_universe,
    input.frozen_narration_occurrence_universe,
  );
  requireGovernedKey(input.process_event_slot_key, 'Process event slot key', code);
  const slot = input.frozen_event_slot_universe.expected_event_slots.find(
    (candidate) => candidate.process_event_slot_key === input.process_event_slot_key,
  );
  if (!slot) {
    fail(
      'UNKNOWN_PROCESS_EVENT_SLOT',
      'The requested ProcessEvent slot is not in the frozen expected-slot universe.',
    );
  }
  const body = eventBodyFromSlot(input.frozen_event_slot_universe, slot);
  return deepFreeze({
    ...body,
    process_event_id: slot.precomputed_process_event_id,
    canonical_payload_digest: contentId(EVENT_PAYLOAD_DOMAIN, body),
  });
}

function validateProcessEventIdentity(event, frozenEventSlotUniverse) {
  const code = 'INVALID_PROCESS_EVENT_IDENTITY';
  validateProcessEventSlotUniverse(frozenEventSlotUniverse);
  requireExactKeys(event, [
    'schema_version',
    'logical_type',
    'process_event_slot_key',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'event_definition_key_and_version',
    'ordered_process_narration_occurrence_ids',
    'governed_ordinal',
    'narration_occurrence_references',
    'scope_stage_freeze',
    'event_grouping_evidence_ids',
    'materialisation_state',
    'authority_limits',
    'process_event_id',
    'canonical_payload_digest',
  ], 'Process event identity', code);
  const slot = frozenEventSlotUniverse.expected_event_slots.find(
    (candidate) => candidate.process_event_slot_key === event.process_event_slot_key,
  );
  if (!slot) {
    fail('UNKNOWN_PROCESS_EVENT_SLOT', 'The ProcessEvent has no frozen expected slot.');
  }
  if (
    event.schema_version !== EVENT_IDENTITY_SCHEMA
    || event.logical_type !== LOGICAL_TYPE
    || event.materialisation_state !== 'IDENTITY_ONLY'
    || event.process_event_id !== slot.precomputed_process_event_id
  ) {
    fail(code, 'The ProcessEvent identity carrier is invalid.');
  }
  const expectedBody = eventBodyFromSlot(frozenEventSlotUniverse, slot);
  const actualBody = { ...event };
  delete actualBody.process_event_id;
  delete actualBody.canonical_payload_digest;
  requireExactValue(
    actualBody,
    expectedBody,
    'Process event identity body',
    code,
  );
  if (
    event.canonical_payload_digest
    !== contentId(EVENT_PAYLOAD_DOMAIN, expectedBody)
  ) {
    fail(
      'PROCESS_EVENT_PAYLOAD_MISMATCH',
      'The ProcessEvent identity payload digest is invalid.',
    );
  }
  return event;
}

function freezeProcessEventIdentitySet(input) {
  const code = 'INVALID_PROCESS_EVENT_IDENTITY_SET';
  requireExactKeys(input, EVENT_SET_INPUT_KEYS, 'Process event identity set', code);
  validateProcessEventSlotUniverse(input.frozen_event_slot_universe);
  verifiedNarrationUniverse(
    input.frozen_event_slot_universe,
    input.frozen_narration_occurrence_universe,
  );
  return deepFreeze(input.frozen_event_slot_universe.expected_event_slots.map(
    (slot) => buildProcessEventIdentity({
      frozen_event_slot_universe: input.frozen_event_slot_universe,
      frozen_narration_occurrence_universe:
        input.frozen_narration_occurrence_universe,
      process_event_slot_key: slot.process_event_slot_key,
    }),
  ));
}

module.exports = {
  ProcessEventError,
  buildProcessEventIdentity,
  freezeProcessEventIdentitySet,
  freezeProcessEventSlotUniverse,
  validateProcessEventIdentity,
  validateProcessEventSlotUniverse,
};
