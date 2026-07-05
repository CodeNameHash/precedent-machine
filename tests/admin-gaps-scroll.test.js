const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin gaps deep links scroll selected G and U reader panels into view', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /const gapReaderRef = useRef\(null\)/);
  assert.match(source, /const needsCodeReaderRef = useRef\(null\)/);
  assert.match(source, /selectedDealId \|\| selectedGapId \|\| selectedNeedsCodeId/);
  assert.match(source, /selectedGapId[\s\S]*scrollIntoView\(gapReaderRef\)/);
  assert.match(source, /selectedNeedsCodeId[\s\S]*scrollIntoView\(needsCodeReaderRef\)/);
  assert.match(source, /ref=\{gapReaderRef\}/);
  assert.match(source, /ref=\{needsCodeReaderRef\}/);
});
