const REGION_TYPES = Object.freeze({
  PREAMBLE_COVER: 'preamble.cover',
  PREAMBLE_TOC: 'preamble.toc',
  PREAMBLE_RECITALS: 'preamble.recitals',
  PREAMBLE_ENACTING: 'preamble.enacting',
  BODY_ARTICLE_HEADER: 'body.article.header',
  BODY_SECTION_PROVISION: 'body.section.provision',
  BODY_SECTION_DEFINITION: 'body.section.definition',
  BODY_SECTION_UNASSIGNED: 'body.section.unassigned',
  BODY_SECTION_PARTIAL: 'body.section.partial',
  BACKMATTER_SIGNATURES: 'backmatter.signatures',
  BACKMATTER_EXHIBIT: 'backmatter.exhibit',
  BACKMATTER_ANNEX: 'backmatter.annex',
  BACKMATTER_SCHEDULE: 'backmatter.schedule',
  BACKMATTER_INDEX: 'backmatter.index',
  BACKMATTER_OTHER: 'backmatter.other',
});

const GAP_REGION_TYPES = new Set([
  REGION_TYPES.BODY_SECTION_UNASSIGNED,
  REGION_TYPES.BODY_SECTION_PARTIAL,
]);

const CLASSIFIABLE_REGION_TYPES = new Set([
  REGION_TYPES.BODY_SECTION_PROVISION,
  REGION_TYPES.BODY_SECTION_DEFINITION,
]);

function regionTypeForSection(section) {
  if (!section || typeof section !== 'object') return REGION_TYPES.BODY_SECTION_PROVISION;
  const title = String(section.title || section.heading || '');
  const articleTitle = String(section.articleTitle || '');
  if (section.regionType) return section.regionType;
  if (/definitions?/i.test(title) || /definitions?/i.test(articleTitle)) {
    return REGION_TYPES.BODY_SECTION_DEFINITION;
  }
  return REGION_TYPES.BODY_SECTION_PROVISION;
}

function makeRegion(type, start, end, extra = {}) {
  const s = Math.max(0, Number(start) || 0);
  const e = Math.max(s, Number(end) || 0);
  return {
    ...extra,
    type,
    start: s,
    end: e,
    length: e - s,
  };
}

function sortedRegions(regions) {
  return [...(regions || [])]
    .filter((region) => region && Number(region.end) > Number(region.start))
    .map((region) => {
      const { start, end, length, ...extra } = region;
      return makeRegion(region.type, start, end, extra);
    })
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
}

function mergeAdjacentRegions(regions) {
  const out = [];
  for (const region of sortedRegions(regions)) {
    const prev = out[out.length - 1];
    const sameType = prev && prev.type === region.type;
    const sameSource = prev && (prev.source || null) === (region.source || null);
    if (sameType && sameSource && prev.end === region.start) {
      prev.end = region.end;
      prev.length = prev.end - prev.start;
      continue;
    }
    out.push({ ...region });
  }
  return out;
}

function isGapRegionType(type) {
  return GAP_REGION_TYPES.has(type);
}

function isClassifiableRegionType(type) {
  return CLASSIFIABLE_REGION_TYPES.has(type);
}

module.exports = {
  REGION_TYPES,
  GAP_REGION_TYPES,
  CLASSIFIABLE_REGION_TYPES,
  regionTypeForSection,
  makeRegion,
  sortedRegions,
  mergeAdjacentRegions,
  isGapRegionType,
  isClassifiableRegionType,
};
