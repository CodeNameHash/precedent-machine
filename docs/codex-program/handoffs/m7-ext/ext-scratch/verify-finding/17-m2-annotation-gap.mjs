'use strict';

/**
 * Q-0017: size the M2 defined-term annotation gap on the ten Work 3
 * canonical texts. Parenthetical definitions are found by regex over
 * source_binding.canonical_text. Each match is compared to sealed M2
 * DEFINED_TERM_DEFINITION / DEFINED_TERM_USE annotations. Zero model
 * calls. Spans hashed with sha256Hex of the UTF-8 half-open byte slice.
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
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const ANNOTATOR_PATH = 'lib/canonical-v2/agreement-index.js';

const QUOTE_CHARS = '"\'\u201c\u201d\u2018\u2019\u201e';
const INTRO = String.raw`(?:(?:collectively|each|individually|together|hereinafter|herein)(?:\s*,)?\s+)*(?:(?:the|a|an)\s+)?`;
const PARENTHETICAL_DEF_RE = new RegExp(
  String.raw`\(\s*${INTRO}([${QUOTE_CHARS}])([^${QUOTE_CHARS}\n]{1,120})\s*([${QUOTE_CHARS}])\s*\)`,
  'gu',
);

const ANNOTATOR_QUOTED_TERM_RE = /[\u201c"]([^\u201d"\n]{1,120})[\u201d"]/g;
const ANNOTATOR_ALIAS = '[\u201c"]([^\u201d"\\n]{1,120})[\u201d"]';
const ANNOTATOR_HEAD_TAIL = new RegExp(
  `^(?:\\s*(?:,?\\s*(?:and|or)\\s+|,?\\s*including\\s+the\\s+correlative\\s+term\\s+)${ANNOTATOR_ALIAS})*\\s*(?:means|shall mean|has the meaning|shall have the meaning)\\b`,
  'i',
);
const ANNOTATOR_INTRODUCED_BEFORE = /\breferred to(?:(?:\s+(?:collectively|individually|herein|hereinafter))|(?:\s+in this Agreement))*\s+as\s+(?:(?:the|a|an)\s+)?$/i;
const ANNOTATOR_PAREN_INTRO = /\((?:the|an?)\s*$/i;

const FIELD_CITES = Object.freeze({
  quoted_term_pattern: {
    path: ANNOTATOR_PATH,
    line: 1788,
    text: 'const quotedTermPattern = /[\\u201c"]([^\\u201d"\\n]{1,120})[\\u201d"]/g;',
    note: 'Accepts straight double and curly double quotes only. Omits straight and curly single quotes.',
  },
  parenthetical_introduction: {
    path: ANNOTATOR_PATH,
    line: 1809,
    text: 'const parentheticalIntroduction = /\\((?:the|an?)\\s*$/i.test(prefix) && /^\\s*\\)/.test(suffix);',
    note: 'Requires (the|a|an) immediately before the opening quote, so ("Parent"), (collectively, the "Parties"), and (each, a "Party") fail.',
  },
  is_definition_gate: {
    path: ANNOTATOR_PATH,
    line: 1811,
    text: 'const isDefinition = introducedBefore || parentheticalIntroduction || definitionHeadTailPattern.test(suffix);',
  },
  drop_non_definition: {
    path: ANNOTATOR_PATH,
    line: 1819,
    text: 'if (!occurrence.isDefinition && !definedTerms.has(occurrence.value)) continue;',
    note: 'A quoted term that is never classified as a definition is dropped: no DEFINITION and no USE.',
  },
});

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function rel(path) {
  return relative(repoRoot, path).split('\\').join('/');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort(compareText)) {
      out[key] = sortedObject(value[key]);
    }
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
  for (const key of keys) out[String(key)] = map.get(key);
  return out;
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

function verifyReportedSpan(canonicalBytes, span) {
  if (!span || !Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)) {
    return { start_byte: span?.start_byte ?? null, end_byte: span?.end_byte ?? null, text_sha256: null, verified: false };
  }
  const hashed = hashSpan(canonicalBytes, span.start_byte, span.end_byte);
  if (hashed === null) {
    return {
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      text_sha256: typeof span.text_sha256 === 'string' ? span.text_sha256 : null,
      verified: false,
    };
  }
  return {
    start_byte: span.start_byte,
    end_byte: span.end_byte,
    text_sha256: hashed,
    verified: true,
    stored_sha256_mismatch: typeof span.text_sha256 === 'string' && span.text_sha256 !== hashed,
  };
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
  const pair = `${open}${close}`;
  if (open === '"' && close === '"') return 'straight_double';
  if ((open === '\u201c' || open === '\u201d' || open === '\u201e')
    && (close === '\u201c' || close === '\u201d' || close === '\u201e')) {
    return 'curly_double';
  }
  if (open === "'" && close === "'") return 'straight_single';
  if ((open === '\u2018' || open === '\u2019') && (close === '\u2018' || close === '\u2019')) {
    return 'curly_single';
  }
  if ((open === '"' || open === '\u201c' || open === '\u201d')
    && (close === '"' || close === '\u201c' || close === '\u201d')) {
    return 'mixed_double';
  }
  return `mixed:${pair}`;
}

function annotatorQuotePatternAccepts(open, close) {
  return (open === '"' || open === '\u201c') && (close === '"' || close === '\u201d');
}

function annotatorWouldClassifyDefinition(sourceText, quoteStartChar, quotedLength) {
  const prefix = sourceText.slice(Math.max(0, quoteStartChar - 140), quoteStartChar);
  const suffix = sourceText.slice(quoteStartChar + quotedLength, quoteStartChar + quotedLength + 320);
  const introducedBefore = ANNOTATOR_INTRODUCED_BEFORE.test(prefix);
  const parentheticalIntroduction = ANNOTATOR_PAREN_INTRO.test(prefix) && /^\s*\)/.test(suffix);
  const headTail = ANNOTATOR_HEAD_TAIL.test(suffix);
  return {
    introduced_before: introducedBefore,
    parenthetical_introduction: parentheticalIntroduction,
    definition_head_tail: headTail,
    is_definition: introducedBefore || parentheticalIntroduction || headTail,
  };
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
    if (Number.isInteger(firstArticleStart) && node.extent_span.start_byte >= firstArticleStart) {
      return false;
    }
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
  return {
    start_byte: start,
    end_byte: end,
    node_count: preambleNodes.length,
    first_article_start_byte: firstArticleStart,
  };
}

function countRawOccurrences(sourceText, term) {
  if (typeof term !== 'string' || term.length === 0) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = sourceText.indexOf(term, cursor)) !== -1) {
    const before = sourceText[cursor - 1] || '';
    const after = sourceText[cursor + term.length] || '';
    if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) count += 1;
    cursor += term.length;
  }
  return count;
}

function emptyQuoteSplit() {
  return {
    curly_double: 0,
    curly_single: 0,
    mixed_double: 0,
    straight_double: 0,
    straight_single: 0,
    other: 0,
  };
}

function bumpQuoteSplit(split, style) {
  if (Object.prototype.hasOwnProperty.call(split, style)) split[style] += 1;
  else split.other += 1;
}

function citeAnnotatorLines() {
  const abs = resolve(repoRoot, ANNOTATOR_PATH);
  const source = readFileSync(abs, 'utf8').split('\n');
  const cites = {};
  for (const [key, spec] of Object.entries(FIELD_CITES)) {
    const line = source[spec.line - 1] ?? '';
    cites[key] = {
      ...spec,
      observed_line_text: line.trim(),
    };
  }
  return cites;
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
    const termStartByte = quotedStartByte + Buffer.byteLength(open, 'utf8');
    const termEndByte = termStartByte + Buffer.byteLength(match[2], 'utf8');
    const quotedSpan = verifySlice(canonicalBytes, quotedStartByte, quotedEndByte);
    const termSpan = verifySlice(canonicalBytes, termStartByte, termEndByte);
    const quoteStyle = classifyQuoteStyle(open, close);
    const classification = annotatorWouldClassifyDefinition(sourceText, quoteStartChar, quoted.length);
    matches.push({
      annotator_quote_pattern_accepts: annotatorQuotePatternAccepts(open, close),
      annotator_would_classify_definition: classification.is_definition,
      annotator_predicates: classification,
      close_quote: close,
      open_quote: open,
      paren_span: verifySlice(
        canonicalBytes,
        charIndexToByte(sourceText, match.index),
        charIndexToByte(sourceText, match.index) + Buffer.byteLength(match[0], 'utf8'),
      ),
      quote_style: quoteStyle,
      quoted_span: quotedSpan,
      term,
      term_span: termSpan,
    });
  }
  return matches;
}

function summariseBucket(matches, unannotatedTerms) {
  const quoteSplit = emptyQuoteSplit();
  const unannotatedQuoteSplit = emptyQuoteSplit();
  let annotated = 0;
  let unannotated = 0;
  for (const row of matches) {
    bumpQuoteSplit(quoteSplit, row.quote_style);
    if (row.m2_definition_overlapping) annotated += 1;
    else {
      unannotated += 1;
      bumpQuoteSplit(unannotatedQuoteSplit, row.quote_style);
    }
  }
  return {
    annotated,
    matches: matches.length,
    quote_style_histogram: quoteSplit,
    unannotated,
    unannotated_quote_style_histogram: unannotatedQuoteSplit,
    unannotated_terms: unannotatedTerms,
  };
}

function renderOut(report) {
  const lines = [
    `agreements ${report.counts.agreements}`,
    `matches ${report.counts.matches}`,
    `annotated ${report.counts.annotated}`,
    `unannotated ${report.counts.unannotated}`,
    `preamble_matches ${report.counts.preamble_matches}`,
    `preamble_annotated ${report.counts.preamble_annotated}`,
    `preamble_unannotated ${report.counts.preamble_unannotated}`,
    `unannotated_quote_pattern_rejects ${report.counts.unannotated_quote_pattern_rejects}`,
    `unannotated_quote_pattern_accepts_but_not_definition ${report.counts.unannotated_quote_pattern_accepts_but_not_definition}`,
    `sha_mismatch_spans ${report.counts.sha_mismatch_spans}`,
    `sha_verified_spans ${report.counts.sha_verified_spans}`,
    `table_sha256 ${report.table_sha256}`,
    `missing_paths ${report.missing_paths.length}`,
  ];
  for (const path of report.missing_paths) lines.push(`  ${path}`);
  return `${lines.join('\n')}\n`;
}

function shortId(agreementId) {
  return typeof agreementId === 'string' ? agreementId.slice(0, 12) : '—';
}

function renderTermList(terms) {
  if (!terms || terms.length === 0) return '—';
  return terms.map((row) => {
    const uses = `raw ${row.raw_occurrences}, M2 uses ${row.m2_use_count}`;
    return `\`${row.term}\` (${uses})`;
  }).join('; ');
}

function renderMarkdown(report) {
  const cites = report.annotator_cites;
  const lines = [
    '# M2 defined-term annotation gap (Q-0017)',
    '',
    'Parenthetical definitions are regex matches on `source_binding.canonical_text` of the form `(the "Company")`, `("Parent")`, `(collectively, the "Parties")`, `(each, a "Party")`, and the same shapes with curly or single quotes. A match is annotated when a sealed M2 `DEFINED_TERM_DEFINITION` overlaps the quoted span or the inner term span. Use counts are existing `DEFINED_TERM_USE` annotations whose `value` equals the term string. Raw occurrences use the same alphanumeric-boundary `indexOf` scan as `agreement-index.js:1840`.',
    '',
    '## Annotator',
    '',
    `- Quoted-term scan: \`${cites.quoted_term_pattern.path}:${cites.quoted_term_pattern.line}\` — \`${cites.quoted_term_pattern.observed_line_text}\`. ${cites.quoted_term_pattern.note}`,
    `- Parenthetical-definition predicate: \`${cites.parenthetical_introduction.path}:${cites.parenthetical_introduction.line}\` — \`${cites.parenthetical_introduction.observed_line_text}\`. ${cites.parenthetical_introduction.note}`,
    `- Combined definition gate: \`${cites.is_definition_gate.path}:${cites.is_definition_gate.line}\`.`,
    `- Drop if never a definition: \`${cites.drop_non_definition.path}:${cites.drop_non_definition.line}\`.`,
    '',
    report.cause_finding,
    '',
    '## Corpus',
    '',
    `- Matches: **${report.counts.matches}**. Annotated: **${report.counts.annotated}**. Unannotated: **${report.counts.unannotated}**.`,
    `- Preamble window only: **${report.counts.preamble_matches}** matches; annotated **${report.counts.preamble_annotated}**; unannotated **${report.counts.preamble_unannotated}**.`,
    `- Unannotated matches the annotator quote pattern rejects (line 1788): **${report.counts.unannotated_quote_pattern_rejects}**.`,
    `- Unannotated matches the quote pattern accepts but the definition predicates reject (lines 1808–1813): **${report.counts.unannotated_quote_pattern_accepts_but_not_definition}**.`,
    `- SHA-verified reported spans: **${report.counts.sha_verified_spans}**. Stored-hash mismatches: **${report.counts.sha_mismatch_spans}**.`,
    '',
    '## Per agreement',
    '',
    '| Agreement | Matches | Annotated | Unannotated | Preamble unann. | Straight " | Curly “ ” | Single |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.agreements) {
    const quotes = row.all.quote_style_histogram;
    const singles = (quotes.straight_single ?? 0) + (quotes.curly_single ?? 0);
    lines.push(
      `| \`${shortId(row.agreement_id)}\` | ${row.all.matches} | ${row.all.annotated} | ${row.all.unannotated} | ${row.preamble.unannotated} | ${quotes.straight_double ?? 0} | ${quotes.curly_double ?? 0} | ${singles} |`,
    );
  }

  lines.push('', '## Unannotated terms', '');
  for (const row of report.agreements) {
    lines.push(`### \`${shortId(row.agreement_id)}\``);
    lines.push('');
    lines.push(`Whole text: ${renderTermList(row.all.unannotated_terms)}`);
    lines.push('');
    lines.push(`Preamble only: ${renderTermList(row.preamble.unannotated_terms)}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function bumpSha(counts, span) {
  if (!span || typeof span !== 'object') return;
  if (span.verified === true) counts.sha_verified_spans += 1;
  if (span.stored_sha256_mismatch === true) counts.sha_mismatch_spans += 1;
  if (
    span.verified === false
    && Number.isInteger(span.start_byte)
    && Number.isInteger(span.end_byte)
  ) {
    counts.sha_failed_spans += 1;
  }
}

function termSummary(matches, sourceText, useByTerm) {
  const byTerm = new Map();
  for (const row of matches) {
    if (row.m2_definition_overlapping) continue;
    if (!byTerm.has(row.term)) {
      byTerm.set(row.term, {
        term: row.term,
        unannotated_match_count: 0,
        quote_styles: new Set(),
        raw_occurrences: countRawOccurrences(sourceText, row.term),
        m2_use_count: useByTerm.get(row.term) ?? 0,
      });
    }
    const entry = byTerm.get(row.term);
    entry.unannotated_match_count += 1;
    entry.quote_styles.add(row.quote_style);
  }
  return [...byTerm.values()]
    .map((entry) => ({
      m2_use_count: entry.m2_use_count,
      quote_styles: [...entry.quote_styles].sort(compareText),
      raw_occurrences: entry.raw_occurrences,
      term: entry.term,
      unannotated_match_count: entry.unannotated_match_count,
    }))
    .sort((left, right) => compareText(left.term, right.term));
}

function main() {
  const missingPaths = [];
  if (!existsSync(INDEX_SET_PATH)) missingPaths.push(rel(INDEX_SET_PATH));
  if (!existsSync(resolve(repoRoot, ANNOTATOR_PATH))) missingPaths.push(ANNOTATOR_PATH);
  if (missingPaths.length > 0) {
    const failed = { error: 'required_file_missing', missing_paths: missingPaths };
    writeFileSync(resolve(OUT_DIR, '17-m2-annotation-gap.out'), `${JSON.stringify(failed, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(failed, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const indexSet = loadJson(INDEX_SET_PATH);
  const annotatorCites = citeAnnotatorLines();
  const shaCounts = { sha_verified_spans: 0, sha_mismatch_spans: 0, sha_failed_spans: 0 };
  const agreementRows = [];
  let matchesTotal = 0;
  let annotatedTotal = 0;
  let unannotatedTotal = 0;
  let preambleMatches = 0;
  let preambleAnnotated = 0;
  let preambleUnannotated = 0;
  let quoteRejects = 0;
  let quoteAcceptsNotDef = 0;

  const members = [...(indexSet.members ?? [])].sort((left, right) =>
    compareText(left.agreement_id ?? left.path ?? '', right.agreement_id ?? right.path ?? ''));

  for (const member of members) {
    const memberPath = member?.path;
    if (typeof memberPath !== 'string' || memberPath.length === 0) {
      missingPaths.push('work3-index-set member missing path');
      continue;
    }
    const abs = resolve(repoRoot, memberPath);
    if (!existsSync(abs)) {
      missingPaths.push(memberPath);
      continue;
    }
    const record = loadJson(abs);
    const agreementId = record?.source_binding?.agreement_id ?? member.agreement_id ?? null;
    const canonicalText = record?.source_binding?.canonical_text;
    if (typeof canonicalText !== 'string') {
      missingPaths.push(`${memberPath} missing source_binding.canonical_text`);
      continue;
    }
    const canonicalBytes = Buffer.from(canonicalText, 'utf8');
    const nodes = Array.isArray(record.nodes) ? record.nodes : [];
    const annotations = Array.isArray(record.annotations) ? record.annotations : [];
    const preamble = extractPreambleWindow(nodes);
    const preambleSpan = { start_byte: preamble.start_byte, end_byte: preamble.end_byte };

    const definitions = [];
    const useByTerm = new Map();
    for (const annotation of annotations) {
      if (annotation?.annotation_kind === 'DEFINED_TERM_DEFINITION') {
        const span = verifyReportedSpan(canonicalBytes, annotation.span);
        bumpSha(shaCounts, span);
        definitions.push({
          annotation_occurrence_id: annotation.annotation_occurrence_id ?? null,
          span,
          value: typeof annotation.value === 'string' ? annotation.value : null,
        });
      } else if (annotation?.annotation_kind === 'DEFINED_TERM_USE') {
        if (typeof annotation.value === 'string') increment(useByTerm, annotation.value);
      }
    }

    const matches = findMatches(canonicalText, canonicalBytes);
    const enriched = [];
    for (const match of matches) {
      bumpSha(shaCounts, match.quoted_span);
      bumpSha(shaCounts, match.term_span);
      bumpSha(shaCounts, match.paren_span);
      const overlapping = definitions.filter((definition) => (
        spansOverlap(definition.span, match.quoted_span)
        || spansOverlap(definition.span, match.term_span)
      ));
      const inPreamble = spanInside(match.quoted_span, preambleSpan)
        || spanInside(match.term_span, preambleSpan);
      const annotated = overlapping.length > 0;
      const row = {
        ...match,
        in_preamble: inPreamble,
        m2_definition_overlapping: annotated,
        m2_overlapping_definitions: overlapping.map((definition) => ({
          annotation_occurrence_id: definition.annotation_occurrence_id,
          span: definition.span,
          value: definition.value,
        })),
        m2_use_count: useByTerm.get(match.term) ?? 0,
      };
      enriched.push(row);
      matchesTotal += 1;
      if (annotated) annotatedTotal += 1;
      else {
        unannotatedTotal += 1;
        if (!row.annotator_quote_pattern_accepts) quoteRejects += 1;
        else if (!row.annotator_would_classify_definition) quoteAcceptsNotDef += 1;
      }
      if (inPreamble) {
        preambleMatches += 1;
        if (annotated) preambleAnnotated += 1;
        else preambleUnannotated += 1;
      }
    }

    const preambleMatchesOnly = enriched.filter((row) => row.in_preamble);
    agreementRows.push({
      agreement_id: agreementId,
      all: summariseBucket(enriched, termSummary(enriched, canonicalText, useByTerm)),
      m2_path: memberPath,
      preamble,
      preamble_bucket: summariseBucket(
        preambleMatchesOnly,
        termSummary(preambleMatchesOnly, canonicalText, useByTerm),
      ),
    });
    agreementRows[agreementRows.length - 1].preamble_summary = agreementRows[agreementRows.length - 1].preamble_bucket;
    agreementRows[agreementRows.length - 1].preamble = {
      ...preamble,
      ...agreementRows[agreementRows.length - 1].preamble_bucket,
    };
    delete agreementRows[agreementRows.length - 1].preamble_bucket;
    delete agreementRows[agreementRows.length - 1].preamble_summary;
  }

  const uniqueMissing = [...new Set(missingPaths)].sort(compareText);
  const tablePayload = sortedObject({ agreements: agreementRows });
  const tableJson = `${JSON.stringify(tablePayload, null, 2)}\n`;
  const tableSha = sha256Hex(Buffer.from(tableJson, 'utf8'));

  let causeFinding;
  if (unannotatedTotal === 0) {
    causeFinding = 'No unannotated parenthetical matches. The annotator quote handling is not a gap on this regex.';
  } else if (quoteRejects > 0 && quoteRejects >= quoteAcceptsNotDef) {
    causeFinding = `The annotator's quote handling is a cause: ${quoteRejects} of ${unannotatedTotal} unannotated matches use a quote pair \`quotedTermPattern\` at ${ANNOTATOR_PATH}:1788 does not accept. ${quoteAcceptsNotDef} more pass that pattern and then fail the definition predicates at ${ANNOTATOR_PATH}:1808–1813.`;
  } else if (quoteAcceptsNotDef > 0) {
    causeFinding = `The annotator's quote handling is not the main cause. ${quoteAcceptsNotDef} of ${unannotatedTotal} unannotated matches use a quote pair \`quotedTermPattern\` at ${ANNOTATOR_PATH}:1788 already accepts; they fail the definition predicates at ${ANNOTATOR_PATH}:1809 (\`parentheticalIntroduction\` requires \`(the|a|an)\` immediately before the quote, so \`("Parent")\`, \`(collectively, the "Parties")\`, and \`(each, a "Party")\` never become definitions) and are then dropped at ${ANNOTATOR_PATH}:1819. Quote-pattern rejects: ${quoteRejects}.`;
  } else {
    causeFinding = `Unannotated matches: ${unannotatedTotal}. Quote-pattern rejects (line 1788): ${quoteRejects}. Quote-pattern accepts that fail the definition predicates (lines 1808–1813): ${quoteAcceptsNotDef}.`;
  }

  const report = sortedObject({
    schema: 'Q-0017-M2-ANNOTATION-GAP/V1',
    agreement_index_set_id: indexSet.agreement_index_set_id ?? null,
    annotator_cites: annotatorCites,
    cause_finding: causeFinding,
    parenthetical_pattern: String(PARENTHETICAL_DEF_RE),
    counts: {
      agreements: agreementRows.length,
      annotated: annotatedTotal,
      matches: matchesTotal,
      preamble_annotated: preambleAnnotated,
      preamble_matches: preambleMatches,
      preamble_unannotated: preambleUnannotated,
      sha_failed_spans: shaCounts.sha_failed_spans,
      sha_mismatch_spans: shaCounts.sha_mismatch_spans,
      sha_verified_spans: shaCounts.sha_verified_spans,
      unannotated: unannotatedTotal,
      unannotated_quote_pattern_accepts_but_not_definition: quoteAcceptsNotDef,
      unannotated_quote_pattern_rejects: quoteRejects,
    },
    missing_paths: uniqueMissing,
    table_sha256: tableSha,
    agreements: agreementRows,
  });

  writeFileSync(resolve(OUT_DIR, '17-m2-annotation-gap.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(OUT_DIR, '17-m2-annotation-gap.out'), renderOut(report));
  writeFileSync(resolve(OUT_DIR, '17-M2-ANNOTATION-GAP.md'), renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
