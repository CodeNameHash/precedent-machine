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

// ── Closing timing summary (Structure & Mechanics section) ──────────────
// Ben: "closing timing stuff isn't summarized." A compact row set — Outside
// Date (+ extension, when present), Marketing Period / Ticking Fee (when
// coded), Closing mechanics — pulled straight off cards already on the
// deal (TERMR-OUTSIDE, COV-MARKETING, CONSID-TICKING, STRUCT-CLOSING). NO
// new extraction: every value is an existing feature or the card's own
// quoted text. Same selectRows-try/catch-empty shape as
// deriveExtractedHeaderFacts above. Rows are omitted silently when a deal
// doesn't carry the underlying card/feature.
function closingCardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
function formatIsoDateReadable(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function deriveClosingTimingSummary(reviewDeal) {
  const cards = (reviewDeal && reviewDeal.cards) || [];
  const rows = [];

  const outsideCard = cards.find((c) => closingCardCode(c) === 'TERMR-OUTSIDE');
  if (outsideCard) {
    const f = outsideCard.features || {};
    const dateText = valueText(f.outsideDate) || formatIsoDateReadable(f.outsideDateISO);
    if (dateText) {
      let value = dateText;
      const months = typeof f.outsideDateMonthsPostSigning === 'number' ? f.outsideDateMonthsPostSigning : null;
      if (months !== null) value += ` (~${months} month${months === 1 ? '' : 's'} post-signing)`;
      const extText = valueText(f.extensionConditions) || valueText(f.outsideDateExtensionConditions);
      const extMonths = typeof f.extensionMonths === 'number' ? f.extensionMonths : null;
      if (extText || extMonths !== null) {
        let ext = extText || 'Extension available';
        if (extMonths !== null) ext += ` (+${extMonths} month${extMonths === 1 ? '' : 's'})`;
        value += ` — ${ext}`;
      } else if (f.outsideDateExtension === true) {
        value += ' — extension available';
      }
      rows.push({ id: 'closing-timing-outside-date', label: 'Outside Date', value, evidence: textOf(outsideCard), sourceCard: outsideCard });
    }
  }

  const marketingCard = cards.find((c) => closingCardCode(c) === 'COV-MARKETING');
  if (marketingCard) {
    const f = marketingCard.features || {};
    const period = valueText(f.periodBusinessDays);
    const commencement = valueText(f.commencement);
    const value = [period ? `${period} business days` : null, commencement].filter(Boolean).join(' — ');
    if (value) rows.push({ id: 'closing-timing-marketing', label: 'Marketing period', value, evidence: textOf(marketingCard), sourceCard: marketingCard });
  }

  const tickingCard = cards.find((c) => closingCardCode(c) === 'CONSID-TICKING');
  if (tickingCard) {
    const f = tickingCard.features || {};
    const rate = valueText(f.rate);
    if (rate) rows.push({ id: 'closing-timing-ticking', label: 'Ticking fee', value: rate, evidence: textOf(tickingCard), sourceCard: tickingCard });
  }

  const closingCard = cards.find((c) => closingCardCode(c) === 'STRUCT-CLOSING');
  if (closingCard) {
    const f = closingCard.features || {};
    const value = valueText(f.closingTiming) || valueText(f.mainConcept);
    if (value) rows.push({ id: 'closing-timing-mechanics', label: 'Closing mechanics', value, evidence: textOf(closingCard), sourceCard: closingCard });
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

export function deriveElectionSummary(reviewDeal) {
  const cards = (reviewDeal && reviewDeal.cards) || [];
  const electionCard = cards.find((c) => {
    const code = cardCodeUpper(c);
    if (!/^CONSID/.test(code)) return false;
    const pm = c.features && c.features.prorationMechanics;
    return Boolean(pm && typeof pm === 'object' && pm.electionType);
  });
  if (!electionCard) return null;

  const features = electionCard.features || {};
  const pm = features.prorationMechanics || {};
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
