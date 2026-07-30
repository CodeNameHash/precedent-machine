const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../canonical-v2/canonical-bytes');
const { domainDigest } = require('./bytes');
const { validateSchema } = require('./schema-registry');
const {
  validateCanonicalPredecessorBundleMembers,
} = require('../canonical-v2/canonical-contract-bundle-pre-review-source-closure');

const REQUEST_INPUT_VERSION = 'P1ContractFreezeReviewRequestInput/V1';
const REQUEST_VERSION = 'P1ContractFreezeReviewRequest/V1';
const TASK_VERSION = 'P1ContractFreezeReviewTask/V1';
const RESULT_VERSION = 'P1ContractFreezeReviewResult/V1';
const VALIDATION_VERSION = 'P1ContractFreezeReviewValidation/V1';
const EXACT_REVIEW_INPUT_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2';
const EXACT_MODEL_IDENTIFIER = 'gpt-5.6-sol';
const EXACT_REASONING_LEVEL = 'high';
const GATE_ID = 'P1_CONTRACT_FREEZE_ATTESTED';
const REVIEW_PACKAGE_FINGERPRINT_DOMAIN =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;

const REVIEW_LANES = Object.freeze([
  Object.freeze({
    lane_id: 'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
    reviewer_role: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_REVIEWER',
    formal_record_schema_id: 'ContractFreezeAuthorityEvidence/V1',
    formal_authority_kind: 'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
    review_scope: 'LEGAL_SEMANTIC_COMPLETENESS',
    focus:
      'the completeness and legal meaning of the semantic-question catalogue',
  }),
  Object.freeze({
    lane_id: 'COMPOSITION_CATALOGUE_REVIEW',
    reviewer_role: 'INDEPENDENT_COMPOSITION_CATALOGUE_REVIEWER',
    formal_record_schema_id: 'ContractFreezeAuthorityEvidence/V1',
    formal_authority_kind: 'COMPOSITION_CATALOGUE_REVIEW',
    review_scope: 'LEGAL_COMPOSITION_COMPLETENESS',
    focus:
      'the completeness and legal meaning of the composition catalogue',
  }),
  Object.freeze({
    lane_id: 'SEMANTIC_AND_IDENTITY_DIFF_REVIEW',
    reviewer_role: 'INDEPENDENT_CONTRACT_DIFF_REVIEWER',
    formal_record_schema_id: 'ContractDiffReviewAttestation/V1',
    formal_authority_kind: 'CONTRACT_DIFF_REVIEW',
    review_scope: 'SEMANTIC_AND_IDENTITY_DIFF',
    focus:
      'every semantic and identity change between the exact predecessor and successor bundles',
  }),
]);

const REVIEW_PACKAGE_KEYS = Object.freeze([
  'schema_version',
  'specification_root',
  'root_manifest_digest',
  'code_commit',
  'environment',
  'pre_review_attestation_placeholder',
  'pre_review_frozen_pair_placeholder_digest',
  'predecessor_contract_bundle_id',
  'predecessor_contract_bundle_digest',
  'predecessor_contract_bundle_projection',
  'contract_bundle_id',
  'contract_bundle_digest',
  'canonical_contract_bundle_members',
  'canonical_contract_bundle_projection',
  'semantic_identity_diff',
  'semantic_identity_diff_digest',
  'pre_review_input_context_placeholder_digest',
  'governing_specification_member_records',
  'contract_bundle_freeze_candidate',
  'contract_freeze_attestation_identity',
  'frozen_contract_pair_digest',
  'predecessor_canonical_contract_bundle_members',
  'predecessor_source_kinds',
  'reviewed_contract_source_set_digest',
  'exact_review_input_context_digest',
]);

const REQUEST_INPUT_KEYS = Object.freeze([
  'schema_version',
  'exact_review_package_fingerprint',
  'exact_review_package_bytes_base64',
  'code_commit',
  'frozen_contract_pair_digest',
  'source_closure_identity',
  'reviewer_bindings',
]);

const REVIEWER_BINDING_KEYS = Object.freeze([
  'lane_id',
  'reviewer_role',
  'reviewer_principal_id',
  'reviewer_identity',
  'reviewer_model_identifier',
  'reasoning_level',
  'reviewer_source_control_identity_set',
  'reviewer_eligibility_digest',
  'review_disposition_id',
  'independence_binding',
]);

const INDEPENDENCE_BINDING_KEYS = Object.freeze([
  'immutable_session_id',
  'session_parent_or_genesis',
  'source_control_history_scope',
  'reviewed_code_commit',
  'source_control_authorship_events',
  'prior_conclusion_input_set',
  'reviewer_edit_set',
]);

const RESULT_KEYS = Object.freeze([
  'schema_version',
  'gate_id',
  'lane_id',
  'task_id',
  'exact_review_package_fingerprint',
  'exact_review_package_payload_digest',
  'code_commit',
  'frozen_contract_pair_digest',
  'contract_freeze_attestation_id',
  'review_disposition_id',
  'reviewer_principal_id',
  'reviewer_identity',
  'reviewer_role',
  'reviewer_model_identifier',
  'reasoning_level',
  'immutable_session_id',
  'independence_binding_digest',
  'disposition',
  'findings',
]);

class ContractFreezeReviewTaskError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ContractFreezeReviewTaskError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ContractFreezeReviewTaskError(code, message, details);
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requirePlainObject(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (!isPlainObject(value)) fail(code, `${label} must be a plain object.`);
}

function requireExactKeys(value, keys, label, code = 'INVALID_P1_REVIEW_INPUT') {
  requirePlainObject(value, label, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(code, `${label} fields do not match the closed contract.`, {
      missing_keys: expected.filter((key) => !actual.includes(key)),
      extra_keys: actual.filter((key) => !expected.includes(key)),
    });
  }
}

function requireDigest(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
}

function requireCommit(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || !COMMIT_RE.test(value)) {
    fail(code, `${label} must be an exact lowercase Git commit.`);
  }
}

function requireNonEmptyString(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
  }
}

function requireClosedStringSet(
  value,
  label,
  { allowEmpty = false, code = 'INVALID_P1_REVIEW_INPUT' } = {},
) {
  if (
    !Array.isArray(value)
    || (!allowEmpty && value.length === 0)
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)
    || new Set(value).size !== value.length
  ) {
    fail(code, `${label} must be a closed unique string set.`);
  }
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function recordWithout(record, omittedKeys) {
  return Object.fromEntries(Object.entries(record).filter(
    ([key]) => !omittedKeys.includes(key),
  ));
}

function decodeCanonicalBase64(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_P1_REVIEW_INPUT', `${label} must contain canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== value) {
    fail('INVALID_P1_REVIEW_INPUT', `${label} must contain canonical base64.`);
  }
  return bytes;
}

function validateBundleMembers(records, label) {
  if (!Array.isArray(records) || records.length === 0) {
    fail('INVALID_EXACT_REVIEW_PACKAGE', `${label} must be non-empty.`);
  }
  const projection = [];
  for (const [index, record] of records.entries()) {
    try {
      validateSchema('CanonicalContractBundleMember/V1', record);
    } catch (error) {
      fail('INVALID_EXACT_REVIEW_PACKAGE', `${label}[${index}] is invalid.`, {
        validation_error: error.message,
      });
    }
    const bytes = decodeCanonicalBase64(
      record.source_bytes_base64,
      `${label}[${index}].source_bytes_base64`,
    );
    if (
      bytes.length !== record.byte_length
      || sha256Hex(bytes) !== record.payload_digest
      || (
        index > 0
        && records[index - 1].member_key.localeCompare(record.member_key) >= 0
      )
    ) {
      fail(
        'INVALID_EXACT_REVIEW_PACKAGE',
        `${label} does not preserve exact ordered source bytes.`,
      );
    }
    projection.push({
      member_key: record.member_key,
      semantic_digest: record.semantic_digest,
      identity_digest: record.identity_digest,
    });
  }
  return projection;
}

function deriveSemanticIdentityDiff(predecessor, successor, predecessorId, successorId) {
  const predecessorByKey = new Map(
    predecessor.map((member) => [member.member_key, member]),
  );
  const successorByKey = new Map(
    successor.map((member) => [member.member_key, member]),
  );
  const predecessorKeys = predecessor.map((member) => member.member_key);
  const successorKeys = successor.map((member) => member.member_key);
  const shared = predecessorKeys.filter((key) => successorByKey.has(key));
  return {
    predecessor_contract_bundle_id: predecessorId,
    successor_contract_bundle_id: successorId,
    added_member_keys: successorKeys.filter((key) => !predecessorByKey.has(key)),
    removed_member_keys: predecessorKeys.filter((key) => !successorByKey.has(key)),
    semantic_changed_member_keys: shared.filter(
      (key) => predecessorByKey.get(key).semantic_digest
        !== successorByKey.get(key).semantic_digest,
    ),
    identity_changed_member_keys: shared.filter(
      (key) => predecessorByKey.get(key).identity_digest
        !== successorByKey.get(key).identity_digest,
    ),
  };
}

function validateGoverningSpecification(packageValue) {
  const records = packageValue.governing_specification_member_records;
  if (!Array.isArray(records) || records.length !== 6) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The exact review package must retain the six governing specification members.',
    );
  }
  const rootRecords = [];
  for (const [index, record] of records.entries()) {
    try {
      validateSchema('ContractFreezeGoverningSpecificationMember/V1', record);
    } catch (error) {
      fail(
        'INVALID_EXACT_REVIEW_PACKAGE',
        `governing specification member ${index} is invalid.`,
        { validation_error: error.message },
      );
    }
    const bytes = decodeCanonicalBase64(
      record.source_bytes_base64,
      `governing_specification_member_records[${index}].source_bytes_base64`,
    );
    if (
      bytes.length !== record.byte_length
      || sha256Hex(bytes) !== record.payload_digest
      || domainDigest(
        'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
        recordWithout(record, ['specification_member_id']),
      ) !== record.specification_member_id
    ) {
      fail(
        'INVALID_EXACT_REVIEW_PACKAGE',
        'A governing specification member does not match its exact source bytes.',
      );
    }
    rootRecords.push(
      `${record.path}\0${record.byte_length}\0${record.payload_digest}\n`,
    );
  }
  const specificationRoot = sha256Hex(Buffer.from(
    `CODEX_PROGRAM_SPECIFICATION_ROOT_V1\n${rootRecords.join('')}`,
    'utf8',
  ));
  if (
    records[0].path !== 'docs/codex-program/specification-manifest.json'
    || records[0].payload_digest !== packageValue.root_manifest_digest
    || specificationRoot !== packageValue.specification_root
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The governing specification members do not reproduce the frozen root.',
    );
  }
}

function validateExactReviewPackage(input) {
  const bytes = decodeCanonicalBase64(
    input.exact_review_package_bytes_base64,
    'exact_review_package_bytes_base64',
  );
  let packageValue;
  try {
    packageValue = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The exact review package bytes must contain UTF-8 JSON.',
    );
  }
  if (!bytes.equals(Buffer.from(canonicalJson(packageValue), 'utf8'))) {
    fail(
      'NON_CANONICAL_EXACT_REVIEW_PACKAGE_BYTES',
      'The exact review package bytes must use canonical JSON.',
    );
  }
  requireExactKeys(
    packageValue,
    REVIEW_PACKAGE_KEYS,
    'exact review package',
    'INVALID_EXACT_REVIEW_PACKAGE',
  );
  if (packageValue.schema_version !== EXACT_REVIEW_INPUT_VERSION) {
    fail(
      'P1_G0_SCOPE_CONFUSION',
      `The review package must use ${EXACT_REVIEW_INPUT_VERSION}.`,
    );
  }
  const fingerprint = contentId(REVIEW_PACKAGE_FINGERPRINT_DOMAIN, packageValue);
  if (fingerprint !== input.exact_review_package_fingerprint) {
    fail(
      'EXACT_REVIEW_PACKAGE_FINGERPRINT_MISMATCH',
      'The supplied fingerprint does not identify the exact review package bytes.',
    );
  }
  validateGoverningSpecification(packageValue);

  let predecessor;
  try {
    predecessor = validateCanonicalPredecessorBundleMembers(
      packageValue.predecessor_canonical_contract_bundle_members,
    );
  } catch (error) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The predecessor source closure is not mechanically valid.',
      { source_error_code: error.code || 'UNKNOWN' },
    );
  }
  const successorProjection = validateBundleMembers(
    packageValue.canonical_contract_bundle_members,
    'canonical_contract_bundle_members',
  );
  if (
    !sameValue(predecessor.projection, packageValue.predecessor_contract_bundle_projection)
    || !sameValue(successorProjection, packageValue.canonical_contract_bundle_projection)
    || !sameValue(predecessor.source_kinds, packageValue.predecessor_source_kinds)
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'A bundle projection does not match its exact retained member bytes.',
    );
  }

  const predecessorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    predecessor.projection,
  );
  const successorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    successorProjection,
  );
  const predecessorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorDigest },
  );
  const successorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: successorDigest },
  );
  if (
    packageValue.predecessor_contract_bundle_digest !== predecessorDigest
    || packageValue.predecessor_contract_bundle_id !== predecessorId
    || packageValue.contract_bundle_digest !== successorDigest
    || packageValue.contract_bundle_id !== successorId
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The bundle identity does not match the exact predecessor and successor projections.',
    );
  }

  const expectedDiff = deriveSemanticIdentityDiff(
    predecessor.projection,
    successorProjection,
    predecessorId,
    successorId,
  );
  const diffDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    expectedDiff,
  );
  if (
    !sameValue(packageValue.semantic_identity_diff, expectedDiff)
    || packageValue.semantic_identity_diff_digest !== diffDigest
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The semantic-and-identity diff does not match the exact bundle pair.',
    );
  }

  const identity = packageValue.contract_freeze_attestation_identity;
  try {
    validateSchema('ContractFreezeAttestationIdentity/V1', identity);
  } catch (error) {
    fail(
      'INVALID_SOURCE_CLOSURE_IDENTITY',
      'The source-closure identity does not satisfy its signed schema.',
      { validation_error: error.message },
    );
  }
  const expectedIdentityId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_FREEZE_ATTESTATION_ID/V1',
    recordWithout(identity, ['contract_freeze_attestation_id']),
  );
  const predecessorMemberRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    predecessor.members,
  );
  if (
    !sameValue(identity, input.source_closure_identity)
    || identity.contract_freeze_attestation_id !== expectedIdentityId
    || identity.specification_root !== packageValue.specification_root
    || identity.code_commit !== input.code_commit
    || identity.code_commit !== packageValue.code_commit
    || identity.environment !== packageValue.environment
    || identity.predecessor_contract_bundle_id !== predecessorId
    || identity.predecessor_contract_bundle_digest !== predecessorDigest
    || identity.predecessor_canonical_contract_bundle_member_root
      !== predecessorMemberRoot
    || identity.predecessor_canonical_contract_bundle_member_count
      !== predecessor.members.length
    || identity.contract_bundle_id !== successorId
    || identity.contract_bundle_digest !== successorDigest
  ) {
    fail(
      'SOURCE_CLOSURE_IDENTITY_MISMATCH',
      'The source-closure identity does not bind the exact code and bundle pair.',
    );
  }

  const pairDigest = domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      successor_contract_bundle_id: successorId,
      successor_contract_bundle_digest: successorDigest,
      contract_freeze_attestation_id: expectedIdentityId,
    },
  );
  if (
    pairDigest !== input.frozen_contract_pair_digest
    || pairDigest !== packageValue.frozen_contract_pair_digest
  ) {
    fail(
      'FROZEN_CONTRACT_PAIR_MISMATCH',
      'The frozen-pair digest does not bind the exact source-closed bundle pair.',
    );
  }

  const sourceSetDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
    {
      exact_review_input_schema_version: EXACT_REVIEW_INPUT_VERSION,
      predecessor_canonical_contract_bundle_members: predecessor.members,
      canonical_contract_bundle_members: packageValue.canonical_contract_bundle_members,
    },
  );
  const inputContextDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: packageValue.specification_root,
      code_commit: input.code_commit,
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      frozen_contract_pair_digest: pairDigest,
      semantic_identity_diff_digest: diffDigest,
      reviewed_contract_source_set_digest: sourceSetDigest,
    },
  );
  if (
    packageValue.reviewed_contract_source_set_digest !== sourceSetDigest
    || packageValue.exact_review_input_context_digest !== inputContextDigest
    || packageValue.contract_bundle_freeze_candidate.contract_bundle_id !== successorId
    || packageValue.contract_bundle_freeze_candidate.contract_bundle_digest
      !== successorDigest
    || packageValue.contract_bundle_freeze_candidate.frozen_contract_pair_digest
      !== pairDigest
    || !sameValue(
      packageValue.contract_bundle_freeze_candidate.canonical_contract_bundle_members,
      packageValue.canonical_contract_bundle_members,
    )
    || !sameValue(
      packageValue.contract_bundle_freeze_candidate.canonical_contract_bundle_projection,
      packageValue.canonical_contract_bundle_projection,
    )
  ) {
    fail(
      'EXACT_REVIEW_CONTEXT_MISMATCH',
      'The exact review context does not bind the retained sources and frozen pair.',
    );
  }
  return {
    packageValue,
    bytes,
    payloadDigest: sha256Hex(bytes),
    inputContextDigest,
  };
}

function validateIndependenceBinding(binding, reviewerBinding, codeCommit) {
  requireExactKeys(
    binding,
    INDEPENDENCE_BINDING_KEYS,
    `${reviewerBinding.lane_id} independence_binding`,
  );
  requireNonEmptyString(
    binding.immutable_session_id,
    `${reviewerBinding.lane_id} immutable_session_id`,
  );
  if (
    binding.session_parent_or_genesis !== 'GENESIS'
    || binding.source_control_history_scope
      !== 'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS'
    || binding.reviewed_code_commit !== codeCommit
  ) {
    fail(
      'NON_INDEPENDENT_P1_REVIEWER',
      `${reviewerBinding.lane_id} does not use a genesis review session bound to the exact commit.`,
    );
  }
  if (
    !Array.isArray(binding.source_control_authorship_events)
    || binding.source_control_authorship_events.length === 0
  ) {
    fail(
      'INCOMPLETE_P1_REVIEWER_ANCESTRY',
      `${reviewerBinding.lane_id} must bind the supplied complete Git ancestry.`,
    );
  }
  const commits = [];
  const ancestryIdentities = new Set();
  for (const [index, event] of binding.source_control_authorship_events.entries()) {
    requireExactKeys(
      event,
      ['commit_id', 'identity_set'],
      `${reviewerBinding.lane_id} source_control_authorship_events[${index}]`,
    );
    requireCommit(event.commit_id, `${reviewerBinding.lane_id} authorship commit`);
    requireClosedStringSet(
      event.identity_set,
      `${reviewerBinding.lane_id} authorship identity_set`,
    );
    commits.push(event.commit_id);
    event.identity_set.forEach((identity) => ancestryIdentities.add(identity));
  }
  if (
    new Set(commits).size !== commits.length
    || !commits.includes(codeCommit)
  ) {
    fail(
      'INCOMPLETE_P1_REVIEWER_ANCESTRY',
      `${reviewerBinding.lane_id} ancestry must contain unique events including the reviewed commit.`,
    );
  }
  requireClosedStringSet(
    binding.prior_conclusion_input_set,
    `${reviewerBinding.lane_id} prior_conclusion_input_set`,
    { allowEmpty: true },
  );
  requireClosedStringSet(
    binding.reviewer_edit_set,
    `${reviewerBinding.lane_id} reviewer_edit_set`,
    { allowEmpty: true },
  );
  if (
    binding.prior_conclusion_input_set.length !== 0
    || binding.reviewer_edit_set.length !== 0
    || reviewerBinding.reviewer_source_control_identity_set.some(
      (identity) => ancestryIdentities.has(identity),
    )
  ) {
    fail(
      'NON_INDEPENDENT_P1_REVIEWER',
      `${reviewerBinding.lane_id} reviewer ancestry, prior conclusions, or edits are not independent.`,
    );
  }
}

function validateReviewerBindings(bindings, codeCommit) {
  if (!Array.isArray(bindings) || bindings.length !== REVIEW_LANES.length) {
    fail(
      'INVALID_P1_REVIEW_LANE_SET',
      'Exactly three governed P1 reviewer bindings are required.',
    );
  }
  const principals = new Set();
  const identities = new Set();
  const sessions = new Set();
  for (const [index, expectedLane] of REVIEW_LANES.entries()) {
    const binding = bindings[index];
    requireExactKeys(
      binding,
      REVIEWER_BINDING_KEYS,
      `reviewer_bindings[${index}]`,
    );
    if (
      binding.lane_id !== expectedLane.lane_id
      || binding.reviewer_role !== expectedLane.reviewer_role
    ) {
      fail(
        binding.lane_id?.startsWith('G0_')
          ? 'P1_G0_SCOPE_CONFUSION'
          : 'INVALID_P1_REVIEW_LANE_SET',
        'Reviewer bindings must use the exact ordered formal P1 lanes and roles.',
      );
    }
    requireNonEmptyString(binding.reviewer_principal_id, 'reviewer_principal_id');
    requireNonEmptyString(binding.reviewer_identity, 'reviewer_identity');
    requireClosedStringSet(
      binding.reviewer_source_control_identity_set,
      'reviewer_source_control_identity_set',
    );
    requireDigest(binding.reviewer_eligibility_digest, 'reviewer_eligibility_digest');
    requireDigest(binding.review_disposition_id, 'review_disposition_id');
    if (
      binding.reviewer_model_identifier !== EXACT_MODEL_IDENTIFIER
      || binding.reasoning_level !== EXACT_REASONING_LEVEL
    ) {
      fail(
        'INVALID_P1_REVIEWER_RUNTIME',
        `Every P1 reviewer must use ${EXACT_MODEL_IDENTIFIER} with high reasoning.`,
      );
    }
    validateIndependenceBinding(
      binding.independence_binding,
      binding,
      codeCommit,
    );
    if (
      principals.has(binding.reviewer_principal_id)
      || identities.has(binding.reviewer_identity)
      || sessions.has(binding.independence_binding.immutable_session_id)
    ) {
      fail(
        'DUPLICATE_P1_REVIEWER',
        'The three formal P1 lanes require distinct reviewer principals, identities, and sessions.',
      );
    }
    principals.add(binding.reviewer_principal_id);
    identities.add(binding.reviewer_identity);
    sessions.add(binding.independence_binding.immutable_session_id);
  }
}

function promptFor(lane) {
  return [
    `You are the independent ${lane.lane_id} reviewer for the formal P1 contract-freeze bundle.`,
    'Review only the exact canonical package bytes supplied in this task.',
    `Focus on ${lane.focus}.`,
    'Do not use G0 cold-review conclusions as a substitute for this P1 review.',
    'Do not modify files, sign records, approve the freeze, or claim gate authority.',
    'Use PASS only when there is no finding.',
    'Use BLOCKING when at least one finding prevents the formal record.',
    'Use NON-BLOCKING only when every finding is non-blocking.',
    'Each finding must name the exact file, exact rule, and required correction.',
    'Return only the closed result object.',
  ].join('\n');
}

function taskFor(lane, binding, input, packageFacts) {
  const independenceBindingDigest = domainDigest(
    'PROGRAMME_GATE_P1_REVIEW_INDEPENDENCE_BINDING/V1',
    binding.independence_binding,
  );
  const payload = {
    schema_version: TASK_VERSION,
    gate_id: GATE_ID,
    lane_id: lane.lane_id,
    formal_record_schema_id: lane.formal_record_schema_id,
    formal_authority_kind: lane.formal_authority_kind,
    review_scope: lane.review_scope,
    exact_review_input: {
      exact_review_package_fingerprint:
        input.exact_review_package_fingerprint,
      exact_review_package_payload_digest: packageFacts.payloadDigest,
      exact_review_package_byte_length: packageFacts.bytes.length,
      exact_review_package_bytes_base64:
        input.exact_review_package_bytes_base64,
      exact_input_context_digest: packageFacts.inputContextDigest,
      code_commit: input.code_commit,
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      contract_freeze_attestation_id:
        input.source_closure_identity.contract_freeze_attestation_id,
    },
    reviewer_binding: clone(binding),
    independence_binding_digest: independenceBindingDigest,
    prompt: promptFor(lane),
    output_contract: {
      schema_version: RESULT_VERSION,
      dispositions: ['PASS', 'BLOCKING', 'NON-BLOCKING'],
      finding_fields: [
        'disposition',
        'file',
        'rule',
        'required_correction',
      ],
      signing_authority: 'NONE',
      gate_authority: 'NONE',
    },
  };
  return {
    ...payload,
    task_id: domainDigest(
      'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_TASK_ID/V1',
      payload,
    ),
  };
}

function validateRequestInput(value) {
  requireExactKeys(value, REQUEST_INPUT_KEYS, 'P1 review request input');
  if (value.schema_version !== REQUEST_INPUT_VERSION) {
    fail(
      value.schema_version?.includes('G0')
        ? 'P1_G0_SCOPE_CONFUSION'
        : 'INVALID_P1_REVIEW_INPUT',
      `P1 review input must use ${REQUEST_INPUT_VERSION}.`,
    );
  }
  requireDigest(
    value.exact_review_package_fingerprint,
    'exact_review_package_fingerprint',
  );
  requireCommit(value.code_commit, 'code_commit');
  requireDigest(value.frozen_contract_pair_digest, 'frozen_contract_pair_digest');
  validateReviewerBindings(value.reviewer_bindings, value.code_commit);
  return validateExactReviewPackage(value);
}

function createP1ContractFreezeReviewRequest(value) {
  requirePlainObject(value, 'P1 review request input');
  const input = clone(value);
  const packageFacts = validateRequestInput(input);
  const tasks = REVIEW_LANES.map((lane, index) => (
    taskFor(lane, input.reviewer_bindings[index], input, packageFacts)
  ));
  const requestIdentity = {
    gate_id: GATE_ID,
    exact_review_package_fingerprint:
      input.exact_review_package_fingerprint,
    exact_review_package_payload_digest: packageFacts.payloadDigest,
    code_commit: input.code_commit,
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    source_closure_identity: input.source_closure_identity,
    ordered_task_ids: tasks.map((task) => task.task_id),
  };
  return deepFreeze({
    schema_version: REQUEST_VERSION,
    request_id: domainDigest(
      'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_REQUEST_ID/V1',
      requestIdentity,
    ),
    gate_id: GATE_ID,
    request_input: input,
    tasks,
    disposition: {
      state: 'TASKS_CREATED_NOT_REVIEWED',
      structural_validation_only: true,
      review_execution: 'NOT_PERFORMED',
      signing_authority: 'NONE',
      freeze_authority: 'NONE',
      status_publication_authority: 'NONE',
    },
  });
}

function validateRequest(request) {
  requireExactKeys(
    request,
    ['schema_version', 'request_id', 'gate_id', 'request_input', 'tasks', 'disposition'],
    'P1 review request',
    'INVALID_P1_REVIEW_REQUEST',
  );
  if (request.schema_version !== REQUEST_VERSION || request.gate_id !== GATE_ID) {
    fail('P1_G0_SCOPE_CONFUSION', 'Only a formal P1 review request is accepted.');
  }
  const expected = createP1ContractFreezeReviewRequest(request.request_input);
  if (!sameValue(request, expected)) {
    fail(
      'SELF_REHASHED_P1_REVIEW_SUBSTITUTION',
      'The review request does not match the exact controller-generated request.',
    );
  }
  return expected;
}

function validateFinding(finding, index, result) {
  requireExactKeys(
    finding,
    ['disposition', 'file', 'rule', 'required_correction'],
    `${result.lane_id} findings[${index}]`,
    'INVALID_P1_REVIEW_RESULT',
  );
  if (!['BLOCKING', 'NON-BLOCKING'].includes(finding.disposition)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      'A finding disposition must be BLOCKING or NON-BLOCKING.',
    );
  }
  for (const field of ['file', 'rule', 'required_correction']) {
    requireNonEmptyString(
      finding[field],
      `${result.lane_id} finding ${field}`,
      'INVALID_P1_REVIEW_RESULT',
    );
  }
  if (
    finding.file.startsWith('/')
    || finding.file.includes('\\')
    || finding.file.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      'A finding file must be an exact safe repository-relative path.',
    );
  }
}

function validateOneResult(result, task) {
  requireExactKeys(
    result,
    RESULT_KEYS,
    `${task.lane_id} result`,
    'INVALID_P1_REVIEW_RESULT',
  );
  const expected = {
    schema_version: RESULT_VERSION,
    gate_id: GATE_ID,
    lane_id: task.lane_id,
    task_id: task.task_id,
    exact_review_package_fingerprint:
      task.exact_review_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest:
      task.exact_review_input.exact_review_package_payload_digest,
    code_commit: task.exact_review_input.code_commit,
    frozen_contract_pair_digest:
      task.exact_review_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id:
      task.exact_review_input.contract_freeze_attestation_id,
    review_disposition_id:
      task.reviewer_binding.review_disposition_id,
    reviewer_principal_id:
      task.reviewer_binding.reviewer_principal_id,
    reviewer_identity: task.reviewer_binding.reviewer_identity,
    reviewer_role: task.reviewer_binding.reviewer_role,
    reviewer_model_identifier:
      task.reviewer_binding.reviewer_model_identifier,
    reasoning_level: task.reviewer_binding.reasoning_level,
    immutable_session_id:
      task.reviewer_binding.independence_binding.immutable_session_id,
    independence_binding_digest: task.independence_binding_digest,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) {
      fail(
        result.gate_id?.startsWith('G0_')
          ? 'P1_G0_SCOPE_CONFUSION'
          : 'P1_REVIEW_RESULT_BINDING_MISMATCH',
        `${task.lane_id} result changed the exact ${key} binding.`,
      );
    }
  }
  if (!['PASS', 'BLOCKING', 'NON-BLOCKING'].includes(result.disposition)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} result must contain a closed disposition.`,
    );
  }
  if (!Array.isArray(result.findings)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} result must contain findings.`,
    );
  }
  result.findings.forEach((finding, index) => validateFinding(finding, index, result));
  const blockingCount = result.findings.filter(
    (finding) => finding.disposition === 'BLOCKING',
  ).length;
  const nonBlockingCount = result.findings.length - blockingCount;
  if (
    (result.disposition === 'PASS' && result.findings.length !== 0)
    || (
      result.disposition === 'BLOCKING'
      && (result.findings.length === 0 || blockingCount === 0)
    )
    || (
      result.disposition === 'NON-BLOCKING'
      && (result.findings.length === 0 || blockingCount !== 0)
    )
  ) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} disposition does not match its findings.`,
    );
  }
  return {
    lane_id: task.lane_id,
    reported_disposition: result.disposition,
    blocking_finding_count: blockingCount,
    non_blocking_finding_count: nonBlockingCount,
  };
}

function validateP1ContractFreezeReviewResults({ request, results } = {}) {
  const exactRequest = validateRequest(request);
  if (!Array.isArray(results) || results.length !== REVIEW_LANES.length) {
    fail(
      'INVALID_P1_REVIEW_RESULT_SET',
      'Exactly one result for each of the three formal P1 lanes is required.',
    );
  }
  const laneIds = results.map((result) => result?.lane_id);
  if (
    new Set(laneIds).size !== laneIds.length
    || laneIds.some((laneId, index) => laneId !== REVIEW_LANES[index].lane_id)
  ) {
    fail(
      laneIds.some((laneId) => typeof laneId === 'string' && laneId.startsWith('G0_'))
        ? 'P1_G0_SCOPE_CONFUSION'
        : 'INVALID_P1_REVIEW_RESULT_SET',
      'Results must contain the exact ordered three-lane P1 review set.',
    );
  }
  const laneResults = results.map((result, index) => (
    validateOneResult(result, exactRequest.tasks[index])
  ));
  return deepFreeze({
    schema_version: VALIDATION_VERSION,
    request_id: exactRequest.request_id,
    exact_review_package_fingerprint:
      exactRequest.request_input.exact_review_package_fingerprint,
    code_commit: exactRequest.request_input.code_commit,
    frozen_contract_pair_digest:
      exactRequest.request_input.frozen_contract_pair_digest,
    lane_results: laneResults,
    validation_state: 'STRUCTURALLY_VALIDATED_ONLY',
    review_execution: 'CALLER_SUPPLIED',
    signed_record_production: 'NOT_PERFORMED',
    gate_state: 'NOT_EVALUATED',
    freeze_authority: 'NONE',
    status_publication_authority: 'NONE',
  });
}

module.exports = {
  EXACT_MODEL_IDENTIFIER,
  EXACT_REASONING_LEVEL,
  P1_CONTRACT_FREEZE_REVIEW_LANES: REVIEW_LANES,
  ContractFreezeReviewTaskError,
  createP1ContractFreezeReviewRequest,
  validateP1ContractFreezeReviewResults,
};
