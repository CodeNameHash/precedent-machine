const { canonicalJson, contentId } = require('./canonical-bytes');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const { validateContractBundle } = require('./contract-bundle');
const {
  buildCanonicalWriteInputDigest,
} = require('./canonical-write-envelope');
const {
  validateQxoCapitalisationParserSourceClosureF27,
} = require('./qxo-capitalisation-parser-source-closure-f27');
const {
  validateQxoReviewedCapitalisationF28,
} = require('./reviewed-qxo-capitalisation-f28');
const {
  validateResolvedCanonicalWriteSet,
} = require('./validate-write-set');

const QXO_CAPITALISATION_F28_WRITER_LINK_SCHEMA =
  'QXO_CAPITALISATION_F28_WRITER_LINK/V1';
const QXO_CAPITALISATION_F28_WRITER_RECEIPT_SCHEMA =
  'QXO_CAPITALISATION_F28_WRITER_RECEIPT/V1';
const EXECUTION_AUTHORITY = 'NONE';
const EXECUTION_BOUNDARY = 'STAGING_REPOSITORY_SOURCE_RESOLUTION_REQUIRED';
const WRITER_SCHEMA_REJECTION =
  'F28 condition_group_components use CAPITALISATION_CONDITION_GROUP/V1, but DEAL_SCOPE_RUN components only accept PROVISION_COMPONENT/V1';
const DEAL_SCOPE_RUN = 'DEAL_SCOPE_RUN';
const INPUT_KEYS = Object.freeze([
  'reviewed_graph',
  'source_context',
  'parser_source_closure',
  'contract_bundle',
  'idempotency_key',
]);
const EMPTY_RESIDUAL_COLLECTIONS = Object.freeze([
  'validated_semantic_graphs',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
  'incomplete_canonical_result_rows',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the closed F28 writer-link contract`);
  }
}

function requireIdempotencyKey(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new TypeError('F28 writer-link idempotency_key must be a non-empty trimmed string');
  }
  return value;
}

function sourceText(sourceContext, start, length) {
  return Buffer.from(sourceContext.canonical_text.text, 'utf8')
    .subarray(start, start + length)
    .toString('utf8');
}

function deriveClosureId({ reviewedGraph, sourceContext, parserSourceClosure, contractBundle }) {
  return contentId('QXO_CAPITALISATION_F28_DEAL_SCOPE_CLOSURE/V1', {
    reviewed_graph_id: reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    reviewed_graph_payload_digest: reviewedGraph.canonical_payload_digest,
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    parser_source_closure_id:
      parserSourceClosure.qxo_capitalisation_parser_source_closure_f27_id,
    parser_source_closure_payload_digest:
      parserSourceClosure.canonical_payload_digest,
    contract_fingerprint: contractBundle.fingerprint,
  });
}

function closedRows(rows, closureId) {
  return rows.map((row) => ({ ...clone(row), closure_id: closureId }));
}

function closedExcerptRows(sourceExcerpts, closureId) {
  const rows = new Map();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.excerpt_id === 'string') {
      rows.set(value.excerpt_id, value);
      return;
    }
    Object.values(value).forEach(collect);
  };
  collect(sourceExcerpts);
  return [...rows.values()]
    .sort((left, right) => left.excerpt_id.localeCompare(right.excerpt_id))
    .map((row) => ({ ...clone(row), closure_id: closureId }));
}

function buildQxoCapitalisationF28WriterLink(input = {}) {
  exactKeys(input, INPUT_KEYS, 'QXO F28 writer-link input');
  const reviewedGraph = input.reviewed_graph;
  const sourceContext = input.source_context;
  const parserSourceClosure = input.parser_source_closure;
  const contractBundle = input.contract_bundle;
  const idempotencyKey = requireIdempotencyKey(input.idempotency_key);

  validateContractBundle(contractBundle);
  const sourceBindings = new Map(parserSourceClosure?.source_bindings?.map(
    (entry) => [entry.source_key, entry],
  ));
  const capitalBinding = sourceBindings.get('SECTION_3_1_B');
  const conditionBinding = sourceBindings.get('SECTION_5_2');
  if (!capitalBinding || !conditionBinding) {
    throw new TypeError('the exact F27 parser/source closure is incomplete');
  }
  validateQxoCapitalisationParserSourceClosureF27({
    closure: parserSourceClosure,
    capital_structure_text: sourceText(sourceContext, 58044, capitalBinding.raw_text_byte_length),
    closing_condition_text: sourceText(sourceContext, 358040, conditionBinding.raw_text_byte_length),
  });
  validateQxoReviewedCapitalisationF28({
    candidate: reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
  });

  const closureId = deriveClosureId({
    reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
  });
  const writeSet = {
    source_references: [clone(buildAdmittedSourceReference(sourceContext))],
    deal: {
      deal_key: sourceContext.governed_deal_key,
      deal_admission_id: sourceContext.deal_admission_id,
      document_hash: sourceContext.document_hash,
    },
    excerpts: closedExcerptRows(reviewedGraph.source_excerpts, closureId),
    provisions: closedRows(reviewedGraph.provisions, closureId),
    components: closedRows([
      ...reviewedGraph.representation_components,
      ...reviewedGraph.condition_group_components,
    ], closureId),
    claims: closedRows(reviewedGraph.claims, closureId),
    relationships: closedRows(reviewedGraph.relationships, closureId),
    ...Object.fromEntries(EMPTY_RESIDUAL_COLLECTIONS.map((key) => [key, []])),
  };
  const executionInput = {
    operation: DEAL_SCOPE_RUN,
    idempotencyKey,
    writeSet: clone(writeSet),
  };
  let validation;
  let validationState = 'ACCEPTED';
  let schemaRejection = null;
  try {
    validation = validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts: [sourceContext],
    });
    if (validation.residuals.length !== 0 || validation.quarantines.length !== 0) {
      throw new TypeError('the exact F28 writer link must not emit residuals or quarantines');
    }
  } catch (error) {
    if (error?.code !== 'CANONICAL_VALIDATION_ERROR'
      || !reviewedGraph.condition_group_components.every(
        (row) => row.schema_version === 'CAPITALISATION_CONDITION_GROUP/V1',
      )
      || !/components\[\d+\] fields do not match the structural write contract/.test(error.message)) {
      throw error;
    }
    validationState = 'REJECTED_BY_WRITER_SCHEMA';
    schemaRejection = WRITER_SCHEMA_REJECTION;
    validation = {
      counts: {
        publishable: 0,
        residuals: 0,
        quarantinedClosures: 0,
      },
      residuals: [],
      quarantines: [],
    };
  }
  const inputDigest = buildCanonicalWriteInputDigest({
    ...executionInput,
    residuals: validation.residuals,
    quarantines: validation.quarantines,
  });
  const receiptBody = {
    schema_version: QXO_CAPITALISATION_F28_WRITER_RECEIPT_SCHEMA,
    operation: DEAL_SCOPE_RUN,
    idempotency_key: idempotencyKey,
    input_digest: inputDigest,
    closure_id: closureId,
    reviewed_graph_id: reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    execution_authority: EXECUTION_AUTHORITY,
    execution_boundary: EXECUTION_BOUNDARY,
    validation_state: validationState,
    schema_rejection: schemaRejection,
    validation_counts: clone(validation.counts),
  };
  const receipt = {
    ...receiptBody,
    qxo_capitalisation_f28_writer_receipt_id: contentId(
      QXO_CAPITALISATION_F28_WRITER_RECEIPT_SCHEMA,
      receiptBody,
    ),
  };
  return freeze({
    schema_version: QXO_CAPITALISATION_F28_WRITER_LINK_SCHEMA,
    execution_authority: EXECUTION_AUTHORITY,
    execution_boundary: EXECUTION_BOUNDARY,
    closure_id: closureId,
    deal_scope_run_input: executionInput,
    receipt,
  });
}

module.exports = {
  DEAL_SCOPE_RUN,
  EXECUTION_AUTHORITY,
  EXECUTION_BOUNDARY,
  QXO_CAPITALISATION_F28_WRITER_LINK_SCHEMA,
  QXO_CAPITALISATION_F28_WRITER_RECEIPT_SCHEMA,
  WRITER_SCHEMA_REJECTION,
  buildQxoCapitalisationF28WriterLink,
};
