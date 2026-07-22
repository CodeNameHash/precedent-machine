const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');

const SHA256_RE = /^[a-f0-9]{64}$/;

const METRIC_DEFINITIONS = Object.freeze({
  IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'IOC-CAPEX',
    owner_lineage_mode: 'RESULT_OPTIONAL_RELATIONSHIPS',
    required_claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    required_relationship_key: null,
    value_dimension: 'MONEY_RELATIVE_TO_DEAL_VALUE',
    canonical_unit: 'PERCENT_OF_DEAL_VALUE',
    basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    denominator_basis: 'HEADLINE_TRANSACTION_VALUE',
    currency: 'USD',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    metric_version: 1,
    concept_key: 'NOSOL-MATCH',
    owner_lineage_mode: 'RESULT_CLAIM',
    required_claim_definition_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    required_relationship_key: null,
    value_dimension: 'DURATION',
    canonical_unit: 'DAYS',
    basis_key: 'DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    allowed_day_bases: Object.freeze(['BUSINESS']),
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    metric_version: 1,
    concept_key: 'NOSOL-NOTICE',
    owner_lineage_mode: 'RESULT_CLAIM',
    required_claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    required_relationship_key: null,
    value_dimension: 'DURATION',
    canonical_unit: 'DAYS',
    basis_key: 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    allowed_day_bases: Object.freeze(['ELAPSED']),
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  NO_SHOP_PROHIBITED_ACTION: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    metric_version: 1,
    concept_key: 'NOSOL-PROHIBIT',
    owner_lineage_mode: 'RESULT_OPTIONAL_RELATIONSHIPS',
    required_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    required_relationship_key: null,
    value_dimension: 'CATEGORICAL',
    canonical_unit: 'PROHIBITED_ACTION_CODE',
    allowed_canonical_values: Object.freeze([
      'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
      'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
      'CHANGE_RECOMMENDATION',
      'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
      'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
    ]),
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    metric_version: 1,
    concept_key: 'NOSOL-REMATCH',
    owner_lineage_mode: 'RESULT_CLAIM',
    required_claim_definition_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    required_relationship_key: null,
    value_dimension: 'DURATION',
    canonical_unit: 'DAYS',
    basis_key: 'DAYS:BUSINESS:MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    allowed_day_bases: Object.freeze(['BUSINESS']),
    trigger: 'MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  REPRESENTATION_ACCURACY_STANDARD: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    concept_key: 'COND-B-REP',
    owner_lineage_mode: 'RESULT_RELATIONSHIP',
    required_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    required_relationship_key: 'BRINGS_DOWN',
    value_dimension: 'CATEGORICAL',
    canonical_unit: 'ACCURACY_STANDARD_CODE',
    allowed_canonical_values: Object.freeze([
      'MAT_ALL_RESPECTS',
      'MAT_ALL_RESPECTS_DE_MINIMIS',
      'MAT_ALL_MATERIAL',
      'MAT_MAE_QUALIFIED',
    ]),
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: Object.freeze({
    schema_version: 'METRIC_DEFINITION/V1',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    owner_lineage_mode: 'RESULT_OPTIONAL_RELATIONSHIPS',
    required_claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    required_relationship_key: null,
    value_dimension: 'MONEY_RELATIVE_TO_DEAL_VALUE',
    canonical_unit: 'PERCENT_OF_DEAL_VALUE',
    basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    denominator_basis: 'HEADLINE_TRANSACTION_VALUE',
    currency: 'USD',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
});

const EXCLUSION_REASONS = Object.freeze([
  'CLAIM_NOT_PRESENT',
  'OWNER_NOT_VALIDATED',
  'OWNER_RELATIONSHIP_MISSING',
  'OWNER_RELATIONSHIP_NOT_EXAMINED',
  'OWNER_RELATIONSHIP_FAILED',
  'RESULT_INCOMPLETE',
  'RESULT_NOT_COMPARABLE',
  'VALUE_OUTSIDE_METRIC_CONTRACT',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 content ID`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function requireParty(party) {
  if (!party || typeof party !== 'object' || Array.isArray(party)) throw new TypeError('party must be an object');
  const result = {
    role: requireText(party.role, 'party.role'),
    value: requireText(party.value, 'party.value'),
    capacity: requireText(party.capacity, 'party.capacity'),
  };
  if (Object.keys(party).sort().join(',') !== 'capacity,role,value') {
    throw new TypeError('party must contain exactly role, value and capacity');
  }
  return result;
}

function requireMetric(metricKey) {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!definition) throw new TypeError(`unknown fixture metric: ${metricKey}`);
  return definition;
}

function sortedDigests(values, label) {
  const result = [...new Set((values || []).map((value) => requireDigest(value, label)))].sort();
  return result;
}

function validateDimensions(dimensions = {}) {
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    throw new TypeError('dimensions must be an object');
  }
  const allowed = new Set([
    'sector',
    'buyer',
    'merger_form',
    'adviser_firms',
    'lawyers',
    'announce_year',
    'deal_value_usd',
  ]);
  const unknown = Object.keys(dimensions).filter((key) => !allowed.has(key));
  if (unknown.length) throw new TypeError(`unsupported serving dimension: ${unknown.sort().join(', ')}`);
  const result = {};
  for (const key of ['sector', 'buyer', 'merger_form']) {
    const value = dimensions[key];
    result[key] = value == null || value === '' ? null : requireText(value, `dimensions.${key}`);
  }
  for (const key of ['adviser_firms', 'lawyers']) {
    const value = dimensions[key];
    if (value == null) result[key] = [];
    else if (!Array.isArray(value)) throw new TypeError(`dimensions.${key} must be an array`);
    else result[key] = [...new Set(value.map((entry) => requireText(entry, `dimensions.${key}`)))].sort();
  }
  if (dimensions.announce_year == null) result.announce_year = null;
  else if (!Number.isInteger(dimensions.announce_year) || dimensions.announce_year < 1900 || dimensions.announce_year > 2200) {
    throw new TypeError('dimensions.announce_year must be a four-digit year');
  } else result.announce_year = dimensions.announce_year;
  if (dimensions.deal_value_usd == null) result.deal_value_usd = null;
  else if (typeof dimensions.deal_value_usd !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(dimensions.deal_value_usd)) {
    throw new TypeError('dimensions.deal_value_usd must be a non-negative canonical decimal string');
  } else result.deal_value_usd = dimensions.deal_value_usd;
  return result;
}

function metricDefinitionId(definition) {
  return contentId('METRIC_DEFINITION/V1', definition);
}

function buildFixtureResultComponent({
  deal_admission_id,
  result_key,
  result_version,
  concept_key,
  party,
  value_slot_key,
  ordinal,
  claim,
  relationships = [],
  composition_scope_closure_id,
  completeness,
  comparability,
}) {
  requireDigest(deal_admission_id, 'deal_admission_id');
  requireText(result_key, 'result_key');
  if (!Number.isInteger(result_version) || result_version < 1) throw new TypeError('result_version must be a positive integer');
  requireText(concept_key, 'concept_key');
  const governedParty = requireParty(party);
  requireText(value_slot_key, 'value_slot_key');
  if (!Number.isInteger(ordinal) || ordinal < 0) throw new TypeError('ordinal must be a non-negative integer');
  if (!claim) throw new TypeError('claim is required');
  requireDigest(claim.claim_revision_id, 'claim.claim_revision_id');
  requireDigest(composition_scope_closure_id, 'composition_scope_closure_id');
  if (!['COMPLETE', 'INCOMPLETE'].includes(completeness)) throw new TypeError('invalid result completeness');
  if (!['COMPARABLE', 'NOT_CERTIFIED', 'NOT_COMPARABLE'].includes(comparability)) {
    throw new TypeError('invalid result comparability');
  }
  const relationshipRevisionIds = sortedDigests(
    relationships.map((row) => row.relationship_revision_id),
    'relationship.relationship_revision_id',
  );
  const relationshipEffectDigests = relationships
    .filter((row) => row.effect != null)
    .map((row) => contentId('RELATIONSHIP_EFFECT/V1', row.effect))
    .sort();
  const occurrencePayload = {
    schema_version: 'RESULT_COMPONENT_OCCURRENCE/V1',
    deal_admission_id,
    result_key,
    result_version,
    concept_key,
    party: governedParty,
    value_slot_key,
    ordinal,
  };
  const componentOccurrenceId = contentId('RESULT_COMPONENT_OCCURRENCE/V1', occurrencePayload);
  const lineagePayload = {
    schema_version: 'RESULT_INPUT_LINEAGE/V1',
    component_occurrence_id: componentOccurrenceId,
    claim_revision_ids: [claim.claim_revision_id],
    relationship_revision_ids: relationshipRevisionIds,
    relationship_effect_digests: relationshipEffectDigests,
  };
  const inputLineageDigest = contentId('RESULT_INPUT_LINEAGE/V1', lineagePayload);
  const revisionPayload = {
    schema_version: 'RESULT_COMPONENT_REVISION/V1',
    component_occurrence_id: componentOccurrenceId,
    result_key,
    result_version,
    concept_key,
    party: governedParty,
    value_slot_key,
    ordinal,
    claim_revision_ids: lineagePayload.claim_revision_ids,
    relationship_revision_ids: relationshipRevisionIds,
    relationship_effect_digests: relationshipEffectDigests,
    composition_scope_closure_id,
    input_lineage_digest: inputLineageDigest,
    completeness,
    comparability,
  };
  return Object.freeze({
    ...revisionPayload,
    component_revision_id: contentId('RESULT_COMPONENT_REVISION/V1', revisionPayload),
  });
}

function slotIdentity(input, definition, party) {
  return {
    schema_version: 'MARKET_METRIC_SLOT/V1',
    metric_definition_id: metricDefinitionId(definition),
    deal_key: requireText(input.deal.deal_key, 'deal.deal_key'),
    deal_admission_id: requireDigest(input.deal.deal_admission_id, 'deal.deal_admission_id'),
    concept_key: definition.concept_key,
    metric_key: definition.metric_key,
    metric_version: definition.metric_version,
    party,
    result_key: requireText(input.result.result_key, 'result.result_key'),
    result_version: input.result.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: requireDigest(input.result.component_occurrence_id, 'result.component_occurrence_id'),
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: requireDigest(input.result.component_occurrence_id, 'result.component_occurrence_id'),
    value_slot_key: requireText(input.value_slot_key, 'value_slot_key'),
    ordinal: input.ordinal,
  };
}

function exclusionReason(input, definition, relationship) {
  if (input.claim.publication_state !== 'VALIDATED') return 'OWNER_NOT_VALIDATED';
  if (input.claim.state !== 'PRESENT') return 'CLAIM_NOT_PRESENT';
  const allowedValue = Array.isArray(definition.allowed_canonical_values)
    ? definition.allowed_canonical_values.some(
      (value) => canonicalJson(value) === canonicalJson(input.claim.canonical_value),
    )
    : definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
      && typeof input.claim.canonical_value === 'string'
      && /^(0|[1-9]\d*)(\.\d+)?$/.test(input.claim.canonical_value);
  const allowedDurationBasis = definition.value_dimension !== 'DURATION'
    || (input.claim.unit === definition.canonical_unit
      && definition.allowed_day_bases.includes(input.claim.day_basis)
      && input.claim.attributes?.trigger === definition.trigger);
  const allowedMoneyBasis = definition.value_dimension !== 'MONEY_RELATIVE_TO_DEAL_VALUE'
    || (input.claim.unit === definition.canonical_unit
      && input.claim.attributes?.basis_key === definition.basis_key
      && input.claim.denominator?.basis === definition.denominator_basis
      && input.claim.denominator?.currency === definition.currency
      && Array.isArray(input.claim.denominator?.source_lineage_ids)
      && input.claim.denominator.source_lineage_ids.length > 0);
  if (!allowedValue || !allowedDurationBasis || !allowedMoneyBasis) {
    return 'VALUE_OUTSIDE_METRIC_CONTRACT';
  }
  if (!definition.required_relationship_key) {
    if (input.result.completeness !== 'COMPLETE') return 'RESULT_INCOMPLETE';
    if (input.result.comparability !== 'COMPARABLE') return 'RESULT_NOT_COMPARABLE';
    return null;
  }
  if (!relationship) return 'OWNER_RELATIONSHIP_MISSING';
  if (relationship.publication_state !== 'VALIDATED') return 'OWNER_NOT_VALIDATED';
  if (relationship.state === 'NOT_EXAMINED') return 'OWNER_RELATIONSHIP_NOT_EXAMINED';
  if (relationship.state === 'FAILED') return 'OWNER_RELATIONSHIP_FAILED';
  if (relationship.state !== 'PRESENT') return 'OWNER_RELATIONSHIP_MISSING';
  if (input.result.completeness !== 'COMPLETE') return 'RESULT_INCOMPLETE';
  if (input.result.comparability !== 'COMPARABLE') return 'RESULT_NOT_COMPARABLE';
  return null;
}

function exclusionStates(reason, claimState) {
  const failed = ['OWNER_NOT_VALIDATED', 'OWNER_RELATIONSHIP_FAILED'].includes(reason);
  const notExamined = reason === 'OWNER_RELATIONSHIP_NOT_EXAMINED';
  return {
    eligibility_state: 'ELIGIBLE',
    applicability_state: 'APPLICABLE',
    examination_state: failed ? 'FAILED' : notExamined ? 'NOT_EXAMINED' : 'EXAMINED',
    presence_state: claimState === 'PRESENT' ? 'PRESENT' : 'ABSENT',
    comparability_state: reason === 'RESULT_NOT_COMPARABLE' ? 'NOT_COMPARABLE' : 'NOT_CERTIFIED',
  };
}

function projectMarketMetricSlot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('projection input must be an object');
  validateContractBundle(input.contract_bundle);
  requireDigest(input.corpus_release_id, 'corpus_release_id');
  if (input.release_state !== 'CANDIDATE_CERTIFIED') {
    throw new TypeError('only a CANDIDATE_CERTIFIED release may build the fixture serving projection');
  }
  if (!input.deal || !input.result || !input.claim) throw new TypeError('deal, result and claim are required');
  if (!Number.isInteger(input.result.result_version) || input.result.result_version < 1) {
    throw new TypeError('result.result_version must be a positive integer');
  }
  if (!Number.isInteger(input.ordinal) || input.ordinal < 0) throw new TypeError('ordinal must be a non-negative integer');
  const definition = requireMetric(input.metric_key);
  if (input.concept_key !== definition.concept_key) throw new TypeError('concept does not match the metric contract');
  if (input.claim.claim_definition_key !== definition.required_claim_definition_key) {
    throw new TypeError('claim does not match the metric contract');
  }
  validateClaimRevisionIdentity(input.claim);
  for (const relationshipRow of input.relationships || []) validateRelationshipRevisionIdentity(relationshipRow);
  requireDigest(input.claim.claim_occurrence_id, 'claim.claim_occurrence_id');
  requireDigest(input.claim.claim_revision_id, 'claim.claim_revision_id');
  requireDigest(input.result.component_revision_id, 'result.component_revision_id');
  requireDigest(input.result.composition_scope_closure_id, 'result.composition_scope_closure_id');
  requireDigest(input.result.input_lineage_digest, 'result.input_lineage_digest');
  const party = requireParty(input.party);
  const dimensions = validateDimensions(input.deal.dimensions);
  const expectedResult = buildFixtureResultComponent({
    deal_admission_id: input.deal.deal_admission_id,
    result_key: input.result.result_key,
    result_version: input.result.result_version,
    concept_key: input.concept_key,
    party,
    value_slot_key: input.value_slot_key,
    ordinal: input.ordinal,
    claim: input.claim,
    relationships: input.relationships,
    composition_scope_closure_id: input.result.composition_scope_closure_id,
    completeness: input.result.completeness,
    comparability: input.result.comparability,
  });
  if (canonicalJson(input.result) !== canonicalJson(expectedResult)) {
    throw new TypeError('result component identity or input lineage does not match its canonical inputs');
  }
  const relationships = (input.relationships || []).filter((row) => (
    row.source_occurrence_id === input.claim.subject_occurrence_id
      && (!definition.required_relationship_key
        || row.relationship_definition_key === definition.required_relationship_key)
  ));
  if (definition.required_relationship_key && relationships.length > 1) {
    throw new TypeError('metric slot has more than one governed required relationship');
  }
  const relationship = definition.required_relationship_key ? relationships[0] || null : null;
  const slot = slotIdentity(input, definition, party);
  const metricSlotKey = contentId('MARKET_METRIC_SLOT/V1', slot);
  const reason = exclusionReason(input, definition, relationship);
  const evidenceIds = sortedDigests([
    ...(input.claim.evidence_ids || []),
    ...relationships.flatMap((row) => row.evidence_ids || []),
  ], 'evidence_id');
  const relationshipRevisionIds = relationships
    .map((row) => requireDigest(row.relationship_revision_id, 'relationship.relationship_revision_id'))
    .sort();
  const relationshipEffectDigests = relationships
    .filter((row) => row.effect)
    .map((row) => contentId('RELATIONSHIP_EFFECT/V1', row.effect))
    .sort();
  const relationshipEffects = relationships
    .map((row) => ({
      relationship_revision_id: row.relationship_revision_id,
      relationship_definition_key: row.relationship_definition_key,
      state: row.state,
      effect: row.effect ? clone(row.effect) : null,
      evidence_ids: [...row.evidence_ids],
    }))
    .sort((left, right) => left.relationship_revision_id.localeCompare(right.relationship_revision_id));
  const common = {
    schema_version: 'MARKET_METRIC_SLOT_OUTPUT/V1',
    corpus_release_id: input.corpus_release_id,
    contract_fingerprint: input.contract_bundle.fingerprint,
    metric_slot_key: metricSlotKey,
    metric_definition_id: slot.metric_definition_id,
    deal_key: slot.deal_key,
    deal_admission_id: slot.deal_admission_id,
    concept_key: slot.concept_key,
    metric_key: slot.metric_key,
    metric_version: slot.metric_version,
    party,
    result_key: slot.result_key,
    result_version: slot.result_version,
    owner_type: slot.owner_type,
    owner_occurrence_id: slot.owner_occurrence_id,
    owner_revision_id: input.result.component_revision_id,
    scope_type: slot.scope_type,
    scope_id: slot.scope_id,
    value_slot_key: slot.value_slot_key,
    ordinal: slot.ordinal,
    claim_occurrence_id: input.claim.claim_occurrence_id,
    claim_revision_id: input.claim.claim_revision_id,
    claim_evidence_ids: [...input.claim.evidence_ids],
    claim_scope_closure_id: input.claim.scope && input.claim.scope.scope_closure_id
      ? requireDigest(input.claim.scope.scope_closure_id, 'claim.scope.scope_closure_id')
      : null,
    composition_scope_closure_id: input.result.composition_scope_closure_id,
    result_input_lineage_digest: input.result.input_lineage_digest,
    relationship_revision_ids: relationshipRevisionIds,
    relationship_effect_digests: relationshipEffectDigests,
    relationship_effects: relationshipEffects,
    evidence_ids: evidenceIds,
    dimensions,
  };

  if (reason) {
    const exclusionBody = {
      ...common,
      schema_version: 'MARKET_METRIC_SLOT_EXCLUSION/V1',
      exclusion_reason: reason,
      claim_state: input.claim.state,
      ...exclusionStates(reason, input.claim.state),
      result_completeness: input.result.completeness,
      market_comparability: input.result.comparability,
      relationship_state: relationship ? relationship.state : 'MISSING',
      raw_value: input.claim.raw_value ?? null,
      unresolved_basis: relationship && relationship.not_examined ? clone(relationship.not_examined) : null,
      cohort_membership: 'NO_COHORT_MEMBERSHIP',
      aggregate_authority: 'NO_AGGREGATE_AUTHORITY',
      ...dimensions,
    };
    const exclusionServingKey = contentId('MARKET_METRIC_SLOT_EXCLUSION/V1', {
      schema_version: 'MARKET_METRIC_SLOT_EXCLUSION/V1',
      corpus_release_id: input.corpus_release_id,
      metric_slot_key: metricSlotKey,
    });
    const exclusion = {
      exclusion_serving_key: exclusionServingKey,
      ...exclusionBody,
      canonical_payload_digest: contentId('MARKET_METRIC_SLOT_EXCLUSION_PAYLOAD/V1', exclusionBody),
    };
    return Object.freeze({ metric_slot_key: metricSlotKey, observation: null, exclusion: Object.freeze(exclusion) });
  }

  const observationOccurrence = {
    schema_version: 'METRIC_OBSERVATION_OCCURRENCE/V1',
    deal_key: slot.deal_key,
    deal_admission_id: slot.deal_admission_id,
    concept_key: slot.concept_key,
    metric_key: slot.metric_key,
    metric_version: slot.metric_version,
    party,
    result_key: slot.result_key,
    result_version: slot.result_version,
    owner_type: slot.owner_type,
    owner_occurrence_id: slot.owner_occurrence_id,
    scope_type: slot.scope_type,
    scope_id: slot.scope_id,
    value_slot_key: slot.value_slot_key,
    ordinal: slot.ordinal,
  };
  const metricObservationOccurrenceId = contentId('METRIC_OBSERVATION_OCCURRENCE/V1', observationOccurrence);
  const observationBody = {
    ...common,
    schema_version: 'MARKET_OBSERVATION/V1',
    metric_observation_occurrence_id: metricObservationOccurrenceId,
    state: input.claim.state,
    raw_value: input.claim.raw_value,
    canonical_value: input.claim.canonical_value,
    unit: input.claim.unit,
    day_basis: input.claim.day_basis,
    denominator: clone(input.claim.denominator),
    value_dimension: definition.value_dimension,
    canonical_unit: definition.canonical_unit,
    basis_key: definition.basis_key || definition.canonical_unit,
    derivation_version: input.claim.derivation_version,
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE',
    cohort_membership: 'COMPARABLE',
    eligibility_state: 'ELIGIBLE',
    applicability_state: 'APPLICABLE',
    examination_state: 'EXAMINED',
    presence_state: 'PRESENT',
    comparability_state: 'COMPARABLE',
    ...dimensions,
  };
  const observationServingKey = contentId('MARKET_OBSERVATION/V1', {
    corpus_release_id: input.corpus_release_id,
    metric_observation_occurrence_id: metricObservationOccurrenceId,
  });
  const observation = {
    market_observation_serving_key: observationServingKey,
    ...observationBody,
    canonical_payload_digest: contentId('MARKET_OBSERVATION_PAYLOAD/V1', observationBody),
  };
  return Object.freeze({ metric_slot_key: metricSlotKey, observation: Object.freeze(observation), exclusion: null });
}

function validateProjectedMetricSlotOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new TypeError('market metric slot output must be an object');
  requireDigest(output.metric_slot_key, 'metric_slot_key');
  if (Boolean(output.observation) === Boolean(output.exclusion)) {
    throw new TypeError('each market metric slot must have exactly one observation or exclusion');
  }
  const row = output.observation || output.exclusion;
  if (row.metric_slot_key !== output.metric_slot_key) throw new TypeError('market metric slot mismatch');
  const definition = requireMetric(row.metric_key);
  const expectedSlotKey = contentId('MARKET_METRIC_SLOT/V1', {
    schema_version: 'MARKET_METRIC_SLOT/V1',
    metric_definition_id: metricDefinitionId(definition),
    deal_key: row.deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: row.concept_key,
    metric_key: row.metric_key,
    metric_version: row.metric_version,
    party: row.party,
    result_key: row.result_key,
    result_version: row.result_version,
    owner_type: row.owner_type,
    owner_occurrence_id: row.owner_occurrence_id,
    scope_type: row.scope_type,
    scope_id: row.scope_id,
    value_slot_key: row.value_slot_key,
    ordinal: row.ordinal,
  });
  if (expectedSlotKey !== output.metric_slot_key) throw new TypeError('market metric slot identity mismatch');
  if (output.observation) {
    const expectedOccurrenceId = contentId('METRIC_OBSERVATION_OCCURRENCE/V1', {
      schema_version: 'METRIC_OBSERVATION_OCCURRENCE/V1',
      deal_key: row.deal_key,
      deal_admission_id: row.deal_admission_id,
      concept_key: row.concept_key,
      metric_key: row.metric_key,
      metric_version: row.metric_version,
      party: row.party,
      result_key: row.result_key,
      result_version: row.result_version,
      owner_type: row.owner_type,
      owner_occurrence_id: row.owner_occurrence_id,
      scope_type: row.scope_type,
      scope_id: row.scope_id,
      value_slot_key: row.value_slot_key,
      ordinal: row.ordinal,
    });
    if (row.metric_observation_occurrence_id !== expectedOccurrenceId) {
      throw new TypeError('market observation occurrence identity mismatch');
    }
    const expectedServingKey = contentId('MARKET_OBSERVATION/V1', {
      corpus_release_id: row.corpus_release_id,
      metric_observation_occurrence_id: expectedOccurrenceId,
    });
    if (row.market_observation_serving_key !== expectedServingKey) throw new TypeError('market observation serving identity mismatch');
    const {
      market_observation_serving_key: _servingKey,
      canonical_payload_digest,
      ...body
    } = row;
    if (canonical_payload_digest !== contentId('MARKET_OBSERVATION_PAYLOAD/V1', body)) {
      throw new TypeError('market observation payload digest mismatch');
    }
  } else {
    const expectedServingKey = contentId('MARKET_METRIC_SLOT_EXCLUSION/V1', {
      schema_version: 'MARKET_METRIC_SLOT_EXCLUSION/V1',
      corpus_release_id: row.corpus_release_id,
      metric_slot_key: row.metric_slot_key,
    });
    if (row.exclusion_serving_key !== expectedServingKey) throw new TypeError('market exclusion serving identity mismatch');
    const {
      exclusion_serving_key: _servingKey,
      canonical_payload_digest,
      ...body
    } = row;
    if (canonical_payload_digest !== contentId('MARKET_METRIC_SLOT_EXCLUSION_PAYLOAD/V1', body)) {
      throw new TypeError('market exclusion payload digest mismatch');
    }
  }
  return true;
}

function assertMetricSlotPartition(outputs) {
  const seen = new Set();
  for (const output of outputs || []) {
    requireDigest(output.metric_slot_key, 'metric_slot_key');
    if (seen.has(output.metric_slot_key)) throw new TypeError('duplicate market metric slot');
    seen.add(output.metric_slot_key);
    validateProjectedMetricSlotOutput(output);
  }
  return true;
}

module.exports = {
  EXCLUSION_REASONS,
  METRIC_DEFINITIONS,
  assertMetricSlotPartition,
  buildFixtureResultComponent,
  metricDefinitionId,
  projectMarketMetricSlot,
  validateDimensions,
  validateProjectedMetricSlotOutput,
};
