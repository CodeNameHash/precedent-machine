const { dealColumn, firstProvision, fieldDef, fieldKind, labelFor, provisionFieldValue } = require('./shared');

function executeProvisionCrossCut(payload, context) {
  const provisionType = payload.provision_type;
  const dealIds = new Set(payload.deal_ids || []);
  const deals = (context.deals || []).filter((deal) => !dealIds.size || dealIds.has(deal.id));
  const columns = (payload.columns || []).map((field) => {
    const def = fieldDef(provisionType, field);
    return { field, label: def ? def.label : labelFor(field), kind: fieldKind(def) };
  });
  const rows = deals.map((deal) => {
    const provision = firstProvision(context.provisions || [], deal.id, provisionType, payload.provision_subtype);
    return {
      ...dealColumn(deal),
      card_id: provision ? provision.id : null,
      cells: columns.map((col) => {
        const result = provision ? provisionFieldValue(provision, provisionType, col.field) : { value: null, quote: null };
        return { value: result.value, verbatim_quote: result.quote, quote_section_ref: provision && (provision.section_ref || provision.section || null) };
      }),
    };
  });
  rows.sort((a, b) => {
    if (payload.sort_by === 'deal_signing_date_asc') return String(a.signing_date || '').localeCompare(String(b.signing_date || ''));
    return String(b.signing_date || '').localeCompare(String(a.signing_date || ''));
  });
  return { kind: 'PROVISION_CROSS_CUT', provision_type: provisionType, columns, rows };
}

module.exports = { executeProvisionCrossCut };
