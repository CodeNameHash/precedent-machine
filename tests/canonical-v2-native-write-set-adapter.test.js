const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract, compileFixtureContractV25 } = require('../lib/canonical-v2/contract-bundle');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  buildSemanticSpan,
  buildProvisionComponent,
  buildProvisionInstance,
  buildExcerpt,
} = require('../lib/canonical-v2/source-structure');
const { buildRelationshipRevision } = require('../lib/canonical-v2/claims-relationships');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  buildNativeWriteSet,
  NativeWriteSetAdapterError,
} = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { LIMB_ASSERTION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { mintLimbComponentTree } = require('../lib/canonical-v2/native-producer/limb-components');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

// ─── Fixture: identity admitted-source chain ───
//
// `buildAdmittedSemanticSourceContext` (admitted-semantic-source.js) demands
// a full, internally-consistent SEC-HTML admission chain, but does not care
// HOW that chain was produced -- only that every digest and cross-reference
// in it is self-consistent. Running real text through the real SEC-HTML
// converter (sec-html-canonical-text.js) normalises whitespace, so it can't
// be made to reproduce an exact, hand-chosen document byte-for-byte. This
// helper builds the same chain shape directly, with a trivial identity
// source map (one region, one mapping, input bytes === output bytes), so
// the resulting ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1's `canonical_text.text`
// is EXACTLY the text handed in -- required because the adapter under test
// asserts `admitted_source_context.canonical_text.text === source_text`.
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

// ─── Fixture: a realistic full merger-agreement text with real QXO Section
// 3.1(b) capital-structure text embedded well past byte 0 -- the same
// composition tests/canonical-v2-native-extraction-run.test.js proves the
// sectionizer resolves correctly. Reconstructed here (not imported) so this
// test only depends on the sectionizer's public contract.

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const qxoRealisticFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n\nARTICLE V\n\nCONDITIONS TO THE MERGER\n\n',
  QXO_5_2_TEXT,
  '\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoRealisticFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const DEAL_KEY = 'deal:qxo-native-write-set-adapter';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-native-write-set-adapter');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoRealisticFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_III_QUOTE = '(iii)Except for any obligations pursuant to this Agreement,';

function locateInGovernedScope(governedScope, quote) {
  const bytes = Buffer.from(governedScope.source_text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = bytes.indexOf(needle);
  if (start < 0) throw new Error(`test fixture quote not found in governed scope: ${quote}`);
  return { start, end: start + needle.length };
}

// A minimal, well-behaved stub provider: synthetic (non-resolving) subject
// ids, one evidence-backed claim per call, exactly mirroring
// native-extraction-run.test.js's own fixture shape. Good enough for tests
// that only care about evidence coordinates, not full downstream
// publishability.
function makeClaimProposal({
  subjectSeed, ordinal = 0, quote, absoluteStart, absoluteEnd,
}) {
  const subjectOccurrenceId = contentId('NATIVE_WRITE_SET_ADAPTER_TEST_SUBJECT/V1', subjectSeed);
  const excerptId = contentId('NATIVE_WRITE_SET_ADAPTER_TEST_EXCERPT/V1', {
    quote, absoluteStart, absoluteEnd, ordinal,
  });
  return {
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'NATIVE_WRITE_SET_ADAPTER_TEST_CLAIM_CANDIDATE',
    claim_definition_version: 1,
    ordinal,
    state: 'PRESENT',
    raw_value: quote,
    canonical_value: null,
    attributes: {},
    allowed_attributes: [],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: excerptId,
      document_ordinal: 0,
      absolute_start: absoluteStart,
      absolute_end: absoluteEnd,
      ordinal: 0,
    }],
    extraction_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
    normalisation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
    derivation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
  };
}

function simpleProvider({ quote = LIMB_I_QUOTE, evidenceResiduals = [] } = {}) {
  return async ({ governed_scope: governedScope }) => {
    const { start, end } = locateInGovernedScope(governedScope, quote);
    return {
      provider_id: 'native-write-set-adapter-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-write-set-adapter-test-stub-prompt-v1',
      proposals: [makeClaimProposal({
        subjectSeed: { section_reference: governedScope.section_reference, quote },
        ordinal: 0,
        quote,
        absoluteStart: start,
        absoluteEnd: end,
      })],
      evidence_residuals: evidenceResiduals,
    };
  };
}

async function buildSimpleReceipt(options) {
  return runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: simpleProvider(options),
  });
}

// ─── Fixture: a "resolvable" provider whose subject_occurrence_id is a
// REAL PROVISION_INSTANCE/V1 identity (built the same way
// tests/fixtures/canonical-v2/qxo-native-producer-proposals.js and
// canonical-v2-deal-scope-writer.test.js already do), so a write set built
// from its output can genuinely resolve under validate-write-set.js's real
// semantic-reference checks -- not just structurally parse. This is what
// lets the failure-isolation test prove REAL sibling publishability rather
// than "everyone is quarantined for an unrelated, unavoidable reason." See
// the adapter report for why today's live anthropic-provider.js backend
// does NOT do this (a separate, pre-existing gap this task did not create
// and is out of scope to fix).

const REP_PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
const ACCURACY_KEY = 'REPRESENTATION_ACCURACY_STANDARD';

function resolvableProvider() {
  return async ({ governed_scope: governedScope }) => {
    const provisionSpan = buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, governedScope.start, governedScope.end);
    const provision = buildProvisionInstance({
      source: ADMITTED_SOURCE_CONTEXT,
      span: provisionSpan,
      conceptKey: 'REP-T-CAP',
      party: REP_PARTY,
      ordinal: 1,
      contractBundle: CONTRACT_BUNDLE,
    });
    const subject = provision.provision_instance_id;

    const limbI = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    const limbIII = locateInGovernedScope(governedScope, LIMB_III_QUOTE);

    const proposalFor = ({ ordinal, quote, start, end, canonicalValue }) => ({
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: subject,
      claim_definition_key: ACCURACY_KEY,
      claim_definition_version: 1,
      ordinal,
      state: 'PRESENT',
      raw_value: quote,
      canonical_value: canonicalValue,
      // Task 5 (provenance tags): this fixture hand-assembles a proposal
      // that already carries a REGISTERED claim_definition_key (ACCURACY_
      // KEY), simulating a candidate-resolution.js-resolved row without
      // actually running the resolver -- so it must also carry the
      // MECHANICAL answer_provenance the resolver would have minted, or the
      // staged validator's NATIVE_PRODUCER requirement (correctly) rejects
      // it as an under-provenanced resolved claim.
      attributes: {
        answer_provenance: {
          tag: 'MECHANICAL',
          pins: { mapping_table_version: 3, qualifier_kind_lexicon_version: 1 },
        },
      },
      // `answer_provenance` must be on the allow-list too, or claims-
      // relationships.js's own compile-time `residualsFor` (buildClaimRevision)
      // quarantines it as an UNKNOWN_ATTRIBUTE residual -- correct behaviour
      // for a real unregistered attribute, but this fixture's added
      // attribute IS the governed one this task adds.
      allowed_attributes: ['answer_provenance'],
      taxonomy_codes: {},
      codebooks: {},
      evidence: [{
        evidence_role: 'OPERATIVE_TEXT',
        excerpt_id: contentId('NATIVE_WRITE_SET_ADAPTER_RESOLVABLE_TEST_EXCERPT/V1', {
          quote, start, end, ordinal,
        }),
        document_ordinal: 0,
        absolute_start: start,
        absolute_end: end,
        ordinal: 0,
      }],
      extraction_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
      normalisation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
      derivation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
    });

    return {
      provider_id: 'native-write-set-adapter-resolvable-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-write-set-adapter-resolvable-test-stub-prompt-v1',
      proposals: [
        proposalFor({
          ordinal: 0, quote: LIMB_I_QUOTE, start: limbI.start, end: limbI.end, canonicalValue: 'MAT_ALL_RESPECTS_DE_MINIMIS',
        }),
        proposalFor({
          ordinal: 1, quote: LIMB_III_QUOTE, start: limbIII.start, end: limbIII.end, canonicalValue: 'MAT_ALL_MATERIAL',
        }),
        // Poisoned: otherwise well-formed and evidence-backed, but asserts a
        // canonical_value outside REPRESENTATION_ACCURACY_STANDARD's allowed
        // set. claims-relationships.js has no contract-bundle awareness, so
        // this compiles as a clean VALIDATED row -- only validate-write-set.js's
        // own, independent `structuralResiduals` check (INVALID_CANONICAL_VALUE)
        // catches it. That is the point: this is a defect the REAL validator
        // discovers on its own, not one the compiler already flagged.
        proposalFor({
          ordinal: 2, quote: LIMB_III_QUOTE, start: limbIII.start, end: limbIII.end, canonicalValue: 'NOT_A_REAL_ACCURACY_CODE',
        }),
      ],
      evidence_residuals: [],
    };
  };
}

async function buildResolvableReceipt() {
  return runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: resolvableProvider(),
  });
}

function findSection(receipt, reference) {
  const section = receipt.resolved_sections.find((entry) => entry.section_reference === reference);
  assert.ok(section, `resolved section ${reference} must exist in the receipt`);
  return section;
}

// ─── Sanity: the fixture section is not at byte 0, so a coordinate-frame
// bug (using local offsets as if they were absolute) would be visible ───

test('fixture sanity: the governed section starts well past document byte 0', async () => {
  const receipt = await buildSimpleReceipt();
  const section = findSection(receipt, '3.1(b)');
  assert.ok(section.start > 100, `expected a substantial preamble before the section; got start=${section.start}`);
});

// ─── Coordinate frame ───

test('coordinate frame: evidence that verifies section-locally also verifies document-absolutely after shifting', async () => {
  const receipt = await buildSimpleReceipt();
  const section = findSection(receipt, '3.1(b)');
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.ok, true);
  const [localEdge] = entry.candidate.claim.evidence;

  // Section-local verification (what native-extraction-run.js already
  // proved before compiling this candidate).
  const sectionBytes = Buffer.from(qxoRealisticFullText, 'utf8').subarray(section.start, section.end);
  const localSlice = sectionBytes.subarray(localEdge.absolute_start, localEdge.absolute_end).toString('utf8');
  assert.equal(localSlice, entry.candidate.claim.raw_value);
  // Prove the hazard is real: treating the local offset as document-absolute
  // does NOT reproduce the raw_value (since section.start > 0).
  const wrongSlice = Buffer.from(qxoRealisticFullText, 'utf8')
    .subarray(localEdge.absolute_start, localEdge.absolute_end).toString('utf8');
  assert.notEqual(wrongSlice, entry.candidate.claim.raw_value);

  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(result.write_set.claims.length, 1);
  const [shiftedEdge] = result.write_set.claims[0].evidence;
  assert.equal(shiftedEdge.absolute_start, section.start + localEdge.absolute_start);
  assert.equal(shiftedEdge.absolute_end, section.start + localEdge.absolute_end);

  const documentAbsoluteSlice = Buffer.from(qxoRealisticFullText, 'utf8')
    .subarray(shiftedEdge.absolute_start, shiftedEdge.absolute_end)
    .toString('utf8');
  assert.equal(documentAbsoluteSlice, entry.candidate.claim.raw_value);

  // The excerpt registered for this evidence is a REAL, document-absolute
  // EXCERPT/V1 (source-structure.js), not the producer's section-local id.
  assert.equal(result.write_set.excerpts.length, 1);
  const [excerpt] = result.write_set.excerpts;
  assert.equal(excerpt.excerpt_id, shiftedEdge.excerpt_id);
  assert.equal(excerpt.canonical_text_id, ADMITTED_SOURCE_CONTEXT.canonical_text_id);
  assert.equal(excerpt.absolute_start, shiftedEdge.absolute_start);
  assert.equal(excerpt.absolute_end, shiftedEdge.absolute_end);
  assert.notEqual(excerpt.excerpt_id, localEdge.excerpt_id, 'the section-local excerpt id must not survive into the write set');
});

test('resolution-supplied IOC parent provisions and restricted-action components reach the write set', async () => {
  const receipt = await buildSimpleReceipt();
  const section = findSection(receipt, '3.1(b)');
  const contractBundle = compileFixtureContractV25();
  const provision = buildProvisionInstance({
    source: ADMITTED_SOURCE_CONTEXT,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, section.start, section.end),
    conceptKey: 'IOC-MERGE',
    party: { role: 'IOC_COVENANT_OBLIGOR', value: 'Company', capacity: 'TARGET' },
    ordinal: 1,
    contractBundle,
  });
  const component = buildProvisionComponent({
    source: ADMITTED_SOURCE_CONTEXT,
    parentProvision: provision,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, section.start, section.start + 20),
    componentKey: 'RESTRICTED_ACTION',
    ordinal: 1,
    contractBundle,
  });
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: {
      provisions: [{
        ...provision,
        closure_id: contentId('IOC_ADAPTER_TEST_PROVISION_CLOSURE/V1', provision.provision_instance_id),
      }],
      limb_component_trees: [],
      ioc_restriction_components: [{
        ...component,
        closure_id: contentId('IOC_ADAPTER_TEST_COMPONENT_CLOSURE/V1', component.provision_component_id),
      }],
    },
  });
  assert.equal(result.write_set.provisions.length, 1);
  assert.equal(result.write_set.provisions[0].provision_instance_id, provision.provision_instance_id);
  assert.equal(result.write_set.components.length, 1);
  assert.equal(result.write_set.components[0].provision_component_id, component.provision_component_id);
});

// ─── Citation-following relationships (docs/codex-program/notes/citation-
// scope-design.md Part 6.4; candidate-resolution.js's own
// mintCitationTriggeredByRelationship). UNLIKE every other candidate this
// adapter processes, these arrive from `resolution.relationships` already
// document-absolute -- built directly against admitted_source_context, not
// against a section-local buffer -- so they are concatenated as-is, never
// run through this module's own section-local coordinate shift. ───

test('citation-following: resolution.relationships bundles are concatenated into the write set, unshifted, alongside their own excerpts and cited provision', async () => {
  const receipt = await buildSimpleReceipt();
  const citingSection = findSection(receipt, '3.1(b)');
  const contractBundle = compileFixtureContractV25();

  // closure_id: same domain candidate-resolution.js's own mintProvision
  // uses (PROVISION_CLOSURE_DOMAIN) -- every provision in a write set needs
  // one. mintProvision itself (the real production path) always attaches
  // this; buildProvisionInstance alone (used directly here to avoid
  // depending on candidate-resolution.js's own private helper) does not.
  const withProvisionClosure = (provision) => ({
    ...provision, closure_id: contentId('CANDIDATE_RESOLUTION_PROVISION_CLOSURE/V1', { provision_instance_id: provision.provision_instance_id }),
  });
  const citingProvision = withProvisionClosure(buildProvisionInstance({
    source: ADMITTED_SOURCE_CONTEXT,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, citingSection.start, citingSection.start + 40),
    conceptKey: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'the Company', capacity: 'TARGET' },
    ordinal: 1,
    contractBundle,
  }));
  const citedProvision = withProvisionClosure(buildProvisionInstance({
    source: ADMITTED_SOURCE_CONTEXT,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, citingSection.start + 60, citingSection.start + 100),
    conceptKey: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'the Company', capacity: 'TARGET' },
    ordinal: 2,
    contractBundle,
  }));
  // closure_id: same domain/formula as native-write-set-adapter.js's own
  // (private) EXCERPT_CLOSURE_DOMAIN/excerptFor, and as candidate-
  // resolution.js's own withExcerptClosure -- every excerpt in a write set
  // needs one (validate-write-set.js requires it), whichever code path
  // minted the excerpt.
  const withClosure = (excerpt) => ({ ...excerpt, closure_id: contentId('NATIVE_WRITE_SET_EXCERPT_CLOSURE/V1', { excerpt_id: excerpt.excerpt_id }) });
  const citingExcerpt = withClosure(buildExcerpt({
    source: ADMITTED_SOURCE_CONTEXT,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, citingSection.start, citingSection.start + 10),
  }));
  const citedExcerpt = withClosure(buildExcerpt({
    source: ADMITTED_SOURCE_CONTEXT,
    span: buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, citingSection.start + 60, citingSection.start + 70),
  }));
  const relationshipBuilt = buildRelationshipRevision({
    source_occurrence_id: citingProvision.provision_instance_id,
    relationship_definition_key: 'TRIGGERED_BY',
    relationship_definition_version: 1,
    ordinal: 0,
    state: 'PRESENT',
    raw_scope: 'test cited ground text',
    target_occurrence_ids: [citedProvision.provision_instance_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
    },
    evidence: [
      { evidence_role: 'DERIVATION_INPUT', excerpt_id: citingExcerpt.excerpt_id, document_ordinal: 0, absolute_start: citingExcerpt.absolute_start, absolute_end: citingExcerpt.absolute_end },
      { evidence_role: 'CROSS_REFERENCE', excerpt_id: citedExcerpt.excerpt_id, document_ordinal: 0, absolute_start: citedExcerpt.absolute_start, absolute_end: citedExcerpt.absolute_end },
    ],
  });
  // closure_id: same domain/formula as candidate-resolution.js's own
  // mintCitationTriggeredByRelationship (buildRelationshipRevision's raw
  // output never carries one -- see that function's own comment on why).
  const relationship = {
    ...relationshipBuilt,
    closure_id: contentId('CITATION_TRIGGERED_BY_RELATIONSHIP_CLOSURE/V1', { relationship_revision_id: relationshipBuilt.relationship_revision_id }),
  };

  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: {
      // citingProvision itself is supplied here exactly as a real caller
      // supplies every OTHER resolved claim's own provision_instance (see
      // scripts/canonical-v2-live-extraction-run.mjs, `provisionsById = new
      // Map(resolution.resolved.map((entry) => [...,
      // entry.provision_instance]))`) -- citation-following mints a NEW
      // relationship, not a new claim, so it does not appear in
      // resolution.resolved itself, but the provision it names as its
      // source_occurrence_id must still be present in the write set for
      // validate-write-set.js's own referential-integrity checks.
      provisions: [citingProvision],
      limb_component_trees: [],
      ioc_restriction_components: [],
      relationships: [{
        relationship, cited_provision: citedProvision, cited_reference: '3.1(c)', excerpts: [citingExcerpt, citedExcerpt],
      }],
    },
  });

  assert.equal(result.write_set.relationships.length, 1);
  assert.equal(result.write_set.relationships[0].relationship_occurrence_id, relationship.relationship_occurrence_id);
  assert.equal(result.write_set.relationships[0].relationship_definition_key, 'TRIGGERED_BY');
  // Unshifted: the relationship's own evidence offsets are exactly what was
  // supplied, never re-derived from a section-local buffer.
  assert.deepEqual(
    result.write_set.relationships[0].evidence.map((e) => [e.absolute_start, e.absolute_end]),
    [[citingExcerpt.absolute_start, citingExcerpt.absolute_end], [citedExcerpt.absolute_start, citedExcerpt.absolute_end]],
  );
  assert.ok(result.write_set.excerpts.some((e) => e.excerpt_id === citingExcerpt.excerpt_id));
  assert.ok(result.write_set.excerpts.some((e) => e.excerpt_id === citedExcerpt.excerpt_id));
  assert.ok(result.write_set.provisions.some((p) => p.provision_instance_id === citedProvision.provision_instance_id));
  assert.equal(result.counts.candidates_written, result.write_set.claims.length + result.write_set.relationships.length);

  const validation = validateResolvedCanonicalWriteSet({
    writeSet: result.write_set,
    contractBundle,
    admittedSourceContexts: result.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true, `expected the real validator to accept this write set: ${JSON.stringify(validation.residuals)}`);
});

test('citation-following: absent or empty resolution.relationships leaves the write set byte-identical to today (inert)', async () => {
  const receipt = await buildSimpleReceipt();
  const withoutField = buildNativeWriteSet({
    run_receipt: receipt, source_text: qxoRealisticFullText, document_hash: DOCUMENT_HASH, admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: { provisions: [], limb_component_trees: [], ioc_restriction_components: [] },
  });
  const withEmptyArray = buildNativeWriteSet({
    run_receipt: receipt, source_text: qxoRealisticFullText, document_hash: DOCUMENT_HASH, admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: {
      provisions: [], limb_component_trees: [], ioc_restriction_components: [], relationships: [],
    },
  });
  assert.deepEqual(withoutField.write_set.relationships, []);
  assert.deepEqual(withEmptyArray.write_set.relationships, []);
  assert.deepEqual(withoutField.write_set, withEmptyArray.write_set);
});

// ─── Round-trip ───

test('round-trip: every written candidate byte-slices the full source to exactly its raw_value', async () => {
  const receipt = await buildResolvableReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(result.write_set.claims.length, 3, 'all three proposals (two valid, one poisoned on canonical_value) shift and compile fine');
  const fullBytes = Buffer.from(qxoRealisticFullText, 'utf8');
  for (const claim of result.write_set.claims) {
    assert.ok(claim.evidence.length > 0);
    for (const edge of claim.evidence) {
      const sliced = fullBytes.subarray(edge.absolute_start, edge.absolute_end).toString('utf8');
      assert.equal(sliced, claim.raw_value, `evidence must reproduce raw_value for ordinal ${claim.ordinal}`);
    }
  }
});

// ─── The write set passes the REAL validator ───

test('the assembled write set passes validate-write-set.js\'s real validation without throwing', async () => {
  const receipt = await buildResolvableReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const validation = validateResolvedCanonicalWriteSet({
    writeSet: result.write_set,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: result.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true);
  assert.ok(Array.isArray(validation.residuals));
  assert.ok(Array.isArray(validation.quarantines));
});

// ─── Task 5 (docs/superpowers/plans/2026-08-01-claim-identity-provenance-
// plan.md, provenance tags): the write-set envelope gains
// `write_set_origin: 'NATIVE_PRODUCER'`, set by this adapter -- the ONE
// place a native-producer write set is ever assembled -- so
// validate-write-set.js's staged `answer_provenance` requirement has a
// discriminator to key on. ───

test('buildNativeWriteSet stamps write_set_origin: NATIVE_PRODUCER on every write set it assembles', async () => {
  const receipt = await buildResolvableReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(result.write_set.write_set_origin, 'NATIVE_PRODUCER');

  // The stamped field still passes the real validator (it is an ALLOWED
  // extra key on the resolved write-set contract, not an unknown one).
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: result.write_set,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: result.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
});

// ─── Failure isolation through the REAL validator ───

test('failure isolation through the real validator: one poisoned candidate is quarantined, its siblings survive and remain publishable', async () => {
  const receipt = await buildResolvableReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  assert.equal(result.write_set.claims.length, 3);

  // The adapter does not (and, from a run receipt alone, cannot) mint
  // PROVISION_INSTANCE rows -- concept_key/party are not carried on the run
  // receipt. The test supplies the one provision every claim here shares as
  // its subject, exactly as a full write-set assembler would, so this test
  // exercises real semantic-reference resolution rather than a validator
  // run where every row is quarantined for the same unrelated reason.
  const section = findSection(receipt, '3.1(b)');
  const provisionSpan = buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, section.start, section.end);
  const provision = buildProvisionInstance({
    source: ADMITTED_SOURCE_CONTEXT,
    span: provisionSpan,
    conceptKey: 'REP-T-CAP',
    party: REP_PARTY,
    ordinal: 1,
    contractBundle: CONTRACT_BUNDLE,
  });
  const provisionClosureId = contentId('NATIVE_WRITE_SET_ADAPTER_TEST_PROVISION_CLOSURE/V1', {
    provision_instance_id: provision.provision_instance_id,
  });

  const writeSet = {
    ...result.write_set,
    provisions: [{ ...provision, closure_id: provisionClosureId }],
  };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: result.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true);

  const poisoned = writeSet.claims.find((claim) => claim.canonical_value === 'NOT_A_REAL_ACCURACY_CODE');
  const siblings = writeSet.claims.filter((claim) => claim.canonical_value !== 'NOT_A_REAL_ACCURACY_CODE');
  assert.equal(siblings.length, 2);
  assert.notEqual(poisoned.closure_id, siblings[0].closure_id);
  assert.notEqual(poisoned.closure_id, siblings[1].closure_id);

  assert.equal(validation.quarantinedClosureIds.length, 1, 'exactly one closure is quarantined');
  assert.equal(validation.quarantinedClosureIds[0], poisoned.closure_id);
  assert.ok(
    validation.residuals.some((residual) => residual.closure_id === poisoned.closure_id
      && residual.reason_code === 'INVALID_CANONICAL_VALUE'),
    'the real validator, not the adapter, is what caught the invalid canonical_value',
  );

  const publishableIds = validation.publishableWriteSet.claims.map((claim) => claim.claim_revision_id);
  assert.ok(!publishableIds.includes(poisoned.claim_revision_id), 'the poisoned candidate never reaches the publishable set');
  for (const sibling of siblings) {
    assert.ok(publishableIds.includes(sibling.claim_revision_id), 'each clean sibling remains publishable');
    assert.equal(sibling.publication_state, 'VALIDATED');
  }

  // The shared limb-(iii) excerpt (cited by both the valid clause-(iii)
  // claim and the poisoned one) sits in its OWN closure and survives too --
  // quarantining the poisoned claim's closure never reaches into evidence
  // it merely shares.
  const limbIIIExcerptId = siblings.find((c) => c.raw_value === LIMB_III_QUOTE).evidence[0].excerpt_id;
  assert.ok(
    validation.publishableWriteSet.excerpts.some((excerpt) => excerpt.excerpt_id === limbIIIExcerptId),
  );
  assert.ok(
    validation.publishableWriteSet.provisions.some(
      (row) => row.provision_instance_id === provision.provision_instance_id,
    ),
    'the shared subject provision is unaffected by the poisoned candidate',
  );
});

// ─── Residual carry-through ───

test('residual carry-through: provider evidence_residuals and scope_violations both appear in the adapter\'s residual channel', async () => {
  const evidenceResiduals = [
    { reason: 'LIMB_ASSERTION_QUOTE_UNVERIFIED', quote_preview: 'a quote the provider could not evidence' },
  ];

  const provider = async ({ governed_scope: governedScope }) => {
    const valid = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    const validProposal = makeClaimProposal({
      subjectSeed: { kind: 'valid', section_reference: governedScope.section_reference },
      ordinal: 0,
      quote: LIMB_I_QUOTE,
      absoluteStart: valid.start,
      absoluteEnd: valid.end,
    });
    // Out of governed-scope bounds -- native-extraction-run.js rejects this
    // as a scope_violation before it ever reaches compilation.
    const sectionByteLength = Buffer.byteLength(governedScope.source_text, 'utf8');
    const outOfBoundsProposal = makeClaimProposal({
      subjectSeed: { kind: 'out-of-bounds', section_reference: governedScope.section_reference },
      ordinal: 1,
      quote: 'No Company Material Adverse Effect shall have occurred since the date of this Agreement.',
      absoluteStart: sectionByteLength + 10,
      absoluteEnd: sectionByteLength + 50,
    });
    return {
      provider_id: 'native-write-set-adapter-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-write-set-adapter-test-stub-prompt-v1',
      proposals: [validProposal, outOfBoundsProposal],
      evidence_residuals: evidenceResiduals,
    };
  };

  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider,
  });
  assert.equal(receipt.evidence_residuals.length, 1);
  assert.equal(receipt.scope_violations.length, 1);

  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const providerResidual = result.residuals.find((r) => r.residual_type === 'PROVIDER_EVIDENCE_RESIDUAL');
  assert.ok(providerResidual, 'the provider evidence_residual reached the write set residual channel');
  assert.equal(providerResidual.reason, 'LIMB_ASSERTION_QUOTE_UNVERIFIED');

  const scopeResidual = result.residuals.find((r) => r.residual_type === 'SCOPE_VIOLATION');
  assert.ok(scopeResidual, 'the scope_violation reached the write set residual channel');
  assert.equal(scopeResidual.reason, 'EVIDENCE_OUTSIDE_GOVERNED_SCOPE');

  // Nothing is silently dropped: one valid claim written, one residual per
  // thing the extractor found and could not evidence.
  assert.equal(result.write_set.claims.length, 1);
  assert.equal(result.residuals.length, 2);
});

// ─── Evidence coordinate-shift failure: typed residual, never a silent drop ───

test('an evidence span that fails to verify after shifting becomes a typed residual and is excluded, not silently dropped', async () => {
  const receipt = await buildSimpleReceipt();
  // The section-scope check inside runNativeExtraction already guarantees
  // every compiled candidate's evidence is genuinely section-local and
  // byte-exact, so a shift failure can only be manufactured here by
  // simulating what a genuinely bad receipt would look like: corrupt the
  // one compiled candidate's local evidence offset after the fact.
  const corruptEdge = {
    ...receipt.compiled_candidates[0].candidate.claim.evidence[0],
    absolute_start: 0,
    absolute_end: 3,
  };
  const corruptRow = {
    ...receipt.compiled_candidates[0].candidate.claim,
    evidence: [corruptEdge],
  };
  const corruptReceipt = {
    ...receipt,
    compiled_candidates: [{
      ...receipt.compiled_candidates[0],
      candidate: { ...receipt.compiled_candidates[0].candidate, claim: corruptRow },
    }],
  };

  const result = buildNativeWriteSet({
    run_receipt: corruptReceipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(result.write_set.claims.length, 0, 'the candidate with unverifiable evidence is not written');
  assert.equal(result.write_set.excerpts.length, 0);
  assert.equal(result.counts.candidates_rejected_by_coordinate_shift, 1);
  const shiftResidual = result.residuals.find((r) => r.residual_type === 'EVIDENCE_COORDINATE_SHIFT_FAILED');
  assert.ok(shiftResidual, 'the failed shift is recorded as a typed residual, never silently omitted');
  assert.equal(shiftResidual.reason_code, 'EVIDENCE_SHIFT_TEXT_MISMATCH');
  assert.equal(shiftResidual.closure_id, receipt.compiled_candidates[0].candidate.claim.closure_id);
});

// ─── Fail closed on structural inconsistency ───

test('fails closed and typed on a document_hash that does not match the run receipt', async () => {
  const receipt = await buildSimpleReceipt();
  assert.throws(() => buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: `${'a'.repeat(63)}0`,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  }), (error) => {
    assert.ok(error instanceof NativeWriteSetAdapterError);
    assert.equal(error.code, 'DOCUMENT_HASH_MISMATCH');
    return true;
  });
});

test('fails closed and typed when source_text does not match the admitted source context', async () => {
  const receipt = await buildSimpleReceipt();
  assert.throws(() => buildNativeWriteSet({
    run_receipt: receipt,
    source_text: `${qxoRealisticFullText} `,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  }), (error) => {
    assert.ok(error instanceof NativeWriteSetAdapterError);
    assert.ok(['SOURCE_TEXT_MISMATCH', 'SOURCE_LENGTH_MISMATCH', 'SOURCE_HASH_MISMATCH'].includes(error.code));
    return true;
  });
});

test('rejects malformed inputs instead of silently misbehaving', () => {
  assert.throws(() => buildNativeWriteSet({}), NativeWriteSetAdapterError);
  assert.throws(() => buildNativeWriteSet({
    run_receipt: { schema_version: 'NOT_THE_RIGHT_SCHEMA' },
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  }), NativeWriteSetAdapterError);
});

// ─── Component rows for assertion-node claim subjects (docs/superpowers/
// specs/2026-08-01-component-rows-design.md). Everything above this line is
// the PRE-EXISTING adapter suite, run unmodified against the new code -- its
// continued green run IS the "absent context = today's behaviour exactly"
// proof (spec point 5): not one of the tests above ever passes a
// `resolution` argument. The tests below exercise the new, additive path. ───

// A tree with TWO limb paths ((i) and (iii)), one assertion each, minted the
// same way candidate-resolution.js's own pre-pass does (mintLimbComponentTree
// over LIMB_ASSERTION-shaped compiled candidates) -- but built directly here,
// without going through the resolver, so this suite stays a pure adapter
// unit test per the file boundary (candidate-resolution.js is read-only from
// this task). Returns everything a caller assembling `resolution` needs:
// the provision (parent, for containment) and the tree (to find each
// subject's assertion node).
async function buildTwoAssertionReceipt() {
  let provision;
  let tree;
  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const provisionSpan = buildSemanticSpan(ADMITTED_SOURCE_CONTEXT, governedScope.start, governedScope.end);
      provision = buildProvisionInstance({
        source: ADMITTED_SOURCE_CONTEXT,
        span: provisionSpan,
        conceptKey: 'REP-T-CAP',
        party: REP_PARTY,
        ordinal: 1,
        contractBundle: CONTRACT_BUNDLE,
      });

      const limbI = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
      const limbIII = locateInGovernedScope(governedScope, LIMB_III_QUOTE);

      // The exact shape mintLimbComponentTree's own extractAssertionClaims/
      // operativeEvidenceOf reads (limb-components.js file header): one
      // LIMB_ASSERTION-keyed compiled candidate per assertion, SECTION-LOCAL
      // evidence, `attributes.limb_path` set.
      const assertionCandidates = [
        {
          ok: true,
          candidate: {
            kind: 'claim',
            claim: {
              claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
              claim_occurrence_id: contentId('NATIVE_WRITE_SET_ADAPTER_TEST_LIMB_OCC/V1', { limb_path: ['(i)'] }),
              raw_value: LIMB_I_QUOTE,
              attributes: { limb_path: ['(i)'] },
              evidence: [{
                evidence_role: 'OPERATIVE_TEXT', absolute_start: limbI.start, absolute_end: limbI.end,
              }],
            },
          },
        },
        {
          ok: true,
          candidate: {
            kind: 'claim',
            claim: {
              claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
              claim_occurrence_id: contentId('NATIVE_WRITE_SET_ADAPTER_TEST_LIMB_OCC/V1', { limb_path: ['(iii)'] }),
              raw_value: LIMB_III_QUOTE,
              attributes: { limb_path: ['(iii)'] },
              evidence: [{
                evidence_role: 'OPERATIVE_TEXT', absolute_start: limbIII.start, absolute_end: limbIII.end,
              }],
            },
          },
        },
      ];
      tree = mintLimbComponentTree({
        compiled_candidates: assertionCandidates,
        provision_instance_id: provision.provision_instance_id,
      });

      const assertionForPath = (limbPath) => tree.assertion_nodes.find(
        (node) => JSON.stringify(node.limb_path) === JSON.stringify(limbPath),
      );

      const proposalFor = ({
        ordinal, quote, start, end, subjectOccurrenceId,
      }) => ({
        kind: 'claim',
        proposal_kind: 'GOVERNED',
        subject_occurrence_id: subjectOccurrenceId,
        claim_definition_key: 'NATIVE_WRITE_SET_ADAPTER_COMPONENT_TEST_CLAIM_CANDIDATE',
        claim_definition_version: 1,
        ordinal,
        state: 'PRESENT',
        raw_value: quote,
        canonical_value: null,
        attributes: {},
        allowed_attributes: [],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [{
          evidence_role: 'OPERATIVE_TEXT',
          excerpt_id: contentId('NATIVE_WRITE_SET_ADAPTER_COMPONENT_TEST_EXCERPT/V1', {
            quote, start, end, ordinal,
          }),
          document_ordinal: 0,
          absolute_start: start,
          absolute_end: end,
          ordinal: 0,
        }],
        extraction_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
        normalisation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
        derivation_version: 'NATIVE_WRITE_SET_ADAPTER_TEST/V1',
      });

      return {
        provider_id: 'native-write-set-adapter-component-test-stub/v1',
        model_id: 'stub-model',
        prompt: 'native-write-set-adapter-component-test-stub-prompt-v1',
        // Order: (iii) BEFORE (i) -- span order is the REVERSE of array
        // order, on purpose, so ordinal-by-span (not by array position) is
        // the only thing that could make the permutation-invariance
        // assertions below pass.
        proposals: [
          proposalFor({
            ordinal: 0,
            quote: LIMB_III_QUOTE,
            start: limbIII.start,
            end: limbIII.end,
            subjectOccurrenceId: assertionForPath(['(iii)']).limb_component_id,
          }),
          proposalFor({
            ordinal: 1,
            quote: LIMB_I_QUOTE,
            start: limbI.start,
            end: limbI.end,
            subjectOccurrenceId: assertionForPath(['(i)']).limb_component_id,
          }),
        ],
        evidence_residuals: [],
      };
    },
  });
  return { receipt, provision, tree };
}

test('component minting: an assertion-node claim subject mints a REPRESENTATION_LIMB component contained in its parent provision', async () => {
  const { receipt, provision, tree } = await buildTwoAssertionReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: { provisions: [provision], limb_component_trees: [tree] },
  });

  assert.equal(result.write_set.components.length, 2);
  assert.equal(result.write_set.claims.length, 2);
  for (const component of result.write_set.components) {
    assert.equal(component.schema_version, 'PROVISION_COMPONENT/V1');
    assert.equal(component.component_key, 'REPRESENTATION_LIMB');
    assert.equal(component.parent_provision_instance_id, provision.provision_instance_id);
    assert.ok(component.absolute_start >= provision.absolute_start);
    assert.ok(component.absolute_end <= provision.absolute_end);
    assert.ok(typeof component.closure_id === 'string' && component.closure_id.length > 0);
  }

  // Ordinal is by ABSOLUTE SPAN ORDER, not by the array order the proposals
  // arrived in (the provider above deliberately emitted (iii) first): limb
  // (i) precedes limb (iii) in the governed section's own text, so limb (i)'s
  // component must be ordinal 1.
  const limbIAssertionId = tree.assertion_nodes.find((n) => JSON.stringify(n.limb_path) === '["(i)"]').limb_component_id;
  const limbIIIAssertionId = tree.assertion_nodes.find((n) => JSON.stringify(n.limb_path) === '["(iii)"]').limb_component_id;
  const mapByAssertionId = new Map(result.component_subject_map.map((entry) => [entry.assertion_node_id, entry]));
  const limbIComponentId = mapByAssertionId.get(limbIAssertionId).provision_component_id;
  const limbIIIComponentId = mapByAssertionId.get(limbIIIAssertionId).provision_component_id;
  const limbIComponent = result.write_set.components.find((c) => c.provision_component_id === limbIComponentId);
  const limbIIIComponent = result.write_set.components.find((c) => c.provision_component_id === limbIIIComponentId);
  assert.equal(limbIComponent.ordinal, 1);
  assert.equal(limbIIIComponent.ordinal, 2);

  // Point 4: the join is recorded, never inferred.
  assert.equal(result.component_subject_map.length, 2);
  for (const entry of result.component_subject_map) {
    assert.ok(typeof entry.assertion_node_id === 'string');
    assert.ok(typeof entry.provision_component_id === 'string');
    assert.ok(Array.isArray(entry.limb_path));
  }

  // Point 2: the claim's subject is rekeyed onto the minted component, and
  // both dependent identities (claim_occurrence_id keys on
  // subject_occurrence_id; claim_revision_id keys on both) are re-derived --
  // never left pointing at the resolver-layer LIMB_ASSERTION_COMPONENT/V1 id.
  for (const claim of result.write_set.claims) {
    const minted = result.write_set.components.find(
      (c) => c.provision_component_id === claim.subject_occurrence_id,
    );
    assert.ok(minted, 'every claim subject resolves to a minted component, never the resolution-layer node id');
    const expectedOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
      subject_occurrence_id: claim.subject_occurrence_id,
      claim_definition_key: claim.claim_definition_key,
      claim_definition_version: claim.claim_definition_version,
      ordinal: claim.ordinal,
    });
    assert.equal(claim.claim_occurrence_id, expectedOccurrenceId);
  }

  const provisionClosureId = contentId('NATIVE_WRITE_SET_ADAPTER_TEST_PROVISION_CLOSURE/V1', {
    provision_instance_id: provision.provision_instance_id,
  });
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: { ...result.write_set, provisions: [{ ...provision, closure_id: provisionClosureId }] },
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: result.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  // Real, unregistered generic claim keys quarantine at the validator (not
  // this adapter's concern) -- but the SEMANTIC_REFERENCE resolution this
  // design closes must never be the reason: assert it never appears.
  assert.ok(
    !validation.residuals.some((r) => r.reason_code === 'SEMANTIC_REFERENCE_UNRESOLVED'),
    'the minted component/rekeyed subject resolves cleanly at validation',
  );
});

test('component minting is permutation-invariant: component and rekeyed claim identities are byte-identical regardless of compiled_candidates array order', async () => {
  const { receipt, provision, tree } = await buildTwoAssertionReceipt();
  const resolution = { provisions: [provision], limb_component_trees: [tree] };

  const forward = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution,
  });
  assert.deepEqual(forward.write_set.provisions, [provision]);

  const reversedReceipt = {
    ...receipt,
    compiled_candidates: [...receipt.compiled_candidates].reverse(),
  };
  const reversed = buildNativeWriteSet({
    run_receipt: reversedReceipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution,
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
  assert.deepEqual(
    sortById(forward.component_subject_map, 'provision_component_id'),
    sortById(reversed.component_subject_map, 'provision_component_id'),
  );
});

test('absent resolution context: write_set.components and component_subject_map stay empty, exactly today\'s behaviour (spec point 5)', async () => {
  const { receipt } = await buildTwoAssertionReceipt();
  const result = buildNativeWriteSet({
    run_receipt: receipt,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    // No `resolution` -- the claims here carry resolver-layer assertion-node
    // subject ids that resolve against nothing; without a `resolution`
    // context this module has no way to know that, and must not try.
  });
  assert.deepEqual(result.write_set.components, []);
  assert.deepEqual(result.component_subject_map, []);
  // The claims themselves still write (evidence shifts fine) -- they are
  // simply left with their original, un-rekeyed subject, exactly as before
  // this design (module header: "This module passes them through verbatim").
  assert.equal(result.write_set.claims.length, 2);
  const originalSubjects = receipt.compiled_candidates.map((entry) => entry.candidate.claim.subject_occurrence_id);
  for (const claim of result.write_set.claims) {
    assert.ok(originalSubjects.includes(claim.subject_occurrence_id));
  }
});

test('a PATH-node claim subject is never minted a component (spec point 1: "path nodes never mint")', async () => {
  const { receipt, provision, tree } = await buildTwoAssertionReceipt();
  const pathNodeI = tree.path_nodes.find((n) => JSON.stringify(n.limb_path) === '["(i)"]');
  assert.ok(pathNodeI, 'limb (i) path node exists in the tree');

  // Rekey the FIRST compiled candidate's subject onto the PATH node instead
  // of its real assertion node.
  const [first, ...rest] = receipt.compiled_candidates;
  const retargeted = {
    ...receipt,
    compiled_candidates: [
      {
        ...first,
        candidate: {
          ...first.candidate,
          claim: { ...first.candidate.claim, subject_occurrence_id: pathNodeI.limb_component_id },
        },
      },
      ...rest,
    ],
  };

  const result = buildNativeWriteSet({
    run_receipt: retargeted,
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: { provisions: [provision], limb_component_trees: [tree] },
  });

  // One component minted (the OTHER candidate's real assertion-node
  // subject); the PATH-node-subject candidate's claim still writes (its
  // evidence shifts fine), but its subject is left untouched -- there is no
  // component for it to rekey onto.
  assert.equal(result.write_set.components.length, 1);
  assert.equal(result.write_set.claims.length, 2);
  const untouchedClaim = result.write_set.claims.find((c) => c.subject_occurrence_id === pathNodeI.limb_component_id);
  assert.ok(untouchedClaim, 'the PATH-node-subject claim keeps its original subject, unrekeyed');
});
