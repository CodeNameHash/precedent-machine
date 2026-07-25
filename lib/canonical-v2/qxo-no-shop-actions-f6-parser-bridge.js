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
const {
  ACTION_SPECS,
  DEAL_KEY,
  GOVERNED_SOURCE_SPANS,
  RETAINED_SOURCE_SPANS,
  buildQxoAdmittedNoShopActionsF6Slice,
} = require('./reviewed-qxo-admitted-no-shop-actions-f6-slice');

const AUTHORITY_SCOPE = 'OFFLINE_REVIEWED_QXO_F6_ATOMIC_ACTION_REFERENCES_ONLY';
const SECTION_4_3_INTERVAL = Object.freeze({ start: 201370, end: 226862 });
const SECTION_4_3_SHA256 = 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524';
const MAX_INPUT_BYTES = 512 * 1024;
const MAX_SEED_BYTES = 48 * 1024;
const MAX_RESIDUALS = 4096;
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
  'reviewed_no_shop_actions_f6_slice',
]);
const REVIEWED_SLICE_KEYS = Object.freeze([
  'schema_version',
  'source_context_id',
  'contract_fingerprint',
  'governed_spans',
  'governed_excerpts',
  'retained_source_spans',
  'retained_residuals',
  'deferred_source_excerpts',
  'limb_spans',
  'limb_excerpts',
  'prohibition_provision',
  'action_components',
  'action_occurrences',
  'reviewed_mapping',
]);
const SEED_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'reviewed_mapping_reference',
  'action_outcomes',
  'status',
  'qxo_no_shop_actions_f6_parser_bound_review_seed_id',
  'canonical_payload_digest',
]);
const LOCALLY_SUPPRESSIBLE_CODES = new Set([
  'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
  'ACTION_REFERENCE_DRIFT',
  'ACTION_RESIDUAL_OVERLAP',
]);
const MAX_ACTION_OCCURRENCES = 64;

class QxoNoShopActionsF6ParserBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopActionsF6ParserBridgeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopActionsF6ParserBridgeError(code, message);
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

function contains(parent, child) {
  return parent.absolute_start <= child.absolute_start
    && parent.absolute_end >= child.absolute_end;
}

function overlaps(left, right) {
  return left.absolute_start < right.absolute_end
    && right.absolute_start < left.absolute_end;
}

function boundedCanonicalBytes(value, maximum, label) {
  let encoded;
  try {
    encoded = canonicalJson(value);
  } catch (_) {
    fail(`${label}_NOT_CANONICAL`, `${label.toLowerCase()} is not canonical`);
  }
  if (Buffer.byteLength(encoded, 'utf8') > maximum) {
    fail(`${label}_LIMIT_EXCEEDED`, `${label.toLowerCase()} exceeds its byte limit`);
  }
  return encoded;
}

function preflightInput(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('BRIDGE_INPUT_CONTRACT_MISMATCH', 'the QXO F6 actions bridge input is outside its closed contract');
  }
  boundedCanonicalBytes(input.reviewed_no_shop_actions_f6_slice, MAX_INPUT_BYTES, 'REVIEWED_SLICE');
  if (!Array.isArray(input.admitted_parser_proposal_envelope?.residuals)
    || input.admitted_parser_proposal_envelope.residuals.length > MAX_RESIDUALS) {
    fail('PARSER_RESIDUAL_LIMIT_EXCEEDED', 'the admitted parser residual collection is unbounded');
  }
}

function requireSectionParent(parserEnvelope, expectedSlice) {
  const governed = [
    ...Object.values(expectedSlice.governed_spans),
    ...Object.values(expectedSlice.retained_source_spans),
  ];
  const matches = parserEnvelope.structural_section_proposals.filter((proposal) => (
    proposal.section_number === '4.3'
    && proposal.section_title === 'No Solicitation by the Company'
    && governed.every((span) => contains(proposal.evidence_anchor, span))
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

function validateSliceEnvelope(actual, expected) {
  if (!exactKeys(actual, REVIEWED_SLICE_KEYS)
    || actual.schema_version !== expected.schema_version
    || actual.source_context_id !== expected.source_context_id
    || actual.contract_fingerprint !== expected.contract_fingerprint
    || canonicalJson(actual.governed_spans) !== canonicalJson(expected.governed_spans)
    || canonicalJson(actual.governed_excerpts) !== canonicalJson(expected.governed_excerpts)
    || canonicalJson(actual.retained_source_spans)
      !== canonicalJson(expected.retained_source_spans)
    || canonicalJson(actual.retained_residuals)
      !== canonicalJson(expected.retained_residuals)
    || canonicalJson(actual.deferred_source_excerpts)
      !== canonicalJson(expected.deferred_source_excerpts)
    || canonicalJson(actual.limb_spans) !== canonicalJson(expected.limb_spans)
    || canonicalJson(actual.limb_excerpts) !== canonicalJson(expected.limb_excerpts)
    || canonicalJson(actual.prohibition_provision)
      !== canonicalJson(expected.prohibition_provision)
    || canonicalJson(actual.reviewed_mapping)
      !== canonicalJson(expected.reviewed_mapping)
    || !Array.isArray(actual.action_components)
    || !Array.isArray(actual.action_occurrences)
    || actual.action_components.length > MAX_ACTION_OCCURRENCES
    || actual.action_occurrences.length > MAX_ACTION_OCCURRENCES
    || canonicalJson(actual.action_components)
      !== canonicalJson(expected.action_components)) {
    fail('REVIEWED_MAPPING_REFERENCE_DRIFT', 'the QXO F6 reviewed source envelope has drifted');
  }
}

function actionReference(expectedOccurrence, actualSlice, parserEnvelope, sectionParent) {
  const matches = actualSlice.action_occurrences.filter(
    (entry) => entry?.occurrence_key === expectedOccurrence.occurrence_key,
  );
  if (matches.length !== 1) {
    fail(
      'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
      `${expectedOccurrence.occurrence_key} is missing or ambiguous`,
    );
  }
  const [actual] = matches;
  if (canonicalJson(actual) !== canonicalJson(expectedOccurrence)) {
    fail('ACTION_REFERENCE_DRIFT', `${expectedOccurrence.occurrence_key} has drifted`);
  }
  const components = actualSlice.action_components.filter(
    (entry) => entry?.provision_component_id === actual.provision_component_id,
  );
  if (components.length !== 1
    || components[0].parent_provision_instance_id
      !== actualSlice.prohibition_provision.provision_instance_id) {
    fail('ACTION_REFERENCE_DRIFT', `${expectedOccurrence.occurrence_key} component has drifted`);
  }
  const evidence = actual.claim.evidence.map((entry) => ({
    absolute_start: entry.absolute_start,
    absolute_end: entry.absolute_end,
  }));
  if (!evidence.every((span) => contains(sectionParent.evidence_anchor, span))) {
    fail('ACTION_REFERENCE_DRIFT', `${expectedOccurrence.occurrence_key} escapes its parser parent`);
  }
  if (parserEnvelope.residuals.some((residual) => (
    residual.evidence_anchor
    && evidence.some((span) => overlaps(residual.evidence_anchor, span))
  ))) {
    fail('ACTION_RESIDUAL_OVERLAP', `${expectedOccurrence.occurrence_key} overlaps a parser residual`);
  }
  return freeze({
    schema_version: 'QXO_NO_SHOP_ACTION_F6_REVIEW_REFERENCE/V1',
    occurrence_key: actual.occurrence_key,
    action_occurrence_id: actual.action_occurrence_id,
    action_occurrence_revision_id: actual.action_occurrence_revision_id,
    provision_component_id: actual.provision_component_id,
    claim_revision_id: actual.claim_revision_id,
    action_code: actual.action_code,
    source_limb_code: actual.source_limb_code,
    governed_ordinal: actual.governed_ordinal,
    knowledge_qualifier_code: actual.knowledge_qualifier_code,
    evidence_excerpt_ids: actual.evidence_excerpt_ids,
    method_of_action_occurrence_ids: actual.method_of_action_occurrence_ids,
    parser_section_proposal_id: sectionParent.admitted_structural_section_proposal_id,
    parser_semantic_classification_authority: 'NONE',
  });
}

function actionOutcome(expectedOccurrence, actualSlice, parserEnvelope, sectionParent) {
  try {
    return freeze({
      schema_version: 'QXO_NO_SHOP_ACTION_F6_REVIEW_OUTCOME/V1',
      occurrence_key: expectedOccurrence.occurrence_key,
      suppressed: false,
      failure_code: null,
      reference: actionReference(
        expectedOccurrence,
        actualSlice,
        parserEnvelope,
        sectionParent,
      ),
    });
  } catch (error) {
    if (!(error instanceof QxoNoShopActionsF6ParserBridgeError)
      || !LOCALLY_SUPPRESSIBLE_CODES.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_NO_SHOP_ACTION_F6_REVIEW_OUTCOME/V1',
      occurrence_key: expectedOccurrence.occurrence_key,
      suppressed: true,
      failure_code: error.code,
      reference: null,
    });
  }
}

function propagateMethodDependencySuppression(outcomes, expectedOccurrences) {
  const indexByOccurrenceId = new Map(expectedOccurrences.map(
    (occurrence, index) => [occurrence.action_occurrence_id, index],
  ));
  const propagated = outcomes.slice();
  for (let pass = 0; pass < expectedOccurrences.length; pass += 1) {
    let changed = false;
    for (let index = 0; index < expectedOccurrences.length; index += 1) {
      if (propagated[index].suppressed) continue;
      const dependencyIndexes = expectedOccurrences[index]
        .method_of_action_occurrence_ids
        .map((occurrenceId) => indexByOccurrenceId.get(occurrenceId));
      if (dependencyIndexes.some(
        (dependencyIndex) => dependencyIndex === undefined
          || propagated[dependencyIndex].suppressed,
      )) {
        propagated[index] = freeze({
          schema_version: 'QXO_NO_SHOP_ACTION_F6_REVIEW_OUTCOME/V1',
          occurrence_key: expectedOccurrences[index].occurrence_key,
          suppressed: true,
          failure_code: 'ACTION_METHOD_DEPENDENCY_UNRESOLVED',
          reference: null,
        });
        changed = true;
      }
    }
    if (!changed) return freeze(propagated);
  }
  fail(
    'ACTION_METHOD_DEPENDENCY_CYCLE',
    'the QXO F6 action method dependency graph did not converge',
  );
}

function validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(seed) {
  if (!exactKeys(seed, SEED_KEYS)) {
    fail('SEED_CONTRACT_MISMATCH', 'the QXO F6 actions seed is outside its closed contract');
  }
  boundedCanonicalBytes(seed, MAX_SEED_BYTES, 'SEED');
  const {
    qxo_no_shop_actions_f6_parser_bound_review_seed_id: seedId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = seed;
  if (seedId !== contentId(
    'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED/V1',
    body,
  ) || payloadDigest !== contentId(
    'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
    body,
  )) {
    fail('SEED_IDENTITY_MISMATCH', 'the QXO F6 actions seed identity has drifted');
  }
  return true;
}

function buildQxoNoShopActionsF6ParserBoundReviewSeed(input = {}) {
  preflightInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: parserEnvelope,
    reviewed_no_shop_actions_f6_slice: actualSlice,
  } = input;
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    fail('WRONG_CONTRACT', 'the QXO F6 actions bridge requires the exact F6 contract');
  }
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
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: parserEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  });
  const expectedSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  validateSliceEnvelope(actualSlice, expectedSlice);
  const sectionParent = requireSectionParent(parserEnvelope, expectedSlice);
  const directOutcomes = expectedSlice.action_occurrences.map((occurrence) => actionOutcome(
    occurrence,
    actualSlice,
    parserEnvelope,
    sectionParent,
  ));
  const outcomes = propagateMethodDependencySuppression(
    directOutcomes,
    expectedSlice.action_occurrences,
  );
  const expectedKeys = new Set(ACTION_SPECS.map((entry) => entry.occurrence_key));
  const unexpectedOccurrences = actualSlice.action_occurrences.filter(
    (entry) => !expectedKeys.has(entry?.occurrence_key),
  );
  if (unexpectedOccurrences.length) {
    fail(
      'UNEXPECTED_ACTION_OCCURRENCE',
      'the closed QXO F6 reviewed slice contains an unexpected action occurrence',
    );
  }
  const parserResidualCount = parserEnvelope.residuals.length;
  const actionReferenceComplete = outcomes.every((outcome) => !outcome.suppressed);
  const blockerCodes = [
    'F6_SECTION_4_3_SCOPE_INCOMPLETE',
    'F6_RETAINED_SOURCE_DIMENSIONS_PENDING',
    'F6_ROLLUP_SOURCE_BINDING_DEFERRED',
    'F6_INLINE_PERMISSION_SOURCE_BINDING_DEFERRED',
    'F6_EXCEPTION_SOURCE_BINDING_DEFERRED',
    'F6_COMPLETE_NOTICE_SOURCE_BINDING_DEFERRED',
    'F6_RESULT_DEFINITION_DEFERRED',
    ...(parserResidualCount ? ['PARSER_RESIDUAL_RETAINED'] : []),
    ...(outcomes.some((outcome) => outcome.suppressed)
      ? ['ATOMIC_ACTION_REFERENCE_INCOMPLETE']
      : []),
  ].sort();
  const body = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED/V1',
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
      governed_span_digests: Object.values(GOVERNED_SOURCE_SPANS).map(
        (span) => span.sha256,
      ),
      retained_source_span_digests: Object.values(RETAINED_SOURCE_SPANS).map(
        (span) => span.sha256,
      ),
    },
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        parserEnvelope.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        parserEnvelope.canonical_payload_digest,
      parser_runtime_manifest_id: parserEnvelope.parser_runtime_manifest_id,
      section_4_3_proposal_id:
        sectionParent.admitted_structural_section_proposal_id,
      structural_parent_detection_authority: 'EXACT_SECTION_PARENT_ONLY',
      semantic_action_detection_authority: 'NONE',
      retained_parser_residual_count: parserResidualCount,
    },
    reviewed_mapping_reference: {
      reviewed_mapping_id: expectedSlice.reviewed_mapping.reviewed_mapping_id,
      reviewed_mapping_payload_digest:
        expectedSlice.reviewed_mapping.canonical_payload_digest,
      ordered_action_occurrence_revision_ids:
        expectedSlice.reviewed_mapping.ordered_action_occurrence_revision_ids,
      authority: 'EXISTING_REVIEWED_QXO_F6_ATOMIC_ACTION_REFERENCES_ONLY',
    },
    action_outcomes: outcomes,
    status: {
      action_reference_complete: actionReferenceComplete,
      section_4_3_scope_complete: false,
      retained_source_residual_count: expectedSlice.retained_residuals.length,
      unexpected_review_occurrence_count: 0,
      publication_blocked: true,
      canonical_write_authority: 'NONE',
      taxonomy_authority: 'NONE',
      parser_semantic_classification_authority: 'NONE',
      rollup_authority: 'NONE',
      relationship_effect_authority: 'NONE',
      notice_obligation_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      failure_isolation: 'SUPPRESS_AFFECTED_ATOMIC_ACTION_ONLY',
      blocker_codes: blockerCodes,
    },
  };
  const seed = freeze({
    ...body,
    qxo_no_shop_actions_f6_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  });
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(seed);
  return seed;
}

function validateQxoNoShopActionsF6ParserBoundReviewSeed({
  qxo_no_shop_actions_f6_parser_bound_review_seed: seed,
  ...input
} = {}) {
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(seed);
  const expected = buildQxoNoShopActionsF6ParserBoundReviewSeed(input);
  if (canonicalJson(seed) !== canonicalJson(expected)) {
    fail('SEED_IDENTITY_MISMATCH', 'the QXO F6 actions seed has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_SEED_BYTES,
  QxoNoShopActionsF6ParserBridgeError,
  buildQxoNoShopActionsF6ParserBoundReviewSeed,
  validateQxoNoShopActionsF6ParserBoundReviewSeed,
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity,
};
