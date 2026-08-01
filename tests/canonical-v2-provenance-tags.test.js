// tests/canonical-v2-provenance-tags.test.js
//
// Plan Task 5 ("provenance tags"), spec docs/superpowers/specs/2026-08-01-
// claim-identity-provenance-design.md section 5 + "Citation guard and
// validator staging" + "Pinned implementation decisions".
//
// Covers: MECHANICAL/AI answer_provenance minted by candidate-resolution.js
// on every resolved claim and open-world entry; the field surviving the
// adapter's coordinate-shift re-derivation unchanged; the validator's staged
// requirement keyed on write_set_origin; the validator's absolute rejection
// of an AI tag on a claims/relationships row; and the supersession-link
// scaffolding.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  validateResolvedCanonicalWriteSet,
  CanonicalValidationError,
  ANSWER_PROVENANCE_TAGS: VALIDATOR_ANSWER_PROVENANCE_TAGS,
  WRITE_SET_ORIGINS,
} = require('../lib/canonical-v2/validate-write-set');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildNativeWriteSet, WRITE_SET_ORIGIN_NATIVE_PRODUCER } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const {
  shapeProposals,
  QUALIFIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
  PROMPT_ID_REEXPORT,
  PROMPT_VERSION_REEXPORT,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  MAPPING_TABLE_VERSION,
  ANSWER_PROVENANCE_TAGS,
  buildMechanicalAnswerProvenance,
  buildAiAnswerProvenance,
  buildVerifiedAnswerProvenance,
  mintSupersessionLink,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { QUALIFIER_KIND_LEXICON_VERSION } = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');

// ─── Fixture: identity admitted-source chain (copied per house convention --
// see tests/canonical-v2-candidate-resolution.test.js and
// tests/canonical-v2-native-write-set-adapter.test.js's own copies of the
// same helper -- a hand-built identity source map, not the real SEC-HTML
// converter). ───

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

// ─── Fixture: the real QXO Section 3.1(b) capital-structure text (same
// composition as tests/canonical-v2-candidate-resolution.test.js), trimmed
// to just what this file's tests need: one CHAPEAU ACCURACY qualifier (->
// resolves, MECHANICAL), one bring-down tier (-> resolves, MECHANICAL), a
// bare limb assertion and the model's own open-world candidate (both ->
// open_world, AI). ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_III_QUOTE = '(iii)Except for any obligations pursuant to this Agreement,';
const ACCURACY_CHAPEAU_QUOTE = 'true and correct in all respects';
const OPEN_WORLD_QUOTE = 'There are no voting trusts or other agreements';

const ACCURACY_TAIL_TEXT = ' The Company represents that the following statement is '
  + ACCURACY_CHAPEAU_QUOTE + '.';

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
  ACCURACY_TAIL_TEXT,
  '\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const DEAL_KEY = 'deal:qxo-provenance-tags';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-provenance-tags');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

function parsedResponse() {
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [{
        limb_path: ['(i)'],
        assertion_quote: LIMB_I_QUOTE,
        subject: 'capital stock',
      }],
      qualifiers: [{
        kind: 'ACCURACY',
        code: 'MAT_ALL_RESPECTS',
        quote: ACCURACY_CHAPEAU_QUOTE,
        attachment: {
          position: 'CHAPEAU',
          governs_path: null,
          ambiguity_signals: { items_grammatically_parallel: null },
        },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [{
      section_reference: '3.1(b)',
      condition_obligor: 'Parent',
      beneficiary: 'the Company',
      measurement_date_quote: 'April 17, 2026',
      tiers: [{
        accuracy_standard: 'MAT_ALL_MATERIAL',
        covered_scope_quote: LIMB_III_QUOTE,
        covered_limb_references: ['(iii)'],
        scrape_quote: null,
        exception_quote: null,
      }],
      nested_definitions: [],
    }],
    open_world_candidates: [{
      observed_quote: OPEN_WORLD_QUOTE,
      why_unmapped: 'a residual voting-trust disclaimer with no registered concept',
      nearest_concept: null,
    }],
  };
}

function realProducerProvider() {
  return async ({ governed_scope: governedScope }) => {
    const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
      parsedResponse(),
      governedScope.source_text,
    );
    return {
      provider_id: 'provenance-tags-test-real-shape/v1',
      model_id: 'stub-model',
      prompt: 'provenance-tags-test-real-shape-prompt/v1',
      proposals,
      evidence_residuals: evidenceResiduals,
    };
  };
}

async function buildReceipt() {
  return runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: realProducerProvider(),
  });
}

function findResolved(resolution, genericKey) {
  return resolution.resolved.find((entry) => entry.generic_claim_key === genericKey);
}

// ─── Pure builder unit tests (no fixtures needed). ───

test('ANSWER_PROVENANCE_TAGS is exactly the three governed tags', () => {
  assert.deepEqual([...ANSWER_PROVENANCE_TAGS], ['MECHANICAL', 'AI', 'VERIFIED']);
  assert.deepEqual([...VALIDATOR_ANSWER_PROVENANCE_TAGS], ['MECHANICAL', 'AI', 'VERIFIED']);
});

test('buildMechanicalAnswerProvenance pins mapping table + lexicon versions, and ruling pins when a ruling applied', () => {
  const plain = buildMechanicalAnswerProvenance({});
  assert.equal(plain.tag, 'MECHANICAL');
  assert.equal(plain.pins.mapping_table_version, MAPPING_TABLE_VERSION);
  assert.equal(plain.pins.qualifier_kind_lexicon_version, QUALIFIER_KIND_LEXICON_VERSION);
  assert.equal(plain.pins.ruling_corpus_id, undefined);

  const withRuling = buildMechanicalAnswerProvenance({
    rulingProvenance: {
      tag: 'MECHANICAL',
      pins: { ruling_corpus_id: 'corpus-id', ruling_corpus_version: 3, originating_ruling_id: 'ruling-id' },
    },
  });
  assert.equal(withRuling.pins.mapping_table_version, MAPPING_TABLE_VERSION);
  assert.equal(withRuling.pins.ruling_corpus_id, 'corpus-id');
  assert.equal(withRuling.pins.ruling_corpus_version, 3);
  assert.equal(withRuling.pins.originating_ruling_id, 'ruling-id');
});

test('buildAiAnswerProvenance pins model_id from extraction provenance plus the actual prompt id/version', () => {
  const provenance = buildAiAnswerProvenance({
    extractionProvenance: { extractor_id: 'anthropic-native-producer/v1' },
  });
  assert.equal(provenance.tag, 'AI');
  assert.equal(provenance.pins.model_id, 'anthropic-native-producer/v1');
  assert.equal(provenance.pins.prompt_id, PROMPT_ID_REEXPORT);
  assert.equal(provenance.pins.prompt_version, PROMPT_VERSION_REEXPORT);

  const withoutExtractor = buildAiAnswerProvenance({ extractionProvenance: {} });
  assert.equal(withoutExtractor.pins.model_id, null);
});

test('buildVerifiedAnswerProvenance requires reviewer/verified_at/canonical_text_hash/evidence_excerpt_id', () => {
  const provenance = buildVerifiedAnswerProvenance({
    reviewer: 'ben@precedentmachine',
    verified_at: '2026-08-01T00:00:00.000Z',
    canonical_text_hash: 'a'.repeat(64),
    evidence_excerpt_id: 'b'.repeat(64),
  });
  assert.equal(provenance.tag, 'VERIFIED');
  assert.equal(provenance.pins.reviewer, 'ben@precedentmachine');
  assert.equal(provenance.pins.canonical_text_hash, 'a'.repeat(64));
  assert.equal(provenance.pins.evidence_excerpt_id, 'b'.repeat(64));

  assert.throws(() => buildVerifiedAnswerProvenance({
    verified_at: '2026-08-01T00:00:00.000Z',
    canonical_text_hash: 'a'.repeat(64),
    evidence_excerpt_id: 'b'.repeat(64),
  }), /reviewer/);
});

test('mintSupersessionLink is deterministic and content-derived', () => {
  const linkA = mintSupersessionLink({
    supersededRevisionId: 'a'.repeat(64),
    supersedingRevisionId: 'b'.repeat(64),
  });
  const linkB = mintSupersessionLink({
    supersededRevisionId: 'a'.repeat(64),
    supersedingRevisionId: 'b'.repeat(64),
  });
  assert.equal(linkA.supersession_link_id, linkB.supersession_link_id);
  assert.equal(linkA.supersedes, 'a'.repeat(64));
  assert.equal(linkA.superseded_by, 'b'.repeat(64));

  // A different pair mints a different link -- exercised as the plan's
  // "supersession links" test: a rule-version bump mints a superseding
  // revision id distinct from the superseded one, and the link between them
  // is a pure function of exactly that pair.
  const linkC = mintSupersessionLink({
    supersededRevisionId: 'a'.repeat(64),
    supersedingRevisionId: 'c'.repeat(64),
  });
  assert.notEqual(linkA.supersession_link_id, linkC.supersession_link_id);
});

// ─── End-to-end: resolveCandidates mints answer_provenance on resolved +
// open-world entries. ───

test('every resolved claim carries a MECHANICAL answer_provenance pinning mapping table + lexicon versions', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const qualifier = findResolved(resolution, QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier, 'the qualifier proposal resolved');
  const qualifierProvenance = qualifier.claim.attributes.answer_provenance;
  assert.equal(qualifierProvenance.tag, 'MECHANICAL');
  assert.equal(qualifierProvenance.pins.mapping_table_version, MAPPING_TABLE_VERSION);
  assert.equal(qualifierProvenance.pins.qualifier_kind_lexicon_version, QUALIFIER_KIND_LEXICON_VERSION);

  const tier = findResolved(resolution, BRING_DOWN_TIER_CLAIM_KEY);
  assert.ok(tier, 'the bring-down tier proposal resolved');
  const tierProvenance = tier.claim.attributes.answer_provenance;
  assert.equal(tierProvenance.tag, 'MECHANICAL');
  assert.equal(tierProvenance.pins.mapping_table_version, MAPPING_TABLE_VERSION);
});

test('every open-world entry carries an AI answer_provenance pinning the producer/prompt identity', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.ok(resolution.open_world.length >= 2, 'this fixture always produces at least the limb assertion and the genuine open-world candidate');
  for (const entry of resolution.open_world) {
    assert.equal(entry.answer_provenance.tag, 'AI');
    assert.equal(entry.answer_provenance.pins.prompt_id, PROMPT_ID_REEXPORT);
    assert.equal(entry.answer_provenance.pins.prompt_version, PROMPT_VERSION_REEXPORT);
  }

  const limbAssertion = resolution.open_world.find((entry) => entry.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.ok(limbAssertion);
  assert.equal(limbAssertion.answer_provenance.tag, 'AI');

  const genuineOpenWorld = resolution.open_world.find((entry) => entry.reason === 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.ok(genuineOpenWorld);
  assert.equal(genuineOpenWorld.answer_provenance.tag, 'AI');
});

// ─── Adapter: write_set_origin + the field surviving re-derivation. ───

test('buildNativeWriteSet sets write_set_origin: NATIVE_PRODUCER and carries answer_provenance through unchanged', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  assert.ok(resolution.resolved.length >= 2);

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(adapterResult.write_set.write_set_origin, WRITE_SET_ORIGIN_NATIVE_PRODUCER);
  assert.equal(adapterResult.write_set.write_set_origin, 'NATIVE_PRODUCER');
  assert.ok(WRITE_SET_ORIGINS.includes(adapterResult.write_set.write_set_origin));
  assert.equal(adapterResult.write_set.claims.length, resolution.resolved.length);
  for (const claim of adapterResult.write_set.claims) {
    const provenance = claim.attributes.answer_provenance;
    assert.equal(provenance.tag, 'MECHANICAL');
    assert.equal(provenance.pins.mapping_table_version, MAPPING_TABLE_VERSION);
  }
});

// ─── Validator staging: required on NATIVE_PRODUCER claims, untouched
// elsewhere, and the identity invariant (never AI) is absolute. ───

test('validateResolvedCanonicalWriteSet accepts a NATIVE_PRODUCER write set whose claims carry answer_provenance', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = { ...adapterResult.write_set, provisions: [...provisionsById.values()] };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
});

test('validateResolvedCanonicalWriteSet REQUIRES answer_provenance on a NATIVE_PRODUCER claims row when it is missing', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );

  const strippedClaims = adapterResult.write_set.claims.map((claim) => {
    const { answer_provenance: _dropped, ...restAttributes } = claim.attributes;
    return { ...claim, attributes: restAttributes };
  });
  const writeSet = {
    ...adapterResult.write_set,
    claims: strippedClaims,
    provisions: [...provisionsById.values()],
  };

  assert.throws(() => validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  }), (error) => error instanceof CanonicalValidationError
    && /answer_provenance/.test(error.message)
    && /is required/.test(error.message));
});

test('validateResolvedCanonicalWriteSet does NOT require answer_provenance when write_set_origin is absent (reviewed-slice path, untouched)', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const strippedClaims = adapterResult.write_set.claims.map((claim) => {
    const { answer_provenance: _dropped, ...restAttributes } = claim.attributes;
    return { ...claim, attributes: restAttributes };
  });
  // No write_set_origin at all -- the untouched, pre-existing path a
  // reviewed-slice write set (or any legacy caller of this adapter/
  // validator pair) already takes.
  const { write_set_origin: _origin, ...writeSetWithoutOrigin } = adapterResult.write_set;
  const writeSet = {
    ...writeSetWithoutOrigin,
    claims: strippedClaims,
    provisions: [...provisionsById.values()],
  };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
});

test('validateResolvedCanonicalWriteSet validates a present answer_provenance shape even off the staged NATIVE_PRODUCER path', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const malformedClaims = adapterResult.write_set.claims.map((claim) => ({
    ...claim,
    attributes: { ...claim.attributes, answer_provenance: { tag: 'NOT_A_REAL_TAG', pins: {} } },
  }));
  const { write_set_origin: _origin, ...writeSetWithoutOrigin } = adapterResult.write_set;
  const writeSet = {
    ...writeSetWithoutOrigin,
    claims: malformedClaims,
    provisions: [...provisionsById.values()],
  };

  assert.throws(() => validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  }), (error) => error instanceof CanonicalValidationError && /governed tag/.test(error.message));
});

test('validateResolvedCanonicalWriteSet NEVER accepts an AI tag on a claims row: identity is never AI-assigned', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const aiTaggedClaims = adapterResult.write_set.claims.map((claim) => ({
    ...claim,
    attributes: {
      ...claim.attributes,
      // Even a well-formed AI pin set must never be accepted here -- this is
      // the ONE thing that is not staged: identity is never AI-tagged,
      // regardless of write_set_origin.
      answer_provenance: { tag: 'AI', pins: { model_id: 'x', prompt_id: 'y', prompt_version: 'z' } },
    },
  }));
  const writeSet = {
    ...adapterResult.write_set,
    claims: aiTaggedClaims,
    provisions: [...provisionsById.values()],
  };

  assert.throws(() => validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  }), (error) => error instanceof CanonicalValidationError
    && /never carry an AI tag/.test(error.message));
});

test('writeSet.write_set_origin must be a governed value when present', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = {
    ...adapterResult.write_set,
    write_set_origin: 'SOMETHING_ELSE',
    provisions: [...provisionsById.values()],
  };

  assert.throws(() => validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  }), (error) => error instanceof CanonicalValidationError
    && /write_set_origin must be NATIVE_PRODUCER or REVIEWED_SLICE/.test(error.message));
});
