#!/usr/bin/env node

// Validates one Stage 2Y migration receipt. This command is read-only.

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAgreementIndex,
  assertAgreementManifest,
  assertM0AndM1,
  assertM2Authority,
  assertStructuralPolicy,
  buildInlineParserMetrics,
  exactSourceForAgreement,
} from './stage-2y-agreement-index-shadow.mjs';
import {
  validateBaseline,
  validateManifest,
  validateReport,
} from './stage-2y-cd-measurement.mjs';
import {
  aggregateMetrics as aggregateM3Metrics,
  buildDiagnosticsLedger as buildM3DiagnosticsLedger,
  compilationMetrics as m3CompilationMetrics,
  deriveFocusNodeIds as deriveM3FocusNodeIds,
} from './stage-2y-context-compilation-shadow.mjs';

const require = createRequire(import.meta.url);
const { listRegisteredSectionFamilies } = require(
  '../lib/canonical-v2/native-producer/producer-prompt-registry',
);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { indexAgreement } = require('../lib/canonical-v2/agreement-index');
const { compileContext } = require('../lib/canonical-v2/context-compilation');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const RECEIPT_SCHEMA = 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1';
const STAGES = new Set(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']);
const ZERO_FIELDS = Object.freeze([
  'model_calls',
  'phase_b_route_calls',
  'product_writes',
  'pin_changes',
  'baseline_changes',
  'saved_control_mutations',
  'release_receipts_created',
  'current_selector_changes',
  'serving_changes',
]);
const M0_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m0-control-freeze.json';
const M1_FINAL_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m1-falsification-prototype.json';
const M1_OUTPUT_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/prototype/m1';
const M1_SOL_REVIEW_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/reviews/stage-2y-structure-m1-sol-technical-review.json';
const M1_SOL_REVIEW_SCHEMA = 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1';
const M1_OUTPUT_SET_DOMAIN = 'STAGE_2Y_STRUCTURE_M1_FINAL_OUTPUT_SET/V1';
const M1_UNSIGNED_DECISION_DOMAIN = 'STAGE_2Y_STRUCTURE_M1_UNSIGNED_DECISION/V1';
const M1_CHECKS = Object.freeze([
  'PROTOTYPE_INTERNAL_ASSERTIONS',
  'PROTOTYPE_OUTPUT_SCHEMA',
  'STAGE_2Y_STRUCTURE_PROTOTYPE_TEST',
  'STRUCTURE_AND_INHERITANCE_GATE',
  'TERMINATION_INHERITANCE_ADDITION',
  'SOL_TECHNICAL_REVIEW',
]);
const M1_OUTPUT_SCHEMAS = Object.freeze({
  'agreement-index.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_INDEX/V1',
  'byte-ownership.json': 'STAGE_2Y_STRUCTURE_BYTE_OWNERSHIP/V1',
  'node-aliases.json': 'STAGE_2Y_STRUCTURE_NODE_ALIASES/V1',
  'structure-alternatives.json': 'STAGE_2Y_STRUCTURE_ALTERNATIVES/V1',
  'reference-edges.json': 'STAGE_2Y_STRUCTURE_REFERENCE_EDGES/V1',
  'context-facts.json': 'STAGE_2Y_STRUCTURE_CONTEXT_FACTS/V1',
  'current-semantic-mapping.json': 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1',
  'source-to-row-diff.json': 'STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF/V1',
  'decision.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1',
});
const M1_REVIEW_CHECKS = Object.freeze([
  'STAGE_2Y_STRUCTURE_PROTOTYPE_TEST',
  'STRUCTURE_AND_INHERITANCE_GATE',
  'TERMINATION_INHERITANCE_ADDITION',
]);
const M2_PACKET_ID = 'stage-2y-structure-m2-agreement-index';
const M2_BASE_COMMIT = '5c61c51b81f8983d3f18c6dcef2086eff29e661c';
const M2_FINAL_RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index.json';
const M2_FINAL_RECEIPT_SHA256 =
  'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585';
const M2_DRAFT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index-draft.json';
const M2_REVIEW_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/reviews/stage-2y-structure-m2-sol-technical-review.json';
const M2_OUTPUT_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m2';
const M2_REVIEW_SCHEMA = 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1';
const M2_DRAFT_SCHEMA = 'STAGE_2Y_STRUCTURE_M2_DRAFT_RECEIPT/V1';
const M2_INDEX_SCHEMA = 'AGREEMENT_INDEX/V1';
const M2_REVIEW_CHECKS = Object.freeze([
  'PUBLIC_API_AND_SYNTHETIC',
  'SEVEN_AGREEMENT_EXACT_SOURCE',
  'METSERA_7_04_GOLDEN',
  'RED_HAT_STRUCTURE_GOLDEN',
  'CONCHO_6_9_A_GOLDEN',
  'INLINE_MARKER_DISPOSITION_GATE',
  'FROZEN_CURRENT_STATE',
  'STRUCTURE_AND_INHERITANCE_GATE',
  'NO_PRODUCTION_EFFECTS',
]);
const M2_FINAL_CHECKS = Object.freeze([...M2_REVIEW_CHECKS, 'SOL_TECHNICAL_REVIEW']);
const M2_IMPLEMENTATION_PATHS = Object.freeze({
  agreement_index_module: 'lib/canonical-v2/agreement-index.js',
  private_inline_structure_module: 'lib/canonical-v2/agreement-inline-structure.js',
  private_inline_structure_test: 'tests/canonical-v2-agreement-inline-structure.test.js',
  shadow_runner: 'scripts/stage-2y-agreement-index-shadow.mjs',
  focused_test: 'tests/canonical-v2-agreement-index.test.js',
  finaliser: 'scripts/stage-2y-agreement-index-m2-finalise.mjs',
  validator: 'scripts/stage-2y-structure-migration-validate.mjs',
});
const M2_DRAFT_IMPLEMENTATION_KEYS = Object.freeze([
  'agreement_index_module', 'private_inline_structure_module', 'private_inline_structure_test',
  'shadow_runner', 'focused_test',
]);
const M2_BINDINGS = Object.freeze({
  authority: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m2-authority.json',
    sha256: 'f62bd067a53fa1fb67dcb6859d9586a18a58e01360fa4179b9e485446bf75b20',
  }),
  structural_policy: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/structural-policy.json',
    sha256: 'cd4523d0f39bed64b9dce99eb9df571b262478bc2a2adf36bf7f4a9d955ec732',
  }),
  agreement_manifest: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/cohort-agreements.json',
    sha256: '0dd150d57da4894f30cd94df53c1983395abc98474b716332e71aa40375f2ecc',
  }),
  sealed_predecessors: Object.freeze({
    m0_control_manifest: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json',
      sha256: '62fa3cb1f25a0e180da93bd94516637a119d4e99b6890f0d8321c9ea30b25a41',
    }),
    m0_receipt: Object.freeze({
      path: M0_RECEIPT_PATH,
      sha256: 'b2b054ba1b67179873f029b85e8d556dfcb1339659145620a6e499a9a1d3acc6',
    }),
    m1_decision: Object.freeze({
      path: `${M1_OUTPUT_ROOT}/decision.json`,
      sha256: 'd11b4e2878d976d96d11948a4561d572ddc313116faa94593dda7b4784a5e3c3',
    }),
    m1_receipt: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m1-falsification-prototype.json',
      sha256: '75e07e2f0cfcacf6f58a88213c36a5424a4fdd8d662772c4074b57ef0183375e',
    }),
    m1_sol_review: Object.freeze({
      path: M1_SOL_REVIEW_PATH,
      sha256: 'aac25e1b7687bcccb50efe1bbbfa46664e9ffee3d088f6d47126ffecdead2a23',
    }),
  }),
  current_state: Object.freeze({
    baseline_manifest: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json',
      sha256: '634064b5a8f6c223edd1c3c2f4faa9ae0ab7be181a6b3d0ef086354eb37b7fe9',
    }),
    current_baseline: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-cd-baseline.json',
      sha256: '892d258699ab933051e135d66c9a515fadd7983f6d2e11e2e7d4804871424dcb',
    }),
    current_measurement: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-cd-report.json',
      sha256: '63a6bd818edc1e77780261c021d3b9b33ec65ef483deee4ee1bc18b9582df4f3',
    }),
    current_rendered_rows: Object.freeze({
      path: 'evidence/canonical-v2/stage-2y-n-rendered-rows.json',
      sha256: '537b1f132f4fcfa7df50cc9536f68fc615a81c7334929b4cbb55fd70f2f884d4',
    }),
  }),
});
const M3_PACKET_ID = 'stage-2y-structure-m3-context-compilation';
const M3_BASE_COMMIT = '33137fd57bec3243757e90bb45f039ec182c3d1a';
const M3_DRAFT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m3-context-compilation-draft.json';
const M3_REVIEW_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/reviews/stage-2y-structure-m3-sol-technical-review.json';
const M3_FULL_CONTRACT_REVIEW_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/reviews/stage-2y-structure-m3-full-contract-sol-freeze.json';
const M3_OUTPUT_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m3';
const M3_DIAGNOSTICS_PATH = `${M3_OUTPUT_ROOT}/context-compilation-diagnostics.json`;
const M3_DRAFT_SCHEMA = 'STAGE_2Y_STRUCTURE_M3_DRAFT_RECEIPT/V1';
const M3_REVIEW_SCHEMA = 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1';
const M3_CONTEXT_SCHEMA = 'CONTEXT_COMPILATION/V1';
const M3_DIAGNOSTICS_SCHEMA = 'STAGE_2Y_M3_CONTEXT_DIAGNOSTICS/V1';
const M3_FINAL_CHECKS = Object.freeze([
  'BOUNDED_CONTRACT_REGRESSION',
  'SEVEN_AGREEMENT_SCHEMA_IDENTITY',
  'PROVENANCE_AND_SCOPE',
  'REFERENCE_DEFINITION_TOPOLOGY_CLOSURE',
  'REQUIRED_REAL_FIXTURES',
  'DETERMINISM',
  'FROZEN_CURRENT_STATE',
  'NO_PRODUCTION_EFFECTS',
  'SOL_TECHNICAL_REVIEW',
]);
const M3_REVIEW_CHECKS = Object.freeze(M3_FINAL_CHECKS.slice(0, -1));
const M3_CONTEXT_METRIC_KEYS = Object.freeze([
  'FOCUS_COUNT',
  'FACT_COUNT_BY_STATE_AND_ROLE',
  'SCOPE_EDGE_COUNT_BY_STATE_AND_KIND',
  'AMBIGUITY_COUNT',
  'RESIDUAL_COUNT',
  'REFERENCE_COUNT_BY_STATE',
  'DEFINITION_COUNT_BY_STATE',
  'RELATIONSHIP_COUNT_BY_STATE_AND_TYPE',
  'DIAGNOSTIC_COUNT_BY_TYPE',
  'CARRIED_M2_AMBIGUITY_COUNT',
  'REFERENCE_CLOSURE_TOTALS',
  'DEFINITION_CLOSURE_TOTALS',
]);
const M3_IMPLEMENTATION_PATHS = Object.freeze({
  context_compilation_module: 'lib/canonical-v2/context-compilation.js',
  focused_test: 'tests/canonical-v2-context-compilation.test.js',
  shadow_runner: 'scripts/stage-2y-context-compilation-shadow.mjs',
  finaliser: 'scripts/stage-2y-context-compilation-m3-finalise.mjs',
  validator: 'scripts/stage-2y-structure-migration-validate.mjs',
});
const M3_DRAFT_IMPLEMENTATION_KEYS = Object.freeze([
  'context_compilation_module',
  'focused_test',
  'shadow_runner',
]);
const M3_BINDINGS = Object.freeze({
  authority: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m3-authority.json',
    sha256: '959c09a62ac376ed19504b6fcf3d4e1b44054ba7599436dc322a2524117a6b06',
  }),
  semantic_policy: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/semantic-policy.json',
    sha256: 'd00b971f240a9d8d67f559533d685e9ad2801fdfd1e5986de810dbe803e58bdb',
  }),
  m2_receipt: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index.json',
    sha256: 'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585',
  }),
  agreement_manifest: M2_BINDINGS.agreement_manifest,
  control_manifest: M2_BINDINGS.sealed_predecessors.m0_control_manifest,
  current_state: M2_BINDINGS.current_state,
});

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_RECEIPT_INVALID: ${message}`);
}

function parseArgs(argv) {
  if (argv.length !== 4 || argv[2] !== '--receipt' || !argv[3]) {
    fail('usage: node scripts/stage-2y-structure-migration-validate.mjs --receipt <path>');
  }
  const allowed = new Set([
    M0_RECEIPT_PATH,
    M1_FINAL_RECEIPT_PATH,
    M2_FINAL_RECEIPT_PATH,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m3-context-compilation.json',
  ]);
  if (!allowed.has(argv[3])) fail('receipt path is not an exact governed receipt path');
  const absolutePath = resolve(REPO_ROOT, argv[3]);
  repositoryFile(argv[3], 'receipt path');
  return absolutePath;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string`);
}

function requireArray(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
}

function repositoryFile(repositoryPath, field) {
  requireString(repositoryPath, field);
  const absolutePath = resolve(REPO_ROOT, repositoryPath);
  const localPath = relative(REPO_ROOT, absolutePath);
  if (!localPath || localPath.startsWith('..')) fail(`${field} is outside the repository`);
  if (!existsSync(absolutePath)) fail(`${field} does not exist: ${repositoryPath}`);
  let cursor = REPO_ROOT;
  for (const component of localPath.split('/')) {
    cursor = resolve(cursor, component);
    if (lstatSync(cursor).isSymbolicLink()) fail(`${field} contains symlink component ${component}`);
  }
  return absolutePath;
}

function repositoryDirectory(repositoryPath, field) {
  const absolutePath = repositoryFile(repositoryPath, field);
  if (!lstatSync(absolutePath).isDirectory()) fail(`${field} is not a directory`);
  return absolutePath;
}

function assertDirectoryInventory(repositoryPath, expectedNames, field) {
  const absolutePath = repositoryDirectory(repositoryPath, field);
  const actualNames = readdirSync(absolutePath, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(`${field} contains non-file or symlink member ${entry.name}`);
    }
    return entry.name;
  }).sort();
  const expected = [...expectedNames].sort();
  if (canonicalJson(actualNames) !== canonicalJson(expected)) {
    fail(`${field} inventory drift`);
  }
}

function assertCanonicalJsonFile(binding, value, field) {
  const absolutePath = repositoryFile(binding.path, `${field}.path`);
  const bytes = readFileSync(absolutePath);
  const expected = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  if (!bytes.equals(expected)) fail(`${field} is not canonical JSON with one LF`);
}

function readBoundJson(binding, field) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail(`${field} must be an object`);
  }
  requireString(binding.path, `${field}.path`);
  requireString(binding.schema_version, `${field}.schema_version`);
  if (!Number.isInteger(binding.byte_length) || binding.byte_length <= 0) {
    fail(`${field}.byte_length must be a positive integer`);
  }
  if (!/^[0-9a-f]{64}$/.test(binding.sha256 || '')) {
    fail(`${field}.sha256 is not sha256`);
  }
  const absolutePath = repositoryFile(binding.path, `${field}.path`);
  const bytes = readFileSync(absolutePath);
  if (bytes.length !== binding.byte_length || sha256Hex(bytes) !== binding.sha256) {
    fail(`${field} does not match its bound repository file`);
  }
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(`${field} is not valid JSON: ${error.message}`);
  }
  if (value?.schema_version !== binding.schema_version) {
    fail(`${field}.schema_version does not match the bound file`);
  }
  return value;
}

function readLooseBoundJson(binding, field) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail(`${field} must be an object`);
  }
  requireString(binding.path, `${field}.path`);
  if (!/^[0-9a-f]{64}$/.test(binding.sha256 || '')) fail(`${field}.sha256 is not sha256`);
  const absolutePath = repositoryFile(binding.path, `${field}.path`);
  const bytes = readFileSync(absolutePath);
  if ((binding.byte_length !== undefined && bytes.length !== binding.byte_length)
    || sha256Hex(bytes) !== binding.sha256) {
    fail(`${field} does not match its bound repository file`);
  }
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(`${field} is not valid JSON: ${error.message}`);
  }
}

function assertExactKeys(value, expected, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail(`${field} key set drift`);
  }
}

function readPinnedJson(binding, pinned, field) {
  if (binding?.path !== pinned.path || binding?.sha256 !== pinned.sha256) {
    fail(`${field} path or pinned digest drift`);
  }
  return readLooseBoundJson(binding, field);
}

function assertM2ZeroEffects(value, field) {
  for (const name of [...ZERO_FIELDS, 'network_calls', 'm0_m1_sealed_artefact_mutations']) {
    if (value[name] !== 0) fail(`${field}.${name} must be zero`);
  }
  for (const selector of [
    'structure_selector', 'context_selector', 'analysis_selector', 'projection_selector',
  ]) {
    if (value[selector] !== 'current') fail(`${field}.${selector} must remain current`);
  }
  if (value.database_target !== 'NONE'
    || value.publication_authorisation !== 'NONE'
    || value.internal_cutover_authorisation !== 'NONE'
    || value.external_access_authorisation !== 'NONE'
    || value.phase_b_status !== 'DEFERRED_LOCKED') {
    fail(`${field} changes a locked authority boundary`);
  }
}

function orderedM1Bindings(value, field) {
  requireArray(value, field);
  const names = Object.keys(M1_OUTPUT_SCHEMAS);
  if (value.length !== names.length) fail(`${field} must contain exactly nine outputs`);
  return value.map((binding, index) => {
    const name = names[index];
    if (binding?.name !== name) fail(`${field}[${index}].name must be ${name}`);
    const expectedPath = `${M1_OUTPUT_ROOT}/${name}`;
    if (binding.path !== expectedPath) fail(`${field}[${index}].path must be ${expectedPath}`);
    if (binding.schema_version !== M1_OUTPUT_SCHEMAS[name]) {
      fail(`${field}[${index}].schema_version drift`);
    }
    readBoundJson(binding, `${field}[${index}]`);
    return {
      name: binding.name,
      path: binding.path,
      schema_version: binding.schema_version,
      byte_length: binding.byte_length,
      sha256: binding.sha256,
    };
  });
}

function unsignedDecisionDigest(decision) {
  const { technical_review: ignored, ...unsigned } = decision;
  return contentId(M1_UNSIGNED_DECISION_DOMAIN, {
    ...unsigned,
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
  });
}

function validatePassedM1(receipt) {
  if (receipt.lifecycle_state !== 'SEALED') fail('PASS M1 lifecycle_state must be SEALED');

  const suppliedChecks = receipt.focused_checks.map((check) => check.check);
  if (suppliedChecks.length !== M1_CHECKS.length
    || new Set(suppliedChecks).size !== M1_CHECKS.length
    || M1_CHECKS.some((name) => !suppliedChecks.includes(name))) {
    fail('PASS M1 focused_checks must contain the exact six approved checks');
  }
  if (receipt.focused_checks.some((check) => check.result !== 'PASS')) {
    fail('PASS M1 focused_checks must all be PASS');
  }

  const m0ReceiptBytes = readFileSync(repositoryFile(M0_RECEIPT_PATH, 'M0 receipt'));
  if (receipt.input_digests.m0_receipt !== sha256Hex(m0ReceiptBytes)) {
    fail('PASS M1 input_digests.m0_receipt does not bind the M0 receipt');
  }

  const outputBindings = orderedM1Bindings(receipt.output_bindings, 'output_bindings');
  const outputSetDigest = contentId(M1_OUTPUT_SET_DOMAIN, outputBindings);
  if (receipt.output_set_digest !== outputSetDigest) {
    fail('PASS M1 output_set_digest does not bind the ordered nine outputs');
  }

  const decisionBinding = outputBindings.find((binding) => binding.name === 'decision.json');
  const decision = readBoundJson(decisionBinding, 'decision output binding');
  const decisionUnsignedDigest = unsignedDecisionDigest(decision);
  if (decision.lifecycle_state !== 'SEALED'
    || decision.proposed_decision !== 'INCREMENTAL_RESTRUCTURE'
    || decision.technical_review?.status !== 'SIGNED_APPROVED'
    || decision.technical_review?.reviewer?.role !== 'SOL'
    || typeof decision.technical_review?.reviewer?.identity !== 'string'
    || decision.technical_review.reviewer.identity.length === 0
    || decision.technical_review?.review_evidence_path !== M1_SOL_REVIEW_PATH
    || decision.technical_review?.unsigned_decision_payload_digest !== decisionUnsignedDigest
    || decision.m2_authorised !== false
    || decision.publication_authorisation !== 'NONE') {
    fail('PASS M1 decision is not the sealed signed incremental-restructure decision');
  }

  const reviewBinding = receipt.technical_review_binding;
  if (reviewBinding?.path !== M1_SOL_REVIEW_PATH
    || reviewBinding?.schema_version !== M1_SOL_REVIEW_SCHEMA) {
    fail('PASS M1 technical_review_binding path or schema drift');
  }
  const review = readBoundJson(reviewBinding, 'technical_review_binding');
  const { review_id: ignoredReviewId, ...reviewPayload } = review;
  if (review.review_id !== contentId(M1_SOL_REVIEW_SCHEMA, reviewPayload)
    || review.lifecycle_state !== 'SEALED'
    || review.stage !== 'M1'
    || review.packet_id !== receipt.packet_id
    || review.base_commit !== receipt.base_commit
    || review.reviewer?.role !== 'SOL'
    || typeof review.reviewer?.identity !== 'string'
    || review.reviewer.identity.length === 0
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'INCREMENTAL_RESTRUCTURE'
    || review.unsigned_decision_payload_digest !== decisionUnsignedDigest
    || canonicalJson(review.reviewer) !== canonicalJson(decision.technical_review.reviewer)
    || !Array.isArray(review.exceptions)
    || review.exceptions.length !== 0) {
    fail('PASS M1 Sol review evidence is not approved');
  }
  const reviewChecks = review.focused_checks || [];
  if (reviewChecks.length !== M1_REVIEW_CHECKS.length
    || reviewChecks.some((check, index) =>
      check?.check !== M1_REVIEW_CHECKS[index] || check.result !== 'PASS')) {
    fail('PASS M1 Sol review evidence does not bind the three approved gates');
  }
  const reviewedBindings = orderedM1Bindings(
    review.output_bindings,
    'technical review output_bindings',
  );
  if (canonicalJson(reviewedBindings) !== canonicalJson(outputBindings)) {
    fail('PASS M1 Sol review evidence does not bind the receipt output set');
  }
  if (review.output_set_digest !== outputSetDigest) {
    fail('PASS M1 Sol review evidence output_set_digest drift');
  }
}

function validatePassedM2HistoricalSeal(receipt) {
  if (receipt.lifecycle_state !== 'SEALED'
    || receipt.packet_id !== M2_PACKET_ID
    || receipt.base_commit !== M2_BASE_COMMIT
    || receipt.agreement_count !== 7
    || receipt.source_reference_count !== 130
    || receipt.output_root !== M2_OUTPUT_ROOT) {
    fail('PASS M2 identity, lifecycle or cohort drift');
  }
  assertM2ZeroEffects(receipt, 'PASS M2 receipt');
  const suppliedChecks = receipt.focused_checks || [];
  if (canonicalJson(suppliedChecks) !== canonicalJson(
    M2_FINAL_CHECKS.map((check) => ({ check, result: 'PASS' })),
  )) fail('PASS M2 focused_checks must contain the exact approved check set');

  const draftBinding = receipt.draft_receipt_binding;
  if (draftBinding?.path !== M2_DRAFT_PATH
    || draftBinding?.schema_version !== M2_DRAFT_SCHEMA) {
    fail('PASS M2 draft receipt binding path or schema drift');
  }
  const draft = readBoundJson(draftBinding, 'PASS M2 draft receipt binding');
  if (draft.stage !== 'M2'
    || draft.lifecycle_state !== 'REVIEW_PENDING_DRAFT'
    || draft.status !== 'STOPPED'
    || draft.technical_review !== 'PENDING_SOL_REVIEW'
    || draft.base_commit !== M2_BASE_COMMIT
    || draft.agreement_count !== 7
    || draft.source_reference_count !== 130) {
    fail('PASS M2 draft receipt is not the sealed stopped draft');
  }
  assertM2ZeroEffects(draft, 'PASS M2 draft receipt');

  for (const field of [
    'authority_binding',
    'structural_policy_binding',
    'agreement_manifest_binding',
    'sealed_predecessor_bindings',
    'current_state_bindings',
    'runtime_measurements',
    'inline_parser_metrics',
  ]) {
    if (canonicalJson(receipt[field]) !== canonicalJson(draft[field])) {
      fail(`PASS M2 ${field} drifted from the draft`);
    }
  }

  const predecessorKeys = Object.keys(M2_BINDINGS.sealed_predecessors);
  const currentStateKeys = Object.keys(M2_BINDINGS.current_state);
  assertExactKeys(receipt.sealed_predecessor_bindings, predecessorKeys,
    'PASS M2 sealed_predecessor_bindings');
  assertExactKeys(receipt.current_state_bindings, currentStateKeys,
    'PASS M2 current_state_bindings');
  assertExactKeys(receipt.implementation_bindings, Object.keys(M2_IMPLEMENTATION_PATHS),
    'PASS M2 implementation_bindings');
  assertExactKeys(draft.implementation_bindings, M2_DRAFT_IMPLEMENTATION_KEYS,
    'PASS M2 draft implementation_bindings');

  const authority = readPinnedJson(receipt.authority_binding, M2_BINDINGS.authority,
    'PASS M2 authority');
  const policy = readPinnedJson(receipt.structural_policy_binding, M2_BINDINGS.structural_policy,
    'PASS M2 structural policy');
  const cohort = readPinnedJson(receipt.agreement_manifest_binding,
    M2_BINDINGS.agreement_manifest, 'PASS M2 agreement manifest');
  const predecessorValues = {};
  for (const name of predecessorKeys) {
    predecessorValues[name] = readPinnedJson(
      receipt.sealed_predecessor_bindings[name],
      M2_BINDINGS.sealed_predecessors[name],
      `PASS M2 ${name}`,
    );
  }
  const currentStateValues = {};
  for (const name of currentStateKeys) {
    currentStateValues[name] = readPinnedJson(
      receipt.current_state_bindings[name],
      M2_BINDINGS.current_state[name],
      `PASS M2 ${name}`,
    );
  }

  try {
    assertM0AndM1(predecessorValues.m0_control_manifest);
    assertM2Authority(authority);
    assertStructuralPolicy(policy);
    assertAgreementManifest(cohort);
    validate(predecessorValues.m1_receipt);
    validateManifest(currentStateValues.baseline_manifest, { verifyFiles: false });
    validateBaseline(currentStateValues.current_baseline, currentStateValues.baseline_manifest);
    validateReport(
      currentStateValues.current_measurement,
      currentStateValues.baseline_manifest,
      currentStateValues.current_baseline,
      currentStateValues.current_measurement.current,
    );
  } catch (error) {
    fail(`PASS M2 carried control validation failed: ${error.message}`);
  }
  if (canonicalJson(authority.bindings) !== canonicalJson(receipt.sealed_predecessor_bindings)) {
    fail('PASS M2 authority does not bind the sealed predecessor set');
  }
  const control = predecessorValues.m0_control_manifest;
  const expectedCurrentState = {
    baseline_manifest: control.baseline_manifest,
    current_baseline: control.current_baseline_binding,
    current_measurement: control.current_measurement_binding,
    current_rendered_rows: control.current_projection_binding,
  };
  if (canonicalJson(expectedCurrentState) !== canonicalJson(receipt.current_state_bindings)) {
    fail('PASS M2 current-state bindings do not match the M0 control');
  }
  const controlledCohort = control.control_bindings?.['cohort-agreements.json'];
  if (receipt.agreement_manifest_binding.path !== controlledCohort?.path
    || receipt.agreement_manifest_binding.sha256 !== controlledCohort?.sha256
    || receipt.agreement_manifest_binding.byte_length !== controlledCohort?.byte_length
    || receipt.agreement_manifest_binding.source_manifest_id
      !== currentStateValues.baseline_manifest.manifest_id
    || cohort.source_manifest_id !== currentStateValues.baseline_manifest.manifest_id) {
    fail('PASS M2 cohort, M0 control and baseline manifest do not cross-bind');
  }
  if (receipt.authority_binding.authorised_stage !== 'M2'
    || receipt.authority_binding.instruction_date !== '2026-08-11'
    || receipt.structural_policy_binding.policy_version !== policy.policy_version
    || receipt.structural_policy_binding.policy_digest !== policy.policy_digest) {
    fail('PASS M2 authority or policy binding metadata drift');
  }

  const totals = currentStateValues.current_measurement.current?.totals;
  const fixed = control.fixed_measurements;
  if (currentStateValues.current_measurement.current?.run_count !== 130
    || totals?.attempted !== fixed.attempted
    || totals?.resolved !== fixed.resolved
    || totals?.open_world !== fixed.open_world
    || totals?.review !== fixed.review
    || totals?.rendering_funnel?.route_available !== fixed.route_available
    || totals?.rendering_funnel?.row_emitted !== fixed.mechanical_successes
    || totals?.render_failures?.CLAIM_FEATURE_ROW_NOT_UNIQUE
      !== fixed.grouped_feature_fail_closed
    || totals?.render_failures?.CLAIM_RENDERED_NO_ROW !== fixed.routed_no_row
    || totals?.render_failures?.FAMILY_NOT_RENDERABLE !== fixed.no_approved_output_owner) {
    fail('PASS M2 frozen extraction measurements drift');
  }
  const renderedRows = currentStateValues.current_rendered_rows;
  if (renderedRows.schema_version !== 'STAGE_2Y_N_RENDERED_ROWS/V1'
    || renderedRows.authority !== 'REPORT_ONLY'
    || renderedRows.publication_authorisation !== 'NONE'
    || renderedRows.run_count !== 130) {
    fail('PASS M2 rendered-row authority drift');
  }

  const expectedPaths = cohort.agreements.map((agreement) =>
    `${M2_OUTPUT_ROOT}/${agreement.agreement_id}.agreement-index.json`);
  requireArray(receipt.output_bindings, 'PASS M2 output_bindings');
  if (receipt.output_bindings.length !== expectedPaths.length) {
    fail('PASS M2 output_bindings must contain seven indexes');
  }
  let sourceReferenceCount = 0;
  const inlineParserMetricEntries = [];
  const normalisedBindings = receipt.output_bindings.map((binding, index) => {
    if (binding.path !== expectedPaths[index]) fail(`PASS M2 output path ${index} drift`);
    const agreementIndex = readLooseBoundJson(binding, `PASS M2 output_bindings[${index}]`);
    const agreement = cohort.agreements[index];
    let exactSource;
    try {
      exactSource = exactSourceForAgreement({ agreement, agreementManifest: cohort, control });
      sourceReferenceCount += exactSource.source_bindings.source_references.length;
      assertAgreementIndex(agreementIndex, exactSource, policy);
      const rebuiltIndex = indexAgreement(exactSource, policy);
      if (canonicalJson(rebuiltIndex) !== canonicalJson(agreementIndex)) {
        fail(`PASS M2 agreement index ${index} is not reproducible from exact source`);
      }
      inlineParserMetricEntries.push({ agreement, index: agreementIndex });
    } catch (error) {
      fail(`PASS M2 agreement index ${index} source or identity drift: ${error.message}`);
    }
    return {
      path: binding.path,
      byte_length: binding.byte_length,
      sha256: binding.sha256,
    };
  });
  if (sourceReferenceCount !== 130) fail('PASS M2 exact-source reference count drift');
  const inlineParserMetrics = buildInlineParserMetrics(inlineParserMetricEntries);
  if (canonicalJson(receipt.inline_parser_metrics) !== canonicalJson(inlineParserMetrics)
    || canonicalJson(draft.inline_parser_metrics) !== canonicalJson(inlineParserMetrics)) {
    fail('PASS M2 inline parser metrics drift');
  }
  const outputSetDigest = sha256Hex(Buffer.from(canonicalJson(normalisedBindings), 'utf8'));
  if (receipt.output_set_digest !== outputSetDigest
    || draft.output_set_digest !== outputSetDigest
    || canonicalJson(draft.output_bindings) !== canonicalJson(normalisedBindings)
    || receipt.new_shadow_result_digest !== outputSetDigest) {
    fail('PASS M2 output set or shadow digest drift');
  }

  const reviewBinding = receipt.technical_review_binding;
  if (reviewBinding?.path !== M2_REVIEW_PATH
    || reviewBinding?.schema_version !== M2_REVIEW_SCHEMA) {
    fail('PASS M2 technical review path or schema drift');
  }
  const review = readBoundJson(reviewBinding, 'PASS M2 technical review binding');
  const { review_id: ignored, ...reviewPayload } = review;
  if (review.review_id !== contentId(M2_REVIEW_SCHEMA, reviewPayload)
    || review.stage !== 'M2'
    || review.packet_id !== M2_PACKET_ID
    || review.base_commit !== M2_BASE_COMMIT
    || review.lifecycle_state !== 'SEALED'
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'AGREEMENT_INDEX_M2_ACCEPTED'
    || review.reviewer?.role !== 'SOL'
    || typeof review.reviewer?.identity !== 'string'
    || review.reviewer.identity.length === 0
    || canonicalJson(review.draft_receipt_binding) !== canonicalJson(draftBinding)
    || review.output_set_digest !== outputSetDigest
    || canonicalJson(review.output_bindings) !== canonicalJson(normalisedBindings)
    || canonicalJson(review.inline_parser_metrics) !== canonicalJson(inlineParserMetrics)
    || canonicalJson(review.focused_checks) !== canonicalJson(
      M2_REVIEW_CHECKS.map((check) => ({ check, result: 'PASS' })),
    )
    || !Array.isArray(review.exceptions)
    || review.exceptions.length !== 0) {
    fail('PASS M2 Sol review is missing, stale or qualified');
  }
  assertExactKeys(review.implementation_bindings, Object.keys(M2_IMPLEMENTATION_PATHS),
    'PASS M2 review implementation_bindings');

  for (const [name, expectedPath] of Object.entries(M2_IMPLEMENTATION_PATHS)) {
    const binding = receipt.implementation_bindings?.[name];
    if (binding?.path !== expectedPath) fail(`PASS M2 implementation path drift: ${name}`);
    const absolutePath = repositoryFile(expectedPath, `PASS M2 implementation ${name}`);
    const bytes = readFileSync(absolutePath);
    if (binding.byte_length !== bytes.length || binding.sha256 !== sha256Hex(bytes)) {
      fail(`PASS M2 implementation digest drift: ${name}`);
    }
    const reviewed = review.implementation_bindings?.[name];
    if (canonicalJson(reviewed) !== canonicalJson(binding)) {
      fail(`PASS M2 review implementation binding drift: ${name}`);
    }
    if (draft.implementation_bindings?.[name]
      && canonicalJson(draft.implementation_bindings[name]) !== canonicalJson(binding)) {
      fail(`PASS M2 draft implementation binding drift: ${name}`);
    }
  }

  const expectedInputDigests = {
    control_manifest: M2_BINDINGS.sealed_predecessors.m0_control_manifest.sha256,
    m0_receipt: M2_BINDINGS.sealed_predecessors.m0_receipt.sha256,
    m1_receipt: M2_BINDINGS.sealed_predecessors.m1_receipt.sha256,
    m2_authority: M2_BINDINGS.authority.sha256,
    structural_policy: M2_BINDINGS.structural_policy.sha256,
    agreement_manifest: M2_BINDINGS.agreement_manifest.sha256,
    draft_receipt: draftBinding.sha256,
    technical_review: reviewBinding.sha256,
  };
  if (canonicalJson(receipt.input_digests) !== canonicalJson(expectedInputDigests)) {
    fail('PASS M2 input_digests do not exactly bind the finaliser inputs');
  }
  const expectedChangedFiles = [
    M2_BINDINGS.authority.path,
    M2_BINDINGS.structural_policy.path,
    M2_IMPLEMENTATION_PATHS.agreement_index_module,
    M2_IMPLEMENTATION_PATHS.private_inline_structure_module,
    M2_IMPLEMENTATION_PATHS.private_inline_structure_test,
    M2_IMPLEMENTATION_PATHS.shadow_runner,
    M2_IMPLEMENTATION_PATHS.finaliser,
    M2_IMPLEMENTATION_PATHS.validator,
    M2_IMPLEMENTATION_PATHS.focused_test,
    ...expectedPaths,
    M2_DRAFT_PATH,
    M2_REVIEW_PATH,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index.json',
  ];
  if (canonicalJson(receipt.changed_files) !== canonicalJson(expectedChangedFiles)
    || canonicalJson(receipt.expected_differences) !== canonicalJson([])
    || canonicalJson(receipt.unexpected_differences) !== canonicalJson([])
    || receipt.rollback_result !== 'NOT_RUN_ADDITIVE_SHADOW_ONLY'
    || receipt.rollback_command !== 'git revert --no-edit <M2_COMMIT_SHA>') {
    fail('PASS M2 change allow-list, diff or rollback contract drift');
  }
  const runtimeKeys = [
    'elapsed_milliseconds',
    'rss_before_bytes',
    'rss_after_bytes',
    'heap_used_before_bytes',
    'heap_used_after_bytes',
    'process_peak_rss_kibibytes',
  ];
  assertExactKeys(receipt.runtime_measurements, runtimeKeys, 'PASS M2 runtime_measurements');
  if (runtimeKeys.some((name) => !Number.isSafeInteger(receipt.runtime_measurements[name])
    || receipt.runtime_measurements[name] < 0)) {
    fail('PASS M2 runtime measurements must be non-negative integers');
  }

  if (canonicalJson(receipt.open_world_by_family)
      !== canonicalJson(predecessorValues.m1_receipt.open_world_by_family)
    || receipt.old_result_digest !== receipt.current_state_bindings.current_measurement.sha256) {
    fail('PASS M2 changes the frozen semantic measurements');
  }
}

function validatePassedM2(receipt) {
  const receiptPath = repositoryFile(M2_FINAL_RECEIPT_PATH, 'M2 predecessor receipt');
  const receiptBytes = readFileSync(receiptPath);
  if (sha256Hex(receiptBytes) !== M2_FINAL_RECEIPT_SHA256) {
    fail('M2 predecessor receipt digest drift');
  }
  let pinnedReceipt;
  try {
    pinnedReceipt = JSON.parse(receiptBytes.toString('utf8'));
  } catch (error) {
    fail(`M2 predecessor receipt is not valid JSON: ${error.message}`);
  }
  if (canonicalJson(receipt) !== canonicalJson(pinnedReceipt)
    || receipt.schema_version !== RECEIPT_SCHEMA
    || receipt.packet_id !== M2_PACKET_ID
    || receipt.stage !== 'M2'
    || receipt.base_commit !== M2_BASE_COMMIT
    || receipt.lifecycle_state !== 'SEALED'
    || receipt.status !== 'PASS'
    || receipt.agreement_count !== 7
    || receipt.output_root !== M2_OUTPUT_ROOT) {
    fail('M2 predecessor receipt identity or state drift');
  }
  const cohort = readPinnedJson(
    receipt.agreement_manifest_binding,
    M2_BINDINGS.agreement_manifest,
    'M2 predecessor agreement manifest',
  );
  const expectedPaths = cohort.agreements.map((agreement) =>
    `${M2_OUTPUT_ROOT}/${agreement.agreement_id}.agreement-index.json`);
  requireArray(receipt.output_bindings, 'M2 predecessor output_bindings');
  if (receipt.output_bindings.length !== expectedPaths.length) {
    fail('M2 predecessor must bind exactly seven indexes');
  }
  assertDirectoryInventory(
    M2_OUTPUT_ROOT,
    expectedPaths.map((path) => path.split('/').at(-1)),
    'M2 predecessor output root',
  );
  const normalised = receipt.output_bindings.map((binding, index) => {
    assertExactKeys(binding, ['path', 'byte_length', 'sha256'],
      `M2 predecessor output_bindings[${index}]`);
    if (binding.path !== expectedPaths[index]) {
      fail(`M2 predecessor output path ${index} drift`);
    }
    const agreementIndex = readLooseBoundJson(
      binding,
      `M2 predecessor output_bindings[${index}]`,
    );
    if (agreementIndex.schema_version !== M2_INDEX_SCHEMA
      || agreementIndex.source_binding?.agreement_id !== cohort.agreements[index].agreement_id) {
      fail(`M2 predecessor index identity drift at ${index}`);
    }
    return {
      path: binding.path,
      byte_length: binding.byte_length,
      sha256: binding.sha256,
    };
  });
  const outputSetDigest = sha256Hex(Buffer.from(canonicalJson(normalised), 'utf8'));
  if (outputSetDigest !== receipt.output_set_digest
    || receipt.new_shadow_result_digest !== outputSetDigest) {
    fail('M2 predecessor output-set digest drift');
  }
  return Object.freeze({ receipt: pinnedReceipt, cohort });
}

function assertM3Binding(binding, expectedPath, field) {
  if (binding?.path !== expectedPath) fail(`${field}.path drift`);
  return readBoundJson(binding, field);
}

function assertM3Checks(checks, expected, field) {
  const wanted = expected.map((check) => ({ check, result: 'PASS' }));
  if (canonicalJson(checks) !== canonicalJson(wanted)) {
    fail(`${field} check set drift`);
  }
}

function assertM3ZeroEffects(record, field) {
  for (const name of [
    ...ZERO_FIELDS,
    'network_calls',
    'm0_m1_m2_sealed_artefact_mutations',
  ]) {
    if (record[name] !== 0) fail(`${field}.${name} must be zero`);
  }
  for (const name of [
    'structure_selector',
    'context_selector',
    'analysis_selector',
    'projection_selector',
  ]) {
    if (record[name] !== 'current') fail(`${field}.${name} must remain current`);
  }
  if (record.database_target !== 'NONE'
    || record.phase_b_status !== 'DEFERRED_LOCKED'
    || record.publication_authorisation !== 'NONE'
    || record.internal_cutover_authorisation !== 'NONE'
    || record.external_access_authorisation !== 'NONE') {
    fail(`${field} changes a locked M3 authority boundary`);
  }
}

function assertCurrentFileBinding(binding, expectedPath, field) {
  if (binding?.path !== expectedPath) fail(`${field}.path drift`);
  const absolutePath = repositoryFile(expectedPath, `${field}.path`);
  const bytes = readFileSync(absolutePath);
  if (binding.byte_length !== bytes.length || binding.sha256 !== sha256Hex(bytes)) {
    fail(`${field} digest drift`);
  }
}

function currentChangedFiles(baseCommit) {
  let tracked;
  let untracked;
  try {
    tracked = execFileSync('git', ['diff', '--name-only', baseCommit, '--'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (error) {
    fail(`cannot inspect M3 changed-file set: ${error.message}`);
  }
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}

function validatePassedM3(receipt) {
  if (receipt.packet_id !== M3_PACKET_ID
    || receipt.stage !== 'M3'
    || receipt.base_commit !== M3_BASE_COMMIT
    || receipt.lifecycle_state !== 'SEALED'
    || receipt.status !== 'PASS'
    || receipt.agreement_count !== 7
    || receipt.source_reference_count !== 130
    || receipt.output_root !== M3_OUTPUT_ROOT) {
    fail('PASS M3 identity, lifecycle or cohort drift');
  }
  assertM3ZeroEffects(receipt, 'PASS M3 receipt');
  assertM3Checks(receipt.focused_checks, M3_FINAL_CHECKS, 'PASS M3 receipt');

  const authority = readPinnedJson(
    receipt.authority_binding,
    M3_BINDINGS.authority,
    'PASS M3 authority',
  );
  const policy = readPinnedJson(
    receipt.semantic_policy_binding,
    M3_BINDINGS.semantic_policy,
    'PASS M3 semantic policy',
  );
  const cohort = readPinnedJson(
    receipt.agreement_manifest_binding,
    M3_BINDINGS.agreement_manifest,
    'PASS M3 agreement manifest',
  );
  const control = readPinnedJson(
    authority.bindings?.control_manifest,
    M3_BINDINGS.control_manifest,
    'PASS M3 control manifest',
  );
  if (authority.schema_version !== 'STAGE_2Y_M3_AUTHORITY/V1'
    || authority.authority_version !== 2
    || authority.stage !== 'M3'
    || authority.base_commit !== M3_BASE_COMMIT
    || authority.authority_digest !== sha256Hex(Buffer.from(canonicalJson((() => {
      const value = structuredClone(authority);
      delete value.authority_digest;
      return value;
    })()), 'utf8'))
    || authority.post_experiment_sol_gate?.status !== 'PASS'
    || authority.post_experiment_sol_gate?.seven_agreement_runner_authorised_by_this_file
      !== true) {
    fail('PASS M3 authority is not the active sealed seven-agreement authority');
  }
  if (receipt.authority_binding.schema_version !== authority.schema_version
    || receipt.authority_binding.authority_version !== authority.authority_version
    || receipt.authority_binding.authority_digest !== authority.authority_digest) {
    fail('PASS M3 authority binding metadata drift');
  }
  if (policy.schema_version !== 'STAGE_2Y_SEMANTIC_POLICY/V1'
    || policy.policy_version !== 2
    || policy.policy_digest !== sha256Hex(Buffer.from(canonicalJson((() => {
      const value = structuredClone(policy);
      delete value.policy_digest;
      return value;
    })()), 'utf8'))
    || policy.policy_digest !== receipt.semantic_policy_binding.policy_digest) {
    fail('PASS M3 semantic policy identity drift');
  }
  if (receipt.semantic_policy_binding.schema_version !== policy.schema_version
    || receipt.semantic_policy_binding.policy_version !== policy.policy_version) {
    fail('PASS M3 semantic policy binding metadata drift');
  }
  if (receipt.agreement_manifest_binding.schema_version !== cohort.schema_version
    || receipt.agreement_manifest_binding.source_manifest_id !== cohort.source_manifest_id) {
    fail('PASS M3 agreement manifest binding metadata drift');
  }
  if (canonicalJson(authority.permitted_changed_files)
      !== canonicalJson(receipt.changed_files)
    || canonicalJson(receipt.expected_differences) !== canonicalJson([])
    || canonicalJson(receipt.unexpected_differences) !== canonicalJson([])
    || receipt.rollback_result !== authority.rollback?.result
    || receipt.rollback_command !== authority.rollback?.command) {
    fail('PASS M3 changed-file, difference or rollback contract drift');
  }
  const changedFiles = currentChangedFiles(M3_BASE_COMMIT);
  if (canonicalJson(changedFiles)
      !== canonicalJson([...authority.permitted_changed_files].sort())) {
    fail('PASS M3 live changed-file set does not equal the authority allow-list');
  }

  const fullContractBinding = authority.bindings?.full_contract_review;
  if (fullContractBinding?.path !== M3_FULL_CONTRACT_REVIEW_PATH) {
    fail('PASS M3 full-contract review path drift');
  }
  const fullContractReview = readBoundJson(
    fullContractBinding,
    'PASS M3 full-contract review',
  );
  assertExactKeys(receipt, fullContractReview.receipt_contract?.final_fields || [],
    'PASS M3 final receipt');
  if (fullContractReview.status !== 'APPROVED'
    || fullContractReview.verdict !== 'PASS'
    || fullContractReview.review_id !== contentId(
      fullContractReview.schema_version,
      (() => {
        const value = structuredClone(fullContractReview);
        delete value.review_id;
        return value;
      })(),
    )
    || canonicalJson(fullContractReview.receipt_contract?.context_metric_members)
      !== canonicalJson(M3_CONTEXT_METRIC_KEYS)) {
    fail('PASS M3 full-contract review is not approved or has metric drift');
  }

  const predecessorBinding = receipt.sealed_predecessor_bindings?.m2_receipt;
  if (predecessorBinding?.path !== M2_FINAL_RECEIPT_PATH
    || predecessorBinding.sha256 !== M2_FINAL_RECEIPT_SHA256
    || canonicalJson(predecessorBinding) !== canonicalJson(authority.bindings.m2_receipt)) {
    fail('PASS M3 M2 predecessor binding drift');
  }
  const m2Receipt = readBoundJson(predecessorBinding, 'PASS M3 M2 predecessor');
  const predecessor = validatePassedM2(m2Receipt);
  if (canonicalJson(predecessor.cohort) !== canonicalJson(cohort)) {
    fail('PASS M3 cohort differs from the M2 predecessor cohort');
  }
  if (canonicalJson(receipt.current_state_bindings)
      !== canonicalJson(authority.current_state_bindings)
    || canonicalJson(receipt.open_world_by_family)
      !== canonicalJson(m2Receipt.open_world_by_family)
    || receipt.old_result_digest !== m2Receipt.old_result_digest) {
    fail('PASS M3 frozen current state or open-world values drift');
  }
  assertExactKeys(receipt.current_state_bindings,
    Object.keys(M3_BINDINGS.current_state), 'PASS M3 current_state_bindings');
  for (const [name, pinned] of Object.entries(M3_BINDINGS.current_state)) {
    readPinnedJson(receipt.current_state_bindings[name], pinned, `PASS M3 current state ${name}`);
  }
  if (control.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1') {
    fail('PASS M3 control manifest schema drift');
  }

  const draftBinding = receipt.draft_receipt_binding;
  const draft = assertM3Binding(draftBinding, M3_DRAFT_PATH, 'PASS M3 draft receipt');
  if (draft.schema_version !== M3_DRAFT_SCHEMA
    || draft.packet_id !== M3_PACKET_ID
    || draft.stage !== 'M3'
    || draft.base_commit !== M3_BASE_COMMIT
    || draft.lifecycle_state !== 'REVIEW_PENDING_DRAFT'
    || draft.status !== 'STOPPED'
    || draft.technical_review !== 'PENDING_SOL_REVIEW') {
    fail('PASS M3 draft state drift');
  }
  const expectedDraftKeys = fullContractReview.receipt_contract.final_fields
    .filter((field) => !['draft_receipt_binding', 'technical_review_binding'].includes(field))
    .concat('technical_review');
  assertExactKeys(draft, expectedDraftKeys, 'PASS M3 draft receipt');
  const transformedDraftFields = new Set([
    'schema_version',
    'lifecycle_state',
    'status',
    'implementation_bindings',
    'input_digests',
    'focused_checks',
    'technical_review',
  ]);
  for (const field of Object.keys(draft)) {
    if (!transformedDraftFields.has(field)
      && canonicalJson(draft[field]) !== canonicalJson(receipt[field])) {
      fail(`PASS M3 final receipt drifted from draft field ${field}`);
    }
  }
  assertExactKeys(draft.implementation_bindings, M3_DRAFT_IMPLEMENTATION_KEYS,
    'PASS M3 draft implementation_bindings');
  assertM3Checks(draft.focused_checks, [
    'SEVEN_AGREEMENT_SCHEMA_IDENTITY_AND_FOCUS',
    'REFERENCE_DEFINITION_AND_AMBIGUITY_CLOSURE',
    'FROZEN_CURRENT_STATE',
    'NO_PRODUCTION_EFFECTS',
  ], 'PASS M3 draft');
  assertM3ZeroEffects(draft, 'PASS M3 draft');

  assertExactKeys(receipt.implementation_bindings, Object.keys(M3_IMPLEMENTATION_PATHS),
    'PASS M3 implementation_bindings');
  for (const [name, expectedPath] of Object.entries(M3_IMPLEMENTATION_PATHS)) {
    const binding = receipt.implementation_bindings[name];
    assertCurrentFileBinding(binding, expectedPath, `PASS M3 implementation ${name}`);
    if (draft.implementation_bindings[name]
      && canonicalJson(draft.implementation_bindings[name]) !== canonicalJson(binding)) {
      fail(`PASS M3 draft implementation binding drift: ${name}`);
    }
  }

  const reviewBinding = receipt.technical_review_binding;
  const review = assertM3Binding(reviewBinding, M3_REVIEW_PATH, 'PASS M3 Sol review');
  const { review_id: ignoredReviewId, ...reviewPayload } = review;
  if (review.schema_version !== M3_REVIEW_SCHEMA
    || review.review_id !== contentId(M3_REVIEW_SCHEMA, reviewPayload)
    || review.stage !== 'M3'
    || review.packet_id !== M3_PACKET_ID
    || review.base_commit !== M3_BASE_COMMIT
    || review.lifecycle_state !== 'SEALED'
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'CONTEXT_COMPILATION_M3_ACCEPTED'
    || review.reviewer?.role !== 'SOL'
    || typeof review.reviewer?.identity !== 'string'
    || review.reviewer.identity.length === 0
    || canonicalJson(review.draft_receipt_binding) !== canonicalJson(draftBinding)
    || canonicalJson(review.authority_binding) !== canonicalJson(receipt.authority_binding)
    || canonicalJson(review.semantic_policy_binding)
      !== canonicalJson(receipt.semantic_policy_binding)
    || canonicalJson(review.m2_receipt_binding) !== canonicalJson(predecessorBinding)
    || canonicalJson(review.agreement_manifest_binding)
      !== canonicalJson(receipt.agreement_manifest_binding)
    || canonicalJson(review.current_state_bindings)
      !== canonicalJson(receipt.current_state_bindings)
    || canonicalJson(review.implementation_bindings)
      !== canonicalJson(receipt.implementation_bindings)
    || canonicalJson(review.output_bindings) !== canonicalJson(receipt.output_bindings)
    || canonicalJson(review.diagnostics_binding) !== canonicalJson(receipt.diagnostics_binding)
    || review.output_set_digest !== receipt.output_set_digest
    || canonicalJson(review.context_metrics) !== canonicalJson(receipt.context_metrics)
    || canonicalJson(review.exceptions) !== canonicalJson([])) {
    fail('PASS M3 Sol review is stale, qualified or does not bind the final result');
  }
  assertM3Checks(review.focused_checks, M3_REVIEW_CHECKS, 'PASS M3 Sol review');

  const expectedOutputPaths = [
    ...authority.permitted_output.context_compilation_paths,
    authority.permitted_output.diagnostics_path,
  ];
  requireArray(receipt.output_bindings, 'PASS M3 output_bindings');
  if (receipt.output_bindings.length !== 8
    || canonicalJson(receipt.output_bindings.map((binding) => binding.path))
      !== canonicalJson(expectedOutputPaths)) {
    fail('PASS M3 output binding count or order drift');
  }
  assertDirectoryInventory(
    M3_OUTPUT_ROOT,
    expectedOutputPaths.map((path) => path.split('/').at(-1)),
    'PASS M3 output root',
  );
  const compilations = [];
  const metricRows = [];
  for (let index = 0; index < 7; index += 1) {
    const binding = receipt.output_bindings[index];
    assertExactKeys(binding, [
      'path',
      'byte_length',
      'sha256',
      'schema_version',
      'agreement_id',
      'agreement_index_id',
      'context_compilation_id',
    ], `PASS M3 output_bindings[${index}]`);
    const compilation = readBoundJson(binding, `PASS M3 output_bindings[${index}]`);
    assertCanonicalJsonFile(binding, compilation, `PASS M3 output_bindings[${index}]`);
    const inputBinding = policy.input_contract.agreement_indexes[index];
    const indexBinding = m2Receipt.output_bindings[index];
    const agreementIndex = readLooseBoundJson(indexBinding, `PASS M3 input index ${index}`);
    if (binding.schema_version !== M3_CONTEXT_SCHEMA
      || binding.agreement_id !== inputBinding.agreement_id
      || binding.agreement_index_id !== agreementIndex.agreement_index_id
      || binding.context_compilation_id !== compilation.context_compilation_id) {
      fail(`PASS M3 output identity drift at ${index}`);
    }
    let rebuilt;
    try {
      const focusNodeIds = deriveM3FocusNodeIds(agreementIndex, policy);
      rebuilt = compileContext(focusNodeIds, agreementIndex, policy);
    } catch (error) {
      fail(`PASS M3 recompilation failed at ${index}: ${error.message}`);
    }
    if (canonicalJson(rebuilt) !== canonicalJson(compilation)) {
      fail(`PASS M3 output ${index} is not byte-deterministic from its sealed input`);
    }
    compilations.push(compilation);
    metricRows.push(m3CompilationMetrics(
      compilation,
      inputBinding.deal,
      inputBinding.agreement_id,
    ));
  }
  const diagnosticsBinding = receipt.output_bindings[7];
  assertExactKeys(diagnosticsBinding, [
    'path',
    'byte_length',
    'sha256',
    'schema_version',
    'diagnostics_ledger_id',
  ], 'PASS M3 diagnostics output binding');
  const diagnostics = readBoundJson(diagnosticsBinding, 'PASS M3 diagnostics output binding');
  assertCanonicalJsonFile(diagnosticsBinding, diagnostics, 'PASS M3 diagnostics output binding');
  const rebuiltDiagnostics = buildM3DiagnosticsLedger(
    policy.input_contract.agreement_order,
    compilations,
    policy,
  );
  if (canonicalJson(diagnostics) !== canonicalJson(rebuiltDiagnostics)
    || diagnosticsBinding.schema_version !== M3_DIAGNOSTICS_SCHEMA
    || diagnosticsBinding.diagnostics_ledger_id !== diagnostics.diagnostics_ledger_id
    || canonicalJson(receipt.diagnostics_binding) !== canonicalJson(diagnosticsBinding)) {
    fail('PASS M3 diagnostics ledger drift');
  }
  const outputSetDigest = sha256Hex(Buffer.from(canonicalJson(receipt.output_bindings), 'utf8'));
  const metrics = aggregateM3Metrics(metricRows, policy);
  assertExactKeys(receipt.context_metrics, M3_CONTEXT_METRIC_KEYS, 'PASS M3 context_metrics');
  if (receipt.output_set_digest !== outputSetDigest
    || receipt.new_shadow_result_digest !== outputSetDigest
    || draft.output_set_digest !== outputSetDigest
    || canonicalJson(draft.output_bindings) !== canonicalJson(receipt.output_bindings)
    || canonicalJson(receipt.context_metrics) !== canonicalJson(metrics)) {
    fail('PASS M3 output-set digest or context metrics drift');
  }

  const expectedInputDigests = {
    authority: receipt.authority_binding.sha256,
    semantic_policy: receipt.semantic_policy_binding.sha256,
    control_manifest: authority.bindings.control_manifest.sha256,
    agreement_manifest: receipt.agreement_manifest_binding.sha256,
    m2_receipt: predecessorBinding.sha256,
    m2_output_set: m2Receipt.output_set_digest,
    draft_receipt: draftBinding.sha256,
    technical_review: reviewBinding.sha256,
  };
  if (canonicalJson(receipt.input_digests) !== canonicalJson(expectedInputDigests)) {
    fail('PASS M3 input_digests do not exactly bind the finaliser inputs');
  }
}

function validate(receipt) {
  if (receipt.schema_version !== RECEIPT_SCHEMA) fail('schema_version drift');
  requireString(receipt.packet_id, 'packet_id');
  if (!STAGES.has(receipt.stage)) fail('stage must be M0 through M9');
  if (!/^[0-9a-f]{40}$/.test(receipt.base_commit || '')) fail('base_commit must be a full commit SHA');
  if (!receipt.input_digests || typeof receipt.input_digests !== 'object'
    || Array.isArray(receipt.input_digests)
    || Object.keys(receipt.input_digests).length === 0) {
    fail('input_digests must be a non-empty object');
  }
  for (const [name, digest] of Object.entries(receipt.input_digests)) {
    if (!/^[0-9a-f]{64}$/.test(digest || '')) fail(`input_digests.${name} is not sha256`);
  }
  requireArray(receipt.changed_files, 'changed_files');
  if (new Set(receipt.changed_files).size !== receipt.changed_files.length) {
    fail('changed_files contains duplicates');
  }
  requireArray(receipt.focused_checks, 'focused_checks');
  if (receipt.focused_checks.length === 0) fail('focused_checks must not be empty');
  for (const [index, check] of receipt.focused_checks.entries()) {
    requireString(check?.check, `focused_checks[${index}].check`);
    if (!['PASS', 'FAIL', 'NOT_RUN'].includes(check.result)) {
      fail(`focused_checks[${index}].result must be PASS, FAIL or NOT_RUN`);
    }
  }
  if (receipt.status === 'PASS'
    && receipt.focused_checks.some((check) => check.result !== 'PASS')) {
    fail('a PASS receipt cannot contain a non-PASS focused check');
  }
  for (const field of ZERO_FIELDS) {
    if (receipt[field] !== 0) fail(`${field} must be zero`);
  }
  if (receipt.internal_cutover_authorisation !== 'NONE') {
    fail('internal_cutover_authorisation must be NONE');
  }
  if (receipt.publication_authorisation !== 'NONE') {
    fail('publication_authorisation must be NONE');
  }
  if (receipt.stage === 'M9') {
    if (!['NONE', 'THROWAWAY_LOCAL'].includes(receipt.database_target)) {
      fail('M9 database_target must be NONE or THROWAWAY_LOCAL');
    }
  } else if (receipt.database_target !== 'NONE') {
    fail(`${receipt.stage} database_target must be NONE`);
  }
  requireArray(receipt.expected_differences, 'expected_differences');
  requireArray(receipt.unexpected_differences, 'unexpected_differences');
  if (receipt.status === 'PASS' && receipt.unexpected_differences.length !== 0) {
    fail('a PASS receipt cannot contain unexpected differences');
  }
  if (!receipt.open_world_by_family
    || typeof receipt.open_world_by_family !== 'object'
    || Array.isArray(receipt.open_world_by_family)) {
    fail('open_world_by_family must be an object');
  }
  for (const [family, count] of Object.entries(receipt.open_world_by_family)) {
    if (!family || !Number.isInteger(count) || count < 0) {
      fail(`open_world_by_family.${family || '<empty>'} must be a non-negative integer`);
    }
  }
  if (Object.keys(receipt.open_world_by_family).length !== 25) {
    fail('open_world_by_family must contain all 25 frozen families, including zeroes');
  }
  const suppliedFamilies = Object.keys(receipt.open_world_by_family).sort();
  if (suppliedFamilies.join('\n') !== listRegisteredSectionFamilies().join('\n')) {
    fail('open_world_by_family keys do not equal the frozen family registry');
  }
  if (!/^[0-9a-f]{64}$/.test(receipt.old_result_digest || '')) {
    fail('old_result_digest must be sha256');
  }
  if (receipt.stage === 'M0') {
    if (receipt.new_shadow_result_digest !== null) {
      fail('M0 new_shadow_result_digest must be null');
    }
  } else if (!/^[0-9a-f]{64}$/.test(receipt.new_shadow_result_digest || '')) {
    fail('new_shadow_result_digest must be sha256 for M1 through M9');
  }
  requireString(receipt.rollback_command, 'rollback_command');
  requireString(receipt.rollback_result, 'rollback_result');
  if (!['PASS', 'STOPPED', 'ESCALATED'].includes(receipt.status)) {
    fail('status must be PASS, STOPPED or ESCALATED');
  }
  if (receipt.stage === 'M1' && receipt.status === 'PASS') validatePassedM1(receipt);
  if (receipt.stage === 'M2' && receipt.status === 'PASS') validatePassedM2(receipt);
  if (receipt.stage === 'M3' && receipt.status === 'PASS') validatePassedM3(receipt);
  return Object.freeze({
    schema_version: RECEIPT_SCHEMA,
    packet_id: receipt.packet_id,
    stage: receipt.stage,
    status: receipt.status,
    authority_check: 'PASS',
  });
}

function main() {
  const receiptPath = parseArgs(process.argv);
  if (!existsSync(receiptPath)) fail(`missing receipt ${receiptPath}`);
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    fail(`receipt is not valid JSON: ${error.message}`);
  }
  process.stdout.write(`${JSON.stringify(validate(receipt))}\n`);
}

main();
