const { canonicalJson, contentId } = require('./canonical-bytes');
const { EVIDENCE_ROLES, buildClaimRevision } = require('./claims-relationships');
const { validateCanonicalWriteSet } = require('./validate-write-set');

const SHA256_RE = /^[a-f0-9]{64}$/;
const STAGE = 'POST_SCOPE';
const SLOT_KEY = 'POST_SCOPE_CLAIM_VALUE_OR_EVIDENCE';
const PATCH_KEYS = new Set([
  'raw_value',
  'canonical_value',
  'unit',
  'day_basis',
  'denominator',
  'evidence',
  'normalisation_version',
  'derivation_version',
]);
const TARGET_KEYS = [
  'deal_key',
  'deal_admission_id',
  'document_hash',
  'subject_occurrence_id',
  'claim_occurrence_id',
  'expected_claim_revision_id',
  'expected_claim_payload_digest',
];

class PostScopeCorrectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PostScopeCorrectionError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', `${label} has invalid fields.`, { label });
  }
}

function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', `${label} must be a non-empty string.`, { label });
  }
  return value.trim();
}

function digest(value, label) {
  const selected = string(value, label);
  if (!SHA256_RE.test(selected)) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', `${label} must be a SHA-256 content ID.`, { label });
  }
  return selected;
}

function claimPayload(claim) {
  const { closure_id: ignored, ...payload } = claim;
  return payload;
}

function claimPayloadDigest(claim) {
  return contentId('CLAIM_REVISION_CANONICAL_PAYLOAD/V1', claimPayload(claim));
}

function normaliseEvidence(evidence) {
  if (!Array.isArray(evidence)) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', 'patch.evidence must be an array.');
  }
  const rows = evidence.map((edge, index) => {
    if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
      throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', `patch.evidence[${index}] must be an object.`);
    }
    const row = {
      evidence_role: string(edge.evidence_role, `patch.evidence[${index}].evidence_role`),
      excerpt_id: digest(edge.excerpt_id, `patch.evidence[${index}].excerpt_id`),
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
    };
    if (!EVIDENCE_ROLES.includes(row.evidence_role)
      || !Number.isInteger(row.document_ordinal) || row.document_ordinal < 0
      || !Number.isInteger(row.absolute_start) || row.absolute_start < 0
      || !Number.isInteger(row.absolute_end) || row.absolute_end <= row.absolute_start) {
      throw new PostScopeCorrectionError(
        'INVALID_CORRECTION_CONTRACT',
        `patch.evidence[${index}] has invalid governed source order.`,
      );
    }
    return row;
  }).sort((left, right) => (
    left.document_ordinal - right.document_ordinal
      || left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.evidence_role.localeCompare(right.evidence_role)
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  const identities = rows.map((row) => canonicalJson(row));
  if (new Set(identities).size !== identities.length) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', 'patch.evidence contains a duplicate edge.');
  }
  return rows;
}

function validateTarget(target) {
  exactObject(target, TARGET_KEYS, 'target');
  string(target.deal_key, 'target.deal_key');
  for (const key of TARGET_KEYS.filter((key) => key !== 'deal_key')) digest(target[key], `target.${key}`);
  return clone(target);
}

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', 'patch must be an object.');
  }
  const keys = Object.keys(patch);
  const unknown = keys.filter((key) => !PATCH_KEYS.has(key));
  if (keys.length === 0 || unknown.length > 0 || keys.some((key) => patch[key] === undefined)) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', 'patch is empty or contains fields outside the slot contract.', {
      unknown_keys: unknown.sort(),
    });
  }
  const selected = clone(patch);
  if (Object.hasOwn(selected, 'evidence')) selected.evidence = normaliseEvidence(selected.evidence);
  for (const key of ['normalisation_version', 'derivation_version']) {
    if (Object.hasOwn(selected, key)) selected[key] = string(selected[key], `patch.${key}`);
  }
  return selected;
}

function correctionBody(input) {
  if (input.stage !== undefined && input.stage !== STAGE) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_STAGE', 'Only post-scope corrections are permitted.');
  }
  if (input.correction_slot_key !== undefined && input.correction_slot_key !== SLOT_KEY) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_SLOT', 'The correction slot is not permitted by this contract.');
  }
  const superseded = [...(input.superseded_correction_ids || [])].map((id, index) => (
    digest(id, `superseded_correction_ids[${index}]`)
  )).sort();
  if (new Set(superseded).size !== superseded.length) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_CONTRACT', 'superseded correction IDs must be unique.');
  }
  return {
    schema_version: 'POST_SCOPE_CLAIM_CORRECTION/V1',
    stage: STAGE,
    correction_slot_key: SLOT_KEY,
    correction_rule_version: string(input.correction_rule_version || 'canonical-v2/post-scope-claim/v1', 'correction_rule_version'),
    target: validateTarget(input.target),
    patch: validatePatch(input.patch),
    superseded_correction_ids: superseded,
  };
}

function buildPostScopeClaimCorrection(input = {}) {
  const body = correctionBody(input);
  const canonicalPayloadDigest = contentId('POST_SCOPE_CLAIM_CORRECTION_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_id: contentId('POST_SCOPE_CLAIM_CORRECTION/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCorrection(correction) {
  exactObject(correction, [
    'schema_version', 'stage', 'correction_slot_key', 'correction_rule_version', 'target', 'patch',
    'superseded_correction_ids', 'canonical_payload_digest', 'correction_id',
  ], 'correction');
  const rebuilt = buildPostScopeClaimCorrection(correction);
  if (canonicalJson(rebuilt) !== canonicalJson(correction)) {
    throw new PostScopeCorrectionError('INVALID_CORRECTION_IDENTITY', 'Correction identity or payload digest does not match its content.');
  }
  return rebuilt;
}

function approvalBody({ correction, approval_policy_version, reviewer_id,
  reviewer_eligibility_evidence_digest, authorisation_evidence_digest, decision, reason_digest }) {
  const selectedCorrection = validateCorrection(correction);
  if (!['PASS', 'FAIL'].includes(decision)) {
    throw new PostScopeCorrectionError('INVALID_APPROVAL_ATTESTATION', 'Approval decision must be PASS or FAIL.');
  }
  return {
    schema_version: 'CORRECTION_APPROVAL_ATTESTATION/V1',
    stage: STAGE,
    approval_policy_version: string(approval_policy_version || 'canonical-v2/correction-approval/v1', 'approval_policy_version'),
    correction_id: selectedCorrection.correction_id,
    correction_payload_digest: selectedCorrection.canonical_payload_digest,
    target_digest: contentId('POST_SCOPE_CLAIM_CORRECTION_TARGET/V1', selectedCorrection.target),
    reviewer_id: string(reviewer_id, 'reviewer_id'),
    reviewer_eligibility_evidence_digest: digest(reviewer_eligibility_evidence_digest, 'reviewer_eligibility_evidence_digest'),
    authorisation_evidence_digest: digest(authorisation_evidence_digest, 'authorisation_evidence_digest'),
    decision,
    reason_digest: digest(reason_digest, 'reason_digest'),
  };
}

function buildCorrectionApprovalAttestation(input = {}) {
  const body = approvalBody(input);
  return deepFreeze({
    ...body,
    correction_approval_attestation_id: contentId('CORRECTION_APPROVAL_ATTESTATION/V1', body),
  });
}

function validateApproval(correction, approval) {
  exactObject(approval, [
    'schema_version', 'stage', 'approval_policy_version', 'correction_id', 'correction_payload_digest',
    'target_digest', 'reviewer_id', 'reviewer_eligibility_evidence_digest',
    'authorisation_evidence_digest', 'decision', 'reason_digest', 'correction_approval_attestation_id',
  ], 'approval');
  const rebuilt = buildCorrectionApprovalAttestation({ ...approval, correction });
  if (canonicalJson(rebuilt) !== canonicalJson(approval)) {
    throw new PostScopeCorrectionError('CORRECTION_APPROVAL_MISMATCH', 'Approval does not bind this exact correction and target.');
  }
  if (rebuilt.decision !== 'PASS') {
    throw new PostScopeCorrectionError('CORRECTION_NOT_APPROVED', 'A passing approval attestation is required.');
  }
  return rebuilt;
}

function claimInput(prior, patch) {
  const evidence = Object.hasOwn(patch, 'evidence')
    ? patch.evidence
    : normaliseEvidence(prior.evidence || []);
  const field = (key) => (Object.hasOwn(patch, key) ? patch[key] : prior[key]);
  const taxonomyCodes = clone(prior.taxonomy_codes || {});
  return {
    subject_occurrence_id: prior.subject_occurrence_id,
    claim_definition_key: prior.claim_definition_key,
    claim_definition_version: prior.claim_definition_version,
    ordinal: prior.ordinal,
    state: prior.state,
    raw_value: field('raw_value'),
    canonical_value: field('canonical_value'),
    unit: field('unit'),
    day_basis: field('day_basis'),
    denominator: field('denominator'),
    scope: clone(prior.scope),
    applicability: clone(prior.applicability),
    not_examined: clone(prior.not_examined),
    failure: clone(prior.failure),
    evidence,
    attributes: clone(prior.attributes || {}),
    allowed_attributes: Object.keys(prior.attributes || {}),
    taxonomy_codes: taxonomyCodes,
    codebooks: Object.fromEntries(Object.entries(taxonomyCodes).map(([key, value]) => [key, [value]])),
    extraction_version: prior.extraction_version,
    normalisation_version: field('normalisation_version'),
    derivation_version: field('derivation_version'),
  };
}

function assertSubject(writeSet, target) {
  const deal = writeSet?.deal;
  if (!deal || deal.deal_key !== target.deal_key
    || deal.deal_admission_id !== target.deal_admission_id
    || deal.document_hash !== target.document_hash) {
    throw new PostScopeCorrectionError('WRONG_CORRECTION_SUBJECT', 'Correction target does not match the write-set deal.');
  }
  const matches = (writeSet.claims || []).filter((claim) => claim.claim_occurrence_id === target.claim_occurrence_id);
  if (matches.length !== 1 || matches[0].subject_occurrence_id !== target.subject_occurrence_id) {
    throw new PostScopeCorrectionError('WRONG_CORRECTION_SUBJECT', 'Correction target does not resolve to exactly one governed claim subject.');
  }
  const prior = matches[0];
  if (prior.claim_revision_id !== target.expected_claim_revision_id
    || claimPayloadDigest(prior) !== target.expected_claim_payload_digest) {
    throw new PostScopeCorrectionError('STALE_CORRECTION', 'Correction predecessor is no longer current.', {
      expected_claim_revision_id: target.expected_claim_revision_id,
      actual_claim_revision_id: prior.claim_revision_id,
    });
  }
  return prior;
}

function applyApprovedPostScopeClaimCorrection({ writeSet, correction, approval, contractBundle } = {}) {
  const selectedCorrection = validateCorrection(correction);
  const selectedApproval = validateApproval(selectedCorrection, approval);
  const inputWriteSet = clone(writeSet);
  const predecessor = assertSubject(inputWriteSet, selectedCorrection.target);
  let successor;
  try {
    const built = buildClaimRevision(claimInput(predecessor, selectedCorrection.patch));
    const allResiduals = [...(predecessor.retained_residuals || []), ...(built.retained_residuals || [])]
      .map(clone)
      .filter((item, index, rows) => rows.findIndex((candidate) => (
        canonicalJson(candidate) === canonicalJson(item)
      )) === index);
    successor = {
      ...built,
      publication_state: allResiduals.length ? 'QUARANTINED' : built.publication_state,
      retained_residuals: allResiduals,
      quarantine: allResiduals.length ? {
        affected_object_type: 'ClaimRevision',
        affected_object_id: built.claim_revision_id,
        reason_codes: [...new Set(allResiduals.map((item) => item.reason))].sort(),
      } : built.quarantine,
      closure_id: predecessor.closure_id,
    };
  } catch (error) {
    throw new PostScopeCorrectionError('CORRECTED_WRITE_SET_INVALID', 'Correction cannot produce a canonical claim revision.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (successor.claim_revision_id === predecessor.claim_revision_id) {
    throw new PostScopeCorrectionError('NO_EFFECT_CORRECTION', 'Correction does not create a successor claim revision.');
  }

  const targetRef = {
    target_variant: 'REVISION',
    revision_type: 'CLAIM_REVISION',
    occurrence_id: predecessor.claim_occurrence_id,
    revision_id: predecessor.claim_revision_id,
    revision_payload_digest: claimPayloadDigest(predecessor),
  };
  const applicationBody = {
    schema_version: 'POST_SCOPE_CORRECTION_APPLICATION/V1',
    stage: STAGE,
    correction_id: selectedCorrection.correction_id,
    correction_approval_attestation_id: selectedApproval.correction_approval_attestation_id,
    correction_slot_key: SLOT_KEY,
    target_ref: targetRef,
    target_ref_digest: contentId('CORRECTION_TARGET_REF/V1', targetRef),
    affected_subject: {
      subject_variant: 'DEAL_FAMILY_CLAIM',
      deal_key: selectedCorrection.target.deal_key,
      subject_occurrence_id: selectedCorrection.target.subject_occurrence_id,
      claim_occurrence_id: selectedCorrection.target.claim_occurrence_id,
    },
    application_rule_version: selectedCorrection.correction_rule_version,
  };
  const application = {
    ...applicationBody,
    correction_application_id: contentId('POST_SCOPE_CORRECTION_APPLICATION/V1', applicationBody),
  };
  const lineageBody = {
    schema_version: 'POST_SCOPE_CLAIM_REVISION_LINEAGE/V1',
    correction_application_id: application.correction_application_id,
    predecessor_claim_revision_id: predecessor.claim_revision_id,
    predecessor_claim_payload_digest: claimPayloadDigest(predecessor),
    successor_claim_revision_id: successor.claim_revision_id,
    successor_claim_payload_digest: claimPayloadDigest(successor),
  };
  const lineage = {
    ...lineageBody,
    post_scope_claim_revision_lineage_id: contentId('POST_SCOPE_CLAIM_REVISION_LINEAGE/V1', lineageBody),
  };
  const correctedWriteSet = {
    ...inputWriteSet,
    claims: inputWriteSet.claims.map((claim) => (
      claim.claim_revision_id === predecessor.claim_revision_id ? successor : claim
    )),
  };

  let validation;
  try {
    validation = validateCanonicalWriteSet(correctedWriteSet, contractBundle);
  } catch (error) {
    throw new PostScopeCorrectionError('CORRECTED_WRITE_SET_INVALID', 'Corrected write set failed canonical validation.', {
      cause_code: error.code || error.name,
      cause_message: error.message,
    });
  }
  if (!validation.publishableWriteSet.claims.some(
    (claim) => claim.claim_revision_id === successor.claim_revision_id,
  )) {
    throw new PostScopeCorrectionError('CORRECTED_TARGET_NOT_PUBLISHABLE', 'Corrected claim was quarantined by canonical validation.', {
      successor_claim_revision_id: successor.claim_revision_id,
    });
  }

  return deepFreeze({
    corrected_write_set: correctedWriteSet,
    correction: selectedCorrection,
    approval: selectedApproval,
    application,
    lineage,
    predecessor_claim_revision: predecessor,
    successor_claim_revision: successor,
    validation,
  });
}

module.exports = {
  PATCH_KEYS,
  SLOT_KEY,
  STAGE,
  PostScopeCorrectionError,
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
};
