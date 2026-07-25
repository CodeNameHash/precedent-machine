const { findDefinitionUnits } = require('./regions/definitions');
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
  const sectionOrdinalByOriginal = new Map();
  sectionRows.forEach((row, index) => sectionOrdinalByOriginal.set(row.source, index));
  const definitions = [];
  const residuals = [];
  parsed.sections.forEach((section, sectionProducerOrdinal) => {
    const parentSectionIndex = sectionOrdinalByOriginal.get(section);
    if (!Number.isInteger(parentSectionIndex)) return;
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
    if (section.regionType !== 'body.section.definition') return;
    const sectionText = cleanText.slice(section.startChar, section.endChar);
    let units;
    try {
      units = findDefinitionUnits(sectionText);
    } catch (_) {
      candidateFailures.push(candidateFailure(
        'DEFINITION_CANDIDATE',
        'DEFINITION_SECTION_PARSE_FAILED',
        sectionProducerOrdinal,
        section,
      ));
      return;
    }
    if (units.length === 0 && sectionText.length > 250) {
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
    /(?:^|\n+|[.;]\s+)(?:["“][^"”\n]{2,120}["”]|[A-Z][A-Za-z0-9'’&., -]{2,80})\s+(?:means|shall\s+mean|has\s+the\s+meaning|will\s+have\s+the\s+meaning|refers\s+to)\b/g,
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
