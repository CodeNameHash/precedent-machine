const { FEATURES } = require('./features');
const { TAGS } = require('./tags');

const MODEL_READONLY_KEYS = new Set([
  'aocCitedCovenantNames',
  'approvalDefinition',
  'canonicalCode',
  'citedProvisionNames',
  'definition',
  'extensionMonths',
  'flags',
  'inlineDefinition',
  'isNewCode',
  'knowledgeScope',
  'linkedBringDownStandard',
  'materialContractsBucketsSource',
  'outsideDateMonthsPostSigning',
  'parentProvisionType',
  'proposedCode',
  'proposedLabel',
  'reapplied_corrections',
  'restrictionComponents',
  'relatedDefinitions',
  'sort_order',
  'sourceSection',
  'sourceSectionTitle',
  'sourceSectionType',
  'startChar',
  'standstillWaiverPermitted_flagRef',
]);

const LOW_VALUE_PROMPT_KEYS = new Set([
  'scheduleReference',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function schemaFeatureFor(legacyFeature) {
  if (!legacyFeature || !legacyFeature.key) return legacyFeature;
  const schema = FEATURES[legacyFeature.key];
  if (!schema) return {
    key: legacyFeature.key,
    label: legacyFeature.label || legacyFeature.key,
    description: legacyFeature.label || legacyFeature.key,
    valueType: legacyFeature.type || 'string',
    unit: null,
    enumSet: legacyFeature.options || null,
    objectShape: null,
    listItemType: legacyFeature.type === 'list-tagged' ? 'tag' : null,
    listItemTagFamily: null,
    provisionTypes: [],
    provisionCodes: null,
    requiredEvidence: !!legacyFeature.requiredEvidence,
    citable: !!legacyFeature.citable,
    displayGroup: 'Other',
    displayOrder: 999999,
    benchmarkable: false,
    whenEmpty: 'silent',
    formatter: null,
    extractionPrompt: legacyFeature.label || legacyFeature.key,
  };
  return {
    ...schema,
    legacyType: legacyFeature.type,
    legacyOptions: legacyFeature.options || null,
    legacyCitable: !!legacyFeature.citable,
    legacySource: legacyFeature.source || null,
    legacyScope: legacyFeature.scope || null,
  };
}

function getFeaturesForPrompt(type, code, ctx = {}) {
  const base = Array.isArray(ctx.features)
    ? ctx.features.map(schemaFeatureFor)
    : Object.values(FEATURES).filter((feature) => {
        if (!type || !Array.isArray(feature.provisionTypes) || !feature.provisionTypes.includes(type)) return false;
        if (!code) return true;
        return !Array.isArray(feature.provisionCodes) || feature.provisionCodes.length === 0 || feature.provisionCodes.includes(code);
      });

  const deduped = [];
  const seen = new Set();
  for (const feature of base) {
    if (!isPromptableFeature(feature, ctx)) continue;
    if (seen.has(feature.key)) continue;
    seen.add(feature.key);
    deduped.push(feature);
  }

  return deduped
    .sort((a, b) => (a.key === 'mainConcept' ? 1 : 0) - (b.key === 'mainConcept' ? 1 : 0)
      || String(promptGroup(a)).localeCompare(String(promptGroup(b)))
      || (a.displayOrder || 0) - (b.displayOrder || 0)
      || a.key.localeCompare(b.key));
}

function isPromptableFeature(feature, ctx = {}) {
  if (!feature || !feature.key) return false;
  if (MODEL_READONLY_KEYS.has(feature.key)) return false;
  if (feature.legacySource === 'post-pass' || feature.legacySource === 'linked-from-COND') return false;
  if (!ctx.includeLowValue && LOW_VALUE_PROMPT_KEYS.has(feature.key)) return false;
  return true;
}

function enumValues(feature) {
  if (Array.isArray(feature.enumSet) && feature.enumSet.length > 0) return feature.enumSet;
  if (Array.isArray(feature.legacyOptions) && feature.legacyOptions.length > 0) return feature.legacyOptions;
  return null;
}

function tagCount(family, featureKey) {
  return Object.values(TAGS).filter((tag) => tag.family === family && (!featureKey || tag.appearsOn.includes(featureKey))).length;
}

function valueShape(feature) {
  const valueType = feature.valueType || feature.legacyType || 'string';
  if (feature.listItemTagFamily) {
    return `array of tagged objects { code, label, text } from ${feature.listItemTagFamily}`;
  }
  if (feature.legacyType === 'list-tagged') {
    return 'array of tagged objects { code, label, text }';
  }
  if (feature.legacyType === 'tagged') {
    return 'tagged object { code, label, text }, or null';
  }
  if (valueType === 'enum') {
    const values = enumValues(feature);
    return values ? `one of ${JSON.stringify(values)}, or null` : 'canonical enum value, or null';
  }
  if (valueType === 'boolean') return 'true/false';
  if (valueType === 'number') return feature.unit ? `number (${feature.unit}), or null` : 'number, or null';
  if (valueType === 'quote') return 'verbatim quote string, or null';
  if (valueType === 'list') {
    if (feature.listItemType === 'object') return 'array of objects, or empty array []';
    return 'array of strings or structured items, or empty array []';
  }
  if (valueType === 'object') {
    if (feature.objectShape && isPlainObject(feature.objectShape)) return 'object matching the registered objectShape, or null';
    return 'object, or null';
  }
  return 'free text string, or null';
}

function promptText(feature) {
  if (feature.key === 'mainConcept') {
    return 'Fallback one-sentence provision summary for admin/search. Keep short; do not use this as a substitute for structured fields.';
  }
  if (feature.key === 'permittedExceptions') {
    return 'Permitted exceptions or carve-outs actually stated in the source. Be conservative: only extract real exception language, and preserve the shape/quote the agreement uses.';
  }
  if (feature.key === 'materialContractsBuckets') {
    return 'Material-contract bucket tags. Use the best canonical bucket where available; if the agreement has a specific bucket not represented, preserve it as OTHER with verbatim text rather than forcing a bad code.';
  }
  return feature.extractionPrompt || feature.description || feature.label || feature.key;
}

function renderFeatureLine(feature) {
  let suffix = '';
  if (feature.requiredEvidence || feature.citable || feature.legacyCitable) {
    suffix += ' Evidence required: include verbatim source quote when possible.';
  }
  if (feature.listItemTagFamily) {
    const count = tagCount(feature.listItemTagFamily, feature.key);
    suffix += ` Tag family: ${feature.listItemTagFamily}${count ? ` (${count} registered tags)` : ''}.`;
  }
  return `- ${feature.key}: ${valueShape(feature)} — ${promptText(feature)}${suffix}`;
}

function promptGroup(feature) {
  if (feature && feature.key === 'mainConcept') return 'Fallback summary';
  return (feature && feature.displayGroup) || 'Other';
}

function renderExtractionPromptParts(type, code = null, ctx = {}) {
  const features = getFeaturesForPrompt(type, code, ctx);
  const groups = new Map();
  for (const feature of features) {
    const group = promptGroup(feature);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(feature);
  }

  const lines = [];
  for (const [group, members] of groups.entries()) {
    if (ctx.groupHeadings !== false) lines.push(`\n${group}:`);
    for (const feature of members) lines.push(renderFeatureLine(feature));
  }

  const omittedKeys = [];
  const input = Array.isArray(ctx.features) ? ctx.features.map((feature) => feature.key) : Object.keys(FEATURES);
  for (const key of input) {
    const feature = FEATURES[key] || { key };
    if (!isPromptableFeature(schemaFeatureFor(feature), ctx)) omittedKeys.push(key);
  }

  return {
    type,
    code,
    features,
    lines,
    omittedKeys,
    anyRequiredEvidence: features.some((feature) => feature.requiredEvidence || feature.citable || feature.legacyCitable),
  };
}

function renderExtractionPrompt(type, code = null, ctx = {}) {
  const parts = renderExtractionPromptParts(type, code, ctx);
  if (parts.lines.length === 0) return '';
  const evidence = parts.anyRequiredEvidence
    ? '\nWhen a field requests evidence, quote only contiguous source text copied from the agreement. Do not paraphrase legal text.\n'
    : '';
  return [
    `Schema-reviewed extraction fields for ${code || type}:`,
    evidence,
    ...parts.lines,
  ].filter(Boolean).join('\n');
}

module.exports = {
  MODEL_READONLY_KEYS,
  LOW_VALUE_PROMPT_KEYS,
  getFeaturesForPrompt,
  isPromptableFeature,
  renderExtractionPrompt,
  renderExtractionPromptParts,
  renderFeatureLine,
};
