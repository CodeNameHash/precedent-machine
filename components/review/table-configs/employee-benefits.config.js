import React from 'react';
import { comparisonGroupForStandardCode } from '../../../lib/employee-benefits.js';

const FALLBACK_ITEMS = [
  ['BASE_SALARY', 'Base salary', ['baseSalaryStandard']],
  ['TARGET_BONUS', 'Target annual bonus / cash incentive', ['bonusStandard', 'targetBonusStandard']],
  ['HEALTH_WELFARE', 'Health and welfare benefits', ['benefitsStandard', 'healthWelfareStandard']],
  ['SEVERANCE', 'Severance / change-in-control protection', ['severanceStandard']],
  ['LONG_TERM_INCENTIVE', 'Long-term incentive (LTI) / equity grants', ['ltiStandard', 'longTermIncentiveStandard']],
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
function isEmployeeBenefitsCard(card) {
  const code = cardCode(card);
  if (code === 'COV-EMPLOYEE') return true;
  if (card?.provision_type === 'COVENANT_EMPLOYEE_BENEFITS') return true;
  const text = `${card?.short_title || ''} ${textOf(card)}`;
  return /employee\s+matters|continuing\s+employees|compensation\s+and\s+benefits|employee\s+benefits/i.test(text);
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') return value.value || value.label || value.text || value.code || null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
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
function detailBits(raw) {
  const bits = [];
  const period = raw?.timePeriod || raw?.time_period;
  const exceptions = valueText(raw?.exceptions);
  const bundling = raw?.bundling ? `Bundling: ${valueText(raw.bundling)}` : null;
  if (period) bits.push(`Period: ${valueText(period)}`);
  if (exceptions) bits.push(`Exceptions: ${exceptions}`);
  if (bundling) bits.push(bundling);
  if (raw?.text) bits.push(String(raw.text));
  return bits.join('\n');
}
// A single compensationItems entry (`raw`) can address several canonical
// benefit types at once (benefit_types.length > 1) or carry an explicit
// `bundling` marker (aggregate/bundled test language). Either signal means
// the standard/comparison/text on this row was NOT extracted per-element —
// it was read off a clause that bundles several elements together. Each
// element still gets its own row (comparability across deals requires
// per-element tracking — see lib/employee-benefits.js header), but the row
// carries `bundled`/`siblingElements` so the render layer can flag it and
// cross-link the other elements sharing the same source clause.
function rowsFromCompensationItems(cards) {
  const rows = [];
  for (const card of cards) {
    const items = cardFeatures(card).compensationItems;
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const stdCode = standardCode(raw);
      const stdLabel = standardLabel(raw, stdCode);
      const types = benefitTypes(raw);
      const bundled = !!raw.bundling || types.length > 1;
      for (const type of types) {
        rows.push({
          id: `employee-benefits-${type.code || rows.length}`,
          benefit: type.label,
          comparison: raw.comparison_group || raw.comparisonGroup || comparisonGroupForStandardCode(stdCode) || 'Not specified',
          standard: stdLabel || 'Not specified',
          standardCode: stdCode || null,
          detail: detailBits(raw) || 'Present, detail not extracted',
          evidence: raw.text || textOf(card),
          source: card,
          bundled,
          bundlingNote: raw.bundling ? valueText(raw.bundling) : null,
          siblingElements: types.filter((t) => t.code !== type.code).map((t) => ({ code: t.code, label: t.label })),
          present: true,
        });
      }
    }
  }
  return rows;
}
function fallbackRows(cards) {
  const rows = [];
  for (const [code, label, keys] of FALLBACK_ITEMS) {
    const hit = firstFeature(cards, keys);
    if (!hit) continue;
    rows.push({
      id: `employee-benefits-${code}`,
      benefit: label,
      comparison: 'Not specified',
      standard: hit.text,
      detail: textOf(hit.card),
      evidence: textOf(hit.card),
      source: hit.card,
      bundled: false,
      bundlingNote: null,
      siblingElements: [],
      present: true,
    });
  }
  const period = firstFeature(cards, ['employeeBenefitPeriod', 'protectionPeriod', 'protectionPeriodMonths']);
  if (period) {
    rows.unshift({
      id: 'employee-benefits-period',
      benefit: 'Continuation period',
      comparison: 'All covered employees',
      standard: period.text,
      detail: textOf(period.card),
      evidence: textOf(period.card),
      source: period.card,
      bundled: false,
      bundlingNote: null,
      siblingElements: [],
      present: true,
    });
  }
  return rows;
}

function renderComparison(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell || !row.comparison) return row.comparison;
  return React.createElement(PillCell, {
    label: row.comparison,
    tone: row.comparison === 'Not specified' ? 'missing' : 'neutral',
    evidence: row.evidence,
    source: row.source,
  });
}

function renderStandard(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell || !row.standard) return row.standard;
  return React.createElement(PillCell, {
    label: row.standard,
    tone: row.standard === 'Not specified' ? 'missing' : 'info',
    evidence: row.evidence,
    source: row.source,
  });
}

function renderDetail(row, ctx) {
  const { PillCell, GroupedSubRows, EvidenceHoverSource } = ctx?.primitives || {};
  const bundledBadge = row.bundled && PillCell
    ? React.createElement(PillCell, {
        key: 'bundled',
        label: row.bundlingNote ? `Bundled: ${row.bundlingNote}` : 'Bundled / aggregate test',
        tone: 'warning',
        evidence: row.evidence,
        source: row.source,
      })
    : null;
  const siblingGroup = row.siblingElements?.length && GroupedSubRows
    ? React.createElement(GroupedSubRows, {
        groups: [{
          id: `${row.id}-siblings`,
          label: 'Bundled with (same clause / standard)',
          rows: row.siblingElements.map((sibling) => ({
            id: sibling.code || sibling.label,
            label: sibling.label,
            value: row.standard,
            evidence: row.evidence,
            source: row.source,
          })),
        }],
      })
    : null;
  const text = EvidenceHoverSource && row.evidence
    ? React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.source, as: 'span' }, row.detail)
    : row.detail;
  if (!bundledBadge && !siblingGroup) return text;
  return React.createElement('div', { className: 'space-y-1' }, bundledBadge, siblingGroup, text);
}

const employeeBenefitsConfig = {
  id: 'employee-benefits',
  title: 'Employee Compensation and Benefits',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isEmployeeBenefitsCard);
    if (!cards.length) return [];
    const structured = rowsFromCompensationItems(cards);
    return structured.length ? structured : fallbackRows(cards);
  },
  columns: [
    { id: 'benefit', header: 'Benefit Type', width: '15rem', renderCell: (row) => row.benefit },
    { id: 'comparison', header: 'Comparison Group', width: '14rem', renderCell: renderComparison },
    { id: 'standard', header: 'Standard', width: '14rem', renderCell: renderStandard },
    { id: 'detail', header: 'Exceptions / Bundling / Text', renderCell: renderDetail },
  ],
};

export { employeeBenefitsConfig, renderComparison, renderDetail, renderStandard };
