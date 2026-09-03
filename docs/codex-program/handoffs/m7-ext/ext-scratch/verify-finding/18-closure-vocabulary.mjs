'use strict';

/**
 * Q-0018 (A-0020): modal, enumerated-limb and proviso census of the
 * fixed 50. Surfaces are each item's Q-0012 node and, when resolved,
 * that item's governing chapeau. Enumerated limbs are M2 children, not
 * invented regex spans. Zero model calls. Spans hashed with sha256Hex
 * of the UTF-8 half-open canonical slice.
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
const Q12_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);

const MODAL_PHRASES = [
  'is entitled to',
  'is required to',
  'shall not',
  'will not',
  'may not',
  'shall',
  'will',
  'may',
  'must',
];

const PROVISO_PHRASES = [
  'provided, however',
  'provided that',
  'except that',
  'other than',
  'to the extent',
  'so long as',
  'subject to',
  'notwithstanding',
  'unless',
  'except',
];

const LEADING_MARKER_RE = /^\s*(\((?:[ivxlcdm]+|[a-zA-Z]|[0-9]{1,2})\))/u;

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
  const out = {};
  for (const key of [...map.keys()].sort(compareText)) out[key] = map.get(key);
  return out;
}

function charIndexToByte(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function isWordChar(char) {
  return typeof char === 'string' && /[A-Za-z0-9]/.test(char);
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

function spanContains(outer, inner) {
  return Number.isInteger(outer?.start_byte)
    && Number.isInteger(outer?.end_byte)
    && Number.isInteger(inner?.start_byte)
    && Number.isInteger(inner?.end_byte)
    && inner.start_byte >= outer.start_byte
    && inner.end_byte <= outer.end_byte;
}

function quotedSpans(text, baseStart, bytes) {
  const spans = [];
  const pairs = [
    ['"', '"'],
    ['\u201c', '\u201d'],
    ['\u2018', '\u2019'],
    ["'", "'"],
  ];
  for (const [open, close] of pairs) {
    let from = 0;
    while (from < text.length) {
      const openAt = text.indexOf(open, from);
      if (openAt < 0) break;
      const closeAt = text.indexOf(close, openAt + open.length);
      if (closeAt < 0) break;
      const start = baseStart + charIndexToByte(text, openAt);
      const end = baseStart + charIndexToByte(text, closeAt + close.length);
      const span = verifySlice(bytes, start, end);
      if (span.verified) spans.push(span);
      from = closeAt + close.length;
    }
  }
  return spans;
}

function findPhrases(kind, phrases, text, bytes, baseStart) {
  const hits = [];
  const lower = text.toLowerCase();
  const taken = new Array(text.length).fill(false);
  const ordered = [...phrases].sort((left, right) => right.length - left.length);
  for (let index = 0; index < text.length; index += 1) {
    if (taken[index]) continue;
    for (const phrase of ordered) {
      const slice = lower.slice(index, index + phrase.length);
      if (slice !== phrase) continue;
      const before = index === 0 ? '' : text[index - 1];
      const after = index + phrase.length >= text.length ? '' : text[index + phrase.length];
      const startOk = !isWordChar(before);
      const endOk = !isWordChar(after);
      if (!startOk || !endOk) continue;
      let blocked = false;
      for (let cursor = index; cursor < index + phrase.length; cursor += 1) {
        if (taken[cursor]) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (let cursor = index; cursor < index + phrase.length; cursor += 1) taken[cursor] = true;
      const localStart = charIndexToByte(text, index);
      const localEnd = localStart + Buffer.byteLength(text.slice(index, index + phrase.length), 'utf8');
      hits.push({
        kind,
        text: text.slice(index, index + phrase.length),
        form: phrase,
        span: verifySlice(bytes, baseStart + localStart, baseStart + localEnd),
      });
      break;
    }
  }
  return hits;
}

function markerFromReference(reference) {
  if (typeof reference !== 'string' || reference.length === 0) return null;
  const match = reference.match(/\(([^()]+)\)\s*$/u);
  return match ? `(${match[1]})` : null;
}

function markerFromExtent(bytes, node) {
  const start = node?.extent_span?.start_byte;
  const end = node?.extent_span?.end_byte;
  if (!bytes || !Number.isInteger(start) || !Number.isInteger(end) || end > bytes.length) return null;
  const preview = bytes.subarray(start, Math.min(end, start + 24)).toString('utf8');
  const match = preview.match(LEADING_MARKER_RE);
  return match ? match[1] : null;
}

function loadIndexes(indexSet, neededIds, missing) {
  const byAgreement = new Map();
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
    if (!neededIds.has(agreementId)) continue;
    const bytes = Buffer.from(text, 'utf8');
    const nodesById = new Map();
    const byParent = new Map();
    for (const node of record.nodes ?? []) {
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
    byAgreement.set(agreementId, { bytes, nodesById, byParent, path: member.path });
  }
  return byAgreement;
}

function definedTermWindows(q12Node, quotes) {
  const windows = [...quotes];
  for (const edge of q12Node?.definition_edges ?? []) {
    const span = edge?.source_span;
    if (span?.verified && Number.isInteger(span.start_byte) && Number.isInteger(span.end_byte)) {
      windows.push({ start_byte: span.start_byte, end_byte: span.end_byte });
    }
  }
  return windows;
}

function finishEntry(entry, windows) {
  return {
    ...entry,
    inside_defined_term: windows.some((window) => spanContains(window, {
      start_byte: entry.start_byte,
      end_byte: entry.end_byte,
    })),
  };
}

function scanSurface({
  bytes,
  index,
  surface,
  nodeOccurrenceId,
  start,
  end,
  q12Node,
}) {
  const entries = [];
  const span = verifySlice(bytes, start, end);
  if (!span.verified) {
    return { entries, sha_failed: 1, sha_verified: 0, child_kinds: [] };
  }
  const text = bytes.subarray(start, end).toString('utf8');
  const quotes = quotedSpans(text, start, bytes);
  const windows = definedTermWindows(q12Node, quotes);
  let shaVerified = 1;
  let shaFailed = 0;

  for (const hit of [
    ...findPhrases('modal', MODAL_PHRASES, text, bytes, start),
    ...findPhrases('proviso', PROVISO_PHRASES, text, bytes, start),
  ]) {
    if (hit.span.verified) shaVerified += 1;
    else shaFailed += 1;
    entries.push(finishEntry({
      child_node_kind: null,
      child_node_occurrence_id: null,
      end_byte: hit.span.end_byte,
      kind: hit.kind,
      marker: null,
      start_byte: hit.span.start_byte,
      surface,
      text: hit.text,
      text_sha256: hit.span.text_sha256,
      verified: hit.span.verified,
    }, windows));
  }

  const children = typeof nodeOccurrenceId === 'string'
    ? (index.byParent.get(nodeOccurrenceId) ?? [])
    : [];
  const childKinds = [];
  for (const child of children) {
    const childStart = child.extent_span?.start_byte;
    const childEnd = child.extent_span?.end_byte;
    const childSpan = verifySlice(bytes, childStart, childEnd);
    if (childSpan.verified) shaVerified += 1;
    else shaFailed += 1;
    const marker = markerFromReference(child.reference) ?? markerFromExtent(bytes, child);
    childKinds.push(child.node_kind ?? 'UNKNOWN');
    entries.push(finishEntry({
      child_node_kind: child.node_kind ?? null,
      child_node_occurrence_id: child.node_occurrence_id ?? null,
      end_byte: childSpan.end_byte,
      kind: 'enumerated_limb',
      marker,
      start_byte: childSpan.start_byte,
      surface,
      text: marker,
      text_sha256: childSpan.text_sha256,
      verified: childSpan.verified,
    }, windows));
  }

  entries.sort((left, right) => {
    const startCmp = (left.start_byte ?? 0) - (right.start_byte ?? 0);
    if (startCmp !== 0) return startCmp;
    const endCmp = (left.end_byte ?? 0) - (right.end_byte ?? 0);
    if (endCmp !== 0) return endCmp;
    return compareText(left.kind, right.kind) || compareText(left.text ?? '', right.text ?? '');
  });
  return { entries, sha_failed: shaFailed, sha_verified: shaVerified, child_kinds: childKinds };
}

function main() {
  const missing = [];
  for (const required of [Q12_PATH, INDEX_SET_PATH]) {
    if (!existsSync(required)) missing.push(required);
  }
  if (missing.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: 'missing', missing }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const q12 = loadJson(Q12_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const neededIds = new Set(
    (q12.items ?? []).map((item) => item.agreement_id).filter((id) => typeof id === 'string'),
  );
  const indexes = loadIndexes(indexSet, neededIds, missing);

  const items = [];
  const kindHist = new Map();
  const formHist = new Map();
  const childKindHist = new Map();
  let shaVerified = 0;
  let shaFailed = 0;
  let surfaces = 0;
  let unresolvedChapeaus = 0;
  let itemsWithoutNodes = 0;

  for (const item of q12.items ?? []) {
    const index = indexes.get(item.agreement_id);
    if (!index) missing.push(`m2 for ${item.agreement_id}`);
    const q12Node = item.nodes?.[0] ?? null;
    const nodeId = q12Node?.node_occurrence_id
      ?? item.source_node_occurrence_ids?.[0]
      ?? null;
    const m2Node = nodeId && index ? index.nodesById.get(nodeId) : null;
    const entries = [];
    const notes = [];

    if (!q12Node || !m2Node || !index) {
      itemsWithoutNodes += 1;
      notes.push('NO_SOURCE_NODE');
    } else {
      const nodeScan = scanSurface({
        bytes: index.bytes,
        index,
        surface: 'node',
        nodeOccurrenceId: nodeId,
        start: m2Node.extent_span?.start_byte ?? q12Node.span?.start_byte,
        end: m2Node.extent_span?.end_byte ?? q12Node.span?.end_byte,
        q12Node,
      });
      entries.push(...nodeScan.entries);
      shaVerified += nodeScan.sha_verified;
      shaFailed += nodeScan.sha_failed;
      surfaces += 1;
      for (const kind of nodeScan.child_kinds) increment(childKindHist, kind);
    }

    const chapeau = q12Node?.governing_chapeau ?? null;
    if (chapeau?.verified && Number.isInteger(chapeau.start_byte) && Number.isInteger(chapeau.end_byte) && index) {
      const chapeauScan = scanSurface({
        bytes: index.bytes,
        index,
        surface: 'governing_chapeau',
        nodeOccurrenceId: chapeau.node_occurrence_id,
        start: chapeau.start_byte,
        end: chapeau.end_byte,
        q12Node,
      });
      entries.push(...chapeauScan.entries);
      shaVerified += chapeauScan.sha_verified;
      shaFailed += chapeauScan.sha_failed;
      surfaces += 1;
      for (const kind of chapeauScan.child_kinds) increment(childKindHist, `chapeau:${kind}`);
    } else if (q12Node) {
      unresolvedChapeaus += 1;
      notes.push(chapeau?.why ?? 'GOVERNING_CHAPEAU_UNRESOLVED');
    }

    const counts = { enumerated_limb: 0, modal: 0, proviso: 0 };
    for (const entry of entries) {
      increment(kindHist, entry.kind);
      counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
      const form = entry.kind === 'enumerated_limb'
        ? `${entry.child_node_kind ?? 'UNKNOWN'}:${entry.marker ?? 'none'}`
        : (entry.text ?? '').toLowerCase();
      increment(formHist, `${entry.kind}:${form}`);
    }

    items.push(sortedObject({
      agreement_id: item.agreement_id ?? null,
      counts,
      entries,
      node_kind: q12Node?.node_kind ?? null,
      node_occurrence_id: nodeId,
      notes,
      sample_ordinal: item.sample_ordinal,
    }));
  }

  items.sort((left, right) => (left.sample_ordinal ?? 0) - (right.sample_ordinal ?? 0));
  const tablePayload = sortedObject({ items });
  const tableSha = sha256Hex(Buffer.from(`${JSON.stringify(tablePayload, null, 2)}\n`, 'utf8'));
  const report = sortedObject({
    schema: 'Q-0018-FIXED50-VOCABULARY/V1',
    authority: 'A-0020',
    phrases: {
      modal: MODAL_PHRASES,
      proviso: PROVISO_PHRASES,
    },
    counts: {
      items: items.length,
      items_without_nodes: itemsWithoutNodes,
      surfaces,
      unresolved_chapeaus: unresolvedChapeaus,
      sha_failed_spans: shaFailed,
      sha_verified_spans: shaVerified,
    },
    kind_histogram: histogramObject(kindHist),
    form_histogram: histogramObject(formHist),
    child_kind_histogram: histogramObject(childKindHist),
    missing_paths: [...new Set(missing)].sort(compareText),
    table_sha256: tableSha,
    items,
  });

  writeFileSync(resolve(OUT_DIR, '18-closure-vocabulary.json'), `${JSON.stringify(report, null, 2)}\n`);
  const out = [
    `items ${report.counts.items}`,
    `surfaces ${surfaces}`,
    `modals ${kindHist.get('modal') ?? 0}`,
    `enumerated_limbs ${kindHist.get('enumerated_limb') ?? 0}`,
    `provisos ${kindHist.get('proviso') ?? 0}`,
    `child_kinds ${[...childKindHist.keys()].sort(compareText).join(',')}`,
    `items_without_nodes ${itemsWithoutNodes}`,
    `unresolved_chapeaus ${unresolvedChapeaus}`,
    `sha_verified_spans ${shaVerified}`,
    `sha_failed_spans ${shaFailed}`,
    `table_sha256 ${tableSha}`,
  ];
  writeFileSync(resolve(OUT_DIR, '18-closure-vocabulary.out'), `${out.join('\n')}\n`);

  const lines = [
    '# Fixed-50 modal, limb and proviso census (Q-0018 / A-0020)',
    '',
    'Surfaces: each item node, plus the Q-0012 governing chapeau when that span is verified. Enumerated limbs are M2 children (kinds as found). Marker phrases are the A-0020 lists, longest-first, word-bounded.',
    '',
    `- Items: **${items.length}**. Surfaces scanned: **${surfaces}**. Item 39 has no source node.`,
    `- Hits: modal **${kindHist.get('modal') ?? 0}**, child limbs **${kindHist.get('enumerated_limb') ?? 0}**, proviso **${kindHist.get('proviso') ?? 0}**.`,
    `- Unresolved chapeaus: **${unresolvedChapeaus}**. SHA-verified spans: **${shaVerified}**. Failed: **${shaFailed}**.`,
    '',
    '## Child kinds found',
    '',
    '| Kind | Count |',
    '| --- | ---: |',
  ];
  for (const [kind, count] of [...childKindHist.entries()].sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))) {
    lines.push(`| \`${kind}\` | ${count} |`);
  }
  lines.push('', '## Per item', '', '| Ordinal | Node | Modal | Limb | Proviso | Notes |', '| ---: | --- | ---: | ---: | ---: | --- |');
  for (const row of items) {
    lines.push(`| ${row.sample_ordinal} | \`${row.node_kind ?? 'none'}\` | ${row.counts.modal} | ${row.counts.enumerated_limb} | ${row.counts.proviso} | ${row.notes.join('; ') || '—'} |`);
  }
  lines.push('', '## Forms', '', '| Kind | Form | Count |', '| --- | --- | ---: |');
  for (const [key, count] of [...formHist.entries()].sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))) {
    const sep = key.indexOf(':');
    lines.push(`| ${key.slice(0, sep)} | \`${key.slice(sep + 1)}\` | ${count} |`);
  }
  writeFileSync(resolve(OUT_DIR, '18-CLOSURE-VOCABULARY.md'), `${lines.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
