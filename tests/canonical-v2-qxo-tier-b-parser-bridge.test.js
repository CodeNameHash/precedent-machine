const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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
  buildNoModelInferenceTranscriptSetMarker,
  buildReviewedDefinitionGraphPackage,
} = require('../lib/canonical-v2/reviewed-definition-graph-package');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const {
  MAX_SEED_BYTES,
  buildQxoTierBParserBoundReviewSeed,
  buildQxoTierBParserBoundReviewSeedIsolated,
  findExactObservedPartyToken,
  validateQxoTierBParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-tier-b-parser-bridge');
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
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

const capitalText = fs.readFileSync('tests/fixtures/qxo-section-3-1-b.txt', 'utf8');
const contractBundle = compileFixtureContract();
const reviewerIdentityDigest = sha256Hex('QXO_TIER_B_PARSER_BRIDGE_REVIEWER/V1');
const fixtureCache = new Map();

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

function paragraphs(value) {
  return value.split('\n')
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function sourceHtml({
  prefixFillerLength,
  middleFillerLength,
  parserResidual,
}) {
  const qxoLines = QXO_5_2_TEXT.split('\n');
  const qxoParagraphs = [
    `<p>${escapeHtml(qxoLines[0])}</p>`,
    ...qxoLines.slice(1).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join('');
  return `<html><body>
<p>AGREEMENT AND PLAN OF MERGER</p>
${parserResidual ? '<p>Unassigned legal material before the first governed article.</p>' : ''}
<p>ARTICLE I</p>
<p>GENERAL</p>
<p>Section 1.1 Preliminary Provision.</p>
${prefixFillerLength ? `<p>${'P'.repeat(prefixFillerLength)}</p>` : ''}
<p>ARTICLE III</p>
<p>REPRESENTATIONS AND WARRANTIES</p>
<p>Section 3.1 Representations and Warranties.</p>
${paragraphs(capitalText)}
${middleFillerLength ? `<p>${'M'.repeat(middleFillerLength)}</p>` : ''}
<p>ARTICLE V</p>
<p>CONDITIONS</p>
${qxoParagraphs}
<p>${'\u200b'.repeat(25)}</p>
<p>Section 5.3 Other Condition.</p>
<p>IN WITNESS WHEREOF</p>
</body></html>`;
}

function captureForHtml(html, label) {
  const url = `https://www.sec.gov/Archives/edgar/data/1/${label}.htm`;
  return buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-24T00:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html, 'utf8'),
  });
}

function convertedText(html) {
  return convertSecHtmlToCanonicalText(captureForHtml(html, 'qxo-tier-b-calibration'))
    .canonical_text;
}

function byteOffset(text, characterOffset) {
  return Buffer.byteLength(text.slice(0, characterOffset), 'utf8');
}

function calibratedHtml(parserResidual) {
  const baseHtml = sourceHtml({
    prefixFillerLength: 0,
    middleFillerLength: 0,
    parserResidual,
  });
  const baseText = convertedText(baseHtml);
  const capitalCharacterOffset = baseText.indexOf(capitalText);
  assert.ok(capitalCharacterOffset >= 0);
  const prefixFillerLength = CAPITAL_STRUCTURE_INTERVAL.start
    - byteOffset(baseText, capitalCharacterOffset) - 1;
  assert.ok(prefixFillerLength > 0);

  const prefixHtml = sourceHtml({
    prefixFillerLength,
    middleFillerLength: 0,
    parserResidual,
  });
  const prefixText = convertedText(prefixHtml);
  const qxoCharacterOffset = prefixText.indexOf('5.2Additional Conditions');
  assert.ok(qxoCharacterOffset >= 0);
  const middleFillerLength = SECTION_5_2_INTERVAL.start
    - byteOffset(prefixText, qxoCharacterOffset) - 1;
  assert.ok(middleFillerLength > 0);
  return sourceHtml({
    prefixFillerLength,
    middleFillerLength,
    parserResidual,
  });
}

function spanForByteInterval(source, start, end) {
  return buildSemanticSpan(source, start, end);
}

function exactTermIntervals(source, term) {
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');
  const token = Buffer.from(term, 'utf8');
  const intervals = [];
  let offset = SECTION_5_2_INTERVAL.start;
  while (offset < SECTION_5_2_INTERVAL.end) {
    const start = bytes.indexOf(token, offset);
    if (start < 0 || start >= SECTION_5_2_INTERVAL.end) break;
    intervals.push({ start, end: start + token.length });
    offset = start + token.length;
  }
  return intervals;
}

function admittedFixture({ parserResidual = false } = {}) {
  const cacheKey = parserResidual ? 'residual' : 'clean';
  if (fixtureCache.has(cacheKey)) return fixtureCache.get(cacheKey);

  const html = calibratedHtml(parserResidual);
  const capture = captureForHtml(html, `qxo-tier-b-${cacheKey}`);
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admission = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const governedDealKey = 'deal:qxo-topbuild';
  const dealAdmissionId = contentId(
    'DEAL_ADMISSION/V2',
    `qxo-tier-b-parser-bridge:${cacheKey}`,
  );
  const contextInputs = {
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  };
  const context = buildAdmittedSemanticSourceContext(contextInputs);
  assert.equal(
    byteOffset(context.canonical_text.text, context.canonical_text.text.indexOf(capitalText)),
    CAPITAL_STRUCTURE_INTERVAL.start,
  );
  assert.equal(
    byteOffset(
      context.canonical_text.text,
      context.canonical_text.text.indexOf('5.2Additional Conditions'),
    ),
    SECTION_5_2_INTERVAL.start,
  );

  const parserInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: context,
  };
  const parserEnvelope = buildAdmittedParserProposalEnvelope(parserInputs);
  const candidate = parserEnvelope.definition_candidates.find(
    (item) => item.neutral_defined_term === 'De Minimis Inaccuracies',
  );
  assert.ok(candidate);

  const term = 'De Minimis Inaccuracies';
  const termIntervals = exactTermIntervals(context, term);
  assert.equal(termIntervals.length, 2);
  const [operativeInterval, declarationInterval] = termIntervals;
  const sourceBytes = Buffer.from(context.canonical_text.text, 'utf8');
  const bodyPrefix = Buffer.from('" means ', 'utf8');
  const declarationBodyPrefixStart = sourceBytes.indexOf(
    bodyPrefix,
    declarationInterval.end,
  );
  assert.equal(declarationBodyPrefixStart, declarationInterval.end);
  const bodyStart = declarationBodyPrefixStart + bodyPrefix.length;
  const bodyEnd = sourceBytes.indexOf(Buffer.from(';', 'utf8'), bodyStart);
  assert.ok(bodyEnd > bodyStart);
  const acceptedDisposition = buildAcceptedDefinitionCandidateDisposition({
    source: context,
    candidate,
    term_span: spanForByteInterval(
      context,
      declarationInterval.start,
      declarationInterval.end,
    ),
    body_spans: [spanForByteInterval(context, bodyStart, bodyEnd)],
    use_spans: [
      {
        span: spanForByteInterval(
          context,
          operativeInterval.start,
          operativeInterval.end,
        ),
        use_role: 'OPERATIVE_REFERENCE',
        source_order_ordinal: 0,
      },
      {
        span: spanForByteInterval(
          context,
          declarationInterval.start,
          declarationInterval.end,
        ),
        use_role: 'DECLARATION_REFERENCE',
        source_order_ordinal: 1,
      },
    ],
    syntactic_role: 'NESTED_INLINE',
    reviewer_identity_digest: reviewerIdentityDigest,
  });
  const marker = buildNoModelInferenceTranscriptSetMarker({
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
  });
  const packageInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: parserEnvelope,
    inference_transcript_set_marker: marker,
    reviewed_candidate_dispositions: [acceptedDisposition],
    governed_parent_section_proposal_ids: [
      candidate.parent_structural_section_proposal_id,
    ],
  };
  const definitionPackage = buildReviewedDefinitionGraphPackage(packageInputs);
  const capitalisationSlice = buildQxoReviewedCapitalisationSlice({
    sourceContext: context,
    contractBundle,
  });
  const bridgeInputs = {
    ...packageInputs,
    reviewed_definition_graph_package: definitionPackage,
    reviewed_capitalisation_slice: capitalisationSlice,
  };
  const fixture = {
    context,
    parserEnvelope,
    definitionPackage,
    capitalisationSlice,
    bridgeInputs,
  };
  fixtureCache.set(cacheKey, fixture);
  return fixture;
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
  Object.entries(value).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys);
  });
  return keys;
}

test('builds one deterministic compact and deeply frozen parser-bound review seed', () => {
  const fixture = admittedFixture();
  const first = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);
  const second = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: first,
      ...fixture.bridgeInputs,
    }),
    true,
  );
  assert.ok(Buffer.byteLength(canonicalJson(first), 'utf8') < MAX_SEED_BYTES);
  assertDeepFrozen(first);
});

test('binds exact Section 3.1 limbs, Section 5.2 Tier B, and the nested definition graph', () => {
  const fixture = admittedFixture();
  const seed = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);
  const slice = fixture.capitalisationSlice;

  assert.deepEqual(seed.composition_binding.ordered_target_component_ids, [
    slice.components[0].provision_component_id,
    slice.components[2].provision_component_id,
  ]);
  assert.ok(slice.components[0].absolute_end < slice.components[2].absolute_start);
  assert.equal(
    seed.composition_binding.accuracy_claim_revision_id,
    slice.accuracyClaims[0].claim_revision_id,
  );
  assert.equal(
    seed.composition_binding.exception_claim_revision_id,
    slice.exceptionClaim.claim_revision_id,
  );
  assert.equal(
    seed.composition_binding.brings_down_relationship_revision_id,
    slice.relationships[0].relationship_revision_id,
  );
  assert.deepEqual(
    seed.withheld_legacy_claim_references.map((item) => item.claim_revision_id),
    [slice.knowledgeClaims[0], slice.knowledgeClaims[2]]
      .map((claim) => claim.claim_revision_id),
  );
  assert.equal(
    seed.reviewed_definition_binding.definition_cue_id,
    fixture.definitionPackage.validated_semantic_graph.definition_cues[0]
      .definition_cue_id,
  );
  assert.equal(
    seed.reviewed_definition_binding.relationship_authority,
    'NONE_PENDING_FREEZE_GATE',
  );
});

test('retains exact buyer-side party tokens without collapsing the merger subsidiaries into Parent', () => {
  const fixture = admittedFixture();
  const seed = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);
  const expected = new Map([
    ['PARENT', 'Parent'],
    ['TITANIUM_MERGER_SUB', 'Titanium Merger Sub'],
    ['FORWARD_MERGER_SUB', 'Forward Merger Sub'],
  ]);

  assert.deepEqual(seed.party_observations.map((item) => item.token_key), [
    'PARENT',
    'TITANIUM_MERGER_SUB',
    'FORWARD_MERGER_SUB',
  ]);
  seed.party_observations.forEach((observation) => {
    assert.equal(
      utf8Slice(
        fixture.context.canonical_text.text,
        observation.token_span.absolute_start,
        observation.token_span.absolute_end,
      ),
      expected.get(observation.token_key),
    );
  });
  assert.equal(seed.party_observations[0].assigned_party_value, 'PARENT');
  assert.deepEqual(
    seed.party_observations.slice(1).map((item) => [
      item.allocation_status,
      item.assigned_party_value,
    ]),
    [
      ['OBSERVED_UNASSIGNED', null],
      ['OBSERVED_UNASSIGNED', null],
    ],
  );
});

test('carries no serving, cohort, release or canonical-write authority', () => {
  const fixture = admittedFixture();
  const seed = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);
  const keys = collectKeys(seed);

  assert.equal(seed.authority_scope, 'REVIEW_ONLY_REFERENCE_SEED');
  assert.deepEqual(seed.contract_binding, {
    schema_version: contractBundle.schema_version,
    contract_key: contractBundle.contract_key,
    contract_fingerprint: contractBundle.fingerprint,
  });
  assert.deepEqual(seed.intended_projection, {
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    projection_status: 'FUTURE_GOVERNED_INTENT_ONLY',
  });
  assert.deepEqual(seed.status, {
    review_renderable: true,
    comparability_state: 'NOT_CERTIFIED',
    query_authority: 'NONE',
    cohort_authority: 'NONE',
    serving_projection_authority: 'NONE',
    release_eligible: false,
    failure_isolation: 'SUPPRESS_THIS_SEED_ONLY',
    blocker_codes: [
      'ABSENCE_SCOPE_NOT_CERTIFIED',
      'ADDITIONAL_CONDITION_PARTY_ROLES_OUT_OF_SCOPE',
      'DEFINITION_CONCEPT_FREEZE_GATE_REQUIRED',
      'PARSER_RESIDUAL_RETAINED',
      'QUERY_METRIC_CONTRACT_REQUIRED',
      'RESULT_INPUT_LINEAGE_CONTRACT_REQUIRED',
      'USES_DEFINITION_EFFECT_CONTRACT_REQUIRED',
    ],
  });
  for (const forbidden of [
    'canonical_value',
    'cohort',
    'corpus_release_id',
    'exact_text',
    'market_observation',
    'metric_slot_key',
    'raw_value',
    'result_inputs',
    'serving_namespace_id',
    'uses_definition_relationship_revision_id',
  ]) {
    assert.equal(keys.has(forbidden), false, `forbidden seed field: ${forbidden}`);
  }
  assert.throws(
    () => validateCanonicalWriteSet(seed, contractBundle),
    /keys outside the fixed contract/i,
  );
});

test('source, parser, definition, composition and seed drift all fail closed', () => {
  const fixture = admittedFixture();
  const seed = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);

  const changedSeed = clone(seed);
  changedSeed.status.comparability_state = 'COMPARABLE';
  assert.throws(
    () => validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: changedSeed,
      ...fixture.bridgeInputs,
    }),
    /seed has drifted/i,
  );

  const changedContractBinding = clone(seed);
  changedContractBinding.contract_binding.contract_fingerprint = 'f'.repeat(64);
  assert.throws(
    () => validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: changedContractBinding,
      ...fixture.bridgeInputs,
    }),
    /seed has drifted/i,
  );

  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      unknown_review_payload: {
        substantive_legal_proposition: 'must not be discarded',
      },
    }),
    /input is outside its closed contract/i,
  );

  const seedWithUnknown = clone(seed);
  seedWithUnknown.unreviewed_authority = true;
  assert.throws(
    () => validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: seedWithUnknown,
      ...fixture.bridgeInputs,
    }),
    /closed contract/i,
  );

  const oversizedSeed = clone(seed);
  oversizedSeed.status.blocker_codes.push('X'.repeat(MAX_SEED_BYTES));
  assert.throws(
    () => validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: oversizedSeed,
      ...fixture.bridgeInputs,
    }),
    /exceeds 16 KiB/i,
  );

  const oversizedNestedKeySeed = clone(seed);
  oversizedNestedKeySeed.status[`oversized_${'K'.repeat(MAX_SEED_BYTES)}`] = true;
  assert.throws(
    () => validateQxoTierBParserBoundReviewSeed({
      qxo_tier_b_parser_bound_review_seed: oversizedNestedKeySeed,
      ...fixture.bridgeInputs,
    }),
    /exceeds 16 KiB/i,
  );

  const changedContext = clone(fixture.context);
  changedContext.canonical_text.text = changedContext.canonical_text.text.replace(
    '250,000,000',
    '250,000,001',
  );
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      admitted_source_context: changedContext,
    }),
    /canonical text|context|identity/i,
  );

  const changedParser = clone(fixture.parserEnvelope);
  const section52 = changedParser.structural_section_proposals.find(
    (proposal) => proposal.section_number === '5.2',
  );
  section52.evidence_anchor.absolute_end -= 1;
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      admitted_parser_proposal_envelope: changedParser,
    }),
    /parser proposal envelope|mismatch/i,
  );

  const changedDefinitionPackage = clone(fixture.definitionPackage);
  changedDefinitionPackage.validated_semantic_graph.definition_use_cues[0]
    .use_role = 'DECLARATION_REFERENCE';
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      reviewed_definition_graph_package: changedDefinitionPackage,
    }),
    /definition|package|mismatch/i,
  );

  const changedSlice = clone(fixture.capitalisationSlice);
  changedSlice.relationships[0].target_occurrence_ids.reverse();
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      reviewed_capitalisation_slice: changedSlice,
    }),
    /capitalisation mapping is invalid/i,
  );
});

test('a failed Tier B bridge suppresses only this seed and leaves sibling review rows available', () => {
  const fixture = admittedFixture();
  const siblingRows = Object.freeze([
    Object.freeze({ row_id: 'proxy-filing', review_renderable: true }),
    Object.freeze({ row_id: 'meeting', review_renderable: true }),
  ]);
  const changedSlice = clone(fixture.capitalisationSlice);
  changedSlice.relationships[0].target_occurrence_ids.reverse();
  const outcome = buildQxoTierBParserBoundReviewSeedIsolated({
    ...fixture.bridgeInputs,
    reviewed_capitalisation_slice: changedSlice,
  });

  assert.deepEqual(outcome, {
    schema_version: 'QXO_TIER_B_PARSER_BOUND_REVIEW_SEED_OUTCOME/V1',
    suppressed: true,
    failure_code: 'REVIEWED_MAPPING_INVALID',
    seed: null,
  });
  assert.deepEqual(siblingRows.map((row) => row.review_renderable), [true, true]);
  assertDeepFrozen(outcome);

  assert.throws(
    () => buildQxoTierBParserBoundReviewSeedIsolated({
      ...fixture.bridgeInputs,
      unknown_review_payload: true,
    }),
    /input is outside its closed contract/i,
  );

  const changedContext = clone(fixture.context);
  changedContext.canonical_text.text += 'global integrity drift';
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeedIsolated({
      ...fixture.bridgeInputs,
      admitted_source_context: changedContext,
    }),
    /canonical text|context|identity/i,
  );
});

test('an unrelated retained parser residual blocks release but not this review seed', () => {
  const fixture = admittedFixture({ parserResidual: true });
  assert.ok(fixture.parserEnvelope.residuals.length > 0);
  const seed = buildQxoTierBParserBoundReviewSeed(fixture.bridgeInputs);

  assert.equal(
    seed.parser_binding.retained_parser_residual_summary.count,
    fixture.parserEnvelope.residuals.length,
  );
  assert.equal(
    seed.parser_binding.retained_parser_residual_summary.release_blocked,
    true,
  );
  assert.match(
    seed.parser_binding.retained_parser_residual_summary
      .source_envelope_binding_digest,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(seed.status.review_renderable, true);
  assert.equal(seed.status.release_eligible, false);
  assert.equal(seed.status.blocker_codes.includes('PARSER_RESIDUAL_RETAINED'), true);

  const overLimitParser = clone(fixture.parserEnvelope);
  overLimitParser.residuals = Array.from(
    { length: 4097 },
    () => fixture.parserEnvelope.residuals[0],
  );
  assert.throws(
    () => buildQxoTierBParserBoundReviewSeed({
      ...fixture.bridgeInputs,
      admitted_parser_proposal_envelope: overLimitParser,
    }),
    /residual collection exceeds its governed limit/i,
  );
});

test('party-token selection rejects longer-token and duplicate collisions', () => {
  assert.equal(
    findExactObservedPartyToken(
      'Additional Conditions to Parent, Titanium Merger Sub and Forward Merger Sub',
      'Parent',
      ', ',
    ),
    25,
  );
  assert.throws(
    () => findExactObservedPartyToken(
      'Additional Conditions to ParentCo, Titanium Merger Sub and Forward Merger Sub',
      'Parent',
      ', ',
    ),
    /one exact bounded Parent token/i,
  );
  assert.throws(
    () => findExactObservedPartyToken(
      'Additional Conditions to Parent, Parent, Titanium Merger Sub',
      'Parent',
      ', ',
    ),
    /one exact bounded Parent token/i,
  );
  assert.throws(
    () => findExactObservedPartyToken(
      'Additional Conditions to Parent, Titanium Merger Sub II and Forward Merger Sub',
      'Titanium Merger Sub',
      ' and ',
    ),
    /one exact bounded Titanium Merger Sub token/i,
  );
});
