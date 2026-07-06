const { FEATURES } = require('./features');

const EMPTY_STATES = new Set(['not_applicable', 'silent', 'extraction_pending', 'needs_review']);

function objectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function metadataOf(provision) {
  const raw = provision && provision.ai_metadata;
  if (typeof raw === 'string') {
    try { return objectValue(JSON.parse(raw)); } catch { return {}; }
  }
  return objectValue(raw);
}

function featuresOf(provision) {
  return objectValue(metadataOf(provision).features);
}

function provisionCode(provision) {
  const metadata = metadataOf(provision);
  const features = objectValue(metadata.features);
  return metadata.code || features.canonicalCode || provision?.code || null;
}

function emptyStateOf(feature) {
  const state = feature && feature.whenEmpty;
  return EMPTY_STATES.has(state) ? state : 'needs_review';
}

function isEmptyFeatureValue(value) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    if ('value' in value) return isEmptyFeatureValue(value.value);
    if ('text' in value && value.text) return false;
    if ('quote' in value && value.quote) return false;
    if (Array.isArray(value.quotes) && value.quotes.length > 0) return false;
    return Object.keys(value).length === 0;
  }
  return false;
}

function featureAppliesToProvision(feature, provision) {
  if (!feature || !provision) return false;
  if (!Array.isArray(feature.provisionTypes) || !feature.provisionTypes.includes(provision.type)) return false;
  const codes = Array.isArray(feature.provisionCodes) ? feature.provisionCodes.filter(Boolean) : [];
  if (codes.length === 0) return true;
  const code = provisionCode(provision);
  return !!code && codes.includes(code);
}

function featuresForProvision(provision, features = Object.values(FEATURES)) {
  return features.filter((feature) => featureAppliesToProvision(feature, provision));
}

function emptyFieldRowsForProvision(provision, opts = {}) {
  const states = opts.states ? new Set(opts.states) : null;
  const featureValues = featuresOf(provision);
  return featuresForProvision(provision, opts.features || Object.values(FEATURES))
    .filter((feature) => isEmptyFeatureValue(featureValues[feature.key]))
    .map((feature) => ({
      feature_key: feature.key,
      label: feature.label || feature.key,
      state: emptyStateOf(feature),
      provision_id: provision.id || null,
      deal_id: provision.deal_id || null,
      type: provision.type || null,
      code: provisionCode(provision),
      category: provision.category || null,
      section_number: provision.section_number || featureValues.sectionNumber || featureValues.section_number || null,
    }))
    .filter((row) => !states || states.has(row.state));
}

function summarizeSchemaCoverage(provisions, opts = {}) {
  const features = opts.features || Object.values(FEATURES);
  const byKey = new Map();
  const totals = {
    provisions: 0,
    feature_opportunities: 0,
    populated: 0,
    not_applicable: 0,
    silent: 0,
    extraction_pending: 0,
    needs_review: 0,
  };

  for (const provision of provisions || []) {
    totals.provisions += 1;
    const featureValues = featuresOf(provision);
    for (const feature of featuresForProvision(provision, features)) {
      const state = emptyStateOf(feature);
      let row = byKey.get(feature.key);
      if (!row) {
        row = {
          feature_key: feature.key,
          label: feature.label || feature.key,
          provision_types: feature.provisionTypes || [],
          provision_codes: feature.provisionCodes || [],
          when_empty: state,
          total: 0,
          populated: 0,
          not_applicable: 0,
          silent: 0,
          extraction_pending: 0,
          needs_review: 0,
        };
        byKey.set(feature.key, row);
      }
      row.total += 1;
      totals.feature_opportunities += 1;
      if (isEmptyFeatureValue(featureValues[feature.key])) {
        row[state] += 1;
        totals[state] += 1;
      } else {
        row.populated += 1;
        totals.populated += 1;
      }
    }
  }

  const rows = [...byKey.values()].sort((a, b) => {
    const aEmpty = a.total - a.populated;
    const bEmpty = b.total - b.populated;
    return b.needs_review - a.needs_review
      || b.extraction_pending - a.extraction_pending
      || bEmpty - aEmpty
      || a.feature_key.localeCompare(b.feature_key);
  });

  return { totals, features: rows };
}

module.exports = {
  EMPTY_STATES,
  emptyFieldRowsForProvision,
  emptyStateOf,
  featureAppliesToProvision,
  featuresForProvision,
  featuresOf,
  isEmptyFeatureValue,
  provisionCode,
  summarizeSchemaCoverage,
};
