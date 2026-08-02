#!/usr/bin/env node
/**
 * scripts/export-v1-provision-snapshot.mjs
 *
 * Read-only export of v1 `provision_cards` into a content-addressed
 * `V1_PROVISION_SNAPSHOT/V1` artifact -- the `v1_snapshot` input
 * lib/canonical-v2/native-producer/v1v2-comparator.js's comparator net
 * consumes (docs/superpowers/specs/2026-08-01-v1v2-comparator-net-design.md).
 * This script NEVER writes to the database: it selects, never inserts,
 * updates or deletes -- `buildSnapshotSql` (exported, pure, unit-testable
 * without a DB connection) is the literal read-only SQL this script's query
 * is equivalent to, kept as a documented, testable artifact even though the
 * actual fetch below goes through the supabase-js query builder (which
 * parameterises safely on its own and has no raw-SQL execution surface this
 * script needs -- see the "SQL builder" section for why both exist).
 *
 * REFUSES TO RUN WITHOUT AN EXPLICIT --deal ALLOWLIST (spec Acceptance:
 * "the snapshot export script ... refuses to run without an explicit
 * --deal allowlist argument"). Checked BEFORE any network/DB access --
 * `parseArgs` alone throws, so this is unit-testable with zero I/O.
 *
 * Usage:
 *   node scripts/export-v1-provision-snapshot.mjs \
 *     --deal <production deal UUID> [--deal <uuid> ...] \
 *     [--governed-deal-key <uuid>=<governed_deal_key>] \
 *     [--provision-type REPRESENTATION] \
 *     [--out <path> | --out-dir <dir> | --stdout] \
 *     [--env-file <path>]
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 * (or NEXT_PUBLIC_SUPABASE_ANON_KEY) -- same convention as
 * scripts/audit/all-deals-card-backed.js. NEVER point this at production
 * without deliberately choosing to (this script has no environment guard of
 * its own beyond the required allowlist -- the allowlist IS the guard: no
 * deal is ever read that was not explicitly named).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { V1_PROVISION_SNAPSHOT_SCHEMA } = require('../lib/canonical-v2/native-producer/v1v2-comparator');

const DEFAULT_PROVISION_TYPE = 'REPRESENTATION';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_FIELDS = Object.freeze([
  'id', 'deal_id', 'provision_type', 'provision_subtype', 'section_ref',
  'primary_quote', 'region_hash', 'extraction_version',
]);

function fail(message) {
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Args. Deliberately zero I/O -- callable, and tested, without a DB.
// ---------------------------------------------------------------------------
function parseArgs(argv = process.argv.slice(2)) {
  const deals = [];
  const governedDealKeys = new Map();
  const args = { provisionType: DEFAULT_PROVISION_TYPE, out: null, outDir: null, stdout: false, envFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--deal') {
      const value = argv[++index];
      if (!value || !UUID_RE.test(value)) fail(`--deal must be a UUID, got: ${value}`);
      deals.push(value.toLowerCase());
    } else if (arg === '--governed-deal-key') {
      const value = argv[++index];
      const eq = value ? value.indexOf('=') : -1;
      if (eq <= 0) fail(`--governed-deal-key must be <uuid>=<key>, got: ${value}`);
      const dealId = value.slice(0, eq);
      const key = value.slice(eq + 1);
      if (!UUID_RE.test(dealId)) fail(`--governed-deal-key's uuid segment is not a UUID: ${dealId}`);
      if (!key) fail('--governed-deal-key\'s key segment must be non-empty');
      governedDealKeys.set(dealId.toLowerCase(), key);
    } else if (arg === '--provision-type') {
      args.provisionType = argv[++index];
    } else if (arg === '--out') {
      args.out = argv[++index];
    } else if (arg === '--out-dir') {
      args.outDir = argv[++index];
    } else if (arg === '--stdout') {
      args.stdout = true;
    } else if (arg === '--env-file') {
      args.envFile = argv[++index];
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  // THE REFUSAL: no allowlist, no run. Checked before any other validation
  // reads env vars or opens a connection.
  if (deals.length === 0) {
    fail('Refusing to run: at least one --deal <uuid> allowlist entry is required.');
  }
  if (!args.provisionType) fail('--provision-type must be non-empty.');
  if (args.out && deals.length > 1) fail('--out writes a single snapshot; pass --out-dir for more than one --deal.');
  return { ...args, deals, governedDealKeys };
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  const fullPath = resolve(filePath);
  for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

// ---------------------------------------------------------------------------
// SQL builder -- pure, exported, unit-testable without a DB connection. The
// canonical, read-only-provable representation of what this script reads;
// see the file header for why the ACTUAL fetch below uses the supabase-js
// query builder (equivalent WHERE clause, safe parameterisation, no raw-SQL
// execution surface available to this script) rather than executing this
// text directly.
// ---------------------------------------------------------------------------
function buildSnapshotSql({ dealIds, provisionType }) {
  if (!Array.isArray(dealIds) || dealIds.length === 0) fail('buildSnapshotSql requires at least one dealId');
  if (!provisionType) fail('buildSnapshotSql requires a provisionType');
  const text = [
    'SELECT id, deal_id, provision_type, provision_subtype, section_ref,',
    '       primary_quote, region_hash, extraction_version',
    'FROM public.provision_cards',
    'WHERE deal_id = ANY($1::uuid[])',
    '  AND provision_type = $2',
    'ORDER BY deal_id, section_ref;',
  ].join('\n');
  return { text, values: [dealIds, provisionType] };
}

const WRITE_VERB_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)\b/i;

function assertReadOnlySql(sql) {
  if (WRITE_VERB_RE.test(sql)) fail(`buildSnapshotSql produced a non-read-only statement: ${sql}`);
  if (!/^SELECT/i.test(sql.trim())) fail('buildSnapshotSql must produce a SELECT statement');
  return sql;
}

// ---------------------------------------------------------------------------
// DB access (style matches scripts/audit/all-deals-card-backed.js: env-var
// driven supabase-js client, paginated selectAll, no writes anywhere).
// ---------------------------------------------------------------------------
async function selectAll(sb, table, columns, query = (q) => q) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(sb.from(table).select(columns).range(from, from + pageSize - 1));
    if (error) fail(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchDeals(sb, dealIds) {
  const rows = await selectAll(sb, 'deals', 'id,acquirer,target', (q) => q.in('id', dealIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const dealId of dealIds) {
    if (!byId.has(dealId)) fail(`--deal ${dealId} does not exist in the deals table.`);
  }
  return byId;
}

async function fetchCards(sb, { dealIds, provisionType }) {
  assertReadOnlySql(buildSnapshotSql({ dealIds, provisionType }).text);
  const rows = await selectAll(
    sb, 'provision_cards', CARD_FIELDS.join(','),
    (q) => q.in('deal_id', dealIds).eq('provision_type', provisionType).order('section_ref'),
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Snapshot assembly -- pure given fetched rows, exported for testability.
// ---------------------------------------------------------------------------
function maxExtractionVersion(cards) {
  // extraction_version is an opaque string label (e.g.
  // "m2-00-corpus-backfill-v1"), not a numeric or semver value -- see
  // v1v2-comparator.js's own staleness-rule comment. "Maximum" here is a
  // deterministic, content-derived pick (lexicographically last), matching
  // the spec's "the deal's maximum v1 extraction_version" language while
  // staying honest that this is a stable tie-break, not a real ordering.
  const versions = [...new Set(cards.map((card) => card.extraction_version))].sort();
  return versions.length > 0 ? versions[versions.length - 1] : null;
}

function buildSnapshotForDeal({ dealId, deal, cards, governedDealKey }) {
  if (cards.length === 0) fail(`No provision_cards found for deal ${dealId}.`);
  const dealMaxExtractionVersion = maxExtractionVersion(cards);
  const body = {
    schema_version: V1_PROVISION_SNAPSHOT_SCHEMA,
    deal_identity_bridge: Object.freeze({
      production_deal_id: dealId,
      // Recorded at export time (spec: "recorded in the snapshot at export
      // time"). Falls back to a deterministic placeholder key when the
      // caller does not supply --governed-deal-key for this deal -- a
      // JUDGMENT CALL: production's `deals` table has no stored governed_
      // deal_key of its own (that identity is minted per extraction RUN,
      // not per deal -- see native-extraction-run.js callers), so this
      // script cannot discover the real one on its own. A caller wiring
      // this snapshot into a real resolveCandidates() run MUST pass
      // --governed-deal-key matching that run's own admitted_source_
      // context.governed_deal_key, or the comparator's Tier 1 output will
      // still be internally consistent but the bridge will not resolve to
      // any real run.
      governed_deal_key: governedDealKey || `deal:v1-snapshot-placeholder:${dealId}`,
    }),
    deal_max_extraction_version: dealMaxExtractionVersion,
    cards: cards
      .map((card) => Object.freeze({
        id: card.id,
        provision_type: card.provision_type,
        provision_subtype: card.provision_subtype,
        section_ref: card.section_ref,
        primary_quote: card.primary_quote,
        region_hash: card.region_hash,
        extraction_version: card.extraction_version,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    deal: Object.freeze({ acquirer: deal.acquirer, target: deal.target }),
  };
  const snapshotId = contentId(V1_PROVISION_SNAPSHOT_SCHEMA, body);
  return Object.freeze({ ...body, snapshot_id: snapshotId });
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------
async function run(args) {
  if (args.envFile) loadEnvFile(args.envFile);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) fail('Supabase env vars missing. Expected SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service or anon key.');

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key);

  const deals = await fetchDeals(sb, args.deals);
  const cards = await fetchCards(sb, { dealIds: args.deals, provisionType: args.provisionType });
  const cardsByDeal = new Map(args.deals.map((dealId) => [dealId, []]));
  for (const card of cards) {
    if (cardsByDeal.has(card.deal_id)) cardsByDeal.get(card.deal_id).push(card);
  }

  const snapshots = args.deals.map((dealId) => buildSnapshotForDeal({
    dealId,
    deal: deals.get(dealId),
    cards: cardsByDeal.get(dealId) || [],
    governedDealKey: args.governedDealKeys.get(dealId) || null,
  }));

  if (args.outDir) {
    mkdirSync(resolve(args.outDir), { recursive: true });
    for (const snapshot of snapshots) {
      const outPath = join(resolve(args.outDir), `${snapshot.deal_identity_bridge.production_deal_id}.json`);
      writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
      process.stderr.write(`[export-v1-provision-snapshot] wrote ${outPath} (${snapshot.cards.length} cards)\n`);
    }
  } else if (args.out) {
    mkdirSync(dirname(resolve(args.out)), { recursive: true });
    writeFileSync(resolve(args.out), `${JSON.stringify(snapshots[0], null, 2)}\n`);
    process.stderr.write(`[export-v1-provision-snapshot] wrote ${args.out} (${snapshots[0].cards.length} cards)\n`);
  } else {
    process.stdout.write(`${JSON.stringify(snapshots.length === 1 ? snapshots[0] : snapshots, null, 2)}\n`);
  }
  return snapshots;
}

async function main() {
  try {
    await run(parseArgs());
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  parseArgs,
  buildSnapshotSql,
  assertReadOnlySql,
  maxExtractionVersion,
  buildSnapshotForDeal,
  run,
};
