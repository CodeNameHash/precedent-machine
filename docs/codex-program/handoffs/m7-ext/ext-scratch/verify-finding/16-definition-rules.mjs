'use strict';

/**
 * Q-0016: two more deterministic definition rules on the Q-0014 AMBIGUOUS
 * edges. Rule 1 is the unique-Definitions-article rule from Q-0014. Rule 2
 * selects the unique candidate in the Q-0015 preamble window. Rule 3 selects
 * the nearest preceding candidate. Combined: 1 then 2 then 3, first hit.
 * Targets come only from existing M3 candidate annotation ids. Zero model
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
const CONTEXT_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json',
);
const Q12_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');

const DEFINITIONS_HEADING_RE = /definitions|defined terms|certain definitions/i;
const DEFINITIONS_NODE_KINDS = new Set(['ARTICLE', 'SECTION']);

const LOC = Object.freeze({
  PREAMBLE: 'preamble',
  DEFINITIONS_ARTICLE: 'definitions_article',
  INLINE_BODY: 'inline_body',
  UNVERIFIED: 'unverified',
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

function rateRecord(numerator, denominator) {
  return {
    denominator,
    numerator,
    rate: denominator === 0 ? null : Number((numerator / denominator).toFixed(10)),
    ratio: `${numerator}/${denominator}`,
  };
}

function completeSpan(span) {
  if (!span || typeof span !== 'object') return null;
  if (!Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)) return null;
  if (span.start_byte < 0 || span.end_byte < span.start_byte) return null;
  return {
    start_byte: span.start_byte,
    end_byte: span.end_byte,
    text_sha256: typeof span.text_sha256 === 'string' ? span.text_sha256 : null,
  };
}

function hashSpan(canonicalBytes, start, end) {
  if (!canonicalBytes || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || end > canonicalBytes.length) return null;
  return sha256Hex(canonicalBytes.subarray(start, end));
}

function verifyReportedSpan(canonicalBytes, span) {
  const complete = completeSpan(span);
  if (!complete) {
    return {
      start_byte: span?.start_byte ?? null,
      end_byte: span?.end_byte ?? null,
      text_sha256: null,
      verified: false,
    };
  }
  const hashed = hashSpan(canonicalBytes, complete.start_byte, complete.end_byte);
  if (hashed === null) {
    return {
      start_byte: complete.start_byte,
      end_byte: complete.end_byte,
      text_sha256: complete.text_sha256,
      verified: false,
    };
  }
  return {
    start_byte: complete.start_byte,
    end_byte: complete.end_byte,
    text_sha256: hashed,
    verified: true,
    stored_sha256_mismatch: typeof complete.text_sha256 === 'string' && complete.text_sha256 !== hashed,
  };
}

function spanInside(inner, outer) {
  return Number.isInteger(inner?.start_byte)
    && Number.isInteger(inner?.end_byte)
    && Number.isInteger(outer?.start_byte)
    && Number.isInteger(outer?.end_byte)
    && inner.start_byte >= outer.start_byte
    && inner.end_byte <= outer.end_byte;
}

function spanInsideAny(inner, outers) {
  return outers.some((outer) => spanInside(inner, outer));
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function histogramObject(map) {
  const keys = [...map.keys()].sort((left, right) => {
    const leftNum = Number(left);
    const rightNum = Number(right);
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
      return leftNum - rightNum;
    }
    return compareText(String(left), String(right));
  });
  const out = {};
  for (const key of keys) out[String(key)] = map.get(key);
  return out;
}

function headingRecord(node, byParent, canonicalBytes) {
  const heading = (byParent.get(node.node_occurrence_id) ?? [])
    .find((child) => child.node_kind === 'HEADING');
  if (!heading) {
    return {
      node_kind: node.node_kind ?? null,
      node_occurrence_id: node.node_occurrence_id ?? null,
      reference: typeof node.reference === 'string' ? node.reference : null,
      text: null,
      span: { start_byte: null, end_byte: null, text_sha256: null, verified: false },
    };
  }
  const span = verifyReportedSpan(canonicalBytes, heading.extent_span);
  const text = span.verified
    ? canonicalBytes.subarray(span.start_byte, span.end_byte).toString('utf8')
    : null;
  return {
    node_kind: node.node_kind ?? null,
    node_occurrence_id: node.node_occurrence_id ?? null,
    reference: typeof node.reference === 'string' ? node.reference : null,
    text,
    span,
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
    node_occurrence_ids: preambleNodes
      .map((node) => node.node_occurrence_id)
      .filter((id) => typeof id === 'string')
      .sort(compareText),
    node_count: preambleNodes.length,
    first_article_start_byte: firstArticleStart,
  };
}

function loadIndex(memberPath, missingPaths) {
  const abs = resolve(repoRoot, memberPath);
  if (!existsSync(abs)) {
    missingPaths.push(memberPath);
    return null;
  }
  const record = loadJson(abs);
  const agreementId = record?.source_binding?.agreement_id;
  const canonicalText = record?.source_binding?.canonical_text;
  const canonicalBytes = typeof canonicalText === 'string'
    ? Buffer.from(canonicalText, 'utf8')
    : null;
  const nodesById = new Map();
  const byParent = new Map();
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  for (const node of nodes) {
    if (typeof node?.node_occurrence_id !== 'string') continue;
    nodesById.set(node.node_occurrence_id, node);
    const parentId = node.parent_node_occurrence_id;
    if (typeof parentId === 'string' && parentId.length > 0) {
      const siblings = byParent.get(parentId) ?? [];
      siblings.push(node);
      byParent.set(parentId, siblings);
    }
  }
  const annotationsById = new Map();
  const definitionAnnotations = [];
  for (const annotation of Array.isArray(record.annotations) ? record.annotations : []) {
    if (typeof annotation?.annotation_occurrence_id === 'string') {
      annotationsById.set(annotation.annotation_occurrence_id, annotation);
    }
    if (annotation?.annotation_kind === 'DEFINED_TERM_DEFINITION') {
      definitionAnnotations.push(annotation);
    }
  }
  definitionAnnotations.sort((left, right) => {
    const start = (left.span?.start_byte ?? 0) - (right.span?.start_byte ?? 0);
    if (start !== 0) return start;
    return compareText(left.annotation_occurrence_id, right.annotation_occurrence_id);
  });
  return {
    path: memberPath,
    agreement_id: typeof agreementId === 'string' ? agreementId : null,
    canonical_bytes: canonicalBytes,
    nodesById,
    byParent,
    nodes,
    annotationsById,
    definitionAnnotations,
    preamble: extractPreambleWindow(nodes),
  };
}

function findDefinitionsArticles(index, missingPaths) {
  const matches = [];
  if (!index) return matches;
  for (const node of index.nodes) {
    if (!DEFINITIONS_NODE_KINDS.has(node.node_kind)) continue;
    const heading = headingRecord(node, index.byParent, index.canonical_bytes);
    if (typeof heading.text !== 'string' || !DEFINITIONS_HEADING_RE.test(heading.text)) continue;
    const extent = verifyReportedSpan(index.canonical_bytes, node.extent_span);
    if (!extent.verified) {
      missingPaths.push(`${index.path} definitions-article span failed sha verify (${node.node_occurrence_id})`);
    }
    matches.push({
      heading_span: heading.span,
      heading_text: heading.text,
      node_kind: heading.node_kind,
      node_occurrence_id: heading.node_occurrence_id,
      reference: heading.reference,
      extent_span: extent,
    });
  }
  matches.sort((left, right) => {
    const start = (left.extent_span.start_byte ?? 0) - (right.extent_span.start_byte ?? 0);
    if (start !== 0) return start;
    return compareText(left.node_occurrence_id ?? '', right.node_occurrence_id ?? '');
  });
  return matches;
}

function annotationSpan(index, annotation) {
  if (!annotation) return { start_byte: null, end_byte: null, text_sha256: null, verified: false };
  return verifyReportedSpan(index.canonical_bytes, annotation.span);
}

function locateSpan(span, preambleSpan, articleExtents) {
  if (!span?.verified) return LOC.UNVERIFIED;
  if (spanInside(span, preambleSpan)) return LOC.PREAMBLE;
  if (spanInsideAny(span, articleExtents)) return LOC.DEFINITIONS_ARTICLE;
  return LOC.INLINE_BODY;
}

function candidateRecords(edge, index, preambleSpan, articleExtents) {
  const annotationIds = Array.isArray(edge.target_definition_annotation_occurrence_ids)
    ? edge.target_definition_annotation_occurrence_ids.filter((id) => typeof id === 'string')
    : [];
  const distinctIds = [...new Set(annotationIds)];
  const records = [];
  for (const annotationId of distinctIds) {
    const annotation = index.annotationsById.get(annotationId);
    const span = annotationSpan(index, annotation);
    records.push({
      annotation_occurrence_id: annotationId,
      location: locateSpan(span, preambleSpan, articleExtents),
      owner_node_occurrence_id: annotation?.owner_node_occurrence_id ?? null,
      present_on_index: Boolean(annotation),
      span,
      value: typeof annotation?.value === 'string' ? annotation.value : null,
    });
  }
  records.sort((left, right) => {
    const start = (left.span.start_byte ?? 0) - (right.span.start_byte ?? 0);
    if (start !== 0) return start;
    return compareText(left.annotation_occurrence_id, right.annotation_occurrence_id);
  });
  return records;
}

function selectedFromCandidate(candidate) {
  if (!candidate) return null;
  return {
    annotation_occurrence_id: candidate.annotation_occurrence_id,
    location: candidate.location,
    owner_node_occurrence_id: candidate.owner_node_occurrence_id,
    span: candidate.span,
    value: candidate.value,
  };
}

function applyRule1(edge, index, articleExtents) {
  const term = typeof edge.term === 'string' ? edge.term : null;
  const articleExact = [];
  if (term !== null) {
    for (const annotation of index.definitionAnnotations) {
      if (annotation.value !== term) continue;
      const span = annotationSpan(index, annotation);
      if (span.verified && spanInsideAny(span, articleExtents)) {
        articleExact.push({
          annotation_occurrence_id: annotation.annotation_occurrence_id,
          location: LOC.DEFINITIONS_ARTICLE,
          owner_node_occurrence_id: annotation.owner_node_occurrence_id ?? null,
          span,
          value: annotation.value,
        });
      }
    }
  }
  const candidateIds = new Set(
    (Array.isArray(edge.target_definition_annotation_occurrence_ids)
      ? edge.target_definition_annotation_occurrence_ids
      : []
    ).filter((id) => typeof id === 'string'),
  );
  if (articleExtents.length === 0) {
    return { resolves: false, selected: null, why_not: 'no_definitions_article' };
  }
  if (term === null) {
    return { resolves: false, selected: null, why_not: 'edge_has_no_term' };
  }
  if (articleExact.length >= 2) {
    return { resolves: false, selected: null, why_not: 'two_definitions_of_the_same_term_in_the_article' };
  }
  if (articleExact.length === 1) {
    const winner = articleExact[0];
    if (!candidateIds.has(winner.annotation_occurrence_id)) {
      return { resolves: false, selected: null, why_not: 'unique_article_definition_not_an_m3_candidate' };
    }
    return { resolves: true, selected: winner, why_not: null };
  }
  return { resolves: false, selected: null, why_not: 'no_unique_article_definition' };
}

function applyRule2(candidates) {
  const inPreamble = candidates.filter((candidate) => candidate.location === LOC.PREAMBLE);
  if (inPreamble.length === 1) {
    return { resolves: true, selected: selectedFromCandidate(inPreamble[0]), why_not: null };
  }
  if (inPreamble.length === 0) {
    return { resolves: false, selected: null, why_not: 'no_candidate_in_preamble' };
  }
  return { resolves: false, selected: null, why_not: 'multiple_candidates_in_preamble' };
}

function applyRule3(candidates, sourceSpan) {
  if (!sourceSpan?.verified || !Number.isInteger(sourceSpan.start_byte)) {
    return { resolves: false, selected: null, why_not: 'use_span_unverified', nearest_location: null };
  }
  const preceding = candidates.filter((candidate) => (
    candidate.span.verified
    && Number.isInteger(candidate.span.end_byte)
    && candidate.span.end_byte <= sourceSpan.start_byte
  ));
  if (preceding.length === 0) {
    return { resolves: false, selected: null, why_not: 'no_preceding_candidate', nearest_location: null };
  }
  let nearestEnd = -1;
  for (const candidate of preceding) {
    if (candidate.span.end_byte > nearestEnd) nearestEnd = candidate.span.end_byte;
  }
  const nearest = preceding.filter((candidate) => candidate.span.end_byte === nearestEnd);
  if (nearest.length !== 1) {
    return { resolves: false, selected: null, why_not: 'tied_nearest_preceding_candidate', nearest_location: null };
  }
  const selected = selectedFromCandidate(nearest[0]);
  return { resolves: true, selected, why_not: null, nearest_location: selected.location };
}

function applyRules(edge, index, preambleSpan, articleExtents) {
  const sourceSpan = verifyReportedSpan(index.canonical_bytes, edge.source_span);
  const candidates = candidateRecords(edge, index, preambleSpan, articleExtents);
  const rule1 = applyRule1(edge, index, articleExtents);
  const rule2 = applyRule2(candidates);
  const rule3 = applyRule3(candidates, sourceSpan);
  const combined = rule1.resolves
    ? { resolves: true, selected: rule1.selected, winning_rule: 'rule_1_unique_definitions_article' }
    : rule2.resolves
      ? { resolves: true, selected: rule2.selected, winning_rule: 'rule_2_unique_preamble_candidate' }
      : rule3.resolves
        ? { resolves: true, selected: rule3.selected, winning_rule: 'rule_3_nearest_preceding' }
        : { resolves: false, selected: null, winning_rule: null };
  const picks = [];
  if (rule1.resolves) picks.push({ rule: 'rule_1', selected: rule1.selected });
  if (rule2.resolves) picks.push({ rule: 'rule_2', selected: rule2.selected });
  if (rule3.resolves) picks.push({ rule: 'rule_3', selected: rule3.selected });
  const distinctTargets = new Set(picks.map((pick) => pick.selected.annotation_occurrence_id));
  const disagreement = distinctTargets.size > 1
    ? {
      targets: picks.map((pick) => ({
        rule: pick.rule,
        annotation_occurrence_id: pick.selected.annotation_occurrence_id,
        location: pick.selected.location,
        span: pick.selected.span,
        value: pick.selected.value,
      })),
    }
    : null;
  return {
    candidates,
    combined,
    disagreement,
    rule1,
    rule2,
    rule3,
    source_span: sourceSpan,
    term: typeof edge.term === 'string' ? edge.term : null,
  };
}

function collectQ12Ambiguous(q12) {
  const rows = [];
  for (const item of Array.isArray(q12.items) ? q12.items : []) {
    for (const node of Array.isArray(item.nodes) ? item.nodes : []) {
      for (const edge of Array.isArray(node.definition_edges) ? node.definition_edges : []) {
        if (edge.state !== 'AMBIGUOUS' || edge.unresolved !== true) continue;
        rows.push({
          agreement_id: item.agreement_id ?? null,
          edge_id: edge.edge_id ?? null,
          family_key: item.family_key ?? null,
          reason_code: edge.reason_code ?? null,
          review_item_id: item.review_item_id ?? null,
          sample_ordinal: item.sample_ordinal ?? null,
          source_span: edge.source_span ?? null,
          term: edge.term_or_reference ?? edge.raw_text ?? null,
        });
      }
    }
  }
  rows.sort((left, right) => {
    const ordinal = (left.sample_ordinal ?? 0) - (right.sample_ordinal ?? 0);
    if (ordinal !== 0) return ordinal;
    return compareText(left.edge_id ?? '', right.edge_id ?? '');
  });
  return rows;
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

function emptyRates() {
  return {
    rule_1: rateRecord(0, 0),
    rule_2: rateRecord(0, 0),
    rule_3: rateRecord(0, 0),
    combined: rateRecord(0, 0),
  };
}

function renderOut(report) {
  const lines = [
    `agreements ${report.counts.agreements}`,
    `ambiguous_definition_edges ${report.counts.ambiguous_definition_edges}`,
    `rule_1_resolved ${report.counts.rule_1_resolved} ${report.rates.rule_1.ratio}`,
    `rule_2_resolved ${report.counts.rule_2_resolved} ${report.rates.rule_2.ratio}`,
    `rule_3_resolved ${report.counts.rule_3_resolved} ${report.rates.rule_3.ratio}`,
    `combined_resolved ${report.counts.combined_resolved} ${report.rates.combined.ratio}`,
    `rule_3_nearest_preamble ${report.counts.rule_3_nearest_preamble}`,
    `rule_3_nearest_definitions_article ${report.counts.rule_3_nearest_definitions_article}`,
    `rule_3_nearest_inline_body ${report.counts.rule_3_nearest_inline_body}`,
    `rule_disagreements ${report.counts.rule_disagreements}`,
    `fixed50_ambiguous ${report.counts.fixed50_ambiguous}`,
    `fixed50_rule_1 ${report.counts.fixed50_rule_1}`,
    `fixed50_rule_2 ${report.counts.fixed50_rule_2}`,
    `fixed50_rule_3 ${report.counts.fixed50_rule_3}`,
    `fixed50_combined ${report.counts.fixed50_combined}`,
    `fixed50_disagreements ${report.counts.fixed50_disagreements}`,
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

function mdRate(record) {
  if (!record || record.denominator === 0) return '—';
  const pct = ((record.numerator / record.denominator) * 100).toFixed(1);
  return `${record.ratio} (${pct}%)`;
}

function formatSelected(selected) {
  if (!selected) return '—';
  const span = selected.span?.verified
    ? `${selected.span.start_byte}–${selected.span.end_byte}`
    : 'unverified';
  return `${selected.value ?? '—'} @ ${span} (${selected.location})`;
}

function renderMarkdown(report) {
  const lines = [
    '# Definition-resolution rules (Q-0016)',
    '',
    'Same 5,998 AMBIGUOUS M3 definition edges as Q-0014, plus the 47 fixed-50 AMBIGUOUS cases. No target is invented: every selected annotation is already in `target_definition_annotation_occurrence_ids`.',
    '',
    '- Rule 1 (Q-0014): unique exact-term `DEFINED_TERM_DEFINITION` inside the Definitions-article union, and that annotation is an M3 candidate.',
    '- Rule 2: exactly one M3 candidate definition lies in the Q-0015 preamble window (AGREEMENT children before the first ARTICLE).',
    '- Rule 3: the unique candidate whose verified span ends at or before the use and is nearest to it. Location of that nearest is preamble / Definitions article / inline body.',
    '- Combined: Rule 1, then Rule 2, then Rule 3; first hit wins.',
    '',
    '## Corpus-wide rates (vs 5,998 AMBIGUOUS)',
    '',
    `- Rule 1: **${mdRate(report.rates.rule_1)}**.`,
    `- Rule 2: **${mdRate(report.rates.rule_2)}**.`,
    `- Rule 3: **${mdRate(report.rates.rule_3)}** — nearest in preamble ${report.counts.rule_3_nearest_preamble}, Definitions article ${report.counts.rule_3_nearest_definitions_article}, inline body ${report.counts.rule_3_nearest_inline_body}.`,
    `- Combined: **${mdRate(report.rates.combined)}**.`,
    `- Rule disagreements (two rules pick different candidate ids): **${report.counts.rule_disagreements}**.`,
    `- SHA-verified reported spans: **${report.counts.sha_verified_spans}**. Stored-hash mismatches: **${report.counts.sha_mismatch_spans}**.`,
    '',
    '## Per agreement',
    '',
    '| Agreement | AMBIGUOUS | R1 | R2 | R3 | Combined | Disagreements |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.agreements) {
    lines.push(
      `| \`${shortId(row.agreement_id)}\` | ${row.ambiguous_definition_edges} | ${mdRate(row.rates.rule_1)} | ${mdRate(row.rates.rule_2)} | ${mdRate(row.rates.rule_3)} | ${mdRate(row.rates.combined)} | ${row.rule_disagreements} |`,
    );
  }

  lines.push('', '## Fixed-50 AMBIGUOUS edges (47)', '');
  lines.push('| # | Term | Combined | R1 | R2 | R3 nearest | Selected span |');
  lines.push('| ---: | --- | --- | --- | --- | --- | --- |');
  for (const row of report.fixed50_ambiguous) {
    lines.push(
      `| ${row.sample_ordinal} | ${row.term ?? '—'} | ${row.combined.resolves ? row.combined.winning_rule : 'not'} | ${row.rule_1.resolves ? 'yes' : 'not'} | ${row.rule_2.resolves ? 'yes' : 'not'} | ${row.rule_3.resolves ? row.rule_3.nearest_location : 'not'} | ${formatSelected(row.combined.selected)} |`,
    );
  }

  lines.push('', '## Rule disagreements (need Ben if the two spans are legally different targets)', '');
  if (report.disagreements.length === 0) {
    lines.push('None.');
  } else {
    lines.push(`Corpus-wide disagreements: **${report.disagreements.length}**. Fixed-50 disagreements: **${report.counts.fixed50_disagreements}**. Every pair, with both spans, is in the JSON \`disagreements\` array.`);
    lines.push('');
    lines.push('| Term | Rule / location pair | Edges |');
    lines.push('| --- | --- | ---: |');
    for (const [shape, count] of Object.entries(report.disagreement_shape_histogram)) {
      const [term, pair] = shape.split(' | ');
      lines.push(`| ${term} | ${pair} | ${count} |`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const missingPaths = [];
  for (const required of [INDEX_SET_PATH, CONTEXT_SET_PATH, Q12_PATH]) {
    if (!existsSync(required)) missingPaths.push(rel(required));
  }
  if (missingPaths.length > 0) {
    const failed = { error: 'required_control_file_missing', missing_paths: missingPaths };
    writeFileSync(resolve(OUT_DIR, '16-definition-rules.out'), `${JSON.stringify(failed, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(failed, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const indexSet = loadJson(INDEX_SET_PATH);
  const contextSet = loadJson(CONTEXT_SET_PATH);
  const q12 = loadJson(Q12_PATH);

  const indexByAgreement = new Map();
  for (const member of indexSet.members ?? []) {
    const memberPath = member?.path;
    if (typeof memberPath !== 'string' || memberPath.length === 0) {
      missingPaths.push('work3-index-set member missing path');
      continue;
    }
    const index = loadIndex(memberPath, missingPaths);
    if (!index) continue;
    if (typeof index.agreement_id !== 'string') {
      missingPaths.push(`${memberPath} (no source_binding.agreement_id)`);
      continue;
    }
    indexByAgreement.set(index.agreement_id, index);
  }

  const shaCounts = {
    sha_verified_spans: 0,
    sha_mismatch_spans: 0,
    sha_failed_spans: 0,
  };

  let ambiguousCount = 0;
  let rule1Resolved = 0;
  let rule2Resolved = 0;
  let rule3Resolved = 0;
  let combinedResolved = 0;
  let rule3Preamble = 0;
  let rule3Article = 0;
  let rule3Inline = 0;
  let disagreementCount = 0;
  const disagreements = [];
  const agreementRows = [];
  const edgesById = new Map();

  const contextMembers = [...(contextSet.members ?? [])].sort((left, right) =>
    compareText(left.agreement_id ?? '', right.agreement_id ?? ''));

  for (const member of contextMembers) {
    const agreementId = member?.agreement_id;
    const memberPath = member?.context_compilation_binding?.path;
    if (typeof agreementId !== 'string' || typeof memberPath !== 'string') {
      missingPaths.push('work3-context-set member missing agreement_id or path');
      continue;
    }
    const abs = resolve(repoRoot, memberPath);
    if (!existsSync(abs)) {
      missingPaths.push(memberPath);
      continue;
    }
    const index = indexByAgreement.get(agreementId);
    if (!index) {
      missingPaths.push(`m2 index for agreement ${agreementId}`);
      continue;
    }

    const m3 = loadJson(abs);
    const edges = Array.isArray(m3.definition_edges) ? m3.definition_edges : [];
    const articles = findDefinitionsArticles(index, missingPaths);
    for (const article of articles) {
      bumpSha(shaCounts, article.heading_span);
      bumpSha(shaCounts, article.extent_span);
    }
    const articleExtents = articles.map((article) => article.extent_span);
    const preambleSpan = {
      start_byte: index.preamble.start_byte,
      end_byte: index.preamble.end_byte,
    };

    let localAmbiguous = 0;
    let local1 = 0;
    let local2 = 0;
    let local3 = 0;
    let localCombined = 0;
    let localDisagree = 0;

    for (const edge of edges) {
      if (typeof edge.definition_edge_id === 'string') {
        edgesById.set(edge.definition_edge_id, { agreementId, edge });
      }
      if (edge.state !== 'AMBIGUOUS') continue;
      ambiguousCount += 1;
      localAmbiguous += 1;
      const applied = applyRules(edge, index, preambleSpan, articleExtents);
      bumpSha(shaCounts, applied.source_span);
      for (const candidate of applied.candidates) bumpSha(shaCounts, candidate.span);
      if (applied.rule1.selected?.span) bumpSha(shaCounts, applied.rule1.selected.span);
      if (applied.rule2.selected?.span) bumpSha(shaCounts, applied.rule2.selected.span);
      if (applied.rule3.selected?.span) bumpSha(shaCounts, applied.rule3.selected.span);
      if (applied.rule1.resolves) {
        rule1Resolved += 1;
        local1 += 1;
      }
      if (applied.rule2.resolves) {
        rule2Resolved += 1;
        local2 += 1;
      }
      if (applied.rule3.resolves) {
        rule3Resolved += 1;
        local3 += 1;
        if (applied.rule3.nearest_location === LOC.PREAMBLE) rule3Preamble += 1;
        else if (applied.rule3.nearest_location === LOC.DEFINITIONS_ARTICLE) rule3Article += 1;
        else if (applied.rule3.nearest_location === LOC.INLINE_BODY) rule3Inline += 1;
      }
      if (applied.combined.resolves) {
        combinedResolved += 1;
        localCombined += 1;
      }
      if (applied.disagreement) {
        disagreementCount += 1;
        localDisagree += 1;
        disagreements.push({
          agreement_id: agreementId,
          edge_id: edge.definition_edge_id ?? null,
          term: applied.term,
          source_span: applied.source_span,
          targets: applied.disagreement.targets,
        });
      }
    }

    agreementRows.push({
      agreement_id: agreementId,
      ambiguous_definition_edges: localAmbiguous,
      m2_path: index.path,
      m3_path: memberPath,
      preamble: index.preamble,
      rates: {
        combined: rateRecord(localCombined, localAmbiguous),
        rule_1: rateRecord(local1, localAmbiguous),
        rule_2: rateRecord(local2, localAmbiguous),
        rule_3: rateRecord(local3, localAmbiguous),
      },
      rule_disagreements: localDisagree,
    });
  }

  disagreements.sort((left, right) => {
    const agreement = compareText(left.agreement_id ?? '', right.agreement_id ?? '');
    if (agreement !== 0) return agreement;
    return compareText(left.edge_id ?? '', right.edge_id ?? '');
  });

  const disagreementShapes = new Map();
  for (const row of disagreements) {
    const locs = row.targets
      .map((target) => `${target.rule}:${target.location}`)
      .sort(compareText)
      .join(' vs ');
    increment(disagreementShapes, `${row.term ?? '—'} | ${locs}`);
  }

  const q12Rows = collectQ12Ambiguous(q12);
  const fixed50 = [];
  let fixed50Rule1 = 0;
  let fixed50Rule2 = 0;
  let fixed50Rule3 = 0;
  let fixed50Combined = 0;
  let fixed50Disagree = 0;
  for (const row of q12Rows) {
    const live = typeof row.edge_id === 'string' ? edgesById.get(row.edge_id) : null;
    const index = row.agreement_id ? indexByAgreement.get(row.agreement_id) : null;
    if (!live || !index) {
      fixed50.push({
        agreement_id: row.agreement_id,
        combined: { resolves: false, selected: null, winning_rule: null },
        edge_id: row.edge_id,
        family_key: row.family_key,
        review_item_id: row.review_item_id,
        rule_1: { resolves: false, selected: null, why_not: 'missing_live_edge_or_index' },
        rule_2: { resolves: false, selected: null, why_not: 'missing_live_edge_or_index' },
        rule_3: { resolves: false, selected: null, why_not: 'missing_live_edge_or_index', nearest_location: null },
        sample_ordinal: row.sample_ordinal,
        term: row.term,
      });
      continue;
    }
    const articles = findDefinitionsArticles(index, missingPaths);
    const articleExtents = articles.map((article) => article.extent_span);
    const preambleSpan = {
      start_byte: index.preamble.start_byte,
      end_byte: index.preamble.end_byte,
    };
    const applied = applyRules(live.edge, index, preambleSpan, articleExtents);
    bumpSha(shaCounts, applied.source_span);
    if (applied.rule1.resolves) fixed50Rule1 += 1;
    if (applied.rule2.resolves) fixed50Rule2 += 1;
    if (applied.rule3.resolves) fixed50Rule3 += 1;
    if (applied.combined.resolves) fixed50Combined += 1;
    if (applied.disagreement) fixed50Disagree += 1;
    fixed50.push({
      agreement_id: row.agreement_id,
      combined: applied.combined,
      disagreement: applied.disagreement,
      edge_id: row.edge_id,
      family_key: row.family_key,
      review_item_id: row.review_item_id,
      rule_1: applied.rule1,
      rule_2: applied.rule2,
      rule_3: applied.rule3,
      sample_ordinal: row.sample_ordinal,
      source_span: applied.source_span,
      term: applied.term ?? row.term,
    });
  }

  const uniqueMissing = [...new Set(missingPaths)].sort(compareText);
  const tablePayload = sortedObject({
    agreements: agreementRows,
    disagreements,
    fixed50_ambiguous: fixed50,
  });
  const tableJson = `${JSON.stringify(tablePayload, null, 2)}\n`;
  const tableSha = sha256Hex(Buffer.from(tableJson, 'utf8'));

  const report = sortedObject({
    schema: 'Q-0016-DEFINITION-RULES/V1',
    agreement_index_set_id: indexSet.agreement_index_set_id ?? null,
    context_compilation_set_id: contextSet.context_compilation_set_id ?? null,
    rules: {
      combined: 'rule_1 then rule_2 then rule_3; first hit wins',
      rule_1: 'unique exact-term DEFINED_TERM_DEFINITION inside the Definitions-article union, and that annotation is already an M3 candidate',
      rule_2: 'exactly one M3 candidate definition lies in the Q-0015 preamble window',
      rule_3: 'unique M3 candidate whose verified span ends at or before the use and is nearest to it',
      no_invented_target: true,
    },
    counts: {
      agreements: agreementRows.length,
      ambiguous_definition_edges: ambiguousCount,
      combined_resolved: combinedResolved,
      fixed50_ambiguous: fixed50.length,
      fixed50_combined: fixed50Combined,
      fixed50_disagreements: fixed50Disagree,
      fixed50_rule_1: fixed50Rule1,
      fixed50_rule_2: fixed50Rule2,
      fixed50_rule_3: fixed50Rule3,
      rule_1_resolved: rule1Resolved,
      rule_2_resolved: rule2Resolved,
      rule_3_nearest_definitions_article: rule3Article,
      rule_3_nearest_inline_body: rule3Inline,
      rule_3_nearest_preamble: rule3Preamble,
      rule_3_resolved: rule3Resolved,
      rule_disagreements: disagreementCount,
      sha_failed_spans: shaCounts.sha_failed_spans,
      sha_mismatch_spans: shaCounts.sha_mismatch_spans,
      sha_verified_spans: shaCounts.sha_verified_spans,
    },
    rates: {
      combined: rateRecord(combinedResolved, ambiguousCount),
      rule_1: rateRecord(rule1Resolved, ambiguousCount),
      rule_2: rateRecord(rule2Resolved, ambiguousCount),
      rule_3: rateRecord(rule3Resolved, ambiguousCount),
    },
    missing_paths: uniqueMissing,
    table_sha256: tableSha,
    disagreement_shape_histogram: histogramObject(disagreementShapes),
    agreements: agreementRows,
    disagreements,
    fixed50_ambiguous: fixed50,
  });

  const jsonPath = resolve(OUT_DIR, '16-definition-rules.json');
  const outPath = resolve(OUT_DIR, '16-definition-rules.out');
  const mdPath = resolve(OUT_DIR, '16-DEFINITION-RULES.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outPath, renderOut(report));
  writeFileSync(mdPath, renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
