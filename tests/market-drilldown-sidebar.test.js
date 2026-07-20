const test = require('node:test');
const assert = require('node:assert/strict');

// Pure helpers are exported from the sidebar so denominator/percentage behavior
// can be verified without depending on browser interaction.
let mod;
test.before(async () => {
  mod = await import('../components/review-v2/MarketDrilldownSidebar.jsx');
});

test('pct expresses exception prevalence against the supplied term denominator', () => {
  assert.equal(mod.pct(24, 36), '67%');
  assert.equal(mod.pct(0, 36), '0%');
  assert.equal(mod.pct(24, 0), null);
  assert.equal(mod.pct(null, 36), null);
});
