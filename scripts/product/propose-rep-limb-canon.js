#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/propose-rep-limb-canon.js — Q5's AI pass.

   Takes the harvest JSON of scripts/product/harvest-rep-limbs.js --json
   and asks the model, one request per representation row, for a canonical
   limb list with sub-representations grouped under a category where the
   names share a subject (Ben, 2026-10-18: "we need to get to canonical
   (and perhaps some of them are sub reps under a category) - wait untiil
   we have a few deals and see if we can AI it?"). Writes the proposal
   note for Ben's decision. Nothing in the table shapes changes.

   Modes:
     --dry-run       write every request with its call key and the cost
                     estimate to --out-dir; no call is made (the default)
     --recorded <f>  answer every request from a PRODUCT_MODEL_RECORDING/V1
                     file (the tests' path, and a replay of a live pass)
     --live          call the Anthropic API provider through the existing
                     adapter (ANTHROPIC_API_KEY, optional
                     ANTHROPIC_WORKSPACE_ID, on the machine that runs it)
                     and record every answer to --out-dir/recording.json
                     so the pass replays without a second call

   Usage:
     node scripts/product/propose-rep-limb-canon.js --harvest <harvest.json> --out-dir <dir> [--dry-run | --recorded <file> | --live] [--rows "Taxes; Tax Returns,..."]
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildRequests, estimateCost, recordingEntry, renderNote, runPass } = require('../../lib/product/rep-limb-canon');
const { createRecordedModelAdapter } = require('../../lib/product/model-adapter');

function parseArguments(argv) {
  const options = { harvest: null, outDir: null, mode: 'dry-run', recorded: null, rows: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--harvest') { options.harvest = next; index += 1; continue; }
    if (argument === '--out-dir') { options.outDir = next; index += 1; continue; }
    if (argument === '--dry-run') { options.mode = 'dry-run'; continue; }
    if (argument === '--live') { options.mode = 'live'; continue; }
    if (argument === '--recorded') { options.mode = 'recorded'; options.recorded = next; index += 1; continue; }
    if (argument === '--rows') { options.rows = String(next).split(',').map((row) => row.trim()).filter(Boolean); index += 1; continue; }
    throw new TypeError(`unknown argument: ${argument}`);
  }
  if (!options.harvest || !options.outDir) throw new TypeError('usage: propose-rep-limb-canon.js --harvest <harvest.json> --out-dir <dir> [--dry-run | --recorded <file> | --live] [--rows <labels>]');
  if (options.mode === 'recorded' && !options.recorded) throw new TypeError('--recorded needs a recording file');
  return options;
}

function liveAdapter() {
  const { createAnthropicApiProductModel } = require('../../lib/product/anthropic-api-model');
  return createAnthropicApiProductModel();
}

// A live pass's adapter that also keeps every answer for the recording.
function recordingAdapter(inner, entries) {
  return {
    async complete(input) {
      const call = await inner.complete(input);
      entries.push({ input, call });
      return call;
    },
  };
}

async function runProposeRepLimbCanon(options, dependencies = {}, output = process.stdout) {
  const harvest = JSON.parse(fs.readFileSync(options.harvest, 'utf8'));
  let requests = buildRequests(harvest);
  if (options.rows) {
    const wanted = new Set(options.rows);
    requests = requests.filter((entry) => wanted.has(entry.row_label));
  }
  const estimate = estimateCost(requests);
  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(path.join(options.outDir, 'requests.json'), `${JSON.stringify({ schema_version: 'PRODUCT_REP_LIMB_CANON_REQUESTS/V1', harvest: path.basename(options.harvest), estimate, requests }, null, 2)}\n`);
  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const harvestLabel = `${path.basename(options.harvest)} (${(harvest.runs || []).map((run) => run.label || run.run_id).join('; ') || 'runs not named'})`;
  if (options.mode === 'dry-run') {
    output.write(`dry run: ${requests.length} requests written, no call made; estimate $${estimate.total_usd} (${estimate.input_tokens} in, ${estimate.output_tokens} out at ${estimate.model_id})\n`);
    return { requests, estimate, results: null };
  }
  const recorded = [];
  let adapter;
  if (options.mode === 'recorded') {
    adapter = createRecordedModelAdapter(JSON.parse(fs.readFileSync(options.recorded, 'utf8')));
  } else {
    adapter = recordingAdapter(dependencies.liveAdapter ? dependencies.liveAdapter() : liveAdapter(), recorded);
  }
  const results = await runPass(requests, adapter);
  if (options.mode === 'live') {
    const recording = { schema_version: 'PRODUCT_MODEL_RECORDING/V1', calls: recorded.map(({ input, call }) => recordingEntry(requests.find((entry) => entry.input === input), call)) };
    fs.writeFileSync(path.join(options.outDir, 'recording.json'), `${JSON.stringify(recording, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(options.outDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  fs.writeFileSync(path.join(options.outDir, 'proposal.md'), `${renderNote({ results, estimate, generatedAt, harvestLabel })}\n`);
  const withProblems = results.filter((result) => result.problems.length).length;
  output.write(`${results.length} rows answered (${options.mode}), ${withProblems} with problems; cost as recorded $${(results.reduce((sum, result) => sum + (result.cost_microusd || 0), 0) / 1e6).toFixed(2)} -> ${path.join(options.outDir, 'proposal.md')}\n`);
  return { requests, estimate, results };
}

async function main() {
  try {
    await runProposeRepLimbCanon(parseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { parseArguments, runProposeRepLimbCanon };
