const crypto = require('node:crypto');

const { domainDigest, signatureBytes } = require('./bytes');
const { COLD_REVIEW_TASKS } = require('./cold-review-tasks');
const {
  BEN_APPROVAL_DOMAIN,
  BEN_APPROVAL_ROLE,
  EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
  EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
  EMPTY_REVIEWER_EDIT_SET_ROOT,
  INDEPENDENCE_DOMAIN,
  INDEPENDENCE_ROLE,
  SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
} = require('./review-evidence');
const { REVIEW_LANES } = require('./registry');
const { validateSchema } = require('./schema-registry');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('./git-authorship');

const REVIEW_OUTPUT_DOMAIN = 'PROGRAMME_GATE_REVIEW_OUTPUT/V1';
const CONTROLLER_ID = 'CODEX_CLI_REVIEW_CONTROLLER';
const CONTROLLER_VERSION = 'LOCAL_REVIEW_CONTROLLER/V1';
const SOL_MODEL = 'gpt-5.6-sol';
const SOL_REASONING = 'xhigh';
const AUTHORISATION_SCOPE = 'ISOLATED_STAGING_CANONICAL_IMPLEMENTATION';
const APPROVAL_INTENT = 'AUTHORISE_ISOLATED_STAGING_CANONICAL_IMPLEMENTATION';
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

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} does not match its closed shape`);
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
  }
  return value;
}

function requireCommit(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a Git commit ID`);
  }
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string'
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const digest = domainDigest('PROGRAMME_GATE_REVIEW_AUTHORITY_MEMBER/V1', record);
    if (seen.has(digest)) return false;
    seen.add(digest);
    return true;
  });
}

function validateReviewOutput(output) {
  exactKeys(output, ['disposition', 'findings'], 'cold-review output');
  if (!['PASS', 'FAIL'].includes(output.disposition) || !Array.isArray(output.findings)) {
    throw new Error('cold-review output is invalid');
  }
  for (const finding of output.findings) {
    exactKeys(
      finding,
      ['severity', 'code', 'message', 'evidence'],
      'cold-review finding',
    );
    if (!['BLOCKING', 'NON_BLOCKING'].includes(finding.severity)
      || !/^[A-Z][A-Z0-9_]{2,63}$/.test(finding.code)
      || typeof finding.message !== 'string'
      || finding.message.length === 0
      || typeof finding.evidence !== 'string'
      || finding.evidence.length === 0) {
      throw new Error('cold-review finding is invalid');
    }
  }
  if (output.disposition === 'PASS'
    && output.findings.some((finding) => finding.severity === 'BLOCKING')) {
    throw new Error('a passing cold review contains a blocking finding');
  }
}

function exactPromptDigest(laneId) {
  const task = COLD_REVIEW_TASKS.find((entry) => entry.lane_id === laneId);
  if (!task) throw new Error(`review task is unavailable for ${laneId}`);
  return crypto.createHash('sha256').update(task.prompt).digest('hex');
}

function buildReviewSetInput(input) {
  exactKeys(input, [
    'at',
    'bundle',
    'expectedCodeCommit',
    'expectedSpecificationRoot',
    'keyRegistry',
    'repositoryRoot',
    'reviewArtifactByteSize',
    'reviewArtifactSha256',
    'signIndependence',
    'validatorConfigurationDigest',
    'validatorExecutableDigest',
    'validatorKeyId',
  ], 'review artefact input');
  exactKeys(
    input.bundle,
    ['code_commit', 'reviews', 'schema_version', 'specification_root'],
    'cold-review bundle',
  );
  requireCommit(input.expectedCodeCommit, 'expected code commit');
  requireDigest(input.expectedSpecificationRoot, 'expected specification root');
  requireDigest(input.validatorExecutableDigest, 'validator executable digest');
  requireDigest(input.validatorConfigurationDigest, 'validator configuration digest');
  requireDigest(input.reviewArtifactSha256, 'review artefact SHA-256');
  if (!Number.isInteger(input.reviewArtifactByteSize) || input.reviewArtifactByteSize < 1) {
    throw new TypeError('review artefact byte size must be a positive integer');
  }
  requireTimestamp(input.at, 'verification time');
  validateSchema('TrustedProgrammeGatePublicKeys/V1', input.keyRegistry);
  if (input.bundle.schema_version !== 'ProgrammeGateColdReviewControllerBundle/V1'
    || input.bundle.code_commit !== input.expectedCodeCommit
    || input.bundle.specification_root !== input.expectedSpecificationRoot
    || !Array.isArray(input.bundle.reviews)
    || input.bundle.reviews.length !== REVIEW_LANES.length
    || typeof input.signIndependence !== 'function') {
    throw new Error('cold-review bundle does not match the exact requested root');
  }
  const sourceControlAuthorshipEvents = enumerateCompleteGitAuthorshipUniverse({
    repositoryRoot: input.repositoryRoot,
    expectedCommit: input.expectedCodeCommit,
  });
  if (sourceControlAuthorshipEvents.some((event) => event.identity_set.length === 0)
    || new Set(sourceControlAuthorshipEvents.map((event) => event.commit_id)).size
      !== sourceControlAuthorshipEvents.length) {
    throw new Error('source-control authorship events must cover unique commits');
  }
  const sourceControlIdentities = new Set(
    sourceControlAuthorshipEvents.flatMap((event) => event.identity_set),
  );
  const laneIds = input.bundle.reviews.map((review) => review && review.lane_id);
  if (new Set(laneIds).size !== REVIEW_LANES.length
    || REVIEW_LANES.some((lane) => !laneIds.includes(lane.lane_id))) {
    throw new Error('cold-review bundle has missing or duplicate lanes');
  }

  const orderedReviews = REVIEW_LANES.map((lane) => {
    const review = input.bundle.reviews.find((entry) => entry.lane_id === lane.lane_id);
    exactKeys(review, ['controller_record', 'lane_id', 'review_output'], 'cold-review lane');
    validateSchema('TrustedReviewControllerRecord/V1', review.controller_record);
    validateReviewOutput(review.review_output);
    validateSchema('ColdReviewOutput/V1', review.review_output);
    const record = review.controller_record;
    if (record.controller_id !== CONTROLLER_ID
      || record.controller_version !== CONTROLLER_VERSION
      || record.exact_specification_root !== input.expectedSpecificationRoot
      || record.registered_prompt_id !== lane.registered_prompt_id
      || record.cold_review_prompt_digest !== exactPromptDigest(lane.lane_id)
      || record.exact_model_identifier !== SOL_MODEL
      || record.reasoning_level !== SOL_REASONING
      || record.reviewer_disposition !== review.review_output.disposition
      || record.review_output_digest
        !== domainDigest(REVIEW_OUTPUT_DOMAIN, review.review_output)
      || record.parent_session_state !== 'GENESIS'
      || record.no_earlier_review_conclusions_were_inputs !== true
      || record.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
      throw new Error(`${lane.lane_id} is not an exact signed cold-review outcome`);
    }
    if (record.reviewer_source_control_identity_set.some(
      (identity) => sourceControlIdentities.has(identity),
    )) {
      throw new Error(`${lane.lane_id} reviewer intersects reviewed-byte authorship`);
    }
    return review;
  });

  const authority = {
    key_registry: structuredClone(input.keyRegistry),
    allowed_controllers: uniqueRecords(orderedReviews.map(({ controller_record: record }) => ({
      controller_id: record.controller_id,
      controller_version: record.controller_version,
    }))),
    allowed_runtimes: uniqueRecords(orderedReviews.map(({ controller_record: record }) => ({
      review_runtime_version: record.review_runtime_version,
      review_runtime_binary_digest: record.review_runtime_binary_digest,
      fixed_controller_runtime_context_digest:
        record.fixed_controller_runtime_context_digest,
    }))),
    allowed_prompts: REVIEW_LANES.map((lane) => ({
      lane_id: lane.lane_id,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: exactPromptDigest(lane.lane_id),
    })),
    allowed_independence_validators: [{
      validator_executable_digest: input.validatorExecutableDigest,
      validator_configuration_digest: input.validatorConfigurationDigest,
      validator_key_id: input.validatorKeyId,
    }],
    fable_model_identifiers: [],
    other_lane_model_identifiers: [SOL_MODEL],
  };
  const members = orderedReviews.map((review) => {
    const record = review.controller_record;
    const unsignedAttestation = {
      schema_version: 'ReviewerIndependenceAttestation/V1',
      reviewer_principal_id: record.reviewer_principal_id,
      immutable_session_id: record.immutable_session_id,
      session_parent_or_genesis: 'GENESIS',
      exact_input_context_digest: record.exact_input_context_digest,
      reviewed_code_commit: input.expectedCodeCommit,
      source_control_history_scope: 'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS',
      source_control_authorship_events: sourceControlAuthorshipEvents,
      source_control_authorship_event_set_root: domainDigest(
        SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN,
        sourceControlAuthorshipEvents,
      ),
      prior_conclusion_input_set: [],
      authoring_event_intersection_root: EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
      prior_conclusion_intersection_root: EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      validator_executable_digest: input.validatorExecutableDigest,
      validator_configuration_digest: input.validatorConfigurationDigest,
      validator_key_id: input.validatorKeyId,
      signature_algorithm: 'Ed25519',
    };
    const signature = input.signIndependence(signatureBytes({
      domain: INDEPENDENCE_DOMAIN,
      role: INDEPENDENCE_ROLE,
      payload: unsignedAttestation,
    }));
    const independenceAttestation = {
      ...unsignedAttestation,
      signature,
    };
    validateSchema('ReviewerIndependenceAttestation/V1', independenceAttestation);
    return {
      lane_id: review.lane_id,
      controller_record: structuredClone(record),
      review_output: structuredClone(review.review_output),
      independence_attestation: independenceAttestation,
    };
  });
  const verification = verifyReviewSetEvidence({
    expected_code_commit: input.expectedCodeCommit,
    expected_specification_root: input.expectedSpecificationRoot,
    review_artifact_byte_size: input.reviewArtifactByteSize,
    review_artifact_sha256: input.reviewArtifactSha256,
    members,
    authority,
    at: input.at,
  });
  if (verification.valid !== true) {
    throw new Error(`cold-review set is OPEN: ${verification.reason}`);
  }
  return Object.freeze({
    authority,
    members,
    verification,
  });
}

function buildBenApproval(input) {
  exactKeys(input, [
    'approvedAt',
    'approvedCodeCommit',
    'approvedRoot',
    'approvalIntent',
    'approverKeyId',
    'githubActorId',
    'githubActorLogin',
    'githubRunId',
    'governanceDiff',
    'keyRegistry',
    'nonce',
    'reviewSetEvidenceId',
    'reviewArtifactByteSize',
    'reviewArtifactSha256',
    'reviewedCodeCommit',
    'reviewedRoot',
    'signApproval',
    'verificationTime',
  ], 'Ben approval input');
  requireDigest(input.approvedRoot, 'approved root');
  requireCommit(input.approvedCodeCommit, 'approved code commit');
  requireDigest(input.reviewSetEvidenceId, 'review-set evidence ID');
  requireDigest(input.reviewedRoot, 'reviewed root');
  requireCommit(input.reviewedCodeCommit, 'reviewed code commit');
  requireDigest(input.reviewArtifactSha256, 'review artefact SHA-256');
  if (!Number.isInteger(input.reviewArtifactByteSize) || input.reviewArtifactByteSize < 1) {
    throw new TypeError('review artefact byte size must be a positive integer');
  }
  requireTimestamp(input.approvedAt, 'approval time');
  requireTimestamp(input.verificationTime, 'approval verification time');
  exactKeys(input.governanceDiff, [
    'allowed_path_set_digest',
    'authorised_code_commit',
    'basis_code_commit',
    'changed_paths',
    'patch_digest',
    'unexpected_paths',
  ], 'governance diff');
  requireCommit(input.governanceDiff.basis_code_commit, 'governance diff basis commit');
  requireCommit(
    input.governanceDiff.authorised_code_commit,
    'governance diff authorised commit',
  );
  requireDigest(input.governanceDiff.allowed_path_set_digest, 'allowed path-set digest');
  requireDigest(input.governanceDiff.patch_digest, 'governance patch digest');
  if (Date.parse(input.approvedAt) > Date.parse(input.verificationTime)
    || typeof input.signApproval !== 'function'
    || typeof input.nonce !== 'string'
    || input.nonce.length === 0
    || input.approvalIntent !== APPROVAL_INTENT
    || input.githubActorLogin !== 'CodeNameHash'
    || input.githubActorId !== '264183176'
    || typeof input.githubRunId !== 'string'
    || input.githubRunId.length === 0
    || input.governanceDiff.basis_code_commit !== input.reviewedCodeCommit
    || input.governanceDiff.authorised_code_commit !== input.approvedCodeCommit
    || !Array.isArray(input.governanceDiff.changed_paths)
    || input.governanceDiff.changed_paths.length === 0
    || new Set(input.governanceDiff.changed_paths).size
      !== input.governanceDiff.changed_paths.length
    || !Array.isArray(input.governanceDiff.unexpected_paths)
    || input.governanceDiff.unexpected_paths.length !== 0) {
    throw new Error('Ben approval input is invalid');
  }
  const unsignedRecord = {
    schema_version: 'BenSpecificationApproval/V2',
    approved_root: input.approvedRoot,
    approved_code_commit: input.approvedCodeCommit,
    review_set_evidence_id: input.reviewSetEvidenceId,
    reviewed_root: input.reviewedRoot,
    reviewed_code_commit: input.reviewedCodeCommit,
    review_artifact_sha256: input.reviewArtifactSha256,
    review_artifact_byte_size: input.reviewArtifactByteSize,
    full_review_pass_claimed: false,
    authorisation_scope: AUTHORISATION_SCOPE,
    permitted_actions: [...PERMITTED_ACTIONS],
    prohibited_actions: [...PROHIBITED_ACTIONS],
    review_findings_disposition: 'ACKNOWLEDGED_NOT_RESOLVED_OR_WAIVED',
    p1_p9_gate_state: 'OPEN',
    governance_diff: structuredClone(input.governanceDiff),
    github_actor_login: input.githubActorLogin,
    github_actor_id: input.githubActorId,
    github_run_id: input.githubRunId,
    approval_intent: input.approvalIntent,
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: input.approvedAt,
    nonce: input.nonce,
    signature_algorithm: 'Ed25519',
    approver_key_id: input.approverKeyId,
  };
  const record = {
    ...unsignedRecord,
    signature: input.signApproval(signatureBytes({
      domain: BEN_APPROVAL_DOMAIN,
      role: BEN_APPROVAL_ROLE,
      payload: unsignedRecord,
    })),
  };
  const authority = { key_registry: structuredClone(input.keyRegistry) };
  const verification = verifyBenApprovalEvidence({
    record,
    expected_code_commit: input.approvedCodeCommit,
    expected_specification_root: input.approvedRoot,
    review_set_evidence_id: input.reviewSetEvidenceId,
    reviewed_code_commit: input.reviewedCodeCommit,
    reviewed_root: input.reviewedRoot,
    authority,
    at: input.verificationTime,
  });
  if (verification.valid !== true) {
    throw new Error(`Ben approval is OPEN: ${verification.reason}`);
  }
  return Object.freeze({ authority, record, verification });
}

module.exports = {
  buildBenApproval,
  buildReviewSetInput,
};
