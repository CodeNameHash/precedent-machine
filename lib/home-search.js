const SEARCH_THRESHOLD = 2;
const SEARCH_SNAPSHOT_URL = '/generated/home-search-index-v1.json';
const SEARCH_SCHEMA_VERSION = 'home-search-index/v1';
const MAX_SEARCH_ENTRIES = 500;
const SEARCH_ENTRY_KEYS = ['type', 'label', 'detail', 'href'];

function shouldLoadHomeSearchIndex(query) {
  return String(query || '').trim().length >= SEARCH_THRESHOLD;
}

function dealSearchHits(deals) {
  return (deals || []).map((deal) => ({
    type: 'deal',
    label: deal.deal_name,
    detail: [deal.sector, deal.signing_date].filter(Boolean).join(' · '),
    href: `/review/${deal.id}`,
  }));
}

function homeSearchSuggestions(query, deals, searchEntries, limit = 15) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < SEARCH_THRESHOLD) return [];
  return [...dealSearchHits(deals), ...(searchEntries || [])]
    .filter((hit) => `${hit.label} ${hit.detail}`.toLowerCase().includes(q))
    .slice(0, limit);
}

function validateHomeSearchSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('home search snapshot must be an object');
  }
  const keys = Object.keys(snapshot).sort();
  if (keys.length !== 2 || keys[0] !== '_meta' || keys[1] !== 'entries') {
    throw new Error('home search snapshot has an invalid field set');
  }
  if (!snapshot._meta || snapshot._meta.schema_version !== SEARCH_SCHEMA_VERSION) {
    throw new Error(`home search snapshot must use ${SEARCH_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(snapshot.entries) || snapshot.entries.length > MAX_SEARCH_ENTRIES) {
    throw new Error(`home search snapshot exceeds ${MAX_SEARCH_ENTRIES} entries`);
  }
  if (snapshot._meta.entry_count !== snapshot.entries.length) {
    throw new Error('home search snapshot count does not match its entries');
  }
  snapshot.entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`search entry ${index} must be an object`);
    }
    const entryKeys = Object.keys(entry).sort();
    const wanted = [...SEARCH_ENTRY_KEYS].sort();
    if (entryKeys.length !== wanted.length || entryKeys.some((key, keyIndex) => key !== wanted[keyIndex])) {
      throw new Error(`search entry ${index} has an invalid field set`);
    }
    if (!['provision', 'term'].includes(entry.type)) {
      throw new Error(`search entry ${index} has an unsupported type`);
    }
    for (const key of ['label', 'detail', 'href']) {
      if (typeof entry[key] !== 'string' || !entry[key]) {
        throw new Error(`search entry ${index}.${key} must be a non-empty string`);
      }
    }
  });
  return snapshot;
}

module.exports = {
  MAX_SEARCH_ENTRIES,
  SEARCH_ENTRY_KEYS,
  SEARCH_SCHEMA_VERSION,
  SEARCH_SNAPSHOT_URL,
  SEARCH_THRESHOLD,
  dealSearchHits,
  homeSearchSuggestions,
  shouldLoadHomeSearchIndex,
  validateHomeSearchSnapshot,
};
