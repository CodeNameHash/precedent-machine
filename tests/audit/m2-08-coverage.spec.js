const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCoverage,
  coverageMarkdown,
} = require('../../scripts/audit/m2-08-coverage');

test('M2-08 coverage audit covers every legacy layout surface', () => {
  const rows = buildCoverage();
  assert.equal(rows.length, 16);
  assert.equal(rows.filter((row) => row.status === 'covered').length, 16);
  assert.equal(rows.filter((row) => row.legacy_status === 'gap' && row.status === 'covered').length, 9);
  assert.deepEqual(rows.filter((row) => row.status !== 'covered'), []);
});

test('M2-08 coverage markdown records zero uncovered surfaces', () => {
  const markdown = coverageMarkdown(buildCoverage(), '2026-07-08T00:00:00.000Z');
  assert.match(markdown, /Surface coverage: 16\/16 \(100%\)/);
  assert.match(markdown, /Step 1 gap coverage: 9\/9 \(100%\)/);
  assert.match(markdown, /No intentionally uncovered legacy surface remains/);
});
