#!/usr/bin/env node
/**
 * scripts/canonical-v2-f28-second-live-extraction-run.mjs
 *
 * F28 SECOND live end-to-end run: same real pipeline as
 * scripts/canonical-v2-f28-live-extraction-run.mjs (raw HTML -> real
 * admission chain -> canonical text -> real sectionizer -> LIVE model call
 * under PROMPT_VERSION 2 -> resolveCandidates -> buildNativeWriteSet ->
 * real validateResolvedCanonicalWriteSet), against the SAME filing, so the
 * two runs are directly comparable. See docs/handoffs/F28-FIRST-LIVE-RUN.md
 * and docs/handoffs/F28-SECOND-LIVE-RUN.md.
 *
 * The one behavioural difference from the first run's script: this one also
 * writes the model's raw response text out in the
 * NATIVE_PRODUCER_RECORDED_RESPONSE/V1 fixture shape (the same shape
 * scripts/canonical-v2-native-extract.mjs's --record produces), so the
 * recorded response can be committed as a replayable fixture.
 *
 * MODEL BACKEND. No ANTHROPIC_API_KEY is assumed. Drives the model via the
 * Claude Code subscription CLI (`claude -p`), injected through
 * createAnthropicProvider's `client` seam, capturing full usage/cost/
 * duration telemetry from `--output-format json`.
 *
 * Usage:
 *   node scripts/canonical-v2-f28-second-live-extraction-run.mjs \
 *     --raw-html <path to fetched .htm file> \
 *     --retrieval-url <the exact https://www.sec.gov/... URL it came from> \
 *     --section-ref <section reference to extract, e.g. "III-INTRO(b)"> \
 *     --out-dir <directory to write receipt/resolution/validation/telemetry JSON> \
 *     --fixture-out <path to write the NATIVE_PRODUCER_RECORDED_RESPONSE/V1 fixture>
 *     [--model <cli model alias, default "sonnet">]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');

function parseArgs(argv) {
  const out = { model: 'sonnet' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--raw-html': out.rawHtml = argv[++i]; break;
      case '--retrieval-url': out.retrievalUrl = argv[++i]; break;
      case '--section-ref': out.sectionRef = argv[++i]; break;
      case '--out-dir': out.outDir = argv[++i]; break;
      case '--fixture-out': out.fixtureOut = argv[++i]; break;
      case '--model': out.model = argv[++i]; break;
      default: throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  for (const req2 of ['rawHtml', 'retrievalUrl', 'sectionRef', 'outDir', 'fixtureOut']) {
    if (!out[req2]) throw new Error(`--${req2.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  return out;
}

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force subscription auth, not metered billing
  return env;
}

function runClaudeCli(promptText, { model, timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', model], {
      env: childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude -p timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude -p exited ${code}: ${err.slice(0, 800)}`));
      resolvePromise(out);
    });
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

function flattenMessages(params) {
  const parts = [];
  if (params.system) {
    const sys = Array.isArray(params.system) ? params.system.map((b) => b.text || '').join('\n') : String(params.system);
    if (sys.trim()) parts.push(sys);
  }
  for (const m of params.messages || []) {
    const content = typeof m.content === 'string' ? m.content : (m.content || []).map((b) => b.text || '').join('\n');
    parts.push(content);
  }
  return parts.join('\n\n');
}

function makeMeasuredCliClient(model, telemetry, fixtureOutPath) {
  return {
    messages: {
      async create(params) {
        const prompt = flattenMessages(params);
        const startedAt = Date.now();
        const rawCliOutput = await runClaudeCli(prompt, { model });
        const wallClockMs = Date.now() - startedAt;
        const parsed = JSON.parse(rawCliOutput);
        if (parsed.is_error) throw new Error(`claude -p error: ${String(parsed.result).slice(0, 500)}`);
        telemetry.calls.push({
          wall_clock_ms: wallClockMs,
          duration_ms_reported: parsed.duration_ms,
          duration_api_ms_reported: parsed.duration_api_ms,
          total_cost_usd_cli: parsed.total_cost_usd,
          usage: parsed.usage,
          model_usage: parsed.modelUsage,
          served_model: parsed.model || null,
          session_id: parsed.session_id,
        });
        const rawResponseText = parsed.result || '';
        writeFileSync(resolve(fixtureOutPath), JSON.stringify({
          schema_version: 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1',
          model: `claude-sonnet-5 (served via Claude Code subscription CLI, \`claude -p --model ${model}\`, no ANTHROPIC_API_KEY available in this environment)`,
          recorded_at: new Date().toISOString(),
          note: 'F28 SECOND live run against real QXO/TopBuild Section 3.1(b) Capital Structure text, PROMPT_VERSION 2 (entity-decoding fix + limb_path + attachment + citation constructibility). '
            + 'request_messages omitted here (see docs/handoffs/F28-SECOND-LIVE-RUN.md and the prompt builder for the exact content); raw_response_text is the model\'s literal output including its ```json fence, byte-for-byte as returned.',
          raw_response_text: rawResponseText,
        }, null, 2));
        return { content: [{ type: 'text', text: rawResponseText }] };
      },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(args.outDir);
  mkdirSync(outDir, { recursive: true });

  process.stderr.write(`[f28-run2] PROMPT_VERSION = ${PROMPT_VERSION}\n`);

  // ─── Step 1/2: raw HTML -> real admission chain -> canonical text ───

  const rawBytes = readFileSync(resolve(args.rawHtml));
  const retrievalPolicyDigest = sha256Hex(
    'F28 second live run research fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", ~400ms between requests, no redirects followed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: args.retrievalUrl,
    final_url: args.retrievalUrl,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: retrievalPolicyDigest,
    redirect_count: 0,
    response_bytes: rawBytes,
  });

  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new Error(`independent canonical-text verification did not PASS: ${verification.verification_status}`);
  }
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  const dealKey = `deal:f28-second-live-run:${sha256Hex(args.retrievalUrl).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-run2:${args.retrievalUrl}`);

  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });

  const documentHash = admittedSourceContext.document_hash; // = raw HTML sha256
  const fullText = conversion.canonical_text;

  process.stderr.write(`[f28-run2] document_hash (raw fetched-file sha256) = ${documentHash}\n`);
  process.stderr.write(`[f28-run2] canonical_text_sha256 = ${conversion.canonical_text_sha256}\n`);
  process.stderr.write(`[f28-run2] canonical_text_byte_length = ${conversion.canonical_text_byte_length}\n`);

  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  process.stderr.write(`[f28-run2] sectionizer node count = ${tree.nodes.length}\n`);

  const node = findSectionByReference(tree, args.sectionRef);
  if (!node) throw new Error(`section reference "${args.sectionRef}" could not be resolved`);
  process.stderr.write(`[f28-run2] resolved section ${args.sectionRef}: start=${node.start} end=${node.end}\n`);

  // ─── Step 3: LIVE model call ───

  const contractBundle = compileFixtureContract();
  const definitions = { known_definitions: [] };
  const telemetry = { calls: [] };

  const providerOptions = {
    model: `claude-sonnet-5-via-claude-code-cli(${args.model})`,
    client: makeMeasuredCliClient(args.model, telemetry, args.fixtureOut),
    maxRetries: 0,
  };
  const provider = createAnthropicProvider(providerOptions);

  process.stderr.write('[f28-run2] starting LIVE extraction call...\n');
  const runStart = Date.now();
  const receipt = await runNativeExtraction({
    source_text: fullText,
    document_hash: documentHash,
    section_references: [args.sectionRef],
    contract_bundle: contractBundle,
    definitions,
    provider,
  });
  const runWallClockMs = Date.now() - runStart;
  process.stderr.write(`[f28-run2] extraction run complete in ${runWallClockMs}ms\n`);

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: runWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates -> buildNativeWriteSet -> validate ───

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
  });
  writeFileSync(resolve(outDir, 'resolution.json'), JSON.stringify(resolution, null, 2));

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: fullText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
  });
  writeFileSync(resolve(outDir, 'adapter-result.json'), JSON.stringify(adapterResult, null, 2));

  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = { ...adapterResult.write_set, provisions: [...provisionsById.values()] };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  writeFileSync(resolve(outDir, 'validation.json'), JSON.stringify(validation, null, 2));

  process.stderr.write('[f28-run2] === SUMMARY ===\n');
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
  process.stderr.write(`write_set claims: ${adapterResult.write_set.claims.length}, adapter residuals: ${adapterResult.residuals.length}\n`);
  process.stderr.write(`validation accepted: ${validation.accepted}, residuals: ${validation.residuals.length}, quarantines: ${validation.quarantines.length}\n`);
  process.stderr.write(`publishable claims: ${validation.publishableWriteSet ? validation.publishableWriteSet.claims.length : 'n/a'}\n`);
}

main().catch((err) => {
  process.stderr.write(`[f28-run2] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
