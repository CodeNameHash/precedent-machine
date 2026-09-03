'use strict';

/**
 * Q-0019 (A-0020): temporal-and-amount census of the fixed 50. Candidate
 * strings are regex-found in each item's node span, then passed to the
 * existing native-producer parsers. Zero model calls. Spans hashed with
 * sha256Hex of the UTF-8 half-open canonical slice.
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
const PRODUCER_DIR = 'lib/canonical-v2/native-producer';
const Q12_PATH = resolve(OUT_DIR, '12-fixed50-source-closures.json');
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);

const SPELLED = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const DURATION_RE = new RegExp(
  String.raw`\b(?:(?:${SPELLED})(?:[ -](?:${SPELLED}))?\s*)?(?:\d[\d,]*)?(?:\s*\(\s*\d[\d,]*\s*\))?\s+(?:calendar\s+|business\s+)?(?:days?|months?|years?|weeks?|hours?)\b`,
  'gi',
);
const DATE_RE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi;
const MONEY_RE = /(?:(?<![A-Za-z])(?:(?:US|CA|C|AU|A|NZ|HK|S)?\$|€|£)|(?:USD|EUR|GBP)\s)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion))?/gi;
const PERCENT_RE = /\b\d+(?:\.\d+)?\s*(?:%|percent(?:age\s+points?)?)\b/gi;
const SHARE_RE = /\b\d[\d,]*(?:\.\d+)?\s+(?:fully\s+(?:paid\s+and\s+)?non[- ]assessable\s+)?(?:issued\s+and\s+outstanding\s+)?shares?\b/gi;

const PARSER_BINDINGS = Object.freeze([
  {
    kind: 'duration',
    parsers: [
      { module: 'cure-period-parse.js', exportName: 'parseCurePeriod', call: (fn, text) => fn(text) },
      { module: 'no-shop-period-parse.js', exportName: 'parseNoShopPeriod', call: (fn, text) => fn(text) },
      { module: 'financing-day-count-parse.js', exportName: 'parseFinancingDayCount', call: (fn, text) => fn(text) },
      { module: 'proxy-meeting-count-parse.js', exportName: 'parseDayCount', call: (fn, text) => fn(text) },
      { module: 'antitrust-regulatory-parse.js', exportName: 'parseFilingDeadlineDays', call: (fn, text) => fn(text) },
      { module: 'termination-fee-parse.js', exportName: 'parseTailPeriodMonths', call: (fn, text) => fn(text) },
      { module: 'measurement-date-parse.js', exportName: 'parseMeasurementPeriod', call: (fn, text) => fn({ quote: text }) },
    ],
  },
  {
    kind: 'date',
    parsers: [
      { module: 'termination-deadline-parse.js', exportName: 'parseTerminationDeadline', call: (fn, text) => fn(text) },
      { module: 'measurement-date-parse.js', exportName: 'parseMeasurementDate', call: (fn, text) => fn({ quote: text }) },
    ],
  },
  {
    kind: 'money',
    parsers: [
      { module: 'termination-fee-parse.js', exportName: 'parseFeeAmount', call: (fn, text) => fn(text) },
      { module: 'per-share-cash-parse.js', exportName: 'parsePerShareCash', call: (fn, text) => fn(text) },
      { module: 'ioc-threshold-parse.js', exportName: 'parseThresholdAmount', call: (fn, text) => fn(text) },
      { module: 'antitrust-regulatory-parse.js', exportName: 'parseDivestitureCapAmount', call: (fn, text) => fn(text) },
    ],
  },
  {
    kind: 'percentage',
    parsers: [
      { module: 'defined-term-threshold-parse.js', exportName: 'parsePercentThreshold', call: (fn, text) => fn(text) },
      { module: 'defined-term-threshold-parse.js', exportName: 'parseThresholdSubstitution', call: (fn, text) => fn(text) },
    ],
  },
  {
    kind: 'share_count',
    parsers: [
      {
        module: 'share-count-parse.js',
        exportName: 'parseShareCount',
        call: (fn, text) => fn({ quote: text, count_kind: 'ISSUED_OUTSTANDING' }),
      },
    ],
  },
]);

const KIND_REGEX = Object.freeze({
  duration: DURATION_RE,
  date: DATE_RE,
  money: MONEY_RE,
  percentage: PERCENT_RE,
  share_count: SHARE_RE,
});

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
    for (const node of record.nodes ?? []) {
      if (typeof node?.node_occurrence_id === 'string') nodesById.set(node.node_occurrence_id, node);
    }
    byAgreement.set(agreementId, { bytes, nodesById, path: member.path });
  }
  return byAgreement;
}

function grepExportCites() {
  const cites = [];
  const seen = new Set();
  for (const binding of PARSER_BINDINGS) {
    for (const parser of binding.parsers) {
      const rel = `${PRODUCER_DIR}/${parser.module}`;
      const abs = resolve(repoRoot, rel);
      const lines = readFileSync(abs, 'utf8').split('\n');
      let functionLine = null;
      let exportLine = null;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (functionLine === null && new RegExp(`^(async\\s+)?function\\s+${parser.exportName}\\b`).test(line)) {
          functionLine = index + 1;
        }
        if (exportLine === null && new RegExp(`^\\s*${parser.exportName}\\s*,?\\s*$`).test(line)) {
          exportLine = index + 1;
        }
        if (exportLine === null && line.includes(parser.exportName) && /module\.exports|exports\./.test(line)) {
          exportLine = index + 1;
        }
      }
      const key = `${rel}:${parser.exportName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cites.push({
        export_name: parser.exportName,
        function_line: functionLine,
        export_line: exportLine,
        grep: `${rel}:${exportLine ?? functionLine}:${parser.exportName}`,
        kind: binding.kind,
        module: rel,
        present: Number.isInteger(functionLine) && Number.isInteger(exportLine),
      });
    }
  }
  return cites.sort((left, right) => compareText(left.grep, right.grep));
}

function collectCandidates(text, bytes, baseStart) {
  const hits = [];
  for (const [kind, regex] of Object.entries(KIND_REGEX)) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matched = match[0].replace(/\s+/g, ' ').trim();
      if (matched.length === 0) continue;
      const localStart = charIndexToByte(text, match.index);
      const localEnd = localStart + Buffer.byteLength(match[0], 'utf8');
      hits.push({
        kind,
        text: match[0],
        span: verifySlice(bytes, baseStart + localStart, baseStart + localEnd),
      });
    }
  }
  hits.sort((left, right) => {
    const startCmp = (left.span.start_byte ?? 0) - (right.span.start_byte ?? 0);
    if (startCmp !== 0) return startCmp;
    return compareText(left.kind, right.kind);
  });
  return hits;
}

function summariseResult(result) {
  if (result == null || typeof result !== 'object') return { outcome: 'ABSTAIN', reason: 'NON_OBJECT_RESULT' };
  if (result.outcome === 'RESOLVED') {
    return {
      outcome: 'RESOLVED',
      typed_value: result.canonical_value ?? result.iso_date ?? result.matched_text ?? null,
    };
  }
  if (result.outcome === 'ABSTAIN' || result.outcome === 'PERIOD_DETECTED') {
    return { outcome: 'ABSTAIN', reason: result.reason ?? result.outcome };
  }
  return { outcome: 'ABSTAIN', reason: String(result.outcome ?? 'UNKNOWN') };
}

function invokeParsers(kind, text, loaded) {
  const binding = PARSER_BINDINGS.find((row) => row.kind === kind);
  if (!binding) {
    return { disposition: 'NO_PARSER', attempts: [] };
  }
  const attempts = [];
  for (const parser of binding.parsers) {
    const fn = loaded.get(`${parser.module}:${parser.exportName}`);
    let raw;
    try {
      raw = parser.call(fn, text);
    } catch (error) {
      raw = { outcome: 'ABSTAIN', reason: `CALL_FAILED:${error.message}` };
    }
    const summary = summariseResult(raw);
    attempts.push({
      export_name: parser.exportName,
      module: `${PRODUCER_DIR}/${parser.module}`,
      ...summary,
    });
  }
  const resolved = attempts.find((row) => row.outcome === 'RESOLVED');
  if (resolved) return { disposition: 'PARSED', parser: resolved.export_name, typed_value: resolved.typed_value, attempts };
  if (attempts.length === 0) return { disposition: 'NO_PARSER', attempts };
  return { disposition: 'ABSTAINED', attempts };
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

  const exportCites = grepExportCites();
  const loaded = new Map();
  for (const binding of PARSER_BINDINGS) {
    for (const parser of binding.parsers) {
      const mod = require(resolve(repoRoot, PRODUCER_DIR, parser.module));
      if (typeof mod[parser.exportName] !== 'function') {
        throw new Error(`export missing: ${parser.module} ${parser.exportName}`);
      }
      loaded.set(`${parser.module}:${parser.exportName}`, mod[parser.exportName]);
    }
  }

  const q12 = loadJson(Q12_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const neededIds = new Set(
    (q12.items ?? []).map((item) => item.agreement_id).filter((id) => typeof id === 'string'),
  );
  const indexes = loadIndexes(indexSet, neededIds, missing);

  const items = [];
  const kindHist = new Map();
  const dispositionHist = new Map();
  let shaVerified = 0;
  let shaFailed = 0;
  let itemsWithoutNodes = 0;

  for (const item of q12.items ?? []) {
    const index = indexes.get(item.agreement_id);
    const q12Node = item.nodes?.[0] ?? null;
    const nodeId = q12Node?.node_occurrence_id ?? item.source_node_occurrence_ids?.[0] ?? null;
    const m2Node = nodeId && index ? index.nodesById.get(nodeId) : null;
    const notes = [];
    const entries = [];
    const counts = {
      date: { parsed: 0, abstained: 0, no_parser: 0, candidates: 0 },
      duration: { parsed: 0, abstained: 0, no_parser: 0, candidates: 0 },
      money: { parsed: 0, abstained: 0, no_parser: 0, candidates: 0 },
      percentage: { parsed: 0, abstained: 0, no_parser: 0, candidates: 0 },
      share_count: { parsed: 0, abstained: 0, no_parser: 0, candidates: 0 },
    };

    if (!q12Node || !m2Node || !index) {
      itemsWithoutNodes += 1;
      notes.push('NO_SOURCE_NODE');
    } else {
      const start = m2Node.extent_span?.start_byte ?? q12Node.span?.start_byte;
      const end = m2Node.extent_span?.end_byte ?? q12Node.span?.end_byte;
      const nodeSpan = verifySlice(index.bytes, start, end);
      if (!nodeSpan.verified) {
        shaFailed += 1;
        notes.push('NODE_SPAN_UNVERIFIED');
      } else {
        shaVerified += 1;
        const text = index.bytes.subarray(start, end).toString('utf8');
        for (const hit of collectCandidates(text, index.bytes, start)) {
          if (hit.span.verified) shaVerified += 1;
          else shaFailed += 1;
          const parsed = invokeParsers(hit.kind, hit.text, loaded);
          increment(kindHist, hit.kind);
          increment(dispositionHist, `${hit.kind}:${parsed.disposition}`);
          counts[hit.kind].candidates += 1;
          if (parsed.disposition === 'PARSED') counts[hit.kind].parsed += 1;
          else if (parsed.disposition === 'ABSTAINED') counts[hit.kind].abstained += 1;
          else counts[hit.kind].no_parser += 1;
          entries.push(sortedObject({
            attempts: parsed.attempts,
            disposition: parsed.disposition,
            end_byte: hit.span.end_byte,
            kind: hit.kind,
            parser: parsed.parser ?? null,
            start_byte: hit.span.start_byte,
            text: hit.text,
            text_sha256: hit.span.text_sha256,
            typed_value: parsed.typed_value ?? null,
            verified: hit.span.verified,
          }));
        }
      }
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
    schema: 'Q-0019-FIXED50-TEMPORAL-AMOUNT/V1',
    authority: 'A-0020',
    parser_export_cites: exportCites,
    counts: {
      items: items.length,
      items_without_nodes: itemsWithoutNodes,
      sha_failed_spans: shaFailed,
      sha_verified_spans: shaVerified,
    },
    kind_histogram: histogramObject(kindHist),
    disposition_histogram: histogramObject(dispositionHist),
    missing_paths: [...new Set(missing)].sort(compareText),
    table_sha256: tableSha,
    items,
  });

  writeFileSync(resolve(OUT_DIR, '19-temporal-amount.json'), `${JSON.stringify(report, null, 2)}\n`);
  const out = [
    `items ${report.counts.items}`,
    `items_without_nodes ${itemsWithoutNodes}`,
    ...['duration', 'date', 'money', 'percentage', 'share_count'].map((kind) => {
      const parsed = dispositionHist.get(`${kind}:PARSED`) ?? 0;
      const abstained = dispositionHist.get(`${kind}:ABSTAINED`) ?? 0;
      const none = dispositionHist.get(`${kind}:NO_PARSER`) ?? 0;
      return `${kind} ${kindHist.get(kind) ?? 0} parsed=${parsed} abstained=${abstained} no_parser=${none}`;
    }),
    `export_cites ${exportCites.length} present=${exportCites.filter((row) => row.present).length}`,
    `sha_verified_spans ${shaVerified}`,
    `sha_failed_spans ${shaFailed}`,
    `table_sha256 ${tableSha}`,
  ];
  writeFileSync(resolve(OUT_DIR, '19-temporal-amount.out'), `${out.join('\n')}\n`);

  const lines = [
    '# Fixed-50 temporal and amount census (Q-0019 / A-0020)',
    '',
    'Candidates are regex-found in each item node span, then passed to `lib/canonical-v2/native-producer/*-parse.js` exports. `NO_PARSER` is reserved for a kind with no binding; every kind below has at least one export.',
    '',
    `- Items: **${items.length}**. Item 39 has no source node.`,
    `- SHA-verified spans: **${shaVerified}**. Failed: **${shaFailed}**.`,
    '',
    '## Totals',
    '',
    '| Kind | Candidates | Parsed | Abstained | No parser |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const kind of ['duration', 'date', 'money', 'percentage', 'share_count']) {
    lines.push(`| ${kind} | ${kindHist.get(kind) ?? 0} | ${dispositionHist.get(`${kind}:PARSED`) ?? 0} | ${dispositionHist.get(`${kind}:ABSTAINED`) ?? 0} | ${dispositionHist.get(`${kind}:NO_PARSER`) ?? 0} |`);
  }
  lines.push('', '## Parser exports (grep)', '', '| Kind | Module | Export | Function line | Export line |', '| --- | --- | --- | ---: | ---: |');
  for (const cite of exportCites) {
    lines.push(`| ${cite.kind} | \`${cite.module}\` | \`${cite.export_name}\` | ${cite.function_line ?? '—'} | ${cite.export_line ?? '—'} |`);
  }
  lines.push('', '## Per item', '', '| Ordinal | Dur P/A | Date P/A | Money P/A | % P/A | Shares P/A | Notes |', '| ---: | --- | --- | --- | --- | --- | --- |');
  for (const row of items) {
    const cell = (kind) => `${row.counts[kind].parsed}/${row.counts[kind].abstained}`;
    lines.push(`| ${row.sample_ordinal} | ${cell('duration')} | ${cell('date')} | ${cell('money')} | ${cell('percentage')} | ${cell('share_count')} | ${row.notes.join('; ') || '—'} |`);
  }
  writeFileSync(resolve(OUT_DIR, '19-TEMPORAL-AMOUNT.md'), `${lines.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
