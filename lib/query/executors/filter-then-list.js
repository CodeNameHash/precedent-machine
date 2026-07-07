const { comparisonDeals, dealColumn, dealMetaValue, firstProvisionWithField, provisionFieldValue } = require('./shared');

function testOp(value, op, expected) {
  if (op === 'eq') return String(value) === String(expected);
  if (op === 'neq') return String(value) !== String(expected);
  if (op === 'in') return Array.isArray(expected) && expected.map(String).includes(String(value));
  if (op === 'not_in') return Array.isArray(expected) && !expected.map(String).includes(String(value));
  if (op === 'contains') return String(value || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (op === 'not_contains') return !String(value || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (op === 'lt') return Number(value) < Number(expected);
  if (op === 'lte') return Number(value) <= Number(expected);
  if (op === 'gt') return Number(value) > Number(expected);
  if (op === 'gte') return Number(value) >= Number(expected);
  if (op === 'before') return String(value || '') < String(expected || '');
  if (op === 'after') return String(value || '') > String(expected || '');
  if (op === 'between') return Array.isArray(expected) && Number(value) >= Number(expected[0]) && Number(value) <= Number(expected[1]);
  return false;
}

function executeFilterThenList(payload, context) {
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const rows = [];
  for (const deal of deals) {
    const hits = [];
    let ok = true;
    for (const filter of payload.filters || []) {
      const provision = firstProvisionWithField(context.provisions || [], deal.id, filter.provision_type, filter.field);
      const value = provision ? provisionFieldValue(provision, filter.provision_type, filter.field).value : null;
      if (!testOp(value, filter.op, filter.value)) {
        ok = false;
        break;
      }
      const resolved = provision ? provisionFieldValue(provision, filter.provision_type, filter.field) : { key: filter.field, value };
      hits.push({ provision_type: filter.provision_type, card_id: provision && provision.id, field: resolved.key || filter.field, value });
    }
    if (!ok) continue;
    const columns = {};
    for (const column of payload.columns || []) columns[column] = dealMetaValue(deal, column);
    rows.push({ ...dealColumn(deal), columns, matched_provision_hits: hits });
  }
  rows.sort((a, b) => String(b.signing_date || '').localeCompare(String(a.signing_date || '')));
  return { kind: 'FILTER_THEN_LIST', filters_applied: payload.filters || [], total_matches: rows.length, rows };
}

module.exports = { executeFilterThenList };
