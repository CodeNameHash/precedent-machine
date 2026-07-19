const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const src = fs.readFileSync('components/review/ProvisionCardTable.jsx', 'utf8');

test('ProvisionCardTable exposes the schema-first card surface', () => {
  assert.match(src, /data-testid="provision-card-table"/);
  assert.match(src, /data-testid="provision-card-section"/);
  assert.match(src, /data-testid="provision-card"/);
  // Q1 (perf quick-wins): sections/definitions are reconstructed from
  // cards[] client-side rather than read directly off reviewDeal, since the
  // API no longer ships them verbatim.
  assert.match(src, /reconstructReviewDeal/);
  assert.match(src, /shaped\?\.sections/);
});

test('ProvisionCardTable gives definitions their own section and visual treatment', () => {
  assert.match(src, /data-testid="definition-card-tab"/);
  assert.match(src, /data-testid="definition-card-body"/);
  assert.match(src, /card\.defined_term/);
  assert.match(src, /card\.defined_value/);
});

test('ProvisionCardTable hover-expands cross references and shows provenance', () => {
  // Perf fix (Jul 2026): resolvedReferences is no longer read as a static
  // field pre-computed for every card — it's resolved on demand at hover
  // time via useDefinitionResolver (idle-chunked prewarm + on-demand
  // fallback). The badge count comes from getResolvableCount (a cheap
  // Map-membership count — NOT card.references.length, which would show a
  // badge for cards whose references are all dangling and previously
  // rendered no badge at all); the resolved definitions' text only appears
  // once resolveReferences(card) has been called (see CrossReferenceBadge/
  // onMouseEnter).
  assert.match(src, /useDefinitionResolver/);
  assert.match(src, /getResolvableCount\(card\)/);
  assert.match(src, /resolveReferences\(card\)/);
  assert.match(src, /onMouseEnter/);
  assert.match(src, /data-testid="card-crossref-hover"/);
  assert.match(src, /group-hover:block/);
  assert.match(src, /data-testid="provision-card-provenance"/);
  assert.match(src, /provenance\.source_doc_id/);
  assert.match(src, /card\.provision_instance_id/);
});

test('ProvisionCardTable no longer computes resolvedReferences eagerly for every card up front', () => {
  const reconstructSrc = fs.readFileSync('lib/queries/reconstruct-review-deal.js', 'utf8');
  const fnStart = reconstructSrc.indexOf('function reconstructReviewDeal(');
  assert.ok(fnStart >= 0, 'reconstructReviewDeal not found');
  const fnEnd = reconstructSrc.indexOf('\nmodule.exports', fnStart);
  const fnBody = reconstructSrc.slice(fnStart, fnEnd >= 0 ? fnEnd : undefined);
  assert.doesNotMatch(fnBody, /resolvedReferences/, 'reconstructReviewDeal must not attach resolvedReferences eagerly');
  assert.match(reconstructSrc, /function resolveCardReferences/);
  assert.match(reconstructSrc, /function buildDefinitionsIndex/);
});
