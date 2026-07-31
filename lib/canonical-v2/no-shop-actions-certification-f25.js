const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_ACTION_ROLLUP_SCHEMA_V1,
  NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1,
  compileFixtureContractV12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  ACTION_SPECS,
  validateQxoAdmittedNoShopActionsF6Slice,
} = require('./reviewed-qxo-admitted-no-shop-actions-f6-slice');
const {
  EFFECT_SPECS,
  PREREQUISITE_SPECS,
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-exception-source-binding-f6');
const {
  F24_BUNDLE_DIGEST,
  F24_BUNDLE_ID,
  F24_MANIFEST_DIGEST,
  F24_MANIFEST_ID,
  F24_REGISTRY_ID,
  validateF24EnvelopeIdentity,
} = require('./no-shop-timing-certification-f24');

const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_SCOPE =
  'OFFLINE_QXO_NO_SHOP_ACTIONS_CERTIFICATION_F25_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID =
  'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const EXCEPTION_SOURCE_BINDING_ID =
  '09b22c5185dd7e0b9a37f839e27873c5c6b1e4ce1cf283876d5c5c39ddc384dc';
const EXCEPTION_SOURCE_BINDING_DIGEST =
  '58b8d689e05f35d3f8bb42e46812724f3eac375cbfc0d24ae8afead657dbe0e2';
const F25_BUNDLE_ID =
  'c7f4efcd09370f305b78e6b9112fa19d584e74bd0dca0101a9404a606f7d8156';
const F25_BUNDLE_DIGEST =
  '66c8aaf4869f8721f6f448572ab1ef86c57f955d86877e089c0c644e4310544a';
const F25_MANIFEST_ID =
  '4a42cb4c4a41d3098783e5d40abb8943f7521b974c92f67a95ce149c93e7e824';
const F25_MANIFEST_DIGEST =
  '0732b878b4a81d1fef15601f5c67daf7fdc71a4ef7b54907f0932201ed6fdec1';
const F25_REGISTRY_ID =
  '97ee2a8abc984af2f01cf4bbdbe5425215db21331a1aba604d564034743e8748';
const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const BUYER_PARTY = Object.freeze({
  role: 'RIGHT_HOLDER',
  value: 'PARENT',
  capacity: 'ACQUIRER',
});
const FILTER_KEYS = Object.freeze([
  'sector',
  'buyer',
  'merger_form',
  'adviser_either',
  'lawyer_either',
  'year_from',
  'year_to',
  'min_value_usd',
  'max_value_usd',
]);
const DEFAULT_FILTERS = Object.freeze(
  Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
);
const RENDERABLE_NON_VALUE_STATES = Object.freeze([
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'UNRESOLVED',
  'NON_COMPARABLE',
  'FEATURE_DISABLED',
  'FAILED',
]);
const MAX_EXECUTION_RESULT_BYTES = 1024 * 1024;
const INPUT_KEYS = Object.freeze([
  'f24_timing_certification_bundle',
  'contract_bundle_v6',
  'admitted_source_context_v6',
  'reviewed_no_shop_actions_f6_slice',
  'qxo_no_shop_exception_source_binding_f6',
]);
const METRIC_SPECS = Object.freeze([
  Object.freeze({
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    metric_version: 2,
    concept_key: 'NOSOL-PROHIBIT',
    required_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    required_relationship_key: null,
    canonical_unit: 'PROHIBITED_ACTION_CODE_V2',
    value_dimension: 'CATEGORICAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    source_family: 'ACTION',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER',
    metric_version: 1,
    concept_key: 'NOSOL-PROHIBIT',
    required_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    required_relationship_key: null,
    canonical_unit: 'ACTION_KNOWLEDGE_QUALIFIER',
    value_dimension: 'CATEGORICAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    source_family: 'KNOWLEDGE',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
    metric_version: 1,
    concept_key: 'NOSOL-EXCEPT',
    required_claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
    required_relationship_key: null,
    canonical_unit: 'EXCEPTION_PREREQUISITE_CODE_V2',
    value_dimension: 'CATEGORICAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    source_family: 'PREREQUISITE',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_EXCEPTION_EFFECT',
    metric_version: 1,
    concept_key: 'NOSOL-EXCEPT',
    required_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    required_relationship_key: 'EXCEPTED_BY',
    canonical_unit: 'EXCEPTION_EFFECT_CODE',
    value_dimension: 'CATEGORICAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    source_family: 'EFFECT',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_INLINE_PERMISSION_EFFECT',
    metric_version: 1,
    concept_key: 'NOSOL-EXCEPT',
    required_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    required_relationship_key: 'EXCEPTED_BY',
    canonical_unit: 'INLINE_PERMISSION_EFFECT_CODE',
    value_dimension: 'CATEGORICAL',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    source_family: 'INLINE_PERMISSION',
  }),
]);
const CONTINUE_EFFECT_SPECS = Object.freeze([
  Object.freeze({
    action_occurrence_key: 'B_CONTINUE_DISCUSSIONS',
    affected_action_code: 'CONTINUE_DISCUSSIONS',
    legal_operation: 'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
    direct_effect_key: 'B_PARTICIPATE_DISCUSSIONS_EXCEPTION',
  }),
  Object.freeze({
    action_occurrence_key: 'B_CONTINUE_NEGOTIATIONS',
    affected_action_code: 'CONTINUE_NEGOTIATIONS',
    legal_operation: 'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
    direct_effect_key: 'B_PARTICIPATE_NEGOTIATIONS_EXCEPTION',
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function exactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function sortedUnique(values, label) {
  if (!Array.isArray(values)
    || values.length < 1
    || values.length > 256
    || values.some((value) => !SHA256_RE.test(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    throw new TypeError(`${label} must be a bounded sorted unique set`);
  }
  return values;
}

function sourceContextIdentityMatches(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return false;
  }
  const {
    admitted_semantic_source_context_id: contextId,
    ...body
  } = source;
  return SHA256_RE.test(contextId || '')
    && contextId === contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      body,
    );
}

function canonicalTextIdentityMatches(source) {
  const text = source?.canonical_text?.text;
  if (typeof text !== 'string') return false;
  const bytes = Buffer.from(text, 'utf8');
  return source.canonical_text?.canonical_text_id
      === source.canonical_text_id
    && source.canonical_text_byte_length === bytes.length
    && source.canonical_text_sha256 === sha256Hex(bytes)
    && source.canonical_text_id === contentId(
      'SEC_CANONICAL_TEXT/V2',
      {
        source_response_content_id: source.source_content_id,
        converter_digest: source.converter_digest,
        converter_config_digest: source.converter_config_digest,
        canonical_text_sha256: source.canonical_text_sha256,
        canonical_text_byte_length:
          source.canonical_text_byte_length,
        source_map_digest: source.source_map_digest,
      },
    );
}

function validateContractCompatibility(contractV6) {
  validateContractBundle(contractV6);
  if (contractV6.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    throw new TypeError('F25 requires the exact frozen F6 source contract');
  }
  const contractV12 = compileFixtureContractV12();
  const claimFor = (contract, key) => contract.claim_definitions.find(
    (entry) => entry.claim_definition_key === key,
  );
  const schemaFor = (contract, key) => (
    contract.no_shop_semantic_schema_definitions.find(
      (entry) => entry.semantic_schema_key === key,
    )
  );
  for (const key of [
    'NO_SHOP_PROHIBITED_ACTION',
    'NO_SHOP_EXCEPTION_PREREQUISITE',
  ]) {
    if (canonicalJson(claimFor(contractV6, key))
        !== canonicalJson(claimFor(contractV12, key))) {
      throw new TypeError(`F25 source and release contracts disagree on ${key}`);
    }
  }
  for (const key of [
    'NO_SHOP_ACTION_OCCURRENCE',
    'NO_SHOP_ACTION_COMPARISON_ROLLUP',
    'NO_SHOP_EXCEPTION_EFFECT',
    'NO_SHOP_INLINE_PERMISSION_EFFECT',
  ]) {
    if (canonicalJson(schemaFor(contractV6, key))
        !== canonicalJson(schemaFor(contractV12, key))) {
      throw new TypeError(`F25 source and release contracts disagree on ${key}`);
    }
  }
}

function exactSourceEvidence(source, edge) {
  const start = edge.absolute_start;
  const end = edge.absolute_end;
  if (!Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > source.canonical_text_byte_length) {
    throw new TypeError('F25 action evidence is outside the canonical text');
  }
  const bytes = Buffer.from(source.canonical_text.text, 'utf8')
    .subarray(start, end);
  return {
    excerpt_id: edge.excerpt_id,
    evidence_role: edge.evidence_role,
    document_ordinal: edge.document_ordinal,
    absolute_start: start,
    absolute_end: end,
    exact_bytes_digest: sha256Hex(bytes),
    exact_text: bytes.toString('utf8'),
  };
}

function metricDefinition(spec) {
  const allowed = {
    ACTION: NO_SHOP_ACTION_CODES_V2,
    KNOWLEDGE: ['NONE', 'KNOWINGLY'],
    PREREQUISITE: NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
    EFFECT: NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1
      .allowed_legal_operations.map(
        (entry) => entry.legal_operation,
      ),
    INLINE_PERMISSION: [
      NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1.legal_operation,
    ],
  }[spec.source_family];
  const grouping = {
    ACTION: {
      dimensions: [],
      codebooks: {},
    },
    KNOWLEDGE: {
      dimensions: ['action_code'],
      codebooks: {
        action_code: NO_SHOP_ACTION_CODES_V2,
      },
    },
    PREREQUISITE: {
      dimensions: ['prerequisite_class'],
      codebooks: {
        prerequisite_class: ['SHARED', 'ACTION_SPECIFIC'],
      },
    },
    EFFECT: {
      dimensions: ['affected_action_code', 'derivation_mode'],
      codebooks: {
        affected_action_code: NO_SHOP_ACTION_CODES_V2,
        derivation_mode: [
          'DIRECT_SOURCE_TEXT',
          'INFERRED_BY_PARTICIPATION_SUBSUMPTION',
        ],
      },
    },
    INLINE_PERMISSION: {
      dimensions: [],
      codebooks: {},
    },
  }[spec.source_family];
  const body = {
    schema_version: 'F25_CATEGORICAL_METRIC_DEFINITION/V1',
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    source_contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V6,
    concept_key: spec.concept_key,
    required_claim_definition_key:
      spec.required_claim_definition_key,
    required_relationship_key: spec.required_relationship_key,
    value_dimension: spec.value_dimension,
    canonical_unit: spec.canonical_unit,
    allowed_canonical_values: clone(allowed),
    grouping_dimensions: clone(grouping.dimensions),
    grouping_dimension_codebooks: clone(grouping.codebooks),
    per_deal_rollup: spec.per_deal_rollup,
    weighting: 'DEAL',
  };
  return freeze({
    ...body,
    metric_definition_id: contentId(
      'F25_CATEGORICAL_METRIC_DEFINITION/V1',
      body,
    ),
  });
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    throw new TypeError('F25 inputs are outside the closed contract');
  }
  const {
    f24_timing_certification_bundle: f24,
    contract_bundle_v6: contractV6,
    admitted_source_context_v6: source,
    reviewed_no_shop_actions_f6_slice: actionSlice,
    qxo_no_shop_exception_source_binding_f6: exception,
  } = input;
  validateF24EnvelopeIdentity(f24);
  validateContractCompatibility(contractV6);
  if (!sourceContextIdentityMatches(source)
    || !canonicalTextIdentityMatches(source)
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.source_ordinal !== 0) {
    throw new TypeError('F25 source identity has drifted');
  }
  validateQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle: contractV6,
    slice: actionSlice,
  });
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity(exception);
  if (exception.qxo_no_shop_exception_source_binding_f6_id
      !== EXCEPTION_SOURCE_BINDING_ID
    || exception.canonical_payload_digest
      !== EXCEPTION_SOURCE_BINDING_DIGEST
    || exception.contract_binding.contract_fingerprint
      !== contractV6.fingerprint
    || exception.source_binding.document_hash !== source.document_hash
    || exception.source_binding.canonical_text_id
      !== source.canonical_text_id
    || exception.source_binding.immutable_source_document_id
      !== source.immutable_source_document_id
    || exception.source_binding.source_admission_manifest_id
      !== source.source_admission_manifest_id
    || exception.source_binding.semantic_extraction_input_envelope_id
      !== source.semantic_extraction_input_envelope_id
    || exception.source_binding.admitted_semantic_source_context_id
      !== source.admitted_semantic_source_context_id
    || exception.status.prerequisite_source_bindings_complete !== true
    || exception.status.governed_effect_source_bindings_complete !== true
    || exception.status.inline_permission_source_binding_complete !== true
    || actionSlice.action_occurrences.length !== 24
    || new Set(
      actionSlice.action_occurrences.map((entry) => entry.action_code),
    ).size !== 23) {
    throw new TypeError('F25 requires the exact F6 action and exception sources');
  }
  const f24AdmissionIds =
    f24.manifest.metric_serving_admission_ids;
  sortedUnique(f24AdmissionIds, 'F24 admission IDs');
  if (f24.no_shop_timing_certification_bundle_f24_id !== F24_BUNDLE_ID
    || f24.canonical_payload_digest !== F24_BUNDLE_DIGEST
    || f24.manifest.no_shop_timing_certification_manifest_f24_id
      !== F24_MANIFEST_ID
    || f24.manifest.canonical_payload_digest !== F24_MANIFEST_DIGEST
    || f24.registry.metric_serving_admission_registry_id
      !== F24_REGISTRY_ID
    || f24.registry.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || f24AdmissionIds.length !== 4) {
    throw new TypeError('F25 requires the exact F24 predecessor');
  }
  return {
    f24,
    contractV6,
    source,
    actionSlice,
    exception,
  };
}

function actionItems(validated) {
  const byCode = new Map();
  for (const occurrence of validated.actionSlice.action_occurrences) {
    const evidence = occurrence.claim.evidence.map(
      (edge) => exactSourceEvidence(validated.source, edge),
    );
    const item = {
      occurrence_key: occurrence.occurrence_key,
      action_occurrence_id: occurrence.action_occurrence_id,
      action_occurrence_revision_id:
        occurrence.action_occurrence_revision_id,
      claim_revision_id: occurrence.claim.claim_revision_id,
      action_code: occurrence.action_code,
      party: clone(occurrence.party),
      source_limb_code: occurrence.source_limb_code,
      governed_ordinal: occurrence.governed_ordinal,
      knowledge_qualifier_code:
        occurrence.knowledge_qualifier_code,
      method_of_action_occurrence_ids:
        clone(occurrence.method_of_action_occurrence_ids),
      raw_value: clone(occurrence.claim.raw_value),
      evidence,
    };
    const existing = byCode.get(occurrence.action_code) || [];
    existing.push(item);
    byCode.set(occurrence.action_code, existing);
  }
  const categories = [...byCode.entries()].map(
    ([actionCode, occurrences]) => {
      const ordered = occurrences.sort(
        (left, right) => left.governed_ordinal - right.governed_ordinal,
      );
      const body = {
        schema_version: 'F25_PROHIBITED_ACTION_CATEGORY/V1',
        canonical_value: actionCode,
        state: 'PRESENT',
        party: TARGET_PARTY,
        deal_weight: 1,
        occurrence_count: ordered.length,
        occurrences: ordered,
        evidence_root: contentId(
          'F25_PROHIBITED_ACTION_CATEGORY_EVIDENCE/V1',
          ordered.flatMap((entry) => entry.evidence),
        ),
      };
      return {
        ...body,
        item_id: contentId(
          'F25_PROHIBITED_ACTION_CATEGORY/V1',
          body,
        ),
      };
    },
  ).sort((left, right) => (
    left.canonical_value.localeCompare(right.canonical_value)
  ));
  if (categories.length !== NO_SHOP_ACTION_CODES_V2.length
    || canonicalJson(categories.map((entry) => entry.canonical_value))
      !== canonicalJson([...NO_SHOP_ACTION_CODES_V2].sort())
    || categories.reduce(
      (sum, entry) => sum + entry.occurrence_count,
      0,
    ) !== ACTION_SPECS.length) {
    throw new TypeError('F25 action categories lost source occurrences');
  }
  return categories;
}

function knowledgeItems(actionCategories) {
  return actionCategories.map((category) => {
    const qualifiers = [...new Set(category.occurrences.map(
      (entry) => entry.knowledge_qualifier_code,
    ))].sort();
    if (qualifiers.length !== 1) {
      throw new TypeError('one action category has conflicting knowledge qualifiers');
    }
    const body = {
      schema_version: 'F25_ACTION_KNOWLEDGE_QUALIFIER/V1',
      canonical_value: qualifiers[0],
      action_code: category.canonical_value,
      state: 'PRESENT',
      party: TARGET_PARTY,
      deal_weight: 1,
      source_action_item_id: category.item_id,
      source_occurrence_ids: category.occurrences.map(
        (entry) => entry.action_occurrence_id,
      ),
      source_action_evidence: category.occurrences.flatMap(
        (entry) => clone(entry.evidence),
      ),
      evidence_root: category.evidence_root,
    };
    return {
      ...body,
      item_id: contentId(
        'F25_ACTION_KNOWLEDGE_QUALIFIER/V1',
        body,
      ),
    };
  });
}

function sourceEvidenceByExcerpt(exception) {
  return new Map(exception.source_evidence.map((entry) => [
    entry.source_excerpt.excerpt_id,
    {
      excerpt_id: entry.source_excerpt.excerpt_id,
      source_key: entry.source_key,
      absolute_start: entry.source_excerpt.absolute_start,
      absolute_end: entry.source_excerpt.absolute_end,
      exact_bytes_digest:
        entry.source_excerpt.exact_bytes_digest,
      exact_text: entry.source_excerpt.exact_text,
    },
  ]));
}

function resolvedEvidence(ids, evidenceByExcerpt, label) {
  const evidence = ids.map((id) => evidenceByExcerpt.get(id));
  if (evidence.some((entry) => !entry)) {
    throw new TypeError(`${label} evidence does not close over F6 source`);
  }
  return evidence;
}

function prerequisiteItems(
  validated,
  evidenceByExcerpt,
  effectItems,
) {
  const effectByPrerequisite = new Map();
  for (const effect of effectItems) {
    for (const sourceBindingId of [
      ...effect.shared_prerequisite_source_binding_ids,
      ...effect.action_specific_prerequisite_source_binding_ids,
    ]) {
      const keys = effectByPrerequisite.get(sourceBindingId) || [];
      keys.push(effect.effect_key);
      effectByPrerequisite.set(sourceBindingId, keys);
    }
  }
  const items = validated.exception.prerequisite_outcomes.map(
    (outcome) => {
      if (outcome.suppressed || !outcome.source_binding) {
        throw new TypeError('F25 cannot certify a suppressed prerequisite');
      }
      const binding = outcome.source_binding;
      const bindingId =
        binding.qxo_no_shop_exception_prerequisite_source_binding_f6_id;
      const evidence = resolvedEvidence(
        binding.evidence_excerpt_ids,
        evidenceByExcerpt,
        outcome.prerequisite_code,
      );
      const body = {
        schema_version: 'F25_EXCEPTION_PREREQUISITE/V1',
        canonical_value: outcome.prerequisite_code,
        prerequisite_class: outcome.prerequisite_class,
        state: 'PRESENT',
        obligated_party: clone(binding.obligated_party),
        protected_party: clone(binding.protected_party),
        source_binding_id: bindingId,
        applies_to_effect_keys: [
          ...new Set(effectByPrerequisite.get(bindingId) || []),
        ].sort(),
        definition_use_binding_ids:
          clone(binding.definition_use_binding_ids),
        definition_dependency_edge_ids:
          clone(binding.definition_dependency_edge_ids),
        evidence,
      };
      return {
        ...body,
        item_id: contentId(
          'F25_EXCEPTION_PREREQUISITE/V1',
          body,
        ),
      };
    },
  ).sort((left, right) => (
    left.canonical_value.localeCompare(right.canonical_value)
  ));
  if (canonicalJson(items.map((entry) => entry.canonical_value))
      !== canonicalJson(
        [...NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2].sort(),
      )) {
    throw new TypeError('F25 prerequisite category set is incomplete');
  }
  return items;
}

function directEffectItems(validated, evidenceByExcerpt) {
  return validated.exception.exception_effect_outcomes.map(
    (outcome) => {
      if (outcome.suppressed || !outcome.source_binding) {
        throw new TypeError('F25 cannot certify a suppressed exception effect');
      }
      const binding = outcome.source_binding;
      const evidence = resolvedEvidence(
        binding.evidence_excerpt_ids,
        evidenceByExcerpt,
        outcome.effect_key,
      );
      const body = {
        schema_version: 'F25_EXCEPTION_EFFECT/V1',
        canonical_value: binding.legal_operation,
        effect_key: binding.effect_key,
        affected_action_code: binding.affected_action_code,
        affected_action_endpoints:
          clone(binding.affected_action_endpoints),
        state: 'PRESENT',
        obligated_party: clone(binding.obligated_party),
        protected_party: clone(binding.protected_party),
        temporal_start: binding.temporal_start,
        temporal_end: binding.temporal_end,
        precedence_code: binding.precedence_code,
        derivation_mode: 'DIRECT_SOURCE_TEXT',
        source_wording: evidence.map(
          (entry) => entry.exact_text,
        ),
        direct_source_effect_key: binding.effect_key,
        shared_prerequisite_source_binding_ids:
          clone(binding.shared_prerequisite_source_binding_ids),
        action_specific_prerequisite_source_binding_ids:
          clone(binding.action_specific_prerequisite_source_binding_ids),
        definition_use_binding_ids:
          clone(binding.definition_use_binding_ids),
        definition_dependency_edge_ids:
          clone(binding.definition_dependency_edge_ids),
        governing_notice_dependency:
          binding.governing_notice_dependency,
        governing_notice_obligation_revision_id: null,
        relationship_materialisation_state:
          'SOURCE_EFFECT_COMPARISON_ONLY_NOTICE_DEPENDENCY_UNMATERIALISED',
        schema_conformance_state:
          'F6_SCHEMA_CONFORMING_DIRECT_EFFECT',
        evidence,
        lawyer_warning: {
          required: false,
          code: null,
          text: null,
        },
      };
      return {
        ...body,
        item_id: contentId('F25_EXCEPTION_EFFECT/V1', body),
      };
    },
  );
}

function inferredContinueEffectItems(
  validated,
  evidenceByExcerpt,
  directItems,
) {
  const unresolvedByAction = new Map(
    validated.exception.unresolved_effects.map(
      (entry) => [entry.affected_action_code, entry],
    ),
  );
  const directByKey = new Map(
    directItems.map((entry) => [entry.effect_key, entry]),
  );
  return CONTINUE_EFFECT_SPECS.map((spec) => {
    const unresolved = unresolvedByAction.get(
      spec.affected_action_code,
    );
    const direct = directByKey.get(spec.direct_effect_key);
    if (!unresolved
      || unresolved.state !== 'UNMAPPED_FROZEN_EFFECT_OPERATION'
      || !direct) {
      throw new TypeError('F25 continue-effect derivation lacks its exact inputs');
    }
    const actionOccurrence =
      validated.actionSlice.action_occurrences.find(
        (entry) => entry.occurrence_key
          === spec.action_occurrence_key,
      );
    if (!actionOccurrence
      || actionOccurrence.action_occurrence_id
        !== unresolved.action_occurrence_id
      || actionOccurrence.action_occurrence_revision_id
        !== unresolved.action_occurrence_revision_id) {
      throw new TypeError('F25 continue-effect action endpoint has drifted');
    }
    const evidence = [
      ...actionOccurrence.claim.evidence.map(
        (edge) => exactSourceEvidence(validated.source, edge),
      ),
      ...resolvedEvidence([
        unresolved.examined_permission_cluster_excerpt_id,
      ], evidenceByExcerpt, spec.affected_action_code),
    ];
    const body = {
      schema_version: 'F25_EXCEPTION_EFFECT/V1',
      canonical_value: spec.legal_operation,
      effect_key:
        `${spec.action_occurrence_key}_DERIVED_EXCEPTION`,
      affected_action_code: spec.affected_action_code,
      affected_action_endpoints: [{
        occurrence_key: spec.action_occurrence_key,
        action_occurrence_id: unresolved.action_occurrence_id,
        action_occurrence_revision_id:
          unresolved.action_occurrence_revision_id,
      }],
      state: 'PRESENT',
      obligated_party: TARGET_PARTY,
      protected_party: BUYER_PARTY,
      temporal_start: direct.temporal_start,
      temporal_end: direct.temporal_end,
      precedence_code: direct.precedence_code,
      derivation_mode:
        'INFERRED_BY_PARTICIPATION_SUBSUMPTION',
      source_wording:
        'engage in or otherwise participate in discussions or negotiations',
      direct_source_effect_key: direct.effect_key,
      shared_prerequisite_source_binding_ids:
        clone(direct.shared_prerequisite_source_binding_ids),
      action_specific_prerequisite_source_binding_ids:
        clone(direct.action_specific_prerequisite_source_binding_ids),
      definition_use_binding_ids:
        clone(direct.definition_use_binding_ids),
      definition_dependency_edge_ids:
        clone(direct.definition_dependency_edge_ids),
      governing_notice_dependency:
        direct.governing_notice_dependency,
      governing_notice_obligation_revision_id: null,
      relationship_materialisation_state:
        'DERIVED_EFFECT_COMPARISON_ONLY_NOTICE_DEPENDENCY_UNMATERIALISED',
      schema_conformance_state:
        'F25_DERIVED_COMPARISON_NOT_F6_RELATIONSHIP_PAIR',
      evidence,
      lawyer_warning: {
        required: true,
        code:
          'CONTINUE_EFFECT_DERIVED_FROM_PARTICIPATION_LANGUAGE',
        text:
          'The exception does not repeat “continue”. Coverage is inferred from permission to engage in or otherwise participate in the discussions or negotiations.',
      },
    };
    return {
      ...body,
      item_id: contentId('F25_EXCEPTION_EFFECT/V1', body),
    };
  });
}

function inlinePermissionItems(validated, evidenceByExcerpt) {
  const binding =
    validated.exception.inline_permission_source_binding;
  if (!binding.source_binding_complete
    || binding.legal_operation
      !== NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1.legal_operation
    || binding.permitted_action_code
      !== NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1.permitted_action_code) {
    throw new TypeError('F25 inline permission source binding is incomplete');
  }
  const body = {
    schema_version: 'F25_INLINE_PERMISSION_EFFECT/V1',
    canonical_value: binding.legal_operation,
    permitted_action_code: binding.permitted_action_code,
    state: 'PRESENT',
    permitted_actor_party: clone(binding.permitted_actor_party),
    information_subject_code: binding.information_subject_code,
    temporal_scope_inheritance:
      binding.temporal_scope_inheritance,
    qualified_action_outcomes:
      clone(binding.qualified_action_outcomes),
    prerequisite_codes: [],
    evidence: resolvedEvidence(
      binding.evidence_excerpt_ids,
      evidenceByExcerpt,
      'inline permission',
    ),
    lawyer_warning: {
      required: false,
      code: null,
      text: null,
    },
  };
  return [{
    ...body,
    item_id: contentId(
      'F25_INLINE_PERMISSION_EFFECT/V1',
      body,
    ),
  }];
}

function buildMetricInputs(validated) {
  const actions = actionItems(validated);
  const evidenceByExcerpt =
    sourceEvidenceByExcerpt(validated.exception);
  const directEffects = directEffectItems(
    validated,
    evidenceByExcerpt,
  );
  const effects = [
    ...directEffects,
    ...inferredContinueEffectItems(
      validated,
      evidenceByExcerpt,
      directEffects,
    ),
  ].sort((left, right) => (
    left.canonical_value.localeCompare(right.canonical_value)
  ));
  const itemsByFamily = {
    ACTION: actions,
    KNOWLEDGE: knowledgeItems(actions),
    PREREQUISITE: prerequisiteItems(
      validated,
      evidenceByExcerpt,
      effects,
    ),
    EFFECT: effects,
    INLINE_PERMISSION: inlinePermissionItems(
      validated,
      evidenceByExcerpt,
    ),
  };
  return METRIC_SPECS.map((spec) => ({
    spec,
    definition: metricDefinition(spec),
    items: itemsByFamily[spec.source_family],
  }));
}

function interpretationPolicy(metricInput) {
  const { spec, definition } = metricInput;
  const body = {
    schema_version: 'F25_CATEGORICAL_INTERPRETATION_POLICY/V1',
    metric_key: spec.metric_key,
    deal_weighting: definition.grouping_dimensions.length > 0
      ? 'ONE_DEAL_PER_DISTINCT_CANONICAL_VALUE_AND_GOVERNED_GROUPING_TUPLE'
      : 'ONE_DEAL_PER_DISTINCT_CANONICAL_VALUE',
    governed_grouping_dimensions:
      clone(definition.grouping_dimensions),
    duplicate_occurrence_treatment:
      'PRESERVE_EVIDENCE_DO_NOT_DOUBLE_WEIGHT_DEAL',
    source_directness_required:
      spec.source_family === 'EFFECT'
        ? 'DIRECT_OR_EXPLICITLY_FLAGGED_DERIVATION'
        : 'DIRECT',
    accepted_derivation_modes:
      spec.source_family === 'EFFECT'
        ? [
          'DIRECT_SOURCE_TEXT',
          'INFERRED_BY_PARTICIPATION_SUBSUMPTION',
        ]
        : [],
    inferred_effect_warning_required:
      spec.source_family === 'EFFECT',
    unresolved_member_policy:
      'EXCLUDE_AFFECTED_MEMBER_ONLY_WITH_EXPLICIT_REASON',
    generic_no_market_data_authority: 'NONE',
  };
  return {
    ...body,
    interpretation_policy_digest: contentId(
      'F25_CATEGORICAL_INTERPRETATION_POLICY/V1',
      body,
    ),
  };
}

function buildAdmission(metricInput, validated) {
  const { spec, definition, items } = metricInput;
  const policy = interpretationPolicy(metricInput);
  const itemRoot = contentId(
    'F25_CATEGORICAL_ITEM_ROOT/V1',
    items.map((entry) => entry.item_id),
  );
  const definitionAdmission = {
    schema_version:
      'F25_CATEGORICAL_METRIC_DEFINITION_ADMISSION/V1',
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    metric_definition_id: definition.metric_definition_id,
    concept_key: spec.concept_key,
    required_claim_definition_key:
      spec.required_claim_definition_key,
    required_relationship_key:
      spec.required_relationship_key,
  };
  const definitionAdmissionId = contentId(
    'F25_CATEGORICAL_METRIC_DEFINITION_ADMISSION/V1',
    definitionAdmission,
  );
  const integrationAdmissionId = contentId(
    'F25_CATEGORICAL_INTEGRATION_ADMISSION/V1',
    {
      metric_definition_id: definition.metric_definition_id,
      interpretation_policy_digest:
        policy.interpretation_policy_digest,
      item_root: itemRoot,
      action_reviewed_mapping_id:
        validated.actionSlice.reviewed_mapping.reviewed_mapping_id,
      exception_source_binding_id:
        EXCEPTION_SOURCE_BINDING_ID,
      predecessor_manifest_id: F24_MANIFEST_ID,
    },
  );
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_CATEGORICAL_IDENTITY_NOT_RELEASED',
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    metric_definition_id: definition.metric_definition_id,
    concept_key: spec.concept_key,
    required_claim_definition_key:
      spec.required_claim_definition_key,
    interpretation_admission_digest:
      policy.interpretation_policy_digest,
    candidate_metric_definition_admission_id:
      definitionAdmissionId,
    integration_admission_id: integrationAdmissionId,
    certification_evidence: {
      document_hash: DOCUMENT_HASH,
      canonical_text_id: CANONICAL_TEXT_ID,
      action_reviewed_mapping_id:
        validated.actionSlice.reviewed_mapping.reviewed_mapping_id,
      exception_source_binding_id:
        EXCEPTION_SOURCE_BINDING_ID,
      item_root: itemRoot,
    },
    authority: {
      metric_serving_policy_authority:
        'EXACT_METRIC_IDENTITY_ONLY',
      candidate_release_authority: 'NONE',
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'F25_CATEGORICAL_CERTIFICATION_NOT_ASSEMBLED_IN_RELEASE',
        'F26_CENTRAL_ADMISSION_VALIDATOR_INTEGRATION_REQUIRED',
        'F26_CROSS_VIEW_RELEASE_ASSEMBLY_REQUIRED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    metric_serving_admission_id: contentId(
      'METRIC_SERVING_ADMISSION/V1',
      body,
    ),
  });
}

function buildRegistry(metricInputs, validated) {
  const newAdmissions = metricInputs.map(
    (entry) => buildAdmission(entry, validated),
  );
  const records = [
    ...clone(validated.f24.registry.admission_records),
    ...newAdmissions,
  ].sort((left, right) => (
    left.metric_key.localeCompare(right.metric_key)
      || left.metric_version - right.metric_version
  ));
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_REGISTRY/V3',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_registry_id: F24_REGISTRY_ID,
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    later_contract_default: 'DENY',
    admission_records: records,
    wildcard_admission_authority: 'NONE',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return freeze({
    ...body,
    metric_serving_admission_registry_id: contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V3',
      body,
    ),
  });
}

function metricCarrier(metricInput, admission, validated) {
  const { spec, definition, items } = metricInput;
  const policy = interpretationPolicy(metricInput);
  const itemIds = items.map((entry) => entry.item_id);
  const observationBody = {
    schema_version: 'F25_CATEGORICAL_OBSERVATION/V1',
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    predecessor_release_manifest_id: F24_MANIFEST_ID,
    governed_deal_key:
      validated.exception.source_binding.governed_deal_key,
    document_hash: DOCUMENT_HASH,
    canonical_text_id: CANONICAL_TEXT_ID,
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    metric_definition_id: definition.metric_definition_id,
    concept_key: spec.concept_key,
    party: spec.source_family === 'ACTION'
      || spec.source_family === 'KNOWLEDGE'
      ? TARGET_PARTY
      : {
        obligated_party: TARGET_PARTY,
        protected_party: BUYER_PARTY,
      },
    canonical_unit: spec.canonical_unit,
    state: 'PRESENT',
    comparability_state:
      'COMPARABLE_WITH_DIRECTNESS_AND_WARNING_DIMENSIONS',
    item_count: items.length,
    items: clone(items),
    item_root: contentId(
      'F25_CATEGORICAL_ITEM_ROOT/V1',
      itemIds,
    ),
    retained_residuals: {
      action_residuals:
        clone(validated.actionSlice.retained_residuals),
      action_residual_root: contentId(
        'F25_ACTION_RETAINED_RESIDUAL_ROOT/V1',
        validated.actionSlice.retained_residuals,
      ),
      exception_residuals:
        clone(validated.exception.retained_source_residuals),
      exception_residual_root: contentId(
        'F25_EXCEPTION_RETAINED_RESIDUAL_ROOT/V1',
        validated.exception.retained_source_residuals,
      ),
      treatment:
        'RETAINED_AND_BLOCK_DEPENDENT_UNCERTIFIED_ITEMS_ONLY',
    },
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
  };
  const observation = {
    ...observationBody,
    canonical_payload_digest: contentId(
      'F25_CATEGORICAL_OBSERVATION_PAYLOAD/V1',
      observationBody,
    ),
  };
  const distribution = items.map((item) => ({
    canonical_value:
      typeof item.canonical_value === 'string'
        ? item.canonical_value
        : canonicalJson(item.canonical_value),
    action_code: item.action_code || null,
    affected_action_code:
      item.affected_action_code || null,
    prerequisite_class:
      item.prerequisite_class || null,
    derivation_mode: item.derivation_mode || null,
    deal_count: 1,
    subject_count: 1,
    deal_weight: 1,
  }));
  const cohortResult = {
    schema_version: 'MARKET_COHORT_RESULT/V5',
    authority_scope: AUTHORITY_SCOPE,
    execution_state: 'OFFLINE_FIXTURE_ONLY',
    predecessor_release_manifest_id: F24_MANIFEST_ID,
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    concept_key: spec.concept_key,
    subject_deal_key:
      validated.exception.source_binding.governed_deal_key,
    party: clone(observation.party),
    document_hash: DOCUMENT_HASH,
    canonical_text_id: CANONICAL_TEXT_ID,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    counts: {
      eligible_deals: 1,
      applicable_deals: 1,
      examined_deals: 1,
      present_deals: 1,
      comparable_deals: 1,
      excluded_deals: 0,
      observation_slots: items.length,
      excluded_slots: 0,
    },
    distribution,
    exclusions: [],
  };
  const queryBody = {
    schema_version: 'QUERY_PROJECTION_RECORD/V6',
    authority_scope: AUTHORITY_SCOPE,
    activation_eligibility:
      'INELIGIBLE_F25_CERTIFICATION_ONLY',
    predecessor_release_manifest_id: F24_MANIFEST_ID,
    governed_deal_key:
      validated.exception.source_binding.governed_deal_key,
    metric_key: spec.metric_key,
    metric_version: spec.metric_version,
    concept_key: spec.concept_key,
    canonical_unit: spec.canonical_unit,
    party: clone(observation.party),
    document_hash: DOCUMENT_HASH,
    canonical_text_id: CANONICAL_TEXT_ID,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    item_count: items.length,
    subrows: items.map((item) => ({
      item_id: item.item_id,
      canonical_value: item.canonical_value,
      action_code: item.action_code || null,
      affected_action_code:
        item.affected_action_code || null,
      prerequisite_class: item.prerequisite_class || null,
      derivation_mode: item.derivation_mode || null,
      lawyer_warning: item.lawyer_warning || null,
      source_action_item_id:
        item.source_action_item_id || null,
    })),
    interpretation_policy_digest:
      policy.interpretation_policy_digest,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    source_action_state: 'AVAILABLE',
  };
  const queryProjection = {
    ...queryBody,
    canonical_payload_digest: contentId(
      'QUERY_PROJECTION_RECORD_PAYLOAD/V6',
      queryBody,
    ),
  };
  const carrierBody = {
    schema_version:
      'NO_SHOP_CATEGORICAL_METRIC_CERTIFICATION_F25/V1',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_release_manifest_id: F24_MANIFEST_ID,
    metric_definition: clone(definition),
    metric_serving_admission: clone(admission),
    interpretation_policy: policy,
    observation,
    cohort_result: cohortResult,
    query_projection: queryProjection,
    authority: {
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      source_certified: true,
      category_identity_certified: true,
      deal_weighting_certified: true,
      local_failure_isolation_required: true,
      publication_blocked: true,
      release_eligible: false,
    },
  };
  return freeze({
    ...carrierBody,
    categorical_metric_certification_id: contentId(
      'NO_SHOP_CATEGORICAL_METRIC_CERTIFICATION_F25/V1',
      carrierBody,
    ),
    canonical_payload_digest: contentId(
      'NO_SHOP_CATEGORICAL_METRIC_CERTIFICATION_F25_PAYLOAD/V1',
      carrierBody,
    ),
  });
}

function finaliseCombinedMarketRequest(
  requestBase,
  executionState,
) {
  const cohortDigest = contentId(
    'MARKET_COHORT/V5',
    requestBase,
  );
  return freeze({
    ...requestBase,
    cohort_digest: cohortDigest,
    cache_key: contentId('MARKET_COHORT_CACHE/V5', {
      certification_manifest_id:
        requestBase.certification_manifest_id,
      predecessor_release_manifest_id:
        requestBase.predecessor_release_manifest_id,
      cohort_digest: cohortDigest,
      metric_serving_admission_ids:
        requestBase.metric_bindings.map(
          (entry) => entry.metric_serving_admission_id,
        ).sort(),
      filters: requestBase.filters,
    }),
    execution_state: executionState,
  });
}

function requestMetricBindings(carriers) {
  return carriers.map((carrier) => {
    const dimensions =
      carrier.metric_definition.grouping_dimensions;
    const governedGroupingTuples =
      carrier.observation.items.map((item) => (
        Object.fromEntries([
          ['canonical_value', item.canonical_value],
          ...dimensions.map(
            (dimension) => [dimension, item[dimension]],
          ),
        ])
      ));
    const tupleByBytes = new Map(
      governedGroupingTuples.map(
        (tuple) => [canonicalJson(tuple), tuple],
      ),
    );
    const sortedTuples = [...tupleByBytes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, tuple]) => tuple);
    return {
      metric_key: carrier.observation.metric_key,
      metric_version: carrier.observation.metric_version,
      metric_definition_id:
        carrier.observation.metric_definition_id,
      concept_key: carrier.observation.concept_key,
      metric_serving_admission_id:
        carrier.metric_serving_admission
          .metric_serving_admission_id,
      categorical_item_root: carrier.observation.item_root,
      grouping_dimensions: clone(dimensions),
      allowed_canonical_values:
        clone(carrier.metric_definition.allowed_canonical_values),
      grouping_dimension_codebooks:
        clone(carrier.metric_definition.grouping_dimension_codebooks),
      governed_grouping_tuples: sortedTuples,
      party: clone(carrier.observation.party),
      source_binding: {
        governed_deal_key:
          carrier.observation.governed_deal_key,
        document_hash: carrier.observation.document_hash,
        canonical_text_id:
          carrier.observation.canonical_text_id,
        source_contract_fingerprint:
          carrier.observation.source_contract_fingerprint,
      },
    };
  }).sort((left, right) => (
    left.metric_key.localeCompare(right.metric_key)
  ));
}

function combinedMarketRequestContract(
  carriers,
  validated,
) {
  const body = {
    schema_version:
      'F25_COMBINED_MARKET_REQUEST_CONTRACT/V1',
    execution_shape: 'ONE_INDEXED_SET_BASED_SQL',
    database_call_budget: 1,
    immediate_retries: 0,
    serving_authority:
      'NONE_F26_CENTRAL_VALIDATOR_REQUIRED',
    release_authority: 'NONE',
    predecessor_release_manifest_id: F24_MANIFEST_ID,
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    subject_deal_key:
      validated.exception.source_binding.governed_deal_key,
    metric_bindings: requestMetricBindings(carriers),
    filter_keys: clone(FILTER_KEYS),
  };
  return freeze({
    ...body,
    request_contract_digest: contentId(
      'F25_COMBINED_MARKET_REQUEST_CONTRACT/V1',
      body,
    ),
  });
}

function combinedMarketRequest(
  carriers,
  validated,
  manifest,
) {
  const contract = combinedMarketRequestContract(
    carriers,
    validated,
  );
  if (contract.request_contract_digest
      !== manifest.roots.combined_market_request_contract_root) {
    throw new TypeError('F25 request contract does not equal the manifest');
  }
  const requestBase = {
    schema_version: 'MARKET_COHORT_REQUEST/V5',
    authority_scope: AUTHORITY_SCOPE,
    request_contract_digest:
      contract.request_contract_digest,
    execution_shape: contract.execution_shape,
    database_call_budget: contract.database_call_budget,
    immediate_retries: contract.immediate_retries,
    serving_authority: contract.serving_authority,
    release_authority: contract.release_authority,
    certification_manifest_id:
      manifest.no_shop_actions_certification_manifest_f25_id,
    predecessor_release_manifest_id:
      contract.predecessor_release_manifest_id,
    contract_fingerprint: contract.contract_fingerprint,
    source_contract_fingerprint:
      contract.source_contract_fingerprint,
    subject_deal_key: contract.subject_deal_key,
    metric_bindings: clone(contract.metric_bindings),
    filters: clone(DEFAULT_FILTERS),
  };
  return finaliseCombinedMarketRequest(
    requestBase,
    'CERTIFIED_NOT_EXECUTED',
  );
}

function buildServingExecutionBindings(
  carriers,
  request,
  manifest,
) {
  const requestByMetric = new Map(
    request.metric_bindings.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  return freeze(carriers.map((carrier) => {
    const metricKey = carrier.observation.metric_key;
    const requestBinding = requestByMetric.get(metricKey);
    if (!requestBinding
      || requestBinding.metric_serving_admission_id
        !== carrier.metric_serving_admission
          .metric_serving_admission_id
      || canonicalJson(requestBinding.party)
        !== canonicalJson(carrier.observation.party)
      || requestBinding.source_binding.document_hash
        !== carrier.observation.document_hash
      || requestBinding.source_binding.canonical_text_id
        !== carrier.observation.canonical_text_id
      || requestBinding.source_binding.source_contract_fingerprint
        !== carrier.observation.source_contract_fingerprint) {
      throw new TypeError('F25 runtime request lost carrier identity');
    }
    const body = {
      schema_version: 'F25_SERVING_EXECUTION_BINDING/V1',
      certification_manifest_id:
        manifest.no_shop_actions_certification_manifest_f25_id,
      predecessor_release_manifest_id: F24_MANIFEST_ID,
      contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
      source_contract_fingerprint:
        FIXTURE_CONTRACT_FINGERPRINT_V6,
      metric_key: metricKey,
      metric_version: carrier.observation.metric_version,
      metric_definition_id:
        carrier.observation.metric_definition_id,
      concept_key: carrier.observation.concept_key,
      party: clone(carrier.observation.party),
      source_binding: clone(requestBinding.source_binding),
      metric_serving_admission_id:
        requestBinding.metric_serving_admission_id,
      categorical_item_root:
        requestBinding.categorical_item_root,
      governed_grouping_dimensions:
        clone(requestBinding.grouping_dimensions),
      categorical_metric_certification_id:
        carrier.categorical_metric_certification_id,
      observation_payload_digest:
        carrier.observation.canonical_payload_digest,
      cohort_result_digest: contentId(
        'F25_CATEGORICAL_COHORT_RESULT/V1',
        carrier.cohort_result,
      ),
      query_projection_payload_digest:
        carrier.query_projection.canonical_payload_digest,
      combined_cohort_digest: request.cohort_digest,
      release_aware_cache_key: request.cache_key,
      execution_shape: request.execution_shape,
      database_call_budget: request.database_call_budget,
      immediate_retries: request.immediate_retries,
    };
    return {
      ...body,
      serving_execution_binding_id: contentId(
        'F25_SERVING_EXECUTION_BINDING/V1',
        body,
      ),
    };
  }).sort((left, right) => (
    left.metric_key.localeCompare(right.metric_key)
  )));
}

function buildManifest(registry, carriers, validated) {
  const admissionIds = registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  const newAdmissionIds = carriers.map(
    (entry) => entry.metric_serving_admission
      .metric_serving_admission_id,
  ).sort();
  if (new Set(admissionIds).size !== admissionIds.length
    || admissionIds.length !== 9) {
    throw new TypeError('F25 admission sets are not exact');
  }
  const requestContract = combinedMarketRequestContract(
    carriers,
    validated,
  );
  const body = {
    schema_version:
      'NO_SHOP_ACTIONS_CERTIFICATION_MANIFEST_F25/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_STAGING_ROLLBACK_ONLY_NOT_ACTIVATABLE',
    activation_eligibility:
      'INELIGIBLE_CROSS_VIEW_RELEASE_NOT_BUILT',
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    source_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V6,
    predecessor_bundle_id: F24_BUNDLE_ID,
    predecessor_bundle_payload_digest: F24_BUNDLE_DIGEST,
    predecessor_manifest_id: F24_MANIFEST_ID,
    predecessor_manifest_payload_digest: F24_MANIFEST_DIGEST,
    predecessor_registry_id: F24_REGISTRY_ID,
    metric_serving_admission_registry_id:
      registry.metric_serving_admission_registry_id,
    metric_serving_admission_ids: admissionIds,
    new_metric_serving_admission_ids: newAdmissionIds,
    certified_categorical_metric_keys: carriers.map(
      (entry) => entry.observation.metric_key,
    ).sort(),
    counts: {
      predecessor_admissions:
        validated.f24.manifest.metric_serving_admission_ids.length,
      new_categorical_metrics: carriers.length,
      action_occurrences:
        validated.actionSlice.action_occurrences.length,
      action_categories: carriers.find(
        (entry) => entry.observation.metric_key
          === 'NO_SHOP_PROHIBITED_ACTION',
      ).observation.item_count,
      knowledge_categories: carriers.find(
        (entry) => entry.observation.metric_key
          === 'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER',
      ).observation.item_count,
      exception_prerequisites: carriers.find(
        (entry) => entry.observation.metric_key
          === 'NO_SHOP_EXCEPTION_PREREQUISITE',
      ).observation.item_count,
      exception_effects: carriers.find(
        (entry) => entry.observation.metric_key
          === 'NO_SHOP_EXCEPTION_EFFECT',
      ).observation.item_count,
      inline_permissions: carriers.find(
        (entry) => entry.observation.metric_key
          === 'NO_SHOP_INLINE_PERMISSION_EFFECT',
      ).observation.item_count,
      combined_market_requests: 1,
      query_projections: carriers.length,
    },
    roots: {
      categorical_certification_root: contentId(
        'F25_CATEGORICAL_CERTIFICATION_ROOT/V1',
        carriers.map(
          (entry) => entry.categorical_metric_certification_id,
        ),
      ),
      observation_root: contentId(
        'F25_CATEGORICAL_OBSERVATION_ROOT/V1',
        carriers.map(
          (entry) => entry.observation.canonical_payload_digest,
        ),
      ),
      cohort_result_root: contentId(
        'F25_CATEGORICAL_COHORT_RESULT_ROOT/V1',
        carriers.map(
          (entry) => contentId(
            'F25_CATEGORICAL_COHORT_RESULT/V1',
            entry.cohort_result,
          ),
        ),
      ),
      query_projection_root: contentId(
        'F25_CATEGORICAL_QUERY_PROJECTION_ROOT/V1',
        carriers.map(
          (entry) => entry.query_projection.canonical_payload_digest,
        ),
      ),
      combined_market_request_contract_root:
        requestContract.request_contract_digest,
    },
    serving_plan: {
      database_calls_per_request: 1,
      database_call_growth_with_corpus_size: 'CONSTANT',
      request_shape: 'ONE_INDEXED_SET_BASED_SQL',
      cache_scope:
        'RELEASE_COHORT_FILTERS_SORTED_ADMISSION_SET',
      immediate_retries: 0,
    },
    authority: {
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'F26_CENTRAL_ADMISSION_VALIDATOR_INTEGRATION_REQUIRED',
        'F26_CROSS_VIEW_RELEASE_ASSEMBLY_REQUIRED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    no_shop_actions_certification_manifest_f25_id:
      contentId(
        'NO_SHOP_ACTIONS_CERTIFICATION_MANIFEST_F25/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_MANIFEST_F25_PAYLOAD/V1',
      body,
    ),
  });
}

function buildNoShopActionsCertificationF25(input = {}) {
  const validated = validateInputs(input);
  const metricInputs = buildMetricInputs(validated);
  const registry = buildRegistry(metricInputs, validated);
  const admissionByMetric = new Map(
    registry.admission_records.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const carriers = metricInputs.map((entry) => metricCarrier(
    entry,
    admissionByMetric.get(entry.spec.metric_key),
    validated,
  )).sort((left, right) => (
    left.observation.metric_key.localeCompare(
      right.observation.metric_key,
    )
  ));
  const manifest = buildManifest(
    registry,
    carriers,
    validated,
  );
  const request = combinedMarketRequest(
    carriers,
    validated,
    manifest,
  );
  if (canonicalJson(request.metric_bindings.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort()) !== canonicalJson(
    manifest.new_metric_serving_admission_ids,
  )) {
    throw new TypeError('F25 request admissions do not equal the manifest');
  }
  const executionBindings = buildServingExecutionBindings(
    carriers,
    request,
    manifest,
  );
  const body = {
    schema_version:
      'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25/V1',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_manifest: clone(validated.f24.manifest),
    registry,
    categorical_certifications: carriers,
    combined_market_request: request,
    serving_execution_bindings: executionBindings,
    manifest,
  };
  return freeze({
    ...body,
    no_shop_actions_certification_bundle_f25_id:
      contentId(
        'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25_PAYLOAD/V1',
      body,
    ),
  });
}

function validateNoShopActionsCertificationF25({
  no_shop_actions_certification_f25: candidate,
  ...input
} = {}) {
  const expected = buildNoShopActionsCertificationF25(input);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the F25 actions certification bundle has drifted');
  }
  return true;
}

function validateF25EnvelopeIdentity(bundle) {
  const {
    no_shop_actions_certification_bundle_f25_id: bundleId,
    canonical_payload_digest: bundleDigest,
    ...bundleBody
  } = bundle || {};
  const {
    no_shop_actions_certification_manifest_f25_id: manifestId,
    canonical_payload_digest: manifestDigest,
    ...manifestBody
  } = bundle?.manifest || {};
  const {
    metric_serving_admission_registry_id: registryId,
    ...registryBody
  } = bundle?.registry || {};
  requireDigest(bundleId, 'F25 bundle ID');
  requireDigest(bundleDigest, 'F25 bundle digest');
  requireDigest(manifestId, 'F25 manifest ID');
  requireDigest(manifestDigest, 'F25 manifest digest');
  requireDigest(registryId, 'F25 registry ID');
  if (bundleId !== F25_BUNDLE_ID
    || bundleDigest !== F25_BUNDLE_DIGEST
    || manifestId !== F25_MANIFEST_ID
    || manifestDigest !== F25_MANIFEST_DIGEST
    || registryId !== F25_REGISTRY_ID
    || bundleId !== contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25/V1',
      bundleBody,
    )
    || bundleDigest !== contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25_PAYLOAD/V1',
      bundleBody,
    )
    || manifestId !== contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_MANIFEST_F25/V1',
      manifestBody,
    )
    || manifestDigest !== contentId(
      'NO_SHOP_ACTIONS_CERTIFICATION_MANIFEST_F25_PAYLOAD/V1',
      manifestBody,
    )
    || registryId !== contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V3',
      registryBody,
    )
    || bundle.combined_market_request
      ?.certification_manifest_id !== manifestId
    || bundle.predecessor_manifest
      ?.no_shop_timing_certification_manifest_f24_id
      !== F24_MANIFEST_ID
    || bundle.categorical_certifications?.length !== 5
    || bundle.serving_execution_bindings?.length !== 5
    || bundle.manifest.metric_serving_admission_ids?.length !== 9) {
    throw new TypeError('the exact F25 certification envelope is required');
  }
  return true;
}

function normaliseF25Filters(filters = {}) {
  if (!filters
    || typeof filters !== 'object'
    || Array.isArray(filters)
    || Object.keys(filters).some(
      (key) => !FILTER_KEYS.includes(key),
    )) {
    throw new TypeError('F25 cohort filters are outside the closed contract');
  }
  const merged = {
    ...DEFAULT_FILTERS,
    ...filters,
  };
  for (const key of [
    'sector',
    'buyer',
    'merger_form',
    'adviser_either',
    'lawyer_either',
  ]) {
    const value = merged[key];
    if (value !== null
      && (typeof value !== 'string'
        || value.length < 1
        || value.length > 256)) {
      throw new TypeError(`${key} must be a bounded string or null`);
    }
  }
  for (const key of ['year_from', 'year_to']) {
    const value = merged[key];
    if (value !== null
      && (!Number.isInteger(value)
        || value < 1900
        || value > 2100)) {
      throw new TypeError(`${key} must be a governed year or null`);
    }
  }
  if (merged.year_from !== null
    && merged.year_to !== null
    && merged.year_from > merged.year_to) {
    throw new TypeError('year_from cannot exceed year_to');
  }
  for (const key of ['min_value_usd', 'max_value_usd']) {
    const value = merged[key];
    if (value !== null
      && (typeof value !== 'string'
        || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
        || value.length > 64)) {
      throw new TypeError(`${key} must be a canonical decimal string or null`);
    }
  }
  if (merged.min_value_usd !== null
    && merged.max_value_usd !== null
    && compareCanonicalDecimals(
      merged.min_value_usd,
      merged.max_value_usd,
    ) > 0) {
    throw new TypeError('min_value_usd cannot exceed max_value_usd');
  }
  return freeze(merged);
}

function compareCanonicalDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length > rightInteger.length ? 1 : -1;
  }
  const integerComparison = leftInteger.localeCompare(rightInteger);
  if (integerComparison !== 0) return integerComparison;
  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0')
    .localeCompare(rightFraction.padEnd(width, '0'));
}

function canonicalPercentage(numerator, denominator) {
  if (!Number.isSafeInteger(numerator)
    || numerator < 0
    || !Number.isSafeInteger(denominator)
    || denominator < 0
    || numerator > denominator) {
    throw new TypeError('percentage inputs are outside governed counts');
  }
  if (denominator === 0) return null;
  const scale = 1000000n;
  const scaledNumerator =
    BigInt(numerator) * 100n * scale;
  const denominatorBigInt = BigInt(denominator);
  let rounded = scaledNumerator / denominatorBigInt;
  const remainder = scaledNumerator % denominatorBigInt;
  if (remainder * 2n >= denominatorBigInt) rounded += 1n;
  const integer = rounded / scale;
  const fraction = String(rounded % scale)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction.length > 0
    ? `${integer}.${fraction}`
    : String(integer);
}

function compileF25CombinedMarketRequest({
  bundle,
  filters = {},
} = {}) {
  validateF25EnvelopeIdentity(bundle);
  const {
    cohort_digest: _cohortDigest,
    cache_key: _cacheKey,
    execution_state: _executionState,
    ...requestBase
  } = bundle.combined_market_request;
  requestBase.filters = clone(normaliseF25Filters(filters));
  return finaliseCombinedMarketRequest(
    requestBase,
    'COMPILED_CERTIFICATION_SIMULATION_ONE_INDEXED_SET_BASED_RPC',
  );
}

function validateF25ExecutionResult(result, request) {
  const outerKeys = [
    'schema_version',
    'certification_manifest_id',
    'predecessor_release_manifest_id',
    'cohort_digest',
    'cache_key',
    'metric_serving_admission_ids',
    'metric_results',
    'canonical_payload_digest',
  ];
  if (!exactKeys(result, outerKeys)
    || result.schema_version
      !== 'F25_COMBINED_MARKET_RESULT/V1'
    || result.certification_manifest_id
      !== request.certification_manifest_id
    || result.predecessor_release_manifest_id
      !== request.predecessor_release_manifest_id
    || result.cohort_digest !== request.cohort_digest
    || result.cache_key !== request.cache_key
    || !Array.isArray(result.metric_results)
    || result.metric_results.length
      !== request.metric_bindings.length) {
    throw new TypeError('F25 RPC result identity does not match its request');
  }
  const expectedAdmissionIds = request.metric_bindings.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  sortedUnique(
    result.metric_serving_admission_ids,
    'F25 result admission IDs',
  );
  if (canonicalJson(result.metric_serving_admission_ids)
      !== canonicalJson(expectedAdmissionIds)) {
    throw new TypeError('F25 RPC result admission set has drifted');
  }
  const bindingByMetric = new Map(
    request.metric_bindings.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const resultMetricKeys = [];
  for (const metricResult of result.metric_results) {
    if (!exactKeys(metricResult, [
      'metric_key',
      'metric_serving_admission_id',
      'counts',
      'groups',
    ])) {
      throw new TypeError('F25 metric result is outside its closed contract');
    }
    const binding = bindingByMetric.get(metricResult.metric_key);
    if (!binding
      || binding.metric_serving_admission_id
        !== metricResult.metric_serving_admission_id
      || !exactKeys(metricResult.counts, [
        'eligible_deals',
        'comparable_deals',
        'excluded_deals',
      ])
      || Object.values(metricResult.counts).some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
      || metricResult.counts.comparable_deals
        > Math.floor(Number.MAX_SAFE_INTEGER / 256)
      || metricResult.counts.comparable_deals
        > metricResult.counts.eligible_deals
      || metricResult.counts.excluded_deals
        > metricResult.counts.eligible_deals
      || metricResult.counts.comparable_deals
        + metricResult.counts.excluded_deals
        > metricResult.counts.eligible_deals
      || !Array.isArray(metricResult.groups)
      || metricResult.groups.length > 256) {
      throw new TypeError('F25 metric result identity or bounds have drifted');
    }
    const expectedTupleKeys = [
      'canonical_value',
      ...binding.grouping_dimensions,
    ].sort();
    const allowedGroupingTuples = new Set(
      binding.governed_grouping_tuples.map(canonicalJson),
    );
    const seenGroupingTuples = new Set();
    let priorGroupingTuple = null;
    for (const group of metricResult.groups) {
      const tupleBytes = canonicalJson(group.grouping_tuple);
      if (!exactKeys(group, [
        'grouping_tuple',
        'deal_count',
        'subject_count',
        'percentage',
        'state',
        'reason_code',
      ])
        || !group.grouping_tuple
        || typeof group.grouping_tuple !== 'object'
        || Array.isArray(group.grouping_tuple)
        || canonicalJson(
          Object.keys(group.grouping_tuple).sort(),
        ) !== canonicalJson(expectedTupleKeys)
        || !binding.allowed_canonical_values.includes(
          group.grouping_tuple.canonical_value,
        )
        || binding.grouping_dimensions.some(
          (dimension) => !binding
            .grouping_dimension_codebooks[dimension]
            .includes(group.grouping_tuple[dimension]),
        )
        || !allowedGroupingTuples.has(tupleBytes)
        || seenGroupingTuples.has(tupleBytes)
        || (priorGroupingTuple !== null
          && priorGroupingTuple.localeCompare(tupleBytes) >= 0)
        || !Number.isSafeInteger(group.deal_count)
        || group.deal_count < 0
        || group.deal_count
          > metricResult.counts.comparable_deals
        || !Number.isSafeInteger(group.subject_count)
        || group.subject_count < 0
        || group.subject_count < group.deal_count
        || group.subject_count
          > metricResult.counts.comparable_deals * 256
        || (group.percentage !== null
          && (typeof group.percentage !== 'string'
            || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(
              group.percentage,
            )
            || compareCanonicalDecimals(
              group.percentage,
              '100',
            ) > 0))
        || group.percentage !== canonicalPercentage(
          group.deal_count,
          metricResult.counts.comparable_deals,
        )
        || ![
          'PRESENT',
          'ABSENT',
          'NOT_APPLICABLE',
          'NOT_EXAMINED',
          'UNRESOLVED',
          'NON_COMPARABLE',
          'FEATURE_DISABLED',
          'FAILED',
        ].includes(group.state)
        || ([
          'NOT_APPLICABLE',
          'NOT_EXAMINED',
          'UNRESOLVED',
          'NON_COMPARABLE',
          'FEATURE_DISABLED',
          'FAILED',
        ].includes(group.state)
          ? typeof group.reason_code !== 'string'
            || group.reason_code.length < 1
            || group.reason_code.length > 256
          : group.reason_code !== null)) {
        throw new TypeError('F25 metric result group is invalid');
      }
      seenGroupingTuples.add(tupleBytes);
      priorGroupingTuple = tupleBytes;
    }
    resultMetricKeys.push(metricResult.metric_key);
  }
  if (canonicalJson(resultMetricKeys)
      !== canonicalJson(
        [...bindingByMetric.keys()].sort(),
      )) {
    throw new TypeError('F25 metric result set is not exact and sorted');
  }
  const {
    canonical_payload_digest: payloadDigest,
    ...body
  } = result;
  if (payloadDigest !== contentId(
    'F25_COMBINED_MARKET_RESULT_PAYLOAD/V1',
    body,
  )
    || Buffer.byteLength(canonicalJson(result), 'utf8')
      > MAX_EXECUTION_RESULT_BYTES) {
    throw new TypeError('F25 RPC result payload is invalid or oversized');
  }
  return true;
}

async function executeF25CombinedMarketRequest({
  bundle,
  filters = {},
  cache,
  rpc,
} = {}) {
  if (!cache
    || typeof cache.get !== 'function'
    || typeof cache.set !== 'function'
    || typeof rpc !== 'function') {
    throw new TypeError('F25 execution requires injected cache and RPC functions');
  }
  const request = compileF25CombinedMarketRequest({
    bundle,
    filters,
  });
  const cached = await cache.get(request.cache_key);
  if (cached !== undefined && cached !== null) {
    const cachedSnapshot = freeze(clone(cached));
    validateF25ExecutionResult(cachedSnapshot, request);
    return freeze({
      schema_version: 'F25_COMBINED_MARKET_EXECUTION/V1',
      execution_source: 'CACHE',
      serving_authority: 'NONE_F26_CENTRAL_VALIDATOR_REQUIRED',
      release_authority: 'NONE',
      database_calls: 0,
      immediate_retries: 0,
      request,
      result: cachedSnapshot,
    });
  }
  const resultSnapshot = freeze(clone(await rpc(request)));
  validateF25ExecutionResult(resultSnapshot, request);
  await cache.set(request.cache_key, clone(resultSnapshot));
  return freeze({
    schema_version: 'F25_COMBINED_MARKET_EXECUTION/V1',
    execution_source: 'RPC',
    serving_authority: 'NONE_F26_CENTRAL_VALIDATOR_REQUIRED',
    release_authority: 'NONE',
    database_calls: 1,
    immediate_retries: 0,
    request,
    result: resultSnapshot,
  });
}

function resolveMetricServingAdmissionF25({
  bundle,
  metric_key: metricKey,
  metric_version: metricVersion,
  concept_key: conceptKey,
  required_claim_definition_key: claimDefinitionKey,
  metric_serving_admission_id: admissionId,
  declared_metric_serving_admission_ids: declaredIds,
} = {}) {
  validateF25EnvelopeIdentity(bundle);
  sortedUnique(
    declaredIds,
    'declared metric serving admission IDs',
  );
  if (canonicalJson(declaredIds)
      !== canonicalJson(
        bundle.manifest.metric_serving_admission_ids,
      )) {
    throw new TypeError(
      'declared metric serving admissions must equal the F25 manifest',
    );
  }
  const admission = bundle.registry.admission_records.find(
    (entry) => entry.metric_serving_admission_id === admissionId,
  );
  const carrier = bundle.categorical_certifications.find(
    (entry) => entry.observation.metric_key === metricKey,
  );
  const executionBinding =
    bundle.serving_execution_bindings.find(
      (entry) => entry.metric_key === metricKey,
    );
  if (!admission
    || !carrier
    || !executionBinding
    || !declaredIds.includes(admissionId)
    || admission.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || admission.metric_key !== metricKey
    || admission.metric_version !== metricVersion
    || admission.concept_key !== conceptKey
    || admission.required_claim_definition_key
      !== claimDefinitionKey
    || carrier.metric_definition.metric_definition_id
      !== admission.metric_definition_id
    || carrier.metric_serving_admission
      .metric_serving_admission_id !== admissionId
    || executionBinding.metric_serving_admission_id
      !== admissionId
    || executionBinding.certification_manifest_id
      !== F25_MANIFEST_ID
    || executionBinding.predecessor_release_manifest_id
      !== F24_MANIFEST_ID
    || executionBinding.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || executionBinding.source_contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V6
    || executionBinding.source_binding.document_hash
      !== DOCUMENT_HASH
    || executionBinding.source_binding.canonical_text_id
      !== CANONICAL_TEXT_ID
    || canonicalJson(executionBinding.party)
      !== canonicalJson(carrier.observation.party)
    || executionBinding.combined_cohort_digest
      !== bundle.combined_market_request.cohort_digest
    || executionBinding.release_aware_cache_key
      !== bundle.combined_market_request.cache_key) {
    throw new TypeError('F25 metric admission identity did not resolve');
  }
  return freeze({
    schema_version:
      'METRIC_SERVING_ADMISSION_RESOLUTION/V3',
    admission_lane:
      'OFFLINE_F25_CERTIFICATION_SIMULATION',
    contract_fingerprint:
      admission.contract_fingerprint,
    metric_key: metricKey,
    metric_version: metricVersion,
    metric_definition_id:
      admission.metric_definition_id,
    concept_key: conceptKey,
    required_claim_definition_key: claimDefinitionKey,
    metric_serving_admission_id: admissionId,
    metric_serving_admission_registry_id:
      bundle.registry.metric_serving_admission_registry_id,
    declared_admission_membership: 'PASSED',
    certification_manifest_validation: 'PASSED',
    authoritative_admission_validation:
      'NOT_PERFORMED_F26_CENTRAL_VALIDATOR_REQUIRED',
    serving_authority:
      'NONE_F26_CENTRAL_VALIDATOR_REQUIRED',
    release_authority: 'NONE',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
    serving_execution_binding_id:
      executionBinding.serving_execution_binding_id,
  });
}

function prepareF25ItemsForRendering(records, certifiedBundle) {
  validateF25EnvelopeIdentity(certifiedBundle);
  const certified = new Map();
  for (const carrier of certifiedBundle.categorical_certifications) {
    for (const item of carrier.observation.items) {
      certified.set(
        `${carrier.observation.metric_key}:${item.item_id}`,
        {
          canonical: canonicalJson(item),
          item: clone(item),
        },
      );
    }
  }
  const inputRecords = Array.isArray(records) ? records : [];
  const candidatesByKey = new Map();
  const encounteredKnownKeys = new Set();
  inputRecords.forEach((record, index) => {
    const metricKey = record?.metric_key;
    const item = record?.item;
    const itemId = item?.item_id || record?.item_id;
    const key = `${metricKey}:${itemId}`;
    const isKnown = certified.has(key);
    if (!isKnown) return;
    encounteredKnownKeys.add(key);
    const state = record?.state;
    const isNormalState =
      state === undefined || state === 'PRESENT';
    const isTypedState =
      RENDERABLE_NON_VALUE_STATES.includes(state)
      && typeof record.reason_code === 'string'
      && record.reason_code.length >= 1
      && record.reason_code.length <= 256;
    let priority = null;
    try {
      if (isNormalState
        && item
        && certified.get(key).canonical === canonicalJson(item)) {
        priority = 0;
      } else if (isTypedState) {
        priority = 1;
      }
    } catch {
      priority = null;
    }
    if (priority === null) return;
    const candidates = candidatesByKey.get(key) || [];
    candidates.push({
      index,
      priority,
      typed_semantic: priority === 1
        ? canonicalJson({
          state,
          reason_code: record.reason_code,
        })
        : null,
    });
    candidatesByKey.set(key, candidates);
  });
  const winnerByKey = new Map();
  for (const [key, candidates] of candidatesByKey.entries()) {
    const normal = candidates.filter(
      (candidate) => candidate.priority === 0,
    );
    if (normal.length > 0) {
      winnerByKey.set(
        key,
        normal.sort(
          (left, right) => left.index - right.index,
        )[0].index,
      );
      continue;
    }
    if (new Set(candidates.map(
      (candidate) => candidate.typed_semantic,
    )).size === 1) {
      winnerByKey.set(
        key,
        candidates.sort(
        (left, right) => left.priority - right.priority
          || left.index - right.index,
        )[0].index,
      );
    }
  }
  const fulfilled = new Set();
  const rendered = inputRecords.map((record, index) => {
    const metricKey = record?.metric_key;
    const item = record?.item;
    const itemId = item?.item_id || record?.item_id;
    const key = `${metricKey}:${itemId}`;
    const isKnown = certified.has(key);
    const duplicate = isKnown
      && candidatesByKey.get(key)?.length > 1
      && winnerByKey.get(key) !== index;
    try {
      requireDigest(itemId, 'F25 item ID');
      if (duplicate) {
        throw new TypeError('F25 rendering received a duplicate item');
      }
      if (record?.state
        && RENDERABLE_NON_VALUE_STATES.includes(record.state)) {
        if (!isKnown
          || typeof record.reason_code !== 'string'
          || record.reason_code.length < 1
          || record.reason_code.length > 256) {
          throw new TypeError('typed F25 render state is invalid');
        }
        return {
          render_kind:
            `CATEGORICAL_MARKET_SUBROW_${record.state}`,
          key: itemId,
          metric_key: metricKey,
          item: clone(certified.get(key).item),
          reason_code: record.reason_code,
        };
      }
      if (record?.state !== undefined
        && record.state !== 'PRESENT') {
        throw new TypeError('F25 rendering received an unknown state');
      }
      if (!isKnown
        || certified.get(key).canonical !== canonicalJson(item)) {
        throw new TypeError('item is outside the certified F25 bundle');
      }
      fulfilled.add(key);
      return {
        render_kind: 'CATEGORICAL_MARKET_SUBROW',
        key: itemId,
        metric_key: metricKey,
        item: clone(certified.get(key).item),
      };
    } catch {
      const reasonCode =
        'INVALID_F25_CATEGORICAL_ITEM_CERTIFICATION';
      return {
        render_kind: 'CATEGORICAL_MARKET_SUBROW_FAILED',
        key: contentId(
          'F25_CATEGORICAL_MARKET_SUBROW_FAILED/V1',
          {
            index,
            metric_key:
              typeof metricKey === 'string' ? metricKey : null,
            source_item_id:
              SHA256_RE.test(itemId || '') ? itemId : null,
            reason_code: reasonCode,
          },
        ),
        metric_key:
          typeof metricKey === 'string' ? metricKey : null,
        source_item_id:
          SHA256_RE.test(itemId || '') ? itemId : null,
        reason_code: reasonCode,
      };
    }
  });
  for (const key of [...certified.keys()].sort()) {
    if (fulfilled.has(key) || encounteredKnownKeys.has(key)) continue;
    const separator = key.indexOf(':');
    const metricKey = key.slice(0, separator);
    const itemId = key.slice(separator + 1);
    rendered.push({
      render_kind: 'CATEGORICAL_MARKET_SUBROW_FAILED',
      key: contentId(
        'F25_CATEGORICAL_MARKET_SUBROW_FAILED/V1',
        {
          index: rendered.length,
          metric_key: metricKey,
          source_item_id: itemId,
          reason_code: 'MISSING_F25_CATEGORICAL_ITEM',
        },
      ),
      metric_key: metricKey,
      source_item_id: itemId,
      reason_code: 'MISSING_F25_CATEGORICAL_ITEM',
    });
  }
  return freeze(rendered);
}

module.exports = {
  AUTHORITY_SCOPE,
  CANONICAL_TEXT_ID,
  CONTINUE_EFFECT_SPECS,
  DOCUMENT_HASH,
  EXCEPTION_SOURCE_BINDING_DIGEST,
  EXCEPTION_SOURCE_BINDING_ID,
  F25_BUNDLE_DIGEST,
  F25_BUNDLE_ID,
  F25_MANIFEST_DIGEST,
  F25_MANIFEST_ID,
  F25_REGISTRY_ID,
  FILTER_KEYS,
  MAX_EXECUTION_RESULT_BYTES,
  METRIC_SPECS,
  buildNoShopActionsCertificationF25,
  buildServingExecutionBindings,
  compileF25CombinedMarketRequest,
  executeF25CombinedMarketRequest,
  prepareF25ItemsForRendering,
  resolveMetricServingAdmissionF25,
  validateF25EnvelopeIdentity,
  validateF25ExecutionResult,
  validateNoShopActionsCertificationF25,
  __test: {
    actionItems,
    buildMetricInputs,
    canonicalTextIdentityMatches,
    combinedMarketRequest,
    directEffectItems,
    inferredContinueEffectItems,
    interpretationPolicy,
    knowledgeItems,
    metricCarrier,
    metricDefinition,
    compareCanonicalDecimals,
    canonicalPercentage,
    normaliseF25Filters,
    prerequisiteItems,
    sourceContextIdentityMatches,
    validateInputs,
  },
};
