#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { FEATURES } = require('../lib/schema/features');
const { summarizeSchemaCoverage, featuresOf } = require('../lib/schema/coverage');
const { MODEL_READONLY_KEYS, LOW_VALUE_PROMPT_KEYS } = require('../lib/schema/prompt');

const PAGE_SIZE = 1000;
const OUT_DIR = path.join(__dirname, '..', 'docs', 'schema-migration');
const JSON_OUT = path.join(OUT_DIR, 'empty-state-audit.json');
const MD_OUT = path.join(OUT_DIR, 'empty-state-audit.md');

const FORCE_SILENT = new Set([
  ...MODEL_READONLY_KEYS,
  ...LOW_VALUE_PROMPT_KEYS,
  'flags',
  'materialContractsBucketsSource',
]);

const FORCE_EXTRACTION_PENDING = new Set([
  'mainConcept',
]);

const FORCE_NEEDS_REVIEW = new Set([
  'iocAffirmativeScope',
  'iocAffirmativeStandard',
  'materialContractsBuckets',
  'materialContractsDollarThresholds',
  'negativePreambleExceptions',
  'parentBuyerIocBuckets',
  'permittedExceptions',
]);

const REVIEW_GROUPS = new Set([
  'Deal certainty',
  'Fiduciary out',
  'Interim covenants',
  'Regulatory',
  'Representations',
  'Structure',
  'Termination',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const file = path.join(dir, '.env.local');
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadEnvLocal(cwd = path.join(__dirname, '..')) {
  const file = findEnvLocal(cwd);
  if (!file || !fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function getSupabase() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service key.');
  return createClient(url, key);
}

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || String(error));
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function isStagingDeal(deal) {
  const metadata = isPlainObject(deal && deal.metadata) ? deal.metadata : {};
  return metadata.ingest_status === 'staging';
}

async function fetchLiveCorpus(sb) {
  const deals = await fetchAllPages(() => sb
    .from('deals')
    .select('id, acquirer, target, metadata')
    .order('target', { ascending: true }));
  const liveDeals = deals.filter((deal) => !isStagingDeal(deal));
  const liveDealIds = liveDeals.map((deal) => deal.id).filter(Boolean);
  const provisions = liveDealIds.length
    ? await fetchAllPages(() => sb
      .from('provisions')
      .select('id, deal_id, type, category, ai_metadata')
      .in('deal_id', liveDealIds)
      .order('deal_id', { ascending: true })
      .order('created_at', { ascending: true }))
    : [];

  return { deals: liveDeals, provisions };
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return JSON.stringify(value.slice(0, 3)).slice(0, 260);
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 260);
  return String(value).slice(0, 260);
}

function priorityOf(feature, row) {
  if (!feature) return 0;
  let score = 0;
  if (FORCE_EXTRACTION_PENDING.has(feature.key)) score += 80;
  if (FORCE_NEEDS_REVIEW.has(feature.key)) score += 90;
  if (feature.benchmarkable) score += 25;
  if (REVIEW_GROUPS.has(feature.displayGroup)) score += 15;
  if (feature.requiredEvidence || feature.citable) score += 10;
  score += Math.min(30, Math.floor((row.total || 0) / 25));
  if ((row.total || 0) > 0 && (row.populated || 0) === 0) score += 10;
  return score;
}

function proposedWhenEmpty(feature, row) {
  if (!feature) return 'needs_review';
  if (FORCE_SILENT.has(feature.key)) return 'silent';
  if (FORCE_EXTRACTION_PENDING.has(feature.key)) return 'extraction_pending';
  if (FORCE_NEEDS_REVIEW.has(feature.key)) return 'needs_review';
  if (feature.presence === 'conditional' || feature.presenceCondition) return 'not_applicable';
  if (feature.benchmarkable && row && row.total >= 10 && row.populated === 0) return 'needs_review';
  if (feature.benchmarkable && row && row.total >= 25 && row.populated / row.total < 0.05) return 'needs_review';
  if (feature.displayGroup === 'Other') return 'silent';
  return feature.whenEmpty || 'silent';
}

function sampleForFeature(feature, provisions, max = 3) {
  const populated = [];
  const empty = [];
  for (const provision of provisions) {
    if (!feature || !Array.isArray(feature.provisionTypes) || !feature.provisionTypes.includes(provision.type)) continue;
    const features = featuresOf(provision);
    const code = features.canonicalCode || (provision.ai_metadata && provision.ai_metadata.code) || null;
    if (Array.isArray(feature.provisionCodes) && feature.provisionCodes.length > 0 && (!code || !feature.provisionCodes.includes(code))) continue;
    const value = features[feature.key];
    const item = {
      deal_id: provision.deal_id,
      provision_id: provision.id,
      type: provision.type,
      code,
      category: provision.category || null,
      section_number: provision.section_number || features.sectionNumber || null,
    };
    const rendered = displayValue(value);
    if (rendered && populated.length < max) populated.push({ ...item, value: rendered });
    if (!rendered && empty.length < max) empty.push(item);
    if (populated.length >= max && empty.length >= max) break;
  }
  return { populated, empty };
}

function buildAudit({ deals, provisions }, opts = {}) {
  const coverage = summarizeSchemaCoverage(provisions);
  const byKey = new Map(coverage.features.map((row) => [row.feature_key, row]));
  const rows = Object.values(FEATURES).map((feature) => {
    const row = byKey.get(feature.key) || {
      feature_key: feature.key,
      label: feature.label || feature.key,
      provision_types: feature.provisionTypes || [],
      provision_codes: feature.provisionCodes || [],
      when_empty: feature.whenEmpty || 'silent',
      total: 0,
      populated: 0,
      not_applicable: 0,
      silent: 0,
      extraction_pending: 0,
      needs_review: 0,
    };
    const total = row.total || 0;
    const populated = row.populated || 0;
    const empty = total - populated;
    const proposed = proposedWhenEmpty(feature, row);
    return {
      feature_key: feature.key,
      label: feature.label,
      display_group: feature.displayGroup,
      value_type: feature.valueType,
      list_item_type: feature.listItemType,
      list_item_tag_family: feature.listItemTagFamily,
      provision_types: feature.provisionTypes || [],
      provision_codes: feature.provisionCodes || [],
      benchmarkable: !!feature.benchmarkable,
      required_evidence: !!feature.requiredEvidence,
      citable: !!feature.citable,
      current_when_empty: feature.whenEmpty || 'silent',
      proposed_when_empty: proposed,
      total,
      populated,
      empty,
      populated_pct: total ? Number(((populated / total) * 100).toFixed(1)) : null,
      priority: priorityOf(feature, row),
      sample: opts.samples === false ? null : sampleForFeature(feature, provisions),
    };
  }).sort((a, b) => b.priority - a.priority || b.empty - a.empty || a.feature_key.localeCompare(b.feature_key));

  const proposedCounts = rows.reduce((memo, row) => {
    memo[row.proposed_when_empty] = (memo[row.proposed_when_empty] || 0) + 1;
    return memo;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    corpus: {
      deals: deals.length,
      provisions: provisions.length,
    },
    totals: coverage.totals,
    proposed_counts: proposedCounts,
    rows,
  };
}

function markdownTable(rows) {
  const lines = [
    '| Feature | Group | Current | Proposed | Total | Populated | Empty | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const row of rows) {
    const notes = [];
    if (row.benchmarkable) notes.push('benchmarkable');
    if (row.list_item_tag_family) notes.push(row.list_item_tag_family);
    if (row.required_evidence || row.citable) notes.push('citable');
    lines.push(`| \`${row.feature_key}\` | ${row.display_group} | ${row.current_when_empty} | ${row.proposed_when_empty} | ${row.total} | ${row.populated} | ${row.empty} | ${notes.join(', ')} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(audit) {
  const changed = audit.rows.filter((row) => row.current_when_empty !== row.proposed_when_empty);
  const top = audit.rows.filter((row) => row.total > 0).slice(0, 40);
  return [
    '# WP-SCHEMA P7A Empty-State Audit',
    '',
    `Generated: ${audit.generated_at}`,
    '',
    `Corpus: ${audit.corpus.deals} deals, ${audit.corpus.provisions} provisions.`,
    '',
    `Feature opportunities: ${audit.totals.feature_opportunities}; populated: ${audit.totals.populated}; empty: ${audit.totals.feature_opportunities - audit.totals.populated}.`,
    '',
    `Proposed states: ${Object.entries(audit.proposed_counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`,
    '',
    '## Proposed State Changes',
    '',
    changed.length ? markdownTable(changed.slice(0, 80)) : 'No state changes proposed.',
    '',
    '## Top Audit Rows',
    '',
    markdownTable(top),
    '',
    '## Notes',
    '',
    '- `scheduleReference` stays low-value metadata and remains silent.',
    '- `materialContractsBuckets` is reviewed because the field is useful but the legal bucket universe is not closed.',
    '- `permittedExceptions` is reviewed because exceptions may be coded or bespoke; `OTHER` with verbatim text is required when no code fits.',
    '- `mainConcept` is extraction pending when empty because it is the admin/search fallback, not a legal absence.',
    '',
  ].join('\n');
}

function writeAudit(audit) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(MD_OUT, renderMarkdown(audit));
}

async function main() {
  const sb = getSupabase();
  const corpus = await fetchLiveCorpus(sb);
  const audit = buildAudit(corpus);
  writeAudit(audit);
  console.log(`Wrote ${path.relative(process.cwd(), JSON_OUT)}`);
  console.log(`Wrote ${path.relative(process.cwd(), MD_OUT)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message || String(err));
    process.exit(1);
  });
}

module.exports = {
  FORCE_EXTRACTION_PENDING,
  FORCE_NEEDS_REVIEW,
  FORCE_SILENT,
  buildAudit,
  proposedWhenEmpty,
  renderMarkdown,
};
