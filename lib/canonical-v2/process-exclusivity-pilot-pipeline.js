const {
  canonicalJson,
  sha256Hex,
} = require('./canonical-bytes');
const {
  acquireProcessSources,
  validateProcessSourceAcquisitionReceipt,
} = require('./process-source-acquisition');
const {
  buildProcessSecCompletenessOracle,
  validateProcessSecCompletenessOracleReceipt,
} = require('./process-sec-completeness-oracle');
const {
  enumerateProcessScope,
} = require('./process-scope-enumerator');
const {
  enumerateProcessSemantics,
} = require('./process-semantic-enumerator');
const {
  enumerateProcessLexicalCandidates,
} = require('./process-lexical-enumerator');
const {
  CANDIDATE_GRAPH_INPUT_SCHEMA,
  buildProcessCandidateGraph,
} = require('./process-candidate-graph');
const {
  CANDIDATE_VALIDATOR_INPUT_SCHEMA,
  validateProcessCandidateGraph,
} = require('./process-candidate-validator');
const {
  compileProcessExclusivityPilotMaterialisation,
  validateProcessExclusivityPilotMaterialisation,
} = require('./process-exclusivity-pilot');

const PIPELINE_INPUT_SCHEMA =
  'PROCESS_EXCLUSIVITY_PILOT_PIPELINE_INPUT/V1';
const PIPELINE_RECEIPT_SCHEMA =
  'PROCESS_EXCLUSIVITY_PILOT_PIPELINE_RECEIPT/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const KEY_RE = /^[A-Z0-9][A-Z0-9_-]{0,127}$/;
const MAX_SIBLINGS = 64;
const KNOWN_BRANCH_ERRORS = new Set([
  'ProcessCandidateGraphError',
  'ProcessCandidateValidatorError',
  'ProcessExclusivityPilotError',
  'ProcessExclusivityPilotPipelineError',
  'ProcessLexicalEnumeratorError',
  'ProcessScopeEnumeratorError',
  'ProcessSemanticEnumeratorError',
]);

class ProcessExclusivityPilotPipelineError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessExclusivityPilotPipelineError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessExclusivityPilotPipelineError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be a plain object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      actual,
      expected: required,
    });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 digest.`);
  }
}

function requireKey(value, label, code) {
  if (typeof value !== 'string' || !KEY_RE.test(value)) {
    fail(code, `${label} must be a governed key.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} must be canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function validateTopLevel(input, trustedContext) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_INPUT';
  requireExactKeys(input, [
    'schema_version',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'source_acquisition_input',
    'sec_completeness_input',
    'siblings',
  ], 'Process exclusivity pilot pipeline input', code);
  if (input.schema_version !== PIPELINE_INPUT_SCHEMA) {
    fail(code, 'The Process exclusivity pilot pipeline schema is not supported.');
  }
  requireDigest(
    input.frozen_contract_pair_digest,
    'Pipeline frozen contract-pair digest',
    code,
  );
  requireDigest(
    input.governed_deal_admission_id,
    'Pipeline governed deal-admission ID',
    code,
  );
  if (!Array.isArray(input.siblings)
    || input.siblings.length === 0
    || input.siblings.length > MAX_SIBLINGS) {
    fail(code, 'Pipeline siblings must be a bounded non-empty array.');
  }
  requireExactKeys(trustedContext, [
    'expected_acquisition_receipt_id',
    'scope_receipt_anchors',
  ], 'Trusted pipeline context', code);
  requireDigest(
    trustedContext.expected_acquisition_receipt_id,
    'Trusted expected acquisition receipt ID',
    code,
  );
  if (!Array.isArray(trustedContext.scope_receipt_anchors)
    || trustedContext.scope_receipt_anchors.length !== input.siblings.length) {
    fail(code, 'Trusted scope receipt anchors must cover every sibling.');
  }
}

function validateScopeAnchors(input, trustedContext) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_TRUST';
  const anchors = new Map();
  for (const [index, anchor] of trustedContext.scope_receipt_anchors.entries()) {
    requireExactKeys(anchor, [
      'sibling_key',
      'expected_scope_receipt_id',
    ], `Trusted scope anchor ${index}`, code);
    requireKey(anchor.sibling_key, `Trusted scope anchor ${index} sibling key`, code);
    requireDigest(
      anchor.expected_scope_receipt_id,
      `Trusted scope anchor ${index} receipt ID`,
      code,
    );
    if (anchors.has(anchor.sibling_key)) {
      fail(code, 'Trusted scope receipt anchors contain a duplicate sibling.');
    }
    anchors.set(anchor.sibling_key, anchor.expected_scope_receipt_id);
  }
  const siblingKeys = input.siblings.map((sibling, index) => {
    requireObject(sibling, `Pipeline sibling ${index}`, code);
    requireKey(sibling.sibling_key, `Pipeline sibling ${index} key`, code);
    return sibling.sibling_key;
  });
  if (new Set(siblingKeys).size !== siblingKeys.length
    || siblingKeys.some((key) => !anchors.has(key))
    || [...anchors.keys()].some((key) => !siblingKeys.includes(key))) {
    fail(code, 'Trusted scope receipt anchors do not exactly match the sibling set.');
  }
  return anchors;
}

function validateCommonScope(input) {
  const code = 'PROCESS_PILOT_PIPELINE_SCOPE_DRIFT';
  const acquisitionScope = input.source_acquisition_input?.governed_scope;
  const secScope = input.sec_completeness_input?.governed_scope;
  if (acquisitionScope?.scope_id !== secScope?.scope_id
    || acquisitionScope?.scope_digest !== secScope?.scope_digest) {
    fail(code, 'Source acquisition and SEC completeness use different governed scopes.');
  }
}

function sourceKey(sourceIdentity) {
  return canonicalJson({
    source_document_identity: sourceIdentity?.source_document_identity,
    source_revision_id: sourceIdentity?.source_revision_id,
    document_hash: sourceIdentity?.document_hash,
  });
}

function admittedSources(input, acquisitionReceipt) {
  const code = 'PROCESS_PILOT_PIPELINE_SOURCE_DRIFT';
  const sourceInputs = input.source_acquisition_input.frozen_sources;
  const receiptBySource = new Map(
    acquisitionReceipt.intake_outcomes.map((value) => [value.source_id, value]),
  );
  const byIdentity = new Map();
  for (const source of sourceInputs) {
    const retained = receiptBySource.get(source.source_id);
    if (!retained
      || retained.intake_outcome !== 'VERIFIED_INTAKE_RECEIPT'
      || canonicalJson(retained.source_identity)
        !== canonicalJson(source.source_identity)
      || retained.source_text_digest !== source.source_text_digest) {
      fail(code, 'A pipeline source does not have one verified retained intake outcome.');
    }
    const key = sourceKey(source.source_identity);
    if (byIdentity.has(key)) {
      fail(code, 'Pipeline sources contain a duplicate source identity.');
    }
    byIdentity.set(key, source);
  }
  return byIdentity;
}

function validateEvidenceAgainstSources(evidence, sources, label) {
  const code = 'PROCESS_PILOT_PIPELINE_EVIDENCE_DRIFT';
  if (evidence === null) return;
  const source = sources.get(sourceKey(evidence));
  if (!source) fail(code, `${label} does not bind an admitted source.`);
  const sourceBytes = Buffer.from(source.source_text, 'utf8');
  if (!Number.isSafeInteger(evidence.start_utf8_byte)
    || !Number.isSafeInteger(evidence.end_utf8_byte)
    || evidence.start_utf8_byte < 0
    || evidence.end_utf8_byte <= evidence.start_utf8_byte
    || evidence.end_utf8_byte > sourceBytes.length) {
    fail(code, `${label} has an invalid admitted source interval.`);
  }
  const exactBytes = sourceBytes.subarray(
    evidence.start_utf8_byte,
    evidence.end_utf8_byte,
  );
  if (sha256Hex(exactBytes) !== evidence.exact_text_digest) {
    fail(code, `${label} exact text digest does not bind the admitted source bytes.`);
  }
  if (Object.hasOwn(evidence, 'scope_evidence')) {
    evidence.scope_evidence.forEach((value, index) => (
      validateEvidenceAgainstSources(value, sources, `${label} scope evidence ${index}`)
    ));
  }
}

function validateGraphEvidence(candidateGraph, sources) {
  candidateGraph.candidate_nodes.forEach((node, index) => (
    validateEvidenceAgainstSources(
      node.evidence,
      sources,
      `Candidate graph node ${index}`,
    )
  ));
  candidateGraph.retained_records.forEach((record, index) => {
    validateEvidenceAgainstSources(
      record.evidence,
      sources,
      `Candidate graph retained record ${index}`,
    );
    if (Array.isArray(record.scope_evidence)) {
      record.scope_evidence.forEach((value, evidenceIndex) => (
        validateEvidenceAgainstSources(
          value,
          sources,
          `Candidate graph retained record ${index} scope evidence ${evidenceIndex}`,
        )
      ));
    }
  });
}

function validateMaterialisationSources(materialisationInput, sources) {
  const code = 'PROCESS_PILOT_PIPELINE_SOURCE_DRIFT';
  if (!Array.isArray(materialisationInput.source_documents)
    || materialisationInput.source_documents.length !== sources.size) {
    fail(code, 'Pilot materialisation does not contain the exact admitted source set.');
  }
  const seen = new Set();
  for (const source of materialisationInput.source_documents) {
    const key = sourceKey(source);
    const admitted = sources.get(key);
    if (!admitted
      || seen.has(key)
      || source.source_text !== admitted.source_text
      || source.source_text_digest !== admitted.source_text_digest) {
      fail(code, 'Pilot materialisation substituted an admitted source.');
    }
    seen.add(key);
  }
}

function validateSiblingShape(sibling) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_SIBLING';
  requireExactKeys(sibling, [
    'sibling_key',
    'scope_input',
    'semantic_source_units',
    'semantic_limits',
    'lexical_source_units',
    'lexical_limits',
    'lexical_reported_usage',
    'candidate_graph_limits',
    'materialisation_input',
  ], `Pipeline sibling ${sibling.sibling_key}`, code);
}

function validateSiblingBinding(
  input,
  sibling,
  scopeReceipt,
  materialisationInput,
) {
  const code = 'PROCESS_PILOT_PIPELINE_BINDING_DRIFT';
  if (sibling.scope_input.governed_deal_admission_id
    !== input.governed_deal_admission_id) {
    fail(code, 'A sibling scope uses a different governed deal.');
  }
  if (materialisationInput === null) {
    if (scopeReceipt.expected_occurrence_slots.length !== 0
      || scopeReceipt.residuals.length === 0) {
      fail(code, 'Only a residual-only zero-slot sibling can omit materialisation.');
    }
    return;
  }
  if (materialisationInput.governed_deal_admission_id
      !== input.governed_deal_admission_id
    || materialisationInput.frozen_contract_pair_digest
      !== input.frozen_contract_pair_digest) {
    fail(code, 'Pilot materialisation changed the governed deal or frozen contract pair.');
  }
  const scopeSlots = scopeReceipt.expected_occurrence_slots
    .map((slot) => slot.slot_key)
    .sort(compareText);
  const witnessSlots = materialisationInput.frozen_scope
    ?.predicate_witness_slots
    ?.map((slot) => slot.predicate_witness_slot_key)
    .sort(compareText);
  if (canonicalJson(scopeSlots) !== canonicalJson(witnessSlots)) {
    fail(code, 'Pipeline scope slots do not match the pilot predicate-witness slots.');
  }
}

function typedFailure(stage, error) {
  return {
    failure_state: 'FAILED',
    failure_stage: stage,
    error_name: error.name,
    error_code: error.code,
  };
}

function compileSibling(
  input,
  sibling,
  expectedScopeReceiptId,
  sources,
) {
  const retained = {
    sibling_key: sibling.sibling_key,
    scope_receipt: null,
    semantic_enumeration: null,
    lexical_enumeration: null,
    candidate_graph: null,
    candidate_validation_receipt: null,
    process_exclusivity_pilot_materialisation_receipt: null,
    failure: null,
  };
  let stage = 'SCOPE_ENUMERATION';
  try {
    validateSiblingShape(sibling);
    retained.scope_receipt = enumerateProcessScope(sibling.scope_input);
    if (retained.scope_receipt.scope_receipt_id !== expectedScopeReceiptId) {
      fail(
        'PROCESS_PILOT_PIPELINE_SCOPE_RECEIPT_SUBSTITUTION',
        'A sibling scope receipt does not match its separately trusted ID.',
      );
    }
    stage = 'SEMANTIC_ENUMERATION';
    retained.semantic_enumeration = enumerateProcessSemantics({
      schema_version: 'PROCESS_SEMANTIC_ENUMERATOR_INPUT/V1',
      scope_receipt: retained.scope_receipt,
      source_units: sibling.semantic_source_units,
      limits: sibling.semantic_limits,
    }, expectedScopeReceiptId);
    stage = 'LEXICAL_ENUMERATION';
    retained.lexical_enumeration = enumerateProcessLexicalCandidates({
      scope_receipt: retained.scope_receipt,
      source_units: sibling.lexical_source_units,
      limits: sibling.lexical_limits,
      reported_usage: sibling.lexical_reported_usage,
    }, expectedScopeReceiptId);
    stage = 'CANDIDATE_GRAPH';
    retained.candidate_graph = buildProcessCandidateGraph({
      schema_version: CANDIDATE_GRAPH_INPUT_SCHEMA,
      semantic_enumeration: retained.semantic_enumeration,
      lexical_enumeration: retained.lexical_enumeration,
      limits: sibling.candidate_graph_limits,
    });
    validateGraphEvidence(retained.candidate_graph, sources);
    stage = 'CANDIDATE_VALIDATION';
    retained.candidate_validation_receipt = validateProcessCandidateGraph({
      schema_version: CANDIDATE_VALIDATOR_INPUT_SCHEMA,
      candidate_graph: retained.candidate_graph,
      semantic_enumeration: retained.semantic_enumeration,
      lexical_enumeration: retained.lexical_enumeration,
    });
    stage = 'PILOT_BINDING';
    validateSiblingBinding(
      input,
      sibling,
      retained.scope_receipt,
      sibling.materialisation_input,
    );
    if (sibling.materialisation_input !== null) {
      validateMaterialisationSources(sibling.materialisation_input, sources);
      stage = 'PILOT_MATERIALISATION';
      retained.process_exclusivity_pilot_materialisation_receipt =
        compileProcessExclusivityPilotMaterialisation(
          sibling.materialisation_input,
        );
      validateProcessExclusivityPilotMaterialisation(
        retained.process_exclusivity_pilot_materialisation_receipt,
        sibling.materialisation_input,
      );
    }
  } catch (error) {
    if (!KNOWN_BRANCH_ERRORS.has(error?.name)
      || typeof error.code !== 'string') {
      throw error;
    }
    retained.failure = typedFailure(stage, error);
  }
  return retained;
}

function compileProcessExclusivityPilotPipeline(input, trustedContext) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_INPUT';
  const value = cloneCanonical(input, 'Pipeline input', code);
  const trusted = cloneCanonical(
    trustedContext,
    'Trusted pipeline context',
    code,
  );
  validateTopLevel(value, trusted);
  const scopeAnchors = validateScopeAnchors(value, trusted);
  validateCommonScope(value);
  const acquisitionReceipt = acquireProcessSources(
    value.source_acquisition_input,
  );
  validateProcessSourceAcquisitionReceipt(
    acquisitionReceipt,
    trusted.expected_acquisition_receipt_id,
  );
  const secCompletenessReceipt = buildProcessSecCompletenessOracle(
    value.sec_completeness_input,
  );
  validateProcessSecCompletenessOracleReceipt(secCompletenessReceipt);
  const sources = admittedSources(value, acquisitionReceipt);
  const siblings = [...value.siblings]
    .sort((left, right) => compareText(left.sibling_key, right.sibling_key))
    .map((sibling) => compileSibling(
      value,
      sibling,
      scopeAnchors.get(sibling.sibling_key),
      sources,
    ));
  return deepFreeze({
    schema_version: PIPELINE_RECEIPT_SCHEMA,
    frozen_contract_pair_digest: value.frozen_contract_pair_digest,
    governed_deal_admission_id: value.governed_deal_admission_id,
    source_acquisition_receipt: acquisitionReceipt,
    sec_completeness_receipt: secCompletenessReceipt,
    siblings,
    external_operation_state: 'NOT_PERFORMED',
    authority_state: 'NOT_GRANTED',
  });
}

module.exports = {
  PIPELINE_INPUT_SCHEMA,
  PIPELINE_RECEIPT_SCHEMA,
  ProcessExclusivityPilotPipelineError,
  compileProcessExclusivityPilotPipeline,
};
