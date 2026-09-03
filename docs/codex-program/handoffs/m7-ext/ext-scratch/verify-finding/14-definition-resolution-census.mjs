'use strict';

/**
 * Q-0014: definition-resolution census across the ten Work 3 agreements.
 *
 * M2 paths come from the Work 3 agreement-index-set. M3 paths come from
 * the Work 3 context-compilation-set. Analysis paths come from the Work 3
 * agreement-analysis-set and are existence-checked only. Canonical bytes
 * are source_binding.canonical_text; every reported span is hashed with
 * sha256Hex(canonical UTF-8 subarray). Zero model calls. No invented
 * AMBIGUOUS target.
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
const ANALYSIS_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);
const Q12_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');

const DEFINITIONS_HEADING_RE = /definitions|defined terms|certain definitions/i;
const DEFINITIONS_NODE_KINDS = new Set(['ARTICLE', 'SECTION']);

const WHY = Object.freeze({
  TWO_IN_ARTICLE: 'two_definitions_of_the_same_term_in_the_article',
  INLINE_BODY: 'term_defined_inline_in_the_body',
  CAPITALISATION: 'capitalisation_variant',
  OTHER: 'other',
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
  for (const node of Array.isArray(record.nodes) ? record.nodes : []) {
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
    nodes: Array.isArray(record.nodes) ? record.nodes : [],
    annotationsById,
    definitionAnnotations,
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

function candidateLocations(edge, index, articleExtents) {
  const annotationIds = Array.isArray(edge.target_definition_annotation_occurrence_ids)
    ? edge.target_definition_annotation_occurrence_ids.filter((id) => typeof id === 'string')
    : [];
  const distinctIds = [...new Set(annotationIds)];
  let inside = 0;
  let outside = 0;
  let unverified = 0;
  for (const annotationId of distinctIds) {
    const annotation = index.annotationsById.get(annotationId);
    const span = annotationSpan(index, annotation);
    if (!span.verified) {
      unverified += 1;
      continue;
    }
    if (spanInsideAny(span, articleExtents)) inside += 1;
    else outside += 1;
  }
  return {
    candidate_target_count: distinctIds.length,
    candidates_inside_definitions_article: inside,
    candidates_outside_definitions_article: outside,
    candidates_unverified: unverified,
    every_candidate_inside_definitions_article: distinctIds.length > 0
      && outside === 0
      && unverified === 0,
    any_candidate_outside_definitions_article: outside > 0,
  };
}

function definitionsOfTerm(definitionAnnotations, term, exact) {
  if (typeof term !== 'string') return [];
  return definitionAnnotations.filter((annotation) => {
    if (typeof annotation.value !== 'string') return false;
    return exact ? annotation.value === term : annotation.value.toLowerCase() === term.toLowerCase();
  });
}

function applyRule(edge, index, articleExtents) {
  const term = typeof edge.term === 'string' ? edge.term : null;
  const articleExact = [];
  const articleInsensitive = [];
  const bodyExact = [];
  if (term !== null) {
    for (const annotation of index.definitionAnnotations) {
      if (typeof annotation.value !== 'string') continue;
      const span = annotationSpan(index, annotation);
      const inside = span.verified && spanInsideAny(span, articleExtents);
      if (annotation.value === term) {
        if (inside) articleExact.push({ annotation, span });
        else bodyExact.push({ annotation, span });
      } else if (annotation.value.toLowerCase() === term.toLowerCase()) {
        if (inside) articleInsensitive.push({ annotation, span });
      }
    }
  }

  const candidateIds = new Set(
    (Array.isArray(edge.target_definition_annotation_occurrence_ids)
      ? edge.target_definition_annotation_occurrence_ids
      : []
    ).filter((id) => typeof id === 'string'),
  );

  let resolves = false;
  let whyNot = WHY.OTHER;
  let whyNotDetail = null;
  let resolved = null;

  if (articleExtents.length === 0) {
    whyNot = bodyExact.length > 0 ? WHY.INLINE_BODY : WHY.OTHER;
    whyNotDetail = bodyExact.length > 0
      ? 'no Definitions article heading matched; exact-term DEFINED_TERM_DEFINITION annotations lie outside any matching section'
      : 'no Definitions article heading matched';
  } else if (term === null) {
    whyNot = WHY.OTHER;
    whyNotDetail = 'M3 definition edge has no term string';
  } else if (articleExact.length >= 2) {
    whyNot = WHY.TWO_IN_ARTICLE;
    whyNotDetail = `${articleExact.length} DEFINED_TERM_DEFINITION annotations of the exact term lie inside the Definitions article`;
  } else if (articleExact.length === 1) {
    const winner = articleExact[0];
    const winnerId = winner.annotation.annotation_occurrence_id;
    if (candidateIds.has(winnerId)) {
      resolves = true;
      whyNot = null;
      resolved = {
        annotation_occurrence_id: winnerId,
        owner_node_occurrence_id: winner.annotation.owner_node_occurrence_id ?? null,
        span: winner.span,
        value: winner.annotation.value,
      };
    } else {
      whyNot = WHY.OTHER;
      whyNotDetail = 'unique Definitions-article DEFINED_TERM_DEFINITION is not among the M3 candidate targets; no target invented';
    }
  } else if (articleInsensitive.length > 0) {
    whyNot = WHY.CAPITALISATION;
    whyNotDetail = `no exact-term definition in the Definitions article; ${articleInsensitive.length} case-insensitive match(es) inside the article`;
  } else if (bodyExact.length > 0) {
    whyNot = WHY.INLINE_BODY;
    whyNotDetail = `${bodyExact.length} exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article`;
  } else {
    whyNot = WHY.OTHER;
    whyNotDetail = 'no DEFINED_TERM_DEFINITION annotation of this exact term string';
  }

  return {
    article_definition_count_exact: articleExact.length,
    body_definition_count_exact: bodyExact.length,
    article_definition_count_case_insensitive: articleInsensitive.length,
    resolves,
    resolved,
    term,
    why_not: whyNot,
    why_not_detail: whyNotDetail,
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
          raw_text: edge.raw_text ?? null,
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

function renderOut(report) {
  const lines = [
    `agreements ${report.counts.agreements}`,
    `definition_edges ${report.counts.definition_edges}`,
    `resolution_state_field ${report.m3_field_names.resolution_state_field}`,
    `candidate_target_field ${report.m3_field_names.candidate_annotation_ids_field}`,
  ];
  const states = report.state_histogram;
  for (const key of Object.keys(states)) {
    lines.push(`state.${key} ${states[key]}`);
  }
  lines.push(`ambiguous_definition_edges ${report.counts.ambiguous_definition_edges}`);
  lines.push(`rule_resolved_ambiguous ${report.counts.rule_resolved_ambiguous}`);
  lines.push(`rule_rate_vs_ambiguous ${report.rule_rate_vs_ambiguous.ratio}`);
  lines.push(`rule_rate_vs_all ${report.rule_rate_vs_all.ratio}`);
  lines.push(`ambiguous_every_candidate_inside_definitions_article ${report.counts.ambiguous_every_candidate_inside_definitions_article}`);
  lines.push(`ambiguous_any_candidate_outside_definitions_article ${report.counts.ambiguous_any_candidate_outside_definitions_article}`);
  lines.push(`fixed50_ambiguous ${report.counts.fixed50_ambiguous}`);
  lines.push(`fixed50_rule_resolved ${report.counts.fixed50_rule_resolved}`);
  lines.push(`sha_mismatch_spans ${report.counts.sha_mismatch_spans}`);
  lines.push(`sha_verified_spans ${report.counts.sha_verified_spans}`);
  lines.push(`table_sha256 ${report.table_sha256}`);
  lines.push(`missing_paths ${report.missing_paths.length}`);
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

function mdPct(record) {
  if (!record || record.denominator === 0) return '—';
  return `${((record.numerator / record.denominator) * 100).toFixed(1)}%`;
}

function formatHeading(article) {
  const ref = article.reference ? ` ${article.reference}` : '';
  const text = article.heading_text ? ` ${JSON.stringify(article.heading_text)}` : '';
  return `${article.node_kind}${ref}${text}`.trim();
}

function renderMarkdown(report) {
  const lines = [
    '# Definition-resolution census (Q-0014)',
    '',
    'M3 resolution state is the edge field `state`. Observed values and `reason_code` companions are taken from the ten Work 3 compilations; candidate targets are the existing `target_definition_annotation_occurrence_ids` (owner nodes in `target_owner_node_occurrence_ids`). No AMBIGUOUS target is invented.',
    '',
    'The Definitions article is the union of M2 `ARTICLE`/`SECTION` nodes whose heading matches `/definitions|defined terms|certain definitions/i`. The deterministic rule uniquely resolves an AMBIGUOUS edge when exactly one M2 `DEFINED_TERM_DEFINITION` of that exact term string (case-sensitive) lies inside that union, and that annotation is already an M3 candidate.',
    '',
    '## M3 field names',
    '',
    `- Resolution state: \`${report.m3_field_names.resolution_state_field}\` — observed ${report.m3_field_names.resolution_state_values_observed.map((value) => `\`${value}\``).join(', ') || 'none'}.`,
    `- Reason: \`${report.m3_field_names.reason_code_field}\` — observed ${report.m3_field_names.reason_code_values_observed.map((value) => `\`${value}\``).join(', ') || 'none'}.`,
    `- Term: \`${report.m3_field_names.term_field}\`. Edge id: \`${report.m3_field_names.edge_id_field}\`.`,
    `- Candidate annotation ids: \`${report.m3_field_names.candidate_annotation_ids_field}\`. Candidate owner nodes: \`${report.m3_field_names.candidate_owner_node_ids_field}\`.`,
    `- Selected target (RESOLVED only): \`${report.m3_field_names.selected_target_field}\`.`,
    '',
    '## Corpus',
    '',
    `- Definition edges: **${report.counts.definition_edges}**.`,
    `- State histogram: ${Object.entries(report.state_histogram).map(([key, value]) => `\`${key}\` ${value}`).join(', ') || 'none'}.`,
    `- AMBIGUOUS candidate-target-count histogram: ${Object.entries(report.ambiguous_candidate_target_count_histogram).map(([key, value]) => `${key}→${value}`).join(', ') || 'none'}.`,
    `- AMBIGUOUS edges whose every candidate lies inside the Definitions article: **${report.counts.ambiguous_every_candidate_inside_definitions_article}** / ${report.counts.ambiguous_definition_edges} (${mdPct(report.ambiguous_all_candidates_inside_rate)}).`,
    `- AMBIGUOUS edges with any candidate elsewhere: **${report.counts.ambiguous_any_candidate_outside_definitions_article}** / ${report.counts.ambiguous_definition_edges}.`,
    `- Rule uniquely resolves **${report.counts.rule_resolved_ambiguous}** / ${report.counts.ambiguous_definition_edges} AMBIGUOUS edges (${mdRate(report.rule_rate_vs_ambiguous)}); **${mdRate(report.rule_rate_vs_all)}** of all definition edges.`,
    `- Fixed-50 AMBIGUOUS (Q-0012 ` + '`state: AMBIGUOUS`' + `, ` + '`unresolved: true`' + `): **${report.counts.fixed50_rule_resolved}** / ${report.counts.fixed50_ambiguous} resolve.`,
    `- SHA-verified reported spans: **${report.counts.sha_verified_spans}**. Stored-hash mismatches: **${report.counts.sha_mismatch_spans}**.`,
    '',
    '## Per agreement',
    '',
    '| Agreement | Def. edges | RESOLVED | AMBIGUOUS | Other states | Rule / amb. | Rule / all | Definitions heading |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const row of report.agreements) {
    const other = Object.entries(row.state_histogram)
      .filter(([key]) => key !== 'RESOLVED' && key !== 'AMBIGUOUS')
      .reduce((sum, [, value]) => sum + value, 0);
    const headings = row.definitions_articles.length === 0
      ? '— (none matched)'
      : row.definitions_articles.map(formatHeading).join('; ');
    lines.push(
      `| \`${shortId(row.agreement_id)}\` | ${row.definition_edges} | ${row.state_histogram.RESOLVED ?? 0} | ${row.state_histogram.AMBIGUOUS ?? 0} | ${other} | ${mdRate(row.rule_rate_vs_ambiguous)} | ${mdRate(row.rule_rate_vs_all)} | ${headings} |`,
    );
  }

  lines.push('', '## Fixed-50 AMBIGUOUS edges (47)', '');
  lines.push('| # | Term | Edge | Rule | Why not |');
  lines.push('| ---: | --- | --- | --- | --- |');
  for (const row of report.fixed50_ambiguous) {
    const verdict = row.rule_resolves ? 'resolves' : 'not';
    const why = row.rule_resolves ? '—' : (row.why_not_detail ? `${row.why_not}: ${row.why_not_detail}` : row.why_not);
    lines.push(
      `| ${row.sample_ordinal} | ${row.term ?? '—'} | \`${row.edge_id ?? '—'}\` | ${verdict} | ${why} |`,
    );
  }
  lines.push('');
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

function main() {
  const missingPaths = [];
  for (const required of [INDEX_SET_PATH, CONTEXT_SET_PATH, ANALYSIS_SET_PATH, Q12_PATH]) {
    if (!existsSync(required)) missingPaths.push(rel(required));
  }
  if (missingPaths.length > 0) {
    const failed = { error: 'required_control_file_missing', missing_paths: missingPaths };
    writeFileSync(resolve(OUT_DIR, '14-definition-resolution-census.out'), `${JSON.stringify(failed, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(failed, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const indexSet = loadJson(INDEX_SET_PATH);
  const contextSet = loadJson(CONTEXT_SET_PATH);
  const analysisSet = loadJson(ANALYSIS_SET_PATH);
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

  const analysisByAgreement = new Map();
  for (const member of analysisSet.members ?? []) {
    const agreementId = member?.agreement_id;
    const memberPath = member?.agreement_analysis_binding?.path;
    if (typeof agreementId !== 'string' || typeof memberPath !== 'string') {
      missingPaths.push('work3-analysis-set member missing agreement_id or path');
      continue;
    }
    const abs = resolve(repoRoot, memberPath);
    if (!existsSync(abs)) missingPaths.push(memberPath);
    analysisByAgreement.set(agreementId, memberPath);
  }

  const contextMembers = [...(contextSet.members ?? [])].sort((left, right) =>
    compareText(left.agreement_id ?? '', right.agreement_id ?? ''));

  const shaCounts = {
    sha_verified_spans: 0,
    sha_mismatch_spans: 0,
    sha_failed_spans: 0,
  };
  const stateHistogram = new Map();
  const reasonHistogram = new Map();
  const candidateCountHistogram = new Map();
  const observedStates = new Set();
  const observedReasons = new Set();
  const observedEdgeKeys = new Set();

  let definitionEdgeCount = 0;
  let ambiguousCount = 0;
  let ruleResolvedAmbiguous = 0;
  let allInside = 0;
  let anyOutside = 0;

  const agreementRows = [];
  const edgesById = new Map();

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
    const analysisPath = analysisByAgreement.get(agreementId);
    if (!analysisPath) missingPaths.push(`m4 analysis for agreement ${agreementId}`);

    const m3 = loadJson(abs);
    const edges = Array.isArray(m3.definition_edges) ? m3.definition_edges : [];
    for (const edge of edges) {
      if (edge && typeof edge === 'object') {
        for (const key of Object.keys(edge)) observedEdgeKeys.add(key);
      }
    }

    const articles = findDefinitionsArticles(index, missingPaths);
    for (const article of articles) {
      bumpSha(shaCounts, article.heading_span);
      bumpSha(shaCounts, article.extent_span);
    }
    const articleExtents = articles.map((article) => article.extent_span);

    const localState = new Map();
    const localReason = new Map();
    const localCandidateHist = new Map();
    let localAmbiguous = 0;
    let localRuleResolved = 0;
    let localAllInside = 0;
    let localAnyOutside = 0;
    const whyHistogram = new Map();

    for (const edge of edges) {
      definitionEdgeCount += 1;
      const state = typeof edge.state === 'string' ? edge.state : 'MISSING';
      const reason = typeof edge.reason_code === 'string' ? edge.reason_code : 'MISSING';
      observedStates.add(state);
      observedReasons.add(reason);
      increment(stateHistogram, state);
      increment(reasonHistogram, reason);
      increment(localState, state);
      increment(localReason, reason);

      const sourceSpan = verifyReportedSpan(index.canonical_bytes, edge.source_span);
      bumpSha(shaCounts, sourceSpan);

      if (typeof edge.definition_edge_id === 'string') {
        edgesById.set(edge.definition_edge_id, { agreementId, edge, sourceSpan });
      }

      if (state !== 'AMBIGUOUS') continue;
      ambiguousCount += 1;
      localAmbiguous += 1;

      const locations = candidateLocations(edge, index, articleExtents);
      increment(candidateCountHistogram, locations.candidate_target_count);
      increment(localCandidateHist, locations.candidate_target_count);
      if (locations.every_candidate_inside_definitions_article) {
        allInside += 1;
        localAllInside += 1;
      }
      if (locations.any_candidate_outside_definitions_article) {
        anyOutside += 1;
        localAnyOutside += 1;
      }

      const rule = applyRule(edge, index, articleExtents);
      if (rule.resolves) {
        ruleResolvedAmbiguous += 1;
        localRuleResolved += 1;
        if (rule.resolved?.span) bumpSha(shaCounts, rule.resolved.span);
      } else {
        increment(whyHistogram, rule.why_not);
      }
    }

    agreementRows.push({
      agreement_id: agreementId,
      analysis_path: analysisPath ?? null,
      ambiguous_any_candidate_outside_definitions_article: localAnyOutside,
      ambiguous_candidate_target_count_histogram: histogramObject(localCandidateHist),
      ambiguous_definition_edges: localAmbiguous,
      ambiguous_every_candidate_inside_definitions_article: localAllInside,
      definition_edges: edges.length,
      definitions_articles: articles.map((article) => ({
        extent_span: article.extent_span,
        heading_span: article.heading_span,
        heading_text: article.heading_text,
        node_kind: article.node_kind,
        node_occurrence_id: article.node_occurrence_id,
        reference: article.reference,
      })),
      m2_path: index.path,
      m3_path: memberPath,
      reason_code_histogram: histogramObject(localReason),
      rule_rate_vs_all: rateRecord(localRuleResolved, edges.length),
      rule_rate_vs_ambiguous: rateRecord(localRuleResolved, localAmbiguous),
      rule_resolved_ambiguous: localRuleResolved,
      rule_why_not_histogram: histogramObject(whyHistogram),
      state_histogram: histogramObject(localState),
    });
  }

  const q12Rows = collectQ12Ambiguous(q12);
  const fixed50 = [];
  let fixed50Resolved = 0;
  for (const row of q12Rows) {
    const live = typeof row.edge_id === 'string' ? edgesById.get(row.edge_id) : null;
    const index = row.agreement_id ? indexByAgreement.get(row.agreement_id) : null;
    const articles = index ? findDefinitionsArticles(index, missingPaths) : [];
    const articleExtents = articles.map((article) => article.extent_span);
    let sourceSpan = row.source_span
      ? verifyReportedSpan(index?.canonical_bytes ?? null, row.source_span)
      : { start_byte: null, end_byte: null, text_sha256: null, verified: false };
    if (live?.sourceSpan) sourceSpan = live.sourceSpan;
    bumpSha(shaCounts, sourceSpan);

    if (!live || !index) {
      fixed50.push({
        agreement_id: row.agreement_id,
        article_definition_count_case_insensitive: 0,
        article_definition_count_exact: 0,
        body_definition_count_exact: 0,
        candidate_target_count: null,
        edge_id: row.edge_id,
        family_key: row.family_key,
        reason_code: row.reason_code,
        review_item_id: row.review_item_id,
        rule_resolves: false,
        resolved: null,
        sample_ordinal: row.sample_ordinal,
        source_span: sourceSpan,
        term: row.term,
        why_not: WHY.OTHER,
        why_not_detail: live
          ? 'Work 3 M2 index missing for this agreement'
          : 'Q-0012 edge_id is absent from the Work 3 M3 definition_edges',
      });
      continue;
    }

    const locations = candidateLocations(live.edge, index, articleExtents);
    const rule = applyRule(live.edge, index, articleExtents);
    if (rule.resolves) {
      fixed50Resolved += 1;
      if (rule.resolved?.span) bumpSha(shaCounts, rule.resolved.span);
    }
    fixed50.push({
      agreement_id: row.agreement_id,
      article_definition_count_case_insensitive: rule.article_definition_count_case_insensitive,
      article_definition_count_exact: rule.article_definition_count_exact,
      body_definition_count_exact: rule.body_definition_count_exact,
      candidate_target_count: locations.candidate_target_count,
      edge_id: row.edge_id,
      every_candidate_inside_definitions_article: locations.every_candidate_inside_definitions_article,
      family_key: row.family_key,
      reason_code: live.edge.reason_code ?? row.reason_code,
      review_item_id: row.review_item_id,
      rule_resolves: rule.resolves,
      resolved: rule.resolved,
      sample_ordinal: row.sample_ordinal,
      source_span: sourceSpan,
      term: rule.term ?? row.term,
      why_not: rule.why_not,
      why_not_detail: rule.why_not_detail,
    });
  }

  const uniqueMissing = [...new Set(missingPaths)].sort(compareText);
  const tablePayload = sortedObject({
    agreements: agreementRows,
    fixed50_ambiguous: fixed50,
  });
  const tableJson = `${JSON.stringify(tablePayload, null, 2)}\n`;
  const tableSha = sha256Hex(Buffer.from(tableJson, 'utf8'));

  const report = sortedObject({
    schema: 'Q-0014-DEFINITION-RESOLUTION-CENSUS/V1',
    agreement_analysis_set_id: analysisSet.agreement_analysis_set_id ?? null,
    agreement_index_set_id: indexSet.agreement_index_set_id ?? null,
    context_compilation_set_id: contextSet.context_compilation_set_id ?? null,
    m3_field_names: {
      candidate_annotation_ids_field: 'target_definition_annotation_occurrence_ids',
      candidate_owner_node_ids_field: 'target_owner_node_occurrence_ids',
      edge_id_field: 'definition_edge_id',
      observed_definition_edge_keys: [...observedEdgeKeys].sort(compareText),
      reason_code_field: 'reason_code',
      reason_code_values_observed: [...observedReasons].sort(compareText),
      resolution_state_field: 'state',
      resolution_state_values_observed: [...observedStates].sort(compareText),
      selected_target_field: 'selected_definition_annotation_occurrence_id',
      term_field: 'term',
    },
    definitions_article_rule: {
      heading_pattern: String(DEFINITIONS_HEADING_RE),
      node_kinds: [...DEFINITIONS_NODE_KINDS].sort(compareText),
      containment: 'annotation.span inside the union of matching ARTICLE/SECTION extent_span',
    },
    resolution_rule: 'the candidate whose defined-term annotation (M2 DEFINED_TERM_DEFINITION) is the unique definition of that exact term string, case-sensitive, inside the Definitions article',
    counts: {
      agreements: agreementRows.length,
      ambiguous_any_candidate_outside_definitions_article: anyOutside,
      ambiguous_definition_edges: ambiguousCount,
      ambiguous_every_candidate_inside_definitions_article: allInside,
      definition_edges: definitionEdgeCount,
      fixed50_ambiguous: fixed50.length,
      fixed50_rule_resolved: fixed50Resolved,
      rule_resolved_ambiguous: ruleResolvedAmbiguous,
      sha_failed_spans: shaCounts.sha_failed_spans,
      sha_mismatch_spans: shaCounts.sha_mismatch_spans,
      sha_verified_spans: shaCounts.sha_verified_spans,
    },
    state_histogram: histogramObject(stateHistogram),
    reason_code_histogram: histogramObject(reasonHistogram),
    ambiguous_candidate_target_count_histogram: histogramObject(candidateCountHistogram),
    ambiguous_all_candidates_inside_rate: rateRecord(allInside, ambiguousCount),
    ambiguous_any_candidate_outside_rate: rateRecord(anyOutside, ambiguousCount),
    rule_rate_vs_ambiguous: rateRecord(ruleResolvedAmbiguous, ambiguousCount),
    rule_rate_vs_all: rateRecord(ruleResolvedAmbiguous, definitionEdgeCount),
    missing_paths: uniqueMissing,
    table_sha256: tableSha,
    agreements: agreementRows,
    fixed50_ambiguous: fixed50,
  });

  const jsonPath = resolve(OUT_DIR, '14-definition-resolution-census.json');
  const outPath = resolve(OUT_DIR, '14-definition-resolution-census.out');
  const mdPath = resolve(OUT_DIR, '14-DEFINITION-RESOLUTION.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outPath, renderOut(report));
  writeFileSync(mdPath, renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
