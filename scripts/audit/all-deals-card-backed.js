#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_REPORT_PATH = 'docs/audits/card-backed-status.md';
const REVIEW_PAGE_PATH = 'pages/review/[id].js';
const PLAN_PATH = 'PLAN-M2-schema-deploy.md';

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
  const args = { reportPath: DEFAULT_REPORT_PATH, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--env-file') args.envFile = argv[++index];
    else if (arg === '--report') args.reportPath = argv[++index];
    else if (arg === '--no-write') args.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function thresholdFromPlan(planText) {
  const match = String(planText || '').match(/provision_cards\.count\(deal_id\)\s*(?:≥|>=)\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function thresholdFromReviewPage(source) {
  const match = String(source || '').match(/const\s+SCHEMA_RENDER_MIN_CARDS\s*=\s*(\d+)\s*;/);
  return match ? Number(match[1]) : null;
}

function readThreshold() {
  const planThreshold = fs.existsSync(PLAN_PATH) ? thresholdFromPlan(fs.readFileSync(PLAN_PATH, 'utf8')) : null;
  const pageThreshold = fs.existsSync(REVIEW_PAGE_PATH) ? thresholdFromReviewPage(fs.readFileSync(REVIEW_PAGE_PATH, 'utf8')) : null;
  const threshold = planThreshold || pageThreshold;
  if (!threshold) throw new Error('Unable to determine card-backed threshold from plan or review page');
  if (pageThreshold && pageThreshold !== threshold) {
    throw new Error(`Threshold mismatch: plan=${threshold}, review page=${pageThreshold}`);
  }
  return threshold;
}

function assertReviewPageBranch(source) {
  const body = String(source || '');
  const required = [
    /schemaCardCount\s*>=\s*SCHEMA_RENDER_MIN_CARDS/,
    /forcedRenderMode\s*===\s*'legacy'/,
    /forcedRenderMode\s*===\s*'schema'/,
    /<ProvisionCardTable\s+reviewDeal=\{schemaReviewDeal/,
  ];
  const missing = required.filter((pattern) => !pattern.test(body));
  if (missing.length) throw new Error('Review page schema/legacy branch shape not recognised');
}

function shortcodeFor(deal) {
  const target = String(deal.target || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (target || String(deal.id || '').slice(0, 8)).toUpperCase().slice(0, 40);
}

function auditDeals(deals, cardCounts, threshold) {
  return (deals || []).map((deal) => {
    const cards = Number(cardCounts.get(deal.id) || 0);
    const thresholdMet = cards >= threshold;
    return {
      deal_id: deal.id,
      deal: `${deal.acquirer || 'Unknown acquirer'} / ${deal.target || 'Unknown target'}`,
      shortcode: shortcodeFor(deal),
      cards,
      threshold_met: thresholdMet,
      entered_card_branch: thresholdMet,
      entered_legacy_branch: !thresholdMet,
      verdict: thresholdMet ? 'PASS' : 'FAIL',
    };
  });
}

function verdictFor(rows) {
  return rows.every((row) => row.threshold_met && !row.entered_legacy_branch) ? 'PASS' : 'FAIL';
}

function markdownReport(rows, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const threshold = options.threshold;
  const verdict = verdictFor(rows);
  const thresholdMet = rows.filter((row) => row.threshold_met).length;
  const legacy = rows.filter((row) => row.entered_legacy_branch).length;
  const lines = [
    `# All-Deals Card-Backed Audit - ${generatedAt}`,
    '',
    `Corpus: ${rows.length} deals.`,
    `Threshold: ${threshold} cards per deal (per PART 3 section 3.5 / PLAN-M2).`,
    '',
    '## Summary',
    '',
    `- Deals meeting threshold: ${thresholdMet} / ${rows.length}.`,
    `- Deals entering legacy fallback: ${legacy} / ${rows.length}.`,
    `- Verdict: ${verdict}.`,
    '',
    '## Per-deal detail',
    '',
    '| Deal | Shortcode | Cards | Threshold met | Entered legacy | Verdict |',
    '|---|---|---:|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${row.deal.replace(/\|/g, '/')} | ${row.shortcode} | ${row.cards} | ${row.threshold_met ? 'YES' : 'NO'} | ${row.entered_legacy_branch ? 'YES' : 'NO'} | ${row.verdict} |`);
  }
  if (verdict === 'FAIL') {
    lines.push('', '## Remediation', '');
    for (const row of rows.filter((item) => item.verdict === 'FAIL')) {
      const reason = row.cards < threshold ? `under threshold (${row.cards}/${threshold} cards)` : 'entered legacy fallback';
      lines.push(`- ${row.deal}: ${reason}. Proposed remediation: inspect parser/card backfill for ${row.shortcode} and re-run targeted extraction after root-cause fix.`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function selectAll(sb, table, columns, query = (q) => q) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(sb.from(table).select(columns).range(from, from + pageSize - 1));
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchCardCounts(sb) {
  const cards = await selectAll(sb, 'provision_cards', 'deal_id');
  if (cards.length === 0) throw new Error('provision_cards table exists but has zero rows');
  const counts = new Map();
  for (const card of cards) counts.set(card.deal_id, (counts.get(card.deal_id) || 0) + 1);
  return counts;
}

async function run(options = {}) {
  if (options.envFile) loadEnvFile(options.envFile);
  const source = fs.readFileSync(REVIEW_PAGE_PATH, 'utf8');
  assertReviewPageBranch(source);
  const threshold = readThreshold();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service or anon key.');

  const sb = createClient(url, key);
  const deals = await selectAll(sb, 'deals', 'id,acquirer,target', (q) => q.order('acquirer'));
  const cardCounts = await fetchCardCounts(sb);
  const rows = auditDeals(deals, cardCounts, threshold);
  const generatedAt = new Date().toISOString();
  const report = markdownReport(rows, { generatedAt, threshold });
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(options.reportPath || DEFAULT_REPORT_PATH), { recursive: true });
    fs.writeFileSync(options.reportPath || DEFAULT_REPORT_PATH, report);
  }
  return { generatedAt, rows, threshold, verdict: verdictFor(rows), report };
}

async function main() {
  try {
    const result = await run(parseArgs());
    const legacy = result.rows.filter((row) => row.entered_legacy_branch).length;
    process.stdout.write(`All-deals card-backed audit: ${result.verdict}, ${result.rows.length} deals, ${legacy} legacy fallback\n`);
    if (result.verdict !== 'PASS') process.exit(1);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertReviewPageBranch,
  auditDeals,
  markdownReport,
  parseArgs,
  readThreshold,
  run,
  shortcodeFor,
  thresholdFromPlan,
  thresholdFromReviewPage,
  verdictFor,
};
