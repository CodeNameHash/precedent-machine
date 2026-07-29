const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const OCCURRENCE_SCHEMA = 'PROCESS_NARRATION_OCCURRENCE/V1';
const OCCURRENCE_ID_DOMAIN = 'PROCESS_NARRATION_OCCURRENCE/V1';
const OCCURRENCE_PAYLOAD_DOMAIN =
  'PROCESS_NARRATION_OCCURRENCE_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessNarrationOccurrence';
const COORDINATE_SPACE = 'ADMITTED_SOURCE_UTF8_BYTES';

const DEFINITION_IDENTITY = Object.freeze({
  definition_key: 'PROCESS_NARRATION_OCCURRENCE',
  definition_version: 1,
});

const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'narration_definition_key_and_version',
  'canonical_source_interval_set',
  'governed_ordinal',
]);

const INTERVAL_SET_KEYS = Object.freeze([
  'coordinate_space',
  'intervals',
]);

const INTERVAL_KEYS = Object.freeze([
  'admitted_source_occurrence_id',
  'document_hash',
  'document_ordinal',
  'absolute_start',
  'absolute_end',
  'exact_bytes_digest',
]);

const VALUE_IDENTITY_INPUTS = new Set([
  'candidate_values',
  'extracted_attributes',
  'inferred_event_id',
  'model_output',
  'selected_revision_id',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  event_identity: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  activation: 'NONE',
});

class ProcessNarrationOccurrenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessNarrationOccurrenceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProcessNarrationOccurrenceError(code, message, details);
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
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
  if (!equal) {
    fail(code, `${label} is not the approved value.`, {
      expected,
      actual,
    });
  }
}

function requireSha256(value, label, code) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareScalar(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareCanonicalSourceIntervals(left, right) {
  for (const key of [
    'document_ordinal',
    'absolute_start',
    'absolute_end',
    'document_hash',
    'admitted_source_occurrence_id',
    'exact_bytes_digest',
  ]) {
    const comparison = compareScalar(left[key], right[key]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareCanonicalSourceIntervalSets(left, right) {
  const leftIntervals = left.intervals;
  const rightIntervals = right.intervals;
  const commonLength = Math.min(leftIntervals.length, rightIntervals.length);
  for (let index = 0; index < commonLength; index += 1) {
    const comparison = compareCanonicalSourceIntervals(
      leftIntervals[index],
      rightIntervals[index],
    );
    if (comparison !== 0) return comparison;
  }
  return compareScalar(leftIntervals.length, rightIntervals.length);
}

function validateCanonicalSourceInterval(interval, index) {
  const code = 'INVALID_PROCESS_NARRATION_SOURCE_INTERVAL_SET';
  requireExactKeys(
    interval,
    INTERVAL_KEYS,
    `Process narration source interval ${index}`,
    code,
  );
  requireSha256(
    interval.admitted_source_occurrence_id,
    `Source interval ${index} admitted source occurrence ID`,
    code,
  );
  requireSha256(
    interval.document_hash,
    `Source interval ${index} document hash`,
    code,
  );
  requireSha256(
    interval.exact_bytes_digest,
    `Source interval ${index} exact bytes digest`,
    code,
  );
  if (
    !Number.isInteger(interval.document_ordinal)
    || interval.document_ordinal < 0
    || !Number.isInteger(interval.absolute_start)
    || interval.absolute_start < 0
    || !Number.isInteger(interval.absolute_end)
    || interval.absolute_end <= interval.absolute_start
  ) {
    fail(code, `Source interval ${index} has invalid UTF-8 byte coordinates.`);
  }
}

function validateCanonicalSourceIntervalSet(sourceIntervalSet) {
  const code = 'INVALID_PROCESS_NARRATION_SOURCE_INTERVAL_SET';
  requireExactKeys(
    sourceIntervalSet,
    INTERVAL_SET_KEYS,
    'Process narration source interval set',
    code,
  );
  if (
    sourceIntervalSet.coordinate_space !== COORDINATE_SPACE
    || !Array.isArray(sourceIntervalSet.intervals)
    || sourceIntervalSet.intervals.length === 0
  ) {
    fail(
      code,
      'Process narration needs one non-empty admitted-source UTF-8 interval set.',
    );
  }
  sourceIntervalSet.intervals.forEach(validateCanonicalSourceInterval);
  for (let index = 1; index < sourceIntervalSet.intervals.length; index += 1) {
    const previous = sourceIntervalSet.intervals[index - 1];
    const current = sourceIntervalSet.intervals[index];
    if (compareCanonicalSourceIntervals(previous, current) >= 0) {
      fail(code, 'Process narration source intervals are not in canonical order.');
    }
    if (
      previous.document_ordinal === current.document_ordinal
      && previous.document_hash === current.document_hash
      && current.absolute_start < previous.absolute_end
    ) {
      fail(code, 'Process narration source intervals overlap.');
    }
  }
  return sourceIntervalSet;
}

function rejectValueIdentityInputs(input) {
  const forbidden = Object.keys(input).filter((key) => VALUE_IDENTITY_INPUTS.has(key));
  if (forbidden.length > 0) {
    fail(
      'PROCESS_NARRATION_VALUE_DERIVED_IDENTITY',
      'Extracted values and model output cannot define narration identity.',
      { forbidden_identity_inputs: forbidden.sort() },
    );
  }
}

function validateOccurrenceIdentityInput(input) {
  const code = 'INVALID_PROCESS_NARRATION_IDENTITY';
  requireObject(input, 'Process narration occurrence input', code);
  rejectValueIdentityInputs(input);
  requireExactKeys(
    input,
    OCCURRENCE_INPUT_KEYS,
    'Process narration occurrence input',
    code,
  );
  requireSha256(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireSha256(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  requireExactValue(
    input.narration_definition_key_and_version,
    DEFINITION_IDENTITY,
    'Narration definition identity',
    code,
  );
  if (!Number.isInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(code, 'The governed narration ordinal must be a non-negative integer.');
  }
  validateCanonicalSourceIntervalSet(input.canonical_source_interval_set);
  return input;
}

function occurrenceIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    narration_definition_key_and_version:
      input.narration_definition_key_and_version,
    canonical_source_interval_set: input.canonical_source_interval_set,
    governed_ordinal: input.governed_ordinal,
  };
}

function occurrenceEnvelopeIdentity(body) {
  return {
    process_narration_occurrence_id: contentId(
      OCCURRENCE_ID_DOMAIN,
      occurrenceIdentity(body),
    ),
    canonical_payload_digest: contentId(
      OCCURRENCE_PAYLOAD_DOMAIN,
      body,
    ),
  };
}

function buildProcessNarrationOccurrence(input) {
  validateOccurrenceIdentityInput(input);
  const identity = cloneCanonical(
    occurrenceIdentity(input),
    'Process narration occurrence identity',
    'INVALID_PROCESS_NARRATION_IDENTITY',
  );
  const body = {
    schema_version: OCCURRENCE_SCHEMA,
    logical_type: LOGICAL_TYPE,
    frozen_contract_pair_digest: identity.frozen_contract_pair_digest,
    governed_deal_admission_id: identity.governed_deal_admission_id,
    narration_definition_key_and_version:
      identity.narration_definition_key_and_version,
    canonical_source_interval_set: identity.canonical_source_interval_set,
    governed_ordinal: identity.governed_ordinal,
    coordinate_space: COORDINATE_SPACE,
    source_local: true,
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process narration authority limits',
      'INVALID_PROCESS_NARRATION_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    ...occurrenceEnvelopeIdentity(body),
  });
}

function validateProcessNarrationOccurrence(occurrence) {
  const code = 'INVALID_PROCESS_NARRATION_OCCURRENCE';
  requireExactKeys(occurrence, [
    'schema_version',
    'logical_type',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'narration_definition_key_and_version',
    'canonical_source_interval_set',
    'governed_ordinal',
    'coordinate_space',
    'source_local',
    'authority_limits',
    'process_narration_occurrence_id',
    'canonical_payload_digest',
  ], 'Process narration occurrence', code);
  if (
    occurrence.schema_version !== OCCURRENCE_SCHEMA
    || occurrence.logical_type !== LOGICAL_TYPE
    || occurrence.coordinate_space !== COORDINATE_SPACE
    || occurrence.source_local !== true
  ) {
    fail(code, 'The Process narration occurrence type is invalid.');
  }
  validateOccurrenceIdentityInput(occurrenceIdentity(occurrence));
  requireExactValue(
    occurrence.authority_limits,
    AUTHORITY_LIMITS,
    'Process narration authority limits',
    code,
  );
  const expectedOccurrenceId = contentId(
    OCCURRENCE_ID_DOMAIN,
    occurrenceIdentity(occurrence),
  );
  if (occurrence.process_narration_occurrence_id !== expectedOccurrenceId) {
    fail(
      'PROCESS_NARRATION_OCCURRENCE_ID_MISMATCH',
      'The narration occurrence ID does not bind the exact frozen source identity.',
    );
  }
  const body = { ...occurrence };
  delete body.process_narration_occurrence_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(OCCURRENCE_PAYLOAD_DOMAIN, body);
  if (occurrence.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_NARRATION_PAYLOAD_MISMATCH',
      'The narration occurrence payload digest is invalid.',
    );
  }
  return occurrence;
}

function freezeProcessNarrationOccurrenceSet(input) {
  const code = 'INVALID_PROCESS_NARRATION_OCCURRENCE_SET';
  requireExactKeys(input, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'narration_definition_key_and_version',
    'candidates',
  ], 'Process narration occurrence-set input', code);
  requireSha256(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireSha256(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  requireExactValue(
    input.narration_definition_key_and_version,
    DEFINITION_IDENTITY,
    'Narration definition identity',
    code,
  );
  if (!Array.isArray(input.candidates)) {
    fail(code, 'Process narration candidates must be an array.');
  }

  const sourceIntervalSets = input.candidates.map((candidate, index) => {
    requireObject(candidate, `Process narration candidate ${index}`, code);
    rejectValueIdentityInputs(candidate);
    requireExactKeys(
      candidate,
      ['canonical_source_interval_set'],
      `Process narration candidate ${index}`,
      code,
    );
    validateCanonicalSourceIntervalSet(candidate.canonical_source_interval_set);
    return cloneCanonical(
      candidate.canonical_source_interval_set,
      `Process narration candidate ${index} source interval set`,
      code,
    );
  });
  sourceIntervalSets.sort(compareCanonicalSourceIntervalSets);
  for (let index = 1; index < sourceIntervalSets.length; index += 1) {
    if (
      compareCanonicalSourceIntervalSets(
        sourceIntervalSets[index - 1],
        sourceIntervalSets[index],
      ) === 0
    ) {
      fail(
        'DUPLICATE_PROCESS_NARRATION_OCCURRENCE',
        'Two narration candidates use the same canonical source interval set.',
      );
    }
  }

  return deepFreeze(sourceIntervalSets.map(
    (canonicalSourceIntervalSet, governedOrdinal) => (
      buildProcessNarrationOccurrence({
        frozen_contract_pair_digest: input.frozen_contract_pair_digest,
        governed_deal_admission_id: input.governed_deal_admission_id,
        narration_definition_key_and_version:
          input.narration_definition_key_and_version,
        canonical_source_interval_set: canonicalSourceIntervalSet,
        governed_ordinal: governedOrdinal,
      })
    ),
  ));
}

module.exports = {
  ProcessNarrationOccurrenceError,
  buildProcessNarrationOccurrence,
  compareCanonicalSourceIntervalSets,
  freezeProcessNarrationOccurrenceSet,
  validateCanonicalSourceIntervalSet,
  validateProcessNarrationOccurrence,
};
