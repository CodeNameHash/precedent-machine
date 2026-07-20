import React from 'react';
import {
  buildPerShareParts,
  deriveHeadlineConsiderationType,
  electionAttributionLabel,
  findElectionMechanism,
  headlineConsiderationLabel,
  numericDollarOnly,
} from '../table-logic.js';
import taxonomy from '../../../lib/taxonomy.js';
import { valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Consideration headline card, spec REBUILD-SPECS.md §2. Old page = a
// HEADLINE card (per-share economics + appraisal rights + a Cash/Stock/CVR
// tag) plus a SEPARATE "Employee Equity Treatment" table plus a payment-
// mechanics LINK. This config now owns ONLY the headline: every equity
// attribute (equityAwardTreatment, instrumentTreatments, instrumentVesting,
// outstandingInstruments, espp_treatment, doubleTrigger, vestingAcceleration,
// optionsCvrEarnIn, optionSpread) lives exclusively on equity-awards.config.js
// -- CONSID-EQUITY is excluded from this config's card selector below so the
// same card can never double-render its equity facts on both the headline
// and the equity table.
const CONSID_CODES = ['CONSID', 'CONSID-CVR', 'CONSID-CONVERT'];
const EQUITY_CODE = 'CONSID-EQUITY';
const EXCHANGE_CODE = 'CONSID-EXCHANGE';
const STRUCT_OFFER = 'STRUCT-OFFER';
const HEADLINE_ROW_ID = 'consideration-hero-headline';
const PER_SHARE_ROW_ID = 'consideration-hero-per-share';
const APPRAISAL_ROW_ID = 'consideration-hero-appraisalRightsAvailable';
const OTHER_PROVISIONS_ROW_ID = 'consideration-hero-other-provisions';
// Rendered as coloured PillCell chips (not run through TruncatedWithSeeText):
// short enum/quantitative facts per the global "pills for enum/quantitative
// signals" rule. Everything else on this card stays on the existing
// TruncatedWithSeeText path (mixed-shape family -- some rows carry long
// structured-mechanics text with no pill equivalent, e.g. collar/proration).
const PILL_DETAIL_IDS = new Set([HEADLINE_ROW_ID, APPRAISAL_ROW_ID]);

const DIRECT_ROWS = [
  ['exchangeRatio', 'Exchange ratio', 'Stock'],
  ['exchangeRatioText', 'Exchange-ratio formula', 'Stock'],
  ['offerConsideration', 'Offer consideration', 'Tender offer'],
  ['offerPrice', 'Offer price', 'Tender offer'],
  ['prorationMechanics', 'Proration / election mechanics', 'Election'],
  ['electionMechanics', 'Election mechanics', 'Election'],
  ['collar', 'Collar', 'Stock'],
  ['walkAwayRight', 'Walk-away right', 'Stock'],
  ['appraisalRightsAvailable', 'Appraisal rights', 'Rights'],
  ['withholdingProvision', 'Withholding', 'Mechanics'],
  ['cvrMilestonePayments', 'CVR milestone payments', 'CVR'],
];
const CVR_ROWS = [
  ['triggers', 'CVR triggers'],
  ['maxPayment', 'CVR maximum payment'],
  ['term', 'CVR term'],
  ['transferable', 'CVR transferable'],
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy was stale -- it rendered `.text` whenever
// present (no label/code-first priority, no text-vs-code redundancy check),
// which is what leaked raw `{"espp":"...",...}` JSON for equityAwardTreatment
// and appended the raw code after the label for vestingAcceleration (e.g.
// "Accelerates ... : ACCEL_ELSE_DOUBLE_TRIGGER"). card-utils.js's version
// fixes both. (Both of those fields have since moved to equity-awards.config.js
// entirely -- see the header comment above -- but the import stays as the
// single source of truth for every remaining structured-value row here.)
function hasConsiderationSignal(card) {
  const code = cardCode(card);
  // Equity is owned exclusively by equity-awards.config.js. Excluded up
  // front so it can never re-enter via the regex/feature fallback below
  // (equity clauses routinely mention "consideration" and "per share").
  if (code === EQUITY_CODE) return false;
  if (CONSID_CODES.includes(code) || code === STRUCT_OFFER) return true;
  const features = cardFeatures(card);
  if (['considerationType', 'perShareAmount', 'cashAmount', 'exchangeRatio', 'offerConsideration', 'offerPrice'].some((key) => valueText(features[key]))) return true;
  return /\bconsideration|per share|exchange ratio|CVR|offer price/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
// Ben (Skechers r16, item 1): "for all deals with proration, add how it
// works." The prorationMechanics row used to surface only the FIRST card's
// mechanics object -- on Skechers that's the CONSID-CONVERT card, whose
// `.text` is the non-election default and whose oversubscriptionTreatment
// is null, so the row said THAT an election exists but not the proration
// mechanism (which lives on the CONSID-EXCHANGE card's mechanics object).
// Mirrors review-v2/ElectionCard.jsx's summarizeOversubscription approach:
// the mechanism line is derived DETERMINISTICALLY from the clause shape
// (which side's elections exceed which cap), never paraphrased by a model.
// Corpus-validated against every deck carrying prorationMechanics
// (QXO/TopBuild and 3G/Skechers -- the only true proration deals in the
// cached corpus; SkyWater affirmatively has no proration and carries no
// mechanics object). When no shape matches, returns null and the row keeps
// its prior rendering -- never a raw dump, never a guess.
function allProrationMechanics(cards) {
  const hits = [];
  for (const card of cards) {
    for (const key of ['prorationMechanics', 'electionMechanics']) {
      const value = cardFeatures(card)[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) hits.push({ value, card });
    }
  }
  return hits;
}
// r17 (Ben): "the oversubscription rows look generic — check they are
// technically correct, there are different types of proration." One shared
// clause-shape detector for the OVERSUBSCRIPTION clause, used by both this
// config's proration row and review-v2/ElectionCard.jsx. Distinct shapes,
// each corpus-verified against the deck that carries it:
//   - two-sided caps (QXO/TopBuild §2.1(b)(ii)(E)/(F): cash cap AND stock
//     cap, whichever side oversubscribes is prorated back, balance paid in
//     the other form; the undersubscribed side is honored in full);
//   - one-sided cash or stock cap (same family, only one side capped);
//   - one-sided equity/mixed cap (3G/Skechers §2.9(a): mixed elections
//     prorated per holder back to the Maximum Equity Election Cap, the
//     remainder converted into the cash election consideration; the cash
//     side is uncapped and never prorated).
// Returns NULL when no shape is confidently detected -- callers must then
// show the verbatim clause behind "See provision" with NO derived sentence
// (a generic line that reads as extracted is worse than none).
export function summarizeOversubscription(text) {
  const t = String(text || '');
  const cashOver = /Cash Election Shares exceeds the Maximum Cash/i.test(t);
  const stockOver = /Stock Election Shares exceeds the Maximum Stock/i.test(t);
  const mixedOver = /Mixed Election Shares exceeds the Maximum (?:Equity|Mixed)[\w ]*?(?:Cap|Number)/i.test(t);
  if (cashOver && stockOver) {
    return 'If either side is oversubscribed, the other side receives its chosen form in full and the oversubscribed elections are prorated back to the cap (balance paid in the other form).';
  }
  if (cashOver) return 'If cash elections exceed the cap, stock elections are honored in full and cash elections are prorated back to the cap (balance paid in stock).';
  if (stockOver) return 'If stock elections exceed the cap, cash elections are honored in full and stock elections are prorated back to the cap (balance paid in cash).';
  if (mixedOver) {
    const remainderCash = /remaining[\s\S]{0,120}?Cash (?:Election )?Consideration/i.test(t);
    return `If mixed (cash + stock) elections exceed the equity election cap, each holder's mixed elections are prorated back to the cap pro rata${remainderCash ? ', with the remainder paid as the cash election consideration' : ''}.`;
  }
  return null;
}
// r17: election-deadline summarizer, moved here from review-v2/ElectionCard
// so it is shared and node-testable (ElectionCard.jsx is JSX). Collapses the
// boilerplate timing clause to its one operative fact ("5 business days
// before the Company Stockholder Meeting"). Extended for the Skechers shape
// ("five Business Days preceding the anticipated Closing Date"). Returns
// NULL when the pattern doesn't match -- the caller keeps the verbatim
// clause behind See provision and renders no derived sentence. (It used to
// return the raw text, which on Skechers echoed the bare defined term
// "Election Deadline" as if it were an extracted date.)
const WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const DEADLINE_ANCHOR = '((?:anticipated\\s+)?[A-Z][\\w\\s]*?(?:Meeting|Effective Time|Date|Closing))';
export function summarizeElectionDeadline(text) {
  const t = String(text || '');
  const m = t.match(new RegExp(`(?:(\\w+)\\s*)?\\((\\d+)\\)\\s*business days?\\s*(prior to|before|after|following|preceding)\\s*(?:the date of\\s*)?the\\s+${DEADLINE_ANCHOR}`, 'i'))
    || t.match(new RegExp(`(\\w+|\\d+)\\s+business days?\\s*(prior to|before|after|following|preceding)\\s*(?:the date of\\s*)?the\\s+${DEADLINE_ANCHOR}`, 'i'));
  if (!m) return null;
  const parts = m.slice(1).filter((x) => x !== undefined);
  const numRaw = parts[0];
  const num = /^\d+$/.test(numRaw) ? numRaw : (parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : WORD_NUMS[String(numRaw).toLowerCase()] || numRaw);
  const rel = parts.find((x) => /prior to|before|after|following|preceding/i.test(x)) || 'before';
  const anchor = parts[parts.length - 1].trim();
  return `${num} business days ${/prior|before|preceding/i.test(rel) ? 'before' : 'after'} the ${anchor}`;
}
// `extraClauseText` (r17): the owning cards' verbatim quotes. The
// non-election default sometimes lives OUTSIDE the mechanics object -- QXO
// routes non-electing holders WITH the stock side ("shall be deemed to be
// Company Shares in respect of which Stock Elections have been made"),
// stated in §2.1(b)(ii)(B), not in prorationMechanics -- which matters:
// deemed-stock shares share in any stock-side proration.
function summarizeProrationMechanism(mechanicsList, extraClauseText) {
  const list = (mechanicsList || []).filter(Boolean);
  if (!list.length) return null;
  const overs = list.map((m) => String(m.oversubscriptionTreatment || '')).join('\n');
  const texts = list.map((m) => String(m.text || '')).join('\n');
  const all = `${overs}\n${texts}`;
  const withCards = `${all}\n${String(extraClauseText || '')}`;
  const parts = [];
  const mechanism = summarizeOversubscription(overs);
  if (!mechanism) return null; // no confident mechanism -> show nothing new
  parts.push(mechanism);
  // -- election caps, when the clause states them as percentages. Name the
  // denominator when the clause caps a NUMBER OF SHARES (QXO: "45% of the
  // aggregate number of Company Shares issued and outstanding") -- a
  // by-shares cap is not the same thing as a cap on aggregate value. --
  const capCash = all.match(/\((\d{1,2}(?:\.\d+)?)%\)[^"“]{0,220}?["“]Maximum Cash Election/i);
  const capStock = all.match(/\((\d{1,2}(?:\.\d+)?)%\)[^"“]{0,320}?["“]Maximum Stock Election/i);
  if (capCash && capStock) {
    const byShares = /%\)\s*of the aggregate number of [\w\s]{0,60}?Shares issued and outstanding/i.test(all);
    const stockCapFlex = /Maximum Stock Election Number|Stock Consideration/i.test(all) && /may be increased \(but not decreased\) by Parent/i.test(all);
    parts.unshift(`Caps: ${capCash[1]}% cash / ${capStock[1]}% stock${byShares ? ' of outstanding shares' : ''}${stockCapFlex ? ' (Parent may increase the stock cap)' : ''}.`);
  }
  // -- non-election default. Two corpus shapes: (a) Skechers "Non-Election
  // Shares ... right to receive the X Consideration"; (b) QXO "deemed to be
  // ... Shares in respect of which Stock Elections have been made" (the
  // deemed side then participates in that side's proration). --
  const nonElection = all.match(/Non-Election Shares[\s\S]{0,220}?right to receive (?:the )?([A-Z][\w -]*?Consideration)/);
  if (nonElection) {
    parts.push(`Shares with no valid election receive the ${nonElection[1]}.`);
  } else {
    const deemed = withCards.match(/deemed to be [^.]{0,160}?(Stock|Cash) Elections? (?:have|has) been made/i);
    if (deemed) {
      const side = deemed[1];
      const sideProrated = (side === 'Stock' && /Stock Election Shares exceeds the Maximum Stock/i.test(overs)) || (side === 'Cash' && /Cash Election Shares exceeds the Maximum Cash/i.test(overs));
      parts.push(`Shares with no valid election are deemed ${side} Elections${sideProrated ? ' (and are prorated with that side if it is oversubscribed)' : ''}.`);
    }
  }
  return parts.join(' ');
}
// Full source language backing the mechanism line: every mechanics object's
// own text + oversubscription clause, plus the owning cards' quotes.
function prorationEvidence(hits) {
  const chunks = [];
  for (const { value } of hits) {
    if (value.text) chunks.push(String(value.text));
    if (value.oversubscriptionTreatment) chunks.push(String(value.oversubscriptionTreatment));
  }
  return chunks.filter(Boolean).join('\n\n');
}

function makeRow(id, label, kind, value, card, electionOption) {
  const detail = valueText(value);
  if (!detail) return null;
  // r9: thread the owning card so the generic table's row-click wiring
  // resolves — "why can't I click Appraisal rights and see the sidebar?"
  // Every direct row here reads off exactly one card, so this is safe.
  const row = { id: `consideration-hero-${id}`, label, kind, detail, evidence: textOf(card), present: true, card: card || null };
  if (electionOption) row.electionOption = electionOption;
  return row;
}
// Shared with the rollup: CVR max is normally read off a dedicated
// CONSID-CVR card, but several deals (Metsera included) fold the CVR max
// payment onto the SAME card as perShareAmount (CONSID-CONVERT) with no
// separate CONSID-CVR card at all -- fall back to any card's maxPayment
// feature so both shapes resolve the same computed value.
function resolveCvrMax(cards) {
  const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
  if (cvrCard) return { text: numericDollarOnly(cardFeatures(cvrCard).maxPayment), card: cvrCard };
  const hit = firstFeature(cards, 'maxPayment');
  return hit ? { text: numericDollarOnly(hit.value), card: hit.card } : { text: null, card: null };
}
// Feature values sometimes arrive as a bare number/numeric string (Metsera's
// perShareAmount is stored as 47.5, not "$47.50") -- valueText() renders that
// unchanged, so a downstream "<perShare> in cash" pill loses its dollar sign
// entirely. Only prefixes when the text is purely numeric-leading and has no
// "$" already; text like "$47.50" or "12.00 per share" (already has "$" or
// is not a bare number) passes through untouched.
function ensureDollarPrefix(text) {
  if (!text) return text;
  const trimmed = String(text).trim();
  if (trimmed.startsWith('$') || !/^-?\d/.test(trimmed)) return trimmed;
  // Pure numeric amount -> 2-decimal currency (Ben: "$47.5" should be "$47.50").
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `$${Number(trimmed).toFixed(2)}`;
  return `$${trimmed}`;
}
// A genuine per-share price/formula is short -- "$47.50", "20.200 Parent
// Shares", "$0.50 plus contingent consideration per Exhibit A". Ben
// (Bioverativ, round 2): one deal's "offerPrice" feature was corrupted --
// it held the tender-offer COMMENCEMENT clause ("...as promptly as
// practicable but in no event later than fifteen (15) Business Days after
// the date of this Agreement, Merger Sub shall..."), which starts with a
// bare "01" digit and (via ensureDollarPrefix) rendered as "$01, as
// promptly as practicable..." -- a paragraph masquerading as a price. Only
// treat offerPrice as a per-share proxy when it's actually price-shaped.
function looksLikePriceValue(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.length > 40) return false;
  return /^\$?[\d,]+(\.\d+)?/.test(trimmed);
}
function perShareParts(features, cards) {
  const offerPriceText = valueText(features.offerPrice);
  const perShare = ensureDollarPrefix(
    valueText(features.perShareAmount)
    || valueText(features.cashAmount)
    || (looksLikePriceValue(offerPriceText) ? offerPriceText : null),
  );
  const cvrCards = cvrCandidateCards(cards);
  const joined = `${valueText(features.considerationType) || ''} ${cvrCards.map(textOf).join(' ')}`;
  const hasCvr = /\bCVR\b|contingent value right/i.test(joined) || cvrCards.some((card) => cardCode(card) === 'CONSID-CVR');
  const hasCash = Boolean(perShare) || /\bcash\b|\$\s?\d/i.test(joined) || /all-cash|all cash/i.test(valueText(features.considerationType) || '');
  const cvrMax = resolveCvrMax(cards).text;
  return buildPerShareParts({ perShareText: perShare, hasCvr, hasCash, cvrMaxText: cvrMax });
}
function firstFeature(cards, key) {
  for (const card of cards) {
    const features = cardFeatures(card);
    if (valueText(features[key])) return { value: features[key], card };
  }
  return undefined;
}
// cvrMilestonePayments items ({code, label, text}) sometimes arrive with an
// empty `label` (the defined-term parse in extract.js's exhibit scan came
// back blank for that item) -- valueText() then falls back to the bare
// taxonomy code ("CVR_MILESTONE"), which reads as a raw enum error, not a
// value. cvrMilestonePayments has no taxonomy dict (taxonomyForFeatureKey
// returns null for it -- there is no CVR_MILESTONE -> friendly-label
// mapping anywhere in lib/taxonomy.js), so labelForCode is tried first for
// forward-compatibility but is expected to come back empty here; items that
// resolve to nothing better than the bare code are dropped rather than
// rendered. If every item on the card is code-only, the whole row is
// dropped -- a bare code adds nothing.
function meaningfulCvrMilestones(value) {
  const items = Array.isArray(value) ? value : [value];
  const dict = taxonomyForFeatureKey('cvrMilestonePayments');
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return Boolean(valueText(item));
    const code = item.code || null;
    const resolved = item.label || (code && dict && labelForCode(String(code), dict)) || null;
    return Boolean(resolved) && resolved !== code;
  });
}

// Ben (Bioverativ, round 2): hasCvrSignal used to scan EVERY card
// hasConsiderationSignal pulled in -- including reps/definitions matched by
// its own loose fallback regex -- for the bare substring "CVR". A
// capitalization rep's boilerplate ("no stock appreciation rights,
// contingent value rights, phantom stock...") false-positived a plain
// all-cash deal into "Cash + CVR" on the masthead. Only cards that could
// genuinely describe the deal's OWN consideration structure (CONSID_CODES)
// get to vote on whether a CVR exists.
function cvrCandidateCards(cards) {
  return cards.filter((card) => CONSID_CODES.includes(cardCode(card)));
}
function hasCvrSignal(cards) {
  const candidates = cvrCandidateCards(cards);
  return candidates.some((card) => cardCode(card) === 'CONSID-CVR' || /\bCVR\b|contingent value right/i.test(`${valueText(cardFeatures(card).considerationType) || ''} ${textOf(card)}`));
}
function headlineLabel(headlineType, cards, featuresList) {
  if (hasCvrSignal(cards)) {
    if (headlineType === 'CASH') return 'Cash + CVR';
    if (headlineType === 'STOCK') return 'Stock + CVR';
    if (headlineType === 'MIXED') return 'Mixed + CVR';
  }
  return headlineConsiderationLabel(headlineType, featuresList);
}

// IMPROVEMENT (spec §2): a computed maximum showing the highest per-share
// value a holder could receive (base cash/stock consideration + the CVR's
// maximum contingent payment), e.g. "Up to $70.00 / share" for Metsera's
// $47.50 cash + up to $22.50 CVR. Only computes when BOTH amounts resolve to
// real numbers -- never fabricates a total from a partial figure. Rendered
// on the right-hand side of the per-share consideration row itself (not a
// separate row -- the two figures describe the same economics).
function parseDollarNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const inner = typeof raw === 'object' ? (raw.value ?? raw.text ?? raw.label) : raw;
  if (inner === null || inner === undefined || inner === '') return null;
  const digits = String(inner).replace(/[^0-9.\-]/g, '');
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}
function computeMaxConsideration(cards) {
  const perShareHit = firstFeature(cards, 'perShareAmount') || firstFeature(cards, 'cashAmount');
  const { text: cvrMaxText, card: cvrMaxCard } = resolveCvrMax(cards);
  const perShareNum = perShareHit ? parseDollarNumber(perShareHit.value) : null;
  const cvrMaxNum = parseDollarNumber(cvrMaxText);
  if (perShareNum === null || cvrMaxNum === null) return null;
  const total = perShareNum + cvrMaxNum;
  const evidence = [perShareHit?.card, cvrMaxCard].filter(Boolean).map(textOf).filter(Boolean).join(' ');
  return { detail: `Up to $${total.toFixed(2)} / share`, evidence };
}

// "Other provisions in this section" (spec §2): payment/exchange mechanics
// is a LINK off the CONSID-EXCHANGE card, never a "Yes" boolean row --
// structure-mechanics.config.js deliberately dropped that row entirely on
// the same basis (see its header comment).
function otherProvisionsRow(exchangeCard) {
  if (!exchangeCard) return null;
  return {
    id: OTHER_PROVISIONS_ROW_ID,
    label: 'Other provisions in this section',
    kind: 'Link',
    detail: 'Exchange of Certificates / Payment Mechanics',
    isLink: true,
    evidence: textOf(exchangeCard),
    sourceCard: exchangeCard,
    present: true,
  };
}

function renderPillDetail(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return row.detail;
  const tone = row.id === APPRAISAL_ROW_ID ? (row.detail === 'Yes' ? 'present' : 'missing') : 'neutral';
  return React.createElement(PillCell, { label: row.detail, tone, evidence: row.evidence });
}

// Per-share row: the pattern the DESIGN-REFERENCE / spec both call for --
// "[$47.50 in cash] + [1 CVR (up to $22.50)]" as distinct pills joined by a
// plain "+", not one flattened string. row.parts (attached in selectRows)
// carries buildPerShareParts' own pill/plus split so this stays a pure
// render of already-computed data. When the computed max (cash + CVR max)
// is available, it renders on the right-hand side of this SAME row -- not
// as its own row -- since it's just the ceiling of the same economics.
function renderPerShareDetail(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell || !Array.isArray(row.parts) || !row.parts.length) return row.detail;
  const left = React.createElement(
    'span',
    { className: 'inline-flex flex-wrap items-center gap-1' },
    row.parts.map((part, index) => (
      part.type === 'plus'
        ? React.createElement('span', { key: `plus-${index}`, className: 'text-[11px] text-inkFaint' }, part.text)
        : React.createElement(PillCell, { key: `pill-${index}`, label: part.text, tone: 'present', evidence: row.evidence })
    )),
  );
  if (!row.maxDetail) return left;
  const right = React.createElement(
    'span',
    { className: 'inline-flex flex-wrap items-center gap-1' },
    React.createElement('span', { className: 'text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, 'Max:'),
    React.createElement(PillCell, { label: row.maxDetail, tone: 'info', evidence: row.maxEvidence || row.evidence }),
  );
  return React.createElement(
    'span',
    { className: 'flex flex-wrap items-center justify-between gap-2' },
    left,
    right,
  );
}

// Link, not a "Yes" pill: EvidenceHoverSource is the existing lightweight
// hover affordance (reused, not a new primitive) so the link still surfaces
// the CONSID-EXCHANGE card's evidence on hover; the anchor itself has no
// real target in this schema-driven layout (there is no separate payment-
// mechanics section to scroll to), so its click is a no-op -- the value is
// naming the other provision and its evidence, matching the old page's
// "Other provisions in this section" line.
function renderLinkDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  const linkNode = React.createElement(
    'a',
    {
      href: '#',
      onClick: (event) => event.preventDefault(),
      className: 'inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800',
    },
    row.detail,
    React.createElement('span', { 'aria-hidden': 'true' }, '→'),
  );
  if (!EvidenceHoverSource) return linkNode;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, linkNode);
}

// ELECTION-REDO-SPEC-2026-07-16 step 4: "tag the existing Consideration table
// rows with their option (→ Cash Election pill) using the appliesTo
// attribution." Renders as a small trailing badge next to whatever the row
// already shows -- never replaces the row's own detail, just attributes it.
function renderElectionAttributionBadge(row, ctx) {
  if (!row.electionOption) return null;
  const PillCell = ctx?.primitives?.PillCell;
  const label = `→ ${row.electionOption}`;
  if (!PillCell) {
    return React.createElement('span', { className: 'ml-1.5 text-[10px] font-ui text-sky-700' }, label);
  }
  return React.createElement(PillCell, { label, tone: 'info', evidence: row.evidence });
}

// Item 1 (Skechers r16): concise derived mechanism line, with the FULL
// proration/election clause behind the same "See provision" <details>
// affordance the shared primitives use -- the summary is short, so
// ClampedWithSeeText alone would render it with no expansion at all and the
// source language would be reachable only via hover.
function renderProrationSummary(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  const summaryNode = EvidenceHoverSource
    ? React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard || row.card, as: 'span' }, row.detail)
    : row.detail;
  if (!row.evidence) return summaryNode;
  return React.createElement(
    'span',
    null,
    summaryNode,
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        row.evidence,
      ),
    ),
  );
}

function renderDetail(row, ctx) {
let base;
  if (row.isLink) base = renderLinkDetail(row, ctx);
  else if (row.prorationSummary) base = renderProrationSummary(row, ctx);
  else if (row.id === PER_SHARE_ROW_ID && Array.isArray(row.parts)) base = renderPerShareDetail(row, ctx);
  else if (PILL_DETAIL_IDS.has(row.id)) base = renderPillDetail(row, ctx);
  else {
    // Ben (Bioverativ): this header table can carry very long prose values —
    // clamp to ~3 lines with the standard "see provision" expander.
    const ClampedWithSeeText = ctx?.primitives?.ClampedWithSeeText;
    base = ClampedWithSeeText
      ? React.createElement(ClampedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.sourceCard })
      : row.detail;
  }
  const badge = renderElectionAttributionBadge(row, ctx);
  if (!badge) return base;
  return React.createElement(
    'span',
    { className: 'inline-flex flex-wrap items-center gap-1.5' },
    base,
    badge,
  );
}

const considerationHeroConfig = {
  id: 'consideration-hero',
  title: 'Consideration',
  layoutSlot: 'consideration',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    const cards = allCards.filter(hasConsiderationSignal);
    const exchangeCard = allCards.find((card) => cardCode(card) === EXCHANGE_CODE);
    if (!cards.length && !exchangeCard) return [];
    const featuresList = cards.map(cardFeatures);
    const headlineType = deriveHeadlineConsiderationType(featuresList);
    const headline = headlineLabel(headlineType, cards, featuresList) || valueText(firstFeature(cards, 'considerationType')?.value);
    const rows = [];
    if (headline) rows.push(makeRow('headline', 'Consideration type', 'Summary', headline, cards[0]));

    // ELECTION-REDO-SPEC-2026-07-16 step 4: the deal's election mechanism
    // (if any true election exists), used to tag the rows below with
    // "→ Cash Election" / "→ Stock Election" pills via appliesTo
    // attribution -- the un-attributed-rows bug this redo kills.
    const electionMechanism = findElectionMechanism(allCards);
    const mergedFeatures = featuresList.reduce((acc, features) => ({ ...acc, ...features }), {});

    const parts = perShareParts(mergedFeatures, cards);
    const perShareText = parts.map((part) => part.text).join(' ');
    if (perShareText) {
      const perShareRawValue = mergedFeatures.perShareAmount ?? mergedFeatures.cashAmount ?? mergedFeatures.offerPrice;
      const row = makeRow('per-share', 'Per-share consideration', 'Economics', perShareText, cards[0], electionAttributionLabel(electionMechanism, 'perShareAmount', perShareRawValue));
      if (row) {
        row.parts = parts;
        // Max consideration (cash + CVR max) renders on the right of THIS
        // row (see renderPerShareDetail), never as its own row.
        const max = computeMaxConsideration(cards);
        if (max) {
          row.maxDetail = max.detail;
          row.maxEvidence = max.evidence;
        }
        rows.push(row);
      }
    }

    for (const [key, label, kind] of DIRECT_ROWS) {
      const hit = firstFeature(cards, key);
      if (!hit) continue;
      // Item 1 (Skechers r16): the proration row surfaces the derived
      // MECHANISM line (merged across every card carrying mechanics -- the
      // oversubscription clause often lives on a different card than the
      // election/default text), with the full source language behind the
      // row's "See provision" affordance. Falls through to the ordinary
      // rendering when no mechanism can be confidently derived.
      if (key === 'prorationMechanics') {
        const hits = allProrationMechanics(cards);
        const summary = summarizeProrationMechanism(hits.map((h) => h.value), hits.map((h) => textOf(h.card)).join('\n'));
        if (summary) {
          const row = makeRow(key, label, kind, summary, hits[0]?.card || hit.card, electionAttributionLabel(electionMechanism, key, hit.value));
          if (row) {
            row.detail = summary;
            row.prorationSummary = true;
            row.evidence = prorationEvidence(hits) || row.evidence;
            rows.push(row);
          }
          continue;
        }
      }
      if (key === 'cvrMilestonePayments') {
        const items = meaningfulCvrMilestones(hit.value);
        if (items.length) rows.push(makeRow(key, label, kind, items, hit.card));
        continue;
      }
// Ben (Bioverativ, round 2): 'offerPrice' occasionally arrives corrupted —
      // a whole unrelated clause instead of a price. A genuine price never
      // runs to multiple sentences; a >200-char value here is prose, so drop.
      if (key === 'offerPrice' && String(valueText(hit.value) || '').length > 200) continue;
      rows.push(makeRow(key, label, kind, hit.value, hit.card, electionAttributionLabel(electionMechanism, key, hit.value)));
    }
    const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
    if (cvrCard) {
      for (const [key, label] of CVR_ROWS) {
        rows.push(makeRow(`cvr-${key}`, label, 'CVR', cardFeatures(cvrCard)[key], cvrCard));
      }
    }

    const otherProvisions = otherProvisionsRow(exchangeCard);
    if (otherProvisions) rows.push(otherProvisions);

    return rows.filter(Boolean);
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { considerationHeroConfig, renderDetail, summarizeProrationMechanism };
