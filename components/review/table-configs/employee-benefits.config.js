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
function rowsFromCompensationItems(cards) {
  const rows = [];
  for (const card of cards) {
    const items = cardFeatures(card).compensationItems;
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const stdCode = standardCode(raw);
      const stdLabel = standardLabel(raw, stdCode);
      for (const type of benefitTypes(raw)) {
        rows.push({
          id: `employee-benefits-${type.code || rows.length}`,
          benefit: type.label,
          comparison: raw.comparison_group || raw.comparisonGroup || comparisonGroupForStandardCode(stdCode) || 'Not specified',
          standard: stdLabel || 'Not specified',
          detail: detailBits(raw) || 'Present, detail not extracted',
          evidence: raw.text || textOf(card),
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
      present: true,
    });
  }
  const period = firstFeature(cards, ['employeeBenefitPeriod', 'protectionPeriod', 'protectionPeriodMonths']);
  if (period) rows.unshift({ id: 'employee-benefits-period', benefit: 'Continuation period', comparison: 'All covered employees', standard: period.text, detail: textOf(period.card), evidence: textOf(period.card), present: true });
  return rows;
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
    { id: 'comparison', header: 'Comparison Group', width: '14rem', renderCell: (row) => row.comparison },
    { id: 'standard', header: 'Standard', width: '14rem', renderCell: (row) => row.standard },
    { id: 'detail', header: 'Exceptions / Bundling / Text', renderCell: (row) => row.detail },
  ],
};

export { employeeBenefitsConfig };
