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

const REVIEW_OUTPUT_DOMAIN = 'PROGRAMME_GATE_REVIEW_OUTPUT/V1';
const CONTROLLER_ID = 'CODEX_CLI_REVIEW_CONTROLLER';
const CONTROLLER_VERSION = 'LOCAL_REVIEW_CONTROLLER/V1';
const SOL_MODEL = 'gpt-5.6-sol';
const SOL_REASONING = 'xhigh';

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
    'signIndependence',
    'sourceControlAuthorshipEvents',
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
  requireTimestamp(input.at, 'verification time');
  validateSchema('TrustedProgrammeGatePublicKeys/V1', input.keyRegistry);
  if (input.bundle.schema_version !== 'ProgrammeGateColdReviewControllerBundle/V1'
    || input.bundle.code_commit !== input.expectedCodeCommit
    || input.bundle.specification_root !== input.expectedSpecificationRoot
    || !Array.isArray(input.bundle.reviews)
    || input.bundle.reviews.length !== REVIEW_LANES.length
    || typeof input.signIndependence !== 'function'
    || !Array.isArray(input.sourceControlAuthorshipEvents)
    || input.sourceControlAuthorshipEvents.length === 0) {
    throw new Error('cold-review bundle does not match the exact requested root');
  }
  const sourceControlAuthorshipEvents = [...input.sourceControlAuthorshipEvents]
    .map((event) => ({
      commit_id: requireCommit(event?.commit_id, 'authorship commit'),
      identity_set: [...new Set(event?.identity_set || [])].sort(),
    }))
    .sort((left, right) => left.commit_id.localeCompare(right.commit_id));
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
    const record = review.controller_record;
    if (record.controller_id !== CONTROLLER_ID
      || record.controller_version !== CONTROLLER_VERSION
      || record.exact_specification_root !== input.expectedSpecificationRoot
      || record.registered_prompt_id !== lane.registered_prompt_id
      || record.cold_review_prompt_digest !== exactPromptDigest(lane.lane_id)
      || record.exact_model_identifier !== SOL_MODEL
      || record.reasoning_level !== SOL_REASONING
      || record.reviewer_disposition !== 'PASS'
      || review.review_output.disposition !== 'PASS'
      || record.review_output_digest
        !== domainDigest(REVIEW_OUTPUT_DOMAIN, review.review_output)
      || record.parent_session_state !== 'GENESIS'
      || record.no_earlier_review_conclusions_were_inputs !== true
      || record.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
      throw new Error(`${lane.lane_id} is not an exact passing cold review`);
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
      source_control_history_scope: 'ALL_REFS_FROM_REPOSITORY_GENESIS',
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
      independence_attestation: independenceAttestation,
    };
  });
  const verification = verifyReviewSetEvidence({
    expected_specification_root: input.expectedSpecificationRoot,
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
    'approvedRoot',
    'approverKeyId',
    'keyRegistry',
    'nonce',
    'passingReviewSetEvidenceId',
    'signApproval',
    'verificationTime',
  ], 'Ben approval input');
  requireDigest(input.approvedRoot, 'approved root');
  requireDigest(input.passingReviewSetEvidenceId, 'passing review-set evidence ID');
  requireTimestamp(input.approvedAt, 'approval time');
  requireTimestamp(input.verificationTime, 'approval verification time');
  if (Date.parse(input.approvedAt) > Date.parse(input.verificationTime)
    || typeof input.signApproval !== 'function'
    || typeof input.nonce !== 'string'
    || input.nonce.length === 0) {
    throw new Error('Ben approval input is invalid');
  }
  const unsignedRecord = {
    schema_version: 'BenSpecificationApproval/V1',
    approved_root: input.approvedRoot,
    passing_review_set_evidence_id: input.passingReviewSetEvidenceId,
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
    expected_specification_root: input.approvedRoot,
    passing_review_set_evidence_id: input.passingReviewSetEvidenceId,
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
