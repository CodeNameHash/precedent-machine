#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseCanonicalFile } = require('../../lib/schema-shape/parse-canonical');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_FILE = path.join(REPO_ROOT, 'docs/schema-shape/canonical-registry-v1.md');
const NORMALIZED_FILE = path.join(REPO_ROOT, 'docs/schema-shape/normalized-v1.json');
const FROZEN_REGISTRY_FILE = path.join(REPO_ROOT, 'docs/market-registry/FROZEN-v1.json');
const DEDUPED_REGISTRY_FILE = path.join(REPO_ROOT, 'docs/market-registry/generated-v1.deduped.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function uniqueSorted(values) {
  return [...new Set((values || []).filter((value) => value !== undefined && value !== null && value !== ''))].sort();
}

function registryFields(registry) {
  if (Array.isArray(registry)) return registry;
  if (Array.isArray(registry.fields)) return registry.fields;
  if (Array.isArray(registry.entries)) return registry.entries;
  throw new Error('Market registry has no fields or entries array');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
}

function buildNormalized() {
  const marketRegistryFile = fs.existsSync(FROZEN_REGISTRY_FILE) ? FROZEN_REGISTRY_FILE : DEDUPED_REGISTRY_FILE;
  const market = registryFields(readJson(marketRegistryFile));
  const existing = fs.existsSync(NORMALIZED_FILE) ? readJson(NORMALIZED_FILE) : null;
  const canonical = parseCanonicalFile(CANONICAL_FILE);

  const marketByKey = new Map(market.map((field) => [field.key, field]));
  const existingByKey = new Map((existing?.entries || []).map((entry) => [entry.key, entry]));

  const entries = canonical
    .map((shape) => {
      const field = marketByKey.get(shape.key) || {};
      const previous = existingByKey.get(shape.key) || {};
      const mergedFrom = Array.isArray(field.merged_from) ? field.merged_from : [];
      const absorbedKeys = mergedFrom.map((item) => item.key).filter(Boolean);
      const aliases = uniqueSorted([
        ...(shape.aliases || []),
        ...(previous.aliases || []),
        ...absorbedKeys,
      ]);

      return {
        key: shape.key,
        displayName: shape.displayName || field.label || previous.displayName || shape.name,
        type: shape.type || previous.type || field.data_type || 'unknown',
        aliases,
        sourceOfTruth: shape.sourceOfTruth || previous.sourceOfTruth || field.source_file || null,
        usedIn: shape.usedIn || previous.usedIn || [],
        benchmarkable: Boolean(shape.benchmarkable ?? previous.benchmarkable),
        stableAnchor: Boolean(shape.stableAnchor ?? previous.stableAnchor),
        enumValues: uniqueSorted([...(shape.enumValues || []), ...(previous.enumValues || [])]),
        provenance: {
          origin: field.origin || previous.provenance?.origin || null,
          originalDataType: field.data_type || previous.provenance?.originalDataType || null,
          appliesTo: field.applies_to || previous.provenance?.appliesTo || null,
          provisionCodes: uniqueSorted([
            ...(field.also_matches_provision_codes || []),
            ...(previous.provenance?.provisionCodes || []),
          ]),
          merged_from: mergedFrom,
          status: field.status || null,
        },
        sources: [
          {
            legacy_key: field.key || shape.key,
            deal_id: null,
            raw_value: null,
            source_file: field.source_file || null,
          },
          ...mergedFrom.map((item) => ({
            legacy_key: item.key,
            deal_id: null,
            raw_value: null,
            source_file: item.origin || null,
          })),
        ],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    version: existing?.version || 'v1.0.0',
    schema_version: existing?.schema_version || 1,
    generated_at: existing?.generated_at || null,
    generated_by: 'scripts/schema-shape/normalize.js',
    _meta: {
      source_files: [
        path.relative(REPO_ROOT, marketRegistryFile),
        'docs/schema-shape/canonical-registry-v1.md',
        ...(existing?._meta?.source_files || []),
      ].filter((value, index, array) => array.indexOf(value) === index),
      entry_count: entries.length,
      market_registry_field_count: market.length,
    },
    entries,
  };
}

function main() {
  const output = `${JSON.stringify(stable(buildNormalized()), null, 2)}\n`;
  const write = process.argv.includes('--write');
  if (write) {
    fs.writeFileSync(NORMALIZED_FILE, output);
    process.stdout.write(`Wrote ${path.relative(REPO_ROOT, NORMALIZED_FILE)}\n`);
    return;
  }
  process.stdout.write(output);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildNormalized,
  stable,
};
