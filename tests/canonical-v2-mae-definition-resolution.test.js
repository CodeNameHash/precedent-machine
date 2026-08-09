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
const MODIV_PARENT_MAE_TEXT = readFixture('modiv-parent-mae-definition.txt');
const TOPBUILD_COMPANY_MAE_TEXT = readFixture('topbuild-company-mae-definition.txt');
const TOPBUILD_PARENT_MAE_TEXT = readFixture('topbuild-parent-mae-definition.txt');

function enumeratedClause(text, label, nextLabel) {
  const marker = `${label} `;
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `fixture must contain ${label}`);
  const nextStarts = nextLabel
    ? [`\n${nextLabel} `, `; ${nextLabel} `]
      .map((nextMarker) => text.indexOf(nextMarker, start))
      .filter((index) => index >= 0)
    : [];
  const end = nextStarts.length > 0 ? Math.min(...nextStarts) : text.length;
  assert.ok(end > start, `fixture must contain the end of ${label}`);
  return text.slice(start, end).trim();
}

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

const SKECHERS_DISPROPORTIONALITY_CLAUSE = SKECHERS_MAE_TEXT.slice(
  SKECHERS_MAE_TEXT.lastIndexOf('except, with respect to clauses'),
).trim();
assert.match(SKECHERS_DISPROPORTIONALITY_CLAUSE, /clauses \(i\), \(ii\), \(vi\), \(vii\) and \(xi\)/);

function trailingModivClause(text) {
  const start = text.lastIndexOf('provided, further, that in the case of the foregoing clauses');
  assert.ok(start >= 0, 'fixture must contain the Modiv trailing carveback');
  return text.slice(start).trim();
}

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
  prongAssertions = [], carveoutAssertions = [], limbLocalDisproportionalityAssertions = [], disproportionalityAssertions = [],
}) {
  return {
    section_reference: sectionReference,
    defined_term: definedTerm,
    definition_subject: definitionSubject,
    prong_assertions: prongAssertions,
    carveout_assertions: carveoutAssertions,
    limb_local_disproportionality_assertions: limbLocalDisproportionalityAssertions,
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

test('MAPPING_TABLE_VERSION is 21; materiality rank 30 MAE tier is wired to the DEF-MAE prefix', () => {
  assert.equal(MAPPING_TABLE_VERSION, 21);
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
  assert.equal(resolved[0].claim.attributes.carveback_source_form, 'TRAILING_LIST');
  assert.deepEqual(resolved[0].claim.attributes.applies_to_clause_labels, ['(a)', '(b)', '(c)', '(d)', '(g)', '(k)']);
});

test('real TopBuild Company and Parent definitions resolve per-limb carvebacks for A, B, D, G and H and reach deduplicated product rollups', async () => {
  const expected = [
    ['(A)', '(B)', 'ECONOMY_GENERAL'],
    ['(B)', '(C)', 'INDUSTRY_GENERAL'],
    ['(D)', '(E)', 'ACTS_OF_WAR_TERRORISM'],
    ['(G)', '(H)', 'CHANGE_IN_LAW'],
    ['(H)', '(I)', 'CHANGE_IN_GAAP'],
  ];
  for (const fixture of [
    {
      dealKey: 'deal:topbuild-company-mae', text: TOPBUILD_COMPANY_MAE_TEXT,
      definedTerm: 'Company Material Adverse Effect', subject: 'the Company', capacity: 'TARGET',
      baseline: 'others in the industry or industries in which the Company and its Subsidiaries operate',
    },
    {
      dealKey: 'deal:topbuild-parent-mae', text: TOPBUILD_PARENT_MAE_TEXT,
      definedTerm: 'Parent Material Adverse Effect', subject: 'Parent', capacity: 'BUYER',
      baseline: 'others in the industry or industries in which Parent and its Subsidiaries operate',
    },
  ]) {
    const clauses = new Map(expected.map(([label, nextLabel]) => [label, enumeratedClause(fixture.text, label, nextLabel)]));
    const { resolution } = await resolveMaeAssertions(fixture.dealKey, fixture.text, {
      mae_definition_instances: [instance({
        definedTerm: fixture.definedTerm,
        definitionSubject: fixture.subject,
        carveoutAssertions: expected.map(([label, , code]) => ({
          carveout_code: code, clause_label: label, quote: clauses.get(label), limb_path: ['carveouts', label],
        })),
        limbLocalDisproportionalityAssertions: expected.map(([label]) => ({
          clause_label: label,
          comparison_baseline_phrase: fixture.baseline,
          incremental_impact_phrase: null,
          quote: clauses.get(label),
          limb_path: ['carveouts', label],
        })),
      })],
    });
    const carveouts = resolution.resolved.filter((entry) => entry.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY);
    const disproportionality = resolution.resolved.filter((entry) => entry.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY);
    assert.equal(carveouts.length, 5, fixture.definedTerm);
    assert.equal(disproportionality.length, 5, fixture.definedTerm);
    assert.ok(disproportionality.every((entry) => entry.claim.attributes.carveback_source_form === 'PER_LIMB'));
    assert.ok(disproportionality.every((entry) => entry.party.capacity === fixture.capacity));
    const [rollup] = projectKeyTermsMaeClaims({
      resolved_entries: [...carveouts, ...disproportionality],
    }).mae_disproportionality_rollups;
    assert.deepEqual(rollup.covered_limbs.map(({ clause_label: label }) => label), ['(A)', '(B)', '(D)', '(G)', '(H)']);
    assert.ok(rollup.covered_limbs.every((limb) => limb.source_forms.length === 1 && limb.source_forms[0] === 'PER_LIMB'));
    assert.ok(rollup.covered_limbs.every((limb) => limb.relationship_edges.length === 1));
    assert.ok(rollup.covered_limbs.every((limb) => limb.sources[0].exact_disproportionality_quote === clauses.get(limb.clause_label)));
  }
});

test('real Skechers trailing list resolves i, ii, vi, vii and xi once, including the two-code vii limb', async () => {
  const carveoutSpecs = [
    ['(i)', '(ii)', 'ECONOMY_GENERAL'],
    ['(ii)', '(iii)', 'FINANCIAL_MARKETS'],
    ['(vi)', '(vii)', 'ACTS_OF_WAR_TERRORISM'],
    ['(vii)', '(viii)', 'NATURAL_DISASTERS'],
    ['(vii)', '(viii)', 'PANDEMIC'],
    ['(xi)', '(xii)', 'CHANGE_IN_GAAP'],
  ];
  const clauses = new Map(carveoutSpecs.map(([label, nextLabel]) => [label, enumeratedClause(SKECHERS_MAE_TEXT, label, nextLabel)]));
  const { resolution } = await resolveMaeAssertions('deal:skechers-trailing-list', SKECHERS_MAE_TEXT, {
    mae_definition_instances: [instance({
      carveoutAssertions: carveoutSpecs.map(([label, , code]) => ({
        carveout_code: code, clause_label: label, quote: clauses.get(label), limb_path: ['carveouts', label],
      })),
      disproportionalityAssertions: [{
        applies_to_clause_labels: ['(i)', '(ii)', '(vi)', '(vii)', '(xi)'],
        comparison_baseline_phrase: 'other companies of a similar size operating in the industries in which the Company Group conducts business',
        incremental_impact_phrase: 'only the incremental disproportionate adverse impact may be taken into account',
        quote: SKECHERS_DISPROPORTIONALITY_CLAUSE,
      }],
    })],
  });
  const governed = resolution.resolved.filter((entry) => [MAE_CARVEOUT_CLAIM_KEY, MAE_DISPROPORTIONALITY_CLAIM_KEY].includes(entry.generic_claim_key));
  assert.equal(governed.filter((entry) => entry.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 6);
  const [rollup] = projectKeyTermsMaeClaims({ resolved_entries: governed }).mae_disproportionality_rollups;
  assert.deepEqual(rollup.covered_limbs.map(({ clause_label: label }) => label), ['(i)', '(ii)', '(vi)', '(vii)', '(xi)']);
  const vii = rollup.covered_limbs.find(({ clause_label: label }) => label === '(vii)');
  assert.deepEqual(vii.carveout_codes, ['NATURAL_DISASTERS', 'PANDEMIC']);
  assert.equal(vii.relationship_edges.length, 2);
  assert.deepEqual(vii.source_forms, ['TRAILING_LIST']);
});

test('real Modiv Company and Parent trailing lists resolve a, b, c, d, g and preserve cyber k as an open-world limb relationship', async () => {
  const specs = [
    ['(a)', '(b)', 'CHANGE_IN_LAW'],
    ['(b)', '(c)', 'ECONOMY_GENERAL'],
    ['(c)', '(d)', 'FINANCIAL_MARKETS'],
    ['(d)', '(e)', 'INDUSTRY_GENERAL'],
    ['(g)', '(h)', 'NATURAL_DISASTERS'],
  ];
  for (const fixture of [
    {
      dealKey: 'deal:modiv-company-trailing-list', text: MODIV_MAE_TEXT,
      definedTerm: 'Company Material Adverse Effect', subject: 'the Company',
      baseline: 'other similarly situated businesses in the industries in which the Company and the Subsidiaries conduct their business',
    },
    {
      dealKey: 'deal:modiv-parent-trailing-list', text: MODIV_PARENT_MAE_TEXT,
      definedTerm: 'Parent Material Adverse Effect', subject: 'Parent',
      baseline: 'other similarly situated businesses in the industries in which Parent and the Parent Subsidiaries conduct their business',
    },
  ]) {
    const clauses = new Map(specs.map(([label, nextLabel]) => [label, enumeratedClause(fixture.text, label, nextLabel)]));
    const trailing = trailingModivClause(fixture.text);
    const cyberStart = fixture.text.lastIndexOf('(k) any computer hacking');
    const cyberEnd = fixture.text.indexOf('; provided, further', cyberStart);
    assert.ok(cyberStart >= 0 && cyberEnd > cyberStart, `${fixture.definedTerm} cyber limb must be exact`);
    const cyberQuote = fixture.text.slice(cyberStart, cyberEnd + 1);
    const { resolution } = await resolveMaeAssertions(fixture.dealKey, fixture.text, {
      mae_definition_instances: [instance({
        definedTerm: fixture.definedTerm,
        definitionSubject: fixture.subject,
        carveoutAssertions: specs.map(([label, , code]) => ({
          carveout_code: code, clause_label: label, quote: clauses.get(label), limb_path: ['carveouts', label],
        })),
        disproportionalityAssertions: [{
          applies_to_clause_labels: ['(a)', '(b)', '(c)', '(d)', '(g)', '(k)'],
          comparison_baseline_phrase: fixture.baseline,
          incremental_impact_phrase: 'the incremental disproportionate and adverse impact may be taken into account',
          quote: trailing,
        }],
      })],
      open_world_candidates: [{
        observed_quote: cyberQuote,
        why_unmapped: 'cybersecurity carve-out has no registered code',
        nearest_concept: 'DEF-MAE',
      }],
    });
    const governed = resolution.resolved.filter((entry) => [MAE_CARVEOUT_CLAIM_KEY, MAE_DISPROPORTIONALITY_CLAIM_KEY].includes(entry.generic_claim_key));
    assert.equal(governed.filter((entry) => entry.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 5);
    const [rollup] = projectKeyTermsMaeClaims({
      resolved_entries: governed,
      open_world_entries: resolution.open_world,
    }).mae_disproportionality_rollups;
    assert.deepEqual(rollup.covered_limbs.map(({ clause_label: label }) => label), ['(a)', '(b)', '(c)', '(d)', '(g)', '(k)']);
    const cyber = rollup.covered_limbs.find(({ clause_label: label }) => label === '(k)');
    assert.equal(cyber.relationship_state, 'OPEN_WORLD_LIMB_RELATIONSHIP');
    assert.deepEqual(cyber.carveout_claim_revision_ids, []);
    assert.equal(cyber.open_world_evidence.length, 1);
    assert.equal(cyber.open_world_evidence[0].exact_open_world_quote, cyberQuote);
    assert.equal(cyber.open_world_evidence.length, 1);
    assert.equal(cyber.sources[0].exact_disproportionality_quote, trailing);
  }
});

test('a per-limb carveback whose full limb path does not identify its clause queues instead of joining by label alone', async () => {
  const quote = enumeratedClause(TOPBUILD_COMPANY_MAE_TEXT, '(A)', '(B)');
  const { resolution } = await resolveMaeAssertions('deal:topbuild-invalid-limb-path', TOPBUILD_COMPANY_MAE_TEXT, {
    mae_definition_instances: [instance({
      limbLocalDisproportionalityAssertions: [{
        clause_label: '(A)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote,
        limb_path: ['carveouts', '(B)'],
      }],
    })],
  });
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY).length, 0);
  assert.ok(resolution.review_queue.some(({ reasons }) => reasons.includes('LIMB_LOCAL_CARVEBACK_SCOPE_INVALID')));
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

// ═══════════════════════════════════════════════════════════════════════
// CLAUSE_LABEL_NOT_IN_QUOTE / CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE fix
// (docs/codex-program/notes/mae-clause-label.md). REPLAY of the real,
// committed, first live MAE_DEFINITION run: evidence/canonical-v2/topbuild-
// mae-definition-20260806/native-producer-recorded-response-3.1_a_.json's
// `mae_definition_instances[0]`, reproduced here field-for-field (not
// paraphrased, not re-derived) as this test's own `response` argument, run
// through the REAL, unmodified shapeMaeDefinitionProposals / resolveCandidates
// pipeline over the real committed TOPBUILD_COMPANY_MAE_TEXT fixture. That
// run compiled 23 candidates and resolved only 2: the BUSINESS_EFFECTS prong
// and the (C) carveout (which self-references "this clause (C)" in its own
// proviso). The other 21 queued -- 12 CLAUSE_LABEL_NOT_IN_QUOTE, 5
// CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE, 2 MAE_CARVEOUT_UNCORROBORATED, 2
// open_world. The model's own recorded output already carries a correctly-
// populated, separate clause_label field for every one of the 17
// label-blocked candidates -- nothing below asks the model for anything new.
// ═══════════════════════════════════════════════════════════════════════

const TOPBUILD_REPLAY_RESPONSE = {
  mae_definition_instances: [{
    section_reference: SECTION_REFERENCE,
    defined_term: 'Company Material Adverse Effect',
    definition_subject: 'the Company and its Subsidiaries, taken as a whole',
    prong_assertions: [
      {
        prong_code: 'BUSINESS_EFFECTS',
        prong_label: null,
        quote: 'any event, change, effect, development, circumstance, state of facts, condition or occurrence '
          + '(each, an “Effect”) that, when considered individually or in the aggregate with all other Effects, is '
          + 'or would reasonably be expected to have a material adverse effect on the business, condition '
          + '(financial or otherwise) or results of operations of the Company and its Subsidiaries, taken as a whole',
        limb_path: [],
      },
    ],
    carveout_assertions: [
      {
        carveout_code: 'ECONOMY_GENERAL', clause_label: '(A)',
        quote: 'changes or developments in economic, business or labor conditions generally in the United States '
          + 'or other countries in which the Company or any of its Subsidiaries conduct operations',
        limb_path: ['(A)'],
      },
      {
        carveout_code: 'FINANCIAL_MARKETS', clause_label: '(1)',
        quote: 'any changes or developments in or affecting the securities, credit or financial markets',
        limb_path: ['(A)', '(1)'],
      },
      {
        carveout_code: 'TARIFFS', clause_label: '(2)',
        quote: 'any changes or developments in or affecting interest, currency or exchange rates, commodity '
          + 'prices, tariffs, anti-dumping or countervailing duties, surtaxes or any trade wars',
        limb_path: ['(A)', '(2)'],
      },
      {
        carveout_code: 'GOVERNMENT_SHUTDOWNS', clause_label: '(3)',
        quote: 'the effect of any potential or actual government shutdown',
        limb_path: ['(A)', '(3)'],
      },
      {
        carveout_code: 'INDUSTRY_GENERAL', clause_label: '(B)',
        quote: 'changes or developments in or affecting the industry or industries in which the Company or any of '
          + 'its Subsidiaries operate (including such changes or developments resulting from general economic conditions)',
        limb_path: ['(B)'],
      },
      {
        carveout_code: 'ANNOUNCEMENT_OR_PENDENCY', clause_label: '(C)',
        quote: 'the announcement of this Agreement and the Transactions, including Effects as a result of the '
          + 'identification of Parent or any of its Affiliates as the acquirer of the Company, provided that this '
          + 'clause (C) shall not apply to any representation or warranty set forth in Section ‎3.1(d)(ii) (or any '
          + 'condition to any party’s obligation to consummate the Mergers relating to such representation or '
          + 'warranty) to the extent that such representation or warranty addresses the consequences of any Effect '
          + 'arising out of, relating to or resulting from the execution and delivery of this Agreement or the '
          + 'consummation of the Mergers',
        limb_path: ['(C)'],
      },
      {
        carveout_code: 'ACTS_OF_WAR_TERRORISM', clause_label: '(D)',
        quote: 'acts of terrorism or sabotage, civil disturbances or unrest, war (whether or not declared), the '
          + 'commencement, continuation or escalation of a war or military action, acts of hostility',
        limb_path: ['(D)'],
      },
      {
        carveout_code: 'NATURAL_DISASTERS', clause_label: '(D)',
        quote: 'storms, earthquakes, floods or other natural disasters',
        limb_path: ['(D)'],
      },
      {
        carveout_code: 'PANDEMIC', clause_label: '(D)',
        quote: 'the outbreak or continuation of any epidemic, pandemic or other health crisis',
        limb_path: ['(D)'],
      },
      {
        carveout_code: 'COMPLIANCE_WITH_AGREEMENT', clause_label: '(E)',
        quote: 'actions expressly required of the Company under this Agreement; provided that, for the avoidance '
          + 'of doubt, the exception in this clause (E) shall not apply to the substance or content of any '
          + 'information, in and of itself, received by Parent, its officers or its authorized Representatives '
          + 'pursuant to this Agreement, including Section ‎4.7)',
        limb_path: ['(E)'],
      },
      {
        carveout_code: null, clause_label: '(F)',
        quote: 'any Action alleging breach of fiduciary duty or violation of Law relating to this Agreement or the '
          + 'Transactions (it being understood and agreed that the exception in this clause (F) shall apply to the '
          + 'Effects arising out of, relating to or resulting from the bringing of such Action and not those '
          + 'arising out of, relating to or resulting from an actual breach or violation of law)',
        limb_path: ['(F)'],
      },
      {
        carveout_code: 'CHANGE_IN_LAW', clause_label: '(G)',
        quote: 'changes or developments after the date hereof in applicable Laws, regulatory policies or the '
          + 'definitive interpretations thereof',
        limb_path: ['(G)'],
      },
      {
        carveout_code: 'CHANGE_IN_GAAP', clause_label: '(H)',
        quote: 'changes or developments after the date hereof in generally accepted accounting principles in the '
          + 'United States (“GAAP”) or any foreign equivalents thereof or the interpretations thereof',
        limb_path: ['(H)'],
      },
      {
        carveout_code: 'FAILURE_TO_MEET_PROJECTIONS', clause_label: '(I)',
        quote: 'any failure by the Company to meet any internal or public projections, forecasts or estimates of '
          + 'revenues or earnings for any period; provided that the exception in this clause shall not prevent or '
          + 'otherwise affect a determination that any change or development underlying such failure constitutes, '
          + 'has resulted in, or contributed to, a Company Material Adverse Effect',
        limb_path: ['(I)'],
      },
      {
        carveout_code: 'STOCK_PRICE_CHANGES', clause_label: '(J)',
        quote: 'a decline in the price or trading volume of the Company’s common stock or any change in the '
          + 'ratings or ratings outlook for the Company or any of its Subsidiaries; provided that the exception in '
          + 'this clause shall not prevent or otherwise affect a determination that any change or development '
          + 'underlying such decline or change constitutes, has resulted in, or contributed to, a Company Material '
          + 'Adverse Effect',
        limb_path: ['(J)'],
      },
    ],
    limb_local_disproportionality_assertions: [
      {
        clause_label: '(A)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote: 'changes or developments in economic, business or labor conditions generally in the United States '
          + 'or other countries in which the Company or any of its Subsidiaries conduct operations, including (1) '
          + 'any changes or developments in or affecting the securities, credit or financial markets, (2) any '
          + 'changes or developments in or affecting interest, currency or exchange rates, commodity prices, '
          + 'tariffs, anti-dumping or countervailing duties, surtaxes or any trade wars or (3) the effect of any '
          + 'potential or actual government shutdown, except to the extent such changes or developments have a '
          + 'disproportionate effect on the Company and its Subsidiaries, taken as a whole, relative to others in '
          + 'the industry or industries in which the Company and its Subsidiaries operate',
        limb_path: ['(A)'],
      },
      {
        clause_label: '(B)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote: 'changes or developments in or affecting the industry or industries in which the Company or any of '
          + 'its Subsidiaries operate (including such changes or developments resulting from general economic '
          + 'conditions), except to the extent that such changes or developments have a disproportionate effect on '
          + 'the Company and its Subsidiaries, taken as a whole, relative to others in the industry or industries '
          + 'in which the Company and its Subsidiaries operate',
        limb_path: ['(B)'],
      },
      {
        clause_label: '(D)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote: 'changes or developments arising out of acts of terrorism or sabotage, civil disturbances or '
          + 'unrest, war (whether or not declared), the commencement, continuation or escalation of a war or '
          + 'military action, acts of hostility, weather conditions or other acts of God (including storms, '
          + 'earthquakes, floods or other natural disasters or changes due to the outbreak or continuation of any '
          + 'epidemic, pandemic or other health crisis), including any actual or threatened material worsening of '
          + 'such conditions, except to the extent that they have a disproportionate effect on the Company and its '
          + 'Subsidiaries, taken as a whole, relative to others in the industry or industries in which the Company '
          + 'and its Subsidiaries operate',
        limb_path: ['(D)'],
      },
      {
        clause_label: '(G)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote: 'changes or developments after the date hereof in applicable Laws, regulatory policies or the '
          + 'definitive interpretations thereof, except to the extent that such changes or developments have a '
          + 'disproportionate effect on the Company and its Subsidiaries, taken as a whole, relative to others in '
          + 'the industry or industries in which the Company and its Subsidiaries operate',
        limb_path: ['(G)'],
      },
      {
        clause_label: '(H)',
        comparison_baseline_phrase: 'others in the industry or industries in which the Company and its Subsidiaries operate',
        incremental_impact_phrase: null,
        quote: 'changes or developments after the date hereof in generally accepted accounting principles in the '
          + 'United States (“GAAP”) or any foreign equivalents thereof or the interpretations thereof, except to '
          + 'the extent that such changes or developments have a disproportionate effect on the Company and its '
          + 'Subsidiaries, taken as a whole, relative to others in the industry or industries in which the Company '
          + 'and its Subsidiaries operate',
        limb_path: ['(H)'],
      },
    ],
    disproportionality_assertions: [],
  }],
  // The real recorded response's own open_world_candidates (two "except
  // where the failure to be so [organized/qualified] ... Material Adverse
  // Effect" cross-reference mentions) are deliberately OMITTED here: both
  // are drawn from the ORGANIZATIONAL-representation prose that precedes the
  // MAE definition within the same real section 3.1(a) (real absolute_start
  // 576/1465, near the very start of that section's full text) -- text this
  // repo's own committed TOPBUILD_COMPANY_MAE_TEXT fixture does not include
  // at all (it starts directly at the defined-term sentence). They are
  // unrelated to clause_label verification (a DIFFERENT gate,
  // NATIVE_OPEN_WORLD_PROPOSAL, entirely untouched by this fix) and would
  // only fail to byte-verify against this narrower fixture, adding noise
  // with no bearing on what this test proves.
};

test('REPLAY (evidence/canonical-v2/topbuild-mae-definition-20260806/): 17 of the 19 real label-blocked/out-of-scope queued candidates now resolve -- 12 CLAUSE_LABEL_NOT_IN_QUOTE and all 5 CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE -- with no model/prompt change', async () => {
  const { resolution } = await resolveMaeAssertions('deal:topbuild-mae-clause-label-replay', TOPBUILD_COMPANY_MAE_TEXT, TOPBUILD_REPLAY_RESPONSE);

  const carveoutResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY);
  const disproportionalityResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY);
  const prongResolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY);

  // This replay's own mae_definition_instances-derived total (1 prong + 15
  // carveout + 5 limb-local disproportionality = 21) matches the real run's
  // own 21 mae-derived compiled candidates exactly (the real run's receipt
  // counts 23 compiled_candidates only because it ALSO compiles the 2
  // open_world_candidates omitted above -- resolved(2) + review_queue's own
  // 19 has_resolution:false rows + open_world(2) = 23). This fix touches
  // nothing about compilation/validation -- same 21 candidates in, same 21 out.
  assert.equal(resolution.resolution_receipt.counts.compiled_candidates, 21);

  // 13 of 15 carveout_assertions resolve: (C) (already resolved today) plus
  // the 12 that were CLAUSE_LABEL_NOT_IN_QUOTE. (E) and (F) still queue --
  // MAE_CARVEOUT_UNCORROBORATED, an untouched, out-of-scope gate.
  assert.equal(carveoutResolved.length, 13);
  // All 5 limb_local_disproportionality_assertions resolve: previously all 5
  // were CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE.
  assert.equal(disproportionalityResolved.length, 5);
  // The BUSINESS_EFFECTS prong is untouched by this fix and still resolves.
  assert.equal(prongResolved.length, 1);

  assert.equal(resolution.resolved.length, 13 + 5 + 1, 'total resolved: 19 of 21 compiled candidates');

  // Every CLAUSE_LABEL_NOT_IN_QUOTE / CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE
  // entry is gone from review_queue.
  assert.equal(resolution.review_queue.filter((e) => e.reasons.includes('CLAUSE_LABEL_NOT_IN_QUOTE')).length, 0);
  assert.equal(resolution.review_queue.filter((e) => e.reasons.includes('CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE')).length, 0);

  // The two MAE_CARVEOUT_UNCORROBORATED queue entries -- (E) and (F) -- are
  // UNTOUCHED: still exactly 2, unaffected by this fix, out of scope.
  const uncorroborated = resolution.review_queue.filter((e) => e.reasons.includes('MAE_CARVEOUT_UNCORROBORATED'));
  assert.equal(uncorroborated.length, 2);
  assert.deepEqual(uncorroborated.map((e) => e.raw_value).sort(), [
    'actions expressly required of the Company under this Agreement; provided that, for the avoidance of doubt, '
      + 'the exception in this clause (E) shall not apply to the substance or content of any information, in and '
      + 'of itself, received by Parent, its officers or its authorized Representatives pursuant to this Agreement, '
      + 'including Section ‎4.7)',
    'any Action alleging breach of fiduciary duty or violation of Law relating to this Agreement or the '
      + 'Transactions (it being understood and agreed that the exception in this clause (F) shall apply to the '
      + 'Effects arising out of, relating to or resulting from the bringing of such Action and not those arising '
      + 'out of, relating to or resulting from an actual breach or violation of law)',
  ].sort());

  // Nothing NEW queues without a reason: every review_queue row with
  // has_resolution:false still carries exactly one of the two untouched,
  // out-of-scope MAE_CARVEOUT_UNCORROBORATED reasons above -- confirmed by
  // the exact-length assertion on `uncorroborated` already made.
  assert.equal(resolution.review_queue.filter((e) => e.has_resolution === false).length, 2);

  // All twelve newly-resolved carveout codes are exactly right (no
  // corroboration drift introduced by this change).
  const carveoutCodes = carveoutResolved.map((e) => e.claim.canonical_value).sort();
  assert.deepEqual(carveoutCodes, [
    'ACTS_OF_WAR_TERRORISM', 'ANNOUNCEMENT_OR_PENDENCY', 'CHANGE_IN_GAAP', 'CHANGE_IN_LAW', 'ECONOMY_GENERAL',
    'FAILURE_TO_MEET_PROJECTIONS', 'FINANCIAL_MARKETS', 'GOVERNMENT_SHUTDOWNS', 'INDUSTRY_GENERAL', 'NATURAL_DISASTERS',
    'PANDEMIC', 'STOCK_PRICE_CHANGES', 'TARIFFS',
  ].sort());
  // Two distinct codes on the same (D) clause_label mint distinct identities
  // (mirrors the Skechers (vii) dual-code test above) -- three different
  // carveout_revision_ids all sharing clause_label "(D)", never merged.
  const dLabelClaims = carveoutResolved.filter((e) => e.claim.attributes.clause_label === '(D)');
  assert.equal(dLabelClaims.length, 3);
  assert.equal(new Set(dLabelClaims.map((e) => e.claim.claim_revision_id)).size, 3);

  // ACCEPTANCE 3: the two claims that already resolved before this fix --
  // the BUSINESS_EFFECTS prong and the (C) carveout -- resolve UNCHANGED.
  // Both pass tier 1 alone (self-reference / no clause_label narrowing at
  // all), the ORIGINAL, untouched check, so their code path through
  // finalizeMaeClaim is byte-identical to before this fix -- proven directly
  // in canonical-v2-mae-clause-label-parse.test.js ("tier 1 -- self-
  // referencing quote ... verifies without any sectionText at all").
  assert.equal(prongResolved[0].claim.canonical_value, 'BUSINESS_EFFECTS');
  assert.deepEqual(prongResolved[0].claim.attributes.limb_path, []);
  const cCarveout = carveoutResolved.find((e) => e.claim.attributes.clause_label === '(C)');
  assert.ok(cCarveout, '(C) must still resolve');
  assert.equal(cCarveout.claim.canonical_value, 'ANNOUNCEMENT_OR_PENDENCY');
  assert.deepEqual(cCarveout.claim.attributes.limb_path, ['(C)']);
});

// ─── Hostile tests (docs/codex-program/notes/mae-clause-label.md
// acceptance 2): a label absent from the source, a label whose location is
// ambiguous, and a carve-out with no label at all -- each must behave
// EXACTLY as it does today. ───

test('HOSTILE: a clause_label absent from the source entirely still queues CLAUSE_LABEL_NOT_IN_QUOTE, even with a real sibling present in the same section', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-hostile-label-absent', TOPBUILD_COMPANY_MAE_TEXT, {
    mae_definition_instances: [instance({
      carveoutAssertions: [
        // A real TopBuild (D) sub-quote, but asserting a clause_label that
        // appears NOWHERE in the source -- not adjacent, not self-
        // referencing, and no sibling anywhere carries this label either.
        { carveout_code: 'NATURAL_DISASTERS', clause_label: '(Z)', quote: 'storms, earthquakes, floods or other natural disasters', limb_path: ['(Z)'] },
      ],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CLAUSE_LABEL_NOT_IN_QUOTE'));
  assert.ok(queued, 'an absent label queues, typed, never silently resolves');
});

test('HOSTILE: a quote whose location in the section is ambiguous (the identical sentence drafted twice) still queues CLAUSE_LABEL_NOT_IN_QUOTE, never guesses which occurrence the label belongs to', async () => {
  const duplicatedSentence = 'a duplicated carve-out sentence with no clause label anywhere near it';
  const sectionBody = `(g) "Company Material Adverse Effect" means... (X) ${duplicatedSentence}. Unrelated intervening prose. Restated verbatim elsewhere in the same section: ${duplicatedSentence}.`;
  const { resolution } = await resolveMaeAssertions('deal:mae-hostile-label-ambiguous', sectionBody, {
    mae_definition_instances: [instance({
      carveoutAssertions: [
        { carveout_code: 'NATURAL_DISASTERS', clause_label: '(X)', quote: duplicatedSentence, limb_path: ['(X)'] },
      ],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CLAUSE_LABEL_NOT_IN_QUOTE'));
  assert.ok(queued, 'an ambiguously-located quote queues, typed, never guesses an occurrence');
});

test('HOSTILE: a carve-out with no clause_label at all still queues CLAUSE_LABEL_NOT_IN_QUOTE, identical to today (this code path is untouched by the fix)', async () => {
  const { resolution } = await resolveMaeAssertions('deal:mae-hostile-no-label', TOPBUILD_COMPANY_MAE_TEXT, {
    mae_definition_instances: [instance({
      carveoutAssertions: [
        { carveout_code: 'NATURAL_DISASTERS', clause_label: null, quote: 'storms, earthquakes, floods or other natural disasters', limb_path: [] },
      ],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_CARVEOUT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CLAUSE_LABEL_NOT_IN_QUOTE'));
  assert.ok(queued, 'no label at all queues, typed, exactly as before');
});

test('HOSTILE (disproportionality/PER_LIMB): an absent clause_label on a limb-local carveback still queues CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE', async () => {
  const quote = 'storms, earthquakes, floods or other natural disasters, except to the extent disproportionate';
  const sectionBody = `(g) "Company Material Adverse Effect" means... (D) ${quote}.`;
  const { resolution } = await resolveMaeAssertions('deal:mae-hostile-disprop-label-absent', sectionBody, {
    mae_definition_instances: [instance({
      limbLocalDisproportionalityAssertions: [{
        clause_label: '(Z)',
        comparison_baseline_phrase: 'except to the extent disproportionate',
        incremental_impact_phrase: null,
        quote,
        limb_path: ['(Z)'],
      }],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE'));
  assert.ok(queued, 'an absent label on a PER_LIMB carveback queues, typed, never silently resolves');
});

test('HOSTILE (disproportionality/TRAILING_LIST): the ORIGINAL substring-of-quote check is deliberately UNCHANGED for the trailing-list source form', async () => {
  // A trailing proviso's own quote legitimately recites its covered labels
  // INLINE (content, not a structural prefix) -- verified directly against
  // the real, committed Skechers trailing-list clause already used above
  // (SKECHERS_DISPROPORTIONALITY_CLAUSE), which contains every one of its
  // own applies_to_clause_labels as a literal substring. This test proves a
  // label genuinely ABSENT from a trailing quote still queues -- the
  // PER_LIMB adjacency/sibling upgrade is never consulted for this source
  // form (see handleMaeDisproportionalityCandidate's own comment).
  const { resolution } = await resolveMaeAssertions('deal:mae-hostile-disprop-trailing-absent', SKECHERS_MAE_TEXT, {
    mae_definition_instances: [instance({
      disproportionalityAssertions: [{
        applies_to_clause_labels: ['(i)', '(zz)'], // '(zz)' does not exist in this agreement at all
        comparison_baseline_phrase: 'other companies of a similar size operating in the industries in which the Company Group conducts business',
        incremental_impact_phrase: null,
        quote: SKECHERS_DISPROPORTIONALITY_CLAUSE,
      }],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DISPROPORTIONALITY_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE'));
  assert.ok(queued, 'a label absent from a trailing proviso\'s own text still queues, unchanged behaviour');
});

// ─── prong_label: the SAME defect shape, same fix, found by structural
// analogy rather than replay (docs/codex-program/notes/mae-clause-label.md)
// -- prong_assertions carries the identical "narrow the quote to this single
// prong's own text" design as carveout_assertions, so a correctly narrowed,
// LABELLED prong (a genuine two-prong definition, e.g. Modiv's own "(i)"/
// "(ii)") is exposed to the identical false refusal. No committed live run
// has exercised this yet -- TopBuild's own prong is unlabelled -- so this is
// NOT replay-proven the way the carveout/disproportionality fix above is;
// the quote below is the REAL Modiv prong text with its own label prefix
// removed, matching exactly how the real carveout narrowing was observed to
// behave (mae-definition-producer-prompt.js's own instruction: quote "only
// that prong's own text"). ───

test('prong_label (proactive, same defect shape, not replay-proven): a correctly narrowed, labelled prong quote (real Modiv wording, label prefix removed) now verifies via source adjacency', async () => {
  const narrowedProngQuote = 'has resulted in, or would reasonably be expected to have, a material adverse effect '
    + 'on the business, properties, condition (financial or otherwise), results of operations of the Company and '
    + 'the Company Subsidiaries, taken as a whole';
  assert.ok(MODIV_MAE_TEXT.includes(narrowedProngQuote), 'must be real Modiv wording, not invented');
  assert.ok(!narrowedProngQuote.includes('(i)'), 'must be genuinely narrowed -- no self-reference to lean on');

  const { resolution } = await resolveMaeAssertions('deal:mae-prong-label-narrowed', MODIV_MAE_TEXT, {
    mae_definition_instances: [instance({
      prongAssertions: [{ prong_code: 'BUSINESS_EFFECTS', prong_label: '(i)', quote: narrowedProngQuote, limb_path: ['(i)'] }],
    })],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, 'BUSINESS_EFFECTS');
  assert.equal(resolution.review_queue.filter((e) => e.reasons.includes('PRONG_LABEL_NOT_IN_QUOTE')).length, 0);
});

test('prong_label HOSTILE: a label absent from the source entirely still queues PRONG_LABEL_NOT_IN_QUOTE, unchanged', async () => {
  const narrowedProngQuote = 'has resulted in, or would reasonably be expected to have, a material adverse effect '
    + 'on the business, properties, condition (financial or otherwise), results of operations of the Company and '
    + 'the Company Subsidiaries, taken as a whole';
  const { resolution } = await resolveMaeAssertions('deal:mae-prong-label-hostile-absent', MODIV_MAE_TEXT, {
    mae_definition_instances: [instance({
      prongAssertions: [{ prong_code: 'BUSINESS_EFFECTS', prong_label: '(zz)', quote: narrowedProngQuote, limb_path: ['(zz)'] }],
    })],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === MAE_DEFINITION_PRONG_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('PRONG_LABEL_NOT_IN_QUOTE'));
  assert.ok(queued, 'a label absent from the source still queues a labelled prong, exactly as before');
});
