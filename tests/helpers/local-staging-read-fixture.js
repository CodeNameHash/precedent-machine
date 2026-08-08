'use strict';

// Shared by scripts/canonical-v2-local-staging-read-proof.js (live, against
// a real local container) and tests/canonical-v2-local-staging-deal-reader.test.js
// (hermetic, against a fake pg client) so both exercise the SAME real
// write-boundary code (buildNativeWriteSet) producing the SAME shape of
// governed-claim + open-world-entry pair, drawn from one provider call --
// the exact pattern tests/canonical-v2-open-world-write-boundary.test.js
// proves at the write boundary. Kept here rather than duplicated so the two
// callers cannot silently drift into testing different fixtures.

const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const { buildSemanticSpan, buildProvisionInstance } = require('../../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../../lib/canonical-v2/native-producer/native-extraction-run');
const { buildNativeWriteSet } = require('../../lib/canonical-v2/native-producer/native-write-set-adapter');
const { buildIdentityAdmittedSourceContext } = require('./identity-admitted-source');
const { QXO_5_2_TEXT } = require('../fixtures/qxo-section-5-2');

const REPO_ROOT = path.join(__dirname, '..', '..');

async function buildSyntheticMixedFixture() {
  const capitalStructureText = fs.readFileSync(
    path.join(REPO_ROOT, 'tests', 'fixtures', 'qxo-section-3-1-b.txt'),
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
  const documentHash = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
  const contractBundle = compileFixtureContract();
  // Fixed, not timestamped: repeated runs (the live proof script) must be
  // idempotent -- ON CONFLICT DO NOTHING only dedupes if the minted ids are
  // stable across runs.
  const dealKey = 'deal:local-read-half-proof-fixture';
  const dealAdmissionId = sha256Hex(`deal-admission:${dealKey}`);
  const admittedSourceContext = buildIdentityAdmittedSourceContext(qxoFullText, {
    dealKey, dealAdmissionId, sourceOrdinal: 0,
  });
  const repParty = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
  const accuracyKey = 'REPRESENTATION_ACCURACY_STANDARD';
  const limbIQuote = '(i)The authorized capital stock of the Company consists of';
  const limbIIIQuote = '(iii)Except for any obligations pursuant to this Agreement,';

  function locate(governedScope, quote) {
    const bytes = Buffer.from(governedScope.source_text, 'utf8');
    const start = bytes.indexOf(Buffer.from(quote, 'utf8'));
    if (start < 0) throw new Error(`fixture quote not found: ${quote}`);
    return { start, end: start + Buffer.byteLength(quote, 'utf8') };
  }

  function withClosureId(provision) {
    return Object.freeze({
      ...provision,
      closure_id: contentId('LOCAL_READ_HALF_PROOF_PROVISION_CLOSURE/V1', {
        provision_instance_id: provision.provision_instance_id,
      }),
    });
  }

  function mixedProvider() {
    return async ({ governed_scope: governedScope }) => {
      const provisionSpan = buildSemanticSpan(admittedSourceContext, governedScope.start, governedScope.end);
      const provision = buildProvisionInstance({
        source: admittedSourceContext,
        span: provisionSpan,
        conceptKey: 'REP-T-CAP',
        party: repParty,
        ordinal: 1,
        contractBundle,
      });
      const subject = provision.provision_instance_id;
      const limbI = locate(governedScope, limbIQuote);
      const limbIII = locate(governedScope, limbIIIQuote);
      const governedProposal = {
        kind: 'claim',
        proposal_kind: 'GOVERNED',
        subject_occurrence_id: subject,
        claim_definition_key: accuracyKey,
        claim_definition_version: 1,
        ordinal: 0,
        state: 'PRESENT',
        raw_value: limbIQuote,
        canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
        attributes: {
          answer_provenance: { tag: 'MECHANICAL', pins: { mapping_table_version: 3, qualifier_kind_lexicon_version: 1 } },
        },
        allowed_attributes: ['answer_provenance'],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [{
          evidence_role: 'OPERATIVE_TEXT',
          excerpt_id: contentId('LOCAL_READ_HALF_PROOF_GOVERNED_EXCERPT/V1', {
            quote: limbIQuote, start: limbI.start, end: limbI.end,
          }),
          document_ordinal: 0,
          absolute_start: limbI.start,
          absolute_end: limbI.end,
          ordinal: 0,
        }],
        extraction_version: 'LOCAL_READ_HALF_PROOF/V1',
        normalisation_version: 'LOCAL_READ_HALF_PROOF/V1',
        derivation_version: 'LOCAL_READ_HALF_PROOF/V1',
      };
      const openWorldSubject = contentId('LOCAL_READ_HALF_PROOF_SUBJECT/V1', { section: governedScope.section_reference });
      const openWorldProposal = {
        kind: 'claim',
        proposal_kind: 'OPEN_WORLD',
        subject_occurrence_id: openWorldSubject,
        claim_definition_key: 'LOCAL_READ_HALF_PROOF_CANDIDATE',
        claim_definition_version: 1,
        ordinal: 0,
        state: 'PRESENT',
        raw_value: limbIIIQuote,
        canonical_value: null,
        attributes: {},
        allowed_attributes: [],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [{
          evidence_role: 'OPERATIVE_TEXT',
          excerpt_id: contentId('LOCAL_READ_HALF_PROOF_OPEN_WORLD_EXCERPT/V1', {
            quote: limbIIIQuote, start: limbIII.start, end: limbIII.end,
          }),
          document_ordinal: 0,
          absolute_start: limbIII.start,
          absolute_end: limbIII.end,
          ordinal: 0,
        }],
        extraction_version: 'LOCAL_READ_HALF_PROOF/V1',
        normalisation_version: 'LOCAL_READ_HALF_PROOF/V1',
        derivation_version: 'LOCAL_READ_HALF_PROOF/V1',
      };
      return {
        provider_id: 'local-read-half-proof-stub/v1',
        model_id: 'stub-model',
        prompt: 'local-read-half-proof-stub-prompt/v1',
        proposals: [governedProposal, openWorldProposal],
        evidence_residuals: [],
      };
    };
  }

  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: documentHash,
    section_references: ['3.1(b)'],
    contract_bundle: contractBundle,
    definitions: { known_definitions: [] },
    provider: mixedProvider(),
  });
  const governedCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === accuracyKey,
  );
  const openWorldCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === 'LOCAL_READ_HALF_PROOF_CANDIDATE',
  );
  if (!governedCompiled || !openWorldCompiled) throw new Error('fixture candidates did not compile');

  const provisionSpan = buildSemanticSpan(
    admittedSourceContext,
    receipt.resolved_sections[0].start,
    receipt.resolved_sections[0].end,
  );
  const provision = withClosureId(buildProvisionInstance({
    source: admittedSourceContext,
    span: provisionSpan,
    conceptKey: 'REP-T-CAP',
    party: repParty,
    ordinal: 1,
    contractBundle,
  }));

  const openWorldEntry = {
    section_reference: openWorldCompiled.section_reference,
    reason: 'LOCAL_READ_HALF_PROOF_REASON',
    claim_definition_key: openWorldCompiled.candidate.claim.claim_definition_key,
    raw_value: openWorldCompiled.candidate.claim.raw_value,
    canonical_value: openWorldCompiled.candidate.claim.canonical_value,
    attributes: openWorldCompiled.candidate.claim.attributes,
    evidence: openWorldCompiled.candidate.claim.evidence,
    closure_id: openWorldCompiled.candidate.claim.closure_id,
  };

  const adapterResult = buildNativeWriteSet({
    run_receipt: { ...receipt, compiled_candidates: [governedCompiled] },
    source_text: qxoFullText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution: { provisions: [provision], limb_component_trees: [], open_world: [openWorldEntry] },
  });

  return { writeSet: adapterResult.write_set, documentHash };
}

module.exports = { buildSyntheticMixedFixture };
