const { REGION_TYPES, makeRegion, mergeAdjacentRegions } = require('../regions');

function firstIndex(re, text, limit) {
  const window = text.substring(0, Math.max(0, limit));
  const m = re.exec(window);
  return m ? m.index : -1;
}

function detectPreambleRegions(fullText, bodyStart) {
  const start = Math.max(0, Number(bodyStart) || 0);
  if (!fullText || start <= 0) return [];

  const tocStart = firstIndex(/\bTABLE\s+OF\s+CONTENTS\b/i, fullText, start);
  const recitalsStart = firstIndex(/\n\s*WHEREAS\b/i, fullText, start);
  const enactingStart = firstIndex(/\bNOW\s*,?\s+THEREFORE\b|\bNOW\s+THEREFORE\b/i, fullText, start);
  const boundaries = [];

  if (tocStart >= 0) boundaries.push({ pos: tocStart, type: REGION_TYPES.PREAMBLE_TOC });
  if (recitalsStart >= 0) boundaries.push({ pos: recitalsStart + 1, type: REGION_TYPES.PREAMBLE_RECITALS });
  if (enactingStart >= 0) boundaries.push({ pos: enactingStart, type: REGION_TYPES.PREAMBLE_ENACTING });
  boundaries.sort((a, b) => a.pos - b.pos);

  const regions = [];
  let cursor = 0;
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (boundary.pos > cursor) {
      const type = cursor === 0 ? REGION_TYPES.PREAMBLE_COVER : regions[regions.length - 1]?.type || REGION_TYPES.PREAMBLE_COVER;
      regions.push(makeRegion(type, cursor, boundary.pos, { source: 'preamble' }));
    }
    const next = i + 1 < boundaries.length ? boundaries[i + 1].pos : start;
    if (next > boundary.pos) {
      regions.push(makeRegion(boundary.type, boundary.pos, next, { source: 'preamble' }));
    }
    cursor = Math.max(cursor, next);
  }

  if (cursor < start) {
    const tailType = enactingStart >= 0 && cursor >= enactingStart
      ? REGION_TYPES.PREAMBLE_ENACTING
      : REGION_TYPES.PREAMBLE_COVER;
    regions.push(makeRegion(tailType, cursor, start, { source: 'preamble' }));
  }

  return mergeAdjacentRegions(regions);
}

module.exports = {
  detectPreambleRegions,
};
