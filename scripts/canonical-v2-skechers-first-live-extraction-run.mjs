#!/usr/bin/env node
/**
 * scripts/canonical-v2-skechers-first-live-extraction-run.mjs
 *
 * F28 breadth slice, docs/acks/CLAIM-IDENTITY-APPROVALS-2026-08-01.md item
 * 3 / slice (c): FIRST live native extraction run against a SECOND deal
 * (Skechers U.S.A., Inc. / Beach Acquisition Co Parent, LLC (3G Capital)),
 * parameterized from scripts/canonical-v2-f28-third-live-extraction-run.mjs
 * (same real pipeline: raw HTML -> real admission chain -> canonical text
 * -> real sectionizer -> LIVE model call under PROMPT_VERSION 4 ->
 * resolveCandidates -> buildNativeWriteSet (WITH the resolution context, so
 * component rows mint for assertion-node subjects) -> real
 * validateResolvedCanonicalWriteSet), against a NEW filing and section.
 *
 * PINNING FETCH. Unlike the F28 runs (which re-verify an already-pinned
 * QXO/TopBuild hash), this is the FIRST fetch of the Skechers filing in
 * this repo -- there is no pinned hash yet. This script performs the
 * pinning fetch itself: it records the response byte length and SHA-256 of
 * the raw HTML it receives, refuses to proceed on a non-200 status or any
 * redirect (SEC EDGAR intake capture rules -- see
 * lib/canonical-v2/sec-edgar-intake-capture.js), and prints both values
 * prominently so they can be pinned in a follow-up commit once this run is
 * reviewed. It does NOT hardcode an expected hash to check against (there
 * is nothing yet to check against).
 *
 * SECTION LOCATION IS NOT ASSUMED. Skechers' Article III representations
 * are drafted with real decimal-numbered headings ("3.7 Company
 * Capitalization.", "3.8 Subsidiaries.", ...) embedded in dense,
 * blank-line-free prose. lib/parser-v2/structural.js's heading detector
 * requires blank-line anchoring it never gets here, so (exactly as with
 * QXO/TopBuild) sectionizeAdmittedSource() finds ZERO numbered SECTION
 * nodes -- only ARTICLE and lettered SUBSECTION nodes descending from each
 * ARTICLE's INTRO. On QXO/TopBuild that residual lettered-clause tree
 * still gave a cleanly-scoped node for the governed section (III-INTRO(b)
 * mapped exactly onto "Section 3.1(b)") because Article III's ENTIRE rep
 * block was one flat, non-nested lettered list starting right after the
 * INTRO. Skechers' Article III is NOT like that: it has ~26 separately
 * decimal-numbered sections (3.1 ... 3.26), each independently opening its
 * own "(a)/(b)/(c)..." lettered list, and because the sectionizer never
 * recognises a decimal heading as a boundary, those per-section lettered
 * lists do not reset -- they nest into one another across section
 * boundaries. This driver does NOT paper over that: it requires a caller-
 * supplied `--section-ref` that must resolve, via the real
 * findSectionByReference(), to a tree node whose byte span is independently
 * verified (best-effort, printed to stderr) against the expected decimal
 * heading text before any model call is made. If no such node exists for
 * the section you want, this script is not the place to invent one --
 * see docs/handoffs/SKECHERS-FIRST-LIVE-RUN.md (companion doc, not
 * authored by this script) for the mechanical finding on this filing's
 * Section 3.7 "Company Capitalization" specifically.
 *
 * MODEL BACKEND. No ANTHROPIC_API_KEY is assumed. Drives the model via the
 * Claude Code subscription CLI (`claude -p`), injected through
 * createAnthropicProvider's `client` seam, capturing full usage/cost/
 * duration telemetry from `--output-format json`.
 *
 * Usage:
 *   node scripts/canonical-v2-skechers-first-live-extraction-run.mjs \
 *     --raw-html <path to fetched .htm file, OR omit to fetch live> \
 *     --retrieval-url <the exact https://www.sec.gov/... URL> \
 *     --section-ref <section reference to extract, e.g. "III-INTRO(d)(a)"> \
 *     --out-dir <directory to write receipt/resolution/validation/telemetry JSON> \
 *     --fixture-out <path to write the NATIVE_PRODUCER_RECORDED_RESPONSE/V1 fixture> \
 *     [--agreement-date <YYYY-MM-DD, derived from the preamble's own "Dated as of" text>] \
 *     [--model <cli model alias, default "sonnet">]
 *
 * If --raw-html is omitted, the script performs the pinning fetch itself
 * against SKECHERS_URL below (refusing redirects/non-200), and writes the
 * fetched bytes to <out-dir>/skechers-raw-fetched.htm for reproducibility.
 */

import {
  readFileSync, writeFileSync, mkdirSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const {
  buildReviewQueueArtifact, serialiseReviewQueueArtifact,
} = require('../lib/canonical-v2/native-producer/review-queue-artifact');

const SKECHERS_URL = 'https://www.sec.gov/Archives/edgar/data/1065837/000119312525112159/d943603dex21.htm';

// Pinned per tests/fixtures/canonical-v2/skechers-first-live-run/intake-pin.json
// (mechanical pinning fetch performed by this script's earlier run). This
// run re-verifies the raw bytes hash before proceeding -- abort on mismatch.
const EXPECTED_RAW_BYTES_SHA256 = '3a8b8d77c126c85f4402f290da3dec43efa209d6a8a505d11d1af95fab115833';

function parseArgs(argv) {
  const out = { model: 'sonnet', sectionRef: '3.7' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--raw-html': out.rawHtml = argv[++i]; break;
      case '--retrieval-url': out.retrievalUrl = argv[++i]; break;
      case '--section-ref': out.sectionRef = argv[++i]; break;
      case '--out-dir': out.outDir = argv[++i]; break;
      case '--fixture-out': out.fixtureOut = argv[++i]; break;
      case '--agreement-date': out.agreementDate = argv[++i]; break;
      case '--model': out.model = argv[++i]; break;
      default: throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  for (const req2 of ['sectionRef', 'outDir', 'fixtureOut']) {
    if (!out[req2]) throw new Error(`--${req2.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  if (!out.retrievalUrl) out.retrievalUrl = SKECHERS_URL;
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
          note: 'Skechers/Beach Acquisition FIRST live run (second deal, breadth slice per '
            + 'docs/acks/CLAIM-IDENTITY-APPROVALS-2026-08-01.md item 3(c)), PROMPT_VERSION 4. '
            + 'request_messages omitted here; raw_response_text is the model\'s literal output '
            + 'including its ```json fence, byte-for-byte as returned.',
          raw_response_text: rawResponseText,
        }, null, 2));
        return { content: [{ type: 'text', text: rawResponseText }] };
      },
    },
  };
}

async function fetchPinned(url, outDir) {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'precedent-machine research bengoodchild@gmail.com',
      Accept: 'text/html',
      'Accept-Encoding': 'identity',
    },
  });
  if (response.status !== 200) {
    throw new Error(`refusing non-200 response: status=${response.status}`);
  }
  const location = response.headers.get('location');
  if (location) {
    throw new Error(`refusing redirect: Location=${location}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const savedPath = resolve(outDir, 'skechers-raw-fetched.htm');
  writeFileSync(savedPath, bytes);
  return {
    bytes, contentType: response.headers.get('content-type'), savedPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(args.outDir);
  mkdirSync(outDir, { recursive: true });

  process.stderr.write(`[skechers-run1] PROMPT_VERSION = ${PROMPT_VERSION}\n`);

  // ─── Step 1: pinning fetch (or reuse a locally fetched file) + real admission chain ───

  let rawBytes;
  let contentType = 'text/html; charset=UTF-8';
  if (args.rawHtml) {
    rawBytes = readFileSync(resolve(args.rawHtml));
  } else {
    process.stderr.write(`[skechers-run1] performing PINNING FETCH of ${args.retrievalUrl}\n`);
    const fetched = await fetchPinned(args.retrievalUrl, outDir);
    rawBytes = fetched.bytes;
    contentType = fetched.contentType || contentType;
    process.stderr.write(`[skechers-run1] saved raw bytes to ${fetched.savedPath}\n`);
  }
  const bytesSha256 = sha256Hex(rawBytes);
  process.stderr.write(`[skechers-run1] *** PIN *** raw bytes length = ${rawBytes.length}, sha256 = ${bytesSha256}\n`);
  if (bytesSha256 !== EXPECTED_RAW_BYTES_SHA256) {
    throw new Error(
      `PIN MISMATCH: fetched raw bytes sha256 ${bytesSha256} does not match the pinned `
      + `intake-pin.json value ${EXPECTED_RAW_BYTES_SHA256}. Aborting -- do not proceed on `
      + 'an unverified source document.',
    );
  }
  process.stderr.write('[skechers-run1] pin verified OK against tests/fixtures/canonical-v2/skechers-first-live-run/intake-pin.json\n');

  const retrievalPolicyDigest = sha256Hex(
    'Skechers first live run pinning fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", no redirects followed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: args.retrievalUrl,
    final_url: args.retrievalUrl,
    status_code: 200,
    content_type: contentType,
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

  const dealKey = `deal:skechers-first-live-run:${sha256Hex(args.retrievalUrl).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-skechers1:${args.retrievalUrl}`);

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

  process.stderr.write(`[skechers-run1] document_hash (raw fetched-file sha256) = ${documentHash}\n`);
  process.stderr.write(`[skechers-run1] canonical_text_sha256 = ${conversion.canonical_text_sha256}\n`);
  process.stderr.write(`[skechers-run1] canonical_text_byte_length = ${conversion.canonical_text_byte_length}\n`);

  // ─── Step 2: sectionize + locate section (no assumptions about heading shape) ───

  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  const kindCounts = {};
  for (const n of tree.nodes) kindCounts[n.kind] = (kindCounts[n.kind] || 0) + 1;
  process.stderr.write(`[skechers-run1] sectionizer node count = ${tree.nodes.length}, by kind = ${JSON.stringify(kindCounts)}\n`);

  const node = findSectionByReference(tree, args.sectionRef);
  if (!node) {
    throw new Error(
      `section reference "${args.sectionRef}" could not be resolved against the tree `
      + `(node count=${tree.nodes.length}, kinds=${JSON.stringify(kindCounts)}). `
      + 'Aborting per instruction: do not guess a section.',
    );
  }
  if (node.kind !== 'SECTION' || !/capitalization/i.test(node.heading || '')) {
    throw new Error(
      `section "${args.sectionRef}" resolved to an unexpected node: kind=${node.kind}, `
      + `heading=${JSON.stringify(node.heading)}, start=${node.start}, end=${node.end}. `
      + 'Expected a SECTION node with a heading containing "Capitalization". Aborting.',
    );
  }
  process.stderr.write(`[skechers-run1] resolved section ${args.sectionRef}: kind=${node.kind} heading=${JSON.stringify(node.heading)} start=${node.start} end=${node.end} toc_corroborated=${node.toc_corroborated}\n`);
  const governedSectionText = fullText.slice(node.start, node.end);
  process.stderr.write(`[skechers-run1] section opening excerpt: ${JSON.stringify(governedSectionText.slice(0, 200))}\n`);

  // ─── Step 3: LIVE model call ───

  const contractBundle = compileFixtureContractV13();
  const definitions = { known_definitions: [] };
  const telemetry = { calls: [] };

  const providerOptions = {
    model: `claude-sonnet-5-via-claude-code-cli(${args.model})`,
    client: makeMeasuredCliClient(args.model, telemetry, args.fixtureOut),
    maxRetries: 0,
  };
  const provider = createAnthropicProvider(providerOptions);

  process.stderr.write('[skechers-run1] starting LIVE extraction call...\n');
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
  process.stderr.write(`[skechers-run1] extraction run complete in ${runWallClockMs}ms\n`);

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: runWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates -> buildNativeWriteSet (WITH resolution context) -> validate ───

  if (!args.agreementDate) {
    process.stderr.write('[skechers-run1] WARNING: no --agreement-date supplied; passing agreement_date=null (open world for TEMPORAL family)\n');
  }

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: args.agreementDate || null,
  });
  writeFileSync(resolve(outDir, 'resolution.json'), JSON.stringify(resolution, null, 2));

  const reviewQueueArtifact = buildReviewQueueArtifact({
    resolution,
    run_receipt_id: receipt.run_receipt_id,
  });
  writeFileSync(resolve(outDir, 'review-queue.json'), serialiseReviewQueueArtifact(reviewQueueArtifact));

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: fullText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution, // component-row minting for assertion-node claim subjects
  });
  writeFileSync(resolve(outDir, 'adapter-result.json'), JSON.stringify(adapterResult, null, 2));

  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = {
    ...adapterResult.write_set,
    provisions: [...provisionsById.values()],
    components: adapterResult.write_set.components || [],
  };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  writeFileSync(resolve(outDir, 'validation.json'), JSON.stringify(validation, null, 2));

  // ─── Step 5: instruments come free in the receipt (coverage_proxies,
  // limb_enumeration_scan) -- no cross-run comparator, no second recording
  // of THIS section exists yet. ───

  process.stderr.write('[skechers-run1] === SUMMARY ===\n');
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
  process.stderr.write(`write_set claims: ${adapterResult.write_set.claims.length}, components: ${(adapterResult.write_set.components || []).length}, adapter residuals: ${adapterResult.residuals.length}\n`);
  process.stderr.write(`validation accepted: ${validation.accepted}, residuals: ${validation.residuals.length}, quarantines: ${validation.quarantines.length}\n`);
  process.stderr.write(`review_queue artifact: ${reviewQueueArtifact.review_queue.length} item(s), review_queue_artifact_id=${reviewQueueArtifact.review_queue_artifact_id}\n`);
  process.stderr.write(`publishable claims: ${validation.publishableWriteSet ? validation.publishableWriteSet.claims.length : 'n/a'}\n`);
  const coverageProxies = (receipt.coverage_proxies || [])[0];
  const limbEnumerationScan = (receipt.limb_enumeration_scan || [])[0];
  if (coverageProxies) {
    process.stderr.write(`coverage-proxies (receipt-native): coverage_share=${coverageProxies.coverage_share} qualifier_to_marker_ratio=${coverageProxies.qualifier_to_marker_ratio} signals=${JSON.stringify((coverageProxies.signals || []).map((s) => s.reason))}\n`);
  }
  if (limbEnumerationScan) {
    process.stderr.write(`limb-enumeration-scan (receipt-native): disagreement_count=${limbEnumerationScan.disagreement_count}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[skechers-run1] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
