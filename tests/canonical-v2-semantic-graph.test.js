const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
  validateValidatedDefinitionGraph,
  validateValidatedDefinitionGraphIdentity,
} = require('../lib/canonical-v2/definition-graph');
const {
  CLAIM_STATES,
  buildClaimRevision,
  buildRelationshipRevision,
  validateClaimRevisionIdentity,
} = require('../lib/canonical-v2/claims-relationships');
const {
  buildImmutableSource,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const fixtureDir = path.join(__dirname, 'fixtures', 'canonical-v2');
const sourceText = fs.readFileSync(path.join(fixtureDir, 'foundation-source.txt'), 'utf8').replace(/\n$/, '');
const reviewed = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'foundation-reviewed-payload.json'), 'utf8'));

const source = buildImmutableSource({
  sourceBytes: sourceText,
  sourceKind: 'PLAIN_UTF8',
  sourceOccurrenceKey: 'QXO_5_2_FOUNDATION',
});

function span([absolute_start, absolute_end]) {
  return buildSemanticSpan(source, absolute_start, absolute_end);
}

function occurrenceId(kind, value) {
  return contentId(`${kind}/V1`, value);
}

function evidenceForSpan(sourceSpan, evidenceRole, documentOrdinal = 0) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: sourceSpan.semantic_span_id,
    document_ordinal: documentOrdinal,
    absolute_start: sourceSpan.absolute_start,
    absolute_end: sourceSpan.absolute_end,
  };
}

function syntheticEvidence(value, evidenceRole = 'OPERATIVE_TEXT', absoluteStart = 0) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: occurrenceId('EXCERPT', value),
    document_ordinal: 0,
    absolute_start: absoluteStart,
    absolute_end: absoluteStart + 1,
  };
}

test('the foundation fixture is the exact existing QXO Section 5.2 text', () => {
  assert.equal(sourceText, QXO_5_2_TEXT);
  assert.equal(sourceText.length, reviewed.source.expected_text_length);
  assert.deepEqual(reviewed.limitations, [
    'The referenced Section 3.1 source is not part of this fixture.',
    'This fixture does not establish the complete vertical slice or a releasable corpus result.',
  ]);
});

test('definition-first graph retains one concept-free nested cue and both reviewed use spans', () => {
  const termSpan = span(reviewed.definition.term_span);
  const cue = buildDefinitionCue({
    source,
    termSpan,
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: reviewed.definition.syntactic_role,
  });
  const uses = reviewed.definition.use_spans.map((item, ordinal) => buildDefinitionUseCue({
    source,
    definitionCue: cue,
    useSpan: span(item.span),
    useRole: item.role,
    ordinal,
  }));
  const graph = buildValidatedDefinitionGraph({ source, definitionCues: [cue], definitionUseCues: uses });

  assert.equal(Object.hasOwn(cue, 'concept_key'), false);
  assert.equal(sourceText.slice(termSpan.absolute_start, termSpan.absolute_end), 'De Minimis Inaccuracies');
  assert.equal(graph.definition_cues.length, 1);
  assert.equal(graph.definition_use_cues.length, 2);
  assert.deepEqual(graph.definition_use_cues.map((item) => item.use_role), [
    'OPERATIVE_REFERENCE',
    'DECLARATION_REFERENCE',
  ]);
});

test('definition cues reject mismatched term bytes and spans from another immutable source', () => {
  const otherSource = buildImmutableSource({
    sourceBytes: 'De Minimis Inaccuracies',
    sourceOccurrenceKey: 'OTHER_DEFINITION_SOURCE',
  });
  const termSpan = span(reviewed.definition.term_span);
  assert.throws(() => buildDefinitionCue({
    source,
    termSpan,
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: 'Different Term',
    syntacticRole: reviewed.definition.syntactic_role,
  }), /rawTerm must equal/);
  assert.throws(() => buildDefinitionCue({
    source,
    termSpan: buildSemanticSpan(otherSource, 0, 23),
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: reviewed.definition.syntactic_role,
  }), /another canonical text/);
  assert.throws(() => buildDefinitionCue({
    source,
    termSpan,
    bodySpans: [span([0, 3])],
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: reviewed.definition.syntactic_role,
  }), /must follow the term/);
});

test('validated graphs rebuild from admitted bytes and reject drift, unknown uses and duplicates', () => {
  const cue = buildDefinitionCue({
    source,
    termSpan: span(reviewed.definition.term_span),
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: reviewed.definition.syntactic_role,
  });
  const use = buildDefinitionUseCue({
    source,
    definitionCue: cue,
    useSpan: span(reviewed.definition.use_spans[0].span),
    useRole: reviewed.definition.use_spans[0].role,
  });
  const graph = buildValidatedDefinitionGraph({
    source,
    definitionCues: [cue],
    definitionUseCues: [use],
  });
  assert.equal(validateValidatedDefinitionGraph({ source, graph }), true);
  assert.equal(validateValidatedDefinitionGraphIdentity({ graph }), true);

  const drifted = structuredClone(graph);
  drifted.definition_cues[0].term_span.exact_bytes_digest = occurrenceId('DRIFT', 'term');
  assert.throws(
    () => validateValidatedDefinitionGraph({ source, graph: drifted }),
    /exact source bytes|identity/,
  );
  const resignedDrift = structuredClone(graph);
  resignedDrift.definition_cues[0].raw_term = 'Invented term';
  resignedDrift.definition_cues[0].raw_term_digest = contentId('RAW_DEFINITION_TERM/V1', 'Invented term');
  resignedDrift.definition_cues[0].definition_cue_id = contentId('DEFINITION_CUE/V1', {
    document_hash: resignedDrift.definition_cues[0].document_hash,
    canonical_text_id: resignedDrift.definition_cues[0].canonical_text_id,
    source_anchor_id: resignedDrift.definition_cues[0].source_anchor_id,
    term_span_id: resignedDrift.definition_cues[0].term_span_id,
    body_span_ids: resignedDrift.definition_cues[0].body_span_ids,
    raw_term_digest: resignedDrift.definition_cues[0].raw_term_digest,
    syntactic_role: resignedDrift.definition_cues[0].syntactic_role,
    source_order_ordinal: resignedDrift.definition_cues[0].source_order_ordinal,
  });
  assert.throws(
    () => validateValidatedDefinitionGraphIdentity({ graph: resignedDrift }),
    /identity|children/,
  );
  assert.throws(() => buildValidatedDefinitionGraph({
    source,
    definitionCues: [cue],
    definitionUseCues: [{ ...use, definition_cue_id: occurrenceId('DEFINITION_CUE', 'unknown') }],
  }), /unknown DefinitionCue/);
  assert.throws(() => buildValidatedDefinitionGraph({
    source,
    definitionCues: [cue],
    definitionUseCues: [use, use],
  }), /duplicate DefinitionUseCue/);
  assert.throws(() => buildValidatedDefinitionGraph({
    source,
    definitionCues: [cue, cue],
    definitionUseCues: [use],
  }), /duplicate DefinitionCue/);
  assert.throws(() => buildDefinitionUseCue({
    source,
    definitionCue: cue,
    useSpan: span(reviewed.definition.use_spans[0].span),
    useRole: 'INVENTED_USE_ROLE',
  }), /useRole/);
  assert.throws(() => buildDefinitionCue({
    source,
    termSpan: span(reviewed.definition.term_span),
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: 'INVENTED_CUE_ROLE',
  }), /syntacticRole/);

  const otherSource = buildImmutableSource({
    sourceBytes: `${sourceText} changed`,
    sourceOccurrenceKey: 'DRIFTED_DEFINITION_SOURCE',
  });
  assert.throws(
    () => validateValidatedDefinitionGraph({ source: otherSource, graph }),
    /another canonical text|another immutable source|admitted source|identity/,
  );
});

test('four reviewed QXO tiers become typed claims and unresolved BRINGS_DOWN relationships without fabricating Section 3.1 source', () => {
  const accuracyCodes = reviewed.tiers.map((tier) => tier.standard);
  const claims = reviewed.tiers.map((tier, ordinal) => {
    const tierSpan = span(tier.span);
    const tierOccurrenceId = occurrenceId('CONDITION_TIER_OCCURRENCE', {
      document_hash: source.document_hash,
      span_id: tierSpan.semantic_span_id,
      tier_key: tier.key,
    });
    return buildClaimRevision({
      subject_occurrence_id: tierOccurrenceId,
      claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      ordinal,
      state: 'PRESENT',
      raw_value: sourceText.slice(tierSpan.absolute_start, tierSpan.absolute_end),
      canonical_value: tier.standard,
      taxonomy_codes: { accuracy_standard: tier.standard },
      codebooks: { accuracy_standard: accuracyCodes },
      evidence: [evidenceForSpan(tierSpan, 'OPERATIVE_TEXT')],
      scope: { scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', tierOccurrenceId), coverage_status: 'COMPLETE', required_interval_ids: [tierSpan.semantic_span_id], examined_interval_ids: [tierSpan.semantic_span_id] },
    });
  });
  const relationships = reviewed.tiers.map((tier, ordinal) => {
    const tierSpan = span(tier.span);
    const tierOccurrenceId = occurrenceId('CONDITION_TIER_OCCURRENCE', {
      document_hash: source.document_hash,
      span_id: tierSpan.semantic_span_id,
      tier_key: tier.key,
    });
    return buildRelationshipRevision({
      source_occurrence_id: tierOccurrenceId,
      relationship_definition_key: 'BRINGS_DOWN',
      ordinal,
      state: 'NOT_EXAMINED',
      raw_scope: tier.raw_scope,
      not_examined: {
        reason: 'REFERENCED_SOURCE_NOT_IN_FIXTURE',
        intended_scope: tier.raw_scope,
        missing_source_section: '3.1',
      },
      evidence: [evidenceForSpan(tierSpan, 'OPERATIVE_TEXT')],
    });
  });

  assert.deepEqual(claims.map((claim) => claim.canonical_value), accuracyCodes);
  assert.ok(claims.every((claim) => claim.publication_state === 'VALIDATED'));
  assert.ok(relationships.every((relationship) => relationship.publication_state === 'VALIDATED'));
  assert.deepEqual(relationships.map((relationship) => relationship.relationship_definition_key), Array(4).fill('BRINGS_DOWN'));
  assert.deepEqual(relationships.map((relationship) => relationship.state), Array(4).fill('NOT_EXAMINED'));
  assert.ok(relationships.every((relationship) => relationship.target_occurrence_ids.length === 0));
  assert.deepEqual(reviewed.tiers[1].target_endpoint_keys, ['QXO:SECTION_3.1(b)(i)', 'QXO:SECTION_3.1(b)(iii)']);
});

test('nested definition geometry, semantic use and multi-span evidence remain separate', () => {
  const definitionSpan = span([2536, 2772]);
  const tierBSpan = span(reviewed.tiers[1].span);
  const cue = buildDefinitionCue({
    source,
    termSpan: span(reviewed.definition.term_span),
    bodySpans: reviewed.definition.body_spans.map(span),
    rawTerm: reviewed.definition.raw_term,
    syntacticRole: reviewed.definition.syntactic_role,
  });
  const contained = buildRelationshipRevision({
    source_occurrence_id: cue.definition_cue_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [occurrenceId('CONTAINER_OCCURRENCE', {
      document_hash: source.document_hash,
      span_id: definitionSpan.semantic_span_id,
    })],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [evidenceForSpan(definitionSpan, 'DEFINITION')],
  });
  const uses = buildRelationshipRevision({
    source_occurrence_id: occurrenceId('CONDITION_TIER_OCCURRENCE', tierBSpan.semantic_span_id),
    relationship_definition_key: 'USES_DEFINITION',
    state: 'PRESENT',
    target_occurrence_ids: [cue.definition_cue_id],
    effect: { governed_term: 'De Minimis Inaccuracies', affected_tier: 'B' },
    evidence: [
      evidenceForSpan(tierBSpan, 'OPERATIVE_TEXT'),
      evidenceForSpan(definitionSpan, 'DEFINITION'),
    ],
  });
  const multiSpanClaim = buildClaimRevision({
    subject_occurrence_id: occurrenceId('CONDITION_TIER_OCCURRENCE', tierBSpan.semantic_span_id),
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    raw_value: 'except for De Minimis Inaccuracies',
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    evidence: [
      evidenceForSpan(tierBSpan, 'OPERATIVE_TEXT'),
      evidenceForSpan(definitionSpan, 'DEFINITION'),
    ],
    scope: { scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', 'QXO:TIER:B:EXCEPTION'), coverage_status: 'COMPLETE', required_interval_ids: [tierBSpan.semantic_span_id, definitionSpan.semantic_span_id], examined_interval_ids: [tierBSpan.semantic_span_id, definitionSpan.semantic_span_id] },
  });
  const reversedEvidenceClaim = buildClaimRevision({
    subject_occurrence_id: occurrenceId('CONDITION_TIER_OCCURRENCE', tierBSpan.semantic_span_id),
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    raw_value: 'except for De Minimis Inaccuracies',
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    evidence: [
      evidenceForSpan(definitionSpan, 'DEFINITION'),
      evidenceForSpan(tierBSpan, 'OPERATIVE_TEXT'),
    ],
    scope: { scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', 'QXO:TIER:B:EXCEPTION'), coverage_status: 'COMPLETE', required_interval_ids: [tierBSpan.semantic_span_id, definitionSpan.semantic_span_id], examined_interval_ids: [tierBSpan.semantic_span_id, definitionSpan.semantic_span_id] },
  });

  assert.equal(contained.effect.legal_operation, 'GEOMETRIC_ONLY');
  assert.equal(uses.relationship_definition_key, 'USES_DEFINITION');
  assert.equal(multiSpanClaim.evidence.length, 2);
  assert.notEqual(multiSpanClaim.evidence[0].excerpt_id, multiSpanClaim.evidence[1].excerpt_id);
  assert.equal(reversedEvidenceClaim.claim_revision_id, multiSpanClaim.claim_revision_id);
});

test('claim states fail closed and residual quarantine is isolated to the affected object', () => {
  assert.deepEqual(CLAIM_STATES, ['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED']);
  const completeScope = { scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', 'scope-1'), coverage_status: 'COMPLETE', required_interval_ids: [occurrenceId('INTERVAL', 'interval-1')], examined_interval_ids: [occurrenceId('INTERVAL', 'interval-1')] };
  const absent = buildClaimRevision({ subject_occurrence_id: occurrenceId('SUBJECT', 'subject-1'), claim_definition_key: 'KNOWLEDGE_QUALIFIER', state: 'ABSENT', scope: completeScope });
  const sibling = buildClaimRevision({ subject_occurrence_id: occurrenceId('SUBJECT', 'subject-2'), claim_definition_key: 'ACCURACY_STANDARD', state: 'PRESENT', canonical_value: 'MAT_ALL_RESPECTS', evidence: [syntheticEvidence('excerpt-2')] });
  const invalid = buildClaimRevision({
    subject_occurrence_id: occurrenceId('SUBJECT', 'subject-3'),
    claim_definition_key: 'ACCURACY_STANDARD',
    state: 'PRESENT',
    canonical_value: 'NEAREST_PLAUSIBLE_CODE',
    evidence: [syntheticEvidence('excerpt-3')],
    attributes: { inventedQualifier: true },
    allowed_attributes: [],
    taxonomy_codes: { accuracy_standard: 'NEAREST_PLAUSIBLE_CODE' },
    codebooks: { accuracy_standard: ['MAT_ALL_RESPECTS'] },
  });
  const assertedAbsent = buildClaimRevision({ subject_occurrence_id: occurrenceId('SUBJECT', 'subject-4'), claim_definition_key: 'LOOKBACK', state: 'ABSENT', raw_value: 'none', scope: completeScope });
  const explicitNonPresentStates = [
    buildClaimRevision({
      subject_occurrence_id: occurrenceId('SUBJECT', 'NOT_APPLICABLE'),
      claim_definition_key: 'LOOKBACK',
      state: 'NOT_APPLICABLE',
      applicability: { rule: 'NOT_APPLICABLE_TO_SUBJECT', source_fact_ids: [occurrenceId('FACT', 'na')] },
    }),
    buildClaimRevision({
      subject_occurrence_id: occurrenceId('SUBJECT', 'NOT_EXAMINED'),
      claim_definition_key: 'LOOKBACK',
      state: 'NOT_EXAMINED',
      not_examined: { reason: 'SOURCE_OUTSIDE_FIXTURE', intended_scope: 'Section 3.1' },
    }),
    buildClaimRevision({
      subject_occurrence_id: occurrenceId('SUBJECT', 'FAILED'),
      claim_definition_key: 'LOOKBACK',
      state: 'FAILED',
      failure: { failure_code: 'FIXTURE_EXTRACTION_FAILED', attempted_extractor: 'foundation/v1' },
    }),
  ];
  const unsupportedNotExamined = buildClaimRevision({
    subject_occurrence_id: occurrenceId('SUBJECT', 'NOT_EXAMINED_MISSING_DETAIL'),
    claim_definition_key: 'LOOKBACK',
    state: 'NOT_EXAMINED',
  });

  assert.equal(absent.publication_state, 'VALIDATED');
  assert.equal(sibling.publication_state, 'VALIDATED');
  assert.equal(invalid.publication_state, 'QUARANTINED');
  assert.deepEqual(invalid.retained_residuals.map((item) => item.reason).sort(), ['INVALID_TAXONOMY_CODE', 'UNKNOWN_ATTRIBUTE']);
  assert.equal(assertedAbsent.publication_state, 'QUARANTINED');
  assert.equal(assertedAbsent.raw_value, null);
  assert.ok(assertedAbsent.quarantine.reason_codes.includes('NON_PRESENT_ASSERTED_VALUE'));
  assert.ok(explicitNonPresentStates.every((claim) => claim.publication_state === 'VALIDATED'));
  assert.ok(explicitNonPresentStates.every((claim) => claim.raw_value === null && claim.canonical_value === null));
  assert.equal(unsupportedNotExamined.publication_state, 'QUARANTINED');
  assert.ok(unsupportedNotExamined.quarantine.reason_codes.includes('STATE_DETAIL_REQUIRED'));
  assert.equal(sibling.publication_state, 'VALIDATED');
});

test('claim identity rejects unsafe ordinals, unbound evidence and non-canonical evidence order', () => {
  const subjectOccurrenceId = occurrenceId('SUBJECT', 'claim-identity');
  const firstEvidence = syntheticEvidence('claim-identity-first', 'OPERATIVE_TEXT', 10);
  const secondEvidence = syntheticEvidence('claim-identity-second', 'DEFINITION', 20);
  const claim = buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    evidence: [secondEvidence, firstEvidence],
  });

  assert.equal(validateClaimRevisionIdentity(claim), true);
  assert.deepEqual(
    claim.evidence.map((edge) => edge.absolute_start),
    [10, 20],
  );

  const reversed = structuredClone(claim);
  reversed.evidence.reverse();
  assert.throws(
    () => validateClaimRevisionIdentity(reversed),
    /canonical source order/,
  );

  const unbound = structuredClone(claim);
  unbound.evidence[0].unbound_value = true;
  assert.throws(
    () => validateClaimRevisionIdentity(unbound),
    /canonical source order/,
  );

  assert.throws(() => buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    claim_definition_version: Number.MAX_SAFE_INTEGER + 1,
    state: 'ABSENT',
    scope: {
      scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', 'unsafe-version'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [occurrenceId('INTERVAL', 'unsafe-version')],
      examined_interval_ids: [occurrenceId('INTERVAL', 'unsafe-version')],
    },
  }), /safe integer/);

  assert.throws(() => buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    ordinal: Number.MAX_SAFE_INTEGER + 1,
    state: 'ABSENT',
    scope: {
      scope_closure_id: occurrenceId('CLAIM_SCOPE_CLOSURE', 'unsafe-ordinal'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [occurrenceId('INTERVAL', 'unsafe-ordinal')],
      examined_interval_ids: [occurrenceId('INTERVAL', 'unsafe-ordinal')],
    },
  }), /safe integer/);

  assert.throws(() => buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'uncontrolled claim key',
    state: 'PRESENT',
    evidence: [firstEvidence],
  }), /governed uppercase key/);

  assert.throws(() => buildClaimRevision({
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'PRESENT',
    evidence: [firstEvidence],
    extraction_version: 7,
  }), /non-empty string/);
});
