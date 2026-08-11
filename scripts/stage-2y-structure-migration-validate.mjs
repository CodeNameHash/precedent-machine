#!/usr/bin/env node

// Validates one Stage 2Y migration receipt. This command is read-only.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { listRegisteredSectionFamilies } = require(
  '../lib/canonical-v2/native-producer/producer-prompt-registry',
);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

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

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_RECEIPT_INVALID: ${message}`);
}

function parseArgs(argv) {
  if (argv.length !== 4 || argv[2] !== '--receipt' || !argv[3]) {
    fail('usage: node scripts/stage-2y-structure-migration-validate.mjs --receipt <path>');
  }
  return resolve(argv[3]);
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
  return absolutePath;
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
