const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  compileFixtureContractV12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
} = require('./serving-projection');
const {
  buildCopyDeliveryMetricServingAdmission,
  buildMetricServingAdmissionRegistry,
} = require('./metric-serving-admission');
const {
  validateMetricScopedCandidateReleaseF23,
} = require('./metric-scoped-candidate-release-f23');
const {
  validateQxoNoShopCopyClockF15CarrierIdentity,
} = require('./qxo-no-shop-copy-clock-f15');
const {
  validateQxoAdmittedNoShopNoticeSlice,
} = require('./reviewed-qxo-admitted-no-shop-slice');
const {
  validateQxoAdmittedNoShopRematchSlice,
} = require('./reviewed-qxo-admitted-no-shop-rematch-slice');
const {
  validateClaimRevisionIdentity,
} = require('./claims-relationships');
const {
  normaliseDurationToDays,
  validateObservationNormalisation,
} = require('./observation-normalisers');

const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_SCOPE =
  'OFFLINE_QXO_NO_SHOP_TIMING_CERTIFICATION_F24_ONLY';
const F15_ID =
  '1062719fbf0974adae148ba9ab6bb74051df882a6838950c4b23c6d8d5c63295';
const F15_DIGEST =
  '72cd7e8465751e2c065e4dce10c987f2251852e091d8766bb1d62072138d8820';
const F23_BUNDLE_ID =
  '0f1f8e74238900979557f451926716511935b7562d005540a9ea1cdc83881ff9';
const F23_MANIFEST_ID =
  'a0f46126193f45787ad393fc0400bd82617d2682d267257b6d9dc1705e929c75';
const F23_MANIFEST_DIGEST =
  'fc7ccf786eb3c6d5d828cded78ad373389be76a714542ab86e82889bc167bbe7';
const COPY_DELIVERY_ADMISSION_ID =
  '374bdce70c2e9425c66c20cb929daafa68a10b79b5da8a382437945d474366d7';
const F24_BUNDLE_ID =
  '4c71688fcab56907fb12a976d2f3aee174b18e8a426605da4eaa3d18927bc2a3';
const F24_BUNDLE_DIGEST =
  'a388236319ed9655423dbb76400e4b843fb5960417fb8a91ef34c7e832e3f052';
const F24_MANIFEST_ID =
  '3ed213307bdc564302411087ab766a6dd4be14516c64ced2ce5adc658634edc4';
const F24_MANIFEST_DIGEST =
  '047eb92c2ee87b66e367b1ed942fde2ba68ac75764937e5ec387d3f90d577e5b';
const F24_REGISTRY_ID =
  'bdfa05ed30a79a68a37c1474a5f6e94afc942968ebe2f71fc2c816bd95a611ef';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_TRIGGER_CODES = Object.freeze([
  'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
  'RECEIPT_OF_COMPANY_REQUEST',
]);
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
const TIMING_SPECS = Object.freeze([
  Object.freeze({
    metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    concept_key: 'NOSOL-NOTICE',
    result_key: 'TARGET_NO_SHOP_NOTICE',
    value_slot_key: 'NOTICE_PERIOD',
    raw_text: 'twenty-four (24) hours after receipt',
    raw_magnitude: '24',
    raw_unit: 'HOURS',
    canonical_value: '1',
    canonical_unit: 'DAYS',
    day_basis: 'ELAPSED',
    metric_trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    legal_trigger_code:
      'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    party: TARGET_PARTY,
    source_slice: 'NOTICE',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    concept_key: 'NOSOL-MATCH',
    result_key: 'BUYER_INITIAL_MATCH_RIGHT',
    value_slot_key: 'INITIAL_MATCH_PERIOD',
    raw_text: 'four (4) business days’ prior written notice',
    raw_magnitude: '4',
    raw_unit: 'DAYS',
    canonical_value: '4',
    canonical_unit: 'DAYS',
    day_basis: 'BUSINESS',
    metric_trigger: 'SUPERIOR_PROPOSAL_NOTICE',
    legal_trigger_code: 'SUPERIOR_PROPOSAL_NOTICE',
    party: BUYER_PARTY,
    source_slice: 'NOTICE',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    concept_key: 'NOSOL-REMATCH',
    result_key: 'BUYER_SUBSEQUENT_MATCH_RIGHT',
    value_slot_key: 'SUBSEQUENT_MATCH_PERIOD',
    raw_text: 'a new four (4) business day notice period',
    raw_magnitude: '4',
    raw_unit: 'DAYS',
    canonical_value: '4',
    canonical_unit: 'DAYS',
    day_basis: 'BUSINESS',
    metric_trigger: 'MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    legal_trigger_code:
      'EACH_MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    party: BUYER_PARTY,
    source_slice: 'REMATCH',
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

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields are outside the F24 contract`);
  }
}

function sortedUniqueDigests(values, label) {
  if (!Array.isArray(values)
    || values.length < 1
    || values.length > 256
    || values.some((value) => !SHA256_RE.test(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    throw new TypeError(`${label} must be a bounded sorted digest set`);
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
  if (typeof text !== 'string') {
    return false;
  }
  const bytes = Buffer.from(text, 'utf8');
  return bytes.length === source.canonical_text_byte_length
    && sha256Hex(bytes) === source.canonical_text_sha256
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

function sourceBindingMatches(source, f15) {
  const binding = f15.source_binding;
  return sourceContextIdentityMatches(source)
    && canonicalTextIdentityMatches(source)
    && source.document_hash === DOCUMENT_HASH
    && source.document_hash === binding.document_hash
    && source.governed_deal_key === binding.governed_deal_key
    && source.source_ordinal === binding.source_ordinal
    && source.immutable_source_document_id
      === binding.immutable_source_document_id
    && source.source_admission_manifest_id
      === binding.source_admission_manifest_id
    && source.semantic_extraction_input_envelope_id
      === binding.semantic_extraction_input_envelope_id
    && source.canonical_text_id === binding.canonical_text_id;
}

function resultInputFor(spec, noticeSlice, rematchSlice) {
  const slice = spec.source_slice === 'REMATCH'
    ? rematchSlice
    : noticeSlice;
  const input = slice.resultInputs.find(
    (entry) => entry.metric_key === spec.metric_key,
  );
  if (!input) {
    throw new TypeError(`F24 lacks ${spec.metric_key}`);
  }
  return { input, slice };
}

function validateTimingClaim(spec, input) {
  validateClaimRevisionIdentity(input.claim);
  const definition = METRIC_DEFINITIONS[spec.metric_key];
  const normalisation = input.claim.attributes;
  if (!definition
    || definition.metric_version !== 1
    || definition.concept_key !== spec.concept_key
    || definition.required_claim_definition_key !== spec.metric_key
    || definition.canonical_unit !== spec.canonical_unit
    || definition.trigger !== spec.metric_trigger
    || input.result_key !== spec.result_key
    || input.value_slot_key !== spec.value_slot_key
    || input.concept_key !== spec.concept_key
    || canonicalJson(input.party) !== canonicalJson(spec.party)
    || input.claim.claim_definition_key !== spec.metric_key
    || input.claim.state !== 'PRESENT'
    || input.claim.publication_state !== 'VALIDATED'
    || input.claim.raw_value !== spec.raw_text
    || input.claim.canonical_value !== spec.canonical_value
    || input.claim.unit !== spec.canonical_unit
    || input.claim.day_basis !== spec.day_basis
    || normalisation.raw_magnitude !== spec.raw_magnitude
    || normalisation.raw_unit !== spec.raw_unit
    || normalisation.trigger !== spec.metric_trigger
    || normalisation.basis_key !== definition.basis_key
    || input.completeness !== 'COMPLETE'
    || input.comparability !== 'COMPARABLE'
    || input.relationships.length !== 0) {
    throw new TypeError(
      `${spec.metric_key} is outside the exact reviewed timing contract`,
    );
  }
  const expectedNormalisation = normaliseDurationToDays({
    rawMagnitude: spec.raw_magnitude,
    rawUnit: spec.raw_unit,
    dayBasis: spec.day_basis,
    trigger: spec.metric_trigger,
    derivationVersion: input.claim.derivation_version,
  });
  validateObservationNormalisation(expectedNormalisation);
  if (expectedNormalisation.normalisation_payload_digest
      !== normalisation.normalisation_payload_digest) {
    throw new TypeError(
      `${spec.metric_key} normalisation lineage has drifted`,
    );
  }
  return definition;
}

function validateNoticeSemantics(f15, noticeInput) {
  const revision = f15.notice_revision;
  const trigger = revision.trigger_expression;
  const clock = revision.initial_notice_clock_scope;
  if (canonicalJson(revision.trigger_codes)
      !== canonicalJson(NOTICE_TRIGGER_CODES)
    || trigger.operator !== 'ANY_OF'
    || canonicalJson(trigger.operands)
      !== canonicalJson(NOTICE_TRIGGER_CODES)
    || trigger.operand_sufficiency_code
      !== 'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT'
    || canonicalJson(trigger.party) !== canonicalJson(TARGET_PARTY)
    || clock.trigger_expression_id !== trigger.trigger_expression_id
    || clock.application_scope_code
      !== 'EACH_SATISFYING_TRIGGER_OCCURRENCE'
    || clock.temporal_operator !== 'CEILING'
    || clock.resolution_state !== 'RESOLVED_CLEAR'
    || !clock.qualifier_codes.includes('PROMPTLY')
    || !clock.qualifier_codes.includes(
      'NO_LATER_THAN_24_ELAPSED_HOURS',
    )
    || revision.definition_use_relationship_ids.length !== 30
    || !SHA256_RE.test(revision.definition_scope_closure_id)
    || noticeInput.claim.attributes.trigger
      !== 'RECEIPT_OF_COMPETING_PROPOSAL') {
    throw new TypeError('the authoritative F15 initial-notice semantics have drifted');
  }
}

function evidenceFor(input, slice) {
  const byId = new Map(
    Object.values(slice.excerpts).map(
      (excerpt) => [excerpt.excerpt_id, excerpt],
    ),
  );
  const evidence = input.claim.evidence.map((edge) => {
    const excerpt = byId.get(edge.excerpt_id);
    if (!excerpt
      || excerpt.absolute_start !== edge.absolute_start
      || excerpt.absolute_end !== edge.absolute_end
      || typeof excerpt.exact_text !== 'string'
      || excerpt.exact_text.length === 0) {
      throw new TypeError('timing evidence does not close over the reviewed source');
    }
    return {
      excerpt_id: excerpt.excerpt_id,
      semantic_span_id:
        excerpt.ordered_component_assignments[0].semantic_span_id,
      evidence_role: edge.evidence_role,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
      exact_bytes_digest: excerpt.exact_bytes_digest,
      exact_text: excerpt.exact_text,
    };
  }).sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  if (evidence.length !== 2
    || !evidence.some((entry) => entry.exact_text === input.claim.raw_value)
    || !evidence.some(
      (entry) => entry.exact_text.length > input.claim.raw_value.length
        && entry.exact_text.includes(input.claim.raw_value),
    )) {
    throw new TypeError('timing certification requires the exact clock and governing clause');
  }
  return evidence;
}

function validateInputs(input) {
  requireExactKeys(input, [
    'contract_bundle',
    'f23_candidate_release_bundle',
    'qxo_no_shop_copy_clock_f15',
    'admitted_source_context',
    'reviewed_no_shop_notice_slice',
    'reviewed_no_shop_rematch_slice',
  ], 'F24 inputs');
  const contract = input.contract_bundle;
  const f23 = input.f23_candidate_release_bundle;
  const f15 = input.qxo_no_shop_copy_clock_f15;
  const source = input.admitted_source_context;
  const noticeSlice = input.reviewed_no_shop_notice_slice;
  const rematchSlice = input.reviewed_no_shop_rematch_slice;
  validateContractBundle(contract);
  validateMetricScopedCandidateReleaseF23(f23);
  validateQxoNoShopCopyClockF15CarrierIdentity(f15);
  validateQxoAdmittedNoShopNoticeSlice({
    sourceContext: source,
    contractBundle: contract,
    slice: noticeSlice,
  });
  validateQxoAdmittedNoShopRematchSlice({
    sourceContext: source,
    contractBundle: contract,
    slice: rematchSlice,
  });
  if (contract.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || f15.qxo_no_shop_copy_clock_f15_id !== F15_ID
    || f15.canonical_payload_digest !== F15_DIGEST
    || f23.metric_scoped_candidate_release_bundle_id !== F23_BUNDLE_ID
    || f23.manifest.candidate_release_manifest_id !== F23_MANIFEST_ID
    || f23.manifest.canonical_payload_digest !== F23_MANIFEST_DIGEST
    || canonicalJson(f23.manifest.metric_serving_admission_ids)
      !== canonicalJson([COPY_DELIVERY_ADMISSION_ID])
    || f23.deal_directory_entries[0].deal_admission_id
      !== source.deal_admission_id
    || !sourceBindingMatches(source, f15)) {
    throw new TypeError('F24 requires the exact V12 source, F15 and F23 predecessors');
  }
  const resolved = TIMING_SPECS.map((spec) => {
    const pair = resultInputFor(spec, noticeSlice, rematchSlice);
    const definition = validateTimingClaim(spec, pair.input);
    return {
      spec,
      input: pair.input,
      slice: pair.slice,
      definition,
      evidence: evidenceFor(pair.input, pair.slice),
    };
  });
  validateNoticeSemantics(f15, resolved[0].input);
  return {
    contract,
    f23,
    f15,
    source,
    resolved,
  };
}

function interpretationPolicy(entry, f15) {
  const { spec, input, evidence } = entry;
  if (spec.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS') {
    const trigger = f15.notice_revision.trigger_expression;
    const clock = f15.notice_revision.initial_notice_clock_scope;
    return {
      schema_version: 'TIMING_COMPARABILITY_POLICY/V1',
      clarity_state: 'CLEAR',
      ambiguity_dimension_codes: [],
      comparability_effect_code: 'NONE',
      metric_trigger_projection:
        'LEGACY_GENERIC_RECEIPT_OF_COMPETING_PROPOSAL',
      source_legal_trigger: {
        code: spec.legal_trigger_code,
        operator: trigger.operator,
        operand_codes: clone(trigger.operands),
        operand_sufficiency:
          trigger.operand_sufficiency_code,
        application_scope_code: clock.application_scope_code,
      },
      temporal_operator: clock.temporal_operator,
      qualifier_codes: clone(clock.qualifier_codes),
      definition_treatment: {
        controlling_term: 'Company Request',
        plural_source_form: 'Company Requests',
        plural_resolution:
          'SOURCE_LOCAL_INFLECTION_OF_SINGULAR_DEFINITION',
        alias_authority: 'NONE',
        definition_scope_closure_id:
          f15.notice_revision.definition_scope_closure_id,
        definition_use_relationship_set_digest: contentId(
          'F24_NOTICE_DEFINITION_USE_RELATIONSHIP_SET/V1',
          f15.notice_revision.definition_use_relationship_ids,
        ),
      },
      governing_evidence_excerpt_ids:
        evidence.map((item) => item.excerpt_id).sort(),
      lawyer_warning: {
        required: false,
        code: null,
        text: null,
      },
    };
  }
  return {
    schema_version: 'TIMING_COMPARABILITY_POLICY/V1',
    clarity_state: 'CLEAR',
    ambiguity_dimension_codes: [],
    comparability_effect_code: 'NONE',
    metric_trigger_projection: spec.metric_trigger,
    source_legal_trigger: {
      code: spec.legal_trigger_code,
      operator: 'SINGLE',
      operand_codes: [spec.metric_trigger],
      operand_sufficiency: 'SOLE_TRIGGER',
      application_scope_code:
        spec.metric_key === 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS'
          ? 'EACH_MATERIAL_AMENDMENT'
          : 'INITIAL_SUPERIOR_PROPOSAL_NOTICE',
    },
    temporal_operator: 'PERIOD',
    qualifier_codes: [],
    definition_treatment: null,
    governing_evidence_excerpt_ids:
      evidence.map((item) => item.excerpt_id).sort(),
    lawyer_warning: {
      required: false,
      code: null,
      text: null,
    },
  };
}

function buildTimingAdmission(entry, contract, f15) {
  const { spec, input, definition, evidence } = entry;
  const policy = interpretationPolicy(entry, f15);
  const metricDefinitionAdmission = {
    schema_version:
      'F24_TIMING_METRIC_DEFINITION_ADMISSION/V1',
    contract_fingerprint: contract.fingerprint,
    metric_key: definition.metric_key,
    metric_version: definition.metric_version,
    metric_definition_id: metricDefinitionId(definition),
    concept_key: definition.concept_key,
    required_claim_definition_key:
      definition.required_claim_definition_key,
    metric_definition_authority: 'OFFLINE_GOVERNED_ONLY',
  };
  const metricDefinitionAdmissionId = contentId(
    'F24_TIMING_METRIC_DEFINITION_ADMISSION/V1',
    metricDefinitionAdmission,
  );
  const interpretationAdmissionDigest = contentId(
    'F24_TIMING_COMPARABILITY_POLICY/V1',
    policy,
  );
  const integrationAdmissionId = contentId(
    'F24_TIMING_INTEGRATION_ADMISSION/V1',
    {
      contract_fingerprint: contract.fingerprint,
      metric_key: spec.metric_key,
      claim_revision_id: input.claim.claim_revision_id,
      evidence_excerpt_ids:
        evidence.map((item) => item.excerpt_id).sort(),
      interpretation_admission_digest:
        interpretationAdmissionDigest,
      f15_id: spec.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS'
        ? F15_ID
        : null,
    },
  );
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_TIMING_IDENTITY_NOT_RELEASED',
    contract_fingerprint: contract.fingerprint,
    metric_key: definition.metric_key,
    metric_version: definition.metric_version,
    metric_definition_id: metricDefinitionId(definition),
    concept_key: definition.concept_key,
    required_claim_definition_key:
      definition.required_claim_definition_key,
    interpretation_admission_digest:
      interpretationAdmissionDigest,
    candidate_metric_definition_admission_id:
      metricDefinitionAdmissionId,
    integration_admission_id: integrationAdmissionId,
    certification_evidence: {
      document_hash: DOCUMENT_HASH,
      reviewed_mapping_id:
        entry.slice.reviewed_mapping.reviewed_mapping_id,
      claim_revision_id: input.claim.claim_revision_id,
      evidence_root: contentId(
        'F24_TIMING_EVIDENCE_ROOT/V1',
        evidence,
      ),
      f15_id: spec.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS'
        ? F15_ID
        : null,
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
        'F24_TIMING_CERTIFICATION_NOT_ASSEMBLED_IN_RELEASE',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return {
    ...body,
    metric_serving_admission_id: contentId(
      'METRIC_SERVING_ADMISSION/V1',
      body,
    ),
  };
}

function buildMetricServingAdmissionRegistryF24(validated) {
  const predecessor = buildMetricServingAdmissionRegistry();
  const admissions = [
    buildCopyDeliveryMetricServingAdmission(),
    ...validated.resolved.map(
      (entry) => buildTimingAdmission(
        entry,
        validated.contract,
        validated.f15,
      ),
    ),
  ].sort((left, right) => (
    left.metric_key.localeCompare(right.metric_key)
  ));
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_REGISTRY/V2',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_registry_id:
      predecessor.metric_serving_admission_registry_id,
    contract_fingerprint: validated.contract.fingerprint,
    later_contract_default: 'DENY',
    admission_records: admissions,
    wildcard_admission_authority: 'NONE',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return {
    ...body,
    metric_serving_admission_registry_id: contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V2',
      body,
    ),
  };
}

function timingCarrier(entry, admission, validated) {
  const { spec, input, definition, evidence } = entry;
  const policy = interpretationPolicy(entry, validated.f15);
  const comparabilityClassDigest = contentId(
    'F24_TIMING_COMPARABILITY_CLASS/V1',
    {
      metric_key: spec.metric_key,
      party: spec.party,
      canonical_unit: spec.canonical_unit,
      day_basis: spec.day_basis,
      source_legal_trigger: policy.source_legal_trigger,
      temporal_operator: policy.temporal_operator,
      qualifier_codes: policy.qualifier_codes,
    },
  );
  const observationBody = {
    schema_version: 'F24_TIMING_OBSERVATION/V1',
    contract_fingerprint: validated.contract.fingerprint,
    predecessor_corpus_release_id:
      validated.f23.manifest.corpus_release_id,
    governed_deal_key:
      validated.source.governed_deal_key,
    deal_admission_id:
      validated.source.deal_admission_id,
    document_hash: DOCUMENT_HASH,
    metric_key: spec.metric_key,
    metric_version: definition.metric_version,
    metric_definition_id: metricDefinitionId(definition),
    concept_key: spec.concept_key,
    party: clone(spec.party),
    result_key: spec.result_key,
    value_slot_key: spec.value_slot_key,
    claim_occurrence_id: input.claim.claim_occurrence_id,
    claim_revision_id: input.claim.claim_revision_id,
    state: input.claim.state,
    raw_value: {
      text: spec.raw_text,
      magnitude: spec.raw_magnitude,
      unit: spec.raw_unit,
      day_basis: spec.day_basis,
    },
    canonical_value: spec.canonical_value,
    canonical_unit: spec.canonical_unit,
    day_basis: spec.day_basis,
    basis_key: definition.basis_key,
    metric_trigger: definition.trigger,
    source_legal_trigger:
      clone(policy.source_legal_trigger),
    normalisation_payload_digest:
      input.claim.attributes.normalisation_payload_digest,
    derivation_version: input.claim.derivation_version,
    comparability_state: 'COMPARABLE_CLEAR',
    comparability_class_digest: comparabilityClassDigest,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    evidence: clone(evidence),
  };
  const observation = {
    ...observationBody,
    canonical_payload_digest: contentId(
      'F24_TIMING_OBSERVATION_PAYLOAD/V1',
      observationBody,
    ),
  };
  const requestBase = {
    schema_version: 'MARKET_COHORT_REQUEST/V4',
    authority_scope: AUTHORITY_SCOPE,
    execution_shape: 'ONE_INDEXED_SET_BASED_SQL',
    serving_namespace_id:
      validated.f23.manifest.serving_namespace_id,
    predecessor_corpus_release_id:
      validated.f23.manifest.corpus_release_id,
    predecessor_release_manifest_id: F23_MANIFEST_ID,
    contract_fingerprint: validated.contract.fingerprint,
    metric_key: spec.metric_key,
    metric_version: definition.metric_version,
    concept_key: spec.concept_key,
    party: clone(spec.party),
    subject_deal_key:
      validated.source.governed_deal_key,
    basis_key: definition.basis_key,
    comparability_class_digest: comparabilityClassDigest,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    filters: {
      sector: null,
      buyer: null,
      merger_form: null,
      adviser_either: null,
      lawyer_either: null,
      year_from: null,
      year_to: null,
      min_value_usd: null,
      max_value_usd: null,
    },
  };
  const cohortDigest = contentId(
    'MARKET_COHORT/V4',
    requestBase,
  );
  const cohortRequest = {
    ...requestBase,
    cohort_digest: cohortDigest,
    cache_key: contentId('MARKET_COHORT_CACHE/V4', {
      serving_namespace_id: requestBase.serving_namespace_id,
      predecessor_corpus_release_id:
        requestBase.predecessor_corpus_release_id,
      cohort_digest: cohortDigest,
      metric_serving_admission_id:
        requestBase.metric_serving_admission_id,
    }),
    execution_state: 'NOT_BUILT',
  };
  const cohortResult = {
    schema_version: 'MARKET_COHORT_RESULT/V4',
    authority_scope: AUTHORITY_SCOPE,
    execution_state: 'OFFLINE_FIXTURE_ONLY',
    predecessor_corpus_release_id:
      requestBase.predecessor_corpus_release_id,
    predecessor_release_manifest_id: F23_MANIFEST_ID,
    contract_fingerprint: validated.contract.fingerprint,
    cohort_digest: cohortDigest,
    comparability_class_digest: comparabilityClassDigest,
    metric_key: spec.metric_key,
    metric_version: definition.metric_version,
    concept_key: spec.concept_key,
    subject_deal_key:
      validated.source.governed_deal_key,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    counts: {
      eligible_deals: 1,
      applicable_deals: 1,
      examined_deals: 1,
      present_deals: 1,
      comparable_deals: 1,
      distribution_deals: 1,
      excluded_deals: 0,
      observation_slots: 1,
      excluded_slots: 0,
    },
    distribution: [{
      canonical_value: spec.canonical_value,
      subject_count: 1,
      deal_count: 1,
    }],
    exclusions: [],
  };
  const queryBody = {
    schema_version: 'QUERY_PROJECTION_RECORD/V5',
    authority_scope: AUTHORITY_SCOPE,
    activation_eligibility:
      'INELIGIBLE_F24_CERTIFICATION_ONLY',
    predecessor_corpus_release_id:
      requestBase.predecessor_corpus_release_id,
    predecessor_release_manifest_id: F23_MANIFEST_ID,
    governed_deal_key:
      validated.source.governed_deal_key,
    metric_key: spec.metric_key,
    metric_version: definition.metric_version,
    concept_key: spec.concept_key,
    party: clone(spec.party),
    raw_value: clone(observation.raw_value),
    canonical_value: spec.canonical_value,
    canonical_unit: spec.canonical_unit,
    day_basis: spec.day_basis,
    basis_key: definition.basis_key,
    source_legal_trigger:
      clone(policy.source_legal_trigger),
    clarity_state: policy.clarity_state,
    ambiguity_dimension_codes:
      clone(policy.ambiguity_dimension_codes),
    comparability_class_digest: comparabilityClassDigest,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    cohort_digest: cohortDigest,
    cache_key: cohortRequest.cache_key,
    source_action_state: 'AVAILABLE',
  };
  const queryProjection = {
    ...queryBody,
    canonical_payload_digest: contentId(
      'QUERY_PROJECTION_RECORD_PAYLOAD/V5',
      queryBody,
    ),
  };
  const carrierBody = {
    schema_version:
      'NO_SHOP_TIMING_METRIC_CERTIFICATION_F24/V1',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_release_manifest_id: F23_MANIFEST_ID,
    metric_serving_admission: clone(admission),
    interpretation_policy: policy,
    observation,
    cohort_request: cohortRequest,
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
      normalisation_certified: true,
      cohort_identity_certified: true,
      cache_identity_certified: true,
      publication_blocked: true,
      release_eligible: false,
    },
  };
  return {
    ...carrierBody,
    timing_metric_certification_id: contentId(
      'NO_SHOP_TIMING_METRIC_CERTIFICATION_F24/V1',
      carrierBody,
    ),
    canonical_payload_digest: contentId(
      'NO_SHOP_TIMING_METRIC_CERTIFICATION_F24_PAYLOAD/V1',
      carrierBody,
    ),
  };
}

function buildManifest(validated, registry, carriers) {
  const copyAdmission = buildCopyDeliveryMetricServingAdmission();
  const admissionIds = registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  const body = {
    schema_version:
      'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_STAGING_ROLLBACK_ONLY_NOT_ACTIVATABLE',
    activation_eligibility:
      'INELIGIBLE_COMBINED_RELEASE_NOT_BUILT',
    contract_fingerprint: validated.contract.fingerprint,
    predecessor_release_manifest_id: F23_MANIFEST_ID,
    predecessor_release_manifest_payload_digest:
      F23_MANIFEST_DIGEST,
    predecessor_bundle_id: F23_BUNDLE_ID,
    predecessor_copy_delivery_admission_id:
      copyAdmission.metric_serving_admission_id,
    metric_serving_admission_registry_id:
      registry.metric_serving_admission_registry_id,
    metric_serving_admission_ids: admissionIds,
    certified_timing_metric_keys: carriers.map(
      (entry) => entry.observation.metric_key,
    ).sort(),
    counts: {
      predecessor_metrics: 1,
      new_timing_metrics: 3,
      timing_observations: 3,
      cohort_requests: 3,
      cohort_results: 3,
      query_projections: 3,
    },
    roots: {
      timing_certification_root: contentId(
        'F24_TIMING_CERTIFICATION_ROOT/V1',
        carriers.map(
          (entry) => entry.timing_metric_certification_id,
        ),
      ),
      observation_root: contentId(
        'F24_TIMING_OBSERVATION_ROOT/V1',
        carriers.map(
          (entry) => entry.observation.canonical_payload_digest,
        ),
      ),
      cohort_request_root: contentId(
        'F24_TIMING_COHORT_REQUEST_ROOT/V1',
        carriers.map(
          (entry) => contentId(
            'F24_TIMING_COHORT_REQUEST/V1',
            entry.cohort_request,
          ),
        ),
      ),
      cohort_result_root: contentId(
        'F24_TIMING_COHORT_RESULT_ROOT/V1',
        carriers.map(
          (entry) => contentId(
            'F24_TIMING_COHORT_RESULT/V1',
            entry.cohort_result,
          ),
        ),
      ),
      query_projection_root: contentId(
        'F24_TIMING_QUERY_PROJECTION_ROOT/V1',
        carriers.map(
          (entry) => entry.query_projection.canonical_payload_digest,
        ),
      ),
    },
    serving_plan: {
      database_calls_per_request: 1,
      database_call_growth_with_corpus_size: 'CONSTANT',
      request_shape: 'ONE_INDEXED_SET_BASED_SQL',
      cache_scope: 'RELEASE_METRIC_PARTY_BASIS_ADMISSION',
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
        'F25_PROHIBITED_ACTION_AND_EXCEPTION_CERTIFICATION_REQUIRED',
        'F26_CROSS_VIEW_RELEASE_ASSEMBLY_REQUIRED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return {
    ...body,
    no_shop_timing_certification_manifest_f24_id:
      contentId(
        'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24_PAYLOAD/V1',
      body,
    ),
  };
}

function buildNoShopTimingCertificationF24(input = {}) {
  const validated = validateInputs(input);
  const registry = buildMetricServingAdmissionRegistryF24(
    validated,
  );
  const admissionByMetric = new Map(
    registry.admission_records.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const carriers = validated.resolved.map(
    (entry) => timingCarrier(
      entry,
      admissionByMetric.get(entry.spec.metric_key),
      validated,
    ),
  ).sort((left, right) => (
    left.observation.metric_key.localeCompare(
      right.observation.metric_key,
    )
  ));
  const manifest = buildManifest(
    validated,
    registry,
    carriers,
  );
  const body = {
    schema_version:
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_manifest: clone(validated.f23.manifest),
    registry,
    timing_certifications: carriers,
    manifest,
  };
  const bundle = {
    ...body,
    no_shop_timing_certification_bundle_f24_id:
      contentId(
        'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24_PAYLOAD/V1',
      body,
    ),
  };
  validateNoShopTimingCertificationF24({
    ...input,
    no_shop_timing_certification_f24: bundle,
  });
  return freeze(bundle);
}

function validateNoShopTimingCertificationF24({
  no_shop_timing_certification_f24: candidate,
  ...input
} = {}) {
  const validated = validateInputs(input);
  const registry = buildMetricServingAdmissionRegistryF24(
    validated,
  );
  const admissionByMetric = new Map(
    registry.admission_records.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const carriers = validated.resolved.map(
    (entry) => timingCarrier(
      entry,
      admissionByMetric.get(entry.spec.metric_key),
      validated,
    ),
  ).sort((left, right) => (
    left.observation.metric_key.localeCompare(
      right.observation.metric_key,
    )
  ));
  const manifest = buildManifest(
    validated,
    registry,
    carriers,
  );
  const body = {
    schema_version:
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_manifest: clone(validated.f23.manifest),
    registry,
    timing_certifications: carriers,
    manifest,
  };
  const expected = {
    ...body,
    no_shop_timing_certification_bundle_f24_id:
      contentId(
        'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24_PAYLOAD/V1',
      body,
    ),
  };
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the F24 timing certification bundle has drifted');
  }
  return true;
}

function validateF24EnvelopeIdentity(bundle) {
  const {
    no_shop_timing_certification_bundle_f24_id: bundleId,
    canonical_payload_digest: bundleDigest,
    ...bundleBody
  } = bundle || {};
  const {
    no_shop_timing_certification_manifest_f24_id: manifestId,
    canonical_payload_digest: manifestDigest,
    ...manifestBody
  } = bundle?.manifest || {};
  const {
    metric_serving_admission_registry_id: registryId,
    ...registryBody
  } = bundle?.registry || {};
  if (bundleId !== F24_BUNDLE_ID
    || bundleDigest !== F24_BUNDLE_DIGEST
    || bundleId !== contentId(
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
      bundleBody,
    )
    || bundleDigest !== contentId(
      'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24_PAYLOAD/V1',
      bundleBody,
    )
    || manifestId !== F24_MANIFEST_ID
    || manifestDigest !== F24_MANIFEST_DIGEST
    || manifestId !== contentId(
      'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24/V1',
      manifestBody,
    )
    || manifestDigest !== contentId(
      'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24_PAYLOAD/V1',
      manifestBody,
    )
    || registryId !== F24_REGISTRY_ID
    || registryId !== contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V2',
      registryBody,
    )
    || bundle.predecessor_manifest
      ?.candidate_release_manifest_id !== F23_MANIFEST_ID
    || bundle.predecessor_manifest
      ?.canonical_payload_digest !== F23_MANIFEST_DIGEST
    || bundle.timing_certifications?.length !== 3) {
    throw new TypeError('the exact F24 certification envelope is required');
  }
  return true;
}

function resolveMetricServingAdmissionF24({
  bundle,
  metric_key: metricKey,
  metric_version: metricVersion,
  concept_key: conceptKey,
  required_claim_definition_key: claimDefinitionKey,
  metric_serving_admission_id: admissionId,
  declared_metric_serving_admission_ids: declaredIds,
} = {}) {
  validateF24EnvelopeIdentity(bundle);
  sortedUniqueDigests(
    declaredIds,
    'declared metric serving admission IDs',
  );
  if (canonicalJson(declaredIds)
      !== canonicalJson(
        bundle.manifest.metric_serving_admission_ids,
      )) {
    throw new TypeError(
      'declared metric serving admissions must equal the F24 manifest',
    );
  }
  const admission = bundle.registry.admission_records.find(
    (entry) => entry.metric_serving_admission_id === admissionId,
  );
  const definition = METRIC_DEFINITIONS[metricKey];
  if (!admission
    || !declaredIds.includes(admissionId)
    || !definition
    || metricVersion !== definition.metric_version
    || conceptKey !== definition.concept_key
    || claimDefinitionKey
      !== definition.required_claim_definition_key
    || admission.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || admission.metric_key !== metricKey
    || admission.metric_version !== metricVersion
    || admission.metric_definition_id
      !== metricDefinitionId(definition)
    || admission.concept_key !== conceptKey
    || admission.required_claim_definition_key
      !== claimDefinitionKey) {
    throw new TypeError('F24 metric admission identity did not resolve');
  }
  return freeze({
    schema_version:
      'METRIC_SERVING_ADMISSION_RESOLUTION/V2',
    admission_lane: 'METRIC_SCOPED',
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
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

function prepareTimingCertificationsForRendering(
  records,
  certifiedBundle,
) {
  validateF24EnvelopeIdentity(certifiedBundle);
  const released = new Map(
    certifiedBundle.timing_certifications.map(
      (record) => [
        record.observation.metric_key,
        canonicalJson(record),
      ],
    ),
  );
  const seen = new Set();
  return (records || []).map((record, index) => {
    const metricKey = record?.observation?.metric_key;
    const admissionId =
      record?.metric_serving_admission
        ?.metric_serving_admission_id;
    try {
      requireDigest(admissionId, 'metric admission ID');
      if (!TIMING_SPECS.some(
        (spec) => spec.metric_key === metricKey,
      )
        || seen.has(metricKey)
        || released.get(metricKey) !== canonicalJson(record)
        || !certifiedBundle.manifest
          .metric_serving_admission_ids.includes(admissionId)) {
        throw new TypeError('timing record is outside the certified bundle');
      }
      seen.add(metricKey);
      return {
        render_kind: 'TIMING_METRIC',
        key: record.timing_metric_certification_id,
        metric_key: metricKey,
        record,
      };
    } catch {
      return {
        render_kind: 'TIMING_METRIC_RENDER_FAILED',
        key: SHA256_RE.test(
          record?.timing_metric_certification_id || '',
        )
          ? record.timing_metric_certification_id
          : contentId('TIMING_METRIC_RENDER_FAILED/V1', {
            index,
          }),
        metric_key:
          typeof metricKey === 'string' ? metricKey : null,
        reason_code:
          'INVALID_F24_TIMING_METRIC_CERTIFICATION',
      };
    }
  });
}

module.exports = {
  AUTHORITY_SCOPE,
  COPY_DELIVERY_ADMISSION_ID,
  DOCUMENT_HASH,
  F15_DIGEST,
  F15_ID,
  F23_BUNDLE_ID,
  F23_MANIFEST_DIGEST,
  F23_MANIFEST_ID,
  F24_BUNDLE_DIGEST,
  F24_BUNDLE_ID,
  F24_MANIFEST_DIGEST,
  F24_MANIFEST_ID,
  F24_REGISTRY_ID,
  NOTICE_TRIGGER_CODES,
  TIMING_SPECS,
  buildMetricServingAdmissionRegistryF24,
  buildNoShopTimingCertificationF24,
  prepareTimingCertificationsForRendering,
  resolveMetricServingAdmissionF24,
  validateF24EnvelopeIdentity,
  validateNoShopTimingCertificationF24,
  __test: {
    evidenceFor,
    interpretationPolicy,
    canonicalTextIdentityMatches,
    sourceBindingMatches,
    sourceContextIdentityMatches,
    timingCarrier,
    validateInputs,
    validateNoticeSemantics,
    validateTimingClaim,
  },
};
