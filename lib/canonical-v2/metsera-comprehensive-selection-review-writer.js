'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const {
  REVIEW_SCHEMA,
  buildMetseraComprehensiveSelectionReview,
  validateMetseraComprehensiveSelectionReview,
  validateMetseraComprehensiveSelectionReviewAgainstInputs,
} = require('./metsera-comprehensive-selection-review');

const OUTPUT_DIRECTORY = 'm3-metsera-comprehensive-selection-review';

class MetseraComprehensiveSelectionReviewWriterError extends Error {
  constructor(code, message) { super(message); this.name = 'MetseraComprehensiveSelectionReviewWriterError'; this.code = code; }
}

function fail(code, message) { throw new MetseraComprehensiveSelectionReviewWriterError(code, message); }

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function readIfPresent(file) {
  try { return fs.readFileSync(file); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('METSERA_REVIEW_OUTPUT_READ_FAILED', `Could not read Metsera review output: ${error.message}`);
  }
}

function tripleRebuildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot } = {}) {
  const first = buildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot });
  const second = buildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot });
  const third = buildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot });
  validateMetseraComprehensiveSelectionReviewAgainstInputs({
    review: first,
    receipt_record: receiptRecord,
    repository_root: repositoryRoot,
  });
  if (canonicalJson(first) !== canonicalJson(second) || canonicalJson(first) !== canonicalJson(third)) {
    fail('METSERA_REVIEW_TRIPLE_REBUILD_MISMATCH', 'Metsera selection review did not rebuild identically three times.');
  }
  const explicit = [
    first.input_digests.source_record_digest,
    first.input_digests.v1_rendered_surface_acquisition_plan_digest,
    first.input_digests.implementation_digest,
  ];
  if (new Set(explicit).size !== explicit.length) {
    fail('METSERA_REVIEW_EXPLICIT_DIGESTS_INVALID', 'Metsera source, rendered-surface plan, and implementation digests must remain distinct.');
  }
  return first;
}

function writeContentAddressedMetseraComprehensiveSelectionReview({ artifact_root: artifactRoot, review } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  validateMetseraComprehensiveSelectionReview(review);
  if (review.schema_version !== REVIEW_SCHEMA || review.status !== 'REVIEW_REQUIRED_NOT_AUTHORITY') {
    fail('METSERA_REVIEW_STATUS_INVALID', 'Only a review-only Metsera selection packet may be materialised.');
  }
  const outputDirectory = path.join(root, OUTPUT_DIRECTORY);
  const outputPath = path.join(outputDirectory, `review-${review.review_id}.json`);
  if (!isInside(root, outputDirectory) || !isInside(root, outputPath)) {
    fail('METSERA_REVIEW_OUTPUT_PATH_INVALID', 'Metsera review output must stay beneath the explicit durable artifact root.');
  }
  const bytes = Buffer.from(`${JSON.stringify(review, null, 2)}\n`, 'utf8');
  const existing = readIfPresent(outputPath);
  if (existing) {
    if (!existing.equals(bytes)) fail('CONTENT_ADDRESS_COLLISION', 'Refusing to overwrite different bytes at the Metsera review path.');
    return Object.freeze({ status: 'ALREADY_PRESENT', review_id: review.review_id, output_path: outputPath });
  }
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(outputDirectory, `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`);
  let temporaryCreated = false;
  try {
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally { fs.closeSync(descriptor); }
    try {
      fs.linkSync(temporaryPath, outputPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const concurrent = readIfPresent(outputPath);
      if (!concurrent || !concurrent.equals(bytes)) {
        fail('CONTENT_ADDRESS_COLLISION', 'A concurrent writer created different bytes at the Metsera review path.');
      }
      return Object.freeze({ status: 'ALREADY_PRESENT', review_id: review.review_id, output_path: outputPath });
    }
    const directoryDescriptor = fs.openSync(outputDirectory, 'r');
    try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }
    return Object.freeze({ status: 'WRITTEN', review_id: review.review_id, output_path: outputPath });
  } catch (error) {
    if (error instanceof MetseraComprehensiveSelectionReviewWriterError) throw error;
    fail('METSERA_REVIEW_OUTPUT_WRITE_FAILED', `Could not atomically write Metsera review output: ${error.message}`);
  } finally {
    if (temporaryCreated) {
      try { fs.unlinkSync(temporaryPath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    }
  }
}

function tripleRebuildAndWriteMetseraComprehensiveSelectionReview({
  receipt_record: receiptRecord,
  repository_root: repositoryRoot,
  artifact_root: artifactRoot,
} = {}) {
  if (typeof artifactRoot !== 'string' || artifactRoot.length === 0) {
    fail('DURABLE_ARTIFACT_ROOT_REQUIRED', 'An explicit durable artifact root is required.');
  }
  const review = tripleRebuildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot });
  return writeContentAddressedMetseraComprehensiveSelectionReview({ artifact_root: artifactRoot, review });
}

module.exports = {
  OUTPUT_DIRECTORY,
  MetseraComprehensiveSelectionReviewWriterError,
  tripleRebuildMetseraComprehensiveSelectionReview,
  writeContentAddressedMetseraComprehensiveSelectionReview,
  tripleRebuildAndWriteMetseraComprehensiveSelectionReview,
};
