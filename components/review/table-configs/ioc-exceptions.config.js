import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { belowThresholdLabel, cardCode, cardFeatures, cardType, textOf, triggerThresholdLabel, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';

const {
  EFFORTS_STANDARDS, EXCEPTION_CODES, IOC_AFFIRMATIVE_SCOPE_CODES, IOC_CATEGORY_CODES, MATERIALITY_CODES, labelForCode,
} = taxonomy;

// REBUILD-SPECS.md section 6 ("IOC" -- Ben: "a shit show"). Old shape was a
// Target/Buyer split of ONLY the general-exceptions preamble text; the other
// 20-odd IOC cards (the actual negative covenants, the affirmative limbs)
// were rendered nowhere on this table. New shape is the full 24-card IOC
// family, organized the way a lawyer reads Section 5.01 -- and in the same
// TOP-TO-BOTTOM order the old site used (IocAffirmativeCovenantsTable ahead
// of IocNegativeCovenantsTable; FEEDBACK-2-PUNCHLIST.md #29):
//   - the 3 affirmative limbs (IOC-ORDINARY/PRESERVE/MAINTAIN) FIRST, as
//     their own small "Affirmative covenants" band,
//   - one TERM|RESTRICTION row per NAMED negative covenant (grouped by
//     canonical code -- Metsera has 3 separate IOC-MERGE cards (the M&A /
//     dispositions / recapitalization covenant) that collapse into ONE row
//     with combined pills),
//   - the near-empty "[PROPOSED] Unclassified 5.01(i)-(o)" fragments (no
//     provision_subtype, so no covenant name) collapsed under a single
//     lowest-priority "Other restrictions" band instead of rendering as
//     empty rows,
//   - the section-wide General Exceptions preamble (IOC-GENERAL-EXCEPTIONS /
//     IOC-NEGATIVE-PREAMBLE) as a FOOTER strip, never per-row.
// mainObligation prose never dumps inline -- it always sits behind an
// always-collapsed "see text", mirroring conditions.config.js's
// clauseSeeText (the locked exemplar this file is patterned on).
//
// FEEDBACK-3-PUNCHLIST.md round-3 fixes applied here:
//   - I6 (STRUCT): each negative-covenant row is a real 3-column table --
//     General category (row label) | Specific restrictions
//     (restrictionComponents + dollarThreshold pills) | Exceptions
//     (permittedExceptions pills) -- instead of one cell cramming scope and
//     exceptions together. mainObligation prose stays behind "see text".
//   - I2/I4 (DATA): affirmative-limb pills now surface the limb's own
//     efforts_standard (deriveIocLimbEffortsStandard /
//     normalizeIocLimbEffortsStandards in lib/parser-v2/extract.js already
//     stamp exactly one such field per limb) as a coloured standard pill --
//     EXCEPT the FLAT case (an unqualified duty, e.g. "conduct its business
//     in the ordinary course"), which carries no efforts pill at all. When a
//     limb's own obligation text separately carries "in all material
//     respects" (IOC-MAINTAIN: FLAT efforts_standard, but the text itself
//     names a materiality standard), that phrase is pulled out and rendered
//     as its own coloured pill -- the two are independent signals and both
//     can be true, or neither.
//   - I3/I5 (COLOURING, G4 audit): the ordinary-course limb (efforts_standard
//     FLAT, no "material respects" text) never gets a `color` prop -- FLAT is
//     content ("this is a direct, unqualified duty"), not a graded standard,
//     and standardColorKey('FLAT') would otherwise false-positive on its
//     \bflat\b hell-or-high-water pattern. Every other IOC pill in this file
//     (restriction categories, thresholds, exceptions, scope) stays on plain
//     `tone`, never `color` -- only a genuine efforts/materiality STANDARD
//     earns a palette colour.
//   - I7 (DATA): the near-empty "[PROPOSED] Unclassified" fragments that
//     carry no restrictionComponents tag (real gap: no provision_subtype was
//     ever assigned, so the deterministic keyword-tagger never ran against
//     them) are named from their own primary_quote via sniffFragmentName()
//     instead of a bare "no structured signal extracted" placeholder --
//     Metsera's 5.01(k)/(l)/(o) are a tax covenant, a Specified-Contract
//     amendment restriction, and an insurance-maintenance covenant
//     respectively. Genuinely signal-free fragments still fall back to the
//     placeholder; none are ever dropped.
//   - I8 (FEEDBACK-4-PUNCHLIST.md, DATA): sniffFragmentName's keyword
//     patterns only covered 3 of the 8 unclassified 5.01(i)-(o) fragments.
//     resolveFragmentName() now resolves ALL 8 deterministically off each
//     card's own section_ref via SECTION_501_SUBCLAUSE_TITLES, falling back
//     to sniffFragmentName and then a quote-mined phrase for any 5.01
//     sub-clause letter outside the map -- the literal short_title
//     "[PROPOSED] Unclassified" is never the row's rendered name.

function isIocCard(card) {
  return cardType(card) === 'COVENANT_INTERIM_OPERATING' || /^IOC(?:-|$)/.test(cardCode(card));
}

// Container codes that carry the section-wide exceptions preamble (rendered
// as their own "Exceptions" band -- see buildIocExceptionsRows below -- never
// as a negative-covenant row) vs. the affirmative limbs (rendered as their
// own band, never as a negative-covenant row). Split into the POSITIVE side
// (the IOC intro / consolidated "General Exceptions" row -- the chapeau that
// precedes the affirmative duties) and the NEGATIVE side (the
// IOC-NEGATIVE-PREAMBLE lead-in to the enumerated restrictions) so the
// Exceptions band can tell whether the two sides carry the identical
// carve-out set (Metsera: both preambles list the same 4 codes --
// COMPANY_DISCLOSURE_LETTER / REQUIRED_BY_AGREEMENT / REQUIRED_BY_LAW /
// PRIOR_WRITTEN_CONSENT) or genuinely diverge.
const POSITIVE_EXCEPTION_CODES = new Set(['IOC-GENERAL-EXCEPTIONS', 'IOC-EXCEPTIONS', 'IOC-POSITIVE-PREAMBLE']);
const NEGATIVE_EXCEPTION_CODES = new Set(['IOC-NEGATIVE-PREAMBLE']);
const GENERAL_EXCEPTION_CODES = new Set([...POSITIVE_EXCEPTION_CODES, ...NEGATIVE_EXCEPTION_CODES]);
const AFFIRMATIVE_CODES = new Set([
  'IOC-ORDINARY', 'IOC-PRESERVE', 'IOC-MAINTAIN', 'IOC-NOACTION',
  'IOC-AFFIRMATIVE', 'IOC-OTHER-AFFIRMATIVE', 'IOC-POSITIVE-PREAMBLE',
]);

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

// Resolves a taxonomy-tagged list feature (permittedExceptions,
// restrictionComponents, appliesTo) into { code, label, evidence, source }
// entries. Handles both bare UPPER_SNAKE code strings (restrictionComponents,
// appliesTo) and tagged {code,label,text} objects (permittedExceptions is a
// LIST_TAXONOMY_KEY -- see lib/taxonomy.js).
function exceptionEntries(list, dict, card) {
  const arr = Array.isArray(list) ? list : (list !== null && list !== undefined && list !== '' ? [list] : []);
  return arr.map((item) => {
    const tagged = item && typeof item === 'object';
    const code = tagged ? String(item.code || '').toUpperCase() : String(item || '').toUpperCase();
    const dictLabel = code && dict ? labelForCode(code, dict) : null;
    const label = (tagged && item.label) || dictLabel || (!tagged ? String(item).trim() : null);
    if (!label) return null;
    const evidence = (tagged && item.text) || textOf(card);
    return { code: code || label, label, evidence, source: card };
  }).filter(Boolean);
}

function dedupeEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (!entry?.label) continue;
    const key = entry.code || entry.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

// dollarThreshold is a raw number/numeric-string on the card (Metsera
// 5.01(d): 2000000 -- the ONLY IOC card carrying one, per
// FEEDBACK-2-PUNCHLIST.md's DATA FINDINGS #25/#28: 0 canonical claims, the
// figure only ever landed in the claim's verbatim capture). Always renders
// as currency, never a bare numeral (parity with the IOC threshold fix
// elsewhere in the app -- table-logic.js's formatIocThresholdAmount).
//
// Bug fix (Heinz/Kraft "Settlement of Claims" live report, Ben): thresholds
// that carry TWO dollar amounts -- "$10,000,000 individually or
// $25,000,000 in the aggregate" -- used to fall into the old bare-Number()
// coercion below, which strips every non-digit character (including the
// space between the two figures) and CONCATENATES the two numerals into one
// fabricated number: "$1,000,000,025,000,000". A money pill must never
// fabricate a number. The numeral group in MONEY_RE is deliberately anchored
// digit...digit (\d(?:[\d,]*\d)?) rather than \d[\d,]* so a trailing comma
// right after the figure (QXO: "Below $10,000,000," -- the sentence's own
// comma, not part of the number) is never swept into the match.
const MONEY_RE = /\$\s?\d(?:[\d,]*\d)?(?:\.\d+)?\s*(?:million|billion)?/gi;

function normalizeMoneyMatch(text) {
  return String(text).replace(/\s+/g, ' ').trim().replace(/[,.;:]+$/, '');
}

function stripTrailingPunctuation(text) {
  return String(text).trim().replace(/[,.;:]+$/, '');
}

function formatMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    // Citable-wrapper shape { value: null, quotes: [...] } -- a verbatim-only
    // claim (no canonical numeral) still carries the figure inside its first
    // supporting quote. Try that before falling through to the other object
    // shapes (tagged {code,label,text}, legacy {amount}/{threshold}).
    if (Array.isArray(raw.quotes) && raw.quotes.length) {
      const fromQuote = formatMoney(raw.quotes[0]);
      if (fromQuote) return fromQuote;
    }
    return formatMoney(raw.value ?? raw.amount ?? raw.threshold ?? raw.text ?? null);
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? `$${raw.toLocaleString('en-US')}` : null;
  }
  const str = String(raw).trim();
  if (!str) return null;

  const matches = str.match(MONEY_RE);
  if (!matches || !matches.length) {
    // No `$` figure anywhere in the string -- the claims-adapter
    // (lib/queries/claims-adapter.js's buildRawValue) already falls back to
    // `claim.verbatim` when `claim.canonical` is null, so most verbatim-only
    // numbers arrive here as a clean bare numeral string ("2000000"); coerce
    // that the same way the old numeric path did.
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(num) && num > 0) return `$${num.toLocaleString('en-US')}`;
    return null;
  }
  if (matches.length === 1) return normalizeMoneyMatch(matches[0]);

  // Two dollar amounts: never concatenate them into one numeral. If the
  // surrounding text names each amount's role ("... individually or ... in
  // the aggregate"), render both amounts with plain-English roles -- Ben-
  // facing legal English, not a coder-speak dump of raw digits.
  if (matches.length === 2) {
    const individuallyIdx = str.search(/\bindividually\b/i);
    const aggregateIdx = str.search(/\bin the aggregate\b|\baggregate\b/i);
    if (individuallyIdx !== -1 && aggregateIdx !== -1) {
      const positions = [];
      const re = new RegExp(MONEY_RE.source, MONEY_RE.flags);
      let m;
      while ((m = re.exec(str))) positions.push({ text: m[0], index: m.index });
      const closestTo = (idx) => positions.reduce(
        (best, p) => (Math.abs(p.index - idx) < Math.abs(best.index - idx) ? p : best),
      );
      const indiv = closestTo(individuallyIdx);
      const agg = closestTo(aggregateIdx);
      if (indiv.index !== agg.index) {
        return `${normalizeMoneyMatch(indiv.text)} individually / ${normalizeMoneyMatch(agg.text)} in aggregate`;
      }
    }
  }

  // Two+ amounts with no resolvable role (or a role tie): fall back to the
  // quoted phrase itself, trimmed -- never a fabricated concatenated number.
  return stripTrailingPunctuation(str);
}

// `color` (a standard-colours.js palette key) is optional and additive to
// `tone` -- PillCell lets `color` win over `tone` for the chip's classes
// when both are given. Callers pass it ONLY for a genuine graded standard
// (I3/I5/G4 -- see the file-header note); every plain-fact pill in this file
// (restriction categories, thresholds, exceptions, appliesTo scope) omits it.
function pillFor(PillCell, keyId, label, tone, evidence, source, color, wrap) {
  if (!PillCell || !label) return null;
  const props = { key: keyId, label, tone, evidence, source };
  if (color) props.color = color;
  if (wrap) props.wrap = true;
  return React.createElement(PillCell, props);
}

// AC (raw code hidden, exposed only on hover) -- same convention as
// conditions.config.js's conditionLabelNode.
function covenantLabelNode(label, code) {
  return React.createElement('span', { title: code || undefined }, label);
}

// Party-scope bug (Ben, Cox/Charter live report): "No New Lines of
// Business" showed BOTH parties' clause text concatenated into ONE row --
// Cabot's (Target/Company side) "(xvi) engage in any business other than
// the Cabot Business..." AND Columbus's (Parent side) "(v) engage in any
// material business other than the business of Columbus...". Root cause:
// negativeCovenantGroups grouped by CODE ALONE, and IOC-* codes carry no
// party token (unlike REP-T-/REP-B-, COND-M-/COND-S-) -- store-cards also
// bakes party_scope to a uniform 'MUTUAL' default (see lib/party-scope.js),
// so neither the code nor the stored scope can tell Cabot's IOC-NEWLINE
// card apart from Columbus's IOC-NEWLINE card. On a two-party IOC deck
// (Cox/Charter mirrors each party's negative covenants under its OWN
// numbered section -- 5.2(*) for Cabot, 5.3(*) for Columbus), the one
// generally-available signal that keeps them apart is the section_ref's
// leading section number: cards in the SAME party's covenant enumeration
// always share it. Single-party decks (the overwhelming majority --
// Metsera's 3 IOC-MERGE cards at 5.01(g)/(d)/(p) all share section "5.01")
// still collapse into one row exactly as before; this only stops a
// cross-PARTY collapse, never a same-party, same-code, different-sub-clause
// collapse (that's still the intended "3 cards -> 1 row" behaviour this
// function's original comment describes).
function sectionBand(card) {
  const ref = String(card?.section_ref || '').trim();
  const match = ref.match(/^(\d+(?:\.\d+)?)/);
  return match ? match[1] : (ref || 'default');
}

// Party attribution for two-party IOC decks (QXO/TopBuild: §4.1 Interim
// Operations of the Company + §4.2 Interim Operations of Parent).
// party_scope is baked MUTUAL on every IOC card (same limitation the
// ClauseSidebar's section-band disambiguation works around, PR #267), so a
// card whose own text carries the chapeau language resolves by TEXT
// ("the Company covenants and agrees" / "Interim Operations of Parent").
// Section refs are NOT trustworthy for chapeau cards — QXO's Parent
// chapeau (quote: "4.2 Interim Operations of Parent") carries
// section_ref "4.1".
//
// Fable audit (2026-07-19): band ORDER is not evidence. The old fallback
// ("first band = target") stamped Company/Parent on any exactly-two-band
// deck and got it wrong three ways in the corpus:
//  - Heinz/Kraft enumerates the ACQUIRER'S covenants FIRST (§5.02 "Heinz
//    Forbearances" restricts Heinz, the buyer; §5.03 "Kraft Forbearances"
//    restricts Kraft, the target) — the ordering convention inverted BOTH
//    sections;
//  - Zymeworks' §5.2 is a mutual "Each of the Parties agrees" covenant that
//    rendered under "— Parent";
//  - ENDRA's §6.2 restricts PubCo (the new holding company), not Parent.
// A band now gets a party ONLY on positive evidence from clause text (the
// evidence tiers in bandPartyLabels below); a band with no evidence stays
// null and renders under a NEUTRAL section-ref band label, never a guessed
// party. A wrong party attribution is worse than a neutral label.
const COMPANY_CHAPEAU_RE = /interim operations of the company|the company covenants and agrees/i;
const PARENT_CHAPEAU_RE = /interim operations of (the )?parent|parent covenants and agrees/i;

function cardPartyFromText(card) {
  const t = textOf(card) || '';
  if (PARENT_CHAPEAU_RE.test(t)) return 'Parent';
  if (COMPANY_CHAPEAU_RE.test(t)) return 'Company';
  return null;
}

// Band-level party evidence (corpus-validated against all 10 real two-band
// decks, 2026-07-19). Three generic text tiers, checked per band:
//  - conduct-section titles ("Conduct of the Company" / "Conduct of Parent
//    Business" / "Conduct of Business by the Company" / "Interim Operations
//    of Parent") — the section's own name says whose covenants these are;
//  - preamble disclosure-letter references ("Schedule 6.2(a) of the Parent
//    Disclosure Letter") — a party's IOC carve-outs live in ITS OWN
//    disclosure letter (TopBuild resolves both bands this way even though
//    its §6.2 chapeau is mis-stamped section_ref 6.1);
//  - mutual covenant language ("Each of the Parties agrees", "Conduct of
//    Business of the Parties") — binds both parties, so the band is neither
//    Company's nor Parent's alone (Zymeworks §5.2).
// Deliberately NOT evidence: consent-counterparty phrasing ("the Company
// shall otherwise consent") — ENDRA's §6.2 (PubCo's covenants, consented by
// the Company) proves it points at the wrong species of counterparty.
const COMPANY_BAND_RE = /conduct of (?:business(?:es)? (?:of|by) )?the compan(?:y|ies)\b|conduct of company business|interim operations of the company|the company covenants and agrees|company disclosure (?:letter|schedule)/i;
const PARENT_BAND_RE = /conduct of (?:business(?:es)? (?:of|by) )?(?:the )?parent\b|conduct of parent business|interim operations of (?:the )?parent|parent covenants and agrees|parent disclosure (?:letter|schedule)/i;
const MUTUAL_BAND_RE = /each of the parties|each party (?:agrees|shall)|the parties (?:shall|agree)\b|neither party (?:shall|will)|conduct of business(?:es)? of the parties/i;

// Chapeau/preamble cards routinely carry a WRONG section_ref (QXO's Parent
// chapeau: quote "4.2 Interim Operations of Parent", ref "4.1"; ENDRA's §6.1
// title card: ref "IOC-T"). When a card's quote OPENS with its own section
// number, that number names the band the evidence belongs to — trust it over
// the stamped ref. Enumerated restriction cards open with "(a) ..." and
// never match, so they keep resolving off section_ref as before.
const QUOTE_HEAD_SECTION_RE = /^["'\s]*(?:section\s*)?(\d+\.\d+)/i;
function quoteHeadBand(text) {
  const match = QUOTE_HEAD_SECTION_RE.exec(String(text || '').slice(0, 40));
  return match ? match[1] : null;
}

// Codename decks (Rocket/Mr. Cooper: "Conduct of Maverick" / "Conduct of
// Cavalier"; Charter/Cox: "Conduct of Business by the Cabot Parties";
// Heinz/Kraft: "Heinz Forbearances" / "Kraft Forbearances") name the
// covenantor by DEFINED TERM, not "Company"/"Parent" — no generic regex can
// place them. The chapeau title yields the covenantor's name; the deck's own
// party-coded rep cards then say whose name it is: REP-T (target reps) text
// is dominated by the target's defined term, REP-B by the buyer's
// (corpus-measured separation is >4x on every codename deck; the 2x gate
// below keeps a genuinely ambiguous name unresolved rather than guessed).
const PARTY_NAME_STOPWORDS = new Set(['company', 'companies', 'parent', 'parents', 'party', 'parties', 'business', 'businesses', 'merger', 'mergers', 'buyer', 'seller']);
const CONDUCT_NAME_RES = [
  /[Cc]onduct of (?:the )?[Bb]usiness(?:es)? (?:of|by) (?:the )?([A-Z][a-z]+)/,
  /[Cc]onduct of (?:the )?([A-Z][a-z]+)/,
  /\b([A-Z][a-z]+) Forbearances/,
];
function conductNameFromText(text) {
  const head = String(text || '').slice(0, 120);
  for (const re of CONDUCT_NAME_RES) {
    const match = re.exec(head);
    if (match && !PARTY_NAME_STOPWORDS.has(match[1].toLowerCase())) return match[1];
  }
  return null;
}

// Second codename source: a band's own preamble carve-out points at the
// covenantor's disclosure letter by defined term ("as set forth in Section
// 5.3(a) of the Columbus Disclosure Schedule" — Charter/Cox's §5.3, whose
// chapeau title card never made it into the deck). Same principle as the
// generic Company/Parent disclosure-letter tier above, resolved through
// rep-mining. All matches are collected (not just the first): a band whose
// cards reference BOTH parties' disclosure letters yields conflicting
// mined parties and stays null rather than guessed.
const DISCLOSURE_NAME_RE = /\b([A-Z][a-z]+) Disclosure (?:Letter|Schedule)/g;
function disclosureNamesFromText(text) {
  const out = [];
  for (const match of String(text || '').matchAll(DISCLOSURE_NAME_RE)) {
    if (!PARTY_NAME_STOPWORDS.has(match[1].toLowerCase())) out.push(match[1]);
  }
  return out;
}

function partyForDealName(name, allCards) {
  if (!name || !Array.isArray(allCards) || !allCards.length) return null;
  const nameRe = new RegExp(`\\b${name}\\b`, 'g');
  const density = (cardSet) => {
    let hits = 0;
    let chars = 0;
    for (const c of cardSet) {
      const t = textOf(c) || '';
      chars += t.length;
      hits += (t.match(nameRe) || []).length;
    }
    return chars ? (hits * 1000) / chars : 0;
  };
  const targetReps = allCards.filter((c) => /^REP-T/.test(String(c?.provision_subtype || '')));
  const buyerReps = allCards.filter((c) => /^REP-B/.test(String(c?.provision_subtype || '')));
  if (targetReps.length < 3 || buyerReps.length < 3) return null;
  const t = density(targetReps);
  const b = density(buyerReps);
  if (t > 2 * b && t > 0.5) return 'Company';
  if (b > 2 * t && b > 0.5) return 'Parent';
  return null;
}

// Map of band -> 'Company' | 'Parent' | 'Mutual' | null for exactly-two-band
// decks (null map for every other deck shape, exactly as before). Every
// value is EVIDENCE-BACKED: text votes first, codename+rep-mining second,
// null when neither resolves. Conflicting votes within a band, or both
// bands claiming the same party, resolve to null — neutral beats guessed.
// `allCards` (the full deal deck, optional) is only consulted for the
// codename tier; without it those bands simply stay null.
function bandPartyLabels(cards, allCards) {
  const namedNegative = cards.filter((c) => {
    const code = cardCode(c);
    return code && code !== 'IOC' && !GENERAL_EXCEPTION_CODES.has(code) && !AFFIRMATIVE_CODES.has(code);
  });
  const bands = [...new Set(namedNegative.map(sectionBand))].sort((a, b) => parseFloat(a) - parseFloat(b));
  if (bands.length !== 2) return null;
  const bandSet = new Set(bands);
  const votes = new Map(bands.map((band) => [band, new Set()]));
  const names = new Map(bands.map((band) => [band, new Set()]));
  for (const card of cards) {
    const text = textOf(card) || '';
    const band = [quoteHeadBand(text), sectionBand(card)].find((b) => b && bandSet.has(b));
    if (!band) continue;
    if (COMPANY_BAND_RE.test(text)) votes.get(band).add('Company');
    if (PARENT_BAND_RE.test(text)) votes.get(band).add('Parent');
    if (MUTUAL_BAND_RE.test(text)) votes.get(band).add('Mutual');
    const conductName = conductNameFromText(text);
    if (conductName) names.get(band).add(conductName);
    for (const dlName of disclosureNamesFromText(text)) names.get(band).add(dlName);
  }
  const out = new Map();
  for (const band of bands) {
    const bandVotes = votes.get(band);
    let party = bandVotes.size === 1 ? [...bandVotes][0] : null;
    if (!party && bandVotes.size === 0) {
      const minedParties = new Set([...names.get(band)].map((name) => partyForDealName(name, allCards)).filter(Boolean));
      if (minedParties.size === 1) party = [...minedParties][0];
    }
    out.set(band, party);
  }
  const [first, second] = bands.map((band) => out.get(band));
  if (first && first === second && first !== 'Mutual') {
    out.set(bands[0], null);
    out.set(bands[1], null);
  }
  return out;
}

// Ben r8: two-party decks render as TWO SECTIONS ("Interim Operating
// Covenants — Target" / "— Parent"), the same shape the reps tables use —
// not one section with per-party bands. This partitions the IOC deck:
//  - a card whose own text carries chapeau party language wins (QXO's
//    Parent chapeau is mis-stamped section_ref 4.1 — text beats refs);
//  - otherwise the card's band decides (quote-head section first, stamped
//    ref second — same trust order the evidence pass uses).
// Returns null for single-band decks (everything stays in the one target
// section exactly as before) AND — post-audit — for any two-band deck whose
// bands do not BOTH resolve to Company and Parent by evidence: those decks
// stay one section, with per-band neutral/mutual band labels inside it
// (negativeBandLabel below), instead of a party split nothing supports.
function partitionIocCardsByParty(cards, allCards) {
  const partyByBand = bandPartyLabels(cards, allCards);
  if (!partyByBand) return null;
  const parties = [...partyByBand.values()];
  if (!(parties.includes('Company') && parties.includes('Parent'))) return null;
  const out = { Company: [], Parent: [] };
  for (const card of cards) {
    const textParty = cardPartyFromText(card);
    const band = [quoteHeadBand(textOf(card)), sectionBand(card)].find((b) => b && partyByBand.has(b));
    const bandParty = band ? partyByBand.get(band) : null;
    out[textParty || bandParty || 'Company'].push(card);
  }
  return out;
}

function iocCardsForParty(reviewDeal, party) {
  const cards = (reviewDeal?.cards || []).filter(isIocCard);
  const split = partitionIocCardsByParty(cards, reviewDeal?.cards);
  if (!split) return party === 'Company' ? cards : [];
  return split[party] || [];
}

// Ben-facing band heading for an unsplit multi-band deck's negative
// covenants. Legal English only — a band with no evidence carries its
// section ref, never a machine code and never a guessed party.
function negativeBandLabel(party, band) {
  if (party === 'Company') return 'Negative covenants — Target';
  if (party === 'Parent') return 'Negative covenants — Parent';
  if (party === 'Mutual') return 'Negative covenants — Both parties';
  return `Negative covenants — §${band}`;
}

// Groups the NAMED negative covenants (has a real provision_subtype, is not
// a general-exceptions/affirmative container) by (section band, canonical
// code) -- see sectionBand's doc comment above for why band is part of the
// key, not just code.
function negativeCovenantGroups(cards) {
  const order = [];
  const byKey = new Map();
  for (const card of cards) {
    const code = cardCode(card);
    if (!code || code === 'IOC' || GENERAL_EXCEPTION_CODES.has(code) || AFFIRMATIVE_CODES.has(code)) continue;
    const band = sectionBand(card);
    const key = `${band}::${code}`;
    if (!byKey.has(key)) {
      byKey.set(key, { code, band, cards: [] });
      order.push(key);
    }
    byKey.get(key).cards.push(card);
  }
  return order.map((key) => byKey.get(key));
}

// The "[PROPOSED] Unclassified" 5.01(i)-(o) fragments: no provision_subtype
// was ever assigned, so there is no covenant name to hang a row on. Some
// carry a deterministically-stamped restrictionComponents tag, most carry
// nothing beyond a section reference.
function fragmentCards(cards) {
  return cards.filter((card) => {
    const code = cardCode(card);
    if (GENERAL_EXCEPTION_CODES.has(code) || AFFIRMATIVE_CODES.has(code)) return false;
    // No-code cards carrying positiveObligations are the deck's affirmative
    // covenants (QXO's chapeau cards) — affirmativeRows renders them; they
    // are not unclassified fragments.
    if (asList(cardFeatures(card).positiveObligations).length) return false;
    return !code || code === 'IOC';
  });
}

function buildNegativeRow(group) {
  return {
    // band included so two parties' same-code covenant each get a distinct,
    // stable React key (previously `ioc-neg-${code}` -- a real key
    // collision on any two-party IOC deck, since both groups shared one id).
    id: `ioc-neg-${group.band}-${group.code}`,
    code: group.code,
    band: group.band,
    cards: group.cards,
  };
}

// I6 (STRUCT): a small "column" sub-block used inside the negative-covenant
// row's content cell -- a mini header plus its pills (or a plain "not
// specified" placeholder), so the two halves (restrictions / exceptions)
// read as distinct columns even though GroupedSubRows only gives this file
// ONE physical content cell to work with (label is its own grid column
// already -- see GroupedSubRows in ProvisionTablePrimitives.jsx). Together
// the three pieces (label column + these two sub-columns) are the real
// General category | Specific restrictions | Exceptions table I6 asks for.
function negativeCovenantColumn(keyId, heading, pills, emptyCopy) {
  return React.createElement(
    'div',
    { key: keyId, className: 'min-w-0' },
    React.createElement('div', { className: 'mb-1 text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, heading),
    pills.length
      ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills)
      : React.createElement('span', { className: 'text-[11px] italic text-inkFaint' }, emptyCopy),
  );
}

// FIX 7 (Fable investigation): MONETARY_THRESHOLD used to render TWICE --
// once as a generic "Below monetary threshold" pill in Exceptions, again as
// a "Threshold: $X" pill in Specific Restrictions, always the same figure.
// dollarFromText pulls the exception's OWN verbatim $ figure (preferred
// source of truth for what that exception actually caps at) before falling
// back to the card's dollarThreshold; parseDollarNumber lets the two
// figures be compared numerically (not string-equal, so "$1,000,000" and
// "$1,000,000.00" still match) to decide whether the restriction pill is a
// true duplicate (suppress it) or a genuinely different number (keep both).
// Item 3 (r6): the restriction-side pill's wording is now the shared
// triggerThresholdLabel() helper ("Trigger: $Y", card-utils.js) -- the
// approved cross-config rule -- instead of this config's own "Threshold:
// $X" string, so every family renders the identical two threshold
// phrasings (monetary exception = "Below $X", restriction/trigger with no
// matching exception, or a different figure, = "Trigger: $Y").
const DOLLAR_FIGURE_RE = /\$[\d,]+(?:\.\d+)?/;
function dollarFromText(text) {
  if (!text) return null;
  const m = String(text).match(DOLLAR_FIGURE_RE);
  return m ? m[0] : null;
}
function parseDollarNumber(str) {
  if (!str) return null;
  const digits = String(str).replace(/[^0-9.]/g, '');
  return digits ? Number(digits) : null;
}

function renderNegativeRow(entry, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const { cards } = entry;
  const primary = cards[0];
  const label = primary?.short_title || primary?.defined_term || entry.code;
  const restrictionEntries = dedupeEntries(cards.flatMap((c) => exceptionEntries(cardFeatures(c).restrictionComponents, IOC_CATEGORY_CODES, c)));
  const cardDollarThreshold = cards.map((c) => formatMoney(cardFeatures(c).dollarThreshold)).find(Boolean) || null;
  const thresholdEntries = dedupeEntries(cards.map((c) => {
    const money = formatMoney(cardFeatures(c).dollarThreshold);
    return money ? { code: `threshold-${money}`, label: triggerThresholdLabel(money), evidence: textOf(c), source: c, amount: money } : null;
  }).filter(Boolean));
  const rawPermittedEntries = dedupeEntries(cards.flatMap((c) => exceptionEntries(cardFeatures(c).permittedExceptions, EXCEPTION_CODES, c)));

  // Resolve the MONETARY_THRESHOLD exception's own $ figure and rewrite its
  // label to "Below $X"; track the amount so the restriction-column
  // Threshold pill can be suppressed when it's the same figure.
  let monetaryExceptionAmount = null;
  const permittedEntries = rawPermittedEntries.map((e) => {
    if (e.code !== 'MONETARY_THRESHOLD') return e;
    const amount = dollarFromText(e.evidence) || cardDollarThreshold;
    if (!amount) return e;
    monetaryExceptionAmount = amount;
    return { ...e, label: belowThresholdLabel(amount) };
  });
  const visibleThresholdEntries = monetaryExceptionAmount
    ? thresholdEntries.filter((t) => parseDollarNumber(t.amount) !== parseDollarNumber(monetaryExceptionAmount))
    : thresholdEntries;
  // Ben: "see text" must expand to the ACTUAL negative-covenant clause, not
  // mainObligation -- lib/schema/features.js documents mainObligation as a
  // "one-sentence summary of what the sub-clause restricts or requires", an
  // AI paraphrase, not verbatim clause text (same class of bug already fixed
  // on representations-qualifiers.config.js's per-rep clause -- "the summary
  // isn't the full rep"). textOf(c) (primary_quote / region_full_text) is
  // the card's real clause; mainObligation is kept only as a last-resort
  // fallback for the rare card with no captured quote at all.
  const obligations = cards.map((c) => textOf(c) || valueText(cardFeatures(c).mainObligation)).filter(Boolean);

  // I3/I5/G4: restriction/threshold/exception pills are plain facts and
  // categories, not graded standards -- none of them pass a `color`, only a
  // `tone` (grey/info/green). See the file-header note.
  //
  // `wrap: true` (Ben, Dividends and Distributions): restrictionComponents/
  // permittedExceptions labels are taxonomy phrases, not short codes -- a
  // long one (e.g. "Existing equity award exercises, vesting, or
  // settlement") pushed past this cell/table's right edge instead of
  // wrapping, because PillCell's default single-line truncate gives the
  // label an unbreakable min-content width `max-w-full` can't shrink below
  // inside this column's `flex flex-wrap` container. `wrap: true` lets the
  // pill wrap onto multiple lines and stay inside the cell instead.
  const restrictionPills = [
    ...restrictionEntries.map((e, i) => pillFor(PillCell, `${entry.code}-rc-${i}`, e.label, 'neutral', e.evidence, e.source, undefined, true)),
    ...visibleThresholdEntries.map((e, i) => pillFor(PillCell, `${entry.code}-dt-${i}`, e.label, 'info', e.evidence, e.source, undefined, true)),
  ].filter(Boolean);
  const exceptionPills = permittedEntries
    .map((e, i) => pillFor(PillCell, `${entry.code}-pe-${i}`, e.label, 'present', e.evidence, e.source, undefined, true))
    .filter(Boolean);

  return {
    id: entry.id,
    label: covenantLabelNode(label, entry.code),
    children: React.createElement(
      'div',
      { className: 'space-y-1.5' },
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 gap-2 sm:grid-cols-2', 'data-testid': 'ioc-negative-columns' },
        negativeCovenantColumn(`${entry.code}-restrictions`, 'Specific restrictions', restrictionPills, 'Not specified'),
        negativeCovenantColumn(`${entry.code}-exceptions`, 'Exceptions', exceptionPills, 'None specified'),
      ),
    ),
    // r9: "See provision" lives in the LEFT column (GroupedSubRows'
    // seeTextContent contract) with the full-width expansion row — never
    // under the results.
    seeTextContent: obligations.length ? obligations.join('\n\n') : null,
    // Item 2 (r5): `primary` is cards[0] for this covenant-code group -- the
    // same card this row's pills/obligations text were built from.
    card: primary || null,
    evidence: obligations[0] || null,
    band: entry.band || null,
  };
}

// I7: keyword-name patterns for fragments that carry NO restrictionComponents
// tag at all -- a genuine extraction gap (no provision_subtype was ever
// assigned, so the deterministic post-pass keyword-tagger in
// lib/parser-v2/extract.js never ran a rule against them; see the
// classifyIocRestrictionComponents keyword set that DOES cover most
// 5.01(i)-(o)-style fragments). Metsera's ungrouped 5.01(k)/(l)/(o) are a tax
// covenant, a Specified-Contract amendment restriction, and an
// insurance-maintenance covenant respectively -- sniffed here from the
// card's own primary_quote (deterministic, generic across deals; NOT
// hardcoded to Metsera's section lettering, since a different agreement's
// tax/Specified-Contract/insurance fragments won't land on (k)/(l)/(o)).
const FRAGMENT_NAME_PATTERNS = [
  { test: /\btax\b.{0,60}\b(election|elections|return|returns|liabilit|refund|closing agreement|ruling)/i, label: 'Tax matters' },
  { test: /specified contract/i, label: 'Specified-contract amendments' },
  { test: /\binsurance\b/i, label: 'Insurance maintenance' },
];

function sniffFragmentName(card) {
  const text = textOf(card);
  if (!text) return null;
  const hit = FRAGMENT_NAME_PATTERNS.find(({ test }) => test.test(text));
  return hit ? hit.label : null;
}

// I8 (FEEDBACK-4-PUNCHLIST.md, asked ~5x): the extractor splits Metsera's
// Section 5.01 negative covenant into per-letter sub-clause cards, (a)-(h) of
// which the classifier names with a real IOC-* subtype -- (i) through (o) it
// leaves with provision_subtype=null and short_title stamped
// "[PROPOSED] Unclassified" by ingestion (review-deal.js's
// stripProposedShortTitle marker). sniffFragmentName's 3 keyword patterns
// (I7) only ever covered 3 of these 8 letters; this map is a deterministic,
// section_ref-keyed name for all 8, read straight off each sub-clause's own
// quote (see the class comment above FRAGMENT_NAME_PATTERNS for the tax/
// Specified-Contract/insurance ones -- (i)/(ii)/(j)/(m)/(n) are new here).
const UNCLASSIFIED_SHORT_TITLE = '[PROPOSED] Unclassified';
const SECTION_501_SUBCLAUSE_TITLES = {
  i: 'Indebtedness',
  ii: 'Debt securities issuance',
  j: 'Capital expenditures',
  k: 'Tax elections / Tax accounting',
  l: 'Specified Contracts',
  m: 'Litigation settlements',
  n: 'Prepayment of indebtedness',
  o: 'Insurance maintenance',
};
const SECTION_501_SUBCLAUSE_RE = /5\.01\s*\(([a-z]+)\)/i;

function section501SubclauseTitle(card) {
  if (card?.short_title !== UNCLASSIFIED_SHORT_TITLE) return null;
  const match = SECTION_501_SUBCLAUSE_RE.exec(String(card?.section_ref || ''));
  if (!match) return null;
  return SECTION_501_SUBCLAUSE_TITLES[match[1].toLowerCase()] || null;
}

// Last-resort fallback for a 5.01 sub-clause letter this deal's map doesn't
// carry (a different agreement's lettering/order): the first meaningful
// phrase off the card's own primary_quote, so an unmapped letter still gets
// a real title instead of the literal short_title leaking through.
function firstQuotePhrase(text) {
  if (!text) return null;
  const stripped = String(text).replace(/^\(\s*[a-z0-9]+\s*\)\s*/i, '').trim();
  const phrase = stripped.split(/[,;]| and | or /i)[0].replace(/[.:]\s*$/, '').trim();
  if (!phrase) return null;
  const capped = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return capped.length > 90 ? `${capped.slice(0, 87)}...` : capped;
}

// Never lets the literal "[PROPOSED] Unclassified" short_title stand as a
// row's name: the section_ref map first, sniffFragmentName's keyword
// patterns second (still useful off-map, e.g. no section_ref at all), then
// the quote-mined phrase.
function resolveFragmentName(card) {
  return section501SubclauseTitle(card)
    || sniffFragmentName(card)
    || (card?.short_title === UNCLASSIFIED_SHORT_TITLE ? firstQuotePhrase(textOf(card)) : null);
}

// Ben (r6): no more "§5.01(i)–5.01(o) (8 fragments)" bundle row — every
// fragment is a real restriction and gets its OWN named row (resolved via
// the section-ref map / keyword sniffing / quote mining above), with its
// pills, its clause behind the standard see-text expander, and its card
// wired for the sidebar. Returns an ARRAY of rows for the "Other
// restrictions" band.
function buildOtherRestrictionsRows(fragments, ctx) {
  if (!fragments.length) return [];
  const PillCell = ctx?.primitives?.PillCell;
  return fragments.map((card, index) => {
    const entries = exceptionEntries(cardFeatures(card).restrictionComponents, IOC_CATEGORY_CODES, card);
    const section = valueText(cardFeatures(card).sectionNumber) || String(card?.section_ref || '').split('|')[0].trim() || null;
    const name = resolveFragmentName(card)
      || (entries.length ? entries[0].label : null)
      || (section ? `§${section}` : `Item ${index + 1}`);
    const label = section && !name.startsWith('§') ? `${name} · §${section}` : name;
    // r8 duplicate audit: never repeat the row's own name as a pill.
    const pillEntries = entries.filter((e) => e.label !== name);
    const pills = (pillEntries.length && PillCell)
      ? React.createElement(
        'div',
        { className: 'flex flex-wrap gap-1' },
        pillEntries.map((e, j) => pillFor(PillCell, `frag-${card.id || index}-${j}`, e.label, 'neutral', e.evidence, e.source, undefined, true)),
      )
      : null;
    const clause = textOf(card);
    return {
      id: `ioc-frag-${card.id || index}`,
      label: covenantLabelNode(label, null),
      children: React.createElement(
        'div',
        { className: 'space-y-1.5' },
        pills,
      ),
      seeTextContent: clause || null,
      card,
      evidence: clause || null,
    };
  });
}

// I2/I4: a limb's own efforts_standard (normalizeIocLimbEffortsStandards in
// lib/parser-v2/extract.js stamps exactly one such field per limb -- see the
// file-header note) renders as a coloured pill UNLESS it's FLAT (an
// unqualified duty -- content, not a graded standard; I3/I5/G4 -- and
// standardColorKey('FLAT') would otherwise false-positive on its own
// \bflat\b hell-or-high-water pattern, so FLAT is never even passed in).
function effortsStandardPillFor(PillCell, keyId, standard, card) {
  const code = standard ? String(standard).toUpperCase() : null;
  if (!code || code === 'FLAT') return null;
  const label = labelForCode(code, EFFORTS_STANDARDS);
  if (!label) return null;
  return pillFor(PillCell, keyId, label, 'info', textOf(card), card, standardColorKey(label));
}

// I2: some limbs (e.g. IOC-MAINTAIN) carry "in all material respects" INSIDE
// the obligation text itself while efforts_standard is FLAT -- materiality is
// this limb's content, not an efforts qualifier, so the two fields are
// independent and both may render. Pulled out here as its own coloured
// standard pill so it isn't lost inside the collapsed "see text" prose.
function materialRespectsPillFor(PillCell, keyId, obligationText, card) {
  if (!obligationText || !/in all material respects/i.test(obligationText)) return null;
  const label = MATERIALITY_CODES.MAT_ALL_MATERIAL;
  return pillFor(PillCell, keyId, label, 'info', textOf(card), card, standardColorKey(label));
}

// r10 (Ben, QXO permits limb): SCOPE materiality is a different species
// from the performance-standard pill above — "licenses ... that are
// material to the Company, taken as a whole" narrows WHICH objects the
// duty covers (only material permits/assets/relationships), it does not
// soften how strictly the duty must be performed. Rendering the
// "in all material respects" pill there would misstate the covenant, so
// this is its own pill with its own detector. Pattern validated against
// all 128 corpus limbs (21 hits across 13 deals; zero false positives on
// "materially different"/"material adverse"; the 23 performance-only
// limbs are untouched). A limb can legitimately carry BOTH (Metsera:
// "maintain its material assets ... intact in all material respects").
const SCOPE_MATERIALITY_RE = /that (?:are|is) material to|material to (?:the )?(?:company|parent|it)\b[^.]{0,40}taken as a whole|\bmaterial (?:permits?|licen[cs]es?|leases?|contracts?|assets?|properties|franchises?|rights|relationships?|customers?|vendors?|suppliers?|aspects)\b/i;
function scopeMaterialityPillFor(PillCell, keyId, obligationText, card) {
  if (!obligationText || !SCOPE_MATERIALITY_RE.test(obligationText)) return null;
  return pillFor(PillCell, keyId, 'Material items only', 'info', textOf(card), card);
}

// Some decks (QXO) park the positive obligations on the section's chapeau
// card with NO provision_subtype at all — and each limb's payload arrives
// double-encoded, as { text: '{"appliesTo":[...],"obligation":"..."}' }.
// Unwrap that inner JSON so appliesTo/obligation resolve like a structured
// limb; anything unparseable stays as-is (falls back to the card text).
function normalizeLimb(limb) {
  if (limb && typeof limb.text === 'string' && limb.text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(limb.text);
      if (parsed && typeof parsed === 'object') return { ...limb, ...parsed };
    } catch { /* not JSON — keep the raw limb */ }
  }
  return limb;
}

// Deterministic title rubric for IOC affirmative-covenant limbs (r9).
// Validated against all 128 affirmative limbs extracted corpus-wide
// (40 deals, production API, 2026-07-19): full coverage, zero fallbacks.
// Ordered, first match wins, applied to the FULL obligation text — never a
// truncated first clause (truncation caused the QXO failures: "maintain in
// effect all of their foreign[, federal...] Licenses, permits..." cut
// before the operative nouns, and an efforts-wrapper clause titled by its
// "commercially reasonable efforts" preamble instead of its subject).
// Five corpus limbs bundle several duties in one clause (compound
// preserve+retain+property shapes — IonQ, CSRA, Cooper Tire, Starwood,
// Summit); the rubric picks the dominant duty and the full clause stays
// one click away behind See provision.
const IOC_LIMB_TITLE_RUBRIC = [
  { test: /status of the company as a reit|qualif(y|ied) as a reit/i, title: 'Maintain REIT qualification' },
  { test: /adversely affects? the ability .{0,60}regulatory approvals?/i, title: 'Not impede regulatory approvals' },
  { test: /prompt written notice/i, title: 'Notify of customer/relationship issues' },
  { test: /anti-corruption|economic sanctions|\bsanctions\b/i, title: 'Comply with anti-corruption & sanctions laws' },
  { test: /\bcomply\b[\s\S]{0,60}\blaws?\b/i, title: 'Comply with applicable laws' },
  { test: /existence in good standing/i, title: 'Maintain corporate existence & good standing' },
  // Negative-lookahead guard: a bare license/permit keyword inside a broad
  // "preserve business organization ... relationships with ..." omnibus
  // list (Endeavor, EWC, Skechers, Carrols) must not claim this title.
  {
    test: /^(?![\s\S]*\b(?:business organizations?|relationships?\s+with)\b)[\s\S]*\b(?:franchis|permits?\b|licen[cs]es?\b|approvals?\b|authoriz)/i,
    title: 'Maintain permits, franchises & authorizations',
  },
  { test: /\blease|\bpersonal property\b|good repair/i, title: 'Maintain leases & material property' },
  { test: /keep available the services|retain the services|retain [\s\S]{0,20}officers/i, title: 'Retain officers & key employees' },
  { test: /preserve|goodwill|business organization|business relationship|relationships?\s+with/i, title: 'Preserve business organization & relationships' },
  { test: /ordinary (and usual )?course/i, title: 'Conduct business in ordinary course' },
];

function limbShortTitle(limb) {
  const raw = valueText(limb?.obligation);
  if (!raw) return null;
  const full = String(raw);
  for (const rule of IOC_LIMB_TITLE_RUBRIC) {
    if (rule.test.test(full)) return rule.title;
  }
  // Corpus-wide the rubric never misses (0/128); a future outlier still
  // gets a readable first-clause title rather than nothing.
  let t = full.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.split(/[,;]/)[0].trim();
  if (t.length > 64) t = `${t.slice(0, 64).replace(/\s+\S*$/, '')}…`;
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function affirmativeRows(cards, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const rows = [];
  for (const card of cards) {
    const code = cardCode(card);
    const features = cardFeatures(card);
    const rawLimbs = asList(features.positiveObligations);
    // Subtype-coded affirmative cards as before, PLUS chapeau/no-code cards
    // that carry positiveObligations (QXO: subtype-less "General / Preamble"
    // cards are the ONLY place its ordinary-course/preservation duties
    // live — previously they never rendered anywhere).
    const isAffirmative = AFFIRMATIVE_CODES.has(code)
      || ((!code || code === 'IOC') && rawLimbs.length > 0);
    if (!isAffirmative) continue;
    const limbs = rawLimbs.map(normalizeLimb);
    if (!limbs.length) continue;
    // Chapeau cards contain their own party language, so text attribution
    // works even where the section_ref is wrong (QXO's Parent chapeau is
    // stamped section_ref 4.1).
    const genericTitle = /general|preamble/i.test(String(card.short_title || ''));
    limbs.forEach((limb, limbIndex) => {
      // r8 duplicate audit: a chapeau card carries SEVERAL limbs — five
      // identical "Ordinary course & preservation" rows read as duplicates.
      // Each limb row takes a short title from its own obligation text.
      const rowTitle = genericTitle
        ? (limbShortTitle(limb) || `Ordinary course & preservation${limbs.length > 1 ? ` (${limbIndex + 1})` : ''}`)
        : (card.short_title || card.defined_term || 'Affirmative covenant');
      const scopeEntries = exceptionEntries(limb?.appliesTo, IOC_AFFIRMATIVE_SCOPE_CODES, card);
      const carveout = features.ordinaryCourseCarveout === true || limb?.ordinaryCourseCarveout === true;
      const obligationText = valueText(limb?.obligation) || textOf(card);
      const pills = [
        ...scopeEntries.map((e, i) => pillFor(PillCell, `${card.id}-scope-${limbIndex}-${i}`, e.label, 'neutral', e.evidence, e.source)),
        effortsStandardPillFor(PillCell, `${card.id}-efforts-${limbIndex}`, limb?.efforts_standard, card),
        materialRespectsPillFor(PillCell, `${card.id}-materiality-${limbIndex}`, obligationText, card),
        scopeMaterialityPillFor(PillCell, `${card.id}-scope-mat-${limbIndex}`, obligationText, card),
        carveout ? pillFor(PillCell, `${card.id}-carveout-${limbIndex}`, 'Ordinary-course carve-out applies', 'present', textOf(card), card) : null,
      ].filter(Boolean);
      rows.push({
        id: `ioc-aff-${card.id || code}-${limbIndex}`,
        label: covenantLabelNode(rowTitle, code),
        card,
        evidence: obligationText || null,
        children: React.createElement(
          'div',
          { className: 'space-y-1.5' },
          pills.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills) : null,
        ),
        seeTextContent: obligationText || null,
      });
    });
  }
  return rows;
}

// FIX (General Exceptions showing only 1 of N): the section-wide carve-out
// codes were only ever surfaced through the bottom CoverageFooter strip,
// which renders a bare "N of M general exceptions apply to the covenants
// above" COUNT -- it never lists which items are actually present (only the
// ABSENT ones, behind a collapsed details). For Metsera that read as
// "4 of 4 apply" with no visible enumeration at all, i.e. the 4 distinct
// carve-outs (COMPANY_DISCLOSURE_LETTER "As disclosed" / REQUIRED_BY_AGREEMENT
// "As contemplated by this Agreement" / REQUIRED_BY_LAW "As required by law" /
// PRIOR_WRITTEN_CONSENT "With Parent's consent") collapsed down to that one
// summary line. This helper builds the actual pill row(s) so every distinct
// exception renders -- see exceptionsRow/buildIocExceptionsRows below, wired
// into the 'exceptions' group in the table body (never re-introduces true
// duplicates: dedupeEntries collapses by CODE, and REQUIRED_BY_AGREEMENT is
// never aliased into COMPANY_DISCLOSURE_LETTER or any other code here).
function exceptionsRow(id, label, entries, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!entries.length) return null;
  const pills = entries
    .map((e, i) => pillFor(PillCell, `${id}-${i}`, e.label, 'present', e.evidence, e.source, undefined, true))
    .filter(Boolean);
  return {
    id,
    label: covenantLabelNode(label, null),
    children: pills.length
      ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills)
      : React.createElement('span', { className: 'text-[11px] italic text-inkFaint' }, 'None specified'),
  };
}

// Builds the "Exceptions" band's row(s). Some deals (Metsera) carry the
// SAME chapeau exceptions on both the affirmative-side preamble
// (IOC-GENERAL-EXCEPTIONS) and the negative-side preamble
// (IOC-NEGATIVE-PREAMBLE) -- in that case show ONE shared row so the two
// sides' identical carve-out list isn't duplicated. Other deals extract them
// as genuinely separate sets (e.g. the negative preamble narrows or extends
// the affirmative one) -- in that case each side gets its own row. Detected
// by comparing the two sides' DISTINCT CODE SETS (not label text, which can
// carry immaterial per-clause quote differences), so equal-content preambles
// with slightly different verbatim quotes still collapse to the shared row.
function buildIocExceptionsRows(cards, ctx) {
  const posCards = cards.filter((c) => POSITIVE_EXCEPTION_CODES.has(cardCode(c)));
  const negCards = cards.filter((c) => NEGATIVE_EXCEPTION_CODES.has(cardCode(c)));
  const posEntries = dedupeEntries(posCards.flatMap((c) => exceptionEntries(cardFeatures(c).permittedExceptions, EXCEPTION_CODES, c)));
  const negEntries = dedupeEntries(negCards.flatMap((c) => exceptionEntries(cardFeatures(c).permittedExceptions, EXCEPTION_CODES, c)));
  if (!posEntries.length && !negEntries.length) return [];

  const posCodes = new Set(posEntries.map((e) => e.code));
  const negCodes = new Set(negEntries.map((e) => e.code));
  const sameSet = posEntries.length > 0 && negEntries.length > 0
    && posCodes.size === negCodes.size
    && [...posCodes].every((code) => negCodes.has(code));

  if (sameSet) {
    const row = exceptionsRow('ioc-exceptions-shared', 'Applies to affirmative & negative covenants', posEntries, ctx);
    return row ? [row] : [];
  }

  const rows = [];
  const affRow = exceptionsRow('ioc-exceptions-affirmative', 'Exceptions to affirmative covenants', posEntries, ctx);
  if (affRow) rows.push(affRow);
  const negRow = exceptionsRow('ioc-exceptions-negative', 'Exceptions to negative covenants', negEntries, ctx);
  if (negRow) rows.push(negRow);
  return rows;
}

// Footer now carries ONLY the "required-by-law carve-out" note -- the
// distinct general-exceptions items themselves are visible inline in the
// 'exceptions' group (buildIocExceptionsRows above), immediately after the
// affirmative-covenants band, so the old bottom-strip CoverageFooter count
// (which never enumerated the present items) would just be a redundant
// second display of the same 4 codes.
// Ben (Mergertrace round 1): the standalone "Required-by-law carve-out
// applies" footer pill was a redundant third display of a fact the
// Exceptions band already shows ("As required by law" pill in the intro/
// chapeau row) — dropped entirely.
function renderIocFooter() {
  return null;
}

// Ben r8: the section itself is party-scoped ("— Target" / "— Parent",
// mirroring the reps tables), so the body renders ONE plain band set — no
// per-party band labels inside a section. The parent section only surfaces
// on two-party decks (selectRows returns [] otherwise, so hasRows hides it).
function buildIocConfig({ id, title, party }) {
  return {
    id,
    title,
    layoutSlot: 'ioc',
    // Row-shape independent of ctx (primitives) so hasRows checks in
    // pages/review/[id].js (which call selectRows without ctx) still work;
    // the actual grouped body is rebuilt with primitives at render time via
    // the 'body' column below (same contract as conditions.config.js).
    selectRows(reviewDeal) {
      const cards = iocCardsForParty(reviewDeal, party);
      if (!cards.length) return [];
      return [{ id: `${id}-body`, reviewDeal }];
    },
    columns: [
      {
        id: 'body',
        header: '',
        renderCell(row, ctx) {
          const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
          if (!GroupedSubRows) return null;
          const cards = iocCardsForParty(row.reviewDeal, party);
          const negativeRows = negativeCovenantGroups(cards).map((group) => renderNegativeRow(buildNegativeRow(group), ctx));
          // Post-audit: a two-band deck that did NOT split into party
          // sections (no evidence for a clean Company/Parent partition —
          // Heinz/Kraft-without-reps, Zymeworks' mutual §5.2, ENDRA's PubCo
          // §6.2) still renders BOTH bands here, so the negative covenants
          // split into one band-labelled group each: the party where
          // evidence resolves one, "Both parties" for mutual language, the
          // bare section ref otherwise. Split decks and single-band decks
          // see exactly one band and keep the plain label as before.
          const partyByBand = bandPartyLabels(cards, row.reviewDeal?.cards);
          const negativeGroups = partyByBand
            ? [...partyByBand.keys()].map((band) => ({
              id: `negative-${band}`,
              label: negativeBandLabel(partyByBand.get(band), band),
              rows: negativeRows.filter((r) => r.band === band),
            })).filter((group) => group.rows.length)
            : [{ id: 'negative', label: 'Negative covenants', rows: negativeRows }];
          const otherRows = buildOtherRestrictionsRows(fragmentCards(cards), ctx);
          const exceptionsRows = buildIocExceptionsRows(cards, ctx);
          // Old-site render order (OLD-review-page.js's
          // IocAffirmativeCovenantsTable ahead of IocNegativeCovenantsTable)
          // puts the affirmative limbs FIRST -- REBUILD-SPECS.md section 6 /
          // FEEDBACK-2-PUNCHLIST.md #29. The section-wide "Exceptions" band
          // comes right after the affirmative covenants -- and before the
          // negative covenants -- so a reader sees the chapeau carve-outs
          // before the enumerated restrictions they qualify. Negative
          // covenants (the named rows) come next, with the near-empty
          // fragments in the lowest-priority "Other restrictions" band last.
          const groups = [
            { id: 'affirmative', label: 'Affirmative covenants', rows: affirmativeRows(cards, ctx) },
            { id: 'exceptions', label: 'Exceptions', rows: exceptionsRows },
            ...negativeGroups,
            { id: 'other', label: 'Other restrictions', rows: otherRows },
          ];
          // Item 2 (r5): same onSelectCard/resolveCard/selectedCardId wiring
          // conditions.config.js/nosol-section.config.js use -- only rows
          // that set `card` above resolve to a real card; others render
          // exactly as before (no dead cursor).
          return React.createElement(GroupedSubRows, {
            groups,
            emptyCopy: 'No interim operating covenants found.',
            onSelectCard: ctx.onSelectCard,
            resolveCard: ctx.resolveCard,
            selectedCardId: ctx.selectedCardId,
          });
        },
      },
    ],
  };
}

// Single-band decks (the overwhelming majority) show everything here — an
// interim-operating section IS the target's conduct covenant on those deals.
const iocExceptionsConfig = buildIocConfig({
  id: 'ioc-exceptions',
  title: 'Interim Operating Covenants — Target',
  party: 'Company',
});

const parentIocExceptionsConfig = buildIocConfig({
  id: 'parent-ioc-exceptions',
  title: 'Interim Operating Covenants — Parent',
  party: 'Parent',
});

export {
  affirmativeRows,
  buildIocExceptionsRows,
  bandPartyLabels,
  parentIocExceptionsConfig,
  partitionIocCardsByParty,
  iocCardsForParty,
  buildOtherRestrictionsRows,
  cardPartyFromText,
  normalizeLimb,
  scopeMaterialityPillFor,
  effortsStandardPillFor,
  exceptionEntries,
  fragmentCards,
  formatMoney,
  iocExceptionsConfig,
  isIocCard,
  materialRespectsPillFor,
  negativeBandLabel,
  negativeCovenantGroups,
  renderIocFooter,
  renderNegativeRow,
  resolveFragmentName,
  section501SubclauseTitle,
  sniffFragmentName,
};
