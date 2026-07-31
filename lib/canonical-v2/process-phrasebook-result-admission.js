const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProcessNarrationOccurrence,
} = require('./process-narration-occurrence');
const {
  validateProcessPassageOrderProjection,
} = require('./process-passage-order');
const {
  validateProcessPhrasebookResultIdentity,
} = require('./process-phrasebook-result');
const {
  validateAuthoredProcessPredicateInputs,
} = require('./process-predicate-contract-input-validator');
const {
  validateAuthoredProcessResultActionInputs,
} = require('./process-result-action-contract-input-validator');
const {
  validateAuthoredProcessServingInputs,
} = require('./process-serving-contract-input-validator');
const {
  PREDICATE_SEMANTIC_KINDS,
} = require('./process-exclusivity-contract');

const narrationContract = require(
  '../../contracts/canonical-v2/successor/process/narration/process-narration-occurrence.v1.json',
);
const predicateWitnessContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v2.json',
);
const predicateCatalogueContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);
const predicateChallengeContract = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
);
const resultContract = require(
  '../../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);

const servingContracts = Object.freeze([
  require(
    '../../contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
  ),
  resultContract,
  require(
    '../../contracts/canonical-v2/successor/process/serving/bounded-inline-passage-preview.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/parent-bound-paragraph-context.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/related-passage-child-collection.v1.json',
  ),
]);

const resultActionContracts = Object.freeze([
  require(
    '../../contracts/canonical-v2/successor/process/actions/process-release-pinned-citation-and-share.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/actions/process-rerun-on-active-release.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/actions/process-saved-query-definition.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/actions/process-selected-result-export.v1.json',
  ),
]);

const PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA =
  'PROCESS_EXACT_EVIDENCE_EDGE/V1';
const PROCESS_NARRATION_REVISION_SCHEMA =
  'PROCESS_NARRATION_REVISION/V1';
const PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA =
  'PREDICATE_WITNESS_REVISION/V2';
const PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA =
  'PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE/V1';
const PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA =
  'PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW/V1';
const PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA =
  'PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE/V1';
const PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA =
  'PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP/V1';
const PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA =
  'PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT/V1';

const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const MAX_EVIDENCE_EDGES = 64;
const MAX_REVISION_IDS = 128;
const NARRATION_REVISION_STATUS = 'PRESENT';
const PREDICATE_STATE = 'PRESENT';
const RESPONSE_UNION_PREDICATE_KEY =
  predicateCatalogueContract.definition.response_contract
    .generic_union_predicate_key;
const ATOMIC_RESPONSE_PREDICATE_KEYS = new Set(
  predicateCatalogueContract.definition.response_contract
    .atomic_response_predicate_keys,
);
const SUCCESSOR_MACHINE_RULES = new Map(
  predicateCatalogueContract.definition
    .successor_predicate_definition_contract.definitions.map(
      (definition) => [
        definition.predicate_key,
        definition.machine_rule,
      ],
    ),
);
const TERMINAL_TYPES = Object.freeze([
  'PROCESS_NARRATION_REVISION',
  'PREDICATE_WITNESS_REVISION',
]);
const DIMENSION_FIELDS = Object.freeze([
  Object.freeze({
    field: 'bidder_track_revision_id',
    terminal_type: 'BIDDER_TRACK_REVISION',
    cardinality: 'NULLABLE_ONE',
  }),
  Object.freeze({
    field: 'process_agreement_revision_ids',
    terminal_type: 'PROCESS_AGREEMENT_REVISION',
    cardinality: 'MANY',
  }),
  Object.freeze({
    field: 'process_event_revision_id',
    terminal_type: 'PROCESS_EVENT_REVISION',
    cardinality: 'NULLABLE_ONE',
  }),
  Object.freeze({
    field: 'process_participant_revision_ids',
    terminal_type: 'PROCESS_PARTICIPANT_REVISION',
    cardinality: 'MANY',
  }),
  Object.freeze({
    field: 'process_passage_revision_ids',
    terminal_type: 'PROCESS_PASSAGE_REVISION',
    cardinality: 'MANY',
  }),
  Object.freeze({
    field: 'process_position_revision_ids',
    terminal_type: 'PROCESS_POSITION_REVISION',
    cardinality: 'MANY',
  }),
  Object.freeze({
    field: 'process_relationship_revision_ids',
    terminal_type: 'PROCESS_RELATIONSHIP_REVISION',
    cardinality: 'MANY',
  }),
  Object.freeze({
    field: 'temporal_expression_revision_ids',
    terminal_type: 'TEMPORAL_EXPRESSION_REVISION',
    cardinality: 'MANY',
  }),
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  result_materialisation: 'NONE',
  narration_revision_creation: 'NONE',
  predicate_witness_creation: 'NONE',
  lineage_creation: 'NONE',
  preview_creation: 'NONE',
  ordering: 'NONE',
  source_read: 'NONE',
  extraction: 'NONE',
  query: 'NONE',
  exact_detail_execution: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPhrasebookResultAdmissionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPhrasebookResultAdmissionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPhrasebookResultAdmissionError(
    code,
    message,
    details,
  );
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

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireExactValue(
  actual,
  expected,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual,
      expected,
    });
  }
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a full lower-case SHA-256 digest.`);
  }
  return value;
}

function requireGovernedKey(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed upper-case key.`);
  }
  return value;
}

function requireText(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
  maximumBytes = 512,
  trimRequired = true,
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || (trimRequired && value.trim() !== value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes
  ) {
    fail(code, `${label} must be bounded non-empty UTF-8 text.`);
  }
  return value;
}

function requireInteger(
  value,
  minimum,
  maximum,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(code, `${label} is outside the governed range.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process phrasebook admission value is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function without(value, key) {
  const body = clone(value);
  delete body[key];
  return body;
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function contractMember(canonicalValue) {
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function validateContractBinding() {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_CONTRACT_BINDING';
  try {
    validateAuthoredProcessServingInputs(
      servingContracts.map(contractMember),
    );
    validateAuthoredProcessResultActionInputs(
      resultActionContracts.map(contractMember),
    );
    validateAuthoredProcessPredicateInputs([
      predicateCatalogueContract,
      predicateChallengeContract,
    ].map(contractMember));
  } catch (error) {
    fail(code, 'A signed Process admission contract has changed.', {
      cause: error.code || error.message,
    });
  }
  requireExactValue(
    narrationContract.definition.revision_identity,
    {
      revision_type: 'ProcessNarrationRevision',
      revision_id_domain: PROCESS_NARRATION_REVISION_SCHEMA,
      immutable_inputs: [
        'claim_revision_ids',
        'evidence_edges',
        'process_narration_occurrence_id',
        'relationship_revision_ids',
        'revision_status',
        'source_backed_attributes',
      ],
    },
    'Process narration revision identity',
    code,
  );
  requireExactValue(
    predicateWitnessContract.definition.revision_identity,
    {
      revision_type: 'PredicateWitnessRevision',
      revision_id_domain: PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      immutable_inputs: [
        'applicability_evidence_edges',
        'atomic_response_predicate_key',
        'atomic_response_predicate_witness_revision_id',
        'bidder_track_revision_id',
        'complete_scope_evidence_edges',
        'complete_scope_identity',
        'complete_scope_payload',
        'dimension_revision_bindings',
        'evidence_edges',
        'failure_detail',
        'predicate_key',
        'predicate_state',
        'process_agreement_revision_ids',
        'process_event_revision_id',
        'process_participant_revision_ids',
        'process_passage_revision_ids',
        'process_position_revision_ids',
        'process_predicate_witness_id',
        'process_relationship_revision_ids',
        'source_semantic_kind',
        'subject_code',
        'temporal_expression_revision_ids',
      ],
    },
    'Process predicate-witness revision identity',
    code,
  );
  requireExactValue(
    resultContract.definition.lineage_contract.required_terminal_types,
    TERMINAL_TYPES,
    'Process phrasebook result terminal types',
    code,
  );
  requireExactValue(
    resultContract.definition.release_treatment,
    {
      prewrite_admission_release_state: 'NOT_RELEASE_BOUND',
      candidate_membership_established_by:
        'PRODUCT_QUERY_RESULT_RELEASE_PARTITION/V1',
      candidate_membership_required_before_product_candidate_write: false,
      candidate_membership_required_before_product_release: true,
      release_pinned: true,
      immutable_after_release: true,
      exact_release_citation_redirect: false,
    },
    'Process phrasebook pre-write release treatment',
    code,
  );
}

function requireSortedUniqueDigests(
  value,
  label,
  {
    minimum = 0,
    maximum = MAX_REVISION_IDS,
    code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT',
  } = {},
) {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
  ) {
    fail(code, `${label} has invalid cardinality.`);
  }
  value.forEach((entry, index) => {
    requireDigest(entry, `${label} ${index}`, code);
  });
  const sorted = [...value].sort(compareText);
  if (
    new Set(value).size !== value.length
    || canonicalJson(value) !== canonicalJson(sorted)
  ) {
    fail(code, `${label} must be a sorted unique digest set.`);
  }
  return value;
}

function compareEvidenceEdges(left, right) {
  for (const key of [
    'document_ordinal',
    'start_utf8_byte',
    'end_utf8_byte',
    'evidence_role_key',
    'evidence_edge_id',
  ]) {
    const comparison = left[key] < right[key]
      ? -1
      : left[key] > right[key]
        ? 1
        : 0;
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function evidenceEdgeIdentityPayload(value) {
  return without(value, 'evidence_edge_id');
}

function validateEvidenceEdge(value, index, code) {
  requireExactKeys(value, [
    'schema_version',
    'evidence_edge_id',
    'evidence_role_key',
    'admitted_source_occurrence_id',
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'document_ordinal',
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text_digest',
    'evidence_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], `Process exact-evidence edge ${index}`, code);
  if (
    value.schema_version !== PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, `Process exact-evidence edge ${index} state is invalid.`);
  }
  requireGovernedKey(
    value.evidence_role_key,
    `Evidence edge ${index} role`,
    code,
  );
  [
    'evidence_edge_id',
    'admitted_source_occurrence_id',
    'source_document_identity',
    'source_revision_id',
    'document_hash',
    'exact_text_digest',
    'evidence_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Evidence edge ${index} ${key}`, code);
  });
  requireInteger(
    value.document_ordinal,
    0,
    Number.MAX_SAFE_INTEGER,
    `Evidence edge ${index} document ordinal`,
    code,
  );
  requireInteger(
    value.start_utf8_byte,
    0,
    Number.MAX_SAFE_INTEGER,
    `Evidence edge ${index} start`,
    code,
  );
  requireInteger(
    value.end_utf8_byte,
    1,
    Number.MAX_SAFE_INTEGER,
    `Evidence edge ${index} end`,
    code,
  );
  if (
    value.end_utf8_byte <= value.start_utf8_byte
    || value.evidence_edge_id !== contentId(
      PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
      evidenceEdgeIdentityPayload(value),
    )
  ) {
    fail(code, `Process exact-evidence edge ${index} is invalid.`);
  }
}

function validateEvidenceEdges(value, label, code) {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > MAX_EVIDENCE_EDGES
  ) {
    fail(code, `${label} must contain bounded exact evidence.`);
  }
  value.forEach((edge, index) => validateEvidenceEdge(edge, index, code));
  if (
    new Set(value.map((edge) => edge.evidence_edge_id)).size
      !== value.length
    || canonicalJson(value) !== canonicalJson(
      [...value].sort(compareEvidenceEdges),
    )
  ) {
    fail(code, `${label} must be a canonically ordered unique edge set.`);
  }
}

function validateCandidateManifestBinding(value, release, label, code) {
  if (
    value.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
  ) {
    fail(code, `${label} does not bind the exact candidate release.`);
  }
}

function validateReleaseBinding(value, release, label, code) {
  validateCandidateManifestBinding(value, release, label, code);
  if (value.corpus_release_id !== release.corpus_release_id) {
    fail(code, `${label} does not bind the exact corpus release.`);
  }
}

function narrationRevisionIdentityPayload(value) {
  return {
    claim_revision_ids: value.claim_revision_ids,
    evidence_edges: value.evidence_edges,
    process_narration_occurrence_id:
      value.process_narration_occurrence
        .process_narration_occurrence_id,
    relationship_revision_ids: value.relationship_revision_ids,
    revision_status: value.revision_status,
    source_backed_attributes: value.source_backed_attributes,
  };
}

function evidenceMatchesNarrationInterval(edge, interval) {
  return edge.admitted_source_occurrence_id
      === interval.admitted_source_occurrence_id
    && edge.document_hash === interval.document_hash
    && edge.document_ordinal === interval.document_ordinal
    && edge.start_utf8_byte === interval.absolute_start
    && edge.end_utf8_byte === interval.absolute_end
    && edge.exact_text_digest === interval.exact_bytes_digest;
}

function validateNarrationRevision(value, resultIdentity, release) {
  const code = 'INVALID_PROCESS_NARRATION_REVISION';
  requireExactKeys(value, [
    'schema_version',
    'process_narration_revision_id',
    'process_narration_occurrence',
    'claim_revision_ids',
    'evidence_edges',
    'relationship_revision_ids',
    'revision_status',
    'source_backed_attributes',
    'conflict_state',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process narration revision', code);
  if (
    value.schema_version !== PROCESS_NARRATION_REVISION_SCHEMA
    || value.revision_status !== NARRATION_REVISION_STATUS
    || value.conflict_state !== 'NO_CONFLICT'
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process narration revision state is not admissible.');
  }
  [
    'process_narration_revision_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Narration revision ${key}`, code);
  });
  try {
    validateProcessNarrationOccurrence(value.process_narration_occurrence);
  } catch (error) {
    fail(code, 'The Process narration occurrence is invalid.', {
      cause: error.code || error.message,
    });
  }
  const occurrence = value.process_narration_occurrence;
  if (
    occurrence.process_narration_occurrence_id
      !== resultIdentity.precomputed_process_narration_occurrence_id
    || occurrence.frozen_contract_pair_digest
      !== resultIdentity.frozen_contract_pair_digest
    || occurrence.governed_deal_admission_id
      !== resultIdentity.governed_deal_admission_id
    || occurrence.governed_ordinal !== resultIdentity.governed_ordinal
  ) {
    fail(code, 'The narration revision does not bind the result identity.');
  }
  requireSortedUniqueDigests(value.claim_revision_ids, 'Claim revision IDs', {
    code,
  });
  requireSortedUniqueDigests(
    value.relationship_revision_ids,
    'Narration relationship revision IDs',
    { code },
  );
  validateEvidenceEdges(value.evidence_edges, 'Narration evidence edges', code);
  requireObject(value.source_backed_attributes, 'Source-backed attributes', code);
  if (
    Object.keys(value.source_backed_attributes).length === 0
    || Buffer.byteLength(
      canonicalJson(value.source_backed_attributes),
      'utf8',
    ) > 65536
  ) {
    fail(code, 'Present narration needs bounded source-backed attributes.');
  }
  const intervals = occurrence.canonical_source_interval_set.intervals;
  if (
    value.evidence_edges.length !== intervals.length
    || intervals.some((interval) => (
      !value.evidence_edges.some(
        (edge) => evidenceMatchesNarrationInterval(edge, interval),
      )
    ))
  ) {
    fail(code, 'Narration evidence does not cover the exact source intervals.');
  }
  validateReleaseBinding(value, release, 'Narration revision', code);
  if (
    value.process_narration_revision_id !== contentId(
      PROCESS_NARRATION_REVISION_SCHEMA,
      narrationRevisionIdentityPayload(value),
    )
  ) {
    fail(code, 'The Process narration revision identity is invalid.');
  }
}

function predicateWitnessIdentityPayload(value) {
  return {
    frozen_contract_pair_digest: value.frozen_contract_pair_digest,
    governed_deal_admission_id: value.governed_deal_admission_id,
    process_narration_occurrence_id:
      value.process_narration_occurrence_id,
    predicate_definition_key_and_version:
      value.predicate_definition_key_and_version,
    predicate_evidence_role_slot_key:
      value.predicate_evidence_role_slot_key,
    governed_ordinal: value.governed_ordinal,
  };
}

function validatePredicateWitnessIdentity(
  value,
  resultIdentity,
  narrationRevision,
) {
  const code = 'INVALID_PROCESS_PREDICATE_WITNESS_IDENTITY';
  requireExactKeys(value, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_narration_occurrence_id',
    'predicate_definition_key_and_version',
    'predicate_evidence_role_slot_key',
    'governed_ordinal',
    'process_predicate_witness_id',
  ], 'Process predicate-witness identity', code);
  [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_narration_occurrence_id',
    'process_predicate_witness_id',
  ].forEach((key) => {
    requireDigest(value[key], `Predicate-witness ${key}`, code);
  });
  requireExactKeys(value.predicate_definition_key_and_version, [
    'key',
    'version',
  ], 'Predicate definition', code);
  requireGovernedKey(
    value.predicate_definition_key_and_version.key,
    'Predicate definition key',
    code,
  );
  requireInteger(
    value.predicate_definition_key_and_version.version,
    1,
    Number.MAX_SAFE_INTEGER,
    'Predicate definition version',
    code,
  );
  requireGovernedKey(
    value.predicate_evidence_role_slot_key,
    'Predicate evidence-role slot key',
    code,
  );
  requireInteger(
    value.governed_ordinal,
    0,
    Number.MAX_SAFE_INTEGER,
    'Predicate-witness governed ordinal',
    code,
  );
  const predicates = predicateCatalogueContract.definition
    .ordinary_question_contract.mandatory_predicate_keys;
  if (
    value.predicate_definition_key_and_version.version !== 1
    || !predicates.includes(
      value.predicate_definition_key_and_version.key,
    )
    || value.frozen_contract_pair_digest
      !== resultIdentity.frozen_contract_pair_digest
    || value.governed_deal_admission_id
      !== resultIdentity.governed_deal_admission_id
    || value.process_narration_occurrence_id
      !== narrationRevision.process_narration_occurrence
        .process_narration_occurrence_id
    || value.process_narration_occurrence_id
      !== resultIdentity.precomputed_process_narration_occurrence_id
    || value.predicate_evidence_role_slot_key
      !== resultIdentity.exact_evidence_role_slot_key
    || value.governed_ordinal !== resultIdentity.governed_ordinal
    || value.process_predicate_witness_id !== contentId(
      'PROCESS_PREDICATE_WITNESS/V1',
      predicateWitnessIdentityPayload(value),
    )
  ) {
    fail(code, 'The predicate-witness identity is not result-bound.');
  }
}

function expectedDimensionRevisionPairs(value) {
  const pairs = [];
  for (const definition of DIMENSION_FIELDS) {
    const revisionValue = value[definition.field];
    if (definition.cardinality === 'NULLABLE_ONE') {
      if (revisionValue !== null) {
        pairs.push({
          terminal_type: definition.terminal_type,
          revision_id: revisionValue,
        });
      }
    } else {
      revisionValue.forEach((revisionId) => {
        pairs.push({
          terminal_type: definition.terminal_type,
          revision_id: revisionId,
        });
      });
    }
  }
  return pairs.sort((left, right) => (
    compareText(left.terminal_type, right.terminal_type)
    || compareText(left.revision_id, right.revision_id)
  ));
}

function dimensionRevisionCount(value, terminalType) {
  const definition = DIMENSION_FIELDS.find(
    (entry) => entry.terminal_type === terminalType,
  );
  if (!definition) return 0;
  const revisionValue = value[definition.field];
  return definition.cardinality === 'NULLABLE_ONE'
    ? Number(revisionValue !== null)
    : revisionValue.length;
}

function governedCardinalityMatches(count, cardinality) {
  return {
    ONE: count === 1,
    ONE_OR_MORE: count >= 1,
    ZERO_OR_ONE: count <= 1,
    ZERO_OR_MORE: true,
  }[cardinality] === true;
}

function validateSuccessorWitnessMachineRule(value, code) {
  const rule = SUCCESSOR_MACHINE_RULES.get(value.predicate_key);
  if (!rule) return;
  const governedFamilies = new Map([
    ...rule.required_typed_link_families,
    ...rule.optional_typed_link_families,
  ].map((family) => [family.terminal_type, family.cardinality]));
  for (const family of governedFamilies.keys()) {
    if (!governedCardinalityMatches(
      dimensionRevisionCount(value, family),
      governedFamilies.get(family),
    )) {
      fail(code, 'The successor predicate typed-link cardinality is invalid.');
    }
  }
  for (const definition of DIMENSION_FIELDS) {
    if (
      dimensionRevisionCount(value, definition.terminal_type) > 0
      && !governedFamilies.has(definition.terminal_type)
    ) {
      fail(code, 'The successor predicate uses an unlisted typed-link family.');
    }
  }
  if (
    dimensionRevisionCount(
      value,
      rule.primary_value_carrier_terminal_type,
    ) < 1
  ) {
    fail(code, 'The successor predicate omits its primary value carrier.');
  }
}

function validateDimensionRevisionBindings(
  bindings,
  witnessRevision,
  code,
) {
  if (!Array.isArray(bindings) || bindings.length > MAX_REVISION_IDS) {
    fail(code, 'Predicate dimension lineage has invalid cardinality.');
  }
  const evidenceIds = new Set(
    witnessRevision.evidence_edges.map((edge) => edge.evidence_edge_id),
  );
  const actualPairs = [];
  bindings.forEach((binding, index) => {
    requireExactKeys(binding, [
      'terminal_type',
      'revision_id',
      'evidence_edge_ids',
      'external_validation_receipt_id',
      'validation_state',
      'authority_state',
    ], `Predicate dimension lineage binding ${index}`, code);
    if (
      !DIMENSION_FIELDS.some(
        (definition) => definition.terminal_type
          === binding.terminal_type,
      )
      || binding.validation_state !== 'EXTERNALLY_VALIDATED'
      || binding.authority_state !== 'NOT_GRANTED'
    ) {
      fail(code, `Predicate dimension lineage binding ${index} is invalid.`);
    }
    requireDigest(
      binding.revision_id,
      `Dimension binding ${index} revision ID`,
      code,
    );
    requireDigest(
      binding.external_validation_receipt_id,
      `Dimension binding ${index} validation receipt`,
      code,
    );
    requireSortedUniqueDigests(
      binding.evidence_edge_ids,
      `Dimension binding ${index} evidence IDs`,
      { minimum: 1, maximum: MAX_EVIDENCE_EDGES, code },
    );
    if (
      binding.evidence_edge_ids.some(
        (evidenceId) => !evidenceIds.has(evidenceId),
      )
    ) {
      fail(code, `Dimension binding ${index} uses unbound evidence.`);
    }
    actualPairs.push({
      terminal_type: binding.terminal_type,
      revision_id: binding.revision_id,
    });
  });
  const sortedBindings = [...bindings].sort((left, right) => (
    compareText(left.terminal_type, right.terminal_type)
    || compareText(left.revision_id, right.revision_id)
  ));
  if (
    canonicalJson(bindings) !== canonicalJson(sortedBindings)
    || canonicalJson(actualPairs) !== canonicalJson(
      expectedDimensionRevisionPairs(witnessRevision),
    )
  ) {
    fail(code, 'Predicate dimension lineage is incomplete or not canonical.');
  }
}

function predicateWitnessRevisionIdentityPayload(value) {
  return {
    applicability_evidence_edges:
      value.applicability_evidence_edges,
    atomic_response_predicate_key:
      value.atomic_response_predicate_key,
    atomic_response_predicate_witness_revision_id:
      value.atomic_response_predicate_witness_revision_id,
    bidder_track_revision_id: value.bidder_track_revision_id,
    complete_scope_evidence_edges:
      value.complete_scope_evidence_edges,
    complete_scope_identity: value.complete_scope_identity,
    complete_scope_payload: value.complete_scope_payload,
    dimension_revision_bindings: value.dimension_revision_bindings,
    evidence_edges: value.evidence_edges,
    failure_detail: value.failure_detail,
    predicate_key: value.predicate_key,
    predicate_state: value.predicate_state,
    process_agreement_revision_ids:
      value.process_agreement_revision_ids,
    process_event_revision_id: value.process_event_revision_id,
    process_participant_revision_ids:
      value.process_participant_revision_ids,
    process_passage_revision_ids: value.process_passage_revision_ids,
    process_position_revision_ids: value.process_position_revision_ids,
    process_predicate_witness_id:
      value.process_predicate_witness_identity
        .process_predicate_witness_id,
    process_relationship_revision_ids:
      value.process_relationship_revision_ids,
    source_semantic_kind: value.source_semantic_kind,
    subject_code: value.subject_code,
    temporal_expression_revision_ids:
      value.temporal_expression_revision_ids,
  };
}

function validateAtomicPredicateWitnessIdentity(value, unionIdentity, code) {
  requireExactKeys(value, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_narration_occurrence_id',
    'predicate_definition_key_and_version',
    'predicate_evidence_role_slot_key',
    'governed_ordinal',
    'process_predicate_witness_id',
  ], 'Atomic Process predicate-witness identity', code);
  [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_narration_occurrence_id',
    'process_predicate_witness_id',
  ].forEach((key) => {
    requireDigest(value[key], `Atomic predicate-witness ${key}`, code);
  });
  requireExactKeys(value.predicate_definition_key_and_version, [
    'key',
    'version',
  ], 'Atomic predicate definition', code);
  requireGovernedKey(
    value.predicate_definition_key_and_version.key,
    'Atomic predicate definition key',
    code,
  );
  requireGovernedKey(
    value.predicate_evidence_role_slot_key,
    'Atomic predicate evidence-role slot key',
    code,
  );
  requireInteger(
    value.governed_ordinal,
    0,
    Number.MAX_SAFE_INTEGER,
    'Atomic predicate-witness governed ordinal',
    code,
  );
  if (
    value.predicate_definition_key_and_version.version !== 1
    || !ATOMIC_RESPONSE_PREDICATE_KEYS.has(
      value.predicate_definition_key_and_version.key,
    )
    || value.process_predicate_witness_id !== contentId(
      'PROCESS_PREDICATE_WITNESS/V1',
      predicateWitnessIdentityPayload(value),
    )
    || value.process_predicate_witness_id
      === unionIdentity.process_predicate_witness_id
    || value.frozen_contract_pair_digest
      !== unionIdentity.frozen_contract_pair_digest
    || value.governed_deal_admission_id
      !== unionIdentity.governed_deal_admission_id
    || value.process_narration_occurrence_id
      !== unionIdentity.process_narration_occurrence_id
  ) {
    fail(code, 'The atomic predicate-witness identity is not union-bound.');
  }
}

function validateAtomicPredicateWitnessRevision(
  value,
  unionValue,
  release,
) {
  const code = 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION';
  requireExactKeys(value, [
    'schema_version',
    'predicate_witness_revision_id',
    'process_predicate_witness_identity',
    'applicability_evidence_edges',
    'atomic_response_predicate_key',
    'atomic_response_predicate_witness_revision_id',
    'bidder_track_revision_id',
    'complete_scope_evidence_edges',
    'complete_scope_identity',
    'complete_scope_payload',
    'evidence_edges',
    'failure_detail',
    'predicate_key',
    'predicate_state',
    'process_agreement_revision_ids',
    'process_event_revision_id',
    'process_participant_revision_ids',
    'process_passage_revision_ids',
    'process_position_revision_ids',
    'process_relationship_revision_ids',
    'source_semantic_kind',
    'subject_code',
    'temporal_expression_revision_ids',
    'dimension_revision_bindings',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Atomic Process predicate-witness revision', code);
  if (
    value.schema_version !== PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA
    || value.predicate_state !== PREDICATE_STATE
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The atomic predicate-witness state is not admissible.');
  }
  [
    'predicate_witness_revision_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Atomic predicate-witness ${key}`, code);
  });
  validateAtomicPredicateWitnessIdentity(
    value.process_predicate_witness_identity,
    unionValue.process_predicate_witness_identity,
    code,
  );
  if (
    value.predicate_key
      !== value.process_predicate_witness_identity
        .predicate_definition_key_and_version.key
    || !ATOMIC_RESPONSE_PREDICATE_KEYS.has(value.predicate_key)
    || value.atomic_response_predicate_key !== null
    || value.atomic_response_predicate_witness_revision_id !== null
    || value.complete_scope_identity !== null
    || value.complete_scope_payload !== null
    || !Array.isArray(value.complete_scope_evidence_edges)
    || value.complete_scope_evidence_edges.length !== 0
    || !Array.isArray(value.applicability_evidence_edges)
    || value.applicability_evidence_edges.length !== 0
    || value.failure_detail !== null
    || value.source_semantic_kind
      !== PREDICATE_SEMANTIC_KINDS[value.predicate_key]
  ) {
    fail(code, 'The atomic predicate-witness semantics are invalid.');
  }
  const subjectCodes =
    predicateCatalogueContract.definition.subject_contract
      .initial_subject_codes;
  if (!subjectCodes.includes(value.subject_code)) {
    fail(code, 'The atomic predicate witness uses an unadmitted subject.');
  }
  if (value.bidder_track_revision_id !== null) {
    requireDigest(
      value.bidder_track_revision_id,
      'Atomic bidder-track revision ID',
      code,
    );
  }
  if (value.process_event_revision_id !== null) {
    requireDigest(
      value.process_event_revision_id,
      'Atomic Process-event revision ID',
      code,
    );
  }
  for (const definition of DIMENSION_FIELDS.filter(
    (entry) => entry.cardinality === 'MANY',
  )) {
    requireSortedUniqueDigests(value[definition.field], definition.field, {
      minimum: definition.field === 'process_passage_revision_ids' ? 1 : 0,
      code,
    });
  }
  validateEvidenceEdges(
    value.evidence_edges,
    'Atomic predicate-witness evidence edges',
    code,
  );
  if (!value.evidence_edges.some(
    (edge) => edge.evidence_role_key
      === value.process_predicate_witness_identity
        .predicate_evidence_role_slot_key,
  )) {
    fail(code, 'The atomic predicate witness lacks direct exact evidence.');
  }
  validateDimensionRevisionBindings(
    value.dimension_revision_bindings,
    value,
    code,
  );
  validateSuccessorWitnessMachineRule(value, code);
  validateReleaseBinding(value, release, 'Atomic predicate witness', code);
  if (
    value.predicate_witness_revision_id !== contentId(
      PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      predicateWitnessRevisionIdentityPayload(value),
    )
  ) {
    fail(code, 'The atomic predicate-witness revision identity is invalid.');
  }
}

function validatePredicateWitnessRevision(
  value,
  resultIdentity,
  narrationRevision,
  release,
  atomicWitnessRevision,
) {
  const code = 'INVALID_PROCESS_PREDICATE_WITNESS_REVISION';
  requireExactKeys(value, [
    'schema_version',
    'predicate_witness_revision_id',
    'process_predicate_witness_identity',
    'applicability_evidence_edges',
    'atomic_response_predicate_key',
    'atomic_response_predicate_witness_revision_id',
    'bidder_track_revision_id',
    'complete_scope_evidence_edges',
    'complete_scope_identity',
    'complete_scope_payload',
    'evidence_edges',
    'failure_detail',
    'predicate_key',
    'predicate_state',
    'process_agreement_revision_ids',
    'process_event_revision_id',
    'process_participant_revision_ids',
    'process_passage_revision_ids',
    'process_position_revision_ids',
    'process_relationship_revision_ids',
    'source_semantic_kind',
    'subject_code',
    'temporal_expression_revision_ids',
    'dimension_revision_bindings',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process predicate-witness revision', code);
  if (
    value.schema_version !== PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA
    || value.predicate_state !== PREDICATE_STATE
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The predicate-witness revision state is not admissible.');
  }
  [
    'predicate_witness_revision_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'revision_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Predicate-witness revision ${key}`, code);
  });
  validatePredicateWitnessIdentity(
    value.process_predicate_witness_identity,
    resultIdentity,
    narrationRevision,
  );
  if (
    value.predicate_key
      !== value.process_predicate_witness_identity
        .predicate_definition_key_and_version.key
  ) {
    fail(code, 'The predicate revision key does not bind its witness.');
  }
  const expectedSemanticKind =
    value.predicate_key === RESPONSE_UNION_PREDICATE_KEY
      ? PREDICATE_SEMANTIC_KINDS[
        value.atomic_response_predicate_key
      ]
      : PREDICATE_SEMANTIC_KINDS[value.predicate_key];
  if (
    value.source_semantic_kind !== expectedSemanticKind
    || value.complete_scope_identity !== null
    || value.complete_scope_payload !== null
    || !Array.isArray(value.complete_scope_evidence_edges)
    || value.complete_scope_evidence_edges.length !== 0
    || !Array.isArray(value.applicability_evidence_edges)
    || value.applicability_evidence_edges.length !== 0
    || value.failure_detail !== null
  ) {
    fail(
      code,
      'The present predicate witness does not retain its exact semantic state.',
    );
  }
  if (value.predicate_key === RESPONSE_UNION_PREDICATE_KEY) {
    if (
      !ATOMIC_RESPONSE_PREDICATE_KEYS.has(
        value.atomic_response_predicate_key,
      )
      || value.atomic_response_predicate_witness_revision_id === null
    ) {
      fail(code, 'The response union does not bind one atomic witness.');
    }
    requireDigest(
      value.atomic_response_predicate_witness_revision_id,
      'Atomic response witness revision ID',
      code,
    );
    if (atomicWitnessRevision === null) {
      fail(code, 'The response union lacks its full atomic witness.');
    }
    validateAtomicPredicateWitnessRevision(
      atomicWitnessRevision,
      value,
      release,
    );
    const preservedFields = [
      'applicability_evidence_edges',
      'bidder_track_revision_id',
      'complete_scope_evidence_edges',
      'complete_scope_identity',
      'complete_scope_payload',
      'dimension_revision_bindings',
      'evidence_edges',
      'failure_detail',
      'predicate_state',
      'process_agreement_revision_ids',
      'process_event_revision_id',
      'process_participant_revision_ids',
      'process_passage_revision_ids',
      'process_position_revision_ids',
      'process_relationship_revision_ids',
      'source_semantic_kind',
      'subject_code',
      'temporal_expression_revision_ids',
    ];
    if (
      value.atomic_response_predicate_key
        !== atomicWitnessRevision.predicate_key
      || value.atomic_response_predicate_witness_revision_id
        !== atomicWitnessRevision.predicate_witness_revision_id
      || preservedFields.some((field) => (
        canonicalJson(value[field])
          !== canonicalJson(atomicWitnessRevision[field])
      ))
    ) {
      fail(code, 'The response union substitutes or widens its atomic witness.');
    }
  } else if (
    value.atomic_response_predicate_key !== null
    || value.atomic_response_predicate_witness_revision_id !== null
    || atomicWitnessRevision !== null
  ) {
    fail(code, 'A non-union predicate cannot bind an atomic response witness.');
  }
  const subjectCodes =
    predicateCatalogueContract.definition.subject_contract
      .initial_subject_codes;
  if (!subjectCodes.includes(value.subject_code)) {
    fail(code, 'The predicate witness uses an unadmitted subject code.');
  }
  requireGovernedKey(value.predicate_key, 'Predicate revision key', code);
  if (value.bidder_track_revision_id !== null) {
    requireDigest(
      value.bidder_track_revision_id,
      'Bidder-track revision ID',
      code,
    );
  }
  if (value.process_event_revision_id !== null) {
    requireDigest(
      value.process_event_revision_id,
      'Process-event revision ID',
      code,
    );
  }
  for (const definition of DIMENSION_FIELDS.filter(
    (entry) => entry.cardinality === 'MANY',
  )) {
    requireSortedUniqueDigests(
      value[definition.field],
      definition.field,
      {
        minimum: definition.field === 'process_passage_revision_ids'
          ? 1
          : 0,
        code,
      },
    );
  }
  validateEvidenceEdges(
    value.evidence_edges,
    'Predicate-witness evidence edges',
    code,
  );
  if (!value.evidence_edges.some(
    (edge) => edge.evidence_role_key
      === resultIdentity.exact_evidence_role_slot_key,
  )) {
    fail(code, 'The predicate witness lacks its direct exact evidence role.');
  }
  validateDimensionRevisionBindings(
    value.dimension_revision_bindings,
    value,
    code,
  );
  validateSuccessorWitnessMachineRule(value, code);
  validateReleaseBinding(value, release, 'Predicate-witness revision', code);
  if (
    value.predicate_witness_revision_id !== contentId(
      PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
      predicateWitnessRevisionIdentityPayload(value),
    )
  ) {
    fail(code, 'The predicate-witness revision identity is invalid.');
  }
}

function validateTerminalBinding(
  binding,
  expected,
  index,
  code,
) {
  requireExactKeys(binding, [
    'terminal_type',
    'stable_occurrence_id',
    'selected_revision_id',
    'canonical_payload_digest',
    'evidence_edge_ids',
  ], `Result-input terminal binding ${index}`, code);
  if (
    binding.terminal_type !== expected.terminal_type
    || binding.stable_occurrence_id !== expected.stable_occurrence_id
    || binding.selected_revision_id !== expected.selected_revision_id
    || binding.canonical_payload_digest
      !== expected.canonical_payload_digest
  ) {
    fail(code, `Result-input terminal binding ${index} is not exact.`);
  }
  [
    'stable_occurrence_id',
    'selected_revision_id',
    'canonical_payload_digest',
  ].forEach((key) => {
    requireDigest(binding[key], `Terminal binding ${index} ${key}`, code);
  });
  requireSortedUniqueDigests(
    binding.evidence_edge_ids,
    `Terminal binding ${index} evidence IDs`,
    { minimum: 1, maximum: MAX_EVIDENCE_EDGES, code },
  );
  if (
    canonicalJson(binding.evidence_edge_ids)
      !== canonicalJson(expected.evidence_edge_ids)
  ) {
    fail(code, `Result-input terminal binding ${index} evidence is incomplete.`);
  }
}

function validateResultInputLineage(
  value,
  resultIdentity,
  narrationRevision,
  witnessRevision,
  release,
) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE';
  requireExactKeys(value, [
    'schema_version',
    'result_input_lineage_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'terminal_bindings',
    'retelling_relationship_revision_ids',
    'predicate_dimension_revision_bindings_digest',
    'lineage_validation_receipt_id',
    'completeness_state',
    'validation_state',
    'authority_state',
  ], 'Process phrasebook result-input lineage', code);
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA
    || value.process_phrasebook_passage_result_id
      !== resultIdentity.process_phrasebook_passage_result_id
    || value.completeness_state !== 'COMPLETE'
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process phrasebook result-input lineage state is invalid.');
  }
  [
    'result_input_lineage_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'predicate_dimension_revision_bindings_digest',
    'lineage_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Result-input lineage ${key}`, code);
  });
  validateReleaseBinding(value, release, 'Result-input lineage', code);
  if (
    !Array.isArray(value.terminal_bindings)
    || value.terminal_bindings.length !== 2
  ) {
    fail(code, 'Result-input lineage needs exactly two terminals.');
  }
  const expectedTerminals = [
    {
      terminal_type: 'PROCESS_NARRATION_REVISION',
      stable_occurrence_id:
        narrationRevision.process_narration_occurrence
          .process_narration_occurrence_id,
      selected_revision_id:
        narrationRevision.process_narration_revision_id,
      canonical_payload_digest: payloadDigest(narrationRevision),
      evidence_edge_ids: narrationRevision.evidence_edges
        .map((edge) => edge.evidence_edge_id)
        .sort(compareText),
    },
    {
      terminal_type: 'PREDICATE_WITNESS_REVISION',
      stable_occurrence_id:
        witnessRevision.process_predicate_witness_identity
          .process_predicate_witness_id,
      selected_revision_id:
        witnessRevision.predicate_witness_revision_id,
      canonical_payload_digest: payloadDigest(witnessRevision),
      evidence_edge_ids: witnessRevision.evidence_edges
        .map((edge) => edge.evidence_edge_id)
        .sort(compareText),
    },
  ];
  value.terminal_bindings.forEach((binding, index) => {
    validateTerminalBinding(
      binding,
      expectedTerminals[index],
      index,
      code,
    );
  });
  requireSortedUniqueDigests(
    value.retelling_relationship_revision_ids,
    'Retelling relationship revision IDs',
    { code },
  );
  if (
    canonicalJson(value.retelling_relationship_revision_ids)
      !== canonicalJson(narrationRevision.relationship_revision_ids)
    || value.predicate_dimension_revision_bindings_digest
      !== payloadDigest(witnessRevision.dimension_revision_bindings)
    || value.result_input_lineage_id !== contentId(
      PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
      without(value, 'result_input_lineage_id'),
    )
  ) {
    fail(code, 'The Process phrasebook result-input lineage is incomplete.');
  }
}

function validateSourceInterval(value, label, code) {
  requireExactKeys(value, [
    'admitted_source_occurrence_id',
    'document_hash',
    'document_ordinal',
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text_digest',
  ], label, code);
  [
    'admitted_source_occurrence_id',
    'document_hash',
    'exact_text_digest',
  ].forEach((key) => requireDigest(value[key], `${label} ${key}`, code));
  requireInteger(
    value.document_ordinal,
    0,
    Number.MAX_SAFE_INTEGER,
    `${label} document ordinal`,
    code,
  );
  requireInteger(
    value.start_utf8_byte,
    0,
    Number.MAX_SAFE_INTEGER,
    `${label} start`,
    code,
  );
  requireInteger(
    value.end_utf8_byte,
    1,
    Number.MAX_SAFE_INTEGER,
    `${label} end`,
    code,
  );
  if (value.end_utf8_byte <= value.start_utf8_byte) {
    fail(code, `${label} is empty or reversed.`);
  }
}

function evidenceMatchesSourceInterval(edge, interval) {
  return edge.admitted_source_occurrence_id
      === interval.admitted_source_occurrence_id
    && edge.document_hash === interval.document_hash
    && edge.document_ordinal === interval.document_ordinal
    && edge.start_utf8_byte === interval.start_utf8_byte
    && edge.end_utf8_byte === interval.end_utf8_byte
    && edge.exact_text_digest === interval.exact_text_digest;
}

function validateExactDetailReference(
  value,
  resultIdentity,
  narrationRevision,
  release,
) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE';
  requireExactKeys(value, [
    'schema_version',
    'exact_detail_reference_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'source_revision_id',
    'source_interval',
    'source_local_narration_id',
    'human_readable_source_label',
    'exact_detail_action',
    'reference_validation_receipt_id',
    'validation_state',
    'object_authorisation_state',
    'execution_authority_state',
  ], 'Process phrasebook exact-detail reference', code);
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA
    || value.process_phrasebook_passage_result_id
      !== resultIdentity.process_phrasebook_passage_result_id
    || value.source_local_narration_id
      !== narrationRevision.process_narration_occurrence
        .process_narration_occurrence_id
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.object_authorisation_state !== 'REQUIRED_BEFORE_USE'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process phrasebook exact-detail state is invalid.');
  }
  [
    'exact_detail_reference_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'source_revision_id',
    'source_local_narration_id',
    'reference_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Exact-detail ${key}`, code);
  });
  validateReleaseBinding(value, release, 'Exact-detail reference', code);
  validateSourceInterval(
    value.source_interval,
    'Exact-detail source interval',
    code,
  );
  requireText(
    value.human_readable_source_label,
    'Human-readable source label',
    code,
  );
  requireExactValue(
    value.exact_detail_action,
    {
      stable_id: 'PROCESS_NARRATION_EVIDENCE',
      version: 1,
    },
    'Process exact-detail action',
    code,
  );
  if (
    value.exact_detail_reference_id !== contentId(
      PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
      without(value, 'exact_detail_reference_id'),
    )
  ) {
    fail(code, 'The Process phrasebook exact-detail identity is invalid.');
  }
}

function validateMatchedPassagePreview(
  value,
  resultIdentity,
  narrationRevision,
  witnessRevision,
  exactDetailReference,
  release,
) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW';
  requireExactKeys(value, [
    'schema_version',
    'preview_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'exact_source_interval',
    'evidence_role_key',
    'source_local_narration_id',
    'segmentation_projection_id',
    'verbatim_text',
    'verbatim_text_digest',
    'truncation_state',
    'exact_detail_reference_id',
    'preview_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process phrasebook inline passage preview', code);
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA
    || value.process_phrasebook_passage_result_id
      !== resultIdentity.process_phrasebook_passage_result_id
    || value.evidence_role_key
      !== resultIdentity.exact_evidence_role_slot_key
    || value.source_local_narration_id
      !== narrationRevision.process_narration_occurrence
        .process_narration_occurrence_id
    || !['COMPLETE', 'TRUNCATED'].includes(value.truncation_state)
    || value.exact_detail_reference_id
      !== exactDetailReference.exact_detail_reference_id
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process phrasebook preview binding is invalid.');
  }
  [
    'preview_id',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'source_local_narration_id',
    'segmentation_projection_id',
    'verbatim_text_digest',
    'exact_detail_reference_id',
    'preview_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Preview ${key}`, code));
  validateReleaseBinding(value, release, 'Inline passage preview', code);
  validateSourceInterval(
    value.exact_source_interval,
    'Preview exact source interval',
    code,
  );
  requireGovernedKey(value.evidence_role_key, 'Preview evidence role', code);
  requireText(
    value.verbatim_text,
    'Preview verbatim text',
    code,
    8192,
    false,
  );
  const matchingNarrationEdge = narrationRevision.evidence_edges.find(
    (edge) => (
      edge.evidence_role_key === value.evidence_role_key
      && evidenceMatchesSourceInterval(
        edge,
        value.exact_source_interval,
      )
    ),
  );
  const matchingWitnessEdge = witnessRevision.evidence_edges.find(
    (edge) => (
      edge.evidence_role_key === value.evidence_role_key
      && evidenceMatchesSourceInterval(
        edge,
        value.exact_source_interval,
      )
    ),
  );
  if (
    Buffer.byteLength(value.verbatim_text, 'utf8')
      !== value.exact_source_interval.end_utf8_byte
        - value.exact_source_interval.start_utf8_byte
    || value.verbatim_text_digest
      !== sha256Hex(Buffer.from(value.verbatim_text, 'utf8'))
    || value.verbatim_text_digest
      !== value.exact_source_interval.exact_text_digest
    || !matchingNarrationEdge
    || !matchingWitnessEdge
    || value.source_document_identity
      !== matchingNarrationEdge.source_document_identity
    || value.source_document_identity
      !== matchingWitnessEdge.source_document_identity
    || value.source_revision_id !== matchingNarrationEdge.source_revision_id
    || value.source_revision_id !== matchingWitnessEdge.source_revision_id
    || value.source_document_identity
      !== exactDetailReference.source_document_identity
    || value.source_revision_id !== exactDetailReference.source_revision_id
    || canonicalJson(value.exact_source_interval)
      !== canonicalJson(exactDetailReference.source_interval)
    || value.preview_id !== contentId(
      PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
      without(value, 'preview_id'),
    )
  ) {
    fail(code, 'The Process phrasebook preview is not exact source drafting.');
  }
}

function validatePassageOrderProjection(
  value,
  resultIdentity,
  narrationRevision,
  release,
) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ORDERING_BINDING';
  try {
    validateProcessPassageOrderProjection(value);
  } catch (error) {
    fail(code, 'The Process passage-order projection is invalid.', {
      cause: error.code || error.message,
    });
  }
  validateCandidateManifestBinding(
    value,
    release,
    'Passage-order projection',
    code,
  );
  const matchingFacts = value.validated_ordering_facts.filter(
    (fact) => fact.result_identity
      .process_phrasebook_passage_result_id
      === resultIdentity.process_phrasebook_passage_result_id,
  );
  if (
    matchingFacts.length !== 1
    || canonicalJson(matchingFacts[0].result_identity)
      !== canonicalJson(resultIdentity)
    || canonicalJson(matchingFacts[0].selected_narration_occurrence)
      !== canonicalJson(narrationRevision.process_narration_occurrence)
    || value.ordered_result_ids.filter(
      (resultId) => resultId
        === resultIdentity.process_phrasebook_passage_result_id,
    ).length !== 1
  ) {
    fail(code, 'The passage-order projection does not bind the exact result.');
  }
  if (
    matchingFacts[0].narration_treatment === 'LATER_RETELLING'
    && narrationRevision.relationship_revision_ids.length === 0
  ) {
    fail(code, 'A later retelling lost its relationship revision.');
  }
  return matchingFacts[0];
}

function validateCandidateReleaseMembership(
  value,
  context,
  release,
) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP';
  requireExactKeys(value, [
    'schema_version',
    'release_membership_id',
    'process_phrasebook_passage_result_id',
    'result_identity_payload_digest',
    'process_narration_revision_id',
    'predicate_witness_revision_id',
    'result_input_lineage_id',
    'matched_passage_preview_id',
    'ordering_projection_id',
    'exact_detail_reference_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'membership_validation_receipt_id',
    'membership_state',
    'validation_state',
    'authority_state',
  ], 'Process phrasebook result release membership', code);
  const {
    result_identity: resultIdentity,
    narration_revision: narrationRevision,
    predicate_witness_revision: witnessRevision,
    result_input_lineage: lineage,
    matched_passage_preview: preview,
    passage_order_projection: ordering,
    exact_detail_reference: exactDetailReference,
  } = context;
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA
    || value.process_phrasebook_passage_result_id
      !== resultIdentity.process_phrasebook_passage_result_id
    || value.result_identity_payload_digest
      !== resultIdentity.canonical_payload_digest
    || value.process_narration_revision_id
      !== narrationRevision.process_narration_revision_id
    || value.predicate_witness_revision_id
      !== witnessRevision.predicate_witness_revision_id
    || value.result_input_lineage_id !== lineage.result_input_lineage_id
    || value.matched_passage_preview_id !== preview.preview_id
    || value.ordering_projection_id !== ordering.ordering_projection_id
    || value.exact_detail_reference_id
      !== exactDetailReference.exact_detail_reference_id
    || value.source_document_identity
      !== preview.source_document_identity
    || ![
      'CANDIDATE_MEMBER',
      'NOT_RELEASE_BOUND',
    ].includes(value.membership_state)
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process phrasebook release membership is incomplete.');
  }
  [
    'release_membership_id',
    'process_phrasebook_passage_result_id',
    'result_identity_payload_digest',
    'process_narration_revision_id',
    'predicate_witness_revision_id',
    'result_input_lineage_id',
    'matched_passage_preview_id',
    'ordering_projection_id',
    'exact_detail_reference_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'source_document_identity',
    'membership_validation_receipt_id',
  ].forEach((key) => {
    requireDigest(value[key], `Release membership ${key}`, code);
  });
  validateReleaseBinding(value, release, 'Release membership', code);
  if (
    value.release_membership_id !== contentId(
      PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
      without(value, 'release_membership_id'),
    )
  ) {
    fail(code, 'The Process phrasebook release membership identity is invalid.');
  }
}

function validateAdmissionInput(input) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'result_identity',
    'narration_revision',
    'predicate_witness_revision',
    'atomic_response_predicate_witness_revision',
    'result_input_lineage',
    'matched_passage_preview',
    'passage_order_projection',
    'candidate_release_membership',
    'exact_detail_reference',
  ], 'Process phrasebook result admission input', code);
  try {
    validateProcessPhrasebookResultIdentity(input.result_identity);
  } catch (error) {
    fail(code, 'The Process phrasebook result identity is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = {
    candidate_release_manifest_id:
      input.candidate_release_membership
        .candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      input.candidate_release_membership
        .candidate_release_manifest_payload_digest,
    corpus_release_id:
      input.candidate_release_membership.corpus_release_id,
  };
  Object.entries(release).forEach(([key, value]) => {
    requireDigest(value, `Admission release ${key}`, code);
  });
  validateNarrationRevision(
    input.narration_revision,
    input.result_identity,
    release,
  );
  validatePredicateWitnessRevision(
    input.predicate_witness_revision,
    input.result_identity,
    input.narration_revision,
    release,
    input.atomic_response_predicate_witness_revision,
  );
  validateResultInputLineage(
    input.result_input_lineage,
    input.result_identity,
    input.narration_revision,
    input.predicate_witness_revision,
    release,
  );
  validateExactDetailReference(
    input.exact_detail_reference,
    input.result_identity,
    input.narration_revision,
    release,
  );
  validateMatchedPassagePreview(
    input.matched_passage_preview,
    input.result_identity,
    input.narration_revision,
    input.predicate_witness_revision,
    input.exact_detail_reference,
    release,
  );
  const orderingFact = validatePassageOrderProjection(
    input.passage_order_projection,
    input.result_identity,
    input.narration_revision,
    release,
  );
  validateCandidateReleaseMembership(
    input.candidate_release_membership,
    input,
    release,
  );
  return { orderingFact, release };
}

function buildAdmissionReceipt(input) {
  const { orderingFact, release } = validateAdmissionInput(input);
  const body = {
    schema_version:
      PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
    process_phrasebook_passage_result_id:
      input.result_identity.process_phrasebook_passage_result_id,
    result_identity_payload_digest:
      input.result_identity.canonical_payload_digest,
    ...release,
    process_narration_occurrence_id:
      input.narration_revision.process_narration_occurrence
        .process_narration_occurrence_id,
    process_narration_revision_id:
      input.narration_revision.process_narration_revision_id,
    process_predicate_witness_id:
      input.predicate_witness_revision
        .process_predicate_witness_identity
        .process_predicate_witness_id,
    predicate_witness_revision_id:
      input.predicate_witness_revision.predicate_witness_revision_id,
    result_input_lineage_id:
      input.result_input_lineage.result_input_lineage_id,
    matched_passage_preview_id:
      input.matched_passage_preview.preview_id,
    ordering_projection_id:
      input.passage_order_projection.ordering_projection_id,
    ordering_fact_id: orderingFact.ordering_fact_id,
    release_membership_id:
      input.candidate_release_membership.release_membership_id,
    exact_detail_reference_id:
      input.exact_detail_reference.exact_detail_reference_id,
    source_document_identity:
      input.matched_passage_preview.source_document_identity,
    source_revision_id:
      input.matched_passage_preview.source_revision_id,
    exact_source_interval:
      clone(input.matched_passage_preview.exact_source_interval),
    verbatim_text_digest:
      input.matched_passage_preview.verbatim_text_digest,
    human_readable_source_label:
      input.exact_detail_reference.human_readable_source_label,
    narration_revision_state: 'BOUND_PRESENT',
    predicate_witness_revision_state: 'BOUND_PRESENT',
    result_input_lineage_state: 'COMPLETE',
    matched_passage_preview_state: 'BOUND_VERBATIM',
    ordering_projection_state: 'BOUND_GOVERNED',
    release_membership_state:
      input.candidate_release_membership.membership_state
        === 'NOT_RELEASE_BOUND'
        ? 'NOT_RELEASE_BOUND'
        : 'BOUND_CANDIDATE_MEMBER',
    exact_detail_reference_state: 'BOUND_AUTH_REQUIRED',
    admission_state:
      input.candidate_release_membership.membership_state
        === 'NOT_RELEASE_BOUND'
        ? 'VALIDATED_NOT_RELEASE_BOUND'
        : 'VALIDATED_NOT_MATERIALISED',
    serving_state: 'NOT_SERVED',
    authority_limits: clone(AUTHORITY_LIMITS),
  };
  return {
    schema_version: body.schema_version,
    admission_receipt_id: contentId(
      PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function validateProcessPhrasebookResultAdmissionReceipt(value, input) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'admission_receipt_id',
    'process_phrasebook_passage_result_id',
    'result_identity_payload_digest',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'corpus_release_id',
    'process_narration_occurrence_id',
    'process_narration_revision_id',
    'process_predicate_witness_id',
    'predicate_witness_revision_id',
    'result_input_lineage_id',
    'matched_passage_preview_id',
    'ordering_projection_id',
    'ordering_fact_id',
    'release_membership_id',
    'exact_detail_reference_id',
    'source_document_identity',
    'source_revision_id',
    'exact_source_interval',
    'verbatim_text_digest',
    'human_readable_source_label',
    'narration_revision_state',
    'predicate_witness_revision_state',
    'result_input_lineage_state',
    'matched_passage_preview_state',
    'ordering_projection_state',
    'release_membership_state',
    'exact_detail_reference_state',
    'admission_state',
    'serving_state',
    'authority_limits',
  ], 'Process phrasebook result admission receipt', code);
  const rebuilt = buildAdmissionReceipt(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The Process phrasebook result admission receipt was changed.');
  }
  return true;
}

function compileProcessPhrasebookResultAdmission(input) {
  const receipt = buildAdmissionReceipt(input);
  validateProcessPhrasebookResultAdmissionReceipt(receipt, input);
  return deepFreeze(clone(receipt));
}

function canonicalProcessPhrasebookResultAdmissionReceiptBytes(
  value,
  input,
) {
  validateProcessPhrasebookResultAdmissionReceipt(value, input);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  AUTHORITY_LIMITS,
  DIMENSION_FIELDS,
  PROCESS_EXACT_EVIDENCE_EDGE_SCHEMA,
  PROCESS_NARRATION_REVISION_SCHEMA,
  PROCESS_PHRASEBOOK_INLINE_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_INPUT_LINEAGE_SCHEMA,
  PROCESS_PHRASEBOOK_RESULT_RELEASE_MEMBERSHIP_SCHEMA,
  PROCESS_PREDICATE_WITNESS_REVISION_SCHEMA,
  ProcessPhrasebookResultAdmissionError,
  canonicalProcessPhrasebookResultAdmissionReceiptBytes,
  compileProcessPhrasebookResultAdmission,
  validateProcessPhrasebookResultAdmissionReceipt,
};
