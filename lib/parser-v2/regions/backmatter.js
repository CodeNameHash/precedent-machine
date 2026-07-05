const { REGION_TYPES, makeRegion, mergeAdjacentRegions } = require('../regions');

function typeForHeading(headingText) {
  const heading = String(headingText || '');
  if (/INDEX\s+OF\s+DEFINED\s+TERMS/i.test(heading)) return REGION_TYPES.BACKMATTER_INDEX;
  if (/^\s*ANNEX\b/i.test(heading)) return REGION_TYPES.BACKMATTER_ANNEX;
  if (/^\s*EXHIBIT\b/i.test(heading)) return REGION_TYPES.BACKMATTER_EXHIBIT;
  if (/^\s*FORM\s+OF\b/i.test(heading)) return REGION_TYPES.BACKMATTER_EXHIBIT;
  if (/^\s*SCHEDULE\b/i.test(heading)) return REGION_TYPES.BACKMATTER_SCHEDULE;
  return REGION_TYPES.BACKMATTER_OTHER;
}

function detectBackmatterRegions(fullText, bodyEnd) {
  const start = Math.max(0, Number(bodyEnd) || 0);
  if (!fullText || start >= fullText.length) return [];

  const tail = fullText.substring(start);
  const headingRe = /(?:^|\n)\s*((?:ANNEX|Annex)\s+[A-ZIVXLCDM0-9.-]+\b[^\n]*|(?:EXHIBIT|Exhibit)\s+[A-Z0-9.-]+\b[^\n]*|(?:SCHEDULE|Schedule)\s+[A-Z0-9.-]+\b[^\n]*|(?:FORM|Form)\s+OF\s+[^\n]{3,140}|INDEX\s+OF\s+DEFINED\s+TERMS\b[^\n]*)/g;
  const headings = [];
  let m;
  while ((m = headingRe.exec(tail)) !== null) {
    headings.push({
      start: start + m.index + (m[0].startsWith('\n') ? 1 : 0),
      heading: m[1],
      type: typeForHeading(m[1]),
    });
  }

  const regions = [];
  let cursor = start;
  if (headings.length === 0) {
    const type = /IN\s+WITNESS\s+WHEREOF|\[Signature\s+Page|\/s\//i.test(tail)
      ? REGION_TYPES.BACKMATTER_SIGNATURES
      : REGION_TYPES.BACKMATTER_OTHER;
    return [makeRegion(type, start, fullText.length, { source: 'backmatter' })];
  }

  if (headings[0].start > cursor) {
    const lead = fullText.substring(cursor, headings[0].start);
    const type = /IN\s+WITNESS\s+WHEREOF|\[Signature\s+Page|\/s\//i.test(lead)
      ? REGION_TYPES.BACKMATTER_SIGNATURES
      : REGION_TYPES.BACKMATTER_OTHER;
    regions.push(makeRegion(type, cursor, headings[0].start, { source: 'backmatter' }));
  }

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const next = headings[i + 1];
    const end = next ? next.start : fullText.length;
    if (end > current.start) {
      regions.push(makeRegion(current.type, current.start, end, {
        heading: current.heading,
        source: 'backmatter',
      }));
    }
  }

  return mergeAdjacentRegions(regions);
}

module.exports = {
  detectBackmatterRegions,
};
