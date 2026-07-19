// Query-surface field metadata: for a given provision_type, which fields can
// be filtered on, and — for coded/enum fields — which values actually occur
// in the live corpus (with human labels). Backs pages/api/query/field-options.js,
// which components/query/QueryFilterControls.jsx calls so the builder's
// "value" control offers real, human-labeled choices instead of a free-text
// box (item 1 of Ben's query-surface UX pass).
//
// Two kinds of "real options" per Ben's spec:
//   - taxonomy-coded fields (tagged/list-tagged, e.g. forceTheVoteType,
//     materialityQualifier) -> lib/taxonomy.js#taxonomyForFeatureKey gives the
//     canonical code -> label dictionary.
//   - plain enum fields with no taxonomy dictionary (e.g. considerationType,
//     boardChangeStandard) -> no static dictionary exists, so this scans the
//     live corpus for the codes that actually occur and humanizes them.
// Both paths funnel through the same "scan the corpus, label what's there"
// logic below, so a field only ever offers values a reviewer could actually
// hit — never a theoretical enum member with zero deals behind it.
//
// Booleans and numerics don't get an options list here: booleans render as
// presence phrasing client-side (no dictionary needed), numerics keep a
// number input with a unit hint (unitForType below).

const {
  fieldDef,
  featureDefsForWpType,
  provisionMatchesWpType,
  provisionFieldValue,
} = require('./types');
const { entryForKey } = require('./resolve');
const { taxonomyForFeatureKey, labelForCode } = require('../taxonomy');
const { humanizeKey } = require('./filter-labels');

// Registry/rubric `type` strings that render as a bare number with a unit
// hint rather than a value picker.
const NUMERIC_TYPES = new Set([
  'usd', 'currency', 'percentage', 'percent', 'duration', 'number', 'decimal', 'int',
]);

// Types whose values come from a fixed vocabulary (taxonomy dict or plain
// enum) and so get a value dropdown built from observed corpus codes.
const CODED_TYPES = new Set(['enum', 'tagged', 'list-tagged']);

function isNumericType(type) {
  return NUMERIC_TYPES.has(type);
}

function isCodedType(type) {
  return CODED_TYPES.has(type);
}

function isBooleanType(type) {
  return type === 'boolean';
}

// "BUSINESS_DAYS" -> "business days", "CALENDAR_DAYS" -> "calendar days".
// Falls back to a generic unit per registry `type` when the registry doesn't
// annotate a specific day-kind (most duration fields don't).
function unitForType(type, registryUnit) {
  if (type === 'usd' || type === 'currency') return '$';
  if (type === 'percentage' || type === 'percent') return '%';
  if (type === 'duration') {
    if (registryUnit && /day/i.test(String(registryUnit))) return String(registryUnit).toLowerCase().replace(/_/g, ' ');
    return 'days';
  }
  return null;
}

// One field's metadata for the builder's field dropdown: key/label/type/unit.
// Sorted by label so the dropdown reads alphabetically rather than in
// registry/displayOrder order (which mixes families).
function fieldsForProvisionType(provisionType) {
  const defs = featureDefsForWpType(provisionType);
  const out = [];
  const seen = new Set();
  for (const raw of defs) {
    if (!raw || !raw.key) continue;
    let def;
    try {
      def = fieldDef(provisionType, raw.key);
    } catch {
      continue; // BLOCKED_KEY_MISSING or similar — skip rather than 500 the endpoint.
    }
    if (!def || !def.type) continue;
    // Dedupe on the CANONICAL key fieldDef resolved to, not the raw rubric
    // key requested — several rubric keys are registry aliases of the same
    // canonical field (e.g. "feeAmount" -> "companyTerminationFee"), and
    // requesting each alias would otherwise list the same field twice.
    if (seen.has(def.key)) continue;
    seen.add(def.key);
    const registryEntry = entryForKey(raw.key);
    out.push({
      key: def.key,
      label: def.label || humanizeKey(def.key),
      type: def.type,
      unit: unitForType(def.type, registryEntry && registryEntry.unit),
      coded: isCodedType(def.type),
      boolean: isBooleanType(def.type),
      numeric: isNumericType(def.type),
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

// Distinct, human-labeled values actually present in the live corpus for one
// field of one provision type. Caller supplies the already-loaded
// {deals, provisions} context (see pages/api/query/field-options.js, which
// shares run.js's module-level cache rather than re-fetching per call).
function observedValueOptions(provisionType, fieldKey, provisions) {
  const dict = taxonomyForFeatureKey(fieldKey);
  const counts = new Map(); // code -> count
  for (const provision of provisions || []) {
    if (!provisionMatchesWpType(provision, provisionType)) continue;
    let resolved;
    try {
      resolved = provisionFieldValue(provision, provisionType, fieldKey, null);
    } catch {
      continue;
    }
    const value = resolved && resolved.value;
    if (value === null || value === undefined || value === '') continue;
    // List-typed fields collapse to a comma-joined label string
    // (valueFromRaw's list branch) — split back into individual codes so
    // each option is a real, selectable single value rather than a
    // multi-value blob.
    const codes = typeof value === 'string' && value.includes(', ') ? value.split(', ') : [String(value)];
    for (const code of codes) {
      const trimmed = code.trim();
      if (!trimmed) continue;
      counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
    }
  }
  const options = [...counts.entries()]
    .map(([code, count]) => ({
      code,
      label: (dict && labelForCode(code, dict)) || humanizeKey(code),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return options;
}

// Full value-options response for one field: type/unit (so the client knows
// which control to render) plus the coded options list when applicable.
function valueOptionsForField(provisionType, fieldKey, provisions) {
  let def;
  try {
    def = fieldDef(provisionType, fieldKey);
  } catch {
    def = null;
  }
  const type = (def && def.type) || 'string';
  const registryEntry = entryForKey(fieldKey);
  const unit = unitForType(type, registryEntry && registryEntry.unit);
  if (isBooleanType(type)) {
    return { type, unit: null, label: (def && def.label) || humanizeKey(fieldKey), options: [] };
  }
  if (isNumericType(type)) {
    return { type, unit, label: (def && def.label) || humanizeKey(fieldKey), options: [] };
  }
  // Coded (enum/tagged/list-tagged) AND plain string/object/list fields all
  // get the same treatment: whatever actually occurs in the corpus, labeled.
  // A field with zero occurrences (e.g. a brand-new provision type with no
  // extracted data yet) legitimately returns an empty list — the client
  // falls back to a free-text input rather than an empty, useless dropdown.
  const options = observedValueOptions(provisionType, fieldKey, provisions);
  return { type, unit: null, label: (def && def.label) || humanizeKey(fieldKey), options };
}

module.exports = {
  NUMERIC_TYPES,
  CODED_TYPES,
  isNumericType,
  isCodedType,
  isBooleanType,
  unitForType,
  fieldsForProvisionType,
  observedValueOptions,
  valueOptionsForField,
};
