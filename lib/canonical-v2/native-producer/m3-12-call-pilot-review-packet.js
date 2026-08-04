'use strict';

const { canonicalJson, contentId, utf8ByteLength, utf8Slice } = require('../canonical-bytes');
const { findSectionByReference } = require('./deterministic-sectionizer');
const {
  loadAdmittedSourceForExecution,
  validateUnifiedRunManifest,
} = require('./unified-runner-validate');
const { PILOT_WORK_ITEM_SET_ID, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');

const REVIEW_PACKET_SCHEMA = 'M3_12_CALL_PILOT_REVIEW_PACKET/V1';
const REVIEW_PACKET_ADAPTER_SCHEMA = 'M3_12_CALL_PILOT_REVIEW_PACKET_ADAPTER/V1';
const EXECUTION_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1';
const WORK_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_WORK_RESULT/V1';
const PROVIDER_RECORDING_SCHEMA = 'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1';

class PilotReviewPacketError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotReviewPacketError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new PilotReviewPacketError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function samePilotCohort(manifest, rootDir) {
  const expected = loadPilotWorkItems({ root_dir: rootDir });
  const actual = (manifest && Array.isArray(manifest.work_items) ? manifest.work_items : [])
    .map((item) => ({
      work_item_id: item && item.work_item_id,
      source_id: item && item.source_id,
      family_id: item && item.family_id,
      disposition: item && item.disposition,
    }))
    .sort((left, right) => String(left.work_item_id).localeCompare(String(right.work_item_id)));
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('PILOT_WORK_ITEM_SET_MISMATCH', 'The manifest does not match the pinned twelve-call pilot cohort.', {
      expected_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    });
  }
}

function executionResultBody(result) {
  return {
    schema_version: result.schema_version,
    validation_receipt_id: result.validation_receipt_id,
    semantic_manifest_id: result.semantic_manifest_id,
    execution_plan_id: result.execution_plan_id,
    contract_fingerprint: result.contract_fingerprint,
    validation_evidence: result.validation_evidence,
    work_results: result.work_results,
    succeeded_count: result.succeeded_count,
    failed_count: result.failed_count,
  };
}

function validateExecutionResult(executionResult, validation) {
  const keys = [
    'schema_version', 'validation_receipt_id', 'semantic_manifest_id', 'execution_plan_id',
    'contract_fingerprint', 'validation_evidence', 'work_results', 'succeeded_count',
    'failed_count', 'execution_result_id',
  ];
  if (!exactKeys(executionResult, keys) || executionResult.schema_version !== EXECUTION_RESULT_SCHEMA
    || !isDigest(executionResult.execution_result_id) || !Array.isArray(executionResult.work_results)
    || !nonNegativeInteger(executionResult.succeeded_count) || !nonNegativeInteger(executionResult.failed_count)
    || typeof executionResult.contract_fingerprint !== 'string' || !executionResult.contract_fingerprint.trim()) {
    fail('INVALID_EXECUTION_RESULT', 'The execution result must match the closed unified-run result contract.');
  }
  if (contentId(EXECUTION_RESULT_SCHEMA, executionResultBody(executionResult)) !== executionResult.execution_result_id) {
    fail('EXECUTION_RESULT_ID_MISMATCH', 'The execution result content identity does not match its contents.');
  }
  if (executionResult.validation_receipt_id !== validation.receipt.validation_receipt_id
    || executionResult.semantic_manifest_id !== validation.semantic_manifest.semantic_manifest_id
    || executionResult.execution_plan_id !== validation.execution_plan.execution_plan_id) {
    fail('EXECUTION_VALIDATION_LINK_MISMATCH', 'The execution result is not linked to this sealed manifest validation.');
  }
  const evidence = executionResult.validation_evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || evidence.receipt?.validation_receipt_id !== validation.receipt.validation_receipt_id
    || evidence.semantic_manifest?.semantic_manifest_id !== validation.semantic_manifest.semantic_manifest_id
    || evidence.execution_plan?.execution_plan_id !== validation.execution_plan.execution_plan_id) {
    fail('EXECUTION_EVIDENCE_LINK_MISMATCH', 'The retained execution validation evidence is not linked to this sealed manifest.');
  }
}

function validateWorkResults(workResults, semanticItems, succeededCountExpected, failedCountExpected) {
  if (workResults.length !== semanticItems.length) {
    fail('WORK_RESULT_COUNT_MISMATCH', 'The execution result must contain exactly one work result for every pilot item.');
  }
  const expectedById = new Map(semanticItems.map((item) => [item.work_item_id, item]));
  const byId = new Map();
  let succeededCount = 0;
  let failedCount = 0;
  for (const result of workResults) {
    const keys = [
      'schema_version', 'work_item_id', 'source_id', 'family_id', 'profile_id', 'status',
      'failure_code', 'failure_stage', 'run_receipt', 'resolution', 'provider_recording', 'work_result_id',
    ];
    if (!exactKeys(result, keys) || result.schema_version !== WORK_RESULT_SCHEMA
      || !expectedById.has(result.work_item_id) || byId.has(result.work_item_id)
      || !isDigest(result.work_result_id) || typeof result.profile_id !== 'string' || !result.profile_id.trim()
      || !['SUCCEEDED', 'FAILED'].includes(result.status)) {
      fail('INVALID_WORK_RESULT', 'Each work result must be a unique, closed unified-run work result.', {
        work_item_id: result && result.work_item_id,
      });
    }
    const body = { ...result };
    delete body.work_result_id;
    if (contentId(WORK_RESULT_SCHEMA, body) !== result.work_result_id) {
      fail('WORK_RESULT_ID_MISMATCH', 'A work result content identity does not match its contents.', {
        work_item_id: result.work_item_id,
      });
    }
    const expected = expectedById.get(result.work_item_id);
    if (result.source_id !== expected.source_id || result.family_id !== expected.family_id) {
      fail('WORK_RESULT_PROVENANCE_MISMATCH', 'A work result does not match its sealed source or family.', {
        work_item_id: result.work_item_id,
      });
    }
    if (result.provider_recording !== null) {
      const recording = result.provider_recording;
      const recordingBody = recording && {
        schema_version: recording.schema_version,
        work_item_id: recording.work_item_id,
        provider_output: recording.provider_output,
      };
      if (!exactKeys(recording, ['schema_version', 'work_item_id', 'provider_output', 'provider_recording_id'])
        || recording.schema_version !== PROVIDER_RECORDING_SCHEMA
        || recording.work_item_id !== result.work_item_id
        || !recording.provider_output || typeof recording.provider_output !== 'object'
        || Array.isArray(recording.provider_output)
        || typeof recording.provider_output.raw_response_text !== 'string'
        || recording.provider_recording_id !== contentId(PROVIDER_RECORDING_SCHEMA, recordingBody)) {
        fail('INVALID_PROVIDER_RECORDING', 'A provider recording must retain the exact raw response and identity.', {
          work_item_id: result.work_item_id,
        });
      }
    }
    if (result.status === 'SUCCEEDED' && (!result.run_receipt || !result.resolution || !result.provider_recording
      || result.failure_code !== null || result.failure_stage !== null)) {
      fail('SUCCESS_RESULT_INCOMPLETE', 'A successful work result must retain compiled, resolved and provider output.', {
        work_item_id: result.work_item_id,
      });
    }
    if (result.status === 'FAILED' && (result.run_receipt !== null || result.resolution !== null
      || typeof result.failure_code !== 'string' || !result.failure_code.trim()
      || typeof result.failure_stage !== 'string' || !result.failure_stage.trim())) {
      fail('FAILED_RESULT_INCOMPLETE', 'A failed work result must retain its failure code and stage.', {
        work_item_id: result.work_item_id,
      });
    }
    if (result.status === 'SUCCEEDED') succeededCount += 1;
    else failedCount += 1;
    byId.set(result.work_item_id, result);
  }
  if (succeededCount !== succeededCountExpected || failedCount !== failedCountExpected) {
    fail('EXECUTION_COUNT_MISMATCH', 'The execution result success and failure counts do not match its work results.');
  }
  return byId;
}

function retainedRawResponse(workResult) {
  const output = workResult.provider_recording?.provider_output;
  return output && typeof output.raw_response_text === 'string' ? output.raw_response_text : '';
}

function attemptCount(workResult) {
  const attempts = workResult.provider_recording?.provider_output?.attempts;
  return nonNegativeInteger(attempts) ? attempts : null;
}

function residualCounts(workResult) {
  const receipt = workResult.run_receipt;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return Object.freeze({
      provider_evidence_residual_count: null,
      scope_violation_count: null,
      citation_residual_count: null,
    });
  }
  const values = {
    provider_evidence_residual_count: receipt.evidence_residual_count,
    scope_violation_count: receipt.scope_violation_count,
    citation_residual_count: receipt.citation_residual_count,
  };
  if (!Object.values(values).every(nonNegativeInteger)) {
    fail('INVALID_RUN_RECEIPT', 'The run receipt must retain non-negative residual counts.', {
      work_item_id: workResult.work_item_id,
    });
  }
  return Object.freeze(values);
}

function compiledOutput(workResult) {
  if (workResult.status !== 'SUCCEEDED') return null;
  if (!Array.isArray(workResult.run_receipt.compiled_candidates)) {
    fail('INVALID_RUN_RECEIPT', 'A successful run receipt must retain compiled candidates.', {
      work_item_id: workResult.work_item_id,
    });
  }
  return Object.freeze({
    compiled_candidates: workResult.run_receipt.compiled_candidates,
    resolved_output: workResult.resolution,
  });
}

function sourceAndSection(admittedBySourceId, item) {
  const admitted = admittedBySourceId.get(item.source_id);
  const node = findSectionByReference(admitted.tree, item.section_reference);
  if (!node || node.section_id !== item.section_id || node.kind !== item.section_kind
    || node.text_sha256 !== item.section_text_sha256) {
    fail('SECTION_PIN_MISMATCH', 'The exact review section does not match its sealed semantic pin.', {
      work_item_id: item.work_item_id,
    });
  }
  const text = utf8Slice(admitted.context.canonical_text.text, node.start, node.end);
  return Object.freeze({
    text,
    provenance: Object.freeze({
      source_id: item.source_id,
      admitted_semantic_source_context_id: admitted.context.admitted_semantic_source_context_id,
      document_hash: admitted.context.document_hash,
      canonical_text_sha256: admitted.context.canonical_text_sha256,
      canonical_text_byte_length: admitted.context.canonical_text_byte_length,
      section_reference: node.reference,
      section_id: node.section_id,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
      section_start: node.start,
      section_end: node.end,
      section_text_byte_length: utf8ByteLength(text),
    }),
  });
}

function buildPilotReviewPackets({ manifest, execution_result: executionResult, root_dir: rootDir = process.cwd() } = {}) {
  samePilotCohort(manifest, rootDir);
  const validation = validateUnifiedRunManifest({ manifest, root_dir: rootDir });
  const semanticItems = validation.semantic_manifest.work_items;
  if (semanticItems.length !== 12 || semanticItems.some((item) => item.disposition !== 'EXTRACT')) {
    fail('PILOT_MANIFEST_NOT_EXTRACT_ONLY', 'The pilot review adapter requires twelve EXTRACT work items.');
  }
  validateExecutionResult(executionResult, validation);
  const workResults = validateWorkResults(
    executionResult.work_results,
    semanticItems,
    executionResult.succeeded_count,
    executionResult.failed_count,
  );
  const sourcesById = new Map(manifest.sources.map((source) => [source.source_id, source]));
  const admittedBySourceId = new Map();
  for (const sourceId of new Set(semanticItems.map((item) => item.source_id))) {
    admittedBySourceId.set(sourceId, loadAdmittedSourceForExecution({
      source: sourcesById.get(sourceId),
      root_dir: rootDir,
    }));
  }
  const qualityRecords = [];
  const reviewPackets = [];
  for (const item of semanticItems) {
    const workResult = workResults.get(item.work_item_id);
    const source = sourceAndSection(admittedBySourceId, item);
    const rawResponse = retainedRawResponse(workResult);
    const residuals = residualCounts(workResult);
    const output = compiledOutput(workResult);
    const qualityRecord = Object.freeze({
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      status: workResult.status,
      attempt_count: attemptCount(workResult),
      retained_raw_response: rawResponse,
      compiled_output: output ? canonicalJson(output) : null,
      provider_evidence_residual_count: residuals.provider_evidence_residual_count,
      scope_violation_count: residuals.scope_violation_count,
      citation_residual_count: residuals.citation_residual_count,
    });
    const packetBody = {
      schema_version: REVIEW_PACKET_SCHEMA,
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      profile_id: workResult.profile_id,
      execution_status: workResult.status,
      failure_code: workResult.failure_code,
      failure_stage: workResult.failure_stage,
      pinned_section_text: source.text,
      retained_raw_response: rawResponse,
      compiled_output: output ? output.compiled_candidates : null,
      resolved_output: output ? output.resolved_output : null,
      residual_counts: residuals,
      independent_review_status: null,
      provenance: {
        ...source.provenance,
        validation_receipt_id: executionResult.validation_receipt_id,
        semantic_manifest_id: executionResult.semantic_manifest_id,
        execution_plan_id: executionResult.execution_plan_id,
        execution_result_id: executionResult.execution_result_id,
        contract_fingerprint: executionResult.contract_fingerprint,
        work_result_id: workResult.work_result_id,
        provider_recording_id: workResult.provider_recording?.provider_recording_id || null,
      },
    };
    reviewPackets.push(Object.freeze({
      ...packetBody,
      review_packet_id: contentId(REVIEW_PACKET_SCHEMA, packetBody),
    }));
    qualityRecords.push(qualityRecord);
  }
  const body = {
    schema_version: REVIEW_PACKET_ADAPTER_SCHEMA,
    pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    validation_receipt_id: executionResult.validation_receipt_id,
    semantic_manifest_id: executionResult.semantic_manifest_id,
    execution_plan_id: executionResult.execution_plan_id,
    execution_result_id: executionResult.execution_result_id,
    quality_records: Object.freeze(qualityRecords),
    review_packets: Object.freeze(reviewPackets),
  };
  return Object.freeze({
    ...body,
    review_packet_adapter_id: contentId(REVIEW_PACKET_ADAPTER_SCHEMA, body),
  });
}

module.exports = {
  REVIEW_PACKET_SCHEMA,
  REVIEW_PACKET_ADAPTER_SCHEMA,
  PilotReviewPacketError,
  buildPilotReviewPackets,
};
