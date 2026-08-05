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
const { QUALIFIER_CLAIM_KEY, LIMB_ASSERTION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { COVERAGE_PROXY_REPORT_SCHEMA } = require('../lib/canonical-v2/native-producer/coverage-proxies');
const { LIMB_ENUMERATION_SCAN_REPORT_SCHEMA } = require('../lib/canonical-v2/native-producer/limb-enumeration-scan');

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

// ─── Task-8 recall instruments wired into the receipt (F28-THIRD-LIVE-RUN.md
// known-limitations register item 5 / final-audit finding M7) ───

// A provider that emits a real LIMB_ASSERTION_CLAIM_KEY proposal (with a
// limb_path attribute) and a real QUALIFIER_CLAIM_KEY proposal, so the
// receipt-built coverage-proxies / limb-enumeration-scan projections have
// something concrete to report on.
function limbAndQualifierProvider({
  limbPath = ['(i)'],
  limbQuote = LIMB_I_QUOTE,
  qualifierQuote = LIMB_II_QUOTE,
} = {}) {
  return async ({ governed_scope: governedScope }) => {
    const limbEvidence = locateInGovernedScope(governedScope, limbQuote);
    const qualifierEvidence = locateInGovernedScope(governedScope, qualifierQuote);
    return {
      provider_id: 'native-extraction-run-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-extraction-run-test-stub-prompt-v1',
      proposals: [
        makeClaimProposal({
          subjectSeed: { section_reference: governedScope.section_reference, kind: 'limb', limbQuote },
          ordinal: 0,
          quote: limbQuote,
          absoluteStart: limbEvidence.start,
          absoluteEnd: limbEvidence.end,
          claimDefinitionKey: LIMB_ASSERTION_CLAIM_KEY,
          attributes: { limb_path: limbPath },
          allowedAttributes: ['limb_path'],
        }),
        makeClaimProposal({
          subjectSeed: { section_reference: governedScope.section_reference, kind: 'qualifier', qualifierQuote },
          ordinal: 0,
          quote: qualifierQuote,
          absoluteStart: qualifierEvidence.start,
          absoluteEnd: qualifierEvidence.end,
          claimDefinitionKey: QUALIFIER_CLAIM_KEY,
          attributes: {},
          allowedAttributes: [],
        }),
      ],
      evidence_residuals: [],
    };
  };
}

test('the run receipt carries a coverage_proxies report and a limb_enumeration_scan report, one per resolved section', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: limbAndQualifierProvider(),
  });

  assert.ok(Array.isArray(receipt.coverage_proxies));
  assert.equal(receipt.coverage_proxies.length, 1);
  const [coverageReport] = receipt.coverage_proxies;
  assert.equal(coverageReport.schema_version, COVERAGE_PROXY_REPORT_SCHEMA);
  assert.equal(coverageReport.section_reference, '3.1(b)');
  // One qualifier proposal (QUALIFIER_CLAIM_KEY) was emitted.
  assert.equal(coverageReport.qualifiers_emitted_count, 1);
  assert.ok(Array.isArray(coverageReport.signals));

  assert.ok(Array.isArray(receipt.limb_enumeration_scan));
  assert.equal(receipt.limb_enumeration_scan.length, 1);
  const [limbScanReport] = receipt.limb_enumeration_scan;
  assert.equal(limbScanReport.schema_version, LIMB_ENUMERATION_SCAN_REPORT_SCHEMA);
  assert.equal(limbScanReport.section_reference, '3.1(b)');
  assert.deepEqual(limbScanReport.proposed_tokens, ['(i)']);

  // The two new fields participate in the receipt's own content-id
  // derivation exactly like every other field: a run whose only difference
  // is the instrument input (here, a different limb_path) must mint a
  // different run_receipt_id.
  const receiptWithDifferentLimb = await runNativeExtraction({
    source_text: qxoRealisticFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: limbAndQualifierProvider({ limbPath: ['(ii)'] }),
  });
  assert.notEqual(receipt.run_receipt_id, receiptWithDifferentLimb.run_receipt_id);
});

test('an instrument failure is typed into the receipt, never thrown -- the run still completes', async () => {
  // A LIMB_ASSERTION_CLAIM_KEY proposal whose limb_path carries a non-string
  // segment: our own projection only checks "is a non-empty array", so this
  // malformed value reaches scanLimbEnumeration's own input validation
  // (limb-enumeration-scan.js's flattenProposedTokens), which throws
  // LimbEnumerationScanError('INVALID_INPUT', ...) for a non-string segment.
  const provider = async ({ governed_scope: governedScope }) => {
    const limbEvidence = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    return {
      provider_id: 'native-extraction-run-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'native-extraction-run-test-stub-prompt-v1',
      proposals: [
        makeClaimProposal({
          subjectSeed: { section_reference: governedScope.section_reference, kind: 'bad-limb' },
          ordinal: 0,
          quote: LIMB_I_QUOTE,
          absoluteStart: limbEvidence.start,
          absoluteEnd: limbEvidence.end,
          claimDefinitionKey: LIMB_ASSERTION_CLAIM_KEY,
          attributes: { limb_path: [123] }, // malformed: a number, not a string segment
          allowedAttributes: ['limb_path'],
        }),
      ],
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

  // The run completed: compiled_candidates, resolved_sections etc are all
  // still populated normally.
  assert.equal(receipt.compiled_candidates.length, 1);
  assert.equal(receipt.resolved_sections.length, 1);

  // The failing instrument is typed into the receipt, not thrown.
  assert.equal(receipt.limb_enumeration_scan.length, 1);
  const [failedReport] = receipt.limb_enumeration_scan;
  assert.equal(failedReport.section_reference, '3.1(b)');
  assert.equal(typeof failedReport.error, 'string');
  assert.equal(failedReport.error, 'INVALID_INPUT');
  assert.equal(typeof failedReport.message, 'string');
  assert.equal(failedReport.schema_version, undefined);

  // The OTHER instrument, unaffected by this failure, still produced a real
  // report for the same section.
  assert.equal(receipt.coverage_proxies.length, 1);
  assert.equal(receipt.coverage_proxies[0].schema_version, COVERAGE_PROXY_REPORT_SCHEMA);

  assert.match(receipt.run_receipt_id, /^[a-f0-9]{64}$/);
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
// (docs/archive/handoffs/F28-FIRST-LIVE-RUN.md defect 3 and
// docs/archive/handoffs/F28-SECOND-LIVE-RUN.md). A section_reference that does not
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
  // Per-proposal derivation (Skechers-live-run fix): the derived citation
  // now comes from THIS proposal's own evidence span (LIMB_I_QUOTE, the
  // "(i)" limb text) rather than the governing section's outer span --
  // deeper and more precise than the governed "3.1(b)" scope itself.
  assert.equal(residual.derived_citation, '3.1(b)(i)');
  assert.equal(residual.section_reference, '3.1(b)');
});

test('a section_reference matching the citation derived from THIS proposal\'s own evidence span is accepted with no citation residual, and validation_source is CONSTRUCTED_FROM_TREE', async () => {
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
          // The proposal's own evidence (LIMB_I_QUOTE) sits inside the
          // deeper "3.1(b)(i)" node, not merely the governed "3.1(b)"
          // section -- per-proposal derivation means THIS is now the
          // correct/agreeing citation, not the governing section's own
          // reference.
          attributes: { section_reference: '3.1(b)(i)' },
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
          // failure mode from docs/archive/handoffs/F28-SECOND-LIVE-RUN.md: real,
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

// ─── Skechers-first-live-run defect, reproduced against the REAL Skechers
// excerpt fixture (not a hand-rolled tree): a governed section "3.7"
// straddled by a legacy "III-INTRO(d)" node (see tests/canonical-v2-inline-
// decimal-headings.test.js for the same excerpt's own provenance). Proves
// BOTH halves of the fix together, at the runNativeExtraction level:
//   1. per-proposal derivation -- each proposal's own evidence span, not the
//      governed section's outer span, drives the derived citation;
//   2. the decimal-lineage tie-break -- the derived node lands on the real
//      "3.7(b)"/"3.7(c)" decimal SUBSECTION, never the deeper-but-straddling
//      "III-INTRO(d)" legacy node. ───

const skechersExcerptText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'article-iii-canonical-excerpt.txt'),
  'utf8',
);
const SKECHERS_DOCUMENT_HASH = sha256Hex(Buffer.from(skechersExcerptText, 'utf8'));

test('Skechers defect reproduction: a proposal whose evidence sits in a real decimal SUBSECTION straddled by a legacy "III-INTRO(d)" node still derives that decimal SUBSECTION, not the straddling legacy node', async () => {
  const receipt = await runNativeExtraction({
    source_text: skechersExcerptText,
    document_hash: SKECHERS_DOCUMENT_HASH,
    section_references: ['3.7'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const quoteB = 'Stock Reservation';
      const { start: startB, end: endB } = locateInGovernedScope(governedScope, quoteB);
      const proposalB = makeClaimProposal({
        subjectSeed: { kind: 'skechers-b' },
        ordinal: 0,
        quote: quoteB,
        absoluteStart: startB,
        absoluteEnd: endB,
        // The model's own citation, exactly as recorded in the real
        // Skechers live run: correct, specific, and NOT the derivation the
        // pre-fix pipeline produced ("III-INTRO(d)").
        attributes: { section_reference: '3.7(b)' },
        allowedAttributes: ['section_reference'],
      });
      return {
        provider_id: 'skechers-defect-repro/v1',
        model_id: 'stub-model',
        prompt: 'skechers-defect-repro-prompt/v1',
        proposals: [proposalB],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, 1);
  const [entry] = receipt.compiled_candidates;
  assert.ok(entry.citation_validation);
  // Pre-fix, this would have been CITATION_DISAGREEMENT with derived_citation
  // "III-INTRO(d)" -- the exact Skechers finding. Post-fix: AGREEMENT.
  assert.equal(entry.citation_validation.status, 'AGREEMENT');
  assert.equal(entry.citation_validation.accepted, true);
  assert.equal(entry.citation_validation.validation_source, 'CONSTRUCTED_FROM_TREE');
  assert.equal(entry.citation_validation.derived_citation, '3.7(b)');
  assert.notEqual(entry.citation_validation.derived_citation, 'III-INTRO(d)');
});

test('Skechers defect reproduction: two proposals from the SAME governed section derive DIFFERENT citations from their own evidence spans (per-proposal derivation, not one derivation per section)', async () => {
  const receipt = await runNativeExtraction({
    source_text: skechersExcerptText,
    document_hash: SKECHERS_DOCUMENT_HASH,
    section_references: ['3.7'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const quoteB = 'Stock Reservation';
      const { start: startB, end: endB } = locateInGovernedScope(governedScope, quoteB);
      const quoteC = 'Capitalization Date';
      const { start: startC, end: endC } = locateInGovernedScope(governedScope, quoteC);
      const proposalB = makeClaimProposal({
        subjectSeed: { kind: 'skechers-b' },
        ordinal: 0,
        quote: quoteB,
        absoluteStart: startB,
        absoluteEnd: endB,
        attributes: { section_reference: '3.7(b)' },
        allowedAttributes: ['section_reference'],
      });
      const proposalC = makeClaimProposal({
        subjectSeed: { kind: 'skechers-c' },
        ordinal: 1,
        quote: quoteC,
        absoluteStart: startC,
        absoluteEnd: endC,
        attributes: { section_reference: '3.7(b)' }, // deliberately WRONG for this evidence
        allowedAttributes: ['section_reference'],
      });
      return {
        provider_id: 'skechers-defect-repro/v1',
        model_id: 'stub-model',
        prompt: 'skechers-defect-repro-prompt/v1',
        proposals: [proposalB, proposalC],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, 2);
  const [entryB, entryC] = receipt.compiled_candidates;
  // Both proposals share the SAME governed section ("3.7") but derive
  // DIFFERENT citations, because each is derived from its own evidence span.
  assert.equal(entryB.citation_validation.derived_citation, '3.7(b)');
  assert.notEqual(entryC.citation_validation.derived_citation, '3.7(b)');
  assert.equal(entryB.citation_validation.status, 'AGREEMENT');
  // 2026-08-02 Fable review fix: the sole production caller now passes
  // `quote: proposal.raw_value` into checkCitationConstructibility (see
  // native-extraction-run.js). Proposal C's quote ("Capitalization Date")
  // occurs more than once in this real Skechers excerpt, so what was a
  // plain CITATION_DISAGREEMENT before that wiring is now the more precise
  // typed outcome AMBIGUOUS_CITATION_OCCURRENCE -- still unaccepted, still
  // routed to review, never silently resolved in either direction.
  assert.equal(entryC.citation_validation.status, 'AMBIGUOUS_CITATION_OCCURRENCE');
  assert.equal(entryC.citation_validation.accepted, false);
});

// ─── Fable-review follow-up (2026-08-02): FIX 2's position-aware quote-
// occurrence resolution (citation-constructibility.js's resolveQuoteOccur-
// rence, exercised via checkCitationConstructibility's opt-in `quote` param)
// was dead code in production until this fix -- the sole caller here never
// passed it. Reproduces the real Modiv shape at the RECEIPT level, not just
// the unit level tested in tests/canonical-v2-citation-constructibility.
// test.js: a governed section ("3.2") whose child (f) and child (g) both
// contain the SAME repeated quote text; the model's own recorded evidence
// offsets point at the FIRST occurrence (inside "(f)"), same as the real
// run's naive-first-match defect, while the model's own section_reference
// attribute correctly says "3.2(g)". Without wiring `quote:
// proposal.raw_value` through, this is a false CITATION_DISAGREEMENT
// (derived "3.2(f)"); with it wired, the position-aware resolver finds the
// "(g)" occurrence, and the compiled candidate's citation_validation is
// AGREEMENT deriving "3.2(g)". ───

const MODIV_STYLE_QUOTE = 'as of the Capitalization Date';

function buildModivStyleText() {
  return [
    'Section 3.2 Capitalization.\n\n',
    `(f)Optionholder Matters. Immediately prior to the Effective Time, the Company shall take commercially reasonable actions such that, ${MODIV_STYLE_QUOTE}, each outstanding Company Option shall be treated as follows, and again ${MODIV_STYLE_QUOTE}, such treatment shall apply.\n\n`,
    `(g)Warrant Matters. Immediately prior to the Effective Time, ${MODIV_STYLE_QUOTE}, each outstanding Company Warrant shall be treated as follows.\n`,
  ].join('');
}

const MODIV_STYLE_TEXT = buildModivStyleText();
const MODIV_STYLE_DOCUMENT_HASH = sha256Hex(Buffer.from(MODIV_STYLE_TEXT, 'utf8'));

test('MODIV REGRESSION at the receipt level: quote wiring upgrades a false CITATION_DISAGREEMENT (derived from the first-matched, wrong occurrence in "(f)") to AGREEMENT deriving "3.2(g)", the model\'s real citation', async () => {
  const receipt = await runNativeExtraction({
    source_text: MODIV_STYLE_TEXT,
    document_hash: MODIV_STYLE_DOCUMENT_HASH,
    section_references: ['3.2'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      // Same naive first-match the real run's evidence-offset defect
      // reproduced: locates the FIRST occurrence of the repeated quote in
      // the governed section's text, which sits inside "(f)", not "(g)".
      const { start, end } = locateInGovernedScope(governedScope, MODIV_STYLE_QUOTE);
      const proposal = makeClaimProposal({
        subjectSeed: { kind: 'modiv-style-repeated-phrase' },
        ordinal: 0,
        quote: MODIV_STYLE_QUOTE,
        absoluteStart: start,
        absoluteEnd: end,
        // The model's own, correct citation -- exactly as recorded in the
        // real Modiv run receipt.
        attributes: { section_reference: '3.2(g)' },
        allowedAttributes: ['section_reference'],
      });
      return {
        provider_id: 'modiv-style-defect-repro/v1',
        model_id: 'stub-model',
        prompt: 'modiv-style-defect-repro-prompt/v1',
        proposals: [proposal],
        evidence_residuals: [],
      };
    },
  });

  assert.equal(receipt.compiled_candidates.length, 1);
  const [entry] = receipt.compiled_candidates;
  assert.ok(entry.citation_validation);
  // Pre-fix (quote never wired through): CITATION_DISAGREEMENT, derived
  // "3.2(f)" -- the first-matched, wrong occurrence.
  // Post-fix: AGREEMENT, derived "3.2(g)".
  assert.equal(entry.citation_validation.status, 'AGREEMENT');
  assert.equal(entry.citation_validation.accepted, true);
  assert.equal(entry.citation_validation.validation_source, 'CONSTRUCTED_FROM_TREE_QUOTE_POSITION');
  assert.equal(entry.citation_validation.derived_citation, '3.2(g)');
  assert.notEqual(entry.citation_validation.derived_citation, '3.2(f)');
  assert.equal(receipt.citation_residual_count, 0);
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
