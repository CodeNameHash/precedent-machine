// M7 V2 repair per-work execution manifest validator.
//
// Among its many per-work checks, `validateFullCandidateRecord` and
// `validateWork3V2ReceiptLineage` recount a candidate registration's and its
// bound WORK3 predecessor's counts from the bound bytes rather than pinning
// them to literal constants: `recountedCounts` is built from the lengths of
// the registration's own bound-binding lists (never from a fixed number),
// and a mismatch against the registration's declared `counts` fails with
// the distinct check id `COUNT_RECOUNT`. The candidate's `tests` roster is
// validated against the authority's `tests/` file-prefix rule plus the
// required work-depth baseline, not a fixed eight-path list, so a candidate
// binding a different test roster, package count or path count validates
// on its own recount.
//
// It also recognises the candidate replacement authority. When that authority
// is in the tree, the three real-text successor manifests it names are valid
// manifest paths, each carrying `candidate_replacement_authority_binding` as a
// second, dedicated member beside the still-mandatory parent binding
// (`validateCandidateReplacement`); no other manifest may carry that member.
// Its `immutable_prefix_extensions` narrow the write policy for EVERY
// manifest, and its seven Work 1 write exceptions are re-granted to its own
// successor manifests only. A candidate registration whose id the authority
// lists as superseded is HISTORICAL: its own bytes must still be in the
// working tree unchanged, but the files it binds are verified against the Git
// objects it named (`gitObjectBytes`), so an edit the authority permits to a
// bound file does not break the historical chain. Every other registration is
// verified against the working tree exactly as before.
//
// Beside that authority it recognises a correction record
// (`lib/canonical-v2/m7-v2-authority-correction.js`). The record is loaded and
// bound whenever it is in the tree — before anything is decided by it, and
// whether or not the replacement authority is there to be corrected — but its
// corrections are applied only once Ben has approved it: a PENDING_BEN record
// is reported as one `CORRECTION_PENDING_BEN <correction_id>` INFO line on the
// warning stream and changes nothing, and a record whose binding does not
// match the authority's bytes fails AUTHORITY_BINDING_DRIFT. The one
// correction this validator applies when it is in force is
// EXACT_ARGV_REGISTRATION_FLAG, which lets a replacement phase's run
// entrypoint name a candidate registration in its exact argv. The Work 3
// closure-successor manifest returns from its own validator above all of
// this and sees neither the authority nor the correction.
import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authorityCorrectionModule from '../lib/canonical-v2/m7-v2-authority-correction.js';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import m7V2ContractModule from '../lib/canonical-v2/m7-v2-contract.js';
import {
  validateWork2ReceiptBinding,
  validateWork2SuccessorReceiptBinding,
} from './stage-2y-structure-m7-v2-repair-work2-validate.mjs';
import {
  gitReadBytes,
  gitReadText,
  validateWork3,
} from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const { validateFamilyProfilePackageSetForWork3 } = m7V2ContractModule;
const {
  acceptsCandidateRegistrationArgvToken,
  correctionInfoLines,
  loadAuthorityCorrection,
} = authorityCorrectionModule;

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST_VALIDATION/V1';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const WORK1_CORRECTION_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work1-correction-authority.json';
const WORK2_ENTRY_CORRECTION_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-entry-correction-authority.json';
const WORK2_ENTRY_CORRECTION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK2_ENTRY_CORRECTION_AUTHORITY/V1';
const WORK2_ENTRY_CORRECTION_AUTHORITY_ID =
  'e691468b5adbcba41878b0f40155fc46a7acf07b0f24a1e5240c450e94b4b2b8';
const WORK2_ENTRY_CORRECTION_AUTHORITY_BYTE_LENGTH = 9198;
const WORK2_ENTRY_CORRECTION_AUTHORITY_SHA256 =
  '39d8d55e6c3aaec554f190b956b44a24d2dc4ffcbcd7e77515b16d54182667f6';
const WORK2_ENTRY_CORRECTION_AUTHORITY_GIT_BLOB_OID =
  '1b9794002d5db55e989c23556e115be005a52705';
const WORK2_ENTRY_CORRECTION_APPROVAL =
  'Hokay, proceed and keep proceeding. You should merge as you see fir';
const CANDIDATE_ORDERING_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-4-candidate-ordering-correction-authority.json';
const CANDIDATE_ORDERING_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK2_4_CANDIDATE_ORDERING_CORRECTION_AUTHORITY/V1';
const CANDIDATE_ORDERING_AUTHORITY_ID =
  'e719db5a25968cc255d35e9e797e44885f72f9e24a4926957360e06987c01943';
const CANDIDATE_ORDERING_AUTHORITY_BYTE_LENGTH = 17487;
const CANDIDATE_ORDERING_AUTHORITY_SHA256 =
  '174b4b9dae612e46a2f80d12f82e5e4d54bbd4925d1459d5fed1a34dd97f6173';
const CANDIDATE_ORDERING_AUTHORITY_GIT_BLOB_OID =
  '84778f8efdb302032eadda5c59cbae7b4fb01591';
const CANDIDATE_ORDERING_APPROVAL =
  'Hokay, proceed and keep proceeding. You should merge as you see fir';
const WORK4_CANDIDATE_TRANSITION_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work4-bind-candidate.mjs';
const WORK4_CANDIDATE_TRANSITION_ARGV = Object.freeze([
  'node', WORK4_CANDIDATE_TRANSITION_PATH, '--authority',
  CANDIDATE_ORDERING_AUTHORITY_PATH,
]);
// Work4 candidate correction (Ben, 2026-09-03). The four committed Work4
// outputs stay byte-identical; a successor manifest, transition authority,
// registration and receipt supersede them under this pinned authority.
const WORK4_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work4-candidate-correction-authority.json';
const WORK4_CORRECTION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK4_CANDIDATE_CORRECTION_AUTHORITY/V1';
const WORK4_CORRECTION_AUTHORITY_BINDING = Object.freeze({
  path: WORK4_CORRECTION_AUTHORITY_PATH,
  schema_version: WORK4_CORRECTION_AUTHORITY_SCHEMA,
  record_id_field: 'correction_authority_id',
  record_id: '0623ebaf6529aa9f5fccc16ced7ac40bbc3302091c07676b8eb32900e3fb25f3',
  byte_length: 12624,
  sha256: '750d762f0f390ed32be05ea805b524760ca51693a38e13da65373997f61457a5',
  git_blob_oid: 'ef787dc75cefb598b7436c83b5299c8f6316d019',
});
const WORK4_CORRECTION_APPROVAL = 'do what you recommend';
const WORK4_CORRECTION_MANIFEST_MEMBER = 'work4_candidate_correction_authority_binding';
const WORK4_SUCCESSOR_MANIFEST_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json';
const WORK4_SUCCESSOR_TRANSITION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority-candidate-correction-successor.json';
const WORK4_SUCCESSOR_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json';
const WORK4_SUPERSEDED_REGISTRATION_ID =
  '0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e';
const WORK4_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json';
const WORK4_RECEIPT_V1_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1';
const WORK4_RECEIPT_V2_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V2';
const WORK4_RECEIPT_V2_ADDITIONAL_KEYS = Object.freeze([
  WORK4_CORRECTION_MANIFEST_MEMBER, 'superseded_work4_receipt_binding',
]);
const WORK4_CORRECTION_TRANSITION_ARGV = Object.freeze([
  'node', WORK4_CANDIDATE_TRANSITION_PATH, '--authority',
  WORK4_CORRECTION_AUTHORITY_PATH,
]);
const WORK4_CORRECTION_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text',
  'recommendation_summary', 'parent_authority_binding', 'activation_receipt_binding',
  'candidate_ordering_correction_authority_binding', 'discovered_at_tip_binding',
  'discovered_defects', 'parent_policy_basis', 'superseded_ordering_policy_fields',
  'superseded_work4_outputs', 'superseded_candidate_registration_id',
  'superseded_outputs_disposition', 'successor_paths', 'successor_manifest_member',
  'successor_manifest_schema', 'successor_receipt_schema',
  'successor_receipt_additional_members', 'successor_bootstrap_argv',
  'successor_transition_argv', 'successor_exact_argv_with_run_limits',
  'successor_permitted_write_paths_after_transition', 'successor_commit_message',
  'corrected_bound_paths', 'authorised_scope', 'allowed_effects', 'prohibited_effects',
  'success_conditions',
]);
const WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority.json';
const WORK4_CANDIDATE_TRANSITION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK4_CANDIDATE_TRANSITION_AUTHORITY/V1';
// Candidate replacement (Ben, 2026-09-03). The Work 2-4 fixture candidate is
// stopped under FALSE_COMPLETE_FIXTURE; three real-text successor manifests
// carry a second, dedicated binding member alongside the still-mandatory
// parent binding, exactly as the Work 4 correction authority does. The
// authority also names the registrations that are now historical, the
// prefixes it adds to the parent's immutable set, and the Work 1 paths it
// re-grants for writing.
const CANDIDATE_REPLACEMENT_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-candidate-replacement-authority.json';
const CANDIDATE_REPLACEMENT_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CANDIDATE_REPLACEMENT_AUTHORITY/V1';
const CANDIDATE_REPLACEMENT_AUTHORITY_BINDING = Object.freeze({
  path: CANDIDATE_REPLACEMENT_AUTHORITY_PATH,
  schema_version: CANDIDATE_REPLACEMENT_AUTHORITY_SCHEMA,
  record_id_field: 'replacement_authority_id',
  record_id: '93d67c6ea53ed9b429f7467a3c5a52d982352957f3c9a1c3ac3e6350f54eab08',
  byte_length: 23976,
  sha256: '21f864a6473e069987f1c578bd5efaa447a5443225706e9a40bdbc0198468a17',
  git_blob_oid: 'a9970b6e3db301fcfdbcb904681fd3db7297fe77',
});
const CANDIDATE_REPLACEMENT_MANIFEST_MEMBER = 'candidate_replacement_authority_binding';
const CANDIDATE_REPLACEMENT_APPROVAL = 'All recommended';
const CANDIDATE_REPLACEMENT_STAGE = 'M7_V2_REPAIR_CANDIDATE_REPLACEMENT';
const CANDIDATE_REPLACEMENT_AUTHORITY_STATE =
  'BEN_AUTHORISED_CANDIDATE_REPLACEMENT_UNDER_FALSE_COMPLETE_FIXTURE_STOP';
const CANDIDATE_REPLACEMENT_PHASE_KEYS = Object.freeze([
  'WORK2_REAL_TEXT_SUCCESSOR', 'WORK3_REAL_TEXT_SUCCESSOR', 'WORK4_REAL_TEXT_SUCCESSOR',
]);
const CANDIDATE_REPLACEMENT_STOPPED_REGISTRATION_ID =
  '9a3ccbf74f80499d80ee61e62ba3f06e95734e082b65b68243e4e5f695552106';
// The authority's own 38 top-level members, in the file's (canonical) order.
const CANDIDATE_REPLACEMENT_AUTHORITY_KEYS = Object.freeze([
  'activation_receipt_binding', 'additive_three_trust_root_binding', 'allowed_effects',
  'approval_text', 'approved_on', 'approver', 'authorised_scope', 'authority_state',
  'ben_approval_id', 'ben_sessions', 'candidate_ordering_correction_authority_binding',
  'context_disposition_records', 'contract_changes_authorised', 'core_document_policy',
  'decision_record_binding', 'finding_binding', 'immutable_prefix_extensions',
  'interim_registration_policy', 'out_of_scope', 'parent_authority_binding',
  'parent_policy_basis', 'phases', 'prohibited_effects', 'real_agreement_receipt_guard',
  'registration_schema_extensions', 'replacement_authority_id', 'replan_binding',
  'retained_outputs_disposition', 'schema_version', 'stage', 'stop_record',
  'success_conditions', 'superseded_candidate_registration_ids',
  'superseded_ordering_policy_fields', 'trust_root_drift_stop_extended_to_additive_three',
  'v2_input_extensions', 'work1_write_exceptions',
  'work4_candidate_correction_authority_binding',
]);
const CANDIDATE_REPLACEMENT_PHASE_KEYS_MEMBERS = Object.freeze([
  'commit_message', 'entrypoints', 'exact_argv_with_run_limits',
  'interim_registration_required_before_evidence', 'phase_key', 'push_limit',
  'successor_manifest_member', 'successor_manifest_path', 'successor_manifest_schema',
  'successor_receipt_path', 'successor_receipt_schema', 'tests', 'work',
]);
const M3_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m3-context-compilation.json';
const M4_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m4-agreement-analysis.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const BRANCH = 'codex/recover-m7-20260812';
const ACTIVATION_COMMIT = '6162798202bda37169917400b8fbebad8e1bdb9a';
const WORK1_COMMIT = '21d9c29c47130090dbbf345dd028e030b61b9e44';
const WORK1_COMMIT_MESSAGE = 'Define M7 V2 repair Work 1 contracts';
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const AUTHORITY_DIGEST = '25ac58d418638432586a5cb24c1cfb766ba1440b77d992afc434ed71d1055afc';
const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';
const ACTIVATION_DIGEST = 'cc0e8dbf4ae94ef34cc7b21eecf2122aba76309ba0441a8a062ca81a05224176';
const ACTIVATION_SHA256 = 'f0401bb7f75fe72b7719663573ab75581aecffeb2949618b991ec41e54f1c578';
const WORK0_ID = '885d404502276d85af385fce20cd93b601f09a30a3300c371df870337f7d5fab';
const WORK0_SHA256 = '04e010105dcb4b449b7f8e3aa05fb3bec69cdada8d385999e7c86a8150eaff83';
const WORK1_RECEIPT_ID = '1c26f41ad581ec177a81959e5998dd1394421f9d80e7bb3ea5f5721593e3efb8';
const WORK1_RECEIPT_SHA256 = 'b8d97a413d6ce1a3eadfa9126f2bff4838cc71a61d23cd9e2048e520359d40d7';
const WORK1_RECEIPT_GIT_BLOB_OID = '02815644751039835dbdd7aaf3b25b640e276fce';
const WORK1_RECEIPT_BYTE_LENGTH = 61076;
const DEFERRED_GIT_PROOF = 'EXTERNAL_MILESTONE_ATTESTATION_NOT_INDEPENDENTLY_RECOMPUTED';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const EXECUTION_MANIFEST_TEST_PATH =
  'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const REGISTER_CANDIDATE_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs';
const VERIFY_CANDIDATE_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs';
const REGISTRATION_TEST_PATH =
  'tests/stage-2y-structure-m7-v2-repair-registration.test.js';
const WORK2_RECOVERY_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-recovery-authority.json';
const WORK2_RECOVERY_RUNNER_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs';
const WORK2_FINALISER_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs';
const WORK2_VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
const WORK2_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/work2-compiler-cases.json';
const WORK3_PROFILE_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/work3-profile-cases.json';
const WORK2_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work2.test.js';
const WORK2_GENERALISATION_PATH = 'scripts/stage-2y-structure-generalisation-shadow.mjs';
const WORK2_AGREEMENT_SET_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-agreement-analysis-set.json';
const WORK2_CONTEXT_SET_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-context-compilation-set.json';
const WORK2_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json';
const WORK3_ENTRY_CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const WORK3_ENTRY_CORRECTION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1';
const WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING = Object.freeze({
  path: WORK3_ENTRY_CORRECTION_AUTHORITY_PATH,
  schema_version: WORK3_ENTRY_CORRECTION_AUTHORITY_SCHEMA,
  record_id_field: 'correction_authority_id',
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  byte_length: 237749,
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  git_blob_oid: '5ff4bcd0ca719c4da97dd9bb64d610349e3d7afd',
});
const WORK3_ENTRY_MANIFEST_MEMBER = 'work3_entry_correction_authority_binding';
const WORK3_CLOSURE_SUCCESSOR_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2';
const WORK3_CLOSURE_APPLICATION_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_APPLICATION_RECEIPT/V1';
const WORK3_CLOSURE_APPLICATION_ID_FIELD =
  'work3_closure_amendment_application_receipt_id';
const WORK3_CLOSURE_PREDECESSOR_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest.json';
const WORK3_CLOSURE_AMENDMENT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest-closure-amendment.json';
const WORK3_CLOSURE_REVIEW_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json';
const WORK3_CLOSURE_APPLICATION_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json';
const WORK3_CLOSURE_SUCCESSOR_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest-closure-successor.json';
const WORK3_V2_FINAL_COMMIT = 'a0df3f8621107481144e5be1429466d8b193f9be';
const WORK3_CLOSURE_INPUT_BINDINGS = Object.freeze({
  predecessor: Object.freeze({
    path: WORK3_CLOSURE_PREDECESSOR_PATH,
    schema_version: SCHEMA,
    record_id_field: 'execution_manifest_id',
    record_id: 'e73e3071c8a3e93d57df68de31e9f46d0157f08627aaa2b7d40b9634b3485690',
    byte_length: 36178,
    sha256: 'b9767780df291de43a212b248dfbefbce1e05e8b6056d10b6776cb551b01fb2e',
    git_blob_oid: 'aa9e6de0b236246673cbcf737659f31261dd896b',
  }),
  amendment: Object.freeze({
    path: WORK3_CLOSURE_AMENDMENT_PATH,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1',
    record_id_field: 'closure_amendment_id',
    record_id: '06b879b44497653b8a3a0e698448efb833efc83cbd8591d0e8ff879cc2071ab4',
    byte_length: 207090,
    sha256: 'e5a8610b596edb567f13624551715ba102f7daaa9ef19f438093a2564123fe47',
    git_blob_oid: '4013eb82d7234534e15e39cd85d9582fa3d2d9c0',
  }),
  review: Object.freeze({
    path: WORK3_CLOSURE_REVIEW_PATH,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
    record_id_field: 'work3_closure_amendment_external_review_receipt_id',
    record_id: 'a2344bb49e37bcae328479835ffe7d2e5477430ff89b4abf8c1af972594a3a14',
    byte_length: 4547,
    sha256: 'd5511ea3224a4cc685518e22a4ae4032ee678e2829ff1d4e2476a03d4de6932b',
    git_blob_oid: 'fd5ef798299211aaf015c72979cb3c5fe9048c98',
  }),
});
const WORK2_RECOVERY_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY_AUTHORITY/V1';
const WORK2_RECOVERY_APPROVAL_ID =
  'BEN-M7-V2-WORK2-COMMIT-DELTA-RECOVERY-20260815';
const CONTRACT_PATH = 'lib/canonical-v2/m7-v2-contract.js';
const CONTRACT_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-contract.test.js';
const LEGACY_M5_AGGREGATE_TEST_PATH = 'tests/stage-2y-structure-m5-aggregate.test.js';
const CANDIDATE_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const CANDIDATE_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const WORKS = Object.freeze(['WORK2', 'WORK3', 'WORK4', 'WORK5', 'WORK6', 'WORK7']);
const HASH_40 = /^[0-9a-f]{40}$/;
const HASH_64 = /^[0-9a-f]{64}$/;
// The authority's tests file-prefix rule: directory "tests", prefix
// "stage-2y-structure-m7-v2-repair-", suffix pattern "^[a-z0-9-]+\.test\.js$".
const TEST_PATH_PATTERN = /^tests\/stage-2y-structure-m7-v2-repair-[a-z0-9-]+\.test\.js$/;
const RECORD_BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length',
  'sha256', 'git_blob_oid',
]);
const WORK2_RECOVERY_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
  'parent_authority_binding', 'activation_receipt_binding', 'work1_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'execution_manifest_binding',
  'stale_output_bindings', 'excluded_generalisation_binding',
  'source_precondition_bindings', 'executable_bindings', 'authorised_scope',
  'base_effective_work2_paths', 'exact_path_removal', 'exact_path_extension',
  'effective_work2_paths', 'prior_execution_state', 'command_extension',
  'exact_git_commit_and_push_argv', 'allowed_effects', 'prohibited_effects', 'rollback',
  'success_conditions',
]);
const WORK2_STALE_RECEIPT_RUN_COUNTS = Object.freeze([
  4, 1, 1, 1, 1, 1, 1, 1, 13, 3, 8, 2, 1, 0,
]);
const WORK2_PRIOR_RECOVERY_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 1, 1,
]);
const WORK2_RECOVERED_RECEIPT_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 2, 2, 1,
]);
const WORK2_RECOVERY_COMMAND_EXTENSION = Object.freeze({
  base_command_count: 14,
  run_limit_overrides: [
    { command_index: 0, max_runs: 5 },
    { command_index: 10, max_runs: 10 },
    { command_index: 11, max_runs: 3 },
    { command_index: 12, max_runs: 2 },
  ],
  appended_argv_with_run_limits: [{
    argv: [
      'node', WORK2_RECOVERY_RUNNER_PATH, '--authority', WORK2_RECOVERY_AUTHORITY_PATH,
    ],
    max_runs: 1,
  }],
  prior_receipt_run_counts: WORK2_PRIOR_RECOVERY_RUN_COUNTS,
  prior_post_receipt_validator_run_count: 1,
  recovered_receipt_run_counts: WORK2_RECOVERED_RECEIPT_RUN_COUNTS,
  required_validator_cumulative_run_count: 2,
  additional_git_add_commit_push_runs: 0,
});
const WORK2_RECOVERY_AUTHORISED_SCOPE = Object.freeze([
  'PRESERVE_PARENT_AUTHORITIES_MANIFEST_AND_GENERALISATION_BYTES',
  'SUPERSEDE_ONLY_THE_UNCOMMITTED_WORK2_COMMIT_DELTA',
  'EXCLUDE_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER',
  'ADD_ONLY_THIS_AUTHORITY_AND_THE_ONE_SHOT_RECOVERY_RUNNER',
  'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK2_GENERATED_OUTPUTS',
  'RUN_WORK2_FINALISER_EXACTLY_ONCE_MORE',
  'RUN_WORK2_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
  'COMMIT_AND_PUSH_THE_EFFECTIVE_TWENTY_THREE_PATH_WORK2_DELTA_ONLY',
]);
const WORK2_RECOVERY_ALLOWED_EFFECTS = Object.freeze({
  deterministic_local_reads: true,
  system_temp_backup_directories: 1,
  work2_generated_output_replacements: 3,
  local_subprocess_runs: 5,
  repository_commits: 0,
  repository_pushes: 0,
});
const WORK2_RECOVERY_PROHIBITED_EFFECTS = Object.freeze({
  non_target_repository_writes: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  serving_changes: 0,
  publication_changes: 0,
});
const WORK2_RECOVERY_SUCCESS_CONDITIONS = Object.freeze([
  'UNCHANGED_GENERALISATION_RUNNER_EXCLUDED_FROM_CURRENT_WORK2_DELTA',
  'PRIOR_WORK2_MANIFEST_AND_RECEIPT_LINEAGE_BOUND',
  'THREE_OUTPUTS_REGENERATED',
  'VALIDATOR_PASS',
  'RECEIPT_BINDS_EFFECTIVE_TWENTY_THREE_PATH_SET',
  'RECEIPT_BINDS_TWENTY_TWO_ARTIFACTS',
  'SOURCE_SET_IDENTITIES_PRESERVED',
  'BACKUP_REMOVED',
  'WORK3_HISTORICAL_RECEIPT_VALIDATION_PASS',
  'ZERO_EXTERNAL_EFFECTS',
]);
const WORK4_CANDIDATE_TRANSITION_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'candidate_transition_authority_id', 'state',
  'candidate_ordering_correction_authority_binding',
  'superseded_bootstrap_manifest_binding', 'candidate_registration_preview_binding',
  'candidate_registration_binding', 'transition_argv', 'transition_run_limit', 'effects',
]);
const WORK4_PASS_TRANSITION_KEYS = Object.freeze([
  'authority_binding', 'superseded_bootstrap_manifest_binding',
  'candidate_registration_preview_binding', 'candidate_registration_binding',
  'state', 'transition_argv', 'transition_run_count',
]);
const WORK4_CANDIDATE_TRANSITION_EFFECTS = Object.freeze({
  transition_authority_writes: 1,
  candidate_registration_writes: 1,
  manifest_replacements: 1,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});
const WORK2_ENTRY_CORRECTION_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defects',
  'parent_authority_binding', 'activation_receipt_binding', 'work1_receipt_binding',
  'work1_correction_authority_binding', 'base_tip_binding',
  'source_precondition_bindings', 'required_work1_commit_delta_paths', 'authorised_scope',
  'exact_bootstrap_correction_paths', 'authorised_work2_work1_write_exceptions',
  'authorised_work2_parent_write_extensions', 'authorised_work2_command_extensions',
  'exact_argv_with_run_limits', 'allowed_effects', 'prohibited_effects',
  'success_conditions',
]);
const CANDIDATE_ORDERING_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defects',
  'parent_authority_binding', 'activation_receipt_binding', 'work1_receipt_binding',
  'work2_entry_correction_authority_binding', 'base_tip_binding',
  'source_precondition_bindings', 'superseded_parent_policy_fields',
  'effective_candidate_ordering', 'authorised_scope', 'exact_path_extension',
  'authorised_work2_work1_write_exceptions',
  'authorised_manifest_replacements', 'affected_current_paths',
  'future_consumer_paths', 'work4_transition_contract', 'later_receipt_contract',
  'exact_argv_with_run_limits', 'allowed_effects', 'prohibited_effects',
  'success_conditions',
]);
const CANDIDATE_ORDERING_MANIFEST_MEMBERS = Object.freeze([
  'candidate_ordering_correction_authority_binding', 'candidate_transition',
]);
const CANDIDATE_ORDERING_SOURCE_PRECONDITIONS = Object.freeze([
  {
    path: VALIDATOR_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 73844,
    sha256: '237cdbc794c41d073e34ea04efe0aeb3872eb01e9d1f657d773c169ff9903b19',
    git_blob_oid: '42d791b7081df2a79402f4e56a243d98389cfd01',
  },
  {
    path: EXECUTION_MANIFEST_TEST_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 126166,
    sha256: '203d55b3aa8c34b05773e2bbd28b87d82bd5bfb271549e5dacecd7f794c792da',
    git_blob_oid: '93de6b7f59a95f66758dcacf5115f42638ee5f76',
  },
  {
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-execution-manifest.json',
    schema_version: SCHEMA,
    record_id_field: 'execution_manifest_id',
    record_id: '8e95940e77f91c63ab3ab81a39e2954c8d904a72846bdee2f626c4ddccac2b60',
    byte_length: 17134,
    sha256: '31c3a02dd026e7d2f613b5d8234436dc9fc297b2dd9bb70a482fe7b940952512',
    git_blob_oid: '42b0f5a82bdea925da2b70795c3f5526560890b5',
  },
  {
    path: REGISTER_CANDIDATE_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 28896,
    sha256: '0a1598e1f2d485acb1162d6315d7a8ccee89df183cf1f200b3849d17c49539b7',
    git_blob_oid: 'cbb05e7883a15f3b6ee4a59c5d520917233235e0',
  },
  {
    path: VERIFY_CANDIDATE_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 26559,
    sha256: 'c31d268ee58ac115ec67a33c2936c6bb4c1813360ed11ccdd15bdc8125124089',
    git_blob_oid: '438f2776566f45b10a5c520810e546f7835a8ff0',
  },
  {
    path: REGISTRATION_TEST_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 21065,
    sha256: '41195abf1f5278e3ebacddf1bc0625f537fe0abc2806012a54d660b766d2b1cb',
    git_blob_oid: '7d9df8bfbeafe4ed1cfc7bf549e405edd8803778',
  },
]);
const CANDIDATE_ORDERING_FOCUSED_ARGV = Object.freeze([
  'node', '--test',
  '--test-name-pattern=Work2 and Work3 stay build-only and Work4 owns the first candidate transition',
  EXECUTION_MANIFEST_TEST_PATH,
]);
const CANDIDATE_REGISTRATION_FOCUSED_ARGV = Object.freeze([
  'node', '--test',
  '--test-name-pattern=M7 V2 candidate registration is immutable, content-addressed and independently verified',
  REGISTRATION_TEST_PATH,
]);
const CANDIDATE_ORDERING_WORK1_WRITE_EXCEPTIONS = Object.freeze([
  REGISTER_CANDIDATE_PATH,
  VERIFY_CANDIDATE_PATH,
  REGISTRATION_TEST_PATH,
]);
const WORK2_SOURCE_SET_BINDING_CONTRACTS = Object.freeze([
  {
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-agreement-analysis-set.json',
    schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
    record_id_field: 'agreement_analysis_set_id',
  },
  {
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-context-compilation-set.json',
    schema_version: 'CONTEXT_COMPILATION_SET/V1',
    record_id_field: 'context_compilation_set_id',
  },
]);
const WORK2_SOURCE_SET_PATHS = Object.freeze(
  WORK2_SOURCE_SET_BINDING_CONTRACTS.map((entry) => entry.path),
);
const WORK2_RECOVERY_SOURCE_PRECONDITION_BINDINGS = Object.freeze([
  {
    path: WORK2_FINALISER_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 33604,
    sha256: '7aabd0ede779a7300e8deb04f1c65f4e0ee9da96f9fb3a5ba8f6d8b85f71b042',
    git_blob_oid: '5ca2c2e4bc66e105bd18c92ad0c649ecc45bd9e8',
  },
  {
    path: WORK2_VALIDATOR_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 33512,
    sha256: '5eeab2481c4c11a3b28d82494458acd8cb06443f9bee0a739a0d27bfed14e0e9',
    git_blob_oid: '29729cfa67c9620f2897a9c0ee7e8e91df68a34f',
  },
  {
    path: VALIDATOR_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 105736,
    sha256: '6e46378ce965c404e05a1da6c18cfc08c6a050087540e77fbc763f8d3ed19ec6',
    git_blob_oid: '26ab05f929918296f8195d98ca000c2fe998f043',
  },
  {
    path: WORK2_TEST_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 26780,
    sha256: '47b4201f950ef9e32d77605ddadca4305b56a51447925efd245b28439531d990',
    git_blob_oid: 'c1bd0d78fea7210f589e74e0fa4f70553ab3c0bf',
  },
  {
    path: EXECUTION_MANIFEST_TEST_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 159488,
    sha256: '7ece01cadd4463946f1e448b9a8886cf334b8e7e8ec3671938ca5ccf58841612',
    git_blob_oid: '0ca13d88425825ac1f87f8dccc72dbed95c75f62',
  },
]);
const WORK2_RECOVERY_STALE_OUTPUT_BINDINGS = Object.freeze([
  {
    path: WORK2_AGREEMENT_SET_PATH,
    schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
    record_id_field: 'agreement_analysis_set_id',
    record_id: '1ff809cfe48a2b25d778a1f94869babf8bd1221513ff1b7ce8bf9a4ed06fe3cf',
    byte_length: 4298,
    sha256: 'f607e73359077f34e2dd0ab9f33584e31fba554c8bcd293d3a4dc21bfa420533',
    git_blob_oid: 'd955a36981a27b1b9d5ec6a9313bddca7f61c3f8',
  },
  {
    path: WORK2_CONTEXT_SET_PATH,
    schema_version: 'CONTEXT_COMPILATION_SET/V1',
    record_id_field: 'context_compilation_set_id',
    record_id: 'dec1de2bfab7d59c518b6a16e37fa6ced7ab3835255ee860d01c9d3f730152dc',
    byte_length: 4335,
    sha256: '5bdbbd951e1dfcd8fede583bc0c6264406108c679cadf2c87ca079ec641aff91',
    git_blob_oid: 'd2e8b3da492d8dbdb6d30adef72df3343ed99c99',
  },
  {
    path: WORK2_RECEIPT_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1',
    record_id_field: 'work2_receipt_id',
    record_id: 'f1a64eb3838d622441b0c278c1013ca5c7c37f694576038e1dec0b1a7e50fca5',
    byte_length: 22370,
    sha256: '1588a4a221c4460324be34755ac430ab22c153ed024edc8419fa8ca1e83a3504',
    git_blob_oid: '154ea212112db266bde266b121f5c21cf515d75b',
  },
]);
const WORK2_RECOVERY_EXCLUDED_GENERALISATION_BINDING = Object.freeze({
  path: WORK2_GENERALISATION_PATH,
  schema_version: null,
  record_id_field: null,
  record_id: null,
  byte_length: 18372,
  sha256: 'c5ba1e970cb0b40837c7e7da3af2bd0bb9f28c2a5d946cba08a8548ddebffec2',
  git_blob_oid: '56f6f4062db5e93de49430f51b72f0b3a6703cee',
});
const WORK2_RECOVERY_PRIOR_EXECUTION_STATE = Object.freeze({
  receipt_command_run_counts: WORK2_STALE_RECEIPT_RUN_COUNTS,
  post_receipt_validator_run_count: 1,
  work2_receipt_id: WORK2_RECOVERY_STALE_OUTPUT_BINDINGS[2].record_id,
  agreement_analysis_set_id: WORK2_RECOVERY_STALE_OUTPUT_BINDINGS[0].record_id,
  context_compilation_set_id: WORK2_RECOVERY_STALE_OUTPUT_BINDINGS[1].record_id,
  semantic_run_count: 0,
});
const WORK2_RECOVERY_ROLLBACK = Object.freeze({
  backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
  backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
  restore_on_finaliser_or_validator_failure: true,
  remove_only_new_outputs_before_restore: true,
  retain_backup_on_restore_failure: true,
  second_attempt: 'REJECT_BEFORE_MUTATION',
  protected_paths_never_removed: [
    WORK0_PATH,
    AUTHORITY_PATH,
    ACTIVATION_PATH,
    WORK1_RECEIPT_PATH,
    WORK2_ENTRY_CORRECTION_AUTHORITY_PATH,
    CANDIDATE_ORDERING_AUTHORITY_PATH,
    executionManifestPath('WORK2'),
    WORK2_RECOVERY_AUTHORITY_PATH,
    WORK2_GENERALISATION_PATH,
  ],
});
const WORK2_ENTRY_BOOTSTRAP_PATHS = Object.freeze([
  WORK2_ENTRY_CORRECTION_AUTHORITY_PATH,
  VALIDATOR_PATH,
  EXECUTION_MANIFEST_TEST_PATH,
]);
const WORK2_ENTRY_WORK1_WRITE_EXCEPTIONS = Object.freeze([
  VALIDATOR_PATH,
  EXECUTION_MANIFEST_TEST_PATH,
  CONTRACT_PATH,
  CONTRACT_TEST_PATH,
]);
const WORK2_ENTRY_PARENT_WRITE_EXTENSIONS = Object.freeze([
  LEGACY_M5_AGGREGATE_TEST_PATH,
]);
const WORK2_ENTRY_SOURCE_PRECONDITION_PATHS = Object.freeze([
  ...WORK2_ENTRY_WORK1_WRITE_EXCEPTIONS,
  ...WORK2_ENTRY_PARENT_WRITE_EXTENSIONS,
]);
const WORK2_ENTRY_AUTHORISED_WRITE_PATHS = Object.freeze([
  ...new Set([
    ...WORK2_ENTRY_BOOTSTRAP_PATHS,
    ...WORK2_ENTRY_WORK1_WRITE_EXCEPTIONS,
    ...WORK2_ENTRY_PARENT_WRITE_EXTENSIONS,
  ]),
].sort());
const WORK2_ENTRY_COMMAND_EXTENSIONS = Object.freeze([
  {
    argv: [
      'node', '--test', CONTRACT_TEST_PATH,
      'tests/stage-2y-structure-m7-v2-repair-work2.test.js',
    ],
    max_runs: 30,
  },
  { argv: ['node', '--test', LEGACY_M5_AGGREGATE_TEST_PATH], max_runs: 30 },
]);
const BASE_TIP_KEYS = Object.freeze([
  'commit', 'branch', 'parent_commit', 'commit_message', 'milestone_attestation',
]);
const ACTIVATION_COMMIT_KEYS = Object.freeze([
  'commit', 'parent_commit', 'branch', 'activation_receipt_id',
]);
const RUN_KEYS = Object.freeze(['argv', 'max_runs']);
const ATTESTATION_KEYS = Object.freeze([
  'attestation_scope', 'state', 'attestor', 'predecessor_work', 'commit', 'parent_commit', 'branch',
  'commit_message', 'origin_ref', 'predecessor_receipt_binding',
  'predecessor_execution_manifest_binding', 'predecessor_validation_result',
  'exact_commit_delta_paths', 'repository_observation', 'checks',
  'observed_command_result_ledger',
]);
const ATTESTATION_CHECK_IDS = Object.freeze([
  'SINGLE_PARENT', 'EXPECTED_PARENT', 'EXPECTED_MESSAGE', 'EXACT_TREE_DELTA',
  'RECEIPT_BLOB_IN_COMMIT', 'ORIGIN_REF_EQUALS_COMMIT', 'NO_SHALLOW_HISTORY',
  'NO_GRAFTS', 'NO_LOOSE_REPLACE_REFS', 'NO_PACKED_REPLACE_REFS',
  'FIXED_CWD_AND_GIT_ENVIRONMENT',
]);
const ATTESTATION_COMMAND_CHECK_IDS = Object.freeze(ATTESTATION_CHECK_IDS.slice(0, 6));
const CANDIDATE_WRAPPER_KEYS = Object.freeze([
  'registration_binding', 'independent_verification',
]);
const CANDIDATE_VERIFICATION_SCHEMA =
  'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const CANDIDATE_VERIFICATION_CHECK_IDS = Object.freeze([
  'REGISTRATION_SELF_IDENTITY', 'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS', 'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS', 'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
]);
const CANDIDATE_RECORD_KEYS = Object.freeze([
  'schema_version', 'candidate_registration_id', 'stage', 'lifecycle_state',
  'parent_authority_binding', 'activation_receipt_binding', 'work0_evidence_root_binding',
  'code_bindings', 'semantic_input_bindings', 'family_profile_set_binding',
  'subtype_tree_bindings', 'structure_disposition_set_binding', 'view_policy_binding',
  'predecessor_receipt_bindings', 'allowed_output_root', 'counts', 'effects',
]);
const CANDIDATE_CODE_KEYS = Object.freeze([
  'compiler', 'deterministic_generator', 'contract_validator', 'projector',
  'independent_verifier', 'runners', 'tests',
]);
// The code roles that are exactly one file each; `runners` and `tests` are the
// two list-valued roles. `code_file_count` is this roster's length plus those
// two list lengths, never a literal:
// `registration_schema_extensions.literal_count_pins_forbidden_in` names this
// file.
const CANDIDATE_CODE_SINGLETON_ROLES = Object.freeze(
  CANDIDATE_CODE_KEYS.filter((role) => role !== 'runners' && role !== 'tests'),
);
const CANDIDATE_COUNT_KEYS = Object.freeze([
  'code_file_count', 'runner_count', 'test_count', 'semantic_input_count',
  'subtype_tree_count', 'predecessor_receipt_count', 'unique_bound_path_count',
]);
const CANDIDATE_IMPORT_CLOSURE_MEMBER = 'import_closure_bindings';
const CANDIDATE_IMPORT_CLOSURE_COUNT = 'import_closure_count';
const CANDIDATE_IMPORT_CLOSURE_BINDING_KEYS = Object.freeze([
  'byte_length', 'git_blob_oid', 'path', 'sha256',
]);
const CANDIDATE_INPUT_ROLES = Object.freeze([
  'BASE_ANALYSIS_SET', 'AGREEMENT_INDEX_SET', 'CONTEXT_COMPILATION_SET',
  'APPROVED_FAMILY_PACKET_SET', 'APPROVED_FAMILY_PROFILE_SET',
  'APPROVED_STRUCTURE_DISPOSITION_SET',
]);
const CANDIDATE_INPUT_SCHEMAS = Object.freeze({
  BASE_ANALYSIS_SET: 'AGREEMENT_ANALYSIS_SET/V1',
  AGREEMENT_INDEX_SET: 'AGREEMENT_INDEX_SET/V1',
  CONTEXT_COMPILATION_SET: 'CONTEXT_COMPILATION_SET/V1',
  APPROVED_FAMILY_PACKET_SET: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  APPROVED_FAMILY_PROFILE_SET: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
  APPROVED_STRUCTURE_DISPOSITION_SET: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
});
const CANDIDATE_FAMILIES = Object.freeze([
  'ANTITRUST_REGULATORY', 'APPRAISAL_DISSENTERS_RIGHTS', 'CAPITALISATION',
  'CLOSING_CONDITIONS', 'CONSIDERATION', 'DIVIDENDS', 'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS', 'FINANCING_COVENANTS', 'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY', 'INTERIM_OPERATING', 'KEY_DEFINED_TERMS',
  'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP', 'PROXY_MEETING',
  'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TAX_MATTERS',
  'TERMINATION', 'TERMINATION_FEE',
]);
const CANDIDATE_SEALED_FAMILIES = Object.freeze(
  CANDIDATE_FAMILIES.filter((familyKey) => familyKey !== 'CAPITALISATION'),
);
const CANDIDATE_EFFECTS = Object.freeze({
  registration_file_writes: 1, model_calls: 0, network_reads: 0, network_writes: 0,
  database_writes: 0, product_writes: 0, m0_m4_mutations: 0, m8_actions: 0,
});
const CANDIDATE_VERIFICATION_EFFECTS = Object.freeze({
  files_written: 0, model_calls: 0, network_reads: 0, network_writes: 0,
  database_writes: 0, product_writes: 0, m0_m4_mutations: 0, m8_actions: 0,
});
const WORK1_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work1_contract_receipt_id', 'work1_contract_receipt_digest',
  'stage', 'state', 'status', 'activation_commit_binding', 'work0_evidence_root_binding',
  'work1_7_authority_binding', 'activation_receipt_binding', 'contract_policy_binding',
  'family_packet_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'drafting_command_audit', 'combined_test_result',
  'repository_precondition', 'counts', 'checks', 'effects', 'next_work',
]);
const LATER_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'state', 'status', 'work', 'execution_manifest_id',
  'execution_manifest_digest', 'candidate_ordering_correction_authority_binding',
  'candidate_registration_id', 'candidate_transition', 'counts', 'effects',
]);
const RICH_WORK3_RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V1';
const RICH_WORK3_RECEIPT_V2_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2';
const WORK3_V2_VALIDATION_KEYS = Object.freeze([
  'schema_version', 'status', 'work3_receipt_id', 'family_package_count',
  'profile_count', 'artifact_binding_count', 'effective_path_count',
  'create_once_output_count',
]);
const RICH_WORK3_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work3_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'candidate_ordering_correction_authority_binding',
  'work3_entry_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'candidate_native_set_evidence', 'family_profile_evidence',
  'structure_disposition_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'combined_test_result', 'repository_precondition',
  'counts', 'checks', 'effects', 'next_work',
]);
const RICH_PACKAGE_MEMBER_BINDING_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const RICH_PACKAGE_MEMBER_BINDING_KEYS = Object.freeze([
  'schema_version', 'container_path', 'member_field', 'member_index',
  'member_schema_version', 'member_record_id_field', 'member_record_id',
  'member_byte_length', 'member_sha256',
]);
const RICH_FAMILY_PROFILE_EVIDENCE_KEYS = Object.freeze([
  'family_profile_package_bindings', 'approved_family_profile_set_binding', 'family_keys',
]);
const RICH_APPROVED_PROFILE_SET_KEYS = Object.freeze([
  'schema_version', 'family_profile_set_id', 'state', 'family_profile_package_bindings',
  'profiles', 'dimension_evidence_bindings', 'subtype_tree_bindings',
]);
const RICH_FAMILY_PACKAGE_KEYS = Object.freeze([
  'schema_version', 'family_profile_package_id', 'state', 'family_key',
  'profile_set_version', 'family_approval', 'legal_decisions', 'profiles', 'subtype_tree',
  'match_fixtures', 'dimension_evidence', 'structure_fixture_members',
]);
const RICH_STRUCTURE_SET_KEYS = Object.freeze([
  'schema_version', 'structure_disposition_set_id', 'state', 'members',
]);
const RICH_STRUCTURE_MEMBER_KEYS = Object.freeze([
  'schema_version', 'structure_disposition_id', 'kind', 'reason_code', 'policy_id',
  'policy_version', 'authority_class', 'approver', 'lawyer_ruling_id', 'scope',
  'inclusion_fixture_bindings', 'exclusion_fixture_bindings', 'match_test',
  'inline_list_overlay',
]);
const RICH_STRUCTURE_SCOPE_KEYS = Object.freeze([
  'agreement_index_id', 'source_node_occurrence_id', 'start_byte', 'end_byte',
  'governed_input_occurrence_ids',
]);
const RICH_INLINE_OVERLAY_KEYS = Object.freeze([
  'schema_version', 'lawyer_ruling_id', 'agreement_index_binding',
  'sealed_ambiguity_id', 'sealed_ambiguity_type', 'sealed_ambiguity_span',
  'inline_marker_disposition_id', 'parent_node_occurrence_id', 'parent_reference',
  'parent_scoping_rule', 'marker_eligibility', 'candidate_trees',
  'selected_candidate_tree_id', 'technical_review',
  'ambiguous_repeat_fixture_bindings',
]);
const RICH_NATIVE_SET_EVIDENCE_KEYS = Object.freeze([
  'work2_agreement_analysis_set_binding', 'work2_context_compilation_set_binding',
  'work3_agreement_index_set_binding', 'work3_context_compilation_set_binding',
  'work3_agreement_analysis_set_binding', 'sealed_agreement_ids', 'additive_agreement_ids',
  'combined_agreement_ids', 'extension_proof',
]);
const WORK2_COMPILER_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1';
const WORK2_COMPILER_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work2_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'source_set_evidence', 'compiler_evidence',
  'artifact_bindings', 'artifact_set_digest', 'command_execution_ledger',
  'combined_test_result', 'repository_precondition', 'counts', 'checks', 'effects',
  'next_work',
]);
const RESULT_KEYS = Object.freeze([
  'schema_version', 'status', 'work', 'manifest_path', 'execution_manifest_id',
  'execution_manifest_digest', 'candidate_registration_id', 'candidate_stage_state',
  'deferred_proofs',
]);
const CANONICAL_ROOT = realpathSync(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..',
));

export class WorkExecutionManifestValidationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'WorkExecutionManifestValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new WorkExecutionManifestValidationError(code, detail);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...keys].sort());
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

// A binding carried by a HISTORICAL (superseded) candidate registration is
// verified against the Git object it names rather than against the working
// tree: the replacement authority permits its Work 1 write exceptions to be
// edited, and a superseded registration has to stay verifiable after that
// edit. The returned bytes are re-hashed into a blob oid here, so the object
// is proved to be the exact blob the binding names, not merely readable.
function gitObjectBytes(root, oid, label) {
  if (typeof oid !== 'string' || !HASH_40.test(oid)) {
    fail('BINDING_BYTE_MISMATCH', label);
  }
  let bytes;
  try {
    bytes = gitReadBytes(root, ['cat-file', '-p', oid]);
  } catch {
    fail('BINDING_BYTE_MISMATCH', label);
  }
  if (!Buffer.isBuffer(bytes) || gitBlobOid(bytes) !== oid) {
    fail('BINDING_BYTE_MISMATCH', label);
  }
  return bytes;
}

// Current registrations read the working tree exactly as before; historical
// ones read the Git object. Every other check on the bytes is unchanged.
function boundBytes(root, binding, historical) {
  return historical
    ? gitObjectBytes(root, binding.git_blob_oid, binding.path)
    : readSafe(root, binding.path);
}

function workNumber(work) {
  return Number(work.slice(4));
}

function executionManifestPath(work) {
  return `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work${workNumber(work)}-execution-manifest.json`;
}

function normaliseRoot(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) fail('INVALID_OPTIONS', 'repoRoot');
  let root;
  try {
    root = realpathSync(repoRoot);
  } catch {
    fail('PATH_SAFETY', 'repoRoot');
  }
  if (root !== path.resolve(repoRoot)) fail('PATH_SAFETY', 'symlinked repoRoot');
  return root;
}

function canonicalBaseTipObservation(root, binding, predecessorReceiptBinding) {
  let parentLine;
  let commitMessage;
  let deltaOutput;
  let receiptOutput;
  let originCommit;
  try {
    gitReadText(root, ['cat-file', '-e', `${binding.commit}^{commit}`]);
    gitReadText(root, ['merge-base', '--is-ancestor', WORK3_V2_FINAL_COMMIT, binding.commit]);
    originCommit = gitReadText(root, ['rev-parse', `refs/remotes/origin/${BRANCH}`]);
    gitReadText(root, ['merge-base', '--is-ancestor', binding.commit, originCommit]);
    parentLine = gitReadText(root, ['rev-list', '--parents', '-n', '1', binding.commit]);
    commitMessage = gitReadText(root, ['log', '--format=%s', '-n', '1', binding.commit]);
    deltaOutput = gitReadText(root, [
      'diff-tree', '--no-commit-id', '--name-only', '-r', binding.commit,
    ]);
    receiptOutput = gitReadText(root, [
      'ls-tree', '-r', '--full-tree', binding.commit, '--', predecessorReceiptBinding.path,
    ]);
  } catch {
    fail('BASE_TIP_DRIFT', 'pushed Work4 preparation Git lineage');
  }
  const parents = parentLine.split(/\s+/u);
  const receiptMatch = /^\d{6} blob ([0-9a-f]{40})\t(.+)$/u.exec(receiptOutput);
  const exactCommitDeltaPaths = deltaOutput === ''
    ? []
    : deltaOutput.split('\n').filter(Boolean).sort();
  if (parents.length !== 2
      || parents[0] !== binding.commit
      || receiptMatch === null
      || receiptMatch[1] !== predecessorReceiptBinding.git_blob_oid
      || receiptMatch[2] !== predecessorReceiptBinding.path
      || originCommit.length !== 40) {
    fail('BASE_TIP_DRIFT', 'pushed Work4 preparation Git observation');
  }
  return {
    commit: binding.commit,
    parent_commit: parents[1],
    commit_message: commitMessage,
    exact_commit_delta_paths: exactCommitDeltaPaths,
  };
}

function normaliseRepositoryPath(repositoryPath, code = 'PATH_SAFETY') {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
    || path.posix.isAbsolute(repositoryPath) || repositoryPath.includes('\\')
    || /[\0*?\[\]{}]/.test(repositoryPath)) {
    fail(code, String(repositoryPath));
  }
  const parts = repositoryPath.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')
    || path.posix.normalize(repositoryPath) !== repositoryPath) {
    fail(code, repositoryPath);
  }
  return repositoryPath;
}

function inspectSafePath(root, repositoryPath, mustExist) {
  normaliseRepositoryPath(repositoryPath);
  const parts = repositoryPath.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (!mustExist && error.code === 'ENOENT') return current;
      fail('PATH_SAFETY', repositoryPath);
    }
    if (stat.isSymbolicLink()) fail('PATH_SAFETY', repositoryPath);
    if (index < parts.length - 1 && !stat.isDirectory()) fail('PATH_SAFETY', repositoryPath);
    if (index === parts.length - 1 && !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
  }
  return current;
}

function readSafe(root, repositoryPath) {
  return readFileSync(inspectSafePath(root, repositoryPath, true));
}

function parseCanonical(bytes, code, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, label);
  }
  if (!bytes.equals(canonicalBytes(value))) fail(code, label);
  return value;
}

function restampedIdentity(record, digestField, idField) {
  const unsigned = clone(record);
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { digest, id: contentId(record.schema_version, withDigest) };
}

function validateContentIdOnly(record, idField, code, label) {
  if (typeof record?.schema_version !== 'string' || typeof record?.[idField] !== 'string') {
    fail(code, label);
  }
  const unsigned = clone(record);
  delete unsigned[idField];
  if (record[idField] !== contentId(record.schema_version, unsigned)) fail(code, label);
}

function validateAuthority(root) {
  const bytes = readSafe(root, AUTHORITY_PATH);
  const authority = parseCanonical(bytes, 'AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  const identity = restampedIdentity(authority, 'authority_digest', 'authority_id');
  const policy = authority.per_work_execution_manifest_policy;
  if (authority.authority_digest !== identity.digest || authority.authority_id !== identity.id
    || authority.authority_id !== AUTHORITY_ID
    || authority.authority_digest !== AUTHORITY_DIGEST
    || sha256Hex(bytes) !== AUTHORITY_SHA256
    || authority.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1'
    || !policy || policy.schema_version !== SCHEMA
    || !same(policy.applies_to, WORKS)
    || policy.create_once_no_overwrite !== true
    || policy.authoring_manifest_is_only_pre_work_bootstrap_write !== true
    || !same(policy.exact_paths, WORKS.map(executionManifestPath))
    || !same(policy.parent_authority_binding_fields,
      ['path', 'schema_version', 'authority_id', 'authority_digest', 'byte_length', 'sha256'])
    || !authority.command_policy?.later_work_entrypoints
    || !authority.command_policy?.later_work_tests
    || authority.prohibited_effects?.model_calls !== 0
    || authority.next_stage_lock?.m8_authorised !== false) {
    fail('AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  }
  return { authority, bytes };
}

function expectedAuthorityBinding(authority, bytes) {
  return {
    path: AUTHORITY_PATH,
    schema_version: authority.schema_version,
    authority_id: authority.authority_id,
    authority_digest: authority.authority_digest,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

function validateRecordBinding(root, binding, code) {
  if (!exactKeys(binding, RECORD_BINDING_KEYS)
    || typeof binding.schema_version !== 'string'
    || typeof binding.record_id_field !== 'string'
    || typeof binding.record_id !== 'string'
    || !Number.isSafeInteger(binding.byte_length) || binding.byte_length <= 0
    || !HASH_64.test(binding.sha256)
    || !HASH_40.test(binding.git_blob_oid)) {
    fail(code, 'binding shape');
  }
  const bytes = readSafe(root, binding.path);
  const record = parseCanonical(bytes, code, binding.path);
  if (record.schema_version !== binding.schema_version
    || record[binding.record_id_field] !== binding.record_id
    || bytes.length !== binding.byte_length
    || sha256Hex(bytes) !== binding.sha256
    || gitBlobOid(bytes) !== binding.git_blob_oid) {
    fail(code, binding.path);
  }
  return { record, bytes };
}

function recordBinding(repositoryPath, bytes, record, idField) {
  return {
    path: repositoryPath,
    schema_version: record.schema_version,
    record_id_field: idField,
    record_id: record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function readPinnedWork3ClosureRecord(root, binding) {
  const bytes = readSafe(root, binding.path);
  const record = parseCanonical(bytes, 'MANIFEST_CONTRACT_DRIFT', binding.path);
  if (record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id
      || bytes.length !== binding.byte_length
      || sha256Hex(bytes) !== binding.sha256
      || gitBlobOid(bytes) !== binding.git_blob_oid) {
    fail('MANIFEST_CONTRACT_DRIFT', binding.path);
  }
  validateContentIdOnly(
    record,
    binding.record_id_field,
    'MANIFEST_CONTRACT_DRIFT',
    binding.path,
  );
  return { bytes, record };
}

function expectedWork3ClosureSuccessor(predecessor, amendment, applicationBinding) {
  const overlay = amendment.successor_manifest_contract_overlay;
  const expected = clone(predecessor);
  delete expected.execution_manifest_digest;
  delete expected.execution_manifest_id;
  expected.schema_version = WORK3_CLOSURE_SUCCESSOR_SCHEMA;
  for (const field of [
    'allowed_effects',
    'exact_argv_with_run_limits',
    'exact_git_commit_and_push_argv',
    'permitted_read_paths',
    'permitted_write_paths',
    'stop_conditions',
    'success_conditions',
  ]) expected[field] = clone(overlay[field]);
  Object.assign(expected, {
    predecessor_execution_manifest_binding:
      clone(WORK3_CLOSURE_INPUT_BINDINGS.predecessor),
    closure_amendment_binding: clone(WORK3_CLOSURE_INPUT_BINDINGS.amendment),
    external_review_receipt_binding: clone(WORK3_CLOSURE_INPUT_BINDINGS.review),
    closure_application_receipt_binding: clone(applicationBinding),
  });
  const identity = restampedIdentity(
    expected,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  const sealed = {
    ...expected,
    execution_manifest_digest: identity.digest,
    execution_manifest_id: identity.id,
  };
  if (overlay.schema_version !== WORK3_CLOSURE_SUCCESSOR_SCHEMA
      || !same(Object.keys(sealed).sort(), overlay.record_exact_keys)) {
    fail('MANIFEST_CONTRACT_DRIFT', 'Work3 closure successor overlay');
  }
  return sealed;
}

function validateWork3ClosureSuccessor(root, manifestPath) {
  const predecessorState = readPinnedWork3ClosureRecord(
    root,
    WORK3_CLOSURE_INPUT_BINDINGS.predecessor,
  );
  const amendmentState = readPinnedWork3ClosureRecord(
    root,
    WORK3_CLOSURE_INPUT_BINDINGS.amendment,
  );
  readPinnedWork3ClosureRecord(root, WORK3_CLOSURE_INPUT_BINDINGS.review);

  const applicationBytes = readSafe(root, WORK3_CLOSURE_APPLICATION_PATH);
  const application = parseCanonical(
    applicationBytes,
    'MANIFEST_CONTRACT_DRIFT',
    WORK3_CLOSURE_APPLICATION_PATH,
  );
  if (!exactKeys(application, [
    'schema_version',
    WORK3_CLOSURE_APPLICATION_ID_FIELD,
    'state',
    'closure_amendment_binding',
    'external_review_receipt_binding',
    'zero_effect_boundary',
  ])
      || application.schema_version !== WORK3_CLOSURE_APPLICATION_SCHEMA
      || application.state !== 'IMMUTABLE_ZERO_EFFECT_APPLICATION'
      || !same(
        application.closure_amendment_binding,
        WORK3_CLOSURE_INPUT_BINDINGS.amendment,
      )
      || !same(
        application.external_review_receipt_binding,
        WORK3_CLOSURE_INPUT_BINDINGS.review,
      )
      || !same(
        application.zero_effect_boundary,
        amendmentState.record.zero_effect_boundary,
      )) {
    fail('MANIFEST_CONTRACT_DRIFT', WORK3_CLOSURE_APPLICATION_PATH);
  }
  validateContentIdOnly(
    application,
    WORK3_CLOSURE_APPLICATION_ID_FIELD,
    'MANIFEST_CONTRACT_DRIFT',
    WORK3_CLOSURE_APPLICATION_PATH,
  );
  const applicationBinding = recordBinding(
    WORK3_CLOSURE_APPLICATION_PATH,
    applicationBytes,
    application,
    WORK3_CLOSURE_APPLICATION_ID_FIELD,
  );
  const manifestBytes = readSafe(root, manifestPath);
  const manifest = parseCanonical(
    manifestBytes,
    'MANIFEST_BYTES_DRIFT',
    manifestPath,
  );
  const expected = expectedWork3ClosureSuccessor(
    predecessorState.record,
    amendmentState.record,
    applicationBinding,
  );
  if (!same(manifest, expected)) {
    fail('MANIFEST_CONTRACT_DRIFT', 'Work3 closure successor exact chain');
  }
  const result = {
    schema_version: RESULT_SCHEMA,
    status: 'PASS_NARROWING_EXECUTION_MANIFEST',
    work: 'WORK3',
    manifest_path: manifestPath,
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_registration_id: null,
    candidate_stage_state: 'BUILD_ONLY_NULL',
    deferred_proofs: [DEFERRED_GIT_PROOF],
  };
  if (!exactKeys(result, RESULT_KEYS)) fail('MANIFEST_CONTRACT_DRIFT', 'result');
  return result;
}

function optionalCanonicalRecord(root, repositoryPath, code) {
  const absolute = path.join(root, ...normaliseRepositoryPath(repositoryPath).split('/'));
  try {
    lstatSync(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail(code, repositoryPath);
  }
  const bytes = readSafe(root, repositoryPath);
  return { bytes, record: parseCanonical(bytes, code, repositoryPath) };
}

function standardRecoveryBinding(root, repositoryPath, idField = null) {
  const bytes = readSafe(root, repositoryPath);
  if (idField === null) {
    return {
      path: repositoryPath,
      schema_version: null,
      record_id_field: null,
      record_id: null,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      git_blob_oid: gitBlobOid(bytes),
    };
  }
  const record = parseCanonical(bytes, 'AUTHORITY_BINDING_DRIFT', repositoryPath);
  if (typeof record.schema_version !== 'string' || typeof record[idField] !== 'string') {
    fail('AUTHORITY_BINDING_DRIFT', repositoryPath);
  }
  return recordBinding(repositoryPath, bytes, record, idField);
}

function work2RecoveryExecutableBindings(root) {
  return [
    VALIDATOR_PATH,
    WORK2_FINALISER_PATH,
    WORK2_VALIDATOR_PATH,
    WORK2_RECOVERY_RUNNER_PATH,
    EXECUTION_MANIFEST_TEST_PATH,
    WORK2_TEST_PATH,
  ].map((repositoryPath) => standardRecoveryBinding(root, repositoryPath));
}

function work2RecoveryEffectivePaths(basePaths) {
  if (basePaths.length !== 22 || new Set(basePaths).size !== 22
      || !basePaths.includes(WORK2_GENERALISATION_PATH)
      || !basePaths.includes(WORK2_ENTRY_CORRECTION_AUTHORITY_PATH)
      || !basePaths.includes(WORK2_VALIDATOR_PATH)
      || basePaths.includes(WORK2_RECOVERY_AUTHORITY_PATH)
      || basePaths.includes(WORK2_RECOVERY_RUNNER_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'Work2 recovery base paths');
  }
  const paths = basePaths.filter(
    (repositoryPath) => repositoryPath !== WORK2_GENERALISATION_PATH,
  );
  paths.splice(
    paths.indexOf(WORK2_ENTRY_CORRECTION_AUTHORITY_PATH) + 1,
    0,
    WORK2_RECOVERY_AUTHORITY_PATH,
  );
  paths.splice(
    paths.indexOf(WORK2_VALIDATOR_PATH) + 1,
    0,
    WORK2_RECOVERY_RUNNER_PATH,
  );
  if (paths.length !== 23 || new Set(paths).size !== 23) {
    fail('PATH_SCOPE_DRIFT', 'Work2 recovery effective paths');
  }
  return paths;
}

function validateWork2RecoveryOverlay(root, manifest, manifestBytes) {
  const input = optionalCanonicalRecord(
    root,
    WORK2_RECOVERY_AUTHORITY_PATH,
    'AUTHORITY_BINDING_DRIFT',
  );
  if (input === null) return null;
  const record = input.record;
  const unsigned = clone(record);
  delete unsigned.correction_authority_id;
  const basePaths = manifest.exact_git_commit_and_push_argv?.[0]?.slice(3) ?? [];
  const effectivePaths = work2RecoveryEffectivePaths(basePaths);
  const exactGit = [
    ['git', 'add', '--', ...effectivePaths],
    manifest.exact_git_commit_and_push_argv[1],
    manifest.exact_git_commit_and_push_argv[2],
  ];
  const expectedBindings = {
    parent: standardRecoveryBinding(root, AUTHORITY_PATH, 'authority_id'),
    activation: standardRecoveryBinding(root, ACTIVATION_PATH, 'activation_receipt_id'),
    work1: standardRecoveryBinding(root, WORK1_RECEIPT_PATH, 'work1_contract_receipt_id'),
    entry: standardRecoveryBinding(
      root, WORK2_ENTRY_CORRECTION_AUTHORITY_PATH, 'correction_authority_id',
    ),
    ordering: standardRecoveryBinding(
      root, CANDIDATE_ORDERING_AUTHORITY_PATH, 'correction_authority_id',
    ),
    manifest: recordBinding(
      executionManifestPath('WORK2'), manifestBytes, manifest, 'execution_manifest_id',
    ),
  };
  if (!exactKeys(record, WORK2_RECOVERY_AUTHORITY_KEYS)
      || record.schema_version !== WORK2_RECOVERY_AUTHORITY_SCHEMA
      || record.correction_authority_id
        !== contentId(WORK2_RECOVERY_AUTHORITY_SCHEMA, unsigned)
      || record.stage !== 'M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY'
      || record.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK2_PRE_COMMIT_RECOVERY'
      || record.approved_on !== '2026-08-15'
      || record.approver !== 'BEN_GOODCHILD'
      || record.ben_approval_id !== WORK2_RECOVERY_APPROVAL_ID
      || record.approval_text
        !== 'Hokay, proceed and keep proceeding. You should merge as you see fir'
      || record.discovered_defect
        !== 'WORK2_EFFECTIVE_DELTA_INCLUDED_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER'
      || !same(record.authorised_scope, WORK2_RECOVERY_AUTHORISED_SCOPE)
      || !same(record.allowed_effects, WORK2_RECOVERY_ALLOWED_EFFECTS)
      || !same(record.prohibited_effects, WORK2_RECOVERY_PROHIBITED_EFFECTS)
      || !same(record.rollback, WORK2_RECOVERY_ROLLBACK)
      || !same(record.success_conditions, WORK2_RECOVERY_SUCCESS_CONDITIONS)
      || !same(record.prior_execution_state, WORK2_RECOVERY_PRIOR_EXECUTION_STATE)
      || !same(record.command_extension, WORK2_RECOVERY_COMMAND_EXTENSION)) {
    fail('AUTHORITY_BINDING_DRIFT', WORK2_RECOVERY_AUTHORITY_PATH);
  }
  if (!same(record.parent_authority_binding, expectedBindings.parent)
      || !same(record.activation_receipt_binding, expectedBindings.activation)
      || !same(record.work1_receipt_binding, expectedBindings.work1)
      || !same(record.work2_entry_correction_authority_binding, expectedBindings.entry)
      || !same(record.candidate_ordering_correction_authority_binding,
        expectedBindings.ordering)
      || !same(record.execution_manifest_binding, expectedBindings.manifest)
      || !same(record.stale_output_bindings, WORK2_RECOVERY_STALE_OUTPUT_BINDINGS)
      || !same(record.excluded_generalisation_binding,
        WORK2_RECOVERY_EXCLUDED_GENERALISATION_BINDING)
      || !same(record.excluded_generalisation_binding,
        standardRecoveryBinding(root, WORK2_GENERALISATION_PATH))
      || !same(record.source_precondition_bindings,
        WORK2_RECOVERY_SOURCE_PRECONDITION_BINDINGS)
      || !same(record.executable_bindings, work2RecoveryExecutableBindings(root))
      || [record.parent_authority_binding, record.activation_receipt_binding,
        record.work1_receipt_binding, record.work2_entry_correction_authority_binding,
        record.candidate_ordering_correction_authority_binding,
        record.execution_manifest_binding, ...record.stale_output_bindings,
        record.excluded_generalisation_binding, ...record.source_precondition_bindings,
        ...record.executable_bindings].some(
        (binding) => !exactKeys(binding, RECORD_BINDING_KEYS),
      )) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work2 recovery bindings');
  }
  if (!same(record.base_effective_work2_paths, basePaths)
      || !same(record.exact_path_removal, [WORK2_GENERALISATION_PATH])
      || !same(record.exact_path_extension, [
        WORK2_RECOVERY_AUTHORITY_PATH,
        WORK2_RECOVERY_RUNNER_PATH,
      ])
      || !same(record.effective_work2_paths, effectivePaths)
      || !same(record.exact_git_commit_and_push_argv, exactGit)) {
    fail('PATH_SCOPE_DRIFT', 'Work2 recovery overlay');
  }
  const effectiveCommands = clone(manifest.exact_argv_with_run_limits);
  if (effectiveCommands.length !== WORK2_RECOVERY_COMMAND_EXTENSION.base_command_count) {
    fail('COMMAND_SCOPE_DRIFT', 'Work2 recovery base commands');
  }
  for (const override of WORK2_RECOVERY_COMMAND_EXTENSION.run_limit_overrides) {
    if (!effectiveCommands[override.command_index]) {
      fail('COMMAND_SCOPE_DRIFT', 'Work2 recovery command override');
    }
    effectiveCommands[override.command_index].max_runs = override.max_runs;
  }
  effectiveCommands.push(
    ...clone(WORK2_RECOVERY_COMMAND_EXTENSION.appended_argv_with_run_limits),
  );
  const runnerEntry = effectiveCommands.at(-1);
  if (!same(runnerEntry,
    WORK2_RECOVERY_COMMAND_EXTENSION.appended_argv_with_run_limits[0])
      || !effectivePaths.includes(runnerEntry.argv[1])
      || runnerEntry.argv[2] !== '--authority'
      || !effectivePaths.includes(runnerEntry.argv[3])) {
    fail('COMMAND_SCOPE_DRIFT', 'Work2 recovery runner');
  }
  return { correctionAuthorityId: record.correction_authority_id };
}

function validateActivation(root, authority, binding, commitBinding) {
  const { record, bytes } = validateRecordBinding(root, binding, 'ACTIVATION_BINDING_DRIFT');
  const identity = restampedIdentity(record, 'activation_receipt_digest', 'activation_receipt_id');
  if (binding.path !== ACTIVATION_PATH
    || binding.record_id_field !== 'activation_receipt_id'
    || record.activation_receipt_digest !== identity.digest
    || record.activation_receipt_id !== identity.id
    || record.activation_receipt_id !== ACTIVATION_ID
    || record.activation_receipt_digest !== ACTIVATION_DIGEST
    || sha256Hex(bytes) !== ACTIVATION_SHA256
    || record.state !== 'PASS_AUTHORITY_ACTIVATION'
    || record.authority_binding?.record_id !== authority.authority_id
    || record.authority_binding?.record_digest !== authority.authority_digest
    || !exactKeys(commitBinding, ACTIVATION_COMMIT_KEYS)
    || commitBinding.commit !== ACTIVATION_COMMIT
    || commitBinding.parent_commit !== authority.base_commit
    || commitBinding.branch !== BRANCH
    || commitBinding.activation_receipt_id !== record.activation_receipt_id) {
    fail('ACTIVATION_BINDING_DRIFT', ACTIVATION_PATH);
  }
  return record;
}

function manifestMembers(policy, work, work4Correction = false, candidateReplacement = false) {
  return [
    ...policy.exact_members,
    ...CANDIDATE_ORDERING_MANIFEST_MEMBERS,
    ...(work === 'WORK3' ? [WORK3_ENTRY_MANIFEST_MEMBER] : []),
    ...(work === 'WORK4' && work4Correction ? [WORK4_CORRECTION_MANIFEST_MEMBER] : []),
    ...(candidateReplacement ? [CANDIDATE_REPLACEMENT_MANIFEST_MEMBER] : []),
  ];
}

function validateManifestIdentity(
  record, policy, expectedWork, work4Correction = false, candidateReplacement = false,
) {
  const effectiveMembers = manifestMembers(
    policy, expectedWork, work4Correction, candidateReplacement,
  );
  if (!exactKeys(record, effectiveMembers)
    || record.schema_version !== SCHEMA
    || record.work !== expectedWork
    || record.state !== 'PRE_WORK_BOOTSTRAP_ONLY') {
    fail('MANIFEST_CONTRACT_DRIFT', expectedWork);
  }
  const identity = restampedIdentity(record, 'execution_manifest_digest', 'execution_manifest_id');
  if (record.execution_manifest_digest !== identity.digest || record.execution_manifest_id !== identity.id) {
    fail('MANIFEST_IDENTITY_DRIFT', expectedWork);
  }
}

function validateWork3EntryCorrection(root, manifest) {
  if (!Array.isArray(manifest.permitted_read_paths)
      || !manifest.permitted_read_paths.includes(WORK3_ENTRY_CORRECTION_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'Work3 entry correction authority read');
  }
  const binding = manifest.work3_entry_correction_authority_binding;
  if (!same(binding, WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING)) {
    fail('AUTHORITY_BINDING_DRIFT', WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
  }
  const { record, bytes } = validateRecordBinding(
    root,
    binding,
    'AUTHORITY_BINDING_DRIFT',
  );
  const unsigned = clone(record);
  delete unsigned.correction_authority_id;
  if (record.schema_version !== WORK3_ENTRY_CORRECTION_AUTHORITY_SCHEMA
      || record.correction_authority_id
        !== WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING.record_id
      || record.correction_authority_id
        !== contentId(WORK3_ENTRY_CORRECTION_AUTHORITY_SCHEMA, unsigned)
      || record.stage !== 'M7_V2_REPAIR_WORK3_ENTRY_CORRECTION'
      || record.authority_state
        !== 'BEN_AUTHORISED_WORK3_ENTRY_AND_SUCCESSOR_SNAPSHOT_CORRECTION'
      || record.approved_on !== '2026-08-15'
      || record.approver !== 'BEN_GOODCHILD'
      || record.ben_approval_id !== 'BEN-M7-V2-WORK3-ENTRY-CORRECTION-20260815'
      || record.approval_text !== WORK2_ENTRY_CORRECTION_APPROVAL
      || bytes.length !== WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING.byte_length
      || sha256Hex(bytes) !== WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING.sha256
      || gitBlobOid(bytes) !== WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING.git_blob_oid) {
    fail('AUTHORITY_BINDING_DRIFT', WORK3_ENTRY_CORRECTION_AUTHORITY_PATH);
  }
  return record;
}

function expectedWork3Manifest(correctionAuthority, correctionAuthorityBinding) {
  const contract = correctionAuthority.work3_scope_contract?.work3_manifest_contract;
  if (!contract || !Array.isArray(contract.exact_keys)) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work3 manifest contract');
  }
  const body = {};
  for (const key of contract.exact_keys) {
    if (key === 'execution_manifest_id' || key === 'execution_manifest_digest') continue;
    if (key === WORK3_ENTRY_MANIFEST_MEMBER) {
      body[key] = clone(correctionAuthorityBinding);
    } else if (Object.hasOwn(contract, key)) {
      body[key] = clone(contract[key]);
    } else {
      fail('AUTHORITY_BINDING_DRIFT', `Work3 manifest contract member: ${key}`);
    }
  }
  const identity = restampedIdentity(
    body,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  return {
    ...body,
    execution_manifest_digest: identity.digest,
    execution_manifest_id: identity.id,
  };
}

function priorManifestPath(work, predecessorReceiptBinding, code) {
  const previousWork = `WORK${workNumber(work) - 1}`;
  if (previousWork === 'WORK4') {
    // Work5 resolves its Work4 predecessor by receipt schema, as Work4 does
    // for Work3: V1 is the committed manifest, V2 the correction successor.
    if (predecessorReceiptBinding?.schema_version === WORK4_RECEIPT_V1_SCHEMA) {
      return executionManifestPath(previousWork);
    }
    if (predecessorReceiptBinding?.schema_version === WORK4_RECEIPT_V2_SCHEMA) {
      return WORK4_SUCCESSOR_MANIFEST_PATH;
    }
    fail(code, 'Work4 predecessor receipt schema');
  }
  if (previousWork !== 'WORK3') return executionManifestPath(previousWork);
  if (predecessorReceiptBinding?.schema_version === RICH_WORK3_RECEIPT_SCHEMA) {
    return executionManifestPath(previousWork);
  }
  if (predecessorReceiptBinding?.schema_version === RICH_WORK3_RECEIPT_V2_SCHEMA) {
    return WORK3_CLOSURE_SUCCESSOR_PATH;
  }
  fail(code, 'Work3 predecessor receipt schema');
}

function readPriorManifest(root, authority, work, predecessorReceiptBinding) {
  const previousWork = `WORK${workNumber(work) - 1}`;
  const repositoryPath = priorManifestPath(
    work,
    predecessorReceiptBinding,
    'PREDECESSOR_BINDING_DRIFT',
  );
  const bytes = readSafe(root, repositoryPath);
  const record = parseCanonical(bytes, 'PREDECESSOR_BINDING_DRIFT', repositoryPath);
  if (repositoryPath === WORK3_CLOSURE_SUCCESSOR_PATH) {
    validateWork3ClosureSuccessor(root, repositoryPath);
  } else if (repositoryPath === WORK4_SUCCESSOR_MANIFEST_PATH) {
    validateManifestIdentity(
      record, authority.per_work_execution_manifest_policy, previousWork, true,
    );
    validateWork4CandidateCorrection(root, record);
  } else {
    validateManifestIdentity(record, authority.per_work_execution_manifest_policy, previousWork);
  }
  return { record, bytes, repositoryPath };
}

function work4TransitionAuthorityPath(work4Correction) {
  return work4Correction
    ? WORK4_SUCCESSOR_TRANSITION_AUTHORITY_PATH
    : WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH;
}

function work4TransitionArgv(work4Correction) {
  return work4Correction ? WORK4_CORRECTION_TRANSITION_ARGV : WORK4_CANDIDATE_TRANSITION_ARGV;
}

function work4ManifestPath(work4Correction) {
  return work4Correction ? WORK4_SUCCESSOR_MANIFEST_PATH : executionManifestPath('WORK4');
}

// The pinned Work4 candidate-correction authority: exact bytes, exact record,
// Ben's approval, the four superseded output bindings and the successor paths.
function validateWork4CandidateCorrection(root, manifest) {
  const binding = manifest[WORK4_CORRECTION_MANIFEST_MEMBER];
  if (!same(binding, WORK4_CORRECTION_AUTHORITY_BINDING)) {
    fail('AUTHORITY_BINDING_DRIFT', WORK4_CORRECTION_AUTHORITY_PATH);
  }
  if (!manifest.permitted_read_paths.includes(WORK4_CORRECTION_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'Work4 correction authority read');
  }
  const { record, bytes } = validateRecordBinding(root, binding, 'AUTHORITY_BINDING_DRIFT');
  if (bytes.length !== WORK4_CORRECTION_AUTHORITY_BINDING.byte_length
      || sha256Hex(bytes) !== WORK4_CORRECTION_AUTHORITY_BINDING.sha256
      || gitBlobOid(bytes) !== WORK4_CORRECTION_AUTHORITY_BINDING.git_blob_oid
      || !exactKeys(record, WORK4_CORRECTION_AUTHORITY_KEYS)
      || record.schema_version !== WORK4_CORRECTION_AUTHORITY_SCHEMA
      || record.correction_authority_id !== WORK4_CORRECTION_AUTHORITY_BINDING.record_id
      || record.stage !== 'M7_V2_REPAIR_WORK4_CANDIDATE_CORRECTION'
      || record.authority_state !== 'BEN_AUTHORISED_SINGLE_PRE_WORK5_WORK4_CANDIDATE_CORRECTION'
      || record.approved_on !== '2026-09-03'
      || record.approver !== 'BEN_GOODCHILD'
      || record.ben_approval_id !== 'BEN-M7-V2-WORK4-CANDIDATE-CORRECTION-20260903'
      || record.approval_text !== WORK4_CORRECTION_APPROVAL
      || record.superseded_candidate_registration_id !== WORK4_SUPERSEDED_REGISTRATION_ID
      || !same(record.successor_paths, {
        candidate_registration_root: CANDIDATE_ROOT,
        candidate_transition_authority: WORK4_SUCCESSOR_TRANSITION_AUTHORITY_PATH,
        execution_manifest: WORK4_SUCCESSOR_MANIFEST_PATH,
        work4_receipt: WORK4_SUCCESSOR_RECEIPT_PATH,
      })
      || record.successor_manifest_member !== WORK4_CORRECTION_MANIFEST_MEMBER
      || record.successor_manifest_schema !== SCHEMA
      || record.successor_receipt_schema !== WORK4_RECEIPT_V2_SCHEMA
      || !same(record.successor_receipt_additional_members, WORK4_RECEIPT_V2_ADDITIONAL_KEYS)
      || !same(record.successor_transition_argv, WORK4_CORRECTION_TRANSITION_ARGV)
      || !same(record.successor_bootstrap_argv, [
        'node', WORK4_CANDIDATE_TRANSITION_PATH, '--bootstrap', '--authority',
        WORK4_CORRECTION_AUTHORITY_PATH,
      ])
      || record.superseded_outputs_disposition
        !== 'RETAINED_IMMUTABLE_NEVER_DELETED_NEVER_CONSUMED_BY_WORK5_7'
      || !same(record.parent_authority_binding, manifest.parent_authority_binding)
      || !same(record.activation_receipt_binding, manifest.activation_receipt_binding)
      || !same(record.candidate_ordering_correction_authority_binding,
        manifest.candidate_ordering_correction_authority_binding)
      || record.allowed_effects?.model_calls !== 0
      || record.allowed_effects?.network_writes !== 0
      || record.allowed_effects?.product_writes !== 0) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work4 candidate correction authority contract');
  }
  validateContentIdOnly(
    record, 'correction_authority_id', 'AUTHORITY_BINDING_DRIFT',
    WORK4_CORRECTION_AUTHORITY_PATH,
  );
  const superseded = record.superseded_work4_outputs;
  const expectedSupersededPaths = {
    candidate_registration_binding: `${CANDIDATE_ROOT}/${WORK4_SUPERSEDED_REGISTRATION_ID}.json`,
    candidate_transition_authority_binding: WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
    execution_manifest_binding: executionManifestPath('WORK4'),
    work4_receipt_binding: WORK4_RECEIPT_PATH,
  };
  if (!exactKeys(superseded, Object.keys(expectedSupersededPaths))) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work4 superseded outputs');
  }
  // Every superseded output must still exist byte-identical: retained,
  // never deleted, never replaced.
  for (const [member, repositoryPath] of Object.entries(expectedSupersededPaths)) {
    const supersededBinding = superseded[member];
    if (recordBindingIsInvalid(supersededBinding) || supersededBinding.path !== repositoryPath) {
      fail('AUTHORITY_BINDING_DRIFT', `Work4 superseded ${member}`);
    }
    validateRecordBinding(root, supersededBinding, 'AUTHORITY_BINDING_DRIFT');
  }
  if (superseded.candidate_registration_binding.record_id !== WORK4_SUPERSEDED_REGISTRATION_ID
      || superseded.work4_receipt_binding.schema_version !== WORK4_RECEIPT_V1_SCHEMA) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work4 superseded identities');
  }
  return { record, binding };
}

function isSortedUnique(values) {
  return Array.isArray(values) && values.length > 0
    && values.every((value) => typeof value === 'string')
    && same(values, [...new Set(values)].sort());
}

function uniqueStrings(values) {
  return Array.isArray(values) && values.length > 0
    && values.every((value) => typeof value === 'string' && value.length > 0)
    && new Set(values).size === values.length;
}

// Every command a replacement phase names must run only files that phase
// itself names: one of its own entrypoints, one of its own tests, or this
// validator against that phase's own successor manifest. Run limits are
// positive counts. No count here is a literal: the rosters come from the
// record and are cross-checked against their own Set sizes.
// The one place a correction record can widen this roster: EXACT_ARGV_
// REGISTRATION_FLAG lets a phase's run entrypoint name a candidate
// registration. `acceptsCandidateRegistrationArgvToken` answers false for
// every token while the correction is absent or PENDING_BEN, so a pending
// record leaves the authority's committed argv rosters exactly as closed as
// they were.
function validateCandidateReplacementArgv(phase, correction = null) {
  const entries = phase.exact_argv_with_run_limits;
  const allowedScripts = new Set([...phase.entrypoints, VALIDATOR_PATH]);
  const allowedTests = new Set(phase.tests);
  const allowedRecords = new Set([phase.successor_manifest_path]);
  if (!Array.isArray(entries) || entries.length === 0) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement argv');
  }
  const named = new Set();
  for (const entry of entries) {
    if (!exactKeys(entry, ['argv', 'max_runs'])
        || !Array.isArray(entry.argv) || entry.argv.length < 2
        || !entry.argv.every(safeToken)
        || entry.argv[0] !== 'node'
        || !Number.isSafeInteger(entry.max_runs) || entry.max_runs <= 0) {
      fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement argv');
    }
    for (const token of entry.argv.slice(1)) {
      if (token.startsWith('--')) continue;
      let allowed = allowedRecords;
      if (token.endsWith('.mjs')) allowed = allowedScripts;
      else if (token.endsWith('.test.js')) allowed = allowedTests;
      if (!allowed.has(token)) {
        if (!acceptsCandidateRegistrationArgvToken(token, correction)) {
          fail('AUTHORITY_BINDING_DRIFT', token);
        }
        continue;
      }
      named.add(token);
    }
  }
  if (![...phase.entrypoints, ...phase.tests].every((token) => named.has(token))) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement argv coverage');
  }
}

function validateCandidateReplacementPhases(record, correction = null) {
  const phases = record.phases;
  if (!Array.isArray(phases)
      || !same(phases.map((phase) => phase?.phase_key), CANDIDATE_REPLACEMENT_PHASE_KEYS)
      || new Set(phases.map((phase) => phase.successor_manifest_path)).size !== phases.length) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement phases');
  }
  for (const phase of phases) {
    if (!exactKeys(phase, CANDIDATE_REPLACEMENT_PHASE_KEYS_MEMBERS)
        || !WORKS.includes(phase.work)
        || phase.phase_key !== `${phase.work}_REAL_TEXT_SUCCESSOR`
        || phase.successor_manifest_schema !== SCHEMA
        || phase.successor_manifest_member !== CANDIDATE_REPLACEMENT_MANIFEST_MEMBER
        || phase.interim_registration_required_before_evidence !== true
        || !uniqueStrings(phase.entrypoints)
        || !phase.entrypoints.every((entrypoint) => entrypoint.startsWith('scripts/')
          && entrypoint.endsWith('.mjs'))
        || !uniqueStrings(phase.tests)
        || !phase.tests.every((test) => test.startsWith('tests/') && test.endsWith('.test.js'))) {
      fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement phase contract');
    }
    for (const repositoryPath of [
      phase.successor_manifest_path, phase.successor_receipt_path,
      ...phase.entrypoints, ...phase.tests,
    ]) {
      normaliseRepositoryPath(repositoryPath, 'AUTHORITY_BINDING_DRIFT');
    }
    validateCandidateReplacementArgv(phase, correction);
  }
}

function validateCandidateReplacementWriteRules(record) {
  const exceptions = record.work1_write_exceptions;
  const extensions = record.immutable_prefix_extensions;
  if (!uniqueStrings(exceptions) || !uniqueStrings(extensions)) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement write rules');
  }
  for (const repositoryPath of exceptions) {
    normaliseRepositoryPath(repositoryPath, 'AUTHORITY_BINDING_DRIFT');
  }
  for (const prefix of extensions) {
    if (!prefix.endsWith('/')) fail('AUTHORITY_BINDING_DRIFT', prefix);
    normaliseRepositoryPath(prefix.slice(0, -1), 'AUTHORITY_BINDING_DRIFT');
  }
}

// The pinned candidate replacement authority: exact bytes, exact record, Ben's
// approval, the parent and Work 4 correction bindings unchanged, the stop
// record's affected classes and superseded registrations, three real-text
// phases, and every prohibition at zero.
function validateCandidateReplacementRecord(
  record, bytes, authority, authorityBytes, correction = null,
) {
  const stop = record.stop_record;
  const affected = stop?.affected_classes;
  const familyKeys = Array.isArray(affected) ? affected.map((entry) => entry?.family_key) : [];
  const superseded = record.superseded_candidate_registration_ids;
  if (bytes.length !== CANDIDATE_REPLACEMENT_AUTHORITY_BINDING.byte_length
      || sha256Hex(bytes) !== CANDIDATE_REPLACEMENT_AUTHORITY_BINDING.sha256
      || gitBlobOid(bytes) !== CANDIDATE_REPLACEMENT_AUTHORITY_BINDING.git_blob_oid
      || !exactKeys(record, CANDIDATE_REPLACEMENT_AUTHORITY_KEYS)
      || record.schema_version !== CANDIDATE_REPLACEMENT_AUTHORITY_SCHEMA
      || record.replacement_authority_id !== CANDIDATE_REPLACEMENT_AUTHORITY_BINDING.record_id
      || record.stage !== CANDIDATE_REPLACEMENT_STAGE
      || record.authority_state !== CANDIDATE_REPLACEMENT_AUTHORITY_STATE
      || record.approved_on !== '2026-09-03'
      || record.approver !== 'BEN_GOODCHILD'
      || record.ben_approval_id !== 'BEN-M7-V2-CANDIDATE-REPLACEMENT-20260903'
      || record.approval_text !== CANDIDATE_REPLACEMENT_APPROVAL
      || record.retained_outputs_disposition
        !== 'RETAINED_IMMUTABLE_NEVER_DELETED_NEVER_CONSUMED_BY_WORK5_7'
      || !same(record.parent_authority_binding,
        expectedAuthorityBinding(authority, authorityBytes))
      || !same(record.work4_candidate_correction_authority_binding,
        WORK4_CORRECTION_AUTHORITY_BINDING)
      || stop?.stop_class !== 'FALSE_COMPLETE_FIXTURE'
      || stop.stopped_candidate_registration_id
        !== CANDIDATE_REPLACEMENT_STOPPED_REGISTRATION_ID
      || recordBindingIsInvalid(stop.stopped_candidate_registration_binding)
      || stop.stopped_candidate_registration_binding.record_id
        !== stop.stopped_candidate_registration_id
      || !Array.isArray(affected) || affected.length === 0
      || familyKeys.some((key) => typeof key !== 'string' || key.length === 0)
      || new Set(familyKeys).size !== affected.length
      || !uniqueStrings(superseded)
      || !superseded.every((id) => HASH_64.test(id))
      || !superseded.includes(stop.stopped_candidate_registration_id)
      || record.allowed_effects?.model_calls !== 0
      || record.allowed_effects?.network_writes !== 0
      || record.allowed_effects?.product_writes !== 0
      || record.allowed_effects?.database_writes !== 0
      || !isPlainObject(record.prohibited_effects)
      || Object.values(record.prohibited_effects).some((value) => value !== 0)) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement authority contract');
  }
  validateCandidateReplacementPhases(record, correction);
  validateCandidateReplacementWriteRules(record);
  // No restamp check here, unlike every sibling authority: this record's
  // `replacement_authority_id` is not a content id over its own body
  // (contentId('STAGE_2Y_M7_V2_REPAIR_CANDIDATE_REPLACEMENT_AUTHORITY/V1',
  // record minus the id) is 0ac3b685..., the record carries 93d67c6e...),
  // so `validateContentIdOnly` would reject the authority as committed. Its
  // identity is instead pinned exactly and more strongly, by the byte length,
  // SHA-256, Git blob OID and record id in
  // CANDIDATE_REPLACEMENT_AUTHORITY_BINDING: no other bytes can satisfy it.
}

// The correction record beside the authority is optional in the same way, and
// recognised whether or not it is in force: absent is null, PENDING_BEN is a
// record that applies nothing and is reported once per run as an INFO line,
// BEN_APPROVED with an approval id applies its corrections. A record whose
// binding does not match the authority's bytes is AUTHORITY_BINDING_DRIFT, and
// the module's own error code is carried through so the CLI reports it.
function readAuthorityCorrection(root) {
  try {
    return loadAuthorityCorrection({ repoRoot: root });
  } catch (error) {
    return fail(error.code ?? 'AUTHORITY_BINDING_DRIFT', error.message);
  }
}

// The authority is optional: a tree that predates it has no superseded
// registration, no immutable prefix extension and no successor manifest, and
// every manifest validates exactly as before. When the file is present it must
// be the exact pinned record, whichever manifest is under validation.
function readCandidateReplacementAuthority(root, authority, authorityBytes, correction) {
  const absolute = inspectSafePath(root, CANDIDATE_REPLACEMENT_AUTHORITY_PATH, false);
  let present;
  try {
    present = lstatSync(absolute).isFile();
  } catch {
    present = false;
  }
  if (!present) return null;
  const { record, bytes } = validateRecordBinding(
    root, CANDIDATE_REPLACEMENT_AUTHORITY_BINDING, 'AUTHORITY_BINDING_DRIFT',
  );
  validateCandidateReplacementRecord(record, bytes, authority, authorityBytes, correction);
  return { record, bytes, binding: CANDIDATE_REPLACEMENT_AUTHORITY_BINDING };
}

// A successor manifest carries the replacement authority as a second,
// dedicated binding member; its parent binding stays mandatory and unchanged.
export function validateCandidateReplacement(manifest, manifestPath, context) {
  const { root, authority, authorityBytes } = context;
  const correction = context.correction ?? null;
  const binding = manifest[CANDIDATE_REPLACEMENT_MANIFEST_MEMBER];
  if (!same(binding, CANDIDATE_REPLACEMENT_AUTHORITY_BINDING)) {
    fail('AUTHORITY_BINDING_DRIFT', CANDIDATE_REPLACEMENT_AUTHORITY_PATH);
  }
  if (!Array.isArray(manifest.permitted_read_paths)
      || !manifest.permitted_read_paths.includes(CANDIDATE_REPLACEMENT_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'candidate replacement authority read');
  }
  const { record, bytes } = validateRecordBinding(root, binding, 'AUTHORITY_BINDING_DRIFT');
  validateCandidateReplacementRecord(record, bytes, authority, authorityBytes, correction);
  const phase = record.phases.find(
    (entry) => entry.successor_manifest_path === manifestPath,
  );
  if (phase === undefined || phase.work !== manifest.work) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate replacement phase selection');
  }
  return { record, binding, phase };
}

function underPrefix(repositoryPath, prefix) {
  const normalised = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return repositoryPath === prefix.replace(/\/$/, '') || repositoryPath.startsWith(normalised);
}

function validateReadPaths(root, authority, manifestPath, manifest, priorPath) {
  const paths = manifest.permitted_read_paths;
  if (!isSortedUnique(paths)) fail('PATH_SCOPE_DRIFT', 'permitted_read_paths');
  const prefixes = authority.permitted_reads.repository_relative_prefixes;
  for (const repositoryPath of paths) {
    normaliseRepositoryPath(repositoryPath, 'PATH_SCOPE_DRIFT');
    if (!prefixes.some((prefix) => underPrefix(repositoryPath, prefix))) {
      fail('PATH_SCOPE_DRIFT', repositoryPath);
    }
  }
  if (typeof manifest.predecessor_receipt_binding?.path !== 'string') {
    fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  }
  const required = [
    manifestPath,
    AUTHORITY_PATH,
    ACTIVATION_PATH,
    manifest.predecessor_receipt_binding.path,
  ];
  if (priorPath) required.push(priorPath);
  if (manifest.candidate_registration_binding) {
    required.push(manifest.candidate_registration_binding.registration_binding?.path);
  }
  if (required.some((repositoryPath) => !paths.includes(repositoryPath))) {
    fail('PATH_SCOPE_DRIFT', 'required read binding absent');
  }
  for (const repositoryPath of paths) {
    inspectSafePath(root, repositoryPath, true);
  }
}

function matchesFileRule(repositoryPath, rule) {
  if (path.posix.dirname(repositoryPath) !== rule.directory) return false;
  const filename = path.posix.basename(repositoryPath);
  if (!filename.startsWith(rule.prefix)) return false;
  return new RegExp(rule.suffix_pattern).test(filename.slice(rule.prefix.length));
}

function parentAllowsWrite(authority, repositoryPath) {
  const policy = authority.permitted_writes;
  return policy.exact_paths.includes(repositoryPath)
    || policy.creation_only_exact_paths.includes(repositoryPath)
    || policy.file_prefix_rules.some((rule) => matchesFileRule(repositoryPath, rule))
    || policy.repository_relative_prefixes.some((prefix) => underPrefix(repositoryPath, prefix));
}

function validateWritePaths(
  root, authority, manifestPath, manifest, authorisedWork1WriteExceptions,
  authorisedParentWriteExtensions, candidateStageState, work4Correction = false,
  immutablePrefixExtensions = [],
) {
  const WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH = work4TransitionAuthorityPath(work4Correction);
  const paths = manifest.permitted_write_paths;
  if (!isSortedUnique(paths)) fail('PATH_SCOPE_DRIFT', 'permitted_write_paths');
  // An extension only ever narrows what may be written, so it applies to every
  // manifest, not only the replacement-bound ones: that closes the window in
  // which a Work 1-7 manifest could still write under the additive three
  // comparison entry-correction directories.
  const immutablePrefixes = [...authority.immutable_prefixes, ...immutablePrefixExtensions];
  const immutablePaths = new Set(authority.immutable_paths);
  const work1Paths = new Set(authority.command_policy.work1_exact_changed_paths);
  const allManifestPaths = new Set(authority.per_work_execution_manifest_policy.exact_paths);
  const number = workNumber(manifest.work);
  const candidateWritePaths = paths.filter((repositoryPath) => underPrefix(
    repositoryPath,
    CANDIDATE_ROOT,
  ));
  const selectedCandidatePath =
    manifest.candidate_registration_binding?.registration_binding?.path ?? null;
  const expectedCandidateWritePaths = candidateStageState === 'WORK4_TRANSITION_PENDING'
    ? candidateWritePaths
    : number === 4 && candidateStageState === 'VERIFIED_CANDIDATE_BOUND'
      ? [selectedCandidatePath]
      : [];
  if (candidateWritePaths.length > 1
      || (candidateStageState === 'WORK4_TRANSITION_PENDING'
        && candidateWritePaths.length !== 1)
      || !same(candidateWritePaths, expectedCandidateWritePaths)) {
    fail('PATH_SCOPE_DRIFT', 'candidate registration write phase');
  }
  if (number === 4 && !paths.includes(WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'Work4 candidate transition authority write');
  }
  if (candidateStageState === 'WORK4_TRANSITION_PENDING'
      && !same(paths, [
        WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
        candidateWritePaths[0],
      ].sort())) {
    fail('PATH_SCOPE_DRIFT', 'Work4 bootstrap write scope');
  }
  for (const repositoryPath of paths) {
    normaliseRepositoryPath(repositoryPath, 'PATH_SCOPE_DRIFT');
    const absolute = inspectSafePath(root, repositoryPath, false);
    if (repositoryPath === 'docs/core/PLAN.md'
        || repositoryPath === 'docs/core/OPERATING-RULES.md') {
      fail('PATH_SCOPE_DRIFT', 'core document region cannot be represented by this manifest');
    }
    if (underPrefix(repositoryPath, CANDIDATE_ROOT)) {
      if (!new RegExp(`^${CANDIDATE_ROOT}/[0-9a-f]{64}\\.json$`).test(repositoryPath)) {
        fail('PATH_SCOPE_DRIFT', repositoryPath);
      }
      if (candidateStageState === 'VERIFIED_CANDIDATE_BOUND') {
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink() || !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
      } else {
        try {
          lstatSync(absolute);
          fail('WRITE_ONCE_DRIFT', repositoryPath);
        } catch (error) {
          if (error instanceof WorkExecutionManifestValidationError) throw error;
          if (error.code !== 'ENOENT') fail('PATH_SAFETY', repositoryPath);
        }
      }
    }
    if (repositoryPath === WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH) {
      if (candidateStageState === 'VERIFIED_CANDIDATE_BOUND') {
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink() || !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
      } else if (candidateStageState === 'WORK4_TRANSITION_PENDING') {
        try {
          lstatSync(absolute);
          fail('WRITE_ONCE_DRIFT', repositoryPath);
        } catch (error) {
          if (error instanceof WorkExecutionManifestValidationError) throw error;
          if (error.code !== 'ENOENT') fail('PATH_SAFETY', repositoryPath);
        }
      }
    }
    if (allManifestPaths.has(repositoryPath)) fail('WRITE_ONCE_DRIFT', repositoryPath);
    if (!(parentAllowsWrite(authority, repositoryPath)
        || authorisedParentWriteExtensions.has(repositoryPath))
      || immutablePaths.has(repositoryPath)
      || immutablePrefixes.some((prefix) => repositoryPath.startsWith(prefix))
      || (work1Paths.has(repositoryPath)
        && !authorisedWork1WriteExceptions.has(repositoryPath))
      || /(?:^|[/_-])m8(?:[/_.-]|$)/i.test(repositoryPath)) {
      fail('PATH_SCOPE_DRIFT', repositoryPath);
    }
    const referencedWork = /m7-v2-repair-work([1-7])(?:-|\.)/.exec(repositoryPath)?.[1];
    if (referencedWork && Number(referencedWork) !== number) fail('PATH_SCOPE_DRIFT', repositoryPath);
  }
  if (paths.includes(manifestPath)) fail('WRITE_ONCE_DRIFT', manifestPath);
  const receiptPattern = new RegExp(`^evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work${number}-[a-z0-9-]+\\.json$`);
  if (candidateStageState !== 'WORK4_TRANSITION_PENDING'
    && (!receiptPattern.test(manifest.work_receipt_path)
      || !paths.includes(manifest.work_receipt_path))) {
    fail('PATH_SCOPE_DRIFT', 'work_receipt_path');
  }
}

function safeToken(token) {
  return typeof token === 'string' && token.length > 0
    && !/[\0\r\n`$;&|<>*?\[\]{}]/.test(token);
}

function pathIsInScope(repositoryPath, manifest) {
  return manifest.permitted_read_paths.includes(repositoryPath)
    || manifest.permitted_write_paths.includes(repositoryPath);
}

function boundGitObjects(authority, manifest) {
  return new Set([
    authority.base_commit,
    ACTIVATION_COMMIT,
    manifest.base_tip_binding.commit,
    manifest.base_tip_binding.parent_commit,
    manifest.activation_receipt_binding.git_blob_oid,
    manifest.predecessor_receipt_binding.git_blob_oid,
    manifest.candidate_registration_binding?.registration_binding?.git_blob_oid,
  ].filter(Boolean));
}

function validateGitReadArgv(argv, authority, manifest) {
  const boundObjects = boundGitObjects(authority, manifest);
  const exact = (...tokens) => same(argv, ['git', ...tokens]);
  if (exact('status', '--short', '--branch')
    || exact('diff', '--check')
    || exact('diff', '--cached', '--name-only')
    || exact('rev-parse', 'HEAD')
    || exact('rev-parse', '--show-toplevel')
    || exact('rev-parse', '--git-common-dir')
    || exact('rev-parse', `refs/remotes/origin/${BRANCH}`)) return true;
  if (argv[1] === 'rev-list' && same(argv.slice(2, 5), ['--parents', '-n', '1'])
    && argv.length === 6 && boundObjects.has(argv[5])) return true;
  if (argv[1] === 'cat-file' && argv.length === 4
    && ['-p', '-s', '-t'].includes(argv[2]) && boundObjects.has(argv[3])) return true;
  if (argv[1] === 'diff-tree' && argv.length === 6
    && same(argv.slice(2, 5), ['--no-commit-id', '--name-only', '-r'])
    && boundObjects.has(argv[5])) return true;
  if (argv[1] === 'hash-object' && argv.length === 4 && argv[2] === '--') {
    return pathIsInScope(argv[3], manifest);
  }
  if (argv[1] === 'show' && argv.length === 3) {
    const match = /^([0-9a-f]{40}):(.+)$/.exec(argv[2]);
    return Boolean(match && boundObjects.has(match[1]) && pathIsInScope(match[2], manifest));
  }
  if (argv[1] === 'ls-files' && argv.length === 5
    && same(argv.slice(2, 4), ['-s', '--'])) return pathIsInScope(argv[4], manifest);
  if (argv[1] === 'ls-tree' && argv.length >= 5
    && same(argv.slice(2, 4), ['-r', '--full-tree']) && boundObjects.has(argv[4])) {
    return argv.length === 5 || (argv.length === 7 && argv[5] === '--' && pathIsInScope(argv[6], manifest));
  }
  if (argv[1] === 'diff' && argv[2] === '--name-only' && boundObjects.has(argv[3])) {
    return argv.length === 4 || (argv[4] === '--'
      && argv.slice(5).length > 0 && argv.slice(5).every((item) => pathIsInScope(item, manifest)));
  }
  if (argv[1] === 'log' && argv.length === 6 && /^--format=/.test(argv[2])
    && argv[3] === '-n' && /^[1-9][0-9]*$/.test(argv[4]) && boundObjects.has(argv[5])) return true;
  return false;
}

function validateRunArgv(
  argv, authority, manifest, authorisedCommandExtensions,
  candidateReplacementManifestPath = null,
) {
  if (!Array.isArray(argv) || argv.length < 2 || !argv.every(safeToken)) return false;
  if (authorisedCommandExtensions.some((entry) => same(entry.argv, argv))) {
    if (same(argv, WORK4_CANDIDATE_TRANSITION_ARGV)
        || same(argv, WORK4_CORRECTION_TRANSITION_ARGV)) {
      return pathIsInScope(argv[1], manifest) && pathIsInScope(argv[3], manifest);
    }
    const repositoryPaths = argv[1] === '--test'
      ? argv.slice(2).filter((token) => !token.startsWith('--'))
      : argv.slice(2);
    return repositoryPaths.length > 0
      && repositoryPaths.every((repositoryPath) => pathIsInScope(repositoryPath, manifest));
  }
  if (same(argv, ['node', VALIDATOR_PATH, executionManifestPath(manifest.work)])) return true;
  if (manifest.work === 'WORK4'
      && manifest[WORK4_CORRECTION_MANIFEST_MEMBER] !== undefined
      && same(argv, ['node', VALIDATOR_PATH, WORK4_SUCCESSOR_MANIFEST_PATH])) {
    return true;
  }
  // A successor manifest the replacement authority names validates itself, and
  // its own path is not one the parent's per-work policy contains. The
  // allowance is exactly the manifest under validation, and only while it
  // carries the replacement binding, so no other manifest can name it.
  if (candidateReplacementManifestPath !== null
      && same(argv, ['node', VALIDATOR_PATH, candidateReplacementManifestPath])) {
    return true;
  }
  if (argv[0] === 'node' && argv[1] === '--check' && argv.length === 3) {
    return /\.(?:js|mjs)$/.test(argv[2]) && pathIsInScope(argv[2], manifest);
  }
  if (argv[0] === 'node' && argv[1] === '--test' && argv.length >= 3) {
    return argv.slice(2).every((repositoryPath) => authority.command_policy.later_work_tests.includes(repositoryPath)
      && repositoryPath.includes(`work${workNumber(manifest.work)}.test.js`)
      && pathIsInScope(repositoryPath, manifest));
  }
  if (argv[0] === 'node' && argv.length === 2) {
    return authority.command_policy.later_work_entrypoints.includes(argv[1])
      && (argv[1].includes(`work${workNumber(manifest.work)}-`)
        || [
          'scripts/stage-2y-structure-family-aggregate.mjs',
          'scripts/stage-2y-structure-m6-project.mjs',
          'scripts/stage-2y-structure-generalisation-shadow.mjs',
        ].includes(argv[1]))
      && pathIsInScope(argv[1], manifest);
  }
  return argv[0] === 'git' && validateGitReadArgv(argv, authority, manifest);
}

function validateCommands(
  authority, manifestPath, manifest, authorisedCommandExtensions,
  candidateReplacementManifestPath = null,
) {
  const entries = manifest.exact_argv_with_run_limits;
  if (!Array.isArray(entries) || entries.length === 0
    || entries.some((entry) => !exactKeys(entry, RUN_KEYS)
      || !Number.isSafeInteger(entry.max_runs) || entry.max_runs <= 0
      || !validateRunArgv(
        entry.argv, authority, manifest, authorisedCommandExtensions,
        candidateReplacementManifestPath,
      ))) {
    fail('COMMAND_SCOPE_DRIFT', 'exact_argv_with_run_limits');
  }
  if (!same(entries[0].argv, ['node', VALIDATOR_PATH, manifestPath])) {
    fail('COMMAND_SCOPE_DRIFT', 'manifest validator must be first');
  }
  const serialised = entries.map((entry) => canonicalJson(entry.argv));
  if (new Set(serialised).size !== serialised.length) fail('COMMAND_SCOPE_DRIFT', 'duplicate argv');
  if (authorisedCommandExtensions.some((required) => !entries.some((entry) => same(entry, required)))) {
    fail('COMMAND_SCOPE_DRIFT', 'required Work2 correction command');
  }
  const commands = manifest.exact_git_commit_and_push_argv;
  if (!Array.isArray(commands) || commands.length !== 3
    || commands.some((argv) => !Array.isArray(argv) || !argv.every(safeToken))) {
    fail('COMMAND_SCOPE_DRIFT', 'git commands');
  }
  const expectedAddPaths = [manifestPath, ...manifest.permitted_write_paths].sort();
  if (!same(commands[0], ['git', 'add', '--', ...expectedAddPaths])
    || commands[1].length !== 4 || !same(commands[1].slice(0, 3), ['git', 'commit', '-m'])
    || !commands[1][3].includes(`Work ${workNumber(manifest.work)}`)
    || !same(commands[2], ['git', 'push', 'origin', BRANCH])) {
    fail('COMMAND_SCOPE_DRIFT', 'commit and push');
  }
}

function validateAllowedEffects(parent, child, work) {
  if (!exactKeys(child, Object.keys(parent))) fail('EFFECT_SCOPE_DRIFT', 'allowed effect keys');
  for (const [key, parentValue] of Object.entries(parent)) {
    const childValue = child[key];
    if (key === 'repository_pushes') {
      if (!exactKeys(childValue, ['branch', 'maximum', 'remote'])
        || childValue.branch !== parentValue.branch || childValue.remote !== parentValue.remote
        || !Number.isSafeInteger(childValue.maximum) || childValue.maximum < 1
        || childValue.maximum > parentValue.maximum) fail('EFFECT_SCOPE_DRIFT', key);
    } else if (typeof parentValue === 'boolean') {
      if (typeof childValue !== 'boolean' || (childValue && !parentValue)) fail('EFFECT_SCOPE_DRIFT', key);
    } else if (typeof parentValue === 'number') {
      if (!Number.isSafeInteger(childValue) || childValue < 0 || childValue > parentValue) {
        fail('EFFECT_SCOPE_DRIFT', key);
      }
    } else {
      fail('EFFECT_SCOPE_DRIFT', key);
    }
  }
  if (child.local_commits !== 1 || child.repository_pushes.maximum !== 1
    || (child.lawyer_review_packet_writes && work !== 'WORK5')) {
    fail('EFFECT_SCOPE_DRIFT', 'work effect');
  }
}

function validateStopConditions(parent, child) {
  if (!exactKeys(child, Object.keys(parent))) fail('EFFECT_SCOPE_DRIFT', 'stop condition keys');
  for (const [scope, required] of Object.entries(parent)) {
    const actual = child[scope];
    if (!Array.isArray(actual) || actual.some((item) => typeof item !== 'string')
      || new Set(actual).size !== actual.length
      || required.some((item) => !actual.includes(item))) {
      fail('EFFECT_SCOPE_DRIFT', `stop conditions ${scope}`);
    }
  }
}

function validateSuccessConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0
    || new Set(conditions).size !== conditions.length
    || conditions.some((item) => typeof item !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(item))
    || !conditions.includes(DEFERRED_GIT_PROOF)) {
    fail('BASE_TIP_DRIFT', 'deferred Git proof');
  }
}

function validateWork3PathScope(root, manifest, correctionAuthority) {
  const scope = correctionAuthority.work3_scope_contract;
  const contract = scope.work3_manifest_contract;
  const sourcePaths = correctionAuthority.source_precondition_bindings
    .map((binding) => binding.path);
  if (!isSortedUnique(scope.exact_work3_paths)
      || scope.exact_work3_paths.length !== 50
      || !same(scope.git_add_path_order, scope.exact_work3_paths)
      || !same(manifest.permitted_read_paths, scope.manifest_permitted_read_paths)
      || manifest.permitted_read_paths.length !== 94
      || !same(manifest.permitted_write_paths, scope.manifest_permitted_write_paths)
      || manifest.permitted_write_paths.length !== 49
      || !same(
        manifest.permitted_write_paths,
        scope.exact_work3_paths.filter(
          (repositoryPath) => repositoryPath !== scope.manifest_path,
        ),
      )
      || !same(
        manifest.exact_git_commit_and_push_argv?.[0],
        ['git', 'add', '--', ...scope.exact_work3_paths],
      )
      || !same(sourcePaths, correctionAuthority.work2_successor_snapshot
        ?.source_precondition_paths)
      || sourcePaths.length !== 11
      || !manifest.permitted_read_paths.includes(WORK3_ENTRY_CORRECTION_AUTHORITY_PATH)
      || !manifest.permitted_write_paths.includes(WORK3_ENTRY_CORRECTION_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'Work3 C3 P50/R94/W49 scope');
  }
  const outputs = scope.create_once_output_paths;
  if (!Array.isArray(outputs)
      || outputs.length !== 32
      || outputs.some((repositoryPath) => typeof repositoryPath !== 'string')
      || new Set(outputs).size !== outputs.length
      || scope.create_once_output_count !== 32
      || outputs.at(-1) !== manifest.work_receipt_path
      || !same(outputs, scope.rich_work3_receipt_contract?.create_once_output_paths)
      || !outputs.every((repositoryPath) =>
        manifest.permitted_write_paths.includes(repositoryPath))) {
    fail('PATH_SCOPE_DRIFT', 'Work3 create-once output scope');
  }
  for (const repositoryPath of manifest.permitted_write_paths) {
    inspectSafePath(root, repositoryPath, false);
  }
  for (const repositoryPath of outputs) {
    const absolute = inspectSafePath(root, repositoryPath, false);
    try {
      lstatSync(absolute);
      fail('WRITE_ONCE_DRIFT', repositoryPath);
    } catch (error) {
      if (error instanceof WorkExecutionManifestValidationError) throw error;
      if (error.code !== 'ENOENT') fail('PATH_SAFETY', repositoryPath);
    }
  }
}

function validateWork3BaseTip(manifest, priorManifest, predecessorReceipt, correctionAuthority) {
  const expected = correctionAuthority.work3_scope_contract
    .work3_manifest_contract.base_tip_binding;
  const effectiveWork2Paths = predecessorReceipt.repository_precondition
    ?.effective_work2_paths;
  const priorCommitArgv = priorManifest.exact_git_commit_and_push_argv?.[1];
  if (!same(manifest.base_tip_binding, expected)
      || !Array.isArray(effectiveWork2Paths)
      || new Set(effectiveWork2Paths).size !== effectiveWork2Paths.length
      || !same(expected.exact_commit_delta_paths, [...effectiveWork2Paths].sort())
      || expected.parent_commit !== priorManifest.base_tip_binding.commit
      || priorCommitArgv?.length !== 4
      || expected.commit_message !== priorCommitArgv[3]
      || expected.branch !== BRANCH
      || expected.origin_ref !== `refs/remotes/origin/${BRANCH}`) {
    fail('BASE_TIP_DRIFT', 'Work3 C3 base tip');
  }
}

function validateWork3Commands(manifest, correctionAuthority) {
  const contract = correctionAuthority.work3_scope_contract.work3_manifest_contract;
  const expectedCommands = correctionAuthority.execution_policy.work3_commands
    .map((entry) => ({
      argv: entry.argv,
      max_runs: entry.maximum_runs,
    }));
  if (expectedCommands.length !== 17
      || !same(manifest.exact_argv_with_run_limits, expectedCommands)
      || !same(manifest.exact_argv_with_run_limits, contract.exact_argv_with_run_limits)
      || !same(
        manifest.exact_git_commit_and_push_argv,
        correctionAuthority.execution_policy.exact_git_commit_and_push_argv,
      )
      || !same(
        manifest.exact_git_commit_and_push_argv,
        contract.exact_git_commit_and_push_argv,
      )) {
    fail('COMMAND_SCOPE_DRIFT', 'Work3 C3 commands');
  }
}

function validateWork3EffectsAndStops(manifest, correctionAuthority) {
  const scope = correctionAuthority.work3_scope_contract;
  const contract = scope.work3_manifest_contract;
  if (!same(manifest.allowed_effects, contract.allowed_effects)
      || !same(manifest.allowed_effects, correctionAuthority.execution_policy.allowed_effects)
      || manifest.allowed_effects.create_once_output_writes !== 32
      || manifest.allowed_effects.candidate_registration_writes !== 0
      || manifest.allowed_effects.semantic_runs !== 0
      || !same(manifest.prohibited_effects, contract.prohibited_effects)
      || !same(
        manifest.prohibited_effects,
        correctionAuthority.execution_policy.prohibited_effects,
      )
      || !same(manifest.stop_conditions, contract.stop_conditions)
      || !same(manifest.success_conditions, contract.success_conditions)
      || !same(
        manifest.success_conditions,
        correctionAuthority.execution_policy.success_conditions,
      )) {
    fail('EFFECT_SCOPE_DRIFT', 'Work3 C3 effects and stop conditions');
  }
}

function validateWork2EntryCorrection(root, authority, manifest, predecessorReceipt) {
  const parentPaths = authority.command_policy.exact_work1_commit_argv[0].slice(3);
  const repositoryPrecondition = predecessorReceipt.repository_precondition;
  const recovery = repositoryPrecondition?.recovery;
  if (!recovery) fail('PREDECESSOR_BINDING_DRIFT', 'recovered Work1 receipt required');
  if (!manifest.permitted_read_paths.includes(WORK2_ENTRY_CORRECTION_AUTHORITY_PATH)
      || !manifest.permitted_read_paths.includes(WORK1_CORRECTION_AUTHORITY_PATH)
      || !WORK2_ENTRY_AUTHORISED_WRITE_PATHS.every(
        (repositoryPath) => manifest.permitted_write_paths.includes(repositoryPath),
      )) {
    fail('PATH_SCOPE_DRIFT', 'Work2 entry correction paths');
  }
  if (WORK2_ENTRY_COMMAND_EXTENSIONS.some((entry) => entry.argv.slice(2).some(
    (repositoryPath) => !pathIsInScope(repositoryPath, manifest),
  ))) {
    fail('PATH_SCOPE_DRIFT', 'Work2 correction command path');
  }
  const bytes = readSafe(root, WORK2_ENTRY_CORRECTION_AUTHORITY_PATH);
  const correction = parseCanonical(
    bytes,
    'AUTHORITY_BINDING_DRIFT',
    WORK2_ENTRY_CORRECTION_AUTHORITY_PATH,
  );
  if (!exactKeys(correction, WORK2_ENTRY_CORRECTION_AUTHORITY_KEYS)
      || correction.schema_version !== WORK2_ENTRY_CORRECTION_AUTHORITY_SCHEMA
      || correction.stage !== 'M7_V2_REPAIR_WORK2_ENTRY_CORRECTION'
      || correction.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK2_ENTRY_CORRECTION'
      || correction.approved_on !== '2026-08-15'
      || correction.approver !== 'BEN_GOODCHILD'
      || correction.ben_approval_id !== 'BEN-M7-V2-WORK2-ENTRY-CORRECTION-20260815'
      || correction.approval_text !== WORK2_ENTRY_CORRECTION_APPROVAL
      || correction.correction_authority_id !== WORK2_ENTRY_CORRECTION_AUTHORITY_ID
      || bytes.length !== WORK2_ENTRY_CORRECTION_AUTHORITY_BYTE_LENGTH
      || sha256Hex(bytes) !== WORK2_ENTRY_CORRECTION_AUTHORITY_SHA256
      || gitBlobOid(bytes) !== WORK2_ENTRY_CORRECTION_AUTHORITY_GIT_BLOB_OID) {
    fail('AUTHORITY_BINDING_DRIFT', WORK2_ENTRY_CORRECTION_AUTHORITY_PATH);
  }
  validateContentIdOnly(
    correction,
    'correction_authority_id',
    'AUTHORITY_BINDING_DRIFT',
    WORK2_ENTRY_CORRECTION_AUTHORITY_PATH,
  );
  const requiredPaths = repositoryPrecondition?.required_commit_and_push?.commit_delta_paths;
  const expectedRecoveryArgv = ['git', 'add', '--', ...(requiredPaths ?? [])];
  if (!Array.isArray(requiredPaths)
      || requiredPaths.length !== 15
      || new Set(requiredPaths).size !== requiredPaths.length
      || !same(repositoryPrecondition.required_commit_and_push.exact_argv?.[0], expectedRecoveryArgv)
      || !same(repositoryPrecondition.observed_before_receipt?.authorised_delta_paths, requiredPaths)
      || !same(repositoryPrecondition.required_after_receipt?.worktree_delta_paths, requiredPaths)
      || !same(correction.required_work1_commit_delta_paths, requiredPaths)
      || !same(correction.exact_bootstrap_correction_paths, WORK2_ENTRY_BOOTSTRAP_PATHS)
      || !same(correction.authorised_work2_work1_write_exceptions,
        WORK2_ENTRY_WORK1_WRITE_EXCEPTIONS)
      || !same(correction.authorised_work2_parent_write_extensions,
        WORK2_ENTRY_PARENT_WRITE_EXTENSIONS)
      || !same(correction.authorised_work2_command_extensions,
        WORK2_ENTRY_COMMAND_EXTENSIONS)
      || !same(requiredPaths, [
        ...parentPaths,
        WORK1_CORRECTION_AUTHORITY_PATH,
        'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs',
      ])) {
    fail('PREDECESSOR_BINDING_DRIFT', 'recovered Work1 path lineage');
  }
  const work1CorrectionBinding = recovery.correction_authority_binding;
  const expectedWork1ReceiptBinding = {
    path: WORK1_RECEIPT_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
    record_id_field: 'work1_contract_receipt_id',
    record_id: WORK1_RECEIPT_ID,
    byte_length: WORK1_RECEIPT_BYTE_LENGTH,
    sha256: WORK1_RECEIPT_SHA256,
    git_blob_oid: WORK1_RECEIPT_GIT_BLOB_OID,
  };
  if (!same(correction.parent_authority_binding,
    predecessorReceipt.work1_7_authority_binding)
      || !same(correction.activation_receipt_binding,
        predecessorReceipt.activation_receipt_binding)
      || !same(manifest.predecessor_receipt_binding, expectedWork1ReceiptBinding)
      || !same(correction.work1_receipt_binding, manifest.predecessor_receipt_binding)
      || !same(correction.work1_correction_authority_binding, work1CorrectionBinding)
      || work1CorrectionBinding?.path !== WORK1_CORRECTION_AUTHORITY_PATH) {
    fail('PREDECESSOR_BINDING_DRIFT', 'Work1 correction bindings');
  }
  const { record: work1Correction } = validateRecordBinding(
    root,
    work1CorrectionBinding,
    'PREDECESSOR_BINDING_DRIFT',
  );
  validateContentIdOnly(
    work1Correction,
    'correction_authority_id',
    'PREDECESSOR_BINDING_DRIFT',
    WORK1_CORRECTION_AUTHORITY_PATH,
  );
  if (!same(work1Correction.effective_work1_paths, requiredPaths)
      || !same(work1Correction.exact_path_extension, requiredPaths.slice(parentPaths.length))) {
    fail('PREDECESSOR_BINDING_DRIFT', 'Work1 recovery authority paths');
  }
  const expectedSourceBindings = WORK2_ENTRY_SOURCE_PRECONDITION_PATHS.map(
    (repositoryPath) => predecessorReceipt.artifact_bindings.find(
      (binding) => binding.path === repositoryPath,
    ) ?? (repositoryPath === LEGACY_M5_AGGREGATE_TEST_PATH ? {
      path: LEGACY_M5_AGGREGATE_TEST_PATH,
      schema_version: null,
      record_id_field: null,
      record_id: null,
      byte_length: 6356,
      sha256: 'bfea7cb02c3472fdf45eb6f8c6a88f419eab4b993bb2a7c46bc73b78a926f040',
      git_blob_oid: '194de847c95b5e9727b8663510cc0ba33dd2f819',
    } : null),
  );
  if (expectedSourceBindings.some((binding) => !binding)
      || !same(correction.source_precondition_bindings, expectedSourceBindings)
      || !same(correction.discovered_defects, [
        {
          code: 'WORK2_PREDECESSOR_COMMIT_DELTA_SOURCE_STALE',
          first_gate: 'BASE_TIP_DRIFT',
          validator_expected_path_count: 13,
          observed_work1_commit_path_count: 15,
        },
        {
          code: 'WORK2_NULL_CANDIDATE_SURVIVES_EXISTING_REGISTRATION',
          first_gate: 'CANDIDATE_BINDING_DRIFT',
        },
        {
          code: 'WORK2_SOURCE_SETS_FLATTEN_SEALED_M3_M4_RECORDS',
          first_gate: 'M7_V2_INPUT_CONSUMPTION',
        },
        {
          code: 'WORK2_PARENT_SCOPE_OMITS_LEGACY_M5_AGGREGATE_TEST',
          first_gate: 'PATH_SCOPE_DRIFT',
        },
      ])
      || !same(correction.base_tip_binding, {
        commit: WORK1_COMMIT,
        parent_commit: ACTIVATION_COMMIT,
        branch: BRANCH,
        commit_message: WORK1_COMMIT_MESSAGE,
        origin_ref: `refs/remotes/origin/${BRANCH}`,
      })
      || manifest.base_tip_binding.commit !== WORK1_COMMIT
      || manifest.base_tip_binding.parent_commit !== ACTIVATION_COMMIT
      || manifest.base_tip_binding.branch !== BRANCH
      || manifest.base_tip_binding.commit_message !== WORK1_COMMIT_MESSAGE) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work2 entry correction bindings');
  }
  const expectedCommands = [
    {
      argv: [
        'node', '--test',
        '--test-name-pattern=Work2 milestone binds the recovered Work1 exact fifteen-path commit lineage',
        EXECUTION_MANIFEST_TEST_PATH,
      ],
      max_runs: 3,
    },
    {
      argv: [
        'node', '--test',
        '--test-name-pattern=a clean null candidate cannot survive an existing registration',
        EXECUTION_MANIFEST_TEST_PATH,
      ],
      max_runs: 3,
    },
    { argv: ['node', '--check', VALIDATOR_PATH], max_runs: 7 },
    { argv: ['node', '--test', EXECUTION_MANIFEST_TEST_PATH], max_runs: 7 },
  ];
  const expectedEffects = {
    deterministic_local_reads: true,
    named_repository_writes: WORK2_ENTRY_AUTHORISED_WRITE_PATHS,
    local_commits: 0,
    repository_pushes: 0,
    model_calls: 0,
    network_reads: 0,
    network_writes: 0,
    database_writes: 0,
    product_writes: 0,
    m0_m4_mutations: 0,
    m8_actions: 0,
  };
  if (!same(correction.authorised_scope, [
    'BIND_WORK2_MILESTONE_TO_RECOVERED_WORK1_EFFECTIVE_FIFTEEN_PATH_LINEAGE',
    'PATCH_WORK2_ENTRY_VALIDATOR_AND_ITS_ACCEPTANCE_TEST',
    'REQUIRE_CANDIDATE_BINDING_AFTER_ANY_REGISTRATION_EXISTS',
    'CLOSE_M3_M4_SOURCE_BINDINGS_IN_THE_M7_V2_CONTRACT_AND_TEST',
    'MIGRATE_LEGACY_M5_CONSOLIDATION_TEST_TO_THE_CLOSED_SEVEN_INPUT_INTERFACE',
    'INCLUDE_CORRECTION_PATHS_IN_EVENTUAL_WORK2_COMMIT',
  ])
      || !same(correction.exact_argv_with_run_limits, expectedCommands)
      || !same(correction.allowed_effects, expectedEffects)
      || !same(correction.prohibited_effects, authority.prohibited_effects)
      || !same(correction.success_conditions, [
        'TRUTHFUL_FIFTEEN_PATH_WORK1_MILESTONE_ACCEPTED',
        'THIRTEEN_PATH_HISTORY_REJECTED',
        'EXISTING_CANDIDATE_REGISTRATION_REQUIRES_EXACT_BINDING',
        'M3_M4_SOURCE_SET_BINDINGS_REPLACE_FLATTENED_COPIES',
        'LEGACY_M5_ADAPTER_AND_TEST_REMAIN_GREEN',
        'REQUIRED_WORK2_TEST_COMMANDS_ARE_EXACT_AND_PATH_SCOPED',
        'CORRECTION_PATHS_INCLUDED_IN_WORK2_MANIFEST',
        'NO_SEPARATE_CORRECTION_COMMIT',
        'ZERO_EXTERNAL_EFFECTS',
      ])) {
    fail('AUTHORITY_BINDING_DRIFT', 'Work2 entry correction scope');
  }
  return {
    expectedWork1DeltaPaths: [...requiredPaths].sort(),
    authorisedWork1WriteExceptions: new Set(WORK2_ENTRY_WORK1_WRITE_EXCEPTIONS),
    authorisedParentWriteExtensions: new Set(WORK2_ENTRY_PARENT_WRITE_EXTENSIONS),
    authorisedCommandExtensions: WORK2_ENTRY_COMMAND_EXTENSIONS,
  };
}

function validateCandidateOrderingAuthority(
  root, authority, authorityBytes, manifest, work4Correction = false,
) {
  const binding = manifest.candidate_ordering_correction_authority_binding;
  if (!manifest.permitted_read_paths.includes(CANDIDATE_ORDERING_AUTHORITY_PATH)) {
    fail('PATH_SCOPE_DRIFT', 'candidate ordering authority read');
  }
  const { record, bytes } = validateRecordBinding(
    root,
    binding,
    'AUTHORITY_BINDING_DRIFT',
  );
  if (binding.path !== CANDIDATE_ORDERING_AUTHORITY_PATH
      || binding.schema_version !== CANDIDATE_ORDERING_AUTHORITY_SCHEMA
      || binding.record_id_field !== 'correction_authority_id'
      || binding.record_id !== CANDIDATE_ORDERING_AUTHORITY_ID
      || binding.byte_length !== CANDIDATE_ORDERING_AUTHORITY_BYTE_LENGTH
      || binding.sha256 !== CANDIDATE_ORDERING_AUTHORITY_SHA256
      || binding.git_blob_oid !== CANDIDATE_ORDERING_AUTHORITY_GIT_BLOB_OID
      || bytes.length !== CANDIDATE_ORDERING_AUTHORITY_BYTE_LENGTH
      || sha256Hex(bytes) !== CANDIDATE_ORDERING_AUTHORITY_SHA256
      || gitBlobOid(bytes) !== CANDIDATE_ORDERING_AUTHORITY_GIT_BLOB_OID
      || !exactKeys(record, CANDIDATE_ORDERING_AUTHORITY_KEYS)
      || record.schema_version !== CANDIDATE_ORDERING_AUTHORITY_SCHEMA
      || record.correction_authority_id !== CANDIDATE_ORDERING_AUTHORITY_ID
      || record.stage !== 'M7_V2_REPAIR_WORK2_4_CANDIDATE_ORDERING_CORRECTION'
      || record.authority_state
        !== 'BEN_AUTHORISED_SINGLE_WORK2_4_CANDIDATE_ORDERING_CORRECTION'
      || record.approved_on !== '2026-08-15'
      || record.approver !== 'BEN_GOODCHILD'
      || record.ben_approval_id
        !== 'BEN-M7-V2-WORK2-4-CANDIDATE-ORDERING-CORRECTION-20260815'
      || record.approval_text !== CANDIDATE_ORDERING_APPROVAL) {
    fail('AUTHORITY_BINDING_DRIFT', CANDIDATE_ORDERING_AUTHORITY_PATH);
  }
  validateContentIdOnly(
    record,
    'correction_authority_id',
    'AUTHORITY_BINDING_DRIFT',
    CANDIDATE_ORDERING_AUTHORITY_PATH,
  );
  const expectedWork1ReceiptBinding = {
    path: WORK1_RECEIPT_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
    record_id_field: 'work1_contract_receipt_id',
    record_id: WORK1_RECEIPT_ID,
    byte_length: WORK1_RECEIPT_BYTE_LENGTH,
    sha256: WORK1_RECEIPT_SHA256,
    git_blob_oid: WORK1_RECEIPT_GIT_BLOB_OID,
  };
  const expectedWork2EntryBinding = {
    path: WORK2_ENTRY_CORRECTION_AUTHORITY_PATH,
    schema_version: WORK2_ENTRY_CORRECTION_AUTHORITY_SCHEMA,
    record_id_field: 'correction_authority_id',
    record_id: WORK2_ENTRY_CORRECTION_AUTHORITY_ID,
    byte_length: WORK2_ENTRY_CORRECTION_AUTHORITY_BYTE_LENGTH,
    sha256: WORK2_ENTRY_CORRECTION_AUTHORITY_SHA256,
    git_blob_oid: WORK2_ENTRY_CORRECTION_AUTHORITY_GIT_BLOB_OID,
  };
  if (!same(record.parent_authority_binding, expectedAuthorityBinding(authority, authorityBytes))
      || !same(record.activation_receipt_binding, manifest.activation_receipt_binding)
      || !same(record.work1_receipt_binding, expectedWork1ReceiptBinding)
      || !same(record.work2_entry_correction_authority_binding, expectedWork2EntryBinding)
      || !same(record.source_precondition_bindings, CANDIDATE_ORDERING_SOURCE_PRECONDITIONS)
      || !same(record.authorised_work2_work1_write_exceptions,
        CANDIDATE_ORDERING_WORK1_WRITE_EXCEPTIONS)
      || !same(record.exact_path_extension, [
        CANDIDATE_ORDERING_AUTHORITY_PATH,
        ...WORK2_SOURCE_SET_PATHS,
      ])
      || !same(record.exact_argv_with_run_limits, [
        {
          argv: ['node', VALIDATOR_PATH, executionManifestPath('WORK2')],
          max_runs: 4,
        },
        { argv: CANDIDATE_ORDERING_FOCUSED_ARGV, max_runs: 8 },
        { argv: CANDIDATE_REGISTRATION_FOCUSED_ARGV, max_runs: 2 },
      ])
      || !same(record.effective_candidate_ordering, {
        candidate_change_after_work4: 'FORBIDDEN',
        first_candidate_stage: 'WORK4',
        work2_candidate_state: 'NULL_REQUIRED_AND_CANDIDATE_ROOT_EMPTY',
        work3_candidate_state: 'NULL_REQUIRED_AND_CANDIDATE_ROOT_EMPTY',
        work4_bootstrap_state:
          'NULL_ONLY_FOR_EXACT_ONE_SHOT_TRANSITION_WITH_ZERO_EVIDENCE_EFFECTS',
        work4_evidence_state: 'EXACT_INDEPENDENTLY_VERIFIED_CANDIDATE_REQUIRED',
        work5_7_candidate_state: 'EXACT_WORK4_CANDIDATE_REQUIRED_WITHOUT_DRIFT',
      })
      || !same(record.prohibited_effects, authority.prohibited_effects)) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate ordering authority contract');
  }
  const sourceSetDefect = record.discovered_defects.find(
    (entry) => entry.code === 'WORK2_NATIVE_SOURCE_SET_OUTPUTS_MISSING_FOR_LATER_CANDIDATE_BINDING',
  );
  if (!same(sourceSetDefect, {
    code: 'WORK2_NATIVE_SOURCE_SET_OUTPUTS_MISSING_FOR_LATER_CANDIDATE_BINDING',
    first_gate: 'PATH_SCOPE_DRIFT',
    parent_requirement: 'WORK2_SHARED_COMPILER_OUTPUTS_AND_WORK4_CANDIDATE_SEMANTIC_INPUTS',
    required_output_bindings: WORK2_SOURCE_SET_BINDING_CONTRACTS,
  })
      || !record.authorised_scope.includes(
        'CREATE_WORK2_NATIVE_M3_M4_SOURCE_SETS_ONCE_FOR_LATER_CANDIDATE_BINDING',
      )
      || !record.success_conditions.includes(
        'WORK2_SOURCE_SETS_ARE_CANONICAL_CONTENT_ADDRESSED_CREATE_ONCE_AND_RECEIPT_BOUND',
      )
      || !same(record.later_receipt_contract, {
        candidate_lineage_members: [
          'candidate_ordering_correction_authority_binding',
          'candidate_registration_id',
          'candidate_transition',
        ],
        work2_source_set_binding_contracts: WORK2_SOURCE_SET_BINDING_CONTRACTS,
        work2_state: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE',
        work3_state: 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE',
        work4_candidate_predecessor_receipts: ['WORK1', 'WORK2', 'WORK3'],
        work4_receipt_binds_candidate: true,
        work5_7_candidate_continuity: 'EXACT_WORK4_CANDIDATE_AND_TRANSITION',
      })
      || !same(record.work4_transition_contract, {
        bootstrap_candidate_binding: null,
        bootstrap_candidate_root_state: 'EMPTY',
        bootstrap_exact_argv_with_run_limits: [
          {
            argv: ['node', VALIDATOR_PATH, executionManifestPath('WORK4')],
            max_runs: 3,
          },
          { argv: WORK4_CANDIDATE_TRANSITION_ARGV, max_runs: 1 },
        ],
        candidate_deletions: 0,
        candidate_predecessor_receipts: ['WORK1', 'WORK2', 'WORK3'],
        candidate_registration_writes: 1,
        candidate_root_selection: 'EXACT_SELECTED_REGISTRATION_PATH_ONLY',
        candidate_transition_authority_path: WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
        candidate_transition_authority_schema:
          WORK4_CANDIDATE_TRANSITION_AUTHORITY_SCHEMA,
        candidate_transition_authority_id_field: 'candidate_transition_authority_id',
        candidate_transition_authority_exact_members:
          WORK4_CANDIDATE_TRANSITION_AUTHORITY_KEYS,
        evidence_effects_before_transition: 0,
        manifest_replacements: 1,
        partial_failure_state: 'PRESERVE_CANDIDATE_AND_REQUIRE_NEW_AUTHORITY',
        pass_transition_exact_members: WORK4_PASS_TRANSITION_KEYS,
        superseded_bootstrap_binding_required: true,
        candidate_preview_and_actual_bindings_equal: true,
        transition_argv: WORK4_CANDIDATE_TRANSITION_ARGV,
        transition_command_position: 2,
        transition_run_limit: 1,
      })
      || !same(record.discovered_defects.slice(2), [
        {
          code: 'WORK2_RICH_RECEIPT_LINEAGE_WAS_DECORATIVE',
          first_gate: 'PREDECESSOR_BINDING_DRIFT',
        },
        {
          code: 'WORK4_TRANSITION_PROOF_WAS_SELF_ASSERTED',
          first_gate: 'CANDIDATE_BINDING_DRIFT',
        },
        {
          code: 'CANDIDATE_ROOT_ALLOWED_UNSELECTED_SIBLINGS',
          first_gate: 'CANDIDATE_BINDING_DRIFT',
        },
        {
          code: 'WORK4_CANDIDATE_PREDECESSOR_SET_WAS_NOT_EXACT',
          first_gate: 'CANDIDATE_BINDING_DRIFT',
        },
        {
          code: 'WORK4_BOOTSTRAP_ALLOWED_POST_TRANSITION_COMMANDS',
          first_gate: 'COMMAND_SCOPE_DRIFT',
        },
        {
          code: 'WORK5_COULD_CREATE_THE_FIRST_CANDIDATE',
          first_gate: 'PREDECESSOR_BINDING_DRIFT',
        },
        {
          code: 'WORK4_CANDIDATE_REGISTRAR_REJECTED_RICH_WORK2_RECEIPT',
          first_gate: 'INVALID_SPECIFICATION',
        },
      ])
      || ![
        'BIND_EXACT_WORK2_RECEIPT_SEMANTIC_LINEAGE_AT_BOTH_PREDECESSOR_SEAMS',
        'REQUIRE_CONTENT_ADDRESSED_WORK4_TRANSITION_AUTHORITY_AND_BOOTSTRAP_BINDING',
        'REQUIRE_CANDIDATE_ROOT_TO_EQUAL_THE_SELECTED_REGISTRATION_PATH',
        'REQUIRE_EXACT_ORDERED_WORK1_WORK2_WORK3_CANDIDATE_PREDECESSORS',
        'FORBID_POST_TRANSITION_COMMANDS_IN_THE_NULL_WORK4_BOOTSTRAP',
        'FORBID_FIRST_CANDIDATE_CREATION_AFTER_WORK4',
        'REQUIRE_EXACT_WORK1_RICH_WORK2_AND_WORK3_RECEIPTS_AT_REGISTRATION_AND_VERIFICATION',
      ].every((scope) => record.authorised_scope.includes(scope))
      || ![
        'WORK2_RECEIPT_VALUES_AND_TWO_SOURCE_SETS_ARE_RESOLVED_NOT_DECORATIVE',
        'WORK4_PASS_BINDS_THE_EXACT_SUPERSEDED_BOOTSTRAP_AND_CANDIDATE',
        'WORK4_TO_WORK7_CANDIDATE_ROOT_HAS_ONE_EXACT_SELECTED_PATH',
        'WORK4_CANDIDATE_PREDECESSORS_ARE_EXACT_ORDERED_WORK1_WORK2_WORK3',
        'WORK4_NULL_BOOTSTRAP_HAS_ONLY_VALIDATOR_THEN_TRANSITION',
        'WORK5_CANNOT_CREATE_THE_FIRST_CANDIDATE',
        'WORK4_CANDIDATE_REGISTRATION_AND_VERIFICATION_ACCEPT_ONLY_EXACT_ORDERED_WORK1_RICH_WORK2_AND_WORK3_RECEIPTS',
      ].every((condition) => record.success_conditions.includes(condition))
      || !WORK2_SOURCE_SET_PATHS.every(
        (repositoryPath) => record.allowed_effects.named_repository_writes.includes(repositoryPath),
      )
      || !CANDIDATE_ORDERING_WORK1_WRITE_EXCEPTIONS.every(
        (repositoryPath) => record.affected_current_paths.includes(repositoryPath)
          && record.allowed_effects.named_repository_writes.includes(repositoryPath),
      )) {
    fail('AUTHORITY_BINDING_DRIFT', 'candidate ordering source-set contract');
  }
  if (manifest.work === 'WORK2') {
    const gitAddPaths = manifest.exact_git_commit_and_push_argv?.[0]?.slice(3) ?? [];
    if (!WORK2_SOURCE_SET_PATHS.every((repositoryPath) =>
      manifest.permitted_write_paths.includes(repositoryPath)
      && gitAddPaths.includes(repositoryPath))) {
      fail('PATH_SCOPE_DRIFT', 'Work2 source-set outputs');
    }
  }
  return {
    binding,
    authorisedWork1WriteExceptions: new Set(
      manifest.work === 'WORK2' ? CANDIDATE_ORDERING_WORK1_WRITE_EXCEPTIONS : [],
    ),
    authorisedParentWriteExtensions: new Set([
      ...WORK2_SOURCE_SET_PATHS,
      ...(manifest.work === 'WORK4'
        ? [work4TransitionAuthorityPath(work4Correction)] : []),
    ]),
    authorisedCommandExtensions: [
      ...(manifest.work === 'WORK2' ? [
        {
          argv: ['node', VALIDATOR_PATH, executionManifestPath('WORK2')],
          max_runs: 4,
        },
        { argv: CANDIDATE_ORDERING_FOCUSED_ARGV, max_runs: 8 },
        { argv: CANDIDATE_REGISTRATION_FOCUSED_ARGV, max_runs: 2 },
      ] : []),
      ...(manifest.work === 'WORK4' ? [{
      argv: work4TransitionArgv(work4Correction),
      max_runs: 1,
      }] : []),
    ],
  };
}

function validateBaseTip(
  root, authority, manifest, priorState, predecessorReceipt, expectedWork1DeltaPaths,
  predecessorValidationResult,
) {
  const binding = manifest.base_tip_binding;
  if (!exactKeys(binding, BASE_TIP_KEYS) || !HASH_40.test(binding.commit)
    || !HASH_40.test(binding.parent_commit) || binding.commit === binding.parent_commit
    || binding.branch !== BRANCH || typeof binding.commit_message !== 'string'
    || binding.commit_message.length === 0 || /[\r\n]/.test(binding.commit_message)) {
    fail('BASE_TIP_DRIFT', manifest.work);
  }
  const prior = priorState?.record ?? null;
  const predecessorWork = `WORK${workNumber(manifest.work) - 1}`;
  let expectedParent;
  let expectedCommit = null;
  let expectedMessage;
  let expectedDeltaPaths;
  let expectedPriorManifestBinding;
  if (manifest.work === 'WORK2') {
    expectedParent = root === CANONICAL_ROOT ? ACTIVATION_COMMIT : binding.parent_commit;
    expectedMessage = root === CANONICAL_ROOT ? WORK1_COMMIT_MESSAGE : binding.commit_message;
    expectedDeltaPaths = expectedWork1DeltaPaths;
    expectedPriorManifestBinding = null;
  } else {
    const priorCommitCommand = prior?.exact_git_commit_and_push_argv?.[1];
    if (!Array.isArray(priorCommitCommand) || priorCommitCommand.length !== 4) {
      fail('BASE_TIP_DRIFT', manifest.work);
    }
    expectedParent = prior.base_tip_binding.commit;
    expectedMessage = priorCommitCommand[3];
    if (manifest.work === 'WORK3') {
      const sealedWork2Paths =
        predecessorReceipt.repository_precondition?.effective_work2_paths;
      if (!Array.isArray(sealedWork2Paths) || sealedWork2Paths.length === 0
          || new Set(sealedWork2Paths).size !== sealedWork2Paths.length) {
        fail('PREDECESSOR_BINDING_DRIFT', 'Work2 effective path lineage');
      }
      expectedDeltaPaths = [...sealedWork2Paths].sort();
    } else if (manifest.predecessor_receipt_binding.schema_version
        === RICH_WORK3_RECEIPT_V2_SCHEMA) {
      const declaredDeltaPaths = binding.milestone_attestation?.exact_commit_delta_paths;
      if (!Array.isArray(declaredDeltaPaths)
          || declaredDeltaPaths.length === 0
          || new Set(declaredDeltaPaths).size !== declaredDeltaPaths.length
          || !same(declaredDeltaPaths, [...declaredDeltaPaths].sort())) {
        fail('BASE_TIP_DRIFT', 'Work4 preparation commit delta');
      }
      const observation = root === CANONICAL_ROOT
        ? canonicalBaseTipObservation(root, binding, manifest.predecessor_receipt_binding)
        : {
          commit: binding.commit,
          parent_commit: binding.parent_commit,
          commit_message: binding.commit_message,
          exact_commit_delta_paths: declaredDeltaPaths,
        };
      expectedCommit = observation.commit;
      expectedParent = observation.parent_commit;
      expectedMessage = observation.commit_message;
      expectedDeltaPaths = observation.exact_commit_delta_paths;
    } else {
      expectedDeltaPaths = [priorState.repositoryPath, ...prior.permitted_write_paths].sort();
    }
    expectedPriorManifestBinding = recordBinding(
      priorState.repositoryPath,
      priorState.bytes,
      prior,
      'execution_manifest_id',
    );
  }
  if ((expectedCommit !== null && binding.commit !== expectedCommit)
      || binding.parent_commit !== expectedParent
      || binding.commit_message !== expectedMessage) {
    fail('BASE_TIP_DRIFT', manifest.work);
  }
  const attestation = binding.milestone_attestation;
  if (!exactKeys(attestation, ATTESTATION_KEYS)
      || attestation.attestation_scope !== (root === CANONICAL_ROOT
        ? 'EXTERNAL_REPOSITORY_OBSERVATION'
        : 'STRUCTURAL_TEST_FIXTURE_NOT_GIT_PROOF')
      || attestation.state !== 'EXTERNAL_ORCHESTRATOR_ATTESTED_COMMITTED_AND_PUSHED'
      || attestation.attestor !== 'ROOT_ORCHESTRATOR'
      || attestation.predecessor_work !== predecessorWork
      || attestation.commit !== binding.commit
      || attestation.parent_commit !== binding.parent_commit
      || attestation.branch !== binding.branch
      || attestation.commit_message !== binding.commit_message
      || attestation.origin_ref !== `refs/remotes/origin/${BRANCH}`
      || !same(attestation.predecessor_receipt_binding,
        manifest.predecessor_receipt_binding)
      || !same(attestation.predecessor_execution_manifest_binding,
        expectedPriorManifestBinding)
      || !same(attestation.exact_commit_delta_paths, expectedDeltaPaths)) {
    fail('BASE_TIP_DRIFT', 'external milestone attestation');
  }
  // The attestation records the absolute directory the bootstrap observed the
  // pushed tip from. It is evidence of where the observation was made, not a
  // property of the tree, so a committed manifest must validate from any
  // checkout (CI included); the other seven observation members stay exact.
  const attestedCwd = attestation.repository_observation?.repository_cwd;
  if (typeof attestedCwd !== 'string' || attestedCwd.length === 0
      || !path.posix.isAbsolute(attestedCwd) || /[\r\n\0]/.test(attestedCwd)) {
    fail('BASE_TIP_DRIFT', 'Git safety observation');
  }
  const expectedObservation = {
    repository_cwd: attestedCwd,
    git_dir_unset: true,
    git_work_tree_unset: true,
    git_no_replace_objects: '1',
    shallow_history: false,
    grafts_present: false,
    loose_replace_refs_present: false,
    packed_replace_refs_present: false,
  };
  if (!same(attestation.repository_observation, expectedObservation)) {
    fail('BASE_TIP_DRIFT', 'Git safety observation');
  }
  const expectedValidationResult = manifest.work === 'WORK2'
    ? {
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_VALIDATION/V1',
      status: 'PASS_WORK1_CONTRACTS',
      contract_policy_id: predecessorReceipt.contract_policy_binding?.record_id,
      family_packet_set_id: predecessorReceipt.family_packet_set_binding?.record_id,
      work1_contract_receipt_id: predecessorReceipt.work1_contract_receipt_id,
      counts: predecessorReceipt.counts,
      effects: predecessorReceipt.effects,
    }
    : manifest.predecessor_receipt_binding.schema_version === RICH_WORK3_RECEIPT_V2_SCHEMA
      ? predecessorValidationResult
      : {
      schema_version:
        `STAGE_2Y_M7_V2_REPAIR_WORK${workNumber(manifest.work) - 1}_VALIDATION/V1`,
      status: `PASS_WORK${workNumber(manifest.work) - 1}`,
      work: predecessorWork,
      receipt_id_field: manifest.predecessor_receipt_binding.record_id_field,
      receipt_id: manifest.predecessor_receipt_binding.record_id,
      };
  if (!same(attestation.predecessor_validation_result, expectedValidationResult)) {
    fail('PREDECESSOR_BINDING_DRIFT', 'predecessor validator PASS result');
  }
  const expectedChecks = ATTESTATION_CHECK_IDS.map((check_id) => ({
    check_id,
    state: 'EXTERNALLY_ATTESTED',
  }));
  if (!same(attestation.checks, expectedChecks)) {
    fail('BASE_TIP_DRIFT', 'external milestone checks');
  }
  const expectedResult = {
    SINGLE_PARENT: `${binding.commit} ${binding.parent_commit}`,
    EXPECTED_PARENT: `${binding.commit} ${binding.parent_commit}`,
    EXPECTED_MESSAGE: binding.commit_message,
    EXACT_TREE_DELTA: expectedDeltaPaths,
    RECEIPT_BLOB_IN_COMMIT: manifest.predecessor_receipt_binding.git_blob_oid,
    ORIGIN_REF_EQUALS_COMMIT: binding.commit,
  };
  const expectedArgv = {
    SINGLE_PARENT: ['git', 'rev-list', '--parents', '-n', '1', binding.commit],
    EXPECTED_PARENT: ['git', 'rev-list', '--parents', '-n', '1', binding.commit],
    EXPECTED_MESSAGE: ['git', 'log', '--format=%s', '-n', '1', binding.commit],
    EXACT_TREE_DELTA: [
      'git', 'diff-tree', '--no-commit-id', '--name-only', '-r', binding.commit,
    ],
    RECEIPT_BLOB_IN_COMMIT: [
      'git', 'ls-tree', '-r', '--full-tree', binding.commit, '--',
      manifest.predecessor_receipt_binding.path,
    ],
    ORIGIN_REF_EQUALS_COMMIT: ['git', 'rev-parse', `refs/remotes/origin/${BRANCH}`],
  };
  const expectedLedger = ATTESTATION_COMMAND_CHECK_IDS.map((check_id) => ({
    check_id,
    argv: expectedArgv[check_id],
    exit_code: 0,
    observed_result: expectedResult[check_id],
  }));
  if (!same(attestation.observed_command_result_ledger, expectedLedger)) {
    fail('BASE_TIP_DRIFT', 'external milestone command ledger');
  }
}

function existingCandidateRegistrationPaths(root) {
  const parts = CANDIDATE_ROOT.split('/');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      fail('PATH_SAFETY', CANDIDATE_ROOT);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail('PATH_SAFETY', CANDIDATE_ROOT);
    }
  }
  return readdirSync(current).sort().map((name) => {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) {
      fail('CANDIDATE_BINDING_DRIFT', `${CANDIDATE_ROOT}/${name}`);
    }
    const repositoryPath = `${CANDIDATE_ROOT}/${name}`;
    const stat = lstatSync(path.join(current, name));
    if (stat.isSymbolicLink() || !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
    return repositoryPath;
  });
}

function schedulesCandidateEvidence(manifest) {
  if (manifest.allowed_effects?.v2_shadow_analysis_runs
    || manifest.allowed_effects?.v2_shadow_projection_runs) return true;
  if (!Array.isArray(manifest.exact_argv_with_run_limits)) return true;
  const evidenceEntrypoints = new Set([
    'scripts/stage-2y-structure-family-aggregate.mjs',
    'scripts/stage-2y-structure-m6-project.mjs',
    'scripts/stage-2y-structure-generalisation-shadow.mjs',
  ]);
  return manifest.exact_argv_with_run_limits.some((entry) => evidenceEntrypoints.has(entry.argv[1]));
}

function validateCandidateOrdering(
  root, manifest, prior, existingCandidatePaths, authorityBinding, work4Correction = false,
) {
  const work = workNumber(manifest.work);
  const wrapper = manifest.candidate_registration_binding;
  const transition = manifest.candidate_transition;
  const WORK4_CANDIDATE_TRANSITION_ARGV = work4TransitionArgv(work4Correction);
  const WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH = work4TransitionAuthorityPath(work4Correction);
  // Under the correction authority the candidate root holds exactly the
  // superseded registration at bootstrap; otherwise it is empty.
  const expectedBootstrapCandidatePaths = work4Correction
    ? [`${CANDIDATE_ROOT}/${WORK4_SUPERSEDED_REGISTRATION_ID}.json`]
    : [];
  if (work === 2 || work === 3) {
    if (wrapper !== null
        || transition !== null
        || existingCandidatePaths.length !== 0
        || schedulesCandidateEvidence(manifest)) {
      fail('CANDIDATE_BINDING_DRIFT', `${manifest.work} build-only candidate ordering`);
    }
    return 'BUILD_ONLY_NULL';
  }
  if (work === 4 && wrapper === null) {
    const exactBootstrapCommands = [
      {
        argv: ['node', VALIDATOR_PATH, work4ManifestPath(work4Correction)],
        max_runs: 3,
      },
      { argv: WORK4_CANDIDATE_TRANSITION_ARGV, max_runs: 1 },
    ];
    if (!same(existingCandidatePaths, expectedBootstrapCandidatePaths)
        || schedulesCandidateEvidence(manifest)
        || !exactKeys(transition, [
          'authority_binding', 'state', 'transition_argv', 'transition_run_limit',
        ])
        || !same(transition.authority_binding, authorityBinding)
        || transition.state !== 'AUTHORISED_PENDING'
        || !same(transition.transition_argv, WORK4_CANDIDATE_TRANSITION_ARGV)
        || transition.transition_run_limit !== 1
        || !manifest.permitted_write_paths.includes(
          WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
        )) {
      fail('CANDIDATE_BINDING_DRIFT', 'Work4 bootstrap candidate transition');
    }
    if (!same(manifest.exact_argv_with_run_limits, exactBootstrapCommands)) {
      fail('COMMAND_SCOPE_DRIFT', 'Work4 bootstrap commands');
    }
    return 'WORK4_TRANSITION_PENDING';
  }
  if (wrapper === null) {
    fail('CANDIDATE_BINDING_DRIFT', `${manifest.work} verified candidate transition`);
  }
  validateWork4CandidateTransitionAuthority(
    root,
    transition,
    wrapper,
    manifest.permitted_read_paths,
    authorityBinding,
    work === 4 ? manifest : null,
    work4Correction,
  );
  if (work === 4 && !same(manifest.exact_argv_with_run_limits?.[1], {
    argv: WORK4_CANDIDATE_TRANSITION_ARGV,
    max_runs: 1,
  })) {
    fail('COMMAND_SCOPE_DRIFT', 'Work4 candidate transition must be second command');
  }
  if (work >= 5 && (!same(wrapper, prior?.candidate_registration_binding)
      || !same(transition, prior?.candidate_transition))) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4-7 candidate continuity');
  }
  return 'VERIFIED_CANDIDATE_BOUND';
}

function recordBindingIsInvalid(binding) {
  return !exactKeys(binding, RECORD_BINDING_KEYS)
      || typeof binding.path !== 'string'
      || !Number.isSafeInteger(binding.byte_length) || binding.byte_length <= 0
      || !HASH_64.test(binding.sha256) || !HASH_40.test(binding.git_blob_oid)
      || ((binding.schema_version === null) !== (binding.record_id_field === null))
      || ((binding.record_id_field === null) !== (binding.record_id === null))
      || (binding.schema_version !== null && typeof binding.schema_version !== 'string')
      || (binding.record_id_field !== null && typeof binding.record_id_field !== 'string')
      || (binding.record_id !== null && !HASH_64.test(binding.record_id));
}

function validateCandidateInnerBinding(binding, label) {
  if (recordBindingIsInvalid(binding)) {
    fail('CANDIDATE_BINDING_DRIFT', label);
  }
  normaliseRepositoryPath(binding.path, 'CANDIDATE_BINDING_DRIFT');
}

function readCandidateComponent(root, binding, permittedReadPaths, historical = false) {
  validateCandidateInnerBinding(binding, binding.path);
  if (!permittedReadPaths.includes(binding.path)) {
    fail('PATH_SCOPE_DRIFT', `candidate component read is not permitted: ${binding.path}`);
  }
  const selectedBytes = boundBytes(root, binding, historical);
  if (selectedBytes.length !== binding.byte_length
      || sha256Hex(selectedBytes) !== binding.sha256
      || gitBlobOid(selectedBytes) !== binding.git_blob_oid) {
    fail('CANDIDATE_BINDING_DRIFT', `${binding.path} bytes`);
  }
  if (binding.schema_version !== null) {
    const selectedRecord = parseCanonical(
      selectedBytes,
      'CANDIDATE_BINDING_DRIFT',
      binding.path,
    );
    if (selectedRecord.schema_version !== binding.schema_version
        || selectedRecord[binding.record_id_field] !== binding.record_id) {
      fail('CANDIDATE_BINDING_DRIFT', `${binding.path} envelope`);
    }
    return selectedRecord;
  }
  return null;
}

function resolveCandidateComponent(root, binding, permittedReadPaths, historical = false) {
  const selectedRecord = readCandidateComponent(root, binding, permittedReadPaths, historical);
  if (selectedRecord !== null) {
    validateContentIdOnly(
      selectedRecord,
      binding.record_id_field,
      'CANDIDATE_BINDING_DRIFT',
      binding.path,
    );
  }
  return selectedRecord;
}

function resolveLineageBinding(root, binding, permittedReadPaths, code, label) {
  if (recordBindingIsInvalid(binding)) fail(code, label);
  normaliseRepositoryPath(binding.path, code);
  if (!permittedReadPaths.includes(binding.path)) {
    fail('PATH_SCOPE_DRIFT', `receipt lineage read is not permitted: ${binding.path}`);
  }
  const bytes = readSafe(root, binding.path);
  if (bytes.length !== binding.byte_length
      || sha256Hex(bytes) !== binding.sha256
      || gitBlobOid(bytes) !== binding.git_blob_oid) {
    fail(code, `${label} bytes`);
  }
  if (binding.schema_version === null) return { bytes, record: null };
  const record = parseCanonical(bytes, code, label);
  if (record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id) {
    fail(code, `${label} envelope`);
  }
  validateContentIdOnly(record, binding.record_id_field, code, label);
  return { bytes, record };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function agreementIndexRecordId(record, code) {
  const requiredArrays = [
    'nodes', 'annotations', 'source_artefacts', 'aliases', 'ambiguities',
    'diagnostics', 'inline_marker_dispositions',
  ];
  if (!requiredArrays.every((field) => Array.isArray(record?.[field]))
      || !isPlainObject(record?.source_binding)
      || !isPlainObject(record?.structural_policy)
      || !isPlainObject(record?.inline_marker_partition)
      || !isPlainObject(record?.byte_coverage)) {
    fail(code, 'WORK3:AgreementIndex native identity inputs');
  }
  return contentId('AGREEMENT_INDEX/V1', {
    agreement_id: record.source_binding.agreement_id,
    canonical_text_id: record.source_binding.canonical_text_id,
    structural_policy_digest: record.structural_policy.policy_digest,
    root_node_occurrence_id: record.root_node_occurrence_id,
    counts: record.counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', record.nodes),
    annotation_set_digest: contentId(
      'AGREEMENT_INDEX_ANNOTATION_SET/V1', record.annotations,
    ),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', record.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', record.aliases),
    ambiguity_set_digest: contentId(
      'AGREEMENT_INDEX_AMBIGUITY_SET/V1', record.ambiguities,
    ),
    diagnostic_set_digest: contentId(
      'AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', record.diagnostics,
    ),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      record.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: record.inline_marker_partition.proof_digest,
    byte_coverage_proof_digest: record.byte_coverage.proof_digest,
  });
}

function validateRichPhysicalBinding(
  root,
  binding,
  code,
  expected = {},
  allowMissingGitBlobOid = false,
) {
  const hasGitBlobOid = Object.hasOwn(binding ?? {}, 'git_blob_oid');
  const bindingKeys = hasGitBlobOid
    ? RECORD_BINDING_KEYS
    : RECORD_BINDING_KEYS.filter((key) => key !== 'git_blob_oid');
  if ((!hasGitBlobOid && !allowMissingGitBlobOid)
      || !exactKeys(binding, bindingKeys)
      || typeof binding.path !== 'string'
      || !Number.isSafeInteger(binding.byte_length) || binding.byte_length <= 0
      || !HASH_64.test(binding.sha256 || '')
      || (Object.hasOwn(binding, 'git_blob_oid') && !HASH_40.test(binding.git_blob_oid || ''))
      || ((binding.schema_version === null) !== (binding.record_id_field === null))
      || ((binding.record_id_field === null) !== (binding.record_id === null))) {
    fail(code, 'WORK3:standard binding');
  }
  normaliseRepositoryPath(binding.path, code);
  for (const field of ['path', 'schema_version', 'record_id_field']) {
    if (Object.hasOwn(expected, field) && binding[field] !== expected[field]) {
      fail(code, `${binding.path}:${field}`);
    }
  }
  const bytes = readSafe(root, binding.path);
  if (bytes.length !== binding.byte_length
      || sha256Hex(bytes) !== binding.sha256
      || (Object.hasOwn(binding, 'git_blob_oid')
        && gitBlobOid(bytes) !== binding.git_blob_oid)) {
    fail(code, `${binding.path}:bytes`);
  }
  return {
    binding: Object.hasOwn(binding, 'git_blob_oid')
      ? binding
      : { ...binding, git_blob_oid: gitBlobOid(bytes) },
    bytes,
  };
}

function validateRichJsonSourceBinding(root, binding, code, expected = {}) {
  const source = validateRichPhysicalBinding(root, binding, code, expected, true);
  let record;
  try {
    record = JSON.parse(source.bytes.toString('utf8'));
  } catch {
    fail(code, binding.path);
  }
  if (binding.schema_version === null
      || record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id) {
    fail(code, `${binding.path}:envelope`);
  }
  return { ...source, record };
}

function validateRichBinding(root, binding, code, expected = {}) {
  const { bytes } = validateRichPhysicalBinding(root, binding, code, expected);
  if (binding.schema_version === null) return { bytes, record: null };
  const record = parseCanonical(bytes, code, binding.path);
  if (record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id) {
    fail(code, `${binding.path}:envelope`);
  }
  const expectedRecordId = binding.schema_version === 'AGREEMENT_INDEX/V1'
    ? agreementIndexRecordId(record, code)
    : contentId(binding.schema_version, (() => {
      const unsigned = clone(record);
      delete unsigned[binding.record_id_field];
      return unsigned;
    })());
  if (expectedRecordId !== binding.record_id) fail(code, `${binding.path}:self identity`);
  return { bytes, record };
}

function validateRichNativeSetEvidence(
  root,
  authority,
  nativeContract,
  nativeEvidence,
  work3SetRecords,
  code,
) {
  const setAuthority = authority?.agreement_index_set_authority;
  const corpus = setAuthority?.corpus_contract;
  const indexDerivation = setAuthority?.agreement_index_member_derivation_contract;
  const setContracts = setAuthority?.sets;
  if (nativeContract.native_lineage !== 'EXACT_M4_TO_M3_TO_M2_FOR_ALL_TEN_MEMBERS'
      || corpus?.set_member_count !== 10
      || corpus.subset_extension_proof !== nativeEvidence.extension_proof
      || !same(corpus.sealed_agreement_ids, nativeEvidence.sealed_agreement_ids)
      || !same(corpus.additive_agreement_ids, nativeEvidence.additive_agreement_ids)
      || !same(corpus.combined_agreement_ids, nativeEvidence.combined_agreement_ids)
      || indexDerivation?.agreement_id_derivation
        !== 'REREAD_EACH_BOUND_AGREEMENT_INDEX_RECORD_AND_REQUIRE_TEN_UNIQUE_AGREEMENT_IDS'
      || indexDerivation.derived_agreement_ids_must_byte_equal
        !== 'corpus_contract.combined_agreement_ids'
      || indexDerivation.member_order !== 'CANONICAL_ASCENDING_STANDARD_BINDING_PATH'
      || indexDerivation.member_shape !== 'DIRECT_STANDARD_SEVEN_FIELD_BINDING'
      || indexDerivation.resolved_record_id_field !== 'agreement_index_id'
      || indexDerivation.resolved_record_schema_version !== 'AGREEMENT_INDEX/V1'
      || !Array.isArray(setContracts) || setContracts.length !== 3) {
    fail(code, 'WORK3:native set authority');
  }

  const combinedAgreementIds = nativeEvidence.combined_agreement_ids;
  const unionAgreementIds = [
    ...nativeEvidence.sealed_agreement_ids,
    ...nativeEvidence.additive_agreement_ids,
  ].sort();
  if (combinedAgreementIds.length !== 10
      || new Set(combinedAgreementIds).size !== 10
      || !same(combinedAgreementIds, [...combinedAgreementIds].sort())
      || !same(unionAgreementIds, combinedAgreementIds)
      || new Set(unionAgreementIds).size !== 10) {
    fail(code, 'WORK3:native agreement union');
  }

  const setShapes = [
    {
      schema_version: 'AGREEMENT_INDEX_SET/V1',
      record_id_field: 'agreement_index_set_id',
      exact_keys: ['schema_version', 'agreement_index_set_id', 'members'],
      member_exact_keys: [...RECORD_BINDING_KEYS],
      member_order: 'CANONICAL_ASCENDING_STANDARD_BINDING_PATH',
    },
    {
      schema_version: 'CONTEXT_COMPILATION_SET/V1',
      record_id_field: 'context_compilation_set_id',
      exact_keys: ['schema_version', 'context_compilation_set_id', 'members'],
      member_exact_keys: ['agreement_id', 'context_compilation_binding'],
      member_order: 'CANONICAL_ASCENDING_AGREEMENT_ID',
    },
    {
      schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
      record_id_field: 'agreement_analysis_set_id',
      exact_keys: ['schema_version', 'agreement_analysis_set_id', 'members'],
      member_exact_keys: ['agreement_id', 'agreement_analysis_binding'],
      member_order: 'CANONICAL_ASCENDING_AGREEMENT_ID',
    },
  ];
  for (let index = 0; index < setShapes.length; index += 1) {
    const shape = setShapes[index];
    const setContract = setContracts[index];
    const record = work3SetRecords[index];
    if (setContract.schema_version !== shape.schema_version
        || setContract.record_id_field !== shape.record_id_field
        || !same(setContract.exact_keys, shape.exact_keys)
        || !same(setContract.member_exact_keys, shape.member_exact_keys)
        || setContract.member_order !== shape.member_order
        || !Array.isArray(setContract.members) || setContract.members.length !== 10
        || !exactKeys(record, shape.exact_keys)
        || record.schema_version !== shape.schema_version
        || !same(record.members, setContract.members)) {
      fail(code, `WORK3:native set members ${shape.schema_version}`);
    }
  }

  const agreementIndexes = work3SetRecords[0].members.map((binding) => {
    const { record } = validateRichBinding(root, binding, code, {
      schema_version: 'AGREEMENT_INDEX/V1', record_id_field: 'agreement_index_id',
    });
    return {
      agreement_id: record.source_binding?.agreement_id,
      binding,
      agreement_index_binding: {
        agreement_index_id: binding.record_id,
        agreement_index_sha256: binding.sha256,
        canonical_text_sha256: record.source_binding?.canonical_text_sha256,
        structural_policy_digest: record.structural_policy?.policy_digest,
      },
    };
  });
  const contextCompilations = work3SetRecords[1].members.map((member) => {
    if (!exactKeys(member, ['agreement_id', 'context_compilation_binding'])) {
      fail(code, 'WORK3:ContextCompilation member binding');
    }
    const { record } = validateRichBinding(root, member.context_compilation_binding, code, {
      schema_version: 'CONTEXT_COMPILATION/V1', record_id_field: 'context_compilation_id',
    });
    return {
      agreement_id: member.agreement_id,
      binding: member.context_compilation_binding,
      agreement_index_binding: record.agreement_index_binding,
    };
  });
  const agreementAnalyses = work3SetRecords[2].members.map((member) => {
    if (!exactKeys(member, ['agreement_id', 'agreement_analysis_binding'])) {
      fail(code, 'WORK3:AgreementAnalysis member binding');
    }
    const { record } = validateRichBinding(root, member.agreement_analysis_binding, code, {
      schema_version: 'AGREEMENT_ANALYSIS/V1', record_id_field: 'agreement_analysis_id',
    });
    return {
      agreement_id: member.agreement_id,
      record_agreement_id: record.agreement_id,
      agreement_index_binding: record.agreement_index_binding,
      context_compilation_binding: record.context_compilation_binding,
    };
  });
  if (!same(work3SetRecords[0].members.map((binding) => binding.path),
    work3SetRecords[0].members.map((binding) => binding.path).sort())
      || !same(contextCompilations.map((row) => row.agreement_id), combinedAgreementIds)
      || !same(agreementAnalyses.map((row) => row.agreement_id), combinedAgreementIds)) {
    fail(code, 'WORK3:native member order');
  }
  const agreementIndexesById = new Map(agreementIndexes.map((row) => [row.agreement_id, row]));
  const contextCompilationsById = new Map(
    contextCompilations.map((row) => [row.agreement_id, row]),
  );
  const exactReferenceOrId = (actual, expected, idField) => (
    same(actual, expected)
      || (exactKeys(actual, [idField]) && actual[idField] === expected[idField])
  );
  if (agreementIndexesById.size !== 10
      || contextCompilationsById.size !== 10
      || !same([...agreementIndexesById.keys()].sort(), combinedAgreementIds)) {
    fail(code, 'WORK3:AgreementIndex agreement IDs');
  }
  for (const analysis of agreementAnalyses) {
    const agreementIndex = agreementIndexesById.get(analysis.agreement_id);
    const contextCompilation = contextCompilationsById.get(analysis.agreement_id);
    if (!agreementIndex || !contextCompilation
        || analysis.record_agreement_id !== analysis.agreement_id
        || !same(contextCompilation.agreement_index_binding,
          agreementIndex.agreement_index_binding)
        || !exactReferenceOrId(
          analysis.agreement_index_binding,
          contextCompilation.agreement_index_binding,
          'agreement_index_id',
        )
        || !exactReferenceOrId(analysis.context_compilation_binding, {
          agreement_id: analysis.agreement_id,
          agreement_index_id: agreementIndex.binding.record_id,
          byte_length: contextCompilation.binding.byte_length,
          context_compilation_id: contextCompilation.binding.record_id,
          path: contextCompilation.binding.path,
          schema_version: contextCompilation.binding.schema_version,
          sha256: contextCompilation.binding.sha256,
        }, 'context_compilation_id')) {
      fail(code, `WORK3:native M4-M3-M2 lineage ${analysis.agreement_id}`);
    }
  }
}

function validateRichPackageMember(binding, packagesByPath, familyKey, code) {
  if (!exactKeys(binding, RICH_PACKAGE_MEMBER_BINDING_KEYS)
      || binding.schema_version !== RICH_PACKAGE_MEMBER_BINDING_SCHEMA
      || binding.member_field !== 'subtype_tree'
      || binding.member_index !== null
      || binding.member_schema_version !== 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1'
      || binding.member_record_id_field !== 'subtype_tree_id'
      || !HASH_64.test(binding.member_record_id || '')
      || !Number.isSafeInteger(binding.member_byte_length) || binding.member_byte_length <= 0
      || !HASH_64.test(binding.member_sha256 || '')) {
    fail(code, `${familyKey}:package member`);
  }
  normaliseRepositoryPath(binding.container_path, code);
  const packageRecord = packagesByPath.get(binding.container_path);
  const member = packageRecord?.subtype_tree;
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  if (!packageRecord || packageRecord.family_key !== familyKey
      || member?.schema_version !== binding.member_schema_version
      || member?.[binding.member_record_id_field] !== binding.member_record_id
      || member?.family_key !== familyKey
      || memberBytes.length !== binding.member_byte_length
      || sha256Hex(memberBytes) !== binding.member_sha256) {
    fail(code, `${familyKey}:package member bytes`);
  }
  const unsigned = clone(member);
  delete unsigned[binding.member_record_id_field];
  if (contentId(binding.member_schema_version, unsigned) !== binding.member_record_id) {
    fail(code, `${familyKey}:package member identity`);
  }
}

function validateRichRoutedPackageMember(
  binding,
  packagesByPath,
  expectedField,
  expectedSchema,
  expectedIdField,
  code,
  detail,
) {
  if (!exactKeys(binding, RICH_PACKAGE_MEMBER_BINDING_KEYS)
      || binding.schema_version !== RICH_PACKAGE_MEMBER_BINDING_SCHEMA
      || binding.member_field !== expectedField
      || !Number.isSafeInteger(binding.member_index) || binding.member_index < 0
      || binding.member_schema_version !== expectedSchema
      || binding.member_record_id_field !== expectedIdField
      || !HASH_64.test(binding.member_record_id || '')
      || !Number.isSafeInteger(binding.member_byte_length) || binding.member_byte_length <= 0
      || !HASH_64.test(binding.member_sha256 || '')) {
    fail(code, detail);
  }
  normaliseRepositoryPath(binding.container_path, code);
  const packageRecord = packagesByPath.get(binding.container_path);
  const member = packageRecord?.[expectedField]?.[binding.member_index];
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  if (!isPlainObject(member)
      || member.schema_version !== expectedSchema
      || member[expectedIdField] !== binding.member_record_id
      || memberBytes.length !== binding.member_byte_length
      || sha256Hex(memberBytes) !== binding.member_sha256) {
    fail(code, `${detail}:member bytes`);
  }
  const unsigned = clone(member);
  delete unsigned[expectedIdField];
  if (contentId(expectedSchema, unsigned) !== binding.member_record_id) {
    fail(code, `${detail}:member identity`);
  }
  return member;
}

function validateRichStructureDispositionSet(
  record,
  packagesByPath,
  authority,
  richContract,
  agreementIndexSet,
  code,
) {
  const scope = authority?.work3_scope_contract;
  const contract = scope?.structure_disposition_set_contract;
  const richBindingContract = richContract?.structure_disposition_set_binding_contract;
  const expectedOverlayBinding = contract?.item39_overlay_fixture_binding_contract?.exact_binding;
  const packageOverlayContract = scope?.family_profile_package_contract
    ?.single_global_item39_overlay_fixture_contract;
  const expectedGovernedSource = packageOverlayContract?.governed_item39_source;
  const expectedSyntheticIndexBinding = packageOverlayContract
    ?.synthetic_ambiguous_repeat_source?.agreement_index_binding;
  const governedIndexBindings = Array.isArray(agreementIndexSet?.members)
    ? agreementIndexSet.members.filter(
      (binding) => binding?.record_id === expectedGovernedSource?.agreement_index_id,
    )
    : [];
  const expectedGovernedIndexBinding = governedIndexBindings[0];
  if (!same(contract?.exact_keys, RICH_STRUCTURE_SET_KEYS)
      || !same(contract?.member_exact_keys, RICH_STRUCTURE_MEMBER_KEYS)
      || contract.schema_version !== 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1'
      || contract.state !== 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET'
      || contract.fixture_member_field !== 'match_fixtures'
      || contract.inclusion_and_exclusion_fixture_binding_schema_version
        !== RICH_PACKAGE_MEMBER_BINDING_SCHEMA
      || !isPlainObject(expectedOverlayBinding)
      || richBindingContract?.package_member_bindings_must_resolve !== true
      || richBindingContract.global_reference_closure
        !== 'EXACT_UNION_NO_ORPHAN_NO_CROSS_ROUTE_ONE_PACKAGE_OWNER'
      || contract.package_structure_fixture_reference_closure
        !== 'EXACT_SINGLE_SYNTHETIC_AMBIGUOUS_REPEAT_BINDING_FOR_DISTINCT_GOVERNED_ITEM39_SOURCE_NO_ORPHAN_NO_CROSS_ROUTE_EXACTLY_ONE_PACKAGE_OWNER'
      || contract.item39_overlay_fixture_binding_contract
        .governed_item39_source_must_equal
        !== 'family_profile_package_contract.single_global_item39_overlay_fixture_contract.governed_item39_source'
      || !same(richBindingContract.ambiguous_repeat_fixture_member_binding,
        expectedOverlayBinding)
      || !same(richBindingContract.governed_item39_source, expectedGovernedSource)
      || !same(richBindingContract.synthetic_agreement_index_binding,
        expectedSyntheticIndexBinding)
      || governedIndexBindings.length !== 1
      || expectedGovernedIndexBinding.schema_version !== 'AGREEMENT_INDEX/V1'
      || expectedGovernedIndexBinding.record_id_field !== 'agreement_index_id'
      || expectedGovernedSource?.agreement_index_id
        === expectedSyntheticIndexBinding?.record_id) {
    fail(code, 'WORK3:structure disposition authority');
  }
  if (!exactKeys(record, RICH_STRUCTURE_SET_KEYS)
      || record.schema_version !== contract.schema_version
      || record.state !== contract.state
      || !Array.isArray(record.members) || record.members.length === 0) {
    fail(code, 'WORK3:structure disposition set');
  }
  const memberIds = record.members.map((member) => member?.structure_disposition_id);
  if (!memberIds.every((memberId) => HASH_64.test(memberId || ''))
      || new Set(memberIds).size !== memberIds.length
      || !same(memberIds, [...memberIds].sort())) {
    fail(code, 'WORK3:structure disposition member order');
  }
  let overlayCount = 0;
  let resolvedOverlayBinding = null;
  const routedMatchBindings = [];
  const routedStructureBindings = [];
  for (const member of record.members) {
    if (!exactKeys(member, RICH_STRUCTURE_MEMBER_KEYS)
        || member.schema_version !== contract.schema_version) {
      fail(code, 'WORK3:structure disposition member');
    }
    const unsigned = clone(member);
    delete unsigned.schema_version;
    delete unsigned.structure_disposition_id;
    if (contentId(contract.schema_version, unsigned) !== member.structure_disposition_id) {
      fail(code, 'WORK3:structure disposition member identity');
    }
    const requiresBen = ['LEGAL_TEXT_EXCLUSION', 'NO_OUTPUT',
      'BEN_AUTHORED_INLINE_LIST_OVERLAY'].includes(member.kind);
    if (!['TECHNICAL_STRUCTURE', 'SOURCE_ARTEFACT', 'LEGAL_TEXT_EXCLUSION', 'NO_OUTPUT',
      'BEN_AUTHORED_INLINE_LIST_OVERLAY'].includes(member.kind)
        || typeof member.reason_code !== 'string' || member.reason_code.length === 0
        || typeof member.policy_id !== 'string' || member.policy_id.length === 0
        || !Number.isSafeInteger(member.policy_version) || member.policy_version <= 0
        || !['DETERMINISTIC_TECHNICAL', 'BEN_LEGAL_RULING'].includes(member.authority_class)
        || (requiresBen
          ? member.authority_class !== 'BEN_LEGAL_RULING'
            || member.approver !== 'BEN_GOODCHILD'
            || typeof member.lawyer_ruling_id !== 'string'
            || member.lawyer_ruling_id.length === 0
          : member.approver !== null || member.lawyer_ruling_id !== null)
        || !exactKeys(member.scope, RICH_STRUCTURE_SCOPE_KEYS)
        || !HASH_64.test(member.scope.agreement_index_id || '')
        || typeof member.scope.source_node_occurrence_id !== 'string'
        || member.scope.source_node_occurrence_id.length === 0
        || !Number.isSafeInteger(member.scope.start_byte) || member.scope.start_byte < 0
        || !Number.isSafeInteger(member.scope.end_byte)
        || member.scope.end_byte <= member.scope.start_byte
        || !Array.isArray(member.scope.governed_input_occurrence_ids)
        || new Set(member.scope.governed_input_occurrence_ids).size
          !== member.scope.governed_input_occurrence_ids.length
        || !member.scope.governed_input_occurrence_ids.every(
          (value) => typeof value === 'string' && value.length > 0,
        )
        || !isPlainObject(member.match_test)) {
      fail(code, 'WORK3:structure disposition member contract');
    }
    const resolvedIds = {};
    for (const field of ['inclusion_fixture_bindings', 'exclusion_fixture_bindings']) {
      const bindings = member[field];
      const serialised = Array.isArray(bindings)
        ? bindings.map((binding) => canonicalJson(binding)) : [];
      if (serialised.length === 0
          || new Set(serialised).size !== serialised.length
          || !same(serialised, [...serialised].sort())) {
        fail(code, `WORK3:structure ${field}`);
      }
      resolvedIds[field] = new Set(bindings.map((binding) => {
        const resolved = validateRichRoutedPackageMember(
          binding,
          packagesByPath,
          'match_fixtures',
          'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
          'match_fixture_id',
          code,
          `WORK3:structure ${field}`,
        );
        routedMatchBindings.push(binding);
        return resolved.match_fixture_id;
      }));
    }
    if ([...resolvedIds.inclusion_fixture_bindings].some(
      (fixtureId) => resolvedIds.exclusion_fixture_bindings.has(fixtureId),
    )) {
      fail(code, 'WORK3:structure fixture partition');
    }
    if (member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY') {
      overlayCount += 1;
      const overlay = member.inline_list_overlay;
      if (!exactKeys(overlay, RICH_INLINE_OVERLAY_KEYS)
          || !Array.isArray(overlay.ambiguous_repeat_fixture_bindings)
          || overlay.ambiguous_repeat_fixture_bindings.length !== 1
          || !same(overlay.ambiguous_repeat_fixture_bindings[0], expectedOverlayBinding)) {
        fail(code, 'WORK3:item39 overlay route');
      }
      validateRichRoutedPackageMember(
        overlay.ambiguous_repeat_fixture_bindings[0],
        packagesByPath,
        'structure_fixture_members',
        'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
        'fixture_id',
        code,
        'WORK3:item39 overlay fixture',
      );
      routedStructureBindings.push(overlay.ambiguous_repeat_fixture_bindings[0]);
      if (member.lawyer_ruling_id !== expectedGovernedSource.lawyer_ruling_id
          || member.scope.agreement_index_id !== expectedGovernedSource.agreement_index_id
          || member.scope.source_node_occurrence_id
            !== expectedGovernedSource.source_node_occurrence_id
          || member.scope.start_byte !== expectedGovernedSource.span?.start_byte
          || member.scope.end_byte !== expectedGovernedSource.span?.end_byte
          || overlay.lawyer_ruling_id !== expectedGovernedSource.lawyer_ruling_id
          || !same(overlay.agreement_index_binding, expectedGovernedIndexBinding)
          || overlay.sealed_ambiguity_id !== expectedGovernedSource.ambiguity_id
          || !same(overlay.sealed_ambiguity_span, expectedGovernedSource.span)
          || overlay.inline_marker_disposition_id
            !== expectedGovernedSource.inline_marker_disposition_id
          || overlay.parent_node_occurrence_id
            !== expectedGovernedSource.source_node_occurrence_id
          || overlay.parent_reference !== expectedGovernedSource.section_reference) {
        fail(code, 'WORK3:item39 governed source');
      }
      resolvedOverlayBinding = overlay.ambiguous_repeat_fixture_bindings[0];
    } else if (member.inline_list_overlay !== null) {
      fail(code, 'WORK3:non-overlay structure disposition');
    }
  }
  const expectedStructureBindings = [];
  const routedMemberIds = new Set();
  for (const [containerPath, packageRecord] of packagesByPath) {
    for (const [memberField, schemaVersion, recordIdField, destination] of [
      ['match_fixtures', 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
        'match_fixture_id', null],
      ['structure_fixture_members', 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
        'fixture_id', expectedStructureBindings],
    ]) {
      const members = packageRecord[memberField];
      if (!Array.isArray(members)) fail(code, `WORK3:${memberField} inventory`);
      let previousId = null;
      for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
        const member = members[memberIndex];
        const memberId = member?.[recordIdField];
        if (!isPlainObject(member)
            || member.schema_version !== schemaVersion
            || !HASH_64.test(memberId || '')
            || (previousId !== null && memberId <= previousId)
            || routedMemberIds.has(memberId)) {
          fail(code, `WORK3:${memberField} member order and ownership`);
        }
        const unsigned = clone(member);
        delete unsigned[recordIdField];
        if (contentId(schemaVersion, unsigned) !== memberId) {
          fail(code, `WORK3:${memberField} member identity`);
        }
        const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
        if (destination !== null) {
          destination.push({
            schema_version: RICH_PACKAGE_MEMBER_BINDING_SCHEMA,
            container_path: containerPath,
            member_field: memberField,
            member_index: memberIndex,
            member_schema_version: schemaVersion,
            member_record_id_field: recordIdField,
            member_record_id: memberId,
            member_byte_length: memberBytes.length,
            member_sha256: sha256Hex(memberBytes),
          });
        }
        routedMemberIds.add(memberId);
        previousId = memberId;
      }
    }
  }
  const exactReferenceUnion = (routed, expected) => {
    const routedKeys = routed.map((binding) => canonicalJson(binding));
    const expectedKeys = expected.map((binding) => canonicalJson(binding));
    return new Set(routedKeys).size === routedKeys.length
      && routedKeys.length === expectedKeys.length
      && same([...routedKeys].sort(), [...expectedKeys].sort());
  };
  const routedMatchKeys = routedMatchBindings.map((binding) => canonicalJson(binding));
  if (overlayCount !== 1 || expectedStructureBindings.length !== 1
      || new Set(routedMatchKeys).size !== routedMatchKeys.length
      || !exactReferenceUnion(routedStructureBindings, expectedStructureBindings)
      || !same(resolvedOverlayBinding, expectedOverlayBinding)) {
    fail(code, 'WORK3:structure global reference closure');
  }
}

function validateRichFamilyProfilePackageSemantics(
  root,
  authority,
  familyPackageSources,
  profileSet,
  structureRecord,
  agreementIndexSet,
  code,
) {
  const packetBinding = authority.work3_scope_contract
    ?.family_packet_set_source_contract?.binding;
  const { record: familyPacketSet } = validateRichJsonSourceBinding(
    root,
    packetBinding,
    code,
  );
  const sourceBindingsByPath = new Map();
  const addSourceBinding = (binding) => {
    if (!isPlainObject(binding) || typeof binding.path !== 'string') {
      fail(code, 'WORK3:family package semantic source binding');
    }
    const existing = sourceBindingsByPath.get(binding.path);
    if (existing && !same(existing, binding)) {
      fail(code, `WORK3:conflicting semantic source binding:${binding.path}`);
    }
    sourceBindingsByPath.set(binding.path, binding);
  };
  for (const binding of [
    familyPacketSet.work0_evidence_root_binding,
    familyPacketSet.fixed_sample_identity_binding,
    familyPacketSet.repair_baseline_binding,
    familyPacketSet.calibration_ruling_map_binding,
    familyPacketSet.lawyer_review_packet_binding,
    ...familyPacketSet.families.map((family) => family.calibration_pack_binding),
  ]) addSourceBinding(binding);

  const agreementIndexBindingsById = new Map();
  const addAgreementIndexBinding = (binding, includeSource) => {
    const existing = agreementIndexBindingsById.get(binding.record_id);
    if (existing && !same(existing, binding)) {
      fail(code, 'WORK3:duplicate AgreementIndex semantic source');
    }
    agreementIndexBindingsById.set(binding.record_id, binding);
    if (includeSource) addSourceBinding(binding);
  };
  for (const binding of agreementIndexSet.members) addAgreementIndexBinding(binding, false);
  for (const source of familyPackageSources) {
    for (const fixture of source.record.structure_fixture_members) {
      addAgreementIndexBinding(fixture.agreement_index_binding, true);
    }
  }
  for (const member of structureRecord.members) {
    if (member.inline_list_overlay !== null) {
      addAgreementIndexBinding(member.inline_list_overlay.agreement_index_binding, true);
    }
  }
  for (const member of structureRecord.members) {
    const binding = agreementIndexBindingsById.get(member.scope.agreement_index_id);
    if (!binding) fail(code, 'WORK3:missing structure semantic source');
    addSourceBinding(binding);
  }
  const nativeSourceRecords = [...sourceBindingsByPath.values()].map(
    (binding) => validateRichJsonSourceBinding(root, binding, code),
  );
  try {
    validateFamilyProfilePackageSetForWork3({
      work3Authority: authority,
      dnoItem42SuccessorAuthority: null,
      familyGroupingSuccessorAuthorities: null,
      familyProfileSet: profileSet,
      familyPackageSources,
      familyPacketSet,
      structureDispositionSet: structureRecord,
      nativeSourceRecords,
    });
  } catch (error) {
    fail(code, `WORK3:family profile package semantics:${error.code ?? error.message}`);
  }
}

function validateRichApprovedProfileInventory(
  profileSet,
  familyEvidence,
  packagesByPath,
  scope,
  familyContract,
  code,
) {
  const orderContract =
    'C3_FAMILY_KEY_ORDER_THEN_PROFILE_KEY_THEN_PROFILE_ID_WITH_PROFILE_KEYS_UNIQUE_WITHIN_FAMILY';
  const approvedSetContract = scope.approved_family_profile_set_contract;
  const profileContract = scope.family_profile_package_contract
    ?.member_contracts?.profiles;
  const treeContract = scope.family_profile_package_contract
    ?.member_contracts?.subtype_tree;
  if (familyContract.approved_profile_order !== orderContract
      || approvedSetContract?.profiles_order !== orderContract
      || approvedSetContract.profiles_contract
        !== 'EXACT_FINAL_V1_PROFILE_RECORDS_CANONICAL_BYTE_EQUAL_TO_EXACTLY_ONE_PACKAGE_PROFILES_MEMBER_WITH_NO_ADDED_PROVENANCE_KEYS'
      || approvedSetContract.profile_and_package_inventory_closure
        !== 'PROFILE_IDS_PACKAGE_BINDINGS_DIMENSION_EVIDENCE_AND_SUBTYPE_TREES_ARE_COMPLETE_UNIQUE_AND_BYTE_EQUAL_TO_EMBEDDED_PACKAGE_MEMBERS'
      || profileContract?.container !== 'ARRAY'
      || profileContract.family_and_version_equal_package !== true
      || profileContract.order !== 'CANONICAL_ASCENDING_PROFILE_KEY_THEN_PROFILE_ID'
      || profileContract.profile_keys_unique_within_family !== true
      || profileContract.record_id_field !== 'profile_id'
      || profileContract.schema_version
        !== 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1'
      || treeContract?.container !== 'SINGLETON'
      || treeContract.family_and_version_equal_package !== true
      || treeContract.record_id_field !== 'subtype_tree_id'
      || treeContract.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1') {
    fail(code, 'WORK3:approved profile inventory authority');
  }
  const expectedProfiles = [];
  const profileIds = new Set();
  const familyProfileKeys = new Set();
  for (let index = 0; index < CANDIDATE_FAMILIES.length; index += 1) {
    const familyKey = CANDIDATE_FAMILIES[index];
    const packageBinding = familyEvidence.family_profile_package_bindings[index];
    const packageRecord = packagesByPath.get(packageBinding.path);
    const packageVersion = packageRecord?.profile_set_version;
    if (!Number.isInteger(packageVersion)
        || packageVersion < 1
        || packageRecord.family_approval?.profile_set_version !== packageVersion
        || packageRecord.subtype_tree?.profile_set_version !== packageVersion
        || packageRecord.subtype_tree?.family_key !== familyKey
        || !Array.isArray(packageRecord.profiles)) {
      fail(code, `${familyKey}:package profile inventory`);
    }
    let previousProfileKey = null;
    let previousProfileId = null;
    for (const profile of packageRecord.profiles) {
      if (!isPlainObject(profile)
          || profile.schema_version !== 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1'
          || profile.family_key !== familyKey
          || profile.profile_set_version !== packageRecord.profile_set_version
          || typeof profile.profile_key !== 'string'
          || profile.profile_key.length === 0
          || !HASH_64.test(profile.profile_id || '')) {
        fail(code, `${familyKey}:approved profile record`);
      }
      const unsigned = clone(profile);
      delete unsigned.profile_id;
      delete unsigned.schema_version;
      if (contentId(profile.schema_version, unsigned) !== profile.profile_id) {
        fail(code, `${familyKey}:approved profile identity`);
      }
      if (previousProfileKey !== null
          && (profile.profile_key < previousProfileKey
            || (profile.profile_key === previousProfileKey
              && profile.profile_id <= previousProfileId))) {
        fail(code, `${familyKey}:approved profile order`);
      }
      const familyProfileKey = `${familyKey}\0${profile.profile_key}`;
      if (familyProfileKeys.has(familyProfileKey) || profileIds.has(profile.profile_id)) {
        fail(code, `${familyKey}:approved profile uniqueness`);
      }
      familyProfileKeys.add(familyProfileKey);
      profileIds.add(profile.profile_id);
      expectedProfiles.push(profile);
      previousProfileKey = profile.profile_key;
      previousProfileId = profile.profile_id;
    }
  }
  if (!same(profileSet.profiles, expectedProfiles)) {
    fail(code, 'WORK3:approved profile package inventory closure');
  }
}

function validateRichDimensionEvidenceInventory(
  profileSet,
  familyEvidence,
  packagesByPath,
  scope,
  code,
) {
  const approvedSetContract = scope.approved_family_profile_set_contract;
  const memberContract = scope.family_profile_package_contract
    ?.member_contracts?.dimension_evidence;
  if (approvedSetContract?.dimension_evidence_bindings_contract
        !== 'EXACT_ALL_PACKAGE_DIMENSION_EVIDENCE_MEMBERS_AS_PACKAGE_MEMBER_BINDINGS_IN_CANONICAL_FAMILY_KEY_THEN_MEMBER_ID_ORDER'
      || memberContract?.container !== 'ARRAY'
      || memberContract.order !== 'CANONICAL_ASCENDING_DIMENSION_EVIDENCE_ID'
      || memberContract.record_id_field !== 'dimension_evidence_id'
      || memberContract.schema_version !== 'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1') {
    fail(code, 'WORK3:dimension evidence inventory authority');
  }
  const expectedBindings = [];
  const evidenceIds = new Set();
  for (let index = 0; index < CANDIDATE_FAMILIES.length; index += 1) {
    const familyKey = CANDIDATE_FAMILIES[index];
    const packageBinding = familyEvidence.family_profile_package_bindings[index];
    const packageRecord = packagesByPath.get(packageBinding.path);
    if (!Array.isArray(packageRecord?.dimension_evidence)) {
      fail(code, `${familyKey}:dimension evidence inventory`);
    }
    let previousId = null;
    for (let memberIndex = 0;
      memberIndex < packageRecord.dimension_evidence.length;
      memberIndex += 1) {
      const member = packageRecord.dimension_evidence[memberIndex];
      if (!isPlainObject(member)
          || member.schema_version !== memberContract.schema_version
          || !HASH_64.test(member.dimension_evidence_id || '')
          || (previousId !== null && member.dimension_evidence_id <= previousId)
          || evidenceIds.has(member.dimension_evidence_id)) {
        fail(code, `${familyKey}:dimension evidence member order and uniqueness`);
      }
      const unsigned = clone(member);
      delete unsigned.dimension_evidence_id;
      if (contentId(member.schema_version, unsigned) !== member.dimension_evidence_id) {
        fail(code, `${familyKey}:dimension evidence identity`);
      }
      const bytes = Buffer.from(canonicalJson(member), 'utf8');
      expectedBindings.push({
        schema_version: RICH_PACKAGE_MEMBER_BINDING_SCHEMA,
        container_path: packageBinding.path,
        member_field: 'dimension_evidence',
        member_index: memberIndex,
        member_schema_version: memberContract.schema_version,
        member_record_id_field: memberContract.record_id_field,
        member_record_id: member.dimension_evidence_id,
        member_byte_length: bytes.length,
        member_sha256: sha256Hex(bytes),
      });
      evidenceIds.add(member.dimension_evidence_id);
      previousId = member.dimension_evidence_id;
    }
  }
  if (!same(profileSet.dimension_evidence_bindings, expectedBindings)) {
    fail(code, 'WORK3:dimension evidence package inventory closure');
  }
}

function validateRichArtifactCategories(bindings, contract, code) {
  const standardContract = contract.standard_binding_contract;
  const artifactContract = contract.artifact_bindings_contract;
  if (!same(standardContract?.exact_keys, RECORD_BINDING_KEYS)
      || standardContract.record_fields
        !== 'NULL_FOR_CODE_TEST_AND_RAW_FIXTURE_OTHERWISE_EXACT_NATIVE_SCHEMA_ID_FIELD_AND_ID'
      || !Array.isArray(artifactContract?.record_id_categories)) {
    fail(code, 'WORK3:artifact category authority');
  }
  const expectedByPath = new Map();
  let rawRemainderSeen = false;
  for (const category of artifactContract.record_id_categories) {
    if (exactKeys(category, ['remaining_code_test_and_raw_fixture_paths'])) {
      if (rawRemainderSeen
          || category.remaining_code_test_and_raw_fixture_paths
            !== 'NULL_SCHEMA_AND_ID_FIELDS') {
        fail(code, 'WORK3:raw artifact category authority');
      }
      rawRemainderSeen = true;
      continue;
    }
    if (!Array.isArray(category?.paths) || category.paths.length === 0
        || new Set(category.paths).size !== category.paths.length) {
      fail(code, 'WORK3:artifact category paths');
    }
    let categoryFields;
    if (exactKeys(category, ['paths', 'record_id_field', 'schema_version'])) {
      if (typeof category.schema_version !== 'string'
          || typeof category.record_id_field !== 'string') {
        fail(code, 'WORK3:artifact category record fields');
      }
      categoryFields = category.paths.map((repositoryPath) => ({
        path: repositoryPath,
        schema_version: category.schema_version,
        record_id_field: category.record_id_field,
      }));
    } else if (exactKeys(category, ['paths', 'schema_and_id_fields'])
        && Array.isArray(category.schema_and_id_fields)
        && category.schema_and_id_fields.length === category.paths.length
        && same(category.schema_and_id_fields.map((entry) => entry?.path), category.paths)) {
      categoryFields = category.schema_and_id_fields;
    } else {
      fail(code, 'WORK3:artifact category shape');
    }
    for (const fields of categoryFields) {
      if (!exactKeys(fields, ['path', 'record_id_field', 'schema_version'])
          || typeof fields.path !== 'string'
          || typeof fields.schema_version !== 'string'
          || typeof fields.record_id_field !== 'string'
          || expectedByPath.has(fields.path)) {
        fail(code, 'WORK3:artifact category overlap');
      }
      expectedByPath.set(fields.path, fields);
    }
  }
  if (!rawRemainderSeen
      || [...expectedByPath.keys()].some(
        (repositoryPath) => !artifactContract.paths.includes(repositoryPath),
      )) {
    fail(code, 'WORK3:artifact category coverage');
  }
  for (const binding of bindings) {
    const expected = expectedByPath.get(binding.path);
    if (expected === undefined) {
      if (binding.schema_version !== null
          || binding.record_id_field !== null
          || binding.record_id !== null) {
        fail(code, `${binding.path}:raw artifact record fields`);
      }
    } else if (binding.schema_version !== expected.schema_version
        || binding.record_id_field !== expected.record_id_field
        || !HASH_64.test(binding.record_id || '')) {
      fail(code, `${binding.path}:governed artifact record fields`);
    }
  }
}

function validateRichFamilyApprovals(packagesByPath, scope, code) {
  const packageContract = scope?.family_profile_package_contract;
  const approvalContract = packageContract?.family_approval_contract;
  const allowedDecisionClasses = approvalContract?.approved_decision_classes
    ?.allowed_parent_work3_classes;
  if (packageContract?.ben_approval_id_preassignment_global_contract
        !== 'EXACTLY_25_NON_EMPTY_VALUES_GLOBALLY_UNIQUE_ACROSS_THE_25_FAMILY_PACKAGES'
      || approvalContract?.schema_version
        !== 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1'
      || approvalContract.record_id_field !== 'family_approval_id'
      || approvalContract.approver !== 'BEN_GOODCHILD'
      || approvalContract.content_identity !== 'CONTENT_ID_OF_SCHEMA_AND_UNSIGNED_APPROVAL'
      || approvalContract.approved_inventory_digest
        !== 'SHA256_OF_UTF8_CANONICAL_JSON_OF_EXACT_SORTED_INVENTORY_PAYLOAD_WITH_NO_TRAILING_LF_AND_NO_CONTENT_ID_PREFIX'
      || approvalContract.approved_inventory_digest_encoding
        !== 'LOWERCASE_HEX_SHA256_64'
      || !Array.isArray(approvalContract.exact_keys)
      || !Array.isArray(approvalContract.approved_inventory_digest_payload_exact_keys)
      || !Array.isArray(allowedDecisionClasses)
      || new Set(allowedDecisionClasses).size !== allowedDecisionClasses.length) {
    fail(code, 'WORK3:family approval authority');
  }
  const benApprovalIds = new Set();
  for (const [containerPath, packageRecord] of packagesByPath) {
    const approval = packageRecord.family_approval;
    const decisionClasses = approval?.approved_decision_classes;
    if (!exactKeys(approval, approvalContract.exact_keys)
        || approval.schema_version !== approvalContract.schema_version
        || !HASH_64.test(approval.family_approval_id || '')
        || typeof approval.ben_approval_id !== 'string'
        || approval.ben_approval_id.trim().length === 0
        || benApprovalIds.has(approval.ben_approval_id)
        || approval.family_key !== packageRecord.family_key
        || approval.profile_set_version !== packageRecord.profile_set_version
        || approval.approver !== approvalContract.approver
        || !/^\d{4}-\d{2}-\d{2}$/.test(approval.approved_on || '')
        || typeof approval.approval_text !== 'string'
        || approval.approval_text.trim().length === 0
        || !HASH_64.test(approval.approved_inventory_digest || '')
        || !Array.isArray(decisionClasses)
        || !decisionClasses.every(
          (decisionClass) => typeof decisionClass === 'string'
            && allowedDecisionClasses.includes(decisionClass),
        )
        || !same(decisionClasses, [...new Set(decisionClasses)].sort())) {
      fail(code, `${containerPath}:family approval`);
    }
    const unsignedApproval = clone(approval);
    delete unsignedApproval.family_approval_id;
    if (contentId(approval.schema_version, unsignedApproval)
        !== approval.family_approval_id) {
      fail(code, `${containerPath}:family approval identity`);
    }
    const memberArrays = [
      'legal_decisions', 'profiles', 'match_fixtures', 'dimension_evidence',
      'structure_fixture_members',
    ];
    if (!memberArrays.every((field) => Array.isArray(packageRecord[field]))
        || !isPlainObject(packageRecord.subtype_tree)
        || !same(packageRecord.legal_decisions,
          [...new Set(packageRecord.legal_decisions)].sort())
        || !packageRecord.legal_decisions.every(
          (decision) => typeof decision === 'string' && decision.length > 0,
        )) {
      fail(code, `${containerPath}:approved inventory inputs`);
    }
    const approvedInventory = {
      family_key: packageRecord.family_key,
      profile_set_version: packageRecord.profile_set_version,
      legal_decisions: packageRecord.legal_decisions,
      profile_ids: packageRecord.profiles.map((profile) => profile?.profile_id),
      subtype_tree_id: packageRecord.subtype_tree.subtype_tree_id,
      match_fixture_record_ids: packageRecord.match_fixtures.map(
        (fixtureRecord) => fixtureRecord?.match_fixture_id,
      ),
      dimension_evidence_ids: packageRecord.dimension_evidence.map(
        (evidence) => evidence?.dimension_evidence_id,
      ),
      structure_fixture_ids: packageRecord.structure_fixture_members.map(
        (fixtureRecord) => fixtureRecord?.fixture_id,
      ),
    };
    if (!exactKeys(
      approvedInventory,
      approvalContract.approved_inventory_digest_payload_exact_keys,
    )
        || approval.approved_inventory_digest
          !== sha256Hex(canonicalJson(approvedInventory))) {
      fail(code, `${containerPath}:approved inventory digest`);
    }
    benApprovalIds.add(approval.ben_approval_id);
  }
  if (packagesByPath.size !== CANDIDATE_FAMILIES.length
      || benApprovalIds.size !== CANDIDATE_FAMILIES.length) {
    fail(code, 'WORK3:global Ben approval IDs');
  }
}

function validateRichWork3ReceiptEnvelopeAndIdentity(receipt, code) {
  if (!exactKeys(receipt, RICH_WORK3_RECEIPT_KEYS)
      || receipt.schema_version !== RICH_WORK3_RECEIPT_SCHEMA
      || receipt.work !== 'WORK3'
      || receipt.stage !== 'M7_V2_REPAIR_WORK3'
      || receipt.state !== 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE'
      || receipt.status !== 'PASS') {
    fail(code, 'WORK3:rich receipt envelope');
  }
  validateContentIdOnly(receipt, 'work3_receipt_id', code, 'WORK3:receipt identity');
}

function validateRichWork3Receipt(root, receipt, manifest, code) {
  validateRichWork3ReceiptEnvelopeAndIdentity(receipt, code);
  const authorityBinding = manifest.work3_entry_correction_authority_binding;
  if (!same(authorityBinding, WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING)) {
    fail(code, 'WORK3:fixed C3 authority binding');
  }
  const { record: authority } = validateRichBinding(root, authorityBinding, code, {
    path: WORK3_ENTRY_CORRECTION_AUTHORITY_PATH,
    schema_version: WORK3_ENTRY_CORRECTION_AUTHORITY_SCHEMA,
    record_id_field: 'correction_authority_id',
  });
  const contract = authority?.work3_scope_contract?.rich_work3_receipt_contract;
  if (!isPlainObject(contract)
      || !same(contract.exact_keys, RICH_WORK3_RECEIPT_KEYS)
      || contract.top_level_key_count !== RICH_WORK3_RECEIPT_KEYS.length
      || contract.identity_contract
        !== 'CANONICAL_JSON_PLUS_LF_AND_WORK3_RECEIPT_ID_EQUALS_CONTENT_ID_OF_SCHEMA_AND_UNSIGNED_RECORD'
      || receipt.schema_version !== contract.schema_version
      || receipt.work !== contract.work
      || receipt.stage !== contract.stage
      || receipt.state !== contract.state
      || receipt.status !== contract.status) {
    fail(code, 'WORK3:rich receipt authority');
  }
  const scope = authority.work3_scope_contract;
  const manifestContract = scope.work3_manifest_contract;
  const orderingAuthorityBinding = scope.candidate_ordering_authority_overlay
    ?.base_authority_binding;
  if (!isPlainObject(manifestContract)
      || !same(manifest.parent_authority_binding, manifestContract.parent_authority_binding)
      || !same(manifest.activation_receipt_binding,
        manifestContract.activation_receipt_binding)
      || !same(manifest.predecessor_receipt_binding,
        manifestContract.predecessor_receipt_binding)
      || !same(manifest.candidate_ordering_correction_authority_binding,
        manifestContract.candidate_ordering_correction_authority_binding)
      || !same(manifest.candidate_ordering_correction_authority_binding,
        orderingAuthorityBinding)
      || !same(manifest.exact_argv_with_run_limits,
        manifestContract.exact_argv_with_run_limits)) {
    fail(code, 'WORK3:manifest lineage authority');
  }
  const expectedResolvedManifest = expectedWork3Manifest(authority, authorityBinding);
  if (!same(manifest, expectedResolvedManifest)) {
    const driftedFields = [...new Set([
      ...Object.keys(manifest),
      ...Object.keys(expectedResolvedManifest),
    ])].filter((key) => !Object.hasOwn(manifest, key)
      || !Object.hasOwn(expectedResolvedManifest, key)
      || !same(manifest[key], expectedResolvedManifest[key]));
    fail(code, `WORK3:resolved manifest C3 equality:${driftedFields.join(',')}`);
  }
  validateRichBinding(root, manifest.activation_receipt_binding, code, {
    path: manifestContract.activation_receipt_binding.path,
    schema_version: manifestContract.activation_receipt_binding.schema_version,
    record_id_field: manifestContract.activation_receipt_binding.record_id_field,
  });
  validateRichBinding(root, manifest.predecessor_receipt_binding, code, {
    path: manifestContract.predecessor_receipt_binding.path,
    schema_version: manifestContract.predecessor_receipt_binding.schema_version,
    record_id_field: manifestContract.predecessor_receipt_binding.record_id_field,
  });
  validateRichBinding(root, manifest.candidate_ordering_correction_authority_binding, code, {
    path: orderingAuthorityBinding.path,
    schema_version: orderingAuthorityBinding.schema_version,
    record_id_field: orderingAuthorityBinding.record_id_field,
  });
  if (receipt.execution_manifest_id !== manifest.execution_manifest_id
      || receipt.execution_manifest_digest !== manifest.execution_manifest_digest
      || !same(receipt.parent_authority_binding, manifest.parent_authority_binding)
      || !same(receipt.activation_receipt_binding, manifest.activation_receipt_binding)
      || !same(receipt.predecessor_receipt_binding, manifest.predecessor_receipt_binding)
      || !same(receipt.candidate_ordering_correction_authority_binding,
        manifest.candidate_ordering_correction_authority_binding)
      || !same(receipt.work3_entry_correction_authority_binding,
        manifest.work3_entry_correction_authority_binding)
      || manifest.candidate_registration_binding !== null
      || manifest.candidate_transition !== null) {
    fail(code, 'WORK3:rich receipt lineage');
  }

  const nativeEvidence = receipt.candidate_native_set_evidence;
  const nativeContract = contract.candidate_native_set_evidence_contract;
  if (!same(nativeContract?.exact_keys, RICH_NATIVE_SET_EVIDENCE_KEYS)
      || !exactKeys(nativeEvidence, nativeContract.exact_keys)
      || !['sealed_agreement_ids', 'additive_agreement_ids', 'combined_agreement_ids']
        .every((key) => Array.isArray(nativeEvidence[key]))
      || !same(nativeEvidence.sealed_agreement_ids, nativeContract.sealed_agreement_ids)
      || !same(nativeEvidence.additive_agreement_ids, nativeContract.additive_agreement_ids)
      || !same(nativeEvidence.combined_agreement_ids, nativeContract.combined_agreement_ids)
      || nativeEvidence.extension_proof !== nativeContract.extension_proof
      || !same([
        nativeEvidence.work2_agreement_analysis_set_binding,
        nativeEvidence.work2_context_compilation_set_binding,
      ], nativeContract.work2_bindings)) {
    fail(code, 'WORK3:native set evidence');
  }
  const nativeSetRecords = RICH_NATIVE_SET_EVIDENCE_KEYS.slice(0, 5).map(
    (key) => validateRichBinding(root, nativeEvidence[key], code).record,
  );
  const work3NativeBindings = [
    nativeEvidence.work3_agreement_index_set_binding,
    nativeEvidence.work3_context_compilation_set_binding,
    nativeEvidence.work3_agreement_analysis_set_binding,
  ];
  if (!work3NativeBindings.every((binding, index) => {
    const expected = nativeContract.work3_binding_contracts[index];
    return binding.path === expected.path
      && binding.schema_version === expected.schema_version
      && binding.record_id_field === expected.record_id_field;
  })) {
    fail(code, 'WORK3:native set binding contracts');
  }
  validateRichNativeSetEvidence(
    root,
    authority,
    nativeContract,
    nativeEvidence,
    nativeSetRecords.slice(2),
    code,
  );

  const familyEvidence = receipt.family_profile_evidence;
  const familyContract = contract.family_profile_evidence_contract;
  if (!same(familyContract?.exact_keys, RICH_FAMILY_PROFILE_EVIDENCE_KEYS)
      || !exactKeys(familyEvidence, familyContract.exact_keys)
      || !same(familyContract.family_keys, CANDIDATE_FAMILIES)
      || !same(familyEvidence.family_keys, familyContract.family_keys)
      || !Array.isArray(familyEvidence.family_profile_package_bindings)
      || familyEvidence.family_profile_package_bindings.length !== CANDIDATE_FAMILIES.length) {
    fail(code, 'WORK3:family profile evidence');
  }
  const packagesByPath = new Map();
  const familyPackageSources = [];
  for (let index = 0; index < CANDIDATE_FAMILIES.length; index += 1) {
    const familyKey = CANDIDATE_FAMILIES[index];
    const binding = familyEvidence.family_profile_package_bindings[index];
    const { bytes, record: packageRecord } = validateRichBinding(root, binding, code, {
      schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
      record_id_field: 'family_profile_package_id',
    });
    if (!exactKeys(packageRecord, RICH_FAMILY_PACKAGE_KEYS)
        || packageRecord.state !== 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE'
        || packageRecord.family_key !== familyKey
        || packagesByPath.has(binding.path)) {
      fail(code, `${familyKey}:outer package`);
    }
    packagesByPath.set(binding.path, packageRecord);
    familyPackageSources.push({ binding, bytes, record: packageRecord });
  }
  validateRichFamilyApprovals(packagesByPath, scope, code);
  const profileSetBinding = familyEvidence.approved_family_profile_set_binding;
  const { record: profileSet } = validateRichBinding(root, profileSetBinding, code, {
    schema_version: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
    record_id_field: 'family_profile_set_id',
  });
  if (!exactKeys(profileSet, RICH_APPROVED_PROFILE_SET_KEYS)
      || profileSet.state !== 'BEN_APPROVED_PROFILE_SET'
      || !same(profileSet.family_profile_package_bindings,
        familyEvidence.family_profile_package_bindings)
      || !Array.isArray(profileSet.profiles)
      || !Array.isArray(profileSet.dimension_evidence_bindings)
      || !Array.isArray(profileSet.subtype_tree_bindings)
      || profileSet.subtype_tree_bindings.length !== CANDIDATE_FAMILIES.length
      || !same(profileSet.subtype_tree_bindings.map((entry) => entry?.family_key),
        CANDIDATE_FAMILIES)) {
    fail(code, 'WORK3:approved family profile set');
  }
  validateRichApprovedProfileInventory(
    profileSet,
    familyEvidence,
    packagesByPath,
    scope,
    familyContract,
    code,
  );
  validateRichDimensionEvidenceInventory(
    profileSet,
    familyEvidence,
    packagesByPath,
    scope,
    code,
  );
  for (let index = 0; index < CANDIDATE_FAMILIES.length; index += 1) {
    const entry = profileSet.subtype_tree_bindings[index];
    if (!exactKeys(entry, ['family_key', 'binding'])) {
      fail(code, `${CANDIDATE_FAMILIES[index]}:subtype tree entry`);
    }
    validateRichPackageMember(
      entry.binding,
      packagesByPath,
      CANDIDATE_FAMILIES[index],
      code,
    );
  }
  const structureContract = contract.structure_disposition_set_binding_contract;
  const { record: structureRecord } = validateRichBinding(
    root,
    receipt.structure_disposition_set_binding,
    code,
    {
      path: structureContract.path,
      schema_version: structureContract.schema_version,
      record_id_field: structureContract.record_id_field,
    },
  );
  validateRichStructureDispositionSet(
    structureRecord,
    packagesByPath,
    authority,
    contract,
    nativeSetRecords[2],
    code,
  );
  validateRichFamilyProfilePackageSemantics(
    root,
    authority,
    familyPackageSources,
    profileSet,
    structureRecord,
    nativeSetRecords[2],
    code,
  );

  const artifactContract = contract.artifact_bindings_contract;
  if (!Array.isArray(receipt.artifact_bindings)
      || receipt.artifact_bindings.length !== artifactContract.count
      || !same(receipt.artifact_bindings.map((binding) => binding?.path),
        artifactContract.paths)
      || new Set(receipt.artifact_bindings.map((binding) => binding?.path)).size
        !== receipt.artifact_bindings.length) {
    fail(code, 'WORK3:artifact bindings');
  }
  validateRichArtifactCategories(receipt.artifact_bindings, contract, code);
  for (const binding of receipt.artifact_bindings) validateRichBinding(root, binding, code);
  if (receipt.artifact_set_digest !== sha256Hex(canonicalJson(receipt.artifact_bindings))) {
    fail(code, 'WORK3:artifact set digest');
  }
  const artifactBindingsByPath = new Map(
    receipt.artifact_bindings.map((binding) => [binding.path, binding]),
  );
  const syntheticAgreementIndexBinding = contract.structure_disposition_set_binding_contract
    .synthetic_agreement_index_binding;
  if (!isPlainObject(syntheticAgreementIndexBinding)
      || !same(
        artifactBindingsByPath.get(syntheticAgreementIndexBinding.path),
        syntheticAgreementIndexBinding,
      )) {
    fail(code, 'WORK3:synthetic agreement index binding');
  }
  const approvedSetContract = scope.approved_family_profile_set_contract;
  if (!same(approvedSetContract?.family_key_order, CANDIDATE_FAMILIES)
      || !Array.isArray(approvedSetContract.package_path_mapping)
      || approvedSetContract.package_path_mapping.length !== CANDIDATE_FAMILIES.length) {
    fail(code, 'WORK3:family package path authority');
  }
  for (let index = 0; index < CANDIDATE_FAMILIES.length; index += 1) {
    const familyKey = CANDIDATE_FAMILIES[index];
    const binding = familyEvidence.family_profile_package_bindings[index];
    const mapping = approvedSetContract.package_path_mapping[index];
    if (!exactKeys(mapping, ['family_key', 'path'])
        || mapping.family_key !== familyKey
        || binding.path !== mapping.path
        || !same(binding, artifactBindingsByPath.get(mapping.path))) {
      fail(code, `${familyKey}:package path and artifact binding`);
    }
  }
  if (profileSetBinding.path !== approvedSetContract.path
      || profileSetBinding.schema_version !== approvedSetContract.schema_version
      || profileSetBinding.record_id_field !== approvedSetContract.record_id_field
      || profileSet.state !== approvedSetContract.state
      || !same(profileSetBinding, artifactBindingsByPath.get(approvedSetContract.path))) {
    fail(code, 'WORK3:approved family profile set physical binding');
  }

  const ledgerContract = contract.command_execution_ledger_contract;
  if (!Array.isArray(receipt.command_execution_ledger)
      || receipt.command_execution_ledger.length !== ledgerContract.entry_count
      || !same(receipt.command_execution_ledger.map((entry) => entry?.argv),
        ledgerContract.argv_order)
      || !receipt.command_execution_ledger.every(
        (entry) => exactKeys(entry, ledgerContract.entry_exact_keys),
      )
      || !receipt.command_execution_ledger.every(
        (entry) => Number.isSafeInteger(entry.run_count) && entry.run_count >= 0,
      )) {
    fail(code, 'WORK3:command ledger');
  }
  const runCountFixtureBinding = artifactBindingsByPath.get(WORK3_PROFILE_FIXTURE_PATH);
  const runCountFixture = parseCanonical(
    readSafe(root, WORK3_PROFILE_FIXTURE_PATH),
    code,
    WORK3_PROFILE_FIXTURE_PATH,
  );
  if (ledgerContract.run_counts_byte_equal_fixture !== true
      || !runCountFixtureBinding
      || !artifactContract.paths.includes(WORK3_PROFILE_FIXTURE_PATH)
      || !Array.isArray(runCountFixture.command_run_counts)
      || !runCountFixture.command_run_counts.every(
        (runCount) => Number.isSafeInteger(runCount) && runCount >= 0,
      )
      || !canonicalBytes(runCountFixture.command_run_counts).equals(canonicalBytes(
        receipt.command_execution_ledger.map((entry) => entry.run_count),
      ))) {
    fail(code, 'WORK3:command run counts fixture');
  }
  for (const range of ledgerContract.state_ranges) {
    for (let index = range.indices[0]; index <= range.indices[1]; index += 1) {
      if (receipt.command_execution_ledger[index]?.state !== range.state) {
        fail(code, `WORK3:command ledger state ${index}`);
      }
    }
  }
  const bootstrapCommandLimits = authority.execution_policy?.bootstrap_commands;
  const authorisedCommandLimits = [
    ...(Array.isArray(bootstrapCommandLimits) ? bootstrapCommandLimits.map((entry) => ({
      argv: entry?.argv,
      max_runs: entry?.maximum_runs,
    })) : []),
    ...manifestContract.exact_argv_with_run_limits,
  ];
  if (ledgerContract.run_counts_safe_nonnegative_and_within_corresponding_maximum
        !== true
      || !Array.isArray(bootstrapCommandLimits)
      || !bootstrapCommandLimits.every(
        (entry) => exactKeys(entry, ['argv', 'maximum_runs'])
          && Array.isArray(entry.argv)
          && Number.isSafeInteger(entry.maximum_runs)
          && entry.maximum_runs >= 0,
      )
      || !manifestContract.exact_argv_with_run_limits.every(
        (entry) => exactKeys(entry, ['argv', 'max_runs'])
          && Array.isArray(entry.argv)
          && Number.isSafeInteger(entry.max_runs)
          && entry.max_runs >= 0,
      )
      || !same(authorisedCommandLimits.map((entry) => entry.argv),
        ledgerContract.argv_order)
      || authorisedCommandLimits.some(
        (limit, index) => receipt.command_execution_ledger[index].run_count > limit.max_runs,
      )) {
    fail(code, 'WORK3:command ledger maxima');
  }
  if (Number.isSafeInteger(ledgerContract.bootstrap_counts_minimum)) {
    for (let index = 0; index <= 3; index += 1) {
      if (receipt.command_execution_ledger[index].run_count
          < ledgerContract.bootstrap_counts_minimum) {
        fail(code, `WORK3:bootstrap command count ${index}`);
      }
    }
  }
  if (Number.isSafeInteger(ledgerContract.pre_receipt_work3_command_counts_minimum)) {
    for (let index = 4; index <= 18; index += 1) {
      if (receipt.command_execution_ledger[index].run_count
          < ledgerContract.pre_receipt_work3_command_counts_minimum) {
        fail(code, `WORK3:pre-receipt command count ${index}`);
      }
    }
  }
  if (Array.isArray(ledgerContract.finaliser_run_count_range)
      && (receipt.command_execution_ledger[19].run_count
        < ledgerContract.finaliser_run_count_range[0]
        || receipt.command_execution_ledger[19].run_count
          > ledgerContract.finaliser_run_count_range[1])) {
    fail(code, 'WORK3:finaliser command count');
  }
  if (Number.isSafeInteger(ledgerContract.required_post_receipt_validator_run_count)
      && receipt.command_execution_ledger[20].run_count
        !== ledgerContract.required_post_receipt_validator_run_count) {
    fail(code, 'WORK3:post-receipt validator count');
  }
  const combinedContract = contract.combined_test_result_contract;
  if (!exactKeys(receipt.combined_test_result, combinedContract.exact_keys)
      || !same(receipt.combined_test_result.argv, combinedContract.argv)
      || receipt.combined_test_result.semantic_run_count !== combinedContract.semantic_run_count
      || receipt.combined_test_result.status !== combinedContract.status
      || receipt.combined_test_result.test_file_count !== combinedContract.test_file_count) {
    fail(code, 'WORK3:combined test result');
  }
  const repositoryContract = contract.repository_precondition_contract;
  if (!exactKeys(receipt.repository_precondition, repositoryContract.exact_keys)
      || !repositoryContract.exact_keys.every(
        (key) => same(receipt.repository_precondition[key], repositoryContract[key]),
      )) {
    fail(code, 'WORK3:repository precondition');
  }
  const countsContract = contract.counts_contract;
  if (!exactKeys(receipt.counts, countsContract.exact_keys)
      || !Object.entries(countsContract.exact_values).every(
        ([key, value]) => receipt.counts[key] === value,
      )
      || receipt.counts.structure_disposition_member_count !== structureRecord.members.length) {
    fail(code, 'WORK3:counts');
  }
  if (!same(receipt.checks, contract.checks_contract.exact_ordered_checks)) {
    fail(code, 'WORK3:checks');
  }
  if (!exactKeys(receipt.effects, contract.effects_contract.exact_keys)
      || !same(receipt.effects, contract.effects_contract.exact_values)) {
    fail(code, 'WORK3:effects');
  }
  if (!exactKeys(receipt.next_work, contract.next_work_contract.exact_keys)
      || !same(receipt.next_work, contract.next_work_contract.exact_values)) {
    fail(code, 'WORK3:next work');
  }
  if (receipt.candidate_registration_id !== contract.candidate_registration_id
      || receipt.candidate_transition !== contract.candidate_transition) {
    fail(code, 'WORK3:null candidate and transition');
  }
}

function validateWork2ReceiptLineage(
  root, receipt, binding, priorManifest, code,
  work3EntryCorrectionAuthorityBinding = null,
  work3EntryCorrectionAuthority = null,
) {
  let result;
  try {
    result = work3EntryCorrectionAuthorityBinding === null
      ? validateWork2ReceiptBinding({ repoRoot: root, binding })
      : validateWork2SuccessorReceiptBinding({
        repoRoot: root,
        binding,
        work3EntryCorrectionAuthorityBinding,
      });
  } catch (error) {
    fail(code, `Work2 receipt validation: ${error.code ?? error.message}`);
  }
  if ((work3EntryCorrectionAuthority !== null
      && !same(
        Object.keys(result),
        work3EntryCorrectionAuthority.work2_successor_snapshot?.result_exact_keys,
      ))
      || result.status !== 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE'
      || result.work2_receipt_id !== binding.record_id
      || result.work2_receipt_id !== receipt.work2_receipt_id
      || result.execution_manifest_id !== priorManifest.execution_manifest_id
      || result.agreement_analysis_set_id
        !== receipt.source_set_evidence.agreement_analysis_set_binding.record_id
      || result.context_compilation_set_id
        !== receipt.source_set_evidence.context_compilation_set_binding.record_id) {
    fail(code, 'Work2 validated receipt lineage');
  }
}

function validateWork3V2ReceiptLineage(root, receipt, binding, priorManifest, code) {
  if (binding.schema_version !== RICH_WORK3_RECEIPT_V2_SCHEMA
      || binding.record_id_field !== 'work3_receipt_id'
      || priorManifest.schema_version !== WORK3_CLOSURE_SUCCESSOR_SCHEMA
      || priorManifest.work !== 'WORK3'
      || priorManifest.work_receipt_path !== binding.path
      || receipt.schema_version !== RICH_WORK3_RECEIPT_V2_SCHEMA
      || receipt.work3_receipt_id !== binding.record_id) {
    fail(code, 'Work3 V2 predecessor version dispatch');
  }
  let result;
  try {
    result = validateWork3({ repoRoot: root, sourceCommit: WORK3_V2_FINAL_COMMIT });
  } catch (error) {
    fail(code, `Work3 V2 receipt validation: ${error.code ?? error.message}`);
  }
  const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!exactKeys(result, WORK3_V2_VALIDATION_KEYS)
      || result.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_WORK3_VALIDATION/V2'
      || result.status !== 'PASS'
      || result.work3_receipt_id !== binding.record_id
      || !nonNegativeInteger(result.family_package_count)
      || result.family_package_count <= 0
      || !nonNegativeInteger(result.profile_count)
      || result.profile_count <= 0
      || !nonNegativeInteger(result.artifact_binding_count)
      || !nonNegativeInteger(result.effective_path_count)
      || !nonNegativeInteger(result.create_once_output_count)) {
    fail(code, 'Work3 V2 validated receipt lineage');
  }
  return result;
}

function validateSemanticReceiptLineage({
  root, receipt, binding, priorManifest, permittedReadPaths, code,
  work3EntryCorrectionAuthorityBinding = null,
  work3EntryCorrectionAuthority = null,
}) {
  const number = workNumber(priorManifest.work);
  if (number === 3 && binding.schema_version === RICH_WORK3_RECEIPT_V2_SCHEMA) {
    return validateWork3V2ReceiptLineage(root, receipt, binding, priorManifest, code);
  }
  if (number === 3) {
    validateRichWork3ReceiptEnvelopeAndIdentity(receipt, code);
  }
  const idField = `work${number}_receipt_id`;
  const work4Correction = number === 4
    && priorManifest?.[WORK4_CORRECTION_MANIFEST_MEMBER] !== undefined;
  const expectedSchema = number === 2
    ? WORK2_COMPILER_RECEIPT_SCHEMA
    : number === 3
      ? RICH_WORK3_RECEIPT_SCHEMA
      : work4Correction
        ? WORK4_RECEIPT_V2_SCHEMA
        : `STAGE_2Y_M7_V2_REPAIR_WORK${number}_RECEIPT/V1`;
  const expectedKeys = number === 2
    ? WORK2_COMPILER_RECEIPT_KEYS
    : number === 3
      ? RICH_WORK3_RECEIPT_KEYS
      : work4Correction
        ? [...LATER_RECEIPT_KEYS, idField, ...WORK4_RECEIPT_V2_ADDITIONAL_KEYS]
        : [...LATER_RECEIPT_KEYS, idField];
  if (work4Correction
      && (!same(receipt[WORK4_CORRECTION_MANIFEST_MEMBER], WORK4_CORRECTION_AUTHORITY_BINDING)
        || recordBindingIsInvalid(receipt.superseded_work4_receipt_binding)
        || receipt.superseded_work4_receipt_binding.path !== WORK4_RECEIPT_PATH
        || receipt.superseded_work4_receipt_binding.schema_version !== WORK4_RECEIPT_V1_SCHEMA
        || binding.path !== WORK4_SUCCESSOR_RECEIPT_PATH)) {
    fail(code, 'Work4 correction receipt lineage');
  }
  const expectedState = number === 2
    ? 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE'
    : number === 3 ? 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE' : `PASS_WORK${number}`;
  const expectedCandidateId = priorManifest.candidate_registration_binding
    ?.registration_binding?.record_id ?? null;
  if (binding.schema_version !== expectedSchema
      || binding.record_id_field !== idField
      || priorManifest.work_receipt_path !== binding.path
      || !exactKeys(receipt, expectedKeys)
      || receipt.status !== 'PASS'
      || receipt.state !== expectedState
      || receipt.work !== priorManifest.work
      || receipt.execution_manifest_id !== priorManifest.execution_manifest_id
      || receipt.execution_manifest_digest !== priorManifest.execution_manifest_digest) {
    fail(code, `${priorManifest.work} predecessor receipt state`);
  }
  if (number === 2) {
    validateWork2ReceiptLineage(
      root,
      receipt,
      binding,
      priorManifest,
      code,
      work3EntryCorrectionAuthorityBinding,
      work3EntryCorrectionAuthority,
    );
    return null;
  }
  if (number === 3) {
    validateRichWork3Receipt(root, receipt, priorManifest, code);
    return null;
  }
  if (!same(receipt.candidate_ordering_correction_authority_binding,
    priorManifest.candidate_ordering_correction_authority_binding)
      || receipt.candidate_registration_id !== expectedCandidateId
      || !same(receipt.candidate_transition, priorManifest.candidate_transition)
      || (number === 3 && (expectedCandidateId !== null
        || receipt.candidate_transition !== null))
      || (number >= 4 && (expectedCandidateId === null
        || receipt.candidate_transition?.state !== 'PASS'))) {
    fail(code, `${priorManifest.work} candidate receipt lineage`);
  }
  return null;
}

function validateWork4CandidateTransitionAuthority(
  root, transition, wrapper, permittedReadPaths, orderingAuthorityBinding, work4Manifest,
  work4Correction = false,
) {
  const WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH = work4TransitionAuthorityPath(work4Correction);
  const WORK4_CANDIDATE_TRANSITION_ARGV = work4TransitionArgv(work4Correction);
  const authorityKeys = work4Correction
    ? [...WORK4_CANDIDATE_TRANSITION_AUTHORITY_KEYS, WORK4_CORRECTION_MANIFEST_MEMBER,
      'superseded_candidate_registration_binding']
    : WORK4_CANDIDATE_TRANSITION_AUTHORITY_KEYS;
  if (!exactKeys(transition, WORK4_PASS_TRANSITION_KEYS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4 candidate transition');
  }
  const binding = transition.authority_binding;
  if (binding?.path !== WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH
      || binding?.schema_version !== WORK4_CANDIDATE_TRANSITION_AUTHORITY_SCHEMA
      || binding?.record_id_field !== 'candidate_transition_authority_id') {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4 candidate transition authority binding');
  }
  const { record } = resolveLineageBinding(
    root,
    binding,
    permittedReadPaths,
    'CANDIDATE_BINDING_DRIFT',
    WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
  );
  const bootstrapBinding = record?.superseded_bootstrap_manifest_binding;
  const candidateBinding = wrapper?.registration_binding;
  if (recordBindingIsInvalid(candidateBinding)) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4 candidate registration binding');
  }
  let expectedBootstrapBinding = null;
  if (work4Manifest?.work === 'WORK4') {
    const bootstrap = clone(work4Manifest);
    bootstrap.candidate_registration_binding = null;
    bootstrap.candidate_transition = {
      authority_binding: clone(orderingAuthorityBinding),
      state: 'AUTHORISED_PENDING',
      transition_argv: [...WORK4_CANDIDATE_TRANSITION_ARGV],
      transition_run_limit: 1,
    };
    bootstrap.permitted_read_paths = work4Manifest.permitted_read_paths.filter(
      (repositoryPath) => repositoryPath !== WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH
        && repositoryPath !== candidateBinding?.path,
    ).sort();
    bootstrap.permitted_write_paths = [
      WORK4_CANDIDATE_TRANSITION_AUTHORITY_PATH,
      candidateBinding?.path,
    ].sort();
    bootstrap.exact_argv_with_run_limits = [
      {
        argv: ['node', VALIDATOR_PATH, work4ManifestPath(work4Correction)],
        max_runs: 3,
      },
      { argv: WORK4_CANDIDATE_TRANSITION_ARGV, max_runs: 1 },
    ];
    bootstrap.exact_git_commit_and_push_argv[0] = [
      'git', 'add', '--',
      ...[work4ManifestPath(work4Correction), ...bootstrap.permitted_write_paths].sort(),
    ];
    delete bootstrap.execution_manifest_id;
    delete bootstrap.execution_manifest_digest;
    const execution_manifest_digest = sha256Hex(canonicalJson(bootstrap));
    const withDigest = { ...bootstrap, execution_manifest_digest };
    const sealedBootstrap = {
      ...withDigest,
      execution_manifest_id: contentId(SCHEMA, withDigest),
    };
    const bootstrapBytes = Buffer.from(`${canonicalJson(sealedBootstrap)}\n`, 'utf8');
    expectedBootstrapBinding = recordBinding(
      work4ManifestPath(work4Correction),
      bootstrapBytes,
      sealedBootstrap,
      'execution_manifest_id',
    );
  }
  if (work4Correction
      && (!same(record[WORK4_CORRECTION_MANIFEST_MEMBER], WORK4_CORRECTION_AUTHORITY_BINDING)
        || recordBindingIsInvalid(record.superseded_candidate_registration_binding)
        || record.superseded_candidate_registration_binding.path
          !== `${CANDIDATE_ROOT}/${WORK4_SUPERSEDED_REGISTRATION_ID}.json`
        || record.superseded_candidate_registration_binding.record_id
          !== WORK4_SUPERSEDED_REGISTRATION_ID
        || candidateBinding?.record_id === WORK4_SUPERSEDED_REGISTRATION_ID)) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4 candidate correction transition authority');
  }
  if (!exactKeys(record, authorityKeys)
      || record.schema_version !== WORK4_CANDIDATE_TRANSITION_AUTHORITY_SCHEMA
      || record.state !== 'AUTHORISED_ONE_SHOT_WORK4_CANDIDATE_TRANSITION'
      || !same(record.candidate_ordering_correction_authority_binding,
        orderingAuthorityBinding)
      || recordBindingIsInvalid(bootstrapBinding)
      || bootstrapBinding.path !== work4ManifestPath(work4Correction)
      || bootstrapBinding.schema_version !== SCHEMA
      || bootstrapBinding.record_id_field !== 'execution_manifest_id'
      || (expectedBootstrapBinding !== null
        && !same(bootstrapBinding, expectedBootstrapBinding))
      || recordBindingIsInvalid(record.candidate_registration_preview_binding)
      || !same(record.candidate_registration_preview_binding, candidateBinding)
      || !same(record.candidate_registration_binding, candidateBinding)
      || !same(record.transition_argv, WORK4_CANDIDATE_TRANSITION_ARGV)
      || record.transition_run_limit !== 1
      || !same(record.effects, WORK4_CANDIDATE_TRANSITION_EFFECTS)
      || !same(transition.superseded_bootstrap_manifest_binding, bootstrapBinding)
      || !same(transition.candidate_registration_preview_binding, candidateBinding)
      || !same(transition.candidate_registration_binding, candidateBinding)
      || transition.state !== 'PASS'
      || !same(transition.transition_argv, WORK4_CANDIDATE_TRANSITION_ARGV)
      || transition.transition_run_count !== 1) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work4 candidate transition authority contract');
  }
  return record;
}

function validateCandidatePredecessorReceipt(
  root, authority, entry, index, permittedReadPaths, historical = false,
) {
  const receipt = entry.work === 'WORK3'
    ? readCandidateComponent(root, entry.binding, permittedReadPaths, historical)
    : resolveCandidateComponent(root, entry.binding, permittedReadPaths, historical);
  if (entry.work === 'WORK3'
      && entry.binding.schema_version === RICH_WORK3_RECEIPT_SCHEMA) {
    validateRichWork3ReceiptEnvelopeAndIdentity(receipt, 'CANDIDATE_BINDING_DRIFT');
  }
  if (index === 0) {
    const identity = restampedIdentity(
      receipt,
      'work1_contract_receipt_digest',
      'work1_contract_receipt_id',
    );
    if (!exactKeys(receipt, WORK1_RECEIPT_KEYS)
        || receipt.work1_contract_receipt_digest !== identity.digest
        || receipt.work1_contract_receipt_id !== identity.id
        || receipt.stage !== 'M7_V2_REPAIR_WORK1'
        || receipt.state !== 'PASS_WORK1_CONTRACTS'
        || receipt.status !== 'PASS'
        || receipt.next_work
          ?.work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof !== true
        || receipt.next_work?.work2_start_state_at_receipt_write
          !== 'LOCKED_PENDING_WORK1_MILESTONE_PROOF') {
      fail('CANDIDATE_BINDING_DRIFT', 'Work1 predecessor receipt state');
    }
    return;
  }

  const selectedPriorManifestPath = entry.work === 'WORK3'
    ? priorManifestPath('WORK4', entry.binding, 'CANDIDATE_BINDING_DRIFT')
    : executionManifestPath(entry.work);
  if (!permittedReadPaths.includes(selectedPriorManifestPath)) {
    fail('PATH_SCOPE_DRIFT', `candidate predecessor manifest read is not permitted: ${selectedPriorManifestPath}`);
  }
  const priorManifest = parseCanonical(
    readSafe(root, selectedPriorManifestPath),
    'CANDIDATE_BINDING_DRIFT',
    selectedPriorManifestPath,
  );
  if (selectedPriorManifestPath === WORK3_CLOSURE_SUCCESSOR_PATH) {
    validateWork3ClosureSuccessor(root, selectedPriorManifestPath);
  } else {
    const priorIdentity = restampedIdentity(
      priorManifest,
      'execution_manifest_digest',
      'execution_manifest_id',
    );
    if (!exactKeys(priorManifest, manifestMembers(
      authority.per_work_execution_manifest_policy,
      entry.work,
    ))
        || priorManifest.schema_version !== SCHEMA
        || priorManifest.work !== entry.work
        || priorManifest.state !== 'PRE_WORK_BOOTSTRAP_ONLY'
        || priorManifest.execution_manifest_digest !== priorIdentity.digest
        || priorManifest.execution_manifest_id !== priorIdentity.id) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.work} execution manifest`);
    }
  }
  const authorityBytes = readSafe(root, AUTHORITY_PATH);
  if (!same(priorManifest.parent_authority_binding,
    expectedAuthorityBinding(authority, authorityBytes))) {
    fail('CANDIDATE_BINDING_DRIFT', `${entry.work} parent authority`);
  }
  validateSemanticReceiptLineage({
    root,
    receipt,
    binding: entry.binding,
    priorManifest,
    permittedReadPaths,
    code: 'CANDIDATE_BINDING_DRIFT',
    work3EntryCorrectionAuthorityBinding: entry.work === 'WORK2'
      ? WORK3_ENTRY_CORRECTION_AUTHORITY_BINDING
      : null,
  });
}

function validateCandidateSubtypeTreeMember(root, entry, permittedReadPaths) {
  const binding = entry.binding;
  if (!exactKeys(binding, RICH_PACKAGE_MEMBER_BINDING_KEYS)
      || binding.schema_version !== RICH_PACKAGE_MEMBER_BINDING_SCHEMA
      || binding.member_field !== 'subtype_tree'
      || binding.member_index !== null
      || binding.member_schema_version !== 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1'
      || binding.member_record_id_field !== 'subtype_tree_id'
      || !HASH_64.test(binding.member_record_id || '')
      || !Number.isSafeInteger(binding.member_byte_length)
      || binding.member_byte_length <= 0
      || !HASH_64.test(binding.member_sha256 || '')) {
    fail('CANDIDATE_BINDING_DRIFT', 'subtype tree');
  }
  normaliseRepositoryPath(binding.container_path, 'CANDIDATE_BINDING_DRIFT');
  if (!permittedReadPaths.includes(binding.container_path)) {
    fail('PATH_SCOPE_DRIFT', `candidate package read is not permitted: ${binding.container_path}`);
  }
  const packageRecord = parseCanonical(
    readSafe(root, binding.container_path),
    'CANDIDATE_BINDING_DRIFT',
    binding.container_path,
  );
  const member = packageRecord?.subtype_tree;
  const bytes = Buffer.from(canonicalJson(member), 'utf8');
  if (packageRecord?.family_key !== entry.family_key
      || member?.schema_version !== binding.member_schema_version
      || member?.[binding.member_record_id_field] !== binding.member_record_id
      || member?.family_key !== entry.family_key
      || bytes.length !== binding.member_byte_length
      || sha256Hex(bytes) !== binding.member_sha256) {
    fail('CANDIDATE_BINDING_DRIFT', `${entry.family_key} subtype tree family`);
  }
  const unsigned = clone(member);
  delete unsigned[binding.member_record_id_field];
  if (contentId(binding.member_schema_version, unsigned) !== binding.member_record_id) {
    fail('CANDIDATE_BINDING_DRIFT', `${entry.family_key} subtype tree identity`);
  }
}

function validateFullCandidateRecord(
  root, authority, record, permittedReadPaths, historical = false,
) {
  // `import_closure_bindings` and its count are required on every registration
  // except the ones the replacement authority lists as superseded, which
  // predate the requirement.
  const declaresClosure = Object.hasOwn(record, CANDIDATE_IMPORT_CLOSURE_MEMBER);
  if (!declaresClosure && !historical) {
    fail('CANDIDATE_BINDING_DRIFT', CANDIDATE_IMPORT_CLOSURE_MEMBER);
  }
  if (!exactKeys(record, declaresClosure
    ? [...CANDIDATE_RECORD_KEYS, CANDIDATE_IMPORT_CLOSURE_MEMBER] : CANDIDATE_RECORD_KEYS)
      || record.schema_version !== CANDIDATE_SCHEMA
      || record.stage !== 'M7_V2_REPAIR'
      || record.lifecycle_state !== 'CANDIDATE_PENDING_REVIEW'
      || !exactKeys(record.code_bindings, CANDIDATE_CODE_KEYS)
      || !Array.isArray(record.code_bindings.runners)
      || !Array.isArray(record.code_bindings.tests)
      || !Array.isArray(record.semantic_input_bindings)
      || !Array.isArray(record.subtype_tree_bindings)
      || !Array.isArray(record.predecessor_receipt_bindings)
      || !exactKeys(record.counts, declaresClosure
        ? [...CANDIDATE_COUNT_KEYS, CANDIDATE_IMPORT_CLOSURE_COUNT] : CANDIDATE_COUNT_KEYS)
      || !same(record.effects, CANDIDATE_EFFECTS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'full candidate registration contract');
  }
  const work3ReceiptSchema = record.predecessor_receipt_bindings.find(
    (entry) => entry?.work === 'WORK3',
  )?.binding?.schema_version;
  if (![RICH_WORK3_RECEIPT_SCHEMA, RICH_WORK3_RECEIPT_V2_SCHEMA]
    .includes(work3ReceiptSchema)) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work3 predecessor receipt schema');
  }
  const candidateFamilies = work3ReceiptSchema === RICH_WORK3_RECEIPT_V2_SCHEMA
    ? CANDIDATE_SEALED_FAMILIES
    : CANDIDATE_FAMILIES;
  const fixed = [
    [record.parent_authority_binding, AUTHORITY_PATH,
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1', 'authority_id', AUTHORITY_ID,
      AUTHORITY_SHA256],
    [record.activation_receipt_binding, ACTIVATION_PATH,
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
      'activation_receipt_id', ACTIVATION_ID, ACTIVATION_SHA256],
    [record.work0_evidence_root_binding, WORK0_PATH,
      'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1', 'evidence_root_id', WORK0_ID,
      WORK0_SHA256],
  ];
  for (const [binding, repositoryPath, schemaVersion, idField, id, sha] of fixed) {
    validateCandidateInnerBinding(binding, repositoryPath);
    if (binding.path !== repositoryPath || binding.schema_version !== schemaVersion
        || binding.record_id_field !== idField || binding.record_id !== id
        || binding.sha256 !== sha) {
      fail('CANDIDATE_BINDING_DRIFT', repositoryPath);
    }
  }
  const expectedCodePaths = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    projector: 'lib/canonical-v2/agreement-projection.js',
    independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  };
  const flattened = [];
  for (const [role, repositoryPath] of Object.entries(expectedCodePaths)) {
    const binding = record.code_bindings[role];
    validateCandidateInnerBinding(binding, role);
    if (binding.path !== repositoryPath || binding.schema_version !== null) {
      fail('CANDIDATE_BINDING_DRIFT', role);
    }
    flattened.push(binding);
  }
  const expectedRunners = [
    'scripts/stage-2y-structure-family-aggregate.mjs',
    'scripts/stage-2y-structure-generalisation-shadow.mjs',
    'scripts/stage-2y-structure-m6-project.mjs',
  ];
  const predecessorCount = record.predecessor_receipt_bindings.length;
  const baselineTests = [
    'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
    'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
    'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
    ...(predecessorCount >= 2
      ? ['tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js'] : []),
    ...(predecessorCount >= 3
      ? ['tests/stage-2y-structure-m7-v2-repair-projection-dispatch.test.js'] : []),
    ...Array.from({ length: predecessorCount }, (_, index) => (
      `tests/stage-2y-structure-m7-v2-repair-work${index + 2}.test.js`
    )),
  ].sort();
  if (!same(record.code_bindings.runners.map((binding) => binding.path), expectedRunners)) {
    fail('CANDIDATE_BINDING_DRIFT', 'runners');
  }
  record.code_bindings.runners.forEach((binding) => validateCandidateInnerBinding(binding, 'runners'));
  if (record.code_bindings.runners.some((binding) => binding.schema_version !== null)) {
    fail('CANDIDATE_BINDING_DRIFT', 'runners');
  }
  flattened.push(...record.code_bindings.runners);
  // The tests roster is a naming rule, not a fixed path list: every bound
  // test must match the authority's tests/ file-prefix rule, and the
  // baseline the current work depth requires must be present, but extra
  // tests beyond the baseline are permitted (a different test roster).
  const boundTestPaths = record.code_bindings.tests.map((binding) => binding.path);
  if (record.code_bindings.tests.length === 0
      || new Set(boundTestPaths).size !== boundTestPaths.length
      || !same(boundTestPaths, [...boundTestPaths].sort())
      || !boundTestPaths.every((repositoryPath) => TEST_PATH_PATTERN.test(repositoryPath))
      || !baselineTests.every((repositoryPath) => boundTestPaths.includes(repositoryPath))) {
    fail('CANDIDATE_BINDING_DRIFT', 'tests');
  }
  record.code_bindings.tests.forEach((binding) => validateCandidateInnerBinding(binding, 'tests'));
  if (record.code_bindings.tests.some((binding) => binding.schema_version !== null)) {
    fail('CANDIDATE_BINDING_DRIFT', 'tests');
  }
  flattened.push(...record.code_bindings.tests);
  // The import closure is a roster of what the bound code can load, not a
  // second set of bound reads: it is checked for shape, order and coverage
  // here and re-derived independently by the candidate verifier. It stays out
  // of `flattened` so `unique_bound_path_count` keeps the meaning it has, and
  // so a closure member does not have to be a permitted read path.
  if (declaresClosure) {
    const closure = record[CANDIDATE_IMPORT_CLOSURE_MEMBER];
    const closurePaths = Array.isArray(closure)
      ? closure.map((binding) => binding?.path) : [];
    const codePaths = [
      ...CANDIDATE_CODE_SINGLETON_ROLES.map((role) => record.code_bindings[role].path),
      ...record.code_bindings.runners.map((binding) => binding.path),
      ...record.code_bindings.tests.map((binding) => binding.path),
    ];
    if (!Array.isArray(closure) || closure.length === 0
        || !isSortedUnique(closurePaths)
        || !closure.every((binding) => exactKeys(binding, CANDIDATE_IMPORT_CLOSURE_BINDING_KEYS)
          && Number.isSafeInteger(binding.byte_length) && binding.byte_length >= 0
          && HASH_64.test(binding.sha256) && HASH_40.test(binding.git_blob_oid))
        || !codePaths.every((repositoryPath) => closurePaths.includes(repositoryPath))) {
      fail('CANDIDATE_BINDING_DRIFT', CANDIDATE_IMPORT_CLOSURE_MEMBER);
    }
    for (const repositoryPath of closurePaths) {
      normaliseRepositoryPath(repositoryPath, 'CANDIDATE_BINDING_DRIFT');
    }
  }
  if (!same(record.semantic_input_bindings.map((entry) => entry.input_role),
    CANDIDATE_INPUT_ROLES)) {
    fail('CANDIDATE_BINDING_DRIFT', 'six semantic inputs');
  }
  for (const entry of record.semantic_input_bindings) {
    if (!exactKeys(entry, ['input_role', 'binding'])) {
      fail('CANDIDATE_BINDING_DRIFT', 'semantic input');
    }
    validateCandidateInnerBinding(entry.binding, entry.input_role);
    if (entry.binding.schema_version !== CANDIDATE_INPUT_SCHEMAS[entry.input_role]) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.input_role} schema`);
    }
    flattened.push(entry.binding);
  }
  if (!same(record.subtype_tree_bindings.map((entry) => entry.family_key),
    candidateFamilies)) {
    fail('CANDIDATE_BINDING_DRIFT', 'subtype tree closed set');
  }
  for (const entry of record.subtype_tree_bindings) {
    if (!exactKeys(entry, ['family_key', 'binding'])) {
      fail('CANDIDATE_BINDING_DRIFT', 'subtype tree');
    }
    validateCandidateSubtypeTreeMember(root, entry, permittedReadPaths);
    flattened.push(entry.binding);
  }
  const profileInput = record.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  )?.binding;
  const structureInput = record.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  )?.binding;
  if (!same(record.family_profile_set_binding, profileInput)
      || !same(record.structure_disposition_set_binding, structureInput)) {
    fail('CANDIDATE_BINDING_DRIFT', 'direct semantic bindings');
  }
  validateCandidateInnerBinding(record.view_policy_binding, 'view policy');
  if (record.view_policy_binding.schema_version !== 'STAGE_2Y_M7_V2_VIEW_POLICY/V1'
      || record.view_policy_binding.record_id_field !== 'view_policy_id') {
    fail('CANDIDATE_BINDING_DRIFT', 'view policy');
  }
  flattened.push(record.view_policy_binding);
  if (predecessorCount !== 3) {
    fail('CANDIDATE_BINDING_DRIFT', 'predecessor receipts');
  }
  record.predecessor_receipt_bindings.forEach((entry, index) => {
    if (!exactKeys(entry, ['work', 'binding']) || entry.work !== `WORK${index + 1}`) {
      fail('CANDIDATE_BINDING_DRIFT', 'predecessor receipt order');
    }
    validateCandidateInnerBinding(entry.binding, entry.work);
    if (index === 0) {
      if (entry.binding.path !== WORK1_RECEIPT_PATH
          || entry.binding.schema_version
            !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
          || entry.binding.record_id_field !== 'work1_contract_receipt_id') {
        fail('CANDIDATE_BINDING_DRIFT', 'Work1 predecessor receipt');
      }
    } else if (!new RegExp(
      `^evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work${index + 1}-[a-z0-9-]+\\.json$`,
    ).test(entry.binding.path)
      || entry.binding.schema_version !== (index === 1
        ? WORK2_COMPILER_RECEIPT_SCHEMA
        : work3ReceiptSchema)
      || entry.binding.record_id_field !== `work${index + 1}_receipt_id`) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.work} predecessor receipt`);
    }
    validateCandidatePredecessorReceipt(
      root, authority, entry, index, permittedReadPaths, historical,
    );
    flattened.push(entry.binding);
  });
  if (typeof record.allowed_output_root !== 'string'
      || !record.allowed_output_root.startsWith(
        'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/',
      )) {
    fail('CANDIDATE_BINDING_DRIFT', 'allowed output root');
  }
  flattened.unshift(
    record.parent_authority_binding,
    record.activation_receipt_binding,
    record.work0_evidence_root_binding,
  );
  // Independent recount: derived from the actual bound-binding lengths just
  // validated above (record.code_bindings.*, not the closed baseline lists),
  // never from a literal constant, so a candidate with a different test
  // roster, package count or path count recounts to its own true totals.
  const recountedCounts = {
    code_file_count: CANDIDATE_CODE_SINGLETON_ROLES.length
      + record.code_bindings.runners.length + record.code_bindings.tests.length,
    ...(declaresClosure
      ? { [CANDIDATE_IMPORT_CLOSURE_COUNT]: record[CANDIDATE_IMPORT_CLOSURE_MEMBER].length }
      : {}),
    runner_count: record.code_bindings.runners.length,
    test_count: record.code_bindings.tests.length,
    semantic_input_count: CANDIDATE_INPUT_ROLES.length,
    subtype_tree_count: candidateFamilies.length,
    predecessor_receipt_count: predecessorCount,
    unique_bound_path_count: new Set(
      flattened.map((binding) => binding.path ?? binding.container_path),
    ).size,
  };
  if (!same(record.counts, recountedCounts)) {
    fail('COUNT_RECOUNT', 'candidate counts');
  }
  if (flattened.some((binding) => !permittedReadPaths.includes(
    binding.path ?? binding.container_path,
  ))) {
    fail('PATH_SCOPE_DRIFT', 'candidate component read is absent from permitted_read_paths');
  }
  flattened.filter((binding) => binding.path !== undefined).forEach(
    (binding) => resolveCandidateComponent(root, binding, permittedReadPaths, historical),
  );
}

function validateCandidateVerification(verification, record, binding) {
  const work3ReceiptSchema = record.predecessor_receipt_bindings.find(
    (entry) => entry?.work === 'WORK3',
  )?.binding?.schema_version;
  const expectedCheckIds = work3ReceiptSchema === RICH_WORK3_RECEIPT_V2_SCHEMA
    ? CANDIDATE_VERIFICATION_CHECK_IDS.map((checkId) => (
      checkId === 'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS'
        ? 'EXACT_24_SEALED_PACKAGE_SUBTYPE_TREE_MEMBER_BINDINGS'
        : checkId
    ))
    : CANDIDATE_VERIFICATION_CHECK_IDS;
  if (!exactKeys(verification, [
    'schema_version', 'verification_id', 'state', 'candidate_registration_id',
    'registration_binding', 'checks', 'counts', 'effects',
  ])
      || verification.schema_version !== CANDIDATE_VERIFICATION_SCHEMA
      || verification.state !== 'PASS_CANDIDATE_REGISTRATION'
      || verification.candidate_registration_id !== record.candidate_registration_id
      || !same(verification.registration_binding, binding)
      || !same(verification.checks, expectedCheckIds.map(
        (check_id) => ({ check_id, status: 'PASS' }),
      ))
      || !same(verification.counts, record.counts)
      || !same(verification.effects, CANDIDATE_VERIFICATION_EFFECTS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'independent candidate verification');
  }
  validateContentIdOnly(
    verification,
    'verification_id',
    'CANDIDATE_BINDING_DRIFT',
    'independent candidate verification',
  );
}

function validateCandidate(
  root, authority, manifest, prior, existingCandidatePaths, replacement = null,
) {
  const wrapper = manifest.candidate_registration_binding;
  if (wrapper === null) return null;
  if (!exactKeys(wrapper, CANDIDATE_WRAPPER_KEYS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'candidate wrapper');
  }
  const binding = wrapper.registration_binding;
  // In the correction lineage the candidate root holds exactly the retained
  // superseded registration and the bound successor; otherwise exactly the
  // bound registration.
  const supersededPath = `${CANDIDATE_ROOT}/${WORK4_SUPERSEDED_REGISTRATION_ID}.json`;
  const corrected = existingCandidatePaths.includes(supersededPath)
    && binding?.path !== supersededPath;
  if (corrected) {
    // The retained superseded registration is tolerated only under the
    // pinned correction authority's exact bytes.
    validateRecordBinding(root, WORK4_CORRECTION_AUTHORITY_BINDING, 'CANDIDATE_BINDING_DRIFT');
  }
  const expectedCandidatePaths = corrected
    ? [supersededPath, binding?.path].sort()
    : [binding?.path];
  if (!same(existingCandidatePaths, expectedCandidatePaths)) {
    fail('CANDIDATE_BINDING_DRIFT', 'candidate registration root selection');
  }
  if (!manifest.permitted_read_paths.includes(binding.path)) {
    fail('PATH_SCOPE_DRIFT', 'candidate registration read is absent from permitted_read_paths');
  }
  const { record } = validateRecordBinding(root, binding, 'CANDIDATE_BINDING_DRIFT');
  const expectedPath = `${CANDIDATE_ROOT}/${binding.record_id}.json`;
  if (binding.path !== expectedPath || binding.schema_version !== CANDIDATE_SCHEMA
    || binding.record_id_field !== 'candidate_registration_id'
    || record.lifecycle_state !== authority.candidate_registration_policy.lifecycle_state) {
    fail('CANDIDATE_BINDING_DRIFT', binding.path);
  }
  validateContentIdOnly(record, 'candidate_registration_id', 'CANDIDATE_BINDING_DRIFT', binding.path);
  // A registration the replacement authority lists as superseded is
  // HISTORICAL: its own bytes must still be in the working tree unchanged,
  // but the files it binds are verified against the Git objects it named, so
  // an edit the authority permits to a bound file does not break the chain.
  const historical = replacement !== null
    && replacement.record.superseded_candidate_registration_ids.includes(binding.record_id);
  if (historical
      && binding.record_id === replacement.record.stop_record.stopped_candidate_registration_id) {
    validateRecordBinding(
      root,
      replacement.record.stop_record.stopped_candidate_registration_binding,
      'CANDIDATE_BINDING_DRIFT',
    );
  }
  validateFullCandidateRecord(
    root, authority, record, manifest.permitted_read_paths, historical,
  );
  validateCandidateVerification(wrapper.independent_verification, record, binding);
  return binding.record_id;
}

function validatePredecessor(root, authority, manifest, work3EntryCorrectionAuthority = null) {
  if (manifest.predecessor_receipt_binding === null) {
    fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  }
  if (!Array.isArray(manifest.permitted_read_paths)
      || !manifest.permitted_read_paths.includes(
        manifest.predecessor_receipt_binding.path,
      )) {
    fail('PATH_SCOPE_DRIFT', 'predecessor receipt read is absent from permitted_read_paths');
  }
  if (manifest.work !== 'WORK2') {
    const expectedPriorManifestPath = priorManifestPath(
      manifest.work,
      manifest.predecessor_receipt_binding,
      'PREDECESSOR_BINDING_DRIFT',
    );
    if (!manifest.permitted_read_paths.includes(expectedPriorManifestPath)) {
      fail('PATH_SCOPE_DRIFT', 'prior manifest read is absent from permitted_read_paths');
    }
  }
  const { record } = validateRecordBinding(
    root,
    manifest.predecessor_receipt_binding,
    'PREDECESSOR_BINDING_DRIFT',
  );
  if (manifest.work === 'WORK4'
      && manifest.predecessor_receipt_binding.schema_version === RICH_WORK3_RECEIPT_SCHEMA) {
    validateRichWork3ReceiptEnvelopeAndIdentity(record, 'PREDECESSOR_BINDING_DRIFT');
  }
  if (manifest.work === 'WORK2') {
    const identity = restampedIdentity(
      record,
      'work1_contract_receipt_digest',
      'work1_contract_receipt_id',
    );
    if (manifest.predecessor_receipt_binding.path !== WORK1_RECEIPT_PATH
      || manifest.predecessor_receipt_binding.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
      || manifest.predecessor_receipt_binding.record_id_field !== 'work1_contract_receipt_id'
      || !exactKeys(record, WORK1_RECEIPT_KEYS)
      || record.work1_contract_receipt_digest !== identity.digest
      || record.work1_contract_receipt_id !== identity.id
      || record.stage !== 'M7_V2_REPAIR_WORK1'
      || record.state !== 'PASS_WORK1_CONTRACTS'
      || record.status !== 'PASS'
      || record.next_work?.work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof
        !== true
      || record.next_work?.work2_start_state_at_receipt_write
        !== 'LOCKED_PENDING_WORK1_MILESTONE_PROOF') {
      fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
    }
    validateContentIdOnly(record, 'work1_contract_receipt_id',
      'PREDECESSOR_BINDING_DRIFT', WORK1_RECEIPT_PATH);
    return {
      prior: null, priorPath: null, priorState: null, predecessorReceipt: record,
    };
  }
  const priorState = readPriorManifest(
    root,
    authority,
    manifest.work,
    manifest.predecessor_receipt_binding,
  );
  const { record: prior, repositoryPath: priorPath } = priorState;
  const predecessorValidationResult = validateSemanticReceiptLineage({
    root,
    receipt: record,
    binding: manifest.predecessor_receipt_binding,
    priorManifest: prior,
    permittedReadPaths: manifest.permitted_read_paths,
    code: 'PREDECESSOR_BINDING_DRIFT',
    work3EntryCorrectionAuthorityBinding:
      work3EntryCorrectionAuthority === null
        ? null
        : manifest.work3_entry_correction_authority_binding,
    work3EntryCorrectionAuthority,
  });
  return {
    prior,
    priorPath,
    priorState,
    predecessorReceipt: record,
    predecessorValidationResult,
  };
}

export async function validateExecutionManifest(options) {
  if (!exactKeys(options, ['repoRoot', 'manifestPath'])) fail('INVALID_OPTIONS', 'options');
  const root = normaliseRoot(options.repoRoot);
  const manifestPath = normaliseRepositoryPath(options.manifestPath);
  if (manifestPath === WORK3_CLOSURE_SUCCESSOR_PATH) {
    return validateWork3ClosureSuccessor(root, manifestPath);
  }
  const authorityState = validateAuthority(root);
  const { authority } = authorityState;
  // The correction record is read whenever it is there, before anything is
  // decided by it. Recognition, not application: the line goes to the warning
  // stream because stdout carries one machine-read JSON result, exactly as
  // verify-candidate's HISTORICAL_SUPERSEDED_REGISTRATION does.
  const correction = readAuthorityCorrection(root);
  for (const line of correctionInfoLines(correction)) {
    process.stderr.write(`${line}\n`);
  }
  const replacement = readCandidateReplacementAuthority(
    root, authority, authorityState.bytes, correction,
  );
  const replacementManifestPaths = replacement === null
    ? []
    : replacement.record.phases.map((phase) => phase.successor_manifest_path);
  const candidateReplacement = replacementManifestPaths.includes(manifestPath);
  const work4Correction = manifestPath === WORK4_SUCCESSOR_MANIFEST_PATH;
  if (!work4Correction && !candidateReplacement
      && !authority.per_work_execution_manifest_policy.exact_paths.includes(manifestPath)) {
    fail('PATH_SCOPE_DRIFT', manifestPath);
  }
  const bytes = readSafe(root, manifestPath);
  const manifest = parseCanonical(bytes, 'MANIFEST_BYTES_DRIFT', manifestPath);
  // The replacement member may live only on one of the three successor
  // manifests the authority names; it cannot be smuggled onto a Work 1-7 one.
  if (!candidateReplacement && manifest[CANDIDATE_REPLACEMENT_MANIFEST_MEMBER] !== undefined) {
    fail('PATH_SCOPE_DRIFT', CANDIDATE_REPLACEMENT_MANIFEST_MEMBER);
  }
  if (!WORKS.includes(manifest.work)
      || (candidateReplacement
        ? manifestPath !== replacement.record.phases.find(
          (phase) => phase.work === manifest.work,
        )?.successor_manifest_path
        : manifestPath !== (work4Correction && manifest.work === 'WORK4'
          ? WORK4_SUCCESSOR_MANIFEST_PATH
          : executionManifestPath(manifest.work)))) {
    fail('MANIFEST_CONTRACT_DRIFT', manifestPath);
  }
  validateManifestIdentity(
    manifest, authority.per_work_execution_manifest_policy, manifest.work, work4Correction,
    candidateReplacement,
  );
  if (candidateReplacement) {
    validateCandidateReplacement(manifest, manifestPath, {
      root,
      authority,
      authorityBytes: authorityState.bytes,
      correction,
    });
  }
  const work3EntryCorrectionAuthority = manifest.work === 'WORK3'
    ? validateWork3EntryCorrection(root, manifest)
    : null;
  if (!same(manifest.parent_authority_binding,
    expectedAuthorityBinding(authority, authorityState.bytes))) {
    fail('AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  }
  if (work4Correction) validateWork4CandidateCorrection(root, manifest);
  const existingCandidatePaths = existingCandidateRegistrationPaths(root);
  const buildOnlyCandidateStageState = ['WORK2', 'WORK3'].includes(manifest.work)
    ? validateCandidateOrdering(root, manifest, null, existingCandidatePaths, null)
    : null;
  const declaredPriorPath = manifest.work === 'WORK2'
    ? null
    : priorManifestPath(
      manifest.work,
      manifest.predecessor_receipt_binding,
      'PREDECESSOR_BINDING_DRIFT',
    );
  if (work3EntryCorrectionAuthority !== null) {
    validateWork3PathScope(root, manifest, work3EntryCorrectionAuthority);
  }
  validateReadPaths(root, authority, manifestPath, manifest, declaredPriorPath);
  validateActivation(root, authority, manifest.activation_receipt_binding,
    manifest.activation_commit_binding);
  const {
    prior, priorPath, priorState, predecessorReceipt, predecessorValidationResult,
  } = validatePredecessor(root, authority, manifest, work3EntryCorrectionAuthority);
  if (priorPath !== declaredPriorPath) fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  const work2EntryCorrection = manifest.work === 'WORK2'
    ? validateWork2EntryCorrection(root, authority, manifest, predecessorReceipt)
    : {
      expectedWork1DeltaPaths: null,
      authorisedWork1WriteExceptions: new Set(),
      authorisedParentWriteExtensions: new Set(),
      authorisedCommandExtensions: [],
    };
  if (work3EntryCorrectionAuthority === null) {
    validateBaseTip(
      root,
      authority,
      manifest,
      priorState,
      predecessorReceipt,
      work2EntryCorrection.expectedWork1DeltaPaths,
      predecessorValidationResult,
    );
    validateSuccessConditions(manifest.success_conditions);
  } else {
    validateWork3BaseTip(
      manifest,
      prior,
      predecessorReceipt,
      work3EntryCorrectionAuthority,
    );
  }
  const candidateOrderingAuthority = validateCandidateOrderingAuthority(
    root,
    authority,
    authorityState.bytes,
    manifest,
    work4Correction,
  );
  if (manifest.work === 'WORK2') {
    validateWork2RecoveryOverlay(root, manifest, bytes);
  }
  // The bound candidate record, including its predecessor receipt identities,
  // is closed before the transition authority is compared against it, so a
  // predecessor identity defect surfaces as itself rather than as authority drift.
  const candidateId = validateCandidate(
    root, authority, manifest, prior, existingCandidatePaths, replacement,
  );
  const candidateStageState = buildOnlyCandidateStageState
    ?? validateCandidateOrdering(
      root,
      manifest,
      prior,
      existingCandidatePaths,
      candidateOrderingAuthority.binding,
      work4Correction,
    );
  if (work3EntryCorrectionAuthority === null) {
    validateWritePaths(
      root,
      authority,
      manifestPath,
      manifest,
      new Set([
        ...work2EntryCorrection.authorisedWork1WriteExceptions,
        ...candidateOrderingAuthority.authorisedWork1WriteExceptions,
        // The seven Work 1 write exceptions the replacement authority
        // re-grants belong to its own successor manifests and to nothing else.
        ...(candidateReplacement ? replacement.record.work1_write_exceptions : []),
      ]),
      new Set([
        ...work2EntryCorrection.authorisedParentWriteExtensions,
        ...candidateOrderingAuthority.authorisedParentWriteExtensions,
      ]),
      candidateStageState,
      work4Correction,
      replacement === null ? [] : replacement.record.immutable_prefix_extensions,
    );
    validateCommands(
      authority,
      manifestPath,
      manifest,
      [
        ...work2EntryCorrection.authorisedCommandExtensions,
        ...candidateOrderingAuthority.authorisedCommandExtensions,
      ],
      candidateReplacement ? manifestPath : null,
    );
    validateAllowedEffects(authority.allowed_effects, manifest.allowed_effects, manifest.work);
    if (!same(manifest.prohibited_effects, authority.prohibited_effects)) {
      fail('EFFECT_SCOPE_DRIFT', 'prohibited_effects');
    }
    validateStopConditions(authority.stop_conditions, manifest.stop_conditions);
  } else {
    validateWork3Commands(
      manifest,
      work3EntryCorrectionAuthority,
    );
    validateWork3EffectsAndStops(manifest, work3EntryCorrectionAuthority);
  }
  if (work3EntryCorrectionAuthority !== null
      && !same(
        manifest,
        expectedWork3Manifest(
          work3EntryCorrectionAuthority,
          manifest.work3_entry_correction_authority_binding,
        ),
      )) {
    fail('MANIFEST_CONTRACT_DRIFT', 'Work3 C3 exact manifest');
  }
  const result = {
    schema_version: RESULT_SCHEMA,
    status: 'PASS_NARROWING_EXECUTION_MANIFEST',
    work: manifest.work,
    manifest_path: manifestPath,
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_registration_id: candidateId,
    candidate_stage_state: candidateStageState,
    deferred_proofs: [DEFERRED_GIT_PROOF],
  };
  if (!exactKeys(result, RESULT_KEYS)) fail('MANIFEST_CONTRACT_DRIFT', 'result');
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const expectedInvokedPath = path.join(process.cwd(), ...VALIDATOR_PATH.split('/'));
if (invokedPath === expectedInvokedPath) {
  try {
    if (process.argv.length !== 3) fail('INVALID_OPTIONS', 'CLI arguments');
    const result = await validateExecutionManifest({
      repoRoot: process.cwd(),
      manifestPath: process.argv[2],
    });
    process.stdout.write(`${canonicalJson(result)}\n`);
  } catch (error) {
    const code = error instanceof WorkExecutionManifestValidationError
      ? error.code : 'MANIFEST_CONTRACT_DRIFT';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
