#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/ingest-qa.js — post-ingest QA gate.
   ───────────────────────────────────────────────────────────────────────────
   Run after ingesting a deal (scripts/ingest-local.js /
   pages/api/ingest/from-url.js) to catch a bad extraction before it pollutes
   the precedent corpus: too few reps/defs/conditions extracted, quote
   hallucinations, unlocated coverage gaps, duplicate provisions, or a low
   canonical-code hit rate all point at a parser/classifier regression on
   that particular filing.

   Per deal, prints a compact scorecard of counts + coverage + trust-layer
   signals, evaluates them against fixed (overridable) gates, and exits 1 if
   ANY deal fails ANY gate — so it composes as a CI/manual check without
   crashing on data that simply doesn't clear the bar yet.

   Usage:
     node scripts/ingest-qa.js --deal Anadarko
     node scripts/ingest-qa.js --all
     node scripts/ingest-qa.js --all --min-coverage 80 --min-def 30

   Gates (defaults; the five --min-* flags override their threshold):
     REP-T count        >= 15   (--min-rep-t)
     REP-B count        >= 5    (--min-rep-b)
     DEF count          >= 40   (--min-def)
     COND count (M+B+S) >= 8    (--min-cond)
     coverage %          >= 85   (--min-coverage)
     unverified quotes  == 0
     duplicate clauses  == 0
     canonical rate     >= 0.70

   IOC, NOSOL, TERMR and TERMF are counted and printed for visibility but are
   not gated — the corpus doesn't yet have a settled expectation for them the
   way it does for reps/defs/conditions/coverage/trust.

   Read-only against `deals`/`provisions`. Creds from env / .env.local, same
   pattern as scripts/taxonomy-report.js.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { verifyDealQuotes, computeCoverage } = require('../lib/verification');
const { resolveBuyerDisplay, SHELL_NAME_REGEX } = require('../lib/query/types');
const { persistReport, resolveReportDbFlag } = require('../lib/reports/persist-report');

const PAGE_SIZE = 1000;

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

/* ── pure computation helpers (exported for tests — no DB) ─────────────── */

// Collapse a per-party type to its family base: COND-M → COND, TERMR-B →
// TERMR, IOC-T → IOC. A bare type (no hyphen) is its own base.
function familyBaseOf(type) {
  const t = String(type || '');
  const i = t.indexOf('-');
  return i > 0 ? t.slice(0, i) : t;
}

function countByExactType(provisions, type) {
  return (provisions || []).filter((p) => p && p.type === type).length;
}

function countByFamily(provisions, base) {
  return (provisions || []).filter((p) => p && familyBaseOf(p.type) === base).length;
}

// Per-deal type counts the scorecard reports. REP-T/REP-B/DEF/TERMF are
// exact-type counts (no party-variant fan-out in the taxonomy); COND/IOC/
// NOSOL/TERMR sum every party variant of the family.
function computeCounts(provisions) {
  const provs = provisions || [];
  return {
    total: provs.length,
    repT: countByExactType(provs, 'REP-T'),
    repB: countByExactType(provs, 'REP-B'),
    def: countByExactType(provs, 'DEF'),
    cond: countByFamily(provs, 'COND'),
    ioc: countByFamily(provs, 'IOC'),
    nosol: countByFamily(provs, 'NOSOL'),
    termr: countByFamily(provs, 'TERMR'),
    termf: countByExactType(provs, 'TERMF'),
  };
}

// Strip [[MARKER]] pipeline tags, collapse whitespace, lowercase. Distinct
// from lib/verification's normalizeForMatch (which also strips quotes/
// hyphens for quote-matching purposes) — here we want a conservative
// exact-duplicate signal, not a fuzzy one, so we only remove the pipeline
// artifacts and whitespace noise a re-run can introduce.
function normalizeForDupe(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, ' ')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Number of REDUNDANT provisions: for every group of provisions sharing the
// same normalized full_text, every copy after the first counts as a
// duplicate. A clean ingest has 0.
function computeDuplicateCount(provisions) {
  const counts = new Map();
  for (const p of provisions || []) {
    const norm = normalizeForDupe(p && p.full_text);
    if (norm.length < 20) continue; // too short to be a meaningful duplicate signal
    // Same-text rows are NOT duplicates when they are deliberate siblings:
    // per-instrument CONSID-EQUITY rows (instrumentType differs) and Strategy-B
    // multi-code decompositions (code differs) legitimately share one span.
    // Key on text + code + instrumentType so only true redundancy counts.
    //
    // instrumentType.code alone is a FAMILY code (e.g. "RSUs" covers Company
    // RSUs, Company 2018 RSUs and Director RSUs; "RESTRICTED_STOCK" covers
    // both regular and Rollover Restricted Stock) — too coarse when a single
    // section decomposes into several same-family sibling rows with distinct
    // per-instrument treatment (CSRA's Section 3.2 RSU/2018-RSU/Director-RSU
    // rows; Covance's Section 2.03 Restricted-Stock/Rollover rows). Those
    // siblings quote a DIFFERENT instrumentType.text (the specific instrument
    // reference) even though the family code matches, so folding it into the
    // key keeps genuine same-instrument duplicates flagged while excluding
    // legitimate per-instrument decompositions.
    const meta = p && p.ai_metadata && typeof p.ai_metadata === 'object' ? p.ai_metadata : {};
    const feats = meta.features && typeof meta.features === 'object' ? meta.features : {};
    const instCode = feats.instrumentType ? (feats.instrumentType.code || feats.instrumentType) : '';
    const instText = (feats.instrumentType && typeof feats.instrumentType === 'object' && feats.instrumentType.text) || '';
    const key = `${norm}::${meta.code || ''}::${instCode}::${instText}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    continue;
  }
  let dups = 0;
  for (const n of counts.values()) {
    if (n > 1) dups += n - 1;
  }
  return dups;
}

function provisionCode(p) {
  const meta = p && p.ai_metadata && typeof p.ai_metadata === 'object' ? p.ai_metadata : {};
  const feats = meta.features && typeof meta.features === 'object' ? meta.features : {};
  return feats.canonicalCode || meta.code || null;
}

// Fraction of non-DEF provisions carrying a canonical (non-'[PROPOSED'-
// prefixed) code. DEF provisions are excluded — definitions are a closed
// enumerable set graded by count/coverage, not canonical-code hit rate.
function computeCanonicalRate(provisions) {
  const eligible = (provisions || []).filter((p) => p && p.type !== 'DEF');
  if (eligible.length === 0) return 1; // nothing to grade — vacuously fine
  const canonical = eligible.filter((p) => {
    const code = provisionCode(p);
    return !!code && !String(code).startsWith('[PROPOSED');
  }).length;
  return canonical / eligible.length;
}

const DEFAULT_GATES = {
  repT: 15,
  repB: 5,
  def: 40,
  cond: 8,
  coverage: 95,
  canonicalRate: 0.7,
};

// Evaluate every gate for one deal's computed metrics. Returns an ordered
// list of { label, value, op, threshold, pass } plus overall `ok`.
function evaluateGates(metrics, gates) {
  const g = { ...DEFAULT_GATES, ...(gates || {}) };
  const checks = [
    { label: 'REP-T', value: metrics.counts.repT, op: '>=', threshold: g.repT },
    { label: 'REP-B', value: metrics.counts.repB, op: '>=', threshold: g.repB },
    { label: 'DEF', value: metrics.counts.def, op: '>=', threshold: g.def },
    { label: 'COND', value: metrics.counts.cond, op: '>=', threshold: g.cond },
    { label: 'coverage %', value: metrics.coveragePct, op: '>=', threshold: g.coverage },
    { label: 'unverified quotes', value: metrics.unverified, op: '==', threshold: 0 },
    { label: 'duplicate clauses', value: metrics.duplicates, op: '==', threshold: 0 },
    { label: 'canonical rate', value: metrics.canonicalRate, op: '>=', threshold: g.canonicalRate },
  ];
  for (const c of checks) {
    c.pass = c.op === '>=' ? c.value >= c.threshold : c.value === c.threshold;
  }
  return { checks, ok: checks.every((c) => c.pass) };
}

/* ── deal-metadata gate group (Ben addendum — persistence enforcement) ──────
   These gate the DEAL ROW's metadata, not the provisions: a clean ingest
   that would ship a blank index cell (buyer name, value, type, profile,
   signing date) must exit 1. advisors_found is informational-only — many
   filings genuinely omit firm names from the notices section, so it is
   printed but never gates. Pure / DB-independent so both the CLI and
   pages/api/ingest/from-url.js's response payload can share one
   definition. ─────────────────────────────────────────────────────────── */

function hasAdvisorsFound(meta) {
  const v2 = meta && meta.advisors_v2;
  if (v2 && ((Array.isArray(v2.buyer_firms) && v2.buyer_firms.length) || (Array.isArray(v2.seller_firms) && v2.seller_firms.length))) return true;
  return Array.isArray(meta && meta.advisors) && meta.advisors.length > 0;
}

// law_firms_found — same family/posture as advisors_found: informational
// only, never gates. metadata.law_firms = { target: [...], acquirer: [...] }
// is populated deterministically at ingest time by
// lib/ingest/deal-metadata-prompt.js's extractLawFirms() from the Notices
// section; many filings' notices text genuinely doesn't parse cleanly
// (irregular formatting, no "if to ... :" headers), so a blank result is a
// real, expected outcome, not a defect worth failing the ingest over.
function hasLawFirmsFound(meta) {
  const lf = meta && meta.law_firms;
  if (!lf || typeof lf !== 'object') return false;
  return (Array.isArray(lf.target) && lf.target.length > 0) || (Array.isArray(lf.acquirer) && lf.acquirer.length > 0);
}

function evaluateDealMetadataGates(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};

  const buyerDisplay = resolveBuyerDisplay(deal);
  const buyerDisplayPass = !!buyerDisplay && !SHELL_NAME_REGEX.test(String(buyerDisplay));

  const valueUsd = deal && deal.value_usd;
  const valueProvenanceKind = meta.value_provenance && meta.value_provenance.kind;
  const valuePass = (valueUsd !== null && valueUsd !== undefined) || valueProvenanceKind === 'no_stated_value';

  const considerationType = meta.headlineConsiderationType || null;
  const considerationTypePass = !!considerationType;

  const buyerProfile = meta.buyer_profile || null;
  const buyerProfilePass = buyerProfile === 'strategic' || buyerProfile === 'financial';

  const signingDate = (deal && deal.announce_date) || null;
  const signingDatePass = /^\d{4}-\d{2}-\d{2}/.test(String(signingDate || ''));

  const advisorsFound = hasAdvisorsFound(meta);
  const lawFirmsFound = hasLawFirmsFound(meta);

  const checks = [
    { label: 'buyer_display', gated: true, pass: buyerDisplayPass, value: buyerDisplay || '(none)' },
    { label: 'value', gated: true, pass: valuePass, value: valueUsd ?? (valueProvenanceKind || '(none)') },
    { label: 'consideration_type', gated: true, pass: considerationTypePass, value: considerationType || '(none)' },
    { label: 'buyer_profile', gated: true, pass: buyerProfilePass, value: buyerProfile || '(none)' },
    { label: 'signing_date', gated: true, pass: signingDatePass, value: signingDate || '(none)' },
    { label: 'advisors_found', gated: false, pass: advisorsFound, value: advisorsFound ? 'yes' : 'no' },
    { label: 'law_firms_found', gated: false, pass: lawFirmsFound, value: lawFirmsFound ? 'yes' : 'no' },
  ];
  const gated = checks.filter((c) => c.gated);
  return { checks, ok: gated.every((c) => c.pass) };
}

function printDealMetadataScorecard(metaEval, { staging } = {}) {
  console.log('  ── deal metadata (buyer/value/type/profile/signing_date) ──');
  for (const c of metaEval.checks) {
    const status = c.gated ? (c.pass ? 'PASS' : 'FAIL') : (c.pass ? 'info: yes' : 'info: no');
    console.log(`  ${c.label.padEnd(20)} ${String(c.value).slice(0, 40).padStart(20)}   ${status}`);
  }
  if (staging) {
    console.log('  (staging deal — metadata gates printed but not counted toward overall PASS/FAIL)');
  } else {
    console.log(`  METADATA GATE RESULT: ${metaEval.ok ? 'PASS' : 'FAIL'}`);
  }
}

/* ── formatting ──────────────────────────────────────────────────────────── */

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function printScorecard(label, metrics, evalResult) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`  total provisions: ${metrics.counts.total}`);
  for (const c of evalResult.checks) {
    const status = c.pass ? 'PASS' : 'FAIL';
    console.log(`  ${c.label.padEnd(20)} ${String(fmtNum(c.value)).padStart(8)}  ${c.op}${fmtNum(c.threshold)}   ${status}`);
  }
  console.log('  ── informational (not gated) ──');
  console.log(`  raw coverage %       ${String(fmtNum(metrics.rawCoveragePct)).padStart(8)}   (vs total document incl. cover/TOC/signatures/exhibits)`);
  console.log(`  excluded chars       ${String(fmtNum(metrics.excludedChars)).padStart(8)}   (${(metrics.excludedRegions || []).map((r) => r.label).join(', ') || 'none'})`);
  console.log(`  IOC (T/B)            ${String(metrics.counts.ioc).padStart(8)}`);
  console.log(`  NOSOL                 ${String(metrics.counts.nosol).padStart(8)}`);
  console.log(`  TERMR (all)          ${String(metrics.counts.termr).padStart(8)}`);
  console.log(`  TERMF                 ${String(metrics.counts.termf).padStart(8)}`);
  const failed = evalResult.checks.filter((c) => !c.pass).length;
  console.log(`  GATE RESULT: ${evalResult.ok ? 'PASS' : `FAIL (${failed}/${evalResult.checks.length} gates failed)`}`);
}

/* ── CLI / DB plumbing ───────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { deal: null, all: false, gates: {}, json: null, reportDb: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--min-rep-t') args.gates.repT = Number(argv[++i]);
    else if (a === '--min-rep-b') args.gates.repB = Number(argv[++i]);
    else if (a === '--min-def') args.gates.def = Number(argv[++i]);
    else if (a === '--min-cond') args.gates.cond = Number(argv[++i]);
    else if (a === '--min-coverage') args.gates.coverage = Number(argv[++i]);
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--report-db') args.reportDb = true;
    else if (a === '--no-report-db') args.reportDb = false;
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (!args.deal && !args.all) {
    console.error('Provide --deal <substring> or --all');
    process.exit(1);
  }
  return args;
}

// Paginate provisions for one deal in PAGE_SIZE-row pages via .range().
async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id, type, category, full_text, ai_metadata')
      .eq('deal_id', dealId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Provisions fetch failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

// Structured (JSON-emittable) per-deal result, built from the same metrics/
// evalResult/metaEval qaOneDeal already computes — pure, DB-free, and
// separate from the console printers so the console output they drive stays
// byte-identical. Shape per docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md
// §7 item 2: {dealId, counts, rawCoveragePct, excludedRegions, checks[], pass}.
// `checks[]` merges the gate checks and the deal-metadata checks, tagged by
// `group`, so the admin UI can render both in one per-deal gate table.
function buildDealResult(deal, metrics, evalResult, metaEval, { staging } = {}) {
  const pass = evalResult.ok && (staging || metaEval.ok);
  return {
    dealId: deal.id,
    label: `${deal.acquirer || '?'} / ${deal.target || '?'}`,
    staging: !!staging,
    counts: metrics.counts,
    coveragePct: metrics.coveragePct,
    rawCoveragePct: metrics.rawCoveragePct,
    excludedRegions: metrics.excludedRegions,
    checks: [
      ...evalResult.checks.map((c) => ({ ...c, group: 'gate' })),
      ...metaEval.checks.map((c) => ({ ...c, group: 'metadata' })),
    ],
    pass,
  };
}

async function qaOneDeal(sb, deal, gateOverrides) {
  const provisions = await fetchAllProvisions(sb, deal.id);
  const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const src = meta.full_text || '';

  const counts = computeCounts(provisions);
  const coverage = computeCoverage(provisions, src);
  const verification = verifyDealQuotes(provisions, src);
  const duplicates = computeDuplicateCount(provisions);
  const canonicalRate = computeCanonicalRate(provisions);

  const metrics = {
    counts,
    coveragePct: coverage.pct,
    rawCoveragePct: coverage.rawPct,
    excludedChars: coverage.excludedChars,
    excludedRegions: coverage.excludedRegions,
    unverified: verification.unverified,
    duplicates,
    canonicalRate,
  };
  const evalResult = evaluateGates(metrics, gateOverrides);
  const label = `${deal.acquirer || '?'} / ${deal.target || '?'}`;
  printScorecard(label, metrics, evalResult);

  const staging = meta.ingest_status === 'staging';
  const metaEval = evaluateDealMetadataGates(deal);
  printDealMetadataScorecard(metaEval, { staging });

  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging });
  return { ok: result.pass, result };
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const { data: deals, error } = await sb.from('deals').select('id, acquirer, target, value_usd, announce_date, metadata');
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }

  const targets = (deals || []).filter((d) => {
    if (!args.deal) return true;
    return `${d.acquirer || ''} ${d.target || ''}`.toLowerCase().includes(args.deal.toLowerCase());
  });

  if (targets.length === 0) {
    console.log(args.deal ? `No deal matches "${args.deal}".` : 'No deals in the corpus.');
    return;
  }

  let allOk = true;
  const dealResults = [];
  for (const deal of targets) {
    try {
      const { ok, result } = await qaOneDeal(sb, deal, args.gates);
      if (!ok) allOk = false;
      dealResults.push(result);
    } catch (err) {
      console.log(`\n═══ ${deal.acquirer || '?'} / ${deal.target || '?'} ═══`);
      console.log(`  ERROR: ${err.message}`);
      allOk = false;
      dealResults.push({ dealId: deal.id, label: `${deal.acquirer || '?'} / ${deal.target || '?'}`, error: err.message, pass: false });
    }
  }

  console.log(`\n${targets.length} deal${targets.length === 1 ? '' : 's'} checked. Overall: ${allOk ? 'PASS' : 'FAIL'}`);
  if (!allOk) process.exitCode = 1;

  // Structured JSON emitter (docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md
  // §7 item 2) — output plumbing only, built AFTER every console print above
  // so nothing here can perturb the PASS-path console byte-identity.
  const structured = { generatedAt: new Date().toISOString(), deals: dealResults, pass: allOk };

  if (args.json) {
    fs.mkdirSync(path.dirname(args.json), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(structured, null, 2));
  }

  if (resolveReportDbFlag(args)) {
    const summary = {
      dealCount: dealResults.length,
      passCount: dealResults.filter((d) => d.pass).length,
      failCount: dealResults.filter((d) => !d.pass).length,
      pass: allOk,
    };
    await persistReport(sb, { kind: 'ingest-qa', generatedAt: structured.generatedAt, summary, payload: structured });
  }
}

module.exports = {
  familyBaseOf,
  countByExactType,
  countByFamily,
  computeCounts,
  normalizeForDupe,
  computeDuplicateCount,
  provisionCode,
  computeCanonicalRate,
  evaluateGates,
  hasAdvisorsFound,
  hasLawFirmsFound,
  evaluateDealMetadataGates,
  printDealMetadataScorecard,
  fetchAllProvisions,
  findDotEnvLocal,
  loadDotEnvLocal,
  printScorecard,
  buildDealResult,
  qaOneDeal,
  parseArgs,
  DEFAULT_GATES,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
