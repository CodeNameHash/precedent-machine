import featuresModule from '../schema/features.js';
import {
  assertValidMarketMetricSpec,
  comparableMetric,
  MARKET_METRIC_CONTRACT_VERSION,
  nonComparableMetric,
  validateMarketMetricSpec,
} from './contract.js';
import {
  ALL_DEALS_COHORT,
  DEAL_VALUE_NORMALISATION,
  manifestMetricsForRow,
  marketDenominator,
  provisionCodesCohort,
  provisionFamilyCohort,
  semanticMetricSet,
} from './registry.js';

const { FEATURES } = featuresModule;

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/ig;
const MONEY_FEATURE_KEYS = new Set([
  'cap',
  'companyTerminationFee',
  'divestitureCap',
  'dollarThreshold',
  'expenseReimbursement',
  'expenseReimbursementCap',
  'feeAmount',
  'interimSettlementCap',
  'reverseFeeAmount',
  'reverseTerminationFee',
]);

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(UUID_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function textFromNode(value) {
  if (value === null || value === undefined || value === false) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textFromNode).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    if (value.props && 'children' in value.props) return textFromNode(value.props.children);
    if (typeof value.label === 'string') return value.label;
    if (typeof value.text === 'string') return value.text;
  }
  return '';
}

export function marketRowLabel(row) {
  return textFromNode(row?.label || row?.term || row?.instrument || row?.defined_term || row?.definedTerm).trim()
    || String(row?.id || 'Market term');
}

function featureKeysForRow(row) {
  const out = [];
  if (Array.isArray(row?.featureKeys)) out.push(...row.featureKeys);
  if (row?.featureKey) out.push(row.featureKey);
  if (Array.isArray(row?.spec?.featureKeys)) out.push(...row.spec.featureKeys);
  if (Array.isArray(row?.spec?.keys)) out.push(...row.spec.keys);
  return [...new Set(out.filter((key) => typeof key === 'string' && key.trim()))];
}

function looksLikeCard(value) {
  return value && typeof value === 'object' && (
    value.provision_subtype || value.canonical_code || value.provision_code || value.provision_type || value.ai_metadata
  );
}

export function sourceCardsForMarketRow(row) {
  const candidates = [
    row?.card,
    row?.sourceCard,
    ...(Array.isArray(row?.sourceCards) ? row.sourceCards : []),
    ...(Array.isArray(row?.cards) ? row.cards : []),
    ...(looksLikeCard(row?.source) ? [row.source] : []),
  ];
  const seen = new Set();
  return candidates.filter((card) => {
    if (!looksLikeCard(card)) return false;
    const key = String(card.id || card.provision_instance_id || `${card.provision_subtype || ''}:${card.section_ref || ''}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}

function familyForCode(code) {
  const upper = String(code || '').toUpperCase();
  if (!upper) return null;
  if (upper.startsWith('REP-T')) return 'REP-T';
  if (upper.startsWith('REP-B')) return 'REP-B';
  if (upper.startsWith('COND-')) return upper.split('-').slice(0, 2).join('-');
  return upper.split('-')[0];
}

function semanticKeyForDynamicRow(row, label, context) {
  const id = String(row?.id || '');
  const configId = slug(context?.configId || context?.sectionId || '');
  const namespace = configId ? `${configId}:` : '';
  const iocNamespace = namespace || 'ioc:';
  if (row?.defined_term || row?.definedTerm) return `definitions:${slug(row.defined_term || row.definedTerm)}`;
  if (id.startsWith('material-contracts-') && row?.code) {
    const text = `${row?.threshold || ''} ${row?.evidence || ''}`;
    let cadence = 'aggregate';
    if (/\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(text)) cadence = 'annual';
    else if (/\bin\s+(?:19|20)\d{2}\b/i.test(text)) cadence = 'specified-year';
    else if (/\b(?:per\s+month|monthly)\b/i.test(text)) cadence = 'per-month';
    else if (/\b(?:per\s+day|daily)\b/i.test(text)) cadence = 'per-day';
    else if (/\b(?:per|each)\s+(?:event|occurrence)\b/i.test(text)) cadence = 'per-event';
    const threshold = slug(row.threshold || 'any');
    return `material-contracts:${slug(row.code)}:${cadence}:${threshold || 'any'}`;
  }
  if (id.startsWith('ioc-aff-')) return `${iocNamespace}affirmative:${slug(label) || 'positive-obligations'}`;
  if (id.startsWith('ioc-neg-') && row?.code) return `${iocNamespace}negative:${slug(row.code)}`;
  if (id.startsWith('ioc-frag-')) return `${iocNamespace}fragment:${slug(label) || 'unclassified'}`;
  if (id.startsWith('equity-awards-') && (row?.instrumentCode || row?.instrument)) {
    return `equity-awards:${slug(row.instrumentCode || row.instrument)}`;
  }
  return null;
}

export function stableMarketRowKey(row, context = {}) {
  const assigned = context?.assignedRowKey;
  if (typeof assigned === 'string' && assigned.trim()) return assigned.trim();
  const declared = row?.marketRowKey || row?.marketKey;
  if (typeof declared === 'string' && declared.trim()) return slug(declared);
  const label = marketRowLabel(row);
  const dynamic = semanticKeyForDynamicRow(row, label, context);
  if (dynamic) return dynamic;

  const id = String(row?.id || '').trim();
  if (id && !UUID_RE.test(id)) {
    UUID_RE.lastIndex = 0;
    const idKey = slug(id);
    const configKey = slug(context.configId || context.sectionId || '');
    return configKey && !idKey.startsWith(configKey) ? `${configKey}:${idKey}` : idKey;
  }
  UUID_RE.lastIndex = 0;

  const configId = slug(context.configId || context.sectionId || 'market-row');
  const featureKeys = featureKeysForRow(row);
  if (featureKeys.length) return `${configId}:${featureKeys.map(slug).join('+')}`;
  const semanticCode = row?.itemCode || row?.instrumentCode || row?.code;
  if (semanticCode) return `${configId}:${slug(semanticCode)}`;
  if (label) return `${configId}:${slug(label)}`;
  return `${configId}:unidentified`;
}

export function createMarketRowKeyAssigner(context = {}) {
  const occurrences = new Map();
  return (row) => {
    const base = stableMarketRowKey(row, context);
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    return occurrence === 0 ? base : `${base}~${occurrence}`;
  };
}

export function assignMarketRowKeys(rows, context = {}) {
  const assign = createMarketRowKeyAssigner(context);
  return (Array.isArray(rows) ? rows : []).map((row) => assign(row));
}

function normaliseDeclaredSpec(spec, rowKey, label) {
  const candidate = {
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey,
    label,
    ...spec,
    rowKey: spec?.rowKey || rowKey,
    label: spec?.label || label,
  };
  return assertValidMarketMetricSpec(candidate);
}

function declaredMetrics(row, rowKey, label) {
  const raw = row?.marketMetrics || row?.marketMetric || row?.marketSpec;
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((spec) => normaliseDeclaredSpec(spec, rowKey, label));
}

function featureCohort(featureDefs, context, cards) {
  const contextCodes = Array.isArray(context.provisionCodes) ? context.provisionCodes : [];
  const definitionCodes = featureDefs.flatMap((definition) => definition?.provisionCodes || []);
  const cardCodes = cards.map(cardCode).filter(Boolean);
  const provisionCodes = [...new Set([...contextCodes, ...definitionCodes, ...cardCodes])];
  if (provisionCodes.length) return provisionCodesCohort(provisionCodes);
  const family = context.provisionFamily || cardCodes.map(familyForCode).find(Boolean);
  return family ? provisionFamilyCohort(family) : ALL_DEALS_COHORT;
}

function exactProvisionCodes(row, context = {}, featureDefs = []) {
  if (Array.isArray(row?.marketProvisionCodes)) {
    return [...new Set(row.marketProvisionCodes.filter(Boolean))];
  }
  const cardCodes = sourceCardsForMarketRow(row).map(cardCode).filter(Boolean);
  if (cardCodes.length) return [...new Set(cardCodes)];
  const contextCodes = Array.isArray(context.provisionCodes) ? context.provisionCodes : [];
  if (contextCodes.length) return [...new Set(contextCodes.filter(Boolean))];
  return [...new Set(featureDefs.flatMap((definition) => definition?.provisionCodes || []).filter(Boolean))];
}

function observationScopeFor(row, provisionCodes, extra = null) {
  const scope = {
    ...(provisionCodes.length ? { provisionCodes } : {}),
    ...(row?.marketObservationScope || {}),
    ...(extra || {}),
  };
  return Object.keys(scope).length ? scope : null;
}

function metricBaseForFeature(context, featureKey, rowKey) {
  const prefix = slug(context.configId || context.sectionId || 'feature').replace(/-/g, '.');
  const rowIdentity = slug(rowKey).replace(/-/g, '.');
  return `${prefix}.${rowIdentity}.${slug(featureKey).replace(/-/g, '.')}`;
}

function valueKindForFeature(featureKey, definition) {
  if (MONEY_FEATURE_KEYS.has(featureKey) || definition?.unit === 'usd') return 'money';
  if (definition?.valueType === 'enum' || definition?.valueType === 'boolean') return 'categorical';
  if (definition?.valueType === 'list') return 'multi_select';
  if (definition?.valueType === 'number') {
    if (['days', 'business_days', 'calendar_days', 'months', 'years'].includes(definition?.unit)) return 'duration';
    return 'numeric';
  }
  if (definition?.valueType === 'object') return 'categorical';
  if (definition?.valueType === 'string' || definition?.valueType === 'date') return 'categorical';
  return 'presence';
}

function semanticsForFeature(kind, definition, featureKey) {
  if (kind === 'money') {
    return { unit: 'usd', cadence: 'unknown', normalisation: DEAL_VALUE_NORMALISATION };
  }
  if (kind === 'numeric' && definition?.unit) return { unit: definition.unit };
  if (kind === 'duration') {
    if (definition?.unit === 'months' || definition?.unit === 'years') {
      return {
        unit: definition.unit,
        calendarBasis: 'elapsed',
        trigger: `feature_${slug(featureKey)}`,
      };
    }
    return {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      trigger: `feature_${slug(featureKey)}`,
      requiredDimensions: ['unit', 'calendarBasis'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    };
  }
  return undefined;
}

function marketFeatureLabel(featureKey, definition) {
  const overrides = {
    bringDownTiers: 'Bring-down standard',
    knowledgeQualifier: 'Knowledge qualifier',
    lookbackDateISO: 'Lookback period',
    materialityQualifier: 'Materiality qualifier',
  };
  if (overrides[featureKey]) return overrides[featureKey];
  const raw = String(definition?.label || featureKey)
    .replace(/\s+[—–-]\s+.*$/, '')
    .replace(/\s+object\s*\{.*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return raw || featureKey;
}

function semanticRowMetrics(row, context, rowKey, label) {
  if (!Array.isArray(row?.marketSubterms) || !row.marketSubterms.length) return null;
  const allFeatureKeys = [...new Set(row.marketSubterms.flatMap((subterm) => subterm.featureKeys || []))];
  const featureDefs = allFeatureKeys.map((key) => FEATURES[key]).filter(Boolean);
  const provisionCodes = exactProvisionCodes(row, context, featureDefs);
  const baseScope = observationScopeFor(row, provisionCodes);
  const fallbackCohort = row?.marketProvisionFamily
    ? provisionFamilyCohort(row.marketProvisionFamily)
    : featureCohort(featureDefs, context, sourceCardsForMarketRow(row));
  const valueCohort = provisionCodes.length
    ? provisionCodesCohort(provisionCodes, { eligibility: 'code_present' })
    : fallbackCohort;
  const prevalencePresence = row.marketPresence || (provisionCodes.length
    ? {
      strategy: 'card_exists',
      provisionCodes,
      missingState: 'absent',
      ...(row?.marketObservationScope?.definedTermIncludes
        ? { definedTermIncludes: row.marketObservationScope.definedTermIncludes }
        : {}),
    }
    : { strategy: 'feature_non_empty', featureKeys: allFeatureKeys, missingState: 'unknown' });
  const contextBase = slug(context.configId || context.sectionId || 'semantic').replace(/-/g, '.');
  const rowBase = slug(rowKey).replace(/-/g, '.');
  const metricBase = rowBase === contextBase || rowBase.startsWith(`${contextBase}.`)
    ? rowBase
    : `${contextBase}.${rowBase}`;
  const subterms = row.marketSubterms.map((subterm, index) => {
    const subtermCodes = [...new Set((subterm.provisionCodes || provisionCodes).filter(Boolean))];
    const subtermScope = observationScopeFor(row, subtermCodes, subterm.observationScope);
    return {
      ...subterm,
      key: subterm.key || `subterm-${index + 1}`,
      metric: slug(subterm.metric || subterm.key || `subterm-${index + 1}`).replace(/-/g, '.'),
      cohort: subterm.cohort || (subtermCodes.length
        ? provisionCodesCohort(subtermCodes, { eligibility: 'code_present' })
        : valueCohort),
      observationScope: subtermScope || undefined,
    };
  });
  return semanticMetricSet({
    rowKey,
    metricBase,
    label,
    cohort: valueCohort,
    prevalenceCohort: row.marketPrevalenceCohort || (provisionCodes.length ? ALL_DEALS_COHORT : fallbackCohort),
    presence: prevalencePresence,
    observationScope: baseScope || undefined,
    subterms,
  });
}

function registryMetrics(row, context, rowKey, label) {
  const featureKeys = featureKeysForRow(row);
  if (!featureKeys.length) return null;
  const featureDefs = featureKeys.map((key) => FEATURES[key]).filter(Boolean);
  const primaryKey = featureKeys.find((key) => FEATURES[key]) || featureKeys[0];
  const provisionCodes = exactProvisionCodes(row, context, featureDefs);
  const fallbackCohort = row?.marketProvisionFamily
    ? provisionFamilyCohort(row.marketProvisionFamily)
    : featureCohort(featureDefs, context, sourceCardsForMarketRow(row));
  const cohort = provisionCodes.length
    ? provisionCodesCohort(provisionCodes, { eligibility: 'code_present' })
    : fallbackCohort;
  const observationScope = observationScopeFor(row, provisionCodes);
  const metricBase = metricBaseForFeature(context, primaryKey, rowKey).replace(`.${slug(primaryKey).replace(/-/g, '.')}`, '');
  const presence = provisionCodes.length
    ? { strategy: 'card_exists', provisionCodes, missingState: 'absent' }
    : { strategy: 'feature_non_empty', featureKeys, missingState: 'unknown' };
  const subterms = featureKeys.map((featureKey) => {
    const definition = FEATURES[featureKey] || null;
    const kind = valueKindForFeature(featureKey, definition);
    const semantics = semanticsForFeature(kind, definition, featureKey);
    return {
      key: slug(featureKey).replace(/-/g, '.'),
      label: marketFeatureLabel(featureKey, definition),
      featureKeys: [featureKey],
      kind,
      semantics,
      ...(kind === 'duration' ? {
        value: {
          strategy: 'feature_value',
          featureKeys: [featureKey],
          normalizer: 'deadline_duration',
          trigger: semantics.trigger,
        },
      } : {}),
    };
  });
  return semanticMetricSet({
    rowKey,
    metricBase,
    label,
    cohort,
    prevalenceCohort: provisionCodes.length ? ALL_DEALS_COHORT : fallbackCohort,
    presence,
    observationScope: observationScope || undefined,
    subterms,
  });
}

function codePresenceMetrics(row, context, rowKey, label) {
  const cards = sourceCardsForMarketRow(row);
  const provisionCodes = [...new Set([
    ...(Array.isArray(context.provisionCodes) ? context.provisionCodes : []),
    ...cards.map(cardCode),
    ...(typeof row?.code === 'string' && /^[A-Z]+(?:-[A-Z0-9]+)+$/.test(row.code) ? [row.code] : []),
  ].filter(Boolean))];
  if (!provisionCodes.length) return null;
  const metricBase = `${slug(context.configId || context.sectionId || familyForCode(provisionCodes[0]) || 'provision').replace(/-/g, '.')}.${slug(rowKey).replace(/-/g, '.')}`;
  return [comparableMetric({
    rowKey,
    metricKey: `${metricBase}.presence`,
    label: `${label} prevalence`,
    kind: 'presence',
    cohort: ALL_DEALS_COHORT,
    observation: {
      presence: { strategy: 'card_exists', provisionCodes, missingState: 'absent' },
    },
    denominator: marketDenominator(),
    presentation: { role: 'prevalence' },
  })];
}

function nonComparableFallback(rowKey, label) {
  return [nonComparableMetric({
    rowKey,
    metricKey: `${rowKey.replace(/:/g, '.')}.value`,
    label,
    code: 'missing_metric_definition',
    detail: 'This row has no feature key, canonical item code or source provision code from which to calculate market prevalence.',
  })];
}

export function resolveMarketMetricRow(row, context = {}) {
  const rowKey = stableMarketRowKey(row, context);
  const label = marketRowLabel(row);
  if (row?.marketState === 'OPEN_NATIVE_FIELD') {
    return {
      row,
      rowKey,
      label,
      resolution: 'evidence_only',
      metrics: nonComparableFallback(rowKey, label),
      errors: [],
    };
  }
  const errors = [];
  let resolution = 'non_comparable';
  let metrics;
  try {
    metrics = declaredMetrics(row, rowKey, label);
    if (metrics) resolution = 'declared';
  } catch (error) {
    errors.push({ path: 'marketMetrics', message: error.message });
  }
  if (!metrics) {
    try {
      metrics = semanticRowMetrics(row, context, rowKey, label);
      if (metrics) resolution = 'semantic_row';
    } catch (error) {
      errors.push({ path: 'marketSubterms', message: error.message });
    }
  }
  if (!metrics) {
    try {
      metrics = manifestMetricsForRow(row, { rowKey, label });
      if (metrics) resolution = 'manifest';
    } catch (error) {
      errors.push({ path: 'marketManifest', message: error.message });
    }
  }
  if (!metrics) {
    try {
      metrics = registryMetrics(row, context, rowKey, label);
      if (metrics) resolution = 'feature_registry';
    } catch (error) {
      errors.push({ path: 'featureRegistry', message: error.message });
    }
  }
  if (!metrics) {
    metrics = codePresenceMetrics(row, context, rowKey, label);
    if (metrics) resolution = 'card_presence';
  }
  if (!metrics) metrics = nonComparableFallback(rowKey, label);

  for (const metric of metrics) {
    const validation = validateMarketMetricSpec(metric);
    if (!validation.valid) errors.push(...validation.errors.map((entry) => ({ ...entry, metricKey: metric.metricKey })));
  }
  return { row, rowKey, label, resolution, metrics, errors };
}

export function resolveMarketMetricSpecs(row, context = {}) {
  return resolveMarketMetricRow(row, context).metrics;
}
