#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_DISCOVERY_PATH = 'docs/audit/parity-discovery.md';
const DEFAULT_REPORT_PATH = 'docs/schema-migration/phase-8-parity.md';
const DEFAULT_TRIAGE_PATH = 'docs/schema-migration/phase-8-parity-triage.md';

const TYPE_MAP = {
  ANTI: 'ANTITRUST_REGULATORY',
  COND: 'CLOSING_CONDITION',
  CONSID: 'CONSIDERATION',
  COV: 'COVENANT_OTHER',
  DEF: 'DEFINITION',
  EQUITY: 'CONSIDERATION',
  IOC: 'COVENANT_INTERIM_OPERATING',
  MAE: 'MAE',
  MISC: 'MISC_BOILERPLATE',
  NOSOL: 'COVENANT_NO_SOLICITATION',
  REP: 'REPRESENTATION',
  SEC: 'SEC_FILING_MEETING',
  STRUCTURE: 'STRUCTURE_MECHANICS',
  TERMF: 'TERMINATION_FEE',
  TERMR: 'TERMINATION_RIGHT',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textHash(value) {
  return crypto.createHash('sha256').update(normalizeText(value)).digest('hex').slice(0, 12);
}

function truncate(value, max = 140) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function stripProposedCategoryPrefix(category) {
  return typeof category === 'string' ? category.replace(/^\[PROPOSED\]\s*/, '') : category;
}

function legacyType(type) {
  const base = String(type || '').trim().toUpperCase().split('-')[0];
  return TYPE_MAP[base] || base || 'UNKNOWN';
}

function legacyCells(provisions) {
  return (Array.isArray(provisions) ? provisions : [])
    .filter((provision) => provision && provision.type !== 'SECTION-LEFTOVER')
    .map((provision) => {
      const quote = normalizeText(provision.full_text);
      const title = normalizeText(stripProposedCategoryPrefix(provision.category) || 'Untitled provision');
      return {
        source: 'legacy',
        key: `quote:${textHash(quote)}`,
        section: normalizeText(provision.type || 'UNKNOWN'),
        field: title,
        type: legacyType(provision.type),
        shortTitle: title,
        quote,
        id: provision.id || null,
      };
    })
    .filter((cell) => cell.quote);
}

function schemaCells(cards) {
  return (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const quote = normalizeText(card.primary_quote || card.region_full_text);
      const title = normalizeText(card.short_title || card.defined_term || 'Untitled provision');
      return {
        source: 'schema',
        key: `quote:${textHash(quote)}`,
        section: normalizeText(card.section_ref || 'Unspecified'),
        field: title,
        type: normalizeText(card.provision_type || 'UNKNOWN'),
        shortTitle: title,
        quote,
        id: card.id || null,
        kind: card.kind || 'standard',
      };
    })
    .filter((cell) => cell.quote);
}

function indexCells(cells) {
  const map = new Map();
  for (const cell of cells) {
    if (!map.has(cell.key)) map.set(cell.key, []);
    map.get(cell.key).push(cell);
  }
  return map;
}

function shiftOne(map, key) {
  const list = map.get(key) || [];
  const item = list.shift();
  if (list.length === 0) map.delete(key);
  return item || null;
}

function compareDeal({ deal, provisions, cards }) {
  const legacy = legacyCells(provisions);
  const schema = schemaCells(cards);
  const schemaByKey = indexCells(schema);
  const diffs = [];

  for (const legacyCell of legacy) {
    const schemaCell = shiftOne(schemaByKey, legacyCell.key);
    if (!schemaCell) {
      diffs.push({
        category: 'missing_schema_card',
        section: legacyCell.section,
        field: legacyCell.field,
        schema: '',
        legacy: legacyCell.quote,
        verdict: 'Missing schema card for visible legacy provision',
        legacy_id: legacyCell.id,
      });
      continue;
    }
    if (legacyCell.type !== schemaCell.type) {
      diffs.push({
        category: 'type_mismatch',
        section: legacyCell.section,
        field: legacyCell.field,
        schema: schemaCell.type,
        legacy: legacyCell.type,
        verdict: 'Type differs',
        legacy_id: legacyCell.id,
        schema_id: schemaCell.id,
      });
    }
    if (legacyCell.shortTitle !== schemaCell.shortTitle) {
      diffs.push({
        category: 'short_title_mismatch',
        section: legacyCell.section,
        field: legacyCell.field,
        schema: schemaCell.shortTitle,
        legacy: legacyCell.shortTitle,
        verdict: 'Canonical short-form differs',
        legacy_id: legacyCell.id,
        schema_id: schemaCell.id,
      });
    }
  }

  for (const remaining of schemaByKey.values()) {
    for (const schemaCell of remaining) {
      diffs.push({
        category: 'schema_only_card',
        section: schemaCell.section,
        field: schemaCell.field,
        schema: schemaCell.quote,
        legacy: '',
        verdict: 'Schema card not present in visible legacy render',
        schema_id: schemaCell.id,
      });
    }
  }

  return {
    deal,
    legacyCellCount: legacy.length,
    schemaCellCount: schema.length,
    comparedCellCount: legacy.length + schema.length,
    diffs,
  };
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function dealName(deal) {
  return `${deal.acquirer || 'Unknown acquirer'} / ${deal.target || 'Unknown target'}`;
}

function discoveryMarkdown(results, generatedAt) {
  const lines = [
    `# Schema Parity Discovery — ${generatedAt}`,
    '',
    `Deals: ${results.length}`,
    '',
    '| Deal ID | Deal | Visible legacy provisions | Schema cards | Status |',
    '|---|---|---:|---:|---|',
  ];
  for (const result of results) {
    const status = result.schemaCellCount >= 40 ? 'READY' : 'BELOW_CARD_THRESHOLD';
    lines.push(`| ${result.deal.id} | ${markdownEscape(dealName(result.deal))} | ${result.legacyCellCount} | ${result.schemaCellCount} | ${status} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function parityMarkdown(results, generatedAt) {
  const totalCompared = results.reduce((sum, result) => sum + result.comparedCellCount, 0);
  const totalDiffs = results.reduce((sum, result) => sum + result.diffs.length, 0);
  const cleanDeals = results.filter((result) => result.diffs.length === 0).length;
  const lines = [
    `# Phase-8 Parity Audit — ${generatedAt}`,
    '',
    `Corpus: ${results.length} deals.`,
    `Total cells compared: ${totalCompared}.`,
    `Total diffs: ${totalDiffs}.`,
    '',
  ];

  for (const result of results) {
    lines.push(`## Deal ${result.deal.id} — ${dealName(result.deal)}`);
    lines.push('');
    lines.push(`Cells: ${result.comparedCellCount}. Diffs: ${result.diffs.length}.`);
    lines.push('');
    if (result.diffs.length === 0) {
      lines.push('No diffs.');
      lines.push('');
      continue;
    }
    lines.push('| Section | Field | Schema-first | Legacy | Verdict |');
    lines.push('|---|---|---|---|---|');
    for (const diff of result.diffs.slice(0, 25)) {
      lines.push(`| ${markdownEscape(diff.section)} | ${markdownEscape(diff.field)} | ${markdownEscape(truncate(diff.schema))} | ${markdownEscape(truncate(diff.legacy))} | ${markdownEscape(diff.verdict)} |`);
    }
    if (result.diffs.length > 25) {
      lines.push(`| ... | ... | ... | ... | ${result.diffs.length - 25} additional diffs omitted from table |`);
    }
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`${cleanDeals} / ${results.length} deals clean.`);
  lines.push('');
  return lines.join('\n');
}

function triageMarkdown(results, generatedAt) {
  const counts = new Map();
  for (const result of results) {
    for (const diff of result.diffs) counts.set(diff.category, (counts.get(diff.category) || 0) + 1);
  }
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [
    `# Phase-8 Parity Triage — ${generatedAt}`,
    '',
    'Schema parity is not clean. Do not delete the legacy renderer or vocab sources yet.',
    '',
    '| Category | Count | Initial diagnosis |',
    '|---|---:|---|',
  ];
  for (const [category, count] of categories) {
    const diagnosis = category === 'missing_schema_card'
      ? 'Visible legacy provision has no matching schema card. Most likely an M2-00 backfill coverage gap.'
      : category === 'schema_only_card'
        ? 'Schema card has no visible legacy counterpart. Likely card backfill over-inclusion or legacy user-mode filtering difference.'
        : category === 'type_mismatch'
          ? 'Same quote appears in both paths but canonical type differs.'
          : 'Same quote appears in both paths but the displayed short form differs.';
    lines.push(`| ${category} | ${count} | ${diagnosis} |`);
  }
  lines.push('');
  lines.push('## Top failing deals');
  lines.push('');
  lines.push('| Deal | Diffs | Missing schema cards | Schema-only cards | Type mismatches | Short-title mismatches |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const result of [...results].sort((a, b) => b.diffs.length - a.diffs.length).slice(0, 10)) {
    const byCategory = result.diffs.reduce((acc, diff) => {
      acc[diff.category] = (acc[diff.category] || 0) + 1;
      return acc;
    }, {});
    lines.push(`| ${markdownEscape(dealName(result.deal))} | ${result.diffs.length} | ${byCategory.missing_schema_card || 0} | ${byCategory.schema_only_card || 0} | ${byCategory.type_mismatch || 0} | ${byCategory.short_title_mismatch || 0} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) throw new Error(`env file not found: ${fullPath}`);
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    discoveryPath: DEFAULT_DISCOVERY_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    triagePath: DEFAULT_TRIAGE_PATH,
    write: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--discovery') args.discoveryPath = argv[++i];
    else if (arg === '--report') args.reportPath = argv[++i];
    else if (arg === '--triage') args.triagePath = argv[++i];
    else if (arg === '--no-write') args.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function selectAll(sb, table, columns, query = (q) => q) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const request = query(sb.from(table).select(columns).range(from, to));
    const { data, error } = await request;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchCorpus(sb) {
  const deals = await selectAll(sb, 'deals', 'id,acquirer,target', (q) => q.order('acquirer'));
  const results = [];
  for (const deal of deals) {
    const provisions = await selectAll(
      sb,
      'provisions',
      'id,type,category,full_text',
      (q) => q.eq('deal_id', deal.id),
    );
    const cards = await selectAll(
      sb,
      'provision_cards',
      'id,provision_type,section_ref,short_title,defined_term,primary_quote,region_full_text,kind',
      (q) => q.eq('deal_id', deal.id),
    );
    results.push(compareDeal({ deal, provisions, cards }));
  }
  return results;
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.replace(/\s+$/, '')}\n`);
}

async function run(options = {}) {
  if (options.envFile) loadEnvFile(options.envFile);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service or anon key.');

  const sb = createClient(url, key);
  const generatedAt = new Date().toISOString();
  const results = await fetchCorpus(sb);
  const totalDiffs = results.reduce((sum, result) => sum + result.diffs.length, 0);

  if (options.write !== false) {
    writeFile(options.discoveryPath || DEFAULT_DISCOVERY_PATH, discoveryMarkdown(results, generatedAt));
    writeFile(options.reportPath || DEFAULT_REPORT_PATH, parityMarkdown(results, generatedAt));
    if (totalDiffs > 0) {
      writeFile(options.triagePath || DEFAULT_TRIAGE_PATH, triageMarkdown(results, generatedAt));
    }
  }
  return { generatedAt, results, totalDiffs };
}

async function main() {
  try {
    const options = parseArgs();
    const result = await run(options);
    const cleanDeals = result.results.filter((dealResult) => dealResult.diffs.length === 0).length;
    process.stdout.write(`Schema parity: ${cleanDeals}/${result.results.length} clean deals, ${result.totalDiffs} diffs\n`);
    if (result.totalDiffs > 0) process.exit(1);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  compareDeal,
  discoveryMarkdown,
  legacyCells,
  normalizeText,
  parityMarkdown,
  parseArgs,
  schemaCells,
  textHash,
  triageMarkdown,
  truncate,
};
