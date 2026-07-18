#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill-deal-display.js — Package B data backfill for the
   deals-index audit (docs/handoffs/DEALS-INDEX-SPEC-2026-07-18.md), items
   1-data, 4, 5-data.

   Covers, in one script (per-item detail below), the confident rows only —
   every VERIFY-marked row is printed in the dry-run output but is NEVER
   written, even with --apply:

     1. buyer_display  — metadata.acquirer_display / metadata.ultimateParent
        for the 4 confident sponsor-shell rows (Envestnet, Endeavor,
        HireRight, European Wax Center) + an optional ultimateParent-only
        note for United Homes Group. Superior Industries is VERIFY (buyer
        identity not confirmed against an 8-K/proxy) and is listed but never
        written.
     2. value_usd + metadata.value_provenance — the 6 CONFIDENT rows from
        the spec's audit table. The 7 VERIFY rows (post-cutoff deals whose
        headline value needs an 8-K/PR pull) are listed but never written.
     3. metadata.headlineConsiderationType — derived LIVE from each deal's
        own stored CONSID provisions (deterministic — reads the
        `considerationType` feature the extractor already stamped on the
        CONSID-CONVERT / CONSID-EXCHANGE row, with an election-language
        check to distinguish MIXED from MIXED_ELECTION). Falls back to the
        spec's pinned cross-check only for the 2 deals with no stored
        CONSID-CONVERT signal (Bridge, Endeavor) and prints a MISMATCH
        warning if the live derivation ever disagrees with the spec's
        pinned cross-check for the 5 deals where one exists (Frontier,
        Carrols, Envestnet, Sophos, Cox). One deal (Stanley Martin/United
        Homes Group) has no derivable signal and is left UNRESOLVED — this
        script does not guess a type for it.
     4. metadata.buyer_profile ('financial' | 'strategic') for all 40 deals
        — 8 financial (Skechers, Superior, Envestnet, Endeavor, HireRight,
        EWC, Catalent, Forest City) per the spec's enumeration, everything
        else strategic. Not VERIFY-gated — buyer_profile classification is
        independent of the buyer_display name-resolution question (Superior
        is confidently 'financial' even though its display name is VERIFY).

   Usage:
     node scripts/backfill-deal-display.js                  # dry run, all deals
     node scripts/backfill-deal-display.js --deal Envestnet  # dry run, one deal
     node scripts/backfill-deal-display.js --only value      # dry run, one section
     node scripts/backfill-deal-display.js --apply           # write (VERIFY rows still skipped)

   Flags:
     --dry-run        print before/after only, no writes (default: on)
     --apply          write UPDATEs to deals.metadata / deals.value_usd
                       (VERIFY rows are ALWAYS skipped, --apply or not)
     --deal <sub>     only process deals whose acquirer/target contains <sub>
     --only <section>  buyer-display | value | type | profile — restrict to
                       one backfill section (default: all four)

   Credentials from env / .env.local only. Re-runnable: reads current DB
   state each run; only touches the specific metadata keys each section
   owns (merge, not replace).
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

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

/* ── Section 1: buyer_display (spec item 1) ─────────────────────────────── */

const BUYER_DISPLAY_ROWS = [
  {
    idPrefix: '1f80bec7',
    label: 'Bain Capital / Envestnet',
    acquirerDisplay: 'Bain Capital',
    ultimateParent: 'Bain Capital',
    source: 'VERIFIED in stored agreement: Equity Investors = Bain Capital Fund XIII + Reverence Capital funds; notices c/o Bain Capital Private Equity',
    verify: false,
  },
  {
    idPrefix: '0a043659',
    label: 'Silver Lake / Endeavor',
    acquirerDisplay: 'Silver Lake',
    ultimateParent: 'Silver Lake',
    source: 'VERIFIED: Specified Stockholders = Silver Lake West HoldCo L.P./II',
    verify: false,
  },
  {
    idPrefix: '13211d88',
    label: 'General Atlantic & Stone Point / HireRight',
    acquirerDisplay: 'General Atlantic & Stone Point',
    ultimateParent: 'General Atlantic',
    source: 'VERIFIED: Guarantors = General Atlantic Partners 100 L.P. + Trident VII funds (Stone Point)',
    verify: false,
  },
  {
    idPrefix: '86a01770',
    label: 'General Atlantic / European Wax Center',
    acquirerDisplay: 'General Atlantic',
    ultimateParent: 'General Atlantic',
    source: 'VERIFIED: Guarantor = General Atlantic Partners 100 L.P.',
    verify: false,
  },
  {
    idPrefix: '667447f0',
    label: 'SUP Parent / Superior Industries',
    acquirerDisplay: null,
    ultimateParent: null,
    source: 'VERIFY from 8-K/proxy before applying. Agreement recites only the existing credit agreement (Oaktree Fund Administration as admin agent) — do not guess a lender-group name from that alone.',
    verify: true,
  },
  {
    idPrefix: 'aad132ee',
    label: 'Stanley Martin Homes / United Homes Group',
    acquirerDisplay: null, // no display change — "Stanley Martin Homes" is already correct
    ultimateParent: 'Daiwa House Industry',
    source: 'Stanley Martin Homes is a real operating company (Daiwa House subsidiary) — display is fine as-is; optional ultimateParent note only.',
    verify: false,
    ultimateParentOnly: true,
  },
];

/* ── Section 2: value_usd + value_provenance (spec item 4) ─────────────── */

const VALUE_ROWS = [
  {
    idPrefix: '1dfb11d5', label: 'Apollo Global Management / Bridge Investment Group', verify: false,
    valueUsd: 1_500_000_000,
    provenance: { kind: 'announced all-stock equity value', note: '$1.5B announced all-stock equity value, Feb 2025 press release — CONFIDENT' },
  },
  {
    idPrefix: 'bf31d586', label: 'Sophos / SecureWorks', verify: false,
    valueUsd: 859_000_000,
    provenance: { kind: 'equity value (stated)', note: '$8.50/sh cash, Oct 2024 PR — CONFIDENT' },
  },
  {
    idPrefix: '1f80bec7', label: 'Bain Capital / Envestnet', verify: false,
    valueUsd: 4_500_000_000,
    provenance: { kind: 'equity value (stated)', note: '$63.15/sh cash, Jul 2024 PR — CONFIDENT' },
  },
  {
    idPrefix: '13211d88', label: 'General Atlantic & Stone Point / HireRight', verify: false,
    valueUsd: 1_650_000_000,
    provenance: { kind: 'equity value (stated)', note: '$28.75/sh cash, Feb 2024 PR — CONFIDENT' },
  },
  {
    idPrefix: '1e4b7102', label: 'Sekisui House / M.D.C. Holdings', verify: false,
    valueUsd: 4_900_000_000,
    provenance: { kind: 'equity value (stated)', note: '$63.00/sh cash, Jan 2024 PR — CONFIDENT' },
  },
  {
    idPrefix: 'ce061fd0', label: 'Restaurant Brands International / Carrols Restaurant Group', verify: false,
    valueUsd: 1_000_000_000,
    provenance: { kind: 'approximate equity value (stated)', note: '$9.55/sh cash, Jan 2024 PR (~"approximately $1.0 billion") — CONFIDENT' },
  },
  { idPrefix: '0d38cc1f', label: 'Zymeworks / Theravance Biopharma', verify: true, note: 'Jun 2026 deal — pull 8-K/PR (Ex-99.1) at backfill time' },
  { idPrefix: 'dfaa71fa', label: 'Global Net Lease / Modiv Industrial', verify: true, note: 'May 2026 — 8-K/PR' },
  { idPrefix: '7dc3a05f', label: 'QXO / TopBuild', verify: true, note: 'Apr 2026 — 8-K/PR' },
  { idPrefix: 'aad132ee', label: 'Stanley Martin Homes / United Homes Group', verify: true, note: 'Feb 2026 — 8-K/PR' },
  { idPrefix: '86a01770', label: 'General Atlantic / European Wax Center', verify: true, note: 'Feb 2026 — 8-K/PR' },
  { idPrefix: '13894e33', label: 'IonQ / SkyWater Technology', verify: true, note: 'Jan 2026 — 8-K/PR' },
  {
    idPrefix: '667447f0', label: 'SUP Parent / Superior Industries', verify: true,
    note: 'debt-restructuring take-private; likely no headline value — if the 8-K confirms no stated value, write value_provenance.kind = "no_stated_value" (never a guessed number) and render the per-share/EV note',
  },
];

/* ── Section 3: headlineConsiderationType (spec item 5) ─────────────────── */

// Feature-level considerationType (already stamped on CONSID rows by the
// extractor) → the clean headline enum used across the app.
function considerationTypeFromFeature(ct) {
  if (ct === 'all-cash') return 'CASH';
  if (ct === 'all-stock') return 'STOCK';
  if (ct === 'cash-with-cvr') return 'CASH_PLUS_CVR';
  if (ct === 'mixed-cash-and-stock') return 'MIXED'; // election check layered on below
  return null;
}

// "elect"/"election" appears in a LOT of unrelated boilerplate (S corp
// elections, tax elections, "no election shall be available" negations).
// Require an affirmative election-mechanics phrase, and let an explicit
// negation win over a bare keyword hit (IonQ/SkyWater: "No election shall
// be made available to any holder ... no proration shall apply" — that's a
// FIXED mix, not a shareholder election).
function hasGenuineElectionLanguage(text) {
  const t = String(text || '');
  if (/no\s+election\s+shall\s+be\s+(made\s+)?available/i.test(t)) return false;
  if (!/\belection\b/i.test(t)) return false;
  return /(cash election|stock election|may elect|election procedures|electing holder|election form)/i.test(t);
}

function provisionCode(p) {
  return (p && p.ai_metadata && p.ai_metadata.code) || null;
}

// Pure classifier over one deal's stored provisions — no LLM, no network.
// Returns { type: ENUM|null, source: string } where `source` is either the
// provision code the signal came from, or a reason the type is unresolved.
function classifyConsiderationType(provisions) {
  const consid = (provisions || []).filter((p) => p && /^CONSID/.test(String(p.type || '')));
  if (consid.length === 0) return { type: null, source: 'no-consid-provisions' };

  const headline = consid.find((p) => provisionCode(p) === 'CONSID-CONVERT')
    || consid.find((p) => provisionCode(p) === 'CONSID-EXCHANGE' && p.ai_metadata && p.ai_metadata.features && p.ai_metadata.features.considerationType);
  if (!headline) return { type: null, source: 'no-headline-provision' };

  const feats = (headline.ai_metadata && headline.ai_metadata.features) || {};
  const ct = feats.considerationType;
  let type = considerationTypeFromFeature(ct);
  if (!type) return { type: null, source: 'no-considerationType-feature' };

  if (type === 'MIXED' && hasGenuineElectionLanguage(headline.full_text)) type = 'MIXED_ELECTION';
  return { type, source: provisionCode(headline) };
}

// Deals the spec flagged as missing headlineConsiderationType. `crossCheck`
// is the spec's own pinned value where the audit already verified one
// (used as a MISMATCH tripwire against the live derivation, and as the
// fallback when a deal has no derivable CONSID-CONVERT/EXCHANGE signal at
// all — Bridge and Endeavor only store a CONSID-WITHHOLD row).
const TYPE_GAP_DEALS = [
  { idPrefix: '0d38cc1f', label: 'Zymeworks / Theravance Biopharma', crossCheck: null },
  { idPrefix: '667447f0', label: 'SUP Parent / Superior Industries', crossCheck: null },
  { idPrefix: '00d49e6a', label: 'Verizon / Frontier Communications', crossCheck: 'CASH' },
  { idPrefix: '1dfb11d5', label: 'Apollo Global Management / Bridge Investment Group', crossCheck: 'STOCK' },
  { idPrefix: 'df393645', label: 'Charter Communications / Cox Enterprises', crossCheck: 'MIXED' },
  { idPrefix: '7dc3a05f', label: 'QXO / TopBuild', crossCheck: null },
  { idPrefix: 'bf31d586', label: 'Sophos / SecureWorks', crossCheck: 'CASH' },
  { idPrefix: 'ce061fd0', label: 'Restaurant Brands International / Carrols Restaurant Group', crossCheck: 'CASH' },
  { idPrefix: 'aad132ee', label: 'Stanley Martin Homes / United Homes Group', crossCheck: null },
  { idPrefix: '13894e33', label: 'IonQ / SkyWater Technology', crossCheck: null },
  { idPrefix: '86a01770', label: 'General Atlantic / European Wax Center', crossCheck: null },
  { idPrefix: '1f80bec7', label: 'Bain Capital / Envestnet', crossCheck: 'CASH' },
  { idPrefix: '0a043659', label: 'Silver Lake / Endeavor', crossCheck: 'CASH' },
];

/* ── Section 4: buyer_profile (spec item 5, new column) ──────────────────── */

const FINANCIAL_BUYER_ID_PREFIXES = new Set([
  'af4940e1', // Skechers — 3G Capital
  '667447f0', // Superior Industries — lender consortium
  '1f80bec7', // Envestnet — Bain Capital
  '0a043659', // Endeavor — Silver Lake
  '13211d88', // HireRight — General Atlantic & Stone Point
  '86a01770', // European Wax Center — General Atlantic
  'bb5f062d', // Catalent — Novo Holdings
  'f9c61065', // Forest City Realty Trust — Brookfield
]);

function classifyBuyerProfileForDeal(idPrefix) {
  return FINANCIAL_BUYER_ID_PREFIXES.has(idPrefix) ? 'financial' : 'strategic';
}

/* ── plan builders (pure — take DB rows, return a described plan) ───────── */

function fmt(v) {
  return v === null || v === undefined || v === '' ? '(none)' : v;
}

function findDeal(deals, idPrefix) {
  return (deals || []).find((d) => d.id.startsWith(idPrefix)) || null;
}

function planBuyerDisplay(deals) {
  return BUYER_DISPLAY_ROWS.map((row) => {
    const deal = findDeal(deals, row.idPrefix);
    if (!deal) return { ...row, found: false, willWrite: false };
    const meta = deal.metadata || {};
    const before = { acquirer_display: meta.acquirer_display, ultimateParent: meta.ultimateParent };
    const willWrite = !row.verify && (row.ultimateParentOnly ? !!row.ultimateParent : !!(row.acquirerDisplay || row.ultimateParent));
    return { ...row, found: true, dealId: deal.id, before, willWrite };
  });
}

function planValue(deals) {
  return VALUE_ROWS.map((row) => {
    const deal = findDeal(deals, row.idPrefix);
    if (!deal) return { ...row, found: false, willWrite: false };
    const before = { value_usd: deal.value_usd, value_provenance: (deal.metadata || {}).value_provenance };
    const willWrite = !row.verify && typeof row.valueUsd === 'number';
    return { ...row, found: true, dealId: deal.id, before, willWrite };
  });
}

function planType(deals, provisionsByDealId) {
  return TYPE_GAP_DEALS.map((row) => {
    const deal = findDeal(deals, row.idPrefix);
    if (!deal) return { ...row, found: false, willWrite: false };
    const provisions = provisionsByDealId.get(deal.id) || [];
    const derived = classifyConsiderationType(provisions);
    let type = derived.type;
    let source = derived.source;
    let mismatch = false;
    if (type && row.crossCheck && type !== row.crossCheck) {
      mismatch = true; // live signal disagrees with the spec's pinned cross-check — surfaced, not silently trusted
    }
    if (!type && row.crossCheck) {
      type = row.crossCheck;
      source = 'spec cross-check (no stored CONSID signal)';
    }
    const before = { headlineConsiderationType: (deal.metadata || {}).headlineConsiderationType };
    const willWrite = !!type;
    return { ...row, found: true, dealId: deal.id, before, derivedType: type, derivedSource: source, mismatch, willWrite };
  });
}

function planBuyerProfile(deals) {
  return (deals || []).map((deal) => {
    const idPrefix = deal.id.slice(0, 8);
    const proposed = classifyBuyerProfileForDeal(idPrefix);
    const before = (deal.metadata || {}).buyer_profile || null;
    return {
      idPrefix,
      label: `${deal.acquirer || '?'} / ${deal.target || '?'}`,
      dealId: deal.id,
      before,
      proposed,
      willWrite: before !== proposed,
    };
  });
}

/* ── printing ─────────────────────────────────────────────────────────────── */

function printBuyerDisplayPlan(rows) {
  console.log('\n═══ 1. buyer_display (acquirer_display / ultimateParent) ═══');
  for (const r of rows) {
    if (!r.found) { console.log(`— ${r.label}: NOT FOUND in corpus`); continue; }
    const tag = r.verify ? 'VERIFY — NEVER WRITTEN' : (r.willWrite ? 'WILL WRITE' : 'no-op');
    console.log(`→ ${r.label} [${r.dealId.slice(0, 8)}] — ${tag}`);
    console.log(`  before: acquirer_display=${fmt(r.before.acquirer_display)} ultimateParent=${fmt(r.before.ultimateParent)}`);
    if (r.verify) {
      console.log(`  reason: ${r.source}`);
    } else if (r.ultimateParentOnly) {
      console.log(`  after:  ultimateParent=${fmt(r.ultimateParent)} (display unchanged)`);
      console.log(`  source: ${r.source}`);
    } else {
      console.log(`  after:  acquirer_display=${fmt(r.acquirerDisplay)} ultimateParent=${fmt(r.ultimateParent)}`);
      console.log(`  source: ${r.source}`);
    }
  }
}

function fmtUsd(n) {
  if (typeof n !== 'number') return fmt(n);
  return `$${(n / 1e9).toFixed(2)}B`;
}

function printValuePlan(rows) {
  console.log('\n═══ 2. value_usd + value_provenance ═══');
  for (const r of rows) {
    if (!r.found) { console.log(`— ${r.label}: NOT FOUND in corpus`); continue; }
    const tag = r.verify ? 'VERIFY — NEVER WRITTEN' : (r.willWrite ? 'WILL WRITE' : 'no-op');
    console.log(`→ ${r.label} [${r.dealId.slice(0, 8)}] — ${tag}`);
    console.log(`  before: value_usd=${fmt(r.before.value_usd)} value_provenance.kind=${fmt(r.before.value_provenance && r.before.value_provenance.kind)}`);
    if (r.verify) {
      console.log(`  reason: ${r.note}`);
    } else {
      console.log(`  after:  value_usd=${fmtUsd(r.valueUsd)} (${r.valueUsd}) value_provenance.kind=${r.provenance.kind}`);
      console.log(`  note:   ${r.provenance.note}`);
    }
  }
}

function printTypePlan(rows) {
  console.log('\n═══ 3. headlineConsiderationType (derived from stored CONSID provisions) ═══');
  for (const r of rows) {
    if (!r.found) { console.log(`— ${r.label}: NOT FOUND in corpus`); continue; }
    const tag = r.willWrite ? 'WILL WRITE' : 'UNRESOLVED — not written';
    console.log(`→ ${r.label} [${r.dealId.slice(0, 8)}] — ${tag}`);
    console.log(`  before: headlineConsiderationType=${fmt(r.before.headlineConsiderationType)}`);
    console.log(`  after:  ${fmt(r.derivedType)}  (source: ${r.derivedSource})`);
    if (r.mismatch) {
      console.log(`  ⚠ MISMATCH: live derivation disagrees with spec cross-check "${r.crossCheck}" — using live derivation`);
    }
    if (!r.willWrite) {
      console.log('  reason: no derivable CONSID signal in stored provisions — needs targeted research, not guessed');
    }
  }
}

function printBuyerProfilePlan(rows) {
  console.log('\n═══ 4. buyer_profile (financial / strategic) ═══');
  const financialCount = rows.filter((r) => r.proposed === 'financial').length;
  const strategicCount = rows.filter((r) => r.proposed === 'strategic').length;
  for (const r of rows) {
    const tag = r.willWrite ? 'WILL WRITE' : 'no-op (already set)';
    console.log(`→ ${r.label} [${r.idPrefix}] — ${r.proposed} — ${tag}${r.before ? ` (was: ${r.before})` : ''}`);
  }
  console.log(`\n  total: ${rows.length} deals — ${financialCount} financial / ${strategicCount} strategic (spec expects 8 / 32)`);
}

/* ── apply ────────────────────────────────────────────────────────────────── */

async function applyBuyerDisplay(sb, rows) {
  let written = 0;
  for (const r of rows) {
    if (!r.found || !r.willWrite) continue;
    const { data: deal, error: fetchErr } = await sb.from('deals').select('metadata').eq('id', r.dealId).single();
    if (fetchErr) { console.log(`  WRITE FAILED (${r.label}): ${fetchErr.message}`); continue; }
    const patch = r.ultimateParentOnly
      ? { ultimateParent: r.ultimateParent }
      : { acquirer_display: r.acquirerDisplay, ultimateParent: r.ultimateParent };
    const { error } = await sb.from('deals').update({ metadata: { ...(deal.metadata || {}), ...patch } }).eq('id', r.dealId);
    if (error) { console.log(`  WRITE FAILED (${r.label}): ${error.message}`); continue; }
    console.log(`  written: ${r.label}`);
    written += 1;
  }
  return written;
}

async function applyValue(sb, rows) {
  let written = 0;
  for (const r of rows) {
    if (!r.found || !r.willWrite) continue;
    const { data: deal, error: fetchErr } = await sb.from('deals').select('metadata').eq('id', r.dealId).single();
    if (fetchErr) { console.log(`  WRITE FAILED (${r.label}): ${fetchErr.message}`); continue; }
    const value_provenance = { kind: r.provenance.kind, set_at: new Date().toISOString(), set_by: 'scripts/backfill-deal-display.js (spec-pinned, CONFIDENT)', note: r.provenance.note };
    const { error } = await sb.from('deals').update({
      value_usd: r.valueUsd,
      metadata: { ...(deal.metadata || {}), value_provenance },
    }).eq('id', r.dealId);
    if (error) { console.log(`  WRITE FAILED (${r.label}): ${error.message}`); continue; }
    console.log(`  written: ${r.label}`);
    written += 1;
  }
  return written;
}

async function applyType(sb, rows) {
  let written = 0;
  for (const r of rows) {
    if (!r.found || !r.willWrite) continue;
    const { data: deal, error: fetchErr } = await sb.from('deals').select('metadata').eq('id', r.dealId).single();
    if (fetchErr) { console.log(`  WRITE FAILED (${r.label}): ${fetchErr.message}`); continue; }
    const { error } = await sb.from('deals').update({
      metadata: { ...(deal.metadata || {}), headlineConsiderationType: r.derivedType },
    }).eq('id', r.dealId);
    if (error) { console.log(`  WRITE FAILED (${r.label}): ${error.message}`); continue; }
    console.log(`  written: ${r.label} → ${r.derivedType}`);
    written += 1;
  }
  return written;
}

async function applyBuyerProfile(sb, rows) {
  let written = 0;
  for (const r of rows) {
    if (!r.willWrite) continue;
    const { data: deal, error: fetchErr } = await sb.from('deals').select('metadata').eq('id', r.dealId).single();
    if (fetchErr) { console.log(`  WRITE FAILED (${r.label}): ${fetchErr.message}`); continue; }
    const { error } = await sb.from('deals').update({
      metadata: { ...(deal.metadata || {}), buyer_profile: r.proposed },
    }).eq('id', r.dealId);
    if (error) { console.log(`  WRITE FAILED (${r.label}): ${error.message}`); continue; }
    console.log(`  written: ${r.label} → ${r.proposed}`);
    written += 1;
  }
  return written;
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { deal: null, apply: false, only: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--only') args.only = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (args.only && !['buyer-display', 'value', 'type', 'profile'].includes(args.only)) {
    console.error('--only must be one of: buyer-display, value, type, profile');
    process.exit(1);
  }
  return args;
}

const PAGE_SIZE = 1000;

async function fetchAllProvisionsForDeal(sb, dealId) {
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

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  console.log(`Mode: ${args.apply ? 'APPLY (writing — VERIFY rows always skipped)' : 'DRY RUN (no writes — pass --apply to write)'}`);
  if (args.deal) console.log(`Filter: deals matching "${args.deal}"`);
  if (args.only) console.log(`Section: ${args.only} only`);

  const { data: allDeals, error } = await sb
    .from('deals')
    .select('id, acquirer, target, value_usd, announce_date, metadata')
    .order('created_at', { ascending: true });
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }

  const deals = args.deal
    ? (allDeals || []).filter((d) => `${d.acquirer || ''} ${d.target || ''}`.toLowerCase().includes(args.deal.toLowerCase()))
    : (allDeals || []);

  const runBuyerDisplay = !args.only || args.only === 'buyer-display';
  const runValue = !args.only || args.only === 'value';
  const runType = !args.only || args.only === 'type';
  const runProfile = !args.only || args.only === 'profile';

  let buyerDisplayRows = [];
  let valueRows = [];
  let typeRows = [];
  let profileRows = [];

  if (runBuyerDisplay) {
    buyerDisplayRows = planBuyerDisplay(deals);
    printBuyerDisplayPlan(buyerDisplayRows);
  }

  if (runValue) {
    valueRows = planValue(deals);
    printValuePlan(valueRows);
  }

  if (runType) {
    const provisionsByDealId = new Map();
    const gapDeals = TYPE_GAP_DEALS
      .map((row) => findDeal(deals, row.idPrefix))
      .filter(Boolean);
    for (const deal of gapDeals) {
      const provisions = await fetchAllProvisionsForDeal(sb, deal.id);
      provisionsByDealId.set(deal.id, provisions);
    }
    typeRows = planType(deals, provisionsByDealId);
    printTypePlan(typeRows);
  }

  if (runProfile) {
    profileRows = planBuyerProfile(deals);
    printBuyerProfilePlan(profileRows);
  }

  if (args.apply) {
    console.log('\n═══ APPLYING ═══');
    let total = 0;
    if (runBuyerDisplay) total += await applyBuyerDisplay(sb, buyerDisplayRows);
    if (runValue) total += await applyValue(sb, valueRows);
    if (runType) total += await applyType(sb, typeRows);
    if (runProfile) total += await applyBuyerProfile(sb, profileRows);
    console.log(`\nDone. ${total} row(s) written.`);
  } else {
    console.log('\nDry run complete — no writes. Pass --apply to write (VERIFY rows are still skipped).');
  }
}

module.exports = {
  BUYER_DISPLAY_ROWS,
  VALUE_ROWS,
  TYPE_GAP_DEALS,
  FINANCIAL_BUYER_ID_PREFIXES,
  considerationTypeFromFeature,
  hasGenuineElectionLanguage,
  classifyConsiderationType,
  classifyBuyerProfileForDeal,
  findDeal,
  planBuyerDisplay,
  planValue,
  planType,
  planBuyerProfile,
  parseArgs,
  main,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
