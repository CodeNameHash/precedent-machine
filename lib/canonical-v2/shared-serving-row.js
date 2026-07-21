const { canonicalJson, contentId } = require('./canonical-bytes');
const { compileFixtureContract, validateContractBundle } = require('./contract-bundle');
const {
  compileMarketCohortRequest,
  validateMarketCohortResult,
} = require('./market-cohort-query');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
  validateDimensions,
  validateProjectedMetricSlotOutput,
} = require('./serving-projection');

const SHA256_RE = /^[a-f0-9]{64}$/;
const FIXTURE_CONTRACT = compileFixtureContract();
const EXACT_DETAIL_ACTIONS = new Map(FIXTURE_CONTRACT.serving_exact_detail_action_definitions.map(
  (action) => [action.action_slot_key, action],
));

const SHARED_ROW_VARIANTS = Object.freeze({
  CANONICAL_RESULT: Object.freeze({
    body_key: 'canonical_result',
    forbidden_body_keys: Object.freeze(['incomplete_canonical_result', 'reviewed_source_specific']),
    producer_status: 'IMPLEMENTED_FIXTURE',
  }),
  INCOMPLETE_CANONICAL_RESULT: Object.freeze({
    body_key: 'incomplete_canonical_result',
    forbidden_body_keys: Object.freeze(['canonical_result', 'reviewed_source_specific']),
    producer_status: 'NOT_IMPLEMENTED',
  }),
  REVIEWED_SOURCE_SPECIFIC: Object.freeze({
    body_key: 'reviewed_source_specific',
    forbidden_body_keys: Object.freeze(['canonical_result', 'incomplete_canonical_result']),
    producer_status: 'NOT_IMPLEMENTED',
  }),
});

const COMMON_KEYS = Object.freeze([
  'schema_version',
  'row_kind',
  'corpus_release_id',
  'frozen_pair_id',
  'governed_deal_key',
  'deal_admission_id',
  'row_serving_key',
  'serving_contract',
  'provenance',
  'source_actions',
  'canonical_payload_digest',
]);

const CANONICAL_RESULT_KEYS = Object.freeze([
  'result_key',
  'result_version',
  'concept_key',
  'concept_version',
  'party',
  'result_completeness',
  'market_comparability',
  'governed_reason_codes',
  'derived_result_occurrence_id',
  'derived_result_revision_id',
  'result_ordinal',
  'components',
  'refinable_dimensions',
  'market_context',
  'source_detail_state',
]);

const COMPONENT_KEYS = Object.freeze([
  'component_occurrence_id',
  'component_revision_id',
  'component_slot_key',
  'governed_ordinal',
  'component_state',
  'claim_occurrence_id',
  'claim_revision_id',
  'claim_scope_closure_id',
  'composition_scope_closure_id',
  'result_input_lineage_digest',
  'relationship_revision_ids',
  'relationship_total',
  'relationship_set_digest',
  'bounded_relationship_effects',
  'raw_value',
  'canonical_value',
  'unit',
  'day_basis',
  'denominator',
  'derivation_version',
]);

const BOUNDED_RELATIONSHIP_EFFECT_KEYS = Object.freeze([
  'relationship_revision_id',
  'relationship_definition_key',
  'state',
  'effect',
]);

const COHORT_COUNT_KEYS = Object.freeze([
  'eligible_deals',
  'applicable_deals',
  'examined_deals',
  'present_deals',
  'comparable_deals',
  'distribution_deals',
  'excluded_deals',
  'observation_slots',
  'excluded_slots',
]);

const SOURCE_ACTION_KEYS = Object.freeze([
  'action_slot_key',
  'action_version',
  'action_definition_id',
  'action_definition_payload_digest',
  'detail_kind',
  'source_detail_reference_id',
  'source_detail_payload_id',
  'parent_edge_id',
  'governed_ordinal',
]);

const FORBIDDEN_KEYS = new Set([
  'error',
  'cache_key',
  'request_id',
  'execution_id',
  'timestamp',
  'nonce',
  'cursor',
  'signature',
  'url',
  'credentials',
  'object_store_path',
  'cards',
  'claims',
  'observations',
  'hydrated_provisions',
  'candidate_manifest',
  'review_payload',
  'attestation',
  'correction_payload',
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

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new TypeError(`${label} fields do not match the frozen contract`);
}

function metricAllowsCanonicalValue(metric, value) {
  if (Array.isArray(metric.allowed_canonical_values)) {
    return metric.allowed_canonical_values.some((allowed) => canonicalJson(allowed) === canonicalJson(value));
  }
  return metric.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
    && typeof value === 'string'
    && /^(0|[1-9]\d*)(\.\d+)?$/.test(value);
}

function assertNoForbiddenPayload(value, path = 'row') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`${path}.${key} is forbidden in SharedServingRow`);
    if (child === 'FAILED' || child === 'BLOCKED' || child === 'OTHER') {
      throw new TypeError(`${path}.${key} contains a forbidden serving state`);
    }
    assertNoForbiddenPayload(child, `${path}.${key}`);
  }
}

function servingContract(contractFingerprint) {
  return {
    access_registry_digest: contentId('SERVING_OBJECT_ACCESS_REGISTRY/V1', {
      contract_fingerprint: contractFingerprint,
      allowed_row_kinds: Object.keys(SHARED_ROW_VARIANTS),
    }),
    offline_denylist_digest: contentId('SERVING_OFFLINE_DENYLIST/V1', {
      contract_fingerprint: contractFingerprint,
      forbidden_keys: [...FORBIDDEN_KEYS].sort(),
    }),
    embedded_reference_allowlist_digest: contentId('SERVING_EMBEDDED_REFERENCE_ALLOWLIST/V1', {
      contract_fingerprint: contractFingerprint,
      source_actions: [...EXACT_DETAIL_ACTIONS.keys()].sort(),
    }),
  };
}

function validateSourceActions(row, body) {
  if (!Array.isArray(row.source_actions) || row.source_actions.length > 1) {
    throw new TypeError('fixture source_actions must contain at most one governed action');
  }
  if (row.source_actions.length === 0) {
    requireExactKeys(body.source_detail_state, ['state', 'reason_code'], 'canonical_result.source_detail_state');
    if (body.source_detail_state.state !== 'UNAVAILABLE'
      || body.source_detail_state.reason_code !== 'EXACT_DETAIL_PROJECTION_NOT_BUILT') {
      throw new TypeError('a row without source actions requires its exact no-detail reason');
    }
    return;
  }
  const action = row.source_actions[0];
  const definition = EXACT_DETAIL_ACTIONS.get(action.action_slot_key);
  if (!definition) throw new TypeError('source action is outside the frozen exact-detail contract');
  requireExactKeys(action, SOURCE_ACTION_KEYS, 'source_actions[0]');
  for (const key of [
    'action_definition_id',
    'action_definition_payload_digest',
    'source_detail_reference_id',
    'source_detail_payload_id',
    'parent_edge_id',
  ]) requireDigest(action[key], `source_actions[0].${key}`);
  if (action.action_version !== definition.action_version
    || action.action_definition_id !== definition.action_definition_id
    || action.action_definition_payload_digest !== definition.action_definition_payload_digest
    || action.detail_kind !== definition.detail_kind
    || action.governed_ordinal !== 0) {
    throw new TypeError('source action is outside the frozen exact-detail contract');
  }
  requireExactKeys(body.source_detail_state, ['state', 'reason_code'], 'canonical_result.source_detail_state');
  if (body.source_detail_state.state !== 'AVAILABLE'
    || body.source_detail_state.reason_code !== 'EXACT_DETAIL_CERTIFIED') {
    throw new TypeError('a row with a source action requires certified exact detail');
  }
}

function buildCanonicalResultServingRow({
  contract_bundle,
  frozen_pair_id,
  projection_output,
  cohort_request,
  cohort_result,
  result_ordinal = 0,
}) {
  validateContractBundle(contract_bundle);
  requireDigest(frozen_pair_id, 'frozen_pair_id');
  validateProjectedMetricSlotOutput(projection_output);
  if (!projection_output.observation) throw new TypeError('only a comparable market observation can produce a canonical serving row');
  if (!Number.isInteger(result_ordinal) || result_ordinal < 0) throw new TypeError('result_ordinal must be a non-negative integer');
  const observation = projection_output.observation;
  const compiledRequest = compileMarketCohortRequest(cohort_request);
  validateMarketCohortResult(cohort_result, compiledRequest);
  if (observation.contract_fingerprint !== contract_bundle.fingerprint
    || observation.corpus_release_id !== compiledRequest.corpus_release_id
    || observation.deal_key !== compiledRequest.subject_deal_key
    || observation.metric_key !== compiledRequest.metric_key
    || observation.metric_version !== compiledRequest.metric_version
    || observation.concept_key !== compiledRequest.concept_key
    || observation.basis_key !== compiledRequest.basis_key
    || canonicalJson(observation.party) !== canonicalJson(compiledRequest.party)) {
    throw new TypeError('observation, cohort and selected-deal identities do not agree');
  }
  if (observation.result_completeness !== 'COMPLETE'
    || observation.market_comparability !== 'COMPARABLE'
    || observation.state !== 'PRESENT') {
    throw new TypeError('canonical serving rows require a complete, comparable PRESENT result');
  }

  const derivedResultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: observation.deal_admission_id,
    result_key: observation.result_key,
    result_version: observation.result_version,
    concept_key: observation.concept_key,
    party: observation.party,
    result_ordinal,
  });
  const relationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: observation.result_key,
    result_version: observation.result_version,
    relationship_revision_ids: observation.relationship_revision_ids,
    relationship_effect_digests: observation.relationship_effect_digests,
    relationship_total: observation.relationship_revision_ids.length,
  });
  const component = {
    component_occurrence_id: observation.owner_occurrence_id,
    component_revision_id: observation.owner_revision_id,
    component_slot_key: observation.value_slot_key,
    governed_ordinal: observation.ordinal,
    component_state: observation.state,
    claim_occurrence_id: observation.claim_occurrence_id,
    claim_revision_id: observation.claim_revision_id,
    claim_scope_closure_id: observation.claim_scope_closure_id,
    composition_scope_closure_id: observation.composition_scope_closure_id,
    result_input_lineage_digest: observation.result_input_lineage_digest,
    relationship_revision_ids: clone(observation.relationship_revision_ids),
    relationship_total: observation.relationship_revision_ids.length,
    relationship_set_digest: relationshipSetDigest,
    bounded_relationship_effects: observation.relationship_effects.map((relationship) => ({
      relationship_revision_id: relationship.relationship_revision_id,
      relationship_definition_key: relationship.relationship_definition_key,
      state: relationship.state,
      effect: clone(relationship.effect),
    })),
    raw_value: clone(observation.raw_value),
    canonical_value: clone(observation.canonical_value),
    unit: observation.unit,
    day_basis: observation.day_basis,
    denominator: clone(observation.denominator),
    derivation_version: observation.derivation_version,
  };
  const derivedResultRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: derivedResultOccurrenceId,
    component_revision_ids: [component.component_revision_id],
    relationship_set_digests: [relationshipSetDigest],
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE',
  });
  const rowServingKey = contentId('RESULT_SERVING_ROW/V1', {
    corpus_release_id: observation.corpus_release_id,
    derived_result_occurrence_id: derivedResultOccurrenceId,
  });
  const counts = clone(cohort_result.counts);
  const canonicalResult = {
    result_key: observation.result_key,
    result_version: observation.result_version,
    concept_key: observation.concept_key,
    concept_version: 1,
    party: clone(observation.party),
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE',
    governed_reason_codes: [],
    derived_result_occurrence_id: derivedResultOccurrenceId,
    derived_result_revision_id: derivedResultRevisionId,
    result_ordinal,
    components: [component],
    refinable_dimensions: {
      sector: observation.sector,
      buyer: observation.buyer,
      merger_form: observation.merger_form,
      adviser_firms: clone(observation.adviser_firms),
      lawyers: clone(observation.lawyers),
      announce_year: observation.announce_year,
      deal_value_usd: observation.deal_value_usd,
    },
    market_context: {
      metric_definition_id: observation.metric_definition_id,
      metric_key: observation.metric_key,
      metric_version: observation.metric_version,
      subject_observation: {
        market_observation_serving_key: observation.market_observation_serving_key,
        metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
        metric_slot_key: observation.metric_slot_key,
        canonical_value: clone(observation.canonical_value),
        canonical_unit: observation.canonical_unit,
        basis_key: observation.basis_key,
        unit: observation.unit,
        day_basis: observation.day_basis,
        denominator: clone(observation.denominator),
        derivation_version: observation.derivation_version,
      },
      cohort: {
        cohort_digest: cohort_result.cohort_digest,
        counts,
        distribution: clone(cohort_result.distribution),
        exclusions: clone(cohort_result.exclusions),
      },
      denominators: {
        prevalence: {
          kind: 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS',
          deal_count: counts.examined_deals,
        },
        distribution: {
          kind: 'COMPARABLE_PRESENT_DEALS',
          deal_count: counts.distribution_deals,
        },
      },
    },
    source_detail_state: {
      state: 'UNAVAILABLE',
      reason_code: 'EXACT_DETAIL_PROJECTION_NOT_BUILT',
    },
  };
  const body = {
    schema_version: 'SHARED_SERVING_ROW/V1',
    row_kind: 'CANONICAL_RESULT',
    corpus_release_id: observation.corpus_release_id,
    frozen_pair_id,
    governed_deal_key: observation.deal_key,
    deal_admission_id: observation.deal_admission_id,
    row_serving_key: rowServingKey,
    serving_contract: servingContract(contract_bundle.fingerprint),
    provenance: {
      contract_fingerprint: contract_bundle.fingerprint,
      metric_observation_occurrence_id: observation.metric_observation_occurrence_id,
      market_observation_serving_key: observation.market_observation_serving_key,
      metric_slot_key: observation.metric_slot_key,
      owner_occurrence_id: observation.owner_occurrence_id,
      owner_revision_id: observation.owner_revision_id,
    },
    source_actions: [],
    canonical_result: canonicalResult,
  };
  const row = {
    ...body,
    canonical_payload_digest: contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body),
  };
  validateSharedServingRow(row);
  return Object.freeze(row);
}

function validateCanonicalResultBody(body, row) {
  requireExactKeys(body, CANONICAL_RESULT_KEYS, 'canonical_result');
  if (body.result_completeness !== 'COMPLETE' || body.market_comparability !== 'COMPARABLE') {
    throw new TypeError('canonical result is not complete and comparable');
  }
  if (!Array.isArray(body.governed_reason_codes) || body.governed_reason_codes.length !== 0) {
    throw new TypeError('complete canonical result cannot carry governed reason codes');
  }
  if (!Array.isArray(body.components) || body.components.length !== 1) throw new TypeError('fixture canonical result requires one bounded component');
  const component = body.components[0];
  requireExactKeys(component, COMPONENT_KEYS, 'canonical_result.components[0]');
  for (const [key, value] of Object.entries(component)) {
    if (key.endsWith('_id') && value !== null) requireDigest(value, `component.${key}`);
  }
  if (component.component_state !== 'PRESENT') throw new TypeError('serving component must be PRESENT');
  if (typeof component.raw_value !== 'string' || !component.raw_value.trim() || Buffer.byteLength(component.raw_value, 'utf8') > 4096) {
    throw new TypeError('fixture component raw_value must be a bounded source string');
  }
  if (!Array.isArray(component.relationship_revision_ids)
    || component.relationship_revision_ids.length !== component.relationship_total
    || !Array.isArray(component.bounded_relationship_effects)
    || component.bounded_relationship_effects.length !== component.relationship_total) {
    throw new TypeError('component relationship projection is incomplete');
  }
  component.relationship_revision_ids.forEach((value, index) => requireDigest(value, `component.relationship_revision_ids[${index}]`));
  const relationshipEffectDigests = component.bounded_relationship_effects.map((relationship, index) => {
    requireExactKeys(relationship, BOUNDED_RELATIONSHIP_EFFECT_KEYS, `component.bounded_relationship_effects[${index}]`);
    requireDigest(relationship.relationship_revision_id, `component.bounded_relationship_effects[${index}].relationship_revision_id`);
    requireText(relationship.relationship_definition_key, `component.bounded_relationship_effects[${index}].relationship_definition_key`);
    if (relationship.state !== 'PRESENT' || relationship.effect == null) {
      throw new TypeError('a complete canonical result may contain only PRESENT bounded relationship effects');
    }
    const isBringDown = relationship.relationship_definition_key === 'BRINGS_DOWN';
    const isNoShopException = relationship.relationship_definition_key === 'EXCEPTED_BY';
    const isCapexException = isNoShopException
      && relationship.effect.legal_operation === 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE';
    const effectKeys = relationship.effect.legal_operation === 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'
      ? ['effect_mode', 'legal_operation', 'accuracy_standard', 'exception', 'time_points']
      : isBringDown
        ? ['effect_mode', 'legal_operation', 'accuracy_standard']
        : isCapexException
          ? ['effect_mode', 'legal_operation', 'restriction_period', 'obligors', 'exceptions', 'consent_standard']
        : ['effect_mode', 'legal_operation', 'permitted_action', 'prerequisites'];
    requireExactKeys(relationship.effect, effectKeys, `component.bounded_relationship_effects[${index}].effect`);
    const validBringDown = isBringDown
      && ['TEST_ACCURACY_AT_CLOSING', 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'].includes(
        relationship.effect.legal_operation,
      );
    const validNoShopException = isNoShopException
      && ['PERMITS_LIMITED_INFORMATION_SHARING', 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS', 'PERMITS_CONFIDENTIALITY_AGREEMENT'].includes(
        relationship.effect.legal_operation,
      )
      && typeof relationship.effect.permitted_action === 'string'
      && relationship.effect.permitted_action.length > 0
      && Array.isArray(relationship.effect.prerequisites)
      && relationship.effect.prerequisites.length > 0;
    const validCapexException = isCapexException
      && relationship.effect.restriction_period === 'PRE_CLOSING_PERIOD'
      && canonicalJson(relationship.effect.obligors) === canonicalJson(['COMPANY', 'COMPANY_SUBSIDIARIES'])
      && canonicalJson(relationship.effect.exceptions) === canonicalJson([
        'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
        'PARENT_WRITTEN_CONSENT',
        'COMPANY_DISCLOSURE_SCHEDULE',
      ])
      && relationship.effect.consent_standard === 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED';
    if (relationship.effect.effect_mode !== 'TYPED_LEGAL_EFFECT'
      || (!validBringDown && !validNoShopException && !validCapexException)) {
      throw new TypeError('fixture relationship effect is outside the frozen serving contract');
    }
    if (relationship.effect.legal_operation === 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING'
      && (relationship.effect.exception !== 'DE_MINIMIS_INACCURACIES'
        || canonicalJson(relationship.effect.time_points) !== canonicalJson([
          'SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE',
        ]))) {
      throw new TypeError('fixture signing-and-closing relationship effect is incomplete');
    }
    return contentId('RELATIONSHIP_EFFECT/V1', relationship.effect);
  }).sort();
  const boundedRelationshipRevisionIds = component.bounded_relationship_effects
    .map((relationship) => relationship.relationship_revision_id)
    .sort();
  if (canonicalJson(boundedRelationshipRevisionIds) !== canonicalJson([...component.relationship_revision_ids].sort())) {
    throw new TypeError('bounded relationship effects do not match the component relationship set');
  }
  const expectedRelationshipSetDigest = contentId('RESULT_RELATIONSHIP_SET/V1', {
    schema_version: 'RESULT_RELATIONSHIP_SET/V1',
    result_key: body.result_key,
    result_version: body.result_version,
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
    relationship_total: component.relationship_total,
  });
  if (component.relationship_set_digest !== expectedRelationshipSetDigest) {
    throw new TypeError('component relationship set identity mismatch');
  }
  validateSourceActions(row, body);
  requireExactKeys(body.market_context, [
    'metric_definition_id', 'metric_key', 'metric_version', 'subject_observation', 'cohort', 'denominators',
  ], 'canonical_result.market_context');
  requireExactKeys(body.market_context.subject_observation, [
    'market_observation_serving_key',
    'metric_observation_occurrence_id',
    'metric_slot_key',
    'canonical_value',
    'canonical_unit',
    'basis_key',
    'unit',
    'day_basis',
    'denominator',
    'derivation_version',
  ], 'canonical_result.market_context.subject_observation');
  requireExactKeys(body.market_context.cohort, ['cohort_digest', 'counts', 'distribution', 'exclusions'], 'canonical_result.market_context.cohort');
  requireDigest(body.market_context.metric_definition_id, 'canonical_result.market_context.metric_definition_id');
  requireText(body.market_context.metric_key, 'canonical_result.market_context.metric_key');
  requireNonNegativeInteger(body.market_context.metric_version, 'canonical_result.market_context.metric_version');
  requireDigest(body.market_context.cohort.cohort_digest, 'canonical_result.market_context.cohort.cohort_digest');
  requireExactKeys(body.market_context.cohort.counts, COHORT_COUNT_KEYS, 'canonical_result.market_context.cohort.counts');
  COHORT_COUNT_KEYS.forEach((key) => requireNonNegativeInteger(
    body.market_context.cohort.counts[key],
    `canonical_result.market_context.cohort.counts.${key}`,
  ));
  const counts = body.market_context.cohort.counts;
  if (counts.eligible_deals < counts.applicable_deals
    || counts.applicable_deals < counts.examined_deals
    || counts.examined_deals < counts.present_deals
    || counts.present_deals < counts.comparable_deals
    || counts.comparable_deals < counts.distribution_deals
    || counts.eligible_deals < counts.excluded_deals
    || counts.observation_slots < counts.comparable_deals
    || counts.excluded_slots < counts.excluded_deals) {
    throw new TypeError('canonical result cohort counts violate governed denominator ordering');
  }
  if (!Array.isArray(body.market_context.cohort.distribution) || !Array.isArray(body.market_context.cohort.exclusions)) {
    throw new TypeError('canonical_result market cohort requires bounded distribution and exclusion arrays');
  }
  body.market_context.cohort.distribution.forEach((item, index) => {
    requireExactKeys(item, ['canonical_value', 'subject_count', 'deal_count'], `canonical_result.market_context.cohort.distribution[${index}]`);
    requireNonNegativeInteger(item.subject_count, `canonical_result.market_context.cohort.distribution[${index}].subject_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.distribution[${index}].deal_count`);
    if (item.deal_count > counts.distribution_deals || item.subject_count < item.deal_count
      || item.subject_count > counts.observation_slots) {
      throw new TypeError('canonical result distribution count exceeds its governed denominator');
    }
  });
  body.market_context.cohort.exclusions.forEach((item, index) => {
    requireExactKeys(item, ['reason_code', 'slot_count', 'deal_count'], `canonical_result.market_context.cohort.exclusions[${index}]`);
    requireText(item.reason_code, `canonical_result.market_context.cohort.exclusions[${index}].reason_code`);
    requireNonNegativeInteger(item.slot_count, `canonical_result.market_context.cohort.exclusions[${index}].slot_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.exclusions[${index}].deal_count`);
    if (item.deal_count > counts.excluded_deals || item.slot_count < item.deal_count
      || item.slot_count > counts.excluded_slots) {
      throw new TypeError('canonical result exclusion count exceeds its governed denominator');
    }
  });
  requireExactKeys(body.market_context.denominators, ['prevalence', 'distribution'], 'canonical_result.market_context.denominators');
  requireExactKeys(body.market_context.denominators.prevalence, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.prevalence');
  requireExactKeys(body.market_context.denominators.distribution, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.distribution');
  const subject = body.market_context.subject_observation;
  for (const key of ['market_observation_serving_key', 'metric_observation_occurrence_id', 'metric_slot_key']) {
    requireDigest(subject[key], `canonical_result.market_context.subject_observation.${key}`);
  }
  requireText(subject.basis_key, 'canonical_result.market_context.subject_observation.basis_key');
  const metric = METRIC_DEFINITIONS[body.market_context.metric_key];
  const isMoneyMetric = metric?.value_dimension === 'MONEY_RELATIVE_TO_DEAL_VALUE';
  if (isMoneyMetric) {
    requireExactKeys(component.denominator, ['value', 'currency', 'basis', 'source_lineage_ids'], 'component.denominator');
    requireText(component.denominator.value, 'component.denominator.value');
    if (!Array.isArray(component.denominator.source_lineage_ids)
      || component.denominator.source_lineage_ids.length === 0) {
      throw new TypeError('money component denominator requires exact source lineage');
    }
    component.denominator.source_lineage_ids.forEach((id, index) => requireDigest(
      id,
      `component.denominator.source_lineage_ids[${index}]`,
    ));
    if (component.unit !== metric.canonical_unit
      || component.denominator.basis !== metric.denominator_basis
      || component.denominator.currency !== metric.currency
      || canonicalJson(component.denominator) !== canonicalJson(subject.denominator)) {
      throw new TypeError('money component denominator does not match its governed metric');
    }
  } else if (component.denominator !== null || subject.denominator !== null) {
    throw new TypeError('non-money fixture metric cannot carry a deal-value denominator');
  }
  if (!metric
    || body.concept_key !== metric.concept_key
    || body.market_context.metric_version !== metric.metric_version
    || body.market_context.metric_definition_id !== metricDefinitionId(metric)
    || subject.canonical_unit !== metric.canonical_unit
    || subject.basis_key !== (metric.basis_key || metric.canonical_unit)
    || !metricAllowsCanonicalValue(metric, component.canonical_value)
    || component.canonical_value !== subject.canonical_value
    || component.unit !== subject.unit
    || component.day_basis !== subject.day_basis
    || component.derivation_version !== subject.derivation_version
    || component.bounded_relationship_effects.some((effect) => (
      metric.required_relationship_key
        ? effect.relationship_definition_key !== metric.required_relationship_key
          || (effect.relationship_definition_key === 'BRINGS_DOWN'
            && effect.effect.accuracy_standard !== component.canonical_value)
        : !['EXCEPTED_BY'].includes(effect.relationship_definition_key)
    ))) {
    throw new TypeError('canonical result metric fields do not match the frozen metric contract');
  }
  const expectedComponentOccurrenceId = contentId('RESULT_COMPONENT_OCCURRENCE/V1', {
    schema_version: 'RESULT_COMPONENT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (component.component_occurrence_id !== expectedComponentOccurrenceId) {
    throw new TypeError('result component occurrence identity mismatch');
  }
  const expectedInputLineageDigest = contentId('RESULT_INPUT_LINEAGE/V1', {
    schema_version: 'RESULT_INPUT_LINEAGE/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
  });
  if (component.result_input_lineage_digest !== expectedInputLineageDigest) {
    throw new TypeError('result component input lineage identity mismatch');
  }
  const expectedComponentRevisionId = contentId('RESULT_COMPONENT_REVISION/V1', {
    schema_version: 'RESULT_COMPONENT_REVISION/V1',
    component_occurrence_id: expectedComponentOccurrenceId,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
    claim_revision_ids: [component.claim_revision_id],
    relationship_revision_ids: [...component.relationship_revision_ids].sort(),
    relationship_effect_digests: relationshipEffectDigests,
    composition_scope_closure_id: component.composition_scope_closure_id,
    input_lineage_digest: expectedInputLineageDigest,
    completeness: body.result_completeness,
    comparability: body.market_comparability,
  });
  if (component.component_revision_id !== expectedComponentRevisionId) {
    throw new TypeError('result component revision identity mismatch');
  }
  const expectedMetricSlotKey = contentId('MARKET_METRIC_SLOT/V1', {
    schema_version: 'MARKET_METRIC_SLOT/V1',
    metric_definition_id: metricDefinitionId(metric),
    deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: body.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    party: body.party,
    result_key: body.result_key,
    result_version: body.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: expectedComponentOccurrenceId,
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: expectedComponentOccurrenceId,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (subject.metric_slot_key !== expectedMetricSlotKey) throw new TypeError('market metric slot identity mismatch');
  const expectedMetricOccurrenceId = contentId('METRIC_OBSERVATION_OCCURRENCE/V1', {
    schema_version: 'METRIC_OBSERVATION_OCCURRENCE/V1',
    deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
    concept_key: body.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    party: body.party,
    result_key: body.result_key,
    result_version: body.result_version,
    owner_type: 'RESULT_COMPONENT_OCCURRENCE',
    owner_occurrence_id: expectedComponentOccurrenceId,
    scope_type: 'RESULT_COMPONENT_OCCURRENCE',
    scope_id: expectedComponentOccurrenceId,
    value_slot_key: component.component_slot_key,
    ordinal: component.governed_ordinal,
  });
  if (subject.metric_observation_occurrence_id !== expectedMetricOccurrenceId
    || subject.market_observation_serving_key !== contentId('MARKET_OBSERVATION/V1', {
      corpus_release_id: row.corpus_release_id,
      metric_observation_occurrence_id: expectedMetricOccurrenceId,
    })) {
    throw new TypeError('market observation serving identity mismatch');
  }
  if (subject.market_observation_serving_key !== row.provenance.market_observation_serving_key
    || subject.metric_observation_occurrence_id !== row.provenance.metric_observation_occurrence_id
    || subject.metric_slot_key !== row.provenance.metric_slot_key
    || component.component_occurrence_id !== row.provenance.owner_occurrence_id
    || component.component_revision_id !== row.provenance.owner_revision_id) {
    throw new TypeError('canonical result lineage does not match row provenance');
  }
  if (body.market_context.denominators.prevalence.kind !== 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS'
    || body.market_context.denominators.prevalence.deal_count !== body.market_context.cohort.counts.examined_deals
    || body.market_context.denominators.distribution.kind !== 'COMPARABLE_PRESENT_DEALS'
    || body.market_context.denominators.distribution.deal_count !== body.market_context.cohort.counts.distribution_deals) {
    throw new TypeError('canonical result denominators do not match the governed cohort counts');
  }
  const expectedOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: row.deal_admission_id,
    result_key: body.result_key,
    result_version: body.result_version,
    concept_key: body.concept_key,
    party: body.party,
    result_ordinal: body.result_ordinal,
  });
  if (body.derived_result_occurrence_id !== expectedOccurrenceId) throw new TypeError('derived result occurrence identity mismatch');
  const expectedRevisionId = contentId('DERIVED_RESULT_REVISION/V1', {
    schema_version: 'DERIVED_RESULT_REVISION/V1',
    derived_result_occurrence_id: expectedOccurrenceId,
    component_revision_ids: body.components.map((item) => item.component_revision_id),
    relationship_set_digests: body.components.map((item) => item.relationship_set_digest),
    result_completeness: body.result_completeness,
    market_comparability: body.market_comparability,
  });
  if (body.derived_result_revision_id !== expectedRevisionId) throw new TypeError('derived result revision identity mismatch');
  const dimensions = validateDimensions(body.refinable_dimensions);
  if (canonicalJson(dimensions) !== canonicalJson(body.refinable_dimensions)) {
    throw new TypeError('refinable dimensions are not canonical');
  }
}

function validateSharedServingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('SharedServingRow must be an object');
  const variant = SHARED_ROW_VARIANTS[row.row_kind];
  if (!variant) throw new TypeError('unknown SharedServingRow variant');
  requireExactKeys(row, [...COMMON_KEYS, variant.body_key], 'SharedServingRow');
  for (const forbiddenKey of variant.forbidden_body_keys) {
    if (Object.hasOwn(row, forbiddenKey)) throw new TypeError(`${forbiddenKey} is forbidden for ${row.row_kind}`);
  }
  if (variant.producer_status !== 'IMPLEMENTED_FIXTURE') {
    throw new TypeError(`${row.row_kind} has no certified fixture producer`);
  }
  if (row.schema_version !== 'SHARED_SERVING_ROW/V1') throw new TypeError('invalid SharedServingRow schema version');
  for (const key of ['corpus_release_id', 'frozen_pair_id', 'deal_admission_id', 'row_serving_key']) requireDigest(row[key], key);
  requireText(row.governed_deal_key, 'governed_deal_key');
  requireExactKeys(row.serving_contract, [
    'access_registry_digest', 'offline_denylist_digest', 'embedded_reference_allowlist_digest',
  ], 'serving_contract');
  Object.entries(row.serving_contract).forEach(([key, value]) => requireDigest(value, `serving_contract.${key}`));
  requireExactKeys(row.provenance, [
    'contract_fingerprint',
    'metric_observation_occurrence_id',
    'market_observation_serving_key',
    'metric_slot_key',
    'owner_occurrence_id',
    'owner_revision_id',
  ], 'provenance');
  Object.entries(row.provenance).forEach(([key, value]) => requireDigest(value, `provenance.${key}`));
  if (row.provenance.contract_fingerprint !== FIXTURE_CONTRACT.fingerprint) {
    throw new TypeError('fixture SharedServingRow uses an unrecognised contract fingerprint');
  }
  if (canonicalJson(row.serving_contract) !== canonicalJson(servingContract(row.provenance.contract_fingerprint))) {
    throw new TypeError('serving contract does not match the frozen contract fingerprint');
  }
  validateCanonicalResultBody(row.canonical_result, row);
  const expectedRowKey = contentId('RESULT_SERVING_ROW/V1', {
    corpus_release_id: row.corpus_release_id,
    derived_result_occurrence_id: row.canonical_result.derived_result_occurrence_id,
  });
  if (row.row_serving_key !== expectedRowKey) throw new TypeError('result row serving identity mismatch');
  const { canonical_payload_digest, ...body } = row;
  if (canonical_payload_digest !== contentId('SHARED_SERVING_ROW_PAYLOAD/V1', body)) {
    throw new TypeError('SharedServingRow payload digest mismatch');
  }
  assertNoForbiddenPayload(row);
  return true;
}

function prepareSharedRowsForRendering(rows, prepareRow = (row) => row) {
  const seen = new Set();
  return (rows || []).map((row, index) => {
    try {
      validateSharedServingRow(row);
      if (seen.has(row.row_serving_key)) throw new TypeError('duplicate shared serving row key');
      seen.add(row.row_serving_key);
      return { render_kind: 'ROW', key: row.row_serving_key, row, prepared: prepareRow(row) };
    } catch {
      const suppliedKey = row && SHA256_RE.test(row.row_serving_key || '') ? row.row_serving_key : null;
      return {
        render_kind: 'ROW_RENDER_FAILED',
        key: suppliedKey || contentId('ROW_RENDER_FAILED/V1', { index }),
        reason_code: 'INVALID_SHARED_SERVING_ROW',
      };
    }
  });
}

module.exports = {
  BOUNDED_RELATIONSHIP_EFFECT_KEYS,
  CANONICAL_RESULT_KEYS,
  COHORT_COUNT_KEYS,
  COMMON_KEYS,
  COMPONENT_KEYS,
  SOURCE_ACTION_KEYS,
  SHARED_ROW_VARIANTS,
  buildCanonicalResultServingRow,
  prepareSharedRowsForRendering,
  validateSharedServingRow,
};
