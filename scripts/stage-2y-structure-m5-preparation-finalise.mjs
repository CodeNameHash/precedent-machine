#!/usr/bin/env node

// Seals the M5 preparation receipt. It cannot execute a family adapter.

import {
  existsSync,
  lstatSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED = Object.freeze({
  authority: resolve(MIGRATION_ROOT, 'control/m5-preparation-authority.json'),
  policy: resolve(MIGRATION_ROOT, 'control/m5-calibration-policy.json'),
  receipt: resolve(MIGRATION_ROOT, 'receipts/stage-2y-structure-m5-preparation.json'),
});
const CHECK_IDS = Object.freeze([
  'PREDECESSOR_TRUST_ROOTS',
  'FAMILY_REGISTRY_AND_ORDER',
  'COMPARATOR_PARTITION',
  'CALIBRATION_PACK_IDENTITY_AND_SOURCE',
  'PROPOSED_ROLE_SCHEMA_IDENTITY_AND_NON_AUTHORITY',
  'CROSS_FAMILY_DEPENDENCY_CLOSURE',
  'PROHIBITED_PATH_ABSENCE_AND_NO_RUN',
  'ZERO_EFFECTS',
  'EXACT_CHANGED_FILE_SCOPE',
]);
const CHECK_DETAILS = Object.freeze({
  PREDECESSOR_TRUST_ROOTS: 'M2, M3 and M4 receipts and every bound output rehashed',
  FAMILY_REGISTRY_AND_ORDER: '25 registered families match the sealed four-wave order',
  COMPARATOR_PARTITION: '130 sealed comparator runs occur once in their governed families',
  CALIBRATION_PACK_IDENTITY_AND_SOURCE: '25 packs pass exact identity, source and provenance checks',
  PROPOSED_ROLE_SCHEMA_IDENTITY_AND_NON_AUTHORITY: '25 proposals pass identity and remain non-authoritative',
  CROSS_FAMILY_DEPENDENCY_CLOSURE: 'all declared cross-family dependencies resolve to sealed identities',
  PROHIBITED_PATH_ABSENCE_AND_NO_RUN: 'no approved schema, shadow M5 output or execution receipt exists',
  ZERO_EFFECTS: 'all preparation and receipt effect counters are zero',
  EXACT_CHANGED_FILE_SCOPE: 'prospective changed files equal the 58 authorised preparation paths',
});
const DEPENDENCY_COLLECTIONS = Object.freeze([
  ['context_facts', 'context_fact_id'],
  ['scope_edges', 'scope_edge_id'],
  ['reference_edges', 'reference_edge_id'],
  ['definition_edges', 'definition_edge_id'],
  ['semantic_relationships', 'semantic_relationship_id'],
  ['ambiguities', 'ambiguity_id'],
  ['residuals', 'residual_id'],
]);

function fail(code, detail) {
  const error = new Error(`STAGE_2Y_M5_PREPARATION_FINALISE:${code}: ${detail}`);
  error.code = code;
  throw error;
}

function repoPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value === '..' || value.startsWith('../')) {
    fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  }
  return value;
}

function exactPath(value) {
  if (typeof value !== 'string' || value.length === 0 || isAbsolute(value)) {
    fail('INVALID_PATH', String(value));
  }
  const absolutePath = resolve(REPO_ROOT, value);
  if (repoPath(absolutePath) !== value) fail('PATH_NOT_NORMALISED', value);
  return absolutePath;
}

function assertNoSymlink(absolutePath) {
  let cursor = REPO_ROOT;
  for (const part of repoPath(absolutePath).split('/')) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK_COMPONENT', repoPath(cursor));
  }
}

function readBytes(absolutePath, label = repoPath(absolutePath)) {
  assertNoSymlink(absolutePath);
  if (!existsSync(absolutePath)) fail('MISSING_FILE', label);
  if (!lstatSync(absolutePath).isFile()) fail('NOT_A_FILE', label);
  return readFileSync(absolutePath);
}

function readJson(absolutePath, label = repoPath(absolutePath)) {
  const data = readBytes(absolutePath, label);
  try {
    return { data, value: JSON.parse(data.toString('utf8')) };
  } catch (error) {
    fail('INVALID_JSON', `${label}: ${error.message}`);
  }
}

function binding(absolutePath, extra = {}) {
  const data = readBytes(absolutePath);
  return {
    path: repoPath(absolutePath),
    byte_length: data.length,
    sha256: sha256Hex(data),
    ...extra,
  };
}

function baseBinding(absolutePath) {
  return binding(absolutePath);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_OBJECT', label);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) fail('KEY_SET_DRIFT', label);
}

function same(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail('VALUE_DRIFT', label);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_STRING', label);
  return value;
}

function requireDigest(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value || '')) fail('INVALID_DIGEST', label);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_ARRAY', label);
  return value;
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) fail('DUPLICATE_ID', label);
}

function requireSorted(values, compare, label) {
  const sorted = [...values].sort(compare);
  if (canonicalJson(values) !== canonicalJson(sorted)) fail('ORDER_DRIFT', label);
}

function digestWithout(value, fields) {
  const copy = structuredClone(value);
  for (const field of fields) delete copy[field];
  return sha256Hex(canonicalJson(copy));
}

function identityWithout(value, idField, digestField) {
  const unsigned = structuredClone(value);
  delete unsigned[idField];
  delete unsigned[digestField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const idPayload = { ...unsigned, [digestField]: digest };
  return {
    digest,
    id: contentId(value.schema_version, idPayload),
  };
}

function validateFileBinding(record, label) {
  exactKeys(record, ['path', 'byte_length', 'sha256'], label);
  const actual = baseBinding(exactPath(record.path));
  same(record, actual, label);
  return actual;
}

function validateExtendedBinding(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail('INVALID_BINDING', label);
  }
  const actual = baseBinding(exactPath(record.path));
  if (record.byte_length !== actual.byte_length || record.sha256 !== actual.sha256) {
    fail('BINDING_DRIFT', label);
  }
  return actual;
}

function parseArgs(argv) {
  if (argv.length !== 6) fail('INVALID_ARGUMENT_COUNT', String(argv.length));
  const expected = new Map([
    ['--authority', EXPECTED.authority],
    ['--policy', EXPECTED.policy],
    ['--receipt', EXPECTED.receipt],
  ]);
  const supplied = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!expected.has(name) || supplied.has(name) || !value || value.startsWith('--')) {
      fail('INVALID_ARGUMENT', String(name));
    }
    const absolutePath = exactPath(value);
    if (absolutePath !== expected.get(name)) fail('PATH_DRIFT', name);
    supplied.set(name, absolutePath);
  }
  if (supplied.size !== expected.size) fail('MISSING_ARGUMENT', 'authority, policy or receipt');
  return Object.freeze({
    authority: supplied.get('--authority'),
    policy: supplied.get('--policy'),
    receipt: supplied.get('--receipt'),
  });
}

function changedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}

function validateControls(authority, policy) {
  if (authority.schema_version !== 'STAGE_2Y_M5_PREPARATION_AUTHORITY/V1'
    || authority.authority_version !== 1
    || authority.authority_state !== 'ACTIVE_FOR_ALL_25_FAMILY_CALIBRATION_PREPARATION_ONLY'
    || authority.stage !== 'M5_PREPARATION'
    || authority.base_commit !== policy.repository_contract.base_commit
    || authority.base_commit !== execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim()) {
    fail('AUTHORITY_STATE_DRIFT', 'M5 preparation authority');
  }
  requireDigest(authority.authority_digest, 'authority digest');
  if (digestWithout(authority, ['authority_digest']) !== authority.authority_digest) {
    fail('AUTHORITY_DIGEST_DRIFT', authority.authority_digest);
  }
  if (policy.schema_version !== 'STAGE_2Y_M5_CALIBRATION_POLICY/V1'
    || policy.policy_version !== 1
    || policy.stage !== 'M5_PREPARATION'
    || policy.hidden_defaults !== false) {
    fail('POLICY_STATE_DRIFT', 'M5 calibration policy');
  }
  requireDigest(policy.policy_digest, 'policy digest');
  if (digestWithout(policy, ['policy_digest']) !== policy.policy_digest) {
    fail('POLICY_DIGEST_DRIFT', policy.policy_digest);
  }
  for (const [name, record] of Object.entries(authority.bindings)) {
    validateExtendedBinding(record, `authority binding ${name}`);
  }
  const actualAuthority = baseBinding(EXPECTED.authority);
  const actualPolicy = baseBinding(EXPECTED.policy);
  if (authority.bindings.calibration_policy.sha256 !== actualPolicy.sha256
    || authority.bindings.calibration_policy.byte_length !== actualPolicy.byte_length
    || authority.bindings.calibration_policy.policy_digest !== policy.policy_digest) {
    fail('POLICY_BINDING_DRIFT', 'authority calibration_policy');
  }
  same(policy.full_contract_review_binding, authority.bindings.full_contract_review,
    'policy and authority full-contract review');
  if (authority.permitted_command.preparation_finaliser
      !== `node scripts/stage-2y-structure-m5-preparation-finalise.mjs --authority ${repoPath(EXPECTED.authority)} --policy ${repoPath(EXPECTED.policy)} --receipt ${repoPath(EXPECTED.receipt)}`
    || authority.permitted_command.family_runner !== null
    || authority.permitted_command.aggregate_runner !== null
    || authority.command_run_limit.preparation_finaliser !== 1
    || authority.command_run_limit.family_runner !== 0
    || authority.command_run_limit.aggregate_runner !== 0
    || authority.command_run_limit.model_calls !== 0
    || authority.command_run_limit.phase_b_calls !== 0
    || authority.permitted_output.preparation_receipt !== repoPath(EXPECTED.receipt)
    || Object.values(authority.zero_effect_expectations).some((value) => value !== 0)) {
    fail('EXECUTION_AUTHORITY_DRIFT', 'command, output or zero-effect contract');
  }
  const reviewPath = exactPath(authority.bindings.full_contract_review.path);
  const review = readJson(reviewPath, 'M5 full-contract review').value;
  if (review.schema_version !== 'STAGE_2Y_M5_PREPARATION_FULL_CONTRACT_SOL_FREEZE/V1'
    || review.verdict !== 'PASS_PREPARATION_CONTRACT_ONLY'
    || review.status !== 'APPROVED_FOR_PREPARATION_CONTROL_MATERIALISATION'
    || review.checkpoint_commit !== authority.base_commit
    || review.review_id !== authority.bindings.full_contract_review.review_id
    || contentId(review.schema_version, Object.fromEntries(
      Object.entries(review).filter(([key]) => key !== 'review_id'),
    )) !== review.review_id) {
    fail('FULL_CONTRACT_REVIEW_DRIFT', 'identity or state');
  }
  return { actualAuthority, actualPolicy, review };
}

function validateReceiptOutputSet(receipt, expected) {
  if (receipt.schema_version !== expected.schema_version
    || receipt.stage !== expected.stage
    || receipt.lifecycle_state !== expected.lifecycle_state
    || receipt.status !== expected.status
    || receipt.output_set_digest !== expected.output_set_digest
    || receipt.output_bindings.length !== expected.output_count) {
    fail('PREDECESSOR_RECEIPT_DRIFT', expected.stage);
  }
  for (const output of receipt.output_bindings) {
    const actual = baseBinding(exactPath(output.path));
    if (actual.byte_length !== output.byte_length || actual.sha256 !== output.sha256) {
      fail('PREDECESSOR_OUTPUT_DRIFT', output.path);
    }
  }
  if (sha256Hex(canonicalJson(receipt.output_bindings)) !== receipt.output_set_digest) {
    fail('PREDECESSOR_OUTPUT_SET_DRIFT', expected.stage);
  }
  for (const record of Object.values(receipt.current_state_bindings || {})) {
    validateExtendedBinding(record, `${expected.stage} current-state binding`);
  }
}

function validatePredecessors(authority, policy) {
  const receipts = {};
  for (const expected of policy.dependency_contract.required_receipts) {
    const { value } = readJson(exactPath(expected.path), `${expected.stage} receipt`);
    const actual = baseBinding(exactPath(expected.path));
    if (actual.byte_length !== expected.byte_length || actual.sha256 !== expected.sha256) {
      fail('PREDECESSOR_RECEIPT_BYTES_DRIFT', expected.stage);
    }
    validateReceiptOutputSet(value, expected);
    receipts[expected.stage.toLowerCase()] = value;
  }
  const authorityM2 = authority.bindings.m2_receipt;
  const authorityM3 = authority.bindings.m3_receipt;
  const authorityM4 = authority.bindings.m4_receipt;
  same(baseBinding(exactPath(authorityM2.path)), {
    path: authorityM2.path,
    byte_length: authorityM2.byte_length,
    sha256: authorityM2.sha256,
  }, 'authority M2 receipt bytes');
  same(baseBinding(exactPath(authorityM3.path)), {
    path: authorityM3.path,
    byte_length: authorityM3.byte_length,
    sha256: authorityM3.sha256,
  }, 'authority M3 receipt bytes');
  same(baseBinding(exactPath(authorityM4.path)), {
    path: authorityM4.path,
    byte_length: authorityM4.byte_length,
    sha256: authorityM4.sha256,
  }, 'authority M4 receipt bytes');
  const m3M2 = receipts.m3.sealed_predecessor_bindings?.m2_receipt;
  if (!m3M2 || m3M2.path !== authorityM2.path || m3M2.sha256 !== authorityM2.sha256) {
    fail('M3_M2_TRUST_ROOT_DRIFT', 'M3 does not bind explicit M2 receipt');
  }
  const m4M2 = receipts.m4.predecessor_receipt_bindings?.m2;
  const m4M3 = receipts.m4.predecessor_receipt_bindings?.m3;
  if (!m4M2 || !m4M3 || m4M2.path !== authorityM2.path || m4M2.sha256 !== authorityM2.sha256
    || m4M3.path !== authorityM3.path || m4M3.sha256 !== authorityM3.sha256) {
    fail('M4_PREDECESSOR_TRUST_ROOT_DRIFT', 'M4 does not bind explicit M2 and M3 receipts');
  }
  return receipts;
}

function validateFamilyAndComparatorRegistry(authority, policy) {
  const families = policy.family_order_contract.families;
  if (!Array.isArray(families) || families.length !== 25
    || policy.family_order_contract.family_count !== 25
    || policy.family_order_contract.wave_count !== 4
    || authority.preparation_family_order.length !== 25) {
    fail('FAMILY_ORDER_DRIFT', 'family or wave count');
  }
  const authorityOrder = authority.preparation_family_order;
  for (let index = 0; index < families.length; index += 1) {
    const family = families[index];
    const authorityFamily = authorityOrder[index];
    if (family.ordinal !== index + 1 || authorityFamily.ordinal !== index + 1
      || family.family_key !== authorityFamily.family_key
      || family.wave !== authorityFamily.wave
      || family.exact_comparator_run_count !== authorityFamily.exact_comparator_run_count) {
      fail('FAMILY_ORDER_DRIFT', `ordinal ${index + 1}`);
    }
  }
  requireUnique(families.map((row) => row.family_key), 'family order');
  same(policy.repository_contract.preparation_outputs,
    families.flatMap((row) => [row.calibration_pack_path, row.proposed_role_schema_path]),
    '50 preparation paths');
  const familyManifest = readJson(exactPath(authority.bindings.family_keys.path),
    'family keys').value;
  const orderedKeys = families.map((row) => row.family_key);
  same([...familyManifest.family_keys].sort(), [...orderedKeys].sort(), 'registered family keys');

  const analysisPolicy = readJson(exactPath(authority.bindings.analysis_policy.path),
    'analysis policy').value;
  const runs = analysisPolicy.input_contract?.legacy_run_bindings;
  if (!Array.isArray(runs) || runs.length !== 130
    || sha256Hex(canonicalJson(runs)) !== policy.comparator_contract.binding_set_digest
    || analysisPolicy.input_contract.legacy_run_binding_set_digest
      !== policy.comparator_contract.binding_set_digest) {
    fail('COMPARATOR_BINDING_SET_DRIFT', 'analysis policy legacy run bindings');
  }
  const runMembers = policy.comparator_contract.run_binding_exact_members;
  const fileMembers = policy.comparator_contract.bound_file_members;
  const countMembers = policy.comparator_contract.expected_counts_exact_members;
  const runIds = [];
  const byFamily = new Map(orderedKeys.map((key) => [key, []]));
  for (const run of runs) {
    exactKeys(run, runMembers, `comparator run ${run.run_identifier}`);
    requireString(run.run_identifier, 'comparator run identifier');
    if (!byFamily.has(run.family)) fail('UNREGISTERED_COMPARATOR_FAMILY', run.family);
    runIds.push(run.run_identifier);
    byFamily.get(run.family).push(run);
    for (const field of ['resolution_binding', 'adapter_result_binding', 'validation_binding']) {
      exactKeys(run[field], fileMembers, `${run.run_identifier} ${field}`);
      validateFileBinding(run[field], `${run.run_identifier} ${field}`);
    }
    exactKeys(run.expected_counts, countMembers, `${run.run_identifier} expected_counts`);
    if (Object.values(run.expected_counts).some((value) => !Number.isInteger(value) || value < 0)) {
      fail('INVALID_COMPARATOR_COUNT', run.run_identifier);
    }
  }
  requireUnique(runIds, 'comparator run identifiers');
  for (const family of families) {
    if (byFamily.get(family.family_key).length !== family.exact_comparator_run_count) {
      fail('COMPARATOR_FAMILY_COUNT_DRIFT', family.family_key);
    }
  }
  return { analysisPolicy, families, runs, byFamily };
}

function buildSourceCatalog(receipts, analysisPolicy) {
  const agreementOrder = new Map(
    analysisPolicy.input_contract.agreement_order.map((agreementId, index) => [agreementId, index]),
  );
  const agreements = new Map();
  for (const output of receipts.m2.output_bindings) {
    const index = readJson(exactPath(output.path), `M2 output ${output.path}`).value;
    const agreementId = index.source_binding?.agreement_id;
    if (!agreementOrder.has(agreementId) || agreements.has(agreementId)) {
      fail('M2_AGREEMENT_DRIFT', String(agreementId));
    }
    const nodes = new Map();
    for (const node of index.nodes) {
      nodes.set(node.node_occurrence_id, node);
    }
    const annotations = new Set(index.annotations.map((row) => row.annotation_occurrence_id));
    agreements.set(agreementId, {
      agreementId,
      agreementOrdinal: agreementOrder.get(agreementId),
      agreementIndexId: index.agreement_index_id,
      canonicalText: Buffer.from(index.source_binding.canonical_text, 'utf8'),
      nodes,
      annotations,
      contextCompilationId: null,
      dependencies: new Map(),
      claims: new Set(),
    });
  }
  for (const output of receipts.m3.output_bindings) {
    if (!output.agreement_id) continue;
    const agreement = agreements.get(output.agreement_id);
    if (!agreement) fail('M3_AGREEMENT_DRIFT', output.agreement_id);
    const compilation = readJson(exactPath(output.path), `M3 output ${output.path}`).value;
    agreement.contextCompilationId = compilation.context_compilation_id;
    for (const [collection, idField] of DEPENDENCY_COLLECTIONS) {
      for (const record of compilation[collection] || []) {
        const id = record[idField];
        if (!id || agreement.dependencies.has(id)) fail('DUPLICATE_M3_DEPENDENCY', String(id));
        agreement.dependencies.set(id, { ...record, dependency_kind: collection });
      }
    }
  }
  for (const output of receipts.m4.output_bindings) {
    if (output.schema_version !== 'AGREEMENT_ANALYSIS/V1') continue;
    const agreement = agreements.get(output.agreement_id);
    if (!agreement) fail('M4_AGREEMENT_DRIFT', output.agreement_id);
    const analysis = readJson(exactPath(output.path), `M4 output ${output.path}`).value;
    for (const claim of analysis.claims) agreement.claims.add(claim.analysis_claim_id);
  }
  if (agreements.size !== 7
    || [...agreements.values()].some((row) => !row.contextCompilationId)) {
    fail('SOURCE_CATALOG_INCOMPLETE', String(agreements.size));
  }
  return agreements;
}

function validateBindingFields(pack, expected, label) {
  exactKeys(pack, ['path', 'byte_length', 'sha256'], label);
  same(pack, {
    path: expected.path,
    byte_length: expected.byte_length,
    sha256: expected.sha256,
  }, label);
}

function validateM2NodeBinding(record, agreements, label, contract) {
  exactKeys(record, contract, label);
  const agreement = agreements.get(record.agreement_id);
  const node = agreement?.nodes.get(record.node_occurrence_id);
  if (!agreement || !node || record.agreement_index_id !== agreement.agreementIndexId
    || record.node_kind !== node.node_kind || record.reference !== node.reference
    || record.structure_revision_id !== node.structure_revision_id) {
    fail('M2_NODE_BINDING_DRIFT', label);
  }
  same(record.extent_span, node.extent_span, `${label} extent_span`);
  return node;
}

function validateM3DependencyBinding(record, agreements, exactMembers, label) {
  exactKeys(record, exactMembers, label);
  const agreement = agreements.get(record.agreement_id);
  const dependency = agreement?.dependencies.get(record.dependency_id);
  if (!agreement || !dependency
    || record.context_compilation_id !== agreement.contextCompilationId
    || record.state !== dependency.state || record.reason_code !== dependency.reason_code) {
    fail('M3_DEPENDENCY_BINDING_DRIFT', label);
  }
  return dependency;
}

function validateSupplementals(pack, policy, agreements) {
  const records = requireArray(pack.supplemental_input_bindings,
    `${pack.family_key} supplemental inputs`);
  requireSorted(records, (a, b) => a.supplemental_id.localeCompare(b.supplemental_id),
    `${pack.family_key} supplemental inputs`);
  requireUnique(records.map((row) => row.supplemental_id),
    `${pack.family_key} supplemental IDs`);
  for (const record of records) {
    exactKeys(record, policy.calibration_pack_contract.supplemental_input_binding_exact_members,
      `${pack.family_key} supplemental ${record.supplemental_id}`);
    if (record.classification !== 'SUPPLEMENTAL_NON_COMPARATOR'
      || record.may_affect_comparator_metrics !== false) {
      fail('SUPPLEMENTAL_BOUNDARY_DRIFT', record.supplemental_id);
    }
    requireString(record.reason, `${record.supplemental_id} reason`);
    validateFileBinding(record.source_binding, `${record.supplemental_id} source binding`);
    for (const node of requireArray(record.m2_node_bindings,
      `${record.supplemental_id} M2 bindings`)) {
      validateM2NodeBinding(node, agreements, `${record.supplemental_id} M2 node`,
        policy.calibration_pack_contract.m2_node_binding_exact_members);
    }
    for (const dependency of requireArray(record.m3_dependency_bindings,
      `${record.supplemental_id} M3 bindings`)) {
      validateM3DependencyBinding(dependency, agreements,
        policy.calibration_pack_contract.m3_dependency_binding_exact_members,
        `${record.supplemental_id} M3 dependency`);
    }
  }
  return records.length;
}

function validateExample(example, pack, policy, agreements, comparatorIds) {
  const label = `${pack.family_key} example ${example.example_id}`;
  exactKeys(example, policy.calibration_pack_contract.provision_example_exact_members, label);
  const agreement = agreements.get(example.agreement_id);
  if (!agreement || typeof example.deal !== 'string') fail('EXAMPLE_AGREEMENT_DRIFT', label);
  const nodeIds = requireArray(example.complete_source_node_occurrence_ids, `${label} nodes`);
  const spans = requireArray(example.source_spans, `${label} spans`);
  const textHashes = requireArray(example.source_text_sha256s, `${label} source hashes`);
  const revisions = requireArray(example.structure_revision_ids, `${label} revisions`);
  if (nodeIds.length === 0 || nodeIds.length !== spans.length
    || nodeIds.length !== textHashes.length || nodeIds.length !== revisions.length) {
    fail('EXAMPLE_SOURCE_CARDINALITY', label);
  }
  requireUnique(nodeIds, `${label} nodes`);
  let previousStart = -1;
  let previousEnd = -1;
  for (let index = 0; index < nodeIds.length; index += 1) {
    const node = agreement.nodes.get(nodeIds[index]);
    if (!node || revisions[index] !== node.structure_revision_id) {
      fail('EXAMPLE_SOURCE_NODE_DRIFT', `${label} node ${index}`);
    }
    exactKeys(spans[index], policy.calibration_pack_contract.source_span_exact_members,
      `${label} span ${index}`);
    same(spans[index], node.extent_span, `${label} span ${index}`);
    if (spans[index].coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      || textHashes[index] !== spans[index].text_sha256) {
      fail('EXAMPLE_SOURCE_HASH_DRIFT', `${label} span ${index}`);
    }
    const slice = agreement.canonicalText.subarray(spans[index].start_byte, spans[index].end_byte);
    if (sha256Hex(slice) !== spans[index].text_sha256) {
      fail('EXAMPLE_SOURCE_BYTES_DRIFT', `${label} span ${index}`);
    }
    if (spans[index].start_byte < previousStart
      || spans[index].start_byte === previousStart && spans[index].end_byte < previousEnd) {
      fail('EXAMPLE_SOURCE_ORDER_DRIFT', label);
    }
    previousStart = spans[index].start_byte;
    previousEnd = spans[index].end_byte;
  }
  const dependencyIds = requireArray(example.m3_dependency_ids, `${label} M3 IDs`);
  requireUnique(dependencyIds, `${label} M3 IDs`);
  requireSorted(dependencyIds, (a, b) => a.localeCompare(b), `${label} M3 IDs`);
  for (const id of dependencyIds) {
    const dependency = agreement.dependencies.get(id);
    if (!dependency || dependency.state !== 'RESOLVED') {
      fail('EXAMPLE_M3_DEPENDENCY_NOT_RESOLVED', `${label}: ${id}`);
    }
  }
  const claimIds = requireArray(example.m4_claim_ids, `${label} M4 claim IDs`);
  requireUnique(claimIds, `${label} M4 claim IDs`);
  requireSorted(claimIds, (a, b) => a.localeCompare(b), `${label} M4 claim IDs`);
  if (claimIds.some((id) => !agreement.claims.has(id))) fail('EXAMPLE_M4_CLAIM_DRIFT', label);
  const runIds = requireArray(example.comparator_run_identifiers, `${label} comparator runs`);
  requireUnique(runIds, `${label} comparator runs`);
  if (runIds.some((id) => !comparatorIds.has(id))) fail('EXAMPLE_COMPARATOR_DRIFT', label);
  requireArray(example.material_difference_tags, `${label} material tags`);
  requireString(example.proposed_subtype, `${label} proposed subtype`);
  requireArray(example.legal_question_ids, `${label} legal question IDs`);
  return {
    agreementOrdinal: agreement.agreementOrdinal,
    minimumStart: Math.min(...spans.map((span) => span.start_byte)),
    exampleId: example.example_id,
  };
}

function validatePack(pack, family, policy, authority, agreements, comparatorRuns) {
  const label = `${family.family_key} calibration pack`;
  exactKeys(pack, policy.calibration_pack_contract.exact_top_level_members, label);
  if (pack.schema_version !== 'STAGE_2Y_FAMILY_CALIBRATION_PACK/V1'
    || pack.family_key !== family.family_key || pack.wave !== family.wave
    || pack.pack_version !== 1 || pack.status !== 'PROPOSED_AWAITING_BEN_APPROVAL'
    || pack.purpose !== 'LEGAL_CALIBRATION_PREPARATION_ONLY') {
    fail('CALIBRATION_PACK_LITERAL_DRIFT', family.family_key);
  }
  const identity = identityWithout(pack, 'calibration_pack_id', 'calibration_pack_digest');
  if (pack.calibration_pack_digest !== identity.digest || pack.calibration_pack_id !== identity.id) {
    fail('CALIBRATION_PACK_IDENTITY_DRIFT', family.family_key);
  }
  validateBindingFields(pack.authority_binding, baseBinding(EXPECTED.authority), `${label} authority`);
  validateBindingFields(pack.calibration_policy_binding, baseBinding(EXPECTED.policy), `${label} policy`);
  validateBindingFields(pack.m4_receipt_binding, authority.bindings.m4_receipt, `${label} M4`);
  validateBindingFields(pack.m2_receipt_binding, authority.bindings.m2_receipt, `${label} M2`);
  validateBindingFields(pack.m3_receipt_binding, authority.bindings.m3_receipt, `${label} M3`);
  validateBindingFields(pack.family_manifest_binding, authority.bindings.family_keys,
    `${label} family manifest`);
  validateBindingFields(pack.control_manifest_binding, authority.bindings.control_manifest,
    `${label} control manifest`);
  validateBindingFields(pack.diff_contract_binding, authority.bindings.diff_contract,
    `${label} diff contract`);
  same(pack.comparator_run_bindings, comparatorRuns, `${label} comparator run bindings`);
  const supplementalCount = validateSupplementals(pack, policy, agreements);
  const examples = requireArray(pack.provision_examples, `${label} examples`);
  if (examples.length < 3 || examples.length > 10) fail('EXAMPLE_COUNT', family.family_key);
  requireUnique(examples.map((row) => row.example_id), `${label} example IDs`);
  const comparatorIds = new Set(comparatorRuns.map((row) => row.run_identifier));
  const ordering = examples.map((example) =>
    validateExample(example, pack, policy, agreements, comparatorIds));
  const sortedOrdering = [...ordering].sort((a, b) =>
    a.agreementOrdinal - b.agreementOrdinal
    || a.minimumStart - b.minimumStart
    || a.exampleId.localeCompare(b.exampleId));
  same(ordering, sortedOrdering, `${label} example order`);

  const dependencies = requireArray(pack.cross_family_dependencies,
    `${label} cross-family dependencies`);
  requireUnique(dependencies.map((row) => row.dependency_id), `${label} dependency IDs`);
  requireSorted(dependencies, (a, b) => a.dependency_id.localeCompare(b.dependency_id),
    `${label} dependencies`);
  const questions = requireArray(pack.narrow_legal_questions, `${label} legal questions`);
  requireUnique(questions.map((row) => row.question_id), `${label} legal question IDs`);
  requireSorted(questions, (a, b) => a.question_id.localeCompare(b.question_id),
    `${label} legal questions`);
  const exampleIds = new Set(examples.map((row) => row.example_id));
  for (const question of questions) {
    exactKeys(question, policy.calibration_pack_contract.legal_question_exact_members,
      `${label} question ${question.question_id}`);
    requireString(question.question, `${label} question text`);
    if (question.status === 'OPEN_REQUIRES_BEN_RULING') {
      if (question.ben_ruling_id !== null) fail('INFERRED_BEN_RULING', question.question_id);
    } else if (question.status === 'RESOLVED_BY_BEN_RULING') {
      requireString(question.ben_ruling_id, `${label} Ben ruling`);
    } else if (question.status !== 'NOT_APPLICABLE') {
      fail('LEGAL_QUESTION_STATE_DRIFT', question.question_id);
    }
    if (requireArray(question.affected_example_ids, `${label} affected examples`)
      .some((id) => !exampleIds.has(id))) fail('LEGAL_QUESTION_EXAMPLE_DRIFT', question.question_id);
  }
  const questionIds = new Set(questions.map((row) => row.question_id));
  for (const example of examples) {
    if (example.legal_question_ids.some((id) => !questionIds.has(id))) {
      fail('EXAMPLE_LEGAL_QUESTION_DRIFT', example.example_id);
    }
  }
  exactKeys(pack.proposed_output_policy,
    policy.calibration_pack_contract.proposed_output_policy_exact_members,
    `${label} proposed output policy`);
  if (pack.proposed_output_policy.renderability !== 'NEVER_RENDER_FROM_PROPOSAL'
    || pack.proposed_output_policy.complete_transition !== 'NOT_AUTHORISED') {
    fail('PROPOSED_OUTPUT_AUTHORITY_DRIFT', family.family_key);
  }
  const diagnostics = requireArray(pack.preparation_diagnostics, `${label} diagnostics`);
  for (const diagnostic of diagnostics) {
    exactKeys(diagnostic, policy.calibration_pack_contract.diagnostic_exact_members,
      `${label} diagnostic`);
  }
  requireSorted(diagnostics, (a, b) => a.code.localeCompare(b.code)
    || String(a.related_id).localeCompare(String(b.related_id)), `${label} diagnostics`);
  exactKeys(pack.preparation_effects,
    policy.calibration_pack_contract.preparation_effects_exact_members,
    `${label} preparation effects`);
  if (Object.values(pack.preparation_effects).some((value) => value !== 0)) {
    fail('NON_ZERO_PREPARATION_EFFECT', family.family_key);
  }
  return {
    supplementalCount,
    openQuestionCount: questions.filter((row) => row.status === 'OPEN_REQUIRES_BEN_RULING').length,
    dependencies,
    diagnostics,
    questionIds,
    profileIds: new Set(pack.proposed_output_policy.candidate_subtype_profile_ids),
  };
}

function validateRole(role, policy, label, required) {
  exactKeys(role, policy.proposed_role_schema_contract.role_exact_members, label);
  requireString(role.role_key, `${label} role_key`);
  if (role.required_for_complete !== required
    || role.missing_disposition !== 'MISSING_REQUIRED_ROLE'
    || role.renderability_on_missing !== 'NON_RENDERABLE_MISSING_REQUIRED_ROLE') {
    fail('ROLE_LITERAL_DRIFT', label);
  }
  const sources = requireArray(role.allowed_sources, `${label} allowed_sources`);
  if (sources.length === 0
    || sources.some((source) => !policy.proposed_role_schema_contract.allowed_sources.includes(source))) {
    fail('ROLE_SOURCE_DRIFT', label);
  }
  const provenance = requireArray(role.provenance_requirements,
    `${label} provenance requirements`);
  for (const field of policy.proposed_role_schema_contract.provenance_minimum) {
    if (!provenance.includes(field)) fail('ROLE_PROVENANCE_MISSING', `${label}: ${field}`);
  }
}

function validateProposal(proposal, pack, packBinding, family, packResult, policy) {
  const label = `${family.family_key} proposed role schema`;
  exactKeys(proposal, policy.proposed_role_schema_contract.exact_top_level_members, label);
  if (proposal.schema_version !== 'STAGE_2Y_PROPOSED_FAMILY_REQUIRED_ROLE_SCHEMA/V1'
    || proposal.family_key !== family.family_key || proposal.role_schema_version !== 1
    || proposal.status !== 'PROPOSED_AWAITING_BEN_APPROVAL'
    || proposal.runner_eligible !== false || proposal.complete_transition_authorised !== false
    || proposal.approval_id !== null || proposal.schema_authority !== null
    || proposal.renderability_rule !== 'NEVER_RENDER_FROM_PROPOSAL') {
    fail('PROPOSED_ROLE_SCHEMA_LITERAL_DRIFT', family.family_key);
  }
  const identity = identityWithout(proposal, 'proposed_role_schema_id', 'proposal_digest');
  if (proposal.proposal_digest !== identity.digest || proposal.proposed_role_schema_id !== identity.id) {
    fail('PROPOSED_ROLE_SCHEMA_IDENTITY_DRIFT', family.family_key);
  }
  validateBindingFields(proposal.authority_binding, baseBinding(EXPECTED.authority),
    `${label} authority`);
  validateBindingFields(proposal.calibration_policy_binding, baseBinding(EXPECTED.policy),
    `${label} policy`);
  const expectedPackBinding = {
    ...packBinding,
    calibration_pack_id: pack.calibration_pack_id,
    calibration_pack_digest: pack.calibration_pack_digest,
  };
  exactKeys(proposal.calibration_pack_binding, Object.keys(expectedPackBinding), `${label} pack`);
  same(proposal.calibration_pack_binding, expectedPackBinding, `${label} pack`);
  exactKeys(proposal.claim_definition_scope,
    policy.proposed_role_schema_contract.claim_definition_scope_exact_members,
    `${label} claim definition scope`);
  const included = requireArray(proposal.claim_definition_scope.included_claim_definition_keys,
    `${label} included claims`);
  const excluded = requireArray(proposal.claim_definition_scope.excluded_claim_definition_keys,
    `${label} excluded claims`);
  requireUnique(included, `${label} included claims`);
  requireUnique(excluded, `${label} excluded claims`);
  if (included.some((key) => excluded.includes(key))) fail('CLAIM_SCOPE_OVERLAP', family.family_key);
  const profiles = requireArray(proposal.subtype_profiles, `${label} subtype profiles`);
  requireUnique(profiles.map((row) => row.profile_id), `${label} profile IDs`);
  const declaredProfiles = profiles.map((row) => row.profile_id);
  same(declaredProfiles, pack.proposed_output_policy.candidate_subtype_profile_ids,
    `${label} profile order and pack output policy`);
  for (const profile of profiles) {
    exactKeys(profile, policy.proposed_role_schema_contract.subtype_profile_exact_members,
      `${label} profile ${profile.profile_id}`);
    requireString(profile.profile_id, `${label} profile ID`);
    if (!Number.isInteger(profile.profile_version) || profile.profile_version < 1) {
      fail('PROFILE_VERSION_DRIFT', profile.profile_id);
    }
    const requiredRoles = requireArray(profile.required_roles,
      `${label} ${profile.profile_id} required roles`);
    const optionalRoles = requireArray(profile.optional_roles,
      `${label} ${profile.profile_id} optional roles`);
    for (const role of requiredRoles) validateRole(role, policy,
      `${label} ${profile.profile_id} required ${role.role_key}`, true);
    for (const role of optionalRoles) validateRole(role, policy,
      `${label} ${profile.profile_id} optional ${role.role_key}`, false);
    const roleKeys = [...requiredRoles, ...optionalRoles].map((row) => row.role_key);
    requireUnique(roleKeys, `${label} ${profile.profile_id} roles`);
    same(profile.role_order, roleKeys, `${label} ${profile.profile_id} role order`);
    const unresolved = requireArray(profile.unresolved_legal_question_ids,
      `${label} ${profile.profile_id} legal questions`);
    if (unresolved.some((id) => !packResult.questionIds.has(id))) {
      fail('PROFILE_LEGAL_QUESTION_DRIFT', profile.profile_id);
    }
  }
  const openQuestions = pack.narrow_legal_questions
    .filter((row) => row.status === 'OPEN_REQUIRES_BEN_RULING')
    .map((row) => row.question_id).sort();
  same(proposal.open_legal_question_ids, openQuestions, `${label} open questions`);
  exactKeys(proposal.approval_requirements,
    policy.proposed_role_schema_contract.approval_requirements_exact_members,
    `${label} approval requirements`);
  if (proposal.approval_requirements.required_approver !== 'BEN_GOODCHILD'
    || proposal.approval_requirements.required_approval_id !== 'NON_NULL'
    || proposal.approval_requirements.required_payload_digest !== 'RECOMPUTED'
    || proposal.approval_requirements.required_sealed_path
      !== 'control/family-role-schemas/<family_key>.json'
    || proposal.approval_requirements.new_family_execution_authority_required !== true) {
    fail('APPROVAL_REQUIREMENT_DRIFT', family.family_key);
  }
  same(proposal.prohibitions, policy.proposed_role_schema_contract.prohibitions,
    `${label} prohibitions`);
  return identity;
}

function validateCrossFamilyDependencies(records, schemas, policy, agreements, families) {
  const familyKeys = new Set(families.map((row) => row.family_key));
  const vocabulary = policy.state_vocabularies;
  const all = new Map();
  for (const [familyKey, dependencies] of records) {
    for (const dependency of dependencies) {
      exactKeys(dependency, policy.calibration_pack_contract.cross_family_dependency_exact_members,
        `${familyKey} dependency ${dependency.dependency_id}`);
      if (all.has(dependency.dependency_id)) fail('DUPLICATE_CROSS_FAMILY_DEPENDENCY',
        dependency.dependency_id);
      if (!vocabulary.cross_family_dependency_kind.includes(dependency.kind)
        || !vocabulary.cross_family_disposition.includes(dependency.disposition)
        || !familyKeys.has(dependency.owning_family)
        || !familyKeys.has(dependency.consuming_family)
        || ![dependency.owning_family, dependency.consuming_family].includes(familyKey)) {
        fail('CROSS_FAMILY_DEPENDENCY_DRIFT', dependency.dependency_id);
      }
      exactKeys(dependency.source_identity,
        policy.calibration_pack_contract.source_identity_exact_members,
        `${dependency.dependency_id} source identity`);
      const agreement = agreements.get(dependency.source_identity.agreement_id);
      if (!agreement) fail('CROSS_FAMILY_AGREEMENT_DRIFT', dependency.dependency_id);
      const sourceNodes = requireArray(dependency.source_identity.node_occurrence_ids,
        `${dependency.dependency_id} nodes`);
      if (sourceNodes.some((id) => !agreement.nodes.has(id))) {
        fail('CROSS_FAMILY_SOURCE_NODE_DRIFT', dependency.dependency_id);
      }
      const sourceIds = requireArray(dependency.source_identity.annotation_or_claim_ids,
        `${dependency.dependency_id} annotations or claims`);
      if (sourceIds.some((id) => !agreement.annotations.has(id) && !agreement.claims.has(id))) {
        fail('CROSS_FAMILY_SOURCE_ID_DRIFT', dependency.dependency_id);
      }
      for (const id of requireArray(dependency.required_edge_ids,
        `${dependency.dependency_id} edge IDs`)) {
        const edge = agreement.dependencies.get(id);
        if (!edge || edge.state !== 'RESOLVED') {
          fail('CROSS_FAMILY_EDGE_NOT_RESOLVED', `${dependency.dependency_id}: ${id}`);
        }
      }
      all.set(dependency.dependency_id, dependency);
    }
  }
  for (const [familyKey, schemaDependencies] of schemas) {
    const packDependencies = records.get(familyKey);
    if (schemaDependencies.every((row) => typeof row === 'string')) {
      const ids = schemaDependencies;
      requireUnique(ids, `${familyKey} schema dependency IDs`);
      requireSorted(ids, (a, b) => a.localeCompare(b), `${familyKey} schema dependency IDs`);
      if (ids.some((id) => !packDependencies.some((row) => row.dependency_id === id))) {
        fail('SCHEMA_DEPENDENCY_NOT_IN_PACK', familyKey);
      }
    } else {
      same(schemaDependencies, packDependencies, `${familyKey} schema dependencies`);
    }
  }
  return all;
}

function validatePreparationArtefacts(authority, policy, registry, agreements) {
  const outputs = [];
  const dependencyRecords = new Map();
  const schemaDependencyRecords = new Map();
  const diagnostics = [];
  let supplementalInputCount = 0;
  let openLegalQuestionCount = 0;
  for (const family of registry.families) {
    const packPath = exactPath(family.calibration_pack_path);
    const proposalPath = exactPath(family.proposed_role_schema_path);
    const packRead = readJson(packPath, `${family.family_key} calibration pack`);
    const proposalRead = readJson(proposalPath, `${family.family_key} proposed role schema`);
    const comparatorRuns = registry.byFamily.get(family.family_key);
    const packResult = validatePack(packRead.value, family, policy, authority, agreements,
      comparatorRuns);
    const packBinding = baseBinding(packPath);
    validateProposal(proposalRead.value, packRead.value, packBinding, family, packResult, policy);
    const proposalBinding = baseBinding(proposalPath);
    outputs.push({
      ...packBinding,
      schema_version: packRead.value.schema_version,
      family_key: family.family_key,
      record_id: packRead.value.calibration_pack_id,
      record_digest: packRead.value.calibration_pack_digest,
      status: packRead.value.status,
    });
    outputs.push({
      ...proposalBinding,
      schema_version: proposalRead.value.schema_version,
      family_key: family.family_key,
      record_id: proposalRead.value.proposed_role_schema_id,
      record_digest: proposalRead.value.proposal_digest,
      status: proposalRead.value.status,
    });
    supplementalInputCount += packResult.supplementalCount;
    openLegalQuestionCount += packResult.openQuestionCount;
    dependencyRecords.set(family.family_key, packResult.dependencies);
    schemaDependencyRecords.set(family.family_key,
      requireArray(proposalRead.value.cross_family_dependencies,
        `${family.family_key} proposal dependencies`));
    diagnostics.push(...packResult.diagnostics);
  }
  if (outputs.length !== 50) fail('PREPARATION_OUTPUT_COUNT', String(outputs.length));
  validateCrossFamilyDependencies(dependencyRecords, schemaDependencyRecords, policy,
    agreements, registry.families);
  requireUnique(outputs.map((row) => row.record_id), 'preparation output record IDs');
  diagnostics.sort((a, b) => a.code.localeCompare(b.code)
    || String(a.related_id).localeCompare(String(b.related_id)));
  return {
    outputs,
    supplementalInputCount,
    openLegalQuestionCount,
    diagnostics,
  };
}

function validateNoRunAndChangedFiles(authority, policy) {
  for (const path of policy.no_run_contract.required_absent_paths) {
    const absolutePath = exactPath(path);
    assertNoSymlink(absolutePath);
    if (existsSync(absolutePath)) fail('PROHIBITED_PATH_PRESENT', path);
  }
  const prospective = [...new Set([...changedFiles(), repoPath(EXPECTED.receipt)])].sort();
  const allowed = [...authority.permitted_changed_files].sort();
  if (authority.changed_file_contract.exact_count !== 58
    || authority.permitted_changed_files.length !== 58
    || canonicalJson(prospective) !== canonicalJson(allowed)) {
    fail('EXACT_CHANGED_FILE_SCOPE', prospective.join(','));
  }
  return authority.permitted_changed_files;
}

function buildReceipt(authority, policy, registry, artefacts, changed) {
  const effects = Object.fromEntries(
    policy.preparation_receipt_contract.effects_exact_members.map((field) => [field, 0]),
  );
  const metrics = {
    family_count: 25,
    wave_count: 4,
    calibration_pack_count: 25,
    proposed_role_schema_count: 25,
    comparator_run_count: 130,
    supplemental_input_count: artefacts.supplementalInputCount,
    open_legal_question_count: artefacts.openLegalQuestionCount,
    runner_eligible_family_count: 0,
    approved_role_schema_count: 0,
    model_call_count: 0,
    family_runner_call_count: 0,
  };
  exactKeys(metrics, policy.preparation_receipt_contract.metrics_exact_members,
    'receipt metrics');
  for (const [field, value] of Object.entries(
    policy.preparation_receipt_contract.metrics_required)) {
    if (metrics[field] !== value) fail('RECEIPT_METRIC_DRIFT', field);
  }
  const checks = CHECK_IDS.map((checkId) => ({
    check_id: checkId,
    status: 'PASS',
    detail: CHECK_DETAILS[checkId],
  }));
  const unsigned = {
    schema_version: 'STAGE_2Y_M5_PREPARATION_RECEIPT/V1',
    stage: 'M5_PREPARATION',
    lifecycle_state: 'SEALED_PREPARATION_ONLY',
    status: 'PASS_PREPARATION_ONLY',
    base_commit: authority.base_commit,
    authority_binding: {
      ...baseBinding(EXPECTED.authority),
      schema_version: authority.schema_version,
      authority_version: authority.authority_version,
      authority_digest: authority.authority_digest,
    },
    calibration_policy_binding: authority.bindings.calibration_policy,
    full_contract_review_binding: authority.bindings.full_contract_review,
    predecessor_receipt_bindings: {
      m2: authority.bindings.m2_receipt,
      m3: authority.bindings.m3_receipt,
      m4: authority.bindings.m4_receipt,
    },
    family_manifest_binding: authority.bindings.family_keys,
    control_manifest_binding: authority.bindings.control_manifest,
    diff_contract_binding: authority.bindings.diff_contract,
    family_order: authority.preparation_family_order,
    output_bindings: artefacts.outputs,
    output_set_digest: sha256Hex(canonicalJson(artefacts.outputs)),
    metrics,
    checks,
    diagnostics: artefacts.diagnostics,
    m5_family_execution_state: 'NOT_AUTHORISED',
    runner_eligible_family_count: 0,
    approved_role_schema_count: 0,
    effects,
    changed_files: changed,
  };
  exactKeys(unsigned,
    policy.preparation_receipt_contract.exact_top_level_members
      .filter((field) => !['receipt_id', 'receipt_digest'].includes(field)),
    'unsigned receipt');
  const receiptDigest = sha256Hex(canonicalJson(unsigned));
  const receiptId = contentId(unsigned.schema_version, {
    ...unsigned,
    receipt_digest: receiptDigest,
  });
  const receipt = {
    ...unsigned,
    receipt_id: receiptId,
    receipt_digest: receiptDigest,
  };
  exactKeys(receipt, policy.preparation_receipt_contract.exact_top_level_members,
    'preparation receipt');
  return receipt;
}

function validatePreparation(authority, policy) {
  validateControls(authority, policy);
  const receipts = validatePredecessors(authority, policy);
  const registry = validateFamilyAndComparatorRegistry(authority, policy);
  const agreements = buildSourceCatalog(receipts, registry.analysisPolicy);
  const artefacts = validatePreparationArtefacts(authority, policy, registry, agreements);
  const changed = validateNoRunAndChangedFiles(authority, policy);
  return buildReceipt(authority, policy, registry, artefacts, changed);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (existsSync(args.receipt)) fail('RECEIPT_ALREADY_EXISTS', repoPath(args.receipt));
  assertNoSymlink(args.receipt);
  const authority = readJson(args.authority, 'M5 preparation authority').value;
  const policy = readJson(args.policy, 'M5 calibration policy').value;
  const receipt = validatePreparation(authority, policy);
  const data = Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8');
  writeFileSync(args.receipt, data, { flag: 'wx' });
  process.stdout.write(`${canonicalJson({
    stage: receipt.stage,
    status: receipt.status,
    lifecycle_state: receipt.lifecycle_state,
    output_set_digest: receipt.output_set_digest,
    receipt: repoPath(args.receipt),
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  buildReceipt,
  validatePreparation,
};
