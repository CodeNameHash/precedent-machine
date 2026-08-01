'use strict';

/**
 * tests/canonical-v2-review-queue-artifact.test.js
 *
 * Test-first for lib/canonical-v2/native-producer/review-queue-artifact.js
 * (F28-THIRD-LIVE-RUN.md known-limitations register item 3 / final-audit
 * finding M4; design spec "Pinned implementation decisions": the resolver's
 * `review_queue` bucket is persisted as a content-addressed
 * `RESOLUTION_REVIEW_QUEUE/V1` JSON artifact alongside the run receipt).
 *
 * Covers: pure builder shape, pass-through fidelity (items unchanged),
 * content-addressed determinism, stable serialisation round-trip, and --
 * per the task's "loadable by scripts/queue-volume-dry-run.mjs's
 * loadQueueArtifact" requirement -- an actual round trip through that
 * script's own loader (imported directly, since it is ESM), proving the
 * artifact this module writes is exactly what that consumer expects.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  REVIEW_QUEUE_ARTIFACT_SCHEMA,
  ReviewQueueArtifactError,
  buildReviewQueueArtifact,
  serialiseReviewQueueArtifact,
} = require('../lib/canonical-v2/native-producer/review-queue-artifact');

const QUEUE_VOLUME_DRY_RUN_SCRIPT = path.join(__dirname, '..', 'scripts', 'queue-volume-dry-run.mjs');

function loadQueueVolumeDryRun() {
  return import(`file://${QUEUE_VOLUME_DRY_RUN_SCRIPT}`);
}

const SAMPLE_ITEM_A = Object.freeze({
  generic_claim_key: 'REP-T-CAP::ACCURACY_QUALIFIER',
  section_reference: '3.1(b)',
  materiality_rank: 7,
  reasons: ['QUALIFIER_KIND_DISAGREEMENT'],
  normalised_phrase: 'true and correct in all material respects',
  attachment_position: 'CHAPEAU',
  concept_family: 'REP-T-CAP',
  closure_id: 'closure-a',
});

const SAMPLE_ITEM_B = Object.freeze({
  generic_claim_key: 'REP-T-CAP::KNOWLEDGE_QUALIFIER',
  section_reference: '3.1(b)',
  materiality_rank: 12,
  reasons: ['ASSERTION_SCOPE_AMBIGUOUS'],
  normalised_phrase: 'to the knowledge of the company',
  attachment_position: 'ITEM',
  concept_family: 'REP-T-CAP',
  closure_id: 'closure-b',
});

function sampleResolution(items = [SAMPLE_ITEM_A, SAMPLE_ITEM_B]) {
  return { review_queue: items };
}

test('buildReviewQueueArtifact: builds the RESOLUTION_REVIEW_QUEUE/V1 shape', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });

  assert.equal(artifact.schema_version, REVIEW_QUEUE_ARTIFACT_SCHEMA);
  assert.equal(artifact.schema_version, 'RESOLUTION_REVIEW_QUEUE/V1');
  assert.equal(artifact.run_receipt_id, 'run-receipt-abc123');
  assert.ok(Array.isArray(artifact.review_queue));
  assert.equal(artifact.review_queue.length, 2);
  assert.equal(typeof artifact.review_queue_artifact_id, 'string');
  assert.ok(artifact.review_queue_artifact_id.length > 0);
});

test('buildReviewQueueArtifact: items pass through UNCHANGED, in order', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });

  assert.deepEqual(artifact.review_queue[0], SAMPLE_ITEM_A);
  assert.deepEqual(artifact.review_queue[1], SAMPLE_ITEM_B);
  // The ruling-corpus key triple every consumer script depends on survives
  // untouched.
  assert.equal(artifact.review_queue[0].normalised_phrase, SAMPLE_ITEM_A.normalised_phrase);
  assert.equal(artifact.review_queue[0].attachment_position, SAMPLE_ITEM_A.attachment_position);
  assert.equal(artifact.review_queue[0].concept_family, SAMPLE_ITEM_A.concept_family);
});

test('buildReviewQueueArtifact: preserves an empty review_queue', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution([]),
    run_receipt_id: 'run-receipt-empty',
  });
  assert.deepEqual(artifact.review_queue, []);
});

test('buildReviewQueueArtifact: is frozen (artifact and each item)', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.review_queue));
  assert.ok(Object.isFrozen(artifact.review_queue[0]));
});

test('buildReviewQueueArtifact: content-addressed and deterministic', () => {
  const artifactOne = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  const artifactTwo = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  assert.equal(artifactOne.review_queue_artifact_id, artifactTwo.review_queue_artifact_id);

  const artifactDifferentReceipt = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-different',
  });
  assert.notEqual(artifactOne.review_queue_artifact_id, artifactDifferentReceipt.review_queue_artifact_id);

  const artifactDifferentQueue = buildReviewQueueArtifact({
    resolution: sampleResolution([SAMPLE_ITEM_A]),
    run_receipt_id: 'run-receipt-abc123',
  });
  assert.notEqual(artifactOne.review_queue_artifact_id, artifactDifferentQueue.review_queue_artifact_id);
});

test('buildReviewQueueArtifact: fails closed on malformed input', () => {
  assert.throws(() => buildReviewQueueArtifact({ resolution: null, run_receipt_id: 'x' }), ReviewQueueArtifactError);
  assert.throws(() => buildReviewQueueArtifact({ resolution: {}, run_receipt_id: 'x' }), ReviewQueueArtifactError);
  assert.throws(() => buildReviewQueueArtifact({ resolution: sampleResolution(), run_receipt_id: '' }), ReviewQueueArtifactError);
  assert.throws(() => buildReviewQueueArtifact({ resolution: sampleResolution() }), ReviewQueueArtifactError);
});

test('serialiseReviewQueueArtifact: stable JSON round-trips to an equivalent artifact', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  const serialised = serialiseReviewQueueArtifact(artifact);
  assert.equal(typeof serialised, 'string');

  const parsed = JSON.parse(serialised);
  assert.equal(parsed.schema_version, 'RESOLUTION_REVIEW_QUEUE/V1');
  assert.equal(parsed.run_receipt_id, artifact.run_receipt_id);
  assert.deepEqual(parsed.review_queue, artifact.review_queue);
  assert.equal(parsed.review_queue_artifact_id, artifact.review_queue_artifact_id);
});

test('serialiseReviewQueueArtifact: byte-stable across repeated calls', () => {
  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  assert.equal(serialiseReviewQueueArtifact(artifact), serialiseReviewQueueArtifact(artifact));
});

test('round trip: written artifact is loadable by queue-volume-dry-run.mjs loadQueueArtifact', async () => {
  const { loadQueueArtifact } = await loadQueueVolumeDryRun();

  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution(),
    run_receipt_id: 'run-receipt-abc123',
  });
  const serialised = serialiseReviewQueueArtifact(artifact);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-queue-artifact-'));
  const filePath = path.join(dir, 'review-queue.json');
  fs.writeFileSync(filePath, serialised);

  const loaded = loadQueueArtifact(filePath);
  assert.equal(loaded.review_queue.length, 2);
  assert.deepEqual(loaded.review_queue[0], SAMPLE_ITEM_A);
  assert.deepEqual(loaded.review_queue[1], SAMPLE_ITEM_B);
  // queue-volume-dry-run.mjs's deal-id fallback chain: no deal_key/
  // document_hash on this artifact, so it falls back to the file's own
  // basename -- proving the loader does not choke on their absence.
  assert.equal(loaded.deal_id, 'review-queue');
});

test('round trip: an empty review_queue is also loadable by queue-volume-dry-run.mjs', async () => {
  const { loadQueueArtifact } = await loadQueueVolumeDryRun();

  const artifact = buildReviewQueueArtifact({
    resolution: sampleResolution([]),
    run_receipt_id: 'run-receipt-empty',
  });
  const serialised = serialiseReviewQueueArtifact(artifact);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-queue-artifact-'));
  const filePath = path.join(dir, 'queue-empty.json');
  fs.writeFileSync(filePath, serialised);

  const loaded = loadQueueArtifact(filePath);
  assert.deepEqual(loaded.review_queue, []);
});
