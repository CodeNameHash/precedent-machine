const test = require('node:test');
const assert = require('node:assert/strict');

const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

function sourceAdmission(html = '<body><p>Section 5.2. Four business days.</p></body>') {
  const url = 'https://www.sec.gov/Archives/edgar/data/1/qxo.htm';
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-22T15:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const source_admission_bundle = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const artifact = buildSourceArtifactChunks(conversion);
  const capture_reference = {
    schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_response_content_id: capture.source_response_content_id,
  };
  const writeSet = {
    capture_reference,
    conversion_artifact_manifest: artifact.manifest,
    verification,
    source_admission_bundle,
  };
  return { capture, conversion, verification, source_admission_bundle, artifact, writeSet };
}

async function commitIntake(writer, capture) {
  return writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `intake:${capture.intake_capture_receipt_id}`,
    writeSet: { intake_capture: capture },
  });
}

async function stageArtifact(writer, artifact, chunks = artifact.chunks) {
  for (const chunk of chunks) {
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `artifact:${chunk.chunk_id}`,
      writeSet: {
        source_artifact_manifest: artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
}

test('source artifact staging writes one bounded chunk transactionally and replays exactly', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission();
  const chunk = source.artifact.chunks[0];
  const input = {
    operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
    idempotencyKey: `artifact:${chunk.chunk_id}`,
    writeSet: {
      source_artifact_manifest: source.artifact.manifest,
      source_artifact_chunk: chunk,
    },
  };

  const first = await writer.write(input);
  const replay = await writer.write(input);
  const state = repository.snapshot();
  assert.equal(first.receipt.publishableObjectCount, 2);
  assert.equal(replay.replayed, true);
  assert.deepEqual(state.sourceArtifactManifests, [source.artifact.manifest]);
  assert.deepEqual(state.sourceArtifactChunks, [chunk]);
  assert.equal(repository.transactionCount, 1);

  await assert.rejects(writer.write({
    ...input,
    writeSet: { ...input.writeSet, unexpected: true },
  }), (error) => error.code === 'INVALID_SOURCE_ARTIFACT_WRITE_SET');
});

test('source artifact staging failure rolls back its manifest, chunk and receipt', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission();
  const chunk = source.artifact.chunks[0];
  repository.injectFailureOnce('source_artifact_chunk');

  await assert.rejects(writer.write({
    operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
    idempotencyKey: 'artifact-failure',
    writeSet: {
      source_artifact_manifest: source.artifact.manifest,
      source_artifact_chunk: chunk,
    },
  }), (error) => error.code === 'INJECTED_REPOSITORY_FAILURE');
  const state = repository.snapshot();
  assert.equal(state.sourceArtifactManifests, undefined);
  assert.equal(state.sourceArtifactChunks, undefined);
  assert.deepEqual(state.receipts, []);
});

test('source admission dry-run reconstructs staged conversion and writes nothing', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission();
  await commitIntake(writer, source.capture);
  await stageArtifact(writer, source.artifact);
  const before = repository.snapshot();
  const transactionsBefore = repository.transactionCount;

  const result = await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-dry-run',
    dryRun: true,
    writeSet: source.writeSet,
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(result.validation.counts, {
    publishable: 6,
    residuals: 0,
    quarantinedClosures: 0,
  });
  assert.deepEqual(result.validation.resolved.conversion, source.conversion);
  assert.equal(repository.transactionCount, transactionsBefore);
  assert.deepEqual(repository.snapshot(), before);
});

test('source admission has an exact closed reference-only writeSet', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission();

  await assert.rejects(writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-extra',
    dryRun: true,
    writeSet: { ...source.writeSet, conversion: source.conversion },
  }), (error) => error.code === 'INVALID_SOURCE_ADMISSION_WRITE_SET');
  const missing = { ...source.writeSet };
  delete missing.verification;
  await assert.rejects(writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-missing',
    dryRun: true,
    writeSet: missing,
  }), (error) => error.code === 'INVALID_SOURCE_ADMISSION_WRITE_SET');
  assert.equal(repository.transactionCount, 0);
});

test('commit requires both the exact intake capture and complete staged artifact', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission(`<body><p>${'Four business days. '.repeat(20000)}</p></body>`);

  await assert.rejects(writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-before-intake',
    writeSet: source.writeSet,
  }), (error) => error.code === 'INTAKE_CAPTURE_NOT_FOUND');
  await commitIntake(writer, source.capture);
  await stageArtifact(writer, source.artifact, source.artifact.chunks.slice(0, -1));
  const before = repository.snapshot();
  await assert.rejects(writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-incomplete-artifact',
    writeSet: source.writeSet,
  }), (error) => error.code === 'SOURCE_ARTIFACT_INCOMPLETE');
  assert.deepEqual(repository.snapshot(), before);
});

test('source admission commits its reconstructed verified chain transactionally', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const source = sourceAdmission();
  await commitIntake(writer, source.capture);
  await stageArtifact(writer, source.artifact);
  const input = {
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'source-admission-commit',
    writeSet: source.writeSet,
  };

  const first = await writer.write(input);
  const replay = await writer.write(input);
  const state = repository.snapshot();
  const bundle = source.source_admission_bundle;

  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.receiptId, first.receipt.receiptId);
  assert.deepEqual(state.canonicalTextConversions, [source.conversion]);
  assert.deepEqual(state.verificationManifests, [source.verification]);
  assert.deepEqual(state.sources, [bundle.immutable_source_document]);
  assert.deepEqual(state.sourceAdmissions, [bundle.source_admission_manifest]);
  assert.deepEqual(state.sourceAdmissionPreparationReceipts, [
    bundle.source_admission_preparation_receipt,
  ]);
  assert.deepEqual(state.semanticExtractionInputEnvelopes, [
    bundle.semantic_extraction_input_envelope,
  ]);
  assert.equal(state.receipts.filter(
    (row) => row.operation === 'PREPARE_SOURCE_ADMISSION',
  ).length, 1);

  const changed = sourceAdmission('<body><p>Changed source.</p></body>');
  await assert.rejects(writer.write({
    ...input,
    writeSet: changed.writeSet,
  }), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(repository.snapshot(), state);
});

test('a source-admission repository failure leaves no partial admitted chain', async () => {
  for (const failureStep of ['source_admission_preparation_receipt', 'receipt']) {
    const repository = new InMemoryCanonicalRepository();
    const writer = createCanonicalWriter({ repository });
    const source = sourceAdmission();
    await commitIntake(writer, source.capture);
    await stageArtifact(writer, source.artifact);
    const before = repository.snapshot();
    repository.injectFailureOnce(failureStep);

    await assert.rejects(writer.write({
      operation: 'PREPARE_SOURCE_ADMISSION',
      idempotencyKey: `source-admission-failure:${failureStep}`,
      writeSet: source.writeSet,
    }), (error) => error.code === 'INJECTED_REPOSITORY_FAILURE');
    assert.deepEqual(repository.snapshot(), before);
  }
});
