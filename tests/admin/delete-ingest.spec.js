const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('legacy /ingest page is deleted', () => {
  assert.equal(fs.existsSync('pages/ingest.js'), false);
});

test('admin review surfaces no longer link to /ingest', () => {
  for (const file of ['pages/review/[id].js', 'pages/review/index.js', 'components/DealsTable.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /href=\{?[`"']\/ingest(?:[?"'`}]|$)/);
  }
});
