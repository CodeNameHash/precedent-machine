// Review V2 ("Mergertrace") — ordered section list.
// Mirrors REVIEW_TABLE_CONFIGS in pages/review/[id].js (same 19 configs,
// same order) without touching the monolith. Each non-empty section gets a
// dot colour cycled from the Mergertrace prototype palette.

import { structureMechanicsConfig } from '../review/table-configs/structure-mechanics.config';
import { textOf, valueText } from '../review/table-configs/card-utils';
import { considerationHeroConfig } from '../review/table-configs/consideration-hero.config';
import { equityAwardsConfig } from '../review/table-configs/equity-awards.config';
import {
  representationsQualifiersConfig,
  parentRepresentationsConfig,
} from '../review/table-configs/representations-qualifiers.config';
import { materialContractsConfig } from '../review/table-configs/material-contracts.config';
import { maeDefinitionsConfig } from '../review/table-configs/mae-definitions.config';
import { iocExceptionsConfig } from '../review/table-configs/ioc-exceptions.config';
import { nosolSectionConfig } from '../review/table-configs/nosol-section.config';
import { antitrustRegulatoryConfig } from '../review/table-configs/antitrust-regulatory.config';
import { votesApprovalsMeetingConfig } from '../review/table-configs/votes-approvals-meeting.config';
import { conditionsConfig } from '../review/table-configs/conditions.config';
import { terminationRightsConfig } from '../review/table-configs/termination-rights.config';
import { terminationFeesConfig } from '../review/table-configs/termination-fees.config';
import { tailFeeConfig } from '../review/table-configs/tail-fee.config';
import { employeeBenefitsConfig } from '../review/table-configs/employee-benefits.config';
import { miscBoilerplateConfig } from '../review/table-configs/misc-boilerplate.config';
import { noOtherRepsFraudConfig } from '../review/table-configs/no-other-reps-fraud.config';
import { generalCovenantsConfig } from '../review/table-configs/general-covenants.config';
import { decorateConfigForV2 } from './configDecorations';

export const REVIEW_V2_CONFIGS = [
  structureMechanicsConfig,
  considerationHeroConfig,
  equityAwardsConfig,
  representationsQualifiersConfig,
  parentRepresentationsConfig,
  materialContractsConfig,
  maeDefinitionsConfig,
  iocExceptionsConfig,
  nosolSectionConfig,
  antitrustRegulatoryConfig,
  votesApprovalsMeetingConfig,
  conditionsConfig,
  terminationRightsConfig,
  terminationFeesConfig,
  tailFeeConfig,
  employeeBenefitsConfig,
  miscBoilerplateConfig,
  noOtherRepsFraudConfig,
  generalCovenantsConfig,
];

export const DOT_PALETTE = [
  '#7459A6', '#2F8B7E', '#3F8A6A', '#8B5B3A', '#B5862E', '#A8538C',
  '#2F8FA8', '#6E8AA8', '#5660B0', '#C0673A', '#B14E63', '#8A8782',
];

export const EMPTY_REVIEW_DEAL = { sections: [], definitions: [], cardCount: 0, cards: [] };

// The section the page hands to the custom MaeSection component instead of
// the generic ProvisionTable (see SectionBlock in pages/review-v2/[id].js).
export const MAE_SECTION_ID = maeDefinitionsConfig.id;

// ── Per-section provision index ─────────────────────────────────────────
// Groups the raw cards by the section that presents them, so each section
// can render a "Provisions in this section" drill-down under its summary
// table (the detail layer v1 exposes via its sidebar type-groups).
// SYNC POINT: card provision_type values come from lib/parser-v2/
// store-cards.js CARD_TYPE mapping.
const CARD_TYPE_TO_SECTION = {
  STRUCTURE_MECHANICS: 'structure-mechanics',
  CONSIDERATION: 'consideration-hero',
  REPRESENTATION: 'representations-qualifiers',
  COVENANT_INTERIM_OPERATING: 'ioc-exceptions',
  COVENANT_NO_SOLICITATION: 'nosol',
  ANTITRUST_REGULATORY: 'antitrust-regulatory',
  CLOSING_CONDITION: 'conditions',
  TERMINATION_RIGHT: 'termination-rights',
  TERMINATION_FEE: 'termination-fees',
  COVENANT_OTHER: 'general-covenants',
  COVENANT_EMPLOYEE_BENEFITS: 'employee-benefits',
  MISC_BOILERPLATE: 'misc-boilerplate',
};

export function groupCardsBySection(reviewDeal) {
  const rd = reviewDeal || EMPTY_REVIEW_DEAL;
  const bySection = new Map();
  for (const card of rd.cards || []) {
    const type = card && card.provision_type;
    if (!type || type === 'DEFINITION') continue; // definitions get their own section
    let sectionId = CARD_TYPE_TO_SECTION[type] || '__other';
    // Party-split overrides mirroring the v1 sidebar: buyer reps + equity.
    if (type === 'REPRESENTATION' && /^REP-B/.test(String(card.provision_subtype || ''))) {
      sectionId = 'parent-representations-qualifiers';
    }
    if (type === 'CONSIDERATION' && String(card.provision_subtype || '') === 'CONSID-EQUITY') {
      sectionId = 'equity-awards';
    }
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId).push(card);
  }
  return bySection;
}

// Masthead facts from the EXTRACTED data (the same consideration-hero rows
// the Consideration table renders), NOT deal.metadata.deal_facts — that
// side-channel is stale or absent on many deals (Metsera carries a legacy
// headlineConsiderationType of CASH although the deal is cash + CVR).
export function deriveExtractedHeaderFacts(reviewDeal) {
  const rd = reviewDeal || EMPTY_REVIEW_DEAL;
  let rows = [];
  try {
    rows = considerationHeroConfig.selectRows(rd) || [];
  } catch {
    rows = [];
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  const headline = byId.get('consideration-hero-headline');
  const perShare = byId.get('consideration-hero-per-share');
  return {
    consideration: (headline && headline.detail) || null,
    perShare: (perShare && perShare.detail) || null,
  };
}

// ── Closing timing rows (folded into the Structure & Mechanics table) ────
// Ben: "closing timing stuff isn't summarized" (round 1), then "belongs
// inside Structure & Mechanics with the other timing rows, not floating
// first" (round 2), then round 3: Outside Date specifically belongs in
// Termination instead -- the Termination Rights table already renders it
// independently (see termination-rights.config.js, 'Outside / End Date'
// group over TERMR-OUTSIDE/TERMR-EXTENSION), so folding it in here just
// duplicated it. Round 3 removes the Outside Date block; Marketing Period
// and Ticking Fee (when coded) still render as ORDINARY rows in the SAME
// structure-mechanics table (see configDecorations.js), not a separate
// card -- pulled straight off cards already on the deal (COV-MARKETING,
// CONSID-TICKING). NO new extraction: every value is an existing feature or
// the card's own quoted text. No separate "Closing mechanics" row -- that's
// the table's own existing 'structure-mechanics-closing-timing' row
// (STRUCT-CLOSING's closingTiming feature); duplicating it here would be
// exactly the redundant-row problem Ben flagged elsewhere. Rows are omitted
// silently when a deal doesn't carry the underlying card/feature.
function closingCardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
// structure-mechanics' visible content lives in the SIGNALS ("Provision")
// column -- its 'detail' column is relocated behind a collapsed per-row
// "See provision" link (FULL_TEXT_COLUMNS in ProvisionTable.jsx), same as
// every other row in this table. A row with no signal renders BLANK, not
// "verbose" -- these synthetic rows need the same visible pill every other
// structure-mechanics row gets.
function closingTimingRow(id, label, detail, card) {
  return {
    id, label, kind: 'Closing', detail, evidence: textOf(card), sourceCard: card,
    signals: [{ id: `${id}-signal`, label: detail, value: detail, tone: 'neutral', evidence: textOf(card), source: card }],
  };
}

export function deriveClosingTimingRows(reviewDeal) {
  const cards = (reviewDeal && reviewDeal.cards) || [];
  const rows = [];

  const marketingCard = cards.find((c) => closingCardCode(c) === 'COV-MARKETING');
  if (marketingCard) {
    const f = marketingCard.features || {};
    const period = valueText(f.periodBusinessDays);
    const commencement = valueText(f.commencement);
    const detail = [period ? `${period} business days` : null, commencement].filter(Boolean).join(' — ');
    if (detail) rows.push(closingTimingRow('structure-mechanics-marketing-period', 'Marketing period', detail, marketingCard));
  }

  const tickingCard = cards.find((c) => closingCardCode(c) === 'CONSID-TICKING');
  if (tickingCard) {
    const f = tickingCard.features || {};
    const rate = valueText(f.rate);
    if (rate) rows.push(closingTimingRow('structure-mechanics-ticking-fee', 'Ticking fee', rate, tickingCard));
  }

  return rows;
}

// ── Election summary (Consideration section) ────────────────────────────
// Derives a two-option election card (label + per-share/per-option
// economics + default/no-election treatment + proration note) straight off
// the CONSID card's already-extracted features and quoted text — NO new
// extraction. Gated on features.prorationMechanics.electionType, which the
// extraction prompt only sets when it detected genuine affirmative-election
// language (kills the "flat mixed consideration" false-positive class).
function cardCodeUpper(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
function moneyPerShare(n) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / share`;
}
const ELECTION_WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5 };
function electionScanWindow(windowText) {
  const dollarMatch = windowText.match(/\$[\d,]+(?:\.\d+)?/);
  const unitMatch = windowText.match(/(\d+(?:\.\d+)?|one|two|three|four|five)\s+(Parent (?:Shares?|Units?))/i);
  let unitText = null;
  if (unitMatch) {
    const n = ELECTION_WORD_NUM[unitMatch[1].toLowerCase()] ?? unitMatch[1];
    unitText = `${n} ${unitMatch[2]}`;
  }
  if (dollarMatch && unitText) return `${dollarMatch[0]} cash + ${unitText}`;
  if (dollarMatch) return `${dollarMatch[0]} / share`;
  if (unitText) return unitText;
  return null;
}
function electionEconomicsFor(label, nextLabel, fullText, features) {
  const lower = label.toLowerCase();
  if (/^stock election$/.test(lower)) {
    const ratioMatch = String(features.exchangeRatio || '').match(/^([\d,.]+)\s+Parent Shares/i);
    if (ratioMatch) return `${ratioMatch[1]} Parent shares`;
  }
  const defIdx = fullText.indexOf(`"${label}"`);
  if (defIdx < 0) return null;
  // Forward: the clause defining `label` up to the next option's own
  // quoted mention (the common case — inline amount right after the tag).
  const nextIdx = nextLabel ? fullText.indexOf(`"${nextLabel}"`, defIdx + label.length) : -1;
  const windowEnd = nextIdx > defIdx ? nextIdx : defIdx + 400;
  const forward = electionScanWindow(fullText.slice(defIdx, windowEnd));
  if (forward) return forward;
  // Backward: some agreements name the option AFTER already defining its
  // amount earlier in the same sentence ("Cash Consideration (a "Cash
  // Election")").
  const backward = electionScanWindow(fullText.slice(Math.max(0, defIdx - 400), defIdx));
  if (backward) return backward;
  if (/^cash election$/i.test(lower) && (features.perShareAmount || features.cashAmount)) {
    return moneyPerShare(features.perShareAmount ?? features.cashAmount);
  }
  return null;
}

// FIX 4(a): a plain % or share-count figure sitting near a "Maximum <Kind>
// Election Number/Cap" label in the card's own text -- e.g. QXO's "45%
// Maximum Cash Election Number / 55% Maximum Stock Election Number" or
// Skechers' "Maximum Equity Election Cap (29,920,623 shares)". Mined from
// text (never guessed) because no structured per-cap field exists upstream.
const CAP_LABEL_RE = /Maximum\s+([A-Za-z]+)\s+Election\s+(Number|Cap)/gi;
// Real drafting puts the % figure a full clause BEFORE the "(the
// "Maximum ... Election Number")" defined-term parenthetical it's naming
// (QXO: "forty-five percent (45%) of the aggregate ... (the "Maximum Cash
// Election Number")" -- ~170 chars apart) and puts a share-count cap AFTER
// its own label instead (Skechers: "Maximum Equity Election Cap
// (29,920,623 shares)"). Search both directions with a wide-enough window
// to span the QXO-style backward gap.
function findNearbyCapFigure(text, index) {
  const window = text.slice(Math.max(0, index - 260), index + 60);
  const pct = window.match(/(\d{1,3}(?:\.\d+)?)\s?%/);
  if (pct) return `${pct[1]}%`;
  const shares = window.match(/([\d,]{4,})\s+(?:shares|Parent Shares|Company Shares|Merger Sub Shares)/i);
  if (shares) return `${shares[1]} shares`;
  return null;
}
function deriveProrationCaps(text) {
  if (!text) return [];
  const caps = [];
  const seen = new Set();
  const re = new RegExp(CAP_LABEL_RE.source, 'gi');
  let m = re.exec(text);
  while (m) {
    const label = `Maximum ${m[1]} Election ${m[2]}`;
    if (!seen.has(label)) {
      seen.add(label);
      const figure = findNearbyCapFigure(text, m.index);
      if (figure) caps.push({ label, figure });
    }
    m = re.exec(text);
  }
  return caps;
}

// FIX 4(c): phrasing an agreement uses to affirmatively rule OUT election
// mechanics entirely (SkyWater/IonQ: "No election shall be made available
// ... no proration shall apply") -- distinct from simply lacking structured
// election data, which is an extraction gap rather than a real "no election"
// deal term.
const NO_ELECTION_RE = /no\s+election\s+shall\s+be\s+made\s+available|no\s+proration\s+shall\s+apply/i;

// Item 5 (r6): "no election" deals are still FIXED MIXED consideration --
// every holder gets the exact same cash-plus-stock split, they just don't
// get to CHOOSE it. Ben: the old noElection branch below short-circuited to
// ONLY the "no election / no proration" note, dropping the actual per-share
// cash figure and exchange ratio (SkyWater: $15.00 cash + the Exchange
// Ratio in Parent stock) that a reviewer needs to see immediately, not just
// several rows down in the Consideration table. Mirrors the money-shape
// normalisation consideration-hero.config.js's ensureDollarPrefix()
// applies (a bare numeric perShareAmount like `15` needs a "$" + 2 decimals,
// not just string coercion).
function moneyLabel(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('$')) return trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `$${Number(trimmed).toFixed(2)}`;
  return trimmed;
}
function stockRatioText(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object') return (raw.text || raw.label || '').trim() || null;
  return null;
}
function deriveFixedMixedSplit(considCards) {
  let cash = null;
  let cashCard = null;
  let stock = null;
  let stockCard = null;
  for (const card of considCards) {
    const f = (card && card.features) || {};
    if (!cash) {
      const label = moneyLabel(f.perShareAmount ?? f.cashAmount);
      if (label) { cash = label; cashCard = card; }
    }
    if (!stock) {
      const text = stockRatioText(f.exchangeRatio) || stockRatioText(f.exchangeRatioText);
      if (text) { stock = text; stockCard = card; }
    }
  }
  const parts = [];
  if (cash) parts.push({ label: 'Cash', value: cash, card: cashCard });
  if (stock) parts.push({ label: 'Stock', value: stock, card: stockCard });
  return parts.length ? parts : null;
}

export function deriveElectionSummary(reviewDeal) {
  const cards = (reviewDeal && reviewDeal.cards) || [];
  const considCards = cards.filter((c) => /^CONSID/.test(cardCodeUpper(c)));
  if (!considCards.length) return null;

  function pmOf(card) {
    const pm = card.features && card.features.prorationMechanics;
    return pm && typeof pm === 'object' ? pm : {};
  }
  function isProratedCard(card) {
    return Boolean(card.features && card.features.proration) || Boolean(pmOf(card).text);
  }

  // FIX 4(a): merge election/proration signal across ALL CONSID cards, not
  // just the first one that happens to carry prorationMechanics.electionType
  // -- Skechers' card 2.7 has proration:false and would otherwise hide card
  // 2.9's real proration + Maximum Equity Election Cap. Prefer a card that
  // is BOTH prorated AND carries an electionType; fall back to the first
  // card with an electionType at all.
  const withElectionType = considCards.filter((c) => Boolean(pmOf(c).electionType));
  const electionCard = withElectionType.find(isProratedCard) || withElectionType[0] || null;

  if (!electionCard) {
    // FIX 4(c): no card has structured election data -- if a card
    // affirmatively states there's no election/no proration, say so
    // explicitly instead of rendering nothing.
    const noElectionCard = considCards.find((c) => NO_ELECTION_RE.test(String(c.region_full_text || c.primary_quote || '')));
    if (noElectionCard) {
      return {
        noElection: true,
        // Item 5 (r6): the actual fixed cash/stock split, when the deck
        // carries it -- ElectionCard renders these as the SAME kind of
        // value pills a true two-option election shows, with the
        // no-election/no-proration note as a secondary line beneath rather
        // than the only thing on the card.
        fixedSplit: deriveFixedMixedSplit(considCards),
        evidence: noElectionCard.primary_quote || noElectionCard.region_full_text || null,
        sourceCard: noElectionCard,
      };
    }
    return null;
  }

  const features = electionCard.features || {};
  const pm = pmOf(electionCard);
  const fullText = electionCard.region_full_text || electionCard.primary_quote || '';

  // Distinct "X Election" defined terms, in first-seen order — the two real
  // holder choices (excludes "Election Deadline" / "Election Procedures" /
  // "No Election Shares", none of which end in the bare word "Election").
  const seen = new Set();
  const labels = [];
  const labelRe = /"([A-Z][A-Za-z]+(?:\s[A-Za-z]+){0,2}\sElection)"/g;
  let m;
  while ((m = labelRe.exec(fullText))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      labels.push(m[1]);
    }
  }
  if (labels.length < 2) return null;
  const optionLabels = labels.slice(0, 2);
  const options = optionLabels.map((label, i) => ({
    label,
    economics: electionEconomicsFor(label, optionLabels[i + 1], fullText, features),
  }));

  // Default / no-election treatment, normalised to one of the two option
  // labels when the matched phrase is just its plural ("Stock Elections").
  let defaultTreatment = null;
  const defaultRe = /deemed to be [^.]*?in respect of which ([A-Z][a-z]+(?: [A-Za-z]+)? Elections?) (?:have|has) been made/i;
  const defaultRe2 = /(?:Non-Election Shares|No Election Shares)[^.]*?converted[^.]*?(?:right to receive the )?([A-Z][a-z]+(?: [A-Za-z]+)? Election(?: Consideration)?)/i;
  const dm = fullText.match(defaultRe) || fullText.match(defaultRe2);
  if (dm) {
    const raw = dm[1].replace(/ Consideration$/, '');
    const matched = optionLabels.find((l) => l.toLowerCase() === raw.toLowerCase() || `${l.toLowerCase()}s` === raw.toLowerCase());
    defaultTreatment = matched || raw;
  }

  const isProrated = Boolean(features.proration) || Boolean(pm.text);

  return {
    options,
    defaultTreatment,
    isProrated,
    prorationNote: pm.text || null,
    // FIX 4(b): structured proration detail -- caps, election deadline,
    // oversubscription treatment -- mined off this same card so ElectionCard
    // can render more than the bare "subject to proration" flag.
    caps: deriveProrationCaps(pm.text || fullText),
    electionDeadline: pm.electionDeadline || null,
    oversubscriptionTreatment: pm.oversubscriptionTreatment || null,
    evidence: electionCard.primary_quote || electionCard.region_full_text || null,
    sourceCard: electionCard,
  };
}

// Returns [{ id, title, config, dot }] for the configs that have rows on
// this deal, in render order. Same selection semantics as the v1 page's
// reviewSections memo (selectRows failure => treated as empty). `deal` (the
// deals row, optional) feeds the v2 config decorations — e.g. the lookback
// "(≈8 mos)" suffix is measured back from deal.announce_date.
export function buildReviewV2Sections(reviewDeal, deal) {
  const rd = reviewDeal || EMPTY_REVIEW_DEAL;
  const agreementIso = deal && deal.announce_date ? String(deal.announce_date).slice(0, 10) : null;
  const out = [];
  for (const baseConfig of REVIEW_V2_CONFIGS) {
    const config = decorateConfigForV2(baseConfig, { agreementIso });
    let rows = [];
    try {
      rows = config.selectRows(rd) || [];
    } catch {
      rows = [];
    }
    if (Array.isArray(rows) && rows.length > 0) {
      out.push({
        id: config.id,
        title: config.title,
        config,
        dot: DOT_PALETTE[out.length % DOT_PALETTE.length],
      });
    }
  }
  return out;
}
