const { domainDigest } = require('./bytes');
const { REVIEW_LANES } = require('./registry');
const { validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');

const CONTROLLER_DOMAIN = 'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1';
const CONTROLLER_ROLE = 'REVIEW_CONTROLLER';
const INDEPENDENCE_DOMAIN = 'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1';
const INDEPENDENCE_ROLE = 'VALIDATOR';
const BEN_APPROVAL_DOMAIN = 'PROGRAMME_GATE_BEN_APPROVAL/V1';
const BEN_APPROVAL_ROLE = 'BEN_APPROVER';
const REVIEW_SET_DOMAIN = 'PROGRAMME_GATE_REVIEW_OUTCOME_SET/V1';
const REVIEW_OUTPUT_DOMAIN = 'PROGRAMME_GATE_REVIEW_OUTPUT/V1';
const BEN_APPROVAL_ID_DOMAIN = 'PROGRAMME_GATE_BEN_APPROVAL_ID/V1';
const GOVERNANCE_DIFF_DOMAIN = 'PROGRAMME_GATE_GOVERNANCE_DIFF/V1';
const REVIEWER_EDIT_SET_ROOT_DOMAIN = 'PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1';
const AUTHORING_EVENT_INTERSECTION_ROOT_DOMAIN =
  'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1';
const PRIOR_CONCLUSION_INTERSECTION_ROOT_DOMAIN =
  'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1';
const SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN =
  'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1';
const EMPTY_REVIEWER_EDIT_SET_ROOT = domainDigest(REVIEWER_EDIT_SET_ROOT_DOMAIN, []);
const EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT =
  domainDigest(AUTHORING_EVENT_INTERSECTION_ROOT_DOMAIN, []);
const EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT =
  domainDigest(PRIOR_CONCLUSION_INTERSECTION_ROOT_DOMAIN, []);
const SOL_MODEL = 'gpt-5.6-sol';
const SOL_REASONING = 'high';
const PROHIBITED_ACTIONS = Object.freeze([
  'PRODUCTION_DATA_OR_CORPUS_WRITE',
  'PRODUCTION_REEXTRACTION_OR_BACKFILL',
  'PRODUCTION_OR_RELEASE_IMPORT',
  'RELEASE_ACTIVATION',
  'PRODUCT_FEATURE_ACTIVATION',
  'PRODUCTION_CUTOVER',
]);
const PERMITTED_ACTIONS = Object.freeze([
  'IMPLEMENTATION_PLANNING',
  'ISOLATED_STAGING_SETUP',
  'STAGING_SNAPSHOT_RESTORE_AND_PREVIEW',
  'STAGING_ONLY_CANONICAL_ENGINEERING_BEHIND_DISABLED_PRODUCTION_FLAGS',
]);

const BEN_APPROVAL_KEYS = Object.freeze([
  'schema_version',
  'approved_root',
  'approved_code_commit',
  'review_set_evidence_id',
  'reviewed_root',
  'reviewed_code_commit',
  'review_artifact_sha256',
  'review_artifact_byte_size',
  'full_review_pass_claimed',
  'authorisation_scope',
  'permitted_actions',
  'prohibited_actions',
  'review_findings_disposition',
  'p1_p9_gate_state',
  'governance_diff',
  'github_actor_login',
  'github_actor_id',
  'github_run_id',
  'approval_intent',
  'approver_identity',
  'conditions',
  'approved_at',
  'nonce',
  'signature_algorithm',
  'approver_key_id',
  'signature',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function unsigned(value, signatureField) {
  const { [signatureField]: signature, ...payload } = value;
  void signature;
  return payload;
}

function open(code, message) {
  return Object.freeze({
    valid: false,
    state: 'OPEN',
    evidence_id: null,
    reason_code: code,
    reason: message,
  });
}

function pass(evidenceId, facts) {
  return Object.freeze({
    valid: true,
    state: 'PASS',
    evidence_id: evidenceId,
    facts: Object.freeze(facts),
    reason_code: null,
    reason: null,
  });
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
}

function verifyController(record, output, lane, authority, expectedRoot, at) {
  validateSchema('TrustedReviewControllerRecord/V1', record);
  validateSchema('ColdReviewOutput/V1', output);
  if (record.exact_specification_root !== expectedRoot
    || record.registered_prompt_id !== lane.registered_prompt_id
    || record.reviewer_disposition !== output.disposition
    || record.review_output_digest !== domainDigest(REVIEW_OUTPUT_DOMAIN, output)
    || record.parent_session_state !== 'GENESIS'
    || record.no_earlier_review_conclusions_were_inputs !== true
    || record.input_context_digest_before_review !== record.exact_input_context_digest
    || record.input_context_digest_after_review !== record.exact_input_context_digest
    || record.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
    throw new Error('controller record does not prove an exact cold-review outcome');
  }
  if (!authority.allowed_controllers.some((entry) => (
    entry.controller_id === record.controller_id
    && entry.controller_version === record.controller_version
  ))) throw new Error('controller identity or version is not allowlisted');
  if (!authority.allowed_runtimes.some((entry) => (
    entry.review_runtime_version === record.review_runtime_version
    && entry.review_runtime_binary_digest === record.review_runtime_binary_digest
    && entry.fixed_controller_runtime_context_digest
      === record.fixed_controller_runtime_context_digest
  ))) throw new Error('review runtime or fixed context is not allowlisted');
  if (!authority.allowed_prompts.some((entry) => (
    entry.lane_id === lane.lane_id
    && entry.registered_prompt_id === record.registered_prompt_id
    && entry.cold_review_prompt_digest === record.cold_review_prompt_digest
  ))) throw new Error('review prompt is not allowlisted for the lane');

  const legalEligible = (
    authority.fable_model_identifiers.includes(record.exact_model_identifier)
    && record.reasoning_level === 'provider_default'
  )
    || (
      record.exact_model_identifier === SOL_MODEL
      && record.reasoning_level === SOL_REASONING
    );
  if (lane.lane_id === 'LEGAL_SEMANTIC' && !legalEligible) {
    throw new Error('legal-semantic reviewer is not eligible');
  }
  if (lane.lane_id !== 'LEGAL_SEMANTIC'
    && !authority.other_lane_model_identifiers.includes(record.exact_model_identifier)) {
    throw new Error('reviewer model is not eligible for this lane');
  }

  verifySignature({
    keyRegistry: authority.key_registry,
    keyId: record.controller_key_id,
    role: CONTROLLER_ROLE,
    domain: CONTROLLER_DOMAIN,
    payload: unsigned(record, 'controller_signature'),
    signature: record.controller_signature,
    at,
  });
}

function verifyIndependence(attestation, record, authority, expectedCodeCommit, at) {
  validateSchema('ReviewerIndependenceAttestation/V1', attestation);
  const reviewerIdentities = new Set(record.reviewer_source_control_identity_set);
  const authoringIntersection = attestation.source_control_authorship_events.filter(
    (event) => event.identity_set.some((identity) => reviewerIdentities.has(identity)),
  );
  const priorIntersection = attestation.prior_conclusion_input_set.filter(
    (conclusion) => reviewerIdentities.has(conclusion),
  );
  if (attestation.reviewer_principal_id !== record.reviewer_principal_id
    || attestation.immutable_session_id !== record.immutable_session_id
    || attestation.session_parent_or_genesis !== 'GENESIS'
    || attestation.exact_input_context_digest !== record.exact_input_context_digest
    || attestation.reviewed_code_commit !== expectedCodeCommit
    || attestation.source_control_history_scope
      !== 'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS'
    || attestation.source_control_authorship_event_set_root
      !== domainDigest(
        SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN,
        attestation.source_control_authorship_events,
      )
    || attestation.authoring_event_intersection_root
      !== domainDigest(AUTHORING_EVENT_INTERSECTION_ROOT_DOMAIN, authoringIntersection)
    || authoringIntersection.length !== 0
    || attestation.prior_conclusion_intersection_root
      !== domainDigest(PRIOR_CONCLUSION_INTERSECTION_ROOT_DOMAIN, priorIntersection)
    || priorIntersection.length !== 0
    || attestation.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
    throw new Error('review independence was not recomputed from complete evidence');
  }
  if (!authority.allowed_independence_validators.some((entry) => (
    entry.validator_executable_digest === attestation.validator_executable_digest
    && entry.validator_configuration_digest === attestation.validator_configuration_digest
    && entry.validator_key_id === attestation.validator_key_id
  ))) throw new Error('independence validator is not allowlisted');

  verifySignature({
    keyRegistry: authority.key_registry,
    keyId: attestation.validator_key_id,
    role: INDEPENDENCE_ROLE,
    domain: INDEPENDENCE_DOMAIN,
    payload: unsigned(attestation, 'signature'),
    signature: attestation.signature,
    at,
  });
}

function verifyReviewSetEvidence(input) {
  try {
    if (!isRecord(input)
      || !Array.isArray(input.members)
      || !isRecord(input.authority)
      || typeof input.at === 'undefined') {
      throw new Error('review-set input is incomplete');
    }
    requireDigest(input.expected_specification_root, 'expected specification root');
    requireDigest(input.review_artifact_sha256, 'review artefact SHA-256');
    if (!Number.isInteger(input.review_artifact_byte_size)
      || input.review_artifact_byte_size < 1) {
      throw new Error('review artefact byte size must be a positive integer');
    }
    if (typeof input.expected_code_commit !== 'string'
      || !/^[a-f0-9]{40}$/.test(input.expected_code_commit)) {
      throw new Error('expected code commit must be a Git commit ID');
    }
    const expectedLanes = REVIEW_LANES.map((lane) => lane.lane_id);
    if (input.members.length !== expectedLanes.length) {
      throw new Error('review set must contain exactly five lanes');
    }
    const laneIds = input.members.map((member) => member && member.lane_id);
    if (new Set(laneIds).size !== expectedLanes.length
      || !expectedLanes.every((laneId) => laneIds.includes(laneId))) {
      throw new Error('review set has missing or duplicate lanes');
    }
    const nonces = new Set();
    const principals = new Set();
    const ordered = REVIEW_LANES.map((lane) => {
      const member = input.members.find((candidate) => candidate.lane_id === lane.lane_id);
      if (!exactKeys(
        member,
        ['lane_id', 'controller_record', 'independence_attestation', 'review_output'],
      )) {
        throw new Error('review lane member has an open or incomplete shape');
      }
      verifyController(
        member.controller_record,
        member.review_output,
        lane,
        input.authority,
        input.expected_specification_root,
        input.at,
      );
      verifyIndependence(
        member.independence_attestation,
        member.controller_record,
        input.authority,
        input.expected_code_commit,
        input.at,
      );
      if (nonces.has(member.controller_record.nonce)
        || principals.has(member.controller_record.reviewer_principal_id)) {
        throw new Error('review nonce and principal must be unique per lane');
      }
      nonces.add(member.controller_record.nonce);
      principals.add(member.controller_record.reviewer_principal_id);
      return member;
    });
    const evidenceId = domainDigest(REVIEW_SET_DOMAIN, {
      reviewed_code_commit: input.expected_code_commit,
      reviewed_root: input.expected_specification_root,
      review_artifact_sha256: input.review_artifact_sha256,
      review_artifact_byte_size: input.review_artifact_byte_size,
      ordered_members: ordered,
    });
    const laneOutcomes = ordered.map((member) => Object.freeze({
      lane_id: member.lane_id,
      disposition: member.review_output.disposition,
      review_output_digest: member.controller_record.review_output_digest,
      blocking_finding_count: member.review_output.findings.filter(
        (finding) => finding.severity === 'BLOCKING',
      ).length,
    }));
    return pass(evidenceId, {
      reviewed_root: input.expected_specification_root,
      reviewed_code_commit: input.expected_code_commit,
      review_artifact_sha256: input.review_artifact_sha256,
      review_artifact_byte_size: input.review_artifact_byte_size,
      lane_ids: Object.freeze(expectedLanes),
      lane_outcomes: Object.freeze(laneOutcomes),
      full_review_disposition: laneOutcomes.every(
        (outcome) => outcome.disposition === 'PASS',
      ) ? 'PASS' : 'FAIL',
      full_review_pass_claimed: false,
      legal_reviewer_eligible: true,
      independence_recomputed: true,
      root_before: input.expected_specification_root,
      root_after: input.expected_specification_root,
    });
  } catch (error) {
    return open('REVIEW_SET_NOT_VERIFIED', error.message);
  }
}

function validateBenApprovalRecord(record) {
  validateSchema('BenSpecificationApproval/V2', record);
  if (!exactKeys(record, BEN_APPROVAL_KEYS)
    || record.schema_version !== 'BenSpecificationApproval/V2'
    || record.approver_identity !== 'BEN_GOODCHILD'
    || record.full_review_pass_claimed !== false
    || record.authorisation_scope !== 'ISOLATED_STAGING_CANONICAL_IMPLEMENTATION'
    || JSON.stringify(record.permitted_actions) !== JSON.stringify(PERMITTED_ACTIONS)
    || !Array.isArray(record.prohibited_actions)
    || record.prohibited_actions.length !== PROHIBITED_ACTIONS.length
    || !PROHIBITED_ACTIONS.every((action) => record.prohibited_actions.includes(action))
    || record.review_findings_disposition !== 'ACKNOWLEDGED_NOT_RESOLVED_OR_WAIVED'
    || record.p1_p9_gate_state !== 'OPEN'
    || record.governance_diff?.basis_code_commit !== record.reviewed_code_commit
    || record.governance_diff?.authorised_code_commit !== record.approved_code_commit
    || !Array.isArray(record.governance_diff?.changed_paths)
    || record.governance_diff.changed_paths.length === 0
    || !Array.isArray(record.governance_diff?.unexpected_paths)
    || record.governance_diff.unexpected_paths.length !== 0
    || record.github_actor_login !== 'CodeNameHash'
    || record.github_actor_id !== '264183176'
    || typeof record.github_run_id !== 'string'
    || record.github_run_id.length === 0
    || record.approval_intent
      !== 'AUTHORISE_ISOLATED_STAGING_CANONICAL_IMPLEMENTATION'
    || record.signature_algorithm !== 'Ed25519'
    || !Array.isArray(record.conditions)
    || typeof record.approved_at !== 'string'
    || !Number.isFinite(Date.parse(record.approved_at))
    || typeof record.nonce !== 'string'
    || record.nonce.length === 0
    || typeof record.approver_key_id !== 'string'
    || record.approver_key_id.length === 0
    || typeof record.signature !== 'string'
    || record.signature.length === 0) {
    throw new Error('Ben approval record is not a closed signed record');
  }
  requireDigest(record.approved_root, 'approved root');
  requireDigest(record.review_set_evidence_id, 'review-set evidence ID');
  requireDigest(record.reviewed_root, 'reviewed root');
  requireDigest(record.review_artifact_sha256, 'review artefact SHA-256');
  requireDigest(record.governance_diff.allowed_path_set_digest, 'allowed path-set digest');
  requireDigest(record.governance_diff.patch_digest, 'governance patch digest');
}

function verifyBenApprovalEvidence(input) {
  try {
    if (!isRecord(input) || !isRecord(input.record) || !isRecord(input.authority)) {
      throw new Error('Ben approval input is incomplete');
    }
    validateBenApprovalRecord(input.record);
    if (input.record.approved_root !== input.expected_specification_root
      || input.record.approved_code_commit !== input.expected_code_commit
      || input.record.review_set_evidence_id !== input.review_set_evidence_id
      || input.record.reviewed_root !== input.reviewed_root
      || input.record.reviewed_code_commit !== input.reviewed_code_commit
      || input.record.conditions.length !== 0) {
      throw new Error('Ben approval is conditional or bound to another root or commit');
    }
    verifySignature({
      keyRegistry: input.authority.key_registry,
      keyId: input.record.approver_key_id,
      role: BEN_APPROVAL_ROLE,
      domain: BEN_APPROVAL_DOMAIN,
      payload: unsigned(input.record, 'signature'),
      signature: input.record.signature,
      at: input.at,
    });
    const evidenceId = domainDigest(BEN_APPROVAL_ID_DOMAIN, input.record);
    return pass(evidenceId, {
      approved_root: input.record.approved_root,
      approved_code_commit: input.record.approved_code_commit,
      review_set_evidence_id: input.record.review_set_evidence_id,
      reviewed_root: input.record.reviewed_root,
      reviewed_code_commit: input.record.reviewed_code_commit,
      review_artifact_sha256: input.record.review_artifact_sha256,
      review_artifact_byte_size: input.record.review_artifact_byte_size,
      full_review_pass_claimed: false,
      authorisation_scope: input.record.authorisation_scope,
      permitted_actions: Object.freeze([...input.record.permitted_actions]),
      prohibited_actions: Object.freeze([...input.record.prohibited_actions]),
      review_findings_disposition: input.record.review_findings_disposition,
      p1_p9_gate_state: input.record.p1_p9_gate_state,
      governance_diff_digest: domainDigest(
        GOVERNANCE_DIFF_DOMAIN,
        input.record.governance_diff,
      ),
      github_actor_login: input.record.github_actor_login,
      github_actor_id: input.record.github_actor_id,
      github_run_id: input.record.github_run_id,
      approval_intent: input.record.approval_intent,
      identity_and_signature_verified: true,
      scope_bounded: true,
    });
  } catch (error) {
    return open('BEN_APPROVAL_NOT_VERIFIED', error.message);
  }
}

function projectReviewSetAttestation(verification) {
  if (!verification
    || verification.valid !== true
    || verification.state !== 'PASS'
    || !verification.facts) {
    throw new Error('a passing review-set verification is required');
  }
  const attestation = {
    review_set_evidence_id: verification.evidence_id,
    reviewed_root: verification.facts.reviewed_root,
    reviewed_code_commit: verification.facts.reviewed_code_commit,
    review_artifact_sha256: verification.facts.review_artifact_sha256,
    review_artifact_byte_size: verification.facts.review_artifact_byte_size,
    lane_outcomes: verification.facts.lane_outcomes.map((outcome) => ({ ...outcome })),
    full_review_disposition: verification.facts.full_review_disposition,
    full_review_pass_claimed: false,
  };
  validateSchema('ExactDigestReviewSetAttestation/V2', attestation);
  return Object.freeze(attestation);
}

function projectBenApprovalEvidence(verification, record) {
  if (!verification
    || verification.valid !== true
    || verification.state !== 'PASS'
    || !verification.facts
    || !record) {
    throw new Error('a passing Ben approval verification and record are required');
  }
  const evidence = {
    approval_evidence_id: verification.evidence_id,
    approved_root: verification.facts.approved_root,
    approved_code_commit: verification.facts.approved_code_commit,
    review_set_evidence_id: verification.facts.review_set_evidence_id,
    reviewed_root: verification.facts.reviewed_root,
    reviewed_code_commit: verification.facts.reviewed_code_commit,
    review_artifact_sha256: verification.facts.review_artifact_sha256,
    review_artifact_byte_size: verification.facts.review_artifact_byte_size,
    full_review_pass_claimed: false,
    authorisation_scope: verification.facts.authorisation_scope,
    permitted_actions: [...verification.facts.permitted_actions],
    prohibited_actions: [...verification.facts.prohibited_actions],
    review_findings_disposition: verification.facts.review_findings_disposition,
    p1_p9_gate_state: verification.facts.p1_p9_gate_state,
    governance_diff_digest: verification.facts.governance_diff_digest,
    github_actor_login: verification.facts.github_actor_login,
    github_actor_id: verification.facts.github_actor_id,
    github_run_id: verification.facts.github_run_id,
    approval_intent: verification.facts.approval_intent,
    conditions: [...record.conditions],
  };
  validateSchema('BenSpecificationApprovalEvidence/V2', evidence);
  return Object.freeze(evidence);
}

module.exports = {
  BEN_APPROVAL_DOMAIN,
  BEN_APPROVAL_ROLE,
  CONTROLLER_DOMAIN,
  CONTROLLER_ROLE,
  EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
  EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
  EMPTY_REVIEWER_EDIT_SET_ROOT,
  INDEPENDENCE_DOMAIN,
  INDEPENDENCE_ROLE,
  SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN,
  projectBenApprovalEvidence,
  projectReviewSetAttestation,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
};
