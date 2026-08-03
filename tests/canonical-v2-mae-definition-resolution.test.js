'use strict';

/**
 * tests/canonical-v2-mae-definition-resolution.test.js
 *
 * Acceptance tests (docs/superpowers/specs/2026-08-02-family-mae-
 * definition-design.md, section 6, AUDIT-AMENDED), covering tests 2-7 (test
 * 1 -- fixture commitment -- is covered by the committed files themselves
 * under tests/fixtures/canonical-v2/mae-definition-family/, see that
 * directory's own PROVENANCE.json).
 *
 * PRE-RERUN HARNESS (spec Deliverable, P1 audit M-5, applied verbatim; same
 * pattern as tests/canonical-v2-no-shop-resolution.test.js and
 * tests/canonical-v2-termination-fee-resolution.test.js): no recorded
 * native runs exist for this family. This file drives the resolver with
 * SYNTHETIC compiled candidates -- built via the real anthropic-provider.js
 * shaping path (shapeMaeDefinitionProposals) over a stub provider response,
 * run through the real runNativeExtraction/resolveCandidates pipeline --
 * carrying REAL, byte-verified quotes copied verbatim from this slice's own
 * committed EDGAR fixture excerpts (tests/fixtures/canonical-v2/
 * mae-definition-family/{skechers,modiv,topbuild}-*-mae-definition.txt).
 * No claim here or in any report may say this family "extracts natively"
 * until the dated post-merge live-run handoffs land.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV16 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeMaeDefinitionProposals,
  MAE_CARVEOUT_CLAIM_KEY,
  MAE_DEFINITION_PRONG_CLAIM_KEY,
  MAE_DISPROPORTIONALITY_CLAIM_KEY,
  MAE_CARVEOUT_CODES,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
  MAPPING_TABLE_VERSION,
  maeCarveoutCorroborated,
  maeDefinitionProngCorroborated,
  maeDisproportionalityCorroborated,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { buildMaeDefinitionProducerPrompt } = require('../lib/canonical-v2/native-producer/mae-definition-producer-prompt');
const { projectKeyTermsMaeClaims } = require('../lib/canonical-v2/key-terms-mae-product-projection');

// ─── identity admitted-source chain (copied verbatim from the no-shop/
// termination-fee resolution tests' own helper -- see those files' comment
// for why a hand-built identity source map is required). ───

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

// ─── Real fixture text, byte-verified against this slice's own committed
// EDGAR excerpts (tests/fixtures/canonical-v2/mae-definition-family/). ───

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family');
function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const SKECHERS_MAE_TEXT = readFixture('skechers-company-mae-definition.txt');
const MODIV_MAE_TEXT = readFixture('modiv-company-mae-definition.txt');

const SKECHERS_DUAL_CODE_CLAUSE = '(vii) earthquakes, hurricanes, tsunamis, tornadoes, floods, mudslides, wild fires '
  + 'or other natural disasters, weather conditions, epidemics, pandemics or disease outbreaks and other force '
  + 'majeure events in the United States or any other country or region in the world;';
assert.ok(SKECHERS_MAE_TEXT.includes(SKECHERS_DUAL_CODE_CLAUSE), 'fixture must contain the Skechers (vii) clause verbatim');

const MODIV_CYBER_CLAUSE = '(k) any computer hacking, data breaches, ransomware, cybercrime or cyberterrorism '
  + 'resulting in an outage of or termination by a critical web hosting platform or data center provider providing '
  + 'services to the Company or any Company Subsidiaries or their respective businesses;';
assert.ok(MODIV_MAE_TEXT.includes(MODIV_CYBER_CLAUSE), 'fixture must contain the Modiv (k) clause verbatim');

const MODIV_DISPROPORTIONALITY_CLAUSE = 'provided, further, that in the case of the foregoing clauses (a), (b), (c), '
  + '(d), (g) or (k), except to the extent that such matters disproportionately and adversely impact the Company and '
  + 'the Company Subsidiaries, taken as a whole, relative to other similarly situated businesses in the industries in '
  + 'which the Company and the Subsidiaries conduct their business, in which case, the incremental disproportionate '
  + 'and adverse impact may be taken into account in determining whether there has been, or would reasonably be '
  + 'expected to be, a Company Material Adverse Effect.';
assert.ok(MODIV_MAE_TEXT.includes(MODIV_DISPROPORTIONALITY_CLAUSE), 'fixture must contain the Modiv disproportionality clause verbatim');

const MODIV_BUSINESS_EFFECTS_PRONG = '(i) has resulted in, or would reasonably be expected to have, a material '
  + 'adverse effect on the business, properties, condition (financial or otherwise), results of operations of the '
  + 'Company and the Company Subsidiaries, taken as a whole';
assert.ok(MODIV_MAE_TEXT.includes(MODIV_BUSINESS_EFFECTS_PRONG), 'fixture must contain the Modiv BUSINESS_EFFECTS prong verbatim');

const MODIV_CONSUMMATION_PRONG = '(ii) has or would reasonably be expected to prevent or materially delay beyond '
  + 'the Outside Date the ability of the Company or the Partnership to consummate the Transactions';
assert.ok(MODIV_MAE_TEXT.includes(MODIV_CONSUMMATION_PRONG), 'fixture must contain the Modiv CONSUMMATION_PREVENTION prong verbatim');

const SECTION_REFERENCE = '1.1';

function wrapInDefinitionsShell(sectionBody) {
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Parent, Inc. and the Company.\n\n',
    'ARTICLE I\n\nDEFINITIONS\n\n',
    'Section 1.1 Definitions.\n\n',
    sectionBody,
    '\n',
  ].join('');
}

const CONTRACT_BUNDLE_V16 = compileFixtureContractV16();

function buildSourceAndContext(dealKey, sectionBody) {
  const sourceText = wrapInDefinitionsShell(sectionBody);
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(sourceText, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
    sourceOrdinal: 0,
  });
  return { sourceText, documentHash, admittedSourceContext };
}

async function resolveMaeAssertions(dealKey, sectionBody, response) {
  const { sourceText, documentHash, admittedSourceContext } = buildSourceAndContext(dealKey, sectionBody);
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V16,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeMaeDefinitionProposals(
        {
          mae_definition_instances: response.mae_definition_instances || [],
          open_world_candidates: response.open_world_candidates || [],
        },
        governedScope.source_text,
      );
      return {
        provider_id: 'mae-definition-test/v1',
        model_id: 'stub-model',
        prompt: 'mae-definition-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V16,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution, sourceText, documentHash, admittedSourceContext };
}

function instance({
  sectionReference = SECTION_REFERENCE, definedTerm = 'Company Material Adverse Effect', definitionSubject = 'the Company',
  prongAssertions = [], carveoutAssertions = [], disproportionalityAssertions = [],
}) {
  return {
    section_reference: sectionReference,
    defined_term: definedTerm,
    definition_subject: definitionSubject,
    prong_assertions: prongAssertions,
    carveout_assertions: carveoutAssertions,
    disproportionality_assertions: disproportionalityAssertions,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Registry / bundle / materiality wiring.
// ═══════════════════════════════════════════════════════════════════════

test('MAE_DEFINITION is registered in producer-prompt-registry.js to buildMaeDefinitionProducerPrompt', () => {
  assert.equal(getProducerPromptModule('MAE_DEFINITION'), buildMaeDefinitionProducerPrompt);
});

test('MAE_CARVEOUT_CODES_V2 has exactly 26 members and no OTHER', () => {
  assert.equal(MAE_CARVEOUT_CODES.length, 26);
  assert.ok(!MAE_CARVEOUT_CODES.includes('OTHER'));
});

test('MAPPING_TABLE_VERSION is 19; materiality rank 30 MAE tier is wired to the DEF-MAE prefix', () => {
  assert.equal(MAPPING_TABLE_VERSION, 20);
  const maeTier = MATERIALITY_TABLE.find((t) => t.label === 'MAE');
  assert.equal(maeTier.rank, 30);
  assert.deepEqual([...maeTier.concept_key_prefixes], ['DEF-MAE']);
  assert.deepEqual(
    materialityFor({ conceptKey: 'DEF-MAE', canonicalValue: null, claimDefinitionKey: 'MAE_CARVEOUT' }),
    maeTier,
  );
});

// ═══════════════════════════════════════════════════════════════════════
// Corroboration unit checks (real committed-fixture bytes).
// ═══════════════════════════════════════════════════════════════════════

test('corroboration: Skechers (vii) clause corroborates BOTH NATURAL_DISASTERS and PANDEMIC', () => {
  assert.ok(maeCarveoutCorroborated('NATURAL_DISASTERS', SKECHERS_DUAL_CODE_CLAUSE));
  assert.ok(maeCarveoutCorroborated('PANDEMIC', SKECHERS_DUAL_CODE_CLAUSE));
});

test('corroboration: a STOCK_PRICE_CHANGES code proposed on a failure-to-meet-projections quote does not corroborate (the classic adjacent-clause mislabel)', () => {
  const projectionsQuote = 'any failure by the Company to meet any internal or public projections, forecasts or estimates of revenues or earnings for any period';
  assert.equal(maeCarveoutCorroborated('STOCK_PRICE_CHANGES', projectionsQuote), false);
  assert.ok(maeCarveoutCorroborated('FAILURE_TO_MEET_PROJECTIONS', projectionsQuote));
});

test('corroboration: ACTIONS_REQUESTED_BY_PARENT / PARENT_ACTIONS_OR_INACTION negative-guard disjointness', () => {
  const requestQuote = 'taken at the written request of Parent or with the written consent of Parent';
  assert.ok(maeCarveoutCorroborated('ACTIONS_REQUESTED_BY_PARENT', requestQuote));
  // The negative guard rejects a both-stem quote proposed under PARENT_ACTIONS_OR_INACTION...
  assert.equal(maeCarveoutCorroborated('PARENT_ACTIONS_OR_INACTION', requestQuote), false);
  // ...but a pure act-of-Parent quote (no request/consent stem) DOES corroborate under PARENT_ACTIONS_OR_INACTION.
  const pureActQuote = 'any act or omission of Parent taken without the knowledge of the Company';
  assert.ok(maeCarveoutCorroborated('PARENT_ACTIONS_OR_INACTION', pureActQuote));
});

test('corroboration: a BUSINESS_EFFECTS prong without "taken as a whole" does not corroborate', () => {
  const noAggregation = 'has had, or would reasonably be expected to have, a material adverse effect on the business, assets, condition (financial or otherwise) or results of operations of the Company and its Subsidiaries';
  assert.equal(maeDefinitionProngCorroborated('BUSINESS_EFFECTS', noAggregation), false);
  assert.ok(maeDefinitionProngCorroborated('BUSINESS_EFFECTS', MODIV_BUSINESS_EFFECTS_PRONG));
  assert.ok(maeDefinitionProngCorroborated('CONSUMMATION_PREVENTION', MODIV_CONSUMMATION_PRONG));
});

test('corroboration: the Modiv disproportionality clause corroborates', () => {
  assert.ok(maeDisproportionalityCorroborated(MODIV_DISPROPORTIONALITY_CLAUSE));
  assert.equal(maeDisproportionalityCorroborated('a completely unrelated sentence about GAAP'), false);
});

// ═══════════════════════════════════════════════════════════════════════
// End-to-end resolution (synthetic candidates, real fixture bytes).
// ═══════════════════════════════════════════════════════════════════════

test('a resolved MAE_CARVEOUT claim carries MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN permanently in unevaluated_conditions, even when other conditions clear', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-carveout-natural-disasters', SKECHERS_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        carveoutAssertions: [
          { carveout_code: 'NATURAL_DISASTERS', clause_label: '(vii)', quote: SKECHERS_DUAL_CODE_CLAUSE, limb_path: ['(vii)'] },
        ],
      }),
    ],
  });
  const carveoutResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY);
  assert.equal(carveoutResolved.length, 1);
  const entry = carveoutResolved[0];
  assert.equal(entry.concept_key, 'DEF-MAE');
  assert.equal(entry.claim.canonical_value, 'NATURAL_DISASTERS');
  assert.ok(
    entry.triage.unevaluated_conditions.includes('MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN'),
    'every resolved DEF-MAE claim carries the permanent self-containment-unproven entry',
  );
  assert.equal(entry.triage.auto_pass, false, 'nothing in this family auto-passes this slice, by design');
});

test('the Skechers (vii) clause resolves as TWO claims (NATURAL_DISASTERS, PANDEMIC) with distinct identities on one limb_path', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-carveout-dual-code', SKECHERS_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        carveoutAssertions: [
          { carveout_code: 'NATURAL_DISASTERS', clause_label: '(vii)', quote: SKECHERS_DUAL_CODE_CLAUSE, limb_path: ['(vii)'] },
          { carveout_code: 'PANDEMIC', clause_label: '(vii)', quote: SKECHERS_DUAL_CODE_CLAUSE, limb_path: ['(vii)'] },
        ],
      }),
    ],
  });
  const carveoutResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY);
  assert.equal(carveoutResolved.length, 2);
  const codes = carveoutResolved.map((e) => e.claim.canonical_value).sort();
  assert.deepEqual(codes, ['NATURAL_DISASTERS', 'PANDEMIC']);
  const revisionIds = carveoutResolved.map((e) => e.claim.claim_revision_id);
  assert.notEqual(revisionIds[0], revisionIds[1], 'two distinct codes on the same clause mint distinct identities');
});

test('the Modiv (k) cybersecurity clause exercises the explicit pushOpenWorld with MAE_CARVEOUT_CODE_UNREGISTERED (out-of-enum, never forced)', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-carveout-cyber', MODIV_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        definedTerm: 'Company Material Adverse Effect',
        carveoutAssertions: [
          { carveout_code: null, clause_label: '(k)', quote: MODIV_CYBER_CLAUSE, limb_path: ['(k)'] },
        ],
      }),
    ],
    open_world_candidates: [
      { observed_quote: MODIV_CYBER_CLAUSE, why_unmapped: 'cybersecurity carve-out has no registered code', nearest_concept: 'DEF-MAE' },
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 0);
  const openWorldEntry = resolution.open_world.find((e) => e.raw_value === MODIV_CYBER_CLAUSE && e.reason === 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.ok(openWorldEntry, 'the open_world_candidates entry itself reaches open_world, typed NATIVE_OPEN_WORLD_PROPOSAL');
});

test('a resolved MAE_DEFINITION_PRONG claim (BUSINESS_EFFECTS, with "taken as a whole") resolves onto DEF-MAE', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-prong-business-effects', MODIV_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        prongAssertions: [
          { prong_code: 'BUSINESS_EFFECTS', prong_label: '(i)', quote: MODIV_BUSINESS_EFFECTS_PRONG, limb_path: ['(i)'] },
        ],
      }),
    ],
  });
  const prongResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY);
  assert.equal(prongResolved.length, 1);
  assert.equal(prongResolved[0].claim.canonical_value, 'BUSINESS_EFFECTS');
  assert.equal(prongResolved[0].concept_key, 'DEF-MAE');
  const projection = projectKeyTermsMaeClaims({ resolved_entries: prongResolved });
  assert.equal(projection.records.length, 1);
  assert.deepEqual(projection.records[0].query, {
    field_key: 'maeDefinitionFact',
    value: {
      concept_key: 'DEF-MAE',
      claim_definition_key: 'MAE_DEFINITION_PRONG',
      canonical_value: 'BUSINESS_EFFECTS',
      dimensions: { prong_code: 'BUSINESS_EFFECTS' },
    },
  });
  assert.deepEqual(projection.records[0].compare, projection.records[0].query);
  assert.equal(projection.records[0].review.label, 'MAE definition prong');
  assert.equal(projection.records[0].market.metric_key, 'MAE_GOVERNED_VALUE_BY_CLAIM');
});

test('a BUSINESS_EFFECTS prong without "taken as a whole" queues MAE_PRONG_UNCORROBORATED (recurring prong-queue cost, audit m-4)', async () => {
  const strippedQuote = 'has resulted in, or would reasonably be expected to have, a material adverse effect on the business, properties, condition (financial or otherwise), results of operations of the Company and the Company Subsidiaries';
  const sectionBody = `(g) "Company Material Adverse Effect" means... ${strippedQuote}.`;
  const { resolution } = await resolveMaeAssertions('deal:mae-prong-no-aggregation', sectionBody, {
    mae_definition_instances: [
      instance({
        prongAssertions: [{ prong_code: 'BUSINESS_EFFECTS', prong_label: null, quote: strippedQuote, limb_path: [] }],
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('MAE_PRONG_UNCORROBORATED'));
  assert.ok(queued, 'an uncorroborated prong queues, typed, never silently resolves');
});

test('a resolved MAE_DISPROPORTIONALITY_CARVEBACK claim carries the Modiv applies_to_clause_labels/comparison_baseline/incremental_impact attributes verbatim', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-disproportionality', MODIV_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        disproportionalityAssertions: [{
          applies_to_clause_labels: ['(a)', '(b)', '(c)', '(d)', '(g)', '(k)'],
          comparison_baseline_phrase: 'other similarly situated businesses in the industries in which the Company and the Subsidiaries conduct their business',
          incremental_impact_phrase: 'the incremental disproportionate and adverse impact may be taken into account',
          quote: MODIV_DISPROPORTIONALITY_CLAUSE,
        }],
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, true);
  assert.deepEqual(resolved[0].claim.attributes.applies_to_clause_labels, ['(a)', '(b)', '(c)', '(d)', '(g)', '(k)']);
});

test('an unenumerated disproportionality carveback (empty applies_to_clause_labels) queues CARVEBACK_SCOPE_UNENUMERATED, never resolves silently as "applies to everything"', async () => {
  const quote = 'except to the extent any of the foregoing disproportionately affects the Company';
  const sectionBody = `(g) "Company Material Adverse Effect" means... ${quote}.`;
  const { resolution } = await resolveMaeAssertions('deal:mae-disproportionality-unenumerated', sectionBody, {
    mae_definition_instances: [
      instance({
        disproportionalityAssertions: [{
          applies_to_clause_labels: [],
          comparison_baseline_phrase: null,
          incremental_impact_phrase: null,
          quote,
        }],
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CARVEBACK_SCOPE_UNENUMERATED'));
  assert.ok(queued);
});

test('a party-neutral definition_subject ("any Party") queues PARTY_UNRESOLVED, never a guessed capacity', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-party-neutral', MODIV_MAE_TEXT, {
    mae_definition_instances: [
      instance({
        definitionSubject: 'any Party',
        prongAssertions: [
          { prong_code: 'BUSINESS_EFFECTS', prong_label: '(i)', quote: MODIV_BUSINESS_EFFECTS_PRONG, limb_path: ['(i)'] },
        ],
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('PARTY_UNRESOLVED'));
  assert.ok(queued);
});

test('Company-MAE and Parent-MAE claims from one section mint distinct stable identities (defined_term_ref identity-bearing)', async () => {
  const combinedText = [
    '(g) "Company Material Adverse Effect" means... ', MODIV_BUSINESS_EFFECTS_PRONG, '.\n',
    '(ll) "Parent Material Adverse Effect" means... has resulted in, or would reasonably be expected to have, a material adverse effect on the business, properties, condition (financial or otherwise), results of operations of Parent and the Parent Subsidiaries, taken as a whole.',
  ].join('');
  const parentProngQuote = 'has resulted in, or would reasonably be expected to have, a material adverse effect on the business, properties, condition (financial or otherwise), results of operations of Parent and the Parent Subsidiaries, taken as a whole';
  const { resolution } = await resolveMaeAssertions('deal:mae-two-defined-terms', combinedText, {
    mae_definition_instances: [
      instance({
        definedTerm: 'Company Material Adverse Effect', definitionSubject: 'the Company',
        prongAssertions: [{ prong_code: 'BUSINESS_EFFECTS', prong_label: null, quote: MODIV_BUSINESS_EFFECTS_PRONG, limb_path: [] }],
      }),
      instance({
        definedTerm: 'Parent Material Adverse Effect', definitionSubject: 'Parent',
        prongAssertions: [{ prong_code: 'BUSINESS_EFFECTS', prong_label: null, quote: parentProngQuote, limb_path: [] }],
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY);
  assert.equal(resolved.length, 2);
  const definedTermRefs = resolved.map((e) => e.claim.attributes.defined_term_ref).sort();
  assert.deepEqual(definedTermRefs, ['Company Material Adverse Effect', 'Parent Material Adverse Effect']);
  assert.notEqual(
    resolved[0].claim.claim_revision_id,
    resolved[1].claim.claim_revision_id,
    'two same-section claims differing only in defined_term_ref must never collide or dedupe',
  );
  const partyCapacities = resolved.map((e) => e.party.capacity).sort();
  assert.deepEqual(partyCapacities, ['BUYER', 'TARGET']);
});
