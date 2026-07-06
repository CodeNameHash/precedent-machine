const OWN = 'OWN_SUBPROVISION';
const SHARED_SENTENCE = 'SHARED_SENTENCE';
const SHARED_PARAGRAPH = 'SHARED_PARAGRAPH';

function groupingFromTreatmentRows(treatments) {
  const rows = Array.isArray(treatments) ? treatments : [];
  if (!rows.length) return 'GROUPED_PROSE';
  const allOwn = rows.every((t) => t.spanType === OWN || t.span_type === OWN);
  if (allOwn) return 'SEPARATE_SUBPROVISIONS';

  const uniqueSpans = new Set(rows.map((t) => {
    const start = t.sourceSpanStart ?? t.source_span_start;
    const end = t.sourceSpanEnd ?? t.source_span_end;
    return `${start}:${end}`;
  }));
  const allShared = rows.every((t) => {
    const type = t.spanType || t.span_type;
    return type === SHARED_SENTENCE || type === SHARED_PARAGRAPH;
  });
  if (allShared && uniqueSpans.size === 1) return 'GROUPED_PROSE';
  return 'HYBRID';
}

function classifyConsiderationGrouping(regionText, treatments) {
  const fromRows = groupingFromTreatmentRows(treatments);
  if (fromRows !== 'GROUPED_PROSE' || (Array.isArray(treatments) && treatments.length > 0)) {
    return fromRows;
  }

  const text = String(regionText || '');
  const subclauses = [...text.matchAll(/\(([a-z]|i{1,3}|iv|v|vi{0,3}|ix|x)\)\s+[^()]{0,160}?(?:Company\s+)?(?:Stock\s+Options?|Restricted\s+Stock\s+Awards?|RSUs?|PSUs?|ESPP|Stock\s+Appreciation\s+Rights?|SARs?)/gi)];
  if (subclauses.length >= 2) return 'SEPARATE_SUBPROVISIONS';

  const grouped = /\b(?:Company\s+)?(?:Stock\s+Options?|Restricted\s+Stock\s+Awards?|RSUs?|PSUs?|ESPP|Stock\s+Appreciation\s+Rights?|SARs?)\b.{0,120}\b(?:and|or)\b.{0,120}\b(?:Company\s+)?(?:Stock\s+Options?|Restricted\s+Stock\s+Awards?|RSUs?|PSUs?|ESPP|Stock\s+Appreciation\s+Rights?|SARs?)\b.{0,160}\bshall\b/i.test(text);
  return grouped ? 'GROUPED_PROSE' : 'GROUPED_PROSE';
}

module.exports = {
  classifyConsiderationGrouping,
  groupingFromTreatmentRows,
};
