#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill-deal-display.js — Package B data backfill for the
   deals-index audit (docs/handoffs/DEALS-INDEX-SPEC-2026-07-18.md), items
   1-data, 4, 5-data.

   Ben review round (2026-07-18), applied on top of the original spec:
     - Shell-piercing rule sharpened: pierce ONLY entities formed for the
       transaction, never real companies or pre-existing holdcos (encoded
       generally in lib/ingest/deal-metadata-prompt.js's shouldPierceShell).
       Re-examined European Wax Center's "Glow Midco, LLC" against the
       stored agreement text — its own reps state "Each Buyer Party has been
       formed solely for the purpose of engaging in the Transactions"
       (Section 4.7) — confirmed deal-formed SPV, plan unchanged (→ General
       Atlantic). M.D.C. Holdings' buyer_display is ALREADY correctly set
       to "Sekisui House" in metadata (verified against the agreement's
       Guarantor recital) — a no-op, not a write, same pattern as Skechers.
     - Ben authorized press-release sourcing for the 7 VERIFY value rows:
       all 7 resolved via the deal's own SEC 8-K EX-99.1 exhibit (or web
       search where the PR wasn't in the same EDGAR accession as the
       agreement) and promoted to WILL WRITE with value_provenance
       kind='press_release' + source_url + a verbatim quote. Superior
       Industries' PR confirms this is a debt-for-equity restructuring with
       NO stated headline transaction value — promoted to WILL WRITE with
       value_usd=null, kind='no_stated_value' (a confident, sourced
       determination, not a lingering VERIFY).
     - Superior Industries' PR also names the buyer group ("a group of its
       term loan investors ... including Oaktree Capital Management") —
       promoted buyer_display from VERIFY to WILL WRITE as "Oaktree-led
       lender group", per the spec's own suggested naming for this case.
     - The 6 originally-CONFIDENT value rows were also given real EX-99.1
       source_url + verbatim quotes in this round (previously note-only).

   Covers, in one script (per-item detail below):

     1. buyer_display  — metadata.acquirer_display / metadata.ultimateParent
        for the 6 confident rows (Envestnet, Endeavor, HireRight, European
        Wax Center, Superior Industries, Sekisui House/M.D.C. — the last of
        which was ALREADY correct on acquirer_display; this only backfills
        its missing top-level ultimateParent key) + a United Homes Group
        ultimateParent-only note (display already correct, real operating
        company). No buyer_display rows remain VERIFY after this round.
     2. value_usd + metadata.value_provenance — all 13 rows resolved and
        WILL WRITE (6 originally confident + 7 resolved this round via PR),
        each with a source_url + verbatim quote. No value rows remain
        VERIFY after this round.
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
        else strategic. Not VERIFY-gated.

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
    source: 'RE-VERIFIED against stored agreement text (Ben review round): Section 4.7 "Operations of the Buyer Parties" states "Each Buyer Party has been formed solely for the purpose of engaging in the Transactions" — Glow Midco, LLC is a deal-formed SPV, not a pre-existing holdco (shouldPierceShell -> pierce, reason: transaction-formed-language). Guarantor = General Atlantic Partners 100 L.P.',
    verify: false,
  },
  {
    idPrefix: '667447f0',
    label: 'SUP Parent / Superior Industries',
    acquirerDisplay: 'Oaktree-led lender group',
    ultimateParent: 'Oaktree-led lender group',
    source: 'RESOLVED via PR (Ben review round): SEC 8-K EX-99.1 (d22359dex991.htm, same accession as the agreement) states "[Superior] has entered into definitive agreements to be acquired by a group of its term loan investors (the “Investors”), including Oaktree Capital Management" — quote from Oaktree Managing Director Robert LaRoche also appears. No single named entity controls the group, so using the spec’s own suggested naming ("Oaktree-led lender group") per the sourced PR rather than the legal shell name.',
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/95552/000119312525157138/d22359dex991.htm',
    verify: false,
  },
  {
    idPrefix: '1e4b7102',
    label: 'Sekisui House / M.D.C. Holdings',
    acquirerDisplay: 'Sekisui House',
    ultimateParent: 'Sekisui House',
    source: 'Ben review catch, verified this round: metadata.acquirer_display is ALREADY "Sekisui House" (confirmed against the agreement preamble — "...and solely for the purposes of Section 6.2, Section 6.17 and Section 9.15, Sekisui House, Ltd., a Japanese kabushiki kaisha (“Guarantor”)"; deal_facts.parties.parent_entity is already "Sekisui House, Ltd." too), so this was a live-index precedence bug, not a data gap, same pattern as Skechers/3G Capital. metadata.ultimateParent itself is NOT yet set (only acquirer_display and the deal_facts record are) — this row backfills that one missing top-level key for consistency with the other rows; acquirer_display itself is unchanged.',
    verify: false,
  },
  {
    idPrefix: 'aad132ee',
    label: 'Stanley Martin Homes / United Homes Group',
    acquirerDisplay: null, // no display change — "Stanley Martin Homes" is already correct
    ultimateParent: 'Daiwa House Industry',
    source: 'Stanley Martin Homes is a real operating company (Daiwa House subsidiary), not shell-shaped (shouldPierceShell -> no pierce, reason: not-shell-shaped) — display is fine as-is; optional ultimateParent note only.',
    verify: false,
    ultimateParentOnly: true,
  },
  {
    idPrefix: 'bb5f062d',
    label: 'Novo Holdings A/S / Catalent, Inc.',
    acquirerDisplay: 'Novo Holdings',
    ultimateParent: 'Novo Holdings',
    // deals-index round (Ben, 2026-07-19): Catalent was IN buyer_profile's
    // FINANCIAL_BUYER_ID_PREFIXES set below from the start of this script
    // (comment already said "Catalent — Novo Holdings"), but this deal was
    // simply never given a BUYER_DISPLAY_ROWS entry in this file's earlier
    // rounds — an omission, not a considered VERIFY/skip decision. That's
    // why the index showed the raw filed acquirer ("Creek Parent, Inc.", a
    // shell -- SHELL_NAME_REGEX matches "Parent") instead of a real display
    // name: resolveBuyerDisplay() (lib/query/types.js) falls through
    // acquirer_display -> ultimateParent -> ultimate_parent -> parent_entity
    // -> deal.acquirer, and with none of the metadata keys ever set, it
    // lands on deal.acquirer itself, which firstNonShellCandidate() lets
    // through anyway because it is the LAST candidate in the chain (no
    // later non-null candidate to prefer).
    // "Novo Holdings" is the real acquirer per public reporting (Novo
    // Holdings A/S's binding offer for Catalent, Inc., announced Feb 2024,
    // subsequently assigned to Novo Nordisk for three manufacturing sites)
    // -- kept VERIFY-gated (never written by --apply) because this
    // environment has no Supabase/full_text access to confirm the
    // Guarantor/Equity-Investor recital wording against the STORED
    // agreement text, unlike the other rows in this file which quote the
    // agreement verbatim. Promote to verify: false once checked against
    // the stored agreement (same process as the other rows here).
    source: 'UNVERIFIED against stored agreement text (no DB access in this environment) — public-record buyer is Novo Holdings A/S; verify the agreement\'s own Guarantor/Equity Investor recital before promoting.',
    verify: true,
  },
];

/* ── Section 2: value_usd + value_provenance (spec item 4) ─────────────── */

// All 13 rows resolved and WILL WRITE as of the Ben review round
// (2026-07-18) — every provenance carries a real SEC EX-99.1 source_url and
// a verbatim quote pulled with the SEC-required User-Agent
// "Corpus bengoodchild@gmail.com". No VERIFY rows remain in this section.
const VALUE_ROWS = [
  {
    idPrefix: '1dfb11d5', label: 'Apollo Global Management / Bridge Investment Group', verify: false,
    valueUsd: 1_500_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "entered into a definitive agreement for Apollo to acquire Bridge in an all-stock transaction with an equity value of approximately $1.5 billion." (Feb 2025)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1854401/000119312525032823/d892124dex991.htm',
    },
  },
  {
    idPrefix: 'bf31d586', label: 'Sophos / SecureWorks', verify: false,
    valueUsd: 859_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "Sophos intends to acquire Secureworks in an all-cash transaction valued at $859 million." $8.50/sh cash. (Oct 2024)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1468666/000095014224002604/eh240546999_ex9901.htm',
    },
  },
  {
    idPrefix: '1f80bec7', label: 'Bain Capital / Envestnet', verify: false,
    valueUsd: 4_500_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "entered into a definitive agreement to be acquired by Bain Capital in a transaction valuing the Company at $4.5 billion ($63.15 per share)." (Jul 2024)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1337619/000121390024060651/ea020926101ex99-1_envestnet.htm',
    },
  },
  {
    idPrefix: '13211d88', label: 'General Atlantic & Stone Point / HireRight', verify: false,
    valueUsd: 1_650_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...for $14.35 per share in cash, which implies a total enterprise value of approximately $1.65 billion." (Feb 2024)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1859285/000095010324002368/dp206920_ex9901.htm',
    },
  },
  {
    idPrefix: '1e4b7102', label: 'Sekisui House / M.D.C. Holdings', verify: false,
    valueUsd: 4_900_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...will acquire MDC in an all-cash transaction with an equity value of US$4.9 billion." $63.00/sh cash. (Jan 2024)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/773141/000095014224000148/eh240439657_ex9901.htm',
    },
  },
  {
    idPrefix: 'ce061fd0', label: 'Restaurant Brands International / Carrols Restaurant Group', verify: false,
    valueUsd: 1_000_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...for $9.55 per share in an all cash transaction, or an aggregate total enterprise value of approximately $1.0 billion." (Jan 2024)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/809248/000121390024003803/ea191659ex99-1_carrols.htm',
    },
  },
  {
    idPrefix: '0d38cc1f', label: 'Zymeworks / Theravance Biopharma', verify: false,
    valueUsd: 929_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...acquire all the outstanding equity of Theravance Biopharma for $17.00 per share, which represents a total transaction value of approximately $929 million in cash consideration..." (Jun 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1937653/000119312526286829/d156494dex991.htm',
    },
  },
  {
    idPrefix: 'dfaa71fa', label: 'Global Net Lease / Modiv Industrial', verify: false,
    valueUsd: 535_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "GNL will acquire Modiv in an all-stock transaction valued at an enterprise value of approximately $535 million." (May 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex99-1.htm',
    },
  },
  {
    idPrefix: '7dc3a05f', label: 'QXO / TopBuild', verify: false,
    valueUsd: 17_000_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "QXO... entered into a definitive agreement to acquire TopBuild Corp... for approximately $17 billion." ($505/sh implied). (Apr 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1633931/000110465926045245/bld-20260418xex99d1.htm',
    },
  },
  {
    idPrefix: 'aad132ee', label: 'Stanley Martin Homes / United Homes Group', verify: false,
    valueUsd: 221_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "Stanley Martin will acquire United Homes in an all-cash transaction that represents an enterprise value of approximately $221 million." $1.18/sh cash. (Feb 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1830188/000110465926018344/tm266691d1_ex99-1.htm',
    },
  },
  {
    idPrefix: '86a01770', label: 'General Atlantic / European Wax Center', verify: false,
    valueUsd: 330_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...taken private by General Atlantic... in an all-cash transaction with an implied equity value of approximately $330 million." (Feb 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1856236/000119312526043656/d71794dex991.htm',
    },
  },
  {
    idPrefix: '13894e33', label: 'IonQ / SkyWater Technology', verify: false,
    valueUsd: 1_800_000_000,
    provenance: {
      kind: 'press_release',
      note: 'PR: "...SkyWater for $35.00 per share in a cash-and-stock transaction, subject to a collar, implying a total equity value of approximately $1.8 billion." (Jan 2026)',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1824920/000119312526021616/d10479dex991.htm',
    },
  },
  {
    idPrefix: '667447f0', label: 'SUP Parent / Superior Industries', verify: false,
    valueUsd: null,
    provenance: {
      kind: 'no_stated_value',
      note: 'PR confirms NO headline transaction/equity value: this is a debt-for-equity restructuring — "The Investors will convert up to approximately $550 million of their term loan claims into 96.5% of the common equity of an indirect parent company of the surviving entity"; common stockholders receive an aggregate ~$3.1M cash, preferred ~$6.2M cash (not a per-share/EV headline figure comparable to the other 12 rows).',
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/95552/000119312525157138/d22359dex991.htm',
    },
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
    const proposedMatchesBefore = row.ultimateParentOnly
      ? before.ultimateParent === row.ultimateParent
      : before.acquirer_display === row.acquirerDisplay && before.ultimateParent === row.ultimateParent;
    const hasProposal = row.ultimateParentOnly ? !!row.ultimateParent : !!(row.acquirerDisplay || row.ultimateParent);
    const willWrite = !row.verify && hasProposal && !proposedMatchesBefore;
    return { ...row, found: true, dealId: deal.id, before, willWrite, noOpAlreadyCorrect: !row.verify && hasProposal && proposedMatchesBefore };
  });
}

function planValue(deals) {
  return VALUE_ROWS.map((row) => {
    const deal = findDeal(deals, row.idPrefix);
    if (!deal) return { ...row, found: false, willWrite: false };
    const before = { value_usd: deal.value_usd, value_provenance: (deal.metadata || {}).value_provenance };
    // A resolved 'no_stated_value' determination (Superior) is itself a
    // confident, sourced write — value_usd stays null but the provenance
    // satisfies the ingest-qa `value` gate exactly like a numeric write.
    const resolved = !row.verify && (typeof row.valueUsd === 'number' || (row.provenance && row.provenance.kind === 'no_stated_value'));
    return { ...row, found: true, dealId: deal.id, before, willWrite: resolved };
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
    const tag = r.verify ? 'VERIFY — NEVER WRITTEN' : (r.willWrite ? 'WILL WRITE' : (r.noOpAlreadyCorrect ? 'no-op — ALREADY CORRECT' : 'no-op'));
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
    if (r.sourceUrl) console.log(`  source_url: ${r.sourceUrl}`);
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
      console.log(`  after:  value_usd=${fmtUsd(r.valueUsd)} (${fmt(r.valueUsd)}) value_provenance.kind=${r.provenance.kind}`);
      console.log(`  note:   ${r.provenance.note}`);
      if (r.provenance.sourceUrl) console.log(`  source: ${r.provenance.sourceUrl}`);
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
    const value_provenance = {
      kind: r.provenance.kind,
      set_at: new Date().toISOString(),
      set_by: 'scripts/backfill-deal-display.js (press-release sourced, SEC EX-99.1)',
      note: r.provenance.note,
      ...(r.provenance.sourceUrl ? { source_url: r.provenance.sourceUrl } : {}),
    };
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
