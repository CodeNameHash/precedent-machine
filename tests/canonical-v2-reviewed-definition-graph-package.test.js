const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readFileSync,
} = require('node:fs');
const path = require('node:path');

const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  buildAdmittedParserProposalEnvelope,
} = require('../lib/canonical-v2/admitted-parser-proposal-adapter');
const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildAcceptedDefinitionCandidateDisposition,
  buildDefinitionGraphNormaliserIdentity,
  buildNoModelInferenceTranscriptSetMarker,
  buildReviewedDefinitionGraphPackage,
  buildUnresolvedDefinitionCandidateDisposition,
  preflightReviewedDefinitionGraphPackageBudget,
  validateReviewedDefinitionGraphPackage,
} = require('../lib/canonical-v2/reviewed-definition-graph-package');
const {
  buildSecEdgarIntakeCapture,
} = require('../lib/canonical-v2/sec-edgar-intake-capture');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const {
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');
const {
  validateCanonicalWriteSet,
} = require('../lib/canonical-v2/validate-write-set');

const REVIEWER_IDENTITY_DIGEST = sha256Hex('QXO_DEFINITION_FIXTURE_REVIEWER/V1');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function qxoHtml({
  unresolvedSibling = false,
  outOfScopeSibling = false,
  parserResidual = false,
  crossSectionUse = false,
  term = 'De Minimis Inaccuracies',
  operativeTerm = term,
} = {}) {
  if (crossSectionUse) {
    return `<html><body>
<p>ARTICLE I</p><p>DEFINITIONS</p>
<p>Section 1.01 Definitions. &quot;${term}&quot; means any inaccuracies
that are de minimis relative to fully diluted equity capitalization;</p>
<p>ARTICLE V</p><p>CONDITIONS</p>
<p>Section 5.02 Additional Conditions. The capitalization representations shall
be true and correct except for ${operativeTerm}.</p>
<p>IN WITNESS WHEREOF</p>
</body></html>`;
  }
  const qxoBody = QXO_5_2_TEXT.replace(/^5\.2/, '');
  const sibling = unresolvedSibling
    ? '<p>&quot;Unreviewed Mechanic&quot; means a source-backed formulation awaiting review;</p>'
    : '';
  const otherSection = outOfScopeSibling
    ? '<p>Section 5.03 Other Provision. &quot;Other Mechanic&quot; means a separate source-backed formulation;</p>'
    : '';
  const residual = parserResidual
    ? '<p>Unassigned legal material before the first governed article.</p>'
    : '';
  return `<html><body>
${residual}<p>ARTICLE V</p><p>CONDITIONS</p>
<p>Section 5.02 ${escapeHtml(qxoBody)}</p>
${sibling}
${otherSection}
<p>IN WITNESS WHEREOF</p>
</body></html>`;
}

function byteOffset(text, characterOffset) {
  return Buffer.byteLength(text.slice(0, characterOffset), 'utf8');
}

function spanFromCharacterInterval(source, start, end) {
  return buildSemanticSpan(
    source,
    byteOffset(source.canonical_text.text, start),
    byteOffset(source.canonical_text.text, end),
  );
}

function admittedFixture(options = {}) {
  const label = [
    'reviewed-definition-graph',
    options.unresolvedSibling ? 'unresolved' : 'closed',
    options.outOfScopeSibling ? 'out-of-scope' : 'single-scope',
    options.parserResidual ? 'residual' : 'clean',
    options.crossSectionUse ? 'cross-section-use' : 'same-section-use',
  ].join('-');
  const html = qxoHtml(options);
  const url = `https://www.sec.gov/Archives/edgar/data/1/${label}.htm`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-25T00:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html, 'utf8'),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const governedDealKey = `deal:${label}`;
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', governedDealKey);
  const contextInputs = {
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope:
      bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  };
  const context = buildAdmittedSemanticSourceContext(contextInputs);
  const contractBundle = compileFixtureContract();
  const parserInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope:
      bundle.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: context,
  };
  const parserEnvelope = buildAdmittedParserProposalEnvelope(parserInputs);
  const term = options.term || 'De Minimis Inaccuracies';
  const qxoCandidate = parserEnvelope.definition_candidates.find(
    (candidate) => candidate.neutral_defined_term === term,
  );
  assert.ok(qxoCandidate);

  const text = context.canonical_text.text;
  const declarationStart = text.indexOf(`"${term}" means `);
  assert.ok(declarationStart >= 0);
  const termStart = declarationStart + 1;
  const termEnd = termStart + term.length;
  const bodyStart = text.indexOf(' means ', termEnd) + ' means '.length;
  const bodyEnd = text.indexOf(';', bodyStart);
  const firstOccurrence = text.indexOf(term);
  const nextOccurrence = text.indexOf(term, termEnd);
  const operativeStart = firstOccurrence === termStart
    ? nextOccurrence
    : firstOccurrence;
  assert.ok(operativeStart >= 0 && operativeStart !== termStart);

  const termSpan = spanFromCharacterInterval(context, termStart, termEnd);
  const reviewedUses = [
    {
      span: spanFromCharacterInterval(
        context,
        operativeStart,
        operativeStart + term.length,
      ),
      use_role: 'OPERATIVE_REFERENCE',
    },
    {
      span: termSpan,
      use_role: 'DECLARATION_REFERENCE',
    },
  ].sort((left, right) => (
    left.span.absolute_start - right.span.absolute_start
  )).map((item, sourceOrderOrdinal) => ({
    ...item,
    source_order_ordinal: sourceOrderOrdinal,
  }));
  const acceptedDisposition = buildAcceptedDefinitionCandidateDisposition({
    source: context,
    candidate: qxoCandidate,
    term_span: termSpan,
    body_spans: [spanFromCharacterInterval(context, bodyStart, bodyEnd)],
    use_spans: reviewedUses,
    syntactic_role: 'NESTED_INLINE',
    reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
  });
  const marker = buildNoModelInferenceTranscriptSetMarker({
    semantic_extraction_input_envelope:
      bundle.semantic_extraction_input_envelope,
  });
  const normaliserIdentity = buildDefinitionGraphNormaliserIdentity();
  const reviewedCandidateDispositions = [acceptedDisposition];
  const unresolvedCandidate = parserEnvelope.definition_candidates.find(
    (candidate) => candidate.neutral_defined_term === 'Unreviewed Mechanic',
  );
  if (unresolvedCandidate) {
    reviewedCandidateDispositions.push(
      buildUnresolvedDefinitionCandidateDisposition({
        candidate: unresolvedCandidate,
        review_reason_code: 'PENDING_HUMAN_REVIEW',
        reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
      }),
    );
  }
  const packageInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: parserEnvelope,
    inference_transcript_set_marker: marker,
    reviewed_candidate_dispositions: reviewedCandidateDispositions,
    governed_parent_section_proposal_ids: [
      qxoCandidate.parent_structural_section_proposal_id,
    ],
  };
  return {
    bundle,
    context,
    contractBundle,
    parserEnvelope,
    acceptedDisposition,
    marker,
    normaliserIdentity,
    reviewedCandidateDispositions,
    packageInputs,
  };
}

function assertDeepFrozen(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} is not frozen`);
  Object.entries(value).forEach(([key, child]) => (
    assertDeepFrozen(child, `${path}.${key}`)
  ));
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test('exact admitted QXO inputs reconstruct one deterministic definitions-first package', () => {
  const fixture = admittedFixture();
  const first = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const second = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const graph = first.validated_semantic_graph;

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    first.reviewed_definition_graph_package_id,
    second.reviewed_definition_graph_package_id,
  );
  assert.equal(first.authority_scope, 'OFFLINE_REVIEWED_DEFINITION_GRAPH_ONLY');
  assert.equal(Object.hasOwn(first, 'admitted_semantic_source_context'), false);
  assert.equal(Object.hasOwn(first, 'admitted_parser_proposal_envelope'), false);
  assert.doesNotMatch(canonicalJson(first), /The obligations of Parent/);
  assert.equal(
    first.parser_proposal_reference.admitted_parser_proposal_envelope_id,
    fixture.parserEnvelope.admitted_parser_proposal_envelope_id,
  );
  assert.equal(
    first.inference_transcript_set_marker.transcript_set_marker,
    'NO_MODEL_INFERENCE_USED',
  );
  assert.equal(
    first.normaliser_identity.executable_semantic_closure_digest,
    contentId(
      'DEFINITION_GRAPH_NORMALISER_SEMANTIC_CLOSURE/V1',
      first.normaliser_identity.executable_semantic_closure,
    ),
  );
  const closureModuleKeys = [
    'lib/canonical-v2/admitted-parser-proposal-adapter.js',
    'lib/canonical-v2/admitted-semantic-source.js',
    'lib/canonical-v2/canonical-bytes.js',
    'lib/canonical-v2/contract-bundle.js',
    'lib/canonical-v2/definition-graph.js',
    'lib/canonical-v2/parser-runtime-sandbox.js',
    'lib/canonical-v2/reviewed-definition-graph-package.js',
    'lib/canonical-v2/sec-edgar-intake-capture.js',
    'lib/canonical-v2/sec-html-canonical-text.js',
    'lib/canonical-v2/source-structure.js',
    'lib/edgar-cleanup.js',
    'lib/parser-v2/canonical-structural-definitions.js',
    'lib/parser-v2/canonical-structural-definitions.manifest.json',
    'lib/parser-v2/coverage.js',
    'lib/parser-v2/detectors/defined-terms-toc.js',
    'lib/parser-v2/invariants/enacting-hard-wall.js',
    'lib/parser-v2/regions.js',
    'lib/parser-v2/regions/atomic.js',
    'lib/parser-v2/regions/backmatter.js',
    'lib/parser-v2/regions/definitions.js',
    'lib/parser-v2/regions/double-dummy.js',
    'lib/parser-v2/regions/preamble.js',
    'lib/parser-v2/structural.js',
    'lib/parser-v2/text-layers.js',
    'lib/vocab/resolution/representation-topic-registry.js',
  ];
  assert.deepEqual(
    first.normaliser_identity.executable_semantic_closure.map(
      (entry) => entry.module_key,
    ),
    closureModuleKeys,
  );
  assert.deepEqual(
    first.normaliser_identity.executable_semantic_closure.map(
      (entry) => entry.module_digest,
    ),
    closureModuleKeys.map((moduleKey) => sha256Hex(readFileSync(path.join(
      __dirname,
      '..',
      moduleKey,
    )))),
  );
  assert.deepEqual(
    first.inference_transcript_set_marker.ordered_transcript_ids,
    [],
  );
  assert.equal(graph.definition_cues.length, 1);
  assert.equal(graph.definition_use_cues.length, 2);
  assert.equal(graph.definition_cues[0].raw_term, 'De Minimis Inaccuracies');
  assert.deepEqual(
    graph.definition_use_cues.map((use) => use.use_role),
    ['OPERATIVE_REFERENCE', 'DECLARATION_REFERENCE'],
  );
  assert.equal(
    utf8Slice(
      fixture.context.canonical_text.text,
      graph.definition_cues[0].term_span.absolute_start,
      graph.definition_cues[0].term_span.absolute_end,
    ),
    'De Minimis Inaccuracies',
  );
  assert.deepEqual(first.retained_parser_residual_ids, []);
  assert.equal(first.review_renderable, true);
  assert.equal(first.release_eligible, true);
  assert.equal(validateReviewedDefinitionGraphPackage({
    reviewed_definition_graph_package: first,
    ...fixture.packageInputs,
  }), true);
  assertDeepFrozen(first);
});

test('package and exact external review-input tampering fail closed', () => {
  const fixture = admittedFixture();
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const changedPackage = clone(packageValue);
  changedPackage.validated_semantic_graph.definition_cues[0].raw_term = 'Invented term';
  assert.throws(
    () => validateReviewedDefinitionGraphPackage({
      reviewed_definition_graph_package: changedPackage,
      ...fixture.packageInputs,
    }),
    /package does not match|mismatch/i,
  );

  const changedMarker = clone(fixture.marker);
  changedMarker.transcript_set_marker = 'MODEL_USED_BUT_HIDDEN';
  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      inference_transcript_set_marker: changedMarker,
    }),
    /NO_MODEL_INFERENCE_USED|transcript set/i,
  );

  const changedDisposition = clone(fixture.acceptedDisposition);
  changedDisposition.term_span.absolute_start += 1;
  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      reviewed_candidate_dispositions: [changedDisposition],
    }),
    /span|source|identity/i,
  );

  const changedContext = clone(fixture.context);
  changedContext.canonical_text.text += ' invented source';
  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      admitted_source_context: changedContext,
    }),
    /canonical text|context|lineage|identity/i,
  );
});

test('aggregate nested-item preflight enforces the exact boundary without expansion', () => {
  const span = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: 'a'.repeat(64),
    absolute_start: 0,
    absolute_end: 1,
    semantic_span_id: 'b'.repeat(64),
    exact_bytes_digest: 'c'.repeat(64),
  };
  const use = {
    span,
    use_role: 'OPERATIVE_REFERENCE',
    source_order_ordinal: 0,
  };
  const sharedSpanCarrier = {
    schema_version: 'REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1',
    admitted_definition_candidate_id: 'd'.repeat(64),
    governed_ordinal: 0,
    disposition_code: 'ACCEPTED_DEFINITION_CUE',
    review_reason_code: 'SOURCE_BACKED_SYNTACTIC_DEFINITION',
    reviewer_identity_digest: 'e'.repeat(64),
    raw_term: 'Term',
    syntactic_role: 'NESTED_INLINE',
    term_span: span,
    body_spans: Array(2047).fill(span),
    use_spans: Array(2047).fill(use),
    reviewed_definition_candidate_disposition_id: 'f'.repeat(64),
  };
  const dispositions = Array(4).fill(sharedSpanCarrier);
  assert.equal(preflightReviewedDefinitionGraphPackageBudget({
    scoped_candidate_count: 4,
    reviewed_candidate_dispositions: dispositions,
    parent_scope_count: 4,
    out_of_scope_candidate_count: 0,
    retained_residual_count: 0,
  }), 16384);
  assert.throws(
    () => preflightReviewedDefinitionGraphPackageBudget({
      scoped_candidate_count: 4,
      reviewed_candidate_dispositions: dispositions,
      parent_scope_count: 4,
      out_of_scope_candidate_count: 0,
      retained_residual_count: 1,
    }),
    /aggregate preflight limit/i,
  );

  const multiplicative = Array(4096).fill({
    ...sharedSpanCarrier,
    body_spans: Array(4096).fill(span),
    use_spans: Array(4096).fill(use),
  });
  assert.throws(
    () => preflightReviewedDefinitionGraphPackageBudget({
      scoped_candidate_count: 4096,
      reviewed_candidate_dispositions: multiplicative,
      parent_scope_count: 4096,
      out_of_scope_candidate_count: 0,
      retained_residual_count: 0,
    }),
    /aggregate preflight limit/i,
  );
});

test('normaliser identity is module-derived and caller input or drift is rejected', () => {
  const fixture = admittedFixture();
  assert.throws(
    () => buildDefinitionGraphNormaliserIdentity({
      executable_digest: 'a'.repeat(64),
      configuration_digest: 'b'.repeat(64),
    }),
    /derived from governed module bytes/i,
  );
  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      normaliser_identity: fixture.normaliserIdentity,
    }),
    /cannot be supplied by the package caller/i,
  );

  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const driftedPackage = clone(packageValue);
  driftedPackage.normaliser_identity.executable_semantic_closure[1].module_digest =
    'f'.repeat(64);
  assert.throws(
    () => validateReviewedDefinitionGraphPackage({
      reviewed_definition_graph_package: driftedPackage,
      ...fixture.packageInputs,
    }),
    /does not match|mismatch/i,
  );
});

test('unknown oversized review fields are rejected before their values are serialised', () => {
  const fixture = admittedFixture();
  const changedDisposition = {
    ...fixture.acceptedDisposition,
  };
  const oversizedUnknownValue = {
    payload: 'x'.repeat(1024 * 1024),
    toJSON() {
      throw new Error('oversized unknown value was serialised');
    },
  };
  changedDisposition.oversized_unknown = oversizedUnknownValue;

  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      reviewed_candidate_dispositions: [changedDisposition],
    }),
    (error) => error
      && error.code === 'INVALID_CONTRACT'
      && !/serialised/.test(error.message),
  );
});

test('outer carriers are closed and package bytes are bounded before canonical comparison', () => {
  const fixture = admittedFixture();
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const packageWithUnknown = clone(packageValue);
  let packageUnknownRead = false;
  Object.defineProperty(packageWithUnknown, 'oversized_unknown', {
    enumerable: true,
    get() {
      packageUnknownRead = true;
      throw new Error('package unknown field was read');
    },
  });
  assert.throws(
    () => validateReviewedDefinitionGraphPackage({
      reviewed_definition_graph_package: packageWithUnknown,
      ...fixture.packageInputs,
    }),
    (error) => error && error.code === 'INVALID_CONTRACT',
  );
  assert.equal(packageUnknownRead, false);

  const markerWithUnknown = clone(fixture.marker);
  let markerUnknownRead = false;
  Object.defineProperty(markerWithUnknown, 'oversized_unknown', {
    enumerable: true,
    get() {
      markerUnknownRead = true;
      throw new Error('marker unknown field was read');
    },
  });
  assert.throws(
    () => buildReviewedDefinitionGraphPackage({
      ...fixture.packageInputs,
      inference_transcript_set_marker: markerWithUnknown,
    }),
    (error) => error && error.code === 'INVALID_CONTRACT',
  );
  assert.equal(markerUnknownRead, false);

  const packageWithDriftedConfiguration = clone(packageValue);
  packageWithDriftedConfiguration.normaliser_identity.configuration
    .permitted_output_schemas.push('UNGOVERNED_OUTPUT/V1');
  assert.throws(
    () => validateReviewedDefinitionGraphPackage({
      reviewed_definition_graph_package: packageWithDriftedConfiguration,
      ...fixture.packageInputs,
    }),
    /normaliser_identity\.configuration|normaliser identity/i,
  );

  const oversizedPackage = clone(packageValue);
  oversizedPackage.authority_scope = 'x'.repeat(32 * 1024 * 1024);
  assert.throws(
    () => validateReviewedDefinitionGraphPackage({
      reviewed_definition_graph_package: oversizedPackage,
      ...fixture.packageInputs,
    }),
    (error) => error && error.code === 'PACKAGE_LIMIT_EXCEEDED',
  );
});

test('an unresolved sibling remains review-visible without suppressing the accepted QXO cue', () => {
  const fixture = admittedFixture({ unresolvedSibling: true });
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);

  assert.equal(packageValue.scoped_parser_definition_candidate_ids.length, 2);
  assert.deepEqual(
    packageValue.reviewed_candidate_dispositions.map(
      (disposition) => disposition.disposition_code,
    ),
    ['ACCEPTED_DEFINITION_CUE', 'UNRESOLVED'],
  );
  assert.equal(packageValue.validated_semantic_graph.definition_cues.length, 1);
  assert.equal(
    packageValue.validated_semantic_graph.definition_cues[0].raw_term,
    'De Minimis Inaccuracies',
  );
  assert.equal(packageValue.review_renderable, true);
  assert.equal(packageValue.release_eligible, false);
  assert.equal(validateReviewedDefinitionGraphPackage({
    reviewed_definition_graph_package: packageValue,
    ...fixture.packageInputs,
  }), true);
});

test('a definition use may resolve from another governed section in the same admitted source', () => {
  const fixture = admittedFixture({ crossSectionUse: true });
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const candidate = fixture.parserEnvelope.definition_candidates.find(
    (item) => item.neutral_defined_term === 'De Minimis Inaccuracies',
  );
  const definitionParent = fixture.parserEnvelope.structural_section_proposals.find(
    (section) => section.admitted_structural_section_proposal_id
      === candidate.parent_structural_section_proposal_id,
  );
  const operativeParent = fixture.parserEnvelope.structural_section_proposals.find(
    (section) => section.section_number === '5.02',
  );
  const operativeUse = packageValue.validated_semantic_graph.definition_use_cues.find(
    (use) => use.use_role === 'OPERATIVE_REFERENCE',
  );

  assert.equal(definitionParent.section_number, '1.01');
  assert.equal(
    packageValue.parser_proposal_reference.governed_parent_section_proposal_ids.length,
    1,
  );
  assert.equal(
    packageValue.parser_proposal_reference.governed_parent_section_proposal_ids[0],
    definitionParent.admitted_structural_section_proposal_id,
  );
  assert.ok(
    operativeUse.use_span.absolute_start >= operativeParent.evidence_anchor.absolute_start
      && operativeUse.use_span.absolute_end <= operativeParent.evidence_anchor.absolute_end,
  );
  assert.ok(
    operativeUse.use_span.absolute_start > definitionParent.evidence_anchor.absolute_end,
  );
  assert.equal(packageValue.validated_semantic_graph.definition_cues.length, 1);
  assert.equal(packageValue.validated_semantic_graph.definition_use_cues.length, 2);
  assert.equal(packageValue.review_renderable, true);
});

test('an unrelated exact same-source span cannot become a definition use', () => {
  const fixture = admittedFixture({ crossSectionUse: true });
  const candidate = fixture.parserEnvelope.definition_candidates.find(
    (item) => item.neutral_defined_term === 'De Minimis Inaccuracies',
  );
  const accepted = fixture.acceptedDisposition;
  const unrelatedText = 'capitalization representations';
  const unrelatedStart = fixture.context.canonical_text.text.indexOf(unrelatedText);
  const unrelatedSpan = spanFromCharacterInterval(
    fixture.context,
    unrelatedStart,
    unrelatedStart + unrelatedText.length,
  );
  const declarationUse = accepted.use_spans.find(
    (item) => item.use_role === 'DECLARATION_REFERENCE',
  );

  assert.equal(
    utf8Slice(
      fixture.context.canonical_text.text,
      unrelatedSpan.absolute_start,
      unrelatedSpan.absolute_end,
    ),
    unrelatedText,
  );
  assert.throws(
    () => buildAcceptedDefinitionCandidateDisposition({
      source: fixture.context,
      candidate,
      term_span: accepted.term_span,
      body_spans: accepted.body_spans,
      use_spans: [
        declarationUse,
        {
          span: unrelatedSpan,
          use_role: 'OPERATIVE_REFERENCE',
          source_order_ordinal: 1,
        },
      ],
      syntactic_role: accepted.syntactic_role,
      reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
    }),
    /definition use bytes must equal the accepted raw term/i,
  );
});

test('a raw-term substring inside a longer token cannot become a definition use', () => {
  assert.throws(
    () => admittedFixture({
      crossSectionUse: true,
      term: 'Foo',
      operativeTerm: 'Foobar',
    }),
    /complete defined-term token/i,
  );
});

test('a raw-term prefix followed by a Unicode combining mark is not a complete token', () => {
  assert.throws(
    () => admittedFixture({
      crossSectionUse: true,
      term: 'Cafe',
      operativeTerm: 'Cafe\u0301',
    }),
    /complete defined-term token/i,
  );
});

test('the declaration span is exclusive and every definition-use span is unique', () => {
  const fixture = admittedFixture();
  const candidate = fixture.parserEnvelope.definition_candidates.find(
    (item) => item.neutral_defined_term === 'De Minimis Inaccuracies',
  );
  const accepted = fixture.acceptedDisposition;
  const declarationUse = accepted.use_spans.find(
    (item) => item.use_role === 'DECLARATION_REFERENCE',
  );
  const operativeUse = accepted.use_spans.find(
    (item) => item.use_role === 'OPERATIVE_REFERENCE',
  );

  assert.throws(
    () => buildAcceptedDefinitionCandidateDisposition({
      source: fixture.context,
      candidate,
      term_span: accepted.term_span,
      body_spans: accepted.body_spans,
      use_spans: [
        {
          ...declarationUse,
          source_order_ordinal: 0,
        },
        {
          ...declarationUse,
          use_role: 'OPERATIVE_REFERENCE',
          source_order_ordinal: 1,
        },
      ],
      syntactic_role: accepted.syntactic_role,
      reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
    }),
    /use spans must be unique|declaration term span/i,
  );

  assert.throws(
    () => buildAcceptedDefinitionCandidateDisposition({
      source: fixture.context,
      candidate,
      term_span: accepted.term_span,
      body_spans: accepted.body_spans,
      use_spans: [
        ...accepted.use_spans,
        {
          ...operativeUse,
          source_order_ordinal: 2,
        },
      ],
      syntactic_role: accepted.syntactic_role,
      reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
    }),
    /use spans must be unique|use cue identities must be unique/i,
  );
});

test('definition-use ordinals are contiguous and derived from coordinate order', () => {
  const fixture = admittedFixture();
  const candidate = fixture.parserEnvelope.definition_candidates.find(
    (item) => item.neutral_defined_term === 'De Minimis Inaccuracies',
  );
  const accepted = fixture.acceptedDisposition;
  const reversedOrdinals = accepted.use_spans.map((item) => ({
    ...item,
    source_order_ordinal: accepted.use_spans.length - 1 - item.source_order_ordinal,
  }));

  assert.throws(
    () => buildAcceptedDefinitionCandidateDisposition({
      source: fixture.context,
      candidate,
      term_span: accepted.term_span,
      body_spans: accepted.body_spans,
      use_spans: reversedOrdinals,
      syntactic_role: accepted.syntactic_role,
      reviewer_identity_digest: REVIEWER_IDENTITY_DIGEST,
    }),
    /ordinals must be contiguous and derived from source coordinates/i,
  );
});

test('out-of-scope candidates are retained without blocking the reviewed parent section', () => {
  const fixture = admittedFixture({ outOfScopeSibling: true });
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);

  assert.equal(packageValue.scoped_parser_definition_candidate_ids.length, 1);
  assert.equal(packageValue.out_of_scope_parser_definition_candidate_ids.length, 1);
  assert.equal(packageValue.reviewed_candidate_dispositions.length, 1);
  assert.equal(packageValue.validated_semantic_graph.definition_cues.length, 1);
  assert.equal(packageValue.review_renderable, true);
  assert.equal(packageValue.release_eligible, true);
});

test('retained parser residual identity blocks release without suppressing reviewed output', () => {
  const fixture = admittedFixture({ parserResidual: true });
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);

  assert.ok(packageValue.retained_parser_residual_ids.length > 0);
  assert.deepEqual(
    packageValue.retained_parser_residual_ids,
    fixture.parserEnvelope.residuals
      .map((residual) => residual.admitted_parser_residual_id)
      .sort(),
  );
  assert.equal(packageValue.validated_semantic_graph.definition_cues.length, 1);
  assert.equal(packageValue.review_renderable, true);
  assert.equal(packageValue.release_eligible, false);
});

test('the package fabricates no legal semantics and remains outside writer authority', () => {
  const fixture = admittedFixture();
  const packageValue = buildReviewedDefinitionGraphPackage(fixture.packageInputs);
  const keys = collectKeys(packageValue);

  for (const forbidden of [
    'concept_key',
    'party',
    'claim_state',
    'canonical_value',
    'absence',
    'comparability',
    'market_comparability',
    'claims',
    'relationships',
    'provisions',
    'publication_state',
  ]) {
    assert.equal(keys.has(forbidden), false, `forbidden semantic field ${forbidden}`);
  }
  assert.deepEqual(
    new Set(packageValue.validated_semantic_graph.definition_cues.map(
      (cue) => cue.schema_version,
    )),
    new Set(['DEFINITION_CUE/V1']),
  );
  assert.deepEqual(
    new Set(packageValue.validated_semantic_graph.definition_use_cues.map(
      (use) => use.schema_version,
    )),
    new Set(['DEFINITION_USE_CUE/V1']),
  );
  assert.throws(
    () => validateCanonicalWriteSet(packageValue, fixture.contractBundle),
    /keys outside the fixed contract|writeSet fields do not match/i,
  );
});
