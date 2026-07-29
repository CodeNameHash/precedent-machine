const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  buildClaimRevision,
  buildRelationshipRevision,
} = require('./claims-relationships');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  compileFixtureContractV12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildExcerpt,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
} = require('./reviewed-qxo-capitalisation-slice');
const {
  validateQxoCapitalisationParserSourceClosureF27,
} = require('./qxo-capitalisation-parser-source-closure-f27');

const REVIEW_VERSION = 'QXO_CAPITALISATION_BRING_DOWN_F27/V1';
const BUYER_GROUP_PARTY = Object.freeze({
  role: 'CONDITION_BENEFICIARY',
  value: 'BUYER_GROUP',
  capacity: 'ACQUIRER',
});
const COMPANY_PARTY = Object.freeze({
  role: 'REPRESENTATION_MAKER',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const CLAUSE_B_CLASS = 'CAPITALISATION_CLAUSE_B_LIMBS_I_III';
const CLAUSE_C_CLASS = 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V';
const SIGNING_DATE_SOURCE_TEXT = 'dated as of April 18, 2026';
const LIMB_KEYS = Object.freeze([
  'limb_i',
  'limb_ii',
  'limb_iii',
  'limb_iv',
  'limb_v',
]);
const QUALIFIER_SCOPE_MEMBERS = Object.freeze([
  'REPRESENTATION_CHAPEAU',
  'REPRESENTATION_LIMB_I',
  'REPRESENTATION_LIMB_II',
  'REPRESENTATION_LIMB_III',
  'REPRESENTATION_LIMB_IV',
  'REPRESENTATION_LIMB_V',
  'APPLICABLE_PROVISOS',
  'DEFINED_TERM_USES',
  'CROSS_REFERENCES',
]);
const MEASUREMENT_ATTRIBUTES = Object.freeze([
  'raw_measurement_date',
  'signing_date',
  'signing_relative_offset',
  'offset_unit',
  'day_basis',
  'semantic_class',
  'precision',
  'derivation_version',
  'signing_anchor_evidence_excerpt_ids',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function evidence(excerpt, role, ordinal = 0) {
  return {
    evidence_role: role,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    ordinal,
  };
}

function scope(label, excerpts, contract = {}) {
  const ids = [...new Set(excerpts.map((entry) => entry.excerpt_id))].sort();
  const identity = {
    review_version: REVIEW_VERSION,
    label,
    required_interval_ids: ids,
    ...contract,
  };
  return {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', identity),
    coverage_status: 'COMPLETE',
    required_interval_ids: ids,
    examined_interval_ids: ids,
    ...contract,
  };
}

function relationshipScope(label, conditionExcerpts, targetExcerpts) {
  const required = [...new Set(
    [...conditionExcerpts, ...targetExcerpts].map((entry) => entry.excerpt_id),
  )].sort();
  return {
    scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label,
      required_interval_ids: required,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: required,
    examined_interval_ids: required,
    target_interval_ids: targetExcerpts.map((entry) => entry.excerpt_id).sort(),
  };
}

function requireV13(contractBundle) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V13) {
    throw new TypeError('the exact V13 capitalisation contract is required');
  }
  const semantic = contractBundle.capitalisation_semantic_schema_definition;
  const result = contractBundle.result_definitions?.find(
    (entry) => entry.result_key === 'TARGET_CAPITALISATION_BRING_DOWN'
      && entry.result_version === 2,
  );
  const metric = contractBundle.market_metric_definitions?.find(
    (entry) => entry.metric_key === 'REPRESENTATION_ACCURACY_STANDARD'
      && entry.metric_version === 2,
  );
  if (!semantic
    || semantic.condition_group_component_schema
      !== 'CAPITALISATION_CONDITION_GROUP/V1'
    || !result
    || !metric) {
    throw new TypeError('the complete V13 capitalisation contracts are required');
  }
  return { result, metric };
}

function sourceSlice(sourceContext, start, byteLength) {
  return Buffer.from(sourceContext.canonical_text.text, 'utf8')
    .subarray(start, start + byteLength)
    .toString('utf8');
}

function requireParserClosure(sourceContext, parserSourceClosure) {
  if (parserSourceClosure?.schema_version
      !== 'QXO_CAPITALISATION_PARSER_SOURCE_CLOSURE_F27/V1'
    || parserSourceClosure.source_transform !== 'PARSER_V2_TEXT_LAYERS/V1'
    || parserSourceClosure.page_marker_disposition?.exact_source_text !== '16'
    || parserSourceClosure.page_marker_disposition?.parser_clean_occurrence_count !== 0
    || parserSourceClosure.representation_limb_bindings?.length !== 5
    || parserSourceClosure.status?.source_projection !== 'MONOTONE_EXACT') {
    throw new TypeError('the exact F27 parser/source closure is required');
  }
  const bindings = new Map(parserSourceClosure.source_bindings.map(
    (entry) => [entry.source_key, entry],
  ));
  const capitalBinding = bindings.get('SECTION_3_1_B');
  const conditionBinding = bindings.get('SECTION_5_2');
  if (!capitalBinding || !conditionBinding) {
    throw new TypeError('the F27 parser/source bindings are incomplete');
  }
  const capital = sourceSlice(
    sourceContext,
    CAPITAL_STRUCTURE_INTERVAL.start,
    capitalBinding.raw_text_byte_length,
  );
  const condition = sourceSlice(
    sourceContext,
    SECTION_5_2_INTERVAL.start,
    conditionBinding.raw_text_byte_length,
  );
  if (capitalBinding.raw_text_sha256 !== sha256Hex(Buffer.from(capital))
    || conditionBinding.raw_text_sha256 !== sha256Hex(Buffer.from(condition))) {
    throw new TypeError('the F27 parser/source closure belongs to different source bytes');
  }
  validateQxoCapitalisationParserSourceClosureF27({
    closure: parserSourceClosure,
    capital_structure_text: capital,
    closing_condition_text: condition,
  });
}

function bindingExcerpts(sourceContext, binding, absoluteBase) {
  return freeze(binding.source_segments.map((segment) => buildExcerpt({
    source: sourceContext,
    span: buildSemanticSpan(
      sourceContext,
      absoluteBase + segment.source_byte_start,
      absoluteBase + segment.source_byte_end,
    ),
  })));
}

function representationEvidence(sourceContext, parserSourceClosure) {
  const limbs = Object.freeze(Object.fromEntries(
    parserSourceClosure.representation_limb_bindings.map((binding, index) => [
      LIMB_KEYS[index],
      bindingExcerpts(sourceContext, binding, CAPITAL_STRUCTURE_INTERVAL.start),
    ]),
  ));
  const section = parserSourceClosure.section_bindings.find(
    (entry) => entry.label === 'SECTION_3_1_B_CAPITAL_STRUCTURE',
  );
  return freeze({
    limbs,
    chapeau: bindingExcerpts(
      sourceContext,
      parserSourceClosure.representation_chapeau_binding,
      CAPITAL_STRUCTURE_INTERVAL.start,
    ),
    definition_use_context: bindingExcerpts(
      sourceContext,
      parserSourceClosure.company_equity_rights_continuity,
      CAPITAL_STRUCTURE_INTERVAL.start,
    ),
    complete_section: bindingExcerpts(
      sourceContext,
      section,
      CAPITAL_STRUCTURE_INTERVAL.start,
    ),
  });
}

function exactSubExcerpt(sourceContext, parentExcerpt, exactText, label) {
  const bytes = Buffer.from(sourceContext.canonical_text.text, 'utf8');
  const parent = bytes.subarray(
    parentExcerpt.absolute_start,
    parentExcerpt.absolute_end,
  );
  const needle = Buffer.from(exactText, 'utf8');
  const first = parent.indexOf(needle);
  if (first < 0 || parent.indexOf(needle, first + needle.length) >= 0) {
    throw new TypeError(`${label} is absent or ambiguous`);
  }
  return buildExcerpt({
    source: sourceContext,
    span: buildSemanticSpan(
      sourceContext,
      parentExcerpt.absolute_start + first,
      parentExcerpt.absolute_start + first + needle.length,
    ),
  });
}

function signingDateExcerpt(sourceContext) {
  const bytes = Buffer.from(sourceContext.canonical_text.text, 'utf8');
  const needle = Buffer.from(SIGNING_DATE_SOURCE_TEXT, 'utf8');
  const first = bytes.indexOf(needle);
  if (first < 0
    || first >= CAPITAL_STRUCTURE_INTERVAL.start
    || bytes.indexOf(needle, first + needle.length) >= 0) {
    throw new TypeError('the exact QXO signing-date source anchor is required');
  }
  return buildExcerpt({
    source: sourceContext,
    span: buildSemanticSpan(sourceContext, first, first + needle.length),
  });
}

function qualifierScope(label, representation, provisoExcerpt) {
  const memberEvidence = {
    REPRESENTATION_CHAPEAU:
      representation.chapeau.map((entry) => entry.excerpt_id).sort(),
    REPRESENTATION_LIMB_I:
      representation.limbs.limb_i.map((entry) => entry.excerpt_id).sort(),
    REPRESENTATION_LIMB_II:
      representation.limbs.limb_ii.map((entry) => entry.excerpt_id).sort(),
    REPRESENTATION_LIMB_III:
      representation.limbs.limb_iii.map((entry) => entry.excerpt_id).sort(),
    REPRESENTATION_LIMB_IV:
      representation.limbs.limb_iv.map((entry) => entry.excerpt_id).sort(),
    REPRESENTATION_LIMB_V:
      representation.limbs.limb_v.map((entry) => entry.excerpt_id).sort(),
    APPLICABLE_PROVISOS: [provisoExcerpt.excerpt_id],
    DEFINED_TERM_USES:
      representation.definition_use_context
        .map((entry) => entry.excerpt_id).sort(),
    CROSS_REFERENCES:
      representation.complete_section.map((entry) => entry.excerpt_id).sort(),
  };
  const excerpts = [
    ...representation.chapeau,
    ...Object.values(representation.limbs).flat(),
    ...representation.definition_use_context,
    ...representation.complete_section,
    provisoExcerpt,
  ];
  return scope(label, excerpts, {
    required_scope_members: QUALIFIER_SCOPE_MEMBERS,
    member_evidence_excerpt_ids: memberEvidence,
    party_scope: COMPANY_PARTY,
    temporal_scope: 'COMPLETE_REPRESENTATION_AS_EXPRESSLY_DATED',
    candidate_selected_scope: false,
  });
}

function buildConditionGroup({
  conditionProvision,
  excerpt,
  classKey,
  sourceClauseCode,
  targetLimbOrdinals,
  ordinal,
}) {
  const occurrenceBody = {
    document_hash: excerpt.document_hash,
    parent_provision_instance_id: conditionProvision.provision_instance_id,
    canonical_text_id: excerpt.canonical_text_id,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    component_key: 'CAPITALISATION_ACCURACY_GROUP',
    party: BUYER_GROUP_PARTY,
    governed_ordinal: ordinal,
  };
  const conditionGroupOccurrenceId = contentId(
    'CAPITALISATION_CONDITION_GROUP_OCCURRENCE/V1',
    occurrenceBody,
  );
  const revisionBody = {
    condition_group_occurrence_id: conditionGroupOccurrenceId,
    comparison_class_key: classKey,
    source_clause_code: sourceClauseCode,
    target_limb_ordinals: targetLimbOrdinals,
    evidence_excerpt_id: excerpt.excerpt_id,
    review_version: REVIEW_VERSION,
  };
  return freeze({
    schema_version: 'CAPITALISATION_CONDITION_GROUP/V1',
    ...occurrenceBody,
    ...revisionBody,
    condition_group_revision_id: contentId(
      'CAPITALISATION_CONDITION_GROUP_REVISION/V1',
      revisionBody,
    ),
  });
}

function buildAccuracyClaim({
  conditionProvision,
  excerpt,
  classKey,
  value,
  ordinal,
  additionalEvidence = [],
}) {
  return buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    ordinal,
    state: 'PRESENT',
    raw_value: excerpt.exact_text,
    canonical_value: value,
    attributes: { comparison_class_key: classKey },
    allowed_attributes: ['comparison_class_key'],
    taxonomy_codes: { accuracy_standard: value },
    codebooks: { accuracy_standard: [value] },
    evidence: [
      evidence(excerpt, 'OPERATIVE_TEXT'),
      ...additionalEvidence,
    ],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
}

function buildBringDown({
  conditionProvision,
  classKey,
  ordinal,
  targets,
  targetExcerpts,
  conditionExcerpt,
  provisoExcerpt,
  definitionExcerpt = null,
  scrapeExcerpt = null,
  accuracyStandard,
  accuracyException,
  scrapeState,
}) {
  const conditionExcerpts = [
    conditionExcerpt,
    provisoExcerpt,
    ...(definitionExcerpt ? [definitionExcerpt] : []),
    ...(scrapeExcerpt ? [scrapeExcerpt] : []),
  ];
  const closedScope = relationshipScope(
    `capitalisation-${classKey.toLowerCase()}`,
    conditionExcerpts,
    targetExcerpts,
  );
  const evidenceEdges = [
    ...targetExcerpts.map(
      (entry, index) => evidence(entry, 'DERIVATION_INPUT', index),
    ),
    evidence(conditionExcerpt, 'CROSS_REFERENCE', targetExcerpts.length),
    evidence(provisoExcerpt, 'EXCEPTION', targetExcerpts.length + 1),
    ...(definitionExcerpt
      ? [evidence(definitionExcerpt, 'DEFINITION', targetExcerpts.length + 2)]
      : []),
    ...(scrapeExcerpt
      ? [evidence(
        scrapeExcerpt,
        'DERIVATION_INPUT',
        targetExcerpts.length + 2 + (definitionExcerpt ? 1 : 0),
      )]
      : []),
  ];
  return buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'BRINGS_DOWN',
    relationship_definition_version: 2,
    ordinal,
    state: 'PRESENT',
    raw_scope: conditionExcerpt.exact_text,
    target_occurrence_ids: targets.map((entry) => entry.provision_component_id),
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_REPRESENTATION_ACCURACY',
      effect_schema_version: 1,
      comparison_class_key: classKey,
      target_limb_occurrence_ids: targets.map(
        (entry) => entry.provision_component_id,
      ),
      test_points: ['AGREEMENT_DATE', 'CLOSING_DATE'],
      dated_representation_proviso: {
        application: 'EXPRESS_DATE_OR_PERIOD_ONLY',
        evidence_excerpt_id: provisoExcerpt.excerpt_id,
      },
      accuracy_standard: accuracyStandard,
      accuracy_exception: accuracyException,
      materiality_scrape: {
        state: scrapeState,
        disregarded_qualifier_codes: scrapeState === 'APPLIED'
          ? ['MATERIAL', 'MATERIALITY', 'COMPANY_MATERIAL_ADVERSE_EFFECT']
          : [],
        evidence_excerpt_id: scrapeExcerpt?.excerpt_id || null,
      },
      evidence_excerpt_ids: [...new Set(
        evidenceEdges.map((entry) => entry.excerpt_id),
      )].sort(),
      scope_closure_id: closedScope.scope_closure_id,
    },
    evidence: evidenceEdges,
    scope: closedScope,
    resolver_version: REVIEW_VERSION,
  });
}

function buildDefinitionUse({
  clauseBRelationship,
  exactUseExcerpt,
  definitionExcerpt,
  exceptionClaim,
}) {
  const definitionOccurrenceId = contentId('DEFINITION_OCCURRENCE/V1', {
    document_hash: definitionExcerpt.document_hash,
    exact_declaration_span: {
      canonical_text_id: definitionExcerpt.canonical_text_id,
      absolute_start: definitionExcerpt.absolute_start,
      absolute_end: definitionExcerpt.absolute_end,
    },
    ordered_body_spans: [{
      canonical_text_id: definitionExcerpt.canonical_text_id,
      absolute_start: definitionExcerpt.absolute_start,
      absolute_end: definitionExcerpt.absolute_end,
    }],
    neutral_definition_key: 'DE_MINIMIS_INACCURACIES',
    governed_ordinal: 0,
  });
  const exactUseOccurrenceId = contentId('DEFINITION_USE_OCCURRENCE/V1', {
    document_hash: exactUseExcerpt.document_hash,
    exact_use_span: {
      canonical_text_id: exactUseExcerpt.canonical_text_id,
      absolute_start: exactUseExcerpt.absolute_start,
      absolute_end: exactUseExcerpt.absolute_end,
    },
    raw_use_form: 'De Minimis Inaccuracies',
    governed_ordinal: 0,
  });
  const definitionScope = scope('de-minimis-definition-application', [
    exactUseExcerpt,
    definitionExcerpt,
  ]);
  const evidenceIds = [
    exactUseExcerpt.excerpt_id,
    definitionExcerpt.excerpt_id,
  ].sort();
  const sourcePartyContextId = contentId('SOURCE_PARTY_CONTEXT/V1', {
    document_hash: definitionExcerpt.document_hash,
    source_scope_id: definitionScope.scope_closure_id,
    party: BUYER_GROUP_PARTY,
    evidence_excerpt_ids: evidenceIds,
  });
  const relationshipOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: clauseBRelationship.relationship_occurrence_id,
    relationship_definition_key: 'USES_DEFINITION',
    relationship_definition_version: 4,
    ordinal: 0,
  });
  const interpretationPayloadId = contentId('RELATIONSHIP_INTERPRETATION/V1', {
    relationship_occurrence_id: relationshipOccurrenceId,
    policy_version: REVIEW_VERSION,
    clarity_state: 'CLEAR',
    primary_interpretation: 'COMPANY_FULLY_DILUTED_EQUITY_CAPITALISATION',
    alternative_interpretations: [],
    ambiguity_dimension_codes: [],
    evidence_by_role: {
      EXACT_USE: exactUseExcerpt.excerpt_id,
      DEFINITION_DECLARATION: definitionExcerpt.excerpt_id,
      DEFINITION_BODY: definitionExcerpt.excerpt_id,
    },
    lawyer_note_digest: contentId(
      'LAWYER_NOTE/V1',
      'Company representation selects Company denominator',
    ),
    review_provenance: REVIEW_VERSION,
  });
  return buildRelationshipRevision({
    source_occurrence_id: clauseBRelationship.relationship_occurrence_id,
    relationship_definition_key: 'USES_DEFINITION',
    relationship_definition_version: 4,
    ordinal: 0,
    state: 'PRESENT',
    raw_scope: 'De Minimis Inaccuracies',
    target_occurrence_ids: [definitionOccurrenceId],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
      effect_schema_version: 3,
      exact_use_occurrence_id: exactUseOccurrenceId,
      exact_use_span: {
        canonical_text_id: exactUseExcerpt.canonical_text_id,
        absolute_start: exactUseExcerpt.absolute_start,
        absolute_end: exactUseExcerpt.absolute_end,
      },
      raw_use_form: 'De Minimis Inaccuracies',
      selected_definition_occurrence_id: definitionOccurrenceId,
      use_form_code: 'EXACT_DECLARED_TERM',
      legal_role_code: 'OPERATIVE_ACCURACY_EXCEPTION',
      affected_endpoint: {
        endpoint_kind: 'BRINGS_DOWN_RELATIONSHIP_OCCURRENCE',
        endpoint_id: clauseBRelationship.relationship_occurrence_id,
        affected_field_key: 'accuracy_exception',
      },
      party_scope: {
        source_party_context_id: sourcePartyContextId,
        affected_endpoint_party_context: BUYER_GROUP_PARTY,
        definition_party_context: {
          applicability_state: 'APPLICABLE',
          party: COMPANY_PARTY,
        },
      },
      evidence_excerpt_ids: evidenceIds,
      evidence_by_role: {
        EXACT_USE: exactUseExcerpt.excerpt_id,
        DEFINITION_DECLARATION: definitionExcerpt.excerpt_id,
        DEFINITION_BODY: definitionExcerpt.excerpt_id,
      },
      scope_closure_id: definitionScope.scope_closure_id,
      relationship_interpretation_payload_id: interpretationPayloadId,
      definition_precedence_review: {
        state: 'CONTROLLING_DEFINITION_CONFIRMED',
        complete_conflict_scan: true,
        scope_closure_id: definitionScope.scope_closure_id,
      },
      recursive_dependency_relationship_ids: [],
      propagation: 'EXACT_NAMED_TARGET_ONLY',
      party_transfer: 'NONE',
      alias_authority: 'NONE',
      definition_application: {
        defined_term_code: 'DE_MINIMIS_INACCURACIES',
        denominator_party_value: 'COMPANY',
        raw_alternative_phrase_code: 'OR_PARENT_AS_THE_CASE_MAY_BE',
        denominator_selection_evidence_excerpt_ids: evidenceIds,
        denominator_selection_derivation_version: REVIEW_VERSION,
        parent_representation_generalisation: false,
      },
      affected_claim_occurrence_id: exceptionClaim.claim_occurrence_id,
    },
    evidence: [
      evidence(exactUseExcerpt, 'EXCEPTION'),
      evidence(definitionExcerpt, 'DEFINITION', 1),
    ],
    scope: {
      ...definitionScope,
      target_interval_ids: [definitionExcerpt.excerpt_id],
    },
    resolver_version: REVIEW_VERSION,
  });
}

function buildQxoReviewedCapitalisationF27({
  sourceContext,
  parserSourceClosure,
  contractBundle,
} = {}) {
  const { result: resultDefinition, metric: metricDefinition } =
    requireV13(contractBundle);
  requireParserClosure(sourceContext, parserSourceClosure);
  const base = buildQxoReviewedCapitalisationSlice({
    sourceContext,
    contractBundle: compileFixtureContractV12(),
  });
  const representation = representationEvidence(
    sourceContext,
    parserSourceClosure,
  );
  const signingAnchor = signingDateExcerpt(sourceContext);
  const definitionUse = exactSubExcerpt(
    sourceContext,
    base.excerpts.tier_b,
    'De Minimis Inaccuracies',
    'clause (B) definition use',
  );
  const representationProvision = base.provisions[0];
  const conditionProvision = buildProvisionInstance({
    source: sourceContext,
    span: base.spans.condition,
    conceptKey: 'COND-B-REP',
    party: BUYER_GROUP_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const conditionGroups = [
    buildConditionGroup({
      conditionProvision,
      excerpt: base.excerpts.tier_b,
      classKey: CLAUSE_B_CLASS,
      sourceClauseCode: 'B',
      targetLimbOrdinals: [1, 3],
      ordinal: 1,
    }),
    buildConditionGroup({
      conditionProvision,
      excerpt: base.excerpts.tier_c,
      classKey: CLAUSE_C_CLASS,
      sourceClauseCode: 'C',
      targetLimbOrdinals: [2, 4, 5],
      ordinal: 2,
    }),
  ];
  const clauseBClaim = buildAccuracyClaim({
    conditionProvision,
    excerpt: base.excerpts.tier_b,
    classKey: CLAUSE_B_CLASS,
    value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    ordinal: 0,
  });
  const clauseCClaim = buildAccuracyClaim({
    conditionProvision,
    excerpt: base.excerpts.tier_c,
    classKey: CLAUSE_C_CLASS,
    value: 'MAT_ALL_MATERIAL',
    ordinal: 1,
    additionalEvidence: [
      evidence(base.excerpts.materiality_scrape, 'DERIVATION_INPUT', 1),
    ],
  });
  const exceptionClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    raw_value: base.excerpts.de_minimis_definition.exact_text,
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    denominator: {
      basis: 'FULLY_DILUTED_EQUITY_CAPITALISATION',
      party_value: 'COMPANY',
    },
    taxonomy_codes: { accuracy_exception: 'DE_MINIMIS_INACCURACIES' },
    codebooks: { accuracy_exception: ['DE_MINIMIS_INACCURACIES'] },
    evidence: [
      evidence(definitionUse, 'EXCEPTION'),
      evidence(base.excerpts.de_minimis_definition, 'DEFINITION', 1),
    ],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const measurementEvidence = [
    ...representation.limbs.limb_i,
    ...representation.limbs.limb_ii,
  ];
  const measurementClaim = buildClaimRevision({
    subject_occurrence_id: representationProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE',
    state: 'PRESENT',
    raw_value: 'April 17, 2026',
    canonical_value: '2026-04-17',
    unit: 'CALENDAR_DAY',
    attributes: {
      raw_measurement_date: '2026-04-17',
      signing_date: '2026-04-18',
      signing_relative_offset: -1,
      offset_unit: 'CALENDAR_DAY',
      day_basis: 'CALENDAR_DAY',
      semantic_class: 'NEAR_SIGNING_MEASUREMENT_SNAPSHOT',
      precision: 'EXACT',
      derivation_version: REVIEW_VERSION,
      signing_anchor_evidence_excerpt_ids: [signingAnchor.excerpt_id],
    },
    allowed_attributes: MEASUREMENT_ATTRIBUTES,
    evidence: [
      ...measurementEvidence.map(
        (entry, index) => evidence(entry, 'OPERATIVE_TEXT', index),
      ),
      evidence(signingAnchor, 'DERIVATION_INPUT', measurementEvidence.length),
    ],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const absenceScopes = {
    knowledge: qualifierScope(
      'capitalisation-general-knowledge',
      representation,
      base.excerpts.earlier_date,
    ),
    materiality: qualifierScope(
      'capitalisation-general-materiality',
      representation,
      base.excerpts.earlier_date,
    ),
    lookback: qualifierScope(
      'capitalisation-retrospective-lookback',
      representation,
      base.excerpts.earlier_date,
    ),
  };
  const knowledgeClaim = buildClaimRevision({
    subject_occurrence_id: representationProvision.provision_instance_id,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'ABSENT',
    scope: absenceScopes.knowledge,
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const materialityClaim = buildClaimRevision({
    subject_occurrence_id: representationProvision.provision_instance_id,
    claim_definition_key: 'GENERAL_MATERIALITY_QUALIFIER',
    state: 'ABSENT',
    scope: absenceScopes.materiality,
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const lookbackClaim = buildClaimRevision({
    subject_occurrence_id: representationProvision.provision_instance_id,
    claim_definition_key: 'RETROSPECTIVE_LOOKBACK',
    state: 'ABSENT',
    scope: absenceScopes.lookback,
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const clauseBRelationship = buildBringDown({
    conditionProvision,
    classKey: CLAUSE_B_CLASS,
    ordinal: 0,
    targets: [base.components[0], base.components[2]],
    targetExcerpts: [
      ...representation.limbs.limb_i,
      ...representation.limbs.limb_iii,
    ],
    conditionExcerpt: base.excerpts.tier_b,
    provisoExcerpt: base.excerpts.earlier_date,
    definitionExcerpt: base.excerpts.de_minimis_definition,
    accuracyStandard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    accuracyException: 'DE_MINIMIS_INACCURACIES',
    scrapeState: 'NOT_APPLIED',
  });
  const clauseCRelationship = buildBringDown({
    conditionProvision,
    classKey: CLAUSE_C_CLASS,
    ordinal: 1,
    targets: [base.components[1], base.components[3], base.components[4]],
    targetExcerpts: [
      ...representation.limbs.limb_ii,
      ...representation.limbs.limb_iv,
      ...representation.limbs.limb_v,
    ],
    conditionExcerpt: base.excerpts.tier_c,
    provisoExcerpt: base.excerpts.earlier_date,
    scrapeExcerpt: base.excerpts.materiality_scrape,
    accuracyStandard: 'MAT_ALL_MATERIAL',
    accuracyException: null,
    scrapeState: 'APPLIED',
  });
  const definitionRelationship = buildDefinitionUse({
    clauseBRelationship,
    exactUseExcerpt: definitionUse,
    definitionExcerpt: base.excerpts.de_minimis_definition,
    exceptionClaim,
  });
  const claims = [
    clauseBClaim,
    clauseCClaim,
    exceptionClaim,
    measurementClaim,
    knowledgeClaim,
    materialityClaim,
    lookbackClaim,
  ];
  const relationships = [
    clauseBRelationship,
    clauseCRelationship,
    definitionRelationship,
  ];
  const resultInputs = [
    {
      value_slot_key: CLAUSE_B_CLASS,
      ordinal: 0,
      comparison_class_key: CLAUSE_B_CLASS,
      condition_group_revision_id:
        conditionGroups[0].condition_group_revision_id,
      claim_revision_ids: [
        clauseBClaim.claim_revision_id,
        exceptionClaim.claim_revision_id,
      ],
      relationship_revision_ids: [
        clauseBRelationship.relationship_revision_id,
        definitionRelationship.relationship_revision_id,
      ],
    },
    {
      value_slot_key: CLAUSE_C_CLASS,
      ordinal: 1,
      comparison_class_key: CLAUSE_C_CLASS,
      condition_group_revision_id:
        conditionGroups[1].condition_group_revision_id,
      claim_revision_ids: [clauseCClaim.claim_revision_id],
      relationship_revision_ids: [clauseCRelationship.relationship_revision_id],
    },
    {
      value_slot_key: 'CAPITALISATION_MEASUREMENT_DATE',
      ordinal: 2,
      comparison_class_key: null,
      condition_group_revision_id: null,
      claim_revision_ids: [measurementClaim.claim_revision_id],
      relationship_revision_ids: [],
    },
    {
      value_slot_key: 'GENERAL_KNOWLEDGE_QUALIFIER',
      ordinal: 3,
      comparison_class_key: null,
      condition_group_revision_id: null,
      claim_revision_ids: [knowledgeClaim.claim_revision_id],
      relationship_revision_ids: [],
    },
    {
      value_slot_key: 'GENERAL_MATERIALITY_QUALIFIER',
      ordinal: 4,
      comparison_class_key: null,
      condition_group_revision_id: null,
      claim_revision_ids: [materialityClaim.claim_revision_id],
      relationship_revision_ids: [],
    },
    {
      value_slot_key: 'RETROSPECTIVE_LOOKBACK',
      ordinal: 5,
      comparison_class_key: null,
      condition_group_revision_id: null,
      claim_revision_ids: [lookbackClaim.claim_revision_id],
      relationship_revision_ids: [],
    },
  ];
  const body = {
    schema_version: 'QXO_REVIEWED_CAPITALISATION_F27/V1',
    review_version: REVIEW_VERSION,
    contract_fingerprint: contractBundle.fingerprint,
    parser_source_closure_id:
      parserSourceClosure.qxo_capitalisation_parser_source_closure_f27_id,
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    party: BUYER_GROUP_PARTY,
    source_party_tokens: parserSourceClosure.party_token_bindings.map(
      (entry) => entry.exact_clean_text,
    ),
    provisions: [representationProvision, conditionProvision],
    representation_components: base.components,
    condition_group_components: conditionGroups,
    claims,
    relationships,
    result_definition_id: resultDefinition.result_definition_id,
    metric_definition_id: metricDefinition.metric_definition_id,
    result_inputs: resultInputs,
    source_excerpts: {
      signing_date: signingAnchor,
      representation_clean_evidence: representation,
      clause_b: base.excerpts.tier_b,
      clause_c: base.excerpts.tier_c,
      dated_representation_proviso: base.excerpts.earlier_date,
      de_minimis_exact_use: definitionUse,
      de_minimis_definition: base.excerpts.de_minimis_definition,
      materiality_scrape: base.excerpts.materiality_scrape,
    },
    authority: {
      review_publication_authority: 'INACTIVE_CANDIDATE_ONLY',
      market_cohort_authority: 'NONE_PENDING_F27_CERTIFICATION',
      active_release_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
  };
  return freeze({
    ...body,
    qxo_reviewed_capitalisation_f27_id: contentId(
      'QXO_REVIEWED_CAPITALISATION_F27/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_REVIEWED_CAPITALISATION_F27_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoReviewedCapitalisationF27({
  candidate,
  ...inputs
} = {}) {
  const expected = buildQxoReviewedCapitalisationF27(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the reviewed QXO F27 capitalisation graph has drifted');
  }
  return true;
}

module.exports = {
  BUYER_GROUP_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  COMPANY_PARTY,
  QUALIFIER_SCOPE_MEMBERS,
  REVIEW_VERSION,
  SIGNING_DATE_SOURCE_TEXT,
  buildQxoReviewedCapitalisationF27,
  validateQxoReviewedCapitalisationF27,
};
