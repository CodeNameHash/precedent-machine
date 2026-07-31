const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  runNativeExtraction,
  NativeExtractionRunError,
} = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

// ─── Fixture: a realistic full merger-agreement text with the real QXO
// Section 3.1(b) capital-structure and Section 5.2 closing-condition text
// embedded at their natural, undeclared positions -- the same composition
// tests/canonical-v2-native-sectionizer.test.js proves the sectionizer
// resolves correctly. Reconstructed here rather than imported so this test
// only depends on the sectionizer's PUBLIC contract, not another test
// file's private fixture.

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

const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';
const LIMB_II_QUOTE = '(ii)As of April 17, 2026,';

function makeClaimProposal({
  subjectSeed,
  ordinal = 0,
  quote,
  absoluteStart,
  absoluteEnd,
  claimDefinitionKey = 'NATIVE_EXTRACTION_RUN_TEST_CLAIM_CANDIDATE',
  attributes = {},
  allowedAttributes = [],
}) {
  const subjectOccurrenceId = contentId('NATIVE_EXTRACTION_RUN_TEST_SUBJECT/V1', subjectSeed);
  const excerptId = contentId('NATIVE_EXTRACTION_RUN_TEST_EXCERPT/V1', {
    quote, absoluteStart, absoluteEnd, ordinal,
  });
  return {
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: claimDefinitionKey,
    claim_definition_version: 1,
    ordinal,
    state: 'PRESENT',
    raw_value: quote,
    canonical_value: null,
    attributes,
    allowed_attributes: allowedAttributes,
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
    extraction_version: 'NATIVE_EXTRACTION_RUN_TEST/V1',
    normalisation_version: 'NATIVE_EXTRACTION_RUN_TEST/V1',
    derivation_version: 'NATIVE_EXTRACTION_RUN_TEST/V1',
  };
}

// Locates `quote` inside the exact text the provider was handed
// (governed_scope.source_text) and returns byte offsets local to it -- a
// well-behaved provider only ever cites text it was actually shown.
function locateInGovernedScope(governedScope, quote) {
  const bytes = Buffer.from(governedScope.source_text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = bytes.indexOf(needle);
  if (start < 0) throw new Error(`test fixture quote not found in governed scope: ${quote}`);
  return { start, end: start + needle.length, bytes };
}

function singleProposalProvider({ quote = LIMB_I_QUOTE, evidenceResiduals = [] } = {}) {
  return async ({ governed_scope: governedScope }) => {
    const { start, end } = locateInGovernedScope(governedScope, quote);
    return {
      provider_id: 'native-extraction-run-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-extraction-run-test-stub-prompt-v1',
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

// ─── End to end: text in, compiled candidates out ───

test('end to end: source text in, compiled candidates out, governed scope offsets round-trip against the source', async () => {
  let callCount = 0;
  const provider = async (input) => {
    callCount += 1;
    return singleProposalProvider()(input);
  };

  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider,
  });

  assert.equal(callCount, 1);
  assert.equal(receipt.document_hash, DOCUMENT_HASH);
  assert.equal(receipt.resolved_sections.length, 1);

  const section = receipt.resolved_sections[0];
  assert.equal(section.section_reference, '3.1(b)');

  // Governed scope offsets came from the sectionizer's automatic discovery
  // (not a constant) AND round-trip against the actual admitted source:
  // slicing the full document at [start, end) reproduces the real QXO
  // capital-structure text byte-for-byte.
  const roundTripped = Buffer.from(qxoRealisticFullText, 'utf8')
    .subarray(section.start, section.end)
    .toString('utf8');
  assert.equal(roundTripped, capitalStructureText);

  assert.equal(receipt.compiled_candidates.length, 1);
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.ok, true);
  assert.equal(entry.section_reference, '3.1(b)');
  assert.equal(entry.candidate.kind, 'claim');
  assert.equal(entry.candidate.claim.raw_value, LIMB_I_QUOTE);

  const [edge] = entry.candidate.claim.evidence;
  assert.ok(edge.absolute_start >= 0);
  assert.ok(edge.absolute_end <= (section.end - section.start));
  const sectionByteSlice = Buffer.from(capitalStructureText, 'utf8')
    .subarray(edge.absolute_start, edge.absolute_end)
    .toString('utf8');
  assert.equal(sectionByteSlice, LIMB_I_QUOTE);

  assert.equal(receipt.compiled_candidate_count, 1);
  assert.equal(receipt.rejected_candidate_count, 0);
  assert.equal(receipt.scope_violations.length, 0);
  assert.equal(receipt.scope_violation_count, 0);
  assert.match(receipt.run_receipt_id, /^[a-f0-9]{64}$/);
});

// ─── Determinism ───

test('is deterministic: same input and same stubbed provider response produce a byte-identical run receipt', async () => {
  const args = {
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: singleProposalProvider(),
  };

  const first = await runNativeExtraction(args);
  const second = await runNativeExtraction({ ...args, provider: singleProposalProvider() });

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.run_receipt_id, second.run_receipt_id);
});

// ─── Fail closed on an unresolvable section reference ───

test('an unresolvable section reference is a typed failure, never a whole-document fallback', async () => {
  let callCount = 0;
  const provider = async (input) => {
    callCount += 1;
    return singleProposalProvider()(input);
  };

  await assert.rejects(
    () => runNativeExtraction({
      source_text: qxoRealisticFullText,
      document_hash: DOCUMENT_HASH,
      // "3.1(b)" resolves; "99.99(z)" does not -- the whole batch must fail
      // closed before the provider is ever called for EITHER reference.
      section_references: ['3.1(b)', '99.99(z)'],
      contract_bundle: CONTRACT_BUNDLE,
      definitions: DEFINITIONS,
      provider,
    }),
    (err) => {
      assert.ok(err instanceof NativeExtractionRunError);
      assert.equal(err.code, 'SECTION_REFERENCE_UNRESOLVED');
      assert.equal(err.details.section_reference, '99.99(z)');
      return true;
    },
  );

  assert.equal(callCount, 0, 'the provider must never be called when any requested reference is unresolvable');
});

// ─── Evidence residuals reach the run receipt and are counted ───

test('evidence residuals from the provider reach the run receipt and are counted', async () => {
  const residuals = [
    { reason: 'LIMB_ASSERTION_QUOTE_UNVERIFIED', quote_preview: 'a quote the provider could not evidence' },
    { reason: 'QUALIFIER_QUOTE_UNVERIFIED', quote_preview: 'another unverifiable quote' },
  ];

  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: singleProposalProvider({ evidenceResiduals: residuals }),
  });

  assert.equal(receipt.evidence_residuals.length, 2);
  assert.equal(receipt.evidence_residual_count, 2);
  for (const residual of receipt.evidence_residuals) {
    assert.equal(residual.section_reference, '3.1(b)');
  }
  assert.deepEqual(
    receipt.evidence_residuals.map((r) => r.reason),
    ['LIMB_ASSERTION_QUOTE_UNVERIFIED', 'QUALIFIER_QUOTE_UNVERIFIED'],
  );
});

// ─── Scope integrity: evidence outside the licensed scope is rejected ───

test('scope integrity: a candidate citing text outside its licensed scope is rejected, in-scope candidates survive', async () => {
  const provider = async ({ governed_scope: governedScope }) => {
    const valid = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    const validProposal = makeClaimProposal({
      subjectSeed: { kind: 'valid', section_reference: governedScope.section_reference },
      ordinal: 0,
      quote: LIMB_I_QUOTE,
      absoluteStart: valid.start,
      absoluteEnd: valid.end,
    });

    // Poisoned #1: offsets entirely past the end of the section text the
    // provider was actually shown -- as if it cited content from a
    // neighbouring section it was never licensed to see.
    const sectionByteLength = Buffer.byteLength(governedScope.source_text, 'utf8');
    const outOfBoundsProposal = makeClaimProposal({
      subjectSeed: { kind: 'out-of-bounds', section_reference: governedScope.section_reference },
      ordinal: 1,
      quote: 'No Company Material Adverse Effect shall have occurred since the date of this Agreement.',
      absoluteStart: sectionByteLength + 10,
      absoluteEnd: sectionByteLength + 50,
    });

    // Poisoned #2: offsets that ARE inside the governed section, but the
    // claimed raw_value does not match what is actually at that location --
    // a fabricated quote wearing a legitimate-looking citation.
    const mismatchLocation = locateInGovernedScope(governedScope, LIMB_II_QUOTE);
    const mismatchedTextProposal = makeClaimProposal({
      subjectSeed: { kind: 'mismatch', section_reference: governedScope.section_reference },
      ordinal: 2,
      quote: 'This raw_value does not match the bytes at the cited offsets',
      absoluteStart: mismatchLocation.start,
      absoluteEnd: mismatchLocation.end,
    });

    return {
      provider_id: 'native-extraction-run-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-extraction-run-test-stub-prompt-v1',
      proposals: [validProposal, outOfBoundsProposal, mismatchedTextProposal],
      evidence_residuals: [],
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

  assert.equal(receipt.compiled_candidates.length, 1, 'only the valid proposal should compile');
  assert.equal(receipt.compiled_candidates[0].candidate.claim.raw_value, LIMB_I_QUOTE);
  assert.equal(receipt.compiled_candidate_count, 1);
  assert.equal(receipt.rejected_candidate_count, 0, 'the poisoned proposals never reach the compiler at all');

  assert.equal(receipt.scope_violations.length, 2);
  assert.deepEqual(
    receipt.scope_violations.map((v) => v.reason).sort(),
    ['EVIDENCE_OUTSIDE_GOVERNED_SCOPE', 'EVIDENCE_TEXT_MISMATCH'],
  );
  for (const violation of receipt.scope_violations) {
    assert.equal(violation.section_reference, '3.1(b)');
  }

  // Every SURVIVING compiled candidate's evidence lies inside the governed
  // scope interval for its section.
  const section = receipt.resolved_sections.find((s) => s.section_reference === '3.1(b)');
  const sectionByteLength = section.end - section.start;
  for (const { candidate } of receipt.compiled_candidates) {
    for (const edge of candidate[candidate.kind].evidence) {
      assert.ok(edge.absolute_start >= 0);
      assert.ok(edge.absolute_end <= sectionByteLength);
    }
  }
});

// ─── Citation constructibility (docs/handoffs/F28-FIRST-LIVE-RUN.md defect
// 3): a section_reference that does not resolve against the sectionizer's
// discovered tree is excluded from compiled_candidates and recorded as a
// typed citation_residuals entry, never silently accepted. ───

test('a section_reference that cannot be constructed from the discovered tree is a CITATION_NOT_CONSTRUCTIBLE residual, and the proposal is excluded', async () => {
  const provider = async ({ governed_scope: governedScope }) => {
    const { start, end } = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    const proposal = makeClaimProposal({
      subjectSeed: { kind: 'bad-citation' },
      ordinal: 0,
      quote: LIMB_I_QUOTE,
      absoluteStart: start,
      absoluteEnd: end,
      // This is a real-shaped citation ("3.1(b)(i)") but this test's
      // governing section is requested and resolved as "3.1(b)" -- a
      // sibling limb citation the sectionizer never discovered as its own
      // node under THIS request is exactly the F28 live-run failure mode
      // (there the whole document had no "3.1" numbering at all; here the
      // citation just names a node this call's tree lookup cannot produce
      // from the governing node's own span).
      attributes: { section_reference: 'NOT-A-REAL-CITATION(z)(z)' },
      allowedAttributes: ['section_reference'],
    });
    return {
      provider_id: 'native-extraction-run-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-extraction-run-test-stub-prompt-v1',
      proposals: [proposal],
      evidence_residuals: [],
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

  assert.equal(receipt.compiled_candidates.length, 0, 'the bad-citation proposal never reaches the compiler');
  assert.equal(receipt.compiled_candidate_count, 0);
  assert.equal(receipt.citation_residual_count, 1);
  assert.equal(receipt.citation_residuals.length, 1);
  const [residual] = receipt.citation_residuals;
  assert.equal(residual.reason, 'CITATION_NOT_CONSTRUCTIBLE');
  assert.equal(residual.model_citation, 'NOT-A-REAL-CITATION(z)(z)');
  assert.equal(residual.derived_citation, '3.1(b)');
  assert.equal(residual.section_reference, '3.1(b)');
});

test('a section_reference matching the governing section\'s own discovered reference is accepted with no citation residual', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { start, end } = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
      return {
        provider_id: 'native-extraction-run-test-stub/v1',
        model_id: 'stub-model',
        prompt: 'native-extraction-run-test-stub-prompt-v1',
        proposals: [makeClaimProposal({
          subjectSeed: { kind: 'good-citation' },
          ordinal: 0,
          quote: LIMB_I_QUOTE,
          absoluteStart: start,
          absoluteEnd: end,
          attributes: { section_reference: '3.1(b)' },
          allowedAttributes: ['section_reference'],
        })],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.citation_residual_count, 0);
  assert.equal(receipt.compiled_candidate_count, 1);
});

// ─── Input validation ───

test('rejects malformed inputs instead of silently misbehaving', async () => {
  await assert.rejects(() => runNativeExtraction({
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: singleProposalProvider(),
  }), NativeExtractionRunError);

  await assert.rejects(() => runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: [],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: singleProposalProvider(),
  }), NativeExtractionRunError);

  await assert.rejects(() => runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: 'not-a-function',
  }), NativeExtractionRunError);
});
