#!/usr/bin/env node
// Records what the committed baseline actually contains, per family.
//
// PLAN.md Stage 2's ladder compares each rung against the rung before it and
// stops the line when a count falls. That comparison needs a yardstick that
// is written down rather than recomputed from whichever runs happen to be on
// disk, because "recompute both sides" cannot detect a run that disappeared.
//
// Zero model calls, zero network. Reads committed run directories and, for
// each, re-derives what an import would publish -- not what the run CLAIMED
// it published. Those differ, and the difference is the whole point: a run
// whose validation.json says thirteen claims but which imports zero is the
// defect this manifest exists to make visible.
//
// Usage:
//   node scripts/canonical-v2-baseline-manifest.mjs
//   node scripts/canonical-v2-baseline-manifest.mjs --out <path>
//   node scripts/canonical-v2-baseline-manifest.mjs --check     (CI mode)
//
// --check re-derives and diffs against the committed manifest, exiting
// non-zero on any disagreement. It is the gate; the default invocation
// rewrites the file.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const {
  importRunEvidence,
} = require('../lib/canonical-v2/evidence-to-write-set-bridge');
const { InMemoryCanonicalRepository } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');

const DEFAULT_OUT = 'evidence/canonical-v2/baseline-manifest.json';
const COUNTED_COLLECTIONS = Object.freeze([
  'excerpts', 'provisions', 'claims', 'relationships', 'components',
  'definition_occurrences', 'condition_groups',
]);

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, check: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out') { args.out = argv[i += 1]; continue; }
    if (argv[i] === '--check') { args.check = true; continue; }
    throw new Error(`UNKNOWN_ARGUMENT: ${argv[i]}`);
  }
  return args;
}

function readJsonIfPresent(absolutePath) {
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
}

// Importable run directories only. A historical run that cannot rebuild its
// source chain is recorded as such rather than omitted: a family that
// silently vanished from the manifest is indistinguishable from one that was
// never there.
async function measureRun(runDirectory) {
  const manifest = readJsonIfPresent(path.join(runDirectory, 'run-manifest.json'));
  const resolution = readJsonIfPresent(path.join(runDirectory, 'resolution.json'));
  const row = {
    run: path.basename(runDirectory),
    section_family: (manifest && manifest.section_family) || null,
    section_references: (manifest && manifest.section_references) || null,
    model_call_count: manifest ? manifest.model_call_count : null,
    resolved: resolution ? (resolution.resolved || []).length : null,
    review_queue: resolution ? (resolution.review_queue || []).length : null,
    open_world: resolution ? (resolution.open_world || []).length : null,
    residuals: resolution ? (resolution.residuals || []).length : null,
    importable: false,
    import_refusal: null,
    published: null,
  };
  try {
    const result = await importRunEvidence({
      runDirectory,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    });
    const publishable = result.receipt.validation.publishableWriteSet;
    row.importable = true;
    row.published = Object.fromEntries(
      COUNTED_COLLECTIONS.map((key) => [key, (publishable[key] || []).length]),
    );
  } catch (error) {
    // The refusal CODE, not the message: messages carry absolute paths and
    // would make the manifest differ between machines for no real reason.
    row.import_refusal = error.code || 'UNKNOWN';
  }
  return row;
}

async function buildManifest() {
  const evidenceRoot = path.join(REPO_ROOT, 'evidence/canonical-v2');
  const runs = fs.readdirSync(evidenceRoot)
    .filter((entry) => fs.existsSync(path.join(evidenceRoot, entry, 'adapter-result.json')))
    .sort();
  const rows = [];
  for (const run of runs) {
    rows.push(await measureRun(path.join(evidenceRoot, run)));
  }
  const importable = rows.filter((row) => row.importable);
  const totals = Object.fromEntries(COUNTED_COLLECTIONS.map((key) => [
    key,
    importable.reduce((sum, row) => sum + row.published[key], 0),
  ]));
  return {
    schema_version: 'CANONICAL_V2_BASELINE_MANIFEST/V1',
    note: 'Re-derived by scripts/canonical-v2-baseline-manifest.mjs. Zero model calls. '
      + '`published` is what an import WOULD publish, which is not the same as what a run claimed.',
    run_count: rows.length,
    importable_run_count: importable.length,
    families_with_an_importable_run: [...new Set(
      importable.map((row) => row.section_family).filter(Boolean),
    )].sort(),
    totals,
    runs: rows,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = await buildManifest();
  const outPath = path.resolve(REPO_ROOT, args.out);
  const serialised = `${JSON.stringify(manifest, null, 2)}\n`;

  if (!args.check) {
    fs.writeFileSync(outPath, serialised);
    process.stderr.write(
      `[baseline] wrote ${args.out}: ${manifest.importable_run_count}/${manifest.run_count} importable, `
      + `${manifest.families_with_an_importable_run.length} families, `
      + `${manifest.totals.claims} claims\n`,
    );
    return;
  }

  if (!fs.existsSync(outPath)) {
    process.stderr.write(`[baseline] MISSING: ${args.out} does not exist; run without --check first\n`);
    process.exit(2);
  }
  const committed = fs.readFileSync(outPath, 'utf8');
  if (committed === serialised) {
    process.stderr.write(`[baseline] OK: ${args.out} matches what the evidence directories produce\n`);
    return;
  }
  // Name the disagreement rather than only reporting one. A bare "differs"
  // sends the reader to a two-thousand-line diff.
  const previous = JSON.parse(committed);
  const byRun = new Map(previous.runs.map((row) => [row.run, row]));
  for (const row of manifest.runs) {
    const before = byRun.get(row.run);
    if (!before) { process.stderr.write(`[baseline] NEW RUN: ${row.run}\n`); continue; }
    byRun.delete(row.run);
    if (JSON.stringify(before) !== JSON.stringify(row)) {
      process.stderr.write(
        `[baseline] CHANGED: ${row.run}\n  was ${JSON.stringify(before.published || before.import_refusal)}\n`
        + `  now ${JSON.stringify(row.published || row.import_refusal)}\n`,
      );
    }
  }
  for (const missing of byRun.keys()) {
    process.stderr.write(`[baseline] RUN DISAPPEARED: ${missing}\n`);
  }
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`[baseline] FAILED: ${error.stack || error.message}\n`);
  process.exit(1);
});
