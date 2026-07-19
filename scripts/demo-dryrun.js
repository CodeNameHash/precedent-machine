#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/demo-dryrun.js — WP-7 (M5-06) demo dry-run as a CI/local gate.
   ───────────────────────────────────────────────────────────────────────────
   Runs the full pre-demo smoke test against the live Supabase project: ingest
   a pinned fixture agreement as a STAGING deal, QA it, verify the review
   surface (cards + source-overlay span resolution), verify the query surface
   (20/20 demo-set answers, staging deal invisible everywhere), persist a
   run_reports row, and ALWAYS tear the staging deal back out — success or
   failure. Exits non-zero on the first hard failure (after teardown runs).

   This is the exact pre-demo smoke test Ben runs by hand:

     node scripts/demo-dryrun.js

   with `.env.local` holding SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (and
   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY as fallbacks, same
   as every other script in this repo). Uses --backend codex by default for
   the ingest step (Codex CLI, gated by QA + quote verification either way) to
   conserve Claude plan usage; pass --backend claude to use the subscription
   Claude CLI instead.

   Usage:
     node scripts/demo-dryrun.js
     node scripts/demo-dryrun.js --backend claude
     node scripts/demo-dryrun.js --fixture __fixtures__/demo-deal/landos-abbvie-agreement.broken.txt
       # deliberately-broken fixture — exercises the negative path: ingest
       # succeeds, ingest-qa fails red, teardown still runs. Never use this
       # for the real pre-demo smoke test.
     node scripts/demo-dryrun.js --json reports/demo-dryrun-<ts>.json
     node scripts/demo-dryrun.js --no-report-db   # skip the run_reports write

   Concurrency: DB access is strictly serial (one query in flight at a time,
   like every other script here) — this script itself does not parallelize,
   and CI runs it under a `demo-dryrun` concurrency group so two runs can
   never race the same staging deal. Never runs DDL. Never touches a row
   whose deal_id isn't the staging deal id THIS run created.

   KNOWN PIPELINE GAP (2026-07-19 live-gate finding, tracked separately —
   not fixed in this WP): production ingest does NOT mint provision_cards.
   The only card writers are scripts/curation/mint-cards.js,
   scripts/backfill/extract-to-cards.js, and
   scripts/reprocess/rematerialize-claims.js — every existing corpus deal
   got its cards via a one-off backfill, not via scripts/ingest-local.js /
   pages/api/ingest/from-url.js. A freshly-ingested deal renders EMPTY on
   /review until one of those runs. This script's MATERIALIZE step papers
   over that for the dry-run's own staging deal only (mint-cards --deal
   <dealId> --apply); it does not touch, and is not a fix for, the real
   ingest pipeline.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { resolveCardSourceSpan } = require('../lib/parser-v2/resolve-source-span');
const { fetchReviewDealCards } = require('../lib/queries/review-deal');
const { persistReport, resolveReportDbFlag } = require('../lib/reports/persist-report');

const DEFAULT_FIXTURE = path.join(__dirname, '..', '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt');
const INGEST_LOCAL = path.join(__dirname, 'ingest-local.js');
const INGEST_QA = path.join(__dirname, 'ingest-qa.js');
const MINT_CARDS = path.join(__dirname, 'curation', 'mint-cards.js');
const QUERY_DEMO_CHECK = path.join(__dirname, 'query-demo-check.js');

// The unique substring ingest-local.js --staging stamps into the deal's
// `target` field (DRYRUN-<timestamp>) — see DEFECT 1 below for why this
// matters: ingest-qa.js's --deal flag matches by NAME SUBSTRING, not id.
const QA_STAGING_NAME_PREFIX = 'DRYRUN';

// ── deal_id-keyed tables (teardown target list) ────────────────────────────
// Every table in supabase/*.sql carrying a direct `deal_id` column, cascade
// or not (grep: `grep -rn "deal_id uuid" supabase/*.sql`). Tables that
// ON DELETE CASCADE from `deals` would be cleaned up by a bare `DELETE FROM
// deals` alone, but we delete each one explicitly (in dependency order) so
// every step can be counted and verified independently — belt-and-suspenders
// over trusting a migration's cascade to be present/correct in every env.
//
// `provisions` and `ingest_jobs` have NO cascade from `deals` (plain
// `REFERENCES deals(id)`, no ON DELETE clause = RESTRICT) — they MUST be
// deleted before the `deals` row itself or that delete fails outright.
const DIRECT_DEAL_ID_TABLES = [
  'provisions', // no cascade — must precede the deals delete
  'ingest_jobs', // no cascade — must precede the deals delete
  'provision_cards',
  'claims',
  'parser_regions',
  'corrections',
  'deal_quality_metrics',
  'transaction_steps',
  'deal_topology',
  'coding_tasks',
  'outside_date_specs',
  'absence_of_certain_changes',
  'stockholder_approval',
  'adjournment_rights',
  'closing_conditions',
];

// election_mechanisms / election_options / proration_rules / consideration_
// treatments don't carry deal_id directly — they hang off
// consideration_equity_provisions(deal_id) via provision_id chains. Handled
// separately in teardownStagingDeal() below.

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = {
    backend: 'codex',
    fixture: DEFAULT_FIXTURE,
    json: null,
    reportDb: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--fixture') args.fixture = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--report-db') args.reportDb = true;
    else if (a === '--no-report-db') args.reportDb = false;
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  return args;
}

// ── step timing / result plumbing ───────────────────────────────────────────

function newStep(name) {
  return { name, status: 'pending', ms: null, detail: {} };
}

async function timed(step, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    step.status = 'pass';
    step.detail = detail || {};
  } catch (err) {
    step.status = 'fail';
    step.detail = { error: err.message || String(err) };
    step.ms = Date.now() - t0;
    throw Object.assign(err, { step });
  }
  step.ms = Date.now() - t0;
  return step.detail;
}

// ── step 1: ingest ──────────────────────────────────────────────────────────
// Shells out to scripts/ingest-local.js (rather than requiring it in-process)
// so this script exercises the exact CLI surface Ben runs, and parses the
// deal id out of its "(deal <uuid>)" stdout line.
const DEAL_ID_RE = /\(deal ([0-9a-fA-F-]{36})\)/;

function runIngestLocal({ fixture, backend }) {
  const cmd = process.execPath;
  const cmdArgs = [INGEST_LOCAL, '--file', fixture, '--staging', '--backend', backend];
  let stdout;
  try {
    stdout = execFileSync(cmd, cmdArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    // ingest-local.js exits 1 on a caught FAILED — its stdout still carries
    // the FAILED line, which is what we want to surface.
    const out = (err.stdout || '') + (err.stderr || '');
    throw new Error(`ingest-local.js failed: ${out.trim().slice(-2000) || err.message}`);
  }
  process.stdout.write(stdout);
  const match = stdout.match(DEAL_ID_RE);
  if (!match) throw new Error(`Could not find a deal id in ingest-local.js output:\n${stdout.slice(-2000)}`);
  return { dealId: match[1], stdout };
}

// ── step 2: QA gate ──────────────────────────────────────────────────────────
// DEFECT 1 (2026-07-19 live-gate finding, run 1): ingest-qa.js's --deal flag
// matches by NAME SUBSTRING against `${acquirer} ${target}` (ingest-qa.js
// main(), ~line 404), not by id. Passing the deal UUID matched ZERO deals —
// ingest-qa.js prints "No deal matches" and exits 0 — so this step reported
// a vacuous PASS having checked nothing. Fixed by: (1) matching on
// QA_STAGING_NAME_PREFIX ("DRYRUN", the unique substring --staging stamps
// into the deal's target name) instead of the id, and (2) reading the
// --json structured result (scripts/ingest-qa.js's WP-6 JSON emitter) and
// HARD-ASSERTING exactly one deal was checked and it's the one we created —
// zero (or more than one) deals checked is now itself a step failure,
// independent of whatever exit code ingest-qa.js returns.
function runIngestQa({ dealId }) {
  const jsonPath = path.join(os.tmpdir(), `demo-dryrun-qa-${dealId}.json`);
  const cmd = process.execPath;
  const cmdArgs = [INGEST_QA, '--deal', QA_STAGING_NAME_PREFIX, '--json', jsonPath, '--no-report-db'];
  let stdout = '';
  try {
    stdout = execFileSync(cmd, cmdArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    // ingest-qa.js exits 1 on a gate FAIL — that's the expected outcome for
    // the deliberately-broken-fixture negative test. Still read the --json
    // file below (it's written unconditionally before exit) rather than
    // treating a nonzero exit alone as the failure signal.
    stdout = (err.stdout || '') + (err.stderr || '');
  }
  process.stdout.write(stdout);

  let structured;
  try {
    structured = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err) {
    throw new Error(`ingest-qa.js did not produce a readable --json report at ${jsonPath}: ${err.message}\nstdout tail:\n${stdout.trim().split('\n').slice(-15).join('\n')}`);
  } finally {
    try { fs.unlinkSync(jsonPath); } catch { /* best effort cleanup, not load-bearing */ }
  }

  if (!Array.isArray(structured.deals) || structured.deals.length !== 1) {
    throw new Error(`ingest-qa checked ${structured.deals ? structured.deals.length : 0} deal(s) matching --deal "${QA_STAGING_NAME_PREFIX}" (expected exactly 1 — our staging deal) — zero (or ambiguous multiple) deals checked is a hard failure, not a pass`);
  }
  const dealResult = structured.deals[0];
  if (dealResult.dealId !== dealId) {
    throw new Error(`ingest-qa checked deal ${dealResult.dealId}, not our staging deal ${dealId} — --deal "${QA_STAGING_NAME_PREFIX}" resolved to the wrong row`);
  }
  if (dealResult.pass !== true) {
    throw new Error(`ingest-qa gate FAILED for deal ${dealId}:\n${JSON.stringify(dealResult.checks || [], null, 2).slice(0, 2000)}`);
  }

  return { pass: true, dealId: dealResult.dealId, counts: dealResult.counts, coveragePct: dealResult.coveragePct };
}

// ── step 2.5: materialize (mint-cards) ──────────────────────────────────────
// DEFECT 2 (2026-07-19 live-gate finding, run 1): the review-surface step
// got 0 cards because NO ingest path mints provision_cards — see the KNOWN
// PIPELINE GAP note in this file's header. Every existing corpus deal has
// cards only because of a one-off backfill (mint-cards.js /
// extract-to-cards.js / rematerialize-claims.js); a fresh ingest never
// calls any of them. This step runs mint-cards.js scoped strictly to the
// staging dealId so the review-surface step has something to check — it is
// NOT a fix for the ingest pipeline itself (out of scope for this WP).
function runMintCards({ dealId }) {
  const backupPath = path.join(os.tmpdir(), `demo-dryrun-mint-backup-${dealId}.json`);
  const cmd = process.execPath;
  const cmdArgs = [MINT_CARDS, '--deal', dealId, '--apply', '--backup', backupPath, '--no-report-db'];
  let stdout;
  try {
    stdout = execFileSync(cmd, cmdArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    throw new Error(`mint-cards.js failed for deal ${dealId}: ${out.trim().slice(-2000) || err.message}`);
  } finally {
    try { fs.unlinkSync(backupPath); } catch { /* best effort — backup is a mandatory --apply gate, not something we need to keep */ }
  }
  process.stdout.write(stdout);

  const m = stdout.match(/Executed: minted (\d+) card\(s\), inserted (\d+) region\(s\), reused (\d+) region\(s\)\./);
  if (!m) throw new Error(`Could not parse a minted-card count out of mint-cards.js output for deal ${dealId}:\n${stdout.trim().slice(-2000)}`);
  const minted = Number(m[1]);
  if (minted === 0) throw new Error(`mint-cards.js minted 0 cards for staging deal ${dealId} — nothing for the review-surface step to check (expected >0 coded provisions on a fresh ingest)`);

  return { minted, regionsInserted: Number(m[2]), regionsReused: Number(m[3]) };
}

// ── step 3: review surface ──────────────────────────────────────────────────
async function checkReviewSurface(sb, dealId) {
  const reviewDeal = await fetchReviewDealCards(dealId, sb, { mode: 'user' });
  const cards = reviewDeal.cards || [];
  if (cards.length === 0) throw new Error('GET /api/review/<id>/cards equivalent returned 0 cards');

  const { data: deal, error } = await sb.from('deals').select('id, metadata').eq('id', dealId).single();
  if (error || !deal) throw new Error(`Could not read deal for source resolution: ${error && error.message}`);
  const fullText = deal.metadata && deal.metadata.full_text;
  if (!fullText) throw new Error('Deal has no metadata.full_text — /api/agreement-source would 404');

  // Find the first card whose span resolves (WP-5 contract) rather than
  // insisting on cards[0] — matches the spec's "one card's primary_quote
  // resolves", and a genuinely bad extraction (0 resolvable cards) still
  // fails this step below.
  let resolved = null;
  for (const card of cards) {
    if (!card.primary_quote) continue;
    const span = resolveCardSourceSpan(card, fullText);
    if (span.status !== 'unresolved') { resolved = { card, span }; break; }
  }
  if (!resolved) throw new Error(`No card's primary_quote resolved against agreement-source text (checked ${cards.length} cards)`);

  return {
    cardCount: cards.length,
    resolvedCardId: resolved.card.id,
    resolvedStatus: resolved.span.status,
    resolvedVerbatim: resolved.span.verbatim,
  };
}

// ── step 4: query surface ────────────────────────────────────────────────────
function runQueryDemoCheck() {
  const cmd = process.execPath;
  const cmdArgs = [QUERY_DEMO_CHECK];
  try {
    const stdout = execFileSync(cmd, cmdArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(stdout);
    const m = stdout.match(/(\d+)\/(\d+) passing/);
    const pass = Number(m && m[1]);
    const total = Number(m && m[2]);
    if (!m || pass !== total) throw new Error(`query-demo-check did not report full pass: "${(m || [])[0] || 'no summary line found'}"`);
    return { pass, total, stdout };
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    if (out) process.stdout.write(out);
    throw new Error(err.message.includes('query-demo-check') ? err.message : `query-demo-check.js failed: ${out.trim().slice(-2000) || err.message}`);
  }
}

// Hard assertion, independent of query-demo-check's own pass/fail: the
// staging deal must not appear in the exact "live deals" set every query/
// index surface derives (pages/api/home.js, pages/api/query/run.js,
// pages/api/query/demo-set.js, scripts/query-demo-check.js all apply this
// same `metadata->>ingest_status = 'staging'` exclusion — see each file's
// isStagingDeal()). We can't call the Next.js route handlers directly
// without a running server, so this re-derives that same live-deal set
// straight from the DB and asserts dealId is excluded from it, plus
// confirms the row itself still carries the flag every one of those filters
// keys on.
function isStagingDealRow(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

async function checkStagingInvisible(sb, dealId) {
  const { data: deal, error } = await sb.from('deals').select('id, metadata').eq('id', dealId).single();
  if (error || !deal) throw new Error(`Could not re-read staging deal for invisibility check: ${error && error.message}`);
  const status = deal.metadata && deal.metadata.ingest_status;
  if (status !== 'staging') throw new Error(`Staging deal ${dealId} does not carry ingest_status: 'staging' (got ${JSON.stringify(status)}) — every query/index staging filter keys on this field`);

  const { data: allDeals, error: allErr } = await sb.from('deals').select('id, metadata');
  if (allErr) throw new Error(`Could not list all deals for invisibility check: ${allErr.message}`);
  const liveIds = new Set((allDeals || []).filter((d) => !isStagingDealRow(d)).map((d) => d.id));
  if (liveIds.has(dealId)) throw new Error(`Staging deal ${dealId} appears in the "live deals" set every query/index surface builds — staging exclusion is broken`);

  return { dealId, ingestStatus: status, excludedFromLiveSet: true };
}

// ── step 6: teardown ─────────────────────────────────────────────────────────

async function countByDealId(sb, table, dealId) {
  try {
    const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('deal_id', dealId);
    if (error) {
      // DEFECT 3 (2026-07-19 live-gate finding, run 1): deal_quality_metrics
      // failed this count with an EMPTY error.message ("deal_quality_metrics
      // count failed: "), which flunked the teardown step even though every
      // table's residual rows were genuinely 0. Two fixes: (a) always
      // surface the FULL stringified error, not just .message, so a blank-
      // message error is actually diagnosable next time; (b) treat both a
      // missing TABLE and a missing COLUMN as a clean skip, not a failure —
      // some supabase/*.sql migrations (e.g. deal-quality-metrics-schema.sql)
      // may never have been applied in a given env, so either the table or
      // its deal_id column can legitimately not exist.
      if (isCleanSkipError(error)) return null;
      throw new Error(`${table} count failed: ${JSON.stringify(error)}`);
    }
    return count || 0;
  } catch (err) {
    if (isCleanSkipError(err)) return null;
    throw err;
  }
}

function isMissingTableError(error) {
  if (!error) return false;
  const message = error.message || String(error);
  return error.code === '42P01' || /does not exist|Could not find the table|schema cache/i.test(message);
}

// Postgres 42703 (undefined_column) / PostgREST's "Could not find the '<col>'
// column" message — a table that exists but lacks a deal_id column (a
// migration applied out of order, or never applied at all) is just as much
// a clean skip for teardown-verification purposes as a wholly missing table.
function isMissingColumnError(error) {
  if (!error) return false;
  const message = error.message || String(error);
  return error.code === '42703' || (/column/i.test(message) && /does not exist/i.test(message)) || /Could not find the '.+' column/i.test(message);
}

function isCleanSkipError(error) {
  return isMissingTableError(error) || isMissingColumnError(error);
}

async function safeDelete(sb, table, column, value) {
  try {
    const { error } = await sb.from(table).delete().eq(column, value);
    if (error && !isCleanSkipError(error)) throw new Error(`${table} delete failed: ${JSON.stringify(error)}`);
  } catch (err) {
    if (!isCleanSkipError(err)) throw err;
  }
}

async function safeDeleteIn(sb, table, column, values) {
  if (!values || values.length === 0) return;
  try {
    const { error } = await sb.from(table).delete().in(column, values);
    if (error && !isCleanSkipError(error)) throw new Error(`${table} delete failed: ${JSON.stringify(error)}`);
  } catch (err) {
    if (!isCleanSkipError(err)) throw err;
  }
}

async function safeSelect(sb, table, column, filterCol, filterVal) {
  try {
    const { data, error } = await sb.from(table).select(column).eq(filterCol, filterVal);
    if (error) {
      if (isCleanSkipError(error)) return [];
      throw new Error(`${table} select failed: ${JSON.stringify(error)}`);
    }
    return data || [];
  } catch (err) {
    if (isCleanSkipError(err)) return [];
    throw err;
  }
}

// Deletes every row keyed (directly or transitively) on `dealId`, then the
// `deals` row itself, then verifies every one of those tables is back to 0
// rows for this deal_id. NEVER touches any other deal_id — every delete/
// select below is scoped with .eq()/.in() against ids derived from THIS
// dealId only. Idempotent: safe to call twice (second call finds nothing to
// delete and verifies clean).
async function teardownStagingDeal(sb, dealId) {
  if (!dealId) throw new Error('teardownStagingDeal requires a dealId');

  // election_mechanisms / election_options / proration_rules / consideration_
  // treatments hang off consideration_equity_provisions(deal_id) via
  // provision_id chains, not a direct deal_id column — walk the chain.
  const considerationRows = await safeSelect(sb, 'consideration_equity_provisions', 'id', 'deal_id', dealId);
  const considerationIds = considerationRows.map((r) => r.id);
  let prorationIds = [];
  if (considerationIds.length > 0) {
    const mechRows = [];
    for (const id of considerationIds) {
      const rows = await safeSelect(sb, 'election_mechanisms', 'id, proration_rule_id', 'provision_id', id);
      mechRows.push(...rows);
    }
    const mechIds = mechRows.map((r) => r.id);
    prorationIds = mechRows.map((r) => r.proration_rule_id).filter(Boolean);
    await safeDeleteIn(sb, 'election_options', 'election_mechanism_id', mechIds);
    await safeDeleteIn(sb, 'election_mechanisms', 'id', mechIds);
    await safeDeleteIn(sb, 'proration_rules', 'id', prorationIds);
    await safeDeleteIn(sb, 'consideration_treatments', 'provision_id', considerationIds);
    await safeDelete(sb, 'consideration_equity_provisions', 'deal_id', dealId);
  }

  // provisions and ingest_jobs have no ON DELETE CASCADE from deals — they
  // MUST be gone before the deals delete below or it fails outright.
  for (const table of DIRECT_DEAL_ID_TABLES) {
    await safeDelete(sb, table, 'deal_id', dealId);
  }

  // deal_candidates keys off ingested_deal_id, not deal_id.
  await safeDelete(sb, 'deal_candidates', 'ingested_deal_id', dealId);

  await safeDelete(sb, 'deals', 'id', dealId);

  // Verify: every table above (plus deals + consideration chain) reports 0
  // rows for this deal_id. `null` (table absent in this env) counts as
  // clean.
  const verifyTables = [...DIRECT_DEAL_ID_TABLES, 'consideration_equity_provisions'];
  const residual = {};
  for (const table of verifyTables) {
    const count = await countByDealId(sb, table, dealId);
    if (count) residual[table] = count;
  }
  const { data: dealStillThere } = await sb.from('deals').select('id').eq('id', dealId).maybeSingle();
  if (dealStillThere) residual.deals = 1;

  return { dealId, residualRowCounts: residual, clean: Object.keys(residual).length === 0 };
}

// ── orchestration ────────────────────────────────────────────────────────────

async function runDemoDryrun(sb, args) {
  const startedAt = new Date().toISOString();
  const steps = [];
  let dealId = null;
  let hardError = null;

  try {
    const ingestStep = newStep('ingest');
    steps.push(ingestStep);
    const ingestDetail = await timed(ingestStep, async () => {
      const { dealId: id } = runIngestLocal({ fixture: args.fixture, backend: args.backend });
      dealId = id;
      return { dealId: id, fixture: args.fixture, backend: args.backend };
    });
    dealId = ingestDetail.dealId;

    const qaStep = newStep('qa');
    steps.push(qaStep);
    await timed(qaStep, () => runIngestQa({ dealId }));

    const materializeStep = newStep('materialize');
    steps.push(materializeStep);
    await timed(materializeStep, () => runMintCards({ dealId }));

    const reviewStep = newStep('review-surface');
    steps.push(reviewStep);
    await timed(reviewStep, () => checkReviewSurface(sb, dealId));

    const queryStep = newStep('query-surface');
    steps.push(queryStep);
    await timed(queryStep, async () => {
      const demoCheck = runQueryDemoCheck();
      const invisibility = await checkStagingInvisible(sb, dealId);
      return { ...demoCheck, stagingInvisible: invisibility };
    });

    const reportsStep = newStep('reports');
    steps.push(reportsStep);
    await timed(reportsStep, async () => {
      if (!resolveReportDbFlag(args)) return { skipped: true, reason: 'report-db disabled' };
      const summary = { dealId, pass: true, stepCount: steps.length };
      const payload = { generatedAt: startedAt, dealId, fixture: args.fixture, backend: args.backend, steps };
      const result = await persistReport(sb, { kind: 'demo-dryrun', generatedAt: startedAt, summary, payload });
      return result;
    });
  } catch (err) {
    hardError = err;
  }

  // ── teardown: ALWAYS runs, success or failure ────────────────────────────
  const teardownStep = newStep('teardown');
  steps.push(teardownStep);
  let teardownError = null;
  try {
    await timed(teardownStep, () => (dealId ? teardownStagingDeal(sb, dealId) : { skipped: true, reason: 'no deal was created' }));
  } catch (err) {
    teardownError = err;
  }

  const pass = !hardError && !teardownError && teardownStep.detail.clean !== false;
  const result = {
    generatedAt: startedAt,
    finishedAt: new Date().toISOString(),
    dealId,
    fixture: args.fixture,
    backend: args.backend,
    pass,
    steps,
    error: hardError ? (hardError.message || String(hardError)) : null,
    teardownError: teardownError ? (teardownError.message || String(teardownError)) : null,
  };

  // If the QA/reports gate reported "fail soft" for a missing run_reports
  // table, that's not a hard failure of the dry-run itself — record it in
  // the step result (already done above via persistReport's { written:
  // false } return) rather than flipping `pass`.

  return result;
}

function printSummary(result) {
  console.log('\n═══ demo-dryrun summary ═══');
  for (const step of result.steps) {
    const status = step.status === 'pass' ? 'PASS' : step.status === 'fail' ? 'FAIL' : '----';
    console.log(`  ${status}  ${step.name.padEnd(16)} ${step.ms != null ? `${step.ms}ms` : ''}`);
    if (step.status === 'fail') console.log(`        ${step.detail.error}`);
  }
  if (result.teardownError) console.log(`  teardown error: ${result.teardownError}`);
  const teardownDetail = result.steps.find((s) => s.name === 'teardown').detail;
  if (teardownDetail && teardownDetail.residualRowCounts && Object.keys(teardownDetail.residualRowCounts).length) {
    console.log(`  RESIDUAL ROWS: ${JSON.stringify(teardownDetail.residualRowCounts)}`);
  } else if (dealCreated(result)) {
    console.log('  residual rows: 0 across every deal_id-keyed table');
  }
  console.log(`\nOverall: ${result.pass ? 'PASS' : 'FAIL'}${result.dealId ? ` (staging deal ${result.dealId}, torn down)` : ''}`);
}

function dealCreated(result) {
  return !!result.dealId;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(dbUrl, key);

  if (!fs.existsSync(args.fixture)) { console.error(`Fixture not found: ${args.fixture}`); process.exit(1); }

  const result = await runDemoDryrun(sb, args);
  printSummary(result);

  if (args.json) {
    fs.mkdirSync(path.dirname(args.json), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(result, null, 2));
  }

  if (!result.pass) process.exitCode = 1;
}

module.exports = {
  DIRECT_DEAL_ID_TABLES,
  parseArgs,
  newStep,
  timed,
  runIngestLocal,
  runIngestQa,
  runMintCards,
  countByDealId,
  checkReviewSurface,
  runQueryDemoCheck,
  checkStagingInvisible,
  teardownStagingDeal,
  runDemoDryrun,
  isMissingTableError,
  isMissingColumnError,
  isCleanSkipError,
  QA_STAGING_NAME_PREFIX,
  findDotEnvLocal,
  loadDotEnvLocal,
};

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
