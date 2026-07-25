const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  validateAdmittedParserProposalEnvelope,
} = require('./admitted-parser-proposal-adapter');
const { canonicalJson, contentId, utf8Slice } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
  validateValidatedDefinitionGraph,
} = require('./definition-graph');
const {
  buildQxoNoShopNestedDefinitionCandidateSupplement,
  validateQxoNoShopNestedDefinitionCandidateSupplement,
} = require('./qxo-no-shop-nested-definition-candidate-supplement');
const { buildSemanticSpan } = require('./source-structure');

const AUTHORITY_SCOPE = 'OFFLINE_REVIEWED_QXO_NO_SHOP_DEFINITION_GRAPH_F6_ONLY';
const DEAL_KEY = 'deal:qxo-topbuild';
const DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID = 'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const SOURCE_ORDINAL = 0;
const SUPPLEMENT_ID = 'd702bbf35f7e2b56777a26f01a456c4a940337bedeb50e5353f150afb920d458';
const SUPPLEMENT_PAYLOAD_DIGEST =
  '5386d3ec6245cff2491b9cb7439f652cad7826c1ed60f6c558320e2b70a543c2';
const MAX_INPUT_BYTES = 24 * 1024 * 1024;
const MAX_GRAPH_BYTES = 128 * 1024;
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
  'qxo_no_shop_nested_definition_candidate_supplement',
]);
const GRAPH_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'supplement_binding',
  'governed_dependency_scopes',
  'candidate_outcomes',
  'candidate_dispositions',
  'reviewed_use_bindings',
  'definition_dependency_outcomes',
  'definition_dependency_edges',
  'retained_use_residuals',
  'validated_semantic_graph',
  'status',
  'qxo_no_shop_reviewed_definition_graph_f6_id',
  'canonical_payload_digest',
]);

const DEFINITION_SPECS = Object.freeze([
  Object.freeze({
    definition_key: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
    neutral_defined_term: 'Acceptable Confidentiality Agreement',
    candidate_origin: 'ADMITTED_PARSER_PROPOSAL',
    candidate_id:
      'e48713ac2bd8cc73a4d5e4bcf54e67f185d897d8312a74d7859fa12ce78ed1d8',
    candidate_interval: Object.freeze({ start: 207255, end: 211570 }),
    candidate_digest:
      'f282dae973632d1de6eeb2a8cc770fa5fc31e90afb35870d5fa4a274e4c27134',
    term_interval: Object.freeze({ start: 207258, end: 207294 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 207304, end: 207782 }),
    ]),
    syntactic_role: 'NESTED_INLINE',
  }),
  Object.freeze({
    definition_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    neutral_defined_term: 'Confidentiality Agreement',
    candidate_origin: 'REVIEWED_SUPPLEMENT',
    candidate_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    candidate_id:
      '161201fd2e27f92d934e2a35fbaafaa550ae966374d9798f937b53d4d3527050',
    candidate_interval: Object.freeze({ start: 207459, end: 207582 }),
    candidate_digest:
      '70fa1ba774be5aa4ae7327286928dcdf36e405460589b08c43b685a265eb6987',
    term_interval: Object.freeze({ start: 207553, end: 207578 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 207463, end: 207544 }),
    ]),
    syntactic_role: 'POSTFIX_INLINE',
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    neutral_defined_term: 'Company Request',
    candidate_origin: 'REVIEWED_SUPPLEMENT',
    candidate_key: 'COMPANY_REQUEST',
    candidate_id:
      '78f91c744ec8362c25138bbece8972fc8ebef00c7c2ad04ed2187e1842bde662',
    candidate_interval: Object.freeze({ start: 208020, end: 208373 }),
    candidate_digest:
      '298225cd2d075847104fce92dcb2863b6af7d878086ef1117d4b72c7352e6f2b',
    term_interval: Object.freeze({ start: 208354, end: 208369 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 208020, end: 208349 }),
    ]),
    syntactic_role: 'POSTFIX_INLINE',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    neutral_defined_term: 'Company Acquisition Proposal',
    candidate_origin: 'ADMITTED_PARSER_PROPOSAL',
    candidate_id:
      'bab984074ef851403970c979625eef65f138b406215d9634bdd9b5a22e04a364',
    candidate_interval: Object.freeze({ start: 211570, end: 212829 }),
    candidate_digest:
      '576f544270a48c982dc2b52de954310341831d0c35b5a7283a6999440fdbf235',
    term_interval: Object.freeze({ start: 211573, end: 211601 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 211611, end: 212793 }),
    ]),
    syntactic_role: 'NESTED_INLINE',
  }),
  Object.freeze({
    definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    neutral_defined_term: 'Company Superior Proposal',
    candidate_origin: 'ADMITTED_PARSER_PROPOSAL',
    candidate_id:
      '81693f7e655a2bee80945f8a1eac37cb394d23848a05f53fe9330bf65c2a32e9',
    candidate_interval: Object.freeze({ start: 212829, end: 224303 }),
    candidate_digest:
      '82956f66900e31e8ffc8b2d9bef8a277fe0634f81c3717753d9fd87bcbe847ea',
    term_interval: Object.freeze({ start: 212832, end: 212857 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 212867, end: 214558 }),
    ]),
    syntactic_role: 'NESTED_INLINE',
  }),
  Object.freeze({
    definition_key: 'COMPANY_INTERVENING_EVENT',
    neutral_defined_term: 'Company Intervening Event',
    candidate_origin: 'ADMITTED_PARSER_PROPOSAL',
    candidate_id:
      '4998aaa3de686fc414a7ffbd23610da2fdfeb7df9b1871a7aaa1def37ef4ce98',
    candidate_interval: Object.freeze({ start: 224303, end: 226861 }),
    candidate_digest:
      '7639e64c35553c3d3c87eed01a7e4356c533de697bf55a6eecd7765bef2e96d0',
    term_interval: Object.freeze({ start: 224306, end: 224331 }),
    body_intervals: Object.freeze([
      Object.freeze({ start: 224341, end: 225387 }),
    ]),
    syntactic_role: 'NESTED_INLINE',
  }),
]);

const USE_SPECS = Object.freeze([
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 205797, end: 205825 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_ELIGIBILITY']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 206091, end: 206119 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_ELIGIBILITY']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    interval: Object.freeze({ start: 206179, end: 206204 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_ELIGIBILITY']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 206277, end: 206305 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_ELIGIBILITY']),
  }),
  Object.freeze({
    definition_key: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
    interval: Object.freeze({ start: 206555, end: 206591 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_FURNISHING_CONDITION']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 206721, end: 206749 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_FURNISHING_OBJECT']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 207113, end: 207141 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_DISCUSSION_OBJECT']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 207157, end: 207185 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['EXCEPTION_DISCUSSION_OBJECT']),
  }),
  Object.freeze({
    definition_key: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
    interval: Object.freeze({ start: 207258, end: 207294 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
  Object.freeze({
    definition_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    interval: Object.freeze({ start: 207463, end: 207488 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['NESTED_DEFINITION_DEPENDENCY']),
  }),
  Object.freeze({
    definition_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    interval: Object.freeze({ start: 207553, end: 207578 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 207988, end: 208016 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 208321, end: 208349 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze([
      'COMPLETE_NOTICE_TRIGGER',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    interval: Object.freeze({ start: 208354, end: 208369 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 208505, end: 208533 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    interval: Object.freeze({ start: 208541, end: 208556 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 208759, end: 208787 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_COPY_DUTY']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 208830, end: 208858 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_COPY_DUTY']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 211573, end: 211601 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    interval: Object.freeze({ start: 212832, end: 212857 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 212900, end: 212928 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze([
      'EXCEPTION_ELIGIBILITY_TRANSITIVE',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 213708, end: 213736 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze([
      'EXCEPTION_ELIGIBILITY_TRANSITIVE',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 214004, end: 214032 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze([
      'EXCEPTION_ELIGIBILITY_TRANSITIVE',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    interval: Object.freeze({ start: 214097, end: 214125 }),
    use_role: 'OPERATIVE_REFERENCE',
    purpose_codes: Object.freeze([
      'EXCEPTION_ELIGIBILITY_TRANSITIVE',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_INTERVENING_EVENT',
    interval: Object.freeze({ start: 224306, end: 224331 }),
    use_role: 'DECLARATION_REFERENCE',
    purpose_codes: Object.freeze(['DECLARATION']),
  }),
]);

const RESIDUAL_SPECS = Object.freeze([
  Object.freeze({
    residual_code: 'INFLECTED_DEFINITION_USE_UNMAPPED',
    definition_key: 'COMPANY_REQUEST',
    interval: Object.freeze({ start: 208683, end: 208699 }),
    expected_text: 'Company Requests',
    purpose_codes: Object.freeze(['COMPLETE_NOTICE_COPY_DUTY']),
    publication_effect: 'BLOCK_DEPENDENT_RESULT_ONLY',
  }),
]);

const DEPENDENCY_SCOPE_SPECS = Object.freeze([
  Object.freeze({
    scope_key: 'EXCEPTION',
    interval: Object.freeze({ start: 205454, end: 207783 }),
  }),
  Object.freeze({
    scope_key: 'FIRST_SENTENCE_NOTICE',
    interval: Object.freeze({ start: 207783, end: 208859 }),
  }),
]);

const DEPENDENCY_SPECS = Object.freeze([
  Object.freeze({
    container_definition_key: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
    referenced_definition_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    use_interval: Object.freeze({ start: 207463, end: 207488 }),
  }),
  Object.freeze({
    container_definition_key: 'COMPANY_REQUEST',
    referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    use_interval: Object.freeze({ start: 208321, end: 208349 }),
  }),
  Object.freeze({
    container_definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    use_interval: Object.freeze({ start: 212900, end: 212928 }),
  }),
  Object.freeze({
    container_definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    use_interval: Object.freeze({ start: 213708, end: 213736 }),
  }),
  Object.freeze({
    container_definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    use_interval: Object.freeze({ start: 214004, end: 214032 }),
  }),
  Object.freeze({
    container_definition_key: 'COMPANY_SUPERIOR_PROPOSAL',
    referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    use_interval: Object.freeze({ start: 214097, end: 214125 }),
  }),
]);

class QxoNoShopReviewedDefinitionGraphF6Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopReviewedDefinitionGraphF6Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopReviewedDefinitionGraphF6Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function boundedCanonicalBytes(value, maximum, code, message) {
  let encoded;
  try {
    encoded = canonicalJson(value);
  } catch (_) {
    fail(code, message);
  }
  if (Buffer.byteLength(encoded, 'utf8') > maximum) fail(code, message);
}

function preflightInput(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('GRAPH_INPUT_CONTRACT_MISMATCH', 'the F6 definition graph input is outside its closed contract');
  }
  boundedCanonicalBytes(
    input.admitted_parser_proposal_envelope,
    MAX_INPUT_BYTES,
    'GRAPH_INPUT_LIMIT_EXCEEDED',
    'the admitted parser proposal envelope exceeds the graph input limit',
  );
}

function validateSourceLineage(source, contractBundle) {
  if (source.governed_deal_key !== DEAL_KEY
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || source.source_ordinal !== SOURCE_ORDINAL
    || source.canonical_text?.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== Buffer.byteLength(
      source.canonical_text.text,
      'utf8',
    )) {
    fail('SOURCE_LINEAGE_DRIFT', 'the admitted QXO source lineage has drifted');
  }
  const expectedDealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id: source.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  if (source.deal_admission_id !== expectedDealAdmissionId) {
    fail('DEAL_ADMISSION_DRIFT', 'the QXO deal admission is not bound to F6');
  }
}

function span(source, interval, expectedText, label) {
  const built = buildSemanticSpan(source, interval.start, interval.end);
  const exactText = utf8Slice(
    source.canonical_text.text,
    interval.start,
    interval.end,
  );
  if (expectedText !== undefined && exactText !== expectedText) {
    fail('SOURCE_GEOMETRY_DRIFT', `${label} source bytes have drifted`);
  }
  return built;
}

function candidateReferences(parserEnvelope, supplement) {
  return DEFINITION_SPECS.map((spec) => {
    try {
      const candidate = spec.candidate_origin === 'ADMITTED_PARSER_PROPOSAL'
        ? parserEnvelope.definition_candidates.find(
          (entry) => entry.admitted_definition_candidate_id === spec.candidate_id,
        )
        : supplement.supplemental_definition_candidates.find(
          (entry) => entry.reviewed_supplemental_definition_candidate_id
            === spec.candidate_id,
        );
      const anchor = candidate?.evidence_anchor;
      const neutralTerm = candidate?.neutral_defined_term;
      if (!candidate
        || neutralTerm !== spec.neutral_defined_term
        || anchor.absolute_start !== spec.candidate_interval.start
        || anchor.absolute_end !== spec.candidate_interval.end
        || anchor.exact_bytes_digest !== spec.candidate_digest) {
        fail('CANDIDATE_BINDING_DRIFT', `${spec.definition_key} candidate binding has drifted`);
      }
      if (spec.candidate_origin === 'REVIEWED_SUPPLEMENT'
        && candidate.candidate_key !== spec.candidate_key) {
        fail('CANDIDATE_BINDING_DRIFT', `${spec.definition_key} supplemental key has drifted`);
      }
      return { spec, candidate, failure_code: null };
    } catch (error) {
      return {
        spec,
        candidate: null,
        failure_code: error?.code || 'CANDIDATE_BINDING_DRIFT',
      };
    }
  });
}

function buildCandidateDisposition(spec, candidate, definitionCue) {
  const body = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_DEFINITION_DISPOSITION_F6/V1',
    definition_key: spec.definition_key,
    candidate_origin: spec.candidate_origin,
    candidate_id: spec.candidate_id,
    candidate_neutral_proposition_digest: candidate.neutral_proposition_digest,
    candidate_evidence_anchor_id: candidate.evidence_anchor.semantic_span_id,
    governed_ordinal: spec.term_interval.start,
    disposition_code: 'ACCEPTED_DEFINITION_CUE',
    review_reason_code: 'SOURCE_BACKED_SYNTACTIC_DEFINITION',
    definition_cue_id: definitionCue.definition_cue_id,
    term_span_id: definitionCue.term_span_id,
    body_span_ids: definitionCue.body_span_ids,
  };
  return freeze({
    ...body,
    qxo_no_shop_reviewed_definition_disposition_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_DISPOSITION_F6/V1',
      body,
    ),
  });
}

function buildCandidateOutcome(spec, disposition, failureCode) {
  const suppressed = Boolean(failureCode);
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_CANDIDATE_OUTCOME_F6/V1',
    definition_key: spec.definition_key,
    candidate_origin: spec.candidate_origin,
    candidate_id: spec.candidate_id,
    governed_ordinal: spec.term_interval.start,
    suppressed,
    failure_code: failureCode || null,
    reviewed_definition_disposition_id: suppressed
      ? null
      : disposition.qxo_no_shop_reviewed_definition_disposition_f6_id,
    definition_cue_id: suppressed ? null : disposition.definition_cue_id,
  };
  return freeze({
    ...body,
    qxo_no_shop_definition_candidate_outcome_f6_id: contentId(
      'QXO_NO_SHOP_DEFINITION_CANDIDATE_OUTCOME_F6/V1',
      body,
    ),
  });
}

function buildReviewedUseBinding(spec, useCue) {
  const body = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_DEFINITION_USE_BINDING_F6/V1',
    definition_key: spec.definition_key,
    definition_use_cue_id: useCue.definition_use_cue_id,
    absolute_start: useCue.use_span.absolute_start,
    absolute_end: useCue.use_span.absolute_end,
    exact_bytes_digest: useCue.use_span.exact_bytes_digest,
    observed_form_code: 'EXACT_CANONICAL_TERM',
    inventory_scope: spec.use_role === 'DECLARATION_REFERENCE'
      ? 'DECLARATION_COMPLETE'
      : 'DEPENDENCY_SCOPED',
    absence_authority: 'NONE',
    purpose_codes: [...spec.purpose_codes],
  };
  return freeze({
    ...body,
    qxo_no_shop_reviewed_definition_use_binding_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_USE_BINDING_F6/V1',
      body,
    ),
  });
}

function buildDependencyOutcome(spec, edge, failureCode) {
  const suppressed = Boolean(failureCode);
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_DEPENDENCY_OUTCOME_F6/V1',
    governed_ordinal: spec.use_interval.start,
    container_definition_key: spec.container_definition_key,
    referenced_definition_key: spec.referenced_definition_key,
    suppressed,
    failure_code: failureCode || null,
    definition_dependency_edge_id: suppressed
      ? null
      : edge.qxo_no_shop_definition_dependency_edge_f6_id,
  };
  return freeze({
    ...body,
    qxo_no_shop_definition_dependency_outcome_f6_id: contentId(
      'QXO_NO_SHOP_DEFINITION_DEPENDENCY_OUTCOME_F6/V1',
      body,
    ),
  });
}

function validateCarrierIdentity(graph) {
  if (!exactKeys(graph, GRAPH_KEYS)
    || graph.schema_version !== 'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1') {
    fail('GRAPH_CONTRACT_MISMATCH', 'the F6 definition graph carrier is invalid');
  }
  boundedCanonicalBytes(
    graph,
    MAX_GRAPH_BYTES,
    'GRAPH_LIMIT_EXCEEDED',
    'the F6 definition graph exceeds its byte limit',
  );
  const body = { ...graph };
  delete body.qxo_no_shop_reviewed_definition_graph_f6_id;
  delete body.canonical_payload_digest;
  if (graph.qxo_no_shop_reviewed_definition_graph_f6_id
      !== contentId('QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1', body)
    || graph.canonical_payload_digest !== contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6_PAYLOAD/V1',
      body,
    )) {
    fail('GRAPH_IDENTITY_MISMATCH', 'the F6 definition graph identity has drifted');
  }
  return true;
}

function buildGraph(input = {}, forcedFailureDefinitionKey = null) {
  preflightInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: source,
    admitted_parser_proposal_envelope: parserEnvelope,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  } = input;
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    fail('WRONG_CONTRACT', 'the exact frozen F6 contract is required');
  }
  validateSourceLineage(source, contractBundle);
  validateAdmittedSemanticSourceContext({
    context: source,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: source.deal_admission_id,
    source_ordinal: SOURCE_ORDINAL,
  });
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: parserEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: source,
  });
  const supplementInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: source,
    admitted_parser_proposal_envelope: parserEnvelope,
  };
  validateQxoNoShopNestedDefinitionCandidateSupplement({
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
    ...supplementInputs,
  });
  const expectedSupplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  if (supplement.qxo_no_shop_nested_definition_candidate_supplement_id
      !== SUPPLEMENT_ID
    || supplement.canonical_payload_digest !== SUPPLEMENT_PAYLOAD_DIGEST
    || canonicalJson(supplement) !== canonicalJson(expectedSupplement)) {
    fail('SUPPLEMENT_BINDING_DRIFT', 'the exact reviewed F6 supplement is required');
  }

  if (forcedFailureDefinitionKey !== null
    && !DEFINITION_SPECS.some(
      (spec) => spec.definition_key === forcedFailureDefinitionKey,
    )) {
    fail('UNKNOWN_FORCED_FAILURE', 'the failure-isolation definition key is unknown');
  }
  const references = candidateReferences(parserEnvelope, supplement);
  const cueByDefinition = new Map();
  const dispositions = [];
  const candidateOutcomes = references.map(({ spec, candidate, failure_code: referenceFailure }) => {
    let failureCode = forcedFailureDefinitionKey === spec.definition_key
      ? 'ATTESTED_CANDIDATE_FAILURE'
      : referenceFailure;
    let disposition = null;
    if (!failureCode) {
      try {
        const termSpan = span(
          source,
          spec.term_interval,
          spec.neutral_defined_term,
          `${spec.definition_key} term`,
        );
        const bodySpans = spec.body_intervals.map(
          (interval) => span(source, interval, undefined, `${spec.definition_key} body`),
        );
        if (termSpan.absolute_start < candidate.evidence_anchor.absolute_start
          || termSpan.absolute_end > candidate.evidence_anchor.absolute_end
          || bodySpans.some((bodySpan) => (
            bodySpan.absolute_start < candidate.evidence_anchor.absolute_start
            || bodySpan.absolute_end > candidate.evidence_anchor.absolute_end
          ))) {
          fail(
            'CANDIDATE_GEOMETRY_ESCAPE',
            `${spec.definition_key} geometry escapes its candidate`,
          );
        }
        const cue = buildDefinitionCue({
          source,
          termSpan,
          bodySpans,
          rawTerm: spec.neutral_defined_term,
          syntacticRole: spec.syntactic_role,
          ordinal: spec.term_interval.start,
        });
        disposition = buildCandidateDisposition(spec, candidate, cue);
        cueByDefinition.set(spec.definition_key, cue);
        dispositions.push(disposition);
      } catch (error) {
        failureCode = error?.code || 'CANDIDATE_REVIEW_FAILED';
      }
    }
    return buildCandidateOutcome(spec, disposition, failureCode);
  });

  const useCues = [];
  const reviewedUseBindings = [];
  for (const spec of USE_SPECS) {
    const definitionCue = cueByDefinition.get(spec.definition_key);
    if (!definitionCue) continue;
    const useSpan = span(
      source,
      spec.interval,
      definitionCue.raw_term,
      `${spec.definition_key} use`,
    );
    const useCue = buildDefinitionUseCue({
      source,
      definitionCue,
      useSpan,
      useRole: spec.use_role,
      ordinal: spec.interval.start,
    });
    useCues.push(useCue);
    reviewedUseBindings.push(buildReviewedUseBinding(spec, useCue));
  }
  for (const [definitionKey, definitionCue] of cueByDefinition) {
    const declarationUses = useCues.filter((useCue) => (
      useCue.definition_cue_id === definitionCue.definition_cue_id
      && useCue.use_role === 'DECLARATION_REFERENCE'
    ));
    if (declarationUses.length !== 1
      || declarationUses[0].use_span_id !== definitionCue.term_span_id) {
      fail(
        'DECLARATION_USE_INCOMPLETE',
        `${definitionKey} requires exactly one declaration reference`,
      );
    }
  }

  const validatedGraph = buildValidatedDefinitionGraph({
    source,
    definitionCues: [...cueByDefinition.values()],
    definitionUseCues: useCues,
  });
  validateValidatedDefinitionGraph({ source, graph: validatedGraph });
  const useByCoordinates = new Map(useCues.map((useCue) => [
    `${useCue.use_span.absolute_start}:${useCue.use_span.absolute_end}`,
    useCue,
  ]));
  const dependencyEdges = [];
  const dependencyOutcomes = DEPENDENCY_SPECS.map((spec) => {
    const containerCue = cueByDefinition.get(spec.container_definition_key);
    const referencedCue = cueByDefinition.get(spec.referenced_definition_key);
    const referencedUse = useByCoordinates.get(
      `${spec.use_interval.start}:${spec.use_interval.end}`,
    );
    if (!containerCue || !referencedCue
      || referencedUse?.definition_cue_id !== referencedCue.definition_cue_id) {
      return buildDependencyOutcome(
        spec,
        null,
        'DEPENDENT_DEFINITION_SUPPRESSED',
      );
    }
    if (!containerCue.body_spans.some((bodySpan) => (
      referencedUse.use_span.absolute_start >= bodySpan.absolute_start
      && referencedUse.use_span.absolute_end <= bodySpan.absolute_end
    ))) {
      fail(
        'DEFINITION_DEPENDENCY_GEOMETRY_DRIFT',
        'a nested definition dependency escapes its container body',
      );
    }
    const body = {
      schema_version: 'QXO_NO_SHOP_DEFINITION_DEPENDENCY_EDGE_F6/V1',
      governed_ordinal: spec.use_interval.start,
      container_definition_key: spec.container_definition_key,
      container_definition_cue_id: containerCue.definition_cue_id,
      referenced_definition_key: spec.referenced_definition_key,
      referenced_definition_cue_id: referencedCue.definition_cue_id,
      referenced_definition_use_cue_id: referencedUse.definition_use_cue_id,
    };
    const edge = freeze({
      ...body,
      qxo_no_shop_definition_dependency_edge_f6_id: contentId(
        'QXO_NO_SHOP_DEFINITION_DEPENDENCY_EDGE_F6/V1',
        body,
      ),
    });
    dependencyEdges.push(edge);
    return buildDependencyOutcome(spec, edge, null);
  });
  const residuals = RESIDUAL_SPECS.map((spec) => {
    const evidenceSpan = span(
      source,
      spec.interval,
      spec.expected_text,
      spec.residual_code,
    );
    const body = {
      schema_version: 'QXO_NO_SHOP_DEFINITION_USE_RESIDUAL_F6/V1',
      governed_ordinal: spec.interval.start,
      residual_code: spec.residual_code,
      definition_key: spec.definition_key,
      observed_text: spec.expected_text,
      evidence_span: evidenceSpan,
      purpose_codes: [...spec.purpose_codes],
      state: 'PENDING_GOVERNED_USE_NORMALISATION',
      publication_effect: spec.publication_effect,
      semantic_impact_code: 'BLOCKS_COMPLETE_NOTICE_DEFINITION_USE_CLOSURE',
      dependent_result_keys: ['NO_SHOP_COMPLETE_NOTICE'],
      absence_authority: 'NONE',
    };
    return freeze({
      ...body,
      qxo_no_shop_definition_use_residual_f6_id: contentId(
        'QXO_NO_SHOP_DEFINITION_USE_RESIDUAL_F6/V1',
        body,
      ),
    });
  });
  const governedDependencyScopes = DEPENDENCY_SCOPE_SPECS.map((spec) => ({
    scope_key: spec.scope_key,
    evidence_span: span(source, spec.interval, undefined, spec.scope_key),
    inventory_scope: 'DEPENDENCY_SCOPED',
  }));

  const candidateDispositionComplete = candidateOutcomes.every(
    (outcome) => !outcome.suppressed,
  );
  const body = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
    },
    source_binding: {
      governed_deal_key: DEAL_KEY,
      deal_admission_id: source.deal_admission_id,
      immutable_source_document_id: source.immutable_source_document_id,
      source_admission_manifest_id: source.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        source.semantic_extraction_input_envelope_id,
      admitted_semantic_source_context_id:
        source.admitted_semantic_source_context_id,
      document_hash: source.document_hash,
      canonical_text_id: source.canonical_text_id,
      source_ordinal: source.source_ordinal,
    },
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        parserEnvelope.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        parserEnvelope.canonical_payload_digest,
      parser_runtime_manifest_id: parserEnvelope.parser_runtime_manifest_id,
      parser_candidates_mutated: false,
      retained_parser_residual_ids: parserEnvelope.residuals
        .map((residual) => residual.admitted_parser_residual_id)
        .sort(),
    },
    supplement_binding: {
      qxo_no_shop_nested_definition_candidate_supplement_id:
        supplement.qxo_no_shop_nested_definition_candidate_supplement_id,
      canonical_payload_digest: supplement.canonical_payload_digest,
      supplemental_candidates_mutated: false,
    },
    governed_dependency_scopes: governedDependencyScopes,
    candidate_outcomes: candidateOutcomes,
    candidate_dispositions: dispositions,
    reviewed_use_bindings: reviewedUseBindings,
    definition_dependency_outcomes: dependencyOutcomes,
    definition_dependency_edges: dependencyEdges,
    retained_use_residuals: residuals,
    validated_semantic_graph: validatedGraph,
    status: {
      definition_candidate_dispositions_complete: candidateDispositionComplete,
      governed_dependency_use_inventory_complete: false,
      dependency_scoped_use_inventory: true,
      absence_authority: 'NONE',
      unresolved_use_residual_count: residuals.length,
      review_source_graph_authority: 'EXACT_SOURCE_ONLY',
      definition_graph_authority: 'NONE',
      canonical_write_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      review_renderable: cueByDefinition.size > 0,
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        ...candidateDispositionComplete
          ? []
          : ['DEFINITION_CANDIDATE_OUTCOME_SUPPRESSED'],
        'INFLECTED_COMPANY_REQUEST_USE_REQUIRES_GOVERNED_NORMALISATION',
        'F6_EXCEPTION_SOURCE_BINDING_DEFERRED',
        'F6_COMPLETE_NOTICE_SOURCE_BINDING_DEFERRED',
        'F6_RESULT_DEFINITION_DEFERRED',
      ],
    },
  };
  const graph = freeze({
    ...body,
    qxo_no_shop_reviewed_definition_graph_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(graph);
  return graph;
}

function buildQxoNoShopReviewedDefinitionGraphF6(input = {}) {
  return buildGraph(input, null);
}

function buildQxoNoShopReviewedDefinitionGraphF6FailureIsolationAttestation(
  input = {},
  definitionKey,
) {
  return buildGraph(input, definitionKey);
}

function validateQxoNoShopReviewedDefinitionGraphF6({
  qxo_no_shop_reviewed_definition_graph_f6: graph,
  ...input
} = {}) {
  validateCarrierIdentity(graph);
  const expected = buildQxoNoShopReviewedDefinitionGraphF6(input);
  if (canonicalJson(graph) !== canonicalJson(expected)) {
    fail('GRAPH_IDENTITY_MISMATCH', 'the F6 definition graph has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  DEFINITION_SPECS,
  DEPENDENCY_SCOPE_SPECS,
  DEPENDENCY_SPECS,
  MAX_GRAPH_BYTES,
  QxoNoShopReviewedDefinitionGraphF6Error,
  RESIDUAL_SPECS,
  USE_SPECS,
  buildQxoNoShopReviewedDefinitionGraphF6,
  buildQxoNoShopReviewedDefinitionGraphF6FailureIsolationAttestation,
  validateQxoNoShopReviewedDefinitionGraphF6,
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity:
    validateCarrierIdentity,
};
