const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendReviewPage,
  assertReviewPageContinuation,
  sameReviewPageIdentity,
} = require('../lib/canonical-v2/review-pagination');

function envelope(overrides = {}) {
  return {
    pointer_id: 'pointer',
    serving_namespace_id: 'namespace',
    corpus_release_id: 'release',
    contract_fingerprint: 'contract',
    application_deal_id: 'application-a',
    governed_deal_key: 'deal:a',
    deal_admission_id: 'admission-a',
    total_count: 101,
    page_count: 100,
    next_cursor: 'row-100',
    ...overrides,
  };
}

test('Review appends a real 101-row sequence without duplicating the boundary row', () => {
  const firstItems = Array.from({ length: 100 }, (_, index) => ({ key: `row-${index + 1}` }));
  const current = {
    loading: false,
    loadingMore: true,
    error: null,
    paginationError: null,
    envelope: envelope(),
    items: firstItems,
  };
  const next = envelope({ page_count: 1, next_cursor: null });
  const appended = appendReviewPage(
    current,
    next,
    [{ key: 'row-100' }, { key: 'row-101' }],
    'row-100',
  );
  assert.equal(appended.items.length, 101);
  assert.equal(appended.items.at(-1).key, 'row-101');
  assert.equal(appended.envelope.next_cursor, null);
  assert.equal(appended.loadingMore, false);
});

test('a deferred page from deal A cannot be appended after navigation to deal B', () => {
  const dealA = envelope();
  const dealB = envelope({
    application_deal_id: 'application-b',
    governed_deal_key: 'deal:b',
    deal_admission_id: 'admission-b',
  });
  assert.equal(sameReviewPageIdentity(dealA, dealB), false);
  assert.throws(
    () => assertReviewPageContinuation(dealB, envelope({ next_cursor: null }), 'row-100'),
    /identity changed/,
  );
});

test('Review refuses a terminal short page that would silently truncate the result', () => {
  const current = {
    envelope: envelope(),
    items: Array.from({ length: 100 }, (_, index) => ({ key: `row-${index + 1}` })),
  };
  assert.throws(
    () => appendReviewPage(
      current,
      envelope({ page_count: 0, next_cursor: null }),
      [],
      'row-100',
    ),
    /complete result/,
  );
});
