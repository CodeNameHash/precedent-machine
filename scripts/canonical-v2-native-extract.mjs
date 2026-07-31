#!/usr/bin/env node
/**
 * scripts/canonical-v2-native-extract.mjs
 *
 * CLI for running the native capitalisation producer against source text on
 * disk, using the real Anthropic backend (lib/canonical-v2/native-producer/
 * anthropic-provider.js) behind the same injected-provider seam the tests
 * use. This is how F28 gets run from source rather than from a fixture.
 *
 * Usage:
 *   node scripts/canonical-v2-native-extract.mjs \
 *     --source-file <path> --section-ref <ref> \
 *     [--record <path>] [--replay <path>] [--dry-run] \
 *     [--model <id>] [--max-retries <n>]
 *
 *   --dry-run   builds and prints the prompt, never calls the provider/model.
 *   --record    after a live call, writes the raw model response to <path>
 *               so it can be replayed later as a fixture.
 *   --replay    reads a recorded response from <path> instead of calling the
 *               model at all -- no network call happens in this mode.
 *
 * SCOPE NOTE: provider-interface.js's seam takes {governed_scope, definitions,
 * contract_bundle} with no dedicated source-text field, so this CLI carries
 * the admitted source text on governed_scope.source_text (the anthropic
 * provider reads it from there -- see its MISSING_SOURCE_TEXT error).
 * --section-ref is a lightweight heading-anchored heuristic, not a real
 * sectionizer: it looks for the first line containing the ref and takes
 * text up to the next similarly-shaped heading or a bounded cap, falling
 * back to the whole (capped) file if the ref isn't found. contract_bundle
 * is the same fixture contract the native-producer tests already use
 * (lib/canonical-v2/contract-bundle.js's compileFixtureContract) -- building
 * a real per-deal contract bundle is out of scope here.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildCapitalisationProducerPrompt } = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');

const SECTION_TEXT_CAP = 20000;

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--source-file': out.sourceFile = argv[++i]; break;
      case '--section-ref': out.sectionRef = argv[++i]; break;
      case '--record': out.recordPath = argv[++i]; break;
      case '--replay': out.replayPath = argv[++i]; break;
      case '--dry-run': out.dryRun = true; break;
      case '--model': out.model = argv[++i]; break;
      case '--max-retries': out.maxRetries = Number(argv[++i]); break;
      default:
        throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  return out;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A heading-anchored heuristic, not a real sectionizer (see file header).
 * Finds the first line mentioning `ref`, then takes text up to the next
 * line that looks like a new numbered section heading, capped at
 * SECTION_TEXT_CAP chars. Falls back to the whole (capped) document, with a
 * stderr warning, if the ref cannot be located.
 */
function extractSection(fullText, ref) {
  const anchorRe = new RegExp(`^.*\\b(Section\\s+)?${escapeRegExp(ref)}\\b.*$`, 'im');
  const anchorMatch = anchorRe.exec(fullText);
  if (!anchorMatch) {
    process.stderr.write(
      `[canonical-v2-native-extract] section-ref "${ref}" not found by heading heuristic; `
        + `falling back to the whole document (capped at ${SECTION_TEXT_CAP} chars)\n`,
    );
    return { text: fullText.slice(0, SECTION_TEXT_CAP), located: false };
  }
  const startIdx = anchorMatch.index;
  const rest = fullText.slice(startIdx);
  const nextHeadingRe = /\n\s*(?:Section\s+)?\d+\.\d+[A-Za-z]?[.\s(]/;
  const searchFrom = anchorMatch[0].length;
  const nextMatch = nextHeadingRe.exec(rest.slice(searchFrom));
  const endIdx = nextMatch ? searchFrom + nextMatch.index : rest.length;
  const text = rest.slice(0, Math.min(endIdx, SECTION_TEXT_CAP));
  return { text, located: true };
}

function buildStubClientFromRecording(recordedPath) {
  const recorded = JSON.parse(readFileSync(resolve(recordedPath), 'utf8'));
  if (typeof recorded.raw_response_text !== 'string') {
    throw new Error(`recorded fixture at ${recordedPath} is missing raw_response_text`);
  }
  return {
    messages: {
      async create() {
        return { content: [{ text: recorded.raw_response_text }] };
      },
    },
  };
}

function wrapClientForRecording(realClient, recordPath, model) {
  return {
    messages: {
      async create(params) {
        const resp = await realClient.messages.create(params);
        const rawText = Array.isArray(resp.content) ? resp.content.map((c) => c.text || '').join('') : '';
        writeFileSync(resolve(recordPath), JSON.stringify({
          schema_version: 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1',
          model,
          recorded_at: new Date().toISOString(),
          request_messages: params.messages,
          raw_response_text: rawText,
        }, null, 2));
        process.stderr.write(`[canonical-v2-native-extract] recorded response to ${recordPath}\n`);
        return resp;
      },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sourceFile) throw new Error('--source-file is required');
  if (!args.sectionRef) throw new Error('--section-ref is required');
  if (args.recordPath && args.replayPath) throw new Error('--record and --replay are mutually exclusive');
  if (args.dryRun && (args.recordPath || args.replayPath)) {
    throw new Error('--dry-run never calls the model: it cannot be combined with --record or --replay');
  }

  const fullText = readFileSync(resolve(args.sourceFile), 'utf8');
  const { text: sourceText, located } = extractSection(fullText, args.sectionRef);

  const governedScope = {
    deal_key: `native-extract:${resolve(args.sourceFile)}`,
    governed_intervals: [args.sectionRef],
    section_ref: args.sectionRef,
    section_located: located,
    source_text: sourceText,
  };
  const definitions = { known_definitions: [] };

  if (args.dryRun) {
    const prompt = buildCapitalisationProducerPrompt({
      source_text: sourceText,
      governed_scope: governedScope,
      known_definitions: definitions.known_definitions,
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'dry-run',
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      section_located: located,
      messages: prompt.messages,
    }, null, 2)}\n`);
    return;
  }

  const contractBundle = compileFixtureContract();

  let providerOptions = {
    model: args.model,
    maxRetries: Number.isFinite(args.maxRetries) ? args.maxRetries : undefined,
  };

  if (args.replayPath) {
    providerOptions = { ...providerOptions, client: buildStubClientFromRecording(args.replayPath) };
  } else if (args.recordPath) {
    // eslint-disable-next-line global-require
    const Anthropic = require('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required to record a live response');
    const realClient = new Anthropic({ apiKey });
    providerOptions = {
      ...providerOptions,
      client: wrapClientForRecording(realClient, args.recordPath, providerOptions.model || 'default'),
    };
  }

  const baseProvider = createAnthropicProvider(providerOptions);
  let capturedProviderOutput = null;
  const provider = async (input) => {
    const output = await baseProvider(input);
    capturedProviderOutput = output;
    return output;
  };

  const { proposals, producer_receipt: producerReceipt } = await produceCandidateProposals({
    governed_scope: governedScope,
    definitions,
    contract_bundle: contractBundle,
    provider,
  });

  process.stdout.write(`${JSON.stringify({
    mode: args.replayPath ? 'replay' : 'live',
    section_located: located,
    prompt_id: capturedProviderOutput ? capturedProviderOutput.prompt_id : null,
    prompt_version: capturedProviderOutput ? capturedProviderOutput.prompt_version : null,
    attempts: capturedProviderOutput ? capturedProviderOutput.attempts : null,
    dropped_quote_mismatches: capturedProviderOutput ? capturedProviderOutput.dropped_quote_mismatches : [],
    proposals,
    producer_receipt: producerReceipt,
  }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`[canonical-v2-native-extract] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
