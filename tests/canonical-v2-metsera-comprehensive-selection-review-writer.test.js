'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { METSERA_DEAL_ID, METSERA_OCCURRENCE_ID } = require('../lib/canonical-v2/metsera-pilot-extension-proposal');
const {
  OUTPUT_DIRECTORY,
  tripleRebuildMetseraComprehensiveSelectionReview,
  writeContentAddressedMetseraComprehensiveSelectionReview,
  tripleRebuildAndWriteMetseraComprehensiveSelectionReview,
} = require('../lib/canonical-v2/metsera-comprehensive-selection-review-writer');
const { makeRecord } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';

function receipt() {
  return makeRecord({
    dealId: METSERA_DEAL_ID,
    occurrenceId: METSERA_OCCURRENCE_ID,
    url: METSERA_URL,
    sourceText: '<p>SECTION 6.03. Reasonable Best Efforts; Notification. The parties shall make HSR filings.</p>',
  });
}

function temporaryDurableRoot() {
  return fs.mkdtempSync(path.join(ROOT, '.metsera-review-writer-'));
}

test('triple-rebuilds exact source, rendered-surface plan, and implementation digests before one atomic content-addressed write', () => {
  const root = temporaryDurableRoot();
  try {
    const review = tripleRebuildMetseraComprehensiveSelectionReview({ receipt_record: receipt(), repository_root: ROOT });
    assert.ok(review.input_digests.source_record_digest);
    assert.ok(review.input_digests.v1_rendered_surface_acquisition_plan_digest);
    assert.ok(review.input_digests.implementation_digest);
    const first = writeContentAddressedMetseraComprehensiveSelectionReview({ artifact_root: root, review });
    assert.equal(first.status, 'WRITTEN');
    assert.equal(first.output_path, path.join(root, OUTPUT_DIRECTORY, `review-${review.review_id}.json`));
    assert.deepEqual(JSON.parse(fs.readFileSync(first.output_path, 'utf8')), review);
    const second = tripleRebuildAndWriteMetseraComprehensiveSelectionReview({
      receipt_record: receipt(), repository_root: ROOT, artifact_root: root,
    });
    assert.equal(second.status, 'ALREADY_PRESENT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refuses a content-address collision and a missing durable root', () => {
  const root = temporaryDurableRoot();
  try {
    const review = tripleRebuildMetseraComprehensiveSelectionReview({ receipt_record: receipt(), repository_root: ROOT });
    const directory = path.join(root, OUTPUT_DIRECTORY);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `review-${review.review_id}.json`), '{"different":true}\n');
    assert.throws(
      () => writeContentAddressedMetseraComprehensiveSelectionReview({ artifact_root: root, review }),
      { code: 'CONTENT_ADDRESS_COLLISION' },
    );
    assert.throws(
      () => tripleRebuildAndWriteMetseraComprehensiveSelectionReview({ receipt_record: receipt(), repository_root: ROOT }),
      { code: 'DURABLE_ARTIFACT_ROOT_REQUIRED' },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('writer contains no provider, extraction, admission, database, or production path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/metsera-comprehensive-selection-review-writer.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|provider_factory|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /tripleRebuildMetseraComprehensiveSelectionReview/);
});
