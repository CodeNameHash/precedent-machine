'use strict';

/**
 * Q-0012: source closures for the frozen 50 review items.
 *
 * M2 paths come from the Work 3 agreement-index-set. M3 paths come from
 * the Work 3 context-compilation-set. Canonical bytes are
 * source_binding.canonical_text; every reported span is hashed with
 * sha256Hex(Buffer.from(text, 'utf8').subarray(start, end)).
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(new URL(import.meta.url).pathname);
const IDENTITY_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
);
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const CONTEXT_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json',
);

const TARGET_TEXT_ORDINALS = new Set([2, 4, 9, 21, 25, 31, 40, 45, 46, 47]);
const REPRESENT_WARRANT = /represent(?:s|ed|ing)?\s+and\s+warrant/i;
const REPRESENTATION_HEADING = /REPRESENTATION/i;
const TARGET_TEXT_BYTES = 200;

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

function clipUtf8Bytes(text, maxBytes) {
  const bytes = Buffer.from(String(text), 'utf8');
  if (bytes.length <= maxBytes) return String(text);
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return bytes.subarray(0, end).toString('utf8');
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
  const hashed = hashSpan(canonicalBytes, span.start_byte, span.end_byte);
  if (hashed === null) return { ...span, text_sha256: span.text_sha256 ?? null, verified: false };
  return {
    start_byte: span.start_byte,
    end_byte: span.end_byte,
    text_sha256: hashed,
    verified: true,
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

function childrenOf(byParent, nodeId) {
  return byParent.get(nodeId) ?? [];
}

function headingText(canonicalBytes, node) {
  if (!node?.extent_span || !canonicalBytes) return null;
  const start = node.extent_span.start_byte;
  const end = node.extent_span.end_byte;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end > canonicalBytes.length) return null;
  return canonicalBytes.subarray(start, end).toString('utf8');
}

function nodeHasRepresentWarrant(canonicalBytes, node) {
  const text = headingText(canonicalBytes, node);
  return typeof text === 'string' && REPRESENT_WARRANT.test(text);
}

function ancestorChain(nodesById, nodeId) {
  const chain = [];
  const seen = new Set();
  let current = nodesById.get(nodeId);
  while (current && !seen.has(current.node_occurrence_id)) {
    seen.add(current.node_occurrence_id);
    chain.push(current);
    const parentId = current.parent_node_occurrence_id;
    if (typeof parentId !== 'string' || parentId.length === 0) break;
    current = nodesById.get(parentId);
  }
  return chain;
}

function chainToSection(chain) {
  const sectionIndex = chain.findIndex((node) => node.node_kind === 'SECTION');
  if (sectionIndex === -1) return { chain: [...chain], section: null, reached_section: false };
  return {
    chain: chain.slice(0, sectionIndex + 1),
    section: chain[sectionIndex],
    reached_section: true,
  };
}

function reportedNode(canonicalBytes, node) {
  const span = completeSpan(node?.extent_span);
  const verified = span ? verifyReportedSpan(canonicalBytes, span) : {
    start_byte: null,
    end_byte: null,
    text_sha256: null,
    verified: false,
  };
  return {
    node_kind: node?.node_kind ?? null,
    node_occurrence_id: node?.node_occurrence_id ?? null,
    reference: typeof node?.reference === 'string' ? node.reference : null,
    start_byte: verified.start_byte,
    end_byte: verified.end_byte,
    text_sha256: verified.text_sha256,
    verified: verified.verified,
  };
}

function sectionLeadIn(section, byParent, canonicalBytes) {
  if (!section) {
    return {
      source: 'UNRESOLVED',
      why: 'no SECTION ancestor and no CHAPEAU on the ancestor chain',
      node: null,
    };
  }
  const children = childrenOf(byParent, section.node_occurrence_id);
  const chapeau = children.find((child) => child.node_kind === 'CHAPEAU');
  if (chapeau) {
    return { source: 'SECTION_LEAD_IN', why: null, node: chapeau };
  }
  const heading = children.find((child) => child.node_kind === 'HEADING');
  const headingEnd = heading?.extent_span?.end_byte ?? section.extent_span?.start_byte;
  const firstLimb = children.find((child) => child.node_kind === 'LIMB' || child.node_kind === 'SECTION');
  const lead = children.find((child) => {
    if (child.node_kind !== 'PARAGRAPH' && child.node_kind !== 'SENTENCE') return false;
    if (!Number.isInteger(child.extent_span?.start_byte)) return false;
    if (Number.isInteger(headingEnd) && child.extent_span.start_byte < headingEnd) return false;
    if (firstLimb?.extent_span && child.extent_span.start_byte >= firstLimb.extent_span.start_byte) {
      return false;
    }
    return true;
  });
  if (lead) {
    return { source: 'SECTION_LEAD_IN', why: null, node: lead };
  }
  return {
    source: 'UNRESOLVED',
    why: 'SECTION has no CHAPEAU child and no lead-in PARAGRAPH/SENTENCE before the first limb',
    node: null,
  };
}

function governingChapeau(chain, section, byParent, canonicalBytes) {
  const chapeau = chain.find((node) => node.node_kind === 'CHAPEAU');
  if (chapeau) {
    return {
      source: chapeau === chain[0] ? 'SELF_CHAPEAU' : 'ANCESTOR_CHAPEAU',
      why: null,
      node: chapeau,
    };
  }
  return sectionLeadIn(section, byParent, canonicalBytes);
}

function articleHeadingOf(article, byParent, canonicalBytes) {
  if (!article) return null;
  const heading = childrenOf(byParent, article.node_occurrence_id).find(
    (child) => child.node_kind === 'HEADING',
  );
  return heading ? headingText(canonicalBytes, heading) : null;
}

function articleRepresentingChapeau(article, byParent, canonicalBytes) {
  if (!article) {
    return {
      source: 'UNRESOLVED',
      why: 'no ARTICLE ancestor to search for a representing-party chapeau',
      node: null,
    };
  }
  const articleChildren = childrenOf(byParent, article.node_occurrence_id);
  const articleChapeau = articleChildren.find((child) => child.node_kind === 'CHAPEAU');
  if (articleChapeau && nodeHasRepresentWarrant(canonicalBytes, articleChapeau)) {
    return { source: 'ARTICLE_CHAPEAU', why: null, node: articleChapeau };
  }
  const firstSection = articleChildren.find((child) => child.node_kind === 'SECTION');
  if (firstSection) {
    const sectionChapeau = childrenOf(byParent, firstSection.node_occurrence_id)
      .find((child) => child.node_kind === 'CHAPEAU');
    if (sectionChapeau && nodeHasRepresentWarrant(canonicalBytes, sectionChapeau)) {
      return { source: 'FIRST_SECTION_CHAPEAU', why: null, node: sectionChapeau };
    }
    if (sectionChapeau) {
      return {
        source: 'UNRESOLVED',
        why: 'first SECTION has a CHAPEAU but its text does not name a representing party with represent-and-warrant language',
        node: null,
      };
    }
  }
  if (articleChapeau) {
    return {
      source: 'UNRESOLVED',
      why: 'ARTICLE has a CHAPEAU but its text does not name a representing party with represent-and-warrant language',
      node: null,
    };
  }
  return {
    source: 'UNRESOLVED',
    why: 'no ARTICLE CHAPEAU and no first-SECTION CHAPEAU with represent-and-warrant language',
    node: null,
  };
}

function chapeauRecord(canonicalBytes, found) {
  if (!found || found.source === 'UNRESOLVED' || !found.node) {
    return {
      source: 'UNRESOLVED',
      why: found?.why ?? 'unresolved',
      node_kind: null,
      node_occurrence_id: null,
      start_byte: null,
      end_byte: null,
      text_sha256: null,
      verified: false,
    };
  }
  const reported = reportedNode(canonicalBytes, found.node);
  return {
    source: found.source,
    why: null,
    node_kind: reported.node_kind,
    node_occurrence_id: reported.node_occurrence_id,
    start_byte: reported.start_byte,
    end_byte: reported.end_byte,
    text_sha256: reported.text_sha256,
    verified: reported.verified,
  };
}

function loadIndexCache(indexSet, neededIds, missingPaths) {
  const byAgreement = new Map();
  for (const member of indexSet.members ?? []) {
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
    const agreementId = record?.source_binding?.agreement_id;
    if (typeof agreementId !== 'string' || agreementId.length === 0) {
      missingPaths.push(`${memberPath} (no source_binding.agreement_id)`);
      continue;
    }
    if (!neededIds.has(agreementId)) continue;
    const canonicalText = record.source_binding?.canonical_text;
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
    for (const siblings of byParent.values()) {
      siblings.sort((left, right) => {
        const start = (left.extent_span?.start_byte ?? 0) - (right.extent_span?.start_byte ?? 0);
        if (start !== 0) return start;
        return compareText(left.node_occurrence_id, right.node_occurrence_id);
      });
    }
    const annotationsById = new Map();
    for (const annotation of Array.isArray(record.annotations) ? record.annotations : []) {
      if (typeof annotation?.annotation_occurrence_id === 'string') {
        annotationsById.set(annotation.annotation_occurrence_id, annotation);
      }
    }
    byAgreement.set(agreementId, {
      path: memberPath,
      canonical_bytes: canonicalBytes,
      nodesById,
      byParent,
      annotationsById,
    });
  }
  return byAgreement;
}

function loadContextCache(contextSet, neededIds, missingPaths) {
  const byAgreement = new Map();
  for (const member of contextSet.members ?? []) {
    const agreementId = member?.agreement_id;
    const memberPath = member?.context_compilation_binding?.path;
    if (typeof agreementId !== 'string' || typeof memberPath !== 'string') {
      missingPaths.push('work3-context-set member missing agreement_id or path');
      continue;
    }
    if (!neededIds.has(agreementId)) continue;
    const abs = resolve(repoRoot, memberPath);
    if (!existsSync(abs)) {
      missingPaths.push(memberPath);
      continue;
    }
    const record = loadJson(abs);
    byAgreement.set(agreementId, {
      path: memberPath,
      definition_edges: Array.isArray(record.definition_edges) ? record.definition_edges : [],
      reference_edges: Array.isArray(record.reference_edges) ? record.reference_edges : [],
    });
  }
  return byAgreement;
}

function targetFromDefinition(edge, index) {
  const selectedAnnId = edge.selected_definition_annotation_occurrence_id;
  const annotation = typeof selectedAnnId === 'string'
    ? index.annotationsById.get(selectedAnnId) ?? null
    : null;
  const ownerId = typeof edge.target_owner_node_occurrence_ids?.[0] === 'string'
    ? edge.target_owner_node_occurrence_ids[0]
    : (typeof annotation?.owner_node_occurrence_id === 'string'
      ? annotation.owner_node_occurrence_id
      : null);
  const owner = ownerId ? index.nodesById.get(ownerId) ?? null : null;
  return {
    target_node_occurrence_id: ownerId,
    target_node: owner,
    annotation,
  };
}

function targetFromReference(edge, index) {
  const targetId = typeof edge.selected_target_node_occurrence_id === 'string'
    ? edge.selected_target_node_occurrence_id
    : (typeof edge.target_node_occurrence_ids?.[0] === 'string'
      ? edge.target_node_occurrence_ids[0]
      : null);
  return {
    target_node_occurrence_id: targetId,
    target_node: targetId ? index.nodesById.get(targetId) ?? null : null,
  };
}

function edgeRecord(kind, edge, index, includeTargetText) {
  const sourceSpan = completeSpan(edge.source_span);
  const sourceVerified = sourceSpan
    ? verifyReportedSpan(index.canonical_bytes, sourceSpan)
    : { start_byte: null, end_byte: null, text_sha256: null, verified: false };
  const termOrReference = kind === 'DEFINITION'
    ? (edge.term ?? edge.raw_text ?? null)
    : (edge.normalised_reference ?? edge.raw_text ?? null);
  const resolved = edge.state === 'RESOLVED';
  let targetId = null;
  let targetNode = null;
  let unresolvedWhy = null;
  if (!resolved) {
    unresolvedWhy = `M3 ${kind.toLowerCase()} edge state is ${edge.state ?? 'missing'} (${edge.reason_code ?? 'no reason_code'})`;
  } else if (kind === 'DEFINITION') {
    const found = targetFromDefinition(edge, index);
    targetId = found.target_node_occurrence_id;
    targetNode = found.target_node;
    if (!targetNode) {
      unresolvedWhy = 'RESOLVED definition edge has no target owner node in the Work 3 M2 index';
    }
  } else {
    const found = targetFromReference(edge, index);
    targetId = found.target_node_occurrence_id;
    targetNode = found.target_node;
    if (!targetNode) {
      unresolvedWhy = 'RESOLVED reference edge has no selected target node in the Work 3 M2 index';
    }
  }

  let targetSpan = null;
  if (targetNode) {
    const span = completeSpan(targetNode.extent_span);
    targetSpan = span
      ? verifyReportedSpan(index.canonical_bytes, span)
      : { start_byte: null, end_byte: null, text_sha256: null, verified: false };
    if (!targetSpan.verified) {
      unresolvedWhy = unresolvedWhy ?? 'target node span failed canonical-byte verification';
    }
  }

  const row = {
    edge_id: kind === 'DEFINITION' ? edge.definition_edge_id ?? null : edge.reference_edge_id ?? null,
    edge_kind: kind,
    raw_text: typeof edge.raw_text === 'string' ? edge.raw_text : null,
    reason_code: edge.reason_code ?? null,
    source_span: sourceVerified,
    state: edge.state ?? null,
    target_node_occurrence_id: targetId,
    target_span: targetSpan,
    term_or_reference: termOrReference,
    unresolved: Boolean(unresolvedWhy) || !resolved,
    unresolved_why: unresolvedWhy,
  };

  if (includeTargetText) {
    if (targetSpan?.verified && index.canonical_bytes) {
      const slice = index.canonical_bytes.subarray(targetSpan.start_byte, targetSpan.end_byte);
      row.target_span_sha256 = targetSpan.text_sha256;
      row.target_text_first_200 = clipUtf8Bytes(slice.toString('utf8'), TARGET_TEXT_BYTES);
      row.target_text_verified = true;
    } else {
      row.target_span_sha256 = null;
      row.target_text_first_200 = null;
      row.target_text_verified = false;
    }
  }

  return row;
}

function collectEdges(kind, edges, nodeSpan, index, includeTargetText) {
  const hits = [];
  for (const edge of edges) {
    if (!spanInside(edge.source_span, nodeSpan)) continue;
    hits.push(edgeRecord(kind, edge, index, includeTargetText));
  }
  hits.sort((left, right) => {
    const start = (left.source_span.start_byte ?? 0) - (right.source_span.start_byte ?? 0);
    if (start !== 0) return start;
    const end = (left.source_span.end_byte ?? 0) - (right.source_span.end_byte ?? 0);
    if (end !== 0) return end;
    return compareText(left.edge_id ?? '', right.edge_id ?? '');
  });
  return hits;
}

function emptyNodeClosure(why) {
  return {
    ancestor_chain: [],
    ancestor_depth: 0,
    article_representing_chapeau: null,
    definition_edges: [],
    governing_chapeau: {
      source: 'UNRESOLVED',
      why,
      node_kind: null,
      node_occurrence_id: null,
      start_byte: null,
      end_byte: null,
      text_sha256: null,
      verified: false,
    },
    node_kind: null,
    node_occurrence_id: null,
    reference_edges: [],
    span: { start_byte: null, end_byte: null, text_sha256: null, verified: false },
    why,
  };
}

function renderOut(report) {
  const lines = [
    `items ${report.counts.items}`,
    `items_with_source_nodes ${report.counts.items_with_source_nodes}`,
    `source_nodes ${report.counts.source_nodes}`,
    `representations_items ${report.counts.representations_items}`,
    `definition_edges ${report.counts.definition_edges}`,
    `reference_edges ${report.counts.reference_edges}`,
    `total_edges ${report.counts.total_edges}`,
    `unresolved_references ${report.counts.unresolved_references}`,
    `unresolved_definitions ${report.counts.unresolved_definitions}`,
    `article_chapeau_unresolved ${report.counts.article_chapeau_unresolved}`,
    `sha_mismatch_spans ${report.counts.sha_mismatch_spans}`,
    `table_sha256 ${report.table_sha256}`,
    `missing_paths ${report.missing_paths.length}`,
  ];
  for (const path of report.missing_paths) lines.push(`  ${path}`);
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Fixed-50 source closures (Q-0012)',
    '',
    'Parent chains walk each identity `source_node_occurrence_id` to SECTION. Governing chapeau is the nearest CHAPEAU on that chain, otherwise the SECTION lead-in. Article-level representing-party chapeaux are resolved for items whose article heading contains “REPRESENTATION”, or whose family is REPRESENTATIONS. M3 edges are those whose source span lies inside the item node span.',
    '',
    `- Items: **${report.counts.items}** (${report.counts.items_with_source_nodes} with source nodes).`,
    `- Edges: **${report.counts.total_edges}** (${report.counts.definition_edges} definition, ${report.counts.reference_edges} reference).`,
    `- Unresolved references: **${report.counts.unresolved_references}**. Unresolved definitions: **${report.counts.unresolved_definitions}**.`,
    `- Representations items with article-chapeau search: **${report.counts.representations_items}**. Unresolved article chapeaux: **${report.counts.article_chapeau_unresolved}**.`,
    `- Table SHA-256: \`${report.table_sha256}\`.`,
    '',
    '| # | Family | Node | Depth | Def | Ref | Unres. refs | Governing chapeau | Article chapeau |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const item of report.items) {
    const node = item.nodes[0];
    const depth = node?.ancestor_depth ?? 0;
    const defCount = item.nodes.reduce((acc, row) => acc + row.definition_edges.length, 0);
    const refCount = item.nodes.reduce((acc, row) => acc + row.reference_edges.length, 0);
    const unresolvedRefs = item.nodes.reduce(
      (acc, row) => acc + row.reference_edges.filter((edge) => edge.unresolved).length,
      0,
    );
    const governing = node?.governing_chapeau?.source ?? '—';
    const article = item.representations_item
      ? (node?.article_representing_chapeau?.source ?? 'UNRESOLVED')
      : '—';
    lines.push(
      `| ${item.sample_ordinal} | ${item.family_key ?? '—'} | ${node?.node_kind ?? '—'} | ${depth} | ${defCount} | ${refCount} | ${unresolvedRefs} | ${governing} | ${article} |`,
    );
  }

  const unresolvedRows = [];
  for (const item of report.items) {
    for (const node of item.nodes) {
      for (const edge of [...node.definition_edges, ...node.reference_edges]) {
        if (!edge.unresolved) continue;
        unresolvedRows.push({
          ordinal: item.sample_ordinal,
          kind: edge.edge_kind,
          text: edge.term_or_reference ?? edge.raw_text ?? '—',
          why: edge.unresolved_why ?? edge.state ?? 'unresolved',
        });
      }
      if (item.representations_item && node.article_representing_chapeau?.source === 'UNRESOLVED') {
        unresolvedRows.push({
          ordinal: item.sample_ordinal,
          kind: 'ARTICLE_CHAPEAU',
          text: '—',
          why: node.article_representing_chapeau.why,
        });
      }
    }
    if (item.nodes.length === 0) {
      unresolvedRows.push({
        ordinal: item.sample_ordinal,
        kind: 'SOURCE_NODE',
        text: '—',
        why: 'identity member has no source_node_occurrence_ids',
      });
    }
  }

  lines.push('', '## Unresolved references and article chapeaux', '');
  if (unresolvedRows.length === 0) {
    lines.push('None.');
  } else {
    for (const row of unresolvedRows) {
      lines.push(`- Item ${row.ordinal} \`${row.kind}\` \`${row.text}\`: ${row.why}.`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const missingPaths = [];
  for (const required of [IDENTITY_PATH, INDEX_SET_PATH, CONTEXT_SET_PATH]) {
    if (!existsSync(required)) missingPaths.push(rel(required));
  }
  if (missingPaths.length > 0) {
    const failed = { error: 'required_control_file_missing', missing_paths: missingPaths };
    writeFileSync(resolve(OUT_DIR, '12-fixed50-source-closures.out'), `${JSON.stringify(failed, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(failed, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const identity = loadJson(IDENTITY_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const contextSet = loadJson(CONTEXT_SET_PATH);
  const members = Array.isArray(identity.members) ? [...identity.members] : [];
  if (members.length !== 50) {
    throw new Error(`expected 50 identity members, got ${members.length}`);
  }
  members.sort((left, right) => left.sample_ordinal - right.sample_ordinal);

  const neededIds = new Set(
    members.map((member) => member.agreement_id).filter((id) => typeof id === 'string'),
  );
  const indexes = loadIndexCache(indexSet, neededIds, missingPaths);
  const contexts = loadContextCache(contextSet, neededIds, missingPaths);

  const items = [];
  let sourceNodeCount = 0;
  let definitionEdgeCount = 0;
  let referenceEdgeCount = 0;
  let unresolvedReferenceCount = 0;
  let unresolvedDefinitionCount = 0;
  let representationsItemCount = 0;
  let articleChapeauUnresolved = 0;
  let shaMismatchSpans = 0;

  function bumpMismatch(span) {
    if (
      span
      && Number.isInteger(span.start_byte)
      && Number.isInteger(span.end_byte)
      && span.verified === false
    ) {
      shaMismatchSpans += 1;
    }
  }

  for (const member of members) {
    const nodeIds = [...new Set(
      (member.source_node_occurrence_ids ?? []).filter((id) => typeof id === 'string' && id.length > 0),
    )].sort(compareText);
    const index = indexes.get(member.agreement_id);
    const context = contexts.get(member.agreement_id);
    if (typeof member.agreement_id === 'string') {
      if (!index) missingPaths.push(`m2 index for agreement ${member.agreement_id}`);
      if (!context) missingPaths.push(`m3 context for agreement ${member.agreement_id}`);
    }

    const includeTargetText = TARGET_TEXT_ORDINALS.has(member.sample_ordinal);
    const nodeClosures = [];

    for (const nodeId of nodeIds) {
      sourceNodeCount += 1;
      if (!index) {
        nodeClosures.push(emptyNodeClosure(`Work 3 M2 index missing for agreement ${member.agreement_id}`));
        continue;
      }
      const node = index.nodesById.get(nodeId);
      if (!node) {
        nodeClosures.push(emptyNodeClosure(`source node ${nodeId} is absent from the Work 3 M2 index`));
        continue;
      }
      const fullChain = ancestorChain(index.nodesById, nodeId);
      const sectioned = chainToSection(fullChain);
      const ancestorChainReported = sectioned.chain.map((entry) => reportedNode(index.canonical_bytes, entry));
      for (const entry of ancestorChainReported) bumpMismatch(entry);

      const span = reportedNode(index.canonical_bytes, node);
      bumpMismatch(span);
      const governing = chapeauRecord(
        index.canonical_bytes,
        governingChapeau(fullChain, sectioned.section, index.byParent, index.canonical_bytes),
      );
      bumpMismatch(governing);

      const article = fullChain.find((entry) => entry.node_kind === 'ARTICLE') ?? null;
      const articleHeading = articleHeadingOf(article, index.byParent, index.canonical_bytes);
      const representationsItem = member.family_key === 'REPRESENTATIONS'
        || REPRESENTATION_HEADING.test(articleHeading ?? '');

      let articleChapeau = null;
      if (representationsItem) {
        articleChapeau = chapeauRecord(
          index.canonical_bytes,
          articleRepresentingChapeau(article, index.byParent, index.canonical_bytes),
        );
        bumpMismatch(articleChapeau);
      }

      const nodeSpan = node.extent_span;
      const definitionEdges = context
        ? collectEdges('DEFINITION', context.definition_edges, nodeSpan, index, includeTargetText)
        : [];
      const referenceEdges = context
        ? collectEdges('REFERENCE', context.reference_edges, nodeSpan, index, includeTargetText)
        : [];
      for (const edge of definitionEdges) {
        bumpMismatch(edge.source_span);
        if (edge.target_span) bumpMismatch(edge.target_span);
      }
      for (const edge of referenceEdges) {
        bumpMismatch(edge.source_span);
        if (edge.target_span) bumpMismatch(edge.target_span);
      }

      nodeClosures.push({
        ancestor_chain: ancestorChainReported,
        ancestor_depth: ancestorChainReported.length,
        article_heading: articleHeading,
        article_representing_chapeau: articleChapeau,
        definition_edges: definitionEdges,
        governing_chapeau: governing,
        node_kind: node.node_kind ?? null,
        node_occurrence_id: nodeId,
        reached_section: sectioned.reached_section,
        reference_edges: referenceEdges,
        representations_item: representationsItem,
        span,
        why: null,
      });
    }

    const representationsItem = nodeClosures.some((row) => row.representations_item)
      || member.family_key === 'REPRESENTATIONS';
    if (representationsItem) representationsItemCount += 1;
    for (const row of nodeClosures) {
      definitionEdgeCount += row.definition_edges.length;
      referenceEdgeCount += row.reference_edges.length;
      unresolvedDefinitionCount += row.definition_edges.filter((edge) => edge.unresolved).length;
      unresolvedReferenceCount += row.reference_edges.filter((edge) => edge.unresolved).length;
      if (row.article_representing_chapeau?.source === 'UNRESOLVED') articleChapeauUnresolved += 1;
    }

    items.push({
      agreement_id: member.agreement_id ?? null,
      family_key: member.family_key ?? null,
      item_kind: member.item_kind ?? null,
      m2_path: index?.path ?? null,
      m3_path: context?.path ?? null,
      nodes: nodeClosures,
      representations_item: representationsItem,
      review_item_id: member.review_item_id ?? null,
      sample_ordinal: member.sample_ordinal,
      source_node_occurrence_ids: nodeIds,
    });
  }

  const uniqueMissing = [...new Set(missingPaths)].sort(compareText);
  const tablePayload = sortedObject({ items });
  const tableJson = `${JSON.stringify(tablePayload, null, 2)}\n`;
  const tableSha = sha256Hex(Buffer.from(tableJson, 'utf8'));

  const report = sortedObject({
    schema: 'Q-0012-FIXED50-SOURCE-CLOSURES/V1',
    identity_manifest_id: identity.fixed_sample_identity_manifest_id ?? null,
    agreement_index_set_id: indexSet.agreement_index_set_id ?? null,
    context_compilation_set_id: contextSet.context_compilation_set_id ?? null,
    counts: {
      article_chapeau_unresolved: articleChapeauUnresolved,
      definition_edges: definitionEdgeCount,
      items: items.length,
      items_with_source_nodes: items.filter((item) => item.source_node_occurrence_ids.length > 0).length,
      reference_edges: referenceEdgeCount,
      representations_items: representationsItemCount,
      sha_mismatch_spans: shaMismatchSpans,
      source_nodes: sourceNodeCount,
      total_edges: definitionEdgeCount + referenceEdgeCount,
      unresolved_definitions: unresolvedDefinitionCount,
      unresolved_references: unresolvedReferenceCount,
    },
    missing_paths: uniqueMissing,
    table_sha256: tableSha,
    target_text_ordinals: [...TARGET_TEXT_ORDINALS].sort((left, right) => left - right),
    items,
  });

  const jsonPath = resolve(OUT_DIR, '12-fixed50-source-closures.json');
  const outPath = resolve(OUT_DIR, '12-fixed50-source-closures.out');
  const mdPath = resolve(OUT_DIR, '12-FIXED50-CLOSURES.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outPath, renderOut(report));
  writeFileSync(mdPath, renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
