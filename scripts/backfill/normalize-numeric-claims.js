#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill/normalize-numeric-claims.js — deterministic numeric-
   normalization backfill for public.claims.canonical_numeric (WP-P3-numeric).

   Reads claims for a closed allowlist of attributes (see ATTRIBUTES below),
   parses `verbatim` (or, for the structured-object attributes, one named
   sub-field of it) via lib/normalize-numeric.js, and writes
   `canonical_numeric` ONLY where:
     - the parse succeeds with confidence (never guesses a unit or a value),
       AND
     - the existing canonical_numeric is null (fresh write) OR already
       identical to the parsed result (idempotent no-op — no write needed,
       still counted as parsed).
   A row whose EXISTING canonical_numeric differs from the freshly parsed
   value is NEVER overwritten — it is reported under skipped-existing with
   the conflicting values, for a human to reconcile.

   ATTRIBUTE MAPPING (verified against the live claims.attribute column —
   see the session report for the query and full reasoning). The spec's
   conceptual allowlist named four keys that do not exist in this corpus at
   all (terminationFeeAmount, parentTerminationFee, tailPeriodMonths,
   survivalPeriodMonths as a numeric key) and one that exists in the feature
   registry but currently has zero claims rows (expenseReimbursementCap).
   Per spec instruction ("adjust the list to the keys that really exist"),
   this script targets the REAL attributes carrying each concept:
     - companyTerminationFee, reverseTerminationFee: valueType "object"
       { amount, triggers[], payment_deadline, ... } — extracts .amount.
     - expenseReimbursement: valueType "object" { amount_cap, triggers[] } —
       extracts .amount_cap (this is the real home of the "expense
       reimbursement cap" concept; expenseReimbursementCap the flat number
       field is registered but has 0 claims rows today, so is out of scope
       until it's actually populated).
     - tailProvision: valueType "object" { period_months, ... } — the month
       count is already a JSON number, taken directly (no text parsing
       needed / no ambiguity to introduce).
     - initialMatchPeriodDays, subsequentMatchPeriodDays, matchingPeriod,
       noticePeriod, arcReaffirmDeadlineDays, superiorProposalThresholdPct,
       outsideDateMonthsPostSigning: verbatim is a bare digit string with NO
       unit words at all ("5", "24", "50") — the unit is fixed by the
       feature's own registry entry (lib/schema/features.js unit field), not
       inferred from the text. See extractBareNumberWithUnit().
     - discussionInitiationNoticeHours: registry unit is null ("hours" is
       not in the v1 closed unit vocabulary per spec) — converted to whole
       days only when evenly divisible by 24, else left null and counted.
     - repsSurvivalDuration: the real, populated attribute for the "reps
       survival period" concept (spec's placeholder name
       "survivalPeriodMonths" does not exist in claims.attribute). Unlike
       the bare-number fields above, this one is genuine free text ("Eighteen
       (18) months after the Closing Date for non-fundamental reps; ...
       statutes of limitations ... plus 60 days.") — run through the
       generic text parser as-is; multi-clause values with more than one
       distinct duration are correctly left null by the parser's own
       ambiguity rule.

   DRY-RUN IS THE DEFAULT: prints the full plan and per-attribute counters,
   writes nothing. --apply performs the writes, and only after the
   canonical_numeric column-existence guard passes (see ensureColumnGuard) —
   if the ALTER migration hasn't been applied, this script prints the
   migration SQL and stops; it never attempts to run DDL through PostgREST
   itself.

   Usage:
     node scripts/backfill/normalize-numeric-claims.js --deal <uuid>[,<uuid>...]
     node scripts/backfill/normalize-numeric-claims.js --all
     node scripts/backfill/normalize-numeric-claims.js --all --apply --json
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { parseNumeric, classifyNullReason, CLOSED_UNITS } = require('../../lib/normalize-numeric');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(REPO_ROOT, 'supabase', 'claims-canonical-numeric.sql');

/* ── attribute allowlist / extraction strategy ───────────────────────────── */

const ATTRIBUTES = {
  companyTerminationFee: { strategy: 'json-field-text', field: 'amount', unit: 'USD' },
  reverseTerminationFee: { strategy: 'json-field-text', field: 'amount', unit: 'USD' },
  expenseReimbursement: { strategy: 'json-field-text', field: 'amount_cap', unit: 'USD' },
  tailProvision: { strategy: 'json-field-number', field: 'period_months', unit: 'months' },
  initialMatchPeriodDays: { strategy: 'bare-number', unit: 'days' },
  subsequentMatchPeriodDays: { strategy: 'bare-number', unit: 'days' },
  matchingPeriod: { strategy: 'bare-number', unit: 'days' },
  noticePeriod: { strategy: 'bare-number', unit: 'days' },
  arcReaffirmDeadlineDays: { strategy: 'bare-number', unit: 'days' },
  discussionInitiationNoticeHours: { strategy: 'hours-to-days' },
  superiorProposalThresholdPct: { strategy: 'bare-number', unit: 'percent' },
  outsideDateMonthsPostSigning: { strategy: 'bare-number', unit: 'months' },
  repsSurvivalDuration: { strategy: 'text' },
};

const ALLOWLISTED_ATTRIBUTES = Object.keys(ATTRIBUTES);

/* ── pure extraction (no DB, no network) ─────────────────────────────────── */

function extractHoursToDays(verbatim) {
  if (typeof verbatim !== 'string') return { result: null, reason: 'null-ambiguous' };
  const trimmed = verbatim.trim();
  if (!/^-?\d+$/.test(trimmed)) return { result: null, reason: classifyNullReason(verbatim) };
  const hours = parseInt(trimmed, 10);
  if (hours % 24 !== 0) return { result: null, reason: 'null-unit' }; // "hours" is not in the v1 closed unit vocabulary
  return { result: { value: hours / 24, unit: 'days' }, reason: 'parsed' };
}

// Bare-number fields: verbatim is normally just a digit string with no unit
// words at all ("5", "24", "50"). The unit is fixed by the attribute's own
// registry entry, not guessed from text. We still try the generic parser
// first (in case a value ever DOES carry unit text) and only fall back to
// the fixed-unit reading for a clean bare integer/decimal; if the generic
// parser finds a DIFFERENT unit than expected, that's a shape surprise, not
// something to paper over — left null and counted.
function extractBareNumberWithUnit(verbatim, unit) {
  const direct = parseNumeric(verbatim);
  if (direct) {
    if (direct.unit !== unit) return { result: null, reason: 'null-ambiguous' };
    return { result: direct, reason: 'parsed' };
  }
  const trimmed = typeof verbatim === 'string' ? verbatim.trim() : '';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { result: { value: Number(trimmed), unit }, reason: 'parsed' };
  }
  return { result: null, reason: classifyNullReason(verbatim) };
}

function extractText(verbatim) {
  const r = parseNumeric(verbatim);
  if (!r) return { result: null, reason: classifyNullReason(verbatim) };
  if (!CLOSED_UNITS.has(r.unit)) return { result: null, reason: 'null-unit' };
  return { result: r, reason: 'parsed' };
}

function safeJsonParse(text) {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    return undefined;
  }
}

function extractJsonFieldText(verbatim, field, unit) {
  const parsed = safeJsonParse(verbatim);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { result: null, reason: 'null-ambiguous' };
  }
  const value = parsed[field];
  if (value === null || value === undefined || value === '') {
    return { result: null, reason: 'null-ambiguous' };
  }
  if (typeof value !== 'string') return { result: null, reason: 'null-ambiguous' };
  const r = parseNumeric(value);
  if (!r) return { result: null, reason: classifyNullReason(value) };
  if (r.unit !== unit) return { result: null, reason: 'null-ambiguous' };
  return { result: r, reason: 'parsed' };
}

function extractJsonFieldNumber(verbatim, field, unit) {
  const parsed = safeJsonParse(verbatim);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { result: null, reason: 'null-ambiguous' };
  }
  const value = parsed[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { result: null, reason: 'null-ambiguous' };
  }
  return { result: { value, unit }, reason: 'parsed' };
}

// Dispatches to the right extractor for one claims row's attribute. Pure —
// no DB, no network. Returns { result: {value,unit}|null, reason }.
function extractCandidate(attribute, verbatim) {
  const config = ATTRIBUTES[attribute];
  if (!config) return { result: null, reason: 'skip-unknown-attribute' };
  switch (config.strategy) {
    case 'hours-to-days':
      return extractHoursToDays(verbatim);
    case 'bare-number':
      return extractBareNumberWithUnit(verbatim, config.unit);
    case 'text':
      return extractText(verbatim);
    case 'json-field-text':
      return extractJsonFieldText(verbatim, config.field, config.unit);
    case 'json-field-number':
      return extractJsonFieldNumber(verbatim, config.field, config.unit);
    default:
      return { result: null, reason: 'null-ambiguous' };
  }
}

function sameCanonicalNumeric(a, b) {
  if (!a || !b) return false;
  return a.value === b.value && a.unit === b.unit;
}

// Plans a single claims row. Never touches the network.
// row: { id, attribute, verbatim, canonical_numeric }
function decideRow(row) {
  const { result, reason } = extractCandidate(row.attribute, row.verbatim);
  const base = { id: row.id, dealId: row.deal_id || null, attribute: row.attribute, verbatim: row.verbatim };

  if (!result) {
    return { ...base, status: reason === 'null-unit' ? 'null-unit' : 'null-ambiguous', parsed: null, write: null };
  }

  const existing = row.canonical_numeric || null;
  if (existing === null) {
    return { ...base, status: 'parsed', parsed: result, write: result };
  }
  if (sameCanonicalNumeric(existing, result)) {
    return { ...base, status: 'parsed', parsed: result, write: null, note: 'idempotent-already-set' };
  }
  return {
    ...base,
    status: 'skipped-existing',
    parsed: result,
    write: null,
    conflict: { existing, parsed: result },
  };
}

// Plans a whole batch of claims rows (already filtered to the allowlist).
// Pure — no DB, no network. Returns { entries, toWrite, conflicts, counters }.
function buildBackfillPlan(rows) {
  const entries = (rows || []).map(decideRow);
  const toWrite = entries.filter((e) => e.write);
  const conflicts = entries.filter((e) => e.status === 'skipped-existing');

  const counters = {}; // attribute -> { parsed, 'null-ambiguous', 'null-unit', 'skipped-existing' }
  for (const e of entries) {
    if (!counters[e.attribute]) {
      counters[e.attribute] = { parsed: 0, 'null-ambiguous': 0, 'null-unit': 0, 'skipped-existing': 0 };
    }
    counters[e.attribute][e.status] += 1;
  }

  return { entries, toWrite, conflicts, counters };
}

/* ── report formatting ───────────────────────────────────────────────────── */

function formatPlanReport(plan) {
  const lines = [];
  const attrs = Object.keys(plan.counters).sort();
  let totalParsed = 0;
  let totalNullAmbiguous = 0;
  let totalNullUnit = 0;
  let totalSkippedExisting = 0;
  for (const attr of attrs) {
    const c = plan.counters[attr];
    totalParsed += c.parsed;
    totalNullAmbiguous += c['null-ambiguous'];
    totalNullUnit += c['null-unit'];
    totalSkippedExisting += c['skipped-existing'];
    lines.push(
      `  ${attr.padEnd(32)} parsed: ${String(c.parsed).padStart(5)}  `
      + `null-ambiguous: ${String(c['null-ambiguous']).padStart(5)}  `
      + `null-unit: ${String(c['null-unit']).padStart(5)}  `
      + `skipped-existing: ${String(c['skipped-existing']).padStart(5)}`,
    );
  }
  lines.push('');
  lines.push(
    `  TOTAL parsed: ${totalParsed}  null-ambiguous: ${totalNullAmbiguous}  `
    + `null-unit: ${totalNullUnit}  skipped-existing: ${totalSkippedExisting}`,
  );
  lines.push(`  planned writes: ${plan.toWrite.length}`);
  if (plan.conflicts.length > 0) {
    lines.push(`  conflicts (existing canonical_numeric differs from fresh parse, NEVER overwritten): ${plan.conflicts.length}`);
    for (const c of plan.conflicts.slice(0, 20)) {
      lines.push(`    ! ${c.id} (${c.attribute}) existing=${JSON.stringify(c.conflict.existing)} parsed=${JSON.stringify(c.conflict.parsed)}`);
    }
  }
  return lines.join('\n');
}

/* ── CLI / DB plumbing ───────────────────────────────────────────────────── */

function loadDotEnvLocal() {
  const p = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function usage() {
  console.error(
    'Usage: node scripts/backfill/normalize-numeric-claims.js '
    + '(--deal <uuid>[,<uuid>...] | --all) [--apply] [--json]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { deals: [], all: false, apply: false, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--deal') {
      const raw = argv[++i] || '';
      args.deals.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--all') {
      args.all = true;
    } else if (a === '--apply') {
      args.apply = true;
    } else if (a === '--json') {
      args.json = true;
    } else {
      console.error(`Unknown arg: ${a}`);
      usage();
    }
  }
  if (!args.all && args.deals.length === 0) usage();
  return args;
}

// Guard: the migration is additive (ALTER TABLE ... ADD COLUMN IF NOT
// EXISTS), but this script has no generic SQL-exec path through PostgREST
// (this repo's Supabase setup has no such RPC — see HANDOFF.md), so it
// never attempts to run the ALTER itself. It probes for the column via a
// harmless select; if that fails, it prints the migration SQL and stops.
// Never a silent workaround.
async function ensureColumnGuard(sb) {
  const { error } = await sb.from('claims').select('canonical_numeric').limit(1);
  if (!error) return { ok: true };
  const sql = fs.existsSync(MIGRATION_PATH) ? fs.readFileSync(MIGRATION_PATH, 'utf-8') : null;
  console.error(
    '\nclaims.canonical_numeric does not exist yet and this script cannot run DDL through PostgREST.\n'
    + 'Apply the migration manually (Supabase SQL editor or psql), then re-run:\n',
  );
  if (sql) console.error(sql);
  else console.error(`(migration file not found at ${MIGRATION_PATH})`);
  return { ok: false, error };
}

async function fetchAllowlistedClaims(sb, dealIds) {
  const PAGE = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    let query = sb
      .from('claims')
      .select('id, deal_id, attribute, verbatim, canonical_numeric')
      .in('attribute', ALLOWLISTED_ATTRIBUTES)
      .range(from, from + PAGE - 1);
    if (dealIds && dealIds.length > 0) query = query.in('deal_id', dealIds);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read claims: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function applyWrites(sb, toWrite) {
  let applied = 0;
  let failed = 0;
  for (const entry of toWrite) {
    const { error } = await sb
      .from('claims')
      .update({ canonical_numeric: entry.write })
      .eq('id', entry.id)
      .is('canonical_numeric', null); // belt-and-braces: never clobber a value set since the read
    if (error) failed += 1;
    else applied += 1;
  }
  return { applied, failed };
}

function writeReportFile(report) {
  const dir = path.join(REPO_ROOT, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `normalize-numeric-claims-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key, { auth: { persistSession: false } });

  const guard = await ensureColumnGuard(sb);
  if (!guard.ok) {
    process.exitCode = 1;
    return;
  }

  const dealIds = args.all ? null : args.deals;
  console.log(`normalize-numeric-claims — ${args.all ? 'all deals' : `${dealIds.length} deal(s)`}, ${args.apply ? 'APPLY' : 'dry-run'}`);

  const rows = await fetchAllowlistedClaims(sb, dealIds);
  console.log(`Fetched ${rows.length} claim row(s) across ${ALLOWLISTED_ATTRIBUTES.length} allowlisted attribute(s).`);

  const plan = buildBackfillPlan(rows);
  console.log(`\n${formatPlanReport(plan)}`);

  const report = {
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    attributes: ALLOWLISTED_ATTRIBUTES,
    rowsConsidered: rows.length,
    counters: plan.counters,
    plannedWrites: plan.toWrite.length,
    conflicts: plan.conflicts.map((c) => ({ id: c.id, attribute: c.attribute, existing: c.conflict.existing, parsed: c.conflict.parsed })),
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));

  if (!args.apply) {
    console.log('\nDry-run complete: no writes. Re-run with --apply to commit.');
    writeReportFile(report);
    return;
  }

  const result = await applyWrites(sb, plan.toWrite);
  console.log(`\nExecuted: ${result.applied} written, ${result.failed} failed.`);
  report.executed = result;
  const reportFile = writeReportFile(report);
  console.log(`Report written: ${reportFile}`);
}

module.exports = {
  ATTRIBUTES,
  ALLOWLISTED_ATTRIBUTES,
  extractCandidate,
  decideRow,
  buildBackfillPlan,
  formatPlanReport,
  ensureColumnGuard,
  applyWrites,
  parseArgs,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
