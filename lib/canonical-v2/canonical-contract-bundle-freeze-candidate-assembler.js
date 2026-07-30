const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('./canonical-contract-bundle-compiler');
const {
  compileCanonicalContractBundleGeneratedTopology,
} = require('./canonical-contract-bundle-generated-topology');
const { validateSchema } = require('../programme-gates/schema-registry');

const FREEZE_CANDIDATE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_FREEZE_CANDIDATE/V1';
const DETERMINISM_REPORT_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_DETERMINISM_REPORT/V1';
const COMPILER_VERSION = 'canonical-contract-bundle-compiler/1';
const GENERATOR_VERSION = 'canonical-contract-bundle-freeze-candidate-assembler/1';
const SHA256_RE = /^[a-f0-9]{64}$/;

const REQUIRED_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'classification_registry',
  'dependency_registry',
  'governed_registry_bindings',
  'frozen_contract_pair_digest',
]);

const OPTIONAL_INPUT_KEYS = Object.freeze([
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

const FORMAL_FREEZE_EVIDENCE_INPUTS = Object.freeze([
  Object.freeze({
    member_type: 'ContractFreezeAttestationIdentity',
    schema_id: 'ContractFreezeAttestationIdentity/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAuthorityManifest',
    schema_id: 'ContractFreezeAuthorityManifest/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'CanonicalContractBundleMember',
    schema_id: 'CanonicalContractBundleMember/V1',
    preparation_state: 'PREPARED_BY_ASSEMBLER',
  }),
  Object.freeze({
    member_type: 'ContractFreezeGoverningSpecificationMember',
    schema_id: 'ContractFreezeGoverningSpecificationMember/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAuthorityEvidence',
    schema_id: 'ContractFreezeAuthorityEvidence/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ExactDigestReviewSetAttestation',
    schema_id: 'ExactDigestReviewSetAttestation/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApprovalEvidence',
    schema_id: 'BenSpecificationApprovalEvidence/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateEvidenceEnvelope',
    schema_id: 'ProgrammeGateEvidenceEnvelope/V2',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'TrustedReviewControllerRecord',
    schema_id: 'TrustedReviewControllerRecord/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ReviewerIndependenceAttestation',
    schema_id: 'ReviewerIndependenceAttestation/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApproval',
    schema_id: 'BenSpecificationApproval/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ContractBundleCompilationReceipt',
    schema_id: 'ContractBundleCompilationReceipt/V1',
    preparation_state: 'UNSIGNED_PAYLOAD_PREPARED_BY_ASSEMBLER',
  }),
  Object.freeze({
    member_type: 'ContractDiffReviewAttestation',
    schema_id: 'ContractDiffReviewAttestation/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeApproval',
    schema_id: 'ContractFreezeApproval/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateStatusArtefact',
    schema_id: 'ProgrammeGateStatusArtefact/V2',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAttestation',
    schema_id: 'ContractFreezeAttestation/V1',
    preparation_state: 'EXTERNAL_INPUT_REQUIRED',
  }),
]);

class CanonicalContractBundleFreezeCandidateAssemblerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleFreezeCandidateAssemblerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleFreezeCandidateAssemblerError(
    code,
    message,
    details,
  );
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
    fail('INVALID_FREEZE_CANDIDATE_ASSEMBLER_INPUT', `${label} must be a plain object.`);
  }
}

function validateAssemblerInput(input) {
  requirePlainObject(input, 'freeze candidate assembler input');
  const actualKeys = Object.keys(input).sort(compareStrings);
  const allowedKeys = [...REQUIRED_INPUT_KEYS, ...OPTIONAL_INPUT_KEYS].sort(compareStrings);
  const missingKeys = REQUIRED_INPUT_KEYS.filter((key) => !actualKeys.includes(key));
  const extraKeys = actualKeys.filter((key) => !allowedKeys.includes(key));
  if (missingKeys.length > 0 || extraKeys.length > 0) {
    fail(
      'INVALID_FREEZE_CANDIDATE_ASSEMBLER_INPUT',
      'Freeze candidate assembler fields do not match the closed input contract.',
      { missing_keys: missingKeys, extra_keys: extraKeys },
    );
  }
  if (!SHA256_RE.test(input.frozen_contract_pair_digest)) {
    fail(
      'INVALID_FREEZE_CANDIDATE_FROZEN_PAIR_DIGEST',
      'The frozen contract pair binding must be a lowercase SHA-256 digest.',
    );
  }
}

function assertDeterministicCompilations(firstCompilation, secondCompilation) {
  const firstBytes = Buffer.from(canonicalJson(firstCompilation), 'utf8');
  const secondBytes = Buffer.from(canonicalJson(secondCompilation), 'utf8');
  const firstDigest = sha256Hex(firstBytes);
  const secondDigest = sha256Hex(secondBytes);
  if (!firstBytes.equals(secondBytes)) {
    fail(
      'NONDETERMINISTIC_CANONICAL_CONTRACT_BUNDLE_COMPILATION',
      'Two compilations of the same frozen inputs did not produce identical bytes.',
      {
        first_compilation_payload_digest: firstDigest,
        second_compilation_payload_digest: secondDigest,
      },
    );
  }
  return deepFreeze({
    schema_version: DETERMINISM_REPORT_SCHEMA_VERSION,
    compile_run_count: 2,
    first_compilation_payload_digest: firstDigest,
    second_compilation_payload_digest: secondDigest,
    canonical_byte_length: firstBytes.length,
    mismatch_count: 0,
    status: 'PASS',
  });
}

function validateSuccessfulCompilation(compilation) {
  if (
    !compilation
    || compilation.compile_report.status !== 'PASS'
    || compilation.compile_report.missing_member_count !== 0
    || compilation.compile_report.extra_member_count !== 0
    || compilation.compile_report.duplicate_identity_count !== 0
    || compilation.compile_report.conflict_count !== 0
  ) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT_NOT_CLEAN',
      'The canonical contract bundle compile report is not clean.',
    );
  }
  if (
    compilation.dependency_cycle_report.status !== 'PASS'
    || compilation.dependency_cycle_report.unresolved_dependency_count !== 0
    || compilation.dependency_cycle_report.self_dependency_count !== 0
    || compilation.dependency_cycle_report.cycle_count !== 0
  ) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REPORT_NOT_CLEAN',
      'The canonical contract bundle dependency report is not clean.',
    );
  }
  if (
    compilation.canonical_contract_bundle_members.length !== REQUIRED_BUNDLE_KINDS.length
    || compilation.disposition.status !== 'COMPILED_NOT_FROZEN'
    || compilation.disposition.freeze_authority !== 'NONE'
    || compilation.disposition.signing_authority !== 'NONE'
    || compilation.disposition.writer_authority !== 'NONE'
    || compilation.disposition.serving_authority !== 'NONE'
    || compilation.disposition.database_authority !== 'NONE'
    || compilation.disposition.release_authority !== 'NONE'
    || compilation.disposition.activation_authority !== 'NONE'
    || compilation.disposition.production_authority !== 'NONE'
  ) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_COMPILATION_AUTHORITY_OR_CARDINALITY_MISMATCH',
      'The canonical bundle compilation is not the required non-authorising eight-member result.',
    );
  }
  for (const member of compilation.canonical_contract_bundle_members) {
    try {
      validateSchema('CanonicalContractBundleMember/V1', member);
    } catch (error) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_MEMBER',
        'A compiled bundle member does not satisfy the existing immutable-member schema.',
        { validation_error: error.message },
      );
    }
    const sourceBytes = Buffer.from(member.source_bytes_base64, 'base64');
    if (
      sourceBytes.length !== member.byte_length
      || sha256Hex(sourceBytes) !== member.payload_digest
    ) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE_DRIFT',
        'A compiled bundle member does not match its retained source bytes.',
        { member_key: member.member_key },
      );
    }
  }
}

function outputEntry(path, value) {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  return {
    path,
    payload_digest: sha256Hex(bytes),
  };
}

function generatedOutputInventory(compilation, determinismReport, generatedTopology) {
  const entries = compilation.canonical_contract_bundle_members.map((member) => (
    outputEntry(
      `generated/canonical-contract-bundle/members/${member.member_key.toLowerCase()}.json`,
      member,
    )
  ));
  entries.push(
    outputEntry(
      'generated/canonical-contract-bundle/canonical-contract-bundle-projection.json',
      compilation.canonical_contract_bundle_projection,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/compilation.json',
      compilation,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/compile-report.json',
      compilation.compile_report,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/dependency-cycle-report.json',
      compilation.dependency_cycle_report,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/determinism-report.json',
      determinismReport,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/generated-topology.json',
      generatedTopology,
    ),
  );
  entries.sort((left, right) => compareStrings(left.path, right.path));
  const paths = entries.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) {
    fail(
      'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT',
      'The generated output inventory contains a duplicate path.',
    );
  }
  return entries;
}

function compileInputs(input) {
  return {
    canonical_contract_input_compilation: clone(
      input.canonical_contract_input_compilation,
    ),
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

function assembleCanonicalContractBundleFreezeCandidate(input = {}) {
  validateAssemblerInput(input);
  const frozenCompilerInputs = compileInputs(input);
  const firstCompilation = compileCanonicalContractBundle(
    clone(frozenCompilerInputs),
  );
  const secondCompilation = compileCanonicalContractBundle(
    clone(frozenCompilerInputs),
  );
  const determinismReport = assertDeterministicCompilations(
    firstCompilation,
    secondCompilation,
  );
  validateSuccessfulCompilation(firstCompilation);
  const generatedTopology = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation:
      frozenCompilerInputs.canonical_contract_input_compilation,
    canonical_contract_bundle_compilation: firstCompilation,
  });

  const generatedOutputs = generatedOutputInventory(
    firstCompilation,
    determinismReport,
    generatedTopology,
  );
  const determinismReportDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_DETERMINISM_REPORT_DIGEST/V1',
    determinismReport,
  );
  const unsignedReceiptPayload = {
    schema_version: 'ContractBundleCompilationReceipt/V1',
    contract_bundle_id:
      generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_id,
    contract_bundle_digest:
      generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_fingerprint,
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    compiler_version: COMPILER_VERSION,
    generator_version: GENERATOR_VERSION,
    compile_report_digest: firstCompilation.compile_report_digest,
    cycle_report_digest: firstCompilation.cycle_report_digest,
    drift_report_digest: determinismReportDigest,
    generated_outputs: generatedOutputs,
    canonical_contract_bundle_member_root:
      firstCompilation.canonical_contract_bundle_member_root,
    canonical_contract_bundle_member_count:
      firstCompilation.canonical_contract_bundle_members.length,
    canonical_contract_bundle_required_kind_set_root:
      firstCompilation.canonical_contract_bundle_required_kind_set_root,
    compile_errors: [],
    cycle_errors: [],
    drift_errors: [],
    terminal_state: 'PASS',
  };
  const candidatePayload = {
    compiler_version: COMPILER_VERSION,
    generator_version: GENERATOR_VERSION,
    canonical_contract_bundle_members:
      clone(firstCompilation.canonical_contract_bundle_members),
    canonical_contract_bundle_projection:
      clone(firstCompilation.canonical_contract_bundle_projection),
    generated_contract_topology: clone(generatedTopology),
    contract_bundle_id:
      generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_id,
    contract_bundle_digest:
      generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_fingerprint,
    canonical_contract_bundle_member_root:
      firstCompilation.canonical_contract_bundle_member_root,
    canonical_contract_bundle_required_kind_set_root:
      firstCompilation.canonical_contract_bundle_required_kind_set_root,
    compile_report: clone(firstCompilation.compile_report),
    compile_report_digest: firstCompilation.compile_report_digest,
    dependency_cycle_report: clone(firstCompilation.dependency_cycle_report),
    cycle_report_digest: firstCompilation.cycle_report_digest,
    determinism_report: clone(determinismReport),
    determinism_report_digest: determinismReportDigest,
    generated_output_inventory: clone(generatedOutputs),
    unsigned_contract_bundle_compilation_receipt_payload:
      unsignedReceiptPayload,
    formal_freeze_evidence_input_inventory:
      clone(FORMAL_FREEZE_EVIDENCE_INPUTS),
    disposition: {
      state: 'ASSEMBLED_NOT_FROZEN',
      complete_contract_universe_required: true,
      independent_reviews_required: true,
      ben_approval_required: true,
      receipt_signature_required: true,
      frozen_contract_pair_binding_validation:
        'DEFERRED_TO_CONTRACT_FREEZE_ATTESTATION_IDENTITY',
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
    schema_version: FREEZE_CANDIDATE_SCHEMA_VERSION,
    ...candidatePayload,
    freeze_candidate_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_FREEZE_CANDIDATE_PAYLOAD/V1',
      candidatePayload,
    ),
  });
}

module.exports = {
  FREEZE_CANDIDATE_SCHEMA_VERSION,
  DETERMINISM_REPORT_SCHEMA_VERSION,
  COMPILER_VERSION,
  GENERATOR_VERSION,
  FORMAL_FREEZE_EVIDENCE_INPUTS,
  CanonicalContractBundleFreezeCandidateAssemblerError,
  assertDeterministicCompilations,
  assembleCanonicalContractBundleFreezeCandidate,
};
