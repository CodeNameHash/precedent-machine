'use strict';

// Q5's AI pass (Ben, 2026-10-18: "Q5 - we need to get to canonical (and
// perhaps some of them are sub reps under a category) - wait untiil we
// have a few deals and see if we can AI it?"). Takes the harvest of
// scripts/product/harvest-rep-limbs.js (plan finding (120)) and asks the
// model, one request per representation row, for a canonical limb list
// with sub-representations grouped under a category where the names share
// a subject, every harvested name mapped to one proposed limb. The answer
// is a proposal for Ben's decision; nothing here writes the table shapes.
//
// The request goes through the existing adapters (lib/product/model-adapter.js):
// the Anthropic API provider when the manager runs the live pass, a
// PRODUCT_MODEL_RECORDING/V1 file in the recorded mode the tests and the
// dry run use. A dry run writes every request with its call key and the
// cost estimate and makes no call.

const { canonicalJson } = require('../canonical-v2/canonical-bytes');
const { callKey } = require('./model-adapter');
const { ANTHROPIC_API_PRICES } = require('./product-model-config');

const PROMPT_VERSION = 'PRODUCT_REP_LIMB_CANON/V1';
// The API adapter chooses its model tier by call kind
// (product-model-config.js ANTHROPIC_API_CALL_KIND_MODELS: EXTRACTION is
// claude-opus-5 at high effort). The pass reads as an extraction-tier
// call so the shared call-kind map, which the hosted worker compares
// against every run's stored config, is not widened for it.
const CALL_KIND = 'EXTRACTION';
const MODEL_ID = 'claude-opus-5';

// What the model is asked. Fixed words, so the call key of a request is
// the harvest row's content alone and a recorded answer replays exactly.
const INSTRUCTIONS = [
  'You are naming the limbs of one representation in merger agreements so that the same limb carries the same name in every deal and can be compared across deals.',
  'You are given the representation row, the canonical limb names already decided for it (possibly none), and the limb names an extractor gave to facts of this representation across several deals, each with how often it was used and one example fact summary per name.',
  'Propose the canonical list for this representation: one canonical name per limb, in the style of the decided names (a noun phrase naming the limb, never the agreement\'s own words, never a deal\'s particulars such as a number, a date or a party name).',
  'Where several limbs share one subject (the Non-U.S. plans, the Transaction effects, the Company Systems), group them as sub-representations under a category: the category is the subject, each sub-representation a limb under it.',
  'Map every harvested name to exactly one proposed limb. Fold names that are the same limb in different words; keep names apart when they are different limbs; a decided canonical name keeps its exact wording.',
  'Where you cannot tell whether two names are one limb or two, keep them apart and say so in a question for the lawyer.',
  'Answer with one JSON object and nothing else.',
].join(' ');

const RESPONSE_CONTRACT = {
  row_label: 'the representation row, copied',
  categories: [{ name: 'the shared subject, or null when the limb stands alone', limbs: [{ name: 'the proposed canonical limb name', existing: 'true when it is one of the decided names, copied exactly', members: ['every harvested name that is this limb'], note: 'optional: why these fold, or what distinguishes this limb' }] }],
  questions: ['a question for the lawyer where two names may be one limb or two, or where a limb may belong under another representation'],
};

// One request per representation row of the harvest (the JSON the harvest
// script writes with --json): the row label, the decided names, and every
// cluster's names with counts and one example per name. A row whose facts
// all carry no limb name (Brokers; Finders on the two deals read) has
// nothing to name and gets no request.
function buildRequests(harvest) {
  const rows = (harvest?.rows || []).filter((row) => (row.clusters || []).some((cluster) => (cluster.members || []).length > 0));
  return rows.map((row) => {
    const names = [];
    for (const cluster of row.clusters || []) {
      for (const member of cluster.members || []) {
        const example = member.readouts?.[0];
        names.push({
          name: member.name,
          facts: member.count,
          runs: (member.runs || []).length,
          existing: member.existing === true,
          clustered_with: cluster.members.length > 1 ? cluster.proposed_name : null,
          example: example ? { section: example.section_reference || null, summary: example.summary || null } : null,
        });
      }
    }
    names.sort((a, b) => b.facts - a.facts || a.name.localeCompare(b.name));
    const request = {
      instructions: INSTRUCTIONS,
      response_contract: RESPONSE_CONTRACT,
      table_key: row.table_key,
      row_label: row.row_label,
      decided_canonical_names: row.existing_labels || [],
      harvested_names: names,
      whole_row_facts: (row.whole_row_facts || []).length,
    };
    const input = { call_kind: CALL_KIND, prompt_version: PROMPT_VERSION, request };
    return { table_key: row.table_key, row_label: row.row_label, input, call_key: callKey(input), names: names.length };
  });
}

// The cost of the pass before it is run, from the requests' bytes: about
// four bytes a token for the input (the published rule of thumb for
// English and JSON), and for the output every harvested name copied once
// into members plus a proposed name and a note, taken as 40 tokens a name
// with a 200-token floor per request. Priced at the table in
// product-model-config.js (one source, one date) for the extraction tier's
// model, uncached: each request's stable block is its own row, so the
// prompt cache would repeat nothing but the instructions.
function estimateCost(requests, { modelId = MODEL_ID } = {}) {
  const rates = ANTHROPIC_API_PRICES.usd_per_million[modelId];
  if (!rates) throw new Error(`no published rates for ${modelId}`);
  let inputTokens = 0;
  let outputTokens = 0;
  for (const entry of requests) {
    inputTokens += Math.ceil(Buffer.byteLength(JSON.stringify(entry.input), 'utf8') / 4);
    outputTokens += Math.max(200, entry.names * 40);
  }
  const inputUsd = (inputTokens * rates.input) / 1e6;
  const outputUsd = (outputTokens * rates.output) / 1e6;
  return {
    model_id: modelId,
    requests: requests.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_usd: Number(inputUsd.toFixed(2)),
    output_usd: Number(outputUsd.toFixed(2)),
    total_usd: Number((inputUsd + outputUsd).toFixed(2)),
    price_source: ANTHROPIC_API_PRICES.source,
    price_date: ANTHROPIC_API_PRICES.retrieved,
  };
}

// Checks one answer against the request it answers: the row label copied,
// every harvested name mapped exactly once, every decided name kept
// exactly, every limb named. Returns the problems found (none for a sound
// answer); the answer is kept either way, marked.
function answerProblems(answer, entry) {
  const problems = [];
  if (!answer || typeof answer !== 'object') return ['answer is not an object'];
  if (answer.row_label !== entry.row_label) problems.push(`row_label is "${answer.row_label}", expected "${entry.row_label}"`);
  const categories = Array.isArray(answer.categories) ? answer.categories : null;
  if (!categories) return [...problems, 'categories must be an array'];
  const harvested = new Set(entry.input.request.harvested_names.map((item) => item.name));
  const decided = new Set(entry.input.request.decided_canonical_names);
  const seen = new Map();
  const limbNames = new Set();
  for (const category of categories) {
    for (const limb of Array.isArray(category?.limbs) ? category.limbs : []) {
      if (typeof limb?.name !== 'string' || !limb.name.trim()) problems.push('a limb has no name');
      else limbNames.add(limb.name);
      for (const member of Array.isArray(limb?.members) ? limb.members : []) {
        if (!harvested.has(member)) problems.push(`member "${member}" is not a harvested name`);
        seen.set(member, (seen.get(member) || 0) + 1);
      }
    }
  }
  for (const name of harvested) {
    const count = seen.get(name) || 0;
    if (count === 0) problems.push(`harvested name "${name}" is mapped to no limb`);
    if (count > 1) problems.push(`harvested name "${name}" is mapped to ${count} limbs`);
  }
  for (const name of decided) if (!limbNames.has(name)) problems.push(`decided name "${name}" is not kept`);
  if (answer.questions !== undefined && !Array.isArray(answer.questions)) problems.push('questions must be an array');
  return problems;
}

// Runs the pass over the requests with an adapter that has complete(input)
// (the API provider, or a recorded adapter). Each result carries the
// answer, its problems and the call's tokens and cost.
async function runPass(requests, adapter) {
  const results = [];
  for (const entry of requests) {
    const call = await adapter.complete(entry.input);
    const answer = call.response;
    results.push({
      table_key: entry.table_key,
      row_label: entry.row_label,
      call_key: entry.call_key,
      answer,
      problems: answerProblems(answer, entry),
      input_tokens: call.input_tokens ?? 0,
      output_tokens: call.output_tokens ?? 0,
      cost_microusd: call.cost_microusd ?? 0,
      model_id: call.model_id || null,
      provider_id: call.provider_id || null,
    });
  }
  return results;
}

// A recording entry for a call, in the shape createRecordedModelAdapter
// reads, so a live pass's answers can be kept and replayed.
function recordingEntry(entry, call) {
  return {
    call_key: entry.call_key,
    provider_id: call.provider_id,
    model_id: call.model_id,
    raw_response: call.response,
    input_tokens: call.input_tokens ?? 0,
    output_tokens: call.output_tokens ?? 0,
    cost_microusd: call.cost_microusd ?? 0,
    duration_ms: call.duration_ms ?? 0,
  };
}

function cell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// The note for Ben: per representation, the proposed categories and limbs
// with the harvested names each folds, then the model's questions; a row
// whose answer failed its checks is shown with the problems first.
function renderNote({ results, estimate, generatedAt, harvestLabel }) {
  const lines = [];
  lines.push('# Q5: canonical limb lists per representation, proposed by the AI pass', '');
  lines.push(`Generated ${generatedAt} by \`scripts/product/propose-rep-limb-canon.js\` from ${harvestLabel}. A proposal for Ben's decision (Ben, 2026-10-18: "we need to get to canonical (and perhaps some of them are sub reps under a category)"); nothing in the table shapes changes until he decides.`, '');
  const spent = results.reduce((sum, result) => sum + (result.cost_microusd || 0), 0);
  lines.push(`Rows answered: ${results.length}; answers with problems: ${results.filter((result) => result.problems.length).length}; tokens in ${results.reduce((sum, result) => sum + result.input_tokens, 0)}, out ${results.reduce((sum, result) => sum + result.output_tokens, 0)}; cost as recorded $${(spent / 1e6).toFixed(2)}${estimate ? ` (estimated before the pass $${estimate.total_usd})` : ''}.`, '');
  for (const result of results) {
    lines.push(`## ${result.row_label}${String(result.table_key || '').startsWith('parent-') ? ' (Parent representations)' : ''}`, '');
    if (result.problems.length) {
      lines.push(`Problems with this answer (${result.problems.length}): ${result.problems.map((problem) => `"${problem}"`).join('; ')}`, '');
    }
    const categories = Array.isArray(result.answer?.categories) ? result.answer.categories : [];
    if (categories.length) {
      lines.push('| Category | Proposed canonical limb | Existing | Harvested names folded | Note |', '| --- | --- | --- | --- | --- |');
      for (const category of categories) {
        for (const limb of Array.isArray(category?.limbs) ? category.limbs : []) {
          lines.push(`| ${cell(category.name || '')} | ${cell(limb.name)} | ${limb.existing === true || limb.existing === 'true' ? 'yes' : ''} | ${cell((limb.members || []).join('<br>'))} | ${cell(limb.note || '')} |`);
        }
      }
      lines.push('');
    }
    const questions = Array.isArray(result.answer?.questions) ? result.answer.questions : [];
    if (questions.length) {
      lines.push('Questions for Ben:', '');
      for (const question of questions) lines.push(`- ${question}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

module.exports = {
  CALL_KIND,
  INSTRUCTIONS,
  MODEL_ID,
  PROMPT_VERSION,
  RESPONSE_CONTRACT,
  answerProblems,
  buildRequests,
  estimateCost,
  recordingEntry,
  renderNote,
  runPass,
  canonicalJson,
};
