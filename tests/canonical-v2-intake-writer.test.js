const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');

const contractBundle = compileFixtureContract();

function capture(responseText = '<html><body>Original agreement.</body></html>') {
  const retrievalUrl = 'https://www.sec.gov/Archives/edgar/data/1/agreement.htm';
  return buildSecEdgarIntakeCapture({
    retrieval_url: retrievalUrl,
    final_url: retrievalUrl,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-22T14:15:16.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(responseText),
  });
}

function setup() {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  return { repository, writer };
}

test('receipt-first intake does not require a semantic contract bundle', async () => {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const result = await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'contract-free-intake',
    dryRun: true,
    writeSet: { intake_capture: capture() },
  });
  assert.equal(result.validation.counts.publishable, 1);
  await assert.rejects(writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'missing-semantic-contract',
    dryRun: true,
    writeSet: {},
  }), /contract bundle must be an object/);
});

test('INTAKE_CAPTURE dry-run validates only its closed capture and opens no transaction', async () => {
  const { repository, writer } = setup();
  const result = await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-dry-run',
    dryRun: true,
    writeSet: { intake_capture: capture() },
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(result.validation.counts, {
    publishable: 1,
    residuals: 0,
    quarantinedClosures: 0,
  });
  assert.equal(repository.transactionCount, 0);
  assert.deepEqual(repository.snapshot().intakeCaptures, []);
});

test('INTAKE_CAPTURE commits exact bytes once and exact replay is idempotent', async () => {
  const { repository, writer } = setup();
  const intakeCapture = capture();
  const input = {
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-commit',
    writeSet: { intake_capture: intakeCapture },
  };

  const first = await writer.write(input);
  const replay = await writer.write(input);
  const state = repository.snapshot();

  assert.equal(repository.transactionCount, 1);
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.receiptId, first.receipt.receiptId);
  assert.deepEqual(state.intakeCaptures, [intakeCapture]);
  assert.equal(state.receipts.length, 1);
  assert.deepEqual(state.sources, []);
  assert.deepEqual(state.provisions, []);
  assert.deepEqual(state.claims, []);

  await assert.rejects(writer.write({
    ...input,
    writeSet: { intake_capture: capture('<html><body>Different agreement.</body></html>') },
  }), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(repository.snapshot(), state);
  assert.equal(repository.transactionCount, 1);
});

test('INTAKE_CAPTURE writeSet contains exactly intake_capture', async () => {
  const { repository, writer } = setup();
  await assert.rejects(writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-extra-key',
    writeSet: { intake_capture: capture(), claims: [] },
  }), (error) => error.code === 'INVALID_INTAKE_WRITE_SET');
  await assert.rejects(writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-missing-key',
    writeSet: {},
  }), (error) => error.code === 'INVALID_INTAKE_WRITE_SET');
  assert.equal(repository.transactionCount, 0);
});

test('same intake identity with changed content is rejected without changing state', async () => {
  const { repository, writer } = setup();
  const original = capture();
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-original',
    writeSet: { intake_capture: original },
  });
  const before = repository.snapshot();
  const changed = { ...original, retrieved_at: '2026-07-22T14:15:17.000Z' };

  await assert.rejects(writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-changed',
    writeSet: { intake_capture: changed },
  }), (error) => error.code === 'INTAKE_CAPTURE_MUTATED');
  await assert.rejects(repository.transaction(async (transaction) => {
    await transaction.writeIntakeCapture(changed);
  }), (error) => error.code === 'CANONICAL_IDENTITY_CONFLICT');
  assert.deepEqual(repository.snapshot(), before);
  assert.equal(repository.transactionCount, 2);
});

test('INTAKE_CAPTURE repository failure rolls back capture and receipt', async () => {
  const { repository, writer } = setup();
  repository.injectFailureOnce('receipt');

  await assert.rejects(writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'intake-failure',
    writeSet: { intake_capture: capture() },
  }), (error) => error.code === 'INJECTED_REPOSITORY_FAILURE');
  assert.equal(repository.transactionCount, 1);
  assert.deepEqual(repository.snapshot().intakeCaptures, []);
  assert.deepEqual(repository.snapshot().receipts, []);
});
