#!/usr/bin/env node

// Finalises the report-only Stage 2Y M1 packet after the approved Sol review.
// This command never writes the eight technical evidence outputs.

import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
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
const EXPECTED_REVIEW = resolve(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m1-sol-technical-review.json',
);
const EXPECTED_DECISION = resolve(MIGRATION_ROOT, 'prototype/m1/decision.json');
const EXPECTED_RECEIPT = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m1-falsification-prototype.json',
);
const M0_RECEIPT = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m0-control-freeze.json',
);
const PACKET_ID = 'stage-2y-structure-m1-falsification-prototype';
const REVIEW_SCHEMA = 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1';
const DECISION_SCHEMA = 'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1';
const UNSIGNED_DECISION_DOMAIN = 'STAGE_2Y_STRUCTURE_M1_UNSIGNED_DECISION/V1';
const OUTPUT_SET_DOMAIN = 'STAGE_2Y_STRUCTURE_M1_FINAL_OUTPUT_SET/V1';
const REVIEW_REPOSITORY_PATH = repositoryPath(EXPECTED_REVIEW);

const OUTPUT_SCHEMAS = Object.freeze({
  'agreement-index.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_INDEX/V1',
  'byte-ownership.json': 'STAGE_2Y_STRUCTURE_BYTE_OWNERSHIP/V1',
  'node-aliases.json': 'STAGE_2Y_STRUCTURE_NODE_ALIASES/V1',
  'structure-alternatives.json': 'STAGE_2Y_STRUCTURE_ALTERNATIVES/V1',
  'reference-edges.json': 'STAGE_2Y_STRUCTURE_REFERENCE_EDGES/V1',
  'context-facts.json': 'STAGE_2Y_STRUCTURE_CONTEXT_FACTS/V1',
  'current-semantic-mapping.json': 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1',
  'source-to-row-diff.json': 'STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF/V1',
  'decision.json': DECISION_SCHEMA,
});
const EVIDENCE_OUTPUT_NAMES = Object.freeze(Object.keys(OUTPUT_SCHEMAS).slice(0, -1));
const ALL_OUTPUT_NAMES = Object.freeze(Object.keys(OUTPUT_SCHEMAS));
const REVIEW_CHECKS = Object.freeze([
  'STAGE_2Y_STRUCTURE_PROTOTYPE_TEST',
  'STRUCTURE_AND_INHERITANCE_GATE',
  'TERMINATION_INHERITANCE_ADDITION',
]);
const RECEIPT_CHECKS = Object.freeze([
  'PROTOTYPE_INTERNAL_ASSERTIONS',
  'PROTOTYPE_OUTPUT_SCHEMA',
  ...REVIEW_CHECKS,
  'SOL_TECHNICAL_REVIEW',
]);
const ZERO_AUTHORITY_FIELDS = Object.freeze([
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
const REVIEW_CORE_FIELDS = Object.freeze([
  'schema_version',
  'lifecycle_state',
  'stage',
  'packet_id',
  'base_commit',
  'reviewer',
  'status',
  'verdict',
  'technical_decision',
  'unsigned_decision_payload_digest',
  'focused_checks',
  'exceptions',
  'output_bindings',
]);

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_M1_FINALISE: ${message}`);
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath);
  if (!value || value.startsWith('..')) fail(`path is outside repository: ${absolutePath}`);
  return value.split('\\').join('/');
}

function parseArgs(argv) {
  const allowed = new Map([
    ['--review', EXPECTED_REVIEW],
    ['--decision', EXPECTED_DECISION],
    ['--receipt', EXPECTED_RECEIPT],
  ]);
  if (argv.length !== 8) {
    fail('requires only --review <path> --decision <path> --receipt <path>');
  }
  const supplied = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || supplied.has(key)) {
      fail('requires each of --review, --decision and --receipt exactly once');
    }
    const absolutePath = resolve(value);
    if (absolutePath !== allowed.get(key)) fail(`${key} must use its fixed M1 path`);
    supplied.set(key, absolutePath);
  }
  if (supplied.size !== allowed.size) {
    fail('requires each of --review, --decision and --receipt exactly once');
  }
  return Object.freeze({
    review: supplied.get('--review'),
    decision: supplied.get('--decision'),
    receipt: supplied.get('--receipt'),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function readJsonFile(absolutePath, field) {
  if (!existsSync(absolutePath)) fail(`missing ${field}: ${repositoryPath(absolutePath)}`);
  const bytes = readFileSync(absolutePath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(`${field} is not valid JSON: ${error.message}`);
  }
  return { bytes, value };
}

function requireDigest(value, field) {
  if (!/^[0-9a-f]{64}$/.test(value || '')) fail(`${field} is not sha256`);
  return value;
}

function requireExactKeys(value, expected, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    fail(`${field} fields drift`);
  }
}

function fileBinding(name) {
  const schema = OUTPUT_SCHEMAS[name];
  if (!schema) fail(`unknown M1 output ${name}`);
  const absolutePath = resolve(MIGRATION_ROOT, 'prototype/m1', name);
  const { bytes, value } = readJsonFile(absolutePath, name);
  if (value?.schema_version !== schema) fail(`${name} schema drift`);
  return Object.freeze({
    name,
    path: repositoryPath(absolutePath),
    schema_version: schema,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  });
}

function evidenceBindings() {
  return EVIDENCE_OUTPUT_NAMES.map(fileBinding);
}

function exactBindings(actual, expected, field) {
  if (!Array.isArray(actual)
    || canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${field} do not match the repository bytes`);
  }
}

function exactChecks(actual, names, field) {
  if (!Array.isArray(actual)
    || actual.length !== names.length
    || actual.some((check, index) =>
      check?.check !== names[index] || check.result !== 'PASS')) {
    fail(`${field} must contain the exact approved checks in order`);
  }
}

function unsignedDecisionDigest(decision) {
  const { technical_review: ignored, ...unsigned } = decision;
  return contentId(UNSIGNED_DECISION_DOMAIN, {
    ...unsigned,
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
  });
}

function validateDecision(decision, review) {
  if (decision.schema_version !== DECISION_SCHEMA
    || decision.stage !== 'M1'
    || !['REVIEW_PENDING_DRAFT', 'SEALED'].includes(decision.lifecycle_state)) {
    fail('decision lifecycle or schema drift');
  }
  if (decision.base_commit !== review.base_commit
    || decision.proposed_decision !== 'INCREMENTAL_RESTRUCTURE') {
    fail('decision base or proposed decision drift');
  }
  const acceptance = decision.acceptance;
  if (!acceptance || typeof acceptance !== 'object' || Array.isArray(acceptance)
    || Object.keys(acceptance).length === 0
    || Object.values(acceptance).some((value) => value !== true)) {
    fail('every decision acceptance must be true');
  }
  if (decision.m2_authorised !== false
    || decision.publication_authorisation !== 'NONE') {
    fail('decision M2 and publication authority must remain off');
  }
  const digest = unsignedDecisionDigest(decision);
  requireDigest(decision.technical_review?.unsigned_decision_payload_digest,
    'decision technical-review unsigned digest');
  if (decision.technical_review.unsigned_decision_payload_digest !== digest
    || review.unsigned_decision_payload_digest !== digest) {
    fail('unsigned decision payload digest drift');
  }
  if (decision.lifecycle_state === 'REVIEW_PENDING_DRAFT'
    && decision.technical_review.status !== 'PENDING_SOL_REVIEW') {
    fail('draft decision technical review is not pending');
  }
  return digest;
}

function validateReview(review, actualEvidenceBindings) {
  const draftHasFinalPlaceholders = review.lifecycle_state === 'REVIEW_PENDING_FINAL_BINDINGS'
    && (Object.hasOwn(review, 'review_id') || Object.hasOwn(review, 'output_set_digest'));
  const allowedFields = review.lifecycle_state === 'SEALED' || draftHasFinalPlaceholders
    ? [...REVIEW_CORE_FIELDS, 'review_id', 'output_set_digest']
    : REVIEW_CORE_FIELDS;
  requireExactKeys(review, allowedFields, 'Sol review');
  if (review.schema_version !== REVIEW_SCHEMA
    || !['REVIEW_PENDING_FINAL_BINDINGS', 'SEALED'].includes(review.lifecycle_state)
    || review.stage !== 'M1'
    || review.packet_id !== PACKET_ID
    || !/^[0-9a-f]{40}$/.test(review.base_commit || '')
    || review.reviewer?.role !== 'SOL'
    || typeof review.reviewer?.identity !== 'string'
    || review.reviewer.identity.length === 0
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'INCREMENTAL_RESTRUCTURE') {
    fail('Sol review approval contract drift');
  }
  requireDigest(review.unsigned_decision_payload_digest,
    'Sol review unsigned decision payload digest');
  exactChecks(review.focused_checks, REVIEW_CHECKS, 'Sol review focused_checks');
  if (!Array.isArray(review.exceptions) || review.exceptions.length !== 0) {
    fail('Sol review exceptions must be empty');
  }
  if (review.lifecycle_state === 'REVIEW_PENDING_FINAL_BINDINGS') {
    if (draftHasFinalPlaceholders
      && (review.review_id !== null || review.output_set_digest !== null)) {
      fail('draft Sol review final-binding placeholders must be null');
    }
    exactBindings(review.output_bindings, actualEvidenceBindings,
      'Sol review eight-output bindings');
  }
}

function validateReceipt(receipt, review) {
  if (receipt.schema_version !== RECEIPT_SCHEMA
    || receipt.lifecycle_state !== 'REVIEW_PENDING_DRAFT'
      && receipt.lifecycle_state !== 'SEALED'
    || receipt.stage !== 'M1'
    || receipt.packet_id !== PACKET_ID
    || receipt.base_commit !== review.base_commit) {
    fail('receipt lifecycle, schema or packet drift');
  }
  if (receipt.publication_authorisation !== 'NONE'
    || receipt.database_target !== 'NONE'
    || receipt.internal_cutover_authorisation !== 'NONE') {
    fail('receipt authority must remain report-only');
  }
  for (const field of ZERO_AUTHORITY_FIELDS) {
    if (receipt[field] !== 0) fail(`receipt ${field} must remain zero`);
  }
  if (!Array.isArray(receipt.expected_differences)
    || receipt.expected_differences.length !== 0
    || !Array.isArray(receipt.unexpected_differences)
    || receipt.unexpected_differences.length !== 0) {
    fail('receipt difference ledgers must remain empty');
  }
  const m0Bytes = readJsonFile(M0_RECEIPT, 'M0 receipt').bytes;
  if (receipt.input_digests?.m0_receipt !== sha256Hex(m0Bytes)) {
    fail('receipt does not bind the M0 receipt');
  }
  if (receipt.lifecycle_state === 'REVIEW_PENDING_DRAFT') {
    if (receipt.status !== 'STOPPED') fail('draft receipt status must be STOPPED');
    const expectedDraftChecks = RECEIPT_CHECKS.map((check, index) => ({
      check,
      result: index < 2 ? 'PASS' : 'NOT_RUN',
    }));
    if (canonicalJson(receipt.focused_checks) !== canonicalJson(expectedDraftChecks)) {
      fail('draft receipt focused checks drift');
    }
  }
}

function finalDecision(decision, review, unsignedDigest) {
  return Object.freeze({
    ...clone(decision),
    lifecycle_state: 'SEALED',
    technical_review: {
      status: 'SIGNED_APPROVED',
      reviewer: clone(review.reviewer),
      review_evidence_path: REVIEW_REPOSITORY_PATH,
      unsigned_decision_payload_digest: unsignedDigest,
    },
  });
}

function finalReview(review, outputBindings, outputSetDigest) {
  const {
    lifecycle_state: ignoredLifecycle,
    review_id: ignoredReviewId,
    output_bindings: ignoredBindings,
    output_set_digest: ignoredSetDigest,
    ...reviewCore
  } = clone(review);
  const payload = {
    ...reviewCore,
    lifecycle_state: 'SEALED',
    output_bindings: clone(outputBindings),
    output_set_digest: outputSetDigest,
  };
  return Object.freeze({
    ...payload,
    review_id: contentId(REVIEW_SCHEMA, payload),
  });
}

function reviewBinding(reviewBytes) {
  return Object.freeze({
    path: REVIEW_REPOSITORY_PATH,
    schema_version: REVIEW_SCHEMA,
    byte_length: reviewBytes.length,
    sha256: sha256Hex(reviewBytes),
  });
}

function finalReceipt(receipt, outputBindings, outputSetDigest, technicalReviewBinding) {
  if (!Array.isArray(receipt.changed_files)) fail('receipt changed_files must be an array');
  const changedFiles = [...receipt.changed_files];
  if (!changedFiles.includes(REVIEW_REPOSITORY_PATH)) changedFiles.push(REVIEW_REPOSITORY_PATH);
  if (new Set(changedFiles).size !== changedFiles.length) fail('receipt changed_files contain duplicates');
  return Object.freeze({
    ...clone(receipt),
    lifecycle_state: 'SEALED',
    changed_files: changedFiles,
    focused_checks: RECEIPT_CHECKS.map((check) => ({ check, result: 'PASS' })),
    output_bindings: clone(outputBindings),
    output_set_digest: outputSetDigest,
    technical_review_binding: clone(technicalReviewBinding),
    status: 'PASS',
  });
}

function atomicReplace(absolutePath, expectedBytes, value, field) {
  const nextBytes = canonicalBytes(value);
  const currentBytes = readFileSync(absolutePath);
  if (currentBytes.equals(nextBytes)) return false;
  if (!currentBytes.equals(expectedBytes)) fail(`${field} changed during finalisation`);

  const temporaryPath = join(
    dirname(absolutePath),
    `.${basename(absolutePath)}.tmp-${process.pid}-${randomUUID()}`,
  );
  try {
    writeFileSync(temporaryPath, nextBytes, { encoding: null, flag: 'wx' });
    const rechecked = readFileSync(absolutePath);
    if (!rechecked.equals(expectedBytes)) fail(`${field} changed before atomic replacement`);
    renameSync(temporaryPath, absolutePath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  const reviewFile = readJsonFile(args.review, 'Sol review');
  const decisionFile = readJsonFile(args.decision, 'decision');
  const receiptFile = readJsonFile(args.receipt, 'receipt');
  const eightBindings = evidenceBindings();

  validateReview(reviewFile.value, eightBindings);
  validateReceipt(receiptFile.value, reviewFile.value);
  const unsignedDigest = validateDecision(decisionFile.value, reviewFile.value);

  if (decisionFile.value.lifecycle_state === 'REVIEW_PENDING_DRAFT') {
    if (reviewFile.value.lifecycle_state !== 'REVIEW_PENDING_FINAL_BINDINGS'
      || receiptFile.value.lifecycle_state !== 'REVIEW_PENDING_DRAFT') {
      fail('invalid partial state before decision finalisation');
    }
    atomicReplace(
      args.decision,
      decisionFile.bytes,
      finalDecision(decisionFile.value, reviewFile.value, unsignedDigest),
      'decision',
    );
  }

  const sealedDecisionFile = readJsonFile(args.decision, 'sealed decision');
  const expectedDecision = finalDecision(
    sealedDecisionFile.value,
    reviewFile.value,
    unsignedDigest,
  );
  if (canonicalJson(sealedDecisionFile.value) !== canonicalJson(expectedDecision)) {
    fail('sealed decision differs from the authorised transition');
  }

  const nineBindings = [...eightBindings, fileBinding('decision.json')];
  if (nineBindings.map((binding) => binding.name).join('\n') !== ALL_OUTPUT_NAMES.join('\n')) {
    fail('final output binding order drift');
  }
  const outputSetDigest = contentId(OUTPUT_SET_DOMAIN, nineBindings);
  const expectedReview = finalReview(reviewFile.value, nineBindings, outputSetDigest);

  if (reviewFile.value.lifecycle_state === 'REVIEW_PENDING_FINAL_BINDINGS') {
    if (receiptFile.value.lifecycle_state !== 'REVIEW_PENDING_DRAFT') {
      fail('receipt cannot be sealed before the Sol review');
    }
    atomicReplace(args.review, reviewFile.bytes, expectedReview, 'Sol review');
  } else if (canonicalJson(reviewFile.value) !== canonicalJson(expectedReview)) {
    fail('sealed Sol review differs from the authorised transition');
  }

  const sealedReviewFile = readJsonFile(args.review, 'sealed Sol review');
  const technicalReviewBinding = reviewBinding(sealedReviewFile.bytes);
  const expectedReceipt = finalReceipt(
    receiptFile.value,
    nineBindings,
    outputSetDigest,
    technicalReviewBinding,
  );

  if (receiptFile.value.lifecycle_state === 'REVIEW_PENDING_DRAFT') {
    atomicReplace(args.receipt, receiptFile.bytes, expectedReceipt, 'receipt');
  } else if (canonicalJson(receiptFile.value) !== canonicalJson(expectedReceipt)) {
    fail('sealed receipt differs from the authorised transition');
  }

  process.stdout.write(`${canonicalJson({
    status: 'PASS',
    lifecycle_state: 'SEALED',
    decision: fileBinding('decision.json'),
    technical_review_binding: reviewBinding(readFileSync(args.review)),
    output_set_digest: outputSetDigest,
    receipt: {
      path: repositoryPath(args.receipt),
      byte_length: readFileSync(args.receipt).length,
      sha256: sha256Hex(readFileSync(args.receipt)),
    },
  })}\n`);
}

main();
