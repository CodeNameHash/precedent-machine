#!/usr/bin/env node
/*
 * canonicalize-duplicate-codes.js — deterministic, in-place retype of the
 * TWO true-duplicate provision-subtype codes identified by the r16
 * deal-compare gap audit (docs/PLAN.md P3):
 *
 *   REP-T-CONTRACTS      -> REP-T-MATERIAL-CONTRACTS
 *   COV-PAYAGENT         -> CONSID-EXCHANGE
 *
 * These aren't a fold-in or a related concept — they're the SAME clause
 * classified under two different codes depending on the deal, which makes
 * every such deal render a false one-sided row in compare mode. The
 * display-layer ROW_FAMILY map (components/review-v2/compareRowUnion.js)
 * already unions the two codes' rows into one compare row, so this script
 * is NOT urgent — it just lets the underlying data converge on the single
 * canonical code so downstream tooling (queries, taxonomy reports, a future
 * regen) doesn't have to keep special-casing the split.
 *
 * Scope discipline: this retypes ONLY the subtype field —
 * provision_cards.provision_subtype and provisions.type — nothing else on
 * the row (no quotes, no features, no section_ref). Two tables, both
 * paginated reads, both dry-run by default.
 *
 * Usage (Ben's machine, .env.local present):
 *   node scripts/canonicalize-duplicate-codes.js            # dry run: prints per-deal counts
 *   node scripts/canonicalize-duplicate-codes.js --apply     # write the changes
 */
// Plain `node` never loads .env.local (only Next.js does) -- same tiny
// loader every other DB script in scripts/ carries (see
// scripts/restamp-ioc-restrictions.js / scripts/eval.js).
const fs = require('fs');
const path = require('path');
(() => {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
})();
const { getServiceSupabase } = require('../lib/supabase');

const APPLY = process.argv.includes('--apply');

// The TWO true duplicates only (docs/PLAN.md P3) — the other taxonomy-split
// pairs in that list (REP-T-CONSENT/REP-T-NOCONFLICT,
// REP-T-SANCTIONS/REP-T-ANTICORR, MISC-JURY/MISC-JURISD, COV-PROXY/
// COV-MEETING) are related-but-distinct concepts, not duplicates, and are
// deliberately NOT retyped here — they stay display-layer-only unions.
const RETYPE_MAP = new Map([
  ['REP-T-CONTRACTS', 'REP-T-MATERIAL-CONTRACTS'],
  ['COV-PAYAGENT', 'CONSID-EXCHANGE'],
]);
const OLD_CODES = [...RETYPE_MAP.keys()];

// Supabase caps every query at 1000 rows by default -- page through with
// .range() until a short page (same pattern as restamp-ioc-restrictions.js).
async function fetchAllRows(query) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

function printPlan(label, rows, codeField) {
  console.log(`\n${label}: ${rows.length} rows to retype`);
  const byDeal = new Map();
  for (const row of rows) {
    const key = row.deal_id || '(no deal_id)';
    if (!byDeal.has(key)) byDeal.set(key, new Map());
    const counts = byDeal.get(key);
    const code = row[codeField];
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  for (const [dealId, counts] of byDeal.entries()) {
    const parts = [...counts.entries()]
      .map(([code, n]) => `${code} -> ${RETYPE_MAP.get(code)} (${n})`)
      .join(', ');
    console.log(`  ${dealId}: ${parts}`);
  }
}

async function retypeTable(sb, table, codeField, selectCols) {
  const rows = await fetchAllRows(sb
    .from(table)
    .select(selectCols)
    .in(codeField, OLD_CODES)
    .order('id'));
  printPlan(table, rows, codeField);
  if (!APPLY) return rows.length;
  let written = 0;
  for (const row of rows) {
    const next = RETYPE_MAP.get(row[codeField]);
    if (!next) continue;
    const { error } = await sb.from(table).update({ [codeField]: next }).eq('id', row.id);
    if (error) { console.error(`WRITE FAIL ${table} ${row.id}: ${error.message}`); process.exit(1); }
    written += 1;
  }
  return written;
}

async function main() {
  const sb = getServiceSupabase();
  if (!sb) { console.error('Supabase not configured (need .env.local)'); process.exit(1); }

  console.log(APPLY ? 'APPLYING retype' : 'DRY RUN (pass --apply to write)');

  const cardsCount = await retypeTable(sb, 'provision_cards', 'provision_subtype', 'id, deal_id, provision_subtype');
  const provisionsCount = await retypeTable(sb, 'provisions', 'type', 'id, deal_id, type');

  if (APPLY) {
    console.log(`\nwrote ${cardsCount} provision_cards rows, ${provisionsCount} provisions rows.`);
    console.log('Spot-check a deal that previously carried REP-T-CONTRACTS or COV-PAYAGENT on the review page.');
  } else {
    console.log('\n(dry run — no writes made)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
