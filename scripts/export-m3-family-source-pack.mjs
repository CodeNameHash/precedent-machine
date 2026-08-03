#!/usr/bin/env node
/**
 * Bounded, read-only M3 source-pack exporter. It reads only the production
 * cards required by one named family and records literal quote hashes. The
 * output may be committed as a replay fixture, but this program never writes
 * to the database.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { GENERAL_COVENANT_CODES_V1 } = require('../lib/canonical-v2/contract-bundle');

const SOURCE_PACK_SCHEMA = 'M3_FAMILY_LITERAL_SOURCE_PACK/V1';
const FAMILY_CODES = Object.freeze({
  'general-covenants': Object.freeze([...GENERAL_COVENANT_CODES_V1]),
  'no-other-reps-fraud': Object.freeze([
    'REP-T-NOREP', 'REP-B-NOREP', 'REP-B-ANTIRELIANCE',
    'REP-T-NOOTHERREPS', 'REP-B-NOOTHERREPS', 'REP-T-NONRELIANCE', 'REP-B-NONRELIANCE',
    'REP-T-INDEPINVEST', 'REP-B-INDEPINVEST', 'REP-T-FRAUDCARVEOUT', 'REP-B-FRAUDCARVEOUT', 'DEF-WILLFUL',
  ]),
});
const CARD_COLUMNS = 'id,deal_id,provision_type,provision_subtype,section_ref,primary_quote,region_hash,extraction_version';
const WRITE_VERB_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)\b/i;

function fail(message) { throw new Error(message); }

function parseArgs(argv = process.argv.slice(2)) {
  const args = { family: null, out: null, stdout: false, envFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--family') args.family = argv[++index];
    else if (arg === '--out') args.out = argv[++index];
    else if (arg === '--stdout') args.stdout = true;
    else if (arg === '--env-file') args.envFile = argv[++index];
    else fail(`Unknown argument: ${arg}`);
  }
  if (!FAMILY_CODES[args.family]) fail(`--family must be one of: ${Object.keys(FAMILY_CODES).join(', ')}`);
  if (args.out && args.stdout) fail('Choose either --out or --stdout.');
  if (!args.out && !args.stdout) fail('Refusing to discard source evidence: pass --out or --stdout.');
  return Object.freeze({ ...args, codes: FAMILY_CODES[args.family] });
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  for (const line of readFileSync(resolve(filePath), 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function buildSourcePackSql({ codes }) {
  if (!Array.isArray(codes) || codes.length === 0) fail('buildSourcePackSql requires at least one exact code.');
  const text = [
    'SELECT c.id, c.deal_id, c.provision_type, c.provision_subtype, c.section_ref,',
    '       c.primary_quote, c.region_hash, c.extraction_version, d.acquirer, d.target',
    'FROM public.provision_cards c',
    'JOIN public.deals d ON d.id = c.deal_id',
    'WHERE c.provision_subtype = ANY($1::text[])',
    'ORDER BY c.provision_subtype, c.deal_id, c.section_ref, c.id;',
  ].join('\n');
  return { text, values: [codes] };
}

function assertReadOnlySql(sql) {
  if (!/^SELECT/i.test(String(sql).trim()) || WRITE_VERB_RE.test(sql)) fail('Source-pack SQL must be one SELECT-only statement.');
  return sql;
}

async function selectAll(sb, table, columns, query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(sb.from(table).select(columns).range(from, from + pageSize - 1));
    if (error) fail(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

function buildSourcePack({ family, codes, cards, deals }) {
  const allowed = new Set(codes);
  const byDeal = new Map(deals.map((row) => [row.id, row]));
  const sources = cards
    .filter((card) => allowed.has(card.provision_subtype))
    .map((card) => {
      const quote = String(card.primary_quote || '');
      return Object.freeze({
        card_id: card.id, deal_id: card.deal_id,
        acquirer: byDeal.get(card.deal_id)?.acquirer || null, target: byDeal.get(card.deal_id)?.target || null,
        provision_type: card.provision_type, provision_subtype: card.provision_subtype,
        section_ref: card.section_ref || null, primary_quote: quote,
        primary_quote_sha256: sha256Hex(Buffer.from(quote, 'utf8')),
        region_hash: card.region_hash || null, extraction_version: card.extraction_version || null,
      });
    })
    .sort((a, b) => [a.provision_subtype, a.deal_id, a.section_ref || '', a.card_id].join('\u0000').localeCompare([b.provision_subtype, b.deal_id, b.section_ref || '', b.card_id].join('\u0000')));
  const coverage = codes.slice().sort().map((code) => Object.freeze({
    code,
    source_count: sources.filter((source) => source.provision_subtype === code && source.primary_quote.length > 0).length,
    disposition: sources.some((source) => source.provision_subtype === code && source.primary_quote.length > 0)
      ? 'GROUNDED' : 'NO_GROUNDED_PRODUCTION_EVIDENCE',
  }));
  const body = { schema_version: SOURCE_PACK_SCHEMA, family, selected_codes: [...codes].sort(), sources, coverage };
  return Object.freeze({ ...body, source_pack_id: contentId(SOURCE_PACK_SCHEMA, body) });
}

function verifySourcePack(pack) {
  if (!pack || pack.schema_version !== SOURCE_PACK_SCHEMA || !FAMILY_CODES[pack.family]) fail('Invalid M3 source pack schema or family.');
  const allowed = new Set(FAMILY_CODES[pack.family]);
  for (const source of pack.sources || []) {
    if (!allowed.has(source.provision_subtype)) fail(`Unexpected source code: ${source.provision_subtype}`);
    if (sha256Hex(Buffer.from(String(source.primary_quote || ''), 'utf8')) !== source.primary_quote_sha256) fail(`Quote hash mismatch: ${source.card_id}`);
  }
  const rebuilt = buildSourcePack({ family: pack.family, codes: FAMILY_CODES[pack.family], cards: pack.sources.map((source) => ({ ...source, id: source.card_id })), deals: pack.sources.map((source) => ({ id: source.deal_id, acquirer: source.acquirer, target: source.target })) });
  if (rebuilt.source_pack_id !== pack.source_pack_id) fail('Source pack content identifier mismatch.');
  return true;
}

async function run(args) {
  if (args.envFile) loadEnvFile(args.envFile);
  assertReadOnlySql(buildSourcePackSql({ codes: args.codes }).text);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) fail('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service or anon key.');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key);
  const cards = await selectAll(sb, 'provision_cards', CARD_COLUMNS, (q) => q.in('provision_subtype', args.codes).order('provision_subtype').order('deal_id').order('section_ref').order('id'));
  const dealIds = [...new Set(cards.map((card) => card.deal_id))];
  const deals = dealIds.length ? await selectAll(sb, 'deals', 'id,acquirer,target', (q) => q.in('id', dealIds).order('id')) : [];
  const pack = buildSourcePack({ family: args.family, codes: args.codes, cards, deals });
  verifySourcePack(pack);
  const output = `${JSON.stringify(pack, null, 2)}\n`;
  if (args.stdout) process.stdout.write(output);
  else { mkdirSync(dirname(resolve(args.out)), { recursive: true }); writeFileSync(resolve(args.out), output); }
  return pack;
}

if (import.meta.url === `file://${process.argv[1]}`) run(parseArgs()).catch((error) => { process.stderr.write(`${error.message || error}\n`); process.exit(1); });

export { SOURCE_PACK_SCHEMA, FAMILY_CODES, parseArgs, buildSourcePackSql, assertReadOnlySql, buildSourcePack, verifySourcePack, run };
