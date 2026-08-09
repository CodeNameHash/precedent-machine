#!/usr/bin/env node
/**
 * scripts/canonical-v2-redhat-reps-limb-disposition.mjs
 *
 * Recomputes the Step 2X-L1 limb disposition table for Red Hat REPRESENTATIONS
 * §3.01+§3.02 from recorded model responses and a 2X-L replay evidence dir.
 *
 * Usage:
 *   node scripts/canonical-v2-redhat-reps-limb-disposition.mjs \
 *     [--source-run evidence/canonical-v2/redhat-representations-20260808-r1] \
 *     [--replay-run evidence/canonical-v2/redhat-representations-20260808-2xl-replay] \
 *     [--json]
 */

import { createRequire } from 'module';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const {
  classifyLimbPathKind,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

const LIMB_CLAIM_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';

function parseArgs(argv) {
  const out = {
    sourceRun: 'evidence/canonical-v2/redhat-representations-20260808-r1',
    replayRun: 'evidence/canonical-v2/redhat-representations-20260808-2xl-replay',
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source-run') out.sourceRun = argv[++i];
    else if (arg === '--replay-run') out.replayRun = argv[++i];
    else if (arg === '--json') out.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseRecordedResponse(rawResponseText) {
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(rawResponseText);
  const jsonText = fenceMatch ? fenceMatch[1] : rawResponseText;
  return JSON.parse(jsonText.trim());
}

function limbMatchKey(limbPath, assertionQuote) {
  return `${JSON.stringify(limbPath)}|${assertionQuote}`;
}

function limbKey(sectionReference, limbPath, assertionQuote) {
  return `${sectionReference}|${limbMatchKey(limbPath, assertionQuote)}`;
}

function collectModelLimbs(sourceRunDir) {
  const limbs = [];
  const files = readdirSync(sourceRunDir)
    .filter((name) => name.startsWith('native-producer-recorded-response-'))
    .sort();
  for (const name of files) {
    const recorded = readJson(resolve(sourceRunDir, name));
    const parsed = parseRecordedResponse(recorded.raw_response_text);
    for (const instance of parsed.representation_instances || []) {
      const sectionReference = instance.section_reference;
      for (const limb of instance.limbs || []) {
        const limbPath = Array.isArray(limb.limb_path) ? limb.limb_path : [];
        limbs.push({
          section_reference: sectionReference,
          limb_path: limbPath,
          assertion_quote: limb.assertion_quote,
          subject: limb.subject || null,
          limb_path_kind: classifyLimbPathKind(limbPath),
          key: limbKey(sectionReference, limbPath, limb.assertion_quote),
        });
      }
    }
  }
  return limbs;
}

function collectResidualKeys(replayRunDir) {
  const adapter = readJson(resolve(replayRunDir, 'adapter-result.json'));
  const keys = new Set();
  for (const residual of adapter.residuals || []) {
    if (residual.reason !== 'LIMB_ASSERTION_QUOTE_UNVERIFIED') continue;
    const preview = residual.quote_preview || '';
    // Residuals carry quote_preview only; match by section + preview prefix.
    keys.add(`${residual.section_reference}|preview|${preview.slice(0, 80)}`);
  }
  return { keys, residuals: adapter.residuals || [] };
}

function collectOpenWorldKeys(replayRunDir) {
  const resolution = readJson(resolve(replayRunDir, 'resolution.json'));
  const keys = new Map();
  for (const row of resolution.open_world || []) {
    if (row.claim_definition_key !== LIMB_CLAIM_KEY) continue;
    const sectionReference = row.section_reference
      || row.attributes?.section_reference;
    const limbPath = row.attributes?.limb_path || [];
    const assertionQuote = row.raw_value;
    keys.set(limbKey(sectionReference, limbPath, assertionQuote), {
      reason_code: row.reason || 'UNMAPPED_GENERIC_CLAIM_KEY',
    });
  }
  return keys;
}

function collectAssertionNodeKeys(replayRunDir) {
  const resolution = readJson(resolve(replayRunDir, 'resolution.json'));
  const keys = new Set();
  for (const tree of resolution.limb_component_trees || []) {
    for (const node of tree.assertion_nodes || []) {
      keys.add(limbMatchKey(node.limb_path, node.quote));
    }
  }
  return keys;
}

function matchesResidual(limb, residualKeys, residuals) {
  for (const residual of residuals) {
    if (residual.section_reference !== limb.section_reference) continue;
    const preview = residual.quote_preview || '';
    if (limb.assertion_quote.startsWith(preview.slice(0, preview.length))) return true;
    if (preview.startsWith(limb.assertion_quote.slice(0, 80))) return true;
  }
  return residualKeys.has(`${limb.section_reference}|preview|${(limb.assertion_quote || '').slice(0, 80)}`);
}

function buildDisposition(sourceRunDir, replayRunDir) {
  const modelLimbs = collectModelLimbs(sourceRunDir);
  const { keys: residualKeys, residuals } = collectResidualKeys(replayRunDir);
  const openWorld = collectOpenWorldKeys(replayRunDir);
  const assertionKeys = collectAssertionNodeKeys(replayRunDir);

  const rows = [];
  for (const limb of modelLimbs) {
    let disposition;
    let reason_code = null;
    if (matchesResidual(limb, residualKeys, residuals)) {
      disposition = 'RESIDUAL_QUOTE_UNVERIFIED';
      reason_code = 'LIMB_ASSERTION_QUOTE_UNVERIFIED';
    } else if (openWorld.has(limb.key)) {
      const ow = openWorld.get(limb.key);
      reason_code = ow.reason_code;
      disposition = assertionKeys.has(limbMatchKey(limb.limb_path, limb.assertion_quote))
        ? 'OPEN_WORLD_AND_ASSERTION_NODE'
        : 'OPEN_WORLD_ONLY';
    } else if (assertionKeys.has(limbMatchKey(limb.limb_path, limb.assertion_quote))) {
      disposition = 'ASSERTION_NODE_ONLY';
      reason_code = 'LIMB_ASSERTION_MINTED';
    } else {
      disposition = 'UNACCOUNTED';
      reason_code = 'MISSING_FROM_EVIDENCE';
    }
    rows.push({
      ...limb,
      disposition,
      reason_code,
      feeds_assertion_node: assertionKeys.has(limbMatchKey(limb.limb_path, limb.assertion_quote)),
    });
  }

  const summary = {
    input_limbs: modelLimbs.length,
    unaccounted: rows.filter((row) => row.disposition === 'UNACCOUNTED').length,
    by_disposition: {},
    by_reason_code: {},
    path_hygiene: { MARKER: 0, DESCRIPTIVE: 0, MIXED: 0, null: 0 },
    assertion_node_feeders: rows.filter((row) => row.feeds_assertion_node).length,
  };
  for (const row of rows) {
    summary.by_disposition[row.disposition] = (summary.by_disposition[row.disposition] || 0) + 1;
    summary.by_reason_code[row.reason_code] = (summary.by_reason_code[row.reason_code] || 0) + 1;
    const kind = row.limb_path_kind;
    if (kind === 'MARKER' || kind === 'DESCRIPTIVE' || kind === 'MIXED') {
      summary.path_hygiene[kind] += 1;
    } else {
      summary.path_hygiene.null += 1;
    }
  }

  const matCount = readFileSync(resolve(replayRunDir, 'resolution.json'), 'utf8')
    .match(/MAT_MAE_AGGREGATE/g);
  summary.mat_mae_aggregate_in_resolution = matCount ? matCount.length : 0;

  return { rows, summary, sourceRunDir, replayRunDir };
}

function formatMarkdown(result) {
  const { rows, summary, sourceRunDir, replayRunDir } = result;
  const lines = [];
  lines.push('| # | section | limb_path | path_kind | disposition | reason_code | assertion_node |');
  lines.push('|---:|---|---|---|---|---|---|');
  rows.forEach((row, index) => {
    const path = JSON.stringify(row.limb_path);
    lines.push(`| ${index + 1} | ${row.section_reference} | ${path} | ${row.limb_path_kind ?? 'null'} | ${row.disposition} | ${row.reason_code} | ${row.feeds_assertion_node ? 'yes' : 'no'} |`);
  });
  lines.push('');
  lines.push('### Summary');
  lines.push('');
  lines.push(`- input_limbs: **${summary.input_limbs}**`);
  lines.push(`- unaccounted: **${summary.unaccounted}**`);
  lines.push(`- MAT_MAE_AGGREGATE in resolution.json: **${summary.mat_mae_aggregate_in_resolution}**`);
  lines.push(`- path_hygiene: MARKER ${summary.path_hygiene.MARKER}, DESCRIPTIVE ${summary.path_hygiene.DESCRIPTIVE}, MIXED ${summary.path_hygiene.MIXED}, null ${summary.path_hygiene.null}`);
  lines.push(`- assertion_node_feeders: **${summary.assertion_node_feeders}**`);
  lines.push('');
  lines.push('### By disposition');
  for (const [key, count] of Object.entries(summary.by_disposition).sort()) {
    lines.push(`- ${key}: ${count}`);
  }
  lines.push('');
  lines.push('### By reason_code');
  for (const [key, count] of Object.entries(summary.by_reason_code).sort()) {
    lines.push(`- ${key}: ${count}`);
  }
  lines.push('');
  lines.push(`Source run: \`${sourceRunDir}\``);
  lines.push(`Replay run: \`${replayRunDir}\``);
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(resolve(args.sourceRun))) {
    throw new Error(`source run not found: ${args.sourceRun}`);
  }
  if (!existsSync(resolve(args.replayRun))) {
    throw new Error(`replay run not found: ${args.replayRun}`);
  }
  const result = buildDisposition(args.sourceRun, args.replayRun);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(formatMarkdown(result));
  process.stdout.write('\n');
}

main();
