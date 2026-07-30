const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { domainDigest } = require('../programme-gates/bytes');
const { validateSchema } = require('../programme-gates/schema-registry');
const {
  compileCanonicalContractBundle,
} = require('./canonical-contract-bundle-compiler');
const {
  compileCanonicalContractBundleGeneratedTopology,
} = require('./canonical-contract-bundle-generated-topology');
const {
  assertDeterministicCompilations,
  assembleCanonicalContractBundleFreezeCandidate,
} = require('./canonical-contract-bundle-freeze-candidate-assembler');

const PRE_REVIEW_PACKAGE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_PACKAGE/V1';
const EXACT_REVIEW_PACKAGE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V1';
const PRE_REVIEW_ATTESTATION_PLACEHOLDER_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_ATTESTATION_PLACEHOLDER/V1';
const PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID_DOMAIN =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID/V1';
const PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER_DOMAIN =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER/V1';
const PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER_DOMAIN =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER/V1';
const SPECIFICATION_MANIFEST_PATH =
  'docs/codex-program/specification-manifest.json';
const SPECIFICATION_ROOT_DOMAIN = 'CODEX_PROGRAM_SPECIFICATION_ROOT_V1';
const SPECIFICATION_ROOT_INPUT_ENCODING =
  'SHA-256 over UTF-8 domain separator plus LF followed only by ordered member records 1 through 6; each record is UTF-8 path plus NUL, ASCII decimal byte length plus NUL, lowercase SHA-256 of raw member bytes plus LF; member 1 is the manifest record computed from raw manifest bytes, members 2 through 6 are the declared content-file records; no raw member bytes or implicit records are appended';
const SPECIFICATION_ROOT_MEMBERSHIP =
  'EXACT_ORDERED_MEMBER_RECORDS_MANIFEST_THEN_FIVE_DECLARED_CONTENT_FILES';
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;

const REQUIRED_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'classification_registry',
  'dependency_registry',
  'governed_registry_bindings',
  'predecessor_contract_bundle_projection',
  'governing_specification_members',
  'code_commit',
  'environment',
  'approval_epoch_nonce',
]);

const OPTIONAL_INPUT_KEYS = Object.freeze([
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

const REMAINING_FORMAL_FREEZE_INPUTS = Object.freeze([
  Object.freeze({
    member_type: 'ContractFreezeAuthorityManifest',
    schema_id: 'ContractFreezeAuthorityManifest/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAuthorityEvidence',
    schema_id: 'ContractFreezeAuthorityEvidence/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ExactDigestReviewSetAttestation',
    schema_id: 'ExactDigestReviewSetAttestation/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApprovalEvidence',
    schema_id: 'BenSpecificationApprovalEvidence/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateEvidenceEnvelope',
    schema_id: 'ProgrammeGateEvidenceEnvelope/V2',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'TrustedReviewControllerRecord',
    schema_id: 'TrustedReviewControllerRecord/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ReviewerIndependenceAttestation',
    schema_id: 'ReviewerIndependenceAttestation/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApproval',
    schema_id: 'BenSpecificationApproval/V1',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ContractBundleCompilationReceipt',
    schema_id: 'ContractBundleCompilationReceipt/V1',
    state: 'VALIDATOR_IDENTITY_AND_SIGNATURE_NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ContractDiffReviewAttestation',
    schema_id: 'ContractDiffReviewAttestation/V1',
    state: 'REVIEW_CONCLUSION_NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeApproval',
    schema_id: 'ContractFreezeApproval/V1',
    state: 'BEN_APPROVAL_NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateStatusArtefact',
    schema_id: 'ProgrammeGateStatusArtefact/V2',
    state: 'NOT_SUPPLIED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAttestation',
    schema_id: 'ContractFreezeAttestation/V1',
    state: 'NOT_SUPPLIED',
  }),
]);

class CanonicalContractBundlePreReviewPackageAssemblerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundlePreReviewPackageAssemblerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundlePreReviewPackageAssemblerError(
    code,
    message,
    details,
  );
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requirePlainObject(value, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (
      Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null
    )
  ) {
    fail('INVALID_PRE_REVIEW_PACKAGE_INPUT', `${label} must be a plain object.`);
  }
}

function requireExactKeys(value, keys, label, code = 'INVALID_PRE_REVIEW_PACKAGE_INPUT') {
  requirePlainObject(value, label);
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} fields do not match the closed contract.`, {
      actual,
      expected,
    });
  }
}

function requireDigest(value, label, code = 'INVALID_PRE_REVIEW_PACKAGE_INPUT') {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
}

function requireSafePath(value, label) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 512
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('\0')
    || value.includes('\n')
    || !/^[A-Za-z0-9._/-]+$/.test(value)
    || value.split('/').includes('.')
    || value.split('/').includes('..')
  ) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_MEMBER',
      `${label} must be a safe repository-relative path.`,
    );
  }
}

function validateTopLevelInput(input) {
  requirePlainObject(input, 'pre-review package input');
  const actual = Object.keys(input).sort(compareStrings);
  const allowed = [...REQUIRED_INPUT_KEYS, ...OPTIONAL_INPUT_KEYS].sort(compareStrings);
  const missing = REQUIRED_INPUT_KEYS.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !allowed.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      'INVALID_PRE_REVIEW_PACKAGE_INPUT',
      'Pre-review package fields do not match the closed input contract.',
      { missing_keys: missing, extra_keys: extra },
    );
  }
  if (!COMMIT_RE.test(input.code_commit)) {
    fail('INVALID_PRE_REVIEW_CODE_COMMIT', 'code_commit must be an exact Git commit.');
  }
  if (!['STAGING', 'PRODUCTION'].includes(input.environment)) {
    fail(
      'INVALID_PRE_REVIEW_ENVIRONMENT',
      'environment must use the existing STAGING or PRODUCTION value.',
    );
  }
  if (
    typeof input.approval_epoch_nonce !== 'string'
    || input.approval_epoch_nonce.length === 0
    || Buffer.byteLength(input.approval_epoch_nonce, 'utf8') > 256
    || /[\u0000-\u001f\u007f]/.test(input.approval_epoch_nonce)
  ) {
    fail(
      'INVALID_APPROVAL_EPOCH_NONCE',
      'approval_epoch_nonce must be a bounded non-empty string without control bytes.',
    );
  }
}

function validateSpecificationManifest(manifest, members) {
  requirePlainObject(manifest, 'governing specification manifest');
  if (
    manifest.schema !== 'codex-program-specification-manifest/v1'
    || manifest.domain_separator !== SPECIFICATION_ROOT_DOMAIN
    || manifest.root_input_encoding !== SPECIFICATION_ROOT_INPUT_ENCODING
    || manifest.root_membership !== SPECIFICATION_ROOT_MEMBERSHIP
    || !Array.isArray(manifest.files)
    || manifest.files.length !== members.length - 1
  ) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_MANIFEST',
      'The governing specification manifest does not use the frozen root contract.',
    );
  }
  const declared = manifest.files.map((entry, index) => {
    requireExactKeys(
      entry,
      ['order', 'path', 'byte_length', 'sha256'],
      `governing specification manifest.files[${index}]`,
      'INVALID_GOVERNING_SPECIFICATION_MANIFEST',
    );
    requireSafePath(entry.path, `manifest.files[${index}].path`);
    if (
      entry.order !== index + 2
      || !Number.isSafeInteger(entry.byte_length)
      || entry.byte_length < 1
    ) {
      fail(
        'INVALID_GOVERNING_SPECIFICATION_MANIFEST',
        'Manifest members must have contiguous order and positive byte length.',
      );
    }
    requireDigest(
      entry.sha256,
      `manifest.files[${index}].sha256`,
      'INVALID_GOVERNING_SPECIFICATION_MANIFEST',
    );
    return entry;
  });
  const observed = members.slice(1).map((member) => ({
    order: member.order,
    path: member.path,
    byte_length: member.byte_length,
    sha256: member.payload_digest,
  }));
  if (canonicalJson(declared) !== canonicalJson(observed)) {
    fail(
      'GOVERNING_SPECIFICATION_MANIFEST_MEMBER_DRIFT',
      'The manifest declarations do not match the exact supplied specification bytes.',
    );
  }
}

function compileGoverningSpecificationMembers(values) {
  if (!Array.isArray(values) || values.length !== 6) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_MEMBER_SET',
      'The existing governing specification root requires exactly six ordered members.',
    );
  }
  const members = values.map((value, index) => {
    requireExactKeys(
      value,
      ['order', 'path', 'byte_length', 'payload_digest', 'source_bytes_base64'],
      `governing_specification_members[${index}]`,
      'INVALID_GOVERNING_SPECIFICATION_MEMBER',
    );
    if (
      value.order !== index + 1
      || !Number.isSafeInteger(value.byte_length)
      || value.byte_length < 1
    ) {
      fail(
        'INVALID_GOVERNING_SPECIFICATION_MEMBER',
        'Specification members must have contiguous order and positive byte length.',
      );
    }
    requireSafePath(value.path, `governing_specification_members[${index}].path`);
    requireDigest(
      value.payload_digest,
      `governing_specification_members[${index}].payload_digest`,
      'INVALID_GOVERNING_SPECIFICATION_MEMBER',
    );
    if (typeof value.source_bytes_base64 !== 'string' || value.source_bytes_base64.length === 0) {
      fail(
        'INVALID_GOVERNING_SPECIFICATION_MEMBER',
        'Specification source bytes must be non-empty canonical base64.',
      );
    }
    const bytes = Buffer.from(value.source_bytes_base64, 'base64');
    if (
      bytes.length !== value.byte_length
      || bytes.toString('base64') !== value.source_bytes_base64
      || sha256Hex(bytes) !== value.payload_digest
    ) {
      fail(
        'GOVERNING_SPECIFICATION_MEMBER_SOURCE_DRIFT',
        'Specification member metadata does not match its exact source bytes.',
        { path: value.path },
      );
    }
    return {
      order: value.order,
      path: value.path,
      byte_length: value.byte_length,
      payload_digest: value.payload_digest,
      source_bytes_base64: value.source_bytes_base64,
      bytes,
    };
  });
  if (
    members[0].path !== SPECIFICATION_MANIFEST_PATH
    || new Set(members.map((member) => member.path)).size !== members.length
  ) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_MEMBER_SET',
      'The first member must be the root manifest and all member paths must be unique.',
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(members[0].bytes.toString('utf8'));
  } catch {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_MANIFEST',
      'The root specification manifest must be valid UTF-8 JSON.',
    );
  }
  validateSpecificationManifest(manifest, members);

  const records = members.map((member) => (
    `${member.path}\0${member.byte_length}\0${member.payload_digest}\n`
  )).join('');
  const specificationRoot = sha256Hex(
    Buffer.from(`${SPECIFICATION_ROOT_DOMAIN}\n${records}`, 'utf8'),
  );
  const governingRecords = members.map((member) => {
    const unsigned = {
      schema_version: 'ContractFreezeGoverningSpecificationMember/V1',
      path: member.path,
      byte_length: member.byte_length,
      payload_digest: member.payload_digest,
      source_bytes_base64: member.source_bytes_base64,
    };
    const record = {
      ...unsigned,
      specification_member_id: domainDigest(
        'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
        unsigned,
      ),
    };
    try {
      validateSchema('ContractFreezeGoverningSpecificationMember/V1', record);
    } catch (error) {
      fail(
        'INVALID_GOVERNING_SPECIFICATION_MEMBER',
        'A governing specification member does not satisfy the existing schema.',
        { validation_error: error.message },
      );
    }
    return record;
  });
  return {
    specification_root: specificationRoot,
    root_manifest_digest: members[0].payload_digest,
    governing_specification_member_records: governingRecords,
  };
}

function validateProjection(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    fail('INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION', `${label} must be non-empty.`);
  }
  const projection = values.map((value, index) => {
    requireExactKeys(
      value,
      ['member_key', 'semantic_digest', 'identity_digest'],
      `${label}[${index}]`,
      'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    );
    if (
      typeof value.member_key !== 'string'
      || !/^[A-Z][A-Z0-9_./:-]{0,127}$/.test(value.member_key)
    ) {
      fail(
        'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
        'Projection member keys must use the bounded programme token form.',
      );
    }
    requireDigest(
      value.semantic_digest,
      `${label}[${index}].semantic_digest`,
      'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    );
    requireDigest(
      value.identity_digest,
      `${label}[${index}].identity_digest`,
      'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    );
    return clone(value);
  });
  const keys = projection.map((member) => member.member_key);
  if (
    new Set(keys).size !== keys.length
    || keys.some((key, index) => index > 0 && compareStrings(keys[index - 1], key) >= 0)
  ) {
    fail(
      'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
      'Projection members must have unique keys in exact ascending order.',
    );
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
  const sharedKeys = predecessorKeys.filter((key) => successorByKey.has(key));
  return {
    predecessor_contract_bundle_id: predecessorId,
    successor_contract_bundle_id: successorId,
    added_member_keys: successorKeys.filter((key) => !predecessorByKey.has(key)),
    removed_member_keys: predecessorKeys.filter((key) => !successorByKey.has(key)),
    semantic_changed_member_keys: sharedKeys.filter((key) => (
      predecessorByKey.get(key).semantic_digest
        !== successorByKey.get(key).semantic_digest
    )),
    identity_changed_member_keys: sharedKeys.filter((key) => (
      predecessorByKey.get(key).identity_digest
        !== successorByKey.get(key).identity_digest
    )),
  };
}

function compilerInput(input) {
  return {
    canonical_contract_input_compilation:
      clone(input.canonical_contract_input_compilation),
    classification_registry: clone(input.classification_registry),
    dependency_registry: clone(input.dependency_registry),
    governed_registry_bindings: clone(input.governed_registry_bindings),
    predecessor_classification_registry:
      input.predecessor_classification_registry === undefined
        ? null
        : clone(input.predecessor_classification_registry),
    predecessor_dependency_registry:
      input.predecessor_dependency_registry === undefined
        ? null
        : clone(input.predecessor_dependency_registry),
  };
}

function assembleCanonicalContractBundlePreReviewPackage(input = {}) {
  validateTopLevelInput(input);
  const frozenInput = clone(input);
  validateTopLevelInput(frozenInput);
  const specification = compileGoverningSpecificationMembers(
    frozenInput.governing_specification_members,
  );
  const predecessorProjection = validateProjection(
    frozenInput.predecessor_contract_bundle_projection,
    'predecessor_contract_bundle_projection',
  );

  const exactCompilerInput = compilerInput(frozenInput);
  const firstCompilation = compileCanonicalContractBundle(clone(exactCompilerInput));
  const secondCompilation = compileCanonicalContractBundle(clone(exactCompilerInput));
  const preReviewDeterminismReport = assertDeterministicCompilations(
    firstCompilation,
    secondCompilation,
  );
  const successorProjection = validateProjection(
    firstCompilation.canonical_contract_bundle_projection,
    'successor_contract_bundle_projection',
  );
  const predecessorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    predecessorProjection,
  );
  const predecessorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorDigest },
  );
  const generatedTopology = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation:
      exactCompilerInput.canonical_contract_input_compilation,
    canonical_contract_bundle_compilation: firstCompilation,
  });
  const successorDigest =
    generatedTopology.final_canonical_contract_bundle
      .canonical_contract_bundle_fingerprint;
  const successorId =
    generatedTopology.final_canonical_contract_bundle
      .canonical_contract_bundle_id;

  const preReviewAttestationPlaceholderUnsigned = {
    schema_version: PRE_REVIEW_ATTESTATION_PLACEHOLDER_SCHEMA_VERSION,
    specification_root: specification.specification_root,
    code_commit: frozenInput.code_commit,
    environment: frozenInput.environment,
    predecessor_contract_bundle_id: predecessorId,
    predecessor_contract_bundle_digest: predecessorDigest,
    contract_bundle_id: successorId,
    contract_bundle_digest: successorDigest,
    approval_epoch_nonce: frozenInput.approval_epoch_nonce,
  };
  const preReviewAttestationPlaceholder = {
    ...preReviewAttestationPlaceholderUnsigned,
    pre_review_attestation_placeholder_id: domainDigest(
      PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID_DOMAIN,
      preReviewAttestationPlaceholderUnsigned,
    ),
  };
  const preReviewFrozenPairPlaceholderDigest = domainDigest(
    PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER_DOMAIN,
    {
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      successor_contract_bundle_id: successorId,
      successor_contract_bundle_digest: successorDigest,
      pre_review_attestation_placeholder_id:
        preReviewAttestationPlaceholder.pre_review_attestation_placeholder_id,
    },
  );
  const semanticIdentityDiff = deriveSemanticIdentityDiff(
    predecessorProjection,
    successorProjection,
    predecessorId,
    successorId,
  );
  const semanticIdentityDiffDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    semanticIdentityDiff,
  );
  const preReviewInputContextPlaceholderDigest = domainDigest(
    PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER_DOMAIN,
    {
      specification_root: specification.specification_root,
      code_commit: frozenInput.code_commit,
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      pre_review_frozen_pair_placeholder_digest:
        preReviewFrozenPairPlaceholderDigest,
      semantic_identity_diff_digest: semanticIdentityDiffDigest,
    },
  );

  const freezeCandidate = assembleCanonicalContractBundleFreezeCandidate({
    ...clone(exactCompilerInput),
    frozen_contract_pair_digest: preReviewFrozenPairPlaceholderDigest,
  });
  if (
    freezeCandidate.contract_bundle_id !== successorId
    || freezeCandidate.contract_bundle_digest !== successorDigest
    || canonicalJson(freezeCandidate.canonical_contract_bundle_projection)
      !== canonicalJson(successorProjection)
    || freezeCandidate.determinism_report.first_compilation_payload_digest
      !== preReviewDeterminismReport.first_compilation_payload_digest
  ) {
    fail(
      'PRE_REVIEW_FREEZE_CANDIDATE_COMPILATION_DRIFT',
      'The derived freeze candidate does not match the exact pre-review compilation.',
    );
  }

  const exactReviewPackage = {
    schema_version: EXACT_REVIEW_PACKAGE_SCHEMA_VERSION,
    specification_root: specification.specification_root,
    root_manifest_digest: specification.root_manifest_digest,
    code_commit: frozenInput.code_commit,
    environment: frozenInput.environment,
    pre_review_attestation_placeholder: preReviewAttestationPlaceholder,
    pre_review_frozen_pair_placeholder_digest:
      preReviewFrozenPairPlaceholderDigest,
    predecessor_contract_bundle_id: predecessorId,
    predecessor_contract_bundle_digest: predecessorDigest,
    predecessor_contract_bundle_projection: predecessorProjection,
    contract_bundle_id: successorId,
    contract_bundle_digest: successorDigest,
    canonical_contract_bundle_members:
      clone(freezeCandidate.canonical_contract_bundle_members),
    canonical_contract_bundle_projection: successorProjection,
    semantic_identity_diff: semanticIdentityDiff,
    semantic_identity_diff_digest: semanticIdentityDiffDigest,
    pre_review_input_context_placeholder_digest:
      preReviewInputContextPlaceholderDigest,
    governing_specification_member_records:
      specification.governing_specification_member_records,
    contract_bundle_freeze_candidate: freezeCandidate,
  };
  const reviewPackageFingerprint = contentId(
    'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V1',
    exactReviewPackage,
  );
  const resultPayload = {
    exact_review_package: exactReviewPackage,
    exact_review_package_fingerprint: reviewPackageFingerprint,
    remaining_formal_freeze_input_inventory:
      clone(REMAINING_FORMAL_FREEZE_INPUTS),
    disposition: {
      state: 'PRE_REVIEW_INPUTS_ASSEMBLED_NOT_REVIEWED',
      architecture_review_conclusion: 'NOT_SUPPLIED',
      legal_semantic_review_conclusion: 'NOT_SUPPLIED',
      ben_approval: 'NOT_SUPPLIED',
      compilation_receipt_signature: 'NOT_SUPPLIED',
      programme_status: 'NOT_SUPPLIED',
      freeze_authority: 'NONE',
      signing_authority: 'NONE',
      status_publication_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      database_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  };
  return deepFreeze({
    schema_version: PRE_REVIEW_PACKAGE_SCHEMA_VERSION,
    ...resultPayload,
    pre_review_package_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_PACKAGE_PAYLOAD/V1',
      resultPayload,
    ),
  });
}

module.exports = {
  PRE_REVIEW_PACKAGE_SCHEMA_VERSION,
  EXACT_REVIEW_PACKAGE_SCHEMA_VERSION,
  PRE_REVIEW_ATTESTATION_PLACEHOLDER_SCHEMA_VERSION,
  PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID_DOMAIN,
  PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER_DOMAIN,
  PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER_DOMAIN,
  SPECIFICATION_MANIFEST_PATH,
  SPECIFICATION_ROOT_DOMAIN,
  SPECIFICATION_ROOT_INPUT_ENCODING,
  SPECIFICATION_ROOT_MEMBERSHIP,
  REMAINING_FORMAL_FREEZE_INPUTS,
  CanonicalContractBundlePreReviewPackageAssemblerError,
  compileGoverningSpecificationMembers,
  deriveSemanticIdentityDiff,
  assembleCanonicalContractBundlePreReviewPackage,
};
