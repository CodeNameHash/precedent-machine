'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildNoOtherRepsNativeFirstSlice,
} = require('../lib/canonical-v2/native-producer/no-other-reps-native-first-slice');

function skechersRow() {
  const fixture = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    'fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json',
  ), 'utf8'));
  const rows = Array.isArray(fixture) ? fixture : (fixture.cards || fixture.provisions || []);
  return rows.find((row) => row.provision_subtype === 'REP-T-NOREP');
}

test('the native first slice emits two evidence-bound Skechers element candidates', () => {
  const row = skechersRow();
  assert.ok(row);
  const result = buildNoOtherRepsNativeFirstSlice({
    source_id: row.id,
    source_text: row.primary_quote,
    section_ref: row.section_ref,
    representation_side: 'TARGET',
  });

  assert.equal(result.state, 'RESOLVED');
  assert.deepEqual(
    result.elements.map((element) => element.concept_code),
    ['REP-T-NOOTHERREPS', 'REP-T-NONRELIANCE'],
  );
  assert.deepEqual(result.review_items, []);
  assert.ok(Object.isFrozen(result));
  for (const element of result.elements) {
    assert.equal(
      row.primary_quote.slice(element.evidence.char_start, element.evidence.char_end),
      element.evidence.exact_text,
    );
  }
});

test('the native first slice preserves buyer-side fraud as its own approved element code', () => {
  const sourceText = [
    '(a) No Other Representations. No other representations or warranties are made.',
    '(b) Fraud Carve-Out. Notwithstanding the foregoing, nothing in this Section limits remedies for common law fraud.',
  ].join('\n\n');
  const result = buildNoOtherRepsNativeFirstSlice({
    source_id: 'fixture:buyer-fraud',
    source_text: sourceText,
    section_ref: '9.07',
    representation_side: 'BUYER',
  });

  assert.equal(result.state, 'RESOLVED');
  assert.deepEqual(
    result.elements.map((element) => element.concept_code),
    ['REP-B-NOOTHERREPS', 'REP-B-FRAUDCARVEOUT'],
  );
});

test('an unboundable compound is review-required and never publishes plausible sibling elements', () => {
  const sourceText = 'Except as set forth here, no other representations or warranties are made and neither party relies on outside statements, other than claims for fraud.';
  const first = buildNoOtherRepsNativeFirstSlice({
    source_id: 'fixture:ambiguous',
    source_text: sourceText,
    section_ref: '4.12',
    representation_side: 'BUYER',
  });
  const second = buildNoOtherRepsNativeFirstSlice({
    source_id: 'fixture:ambiguous',
    source_text: sourceText,
    section_ref: '4.12',
    representation_side: 'BUYER',
  });

  assert.equal(first.state, 'REVIEW_REQUIRED');
  assert.deepEqual(first.elements, []);
  assert.deepEqual(first.review_items, [{
    reason_code: 'UNBOUNDABLE_ELEMENT_SPANS',
    observed_code: 'REP-B-NOOTHERREPS',
  }]);
  assert.equal(first.element_candidate_set_id, second.element_candidate_set_id);
});
