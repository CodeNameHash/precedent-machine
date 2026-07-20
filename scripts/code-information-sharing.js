#!/usr/bin/env node
/*
 * code-information-sharing.js — stamp the Ben-decided multi-field
 * information-sharing codebook (informationSharing, copiesScope,
 * bidderIdentity, ongoingUpdates, engagementNotice — see
 * INFORMATION_SHARING_GRADE / COPIES_SCOPE / BIDDER_IDENTITY_REQUIREMENT /
 * ONGOING_UPDATES_STANDARD / ENGAGEMENT_NOTICE_TIMING in lib/taxonomy.js)
 * onto each deal's NOSOL notice/disclosure provision.
 *
 * THIS SCRIPT IS A DELIVERY VEHICLE FOR HUMAN-REVIEWED CODING, not a
 * classifier. The per-deal values below were produced by a Fable corpus
 * pass over stored NOSOL notice/disclosure provision text (2026-07-20),
 * reviewed against the key language quoted in the CODING table below.
 * Nothing is re-derived at runtime — editing a value means editing the
 * CODING table, on purpose, with the provision text in front of you.
 *
 * Field semantics (Ben's codebook, see lib/taxonomy.js for full prose):
 *   informationSharing  TERMS_AND_COPIES / TERMS_ONLY / NOTICE_ONLY
 *   copiesScope          UNREDACTED / UNSPECIFIED / REDACTION_PERMITTED
 *                         (only meaningful under TERMS_AND_COPIES)
 *   bidderIdentity        REQUIRED / CARVEOUT / NOT_REQUIRED
 *   ongoingUpdates        DEADLINE / REASONABLY_INFORMED / ON_REQUEST / NONE
 *   engagementNotice      ADVANCE / PROMPT_AFTER (omitted where the corpus
 *                         pass could not establish it from stored text —
 *                         never default-guessed)
 *
 * financingDocsIncluded is NOT part of this codebook — it rides the
 * pre-existing infoRequiredFinancingPapers boolean.
 *
 * Decks the corpus pass could not classify (provision present but the
 * receipt-notice/disclosure text was absent from stored cards, or no cards
 * file at all) are listed in UNRESOLVED and skipped with a printed reason
 * — never guessed.
 *
 * Placement (three tiers, logged per deal):
 *   1. QUOTE_CONTAINMENT     a candidate NOSOL row whose full_text contains
 *                            the CODING entry's keyQuote (verbatim
 *                            substring, whitespace-normalized) — preferred,
 *                            because it is the row the coding was read FROM.
 *   2. NOSOL_NOTICE_DISCLOSE fallback to a row coded NOSOL-NOTICE or
 *                            NOSOL-DISCLOSE for the deal.
 *   3. SOLICITATION_HEAD     fallback to the deal's solicitation-prohibition
 *                            head row (NOSOL-PROHIBIT, else the bare NOSOL
 *                            type) — logged distinctly since it is the
 *                            weakest-evidenced placement.
 *
 * Usage (Ben's machine, .env.local present):
 *   node scripts/code-information-sharing.js            # dry run
 *   node scripts/code-information-sharing.js --apply    # write the changes
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
const {
  INFORMATION_SHARING_GRADE,
  COPIES_SCOPE,
  BIDDER_IDENTITY_REQUIREMENT,
  ONGOING_UPDATES_STANDARD,
  ENGAGEMENT_NOTICE_TIMING,
} = require('../lib/taxonomy');

const APPLY = process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// REVIEWED CODING TABLE (Fable corpus pass, 2026-07-20). deal_id -> field
// values + the key notice/disclosure language the values rest on. Ben
// reviews the full quote table before running --apply.
//
// Defaults applied when a field is not explicitly given below:
//   bidderIdentity:   REQUIRED
//   ongoingUpdates:   REASONABLY_INFORMED
//   engagementNotice: omitted entirely (never default-guessed)
//   copiesScope:      only set when informationSharing === TERMS_AND_COPIES
// ---------------------------------------------------------------------------
const CODING = {
  '0a043659-68fb-4d20-98e6-b926aa758799': {
    dealName: 'Silver Lake / Endeavor',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'shall provide the Parent Entities with unredacted copies of any written requests, proposals or offers, including proposed agreements',
  },
  '13894e33-b5b6-4412-96bb-940b841d5130': {
    dealName: 'IonQ / SkyWater Technology',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    keyQuote: 'provide to Parent complete unredacted copies of all written correspondence or communications',
  },
  '1dfb11d5-99d3-4f2b-8229-6e61e8af2eea': {
    dealName: 'Apollo Global Management / Bridge Investment Group',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    keyQuote: 'unredacted copies of all writings or media (whether or not electronic) containing any terms or conditions of any Acquisition Proposal',
  },
  '1e4b7102-7890-451a-b8d0-8357120fc371': {
    dealName: 'Sekisui House / MDC Holdings',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    engagementNotice: 'PROMPT_AFTER',
    keyQuote: 'unredacted copies of all material written requests, proposals, offers, or agreements received by the Company relating to such Acquisition Proposal',
  },
  '2b9a6571-6fe7-4aac-931d-a96ab227ea43': {
    dealName: 'IBM / Red Hat',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'provide Parent (or its outside legal counsel) with unredacted copies of all writings or media (whether or not electronic) containing any terms or conditions of any proposals or proposed transaction agreements',
  },
  '2c143f44-6aa9-40d9-a92f-30d48aa603fd': {
    dealName: 'Amazon / Whole Foods Market',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    keyQuote: 'complete copies of any written request, inquiry, proposal, indication of interest or offer, including proposed agreements and any other written communications',
  },
  '8cd0787f-4ca0-40fe-aebf-6f88c0b101da': {
    dealName: 'Rocket Companies / Mr. Cooper Group',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'ON_REQUEST',
    keyQuote: 'to the extent requested by Cavalier, keep Cavalier reasonably and promptly informed of the status and material terms of',
  },
  'a1b07312-5ab1-4d6e-b173-6eccb5173d36': {
    dealName: 'Hewlett Packard Enterprise / Juniper Networks',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    engagementNotice: 'ADVANCE',
    keyQuote: 'the Company has provided Parent with the identity of the Third Party making the Acquisition Proposal, the terms and conditions thereof and an unredacted copy of any written materials, proposals or agreements received',
  },
  'b57d0d65-d9d6-4e77-8e2e-08da4eb58f81': {
    dealName: 'Rocket Companies / Redfin',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    keyQuote: 'provide Parent with unredacted copies of all writings or media containing any material terms or conditions of any such Acquisition Proposal or Acquisition Inquiry',
  },
  'c7c16365-c9cf-4bfb-93a6-1575084d717c': {
    dealName: 'Heinz / Kraft',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'provide to Heinz (x) an unredacted copy of any such Takeover Proposal made in writing (including any financing commitments or other agreements related thereto)',
  },
  'dc042001-b987-404f-bd02-41e1939fb914': {
    dealName: 'Chevron / Anadarko',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'provide to Parent unredacted copies of all material correspondence and written materials (whether or not electronic) sent or provided to the Company',
  },
  'eee4f270-4f7b-48b8-a66d-4d1a0ddc82d7': {
    dealName: 'Merck / Prometheus',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'provide Parent with unredacted copies of all writings or media containing any material terms or conditions of any such proposals and any proposed transaction agreements',
  },
  'f9c61065-a935-42a3-bc90-2f5a76670191': {
    dealName: 'Brookfield Asset Management / Forest City',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'an unredacted copy of an Acquisition Proposal or such other proposal or offer or, where such Acquisition Proposal, offer or proposal is not in writing, a description of the material terms thereof',
  },
  'fc03e7e3-e9ca-4936-bb9a-282a6276783a': {
    dealName: 'Quikrete / Summit Materials',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    bidderIdentity: 'CARVEOUT',
    ongoingUpdates: 'DEADLINE',
    keyQuote: 'keep Parent reasonably informed on a reasonably current basis (but in no event less often than once every 24 hours) of any changes',
  },
  '885edae5-49e8-464a-9f33-edd229119d7c': {
    dealName: 'Pfizer / Metsera',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNREDACTED',
    ongoingUpdates: 'DEADLINE',
    engagementNotice: 'PROMPT_AFTER',
    keyQuote: 'a correct and complete copy of such Company Takeover Proposal, inquiry or request',
  },

  '00d49e6a-3a99-4164-8417-76bf2713a3ec': {
    dealName: 'Verizon / Frontier Communications',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'shall provide the Parent Entities with unredacted copies of any written requests',
  },
  '320a3899-0d74-42d6-a412-3a962997d6ca': {
    dealName: 'Eli Lilly / Verve',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'together with copies of all material written proposals or offers related thereto, and the identity of the Person making any such inquiry or Acquisition Proposal',
  },
  '448e524f-19b0-4b5c-837b-7d5cabbc0fb0': {
    dealName: 'Shire / Dyax',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    bidderIdentity: 'NOT_REQUIRED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'indicating, in connection with such notice, the material terms and conditions of any proposal or offer (including, if applicable, copies of any written requests, proposals or offers, including proposed agreements)',
  },
  '4f015417-0845-406a-b6ea-e606faf37e46': {
    dealName: 'LabCorp / Covance',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'the other material terms and conditions of, any such Takeover Proposal (including, if applicable, copies of any written Takeover Proposal)',
  },
  '555579a6-6a11-45b3-9da9-43e1b49a6e89': {
    dealName: 'Sanofi / Bioverativ',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'any other written material that constitutes an Acquisition Proposal (or amendment thereto) including copies of any proposed Alternative Acquisition Agreements and any financing commitments related thereto',
  },
  '65a3e3c8-91e6-4075-bad0-4e3c4d1b43b9': {
    dealName: 'ENDRA Life Sciences / Renergen',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'NONE',
    keyQuote: 'enter into or continue any discussions, negotiations, or transactions with or respond to any inquiries or proposals by any other Person concerning any Acquisition Proposal or any Business Combination, except to inform such Person of the applicable Party\'s obligations under this Section 7.8',
  },
  '667447f0-ff25-4de2-a1b5-e5f099ecd366': {
    dealName: 'Oaktree-led lender group / Superior Industries',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'copies of all material written correspondence and other material written materials exchanged between or on behalf of the Company or its Subsidiaries or any of their Representatives',
  },
  '7dc3a05f-b170-4d59-a255-b7103cca16e1': {
    dealName: 'QXO / TopBuild',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'DEADLINE',
    engagementNotice: 'PROMPT_AFTER',
    keyQuote: 'on a daily basis at mutually agreeable times to be agreed in good faith by the parties',
  },
  'a267309a-fc22-4160-a652-1144fc64e9cf': {
    dealName: 'ConocoPhillips / Concho Resources',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    engagementNotice: 'ADVANCE',
    keyQuote: 'Parent shall notify the Company if Parent determines to begin providing information or to engage in discussions or negotiations concerning a Parent Competing Proposal, prior to providing any such information or engaging in any such discussions or negotiations',
  },
  'aad132ee-8a43-436d-b6a8-5604b7dfee01': {
    dealName: 'Stanley Martin Homes / United Homes Group',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'any other written material that constitutes an Acquisition Proposal (or amendment thereto) including copies of any proposed Alternative Acquisition Agreements',
  },
  'bf31d586-c0bc-4ed2-8d46-e69451a05756': {
    dealName: 'Sophos / SecureWorks',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'any written proposal, indication of interest (or amendment thereto) or any other written material that constitutes an Acquisition Proposal (or amendment thereto) including copies of any proposed Alternative Acquisition Agreements',
  },
  'c34415ed-44f7-432f-8d7c-6464b0310239': {
    dealName: 'AbbVie / Landos Biopharma',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'a copy of any written proposal or offer, or, if applicable, the proposed definitive agreement and all ancillary documentation',
  },
  'c750afb9-73fc-4043-a9d7-269506a6e00e': {
    dealName: 'Marriott / Starwood',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'which notice shall include a copy of the proposal and the identity of the person making such proposal',
  },
  'cf32899a-37c6-4147-8350-4a2e132a30db': {
    dealName: 'Goodyear / Cooper Tire',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'indicating the identity of the Person making the inquiry or proposal and the material terms of any such proposal, including copies of related written requests, offers or proposed contracts',
  },
  'df393645-86f4-4ae2-861e-35777e93583e': {
    dealName: 'Charter Communications / Cox Enterprises',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    engagementNotice: 'ADVANCE',
    keyQuote: 'Columbus shall have delivered to Cabot Parent a prior written notice advising Cabot Parent that it intends to take such action',
  },
  'bb5f062d-2818-4f9f-b968-ad9980445b6f': {
    dealName: 'Novo Holdings A/S / Catalent',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'UNSPECIFIED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'promptly (and, in any event within forty-eight (48) hours) provide to Parent a copy of such Acquisition Proposal or if such Acquisition Proposal is oral, then a summary of the material terms and conditions of any such Acquisition Proposal',
  },

  'dfaa71fa-9723-4794-825d-bd5024aa0b5d': {
    dealName: 'Global Net Lease / Modiv',
    informationSharing: 'TERMS_AND_COPIES',
    copiesScope: 'REDACTION_PERMITTED',
    ongoingUpdates: 'REASONABLY_INFORMED',
    engagementNotice: 'PROMPT_AFTER',
    keyQuote: 'providing copies of any written Company Acquisition Proposals or Inquiries and any proposed agreements related thereto, which may be redacted to the extent necessary to protect confidential information',
  },

  '0d38cc1f-2f49-47ee-bc21-de68d7884b90': {
    dealName: 'Zymeworks / Theravance Biopharma',
    informationSharing: 'TERMS_ONLY',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'thereafter shall keep Parent reasonably informed, on a reasonably current basis, of any material change to the terms of any such Acquisition Proposal and the status of any such discussions or negotiations',
  },
  'af4940e1-a645-437c-acfa-4a53e8d9f7ac': {
    dealName: '3G Capital / Skechers',
    informationSharing: 'TERMS_ONLY',
    bidderIdentity: 'CARVEOUT',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'unless, in each case, such disclosure is prohibited pursuant to the terms of any confidentiality agreement with such Person or "group" of Persons that is in effect on the date of this Agreement',
  },
  '86a01770-f565-47c5-8e7d-2a75a66b5e8b': {
    dealName: 'General Atlantic / European Wax Center',
    informationSharing: 'TERMS_ONLY',
    bidderIdentity: 'CARVEOUT',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'unless, in each case, such disclosure is prohibited pursuant to the terms of any confidentiality agreement with such Person or "group" of Persons that is in effect on the date of this Agreement',
  },
  'ce061fd0-a437-4d20-8a84-fdd6296aa5a0': {
    dealName: 'Restaurant Brands International / Carrols Restaurant Group',
    informationSharing: 'TERMS_ONLY',
    bidderIdentity: 'CARVEOUT',
    ongoingUpdates: 'REASONABLY_INFORMED',
    keyQuote: 'unless, in each case, such disclosure is prohibited pursuant to the terms of any confidentiality agreement with such Person or "group" of Persons that is in effect on the date of this Agreement',
  },
};

// Decks whose cached data shows a NOSOL notice/disclosure provision but the
// corpus pass could not read a gradeable value off stored text -- skipped,
// never guessed.
const UNRESOLVED = {
  '13211d88-4f16-4730-bb70-fb1ef6ab3735': 'General Atlantic & Stone Point / HireRight — receipt-notice / disclosure-of-terms paragraph not present in stored text (only the Intervening Event and litigation-notice provisions are stored)',
  '6369cc9c-3cb7-40b6-9227-2b9b0361c2a3': 'General Dynamics / CSRA — receipt-notice paragraph not in stored text (only Transaction Litigation notice is stored)',
  '1f80bec7-294b-4590-b861-2c156e75aadc': 'Bain Capital / Envestnet — receipt notice absent; only the ARC-stage (Intervening Event / Superior Proposal) notice provisions are stored',
  'ad35e712-a0c1-4fd4-a1fe-9aac5ce13e56': 'Gilead Sciences / Pharmasset — no cached cards file for this deal in the 2026-07-20 corpus pass',
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

const NOSOL_RE = /no[\s_-]*sol|NOSOL|COVENANT_NO_SOLICITATION/i;
const NOSOL_NOTICE_DISCLOSE_RE = /NOSOL-NOTICE|NOSOL-DISCLOSE/i;
const NOSOL_PROHIBIT_RE = /NOSOL-PROHIBIT/i;

// Three-tier placement, in preference order. Returns { row, tier } or null.
function placeRow(candidates, entry) {
  const byQuote = candidates.find((p) => containsQuote(p.full_text, entry.keyQuote));
  if (byQuote) return { row: byQuote, tier: 'QUOTE_CONTAINMENT' };

  const byCode = candidates.find((p) => NOSOL_NOTICE_DISCLOSE_RE.test(String(p.type || ''))
    || NOSOL_NOTICE_DISCLOSE_RE.test(String(p.category || '')));
  if (byCode) return { row: byCode, tier: 'NOSOL_NOTICE_DISCLOSE' };

  const byHead = candidates.find((p) => NOSOL_PROHIBIT_RE.test(String(p.type || ''))
    || NOSOL_PROHIBIT_RE.test(String(p.category || '')))
    || candidates[0];
  if (byHead) return { row: byHead, tier: 'SOLICITATION_HEAD' };

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
  const tierCounts = { QUOTE_CONTAINMENT: 0, NOSOL_NOTICE_DISCLOSE: 0, SOLICITATION_HEAD: 0 };
  for (const [dealId, entry] of Object.entries(CODING)) {
    const candidates = provisions.filter((p) => p.deal_id === dealId
      && (NOSOL_RE.test(String(p.type || '')) || NOSOL_RE.test(String(p.category || ''))));
    if (!candidates.length) {
      console.warn(`SKIP ${entry.dealName} (${dealId.slice(0, 8)}): no NOSOL row found for this deal`);
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

  console.log(`\nplacement tiers: ${JSON.stringify(tierCounts)}`);
  console.log(`planned writes: ${plan.length} provisions${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);

  for (const e of plan) {
    const f = e.meta.features || {};
    console.log(`\n${e.entry.dealName} (${e.p.deal_id})`);
    console.log(`  ${e.p.id} [${e.p.type}] placement=${e.tier}`);
    console.log(`    informationSharing: ${f.informationSharing ? f.informationSharing.code : '(none)'} -> ${e.entry.informationSharing}`);
    console.log(`    copiesScope:        ${f.copiesScope ? f.copiesScope.code : '(none)'} -> ${e.entry.copiesScope || '(not set)'}`);
    console.log(`    bidderIdentity:     ${f.bidderIdentity ? f.bidderIdentity.code : '(none)'} -> ${e.entry.bidderIdentity || 'REQUIRED (default)'}`);
    console.log(`    ongoingUpdates:     ${f.ongoingUpdates ? f.ongoingUpdates.code : '(none)'} -> ${e.entry.ongoingUpdates || 'REASONABLY_INFORMED (default)'}`);
    console.log(`    engagementNotice:   ${f.engagementNotice ? f.engagementNotice.code : '(none)'} -> ${e.entry.engagementNotice || '(omitted — not established)'}`);
  }

  if (!APPLY) return;
  let written = 0;
  for (const e of plan) {
    const meta = e.meta;
    meta.features = meta.features || {};
    meta.features.informationSharing = taggedValue(INFORMATION_SHARING_GRADE, 'INFORMATION_SHARING_GRADE', e.entry.informationSharing);
    if (e.entry.copiesScope) {
      meta.features.copiesScope = taggedValue(COPIES_SCOPE, 'COPIES_SCOPE', e.entry.copiesScope);
    }
    meta.features.bidderIdentity = taggedValue(BIDDER_IDENTITY_REQUIREMENT, 'BIDDER_IDENTITY_REQUIREMENT', e.entry.bidderIdentity || 'REQUIRED');
    meta.features.ongoingUpdates = taggedValue(ONGOING_UPDATES_STANDARD, 'ONGOING_UPDATES_STANDARD', e.entry.ongoingUpdates || 'REASONABLY_INFORMED');
    if (e.entry.engagementNotice) {
      meta.features.engagementNotice = taggedValue(ENGAGEMENT_NOTICE_TIMING, 'ENGAGEMENT_NOTICE_TIMING', e.entry.engagementNotice);
    }
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
