const REVIEW_PAGE_IDENTITY_KEYS = Object.freeze([
  'pointer_id',
  'serving_namespace_id',
  'corpus_release_id',
  'contract_fingerprint',
  'application_deal_id',
  'governed_deal_key',
  'deal_admission_id',
  'total_count',
]);

function sameReviewPageIdentity(left, right) {
  return Boolean(left && right) && REVIEW_PAGE_IDENTITY_KEYS.every((key) => left[key] === right[key]);
}

function assertReviewPageContinuation(currentEnvelope, nextEnvelope, expectedCursor) {
  if (!currentEnvelope || !nextEnvelope || !sameReviewPageIdentity(currentEnvelope, nextEnvelope)) {
    throw new Error('Certified Review page identity changed while loading.');
  }
  if (!expectedCursor || currentEnvelope.next_cursor !== expectedCursor) {
    throw new Error('Certified Review cursor changed while loading.');
  }
}

function appendReviewPage(currentState, nextEnvelope, nextItems, expectedCursor) {
  assertReviewPageContinuation(currentState?.envelope, nextEnvelope, expectedCursor);
  if (!Array.isArray(currentState.items) || !Array.isArray(nextItems)) {
    throw new Error('Certified Review page is malformed.');
  }
  const existing = new Set(currentState.items.map((item) => item?.key).filter(Boolean));
  const mergedItems = [
    ...currentState.items,
    ...nextItems.filter((item) => !item?.key || !existing.has(item.key)),
  ];
  if (mergedItems.length > nextEnvelope.total_count
    || (nextEnvelope.next_cursor === null && mergedItems.length !== nextEnvelope.total_count)
    || (nextEnvelope.next_cursor !== null && mergedItems.length >= nextEnvelope.total_count)) {
    throw new Error('Certified Review pagination ended before the complete result was loaded.');
  }
  return Object.freeze({
    ...currentState,
    loadingMore: false,
    paginationError: null,
    envelope: nextEnvelope,
    items: Object.freeze(mergedItems),
  });
}

module.exports = {
  REVIEW_PAGE_IDENTITY_KEYS,
  appendReviewPage,
  assertReviewPageContinuation,
  sameReviewPageIdentity,
};
