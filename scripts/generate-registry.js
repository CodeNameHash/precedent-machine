#!/usr/bin/env node

/*
 * WP-SCHEMA P3 registry generator.
 *
 * Reads the P1 inventory and emits generated FeatureDef / TagDef maps.
 * The generated files are the audit starting point for the hand-maintained
 * lib/schema/features.js and lib/schema/tags.js registries.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MIGRATION_DIR = path.join(ROOT, 'docs/schema-migration');
const INVENTORY_JSONL = path.join(MIGRATION_DIR, 'inventory.jsonl');
const SOURCE_INVENTORY = path.join(MIGRATION_DIR, 'source-inventory.json');
const FEATURES_GENERATED = path.join(ROOT, 'lib/schema/features.generated.js');
const TAGS_GENERATED = path.join(ROOT, 'lib/schema/tags.generated.js');
const DELETIONS = path.join(MIGRATION_DIR, 'deletions.md');
const PHASE_NOTES = path.join(MIGRATION_DIR, 'phase-3-notes.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function uniq(values) {
  return [...new Set((values || []).filter((v) => v !== null && v !== undefined && v !== ''))];
}

function sortStrings(values) {
  return uniq(values).sort((a, b) => String(a).localeCompare(String(b)));
}

function camelToLabel(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bMae\b/g, 'MAE')
    .replace(/\bHsr\b/g, 'HSR')
    .replace(/\bDgcl\b/g, 'DGCL')
    .replace(/\bCvr\b/g, 'CVR')
    .replace(/\bIoc\b/g, 'IOC')
    .replace(/\bNosol\b/g, 'NoSol');
}

function snake(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function inferUnit(key) {
  const lower = String(key || '').toLowerCase();
  if (lower.includes('percent') || lower.endsWith('pct') || lower.includes('percentage')) return 'percent';
  if (lower.includes('businessday') || lower.includes('businessdays')) return 'business_days';
  if (lower.includes('calendarday') || lower.includes('calendardays')) return 'calendar_days';
  if (lower.includes('month')) return 'months';
  if (lower.includes('day') || lower.includes('period') || lower.includes('deadline')) return 'days';
  if (lower.includes('multiplier') || lower.includes('multiple')) return 'multiplier';
  if (lower.includes('amount') || lower.includes('value') || lower.endsWith('usd') || lower.includes('price') || lower.includes('fee')) return 'usd';
  return null;
}

function normalizeValueType(type, key) {
  const raw = String(type || '').toLowerCase();
  if (raw === 'boolean') return 'boolean';
  if (raw === 'enum') return 'enum';
  if (raw === 'number' || raw === 'currency' || raw === 'percentage' || raw === 'duration') return 'number';
  if (raw === 'object' || raw === 'tagged') return 'object';
  if (raw === 'list' || raw === 'list-tagged' || raw === 'object-list' || raw === 'tiers') return 'list';
  if (raw === 'quote') return 'quote';
  if (inferUnit(key)) return 'number';
  return 'string';
}

function formatterFor(feature) {
  if (feature.valueType === 'enum') return 'enum_titlecase';
  if (feature.valueType === 'quote') return 'quote';
  if (feature.unit === 'percent') return 'percent1dp';
  if (feature.unit === 'usd') return 'usd_short';
  if (feature.unit === 'months') return 'months_int';
  if (feature.unit === 'days' || feature.unit === 'business_days' || feature.unit === 'calendar_days') return 'days_int';
  if (feature.valueType === 'object' && /deadline/i.test(feature.key)) return 'deadline_object';
  return null;
}

function displayGroupFor(types) {
  const first = (types || [])[0] || '';
  if (first === 'STRUCT') return 'Structure';
  if (first === 'CONSID') return 'Consideration';
  if (first.startsWith('COND')) return 'Deal certainty';
  if (first === 'NOSOL' || first.startsWith('TERMR')) return 'Fiduciary out';
  if (first.startsWith('TERM')) return 'Termination';
  if (first === 'ANTI') return 'Regulatory';
  if (first.startsWith('REP')) return 'Representations';
  if (first.startsWith('IOC') || first === 'COV') return 'Interim covenants';
  if (first === 'DEF') return 'Definitions';
  if (first === 'MISC') return 'Boilerplate';
  return 'Other';
}

function displayOrderIndex(sourceInventory) {
  const order = new Map();
  let fallback = 10000;
  for (const typeEntry of sourceInventory.categorySummary.types || []) {
    for (const key of typeEntry.featureKeys || []) {
      if (!order.has(key)) order.set(key, order.size + 1);
    }
  }
  return (key) => order.get(key) || fallback++;
}

function rowsForSource(row, source) {
  const value = row.source_appearances && row.source_appearances[source];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeProvisionType(type, validTypes) {
  if (!type) return null;
  if (validTypes.has(type)) return type;
  if (/^TERMR(?:-|$)/.test(type)) return 'TERMR';
  if (/^TERMF(?:-|$)/.test(type)) return 'TERMF';
  if (/^COND-M(?:-|$)/.test(type)) return 'COND-M';
  if (/^COND-B(?:-|$)/.test(type)) return 'COND-B';
  if (/^COND-S(?:-|$)/.test(type)) return 'COND-S';
  if (/^COND(?:-|$)/.test(type)) return 'COND';
  if (/^REP-T(?:-|$)/.test(type)) return 'REP-T';
  if (/^REP-B(?:-|$)/.test(type)) return 'REP-B';
  if (/^IOC(?:-|$)/.test(type)) return 'IOC';
  if (/^NOSOL(?:-|$)/.test(type)) return 'NOSOL';
  if (/^ANTI(?:-|$)/.test(type)) return 'ANTI';
  if (/^COV(?:-|$)/.test(type)) return 'COV';
  if (/^STRUCT(?:-|$)/.test(type)) return 'STRUCT';
  if (/^CONSID(?:-|$)/.test(type)) return 'CONSID';
  if (/^MISC(?:-|$)/.test(type)) return 'MISC';
  if (/^DEF(?:-|$)|^MAE(?:-|$)/.test(type)) return 'DEF';
  return null;
}

function provisionTypesFor(row, validTypes) {
  const out = [];
  for (const source of ['rubric_js', 'expected_sets_js', 'category_summary_features_js']) {
    for (const item of rowsForSource(row, source)) {
      if (item.type) out.push(normalizeProvisionType(item.type, validTypes));
      if (Array.isArray(item.types)) out.push(...item.types.map((type) => normalizeProvisionType(type, validTypes)));
    }
  }
  return sortStrings(out);
}

function provisionCodesFor(row) {
  const out = [];
  for (const source of ['rubric_js', 'expected_sets_js']) {
    for (const item of rowsForSource(row, source)) {
      if (item.code) out.push(item.code);
      if (Array.isArray(item.bundles)) out.push(...item.bundles);
    }
  }
  return sortStrings(out).filter((code) => /^[A-Z]+[A-Z0-9-]+$/.test(code));
}

function labelFor(row) {
  const labels = uniq(row.labels || []);
  if (labels.length) return labels[0];
  const summary = rowsForSource(row, 'category_summary_features_js').find((item) => item.rowLabel);
  if (summary) return summary.rowLabel;
  return camelToLabel(row.key);
}

function fallbackTagFamily(key) {
  if (/exceptions?$/i.test(key)) return 'EXCEPTION_CODES';
  if (/instrumentVesting/i.test(key)) return 'VESTING_STATUS';
  return null;
}

function tagFamilyByFeature(rows, sourceInventory) {
  const mapped = new Map();
  for (const mapping of sourceInventory.taxonomy.featureKeyMappings || []) {
    if (!mapping.key) continue;
    mapped.set(mapping.key, (mapping.families || [])[0] || null);
  }
  const out = new Map();
  for (const row of rows) {
    const rawType = String((row.type_candidates || [])[0] || row.declared_type || '').toLowerCase();
    if (rawType !== 'list-tagged') continue;
    out.set(row.key, mapped.get(row.key) || fallbackTagFamily(row.key));
  }
  return out;
}

function buildFeature(row, sourceInventory, getDisplayOrder, featureTagFamily, validTypes) {
  const rawType = (row.type_candidates || [])[0] || row.declared_type || null;
  const valueType = normalizeValueType(row.declared_type || rawType, row.key);
  const unit = valueType === 'number' ? inferUnit(row.key) : null;
  const provisionTypes = provisionTypesFor(row, validTypes);
  const provisionCodes = provisionCodesFor(row);
  const family = featureTagFamily.get(row.key) || null;
  const isTaggedList = String(row.declared_type || rawType).toLowerCase() === 'list-tagged';
  const isObjectList = ['object-list', 'tiers'].includes(String(row.declared_type || rawType).toLowerCase());
  const citable = rowsForSource(row, 'rubric_js').some((item) => item.citable === true);
  const requiredEvidence = rowsForSource(row, 'rubric_js').some((item) => item.requiredEvidence === true);
  const displayGroup = displayGroupFor(provisionTypes);
  const feature = {
    key: row.key,
    label: labelFor(row),
    description: `TODO: describe ${labelFor(row)}.`,
    valueType,
    unit,
    enumSet: valueType === 'enum' ? sortStrings(row.declared_options || []) : null,
    objectShape: null,
    listItemType: valueType === 'list' ? (isTaggedList ? 'tag' : (isObjectList ? 'object' : 'string')) : null,
    listItemTagFamily: valueType === 'list' && isTaggedList ? family : null,
    provisionTypes: provisionTypes.length ? provisionTypes : ['MISC'],
    provisionCodes: provisionCodes.length ? provisionCodes : null,
    presence: 'often',
    presenceCondition: null,
    requiredEvidence: requiredEvidence || (valueType === 'quote'),
    citable,
    displayGroup,
    displayOrder: getDisplayOrder(row.key),
    benchmarkable: row.benchmarkable_hint === true && ['number', 'enum', 'boolean'].includes(valueType),
    benchmarkFamily: snake(displayGroup),
    benchmarkMinN: 10,
    favorabilityDirection: null,
    favorabilityWeight: 0,
    favorabilityRule: null,
    whenEmpty: 'silent',
    stableAnchor: ['sectionNumber', 'canonicalCode', 'provisionType'].includes(row.key),
    aliases: null,
    formatter: null,
    extractionPrompt: labelFor(row),
    exampleValue: null,
  };
  feature.formatter = formatterFor(feature);
  return feature;
}

function buildTags(sourceInventory, featureTagFamily) {
  const appearsByFamily = new Map();
  for (const [featureKey, family] of featureTagFamily.entries()) {
    if (!family) continue;
    if (!appearsByFamily.has(family)) appearsByFamily.set(family, []);
    appearsByFamily.get(family).push(featureKey);
  }
  const usedFamilies = new Set(appearsByFamily.keys());

  const tags = {};
  for (const familyEntry of sourceInventory.taxonomy.families || []) {
    const family = familyEntry.family;
    if (!usedFamilies.has(family)) continue;
    for (const codeEntry of familyEntry.codes || []) {
      const key = `${family}:${codeEntry.code}`;
      tags[key] = {
        code: codeEntry.code,
        family,
        label: codeEntry.label || camelToLabel(codeEntry.code),
        description: codeEntry.description || `${codeEntry.label || camelToLabel(codeEntry.code)} taxonomy tag.`,
        appearsOn: sortStrings(appearsByFamily.get(family) || []),
        aliases: null,
        benchmarkable: false,
      };
    }
  }
  return tags;
}

function supplementalFeature({
  key,
  label,
  description,
  valueType = 'string',
  unit = null,
  provisionTypes,
  displayGroup,
  displayOrder,
  formatter = null,
  benchmarkable = false,
  listItemType = null,
}) {
  return {
    key,
    label,
    description,
    valueType,
    unit,
    enumSet: null,
    objectShape: null,
    listItemType,
    listItemTagFamily: null,
    provisionTypes,
    provisionCodes: null,
    presence: 'rare',
    presenceCondition: null,
    requiredEvidence: false,
    citable: false,
    displayGroup,
    displayOrder,
    benchmarkable,
    benchmarkFamily: snake(displayGroup),
    benchmarkMinN: 10,
    favorabilityDirection: null,
    favorabilityWeight: 0,
    favorabilityRule: null,
    whenEmpty: 'silent',
    stableAnchor: false,
    aliases: null,
    formatter,
    extractionPrompt: label,
    exampleValue: null,
  };
}

function supplementalLiveFeatures(validTypes) {
  const allTypes = [...validTypes].sort();
  return {
    flags: supplementalFeature({
      key: 'flags',
      label: 'Internal quality flags',
      description: 'Internal parser or extraction quality flags attached to a provision.',
      valueType: 'list',
      listItemType: 'object',
      provisionTypes: allTypes,
      displayGroup: 'Internal',
      displayOrder: 90000,
    }),
    parentProvisionType: supplementalFeature({
      key: 'parentProvisionType',
      label: 'Parent provision type',
      description: 'Internal pointer to the parent provision type for generated leftover rows.',
      provisionTypes: ['OTHER'],
      displayGroup: 'Internal',
      displayOrder: 90001,
    }),
    erisaCompliance: supplementalFeature({
      key: 'erisaCompliance',
      label: 'ERISA compliance language',
      description: 'Verbatim ERISA compliance language in employee-benefit plan representations.',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90002,
      formatter: 'quote',
    }),
    erisaParachutePayments: supplementalFeature({
      key: 'erisaParachutePayments',
      label: 'ERISA parachute-payment language',
      description: 'Verbatim parachute-payment or Section 280G / 4999 language in employee-benefit plan representations.',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90003,
      formatter: 'quote',
    }),
    erisaPlansListed: supplementalFeature({
      key: 'erisaPlansListed',
      label: 'ERISA plans listed',
      description: 'Whether the disclosure schedules list company benefit or ERISA plans.',
      valueType: 'object',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90004,
    }),
    erisaTitleIVPlans: supplementalFeature({
      key: 'erisaTitleIVPlans',
      label: 'Title IV ERISA plans',
      description: 'Whether Title IV ERISA plan exposure is present or disclaimed.',
      valueType: 'object',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90005,
    }),
    erisaMultiemployer: supplementalFeature({
      key: 'erisaMultiemployer',
      label: 'Multiemployer plan exposure',
      description: 'Whether multiemployer plan exposure is present or disclaimed.',
      valueType: 'object',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90006,
    }),
    lookbackAnchor: supplementalFeature({
      key: 'lookbackAnchor',
      label: 'Look-back anchor',
      description: 'Anchor used for an absence-of-changes or related-party look-back period.',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90007,
      formatter: 'enum_titlecase',
    }),
    lookbackDateISO: supplementalFeature({
      key: 'lookbackDateISO',
      label: 'Look-back date',
      description: 'ISO date used for an absence-of-changes or related-party look-back period.',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90008,
    }),
    lookbackTiedToIncorporation: supplementalFeature({
      key: 'lookbackTiedToIncorporation',
      label: 'Look-back tied to incorporation',
      description: 'Whether the look-back period is tied to incorporation rather than a fixed date.',
      valueType: 'boolean',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90009,
      benchmarkable: true,
    }),
    materialContractsBucketsSource: supplementalFeature({
      key: 'materialContractsBucketsSource',
      label: 'Material-contract bucket source',
      description: 'Source metadata for material-contract bucket classification.',
      valueType: 'object',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90010,
    }),
    maeQualifiedRepsEvidence: supplementalFeature({
      key: 'maeQualifiedRepsEvidence',
      label: 'MAE-qualified representation evidence',
      description: 'Evidence that a representation is qualified by a Material Adverse Effect standard.',
      valueType: 'object',
      provisionTypes: ['REP-T'],
      displayGroup: 'Representations',
      displayOrder: 90011,
    }),
    counterparts: supplementalFeature({
      key: 'counterparts',
      label: 'Counterparts language',
      description: 'Verbatim counterparts and electronic-signature boilerplate language.',
      provisionTypes: ['MISC'],
      displayGroup: 'Boilerplate',
      displayOrder: 90012,
      formatter: 'quote',
    }),
    severability: supplementalFeature({
      key: 'severability',
      label: 'Severability language',
      description: 'Verbatim severability boilerplate language.',
      provisionTypes: ['MISC'],
      displayGroup: 'Boilerplate',
      displayOrder: 90013,
      formatter: 'quote',
    }),
    carveouts_disproportionateImpactCarveouts_note: supplementalFeature({
      key: 'carveouts_disproportionateImpactCarveouts_note',
      label: 'MAE disproportionate-impact carveout note',
      description: 'Internal note attached to MAE disproportionate-impact carveout extraction.',
      provisionTypes: ['DEF'],
      displayGroup: 'Definitions',
      displayOrder: 90014,
    }),
    cvrMilestonePayments: supplementalFeature({
      key: 'cvrMilestonePayments',
      label: 'CVR milestone payments',
      description: 'Structured list of contingent value right milestone-payment terms.',
      valueType: 'list',
      listItemType: 'object',
      provisionTypes: ['CONSID'],
      displayGroup: 'Consideration',
      displayOrder: 90015,
    }),
    standstillWaiverPermitted_flagRef: supplementalFeature({
      key: 'standstillWaiverPermitted_flagRef',
      label: 'Standstill-waiver flag reference',
      description: 'Internal flag reference for standstill-waiver permitted extraction.',
      provisionTypes: ['NOSOL'],
      displayGroup: 'Internal',
      displayOrder: 90016,
    }),
  };
}

function stringifyObject(name, value) {
  return `const ${name} = ${JSON.stringify(value, null, 2)};\n\nmodule.exports = { ${name} };\n`;
}

function writeGeneratedFile(file, name, value) {
  fs.writeFileSync(file, `// Generated by scripts/generate-registry.js. Hand-audit before editing.\n\n${stringifyObject(name, value)}`);
}

function writeAuditFiles(features, tags) {
  if (!fs.existsSync(DELETIONS)) {
    fs.writeFileSync(DELETIONS, '# WP-SCHEMA P3 Deletions\n\nNo deletion decisions recorded yet.\n');
  }
  const featureValues = Object.values(features);
  const todoDescriptions = featureValues.filter((feature) => /^TODO:/.test(feature.description)).length;
  const benchmarkable = featureValues.filter((feature) => feature.benchmarkable).length;
  const lines = [
    '# WP-SCHEMA P3 Notes',
    '',
    '## Generated Registry Baseline',
    '',
    `- Features generated: ${featureValues.length}`,
    `- Tags generated: ${Object.keys(tags).length}`,
    `- TODO descriptions pending hand-audit: ${todoDescriptions}`,
    `- Benchmarkable hints retained: ${benchmarkable}`,
    '- Generated baseline has been copied into `lib/schema/features.js` and `lib/schema/tags.js` so Phase 4+ can import the populated registry.',
    '- The generator adds 17 supplemental live-only keys found by the Supabase coverage test, including internal metadata keys such as `flags` and `parentProvisionType`.',
    '',
    '## Live Coverage',
    '',
    '- `node --test tests/schema/coverage.test.js` passes with root `.env.local` injected.',
    '- The test queries `provisions.ai_metadata.features` and requires every live feature key to exist in `FEATURES`.',
    '- Initial live misses were incorporated as supplemental registry entries rather than excluded.',
    '',
    '## Orphan Check',
    '',
    '- `docs/schema-migration/orphan-check.txt` records live counts for 40 one-source candidate keys.',
    '- No deletion decisions have been made yet.',
    '- Several one-source keys are materially live-used, including `sourceSection`, `sourceSectionType`, `inlineDefinition`, and `sort_order`, so one-source status is not a safe deletion signal.',
    '',
    '## Next Manual Audit',
    '',
    '- Replace TODO descriptions with lawyer-facing one-sentence definitions.',
    '- Confirm `benchmarkable`, `whenEmpty`, and `stableAnchor` per feature.',
    '- Use `orphan-check.txt` before deleting or aliasing any one-source key.',
    '- Decide whether internal metadata keys should stay in `FEATURES` long-term or move to a separate internal registry in a later phase. For Phase 3, they stay represented to preserve live-data parity.',
    '',
  ];
  fs.writeFileSync(PHASE_NOTES, `${lines.join('\n')}\n`);
}

function main() {
  const rows = readJsonl(INVENTORY_JSONL).sort((a, b) => a.key.localeCompare(b.key));
  const sourceInventory = readJson(SOURCE_INVENTORY);
  const validTypes = new Set((sourceInventory.rubric.provisionTypes || []).map((entry) => entry.key));
  const getDisplayOrder = displayOrderIndex(sourceInventory);
  const featureTagFamily = tagFamilyByFeature(rows, sourceInventory);
  const features = {};

  for (const row of rows) {
    features[row.key] = buildFeature(row, sourceInventory, getDisplayOrder, featureTagFamily, validTypes);
  }
  Object.assign(features, supplementalLiveFeatures(validTypes));

  const tags = buildTags(sourceInventory, featureTagFamily);
  writeGeneratedFile(FEATURES_GENERATED, 'FEATURES', features);
  writeGeneratedFile(TAGS_GENERATED, 'TAGS', tags);
  writeAuditFiles(features, tags);

  console.log(`Generated ${Object.keys(features).length} features -> ${path.relative(ROOT, FEATURES_GENERATED)}`);
  console.log(`Generated ${Object.keys(tags).length} tags -> ${path.relative(ROOT, TAGS_GENERATED)}`);
}

main();
