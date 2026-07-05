const assert = require('node:assert/strict');
const test = require('node:test');

const {
  designPreviewEnabled,
  designPreviewServerSideProps,
} = require('../lib/design/route-guard');

test('design preview is hidden on production builds by default', () => {
  const env = { NODE_ENV: 'production', VERCEL_ENV: 'production' };

  assert.equal(designPreviewEnabled(env), false);
  assert.deepEqual(designPreviewServerSideProps(env), { notFound: true });
});

test('design preview remains visible in local development and Vercel preview builds', () => {
  assert.equal(designPreviewEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(designPreviewEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), true);
  assert.deepEqual(designPreviewServerSideProps({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), { props: {} });
});

test('design preview can be explicitly enabled or disabled', () => {
  assert.equal(designPreviewEnabled({ NODE_ENV: 'production', ENABLE_DESIGN_PREVIEW: '1' }), true);
  assert.equal(designPreviewEnabled({ NODE_ENV: 'development', ENABLE_DESIGN_PREVIEW: '0' }), false);
});
