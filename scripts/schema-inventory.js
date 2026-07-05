#!/usr/bin/env node

/*
 * WP-SCHEMA P1 inventory.
 *
 * Produces a feature-key inventory across the current rubric, taxonomy,
 * expected-set helpers, summary table specs, validation layer, and review UI.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs/schema-migration');

const FILES = {
  rubric: path.join(ROOT, 'lib/rubric.js'),
  taxonomy: path.join(ROOT, 'lib/taxonomy.js'),
  expectedSets: path.join(ROOT, 'lib/expected-sets.js'),
  categorySummary: path.join(ROOT, 'lib/category-summary-features.js'),
  featureValidation: path.join(ROOT, 'lib/feature-validation.js'),
};

const UI_DIRS = [
  path.join(ROOT, 'components/review'),
  path.join(ROOT, 'pages/review'),
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function posixRel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set);
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineNumber(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (starts[mid] <= index) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi + 1;
}

function findLines(file, regex) {
  const text = read(file);
  const starts = lineStarts(text);
  const out = [];
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let match;
  while ((match = re.exec(text)) !== null) {
    out.push(lineNumber(starts, match.index));
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return [...new Set(out)];
}

function findFirstLine(file, literal) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = findLines(file, new RegExp(escaped));
  return lines[0] || null;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function loadCategorySummary() {
  const source = read(FILES.categorySummary)
    .replace(/export\s*\{\s*CATEGORY_SUMMARY_FEATURES\s*\}\s*;?\s*$/m, 'module.exports = { CATEGORY_SUMMARY_FEATURES };');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: FILES.categorySummary });
  return sandbox.module.exports.CATEGORY_SUMMARY_FEATURES || {};
}

function sourceCategory(sourceName) {
  if (sourceName === 'rubric_js') return 'rubric_js';
  if (sourceName === 'taxonomy_js') return 'taxonomy_js';
  if (sourceName === 'expected_sets_js') return 'expected_sets_js';
  if (sourceName === 'category_summary_features_js') return 'category_summary_features_js';
  if (sourceName === 'feature_validation_js') return 'feature_validation_js';
  if (sourceName === 'ui') return 'ui';
  return sourceName;
}

function makeRow(key) {
  return {
    key,
    source_appearances: {},
    declared_type: null,
    declared_options: null,
    declared_unit: null,
    benchmarkable_hint: false,
    labels: [],
    type_candidates: [],
    notes: [],
  };
}

function addAppearance(rows, key, sourceName, payload) {
  if (!key || typeof key !== 'string') return;
  if (!rows.has(key)) rows.set(key, makeRow(key));
  const row = rows.get(key);
  const current = row.source_appearances[sourceName];
  if (!current) {
    row.source_appearances[sourceName] = Array.isArray(payload) ? payload : [payload];
  } else if (Array.isArray(current)) {
    current.push(payload);
  } else {
    row.source_appearances[sourceName] = [current, payload];
  }
}

function pushUnique(list, value) {
  if (value === null || value === undefined || value === '') return;
  if (!list.includes(value)) list.push(value);
}

function inferUnit(key) {
  const lower = key.toLowerCase();
  if (lower.includes('percent') || lower.endsWith('pct') || lower.includes('percentage')) return 'percent';
  if (lower.includes('month')) return 'months';
  if (lower.includes('businessday') || lower.includes('businessdays')) return 'business_days';
  if (lower.includes('calendarday') || lower.includes('calendardays')) return 'calendar_days';
  if (lower.includes('day')) return 'days';
  if (lower.includes('multiplier')) return 'multiplier';
  if (lower.includes('amount') || lower.includes('value') || lower.endsWith('usd') || lower.includes('dollar')) return 'usd';
  return null;
}

function isBenchmarkableHint(row) {
  const type = row.declared_type;
  if (type === 'number' || type === 'currency' || type === 'percentage' || type === 'enum' || type === 'boolean') return true;
  return !!inferUnit(row.key);
}

function keyCase(key) {
  if (/^[a-z][A-Za-z0-9]*$/.test(key) && /[A-Z]/.test(key)) return 'camelCase';
  if (/^[a-z][a-z0-9_]*$/.test(key) && key.includes('_')) return 'snake_case';
  if (/^[A-Z][A-Z0-9_]*$/.test(key)) return 'UPPER_SNAKE';
  if (/^[a-z][a-z0-9]*$/.test(key)) return 'lowercase';
  return 'mixed';
}

function normalizeRubricType(type) {
  if (type === 'text') return 'string';
  if (type === 'currency') return 'number';
  if (type === 'percentage') return 'number';
  if (type === 'object-list') return 'list';
  return type || null;
}

function recordFeatureDef(rows, schemaKey, feature, context) {
  if (!feature || typeof feature.key !== 'string') return;
  const key = feature.key;
  const lineCandidates = findLines(FILES.rubric, new RegExp(`key:\\s*['"\`]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`));
  const payload = {
    schemaKey,
    type: context.type || null,
    code: context.code || null,
    line: lineCandidates[0] || null,
    label: feature.label || null,
    declared_type: feature.type || null,
    options: Array.isArray(feature.options) ? feature.options : null,
    citable: feature.citable === true,
    requiredEvidence: feature.requiredEvidence === true,
  };
  addAppearance(rows, key, 'rubric_js', payload);
  const row = rows.get(key);
  pushUnique(row.labels, feature.label || null);
  pushUnique(row.type_candidates, feature.type || null);
  if (!row.declared_type && feature.type) row.declared_type = normalizeRubricType(feature.type);
  if (!row.declared_options && Array.isArray(feature.options)) row.declared_options = feature.options;
}

function inventoryRubric(rows, sourceSummary) {
  const rubric = require(FILES.rubric);
  const provisionTypes = (rubric.PROVISION_TYPES || []).map((entry) => ({
    key: entry.key,
    label: entry.label,
    mode: entry.classificationMode || entry.mode || null,
    party: entry.party || null,
    line: findFirstLine(FILES.rubric, `key: '${entry.key}'`) || findFirstLine(FILES.rubric, `key: "${entry.key}"`),
  }));
  const codes = Object.entries(rubric.CODES || {}).map(([code, entry]) => ({
    code,
    type: entry.type || null,
    label: entry.label || null,
    description: entry.description || null,
    aliases: entry.aliases || [],
    frequency: entry.frequency || null,
    industries: entry.industries || [],
    line: findFirstLine(FILES.rubric, `'${code}':`) || findFirstLine(FILES.rubric, `"${code}":`),
  }));

  for (const [schemaKey, features] of Object.entries(rubric.FEATURES || {})) {
    if (!Array.isArray(features)) continue;
    const codeEntry = rubric.CODES && rubric.CODES[schemaKey];
    const context = codeEntry ? { type: codeEntry.type, code: schemaKey } : { type: schemaKey, code: null };
    for (const feature of features) recordFeatureDef(rows, schemaKey, feature, context);
  }

  sourceSummary.rubric = {
    provisionTypes,
    codes,
    featureSchemaCount: Object.keys(rubric.FEATURES || {}).length,
  };
}

function taxonomyObjectKind(value) {
  if (!isPlainObject(value)) return null;
  const values = Object.values(value);
  if (!values.length) return 'empty';
  if (values.every((v) => typeof v === 'string')) return 'string_map';
  if (values.every((v) => isPlainObject(v) || typeof v === 'string')) return 'meta_map';
  return null;
}

function inventoryTaxonomy(rows, sourceSummary) {
  const taxonomy = require(FILES.taxonomy);
  const families = [];
  const featureToFamilies = new Map();
  for (const [name, value] of Object.entries(taxonomy)) {
    const kind = taxonomyObjectKind(value);
    if (!kind) continue;
    const codes = Object.entries(value).map(([code, labelOrMeta]) => {
      const meta = isPlainObject(labelOrMeta) ? labelOrMeta : {};
      return {
        code,
        label: typeof labelOrMeta === 'string' ? labelOrMeta : (meta.label || meta.name || null),
        description: meta.description || meta.desc || null,
        line: findFirstLine(FILES.taxonomy, `${code}:`),
      };
    });
    families.push({ family: name, kind, size: codes.length, codes });
  }

  const cleanTaxonomyText = stripComments(read(FILES.taxonomy));
  const caseBlocks = [...cleanTaxonomyText.matchAll(/case\s+['"`]([A-Za-z0-9_]+)['"`]\s*:\s*(?:\n\s*case\s+['"`]([A-Za-z0-9_]+)['"`]\s*:)*\s*return\s+([A-Z0-9_]+);/g)];
  for (const match of caseBlocks) {
    const full = match[0];
    const family = match[3];
    const keys = [...full.matchAll(/case\s+['"`]([A-Za-z0-9_]+)['"`]\s*:/g)].map((m) => m[1]);
    for (const key of keys) {
      if (!featureToFamilies.has(key)) featureToFamilies.set(key, new Set());
      featureToFamilies.get(key).add(family);
      addAppearance(rows, key, 'taxonomy_js', {
        families: [family],
        line: findFirstLine(FILES.taxonomy, `case '${key}'`) || findFirstLine(FILES.taxonomy, `case "${key}"`),
      });
    }
  }

  for (const [key, familiesSet] of featureToFamilies.entries()) {
    const row = rows.get(key);
    if (row) {
      row.source_appearances.taxonomy_js = [{
        families: [...familiesSet].sort(),
        line: findFirstLine(FILES.taxonomy, `case '${key}'`) || findFirstLine(FILES.taxonomy, `case "${key}"`),
      }];
    }
  }

  sourceSummary.taxonomy = {
    families,
    featureKeyMappings: [...featureToFamilies.entries()].map(([key, set]) => ({ key, families: [...set].sort() })),
  };
}

function inventoryExpectedSets(rows, sourceSummary) {
  const expected = require(FILES.expectedSets);
  const rubric = require(FILES.rubric);
  const curated = expected.CURATED_CORE instanceof Set ? [...expected.CURATED_CORE] : [];
  const entries = curated.map((code) => {
    const codeEntry = rubric.CODES && rubric.CODES[code];
    const line = findFirstLine(FILES.expectedSets, `'${code}'`) || findFirstLine(FILES.expectedSets, `"${code}"`);
    const features = rubric.getFeaturesForCode ? rubric.getFeaturesForCode(code) : [];
    for (const feature of features || []) {
      if (!feature || !feature.key) continue;
      addAppearance(rows, feature.key, 'expected_sets_js', {
        bundles: [code],
        type: codeEntry && codeEntry.type,
        line,
      });
    }
    return {
      code,
      type: codeEntry && codeEntry.type,
      label: codeEntry && codeEntry.label,
      line,
    };
  });
  sourceSummary.expectedSets = {
    curatedCoreCount: entries.length,
    curatedCore: entries,
    thresholds: {
      core: expected.CORE_THRESHOLD,
      common: expected.COMMON_THRESHOLD,
    },
  };
}

function inventoryCategorySummary(rows, sourceSummary) {
  const spec = loadCategorySummary();
  const types = [];
  for (const [type, items] of Object.entries(spec)) {
    if (!Array.isArray(items)) continue;
    const featureKeys = [];
    for (const item of items) {
      for (const key of item.keys || []) {
        featureKeys.push(key);
        addAppearance(rows, key, 'category_summary_features_js', {
          type,
          rowLabel: item.label || null,
          section: item.section || null,
          line: findFirstLine(FILES.categorySummary, `'${key}'`) || findFirstLine(FILES.categorySummary, `"${key}"`),
        });
        const row = rows.get(key);
        pushUnique(row.labels, item.label || null);
      }
    }
    types.push({
      type,
      rows: items.length,
      featureKeys: [...new Set(featureKeys)],
    });
  }
  sourceSummary.categorySummary = { types };
}

function inventoryFeatureValidation(rows, sourceSummary) {
  const validation = require(FILES.featureValidation);
  const rubric = require(FILES.rubric);
  const infraKeys = validation.INFRA_KEYS instanceof Set ? [...validation.INFRA_KEYS] : [];
  const schemaKeys = new Set();
  for (const features of Object.values(rubric.FEATURES || {})) {
    for (const feature of features || []) {
      if (feature && feature.key) schemaKeys.add(feature.key);
    }
  }
  const line = findFirstLine(FILES.featureValidation, 'getFeaturesForType');
  for (const key of schemaKeys) {
    addAppearance(rows, key, 'feature_validation_js', {
      validated: true,
      via: 'getFeaturesForType',
      line,
    });
  }
  for (const key of infraKeys) {
    addAppearance(rows, key, 'feature_validation_js', {
      validated: false,
      infrastructure: true,
      line: findFirstLine(FILES.featureValidation, `'${key}'`) || findFirstLine(FILES.featureValidation, `"${key}"`),
    });
    rows.get(key).notes.push('Infrastructure key ignored by feature validation.');
  }
  sourceSummary.featureValidation = {
    infraKeys,
    validatedRubricKeys: schemaKeys.size,
  };
}

function inventoryUi(rows, sourceSummary) {
  const files = UI_DIRS.flatMap(walkFiles);
  const uiRefs = new Map();
  const knownBeforeUi = new Set(rows.keys());
  const ignorePropertyNames = new Set([
    'length',
    'map',
    'filter',
    'find',
    'forEach',
    'slice',
    'sort',
    'join',
    'push',
    'includes',
    'reduce',
    'some',
    'every',
  ]);
  const addUi = (key, hit) => {
    if (ignorePropertyNames.has(key)) return;
    if (!uiRefs.has(key)) uiRefs.set(key, []);
    uiRefs.get(key).push(hit);
    addAppearance(rows, key, 'ui', hit);
  };

  for (const file of files) {
    const text = read(file);
    const starts = lineStarts(text);
    const rel = posixRel(file);
    const clean = stripComments(text);

    const patterns = [
      { re: /\bfeatures\.([A-Za-z_$][A-Za-z0-9_$]*)\b/g, kind: 'features_property' },
      { re: /\bfeatures\[['"`]([A-Za-z_$][A-Za-z0-9_$]*)['"`]\]/g, kind: 'features_bracket' },
      { re: /\bfeatureKey\s*={\s*['"`]([A-Za-z_$][A-Za-z0-9_$]*)['"`]\s*}/g, kind: 'featureKey_prop' },
      { re: /\bkey:\s*['"`]([A-Za-z_$][A-Za-z0-9_$]*)['"`]/g, kind: 'object_key_literal' },
      { re: /\bkeys:\s*\[([^\]]+)\]/g, kind: 'keys_array' },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.re.exec(clean)) !== null) {
        if (pattern.kind === 'keys_array') {
          const inner = match[1];
          for (const lit of inner.matchAll(/['"`]([A-Za-z_$][A-Za-z0-9_$]*)['"`]/g)) {
            if (knownBeforeUi.has(lit[1])) {
              addUi(lit[1], { file: rel, line: lineNumber(starts, match.index + lit.index), kind: 'keys_array' });
            }
          }
        } else if (pattern.kind === 'object_key_literal' && !knownBeforeUi.has(match[1])) {
          continue;
        } else {
          addUi(match[1], { file: rel, line: lineNumber(starts, match.index), kind: pattern.kind });
        }
      }
    }
  }

  sourceSummary.ui = {
    files: files.map(posixRel),
    referencedKeys: [...uiRefs.entries()]
      .map(([key, hits]) => ({ key, hits }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function finalizeRows(rows) {
  for (const row of rows.values()) {
    const typeSet = [...new Set(row.type_candidates.filter(Boolean).map(normalizeRubricType))];
    row.type_candidates = [...new Set(row.type_candidates.filter(Boolean))];
    if (!row.declared_type && typeSet.length === 1) row.declared_type = typeSet[0];
    row.declared_unit = inferUnit(row.key);
    row.benchmarkable_hint = isBenchmarkableHint(row);
    row.labels = [...new Set(row.labels.filter(Boolean))];
    row.notes = [...new Set(row.notes.filter(Boolean))];
  }
}

function appearanceCount(row) {
  return Object.values(row.source_appearances).reduce((sum, value) => {
    if (Array.isArray(value)) return sum + value.length;
    return sum + 1;
  }, 0);
}

function sourceCount(row) {
  return new Set(Object.keys(row.source_appearances).map(sourceCategory)).size;
}

function summarise(rows, sourceSummary) {
  const arr = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  const caseCounts = {};
  const sourceCounts = {};
  const sourcePairCounts = {};
  const mismatches = [];
  const schemaShapeMismatches = [];
  const unitMissing = [];
  const orphans = [];
  const uiOnly = [];
  const sourceOnly = [];

  for (const row of arr) {
    caseCounts[keyCase(row.key)] = (caseCounts[keyCase(row.key)] || 0) + 1;
    for (const source of Object.keys(row.source_appearances)) {
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
    const sources = Object.keys(row.source_appearances).sort();
    sourcePairCounts[sources.join(' + ')] = (sourcePairCounts[sources.join(' + ')] || 0) + 1;
    const normalizedTypes = [...new Set(row.type_candidates.map(normalizeRubricType).filter(Boolean))];
    if (normalizedTypes.length > 1) mismatches.push({
      key: row.key,
      types: row.type_candidates,
      normalizedTypes,
      appearances: row.source_appearances,
    });
    const rubricDefs = Array.isArray(row.source_appearances.rubric_js)
      ? row.source_appearances.rubric_js.filter(Boolean)
      : [];
    const rubricLabels = [...new Set(rubricDefs.map((entry) => entry.label).filter(Boolean))];
    const rubricDeclaredTypes = [...new Set(rubricDefs.map((entry) => entry.declared_type).filter(Boolean))];
    const rubricOptions = [...new Set(rubricDefs.map((entry) => JSON.stringify(entry.options || null)))];
    if (
      rubricDefs.length > 1 &&
      (rubricLabels.length > 1 || rubricDeclaredTypes.length > 1 || rubricOptions.length > 1)
    ) {
      schemaShapeMismatches.push({
        key: row.key,
        rubricDefinitions: rubricDefs.length,
        labels: rubricLabels,
        declaredTypes: rubricDeclaredTypes,
        optionShapes: rubricOptions.length,
        strictTypeConflict: normalizedTypes.length > 1,
      });
    }
    const inferred = inferUnit(row.key);
    if (inferred && !row.declared_unit) unitMissing.push(row.key);
    if (sourceCount(row) === 1) {
      orphans.push({
        key: row.key,
        source: Object.keys(row.source_appearances)[0],
        appearances: appearanceCount(row),
      });
    }
    if (sources.length === 1 && sources[0] === 'ui') uiOnly.push(row.key);
    if (!row.source_appearances.ui && sources.length === 1) sourceOnly.push({ key: row.key, source: sources[0] });
  }

  const topAppearance = arr
    .map((row) => ({ key: row.key, appearances: appearanceCount(row), sources: Object.keys(row.source_appearances).sort() }))
    .sort((a, b) => b.appearances - a.appearances || a.key.localeCompare(b.key))
    .slice(0, 20);

  const rubricOnly = arr.filter((row) => row.source_appearances.rubric_js && sourceCount(row) === 2 && row.source_appearances.feature_validation_js).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    distinctKeys: arr.length,
    keysInTwoOrMoreSources: arr.filter((row) => sourceCount(row) >= 2).length,
    keysInOnlyOneSource: orphans.length,
    crossSourceTypeMismatches: mismatches,
    schemaShapeMismatches,
    unitInferredKeys: arr.filter((row) => inferUnit(row.key)).map((row) => row.key),
    namingConventionDistribution: caseCounts,
    sourceCounts,
    sourceCombinationCounts: sourcePairCounts,
    topAppearance,
    orphans,
    uiOnly,
    sourceOnly,
    rubricOnlyWithValidation: rubricOnly,
    sourceSummary,
  };
  return { arr, summary };
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function writeSourceInventory(file, sourceSummary) {
  fs.writeFileSync(file, `${JSON.stringify(sourceSummary, null, 2)}\n`);
}

function mdTable(rows, columns) {
  const header = `| ${columns.map((c) => c.label).join(' |')} |`;
  const sep = `| ${columns.map(() => '---').join(' |')} |`;
  const body = rows.map((row) => `| ${columns.map((c) => String(c.value(row) ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|')).join(' |')} |`);
  return [header, sep, ...body].join('\n');
}

function writeSummaryMarkdown(file, summary) {
  const lines = [];
  lines.push('# WP-SCHEMA P1 Inventory Summary');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- Distinct feature-like keys: ${summary.distinctKeys}`);
  lines.push(`- Keys in 2 or more source families: ${summary.keysInTwoOrMoreSources}`);
  lines.push(`- Keys in only 1 source family: ${summary.keysInOnlyOneSource}`);
  lines.push(`- Cross-source type mismatches: ${summary.crossSourceTypeMismatches.length}`);
  lines.push(`- Schema shape mismatches: ${summary.schemaShapeMismatches.length}`);
  lines.push(`- Provision types in rubric: ${summary.sourceSummary.rubric.provisionTypes.length}`);
  lines.push(`- Canonical codes in rubric: ${summary.sourceSummary.rubric.codes.length}`);
  lines.push(`- Taxonomy families exported: ${summary.sourceSummary.taxonomy.families.length}`);
  lines.push(`- Curated expected-set codes: ${summary.sourceSummary.expectedSets.curatedCoreCount}`);
  lines.push('');
  lines.push('## Naming Distribution');
  lines.push('');
  lines.push(mdTable(Object.entries(summary.namingConventionDistribution).map(([name, count]) => ({ name, count })), [
    { label: 'Convention', value: (r) => r.name },
    { label: 'Count', value: (r) => r.count },
  ]));
  lines.push('');
  lines.push('## Source Coverage');
  lines.push('');
  lines.push(mdTable(Object.entries(summary.sourceCounts).sort().map(([name, count]) => ({ name, count })), [
    { label: 'Source', value: (r) => r.name },
    { label: 'Keys', value: (r) => r.count },
  ]));
  lines.push('');
  lines.push('## Top 20 Highest-Appearance Keys');
  lines.push('');
  lines.push(mdTable(summary.topAppearance, [
    { label: 'Key', value: (r) => r.key },
    { label: 'Appearances', value: (r) => r.appearances },
    { label: 'Sources', value: (r) => r.sources.join(', ') },
  ]));
  lines.push('');
  lines.push('## Cross-Source Type Mismatches');
  lines.push('');
  if (!summary.crossSourceTypeMismatches.length) {
    lines.push('No type mismatches found. This can be legitimate because only `lib/rubric.js` currently declares feature value types.');
  } else {
    lines.push(mdTable(summary.crossSourceTypeMismatches.slice(0, 50), [
      { label: 'Key', value: (r) => r.key },
      { label: 'Declared Types', value: (r) => r.types.join(', ') },
      { label: 'Normalised Types', value: (r) => r.normalizedTypes.join(', ') },
    ]));
  }
  lines.push('');
  lines.push('## Schema Shape Mismatches');
  lines.push('');
  lines.push('Same feature key with multiple rubric labels, declared types, or enum option shapes. These are Phase 3 canonicalisation work items.');
  lines.push('');
  lines.push(mdTable(summary.schemaShapeMismatches.slice(0, 60), [
    { label: 'Key', value: (r) => r.key },
    { label: 'Rubric defs', value: (r) => r.rubricDefinitions },
    { label: 'Declared types', value: (r) => r.declaredTypes.join(', ') },
    { label: 'Labels', value: (r) => r.labels.slice(0, 3).join('; ') },
  ]));
  lines.push('');
  lines.push('## Orphan Candidates');
  lines.push('');
  lines.push('Keys in only one source family. These are candidates for dead-code review, not automatic deletion.');
  lines.push('');
  lines.push(mdTable(summary.orphans.slice(0, 80), [
    { label: 'Key', value: (r) => r.key },
    { label: 'Source', value: (r) => r.source },
    { label: 'Appearances', value: (r) => r.appearances },
  ]));
  lines.push('');
  lines.push('## UI-Only Keys');
  lines.push('');
  if (!summary.uiOnly.length) lines.push('None.');
  else lines.push(summary.uiOnly.slice(0, 100).map((k) => `- ${k}`).join('\n'));
  lines.push('');
  fs.writeFileSync(file, `${lines.join('\n').trimEnd()}\n`);
}

function writeFindingsMarkdown(file, summary) {
  const lines = [];
  lines.push('# WP-SCHEMA P1 Findings');
  lines.push('');
  lines.push('## Executive Finding');
  lines.push('');
  lines.push(`The current codebase has ${summary.distinctKeys} feature-like keys across rubric schemas, taxonomy feature mappings, expected-set helpers, summary table specs, validation infrastructure, and review UI references.`);
  lines.push(`Of those, ${summary.keysInTwoOrMoreSources} appear in at least two source families, while ${summary.keysInOnlyOneSource} appear in only one source family and need drift review before deletion.`);
  lines.push('');
  lines.push('## Drift Signals');
  lines.push('');
  lines.push(`- Strict cross-source type mismatches found: ${summary.crossSourceTypeMismatches.length}.`);
  lines.push(`- Broader schema shape mismatches found: ${summary.schemaShapeMismatches.length}.`);
  lines.push('- Only the rubric currently declares value type in a systematic way; a zero mismatch count here is not proof of no drift.');
  lines.push(`- UI-only feature-like keys found: ${summary.uiOnly.length}. These are the highest-risk missing-schema candidates.`);
  lines.push(`- Curated expected-set codes found: ${summary.sourceSummary.expectedSets.curatedCoreCount}. These are code bundles, not direct feature definitions.`);
  lines.push('');
  lines.push('## Naming Convention Distribution');
  lines.push('');
  lines.push(mdTable(Object.entries(summary.namingConventionDistribution).map(([name, count]) => ({ name, count })), [
    { label: 'Convention', value: (r) => r.name },
    { label: 'Count', value: (r) => r.count },
  ]));
  lines.push('');
  lines.push('Recommendation for Phase 3: use camelCase for canonical `FeatureDef.key`, because existing provision `features` JSON already mostly uses camelCase and that minimises storage-key churn.');
  lines.push('');
  lines.push('## Top 20 Highest-Appearance Keys');
  lines.push('');
  lines.push(mdTable(summary.topAppearance, [
    { label: 'Key', value: (r) => r.key },
    { label: 'Appearances', value: (r) => r.appearances },
    { label: 'Sources', value: (r) => r.sources.join(', ') },
  ]));
  lines.push('');
  lines.push('## Missing-Feature Patterns To Audit In Phase 3');
  lines.push('');
  const uiOnly = summary.uiOnly.slice(0, 40);
  if (!uiOnly.length) {
    lines.push('- No UI-only keys were detected by the script.');
  } else {
    lines.push('- UI-only feature-like keys should be checked against live `features` JSONB before Phase 3 registry population:');
    for (const key of uiOnly) lines.push(`  - ${key}`);
  }
  lines.push('- Raw enum display and ambiguous empty states should be mapped to schema formatter and `whenEmpty` fields in later phases.');
  lines.push('- Any key in one source family only should be treated as an orphan candidate, not deleted without Supabase usage checks.');
  lines.push('');
  lines.push('## Phase 3 Inputs');
  lines.push('');
  lines.push('- Use `docs/schema-migration/inventory.jsonl` as the machine-readable input for registry generation.');
  lines.push('- Use `docs/schema-migration/source-inventory.json` for provision types, canonical codes, taxonomy families, and expected-set code bundles.');
  lines.push('- Treat `category_summary_features_js` labels as good UI label hints, but not as authoritative schema shape.');
  lines.push('- Treat `feature_validation_js` as generic coverage through `getFeaturesForType`, not as a separate feature-type authority.');
  lines.push('');
  fs.writeFileSync(file, `${lines.join('\n').trimEnd()}\n`);
}

function writeLogMarkdown(file, summary) {
  const lines = [];
  lines.push('# WP-SCHEMA P1 Phase Log');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('Discovery commands embedded in `scripts/schema-inventory.js`:');
  lines.push('');
  lines.push('- Required `lib/rubric.js`, `lib/taxonomy.js`, `lib/expected-sets.js`, and `lib/feature-validation.js`.');
  lines.push('- Text-evaluated `lib/category-summary-features.js` because it uses an ESM export in a CommonJS package.');
  lines.push('- Scanned `components/review/**` and `pages/review/**` for feature property and literal references.');
  lines.push('');
  lines.push('Outputs:');
  lines.push('');
  lines.push('- `docs/schema-migration/inventory.jsonl`');
  lines.push('- `docs/schema-migration/source-inventory.json`');
  lines.push('- `docs/schema-migration/inventory-summary.md`');
  lines.push('- `docs/schema-migration/phase-1-findings.md`');
  lines.push('');
  fs.writeFileSync(file, `${lines.join('\n').trimEnd()}\n`);
}

function main() {
  ensureDir(OUT_DIR);
  const rows = new Map();
  const sourceSummary = {};
  inventoryRubric(rows, sourceSummary);
  inventoryTaxonomy(rows, sourceSummary);
  inventoryExpectedSets(rows, sourceSummary);
  inventoryCategorySummary(rows, sourceSummary);
  inventoryFeatureValidation(rows, sourceSummary);
  inventoryUi(rows, sourceSummary);
  finalizeRows(rows);
  const { arr, summary } = summarise(rows, sourceSummary);

  writeJsonl(path.join(OUT_DIR, 'inventory.jsonl'), arr);
  writeSourceInventory(path.join(OUT_DIR, 'source-inventory.json'), sourceSummary);
  writeSummaryMarkdown(path.join(OUT_DIR, 'inventory-summary.md'), summary);
  writeFindingsMarkdown(path.join(OUT_DIR, 'phase-1-findings.md'), summary);
  writeLogMarkdown(path.join(OUT_DIR, 'phase-1-log.md'), summary);

  console.log(JSON.stringify({
    distinctKeys: summary.distinctKeys,
    keysInTwoOrMoreSources: summary.keysInTwoOrMoreSources,
    keysInOnlyOneSource: summary.keysInOnlyOneSource,
    crossSourceTypeMismatches: summary.crossSourceTypeMismatches.length,
    schemaShapeMismatches: summary.schemaShapeMismatches.length,
    uiOnly: summary.uiOnly.length,
  }, null, 2));
}

main();
