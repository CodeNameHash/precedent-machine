const { REGION_TYPES, makeRegion, sortedRegions } = require('./regions');

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
  const firstGap = diagnostics.gaps[0];
  const firstOverlap = diagnostics.overlaps[0];
  const parts = [];
  if (firstGap) parts.push(`gap ${firstGap.start}-${firstGap.end}`);
  if (firstOverlap) parts.push(`overlap ${firstOverlap.start}-${firstOverlap.end}`);
  throw new Error(`Region coverage invariant failed: ${parts.join(', ') || 'unknown coverage issue'}`);
}

module.exports = {
  findCoverageGaps,
  findCoverageOverlaps,
  coverageDiagnostics,
  assertCoverage,
};
