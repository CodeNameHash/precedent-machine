#!/usr/bin/env node
/**
 * scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs
 *
 * SCOPE-CORRECTED re-run of the Modiv / Global Net Lease TERMINATION_FEE
 * family extraction. The prior run (evidence/canonical-v2/
 * m3-pilot-20260804-fresh/final-output/execution-result.json, work item
 * `modiv-termination-fee-7-3`) pinned ONLY Section 7.3 ("Fees and
 * Expenses"). That run found all six/seven fee-trigger candidates but
 * rejected every one of them TRIGGER_UNCORROBORATED, because Section 7.3
 * states every trigger as a BARE cross-reference to Section 7.1
 * ("Termination") -- e.g. "by the Company pursuant to Section 7.1(c)(i)" --
 * with no operative description of the ground itself, and Section 7.1 was
 * not in the governed scope. Separately, zero TERMINATION_FEE_AMOUNT
 * candidates were ever proposed, because the dollar figures behind
 * "Company Termination Fee" / "Company Base Amount" / "Parent Termination
 * Fee" / "Parent Base Amount" live in Section 8.12 ("Definitions"),
 * specifically sub-clauses (f), (m), (gg) and (vv) as PRINTED in the
 * agreement -- also not in scope.
 *
 * THIS RUN pins Section 7.1 and Section 8.12 alongside Section 7.3, all
 * three dispatched under the SAME `TERMINATION_FEE` section family (one
 * family, per the run's own brief: this is a scope correction, not a
 * family expansion), via explicit `section_family_assignments` -- matching
 * `SECTION_FAMILY_MANIFEST_ASSIGNED` provenance the prior run's own receipt
 * already carried for 7.3, never the classifier.
 *
 * WHY "8.12" AS ONE WHOLE SECTION, NOT "8.12(gg)"/"8.12(vv)" DIRECTLY. The
 * printed labels "(gg)" and "(vv)" are real (the agreement's own Section
 * 8.12(m) formula cross-cites "Section 8.12(f)" as "Company Base Amount",
 * and Section 8.12 itself, read start to finish, defines "Parent Base
 * Amount" at printed label (gg) and "Parent Termination Fee" at printed
 * label (vv)) -- but this filing's Section 8.12 restarts its own internal
 * enumeration at "(z)" (a single defined term, "Intellectual Property",
 * whose OWN internal sub-clauses happen to be lettered (a)-(f)) and the
 * deterministic sectionizer's marker-depth heuristic reads the following
 * "(aa)" as a CHILD of that inner enumeration rather than the outer list's
 * next sibling. The result: `findSectionByReference` resolves "8.12(f)" and
 * "8.12(m)" cleanly (they sit before the "(z)" collision) but returns
 * nothing for "8.12(gg)" or "8.12(vv)" -- confirmed empirically against
 * this exact filing before this script was written (see the run's own
 * companion evidence directory). Pinning the whole "8.12" node sidesteps
 * the addressing bug entirely rather than guessing a nested-chain
 * reference string, and costs nothing extra in call count (one section
 * reference, one producer call, same as pinning any single sub-clause
 * would have been).
 *
 * SOURCE. Reuses Modiv's ALREADY-ADMITTED, already-committed raw HTML at
 * tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm
 * (no live fetch: this is a re-run against the same admitted source, not a
 * new pinning fetch). This script independently re-derives and asserts
 * both the raw-bytes SHA-256 and the canonical-text SHA-256 against the
 * values already committed in tests/fixtures/canonical-v2/
 * modiv-first-live-run/intake-pin.json AND against the prior termination-
 * fee run's own `run_receipt.source_sha256` / `document_hash` -- refusing
 * to proceed on any mismatch, rather than trusting either committed value
 * blindly.
 *
 * MODEL BACKEND. No ANTHROPIC_API_KEY is assumed. Drives the model via the
 * Claude Code subscription CLI (`claude -p`), injected through
 * createAnthropicProvider's `client` seam, capturing full usage/cost/
 * duration telemetry from `--output-format json`. `maxRetries: 0` (matching
 * every prior real Modiv/F28 live-run script): a failed call fails the run,
 * it does not silently retry and blur the call count this run exists partly
 * to report.
 *
 * Usage:
 *   node scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs \
 *     [--raw-html <path, default tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm>] \
 *     [--section-refs <comma-separated, default "7.1,7.3,8.12">] \
 *     [--out-dir <default evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805>] \
 *     [--agreement-date <default 2026-05-03, read from the agreement's own "Dated as of" preamble>] \
 *     [--model <claude CLI model alias, default "sonnet">]
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
} from 'node:fs';
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
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { PROMPT_VERSION: TERMINATION_FEE_PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/termination-fee-producer-prompt');
const { runNativeExtraction, NativeExtractionRunError } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const {
  buildReviewQueueArtifact, serialiseReviewQueueArtifact,
} = require('../lib/canonical-v2/native-producer/review-queue-artifact');

const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const DEFAULT_RAW_HTML_PATH = 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm';

// Pinned independently, ahead of this run, against BOTH
// tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json AND the
// prior termination-fee run's own run_receipt (evidence/canonical-v2/
// m3-pilot-20260804-fresh/final-output/execution-result.json, work item
// modiv-termination-fee-7-3, run_receipt.source_sha256 / .document_hash).
// This script re-verifies both below rather than trusting either blindly.
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

const DEFAULT_SECTION_REFS = ['7.1', '7.3', '8.12'];
const TERMINATION_FEE_FAMILY = 'TERMINATION_FEE';

// Expected heading per pinned section reference -- asserted against the
// real sectionizer tree before any model call is made, so a numbering
// drift fails loudly instead of silently extracting the wrong text. (Verified
// empirically against this exact filing before this script was written:
// "7.1" -> SECTION heading "Termination" [321761,331500]; "7.3" -> SECTION
// heading "Fees and Expenses" [333615,340109]; "8.12" -> SECTION heading
// "Definitions" [360030,414712].)
const EXPECTED_HEADINGS = {
  '7.1': /Termination/i,
  '7.3': /Fees/i,
  '8.12': /Definitions/i,
};

function parseArgs(argv) {
  const out = {
    model: 'sonnet',
    rawHtml: DEFAULT_RAW_HTML_PATH,
    sectionRefs: DEFAULT_SECTION_REFS.slice(),
    agreementDate: '2026-05-03',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--raw-html': out.rawHtml = argv[++i]; break;
      case '--section-refs': out.sectionRefs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--out-dir': out.outDir = argv[++i]; break;
      case '--agreement-date': out.agreementDate = argv[++i]; break;
      case '--model': out.model = argv[++i]; break;
      default: throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  if (!out.outDir) throw new Error('--out-dir is required');
  if (out.sectionRefs.length === 0) throw new Error('--section-refs must name at least one section reference');
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

// Sections are processed by native-extraction-run.js in the exact order of
// the `section_references` array it is given (see that module's `resolved
// = references.map(...)` then `for (const { reference, node } of resolved)`).
// This client relies on that documented ordering -- never on parsing the
// prompt text -- to label each recorded call/fixture with the section
// reference it belongs to, and writes ONE recorded-response fixture PER
// CALL (the single-section example scripts this is based on write to one
// fixed path, which would silently overwrite itself across multiple calls
// in a multi-section run).
function makeMeasuredCliClient(model, telemetry, orderedSectionRefs, fixtureOutDir) {
  return {
    messages: {
      async create(params) {
        const callIndex = telemetry.calls.length;
        const sectionReference = orderedSectionRefs[callIndex] || `unknown-call-${callIndex}`;
        const prompt = flattenMessages(params);
        const startedAt = Date.now();
        const rawCliOutput = await runClaudeCli(prompt, { model });
        const wallClockMs = Date.now() - startedAt;
        const parsed = JSON.parse(rawCliOutput);
        if (parsed.is_error) throw new Error(`claude -p error (section ${sectionReference}): ${String(parsed.result).slice(0, 500)}`);
        telemetry.calls.push({
          call_index: callIndex,
          section_reference: sectionReference,
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
        const fixtureSlug = sectionReference.replace(/[^a-zA-Z0-9.]+/g, '_');
        writeFileSync(resolve(fixtureOutDir, `native-producer-recorded-response-${fixtureSlug}.json`), JSON.stringify({
          schema_version: 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1',
          model: `claude-sonnet-5 (served via Claude Code subscription CLI, \`claude -p --model ${model}\`, no ANTHROPIC_API_KEY available in this environment)`,
          recorded_at: new Date().toISOString(),
          section_reference: sectionReference,
          note: 'Modiv TERMINATION_FEE scope-correction run (7.1 + 7.3 + 8.12 pinned together, all dispatched as '
            + `TERMINATION_FEE via section_family_assignments), PROMPT_VERSION ${TERMINATION_FEE_PROMPT_VERSION}. `
            + 'request_messages omitted here; raw_response_text is the model\'s literal output including its '
            + '```json fence, byte-for-byte as returned.',
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

  const runStartedAt = Date.now();
  process.stderr.write(`[modiv-termfee-scope-fix] TERMINATION_FEE PROMPT_VERSION = ${TERMINATION_FEE_PROMPT_VERSION}\n`);
  process.stderr.write(`[modiv-termfee-scope-fix] section_references = ${JSON.stringify(args.sectionRefs)}\n`);

  // ─── Step 1: reuse the ALREADY-ADMITTED committed source (no live fetch) ───

  const rawHtmlPath = resolve(args.rawHtml);
  if (!existsSync(rawHtmlPath)) {
    throw new Error(`committed raw HTML not found at ${rawHtmlPath} -- refusing to fall back to a live fetch`);
  }
  const rawBytes = readFileSync(rawHtmlPath);
  const rawBytesSha256 = sha256Hex(rawBytes);
  if (rawBytesSha256 !== EXPECTED_RAW_BYTES_SHA256) {
    throw new Error(`raw HTML at ${rawHtmlPath} does not match the pinned hash: expected ${EXPECTED_RAW_BYTES_SHA256}, got ${rawBytesSha256}`);
  }
  process.stderr.write(`[modiv-termfee-scope-fix] reused committed raw HTML at ${rawHtmlPath}, sha256=${rawBytesSha256} (MATCHES pin)\n`);

  const retrievalPolicyDigest = sha256Hex(
    'Modiv TERMINATION_FEE scope-correction run: reuse of the already-admitted, already-committed raw HTML; no new network fetch performed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: retrievalPolicyDigest,
    redirect_count: 0,
    response_bytes: rawBytes,
  });

  const conversion = convertSecHtmlToCanonicalText(capture);
  if (conversion.canonical_text_sha256 !== EXPECTED_CANONICAL_TEXT_SHA256) {
    throw new Error(`canonical text sha256 mismatch: expected ${EXPECTED_CANONICAL_TEXT_SHA256}, got ${conversion.canonical_text_sha256}`);
  }
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new Error(`independent canonical-text verification did not PASS: ${verification.verification_status}`);
  }
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  const dealKey = `deal:modiv-termfee-scope-fix:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-modiv-termfee-scope-fix:${MODIV_RETRIEVAL_URL}`);

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

  process.stderr.write(`[modiv-termfee-scope-fix] document_hash = ${documentHash}\n`);
  process.stderr.write(`[modiv-termfee-scope-fix] canonical_text_sha256 = ${conversion.canonical_text_sha256} (MATCHES prior run's source_sha256)\n`);

  writeFileSync(resolve(outDir, 'source-reference.json'), JSON.stringify({
    schema_version: 'MODIV_TERMFEE_SCOPE_FIX_SOURCE_REFERENCE/V1',
    reused_committed_raw_html: rawHtmlPath.includes(process.cwd()) ? rawHtmlPath.slice(process.cwd().length + 1) : rawHtmlPath,
    retrieval_url: MODIV_RETRIEVAL_URL,
    raw_bytes_length: rawBytes.length,
    raw_bytes_sha256: rawBytesSha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    canonical_text_sha256: conversion.canonical_text_sha256,
    verification_status: verification.verification_status,
    document_hash: documentHash,
    matches_pin_at: 'tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json',
    matches_prior_termination_fee_run_receipt: 'evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/execution-result.json (work_item_id modiv-termination-fee-7-3, run_receipt.source_sha256 / .document_hash)',
    note: 'REUSE, not a pinning fetch. No network call was made by this script.',
  }, null, 2));

  // ─── Step 2: sectionize + locate + assert every requested section BEFORE any model call ───

  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  const kindCounts = {};
  for (const n of tree.nodes) kindCounts[n.kind] = (kindCounts[n.kind] || 0) + 1;
  process.stderr.write(`[modiv-termfee-scope-fix] sectionizer node count = ${tree.nodes.length}, by kind = ${JSON.stringify(kindCounts)}\n`);

  const resolvedNodesByRef = {};
  for (const ref of args.sectionRefs) {
    const node = findSectionByReference(tree, ref);
    if (!node) {
      throw new Error(
        `section reference "${ref}" could not be resolved against the tree `
        + `(node count=${tree.nodes.length}). Aborting per instruction: do not guess a section.`,
      );
    }
    const expectedHeading = EXPECTED_HEADINGS[ref];
    if (node.kind !== 'SECTION' || (expectedHeading && !expectedHeading.test(node.heading || ''))) {
      throw new Error(
        `section "${ref}" resolved to an unexpected node: kind=${node.kind}, heading=${JSON.stringify(node.heading)}, `
        + `start=${node.start}, end=${node.end}. Expected a SECTION node${expectedHeading ? ` with heading matching ${expectedHeading}` : ''}. Aborting.`,
      );
    }
    resolvedNodesByRef[ref] = node;
    process.stderr.write(`[modiv-termfee-scope-fix] resolved ${ref}: heading=${JSON.stringify(node.heading)} start=${node.start} end=${node.end} bytes=${node.end - node.start}\n`);
  }

  writeFileSync(resolve(outDir, 'section-location-scan.json'), JSON.stringify({
    node_count: tree.nodes.length,
    kind_counts: kindCounts,
    requested_section_references: args.sectionRefs,
    resolved: args.sectionRefs.map((ref) => ({
      section_reference: ref,
      heading: resolvedNodesByRef[ref].heading,
      start: resolvedNodesByRef[ref].start,
      end: resolvedNodesByRef[ref].end,
      byte_length: resolvedNodesByRef[ref].end - resolvedNodesByRef[ref].start,
    })),
    all_7x_and_8_12_nodes: tree.nodes
      .filter((n) => /^7\.[0-9]|^8\.12/.test(n.reference || ''))
      .map((n) => ({
        kind: n.kind, reference: n.reference, heading: n.heading, start: n.start, end: n.end,
      })),
  }, null, 2));

  // ─── Step 3: LIVE model calls, one per pinned section, all dispatched TERMINATION_FEE ───

  const contractBundle = compileFixtureContractV34();
  const definitions = { known_definitions: [] };
  const telemetry = { calls: [] };

  const sectionFamilyAssignments = args.sectionRefs.map((section_reference) => ({
    section_reference,
    family_id: TERMINATION_FEE_FAMILY,
  }));

  const providerOptions = {
    model: `claude-sonnet-5-via-claude-code-cli(${args.model})`,
    client: makeMeasuredCliClient(args.model, telemetry, args.sectionRefs, outDir),
    maxRetries: 0,
  };
  const provider = createAnthropicProvider(providerOptions);

  process.stderr.write(`[modiv-termfee-scope-fix] starting ${args.sectionRefs.length} LIVE extraction call(s)...\n`);
  const extractionStart = Date.now();
  let receipt;
  try {
    receipt = await runNativeExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: args.sectionRefs,
      section_family_assignments: sectionFamilyAssignments,
      contract_bundle: contractBundle,
      definitions,
      provider,
    });
  } catch (err) {
    const elapsedMs = Date.now() - runStartedAt;
    process.stderr.write(`[modiv-termfee-scope-fix] EXTRACTION FAILED after ${elapsedMs}ms, ${telemetry.calls.length} call(s) completed: ${err && err.stack ? err.stack : err}\n`);
    writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({
      run_wall_clock_ms: Date.now() - extractionStart, calls: telemetry.calls, failed: true, error: String(err && err.message ? err.message : err),
    }, null, 2));
    throw err;
  }
  const extractionWallClockMs = Date.now() - extractionStart;
  process.stderr.write(`[modiv-termfee-scope-fix] extraction complete in ${extractionWallClockMs}ms, ${telemetry.calls.length} model call(s)\n`);

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: extractionWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates -> buildNativeWriteSet (WITH resolution context) -> validate ───

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
    resolution,
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

  const totalElapsedMs = Date.now() - runStartedAt;

  writeFileSync(resolve(outDir, 'run-manifest.json'), JSON.stringify({
    schema_version: 'MODIV_TERMFEE_SCOPE_FIX_RUN_MANIFEST/V1',
    script: 'scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs',
    purpose: 'Scope-corrected re-run of TERMINATION_FEE family for Modiv/Global Net Lease: 7.1 + 7.3 + 8.12 pinned together (prior run pinned 7.3 only).',
    prior_run_compared_against: {
      file: 'evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/execution-result.json',
      work_item_id: 'modiv-termination-fee-7-3',
    },
    section_references: args.sectionRefs,
    section_family_assignments: sectionFamilyAssignments,
    contract_bundle_version: 'compileFixtureContractV34',
    termination_fee_prompt_version: TERMINATION_FEE_PROMPT_VERSION,
    agreement_date: args.agreementDate,
    model_cli_alias: args.model,
    max_retries: 0,
    run_started_at: new Date(runStartedAt).toISOString(),
    total_elapsed_ms: totalElapsedMs,
    extraction_wall_clock_ms: extractionWallClockMs,
    model_call_count: telemetry.calls.length,
    run_receipt_id: receipt.run_receipt_id,
    document_hash: documentHash,
    source_sha256: conversion.canonical_text_sha256,
  }, null, 2));

  process.stderr.write('[modiv-termfee-scope-fix] === SUMMARY ===\n');
  process.stderr.write(`total_elapsed_ms: ${totalElapsedMs}, model_call_count: ${telemetry.calls.length}\n`);
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`undispatched_sections: ${receipt.undispatched_section_count}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
  process.stderr.write(`conditional_termination_fee_values: ${(resolution.conditional_termination_fee_values || []).length}\n`);
  process.stderr.write(`write_set claims: ${adapterResult.write_set.claims.length}, components: ${(adapterResult.write_set.components || []).length}, adapter residuals: ${adapterResult.residuals.length}\n`);
  process.stderr.write(`validation accepted: ${validation.accepted}, residuals: ${validation.residuals.length}, quarantines: ${validation.quarantines.length}\n`);
  process.stderr.write(`review_queue artifact: ${reviewQueueArtifact.review_queue.length} item(s)\n`);
  process.stderr.write(`publishable claims: ${validation.publishableWriteSet ? validation.publishableWriteSet.claims.length : 'n/a'}\n`);
}

main().catch((err) => {
  process.stderr.write(`[modiv-termfee-scope-fix] FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
