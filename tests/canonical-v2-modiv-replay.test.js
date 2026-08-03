'use strict';

/**
 * Replays Modiv / Global Net Lease's recorded first live response without a
 * network fetch or model call. The raw HTML is the already-pinned identical
 * source retained with the MAE fixture. This confirms that admission, native
 * compilation, resolution, write-set construction, and validation remain
 * reproducible from the recorded response.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { parseJSON } = require('../lib/parser-v2/parse-json');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run');
const RAW_HTML = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

function buildRealAdmission() {
  const pin = load('intake-pin.json');
  const rawBytes = fs.readFileSync(RAW_HTML);
  assert.equal(rawBytes.length, pin.raw_bytes_length);
  assert.equal(sha256Hex(rawBytes), pin.raw_bytes_sha256);

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: pin.retrieval_url,
    final_url: pin.retrieval_url,
    status_code: pin.status_code,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: pin.retrieved_at,
    retrieval_policy_digest: sha256Hex(
      'Modiv/Global Net Lease first live run pinning fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", no redirects followed.',
    ),
    redirect_count: pin.redirect_count,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  assert.equal(conversion.canonical_text_sha256, pin.canonical_text_sha256);
  assert.equal(conversion.canonical_text_byte_length, pin.canonical_text_byte_length);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: 'deal:modiv-first-live-run:32065211e4688625',
    deal_admission_id: '691a9ce8c6cde0f49d7ebf228c1bf2876562fdf1b3dd792a8444ae1f3f8d55ae',
    source_ordinal: 0,
  });
  return { fullText: conversion.canonical_text, documentHash: admittedSourceContext.document_hash, admittedSourceContext };
}

function loadRecordedResponse() {
  const parsed = parseJSON(load('native-producer-recorded-response.json').raw_response_text);
  assert.ok(parsed, 'recorded response must remain valid fence-stripped JSON');
  return parsed;
}

test('Modiv fixture set remains internally consistent', () => {
  const receipt = load('run-receipt.json');
  const resolution = load('resolution.json');
  const adapter = load('adapter-result.json');
  const validation = load('validation.json');
  const parsed = loadRecordedResponse();

  assert.equal(receipt.compiled_candidates.length, 66);
  assert.equal(receipt.evidence_residual_count, 0);
  assert.equal(receipt.scope_violation_count, 0);
  assert.ok(parsed.representation_instances.length > 0);
  assert.equal(resolution.resolved.length, 1);
  assert.equal(adapter.write_set.claims.length, 1);
  assert.equal(validation.accepted, true);
  assert.equal(validation.publishableWriteSet.claims.length, 1);
});

test('Modiv recorded response replays through admission, resolution, adapter, and validation', async () => {
  const { fullText, documentHash, admittedSourceContext } = buildRealAdmission();
  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  const node = findSectionByReference(tree, '3.2');
  assert.ok(node);
  assert.equal(node.kind, 'SECTION');
  assert.match(node.heading, /capitalization/i);

  const recordedParsed = loadRecordedResponse();
  const contractBundle = compileFixtureContractV13();
  const receipt = await runNativeExtraction({
    source_text: fullText,
    document_hash: documentHash,
    section_references: ['3.2'],
    contract_bundle: contractBundle,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(recordedParsed, governedScope.source_text);
      return {
        provider_id: 'modiv-replay-test/v1',
        model_id: 'claude-sonnet-5 (recorded, Modiv first live run)',
        prompt: 'modiv-replay-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, load('run-receipt.json').compiled_candidates.length);
  assert.equal(receipt.evidence_residual_count, 0);
  assert.equal(receipt.scope_violation_count, 0);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok));

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: '2026-05-03',
  });
  // The recorded 2026-08-01 resolution fixture predates the later qualifier
  // mappings. It resolved one claim. The current governed vocabulary resolves
  // thirteen, while retaining that original measurement-date claim.
  assert.equal(resolution.resolved.length, 13);
  const measurementDates = resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE');
  assert.ok(measurementDates.length > 0);
  assert.ok(measurementDates.some((entry) => entry.claim.canonical_value === '2026-05-03'));

  const resolvedRunReceipt = { ...receipt, compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate) };
  const adapter = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: fullText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution,
  });
  assert.equal(adapter.write_set.claims.length, 11);
  const provisions = new Map(resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]));
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: { ...adapter.write_set, provisions: [...provisions.values()], components: adapter.write_set.components || [] },
    contractBundle,
    admittedSourceContexts: adapter.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  assert.equal(validation.publishableWriteSet.claims.length, 9);
});
