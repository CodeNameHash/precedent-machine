#!/usr/bin/env node

// Validates one Stage 2Y migration receipt. This command is read-only.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { listRegisteredSectionFamilies } = require(
  '../lib/canonical-v2/native-producer/producer-prompt-registry',
);

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
