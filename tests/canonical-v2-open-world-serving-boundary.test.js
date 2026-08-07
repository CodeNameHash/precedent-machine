'use strict';

// DECISIONS.md decision 2, second and third constraints: "The projection and
// serving layers must honour it" and "A test proves the two cannot be
// confused... at the serving boundary."
//
// This test reads the ACTUAL row shapes native-write-set-adapter.js writes
// (open_world_candidates / open_world_candidate_occurrences /
// open_world_evidence_references) -- not the in-memory `resolution.open_world`
// JSON -- and proves open-world-evidence-serving.js:
//   1. honours the on-row marker with no other context (constraint 1, at the
//      serving side);
//   2. builds a card that says, on its own face, that it is ungoverned
//      evidence, structurally distinct from a governed claim's card; and
//   3. refuses -- rather than silently renders -- a row of the wrong kind,
//      in both directions.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildSemanticSpan, buildProvisionInstance } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  buildNativeWriteSet,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const {
  UngovernedEvidenceProjectionError,
  buildOpenWorldEvidenceCard,
  buildGovernedClaimSummaryCard,
} = require('../lib/canonical-v2/open-world-evidence-serving');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

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
  '\n\nARTICLE V\n\nCONDITIONS TO THE MERGER\n\n',
  QXO_5_2_TEXT,
  '\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const DEAL_KEY = 'deal:qxo-open-world-serving-boundary';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-open-world-serving-boundary');

const ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: DEAL_KEY,
  dealAdmissionId: DEAL_ADMISSION_ID,
  sourceOrdinal: 0,
});

const REP_PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
const ACCURACY_KEY = 'REPRESENTATION_ACCURACY_STANDARD';
const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_III_QUOTE = '(iii)Except for any obligations pursuant to this Agreement,';

function locateInGovernedScope(governedScope, quote) {
  const bytes = Buffer.from(governedScope.source_text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = bytes.indexOf(needle);
  if (start < 0) throw new Error(`test fixture quote not found in governed scope: ${quote}`);
  return { start, end: start + needle.length };
}

function mixedProvider() {
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

    return {
      provider_id: 'open-world-serving-boundary-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'open-world-serving-boundary-test-stub-prompt/v1',
      proposals: [
        {
          kind: 'claim',
          proposal_kind: 'GOVERNED',
          subject_occurrence_id: subject,
          claim_definition_key: ACCURACY_KEY,
          claim_definition_version: 1,
          ordinal: 0,
          state: 'PRESENT',
          raw_value: LIMB_I_QUOTE,
          canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
          attributes: {
            answer_provenance: {
              tag: 'MECHANICAL',
              pins: { mapping_table_version: 3, qualifier_kind_lexicon_version: 1 },
            },
          },
          allowed_attributes: ['answer_provenance'],
          taxonomy_codes: {},
          codebooks: {},
          evidence: [{
            evidence_role: 'OPERATIVE_TEXT',
            excerpt_id: contentId('SERVING_BOUNDARY_TEST_GOVERNED_EXCERPT/V1', { start: limbI.start, end: limbI.end }),
            document_ordinal: 0,
            absolute_start: limbI.start,
            absolute_end: limbI.end,
            ordinal: 0,
          }],
          extraction_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
          normalisation_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
          derivation_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
        },
        {
          kind: 'claim',
          proposal_kind: 'OPEN_WORLD',
          subject_occurrence_id: contentId('SERVING_BOUNDARY_TEST_SUBJECT/V1', { section: governedScope.section_reference }),
          claim_definition_key: 'OPEN_WORLD_SERVING_BOUNDARY_TEST_CANDIDATE',
          claim_definition_version: 1,
          ordinal: 0,
          state: 'PRESENT',
          raw_value: LIMB_III_QUOTE,
          canonical_value: null,
          attributes: {},
          allowed_attributes: [],
          taxonomy_codes: {},
          codebooks: {},
          evidence: [{
            evidence_role: 'OPERATIVE_TEXT',
            excerpt_id: contentId('SERVING_BOUNDARY_TEST_OPEN_WORLD_EXCERPT/V1', { start: limbIII.start, end: limbIII.end }),
            document_ordinal: 0,
            absolute_start: limbIII.start,
            absolute_end: limbIII.end,
            ordinal: 0,
          }],
          extraction_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
          normalisation_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
          derivation_version: 'OPEN_WORLD_SERVING_BOUNDARY_TEST/V1',
        },
      ],
      evidence_residuals: [],
    };
  };
}

function toOpenWorldEntry(compiledEntry, reason) {
  const claim = compiledEntry.candidate.claim;
  return {
    section_reference: compiledEntry.section_reference,
    reason,
    claim_definition_key: claim.claim_definition_key,
    raw_value: claim.raw_value,
    canonical_value: claim.canonical_value,
    attributes: claim.attributes,
    evidence: claim.evidence,
    closure_id: claim.closure_id,
  };
}

// Builds the exact DB row shapes native-write-set-adapter.js writes -- this
// is the "read half" of the round trip this test proves: what a server would
// hold after querying `open_world_candidates` / `open_world_candidate_
// occurrences` / `open_world_evidence_references` / `claims` back out.
async function buildDbRowFixture() {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: mixedProvider(),
  });
  const governedCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === ACCURACY_KEY,
  );
  const openWorldCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === 'OPEN_WORLD_SERVING_BOUNDARY_TEST_CANDIDATE',
  );
  const provisionSpan = buildSemanticSpan(
    ADMITTED_SOURCE_CONTEXT,
    receipt.resolved_sections[0].start,
    receipt.resolved_sections[0].end,
  );
  const provision = Object.freeze({
    ...buildProvisionInstance({
      source: ADMITTED_SOURCE_CONTEXT,
      span: provisionSpan,
      conceptKey: 'REP-T-CAP',
      party: REP_PARTY,
      ordinal: 1,
      contractBundle: CONTRACT_BUNDLE,
    }),
    closure_id: contentId('OPEN_WORLD_SERVING_BOUNDARY_TEST_PROVISION_CLOSURE/V1', {
      seed: 'open-world-serving-boundary',
    }),
  });

  const adapterResult = buildNativeWriteSet({
    run_receipt: { ...receipt, compiled_candidates: [governedCompiled] },
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: {
      provisions: [provision],
      limb_component_trees: [],
      open_world: [toOpenWorldEntry(openWorldCompiled, 'OPEN_WORLD_SERVING_BOUNDARY_TEST_REASON')],
    },
  });

  return {
    governedClaimRow: adapterResult.write_set.claims[0],
    openWorldCandidateRow: adapterResult.write_set.open_world_candidates[0],
    openWorldOccurrenceRow: adapterResult.write_set.open_world_candidate_occurrences[0],
    openWorldEvidenceRows: adapterResult.write_set.open_world_evidence_references,
  };
}

// ─── The marker alone tells the server what it is holding. ───

test('serving boundary: the marker is readable with no table/collection context', async () => {
  const fixture = await buildDbRowFixture();

  assert.equal(fixture.openWorldCandidateRow.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  assert.equal(fixture.openWorldOccurrenceRow.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  for (const evidence of fixture.openWorldEvidenceRows) {
    assert.equal(evidence.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  }
  // The governed claim row has no such field -- a caller checking only
  // `row.evidence_governance` needs no other information to tell the two
  // apart, which is exactly decision 2's first constraint restated at the
  // point where a server, not a producer, is holding the row.
  assert.equal(Object.prototype.hasOwnProperty.call(fixture.governedClaimRow, 'evidence_governance'), false);
});

// ─── The card is visibly, structurally different. ───

test('serving boundary: a card built from open-world DB rows announces itself as ungoverned, on the card', async () => {
  const fixture = await buildDbRowFixture();

  const openWorldCard = buildOpenWorldEvidenceCard({
    candidate: fixture.openWorldCandidateRow,
    occurrence: fixture.openWorldOccurrenceRow,
    evidenceReferences: fixture.openWorldEvidenceRows,
  });
  const governedCard = buildGovernedClaimSummaryCard(fixture.governedClaimRow);

  assert.equal(openWorldCard.is_governed_claim, false);
  assert.equal(openWorldCard.governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  assert.match(openWorldCard.display_label, /ungoverned/i);
  assert.equal(openWorldCard.quote, LIMB_III_QUOTE);

  assert.equal(governedCard.is_governed_claim, true);
  assert.equal(Object.prototype.hasOwnProperty.call(governedCard, 'governance'), false);
  assert.equal(governedCard.display_label, 'Governed claim');

  // Different schema_version too, so even a caller that dumps both cards
  // into one array and forgets to check `is_governed_claim` still cannot
  // mistake one shape for the other downstream.
  assert.notEqual(openWorldCard.schema_version, governedCard.schema_version);
});

// ─── Neither constructor can be fooled by the wrong row. ───

test('serving boundary: each card constructor refuses the other kind of row', async () => {
  const fixture = await buildDbRowFixture();

  assert.throws(() => buildOpenWorldEvidenceCard({
    candidate: fixture.governedClaimRow,
    occurrence: fixture.openWorldOccurrenceRow,
    evidenceReferences: fixture.openWorldEvidenceRows,
  }), UngovernedEvidenceProjectionError);

  assert.throws(() => buildGovernedClaimSummaryCard(fixture.openWorldCandidateRow), UngovernedEvidenceProjectionError);

  // A claim row hand-tampered to carry the marker (the same tamper the write-
  // boundary test proves is quarantined before it ever reaches a database)
  // must also be refused HERE, independently -- defence in depth, not a
  // single point of failure between write and serve.
  const tamperedClaim = { ...fixture.governedClaimRow, evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER };
  assert.throws(() => buildGovernedClaimSummaryCard(tamperedClaim), UngovernedEvidenceProjectionError);
});
