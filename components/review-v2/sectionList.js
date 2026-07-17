// Review V2 ("Mergertrace") — ordered section list.
// Mirrors REVIEW_TABLE_CONFIGS in pages/review/[id].js (same 19 configs,
// same order) without touching the monolith. Each non-empty section gets a
// dot colour cycled from the Mergertrace prototype palette.

import { structureMechanicsConfig } from '../review/table-configs/structure-mechanics.config';
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
