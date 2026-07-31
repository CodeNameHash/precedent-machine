const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  validateProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  validateProductResultPresentation,
} = require('./product-result-presentation-compiler');
const {
  validateProductResultSurfaceBindingContractInput,
} = require('./product-result-surface-binding-contract-input-validator');
const surfaceBindingContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-result-surface-binding.v1.json',
);

const PRODUCT_RESULT_SURFACE_BINDING_SCHEMA =
  'PRODUCT_RESULT_SURFACE_BINDING/V1';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const AUTHORITY_STATE = 'NOT_GRANTED';

class ProductResultSurfaceBindingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductResultSurfaceBindingError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductResultSurfaceBindingError(code, message, details);
}

function clone(value, code = 'INVALID_PRODUCT_RESULT_SURFACE_BINDING_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product surface-binding input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the closed contract.`, {
      actual,
      expected: required,
    });
  }
}

function validateRuntimeContract() {
  try {
    validateProductResultSurfaceBindingContractInput(surfaceBindingContract);
  } catch (error) {
    fail('INVALID_PRODUCT_RESULT_SURFACE_BINDING_CONTRACT',
      'The signed Product surface-binding contract has changed.', {
        cause: error.code || error.message,
      });
  }
}

function validateReleaseBinding(binding, query, result, presentation) {
  const code = 'INVALID_PRODUCT_RESULT_SURFACE_RELEASE_BINDING';
  exactKeys(binding, [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ], 'Candidate release binding', code);
  const values = [
    query.release_contract,
    result,
    presentation.identity_inputs,
  ];
  for (const key of Object.keys(binding)) {
    if (values.some((value) => value?.[key] !== binding[key])) {
      fail(code, 'The candidate release binding does not match every Product input.', {
        key,
      });
    }
  }
}

function validateSourceAction(sourceAction, result) {
  const code = 'INVALID_PRODUCT_RESULT_SURFACE_SOURCE_ACTION';
  exactKeys(sourceAction, [
    'exact_citation',
    'exact_detail_action',
  ], 'Exact source action', code);
  if (
    sourceAction.exact_detail_action !== result.exact_detail_action
    || canonicalJson(sourceAction.exact_citation)
      !== canonicalJson(result.exact_citation)
  ) {
    fail(code, 'The source action does not preserve the Product result evidence.');
  }
}

function matchingPresentationSlot(presentation, result) {
  const code = 'INVALID_PRODUCT_RESULT_SURFACE_PRESENTATION_BINDING';
  const matches = presentation.result_slots.filter((slot) => (
    slot.slot_state === 'VALID'
    && slot.product_query_result_identity === result.product_query_result_identity
  ));
  if (matches.length !== 1) {
    fail(code, 'The Product presentation must contain exactly one matching valid result slot.');
  }
  const slot = matches[0];
  if (
    slot.domain_result_identity !== result.domain_result_identity
    || slot.domain_result_payload_digest !== result.domain_result_payload_digest
    || slot.exact_detail_action !== result.exact_detail_action
    || canonicalJson(slot.exact_citation) !== canonicalJson(result.exact_citation)
  ) {
    fail(code, 'The Product presentation slot does not preserve the exact result evidence.');
  }
  return slot;
}

function validateInput(input) {
  const code = 'INVALID_PRODUCT_RESULT_SURFACE_BINDING_INPUT';
  exactKeys(input, [
    'candidate_release_binding',
    'exact_source_action',
    'product_query_ir',
    'product_query_result',
    'product_result_presentation',
  ], 'Product result-surface binding input', code);
  validateRuntimeContract();
  const query = clone(input.product_query_ir, code);
  const result = clone(input.product_query_result, code);
  const presentation = clone(input.product_result_presentation, code);
  try {
    canonicalProductQueryIrBytes(query);
    validateProductQueryResult(result);
    validateProductResultPresentation(presentation);
  } catch (error) {
    fail(code, 'A required Product input is not valid.', {
      cause: error.code || error.message,
    });
  }
  if (
    result.product_query_definition_id !== query.query_definition_id
    || presentation.identity_inputs.product_query_definition_id
      !== query.query_definition_id
    || presentation.contract_bindings.product_query_ir_definition
      .query_definition_id !== query.query_definition_id
  ) {
    fail(code, 'The query, result and presentation do not share one query identity.');
  }
  validateReleaseBinding(input.candidate_release_binding, query, result, presentation);
  validateSourceAction(input.exact_source_action, result);
  const slot = matchingPresentationSlot(presentation, result);
  return { query, result, presentation, slot };
}

function compileProductResultSurfaceBindings(input = {}) {
  const { query, result, presentation } = validateInput(input);
  const source = input.exact_source_action;
  const identity = {
    product_query_definition_id: query.query_definition_id,
    product_query_result_identity: result.product_query_result_identity,
    domain_result_identity: result.domain_result_identity,
    product_result_presentation_id:
      presentation.product_result_presentation_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    exact_citation_target_identity:
      result.exact_citation.citation_target_identity,
    exact_detail_action: result.exact_detail_action,
  };
  const rendererNeutralContentIdentity = contentId(
    PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
    identity,
  );
  const surfaceBindings = Object.fromEntries(SURFACES.map((surface) => [
    surface,
    Object.freeze({
      surface,
      ...identity,
      renderer_neutral_content_identity: rendererNeutralContentIdentity,
      source_document_identity:
        source.exact_citation.source_document_identity,
      source_evidence_identity:
        source.exact_citation.source_evidence_identity,
      authority_state: AUTHORITY_STATE,
    }),
  ]));
  const body = {
    renderer_neutral_content_identity: rendererNeutralContentIdentity,
    surface_bindings: surfaceBindings,
    surface_state: 'VALIDATED_NOT_SERVED',
    authority_state: AUTHORITY_STATE,
  };
  return freeze({
    schema_version: PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
    product_result_surface_binding_id: contentId(
      PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
      body,
    ),
    ...body,
  });
}

function validateProductResultSurfaceBindings(value, input) {
  const rebuilt = compileProductResultSurfaceBindings(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('INVALID_PRODUCT_RESULT_SURFACE_BINDING',
      'The Product result-surface binding was changed or substituted.');
  }
  return true;
}

module.exports = {
  AUTHORITY_STATE,
  PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
  ProductResultSurfaceBindingError,
  SURFACES,
  compileProductResultSurfaceBindings,
  validateProductResultSurfaceBindings,
};
