const fs = require('fs');
const path = require('path');
const { getFeatures } = require('../feature-compare');

const REGISTRY_PATH = path.join(process.cwd(), 'docs/schema-shape/normalized-v1.json');

const DEAL_META_KEYS = new Map([
  ['deal_name', { key: 'deal_name', displayName: 'Deal name', type: 'string', aliases: ['deal_name'] }],
  ['signing_date', { key: 'signing_date', displayName: 'Signing date', type: 'date', aliases: ['signing_date'] }],
  ['total_deal_value', { key: 'total_deal_value', displayName: 'Total deal value', type: 'decimal', aliases: ['total_deal_value'] }],
  ['consideration_type', { key: 'consideration_type', displayName: 'Consideration type', type: 'string', aliases: ['consideration_type'] }],
  ['sector', { key: 'sector', displayName: 'Sector', type: 'string', aliases: ['sector'] }],
]);

let cachedRegistry = null;

function readRegistry(file = REGISTRY_PATH) {
  if (!cachedRegistry || cachedRegistry.file !== file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const byAlias = new Map();
    for (const entry of entries) {
      if (!entry || !entry.key) continue;
      const aliases = new Set([entry.key, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]);
      for (const alias of aliases) {
        const normalized = String(alias);
        if (!byAlias.has(normalized)) byAlias.set(normalized, entry);
      }
    }
    for (const [key, entry] of DEAL_META_KEYS) byAlias.set(key, entry);
    cachedRegistry = { file, parsed, entries, byAlias };
  }
  return cachedRegistry;
}

function entryForKey(key) {
  return readRegistry().byAlias.get(String(key || '').trim()) || null;
}

function resolveKey(key) {
  const requested = String(key || '').trim();
  const entry = entryForKey(requested);
  if (!entry) {
    const error = new Error(`BLOCKED_KEY_MISSING: ${requested}`);
    error.code = 'BLOCKED_KEY_MISSING';
    error.feature_key = requested;
    throw error;
  }
  return entry.key;
}

function aliasesForKey(key) {
  const entry = entryForKey(key);
  if (!entry) return [];
  return [...new Set([entry.key, ...(Array.isArray(entry.aliases) ? entry.aliases : [])])];
}

function featureEntry(key) {
  const entry = entryForKey(key);
  if (!entry) {
    const error = new Error(`BLOCKED_KEY_MISSING: ${String(key || '').trim()}`);
    error.code = 'BLOCKED_KEY_MISSING';
    error.feature_key = String(key || '').trim();
    throw error;
  }
  return entry;
}

function resolveFeatureValue(key, provision) {
  const entry = featureEntry(key);
  const features = getFeatures(provision);
  for (const candidate of aliasesForKey(entry.key)) {
    if (Object.prototype.hasOwnProperty.call(features, candidate)) {
      return { key: entry.key, raw: features[candidate], matchedKey: candidate, entry };
    }
  }
  return { key: entry.key, raw: undefined, matchedKey: null, entry };
}

function resetRegistryCache() {
  cachedRegistry = null;
}

module.exports = {
  aliasesForKey,
  entryForKey,
  featureEntry,
  readRegistry,
  resetRegistryCache,
  resolveFeatureValue,
  resolveKey,
};
