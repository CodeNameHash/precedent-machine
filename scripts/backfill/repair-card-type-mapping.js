#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');

const TARGET_TYPE_MAP = new Map([
  ['STRUCT', 'STRUCTURE_MECHANICS'],
]);
const TARGET_TYPES = new Set(TARGET_TYPE_MAP.keys());
const LEGACY_FALLBACK_TYPE = 'MISC_BOILERPLATE';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textHash(value) {
  return crypto.createHash('sha256').update(normalizeText(value)).digest('hex').slice(0, 12);
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { apply: false, envFile: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) throw new Error(`env file not found: ${filePath}`);
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function selectAll(sb, table, columns, build = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select(columns).range(from, from + 999));
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function indexTargetProvisions(provisions) {
  const byDealAndHash = new Map();
  for (const provision of provisions || []) {
    if (!TARGET_TYPES.has(provision.type)) continue;
    const hash = textHash(provision.full_text);
    const key = `${provision.deal_id}:${hash}`;
    if (!byDealAndHash.has(key)) byDealAndHash.set(key, []);
    byDealAndHash.get(key).push(provision);
  }
  return byDealAndHash;
}

function findRepairs(cards, targetProvisionIndex) {
  const repairs = [];
  for (const card of cards || []) {
    if (card.provision_type !== LEGACY_FALLBACK_TYPE) continue;
    const key = `${card.deal_id}:${textHash(card.primary_quote || card.region_full_text)}`;
    const matches = targetProvisionIndex.get(key) || [];
    const targetTypes = [...new Set(matches.map((match) => match.type))];
    if (targetTypes.length !== 1) continue;
    repairs.push({
      id: card.id,
      deal_id: card.deal_id,
      provision_instance_id: card.provision_instance_id,
      from: card.provision_type,
      source_type: targetTypes[0],
      to: TARGET_TYPE_MAP.get(targetTypes[0]),
      title: card.short_title,
      match_count: matches.length,
    });
  }
  return repairs;
}

async function applyRepairs(sb, repairs) {
  for (const repair of repairs) {
    const { error } = await sb
      .from('provision_cards')
      .update({ provision_type: repair.to })
      .eq('id', repair.id)
      .eq('provision_type', repair.from);
    if (error) throw new Error(`Failed to update card ${repair.id}: ${error.message}`);
  }
}

function markdownReport({ repairs, apply }) {
  const counts = repairs.reduce((acc, repair) => {
    acc[repair.to] = (acc[repair.to] || 0) + 1;
    return acc;
  }, {});
  const lines = [
    '# WP-M2-02 type mapping repair',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`,
    `Repairs: ${repairs.length}`,
    '',
    '| Target type | Count |',
    '|---|---:|',
  ];
  for (const [type, count] of Object.entries(counts).sort()) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');
  lines.push('| Card ID | Deal ID | From | To | Title |');
  lines.push('|---|---|---|---|---|');
  for (const repair of repairs.slice(0, 200)) {
    lines.push(`| ${repair.id} | ${repair.deal_id} | ${repair.from} | ${repair.to} | ${String(repair.title || '').replace(/\|/g, '\\|')} |`);
  }
  if (repairs.length > 200) {
    lines.push(`| ... | ... | ... | ... | ${repairs.length - 200} additional repairs omitted |`);
  }
  lines.push('');
  return lines.join('\n');
}

async function run(options = {}) {
  if (options.envFile) loadEnvFile(options.envFile);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service or anon key.');
  const sb = createClient(url, key);
  const provisions = await selectAll(sb, 'provisions', 'id,deal_id,type,full_text', (query) => query.in('type', [...TARGET_TYPES]));
  const cards = await selectAll(sb, 'provision_cards', 'id,deal_id,provision_instance_id,provision_type,short_title,primary_quote,region_full_text', (query) => query.eq('provision_type', LEGACY_FALLBACK_TYPE));
  const repairs = findRepairs(cards, indexTargetProvisions(provisions));
  if (options.apply) await applyRepairs(sb, repairs);
  const report = markdownReport({ repairs, apply: options.apply });
  if (options.out) fs.writeFileSync(options.out, `${report.trim()}\n`);
  return { repairs, report };
}

async function main() {
  try {
    const options = parseArgs();
    const result = await run(options);
    process.stdout.write(`Type mapping repairs: ${result.repairs.length}${options.apply ? ' applied' : ' pending'}\n`);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  findRepairs,
  indexTargetProvisions,
  markdownReport,
  normalizeText,
  parseArgs,
  run,
  textHash,
};
