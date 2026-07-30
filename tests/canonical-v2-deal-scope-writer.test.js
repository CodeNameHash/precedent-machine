const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision } = require('../lib/canonical-v2/claims-relationships');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const contractBundle = compileFixtureContract();
const digest = (value) => contentId('DEAL_SCOPE_WRITER_TEST/V1', value);

function sourceChain(html, suffix) {
  const url = `https://www.sec.gov/Archives/edgar/data/1/${suffix}.htm`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: '2026-07-22T15:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html, 'utf8'),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);
  return { capture, conversion, verification, bundle, artifact };
}

async function admit(writer, chain) {
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `intake:${chain.capture.intake_capture_receipt_id}`,
    writeSet: { intake_capture: chain.capture },
  });
  for (const chunk of chain.artifact.chunks) {
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `artifact:${chunk.chunk_id}`,
      writeSet: {
        source_artifact_manifest: chain.artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
  await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `admission:${chain.bundle.source_admission_manifest.source_admission_manifest_id}`,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: chain.capture.intake_capture_receipt_id,
        source_response_content_id: chain.capture.source_response_content_id,
      },
      conversion_artifact_manifest: chain.artifact.manifest,
      verification: chain.verification,
      source_admission_bundle: chain.bundle,
    },
  });
}

function sourceContext(chain, dealKey = 'deal:qxo', dealAdmissionId = digest('deal:qxo'), ordinal = 0) {
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: chain.bundle.immutable_source_document,
    source_admission_manifest: chain.bundle.source_admission_manifest,
    semantic_extraction_input_envelope: chain.bundle.semantic_extraction_input_envelope,
    conversion: chain.conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: ordinal,
  });
}

function semanticWriteSet(context) {
  const span = buildSemanticSpan(context, 0, utf8ByteLength(context.canonical_text.text));
  const excerpt = buildExcerpt({ source: context, span });
  const provision = buildProvisionInstance({
    source: context,
    span,
    conceptKey: 'REP-T-CAP',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const closureId = digest('closure:qxo-capitalisation');
  const claim = buildClaimRevision({
    subject_occurrence_id: provision.provision_instance_id,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'ABSENT',
    scope: {
      scope_closure_id: digest('scope:qxo-capitalisation'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [excerpt.excerpt_id],
      examined_interval_ids: [excerpt.excerpt_id],
    },
  });
  return {
    source_references: [buildAdmittedSourceReference(context)],
    deal: {
      deal_key: context.governed_deal_key,
      deal_admission_id: context.deal_admission_id,
      document_hash: context.document_hash,
    },
    excerpts: [{ ...excerpt, closure_id: closureId }],
    validated_semantic_graphs: [],
    definition_occurrences: [],
    provisions: [{ ...provision, closure_id: closureId }],
    components: [],
    condition_groups: [],
    claims: [{ ...claim, closure_id: closureId }],
    relationships: [],
    open_world_candidates: [],
    open_world_candidate_occurrences: [],
    open_world_evidence_references: [],
    open_world_candidate_dispositions: [],
    open_world_primitives: [],
    semantic_impact_closures: [],
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: [],
  };
}

async function setup(html = '<body><p>Capitalisation representation.</p></body>') {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const chain = sourceChain(html, 'qxo');
  await admit(writer, chain);
  const context = sourceContext(chain);
  return { repository, writer, chain, context, writeSet: semanticWriteSet(context) };
}

async function persistedReference(repository, objectKind, objectId, validationClosureId) {
  const [resolved] = await repository.resolvePersistedCanonicalObjectReferences([{
    object_kind: objectKind,
    object_id: objectId,
  }]);
  return {
    schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
    object_kind: objectKind,
    object_id: objectId,
    stored_closure_id: resolved.closure_id,
    canonical_payload_digest: resolved.canonical_payload_digest,
    validation_closure_id: validationClosureId,
  };
}

test('DEAL_SCOPE_RUN dry-run resolves stored admission and accepts reference-only semantics', async () => {
  const { repository, writer, writeSet } = await setup();
  const before = repository.snapshot();
  const transactionsBefore = repository.transactionCount;
  const result = await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'qxo-semantic-dry-run',
    dryRun: true,
    writeSet,
  });

  assert.equal(result.validation.counts.publishable, 3);
  assert.equal(repository.transactionCount, transactionsBefore);
  assert.deepEqual(repository.snapshot(), before);
  assert.deepEqual(Object.keys(writeSet).sort(), [
    'claims', 'components', 'deal', 'excerpts', 'open_world_candidate_dispositions',
    'condition_groups', 'definition_occurrences',
    'open_world_candidate_occurrences', 'open_world_candidates',
    'open_world_evidence_references', 'open_world_primitives', 'provisions',
    'relationships', 'reviewed_source_specific_rows', 'incomplete_canonical_result_rows', 'semantic_impact_closures',
    'source_references', 'validated_semantic_graphs',
  ].sort());
});

test('DEAL_SCOPE_RUN commits one semantic transaction and exact replay is idempotent', async () => {
  const { repository, writer, writeSet } = await setup();
  const sourcesBefore = repository.snapshot().sources;
  const transactionsBefore = repository.transactionCount;
  const input = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'qxo-semantic-commit',
    writeSet,
  };
  const first = await writer.write(input);
  const replay = await writer.write(input);
  const state = repository.snapshot();

  assert.equal(repository.transactionCount, transactionsBefore + 1);
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.receiptId, first.receipt.receiptId);
  assert.deepEqual(state.sources, sourcesBefore);
  assert.deepEqual(state.deals, []);
  assert.deepEqual(state.dealAdmissionRecords, [writeSet.deal]);
  assert.deepEqual(state.excerpts, writeSet.excerpts);
  assert.deepEqual(state.provisions, writeSet.provisions);
  assert.deepEqual(state.claims, writeSet.claims);
  assert.equal(state.receipts.filter((row) => row.operation === 'DEAL_SCOPE_RUN').length, 1);

  const changed = structuredClone(writeSet);
  changed.deal.dimensions = { sector: 'INDUSTRIALS' };
  await assert.rejects(writer.write({ ...input, writeSet: changed }), (error) => (
    error.code === 'IDEMPOTENCY_CONFLICT'
  ));
  assert.deepEqual(repository.snapshot(), state);
});

test('structural rows reject fields and types outside the closed contract', async () => {
  const { repository, writer, context, writeSet } = await setup();
  const before = repository.snapshot();
  const parent = writeSet.provisions[0];
  const component = {
    ...buildProvisionComponent({
      source: context,
      parentProvision: parent,
      span: buildSemanticSpan(context, parent.absolute_start, parent.absolute_end),
      componentKey: 'REPRESENTATION_LIMB',
      ordinal: 1,
    }),
    closure_id: parent.closure_id,
  };
  const probes = [
    {
      label: 'extra provision field',
      mutate: (candidate) => {
        candidate.provisions[0].unbound = true;
      },
    },
    {
      label: 'string provision ordinal',
      mutate: (candidate) => {
        candidate.provisions[0].ordinal = '1';
      },
    },
    {
      label: 'incomplete party tuple',
      mutate: (candidate) => {
        delete candidate.provisions[0].party.capacity;
      },
    },
    {
      label: 'non-token provision concept',
      mutate: (candidate) => {
        candidate.provisions[0].concept_key = '\t';
      },
    },
    {
      label: 'extra component field',
      mutate: (candidate) => {
        candidate.components[0].unbound = true;
      },
    },
    {
      label: 'string component offset',
      mutate: (candidate) => {
        candidate.components[0].absolute_start = '0';
      },
    },
    {
      label: 'non-token component key',
      mutate: (candidate) => {
        candidate.components[0].component_key = '\u00a0';
      },
    },
  ];

  for (const [index, probe] of probes.entries()) {
    const candidate = structuredClone(writeSet);
    candidate.components = [structuredClone(component)];
    probe.mutate(candidate);
    await assert.rejects(
      writer.write({
        operation: 'DEAL_SCOPE_RUN',
        idempotencyKey: `closed-structural-row-${index}`,
        writeSet: candidate,
      }),
      (error) => error.code === 'CANONICAL_VALIDATION_ERROR',
      probe.label,
    );
    assert.deepEqual(repository.snapshot(), before);
  }
});

test('a later deal-scope run validates against exact persisted objects and writes only its new claim', async () => {
  const { repository, writer, writeSet } = await setup();
  await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'persisted-reference-predecessor',
    writeSet,
  });
  const predecessor = repository.snapshot();
  const validationClosureId = digest('closure:qxo-capitalisation-v2');
  const predecessorClaim = writeSet.claims[0];
  const claim = buildClaimRevision({
    subject_occurrence_id: predecessorClaim.subject_occurrence_id,
    claim_definition_key: predecessorClaim.claim_definition_key,
    ordinal: 1,
    state: 'ABSENT',
    scope: {
      scope_closure_id: digest('scope:qxo-capitalisation-v2'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [writeSet.excerpts[0].excerpt_id],
      examined_interval_ids: [writeSet.excerpts[0].excerpt_id],
    },
  });
  const nextWriteSet = {
    ...structuredClone(writeSet),
    persisted_object_references: [
      await persistedReference(
        repository,
        'excerpts',
        writeSet.excerpts[0].excerpt_id,
        validationClosureId,
      ),
      await persistedReference(
        repository,
        'provisions',
        writeSet.provisions[0].provision_instance_id,
        validationClosureId,
      ),
    ],
    excerpts: [],
    provisions: [],
    claims: [{ ...claim, closure_id: validationClosureId }],
  };
  const first = await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'persisted-reference-successor',
    writeSet: nextWriteSet,
  });
  const replay = await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'persisted-reference-successor',
    writeSet: nextWriteSet,
  });
  const current = repository.snapshot();

  assert.equal(first.validation.counts.publishable, 1);
  assert.equal(replay.replayed, true);
  assert.deepEqual(current.excerpts, predecessor.excerpts);
  assert.deepEqual(current.provisions, predecessor.provisions);
  assert.equal(current.claims.length, predecessor.claims.length + 1);
  assert.deepEqual(current.claims.at(-1), nextWriteSet.claims[0]);

  const tampered = structuredClone(nextWriteSet);
  tampered.persisted_object_references[0].canonical_payload_digest = 'f'.repeat(64);
  const beforeTamper = repository.snapshot();
  await assert.rejects(writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'persisted-reference-tampered',
    writeSet: tampered,
  }), /did not resolve to exact stored content/);
  assert.deepEqual(repository.snapshot(), beforeTamper);
});

test('persisted references preserve an external repository payload digest', async () => {
  const initial = await setup();
  await initial.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'external-digest-predecessor',
    writeSet: initial.writeSet,
  });
  const predecessor = initial.repository.snapshot().excerpts[0];
  const externalDigest = digest('postgres-payload-digest');
  const repository = new InMemoryCanonicalRepository({
    persistedCanonicalObjects: [{
      object_kind: 'excerpts',
      canonical_payload_digest: externalDigest,
      canonical_payload: predecessor,
    }],
  });
  const [resolved] = await repository.resolvePersistedCanonicalObjectReferences([{
    object_kind: 'excerpts',
    object_id: predecessor.excerpt_id,
  }]);

  assert.equal(resolved.canonical_payload_digest, externalDigest);
  assert.deepEqual(resolved.canonical_payload, predecessor);
});

test('missing, unverified and mixed source references leave semantic state unchanged', async () => {
  const missingSetup = await setup();
  const missing = structuredClone(missingSetup.writeSet);
  missing.source_references[0].immutable_source_document_id = digest('missing-source');
  const missingBefore = missingSetup.repository.snapshot();
  await assert.rejects(missingSetup.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'missing-source',
    writeSet: missing,
  }), (error) => error.code === 'ADMITTED_SOURCE_REFERENCE_UNRESOLVED');
  assert.deepEqual(missingSetup.repository.snapshot(), missingBefore);

  const unverifiedSetup = await setup();
  unverifiedSetup.repository.state.sourceAdmissions[0].admission_state = 'PENDING';
  const unverifiedBefore = unverifiedSetup.repository.snapshot();
  await assert.rejects(unverifiedSetup.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'unverified-source',
    writeSet: unverifiedSetup.writeSet,
  }), (error) => error.code === 'IDENTITY_MISMATCH' || error.code === 'SOURCE_NOT_VERIFIED');
  assert.deepEqual(unverifiedSetup.repository.snapshot(), unverifiedBefore);

  const mixedSetup = await setup();
  const other = sourceChain('<body><p>Other admitted source.</p></body>', 'other');
  await admit(mixedSetup.writer, other);
  const otherReference = buildAdmittedSourceReference(sourceContext(other));
  const mixed = structuredClone(mixedSetup.writeSet);
  mixed.source_references[0].source_admission_manifest_id = otherReference.source_admission_manifest_id;
  const mixedBefore = mixedSetup.repository.snapshot();
  await assert.rejects(mixedSetup.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'mixed-source',
    writeSet: mixed,
  }), (error) => [
    'LINEAGE_MISMATCH',
    'SOURCE_NOT_VERIFIED',
    'IDENTITY_MISMATCH',
    'INCOMPLETE_ADMISSION',
  ].includes(error.code));
  assert.deepEqual(mixedSetup.repository.snapshot(), mixedBefore);
});

test('extra payload fields and frozen semantic failure write no semantic state', async () => {
  const extraSetup = await setup();
  const extraBefore = extraSetup.repository.snapshot();
  await assert.rejects(extraSetup.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'extra-source-payload',
    writeSet: { ...extraSetup.writeSet, conversion: extraSetup.chain.conversion },
  }), (error) => error.code === 'INVALID_DEAL_SCOPE_WRITE_SET');
  assert.deepEqual(extraSetup.repository.snapshot(), extraBefore);

  const invalidSetup = await setup();
  const invalid = structuredClone(invalidSetup.writeSet);
  invalid.claims[0].state = 'INVENTED_STATE';
  const invalidBefore = invalidSetup.repository.snapshot();
  await assert.rejects(invalidSetup.writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'invalid-semantic-state',
    writeSet: invalid,
  }), /outside the frozen contract/);
  assert.deepEqual(invalidSetup.repository.snapshot(), invalidBefore);
});

test('an injected final receipt failure rolls back every semantic object', async () => {
  const { repository, writer, writeSet } = await setup();
  const before = repository.snapshot();
  repository.injectFailureOnce('receipt');
  await assert.rejects(writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'semantic-receipt-failure',
    writeSet,
  }), (error) => error.code === 'INJECTED_REPOSITORY_FAILURE');
  assert.deepEqual(repository.snapshot(), before);
});
