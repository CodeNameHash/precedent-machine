'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

test('employee comparison-group enums render as plain labels', async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../lib/employee-benefits.js')).href;
  const { comparisonGroupLabel } = await import(moduleUrl);

  assert.equal(comparisonGroupLabel('TARGET_PRE_CLOSING'), 'Company pre-closing arrangements');
  assert.equal(comparisonGroupLabel('BUYER_SIMILARLY_SITUATED'), 'Similarly-situated buyer employees');
  assert.doesNotMatch(comparisonGroupLabel('TARGET_PRE_CLOSING'), /_/);
});
