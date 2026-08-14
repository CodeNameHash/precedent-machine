#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes.js');

const STAGE = 'M7_V2_REPAIR_WORK0';
const BASE_COMMIT = 'b78a2b8c1f25b78f35116d2620c491b69215d0b6';
const MANIFEST_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-pre-work0-evidence-input-manifest.json';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work0-bootstrap-authority.json';

const EXPECTED_MANIFEST = Object.freeze({
  path: MANIFEST_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_PRE_WORK0_EVIDENCE_INPUT_MANIFEST/V1',
  byte_length: 40307,
  sha256: '5a6608c9b05571557c08507c0c11ac415108b671c0eea91777b410c2e9ae0af7',
  manifest_id: '98aa64006364072d38cf6ccd4e0d26e6f343875d6fbe105bd6d31348c60923b6',
});

const EXPECTED_AUTHORITY = Object.freeze({
  path: AUTHORITY_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK0_BOOTSTRAP_AUTHORITY/V1',
  byte_length: 19241,
  sha256: '7bb1396792d1893ed4ecd3c28ab6610697674344fac8fb37f3ee01fba26256ec',
  authority_id: '6be158afbf7bb5f98197005ba42c8ede1359d604bdd03c93f0949841dfacf2f5',
});

const VERBATIM_CONFIRMATION = 'On 2026-08-14, I confirm for Work 0 only: authority path evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work0-bootstrap-authority.json, schema STAGE_2Y_M7_V2_REPAIR_WORK0_BOOTSTRAP_AUTHORITY/V1, 19241 bytes, SHA-256 7bb1396792d1893ed4ecd3c28ab6610697674344fac8fb37f3ee01fba26256ec, ID 6be158afbf7bb5f98197005ba42c8ede1359d604bdd03c93f0949841dfacf2f5; manifest path evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-pre-work0-evidence-input-manifest.json, schema STAGE_2Y_M7_V2_REPAIR_PRE_WORK0_EVIDENCE_INPUT_MANIFEST/V1, 40307 bytes, SHA-256 5a6608c9b05571557c08507c0c11ac415108b671c0eea91777b410c2e9ae0af7, ID 98aa64006364072d38cf6ccd4e0d26e6f343875d6fbe105bd6d31348c60923b6.';

const ACTIVATION_CONFIRMATION = Object.freeze({
  state: 'CONFIRMED_WORK0_ONLY',
  approver: 'BEN_GOODCHILD',
  confirmed_on: '2026-08-14',
  verbatim_confirmation: VERBATIM_CONFIRMATION,
  authority_binding: Object.freeze({ ...EXPECTED_AUTHORITY }),
  manifest_binding: Object.freeze({ ...EXPECTED_MANIFEST }),
});

const OUTPUTS = Object.freeze([
  Object.freeze({
    key: 'fixed_sample_identity_manifest',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_FIXED_SAMPLE_IDENTITY_MANIFEST/V1',
    id_field: 'fixed_sample_identity_manifest_id',
  }),
  Object.freeze({
    key: 'repair_baseline_ledger',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-baseline-ledger.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_BASELINE_LEDGER/V1',
    id_field: 'repair_baseline_ledger_id',
  }),
  Object.freeze({
    key: 'calibration_question_ruling_map',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-calibration-question-ruling-map.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CALIBRATION_QUESTION_RULING_MAP/V1',
    id_field: 'calibration_question_ruling_map_id',
  }),
  Object.freeze({
    key: 'legacy_output_supersession_ledger',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-legacy-output-supersession-ledger.json',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_LEGACY_OUTPUT_SUPERSESSION_LEDGER/V1',
    id_field: 'legacy_output_supersession_ledger_id',
  }),
]);

const REPAIR_CLASS_LABELS = Object.freeze(new Map([
  ['Material meaning omitted or hidden', 'MATERIAL_MEANING_OMITTED_OR_HIDDEN'],
  ['Classification or semantic-depth failure', 'CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE'],
  ['Source artefact', 'SOURCE_ARTEFACT'],
  ['False parser ambiguity', 'FALSE_PARSER_AMBIGUITY'],
  ['Approved no-comparison', 'APPROVED_NO_COMPARISON'],
  ['Clean regression controls', 'CLEAN_CONTROL'],
]));

const FRESH_QUESTION_ORDINALS = Object.freeze(new Set([2, 4, 45]));
const LEGACY_STATE = 'FAILED_HUMAN_REVIEW_NOT_CONSUMABLE';

export class Work0FinalisationError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work0FinalisationError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work0FinalisationError(code, detail);
}

function assert(condition, code, detail = '') {
  if (!condition) fail(code, detail);
}

function omit(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function exact(value, expected) {
  try {
    return canonicalJson(value) === canonicalJson(expected);
  } catch {
    return false;
  }
}

function assertRealPath(absolutePath, allowMissingLeaf = false) {
  const target = allowMissingLeaf && !fs.existsSync(absolutePath)
    ? path.dirname(absolutePath)
    : absolutePath;
  let real;
  try {
    real = fs.realpathSync.native(target);
  } catch {
    fail('PATH_INVALID', absolutePath);
  }
  assert(real === target, 'SYMLINK_PATH_FORBIDDEN', absolutePath);
  if (target === absolutePath) {
    const stat = fs.lstatSync(absolutePath);
    assert(!stat.isSymbolicLink(), 'SYMLINK_PATH_FORBIDDEN', absolutePath);
  }
}

function resolveRepoPath(repoRoot, relativePath) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, 'PATH_INVALID');
  assert(!path.isAbsolute(relativePath) && !relativePath.includes('\0'), 'PATH_INVALID', relativePath);
  const absolute = path.resolve(repoRoot, relativePath);
  const prefix = `${path.resolve(repoRoot)}${path.sep}`;
  assert(absolute.startsWith(prefix), 'PATH_OUTSIDE_REPOSITORY', relativePath);
  assertRealPath(path.resolve(repoRoot));
  assertRealPath(absolute, true);
  return absolute;
}

function readBytes(repoRoot, relativePath, code = 'INPUT_BINDING_DRIFT') {
  const absolute = resolveRepoPath(repoRoot, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    fail(code, relativePath);
  }
  assert(stat.isFile(), code, relativePath);
  return fs.readFileSync(absolute);
}

function entryExists(absolute) {
  try {
    fs.lstatSync(absolute);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    fail('PATH_INVALID', absolute);
  }
}

function findLaterAuthorityEntries(repoRoot, directoryPath) {
  const absoluteDirectory = resolveRepoPath(repoRoot, directoryPath);
  const matches = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const repositoryPath = `${directoryPath}/${entry.name}`;
    if (/m7-v2-repair.*authority.*\.json$/i.test(repositoryPath)
      && repositoryPath !== AUTHORITY_PATH) {
      matches.push(repositoryPath);
      continue;
    }
    if (entry.isDirectory()) {
      matches.push(...findLaterAuthorityEntries(repoRoot, repositoryPath));
    }
  }
  return matches;
}

function parseJson(bytes, code, detail) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, detail);
  }
}

function parseCanonicalRecord(repoRoot, expected, idField, digestField, code) {
  const bytes = readBytes(repoRoot, expected.path, code);
  assert(bytes.length === expected.byte_length, code, `${expected.path}:byte_length`);
  assert(sha256Hex(bytes) === expected.sha256, code, `${expected.path}:sha256`);
  const record = parseJson(bytes, code, expected.path);
  assert(bytes.toString('utf8') === `${canonicalJson(record)}\n`, code, `${expected.path}:canonical_bytes`);
  assert(record.schema_version === expected.schema_version, code, `${expected.path}:schema_version`);
  assert(record[idField] === expected[idField], code, `${expected.path}:${idField}`);
  if (digestField) {
    const calculatedDigest = sha256Hex(Buffer.from(canonicalJson(omit(record, [idField, digestField])), 'utf8'));
    assert(record[digestField] === calculatedDigest, code, `${expected.path}:${digestField}`);
  }
  assert(record[idField] === contentId(record.schema_version, omit(record, [idField])), code, `${expected.path}:${idField}:self_identity`);
  return { bytes, record };
}

function git(repoRoot, args, code) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: null,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail(code, args.join(' '));
  }
}

function verifyRepository(repoRoot, authority, write) {
  const topLevel = git(repoRoot, ['rev-parse', '--show-toplevel'], 'REPOSITORY_INVALID').toString('utf8').trim();
  assert(path.resolve(topLevel) === path.resolve(repoRoot), 'REPOSITORY_INVALID', 'repoRoot');
  assert(authority.base_commit === BASE_COMMIT, 'BASE_COMMIT_MISMATCH');
  git(repoRoot, ['rev-parse', '--verify', `${BASE_COMMIT}^{commit}`], 'BASE_COMMIT_MISMATCH');

  if (!write) return [];

  const head = git(repoRoot, ['rev-parse', 'HEAD'], 'BASE_COMMIT_MISMATCH').toString('utf8').trim();
  assert(head === BASE_COMMIT, 'BASE_COMMIT_MISMATCH');

  const staged = git(repoRoot, ['diff', '--cached', '--name-only', '-z'], 'STAGED_INDEX_NOT_EMPTY');
  assert(staged.length === 0, 'STAGED_INDEX_NOT_EMPTY');

  const allowed = new Set([
    ...authority.pre_work0_candidate_paths,
    ...authority.permitted_changed_paths,
  ]);
  const status = git(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'DIRTY_PATH_NOT_AUTHORISED');
  const entries = status.toString('utf8').split('\0').filter(Boolean);
  const dirtyPaths = [];
  for (const entry of entries) {
    assert(entry.length >= 4, 'DIRTY_PATH_NOT_AUTHORISED', entry);
    const statusCode = entry.slice(0, 2);
    const relativePath = entry.slice(3);
    assert(statusCode === '??' || statusCode === ' M', 'DIRTY_PATH_NOT_AUTHORISED', `${statusCode}:${relativePath}`);
    assert(allowed.has(relativePath), 'DIRTY_PATH_NOT_AUTHORISED', relativePath);
    dirtyPaths.push(relativePath);
  }
  for (const candidatePath of authority.pre_work0_candidate_paths) {
    assert(dirtyPaths.includes(candidatePath), 'DIRTY_PATH_NOT_AUTHORISED', `${candidatePath}:candidate_not_dirty`);
  }

  const controlTree = git(repoRoot, [
    'ls-tree', '-r', '--name-only', BASE_COMMIT, '--',
    'evidence/canonical-v2/stage-2y-structure-migration/control',
  ], 'WORK1_AUTHORITY_PRESENT').toString('utf8');
  const forbidden = controlTree.split('\n').filter(Boolean).filter((value) => (
    /m7-v2-repair.*authority.*\.json$/i.test(value) && value !== AUTHORITY_PATH
  ));
  assert(forbidden.length === 0, 'WORK1_AUTHORITY_PRESENT', forbidden.join(','));

  const currentAuthorities = findLaterAuthorityEntries(
    repoRoot,
    'evidence/canonical-v2/stage-2y-structure-migration/control',
  );
  assert(currentAuthorities.length === 0, 'WORK1_AUTHORITY_PRESENT', currentAuthorities.join(','));

  const receiptPath = authority.intended_evidence_root.path;
  assert(!entryExists(resolveRepoPath(repoRoot, receiptPath)), 'EVIDENCE_ROOT_ALREADY_EXISTS', receiptPath);
  return dirtyPaths;
}

function verifyInputBindings(repoRoot, manifest) {
  assert(manifest.adopted_plan_commit === BASE_COMMIT, 'MANIFEST_INVALID', 'adopted_plan_commit');
  assert(manifest.constraints?.direct_binding_count === 73, 'MANIFEST_INVALID', 'direct_binding_count');
  assert(Array.isArray(manifest.input_bindings) && manifest.input_bindings.length === 73, 'MANIFEST_INVALID', 'input_bindings');
  assert(manifest.input_set_digest === sha256Hex(Buffer.from(canonicalJson(manifest.input_bindings), 'utf8')), 'MANIFEST_INVALID', 'input_set_digest');
  assert(manifest.constraints.work0_only === true, 'MANIFEST_INVALID', 'work0_only');
  assert(manifest.constraints.work1_7_authorised === false, 'MANIFEST_INVALID', 'work1_7_authorised');
  assert(manifest.constraints.m8_authorised === false, 'MANIFEST_INVALID', 'm8_authorised');
  assert(manifest.constraints.v1_semantic_admission === 'FORBIDDEN', 'MANIFEST_INVALID', 'v1_semantic_admission');

  const byPath = new Map();
  const byRole = new Map();
  for (let index = 0; index < manifest.input_bindings.length; index += 1) {
    const binding = manifest.input_bindings[index];
    assert(binding.ordinal === index + 1, 'MANIFEST_INVALID', `ordinal:${binding.ordinal}`);
    assert(binding.binding_source === 'ADOPTED_PLAN_COMMIT_BLOB', 'MANIFEST_INVALID', `${binding.path}:binding_source`);
    assert(binding.v2_admissible === false, 'MANIFEST_INVALID', `${binding.path}:v2_admissible`);
    assert(!byPath.has(binding.path), 'MANIFEST_INVALID', `${binding.path}:duplicate`);
    resolveRepoPath(repoRoot, binding.path);
    const committed = git(repoRoot, ['show', `${BASE_COMMIT}:${binding.path}`], 'INPUT_BINDING_DRIFT');
    assert(committed.length === binding.byte_length, 'INPUT_BINDING_DRIFT', `${binding.path}:byte_length`);
    assert(sha256Hex(committed) === binding.sha256, 'INPUT_BINDING_DRIFT', `${binding.path}:sha256`);
    let json = null;
    if (binding.path.endsWith('.json')) {
      json = parseJson(committed, 'INPUT_BINDING_DRIFT', binding.path);
      assert(json.schema_version === binding.schema_version, 'INPUT_BINDING_DRIFT', `${binding.path}:schema_version`);
      if (binding.record_id_field) {
        assert(json[binding.record_id_field] === binding.record_id, 'INPUT_BINDING_DRIFT', `${binding.path}:${binding.record_id_field}`);
      }
    }
    const value = { binding, bytes: committed, json };
    byPath.set(binding.path, value);
    if (!byRole.has(binding.role)) byRole.set(binding.role, []);
    byRole.get(binding.role).push(value);
  }
  return { byPath, byRole };
}

function requireRole(inputs, role, count = 1) {
  const values = inputs.byRole.get(role) || [];
  assert(values.length === count, 'MANIFEST_INVALID', `${role}:${values.length}`);
  return count === 1 ? values[0] : values;
}

function inputBinding(value) {
  const binding = value.binding;
  return {
    path: binding.path,
    schema_version: binding.schema_version,
    record_id_field: binding.record_id_field,
    record_id: binding.record_id,
    byte_length: binding.byte_length,
    sha256: binding.sha256,
  };
}

function knownBinding(expected, idField) {
  return {
    path: expected.path,
    schema_version: expected.schema_version,
    record_id_field: idField,
    record_id: expected[idField],
    byte_length: expected.byte_length,
    sha256: expected.sha256,
  };
}

export function validateActivationConfirmation({ authority, manifest, confirmation }) {
  assert(authority && typeof authority === 'object', 'ACTIVATION_CONFIRMATION_INVALID', 'authority');
  assert(manifest && typeof manifest === 'object', 'ACTIVATION_CONFIRMATION_INVALID', 'manifest');
  assert(authority.schema_version === EXPECTED_AUTHORITY.schema_version, 'ACTIVATION_CONFIRMATION_INVALID', 'authority_schema');
  assert(authority.authority_id === EXPECTED_AUTHORITY.authority_id, 'ACTIVATION_CONFIRMATION_INVALID', 'authority_id');
  assert(manifest.schema_version === EXPECTED_MANIFEST.schema_version, 'ACTIVATION_CONFIRMATION_INVALID', 'manifest_schema');
  assert(manifest.manifest_id === EXPECTED_MANIFEST.manifest_id, 'ACTIVATION_CONFIRMATION_INVALID', 'manifest_id');
  assert(exact(confirmation, ACTIVATION_CONFIRMATION), 'ACTIVATION_CONFIRMATION_INVALID', 'confirmation');
  assert(authority.authority_state === 'EFFECTIVE_ONLY_AFTER_REQUIRED_ACTIVATION_IS_SATISFIED_AND_PERSISTED', 'ACTIVATION_CONFIRMATION_INVALID', 'authority_state');
  assert(authority.required_activation?.scope === 'WORK0_ONLY', 'ACTIVATION_CONFIRMATION_INVALID', 'scope');
  assert(authority.required_activation?.evidence_root_confirmation_record_required?.confirmation_state === 'CONFIRMED_WORK0_ONLY', 'ACTIVATION_CONFIRMATION_INVALID', 'persistence');
  return true;
}

function sealRecord(definition, body) {
  const unsigned = { schema_version: definition.schema_version, ...body };
  return {
    schema_version: definition.schema_version,
    [definition.id_field]: contentId(definition.schema_version, unsigned),
    ...body,
  };
}

function verifySourceSpan(sourceText, span, code, detail) {
  assert(span?.coordinate_system === 'UTF8_CANONICAL_TEXT_HALF_OPEN', code, `${detail}:coordinate_system`);
  assert(Number.isInteger(span.start_byte) && Number.isInteger(span.end_byte), code, `${detail}:offset`);
  const bytes = Buffer.from(sourceText, 'utf8');
  assert(span.start_byte >= 0 && span.end_byte >= span.start_byte && span.end_byte <= bytes.length, code, `${detail}:range`);
  const selected = bytes.subarray(span.start_byte, span.end_byte);
  assert(sha256Hex(selected) === span.text_sha256, code, `${detail}:text_sha256`);
  return selected;
}

function buildFixedSample(definition, common, inputs) {
  const policyValue = requireRole(inputs, 'LAWYER_SAMPLE_POLICY');
  const packetValue = requireRole(inputs, 'LAWYER_REVIEW_PACKET');
  const ledgerValue = requireRole(inputs, 'LAWYER_DECISION_LEDGER');
  const packet = packetValue.json;
  const ledger = ledgerValue.json;
  assert(packet.sample_size === 50 && packet.items?.length === 50, 'SAMPLE_IDENTITY_INVALID', 'sample_size');
  assert(ledger.decisions?.length === 50, 'SAMPLE_IDENTITY_INVALID', 'decision_count');

  const indexValues = [
    ...requireRole(inputs, 'SAMPLED_SEALED_AGREEMENT_INDEX', 6),
    ...requireRole(inputs, 'SAMPLED_ADDITIVE_AGREEMENT_INDEX', 3),
  ];
  const indexes = new Map();
  for (const value of indexValues) {
    const agreementIndex = value.json;
    const source = agreementIndex.source_binding;
    assert(source?.agreement_id && !indexes.has(source.agreement_id), 'SAMPLE_IDENTITY_INVALID', 'agreement_index');
    assert(Buffer.byteLength(source.canonical_text, 'utf8') === source.canonical_text_byte_length, 'SAMPLE_IDENTITY_INVALID', `${source.agreement_id}:source_length`);
    assert(sha256Hex(Buffer.from(source.canonical_text, 'utf8')) === source.canonical_text_sha256, 'SAMPLE_IDENTITY_INVALID', `${source.agreement_id}:source_sha256`);
    indexes.set(source.agreement_id, { value, agreementIndex });
  }

  const decisionsByOrdinal = new Map(ledger.decisions.map((decision) => [decision.sample_ordinal, decision]));
  const seenReviewItems = new Set();
  let sourceSpanCount = 0;
  const members = packet.items.map((item, index) => {
    const ordinal = index + 1;
    assert(item.sample_ordinal === ordinal, 'SAMPLE_IDENTITY_INVALID', `ordinal:${ordinal}`);
    assert(!seenReviewItems.has(item.review_item_id), 'SAMPLE_IDENTITY_INVALID', `${ordinal}:review_item_id`);
    seenReviewItems.add(item.review_item_id);
    const decision = decisionsByOrdinal.get(ordinal);
    assert(decision?.review_item_id === item.review_item_id, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:decision`);
    const indexed = indexes.get(item.agreement_id);
    assert(indexed, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:agreement_id`);
    const { value, agreementIndex } = indexed;
    const source = agreementIndex.source_binding;
    const nodeById = new Map(agreementIndex.nodes.map((node) => [node.node_occurrence_id, node]));
    const ambiguityById = new Map(agreementIndex.ambiguities.map((ambiguity) => [ambiguity.ambiguity_id, ambiguity]));
    const ambiguityId = item.lineage?.ambiguity_id || null;
    let sourceSpans;
    const selectedSourceBytes = [];
    if (item.item_kind === 'PARSER_AMBIGUITY') {
      assert(item.source_node_occurrence_ids.length === 0 && ambiguityId, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:ambiguity_identity`);
      const ambiguity = ambiguityById.get(ambiguityId);
      assert(ambiguity && exact(ambiguity.span, item.source_span), 'SAMPLE_IDENTITY_INVALID', `${ordinal}:ambiguity_span`);
      selectedSourceBytes.push(verifySourceSpan(
        source.canonical_text,
        item.source_span,
        'SAMPLE_IDENTITY_INVALID',
        `${ordinal}:source_span`,
      ));
      sourceSpans = [{ source_node_occurrence_id: null, ...item.source_span }];
    } else {
      assert(Array.isArray(item.source_node_occurrence_ids) && item.source_node_occurrence_ids.length > 0, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:source_nodes`);
      assert(ambiguityId === null, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:unexpected_ambiguity`);
      sourceSpans = item.source_node_occurrence_ids.map((nodeId) => {
        const node = nodeById.get(nodeId);
        assert(node, 'SAMPLE_IDENTITY_INVALID', `${ordinal}:${nodeId}`);
        selectedSourceBytes.push(verifySourceSpan(
          source.canonical_text,
          node.extent_span,
          'SAMPLE_IDENTITY_INVALID',
          `${ordinal}:${nodeId}`,
        ));
        return { source_node_occurrence_id: nodeId, ...node.extent_span };
      });
    }
    assert(
      Buffer.concat(selectedSourceBytes).equals(Buffer.from(item.source_excerpt, 'utf8')),
      'SAMPLE_IDENTITY_INVALID',
      `${ordinal}:source_excerpt`,
    );
    sourceSpanCount += sourceSpans.length;
    return {
      sample_ordinal: ordinal,
      review_item_id: item.review_item_id,
      agreement_id: item.agreement_id,
      candidate_key: item.candidate_key,
      family_key: item.family_key,
      item_kind: item.item_kind,
      source_kind: item.source_kind,
      prior_row_id: item.row_id,
      source_node_occurrence_ids: [...item.source_node_occurrence_ids],
      ambiguity_id: ambiguityId,
      source_excerpt_sha256: sha256Hex(Buffer.from(item.source_excerpt, 'utf8')),
      agreement_index_binding: inputBinding(value),
      canonical_source_binding: {
        canonical_text_id: source.canonical_text_id,
        canonical_text_byte_length: source.canonical_text_byte_length,
        canonical_text_sha256: source.canonical_text_sha256,
      },
      source_spans: sourceSpans,
    };
  });

  const counts = {
    total_items: members.length,
    source_to_row_items: members.filter((member) => member.item_kind === 'SOURCE_TO_ROW').length,
    review_only_no_normal_row_items: members.filter((member) => member.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW').length,
    parser_ambiguity_items: members.filter((member) => member.item_kind === 'PARSER_AMBIGUITY').length,
    source_span_count: sourceSpanCount,
    unique_agreement_count: new Set(members.map((member) => member.agreement_id)).size,
  };
  assert(counts.total_items === 50 && counts.parser_ambiguity_items === 1 && counts.unique_agreement_count === 9, 'SAMPLE_IDENTITY_INVALID', 'counts');
  return sealRecord(definition, {
    stage: STAGE,
    state: 'FROZEN_RESAMPLE_REQUIRES_NEW_AUTHORITY',
    ...common,
    lawyer_sample_policy_binding: inputBinding(policyValue),
    lawyer_review_packet_binding: inputBinding(packetValue),
    lawyer_decision_ledger_binding: inputBinding(ledgerValue),
    combined_ten_corpus_digest: packet.combined_ten_corpus_digest,
    counts,
    members,
  });
}

function parseRepairClasses(qaText) {
  const sectionIndex = qaText.indexOf('## 4. Repair-set accounting');
  assert(sectionIndex >= 0, 'REPAIR_ACCOUNTING_INVALID', 'section');
  const section = qaText.slice(sectionIndex);
  const byOrdinal = new Map();
  const classCounts = {};
  for (const line of section.split('\n')) {
    const match = line.match(/^\| ([^|]+) \| ([0-9, ]+) \| ([0-9]+) \|$/);
    if (!match || !REPAIR_CLASS_LABELS.has(match[1])) continue;
    const repairClass = REPAIR_CLASS_LABELS.get(match[1]);
    const ordinals = match[2].split(',').map((value) => Number(value.trim()));
    assert(ordinals.length === Number(match[3]), 'REPAIR_ACCOUNTING_INVALID', repairClass);
    classCounts[repairClass] = ordinals.length;
    for (const ordinal of ordinals) {
      assert(Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= 50, 'REPAIR_ACCOUNTING_INVALID', `${repairClass}:${ordinal}`);
      assert(!byOrdinal.has(ordinal), 'REPAIR_ACCOUNTING_INVALID', `duplicate:${ordinal}`);
      byOrdinal.set(ordinal, repairClass);
    }
  }
  assert(byOrdinal.size === 50 && Object.keys(classCounts).length === 6, 'REPAIR_ACCOUNTING_INVALID', 'coverage');
  assert(classCounts.CLEAN_CONTROL === 12, 'REPAIR_ACCOUNTING_INVALID', 'control_count');
  return { byOrdinal, classCounts };
}

function buildRepairBaseline(definition, common, inputs) {
  const packetValue = requireRole(inputs, 'LAWYER_REVIEW_PACKET');
  const ledgerValue = requireRole(inputs, 'LAWYER_DECISION_LEDGER');
  const qaValue = requireRole(inputs, 'READABLE_QA_TRANSCRIPT');
  const packet = packetValue.json;
  const ledger = ledgerValue.json;
  const { byOrdinal, classCounts } = parseRepairClasses(qaValue.bytes.toString('utf8'));
  const itemByOrdinal = new Map(packet.items.map((item) => [item.sample_ordinal, item]));
  const entries = ledger.decisions.map((decision, index) => {
    const ordinal = index + 1;
    assert(decision.sample_ordinal === ordinal, 'REPAIR_ACCOUNTING_INVALID', `decision:${ordinal}`);
    assert(itemByOrdinal.get(ordinal)?.review_item_id === decision.review_item_id, 'REPAIR_ACCOUNTING_INVALID', `item:${ordinal}`);
    const repairClass = byOrdinal.get(ordinal);
    const requiresFreshQuestion = FRESH_QUESTION_ORDINALS.has(ordinal);
    return {
      sample_ordinal: ordinal,
      review_item_id: decision.review_item_id,
      lawyer_decision_id: decision.lawyer_decision_id,
      reviewer: decision.reviewer,
      original_decision: decision.decision,
      original_note: decision.note,
      repair_class: repairClass,
      repair_membership: repairClass === 'CLEAN_CONTROL' ? 'CONTROL' : 'REPAIR',
      requires_fresh_work5_question: requiresFreshQuestion,
      fresh_work5_question_state: requiresFreshQuestion
        ? 'REQUIRED_CONTRADICTORY_OR_INSUFFICIENT_RECORD'
        : 'NOT_REQUIRED_BY_WORK0',
    };
  });
  const counts = {
    total_items: entries.length,
    repair_items: entries.filter((entry) => entry.repair_membership === 'REPAIR').length,
    control_items: entries.filter((entry) => entry.repair_membership === 'CONTROL').length,
    correct_decisions: entries.filter((entry) => entry.original_decision === 'CORRECT').length,
    incorrect_decisions: entries.filter((entry) => entry.original_decision === 'INCORRECT').length,
    fresh_work5_questions: entries.filter((entry) => entry.requires_fresh_work5_question).length,
    repair_class_counts: classCounts,
  };
  assert(counts.total_items === 50 && counts.repair_items === 38 && counts.control_items === 12, 'REPAIR_ACCOUNTING_INVALID', '38_12');
  assert(counts.correct_decisions === 19 && counts.incorrect_decisions === 31, 'REPAIR_ACCOUNTING_INVALID', '19_31');
  assert(counts.fresh_work5_questions === 3, 'REPAIR_ACCOUNTING_INVALID', 'fresh_questions');
  assert(ledger.gate_state === 'FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR', 'REPAIR_ACCOUNTING_INVALID', 'gate_state');
  return sealRecord(definition, {
    stage: STAGE,
    state: 'FAILED_HUMAN_REVIEW_REPAIR_BASELINE_FROZEN',
    ...common,
    lawyer_review_packet_binding: inputBinding(packetValue),
    lawyer_decision_ledger_binding: inputBinding(ledgerValue),
    readable_qa_binding: inputBinding(qaValue),
    gate_state: ledger.gate_state,
    counts,
    entries,
  });
}

function buildRulingMap(definition, common, inputs) {
  const rulingValue = requireRole(inputs, 'M5_PROGRAMME_RULINGS');
  const schemaReceiptValue = requireRole(inputs, 'M5_PROGRAMME_RULING_SEAL_PROOF');
  const preparationReceiptValue = requireRole(inputs, 'M5_PREPARATION_RECEIPT');
  const packs = requireRole(inputs, 'M5_CALIBRATION_PACK', 25);
  const rulingRecord = rulingValue.json;
  const schemaReceipt = schemaReceiptValue.json;
  assert(schemaReceipt.status === 'PASS' && schemaReceipt.lifecycle_state === 'SEALED', 'RULING_MAP_INVALID', 'schema_receipt');
  assert(schemaReceipt.programme_ruling_binding?.ruling_record_id === rulingRecord.ruling_record_id, 'RULING_MAP_INVALID', 'ruling_seal');
  assert(rulingRecord.scope === 'ALL_25_REGISTERED_FAMILIES' && rulingRecord.rulings?.length === 3, 'RULING_MAP_INVALID', 'programme_rulings');
  const rulingByProgrammeQuestion = new Map(rulingRecord.rulings.map((ruling) => [ruling.programme_question_id, ruling]));
  const families = packs.map((value) => {
    const pack = value.json;
    assert(pack.narrow_legal_questions?.length === 3, 'RULING_MAP_INVALID', `${pack.family_key}:questions`);
    const questionMappings = pack.narrow_legal_questions.map((question, index) => {
      const number = String(index + 1).padStart(2, '0');
      assert(question.question_id === `${pack.family_key}-Q${number}`, 'RULING_MAP_INVALID', question.question_id);
      assert(question.status === 'OPEN_REQUIRES_BEN_RULING' && question.ben_ruling_id === null, 'RULING_MAP_INVALID', `${question.question_id}:historical_state`);
      const programmeQuestionId = `PROGRAMME-Q${number}`;
      const ruling = rulingByProgrammeQuestion.get(programmeQuestionId);
      assert(ruling, 'RULING_MAP_INVALID', programmeQuestionId);
      return {
        family_question_id: question.question_id,
        question: question.question,
        historical_status: question.status,
        historical_ben_ruling_id: question.ben_ruling_id,
        programme_question_id: programmeQuestionId,
        ruling_id: ruling.ruling_id,
        selection: ruling.selection,
        legal_rule: ruling.legal_rule,
      };
    });
    return {
      family_key: pack.family_key,
      wave: pack.wave,
      calibration_pack_binding: inputBinding(value),
      question_mappings: questionMappings,
    };
  });
  families.sort((left, right) => (
    left.family_key < right.family_key ? -1 : left.family_key > right.family_key ? 1 : 0
  ));
  assert(new Set(families.map((family) => family.family_key)).size === 25, 'RULING_MAP_INVALID', 'family_count');
  const counts = {
    family_count: families.length,
    question_count: families.reduce((total, family) => total + family.question_mappings.length, 0),
    programme_ruling_count: rulingRecord.rulings.length,
  };
  assert(counts.family_count === 25 && counts.question_count === 75 && counts.programme_ruling_count === 3, 'RULING_MAP_INVALID', 'counts');
  return sealRecord(definition, {
    stage: STAGE,
    state: 'SEALED_PROGRAMME_RULINGS_REBOUND_NO_HISTORICAL_PACK_REWRITE',
    ...common,
    programme_ruling_binding: inputBinding(rulingValue),
    schema_approval_receipt_binding: inputBinding(schemaReceiptValue),
    m5_preparation_receipt_binding: inputBinding(preparationReceiptValue),
    counts,
    families,
  });
}

function supportRole(relativePath) {
  return path.basename(relativePath, '.json').replaceAll('-', '_').toUpperCase();
}

function buildLegacySupersession(definition, common, inputs) {
  const analysisValues = requireRole(inputs, 'FAILED_M5_V1_ANALYSIS', 7);
  const projectionValues = requireRole(inputs, 'FAILED_M6_V1_PROJECTION', 7);
  const supportValues = requireRole(inputs, 'FAILED_M6_V1_SUPPORT', 8);
  const m6ReceiptValue = requireRole(inputs, 'M6_FINAL_V1_RECEIPT');
  const m7ReceiptValue = requireRole(inputs, 'M7_FINAL_ADDITIVE_RECEIPT');
  const projectionByAgreement = new Map(projectionValues.map((value) => [value.json.agreement_id, value]));
  const analysisRegistrations = [];
  const projectionRegistrations = [];
  const rowRegistrations = [];
  let compoundPropositionCount = 0;
  let normalRowCount = 0;
  let omissionRecordCount = 0;

  for (const analysisValue of analysisValues) {
    const analysis = analysisValue.json;
    const projectionValue = projectionByAgreement.get(analysis.agreement_id);
    assert(projectionValue, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:projection`);
    const projection = projectionValue.json;
    assert(projection.agreement_analysis_id === analysis.agreement_analysis_id, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:analysis_binding`);
    const propositionIds = new Set(analysis.compound_propositions.map((value) => value.compound_proposition_id));
    const rowPropositionIds = new Set(projection.rows.map((row) => row.source_compound_proposition_id));
    const omissionByRow = new Map();
    for (const omission of projection.omissions) {
      assert(!omissionByRow.has(omission.row_id), 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:duplicate_omission`);
      omissionByRow.set(omission.row_id, omission);
    }
    assert(propositionIds.size === analysis.compound_propositions.length, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:duplicate_proposition`);
    assert(rowPropositionIds.size === projection.rows.length, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:duplicate_row_proposition`);
    assert(propositionIds.size === rowPropositionIds.size, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:set_size`);
    for (const propositionId of propositionIds) {
      assert(rowPropositionIds.has(propositionId), 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:${propositionId}`);
    }
    assert(projection.review_rows.length === 0, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:review_rows`);
    assert(projection.rows.length === projection.omissions.length, 'LEGACY_SUPERSESSION_INVALID', `${analysis.agreement_id}:omissions`);
    for (const row of projection.rows) {
      const omission = omissionByRow.get(row.row_id);
      assert(omission?.compound_proposition_id === row.source_compound_proposition_id, 'LEGACY_SUPERSESSION_INVALID', `${row.row_id}:omission`);
      rowRegistrations.push({
        agreement_id: row.agreement_id,
        agreement_projection_id: projection.agreement_projection_id,
        row_id: row.row_id,
        source_compound_proposition_id: row.source_compound_proposition_id,
        family_key: row.family_key,
        row_state: row.row_state,
        supersession_state: LEGACY_STATE,
        v2_admissible: false,
      });
    }
    analysisRegistrations.push({
      agreement_id: analysis.agreement_id,
      agreement_analysis_id: analysis.agreement_analysis_id,
      binding: inputBinding(analysisValue),
      compound_proposition_count: analysis.compound_propositions.length,
      supersession_state: LEGACY_STATE,
      v2_admissible: false,
    });
    projectionRegistrations.push({
      agreement_id: projection.agreement_id,
      agreement_projection_id: projection.agreement_projection_id,
      agreement_analysis_id: projection.agreement_analysis_id,
      binding: inputBinding(projectionValue),
      normal_row_count: projection.rows.length,
      omission_record_count: projection.omissions.length,
      review_row_count: projection.review_rows.length,
      supersession_state: LEGACY_STATE,
      v2_admissible: false,
    });
    compoundPropositionCount += analysis.compound_propositions.length;
    normalRowCount += projection.rows.length;
    omissionRecordCount += projection.omissions.length;
  }
  assert(new Set(rowRegistrations.map((row) => row.row_id)).size === rowRegistrations.length, 'LEGACY_SUPERSESSION_INVALID', 'duplicate_row_id');
  const supportLedgerBindings = supportValues.map((value) => ({
    role: supportRole(value.binding.path),
    binding: inputBinding(value),
    supersession_state: LEGACY_STATE,
    v2_admissible: false,
  }));
  const counts = {
    analysis_files: analysisRegistrations.length,
    projection_files: projectionRegistrations.length,
    compound_propositions: compoundPropositionCount,
    normal_rows: normalRowCount,
    omission_records: omissionRecordCount,
    support_ledgers: supportLedgerBindings.length,
  };
  assert(counts.analysis_files === 7 && counts.projection_files === 7, 'LEGACY_SUPERSESSION_INVALID', 'file_counts');
  assert(counts.compound_propositions === 1111 && counts.normal_rows === 1111 && counts.omission_records === 1111, 'LEGACY_SUPERSESSION_INVALID', '1111_counts');
  assert(counts.support_ledgers === 8 && rowRegistrations.length === 1111, 'LEGACY_SUPERSESSION_INVALID', 'ledger_counts');
  return sealRecord(definition, {
    stage: STAGE,
    state: LEGACY_STATE,
    ...common,
    m6_receipt_binding: inputBinding(m6ReceiptValue),
    m7_additive_receipt_binding: inputBinding(m7ReceiptValue),
    v2_consumer_gate: {
      v1_semantic_admission: 'FORBIDDEN',
      active_m7_v2_dispatch_count: 0,
      enforcement_state: 'AUTHORITY_REJECTS_V1_INPUT',
    },
    counts,
    analysis_registrations: analysisRegistrations,
    projection_registrations: projectionRegistrations,
    support_ledger_bindings: supportLedgerBindings,
    row_registrations: rowRegistrations,
  });
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function outputBinding(definition, record, bytes) {
  return {
    path: definition.path,
    schema_version: definition.schema_version,
    record_id_field: definition.id_field,
    record_id: record[definition.id_field],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function unlinkCreatedFile(absolute, identity, expectedBytes = null) {
  try {
    const current = fs.lstatSync(absolute);
    if (!current.isFile() || current.isSymbolicLink()
      || current.dev !== identity.dev || current.ino !== identity.ino) return;
    if (expectedBytes !== null && !fs.readFileSync(absolute).equals(expectedBytes)) return;
    fs.unlinkSync(absolute);
  } catch {
    // Cleanup is best effort and never targets a different filesystem entry.
  }
}

function writeExclusiveFile(absolute, bytes) {
  const flags = fs.constants.O_WRONLY
    | fs.constants.O_CREAT
    | fs.constants.O_EXCL
    | (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  let created = false;
  let identity;
  try {
    descriptor = fs.openSync(absolute, flags, 0o644);
    created = true;
    const stat = fs.fstatSync(descriptor);
    identity = { dev: stat.dev, ino: stat.ino };
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (written <= 0) throw new Error('exclusive output write made no progress');
      offset += written;
    }
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The caller removes only an incomplete output created by this invocation.
      }
    }
    if (created && identity) unlinkCreatedFile(absolute, identity);
    throw error;
  }
  return identity;
}

function writeOutputs(repoRoot, serialised) {
  for (const { definition } of serialised) {
    assert(!entryExists(resolveRepoPath(repoRoot, definition.path)), 'OUTPUT_ALREADY_EXISTS', definition.path);
  }
  const created = [];
  try {
    for (const { definition, bytes } of serialised) {
      const absolute = resolveRepoPath(repoRoot, definition.path);
      const identity = writeExclusiveFile(absolute, bytes);
      created.push({ absolute, identity, bytes });
    }
  } catch (error) {
    for (const entry of created.reverse()) {
      unlinkCreatedFile(entry.absolute, entry.identity, entry.bytes);
    }
    if (error instanceof Work0FinalisationError) throw error;
    fail('OUTPUT_WRITE_FAILED');
  }
}

export function finaliseWork0({ repoRoot, write }) {
  assert(typeof repoRoot === 'string' && repoRoot.length > 0, 'INVALID_OPTIONS', 'repoRoot');
  assert(write === true || write === false, 'INVALID_OPTIONS', 'write');
  const resolvedRoot = path.resolve(repoRoot);
  const manifestResult = parseCanonicalRecord(
    resolvedRoot,
    EXPECTED_MANIFEST,
    'manifest_id',
    'manifest_digest',
    'MANIFEST_INVALID',
  );
  const authorityResult = parseCanonicalRecord(
    resolvedRoot,
    EXPECTED_AUTHORITY,
    'authority_id',
    'authority_digest',
    'AUTHORITY_INVALID',
  );
  const manifest = manifestResult.record;
  const authority = authorityResult.record;
  assert(authority.pre_work0_manifest_binding?.sha256 === EXPECTED_MANIFEST.sha256, 'AUTHORITY_INVALID', 'manifest_sha256');
  assert(authority.pre_work0_manifest_binding?.manifest_id === EXPECTED_MANIFEST.manifest_id, 'AUTHORITY_INVALID', 'manifest_id');
  assert(authority.command_run_limits?.work1_7_commands === 0 && authority.command_run_limits?.m8_commands === 0, 'AUTHORITY_INVALID', 'later_work');
  assert(authority.command_run_limits?.repository_pushes === 0, 'AUTHORITY_INVALID', 'push');
  assert(authority.prohibitions?.includes('NO_WORK1_7') && authority.prohibitions?.includes('NO_M8'), 'AUTHORITY_INVALID', 'prohibitions');
  assert(authority.prohibitions?.includes('NO_NETWORK_WRITES_OR_PUSH'), 'AUTHORITY_INVALID', 'network_writes');
  assert(exact(authority.pre_work0_candidate_paths, [MANIFEST_PATH, AUTHORITY_PATH]), 'AUTHORITY_INVALID', 'candidate_paths');
  assert(exact(
    authority.permitted_output_paths,
    [...OUTPUTS.map((output) => output.path), authority.intended_evidence_root.path],
  ), 'AUTHORITY_INVALID', 'output_paths');
  assert(manifest.input_bindings.every((binding) => authority.permitted_read_paths.includes(binding.path)), 'AUTHORITY_INVALID', 'read_paths');
  validateActivationConfirmation({ authority, manifest, confirmation: ACTIVATION_CONFIRMATION });
  verifyRepository(resolvedRoot, authority, write);
  const inputs = verifyInputBindings(resolvedRoot, manifest);

  const common = {
    bootstrap_authority_binding: knownBinding(EXPECTED_AUTHORITY, 'authority_id'),
    pre_work0_manifest_binding: knownBinding(EXPECTED_MANIFEST, 'manifest_id'),
  };
  const records = {
    fixed_sample_identity_manifest: buildFixedSample(OUTPUTS[0], common, inputs),
    repair_baseline_ledger: buildRepairBaseline(OUTPUTS[1], common, inputs),
    calibration_question_ruling_map: buildRulingMap(OUTPUTS[2], common, inputs),
    legacy_output_supersession_ledger: buildLegacySupersession(OUTPUTS[3], common, inputs),
  };
  const serialised = OUTPUTS.map((definition) => {
    const record = records[definition.key];
    const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
    return { definition, record, bytes };
  });
  if (write) writeOutputs(resolvedRoot, serialised);

  const counts = {
    input_bindings: manifest.input_bindings.length,
    sample_items: records.fixed_sample_identity_manifest.counts.total_items,
    repair_items: records.repair_baseline_ledger.counts.repair_items,
    control_items: records.repair_baseline_ledger.counts.control_items,
    calibration_families: records.calibration_question_ruling_map.counts.family_count,
    calibration_questions: records.calibration_question_ruling_map.counts.question_count,
    legacy_analyses: records.legacy_output_supersession_ledger.counts.analysis_files,
    legacy_projections: records.legacy_output_supersession_ledger.counts.projection_files,
    legacy_rows: records.legacy_output_supersession_ledger.counts.normal_rows,
    legacy_support_ledgers: records.legacy_output_supersession_ledger.counts.support_ledgers,
  };
  return {
    records,
    bindings: {
      activation_confirmation: ACTIVATION_CONFIRMATION,
      bootstrap_authority: common.bootstrap_authority_binding,
      pre_work0_manifest: common.pre_work0_manifest_binding,
      outputs: serialised.map(({ definition, record, bytes }) => outputBinding(definition, record, bytes)),
    },
    counts,
  };
}

function runCli() {
  assert(process.argv.length === 2, 'CLI_ARGUMENTS_FORBIDDEN');
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(scriptPath), '..');
  const result = finaliseWork0({ repoRoot, write: true });
  process.stdout.write(`${canonicalJson({ status: 'PASS', counts: result.counts, output_bindings: result.bindings.outputs })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    const code = error instanceof Work0FinalisationError ? error.code : 'UNEXPECTED_FAILURE';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
