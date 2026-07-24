import React from 'react';
import { firstFeature, splitForCell, textOf, valueText } from './card-utils.js';
import { nosolNoshopConfig, renderDetail as noshopRenderDetail, renderSignals as noshopRenderSignals } from './nosol-noshop.config.js';
import { nosolSuperiorConfig, renderSignals as superiorRenderSignals } from './nosol-superior.config.js';
import { nosolInterveningConfig, renderDetail as interveningRenderDetail, renderSignals as interveningRenderSignals } from './nosol-intervening.config.js';
import { nosolFiduciaryConfig, renderSignals as fiduciaryRenderSignals } from './nosol-fiduciary.config.js';

// Rebuilt per FEEDBACK-2-PUNCHLIST.md #41-#43, reordered again per
// FEEDBACK-4-PUNCHLIST.md WS-G. Old site: NO-SOLICITATION was ONE section on
// the page (old NosolFourTables mounted under a single NOSOL header, never
// as four top-level siblings) -- this file wraps all four per-family
// configs (nosol-noshop / nosol-superior / nosol-intervening /
// nosol-fiduciary) as SUB-GROUPS of one "No-Solicitation / No-Shop"
// accordion entry.
//
// WS-G reading order (top to bottom): No-Shop Core Mechanics FIRST (cease ->
// prohibited acts as pills -> exceptions in plain language -> the folded-in
// Representatives control standard (T4) -> standstill enforcement) ->
// Fiduciary-Out / Engagement -> Acquisition Proposal - Definition (NEW,
// built directly from the DEFINITION/NOSOL-ACQPROPOSAL cards -- see
// buildAcquisitionProposalGroup() below) -> Notice -> Matching Rights ->
// Superior Proposal (now also carrying the folded-in Company-termination-
// for-Superior-Proposal row, T6) -> Intervening Event -> Change of
// Recommendation.
//
// Each of the four *.config.js files is UNCHANGED apart from nosol-noshop's
// prohibited-act/exception rendering (added `.acts`/`.exceptionItems` on the
// existing 'prohibit'/'exceptions' rows, same ids, same `.detail` synthesis)
// -- so their existing standalone tests keep passing. This file only
// reshapes how the SAME rows are grouped/ordered for display, reusing each
// config's own renderSignals/renderDetail so every pill/collapsed-text/
// standard-colour/evidence-hover behaviour is byte-for-byte what the
// standalone table already rendered.
//
// Several feature keys are claimed by more than one of the four configs
// (that's #43's duplication: the same fact showing up two or three times
// across the old four-sibling layout). Rather than mutate the source
// configs' selectRows (which would break their tests and their `title`/
// standalone-render usefulness if ever unmounted individually), dedup here:
// GROUP_DEFS below is an explicit allow-list of exactly one row id per
// concept, in its correct bucket. Every row id produced by all four
// selectRows() calls is accounted for below -- either included once, or
// deliberately excluded as a same-concept duplicate of an included row
// (see the "excluded as duplicate" comments per bucket).

// Mirrors ProvisionTable.jsx's FULL_TEXT_COLUMNS relocation: nosol-noshop and
// nosol-intervening have a third 'detail' column whose renderCell is meant to
// render behind a per-row "see text" toggle rather than inline (see that
// file's FULL_TEXT_COLUMNS map). nosol-superior / nosol-fiduciary have no
// such column -- their 'signals' column ("Provision") is the whole cell.
const SOURCES = {
  noshop: { config: nosolNoshopConfig, renderSignals: noshopRenderSignals, renderDetail: noshopRenderDetail },
  superior: { config: nosolSuperiorConfig, renderSignals: superiorRenderSignals, renderDetail: null },
  intervening: { config: nosolInterveningConfig, renderSignals: interveningRenderSignals, renderDetail: interveningRenderDetail },
  fiduciary: { config: nosolFiduciaryConfig, renderSignals: fiduciaryRenderSignals, renderDetail: null },
};

// Item 8 (round 3): returns { signal, seeTextContent } separately -- the
// signal pill stays the row's VALUE (right) cell content, the "See
// provision" toggle renders under the LABEL (left) cell.
// Item 2 (r6) audit completion: this was the last row-level "See provision"
// still built as its own in-cell <details> squeezed into the label column
// (the local seeText() helper, now removed). Passing the raw detail node as
// row.seeTextContent hands it to GroupedSubRows' shared full-width
// block-below-the-row expansion instead -- the same pattern the reps/MAE/
// conditions tables were ported to in this batch.
function rowNode(row, ctx, source) {
  const signal = source.renderSignals(row, ctx);
  const detail = source.renderDetail ? source.renderDetail(row, ctx) : null;
  // Guard against the (rare) case where the relocated detail is identical to
  // what's already inline in the pill -- still shown today in the standalone
  // tables via the same "see text" affordance, so kept for parity; only
  // skipped here if renderDetail returned nothing at all.
  return { signal, seeTextContent: detail || row.seeTextContent || null };
}

function byId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row && row.id) map.set(row.id, row);
  }
  return map;
}

// ── WS-G reading order: no-shop core mechanics -> fiduciary-out/engagement ->
// Acquisition Proposal definition (spliced in by buildGroups(), see below) ->
// notice -> matching -> superior -> intervening -> change-of-rec.
const GROUP_DEFS = [
  {
    id: 'nosol-no-shop-core',
    label: 'No-Shop Core Mechanics',
    items: [
      // WS-G #1: cease existing discussions stated first, then the
      // prohibited acts (rendered as individual pills -- see nosol-noshop's
      // rowForSpec/renderSignals), then -- WS-G #3 / T4 -- "Representatives
      // control standard" folded in here from the Change of Recommendation
      // bucket (it's a no-shop enforcement mechanic, who the Company must
      // control, not a change-of-recommendation fact) directly under the
      // restriction it enforces, and only then the exceptions in plain
      // language.
      { source: 'noshop', id: 'nosol-noshop-cease' },
      { source: 'noshop', id: 'nosol-noshop-prohibit' },
      { source: 'fiduciary', id: 'nosol-fiduciary-reps' },
      { source: 'noshop', id: 'nosol-noshop-exceptions' },
      { source: 'noshop', id: 'nosol-noshop-standstill-enforce' },
    ],
    // Excluded as duplicates: nosol-noshop-matching-period (-> Matching Rights,
    // sourced from nosol-fiduciary-initial-match), nosol-noshop-notice-hours
    // (-> Notice), nosol-noshop-superior-threshold (-> Superior Proposal,
    // sourced from nosol-superior-threshold), nosol-noshop-fiduciary-standard
    // (-> Fiduciary-Out / Engagement, sourced from nosol-fiduciary-fiduciary-
    // standard), nosol-noshop-subsequent-match (-> Matching Rights, sourced
    // from nosol-fiduciary-subsequent-match), nosol-noshop-change-of-rec-count
    // (-> Change of Recommendation, sourced from the fuller
    // nosol-fiduciary-change-of-rec-items list), nosol-noshop-acquisition-
    // definition / nosol-noshop-acquisition-threshold (-> Acquisition
    // Proposal - Definition, superseded there by the DEFINITION-card-backed
    // block, which is accurate on real deals where these feature keys are
    // never populated).
  },
  {
    id: 'nosol-fiduciary-engagement',
    label: 'Fiduciary-Out / Engagement',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-engage' },
      { source: 'fiduciary', id: 'nosol-fiduciary-final' },
      { source: 'fiduciary', id: 'nosol-fiduciary-fiduciary-standard' },
    ],
    // Excluded as duplicates: nosol-superior-engage, nosol-superior-final
    // (same fiduciaryEngageStandard/fiduciaryFinalStandard keys as the
    // fiduciary rows above), nosol-noshop-fiduciary-standard and
    // nosol-superior-fiduciary-standard (same fiduciaryOutStandard key).
  },
  // Acquisition Proposal - Definition group is spliced in HERE (right after
  // 'nosol-fiduciary-engagement', before 'nosol-notice') by buildGroups() --
  // see buildAcquisitionProposalGroup() below. It isn't a GROUP_DEFS entry
  // because its content comes straight from DEFINITION / NOSOL-ACQPROPOSAL
  // cards, not from one of the four SOURCES configs' selectRows().
  {
    id: 'nosol-notice',
    label: 'Notice',
    items: [
      { source: 'noshop', id: 'nosol-noshop-notice-hours' },
      { source: 'fiduciary', id: 'nosol-fiduciary-notice-period' },
      { source: 'fiduciary', id: 'nosol-fiduciary-notice-content' },
    ],
    // Excluded as duplicate: nosol-intervening-notice-period (same
    // noticePeriod key as nosol-fiduciary-notice-period).
  },
  {
    id: 'nosol-matching',
    label: 'Matching Rights',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-initial-match' },
      { source: 'fiduciary', id: 'nosol-fiduciary-subsequent-match' },
    ],
    // Excluded as duplicates: nosol-noshop-matching-period,
    // nosol-noshop-subsequent-match, nosol-intervening-matching-period (all
    // same matchingPeriod key as the fiduciary rows above).
  },
  {
    id: 'nosol-superior',
    label: 'Superior Proposal',
    items: [
      { source: 'superior', id: 'nosol-superior-threshold' },
      { source: 'superior', id: 'nosol-superior-test' },
      { source: 'superior', id: 'nosol-superior-determiner' },
      // WS-G T6: "Company termination for Superior Proposal" folded in here
      // (sourced directly from the TERMR-SUPERIOR card by nosol-superior's
      // own terminationRow() -- exact code match, not the cross-family regex
      // fallback nosol-fiduciary-termination relies on, which fails to
      // extract anything on real deals like Metsera) so it renders INSIDE
      // the Superior Proposal box rather than as a standalone
      // termination-rights row (removed from that file's TERMR_CANONICAL).
      { source: 'superior', id: 'nosol-superior-termination' },
    ],
    // Excluded as duplicates: nosol-noshop-superior-threshold,
    // nosol-fiduciary-superior-threshold (same superiorProposalThresholdPct
    // key); nosol-fiduciary-superior-test (same superiorProposalTest key).
    // nosol-fiduciary-termination is also a duplicate of the same concept
    // (Company termination for Superior Proposal) but is dropped from
    // display in favour of nosol-superior-termination -- see above.
  },
  {
    id: 'nosol-intervening',
    label: 'Intervening Event',
    items: [
      { source: 'intervening', id: 'nosol-intervening-provision' },
      { source: 'intervening', id: 'nosol-intervening-definition' },
      { source: 'intervening', id: 'nosol-intervening-scope' },
      { source: 'intervening', id: 'nosol-intervening-exceptions' },
      { source: 'intervening', id: 'nosol-intervening-termination' },
    ],
    // Kept as its own standalone block (Ben's explicit preference, see
    // REBUILD-SPECS.md §7): its own definition/scope stay together here
    // rather than being pulled into the Acquisition Proposal - Definition
    // bucket.
  },
  {
    id: 'nosol-change-of-rec',
    label: 'Change of Recommendation',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-board-change' },
      { source: 'fiduciary', id: 'nosol-fiduciary-force-vote' },
      { source: 'fiduciary', id: 'nosol-fiduciary-buyer-termination' },
      { source: 'fiduciary', id: 'nosol-fiduciary-change-of-rec-items' },
      { source: 'fiduciary', id: 'nosol-fiduciary-not-change-of-rec-items' },
    ],
    // Excluded as duplicates: nosol-superior-board-change-standard,
    // nosol-intervening-board-change-standard, nosol-fiduciary-board-change-
    // standard (all same boardChangeStandard key as nosol-fiduciary-board-
    // change above); nosol-noshop-change-of-rec-count (same
    // changeOfRecommendationItems key as nosol-fiduciary-change-of-rec-items,
    // which keeps the full per-item list rather than just a count).
    // Relocated out of this bucket per WS-G: nosol-fiduciary-reps (-> No-Shop
    // Core Mechanics, T4), nosol-fiduciary-termination (dropped -- superseded
    // by the more reliable nosol-superior-termination in the Superior
    // Proposal group, T6).
  },
];

// ── Acquisition Proposal - Definition (WS-G #4) ─────────────────────────────
// NEW sub-block, built directly from DEFINITION / NOSOL-ACQPROPOSAL cards
// rather than the four SOURCES configs (none of the four owns definitional
// cards). Surfaces: the percentage trigger, the positive-enumeration
// transaction types (each a literal keyword match against the verbatim
// clause -- nothing paraphrased/invented), any exclusion/carve-out tail
// found in the full text, and the "Qualifying" fiduciary-out subset
// definition. Renders nothing (and this group is simply omitted) if no
// matching DEFINITION/NOSOL-ACQPROPOSAL card exists on the deal.
function acqProposalBaseCard(cards) {
  const candidates = cards.filter((card) => {
    const code = String(card?.provision_subtype || '').trim().toUpperCase();
    const type = String(card?.provision_type || '').trim().toUpperCase();
    const term = String(card?.defined_term || '').trim().toLowerCase();
    if (code === 'NOSOL-ACQPROPOSAL') return true;
    return type === 'DEFINITION' && /company takeover proposal/.test(term) && !/qualifying/.test(term);
  });
  if (!candidates.length) return null;
  // A card's primary_quote/region_full_text is occasionally truncated on
  // ingestion (seen on Metsera's own DEFINITION-type "Company Takeover
  // Proposal" card, which cuts off mid-word) while a sibling
  // NOSOL-ACQPROPOSAL covenant card carries the complete clause -- pick
  // whichever candidate has the longest text so the % trigger/type/
  // exclusion extraction below never runs against a cut-off quote.
  return candidates.reduce((best, card) => (textOf(card).length > textOf(best).length ? card : best));
}
function acqProposalQualifyingCard(cards) {
  const candidates = cards.filter((card) => {
    const type = String(card?.provision_type || '').trim().toUpperCase();
    const term = String(card?.defined_term || '').trim().toLowerCase();
    return type === 'DEFINITION' && /qualifying/.test(term) && /takeover proposal/.test(term);
  });
  if (!candidates.length) return null;
  return candidates.reduce((best, card) => {
    const bestText = String(best.defined_value || textOf(best));
    const cardText = String(card.defined_value || textOf(card));
    return cardText.length > bestText.length ? card : best;
  });
}
// Item 14 (round 3, Theravance): the old pattern harvested EVERY "NN%" in the
// clause, including percentages that are part of a definitional carve-out
// rather than an acquisition trigger (Theravance's continuity-of-ownership
// carve -- "...will not own, directly or indirectly, at least 80% of the
// surviving company..." -- is not itself a trigger). Every real trigger limb
// on Theravance/Metsera/QXO uses "NN% or more" phrasing; restrict to that.
const PCT_PATTERN = /(\d{1,3})\s*\)?\s*%\s*\)?\s+or\s+more/gi;
function extractPctTriggers(text) {
  const found = new Set();
  let match = PCT_PATTERN.exec(text);
  while (match) {
    found.add(`${Number(match[1])}%`);
    match = PCT_PATTERN.exec(text);
  }
  return [...found];
}
// Positive enumeration of transaction TYPES the definition covers -- each
// pattern is matched against the verbatim clause; only types actually named
// in the clause render a chip.
const ACQ_TYPE_SPECS = [
  { id: 'assets', label: 'Asset acquisition, purchase, sale, license, lease or disposition', pattern: /acquisition, purchase, sale, license, lease or other disposition/i },
  { id: 'equity', label: 'Equity / voting-power acquisition', pattern: /aggregate voting power of the capital stock/i },
  { id: 'merger', label: 'Merger, consolidation or business combination', pattern: /merger, consolidation, business combination/i },
  { id: 'tender', label: 'Tender or exchange offer', pattern: /tender offer, exchange offer/i },
  { id: 'restructuring', label: 'Recapitalization, liquidation, dissolution or share exchange', pattern: /recapitalization, liquidation, dissolution/i },
];
function extractExclusionTail(text) {
  const patterns = [
    /other than,?\s+in each case,?\s+the\s+Transactions/i,
    /shall not be deemed[^.]{0,200}/i,
    /does not include[^.]{0,200}/i,
    /\bexcluding\b[^.]{0,200}/i,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) return found[0].replace(/\s+/g, ' ').trim();
  }
  return null;
}
function acqProposalCollapsedText(text, seeLabel) {
  const { value, short, truncated } = splitForCell(text, 90);
  if (!value) return null;
  if (!truncated) return React.createElement('span', { className: 'text-[11px] text-ink' }, value);
  return React.createElement(
    'span',
    null,
    // E (truncation sweep): drop the literal "…" -- the details/"See
    // provision" affordance right below is the tail-hiding mechanism.
    React.createElement('span', { className: 'text-[11px] text-ink' }, short),
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, seeLabel || 'See provision'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        value,
      ),
    ),
  );
}
function acqProposalChipRow(chips, ctx) {
  const valid = chips.filter((chip) => chip && chip.label);
  if (!valid.length) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return React.createElement('span', { className: 'text-[11px] text-ink' }, valid.map((chip) => chip.label).join(' · '));
  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    valid.map((chip, index) => React.createElement(PillCell, {
      key: chip.id || index,
      label: chip.label,
      tone: chip.tone || 'neutral',
      evidence: chip.evidence,
      source: chip.source,
    })),
  );
}
// Ben (round 6): "remove the language and just have the link." A plain
// "see definition" disclosure with the full text hidden -- no inline preview
// sentence before it.
function seeDefinitionLink(text, ctx) {
  if (!ctx || !text) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
    React.createElement('div', { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' }, text),
  );
}
// Acceptable Confidentiality Agreement -> key terms as pills (Ben round 6).
function acaChips(text, card) {
  const t = String(text || '');
  const chips = [];
  if (/customary/i.test(t)) chips.push('Customary confidentiality agreement');
  if (/no\s+less\s+favo[u]?rable|not\s+materially\s+less/i.test(t)) chips.push('No less favourable in aggregate than Parent’s NDA');
  if (/standstill/i.test(t)) chips.push('Standstill not required (if Parent’s standstill is released)');
  return chips.map((label, index) => ({ id: `aca-${index}`, label, tone: 'neutral', evidence: t, source: card }));
}
function buildAcquisitionProposalGroup(reviewDeal, ctx) {
  const cards = reviewDeal?.cards || [];
  const baseCard = acqProposalBaseCard(cards);
  if (!baseCard) return null;
  const baseText = textOf(baseCard);
  const qualifyingCard = acqProposalQualifyingCard(cards);

  const pctChips = extractPctTriggers(baseText).map((pct) => ({ id: `pct-${pct}`, label: `Trigger: ${pct}`, tone: 'info', evidence: baseText, source: baseCard }));
  const typeChips = ACQ_TYPE_SPECS.filter((spec) => spec.pattern.test(baseText)).map((spec) => ({ id: spec.id, label: spec.label, tone: 'neutral', evidence: baseText, source: baseCard }));
  const exclusionText = extractExclusionTail(baseText);
  const exclusionChip = exclusionText
    ? { id: 'exclusion', label: `Excludes: ${exclusionText.replace(/^other than,?\s+in each case,?\s+/i, '')}`, tone: 'warning', evidence: baseText, source: baseCard }
    : null;

  const rows = [{
    id: 'nosol-acqprop-company-takeover',
    label: 'Company Takeover Proposal',
    children: ctx ? React.createElement(
      'div',
      { className: 'space-y-1.5' },
      acqProposalChipRow([...pctChips, ...typeChips, exclusionChip], ctx),
      seeDefinitionLink(baseText, ctx),
    ) : null,
    card: baseCard,
    featureKeys: ['acquisitionTransactionDefinition', 'acquisitionTransactionPctThreshold'],
    marketProvisionCodes: [String(baseCard?.provision_subtype || '').trim().toUpperCase() || 'NOSOL-ACQPROPOSAL'],
    marketSubterms: [
      {
        key: 'transaction-types',
        label: 'Covered transaction types',
        featureKeys: ['acquisitionTransactionDefinition'],
        kind: 'multi_select',
        value: {
          strategy: 'feature_value',
          featureKeys: ['acquisitionTransactionDefinition'],
          normalizer: 'acquisition_transaction_types',
        },
      },
      {
        key: 'threshold',
        label: 'Acquisition threshold',
        featureKeys: ['acquisitionTransactionPctThreshold'],
        kind: 'numeric',
        semantics: { unit: 'percent' },
      },
      {
        key: 'transactions-exclusion',
        label: 'Agreement transactions excluded',
        featureKeys: ['acquisitionTransactionDefinition'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['acquisitionTransactionDefinition'],
          normalizer: 'transactions_exclusion',
        },
      },
    ],
  }];

  if (qualifyingCard) {
    const qualifyingText = String(qualifyingCard.defined_value ? valueText(qualifyingCard.defined_value) : textOf(qualifyingCard));
    // What "Qualifying" does: it's the gateway a proposal must clear before the
    // Company may engage (furnish info / negotiate) -- two crisp pills.
    const qualChips = [
      { id: 'qual-superior', label: 'Could lead to a Superior Proposal', tone: 'info', evidence: qualifyingText, source: qualifyingCard },
      { id: 'qual-fiduciary', label: 'Board good-faith determination (fiduciary-out gateway to engage)', tone: 'neutral', evidence: qualifyingText, source: qualifyingCard },
    ];
    rows.push({
      id: 'nosol-acqprop-qualifying',
      label: 'Qualifying Company Takeover Proposal',
      children: ctx ? React.createElement('div', { className: 'space-y-1.5' }, acqProposalChipRow(qualChips, ctx), seeDefinitionLink(qualifyingText, ctx)) : null,
      card: qualifyingCard,
    });
  }

  return { id: 'nosol-acquisition-proposal', label: 'Acquisition Proposal — Definition', rows };
}

// Ben (round 6): a Go-Shop subtable at the very TOP of the No-Sol section.
// When the deal has no go-shop (Metsera), it renders a single explicit "None"
// row so the absence reads clearly — mirroring the old scheme's goShopDisplay.
function goShopValue(hit) {
  if (!hit) return null;
  const v = valueText(hit.value !== undefined ? hit.value : hit);
  return v || null;
}

const GO_SHOP_MARKET_CODES = [
  'NOSOL-ACQPROPOSAL', 'NOSOL-B', 'NOSOL-CEASE', 'NOSOL-CEASE-DISC',
  'NOSOL-CHANGEREC', 'NOSOL-CONFID', 'NOSOL-COR', 'NOSOL-DATA-ROOM',
  'NOSOL-DISCLOSE', 'NOSOL-ENFORCE', 'NOSOL-EXCEPT', 'NOSOL-EXCEPTION',
  'NOSOL-EXCEPTIONS', 'NOSOL-FIDUCIARY', 'NOSOL-GOSHOP', 'NOSOL-INFORMATION',
  'NOSOL-INTERVENING', 'NOSOL-M', 'NOSOL-MATCH', 'NOSOL-NEGOTIATE',
  'NOSOL-NOTICE', 'NOSOL-OTHER', 'NOSOL-PROHIBIT', 'NOSOL-RECOMMEND',
  'NOSOL-REMATCH', 'NOSOL-STANDSTILL-WAIVER', 'NOSOL-SUPERIOR', 'NOSOL-T',
  'NOSOL-WAIVER', 'NOSOL-WINDOW',
];
const GO_SHOP_PRESENCE_KEYS = ['goShopPresent', 'goShopPeriodDays', 'goShopWindow', 'extendedNegotiatingPeriodDays'];
const GO_SHOP_MARKET_PRESENCE = {
  strategy: 'feature_non_empty',
  featureKeys: GO_SHOP_PRESENCE_KEYS,
  absentValues: ['FALSE', 'NO', 'NONE', 'NOT_PRESENT'],
  missingState: 'absent',
};
const GO_SHOP_VALUE_COHORT = {
  scope: 'provision_codes',
  provisionCodes: GO_SHOP_MARKET_CODES,
  eligibility: 'family_present',
  provisionFamily: 'NOSOL',
};

function goShopAvailabilitySubterm() {
  const featureKeys = [...GO_SHOP_PRESENCE_KEYS, 'mainConcept'];
  return {
    key: 'availability',
    label: 'Go-shop availability',
    featureKeys,
    kind: 'categorical',
    cohort: GO_SHOP_VALUE_COHORT,
    observationScope: { provisionCodes: GO_SHOP_MARKET_CODES },
    presence: { strategy: 'card_exists', provisionCodes: GO_SHOP_MARKET_CODES, missingState: 'absent' },
    value: { strategy: 'feature_value', featureKeys, normalizer: 'go_shop_availability' },
    conditionalOnPresence: false,
  };
}

function goShopTimingSubterm(key, label, featureKeys, trigger) {
  return {
    key,
    label,
    featureKeys,
    kind: 'duration',
    value: { strategy: 'feature_value', featureKeys, normalizer: 'deadline_duration', trigger },
    semantics: {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      trigger,
      requiredDimensions: ['unit', 'calendarBasis'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    },
  };
}

function goShopExcludedPartySubterm() {
  const featureKeys = ['goShopExcludedParties', 'mainConcept'];
  return {
    key: 'excluded-party-treatment',
    label: 'Excluded-party treatment',
    featureKeys,
    kind: 'categorical',
    value: { strategy: 'feature_value', featureKeys, normalizer: 'go_shop_excluded_party_treatment' },
  };
}

function withGoShopMarket(row, marketSubterms) {
  return {
    ...row,
    featureKeys: [...new Set(marketSubterms.flatMap((subterm) => subterm.featureKeys || []))],
    marketProvisionCodes: GO_SHOP_MARKET_CODES,
    marketPresence: GO_SHOP_MARKET_PRESENCE,
    marketSubterms,
  };
}

function buildGoShopGroup(reviewDeal, ctx) {
  const cards = reviewDeal?.cards || [];
  const period = firstFeature(cards, ['goShopPeriodDays', 'goShopWindow']);
  const excluded = firstFeature(cards, ['goShopExcludedParties']);
  const extended = firstFeature(cards, ['extendedNegotiatingPeriodDays']);
  const presentHit = firstFeature(cards, ['goShopPresent']);
  const presentVal = goShopValue(presentHit);
  const hasGoShop = /^(true|yes)$/i.test(String(presentVal || '')) || period || excluded || extended;
  const PillCell = ctx?.primitives?.PillCell;
  const pill = (label, tone = 'neutral') => (ctx ? (PillCell ? React.createElement(PillCell, { label, tone }) : label) : null);
  if (!hasGoShop) {
    return {
      id: 'nosol-go-shop',
      label: 'Go-Shop',
      rows: [withGoShopMarket(
        { id: 'nosol-go-shop-none', label: 'Go-shop', children: pill('None', 'missing') },
        [
          goShopAvailabilitySubterm(),
          goShopTimingSubterm('period', 'Go-shop period', ['goShopPeriodDays', 'goShopWindow'], 'signing'),
          goShopExcludedPartySubterm(),
          goShopTimingSubterm('extended-period', 'Extended negotiating period', ['extendedNegotiatingPeriodDays'], 'go_shop_period_expiry'),
        ],
      )],
    };
  }
  const rows = [];
  const add = (id, label, hit, unit, marketSubterms) => {
    const v = goShopValue(hit);
    if (!v) return;
    rows.push(withGoShopMarket({
      id,
      label,
      children: pill(unit && /^\d+$/.test(v) ? `${v} ${unit}` : v),
      card: hit?.card || null,
    }, marketSubterms));
  };
  add('nosol-go-shop-period', 'Go-shop period', period, 'days', [
    goShopTimingSubterm('timing', 'Go-shop period', ['goShopPeriodDays', 'goShopWindow'], 'signing'),
  ]);
  add('nosol-go-shop-excluded', 'Excluded parties', excluded, null, [goShopExcludedPartySubterm()]);
  add('nosol-go-shop-extended', 'Extended negotiating period', extended, 'days', [
    goShopTimingSubterm('timing', 'Extended negotiating period', ['extendedNegotiatingPeriodDays'], 'go_shop_period_expiry'),
  ]);
  return { id: 'nosol-go-shop', label: 'Go-Shop', rows };
}

function buildGroups(reviewDeal, ctx) {
  const rowsBySource = {};
  for (const key of Object.keys(SOURCES)) {
    rowsBySource[key] = byId(SOURCES[key].config.selectRows(reviewDeal));
  }
  const groups = GROUP_DEFS.map((group) => {
    const rows = group.items
      .map((item) => {
        const row = rowsBySource[item.source]?.get(item.id);
        if (!row) return null;
        const node = ctx ? rowNode(row, ctx, SOURCES[item.source]) : null;
        return {
          id: row.id,
          label: row.label,
          children: node ? node.signal : null,
          seeTextContent: node ? node.seeTextContent : null,
          // Item 17 (r4): the row's source card, so GroupedSubRows can wire
          // this sub-row to the ClauseSidebar (see ProvisionTablePrimitives's
          // resolveCard usage). row.sourceCards is the plural shape allFeatures()
          // (card-utils.js) attaches -- first element is the row's primary source.
          card: (row.sourceCards && row.sourceCards[0]) || row.sourceCard || null,
          // Sidebar redesign items 2/4: carry the ORIGINAL row's own claim
          // attribute(s) and any drill-down items through to this mapped
          // row too -- resolveRowFocus(row) runs against THIS object (see
          // GroupedSubRows/ProvisionTablePrimitives.jsx), not the row built
          // by rowForSpec() above, so without this the corpus-context
          // scoping and the prohibited-act/exception drill-down were
          // silently dropped for every grouped nosol row.
          featureKeys: row.featureKeys || null,
          marketSubterms: row.marketSubterms || null,
          marketProvisionCodes: row.marketProvisionCodes || null,
          marketPresence: row.marketPresence || null,
          marketPrevalenceCohort: row.marketPrevalenceCohort || null,
          marketObservationScope: row.marketObservationScope || null,
          marketMetrics: row.marketMetrics || null,
          items: row.acts || row.exceptionItems || null,
          evidence: row.evidence || null,
        };
      })
      .filter(Boolean);
    return { id: group.id, label: group.label, rows };
  }).filter((group) => group.rows.length > 0);

  // WS-G #4: splice the Acquisition Proposal - Definition group in right
  // before 'nosol-notice' (anchoring on 'nosol-notice' rather than
  // 'nosol-fiduciary-engagement' -- the latter can render empty and drop out
  // of `groups` entirely on a deal whose engagement-standard/final-standard
  // fallback regexes don't match, which would otherwise push this group all
  // the way to the end instead of into its correct position). The
  // Acceptable Confidentiality Agreement definition (nosol-fiduciary-
  // acceptable-confidentiality) is folded in here too -- it's the
  // confidentiality-agreement defined term a Qualifying bidder's information
  // exchange is gated on, so it belongs alongside the other No-Sol defined
  // terms rather than standing alone.
  const acqProposalGroup = buildAcquisitionProposalGroup(reviewDeal, ctx);
  if (acqProposalGroup) {
    const confidentialityRow = rowsBySource.fiduciary?.get('nosol-fiduciary-acceptable-confidentiality');
    if (confidentialityRow) {
      const chips = acaChips(confidentialityRow.detail, confidentialityRow.sourceCards?.[0]);
      acqProposalGroup.rows.push({
        id: confidentialityRow.id,
        label: 'Acceptable Confidentiality Agreement',
        children: ctx
          ? React.createElement('div', { className: 'space-y-1.5' }, acqProposalChipRow(chips, ctx), seeDefinitionLink(confidentialityRow.detail, ctx))
          : null,
        card: (confidentialityRow.sourceCards && confidentialityRow.sourceCards[0]) || confidentialityRow.sourceCard || null,
      });
    }
    const insertAt = groups.findIndex((group) => group.id === 'nosol-notice');
    if (insertAt === -1) groups.push(acqProposalGroup);
    else groups.splice(insertAt, 0, acqProposalGroup);
  }

  // Go-Shop leads the section (with an explicit "None" when absent) -- but only
  // when there IS a No-Sol section to lead; an empty deal stays empty.
  if (groups.length) groups.unshift(buildGoShopGroup(reviewDeal, ctx));

  return groups;
}

const nosolSectionConfig = {
  id: 'nosol',
  title: 'No-Solicitation / No-Shop',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    // Row-shape independent of ctx so the hasRows check in
    // pages/review/[id].js (which calls selectRows without ctx) still works;
    // the grouped body is rebuilt with primitives at render time via the
    // 'body' column below (same pattern as conditions.config.js).
    const hasAny = Object.values(SOURCES).some((source) => (source.config.selectRows(reviewDeal) || []).length > 0);
    if (!hasAny) return [];
    return [{ id: 'nosol-section-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const groups = buildGroups(row.reviewDeal, ctx);
        return React.createElement(GroupedSubRows, {
          groups,
          emptyCopy: 'No no-solicitation provisions found.',
          // Item 17 (r4): wire each sub-row to the ClauseSidebar via the
          // resolver/selection ProvisionTable.jsx puts on ctx.
          onSelectCard: ctx?.onSelectCard,
          resolveCard: ctx?.resolveCard,
          selectedCardId: ctx?.selectedCardId,
          canonicalBindingForRow: ctx?.canonicalBindingForRow,
          onSelectCanonicalBinding: ctx?.onSelectCanonicalBinding,
          selectedCanonicalBindingKey: ctx?.selectedCanonicalBindingKey,
        });
      },
    },
  ],
  empty: { copy: 'No no-solicitation provisions found.' },
};

export { buildAcquisitionProposalGroup, buildGroups, extractPctTriggers, nosolSectionConfig };
