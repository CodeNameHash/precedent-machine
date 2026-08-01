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

// ─── Citation constructibility, corroboration, and never-silently-discard
// (docs/handoffs/F28-FIRST-LIVE-RUN.md defect 3 and
// docs/handoffs/F28-SECOND-LIVE-RUN.md). A section_reference that does not
// resolve against the sectionizer's discovered tree is recorded as a typed
// citation_residuals entry AND a citation_validation object on the compiled
// candidate -- but the proposal still compiles: a failing or unvalidated
// citation is never a silent drop. ───

test('a section_reference that cannot be constructed from the discovered tree, and is not corroborated by the document text, still compiles -- with an unaccepted citation_validation and a typed residual', async () => {
  const provider = async ({ governed_scope: governedScope }) => {
    const { start, end } = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    const proposal = makeClaimProposal({
      subjectSeed: { kind: 'bad-citation' },
      ordinal: 0,
      quote: LIMB_I_QUOTE,
      absoluteStart: start,
      absoluteEnd: end,
      // A citation naming a node the tree never discovered AND that never
      // appears anywhere in the document's own text either -- neither
      // source validates it, so it must still compile but stay unaccepted.
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

  assert.equal(receipt.compiled_candidates.length, 1, 'the bad-citation proposal still compiles -- never silently dropped');
  assert.equal(receipt.compiled_candidate_count, 1);
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.ok, true);
  assert.ok(entry.citation_validation, 'a citation_validation record is attached');
  assert.equal(entry.citation_validation.status, 'CITATION_NOT_CONSTRUCTIBLE');
  assert.equal(entry.citation_validation.accepted, false);
  assert.equal(entry.citation_validation.validation_source, null);

  assert.equal(receipt.citation_residual_count, 1);
  assert.equal(receipt.citation_residuals.length, 1);
  const [residual] = receipt.citation_residuals;
  assert.equal(residual.reason, 'CITATION_NOT_CONSTRUCTIBLE');
  assert.equal(residual.model_citation, 'NOT-A-REAL-CITATION(z)(z)');
  assert.equal(residual.derived_citation, '3.1(b)');
  assert.equal(residual.section_reference, '3.1(b)');
});

test('a section_reference matching the governing section\'s own discovered reference is accepted with no citation residual, and validation_source is CONSTRUCTED_FROM_TREE', async () => {
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
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.citation_validation.status, 'AGREEMENT');
  assert.equal(entry.citation_validation.accepted, true);
  assert.equal(entry.citation_validation.validation_source, 'CONSTRUCTED_FROM_TREE');
});

// ─── Corroboration: a citation the tree cannot construct, but which the
// document's own cross-reference prose corroborates (the real QXO/TopBuild
// failure mode -- bare lettered subsections with no "Section 3.1" heading
// anywhere, yet the document's own text cites "Section 3.1(b)(i)" freely
// elsewhere), is ACCEPTED with validation_source CORROBORATED_BY_DOCUMENT_
// TEXT, still compiles, and carries no exclusionary residual treatment. ───

const DEGENERATE_LIMB_QUOTE = '(i)The authorized capital stock of the Company consists of 100,000,000 shares.';

function buildDegenerateFullText() {
  // Mirrors tests/canonical-v2-citation-constructibility.test.js's own
  // degenerate-tree fixture: bare lettered subsections directly under an
  // ARTICLE heading, no "Section 3.1" heading anywhere -- plus a genuine
  // cross-reference elsewhere in the SAME article that cites "Section
  // 3.1(b)(i)" with a real U+200E LRM between "Section" and the number,
  // exactly as EDGAR renders it.
  return [
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    '(a)Organization; Standing. The Company is duly organized.\n\n',
    '(b)Capital Structure.\n',
    `${DEGENERATE_LIMB_QUOTE}\n`,
    '(ii)There are no other outstanding equity securities.\n\n',
    '(c)Closing Condition Cross-Reference. The obligations of Parent to consummate the Merger are subject to the ',
    'representations set forth in Section‎3.1(b)(i) being true and correct.\n',
  ].join('');
}

test('a citation the tree cannot construct, but the document\'s own cross-reference text corroborates (zero-width tolerant), is accepted as CORROBORATED_BY_DOCUMENT_TEXT and compiles', async () => {
  const degenerateFullText = buildDegenerateFullText();
  const documentHash = sha256Hex(Buffer.from(degenerateFullText, 'utf8'));

  const receipt = await runNativeExtraction({
    source_text: degenerateFullText,
    document_hash: documentHash,
    section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { start, end } = locateInGovernedScope(governedScope, DEGENERATE_LIMB_QUOTE);
      return {
        provider_id: 'native-extraction-run-test-stub/v1',
        model_id: 'stub-model',
        prompt: 'native-extraction-run-test-stub-prompt-v1',
        proposals: [makeClaimProposal({
          subjectSeed: { kind: 'corroborated-citation' },
          ordinal: 0,
          quote: DEGENERATE_LIMB_QUOTE,
          absoluteStart: start,
          absoluteEnd: end,
          // The model's honest, document-consistent citation -- the exact
          // failure mode from docs/handoffs/F28-SECOND-LIVE-RUN.md: real,
          // grounded in the document's own cross-reference prose, but not a
          // node the heading-only tree ever discovers.
          attributes: { section_reference: '3.1(b)(i)' },
          allowedAttributes: ['section_reference'],
        })],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, 1);
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.ok, true, 'the corroborated-but-not-constructible proposal compiles');
  assert.ok(entry.citation_validation);
  assert.equal(entry.citation_validation.status, 'CITATION_NOT_CONSTRUCTIBLE', 'the tree genuinely cannot construct this citation');
  assert.equal(entry.citation_validation.accepted, true, 'but document-text corroboration accepts it');
  assert.equal(entry.citation_validation.validation_source, 'CORROBORATED_BY_DOCUMENT_TEXT');

  // Accepted via corroboration carries no exclusionary residual -- the
  // citation_residuals bucket only records UNACCEPTED outcomes.
  assert.equal(receipt.citation_residual_count, 0);
  assert.equal(receipt.citation_residuals.length, 0);
});

test('a citation absent from both the tree and the document\'s own text is neither constructed nor corroborated, and remains unaccepted', async () => {
  const degenerateFullText = buildDegenerateFullText();
  const documentHash = sha256Hex(Buffer.from(degenerateFullText, 'utf8'));

  const receipt = await runNativeExtraction({
    source_text: degenerateFullText,
    document_hash: documentHash,
    section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { start, end } = locateInGovernedScope(governedScope, DEGENERATE_LIMB_QUOTE);
      return {
        provider_id: 'native-extraction-run-test-stub/v1',
        model_id: 'stub-model',
        prompt: 'native-extraction-run-test-stub-prompt-v1',
        proposals: [makeClaimProposal({
          subjectSeed: { kind: 'uncorroborated-citation' },
          ordinal: 0,
          quote: DEGENERATE_LIMB_QUOTE,
          absoluteStart: start,
          absoluteEnd: end,
          attributes: { section_reference: '9.9(z)(z)' },
          allowedAttributes: ['section_reference'],
        })],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, 1, 'still compiles -- never vanishes');
  const [entry] = receipt.compiled_candidates;
  assert.equal(entry.ok, true);
  assert.equal(entry.citation_validation.status, 'CITATION_NOT_CONSTRUCTIBLE');
  assert.equal(entry.citation_validation.accepted, false);
  assert.equal(entry.citation_validation.validation_source, null);
  assert.equal(receipt.citation_residual_count, 1);
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
