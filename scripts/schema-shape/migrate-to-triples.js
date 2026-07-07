#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { loadDotEnvLocal } = require('../ingest-qa');
const { normalizeValue } = require('../../lib/schema-shape/normalize-value');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WORKLOG_FILE = 'WORKLOG-P0-C.md';
const PAGE_SIZE = 1000;

function isTriple(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'canonicalKey')
    && Object.prototype.hasOwnProperty.call(value, 'extractorRawValue')
    && Object.prototype.hasOwnProperty.call(value, 'sourceProvisionId');
}

function migrateValue(value, sourceProvisionId = null) {
  if (isTriple(value)) return value;
  if (typeof value === 'string') {
    return { canonicalKey: value, extractorRawValue: null, sourceProvisionId };
  }
  if (Array.isArray(value)) return value.map((item) => migrateValue(item, sourceProvisionId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, migrateValue(item, value.sourceProvisionId || sourceProvisionId)]));
  }
  return value;
}

function findDotEnvLocal() {
  let dir = process.cwd();
  while (dir && dir !== '/') {
    const candidate = `${dir}/.env.local`;
    if (fs.existsSync(candidate)) return candidate;
    dir = dir.replace(/\/[^/]+$/, '');
  }
  return null;
}

function getSupabase() {
  loadDotEnvLocal(findDotEnvLocal());
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase creds required (env / .env.local).');
  }
  return createClient(url, key);
}

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || String(error));
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function registryAliasIndex(entries = []) {
  const index = new Map();
  for (const entry of entries) {
    for (const key of [entry.key, ...(entry.aliases || [])]) {
      if (key) index.set(String(key), entry);
    }
  }
  return index;
}

function plain(value) {
  return String(value || '')
    .replace(/\[\[(?:\/)?[A-Z_]+(?:\]\])?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rawValues(value) {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(rawValues);
  if (typeof value === 'object') {
    for (const key of ['canonicalKey', 'code', 'value', 'text', 'label', 'summary']) {
      if (value[key] != null && typeof value[key] !== 'object') return [String(value[key])];
    }
    const compact = JSON.stringify(value);
    return compact && compact !== '{}' ? [compact] : [];
  }
  return [];
}

function evidenceQuote(fullText, rawValue) {
  const text = plain(fullText);
  const raw = plain(rawValue);
  if (!text) return '';
  const lowerText = text.toLowerCase();
  const lowerRaw = raw.toLowerCase();
  const index = lowerRaw.length >= 8 ? lowerText.indexOf(lowerRaw.slice(0, Math.min(lowerRaw.length, 80))) : -1;
  if (index >= 0) {
    const start = Math.max(0, index - 80);
    const end = Math.min(text.length, index + raw.length + 120);
    return text.slice(start, end).trim();
  }
  return text.slice(0, 220).trim();
}

function vocabRefForField(fieldKey) {
  const key = String(fieldKey || '');
  if (key === 'party_role' || /(^|\.)(party|payableBy|payableTo|restrictedParty|side|leadParty|extensionParty|controllingParty)$/i.test(key)) {
    return 'FROZEN-party_role-v1';
  }
  if (/triggerCode|triggerCodes|terminationTrigger|extensionTrigger/i.test(key)) {
    return 'FROZEN-triggerCode-v1';
  }
  return null;
}

function canonicalFor(fieldKey, rawValue, registryEntry = null) {
  const vocabRef = vocabRefForField(fieldKey);
  if (vocabRef) {
    const normalized = normalizeValue(rawValue, vocabRef);
    return normalized.canonicalKey === 'FREEFORM' ? null : normalized.canonicalKey;
  }
  const enumValues = registryEntry?.enumValues || [];
  const exact = enumValues.find((value) => String(value).toLowerCase() === String(rawValue).toLowerCase());
  if (exact) return exact;
  return null;
}

function tripleId(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function triplesFromProvision(provision, aliasIndex) {
  const metadata = provision.ai_metadata && typeof provision.ai_metadata === 'object' ? provision.ai_metadata : {};
  const features = metadata.features && typeof metadata.features === 'object' ? metadata.features : {};
  const triples = [];
  for (const [featureKey, featureValue] of Object.entries(features)) {
    const registryEntry = aliasIndex.get(featureKey);
    if (!registryEntry) continue;
    for (const rawValue of rawValues(featureValue)) {
      if (!rawValue) continue;
      const fieldKey = registryEntry.key;
      triples.push({
        id: tripleId([provision.deal_id, fieldKey, provision.id, rawValue]),
        deal_id: provision.deal_id,
        field_key: fieldKey,
        canonicalKey: canonicalFor(fieldKey, rawValue, registryEntry),
        raw_value: rawValue,
        source_provision_id: provision.id,
        evidence_quote: evidenceQuote(provision.full_text, rawValue),
        extractor_id: 'codex',
        extracted_at: provision.created_at || null,
        ai_metadata: {
          code: metadata.code || features.canonicalCode || null,
          feature_key: featureKey,
          feature_value: featureValue,
        },
      });
    }
  }
  return triples;
}

function migrateDocument(doc, triples = []) {
  const migrated = JSON.parse(JSON.stringify(doc));
  if (Array.isArray(migrated.entries)) {
    migrated.entries = migrated.entries.map((entry) => {
      const shouldMigrateValue = entry.vocab_ref || entry.sourceProvisionId;
      return {
        ...entry,
        value: shouldMigrateValue ? migrateValue(entry.value, entry.sourceProvisionId) : entry.value,
      };
    });
  }
  migrated._meta = {
    ...(migrated._meta || {}),
    stored_value_shape: 'triples-v1',
    migrated_by_phase: '0-C',
  };
  migrated.triples = triples.sort((a, b) => (
    a.deal_id.localeCompare(b.deal_id)
    || a.field_key.localeCompare(b.field_key)
    || a.raw_value.localeCompare(b.raw_value)
    || a.source_provision_id.localeCompare(b.source_provision_id)
  ));
  return migrated;
}

function appendWorklog(line) {
  const current = fs.existsSync(WORKLOG_FILE) ? fs.readFileSync(WORKLOG_FILE, 'utf8') : '# WORKLOG-P0-C\n';
  const next = current.includes(line) ? current : `${current.replace(/\s*$/, '')}\n\n${line}\n`;
  fs.writeFileSync(WORKLOG_FILE, next);
}

async function buildTriples(sb, normalized) {
  const deals = await fetchAllPages(() => sb.from('deals').select('id, acquirer, target, metadata').order('target', { ascending: true }));
  const dealIds = deals.map((deal) => deal.id).filter(Boolean);
  const provisions = dealIds.length
    ? await fetchAllPages(() => sb
      .from('provisions')
      .select('id, deal_id, full_text, ai_metadata, created_at')
      .in('deal_id', dealIds)
      .order('deal_id', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }))
    : [];
  const aliasIndex = registryAliasIndex(normalized.entries || []);
  const triples = provisions.flatMap((provision) => triplesFromProvision(provision, aliasIndex));
  return { deals, provisions, triples };
}

async function main() {
  const input = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const sb = getSupabase();
  const { deals, provisions, triples } = await buildTriples(sb, input);
  const outputDoc = migrateDocument(input, triples);
  const output = `${JSON.stringify(outputDoc, null, 2)}\n`;
  const dealCount = new Set(triples.map((triple) => triple.deal_id)).size;
  const line = `MIGRATE_TO_TRIPLES: ${triples.length} triples produced from ${provisions.length} provisions across ${dealCount} deals`;
  if (triples.length === 0 || dealCount < 4) {
    fs.writeFileSync('BLOCKED-P0-C.md', `# BLOCKED-P0-C\n\nStep 1 blocked: ${line}. Corpus deals available: ${deals.length}.\n`);
    throw new Error(line);
  }
  if (process.argv.includes('--write')) {
    fs.writeFileSync(NORMALIZED_FILE, output);
    appendWorklog(line);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  buildTriples,
  canonicalFor,
  evidenceQuote,
  isTriple,
  migrateDocument,
  migrateValue,
  rawValues,
  registryAliasIndex,
  triplesFromProvision,
  vocabRefForField,
};
