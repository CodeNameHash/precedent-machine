#!/usr/bin/env node

// Seals the M4 receipt only after the independent Sol review passes.

import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const EXPECTED = Object.freeze({
  draft: resolve(ROOT, 'receipts/stage-2y-structure-m4-agreement-analysis-draft.json'),
  review: resolve(ROOT, 'reviews/stage-2y-structure-m4-sol-technical-review.json'),
  final: resolve(ROOT, 'receipts/stage-2y-structure-m4-agreement-analysis.json'),
  authority: resolve(ROOT, 'control/m4-authority.json'),
  policy: resolve(ROOT, 'control/analysis-policy.json'),
  m2: resolve(ROOT, 'receipts/stage-2y-structure-m2-agreement-index.json'),
  m3: resolve(ROOT, 'receipts/stage-2y-structure-m3-context-compilation.json'),
});
const ACTIVE = Object.freeze({
  agreement_analysis_module: resolve(REPO_ROOT, 'lib/canonical-v2/agreement-analysis.js'),
  focused_test: resolve(REPO_ROOT, 'tests/stage-2y-structure-analysis-shadow.test.js'),
  shadow_runner: resolve(REPO_ROOT, 'scripts/stage-2y-structure-analysis-shadow.mjs'),
  finaliser: fileURLToPath(import.meta.url),
  validator: resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs'),
});
const CHECKS = Object.freeze([
  'TRUST_ROOT_CHAIN',
  'OUTPUT_SCHEMA_IDENTITY_AND_ORDER',
  'LEGACY_CLAIM_IDENTITY_AND_STAGE_IDS',
  'EVIDENCE_BYTE_RECONSTRUCTION',
  'METSERA_COMPLETE_PROPOSITION_AND_ROLE_DELETION',
  'FIELD_LEVEL_DIFF_AND_OPEN_WORLD',
  'REPOSITORY_ROUND_TRIP',
  'ZERO_EFFECT_AND_CHANGED_FILE_SCOPE',
]);
const AUTHORITY_SHA = 'adeb24bf047a5fb462a71b6b5a0994d3ca88bdfab48d66ce6f7a8d8a51b4bc0f';
const AUTHORITY_DIGEST = 'b97a2e78617813d4806fb755c841dabbb7b88c62a13fb37a43eb148057088f60';
const POLICY_SHA = '2ac70b72546cb8acb8bb2e031368c7128e2ccad659c1cf1ec1fc6042b53c7927';
const POLICY_DIGEST = 'c4e0f233d7e247ebe348b811fa774d07a7618b8501859039b73cb4c931d014cd';
const FULL_REVIEW_SHA = '40f4291e953c9d0abb2ee537a1169ba4e45769c0277c310b4cfe2f55e7f7b262';
const FULL_REVIEW_ID = '193a2cb061e0d382b4f1c9de633eeb279a89d36e1f95fee417ee4f0067b96b65';
const REVIEW_FIELDS = Object.freeze([
  'schema_version', 'review_id', 'packet_id', 'stage', 'base_commit', 'lifecycle_state',
  'status', 'verdict', 'technical_decision', 'reviewer', 'draft_receipt_binding',
  'authority_binding', 'analysis_policy_binding', 'predecessor_receipt_bindings',
  'agreement_manifest_binding', 'control_manifest_binding', 'current_state_bindings',
  'implementation_bindings', 'output_bindings', 'resolution_set_diff_binding',
  'output_set_digest', 'metrics', 'focused_checks', 'exceptions',
]);

function fail(code, message) { throw new Error(`STAGE_2Y_M4_FINALISE:${code}: ${message}`); }
function repoPath(value) {
  const output = relative(REPO_ROOT, value).split('\\').join('/');
  if (!output || output.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', value);
  return output;
}
function exactPath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) fail('INVALID_PATH', String(value));
  const output = resolve(REPO_ROOT, value); repoPath(output); return output;
}
function assertNoSymlink(value) {
  let cursor = REPO_ROOT;
  for (const part of repoPath(value).split('/')) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK', repoPath(cursor));
  }
}
function bytes(value) { assertNoSymlink(value); if (!existsSync(value)) fail('MISSING_FILE', repoPath(value)); return readFileSync(value); }
function json(value) { try { return JSON.parse(bytes(value)); } catch (error) { fail('INVALID_JSON', error.message); } }
function binding(value, extra = {}) { const data = bytes(value); return { path: repoPath(value), byte_length: data.length, sha256: sha256Hex(data), ...extra }; }
function parse(argv) {
  const names = ['draft-receipt', 'review', 'final-receipt'];
  if (argv.length !== 6) fail('INVALID_ARGUMENT_COUNT', argv.length);
  const output = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].startsWith('--') ? argv[i].slice(2) : '';
    if (!names.includes(key) || output[key]) fail('INVALID_ARGUMENT', argv[i]);
    output[key] = exactPath(argv[i + 1]);
  }
  const expected = { 'draft-receipt': EXPECTED.draft, review: EXPECTED.review, 'final-receipt': EXPECTED.final };
  for (const [key, value] of Object.entries(expected)) if (output[key] !== value) fail('PATH_DRIFT', key);
  return output;
}
function changedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}
function same(a, b, label) { if (canonicalJson(a) !== canonicalJson(b)) fail('VALUE_DRIFT', label); }
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail('KEY_SET_DRIFT', label);
  }
}
function digestWithout(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return sha256Hex(canonicalJson(copy));
}
function verifyPredecessor(path, stage, expectedSha) {
  const receipt = json(path);
  if (binding(path).sha256 !== expectedSha || receipt.stage !== stage || receipt.status !== 'PASS' || receipt.lifecycle_state !== 'SEALED') fail('PREDECESSOR_DRIFT', stage);
  for (const output of receipt.output_bindings) {
    const actual = binding(exactPath(output.path));
    if (actual.byte_length !== output.byte_length || actual.sha256 !== output.sha256) fail('PREDECESSOR_OUTPUT_DRIFT', output.path);
  }
  if (sha256Hex(canonicalJson(receipt.output_bindings)) !== receipt.output_set_digest) fail('PREDECESSOR_SET_DRIFT', stage);
}
function validate(draft, review, authority) {
  const policy = json(EXPECTED.policy);
  if (binding(EXPECTED.authority).sha256 !== AUTHORITY_SHA
    || authority.authority_digest !== AUTHORITY_DIGEST
    || digestWithout(authority, 'authority_digest') !== AUTHORITY_DIGEST
    || binding(EXPECTED.policy).sha256 !== POLICY_SHA
    || policy.policy_digest !== POLICY_DIGEST
    || digestWithout(policy, 'policy_digest') !== POLICY_DIGEST
    || authority.bindings.analysis_policy.sha256 !== POLICY_SHA
    || authority.bindings.analysis_policy.policy_digest !== POLICY_DIGEST
    || authority.bindings.full_contract_review.sha256 !== FULL_REVIEW_SHA
    || authority.bindings.full_contract_review.review_id !== FULL_REVIEW_ID) {
    fail('CONTROL_TRUST_ROOT_DRIFT', 'M4 authority, policy or full-contract review');
  }
  const fullReview = json(exactPath(authority.bindings.full_contract_review.path));
  if (binding(exactPath(authority.bindings.full_contract_review.path)).sha256 !== FULL_REVIEW_SHA
    || fullReview.review_id !== FULL_REVIEW_ID
    || contentId(fullReview.schema_version, Object.fromEntries(
      Object.entries(fullReview).filter(([key]) => key !== 'review_id'),
    )) !== FULL_REVIEW_ID) fail('FULL_CONTRACT_REVIEW_DRIFT', 'identity');
  if (draft.schema_version !== 'STAGE_2Y_STRUCTURE_M4_DRAFT_RECEIPT/V1' || draft.stage !== 'M4'
    || draft.lifecycle_state !== 'REVIEW_PENDING_DRAFT' || draft.status !== 'STOPPED'
    || draft.technical_review !== 'PENDING_SOL_REVIEW' || draft.output_bindings.length !== 8
    || draft.metrics.analysis_claim_count !== 1528 || draft.metrics.complete_claim_count !== 2
    || draft.unexpected_differences.length !== 0) fail('INVALID_DRAFT', 'state or metrics');
  if (review.schema_version !== 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1' || review.stage !== 'M4'
    || review.packet_id !== 'stage-2y-structure-m4-agreement-analysis'
    || review.base_commit !== 'b5f1d5b1f7641d94fe63dbfb0d0400b4b5b3751a'
    || review.lifecycle_state !== 'SEALED' || review.status !== 'APPROVED' || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'AGREEMENT_ANALYSIS_M4_ACCEPTED'
    || canonicalJson(review.reviewer) !== canonicalJson({ identity: 'gpt-5.6-sol:xhigh:stage-2y-m4-technical-review', role: 'SOL' })
    || review.exceptions.length !== 0) fail('INVALID_REVIEW', 'state');
  exactKeys(review, REVIEW_FIELDS, 'technical review');
  if (review.review_id !== contentId(review.schema_version, Object.fromEntries(
    Object.entries(review).filter(([key]) => key !== 'review_id'),
  ))) fail('INVALID_REVIEW_ID', review.review_id);
  same(review.draft_receipt_binding, binding(EXPECTED.draft, { schema_version: draft.schema_version }), 'review draft');
  same(review.authority_binding, draft.authority_binding, 'review authority');
  same(review.analysis_policy_binding, draft.analysis_policy_binding, 'review policy');
  same(review.predecessor_receipt_bindings, draft.predecessor_receipt_bindings, 'review predecessors');
  same(review.agreement_manifest_binding, draft.agreement_manifest_binding, 'review agreement manifest');
  same(review.control_manifest_binding, draft.control_manifest_binding, 'review control manifest');
  same(review.current_state_bindings, draft.current_state_bindings, 'review current state');
  same(review.resolution_set_diff_binding, draft.resolution_set_diff_binding, 'review diff');
  same(review.resolution_set_diff_binding, review.output_bindings[7], 'review diff output');
  same(review.output_bindings, draft.output_bindings, 'review outputs');
  same(review.metrics, draft.metrics, 'review metrics');
  if (review.output_set_digest !== draft.output_set_digest) fail('VALUE_DRIFT', 'review output set');
  exactKeys(review.implementation_bindings, Object.keys(ACTIVE), 'review implementations');
  for (const [name, path] of Object.entries(ACTIVE)) {
    same(review.implementation_bindings[name], binding(path), `review implementation ${name}`);
  }
  const names = review.focused_checks.map((row) => row.check);
  if (canonicalJson(names) !== canonicalJson(CHECKS) || review.focused_checks.some((row) => row.result !== 'PASS')) fail('INVALID_REVIEW_CHECKS', names.join(','));
  if (draft.authority_binding.sha256 !== binding(EXPECTED.authority).sha256
    || draft.analysis_policy_binding.sha256 !== binding(EXPECTED.policy).sha256) fail('CONTROL_BINDING_DRIFT', 'draft');
  verifyPredecessor(EXPECTED.m2, 'M2', 'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585');
  verifyPredecessor(EXPECTED.m3, 'M3', '5c74647f0c35eadcde48f50ac3f14d2df287eca92122fb79240d4b9d8af67855');
  for (const output of draft.output_bindings) {
    const actual = binding(exactPath(output.path));
    if (actual.byte_length !== output.byte_length || actual.sha256 !== output.sha256) fail('OUTPUT_DRIFT', output.path);
  }
  if (sha256Hex(canonicalJson(draft.output_bindings)) !== draft.output_set_digest) fail('OUTPUT_SET_DRIFT', draft.output_set_digest);
  const prospective = [...changedFiles(), repoPath(EXPECTED.final)].sort();
  const allowed = [...authority.permitted_changed_files].sort();
  if (canonicalJson(prospective) !== canonicalJson(allowed)) fail('CHANGED_FILE_SCOPE', prospective.join(','));
  for (const current of Object.values(authority.current_state_bindings)) {
    const actual = binding(exactPath(current.path));
    if (actual.byte_length !== current.byte_length || actual.sha256 !== current.sha256) fail('CURRENT_STATE_DRIFT', current.path);
  }
}
function main() {
  parse(process.argv.slice(2));
  if (existsSync(EXPECTED.final)) fail('FINAL_ALREADY_EXISTS', repoPath(EXPECTED.final));
  const draft = json(EXPECTED.draft);
  const review = json(EXPECTED.review);
  const authority = json(EXPECTED.authority);
  validate(draft, review, authority);
  const final = structuredClone(draft);
  final.schema_version = 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1';
  final.lifecycle_state = 'SEALED';
  final.status = 'PASS';
  delete final.technical_review;
  final.draft_receipt_binding = binding(EXPECTED.draft, { schema_version: draft.schema_version });
  final.technical_review_binding = binding(EXPECTED.review, { schema_version: review.schema_version, review_id: review.review_id });
  final.implementation_bindings = Object.fromEntries(Object.entries(ACTIVE).map(([key, value]) => [key, binding(value)]));
  final.focused_checks = [...draft.focused_checks, { check: 'SOL_TECHNICAL_REVIEW', result: 'PASS' }];
  const data = Buffer.from(`${canonicalJson(final)}\n`, 'utf8');
  writeFileSync(EXPECTED.final, data, { flag: 'wx' });
  process.stdout.write(`${canonicalJson({ stage: 'M4', status: 'PASS', lifecycle_state: 'SEALED', output_set_digest: final.output_set_digest, final_receipt: repoPath(EXPECTED.final) })}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
export { validate };
