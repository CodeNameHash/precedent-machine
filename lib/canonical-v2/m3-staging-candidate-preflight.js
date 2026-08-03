'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { buildCanonicalWriteInputDigest } = require('./canonical-write-envelope');
const {
  listRegisteredSectionFamilies,
} = require('./native-producer/producer-prompt-registry');

const SCHEMA_VERSION = 'M3_STAGING_CANDIDATE_PREFLIGHT/V1';
const FAMILY_OUTPUT_SCHEMA = 'M3_NATIVE_FAMILY_OUTPUT/V1';
const DEAL_CANDIDATE_SCHEMA = 'M3_STAGING_DEAL_CANDIDATE/V1';
const CANDIDATE_SET_SCHEMA = 'M3_STAGING_CANDIDATE_SET/V1';
const WRITE_OPERATION = 'DEAL_SCOPE_RUN';
const DIGEST = /^[a-f0-9]{64}$/;
const COLLECTIONS = Object.freeze({
  excerpts: 'excerpt_id',
  validated_semantic_graphs: 'validated_semantic_graph_id',
  definition_occurrences: 'definition_occurrence_id',
  provisions: 'provision_instance_id',
  components: 'provision_component_id',
  condition_groups: 'condition_group_revision_id',
  claims: 'claim_revision_id',
  relationships: 'relationship_revision_id',
  open_world_candidates: 'candidate_id',
  open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
  open_world_evidence_references: 'evidence_reference_id',
  open_world_candidate_dispositions: 'final_disposition_id',
  open_world_primitives: 'primitive_id',
  semantic_impact_closures: 'semantic_impact_closure_id',
  reviewed_source_specific_rows: 'reviewed_source_specific_row_serving_key',
  incomplete_canonical_result_rows: 'incomplete_result_review_row_serving_key',
});
const WRITE_SET_KEYS = Object.freeze([
  'source_references',
  'deal',
  'write_set_origin',
  ...Object.keys(COLLECTIONS),
]);
const SOURCE_REFERENCE_KEYS = Object.freeze([
  'schema_version',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'semantic_extraction_input_envelope_id',
  'canonical_text_id',
  'governed_deal_key',
  'deal_admission_id',
  'source_ordinal',
]);
const SOURCE_AUTHORITY_KEYS = Object.freeze([
  'source_ordinal',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'semantic_extraction_input_envelope_id',
  'canonical_text_id',
  'canonical_text_sha256',
]);

class M3StagingCandidateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3StagingCandidateError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new M3StagingCandidateError(code, message, details);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_INPUT', `${label} must be a non-empty string.`);
  }
  return value;
}

function digest(value, label) {
  if (!DIGEST.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
  return value;
}

function identity(value, label) {
  return digest(value, label);
}

function authorityKey(authority) {
  return `${authority.source_ordinal}\u0000${authority.immutable_source_document_id}`;
}

function validateSourceAuthority(authority, label) {
  if (!exactKeys(authority, SOURCE_AUTHORITY_KEYS)) {
    fail('INVALID_SOURCE_AUTHORITY', `${label} must match the closed admitted-source authority contract.`);
  }
  if (!Number.isInteger(authority.source_ordinal) || authority.source_ordinal < 0) {
    fail('INVALID_SOURCE_AUTHORITY', `${label}.source_ordinal must be a non-negative integer.`);
  }
  for (const key of SOURCE_AUTHORITY_KEYS.filter((key) => key !== 'source_ordinal')) {
    identity(authority[key], `${label}.${key}`);
  }
  return authority;
}

function validateFamilyOutput(output, index, contractFingerprint) {
  const label = `family_outputs[${index}]`;
  if (!exactKeys(output, [
    'schema_version',
    'family_output_id',
    'family_id',
    'completion_state',
    'contract_fingerprint',
    'run_receipt_id',
    'resolution_receipt_id',
    'source_authority',
    'write_set',
  ])) {
    fail('INVALID_FAMILY_OUTPUT', `${label} must match the closed native-family output contract.`);
  }
  if (output.schema_version !== FAMILY_OUTPUT_SCHEMA) {
    fail('INVALID_FAMILY_OUTPUT', `${label}.schema_version must be ${FAMILY_OUTPUT_SCHEMA}.`);
  }
  string(output.family_id, `${label}.family_id`);
  digest(output.family_output_id, `${label}.family_output_id`);
  digest(output.contract_fingerprint, `${label}.contract_fingerprint`);
  digest(output.run_receipt_id, `${label}.run_receipt_id`);
  digest(output.resolution_receipt_id, `${label}.resolution_receipt_id`);
  if (output.contract_fingerprint !== contractFingerprint) {
    fail('CONTRACT_AUTHORITY_CONFLICT', `${label} does not bind the selected contract fingerprint.`);
  }
  if (output.completion_state !== 'COMPLETE') {
    fail('INCOMPLETE_FAMILY_SCOPE', `${label} is not complete.`, { family_id: output.family_id });
  }
  if (!Array.isArray(output.source_authority) || output.source_authority.length === 0) {
    fail('MISSING_SOURCE_AUTHORITY', `${label} must contain admitted source authority.`);
  }
  const authorities = output.source_authority.map((value, authorityIndex) => (
    validateSourceAuthority(value, `${label}.source_authority[${authorityIndex}]`)
  )).sort((left, right) => authorityKey(left).localeCompare(authorityKey(right)));
  if (new Set(authorities.map(authorityKey)).size !== authorities.length) {
    fail('DUPLICATE_SOURCE_AUTHORITY', `${label} repeats an admitted source authority.`);
  }
  const {
    family_output_id: familyOutputId,
    ...familyOutputBody
  } = { ...output, source_authority: authorities };
  if (familyOutputId !== contentId(FAMILY_OUTPUT_SCHEMA, familyOutputBody)) {
    fail('FAMILY_OUTPUT_ID_MISMATCH', `${label} does not match its sealed family output identity.`);
  }
  return { ...output, source_authority: authorities };
}

function objectWithoutClosure(row) {
  const { closure_id: ignored, ...object } = row;
  return object;
}

function composeRows(outputs, collection, identityField) {
  const rows = new Map();
  for (const output of outputs) {
    for (const row of output.write_set[collection]) {
      const id = row?.[identityField];
      if (typeof id !== 'string' || !id) {
        fail('UNIDENTIFIED_CANONICAL_OBJECT', `${output.family_id} ${collection} row has no governed identity.`);
      }
      if (typeof row?.closure_id !== 'string' || !row.closure_id) {
        fail('UNSEALED_CANONICAL_OBJECT', `${output.family_id} ${collection} ${id} has no publication closure.`);
      }
      const existing = rows.get(id);
      if (existing && canonicalJson(existing.object) !== canonicalJson(objectWithoutClosure(row))) {
        fail('CANONICAL_OBJECT_CONFLICT', `${collection} ${id} has conflicting canonical content.`);
      }
      if (!existing) rows.set(id, { object: objectWithoutClosure(row), closures: new Set([row.closure_id]) });
      else existing.closures.add(row.closure_id);
    }
  }
  return [...rows.entries()].map(([id, entry]) => ({
    ...entry.object,
    closure_id: entry.closures.size === 1
      ? [...entry.closures][0]
      : contentId('COMPOSED_OBJECT_PUBLICATION_CLOSURE/V1', {
        object_type: collection,
        object_id: id,
        contributing_closure_ids: [...entry.closures].sort(),
      }),
  })).sort((left, right) => left[identityField].localeCompare(right[identityField]));
}

function assertSameDeal(candidate, authoritative) {
  for (const field of ['deal_key', 'deal_admission_id', 'document_hash']) {
    if (candidate?.[field] !== authoritative?.[field]) {
      fail('DEAL_AUTHORITY_CONFLICT', `A family write set conflicts with the authoritative deal ${field}.`);
    }
  }
  for (const [key, value] of Object.entries(candidate.dimensions || {})) {
    const selected = authoritative.dimensions?.[key];
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    if (selected == null || canonicalJson(value) !== canonicalJson(selected)) {
      fail('DEAL_AUTHORITY_CONFLICT', `A family write set conflicts with authoritative deal dimension ${key}.`);
    }
  }
}

function sourceAuthorityByKey(outputs) {
  const authorities = new Map();
  for (const output of outputs) {
    for (const authority of output.source_authority) {
      const key = authorityKey(authority);
      const existing = authorities.get(key);
      if (existing && canonicalJson(existing) !== canonicalJson(authority)) {
        fail('SOURCE_AUTHORITY_CONFLICT', `Admitted source authority ${key} has conflicting canonical content.`);
      }
      authorities.set(key, authority);
    }
  }
  return authorities;
}

function composeDealScope(outputs, deal) {
  const sourceReferences = new Map();
  const allAuthorities = sourceAuthorityByKey(outputs);
  const sourceOrdinals = new Set();
  const sourceDocuments = new Set();
  const canonicalTexts = new Set();
  for (const output of outputs) {
    const writeSet = output.write_set;
    if (!exactKeys(writeSet, WRITE_SET_KEYS)) {
      fail('INVALID_FAMILY_WRITE_SET', `${output.family_id} must contain only a complete native deal-scope write set.`);
    }
    if (writeSet.write_set_origin !== 'NATIVE_PRODUCER') {
      fail('NON_NATIVE_FAMILY_OUTPUT', `${output.family_id} must be a native-producer write set.`);
    }
    if (!Array.isArray(writeSet.source_references) || writeSet.source_references.length === 0) {
      fail('MISSING_SOURCE_REFERENCE', `${output.family_id} has no admitted source references.`);
    }
    assertSameDeal(writeSet.deal, deal);
    for (const collection of Object.keys(COLLECTIONS)) {
      if (!Array.isArray(writeSet[collection])) {
        fail('INVALID_FAMILY_WRITE_SET', `${output.family_id}.${collection} must be an array.`);
      }
    }
    const permitted = new Map(output.source_authority.map((authority) => [authorityKey(authority), authority]));
    const usedAuthorities = new Set();
    for (const reference of writeSet.source_references) {
      if (!exactKeys(reference, SOURCE_REFERENCE_KEYS)
        || reference.schema_version !== 'ADMITTED_SOURCE_REFERENCE/V1') {
        fail('INVALID_SOURCE_REFERENCE', `${output.family_id} has a source reference outside the closed admitted-source contract.`);
      }
      const key = `${reference?.source_ordinal}\u0000${reference?.immutable_source_document_id}`;
      const authority = permitted.get(key);
      if (!authority
        || reference.source_admission_manifest_id !== authority.source_admission_manifest_id
        || reference.semantic_extraction_input_envelope_id !== authority.semantic_extraction_input_envelope_id
        || reference.canonical_text_id !== authority.canonical_text_id
        || reference.governed_deal_key !== deal.deal_key
        || reference.deal_admission_id !== deal.deal_admission_id) {
        fail('SOURCE_AUTHORITY_MISMATCH', `${output.family_id} has an unbound admitted source reference.`);
      }
      if (usedAuthorities.has(key)) {
        fail('DUPLICATE_SOURCE_REFERENCE', `${output.family_id} repeats an admitted source reference.`);
      }
      usedAuthorities.add(key);
      if (sourceReferences.has(key)
        && canonicalJson(sourceReferences.get(key)) !== canonicalJson(reference)) {
        fail('SOURCE_REFERENCE_CONFLICT', `Source reference ${key} has conflicting canonical content.`);
      }
      sourceReferences.set(key, reference);
    }
    if (usedAuthorities.size !== permitted.size) {
      fail('UNBOUND_SOURCE_AUTHORITY', `${output.family_id} declares admitted source authority that its write set does not use.`);
    }
    if (sourceReferences.size === 0) fail('MISSING_SOURCE_REFERENCE', 'No admitted source references were composed.');
  }

  for (const [key, reference] of sourceReferences) {
    if (!allAuthorities.has(key)
      || sourceOrdinals.has(reference.source_ordinal)
      || sourceDocuments.has(reference.immutable_source_document_id)
      || canonicalTexts.has(reference.canonical_text_id)) {
      fail(
        'SOURCE_REFERENCE_CONFLICT',
        'Composed source references require unique ordinals, source documents and canonical texts with exact authority.',
      );
    }
    sourceOrdinals.add(reference.source_ordinal);
    sourceDocuments.add(reference.immutable_source_document_id);
    canonicalTexts.add(reference.canonical_text_id);
  }

  return Object.freeze({
    source_references: Object.freeze([...sourceReferences.values()].sort((left, right) => (
      left.source_ordinal - right.source_ordinal
        || left.immutable_source_document_id.localeCompare(right.immutable_source_document_id)
    ))),
    deal,
    ...Object.fromEntries(Object.entries(COLLECTIONS).map(([collection, identityField]) => [
      collection,
      Object.freeze(composeRows(outputs, collection, identityField)),
    ])),
  });
}

function buildReceipt({ idempotencyKey, inputDigest, writeSet }) {
  const publishableObjectCount = Object.keys(COLLECTIONS).reduce(
    (count, collection) => count + writeSet[collection].length,
    0,
  );
  const body = {
    operation: WRITE_OPERATION,
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  return Object.freeze({
    receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', body),
    ...body,
  });
}

function buildM3StagingCandidatePreflight(input = {}) {
  if (!exactKeys(input, ['contract_fingerprint', 'candidates'])) {
    fail('INVALID_INPUT', 'M3 preflight input must contain only contract_fingerprint and sealed candidates.');
  }
  const {
    contract_fingerprint: contractFingerprint,
    candidates,
  } = input;
  digest(contractFingerprint, 'contract_fingerprint');
  if (!Array.isArray(candidates) || candidates.length === 0) {
    fail('INVALID_INPUT', 'candidates must be a non-empty array.');
  }
  const plans = candidates.map((candidate, index) => {
    const label = `candidates[${index}]`;
    if (!exactKeys(candidate, ['deal', 'family_outputs'])) {
      fail('INVALID_CANDIDATE', `${label} must match the closed candidate contract.`);
    }
    const required = listRegisteredSectionFamilies();
    if (!candidate.deal || typeof candidate.deal !== 'object' || Array.isArray(candidate.deal)) {
      fail('INVALID_CANDIDATE', `${label}.deal must be an authoritative deal record.`);
    }
    string(candidate.deal.deal_key, `${label}.deal.deal_key`);
    digest(candidate.deal.deal_admission_id, `${label}.deal.deal_admission_id`);
    digest(candidate.deal.document_hash, `${label}.deal.document_hash`);
    if (!Array.isArray(candidate.family_outputs)) fail('INVALID_CANDIDATE', `${label}.family_outputs must be an array.`);
    const outputs = candidate.family_outputs.map((output, outputIndex) => (
      validateFamilyOutput(output, outputIndex, contractFingerprint)
    ));
    const observed = outputs.map((output) => output.family_id).sort();
    if (new Set(observed).size !== observed.length || canonicalJson(observed) !== canonicalJson(required)) {
      fail('INCOMPLETE_FAMILY_SCOPE', `${label} must contain one COMPLETE output for every required family and no others.`, {
        required_family_ids: required,
        observed_family_ids: observed,
      });
    }
    const writeSet = composeDealScope(outputs, candidate.deal);
    const sourceAuthorityDigest = contentId(
      'M3_STAGING_SOURCE_AUTHORITY/V1',
      [...sourceAuthorityByKey(outputs).values()].sort((left, right) => authorityKey(left).localeCompare(authorityKey(right))),
    );
    const familyScopeDigest = contentId('M3_STAGING_FAMILY_SCOPE/V1', required);
    const candidateKey = contentId(DEAL_CANDIDATE_SCHEMA, {
      contract_fingerprint: contractFingerprint,
      deal_key: candidate.deal.deal_key,
      deal_admission_id: candidate.deal.deal_admission_id,
      document_hash: candidate.deal.document_hash,
      family_output_ids: outputs.map((output) => output.family_output_id).sort(),
      source_authority_digest: sourceAuthorityDigest,
      family_scope_digest: familyScopeDigest,
      write_set: writeSet,
    });
    const idempotencyKey = `M3_STAGING_DEAL_SCOPE/${contractFingerprint}/${candidateKey}`;
    const inputDigest = buildCanonicalWriteInputDigest({
      operation: WRITE_OPERATION,
      idempotencyKey,
      writeSet,
      residuals: [],
      quarantines: [],
    });
    return Object.freeze({
      candidate_key: candidateKey,
      deal_key: candidate.deal.deal_key,
      source_authority_digest: sourceAuthorityDigest,
      family_scope_digest: familyScopeDigest,
      idempotency_key: idempotencyKey,
      input_digest: inputDigest,
      transaction_policy: 'ROLLBACK',
      durable_write_authority: 'NONE',
      write_set: writeSet,
      receipt: buildReceipt({ idempotencyKey, inputDigest, writeSet }),
    });
  });
  const orderedPlans = plans.sort((left, right) => left.candidate_key.localeCompare(right.candidate_key));
  const keys = orderedPlans.map((plan) => plan.candidate_key);
  if (new Set(keys).size !== keys.length) fail('DUPLICATE_CANDIDATE_KEY', 'candidate_key must be unique.');
  const candidateSetId = contentId(CANDIDATE_SET_SCHEMA, {
    contract_fingerprint: contractFingerprint,
    candidate_ids: keys,
  });
  const body = {
    schema_version: SCHEMA_VERSION,
    candidate_set_id: candidateSetId,
    contract_fingerprint: contractFingerprint,
    authority_scope: 'ROLLBACK_ONLY_ISOLATED_STAGING',
    durable_write_authority: 'NONE',
    plans: orderedPlans,
  };
  return Object.freeze({
    ...body,
    m3_staging_candidate_preflight_id: contentId(SCHEMA_VERSION, body),
  });
}

module.exports = {
  CANDIDATE_SET_SCHEMA,
  COLLECTIONS,
  DEAL_CANDIDATE_SCHEMA,
  FAMILY_OUTPUT_SCHEMA,
  M3StagingCandidateError,
  SCHEMA_VERSION,
  WRITE_OPERATION,
  buildM3StagingCandidatePreflight,
};
