const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
} = require('./post-scope-claim-correction');

const SHA256_RE = /^[a-f0-9]{64}$/;
const CORRECTION_OUTPUT_KEYS = [
  'corrected_write_set',
  'correction',
  'approval',
  'application',
  'lineage',
  'predecessor_claim_revision',
  'successor_claim_revision',
  'validation',
];
const OUTPUT_REF_KEYS = [
  'schema_version',
  'role',
  'logical_type',
  'stable_key',
  'immutable_id',
  'canonical_payload_digest',
  'correction_output_ref_id',
];

class CandidateCorrectionInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CandidateCorrectionInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CandidateCorrectionInputError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_CORRECTION_INPUT', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_CORRECTION_INPUT', `${label} fields do not match the correction input contract.`, { label });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_CORRECTION_INPUT', `${label} must be a SHA-256 content ID.`, { label });
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_CORRECTION_INPUT', `${label} must be a non-empty string.`, { label });
  }
  return value.trim();
}

function uniqueSortedDigests(values, label, duplicateCode = 'DUPLICATE_CORRECTION_INPUT') {
  if (!Array.isArray(values)) fail('INVALID_CORRECTION_INPUT', `${label} must be an array.`, { label });
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`)).sort();
  if (new Set(selected).size !== selected.length) {
    fail(duplicateCode, `${label} contains a duplicate identity.`, { label });
  }
  return selected;
}

function payloadDigest(domain, value) {
  return contentId(domain, value);
}

function validateCorrectionIdentity(correction) {
  const rebuilt = buildPostScopeClaimCorrection(correction);
  if (canonicalJson(rebuilt) !== canonicalJson(correction)) {
    fail('STALE_CORRECTION_INPUT', 'Correction identity or payload is stale.');
  }
  return rebuilt;
}

function validateApprovalIdentity(correction, approval) {
  const rebuilt = buildCorrectionApprovalAttestation({ ...approval, correction });
  if (canonicalJson(rebuilt) !== canonicalJson(approval) || rebuilt.decision !== 'PASS') {
    fail('STALE_CORRECTION_INPUT', 'Correction approval is stale, mismatched or non-passing.');
  }
  return rebuilt;
}

function validateApplicationIdentity(correction, approval, application) {
  requireExactKeys(application, [
    'schema_version',
    'stage',
    'correction_id',
    'correction_approval_attestation_id',
    'correction_slot_key',
    'target_ref',
    'target_ref_digest',
    'affected_subject',
    'application_rule_version',
    'correction_application_id',
  ], 'correction application');
  const { correction_application_id: applicationId, ...body } = application;
  if (application.schema_version !== 'POST_SCOPE_CORRECTION_APPLICATION/V1'
    || application.stage !== 'POST_SCOPE'
    || application.correction_id !== correction.correction_id
    || application.correction_approval_attestation_id !== approval.correction_approval_attestation_id
    || application.target_ref_digest !== contentId('CORRECTION_TARGET_REF/V1', application.target_ref)
    || application.target_ref?.revision_id !== correction.target.expected_claim_revision_id
    || application.target_ref?.occurrence_id !== correction.target.claim_occurrence_id
    || application.affected_subject?.deal_key !== correction.target.deal_key
    || application.affected_subject?.subject_occurrence_id !== correction.target.subject_occurrence_id
    || application.affected_subject?.claim_occurrence_id !== correction.target.claim_occurrence_id
    || applicationId !== contentId('POST_SCOPE_CORRECTION_APPLICATION/V1', body)) {
    fail('STALE_CORRECTION_INPUT', 'Correction application does not bind the exact approved target.');
  }
  return application;
}

function validateLineageIdentity(application, predecessor, successor, lineage) {
  requireExactKeys(lineage, [
    'schema_version',
    'correction_application_id',
    'predecessor_claim_revision_id',
    'predecessor_claim_payload_digest',
    'successor_claim_revision_id',
    'successor_claim_payload_digest',
    'post_scope_claim_revision_lineage_id',
  ], 'correction lineage');
  const { post_scope_claim_revision_lineage_id: lineageId, ...body } = lineage;
  if (lineage.schema_version !== 'POST_SCOPE_CLAIM_REVISION_LINEAGE/V1'
    || lineage.correction_application_id !== application.correction_application_id
    || lineage.predecessor_claim_revision_id !== predecessor.claim_revision_id
    || lineage.predecessor_claim_payload_digest !== claimPayloadDigest(predecessor)
    || lineage.successor_claim_revision_id !== successor.claim_revision_id
    || lineage.successor_claim_payload_digest !== claimPayloadDigest(successor)
    || lineageId !== contentId('POST_SCOPE_CLAIM_REVISION_LINEAGE/V1', body)) {
    fail('STALE_CORRECTION_INPUT', 'Correction lineage does not bind its exact predecessor and successor.');
  }
  return lineage;
}

function reproduceCorrectionOutput(correctionOutput, contractBundle) {
  requireExactKeys(correctionOutput, CORRECTION_OUTPUT_KEYS, 'correction output');
  const correction = validateCorrectionIdentity(correctionOutput.correction);
  const approval = validateApprovalIdentity(correction, correctionOutput.approval);
  const application = validateApplicationIdentity(correction, approval, correctionOutput.application);
  const predecessor = requireObject(correctionOutput.predecessor_claim_revision, 'predecessor claim');
  const successor = requireObject(correctionOutput.successor_claim_revision, 'successor claim');
  validateLineageIdentity(application, predecessor, successor, correctionOutput.lineage);

  const correctedWriteSet = requireObject(correctionOutput.corrected_write_set, 'corrected write set');
  if (!Array.isArray(correctedWriteSet.claims)) {
    fail('STALE_CORRECTION_INPUT', 'Corrected write set has no complete claim collection.');
  }
  const terminalClaims = correctedWriteSet.claims.filter(
    (claim) => claim.claim_occurrence_id === successor.claim_occurrence_id,
  );
  if (terminalClaims.length !== 1
    || canonicalJson(terminalClaims[0]) !== canonicalJson(successor)
    || successor.claim_occurrence_id !== predecessor.claim_occurrence_id
    || successor.claim_revision_id === predecessor.claim_revision_id) {
    fail('STALE_CORRECTION_INPUT', 'Corrected write set does not select exactly one successor for the governed occurrence.');
  }

  const predecessorWriteSet = clone(correctedWriteSet);
  predecessorWriteSet.claims = predecessorWriteSet.claims.map((claim) => (
    claim.claim_revision_id === successor.claim_revision_id ? clone(predecessor) : claim
  ));
  let reproduced;
  try {
    reproduced = applyApprovedPostScopeClaimCorrection({
      writeSet: predecessorWriteSet,
      correction,
      approval,
      contractBundle,
    });
  } catch (error) {
    fail('STALE_CORRECTION_INPUT', 'Correction output cannot be reproduced from its immutable predecessor.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (canonicalJson(reproduced) !== canonicalJson(correctionOutput)) {
    fail('STALE_CORRECTION_INPUT', 'Correction output differs from deterministic reapplication.');
  }
  return correctionOutput;
}

function buildCorrectionOutputRef({
  role,
  logical_type: logicalType,
  stable_key: stableKey,
  immutable_id: immutableId,
  canonical_payload_digest: canonicalPayloadDigest,
} = {}) {
  if (!['PRIMARY', 'CONSISTENCY'].includes(role)) {
    fail('INVALID_CORRECTION_OUTPUT_REF', 'Correction output role must be PRIMARY or CONSISTENCY.');
  }
  const body = {
    schema_version: 'CORRECTION_OUTPUT_REF/V1',
    role,
    logical_type: requireText(logicalType, 'logical_type'),
    stable_key: requireText(stableKey, 'stable_key'),
    immutable_id: requireDigest(immutableId, 'immutable_id'),
    canonical_payload_digest: requireDigest(canonicalPayloadDigest, 'canonical_payload_digest'),
  };
  return deepFreeze({
    ...body,
    correction_output_ref_id: contentId('CORRECTION_OUTPUT_REF/V1', body),
  });
}

function validateCorrectionOutputRef(ref, requiredRole = null) {
  requireExactKeys(ref, OUTPUT_REF_KEYS, 'correction output ref');
  const rebuilt = buildCorrectionOutputRef(ref);
  if (canonicalJson(rebuilt) !== canonicalJson(ref) || (requiredRole && ref.role !== requiredRole)) {
    fail('INVALID_CORRECTION_OUTPUT_REF', 'Correction output ref identity or role is invalid.');
  }
  return rebuilt;
}

function sortedOutputRefs(refs, requiredRole) {
  if (!Array.isArray(refs)) fail('INVALID_CORRECTION_OUTPUT_REF', 'Correction output refs must be an array.');
  const selected = refs.map((ref) => validateCorrectionOutputRef(ref, requiredRole))
    .sort((left, right) => left.correction_output_ref_id.localeCompare(right.correction_output_ref_id));
  if (new Set(selected.map((ref) => ref.correction_output_ref_id)).size !== selected.length) {
    fail('DUPLICATE_CORRECTION_INPUT', 'Correction output refs contain a duplicate.');
  }
  return selected;
}

function buildCorrectionDischarge({
  correction_output: correctionOutput,
  contract_bundle: contractBundle,
  consistency_output_refs: consistencyOutputRefs = [],
} = {}) {
  validateContractBundle(contractBundle);
  const selected = reproduceCorrectionOutput(correctionOutput, contractBundle);
  const application = selected.application;
  const predecessor = selected.predecessor_claim_revision;
  const successor = selected.successor_claim_revision;
  const primaryOutputRefs = [buildCorrectionOutputRef({
    role: 'PRIMARY',
    logical_type: 'CLAIM_REVISION',
    stable_key: successor.claim_occurrence_id,
    immutable_id: successor.claim_revision_id,
    canonical_payload_digest: claimPayloadDigest(successor),
  })];
  const consistencyRefs = sortedOutputRefs(consistencyOutputRefs, 'CONSISTENCY');
  const allIds = [...primaryOutputRefs, ...consistencyRefs].map((ref) => ref.correction_output_ref_id);
  if (new Set(allIds).size !== allIds.length) {
    fail('DUPLICATE_CORRECTION_INPUT', 'Primary and consistency output refs overlap.');
  }
  const beforePatchAfterProofDigest = contentId('CORRECTION_BEFORE_PATCH_AFTER_PROOF/V1', {
    correction_application_id: application.correction_application_id,
    predecessor_claim_revision_id: predecessor.claim_revision_id,
    predecessor_claim_payload_digest: claimPayloadDigest(predecessor),
    canonical_patch: selected.correction.patch,
    successor_claim_revision_id: successor.claim_revision_id,
    successor_claim_payload_digest: claimPayloadDigest(successor),
  });
  const body = {
    schema_version: 'CORRECTION_DISCHARGE/V1',
    stage: 'POST_SCOPE',
    contract_fingerprint: contractBundle.fingerprint,
    correction_id: selected.correction.correction_id,
    correction_approval_attestation_id: selected.approval.correction_approval_attestation_id,
    correction_application_id: application.correction_application_id,
    correction_lineage_id: selected.lineage.post_scope_claim_revision_lineage_id,
    target_ref_digest: application.target_ref_digest,
    predecessor_claim_revision_id: predecessor.claim_revision_id,
    predecessor_claim_payload_digest: claimPayloadDigest(predecessor),
    successor_claim_revision_id: successor.claim_revision_id,
    successor_claim_payload_digest: claimPayloadDigest(successor),
    ordered_primary_output_refs: primaryOutputRefs,
    ordered_consistency_output_refs: consistencyRefs,
    before_patch_after_proof_digest: beforePatchAfterProofDigest,
    evaluator_version: 'canonical-v2/offline-correction-discharge/v1',
    status: 'PASS',
  };
  const canonicalPayloadDigest = payloadDigest('CORRECTION_DISCHARGE_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_discharge_id: contentId('CORRECTION_DISCHARGE/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCorrectionDischarge({ discharge, correction_output: correctionOutput, contract_bundle: contractBundle } = {}) {
  validateCorrectionDischargeIdentity(discharge);
  const expected = buildCorrectionDischarge({
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
    consistency_output_refs: discharge.ordered_consistency_output_refs,
  });
  if (canonicalJson(expected) !== canonicalJson(discharge)) {
    fail('INVALID_CORRECTION_DISCHARGE', 'Correction discharge is stale or does not bind its exact outputs.');
  }
  return true;
}

function validateCorrectionDischargeIdentity(discharge) {
  requireExactKeys(discharge, [
    'schema_version',
    'stage',
    'contract_fingerprint',
    'correction_id',
    'correction_approval_attestation_id',
    'correction_application_id',
    'correction_lineage_id',
    'target_ref_digest',
    'predecessor_claim_revision_id',
    'predecessor_claim_payload_digest',
    'successor_claim_revision_id',
    'successor_claim_payload_digest',
    'ordered_primary_output_refs',
    'ordered_consistency_output_refs',
    'before_patch_after_proof_digest',
    'evaluator_version',
    'status',
    'canonical_payload_digest',
    'correction_discharge_id',
  ], 'correction discharge');
  if (!Array.isArray(discharge.ordered_primary_output_refs)
    || discharge.ordered_primary_output_refs.length !== 1) {
    fail('INVALID_CORRECTION_DISCHARGE', 'Correction discharge requires exactly one primary output.');
  }
  validateCorrectionOutputRef(discharge.ordered_primary_output_refs[0], 'PRIMARY');
  const sortedConsistencyRefs = sortedOutputRefs(discharge.ordered_consistency_output_refs, 'CONSISTENCY');
  const { canonical_payload_digest: payloadId, correction_discharge_id: dischargeId, ...body } = discharge;
  const expectedPayloadId = payloadDigest('CORRECTION_DISCHARGE_PAYLOAD/V1', body);
  if (discharge.schema_version !== 'CORRECTION_DISCHARGE/V1'
    || discharge.stage !== 'POST_SCOPE'
    || discharge.status !== 'PASS'
    || discharge.evaluator_version !== 'canonical-v2/offline-correction-discharge/v1'
    || canonicalJson(discharge.ordered_consistency_output_refs) !== canonicalJson(sortedConsistencyRefs)
    || payloadId !== expectedPayloadId
    || dischargeId !== contentId('CORRECTION_DISCHARGE/V1', {
      ...body,
      canonical_payload_digest: expectedPayloadId,
    })) {
    fail('INVALID_CORRECTION_DISCHARGE', 'Correction discharge identity or payload digest is invalid.');
  }
  return true;
}

function materialisationEntry(materialisation, contractBundle) {
  requireExactKeys(materialisation, ['correction_output', 'correction_discharge'], 'correction materialisation');
  const output = reproduceCorrectionOutput(materialisation.correction_output, contractBundle);
  validateCorrectionDischarge({
    discharge: materialisation.correction_discharge,
    correction_output: output,
    contract_bundle: contractBundle,
  });
  const discharge = materialisation.correction_discharge;
  const applicationBody = clone(output.application);
  delete applicationBody.correction_application_id;
  const lineageBody = clone(output.lineage);
  delete lineageBody.post_scope_claim_revision_lineage_id;
  return {
    correction_application_id: output.application.correction_application_id,
    correction_application_payload_digest: payloadDigest(
      'POST_SCOPE_CORRECTION_APPLICATION_PAYLOAD/V1',
      applicationBody,
    ),
    correction_id: output.correction.correction_id,
    correction_payload_digest: output.correction.canonical_payload_digest,
    superseded_correction_ids: [...output.correction.superseded_correction_ids],
    correction_approval_attestation_id: output.approval.correction_approval_attestation_id,
    correction_approval_payload_digest: payloadDigest('CORRECTION_APPROVAL_ATTESTATION_PAYLOAD/V1', (() => {
      const body = clone(output.approval);
      delete body.correction_approval_attestation_id;
      return body;
    })()),
    correction_lineage_id: output.lineage.post_scope_claim_revision_lineage_id,
    correction_lineage_payload_digest: payloadDigest('POST_SCOPE_CLAIM_REVISION_LINEAGE_PAYLOAD/V1', lineageBody),
    governed_deal_key: output.application.affected_subject.deal_key,
    subject_occurrence_id: output.application.affected_subject.subject_occurrence_id,
    claim_occurrence_id: output.application.affected_subject.claim_occurrence_id,
    predecessor_claim_revision_id: output.predecessor_claim_revision.claim_revision_id,
    predecessor_claim_payload_digest: claimPayloadDigest(output.predecessor_claim_revision),
    successor_claim_revision_id: output.successor_claim_revision.claim_revision_id,
    successor_claim_payload_digest: claimPayloadDigest(output.successor_claim_revision),
    correction_discharge_id: discharge.correction_discharge_id,
    correction_discharge_payload_digest: discharge.canonical_payload_digest,
    primary_output_ref_ids: discharge.ordered_primary_output_refs.map((ref) => ref.correction_output_ref_id),
    consistency_output_ref_ids: discharge.ordered_consistency_output_refs.map((ref) => ref.correction_output_ref_id),
  };
}

const ENTRY_KEYS = [
  'correction_application_id',
  'correction_application_payload_digest',
  'correction_id',
  'correction_payload_digest',
  'superseded_correction_ids',
  'correction_approval_attestation_id',
  'correction_approval_payload_digest',
  'correction_lineage_id',
  'correction_lineage_payload_digest',
  'governed_deal_key',
  'subject_occurrence_id',
  'claim_occurrence_id',
  'predecessor_claim_revision_id',
  'predecessor_claim_payload_digest',
  'successor_claim_revision_id',
  'successor_claim_payload_digest',
  'correction_discharge_id',
  'correction_discharge_payload_digest',
  'primary_output_ref_ids',
  'consistency_output_ref_ids',
];

function validateSealEntry(entry, index) {
  requireExactKeys(entry, ENTRY_KEYS, `correction_entries[${index}]`);
  for (const key of ENTRY_KEYS.filter((key) => ![
    'governed_deal_key', 'superseded_correction_ids', 'primary_output_ref_ids', 'consistency_output_ref_ids',
  ].includes(key))) requireDigest(entry[key], `correction_entries[${index}].${key}`);
  requireText(entry.governed_deal_key, `correction_entries[${index}].governed_deal_key`);
  const superseded = uniqueSortedDigests(
    entry.superseded_correction_ids,
    `correction_entries[${index}].superseded_correction_ids`,
  );
  const primary = uniqueSortedDigests(entry.primary_output_ref_ids, `correction_entries[${index}].primary_output_ref_ids`);
  if (primary.length !== 1) fail('INVALID_CORRECTION_INPUT_SEAL', 'Each correction entry requires one primary output ref.');
  const consistency = uniqueSortedDigests(
    entry.consistency_output_ref_ids,
    `correction_entries[${index}].consistency_output_ref_ids`,
  );
  if (canonicalJson(superseded) !== canonicalJson(entry.superseded_correction_ids)
    || canonicalJson(primary) !== canonicalJson(entry.primary_output_ref_ids)
    || canonicalJson(consistency) !== canonicalJson(entry.consistency_output_ref_ids)) {
    fail('INVALID_CORRECTION_INPUT_SEAL', 'Correction entry identity sets are not in canonical order.');
  }
}

function assertNoActiveSupersession(entries) {
  const activeCorrectionIds = new Set(entries.map((entry) => entry.correction_id));
  const conflict = entries.find((entry) => (
    entry.superseded_correction_ids.some((correctionId) => activeCorrectionIds.has(correctionId))
  ));
  if (conflict) {
    fail('SUPERSEDED_CORRECTION_INPUT', 'An active correction supersedes another correction in the active set.', {
      correction_application_id: conflict.correction_application_id,
    });
  }
  const occurrenceKeys = entries.map((entry) => canonicalJson({
    governed_deal_key: entry.governed_deal_key,
    subject_occurrence_id: entry.subject_occurrence_id,
    claim_occurrence_id: entry.claim_occurrence_id,
  }));
  if (new Set(occurrenceKeys).size !== occurrenceKeys.length) {
    fail('CONFLICTING_CORRECTION_INPUT', 'More than one active correction targets the same governed claim occurrence.');
  }
}

function buildCandidateCorrectionInputSeal({
  contract_bundle: contractBundle,
  expected_active_application_ids: expectedActiveApplicationIds,
  correction_materialisations: correctionMaterialisations,
} = {}) {
  validateContractBundle(contractBundle);
  const expectedIds = uniqueSortedDigests(
    expectedActiveApplicationIds,
    'expected_active_application_ids',
  );
  if (!Array.isArray(correctionMaterialisations)) {
    fail('INVALID_CORRECTION_INPUT', 'correction_materialisations must be an array, including when empty.');
  }
  const entries = correctionMaterialisations.map((materialisation) => (
    materialisationEntry(materialisation, contractBundle)
  )).sort((left, right) => left.correction_application_id.localeCompare(right.correction_application_id));
  const actualIds = entries.map((entry) => entry.correction_application_id);
  if (new Set(actualIds).size !== actualIds.length
    || new Set(entries.map((entry) => entry.correction_id)).size !== entries.length
    || new Set(entries.map((entry) => entry.correction_discharge_id)).size !== entries.length) {
    fail('DUPLICATE_CORRECTION_INPUT', 'Correction materialisations contain duplicate active identities.');
  }
  const missingApplicationIds = expectedIds.filter((id) => !actualIds.includes(id));
  const extraApplicationIds = actualIds.filter((id) => !expectedIds.includes(id));
  if (missingApplicationIds.length || extraApplicationIds.length) {
    fail('INCOMPLETE_CORRECTION_INPUT', 'Correction materialisations do not equal the expected active application set.', {
      missing_application_ids: missingApplicationIds,
      extra_application_ids: extraApplicationIds,
    });
  }
  assertNoActiveSupersession(entries);
  const roots = {
    expected_active_application_root: contentId('EXPECTED_ACTIVE_CORRECTION_APPLICATION_ROOT/V1', expectedIds),
    correction_entry_root: contentId('CANDIDATE_CORRECTION_ENTRY_ROOT/V1', entries),
    correction_discharge_root: contentId('CANDIDATE_CORRECTION_DISCHARGE_ROOT/V1', entries.map((entry) => ({
      correction_application_id: entry.correction_application_id,
      correction_discharge_id: entry.correction_discharge_id,
      correction_discharge_payload_digest: entry.correction_discharge_payload_digest,
    }))),
  };
  const body = {
    schema_version: 'CANDIDATE_CORRECTION_INPUT_SEAL/V1',
    contract_fingerprint: contractBundle.fingerprint,
    expected_active_application_ids: expectedIds,
    correction_entries: entries,
    counts: {
      expected_active_applications: expectedIds.length,
      correction_entries: entries.length,
      correction_discharges: entries.length,
      missing: 0,
      extra: 0,
      duplicates: 0,
      active_superseded: 0,
    },
    roots,
    status: 'PASS',
  };
  const canonicalPayloadDigest = payloadDigest('CANDIDATE_CORRECTION_INPUT_SEAL_PAYLOAD/V1', body);
  const seal = deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    candidate_correction_input_seal_id: contentId('CANDIDATE_CORRECTION_INPUT_SEAL/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
  validateCandidateCorrectionInputSeal(seal);
  return seal;
}

function validateCandidateCorrectionInputSeal(seal) {
  requireExactKeys(seal, [
    'schema_version',
    'contract_fingerprint',
    'expected_active_application_ids',
    'correction_entries',
    'counts',
    'roots',
    'status',
    'canonical_payload_digest',
    'candidate_correction_input_seal_id',
  ], 'candidate correction input seal');
  requireDigest(seal.contract_fingerprint, 'contract_fingerprint');
  const expectedIds = uniqueSortedDigests(seal.expected_active_application_ids, 'expected_active_application_ids');
  if (canonicalJson(expectedIds) !== canonicalJson(seal.expected_active_application_ids)
    || !Array.isArray(seal.correction_entries)) {
    fail('INVALID_CORRECTION_INPUT_SEAL', 'Correction seal application and entry sets must be canonical arrays.');
  }
  seal.correction_entries.forEach(validateSealEntry);
  const entries = [...seal.correction_entries].sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  if (canonicalJson(entries) !== canonicalJson(seal.correction_entries)
    || new Set(entries.map((entry) => entry.correction_application_id)).size !== entries.length
    || canonicalJson(entries.map((entry) => entry.correction_application_id)) !== canonicalJson(expectedIds)) {
    fail('INVALID_CORRECTION_INPUT_SEAL', 'Correction seal does not contain exactly one entry per expected application.');
  }
  assertNoActiveSupersession(entries);
  requireExactKeys(seal.counts, [
    'expected_active_applications',
    'correction_entries',
    'correction_discharges',
    'missing',
    'extra',
    'duplicates',
    'active_superseded',
  ], 'candidate correction input seal counts');
  requireExactKeys(seal.roots, [
    'expected_active_application_root',
    'correction_entry_root',
    'correction_discharge_root',
  ], 'candidate correction input seal roots');
  const expectedRoots = {
    expected_active_application_root: contentId('EXPECTED_ACTIVE_CORRECTION_APPLICATION_ROOT/V1', expectedIds),
    correction_entry_root: contentId('CANDIDATE_CORRECTION_ENTRY_ROOT/V1', entries),
    correction_discharge_root: contentId('CANDIDATE_CORRECTION_DISCHARGE_ROOT/V1', entries.map((entry) => ({
      correction_application_id: entry.correction_application_id,
      correction_discharge_id: entry.correction_discharge_id,
      correction_discharge_payload_digest: entry.correction_discharge_payload_digest,
    }))),
  };
  const expectedCounts = {
    expected_active_applications: expectedIds.length,
    correction_entries: entries.length,
    correction_discharges: entries.length,
    missing: 0,
    extra: 0,
    duplicates: 0,
    active_superseded: 0,
  };
  const { canonical_payload_digest: payloadId, candidate_correction_input_seal_id: sealId, ...body } = seal;
  const expectedPayloadId = payloadDigest('CANDIDATE_CORRECTION_INPUT_SEAL_PAYLOAD/V1', body);
  if (seal.schema_version !== 'CANDIDATE_CORRECTION_INPUT_SEAL/V1'
    || seal.status !== 'PASS'
    || canonicalJson(seal.roots) !== canonicalJson(expectedRoots)
    || canonicalJson(seal.counts) !== canonicalJson(expectedCounts)
    || payloadId !== expectedPayloadId
    || sealId !== contentId('CANDIDATE_CORRECTION_INPUT_SEAL/V1', {
      ...body,
      canonical_payload_digest: expectedPayloadId,
    })) {
    fail('INVALID_CORRECTION_INPUT_SEAL', 'Candidate correction input seal identity or closure is invalid.');
  }
  return true;
}

module.exports = {
  CandidateCorrectionInputError,
  buildCandidateCorrectionInputSeal,
  buildCorrectionDischarge,
  buildCorrectionOutputRef,
  validateCandidateCorrectionInputSeal,
  validateCorrectionDischarge,
  validateCorrectionDischargeIdentity,
};
