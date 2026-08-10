#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayRun } from './stage-2y-resolution-set-diff.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = resolve(ROOT, 'evidence/canonical-v2');
const OUT = resolve(EVIDENCE, 'stage-2y-a-material-contracts-gate.json');
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ABSENT = /not found \(may not be present|not yet extracted|not specified|none specified/i;
const PINNED_RUNS = Object.freeze([
  'concho-material-contracts-20260809-2xk-final',
  'metsera-material-contracts-20260809-2xk-final',
  'modiv-material-contracts-20260809-2xk-final',
  'redhat-material-contracts-20260809-2xk-final',
  'skechers-material-contracts-20260809-2xk-final',
  'skywater-material-contracts-20260809-2xk-final',
  'topbuild-material-contracts-20260809-2xk-r3-final',
]);

function pinnedRuns() {
  return PINNED_RUNS.map((run) => {
    const manifestPath = resolve(EVIDENCE, run, 'run-manifest.json');
    const resolutionPath = resolve(EVIDENCE, run, 'resolution.json');
    const receiptPath = resolve(EVIDENCE, run, 'run-receipt.json');
    if (!existsSync(manifestPath) || !existsSync(resolutionPath) || !existsSync(receiptPath)) {
      throw new Error(`PINNED_RUN_MISSING:${run}`);
    }
    const manifest = json(manifestPath);
    if (manifest.section_family !== 'MATERIAL_CONTRACTS') throw new Error(`PINNED_RUN_WRONG_FAMILY:${run}`);
    const resolution = json(resolutionPath);
    const receipt = json(receiptPath);
    return { run, manifest, resolution, receipt };
  });
}

function hasContent(row) {
  return row.cells.some((cell) => {
    const text = String(cell.text || '').trim();
    return text && !ABSENT.test(text);
  });
}

const runs = pinnedRuns();
const items = [];
const deals = [];
for (const run of runs) {
  const signatures = new Set();
  const contentSignatures = new Set();
  for (const entry of run.resolution.resolved) {
    const preview = previewClaimSection({ run: { manifest: run.manifest, resolution: run.resolution }, resolved_entry: entry });
    const matches = preview.rows.filter((row) => row.matches_claim_key);
    if (matches.length !== 1) throw new Error(`ROW_MATCH_COUNT:${run.run}:${entry.claim.claim_revision_id}:${matches.length}`);
    const row = matches[0];
    const content = hasContent(row);
    const signature = canonicalJson({ id: row.id, cells: row.cells });
    signatures.add(signature);
    if (content) contentSignatures.add(signature);
    items.push({
      deal: run.manifest.deal,
      run: run.run,
      claim_revision_id: entry.claim.claim_revision_id,
      claim_definition_key: entry.resolved_claim_definition_key,
      collection: 'resolved',
      state: entry.claim.state,
      canonical_value: entry.claim.canonical_value,
      bucket_code: entry.claim.attributes?.bucket_code || null,
      row_id: row.id,
      renders_with_content: content,
    });
  }
  for (const [collection, entries] of [
    ['open_world', run.resolution.open_world],
    ['review', run.resolution.review_queue],
  ]) {
    for (const entry of entries) {
      const openWorld = collection === 'open_world';
      items.push({
        deal: run.manifest.deal,
        run: run.run,
        collection,
        item_id: entry.claim_revision_id || entry.closure_id || null,
        claim_revision_id: entry.claim_revision_id || null,
        claim_definition_key: entry.resolved_claim_definition_key || entry.claim_definition_key || null,
        state: openWorld ? 'OPEN_WORLD' : (entry.has_resolution ? 'RESOLVED_PENDING_REVIEW' : 'UNRESOLVED_REVIEW'),
        canonical_value: openWorld ? (entry.canonical_value ?? null) : null,
        bucket_code: openWorld ? (entry.attributes?.bucket_code || null) : null,
        raw_value: openWorld ? (entry.raw_value || null) : (entry.normalised_phrase || null),
        reason: openWorld ? (entry.reason || null) : null,
        reasons: openWorld ? [] : [...(entry.reasons || [])],
        has_resolution: openWorld ? null : Boolean(entry.has_resolution),
        row_id: null,
        renders_with_content: false,
      });
    }
  }
  const replay = await replayRun(run.run);
  const beforeOpenWorld = replay.committed.open_world.length;
  const afterOpenWorld = replay.replayed.open_world.length;
  if (afterOpenWorld > beforeOpenWorld) throw new Error(`OPEN_WORLD_RISE:${run.run}:${beforeOpenWorld}:${afterOpenWorld}`);
  const resolved = run.resolution.resolved.length;
  deals.push({
    deal: run.manifest.deal,
    run: run.run,
    attempted: run.resolution.review_queue.length,
    resolved,
    open_world: run.resolution.open_world.length,
    review: run.resolution.review_queue.length,
    resolved_claims_reaching_content: [...items].filter((item) => item.run === run.run && item.collection === 'resolved' && item.renders_with_content).length,
    distinct_rendered_rows_with_content: contentSignatures.size,
    unique_matched_rendered_rows: signatures.size,
    prior_identical_preview_signatures: resolved ? 1 : 0,
    prior_duplicate_rate: resolved ? (resolved - 1) / resolved : 0,
    matched_row_duplicate_rate: resolved ? (resolved - signatures.size) / resolved : 0,
    replay_open_world_before: beforeOpenWorld,
    replay_open_world_after: afterOpenWorld,
  });
}

for (const [deal, expected] of Object.entries({
  concho: [16, 6], metsera: [32, 15], modiv: [20, 10], redhat: [6, 4],
  skechers: [0, 0], skywater: [22, 8], topbuild: [20, 10],
})) {
  const row = deals.find((entry) => entry.deal === deal);
  if (!row || row.resolved !== expected[0] || row.unique_matched_rendered_rows !== expected[1]) {
    throw new Error(`COHORT_MISMATCH:${deal}:${JSON.stringify(row)}:${expected.join('/')}`);
  }
}
if (deals.some((row) => row.resolved_claims_reaching_content !== row.resolved)) throw new Error('RENDERED_CONTENT_GATE_FAILED');

const body = {
  schema_version: 'STAGE_2Y_A_MATERIAL_CONTRACTS_GATE/V1',
  generation_command: 'node scripts/stage-2y-a-material-contracts-gate.mjs --write',
  authority: 'REPORT_ONLY',
  publication_authorisation: 'NONE',
  existing_stage_2y_n_artefact_modified: false,
  family: 'MATERIAL_CONTRACTS',
  summary: {
    deal_count: deals.length,
    attempted: deals.reduce((sum, row) => sum + row.attempted, 0),
    resolved: deals.reduce((sum, row) => sum + row.resolved, 0),
    open_world: deals.reduce((sum, row) => sum + row.open_world, 0),
    review: deals.reduce((sum, row) => sum + row.review, 0),
    resolved_claims_reaching_content: deals.reduce((sum, row) => sum + row.resolved_claims_reaching_content, 0),
    distinct_rendered_rows_with_content: deals.reduce((sum, row) => sum + row.distinct_rendered_rows_with_content, 0),
    unique_matched_rendered_rows: deals.reduce((sum, row) => sum + row.unique_matched_rendered_rows, 0),
  },
  per_deal: deals,
  per_item: items,
};
const output = `${JSON.stringify({ ...body, gate_digest: digest(body) }, null, 2)}\n`;
if (process.argv.length !== 3 || process.argv[2] !== '--write') throw new Error('USAGE: --write');
writeFileSync(OUT, output);
if (readFileSync(OUT, 'utf8') !== output) throw new Error('STALE_OUTPUT');
process.stdout.write(`${OUT}\n`);
