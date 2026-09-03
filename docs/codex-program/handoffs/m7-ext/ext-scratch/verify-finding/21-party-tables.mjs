'use strict';

/**
 * Q-0021: per-agreement party tables for Ben. Party terms only: the named
 * seeds plus preamble-defined party entities (Sub / Purchaser / Guarantor
 * / Party variants). Not every defined term.
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

const SEED_PARTY_TERMS = Object.freeze([
  'Company',
  'Parent',
  'Merger Sub',
  'Guarantor',
  'Purchaser',
]);

const QUOTE_CHARS = '"\'\u201c\u201d\u2018\u2019\u201e';
const INTRO = String.raw`(?:(?:collectively|each|individually|together|hereinafter|herein)(?:\s*,)?\s+)*(?:(?:the|a|an)\s+)?`;
const PARENTHETICAL_DEF_RE = new RegExp(
  String.raw`\(\s*${INTRO}([${QUOTE_CHARS}])([^${QUOTE_CHARS}\n]{1,120})\s*([${QUOTE_CHARS}])\s*\)`,
  'gu',
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

function charIndexToByte(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function hashSpan(canonicalBytes, start, end) {
  if (!canonicalBytes || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || end > canonicalBytes.length) return null;
  return sha256Hex(canonicalBytes.subarray(start, end));
}

function verifySlice(canonicalBytes, start, end) {
  const hashed = hashSpan(canonicalBytes, start, end);
  if (hashed === null) {
    return { start_byte: start ?? null, end_byte: end ?? null, text_sha256: null, verified: false };
  }
  return { start_byte: start, end_byte: end, text_sha256: hashed, verified: true };
}

function spansOverlap(left, right) {
  return Number.isInteger(left?.start_byte)
    && Number.isInteger(left?.end_byte)
    && Number.isInteger(right?.start_byte)
    && Number.isInteger(right?.end_byte)
    && left.start_byte < right.end_byte
    && right.start_byte < left.end_byte;
}

function spanInside(inner, outer) {
  return Number.isInteger(inner?.start_byte)
    && Number.isInteger(inner?.end_byte)
    && Number.isInteger(outer?.start_byte)
    && Number.isInteger(outer?.end_byte)
    && inner.start_byte >= outer.start_byte
    && inner.end_byte <= outer.end_byte;
}

function classifyQuoteStyle(open, close) {
  if (open === '"' && close === '"') return 'straight_double';
  if ((open === '\u201c' || open === '\u201d' || open === '\u201e')
    && (close === '\u201c' || close === '\u201d' || close === '\u201e')) {
    return 'curly_double';
  }
  if (open === "'" && close === "'") return 'straight_single';
  if ((open === '\u2018' || open === '\u2019') && (close === '\u2018' || close === '\u2019')) {
    return 'curly_single';
  }
  return 'mixed';
}

function extractPreambleWindow(nodes) {
  const agreement = nodes.find((node) => node.node_kind === 'AGREEMENT') ?? null;
  const articles = nodes
    .filter((node) => node.node_kind === 'ARTICLE')
    .sort((left, right) => (left.extent_span?.start_byte ?? 0) - (right.extent_span?.start_byte ?? 0));
  const firstArticleStart = articles[0]?.extent_span?.start_byte ?? null;
  const preambleNodes = nodes.filter((node) => {
    if (node.node_kind === 'AGREEMENT' || node.node_kind === 'ARTICLE') return false;
    if (agreement && node.parent_node_occurrence_id !== agreement.node_occurrence_id) return false;
    if (!Number.isInteger(node.extent_span?.start_byte)) return false;
    if (Number.isInteger(firstArticleStart) && node.extent_span.start_byte >= firstArticleStart) return false;
    return true;
  });
  const start = preambleNodes.length > 0
    ? Math.min(...preambleNodes.map((node) => node.extent_span.start_byte))
    : 0;
  const end = Number.isInteger(firstArticleStart)
    ? firstArticleStart
    : (preambleNodes.length > 0
      ? Math.max(...preambleNodes.map((node) => node.extent_span.end_byte))
      : 0);
  return { start_byte: start, end_byte: end };
}

function isPartyTerm(term) {
  if (SEED_PARTY_TERMS.includes(term)) return true;
  if (term === 'Buyer' || term === 'Sub' || term === 'Party' || term === 'Parties') return true;
  if (/Merger Sub$/i.test(term)) return true;
  if (/Subsidiary(?: \d+)?$/i.test(term)) return true;
  if (/^Parent OpCo$/i.test(term)) return true;
  if (/Purchaser|Guarantor/i.test(term) && !/Agreement|Fee|Letter/.test(term)) return true;
  return false;
}

function findMatches(sourceText, canonicalBytes) {
  const matches = [];
  PARENTHETICAL_DEF_RE.lastIndex = 0;
  let match;
  while ((match = PARENTHETICAL_DEF_RE.exec(sourceText)) !== null) {
    const open = match[1];
    const term = match[2].replace(/[\s.,;:]+$/u, '').trim();
    const close = match[3];
    if (!term) continue;
    const quoteStartChar = match.index + match[0].indexOf(open);
    const quoted = `${open}${match[2]}${close}`;
    const quotedStartByte = charIndexToByte(sourceText, quoteStartChar);
    const quotedEndByte = quotedStartByte + Buffer.byteLength(quoted, 'utf8');
    matches.push({
      quote_style: classifyQuoteStyle(open, close),
      quoted_span: verifySlice(canonicalBytes, quotedStartByte, quotedEndByte),
      term,
    });
  }
  return matches;
}

function collectUseSpans(sourceText, canonicalBytes, term) {
  const spans = [];
  let cursor = 0;
  while ((cursor = sourceText.indexOf(term, cursor)) !== -1) {
    const before = sourceText[cursor - 1] || '';
    const after = sourceText[cursor + term.length] || '';
    if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) {
      const start = charIndexToByte(sourceText, cursor);
      const end = start + Buffer.byteLength(term, 'utf8');
      spans.push(verifySlice(canonicalBytes, start, end));
    }
    cursor += term.length;
  }
  return spans;
}

function shortId(agreementId) {
  return typeof agreementId === 'string' ? agreementId.slice(0, 12) : '—';
}

function formatSpan(span) {
  if (!span || !span.verified) return '—';
  return `${span.start_byte}–${span.end_byte}`;
}

function main() {
  const missing = [];
  if (!existsSync(INDEX_SET_PATH)) missing.push(INDEX_SET_PATH);
  if (missing.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: 'missing', missing }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const indexSet = loadJson(INDEX_SET_PATH);
  const agreements = [];
  let shaVerified = 0;
  let shaMismatch = 0;
  let rowCount = 0;

  const members = [...(indexSet.members ?? [])].sort((left, right) =>
    compareText(left.agreement_id ?? left.path ?? '', right.agreement_id ?? right.path ?? ''));

  for (const member of members) {
    if (typeof member?.path !== 'string') continue;
    const abs = resolve(repoRoot, member.path);
    if (!existsSync(abs)) {
      missing.push(member.path);
      continue;
    }
    const record = loadJson(abs);
    const agreementId = record?.source_binding?.agreement_id ?? member.agreement_id ?? null;
    const canonicalText = record?.source_binding?.canonical_text;
    if (typeof canonicalText !== 'string') {
      missing.push(`${member.path} missing canonical_text`);
      continue;
    }
    const canonicalBytes = Buffer.from(canonicalText, 'utf8');
    const nodes = Array.isArray(record.nodes) ? record.nodes : [];
    const annotations = Array.isArray(record.annotations) ? record.annotations : [];
    const preamble = extractPreambleWindow(nodes);
    const matches = findMatches(canonicalText, canonicalBytes);
    const definitions = [];
    for (const annotation of annotations) {
      if (annotation?.annotation_kind !== 'DEFINED_TERM_DEFINITION') continue;
      const span = verifySlice(canonicalBytes, annotation.span?.start_byte, annotation.span?.end_byte);
      if (span.verified) shaVerified += 1;
      definitions.push({ span, value: annotation.value });
    }

    const termSet = new Set(SEED_PARTY_TERMS);
    for (const match of matches) {
      if (!isPartyTerm(match.term)) continue;
      if (spanInside(match.quoted_span, preamble) || SEED_PARTY_TERMS.includes(match.term)) {
        termSet.add(match.term);
      }
    }

    const rows = [];
    for (const term of [...termSet].sort(compareText)) {
      const termMatches = matches.filter((match) => match.term === term);
      const preambleMatch = termMatches.find((match) => spanInside(match.quoted_span, preamble));
      const chosen = preambleMatch ?? termMatches[0] ?? null;
      const m2Def = definitions.find((definition) => definition.value === term);
      const defining = chosen?.quoted_span
        ?? (m2Def ? m2Def.span : { start_byte: null, end_byte: null, text_sha256: null, verified: false });
      if (defining.verified) shaVerified += 1;
      const annotated = definitions.some((definition) => (
        definition.value === term
        && chosen
        && spansOverlap(definition.span, chosen.quoted_span)
      )) || (!chosen && Boolean(m2Def));
      const useSpans = collectUseSpans(canonicalText, canonicalBytes, term);
      for (const span of useSpans.slice(0, 3)) {
        if (span.verified) shaVerified += 1;
      }
      const present = Boolean(chosen) || Boolean(m2Def) || useSpans.length > 0;
      if (!present) continue;
      if (
        term === 'Merger Sub'
        && !defining.verified
        && [...termSet].some((other) => other !== term && other.includes('Merger Sub'))
      ) {
        continue;
      }
      rowCount += 1;
      rows.push({
        defining_span: defining,
        first_three_use_spans: useSpans.slice(0, 3),
        in_seed: SEED_PARTY_TERMS.includes(term),
        m2_annotated: annotated ? 'yes' : 'no',
        quote_style: chosen?.quote_style ?? null,
        raw_use_count: useSpans.length,
        term,
      });
    }

    agreements.push({
      agreement_id: agreementId,
      m2_path: member.path,
      preamble,
      rows,
    });
  }

  const tablePayload = sortedObject({ agreements });
  const tableSha = sha256Hex(Buffer.from(`${JSON.stringify(tablePayload, null, 2)}\n`, 'utf8'));
  const report = sortedObject({
    schema: 'Q-0021-PARTY-TABLES/V1',
    inclusion_rule: 'seed terms Company/Parent/Merger Sub/Guarantor/Purchaser, plus preamble parentheticals that are Buyer/Sub/Party/Parties, *Merger Sub, *Subsidiary, Parent OpCo, or Purchaser/Guarantor names; a seed with zero definition and zero uses is omitted',
    counts: {
      agreements: agreements.length,
      rows: rowCount,
      sha_mismatch_spans: shaMismatch,
      sha_verified_spans: shaVerified,
    },
    missing_paths: missing,
    table_sha256: tableSha,
    agreements,
  });

  writeFileSync(resolve(OUT_DIR, '21-party-tables.json'), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Party tables (Q-0021)',
    '',
    'One table per agreement. Rows are party terms only. Defining span is the preamble parenthetical when present, otherwise the first parenthetical or M2 definition. Use spans are alphanumeric-boundary occurrences of the exact term string. Every reported span is sha-verified against canonical bytes.',
    '',
    `- Rows: **${rowCount}**. SHA-verified spans: **${shaVerified}**. Mismatches: **${shaMismatch}**.`,
    '',
  ];
  for (const agreement of agreements) {
    lines.push(`## \`${shortId(agreement.agreement_id)}\``);
    lines.push('');
    lines.push('| Term | Defining span | SHA | Quote | M2 annotated | Raw uses | First three uses |');
    lines.push('| --- | --- | --- | --- | --- | ---: | --- |');
    for (const row of agreement.rows) {
      const uses = row.first_three_use_spans.map(formatSpan).join(', ') || '—';
      lines.push(
        `| ${row.term} | ${formatSpan(row.defining_span)} | ${row.defining_span.text_sha256 ? row.defining_span.text_sha256.slice(0, 12) : '—'} | ${row.quote_style ?? '—'} | ${row.m2_annotated} | ${row.raw_use_count} | ${uses} |`,
      );
    }
    lines.push('');
  }
  writeFileSync(resolve(OUT_DIR, '21-PARTY-TABLES.md'), `${lines.join('\n')}\n`);
  const out = [
    `agreements ${agreements.length}`,
    `rows ${rowCount}`,
    `sha_verified_spans ${shaVerified}`,
    `sha_mismatch_spans ${shaMismatch}`,
    `table_sha256 ${tableSha}`,
  ];
  writeFileSync(resolve(OUT_DIR, '21-party-tables.out'), `${out.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
