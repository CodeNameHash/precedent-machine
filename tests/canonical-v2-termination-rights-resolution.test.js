'use strict';

/**
 * tests/canonical-v2-termination-rights-resolution.test.js
 *
 * Acceptance tests 3-6 (docs/superpowers/specs/2026-08-02-family-
 * termination-rights-design.md, section 6, AUDIT-AMENDED). PRE-RERUN
 * HARNESS (spec Deliverable, P1 audit M-5, applied verbatim; same pattern
 * as tests/canonical-v2-mae-definition-resolution.test.js and its own
 * siblings): no recorded native runs exist for this family. This file
 * drives the resolver with SYNTHETIC compiled candidates -- built via the
 * real anthropic-provider.js shaping path (shapeTerminationProposals) over
 * a stub provider response, run through the real runNativeExtraction/
 * resolveCandidates pipeline -- carrying quotes copied verbatim from the
 * spec's own quoted corpus-grounding section and this slice's own
 * committed fixture files (tests/fixtures/canonical-v2/
 * termination-rights-family/). No claim here or in any report may say
 * this family "extracts natively" until the dated post-merge live-run
 * handoffs land.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV17 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeTerminationProposals,
  TERMINATION_RIGHT_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
  MAPPING_TABLE_VERSION,
  TERMINATION_TRIGGER_KIND_TO_CONCEPT,
  terminationTriggerKindCorroborated,
  TERMINATION_EITHER_PARTY_PATTERN,
  terminatingPartyPositionCorroborated,
  EITHER_PRINCIPAL_PARTY_CAPACITY,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { buildTerminationProducerPrompt } = require('../lib/canonical-v2/native-producer/termination-producer-prompt');
const { classifySectionFamily, SECTION_FAMILY_RULE_CLASSIFIED } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { canonicalJson: canonicaliseJson } = require('../lib/canonical-v2/canonical-bytes');

// Mirrors validate-write-set.js's own closed party contract exactly
// (~793-801: `!row.party || typeof row.party !== 'object' ... ||
// canonicalJson(Object.keys(row.party).sort()) !== canonicalJson(['capacity',
// 'role', 'value']) || ['role', 'value', 'capacity'].some((field) =>
// typeof row.party[field] !== 'string' || row.party[field].length === 0)`)
// -- run directly against the resolver's own minted party object rather
// than constructing a full CanonicalWriteSet (which needs a matching
// admitted-source/contract-bundle chain well beyond what this unit test
// needs to prove: that the party shape itself is the exact closed
// contract the write-path validator enforces).
function assertPartyMatchesClosedContract(party) {
  assert.ok(party && typeof party === 'object' && !Array.isArray(party));
  assert.equal(canonicaliseJson(Object.keys(party).sort()), canonicaliseJson(['capacity', 'role', 'value']));
  for (const field of ['role', 'value', 'capacity']) {
    assert.equal(typeof party[field], 'string');
    assert.ok(party[field].length > 0);
  }
}

// ─── identity admitted-source chain (copied verbatim from the sibling
// resolution tests' own helper). ───

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

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-rights-family');
function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const MUTUAL_FIXTURE = readFixture('mutual-consent.txt');
const CURE_FIXTURE = readFixture('cure-period.txt');
const VOTE_FIXTURE = readFixture('vote-failure.txt');

const SECTION_REFERENCE = '8.1';

const CONTRACT_BUNDLE_V17 = compileFixtureContractV17();

// Ad-hoc (non-fixture) test bodies are bare sentences with no section
// heading of their own -- wrap them in a minimal "Section 8.1
// Termination." shell so the deterministic sectionizer can resolve the
// requested SECTION_REFERENCE ('8.1'). The committed fixture files already
// carry their own real heading and are passed to resolveTerminationAssertions
// directly, unwrapped.
function shell(body) {
  return `Section 8.1 Termination.\n\n${body}\n`;
}

function buildSourceAndContext(dealKey, sectionBody) {
  const sourceText = ['ARTICLE VIII\n\nTERMINATION\n\n', sectionBody].join('');
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(sourceText, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
    sourceOrdinal: 0,
  });
  return { sourceText, documentHash, admittedSourceContext };
}

async function resolveTerminationAssertions(dealKey, sectionBody, response) {
  const { sourceText, documentHash, admittedSourceContext } = buildSourceAndContext(dealKey, sectionBody);
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V17,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationProposals(
        {
          termination_right_assertions: response.termination_right_assertions || [],
          open_world_candidates: response.open_world_candidates || [],
        },
        governedScope.source_text,
      );
      return {
        provider_id: 'termination-rights-test/v1',
        model_id: 'stub-model',
        prompt: 'termination-rights-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V17,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution, sourceText, documentHash, admittedSourceContext };
}

function assertion({
  sectionReference = SECTION_REFERENCE, assertionKind, triggerKind, partyScope,
  terminatingParty, deadlineTerm = null, dayKind = null, periodKind = null, quote,
}) {
  return {
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    trigger_kind: triggerKind,
    terminating_party_scope: partyScope,
    terminating_party: terminatingParty,
    deadline_term: deadlineTerm,
    day_kind: dayKind,
    period_kind: periodKind,
    quote,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Registry / bundle / materiality wiring.
// ═══════════════════════════════════════════════════════════════════════

test('TERMINATION is registered in producer-prompt-registry.js to buildTerminationProducerPrompt', () => {
  assert.equal(getProducerPromptModule('TERMINATION'), buildTerminationProducerPrompt);
});

test('the pre-existing TERMINATION stage-1 classifier rule dispatches a "Termination" titled section here (async, no stage-2 provider needed)', async () => {
  const result = await classifySectionFamily({ title: 'ARTICLE VIII\nTermination' });
  assert.equal(result.section_family, 'TERMINATION');
  assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
});

test('a Termination Fee titled section is NOT classified TERMINATION (the shared TERMF_TITLE_PATTERN exclusion)', async () => {
  const result = await classifySectionFamily({ title: 'Section 8.3 Termination Fee' });
  assert.equal(result.section_family, 'TERMINATION_FEE');
});

test('MAPPING_TABLE_VERSION is 21; materiality rank 10 TERMINATION_RIGHTS tier is unchanged and covers every TERMR- concept, including the two new ones', () => {
  assert.equal(MAPPING_TABLE_VERSION, 21);
  const tier = MATERIALITY_TABLE.find((t) => t.label === 'TERMINATION_RIGHTS');
  assert.equal(tier.rank, 10);
  assert.deepEqual([...tier.concept_key_prefixes], ['TERMR-']);
  assert.deepEqual(
    materialityFor({ conceptKey: 'TERMR-MUTUAL', canonicalValue: null, claimDefinitionKey: 'TERMINATION_RIGHT_GRANT' }),
    tier,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: 'TERMR-LEGAL', canonicalValue: null, claimDefinitionKey: 'TERMINATION_RIGHT_GRANT' }),
    tier,
  );
});

test('the trigger_kind -> concept map covers all eight registered triggers', () => {
  assert.deepEqual(Object.keys(TERMINATION_TRIGGER_KIND_TO_CONCEPT).sort(), [
    'BREACH', 'LEGAL_RESTRAINT', 'MUTUAL_CONSENT', 'NO_SOLICITATION_BREACH',
    'OUTSIDE_DATE', 'RECOMMENDATION_CHANGE', 'SUPERIOR_PROPOSAL', 'VOTE_FAILURE',
  ].sort());
});

// ═══════════════════════════════════════════════════════════════════════
// Corroboration unit checks.
// ═══════════════════════════════════════════════════════════════════════

test('trigger_kind corroboration: NO_SOLICITATION_BREACH still refuses generic text carrying neither alternative (audit M-3; widened Step 3A, see tests/canonical-v2-termination-trigger-kind-vocabulary.test.js)', () => {
  assert.equal(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', 'anything at all, even the word breach'), false);
});

test('trigger_kind corroboration: MUTUAL_CONSENT matches both "consent" and "agreement" forms (audit M-2)', () => {
  assert.ok(terminationTriggerKindCorroborated('MUTUAL_CONSENT', 'by mutual written consent of the Company and Parent'));
  assert.ok(terminationTriggerKindCorroborated('MUTUAL_CONSENT', 'by mutual written agreement of Parent and the Company'));
});

test('trigger_kind corroboration: the corpus extension-defect quote fails VOTE_FAILURE (the corpus defect as a permanent regression proof)', () => {
  const extensionQuote = 'the End Date will be automatically extended to April 30, 2026 if, on the initial End Date, '
    + 'all conditions to Closing shall have been satisfied or waived';
  assert.equal(terminationTriggerKindCorroborated('VOTE_FAILURE', extensionQuote), false);
});

test('trigger_kind corroboration: VOTE_FAILURE requires BOTH the Approval-term pattern AND the failure phrase', () => {
  assert.ok(terminationTriggerKindCorroborated('VOTE_FAILURE', 'the Company Stockholder Approval shall not have been obtained'));
  assert.equal(terminationTriggerKindCorroborated('VOTE_FAILURE', 'the Company Stockholder Approval was duly obtained'), false);
});

test('party-scope: the either-pattern fires on "by either Parent or the Company"', () => {
  assert.ok(TERMINATION_EITHER_PARTY_PATTERN.test('by either Parent or the Company if the Merger has not been consummated'));
});

test('positional gate: "by Parent" and "Columbus may terminate" both corroborate; the breaching party alone does not', () => {
  assert.ok(terminatingPartyPositionCorroborated('(f) by Parent, if there shall have been a breach on the part of the Company', 'Parent'));
  assert.ok(terminatingPartyPositionCorroborated('Columbus may terminate this Agreement at any time', 'Columbus'));
  assert.equal(
    terminatingPartyPositionCorroborated('(f) by Parent, if there shall have been a breach on the part of the Company', 'the Company'),
    false,
  );
});

// ═══════════════════════════════════════════════════════════════════════
// End-to-end resolution (synthetic candidates, real fixture bytes).
// ═══════════════════════════════════════════════════════════════════════

test('a mutual RIGHT_GRANT resolves TERMR-MUTUAL, mints two principal-party rows (TARGET and BUYER), and passes validate-write-set.js\'s closed party contract', async () => {
  const quote = 'by mutual written consent of the Company and Parent by action of their respective boards of directors.';
  assert.ok(MUTUAL_FIXTURE.includes(quote));
  const { resolution } = await resolveTerminationAssertions('deal:termr-mutual', MUTUAL_FIXTURE, {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'MUTUAL_CONSENT', partyScope: 'EITHER_PARTY',
        terminatingParty: 'the Company and Parent', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 2);
  const capacities = resolved.map((e) => e.party.capacity).sort();
  assert.deepEqual(capacities, ['BUYER', 'TARGET']);
  for (const entry of resolved) {
    assert.equal(entry.concept_key, 'TERMR-MUTUAL');
    assert.equal(entry.claim.canonical_value, true);
    assert.equal(entry.party.role, 'TERMINATION_RIGHT_HOLDER');
    assert.ok(entry.party.value);
    assert.notEqual(entry.party.capacity, EITHER_PRINCIPAL_PARTY_CAPACITY);
    assertPartyMatchesClosedContract(entry.party);
    assertPartyMatchesClosedContract(entry.provision_instance.party);
  }
  assert.equal(resolved[0].triage.materiality_rank, 10);
});

test('a target-breach quote resolves with BUYER as terminator (the v1-suffix inversion guard, verified by construction)', async () => {
  const quote = '(f) by Parent, if there shall have been a breach of any representation, warranty, covenant or '
    + 'agreement on the part of the Company set forth in this Agreement, which is not cured within 30 days after '
    + 'written notice thereof.';
  const { resolution } = await resolveTerminationAssertions('deal:termr-breach-inversion-guard', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].concept_key, 'TERMR-BREACH');
  assert.equal(resolved[0].party.capacity, 'BUYER');
  assert.equal(resolved[0].party.value, 'Parent');
});

test('inverted-label regression (audit C-2): the SAME breach quote with terminating_party set to the BREACHING party (present verbatim, resolvable, but not in the by-<ref>/<ref>-may-terminate position) queues TERMINATING_PARTY_REF_UNCORROBORATED, never resolves an inverted right', async () => {
  const quote = '(f) by Parent, if there shall have been a breach of any representation, warranty, covenant or '
    + 'agreement on the part of the Company set forth in this Agreement, which is not cured within 30 days after '
    + 'written notice thereof.';
  const { resolution } = await resolveTerminationAssertions('deal:termr-breach-inverted-label', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'the Company', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('TERMINATING_PARTY_REF_UNCORROBORATED'));
  assert.ok(queued, 'the inverted label must queue, typed, never resolve');
});

test('an OUTSIDE_DATE assertion resolves TERMR-OUTSIDE with the parsed ISO date and the required deadline_term_ref', async () => {
  const quote = 'by either Parent or the Company if the Merger has not been consummated on or before November 22, '
    + '2021 (the "Outside Date")';
  const { resolution } = await resolveTerminationAssertions('deal:termr-outside', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'OUTSIDE_DATE', triggerKind: 'OUTSIDE_DATE', partyScope: 'EITHER_PARTY',
        terminatingParty: 'either Parent or the Company', deadlineTerm: 'Outside Date', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].concept_key, 'TERMR-OUTSIDE');
  assert.equal(resolved[1].concept_key, 'TERMR-OUTSIDE');
  assert.equal(resolved[0].claim.canonical_value, '2021-11-22');
  assert.equal(resolved[0].claim.attributes.deadline_term_ref, 'Outside Date');
  assert.deepEqual(resolved.map((e) => e.party.capacity).sort(), ['BUYER', 'TARGET']);
});

test('an OUTSIDE_DATE assertion missing deadline_term queues DEADLINE_TERM_REF_NOT_IN_QUOTE', async () => {
  const quote = 'by either Parent or the Company if the Merger has not been consummated on or before November 22, 2021';
  const { resolution } = await resolveTerminationAssertions('deal:termr-outside-no-term', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'OUTSIDE_DATE', triggerKind: 'OUTSIDE_DATE', partyScope: 'EITHER_PARTY',
        terminatingParty: 'either Parent or the Company', deadlineTerm: null, quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('DEADLINE_TERM_REF_NOT_IN_QUOTE'));
  assert.ok(queued);
});

test('the corpus extension-defect quote, labelled VOTE_FAILURE, queues TRIGGER_KIND_UNCORROBORATED (permanent regression test)', async () => {
  const extensionText = 'the End Date will be automatically extended to April 30, 2026 if, on the initial End Date, all '
    + 'conditions to Closing shall have been satisfied or waived other than the Regulatory Approval Condition.';
  assert.ok(VOTE_FIXTURE.includes(extensionText));
  // The defect quote itself carries no party-of-termination framing at all
  // (it is extension machinery, not a termination right -- exactly the
  // corpus defect this fixture pins). A "by either Parent or the Company"
  // framing is prepended here purely so terminating_party's own required
  // verbatim-substring gate does not mask the trigger-corroboration
  // failure this test targets -- the isolate-one-gate-at-a-time discipline
  // every other test in this file also follows.
  const quote = `by either Parent or the Company: ${extensionText}`;
  const { resolution } = await resolveTerminationAssertions('deal:termr-vote-defect', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'VOTE_FAILURE', partyScope: 'EITHER_PARTY',
        terminatingParty: 'either Parent or the Company', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('TRIGGER_KIND_UNCORROBORATED'));
  assert.ok(queued, 'the mislabeled top-tier provision must queue, exactly where it belongs');
});

test('a genuine vote-failure quote resolves TERMR-NOVOTE', async () => {
  const quote = 'by either Parent or the Company if the Company Shareholder Approval shall not have been obtained '
    + 'by reason of the failure to obtain the required vote at a duly held Company Shareholders Meeting';
  const { resolution } = await resolveTerminationAssertions('deal:termr-novote', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'VOTE_FAILURE', partyScope: 'EITHER_PARTY',
        terminatingParty: 'either Parent or the Company', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].concept_key, 'TERMR-NOVOTE');
  assert.equal(resolved[1].concept_key, 'TERMR-NOVOTE');
  assert.deepEqual(resolved.map((e) => e.party.capacity).sort(), ['BUYER', 'TARGET']);
});

test('"by either Parent or the Company" labelled ONE_PARTY queues PARTY_SCOPE_UNCORROBORATED (the either-check runs first)', async () => {
  const quote = 'by either Parent or the Company if the Merger has not been consummated on or before November 22, 2021';
  const { resolution } = await resolveTerminationAssertions('deal:termr-scope-mislabel', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'OUTSIDE_DATE', triggerKind: 'OUTSIDE_DATE', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', deadlineTerm: null, quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('PARTY_SCOPE_UNCORROBORATED'));
  assert.ok(queued);
});

test('NO_SOLICITATION_BREACH trigger_kind queues unconditionally (audit M-3, zero grounded corpus text)', async () => {
  const quote = 'by Parent if the Company has breached its no-solicitation obligations under Section 6.02';
  const { resolution } = await resolveTerminationAssertions('deal:termr-nosol-breach', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'NO_SOLICITATION_BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('TRIGGER_KIND_UNCORROBORATED'));
  assert.ok(queued);
});

test('day_kind cross-label (CALENDAR asserted on a Business Day count) queues DAY_KIND_UNCORROBORATED', async () => {
  const quote = 'by Parent, if there shall have been a breach of any covenant on the part of the Company which is '
    + 'not cured within 5 Business Days following written notice';
  const { resolution } = await resolveTerminationAssertions('deal:termr-day-kind-mismatch', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'CURE', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('DAY_KIND_UNCORROBORATED'));
  assert.ok(queued);
});

test('a genuine CURE_PERIOD (day_kind CALENDAR, period_kind CURE) resolves TERMR-BREACH\'s cure claim', async () => {
  const quote = '(f) by Parent, if there shall have been a breach of any representation, warranty, covenant or '
    + 'agreement on the part of the Company set forth in this Agreement, which is not cured within the earlier of '
    + '(1) the Outside Date and (2) 30 days following written notice to Parent';
  assert.ok(CURE_FIXTURE.includes(quote));
  const { resolution } = await resolveTerminationAssertions('deal:termr-cure-resolved', CURE_FIXTURE, {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'CURE', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].concept_key, 'TERMR-BREACH');
  assert.equal(resolved[0].claim.canonical_value, '30');
});

test('period_kind cross-label (audit M-1): a CURE label on the 45-day notice-delivery quote queues PERIOD_KIND_UNCORROBORATED', async () => {
  const quote = '(h) by Parent, if the Company shall have breached any of its representations, warranties, covenants '
    + 'or other agreements contained in this Agreement, and Parent has delivered to the Company written notice of '
    + 'such breach, delivered at least 45 days prior to such termination (or such shorter period of time remaining '
    + 'prior to the Outside Date).';
  assert.ok(CURE_FIXTURE.includes(quote));
  const { resolution } = await resolveTerminationAssertions('deal:termr-period-kind-mismatch', CURE_FIXTURE, {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'CURE', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('PERIOD_KIND_UNCORROBORATED'));
  assert.ok(queued, 'a CURE label on a notice-delivery quote must never resolve');
});

test('the same 45-day quote, correctly labelled NOTICE, resolves', async () => {
  const quote = '(h) by Parent, if the Company shall have breached any of its representations, warranties, covenants '
    + 'or other agreements contained in this Agreement, and Parent has delivered to the Company written notice of '
    + 'such breach, delivered at least 45 days prior to such termination (or such shorter period of time remaining '
    + 'prior to the Outside Date).';
  const { resolution } = await resolveTerminationAssertions('deal:termr-notice-resolved', CURE_FIXTURE, {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'NOTICE', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '45');
  assert.equal(resolved[0].claim.attributes.period_kind, 'NOTICE');
});

test('a CURE claim and a NOTICE claim in the same section never collide or dedupe (period_kind in identity, audit M-1)', async () => {
  const cureQuote = 'by Parent, if there shall have been a breach of any covenant on the part of the Company, which '
    + 'is not cured within 30 days following written notice to Parent';
  const noticeQuote = 'by Parent, if there shall have been a breach of any covenant on the part of the Company, and '
    + 'Parent has delivered written notice of such breach delivered at least 45 days prior to such termination';
  const combined = `${cureQuote}. ${noticeQuote}.`;
  const { resolution } = await resolveTerminationAssertions('deal:termr-cure-notice-identity', shell(combined), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'CURE', quote: `${cureQuote}.`,
      }),
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'BREACH', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', dayKind: 'CALENDAR', periodKind: 'NOTICE', quote: `${noticeQuote}.`,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved.length, 2);
  const revisionIds = resolved.map((e) => e.claim.claim_revision_id);
  assert.notEqual(revisionIds[0], revisionIds[1]);
});

test('assertion/trigger incoherence: a CURE_PERIOD hanging off a MUTUAL_CONSENT right queues ASSERTION_TRIGGER_INCOHERENT', async () => {
  // terminating_party_ref must split into TARGET+BUYER so the 2X-I mutual
  // mint path reaches the assertion/trigger coherence gate (a one-sided
  // ref would queue MUTUAL_PARTY_UNRESOLVED first).
  const quote = 'by mutual written consent of the Company and Parent, not cured within 30 days following written notice';
  const { resolution } = await resolveTerminationAssertions('deal:termr-incoherent', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'CURE_PERIOD', triggerKind: 'MUTUAL_CONSENT', partyScope: 'EITHER_PARTY',
        terminatingParty: 'the Company and Parent', dayKind: 'CALENDAR', periodKind: 'CURE', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const queued = resolution.review_queue.find((e) => e.reasons.includes('ASSERTION_TRIGGER_INCOHERENT'));
  assert.ok(queued);
});

test('out-of-enum trigger_kind exercises explicit pushOpenWorld, typed TRIGGER_KIND_OUT_OF_ENUM', async () => {
  const quote = 'by Parent if the Company has committed some novel breach not covered by the enum';
  const { resolution } = await resolveTerminationAssertions('deal:termr-out-of-enum', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'SOME_NOVEL_TRIGGER', partyScope: 'ONE_PARTY',
        terminatingParty: 'Parent', quote,
      }),
    ],
  });
  assert.equal(resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY).length, 0);
  const openWorldEntry = resolution.open_world.find((e) => e.reason === 'TRIGGER_KIND_OUT_OF_ENUM');
  assert.ok(openWorldEntry);
});

test('materiality rank 10 on every resolved claim and every review item', async () => {
  const quote = 'by mutual written consent of the Company and Parent by action of their respective boards of directors.';
  const { resolution } = await resolveTerminationAssertions('deal:termr-materiality-resolved', MUTUAL_FIXTURE, {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'MUTUAL_CONSENT', partyScope: 'EITHER_PARTY',
        terminatingParty: 'the Company and Parent', quote,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((e) => e.generic_claim_key === TERMINATION_RIGHT_CLAIM_KEY);
  assert.equal(resolved[0].triage.materiality_rank, 10);
  assert.equal(resolved.length, 2);

  const { resolution: resolutionQueued } = await resolveTerminationAssertions('deal:termr-materiality-queued', shell(quote), {
    termination_right_assertions: [
      assertion({
        assertionKind: 'RIGHT_GRANT', triggerKind: 'VOTE_FAILURE', partyScope: 'EITHER_PARTY',
        terminatingParty: 'the Company and Parent', quote,
      }),
    ],
  });
  const queued = resolutionQueued.review_queue.find((e) => e.reasons.includes('TRIGGER_KIND_UNCORROBORATED'));
  assert.equal(queued.materiality_rank, 10);
});

test('additivity re-pin: the resolution receipt threads mapping_table_version 17 and the two new parser versions', async () => {
  const { resolution } = await resolveTerminationAssertions('deal:termr-additivity', shell('no termination assertions here'), {
    termination_right_assertions: [],
  });
  assert.equal(resolution.resolution_receipt.mapping_table_version, 21);
  assert.equal(resolution.resolution_receipt.termination_deadline_parse_version, 1);
  assert.equal(resolution.resolution_receipt.cure_period_parse_version, 2);
});
