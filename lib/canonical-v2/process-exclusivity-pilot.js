const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  freezeProcessNarrationOccurrenceSet,
  validateCanonicalSourceIntervalSet,
} = require('./process-narration-occurrence');
const {
  freezeProcessEventIdentitySet,
  freezeProcessEventSlotUniverse,
} = require('./process-event');
const {
  buildProcessParticipantIdentity,
} = require('./process-participant-identity');
const {
  buildBidderTrackIdentity,
} = require('./process-bidder-track-identity');
const {
  buildProcessPhaseIdentity,
} = require('./process-phase-identity');
const {
  buildProcessPositionIdentity,
} = require('./process-position-identity');
const {
  buildProcessAgreementIdentity,
} = require('./process-agreement-identity');
const {
  ENDPOINT_DEFINITIONS,
  buildProcessRelationshipIdentity,
} = require('./process-relationship');
const {
  buildLosslessTemporalExpressionDraft,
  buildProcessTemporalExpressionIdentity,
} = require('./process-temporal-expression');
const {
  buildProcessPassageIdentity,
} = require('./process-passage-identity');

const controlledCodeRegistryContract = require(
  '../../contracts/canonical-v2/successor/process/registries/process-controlled-code-registry.v1.json',
);
const predicateCatalogueContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v1.json',
);

const revisionContracts = Object.freeze({
  narration: require(
    '../../contracts/canonical-v2/successor/process/narration/process-narration-occurrence.v1.json',
  ),
  event: require(
    '../../contracts/canonical-v2/successor/process/events/process-event.v1.json',
  ),
  participant: require(
    '../../contracts/canonical-v2/successor/process/participants/process-participant.v1.json',
  ),
  bidder_track: require(
    '../../contracts/canonical-v2/successor/process/bidder-tracks/bidder-track.v1.json',
  ),
  phase: require(
    '../../contracts/canonical-v2/successor/process/phases/process-phase.v1.json',
  ),
  position: require(
    '../../contracts/canonical-v2/successor/process/positions/process-position.v1.json',
  ),
  agreement: require(
    '../../contracts/canonical-v2/successor/process/agreements/process-agreement.v1.json',
  ),
  relationship: require(
    '../../contracts/canonical-v2/successor/process/relationships/process-relationship.v1.json',
  ),
  temporal_expression: require(
    '../../contracts/canonical-v2/successor/shared/temporal/temporal-expression.v1.json',
  ),
  predicate_witness: require(
    '../../contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v1.json',
  ),
  passage: require(
    '../../contracts/canonical-v2/successor/process/passages/process-passage.v1.json',
  ),
});

const MATERIALISATION_INPUT_SCHEMA =
  'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_INPUT/V1';
const MATERIALISATION_RECEIPT_SCHEMA =
  'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_RECEIPT/V1';
const EVIDENCE_EDGE_SCHEMA = 'PROCESS_EXACT_EVIDENCE_EDGE/V1';
const NARRATION_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_NARRATION_OCCURRENCE',
  definition_version: 1,
});
const PASSAGE_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_PASSAGE',
  definition_version: 1,
});
const TEMPORAL_DEFINITION = Object.freeze({
  definition_key: 'TEMPORAL_EXPRESSION',
  definition_version: 1,
});
const RELATIONSHIP_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_RELATIONSHIP',
  definition_version: 1,
});
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const MAX_SOURCE_DOCUMENTS = 16;
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_MEMBERS_PER_TYPE = 256;

const TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'source_documents',
  'frozen_scope',
  'typed_values',
]);

const SOURCE_DOCUMENT_KEYS = Object.freeze([
  'admitted_source_occurrence_id',
  'source_document_identity',
  'source_revision_id',
  'document_hash',
  'document_ordinal',
  'source_text',
  'source_text_digest',
  'citation_identity',
  'evidence_validation_receipt_id',
]);

const FROZEN_SCOPE_KEYS = Object.freeze([
  'narration_slots',
  'event_slots',
  'participant_slots',
  'bidder_track_slots',
  'phase_slots',
  'position_slots',
  'agreement_slots',
  'relationship_slots',
  'temporal_slots',
  'predicate_witness_slots',
  'passage_slots',
]);

const TYPED_VALUE_KEYS = Object.freeze([
  'narrations',
  'events',
  'participants',
  'bidder_tracks',
  'phases',
  'positions',
  'agreements',
  'relationships',
  'temporal_expressions',
  'predicate_witnesses',
  'passages',
]);

const REVISION_DESCRIPTORS = Object.freeze({
  narration: Object.freeze({
    contract: revisionContracts.narration,
    id_key: 'process_narration_revision_id',
  }),
  event: Object.freeze({
    contract: revisionContracts.event,
    id_key: 'process_event_revision_id',
  }),
  participant: Object.freeze({
    contract: revisionContracts.participant,
    id_key: 'process_participant_revision_id',
  }),
  bidder_track: Object.freeze({
    contract: revisionContracts.bidder_track,
    id_key: 'bidder_track_revision_id',
  }),
  phase: Object.freeze({
    contract: revisionContracts.phase,
    id_key: 'process_phase_revision_id',
  }),
  position: Object.freeze({
    contract: revisionContracts.position,
    id_key: 'process_position_revision_id',
  }),
  agreement: Object.freeze({
    contract: revisionContracts.agreement,
    id_key: 'process_agreement_revision_id',
  }),
  relationship: Object.freeze({
    contract: revisionContracts.relationship,
    id_key: 'process_relationship_revision_id',
  }),
  temporal_expression: Object.freeze({
    contract: revisionContracts.temporal_expression,
    id_key: 'temporal_expression_revision_id',
  }),
  predicate_witness: Object.freeze({
    contract: revisionContracts.predicate_witness,
    id_key: 'predicate_witness_revision_id',
  }),
  passage: Object.freeze({
    contract: revisionContracts.passage,
    id_key: 'process_passage_revision_id',
  }),
});

const AUTHORITY_LIMITS = Object.freeze({
  external_io: 'NONE',
  extraction: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  database_write: 'NONE',
  release: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
  canonical_write: 'NONE',
});

class ProcessExclusivityPilotError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessExclusivityPilotError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessExclusivityPilotError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
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
      actual,
      expected: required,
    });
  }
}

function requireArray(value, label, {
  minimum = 0,
  maximum = MAX_MEMBERS_PER_TYPE,
  code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_INPUT',
} = {}) {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
  ) {
    fail(code, `${label} has invalid cardinality.`);
  }
  return value;
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
  return value;
}

function requireGovernedKey(value, label, code) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed key.`);
  }
  return value;
}

function requireInteger(value, minimum, label, code) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail(code, `${label} must be an integer of at least ${minimum}.`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function compareIntervals(left, right) {
  return left.document_ordinal - right.document_ordinal
    || left.absolute_start - right.absolute_start
    || left.absolute_end - right.absolute_end
    || compareText(
      left.admitted_source_occurrence_id,
      right.admitted_source_occurrence_id,
    );
}

function compareEvidenceEdges(left, right) {
  return left.document_ordinal - right.document_ordinal
    || left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
    || compareText(left.evidence_role_key, right.evidence_role_key)
    || compareText(left.evidence_edge_id, right.evidence_edge_id);
}

function mapUnique(values, key, label, code) {
  const map = new Map();
  for (const value of values) {
    const selected = value[key];
    if (map.has(selected)) fail(code, `${label} contains a duplicate ${key}.`);
    map.set(selected, value);
  }
  return map;
}

function requireExactMemberSet(scopeValues, typedValues, key, label, code) {
  const scopeKeys = scopeValues.map((value) => value[key]).sort(compareText);
  const typedKeys = typedValues.map((value) => value[key]).sort(compareText);
  if (canonicalJson(scopeKeys) !== canonicalJson(typedKeys)) {
    fail(code, `${label} scope and typed values do not reconcile exactly.`, {
      frozen_scope_keys: scopeKeys,
      typed_value_keys: typedKeys,
    });
  }
}

function validateSourceDocument(value, index) {
  const code = 'INVALID_PROCESS_PILOT_SOURCE_DOCUMENT';
  requireExactKeys(
    value,
    SOURCE_DOCUMENT_KEYS,
    `Process pilot source document ${index}`,
    code,
  );
  [
    'admitted_source_occurrence_id',
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'source_text_digest',
    'evidence_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Source document ${index} ${key}`, code);
  });
  requireInteger(
    value.document_ordinal,
    0,
    `Source document ${index} ordinal`,
    code,
  );
  if (
    typeof value.source_text !== 'string'
    || Buffer.byteLength(value.source_text, 'utf8') > MAX_SOURCE_BYTES
  ) {
    fail(code, `Source document ${index} text is invalid or too large.`);
  }
  requireObject(
    value.citation_identity,
    `Source document ${index} citation identity`,
    code,
  );
  if (
    Object.keys(value.citation_identity).length === 0
    || Buffer.byteLength(
      canonicalJson(value.citation_identity),
      'utf8',
    ) > 16384
    || value.source_text_digest
      !== sha256Hex(Buffer.from(value.source_text, 'utf8'))
  ) {
    fail(code, `Source document ${index} identity or text digest is invalid.`);
  }
}

function sourceContext(sourceDocuments) {
  requireArray(sourceDocuments, 'Process pilot source documents', {
    minimum: 1,
    maximum: MAX_SOURCE_DOCUMENTS,
    code: 'INVALID_PROCESS_PILOT_SOURCE_DOCUMENT',
  });
  sourceDocuments.forEach(validateSourceDocument);
  const byIdentity = mapUnique(
    sourceDocuments,
    'source_document_identity',
    'Process pilot source documents',
    'INVALID_PROCESS_PILOT_SOURCE_DOCUMENT',
  );
  if (
    new Set(sourceDocuments.map((value) => value.document_ordinal)).size
      !== sourceDocuments.length
    || new Set(sourceDocuments.map(
      (value) => value.admitted_source_occurrence_id,
    )).size !== sourceDocuments.length
  ) {
    fail(
      'INVALID_PROCESS_PILOT_SOURCE_DOCUMENT',
      'Process pilot source identities and document ordinals must be unique.',
    );
  }
  return { sourceDocuments, byIdentity };
}

function resolveInterval(reference, sources, label) {
  const code = 'INVALID_PROCESS_PILOT_SOURCE_INTERVAL';
  requireExactKeys(reference, [
    'source_document_identity',
    'absolute_start',
    'absolute_end',
  ], label, code);
  requireDigest(
    reference.source_document_identity,
    `${label} source document identity`,
    code,
  );
  const source = sources.byIdentity.get(reference.source_document_identity);
  if (!source) fail(code, `${label} uses an unknown source document.`);
  requireInteger(reference.absolute_start, 0, `${label} start`, code);
  requireInteger(reference.absolute_end, 1, `${label} end`, code);
  const sourceBytes = Buffer.from(source.source_text, 'utf8');
  if (
    reference.absolute_end <= reference.absolute_start
    || reference.absolute_end > sourceBytes.length
  ) {
    fail(code, `${label} source coordinates are invalid.`);
  }
  const exactBytes = sourceBytes.subarray(
    reference.absolute_start,
    reference.absolute_end,
  );
  const exactText = exactBytes.toString('utf8');
  if (!Buffer.from(exactText, 'utf8').equals(exactBytes)) {
    fail(code, `${label} does not use complete UTF-8 byte boundaries.`);
  }
  return {
    interval: {
      admitted_source_occurrence_id:
        source.admitted_source_occurrence_id,
      document_hash: source.document_hash,
      document_ordinal: source.document_ordinal,
      absolute_start: reference.absolute_start,
      absolute_end: reference.absolute_end,
      exact_bytes_digest: sha256Hex(exactBytes),
    },
    source,
    exactBytes,
    exactText,
  };
}

function intervalSet(references, sources, label) {
  requireArray(references, `${label} intervals`, {
    minimum: 1,
    maximum: 64,
    code: 'INVALID_PROCESS_PILOT_SOURCE_INTERVAL',
  });
  const resolved = references.map((reference, index) => resolveInterval(
    reference,
    sources,
    `${label} interval ${index}`,
  )).sort((left, right) => compareIntervals(left.interval, right.interval));
  const value = {
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    intervals: resolved.map((entry) => entry.interval),
  };
  try {
    validateCanonicalSourceIntervalSet(value);
  } catch (error) {
    fail(
      'INVALID_PROCESS_PILOT_SOURCE_INTERVAL',
      `${label} source interval set is invalid.`,
      { cause: error.code || error.message },
    );
  }
  return { value, resolved };
}

function validateEvidenceSpec(spec, sources, label) {
  const code = 'INVALID_PROCESS_PILOT_EVIDENCE';
  requireExactKeys(spec, [
    'evidence_role_key',
    'intervals',
  ], label, code);
  requireGovernedKey(spec.evidence_role_key, `${label} role`, code);
  return intervalSet(spec.intervals, sources, label);
}

function evidenceEdges(spec, sources, label) {
  const { resolved } = validateEvidenceSpec(spec, sources, label);
  const edges = resolved.map((entry) => {
    const body = {
      schema_version: EVIDENCE_EDGE_SCHEMA,
      evidence_role_key: spec.evidence_role_key,
      admitted_source_occurrence_id:
        entry.source.admitted_source_occurrence_id,
      source_document_identity:
        entry.source.source_document_identity,
      source_revision_id: entry.source.source_revision_id,
      document_hash: entry.source.document_hash,
      document_ordinal: entry.source.document_ordinal,
      start_utf8_byte: entry.interval.absolute_start,
      end_utf8_byte: entry.interval.absolute_end,
      exact_text_digest: entry.interval.exact_bytes_digest,
      evidence_validation_receipt_id:
        entry.source.evidence_validation_receipt_id,
      validation_state: 'EXTERNALLY_VALIDATED',
      authority_state: 'NOT_GRANTED',
    };
    return {
      schema_version: body.schema_version,
      evidence_edge_id: contentId(EVIDENCE_EDGE_SCHEMA, body),
      ...body,
    };
  }).sort(compareEvidenceEdges);
  if (new Set(edges.map((edge) => edge.evidence_edge_id)).size !== edges.length) {
    fail(
      'INVALID_PROCESS_PILOT_EVIDENCE',
      `${label} contains duplicate exact evidence.`,
    );
  }
  return edges;
}

function exactTextForEvidence(spec, sources, label) {
  const { resolved } = validateEvidenceSpec(spec, sources, label);
  return resolved.map((entry) => entry.exactText).join('');
}

function exactSourceSlicesFromEdges(edges, sources) {
  const sliceByKey = new Map();
  for (const edge of edges.flat()) {
    const key = [
      edge.source_document_identity,
      edge.start_utf8_byte,
      edge.end_utf8_byte,
    ].join(':');
    if (sliceByKey.has(key)) continue;
    const source = sources.byIdentity.get(edge.source_document_identity);
    const bytes = Buffer.from(source.source_text, 'utf8').subarray(
      edge.start_utf8_byte,
      edge.end_utf8_byte,
    );
    const body = {
      source_document_identity: edge.source_document_identity,
      source_revision_id: edge.source_revision_id,
      document_hash: edge.document_hash,
      document_ordinal: edge.document_ordinal,
      start_utf8_byte: edge.start_utf8_byte,
      end_utf8_byte: edge.end_utf8_byte,
      exact_text: bytes.toString('utf8'),
      exact_text_digest: edge.exact_text_digest,
    };
    sliceByKey.set(key, {
      exact_source_slice_id: contentId(
        'PROCESS_EXACT_SOURCE_SLICE/V1',
        body,
      ),
      ...body,
    });
  }
  return [...sliceByKey.values()].sort((left, right) => (
    left.document_ordinal - right.document_ordinal
    || left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
  ));
}

function processOwnedRegistryMap() {
  const registries = controlledCodeRegistryContract.definition
    .process_owned_registries;
  return new Map(registries.map((registry) => [
    registry.registry_stable_id,
    new Set(registry.codes),
  ]));
}

function requireControlledCode(registryMap, registryId, value, label) {
  const codes = registryMap.get(registryId);
  if (!codes || !codes.has(value)) {
    fail(
      'UNRESOLVED_PROCESS_CONTROLLED_CODE',
      `${label} is not in the closed Process registry.`,
      {
        registry_stable_id: registryId,
        unresolved_source_value: value,
        materialisation_state: 'BLOCKED',
        near_code_mapping_permitted: false,
      },
    );
  }
  return value;
}

function requireCanonicalState(value, label) {
  if (![
    'PRESENT',
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ].includes(value)) {
    fail(
      'INVALID_PROCESS_PILOT_TYPED_VALUE',
      `${label} is not a canonical state.`,
    );
  }
  return value;
}

function requireNullableDigest(value, label, code) {
  if (value !== null) requireDigest(value, label, code);
  return value;
}

function requireSortedUniqueDigests(values, label, {
  minimum = 0,
  maximum = MAX_MEMBERS_PER_TYPE,
  code = 'INVALID_PROCESS_PILOT_TYPED_VALUE',
} = {}) {
  requireArray(values, label, { minimum, maximum, code });
  values.forEach((value, index) => {
    requireDigest(value, `${label} ${index}`, code);
  });
  const sorted = [...values].sort(compareText);
  if (
    new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson(sorted)
  ) {
    fail(code, `${label} must be sorted and unique.`);
  }
  return values;
}

function requireSortedUniqueGovernedKeys(values, label, {
  minimum = 0,
  maximum = MAX_MEMBERS_PER_TYPE,
  code = 'INVALID_PROCESS_PILOT_TYPED_VALUE',
} = {}) {
  requireArray(values, label, { minimum, maximum, code });
  values.forEach((value, index) => {
    requireGovernedKey(value, `${label} ${index}`, code);
  });
  const sorted = [...values].sort(compareText);
  if (
    new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson(sorted)
  ) {
    fail(code, `${label} must be sorted and unique.`);
  }
  return values;
}

function revisionDescriptor(type) {
  const descriptor = REVISION_DESCRIPTORS[type];
  const revisionIdentity = descriptor.contract.definition.revision_identity;
  if (
    descriptor.contract.definition?.revision_identity?.revision_id_domain
      !== revisionIdentity.revision_id_domain
    || !Array.isArray(revisionIdentity.immutable_inputs)
  ) {
    fail(
      'INVALID_PROCESS_PILOT_CONTRACT_BINDING',
      `The ${type} revision contract is invalid.`,
    );
  }
  return {
    ...descriptor,
    revision_identity: revisionIdentity,
  };
}

function buildRevision(type, payload) {
  const code = 'INVALID_PROCESS_PILOT_REVISION';
  const descriptor = revisionDescriptor(type);
  requireExactKeys(
    payload,
    descriptor.revision_identity.immutable_inputs,
    `${type} immutable revision payload`,
    code,
  );
  const canonicalPayload = clone(payload);
  const body = {
    schema_version: descriptor.revision_identity.revision_id_domain,
    [descriptor.id_key]: contentId(
      descriptor.revision_identity.revision_id_domain,
      canonicalPayload,
    ),
    ...canonicalPayload,
    validation_state: 'VALIDATED_PURE_RUNTIME',
    authority_state: 'NOT_GRANTED',
  };
  return {
    ...body,
    canonical_payload_digest: contentId(
      `${descriptor.revision_identity.revision_id_domain}_PAYLOAD`,
      body,
    ),
  };
}

function requireRevision(value, type) {
  const code = 'INVALID_PROCESS_PILOT_REVISION';
  const descriptor = revisionDescriptor(type);
  const payload = {};
  for (const key of descriptor.revision_identity.immutable_inputs) {
    payload[key] = value[key];
  }
  const rebuilt = buildRevision(type, payload);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, `The ${type} revision was changed.`);
  }
  return value;
}

function validateInputShape(input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_INPUT';
  requireExactKeys(input, TOP_LEVEL_KEYS, 'Process exclusivity pilot input', code);
  if (input.schema_version !== MATERIALISATION_INPUT_SCHEMA) {
    fail(code, 'The Process exclusivity pilot input schema is not supported.');
  }
  requireDigest(
    input.frozen_contract_pair_digest,
    'Frozen contract-pair digest',
    code,
  );
  requireDigest(
    input.governed_deal_admission_id,
    'Governed deal-admission ID',
    code,
  );
  requireExactKeys(
    input.frozen_scope,
    FROZEN_SCOPE_KEYS,
    'Process exclusivity frozen scope',
    code,
  );
  requireExactKeys(
    input.typed_values,
    TYPED_VALUE_KEYS,
    'Process exclusivity typed values',
    code,
  );
  for (const key of FROZEN_SCOPE_KEYS) {
    requireArray(input.frozen_scope[key], `Frozen scope ${key}`, {
      minimum: 1,
      code,
    });
  }
  for (const key of TYPED_VALUE_KEYS) {
    requireArray(input.typed_values[key], `Typed values ${key}`, {
      minimum: 1,
      code,
    });
  }
}

function reconcileScopeAndValues(input) {
  const code = 'PROCESS_PILOT_SCOPE_VALUE_MISMATCH';
  const pairs = [
    ['event_slots', 'events', 'process_event_slot_key'],
    ['participant_slots', 'participants', 'process_participant_slot_key'],
    ['bidder_track_slots', 'bidder_tracks', 'bidder_track_slot_key'],
    ['phase_slots', 'phases', 'process_phase_slot_key'],
    ['position_slots', 'positions', 'process_position_slot_key'],
    ['agreement_slots', 'agreements', 'process_agreement_slot_key'],
    ['relationship_slots', 'relationships', 'process_relationship_slot_key'],
    ['temporal_slots', 'temporal_expressions', 'expected_temporal_slot_key'],
    ['predicate_witness_slots', 'predicate_witnesses', 'predicate_witness_slot_key'],
    ['passage_slots', 'passages', 'process_passage_slot_key'],
  ];
  for (const [scopeKey, valueKey, memberKey] of pairs) {
    requireExactMemberSet(
      input.frozen_scope[scopeKey],
      input.typed_values[valueKey],
      memberKey,
      valueKey,
      code,
    );
  }
  const narrationOrdinals = input.typed_values.narrations
    .map((value) => value.narration_ordinal)
    .sort((left, right) => left - right);
  const expectedOrdinals = input.frozen_scope.narration_slots
    .map((value, index) => index);
  if (canonicalJson(narrationOrdinals) !== canonicalJson(expectedOrdinals)) {
    fail(code, 'Narration typed values do not cover every frozen narration.');
  }
}

function buildNarrationIdentities(input, sources) {
  const candidates = input.frozen_scope.narration_slots.map((slot, index) => {
    requireExactKeys(slot, [
      'canonical_source_intervals',
    ], `Narration slot ${index}`, 'INVALID_PROCESS_PILOT_FROZEN_SCOPE');
    return {
      canonical_source_interval_set: intervalSet(
        slot.canonical_source_intervals,
        sources,
        `Narration slot ${index}`,
      ).value,
    };
  });
  return freezeProcessNarrationOccurrenceSet({
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    narration_definition_key_and_version: NARRATION_DEFINITION,
    candidates,
  });
}

function buildEventIdentities(input, sources, narrations) {
  const candidates = input.frozen_scope.event_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'process_event_slot_key',
      'narration_ordinals',
      'event_grouping_evidence',
      'expected_result_slot_key',
    ], `Event slot ${index}`, code);
    requireGovernedKey(
      slot.process_event_slot_key,
      `Event slot ${index} key`,
      code,
    );
    requireGovernedKey(
      slot.expected_result_slot_key,
      `Event slot ${index} expected result slot`,
      code,
    );
    requireArray(slot.narration_ordinals, `Event slot ${index} narrations`, {
      minimum: 1,
      code,
    });
    const selectedNarrations = slot.narration_ordinals.map(
      (ordinal, narrationIndex) => {
        requireInteger(
          ordinal,
          0,
          `Event slot ${index} narration ordinal ${narrationIndex}`,
          code,
        );
        const narration = narrations.find(
          (candidate) => candidate.governed_ordinal === ordinal,
        );
        if (!narration) fail(code, `Event slot ${index} has an unknown narration.`);
        return narration;
      },
    );
    return {
      process_event_slot_key: slot.process_event_slot_key,
      event_definition_key_and_version: {
        definition_key: 'PROCESS_EVENT',
        definition_version: 1,
      },
      process_narration_occurrences: selectedNarrations,
      event_grouping_evidence_ids: evidenceEdges(
        slot.event_grouping_evidence,
        sources,
        `Event slot ${index} grouping evidence`,
      ).map((edge) => edge.evidence_edge_id),
      expected_result_slot_key: slot.expected_result_slot_key,
    };
  });
  const frozenEventSlotUniverse = freezeProcessEventSlotUniverse({
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    frozen_narration_occurrence_universe: narrations,
    candidates,
  });
  const identities = freezeProcessEventIdentitySet({
    frozen_event_slot_universe: frozenEventSlotUniverse,
    frozen_narration_occurrence_universe: narrations,
  });
  return { frozenEventSlotUniverse, identities };
}

function buildParticipantIdentities(input) {
  return input.frozen_scope.participant_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'process_event_slot_key',
      'process_participant_slot_key',
      'governed_ordinal',
    ], `Participant slot ${index}`, code);
    return buildProcessParticipantIdentity({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      process_event_slot_key: slot.process_event_slot_key,
      process_participant_slot_key: slot.process_participant_slot_key,
      governed_ordinal: slot.governed_ordinal,
    });
  });
}

function buildBidderTrackIdentities(input) {
  return input.frozen_scope.bidder_track_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'bidder_track_slot_key',
      'governed_ordinal',
    ], `Bidder-track slot ${index}`, code);
    return buildBidderTrackIdentity({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      bidder_track_slot_key: slot.bidder_track_slot_key,
      governed_ordinal: slot.governed_ordinal,
    });
  });
}

function buildPhaseIdentities(input, bidderTrackIdentityBySlot) {
  return input.frozen_scope.phase_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'phase_scope',
      'process_phase_slot_key',
      'governed_ordinal',
    ], `Phase slot ${index}`, code);
    requireExactKeys(slot.phase_scope, [
      'scope_kind',
      'bidder_track_slot_key',
    ], `Phase slot ${index} scope`, code);
    let phaseScope;
    let bindings;
    if (
      slot.phase_scope.scope_kind === 'DEAL'
      && slot.phase_scope.bidder_track_slot_key === null
    ) {
      phaseScope = {
        scope_kind: 'DEAL',
        governed_deal_admission_id: input.governed_deal_admission_id,
      };
      bindings = undefined;
    } else if (
      slot.phase_scope.scope_kind === 'BIDDER_TRACK'
      && typeof slot.phase_scope.bidder_track_slot_key === 'string'
    ) {
      const bidderTrack = bidderTrackIdentityBySlot.get(
        slot.phase_scope.bidder_track_slot_key,
      );
      if (!bidderTrack) {
        fail(code, `Phase slot ${index} uses an unknown bidder track.`);
      }
      phaseScope = {
        scope_kind: 'BIDDER_TRACK',
        bidder_track_id: bidderTrack.bidder_track_id,
      };
      bindings = { bidder_track_identity: bidderTrack };
    } else {
      fail(code, `Phase slot ${index} scope is invalid.`);
    }
    return buildProcessPhaseIdentity({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      phase_scope_kind_and_id: phaseScope,
      process_phase_slot_key: slot.process_phase_slot_key,
      governed_ordinal: slot.governed_ordinal,
    }, bindings);
  });
}

function buildSimpleSlotIdentities(input, scopeKey, keys, builder, label) {
  return input.frozen_scope[scopeKey].map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, keys, `${label} slot ${index}`, code);
    return builder({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      ...slot,
    });
  });
}

function buildPassageIdentities(input, sources) {
  const slots = input.frozen_scope.passage_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'process_passage_slot_key',
      'canonical_source_intervals',
    ], `Passage slot ${index}`, code);
    const canonicalSet = intervalSet(
      slot.canonical_source_intervals,
      sources,
      `Passage slot ${index}`,
    ).value;
    const sourceIds = new Set(canonicalSet.intervals.map(
      (interval) => interval.admitted_source_occurrence_id,
    ));
    if (sourceIds.size !== 1) {
      fail(code, `Passage slot ${index} crosses source occurrences.`);
    }
    return {
      slot_key: slot.process_passage_slot_key,
      canonical_source_interval_set: canonicalSet,
      admitted_source_occurrence_id:
        canonicalSet.intervals[0].admitted_source_occurrence_id,
    };
  }).sort((left, right) => {
    const leftInterval = left.canonical_source_interval_set.intervals[0];
    const rightInterval = right.canonical_source_interval_set.intervals[0];
    return compareIntervals(leftInterval, rightInterval);
  });
  return slots.map((slot, governedOrdinal) => ({
    slot_key: slot.slot_key,
    identity: buildProcessPassageIdentity({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      admitted_source_occurrence_id: slot.admitted_source_occurrence_id,
      canonical_source_interval_set: slot.canonical_source_interval_set,
      process_passage_definition_key_and_version: PASSAGE_DEFINITION,
      governed_ordinal: governedOrdinal,
    }),
  }));
}

function stableObjectRecord(identity) {
  const definitions = {
    BidderTrack: ['BIDDER_TRACK', 'bidder_track_id'],
    ProcessAgreement: ['PROCESS_AGREEMENT', 'process_agreement_id'],
    ProcessEvent: ['PROCESS_EVENT', 'process_event_id'],
    ProcessParticipant: ['PROCESS_PARTICIPANT', 'process_participant_id'],
    ProcessPassage: ['PROCESS_PASSAGE', 'process_passage_id'],
    ProcessPhase: ['PROCESS_PHASE', 'process_phase_id'],
    ProcessPosition: ['PROCESS_POSITION', 'process_position_id'],
  };
  const selected = definitions[identity.logical_type];
  if (!selected) {
    fail(
      'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT',
      'The relationship endpoint logical type is not supported by the pilot.',
    );
  }
  return {
    logical_type: identity.logical_type,
    definition_stable_id: selected[0],
    stable_object_id: identity[selected[1]],
    frozen_contract_pair_digest: identity.frozen_contract_pair_digest,
    governed_deal_admission_id: identity.governed_deal_admission_id,
  };
}

function buildEndpointIdentityMap({
  events,
  participants,
  bidderTracks,
  phases,
  positions,
  agreements,
  passages,
}) {
  const map = new Map();
  const add = (logicalType, slotKey, identity) => {
    const key = `${logicalType}:${slotKey}`;
    if (map.has(key)) {
      fail(
        'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT',
        `The endpoint ${key} is duplicated.`,
      );
    }
    map.set(key, identity);
  };
  events.forEach((identity) => add(
    'ProcessEvent',
    identity.process_event_slot_key,
    identity,
  ));
  participants.forEach((identity) => add(
    'ProcessParticipant',
    identity.process_participant_slot_key,
    identity,
  ));
  bidderTracks.forEach((identity) => add(
    'BidderTrack',
    identity.bidder_track_slot_key,
    identity,
  ));
  phases.forEach((identity) => add(
    'ProcessPhase',
    identity.process_phase_slot_key,
    identity,
  ));
  positions.forEach((identity) => add(
    'ProcessPosition',
    identity.process_position_slot_key,
    identity,
  ));
  agreements.forEach((identity) => add(
    'ProcessAgreement',
    identity.process_agreement_slot_key,
    identity,
  ));
  passages.forEach(({ slot_key: slotKey, identity }) => add(
    'ProcessPassage',
    slotKey,
    identity,
  ));
  return map;
}

function resolveEndpoint(reference, endpointIdentityMap, label) {
  const code = 'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT';
  requireExactKeys(reference, [
    'logical_type',
    'slot_key',
  ], label, code);
  if (!Object.hasOwn(ENDPOINT_DEFINITIONS, reference.logical_type)) {
    fail(code, `${label} logical type is not governed.`);
  }
  const identity = endpointIdentityMap.get(
    `${reference.logical_type}:${reference.slot_key}`,
  );
  if (!identity) fail(code, `${label} does not resolve to a frozen identity.`);
  return identity;
}

function buildRelationshipIdentities(input, endpointIdentityMap) {
  return input.frozen_scope.relationship_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'process_relationship_slot_key',
      'source_endpoint',
      'target_endpoint',
      'governed_ordinal',
    ], `Relationship slot ${index}`, code);
    const sourceIdentity = resolveEndpoint(
      slot.source_endpoint,
      endpointIdentityMap,
      `Relationship slot ${index} source`,
    );
    const targetIdentity = resolveEndpoint(
      slot.target_endpoint,
      endpointIdentityMap,
      `Relationship slot ${index} target`,
    );
    return buildProcessRelationshipIdentity({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      relationship_definition_key_and_version: RELATIONSHIP_DEFINITION,
      source_process_object_kind_and_id:
        stableObjectRecord(sourceIdentity),
      target_process_object_kind_and_id:
        stableObjectRecord(targetIdentity),
      process_relationship_slot_key: slot.process_relationship_slot_key,
      governed_ordinal: slot.governed_ordinal,
    });
  });
}

function buildTemporalIdentities(input, sources, endpointIdentityMap) {
  return input.frozen_scope.temporal_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'expected_temporal_slot_key',
      'governed_ordinal',
      'governed_subject',
    ], `Temporal slot ${index}`, code);
    const subjectIdentity = resolveEndpoint(
      slot.governed_subject,
      endpointIdentityMap,
      `Temporal slot ${index} subject`,
    );
    const stableObject = stableObjectRecord(subjectIdentity);
    if (stableObject.logical_type !== 'ProcessEvent') {
      fail(code, 'The exclusivity pilot temporal subject must be a ProcessEvent.');
    }
    const identity = buildProcessTemporalExpressionIdentity({
      admitted_source_occurrence_id: (() => {
        const typed = input.typed_values.temporal_expressions.find(
          (value) => value.expected_temporal_slot_key
            === slot.expected_temporal_slot_key,
        );
        const resolved = validateEvidenceSpec(
          typed.evidence,
          sources,
          `Temporal slot ${index} evidence`,
        ).resolved;
        if (new Set(resolved.map(
          (entry) => entry.source.admitted_source_occurrence_id,
        )).size !== 1) {
          fail(code, 'A temporal expression cannot cross source occurrences.');
        }
        return resolved[0].source.admitted_source_occurrence_id;
      })(),
      expected_temporal_slot_key: slot.expected_temporal_slot_key,
      governed_ordinal: slot.governed_ordinal,
      governed_subject_id: stableObject.stable_object_id,
      governed_subject_type: 'PROCESS_EVENT',
      temporal_definition_and_version: TEMPORAL_DEFINITION,
    });
    return identity;
  });
}

function buildPredicateWitnessIdentities(input, narrationByOrdinal) {
  const predicateKeys = new Set(
    predicateCatalogueContract.definition.ordinary_question_contract
      .mandatory_predicate_keys,
  );
  return input.frozen_scope.predicate_witness_slots.map((slot, index) => {
    const code = 'INVALID_PROCESS_PILOT_FROZEN_SCOPE';
    requireExactKeys(slot, [
      'predicate_witness_slot_key',
      'narration_ordinal',
      'predicate_definition_key_and_version',
      'predicate_evidence_role_slot_key',
      'governed_ordinal',
    ], `Predicate-witness slot ${index}`, code);
    const narration = narrationByOrdinal.get(slot.narration_ordinal);
    if (
      !narration
      || slot.predicate_definition_key_and_version?.version !== 1
      || !predicateKeys.has(
        slot.predicate_definition_key_and_version?.key,
      )
    ) {
      fail(code, `Predicate-witness slot ${index} is not governed.`);
    }
    requireGovernedKey(
      slot.predicate_evidence_role_slot_key,
      `Predicate-witness slot ${index} evidence-role slot`,
      code,
    );
    const identityPayload = {
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      process_narration_occurrence_id:
        narration.process_narration_occurrence_id,
      predicate_definition_key_and_version:
        slot.predicate_definition_key_and_version,
      predicate_evidence_role_slot_key:
        slot.predicate_evidence_role_slot_key,
      governed_ordinal: slot.governed_ordinal,
    };
    return {
      slot_key: slot.predicate_witness_slot_key,
      identity: {
        ...clone(identityPayload),
        process_predicate_witness_id: contentId(
          'PROCESS_PREDICATE_WITNESS/V1',
          identityPayload,
        ),
      },
    };
  });
}

function bySlot(identities, key) {
  return mapUnique(
    identities,
    key,
    'Process pilot identities',
    'INVALID_PROCESS_PILOT_IDENTITY_SET',
  );
}

function identitySlotBindings(identitySets, input) {
  const rows = [];
  const add = (logicalType, slotKey, stableObjectId) => {
    rows.push({
      logical_type: logicalType,
      slot_key: slotKey,
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      precomputed_stable_object_id: stableObjectId,
      binding_state: 'RESOLVED',
      authority_state: 'NOT_GRANTED',
    });
  };
  identitySets.participants.forEach((identity) => add(
    identity.logical_type,
    identity.process_participant_slot_key,
    identity.process_participant_id,
  ));
  identitySets.bidderTracks.forEach((identity) => add(
    identity.logical_type,
    identity.bidder_track_slot_key,
    identity.bidder_track_id,
  ));
  identitySets.phases.forEach((identity) => add(
    identity.logical_type,
    identity.process_phase_slot_key,
    identity.process_phase_id,
  ));
  identitySets.positions.forEach((identity) => add(
    identity.logical_type,
    identity.process_position_slot_key,
    identity.process_position_id,
  ));
  identitySets.agreements.forEach((identity) => add(
    identity.logical_type,
    identity.process_agreement_slot_key,
    identity.process_agreement_id,
  ));
  identitySets.relationships.forEach((identity) => add(
    identity.logical_type,
    identity.process_relationship_slot_key,
    identity.process_relationship_id,
  ));
  identitySets.temporals.forEach((identity) => add(
    identity.logical_type,
    identity.expected_temporal_slot_key,
    identity.temporal_expression_id,
  ));
  identitySets.passages.forEach(({ slot_key: slotKey, identity }) => add(
    identity.logical_type,
    slotKey,
    identity.process_passage_id,
  ));
  return rows.sort((left, right) => (
    compareText(left.logical_type, right.logical_type)
    || compareText(left.slot_key, right.slot_key)
  ));
}

function buildMaterialisation(input) {
  validateInputShape(input);
  const sources = sourceContext(input.source_documents);
  reconcileScopeAndValues(input);
  const registryMap = processOwnedRegistryMap();

  const narrations = buildNarrationIdentities(input, sources);
  const narrationByOrdinal = new Map(narrations.map(
    (identity) => [identity.governed_ordinal, identity],
  ));
  const eventBuild = buildEventIdentities(input, sources, narrations);
  const events = eventBuild.identities;
  const eventBySlot = bySlot(events, 'process_event_slot_key');
  const participants = buildParticipantIdentities(input);
  const participantBySlot = bySlot(
    participants,
    'process_participant_slot_key',
  );
  const bidderTracks = buildBidderTrackIdentities(input);
  const bidderTrackBySlot = bySlot(bidderTracks, 'bidder_track_slot_key');
  const phases = buildPhaseIdentities(input, bidderTrackBySlot);
  const phaseBySlot = bySlot(phases, 'process_phase_slot_key');
  const positions = buildSimpleSlotIdentities(
    input,
    'position_slots',
    ['process_position_slot_key', 'governed_ordinal'],
    buildProcessPositionIdentity,
    'Position',
  );
  const positionBySlot = bySlot(positions, 'process_position_slot_key');
  const agreements = buildSimpleSlotIdentities(
    input,
    'agreement_slots',
    ['process_agreement_slot_key', 'governed_ordinal'],
    buildProcessAgreementIdentity,
    'Agreement',
  );
  const agreementBySlot = bySlot(
    agreements,
    'process_agreement_slot_key',
  );
  const passages = buildPassageIdentities(input, sources);
  const passageBySlot = new Map(passages.map(
    (value) => [value.slot_key, value.identity],
  ));
  const endpointIdentityMap = buildEndpointIdentityMap({
    events,
    participants,
    bidderTracks,
    phases,
    positions,
    agreements,
    passages,
  });
  const temporals = buildTemporalIdentities(
    input,
    sources,
    endpointIdentityMap,
  );
  const temporalBySlot = bySlot(temporals, 'expected_temporal_slot_key');
  const relationships = buildRelationshipIdentities(
    input,
    endpointIdentityMap,
  );
  const relationshipBySlot = bySlot(
    relationships,
    'process_relationship_slot_key',
  );
  const predicateWitnesses = buildPredicateWitnessIdentities(
    input,
    narrationByOrdinal,
  );
  const predicateWitnessBySlot = new Map(predicateWitnesses.map(
    (value) => [value.slot_key, value.identity],
  ));

  const allEvidenceSets = [];
  const evidence = (spec, label) => {
    const edges = evidenceEdges(spec, sources, label);
    allEvidenceSets.push(edges);
    return edges;
  };
  const typed = input.typed_values;

  const narrationRevisions = typed.narrations.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'narration_ordinal',
      'revision_status',
      'claim_revision_ids',
      'source_role_code',
      'source_backed_attributes',
      'evidence',
    ], `Narration typed value ${index}`, code);
    const occurrence = narrationByOrdinal.get(value.narration_ordinal);
    if (!occurrence || value.revision_status !== 'PRESENT') {
      fail(code, `Narration typed value ${index} is not present and bound.`);
    }
    requireObject(
      value.source_backed_attributes,
      `Narration typed value ${index} attributes`,
      code,
    );
    if (
      Object.keys(value.source_backed_attributes).length === 0
      || Buffer.byteLength(
        canonicalJson(value.source_backed_attributes),
        'utf8',
      ) > 65536
    ) {
      fail(code, `Narration typed value ${index} attributes are invalid.`);
    }
    requireControlledCode(
      registryMap,
      'PROCESS_SOURCE_ROLE_REGISTRY',
      value.source_role_code,
      `Narration typed value ${index} source role`,
    );
    if (
      value.source_backed_attributes.source_role_code
        !== value.source_role_code
    ) {
      fail(
        code,
        `Narration typed value ${index} source role does not bind its attributes.`,
      );
    }
    const edges = evidence(
      value.evidence,
      `Narration typed value ${index} evidence`,
    );
    const intervalDigestSet = occurrence.canonical_source_interval_set
      .intervals.map((interval) => interval.exact_bytes_digest)
      .sort(compareText);
    const edgeDigestSet = edges.map(
      (edge) => edge.exact_text_digest,
    ).sort(compareText);
    if (canonicalJson(intervalDigestSet) !== canonicalJson(edgeDigestSet)) {
      fail(
        'PROCESS_PILOT_NARRATION_EVIDENCE_MISMATCH',
        `Narration typed value ${index} evidence does not cover its exact source intervals.`,
      );
    }
    requireSortedUniqueDigests(
      value.claim_revision_ids,
      `Narration typed value ${index} claim revisions`,
      { code },
    );
    return buildRevision('narration', {
      claim_revision_ids: value.claim_revision_ids,
      evidence_edges: edges,
      process_narration_occurrence_id:
        occurrence.process_narration_occurrence_id,
      relationship_revision_ids: [],
      revision_status: value.revision_status,
      source_backed_attributes: value.source_backed_attributes,
    });
  });
  const participantRevisions = typed.participants.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_participant_slot_key',
      'revision_state',
      'identity_state',
      'entity_subject_id',
      'source_local_subject_occurrence_id',
      'entity_identity_bridge_revision_id',
      'deal_participant_relationship_revision_id',
      'bidder_track_slot_key',
      'event_role_code',
      'evidence',
    ], `Participant typed value ${index}`, code);
    const identity = participantBySlot.get(
      value.process_participant_slot_key,
    );
    if (!identity) fail(code, `Participant typed value ${index} has no slot.`);
    const event = eventBySlot.get(identity.process_event_slot_key);
    if (!event) {
      fail(
        'PROCESS_EVENT_SLOT_BINDING_UNRESOLVED',
        `Participant typed value ${index} has no resolved event-slot binding.`,
      );
    }
    requireCanonicalState(value.revision_state, 'Participant revision state');
    if (![
      'NAMED',
      'GOVERNED_BRIDGE_CONFIRMED',
      'SOURCE_LOCAL_ONLY',
      'CONFLICTING',
    ].includes(value.identity_state)) {
      fail(code, `Participant typed value ${index} identity state is invalid.`);
    }
    if (
      (value.entity_subject_id === null)
      === (value.source_local_subject_occurrence_id === null)
    ) {
      fail(code, `Participant typed value ${index} needs one subject identity.`);
    }
    requireNullableDigest(
      value.entity_subject_id,
      `Participant typed value ${index} entity subject`,
      code,
    );
    requireNullableDigest(
      value.source_local_subject_occurrence_id,
      `Participant typed value ${index} source-local subject`,
      code,
    );
    requireNullableDigest(
      value.entity_identity_bridge_revision_id,
      `Participant typed value ${index} identity bridge`,
      code,
    );
    requireNullableDigest(
      value.deal_participant_relationship_revision_id,
      `Participant typed value ${index} shared relationship`,
      code,
    );
    const bidderTrack = value.bidder_track_slot_key === null
      ? null
      : bidderTrackBySlot.get(value.bidder_track_slot_key);
    if (value.bidder_track_slot_key !== null && !bidderTrack) {
      fail(code, `Participant typed value ${index} bidder track is unresolved.`);
    }
    requireControlledCode(
      registryMap,
      'PROCESS_EVENT_ROLE_REGISTRY',
      value.event_role_code,
      `Participant typed value ${index} event role`,
    );
    return buildRevision('participant', {
      bidder_track_id: bidderTrack?.bidder_track_id || null,
      deal_participant_relationship_revision_id:
        value.deal_participant_relationship_revision_id,
      entity_identity_bridge_revision_id:
        value.entity_identity_bridge_revision_id,
      entity_subject_id: value.entity_subject_id,
      event_role_code: value.event_role_code,
      evidence_edges: evidence(
        value.evidence,
        `Participant typed value ${index} evidence`,
      ),
      identity_state: value.identity_state,
      process_event_id: event.process_event_id,
      process_participant_id: identity.process_participant_id,
      revision_state: value.revision_state,
      source_local_subject_occurrence_id:
        value.source_local_subject_occurrence_id,
    });
  });
  const participantRevisionBySlot = new Map(
    typed.participants.map((value, index) => [
      value.process_participant_slot_key,
      participantRevisions[index],
    ]),
  );

  const bidderTrackRevisions = typed.bidder_tracks.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'bidder_track_slot_key',
      'entity_identity_bridge_revision_id',
      'entity_subject_id',
      'source_local_subject_occurrence_ids',
      'identity_state',
      'track_state',
      'evidence',
    ], `Bidder-track typed value ${index}`, code);
    const identity = bidderTrackBySlot.get(value.bidder_track_slot_key);
    requireNullableDigest(
      value.entity_identity_bridge_revision_id,
      `Bidder-track typed value ${index} identity bridge`,
      code,
    );
    requireNullableDigest(
      value.entity_subject_id,
      `Bidder-track typed value ${index} entity subject`,
      code,
    );
    requireSortedUniqueDigests(
      value.source_local_subject_occurrence_ids,
      `Bidder-track typed value ${index} source-local subjects`,
      { code },
    );
    if (![
      'NAMED',
      'GOVERNED_BRIDGE_CONFIRMED',
      'SOURCE_LOCAL_ONLY',
      'CONFLICTING',
    ].includes(value.identity_state)) {
      fail(code, `Bidder-track typed value ${index} identity state is invalid.`);
    }
    if (
      (value.entity_subject_id === null)
        === (value.source_local_subject_occurrence_ids.length === 0)
    ) {
      fail(code, `Bidder-track typed value ${index} needs one subject form.`);
    }
    requireControlledCode(
      registryMap,
      'PROCESS_TRACK_STATE_REGISTRY',
      value.track_state,
      `Bidder-track typed value ${index} state`,
    );
    return buildRevision('bidder_track', {
      bidder_track_id: identity.bidder_track_id,
      entity_identity_bridge_revision_id:
        value.entity_identity_bridge_revision_id,
      entity_subject_id: value.entity_subject_id,
      evidence_edges: evidence(
        value.evidence,
        `Bidder-track typed value ${index} evidence`,
      ),
      identity_state: value.identity_state,
      ordered_process_event_relationship_revision_ids: [],
      source_local_subject_occurrence_ids:
        value.source_local_subject_occurrence_ids,
      track_state: value.track_state,
    });
  });
  const bidderTrackRevisionBySlot = new Map(
    typed.bidder_tracks.map((value, index) => [
      value.bidder_track_slot_key,
      bidderTrackRevisions[index],
    ]),
  );

  const temporalRevisions = typed.temporal_expressions.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'expected_temporal_slot_key',
      'coarse_temporal_state',
      'raw_source_expression',
      'evidence',
    ], `Temporal typed value ${index}`, code);
    const identity = temporalBySlot.get(value.expected_temporal_slot_key);
    const exactText = exactTextForEvidence(
      value.evidence,
      sources,
      `Temporal typed value ${index} evidence`,
    );
    if (value.raw_source_expression !== exactText) {
      fail(
        'PROCESS_PILOT_TEMPORAL_SOURCE_MISMATCH',
        `Temporal typed value ${index} does not preserve the exact source text.`,
      );
    }
    const edges = evidence(
      value.evidence,
      `Temporal typed value ${index} evidence`,
    );
    if (edges.length !== 1) {
      fail(code, 'The release-one temporal draft requires one exact interval.');
    }
    const edge = edges[0];
    const draft = buildLosslessTemporalExpressionDraft({
      temporal_expression_identity: identity,
      coarse_temporal_state: value.coarse_temporal_state,
      raw_source_expression: value.raw_source_expression,
      source_interval: {
        coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
        admitted_source_occurrence_id:
          edge.admitted_source_occurrence_id,
        document_hash: edge.document_hash,
        absolute_start: edge.start_utf8_byte,
        absolute_end: edge.end_utf8_byte,
        exact_bytes_digest: edge.exact_text_digest,
        evidence_edge_id: edge.evidence_edge_id,
      },
      structured_nodes: [],
      computed_value: null,
      computed_derivation: null,
    });
    return buildRevision('temporal_expression', {
      coarse_temporal_state: draft.coarse_temporal_state,
      computed_derivation: draft.computed_derivation,
      computed_value: draft.computed_value,
      evidence_edges: edges,
      raw_source_expression: draft.raw_source_expression,
      source_interval: draft.source_interval,
      state: draft.state,
      structured_nodes: draft.structured_nodes,
      temporal_expression_id: draft.temporal_expression_id,
      temporal_registry_version: draft.temporal_registry_version,
    });
  });
  const temporalRevisionBySlot = new Map(
    typed.temporal_expressions.map((value, index) => [
      value.expected_temporal_slot_key,
      temporalRevisions[index],
    ]),
  );

  const phaseRevisions = typed.phases.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_phase_slot_key',
      'phase_code',
      'phase_state',
      'temporal_slot_keys',
      'evidence',
    ], `Phase typed value ${index}`, code);
    const identity = phaseBySlot.get(value.process_phase_slot_key);
    requireControlledCode(
      registryMap,
      'PROCESS_PHASE_CODE_REGISTRY',
      value.phase_code,
      `Phase typed value ${index} code`,
    );
    requireCanonicalState(value.phase_state, `Phase typed value ${index} state`);
    requireSortedUniqueGovernedKeys(
      value.temporal_slot_keys,
      `Phase typed value ${index} temporal slots`,
      { code },
    );
    const temporalIds = value.temporal_slot_keys.map((slotKey) => {
      const revision = temporalRevisionBySlot.get(slotKey);
      if (!revision) fail(code, `Phase typed value ${index} timing is unresolved.`);
      return revision.temporal_expression_revision_id;
    }).sort(compareText);
    return buildRevision('phase', {
      evidence_edges: evidence(
        value.evidence,
        `Phase typed value ${index} evidence`,
      ),
      ordered_process_event_relationship_revision_ids: [],
      phase_code: value.phase_code,
      phase_scope_kind_and_id: identity.phase_scope_kind_and_id,
      phase_state: value.phase_state,
      process_phase_id: identity.process_phase_id,
      temporal_expression_revision_ids: temporalIds,
    });
  });

  const eventRevisions = typed.events.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_event_slot_key',
      'event_type_code',
      'channel_code',
      'event_state',
      'claim_revision_ids',
      'temporal_slot_key',
      'participant_slot_keys',
      'evidence',
    ], `Event typed value ${index}`, code);
    const identity = eventBySlot.get(value.process_event_slot_key);
    const temporalRevision = value.temporal_slot_key === null
      ? null
      : temporalRevisionBySlot.get(value.temporal_slot_key);
    if (value.temporal_slot_key !== null && !temporalRevision) {
      fail(code, `Event typed value ${index} timing is unresolved.`);
    }
    requireControlledCode(
      registryMap,
      'PROCESS_EVENT_TYPE_REGISTRY',
      value.event_type_code,
      `Event typed value ${index} type`,
    );
    requireControlledCode(
      registryMap,
      'PROCESS_CHANNEL_REGISTRY',
      value.channel_code,
      `Event typed value ${index} channel`,
    );
    requireCanonicalState(value.event_state, `Event typed value ${index} state`);
    requireSortedUniqueDigests(
      value.claim_revision_ids,
      `Event typed value ${index} claim revisions`,
      { code },
    );
    requireSortedUniqueGovernedKeys(
      value.participant_slot_keys,
      `Event typed value ${index} participant slots`,
      { minimum: 1, code },
    );
    const participantRevisionIds = value.participant_slot_keys.map(
      (slotKey) => {
        const revision = participantRevisionBySlot.get(slotKey);
        if (!revision) {
          fail(code, `Event typed value ${index} participant is unresolved.`);
        }
        const participantIdentity = participantBySlot.get(slotKey);
        if (
          participantIdentity.process_event_slot_key
            !== value.process_event_slot_key
        ) {
          fail(
            'PROCESS_EVENT_PARTICIPANT_SLOT_MISMATCH',
            `Event typed value ${index} has a cross-event participant.`,
          );
        }
        return revision.process_participant_revision_id;
      },
    ).sort(compareText);
    const sourceBackedEventDefinition = {
      ...identity.event_definition_key_and_version,
      event_type_code: value.event_type_code,
      channel_code: value.channel_code,
    };
    return buildRevision('event', {
      claim_revision_ids: value.claim_revision_ids,
      event_definition_key_and_version: sourceBackedEventDefinition,
      event_state: value.event_state,
      evidence_edges: evidence(
        value.evidence,
        `Event typed value ${index} evidence`,
      ),
      ordered_process_narration_occurrence_ids:
        identity.ordered_process_narration_occurrence_ids,
      participant_relationship_revision_ids: participantRevisionIds,
      process_event_id: identity.process_event_id,
      process_relationship_revision_ids: [],
      temporal_expression_revision_id:
        temporalRevision?.temporal_expression_revision_id || null,
    });
  });
  const eventRevisionBySlot = new Map(
    typed.events.map((value, index) => [
      value.process_event_slot_key,
      eventRevisions[index],
    ]),
  );

  const positionRevisions = typed.positions.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_position_slot_key',
      'position_code',
      'position_state',
      'term_code',
      'exact_source_formulation',
      'bidder_track_slot_key',
      'process_event_slot_key',
      'process_participant_slot_key',
      'temporal_slot_key',
      'evidence',
    ], `Position typed value ${index}`, code);
    const identity = positionBySlot.get(value.process_position_slot_key);
    const bidderRevision = bidderTrackRevisionBySlot.get(
      value.bidder_track_slot_key,
    );
    const eventRevision = eventRevisionBySlot.get(value.process_event_slot_key);
    const participantRevision = participantRevisionBySlot.get(
      value.process_participant_slot_key,
    );
    const temporalRevision = value.temporal_slot_key === null
      ? null
      : temporalRevisionBySlot.get(value.temporal_slot_key);
    if (
      !bidderRevision
      || !eventRevision
      || !participantRevision
      || (value.temporal_slot_key !== null && !temporalRevision)
    ) {
      fail(code, `Position typed value ${index} has an unresolved link.`);
    }
    requireControlledCode(
      registryMap,
      'PROCESS_POSITION_CODE_REGISTRY',
      value.position_code,
      `Position typed value ${index} code`,
    );
    requireControlledCode(
      registryMap,
      'PROCESS_TERM_CODE_REGISTRY',
      value.term_code,
      `Position typed value ${index} term`,
    );
    requireCanonicalState(
      value.position_state,
      `Position typed value ${index} state`,
    );
    if (
      value.exact_source_formulation !== exactTextForEvidence(
        value.evidence,
        sources,
        `Position typed value ${index} evidence`,
      )
    ) {
      fail(
        'PROCESS_PILOT_POSITION_SOURCE_MISMATCH',
        `Position typed value ${index} does not preserve exact source wording.`,
      );
    }
    return buildRevision('position', {
      bidder_track_revision_id:
        bidderRevision.bidder_track_revision_id,
      consideration_package_revision_id: null,
      evidence_edges: evidence(
        value.evidence,
        `Position typed value ${index} evidence`,
      ),
      exact_source_formulation: value.exact_source_formulation,
      position_code: value.position_code,
      position_state: value.position_state,
      process_event_revision_id: eventRevision.process_event_revision_id,
      process_participant_revision_id:
        participantRevision.process_participant_revision_id,
      process_position_id: identity.process_position_id,
      term_code: value.term_code,
      temporal_expression_revision_id:
        temporalRevision?.temporal_expression_revision_id || null,
    });
  });
  const positionRevisionBySlot = new Map(
    typed.positions.map((value, index) => [
      value.process_position_slot_key,
      positionRevisions[index],
    ]),
  );

  const passageRevisions = typed.passages.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_passage_slot_key',
      'passage_role_codes',
      'passage_state',
      'evidence',
    ], `Passage typed value ${index}`, code);
    const identity = passageBySlot.get(value.process_passage_slot_key);
    if (!identity) fail(code, `Passage typed value ${index} has no slot.`);
    requireArray(
      value.passage_role_codes,
      `Passage typed value ${index} roles`,
      { minimum: 1, code },
    );
    value.passage_role_codes.forEach((role) => requireControlledCode(
      registryMap,
      'PROCESS_PASSAGE_ROLE_REGISTRY',
      role,
      `Passage typed value ${index} role`,
    ));
    const sortedRoles = [...value.passage_role_codes].sort(compareText);
    if (
      new Set(value.passage_role_codes).size
        !== value.passage_role_codes.length
      || canonicalJson(value.passage_role_codes) !== canonicalJson(sortedRoles)
    ) {
      fail(code, `Passage typed value ${index} roles are not sorted and unique.`);
    }
    requireCanonicalState(
      value.passage_state,
      `Passage typed value ${index} state`,
    );
    const edges = evidence(
      value.evidence,
      `Passage typed value ${index} evidence`,
    );
    const sourceIds = new Set(edges.map(
      (edge) => edge.admitted_source_occurrence_id,
    ));
    if (
      sourceIds.size !== 1
      || !sourceIds.has(identity.admitted_source_occurrence_id)
    ) {
      fail(code, `Passage typed value ${index} evidence crosses its source.`);
    }
    const source = sources.sourceDocuments.find(
      (document) => document.admitted_source_occurrence_id
        === identity.admitted_source_occurrence_id,
    );
    const exactBytes = edges.map((edge) => Buffer.from(
      source.source_text,
      'utf8',
    ).subarray(edge.start_utf8_byte, edge.end_utf8_byte));
    return buildRevision('passage', {
      citation_identity: source.citation_identity,
      evidence_edges: edges,
      passage_role_codes: value.passage_role_codes,
      passage_state: value.passage_state,
      process_passage_id: identity.process_passage_id,
      process_relationship_revision_ids: [],
      source_map: {
        coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
        intervals: identity.canonical_source_interval_set.intervals,
      },
      source_text_digest: sha256Hex(Buffer.concat(exactBytes)),
    });
  });
  const passageRevisionBySlot = new Map(
    typed.passages.map((value, index) => [
      value.process_passage_slot_key,
      passageRevisions[index],
    ]),
  );

  const agreementRevisions = typed.agreements.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_agreement_slot_key',
      'agreement_state',
      'agreement_type_code',
      'document_stage_code',
      'version_number',
      'effective_temporal_slot_key',
      'party_participant_slot_keys',
      'process_passage_slot_keys',
      'evidence',
    ], `Agreement typed value ${index}`, code);
    const identity = agreementBySlot.get(value.process_agreement_slot_key);
    requireControlledCode(
      registryMap,
      'PROCESS_AGREEMENT_TYPE_REGISTRY',
      value.agreement_type_code,
      `Agreement typed value ${index} type`,
    );
    requireControlledCode(
      registryMap,
      'PROCESS_DOCUMENT_STAGE_REGISTRY',
      value.document_stage_code,
      `Agreement typed value ${index} document stage`,
    );
    requireCanonicalState(
      value.agreement_state,
      `Agreement typed value ${index} state`,
    );
    requireInteger(
      value.version_number,
      1,
      `Agreement typed value ${index} version`,
      code,
    );
    const temporalRevision = value.effective_temporal_slot_key === null
      ? null
      : temporalRevisionBySlot.get(value.effective_temporal_slot_key);
    if (
      value.effective_temporal_slot_key !== null
      && !temporalRevision
    ) {
      fail(code, `Agreement typed value ${index} timing is unresolved.`);
    }
    requireSortedUniqueGovernedKeys(
      value.party_participant_slot_keys,
      `Agreement typed value ${index} participant slots`,
      { minimum: 1, code },
    );
    const partyRelationshipIds = value.party_participant_slot_keys.map(
      (slotKey) => {
        const participantValue = typed.participants.find(
          (participant) => participant.process_participant_slot_key
            === slotKey,
        );
        const relationshipId = participantValue
          ?.deal_participant_relationship_revision_id;
        if (!relationshipId) {
          fail(
            'PROCESS_PILOT_SHARED_PARTY_ROLE_UNRESOLVED',
            `Agreement typed value ${index} has no Shared Authority party-role revision.`,
          );
        }
        return relationshipId;
      },
    ).sort(compareText);
    requireSortedUniqueGovernedKeys(
      value.process_passage_slot_keys,
      `Agreement typed value ${index} passage slots`,
      { minimum: 1, code },
    );
    const passageRevisionIds = value.process_passage_slot_keys.map(
      (slotKey) => {
        const revision = passageRevisionBySlot.get(slotKey);
        if (!revision) fail(code, `Agreement typed value ${index} passage is unresolved.`);
        return revision.process_passage_revision_id;
      },
    ).sort(compareText);
    return buildRevision('agreement', {
      agreement_state: value.agreement_state,
      agreement_type_code: value.agreement_type_code,
      document_stage_code: value.document_stage_code,
      effective_temporal_expression_revision_id:
        temporalRevision?.temporal_expression_revision_id || null,
      evidence_edges: evidence(
        value.evidence,
        `Agreement typed value ${index} evidence`,
      ),
      party_relationship_revision_ids: partyRelationshipIds,
      process_agreement_id: identity.process_agreement_id,
      process_passage_revision_ids: passageRevisionIds,
      process_relationship_revision_ids: [],
      version_number: value.version_number,
    });
  });
  const agreementRevisionBySlot = new Map(
    typed.agreements.map((value, index) => [
      value.process_agreement_slot_key,
      agreementRevisions[index],
    ]),
  );

  const endpointRevisionMap = new Map();
  const addEndpointRevision = (logicalType, slotKey, revision, idKey) => {
    endpointRevisionMap.set(
      `${logicalType}:${slotKey}`,
      revision[idKey],
    );
  };
  typed.events.forEach((value, index) => addEndpointRevision(
    'ProcessEvent',
    value.process_event_slot_key,
    eventRevisions[index],
    'process_event_revision_id',
  ));
  typed.participants.forEach((value, index) => addEndpointRevision(
    'ProcessParticipant',
    value.process_participant_slot_key,
    participantRevisions[index],
    'process_participant_revision_id',
  ));
  typed.bidder_tracks.forEach((value, index) => addEndpointRevision(
    'BidderTrack',
    value.bidder_track_slot_key,
    bidderTrackRevisions[index],
    'bidder_track_revision_id',
  ));
  typed.phases.forEach((value, index) => addEndpointRevision(
    'ProcessPhase',
    value.process_phase_slot_key,
    phaseRevisions[index],
    'process_phase_revision_id',
  ));
  typed.positions.forEach((value, index) => addEndpointRevision(
    'ProcessPosition',
    value.process_position_slot_key,
    positionRevisions[index],
    'process_position_revision_id',
  ));
  typed.agreements.forEach((value, index) => addEndpointRevision(
    'ProcessAgreement',
    value.process_agreement_slot_key,
    agreementRevisions[index],
    'process_agreement_revision_id',
  ));
  typed.passages.forEach((value, index) => addEndpointRevision(
    'ProcessPassage',
    value.process_passage_slot_key,
    passageRevisions[index],
    'process_passage_revision_id',
  ));

  const relationshipRevisions = typed.relationships.map((value, index) => {
    const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
    requireExactKeys(value, [
      'process_relationship_slot_key',
      'relationship_type_code',
      'relationship_effect',
      'relationship_state',
      'temporal_slot_key',
      'evidence',
    ], `Relationship typed value ${index}`, code);
    const identity = relationshipBySlot.get(
      value.process_relationship_slot_key,
    );
    const scope = input.frozen_scope.relationship_slots.find(
      (slot) => slot.process_relationship_slot_key
        === value.process_relationship_slot_key,
    );
    requireControlledCode(
      registryMap,
      'PROCESS_RELATIONSHIP_TYPE_REGISTRY',
      value.relationship_type_code,
      `Relationship typed value ${index} type`,
    );
    requireCanonicalState(
      value.relationship_state,
      `Relationship typed value ${index} state`,
    );
    requireObject(
      value.relationship_effect,
      `Relationship typed value ${index} effect`,
      code,
    );
    if (Object.keys(value.relationship_effect).length === 0) {
      fail(code, `Relationship typed value ${index} effect is empty.`);
    }
    const sourceRevisionId = endpointRevisionMap.get(
      `${scope.source_endpoint.logical_type}:${scope.source_endpoint.slot_key}`,
    );
    const targetRevisionId = endpointRevisionMap.get(
      `${scope.target_endpoint.logical_type}:${scope.target_endpoint.slot_key}`,
    );
    if (!sourceRevisionId || !targetRevisionId) {
      fail(
        'PROCESS_PILOT_RELATIONSHIP_ENDPOINT_UNRESOLVED',
        `Relationship typed value ${index} endpoint revision is unresolved.`,
      );
    }
    const temporalRevision = value.temporal_slot_key === null
      ? null
      : temporalRevisionBySlot.get(value.temporal_slot_key);
    if (value.temporal_slot_key !== null && !temporalRevision) {
      fail(code, `Relationship typed value ${index} timing is unresolved.`);
    }
    return buildRevision('relationship', {
      evidence_edges: evidence(
        value.evidence,
        `Relationship typed value ${index} evidence`,
      ),
      process_relationship_id: identity.process_relationship_id,
      relationship_effect: value.relationship_effect,
      relationship_state: value.relationship_state,
      relationship_type_code: value.relationship_type_code,
      source_revision_id: sourceRevisionId,
      target_revision_id: targetRevisionId,
      temporal_expression_revision_id:
        temporalRevision?.temporal_expression_revision_id || null,
    });
  });
  const relationshipRevisionBySlot = new Map(
    typed.relationships.map((value, index) => [
      value.process_relationship_slot_key,
      relationshipRevisions[index],
    ]),
  );

  const predicateWitnessRevisions = typed.predicate_witnesses.map(
    (value, index) => {
      const code = 'INVALID_PROCESS_PILOT_TYPED_VALUE';
      requireExactKeys(value, [
        'predicate_witness_slot_key',
        'predicate_key',
        'predicate_state',
        'subject_code',
        'bidder_track_slot_key',
        'process_event_slot_key',
        'process_participant_slot_keys',
        'process_passage_slot_keys',
        'process_position_slot_keys',
        'process_agreement_slot_keys',
        'process_relationship_slot_keys',
        'temporal_slot_keys',
        'evidence',
      ], `Predicate-witness typed value ${index}`, code);
      const identity = predicateWitnessBySlot.get(
        value.predicate_witness_slot_key,
      );
      if (
        !identity
        || identity.predicate_definition_key_and_version.key
          !== value.predicate_key
      ) {
        fail(code, `Predicate-witness typed value ${index} identity is unresolved.`);
      }
      const subjectCodes = predicateCatalogueContract.definition
        .subject_contract.initial_subject_codes;
      if (!subjectCodes.includes(value.subject_code)) {
        fail(
          'UNRESOLVED_PROCESS_CONTROLLED_CODE',
          `Predicate-witness typed value ${index} subject is not governed.`,
          {
            registry_stable_id: 'PROCESS_EXCLUSIVITY_SUBJECT_CODE_SET',
            unresolved_source_value: value.subject_code,
            materialisation_state: 'BLOCKED',
            near_code_mapping_permitted: false,
          },
        );
      }
      requireCanonicalState(
        value.predicate_state,
        `Predicate-witness typed value ${index} state`,
      );
      const bidderRevision = bidderTrackRevisionBySlot.get(
        value.bidder_track_slot_key,
      );
      const eventRevision = eventRevisionBySlot.get(
        value.process_event_slot_key,
      );
      if (!bidderRevision || !eventRevision) {
        fail(code, `Predicate-witness typed value ${index} context is unresolved.`);
      }
      const resolveMany = (slotKeys, revisionMap, idKey, label) => (
        requireSortedUniqueGovernedKeys(
          slotKeys,
          `Predicate-witness typed value ${index} ${label} slots`,
          { minimum: label === 'passage' ? 1 : 0, code },
        ).map((slotKey) => {
          const revision = revisionMap.get(slotKey);
          if (!revision) {
            fail(code, `Predicate-witness typed value ${index} ${label} is unresolved.`);
          }
          return revision[idKey];
        }).sort(compareText)
      );
      const edges = evidence(
        value.evidence,
        `Predicate-witness typed value ${index} evidence`,
      );
      if (
        value.predicate_key === 'EXCLUSIVITY_EXPRESS_REFUSAL'
        && edges.length === 0
      ) {
        fail(
          'PROCESS_PILOT_REFUSAL_NEEDS_POSITIVE_WITNESS',
          'Silence cannot materialise an express refusal.',
        );
      }
      return buildRevision('predicate_witness', {
        bidder_track_revision_id:
          bidderRevision.bidder_track_revision_id,
        evidence_edges: edges,
        predicate_key: value.predicate_key,
        predicate_state: value.predicate_state,
        process_agreement_revision_ids: resolveMany(
          value.process_agreement_slot_keys,
          agreementRevisionBySlot,
          'process_agreement_revision_id',
          'agreement',
        ),
        process_event_revision_id:
          eventRevision.process_event_revision_id,
        process_participant_revision_ids: resolveMany(
          value.process_participant_slot_keys,
          participantRevisionBySlot,
          'process_participant_revision_id',
          'participant',
        ),
        process_passage_revision_ids: resolveMany(
          value.process_passage_slot_keys,
          passageRevisionBySlot,
          'process_passage_revision_id',
          'passage',
        ),
        process_position_revision_ids: resolveMany(
          value.process_position_slot_keys,
          positionRevisionBySlot,
          'process_position_revision_id',
          'position',
        ),
        process_predicate_witness_id:
          identity.process_predicate_witness_id,
        process_relationship_revision_ids: resolveMany(
          value.process_relationship_slot_keys,
          relationshipRevisionBySlot,
          'process_relationship_revision_id',
          'relationship',
        ),
        subject_code: value.subject_code,
        temporal_expression_revision_ids: resolveMany(
          value.temporal_slot_keys,
          temporalRevisionBySlot,
          'temporal_expression_revision_id',
          'temporal expression',
        ),
      });
    },
  );

  const eventSlotBindings = eventBuild.frozenEventSlotUniverse
    .expected_event_slots.map((slot) => ({
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      governed_deal_admission_id: input.governed_deal_admission_id,
      process_event_slot_key: slot.process_event_slot_key,
      event_definition_key_and_version:
        slot.event_definition_key_and_version,
      ordered_process_narration_occurrence_ids:
        slot.ordered_process_narration_occurrence_ids,
      governed_ordinal: slot.governed_ordinal,
      precomputed_process_event_id: slot.precomputed_process_event_id,
      binding_state: 'RESOLVED',
      authority_state: 'NOT_GRANTED',
    }));
  const participantEventBindings = participants.map((identity) => {
    const event = eventBySlot.get(identity.process_event_slot_key);
    if (!event) {
      fail(
        'PROCESS_EVENT_SLOT_BINDING_UNRESOLVED',
        'A participant event-slot binding did not resolve.',
      );
    }
    return {
      process_participant_id: identity.process_participant_id,
      process_event_slot_key: identity.process_event_slot_key,
      process_event_id: event.process_event_id,
      binding_state: 'RESOLVED',
      authority_state: 'NOT_GRANTED',
    };
  });

  const revisions = {
    narration_revisions: narrationRevisions,
    event_revisions: eventRevisions,
    participant_revisions: participantRevisions,
    bidder_track_revisions: bidderTrackRevisions,
    phase_revisions: phaseRevisions,
    position_revisions: positionRevisions,
    agreement_revisions: agreementRevisions,
    relationship_revisions: relationshipRevisions,
    temporal_expression_revisions: temporalRevisions,
    predicate_witness_revisions: predicateWitnessRevisions,
    passage_revisions: passageRevisions,
  };
  Object.entries(revisions).forEach(([key, values]) => {
    const type = {
      narration_revisions: 'narration',
      event_revisions: 'event',
      participant_revisions: 'participant',
      bidder_track_revisions: 'bidder_track',
      phase_revisions: 'phase',
      position_revisions: 'position',
      agreement_revisions: 'agreement',
      relationship_revisions: 'relationship',
      temporal_expression_revisions: 'temporal_expression',
      predicate_witness_revisions: 'predicate_witness',
      passage_revisions: 'passage',
    }[key];
    values.forEach((revision) => requireRevision(revision, type));
  });

  const controlledRegistryDefinitionDigest = sha256Hex(Buffer.from(
    canonicalJson(controlledCodeRegistryContract.definition),
    'utf8',
  ));
  const body = {
    schema_version: MATERIALISATION_RECEIPT_SCHEMA,
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    controlled_code_registry_binding: {
      stable_id: controlledCodeRegistryContract.stable_id,
      schema_version: controlledCodeRegistryContract.schema_version,
      definition_digest: controlledRegistryDefinitionDigest,
      registry_state:
        controlledCodeRegistryContract.definition.registry_state,
    },
    source_document_bindings: sources.sourceDocuments.map((source) => ({
      admitted_source_occurrence_id:
        source.admitted_source_occurrence_id,
      source_document_identity: source.source_document_identity,
      source_revision_id: source.source_revision_id,
      document_hash: source.document_hash,
      document_ordinal: source.document_ordinal,
      source_text_digest: source.source_text_digest,
      citation_identity: source.citation_identity,
      evidence_validation_receipt_id:
        source.evidence_validation_receipt_id,
    })).sort((left, right) => left.document_ordinal - right.document_ordinal),
    exact_source_slices: exactSourceSlicesFromEdges(
      allEvidenceSets,
      sources,
    ),
    event_slot_bindings: eventSlotBindings,
    participant_event_bindings: participantEventBindings,
    occurrence_slot_bindings: identitySlotBindings({
      participants,
      bidderTracks,
      phases,
      positions,
      agreements,
      relationships,
      temporals,
      passages,
    }, input),
    identities: {
      narration_occurrences: narrations,
      events,
      participants,
      bidder_tracks: bidderTracks,
      phases,
      positions,
      agreements,
      relationships,
      temporal_expressions: temporals,
      predicate_witnesses: predicateWitnesses.map(
        (value) => value.identity,
      ),
      passages: passages.map((value) => value.identity),
    },
    revisions,
    source_interval_state: 'EXACT_UTF8_INTERVALS_VALIDATED',
    controlled_code_state: 'CLOSED_AND_RECONCILED',
    materialisation_state: 'VALIDATED_SIDECAR_ONLY',
    external_operation_state: 'NOT_PERFORMED',
    authority_state: 'NOT_GRANTED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    materialisation_receipt_id: contentId(
      MATERIALISATION_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileProcessExclusivityPilotMaterialisation(input) {
  return deepFreeze(buildMaterialisation(input));
}

function validateProcessExclusivityPilotMaterialisation(value, input) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION';
  const rebuilt = buildMaterialisation(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The Process exclusivity pilot materialisation was changed.');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  EVIDENCE_EDGE_SCHEMA,
  MATERIALISATION_INPUT_SCHEMA,
  MATERIALISATION_RECEIPT_SCHEMA,
  ProcessExclusivityPilotError,
  compileProcessExclusivityPilotMaterialisation,
  validateProcessExclusivityPilotMaterialisation,
};
