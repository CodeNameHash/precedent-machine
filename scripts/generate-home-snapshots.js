#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEAL_TARGET = path.join(REPO_ROOT, 'lib/generated/home-deal-directory-v1.json');
const SEARCH_TARGET = path.join(REPO_ROOT, 'public/generated/home-search-index-v1.json');
const MAX_DEALS = 100;
const MAX_SEARCH_ENTRIES = 500;
const DEAL_SNAPSHOT_KEYS = [
  'id',
  'deal_name',
  'buyer_display',
  'target_display',
  'signing_date',
  'value',
  'value_band',
  'value_provenance',
  'consideration_type',
  'buyer_profile',
  'sector',
  'structure',
  'merger_form',
  'advisors',
];

function stableDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sizeBand(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B-$10B';
  return '>$10B';
}

function buildHomeSnapshots(payload) {
  if (!payload || !Array.isArray(payload.deals) || !Array.isArray(payload.search_index)) {
    throw new Error('source payload must contain deals and search_index arrays');
  }
  if (payload.deals.length > MAX_DEALS) {
    throw new Error(`deal snapshot exceeds ${MAX_DEALS} rows`);
  }

  const searchEntries = payload.search_index.filter((entry) => entry.type !== 'deal');
  if (searchEntries.length > MAX_SEARCH_ENTRIES) {
    throw new Error(`search snapshot exceeds ${MAX_SEARCH_ENTRIES} rows`);
  }
  if (searchEntries.some((entry) => !['provision', 'term'].includes(entry.type))) {
    throw new Error('search snapshot contains an unsupported entry type');
  }
  const deals = payload.deals.map((deal) => Object.fromEntries(
    DEAL_SNAPSHOT_KEYS.map((key) => [
      key,
      key === 'value_band' ? sizeBand(deal.value) : deal[key] ?? null,
    ]),
  ));

  return {
    dealSnapshot: {
      _meta: {
        schema_version: 'home-deal-directory/v1',
        deal_count: payload.deals.length,
        source_digest: stableDigest(deals),
      },
      deals,
    },
    searchSnapshot: {
      _meta: {
        schema_version: 'home-search-index/v1',
        entry_count: searchEntries.length,
        source_digest: stableDigest(searchEntries),
      },
      entries: searchEntries,
    },
  };
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeIfChanged(target, output, check) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (check && current !== output) throw new Error(`${path.relative(REPO_ROOT, target)} is stale`);
  if (!check && current !== output) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, output);
  }
  return current !== output;
}

function sourceArg(argv) {
  const index = argv.indexOf('--source');
  return index === -1 ? null : argv[index + 1];
}

async function fetchOfflineSource() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('offline generation requires --source or Supabase service environment variables');
  }
  const { createClient } = require('@supabase/supabase-js');
  const { fetchHomeData } = require('../lib/home-data');
  return fetchHomeData(createClient(url, key));
}

async function generate({ sourcePath = null, check = false } = {}) {
  const payload = sourcePath
    ? JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'))
    : await fetchOfflineSource();
  const { dealSnapshot, searchSnapshot } = buildHomeSnapshots(payload);
  const dealChanged = writeIfChanged(DEAL_TARGET, serialize(dealSnapshot), check);
  const searchChanged = writeIfChanged(SEARCH_TARGET, serialize(searchSnapshot), check);
  return {
    deal_changed: dealChanged,
    deal_count: dealSnapshot.deals.length,
    search_changed: searchChanged,
    search_count: searchSnapshot.entries.length,
  };
}

if (require.main === module) {
  generate({
    sourcePath: sourceArg(process.argv.slice(2)),
    check: process.argv.includes('--check'),
  }).then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}

module.exports = {
  DEAL_TARGET,
  DEAL_SNAPSHOT_KEYS,
  MAX_DEALS,
  MAX_SEARCH_ENTRIES,
  SEARCH_TARGET,
  buildHomeSnapshots,
  generate,
  serialize,
  sizeBand,
};
