const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('deal-to-market uses a typed searchable picker and preserves comparison filters', () => {
  const picker = source('components/query/DealPicker.jsx');
  const launcher = source('components/query/QueryLaunchBox.jsx');
  assert.match(picker, /Type a buyer or target/);
  assert.match(picker, /dealPickerLabel\(deal\)\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(launcher, /comparison_set_filter:\s*dealFilter/);
  assert.match(launcher, /<DealPicker[^>]+value=\{dtmDealId\}/);
});

test('query results expose reusable refinements and fee-side switching', () => {
  const page = source('pages/query/[kind]/[id].js');
  for (const facet of ['buyer', 'sector', 'signing_year', 'merger_form', 'law_firm', 'lawyer']) assert.match(page, new RegExp(`'${facet}'`));
  assert.match(page, /showSearch/);
  assert.match(page, /reverseFeePctOfDealValue/);
});
