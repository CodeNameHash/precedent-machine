const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  compileMarketCohortRequest,
  validateMarketCohortResult,
} = require('./market-cohort-query');
const { validateProjectedMetricSlotOutput } = require('./serving-projection');

const SHA256_RE = /^[a-f0-9]{64}$/;

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
  'observation_slots',
  'excluded_slots',
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
      source_actions: 'NONE_UNTIL_EXACT_DETAIL_PROJECTION',
    }),
  };
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
    return contentId('RELATIONSHIP_EFFECT/V1', relationship.effect);
  }).sort();
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
  requireExactKeys(body.source_detail_state, ['state', 'reason_code'], 'canonical_result.source_detail_state');
  if (row.source_actions.length !== 0) {
    throw new TypeError('fixture canonical rows cannot publish source actions before the exact-detail projection exists');
  }
  if (body.source_detail_state.state !== 'UNAVAILABLE'
      || body.source_detail_state.reason_code !== 'EXACT_DETAIL_PROJECTION_NOT_BUILT') {
    throw new TypeError('a row without source actions requires its exact no-detail reason');
  }
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
  if (!Array.isArray(body.market_context.cohort.distribution) || !Array.isArray(body.market_context.cohort.exclusions)) {
    throw new TypeError('canonical_result market cohort requires bounded distribution and exclusion arrays');
  }
  body.market_context.cohort.distribution.forEach((item, index) => {
    requireExactKeys(item, ['canonical_value', 'subject_count', 'deal_count'], `canonical_result.market_context.cohort.distribution[${index}]`);
    requireNonNegativeInteger(item.subject_count, `canonical_result.market_context.cohort.distribution[${index}].subject_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.distribution[${index}].deal_count`);
  });
  body.market_context.cohort.exclusions.forEach((item, index) => {
    requireExactKeys(item, ['reason_code', 'slot_count', 'deal_count'], `canonical_result.market_context.cohort.exclusions[${index}]`);
    requireText(item.reason_code, `canonical_result.market_context.cohort.exclusions[${index}].reason_code`);
    requireNonNegativeInteger(item.slot_count, `canonical_result.market_context.cohort.exclusions[${index}].slot_count`);
    requireNonNegativeInteger(item.deal_count, `canonical_result.market_context.cohort.exclusions[${index}].deal_count`);
  });
  requireExactKeys(body.market_context.denominators, ['prevalence', 'distribution'], 'canonical_result.market_context.denominators');
  requireExactKeys(body.market_context.denominators.prevalence, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.prevalence');
  requireExactKeys(body.market_context.denominators.distribution, ['kind', 'deal_count'], 'canonical_result.market_context.denominators.distribution');
  const subject = body.market_context.subject_observation;
  for (const key of ['market_observation_serving_key', 'metric_observation_occurrence_id', 'metric_slot_key']) {
    requireDigest(subject[key], `canonical_result.market_context.subject_observation.${key}`);
  }
  requireText(subject.basis_key, 'canonical_result.market_context.subject_observation.basis_key');
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
  if (canonicalJson(row.serving_contract) !== canonicalJson(servingContract(row.provenance.contract_fingerprint))) {
    throw new TypeError('serving contract does not match the frozen contract fingerprint');
  }
  if (!Array.isArray(row.source_actions)) throw new TypeError('source_actions must be an array');
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

function prepareSharedRowsForRendering(rows) {
  return (rows || []).map((row, index) => {
    try {
      validateSharedServingRow(row);
      return { render_kind: 'ROW', key: row.row_serving_key, row };
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
  SHARED_ROW_VARIANTS,
  buildCanonicalResultServingRow,
  prepareSharedRowsForRendering,
  validateSharedServingRow,
};
