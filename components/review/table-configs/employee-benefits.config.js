import React from 'react';
import { comparisonGroupForStandardCode } from '../../../lib/employee-benefits.js';
import { cardCode, cardFeatures, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

// Rebuilt per REBUILD-SPECS.md §12: a real TABLE (BENEFIT | REFERENCE GROUP |
// STANDARD | PERIOD) for the five compensationItems entries, header line
// "Protection period: N months", and a small pill-based group below the
// table for continuedService / eligibilityWaiver / severanceProtection / the
// ERISA checklist. "Reference group" is a column value only -- there is no
// new section/nav id here, and everything still flows through the single
// exported `employeeBenefitsConfig` + selectRows contract the page and the
// existing tests key off of.

const FALLBACK_ITEMS = [
  ['BASE_SALARY', 'Base salary', ['baseSalaryStandard']],
  ['TARGET_BONUS', 'Target annual bonus / cash incentive', ['bonusStandard', 'targetBonusStandard']],
  ['HEALTH_WELFARE', 'Health and welfare benefits', ['benefitsStandard', 'healthWelfareStandard']],
  ['SEVERANCE', 'Severance / change-in-control protection', ['severanceStandard']],
  ['LONG_TERM_INCENTIVE', 'Long-term incentive (LTI) / equity grants', ['ltiStandard', 'longTermIncentiveStandard']],
];

// ERISA checklist (Metsera parity gap root cause 4: "none read anywhere").
// All five sit on the same REP-T-BENEFITS representation card and always
// render as extra rows below whichever compensationItems/fallback path fired
// above -- unlike FALLBACK_ITEMS, they must not go dead when compensationItems
// is present, because the ERISA claims live on a different card entirely.
const ERISA_ITEMS = [
  ['erisaCompliance', 'ERISA compliance'],
  ['erisaParachutePayments', 'Parachute payment / Section 280G language'],
  ['erisaPlansListed', 'ERISA plans listed on disclosure schedule'],
  ['erisaTitleIVPlans', 'Title IV ERISA plan exposure'],
  ['erisaMultiemployer', 'Multiemployer plan exposure'],
];

// 401(k) continuation (Skechers cross-deal parity gap; no Metsera claim).
// Same "must survive the structured/fallback branch" reasoning as ERISA_ITEMS.
const CONTINUATION_ITEMS = [
  ['continued401k', '401(k) plan continuation'],
];

// Section-level protection claims that live on the same COV-EMPLOYEE card as
// compensationItems but were never read anywhere before this rebuild (spec
// §12: "continuedService, eligibilityWaiver, severanceProtection ... as a
// small group").
const PROTECTION_ITEMS = [
  ['continuedService', 'Continued service crediting'],
  ['eligibilityWaiver', 'Eligibility / waiting-period waiver'],
  ['severanceProtection', 'Severance protection'],
];

function isEmployeeBenefitsCard(card) {
  const code = cardCode(card);
  if (code === 'COV-EMPLOYEE') return true;
  if (card?.provision_type === 'COVENANT_EMPLOYEE_BENEFITS') return true;
  const text = `${card?.short_title || ''} ${textOf(card)}`;
  return /employee\s+matters|continuing\s+employees|compensation\s+and\s+benefits|employee\s+benefits/i.test(text);
}

// ERISA claims live on the "Employee Benefit Plans; ERISA" representation
// card (REP-T-BENEFITS), which isEmployeeBenefitsCard() above does not catch
// (it's a REPRESENTATION card, not a COV-EMPLOYEE covenant card, and its
// short_title "Employee Benefit Plans" doesn't match the covenant regex).
function isErisaCard(card) {
  if (cardCode(card) === 'REP-T-BENEFITS') return true;
  return /erisa/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// The headline "protectionPeriodMonths" (12) drives both the section header
// note and every row's PERIOD column fallback when a row has no per-item
// timePeriod of its own.
function headlinePeriod(cards) {
  for (const card of cards) {
    const f = cardFeatures(card);
    const months = typeof f.protectionPeriodMonths === 'number' ? f.protectionPeriodMonths
      : typeof f.employeeBenefitPeriod === 'number' ? f.employeeBenefitPeriod
      : null;
    if (months !== null) return { months, text: `${months} month${months === 1 ? '' : 's'}`, card };
  }
  return null;
}

function firstFeature(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const text = valueText(features[key]);
      if (text) return { text, card };
    }
  }
  return null;
}
function itemCode(raw) {
  const own = raw?.item || raw?.itemCode || raw?.code;
  return own ? String(own).toUpperCase() : null;
}
function itemLabel(raw, code) {
  return raw?.item_label || raw?.itemLabel || raw?.label || raw?.text || code || 'Compensation / benefit item';
}
function standardCode(raw) {
  const codes = raw?.standard_codes || raw?.standardCodes;
  if (Array.isArray(codes) && codes.length) return codes.map(valueText).filter(Boolean).join('; ');
  return raw?.standard_code || raw?.standardCode || null;
}
function standardLabel(raw, code) {
  const labels = raw?.standard_labels || raw?.standardLabels;
  if (Array.isArray(labels) && labels.length) return labels.map(valueText).filter(Boolean).join('; ');
  return raw?.standard_label || raw?.standardLabel || code || null;
}
function benefitTypes(raw) {
  const types = raw?.benefit_types || raw?.benefitTypes;
  if (!Array.isArray(types) || !types.length) return [{ code: itemCode(raw), label: itemLabel(raw, itemCode(raw)) }];
  return types.map((type) => ({ code: type?.code ? String(type.code).toUpperCase() : null, label: type?.label || type?.text || type?.code || 'Compensation / benefit item' }));
}
// Period is now its own column (spec §12), so exceptions/bundling/raw text
// are all that's left for the hidden "detail" full-text column.
function detailBits(raw) {
  const bits = [];
  const exceptions = valueText(raw?.exceptions);
  const bundling = raw?.bundling ? `Bundling: ${valueText(raw.bundling)}` : null;
  if (exceptions) bits.push(`Exceptions: ${exceptions}`);
  if (bundling) bits.push(bundling);
  if (raw?.text) bits.push(String(raw.text));
  return bits.join('\n');
}
// PERIOD column value: per-item timePeriod when the entry has one, else the
// section's headline protectionPeriodMonths.
function periodFor(raw, headline) {
  const text = valueText(raw?.timePeriod || raw?.time_period);
  return text || (headline ? headline.text : null) || 'Not specified';
}

const EMPLOYEE_PROVISION_CODES = ['COV-EMPLOYEE'];

function benefitPeriodSubterm() {
  const featureKeys = ['protectionPeriodMonths', 'employeeBenefitPeriod', 'protectionPeriod'];
  return {
    key: 'protection-period',
    label: 'Protection period',
    featureKeys,
    kind: 'duration',
    presence: { strategy: 'feature_non_empty', featureKeys, missingState: 'unknown' },
    value: { strategy: 'feature_value', featureKeys, normalizer: 'employee_benefit_period' },
    semantics: {
      unit: 'months',
      calendarBasis: 'elapsed',
      trigger: 'closing',
      requiredDimensions: ['unit'],
    },
  };
}

function structuredItemMarket(code) {
  const presence = {
    strategy: 'list_item',
    featureKeys: ['compensationItems'],
    itemCode: code,
    missingState: 'absent',
  };
  return {
    featureKeys: ['compensationItems', 'protectionPeriodMonths', 'employeeBenefitPeriod', 'protectionPeriod'],
    marketProvisionCodes: EMPLOYEE_PROVISION_CODES,
    marketPresence: presence,
    marketSubterms: [
      {
        key: 'standard',
        label: 'Protection standard',
        featureKeys: ['compensationItems'],
        kind: 'categorical',
        presence,
        value: {
          strategy: 'list_item_field',
          featureKeys: ['compensationItems'],
          itemCode: code,
          path: 'standard_code',
          paths: ['standard_code', 'standardCode', 'standard_codes', 'standardCodes'],
        },
      },
      {
        key: 'reference-group',
        label: 'Reference group',
        featureKeys: ['compensationItems'],
        kind: 'categorical',
        presence,
        value: {
          strategy: 'list_item_field',
          featureKeys: ['compensationItems'],
          itemCode: code,
          path: 'comparison_group',
          paths: ['comparison_group', 'comparisonGroup'],
        },
      },
      benefitPeriodSubterm(),
    ],
  };
}

function flatBenefitMarket(featureKeys) {
  return {
    featureKeys: [...featureKeys, 'protectionPeriodMonths', 'employeeBenefitPeriod', 'protectionPeriod'],
    marketProvisionCodes: EMPLOYEE_PROVISION_CODES,
    marketSubterms: [
      {
        key: 'standard',
        label: 'Protection standard',
        featureKeys,
        kind: 'categorical',
      },
      benefitPeriodSubterm(),
    ],
  };
}

function protectionMarket(key, label) {
  const presence = { strategy: 'feature_non_empty', featureKeys: [key], missingState: 'absent' };
  return {
    featureKeys: [key],
    marketProvisionCodes: EMPLOYEE_PROVISION_CODES,
    marketSubterms: [{
      key: 'included',
      label,
      featureKeys: [key],
      kind: 'presence',
      presence,
    }],
  };
}

function rowsFromCompensationItems(cards, headline) {
  const rows = [];
  for (const card of cards) {
    const items = cardFeatures(card).compensationItems;
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const stdCode = standardCode(raw);
      const stdLabel = standardLabel(raw, stdCode);
      const period = periodFor(raw, headline);
      for (const type of benefitTypes(raw)) {
        rows.push({
          id: `employee-benefits-${type.code || rows.length}`,
          kind: 'item',
          benefit: type.label,
          comparison: raw.comparison_group || raw.comparisonGroup || comparisonGroupForStandardCode(stdCode) || 'Not specified',
          standard: stdLabel || 'Not specified',
          period,
          detail: detailBits(raw) || 'Present, detail not extracted',
          evidence: raw.text || textOf(card),
          sourceCard: card,
          present: true,
          headlineProtectionPeriod: headline?.text || null,
          ...structuredItemMarket(type.code || itemCode(raw)),
        });
      }
    }
  }
  return rows;
}
function fallbackRows(cards, headline) {
  const rows = [];
  for (const [code, label, keys] of FALLBACK_ITEMS) {
    const hit = firstFeature(cards, keys);
    if (!hit) continue;
    rows.push({
      id: `employee-benefits-${code}`,
      kind: 'item',
      benefit: label,
      comparison: 'Not specified',
      standard: hit.text,
      period: headline ? headline.text : null,
      detail: textOf(hit.card),
      evidence: textOf(hit.card),
      sourceCard: hit.card,
      present: true,
      headlineProtectionPeriod: headline?.text || null,
      ...flatBenefitMarket(keys),
    });
  }
  const period = firstFeature(cards, ['employeeBenefitPeriod', 'protectionPeriod', 'protectionPeriodMonths']);
  if (period) {
    rows.unshift({
      id: 'employee-benefits-period',
      kind: 'item',
      benefit: 'Continuation period',
      comparison: 'All covered employees',
      standard: period.text,
      period: period.text,
      detail: textOf(period.card),
      evidence: textOf(period.card),
      sourceCard: period.card,
      present: true,
      headlineProtectionPeriod: headline?.text || null,
      featureKeys: ['protectionPeriodMonths', 'employeeBenefitPeriod', 'protectionPeriod'],
      marketProvisionCodes: EMPLOYEE_PROVISION_CODES,
      marketSubterms: [benefitPeriodSubterm()],
    });
  }
  return rows;
}
function checklistRows(cards, items, comparison, headline) {
  const rows = [];
  for (const [key, label] of items) {
    const hit = firstFeature(cards, [key]);
    if (!hit) continue;
    rows.push({
      id: `employee-benefits-${key}`,
      kind: 'checklist',
      benefit: label,
      comparison,
      standard: hit.text,
      period: null,
      detail: textOf(hit.card) || hit.text,
      evidence: textOf(hit.card),
      sourceCard: hit.card,
      present: true,
      headlineProtectionPeriod: headline?.text || null,
      ...protectionMarket(key, label),
    });
  }
  return rows;
}
// Groups the checklist rows (continuedService / eligibilityWaiver /
// severanceProtection / 401(k) / ERISA) under their own visual band inside
// the one table this config is allowed to own -- a divider row (styled like
// an absent row, no pills in the other columns) rather than a second section.
function dividerRow(headline) {
  return {
    id: 'employee-benefits-protections-divider',
    kind: 'divider',
    benefit: 'Other protections',
    comparison: null,
    standard: null,
    period: null,
    detail: null,
    evidence: null,
    present: false,
    marketSkip: true,
    headlineProtectionPeriod: headline?.text || null,
  };
}

function evidenceOnlyRows(cards) {
  return cards
    .filter((card) => card?.canonical_v2_lineage?.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE')
    .map((card, ordinal) => ({
      id: `employee-benefits-open-evidence-${card.id || ordinal}`,
      kind: 'item',
      benefit: card.short_title || 'Deferred employee-matters evidence',
      comparison: 'Not adjudicated',
      standard: 'Evidence only',
      period: null,
      detail: textOf(card),
      evidence: textOf(card),
      sourceCard: card,
      present: true,
      marketState: 'OPEN_NATIVE_FIELD',
    }));
}

function shortStandard(text) {
  if (!text) return null;
  // E (truncation sweep, Cox "Comparable to similarly situated buyer…"):
  // this appended a literal "…" to fit the fixed-width Standard column, with
  // no way to see the rest -- pillCell() below wires `evidence`/`source`
  // into PillCell, whose EvidenceHoverSource already surfaces the full
  // standard text on hover/click. Cut cleanly, no ellipsis.
  const { short } = splitForCell(text, 42);
  return short;
}

function textCell(text, row, ctx) {
  if (!text) return React.createElement('span', { className: 'italic text-inkFaint text-[11px]' }, '—');
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource) return text;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, text);
}

function pillCell(label, tone, row, ctx, color) {
  if (!label) return React.createElement('span', { className: 'italic text-inkFaint text-[11px]' }, '—');
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return label;
  return React.createElement(PillCell, { label, tone, color, evidence: row.evidence, source: row.sourceCard });
}

const employeeBenefitsConfig = {
  id: 'employee-benefits',
  title: 'Employee Compensation and Benefits',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    const cards = allCards.filter(isEmployeeBenefitsCard);
    const headline = headlinePeriod(cards);
    let baseRows = [];
    if (cards.length) {
      const structured = rowsFromCompensationItems(cards, headline);
      baseRows = structured.length ? structured : fallbackRows(cards, headline);
    }
    const continuationRows = checklistRows(cards, CONTINUATION_ITEMS, 'All covered employees', headline);
    const protectionRows = checklistRows(cards, PROTECTION_ITEMS, 'All covered employees', headline);
    // ERISA checklist hidden per Ben's review ("not important; just hide it").
    // ERISA_ITEMS / isErisaCard kept for a possible future standalone table.
    const belowRows = [...continuationRows, ...protectionRows];
    const divider = belowRows.length ? [dividerRow(headline)] : [];
    return [...baseRows, ...divider, ...belowRows, ...evidenceOnlyRows(cards)];
  },
  // "Protection period: 12 months" -- hoisted out of every row into the
  // section chrome (ProvisionTable's headerNote slot) instead of repeated
  // per row.
  deriveHeaderNote(rows) {
    const hit = (rows || []).find((row) => row.headlineProtectionPeriod);
    return hit ? `Protection period: ${hit.headlineProtectionPeriod}` : null;
  },
  fixedLayout: true,
  columns: [
    {
      id: 'benefit',
      header: 'Benefit',
      width: TERM_COL_WIDTH,
      maxWidth: TERM_COL_MAX,
      renderCell(row, ctx) {
        if (row.kind === 'divider') {
          return React.createElement('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-inkFaint' }, row.benefit);
        }
        return textCell(row.benefit, row, ctx);
      },
    },
    {
      id: 'comparison',
      header: 'Reference Group',
      width: '14rem',
      renderCell(row, ctx) {
        if (row.kind === 'divider') return null;
        return pillCell(row.comparison, 'neutral', row, ctx);
      },
    },
    {
      id: 'standard',
      header: 'Standard',
      // Fixed narrower than Benefit/Reference Group (spec #44: an unbounded
      // Standard column crowded out the other three). shortStandard()'s
      // truncation length is tuned to match this width.
      width: '12rem',
      renderCell(row, ctx) {
        if (row.kind === 'divider') return null;
        // Colour by the shared standard palette so the same standard reads the
        // same colour here and in every other table.
        return pillCell(shortStandard(row.standard), 'present', row, ctx, standardColorKey(row.standard));
      },
    },
    {
      id: 'period',
      header: 'Period',
      width: '9rem',
      renderCell(row, ctx) {
        if (row.kind === 'divider') return null;
        return pillCell(row.period, 'neutral', row, ctx);
      },
    },
    // Not shown in the visible grid -- ProvisionTable.jsx's FULL_TEXT_COLUMNS
    // relocates 'detail' behind a per-row "see text" expander under the
    // Benefit cell (already wired for config id 'employee-benefits'). This is
    // how long prose (severanceProtection text, raw clause quotes, bundling
    // detail) stays out of the always-visible pills per spec §12.
    {
      id: 'detail',
      header: '',
      renderCell(row) {
        if (row.kind === 'divider') return null;
        return row.detail || null;
      },
    },
  ],
};

export { employeeBenefitsConfig };
