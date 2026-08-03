const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
  compileFixtureContractV13,
} = require('../lib/canonical-v2/contract-bundle');
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
  MAPPING_TABLE_VERSION,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { QUALIFIER_KIND_LEXICON_VERSION } = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');
const { MEASUREMENT_DATE_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/measurement-date-parse');
const { buildRulingCorpus } = require('../lib/canonical-v2/native-producer/ruling-corpus');

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

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_III_QUOTE = '(iii)Except for any obligations pursuant to this Agreement,';
const QUALIFIER_QUOTE = 'duly authorized and are validly issued, fully paid and nonassessable';
const OPEN_WORLD_QUOTE = 'There are no voting trusts or other agreements';

// ─── Task 3 rekey fixtures. The V3 GENERIC_CLAIM_KEY_RESOLUTION_TABLE keys
// on a DETERMINISTIC kind computed from the quote's own TEXT (qualifier-
// kind-lexicon.js), never from a model-supplied `kind`/`code` field, so a
// qualifier's fate under the new table depends on real marker phrases --
// these constants name exact ACCURACY_CODE_WHITELIST phrases (and other
// lexicon-marker phrases) appended to the governed section's own text below
// (`ACCURACY_TAIL_TEXT`), so every quote referenced here is both a real,
// byte-verifiable substring of the governed scope AND deterministically
// classifiable the way each test intends. ───

// Exact ACCURACY_CODE_WHITELIST phrase -> MAT_ALL_RESPECTS.
const ACCURACY_CHAPEAU_QUOTE = 'true and correct in all respects';
// Exact ACCURACY_CODE_WHITELIST phrase -> MAT_ALL_RESPECTS_DE_MINIMIS. The
// "except for de minimis inaccuracies" clause binds into the SAME ACCURACY
// unit (exception-connective binding rule), so this whole string classifies
// CLASSIFIED/ACCURACY, not SPLIT.
const ACCURACY_CHAPEAU_DE_MINIMIS_QUOTE = 'true and correct in all respects, except for de minimis inaccuracies';
// SPLITs into one ACCURACY part ("correct and complete ", code null -- no
// whitelist match -- so it always routes to review) and one TEMPORAL part
// ("as of the date hereof", measurement-date-eligible because it was split
// from an ACCURACY host).
const ACCURACY_TEMPORAL_SPLIT_QUOTE = 'correct and complete as of the date hereof';
// SPLITs into one KNOWLEDGE part and one TEMPORAL part that is NOT
// measurement-date-eligible (split from a KNOWLEDGE host, not ACCURACY --
// spec section 2's stated worked example, round-2 finding 2).
const KNOWLEDGE_TEMPORAL_SPLIT_QUOTE = 'To the knowledge of the Company as of the date hereof';
// Present verbatim in the real QXO fixture (limb (i)): a calendar-date
// TEMPORAL, classifiable and measurement-date-parseable with no extra text.
const TEMPORAL_CALENDAR_QUOTE = 'As of April 17, 2026';
// Present verbatim in the real QXO fixture (limb (i)): a symbolic-date
// TEMPORAL that only resolves when the caller injects a governed
// agreement_date.
const TEMPORAL_SYMBOLIC_QUOTE = 'as of the date hereof';
// Present verbatim in the real QXO fixture (limb (ii)) -- the plan's own
// Task 2 test case: "'correct and complete list of Company Options'
// ITEM-attached never resolves rep-level" (it also never resolves CHAPEAU-
// attached: no whitelist phrase matches the WHOLE quote, so it is
// QUALIFIER_KIND_UNCLASSIFIED regardless of attachment position).
const ACCURACY_NO_CODE_QUOTE = 'correct and complete list of Company Options';
// A distinct, unresolvable-party quote for the PARTY_UNRESOLVED test --
// reuses the DE_MINIMIS whitelist phrase so classification succeeds and the
// failure is squarely on party resolution, not kind.
const UNRESOLVED_PARTY_QUOTE = ACCURACY_CHAPEAU_DE_MINIMIS_QUOTE;

const ACCURACY_TAIL_TEXT = [
  ' The Company represents that the following statement is ',
  ACCURACY_CHAPEAU_QUOTE,
  '.',
  ' The related schedule is ',
  ACCURACY_CHAPEAU_DE_MINIMIS_QUOTE,
  '.',
  ' The Company represents that the following is ',
  ACCURACY_TEMPORAL_SPLIT_QUOTE,
  '.',
  ' ',
  KNOWLEDGE_TEMPORAL_SPLIT_QUOTE,
  ', no such default exists.',
].join('');

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
const DEAL_KEY = 'deal:qxo-candidate-resolution';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-candidate-resolution');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

// The default V1 fixture bundle (CONTRACT_BUNDLE above) does not register
// REPRESENTATION_MEASUREMENT_DATE at all -- contract-bundle.js's
// compileFixtureContract() only accepts one of a CLOSED set of known
// version shapes (validateInput's KNOWN_VERSION_SHAPES), so an ad-hoc bundle
// cannot be hand-assembled here. compileFixtureContractV13() is the
// smallest pre-registered shape that DOES register it (plus KNOWLEDGE_
// QUALIFIER, already in V1) -- used only by the tests that specifically
// exercise the TEMPORAL -> REPRESENTATION_MEASUREMENT_DATE mapping.
const CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE = compileFixtureContractV13();

function chapeauAttachment() {
  return Object.freeze({
    position: 'CHAPEAU',
    governs_path: null,
    ambiguity_signals: { items_grammatically_parallel: null },
  });
}

function itemAttachment(governsPath) {
  return Object.freeze({
    position: 'ITEM',
    governs_path: governsPath,
    ambiguity_signals: { items_grammatically_parallel: true },
  });
}

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
function parsedResponse({ includeUnresolvedParty = false, sectionReference = '3.1(b)' } = {}) {
  // NOTE (Task 3 rekey): `kind`/`code` below are the PRODUCER'S hint only --
  // the deterministic classifier (qualifier-kind-lexicon.js) recomputes both
  // from the quote's own text, so what actually resolves is a function of
  // ACCURACY_CHAPEAU_QUOTE's real content, not these fields. They are kept
  // consistent with what the lexicon will independently derive so the
  // "model agrees" path is exercised (model-hint absence/disagreement is
  // covered by qualifier-kind-lexicon's own test suite, not this file's).
  const qualifiers = [{
    kind: 'ACCURACY',
    code: 'MAT_ALL_RESPECTS',
    quote: ACCURACY_CHAPEAU_QUOTE,
    attachment: {
      position: 'CHAPEAU',
      governs_path: null,
      ambiguity_signals: { items_grammatically_parallel: null },
    },
  }];
  if (includeUnresolvedParty) {
    qualifiers.push({
      kind: 'ACCURACY',
      code: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      quote: UNRESOLVED_PARTY_QUOTE,
      attachment: {
        position: 'CHAPEAU',
        governs_path: null,
        ambiguity_signals: { items_grammatically_parallel: null },
      },
    });
  }
  return {
    representation_instances: [{
      section_reference: sectionReference,
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
  // CHANGED ASSERTION (Task 3 rekey): canonical_value is now derived
  // MECHANICALLY from the lexicon's ACCURACY_CODE_WHITELIST against the
  // quote's own text (spec section 2 rule 7), never carried through from
  // the producer's own `code` field -- ACCURACY_CHAPEAU_QUOTE's exact
  // whitelist match is MAT_ALL_RESPECTS, not whatever the fake model
  // response happened to send.
  assert.equal(qualifier.claim.canonical_value, 'MAT_ALL_RESPECTS');
  // CHANGED ASSERTION: the qualifier's subject is now the CHAPEAU-attached
  // provision itself (work item 6) -- unchanged in this CHAPEAU case, but
  // asserted explicitly since ITEM attachment would instead take an
  // assertion-node subject from the limb component tree.
  assert.equal(qualifier.claim.subject_occurrence_id, qualifier.provision_instance.provision_instance_id);
  assert.equal(qualifier.triage.deterministic_gates_passed, true);
  // auto_pass stays FALSE until the v1/v2 comparator and the lexical net
  // exist: a check that never ran must not look like a check that passed.
  // SPEC-MANDATED PIN UPDATE (docs/superpowers/specs/2026-08-02-lexical-
  // disagreement-net-design.md, "Auto-pass arithmetic", audit M4): a THIRD
  // entry, SOURCE_SCOPE_CERTIFICATION_ABSENT, is now PERMANENT here --
  // certified-complete source scope and mandatory-review selection remain
  // structurally unrepresented even after both nets land, so this entry
  // never clears via either net's wiring. This is the one intentional,
  // spec-required change to a previously-committed pin in this slice.
  assert.equal(qualifier.triage.auto_pass, false);
  assert.deepEqual([...qualifier.triage.unevaluated_conditions].sort(),
    ['LEXICAL_DISAGREEMENT_NET_ABSENT', 'SOURCE_SCOPE_CERTIFICATION_ABSENT', 'V1_V2_COMPARATOR_ABSENT']);
  assert.deepEqual(qualifier.triage.reasons, []);

  const tier = findResolved(resolution, BRING_DOWN_TIER_CLAIM_KEY);
  assert.ok(tier, 'the bring-down tier proposal resolved');
  assert.equal(tier.resolved_claim_definition_key, 'REPRESENTATION_ACCURACY_STANDARD');
  assert.ok(tier.triage.unevaluated_conditions.includes('BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING'));
  assert.equal(tier.concept_key, 'COND-B-REP');
  assert.deepEqual(tier.party, { role: 'CONDITION_OBLIGOR', value: 'Parent', capacity: 'BUYER' });
  assert.equal(tier.triage.deterministic_gates_passed, true);
  assert.equal(tier.triage.auto_pass, false);

  // Distinct concepts -> distinct provisions, even though minted in the same run.
  assert.notEqual(qualifier.provision_instance.provision_instance_id, tier.provision_instance.provision_instance_id);

  // Both candidates clear every deterministic gate, so neither carries a
  // triage reason -- but both still route to review while auto-pass is
  // blocked on the two absent nets. Nothing is published on an unrun check.
  assert.equal(resolution.review_queue.length, 2);
  assert.ok(resolution.review_queue.every((item) => item.reasons.length === 0
    || item.reasons.every((r) => r === 'AUTO_PASS_BLOCKED_PENDING_NETS')));
  // Review-queue items now carry the ruling-corpus key fields (work item 8).
  assert.ok(resolution.review_queue.every((item) => typeof item.normalised_phrase === 'string'));
  assert.ok(resolution.review_queue.some((item) => item.concept_family === 'REP-T-CAP'));

  // NEW (work item 6): a limb component tree is minted for the governed
  // representation regardless of which individual qualifiers resolve.
  assert.equal(resolution.limb_component_trees.length, 1);
  const tree = resolution.limb_component_trees[0];
  assert.equal(tree.provision_instance_id, qualifier.provision_instance.provision_instance_id);
  assert.ok(tree.path_nodes.length >= 1);
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

// ─── Defect 4 (V2-era; still true under the V3 rekey): a TEMPORAL or
// THRESHOLD qualifier -- which correctly carries canonical_value: null,
// since no ACCURACY_STANDARD code fits -- never force-maps onto
// REPRESENTATION_ACCURACY_STANDARD. Under V3 this quote additionally never
// even reaches TEMPORAL classification: "as of the close of business on
// April 17, 2026" does not immediately follow "as of" with a parseable
// calendar date or a closed symbolic phrase, so the lexicon abstains
// entirely (OPEN_WORLD, familySet.size === 0) before this module's own
// TEMPORAL-mapping logic is ever consulted -- see the new tests below for
// the POSITIVE TEMPORAL -> REPRESENTATION_MEASUREMENT_DATE path. ───

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

  // P2 qualifier kinds (docs/superpowers/specs/2026-08-02-p2-qualifier-
  // kinds-design.md, "CONVERTS ON REPLAY" table, audit C-1): this quote is
  // byte-form-identical to F28 closure b6185150… — the AS_OF_BRIDGE now
  // converts it to a plain CALENDAR measurement-date claim. The test's
  // original quarantine concern is UNCHANGED and still asserted: it never
  // resolves or queues as a REPRESENTATION_ACCURACY_STANDARD claim.
  // This test runs the LEGACY fixture bundle (compileFixtureContract(),
  // which predates REPRESENTATION_MEASUREMENT_DATE), so the conversion
  // cannot complete against this vocabulary — and the outcome is the TYPED
  // residual, never a silent drop:
  const residual = (resolution.residuals || []).find(
    (r) => r.residual_type === 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION'
      && r.mapped_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE',
  );
  assert.ok(residual, 'legacy-vocabulary run surfaces the typed VOCABULARY_MISSING residual for the attempted date mint');
  assert.equal(
    resolution.resolved.some((entry) => entry.claim.registered_claim_definition_key === 'REPRESENTATION_ACCURACY_STANDARD'
      && entry.claim.canonical_value === null),
    false,
    'never quarantines as an accuracy claim',
  );
  assert.equal(
    resolution.review_queue.some((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY),
    false,
    'it never reaches review_queue as an INVALID_CANONICAL_VALUE/UNREGISTERED_CANONICAL_VALUE claim either',
  );
  const openWorldEntry = resolution.open_world.find((entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.equal(openWorldEntry, undefined, 'no longer falls open-world — the conversion is the P2 deliverable');
});

// ─── Task 3, work items 2-9: the new deterministic mappings, split
// handling, the ruling corpus, and the citation guard. All NEW tests
// (nothing here replaces an assertion from the 13 pre-Task-3 tests above). ───

// A single-qualifier response builder, reused by every new test below --
// the SAME shared qxoFullText/CONTRACT_BUNDLE/ADMITTED_SOURCE_CONTEXT
// fixtures the pre-Task-3 tests already use, so every one of these
// exercises the REAL producer-shaping path end to end.
function singleQualifierResponse({ quote, attachment, modelKind = null, modelCode = null }) {
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [
        { limb_path: ['(i)'], assertion_quote: LIMB_I_QUOTE, subject: 'capital stock' },
      ],
      qualifiers: [{ kind: modelKind, code: modelCode, quote, attachment }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

async function resolveSingleQualifier({ quote, attachment, modelKind = null, modelCode = null }, resolveOptions = {}) {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: resolveOptions.contract_vocabulary || CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        singleQualifierResponse({
          quote, attachment, modelKind, modelCode,
        }),
        governedScope.source_text,
      );
      return {
        provider_id: 'candidate-resolution-single-qualifier/v1',
        model_id: 'stub-model',
        prompt: 'candidate-resolution-single-qualifier-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: resolveOptions.contract_vocabulary || CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    ruling_corpus: resolveOptions.ruling_corpus,
    agreement_date: resolveOptions.agreement_date,
  });
}

test('(QUALIFIER, ACCURACY, ITEM) routes to review, never rep-level (work item 2)', async () => {
  const resolution = await resolveSingleQualifier({
    quote: ACCURACY_CHAPEAU_QUOTE,
    attachment: itemAttachment(['(i)']),
    modelKind: 'ACCURACY',
    modelCode: 'MAT_ALL_RESPECTS',
  });
  assert.equal(resolution.resolved.some((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY), false);
  const queued = resolution.review_queue.find((item) => item.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(queued, 'the ITEM-attached ACCURACY qualifier reached review_queue');
  assert.ok(queued.reasons.includes('ACCURACY_ITEM_ATTACHED_NOT_REP_LEVEL'));
  assert.equal(queued.concept_family, 'REP-T-CAP');
  assert.equal(queued.attachment_position, 'ITEM');
  assert.equal(queued.normalised_phrase, ACCURACY_CHAPEAU_QUOTE);
});

test('an ACCURACY qualifier whose whole quote matches no whitelist phrase routes to review regardless of attachment (plan Task 2 test case)', async () => {
  const resolution = await resolveSingleQualifier({
    quote: ACCURACY_NO_CODE_QUOTE,
    attachment: itemAttachment(['(ii)']),
    modelKind: 'ACCURACY',
  });
  assert.equal(resolution.resolved.length, 0);
  const queued = resolution.review_queue.find((item) => item.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(queued);
  assert.ok(queued.reasons.includes('QUALIFIER_KIND_UNCLASSIFIED'));

  // Never resolves CHAPEAU-attached either -- code derivation, not
  // attachment position, is what blocks this one.
  const chapeauResolution = await resolveSingleQualifier({
    quote: ACCURACY_NO_CODE_QUOTE,
    attachment: chapeauAttachment(),
    modelKind: 'ACCURACY',
  });
  assert.equal(chapeauResolution.resolved.length, 0);
  assert.ok(chapeauResolution.review_queue.some((item) => item.reasons.includes('QUALIFIER_KIND_UNCLASSIFIED')));
});

test('(QUALIFIER, TEMPORAL, *) resolves to REPRESENTATION_MEASUREMENT_DATE for a calendar date (work item 3, positive path)', async () => {
  const resolution = await resolveSingleQualifier(
    { quote: TEMPORAL_CALENDAR_QUOTE, attachment: chapeauAttachment(), modelKind: 'TEMPORAL' },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE },
  );
  const resolvedEntry = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(resolvedEntry, 'the calendar-date TEMPORAL qualifier resolved');
  assert.equal(resolvedEntry.resolved_claim_definition_key, 'REPRESENTATION_MEASUREMENT_DATE');
  assert.equal(resolvedEntry.claim.canonical_value, '2026-04-17');
  // Unenriched + not-comparable mark (spec section 3).
  assert.equal(resolvedEntry.claim.attributes.enrichment_state, 'UNENRICHED');
  assert.equal(resolvedEntry.claim.attributes.comparability, 'NOT_COMPARABLE');
  assert.equal(resolvedEntry.claim.attributes.measurement_date_resolution, 'CALENDAR');
});

test('(QUALIFIER, TEMPORAL, *) resolves a symbolic date only when a governed agreement_date is injected (work item 3, symbolic path)', async () => {
  const withoutDate = await resolveSingleQualifier(
    { quote: TEMPORAL_SYMBOLIC_QUOTE, attachment: chapeauAttachment(), modelKind: 'TEMPORAL' },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE },
  );
  assert.equal(withoutDate.resolved.some((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY), false);
  const openWorldEntry = withoutDate.open_world.find((entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.ok(openWorldEntry, 'unresolvable (no governed agreement_date) -> open world, per spec section 3');
  assert.equal(openWorldEntry.reason, 'TEMPORAL_MEASUREMENT_DATE_UNRESOLVED');

  const withDate = await resolveSingleQualifier(
    { quote: TEMPORAL_SYMBOLIC_QUOTE, attachment: chapeauAttachment(), modelKind: 'TEMPORAL' },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE, agreement_date: '2026-04-18' },
  );
  const resolvedEntry = withDate.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(resolvedEntry, 'resolves once the governed agreement_date is supplied');
  assert.equal(resolvedEntry.claim.canonical_value, '2026-04-18');
  assert.equal(resolvedEntry.claim.attributes.measurement_date_resolution, 'SYMBOLIC');
});

test('(QUALIFIER, KNOWLEDGE, *) resolves to KNOWLEDGE_QUALIFIER with canonical value true (work item 4)', async () => {
  // KNOWLEDGE_TEMPORAL_SPLIT_QUOTE splits into a KNOWLEDGE part and an
  // INELIGIBLE TEMPORAL part -- this test only asserts the KNOWLEDGE half;
  // the split/ineligibility behaviour is asserted by the SPLIT test below.
  const resolution = await resolveSingleQualifier({
    quote: KNOWLEDGE_TEMPORAL_SPLIT_QUOTE,
    attachment: chapeauAttachment(),
  });
  const resolvedEntry = resolution.resolved.find(
    (entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY && entry.resolved_claim_definition_key === 'KNOWLEDGE_QUALIFIER',
  );
  assert.ok(resolvedEntry, 'the KNOWLEDGE split part resolved');
  assert.equal(resolvedEntry.claim.canonical_value, true);
  assert.equal(resolvedEntry.claim.attributes.deterministic_kind, 'KNOWLEDGE');
});

test('SPLIT: ACCURACY (no code, review) + TEMPORAL (eligible, symbolic) parts resolve independently (work item 9)', async () => {
  const resolution = await resolveSingleQualifier(
    { quote: ACCURACY_TEMPORAL_SPLIT_QUOTE, attachment: chapeauAttachment() },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE, agreement_date: '2026-04-18' },
  );
  // The ACCURACY part ("correct and complete ") has no whitelist code ->
  // review, never rep-level.
  const queued = resolution.review_queue.find(
    (item) => item.generic_claim_key === QUALIFIER_CLAIM_KEY && item.reasons.includes('QUALIFIER_KIND_UNCLASSIFIED'),
  );
  assert.ok(queued, 'the ACCURACY split part (no whitelist code) routed to review');
  assert.equal(queued.normalised_phrase, 'correct and complete ');

  // The TEMPORAL part ("as of the date hereof") was split FROM an ACCURACY
  // host, so it is measurement-date-eligible, and resolves via the injected
  // agreement_date.
  const resolvedDate = resolution.resolved.find(
    (entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY && entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE',
  );
  assert.ok(resolvedDate, 'the TEMPORAL split part resolved to a measurement date');
  assert.equal(resolvedDate.claim.canonical_value, '2026-04-18');
  assert.equal(resolvedDate.claim.raw_value, 'as of the date hereof');
});

test('SPLIT: a TEMPORAL part split from a KNOWLEDGE host is NOT measurement-date-eligible (spec section 2, round-2 finding 2)', async () => {
  const resolution = await resolveSingleQualifier(
    { quote: KNOWLEDGE_TEMPORAL_SPLIT_QUOTE, attachment: chapeauAttachment() },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE, agreement_date: '2026-04-18' },
  );
  // Never mints a measurement date for this split, no matter that a
  // governed agreement_date is available.
  assert.equal(
    resolution.resolved.some((entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE'),
    false,
    'a TEMPORAL part split from a non-ACCURACY host never reaches the measurement-date mapping',
  );
  const ineligible = resolution.open_world.find(
    (entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY && entry.reason === 'TEMPORAL_MEASUREMENT_DATE_INELIGIBLE',
  );
  assert.ok(ineligible, 'the TEMPORAL part is open-world, typed as ineligible rather than merely unmapped');
  assert.equal(ineligible.raw_value, 'as of the date hereof');
});

test('CITATION_CORROBORATED_ONLY: a corroborated-only citation blocks auto-pass but still publishes, with the fact visible (Citation guard, work item 7)', async () => {
  // Reuses the SAME degenerate (no "Section 3.1" heading) document shape as
  // tests/canonical-v2-f28-second-live-fixture-replay.test.js so the REAL
  // citation-constructibility corroboration path (not tree construction)
  // fires, exactly as the spec's "Citation guard" section describes.
  const degenerateFullText = [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Except as set forth in the Company Disclosure Letter, the Company represents ',
    'and warrants to Parent as follows:\n\n',
    '(a)Organization; Standing. The Company is a corporation duly organized, ',
    'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
    capitalStructureText,
    ACCURACY_TAIL_TEXT,
    '\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(degenerateFullText, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(degenerateFullText, {
    dealKey: 'deal:qxo-citation-corroborated-only',
    dealAdmissionId: sha256Hex('deal-admission:qxo-citation-corroborated-only'),
    sourceOrdinal: 0,
  });

  const receipt = await runNativeExtraction({
    source_text: degenerateFullText,
    document_hash: documentHash,
    section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        singleQualifierResponse({
          quote: ACCURACY_CHAPEAU_QUOTE,
          attachment: chapeauAttachment(),
          modelKind: 'ACCURACY',
          modelCode: 'MAT_ALL_RESPECTS',
        }),
        governedScope.source_text,
      );
      return {
        provider_id: 'candidate-resolution-citation-corroborated/v1',
        model_id: 'stub-model',
        prompt: 'candidate-resolution-citation-corroborated-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  const qualifierEntry = receipt.compiled_candidates.find(
    (entry) => entry.candidate.kind === 'claim' && entry.candidate.claim.claim_definition_key === QUALIFIER_CLAIM_KEY,
  );
  assert.ok(qualifierEntry, 'the qualifier proposal compiled');
  assert.equal(qualifierEntry.citation_validation.accepted, true);
  assert.equal(qualifierEntry.citation_validation.validation_source, 'CORROBORATED_BY_DOCUMENT_TEXT');

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: admittedSourceContext,
  });

  const resolvedEntry = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(resolvedEntry, 'a corroborated-only citation still resolves -- it publishes with the fact visible');
  assert.ok(resolvedEntry.triage.reasons.includes('CITATION_CORROBORATED_ONLY'), 'the fact is visible in triage.reasons');
  assert.equal(resolvedEntry.triage.auto_pass, false, 'a corroborated-only citation can never auto-pass');
  // The citation guard is NOT itself a structural gate failure: it must not
  // force deterministic_gates_passed to false the way MULTI_SPAN_COMPOSED
  // etc. do -- see finalizeResolvedCandidate's own comment.
  assert.equal(resolvedEntry.triage.deterministic_gates_passed, true);

  const queued = resolution.review_queue.find((item) => item.closure_id === resolvedEntry.claim.closure_id);
  assert.ok(queued, 'still reaches review_queue while auto-pass is unconditionally blocked pending the two absent nets');
  assert.ok(queued.reasons.includes('CITATION_CORROBORATED_ONLY'));
});

test('the ruling corpus applies BEFORE the lexicon, and a lexicon disagreement routes to review as RULING_LEXICON_CONFLICT', async () => {
  const normalisedPhrase = ACCURACY_CHAPEAU_QUOTE;
  const rulingEntry = {
    schema_version: 'RULING_CORPUS_ENTRY/V1',
    normalised_phrase: normalisedPhrase,
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    // A WRONG ruling (KNOWLEDGE) that contradicts what the current lexicon
    // affirmatively says (ACCURACY) -- this is the conflict case.
    ruled_kind: 'KNOWLEDGE',
    ruled_code: null,
    ruler: 'test-fixture',
    ruled_at: '2026-08-01T00:00:00.000Z',
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: QUALIFIER_KIND_LEXICON_VERSION,
  };
  const corpus = buildRulingCorpus({ version: 1, rulings: [rulingEntry] });

  const resolution = await resolveSingleQualifier(
    { quote: ACCURACY_CHAPEAU_QUOTE, attachment: chapeauAttachment(), modelKind: 'ACCURACY' },
    { ruling_corpus: corpus },
  );
  assert.equal(resolution.resolved.length, 0);
  const queued = resolution.review_queue.find((item) => item.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(queued);
  assert.ok(queued.reasons.includes('RULING_LEXICON_CONFLICT'));
  assert.equal(resolution.resolution_receipt.ruling_corpus_id, corpus.ruling_corpus_id);
  assert.equal(resolution.resolution_receipt.ruling_corpus_version, corpus.version);
});

test('a VERIFIED ruling in agreement with the lexicon applies mechanically', async () => {
  const rulingEntry = {
    schema_version: 'RULING_CORPUS_ENTRY/V1',
    normalised_phrase: ACCURACY_CHAPEAU_QUOTE,
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    ruled_kind: 'ACCURACY',
    ruled_code: 'MAT_ALL_RESPECTS',
    ruler: 'test-fixture',
    ruled_at: '2026-08-01T00:00:00.000Z',
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: QUALIFIER_KIND_LEXICON_VERSION,
  };
  const corpus = buildRulingCorpus({ version: 1, rulings: [rulingEntry] });

  const resolution = await resolveSingleQualifier(
    { quote: ACCURACY_CHAPEAU_QUOTE, attachment: chapeauAttachment(), modelKind: 'ACCURACY' },
    { ruling_corpus: corpus },
  );
  const resolvedEntry = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(resolvedEntry, 'the VERIFIED ruling applied');
  assert.equal(resolvedEntry.claim.canonical_value, 'MAT_ALL_RESPECTS');
});

test('receipt pins MAPPING_TABLE_VERSION 17, the lexicon version, the measurement-date-parse version and the ruling corpus identity', async () => {
  const resolution = await resolveSingleQualifier({
    quote: ACCURACY_CHAPEAU_QUOTE,
    attachment: chapeauAttachment(),
    modelKind: 'ACCURACY',
  });
  assert.equal(resolution.resolution_receipt.mapping_table_version, MAPPING_TABLE_VERSION);
  // P1 cap-table numerics (docs/superpowers/specs/2026-08-02-p1-captable-
  // numerics-design.md section 4): MAPPING_TABLE_VERSION 3 -> 4, one new
  // unconditional SHARE_COUNT table entry. family-termination-fee slice
  // (docs/superpowers/specs/2026-08-02-family-termination-fee-design.md
  // section 4): MAPPING_TABLE_VERSION 4 -> 5, three new unconditional
  // entries (FEE_AMOUNT/FEE_TRIGGER/FEE_TAIL_PERIOD). family-no-shop slice:
  // 5 -> 6, five new unconditional entries. family-mae-definition slice
  // (docs/superpowers/specs/2026-08-02-family-mae-definition-design.md
  // section 4): MAPPING_TABLE_VERSION 6 -> 7, three new unconditional
  // entries (MAE_CARVEOUT/MAE_DEFINITION_PRONG/MAE_DISPROPORTIONALITY).
  assert.equal(MAPPING_TABLE_VERSION, 17);
  assert.equal(resolution.resolution_receipt.qualifier_kind_lexicon_version, QUALIFIER_KIND_LEXICON_VERSION);
  assert.equal(resolution.resolution_receipt.measurement_date_parse_version, MEASUREMENT_DATE_PARSE_VERSION);
  assert.equal(resolution.resolution_receipt.ruling_corpus_id, require('../lib/canonical-v2/native-producer/ruling-corpus').EMPTY_RULING_CORPUS.ruling_corpus_id);
});

test('ITEM-attached qualifier with a single assertion child takes the assertion-node subject (work item 6)', async () => {
  const resolution = await resolveSingleQualifier({
    quote: ACCURACY_CHAPEAU_QUOTE,
    attachment: itemAttachment(['(i)']),
    modelKind: 'ACCURACY',
  });
  // ACCURACY+ITEM never resolves rep-level (already covered above) -- this
  // test only asserts the TREE ITSELF still reflects limb (i)'s single
  // assertion, independent of the qualifier's own fate.
  assert.equal(resolution.limb_component_trees.length, 1);
  const tree = resolution.limb_component_trees[0];
  const pathNodeI = tree.path_nodes.find((node) => node.limb_path.length === 1 && node.limb_path[0] === '(i)');
  assert.ok(pathNodeI, 'limb (i) path node minted');
  const assertionUnderI = tree.assertion_nodes.filter((node) => node.parent_limb_component_id === pathNodeI.limb_component_id);
  assert.equal(assertionUnderI.length, 1);
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

// ─── Citation validation, never a silent drop (docs/handoffs/
// F28-SECOND-LIVE-RUN.md). A proposal whose citation is neither constructed
// from the sectionizer's tree nor corroborated by the document's own text
// still RESOLVES (a provision and claim are minted) but is routed to
// review_queue with a typed CITATION_NOT_VALIDATED reason, never silently
// auto-passed and never dropped. ───

test('a proposal whose citation cannot be validated (tree or corroboration) still resolves, but routes to review_queue with CITATION_NOT_VALIDATED', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        // A section_reference that resolves to neither a real tree node nor
        // any corroborating cross-reference text anywhere in qxoFullText.
        parsedResponse({ sectionReference: 'NOT-A-REAL-CITATION(z)(z)' }),
        governedScope.source_text,
      );
      return {
        provider_id: 'candidate-resolution-test-bad-citation/v1',
        model_id: 'stub-model',
        prompt: 'candidate-resolution-test-bad-citation-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  // Never a silent drop: the proposal still compiled into the run receipt.
  // (bring_down_conditions in this fixture still cites the real '3.1(b)',
  // so only the representation's own limb/qualifier proposals -- which
  // inherit the bad section_reference -- carry an unaccepted validation.)
  assert.ok(receipt.compiled_candidates.length > 0);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));
  const qualifierEntry = receipt.compiled_candidates.find(
    (entry) => entry.candidate.kind === 'claim' && entry.candidate.claim.claim_definition_key === QUALIFIER_CLAIM_KEY,
  );
  assert.ok(qualifierEntry, 'the qualifier proposal compiled');
  assert.ok(qualifierEntry.citation_validation);
  assert.equal(qualifierEntry.citation_validation.accepted, false);

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const qualifier = findResolved(resolution, QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier, 'the qualifier proposal still resolved -- a provision and claim were minted');
  assert.equal(qualifier.triage.deterministic_gates_passed, false);
  assert.ok(qualifier.triage.reasons.includes('CITATION_NOT_VALIDATED'));
  assert.equal(qualifier.triage.auto_pass, false);
  assert.equal(qualifier.triage.citation_validation.accepted, false);
  assert.equal(qualifier.triage.citation_validation.status, 'CITATION_NOT_CONSTRUCTIBLE');

  const queued = resolution.review_queue.find((item) => item.closure_id === qualifier.claim.closure_id);
  assert.ok(queued, 'the citation-unvalidated candidate reached review_queue, not silently accepted');
  assert.ok(queued.reasons.includes('CITATION_NOT_VALIDATED'));
});

test('a proposal whose citation IS validated (matches the governing section) carries no CITATION_NOT_VALIDATED reason', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  const qualifier = findResolved(resolution, QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier);
  assert.equal(qualifier.triage.citation_validation.accepted, true);
  assert.equal(qualifier.triage.citation_validation.validation_source, 'CONSTRUCTED_FROM_TREE');
  assert.ok(!qualifier.triage.reasons.includes('CITATION_NOT_VALIDATED'));
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
  assert.equal(cleanQualifier.triage.deterministic_gates_passed, true, 'sanity: clears every deterministic gate without the registry');

  const withRegistry = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    known_defect_registry: registry,
  });
  const defectedQualifier = findResolved(withRegistry, QUALIFIER_CLAIM_KEY);
  assert.equal(defectedQualifier.triage.deterministic_gates_passed, false);
  assert.ok(defectedQualifier.triage.reasons.includes('KNOWN_DEFECT_MATCH'));
  assert.ok(defectedQualifier.triage.reasons.includes('KNOWN_DEFECT_MATCH'));
  assert.ok(defectedQualifier.triage.known_defect);

  // The bring-down tier is a DIFFERENT family (COND-B-REP) -- the registry
  // entry must not bleed into a family it does not name.
  const unaffectedTier = findResolved(withRegistry, BRING_DOWN_TIER_CLAIM_KEY);
  assert.equal(unaffectedTier.triage.deterministic_gates_passed, true);
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
  attachment = chapeauAttachment(),
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
      // NOTE (Task 3 rekey): canonical_value here is only what the FAKE
      // producer sends -- the deterministic classifier now derives the
      // REAL canonical_value from the quote's own text (see the module's
      // rebuildClaim newCanonicalValue override), so this field's value is
      // no longer load-bearing for whether/how the claim resolves.
      canonical_value: canonicalValue,
      attributes: { party_making: partyValue, qualifier_kind: 'ACCURACY', attachment },
      allowed_attributes: ['party_making', 'qualifier_kind', 'attachment'],
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
      // care what the edges say, only how many there are. CHANGED (Task 3
      // rekey): the quote must now be one the deterministic classifier
      // actually resolves (ACCURACY_CHAPEAU_QUOTE), not LIMB_I_QUOTE, which
      // carries no lexicon marker at all and would route to review before
      // ever reaching this module's structural MULTI_SPAN_COMPOSED check.
      evidenceSpecs: [
        { quote: ACCURACY_CHAPEAU_QUOTE, role: 'OPERATIVE_TEXT' },
        { quote: ACCURACY_CHAPEAU_QUOTE, role: 'OPERATIVE_TEXT' },
      ],
    })(governedScope);
    multiSpan.raw_value = ACCURACY_CHAPEAU_QUOTE;
    const nested = manualQualifierProposal({
      subjectSeed: { case: 'nested' },
      evidenceSpecs: [{ quote: ACCURACY_CHAPEAU_QUOTE, role: 'CROSS_REFERENCE' }],
    })(governedScope);
    nested.raw_value = ACCURACY_CHAPEAU_QUOTE;
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
  assert.equal(multiSpanResolved.triage.deterministic_gates_passed, false);
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
  // What reaches the writer is gated on the DETERMINISTIC checks this stage
  // can actually run. auto_pass additionally requires the v1/v2 comparator
  // and lexical net, which do not exist yet -- see triage.unevaluated_conditions.
  assert.ok(resolution.resolved.every((entry) => entry.triage.deterministic_gates_passed));
  assert.ok(resolution.resolved.every((entry) => entry.triage.auto_pass === false));

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

// ─── Approval item 2 (M2) / spec section 2 rule 3 (M6a) / spec finding-2
// reachability (M6b) -- three approved fixes to the honest-tag and
// measurement-date-reachability behaviour, tests written failing-first per
// the module's house pattern. ───

// A KNOWLEDGE+calendar-date multi-family quote, NOT present in the shared
// qxoFullText fixture (only the KNOWLEDGE+symbolic-date variant is, via
// ACCURACY_TAIL_TEXT) -- so these tests need their own governed document
// with this exact quote embedded verbatim, same "tail text" composition
// pattern the shared fixture already uses for KNOWLEDGE_TEMPORAL_SPLIT_QUOTE.
const KNOWLEDGE_CALENDAR_SPLIT_QUOTE = 'To the knowledge of the Company as of April 17, 2026';
const KNOWLEDGE_CALENDAR_TAIL_TEXT = [' ', KNOWLEDGE_CALENDAR_SPLIT_QUOTE, ', no such default exists.'].join('');
const knowledgeCalendarFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  KNOWLEDGE_CALENDAR_TAIL_TEXT,
  '\n',
].join('');
const KNOWLEDGE_CALENDAR_DOCUMENT_HASH = sha256Hex(Buffer.from(knowledgeCalendarFullText, 'utf8'));
const KNOWLEDGE_CALENDAR_DEAL_KEY = 'deal:qxo-knowledge-calendar-split';
const KNOWLEDGE_CALENDAR_ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(knowledgeCalendarFullText, {
  dealKey: KNOWLEDGE_CALENDAR_DEAL_KEY,
  dealAdmissionId: sha256Hex(`deal-admission:${KNOWLEDGE_CALENDAR_DEAL_KEY}`),
  sourceOrdinal: 0,
});

async function resolveSingleQualifierInKnowledgeCalendarDocument(
  { quote, attachment, modelKind = null, modelCode = null },
  resolveOptions = {},
) {
  const receipt = await runNativeExtraction({
    source_text: knowledgeCalendarFullText,
    document_hash: KNOWLEDGE_CALENDAR_DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: resolveOptions.contract_vocabulary || CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        singleQualifierResponse({
          quote, attachment, modelKind, modelCode,
        }),
        governedScope.source_text,
      );
      return {
        provider_id: 'candidate-resolution-knowledge-calendar/v1',
        model_id: 'stub-model',
        prompt: 'candidate-resolution-knowledge-calendar-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: resolveOptions.contract_vocabulary || CONTRACT_BUNDLE,
    admitted_source_context: KNOWLEDGE_CALENDAR_ADMITTED_SOURCE_CONTEXT,
    ruling_corpus: resolveOptions.ruling_corpus,
    agreement_date: resolveOptions.agreement_date,
  });
}

test('bring-down claim answer_provenance pins the allowed-values-membership gate; qualifier-path pins carry no gate field (approval item 2, M2)', async () => {
  const receipt = await buildReceipt();
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
  });

  // Bring-down tier: MECHANICAL, but honest about resting on allowed-values
  // membership rather than a written resolver rule -- option (b), approved.
  const tier = findResolved(resolution, BRING_DOWN_TIER_CLAIM_KEY);
  assert.ok(tier, 'the bring-down tier proposal resolved');
  assert.equal(tier.claim.attributes.answer_provenance.tag, 'MECHANICAL');
  assert.equal(tier.claim.attributes.answer_provenance.pins.gate, 'ALLOWED_VALUES_MEMBERSHIP');

  // Qualifier path: kind/code IS a written resolver rule (the lexicon), so
  // its pins are unchanged -- no gate field, per the approval.
  const qualifier = findResolved(resolution, QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier, 'the qualifier proposal resolved');
  assert.equal(qualifier.claim.attributes.answer_provenance.tag, 'MECHANICAL');
  assert.equal(
    Object.prototype.hasOwnProperty.call(qualifier.claim.attributes.answer_provenance.pins, 'gate'),
    false,
    'qualifier-path pins must not gain a gate field',
  );
});

test('(QUALIFIER, KNOWLEDGE, *) preserves a split-off ineligible TEMPORAL date on the resolved KNOWLEDGE claim, and mints no measurement date (spec section 2 rule 3, M6a)', async () => {
  const resolution = await resolveSingleQualifierInKnowledgeCalendarDocument(
    { quote: KNOWLEDGE_CALENDAR_SPLIT_QUOTE, attachment: chapeauAttachment() },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE },
  );

  const resolvedEntry = resolution.resolved.find(
    (entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY && entry.resolved_claim_definition_key === 'KNOWLEDGE_QUALIFIER',
  );
  assert.ok(resolvedEntry, 'the KNOWLEDGE split part resolved');
  assert.equal(resolvedEntry.claim.canonical_value, true);
  assert.equal(resolvedEntry.claim.attributes.qualifier_dated_as_of, '2026-04-17');
  assert.equal(resolvedEntry.claim.attributes.qualifier_date_raw, 'as of April 17, 2026');

  assert.equal(
    resolution.resolved.some((entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE'),
    false,
    'a TEMPORAL part split from a KNOWLEDGE host never mints a measurement-date claim -- the date dates the qualifier',
  );
});

test('a VERIFIED corpus TEMPORAL ruling never mints a measurement date on a multi-family phrase (reachability is computed, not inherited); the same ruling still resolves normally on a clean whole-quote TEMPORAL (spec finding-2 reachability, M6b)', async () => {
  const multiFamilyQuote = KNOWLEDGE_CALENDAR_SPLIT_QUOTE;
  const multiFamilyRuling = {
    schema_version: 'RULING_CORPUS_ENTRY/V1',
    normalised_phrase: multiFamilyQuote,
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    // A human ruling settling KIND as TEMPORAL for this exact phrase --
    // rulings carry no split concept, so this applies to the WHOLE clause
    // as one unit. Reachability must still be computed by the lexicon rule,
    // never inherited from this ruling (spec finding-2).
    ruled_kind: 'TEMPORAL',
    ruled_code: null,
    ruler: 'test-fixture',
    ruled_at: '2026-08-01T00:00:00.000Z',
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: QUALIFIER_KIND_LEXICON_VERSION,
  };
  const multiFamilyCorpus = buildRulingCorpus({ version: 1, rulings: [multiFamilyRuling] });

  const multiFamilyResolution = await resolveSingleQualifierInKnowledgeCalendarDocument(
    { quote: multiFamilyQuote, attachment: chapeauAttachment(), modelKind: 'TEMPORAL' },
    {
      contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE,
      ruling_corpus: multiFamilyCorpus,
      agreement_date: '2026-04-18',
    },
  );

  assert.equal(
    multiFamilyResolution.resolved.some((entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE'),
    false,
    'a corpus-applied TEMPORAL ruling on a multi-family phrase never mints a measurement date',
  );
  const openWorldEntry = multiFamilyResolution.open_world.find(
    (entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY && entry.reason === 'TEMPORAL_MEASUREMENT_DATE_INELIGIBLE',
  );
  assert.ok(openWorldEntry, 'the ruled-TEMPORAL item keeps kind TEMPORAL and routes open world, never dropped');
  assert.equal(openWorldEntry.attributes.qualifier_dated_as_of, '2026-04-17');

  // Same ruling mechanism, but on a CLEAN whole-quote TEMPORAL phrase (no
  // co-occurring family): the lexicon marks it eligible, so it still
  // resolves to a measurement date exactly as an unruled clean TEMPORAL
  // would.
  const cleanQuote = TEMPORAL_CALENDAR_QUOTE;
  const cleanRuling = {
    schema_version: 'RULING_CORPUS_ENTRY/V1',
    normalised_phrase: cleanQuote,
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    ruled_kind: 'TEMPORAL',
    ruled_code: null,
    ruler: 'test-fixture',
    ruled_at: '2026-08-01T00:00:00.000Z',
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: QUALIFIER_KIND_LEXICON_VERSION,
  };
  const cleanCorpus = buildRulingCorpus({ version: 1, rulings: [cleanRuling] });

  const cleanResolution = await resolveSingleQualifier(
    { quote: cleanQuote, attachment: chapeauAttachment(), modelKind: 'TEMPORAL' },
    { contract_vocabulary: CONTRACT_BUNDLE_WITH_MEASUREMENT_DATE, ruling_corpus: cleanCorpus },
  );
  const resolvedDate = cleanResolution.resolved.find(
    (entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY && entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE',
  );
  assert.ok(resolvedDate, 'a VERIFIED ruling on a clean whole-quote TEMPORAL still resolves to a measurement date');
  assert.equal(resolvedDate.claim.canonical_value, '2026-04-17');
});
