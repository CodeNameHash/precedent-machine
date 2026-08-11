#!/usr/bin/env node

// Builds the additive Stage 2Y M3 context compilations from the sealed M2 indexes.
// It has no network, model, database, selector, pin, baseline, product or publication path.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileContext } = require('../lib/canonical-v2/context-compilation');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED = Object.freeze({
  authority: resolve(MIGRATION_ROOT, 'control/m3-authority.json'),
  m2Receipt: resolve(
    MIGRATION_ROOT,
    'receipts/stage-2y-structure-m2-agreement-index.json',
  ),
  control: resolve(MIGRATION_ROOT, 'control/manifest.json'),
  agreementManifest: resolve(MIGRATION_ROOT, 'control/cohort-agreements.json'),
  indexRoot: resolve(MIGRATION_ROOT, 'shadow/m2'),
  policy: resolve(MIGRATION_ROOT, 'control/semantic-policy.json'),
  outputRoot: resolve(MIGRATION_ROOT, 'shadow/m3'),
  diagnostics: resolve(MIGRATION_ROOT, 'shadow/m3/context-compilation-diagnostics.json'),
  draft: resolve(
    MIGRATION_ROOT,
    'receipts/stage-2y-structure-m3-context-compilation-draft.json',
  ),
});
const IMPLEMENTATION_PATHS = Object.freeze({
  context_compilation_module: resolve(REPO_ROOT, 'lib/canonical-v2/context-compilation.js'),
  focused_test: resolve(REPO_ROOT, 'tests/canonical-v2-context-compilation.test.js'),
  shadow_runner: fileURLToPath(import.meta.url),
});
const M2_RECEIPT_SHA256 =
  'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585';
const M3_AUTHORITY_SHA256 =
  '959c09a62ac376ed19504b6fcf3d4e1b44054ba7599436dc322a2524117a6b06';
const M3_AUTHORITY_DIGEST =
  '17bd15bd51d0a490168e4678d80cf0c653bdfa9e5e6150e5b01485801ad624da';
const M3_POLICY_SHA256 =
  'd00b971f240a9d8d67f559533d685e9ad2801fdfd1e5986de810dbe803e58bdb';
const M3_POLICY_DIGEST =
  '2538c810b5aee2ee3edc318e77abd2ceaee3a4e9a48929aec9ccdb28ab491d54';
const M3_PACKET_ID = 'stage-2y-structure-m3-context-compilation';
const CONTEXT_SCHEMA = 'CONTEXT_COMPILATION/V1';
const DIAGNOSTICS_SCHEMA = 'STAGE_2Y_M3_CONTEXT_DIAGNOSTICS/V1';
const DRAFT_SCHEMA = 'STAGE_2Y_STRUCTURE_M3_DRAFT_RECEIPT/V1';
const METRICS_SCHEMA = 'STAGE_2Y_STRUCTURE_M3_CONTEXT_METRICS/V1';
const HEX_256 = /^[0-9a-f]{64}$/;
const SELECTED_FOCUS_KINDS = new Set([
  'PARAGRAPH',
  'SENTENCE',
  'CHAPEAU',
  'LIMB',
  'QUALIFICATION',
]);

function fail(code, message) {
  throw new Error(`STAGE_2Y_CONTEXT_COMPILATION_SHADOW:${code}: ${message}`);
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  return value;
}

function absoluteRepositoryPath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) {
    fail('INVALID_REPOSITORY_PATH', String(value));
  }
  const absolutePath = resolve(REPO_ROOT, value);
  repositoryPath(absolutePath);
  return absolutePath;
}

function assertNotSymlink(absolutePath, label) {
  const relativePath = repositoryPath(absolutePath);
  let cursor = REPO_ROOT;
  for (const component of relativePath.split('/')) {
    cursor = resolve(cursor, component);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK', `${label}: ${component}`);
  }
}

function readBytes(absolutePath) {
  assertNotSymlink(absolutePath, repositoryPath(absolutePath));
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repositoryPath(absolutePath));
  return readFileSync(absolutePath);
}

function readJson(absolutePath) {
  try {
    return JSON.parse(readBytes(absolutePath).toString('utf8'));
  } catch (error) {
    fail('INVALID_JSON', `${repositoryPath(absolutePath)}: ${error.message}`);
  }
}

function fileBinding(absolutePath, extra = {}) {
  const bytes = readBytes(absolutePath);
  return Object.freeze({
    path: repositoryPath(absolutePath),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    ...extra,
  });
}

function valueDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function unsignedDigest(value, field) {
  const unsigned = structuredClone(value);
  delete unsigned[field];
  return valueDigest(unsigned);
}

function assertBinding(binding, label, expectedPath = null) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail('INVALID_BINDING', label);
  }
  const absolutePath = absoluteRepositoryPath(binding.path);
  if (expectedPath && absolutePath !== expectedPath) fail('PATH_DRIFT', label);
  const actual = fileBinding(absolutePath);
  if (actual.sha256 !== binding.sha256
    || (binding.byte_length !== undefined && actual.byte_length !== binding.byte_length)) {
    fail('BINDING_DRIFT', label);
  }
  return actual;
}

function parseArgs(argv) {
  const allowed = new Map([
    ['--authority', EXPECTED.authority],
    ['--m2-receipt', EXPECTED.m2Receipt],
    ['--control', EXPECTED.control],
    ['--agreement-manifest', EXPECTED.agreementManifest],
    ['--index-root', EXPECTED.indexRoot],
    ['--policy', EXPECTED.policy],
    ['--output-root', EXPECTED.outputRoot],
  ]);
  if (argv.length !== 16) {
    fail('INVALID_ARGUMENTS', 'requires exactly the seven frozen M3 path flags');
  }
  const values = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || !value || value.startsWith('--') || values.has(flag)) {
      fail('INVALID_ARGUMENTS', String(flag));
    }
    if (isAbsolute(value)) fail('ABSOLUTE_PATH', flag);
    const absolutePath = resolve(REPO_ROOT, value);
    repositoryPath(absolutePath);
    if (absolutePath !== allowed.get(flag)
      || value !== repositoryPath(allowed.get(flag))) fail('PATH_DRIFT', flag);
    values.set(flag, absolutePath);
  }
  if (values.size !== allowed.size) fail('INVALID_ARGUMENTS', 'missing flag');
  return Object.freeze({
    authority: values.get('--authority'),
    m2Receipt: values.get('--m2-receipt'),
    control: values.get('--control'),
    agreementManifest: values.get('--agreement-manifest'),
    indexRoot: values.get('--index-root'),
    policy: values.get('--policy'),
    outputRoot: values.get('--output-root'),
  });
}

function validateAuthority(authority) {
  if (fileBinding(EXPECTED.authority).sha256 !== M3_AUTHORITY_SHA256
    || authority?.schema_version !== 'STAGE_2Y_M3_AUTHORITY/V1'
    || authority.authority_version !== 2
    || authority.stage !== 'M3'
    || authority.authority_state !== 'ACTIVE_FOR_SEVEN_AGREEMENT_SHADOW_AND_FINAL_M3_RECEIPT'
    || !HEX_256.test(authority.authority_digest || '')
    || authority.authority_digest !== M3_AUTHORITY_DIGEST
    || unsignedDigest(authority, 'authority_digest') !== authority.authority_digest
    || authority.post_experiment_sol_gate?.status !== 'PASS'
    || authority.post_experiment_sol_gate?.seven_agreement_runner_authorised_by_this_file
      !== true
    || authority.prohibitions?.model_calls !== 0
    || authority.prohibitions?.phase_b_route_calls !== 0
    || authority.prohibitions?.network_calls !== 0
    || authority.prohibitions?.product_writes !== 0
    || authority.prohibitions?.serving_changes !== 0
    || authority.prohibitions?.m4_activation_state !== 'BLOCKED_PENDING_FINAL_M3_PASS') {
    fail('INVALID_AUTHORITY', 'M3 authority state or digest');
  }
  assertBinding(authority.bindings.m2_receipt, 'authority.bindings.m2_receipt', EXPECTED.m2Receipt);
  assertBinding(authority.bindings.cohort_manifest,
    'authority.bindings.cohort_manifest', EXPECTED.agreementManifest);
  assertBinding(authority.bindings.control_manifest,
    'authority.bindings.control_manifest', EXPECTED.control);
  assertBinding(authority.bindings.semantic_policy,
    'authority.bindings.semantic_policy', EXPECTED.policy);
  assertBinding(authority.bindings.bounded_sol_gate, 'authority.bindings.bounded_sol_gate');
  assertBinding(authority.bindings.full_contract_review, 'authority.bindings.full_contract_review');
  for (const [name, binding] of Object.entries(authority.current_state_bindings || {})) {
    assertBinding(binding, `authority.current_state_bindings.${name}`);
  }
  return authority;
}

function assertChangedFileSubset(authority) {
  let tracked;
  let untracked;
  try {
    tracked = execFileSync('git', ['diff', '--name-only', authority.base_commit, '--'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (error) {
    fail('CHANGED_FILE_INSPECTION_FAILED', error.message);
  }
  const allowed = new Set(authority.permitted_changed_files);
  const changed = [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))];
  const unexpected = changed.filter((path) => !allowed.has(path));
  if (unexpected.length > 0) {
    fail('CHANGED_FILE_OUTSIDE_AUTHORITY', unexpected.sort().join(','));
  }
}

function validatePolicy(policy, authority) {
  if (fileBinding(EXPECTED.policy).sha256 !== M3_POLICY_SHA256
    || policy?.schema_version !== 'STAGE_2Y_SEMANTIC_POLICY/V1'
    || policy.policy_version !== 2
    || !HEX_256.test(policy.policy_digest || '')
    || policy.policy_digest !== M3_POLICY_DIGEST
    || unsignedDigest(policy, 'policy_digest') !== policy.policy_digest
    || policy.policy_digest !== authority.bindings.semantic_policy.policy_digest
    || policy.input_contract?.exact_agreement_count !== 7
    || policy.input_contract?.predecessor_trust_root?.sha256
      !== M2_RECEIPT_SHA256) {
    fail('INVALID_POLICY', 'semantic policy state or digest');
  }
  return policy;
}

function validateM2TrustRoot(receipt, authority) {
  const receiptBinding = fileBinding(EXPECTED.m2Receipt);
  if (receiptBinding.sha256 !== M2_RECEIPT_SHA256
    || receiptBinding.sha256 !== authority.bindings.m2_receipt.sha256
    || receipt.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1'
    || receipt.stage !== 'M2'
    || receipt.lifecycle_state !== 'SEALED'
    || receipt.status !== 'PASS'
    || receipt.agreement_count !== 7
    || !Array.isArray(receipt.output_bindings)
    || receipt.output_bindings.length !== 7
    || valueDigest(receipt.output_bindings) !== receipt.output_set_digest
    || receipt.output_set_digest !== authority.bindings.m2_receipt.output_set_digest) {
    fail('M2_TRUST_ROOT_DRIFT', 'receipt state or output-set digest');
  }
  const authorityByPath = new Map(
    authority.bindings.agreement_indexes.map((binding) => [binding.path, binding]),
  );
  for (const [index, binding] of receipt.output_bindings.entries()) {
    const expected = authorityByPath.get(binding.path);
    if (!expected) fail('M2_TRUST_ROOT_DRIFT', `unbound output ${binding.path}`);
    const actual = assertBinding(binding, `m2.output_bindings[${index}]`);
    if (actual.sha256 !== expected.sha256 || actual.byte_length !== expected.byte_length) {
      fail('M2_TRUST_ROOT_DRIFT', binding.path);
    }
  }
  return receipt;
}

function validateInputRoots(args, authority, policy, receipt) {
  assertNotSymlink(args.indexRoot, 'index root');
  if (!lstatSync(args.indexRoot).isDirectory()) fail('INVALID_INDEX_ROOT', repositoryPath(args.indexRoot));
  const expectedNames = authority.bindings.agreement_indexes
    .map((binding) => binding.path.split('/').at(-1))
    .sort();
  const actualNames = readdirSync(args.indexRoot, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) fail('INVALID_INDEX_ROOT_MEMBER', entry.name);
      return entry.name;
    })
    .sort();
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    fail('INDEX_ROOT_INVENTORY_DRIFT', canonicalJson(actualNames));
  }
  const manifest = readJson(args.agreementManifest);
  const manifestIds = manifest.agreements?.map((agreement) => agreement.agreement_id);
  const expectedIds = policy.input_contract.agreement_order;
  if (canonicalJson(manifestIds) !== canonicalJson(expectedIds)
    || canonicalJson(authority.bindings.cohort_manifest.agreement_ids)
      !== canonicalJson(expectedIds)
    || canonicalJson(receipt.output_bindings.map((binding) =>
      binding.path.split('/').at(-1).replace('.agreement-index.json', '')))
      !== canonicalJson(expectedIds)) {
    fail('COHORT_ORDER_DRIFT', 'agreement order');
  }
  return manifest;
}

function deriveFocusNodeIds(index, policy) {
  const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const selected = index.nodes.filter((node) => SELECTED_FOCUS_KINDS.has(node.node_kind));
  const selectedIds = new Set(selected.map((node) => node.node_occurrence_id));
  for (const section of index.nodes.filter((node) => node.node_kind === 'SECTION')) {
    const pending = [...section.child_node_occurrence_ids];
    let hasSelectedDescendant = false;
    while (pending.length > 0 && !hasSelectedDescendant) {
      const child = byId.get(pending.pop());
      if (!child) fail('INVALID_INDEX_TREE', section.node_occurrence_id);
      if (selectedIds.has(child.node_occurrence_id)) hasSelectedDescendant = true;
      else pending.push(...child.child_node_occurrence_ids);
    }
    if (!hasSelectedDescendant) selected.push(section);
  }
  selected.sort((left, right) =>
    left.extent_span.start_byte - right.extent_span.start_byte
      || left.extent_span.end_byte - right.extent_span.end_byte
      || left.node_occurrence_id.localeCompare(right.node_occurrence_id));
  const ids = selected.map((node) => node.node_occurrence_id);
  const expected = policy.input_contract.agreement_indexes.find(
    (binding) => binding.agreement_id === index.source_binding.agreement_id,
  );
  if (!expected || ids.length !== expected.focus_count || new Set(ids).size !== ids.length) {
    fail('FOCUS_SET_DRIFT', index.source_binding.agreement_id);
  }
  return ids;
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function prospectiveBinding(absolutePath, value, extra = {}) {
  const bytes = canonicalBytes(value);
  return Object.freeze({
    path: repositoryPath(absolutePath),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    ...extra,
  });
}

function preflightCanonicalTarget(absolutePath, value) {
  if (!existsSync(absolutePath)) return;
  assertNotSymlink(absolutePath, repositoryPath(absolutePath));
  if (!readFileSync(absolutePath).equals(canonicalBytes(value))) {
    fail('DIVERGENT_SEALED_OUTPUT_OVERWRITE', repositoryPath(absolutePath));
  }
}

function assertOutputRootInventory(outputRoot, expectedNames, allowMissing) {
  if (!existsSync(outputRoot)) {
    if (allowMissing) return;
    fail('OUTPUT_ROOT_INVENTORY_DRIFT', 'missing output root');
  }
  assertNotSymlink(outputRoot, repositoryPath(outputRoot));
  const names = readdirSync(outputRoot, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) fail('INVALID_OUTPUT_ROOT_MEMBER', entry.name);
    return entry.name;
  }).sort();
  const allowed = [...expectedNames].sort();
  if (allowMissing) {
    if (names.some((name) => !allowed.includes(name))) {
      fail('OUTPUT_ROOT_INVENTORY_DRIFT', canonicalJson(names));
    }
  } else if (canonicalJson(names) !== canonicalJson(allowed)) {
    fail('OUTPUT_ROOT_INVENTORY_DRIFT', canonicalJson(names));
  }
}

function writeCanonicalOnce(absolutePath, value) {
  const bytes = canonicalBytes(value);
  if (existsSync(absolutePath)) {
    assertNotSymlink(absolutePath, repositoryPath(absolutePath));
    const prior = readFileSync(absolutePath);
    if (!prior.equals(bytes)) fail('DIVERGENT_SEALED_OUTPUT_OVERWRITE', repositoryPath(absolutePath));
    return;
  }
  mkdirSync(dirname(absolutePath), { recursive: true });
  assertNotSymlink(dirname(absolutePath), repositoryPath(dirname(absolutePath)));
  writeFileSync(absolutePath, bytes, { flag: 'wx' });
}

function countBy(values, key) {
  const counts = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right)));
}

function compilationMetrics(compilation, deal, agreementId) {
  const carriedM2 = compilation.ambiguities.filter(
    (ambiguity) => ambiguity.ambiguity_type === 'M2_STRUCTURE_AMBIGUITY',
  ).length;
  return Object.freeze({
    deal,
    agreement_id: agreementId,
    focus_count: compilation.focus_node_occurrence_ids.length,
    fact_count: compilation.context_facts.length,
    facts_by_state_and_role: countBy(
      compilation.context_facts,
      (fact) => `${fact.state}|${fact.role}`,
    ),
    scope_edge_count: compilation.scope_edges.length,
    scope_edges_by_state_and_kind: countBy(
      compilation.scope_edges,
      (edge) => `${edge.state}|${edge.edge_kind}`,
    ),
    ambiguity_count: compilation.ambiguities.length,
    carried_m2_ambiguity_count: carriedM2,
    residual_count: compilation.residuals.length,
    residuals_by_kind: countBy(compilation.residuals, (residual) => residual.residual_kind),
    reference_count: compilation.reference_edges.length,
    references_by_state: countBy(compilation.reference_edges, (edge) => edge.state),
    definition_count: compilation.definition_edges.length,
    definitions_by_state: countBy(compilation.definition_edges, (edge) => edge.state),
    relationship_count: compilation.semantic_relationships.length,
    relationships_by_state_and_type: countBy(
      compilation.semantic_relationships,
      (relationship) => `${relationship.state}|${relationship.relationship_type}`,
    ),
    diagnostic_count: compilation.diagnostics.length,
    diagnostics_by_type: countBy(compilation.diagnostics, (diagnostic) => diagnostic.diagnostic_type),
  });
}

function addNumericMaps(rows, field) {
  const result = {};
  for (const row of rows) {
    for (const [key, count] of Object.entries(row[field])) result[key] = (result[key] || 0) + count;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) =>
    left.localeCompare(right)));
}

function aggregateMetrics(rows, policy) {
  const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
  const complete = (keys, counts) => Object.fromEntries(
    [...keys].sort((left, right) => left.localeCompare(right))
      .map((key) => [key, counts[key] || 0]),
  );
  const facts = complete(
    policy.context_states.flatMap((state) =>
      policy.context_role_order.map((role) => `${state}|${role}`)),
    addNumericMaps(rows, 'facts_by_state_and_role'),
  );
  const scopes = complete(
    policy.scope_edge_states.flatMap((state) =>
      policy.scope_edge_kinds.map((kind) => `${state}|${kind}`)),
    addNumericMaps(rows, 'scope_edges_by_state_and_kind'),
  );
  const relationships = complete(
    policy.relationship_states.flatMap((state) =>
      policy.relationship_types.map((type) => `${state}|${type}`)),
    addNumericMaps(rows, 'relationships_by_state_and_type'),
  );
  const diagnostics = complete(
    policy.diagnostic_types,
    addNumericMaps(rows, 'diagnostics_by_type'),
  );
  const references = complete(
    ['AMBIGUOUS', 'RESOLVED', 'UNRESOLVED'],
    addNumericMaps(rows, 'references_by_state'),
  );
  const definitions = complete(
    ['AMBIGUOUS', 'RESOLVED', 'UNRESOLVED'],
    addNumericMaps(rows, 'definitions_by_state'),
  );
  return Object.freeze({
    FOCUS_COUNT: sum('focus_count'),
    FACT_COUNT_BY_STATE_AND_ROLE: facts,
    SCOPE_EDGE_COUNT_BY_STATE_AND_KIND: scopes,
    AMBIGUITY_COUNT: sum('ambiguity_count'),
    RESIDUAL_COUNT: sum('residual_count'),
    REFERENCE_COUNT_BY_STATE: references,
    DEFINITION_COUNT_BY_STATE: definitions,
    RELATIONSHIP_COUNT_BY_STATE_AND_TYPE: relationships,
    DIAGNOSTIC_COUNT_BY_TYPE: diagnostics,
    CARRIED_M2_AMBIGUITY_COUNT: sum('carried_m2_ambiguity_count'),
    REFERENCE_CLOSURE_TOTALS: {
      annotation_count: sum('reference_count'),
      resolved_unique: references.RESOLVED,
      unresolved_no_target: references.UNRESOLVED,
      ambiguous_multiple_targets: references.AMBIGUOUS,
    },
    DEFINITION_CLOSURE_TOTALS: {
      definition_annotation_count:
        policy.definition_resolution_contract.expected_totals.definition_annotation_count,
      use_annotation_count: sum('definition_count'),
      resolved_unique: definitions.RESOLVED,
      ambiguous_multiple_definitions: definitions.AMBIGUOUS,
      unresolved_no_definition: definitions.UNRESOLVED,
    },
  });
}

function buildDiagnosticsLedger(agreementIds, compilations, policy) {
  const diagnostics = compilations.flatMap((compilation) => compilation.diagnostics);
  const observed = countBy(diagnostics, (diagnostic) => diagnostic.diagnostic_type);
  const countsByType = Object.fromEntries(
    [...policy.diagnostic_types].sort((left, right) => left.localeCompare(right))
      .map((type) => [type, observed[type] || 0]),
  );
  const unsigned = {
    schema_version: DIAGNOSTICS_SCHEMA,
    agreement_ids: agreementIds,
    diagnostic_count: diagnostics.length,
    counts_by_type: countsByType,
    diagnostics,
  };
  return Object.freeze({
    schema_version: DIAGNOSTICS_SCHEMA,
    diagnostics_ledger_id: contentId(DIAGNOSTICS_SCHEMA, unsigned),
    agreement_ids: unsigned.agreement_ids,
    diagnostic_count: unsigned.diagnostic_count,
    counts_by_type: unsigned.counts_by_type,
    diagnostics: unsigned.diagnostics,
  });
}

function buildDraft({
  authority,
  policy,
  manifest,
  m2Receipt,
  outputBindings,
  diagnosticsBinding,
  contextMetrics,
  runtimeMeasurements,
}) {
  return Object.freeze({
    schema_version: DRAFT_SCHEMA,
    packet_id: M3_PACKET_ID,
    stage: 'M3',
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
    status: 'STOPPED',
    base_commit: authority.base_commit,
    authority_binding: fileBinding(EXPECTED.authority, {
      schema_version: authority.schema_version,
      authority_version: authority.authority_version,
      authority_digest: authority.authority_digest,
    }),
    semantic_policy_binding: fileBinding(EXPECTED.policy, {
      schema_version: policy.schema_version,
      policy_version: policy.policy_version,
      policy_digest: policy.policy_digest,
    }),
    agreement_manifest_binding: fileBinding(EXPECTED.agreementManifest, {
      schema_version: manifest.schema_version,
      source_manifest_id: manifest.source_manifest_id,
    }),
    sealed_predecessor_bindings: {
      m2_receipt: fileBinding(EXPECTED.m2Receipt, {
        schema_version: m2Receipt.schema_version,
        stage: m2Receipt.stage,
        lifecycle_state: m2Receipt.lifecycle_state,
        status: m2Receipt.status,
        output_set_digest: m2Receipt.output_set_digest,
      }),
    },
    current_state_bindings: authority.current_state_bindings,
    implementation_bindings: Object.fromEntries(
      Object.entries(IMPLEMENTATION_PATHS).map(([name, path]) => [name, fileBinding(path)]),
    ),
    agreement_count: 7,
    source_reference_count: 130,
    output_root: repositoryPath(EXPECTED.outputRoot),
    output_bindings: outputBindings,
    diagnostics_binding: diagnosticsBinding,
    output_set_digest: valueDigest(outputBindings),
    context_metrics: contextMetrics,
    runtime_measurements: runtimeMeasurements,
    input_digests: {
      authority: fileBinding(EXPECTED.authority).sha256,
      semantic_policy: fileBinding(EXPECTED.policy).sha256,
      control_manifest: fileBinding(EXPECTED.control).sha256,
      agreement_manifest: fileBinding(EXPECTED.agreementManifest).sha256,
      m2_receipt: fileBinding(EXPECTED.m2Receipt).sha256,
      m2_output_set: m2Receipt.output_set_digest,
    },
    changed_files: authority.permitted_changed_files,
    expected_differences: [],
    unexpected_differences: [],
    open_world_by_family: m2Receipt.open_world_by_family,
    old_result_digest: m2Receipt.old_result_digest,
    new_shadow_result_digest: valueDigest(outputBindings),
    focused_checks: [
      { check: 'SEVEN_AGREEMENT_SCHEMA_IDENTITY_AND_FOCUS', result: 'PASS' },
      { check: 'REFERENCE_DEFINITION_AND_AMBIGUITY_CLOSURE', result: 'PASS' },
      { check: 'FROZEN_CURRENT_STATE', result: 'PASS' },
      { check: 'NO_PRODUCTION_EFFECTS', result: 'PASS' },
    ],
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    release_receipts_created: 0,
    current_selector_changes: 0,
    model_calls: 0,
    phase_b_route_calls: 0,
    network_calls: 0,
    product_writes: 0,
    serving_changes: 0,
    m0_m1_m2_sealed_artefact_mutations: 0,
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    database_target: 'NONE',
    phase_b_status: 'DEFERRED_LOCKED',
    publication_authorisation: 'NONE',
    internal_cutover_authorisation: 'NONE',
    external_access_authorisation: 'NONE',
    rollback_result: 'NOT_RUN_ADDITIVE_SHADOW_ONLY',
    rollback_command: authority.rollback.command,
    technical_review: 'PENDING_SOL_REVIEW',
  });
}

function main() {
  const started = process.hrtime.bigint();
  const memoryBefore = process.memoryUsage();
  const args = parseArgs(process.argv);
  const authority = validateAuthority(readJson(args.authority));
  assertChangedFileSubset(authority);
  const policy = validatePolicy(readJson(args.policy), authority);
  const m2Receipt = validateM2TrustRoot(readJson(args.m2Receipt), authority);
  const manifest = validateInputRoots(args, authority, policy, m2Receipt);

  const outputNames = [
    ...policy.input_contract.agreement_order.map(
      (agreementId) => `${agreementId}.context-compilation.json`,
    ),
    'context-compilation-diagnostics.json',
  ];
  assertOutputRootInventory(args.outputRoot, outputNames, true);
  assertNotSymlink(args.outputRoot, repositoryPath(args.outputRoot));

  const compilations = [];
  const pendingOutputs = [];
  const outputBindings = [];
  const metricRows = [];
  for (const inputBinding of policy.input_contract.agreement_indexes) {
    const indexPath = absoluteRepositoryPath(inputBinding.path);
    const actualInput = fileBinding(indexPath);
    if (actualInput.sha256 !== inputBinding.sha256
      || actualInput.byte_length !== inputBinding.byte_length) {
      fail('INDEX_BINDING_DRIFT', inputBinding.agreement_id);
    }
    const index = readJson(indexPath);
    const focusNodeIds = deriveFocusNodeIds(index, policy);
    const compilation = compileContext(focusNodeIds, index, policy);
    if (compilation.schema_version !== CONTEXT_SCHEMA
      || compilation.focus_node_occurrence_ids.length !== inputBinding.focus_count) {
      fail('INVALID_COMPILATION', inputBinding.agreement_id);
    }
    const outputPath = resolve(
      args.outputRoot,
      `${inputBinding.agreement_id}.context-compilation.json`,
    );
    const binding = prospectiveBinding(outputPath, compilation, {
      schema_version: compilation.schema_version,
      agreement_id: inputBinding.agreement_id,
      agreement_index_id: index.agreement_index_id,
      context_compilation_id: compilation.context_compilation_id,
    });
    compilations.push(compilation);
    pendingOutputs.push({ path: outputPath, value: compilation });
    outputBindings.push(binding);
    metricRows.push(compilationMetrics(compilation, inputBinding.deal, inputBinding.agreement_id));
  }

  const agreementIds = policy.input_contract.agreement_order;
  const diagnosticsLedger = buildDiagnosticsLedger(agreementIds, compilations, policy);
  const diagnosticsBinding = prospectiveBinding(EXPECTED.diagnostics, diagnosticsLedger, {
    schema_version: diagnosticsLedger.schema_version,
    diagnostics_ledger_id: diagnosticsLedger.diagnostics_ledger_id,
  });
  pendingOutputs.push({ path: EXPECTED.diagnostics, value: diagnosticsLedger });
  outputBindings.push(diagnosticsBinding);

  const contextMetrics = aggregateMetrics(metricRows, policy);
  if (contextMetrics.FOCUS_COUNT !== 13996
    || contextMetrics.CARRIED_M2_AMBIGUITY_COUNT !== 23
    || contextMetrics.REFERENCE_CLOSURE_TOTALS.annotation_count !== 2000
    || contextMetrics.DEFINITION_CLOSURE_TOTALS.use_annotation_count !== 27836) {
    fail('AGGREGATE_METRIC_DRIFT', canonicalJson(contextMetrics));
  }
  const ended = process.hrtime.bigint();
  const memoryAfter = process.memoryUsage();
  const runtimeMeasurements = {
    elapsed_milliseconds: Number((ended - started) / 1000000n),
    rss_before_bytes: memoryBefore.rss,
    rss_after_bytes: memoryAfter.rss,
    heap_used_before_bytes: memoryBefore.heapUsed,
    heap_used_after_bytes: memoryAfter.heapUsed,
    process_peak_rss_kibibytes: process.resourceUsage().maxRSS,
  };
  const draft = buildDraft({
    authority,
    policy,
    manifest,
    m2Receipt,
    outputBindings,
    diagnosticsBinding,
    contextMetrics,
    runtimeMeasurements,
  });
  for (const output of pendingOutputs) preflightCanonicalTarget(output.path, output.value);
  preflightCanonicalTarget(EXPECTED.draft, draft);
  for (const output of pendingOutputs) writeCanonicalOnce(output.path, output.value);
  assertOutputRootInventory(args.outputRoot, outputNames, false);
  writeCanonicalOnce(EXPECTED.draft, draft);
  process.stdout.write(`${canonicalJson({
    stage: 'M3',
    status: 'STOPPED_PENDING_SOL_REVIEW',
    agreement_count: 7,
    output_set_digest: draft.output_set_digest,
    diagnostics: diagnosticsLedger.diagnostic_count,
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  aggregateMetrics,
  buildDiagnosticsLedger,
  compilationMetrics,
  deriveFocusNodeIds,
  validateM2TrustRoot,
  validatePolicy,
};
