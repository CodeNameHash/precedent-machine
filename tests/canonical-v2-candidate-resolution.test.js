const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction, EXTRACTOR_ID } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const {
  shapeProposals,
  QUALIFIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  buildKnownDefectRegistry,
} = require('../lib/canonical-v2/native-producer/known-defect-registry');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─── Fixture: identity admitted-source chain (copied from
// tests/canonical-v2-native-write-set-adapter.test.js -- see that file's own
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

// ─── Fixture: the real QXO Section 3.1(b) capital-structure text, embedded
// in a realistic full-agreement shell -- same composition as
// tests/canonical-v2-native-write-set-adapter.test.js. ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

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
  '\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const DEAL_KEY = 'deal:qxo-candidate-resolution';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-candidate-resolution');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_III_QUOTE = '(iii)Except for any obligations pursuant to this Agreement,';
const QUALIFIER_QUOTE = 'duly authorized and are validly issued, fully paid and nonassessable';
const UNRESOLVED_PARTY_QUOTE = '10,000,000 shares of preferred stock, par value $0.01 per share';
const OPEN_WORLD_QUOTE = 'There are no voting trusts or other agreements';

function locateInGovernedScope(governedScope, quote) {
  const bytes = Buffer.from(governedScope.source_text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = bytes.indexOf(needle);
  if (start < 0) throw new Error(`test fixture quote not found in governed scope: ${quote}`);
  return { start, end: start + needle.length };
}

// A response shape matching capitalisation-producer-prompt.js's
// RESPONSE_SHAPE, run through the REAL anthropic-provider.js `shapeProposals`
// so every proposal this test resolves is genuinely producer-shaped (generic
// keys, mintSubjectId identities, byte-verified evidence) rather than a
// hand-rolled stand-in that could drift from what the real backend emits.
function parsedResponse({ includeUnresolvedParty = false } = {}) {
  const qualifiers = [{
    kind: 'ACCURACY',
    code: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    quote: QUALIFIER_QUOTE,
    attachment: {
      position: 'ITEM',
      governs_path: ['(i)'],
      ambiguity_signals: { items_grammatically_parallel: true },
    },
  }];
  if (includeUnresolvedParty) {
    qualifiers.push({
      kind: 'ACCURACY',
      code: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      quote: UNRESOLVED_PARTY_QUOTE,
      attachment: {
        position: 'ITEM',
        governs_path: ['(i)'],
        ambiguity_signals: { items_grammatically_parallel: true },
      },
    });
  }
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: includeUnresolvedParty ? 'Acme Holdco III' : 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [{
        limb_path: ['(i)'],
        assertion_quote: LIMB_I_QUOTE,
        subject: 'capital stock',
      }],
      qualifiers,
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

function realProducerProvider(options = {}) {
  return async ({ governed_scope: governedScope }) => {
    const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
      parsedResponse(options),
      governedScope.source_text,
    );
    return {
      provider_id: 'candidate-resolution-test-real-shape/v1',
      model_id: 'stub-model',
      prompt: 'candidate-resolution-test-real-shape-prompt/v1',
      proposals,
      evidence_residuals: evidenceResiduals,
    };
  };
}

async function buildReceipt(options) {
  return runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: realProducerProvider(options),
  });
}

function findResolved(resolution, genericKey) {
  return resolution.resolved.find((entry) => entry.generic_claim_key === genericKey);
}

// ─── Clean resolution: qualifier + bring-down tier auto-pass; limb assertion
// and the genuine open-world candidate both land in open_world. ───

test('a clean proposal with verified evidence, registered concept and resolved party auto-passes', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const qualifier = findResolved(resolution, QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier, 'the qualifier proposal resolved');
  assert.equal(qualifier.resolved_claim_definition_key, 'REPRESENTATION_ACCURACY_STANDARD');
  assert.equal(qualifier.concept_key, 'REP-T-CAP');
  assert.deepEqual(qualifier.party, { role: 'REPRESENTATION_MAKER', value: 'the Company', capacity: 'TARGET' });
  assert.equal(qualifier.triage.auto_pass, true);
  assert.deepEqual(qualifier.triage.reasons, []);

  const tier = findResolved(resolution, BRING_DOWN_TIER_CLAIM_KEY);
  assert.ok(tier, 'the bring-down tier proposal resolved');
  assert.equal(tier.resolved_claim_definition_key, 'REPRESENTATION_ACCURACY_STANDARD');
  assert.equal(tier.concept_key, 'COND-B-REP');
  assert.deepEqual(tier.party, { role: 'CONDITION_OBLIGOR', value: 'Parent', capacity: 'BUYER' });
  assert.equal(tier.triage.auto_pass, true);

  // Distinct concepts -> distinct provisions, even though minted in the same run.
  assert.notEqual(qualifier.provision_instance.provision_instance_id, tier.provision_instance.provision_instance_id);

  assert.equal(resolution.review_queue.length, 0);
});

test('a proposal with an unmappable concept lands in open_world, never forced to a near neighbour', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const limbAssertion = resolution.open_world.find((entry) => entry.claim_definition_key === LIMB_ASSERTION_CLAIM_KEY);
  assert.ok(limbAssertion, 'the limb assertion (no registered controlled-code claim) lands in open_world');
  assert.equal(limbAssertion.reason, 'UNMAPPED_GENERIC_CLAIM_KEY');
  assert.equal(limbAssertion.raw_value, LIMB_I_QUOTE);

  const genuineOpenWorld = resolution.open_world.find((entry) => entry.reason === 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.ok(genuineOpenWorld, 'the model\'s own open-world candidate is preserved, not resolved');
  assert.equal(genuineOpenWorld.raw_value, OPEN_WORLD_QUOTE);

  assert.ok(
    !resolution.resolved.some((entry) => entry.generic_claim_key === LIMB_ASSERTION_CLAIM_KEY),
    'an open-world proposal never also appears as resolved',
  );
});

// ─── Defect 4: the mapping table keys on (generic_claim_key,
// qualifier_kind), so a TEMPORAL or THRESHOLD qualifier -- which correctly
// carries canonical_value: null, since no ACCURACY_STANDARD code fits --
// resolves as open-world instead of being force-mapped onto
// REPRESENTATION_ACCURACY_STANDARD and quarantined for a canonical_value it
// was never supposed to have. ───

function temporalQualifierResponse() {
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
        kind: 'TEMPORAL',
        code: null,
        quote: 'as of the close of business on April 17, 2026',
        attachment: {
          position: 'ITEM',
          governs_path: ['(i)'],
          ambiguity_signals: { items_grammatically_parallel: true },
        },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

test('a TEMPORAL qualifier (canonical_value: null, no registered claim definition) resolves open-world, never quarantines as an accuracy claim', async () => {
  const source = [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Except as set forth in the Company Disclosure Letter, the Company represents ',
    'and warrants to Parent as follows:\n\n',
    'Section 3.1 Representations Concerning the Company.\n\n',
    '(a)Organization; Standing. The Company is a corporation duly organized, ',
    'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
    capitalStructureText,
    '\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(source, 'utf8'));

  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: documentHash,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        temporalQualifierResponse(),
        governedScope.source_text,
      );
      return {
        provider_id: 'candidate-resolution-test-temporal/v1',
        model_id: 'stub-model',
        prompt: 'candidate-resolution-test-temporal-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  const admittedSourceContext = buildIdentityAdmittedSourceContext(source, {
    dealKey: 'deal:qxo-temporal-qualifier',
    dealAdmissionId: sha256Hex('deal-admission:qxo-temporal-qualifier'),
    sourceOrdinal: 0,
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: admittedSourceContext,
  });

  assert.equal(
    resolution.resolved.some((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY),
    false,
    'the TEMPORAL qualifier never resolves to a REPRESENTATION_ACCURACY_STANDARD claim',
  );
  assert.equal(
    resolution.review_queue.some((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY),
    false,
    'it never reaches review_queue as an INVALID_CANONICAL_VALUE/UNREGISTERED_CANONICAL_VALUE claim either',
  );
  const openWorldEntry = resolution.open_world.find((entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.ok(openWorldEntry, 'the TEMPORAL qualifier lands in open_world instead');
  assert.equal(openWorldEntry.reason, 'UNMAPPED_GENERIC_CLAIM_KEY');
  assert.equal(openWorldEntry.raw_value, 'as of the close of business on April 17, 2026');
});

test('a proposal with an unresolvable party lands in review_queue with PARTY_UNRESOLVED, never a guessed party', async () => {
  const receipt = await buildReceipt({ includeUnresolvedParty: true });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const unresolved = resolution.review_queue.find((entry) => entry.raw_value === UNRESOLVED_PARTY_QUOTE);
  assert.ok(unresolved, 'the unresolvable-party proposal reached the review queue');
  assert.deepEqual(unresolved.reasons, ['PARTY_UNRESOLVED']);
  assert.equal(unresolved.has_resolution, false);
  assert.ok(
    !resolution.resolved.some((entry) => entry.claim.raw_value === UNRESOLVED_PARTY_QUOTE),
    'no provision or claim was minted for the party-unresolved proposal',
  );
});

// ─── Known-defect exclusion. ───

test('a proposal matching a known_defect_registry entry is excluded from auto-pass even when otherwise clean', async () => {
  const receipt = await buildReceipt();
  const registry = buildKnownDefectRegistry({
    version: 1,
    entries: [{
      deal: DEAL_KEY,
      family: 'REP-T-CAP',
      attribute: 'REPRESENTATION_ACCURACY_STANDARD',
      extraction_mechanism: EXTRACTOR_ID,
      pattern_description: 'test fixture: REP-T-CAP accuracy standard known-defective for this deal',
      date_added: '2026-07-31',
    }],
  });

  const withoutRegistry = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const cleanQualifier = findResolved(withoutRegistry, QUALIFIER_CLAIM_KEY);
  assert.equal(cleanQualifier.triage.auto_pass, true, 'sanity: this candidate auto-passes without the registry');

  const withRegistry = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    known_defect_registry: registry,
  });
  const defectedQualifier = findResolved(withRegistry, QUALIFIER_CLAIM_KEY);
  assert.equal(defectedQualifier.triage.auto_pass, false);
  assert.ok(defectedQualifier.triage.reasons.includes('KNOWN_DEFECT_MATCH'));
  assert.ok(defectedQualifier.triage.known_defect);

  // The bring-down tier is a DIFFERENT family (COND-B-REP) -- the registry
  // entry must not bleed into a family it does not name.
  const unaffectedTier = findResolved(withRegistry, BRING_DOWN_TIER_CLAIM_KEY);
  assert.equal(unaffectedTier.triage.auto_pass, true);
});

// ─── Producer contract violation: ABSENT is a typed failure, not a resolution. ───

test('a proposal claiming ABSENT is a typed failure, not a resolution', async () => {
  const provider = async ({ governed_scope: governedScope }) => {
    const evidence = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    return {
      provider_id: 'candidate-resolution-test-absent/v1',
      model_id: 'stub-model',
      prompt: 'candidate-resolution-test-absent-prompt/v1',
      proposals: [{
        kind: 'claim',
        proposal_kind: 'GOVERNED',
        subject_occurrence_id: contentId('CANDIDATE_RESOLUTION_TEST_SUBJECT/V1', { seed: 'absent' }),
        claim_definition_key: QUALIFIER_CLAIM_KEY,
        claim_definition_version: 1,
        ordinal: 0,
        state: 'ABSENT',
        raw_value: null,
        canonical_value: null,
        attributes: {},
        allowed_attributes: [],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [{
          evidence_role: 'OPERATIVE_TEXT',
          excerpt_id: contentId('CANDIDATE_RESOLUTION_TEST_EXCERPT/V1', { seed: 'absent' }),
          document_ordinal: 0,
          absolute_start: evidence.start,
          absolute_end: evidence.end,
          ordinal: 0,
        }],
        extraction_version: 'CANDIDATE_RESOLUTION_TEST/V1',
        normalisation_version: 'CANDIDATE_RESOLUTION_TEST/V1',
        derivation_version: 'CANDIDATE_RESOLUTION_TEST/V1',
      }],
      evidence_residuals: [],
    };
  };

  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider,
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.review_queue.length, 0);
  assert.equal(resolution.open_world.length, 0);
  const violation = resolution.residuals.find((entry) => entry.residual_type === 'PRODUCER_CONTRACT_VIOLATION');
  assert.ok(violation, 'the ABSENT proposal surfaced as a typed producer-contract violation');
  assert.equal(violation.reason_code, 'DISALLOWED_PROPOSAL_STATE');
});

// ─── Structural triage: multi-span/composed and nested/cross-referenced
// evidence never auto-pass, even though they still resolve. ───

function manualQualifierProposal({
  subjectSeed, evidenceSpecs, partyValue = 'the Company', canonicalValue = 'MAT_ALL_RESPECTS_DE_MINIMIS',
}) {
  return (governedScope) => {
    const bytes = Buffer.from(governedScope.source_text, 'utf8');
    const evidence = evidenceSpecs.map((spec, ordinal) => {
      const located = locateInGovernedScope(governedScope, spec.quote);
      return {
        evidence_role: spec.role,
        excerpt_id: contentId('CANDIDATE_RESOLUTION_TEST_EXCERPT/V1', { subjectSeed, quote: spec.quote, ordinal }),
        document_ordinal: 0,
        absolute_start: located.start,
        absolute_end: located.end,
        ordinal,
      };
    });
    void bytes;
    return {
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: contentId('CANDIDATE_RESOLUTION_TEST_SUBJECT/V1', subjectSeed),
      claim_definition_key: QUALIFIER_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: 0,
      state: 'PRESENT',
      raw_value: evidenceSpecs[0].quote,
      canonical_value: canonicalValue,
      attributes: { party_making: partyValue, qualifier_kind: 'ACCURACY' },
      allowed_attributes: ['party_making', 'qualifier_kind'],
      taxonomy_codes: {},
      codebooks: {},
      evidence,
      extraction_version: 'CANDIDATE_RESOLUTION_TEST/V1',
      normalisation_version: 'CANDIDATE_RESOLUTION_TEST/V1',
      derivation_version: 'CANDIDATE_RESOLUTION_TEST/V1',
    };
  };
}

test('multi-span/composed and nested-definition proposals resolve but never auto-pass', async () => {
  const provider = async ({ governed_scope: governedScope }) => {
    const multiSpan = manualQualifierProposal({
      subjectSeed: { case: 'multi-span' },
      // native-extraction-run.js's own scope check verifies EVERY evidence
      // edge's byte slice against the proposal's single raw_value, so a
      // fixture with two genuinely different quotes would be rejected as a
      // scope violation before it ever reaches this resolver -- that check
      // is upstream and out of scope here. Two edges over the SAME quote is
      // enough to exercise this module's own, purely structural
      // MULTI_SPAN_COMPOSED signal (evidence.length > 1), which does not
      // care what the edges say, only how many there are.
      evidenceSpecs: [
        { quote: LIMB_I_QUOTE, role: 'OPERATIVE_TEXT' },
        { quote: LIMB_I_QUOTE, role: 'OPERATIVE_TEXT' },
      ],
    })(governedScope);
    multiSpan.raw_value = LIMB_I_QUOTE;
    const nested = manualQualifierProposal({
      subjectSeed: { case: 'nested' },
      evidenceSpecs: [{ quote: QUALIFIER_QUOTE, role: 'CROSS_REFERENCE' }],
    })(governedScope);
    nested.raw_value = QUALIFIER_QUOTE;
    return {
      provider_id: 'candidate-resolution-test-structural/v1',
      model_id: 'stub-model',
      prompt: 'candidate-resolution-test-structural-prompt/v1',
      proposals: [multiSpan, nested],
      evidence_residuals: [],
    };
  };

  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider,
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(resolution.resolved.length, 2);
  const multiSpanResolved = resolution.resolved.find((entry) => entry.claim.evidence.length > 1);
  assert.ok(multiSpanResolved, 'the multi-span candidate resolved');
  assert.equal(multiSpanResolved.triage.auto_pass, false);
  assert.ok(multiSpanResolved.triage.reasons.includes('MULTI_SPAN_COMPOSED'));

  const nestedResolved = resolution.resolved.find(
    (entry) => entry.claim.evidence.length === 1 && entry.claim.evidence[0].evidence_role !== 'OPERATIVE_TEXT',
  );
  assert.ok(nestedResolved, 'the cross-referenced candidate resolved');
  assert.equal(nestedResolved.triage.auto_pass, false);
  assert.ok(nestedResolved.triage.reasons.includes('NESTED_OR_CROSS_REFERENCED_EVIDENCE'));

  for (const entry of [multiSpanResolved, nestedResolved]) {
    assert.ok(
      resolution.review_queue.some((item) => item.closure_id === entry.claim.closure_id),
      'a non-auto-pass resolved candidate also appears in review_queue',
    );
  }
});

// ─── Review-queue ordering. ───

test('materiality table ranks a termination-fee family above notices/administrative, per the M3 ledger', () => {
  const fee = materialityFor({ conceptKey: 'TERMF-TARGET', canonicalValue: null });
  const notice = materialityFor({ conceptKey: 'NOTICE-DELIVERY', canonicalValue: null });
  assert.ok(fee.rank < notice.rank, 'fees rank above notices/administrative');
  assert.equal(fee.label, 'FEES');
  assert.equal(notice.label, 'NOTICES_ADMINISTRATIVE');
  // Sanity on the whole table's ordering direction (ledger order).
  const byLabel = Object.fromEntries(MATERIALITY_TABLE.map((tier) => [tier.label, tier.rank]));
  assert.ok(byLabel.TERMINATION_RIGHTS < byLabel.FEES);
  assert.ok(byLabel.FEES < byLabel.MAE);
  assert.ok(byLabel.MAE < byLabel.FIDUCIARY);
  assert.ok(byLabel.FIDUCIARY < byLabel.NO_SHOP_EXCEPTIONS);
  assert.ok(byLabel.NO_SHOP_EXCEPTIONS < byLabel.CONSIDERATION);
  assert.ok(byLabel.CONSIDERATION < byLabel.CLOSING_CONDITIONS);
  assert.ok(byLabel.CLOSING_CONDITIONS < byLabel.NOTICES_ADMINISTRATIVE);
});

test('review_queue orders a more material item ahead of a less material item end to end', async () => {
  // The producer today only emits REP-T-CAP (rank 55) and COND-B-REP (rank
  // 70) families, so this proves the actual sort behaviour on real resolved
  // review-queue entries using those two -- the ledger's own literal
  // "termination fee above notices" example is proven directly against
  // MATERIALITY_TABLE in the test above, since no termination-fee or notice
  // family reaches this producer's proposal vocabulary yet.
  const provider = async ({ governed_scope: governedScope }) => {
    const closingCondition = manualQualifierProposal({
      subjectSeed: { case: 'closing-condition-review' },
      evidenceSpecs: [{ quote: LIMB_III_QUOTE, role: 'OPERATIVE_TEXT' }],
      canonicalValue: 'NOT_A_REGISTERED_CODE',
    })(governedScope);
    closingCondition.claim_definition_key = BRING_DOWN_TIER_CLAIM_KEY;
    closingCondition.attributes = { condition_obligor: 'Parent' };
    closingCondition.allowed_attributes = ['condition_obligor'];
    closingCondition.raw_value = LIMB_III_QUOTE;

    const representation = manualQualifierProposal({
      subjectSeed: { case: 'representation-review' },
      evidenceSpecs: [{ quote: QUALIFIER_QUOTE, role: 'OPERATIVE_TEXT' }],
      canonicalValue: 'NOT_A_REGISTERED_CODE',
    })(governedScope);
    representation.raw_value = QUALIFIER_QUOTE;

    return {
      provider_id: 'candidate-resolution-test-ordering/v1',
      model_id: 'stub-model',
      prompt: 'candidate-resolution-test-ordering-prompt/v1',
      proposals: [closingCondition, representation],
      evidence_residuals: [],
    };
  };

  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider,
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  assert.equal(resolution.review_queue.length, 2);
  assert.equal(resolution.review_queue[0].concept_key, 'REP-T-CAP');
  assert.equal(resolution.review_queue[1].concept_key, 'COND-B-REP');
  assert.ok(resolution.review_queue[0].materiality_rank < resolution.review_queue[1].materiality_rank);
});

// ─── Determinism. ───

test('same inputs produce a byte-identical resolution_receipt', async () => {
  const receipt = await buildReceipt();
  const first = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  const second = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  assert.equal(
    canonicalJson(first.resolution_receipt),
    canonicalJson(second.resolution_receipt),
  );
  assert.equal(first.resolution_receipt.resolution_receipt_id, second.resolution_receipt.resolution_receipt_id);
});

// ─── Resolved output feeds buildNativeWriteSet and passes the REAL validator. ───

test('resolved output feeds buildNativeWriteSet and passes the real validate-write-set.js', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });
  assert.ok(resolution.resolved.length >= 2);
  assert.ok(resolution.resolved.every((entry) => entry.triage.auto_pass));

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

  assert.equal(adapterResult.write_set.claims.length, resolution.resolved.length);
  assert.equal(adapterResult.residuals.length, 0, 'every resolved candidate shifts and compiles cleanly');

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
  assert.equal(validation.residuals.length, 0, 'no SEMANTIC_REFERENCE_UNRESOLVED or other residual for auto-pass candidates');
  assert.equal(validation.quarantines.length, 0);

  // buildNativeWriteSet recomputes claim_revision_id a SECOND time (its own
  // job: shifting evidence to document-absolute offsets changes evidence_ids,
  // which the revision id is content-addressed over) -- so the identity that
  // must reach the publishable set is the adapter's own final one, not this
  // resolver's pre-shift claim_revision_id. Match on
  // (subject_occurrence_id, claim_definition_key, ordinal) instead, which
  // this resolver's rekeying guarantees is stable end to end.
  const publishableIds = validation.publishableWriteSet.claims.map((claim) => claim.claim_revision_id);
  assert.equal(adapterResult.write_set.claims.length, resolution.resolved.length);
  for (const claim of adapterResult.write_set.claims) {
    const matchesResolved = resolution.resolved.some(
      (entry) => entry.claim.subject_occurrence_id === claim.subject_occurrence_id
        && entry.claim.claim_definition_key === claim.claim_definition_key
        && entry.claim.ordinal === claim.ordinal,
    );
    assert.ok(matchesResolved, 'every written claim traces back to a resolved candidate');
    assert.ok(
      publishableIds.includes(claim.claim_revision_id),
      `written claim for ${claim.claim_definition_key} reached the publishable write set`,
    );
  }
  const publishableProvisionIds = validation.publishableWriteSet.provisions.map((row) => row.provision_instance_id);
  for (const provision of provisionsById.values()) {
    assert.ok(publishableProvisionIds.includes(provision.provision_instance_id));
  }
});
