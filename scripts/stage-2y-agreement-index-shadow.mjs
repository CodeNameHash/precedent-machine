#!/usr/bin/env node

// Builds the additive Stage 2Y M2 agreement indexes from sealed admitted sources.
// It has no network, model, database, selector, pin, baseline, product or publication path.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  rebuildAdmittedSourcePrimitives,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { indexAgreement } = require('../lib/canonical-v2/agreement-index');
const {
  sectionizeAdmittedSource,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED_CONTROL = resolve(MIGRATION_ROOT, 'control/manifest.json');
const EXPECTED_AGREEMENT_MANIFEST = resolve(MIGRATION_ROOT, 'control/cohort-agreements.json');
const EXPECTED_POLICY = resolve(MIGRATION_ROOT, 'control/structural-policy.json');
const EXPECTED_OUTPUT_ROOT = resolve(MIGRATION_ROOT, 'shadow/m2');
const M2_AUTHORITY_PATH = resolve(MIGRATION_ROOT, 'control/m2-authority.json');
const M0_RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m0-control-freeze.json',
);
const M1_DECISION_PATH = resolve(MIGRATION_ROOT, 'prototype/m1/decision.json');
const M1_RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m1-falsification-prototype.json',
);
const M1_SOL_REVIEW_PATH = resolve(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m1-sol-technical-review.json',
);
const M2_DRAFT_RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m2-agreement-index-draft.json',
);
const PRIVATE_INLINE_STRUCTURE_PATH = resolve(
  REPO_ROOT,
  'lib/canonical-v2/agreement-inline-structure.js',
);
const PRIVATE_INLINE_STRUCTURE_TEST_PATH = resolve(
  REPO_ROOT,
  'tests/canonical-v2-agreement-inline-structure.test.js',
);

const INLINE_MARKER_DISPOSITION_SCHEMA = 'AGREEMENT_INLINE_MARKER_DISPOSITION/V1';
const INLINE_MARKER_CANDIDATE_SCHEMA = 'AGREEMENT_INLINE_MARKER_CANDIDATE/V1';
const INLINE_MARKER_PARTITION_SCHEMA = 'AGREEMENT_INLINE_MARKER_PARTITION/V1';
const INLINE_MARKER_SPAN_SET_DOMAIN = 'AGREEMENT_INLINE_MARKER_SPAN_SET/V1';
const INLINE_MARKER_DISPOSITION_SET_DOMAIN =
  'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1';
const INLINE_PARSER_METRICS_SCHEMA = 'STAGE_2Y_STRUCTURE_M2_INLINE_PARSER_METRICS/V1';
const INLINE_MARKER_DISPOSITIONS = new Set([
  'AUTHORED_INLINE_LIST',
  'NON_STRUCTURAL_MARKER',
  'UNRESOLVED_INLINE_LIST',
]);

const SEALED = Object.freeze({
  m0_control_manifest: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json',
    sha256: '62fa3cb1f25a0e180da93bd94516637a119d4e99b6890f0d8321c9ea30b25a41',
  }),
  m0_receipt: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m0-control-freeze.json',
    sha256: 'b2b054ba1b67179873f029b85e8d556dfcb1339659145620a6e499a9a1d3acc6',
  }),
  m1_decision: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/prototype/m1/decision.json',
    sha256: 'd11b4e2878d976d96d11948a4561d572ddc313116faa94593dda7b4784a5e3c3',
  }),
  m1_receipt: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m1-falsification-prototype.json',
    sha256: '75e07e2f0cfcacf6f58a88213c36a5424a4fdd8d662772c4074b57ef0183375e',
  }),
  m1_sol_review: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/reviews/stage-2y-structure-m1-sol-technical-review.json',
    sha256: 'aac25e1b7687bcccb50efe1bbbfa46664e9ffee3d088f6d47126ffecdead2a23',
  }),
  agreement_manifest_sha256: '0dd150d57da4894f30cd94df53c1983395abc98474b716332e71aa40375f2ecc',
  m2_authority_sha256: 'f62bd067a53fa1fb67dcb6859d9586a18a58e01360fa4179b9e485446bf75b20',
  structural_policy_sha256: 'cd4523d0f39bed64b9dce99eb9df571b262478bc2a2adf36bf7f4a9d955ec732',
});

const M0_BASE_COMMIT = '7ba2b9d4612cf95be5d0da4b06a56773e33d2f4e';
const M1_BASE_COMMIT = '7e4b064c2f0f82f28f1ab83dfae90ece74934a8f';
const M2_BASE_COMMIT = '5c61c51b81f8983d3f18c6dcef2086eff29e661c';
const M1_OUTPUT_SET_DIGEST = '49ea7385053d6fb423039f37942b12b4073bb9cebccba27be7f71db6ca2ae365';
const M1_UNSIGNED_DECISION_DIGEST = 'a41491ee7ac80e60b0b3d965d7d95c10e34309e7e887e56a929959d9561d7b50';
const HEX_256 = /^[0-9a-f]{64}$/;
const EXPECTED_ANNEXES = Object.freeze({
  concho: Object.freeze([
    Object.freeze(['ANNEX A', 309662, 349102]),
    Object.freeze(['ANNEX B', 349102, 351804]),
  ]),
  skywater: Object.freeze([
    Object.freeze(['ANNEX A', 317026, 360595]),
  ]),
  topbuild: Object.freeze([
    Object.freeze(['ANNEX A', 406169, 406207]),
    Object.freeze(['ANNEX B', 406207, 406279]),
    Object.freeze(['ANNEX C', 406279, 412860]),
  ]),
});
const EXPECTED_ALIAS_COUNTS = Object.freeze({
  redhat: 307,
  skechers: 539,
  concho: 441,
  topbuild: 408,
  skywater: 429,
  metsera: 282,
  modiv: 472,
});
const ALIAS_BASES = new Set([
  'SAME_AUTHORED_OCCURRENCE',
  'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE',
  'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_CHAPEAU',
  'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_HEADING',
  'SYNTHETIC_ARTICLE_WRAPPER_REPLACED_BY_AUTHORED_ANNEX_HEADING',
  'PSEUDO_SECTION_REPLACED_BY_AUTHORED_ANNEX',
]);

function fail(code, message) {
  throw new Error(`STAGE_2Y_AGREEMENT_INDEX_SHADOW:${code}: ${message}`);
}

function parseArgs(argv) {
  const allowed = new Set([
    '--control',
    '--agreement-manifest',
    '--policy',
    '--output-root',
  ]);
  if (argv.length !== 10) {
    fail(
      'INVALID_ARGUMENTS',
      'requires only --control, --agreement-manifest, --policy and --output-root',
    );
  }
  const values = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || values.has(key)) {
      fail('INVALID_ARGUMENTS', 'each permitted argument must occur exactly once');
    }
    values.set(key, resolve(value));
  }
  const parsed = Object.freeze({
    control: values.get('--control'),
    agreementManifest: values.get('--agreement-manifest'),
    policy: values.get('--policy'),
    outputRoot: values.get('--output-root'),
  });
  if (parsed.control !== EXPECTED_CONTROL
    || parsed.agreementManifest !== EXPECTED_AGREEMENT_MANIFEST
    || parsed.policy !== EXPECTED_POLICY
    || parsed.outputRoot !== EXPECTED_OUTPUT_ROOT) {
    fail('PATH_DRIFT', 'arguments must name the frozen M0 controls and M2 shadow paths');
  }
  return parsed;
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath);
  if (!value || value.startsWith('..')) {
    fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  }
  return value.split('\\').join('/');
}

function absoluteRepositoryPath(repoPath) {
  if (typeof repoPath !== 'string' || !repoPath || repoPath.startsWith('/')) {
    fail('INVALID_REPOSITORY_PATH', String(repoPath));
  }
  const absolute = resolve(REPO_ROOT, repoPath);
  repositoryPath(absolute);
  return absolute;
}

function readJson(absolutePath) {
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repositoryPath(absolutePath));
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail('INVALID_JSON', `${repositoryPath(absolutePath)}: ${error.message}`);
  }
}

function fileDigest(absolutePath) {
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repositoryPath(absolutePath));
  return sha256Hex(readFileSync(absolutePath));
}

function fileBinding(absolutePath) {
  const bytes = readFileSync(absolutePath);
  return Object.freeze({
    path: repositoryPath(absolutePath),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  });
}

function valueDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function assertEqual(actual, expected, code, label) {
  if (actual !== expected) fail(code, `${label}: expected ${expected}, got ${actual}`);
}

function assertExactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail(code, `${label}: key set drift`);
  }
}

function assertIndexSpan(span, sourceBytes, label) {
  if (span?.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
    || !Number.isSafeInteger(span.start_byte)
    || !Number.isSafeInteger(span.end_byte)
    || span.start_byte < 0
    || span.end_byte <= span.start_byte
    || span.end_byte > sourceBytes.length
    || span.text_sha256 !== sha256Hex(sourceBytes.subarray(span.start_byte, span.end_byte))) {
    fail('INVALID_AGREEMENT_INDEX', label);
  }
}

function emptyInlineMetricCounts() {
  return {
    candidate_sequences: 0,
    authored_lists: 0,
    non_structural_markers: 0,
    unresolved_lists: 0,
    authored_limbs: 0,
  };
}

function addDispositionToMetric(counts, disposition) {
  counts.candidate_sequences += 1;
  counts.authored_limbs += disposition.produced_limb_node_occurrence_ids.length;
  if (disposition.disposition === 'AUTHORED_INLINE_LIST') counts.authored_lists += 1;
  if (disposition.disposition === 'NON_STRUCTURAL_MARKER') {
    counts.non_structural_markers += 1;
  }
  if (disposition.disposition === 'UNRESOLVED_INLINE_LIST') counts.unresolved_lists += 1;
}

function inlineLimbDepth(node, nodes) {
  let depth = 0;
  let cursor = node;
  const seen = new Set();
  while (cursor) {
    if (seen.has(cursor.node_occurrence_id)) {
      fail('INVALID_AGREEMENT_INDEX', 'inline parser metric encountered a containment cycle');
    }
    seen.add(cursor.node_occurrence_id);
    if (cursor.roles.includes('AUTHORED_INLINE_LIMB')) depth += 1;
    cursor = cursor.parent_node_occurrence_id === null
      ? null
      : nodes.get(cursor.parent_node_occurrence_id);
  }
  return depth;
}

function buildInlineParserMetrics(entries) {
  if (!Array.isArray(entries)) fail('INVALID_INLINE_PARSER_METRICS', 'entries must be an array');
  const byDeal = entries.map(({ agreement, index }) => {
    const counts = emptyInlineMetricCounts();
    const styleCounts = new Map();
    const nodes = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
    let maximumDepth = 0;
    for (const disposition of index.inline_marker_dispositions) {
      addDispositionToMetric(counts, disposition);
      if (!styleCounts.has(disposition.style)) {
        styleCounts.set(disposition.style, emptyInlineMetricCounts());
      }
      addDispositionToMetric(styleCounts.get(disposition.style), disposition);
      for (const nodeId of disposition.produced_limb_node_occurrence_ids) {
        maximumDepth = Math.max(maximumDepth, inlineLimbDepth(nodes.get(nodeId), nodes));
      }
    }
    return Object.freeze({
      agreement_id: agreement.agreement_id,
      deal: agreement.deal,
      ...counts,
      ambiguities: index.ambiguities.length,
      by_style: Object.freeze([...styleCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([style, styleMetric]) => Object.freeze({ style, ...styleMetric }))),
      maximum_depth: maximumDepth,
    });
  });
  return Object.freeze({
    schema_version: INLINE_PARSER_METRICS_SCHEMA,
    by_deal: Object.freeze(byDeal),
  });
}

function assertSealedFile(absolutePath, sealed, label) {
  assertEqual(repositoryPath(absolutePath), sealed.path, 'SEALED_PATH_DRIFT', label);
  assertEqual(fileDigest(absolutePath), sealed.sha256, 'SEALED_DIGEST_DRIFT', label);
}

function assertBoundFile(binding, label) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.sha256 !== 'string') {
    fail('INVALID_FILE_BINDING', label);
  }
  const absolutePath = absoluteRepositoryPath(binding.path);
  const actual = fileBinding(absolutePath);
  assertEqual(actual.sha256, binding.sha256, 'BOUND_FILE_DIGEST_DRIFT', label);
  if (binding.byte_length !== undefined) {
    assertEqual(actual.byte_length, binding.byte_length, 'BOUND_FILE_LENGTH_DRIFT', label);
  }
  return actual;
}

function assertZeroEffectLocks(record, label, extraZeroFields = []) {
  const zeroFields = [
    'pin_changes',
    'baseline_changes',
    'saved_control_mutations',
    'release_receipts_created',
    'current_selector_changes',
    'model_calls',
    'phase_b_route_calls',
    'product_writes',
    'serving_changes',
    ...extraZeroFields,
  ];
  for (const field of zeroFields) {
    assertEqual(record?.[field], 0, 'AUTHORITY_LOCK_DRIFT', `${label}.${field}`);
  }
  for (const selector of [
    'structure_selector',
    'context_selector',
    'analysis_selector',
    'projection_selector',
  ]) {
    assertEqual(record?.[selector], 'current', 'SELECTOR_LOCK_DRIFT', `${label}.${selector}`);
  }
  assertEqual(record?.database_target, 'NONE', 'DATABASE_LOCK_DRIFT', label);
  assertEqual(
    record?.publication_authorisation,
    'NONE',
    'PUBLICATION_LOCK_DRIFT',
    label,
  );
  assertEqual(
    record?.internal_cutover_authorisation,
    'NONE',
    'CUTOVER_LOCK_DRIFT',
    label,
  );
}

function assertReceiptZeroEffects(receipt, label) {
  for (const field of [
    'pin_changes',
    'baseline_changes',
    'saved_control_mutations',
    'release_receipts_created',
    'current_selector_changes',
    'model_calls',
    'phase_b_route_calls',
    'product_writes',
    'serving_changes',
  ]) {
    assertEqual(receipt?.[field], 0, 'SEALED_RECEIPT_DRIFT', `${label}.${field}`);
  }
  assertEqual(receipt?.database_target, 'NONE', 'SEALED_RECEIPT_DRIFT', label);
  assertEqual(receipt?.publication_authorisation, 'NONE', 'SEALED_RECEIPT_DRIFT', label);
  assertEqual(receipt?.internal_cutover_authorisation, 'NONE', 'SEALED_RECEIPT_DRIFT', label);
}

function assertM0AndM1(control) {
  assertSealedFile(EXPECTED_CONTROL, SEALED.m0_control_manifest, 'M0 control');
  assertSealedFile(M0_RECEIPT_PATH, SEALED.m0_receipt, 'M0 receipt');
  assertSealedFile(M1_DECISION_PATH, SEALED.m1_decision, 'M1 decision');
  assertSealedFile(M1_RECEIPT_PATH, SEALED.m1_receipt, 'M1 receipt');
  assertSealedFile(M1_SOL_REVIEW_PATH, SEALED.m1_sol_review, 'M1 Sol review');

  assertEqual(
    control.schema_version,
    'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1',
    'M0_CONTROL_DRIFT',
    'schema_version',
  );
  assertEqual(control.source_commit, M0_BASE_COMMIT, 'M0_CONTROL_DRIFT', 'source_commit');
  if (canonicalJson(control.authority?.authorised_stages) !== canonicalJson(['M0', 'M1'])) {
    fail('M0_AUTHORITY_DRIFT', 'authorised_stages must remain exactly M0 and M1');
  }
  assertZeroEffectLocks(control.authority, 'M0 authority');
  assertEqual(control.authority?.phase_b_status, 'DEFERRED_LOCKED', 'M0_AUTHORITY_DRIFT', 'Phase B');

  const cohortBinding = control.control_bindings?.['cohort-agreements.json'];
  assertEqual(
    cohortBinding?.path,
    repositoryPath(EXPECTED_AGREEMENT_MANIFEST),
    'M0_COHORT_BINDING_DRIFT',
    'cohort path',
  );
  assertEqual(
    cohortBinding?.sha256,
    SEALED.agreement_manifest_sha256,
    'M0_COHORT_BINDING_DRIFT',
    'cohort digest',
  );
  assertBoundFile(cohortBinding, 'M0 cohort agreement manifest');
  for (const name of [
    'baseline_manifest',
    'current_baseline_binding',
    'current_measurement_binding',
    'current_projection_binding',
  ]) {
    assertBoundFile(control[name], `M0 ${name}`);
  }

  const m0Receipt = readJson(M0_RECEIPT_PATH);
  assertEqual(
    m0Receipt.schema_version,
    'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    'M0_RECEIPT_DRIFT',
    'schema_version',
  );
  assertEqual(m0Receipt.stage, 'M0', 'M0_RECEIPT_DRIFT', 'stage');
  assertEqual(m0Receipt.status, 'PASS', 'M0_RECEIPT_DRIFT', 'status');
  assertEqual(m0Receipt.base_commit, M0_BASE_COMMIT, 'M0_RECEIPT_DRIFT', 'base_commit');
  assertEqual(
    m0Receipt.input_digests?.control_manifest,
    SEALED.m0_control_manifest.sha256,
    'M0_RECEIPT_DRIFT',
    'control binding',
  );
  assertReceiptZeroEffects(m0Receipt, 'M0 receipt');

  const receipt = readJson(M1_RECEIPT_PATH);
  const decision = readJson(M1_DECISION_PATH);
  const review = readJson(M1_SOL_REVIEW_PATH);
  assertEqual(
    receipt.schema_version,
    'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    'M1_RECEIPT_DRIFT',
    'schema_version',
  );
  assertEqual(receipt.stage, 'M1', 'M1_RECEIPT_DRIFT', 'stage');
  assertEqual(receipt.status, 'PASS', 'M1_RECEIPT_DRIFT', 'status');
  assertEqual(receipt.lifecycle_state, 'SEALED', 'M1_RECEIPT_DRIFT', 'lifecycle');
  assertEqual(receipt.base_commit, M1_BASE_COMMIT, 'M1_RECEIPT_DRIFT', 'base_commit');
  assertEqual(
    receipt.input_digests?.control_manifest,
    SEALED.m0_control_manifest.sha256,
    'M1_RECEIPT_DRIFT',
    'control digest',
  );
  assertEqual(
    receipt.input_digests?.m0_receipt,
    SEALED.m0_receipt.sha256,
    'M1_RECEIPT_DRIFT',
    'M0 receipt digest',
  );
  assertEqual(
    receipt.output_set_digest,
    M1_OUTPUT_SET_DIGEST,
    'M1_RECEIPT_DRIFT',
    'output set digest',
  );
  assertReceiptZeroEffects(receipt, 'M1 receipt');
  const decisionBinding = receipt.output_bindings?.find((entry) => entry.name === 'decision.json');
  assertEqual(
    decisionBinding?.path,
    SEALED.m1_decision.path,
    'M1_RECEIPT_DRIFT',
    'decision path',
  );
  assertEqual(
    decisionBinding?.sha256,
    SEALED.m1_decision.sha256,
    'M1_RECEIPT_DRIFT',
    'decision digest',
  );
  assertEqual(
    receipt.technical_review_binding?.path,
    SEALED.m1_sol_review.path,
    'M1_RECEIPT_DRIFT',
    'Sol review path',
  );
  assertEqual(
    receipt.technical_review_binding?.sha256,
    SEALED.m1_sol_review.sha256,
    'M1_RECEIPT_DRIFT',
    'Sol review digest',
  );

  assertEqual(
    decision.schema_version,
    'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1',
    'M1_DECISION_DRIFT',
    'schema_version',
  );
  assertEqual(decision.stage, 'M1', 'M1_DECISION_DRIFT', 'stage');
  assertEqual(decision.lifecycle_state, 'SEALED', 'M1_DECISION_DRIFT', 'lifecycle');
  assertEqual(decision.base_commit, M1_BASE_COMMIT, 'M1_DECISION_DRIFT', 'base_commit');
  assertEqual(
    decision.proposed_decision,
    'INCREMENTAL_RESTRUCTURE',
    'M1_DECISION_DRIFT',
    'technical decision',
  );
  assertEqual(
    decision.technical_review?.status,
    'SIGNED_APPROVED',
    'M1_DECISION_DRIFT',
    'technical review status',
  );
  assertEqual(
    decision.technical_review?.reviewer?.role,
    'SOL',
    'M1_DECISION_DRIFT',
    'technical reviewer role',
  );
  assertEqual(
    decision.technical_review?.review_evidence_path,
    SEALED.m1_sol_review.path,
    'M1_DECISION_DRIFT',
    'review evidence path',
  );
  assertEqual(
    decision.technical_review?.unsigned_decision_payload_digest,
    M1_UNSIGNED_DECISION_DIGEST,
    'M1_DECISION_DRIFT',
    'unsigned decision digest',
  );
  assertEqual(decision.m2_authorised, false, 'M1_DECISION_DRIFT', 'sealed M1 authority');
  assertEqual(
    decision.publication_authorisation,
    'NONE',
    'M1_DECISION_DRIFT',
    'publication authority',
  );

  assertEqual(
    review.schema_version,
    'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1',
    'M1_REVIEW_DRIFT',
    'schema_version',
  );
  assertEqual(review.stage, 'M1', 'M1_REVIEW_DRIFT', 'stage');
  assertEqual(review.lifecycle_state, 'SEALED', 'M1_REVIEW_DRIFT', 'lifecycle');
  assertEqual(review.status, 'APPROVED', 'M1_REVIEW_DRIFT', 'status');
  assertEqual(review.verdict, 'APPROVED', 'M1_REVIEW_DRIFT', 'verdict');
  assertEqual(
    review.technical_decision,
    'INCREMENTAL_RESTRUCTURE',
    'M1_REVIEW_DRIFT',
    'technical decision',
  );
  assertEqual(review.reviewer?.role, 'SOL', 'M1_REVIEW_DRIFT', 'reviewer role');
  assertEqual(
    review.output_set_digest,
    M1_OUTPUT_SET_DIGEST,
    'M1_REVIEW_DRIFT',
    'output set digest',
  );
  assertEqual(
    review.unsigned_decision_payload_digest,
    M1_UNSIGNED_DECISION_DIGEST,
    'M1_REVIEW_DRIFT',
    'unsigned decision digest',
  );
  if (!Array.isArray(review.exceptions) || review.exceptions.length !== 0) {
    fail('M1_REVIEW_DRIFT', 'Sol review exceptions must remain empty');
  }
}

function assertM2Authority(authority) {
  assertEqual(
    fileDigest(M2_AUTHORITY_PATH),
    SEALED.m2_authority_sha256,
    'M2_AUTHORITY_DIGEST_DRIFT',
    'M2 authority',
  );
  assertEqual(
    authority.schema_version,
    'STAGE_2Y_STRUCTURE_M2_AUTHORITY/V1',
    'M2_AUTHORITY_DRIFT',
    'schema_version',
  );
  assertEqual(authority.authorised_stage, 'M2', 'M2_AUTHORITY_DRIFT', 'authorised stage');
  assertEqual(authority.base_commit, M2_BASE_COMMIT, 'M2_AUTHORITY_DRIFT', 'base commit');
  assertEqual(
    authority.authorising_instruction?.date,
    '2026-08-11',
    'M2_AUTHORITY_DRIFT',
    'instruction date',
  );
  assertEqual(
    authority.authorising_instruction?.scope,
    'ADDITIVE_SHADOW_AGREEMENT_INDEX_ONLY',
    'M2_AUTHORITY_DRIFT',
    'instruction scope',
  );
  if (!Array.isArray(authority.later_migration_stages_authorised)
    || authority.later_migration_stages_authorised.length !== 0) {
    fail('M2_AUTHORITY_DRIFT', 'M3 and later stages must remain unauthorised');
  }
  assertZeroEffectLocks(
    authority,
    'M2 authority',
    ['network_calls', 'm0_m1_sealed_artefact_mutations'],
  );
  assertEqual(authority.phase_b_status, 'DEFERRED_LOCKED', 'M2_AUTHORITY_DRIFT', 'Phase B');
  assertEqual(
    authority.external_access_authorisation,
    'NONE',
    'M2_AUTHORITY_DRIFT',
    'external access',
  );
  for (const [name, sealed] of Object.entries({
    m0_control_manifest: SEALED.m0_control_manifest,
    m0_receipt: SEALED.m0_receipt,
    m1_decision: SEALED.m1_decision,
    m1_receipt: SEALED.m1_receipt,
    m1_sol_review: SEALED.m1_sol_review,
  })) {
    const binding = authority.bindings?.[name];
    assertEqual(binding?.path, sealed.path, 'M2_AUTHORITY_BINDING_DRIFT', `${name} path`);
    assertEqual(binding?.sha256, sealed.sha256, 'M2_AUTHORITY_BINDING_DRIFT', `${name} digest`);
  }
}

function assertStructuralPolicy(policy) {
  assertEqual(
    fileDigest(EXPECTED_POLICY),
    SEALED.structural_policy_sha256,
    'STRUCTURAL_POLICY_DIGEST_DRIFT',
    'structural policy',
  );
  assertEqual(
    policy.schema_version,
    'STAGE_2Y_STRUCTURAL_POLICY/V1',
    'STRUCTURAL_POLICY_DRIFT',
    'schema_version',
  );
  assertEqual(
    policy.coordinate_system,
    'UTF8_CANONICAL_TEXT_HALF_OPEN',
    'STRUCTURAL_POLICY_DRIFT',
    'coordinate system',
  );
  const expectedCollections = Object.freeze({
    authored_node_kinds: [
      'AGREEMENT', 'ARTICLE', 'ANNEX', 'SECTION', 'LIMB', 'HEADING', 'CHAPEAU',
      'PARAGRAPH', 'SENTENCE', 'QUALIFICATION',
    ],
    annotation_kinds: [
      'OUTLINE_MARKER', 'SECTION_REFERENCE', 'DEFINED_TERM_DEFINITION', 'DEFINED_TERM_USE',
    ],
    source_artefact_kinds: ['PAGE_NUMBER', 'FORM_FEED', 'CONVERSION_CONTROL'],
    byte_coverage_owner_kinds: ['AUTHORED_NODE', 'SOURCE_ARTEFACT'],
    diagnostic_types: [
      'SECTIONIZER_REJECTED_INLINE_HEADING',
      'SECTIONIZER_SWALLOWED_HEADING',
      'DUPLICATE_MARKER_SEQUENCE_REPAIRED',
      'REVIEWED_STRUCTURE_OVERRIDE_APPLIED',
      'UNREPRESENTED_OUTLINE_MARKER',
      'SOURCE_ARTEFACT_INTERRUPTS_AUTHORED_BLOCK',
      'PARENT_REPAIRED',
      'NODE_COLLISION_DROPPED',
    ],
  });
  for (const [field, expected] of Object.entries(expectedCollections)) {
    if (canonicalJson(policy[field]) !== canonicalJson(expected)) {
      fail('STRUCTURAL_POLICY_DRIFT', `${field} is not the frozen typed collection`);
    }
  }
  const expectedInlinePolicy = {
    schema_version: 'STAGE_2Y_INLINE_LIST_POLICY/V1',
    parser_version: 'AGREEMENT_INLINE_STRUCTURE_PARSER/V1',
    maximum_depth: 5,
    dispositions: [
      'AUTHORED_INLINE_LIST',
      'NON_STRUCTURAL_MARKER',
      'UNRESOLVED_INLINE_LIST',
    ],
    styles: [
      'UNCLASSIFIED',
      'alphaLower',
      'alphaUpper',
      'digit',
      'romanLower',
      'romanUpper',
      'xyz',
    ],
    authored_reasons: ['CORROBORATED_SUBSTANTIVE_SEQUENCE'],
    non_structural_reasons: [
      'AMBIGUOUS_MARKER_STYLE',
      'BARE_CLAUSE_REFERENCE',
      'GLUED_SECTION_REFERENCE',
      'TABLE_OF_CONTENTS_REFERENCE',
      'UNCORROBORATED_FIRST_MARKER',
    ],
    unresolved_reasons: [
      'AMBIGUOUS_SAME_STYLE_RESTART',
      'CROSSING_LIST_BOUNDARY',
      'DEPTH_LIMIT',
      'INSUFFICIENT_ITEM_PAYLOAD',
      'OUT_OF_ORDER_MARKER_SEQUENCE',
      'SOURCE_ARTEFACT_BOUNDARY_AMBIGUOUS',
    ],
  };
  if (canonicalJson(policy.inline_list_policy) !== canonicalJson(expectedInlinePolicy)) {
    fail('STRUCTURAL_POLICY_DRIFT', 'inline-list policy is not the frozen contract');
  }
  assertEqual(policy.policy_version, 2, 'STRUCTURAL_POLICY_DRIFT', 'policy version');
  const unsignedPolicy = { ...policy };
  delete unsignedPolicy.policy_digest;
  assertEqual(
    policy.policy_digest,
    valueDigest(unsignedPolicy),
    'STRUCTURAL_POLICY_DRIFT',
    'policy digest',
  );
  const redHat = policy.reviewed_structure_overrides?.find(
    (entry) => entry.override_id === 'REDHAT_3_01_H_I_PARENTAGE/V1',
  );
  if (!redHat
    || redHat.operation !== 'SPLIT_AND_REPARENT_DUPLICATE_LIMB'
    || redHat.canonical_text_sha256
      !== 'dcdbf66142d25cbe56ed2bc1fbd26939aaf86056bf34188176c48b5944d31c5e'
    || redHat.section_reference !== '3.01'
    || redHat.parent_marker_start_byte !== 55619
    || redHat.nested_marker_start_byte !== 55634
    || redHat.sibling_marker_start_byte !== 62303
    || redHat.next_sibling_start_byte !== 64040
    || redHat.required !== true) {
    fail('STRUCTURAL_POLICY_DRIFT', 'confirmed Red Hat 3.01 override is required');
  }
  const conchoAnnex = policy.reviewed_structure_overrides?.find(
    (entry) => entry.override_id === 'CONCHO_ANNEX_A_DEFINITION_LISTS/V1',
  );
  if (!conchoAnnex
    || conchoAnnex.operation !== 'GROUP_ANNEX_DEFINITION_LISTS'
    || conchoAnnex.canonical_text_sha256
      !== '30d929c76ab9cd2bddecf3f2df2f2ec107146c2ae31b241110c9923ef03e3be5'
    || conchoAnnex.annex_reference !== 'ANNEX A'
    || conchoAnnex.groups?.length !== 2
    || conchoAnnex.groups[0]?.paragraph_start_byte !== 325611
    || conchoAnnex.groups[0]?.paragraph_end_byte !== 330452
    || conchoAnnex.groups[1]?.paragraph_start_byte !== 339776
    || conchoAnnex.groups[1]?.paragraph_end_byte !== 343879
    || conchoAnnex.required !== true
    || policy.reviewed_structure_overrides.length !== 2) {
    fail('STRUCTURAL_POLICY_DRIFT', 'confirmed Concho Annex A override is required');
  }
}

function assertAgreementManifest(manifest) {
  assertEqual(
    fileDigest(EXPECTED_AGREEMENT_MANIFEST),
    SEALED.agreement_manifest_sha256,
    'AGREEMENT_MANIFEST_DIGEST_DRIFT',
    'agreement manifest',
  );
  assertEqual(
    manifest.schema_version,
    'STAGE_2Y_STRUCTURE_COHORT_AGREEMENTS/V1',
    'AGREEMENT_MANIFEST_DRIFT',
    'schema_version',
  );
  if (!Array.isArray(manifest.agreements)
    || manifest.agreements.length !== 7
    || manifest.agreement_count !== 7
    || manifest.run_count !== 130) {
    fail('AGREEMENT_MANIFEST_DRIFT', 'requires seven agreements and 130 source references');
  }
  const agreementIds = manifest.agreements.map((entry) => entry.agreement_id);
  const deals = manifest.agreements.map((entry) => entry.deal);
  if (new Set(agreementIds).size !== 7 || new Set(deals).size !== 7) {
    fail('AGREEMENT_MANIFEST_DRIFT', 'agreement identifiers and deal keys must be unique');
  }
  const totalRuns = manifest.agreements.reduce(
    (sum, entry) => sum + (Array.isArray(entry.run_identifiers) ? entry.run_identifiers.length : 0),
    0,
  );
  const totalPaths = manifest.agreements.reduce(
    (sum, entry) => sum + (Array.isArray(entry.source_chain_paths) ? entry.source_chain_paths.length : 0),
    0,
  );
  if (totalRuns !== 130 || totalPaths !== 130) {
    fail('AGREEMENT_MANIFEST_DRIFT', 'source-reference and run counts must both be 130');
  }
}

function assertSourceReference({ sourceReference, agreement, sourcePath, runIdentifier, frozen }) {
  const expectedPath = `evidence/canonical-v2/${runIdentifier}/source-reference.json`;
  assertEqual(sourcePath, expectedPath, 'SOURCE_REFERENCE_PATH_DRIFT', runIdentifier);
  const absolutePath = absoluteRepositoryPath(sourcePath);
  const frozenBinding = frozen.get(sourcePath);
  if (!frozenBinding) fail('UNBOUND_SOURCE_REFERENCE', sourcePath);
  assertBoundFile(frozenBinding, sourcePath);

  assertEqual(
    sourceReference.schema_version,
    'GENERAL_EXTRACTION_RUN_SOURCE_REFERENCE/V1',
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.schema_version`,
  );
  assertEqual(sourceReference.deal, agreement.deal, 'SOURCE_REFERENCE_DRIFT', `${runIdentifier}.deal`);
  assertEqual(
    sourceReference.reused_committed_raw_html,
    agreement.admitted_source_path,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.source path`,
  );
  assertEqual(
    sourceReference.raw_bytes_sha256,
    agreement.raw_source_sha256,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.raw digest`,
  );
  assertEqual(
    sourceReference.raw_bytes_length,
    agreement.raw_source_byte_length,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.raw length`,
  );
  assertEqual(
    sourceReference.document_hash,
    agreement.raw_source_sha256,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.document hash`,
  );
  assertEqual(
    sourceReference.canonical_text_sha256,
    agreement.canonical_text_sha256,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.canonical digest`,
  );
  assertEqual(
    sourceReference.canonical_text_byte_length,
    agreement.canonical_text_byte_length,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.canonical length`,
  );
  assertEqual(
    sourceReference.verification_status,
    'PASS',
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.verification`,
  );
  const capture = sourceReference.admitted_source_capture_inputs;
  assertEqual(
    capture?.schema_version,
    'ADMITTED_SOURCE_CAPTURE_INPUTS/V1',
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.capture schema`,
  );
  assertEqual(
    capture?.raw_html_path,
    agreement.admitted_source_path,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.capture path`,
  );
  assertEqual(
    capture?.raw_bytes_sha256,
    agreement.raw_source_sha256,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.capture raw digest`,
  );
  assertEqual(
    capture?.immutable_source_document_id,
    agreement.agreement_id,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.immutable source`,
  );
  assertEqual(
    capture?.source_map_payload_path,
    agreement.source_map_payload_path,
    'SOURCE_REFERENCE_DRIFT',
    `${runIdentifier}.source-map payload`,
  );
  if (!HEX_256.test(capture?.source_map_compressed_sha256 || '')
    || !HEX_256.test(capture?.source_map_digest || '')) {
    fail('SOURCE_REFERENCE_DRIFT', `${runIdentifier}: invalid source-map lineage`);
  }
  return Object.freeze({
    run_identifier: runIdentifier,
    ...fileBinding(absolutePath),
    immutable_source_document_id: capture.immutable_source_document_id,
    source_map_compressed_sha256: capture.source_map_compressed_sha256,
    source_map_digest: capture.source_map_digest,
  });
}

function exactSourceForAgreement({ agreement, agreementManifest, control }) {
  if (!Array.isArray(agreement.source_chain_paths)
    || !Array.isArray(agreement.run_identifiers)
    || agreement.source_chain_paths.length === 0
    || agreement.source_chain_paths.length !== agreement.run_identifiers.length) {
    fail('AGREEMENT_BINDING_DRIFT', `${agreement.deal}: source paths and runs do not align`);
  }
  if (agreement.agreement_id !== agreement.agreement_id.toLowerCase()
    || !/^[a-f0-9]{64}$/.test(agreement.agreement_id)) {
    fail('AGREEMENT_BINDING_DRIFT', `${agreement.deal}: invalid agreement identifier`);
  }

  const frozen = new Map(
    (control.frozen_run_file_bindings || []).map((entry) => [entry.path, entry]),
  );
  if (frozen.size !== (control.frozen_run_file_bindings || []).length) {
    fail('M0_FROZEN_BINDING_DRIFT', 'duplicate frozen run paths');
  }
  const sourceReferenceBindings = agreement.source_chain_paths.map((sourcePath, index) => {
    const sourceReference = readJson(absoluteRepositoryPath(sourcePath));
    return assertSourceReference({
      sourceReference,
      agreement,
      sourcePath,
      runIdentifier: agreement.run_identifiers[index],
      frozen,
    });
  });

  const admittedSourcePath = absoluteRepositoryPath(agreement.admitted_source_path);
  const rawBytes = readFileSync(admittedSourcePath);
  assertEqual(
    rawBytes.length,
    agreement.raw_source_byte_length,
    'ADMITTED_SOURCE_DRIFT',
    `${agreement.deal}.raw length`,
  );
  assertEqual(
    sha256Hex(rawBytes),
    agreement.raw_source_sha256,
    'ADMITTED_SOURCE_DRIFT',
    `${agreement.deal}.raw digest`,
  );

  const admittedRunDirectory = dirname(
    absoluteRepositoryPath(agreement.source_chain_paths[0]),
  );
  const rebuilt = rebuildAdmittedSourcePrimitives({
    runDirectory: admittedRunDirectory,
    repoRoot: REPO_ROOT,
  });
  const immutable = rebuilt.immutable_source_document;
  const conversion = rebuilt.conversion;
  assertEqual(
    immutable.immutable_source_document_id,
    agreement.agreement_id,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.immutable source`,
  );
  assertEqual(
    immutable.response_bytes_sha256,
    agreement.raw_source_sha256,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.raw digest`,
  );
  assertEqual(
    immutable.response_byte_length,
    agreement.raw_source_byte_length,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.raw length`,
  );
  assertEqual(
    conversion.canonical_text_sha256,
    agreement.canonical_text_sha256,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.canonical digest`,
  );
  assertEqual(
    conversion.canonical_text_byte_length,
    agreement.canonical_text_byte_length,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.canonical length`,
  );
  assertEqual(
    Buffer.byteLength(conversion.canonical_text, 'utf8'),
    agreement.canonical_text_byte_length,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.canonical bytes`,
  );
  for (const binding of sourceReferenceBindings) {
    assertEqual(
      binding.immutable_source_document_id,
      immutable.immutable_source_document_id,
      'SOURCE_REFERENCE_DRIFT',
      `${binding.run_identifier}.rebuilt immutable source`,
    );
    assertEqual(
      binding.source_map_compressed_sha256,
      conversion.source_map_compressed_sha256,
      'SOURCE_REFERENCE_DRIFT',
      `${binding.run_identifier}.rebuilt source-map bytes`,
    );
    assertEqual(
      binding.source_map_digest,
      conversion.source_map_digest,
      'SOURCE_REFERENCE_DRIFT',
      `${binding.run_identifier}.rebuilt source-map content`,
    );
  }

  const payloadPath = absoluteRepositoryPath(agreement.source_map_payload_path);
  assertEqual(
    fileDigest(payloadPath),
    conversion.source_map_compressed_sha256,
    'SOURCE_REBUILD_DRIFT',
    `${agreement.deal}.source-map payload digest`,
  );
  const sourceBindings = Object.freeze({
    schema_version: 'STAGE_2Y_EXACT_SOURCE_BINDINGS/V1',
    agreement_manifest: Object.freeze({
      path: repositoryPath(EXPECTED_AGREEMENT_MANIFEST),
      sha256: SEALED.agreement_manifest_sha256,
      source_manifest_id: agreementManifest.source_manifest_id,
    }),
    admitted_source: fileBinding(admittedSourcePath),
    rebuilt_from_source_reference: sourceReferenceBindings[0],
    source_map_payload: fileBinding(payloadPath),
    source_references: Object.freeze(sourceReferenceBindings),
  });
  return Object.freeze({
    agreement_id: agreement.agreement_id,
    deal: agreement.deal,
    canonical_text: conversion.canonical_text,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    immutable_source_document_id: immutable.immutable_source_document_id,
    raw_source_sha256: immutable.response_bytes_sha256,
    raw_source_byte_length: immutable.response_byte_length,
    source_path: agreement.admitted_source_path,
    source_bindings: sourceBindings,
  });
}

function assertAgreementIndex(index, exactSource, policy) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: module returned no object`);
  }
  assertEqual(
    index.schema_version,
    'AGREEMENT_INDEX/V1',
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.schema_version`,
  );
  assertEqual(
    index.coordinate_system,
    'UTF8_CANONICAL_TEXT_HALF_OPEN',
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.coordinate system`,
  );
  if (!HEX_256.test(index.agreement_index_id || '')) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid agreement index identifier`);
  }
  const binding = index.source_binding;
  assertEqual(
    binding?.agreement_id,
    exactSource.agreement_id,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.agreement_id`,
  );
  assertEqual(
    binding?.immutable_source_document_id,
    exactSource.immutable_source_document_id,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.immutable source`,
  );
  assertEqual(
    binding?.canonical_text_id,
    exactSource.canonical_text_id,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.canonical text`,
  );
  assertEqual(
    binding?.canonical_text_sha256,
    exactSource.canonical_text_sha256,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.canonical digest`,
  );
  assertEqual(
    binding?.canonical_text_byte_length,
    Buffer.byteLength(exactSource.canonical_text, 'utf8'),
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.canonical length`,
  );
  assertEqual(
    binding?.canonical_text,
    exactSource.canonical_text,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.exact canonical text`,
  );
  assertEqual(
    binding?.raw_source_sha256,
    exactSource.raw_source_sha256,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.raw digest`,
  );
  assertEqual(
    binding?.raw_source_byte_length,
    exactSource.raw_source_byte_length,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.raw length`,
  );
  assertEqual(
    binding?.source_path,
    exactSource.source_path,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.source path`,
  );
  if (!HEX_256.test(binding?.source_binding_digest || '')) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid source binding digest`);
  }
  const expectedSourceBinding = {
    ...exactSource,
    canonical_text_byte_length: Buffer.byteLength(exactSource.canonical_text, 'utf8'),
  };
  const unsignedSourceBinding = { ...binding };
  delete unsignedSourceBinding.source_binding_digest;
  if (canonicalJson(unsignedSourceBinding) !== canonicalJson(expectedSourceBinding)
    || binding.source_binding_digest
      !== contentId('AGREEMENT_SOURCE_BINDING/V1', unsignedSourceBinding)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: source binding identity drift`);
  }
  assertEqual(
    index.structural_policy?.schema_version,
    policy.schema_version,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.policy schema`,
  );
  assertEqual(
    index.structural_policy?.policy_version,
    policy.policy_version,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.policy version`,
  );
  assertEqual(
    index.structural_policy?.policy_digest,
    policy.policy_digest,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.policy digest`,
  );

  const sourceBytes = Buffer.from(exactSource.canonical_text, 'utf8');
  const authoredKinds = new Set(policy.authored_node_kinds);
  const annotationKinds = new Set(policy.annotation_kinds);
  const artefactKinds = new Set(policy.source_artefact_kinds);
  const diagnosticTypes = new Set(policy.diagnostic_types);
  if (!Array.isArray(index.nodes) || index.nodes.length === 0
    || !Array.isArray(index.annotations)
    || !Array.isArray(index.source_artefacts)
    || !Array.isArray(index.aliases)
    || !Array.isArray(index.ambiguities)
    || !Array.isArray(index.diagnostics)
    || !Array.isArray(index.inline_marker_dispositions)
    || !index.inline_marker_partition
    || typeof index.inline_marker_partition !== 'object'
    || Array.isArray(index.inline_marker_partition)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: separated collections are incomplete`);
  }
  const nodes = new Map();
  for (const node of index.nodes) {
    if (!HEX_256.test(node.node_occurrence_id || '')
      || !HEX_256.test(node.structure_revision_id || '')
      || nodes.has(node.node_occurrence_id)
      || !authoredKinds.has(node.node_kind)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid authored node`);
    }
    if (!Array.isArray(node.child_node_occurrence_ids)
      || !Array.isArray(node.roles)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid authored node span`);
    }
    assertIndexSpan(node.extent_span, sourceBytes, `${exactSource.deal}: invalid node span`);
    const expectedOccurrenceId = contentId('AGREEMENT_SOURCE_NODE_OCCURRENCE/V1', {
      canonical_text_id: exactSource.canonical_text_id,
      node_kind: node.node_kind,
      start_byte: node.extent_span.start_byte,
    });
    if (node.node_occurrence_id !== expectedOccurrenceId) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: node occurrence identity drift`);
    }
    nodes.set(node.node_occurrence_id, node);
  }
  const root = nodes.get(index.root_node_occurrence_id);
  if (!root
    || root.node_kind !== 'AGREEMENT'
    || root.parent_node_occurrence_id !== null
    || root.extent_span.start_byte !== 0
    || root.extent_span.end_byte !== sourceBytes.length
    || index.nodes.filter((node) => node.parent_node_occurrence_id === null).length !== 1) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid agreement root`);
  }
  for (const parent of index.nodes) {
    let previousEnd = -1;
    for (const [ordinal, childId] of parent.child_node_occurrence_ids.entries()) {
      const child = nodes.get(childId);
      if (!child
        || child.parent_node_occurrence_id !== parent.node_occurrence_id
        || child.child_ordinal !== ordinal
        || child.extent_span.start_byte < parent.extent_span.start_byte
        || child.extent_span.end_byte > parent.extent_span.end_byte
        || child.extent_span.start_byte < previousEnd) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: non-reciprocal tree link`);
      }
      previousEnd = child.extent_span.end_byte;
    }
  }
  for (const node of index.nodes) {
    if (node === root) continue;
    const directParent = nodes.get(node.parent_node_occurrence_id);
    if (!directParent
      || directParent.child_node_occurrence_ids[node.child_ordinal] !== node.node_occurrence_id) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: missing reciprocal parent link`);
    }
    const seen = new Set([node.node_occurrence_id]);
    let cursor = node;
    while (cursor.parent_node_occurrence_id !== null) {
      if (seen.has(cursor.parent_node_occurrence_id)) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: containment cycle`);
      }
      seen.add(cursor.parent_node_occurrence_id);
      cursor = nodes.get(cursor.parent_node_occurrence_id);
      if (!cursor) fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: missing parent node`);
    }
    if (cursor !== root) fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: orphan node`);
    const expectedRevisionId = contentId('AGREEMENT_SOURCE_NODE_REVISION/V1', {
      node_occurrence_id: node.node_occurrence_id,
      end_byte: node.extent_span.end_byte,
      parent_node_occurrence_id: node.parent_node_occurrence_id,
      child_ordinal: node.child_ordinal,
      child_node_occurrence_ids: node.child_node_occurrence_ids,
      roles: node.roles,
      reference: node.reference,
      structural_policy_digest: policy.policy_digest,
    });
    if (node.structure_revision_id !== expectedRevisionId) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: node revision identity drift`);
    }
  }
  const annotationIds = new Set();
  for (const annotation of index.annotations) {
    const owner = nodes.get(annotation.owner_node_occurrence_id);
    if (!annotationKinds.has(annotation.annotation_kind)
      || !HEX_256.test(annotation.annotation_occurrence_id || '')
      || annotationIds.has(annotation.annotation_occurrence_id)
      || !owner
      || annotation.span.start_byte < owner.extent_span.start_byte
      || annotation.span.end_byte > owner.extent_span.end_byte) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid source annotation`);
    }
    assertIndexSpan(
      annotation.span,
      sourceBytes,
      `${exactSource.deal}: invalid source annotation span`,
    );
    annotationIds.add(annotation.annotation_occurrence_id);
  }
  const ambiguityIds = new Set();
  const ambiguitiesByDispositionId = new Map();
  for (const ambiguity of index.ambiguities) {
    assertExactKeys(ambiguity, [
      'schema_version',
      'ambiguity_id',
      'ambiguity_type',
      'status',
      'node_occurrence_ids',
      'span',
      'detail',
    ], 'INVALID_AGREEMENT_INDEX', `${exactSource.deal}: structural ambiguity`);
    const { ambiguity_id: ignoredAmbiguityId, ...ambiguityPayload } = ambiguity;
    if (ambiguity.schema_version !== 'AGREEMENT_STRUCTURE_AMBIGUITY/V1'
      || ambiguity.ambiguity_id !== contentId(ambiguity.schema_version, ambiguityPayload)
      || ambiguityIds.has(ambiguity.ambiguity_id)
      || typeof ambiguity.ambiguity_type !== 'string'
      || ambiguity.ambiguity_type.length === 0
      || typeof ambiguity.status !== 'string'
      || ambiguity.status.length === 0
      || !Array.isArray(ambiguity.node_occurrence_ids)
      || new Set(ambiguity.node_occurrence_ids).size !== ambiguity.node_occurrence_ids.length
      || ambiguity.node_occurrence_ids.some((nodeId) => !nodes.has(nodeId))
      || !ambiguity.detail
      || typeof ambiguity.detail !== 'object'
      || Array.isArray(ambiguity.detail)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid structural ambiguity`);
    }
    assertIndexSpan(
      ambiguity.span,
      sourceBytes,
      `${exactSource.deal}: invalid structural ambiguity span`,
    );
    ambiguityIds.add(ambiguity.ambiguity_id);
    const dispositionId = ambiguity.detail.inline_marker_disposition_id;
    if (dispositionId !== undefined) {
      if (!HEX_256.test(dispositionId)
        || ambiguitiesByDispositionId.has(dispositionId)) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: ambiguous disposition linkage`);
      }
      ambiguitiesByDispositionId.set(dispositionId, ambiguity);
    }
  }

  const dispositionIds = new Set();
  let previousDispositionStart = -1;
  for (const disposition of index.inline_marker_dispositions) {
    assertExactKeys(disposition, [
      'schema_version',
      'disposition_id',
      'disposition',
      'reason',
      'style',
      'depth',
      'parent_node_occurrence_id',
      'marker_spans',
      'produced_limb_node_occurrence_ids',
    ], 'INVALID_AGREEMENT_INDEX', `${exactSource.deal}: inline marker disposition`);
    const { disposition_id: ignoredDispositionId, ...dispositionPayload } = disposition;
    const parent = nodes.get(disposition.parent_node_occurrence_id);
    const reasonCollection = disposition.disposition === 'AUTHORED_INLINE_LIST'
      ? policy.inline_list_policy.authored_reasons
      : disposition.disposition === 'NON_STRUCTURAL_MARKER'
        ? policy.inline_list_policy.non_structural_reasons
        : policy.inline_list_policy.unresolved_reasons;
    const validDepth = disposition.depth === null
      || (Number.isInteger(disposition.depth)
        && disposition.depth >= 1
        && (disposition.depth <= policy.inline_list_policy.maximum_depth
          || (disposition.disposition === 'UNRESOLVED_INLINE_LIST'
            && disposition.reason === 'DEPTH_LIMIT'
            && disposition.depth === policy.inline_list_policy.maximum_depth + 1)));
    if (disposition.schema_version !== INLINE_MARKER_DISPOSITION_SCHEMA
      || disposition.disposition_id !== contentId(
        INLINE_MARKER_DISPOSITION_SCHEMA,
        dispositionPayload,
      )
      || dispositionIds.has(disposition.disposition_id)
      || !INLINE_MARKER_DISPOSITIONS.has(disposition.disposition)
      || typeof disposition.reason !== 'string'
      || disposition.reason.length === 0
      || typeof disposition.style !== 'string'
      || disposition.style.length === 0
      || !validDepth
      || !reasonCollection.includes(disposition.reason)
      || !parent
      || !Array.isArray(disposition.marker_spans)
      || disposition.marker_spans.length === 0
      || !Array.isArray(disposition.produced_limb_node_occurrence_ids)
      || new Set(disposition.produced_limb_node_occurrence_ids).size
        !== disposition.produced_limb_node_occurrence_ids.length) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid inline marker disposition`);
    }
    let previousMarkerEnd = -1;
    for (const markerSpan of disposition.marker_spans) {
      assertIndexSpan(
        markerSpan,
        sourceBytes,
        `${exactSource.deal}: invalid inline marker disposition span`,
      );
      if (markerSpan.start_byte < parent.extent_span.start_byte
        || markerSpan.end_byte > parent.extent_span.end_byte
        || markerSpan.start_byte < previousMarkerEnd) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: unordered disposition marker span`);
      }
      previousMarkerEnd = markerSpan.end_byte;
    }
    const dispositionStart = disposition.marker_spans[0].start_byte;
    if (dispositionStart < previousDispositionStart) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: unordered inline dispositions`);
    }
    previousDispositionStart = dispositionStart;
    const producedLimbs = disposition.produced_limb_node_occurrence_ids
      .map((nodeId) => nodes.get(nodeId));
    const linkedAmbiguity = ambiguitiesByDispositionId.get(disposition.disposition_id);
    if (disposition.disposition === 'AUTHORED_INLINE_LIST') {
      if (disposition.marker_spans.length < 2
        || producedLimbs.length !== disposition.marker_spans.length
        || producedLimbs.some((limb) => !limb
          || limb.node_kind !== 'LIMB'
          || limb.parent_node_occurrence_id !== parent.node_occurrence_id
          || !limb.roles.includes('AUTHORED_INLINE_LIMB'))
        || linkedAmbiguity) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid authored-list disposition`);
      }
      for (const [position, limb] of producedLimbs.entries()) {
        const markerSpan = disposition.marker_spans[position];
        const matchingMarkers = index.annotations.filter((annotation) =>
          annotation.annotation_kind === 'OUTLINE_MARKER'
            && annotation.owner_node_occurrence_id === limb.node_occurrence_id
            && canonicalJson(annotation.span) === canonicalJson(markerSpan));
        if (matchingMarkers.length !== 1) {
          fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: authored limb marker drift`);
        }
      }
    } else {
      if (producedLimbs.length !== 0
        || disposition.marker_spans.some((markerSpan) => index.annotations.some((annotation) =>
          annotation.annotation_kind === 'OUTLINE_MARKER'
            && canonicalJson(annotation.span) === canonicalJson(markerSpan)))) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: non-authored disposition made structure`);
      }
      if (disposition.disposition === 'UNRESOLVED_INLINE_LIST') {
        if (!linkedAmbiguity
          || linkedAmbiguity.ambiguity_type !== 'UNRESOLVED_INLINE_LIST'
          || !linkedAmbiguity.node_occurrence_ids.includes(parent.node_occurrence_id)
          || linkedAmbiguity.span.start_byte > disposition.marker_spans[0].start_byte
          || linkedAmbiguity.span.end_byte < disposition.marker_spans.at(-1).end_byte) {
          fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: unresolved disposition lacks ambiguity`);
        }
      } else if (linkedAmbiguity) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: resolved disposition has ambiguity`);
      }
    }
    dispositionIds.add(disposition.disposition_id);
  }
  for (const [dispositionId, ambiguity] of ambiguitiesByDispositionId) {
    if (!dispositionIds.has(dispositionId)
      || ambiguity.ambiguity_type !== 'UNRESOLVED_INLINE_LIST') {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: orphan inline-list ambiguity`);
    }
  }

  const partition = index.inline_marker_partition;
  assertExactKeys(partition, [
    'schema_version',
    'proof_digest',
    'scanned_node_occurrence_ids',
    'candidate_markers',
    'candidate_count',
    'disposition_count',
    'candidate_marker_span_set_digest',
    'disposition_marker_span_set_digest',
    'exact_partition',
  ], 'INVALID_AGREEMENT_INDEX', `${exactSource.deal}: inline marker partition`);
  if (partition.schema_version !== INLINE_MARKER_PARTITION_SCHEMA
    || !HEX_256.test(partition.proof_digest || '')
    || !Array.isArray(partition.scanned_node_occurrence_ids)
    || new Set(partition.scanned_node_occurrence_ids).size
      !== partition.scanned_node_occurrence_ids.length
    || partition.scanned_node_occurrence_ids.some((nodeId) => {
      const node = nodes.get(nodeId);
      return !node || !['SENTENCE', 'PARAGRAPH'].includes(node.node_kind);
    })
    || !Array.isArray(partition.candidate_markers)
    || partition.candidate_count !== partition.candidate_markers.length
    || partition.disposition_count !== index.inline_marker_dispositions.length
    || partition.exact_partition !== true) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid inline marker partition`);
  }
  const candidateIds = new Set();
  for (const candidate of partition.candidate_markers) {
    assertExactKeys(candidate, [
      'schema_version',
      'candidate_id',
      'owner_node_occurrence_id',
      'label',
      'span',
    ], 'INVALID_AGREEMENT_INDEX', `${exactSource.deal}: inline marker candidate`);
    const { candidate_id: ignoredCandidateId, ...candidatePayload } = candidate;
    const owner = nodes.get(candidate.owner_node_occurrence_id);
    if (candidate.schema_version !== INLINE_MARKER_CANDIDATE_SCHEMA
      || candidate.candidate_id !== contentId(INLINE_MARKER_CANDIDATE_SCHEMA, candidatePayload)
      || candidateIds.has(candidate.candidate_id)
      || !owner
      || !['SENTENCE', 'PARAGRAPH'].includes(owner.node_kind)
      || typeof candidate.label !== 'string'
      || candidate.label.length === 0) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid inline marker candidate`);
    }
    assertIndexSpan(candidate.span, sourceBytes,
      `${exactSource.deal}: invalid inline marker candidate span`);
    if (candidate.span.start_byte < owner.extent_span.start_byte
      || candidate.span.end_byte > owner.extent_span.end_byte) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: candidate outside scanned owner`);
    }
    candidateIds.add(candidate.candidate_id);
  }
  const compareMarkerSpans = (left, right) => left.start_byte - right.start_byte
    || left.end_byte - right.end_byte
    || left.text_sha256.localeCompare(right.text_sha256);
  const candidateMarkerSpans = partition.candidate_markers
    .map((candidate) => candidate.span)
    .sort(compareMarkerSpans);
  const dispositionMarkerSpans = index.inline_marker_dispositions
    .flatMap((disposition) => disposition.marker_spans)
    .sort(compareMarkerSpans);
  const markerSpanKey = (markerSpan) => `${markerSpan.start_byte}:${markerSpan.end_byte}`;
  const candidateSpanSetDigest = contentId(INLINE_MARKER_SPAN_SET_DOMAIN, candidateMarkerSpans);
  const dispositionSpanSetDigest = contentId(
    INLINE_MARKER_SPAN_SET_DOMAIN,
    dispositionMarkerSpans,
  );
  const partitionPayload = {
    schema_version: partition.schema_version,
    scanned_node_occurrence_ids: partition.scanned_node_occurrence_ids,
    candidate_markers: partition.candidate_markers,
    candidate_count: partition.candidate_count,
    disposition_count: partition.disposition_count,
    candidate_marker_span_set_digest: partition.candidate_marker_span_set_digest,
    disposition_marker_span_set_digest: partition.disposition_marker_span_set_digest,
    exact_partition: partition.exact_partition,
  };
  if (new Set(candidateMarkerSpans.map(markerSpanKey)).size !== candidateMarkerSpans.length
    || new Set(dispositionMarkerSpans.map(markerSpanKey)).size
      !== dispositionMarkerSpans.length
    || canonicalJson(candidateMarkerSpans) !== canonicalJson(dispositionMarkerSpans)
    || partition.candidate_marker_span_set_digest !== candidateSpanSetDigest
    || partition.disposition_marker_span_set_digest !== dispositionSpanSetDigest
    || candidateSpanSetDigest !== dispositionSpanSetDigest
    || partition.proof_digest !== contentId(INLINE_MARKER_PARTITION_SCHEMA, partitionPayload)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: inline marker partition mismatch`);
  }
  const artefacts = new Map();
  for (const artefact of index.source_artefacts) {
    const containingNode = nodes.get(artefact.containing_node_occurrence_id);
    if (!artefactKinds.has(artefact.source_artefact_kind)
      || !HEX_256.test(artefact.source_artefact_id || '')
      || artefacts.has(artefact.source_artefact_id)
      || !containingNode
      || artefact.span.start_byte < containingNode.extent_span.start_byte
      || artefact.span.end_byte > containingNode.extent_span.end_byte) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid source artefact`);
    }
    assertIndexSpan(
      artefact.span,
      sourceBytes,
      `${exactSource.deal}: invalid source artefact span`,
    );
    if (index.nodes.some((node) => node.node_kind === 'HEADING'
      && node.extent_span.start_byte < artefact.span.end_byte
      && node.extent_span.end_byte > artefact.span.start_byte)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: source artefact overlaps a heading`);
    }
    artefacts.set(artefact.source_artefact_id, artefact);
  }
  const coverage = index.byte_coverage;
  if (coverage?.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
    || coverage.source_byte_length !== sourceBytes.length
    || coverage.covered_byte_length !== sourceBytes.length
    || coverage.complete !== true
    || !Array.isArray(coverage.gaps)
    || coverage.gaps.length !== 0
    || !Array.isArray(coverage.overlaps)
    || coverage.overlaps.length !== 0
    || !Array.isArray(coverage.segments)
    || coverage.segments.length === 0) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: incomplete byte coverage`);
  }
  let byteCursor = 0;
  for (const segment of coverage.segments) {
    const nodeOwner = nodes.get(segment.owner_id);
    const artefactOwner = artefacts.get(segment.owner_id);
    const ownerExists = segment.owner_kind === 'AUTHORED_NODE'
      ? nodeOwner
        && nodeOwner.extent_span.start_byte <= segment.start_byte
        && nodeOwner.extent_span.end_byte >= segment.end_byte
      : segment.owner_kind === 'SOURCE_ARTEFACT'
        && artefactOwner
        && artefactOwner.span.start_byte === segment.start_byte
        && artefactOwner.span.end_byte === segment.end_byte;
    if (segment.start_byte !== byteCursor
      || segment.end_byte <= segment.start_byte
      || segment.end_byte > sourceBytes.length
      || !ownerExists
      || segment.text_sha256 !== sha256Hex(sourceBytes.subarray(
        segment.start_byte,
        segment.end_byte,
      ))) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: invalid byte coverage segment`);
    }
    byteCursor = segment.end_byte;
  }
  if (byteCursor !== sourceBytes.length) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: byte coverage does not reach source end`);
  }
  const aliasIds = new Set();
  const legacyIds = new Set();
  const aliasNodeIds = new Set();
  for (const alias of index.aliases) {
    const legacyKey = `${alias.legacy_schema_version}\0${alias.legacy_node_id}`;
    const target = nodes.get(alias.node_occurrence_id);
    const expectedAliasId = contentId('AGREEMENT_SOURCE_ALIAS/V1', {
      legacy_schema_version: alias.legacy_schema_version,
      legacy_node_id: alias.legacy_node_id,
      node_occurrence_id: alias.node_occurrence_id,
    });
    if (alias.schema_version !== 'AGREEMENT_SOURCE_ALIAS/V1'
      || alias.cardinality !== 'ONE_TO_ONE'
      || !HEX_256.test(alias.legacy_node_id || '')
      || !HEX_256.test(alias.node_occurrence_id || '')
      || !HEX_256.test(alias.structure_revision_id || '')
      || alias.alias_id !== expectedAliasId
      || aliasIds.has(alias.alias_id)
      || legacyIds.has(legacyKey)
      || aliasNodeIds.has(alias.node_occurrence_id)
      || !target
      || alias.structure_revision_id !== target.structure_revision_id
      || !ALIAS_BASES.has(alias.basis)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: alias collision`);
    }
    aliasIds.add(alias.alias_id);
    legacyIds.add(legacyKey);
    aliasNodeIds.add(alias.node_occurrence_id);
  }
  const currentStructure = sectionizeAdmittedSource({
    source_text: exactSource.canonical_text,
    document_hash: exactSource.raw_source_sha256,
  });
  const aliasesByLegacy = new Map(index.aliases.map((alias) => [alias.legacy_node_id, alias]));
  if (index.aliases.length !== EXPECTED_ALIAS_COUNTS[exactSource.deal]
    || aliasesByLegacy.size !== currentStructure.nodes.length
    || currentStructure.nodes.some((legacy) => !aliasesByLegacy.has(legacy.section_id))) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: incomplete legacy alias coverage`);
  }
  for (const legacy of currentStructure.nodes) {
    const target = nodes.get(aliasesByLegacy.get(legacy.section_id).node_occurrence_id);
    if (legacy.kind === 'SECTION' && /-INTRO$/.test(legacy.reference || '')
      && (!['CHAPEAU', 'HEADING'].includes(target.node_kind)
        || aliasesByLegacy.get(legacy.section_id).basis !== (target.node_kind === 'CHAPEAU'
          ? 'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_CHAPEAU'
          : 'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_HEADING'))) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: synthetic introduction alias drift`);
    }
    if (legacy.kind === 'SECTION' && /^Annex-[A-Z0-9]+$/.test(legacy.reference || '')
      && (target.node_kind !== 'ANNEX'
        || aliasesByLegacy.get(legacy.section_id).basis
          !== 'PSEUDO_SECTION_REPLACED_BY_AUTHORED_ANNEX')) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: pseudo annex section alias drift`);
    }
    const legacyPrefix = sourceBytes.subarray(legacy.start, Math.min(legacy.end, legacy.start + 16))
      .toString('utf8');
    if (legacy.kind === 'ARTICLE' && /^ANNEX\s+[A-Z0-9]+/.test(legacyPrefix)) {
      const targetParent = nodes.get(target.parent_node_occurrence_id);
      if (target.node_kind !== 'HEADING'
        || targetParent?.node_kind !== 'ANNEX'
        || aliasesByLegacy.get(legacy.section_id).basis
          !== 'SYNTHETIC_ARTICLE_WRAPPER_REPLACED_BY_AUTHORED_ANNEX_HEADING') {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: synthetic annex article alias drift`);
      }
    }
  }

  const annexes = index.nodes.filter((node) => node.node_kind === 'ANNEX')
    .map((node) => [node.reference, node.extent_span.start_byte, node.extent_span.end_byte]);
  const expectedAnnexes = EXPECTED_ANNEXES[exactSource.deal] || [];
  if (canonicalJson(annexes) !== canonicalJson(expectedAnnexes)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: authored annex inventory drift`);
  }
  for (const [reference, start, end] of expectedAnnexes) {
    const annex = index.nodes.find((node) => node.node_kind === 'ANNEX'
      && node.reference === reference && node.extent_span.start_byte === start);
    const markers = index.annotations.filter((annotation) =>
      annotation.annotation_kind === 'OUTLINE_MARKER'
      && annotation.owner_node_occurrence_id === annex.node_occurrence_id);
    if (annex.parent_node_occurrence_id !== root.node_occurrence_id
      || annex.extent_span.end_byte !== end
      || canonicalJson(annex.roles) !== canonicalJson(['AUTHORED_ANNEX', 'STRUCTURAL_CONTAINER'])
      || markers.length !== 1
      || markers[0].span.start_byte !== start
      || markers[0].span.end_byte !== start + Buffer.byteLength(reference, 'utf8')
      || sourceBytes.subarray(markers[0].span.start_byte, markers[0].span.end_byte)
        .toString('utf8') !== reference
      || (start > 0 && sourceBytes[start - 1] !== 0x0a)
      || sourceBytes[start + Buffer.byteLength(reference, 'utf8')] !== 0x0a
      || index.nodes.some((node) => node.node_kind === 'ARTICLE'
        && node.extent_span.start_byte === start)
      || index.nodes.some((node) => node.node_kind === 'SECTION'
        && (node.extent_span.start_byte === start || /^Annex-/.test(node.reference || '')))) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: authored annex structure drift`);
    }
  }

  const annexOverride = policy.reviewed_structure_overrides.find(
    (entry) => entry.canonical_text_sha256 === exactSource.canonical_text_sha256
      && entry.operation === 'GROUP_ANNEX_DEFINITION_LISTS',
  );
  for (const group of annexOverride?.groups || []) {
    const paragraph = index.nodes.find((node) => node.node_kind === 'PARAGRAPH'
      && node.reference === group.reference
      && node.extent_span.start_byte === group.paragraph_start_byte
      && node.extent_span.end_byte === group.paragraph_end_byte);
    if (!paragraph) fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: definition block drift`);
    const outerLimbs = [];
    for (const anchor of group.outer_limbs || []) {
      const limb = index.nodes.find((node) => node.node_kind === 'LIMB'
        && node.reference === anchor.reference
        && node.extent_span.start_byte === anchor.start_byte
        && node.extent_span.end_byte === anchor.end_byte);
      const legacy = currentStructure.nodes.find((node) => node.kind === 'SUBSECTION'
        && node.start === anchor.start_byte);
      const alias = legacy ? aliasesByLegacy.get(legacy.section_id) : null;
      if (!limb
        || limb.parent_node_occurrence_id !== paragraph.node_occurrence_id
        || (legacy && (alias?.node_occurrence_id !== limb.node_occurrence_id
          || alias?.basis !== 'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE'))) {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: definition limb drift`);
      }
      outerLimbs.push(limb);
    }
    const listParent = outerLimbs.at(-1) || paragraph;
    for (const anchor of group.limbs) {
      const limb = index.nodes.find((node) => node.node_kind === 'LIMB'
        && node.reference === anchor.reference
        && node.extent_span.start_byte === anchor.start_byte
        && node.extent_span.end_byte === anchor.end_byte);
      const legacy = currentStructure.nodes.find((node) => node.kind === 'SUBSECTION'
        && node.start === anchor.start_byte);
      const alias = legacy ? aliasesByLegacy.get(legacy.section_id) : null;
      if (!limb
        || limb.parent_node_occurrence_id !== listParent.node_occurrence_id
        || alias?.node_occurrence_id !== limb.node_occurrence_id
        || alias?.basis !== 'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE') {
        fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: definition limb drift`);
      }
    }
  }
  for (const diagnostic of index.diagnostics) {
    if (!diagnosticTypes.has(diagnostic.diagnostic_type)) {
      fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: untyped diagnostic`);
    }
  }
  const expectedCounts = {
    nodes: index.nodes.length,
    annotations: index.annotations.length,
    source_artefacts: index.source_artefacts.length,
    aliases: index.aliases.length,
    ambiguities: index.ambiguities.length,
    diagnostics: index.diagnostics.length,
    inline_marker_dispositions: index.inline_marker_dispositions.length,
    inline_marker_candidates: index.inline_marker_partition.candidate_markers.length,
    source_bytes: sourceBytes.length,
  };
  if (canonicalJson(index.counts) !== canonicalJson(expectedCounts)
    || coverage.proof_digest
      !== contentId('AGREEMENT_BYTE_COVERAGE_PROOF/V1', coverage.segments)) {
    fail('INVALID_AGREEMENT_INDEX', `${exactSource.deal}: count or coverage identity drift`);
  }
  const expectedIndexId = contentId('AGREEMENT_INDEX/V1', {
    agreement_id: exactSource.agreement_id,
    canonical_text_id: exactSource.canonical_text_id,
    structural_policy_digest: policy.policy_digest,
    root_node_occurrence_id: root.node_occurrence_id,
    counts: expectedCounts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', index.nodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', index.annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1',
      index.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', index.aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', index.ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', index.diagnostics),
    inline_marker_disposition_set_digest: contentId(
      INLINE_MARKER_DISPOSITION_SET_DOMAIN,
      index.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: index.inline_marker_partition.proof_digest,
    byte_coverage_proof_digest: coverage.proof_digest,
  });
  assertEqual(
    index.agreement_index_id,
    expectedIndexId,
    'INVALID_AGREEMENT_INDEX',
    `${exactSource.deal}.agreement index identity`,
  );
}

function writeSealed(absolutePath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (existsSync(absolutePath)) {
    const current = readFileSync(absolutePath, 'utf8');
    if (current !== bytes) {
      fail('SEALED_OUTPUT_DIVERGENCE', `refuses to overwrite ${repositoryPath(absolutePath)}`);
    }
    return fileBinding(absolutePath);
  }
  writeFileSync(absolutePath, bytes, { encoding: 'utf8', flag: 'wx' });
  return fileBinding(absolutePath);
}

function buildDraftReceipt({
  authority,
  policy,
  agreementManifest,
  control,
  outputBindings,
  inlineParserMetrics,
  startedAt,
  initialMemory,
}) {
  const finalMemory = process.memoryUsage();
  const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
  const outputSetDigest = valueDigest(outputBindings);
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_M2_DRAFT_RECEIPT/V1',
    stage: 'M2',
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
    status: 'STOPPED',
    technical_review: 'PENDING_SOL_REVIEW',
    base_commit: M2_BASE_COMMIT,
    authority_binding: Object.freeze({
      ...fileBinding(M2_AUTHORITY_PATH),
      authorised_stage: authority.authorised_stage,
      instruction_date: authority.authorising_instruction.date,
    }),
    structural_policy_binding: Object.freeze({
      ...fileBinding(EXPECTED_POLICY),
      policy_version: policy.policy_version,
      policy_digest: policy.policy_digest,
    }),
    agreement_manifest_binding: Object.freeze({
      ...fileBinding(EXPECTED_AGREEMENT_MANIFEST),
      source_manifest_id: agreementManifest.source_manifest_id,
    }),
    sealed_predecessor_bindings: Object.freeze({
      m0_control_manifest: SEALED.m0_control_manifest,
      m0_receipt: SEALED.m0_receipt,
      m1_decision: SEALED.m1_decision,
      m1_receipt: SEALED.m1_receipt,
      m1_sol_review: SEALED.m1_sol_review,
    }),
    current_state_bindings: Object.freeze({
      baseline_manifest: control.baseline_manifest,
      current_baseline: control.current_baseline_binding,
      current_measurement: control.current_measurement_binding,
      current_rendered_rows: control.current_projection_binding,
    }),
    implementation_bindings: Object.freeze({
      agreement_index_module: fileBinding(resolve(REPO_ROOT, 'lib/canonical-v2/agreement-index.js')),
      private_inline_structure_module: fileBinding(PRIVATE_INLINE_STRUCTURE_PATH),
      private_inline_structure_test: fileBinding(PRIVATE_INLINE_STRUCTURE_TEST_PATH),
      shadow_runner: fileBinding(fileURLToPath(import.meta.url)),
      focused_test: fileBinding(resolve(REPO_ROOT, 'tests/canonical-v2-agreement-index.test.js')),
    }),
    agreement_count: outputBindings.length,
    source_reference_count: 130,
    output_root: repositoryPath(EXPECTED_OUTPUT_ROOT),
    output_bindings: Object.freeze(outputBindings),
    output_set_digest: outputSetDigest,
    inline_parser_metrics: inlineParserMetrics,
    runtime_measurements: Object.freeze({
      elapsed_milliseconds: Number(elapsedNanoseconds / 1000000n),
      rss_before_bytes: initialMemory.rss,
      rss_after_bytes: finalMemory.rss,
      heap_used_before_bytes: initialMemory.heapUsed,
      heap_used_after_bytes: finalMemory.heapUsed,
      process_peak_rss_kibibytes: process.resourceUsage().maxRSS,
    }),
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
    m0_m1_sealed_artefact_mutations: 0,
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
  });
}

function main() {
  const startedAt = process.hrtime.bigint();
  const initialMemory = process.memoryUsage();
  const args = parseArgs(process.argv);
  const control = readJson(args.control);
  const agreementManifest = readJson(args.agreementManifest);
  const policy = readJson(args.policy);
  const authority = readJson(M2_AUTHORITY_PATH);

  assertM0AndM1(control);
  assertM2Authority(authority);
  assertAgreementManifest(agreementManifest);
  assertStructuralPolicy(policy);

  const outputBindings = [];
  const inlineParserMetricEntries = [];
  let sourceReferenceCount = 0;
  for (const agreement of agreementManifest.agreements) {
    const exactSource = exactSourceForAgreement({ agreement, agreementManifest, control });
    sourceReferenceCount += exactSource.source_bindings.source_references.length;
    const index = indexAgreement(exactSource, policy);
    assertAgreementIndex(index, exactSource, policy);
    inlineParserMetricEntries.push({ agreement, index });
    outputBindings.push(writeSealed(
      resolve(args.outputRoot, `${agreement.agreement_id}.agreement-index.json`),
      index,
    ));
  }
  assertEqual(sourceReferenceCount, 130, 'SOURCE_REFERENCE_COUNT_DRIFT', 'validated records');
  const inlineParserMetrics = buildInlineParserMetrics(inlineParserMetricEntries);
  const receipt = buildDraftReceipt({
    authority,
    policy,
    agreementManifest,
    control,
    outputBindings,
    inlineParserMetrics,
    startedAt,
    initialMemory,
  });
  const receiptBinding = writeSealed(M2_DRAFT_RECEIPT_PATH, receipt);
  process.stdout.write(`${canonicalJson({
    schema_version: 'STAGE_2Y_AGREEMENT_INDEX_SHADOW_RUN/V1',
    agreement_count: outputBindings.length,
    source_reference_count: sourceReferenceCount,
    model_calls: 0,
    phase_b_route_calls: 0,
    publication_authorisation: 'NONE',
    output_bindings: outputBindings,
    inline_parser_metrics: inlineParserMetrics,
    draft_receipt_binding: receiptBinding,
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  assertAgreementIndex,
  assertAgreementManifest,
  assertM0AndM1,
  assertM2Authority,
  assertStructuralPolicy,
  buildInlineParserMetrics,
  exactSourceForAgreement,
};
