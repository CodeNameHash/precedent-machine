'use strict';

/**
 * Q-0022: the 16 Q-0016 disagreement classes as rows for Ben.
 * Candidate texts are the existing M3 candidate spans. No invented target.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const Q16_PATH = resolve(OUT_DIR, '16-definition-rules.json');
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);

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

function hashSpan(canonicalBytes, start, end) {
  if (!canonicalBytes || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || end > canonicalBytes.length) return null;
  return sha256Hex(canonicalBytes.subarray(start, end));
}

function verifySlice(canonicalBytes, start, end) {
  const hashed = hashSpan(canonicalBytes, start, end);
  if (hashed === null) {
    return { start_byte: start ?? null, end_byte: end ?? null, text_sha256: null, verified: false, text: null };
  }
  const text = canonicalBytes.subarray(start, end).toString('utf8');
  return { start_byte: start, end_byte: end, text_sha256: hashed, verified: true, text };
}

function whitespaceNormalise(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim();
}

function classKey(row) {
  const locs = (row.targets ?? [])
    .map((target) => `${target.rule}:${target.location}`)
    .sort(compareText)
    .join(' vs ');
  return `${row.term ?? '—'} | ${locs}`;
}

function candidateFromTarget(target, canonicalBytes) {
  const span = verifySlice(canonicalBytes, target.span?.start_byte, target.span?.end_byte);
  return {
    annotation_occurrence_id: target.annotation_occurrence_id ?? null,
    first_120_bytes: span.verified ? span.text.slice(0, 120) : null,
    location: target.location ?? null,
    rule: target.rule ?? null,
    span: {
      end_byte: span.end_byte,
      start_byte: span.start_byte,
      text_sha256: span.text_sha256,
      verified: span.verified,
    },
    value: target.value ?? null,
  };
}

function shortId(agreementId) {
  return typeof agreementId === 'string' ? agreementId.slice(0, 12) : '—';
}

function main() {
  const missing = [];
  if (!existsSync(Q16_PATH)) missing.push(relative(repoRoot, Q16_PATH));
  if (!existsSync(INDEX_SET_PATH)) missing.push(relative(repoRoot, INDEX_SET_PATH));
  if (missing.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: 'missing', missing }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const q16 = loadJson(Q16_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const bytesByAgreement = new Map();
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
    if (typeof agreementId === 'string' && typeof text === 'string') {
      bytesByAgreement.set(agreementId, Buffer.from(text, 'utf8'));
    }
  }

  const groups = new Map();
  for (const row of q16.disagreements ?? []) {
    const key = classKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const classes = [];
  let shaVerified = 0;
  let shaMismatch = 0;
  for (const key of [...groups.keys()].sort(compareText)) {
    const rows = groups.get(key).slice().sort((left, right) => {
      const agreement = compareText(left.agreement_id ?? '', right.agreement_id ?? '');
      if (agreement !== 0) return agreement;
      return compareText(left.edge_id ?? '', right.edge_id ?? '');
    });
    const representative = rows[0];
    const canonicalBytes = bytesByAgreement.get(representative.agreement_id) ?? null;
    const targets = [...(representative.targets ?? [])].sort((left, right) => compareText(left.rule ?? '', right.rule ?? ''));
    const candidateA = targets[0] ? candidateFromTarget(targets[0], canonicalBytes) : null;
    const candidateB = targets[1] ? candidateFromTarget(targets[1], canonicalBytes) : null;
    if (candidateA?.span.verified) shaVerified += 1;
    if (candidateB?.span.verified) shaVerified += 1;
    const textA = candidateA?.span.verified
      ? canonicalBytes.subarray(candidateA.span.start_byte, candidateA.span.end_byte).toString('utf8')
      : null;
    const textB = candidateB?.span.verified
      ? canonicalBytes.subarray(candidateB.span.start_byte, candidateB.span.end_byte).toString('utf8')
      : null;
    const identical = textA !== null && textB !== null
      ? whitespaceNormalise(textA) === whitespaceNormalise(textB)
      : null;
    const agreements = [...new Set(rows.map((row) => row.agreement_id).filter(Boolean))].sort(compareText);
    classes.push({
      agreements_affected: agreements,
      candidate_a: candidateA,
      candidate_b: candidateB,
      class_key: key,
      edge_count: rows.length,
      representative_agreement_id: representative.agreement_id ?? null,
      representative_edge_id: representative.edge_id ?? null,
      term: representative.term ?? key.split(' | ')[0],
      texts_byte_identical_after_whitespace_normalisation: identical,
    });
  }

  const tablePayload = sortedObject({ classes });
  const tableSha = sha256Hex(Buffer.from(`${JSON.stringify(tablePayload, null, 2)}\n`, 'utf8'));
  const report = sortedObject({
    schema: 'Q-0022-DEFINITION-DISAGREEMENT-CLASSES/V1',
    counts: {
      classes: classes.length,
      sha_mismatch_spans: shaMismatch,
      sha_verified_spans: shaVerified,
      total_disagreement_edges: q16.counts?.rule_disagreements ?? (q16.disagreements ?? []).length,
    },
    missing_paths: missing,
    table_sha256: tableSha,
    classes,
  });

  writeFileSync(resolve(OUT_DIR, '22-definition-classes.json'), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Definition disagreement classes (Q-0022)',
    '',
    'One row per Q-0016 rule-disagreement class. Candidate A is the earlier rule id; candidate B is the later. Texts are the existing M3 candidate annotation spans. Ben rules per row.',
    '',
    `- Classes: **${classes.length}**. Edges: **${report.counts.total_disagreement_edges}**. SHA-verified candidate spans: **${shaVerified}**. Mismatches: **${shaMismatch}**.`,
    '',
    '| Term | Edges | A location | A span | B location | B span | Identical after whitespace? | Agreements |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of classes) {
    const a = row.candidate_a;
    const b = row.candidate_b;
    lines.push(
      `| ${row.term} | ${row.edge_count} | ${a?.location ?? '—'} | ${a?.span.start_byte}–${a?.span.end_byte} | ${b?.location ?? '—'} | ${b?.span.start_byte}–${b?.span.end_byte} | ${row.texts_byte_identical_after_whitespace_normalisation === null ? '—' : row.texts_byte_identical_after_whitespace_normalisation ? 'yes' : 'no'} | ${row.agreements_affected.map(shortId).join(', ')} |`,
    );
  }
  lines.push('', '### Candidate texts (first 120 bytes)', '');
  for (const row of classes) {
    lines.push(`**${row.term}** (\`${row.class_key}\`)`);
    lines.push('');
    lines.push(`- A (${row.candidate_a?.rule}, ${row.candidate_a?.location}): \`${JSON.stringify(row.candidate_a?.first_120_bytes)}\``);
    lines.push(`- B (${row.candidate_b?.rule}, ${row.candidate_b?.location}): \`${JSON.stringify(row.candidate_b?.first_120_bytes)}\``);
    lines.push('');
  }
  writeFileSync(resolve(OUT_DIR, '22-DEFINITION-CLASSES.md'), `${lines.join('\n')}\n`);

  const out = [
    `classes ${classes.length}`,
    `edges ${report.counts.total_disagreement_edges}`,
    `sha_verified_spans ${shaVerified}`,
    `sha_mismatch_spans ${shaMismatch}`,
    `table_sha256 ${tableSha}`,
  ];
  writeFileSync(resolve(OUT_DIR, '22-definition-classes.out'), `${out.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
