const {
  definitionSignalPattern,
  findDefinitionUnits,
  findInlineDefinitionUnits,
} = require('./regions/definitions');
const { isGapRegionType } = require('./regions');
const { parseStructure } = require('./structural');

const DETECTION_SCHEMA = 'PARSER_V2_STRUCTURAL_DEFINITION_DETECTION/V1';

function requireLimit(limits, key) {
  const value = limits && limits[key];
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`governed parser limit ${key} must be a positive integer`);
  }
  return value;
}

function requireInterval(start, end, length, label) {
  if (!Number.isInteger(start) || !Number.isInteger(end)
    || start < 0 || end <= start || end > length) {
    throw new TypeError(`${label} has an invalid clean-text interval`);
  }
}

function nullableString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function compareClosedDto(left, right) {
  const coordinateOrder = left.clean_start - right.clean_start
    || left.clean_end - right.clean_end;
  if (coordinateOrder !== 0) return coordinateOrder;
  const leftKey = JSON.stringify(left);
  const rightKey = JSON.stringify(right);
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? -1 : 1;
}

function structuralResidual(region, reasonCode) {
  return {
    reason_code: reasonCode,
    region_type: nullableString(region && region.type),
    clean_start: Number(region && (region.start ?? region.clean_start)),
    clean_end: Number(region && (region.end ?? region.clean_end)),
  };
}

function candidateFailure(candidateKind, reasonCode, producerOrdinal, source) {
  const start = source && (source.startChar ?? source.start ?? source.clean_start);
  const end = source && (source.endChar ?? source.end ?? source.clean_end);
  return {
    candidate_kind: candidateKind,
    reason_code: reasonCode,
    producer_ordinal: producerOrdinal,
    clean_start: Number.isInteger(start) ? start : null,
    clean_end: Number.isInteger(end) ? end : null,
  };
}

function compareScanOrder(left, right) {
  return left.dto.clean_end - right.dto.clean_end
    || left.dto.clean_start - right.dto.clean_start
    || compareClosedDto(left.dto, right.dto)
    || left.producer_ordinal - right.producer_ordinal;
}

function lastNonOverlappingRow(rows, beforeIndex, start) {
  let low = 0;
  let high = beforeIndex;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle].dto.clean_end <= start) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low - 1;
}

function scanParentQuality(row) {
  return [
    row.dto.section_number,
    row.dto.section_title,
    row.dto.region_type,
    row.dto.level,
  ].filter((value) => typeof value === 'string' && value.length > 0).length;
}

function isGovernedScanParent(row) {
  return typeof row.dto.section_number === 'string'
    && row.dto.section_number.length > 0
    && typeof row.dto.region_type === 'string'
    && row.dto.region_type.startsWith('body.section.');
}

function isolateAmbiguousScanParents(sectionRows) {
  const governedRows = sectionRows.filter(isGovernedScanParent);
  const ordered = [...governedRows].sort((left, right) => (
    left.dto.clean_start - right.dto.clean_start
    || left.dto.clean_end - right.dto.clean_end
    || compareClosedDto(left.dto, right.dto)
    || left.producer_ordinal - right.producer_ordinal
  ));
  const isolated = new Set();
  const ambiguous = new Set();
  for (let cursor = 0; cursor < ordered.length;) {
    const component = [ordered[cursor]];
    let componentEnd = ordered[cursor].dto.clean_end;
    let next = cursor + 1;
    while (next < ordered.length
      && ordered[next].dto.clean_start < componentEnd) {
      component.push(ordered[next]);
      componentEnd = Math.max(componentEnd, ordered[next].dto.clean_end);
      next += 1;
    }
    const governedIdentities = new Set(
      component.map((row) => JSON.stringify(row.dto)),
    );
    if (governedIdentities.size > 1) {
      component.forEach((row) => {
        isolated.add(row);
        ambiguous.add(row);
      });
    } else {
      const governedRepresentative = component
        .sort((left, right) => left.producer_ordinal - right.producer_ordinal)[0];
      component.forEach((row) => {
        if (row !== governedRepresentative) {
          isolated.add(row);
        }
      });
    }
    cursor = next;
  }
  const ambiguousIntervals = [...ambiguous]
    .sort((left, right) => left.dto.clean_start - right.dto.clean_start)
    .reduce((intervals, row) => {
      const last = intervals.at(-1);
      if (last && row.dto.clean_start < last.end) {
        last.end = Math.max(last.end, row.dto.clean_end);
      } else {
        intervals.push({
          start: row.dto.clean_start,
          end: row.dto.clean_end,
        });
      }
      return intervals;
    }, []);
  sectionRows.filter((row) => !isGovernedScanParent(row)).forEach((row) => {
    if (ambiguousIntervals.some((interval) => (
      row.dto.clean_start < interval.end
      && row.dto.clean_end > interval.start
    ))) {
      isolated.add(row);
      ambiguous.add(row);
    }
  });
  const eligible = sectionRows.filter((row) => !isolated.has(row));
  return { eligible, isolated, ambiguous };
}

function isolateDefinitionScanParents(sectionRows) {
  const preselected = isolateAmbiguousScanParents(sectionRows);
  const rows = [...preselected.eligible].sort(compareScanOrder);
  const predecessor = rows.map((row, index) => (
    lastNonOverlappingRow(rows, index, row.dto.clean_start)
  ));
  const governedCoveredCharacters = new Array(rows.length + 1).fill(0);
  const coveredCharacters = new Array(rows.length + 1).fill(0);
  const qualityScores = new Array(rows.length + 1).fill(0);
  const selectedCounts = new Array(rows.length + 1).fill(0);
  const take = new Array(rows.length + 1).fill(false);
  for (let index = 1; index <= rows.length; index += 1) {
    const row = rows[index - 1];
    const priorPlanIndex = predecessor[index - 1] + 1;
    const rowCoverage = row.dto.clean_end - row.dto.clean_start;
    const includeGovernedCoverage = governedCoveredCharacters[priorPlanIndex]
      + (isGovernedScanParent(row) ? rowCoverage : 0);
    const includeCoverage = coveredCharacters[priorPlanIndex]
      + rowCoverage;
    const includeQuality = qualityScores[priorPlanIndex] + scanParentQuality(row);
    const includeCount = selectedCounts[priorPlanIndex] + 1;
    const excludeGovernedCoverage = governedCoveredCharacters[index - 1];
    const excludeCoverage = coveredCharacters[index - 1];
    const excludeQuality = qualityScores[index - 1];
    const excludeCount = selectedCounts[index - 1];
    const include = includeGovernedCoverage > excludeGovernedCoverage
      || (includeGovernedCoverage === excludeGovernedCoverage
        && includeCoverage > excludeCoverage)
      || (includeGovernedCoverage === excludeGovernedCoverage
        && includeCoverage === excludeCoverage
        && includeQuality > excludeQuality)
      || (includeGovernedCoverage === excludeGovernedCoverage
        && includeCoverage === excludeCoverage
        && includeQuality === excludeQuality
        && includeCount >= excludeCount);
    if (include) {
      governedCoveredCharacters[index] = includeGovernedCoverage;
      coveredCharacters[index] = includeCoverage;
      qualityScores[index] = includeQuality;
      selectedCounts[index] = includeCount;
      take[index] = true;
    } else {
      governedCoveredCharacters[index] = excludeGovernedCoverage;
      coveredCharacters[index] = excludeCoverage;
      qualityScores[index] = excludeQuality;
      selectedCounts[index] = excludeCount;
    }
  }
  const selectedSet = new Set();
  for (let cursor = rows.length; cursor > 0;) {
    if (!take[cursor]) {
      cursor -= 1;
      continue;
    }
    const rowIndex = cursor - 1;
    selectedSet.add(rows[rowIndex]);
    cursor = predecessor[rowIndex] + 1;
  }
  const selected = sectionRows
    .filter((row) => selectedSet.has(row))
    .sort((left, right) => compareClosedDto(left.dto, right.dto));
  const rejected = sectionRows.filter((row) => !selectedSet.has(row));
  return {
    selected,
    rejected,
    ambiguous: preselected.ambiguous,
  };
}

function normaliseStructuralDefinitionProposals({
  cleanText,
  parsed,
  governedLimits,
}) {
  if (typeof cleanText !== 'string') throw new TypeError('cleanText must be a string');
  const maxSections = requireLimit(governedLimits, 'max_sections');
  const maxDefinitions = requireLimit(governedLimits, 'max_definitions');
  const maxResiduals = requireLimit(governedLimits, 'max_residuals');
  const maxTotalCandidates = requireLimit(governedLimits, 'max_total_candidates');
  if (!parsed || !Array.isArray(parsed.sections) || !Array.isArray(parsed.regions)
    || !parsed.diagnostics || typeof parsed.diagnostics !== 'object') {
    throw new TypeError('parser v2 returned an invalid structural result');
  }
  if (parsed.sections.length > maxSections) {
    throw new RangeError('parser v2 section count exceeds its governed limit');
  }

  const sectionRows = [];
  const candidateFailures = [];
  parsed.sections.forEach((section, producerOrdinal) => {
    try {
      requireInterval(section.startChar, section.endChar, cleanText.length, 'structural section');
      sectionRows.push({
        source: section,
        producer_ordinal: producerOrdinal,
        dto: {
          section_number: nullableString(section.number),
          section_title: nullableString(section.title || section.heading),
          article_number: nullableString(section.articleNumber),
          article_title: nullableString(section.articleTitle),
          region_type: nullableString(section.regionType),
          atomic: section.atomic === true,
          atomic_reason: nullableString(section.atomicReason),
          level: nullableString(section.level),
          clean_start: section.startChar,
          clean_end: section.endChar,
        },
      });
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_SECTION',
        'INVALID_STRUCTURAL_SECTION',
        producerOrdinal,
        section,
      ));
    }
  });
  sectionRows.sort((left, right) => compareClosedDto(left.dto, right.dto));
  const sections = sectionRows.map((row) => row.dto);
  sectionRows.forEach((row, index) => {
    row.parent_section_index = index;
  });
  const scanParents = isolateDefinitionScanParents(sectionRows);
  const selectedScanParents = new Set(scanParents.selected);
  scanParents.rejected.forEach((row) => {
    candidateFailures.push(candidateFailure(
      'STRUCTURAL_SECTION',
      scanParents.ambiguous.has(row)
        ? 'AMBIGUOUS_OVERLAPPING_STRUCTURAL_PARENTS'
        : 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED',
      row.producer_ordinal,
      row.source,
    ));
  });
  const configuredScanBudget = Number.isInteger(governedLimits.max_source_bytes)
    && governedLimits.max_source_bytes > 0
    ? governedLimits.max_source_bytes
    : cleanText.length;
  const scannedSectionCharacterBudget = Math.min(
    cleanText.length,
    configuredScanBudget,
  );
  let scannedSectionCharacters = 0;
  const definitions = [];
  const residuals = [];
  sectionRows.forEach((row) => {
    const section = row.source;
    const sectionProducerOrdinal = row.producer_ordinal;
    const parentSectionIndex = row.parent_section_index;
    if (section.needsDoubleDummyModel === true) {
      residuals.push(structuralResidual({
        type: section.regionType,
        start: section.startChar,
        end: section.endChar,
      }, 'SEMANTIC_REVIEW_REQUIRED'));
    }
    const completenessWarnings = Array.isArray(section.definitionCompletenessWarnings)
      ? section.definitionCompletenessWarnings
      : [];
    if (section.definitionCompletenessWarnings != null
      && !Array.isArray(section.definitionCompletenessWarnings)) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_SECTION',
        'INVALID_DEFINITION_WARNING_COLLECTION',
        sectionProducerOrdinal,
        section,
      ));
    }
    for (const warning of completenessWarnings) {
      residuals.push(structuralResidual({
        type: section.regionType,
        start: section.startChar,
        end: section.endChar,
      }, String(warning && warning.code || 'DEFINITION_COMPLETENESS_WARNING').toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')));
    }
    if (!selectedScanParents.has(row)) return;
    const sectionCharacterLength = section.endChar - section.startChar;
    if (sectionCharacterLength
      > scannedSectionCharacterBudget - scannedSectionCharacters) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_SECTION',
        'SECTION_SCAN_CHARACTER_BUDGET_EXCEEDED',
        sectionProducerOrdinal,
        section,
      ));
      return;
    }
    scannedSectionCharacters += sectionCharacterLength;
    const isDefinitionSection = section.regionType === 'body.section.definition';
    const sectionText = cleanText.slice(section.startChar, section.endChar);
    let units;
    try {
      const remainingDefinitionCapacity = maxDefinitions - definitions.length;
      units = isDefinitionSection
        ? findDefinitionUnits(sectionText, remainingDefinitionCapacity)
        : findInlineDefinitionUnits(sectionText, remainingDefinitionCapacity);
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'DEFINITION_CANDIDATE',
        isDefinitionSection
          ? 'DEFINITION_SECTION_PARSE_FAILED'
          : 'INLINE_DEFINITION_PARSE_FAILED',
        sectionProducerOrdinal,
        section,
      ));
      return;
    }
    if (isDefinitionSection && units.length === 0 && sectionText.length > 250) {
      residuals.push(structuralResidual({
        type: section.regionType,
        start: section.startChar,
        end: section.endChar,
      }, 'DEFINITION_UNITS_NOT_DETECTED'));
    }
    units.forEach((unit, unitOrdinal) => {
      try {
        const cleanStart = section.startChar + unit.start;
        const cleanEnd = section.startChar + unit.end;
        requireInterval(cleanStart, cleanEnd, cleanText.length, 'definition candidate');
        if (typeof unit.term !== 'string' || !unit.term.trim()) {
          throw new TypeError('definition candidate has no neutral defined term');
        }
        definitions.push({
          neutral_defined_term: unit.term.trim(),
          parent_section_index: parentSectionIndex,
          clean_start: cleanStart,
          clean_end: cleanEnd,
        });
      } catch (_) {
        candidateFailures.push(candidateFailure(
          'DEFINITION_CANDIDATE',
          'INVALID_DEFINITION_CANDIDATE',
          unitOrdinal,
          {
            clean_start: Number.isInteger(unit && unit.start)
              ? section.startChar + unit.start
              : null,
            clean_end: Number.isInteger(unit && unit.end)
              ? section.startChar + unit.end
              : null,
          },
        ));
      }
      if (definitions.length > maxDefinitions) {
        throw new RangeError('parser v2 definition count exceeds its governed limit');
      }
    });
  });

  parsed.regions.forEach((region, producerOrdinal) => {
    if (!isGapRegionType(region && region.type)) return;
    try {
      requireInterval(region.start, region.end, cleanText.length, 'structural gap region');
      residuals.push(structuralResidual(region, 'UNCLASSIFIED_STRUCTURAL_REGION'));
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_REGION',
        'INVALID_STRUCTURAL_REGION',
        producerOrdinal,
        region,
      ));
    }
  });
  const coverageGaps = Array.isArray(parsed.diagnostics.regionCoverageGaps)
    ? parsed.diagnostics.regionCoverageGaps
    : [];
  if (parsed.diagnostics.regionCoverageGaps != null
    && !Array.isArray(parsed.diagnostics.regionCoverageGaps)) {
    candidateFailures.push(candidateFailure(
      'STRUCTURAL_REGION',
      'INVALID_COVERAGE_GAP_COLLECTION',
      0,
      null,
    ));
  }
  coverageGaps.forEach((gap, producerOrdinal) => {
    try {
      requireInterval(gap.start, gap.end, cleanText.length, 'coverage gap');
      residuals.push(structuralResidual(gap, 'STRUCTURAL_COVERAGE_GAP'));
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_REGION',
        'INVALID_COVERAGE_GAP',
        producerOrdinal,
        gap,
      ));
    }
  });
  let exactDuplicateRegionCount = 0;
  let blockingOverlapCount = 0;
  const coverageOverlaps = Array.isArray(parsed.diagnostics.regionCoverageOverlaps)
    ? parsed.diagnostics.regionCoverageOverlaps
    : [];
  if (parsed.diagnostics.regionCoverageOverlaps != null
    && !Array.isArray(parsed.diagnostics.regionCoverageOverlaps)) {
    candidateFailures.push(candidateFailure(
      'STRUCTURAL_REGION',
      'INVALID_COVERAGE_OVERLAP_COLLECTION',
      0,
      null,
    ));
  }
  coverageOverlaps.forEach((overlap, producerOrdinal) => {
    try {
      requireInterval(overlap.start, overlap.end, cleanText.length, 'coverage overlap');
      const exactDuplicateGeometry = overlap.left && overlap.right
        && overlap.left.type === overlap.right.type
        && overlap.left.start === overlap.right.start
        && overlap.left.end === overlap.right.end;
      if (exactDuplicateGeometry) {
        exactDuplicateRegionCount += 1;
        return;
      }
      blockingOverlapCount += 1;
      residuals.push(structuralResidual(overlap, 'STRUCTURAL_COVERAGE_OVERLAP'));
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'STRUCTURAL_REGION',
        'INVALID_COVERAGE_OVERLAP',
        producerOrdinal,
        overlap,
      ));
    }
  });
  if (sections.length === 0 && cleanText.length > 0) {
    residuals.push(structuralResidual({
      type: null,
      start: 0,
      end: cleanText.length,
    }, 'NO_STRUCTURAL_SECTIONS_DETECTED'));
  }
  if (residuals.length + candidateFailures.length > maxResiduals) {
    throw new RangeError('parser v2 residual count exceeds its governed limit');
  }
  if (sections.length + definitions.length > maxTotalCandidates) {
    throw new RangeError('parser v2 candidate count exceeds its governed limit');
  }

  definitions.sort(compareClosedDto);
  residuals.sort(compareClosedDto);
  candidateFailures.sort((left, right) => (
    left.producer_ordinal - right.producer_ordinal
    || left.candidate_kind.localeCompare(right.candidate_kind)
    || left.reason_code.localeCompare(right.reason_code)
  ));
  return {
    schema_version: DETECTION_SCHEMA,
    sections,
    definitions,
    structural_residual_regions: residuals,
    candidate_failures: candidateFailures,
    diagnostics: {
      body_start: Number(parsed.diagnostics.bodyStart) || 0,
      body_end: Number(parsed.diagnostics.bodyEnd) || 0,
      section_count: sections.length,
      article_count: Number(parsed.diagnostics.totalArticles) || 0,
      delimiter: nullableString(parsed.diagnostics.delimiter),
      numbered_section_gap_count: Array.isArray(parsed.diagnostics.gaps)
        ? parsed.diagnostics.gaps.length
        : 0,
      region_coverage_complete: coverageGaps.length === 0
        && blockingOverlapCount === 0,
      region_coverage_gap_count: coverageGaps.length,
      region_coverage_overlap_count: blockingOverlapCount,
      exact_duplicate_region_count: exactDuplicateRegionCount,
      candidate_failure_count: candidateFailures.length,
    },
  };
}

function countMatchesAtMost(text, pattern, maximum, label) {
  let count = 0;
  while (pattern.exec(text) !== null) {
    count += 1;
    if (count > maximum) throw new RangeError(`${label} exceeds its governed limit`);
  }
  return count;
}

function detectStructuralDefinitionProposals(cleanText, governedLimits) {
  if (typeof cleanText !== 'string') throw new TypeError('cleanText must be a string');
  const maxSections = requireLimit(governedLimits, 'max_sections');
  const maxDefinitions = requireLimit(governedLimits, 'max_definitions');
  const maxTotalCandidates = requireLimit(governedLimits, 'max_total_candidates');
  const sectionSignals = countMatchesAtMost(
    cleanText,
    /(?:^|\n)[ \t]*(?:(?:SECTION|Section)[ \t]+)?\d{1,2}\.\d{1,2}\b/g,
    maxSections,
    'parser v2 structural heading signal count',
  );
  const definitionSignals = countMatchesAtMost(
    cleanText,
    definitionSignalPattern(),
    maxDefinitions,
    'parser v2 definition signal count',
  );
  if (sectionSignals + definitionSignals > maxTotalCandidates) {
    throw new RangeError('parser v2 candidate signal count exceeds its governed limit');
  }
  return normaliseStructuralDefinitionProposals({
    cleanText,
    parsed: parseStructure(cleanText),
    governedLimits,
  });
}

module.exports = {
  DETECTION_SCHEMA,
  detectStructuralDefinitionProposals,
  normaliseStructuralDefinitionProposals,
};
