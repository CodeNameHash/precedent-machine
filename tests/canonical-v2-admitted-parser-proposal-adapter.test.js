const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  buildAdmittedParserProposalEnvelope,
  validateAdmittedParserProposalEnvelope,
  validateRuntimeManifest,
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
  validateCanonicalWriteSet,
} = require('../lib/canonical-v2/validate-write-set');
const {
  buildLayers,
} = require('../lib/parser-v2/text-layers');
const {
  detectStructuralDefinitionProposals,
  normaliseStructuralDefinitionProposals,
} = require('../lib/parser-v2/canonical-structural-definitions');
const runtimeManifest = require(
  '../lib/parser-v2/canonical-structural-definitions.manifest.json'
);

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const TRANSFORMED_HTML = `<html><body>
<p>AGREEMENT AND PLAN OF MERGER</p>
<p>ARTICLE I</p><p>DEFINITIONS</p>
<p>Section&nbsp;1.01&nbsp;Defin\u200Bitions.</p>
<p>“Mirror Definition” means £ value with café terms.</p>
<p>Page 7 of 10</p>
<p>“Mirror Definition” means £ value with café terms.</p>
<p>“Business Day” means any day other than Saturday or Sunday.</p>
<p>ARTICLE V</p><p>COVENANTS</p>
<p>Section 5.01 No Solicitation.</p>
<p>The Compa-<br>ny shall not solicit any Acquisition Proposal.</p>
<p>IN WITNESS WHEREOF, the parties have executed this Agreement.</p>
</body></html>`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(html = TRANSFORMED_HTML, label = 'admitted-parser-proposal') {
  const url = `https://www.sec.gov/Archives/edgar/data/1/${label}.htm`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-24T00:00:00.000Z',
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
  const sourceOrdinal = 0;
  const contextInputs = {
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope:
      bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
  };
  const context = buildAdmittedSemanticSourceContext(contextInputs);
  const contractBundle = compileFixtureContract();
  const adapterInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope:
      bundle.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: context,
  };
  return {
    capture,
    conversion,
    verification,
    bundle,
    context,
    contractBundle,
    adapterInputs,
  };
}

function exactEvidenceRows(envelope) {
  return [
    ...envelope.structural_section_proposals,
    ...envelope.definition_candidates,
    ...envelope.residuals.filter((row) => row.evidence_anchor),
  ];
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

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

test('real V2 admission yields exact UTF-8 evidence through parser text transformations', () => {
  const input = fixture();
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);
  const sourceText = input.context.canonical_text.text;
  const cleanText = buildLayers(sourceText).cleanText;

  assert.equal(envelope.authority_scope, 'OFFLINE_NONCANONICAL_PROPOSAL_ONLY');
  assert.equal(envelope.semantic_extraction_input_envelope_id,
    input.bundle.semantic_extraction_input_envelope
      .semantic_extraction_input_envelope_id);
  assert.equal(envelope.diagnostics.examined, true);
  assert.deepEqual(
    envelope.structural_section_proposals.map((row) => row.section_number),
    ['1.01', '5.01'],
  );
  assert.deepEqual(
    envelope.definition_candidates.map((row) => row.neutral_defined_term),
    ['Mirror Definition', 'Mirror Definition', 'Business Day'],
  );

  for (const row of exactEvidenceRows(envelope)) {
    const anchor = row.evidence_anchor;
    assert.equal(
      utf8Slice(
        sourceText,
        anchor.absolute_start,
        anchor.absolute_end,
      ),
      anchor.exact_text,
    );
    assert.equal(
      anchor.exact_bytes_digest,
      sha256Hex(Buffer.from(anchor.exact_text, 'utf8')),
    );
    assert.equal(
      buildLayers(anchor.exact_text).cleanText,
      cleanText.slice(anchor.parser_clean_start, anchor.parser_clean_end),
    );
  }

  const definitions = envelope.structural_section_proposals[0];
  const noShop = envelope.structural_section_proposals[1];
  assert.match(definitions.evidence_anchor.exact_text, /Defin\u200Bitions/);
  assert.match(definitions.evidence_anchor.exact_text, /Page 7 of 10/);
  assert.match(definitions.evidence_anchor.exact_text, /£ value with café terms/);
  assert.match(noShop.evidence_anchor.exact_text, /Compa-\nny/);
  assert.doesNotMatch(
    buildLayers(definitions.evidence_anchor.exact_text).cleanText,
    /Page 7 of 10|\u200B/,
  );
  assert.match(
    buildLayers(noShop.evidence_anchor.exact_text).cleanText,
    /The Company shall not solicit/,
  );
  assert.doesNotMatch(sourceText, /\u00A0/);
  assert.match(
    Buffer.from(input.capture.response_bytes_base64, 'base64').toString('utf8'),
    /&nbsp;/,
  );
});

test('repeated identical definition phrases remain distinct source occurrences', () => {
  const input = fixture();
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);
  const repeated = envelope.definition_candidates.filter(
    (row) => row.neutral_defined_term === 'Mirror Definition',
  );

  assert.equal(repeated.length, 2);
  assert.notEqual(
    repeated[0].evidence_anchor.semantic_span_id,
    repeated[1].evidence_anchor.semantic_span_id,
  );
  assert.notEqual(
    repeated[0].admitted_definition_candidate_id,
    repeated[1].admitted_definition_candidate_id,
  );
  assert.ok(
    repeated[0].evidence_anchor.absolute_start
      < repeated[1].evidence_anchor.absolute_start,
  );
  assert.match(
    repeated[0].evidence_anchor.exact_text,
    /^“Mirror Definition” means £ value with café terms\./,
  );
  assert.match(
    repeated[1].evidence_anchor.exact_text,
    /^“Mirror Definition” means £ value with café terms\./,
  );
});

test('the envelope is deterministic, deeply frozen and exactly revalidated', () => {
  const input = fixture();
  const first = buildAdmittedParserProposalEnvelope(input.adapterInputs);
  const second = buildAdmittedParserProposalEnvelope(input.adapterInputs);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.admitted_parser_proposal_envelope_id,
    second.admitted_parser_proposal_envelope_id);
  assert.equal(validateAdmittedParserProposalEnvelope({
    proposal_envelope: first,
    ...input.adapterInputs,
  }), true);
  assertDeepFrozen(first);
});

test('source, context and returned-carrier mutation fail closed', () => {
  const input = fixture();
  const changedContext = clone(input.context);
  changedContext.canonical_text.text += ' invented source bytes';
  assert.throws(
    () => buildAdmittedParserProposalEnvelope({
      ...input.adapterInputs,
      admitted_source_context: changedContext,
    }),
    /context identity|canonical text|lineage/i,
  );

  const changedEnvelope = clone(
    input.bundle.semantic_extraction_input_envelope,
  );
  changedEnvelope.canonical_text_sha256 = 'f'.repeat(64);
  assert.throws(
    () => buildAdmittedParserProposalEnvelope({
      ...input.adapterInputs,
      semantic_extraction_input_envelope: changedEnvelope,
    }),
    /identity|lineage|canonical text/i,
  );

  const proposalEnvelope = buildAdmittedParserProposalEnvelope(
    input.adapterInputs,
  );
  const changedProposal = clone(proposalEnvelope);
  changedProposal.structural_section_proposals[0]
    .evidence_anchor.exact_text = 'invented evidence';
  assert.throws(
    () => validateAdmittedParserProposalEnvelope({
      proposal_envelope: changedProposal,
      ...input.adapterInputs,
    }),
    (error) => error.code === 'PROPOSAL_ENVELOPE_MISMATCH',
  );
});

test('no detected sections produces a blocking residual and no semantic absence', () => {
  const input = fixture(
    '<html><body><p>Unstructured legal prose only.</p></body></html>',
    'no-structural-sections',
  );
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);
  const keys = collectKeys(envelope);

  assert.equal(envelope.diagnostics.examined, true);
  assert.deepEqual(envelope.structural_section_proposals, []);
  assert.deepEqual(envelope.definition_candidates, []);
  assert.equal(envelope.publication_blocked, true);
  assert.ok(envelope.residuals.some(
    (row) => row.reason_code === 'NO_STRUCTURAL_SECTIONS_DETECTED',
  ));
  for (const forbidden of [
    'state',
    'claim_state',
    'canonical_value',
    'concept_key',
    'canonical_concept_key',
    'party',
    'market_comparability',
    'disposition_code',
  ]) {
    assert.equal(keys.has(forbidden), false, `forbidden semantic field ${forbidden}`);
  }
  assert.doesNotMatch(
    canonicalJson(envelope),
    /"ABSENT"|"NOT_APPLICABLE"/,
  );
});

test('a natural structural residual does not suppress valid sibling proposals', () => {
  const input = fixture();
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);

  assert.equal(envelope.publication_blocked, true);
  assert.ok(envelope.residuals.some(
    (row) => row.reason_code === 'UNCLASSIFIED_STRUCTURAL_REGION',
  ));
  assert.equal(envelope.structural_section_proposals.length, 2);
  assert.equal(envelope.definition_candidates.length, 3);
});

test('the governed source byte limit rejects limit plus one before parsing', () => {
  const oversizedText = '😀'.repeat(Math.floor(MAX_SOURCE_BYTES / 4) + 1);
  const input = fixture(
    `<html><body>${oversizedText}</body></html>`,
    'source-limit-plus-one',
  );

  assert.equal(
    input.context.canonical_text_byte_length,
    MAX_SOURCE_BYTES + 4,
  );
  assert.throws(
    () => buildAdmittedParserProposalEnvelope(input.adapterInputs),
    (error) => error.code === 'SOURCE_LIMIT_EXCEEDED',
  );
});

test('the offline proposal carrier is rejected by canonical write-set validation', () => {
  const input = fixture();
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);

  assert.throws(
    () => validateCanonicalWriteSet(envelope, input.contractBundle),
    /keys outside the fixed contract|writeSet fields do not match|source contract/i,
  );
});

test('the pure detector enforces collection bounds and the runtime invokes no network authority', () => {
  const input = fixture();
  const cleanText = buildLayers(input.context.canonical_text.text).cleanText;
  assert.throws(() => detectStructuralDefinitionProposals(cleanText, {
    max_sections: 1,
    max_definitions: 16384,
    max_residuals: 4096,
    max_total_candidates: 16384,
  }), /structural (?:heading signal )?count exceeds/i);

  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network authority invoked');
  };
  try {
    const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);
    assert.equal(envelope.diagnostics.examined, true);
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('one malformed structural child becomes a residual while its valid sibling survives', () => {
  const cleanText = 'Section 1.01. Valid provision.'.padEnd(120, ' ');
  const detected = normaliseStructuralDefinitionProposals({
    cleanText,
    governedLimits: runtimeManifest.governed_limits,
    parsed: {
      sections: [
        {
          number: '1.01',
          title: 'Valid provision',
          startChar: 0,
          endChar: 31,
          regionType: 'body.section.provision',
          atomic: false,
          definitionCompletenessWarnings: [],
        },
        {
          number: '1.02',
          title: 'Malformed provision',
          startChar: 500,
          endChar: 600,
          regionType: 'body.section.provision',
          atomic: false,
          definitionCompletenessWarnings: [],
        },
      ],
      regions: [],
      diagnostics: {
        bodyStart: 0,
        bodyEnd: 31,
        totalArticles: 1,
        delimiter: 'fallback',
        gaps: [],
        regionCoverageGaps: [],
        regionCoverageOverlaps: [],
      },
    },
  });

  assert.equal(detected.sections.length, 1);
  assert.equal(detected.sections[0].section_number, '1.01');
  assert.deepEqual(detected.candidate_failures, [{
    candidate_kind: 'STRUCTURAL_SECTION',
    reason_code: 'INVALID_STRUCTURAL_SECTION',
    producer_ordinal: 1,
    clean_start: 500,
    clean_end: 600,
  }]);
  assert.equal(detected.diagnostics.candidate_failure_count, 1);
});

test('runtime manifest validation rejects ungoverned paths and inflated limits', () => {
  const inflated = clone(runtimeManifest);
  inflated.governed_limits.max_source_bytes += 1;
  const inflatedBody = { ...inflated };
  delete inflatedBody.parser_runtime_manifest_id;
  inflated.parser_runtime_manifest_id = contentId(
    'PARSER_V2_RUNTIME_MANIFEST/V1',
    inflatedBody,
  );
  assert.throws(() => validateRuntimeManifest(inflated), /limits/i);

  const escaped = clone(runtimeManifest);
  escaped.local_modules[0].path = 'pages/api/canonical-writer.js';
  escaped.local_modules.sort((left, right) => left.path.localeCompare(right.path));
  const escapedBody = { ...escaped };
  delete escapedBody.parser_runtime_manifest_id;
  escaped.parser_runtime_manifest_id = contentId(
    'PARSER_V2_RUNTIME_MANIFEST/V1',
    escapedBody,
  );
  assert.throws(() => validateRuntimeManifest(escaped), /closure|manifest/i);
});

test('repeated cached anchors are charged before envelope serialisation', () => {
  const definitions = Array.from(
    { length: 50 },
    (_, index) => `“Term ${index}” means ${'x'.repeat(10000)} (b) item`,
  ).join('; ');
  const input = fixture(
    `<html><body>
      <p>AGREEMENT AND PLAN OF MERGER</p>
      <p>ARTICLE I</p><p>DEFINITIONS</p>
      <p>Section 1.01 Definitions. ${definitions}</p>
      <p>IN WITNESS WHEREOF</p>
    </body></html>`,
    'repeated-anchor-budget',
  );
  const envelope = buildAdmittedParserProposalEnvelope(input.adapterInputs);
  const encodedBytes = Buffer.byteLength(canonicalJson(envelope), 'utf8');

  assert.ok(encodedBytes <= runtimeManifest.governed_limits.max_envelope_bytes);
  assert.ok(
    envelope.diagnostics.emitted_evidence_byte_count
      <= runtimeManifest.governed_limits.max_envelope_bytes,
  );
  assert.ok(envelope.residuals.some((row) => row.evidence_anchor));
  assert.ok(envelope.residuals.some((row) => !row.evidence_anchor));
});
