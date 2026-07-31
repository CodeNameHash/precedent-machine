const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  AUTHORITY_STATE,
  PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
  SURFACES,
  compileProductResultSurfaceBindings,
} = require('../lib/canonical-v2/product-result-surface-bindings');

test('has one closed renderer-neutral four-surface contract', () => {
  assert.equal(
    PRODUCT_RESULT_SURFACE_BINDING_SCHEMA,
    'PRODUCT_RESULT_SURFACE_BINDING/V1',
  );
  assert.deepEqual(SURFACES, [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  assert.equal(AUTHORITY_STATE, 'NOT_GRANTED');
});

test('fails closed without the complete checked Product inputs', () => {
  assert.throws(
    () => compileProductResultSurfaceBindings({}),
    { code: 'INVALID_PRODUCT_RESULT_SURFACE_BINDING_INPUT' },
  );
});

test('uses existing Product validators and forbids fallback market wording', () => {
  const source = fs.readFileSync(require.resolve(
    '../lib/canonical-v2/product-result-surface-bindings',
  ), 'utf8');
  assert.match(source, /canonicalProductQueryIrBytes/);
  assert.match(source, /validateProductQueryResult/);
  assert.match(source, /validateProductResultPresentation/);
  assert.doesNotMatch(source, /no.market.data|NO_MARKET_DATA/i);
  assert.doesNotMatch(
    source,
    /supabase|canonical-writer|database.*write|production/i,
  );
});

test('requires the external source action to equal the exact Product result action', () => {
  const source = fs.readFileSync(require.resolve(
    '../lib/canonical-v2/product-result-surface-bindings',
  ), 'utf8');
  assert.match(source, /exact_detail_action !== result\.exact_detail_action/);
  assert.match(source, /canonicalJson\(sourceAction\.exact_citation\)/);
  assert.match(source, /The source action does not preserve the Product result evidence/);
});
