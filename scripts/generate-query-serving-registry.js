#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'docs/schema-shape/normalized-v1.json');
const TARGET_PATH = path.join(REPO_ROOT, 'lib/query/serving-registry-v1.json');

function buildServingRegistry(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('normalized registry must be an object');
  }
  if (!source._meta || typeof source._meta !== 'object' || Array.isArray(source._meta)) {
    throw new TypeError('normalized registry must contain _meta');
  }
  if (!Array.isArray(source.entries)) {
    throw new TypeError('normalized registry must contain entries');
  }
  return { _meta: source._meta, entries: source.entries };
}

function serializeServingRegistry(registry) {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

function generate({ check = false } = {}) {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const output = serializeServingRegistry(buildServingRegistry(source));
  if (check) {
    const current = fs.existsSync(TARGET_PATH) ? fs.readFileSync(TARGET_PATH, 'utf8') : null;
    if (current !== output) {
      throw new Error('Query serving registry is stale. Run npm run generate:query-registry.');
    }
    return { changed: false, bytes: Buffer.byteLength(output), entries: source.entries.length };
  }
  const current = fs.existsSync(TARGET_PATH) ? fs.readFileSync(TARGET_PATH, 'utf8') : null;
  if (current !== output) fs.writeFileSync(TARGET_PATH, output);
  return { changed: current !== output, bytes: Buffer.byteLength(output), entries: source.entries.length };
}

if (require.main === module) {
  try {
    const result = generate({ check: process.argv.includes('--check') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  SOURCE_PATH,
  TARGET_PATH,
  buildServingRegistry,
  generate,
  serializeServingRegistry,
};
