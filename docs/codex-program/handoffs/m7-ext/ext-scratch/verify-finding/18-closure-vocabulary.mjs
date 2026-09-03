'use strict';

/**
 * Q-0018: vocabulary of modals, enumerated limbs and proviso markers in
 * closure text. Closures here are the M2 node extent of each M4 claim
 * (the authored unit) plus the Q-0012 parent-chain spans for the fixed 50.
 * Zero model calls. Spans hashed with sha256Hex of the UTF-8 slice.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const ANALYSIS_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);
const Q12_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');

const MODAL_RE = /\b(shall|may|will|must|should)\b/gi;
const LIMB_RE = /\(([ivxlcdm]+|[a-z]|[0-9]{1,2})\)/gi;
const PROVISO_RE = /\bprovided(?:\s*,\s*however)?,?\s+that\b|\bexcept\s+(?:that|as|for)\b|\bprovided\s+further\b/gi;

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort(compareText)) out[key] = sortedObject(value[key]);
    return out;
  }
  return value;
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function histogramObject(map) {
  const keys = [...map.keys()].sort(compareText);
  const out = {};
  for (const key of keys) out[key] = map.get(key);
  return out;
}

function charIndexToByte(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function verifySlice(bytes, start, end) {
  if (!bytes || !Number.isInteger(start) || !Number.isInteger(end)) {
    return { start_byte: start ?? null, end_byte: end ?? null, text_sha256: null, verified: false };
  }
  if (start < 0 || end < start || end > bytes.length) {
    return { start_byte: start, end_byte: end, text_sha256: null, verified: false };
  }
  return {
    start_byte: start,
    end_byte: end,
    text_sha256: sha256Hex(bytes.subarray(start, end)),
    verified: true,
  };
}

function collectMatches(kind, regex, text, bytes, baseStart) {
  const hits = [];
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const localStart = charIndexToByte(text, match.index);
    const localEnd = localStart + Buffer.byteLength(match[0], 'utf8');
    const span = verifySlice(bytes, baseStart + localStart, baseStart + localEnd);
    hits.push({
      kind,
      form: match[0].replace(/\s+/g, ' ').trim().toLowerCase(),
      span,
    });
  }
  return hits;
}

function scanText(text, bytes, baseStart) {
  return [
    ...collectMatches('modal', MODAL_RE, text, bytes, baseStart),
    ...collectMatches('enumerated_limb', LIMB_RE, text, bytes, baseStart),
    ...collectMatches('proviso', PROVISO_RE, text, bytes, baseStart),
  ];
}

function main() {
  const missing = [];
  for (const required of [INDEX_SET_PATH, ANALYSIS_SET_PATH, Q12_PATH]) {
    if (!existsSync(required)) missing.push(required);
  }
  if (missing.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: 'missing', missing }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const indexSet = loadJson(INDEX_SET_PATH);
  const analysisSet = loadJson(ANALYSIS_SET_PATH);
  const q12 = loadJson(Q12_PATH);

  const indexByAgreement = new Map();
  for (const member of indexSet.members ?? []) {
    if (typeof member?.path !== 'string') continue;
    const abs = resolve(repoRoot, member.path);
    if (!existsSync(abs)) {
      missing.push(member.path);
      continue;
    }
    const record = loadJson(abs);
    const agreementId = record?.source_binding?.agreement_id;
    const text = record?.source_binding?.canonical_text;
    if (typeof agreementId !== 'string' || typeof text !== 'string') continue;
    const bytes = Buffer.from(text, 'utf8');
    const nodesById = new Map();
    for (const node of record.nodes ?? []) {
      if (typeof node?.node_occurrence_id === 'string') nodesById.set(node.node_occurrence_id, node);
    }
    indexByAgreement.set(agreementId, { bytes, nodesById, path: member.path, text });
  }

  const formHist = new Map();
  const kindHist = new Map();
  let closures = 0;
  let shaVerified = 0;
  let shaFailed = 0;
  const agreementRows = [];

  for (const member of analysisSet.members ?? []) {
    const agreementId = member?.agreement_id;
    const analysisPath = member?.agreement_analysis_binding?.path;
    if (typeof agreementId !== 'string' || typeof analysisPath !== 'string') continue;
    const abs = resolve(repoRoot, analysisPath);
    if (!existsSync(abs)) {
      missing.push(analysisPath);
      continue;
    }
    const index = indexByAgreement.get(agreementId);
    if (!index) {
      missing.push(`m2 for ${agreementId}`);
      continue;
    }
    const analysis = loadJson(abs);
    const localKind = new Map();
    const localForm = new Map();
    let localClosures = 0;
    for (const claim of analysis.claims ?? []) {
      const nodeId = claim.source_node_occurrence_ids?.[0];
      const node = typeof nodeId === 'string' ? index.nodesById.get(nodeId) : null;
      if (!node?.extent_span) continue;
      const start = node.extent_span.start_byte;
      const end = node.extent_span.end_byte;
      const span = verifySlice(index.bytes, start, end);
      if (!span.verified) {
        shaFailed += 1;
        continue;
      }
      shaVerified += 1;
      const text = index.bytes.subarray(start, end).toString('utf8');
      const hits = scanText(text, index.bytes, start);
      closures += 1;
      localClosures += 1;
      for (const hit of hits) {
        increment(kindHist, hit.kind);
        increment(formHist, `${hit.kind}:${hit.form}`);
        increment(localKind, hit.kind);
        increment(localForm, `${hit.kind}:${hit.form}`);
        if (hit.span.verified) shaVerified += 1;
        else shaFailed += 1;
      }
    }
    agreementRows.push({
      agreement_id: agreementId,
      closures: localClosures,
      form_histogram: histogramObject(localForm),
      kind_histogram: histogramObject(localKind),
    });
  }

  const fixed50Forms = new Map();
  const fixed50Kinds = new Map();
  let fixed50Closures = 0;
  for (const item of q12.items ?? []) {
    const index = item.agreement_id ? indexByAgreement.get(item.agreement_id) : null;
    if (!index) continue;
    for (const node of item.nodes ?? []) {
      const start = node.span?.start_byte ?? node.start_byte ?? node.extent_span?.start_byte;
      const end = node.span?.end_byte ?? node.end_byte ?? node.extent_span?.end_byte;
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      const span = verifySlice(index.bytes, start, end);
      if (!span.verified) continue;
      const text = index.bytes.subarray(start, end).toString('utf8');
      const hits = scanText(text, index.bytes, start);
      fixed50Closures += 1;
      for (const hit of hits) {
        increment(fixed50Kinds, hit.kind);
        increment(fixed50Forms, `${hit.kind}:${hit.form}`);
      }
    }
  }

  agreementRows.sort((left, right) => compareText(left.agreement_id, right.agreement_id));
  const tablePayload = sortedObject({ agreements: agreementRows });
  const tableSha = sha256Hex(Buffer.from(`${JSON.stringify(tablePayload, null, 2)}\n`, 'utf8'));
  const report = sortedObject({
    schema: 'Q-0018-CLOSURE-VOCABULARY/V1',
    closure_definition: 'M2 node extent of each M4 claim (authored unit); fixed-50 also scans Q-0012 node spans',
    patterns: {
      enumerated_limb: String(LIMB_RE),
      modal: String(MODAL_RE),
      proviso: String(PROVISO_RE),
    },
    counts: {
      agreements: agreementRows.length,
      closures,
      fixed50_closures: fixed50Closures,
      sha_failed_spans: shaFailed,
      sha_verified_spans: shaVerified,
    },
    kind_histogram: histogramObject(kindHist),
    form_histogram: histogramObject(formHist),
    fixed50_kind_histogram: histogramObject(fixed50Kinds),
    fixed50_form_histogram: histogramObject(fixed50Forms),
    missing_paths: [...new Set(missing)].sort(compareText),
    table_sha256: tableSha,
    agreements: agreementRows,
  });

  writeFileSync(resolve(OUT_DIR, '18-closure-vocabulary.json'), `${JSON.stringify(report, null, 2)}\n`);
  const out = [
    `agreements ${report.counts.agreements}`,
    `closures ${closures}`,
    `modals ${kindHist.get('modal') ?? 0}`,
    `enumerated_limbs ${kindHist.get('enumerated_limb') ?? 0}`,
    `provisos ${kindHist.get('proviso') ?? 0}`,
    `distinct_forms ${formHist.size}`,
    `fixed50_closures ${fixed50Closures}`,
    `sha_verified_spans ${shaVerified}`,
    `sha_failed_spans ${shaFailed}`,
    `table_sha256 ${tableSha}`,
  ];
  writeFileSync(resolve(OUT_DIR, '18-closure-vocabulary.out'), `${out.join('\n')}\n`);

  const lines = [
    '# Closure-text vocabulary (Q-0018)',
    '',
    'Closure text is the M2 node extent of each M4 claim (the authored unit). The scan is regex over that slice: modals `shall|may|will|must|should`; enumerated limbs `(i)` / `(a)` / `(1)`; provisos `provided that` / `provided, however, that` / `except that|as|for`.',
    '',
    `- Closures: **${closures}**. Hits: modal **${kindHist.get('modal') ?? 0}**, limb **${kindHist.get('enumerated_limb') ?? 0}**, proviso **${kindHist.get('proviso') ?? 0}**. Distinct forms: **${formHist.size}**.`,
    `- Fixed-50 node spans: **${fixed50Closures}**.`,
    `- SHA-verified spans: **${shaVerified}**. Failed: **${shaFailed}**.`,
    '',
    '## Forms',
    '',
    '| Kind | Form | Count |',
    '| --- | --- | ---: |',
  ];
  for (const [key, count] of [...formHist.entries()].sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))) {
    const [kind, form] = key.split(':');
    lines.push(`| ${kind} | \`${form}\` | ${count} |`);
  }
  writeFileSync(resolve(OUT_DIR, '18-CLOSURE-VOCABULARY.md'), `${lines.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
