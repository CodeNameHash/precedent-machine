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
const AUTHORITY_OUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-a-material-contracts-projection-authority-comparison.json');

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
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--write', '--write-authority-comparison'].includes(mode)) {
  throw new Error('USAGE: --write|--write-authority-comparison');
}
if (mode === '--write-authority-comparison') {
  const fieldDifferences = differences(before, after);
  const identityPath = /^(?:\$\.projection_id|\$\.claims\[0\]\.id|\$\.cards\[0\]\.(?:ai_metadata\.features|features)\.materialContractsBuckets\[0\]\.criteria\[0\]\.source_claim_revision_ids\[\d+\]|\$\.cards\[0\]\.canonical_v2_lineage\.(?:claim_revision_ids\[\d+\]|bucket_claim_revision_ids\.INDEBTEDNESS\[\d+\])|\$\.claims\[0\]\.(?:canonical\[0\]\.criteria\[0\]\.source_claim_revision_ids\[\d+\]|provenance\.source_claim_revision_ids\[\d+\]))$/;
  if (before.schema_version !== 'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_PROJECTION/V2'
    || after.schema_version !== before.schema_version
    || fieldDifferences.length === 0
    || fieldDifferences.some((row) => !identityPath.test(row.path))) {
    throw new Error('UNEXPECTED_AUTHORITY_COMPARISON_DIFF');
  }
  const authorityBody = {
    schema_version: 'STAGE_2Y_A_MATERIAL_CONTRACTS_PROJECTION_AUTHORITY_COMPARISON/V1',
    authority: 'OFFLINE_FIXTURE_COMPARISON_ONLY',
    publication_authorisation: 'NONE',
    generation_command: 'node scripts/stage-2y-a-material-contracts-pin-comparison.mjs --write-authority-comparison',
    fixture: 'tests/fixtures/review-parity/cases/material-contracts/landos-abbvie.projection.json',
    comparison: 'COMMITTED_V2_FIXTURE_TO_CURRENT_PROVIDER_RESOLVER_PROJECTION',
    before_digest: digest(before),
    after_digest: digest(after),
    counts: {
      before_cards: before.cards.length,
      after_cards: after.cards.length,
      before_claims: before.claims.length,
      after_claims: after.claims.length,
      before_open_items: before.open_items.length,
      after_open_items: after.open_items.length,
    },
    stable_semantics: {
      schema_unchanged: before.schema_version === after.schema_version,
      deal_id_unchanged: before.deal_id === after.deal_id,
      card_identity_unchanged: before.cards[0].id === after.cards[0].id,
      provision_identity_unchanged: before.cards[0].provision_instance_id === after.cards[0].provision_instance_id,
      bucket_code_unchanged: before.cards[0].features.materialContractsBuckets[0].code === after.cards[0].features.materialContractsBuckets[0].code,
      bucket_text_unchanged: before.cards[0].features.materialContractsBuckets[0].text === after.cards[0].features.materialContractsBuckets[0].text,
      threshold_unchanged: before.cards[0].features.materialContractsBuckets[0].threshold === after.cards[0].features.materialContractsBuckets[0].threshold,
      exclusions_unchanged: canonicalJson(before.cards[0].features.materialContractsBuckets[0].scope_exclusions)
        === canonicalJson(after.cards[0].features.materialContractsBuckets[0].scope_exclusions),
    },
    cause: 'The corrected provider keeps a historical response field absent when no byte-explicit parenthetical exclusion exists. It no longer normalises that absence to an explicit empty array.',
    expected_changes: [
      'Historical claim revision identities return to their pre-normalisation values.',
      'Dependent feature-claim and projection identities return to values derived from those claim identities.',
      'No rendered value, state, source text, bucket, threshold or exclusion changes.',
    ],
    field_differences: fieldDifferences,
  };
  const authorityOutput = `${JSON.stringify({ ...authorityBody, comparison_digest: digest(authorityBody) }, null, 2)}\n`;
  writeFileSync(AUTHORITY_OUT, authorityOutput);
  if (readFileSync(AUTHORITY_OUT, 'utf8') !== authorityOutput) throw new Error('STALE_OUTPUT');
  process.stdout.write(`${AUTHORITY_OUT}\n`);
  process.exit(0);
}
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
writeFileSync(OUT, output);
if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== output) throw new Error('STALE_OUTPUT');
process.stdout.write(`${OUT}\n`);
