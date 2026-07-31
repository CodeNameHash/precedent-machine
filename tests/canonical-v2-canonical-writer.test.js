const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { contentId, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('../lib/canonical-v2/claims-relationships');
const {
  compileFixtureContract,
  compileFixtureContractV5,
  compileFixtureContractV13,
} = require('../lib/canonical-v2/contract-bundle');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const contractBundle = compileFixtureContract();
const contractBundleV5 = compileFixtureContractV5();
const id = (value) => contentId('WRITER_TEST_ID/V1', value);

function fixtureWriteSet(contract = contractBundle) {
  const repClosure = id('closure:rep');
  const conditionClosure = id('closure:condition');
  const sourceText = 'Capitalisation representation. Closing condition.';
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'writer-foundation-fixture' });
  const repSpan = buildSemanticSpan(source, 0, utf8ByteLength('Capitalisation representation.'));
  const conditionSpan = buildSemanticSpan(
    source,
    utf8ByteLength('Capitalisation representation. '),
    utf8ByteLength(sourceText),
  );
  const repExcerpt = buildExcerpt({ source, span: repSpan });
  const conditionExcerpt = buildExcerpt({ source, span: conditionSpan });
  const evidenceFor = (excerpt, evidenceRole = 'OPERATIVE_TEXT') => ({
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  });
  const repProvision = buildProvisionInstance({
    source,
    span: repSpan,
    conceptKey: 'REP-T-CAP',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const conditionProvision = buildProvisionInstance({
    source,
    span: conditionSpan,
    conceptKey: 'COND-B-REP',
    party: { role: 'CONDITION_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const repClaim = buildClaimRevision({
    subject_occurrence_id: repProvision.provision_instance_id,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'ABSENT',
    scope: {
      scope_closure_id: id('scope:rep'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [repExcerpt.excerpt_id],
      examined_interval_ids: [repExcerpt.excerpt_id],
    },
  });
  const conditionClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: 'in all material respects',
    canonical_value: 'MAT_ALL_MATERIAL',
    evidence: [evidenceFor(conditionExcerpt)],
  });
  const repRelationship = buildRelationshipRevision({
    source_occurrence_id: repProvision.provision_instance_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [repProvision.provision_instance_id],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [evidenceFor(repExcerpt)],
  });
  const conditionRelationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [conditionProvision.provision_instance_id],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [evidenceFor(conditionExcerpt)],
  });
  const dealAdmissionId = id('deal-admission:qxo');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:qxo',
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
  });
  return {
    source,
    source_admission: sourceAdmission,
    deal: { deal_key: 'deal:qxo', deal_admission_id: dealAdmissionId, document_hash: source.document_hash },
    excerpts: [
      { ...repExcerpt, closure_id: repClosure },
      { ...conditionExcerpt, closure_id: conditionClosure },
    ],
    provisions: [
      { ...repProvision, closure_id: repClosure },
      { ...conditionProvision, closure_id: conditionClosure },
    ],
    claims: [
      { ...repClaim, closure_id: repClosure },
      { ...conditionClaim, closure_id: conditionClosure },
    ],
    relationships: [
      { ...repRelationship, closure_id: repClosure },
      { ...conditionRelationship, closure_id: conditionClosure },
    ],
  };
}

function relationshipRevisionPayload(row) {
  return {
    relationship_occurrence_id: row.relationship_occurrence_id,
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_scope: row.raw_scope,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    target_occurrence_ids: row.target_occurrence_ids,
    effect: row.effect,
    evidence_ids: row.evidence_ids,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    resolver_version: row.resolver_version,
  };
}

function identifyRelationship(row) {
  const relationshipOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
  });
  const evidence = row.evidence.map((edge, ordinal) => ({
    ...edge,
    relationship_evidence_id: contentId('RELATIONSHIP_EVIDENCE/V1', {
      occurrence_id: relationshipOccurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    }),
    ordinal,
  }));
  const identified = {
    ...row,
    relationship_occurrence_id: relationshipOccurrenceId,
    evidence,
    evidence_ids: evidence.map((edge) => edge.relationship_evidence_id),
  };
  return {
    ...identified,
    relationship_revision_id: contentId(
      'RELATIONSHIP_REVISION/V1',
      relationshipRevisionPayload(identified),
    ),
  };
}

function f5MoneyWriteSet({
  denominatorPrecision,
  compatibilityPrecision = denominatorPrecision,
} = {}) {
  const writeSet = fixtureWriteSet(contractBundleV5);
  const subject = writeSet.provisions[1];
  const excerpt = writeSet.excerpts[1];
  const denominator = {
    value: '5000000000',
    currency: 'USD',
    basis: 'HEADLINE_TRANSACTION_VALUE',
    source_lineage_ids: [excerpt.excerpt_id],
  };
  if (denominatorPrecision !== undefined) denominator.precision = denominatorPrecision;
  const attributes = {
    basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
  };
  if (compatibilityPrecision !== undefined) {
    attributes.denominator_precision = compatibilityPrecision;
  }
  const claim = buildClaimRevision({
    subject_occurrence_id: subject.provision_instance_id,
    claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$100 million',
    canonical_value: '2',
    unit: 'PERCENT_OF_DEAL_VALUE',
    denominator,
    attributes,
    allowed_attributes: ['basis_key', 'denominator_precision'],
    evidence: [{
      evidence_role: 'DERIVATION_INPUT',
      excerpt_id: excerpt.excerpt_id,
      document_ordinal: 0,
      absolute_start: excerpt.absolute_start,
      absolute_end: excerpt.absolute_end,
    }],
  });
  writeSet.claims[1] = { ...claim, closure_id: writeSet.claims[1].closure_id };
  return writeSet;
}

function setup(contract = contractBundle) {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  return { repository, writer };
}

test('passes only caller-supplied Process authority inputs to Product candidate validation', () => {
  const source = fs.readFileSync(
    require.resolve('../lib/canonical-v2/canonical-writer'),
    'utf8',
  );
  assert.match(source, /processAuthorityContext/);
  assert.match(source, /processAuthorityInput/);
  assert.match(
    source,
    /validateProductCandidateResultWriteSet\([\s\S]*processAuthorityContext[\s\S]*processAuthorityInput/,
  );
  assert.doesNotMatch(source, /compilePilotProductAuthorityContext|buildPilotProductAuthorityContext/);
});

test('dry run validates and partitions without opening a transaction', async () => {
  const { repository, writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'dry-1', dryRun: true, writeSet: fixtureWriteSet(),
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.validation.counts.publishable, 8);
  assert.equal(repository.transactionCount, 0);
  assert.deepEqual(repository.snapshot().receipts, []);
});

test('semantic graph nesting is bounded across the whole writer request', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.validated_semantic_graphs = Array.from({ length: 5 }, (_, index) => ({
    schema_version: 'VALIDATED_SEMANTIC_GRAPH/V1',
    validated_semantic_graph_id: id(`oversized-graph:${index}`),
    document_hash: writeSet.source.document_hash,
    canonical_text_id: writeSet.source.canonical_text_id,
    definition_cue_ids: [],
    definition_use_cue_ids: [],
    definition_cues: Array(4096).fill({
      body_span_ids: [],
      body_spans: [],
    }),
    definition_use_cues: [],
    closure_id: id(`oversized-graph-closure:${index}`),
  }));
  await assert.rejects(
    writer.write({
      operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
      idempotencyKey: 'oversized-semantic-graph-request',
      dryRun: true,
      writeSet,
    }),
    /nested-member maximum/,
  );
  assert.equal(repository.transactionCount, 0);
});

test('semantic graph identifier arrays are bounded across the whole writer request', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.validated_semantic_graphs = Array.from({ length: 5 }, (_, index) => ({
    schema_version: 'VALIDATED_SEMANTIC_GRAPH/V1',
    validated_semantic_graph_id: id(`oversized-id-graph:${index}`),
    document_hash: writeSet.source.document_hash,
    canonical_text_id: writeSet.source.canonical_text_id,
    definition_cue_ids: Array(4096).fill(id(`cue-id:${index}`)),
    definition_use_cue_ids: [],
    definition_cues: [],
    definition_use_cues: [],
    closure_id: id(`oversized-id-graph-closure:${index}`),
  }));
  await assert.rejects(
    writer.write({
      operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
      idempotencyKey: 'oversized-semantic-graph-identifier-request',
      dryRun: true,
      writeSet,
    }),
    /identifier-member maximum/,
  );
  assert.equal(repository.transactionCount, 0);
});

test('one write uses one transaction and exact replay returns the same receipt without another transaction', async () => {
  const { repository, writer } = setup();
  const input = { operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'run-1', writeSet: fixtureWriteSet() };
  const first = await writer.write(input);
  const replay = await writer.write(input);
  assert.equal(repository.transactionCount, 1);
  assert.equal(first.receipt.receiptId, replay.receipt.receiptId);
  assert.equal(replay.replayed, true);
  assert.equal(repository.snapshot().sources.length, 1);
  assert.equal(repository.snapshot().sourceAdmissions.length, 1);
  assert.equal(repository.snapshot().claims.length, 2);
});

test('one canonical transaction admits multiple exact sources and their governed lineage', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  const metadataSource = buildImmutableSource({
    sourceBytes: 'The total transaction value is approximately $137.5 million.',
    sourceOccurrenceKey: 'writer-foundation-deal-value-source',
  });
  const metadataAdmission = buildFixtureSourceAdmission({
    source: metadataSource,
    dealKey: writeSet.deal.deal_key,
    dealAdmissionId: writeSet.deal.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
    sourceOrdinal: 1,
  });
  writeSet.sources = [writeSet.source, metadataSource];
  writeSet.source_admissions = [writeSet.source_admission, metadataAdmission];
  delete writeSet.source;
  delete writeSet.source_admission;

  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'multi-source-run',
    writeSet,
  });
  assert.equal(result.validation.counts.residuals, 0);
  assert.equal(repository.transactionCount, 1);
  assert.deepEqual(
    repository.snapshot().sources.map((row) => row.immutable_source_document_id),
    writeSet.sources.map((row) => row.immutable_source_document_id),
  );
  assert.deepEqual(
    repository.snapshot().sourceAdmissions.map((row) => row.source_admission_manifest_id),
    writeSet.source_admissions.map((row) => row.source_admission_manifest_id),
  );
});

test('multi-source admission rejects an unadmitted source or duplicate governed ordinal', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  const metadataSource = buildImmutableSource({
    sourceBytes: 'The total transaction value is approximately $137.5 million.',
    sourceOccurrenceKey: 'writer-foundation-invalid-lineage',
  });
  const metadataAdmission = buildFixtureSourceAdmission({
    source: metadataSource,
    dealKey: writeSet.deal.deal_key,
    dealAdmissionId: writeSet.deal.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
    sourceOrdinal: 0,
  });
  writeSet.sources = [writeSet.source, metadataSource];
  writeSet.source_admissions = [writeSet.source_admission, metadataAdmission];
  delete writeSet.source;
  delete writeSet.source_admission;
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'duplicate-source-ordinal',
    writeSet,
  }), /unique governed source ordinals/);

  writeSet.source_admissions[1] = {
    ...metadataAdmission,
    source_ordinal: 1,
    immutable_source_document_id: id('unadmitted-source'),
  };
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'unadmitted-source',
    writeSet,
  }), /does not name an immutable source/);
  assert.equal(repository.transactionCount, 0);
});

test('the writer rejects the old span-as-excerpt compatibility identity', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.excerpts[0].excerpt_id = writeSet.excerpts[0].ordered_component_assignments[0].semantic_span_id;
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'span-as-excerpt',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'CANONICAL_IDENTITY_MISMATCH'));
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'EVIDENCE_REFERENCE_UNRESOLVED'));
  assert.equal(result.validation.counts.quarantinedClosures, 1);
  assert.equal(repository.transactionCount, 0);
});

test('source or admission tampering blocks the whole write before a transaction', async () => {
  const { repository, writer } = setup();
  const badSource = fixtureWriteSet();
  badSource.source = structuredClone(badSource.source);
  badSource.source.source_bytes_base64 = Buffer.from('forged', 'utf8').toString('base64');
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'forged-source',
    writeSet: badSource,
  }), /immutable source/);

  const badAdmission = fixtureWriteSet();
  badAdmission.source_admission = structuredClone(badAdmission.source_admission);
  badAdmission.source_admission.deal_admission_id = id('wrong-admission');
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'forged-admission',
    writeSet: badAdmission,
  }), /source admission/);
  assert.equal(repository.transactionCount, 0);
  assert.deepEqual(repository.snapshot().receipts, []);
});

test('conflicting replay performs zero additional writes', async () => {
  const { repository, writer } = setup();
  const input = { operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'run-2', writeSet: fixtureWriteSet() };
  await writer.write(input);
  const before = repository.snapshot();
  const changed = fixtureWriteSet();
  changed.claims[0].state = 'NOT_EXAMINED';
  await assert.rejects(writer.write({ ...input, writeSet: changed }), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(repository.snapshot(), before);
  assert.equal(repository.transactionCount, 1);
});

test('unknown attributes and invalid codes are retained and quarantine only their closure', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.claims[0].claim_definition_key = 'UNFAMILIAR_REP_SUBJECT';
  writeSet.provisions[0].concept_key = 'REP-T-INVENTED';
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'run-3', writeSet,
  });
  const state = repository.snapshot();
  assert.deepEqual(result.validation.quarantinedClosureIds, [id('closure:rep')]);
  assert.ok(state.residuals.some((row) => row.reason_code === 'INVALID_TAXONOMY_CODE'));
  assert.ok(state.residuals.some((row) => row.reason_code === 'UNKNOWN_ATTRIBUTE'));
  assert.ok(state.residuals.some((row) => row.reason_code === 'CANONICAL_IDENTITY_MISMATCH'));
  assert.equal(state.quarantines.length, 1);
  assert.deepEqual(state.provisions.map((row) => row.provision_instance_id), [writeSet.provisions[1].provision_instance_id]);
  assert.deepEqual(state.claims.map((row) => row.claim_revision_id), [writeSet.claims[1].claim_revision_id]);
  assert.deepEqual(state.relationships.map((row) => row.relationship_revision_id), [writeSet.relationships[1].relationship_revision_id]);
  assert.deepEqual(state.excerpts.map((row) => row.excerpt_id), [writeSet.excerpts[1].excerpt_id]);
});

test('the writer independently quarantines unsupported PRESENT and ABSENT assertions', async () => {
  const { repository, writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.claims[0].scope = null;
  writeSet.claims[1].evidence = [];
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'invalid-state-evidence', writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'ABSENT_WITHOUT_COMPLETE_SCOPE'));
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'PRESENT_WITHOUT_EVIDENCE'));
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'CANONICAL_IDENTITY_MISMATCH'));
  assert.equal(result.validation.counts.quarantinedClosures, 2);
  assert.deepEqual(repository.snapshot().claims, []);
});

test('F5 publishes exact or approximate money precision and quarantines missing, invalid or mismatched precision', async () => {
  for (const precision of ['EXACT', 'APPROXIMATE']) {
    const { writer } = setup(contractBundleV5);
    const result = await writer.write({
      operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
      idempotencyKey: `f5-valid-${precision}`,
      dryRun: true,
      writeSet: f5MoneyWriteSet({ denominatorPrecision: precision }),
    });
    assert.equal(
      result.validation.residuals.some(
        (row) => row.reason_code === 'INVALID_DENOMINATOR_PRECISION',
      ),
      false,
    );
    assert.equal(result.validation.counts.quarantinedClosures, 0);
  }

  const invalidCases = [
    {},
    { denominatorPrecision: 'ESTIMATED' },
    { denominatorPrecision: 'EXACT', compatibilityPrecision: 'APPROXIMATE' },
  ];
  for (const [index, invalidCase] of invalidCases.entries()) {
    const { writer } = setup(contractBundleV5);
    const result = await writer.write({
      operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
      idempotencyKey: `f5-invalid-${index}`,
      dryRun: true,
      writeSet: f5MoneyWriteSet(invalidCase),
    });
    assert.ok(result.validation.residuals.some(
      (row) => row.reason_code === 'INVALID_DENOMINATOR_PRECISION',
    ));
    assert.deepEqual(
      result.validation.quarantinedClosureIds,
      [id('closure:condition')],
    );
    assert.equal(
      result.validation.publishableWriteSet.claims.some(
        (row) => row.claim_definition_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      ),
      false,
    );
  }
});

test('a canonical claim cannot publish an invented comparable value or unresolved evidence', async () => {
  const { writer } = setup();
  const writeSet = fixtureWriteSet();
  writeSet.claims[1].canonical_value = 'NEAREST_PLAUSIBLE_TIER';
  writeSet.claims[1].evidence[0] = {
    ...writeSet.claims[1].evidence[0],
    excerpt_id: id('missing-excerpt'),
  };
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'invented-value', dryRun: true, writeSet,
  });
  const reasons = result.validation.residuals.map((row) => row.reason_code);
  assert.ok(reasons.includes('INVALID_CANONICAL_VALUE'));
  assert.ok(reasons.includes('CANONICAL_IDENTITY_MISMATCH'));
  assert.ok(reasons.includes('EVIDENCE_REFERENCE_UNRESOLVED'));
  assert.deepEqual(result.validation.quarantinedClosureIds, [id('closure:condition')]);
});

test('a quarantined closure cannot publish later under a new idempotency key', async () => {
  const { repository, writer } = setup();
  const bad = fixtureWriteSet();
  bad.claims[0].claim_definition_key = 'UNFAMILIAR_REP_SUBJECT';
  await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'quarantine-first', writeSet: bad,
  });
  const before = repository.snapshot();
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'publish-later', writeSet: fixtureWriteSet(),
  }), (error) => error.code === 'QUARANTINED_CLOSURE_CONFLICT');
  assert.deepEqual(repository.snapshot(), before);
});

test('an injected failure rolls back every staged object and receipt', async () => {
  const { repository, writer } = setup();
  repository.injectFailureOnce('claims');
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'run-4', writeSet: fixtureWriteSet(),
  }), (error) => error.code === 'INJECTED_REPOSITORY_FAILURE');
  assert.deepEqual(repository.snapshot(), {
    intakeCaptures: [],
    sources: [], sourceAdmissions: [], deals: [], dealAdmissionRecords: [],
    excerpts: [], definition_occurrences: [], validated_semantic_graphs: [],
    provisions: [], components: [], condition_groups: [], claims: [], relationships: [],
    open_world_candidates: [], open_world_candidate_occurrences: [], open_world_evidence_references: [],
    open_world_candidate_dispositions: [], open_world_primitives: [], semantic_impact_closures: [],
    reviewed_source_specific_rows: [], incomplete_canonical_result_rows: [],
    productCandidateResults: [], residuals: [], quarantines: [], receipts: [],
  });
  assert.equal(repository.transactionCount, 1);
});

test('contract-bound deal admissions are immutable without mutating the legacy deal view', async () => {
  const repository = new InMemoryCanonicalRepository();
  const first = {
    deal_key: 'deal:qxo-topbuild',
    deal_admission_id: id('qxo-deal-admission-v1'),
    document_hash: id('qxo-document'),
  };
  const second = {
    ...first,
    deal_admission_id: id('qxo-deal-admission-v6'),
  };
  await repository.transaction(async (transaction) => {
    await transaction.writeDealAdmission(first);
    await transaction.writeDealAdmission(second);
  });
  const state = repository.snapshot();
  assert.deepEqual(state.deals, []);
  assert.deepEqual(state.dealAdmissionRecords, [first, second]);
});

test('the actual semantic builders pass through the same frozen contract and writer', async () => {
  const source = buildImmutableSource({
    sourceBytes: 'Capitalisation shall be accurate in all material respects.',
    sourceOccurrenceKey: 'writer-integration-fixture',
  });
  const span = buildSemanticSpan(source, 0, utf8ByteLength(source.canonical_text.text));
  const excerpt = buildExcerpt({ source, span });
  const provision = buildProvisionInstance({
    source,
    span,
    conceptKey: 'REP-T-CAP',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const claim = buildClaimRevision({
    subject_occurrence_id: provision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: 'in all material respects',
    canonical_value: 'MAT_ALL_MATERIAL',
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: excerpt.excerpt_id,
      document_ordinal: 0,
      absolute_start: span.absolute_start,
      absolute_end: span.absolute_end,
    }],
  });
  const relationship = buildRelationshipRevision({
    source_occurrence_id: provision.provision_instance_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [provision.provision_instance_id],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: excerpt.excerpt_id,
      document_ordinal: 0,
      absolute_start: span.absolute_start,
      absolute_end: span.absolute_end,
    }],
  });
  const closureId = id('actual-builder-closure');
  const dealAdmissionId = id('deal-admission:actual-builder');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:actual-builder',
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const writeSet = {
    source,
    source_admission: sourceAdmission,
    deal: { deal_key: 'deal:actual-builder', deal_admission_id: dealAdmissionId, document_hash: source.document_hash },
    excerpts: [{ ...excerpt, closure_id: closureId }],
    provisions: [{ ...provision, closure_id: closureId }],
    claims: [{ ...claim, closure_id: closureId }],
    relationships: [{ ...relationship, closure_id: closureId }],
  };
  const { repository, writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN', idempotencyKey: 'actual-builder', writeSet,
  });
  assert.equal(result.validation.counts.publishable, 4);
  assert.equal(result.validation.counts.residuals, 0);
  assert.equal(repository.snapshot().claims[0].claim_revision_id, claim.claim_revision_id);
});

test('relationship effects must match the frozen definition effect mode', async () => {
  const writeSet = fixtureWriteSet();
  const original = writeSet.relationships[0];
  const mismatched = buildRelationshipRevision({
    source_occurrence_id: original.source_occurrence_id,
    relationship_definition_key: original.relationship_definition_key,
    relationship_definition_version: original.relationship_definition_version,
    ordinal: original.ordinal,
    state: original.state,
    target_occurrence_ids: original.target_occurrence_ids,
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'GEOMETRIC_ONLY',
    },
    evidence: original.evidence.map((edge) => ({
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
    })),
  });
  assert.equal(mismatched.publication_state, 'VALIDATED');
  writeSet.relationships[0] = {
    ...mismatched,
    closure_id: original.closure_id,
  };

  const { writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'relationship-effect-mode-mismatch',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some(
    (residual) => residual.reason_code === 'PRESENT_WITHOUT_EFFECT',
  ));
  assert.ok(result.validation.quarantines.some(
    (quarantine) => quarantine.closure_id === original.closure_id,
  ));
});

test('authoritative dry-run rejects re-signed malformed relationship identities', async () => {
  const mutations = [
    ['unknown evidence role', (row) => identifyRelationship({
      ...row,
      evidence: row.evidence.map((edge, index) => (
        index === 0 ? { ...edge, evidence_role: 'FORGED_ROLE' } : edge
      )),
    })],
    ['extra evidence field', (row) => identifyRelationship({
      ...row,
      evidence: row.evidence.map((edge, index) => (
        index === 0 ? { ...edge, forged_value: true } : edge
      )),
    })],
    ['extra relationship field', (row) => identifyRelationship({
      ...row,
      forged_value: true,
    })],
    ['invalid definition version', (row) => identifyRelationship({
      ...row,
      relationship_definition_version: 0,
    })],
    ['invalid ordinal', (row) => identifyRelationship({
      ...row,
      ordinal: -1,
    })],
    ['non-string resolver', (row) => identifyRelationship({
      ...row,
      resolver_version: 7,
    })],
    ['non-array retained residuals', (row) => ({
      ...row,
      retained_residuals: null,
    })],
    ['array attributes', (row) => identifyRelationship({
      ...row,
      attributes: [],
    })],
    ['array taxonomy codes', (row) => identifyRelationship({
      ...row,
      taxonomy_codes: [],
    })],
  ];

  for (const [label, mutate] of mutations) {
    const writeSet = fixtureWriteSet();
    const original = writeSet.relationships[0];
    writeSet.relationships[0] = mutate(original);
    const { writer } = setup();
    const result = await writer.write({
      operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
      idempotencyKey: `relationship-identity-${label.replaceAll(' ', '-')}`,
      dryRun: true,
      writeSet,
    });
    assert.ok(
      result.validation.residuals.some(
        (residual) => residual.closure_id === original.closure_id
          && residual.reason_code === 'CANONICAL_IDENTITY_MISMATCH',
      ),
      label,
    );
    assert.ok(
      result.validation.quarantines.some(
        (quarantine) => quarantine.closure_id === original.closure_id,
      ),
      label,
    );
  }
});

test('builder-produced quarantines retain their governed residual reasons', async () => {
  const writeSet = fixtureWriteSet();
  const originalClaim = writeSet.claims[0];
  const originalRelationship = writeSet.relationships[0];
  const quarantinedClaim = buildClaimRevision({
    subject_occurrence_id: originalClaim.subject_occurrence_id,
    claim_definition_key: originalClaim.claim_definition_key,
    claim_definition_version: originalClaim.claim_definition_version,
    ordinal: originalClaim.ordinal,
    state: originalClaim.state,
    scope: originalClaim.scope,
    attributes: { novel_claim_attribute: true },
    allowed_attributes: [],
  });
  const quarantinedRelationship = buildRelationshipRevision({
    source_occurrence_id: originalRelationship.source_occurrence_id,
    relationship_definition_key:
      originalRelationship.relationship_definition_key,
    relationship_definition_version:
      originalRelationship.relationship_definition_version,
    ordinal: originalRelationship.ordinal,
    state: originalRelationship.state,
    target_occurrence_ids: originalRelationship.target_occurrence_ids,
    effect: originalRelationship.effect,
    evidence: originalRelationship.evidence.map((edge) => ({
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
    })),
    attributes: { novel_relationship_attribute: true },
    allowed_attributes: [],
  });
  assert.equal(quarantinedClaim.publication_state, 'QUARANTINED');
  assert.equal(quarantinedRelationship.publication_state, 'QUARANTINED');
  writeSet.claims[0] = {
    ...quarantinedClaim,
    closure_id: originalClaim.closure_id,
  };
  writeSet.relationships[0] = {
    ...quarantinedRelationship,
    closure_id: originalRelationship.closure_id,
  };

  const { writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'builder-quarantine-residual-retention',
    dryRun: true,
    writeSet,
  });
  for (const objectId of [
    quarantinedClaim.claim_revision_id,
    quarantinedRelationship.relationship_revision_id,
  ]) {
    assert.ok(result.validation.residuals.some(
      (residual) => residual.source_object_id === objectId
        && residual.reason_code === 'UNKNOWN_ATTRIBUTE',
    ));
    assert.equal(result.validation.residuals.some(
      (residual) => residual.source_object_id === objectId
        && residual.reason_code === 'CANONICAL_IDENTITY_MISMATCH',
    ), false);
  }
});

test('claims and relationships cannot publish against unresolved semantic occurrences', async () => {
  const writeSet = fixtureWriteSet();
  const original = writeSet.claims[0];
  const orphan = buildClaimRevision({
    subject_occurrence_id: id('missing-semantic-occurrence'),
    claim_definition_key: original.claim_definition_key,
    state: 'ABSENT',
    scope: original.scope,
  });
  writeSet.claims[0] = { ...orphan, closure_id: writeSet.claims[0].closure_id };
  const { writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'orphan-semantic-reference',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'SEMANTIC_REFERENCE_UNRESOLVED'));
  assert.deepEqual(result.validation.quarantinedClosureIds, [id('closure:rep')]);
});

test('valid evidence and semantic relationships may cross publication closures', async () => {
  const writeSet = fixtureWriteSet();
  const evidenceClosure = id('closure:shared-evidence');
  writeSet.excerpts[1] = { ...writeSet.excerpts[1], closure_id: evidenceClosure };
  const conditionRelationship = buildRelationshipRevision({
    source_occurrence_id: writeSet.provisions[1].provision_instance_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [writeSet.provisions[0].provision_instance_id],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: writeSet.excerpts[1].excerpt_id,
      document_ordinal: 0,
      absolute_start: writeSet.excerpts[1].absolute_start,
      absolute_end: writeSet.excerpts[1].absolute_end,
    }],
  });
  writeSet.relationships[1] = {
    ...conditionRelationship,
    closure_id: id('closure:condition'),
  };
  const { writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'cross-closure-references',
    dryRun: true,
    writeSet,
  });
  assert.equal(result.validation.counts.residuals, 0);
  assert.equal(result.validation.counts.quarantinedClosures, 0);
});

test('a quarantined dependency propagates to the referencing closure', async () => {
  const writeSet = fixtureWriteSet();
  const evidenceClosure = id('closure:shared-evidence');
  writeSet.excerpts[1] = {
    ...writeSet.excerpts[1],
    exact_bytes_digest: '0'.repeat(64),
    closure_id: evidenceClosure,
  };
  const { writer } = setup();
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'cross-closure-quarantine-propagation',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => (
    row.closure_id === id('closure:condition')
      && row.reason_code === 'EVIDENCE_REFERENCE_UNRESOLVED'
  )));
  assert.deepEqual(result.validation.quarantinedClosureIds, [
    id('closure:condition'),
    evidenceClosure,
  ].sort());
});

test('condition groups are strict first-class writer rows with transactional replay protection', async () => {
  const contract = compileFixtureContractV13();
  const writeSet = fixtureWriteSet(contract);
  const source = writeSet.source;
  const conditionClosure = writeSet.provisions[1].closure_id;
  const conditionSpan = buildSemanticSpan(
    source,
    writeSet.provisions[1].absolute_start,
    writeSet.provisions[1].absolute_end,
  );
  const conditionProvision = buildProvisionInstance({
    source,
    span: conditionSpan,
    conceptKey: 'COND-B-REP',
    party: { role: 'CONDITION_BENEFICIARY', value: 'BUYER_GROUP', capacity: 'ACQUIRER' },
    ordinal: 1,
  });
  const conditionExcerpt = writeSet.excerpts[1];
  const evidence = {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: conditionExcerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: conditionExcerpt.absolute_start,
    absolute_end: conditionExcerpt.absolute_end,
  };
  const conditionClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: 'in all material respects',
    canonical_value: 'MAT_ALL_MATERIAL',
    evidence: [evidence],
  });
  const conditionRelationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'CONTAINED_IN',
    state: 'PRESENT',
    target_occurrence_ids: [conditionProvision.provision_instance_id],
    effect: { effect_mode: 'NON_SEMANTIC', legal_operation: 'GEOMETRIC_ONLY' },
    evidence: [evidence],
  });
  writeSet.provisions[1] = { ...conditionProvision, closure_id: conditionClosure };
  writeSet.claims[1] = { ...conditionClaim, closure_id: conditionClosure };
  writeSet.relationships[1] = { ...conditionRelationship, closure_id: conditionClosure };
  writeSet.condition_groups = [
    ['B', 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', [1, 3]],
    ['C', 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', [2, 4, 5]],
  ].map(([sourceClauseCode, comparisonClassKey, targetLimbOrdinals], index) => {
    const occurrence = {
      document_hash: source.document_hash,
      parent_provision_instance_id: conditionProvision.provision_instance_id,
      canonical_text_id: source.canonical_text_id,
      absolute_start: conditionExcerpt.absolute_start,
      absolute_end: conditionExcerpt.absolute_end,
      component_key: 'CAPITALISATION_ACCURACY_GROUP',
      party: { role: 'CONDITION_BENEFICIARY', value: 'BUYER_GROUP', capacity: 'ACQUIRER' },
      governed_ordinal: index + 1,
    };
    const condition_group_occurrence_id = contentId(
      'CAPITALISATION_CONDITION_GROUP_OCCURRENCE/V1', occurrence,
    );
    const revision = {
      condition_group_occurrence_id,
      comparison_class_key: comparisonClassKey,
      source_clause_code: sourceClauseCode,
      target_limb_ordinals: targetLimbOrdinals,
      evidence_excerpt_id: conditionExcerpt.excerpt_id,
      review_version: 'QXO_CAPITALISATION_BRING_DOWN_F27/V1',
    };
    return {
      schema_version: 'CAPITALISATION_CONDITION_GROUP/V1',
      ...occurrence,
      ...revision,
      condition_group_revision_id: contentId(
        'CAPITALISATION_CONDITION_GROUP_REVISION/V1', revision,
      ),
      closure_id: conditionClosure,
    };
  });
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  const input = {
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'condition-groups-commit',
    writeSet,
  };
  const first = await writer.write(input);
  const replay = await writer.write(input);
  assert.equal(first.validation.counts.residuals, 0);
  assert.equal(replay.replayed, true);
  assert.deepEqual(repository.snapshot().condition_groups, writeSet.condition_groups);

  const reordered = structuredClone(writeSet);
  reordered.condition_groups.reverse();
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-reordered', writeSet: reordered }),
    /condition-group contract/);
  const missing = structuredClone(writeSet);
  missing.condition_groups.pop();
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-missing', writeSet: missing }),
    /every frozen capitalisation condition group/);
  const duplicate = structuredClone(writeSet);
  duplicate.condition_groups.push(structuredClone(duplicate.condition_groups[1]));
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-duplicate', writeSet: duplicate }),
    /every frozen capitalisation condition group/);
  const forged = structuredClone(writeSet);
  forged.condition_groups[0].condition_group_revision_id = id('forged-condition-group');
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-forged', writeSet: forged }),
    /forged condition-group identity/);
  const sourceDrift = structuredClone(writeSet);
  sourceDrift.condition_groups[0].document_hash = id('other-source');
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-source-drift', writeSet: sourceDrift }),
    /admitted source document/);
  const offsetDrift = structuredClone(writeSet);
  offsetDrift.condition_groups[0].absolute_start += 1;
  await assert.rejects(writer.write({ ...input, idempotencyKey: 'condition-groups-offset-drift', writeSet: offsetDrift }),
    /governed parent and evidence/);
  const changed = structuredClone(writeSet);
  const changedClosure = id('condition-groups-changed-closure');
  for (const kind of ['excerpts', 'provisions', 'claims', 'relationships', 'condition_groups']) {
    for (const row of changed[kind]) {
      if (row.closure_id === conditionClosure) row.closure_id = changedClosure;
    }
  }
  await assert.rejects(writer.write({ ...input, writeSet: changed }), (error) => (
    error.code === 'IDEMPOTENCY_CONFLICT'
  ));
});

test('the SQL authority is staging-only, transactional and denies direct app-role DML', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS canonical_v2_staging/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_write/);
  assert.match(sql, /p_environment IS DISTINCT FROM 'staging'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /CREATE ROLE canonical_v2_writer NOLOGIN/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.immutable_source_documents/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.source_admission_manifests/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.provision_components/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.open_world_candidates/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.reviewed_source_specific_rows/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.incomplete_canonical_result_rows/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.validated_semantic_graphs/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.immutable_source_documents/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.source_admission_manifests/);
  assert.match(sql, /p_write_set \? 'sources'/);
  assert.match(sql, /p_write_set \? 'source_admissions'/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.provision_components/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.open_world_candidate_dispositions/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.reviewed_source_specific_rows/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.incomplete_canonical_result_rows/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.validated_semantic_graphs/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA canonical_v2_staging[\s\S]*service_role, canonical_v2_writer/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.canonical_v2_write[\s\S]*service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_write[\s\S]*TO canonical_v2_writer/);
  assert.doesNotMatch(sql, /^\s*(?:COMMIT|START\s+TRANSACTION)\b/im);
});
