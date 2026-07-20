#!/usr/bin/env node
/*
 * code-appraisal-rights.js — stamp the Ben-decided appraisal-rights
 * codebook (appraisalRightsStatus — see APPRAISAL_RIGHTS_STATUS in
 * lib/taxonomy.js) onto each deal's CONSID-DISSENT provision (or, where the
 * agreement drafts the appraisal clause into the share-conversion /
 * exchange mechanics rather than a standalone section — e.g. Heinz/Kraft
 * Sec. 2.01(c) — the CONSID-CONVERT / CONSID-EXCHANGE provision carrying
 * that text).
 *
 * THIS SCRIPT IS A DELIVERY VEHICLE FOR HUMAN-REVIEWED CODING, not a
 * classifier. The per-deal values below were produced by a Fable corpus
 * pass over stored provision text (2026-07-20) across 40 decks, reviewed
 * against the key language quoted in the CODING table below. Nothing is
 * re-derived at runtime — editing a value means editing the CODING table,
 * on purpose, with the provision text in front of you.
 *
 * Field semantics (Ben's codebook, see lib/taxonomy.js for full prose):
 *   appraisalRightsStatus
 *     AVAILABLE      affirmative provision-for language: dissenting-shares
 *                     carve-out mechanics, a defined "Dissenting Shares" /
 *                     "Appraisal Shares" term, and/or express statutory
 *                     procedures (DGCL Sec. 262, Cayman Sec. 238, TBOC Ch.
 *                     10 Subch. H, MGCL).
 *     NOT_AVAILABLE   an express negative statement ("No appraisal rights
 *                     shall be available ..."). Ben's two anchor examples:
 *                     Heinz/Kraft Sec. 2.01(c) and ENDRA/Renergen Sec. 3.5.
 *     SILENT          no appraisal/dissent language found anywhere in the
 *                     stored provisions, for a deal whose structure does
 *                     NOT make appraisal near-certain (see UNRESOLVED
 *                     below for the opposite case).
 *
 * IMPORTANT — this codebook captures what the AGREEMENT says, not the
 * statutory answer. Delaware Sec. 262(b)(2)'s market-out exception can
 * eliminate STATUTORY appraisal for stock-for-stock mergers of listed
 * companies regardless of what the agreement's own boilerplate dissenting-
 * shares mechanics say (and those mechanics are near-universal boilerplate
 * precisely because they only matter if the market-out conditions are not
 * met at closing). Do not infer the statutory answer from this field, and
 * do not infer this field from the statutory answer.
 *
 * Decks where the corpus pass found NO appraisal/dissent language in any
 * stored provision are handled two ways:
 *   - If the deal's structure makes appraisal near-certain (a merger — not
 *     an asset purchase — of a public company, at a scale where the
 *     agreement would ordinarily address it) yet nothing is stored, the
 *     deck is UNRESOLVED (stored-data gap), never guessed into SILENT.
 *   - Genuine SILENT (agreement actually has no appraisal language) does
 *     not occur in this corpus pass; every deck with cached cards either
 *     has appraisal language or falls into the UNRESOLVED near-certain
 *     bucket above. The SILENT code is kept in the taxonomy dict as the
 *     honest floor value for a future deck that turns out to actually be
 *     silent (e.g. an asset purchase or non-merger structure with no
 *     dissenting-shares provision of any kind) — it is not asserted here.
 *
 * Placement (three tiers, logged per deal):
 *   1. CONSID_DISSENT       a candidate row typed/coded CONSID-DISSENT for
 *                           the deal — preferred, the standalone section.
 *   2. QUOTE_CONTAINMENT    fallback: a CONSID-type row (CONSID-CONVERT,
 *                           CONSID-EXCHANGE, or any other CONSID-* code)
 *                           whose full_text contains the CODING entry's
 *                           keyQuote (verbatim substring, whitespace-
 *                           normalized) — the drafting-embeds-it-inline
 *                           pattern (Heinz/Kraft Sec. 2.01(c)).
 *   3. CONSID_HEAD          fallback to the deal's CONSID-CONVERT row (the
 *                           near-universal share-conversion section), else
 *                           any CONSID-type row for the deal — logged
 *                           distinctly since it is the weakest-evidenced
 *                           placement.
 * Decks with no CONSID-type row at all are skipped as UNPLACED with a
 * printed reason — never invented an anchor.
 *
 * Usage (Ben's machine, .env.local present):
 *   node scripts/code-appraisal-rights.js            # dry run
 *   node scripts/code-appraisal-rights.js --apply    # write the changes
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
const { APPRAISAL_RIGHTS_STATUS } = require('../lib/taxonomy');

const APPLY = process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// REVIEWED CODING TABLE (Fable corpus pass, 2026-07-20). deal_id -> status +
// the key appraisal/dissent language the value rests on. Ben reviews the
// full quote table before running --apply.
// ---------------------------------------------------------------------------
const CODING = {
  '00d49e6a-3a99-4164-8417-76bf2713a3ec': {
    dealName: 'Verizon / Frontier Communications',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'shares of Company Common Stock that are outstanding immediately prior to the Effective Time and that are held by any Person who is entitled to demand and properly demands appraisal of such shares pursuant to, and who complies in all respects with, Section 262 of the DGCL',
  },
  '0a043659-68fb-4d20-98e6-b926aa758799': {
    dealName: 'Silver Lake / Endeavor',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares that are outstanding immediately prior to the Company Merger Effective Time and that are held by stockholders who shall have neither voted in favor of the Company Merger nor consented thereto in writing and who shall have demanded, properly in writing, appraisal for such Shares in accordance with',
  },
  '0d38cc1f-2f49-47ee-bc21-de68d7884b90': {
    dealName: 'Zymeworks / Theravance Biopharma',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Dissenting Shares. The Company shall give Parent (i) prompt notice of any written notice of exercise of Dissenter Rights',
  },
  '13894e33-b5b6-4412-96bb-940b841d5130': {
    dealName: 'IonQ / SkyWater Technology',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'shares of Company Common Stock (other than Cancelled Shares) that are outstanding immediately prior to the Effective Time and that are held by any Person who is entitled to demand and properly demands appraisal of such shares pursuant to, and who complies in all respects with, Section 262 of the DGCL',
  },
  '1e4b7102-7890-451a-b8d0-8357120fc371': {
    dealName: 'Sekisui House / MDC Holdings',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'each Share outstanding immediately prior to the Effective Time (other than Shares to be cancelled or converted pursuant to Section 2.1(b)) and held by a holder who is entitled to demand and has properly and validly demanded appraisal for such Shares in accordance with, and who complies in all respects with, Section 262 of the DGCL',
  },
  '1f80bec7-294b-4590-b861-2c156e75aadc': {
    dealName: 'Bain Capital / Envestnet',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Dissenting Shares outstanding immediately prior to the Effective Time shall not be converted into the right to receive Merger Consideration, but shall, by virtue of the Merger, be entitled to only such consideration as shall be determined pursuant to Section 262 of the DGCL',
  },
  '320a3899-0d74-42d6-a412-3a962997d6ca': {
    dealName: 'Eli Lilly / Verve',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares outstanding immediately prior to the Effective Time and held by a holder who is entitled to demand and properly exercised and perfected their respective demands for appraisal for such Shares in accordance with Section 262 of the DGCL',
  },
  '448e524f-19b0-4b5c-837b-7d5cabbc0fb0': {
    dealName: 'Shire / Dyax',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares that are owned by stockholders ("Dissenting Stockholders") who have perfected and not withdrawn a',
  },
  '4f015417-0845-406a-b6ea-e606faf37e46': {
    dealName: 'LabCorp / Covance',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Notwithstanding anything in this Agreement to the contrary, shares (the "Appraisal Shares") of Company Common Stock issued and outs',
  },
  '667447f0-ff25-4de2-a1b5-e5f099ecd366': {
    dealName: 'Oaktree-led lender group / Superior Industries',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: "Dissenters' Rights. Notwithstanding anything to the contrary herein, no Dissenting Stockholder shall be entitled to receive cash pursuant to the provisions of this ARTICLE III unless and until such Dissenting Stockholder shall have failed to perfect or shall have effectively withdrawn, waived or lost such Dissenting Stockholder's right to appraisal under the DGCL",
  },
  '86a01770-f565-47c5-8e7d-2a75a66b5e8b': {
    dealName: 'General Atlantic / European Wax Center',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'properly and validly exercised their statutory rights of appraisal in respect of such shares of Company Common Stock in accordance with Section 262 of the DGCL (the "Dissenting Company Shares")',
  },
  '885edae5-49e8-464a-9f33-edd229119d7c': {
    dealName: 'Pfizer / Metsera',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'shares of Company Common Stock that are outstanding immediately prior to the Effective Time and that are held by any Person who is entitled to demand and properly demands appraisal of such shares pursuant to, and who complies in all respects with, Section 262 of the DGCL ("Section 262") (such shares, "Appraisal Shares")',
  },
  'aad132ee-8a43-436d-b6a8-5604b7dfee01': {
    dealName: 'Stanley Martin Homes / United Homes Group',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares issued and outstanding immediately prior to the Effective Time (other than Shares canceled pursuant to Section 2.03(b), Section 2.03(c) or Section 2.03(d)) and held by a holder who is entitled to demand appraisal and who has properly demanded appraisal of such Shares in accordance with Section 262 of the DGCL',
  },
  'bb5f062d-2818-4f9f-b968-ad9980445b6f': {
    dealName: 'Novo Holdings A/S / Catalent',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'is entitled to demand and properly demands appraisal of such Share, as applicable (a "Dissenting Share"), pursuant to, and who has properly exercised and perfected his or her demand for appraisal rights under and complies in all respects with, Section 262 of the DGCL (the "Appraisal Rights")',
  },
  'bf31d586-c0bc-4ed2-8d46-e69451a05756': {
    dealName: 'Sophos / SecureWorks',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares issued and outstanding immediately prior to the Effective Time (other than Shares cancelled pursuant to Section 2.03(b), Section 2.03(c) or Section 2.03(d)) and held by a holder who is entitled to demand appraisal and who has properly demanded appraisal of such Shares in accordance with Section 262 of the DGCL',
  },
  'c34415ed-44f7-432f-8d7c-6464b0310239': {
    dealName: 'AbbVie / Landos Biopharma',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'is entitled to demand and properly demands appraisal of such Share, as applicable (a "Dissenting Share"), pursuant to, and who has properly exercised and perfected his or her demand for appraisal rights under and complies in all respects with, Section 262 of the DGCL (the "Appraisal Rights")',
  },
  'ce061fd0-a437-4d20-8a84-fdd6296aa5a0': {
    dealName: 'Restaurant Brands International / Carrols Restaurant Group',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Parent will be kept apprised of proposed strategy and other significant decisions with respect to demands for appraisal pursuant to the DGCL in respect of Dissenting Company Shares',
  },
  'cf32899a-37c6-4147-8350-4a2e132a30db': {
    dealName: 'Goodyear / Cooper Tire',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: "Dissenters' Rights. Shares that have not been voted for adoption of this Agreement and with respect to which appraisal has been properly demanded in accordance with Section 262 of the DGCL",
  },
  'dc042001-b987-404f-bd02-41e1939fb914': {
    dealName: 'Chevron / Anadarko',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'with respect to each share of Company Common Stock as to which the holder thereof shall have properly complied with the provisions of Section 262 of the DGCL as to appraisal rights (each, a "Dissenting Share")',
  },
  '13211d88-4f16-4730-bb70-fb1ef6ab3735': {
    dealName: 'General Atlantic & Stone Point / HireRight',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'shall have properly and validly exercised their statutory rights of appraisal in respect of such shares of Company Common Stock in accordance with Section 262 of the DGCL (the "Dissenting Company Shares")',
  },
  'a1b07312-5ab1-4d6e-b173-6eccb5173d36': {
    dealName: 'Hewlett Packard Enterprise / Juniper Networks',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'held by a holder who did not vote in favor of the adoption of this Agreement (or consent thereto in writing) and is entitled to demand and has properly exercised appraisal rights in respect of such Shares in accordance with Section 262 of the DGCL',
  },
  'eee4f270-4f7b-48b8-a66d-4d1a0ddc82d7': {
    dealName: 'Merck / Prometheus',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Certificates representing, and Book-Entry Shares that constitute, Dissenting Company Shares, which shall be deemed to represent the right to receive payment in accordance with and to the extent provided by Section 262 of the DGCL',
  },
  '2b9a6571-6fe7-4aac-931d-a96ab227ea43': {
    dealName: 'IBM / Red Hat',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: '(other than (i) Canceled Shares, (ii) Dissenting Shares, and (iii) Subsidiary Converted Shares) shall be converted into the right to receive $190.00 in cash',
  },
  '555579a6-6a11-45b3-9da9-43e1b49a6e89': {
    dealName: 'Sanofi / Bioverativ',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'shall not be converted into a right to receive the Per Share Amount but instead shall be entitled only to such rights as are granted by the DGCL to a holder of Dissenting Shares',
  },
  '2c143f44-6aa9-40d9-a92f-30d48aa603fd': {
    dealName: 'Amazon / Whole Foods Market',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Shares that are owned by shareholders of the Company who have complied with the applicable provisions of Chapter 10, Subchapter H of the TBOC prior to the Effective Time',
  },
  '7dc3a05f-b170-4d59-a255-b7103cca16e1': {
    dealName: 'QXO / TopBuild',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'Cancelled Shares") and (C) Dissenting Shares) shall be automatically converted into the right to receive, and become exchangeable for either',
  },
  'af4940e1-a645-437c-acfa-4a53e8d9f7ac': {
    dealName: '3G Capital / Skechers',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: 'each share of Company Common Stock that is outstanding as of immediately prior to the Effective Time (other than Owned Company Shares or Dissenting Company Shares) will be cancelled and extinguished and automatically converted into the right to receive the following consideration',
  },
  'fc03e7e3-e9ca-4936-bb9a-282a6276783a': {
    dealName: 'Quikrete / Summit Materials',
    appraisalRightsStatus: 'AVAILABLE',
    keyQuote: "shall have properly and validly demanded their statutory rights of appraisal in respect of such Company Common Shares in accordance with Section 262 of the DGCL (the \"Dissenting Company Shares\") will not be converted into, or represent the right to receive, the Merger Consideration",
  },

  '65a3e3c8-91e6-4075-bad0-4e3c4d1b43b9': {
    dealName: 'ENDRA Life Sciences / Renergen',
    appraisalRightsStatus: 'NOT_AVAILABLE',
    keyQuote: "No Dissenters' Rights. No appraisal rights shall be available with respect to the Merger Sub Units or the Company Units in connection with the Transactions.",
  },
  'a267309a-fc22-4160-a652-1144fc64e9cf': {
    dealName: 'ConocoPhillips / Concho Resources',
    appraisalRightsStatus: 'NOT_AVAILABLE',
    keyQuote: 'No Appraisal Rights. In accordance with the DGCL, no appraisal rights shall be available with respect to the Transactions.',
  },
  'dfaa71fa-9723-4794-825d-bd5024aa0b5d': {
    dealName: 'Global Net Lease / Modiv',
    appraisalRightsStatus: 'NOT_AVAILABLE',
    keyQuote: "Dissenters' Rights.  No dissenters' or appraisal rights shall be available with respect to the Mergers.",
  },
  'f9c61065-a935-42a3-bc90-2f5a76670191': {
    dealName: 'Brookfield Asset Management / Forest City',
    appraisalRightsStatus: 'NOT_AVAILABLE',
    keyQuote: "No Dissenters' or Appraisal Rights. No dissenters' or appraisal rights will be available with respect to the Merger and the other Transactions, including any remedy under Sections 3-201 et seq. of the MGCL.",
  },
  'c7c16365-c9cf-4bfb-93a6-1575084d717c': {
    dealName: 'Heinz / Kraft',
    appraisalRightsStatus: 'NOT_AVAILABLE',
    keyQuote: 'Appraisal\nRights. No appraisal rights shall be available to the holders of Kraft Common Stock in connection with the Merger.',
  },
};

// Decks the corpus pass could not classify with confidence -- either no
// appraisal/dissent language was found anywhere in the stored provisions
// for a deal whose structure makes appraisal near-certain (a merger, not an
// asset purchase, of a public company at a scale where the agreement would
// ordinarily address it) -- a stored-data gap, never guessed into SILENT --
// or no cached provisions exist for the deal at all.
const UNRESOLVED = {
  'c750afb9-73fc-4043-a9d7-269506a6e00e': 'Marriott / Starwood — double-dummy merger, $12.2B, mixed-election consideration; no dissenting-shares/appraisal-rights provision or definition found in stored cards despite CONSID-EXCHANGE and other CONSID provisions being present. Appraisal treatment is near-certain for a public-company merger at this scale; stored-data gap, not agreement silence.',
  'df393645-86f4-4ae2-861e-35777e93583e': 'Charter Communications / Cox Enterprises — $34.5B, structured as an asset purchase but with a stockholder-vote closing condition (COND-M-STOCKHOLDER) present; no CONSID-CONVERT card and no appraisal/dissent language anywhere in the stored 626-card set. Genuinely ambiguous whether appraisal mechanics are inapplicable (asset deal) or a stored-data gap — not guessed either way.',
  '8cd0787f-4ca0-40fe-aebf-6f88c0b101da': 'Rocket Companies / Mr. Cooper Group — STOCK consideration, DOUBLE_DUMMY merger of two public companies; no dissenting-shares/appraisal-rights language anywhere in stored cards. Near-certain for a public-company stock merger at this scale; stored-data gap.',
  'b57d0d65-d9d6-4e77-8e2e-08da4eb58f81': 'Rocket Companies / Redfin — MIXED consideration, REVERSE_TRIANGULAR_MERGER of a Delaware public target; no dissenting-shares/appraisal-rights language anywhere in stored cards. Near-certain; stored-data gap.',
  '1dfb11d5-99d3-4f2b-8229-6e61e8af2eea': 'Apollo Global Management / Bridge Investment Group — STOCK consideration, DOUBLE_DUMMY merger of a public company; no dissenting-shares/appraisal-rights language anywhere in stored cards. Near-certain; stored-data gap.',
  '6369cc9c-3cb7-40b6-9227-2b9b0361c2a3': 'General Dynamics / CSRA — CASH consideration, two-step tender offer + back-end merger (Top-Up Option present); no dissenting-shares/appraisal-rights language anywhere in stored cards. Near-certain for a cash acquisition of a public target; stored-data gap.',
  'ad35e712-a0c1-4fd4-a1fe-9aac5ce13e56': 'Gilead Sciences / Pharmasset — no cached cards file for this deal in the 2026-07-20 corpus pass.',
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

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Verbatim substring containment, whitespace-normalized so line wraps /
// double spaces in stored full_text don't defeat an otherwise-exact match.
function containsQuote(fullText, quote) {
  if (!fullText || !quote) return false;
  return normSpace(fullText).toLowerCase().includes(normSpace(quote).toLowerCase());
}

const CONSID_RE = /^CONSID/i;
const CONSID_DISSENT_RE = /CONSID-DISSENT/i;
const CONSID_CONVERT_RE = /CONSID-CONVERT/i;

// Three-tier placement, in preference order. Returns { row, tier } or null.
function placeRow(candidates, entry) {
  const byDissent = candidates.find((p) => CONSID_DISSENT_RE.test(String(p.type || ''))
    || CONSID_DISSENT_RE.test(String(p.category || '')));
  if (byDissent) return { row: byDissent, tier: 'CONSID_DISSENT' };

  const byQuote = candidates.find((p) => containsQuote(p.full_text, entry.keyQuote));
  if (byQuote) return { row: byQuote, tier: 'QUOTE_CONTAINMENT' };

  const byConvert = candidates.find((p) => CONSID_CONVERT_RE.test(String(p.type || ''))
    || CONSID_CONVERT_RE.test(String(p.category || '')))
    || candidates[0];
  if (byConvert) return { row: byConvert, tier: 'CONSID_HEAD' };

  return null;
}

function taggedValue(dict, dictName, code) {
  if (!code) return null;
  const label = dict[code];
  if (!label) throw new Error(`CODING value ${code} not in ${dictName}`);
  return { code, label, text: code, quotes: [] };
}

async function main() {
  const sb = getServiceSupabase();
  if (!sb) { console.error('Supabase not configured (need .env.local)'); process.exit(1); }

  console.log(`reviewed codings: ${Object.keys(CODING).length} deals; unresolved (skipped): ${Object.keys(UNRESOLVED).length}`);
  for (const [dealId, reason] of Object.entries(UNRESOLVED)) {
    console.log(`  UNRESOLVED ${dealId.slice(0, 8)}: ${reason}`);
  }

  const provisions = await fetchAllRows(sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata')
    .in('deal_id', Object.keys(CODING))
    .order('id'));
  console.log(`\nprovisions loaded for coded deals: ${provisions.length}`);

  const plan = [];
  const tierCounts = { CONSID_DISSENT: 0, QUOTE_CONTAINMENT: 0, CONSID_HEAD: 0 };
  const statusCounts = { AVAILABLE: 0, NOT_AVAILABLE: 0, SILENT: 0 };
  for (const [dealId, entry] of Object.entries(CODING)) {
    statusCounts[entry.appraisalRightsStatus] = (statusCounts[entry.appraisalRightsStatus] || 0) + 1;
    const candidates = provisions.filter((p) => p.deal_id === dealId
      && (CONSID_RE.test(String(p.type || '')) || CONSID_RE.test(String(p.category || ''))));
    if (!candidates.length) {
      console.warn(`SKIP ${entry.dealName} (${dealId.slice(0, 8)}): no CONSID row found for this deal`);
      continue;
    }
    const placed = placeRow(candidates, entry);
    if (!placed) {
      console.warn(`SKIP ${entry.dealName} (${dealId.slice(0, 8)}): placement failed`);
      continue;
    }
    tierCounts[placed.tier] += 1;
    plan.push({ p: placed.row, tier: placed.tier, entry, meta: metaOf(placed.row) });
  }

  console.log(`\nstatus counts: ${JSON.stringify(statusCounts)}`);
  console.log(`placement tiers: ${JSON.stringify(tierCounts)}`);
  console.log(`planned writes: ${plan.length} provisions${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);

  for (const e of plan) {
    const f = e.meta.features || {};
    console.log(`\n${e.entry.dealName} (${e.p.deal_id})`);
    console.log(`  ${e.p.id} [${e.p.type}] placement=${e.tier}`);
    console.log(`    appraisalRightsStatus: ${f.appraisalRightsStatus ? f.appraisalRightsStatus.code : '(none)'} -> ${e.entry.appraisalRightsStatus}`);
  }

  if (!APPLY) return;
  let written = 0;
  for (const e of plan) {
    const meta = e.meta;
    meta.features = meta.features || {};
    meta.features.appraisalRightsStatus = taggedValue(
      APPRAISAL_RIGHTS_STATUS, 'APPRAISAL_RIGHTS_STATUS', e.entry.appraisalRightsStatus,
    );
    const { error } = await sb.from('provisions').update({ ai_metadata: meta }).eq('id', e.p.id);
    if (error) { console.error(`WRITE FAIL ${e.p.id}: ${error.message}`); process.exit(1); }
    written += 1;
  }
  console.log(`\nwrote ${written} provisions.`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { CODING, UNRESOLVED };
