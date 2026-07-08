const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const src = fs.readFileSync('components/review/ProvisionCardTable.jsx', 'utf8');

test('ProvisionCardTable exposes the schema-first card surface', () => {
  assert.match(src, /data-testid="provision-card-table"/);
  assert.match(src, /data-testid="provision-card-section"/);
  assert.match(src, /data-testid="provision-card"/);
  assert.match(src, /reviewDeal\?\.sections/);
});

test('ProvisionCardTable gives definitions their own section and visual treatment', () => {
  assert.match(src, /data-testid="definition-card-tab"/);
  assert.match(src, /data-testid="definition-card-body"/);
  assert.match(src, /card\.defined_term/);
  assert.match(src, /card\.defined_value/);
});

test('ProvisionCardTable hover-expands cross references and shows provenance', () => {
  assert.match(src, /card\.resolvedReferences/);
  assert.match(src, /data-testid="card-crossref-hover"/);
  assert.match(src, /group-hover:block/);
  assert.match(src, /data-testid="provision-card-provenance"/);
  assert.match(src, /provenance\.source_doc_id/);
  assert.match(src, /card\.provision_instance_id/);
});
