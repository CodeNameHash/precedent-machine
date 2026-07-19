const {
  dealRow,
  fieldDef,
  provisionFieldValue,
  provisionMatchesWpType,
  provisionSubtype,
  primaryQuote,
  normalizeFieldPath,
} = require('../types');
const { registryVersion } = require('../resolve');

function byId(rows) {
  return new Map((rows || []).map((row) => [row.id, row]));
}

function selectedDeals(deals, ids) {
  const wanted = new Set(ids || []);
  return (deals || []).filter((deal) => wanted.size === 0 || wanted.has(deal.id));
}

function provisionsForDealAndType(provisions, dealId, provisionType) {
  return (provisions || []).filter((p) => p.deal_id === dealId && provisionMatchesWpType(p, provisionType));
}

function firstProvision(provisions, dealId, provisionType, subtype) {
  const rows = provisionsForDealAndType(provisions, dealId, provisionType);
  if (!subtype) return rows[0] || null;
  return rows.find((row) => provisionSubtype(row) === subtype) || rows[0] || null;
}

function firstProvisionWithField(provisions, dealId, provisionType, fieldPath, subtype, deal) {
  const rows = provisionsForDealAndType(provisions, dealId, provisionType);
  const ordered = subtype ? rows.filter((row) => provisionSubtype(row) === subtype).concat(rows) : rows;
  const seen = new Set();
  for (const row of ordered) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    const result = provisionFieldValue(row, provisionType, fieldPath, deal);
    if (result.value !== null && result.value !== undefined && result.value !== '') return row;
  }
  return ordered[0] || null;
}

function comparisonDeals(deals, filter) {
  const f = filter || {};
  return (deals || []).filter((deal) => {
    if (Array.isArray(f.sector) && f.sector.length && !f.sector.includes(deal.sector)) return false;
    if (Array.isArray(f.signing_year) && f.signing_year.length) {
      const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
      if (!f.signing_year.includes(year)) return false;
    }
    return true;
  });
}

function fieldKind(def) {
  const type = def && def.type;
  if (['currency', 'percentage', 'duration', 'number', 'decimal', 'int', 'usd', 'percent'].includes(type)) return 'numeric';
  if (type === 'boolean') return 'boolean';
  if (type === 'enum') return 'enum';
  if (type === 'date') return 'date';
  return 'string';
}

function labelFor(field) {
  return String(field || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (m) => m.toUpperCase());
}

function dealColumn(deal) {
  const row = dealRow(deal);
  return {
    deal_id: row.deal_id,
    deal_name: row.deal_name,
    signing_date: row.signing_date,
    total_deal_value: row.total_deal_value,
  };
}

function dealMetaValue(deal, column) {
  const row = dealRow(deal);
  return row[normalizeFieldPath(column)] ?? null;
}

// WP-3 (M4-02) normalizer badges. Attaches to a value-bearing cell:
//   { canonical_key, matched_key, registry_version, card_id }
// `canonical_key`/`matched_key` come straight off the provisionFieldValue()
// result (`key`/`matchedKey`, which resolveFeatureValue produces — see
// lib/query/resolve.js). `card_id` is transient: pages/api/query/run.js
// batch-resolves extraction_version from it (provision_cards.provenance,
// looked up once per run, not per cell — see run.js's attachExtractionVersions)
// and strips it before the response is serialized, so it never reaches the
// client. Callers should only invoke this once `result.value` is confirmed
// non-empty — an empty cell gets no `_prov` and therefore no badge.
function buildProv(result, provision) {
  if (!result) return undefined;
  return {
    canonical_key: result.key || null,
    matched_key: result.matchedKey || result.key || null,
    registry_version: registryVersion(),
    card_id: (provision && provision.id) || null,
  };
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

module.exports = {
  byId,
  selectedDeals,
  firstProvision,
  firstProvisionWithField,
  provisionsForDealAndType,
  comparisonDeals,
  fieldKind,
  labelFor,
  dealColumn,
  dealMetaValue,
  fieldDef,
  provisionFieldValue,
  primaryQuote,
  buildProv,
  hasValue,
};
