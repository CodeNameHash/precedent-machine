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
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(num) && num > 0) return `$${num.toLocaleString('en-US')}`;
  // The claims-adapter (lib/queries/claims-adapter.js's buildRawValue) already
  // falls back to `claim.verbatim` when `claim.canonical` is null, so most
  // verbatim-only numbers arrive here as a clean numeral string and are
  // caught above. This is the last-resort path for the rare case a longer
  // verbatim sentence slips through uncoerced ("...not to exceed $2,000,000
  // in the aggregate...") -- pull the first dollar figure out of it directly
  // instead of dropping the pill.
  if (typeof raw === 'string') {
    const match = raw.match(/\$\s?[\d,]+(?:\.\d+)?/);
    if (match) return match[0].replace(/\s+/g, '');
  }
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
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

// Small, always-collapsed "see text" affordance for mainObligation prose --
// ported verbatim from conditions.config.js's clauseSeeText so the AI's
// clause sentence never dumps inline (REBUILD-SPECS.md global rule + the
// section-6-specific "mainObligation prose behind see text (NEVER dump)").
function seeTextNode(texts) {
  const joined = texts.filter(Boolean).join('\n\n');
  if (!joined) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      joined,
    ),
  );
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
// ClauseSidebar's section-band disambiguation works around, PR #267), so:
//  - a card whose own text carries the chapeau language resolves by TEXT
//    ("the Company covenants and agrees" / "Interim Operations of Parent").
//    Section refs are NOT trustworthy for chapeau cards — QXO's Parent
//    chapeau (quote: "4.2 Interim Operations of Parent") carries
//    section_ref "4.1".
//  - enumerated restriction cards (no chapeau language of their own)
//    resolve by band ORDER: in agreement convention the target's conduct
//    section precedes the parent's. Applied ONLY when exactly two bands
//    exist; single-band decks (the overwhelming majority) get no party
//    labels and render exactly as before.
const COMPANY_CHAPEAU_RE = /interim operations of the company|the company covenants and agrees/i;
const PARENT_CHAPEAU_RE = /interim operations of (the )?parent|parent covenants and agrees/i;

function cardPartyFromText(card) {
  const t = textOf(card) || '';
  if (PARENT_CHAPEAU_RE.test(t)) return 'Parent';
  if (COMPANY_CHAPEAU_RE.test(t)) return 'Company';
  return null;
}

function bandPartyLabels(cards) {
  const namedNegative = cards.filter((c) => {
    const code = cardCode(c);
    return code && code !== 'IOC' && !GENERAL_EXCEPTION_CODES.has(code) && !AFFIRMATIVE_CODES.has(code);
  });
  const bands = [...new Set(namedNegative.map(sectionBand))].sort((a, b) => parseFloat(a) - parseFloat(b));
  if (bands.length !== 2) return null;
  return new Map([[bands[0], 'Company'], [bands[1], 'Parent']]);
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
      obligations.length ? seeTextNode(obligations) : null,
    ),
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
    const pills = (entries.length && PillCell)
      ? React.createElement(
        'div',
        { className: 'flex flex-wrap gap-1' },
        entries.map((e, j) => pillFor(PillCell, `frag-${card.id || index}-${j}`, e.label, 'neutral', e.evidence, e.source, undefined, true)),
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
        clause ? seeTextNode([clause]) : null,
      ),
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
    const party = cardPartyFromText(card);
    const genericTitle = /general|preamble/i.test(String(card.short_title || ''));
    const rowTitle = genericTitle
      ? (party ? `${party} — ordinary course & preservation` : 'Ordinary course & preservation')
      : (card.short_title || card.defined_term || 'Affirmative covenant');
    limbs.forEach((limb, limbIndex) => {
      const scopeEntries = exceptionEntries(limb?.appliesTo, IOC_AFFIRMATIVE_SCOPE_CODES, card);
      const carveout = features.ordinaryCourseCarveout === true || limb?.ordinaryCourseCarveout === true;
      const obligationText = valueText(limb?.obligation) || textOf(card);
      const pills = [
        ...scopeEntries.map((e, i) => pillFor(PillCell, `${card.id}-scope-${limbIndex}-${i}`, e.label, 'neutral', e.evidence, e.source)),
        effortsStandardPillFor(PillCell, `${card.id}-efforts-${limbIndex}`, limb?.efforts_standard, card),
        materialRespectsPillFor(PillCell, `${card.id}-materiality-${limbIndex}`, obligationText, card),
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
          obligationText ? seeTextNode([obligationText]) : null,
        ),
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

const iocExceptionsConfig = {
  id: 'ioc-exceptions',
  title: 'Interim Operating Covenants',
  layoutSlot: 'ioc',
  // Row-shape independent of ctx (primitives) so hasRows checks in
  // pages/review/[id].js (which call selectRows without ctx) still work; the
  // actual grouped body is rebuilt with primitives at render time via the
  // 'body' column below (same contract as conditions.config.js).
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isIocCard);
    if (!cards.length) return [];
    return [{ id: 'ioc-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const cards = (row.reviewDeal?.cards || []).filter(isIocCard);
        const negativeRows = negativeCovenantGroups(cards).map((group) => renderNegativeRow(buildNegativeRow(group), ctx));
        const otherRows = buildOtherRestrictionsRows(fragmentCards(cards), ctx);
        const exceptionsRows = buildIocExceptionsRows(cards, ctx);
        // Old-site render order (OLD-review-page.js's IocAffirmativeCovenantsTable
        // ahead of IocNegativeCovenantsTable) puts the affirmative limbs FIRST --
        // REBUILD-SPECS.md section 6 / FEEDBACK-2-PUNCHLIST.md #29. The
        // section-wide "Exceptions" band comes right after the affirmative
        // covenants -- and before the negative covenants -- so a reader sees
        // the chapeau carve-outs before the enumerated restrictions they
        // qualify (this used to render only as a bottom-of-table coverage
        // count, well AFTER both the negative covenants AND the unclassified
        // fragments; see buildIocExceptionsRows' header comment). Negative
        // covenants (the named rows) come next, with the near-empty fragments
        // collapsed into the lowest-priority "Other restrictions" band last.
        // Two-party decks (QXO: §4.1 Company + §4.2 Parent) split the
        // negative covenants into one labelled band PER PARTY — otherwise
        // "Charter / Bylaws Amendments" renders twice with no way to tell
        // whose covenant it is. Single-band decks keep the single
        // "Negative covenants" band exactly as before.
        const partyByBand = bandPartyLabels(cards);
        const negativeGroups = partyByBand
          ? [...partyByBand.entries()].map(([band, party]) => ({
            id: `negative-${band}`,
            label: `Negative covenants — ${party}`,
            rows: negativeRows.filter((r) => r.band === band),
          }))
          : [{ id: 'negative', label: 'Negative covenants', rows: negativeRows }];
        const groups = [
          { id: 'affirmative', label: 'Affirmative covenants', rows: affirmativeRows(cards, ctx) },
          { id: 'exceptions', label: 'Exceptions', rows: exceptionsRows },
          ...negativeGroups,
          { id: 'other', label: 'Other restrictions', rows: otherRows },
        ];
        // Item 2 (r5): same onSelectCard/resolveCard/selectedCardId wiring
        // conditions.config.js/nosol-section.config.js use -- only rows that
        // set `card` above (negativeRows today) resolve to a real card;
        // others render exactly as before (no dead cursor).
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
  renderFooter: renderIocFooter,
  empty: { copy: 'No IOC cards found.' },
};

export {
  affirmativeRows,
  buildIocExceptionsRows,
  bandPartyLabels,
  buildOtherRestrictionsRows,
  cardPartyFromText,
  normalizeLimb,
  effortsStandardPillFor,
  exceptionEntries,
  fragmentCards,
  formatMoney,
  iocExceptionsConfig,
  isIocCard,
  materialRespectsPillFor,
  negativeCovenantGroups,
  renderIocFooter,
  renderNegativeRow,
  resolveFragmentName,
  section501SubclauseTitle,
  sniffFragmentName,
};
