#!/usr/bin/env node
/**
 * scripts/canonical-v2-native-extract.mjs
 *
 * CLI for running the native capitalisation producer end to end against
 * source text on disk, using the real Anthropic backend
 * (lib/canonical-v2/native-producer/anthropic-provider.js) behind the same
 * injected-provider seam the tests use. This is how F28 gets run from
 * source rather than from a fixture.
 *
 * Usage:
 *   node scripts/canonical-v2-native-extract.mjs \
 *     --source-file <path> --section-ref <ref> \
 *     [--record <path>] [--replay <path>] [--dry-run] \
 *     [--model <id>] [--max-retries <n>]
 *
 *   --dry-run   sectionizes, resolves --section-ref and prints the built
 *               prompt for the resolved scope. Never calls the
 *               provider/model.
 *   --record    after a live call, writes the raw model response to <path>
 *               so it can be replayed later as a fixture.
 *   --replay    reads a recorded response from <path> instead of calling the
 *               model at all -- no network call happens in this mode.
 *
 * SECTIONIZING. --section-ref is resolved through the real deterministic
 * sectionizer (lib/canonical-v2/native-producer/deterministic-sectionizer.js),
 * not a heading-anchored regex heuristic: the whole source file is
 * sectionized once, --section-ref is looked up against the resulting tree
 * via findSectionByReference, and the governed scope handed to the producer
 * is built from that node's EXACT byte offsets. If the reference cannot be
 * resolved this CLI fails closed (non-zero exit, no model call) -- it never
 * falls back to extracting from the whole document.
 *
 * document_hash is derived as the SHA-256 of the source file's bytes; this
 * CLI has no separate admission pipeline to source one from.
 *
 * Non-dry-run modes delegate the full sectionize -> prompt -> produce ->
 * compile pipeline to lib/canonical-v2/native-producer/native-extraction-run.js's
 * `runNativeExtraction`, so the CLI output includes compiled candidates,
 * not just raw proposals. contract_bundle is the same fixture contract the
 * native-producer tests already use (lib/canonical-v2/contract-bundle.js's
 * compileFixtureContract) -- building a real per-deal contract bundle is
 * out of scope here.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  sectionizeAdmittedSource,
  findSectionByReference,
  DeterministicSectionizerError,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { buildCapitalisationProducerPrompt } = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction, NativeExtractionRunError } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');

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

function fail(message) {
  process.stderr.write(`[canonical-v2-native-extract] FAILED: ${message}\n`);
  process.exitCode = 1;
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
  const documentHash = sha256Hex(Buffer.from(fullText, 'utf8'));

  if (args.dryRun) {
    let tree;
    try {
      tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
    } catch (err) {
      if (err instanceof DeterministicSectionizerError) {
        fail(`sectionizer error (${err.code}): ${err.message}`);
        return;
      }
      throw err;
    }
    const node = findSectionByReference(tree, args.sectionRef);
    if (!node) {
      fail(`section reference "${args.sectionRef}" could not be resolved against the sectionized document `
        + '(refusing to fall back to the whole document)');
      return;
    }
    const sectionText = Buffer.from(fullText, 'utf8').subarray(node.start, node.end).toString('utf8');
    const prompt = buildCapitalisationProducerPrompt({
      source_text: sectionText,
      governed_scope: {
        document_hash: documentHash,
        section_reference: args.sectionRef,
        section_id: node.section_id,
        start: node.start,
        end: node.end,
      },
      known_definitions: [],
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'dry-run',
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      section_reference: args.sectionRef,
      section_id: node.section_id,
      start: node.start,
      end: node.end,
      messages: prompt.messages,
    }, null, 2)}\n`);
    return;
  }

  const contractBundle = compileFixtureContract();
  const definitions = { known_definitions: [] };

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

  const provider = createAnthropicProvider(providerOptions);

  let runReceipt;
  try {
    runReceipt = await runNativeExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: [args.sectionRef],
      contract_bundle: contractBundle,
      definitions,
      provider,
    });
  } catch (err) {
    if (err instanceof NativeExtractionRunError && err.code === 'SECTION_REFERENCE_UNRESOLVED') {
      fail(`section reference "${args.sectionRef}" could not be resolved against the sectionized document `
        + '(refusing to fall back to the whole document)');
      return;
    }
    throw err;
  }

  process.stdout.write(`${JSON.stringify({
    mode: args.replayPath ? 'replay' : 'live',
    run_receipt: runReceipt,
  }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`[canonical-v2-native-extract] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
