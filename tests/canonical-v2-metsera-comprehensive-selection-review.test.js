'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  REVIEW_SCHEMA,
  buildMetseraComprehensiveSelectionReview,
  validateMetseraComprehensiveSelectionReviewAgainstInputs,
} = require('../lib/canonical-v2/metsera-comprehensive-selection-review');
const {
  METSERA_DEAL_ID,
  METSERA_OCCURRENCE_ID,
} = require('../lib/canonical-v2/metsera-pilot-extension-proposal');
const { listRegisteredSectionFamilies } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { makeRecord } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';

function metseraReceipt() {
  return makeRecord({
    dealId: METSERA_DEAL_ID,
    occurrenceId: METSERA_OCCURRENCE_ID,
    url: METSERA_URL,
    sourceText: `<p>${[
      'SECTION 2.01. Effect on Capital Stock. Each share converts into the right to receive cash.',
      'SECTION 5.01. Conduct of Business of the Company. The Company shall not act outside the ordinary course.',
      'SECTION 6.03. Reasonable Best Efforts; Notification. The parties shall make HSR filings.',
      'SECTION 7.01. Conditions to Each Party’s Obligation. The merger is subject to conditions.',
      'SECTION 8.01. Termination. Each party may terminate after the outside date.',
    ].join('</p><p>')}</p>`,
  });
}

test('reports every registered Metsera family without treating static V1 files as evidence', () => {
  const review = buildMetseraComprehensiveSelectionReview({
    receipt_record: metseraReceipt(),
    repository_root: ROOT,
  });
  const registered = listRegisteredSectionFamilies();

  assert.equal(review.schema_version, REVIEW_SCHEMA);
  assert.equal(review.status, 'REVIEW_REQUIRED_NOT_AUTHORITY');
  assert.equal(review.scope, 'COMPLETE_METSERA_REGISTERED_FAMILY_REVIEW');
  assert.equal(review.source.occurrence_id, METSERA_OCCURRENCE_ID);
  assert.equal(review.authority.execution_authority, 'NONE');
  assert.equal(review.authority.provider_authority, 'NONE');
  assert.equal(review.authority.source_admission_authority, 'NONE');
  assert.equal(review.family_review_matrix.length, registered.length);
  assert.deepEqual(review.family_review_matrix.map((entry) => entry.family_id), registered);
  assert.ok(review.deterministic_candidate_work_items.length >= 4);
  assert.equal(review.rendered_surface_evidence_state, 'STATIC_EVIDENCE_INCOMPLETE');
  assert.equal(review.v1_rendered_surface_acquisition_plan.status, 'STATIC_EVIDENCE_INCOMPLETE');
  assert.equal(Object.hasOwn(review, 'v1_governed_family_evidence'), false);
  assert.ok(review.family_review_matrix.every((entry) => entry.rendered_surface_evidence_state === 'STATIC_EVIDENCE_INCOMPLETE'));
  assert.match(review.selection_boundary, /NO_WORK_ITEM_IS_SELECTED_OR_EXECUTABLE/);
});

test('fails closed on a non-Metsera source or a non-absolute V1 repository root', () => {
  const wrong = makeRecord({
    dealId: 'not-metsera',
    occurrenceId: 'METADATA/not-metsera',
    url: METSERA_URL,
    sourceText: 'Section 6.03 Reasonable Best Efforts; Notification. Text.',
  });
  assert.throws(
    () => buildMetseraComprehensiveSelectionReview({ receipt_record: wrong, repository_root: ROOT }),
    { code: 'METSERA_SOURCE_IDENTITY_MISMATCH' },
  );
  assert.throws(
    () => buildMetseraComprehensiveSelectionReview({ receipt_record: metseraReceipt(), repository_root: '.' }),
    { code: 'REPOSITORY_ROOT_REQUIRED' },
  );
});

test('recomputes the exact source receipt and the rendered-surface acquisition plan before accepting a review packet', () => {
  const review = buildMetseraComprehensiveSelectionReview({ receipt_record: metseraReceipt(), repository_root: ROOT });
  assert.doesNotThrow(() => validateMetseraComprehensiveSelectionReviewAgainstInputs({
    review,
    receipt_record: metseraReceipt(),
    repository_root: ROOT,
  }));
  const changedSource = makeRecord({
    dealId: METSERA_DEAL_ID,
    occurrenceId: METSERA_OCCURRENCE_ID,
    url: METSERA_URL,
    sourceText: '<p>SECTION 6.03. Reasonable Best Efforts; Notification. Different captured source text.</p>',
  });
  assert.throws(
    () => validateMetseraComprehensiveSelectionReviewAgainstInputs({
      review,
      receipt_record: changedSource,
      repository_root: ROOT,
    }),
    { code: 'METSERA_REVIEW_SOURCE_STALE_OR_SUBSTITUTED' },
  );
});

test('review module contains no provider, network, database, source admission, or execution launch path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/metsera-comprehensive-selection-review.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|provider_factory|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /REVIEW_REQUIRED_NOT_AUTHORITY/);
});
