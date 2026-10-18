#!/usr/bin/env node
'use strict';

// Work package E1 item 3 (plan finding (167), implementer E): the
// three-section ablation (lib/product/cost-ablation.js). One stored
// run's sections extracted again under a variant of the request profile
// and the model; the facts compared on the bytes with the stored facts;
// tokens, seconds and dollars beside them. Routing and residual answers
// come from the stored calls; only the extraction of a live variant calls
// the API, through the hosted provider with the variant's profile and
// models, and every live answer is recorded for replay. The manager runs
// the live variants on the implementer's word (ANTHROPIC_API_KEY in the
// environment, never printed); nothing here submits, wakes or writes a run.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/cost-ablation.js --run <run-id> --sections 3.19,5.2,5.17 --dump-snapshot ablation-rows.json
//   node scripts/product/cost-ablation.js --snapshot ablation-rows.json --sections 3.19,5.2,5.17 --variant baseline --out table.md
//   ANTHROPIC_API_KEY=... node scripts/product/cost-ablation.js --snapshot ablation-rows.json --sections 3.19,5.2,5.17 --variant format,anchors,lean --live --record recording.json --out table.md --json results.json
//   node scripts/product/cost-ablation.js --snapshot ablation-rows.json --sections ... --variant lean --recording recording.json --out table.md   (replays the recorded answers, no call)
//   ... --analysis-dir ablation-analysis   writes stored.analysis.json and <variant>.analysis.json in the analysis read's shape, for
//   node scripts/product/compare-generations.js --v1-file ablation-analysis/stored.analysis.json --v2-file ablation-analysis/lean.analysis.json --out lean-vs-stored.md

const fs = require('node:fs');
const { ABLATION_VARIANTS, analysisFromResults, analysisFromStoredRows, createRecorder, renderAblationTable, runSectionAblation } = require('../../lib/product/cost-ablation');
const path = require('node:path');
const { createEnvironmentClient, loadRunContext, loadTableRows, readRunSnapshot, writeRunSnapshot } = require('../../lib/product/run-rows');

function parseArgs(argv) {
  const args = { run: null, snapshot: null, sections: [], variants: [], live: false, record: null, recording: null, out: null, json: null, dumpSnapshot: null, analysisDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--snapshot') args.snapshot = argv[i += 1];
    else if (argv[i] === '--sections') args.sections = String(argv[i += 1] || '').split(',').map((item) => item.trim()).filter(Boolean);
    else if (argv[i] === '--variant') args.variants = String(argv[i += 1] || '').split(',').map((item) => item.trim()).filter(Boolean);
    else if (argv[i] === '--live') args.live = true;
    else if (argv[i] === '--record') args.record = argv[i += 1];
    else if (argv[i] === '--recording') args.recording = argv[i += 1];
    else if (argv[i] === '--out') args.out = argv[i += 1];
    else if (argv[i] === '--json') args.json = argv[i += 1];
    else if (argv[i] === '--dump-snapshot') args.dumpSnapshot = argv[i += 1];
    else if (argv[i] === '--analysis-dir') args.analysisDir = argv[i += 1];
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  if ((!args.run && !args.snapshot) || !args.sections.length) { console.error('usage: cost-ablation.js (--run <id> | --snapshot <file>) --sections a,b,c [--variant name,...] [--live] [--record file] [--recording file] [--out table.md] [--json results.json] [--dump-snapshot file]'); process.exit(64); }
  for (const name of args.variants) if (!ABLATION_VARIANTS[name]) { console.error(`unknown variant ${name}; known: ${Object.keys(ABLATION_VARIANTS).join(', ')}`); process.exit(64); }
  return args;
}

// The rows the ablation needs for the named sections: the run's closures
// and spans whole (the node ids come from the closures), the calls, work,
// proposals, components and headlines of those sections only.
async function loadAblationRows(client, runId, sections) {
  const context = await loadRunContext(client, runId);
  const closures = await loadTableRows(client, 'product_source_closures', runId);
  const nodeIds = closures.filter((closure) => sections.includes(closure.section_reference)).map((closure) => closure.structure_node_id);
  const missing = sections.filter((reference) => !closures.some((closure) => closure.section_reference === reference));
  if (missing.length) throw new Error(`sections not in the run: ${missing.join(', ')}`);
  const proposals = await loadTableRows(client, 'product_proposals', runId, { filter: { structure_node_id: nodeIds } });
  const proposalIds = proposals.map((row) => row.proposal_id);
  return {
    run_id: runId,
    tables: {
      product_analysis_runs: [context.run],
      product_source_closures: closures,
      product_source_spans: await loadTableRows(client, 'product_source_spans', runId),
      product_section_work: await loadTableRows(client, 'product_section_work', runId, { filter: { node_id: nodeIds } }),
      product_section_routings: await loadTableRows(client, 'product_section_routings', runId, { filter: { structure_node_id: nodeIds } }),
      product_model_calls: await loadTableRows(client, 'product_model_calls', runId, { filter: { structure_node_id: nodeIds } }),
      product_proposals: proposals,
      product_fact_components: proposalIds.length ? await loadTableRows(client, 'product_fact_components', runId, { filter: { proposal_id: proposalIds } }) : [],
      product_fact_headlines: proposalIds.length ? await loadTableRows(client, 'product_fact_headlines', runId, { filter: { proposal_id: proposalIds } }) : [],
    },
    context,
  };
}

function liveModelFactory() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('--live needs ANTHROPIC_API_KEY in the environment');
  const { createAnthropicApiProductModel } = require('../../lib/product/anthropic-api-model');
  return ({ profile, callKindModels, modelConfig }) => createAnthropicApiProductModel({ modelConfig, requestProfile: profile, callKindModels });
}

// The visible answer's tokens as the API counts them (count_tokens is not
// billed), for the thinking share measured per call; the same client
// options as the provider (the key and the workspace header), never read
// or printed here.
function tokenCounterFromEnvironment() {
  const { clientOptions } = require('../../lib/product/anthropic-api-model');
  const AnthropicModule = require('@anthropic-ai/sdk');
  const Anthropic = AnthropicModule.default || AnthropicModule;
  const client = new Anthropic(clientOptions({ apiKey: process.env.ANTHROPIC_API_KEY, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID }));
  return async (text, model) => {
    const counted = await client.messages.countTokens({ model, messages: [{ role: 'user', content: text }] });
    return Number.isInteger(counted?.input_tokens) ? counted.input_tokens : null;
  };
}

async function main(argv) {
  const args = parseArgs(argv);
  let run;
  if (args.snapshot) {
    run = readRunSnapshot(args.snapshot);
    if (!run.context) throw new Error(`${args.snapshot} carries no context; dump it with --run <id> --dump-snapshot`);
  } else {
    run = await loadAblationRows(createEnvironmentClient(), args.run, args.sections);
  }
  if (args.dumpSnapshot) { writeRunSnapshot(args.dumpSnapshot, run); console.log(`wrote ${args.dumpSnapshot}`); }
  if (!args.variants.length) return [];
  const recorder = createRecorder(args.recording ? JSON.parse(fs.readFileSync(args.recording, 'utf8')).calls : []);
  const factory = args.live ? liveModelFactory() : null;
  const tokenCounter = args.live ? tokenCounterFromEnvironment() : null;
  const ablations = [];
  if (args.analysisDir) {
    fs.mkdirSync(args.analysisDir, { recursive: true });
    const nodeIds = (run.tables.product_source_closures || []).filter((closure) => args.sections.includes(closure.section_reference)).map((closure) => closure.structure_node_id);
    fs.writeFileSync(path.join(args.analysisDir, 'stored.analysis.json'), `${JSON.stringify({ analysis: analysisFromStoredRows({ run, nodeIds, label: 'stored' }) })}\n`);
  }
  for (const variantName of args.variants) {
    const ablation = await runSectionAblation({
      run, sections: args.sections, variantName, liveModelFactory: factory, recorder, tokenCounter,
      log: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
    });
    ablations.push(ablation);
    if (args.record) fs.writeFileSync(args.record, `${JSON.stringify({ schema_version: 'PRODUCT_MODEL_RECORDING/V1', calls: recorder.entries() })}\n`);
    if (args.analysisDir) {
      const results = ablation.sections.map((section) => section.result).filter(Boolean);
      fs.writeFileSync(path.join(args.analysisDir, `${variantName}.analysis.json`), `${JSON.stringify({ analysis: analysisFromResults({ run, results, label: variantName }) })}\n`);
    }
  }
  const table = renderAblationTable(ablations);
  if (args.out) { fs.writeFileSync(args.out, `${table}\n`); console.log(`wrote ${args.out}`); } else console.log(table);
  if (args.json) {
    const slim = ablations.map((ablation) => ({ ...ablation, recording: undefined, sections: ablation.sections.map(({ result: _result, ...section }) => section) }));
    fs.writeFileSync(args.json, `${JSON.stringify(slim, null, 2)}\n`);
    console.log(`wrote ${args.json}`);
  }
  return ablations;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { loadAblationRows, main, parseArgs };
