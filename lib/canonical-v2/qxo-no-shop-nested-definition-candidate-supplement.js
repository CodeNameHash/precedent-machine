const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  validateAdmittedParserProposalEnvelope,
} = require('./admitted-parser-proposal-adapter');
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const { buildSemanticSpan } = require('./source-structure');

const AUTHORITY_SCOPE = 'OFFLINE_REVIEWED_QXO_NESTED_DEFINITION_CANDIDATES_ONLY';
const DEAL_KEY = 'deal:qxo-topbuild';
const DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID = 'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const SOURCE_ORDINAL = 0;
const SECTION_4_3_INTERVAL = Object.freeze({ start: 201370, end: 226862 });
const SECTION_4_3_SHA256 = 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524';
const MAX_INPUT_BYTES = 24 * 1024 * 1024;
const MAX_SUPPLEMENT_BYTES = 16 * 1024;
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
]);
const SUPPLEMENT_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'supplemental_definition_candidates',
  'status',
  'qxo_no_shop_nested_definition_candidate_supplement_id',
  'canonical_payload_digest',
]);
const CANDIDATE_SPECS = Object.freeze([
  Object.freeze({
    candidate_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
    neutral_defined_term: 'Confidentiality Agreement',
    evidence_interval: Object.freeze({ start: 207459, end: 207582 }),
    expected_text:
      'the Confidentiality Agreement, dated February 9, 2026, between the Company and Parent (the “Confidentiality Agreement”)',
    discovery_reason_code: 'MISSED_NESTED_POSTFIX_DEFINITION',
  }),
  Object.freeze({
    candidate_key: 'COMPANY_REQUEST',
    neutral_defined_term: 'Company Request',
    evidence_interval: Object.freeze({ start: 208020, end: 208373 }),
    expected_text:
      'request for nonpublic information relating to the Company or any Subsidiary of the Company or for access to the properties, books or records of the Company or any Subsidiary of the Company that, in the Company Board’s good faith judgment, would reasonably be expected to give rise to or result in a Company Acquisition Proposal (“Company Request”)',
    discovery_reason_code: 'MISSED_POSTFIX_DEFINITION',
  }),
]);

class QxoNoShopNestedDefinitionCandidateSupplementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNestedDefinitionCandidateSupplementError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNestedDefinitionCandidateSupplementError(code, message);
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
  if (Buffer.byteLength(encoded, 'utf8') > maximum) {
    fail(code, message);
  }
}

function preflightInput(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail(
      'SUPPLEMENT_INPUT_CONTRACT_MISMATCH',
      'the QXO nested-definition supplement input is outside its closed contract',
    );
  }
  boundedCanonicalBytes(
    input.admitted_parser_proposal_envelope,
    MAX_INPUT_BYTES,
    'SUPPLEMENT_INPUT_LIMIT_EXCEEDED',
    'the admitted parser proposal envelope exceeds the supplement input limit',
  );
}

function requireSectionParent(parserEnvelope) {
  const matches = parserEnvelope.structural_section_proposals.filter((proposal) => (
    proposal.section_number === '4.3'
    && proposal.section_title === 'No Solicitation by the Company'
  ));
  if (matches.length !== 1) {
    fail('PARSER_PARENT_NOT_UNIQUE', 'one exact Section 4.3 parser parent is required');
  }
  const [parent] = matches;
  if (parent.evidence_anchor.absolute_start !== SECTION_4_3_INTERVAL.start
    || parent.evidence_anchor.absolute_end !== SECTION_4_3_INTERVAL.end
    || parent.evidence_anchor.exact_bytes_digest !== SECTION_4_3_SHA256) {
    fail('PARSER_PARENT_SOURCE_DRIFT', 'the Section 4.3 parser parent has drifted');
  }
  return parent;
}

function exactSourceText(sourceContext, interval) {
  return Buffer.from(sourceContext.canonical_text.text, 'utf8')
    .subarray(interval.start, interval.end)
    .toString('utf8');
}

function ensureCandidateIsMissing(parserEnvelope, parent, spec) {
  const duplicates = parserEnvelope.definition_candidates.filter((candidate) => (
    candidate.parent_structural_section_proposal_id
      === parent.admitted_structural_section_proposal_id
    && candidate.neutral_defined_term === spec.neutral_defined_term
    && candidate.evidence_anchor.absolute_start <= spec.evidence_interval.start
    && candidate.evidence_anchor.absolute_end >= spec.evidence_interval.end
  ));
  if (duplicates.length) {
    fail(
      'SUPPLEMENT_NO_LONGER_REQUIRED',
      `the parser already emits the exact ${spec.neutral_defined_term} candidate`,
    );
  }
}

function buildCandidate(sourceContext, parent, spec, governedOrdinal) {
  if (exactSourceText(sourceContext, spec.evidence_interval) !== spec.expected_text) {
    fail(
      'SUPPLEMENT_SOURCE_DRIFT',
      `the reviewed ${spec.neutral_defined_term} source bytes have drifted`,
    );
  }
  const evidenceAnchor = buildSemanticSpan(
    sourceContext,
    spec.evidence_interval.start,
    spec.evidence_interval.end,
  );
  const neutralPropositionDigest = contentId(
    'DEFINITION_CANDIDATE_NEUTRAL_PROPOSITION/V1',
    {
      neutral_defined_term: spec.neutral_defined_term,
      evidence_anchor: evidenceAnchor.semantic_span_id,
    },
  );
  const body = {
    schema_version: 'REVIEWED_SUPPLEMENTAL_DEFINITION_CANDIDATE/V1',
    proposal_kind: 'DEFINITION_CANDIDATE',
    candidate_key: spec.candidate_key,
    admitted_semantic_source_context_id:
      sourceContext.admitted_semantic_source_context_id,
    source_admission_manifest_id: sourceContext.source_admission_manifest_id,
    parent_structural_section_proposal_id:
      parent.admitted_structural_section_proposal_id,
    governed_ordinal: governedOrdinal,
    neutral_proposition_digest: neutralPropositionDigest,
    neutral_defined_term: spec.neutral_defined_term,
    discovery_reason_code: spec.discovery_reason_code,
    evidence_anchor: evidenceAnchor,
    parser_runtime_authority: 'NONE',
    reviewed_disposition_required: true,
  };
  return freeze({
    ...body,
    reviewed_supplemental_definition_candidate_id: contentId(
      'REVIEWED_SUPPLEMENTAL_DEFINITION_CANDIDATE/V1',
      body,
    ),
  });
}

function validateCarrierIdentity(supplement) {
  if (!exactKeys(supplement, SUPPLEMENT_KEYS)
    || supplement.schema_version
      !== 'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1') {
    fail('SUPPLEMENT_CONTRACT_MISMATCH', 'the nested-definition supplement carrier is invalid');
  }
  boundedCanonicalBytes(
    supplement,
    MAX_SUPPLEMENT_BYTES,
    'SUPPLEMENT_LIMIT_EXCEEDED',
    'the nested-definition supplement exceeds its byte limit',
  );
  const body = { ...supplement };
  delete body.qxo_no_shop_nested_definition_candidate_supplement_id;
  delete body.canonical_payload_digest;
  if (supplement.qxo_no_shop_nested_definition_candidate_supplement_id
      !== contentId('QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1', body)
    || supplement.canonical_payload_digest
      !== contentId(
        'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT_PAYLOAD/V1',
        body,
      )) {
    fail('SUPPLEMENT_IDENTITY_MISMATCH', 'the nested-definition supplement identity has drifted');
  }
  return true;
}

function buildQxoNoShopNestedDefinitionCandidateSupplement(input = {}) {
  preflightInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: parserEnvelope,
  } = input;
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    fail('WRONG_CONTRACT', 'the QXO nested-definition supplement requires the exact F6 contract');
  }
  if (admittedSourceContext.governed_deal_key !== DEAL_KEY
    || admittedSourceContext.document_hash !== DOCUMENT_HASH
    || admittedSourceContext.canonical_text_id !== CANONICAL_TEXT_ID
    || admittedSourceContext.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || admittedSourceContext.source_ordinal !== SOURCE_ORDINAL
    || admittedSourceContext.canonical_text?.canonical_text_id !== CANONICAL_TEXT_ID
    || admittedSourceContext.canonical_text_byte_length !== Buffer.byteLength(
      admittedSourceContext.canonical_text.text,
      'utf8',
    )) {
    fail('SOURCE_LINEAGE_DRIFT', 'the admitted QXO source lineage has drifted');
  }
  const expectedDealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      admittedSourceContext.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  if (admittedSourceContext.deal_admission_id !== expectedDealAdmissionId) {
    fail('DEAL_ADMISSION_DRIFT', 'the QXO deal admission is not bound to the F6 contract');
  }
  validateAdmittedSemanticSourceContext({
    context: admittedSourceContext,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: admittedSourceContext.deal_admission_id,
    source_ordinal: admittedSourceContext.source_ordinal,
  });
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: parserEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  });
  const sectionParent = requireSectionParent(parserEnvelope);
  const supplementalCandidates = CANDIDATE_SPECS.map((spec, governedOrdinal) => {
    ensureCandidateIsMissing(parserEnvelope, sectionParent, spec);
    return buildCandidate(admittedSourceContext, sectionParent, spec, governedOrdinal);
  });
  const body = {
    schema_version: 'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
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
        parserEnvelope.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        parserEnvelope.canonical_payload_digest,
      parser_runtime_manifest_id: parserEnvelope.parser_runtime_manifest_id,
      section_4_3_proposal_id:
        sectionParent.admitted_structural_section_proposal_id,
      parser_runtime_candidate_count: parserEnvelope.definition_candidates.length,
      parser_runtime_candidates_mutated: false,
    },
    supplemental_definition_candidates: supplementalCandidates,
    status: {
      source_reference_complete: true,
      reviewed_disposition_complete: false,
      definition_graph_authority: 'NONE',
      parser_runtime_authority: 'NONE',
      canonical_write_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'SUPPLEMENTAL_DEFINITION_CANDIDATES_REQUIRE_REVIEWED_DISPOSITION',
        'F6_NO_SHOP_DEFINITION_GRAPH_DEFERRED',
        'F6_EXCEPTION_SOURCE_BINDING_DEFERRED',
        'F6_COMPLETE_NOTICE_SOURCE_BINDING_DEFERRED',
        'F6_RESULT_DEFINITION_DEFERRED',
      ],
    },
  };
  const supplement = freeze({
    ...body,
    qxo_no_shop_nested_definition_candidate_supplement_id: contentId(
      'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(supplement);
  return supplement;
}

function validateQxoNoShopNestedDefinitionCandidateSupplement({
  qxo_no_shop_nested_definition_candidate_supplement: supplement,
  ...input
} = {}) {
  validateCarrierIdentity(supplement);
  const expected = buildQxoNoShopNestedDefinitionCandidateSupplement(input);
  if (canonicalJson(supplement) !== canonicalJson(expected)) {
    fail('SUPPLEMENT_IDENTITY_MISMATCH', 'the nested-definition supplement has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  CANDIDATE_SPECS,
  MAX_SUPPLEMENT_BYTES,
  QxoNoShopNestedDefinitionCandidateSupplementError,
  buildQxoNoShopNestedDefinitionCandidateSupplement,
  validateQxoNoShopNestedDefinitionCandidateSupplement,
  validateQxoNoShopNestedDefinitionCandidateSupplementCarrierIdentity:
    validateCarrierIdentity,
};
