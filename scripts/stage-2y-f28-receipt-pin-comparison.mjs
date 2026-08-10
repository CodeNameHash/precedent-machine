#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = resolve(ROOT, 'tests/fixtures/canonical-v2/f28-third-live-run');
const OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-f28-receipt-pin-comparison-2026-08-11.json');
const GENERATION_COMMAND = 'node scripts/stage-2y-f28-receipt-pin-comparison.mjs --write';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const fileDigest = (file) => `sha256:${sha256Hex(readFileSync(file))}`;
const valueDigest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

function differences(before, after, pointer = '') {
  if (canonicalJson(before) === canonicalJson(after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    return Array.from({ length }, (_, index) => differences(before[index], after[index], `${pointer}/${index}`)).flat();
  }
  if (before && after && typeof before === 'object' && typeof after === 'object'
      && !Array.isArray(before) && !Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
      .flatMap((key) => differences(before[key], after[key], `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`));
  }
  return [{ json_pointer: pointer, committed_value: before, current_replay_value: after }];
}

function buildComparison() {
  const runReceiptPath = resolve(FIXTURE_DIR, 'run-receipt.json');
  const adapterResultPath = resolve(FIXTURE_DIR, 'adapter-result.json');
  const fixturePath = resolve(FIXTURE_DIR, 'resolution.json');
  const runReceipt = json(runReceiptPath);
  const adapterResult = json(adapterResultPath);
  const fixture = json(fixturePath);
  const replay = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV13(),
    admitted_source_context: adapterResult.admitted_source_contexts[0],
    agreement_date: '2026-04-18',
  });
  const fieldMeanings = {
    '/resolution_receipt/registry_substrate/modules/4/digest': 'interim-operating registry digest',
    '/resolution_receipt/resolution_receipt_id': 'content identity derived from the changed registry digest',
  };
  const changed = differences(fixture, replay).map((difference) => ({
    json_pointer: difference.json_pointer,
    field_meaning: fieldMeanings[difference.json_pointer] || null,
    committed_value: difference.committed_value,
    current_replay_value: difference.current_replay_value,
  }));
  return {
    schema_version: 'STAGE_2Y_F28_RECEIPT_PIN_COMPARISON/V1',
    authority: 'OFFLINE_COMPARISON_ONLY',
    publication_authorisation: 'NONE',
    generation_command: GENERATION_COMMAND,
    baseline_commit: '9b48148536ea3081f741148e57e26944c9231195',
    fixture: 'tests/fixtures/canonical-v2/f28-third-live-run/resolution.json',
    inputs: {
      fixture_sha256_before_repin: fileDigest(fixturePath),
      run_receipt_sha256: fileDigest(runReceiptPath),
      adapter_result_sha256: fileDigest(adapterResultPath),
    },
    comparison_method: 'Replay the committed run receipt and admitted source context through resolveCandidates with compileFixtureContractV13 and agreement_date 2026-04-18, then recursively compare the complete resolution object by JSON pointer.',
    differing_field_count: changed.length,
    differences: changed,
    unchanged_collections: Object.fromEntries(['resolved', 'review_queue', 'open_world', 'residuals']
      .map((key) => [key, valueDigest(replay[key])])),
    unchanged_counts: replay.resolution_receipt.counts,
    cause: {
      source: 'lib/vocab/resolution/interim-operating-registry.js',
      change_commit: '1401d7a3',
      description: 'Four byte-exact legacy restriction-category quote aliases were added to the interim-operating registry fingerprint. The F28 fixture has zero interim-operating restriction components, so only registry provenance and its dependent receipt identity moved.',
    },
    conclusion: 'Within F28, only registry provenance and its dependent receipt identity moved. Re-pinning is withheld because the separate seven-deal resolution-set comparison found broader semantic movement that requires human review.',
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('USAGE: use --write|--check');
  const output = `${JSON.stringify(buildComparison(), null, 2)}\n`;
  if (mode === '--write') writeFileSync(OUTPUT, output);
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== output) throw new Error(`STALE_OUTPUT:${OUTPUT}`);
  process.stdout.write(`${mode} ${OUTPUT}\n`);
}

export { buildComparison, differences };
