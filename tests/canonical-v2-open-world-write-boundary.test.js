'use strict';

// DECISIONS.md decision 2 ("Whether open-world evidence is written at all" --
// RULED 2026-08-07: "emit them, with a flag"), PLAN.md Step 2B.
//
// Proves, at the WRITE boundary (native-write-set-adapter.js ->
// validate-write-set.js), that a governed claim and an open-world entry
// produced from the SAME run receipt and the SAME `buildNativeWriteSet` call
// (1) both land in the accepted, publishable write set, and (2) cannot be
// confused: the open-world rows carry the on-row
// `evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER`, the claim row
// structurally cannot, and a claim row that is TAMPERED to carry the marker
// is caught and quarantined by the real validator, not silently accepted.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildSemanticSpan, buildProvisionInstance } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  buildNativeWriteSet,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
  OPEN_WORLD_CANDIDATE_SCHEMA,
} = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
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
const DEAL_KEY = 'deal:qxo-open-world-write-boundary';
const DEAL_ADMISSION_ID = sha256Hex('deal-admission:qxo-open-world-write-boundary');

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

// `buildProvisionInstance` (source-structure.js) does not mint `closure_id`
// itself -- candidate-resolution.js's real resolver adds one when it builds
// `resolution.provisions`. This test hand-builds the provision (it does not
// exercise the resolver), so it mints one the same content-addressed way.
function withClosureId(provision) {
  return Object.freeze({
    ...provision,
    closure_id: contentId('OPEN_WORLD_BOUNDARY_TEST_PROVISION_CLOSURE/V1', {
      provision_instance_id: provision.provision_instance_id,
    }),
  });
}

// A governed claim, real and registered, mirroring the pattern already
// proven correct in tests/canonical-v2-native-write-set-adapter.test.js's
// `resolvableProvider` -- plus ONE proposal with `proposal_kind: 'OPEN_WORLD'`,
// which candidate-resolution.js's own dispatch loop
// (`provenance.proposal_kind === 'OPEN_WORLD'`) routes straight to
// `pushOpenWorld` regardless of claim_definition_key. Both come out of the
// SAME provider call, over the SAME section, so this is a genuine same-run
// comparison, not two runs compared after the fact.
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

    const governedProposal = {
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
        excerpt_id: contentId('OPEN_WORLD_BOUNDARY_TEST_GOVERNED_EXCERPT/V1', {
          quote: LIMB_I_QUOTE, start: limbI.start, end: limbI.end,
        }),
        document_ordinal: 0,
        absolute_start: limbI.start,
        absolute_end: limbI.end,
        ordinal: 0,
      }],
      extraction_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
      normalisation_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
      derivation_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
    };

    // A synthetic subject -- deliberately NOT a real provision -- exactly
    // like `pushOpenWorld`'s real callers: candidate-resolution.js never
    // gives an open-world candidate a resolved semantic subject either.
    const openWorldSubject = contentId('OPEN_WORLD_BOUNDARY_TEST_SUBJECT/V1', { section: governedScope.section_reference });
    const openWorldProposal = {
      kind: 'claim',
      proposal_kind: 'OPEN_WORLD',
      subject_occurrence_id: openWorldSubject,
      claim_definition_key: 'OPEN_WORLD_BOUNDARY_TEST_CANDIDATE',
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
        excerpt_id: contentId('OPEN_WORLD_BOUNDARY_TEST_OPEN_WORLD_EXCERPT/V1', {
          quote: LIMB_III_QUOTE, start: limbIII.start, end: limbIII.end,
        }),
        document_ordinal: 0,
        absolute_start: limbIII.start,
        absolute_end: limbIII.end,
        ordinal: 0,
      }],
      extraction_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
      normalisation_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
      derivation_version: 'OPEN_WORLD_WRITE_BOUNDARY_TEST/V1',
    };

    return {
      provider_id: 'open-world-write-boundary-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'open-world-write-boundary-test-stub-prompt/v1',
      proposals: [governedProposal, openWorldProposal],
      evidence_residuals: [],
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
    provider: mixedProvider(),
  });
}

// Turns a compiled OPEN_WORLD candidate into the exact shape
// candidate-resolution.js's own `pushOpenWorld` produces (see that function):
// the fields `buildOpenWorldWriteRows` actually reads, copied straight off
// the compiled candidate the same way the real resolver does -- not derived
// independently, so this fixture cannot silently diverge from what
// production emits.
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

async function buildMixedWriteSet() {
  const receipt = await buildReceipt();
  assert.equal(receipt.compiled_candidates.length, 2);
  const governedCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === ACCURACY_KEY,
  );
  const openWorldCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === 'OPEN_WORLD_BOUNDARY_TEST_CANDIDATE',
  );
  assert.ok(governedCompiled, 'the governed candidate must compile');
  assert.ok(openWorldCompiled, 'the open-world candidate must compile');

  const provisionSpan = buildSemanticSpan(
    ADMITTED_SOURCE_CONTEXT,
    receipt.resolved_sections[0].start,
    receipt.resolved_sections[0].end,
  );
  const provision = withClosureId(buildProvisionInstance({
    source: ADMITTED_SOURCE_CONTEXT,
    span: provisionSpan,
    conceptKey: 'REP-T-CAP',
    party: REP_PARTY,
    ordinal: 1,
    contractBundle: CONTRACT_BUNDLE,
  }));
  assert.equal(provision.provision_instance_id, governedCompiled.candidate.claim.subject_occurrence_id);

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: [governedCompiled],
  };
  const openWorldEntry = toOpenWorldEntry(openWorldCompiled, 'OPEN_WORLD_WRITE_BOUNDARY_TEST_REASON');

  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: {
      provisions: [provision],
      limb_component_trees: [],
      open_world: [openWorldEntry],
    },
  });
  return { adapterResult, provision };
}

// ─── The marker is on the row, mints cleanly, and residual-free. ───

test('open-world entry produces marked rows with zero residuals, alongside a clean governed claim', async () => {
  const { adapterResult } = await buildMixedWriteSet();
  const { write_set: writeSet } = adapterResult;

  assert.equal(writeSet.claims.length, 1);
  assert.equal(writeSet.open_world_candidates.length, 1);
  assert.equal(writeSet.open_world_candidate_occurrences.length, 1);
  assert.equal(writeSet.open_world_evidence_references.length, 1);
  assert.equal(writeSet.open_world_candidate_dispositions.length, 1);
  assert.equal(adapterResult.residuals.length, 0);
  assert.equal(adapterResult.counts.open_world_candidates_total, 1);
  assert.equal(adapterResult.counts.open_world_candidates_written, 1);
  assert.equal(adapterResult.counts.open_world_candidates_rejected_by_coordinate_shift, 0);

  // The marker sits on the row itself for every open-world row kind, per
  // DECISIONS.md decision 2's first constraint.
  for (const row of [
    writeSet.open_world_candidates[0],
    writeSet.open_world_candidate_occurrences[0],
    writeSet.open_world_evidence_references[0],
    writeSet.open_world_candidate_dispositions[0],
  ]) {
    assert.equal(row.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  }
  assert.equal(writeSet.open_world_candidates[0].schema_version, OPEN_WORLD_CANDIDATE_SCHEMA);

  // The governed claim carries no such field at all -- not `false`, absent.
  assert.equal(Object.prototype.hasOwnProperty.call(writeSet.claims[0], 'evidence_governance'), false);
});

// ─── Both land in the SAME accepted, publishable write. ───

test('write boundary: the governed claim and the open-world entry both publish, and are distinguishable by the marker alone', async () => {
  const { adapterResult, provision } = await buildMixedWriteSet();
  const writeSet = { ...adapterResult.write_set, provisions: [provision] };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0, canonicalJsonOrRaw(validation.residuals));
  assert.equal(validation.quarantines.length, 0);
  assert.equal(validation.publishableWriteSet.claims.length, 1);
  assert.equal(validation.publishableWriteSet.open_world_candidates.length, 1);
  assert.equal(validation.publishableWriteSet.open_world_candidate_occurrences.length, 1);
  assert.equal(validation.publishableWriteSet.open_world_evidence_references.length, 1);
  assert.equal(validation.publishableWriteSet.open_world_candidate_dispositions.length, 1);

  const publishedClaim = validation.publishableWriteSet.claims[0];
  const publishedCandidate = validation.publishableWriteSet.open_world_candidates[0];
  assert.equal(Object.prototype.hasOwnProperty.call(publishedClaim, 'evidence_governance'), false);
  assert.equal(publishedCandidate.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
});

function canonicalJsonOrRaw(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─── Negative: a governed claim TAMPERED to carry the marker is caught and
// quarantined by the real validator, not silently published looking
// ungoverned or, worse, silently accepted as governed anyway. ───

test('write boundary: a claim row hand-tampered to carry the open-world marker is quarantined, not published', async () => {
  const { adapterResult, provision } = await buildMixedWriteSet();
  const tamperedClaim = { ...adapterResult.write_set.claims[0], evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER };
  const writeSet = {
    ...adapterResult.write_set,
    provisions: [provision],
    claims: [tamperedClaim],
  };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true, 'the whole write is not aborted -- only the tampered object is quarantined');
  assert.equal(validation.publishableWriteSet.claims.length, 0, 'the tampered claim must not reach the publishable set');
  assert.ok(validation.residuals.some((residual) => (
    residual.source_kind === 'claims' && residual.reason_code === 'CANONICAL_IDENTITY_MISMATCH'
  )), 'the tampering must surface as a residual, not disappear silently');
});

// ─── Negative: the adapter itself never lets an open-world entry pass
// without evidence -- unlike governed claims (which fail() the whole call
// on an internal receipt inconsistency), one bad open-world entry is
// isolated to its own residual so a single malformed model proposal cannot
// take down every other family's evidence in the same run.
test('write boundary: an open-world entry with unshiftable evidence is isolated to a residual, not a thrown error', async () => {
  const receipt = await buildReceipt();
  const openWorldCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === 'OPEN_WORLD_BOUNDARY_TEST_CANDIDATE',
  );
  const governedCompiled = receipt.compiled_candidates.find(
    (entry) => entry.ok && entry.candidate.claim.claim_definition_key === ACCURACY_KEY,
  );
  const brokenEntry = toOpenWorldEntry(openWorldCompiled, 'TEST_REASON');
  // Corrupt the recorded quote so the byte-verification inside
  // buildOpenWorldWriteRows (shiftEdge's expectedTextForEdge check) fails.
  brokenEntry.raw_value = 'this text does not appear anywhere in the document';

  const adapterResult = buildNativeWriteSet({
    run_receipt: { ...receipt, compiled_candidates: [governedCompiled] },
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: ADMITTED_SOURCE_CONTEXT,
    resolution: { provisions: [], limb_component_trees: [], open_world: [brokenEntry] },
  });

  assert.equal(adapterResult.write_set.open_world_candidates.length, 0);
  assert.equal(adapterResult.write_set.claims.length, 1, 'the unrelated governed claim is unaffected');
  assert.equal(adapterResult.residuals.length, 1);
  assert.equal(adapterResult.residuals[0].residual_type, 'OPEN_WORLD_EVIDENCE_COORDINATE_SHIFT_FAILED');
});
