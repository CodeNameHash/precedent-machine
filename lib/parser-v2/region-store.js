const crypto = require('crypto');

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function regionTextHash(text) {
  return sha1(normalizeText(text));
}

function regionKeyFromParts({ type, start, end, sectionNumber, title }) {
  return sha1([
    type || '',
    Number(start) || 0,
    Number(end) || 0,
    sectionNumber || '',
    title || '',
  ].join('|')).slice(0, 24);
}

function regionKey(region) {
  if (!region || typeof region !== 'object') return null;
  return regionKeyFromParts({
    type: region.type,
    start: region.start,
    end: region.end,
    sectionNumber: region.sectionNumber,
    title: region.title,
  });
}

function sectionEnd(section) {
  if (!section || typeof section !== 'object') return 0;
  if (typeof section.endChar === 'number') return section.endChar;
  const start = typeof section.startChar === 'number' ? section.startChar : (section.start || 0);
  const text = section.text || section.body || '';
  return start + String(text).length;
}

function regionKeyForSection(section) {
  if (!section || typeof section !== 'object') return null;
  const start = typeof section.startChar === 'number' ? section.startChar : (section.start || 0);
  return regionKeyFromParts({
    type: section.regionType || 'body.section.provision',
    start,
    end: sectionEnd(section),
    sectionNumber: section.number || section.sectionNumber || null,
    title: section.title || section.heading || null,
  });
}

function regionFromSection(section) {
  if (!section || typeof section !== 'object') return null;
  const start = typeof section.startChar === 'number' ? section.startChar : (section.start || 0);
  const end = sectionEnd(section);
  if (!(end > start)) return null;
  return {
    source: 'section',
    type: section.regionType || 'body.section.provision',
    start,
    end,
    sectionNumber: section.number || section.sectionNumber || null,
    title: section.title || section.heading || null,
    atomic: !!section.atomic,
    atomicReason: section.atomicReason || null,
    articleNumber: section.articleNumber || null,
    needsDoubleDummyModel: !!section.needsDoubleDummyModel,
  };
}

function rowForRegion(dealId, fullText, region) {
  const key = regionKey(region);
  const rawText = String(fullText || '').slice(region.start, region.end);
  return {
    deal_id: dealId,
    region_key: key,
    region_type: region.type,
    start_char: region.start,
    end_char: region.end,
    section_ref: region.sectionNumber || null,
    title: region.title || null,
    raw_text: rawText,
    text_hash: regionTextHash(rawText),
    atomic: !!region.atomic,
    atomic_reason: region.atomicReason || null,
    metadata: {
      source: region.source || null,
      articleNumber: region.articleNumber || null,
      needsDoubleDummyModel: !!region.needsDoubleDummyModel,
    },
    updated_at: new Date().toISOString(),
  };
}

function rowsForParserRegions(dealId, fullText, regions, sections) {
  const byKey = new Map();
  for (const region of regions || []) {
    if (!region || !(region.end > region.start) || !region.type) continue;
    const row = rowForRegion(dealId, fullText, region);
    byKey.set(row.region_key, row);
  }
  for (const section of sections || []) {
    const region = regionFromSection(section);
    if (!region) continue;
    const row = rowForRegion(dealId, fullText, region);
    byKey.set(row.region_key, row);
  }
  return [...byKey.values()];
}

function attachRegionIdsToSections(sections, persistedRows) {
  const byKey = new Map();
  for (const row of persistedRows || []) {
    const key = row.region_key || row.regionKey;
    if (!key) continue;
    byKey.set(key, row.id || row.region_id || row.regionId || null);
  }
  return (sections || []).map((section) => {
    const key = regionKeyForSection(section);
    const id = key ? byKey.get(key) : null;
    return {
      ...section,
      regionKey: key,
      ...(id ? { regionId: id, region_id: id } : {}),
    };
  });
}

async function persistParserRegions(sb, dealId, fullText, regions, sections) {
  if (!sb || !dealId) {
    return { rows: [], skipped: true };
  }
  const rows = rowsForParserRegions(dealId, fullText, regions, sections);
  if (rows.length === 0) return { rows: [], skipped: true };

  const { data, error } = await sb
    .from('parser_regions')
    .upsert(rows, { onConflict: 'deal_id,region_key' })
    .select('id,region_key');

  if (error) {
    const missing = /parser_regions|schema cache|does not exist|Could not find/i.test(error.message || '');
    if (missing) {
      console.warn('[region-store] parser_regions table missing; classified_sections will not carry region_id.');
      return { rows: [], skipped: true, error: error.message };
    }
    throw new Error(`Failed to persist parser regions: ${error.message}`);
  }

  return { rows: data || [], skipped: false };
}

module.exports = {
  attachRegionIdsToSections,
  normalizeText,
  persistParserRegions,
  regionKey,
  regionKeyForSection,
  regionFromSection,
  regionTextHash,
  rowsForParserRegions,
};
