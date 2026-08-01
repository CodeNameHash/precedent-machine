'use strict';

/**
 * tests/canonical-v2-component-rows.test.js
 *
 * End-to-end acceptance tests for docs/superpowers/specs/2026-08-01-
 * component-rows-design.md (closes final-audit M1,
 * docs/handoffs/F28-THIRD-LIVE-RUN.md register item 1): limb-level
 * (ITEM-attached) resolved claims carry assertion-node subject ids that
 * resolve against nothing at validation. This file proves the fix through
 * the REAL pipeline seam -- `resolveCandidates` (candidate-resolution.js,
 * read-only here) mints the limb component tree and rekeys a claim's
 * subject onto an assertion node; `buildNativeWriteSet` (the module this
 * task owns), given that resolution as its new optional `resolution`
 * context, mints the matching `PROVISION_COMPONENT/V1` row and rekeys the
 * claim onto it; `validateResolvedCanonicalWriteSet` accepts the result and
 * the claim lands in `publishableWriteSet.claims`.
 *
 * Per the spec's acceptance list:
 *   1. An ITEM-attached KNOWLEDGE claim, on real 3.1(b) text, travels
 *      resolver -> adapter (with resolution context) -> validator and lands
 *      in `publishableWriteSet.claims` with its subject resolving to a
 *      REPRESENTATION_LIMB component contained in its parent provision.
 *   2. Component ids are permutation-invariant.
 *   3. The F28 third-run recorded fixture replays with zero behaviour
 *      change for its CHAPEAU-only resolved claims.
 *   4. Absent context is a no-op (covered exhaustively in
 *      tests/canonical-v2-native-write-set-adapter.test.js; one direct
 *      check is included here too, against this file's own real-pipeline
 *      fixture, for completeness).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract, compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─── Fixture: identity admitted-source chain (same pattern as
// tests/canonical-v2-native-write-set-adapter.test.js and
// tests/canonical-v2-candidate-resolution.test.js -- see either file's own
// comment for why a hand-built identity source map is required instead of
// running text through the real SEC-HTML converter). ───

function buildIdentityAdmittedSourceContext(text, { dealKey, dealAdmissionId, sourceOrdinal = 0 }) {
  const bytes = Buffer.from(text, 'utf8');
  const byteLength = bytes.length;
  const canonicalTextSha256 = sha256Hex(bytes);
  const compact = {
    schema_version: 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2',
    input_regions: [[0, byteLength, 'TEXT', null]],
    output_mappings: [[0, byteLength, 0, byteLength, 'TEXT']],
  };
  const sourceMapBytes = Buffer.from(canonicalJson(compact), 'utf8');
  const compressed = zlib.deflateRawSync(sourceMapBytes, { level: 9, windowBits: 15, memLevel: 8 });
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compact);

  const sourceResponseContentId = sha256Hex(Buffer.concat([Buffer.from('RESPONSE/V1'), bytes]));
  const intakeCaptureReceiptId = sha256Hex(`INTAKE/V1:${sourceResponseContentId}`);
  const converterDigest = sha256Hex('IDENTITY_CONVERTER/V1');
  const converterConfigDigest = sha256Hex('IDENTITY_CONVERTER_CONFIG/V1');
  const verifierDigest = sha256Hex('IDENTITY_VERIFIER/V1');
  const verificationManifestId = sha256Hex(`VERIFICATION_MANIFEST/V1:${sourceResponseContentId}`);

  const canonicalTextId = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: sourceResponseContentId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
  });

  const conversion = {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    conversion_stage: 'CONVERSION_ONLY',
    verification_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text: text,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_payload_base64: compressed.toString('base64'),
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    canonical_text_id: canonicalTextId,
  };

  const immutableBody = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2',
    source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    response_content_type: 'text/html',
    response_bytes_sha256: sha256Hex(bytes),
    response_byte_length: byteLength,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verifier_digest: verifierDigest,
    verification_manifest_id: verificationManifestId,
  };
  const immutable = {
    ...immutableBody,
    immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', immutableBody),
  };

  const coverageProofDigest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: canonicalTextId,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    discrepancy_count: 0,
  });
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_response_content_id: sourceResponseContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: coverageProofDigest,
  };
  const admission = {
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  };

  const envelopeBody = {
    schema_version: 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    input_status: 'READY_FOR_OFFLINE_PROPOSAL',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    semantic_extraction_status: 'NOT_ATTEMPTED',
  };
  const envelope = {
    ...envelopeBody,
    semantic_extraction_input_envelope_id: contentId('SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', envelopeBody),
  };

  return buildAdmittedSemanticSourceContext({
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    semantic_extraction_input_envelope: envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
  });
}

// ─── Fixture: the real QXO Section 3.1(b) capital-structure text, plus a
// hand-authored KNOWLEDGE qualifier sentence appended in the same governed
// section -- same composition strategy as
// tests/canonical-v2-candidate-resolution.test.js's own KNOWLEDGE fixtures. ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const KNOWLEDGE_QUOTE = 'To the knowledge of the Company, no such default under this Section 3.1(b) exists';

const qxoFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  ' ',
  KNOWLEDGE_QUOTE,
  '.\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const DEAL_KEY = 'deal:component-rows';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:component-rows');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

function itemAttachment(governsPath) {
  return Object.freeze({
    position: 'ITEM',
    governs_path: governsPath,
    ambiguity_signals: { items_grammatically_parallel: true },
  });
}

// A response shape matching capitalisation-producer-prompt.js's
// RESPONSE_SHAPE, run through the REAL anthropic-provider.js `shapeProposals`
// -- the same "real producer-shaping path" discipline
// tests/canonical-v2-candidate-resolution.test.js's own fixtures follow, so
// every proposal this test resolves is genuinely producer-shaped rather than
// a hand-rolled stand-in.
function knowledgeItemResponse() {
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [
        { limb_path: ['(i)'], assertion_quote: LIMB_I_QUOTE, subject: 'capital stock' },
      ],
      qualifiers: [{
        kind: 'KNOWLEDGE',
        code: null,
        quote: KNOWLEDGE_QUOTE,
        attachment: itemAttachment(['(i)']),
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

async function buildKnowledgeItemReceipt() {
  return runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        knowledgeItemResponse(),
        governedScope.source_text,
      );
      return {
        provider_id: 'component-rows-test-knowledge-item/v1',
        model_id: 'stub-model',
        prompt: 'component-rows-test-knowledge-item-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
}

// Dedupe resolveCandidates' per-claim `provision_instance` into the unique
// `provisions` list the spec's `resolution` context wants (point 5): "the
// provisions minted by resolveCandidates (parents for containment)".
function provisionsFrom(resolution) {
  const byId = new Map();
  for (const entry of resolution.resolved) {
    byId.set(entry.provision_instance.provision_instance_id, entry.provision_instance);
  }
  return [...byId.values()];
}

// ─── Acceptance 1: end-to-end resolver -> adapter -> validator ───

test('an ITEM-attached KNOWLEDGE claim travels resolver -> adapter (with resolution) -> validator and publishes, subject resolving to a REPRESENTATION_LIMB component contained in its parent provision', async () => {
  const receipt = await buildKnowledgeItemReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const knowledgeEntry = resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'KNOWLEDGE_QUALIFIER',
  );
  assert.ok(knowledgeEntry, 'the ITEM-attached KNOWLEDGE qualifier resolved to KNOWLEDGE_QUALIFIER');
  assert.equal(knowledgeEntry.claim.attributes.attachment.position, 'ITEM');
  // Sanity: this is genuinely a limb-level (assertion-node) subject, not the
  // section-level provision -- the whole point of the M1 gap this closes.
  assert.notEqual(knowledgeEntry.claim.subject_occurrence_id, knowledgeEntry.provision_instance.provision_instance_id);
  assert.equal(resolution.limb_component_trees.length, 1);

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const provisions = provisionsFrom(resolution);

  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: { provisions, limb_component_trees: resolution.limb_component_trees },
  });

  assert.equal(adapterResult.write_set.claims.length, 1);
  assert.equal(adapterResult.write_set.components.length, 1);
  const [component] = adapterResult.write_set.components;
  assert.equal(component.schema_version, 'PROVISION_COMPONENT/V1');
  assert.equal(component.component_key, 'REPRESENTATION_LIMB');
  assert.equal(component.parent_provision_instance_id, knowledgeEntry.provision_instance.provision_instance_id);

  const [claim] = adapterResult.write_set.claims;
  assert.equal(claim.claim_definition_key, 'KNOWLEDGE_QUALIFIER');
  assert.equal(claim.canonical_value, true);
  assert.equal(claim.subject_occurrence_id, component.provision_component_id);

  // The join is recorded, never inferred (point 4).
  assert.equal(adapterResult.component_subject_map.length, 1);
  assert.equal(adapterResult.component_subject_map[0].provision_component_id, component.provision_component_id);
  assert.deepEqual(adapterResult.component_subject_map[0].limb_path, ['(i)']);

  const validation = validateResolvedCanonicalWriteSet({
    writeSet: { ...adapterResult.write_set, provisions },
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  const published = validation.publishableWriteSet.claims.find(
    (row) => row.claim_definition_key === 'KNOWLEDGE_QUALIFIER',
  );
  assert.ok(published, 'the KNOWLEDGE_QUALIFIER claim is in publishableWriteSet.claims');
  assert.equal(published.subject_occurrence_id, component.provision_component_id);
  const publishedComponent = validation.publishableWriteSet.components.find(
    (row) => row.provision_component_id === component.provision_component_id,
  );
  assert.ok(publishedComponent, 'its REPRESENTATION_LIMB component is itself in the publishable set');
  assert.ok(
    publishedComponent.absolute_start >= knowledgeEntry.provision_instance.absolute_start
      && publishedComponent.absolute_end <= knowledgeEntry.provision_instance.absolute_end,
    'the component is contained in its parent provision',
  );
});

// ─── Acceptance 4 (this file's own real-pipeline fixture): absent context
// is a no-op -- the SAME resolved run receipt, without a `resolution`
// context, leaves the claim exactly as candidate-resolution.js resolved it
// (an unresolvable assertion-node subject, reported typed at validation,
// never silently dropped). Exhaustive absent-context coverage lives in
// tests/canonical-v2-native-write-set-adapter.test.js; this is the same
// property proven against this file's own real KNOWLEDGE fixture. ───

test('the same resolved receipt, without a resolution context, leaves the assertion-node subject untouched (strictly additive)', async () => {
  const receipt = await buildKnowledgeItemReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const knowledgeEntry = resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'KNOWLEDGE_QUALIFIER',
  );
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };

  const withoutResolution = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.deepEqual(withoutResolution.write_set.components, []);
  assert.deepEqual(withoutResolution.component_subject_map, []);
  assert.equal(withoutResolution.write_set.claims.length, 1);
  assert.equal(
    withoutResolution.write_set.claims[0].subject_occurrence_id,
    knowledgeEntry.claim.subject_occurrence_id,
    'the claim keeps the resolver-layer assertion-node id untouched -- exactly the M1 gap this design closes',
  );
});

// ─── Acceptance 2: permutation invariance, against this same real fixture,
// with a SECOND ITEM-attached qualifier under a distinct limb so there is
// more than one component to permute. ───

function twoKnowledgeItemsResponse() {
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [
        { limb_path: ['(i)'], assertion_quote: LIMB_I_QUOTE, subject: 'capital stock' },
        {
          limb_path: ['(iii)'],
          assertion_quote: '(iii)Except for any obligations pursuant to this Agreement,',
          subject: 'other obligations',
        },
      ],
      qualifiers: [
        {
          kind: 'KNOWLEDGE', code: null, quote: KNOWLEDGE_QUOTE, attachment: itemAttachment(['(i)']),
        },
      ],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

test('component ids are permutation-invariant end to end (resolver output fed to the adapter in reversed candidate order)', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        twoKnowledgeItemsResponse(),
        governedScope.source_text,
      );
      return {
        provider_id: 'component-rows-test-permutation/v1',
        model_id: 'stub-model',
        prompt: 'component-rows-test-permutation-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisions = provisionsFrom(resolution);
  const resolutionContext = { provisions, limb_component_trees: resolution.limb_component_trees };
  const compiledCandidates = resolution.resolved.map((entry) => entry.compiled_candidate);
  assert.ok(compiledCandidates.length >= 1);

  const forward = buildNativeWriteSet({
    run_receipt: { ...receipt, compiled_candidates: compiledCandidates },
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: resolutionContext,
  });
  const reversed = buildNativeWriteSet({
    run_receipt: { ...receipt, compiled_candidates: [...compiledCandidates].reverse() },
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: resolutionContext,
  });

  const sortById = (rows, field) => [...rows].sort((a, b) => a[field].localeCompare(b[field]));
  assert.deepEqual(
    sortById(forward.write_set.components, 'provision_component_id'),
    sortById(reversed.write_set.components, 'provision_component_id'),
  );
  assert.deepEqual(
    sortById(forward.write_set.claims, 'claim_revision_id'),
    sortById(reversed.write_set.claims, 'claim_revision_id'),
  );
});

// ─── Acceptance 3: the F28 THIRD live run recorded fixture replays with
// zero behaviour change for its CHAPEAU-only resolved claims.
// tests/fixtures/canonical-v2/f28-third-live-run/adapter-result.json's own
// `admitted_source_contexts[0].canonical_text.text` embeds the FULL,
// byte-exact document this recording's receipt was produced against (the
// raw SEC filing itself is not committed to the repo -- too large -- but
// this run's already-admitted context is, per the F28 handoff), so this
// replay needs no live network/model access: it reruns the committed
// adapter directly against the recorded run receipt and resolution. ───

const F28_THIRD_RUN_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run');

function loadF28ThirdRunFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(F28_THIRD_RUN_DIR, name), 'utf8'));
}

test('F28 third-run fixture sanity: 3 resolved claims (2 ITEM-attached, 1 CHAPEAU), 1 limb component tree', () => {
  const resolutionFixture = loadF28ThirdRunFixture('resolution.json');
  assert.equal(resolutionFixture.resolved.length, 3);
  assert.equal(resolutionFixture.limb_component_trees.length, 1);
  const byPosition = resolutionFixture.resolved.map((entry) => entry.claim.attributes.attachment.position);
  assert.deepEqual([...byPosition].sort(), ['CHAPEAU', 'ITEM', 'ITEM']);
});

test('F28 third-run recorded fixture: replaying through the adapter WITH a resolution context leaves the CHAPEAU-attached resolved claim byte-identical to replaying WITHOUT one', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const resolutionFixture = loadF28ThirdRunFixture('resolution.json');
  const adapterResultFixture = loadF28ThirdRunFixture('adapter-result.json');

  // The recorded adapter result's own admitted_source_contexts[0] embeds the
  // exact full canonical text this receipt was produced against -- reused
  // directly rather than reconstructed, per this file's header comment.
  const admittedSourceContext = adapterResultFixture.admitted_source_contexts[0];
  const sourceText = admittedSourceContext.canonical_text.text;
  assert.equal(sha256Hex(Buffer.from(sourceText, 'utf8')), runReceipt.source_sha256);

  const resolvedRunReceipt = {
    ...runReceipt,
    compiled_candidates: resolutionFixture.resolved.map((entry) => entry.compiled_candidate),
  };

  const byId = new Map();
  for (const entry of resolutionFixture.resolved) {
    byId.set(entry.provision_instance.provision_instance_id, entry.provision_instance);
  }
  const provisions = [...byId.values()];
  // This recording mints exactly one governed representation/provision.
  assert.equal(provisions.length, 1);
  const [provision] = provisions;

  const withoutResolution = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: sourceText,
    document_hash: runReceipt.document_hash,
    admitted_source_context: admittedSourceContext,
  });
  const withResolution = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: sourceText,
    document_hash: runReceipt.document_hash,
    admitted_source_context: admittedSourceContext,
    resolution: { provisions, limb_component_trees: resolutionFixture.limb_component_trees },
  });

  // Both replays write the same 3 claims -- this design changes WHICH
  // subject an ITEM-attached claim resolves to, never whether a candidate
  // shifts/writes at all.
  assert.equal(withoutResolution.write_set.claims.length, 3);
  assert.equal(withResolution.write_set.claims.length, 3);

  // THE ZERO-BEHAVIOUR-CHANGE ASSERTION: the CHAPEAU-attached resolved claim
  // (subject === the provision itself, already resolvable before this
  // design) is BYTE-IDENTICAL whether or not a resolution context is
  // supplied -- this design only ever touches ASSERTION-node subjects.
  const chapeauClaimWithout = withoutResolution.write_set.claims.find(
    (row) => row.subject_occurrence_id === provision.provision_instance_id,
  );
  const chapeauClaimWith = withResolution.write_set.claims.find(
    (row) => row.subject_occurrence_id === provision.provision_instance_id,
  );
  assert.ok(chapeauClaimWithout, 'the CHAPEAU claim resolves in the baseline (no-resolution) replay');
  assert.ok(chapeauClaimWith, 'the CHAPEAU claim still resolves with a resolution context supplied');
  assert.deepEqual(chapeauClaimWithout, chapeauClaimWith);

  // Matches this run doc's own headline: run 3 published exactly 1 of 37 --
  // the CHAPEAU claim -- because its two ITEM-attached siblings' subjects
  // (one ASSERTION node, one PATH node) resolve against nothing without
  // this design's component rows.
  const chapeauValidation = validateResolvedCanonicalWriteSet({
    writeSet: { ...withoutResolution.write_set, provisions },
    contractBundle: compileFixtureContractV13(),
    admittedSourceContexts: withoutResolution.admitted_source_contexts,
  });
  assert.equal(chapeauValidation.accepted, true);
  assert.equal(chapeauValidation.publishableWriteSet.claims.length, 1);
  assert.equal(chapeauValidation.publishableWriteSet.claims[0].subject_occurrence_id, provision.provision_instance_id);

  // THE FIX, MEASURED: with the resolution context, the ASSERTION-node
  // subject claim ALSO becomes publishable (M1 closed for that claim); the
  // PATH-node subject claim (spec point 1: "path nodes never mint") stays
  // exactly as unresolved as it was before this design -- never silently
  // upgraded to publishable by a design that explicitly does not mint for it.
  const componentValidation = validateResolvedCanonicalWriteSet({
    writeSet: { ...withResolution.write_set, provisions },
    contractBundle: compileFixtureContractV13(),
    admittedSourceContexts: withResolution.admitted_source_contexts,
  });
  assert.equal(componentValidation.accepted, true);
  assert.equal(withResolution.write_set.components.length, 1, 'exactly the ONE assertion-node subject mints -- the PATH-node subject does not');
  assert.equal(componentValidation.publishableWriteSet.claims.length, 2, 'the CHAPEAU claim plus the newly-resolvable ASSERTION-node claim');
  assert.ok(componentValidation.publishableWriteSet.claims.some(
    (row) => row.subject_occurrence_id === withResolution.write_set.components[0].provision_component_id,
  ));
  assert.ok(
    componentValidation.residuals.some((r) => r.reason_code === 'SEMANTIC_REFERENCE_UNRESOLVED'),
    'the PATH-node-subject claim is still typed-unresolved, never silently dropped and never silently upgraded',
  );
});
