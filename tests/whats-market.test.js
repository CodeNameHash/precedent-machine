const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../lib/query/whats-market.js');
});

test('blank what’s-market input requests a full corpus overview', () => {
  const intent = mod.resolveWhatsMarketIntent('');
  assert.equal(intent.kind, 'MARKET_OVERVIEW');
  assert.equal(intent.scope, 'corpus');
  assert.ok(intent.sections.includes('COVENANT_INTERIM_OPERATING'));
});

test('specific feature input resolves to a stable market key', () => {
  const intent = mod.resolveWhatsMarketIntent('How common are prior written consent exceptions in affirmative IOCs?');
  assert.equal(intent.kind, 'MARKET_TERM');
  assert.equal(intent.provision_type, 'COVENANT_INTERIM_OPERATING');
  assert.equal(intent.field, 'permittedExceptions');
  assert.equal(intent.marketKey, 'feature.permittedExceptions');
});

test('provision input requests a provision-level market summary', () => {
  const intent = mod.resolveWhatsMarketIntent('What’s market on matching rights?');
  assert.equal(intent.kind, 'MARKET_PROVISION');
  assert.equal(intent.provision_type, 'COVENANT_NO_SOLICITATION');
});

test('unrecognized natural language remains an explicit market search', () => {
  const intent = mod.resolveWhatsMarketIntent('How do parties allocate cyber incident risk?');
  assert.equal(intent.kind, 'MARKET_SEARCH');
  assert.equal(intent.query, 'How do parties allocate cyber incident risk?');
});

test('payload carries the same deal filter used by the index query box', () => {
  const payload = mod.whatsMarketPayload('termination fees', { sector: 'Technology' });
  assert.deepEqual(payload.deal_filter, { sector: 'Technology' });
});
