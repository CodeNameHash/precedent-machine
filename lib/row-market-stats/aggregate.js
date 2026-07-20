const { DEAL_VALUE_BASES, classifyDealValueBasisDetailed } = require('../deal-value-basis');
const { finiteNumber, normaliseUnit } = require('./observations');

function ratio(count, denominator) {
  return denominator > 0 ? count / denominator : null;
}

function quantile(sorted, percentile) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower));
}

function numericSummary(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    n: sorted.length,
    min: sorted[0],
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function stableValueKey(value) {
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const ordered = Object.keys(value).sort().reduce((result, key) => {
      result[key] = value[key];
      return result;
    }, {});
    return JSON.stringify(ordered);
  }
  return `${typeof value}:${String(value)}`;
}

function distinctValues(values) {
  const byKey = new Map();
  for (const value of values) {
    const key = stableValueKey(value.value);
    const existing = byKey.get(key);
    if (!existing || (!existing.cardId && value.cardId)) byKey.set(key, value);
  }
  return [...byKey.values()];
}

function dealRef(dealId, cardId = null) {
  return { dealId, ...(cardId ? { cardId: String(cardId) } : {}) };
}

function hasCardAttribution(dealRefs) {
  return Array.isArray(dealRefs) && dealRefs.some((ref) => ref?.cardId);
}

function semanticMismatch(value, semantics) {
  const required = new Set(semantics.requiredDimensions || []);
  const stratified = new Set(semantics.stratifyDimensions || []);
  if (semantics.unit) required.add('unit');
  const checks = [
    ['unit', normaliseUnit(value.unit), normaliseUnit(semantics.unit)],
    ['calendar_basis', value.calendarBasis || null, semantics.calendarBasis || null],
    ['trigger', value.trigger || null, semantics.trigger || null],
    ['cadence', value.cadence || null, semantics.cadence || null],
  ];
  for (const [dimension, actual, expected] of checks) {
    const contractDimension = dimension === 'calendar_basis' ? 'calendarBasis' : dimension;
    if (!actual && required.has(contractDimension)) return `missing_${dimension}`;
    if (actual && expected && actual !== expected && !stratified.has(contractDimension)) return dimension;
  }
  return null;
}

function semanticCohort(value, semantics) {
  return {
    unit: normaliseUnit(value.unit || semantics.unit),
    calendarBasis: value.calendarBasis || semantics.calendarBasis || null,
    trigger: value.trigger || semantics.trigger || null,
    cadence: value.cadence || semantics.cadence || null,
  };
}

function semanticCohortKey(cohort) {
  return [cohort.unit, cohort.calendarBasis, cohort.trigger, cohort.cadence]
    .map((value) => value || '')
    .join('|');
}

function basisForMoney(entry) {
  const valueUsd = finiteNumber(entry.deal && entry.deal.value_usd);
  if (valueUsd === null) return { admitted: false, reason: 'missing_deal_value' };
  if (valueUsd <= 0) return { admitted: false, reason: 'non_positive_deal_value' };
  const classification = classifyDealValueBasisDetailed(entry.deal);
  if (!classification || classification.basis === DEAL_VALUE_BASES.UNKNOWN) {
    return {
      admitted: false,
      reason: 'unknown_deal_value_basis',
      basisReason: classification ? classification.reason : null,
    };
  }
  return {
    admitted: true,
    basis: classification.basis,
    basisSource: classification.source,
    dealValueUsd: valueUsd,
  };
}

function analyseScalar(entry, spec) {
  if (!entry.values.length) return { state: 'value_unknown' };
  const values = distinctValues(entry.values);
  if (values.length !== 1) return { state: 'excluded', reason: 'multiple_values_for_scalar' };
  return {
    state: 'comparable',
    value: values[0].value,
    cardId: values[0].cardId || entry.cardId || null,
  };
}

function analyseMultiSelect(entry) {
  if (!entry.values.length) return { state: 'value_unknown' };
  const values = distinctValues(entry.values);
  return values.length ? {
    state: 'comparable',
    values: values.map((item) => item.value),
    valueRefs: values.map((item) => ({ value: item.value, cardId: item.cardId || entry.cardId || null })),
  } : { state: 'value_unknown' };
}

function analyseNumeric(entry, spec) {
  if (!entry.values.length) return { state: 'value_unknown' };
  const semantics = spec.semantics || {};
  const normaliseDurationToDays = spec.comparison.kind === 'duration'
    && semantics.normalisation?.type === 'duration_to_days';
  const compatible = [];
  const mismatches = new Set();
  for (const item of entry.values) {
    let number = finiteNumber(item.value);
    if (number === null) continue;
    let candidate = item;
    if (normaliseDurationToDays) {
      const unit = normaliseUnit(item.unit);
      if (unit === 'elapsed_hours') number /= Number(semantics.normalisation.hoursPerDay) || 24;
      else if (!['business_days', 'calendar_days', 'days_equivalent'].includes(unit)) {
        mismatches.add('unit');
        continue;
      }
      candidate = { ...item, unit: 'days_equivalent', calendarBasis: 'mixed' };
    }
    const mismatch = semanticMismatch(candidate, semantics);
    if (mismatch) {
      mismatches.add(mismatch);
      continue;
    }
    compatible.push({
      value: number,
      cohort: semanticCohort(candidate, semantics),
      cardId: candidate.cardId || entry.cardId || null,
    });
  }
  if (!compatible.length) {
    return {
      state: 'excluded',
      reason: mismatches.size ? `incompatible_${[...mismatches].sort().join('_')}` : 'non_numeric_value',
    };
  }
  const distinct = new Map();
  for (const item of compatible) {
    const key = `${semanticCohortKey(item.cohort)}|${item.value}`;
    const existing = distinct.get(key);
    if (!existing || (!existing.cardId && item.cardId)) distinct.set(key, item);
  }
  if (distinct.size !== 1) return { state: 'excluded', reason: 'multiple_values_for_scalar' };
  const [value] = distinct.values();
  return { state: 'comparable', value: value.value, cohort: value.cohort, cardId: value.cardId || null };
}

function analyseMoney(entry, spec) {
  if (!entry.values.length) return { state: 'value_unknown' };
  const semantics = spec.semantics || {};
  const mismatches = new Set();
  const bySemanticCohort = new Map();
  for (const item of entry.values) {
    const value = finiteNumber(item.value);
    if (value === null) continue;
    const mismatch = semanticMismatch(item, semantics);
    if (mismatch) {
      mismatches.add(mismatch);
      continue;
    }
    const cohort = semanticCohort(item, semantics);
    if (normaliseUnit(cohort.unit) !== 'usd') {
      mismatches.add('unit');
      continue;
    }
    const key = semanticCohortKey(cohort);
    const existing = bySemanticCohort.get(key);
    if (existing && existing.value !== value) {
      return {
        state: 'excluded',
        reason: 'multiple_values_for_scalar',
        rawValues: [...bySemanticCohort.values(), { value, cohort }].map((candidate) => candidate.value),
      };
    }
    bySemanticCohort.set(key, {
      value,
      cohort,
      cardId: item.cardId || existing?.cardId || entry.cardId || null,
    });
  }
  const numericValues = [...bySemanticCohort.values()];
  if (!numericValues.length) {
    return {
      state: 'excluded',
      reason: mismatches.size ? `incompatible_${[...mismatches].sort().join('_')}` : 'non_numeric_value',
    };
  }
  const basis = basisForMoney(entry);
  if (!basis.admitted) {
    return {
      state: 'excluded',
      reason: basis.reason,
      basisReason: basis.basisReason || null,
      rawValue: numericValues[0].value,
      rawValues: numericValues.map((candidate) => candidate.value),
      rawUnit: 'usd',
    };
  }
  const moneyValues = numericValues.map((candidate) => {
    const proportion = candidate.value / basis.dealValueUsd;
    return {
      rawValue: candidate.value,
      rawUnit: 'usd',
      basis: basis.basis,
      basisSource: basis.basisSource,
      dealValueUsd: basis.dealValueUsd,
      percentOfDealValue: proportion * 100,
      basisPointsOfDealValue: proportion * 10000,
      cohort: candidate.cohort,
      cardId: candidate.cardId || entry.cardId || null,
    };
  });
  return {
    state: 'comparable',
    moneyValues,
    ...(moneyValues.length === 1 ? moneyValues[0] : {}),
  };
}

function analysePresentEntry(entry, spec) {
  const kind = spec.comparison.kind;
  if (kind === 'presence') return { state: 'comparable', cardId: entry.cardId || null };
  if (kind === 'categorical') return analyseScalar(entry, spec);
  if (kind === 'multi_select') return analyseMultiSelect(entry);
  if (kind === 'money') return analyseMoney(entry, spec);
  return analyseNumeric(entry, spec);
}

function stateForCoverage(coverage) {
  if (coverage.eligibleCount === 0) return 'unknown';
  if (coverage.presentCount === 0) {
    return coverage.absentCount > 0 && coverage.unknownCount === 0 ? 'no_occurrences' : 'unknown';
  }
  if (coverage.comparableCount === 0) return 'insufficient_data';
  if (coverage.comparableCount === 1) return 'unique';
  return 'ready';
}

function buildCoverage(entries, analyses, kind) {
  const statusCounts = { present: 0, absent: 0, unknown: 0, not_applicable: 0 };
  for (const entry of entries) statusCounts[entry.status] += 1;
  let observedCount = 0;
  let valueUnknownCount = 0;
  let comparableCount = 0;
  let excludedCount = 0;
  if (kind === 'presence') {
    observedCount = statusCounts.present;
    comparableCount = statusCounts.present;
  } else {
    for (const analysis of analyses.values()) {
      if (analysis.state === 'value_unknown') valueUnknownCount += 1;
      else {
        observedCount += 1;
        if (analysis.state === 'comparable') comparableCount += 1;
        else excludedCount += 1;
      }
    }
  }
  const eligibleCount = statusCounts.present + statusCounts.absent + statusCounts.unknown;
  return {
    cohortCount: entries.length,
    eligibleCount,
    presentCount: statusCounts.present,
    absentCount: statusCounts.absent,
    unknownCount: statusCounts.unknown,
    notApplicableCount: statusCounts.not_applicable,
    classifiedCount: statusCounts.present + statusCounts.absent,
    observedCount,
    valueUnknownCount,
    comparableCount,
    excludedCount,
  };
}

function categoricalDistribution(spec, analyses, coverage) {
  const counts = new Map();
  for (const [dealId, analysis] of analyses.entries()) {
    if (analysis.state !== 'comparable') continue;
    const key = stableValueKey(analysis.value);
    if (!counts.has(key)) counts.set(key, {
      value: analysis.value, count: 0, dealIds: [], dealRefs: [],
    });
    const item = counts.get(key);
    item.count += 1;
    item.dealIds.push(dealId);
    item.dealRefs.push(dealRef(dealId, analysis.cardId));
  }
  return {
    kind: 'categorical',
    denominator: 'present_deals',
    denominatorCount: coverage.presentCount,
    values: [...counts.values()]
      .map((item) => ({
        value: item.value,
        count: item.count,
        dealIds: item.dealIds,
        ...(hasCardAttribution(item.dealRefs) ? { dealRefs: item.dealRefs } : {}),
        rate: ratio(item.count, coverage.presentCount),
      }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value))),
  };
}

function multiSelectDistribution(analyses, coverage) {
  const counts = new Map();
  for (const [dealId, analysis] of analyses.entries()) {
    if (analysis.state !== 'comparable') continue;
    const seen = new Set();
    const valueRefs = Array.isArray(analysis.valueRefs)
      ? analysis.valueRefs
      : analysis.values.map((value) => ({ value, cardId: analysis.cardId || null }));
    for (const valueRef of valueRefs) {
      const value = valueRef.value;
      const key = stableValueKey(value);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!counts.has(key)) counts.set(key, {
        value, count: 0, dealIds: [], dealRefs: [],
      });
      const item = counts.get(key);
      item.count += 1;
      item.dealIds.push(dealId);
      item.dealRefs.push(dealRef(dealId, valueRef.cardId));
    }
  }
  return {
    kind: 'multi_select',
    multiSelect: true,
    denominator: 'present_deals',
    denominatorCount: coverage.presentCount,
    values: [...counts.values()]
      .map((item) => ({
        value: item.value,
        count: item.count,
        dealIds: item.dealIds,
        ...(hasCardAttribution(item.dealRefs) ? { dealRefs: item.dealRefs } : {}),
        rate: ratio(item.count, coverage.presentCount),
      }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value))),
  };
}

function numericDistribution(kind, analyses, coverage) {
  const cohorts = new Map();
  for (const [dealId, analysis] of analyses.entries()) {
    if (analysis.state !== 'comparable') continue;
    const key = semanticCohortKey(analysis.cohort);
    if (!cohorts.has(key)) cohorts.set(key, {
      semantics: analysis.cohort, values: [], dealIds: [], dealRefs: [],
    });
    const cohort = cohorts.get(key);
    cohort.values.push(analysis.value);
    cohort.dealIds.push(dealId);
    cohort.dealRefs.push(dealRef(dealId, analysis.cardId));
  }
  return {
    kind,
    denominator: 'present_deals',
    denominatorCount: coverage.presentCount,
    cohorts: [...cohorts.values()]
      .map((cohort) => ({
        semantics: cohort.semantics,
        stats: numericSummary(cohort.values),
        dealIds: cohort.dealIds,
        ...(hasCardAttribution(cohort.dealRefs) ? { dealRefs: cohort.dealRefs } : {}),
      }))
      .sort((a, b) => semanticCohortKey(a.semantics).localeCompare(semanticCohortKey(b.semantics))),
  };
}

function exclusionCounts(analyses) {
  const counts = new Map();
  for (const analysis of analyses.values()) {
    if (analysis.state !== 'excluded') continue;
    counts.set(analysis.reason, (counts.get(analysis.reason) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function moneyDistribution(spec, analyses, coverage) {
  const raw = [];
  const cohorts = new Map();
  for (const [dealId, analysis] of analyses.entries()) {
    const values = Array.isArray(analysis.moneyValues) && analysis.moneyValues.length
      ? analysis.moneyValues
      : [analysis];
    const rawValues = Array.isArray(analysis.rawValues)
      ? analysis.rawValues
      : values.filter((value) => value.rawUnit === 'usd' && Number.isFinite(value.rawValue)).map((value) => value.rawValue);
    raw.push(...rawValues.filter(Number.isFinite));
    if (analysis.state !== 'comparable') continue;
    for (const value of values) {
      const key = `${value.basis}|${semanticCohortKey(value.cohort || {})}`;
      if (!cohorts.has(key)) {
        cohorts.set(key, {
          basis: value.basis,
          semantics: value.cohort || null,
          percent: [],
          basisPoints: [],
          dealIds: [],
          dealRefs: [],
        });
      }
      const cohort = cohorts.get(key);
      cohort.percent.push(value.percentOfDealValue);
      cohort.basisPoints.push(value.basisPointsOfDealValue);
      if (!cohort.dealIds.includes(dealId)) {
        cohort.dealIds.push(dealId);
        cohort.dealRefs.push(dealRef(dealId, value.cardId || analysis.cardId));
      }
    }
  }
  return {
    kind: 'money',
    denominator: 'present_deals',
    denominatorCount: coverage.presentCount,
    raw: { unit: 'usd', stats: numericSummary(raw) },
    normalised: {
      ...spec.semantics.normalisation,
      cohorts: [...cohorts.values()]
        .map((values) => ({
          basis: values.basis,
          semantics: values.semantics,
          percent: { unit: 'percent', stats: numericSummary(values.percent) },
          basisPoints: { unit: 'bps', stats: numericSummary(values.basisPoints) },
          dealIds: values.dealIds,
          ...(hasCardAttribution(values.dealRefs) ? { dealRefs: values.dealRefs } : {}),
        }))
        .sort((a, b) => a.basis.localeCompare(b.basis)
          || semanticCohortKey(a.semantics || {}).localeCompare(semanticCohortKey(b.semantics || {}))),
      exclusions: exclusionCounts(analyses),
    },
  };
}

function buildDistribution(spec, analyses, coverage) {
  const kind = spec.comparison.kind;
  if (kind === 'presence') {
    return {
      kind,
      denominator: 'eligible_deals',
      denominatorCount: coverage.eligibleCount,
      presentCount: coverage.presentCount,
      rate: ratio(coverage.presentCount, coverage.eligibleCount),
    };
  }
  if (kind === 'categorical') return categoricalDistribution(spec, analyses, coverage);
  if (kind === 'multi_select') return multiSelectDistribution(analyses, coverage);
  if (kind === 'money') return moneyDistribution(spec, analyses, coverage);
  return numericDistribution(kind, analyses, coverage);
}

function subjectObservation(subjectEntry, spec) {
  if (!subjectEntry) return null;
  const base = {
    dealId: subjectEntry.dealId,
    status: subjectEntry.status,
    present: subjectEntry.status === 'present',
  };
  if (subjectEntry.status !== 'present') return base;
  let analysis = analysePresentEntry(subjectEntry, spec);
  if (spec.comparison.kind === 'presence') {
    return { ...base, valueState: 'comparable', ...(analysis.cardId ? { cardId: analysis.cardId } : {}) };
  }
  if (spec.comparison.kind === 'money' && analysis.state === 'comparable' && Array.isArray(analysis.moneyValues)) {
    const stratified = spec.semantics?.stratifyDimensions || [];
    const matchingValues = analysis.moneyValues.filter((candidate) => stratified.every((dimension) => (
      !spec.semantics?.[dimension] || candidate.cohort?.[dimension] === spec.semantics[dimension]
    )));
    if (matchingValues.length === 1) analysis = { state: 'comparable', ...matchingValues[0] };
    else if (matchingValues.length === 0) {
      analysis = { state: 'excluded', reason: 'no_matching_semantic_cohort' };
    } else {
      analysis = { state: 'excluded', reason: 'multiple_values_for_scalar' };
    }
  }
  const result = { ...base, valueState: analysis.state };
  if (analysis.reason) result.exclusionReason = analysis.reason;
  if (analysis.cardId) result.cardId = analysis.cardId;
  if ('value' in analysis) result.value = analysis.value;
  if (analysis.values) result.values = analysis.values;
  if (analysis.cohort) result.semantics = analysis.cohort;
  if (Number.isFinite(analysis.rawValue)) result.rawUsd = analysis.rawValue;
  if (analysis.basis) result.dealValueBasis = analysis.basis;
  if (Number.isFinite(analysis.dealValueUsd)) result.dealValueUsd = analysis.dealValueUsd;
  if (Number.isFinite(analysis.percentOfDealValue)) result.percentOfDealValue = analysis.percentOfDealValue;
  if (Number.isFinite(analysis.basisPointsOfDealValue)) result.basisPointsOfDealValue = analysis.basisPointsOfDealValue;
  return result;
}

function aggregateMetric(spec, entries, subjectDealId) {
  if (spec.comparison.status === 'non_comparable') {
    return {
      contractVersion: 1,
      rowKey: spec.rowKey,
      metricKey: spec.metricKey,
      state: 'not_comparable',
      reason: spec.comparison.reason,
      coverage: {
        cohortCount: 0,
        eligibleCount: 0,
        presentCount: 0,
        absentCount: 0,
        unknownCount: 0,
        notApplicableCount: 0,
        classifiedCount: 0,
        observedCount: 0,
        valueUnknownCount: 0,
        comparableCount: 0,
        excludedCount: 0,
      },
      subject: subjectDealId ? { dealId: subjectDealId, status: 'not_applicable', present: false } : null,
    };
  }

  const subjectEntry = subjectDealId ? entries.find((entry) => entry.dealId === subjectDealId) || null : null;
  const baselineEntries = subjectDealId ? entries.filter((entry) => entry.dealId !== subjectDealId) : entries;
  const analyses = new Map();
  for (const entry of baselineEntries) {
    if (entry.status === 'present') analyses.set(entry.dealId, analysePresentEntry(entry, spec));
  }
  const coverage = buildCoverage(baselineEntries, analyses, spec.comparison.kind);
  const dealIdsByStatus = spec.comparison.kind === 'presence'
    ? baselineEntries.reduce((groups, entry) => {
      groups[entry.status].push(entry.dealId);
      return groups;
    }, { present: [], absent: [], unknown: [], not_applicable: [] })
    : null;
  const dealRefsByStatus = spec.comparison.kind === 'presence'
    ? baselineEntries.reduce((groups, entry) => {
      groups[entry.status].push(dealRef(entry.dealId, entry.cardId));
      return groups;
    }, { present: [], absent: [], unknown: [], not_applicable: [] })
    : null;
  return {
    contractVersion: 1,
    rowKey: spec.rowKey,
    metricKey: spec.metricKey,
    state: stateForCoverage(coverage),
    coverage,
    prevalence: {
      denominator: 'eligible_deals',
      presentCount: coverage.presentCount,
      eligibleCount: coverage.eligibleCount,
      rate: ratio(coverage.presentCount, coverage.eligibleCount),
    },
    distribution: buildDistribution(spec, analyses, coverage),
    exclusions: exclusionCounts(analyses),
    ...(spec.comparison.kind === 'presence' ? {
      dealIdsByStatus,
      ...(Object.values(dealRefsByStatus).some(hasCardAttribution) ? { dealRefsByStatus } : {}),
    } : {}),
    subject: subjectObservation(subjectEntry, spec),
    ...(spec.denominator.conditionalOn ? { conditionalOn: spec.denominator.conditionalOn } : {}),
  };
}

module.exports = {
  aggregateMetric,
  analysePresentEntry,
  basisForMoney,
  buildCoverage,
  numericSummary,
  quantile,
  semanticCohortKey,
};
