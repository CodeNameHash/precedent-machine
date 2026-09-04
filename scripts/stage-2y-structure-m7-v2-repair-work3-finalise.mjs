#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import consolidationModule from '../lib/canonical-v2/agreement-analysis-consolidation.js';
import contractModule from '../lib/canonical-v2/m7-v2-contract.js';
import { validateWork3ReceiptV2 } from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const { buildSourceSets } = consolidationModule;
const {
  rebindWork3StructureDispositionSet,
  validateWork3PhysicalClosureV2,
} = contractModule;

const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const OUTPUT_PATHS = Object.freeze([
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-ambiguous-repeat-agreement-index.json',
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-structure-disposition-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json',
]);
const RECEIPT_PATH = OUTPUT_PATHS.at(-1);
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const AMENDMENT_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-amendment.json`;
const EXTERNAL_REVIEW_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json`;
const APPLICATION_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json`;
const SUCCESSOR_MANIFEST_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-successor.json`;
const C3_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work3-entry-correction-authority.json`;
const LAWFUL_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';
const EXECUTION_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/work3-profile-cases.json';
const CANDIDATE_REGISTRATION_ROOT =
  `${MIGRATION_ROOT}/control/m7-v2-repair-candidate-registrations`;
const PROFILE_SET_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1';
const MEMBER_BINDING_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2';
const FROZEN_AMENDMENT_BINDING = Object.freeze({
  path: AMENDMENT_PATH,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1',
  record_id_field: 'closure_amendment_id',
  record_id: '06b879b44497653b8a3a0e698448efb833efc83cbd8591d0e8ff879cc2071ab4',
  byte_length: 207090,
  sha256: 'e5a8610b596edb567f13624551715ba102f7daaa9ef19f438093a2564123fe47',
  git_blob_oid: '4013eb82d7234534e15e39cd85d9582fa3d2d9c0',
});
const FROZEN_EXTERNAL_REVIEW_BINDING = Object.freeze({
  path: EXTERNAL_REVIEW_PATH,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
  record_id_field: 'work3_closure_amendment_external_review_receipt_id',
  record_id: 'a2344bb49e37bcae328479835ffe7d2e5477430ff89b4abf8c1af972594a3a14',
  byte_length: 4547,
  sha256: 'd5511ea3224a4cc685518e22a4ae4032ee678e2829ff1d4e2476a03d4de6932b',
  git_blob_oid: 'fd5ef798299211aaf015c72979cb3c5fe9048c98',
});
const STANDARD_BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const APPLICATION_RECEIPT_KEYS = Object.freeze([
  'schema_version',
  'work3_closure_amendment_application_receipt_id',
  'state',
  'closure_amendment_binding',
  'external_review_receipt_binding',
  'zero_effect_boundary',
]);

export class Work3FinalisationError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'Work3FinalisationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work3FinalisationError(code, detail);
}

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function rootPath(selectedRoot) {
  const selected = path.resolve(selectedRoot);
  if (!existsSync(selected)) fail('WORK3_OUTPUT_SAFETY', 'repository root is absent');
  const selectedStat = lstatSync(selected);
  if (selectedStat.isSymbolicLink() || !selectedStat.isDirectory()) {
    fail('WORK3_OUTPUT_SAFETY', 'repository root is not one real directory');
  }
  const resolved = realpathSync(selected);
  if (selected !== resolved) {
    fail('WORK3_OUTPUT_SAFETY', 'repository root has a symbolic-link ancestor');
  }
  const stat = lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('WORK3_OUTPUT_SAFETY', 'repository root is not one real directory');
  }
  return resolved;
}

function targetPath(root, selectedPath) {
  if (typeof selectedPath !== 'string'
      || selectedPath.length === 0
      || path.posix.isAbsolute(selectedPath)
      || selectedPath.split('/').some((member) => member === '' || member === '..')) {
    fail('WORK3_OUTPUT_SAFETY', 'output path escapes its root');
  }
  const absolute = path.resolve(root, selectedPath);
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    fail('WORK3_OUTPUT_SAFETY', 'output path escapes its root');
  }
  const parent = path.dirname(absolute);
  if (!existsSync(parent)) fail('WORK3_OUTPUT_SAFETY', `${selectedPath} parent is absent`);
  const stat = lstatSync(parent);
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(parent) !== parent) {
    fail('WORK3_OUTPUT_SAFETY', `${selectedPath} parent is not one real directory`);
  }
  return absolute;
}

function repositoryPath(selectedPath) {
  if (typeof selectedPath !== 'string'
      || selectedPath.length === 0
      || path.posix.isAbsolute(selectedPath)
      || selectedPath.split('/').some((member) => member === '' || member === '..')) {
    fail('WORK3_INPUT_DRIFT', 'repository path');
  }
  return selectedPath;
}

function sourcePath(root, selectedPath) {
  repositoryPath(selectedPath);
  let current = root;
  for (const member of selectedPath.split('/')) {
    current = path.join(current, member);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
    if (stat.isSymbolicLink()) fail('WORK3_INPUT_DRIFT', selectedPath);
  }
  if (!lstatSync(current).isFile()) fail('WORK3_INPUT_DRIFT', selectedPath);
  return current;
}

function readBytes(root, selectedPath) {
  return readFileSync(sourcePath(root, selectedPath));
}

function selectedPathExists(root, selectedPath) {
  repositoryPath(selectedPath);
  let current = root;
  const members = selectedPath.split('/');
  for (let index = 0; index < members.length; index += 1) {
    current = path.join(current, members[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
    if (stat.isSymbolicLink()) fail('WORK3_INPUT_DRIFT', selectedPath);
    if (index < members.length - 1 && !stat.isDirectory()) {
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
  }
  return true;
}

function validateCandidateRegistrationRoot(root) {
  const absolute = path.join(root, ...CANDIDATE_REGISTRATION_ROOT.split('/'));
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail('WORK3_REPOSITORY_PRECONDITION_DRIFT', 'candidate registration root');
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()
      || readdirSync(absolute).length !== 0) {
    fail('WORK3_REPOSITORY_PRECONDITION_DRIFT', 'candidate registration root');
  }
}

function readCanonical(root, selectedPath) {
  const bytes = readBytes(root, selectedPath);
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK3_INPUT_DRIFT', `${selectedPath} is not JSON`);
  }
  if (!bytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))) {
    fail('WORK3_INPUT_DRIFT', `${selectedPath} is not canonical JSON plus LF`);
  }
  return { bytes, record };
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function identified(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
}

function standardBinding(selectedPath, bytes, record = null, idField = null) {
  return {
    path: selectedPath,
    schema_version: record?.schema_version ?? null,
    record_id_field: idField,
    record_id: idField === null ? null : record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function memberBinding(containerPath, field, index, record, idField) {
  const bytes = Buffer.from(canonicalJson(record), 'utf8');
  return {
    schema_version: MEMBER_BINDING_SCHEMA,
    container_path: containerPath,
    member_field: field,
    member_index: index,
    member_schema_version: record.schema_version,
    member_record_id_field: idField,
    member_record_id: record[idField],
    member_byte_length: bytes.length,
    member_sha256: sha256Hex(bytes),
  };
}

function parseBoundRecord(root, binding, code = 'WORK3_INPUT_DRIFT') {
  if (binding === null || typeof binding !== 'object' || Array.isArray(binding)
      || !same(Object.keys(binding).sort(), [...STANDARD_BINDING_KEYS].sort())) {
    fail(code, 'standard binding');
  }
  const bytes = readBytes(root, binding.path);
  if (bytes.length !== binding.byte_length
      || sha256Hex(bytes) !== binding.sha256
      || gitBlobOid(bytes) !== binding.git_blob_oid) {
    fail(code, binding.path);
  }
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, binding.path);
  }
  if (!bytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))
      || record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id) {
    fail(code, binding.path);
  }
  return { bytes, record };
}

function loadLawfulFixture(root, contract) {
  let fixture;
  try {
    if (contract?.fixture_binding?.path !== LAWFUL_FIXTURE_PATH) {
      fail('WORK3_INPUT_DRIFT', 'lawful fixture authority');
    }
    const bytes = readBytes(root, LAWFUL_FIXTURE_PATH);
    if (bytes.length !== contract.fixture_binding.byte_length
        || sha256Hex(bytes) !== contract.fixture_binding.sha256
        || gitBlobOid(bytes) !== contract.fixture_binding.git_blob_oid) {
      fail('WORK3_INPUT_DRIFT', 'lawful fixture physical binding');
    }
    const encoded = bytes.toString('utf8').trim();
    fixture = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  } catch {
    fail('WORK3_INPUT_DRIFT', LAWFUL_FIXTURE_PATH);
  }
  if (fixture === null || typeof fixture !== 'object' || Array.isArray(fixture)) {
    fail('WORK3_INPUT_DRIFT', LAWFUL_FIXTURE_PATH);
  }
  const unsigned = { ...fixture };
  delete unsigned.fixture_digest;
  if (fixture.schema_version !== contract.fixture_schema_version
      || fixture.fixture_digest !== contract.fixture_digest
      || fixture.fixture_digest
        !== sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'))) {
    fail('WORK3_INPUT_DRIFT', 'lawful fixture identity');
  }
  return fixture;
}

function buildApprovedProfileSet(packageEntries) {
  const profiles = [];
  const dimensionEvidenceBindings = [];
  const subtypeTreeBindings = [];
  for (const { familyKey, binding, record } of packageEntries) {
    profiles.push(...record.profiles);
    dimensionEvidenceBindings.push(...record.dimension_evidence.map(
      (member, index) => memberBinding(
        binding.path,
        'dimension_evidence',
        index,
        member,
        'dimension_evidence_id',
      ),
    ));
    subtypeTreeBindings.push({
      family_key: familyKey,
      binding: memberBinding(
        binding.path,
        'subtype_tree',
        null,
        record.subtype_tree,
        'subtype_tree_id',
      ),
    });
  }
  return identified(PROFILE_SET_SCHEMA, 'family_profile_set_id', {
    state: 'BEN_APPROVED_PROFILE_SET',
    family_profile_package_bindings: packageEntries.map((entry) => entry.binding),
    profiles,
    dimension_evidence_bindings: dimensionEvidenceBindings,
    subtype_tree_bindings: subtypeTreeBindings,
  });
}

function buildNativeSets(root, c3) {
  const authority = c3.agreement_index_set_authority;
  if (!Array.isArray(authority?.sets) || authority.sets.length !== 3) {
    fail('WORK3_NATIVE_SET_DRIFT', 'native set authority');
  }
  const records = authority.sets.map((setContract) => identified(
    setContract.schema_version,
    setContract.record_id_field,
    { members: structuredClone(setContract.members) },
  ));
  const agreementIndexSet = records.find(
    (record) => record.schema_version === 'AGREEMENT_INDEX_SET/V1',
  );
  const contextSet = records.find(
    (record) => record.schema_version === 'CONTEXT_COMPILATION_SET/V1',
  );
  const analysisSet = records.find(
    (record) => record.schema_version === 'AGREEMENT_ANALYSIS_SET/V1',
  );
  if (!agreementIndexSet || !contextSet || !analysisSet) {
    fail('WORK3_NATIVE_SET_DRIFT', 'native set schemas');
  }
  const agreementIds = agreementIndexSet.members.map((binding) => (
    parseBoundRecord(root, binding, 'WORK3_NATIVE_SET_DRIFT')
      .record.source_binding?.agreement_id
  )).sort();
  if (!same(agreementIds, authority.corpus_contract.combined_agreement_ids)) {
    fail('WORK3_NATIVE_SET_DRIFT', 'agreement-index member union');
  }
  const contextCompilations = contextSet.members.map((member) => ({
    ...parseBoundRecord(
      root,
      member.context_compilation_binding,
      'WORK3_NATIVE_SET_DRIFT',
    ),
    binding: member.context_compilation_binding,
  }));
  const baseAnalyses = analysisSet.members.map((member) => ({
    ...parseBoundRecord(
      root,
      member.agreement_analysis_binding,
      'WORK3_NATIVE_SET_DRIFT',
    ),
    binding: member.agreement_analysis_binding,
  }));
  const sealedIds = new Set(authority.corpus_contract.sealed_agreement_ids);
  const builderAnalyses = baseAnalyses.filter(
    (entry) => sealedIds.has(entry.record.agreement_id),
  ).map(({ record, binding }) => ({ record, binding }));
  const builderContextIds = new Set(builderAnalyses.map(
    (entry) => entry.record.context_compilation_binding?.context_compilation_id,
  ));
  const builderContexts = contextCompilations.filter(
    (entry) => builderContextIds.has(entry.record.context_compilation_id),
  );
  if (builderAnalyses.length !== 7 || builderContexts.length !== 7) {
    fail('WORK3_NATIVE_SET_DRIFT', 'sealed native source-set inputs');
  }
  let rebuilt;
  try {
    rebuilt = buildSourceSets({
      baseAnalyses: builderAnalyses,
      contextCompilations: builderContexts.map(
        ({ record, binding }) => ({ record, binding }),
      ),
    });
  } catch (error) {
    fail('WORK3_NATIVE_SET_DRIFT', `native source-set builder: ${error.message}`);
  }
  const expectedSealedContextSet = identified(
    contextSet.schema_version,
    'context_compilation_set_id',
    { members: contextSet.members.filter((member) => sealedIds.has(member.agreement_id)) },
  );
  const expectedSealedAnalysisSet = identified(
    analysisSet.schema_version,
    'agreement_analysis_set_id',
    { members: analysisSet.members.filter((member) => sealedIds.has(member.agreement_id)) },
  );
  if (!same(rebuilt.contextCompilationSet, expectedSealedContextSet)
      || !same(rebuilt.agreementAnalysisSet, expectedSealedAnalysisSet)) {
    fail('WORK3_NATIVE_SET_DRIFT', 'native source-set builder equality');
  }
  return { agreementIndexSet, contextSet, analysisSet };
}

function recordIdentitySpec(contract, selectedPath) {
  for (const category of contract.artifact_bindings_contract.record_id_categories) {
    const detailed = category.schema_and_id_fields?.find(
      (entry) => entry.path === selectedPath,
    );
    if (detailed) {
      return {
        schemaVersion: detailed.schema_version,
        idField: detailed.record_id_field,
      };
    }
    if (Array.isArray(category.paths) && category.paths.includes(selectedPath)
        && typeof category.schema_version === 'string'
        && typeof category.record_id_field === 'string') {
      return {
        schemaVersion: category.schema_version,
        idField: category.record_id_field,
      };
    }
  }
  return null;
}

function artifactBinding(root, selectedPath, inMemory, receiptContract) {
  const memory = inMemory.get(selectedPath);
  const bytes = memory?.bytes ?? readBytes(root, selectedPath);
  const spec = recordIdentitySpec(receiptContract, selectedPath);
  if (!spec) return standardBinding(selectedPath, bytes);
  let record = memory?.record;
  if (!record) {
    try {
      record = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail('WORK3_ARTIFACT_BINDING_DRIFT', selectedPath);
    }
  }
  if (record.schema_version !== spec.schemaVersion
      || typeof record[spec.idField] !== 'string') {
    fail('WORK3_ARTIFACT_BINDING_DRIFT', selectedPath);
  }
  return standardBinding(selectedPath, bytes, record, spec.idField);
}

function ledgerFromFixture(receiptContract, executionFixture, runLimits) {
  const ledgerContract = receiptContract.command_execution_ledger_contract;
  const counts = executionFixture.command_run_counts;
  if (!Array.isArray(counts)
      || counts.length !== 21
      || !Array.isArray(ledgerContract.argv_order)
      || ledgerContract.argv_order.length !== 21
      || !Array.isArray(runLimits)
      || runLimits.length !== 17
      || counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    fail('WORK3_COMMAND_LEDGER_DRIFT', 'execution fixture counts');
  }
  for (let index = 0; index < runLimits.length; index += 1) {
    const limit = runLimits[index];
    if (!same(limit.argv, ledgerContract.argv_order[index + 4])
        || !Number.isSafeInteger(limit.max_runs)
        || limit.max_runs < 0
        || counts[index + 4] > limit.max_runs) {
      fail('WORK3_COMMAND_LEDGER_DRIFT', `execution fixture count ${index + 4}`);
    }
  }
  const states = new Array(21);
  for (const range of ledgerContract.state_ranges) {
    for (let index = range.indices[0]; index <= range.indices[1]; index += 1) {
      states[index] = range.state;
    }
  }
  if (states.some((state) => typeof state !== 'string')) {
    fail('WORK3_COMMAND_LEDGER_DRIFT', 'ledger state ranges');
  }
  return ledgerContract.argv_order.map((argv, index) => ({
    argv: structuredClone(argv),
    run_count: counts[index],
    state: states[index],
  }));
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function inputBinding(root, selectedPath, schemaVersion, idField) {
  const input = readCanonical(root, selectedPath);
  if (input.record.schema_version !== schemaVersion
      || typeof input.record[idField] !== 'string') {
    fail('WORK3_INPUT_DRIFT', `${selectedPath} envelope`);
  }
  return {
    ...input,
    binding: standardBinding(selectedPath, input.bytes, input.record, idField),
  };
}

function requireSame(actual, expected, code, detail) {
  if (!same(actual, expected)) fail(code, detail);
}

function validateContentIdentity(record, idField, code, detail) {
  const unsigned = { ...record };
  delete unsigned[idField];
  if (record[idField] !== contentId(record.schema_version, unsigned)) {
    fail(code, detail);
  }
}

function expectedSuccessorManifest(
  amendment,
  predecessor,
  amendmentBinding,
  externalBinding,
  applicationBinding,
) {
  const overlay = amendment.successor_manifest_contract_overlay;
  const unsigned = structuredClone(predecessor);
  delete unsigned.execution_manifest_id;
  delete unsigned.execution_manifest_digest;
  Object.assign(unsigned, {
    schema_version: overlay.schema_version,
    allowed_effects: structuredClone(overlay.allowed_effects),
    exact_argv_with_run_limits: structuredClone(overlay.exact_argv_with_run_limits),
    exact_git_commit_and_push_argv: structuredClone(overlay.exact_git_commit_and_push_argv),
    permitted_read_paths: structuredClone(overlay.permitted_read_paths),
    permitted_write_paths: structuredClone(overlay.permitted_write_paths),
    stop_conditions: structuredClone(overlay.stop_conditions),
    success_conditions: structuredClone(overlay.success_conditions),
    predecessor_execution_manifest_binding:
      structuredClone(amendment.predecessor_work3_execution_manifest_binding),
    closure_amendment_binding: structuredClone(amendmentBinding),
    external_review_receipt_binding: structuredClone(externalBinding),
    closure_application_receipt_binding: structuredClone(applicationBinding),
  });
  const executionManifestDigest = sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'));
  return {
    ...unsigned,
    execution_manifest_digest: executionManifestDigest,
    execution_manifest_id: contentId(overlay.schema_version, {
      ...unsigned,
      execution_manifest_digest: executionManifestDigest,
    }),
  };
}

function buildWork3OutputDescriptors(root) {
  validateCandidateRegistrationRoot(root);
  const amendmentInput = inputBinding(
    root,
    AMENDMENT_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1',
    'closure_amendment_id',
  );
  const amendment = amendmentInput.record;
  const unsignedAmendment = { ...amendment };
  delete unsignedAmendment.closure_amendment_id;
  if (!same(amendmentInput.binding, FROZEN_AMENDMENT_BINDING)
      || amendment.closure_amendment_id
      !== contentId(amendment.schema_version, unsignedAmendment)
      || amendment.authority_state !== 'AUTHORIZED_BY_DECISION_22_PENDING_EXTERNAL_REVIEW_AND_APPLICATION') {
    fail('WORK3_INPUT_DRIFT', 'closure amendment identity or state');
  }
  const c3Input = parseBoundRecord(
    root,
    amendment.predecessor_work3_entry_correction_authority_binding,
    'WORK3_INPUT_DRIFT',
  );
  if (amendment.predecessor_work3_entry_correction_authority_binding.path !== C3_PATH
      || c3Input.record.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1') {
    fail('WORK3_INPUT_DRIFT', 'bound Work3 entry authority');
  }
  const c3 = c3Input.record;
  const baseReceiptContract = c3.work3_scope_contract?.rich_work3_receipt_contract;
  const receiptContract = amendment.receipt_contract_overlay;
  if (baseReceiptContract === null || typeof baseReceiptContract !== 'object'
      || receiptContract === null || typeof receiptContract !== 'object'
      || !same(receiptContract.create_once_output_paths, OUTPUT_PATHS)
      || receiptContract.work3_receipt_path !== RECEIPT_PATH) {
    fail('WORK3_INPUT_DRIFT', 'effective receipt contract');
  }

  const lineageContracts = receiptContract.top_level_lineage_binding_contracts;
  const externalInput = inputBinding(
    root,
    EXTERNAL_REVIEW_PATH,
    lineageContracts.external_review_receipt_binding.schema_version,
    lineageContracts.external_review_receipt_binding.record_id_field,
  );
  const applicationInput = inputBinding(
    root,
    APPLICATION_PATH,
    lineageContracts.closure_application_receipt_binding.schema_version,
    lineageContracts.closure_application_receipt_binding.record_id_field,
  );
  const successorInput = inputBinding(
    root,
    SUCCESSOR_MANIFEST_PATH,
    lineageContracts.successor_execution_manifest_binding.schema_version,
    lineageContracts.successor_execution_manifest_binding.record_id_field,
  );
  validateContentIdentity(
    externalInput.record,
    lineageContracts.external_review_receipt_binding.record_id_field,
    'WORK3_INPUT_DRIFT',
    'external review receipt identity',
  );
  if (!same(externalInput.binding, FROZEN_EXTERNAL_REVIEW_BINDING)
      || externalInput.record.status !== 'PASS') {
    fail('WORK3_INPUT_DRIFT', 'external review receipt status');
  }
  const expectedApplication = identified(
    lineageContracts.closure_application_receipt_binding.schema_version,
    lineageContracts.closure_application_receipt_binding.record_id_field,
    {
      state: 'IMMUTABLE_ZERO_EFFECT_APPLICATION',
      closure_amendment_binding: structuredClone(FROZEN_AMENDMENT_BINDING),
      external_review_receipt_binding:
        structuredClone(FROZEN_EXTERNAL_REVIEW_BINDING),
      zero_effect_boundary: structuredClone(amendment.zero_effect_boundary),
    },
  );
  if (!same(Object.keys(applicationInput.record).sort(),
    [...APPLICATION_RECEIPT_KEYS].sort())
      || !same(applicationInput.record, expectedApplication)) {
    fail('WORK3_INPUT_DRIFT', 'closure application receipt contract');
  }
  validateContentIdentity(
    applicationInput.record,
    'work3_closure_amendment_application_receipt_id',
    'WORK3_INPUT_DRIFT',
    'closure application receipt identity',
  );
  const predecessorInput = parseBoundRecord(
    root,
    amendment.predecessor_work3_execution_manifest_binding,
    'WORK3_INPUT_DRIFT',
  );
  const expectedSuccessor = expectedSuccessorManifest(
    amendment,
    predecessorInput.record,
    amendmentInput.binding,
    externalInput.binding,
    applicationInput.binding,
  );
  if (!same(Object.keys(successorInput.record),
    amendment.successor_manifest_contract_overlay.record_exact_keys)
      || !same(successorInput.record, expectedSuccessor)) {
    fail('WORK3_INPUT_DRIFT', 'exact V2 successor manifest');
  }

  const closure = amendment.effective_family_package_closure;
  if (!Array.isArray(closure?.sealed_family_packages)
      || closure.sealed_family_packages.length !== 24) {
    fail('WORK3_INPUT_DRIFT', 'sealed package closure');
  }
  const packageEntries = closure.sealed_family_packages.map((entry) => {
    const input = parseBoundRecord(root, entry.package_binding, 'WORK3_INPUT_DRIFT');
    if (input.record.family_key !== entry.family_key) {
      fail('WORK3_INPUT_DRIFT', `${entry.family_key} package`);
    }
    return {
      familyKey: entry.family_key,
      binding: entry.package_binding,
      record: input.record,
    };
  });
  const profileSet = buildApprovedProfileSet(packageEntries);
  const nativeSets = buildNativeSets(root, c3);
  const lawfulFixture = loadLawfulFixture(root, amendment.lawful_fixture);
  const ambiguousRecord = lawfulFixture.generated_native_source_records?.find(
    (entry) => entry.binding?.path === OUTPUT_PATHS[0],
  )?.record;
  const sourceStructureSet = lawfulFixture.structure_disposition_set;
  if (!ambiguousRecord || !sourceStructureSet
      || ambiguousRecord.schema_version !== 'AGREEMENT_INDEX/V1'
      || sourceStructureSet.schema_version
        !== 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1') {
    fail('WORK3_INPUT_DRIFT', 'lawful fixture outputs');
  }
  let structureSet;
  try {
    structureSet = rebindWork3StructureDispositionSet({
      packageBindings: packageEntries.map((entry) => entry.binding),
      resolveBinding(binding) {
        return readBytes(root, binding.path);
      },
      structureDispositionSet: sourceStructureSet,
    });
  } catch (error) {
    fail(error.code ?? 'WORK3_INPUT_DRIFT', `structure rebinding: ${error.message}`);
  }

  const outputRecords = [
    ambiguousRecord,
    nativeSets.agreementIndexSet,
    nativeSets.contextSet,
    nativeSets.analysisSet,
    profileSet,
    structureSet,
  ];
  const inMemory = new Map(outputRecords.map((record, index) => [
    OUTPUT_PATHS[index],
    { record, bytes: canonicalBytes(record) },
  ]));
  let physicalValidation;
  try {
    physicalValidation = validateWork3PhysicalClosureV2({
      closure,
      familyProfileSet: profileSet,
      resolveBinding(binding) {
        return inMemory.get(binding.path)?.bytes ?? readBytes(root, binding.path);
      },
      pathExists(selectedPath) {
        if (inMemory.has(selectedPath)) return true;
        return selectedPathExists(root, selectedPath);
      },
    });
  } catch (error) {
    fail(
      error.code ?? 'WORK3_INPUT_DRIFT',
      `physical closure validation: ${error.message}`,
    );
  }

  const executionContract = amendment.work3_execution_fixture_contract_overlay
    ?.effective_contract;
  const executionInput = readCanonical(root, EXECUTION_FIXTURE_PATH);
  const executionFixture = executionInput.record;
  if (!same(Object.keys(executionFixture).sort(), executionContract.exact_keys.slice().sort())
      || executionFixture.schema_version !== executionContract.schema_version
      || executionFixture.state !== executionContract.state
      || !same(executionFixture.case_ids, executionContract.case_ids)
      || !same(executionFixture.combined_test_result, executionContract.combined_test_result)
      || !Array.isArray(executionFixture.command_run_counts)
      || executionFixture.command_run_counts.length !== 21) {
    fail('WORK3_COMMAND_LEDGER_DRIFT', 'execution fixture contract');
  }

  const artifactPaths = receiptContract.artifact_bindings_contract.paths;
  if (!Array.isArray(artifactPaths) || artifactPaths.length !== 52
      || !same(artifactPaths, [...artifactPaths].sort())) {
    fail('WORK3_ARTIFACT_BINDING_DRIFT', 'artifact path contract');
  }
  const artifactBindings = artifactPaths.map(
    (selectedPath) => artifactBinding(root, selectedPath, inMemory, receiptContract),
  );
  const bindingByPath = new Map(
    artifactBindings.map((binding) => [binding.path, binding]),
  );
  const requireArtifact = (selectedPath) => {
    const selected = bindingByPath.get(selectedPath);
    if (!selected) fail('WORK3_ARTIFACT_BINDING_DRIFT', selectedPath);
    return selected;
  };
  const nativeContract = baseReceiptContract.candidate_native_set_evidence_contract;
  const nativeEvidence = {
    work2_agreement_analysis_set_binding: structuredClone(nativeContract.work2_bindings[0]),
    work2_context_compilation_set_binding: structuredClone(nativeContract.work2_bindings[1]),
    work3_agreement_index_set_binding: requireArtifact(OUTPUT_PATHS[1]),
    work3_context_compilation_set_binding: requireArtifact(OUTPUT_PATHS[2]),
    work3_agreement_analysis_set_binding: requireArtifact(OUTPUT_PATHS[3]),
    sealed_agreement_ids: structuredClone(nativeContract.sealed_agreement_ids),
    additive_agreement_ids: structuredClone(nativeContract.additive_agreement_ids),
    combined_agreement_ids: structuredClone(nativeContract.combined_agreement_ids),
    extension_proof: nativeContract.extension_proof,
  };
  requireSame(
    Object.keys(nativeEvidence),
    nativeContract.exact_keys,
    'WORK3_NATIVE_SET_DRIFT',
    'native evidence keys',
  );
  const counts = {
    ...structuredClone(receiptContract.counts_contract.exact_values),
    structure_disposition_member_count: structureSet.members.length,
  };
  const commandLedger = ledgerFromFixture(
    receiptContract,
    executionFixture,
    amendment.successor_manifest_contract_overlay.exact_argv_with_run_limits,
  );
  const receiptBody = {
    work: 'WORK3',
    stage: 'M7_V2_REPAIR_WORK3',
    state: 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE',
    status: 'PASS',
    execution_manifest_id: successorInput.record.execution_manifest_id,
    execution_manifest_digest: successorInput.record.execution_manifest_digest,
    parent_authority_binding: structuredClone(successorInput.record.parent_authority_binding),
    activation_receipt_binding: structuredClone(successorInput.record.activation_receipt_binding),
    predecessor_receipt_binding: structuredClone(successorInput.record.predecessor_receipt_binding),
    candidate_ordering_correction_authority_binding: structuredClone(
      successorInput.record.candidate_ordering_correction_authority_binding,
    ),
    work3_entry_correction_authority_binding: requireArtifact(C3_PATH),
    candidate_registration_id: null,
    candidate_transition: null,
    candidate_native_set_evidence: nativeEvidence,
    family_profile_evidence: {
      family_profile_package_bindings: packageEntries.map((entry) => entry.binding),
      approved_family_profile_set_binding: requireArtifact(OUTPUT_PATHS[4]),
      governed_family_keys: structuredClone(closure.governed_family_keys),
      sealed_package_family_keys: structuredClone(closure.sealed_family_keys),
      parked_family_evidence: structuredClone(closure.capitalisation),
    },
    structure_disposition_set_binding: requireArtifact(OUTPUT_PATHS[5]),
    artifact_bindings: artifactBindings,
    artifact_set_digest: sha256Hex(Buffer.from(canonicalJson(artifactBindings), 'utf8')),
    command_execution_ledger: commandLedger,
    combined_test_result: structuredClone(executionFixture.combined_test_result),
    repository_precondition: Object.fromEntries(
      receiptContract.repository_precondition_contract.exact_keys.map(
        (key) => [key, structuredClone(receiptContract.repository_precondition_contract[key])],
      ),
    ),
    counts,
    checks: structuredClone(receiptContract.checks_contract.exact_ordered_checks),
    effects: structuredClone(receiptContract.effects_contract.exact_values),
    next_work: structuredClone(receiptContract.next_work_contract.exact_values),
    closure_amendment_binding: requireArtifact(AMENDMENT_PATH),
    external_review_receipt_binding: requireArtifact(EXTERNAL_REVIEW_PATH),
    closure_application_receipt_binding: requireArtifact(APPLICATION_PATH),
    successor_execution_manifest_binding: requireArtifact(SUCCESSOR_MANIFEST_PATH),
  };
  const receipt = identified(RECEIPT_SCHEMA, 'work3_receipt_id', receiptBody);
  const receiptBytes = canonicalBytes(receipt);
  inMemory.set(RECEIPT_PATH, { record: receipt, bytes: receiptBytes });
  try {
    validateWork3ReceiptV2({
      amendment,
      pathExists(selectedPath) {
        if (inMemory.has(selectedPath)) return true;
        return selectedPathExists(root, selectedPath);
      },
      physicalValidation,
      receipt,
      resolveBinding(binding) {
        return inMemory.get(binding.path)?.bytes ?? readBytes(root, binding.path);
      },
      work3EntryAuthority: c3,
    });
  } catch (error) {
    fail(error.code ?? 'WORK3_RECEIPT_INVALID', error.message);
  }
  return OUTPUT_PATHS.map((selectedPath, index) => ({
    path: selectedPath,
    bytes: index === OUTPUT_PATHS.length - 1
      ? receiptBytes
      : inMemory.get(selectedPath).bytes,
    mode: 0o644,
    kind: index === OUTPUT_PATHS.length - 1 ? 'RECEIPT' : 'NON_RECEIPT_OUTPUT',
  }));
}

function canonicalDescriptorBytes(value, label) {
  let bytes;
  try {
    bytes = Buffer.from(value);
  } catch {
    fail('WORK3_RECEIPT_INVALID', `${label} bytes`);
  }
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK3_RECEIPT_INVALID', `${label} bytes are not JSON`);
  }
  if (!bytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))) {
    fail('WORK3_RECEIPT_INVALID', `${label} bytes are not canonical JSON plus LF`);
  }
  return bytes;
}

function validateDescriptors(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length !== OUTPUT_PATHS.length) {
    fail('WORK3_RECEIPT_INVALID', 'seven output descriptors');
  }
  return descriptors.map((descriptor, index) => {
    if (descriptor === null || typeof descriptor !== 'object' || Array.isArray(descriptor)
        || !same(Object.keys(descriptor).sort(), ['bytes', 'kind', 'mode', 'path'])) {
      fail('WORK3_RECEIPT_INVALID', `descriptor ${index}`);
    }
    const expectedKind = index === OUTPUT_PATHS.length - 1
      ? 'RECEIPT'
      : 'NON_RECEIPT_OUTPUT';
    if (descriptor.path !== OUTPUT_PATHS[index]
        || descriptor.mode !== 0o644
        || descriptor.kind !== expectedKind) {
      fail('WORK3_RECEIPT_INVALID', `descriptor ${index} fields`);
    }
    return {
      path: descriptor.path,
      bytes: canonicalDescriptorBytes(descriptor.bytes, descriptor.path),
      mode: descriptor.mode,
      kind: descriptor.kind,
    };
  });
}

function preflightOutputs(root) {
  const states = OUTPUT_PATHS.map((selectedPath) => {
    const absolute = targetPath(root, selectedPath);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error?.code === 'ENOENT') return { selectedPath, absolute, exists: false };
      fail('WORK3_OUTPUT_SAFETY', `${selectedPath} cannot be inspected`);
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail('WORK3_OUTPUT_SAFETY', selectedPath);
    }
    return { selectedPath, absolute, exists: true };
  });
  if (states.at(-1).exists) fail('WORK3_ALREADY_FINALISED', RECEIPT_PATH);
  if (states.some((entry) => entry.exists)) {
    fail('WORK3_OUTPUT_STATE_DRIFT', 'pre-existing partial outputs');
  }
  return states;
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset, offset);
    if (written <= 0) fail('WORK3_WRITE_FAILED', 'short write');
    offset += written;
  }
}

function fsyncParent(absolute) {
  const fd = openSync(
    path.dirname(absolute),
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
  );
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeOutputs(root, descriptors) {
  const targets = preflightOutputs(root);
  const created = [];
  try {
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const descriptor = descriptors[index];
      const fd = openSync(
        target.absolute,
        fsConstants.O_CREAT
          | fsConstants.O_EXCL
          | fsConstants.O_WRONLY
          | fsConstants.O_NOFOLLOW,
        descriptor.mode,
      );
      created.push(target.absolute);
      try {
        fchmodSync(fd, descriptor.mode);
        writeAll(fd, descriptor.bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      fsyncParent(target.absolute);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const absolute of [...created].reverse()) {
      try {
        unlinkSync(absolute);
        fsyncParent(absolute);
      } catch (selectedError) {
        rollbackErrors.push(selectedError);
      }
    }
    for (const target of targets) {
      try {
        lstatSync(target.absolute);
        rollbackErrors.push(new Error(`${target.selectedPath} remains after rollback`));
      } catch (selectedError) {
        if (selectedError?.code !== 'ENOENT') rollbackErrors.push(selectedError);
      }
    }
    if (rollbackErrors.length > 0) {
      const primary = error instanceof Error ? error : new Error(String(error));
      const rollbackFailure = new Work3FinalisationError(
        'WORK3_ROLLBACK_FAILED',
        `primary=${primary.message}; rollback=${rollbackErrors
          .map((selectedError) => selectedError.message).join('; ')}`,
      );
      rollbackFailure.cause = primary;
      rollbackFailure.rollbackErrors = rollbackErrors;
      throw rollbackFailure;
    }
    if (error instanceof Work3FinalisationError) throw error;
    fail('WORK3_WRITE_FAILED', error.message);
  }
}

function resultFor(write) {
  return {
    status: write ? 'PASS_WORK3_FINALISATION' : 'PASS_WORK3_FINALISATION_PREVIEW',
    target_paths: [...OUTPUT_PATHS],
    effects: {
      files_written: write ? 7 : 0,
      non_receipt_output_writes: write ? 6 : 0,
      receipt_writes: write ? 1 : 0,
    },
  };
}

export function finaliseWork3(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(
        (key) => !['repoRoot', 'write'].includes(key),
      )) {
    fail('WORK3_RECEIPT_INVALID', 'options');
  }
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  const write = options.write ?? true;
  if (typeof write !== 'boolean') fail('WORK3_RECEIPT_INVALID', 'write option');
  preflightOutputs(root);
  const descriptors = validateDescriptors(buildWork3OutputDescriptors(root));
  if (write) writeOutputs(root, descriptors);
  return resultFor(write);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK3_RECEIPT_INVALID', 'CLI arguments');
    process.stdout.write(`${JSON.stringify(finaliseWork3())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
