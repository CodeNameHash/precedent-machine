/* lib/query/derived-fields.js — query-time-only derived fields.
 *
 * These are NOT canonical extracted fields (never written to
 * ai_metadata.features, never registered in docs/schema-shape/normalized-v1.json).
 * They are computed on the fly from existing canonical fields already present
 * on a provision/deal pair. Adding a new one here is a "how do we compute this
 * from what we already have" decision; adding a new *extracted* canonical
 * field is a Ben-gated taxonomy decision and does NOT belong in this file.
 *
 * Per docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md WP-1, gap G-A:
 * termination-fee-as-percent-of-deal-value is derived at query time from
 * `companyTerminationFee.amount` (a free-text USD string on the TERMF
 * provision) divided by `deals.value_usd`, rather than backfilling a new
 * extractor field. (G-C, outside-date months derived from outsideDateISO -
 * signing date, turned out to already be satisfied by the existing canonical
 * field `outsideDateMonthsPostSigning` — computed by a deterministic
 * extraction-time post-pass, see lib/parser-v2/extract.js
 * `computeOutsideDateMonths` — so no query-time derivation was needed there.)
 */

const { getFeatures } = require('../feature-compare');

function parseUsdAmount(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// key -> { provisionType, label, type, compute(provision, deal) -> { value, quote } | null }
const DERIVED_FIELDS = {
  feePctOfDealValue: {
    provisionType: 'TERMINATION_FEE',
    label: 'Termination fee (% of deal value)',
    type: 'percentage',
    compute(provision, deal) {
      const feats = getFeatures(provision);
      const raw = feats.companyTerminationFee;
      const rawAmount = raw && typeof raw === 'object' ? raw.amount : raw;
      const amount = parseUsdAmount(rawAmount);
      const dealValue = deal && deal.value_usd != null ? Number(deal.value_usd) : null;
      if (amount == null || !dealValue || !Number.isFinite(dealValue) || dealValue <= 0) return null;
      const quote = (raw && Array.isArray(raw.triggers) && raw.triggers[0] && raw.triggers[0].text)
        || (provision && provision.full_text)
        || null;
      return { value: round((amount / dealValue) * 100, 2), quote };
    },
  },
};

function derivedFieldDef(provisionType, fieldPath) {
  const entry = DERIVED_FIELDS[String(fieldPath || '').trim()];
  if (!entry || entry.provisionType !== provisionType) return null;
  return { key: String(fieldPath).trim(), label: entry.label, type: entry.type };
}

function computeDerivedField(provisionType, fieldPath, provision, deal) {
  const entry = DERIVED_FIELDS[String(fieldPath || '').trim()];
  if (!entry || entry.provisionType !== provisionType) return null;
  return entry.compute(provision, deal || null);
}

module.exports = { DERIVED_FIELDS, derivedFieldDef, computeDerivedField, parseUsdAmount };
