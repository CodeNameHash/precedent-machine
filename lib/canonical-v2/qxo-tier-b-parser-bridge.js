const {
  canonicalJson,
  contentId,
  utf8Slice,
} = require('./canonical-bytes');
const {
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  validateAdmittedParserProposalEnvelope,
} = require('./admitted-parser-proposal-adapter');
const {
  validateReviewedDefinitionGraphPackage,
} = require('./reviewed-definition-graph-package');
const {
  validateQxoReviewedCapitalisationSlice,
} = require('./reviewed-qxo-capitalisation-slice');
const {
  buildSemanticSpan,
} = require('./source-structure');
const {
  METRIC_DEFINITIONS,
} = require('./serving-projection');

const MAX_SEED_BYTES = 16 * 1024;
const MAX_SEED_NODES = 4096;
const MAX_ADMITTED_PARSER_RESIDUALS = 4096;
const DEAL_KEY = 'deal:qxo-topbuild';
const TOKEN_CONTINUATION_RE = /[\p{L}\p{M}\p{N}_'’&/-]/u;
const BRIDGE_INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
  'inference_transcript_set_marker',
  'reviewed_candidate_dispositions',
  'governed_parent_section_proposal_ids',
  'reviewed_definition_graph_package',
  'reviewed_capitalisation_slice',
]);
const SEED_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'reviewed_definition_binding',
  'composition_binding',
  'withheld_legacy_claim_references',
  'party_observations',
  'intended_projection',
  'status',
  'qxo_tier_b_parser_bound_review_seed_id',
  'canonical_payload_digest',
]);
const LOCALLY_SUPPRESSIBLE_CODES = new Set([
  'DEFINITION_CANDIDATE_DRIFT',
  'DEFINITION_CUE_NOT_UNIQUE',
  'DEFINITION_GEOMETRY_DRIFT',
  'DEFINITION_PARENT_SCOPE_DRIFT',
  'DEFINITION_USE_NOT_EXACT',
  'GOVERNED_EVIDENCE_RESIDUAL',
  'PARSER_PARENT_NOT_UNIQUE',
  'PARTY_HEADING_NOT_FOUND',
  'PARTY_TOKEN_NOT_UNIQUE',
  'PARTY_TOKEN_ORDER_DRIFT',
  'PARTY_TOKEN_SOURCE_DRIFT',
  'RELEASE_REFERENCE_FORBIDDEN',
  'REVIEWED_MAPPING_INVALID',
  'REVIEWED_MAPPING_SHAPE_DRIFT',
  'TIER_B_SEMANTIC_DRIFT',
  'TIER_B_TARGET_DRIFT',
  'WITHHELD_ABSENCE_DRIFT',
]);
const BLOCKER_CODES = Object.freeze([
  'ABSENCE_SCOPE_NOT_CERTIFIED',
  'ADDITIONAL_CONDITION_PARTY_ROLES_OUT_OF_SCOPE',
  'DEFINITION_CONCEPT_FREEZE_GATE_REQUIRED',
  'QUERY_METRIC_CONTRACT_REQUIRED',
  'RESULT_INPUT_LINEAGE_CONTRACT_REQUIRED',
  'USES_DEFINITION_EFFECT_CONTRACT_REQUIRED',
]);
const PARTY_OBSERVATION_SPECS = Object.freeze([
  Object.freeze({
    token: 'Parent',
    token_key: 'PARENT',
    following_delimiter: ', ',
    allocation_status: 'MAPPED_EXISTING_PARTY_REFERENCE_ONLY',
    assigned_party_value: 'PARENT',
  }),
  Object.freeze({
    token: 'Titanium Merger Sub',
    token_key: 'TITANIUM_MERGER_SUB',
    following_delimiter: ' and ',
    allocation_status: 'OBSERVED_UNASSIGNED',
    assigned_party_value: null,
  }),
  Object.freeze({
    token: 'Forward Merger Sub',
    token_key: 'FORWARD_MERGER_SUB',
    following_delimiter: '',
    allocation_status: 'OBSERVED_UNASSIGNED',
    assigned_party_value: null,
  }),
]);

class QxoTierBParserBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoTierBParserBridgeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoTierBParserBridgeError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function contains(container, child) {
  return container.absolute_start <= child.absolute_start
    && container.absolute_end >= child.absolute_end;
}

function overlaps(left, right) {
  return left.absolute_start < right.absolute_end
    && right.absolute_start < left.absolute_end;
}

function requireExact(value, expected, code, message) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code, message);
}

function requireBridgeInput(input) {
  const expectedKeys = new Set(BRIDGE_INPUT_KEYS);
  const keys = input && typeof input === 'object' && !Array.isArray(input)
    ? Object.keys(input)
    : [];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || keys.length !== BRIDGE_INPUT_KEYS.length
    || keys.some((key) => !expectedKeys.has(key))) {
    fail('BRIDGE_INPUT_CONTRACT_MISMATCH', 'the QXO Tier B bridge input is outside its closed contract');
  }
}

function preflightParserResiduals(parserEnvelope) {
  if (!parserEnvelope || !Array.isArray(parserEnvelope.residuals)
    || parserEnvelope.residuals.length > MAX_ADMITTED_PARSER_RESIDUALS) {
    fail('PARSER_RESIDUAL_LIMIT_EXCEEDED', 'the admitted parser residual collection exceeds its governed limit');
  }
}

function preflightSeed(seed) {
  const expectedKeys = new Set(SEED_KEYS);
  const topLevelKeys = seed && typeof seed === 'object' && !Array.isArray(seed)
    ? Object.keys(seed)
    : [];
  if (topLevelKeys.some((key) => Buffer.byteLength(key, 'utf8') > MAX_SEED_BYTES)) {
    fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed exceeds 16 KiB');
  }
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)
    || topLevelKeys.length !== SEED_KEYS.length
    || topLevelKeys.some((key) => !expectedKeys.has(key))) {
    fail('SEED_CONTRACT_MISMATCH', 'the QXO Tier B review seed fields are outside the closed contract');
  }
  const stack = [seed];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed exceeds its node limit');
    }
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value, 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed exceeds 16 KiB');
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_SEED_NODES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed array exceeds its item limit');
      }
      for (let index = value.length - 1; index >= 0; index -= 1) stack.push(value[index]);
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed object exceeds its field limit');
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      stringBytes += Buffer.byteLength(keys[index], 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed exceeds 16 KiB');
      }
      stack.push(value[keys[index]]);
    }
  }
  if (Buffer.byteLength(canonicalJson(seed), 'utf8') > MAX_SEED_BYTES) {
    fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B review seed exceeds 16 KiB');
  }
}

function findExactObservedPartyToken(heading, token, followingDelimiter) {
  if (typeof heading !== 'string'
    || typeof token !== 'string'
    || !token
    || typeof followingDelimiter !== 'string') {
    fail('PARTY_TOKEN_NOT_UNIQUE', 'a party heading and non-empty token are required');
  }
  const matches = [];
  let from = 0;
  while (from <= heading.length - token.length) {
    const start = heading.indexOf(token, from);
    if (start < 0) break;
    const before = start > 0 ? heading[start - 1] : '';
    const after = start + token.length < heading.length
      ? heading[start + token.length]
      : '';
    const delimiterMatches = followingDelimiter
      ? heading.slice(start + token.length).startsWith(followingDelimiter)
      : start + token.length === heading.length;
    if ((!before || !TOKEN_CONTINUATION_RE.test(before))
      && (!after || !TOKEN_CONTINUATION_RE.test(after))
      && delimiterMatches) {
      matches.push(start);
    }
    from = start + token.length;
  }
  if (matches.length !== 1) {
    fail('PARTY_TOKEN_NOT_UNIQUE', `the party heading does not contain one exact bounded ${token} token`);
  }
  return matches[0];
}

function requireUniqueParent({
  parserEnvelope,
  sectionNumber,
  governedSpans,
}) {
  const matches = parserEnvelope.structural_section_proposals.filter((proposal) => (
    proposal.section_number === sectionNumber
      && governedSpans.every((span) => contains(proposal.evidence_anchor, span))
  ));
  if (matches.length !== 1) {
    fail(
      'PARSER_PARENT_NOT_UNIQUE',
      `exactly one admitted Section ${sectionNumber} proposal must contain the governed evidence`,
    );
  }
  return matches[0];
}

function buildPartyObservations(sourceContext, sectionSpan) {
  const headingText = utf8Slice(
    sourceContext.canonical_text.text,
    sectionSpan.absolute_start,
    sectionSpan.absolute_end,
  );
  const headingEnd = headingText.indexOf('. ', 3);
  if (headingEnd < 1) {
    fail('PARTY_HEADING_NOT_FOUND', 'the admitted Section 5.2 party heading is missing');
  }
  const heading = headingText.slice(0, headingEnd);
  const observations = PARTY_OBSERVATION_SPECS.map((spec, sourceOrderOrdinal) => {
    const first = findExactObservedPartyToken(
      heading,
      spec.token,
      spec.following_delimiter,
    );
    const absoluteStart = sectionSpan.absolute_start
      + Buffer.byteLength(heading.slice(0, first), 'utf8');
    const absoluteEnd = absoluteStart + Buffer.byteLength(spec.token, 'utf8');
    const span = buildSemanticSpan(sourceContext, absoluteStart, absoluteEnd);
    if (utf8Slice(
      sourceContext.canonical_text.text,
      span.absolute_start,
      span.absolute_end,
    ) !== spec.token) {
      fail('PARTY_TOKEN_SOURCE_DRIFT', 'a party observation no longer matches exact admitted bytes');
    }
    return {
      token_key: spec.token_key,
      token_digest: contentId('OBSERVED_PARTY_TOKEN/V1', spec.token),
      source_order_ordinal: sourceOrderOrdinal,
      token_span: span,
      allocation_status: spec.allocation_status,
      assigned_party_value: spec.assigned_party_value,
    };
  });
  const starts = observations.map((observation) => observation.token_span.absolute_start);
  if (canonicalJson(starts) !== canonicalJson([...starts].sort((a, b) => a - b))) {
    fail('PARTY_TOKEN_ORDER_DRIFT', 'the admitted Section 5.2 party-token order has drifted');
  }
  return observations;
}

function validateMetricIntent() {
  const metric = METRIC_DEFINITIONS.REPRESENTATION_ACCURACY_STANDARD;
  if (!metric
    || metric.metric_version !== 1
    || metric.concept_key !== 'COND-B-REP'
    || metric.required_claim_definition_key !== 'REPRESENTATION_ACCURACY_STANDARD'
    || metric.required_relationship_key !== 'BRINGS_DOWN') {
    fail('METRIC_INTENT_DRIFT', 'the future representation-accuracy metric contract has drifted');
  }
  return metric;
}

function validateReferenceComposition(slice) {
  if (slice.corpus_release_id !== null) {
    fail('RELEASE_REFERENCE_FORBIDDEN', 'the parser-bound review seed cannot bind a corpus release');
  }
  const [representation, condition] = slice.provisions;
  if (!representation
    || representation.concept_key !== 'REP-T-CAP'
    || representation.party?.value !== 'COMPANY'
    || !condition
    || condition.concept_key !== 'COND-B-REP'
    || condition.party?.value !== 'PARENT'
    || slice.components.length !== 5
    || slice.accuracyClaims.length !== 2
    || slice.relationships.length !== 2
    || slice.knowledgeClaims.length !== 5) {
    fail('REVIEWED_MAPPING_SHAPE_DRIFT', 'the reviewed QXO capitalisation mapping shape has drifted');
  }
  const tierBClaim = slice.accuracyClaims[0];
  const exceptionClaim = slice.exceptionClaim;
  const tierBRelationship = slice.relationships[0];
  const targetComponents = [slice.components[0], slice.components[2]];
  const withheldKnowledgeClaims = [slice.knowledgeClaims[0], slice.knowledgeClaims[2]];
  requireExact(
    tierBRelationship.target_occurrence_ids,
    targetComponents.map((component) => component.provision_component_id),
    'TIER_B_TARGET_DRIFT',
    'the Tier B relationship no longer targets exact capitalisation limbs (i) and (iii)',
  );
  if (tierBClaim.claim_definition_key !== 'REPRESENTATION_ACCURACY_STANDARD'
    || tierBClaim.canonical_value !== 'MAT_ALL_RESPECTS_DE_MINIMIS'
    || exceptionClaim.claim_definition_key !== 'REPRESENTATION_ACCURACY_EXCEPTION'
    || exceptionClaim.canonical_value !== 'DE_MINIMIS_INACCURACIES'
    || tierBRelationship.relationship_definition_key !== 'BRINGS_DOWN'
    || tierBRelationship.effect?.exception !== 'DE_MINIMIS_INACCURACIES') {
    fail('TIER_B_SEMANTIC_DRIFT', 'the reviewed Tier B claim, exception or relationship has drifted');
  }
  withheldKnowledgeClaims.forEach((claim, index) => {
    if (claim.claim_definition_key !== 'KNOWLEDGE_QUALIFIER'
      || claim.state !== 'ABSENT'
      || claim.subject_occurrence_id !== targetComponents[index].provision_component_id) {
      fail('WITHHELD_ABSENCE_DRIFT', 'the legacy limb-scoped knowledge reference has drifted');
    }
  });
  return {
    representation,
    condition,
    tierBClaim,
    exceptionClaim,
    tierBRelationship,
    targetComponents,
    withheldKnowledgeClaims,
  };
}

function validateDefinitionBinding({
  reviewedDefinitionGraphPackage,
  parserEnvelope,
  section52Parent,
  excerpts,
}) {
  const graph = reviewedDefinitionGraphPackage.validated_semantic_graph;
  const cues = graph.definition_cues.filter((cue) => cue.raw_term === 'De Minimis Inaccuracies');
  if (cues.length !== 1) {
    fail('DEFINITION_CUE_NOT_UNIQUE', 'one reviewed De Minimis Inaccuracies cue is required');
  }
  const cue = cues[0];
  const uses = graph.definition_use_cues.filter(
    (use) => use.definition_cue_id === cue.definition_cue_id,
  );
  if (uses.length !== 2) {
    fail('DEFINITION_USE_NOT_EXACT', 'the reviewed De Minimis Inaccuracies cue requires two exact uses');
  }
  const operativeUses = uses.filter((use) => use.use_role === 'OPERATIVE_REFERENCE');
  const declarationUses = uses.filter((use) => use.use_role === 'DECLARATION_REFERENCE');
  if (operativeUses.length !== 1
    || declarationUses.length !== 1
    || !contains(excerpts.tier_b, operativeUses[0].use_span)
    || declarationUses[0].use_span.semantic_span_id !== cue.term_span.semantic_span_id
    || !contains(excerpts.de_minimis_definition, cue.term_span)
    || !cue.body_spans.every((span) => contains(excerpts.de_minimis_definition, span))
    || !contains(section52Parent.evidence_anchor, cue.term_span)
    || !uses.every((use) => contains(section52Parent.evidence_anchor, use.use_span))) {
    fail('DEFINITION_GEOMETRY_DRIFT', 'the reviewed definition cue or use geometry has drifted');
  }
  const candidates = parserEnvelope.definition_candidates.filter(
    (candidate) => candidate.neutral_defined_term === 'De Minimis Inaccuracies'
      && candidate.parent_structural_section_proposal_id
        === section52Parent.admitted_structural_section_proposal_id,
  );
  if (candidates.length !== 1
    || !reviewedDefinitionGraphPackage.scoped_parser_definition_candidate_ids.includes(
      candidates[0].admitted_definition_candidate_id,
    )
    || !contains(candidates[0].evidence_anchor, cue.term_span)
    || !cue.body_spans.every((span) => contains(candidates[0].evidence_anchor, span))) {
    fail('DEFINITION_CANDIDATE_DRIFT', 'the reviewed definition is not bound to one exact parser candidate');
  }
  return {
    cue,
    operativeUse: operativeUses[0],
    declarationUse: declarationUses[0],
    candidate: candidates[0],
  };
}

function ensureResidualIsolation(parserEnvelope, governedSpans) {
  for (const residual of parserEnvelope.residuals) {
    if (!residual.evidence_anchor) {
      fail('UNBOUNDED_PARSER_RESIDUAL', 'a retained parser residual has no exact evidence anchor');
    }
    if (governedSpans.some((span) => overlaps(residual.evidence_anchor, span))) {
      fail('GOVERNED_EVIDENCE_RESIDUAL', 'a parser residual intersects required Tier B evidence');
    }
  }
}

function buildQxoTierBParserBoundReviewSeed(input = {}) {
  requireBridgeInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    inference_transcript_set_marker: inferenceTranscriptSetMarker,
    reviewed_candidate_dispositions: reviewedCandidateDispositions,
    governed_parent_section_proposal_ids: governedParentSectionProposalIds,
    reviewed_definition_graph_package: reviewedDefinitionGraphPackage,
    reviewed_capitalisation_slice: reviewedCapitalisationSlice,
  } = input;
  preflightParserResiduals(admittedParserProposalEnvelope);
  validateContractBundle(contractBundle);
  validateAdmittedSemanticSourceContext({
    context: admittedSourceContext,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: admittedSourceContext?.deal_admission_id,
    source_ordinal: admittedSourceContext?.source_ordinal,
  });
  if (admittedSourceContext.governed_deal_key !== DEAL_KEY) {
    fail('WRONG_GOVERNED_DEAL', 'the QXO Tier B bridge requires the governed QXO deal');
  }
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: admittedParserProposalEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  });
  validateReviewedDefinitionGraphPackage({
    reviewed_definition_graph_package: reviewedDefinitionGraphPackage,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    inference_transcript_set_marker: inferenceTranscriptSetMarker,
    reviewed_candidate_dispositions: reviewedCandidateDispositions,
    governed_parent_section_proposal_ids: governedParentSectionProposalIds,
  });
  try {
    validateQxoReviewedCapitalisationSlice({
      sourceContext: admittedSourceContext,
      contractBundle,
      slice: reviewedCapitalisationSlice,
    });
  } catch (error) {
    if (/reviewed QXO capitalisation mapping identity or source binding has drifted/i
      .test(error?.message || '')) {
      fail('REVIEWED_MAPPING_INVALID', 'the reviewed QXO capitalisation mapping is invalid');
    }
    throw error;
  }

  const composition = validateReferenceComposition(reviewedCapitalisationSlice);
  const section31Parent = requireUniqueParent({
    parserEnvelope: admittedParserProposalEnvelope,
    sectionNumber: '3.1',
    governedSpans: [
      reviewedCapitalisationSlice.spans.capital_structure,
      reviewedCapitalisationSlice.spans.limb_i,
      reviewedCapitalisationSlice.spans.limb_iii,
    ],
  });
  const section52Parent = requireUniqueParent({
    parserEnvelope: admittedParserProposalEnvelope,
    sectionNumber: '5.2',
    governedSpans: [
      reviewedCapitalisationSlice.spans.tier_b,
      reviewedCapitalisationSlice.spans.earlier_date,
      reviewedCapitalisationSlice.spans.de_minimis_definition,
    ],
  });
  requireExact(
    governedParentSectionProposalIds,
    [section52Parent.admitted_structural_section_proposal_id],
    'DEFINITION_PARENT_SCOPE_DRIFT',
    'the reviewed definition package must be scoped only to admitted Section 5.2',
  );
  const definition = validateDefinitionBinding({
    reviewedDefinitionGraphPackage,
    parserEnvelope: admittedParserProposalEnvelope,
    section52Parent,
    excerpts: reviewedCapitalisationSlice.excerpts,
  });
  const governedSpans = [
    reviewedCapitalisationSlice.spans.limb_i,
    reviewedCapitalisationSlice.spans.limb_iii,
    reviewedCapitalisationSlice.spans.tier_b,
    reviewedCapitalisationSlice.spans.earlier_date,
    reviewedCapitalisationSlice.spans.de_minimis_definition,
    definition.cue.term_span,
    ...definition.cue.body_spans,
    definition.operativeUse.use_span,
    definition.declarationUse.use_span,
  ];
  const metric = validateMetricIntent();
  const blockerCodes = [
    ...BLOCKER_CODES,
    ...(admittedParserProposalEnvelope.residuals.length > 0
      ? ['PARSER_RESIDUAL_RETAINED']
      : []),
  ].sort();
  const evidenceExcerptIds = [
    reviewedCapitalisationSlice.excerpts.limb_i,
    reviewedCapitalisationSlice.excerpts.limb_iii,
    reviewedCapitalisationSlice.excerpts.tier_b,
    reviewedCapitalisationSlice.excerpts.earlier_date,
    reviewedCapitalisationSlice.excerpts.de_minimis_definition,
  ].sort((left, right) => left.absolute_start - right.absolute_start)
    .map((excerpt) => excerpt.excerpt_id);
  const partyObservations = buildPartyObservations(
    admittedSourceContext,
    section52Parent.evidence_anchor,
  );
  ensureResidualIsolation(
    admittedParserProposalEnvelope,
    [
      ...governedSpans,
      ...partyObservations.map((observation) => observation.token_span),
    ],
  );

  const body = {
    schema_version: 'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED/V1',
    authority_scope: 'REVIEW_ONLY_REFERENCE_SEED',
    contract_binding: {
      schema_version: contractBundle.schema_version,
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
    },
    source_binding: {
      governed_deal_key: DEAL_KEY,
      deal_admission_id: admittedSourceContext.deal_admission_id,
      immutable_source_document_id: admittedSourceContext.immutable_source_document_id,
      source_admission_manifest_id: admittedSourceContext.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        admittedSourceContext.semantic_extraction_input_envelope_id,
      admitted_semantic_source_context_id:
        admittedSourceContext.admitted_semantic_source_context_id,
      document_hash: admittedSourceContext.document_hash,
      canonical_text_id: admittedSourceContext.canonical_text_id,
    },
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        admittedParserProposalEnvelope.admitted_parser_proposal_envelope_id,
      parser_runtime_manifest_id: admittedParserProposalEnvelope.parser_runtime_manifest_id,
      section_3_1_proposal_id:
        section31Parent.admitted_structural_section_proposal_id,
      section_5_2_proposal_id:
        section52Parent.admitted_structural_section_proposal_id,
      de_minimis_definition_candidate_id:
        definition.candidate.admitted_definition_candidate_id,
      retained_parser_residual_summary: {
        count: admittedParserProposalEnvelope.residuals.length,
        source_envelope_binding_digest: contentId(
          'QXO_TIER_B_RETAINED_PARSER_RESIDUAL_BINDING/V1',
          {
            admitted_parser_proposal_envelope_id:
              admittedParserProposalEnvelope.admitted_parser_proposal_envelope_id,
            admitted_parser_proposal_envelope_payload_digest:
              admittedParserProposalEnvelope.canonical_payload_digest,
            residual_count: admittedParserProposalEnvelope.residuals.length,
          },
        ),
        release_blocked: admittedParserProposalEnvelope.residuals.length > 0,
      },
    },
    reviewed_definition_binding: {
      reviewed_definition_graph_package_id:
        reviewedDefinitionGraphPackage.reviewed_definition_graph_package_id,
      validated_semantic_graph_id:
        reviewedDefinitionGraphPackage.validated_semantic_graph
          .validated_semantic_graph_id,
      definition_cue_id: definition.cue.definition_cue_id,
      operative_definition_use_cue_id:
        definition.operativeUse.definition_use_cue_id,
      declaration_definition_use_cue_id:
        definition.declarationUse.definition_use_cue_id,
      relationship_authority: 'NONE_PENDING_FREEZE_GATE',
      affected_reference_ids: [
        composition.exceptionClaim.claim_revision_id,
        composition.tierBRelationship.relationship_revision_id,
      ].sort(),
    },
    composition_binding: {
      reviewed_mapping_id:
        reviewedCapitalisationSlice.reviewed_mapping.reviewed_mapping_id,
      result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
      result_version: 1,
      concept_key: 'COND-B-REP',
      party: composition.condition.party,
      value_slot_key: 'CAPITALISATION_LIMBS_I_AND_III',
      ordinal: 0,
      representation_provision_instance_id:
        composition.representation.provision_instance_id,
      condition_provision_instance_id:
        composition.condition.provision_instance_id,
      accuracy_claim_revision_id: composition.tierBClaim.claim_revision_id,
      exception_claim_revision_id: composition.exceptionClaim.claim_revision_id,
      brings_down_relationship_revision_id:
        composition.tierBRelationship.relationship_revision_id,
      brings_down_effect_digest: contentId(
        'QXO_TIER_B_BRINGS_DOWN_EFFECT/V1',
        composition.tierBRelationship.effect,
      ),
      composition_scope_closure_id:
        composition.tierBRelationship.scope.scope_closure_id,
      ordered_target_component_ids: composition.targetComponents.map(
        (component) => component.provision_component_id,
      ),
      ordered_evidence_excerpt_ids: evidenceExcerptIds,
    },
    withheld_legacy_claim_references: composition.withheldKnowledgeClaims.map((claim) => ({
      claim_revision_id: claim.claim_revision_id,
      reason_code: 'ABSENCE_SCOPE_NOT_CERTIFIED',
    })),
    party_observations: partyObservations,
    intended_projection: {
      metric_key: metric.metric_key,
      metric_version: metric.metric_version,
      projection_status: 'FUTURE_GOVERNED_INTENT_ONLY',
    },
    status: {
      review_renderable: true,
      comparability_state: 'NOT_CERTIFIED',
      query_authority: 'NONE',
      cohort_authority: 'NONE',
      serving_projection_authority: 'NONE',
      release_eligible: false,
      failure_isolation: 'SUPPRESS_THIS_SEED_ONLY',
      blocker_codes: blockerCodes,
    },
  };
  const seed = freeze({
    ...body,
    qxo_tier_b_parser_bound_review_seed_id: contentId(
      'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  });
  if (Buffer.byteLength(canonicalJson(seed), 'utf8') > MAX_SEED_BYTES) {
    fail('SEED_LIMIT_EXCEEDED', 'the QXO Tier B parser-bound review seed exceeds 16 KiB');
  }
  return seed;
}

function validateQxoTierBParserBoundReviewSeed({
  qxo_tier_b_parser_bound_review_seed: seed,
  ...inputs
} = {}) {
  preflightSeed(seed);
  const expected = buildQxoTierBParserBoundReviewSeed(inputs);
  if (canonicalJson(seed) !== canonicalJson(expected)) {
    fail('SEED_IDENTITY_MISMATCH', 'the QXO Tier B parser-bound review seed has drifted');
  }
  return true;
}

function buildQxoTierBParserBoundReviewSeedIsolated(inputs) {
  try {
    return freeze({
      schema_version: 'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED_OUTCOME/V1',
      suppressed: false,
      failure_code: null,
      seed: buildQxoTierBParserBoundReviewSeed(inputs),
    });
  } catch (error) {
    if (!(error instanceof QxoTierBParserBridgeError)
      || !LOCALLY_SUPPRESSIBLE_CODES.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED_OUTCOME/V1',
      suppressed: true,
      failure_code: error.code,
      seed: null,
    });
  }
}

module.exports = {
  MAX_SEED_BYTES,
  QxoTierBParserBridgeError,
  buildQxoTierBParserBoundReviewSeed,
  buildQxoTierBParserBoundReviewSeedIsolated,
  findExactObservedPartyToken,
  validateQxoTierBParserBoundReviewSeed,
};
