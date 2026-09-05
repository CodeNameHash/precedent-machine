#!/usr/bin/env node
// Shared Work 2 real-text helpers. No model calls. Does not write under
// control/ or receipts/. --registration is mandatory.

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import generatorModule from '../lib/canonical-v2/m7-v2-deterministic-generator.js';
import contractModule from '../lib/canonical-v2/m7-v2-contract.js';

const { canonicalJson, sha256Hex } = canonicalModule;
const { generateAnalysisV2 } = generatorModule;
const { validateAnalysisV2 } = contractModule;

export const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
export const OUTPUT_ROOT = `${MIGRATION_ROOT}/m7-v2-repair/v2-candidate`;
export const REPORT_PATH = `${OUTPUT_ROOT}/work2-real-text-report.json`;
export const RECEIPT_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work2-real-text-successor.json`;
export const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_REAL_TEXT_RECEIPT/V1';
export const WORK3_ANALYSIS_SET =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-agreement-analysis-set.json`;
export const WORK3_INDEX_SET =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-agreement-index-set.json`;
export const WORK3_CONTEXT_SET =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-context-compilation-set.json`;
export const SEALED_SET_RECORD_IDS = Object.freeze({
  AGREEMENT_INDEX_SET: '5d42f5bbabd3b8ccdda090da2dcdccd9b8fc398d4d4948052e6474f383be4838',
  BASE_ANALYSIS_SET: 'c45e08bd0d140d24c5afb4fa9986b13e9f175a59d94987c46830351f3aac18d5',
  CONTEXT_COMPILATION_SET: 'a6d00d595a5341420fb5ac2f39a6a767e0c0d00f9b4de0647f3944575e1e430e',
});
export const SYNTHETIC_MARKERS = Object.freeze(['all_of', 'family shall']);

const MODALS = Object.freeze([
  'is entitled to', 'is required to', 'shall not', 'will not', 'may not',
  'shall', 'will', 'may', 'must',
]);
const PROVISOS = Object.freeze([
  'provided, however', 'provided that', 'except that', 'to the extent',
  'so long as', 'other than', 'subject to', 'notwithstanding', 'except', 'unless',
]);
const PARTY_SEEDS = Object.freeze([
  'Merger Sub', 'Guarantor', 'Purchaser', 'Company', 'Parent',
]);

export class Work2RealTextError extends Error {
  constructor(code, detail, agreementId = null) {
    super(agreementId ? `${code}: ${agreementId}: ${detail}` : `${code}: ${detail}`);
    this.name = 'Work2RealTextError';
    this.code = code;
    this.agreementId = agreementId;
  }
}

export function repoRootFrom(importMetaUrl, selectedRoot) {
  if (typeof selectedRoot === 'string' && selectedRoot.length > 0) {
    return path.resolve(selectedRoot);
  }
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), '..');
}

export function parseArgv(argv) {
  const options = { writeReceipt: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--registration') {
      options.registrationPath = argv[index + 1];
      index += 1;
    } else if (token === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (token === '--out-dir') {
      options.outDir = argv[index + 1];
      index += 1;
    } else if (token === '--write-receipt') {
      options.writeReceipt = true;
    } else {
      throw new Work2RealTextError('WORK2_REAL_TEXT_INVALID', token);
    }
  }
  if (typeof options.registrationPath !== 'string' || options.registrationPath.length === 0) {
    throw new Work2RealTextError('WORK2_REAL_TEXT_INVALID', '--registration is mandatory');
  }
  return options;
}

export function safeAbsolute(root, repositoryPath) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
      || repositoryPath.startsWith('/') || repositoryPath.includes('\0')
      || repositoryPath.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    return null;
  }
  let current = root;
  const parts = repositoryPath.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) return null;
    if (index < parts.length - 1 && !stat.isDirectory()) return null;
  }
  return current;
}

export function readRepoFile(root, repositoryPath) {
  const absolute = safeAbsolute(root, repositoryPath);
  if (absolute === null || !existsSync(absolute)) {
    throw new Work2RealTextError('WORK2_REAL_TEXT_MISSING', repositoryPath);
  }
  return readFileSync(absolute);
}

export function fileBinding(root, repositoryPath) {
  const bytes = readRepoFile(root, repositoryPath);
  return {
    path: repositoryPath,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: createHash('sha1')
      .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
      .update(bytes)
      .digest('hex'),
    bytes,
    record: JSON.parse(bytes.toString('utf8')),
  };
}

function wordBoundHits(text, phrases) {
  const hits = [];
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    let from = 0;
    while (from <= lower.length) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      const before = at === 0 ? ' ' : lower[at - 1];
      const after = at + needle.length >= lower.length ? ' ' : lower[at + needle.length];
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
        hits.push({ text: phrase, start_char: at, end_char: at + needle.length });
      }
      from = at + Math.max(needle.length, 1);
    }
  }
  return hits;
}

function charToByte(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

export function ledgerEntriesForText(nodeText, nodeStart, sourceBytes) {
  const entries = [];
  for (const hit of wordBoundHits(nodeText, MODALS)) {
    const start = nodeStart + charToByte(nodeText, hit.start_char);
    const end = nodeStart + charToByte(nodeText, hit.end_char);
    entries.push({
      kind: 'modal',
      text: hit.text,
      start_byte: start,
      end_byte: end,
      text_sha256: sha256Hex(sourceBytes.subarray(start, end)),
    });
  }
  for (const hit of wordBoundHits(nodeText, PROVISOS)) {
    const start = nodeStart + charToByte(nodeText, hit.start_char);
    const end = nodeStart + charToByte(nodeText, hit.end_char);
    entries.push({
      kind: 'proviso',
      text: hit.text,
      start_byte: start,
      end_byte: end,
      text_sha256: sha256Hex(sourceBytes.subarray(start, end)),
    });
  }
  return entries.sort((left, right) => left.start_byte - right.start_byte
    || left.kind.localeCompare(right.kind));
}

export function partyCandidatesForText(nodeText, nodeStart, sourceBytes) {
  const rows = [];
  for (const hit of wordBoundHits(nodeText, PARTY_SEEDS)) {
    const start = nodeStart + charToByte(nodeText, hit.start_char);
    const end = nodeStart + charToByte(nodeText, hit.end_char);
    rows.push({
      label: hit.text,
      start_byte: start,
      end_byte: end,
      text_sha256: sha256Hex(sourceBytes.subarray(start, end)),
      proved: false,
    });
  }
  return rows;
}

export function loadRegistration(root, registrationPath) {
  const binding = fileBinding(root, registrationPath);
  if (binding.record.schema_version !== 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1') {
    throw new Work2RealTextError('WORK2_REAL_TEXT_REGISTRATION', 'schema');
  }
  return binding;
}

function roleBinding(registration, role) {
  const entry = (registration.record.semantic_input_bindings ?? []).find(
    (item) => item.input_role === role || item.role === role,
  );
  if (!entry?.binding?.path) {
    throw new Work2RealTextError('WORK2_REAL_TEXT_REGISTRATION', `missing ${role}`);
  }
  return entry.binding;
}

export function loadSealedSets(root, registration) {
  const analysisSet = fileBinding(root, roleBinding(registration, 'BASE_ANALYSIS_SET').path);
  const indexSet = fileBinding(root, roleBinding(registration, 'AGREEMENT_INDEX_SET').path);
  const contextSet = fileBinding(root, roleBinding(registration, 'CONTEXT_COMPILATION_SET').path);
  if (analysisSet.record.agreement_analysis_set_id !== SEALED_SET_RECORD_IDS.BASE_ANALYSIS_SET
      || indexSet.record.agreement_index_set_id !== SEALED_SET_RECORD_IDS.AGREEMENT_INDEX_SET
      || contextSet.record.context_compilation_set_id
        !== SEALED_SET_RECORD_IDS.CONTEXT_COMPILATION_SET) {
    throw new Work2RealTextError('REAL_AGREEMENT_RECEIPT_GUARD_FAILED', 'sealed set record id');
  }
  return { analysisSet, indexSet, contextSet };
}

export function loadApprovedInputs(root, registration) {
  return {
    approvedFamilyPackets: fileBinding(
      root, roleBinding(registration, 'APPROVED_FAMILY_PACKET_SET').path,
    ),
    approvedFamilyProfileSet: fileBinding(
      root, roleBinding(registration, 'APPROVED_FAMILY_PROFILE_SET').path,
    ),
    approvedStructureDispositions: fileBinding(
      root, roleBinding(registration, 'APPROVED_STRUCTURE_DISPOSITION_SET').path,
    ),
  };
}

function memberByAgreement(members, agreementId, bindingField) {
  return members.find((member) => member.agreement_id === agreementId)?.[bindingField]
    ?? members.find((member) => member.record_id && member.path);
}

export function compileAgreement({
  root, registration, sets, approved, agreementId,
}) {
  const analysisBinding = sets.analysisSet.record.members.find(
    (member) => member.agreement_id === agreementId,
  )?.agreement_analysis_binding;
  const contextBinding = sets.contextSet.record.members.find(
    (member) => member.agreement_id === agreementId,
  )?.context_compilation_binding;
  if (!analysisBinding || !contextBinding) {
    throw new Work2RealTextError('REAL_AGREEMENT_RECEIPT_GUARD_FAILED', 'missing member', agreementId);
  }
  const baseAnalysis = fileBinding(root, analysisBinding.path).record;
  const contextCompilation = fileBinding(root, contextBinding.path).record;
  const indexBinding = sets.indexSet.record.members.find((member) => {
    const nested = member.agreement_index_binding ?? member;
    return nested.record_id === contextCompilation.agreement_index_binding?.agreement_index_id
      || member.agreement_id === agreementId;
  });
  const indexPath = indexBinding?.agreement_index_binding?.path ?? indexBinding?.path;
  if (!indexPath) {
    throw new Work2RealTextError('REAL_AGREEMENT_RECEIPT_GUARD_FAILED', 'missing index', agreementId);
  }
  const agreementIndexRecord = fileBinding(root, indexPath);
  const sourceText = agreementIndexRecord.record.source_binding?.canonical_text ?? '';
  if (SYNTHETIC_MARKERS.some((marker) => sourceText.includes(marker))) {
    throw new Work2RealTextError(
      'REAL_AGREEMENT_RECEIPT_GUARD_FAILED', 'synthetic fixture text', agreementId,
    );
  }
  const analysis = generateAnalysisV2({
    baseAnalysis,
    agreementIndex: {
      ...agreementIndexRecord.record,
      __binding: {
        path: indexPath,
        schema_version: agreementIndexRecord.record.schema_version,
        record_id_field: 'agreement_index_id',
        record_id: agreementIndexRecord.record.agreement_index_id,
        byte_length: agreementIndexRecord.byte_length,
        sha256: agreementIndexRecord.sha256,
        git_blob_oid: agreementIndexRecord.git_blob_oid,
      },
    },
    contextCompilation,
    approvedFamilyPackets: approved.approvedFamilyPackets.record,
    approvedFamilyProfileSet: {
      ...approved.approvedFamilyProfileSet.record,
      __binding: {
        path: approved.approvedFamilyProfileSet.path,
        schema_version: approved.approvedFamilyProfileSet.record.schema_version,
        record_id_field: 'family_profile_set_id',
        record_id: approved.approvedFamilyProfileSet.record.family_profile_set_id,
        byte_length: approved.approvedFamilyProfileSet.byte_length,
        sha256: approved.approvedFamilyProfileSet.sha256,
        git_blob_oid: approved.approvedFamilyProfileSet.git_blob_oid,
      },
    },
    approvedStructureDispositions: approved.approvedStructureDispositions.record,
    governance: {
      candidate_registration_id: registration.record.candidate_registration_id,
      family_profile_set_binding: registration.record.family_profile_set_binding,
      structure_disposition_set_binding: registration.record.structure_disposition_set_binding,
      semantic_input_bindings: registration.record.semantic_input_bindings,
    },
  });
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const nodesById = new Map(
    (agreementIndexRecord.record.nodes ?? []).map((node) => [node.node_occurrence_id, node]),
  );
  const attempts = (baseAnalysis.claims ?? []).map((claim) => {
    const nodeId = claim.source_node_occurrence_ids?.[0];
    const node = nodesById.get(nodeId);
    const start = node?.extent_span?.start_byte ?? 0;
    const end = node?.extent_span?.end_byte ?? 0;
    const nodeText = Number.isInteger(start) && Number.isInteger(end)
      ? sourceBytes.subarray(start, end).toString('utf8') : '';
    const disposition = analysis.dispositions.find(
      (entry) => entry.input_occurrence_id === claim.claim_occurrence_id,
    );
    return {
      claim_occurrence_id: claim.claim_occurrence_id,
      node_occurrence_id: nodeId ?? null,
      closure: {
        start_byte: start,
        end_byte: end,
        text_sha256: Number.isInteger(start) && Number.isInteger(end)
          ? sha256Hex(sourceBytes.subarray(start, end)) : null,
        context_spans: analysis.source_closures.find(
          (closure) => closure.source_node_occurrence_id === nodeId,
        )?.context_spans ?? [],
      },
      family_bridge_result: null,
      subtype_candidates: disposition?.all_family_profile_results
        ?.flatMap((entry) => entry.matched_profile_ids) ?? [],
      ledger_entries: ledgerEntriesForText(nodeText, start, sourceBytes),
      parser_hit_or_abstain: null,
      party_candidates_with_spans: partyCandidatesForText(nodeText, start, sourceBytes),
      definition_resolution: { rule_id: null, unresolved: true, candidates: [] },
      disposition: disposition?.output_disposition ?? null,
      issue_codes: (disposition?.issues ?? []).map((issue) => issue.issue_code),
    };
  });
  return { analysis, attempts, claimCount: (baseAnalysis.claims ?? []).length };
}

export function writeJson(root, repositoryPath, value) {
  const absolute = path.join(root, repositoryPath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

export function analysisPathFor(agreementId) {
  return `${OUTPUT_ROOT}/${agreementId}.agreement-analysis.json`;
}

export function attemptPathFor(agreementId) {
  return `${OUTPUT_ROOT}/${agreementId}.attempt-record.json`;
}

export function reasonCodeCounts(analyses) {
  const counts = {};
  for (const analysis of analyses) {
    for (const disposition of analysis.dispositions ?? []) {
      for (const issue of disposition.issues ?? []) {
        counts[issue.issue_code] = (counts[issue.issue_code] ?? 0) + 1;
      }
    }
    for (const partition of analysis.coverage_partitions ?? []) {
      for (const entry of partition.entries ?? []) {
        if (typeof entry.reason_code === 'string' && entry.reason_code.length > 0) {
          counts[entry.reason_code] = (counts[entry.reason_code] ?? 0) + 1;
        }
      }
    }
  }
  return Object.fromEntries(Object.keys(counts).sort().map((key) => [key, counts[key]]));
}

export function resolveBindingFactory(root) {
  return (binding) => {
    if (!binding?.path) throw new Work2RealTextError('WORK2_REAL_TEXT_MISSING', 'binding path');
    return readRepoFile(root, binding.path);
  };
}

export function validateOutputs({ root, registration, sets, outRoot = OUTPUT_ROOT }) {
  const failures = [];
  const analyses = [];
  for (const member of sets.analysisSet.record.members) {
    const agreementId = member.agreement_id;
    const analysisFile = `${outRoot}/${agreementId}.agreement-analysis.json`;
    const absolute = safeAbsolute(root, analysisFile);
    if (absolute === null || !existsSync(absolute)) {
      failures.push({ agreement_id: agreementId, code: 'MISSING_ANALYSIS' });
      continue;
    }
    const analysis = JSON.parse(readFileSync(absolute, 'utf8'));
    analyses.push(analysis);
    const m4 = fileBinding(root, member.agreement_analysis_binding.path).record;
    const expectedIds = (m4.claims ?? []).map((claim) => claim.claim_occurrence_id).sort();
    const gotIds = [...(analysis.governed_input_occurrence_ids ?? [])].sort();
    if (canonicalJson(expectedIds) !== canonicalJson(gotIds)) {
      failures.push({ agreement_id: agreementId, code: 'OCCURRENCE_SET_MISMATCH' });
    }
    const sourceText = (() => {
      const contextBinding = sets.contextSet.record.members.find(
        (row) => row.agreement_id === agreementId,
      )?.context_compilation_binding;
      const context = contextBinding ? fileBinding(root, contextBinding.path).record : null;
      const indexMember = sets.indexSet.record.members.find((row) => {
        const nested = row.agreement_index_binding ?? row;
        return nested.record_id === context?.agreement_index_binding?.agreement_index_id
          || row.agreement_id === agreementId;
      });
      const indexPath = indexMember?.agreement_index_binding?.path ?? indexMember?.path;
      return indexPath
        ? fileBinding(root, indexPath).record.source_binding?.canonical_text ?? ''
        : '';
    })();
    if (SYNTHETIC_MARKERS.some((marker) => sourceText.includes(marker))) {
      failures.push({ agreement_id: agreementId, code: 'SYNTHETIC_FIXTURE' });
    }
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    for (const closure of analysis.source_closures ?? []) {
      const start = closure.governing_start_byte;
      const end = closure.governing_end_byte;
      if (!Number.isInteger(start) || !Number.isInteger(end)
          || start < 0 || end > sourceBytes.length || end <= start) {
        failures.push({ agreement_id: agreementId, code: 'CLOSURE_HASH' });
        continue;
      }
      for (const span of closure.spans ?? []) {
        if (sha256Hex(sourceBytes.subarray(span.start_byte, span.end_byte))
            !== span.text_sha256) {
          failures.push({ agreement_id: agreementId, code: 'CLOSURE_HASH' });
        }
      }
      for (const span of closure.context_spans ?? []) {
        if (sha256Hex(sourceBytes.subarray(span.start_byte, span.end_byte))
            !== span.text_sha256) {
          failures.push({ agreement_id: agreementId, code: 'CLOSURE_HASH' });
        }
      }
    }
    try {
      validateAnalysisV2({
        analysis,
        resolveBinding: resolveBindingFactory(root),
      });
    } catch (error) {
      failures.push({
        agreement_id: agreementId,
        code: 'VALIDATE_ANALYSIS_V2',
        detail: String(error?.message ?? error),
      });
    }
  }
  return { failures, analyses, registration_id: registration.record.candidate_registration_id };
}

export function buildReceipt({ analyses, report, registration }) {
  const unsigned = {
    schema_version: RECEIPT_SCHEMA,
    candidate_registration_id: registration.record.candidate_registration_id,
    agreement_ids: analyses.map((analysis) => analysis.agreement_id).sort(),
    analysis_count: analyses.length,
    disposition_count: analyses.reduce(
      (sum, analysis) => sum + (analysis.dispositions ?? []).length, 0,
    ),
    reason_code_counts: report.reason_code_counts,
    report_sha256: report.report_sha256,
  };
  return {
    ...unsigned,
    work2_real_text_receipt_id: sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8')),
  };
}

export { canonicalJson, sha256Hex, generateAnalysisV2, validateAnalysisV2, memberByAgreement };
