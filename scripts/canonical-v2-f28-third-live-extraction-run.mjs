#!/usr/bin/env node
/**
 * scripts/canonical-v2-f28-third-live-extraction-run.mjs
 *
 * F28 THIRD live end-to-end run, merge gate 4 of
 * docs/superpowers/plans/2026-08-01-claim-identity-provenance-plan.md: same
 * real pipeline as scripts/canonical-v2-f28-second-live-extraction-run.mjs
 * (raw HTML -> real admission chain -> canonical text -> real sectionizer ->
 * LIVE model call, now under PROMPT_VERSION 4 automatically because the
 * committed prompt module is PROMPT_VERSION 4 -> resolveCandidates ->
 * buildNativeWriteSet -> real validateResolvedCanonicalWriteSet), against
 * the SAME filing and governed section as the two prior F28 runs.
 *
 * ADDITIONS over the run-2 driver:
 *   - resolveCandidates is called with contract_vocabulary from
 *     compileFixtureContractV13() (the only fixture-contract version whose
 *     claim vocabulary registers REPRESENTATION_MEASUREMENT_DATE -- see
 *     lib/canonical-v2/contract-bundle.js) and agreement_date '2026-04-18'
 *     (the pinned QXO/TopBuild signing date used throughout this repo's
 *     fixtures, e.g. tests/canonical-v2-measurement-date-parse.test.js).
 *   - after resolution, the three Task 8 instruments run and their reports
 *     are written as JSON artifacts:
 *       - run-comparator.js: compareRuns() against the SECOND live run's
 *         recording (tests/fixtures/canonical-v2/f28-second-live-run/...).
 *       - coverage-proxies.js: computeCoverageProxies() over this run's own
 *         proposals against the governed section's own text.
 *       - limb-enumeration-scan.js: scanLimbEnumeration() over this run's
 *         own proposed limb paths against the governed section's own text.
 *   All three consume a projection out of the recorded
 *   NATIVE_PRODUCER_RECORDED_RESPONSE/V1 raw JSON, the same test-only
 *   adapter pattern used in tests/canonical-v2-run-comparator.test.js,
 *   tests/canonical-v2-coverage-proxies.test.js and
 *   tests/canonical-v2-limb-enumeration-scan.test.js (locateSpan via
 *   indexOfIgnoringZeroWidth, PROMPT_VERSION-2-shape `limb_path` arrays).
 *
 * MODEL BACKEND. No ANTHROPIC_API_KEY is assumed. Drives the model via the
 * Claude Code subscription CLI (`claude -p`), injected through
 * createAnthropicProvider's `client` seam, capturing full usage/cost/
 * duration telemetry from `--output-format json`.
 *
 * Usage:
 *   node scripts/canonical-v2-f28-third-live-extraction-run.mjs \
 *     --raw-html <path to fetched .htm file> \
 *     --retrieval-url <the exact https://www.sec.gov/... URL it came from> \
 *     --section-ref <section reference to extract, e.g. "III-INTRO(b)"> \
 *     --out-dir <directory to write receipt/resolution/validation/telemetry/instrument JSON> \
 *     --fixture-out <path to write the NATIVE_PRODUCER_RECORDED_RESPONSE/V1 fixture>
 *     [--model <cli model alias, default "sonnet">]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { indexOfIgnoringZeroWidth, normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');
const { compareRuns } = require('../lib/canonical-v2/native-producer/run-comparator');
const { computeCoverageProxies } = require('../lib/canonical-v2/native-producer/coverage-proxies');
const { scanLimbEnumeration } = require('../lib/canonical-v2/native-producer/limb-enumeration-scan');

const AGREEMENT_DATE = '2026-04-18'; // pinned QXO/TopBuild signing date (repo fixtures)
const COMPARATOR_SECTION_REFERENCE = '3.1(b)'; // human section id used by both prior F28 run recordings

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
          note: 'F28 THIRD live run against real QXO/TopBuild Section 3.1(b) Capital Structure text, PROMPT_VERSION 4 (claim identity/qualifier-classification/provenance plan, merge gate 4). '
            + 'request_messages omitted here (see the plan and the prompt builder for the exact content); raw_response_text is the model\'s literal output including its ```json fence, byte-for-byte as returned.',
          raw_response_text: rawResponseText,
        }, null, 2));
        return { content: [{ type: 'text', text: rawResponseText }] };
      },
    },
  };
}

// ─── Task 8 instrument projections (test-only adapter pattern, mirrored
// from tests/canonical-v2-run-comparator.test.js / -coverage-proxies /
// -limb-enumeration-scan: these files own the projection from raw producer
// JSON into each instrument's small input shape; the libs themselves stay
// pipeline-agnostic). ───

function locateSpan(sourceText, quote) {
  const startChar = indexOfIgnoringZeroWidth(sourceText, quote);
  if (startChar === -1) return null;
  const normalisedNeedleLength = normaliseForMatching(quote).length;
  let consumed = 0;
  let endChar = startChar;
  while (consumed < normalisedNeedleLength && endChar < sourceText.length) {
    if (!/[​‌‍‎‏﻿­]/.test(sourceText[endChar])) {
      consumed += 1;
    }
    endChar += 1;
  }
  const byteStart = Buffer.byteLength(sourceText.slice(0, startChar), 'utf8');
  const byteEnd = byteStart + Buffer.byteLength(sourceText.slice(startChar, endChar), 'utf8');
  return { start: byteStart, end: byteEnd };
}

// PROMPT_VERSION-2-and-later shape: nested `limb_path` arrays, one
// representation per governing section, representation-level `qualifiers`
// each carrying `attachment.governs_path`, and limb-level `qualifiers` when
// present. Both run 2 and this run 3 share this shape.
function nestedShapeSectionView({ runId, sectionReference, sourceText, parsed }) {
  const limbs = [];
  const qualifiers = [];
  for (const representation of parsed.representation_instances || []) {
    for (const limb of representation.limbs || []) {
      const limbPath = limb.limb_path;
      limbs.push({
        limb_path: limbPath,
        quote: limb.assertion_quote,
        span: locateSpan(sourceText, limb.assertion_quote),
      });
      for (const qualifier of limb.qualifiers || []) {
        qualifiers.push({ limb_path: limbPath, kind: qualifier.kind || null, quote: qualifier.quote });
      }
    }
    for (const qualifier of representation.qualifiers || []) {
      const governsPath = (qualifier.attachment && qualifier.attachment.governs_path) || null;
      qualifiers.push({ limb_path: governsPath, kind: qualifier.kind || null, quote: qualifier.quote });
    }
  }
  return { run_id: runId, section_reference: sectionReference, limbs, qualifiers };
}

function loadRecordedResponse(absolutePath) {
  const recording = JSON.parse(readFileSync(absolutePath, 'utf8'));
  const parsed = parseJSON(recording.raw_response_text);
  if (!parsed) throw new Error(`recorded fixture at ${absolutePath} did not parse via parseJSON`);
  return parsed;
}

function collectAssertionSpansAndProposedLimbPaths({ sourceText, parsed }) {
  const assertionSpans = [];
  const proposedLimbPaths = [];
  const qualifiers = [];
  for (const representation of parsed.representation_instances || []) {
    for (const limb of representation.limbs || []) {
      proposedLimbPaths.push(limb.limb_path);
      const span = locateSpan(sourceText, limb.assertion_quote);
      if (span) assertionSpans.push(span);
      for (const qualifier of limb.qualifiers || []) qualifiers.push({ quote: qualifier.quote });
    }
    for (const qualifier of representation.qualifiers || []) qualifiers.push({ quote: qualifier.quote });
  }
  return { assertionSpans, proposedLimbPaths, qualifiers };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(args.outDir);
  mkdirSync(outDir, { recursive: true });

  process.stderr.write(`[f28-run3] PROMPT_VERSION = ${PROMPT_VERSION}\n`);

  // ─── Step 1/2: raw HTML -> real admission chain -> canonical text ───

  const rawBytes = readFileSync(resolve(args.rawHtml));
  const bytesSha256 = sha256Hex(rawBytes);
  process.stderr.write(`[f28-run3] raw bytes sha256 = ${bytesSha256} (length ${rawBytes.length})\n`);

  const retrievalPolicyDigest = sha256Hex(
    'F28 third live run research fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", ~400ms between requests, no redirects followed.',
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

  const dealKey = `deal:f28-third-live-run:${sha256Hex(args.retrievalUrl).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-run3:${args.retrievalUrl}`);

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

  process.stderr.write(`[f28-run3] document_hash (raw fetched-file sha256) = ${documentHash}\n`);
  process.stderr.write(`[f28-run3] canonical_text_sha256 = ${conversion.canonical_text_sha256}\n`);
  process.stderr.write(`[f28-run3] canonical_text_byte_length = ${conversion.canonical_text_byte_length}\n`);

  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  process.stderr.write(`[f28-run3] sectionizer node count = ${tree.nodes.length}\n`);

  const node = findSectionByReference(tree, args.sectionRef);
  if (!node) throw new Error(`section reference "${args.sectionRef}" could not be resolved`);
  process.stderr.write(`[f28-run3] resolved section ${args.sectionRef}: start=${node.start} end=${node.end}\n`);
  const governedSectionText = fullText.slice(node.start, node.end);

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

  process.stderr.write('[f28-run3] starting LIVE extraction call...\n');
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
  process.stderr.write(`[f28-run3] extraction run complete in ${runWallClockMs}ms\n`);

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: runWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates (contract_vocabulary = V13, agreement_date pinned) -> buildNativeWriteSet -> validate ───

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE,
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

  // ─── Task 8 instruments: run-comparator, coverage-proxies, limb-enumeration-scan ───

  process.stderr.write('[f28-run3] running Task 8 instruments...\n');

  const run3Parsed = loadRecordedResponse(resolve(args.fixtureOut));
  const run3SectionView = nestedShapeSectionView({
    runId: 'f28-live-run-3',
    sectionReference: COMPARATOR_SECTION_REFERENCE,
    sourceText: governedSectionText,
    parsed: run3Parsed,
  });

  const run2FixturePath = join(__dirname, '..', 'tests', 'fixtures', 'canonical-v2', 'f28-second-live-run', 'qxo-topbuild-3-1-b-live-response.json');
  const run2Parsed = loadRecordedResponse(run2FixturePath);
  const run2SectionView = nestedShapeSectionView({
    runId: 'f28-live-run-2',
    sectionReference: COMPARATOR_SECTION_REFERENCE,
    sourceText: governedSectionText,
    parsed: run2Parsed,
  });

  const comparisonReport = compareRuns({ run_a: run2SectionView, run_b: run3SectionView });
  writeFileSync(resolve(outDir, 'run-comparator-vs-run2.json'), JSON.stringify(comparisonReport, null, 2));

  const { assertionSpans, proposedLimbPaths, qualifiers } = collectAssertionSpansAndProposedLimbPaths({
    sourceText: governedSectionText,
    parsed: run3Parsed,
  });

  const coverageReport = computeCoverageProxies({
    section_reference: COMPARATOR_SECTION_REFERENCE,
    source_text: governedSectionText,
    assertion_spans: assertionSpans,
    qualifiers,
  });
  writeFileSync(resolve(outDir, 'coverage-proxies.json'), JSON.stringify(coverageReport, null, 2));

  const limbEnumerationReport = scanLimbEnumeration({
    section_reference: COMPARATOR_SECTION_REFERENCE,
    source_text: governedSectionText,
    proposed_limb_paths: proposedLimbPaths,
  });
  writeFileSync(resolve(outDir, 'limb-enumeration-scan.json'), JSON.stringify(limbEnumerationReport, null, 2));

  process.stderr.write('[f28-run3] === SUMMARY ===\n');
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
  process.stderr.write(`write_set claims: ${adapterResult.write_set.claims.length}, adapter residuals: ${adapterResult.residuals.length}\n`);
  process.stderr.write(`validation accepted: ${validation.accepted}, residuals: ${validation.residuals.length}, quarantines: ${validation.quarantines.length}\n`);
  process.stderr.write(`publishable claims: ${validation.publishableWriteSet ? validation.publishableWriteSet.claims.length : 'n/a'}\n`);
  process.stderr.write(`run-comparator (run2 vs run3): limb_disagreement=${comparisonReport.summary.limb_disagreement_count} qualifier_disagreement=${comparisonReport.summary.qualifier_disagreement_count}\n`);
  process.stderr.write(`coverage-proxies: coverage_share=${coverageReport.coverage_share} qualifier_to_marker_ratio=${coverageReport.qualifier_to_marker_ratio} signals=${JSON.stringify(coverageReport.signals.map((s) => s.reason))}\n`);
  process.stderr.write(`limb-enumeration-scan: disagreement_count=${limbEnumerationReport.disagreement_count}\n`);
}

main().catch((err) => {
  process.stderr.write(`[f28-run3] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
