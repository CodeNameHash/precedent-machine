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

// 2026-08-05: was first-number-wins -- harmless while fee amounts were
// always single clean figures, but a canonical projection change now
// renders a real conditional fee as free text naming TWO amounts plus a cap,
// e.g. Modiv's actual company termination fee, "Lesser of $10,000,000
// (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv) or (v)) and the
// REIT Requirements cap" (see lib/canonical-v2/termination-product-
// projection.js). Taking the first number would silently divide
// feePctOfDealValue/reverseFeePctOfDealValue off the FIRST branch alone,
// dropping the second branch and the cap: a wrong percentage that looks
// precise is worse than no percentage. Same principle, same day, as
// parseFeeAmountUsd in components/review/table-configs/termination-
// fees.config.js and numericValue in lib/feature-compare.js -- a string
// naming more than one number is not one clean figure, full stop (also
// catches a plain range like "30-45 days"). Zero matches is the existing
// "nothing to parse" case and also yields null, unchanged from before.
function parseUsdAmount(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const matches = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) || [];
  if (matches.length !== 1) return null;
  const n = Number(matches[0]);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unwrapObject(value) {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    if (!Object.prototype.hasOwnProperty.call(current, 'value')) return current;
    if (!current.value || typeof current.value !== 'object' || Array.isArray(current.value)) return current;
    current = current.value;
  }
  return current;
}

function firstScalar(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        const nested = firstScalar(value.value);
        if (nested !== null) return nested;
      }
      continue;
    }
    return value;
  }
  return null;
}

function triggerDetails(rawTriggers) {
  if (!Array.isArray(rawTriggers)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of rawTriggers) {
    const trigger = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const text = typeof raw === 'string'
      ? raw.trim()
      : firstScalar(trigger.text, trigger.quote, trigger.label);
    const label = typeof raw === 'string'
      ? raw.trim()
      : firstScalar(trigger.label, trigger.name, trigger.code, trigger.text);
    if (!text && !label) continue;
    const key = String(trigger.code || label || text).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: trigger.code || null,
      label: String(label || text).trim(),
      text: String(text || label).trim(),
    });
  }
  return out;
}

function feeDetails(provision, side = 'company') {
  const features = getFeatures(provision);
  const feature = (key) => features[key];
  const reverse = side === 'reverse';
  const sourceKey = reverse ? 'reverseTerminationFee' : 'companyTerminationFee';
  const rawFee = unwrapObject(features[sourceKey]);
  const fee = rawFee && typeof rawFee === 'object' && !Array.isArray(rawFee) ? rawFee : {};
  const amountRaw = firstScalar(
    fee.amount,
    fee.fee_amount,
    features[reverse ? 'reverseFeeAmount' : 'feeAmount'],
    typeof rawFee !== 'object' ? rawFee : null,
  );
  const percentageRaw = firstScalar(
    fee.percentage_of_equity,
    fee.percentageOfEquity,
    fee.percentage,
    features[reverse ? 'reverseFeePercentage' : 'feePercentage'],
    reverse ? null : feature('terminationFeePercentEquityValue'),
  );
  const triggers = triggerDetails(
    Array.isArray(fee.triggers)
      ? fee.triggers
      : (features[reverse ? 'reverseFeeTriggers' : 'triggers'] || feature('triggerEvents')),
  );
  const amount = parseUsdAmount(amountRaw);
  const percentage = parseUsdAmount(percentageRaw);
  const quote = triggers[0]?.text
    || firstScalar(fee.text, Array.isArray(fee.quotes) ? fee.quotes[0] : null)
    || (provision && provision.full_text)
    || null;
  return {
    side: reverse ? 'reverse_buyer' : 'company_target',
    sourceKey,
    sourceLabel: reverse ? 'Reverse / buyer termination fee' : 'Company / target termination fee',
    amount,
    amountRaw,
    percentage,
    triggers,
    quote,
  };
}

function feePercentOfDealValue(provision, deal, side) {
  const details = feeDetails(provision, side);
  const dealValue = deal && deal.value_usd != null ? Number(deal.value_usd) : null;
  if (details.amount == null || !dealValue || !Number.isFinite(dealValue) || dealValue <= 0) return null;
  return {
    value: round((details.amount / dealValue) * 100, 2),
    quote: details.quote,
    details,
  };
}

// key -> { provisionType, label, type, compute(provision, deal) -> { value, quote } | null }
const DERIVED_FIELDS = {
  feePctOfDealValue: {
    provisionType: 'TERMINATION_FEE',
    label: 'Company / target termination fee (% of deal value)',
    type: 'percentage',
    compute(provision, deal) {
      return feePercentOfDealValue(provision, deal, 'company');
    },
  },
  reverseFeePctOfDealValue: {
    provisionType: 'TERMINATION_FEE',
    label: 'Reverse / buyer termination fee (% of deal value)',
    type: 'percentage',
    compute(provision, deal) {
      return feePercentOfDealValue(provision, deal, 'reverse');
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

module.exports = {
  DERIVED_FIELDS,
  derivedFieldDef,
  computeDerivedField,
  feeDetails,
  feePercentOfDealValue,
  parseUsdAmount,
  triggerDetails,
};
