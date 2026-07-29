const { canonicalJson, contentId } = require('./canonical-bytes');

const TRANSACTION_CONTROL_OUTCOME_OCCURRENCE_SCHEMA_VERSION =
  'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE/V1';
const TRANSACTION_CONTROL_OUTCOME_REVISION_SCHEMA_VERSION =
  'TRANSACTION_CONTROL_OUTCOME_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const CONTROL_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const CONTROL_OUTCOMES = Object.freeze([
  'CONTROLLED_BY_ONE_PARTICIPANT',
  'SHARED_CONTROL',
  'NEW_HOLDCO_SHARED_CONTROL',
  'NO_CLEAR_CONTROL',
]);
const CONTROL_CONFLICT_DISPOSITIONS = Object.freeze([
  'CLEAR',
  'CONFLICTING',
  'INCOMPLETE_SELECTED_INPUT_SET',
]);
const COMPLETE_SELECTED_INPUT_FAMILIES = Object.freeze([
  'PARTICIPANT_RELATIONSHIP_REVISIONS',
  'TRANSACTION_LEG_RESOLUTION_REVISIONS',
  'VOTING_OWNERSHIP_FACT_RESOLUTIONS',
  'BOARD_COMPOSITION_FACT_RESOLUTIONS',
  'MANAGEMENT_FACT_RESOLUTIONS',
  'SOURCE_CHARACTERISATION_FACT_RESOLUTIONS',
  'EXACT_EVIDENCE_EDGES',
]);
const SINGLE_INPUTS_THAT_NEVER_DECIDE_CONTROL = Object.freeze([
  'COMPANY_NAME',
  'HEADQUARTERS',
  'CHIEF_EXECUTIVE',
  'SURVIVING_ENTITY',
  'SHARE_ISSUER',
  'RELATIVE_OWNERSHIP',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'control_outcome_definition_and_version',
  'effective_time_slot',
  'expected_control_outcome_slot_key',
  'governed_deal_id',
  'governed_ordinal',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'transaction_control_outcome_occurrence_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'transaction_control_outcome_occurrence',
  'complete_selected_input_set',
  'conflict_disposition',
  'controlling_entity_ids',
  'control_outcome',
  'derivation_rule',
  'effective_time',
  'evidence_edges',
  'resolver_version',
  'state',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'transaction_control_outcome_revision_id',
  'transaction_control_outcome_occurrence_id',
  'complete_selected_input_set',
  'conflict_disposition',
  'controlling_entity_ids',
  'control_outcome',
  'derivation_rule',
  'effective_time',
  'evidence_edges',
  'resolver_version',
  'state',
  'terminal_eligible',
]);
const DERIVATION_RULE_KEYS = Object.freeze([
  'observed_signals',
  'rule_key',
  'rule_version',
  'supporting_input_families',
]);

class TransactionControlOutcomeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TransactionControlOutcomeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new TransactionControlOutcomeError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(
      'INVALID_TRANSACTION_CONTROL',
      `${label} fields do not match the closed contract.`,
      { label },
    );
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be a SHA-256 content ID.`, {
      label,
    });
  }
  return value;
}

function optionalDigest(value, label) {
  return value === null ? null : requireDigest(value, label);
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be a governed uppercase key.`, {
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
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be bounded, trimmed text.`, {
      label,
    });
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be an array.`);
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_CONTROL_INPUT', `${label} contains a duplicate.`);
  }
  return selected;
}

function uniqueGovernedKeys(values, label, permittedValues = null) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_CONTROL', `${label} must be an array.`);
  }
  const selected = values.map((value, index) => {
    const key = requireGovernedKey(value, `${label}[${index}]`);
    if (permittedValues && !permittedValues.includes(key)) {
      fail('INVALID_TRANSACTION_CONTROL', `${label}[${index}] is not governed.`);
    }
    return key;
  }).sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_CONTROL_INPUT', `${label} contains a duplicate.`);
  }
  return selected;
}

function normaliseDefinition(value) {
  requireExactKeys(
    value,
    ['definition_key', 'definition_version'],
    'control_outcome_definition_and_version',
  );
  if (!Number.isSafeInteger(value.definition_version) || value.definition_version < 1) {
    fail(
      'INVALID_TRANSACTION_CONTROL',
      'control_outcome_definition_and_version.definition_version must be positive.',
    );
  }
  return {
    definition_key: requireGovernedKey(
      value.definition_key,
      'control_outcome_definition_and_version.definition_key',
    ),
    definition_version: value.definition_version,
  };
}

function normaliseState(value) {
  requireObject(value, 'state');
  if (!CONTROL_STATES.includes(value.code)) {
    fail('INVALID_TRANSACTION_CONTROL_STATE', 'state.code is not governed.');
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
      fail('INVALID_TRANSACTION_CONTROL_STATE', 'NOT_APPLICABLE requires evidence.');
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

function normaliseCompleteInputSet(value) {
  requireExactKeys(
    value,
    COMPLETE_SELECTED_INPUT_FAMILIES,
    'complete_selected_input_set',
  );
  return Object.fromEntries(COMPLETE_SELECTED_INPUT_FAMILIES.map((family) => [
    family,
    uniqueSortedDigests(value[family], `complete_selected_input_set.${family}`),
  ]));
}

function normaliseDerivationRule(value) {
  if (value === null) return null;
  requireExactKeys(value, DERIVATION_RULE_KEYS, 'derivation_rule');
  if (!Number.isSafeInteger(value.rule_version) || value.rule_version < 1) {
    fail('INVALID_TRANSACTION_CONTROL_RULE', 'derivation_rule.rule_version must be positive.');
  }
  return {
    observed_signals: uniqueGovernedKeys(
      value.observed_signals,
      'derivation_rule.observed_signals',
    ),
    rule_key: requireGovernedKey(value.rule_key, 'derivation_rule.rule_key'),
    rule_version: value.rule_version,
    supporting_input_families: uniqueGovernedKeys(
      value.supporting_input_families,
      'derivation_rule.supporting_input_families',
      COMPLETE_SELECTED_INPUT_FAMILIES,
    ),
  };
}

function validatePresentControl({
  completeInputSet,
  conflictDisposition,
  controlOutcome,
  controllingEntityIds,
  derivationRule,
  effectiveTime,
  evidenceEdges,
}) {
  if (!CONTROL_OUTCOMES.includes(controlOutcome)) {
    fail('INVALID_TRANSACTION_CONTROL_OUTCOME', 'control_outcome is not governed.');
  }
  const emptyFamilies = COMPLETE_SELECTED_INPUT_FAMILIES.filter(
    (family) => completeInputSet[family].length === 0,
  );
  if (emptyFamilies.length > 0) {
    fail(
      'INCOMPLETE_TRANSACTION_CONTROL_INPUT',
      'A present control outcome requires all seven selected input families.',
      { empty_families: emptyFamilies },
    );
  }
  if (canonicalJson(completeInputSet.EXACT_EVIDENCE_EDGES)
    !== canonicalJson(evidenceEdges)) {
    fail(
      'UNBOUND_TRANSACTION_CONTROL_EVIDENCE',
      'The selected exact-evidence family must equal the revision evidence set.',
    );
  }
  if (effectiveTime === null || evidenceEdges.length === 0 || derivationRule === null) {
    fail(
      'TRANSACTION_CONTROL_EVIDENCE_REQUIRED',
      'A present control outcome requires time, evidence, and a derivation rule.',
    );
  }
  if (conflictDisposition === 'CLEAR') {
    const substantiveSupportingFamilies = derivationRule.supporting_input_families
      .filter((family) => family !== 'EXACT_EVIDENCE_EDGES');
    if (substantiveSupportingFamilies.length < 2
      || derivationRule.observed_signals.length < 2) {
      fail(
        'SINGLE_SIGNAL_CONTROL_INFERENCE',
        'Control requires support from at least two input families and two signals.',
      );
    }
    if (derivationRule.observed_signals.every(
      (signal) => SINGLE_INPUTS_THAT_NEVER_DECIDE_CONTROL.includes(signal),
    )) {
      fail(
        'NON_CONTROL_SIGNAL_INFERENCE',
        'Non-control facts cannot decide control, alone or together.',
      );
    }
  }
  if (controlOutcome === 'CONTROLLED_BY_ONE_PARTICIPANT'
    && controllingEntityIds.length !== 1) {
    fail(
      'INVALID_TRANSACTION_CONTROL_CARDINALITY',
      'CONTROLLED_BY_ONE_PARTICIPANT requires exactly one controlling entity.',
    );
  }
  if (['SHARED_CONTROL', 'NEW_HOLDCO_SHARED_CONTROL'].includes(controlOutcome)
    && controllingEntityIds.length < 2) {
    fail(
      'INVALID_TRANSACTION_CONTROL_CARDINALITY',
      `${controlOutcome} requires at least two controlling entities.`,
    );
  }
  if (controlOutcome === 'NO_CLEAR_CONTROL' && controllingEntityIds.length !== 0) {
    fail(
      'INVALID_TRANSACTION_CONTROL_CARDINALITY',
      'NO_CLEAR_CONTROL cannot name a controlling entity.',
    );
  }
}

function buildTransactionControlOutcomeOccurrence(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'transaction control input');
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(
      'INVALID_TRANSACTION_CONTROL',
      'governed_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    control_outcome_definition_and_version: normaliseDefinition(
      input.control_outcome_definition_and_version,
    ),
    effective_time_slot: requireGovernedKey(
      input.effective_time_slot,
      'effective_time_slot',
    ),
    expected_control_outcome_slot_key: requireGovernedKey(
      input.expected_control_outcome_slot_key,
      'expected_control_outcome_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_ordinal: input.governed_ordinal,
  };
  return deepFreeze({
    schema_version: TRANSACTION_CONTROL_OUTCOME_OCCURRENCE_SCHEMA_VERSION,
    transaction_control_outcome_occurrence_id: contentId(
      'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE/V1',
      body,
    ),
    ...body,
  });
}

function validateTransactionControlOutcomeOccurrence(occurrence) {
  requireExactKeys(occurrence, OCCURRENCE_KEYS, 'transaction control occurrence');
  const rebuilt = buildTransactionControlOutcomeOccurrence({
    control_outcome_definition_and_version:
      occurrence.control_outcome_definition_and_version,
    effective_time_slot: occurrence.effective_time_slot,
    expected_control_outcome_slot_key: occurrence.expected_control_outcome_slot_key,
    governed_deal_id: occurrence.governed_deal_id,
    governed_ordinal: occurrence.governed_ordinal,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(occurrence)) {
    fail(
      'STALE_TRANSACTION_CONTROL_OCCURRENCE',
      'Transaction control occurrence identity or content is stale.',
    );
  }
  return true;
}

function buildTransactionControlOutcomeRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'transaction control revision input');
  validateTransactionControlOutcomeOccurrence(input.transaction_control_outcome_occurrence);
  const occurrence = input.transaction_control_outcome_occurrence;
  const state = normaliseState(input.state);
  if (!CONTROL_CONFLICT_DISPOSITIONS.includes(input.conflict_disposition)) {
    fail(
      'INVALID_TRANSACTION_CONTROL_CONFLICT',
      'conflict_disposition is not governed.',
    );
  }
  const completeInputSet = normaliseCompleteInputSet(input.complete_selected_input_set);
  const controllingEntityIds = uniqueSortedDigests(
    input.controlling_entity_ids,
    'controlling_entity_ids',
  );
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const derivationRule = normaliseDerivationRule(input.derivation_rule);
  const effectiveTime = optionalDigest(input.effective_time, 'effective_time');
  const isPresent = state.code === 'PRESENT';
  const terminalEligible = isPresent && input.conflict_disposition === 'CLEAR';

  if (isPresent) {
    validatePresentControl({
      completeInputSet,
      conflictDisposition: input.conflict_disposition,
      controlOutcome: input.control_outcome,
      controllingEntityIds,
      derivationRule,
      effectiveTime,
      evidenceEdges,
    });
  }
  if (!isPresent && (
    COMPLETE_SELECTED_INPUT_FAMILIES.some(
      (family) => completeInputSet[family].length !== 0,
    )
    || controllingEntityIds.length !== 0
    || input.control_outcome !== null
    || derivationRule !== null
    || effectiveTime !== null
    || input.conflict_disposition !== 'CLEAR'
  )) {
    fail(
      'NON_PRESENT_TRANSACTION_CONTROL_VALUE',
      'A non-present control outcome cannot assert control values.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail(
      'TRANSACTION_CONTROL_EVIDENCE_REQUIRED',
      `${state.code} requires exact evidence.`,
    );
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_TRANSACTION_CONTROL_EVIDENCE',
      'Applicability evidence must be in the control evidence set.',
    );
  }

  const body = {
    complete_selected_input_set: completeInputSet,
    conflict_disposition: input.conflict_disposition,
    controlling_entity_ids: controllingEntityIds,
    control_outcome: input.control_outcome,
    derivation_rule: derivationRule,
    effective_time: effectiveTime,
    evidence_edges: evidenceEdges,
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    state,
    terminal_eligible: terminalEligible,
    transaction_control_outcome_occurrence_id:
      occurrence.transaction_control_outcome_occurrence_id,
  };
  return deepFreeze({
    schema_version: TRANSACTION_CONTROL_OUTCOME_REVISION_SCHEMA_VERSION,
    transaction_control_outcome_revision_id: contentId(
      'TRANSACTION_CONTROL_OUTCOME_REVISION/V1',
      body,
    ),
    ...body,
  });
}

function validateTransactionControlOutcomeRevision({
  revision,
  transaction_control_outcome_occurrence: occurrence,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'transaction control outcome revision');
  validateTransactionControlOutcomeOccurrence(occurrence);
  if (revision.transaction_control_outcome_occurrence_id
    !== occurrence.transaction_control_outcome_occurrence_id) {
    fail(
      'STALE_TRANSACTION_CONTROL_REVISION',
      'Revision refers to another control occurrence.',
    );
  }
  const rebuilt = buildTransactionControlOutcomeRevision({
    transaction_control_outcome_occurrence: occurrence,
    complete_selected_input_set: revision.complete_selected_input_set,
    conflict_disposition: revision.conflict_disposition,
    controlling_entity_ids: revision.controlling_entity_ids,
    control_outcome: revision.control_outcome,
    derivation_rule: revision.derivation_rule,
    effective_time: revision.effective_time,
    evidence_edges: revision.evidence_edges,
    resolver_version: revision.resolver_version,
    state: revision.state,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail(
      'STALE_TRANSACTION_CONTROL_REVISION',
      'Transaction control revision identity or content is stale.',
    );
  }
  return true;
}

module.exports = {
  COMPLETE_SELECTED_INPUT_FAMILIES,
  CONTROL_CONFLICT_DISPOSITIONS,
  CONTROL_OUTCOMES,
  CONTROL_STATES,
  SINGLE_INPUTS_THAT_NEVER_DECIDE_CONTROL,
  TRANSACTION_CONTROL_OUTCOME_OCCURRENCE_SCHEMA_VERSION,
  TRANSACTION_CONTROL_OUTCOME_REVISION_SCHEMA_VERSION,
  TransactionControlOutcomeError,
  buildTransactionControlOutcomeOccurrence,
  buildTransactionControlOutcomeRevision,
  validateTransactionControlOutcomeOccurrence,
  validateTransactionControlOutcomeRevision,
};
