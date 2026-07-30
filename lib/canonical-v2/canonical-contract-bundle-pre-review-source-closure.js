const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { domainDigest } = require('../programme-gates/bytes');
const { validateSchema } = require('../programme-gates/schema-registry');
const {
  AGGREGATE_SOURCE_SCHEMA_VERSION,
  FIXED_MEMBER_DEFINITIONS,
} = require('./canonical-contract-bundle-compiler');
const {
  REMAINING_FORMAL_FREEZE_INPUTS,
  assembleCanonicalContractBundlePreReviewPackage,
} = require('./canonical-contract-bundle-pre-review-package-assembler');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  compileFixtureContract,
  validateContractBundle,
} = require('./contract-bundle');

const PRE_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_SOURCE_CLOSURE/V1';
const EXACT_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2';
const LEGACY_F1_CONTRACT_FINGERPRINT =
  '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const LEGACY_F1_MEMBER_KEY = 'LEGACY_F1_CANONICAL_CONTRACT_BUNDLE';

const REQUIRED_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'classification_registry',
  'dependency_registry',
  'governed_registry_bindings',
  'predecessor_canonical_contract_bundle_members',
  'governing_specification_members',
  'code_commit',
  'environment',
  'approval_epoch_nonce',
]);

const OPTIONAL_INPUT_KEYS = Object.freeze([
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

class CanonicalContractBundlePreReviewSourceClosureError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundlePreReviewSourceClosureError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundlePreReviewSourceClosureError(
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
    fail('INVALID_PRE_REVIEW_SOURCE_CLOSURE_INPUT', `${label} must be a plain object.`);
  }
}

function validateTopLevelInput(input) {
  requirePlainObject(input, 'pre-review source closure input');
  const actual = Object.keys(input).sort(compareStrings);
  const allowed = [...REQUIRED_INPUT_KEYS, ...OPTIONAL_INPUT_KEYS].sort(compareStrings);
  const missing = REQUIRED_INPUT_KEYS.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !allowed.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      'INVALID_PRE_REVIEW_SOURCE_CLOSURE_INPUT',
      'Pre-review source closure fields do not match the closed input contract.',
      { missing_keys: missing, extra_keys: extra },
    );
  }
}

function rawLegacyF1Member() {
  const bundle = compileFixtureContract();
  if (
    FIXTURE_CONTRACT_FINGERPRINT_V1 !== LEGACY_F1_CONTRACT_FINGERPRINT
    || bundle.fingerprint !== LEGACY_F1_CONTRACT_FINGERPRINT
  ) {
    fail(
      'LEGACY_F1_CONTRACT_FINGERPRINT_DRIFT',
      'The default fixture compiler no longer produces the exact frozen F1 contract.',
    );
  }
  const sourceBytes = Buffer.from(canonicalJson(bundle), 'utf8');
  const payloadDigest = sha256Hex(sourceBytes);
  return {
    schema_version: 'CanonicalContractBundleMember/V1',
    member_key: LEGACY_F1_MEMBER_KEY,
    member_kind: 'CORE_CANONICAL_CONTRACT',
    logical_type: 'LegacyF1CanonicalContractBundle',
    member_schema_version: bundle.schema_version,
    byte_length: sourceBytes.length,
    payload_digest: payloadDigest,
    source_bytes_base64: sourceBytes.toString('base64'),
    semantic_digest: LEGACY_F1_CONTRACT_FINGERPRINT,
    identity_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_LEGACY_F1_PREDECESSOR_IDENTITY/V1',
      {
        member_key: LEGACY_F1_MEMBER_KEY,
        contract_fingerprint: LEGACY_F1_CONTRACT_FINGERPRINT,
        payload_digest: payloadDigest,
      },
    ),
  };
}

function compileLegacyF1CanonicalContractBundleMember() {
  const member = rawLegacyF1Member();
  try {
    validateSchema('CanonicalContractBundleMember/V1', member);
  } catch (error) {
    fail(
      'INVALID_LEGACY_F1_CANONICAL_CONTRACT_BUNDLE_MEMBER',
      'The exact F1 bridge does not satisfy the immutable bundle-member schema.',
      { validation_error: error.message },
    );
  }
  const source = JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
  validateContractBundle(source);
  return deepFreeze(member);
}

function validateAggregateMemberSemantics(member, source) {
  const definition = FIXED_MEMBER_DEFINITIONS[member.member_kind];
  if (
    !definition
    || member.member_key !== definition.member_key
    || member.logical_type !== definition.logical_type
    || member.member_schema_version !== AGGREGATE_SOURCE_SCHEMA_VERSION
    || source.schema_version !== AGGREGATE_SOURCE_SCHEMA_VERSION
    || source.member_kind !== member.member_kind
    || !Array.isArray(source.ordered_authored_members)
    || source.ordered_authored_members.length === 0
  ) {
    fail(
      'INVALID_PREDECESSOR_AGGREGATE_MEMBER_SEMANTICS',
      'A predecessor aggregate member does not match the canonical compiler contract.',
      { member_key: member.member_key },
    );
  }
  const identityPayload = {
    member_kind: member.member_kind,
    ordered_authored_members: source.ordered_authored_members.map((entry) => {
      requirePlainObject(entry, 'predecessor aggregate authored member');
      if (
        !entry.authored_identity
        || !Array.isArray(entry.ordered_dependency_identities)
      ) {
        fail(
          'INVALID_PREDECESSOR_AGGREGATE_MEMBER_SEMANTICS',
          'A predecessor aggregate source lacks its exact identity or dependency list.',
        );
      }
      return {
        authored_identity: entry.authored_identity,
        ordered_dependency_identities: entry.ordered_dependency_identities,
      };
    }),
  };
  if (
    member.semantic_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SEMANTIC/V1',
      source,
    )
    || member.identity_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_IDENTITY/V1',
      identityPayload,
    )
  ) {
    fail(
      'PREDECESSOR_AGGREGATE_SEMANTIC_IDENTITY_DRIFT',
      'A predecessor aggregate semantic or identity digest does not match its source bytes.',
      { member_key: member.member_key },
    );
  }
}

function validatePredecessorMember(member) {
  try {
    validateSchema('CanonicalContractBundleMember/V1', member);
  } catch (error) {
    fail(
      'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER',
      'A predecessor member does not satisfy the immutable bundle-member schema.',
      { validation_error: error.message },
    );
  }
  const bytes = Buffer.from(member.source_bytes_base64, 'base64');
  if (
    bytes.toString('base64') !== member.source_bytes_base64
    || bytes.length !== member.byte_length
    || sha256Hex(bytes) !== member.payload_digest
  ) {
    fail(
      'PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE_DRIFT',
      'A predecessor member does not match its exact retained source bytes.',
      { member_key: member.member_key },
    );
  }
  let source;
  try {
    source = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(
      'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE',
      'A predecessor member must retain canonical JSON source bytes.',
    );
  }
  if (!bytes.equals(Buffer.from(canonicalJson(source), 'utf8'))) {
    fail(
      'NON_CANONICAL_PREDECESSOR_CONTRACT_BUNDLE_MEMBER_BYTES',
      'A predecessor member must retain the exact canonical JSON byte form.',
      { member_key: member.member_key },
    );
  }
  if (source.schema_version === AGGREGATE_SOURCE_SCHEMA_VERSION) {
    validateAggregateMemberSemantics(member, source);
    return 'CANONICAL_AGGREGATE';
  }
  const exactF1 = rawLegacyF1Member();
  if (canonicalJson(member) !== canonicalJson(exactF1)) {
    fail(
      'UNRECOGNISED_LEGACY_PREDECESSOR_CONTRACT',
      'Only the exact frozen F1 fixture bundle may use the legacy predecessor bridge.',
    );
  }
  validateContractBundle(source);
  return 'LEGACY_F1';
}

function validateCanonicalPredecessorBundleMembers(values) {
  if (!Array.isArray(values) || values.length === 0) {
    fail(
      'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SET',
      'Complete predecessor bundle members are required.',
    );
  }
  const members = clone(values);
  const sourceKinds = members.map(validatePredecessorMember);
  const keys = members.map((member) => member.member_key);
  if (
    new Set(keys).size !== keys.length
    || keys.some((key, index) => (
      index > 0 && compareStrings(keys[index - 1], key) >= 0
    ))
  ) {
    fail(
      'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_ORDER',
      'Predecessor members must have unique keys in exact ascending order.',
    );
  }
  if (
    sourceKinds.includes('LEGACY_F1')
    && (members.length !== 1 || sourceKinds[0] !== 'LEGACY_F1')
  ) {
    fail(
      'INVALID_LEGACY_F1_PREDECESSOR_MEMBER_SET',
      'The exact F1 bridge is a complete one-member predecessor bundle.',
    );
  }
  return {
    members,
    projection: members.map((member) => ({
      member_key: member.member_key,
      semantic_digest: member.semantic_digest,
      identity_digest: member.identity_digest,
    })),
    source_kinds: sourceKinds,
  };
}

function assembleCanonicalContractBundlePreReviewSourceClosure(input = {}) {
  validateTopLevelInput(input);
  const frozenInput = clone(input);
  validateTopLevelInput(frozenInput);
  const predecessor = validateCanonicalPredecessorBundleMembers(
    frozenInput.predecessor_canonical_contract_bundle_members,
  );
  const v1Input = clone(frozenInput);
  delete v1Input.predecessor_canonical_contract_bundle_members;
  v1Input.predecessor_contract_bundle_projection = predecessor.projection;
  const v1Package = assembleCanonicalContractBundlePreReviewPackage(v1Input);
  const v1Review = v1Package.exact_review_package;
  if (
    canonicalJson(v1Review.predecessor_contract_bundle_projection)
      !== canonicalJson(predecessor.projection)
    || v1Review.predecessor_contract_bundle_digest !== domainDigest(
      'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
      predecessor.projection,
    )
  ) {
    fail(
      'PREDECESSOR_SOURCE_CLOSURE_PROJECTION_DRIFT',
      'The pre-review package did not retain the exact predecessor projection.',
    );
  }
  const reviewedContractSourceSetDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
    {
      exact_review_input_schema_version:
        EXACT_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION,
      predecessor_canonical_contract_bundle_members: predecessor.members,
      canonical_contract_bundle_members:
        v1Review.canonical_contract_bundle_members,
    },
  );
  const exactReviewInputContextDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: v1Review.specification_root,
      code_commit: v1Review.code_commit,
      predecessor_contract_bundle_id:
        v1Review.predecessor_contract_bundle_id,
      predecessor_contract_bundle_digest:
        v1Review.predecessor_contract_bundle_digest,
      contract_bundle_id: v1Review.contract_bundle_id,
      contract_bundle_digest: v1Review.contract_bundle_digest,
      frozen_contract_pair_digest: v1Review.frozen_contract_pair_digest,
      semantic_identity_diff_digest:
        v1Review.semantic_identity_diff_digest,
      reviewed_contract_source_set_digest: reviewedContractSourceSetDigest,
    },
  );
  const exactReviewPackage = {
    ...clone(v1Review),
    schema_version: EXACT_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION,
    predecessor_canonical_contract_bundle_members: predecessor.members,
    predecessor_source_kinds: predecessor.source_kinds,
    reviewed_contract_source_set_digest: reviewedContractSourceSetDigest,
    exact_review_input_context_digest: exactReviewInputContextDigest,
  };
  const exactReviewPackageFingerprint = contentId(
    'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2',
    exactReviewPackage,
  );
  const resultPayload = {
    exact_review_package: exactReviewPackage,
    exact_review_package_fingerprint: exactReviewPackageFingerprint,
    remaining_formal_freeze_input_inventory:
      clone(REMAINING_FORMAL_FREEZE_INPUTS),
    disposition: {
      ...clone(v1Package.disposition),
      state: 'PRE_REVIEW_SOURCE_CLOSED_NOT_REVIEWED',
      predecessor_source_closure: 'MECHANICALLY_VALIDATED',
    },
  };
  return deepFreeze({
    schema_version: PRE_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION,
    ...resultPayload,
    pre_review_source_closure_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_SOURCE_CLOSURE_PAYLOAD/V1',
      resultPayload,
    ),
  });
}

module.exports = {
  PRE_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION,
  EXACT_REVIEW_SOURCE_CLOSURE_SCHEMA_VERSION,
  LEGACY_F1_CONTRACT_FINGERPRINT,
  LEGACY_F1_MEMBER_KEY,
  CanonicalContractBundlePreReviewSourceClosureError,
  compileLegacyF1CanonicalContractBundleMember,
  validateCanonicalPredecessorBundleMembers,
  assembleCanonicalContractBundlePreReviewSourceClosure,
};
