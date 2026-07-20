const {
  dealColumn, firstProvision, firstProvisionWithField, provisionsForDealAndType,
  fieldDef, fieldKind, labelFor, provisionFieldValue, buildProv, hasValue,
} = require('./shared');

function hasAnyColumnValue(provision, provisionType, columns, deal) {
  return columns.some((col) => {
    const result = provisionFieldValue(provision, provisionType, col.field, deal);
    return result.value !== null && result.value !== undefined && result.value !== '';
  });
}

// A deal can have MULTIPLE provisions of the same WP type (e.g. more than
// one CONSIDERATION card — headline per-share terms vs. election/proration
// mechanics). firstProvision() just takes provisions[0] for that deal/type,
// which silently returns null cells whenever the requested column actually
// lives on a later provision. Prefer the first candidate that has data for
// at least one requested column; only fall back to the arbitrary first when
// none of them do (so card_id/quote still resolve for an all-null row).
function representativeProvision(provisions, deal, provisionType, columns, subtype) {
  const candidates = provisionsForDealAndType(provisions, deal.id, provisionType);
  const withData = candidates.find((candidate) => hasAnyColumnValue(candidate, provisionType, columns, deal));
  if (withData) return withData;
  return firstProvision(provisions, deal.id, provisionType, subtype);
}

function metadataFallback(deal, provisionType, field) {
  if (provisionType !== 'STRUCTURE_MECHANICS' || field !== 'mergerForm') return null;
  const metadata = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return deal.merger_form || metadata.merger_form || null;
}

function executeProvisionCrossCut(payload, context) {
  const provisionType = payload.provision_type;
  const dealIds = new Set(payload.deal_ids || []);
  const deals = (context.deals || []).filter((deal) => !dealIds.size || dealIds.has(deal.id));
  const columns = (payload.columns || []).map((field) => {
    const def = fieldDef(provisionType, field);
    return { field, label: def ? def.label : labelFor(field), kind: fieldKind(def) };
  });
  const rows = deals.map((deal) => {
    const provision = representativeProvision(context.provisions || [], deal, provisionType, columns, payload.provision_subtype);
    return {
      ...dealColumn(deal),
      card_id: provision ? provision.id : null,
      cells: columns.map((col) => {
        const cellProvision = firstProvisionWithField(
          context.provisions || [], deal.id, provisionType, col.field, payload.provision_subtype, deal,
        );
        const resolved = cellProvision
          ? provisionFieldValue(cellProvision, provisionType, col.field, deal)
          : { value: null, quote: null };
        const fallback = hasValue(resolved.value) ? null : metadataFallback(deal, provisionType, col.field);
        const result = fallback === null ? resolved : { value: fallback, quote: null };
        return {
          value: result.value,
          verbatim_quote: result.quote,
          card_id: cellProvision ? cellProvision.id : null,
          quote_section_ref: cellProvision && (cellProvision.section_ref || cellProvision.section || null),
          ...(hasValue(result.value) && fallback === null ? { _prov: buildProv(result, cellProvision) } : {}),
        };
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
