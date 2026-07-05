const { REGION_TYPES, makeRegion, sortedRegions, mergeAdjacentRegions } = require('./regions');

function findCoverageGaps(regions, length) {
  const total = Math.max(0, Number(length) || 0);
  const gaps = [];
  let cursor = 0;
  for (const region of sortedRegions(regions)) {
    if (region.start > cursor) {
      gaps.push(makeRegion(REGION_TYPES.BODY_SECTION_UNASSIGNED, cursor, region.start));
    }
    cursor = Math.max(cursor, region.end);
  }
  if (cursor < total) {
    gaps.push(makeRegion(REGION_TYPES.BODY_SECTION_UNASSIGNED, cursor, total));
  }
  return gaps;
}

function findCoverageOverlaps(regions) {
  const ordered = sortedRegions(regions);
  const overlaps = [];
  let prev = null;
  for (const region of ordered) {
    if (prev && region.start < prev.end) {
      overlaps.push({
        start: region.start,
        end: Math.min(region.end, prev.end),
        left: prev,
        right: region,
      });
    }
    if (!prev || region.end > prev.end) prev = region;
  }
  return overlaps;
}

function findUncovered(regions, textLength) {
  return findCoverageGaps(regions, textLength).map((gap) => ({
    start: gap.start,
    end: gap.end,
    length: gap.length,
  }));
}

function findOverlaps(regions) {
  return findCoverageOverlaps(regions).map((overlap) => ({
    a: overlap.left,
    b: overlap.right,
    overlap: {
      start: overlap.start,
      end: overlap.end,
      length: overlap.end - overlap.start,
    },
  }));
}

function mergeAdjacent(regions) {
  return mergeAdjacentRegions(regions);
}

function coverageDiagnostics(regions, textOrLength) {
  const length = typeof textOrLength === 'string'
    ? textOrLength.length
    : Math.max(0, Number(textOrLength) || 0);
  const gaps = findCoverageGaps(regions, length);
  const overlaps = findCoverageOverlaps(regions);
  return {
    length,
    complete: gaps.length === 0 && overlaps.length === 0,
    gaps,
    overlaps,
    regionCount: Array.isArray(regions) ? regions.length : 0,
  };
}

function assertCoverage(regions, textOrLength) {
  const diagnostics = coverageDiagnostics(regions, textOrLength);
  if (diagnostics.complete) return diagnostics;
  const parts = [];
  if (diagnostics.gaps.length) {
    parts.push(`uncovered ranges ${diagnostics.gaps.slice(0, 5).map((gap) => `${gap.start}-${gap.end}`).join(', ')}`);
  }
  if (diagnostics.overlaps.length) {
    parts.push(`overlaps ${diagnostics.overlaps.slice(0, 5).map((overlap) => `${overlap.start}-${overlap.end}`).join(', ')}`);
  }
  throw new Error(`Region coverage invariant failed: ${parts.join(', ') || 'unknown coverage issue'}`);
}

module.exports = {
  findCoverageGaps,
  findCoverageOverlaps,
  findUncovered,
  findOverlaps,
  mergeAdjacent,
  coverageDiagnostics,
  assertCoverage,
};
