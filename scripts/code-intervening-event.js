#!/usr/bin/env node
/*
 * code-intervening-event.js — stamp the Ben-decided intervening-event
 * codebook (interveningEventType + interveningEventExceptions, see
 * INTERVENING_EVENT_TYPE / INTERVENING_EVENT_EXCEPTION_META in
 * lib/taxonomy.js) onto each deal's NOSOL intervening-event provision.
 *
 * THIS SCRIPT IS A DELIVERY VEHICLE FOR HUMAN-REVIEWED CODING, not a
 * classifier. The per-deal grades and exception lists below were produced
 * by a Fable corpus pass over the STORED interveningEventDefinition text
 * of every deck that carries one (11 decks, 2026-07-20), reviewed against
 * the key language quoted in the review table delivered with this script.
 * Nothing is re-derived at runtime — editing a grade means editing the
 * CODING table below, on purpose, with the definition text in front of you.
 *
 * Grade semantics (Ben's codebook):
 *   IE_POSITIVE_ONLY         definition expressly limited to positive
 *                            developments ("any positive material event")
 *   IE_POSITIVE_OR_NEGATIVE  neutral definition — any material
 *                            unknown/unforeseeable development
 *   IE_NONE                  no intervening-event concept (no rows exist,
 *                            so this script never stamps it — it lives in
 *                            the codebook for extraction/query use)
 *
 * Decks whose cached data shows an intervening-event PROVISION but no
 * stored definition text are listed in UNRESOLVED and skipped with a
 * printed reason — never guessed. (The legacy interveningEventScope
 * POSITIVE_ONLY stamps are NOT trusted: that code conflated the
 * Acquisition-Proposal carve-out with genuine positive-only drafting.)
 *
 * Placement: every NOSOL provision of the deal whose
 * ai_metadata.features.interveningEventDefinition is present (the row the
 * definition was coded FROM). No definition row -> SKIP with a warning.
 *
 * Usage (Ben's machine, .env.local present):
 *   node scripts/code-intervening-event.js            # dry run: per-deal diff
 *   node scripts/code-intervening-event.js --apply    # write the changes
 */
// Plain `node` never loads .env.local (only Next.js does) -- same tiny
// loader every other DB script in scripts/ carries (see scripts/eval.js).
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
const { INTERVENING_EVENT_TYPE, INTERVENING_EVENT_EXCEPTION_CODES } = require('../lib/taxonomy');

const APPLY = process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// REVIEWED CODING TABLE (Fable corpus pass, 2026-07-20). deal_id -> grade +
// canonical exceptions + the key definition language the grade rests on.
// Ben reviews the full quote table before running --apply.
// ---------------------------------------------------------------------------
const CODING = {
  '0d38cc1f-2f49-47ee-bc21-de68d7884b90': { // Zymeworks / Theravance Biopharma
    dealName: 'Zymeworks / Theravance Biopharma',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'a material change, event, occurrence or development that occurs or arises after the date of this Agreement affecting or with respect to the Company',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED'],
  },
  '13211d88-4f16-4730-bb70-fb1ef6ab3735': { // General Atlantic & Stone Point / HireRight
    dealName: 'General Atlantic & Stone Point / HireRight',
    grade: 'IE_POSITIVE_ONLY',
    keyQuote: 'any positive material event or development or material change in circumstances with respect to the Company',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE', 'CREDIT_RATING_CHANGE'],
  },
  '1f80bec7-294b-4590-b861-2c156e75aadc': { // Bain Capital / Envestnet
    dealName: 'Bain Capital / Envestnet',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'any material Effect with respect to the Company that (A) was not known or reasonably foreseeable to the Company Board',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE', 'CREDIT_RATING_CHANGE'],
  },
  '2b9a6571-6fe7-4aac-931d-a96ab227ea43': { // IBM / Red Hat
    dealName: 'IBM / Red Hat',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'any event, development or change in circumstances that was not known to the Company Board, or the consequences of which were not reasonably foreseeable',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'STOCK_PRICE_CHANGE'],
  },
  '2c143f44-6aa9-40d9-a92f-30d48aa603fd': { // Amazon / Whole Foods Market
    dealName: 'Amazon / Whole Foods Market',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'a change, effect, event, circumstance or development that was not known by the Company or the Company Board as of the date of this Agreement',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'STOCK_PRICE_CHANGE'],
  },
  '7dc3a05f-b170-4d59-a255-b7103cca16e1': { // QXO / TopBuild
    dealName: 'QXO / TopBuild',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'a material event, development, occurrence, state of facts or change that was not known or reasonably foreseeable to the Company Board',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'AGREEMENT_COMPLIANCE_ACTIONS'],
  },
  '86a01770-f565-47c5-8e7d-2a75a66b5e8b': { // General Atlantic / European Wax Center
    dealName: 'General Atlantic / European Wax Center',
    grade: 'IE_POSITIVE_ONLY',
    keyQuote: 'any positive material event or development or material change in circumstances with respect to the Company',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE', 'CREDIT_RATING_CHANGE'],
  },
  '885edae5-49e8-464a-9f33-edd229119d7c': { // Pfizer / Metsera
    dealName: 'Pfizer / Metsera',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'a material event, fact, circumstance, development, occurrence or change not known to or reasonably foreseeable by the Company Board',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE'],
  },
  'af4940e1-a645-437c-acfa-4a53e8d9f7ac': { // 3G Capital / Skechers
    dealName: '3G Capital / Skechers',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'any material event or development or material change in circumstances with respect to the Company that (A) was not actually known to, or reasonably expected by, the Company Board',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE', 'CREDIT_RATING_CHANGE'],
  },
  'ce061fd0-a437-4d20-8a84-fdd6296aa5a0': { // Restaurant Brands International / Carrols Restaurant Group
    dealName: 'Restaurant Brands International / Carrols Restaurant Group',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'any material event, occurrence or development or material change in circumstances with respect to the Company and its Subsidiaries, taken as a whole',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE', 'CREDIT_RATING_CHANGE'],
  },
  'cf32899a-37c6-4147-8350-4a2e132a30db': { // Goodyear / Cooper Tire
    dealName: 'Goodyear / Cooper Tire',
    grade: 'IE_POSITIVE_OR_NEGATIVE',
    keyQuote: 'a material development, fact, change, event, effect, occurrence or circumstance that is not known or reasonably foreseeable ... (excluding any Company Takeover Proposal)',
    exceptions: ['ACQUISITION_PROPOSAL_RELATED'],
  },
};

// Decks whose cached cards show an intervening-event provision but carry NO
// stored interveningEventDefinition text — the grade cannot be read off
// cached data, so they are skipped (printed below), never guessed. They
// need a source-text pass before coding.
const UNRESOLVED = {
  '0a043659-68fb-4d20-98e6-b926aa758799': 'Silver Lake / Endeavor — IE provision present, no stored definition text',
  '1dfb11d5-99d3-4f2b-8229-6e61e8af2eea': 'Apollo / Bridge Investment Group — IE provision present, no stored definition text',
  '1e4b7102-7890-451a-b8d0-8357120fc371': 'Sekisui House / MDC Holdings — IE provision present, no stored definition text',
  '320a3899-0d74-42d6-a412-3a962997d6ca': 'Eli Lilly / Verve — legacy interveningEventScope=POSITIVE_ONLY with EMPTY quotes and no stored definition; the legacy code conflates the AP carve-out with positivity, so it cannot support a grade',
  '555579a6-6a11-45b3-9da9-43e1b49a6e89': 'Sanofi / Bioverativ — IE provision present, no stored definition text',
  '667447f0-ff25-4de2-a1b5-e5f099ecd366': 'Oaktree lender group / Superior Industries — IE provision present, no stored definition text',
  'a267309a-fc22-4160-a652-1144fc64e9cf': 'ConocoPhillips / Concho Resources — IE provisions (both parties) present, no stored definition text',
  'aad132ee-8a43-436d-b6a8-5604b7dfee01': 'Stanley Martin Homes / United Homes Group — IE provision present, no stored definition text',
  'b57d0d65-d9d6-4e77-8e2e-08da4eb58f81': 'Rocket Companies / Redfin — IE provision present, no stored definition text',
  'bb5f062d-2818-4f9f-b968-ad9980445b6f': 'Novo Holdings / Catalent — legacy interveningEventScope=POSITIVE_ONLY with EMPTY quotes and no stored definition ("Change in Circumstance" drafting); cannot support a grade',
  'c34415ed-44f7-432f-8d7c-6464b0310239': 'AbbVie / Landos Biopharma — IE provision ("Change in Circumstance") present, no stored definition text',
  'c750afb9-73fc-4043-a9d7-269506a6e00e': 'Marriott / Starwood — IE provision present, no stored definition text',
  'df393645-86f4-4ae2-861e-35777e93583e': 'Charter Communications / Cox Enterprises — IE provision present, no stored definition text',
  'dfaa71fa-9723-4794-825d-bd5024aa0b5d': 'Global Net Lease / Modiv — IE provision present, no stored definition text',
  'f9c61065-a935-42a3-bc90-2f5a76670191': 'Brookfield Asset Management / Forest City — IE provision present, no stored definition text',
};

const metaOf = (p) => {
  let m = p.ai_metadata;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = {}; } }
  return m && typeof m === 'object' ? m : {};
};

// Supabase caps every query at 1000 rows by default -- a multi-deal
// provisions fetch silently truncates past that. Page through with
// .range() until a short page (same guard as restamp-ioc-restrictions.js).
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

function taggedType(entry) {
  const label = INTERVENING_EVENT_TYPE[entry.grade];
  if (!label) throw new Error(`CODING grade ${entry.grade} not in INTERVENING_EVENT_TYPE`);
  return { code: entry.grade, label, text: entry.grade, quotes: [entry.keyQuote] };
}

function taggedExceptions(entry) {
  return entry.exceptions.map((code) => {
    const label = INTERVENING_EVENT_EXCEPTION_CODES[code];
    if (!label) throw new Error(`CODING exception ${code} not in INTERVENING_EVENT_EXCEPTION_CODES`);
    return { code, label, text: '', quotes: [] };
  });
}

async function main() {
  const sb = getServiceSupabase();
  if (!sb) { console.error('Supabase not configured (need .env.local)'); process.exit(1); }

  console.log(`reviewed codings: ${Object.keys(CODING).length} deals; unresolved (skipped): ${Object.keys(UNRESOLVED).length}`);
  for (const [dealId, reason] of Object.entries(UNRESOLVED)) {
    console.log(`  UNRESOLVED ${dealId.slice(0, 8)}: ${reason}`);
  }

  const NOSOL_RE = /no[\s_-]*sol|NOSOL|COVENANT_NO_SOLICITATION/i;
  const provisions = await fetchAllRows(sb
    .from('provisions')
    .select('id, deal_id, type, category, ai_metadata')
    .in('deal_id', Object.keys(CODING))
    .order('id'));
  console.log(`\nprovisions loaded for coded deals: ${provisions.length}`);

  const plan = [];
  for (const [dealId, entry] of Object.entries(CODING)) {
    const rows = provisions.filter((p) => p.deal_id === dealId
      && (NOSOL_RE.test(String(p.type || '')) || NOSOL_RE.test(String(p.category || ''))));
    // The intervening-event definition row is the row this coding was read
    // FROM — the only defensible home for the grade. Never guess a row.
    const targets = rows.filter((p) => {
      const meta = metaOf(p);
      return meta.features && typeof meta.features === 'object'
        && typeof meta.features.interveningEventDefinition === 'string'
        && meta.features.interveningEventDefinition.trim();
    });
    if (!targets.length) {
      console.warn(`SKIP ${entry.dealName} (${dealId.slice(0, 8)}): no NOSOL row carries interveningEventDefinition`);
      continue;
    }
    for (const p of targets) {
      const meta = metaOf(p);
      const features = meta.features;
      plan.push({
        p,
        meta,
        entry,
        storedType: features.interveningEventType || null,
        storedExceptions: features.interveningEventExceptions || null,
      });
    }
  }

  console.log(`\nplanned writes: ${plan.length} provisions${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);
  let lastDeal = null;
  for (const e of plan) {
    if (e.p.deal_id !== lastDeal) { console.log(`\n${e.entry.dealName} (${e.p.deal_id})`); lastDeal = e.p.deal_id; }
    const oldT = e.storedType ? (e.storedType.code || JSON.stringify(e.storedType)) : '(none)';
    const oldX = e.storedExceptions == null ? '(none)'
      : Array.isArray(e.storedExceptions) ? JSON.stringify(e.storedExceptions.map((x) => x.code || x))
        : JSON.stringify(e.storedExceptions);
    console.log(`  ${e.p.id} [${e.p.type}]`);
    console.log(`    interveningEventType:       ${oldT} -> ${e.entry.grade}`);
    console.log(`    interveningEventExceptions: ${oldX} -> ${JSON.stringify(e.entry.exceptions)}`);
  }

  if (!APPLY) return;
  let written = 0;
  for (const e of plan) {
    const meta = e.meta;
    meta.features.interveningEventType = taggedType(e.entry);
    meta.features.interveningEventExceptions = taggedExceptions(e.entry);
    const { error } = await sb.from('provisions').update({ ai_metadata: meta }).eq('id', e.p.id);
    if (error) { console.error(`WRITE FAIL ${e.p.id}: ${error.message}`); process.exit(1); }
    written += 1;
  }
  console.log(`\nwrote ${written} provisions. Spot-check the HireRight / European Wax Center Intervening Event cards (the two IE_POSITIVE_ONLY decks) on the review page.`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { CODING, UNRESOLVED };
