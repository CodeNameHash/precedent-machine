#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildLandosProjection } = require('./review-parity-build-cases');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PIN = resolve(ROOT, 'tests/fixtures/review-parity/cases/material-contracts/landos-abbvie.projection.json');
const OUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-a-material-contracts-projection-pin-comparison.json');

function digest(value) {
  return `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
}

function differences(before, after, path = '$', rows = []) {
  if (before === undefined || after === undefined) {
    rows.push({
      path,
      before: before === undefined ? { field_absent: true } : before,
      after: after === undefined ? { field_absent: true } : after,
    });
    return rows;
  }
  if (canonicalJson(before) === canonicalJson(after)) return rows;
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object') {
    rows.push({ path, before, after });
    return rows;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) rows.push({ path, before, after });
    else {
      const length = Math.max(before.length, after.length);
      for (let index = 0; index < length; index += 1) differences(before[index], after[index], `${path}[${index}]`, rows);
    }
    return rows;
  }
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    differences(before[key], after[key], `${path}.${key}`, rows);
  }
  return rows;
}

const before = JSON.parse(readFileSync(PIN, 'utf8'));
const { projection: after } = await buildLandosProjection();
const body = {
  schema_version: 'STAGE_2Y_A_MATERIAL_CONTRACTS_PROJECTION_PIN_COMPARISON/V1',
  authority: 'OFFLINE_FIXTURE_COMPARISON_ONLY',
  publication_authorisation: 'NONE',
  generation_command: 'node scripts/stage-2y-a-material-contracts-pin-comparison.mjs --write',
  fixture: 'tests/fixtures/review-parity/cases/material-contracts/landos-abbvie.projection.json',
  before_digest: digest(before),
  after_digest: digest(after),
  before_schema: before.schema_version,
  after_schema: after.schema_version,
  counts: {
    before_cards: before.cards.length,
    after_cards: after.cards.length,
    before_claims: before.claims.length,
    after_claims: after.claims.length,
    before_open_items: before.open_items.length,
    after_open_items: after.open_items.length,
  },
  stable_semantics: {
    deal_id_unchanged: before.deal_id === after.deal_id,
    card_identity_unchanged: before.cards[0].id === after.cards[0].id,
    provision_identity_unchanged: before.cards[0].provision_instance_id === after.cards[0].provision_instance_id,
    bucket_code_unchanged: before.cards[0].features.materialContractsBuckets[0].code === after.cards[0].features.materialContractsBuckets[0].code,
    bucket_text_unchanged: before.cards[0].features.materialContractsBuckets[0].text === after.cards[0].features.materialContractsBuckets[0].text,
    threshold_unchanged: before.cards[0].features.materialContractsBuckets[0].threshold === after.cards[0].features.materialContractsBuckets[0].threshold,
  },
  expected_changes: [
    'Projection schema V1 to V2.',
    'Prompt V3 adds explicit empty scope exclusions, so claim revision identities move while value, state and source text stay fixed.',
    'Bucket criterion detail and bucket-level claim lineage become explicit.',
    'Dependent feature-claim and projection identities move.',
  ],
  field_differences: differences(before, after),
};
const output = `${JSON.stringify({ ...body, comparison_digest: digest(body) }, null, 2)}\n`;
if (process.argv.length !== 3 || process.argv[2] !== '--write') throw new Error('USAGE: --write');
writeFileSync(OUT, output);
if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== output) throw new Error('STALE_OUTPUT');
process.stdout.write(`${OUT}\n`);
