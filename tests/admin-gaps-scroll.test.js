const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin gaps deep links scroll selected G and U reader panels into view', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /const readerRef = useRef\(null\)/);
  assert.match(source, /const reviewReaderRef = useRef\(null\)/);
  assert.match(source, /selectedGapId \? `gap:\$\{selectedGapId\}`/);
  assert.match(source, /selectedNeedsCodeId \? `needs_code:\$\{selectedNeedsCodeId\}`/);
  assert.match(source, /selectedDealId[\s\S]*scrollIntoView\(readerRef\)/);
  assert.match(source, /selectedReviewKey[\s\S]*scrollIntoView\(reviewReaderRef\)/);
  assert.match(source, /ref=\{readerRef\}/);
  assert.match(source, /ref=\{reviewReaderRef\}/);
});
