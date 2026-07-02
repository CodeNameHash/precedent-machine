/* Tests for lib/feature-validation.js — write-time schema enforcement. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateFeatures,
  validateProvisionRow,
  validationSummary,
  unwrap,
} = require('../lib/feature-validation');

test('unwrap opens citable wrappers and passes bare values through', () => {
  assert.equal(unwrap({ value: '3.5%', quotes: ['a fee of 3.5%'] }), '3.5%');
  assert.equal(unwrap({ value: true, text: 'legacy' }), true);
  assert.equal(unwrap('bare'), 'bare');
  assert.deepEqual(unwrap({ amount: '$5m' }), { amount: '$5m' }); // not citable
});

test('clean TERMF features validate with no violations', () => {
  const r = validateFeatures('TERMF', {
    mainConcept: 'Company pays $6.9m on Superior Proposal termination',
    companyTerminationFee: { amount: '$6,900,000', triggers: ['superior proposal'] },
    canonicalCode: 'TERMF-TARGET', // infra key — ignored
  });
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test('object where text is declared is an ERROR (the [object Object] class)', () => {
  const r = validateFeatures('TERMF', { mainConcept: { oops: 'an object' } });
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].key, 'mainConcept');
  assert.equal(r.errors[0].kind, 'shape');
});

test('citable wrapper around the right type is fine; around the wrong type is not', () => {
  const ok = validateFeatures('TERMF', { mainConcept: { value: 'summary', quotes: ['q'] } });
  assert.equal(ok.errors.length, 0);
  const bad = validateFeatures('TERMF', { mainConcept: { value: { nested: true }, quotes: ['q'] } });
  assert.equal(bad.errors.length, 1);
});

test('unknown keys warn (drift is counted, not fatal)', () => {
  const r = validateFeatures('TERMF', { totallyMadeUpKey: 'x' });
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].kind, 'unknown-key');
});

test('enum options are enforced as warnings', () => {
  // IOC.consentStandard is enum ['prior-written','not-unreasonably-withheld','sole-discretion']
  const bad = validateFeatures('IOC', { consentStandard: 'whenever-they-feel-like-it' });
  assert.equal(bad.warnings.some((w) => w.kind === 'enum-mismatch'), true);
  const ok = validateFeatures('IOC', { consentStandard: 'prior-written' });
  assert.equal(ok.warnings.filter((w) => w.kind === 'enum-mismatch').length, 0);
});

test('features that are not an object at all is an error', () => {
  const r = validateFeatures('TERMF', 'a string');
  assert.equal(r.errors[0].kind, 'malformed-features');
});

test('validateProvisionRow flags non-canonical favorability', () => {
  const r = validateProvisionRow({
    type: 'TERMF',
    ai_favorability: 'mystery-value',
    ai_metadata: { features: {} },
  });
  assert.equal(r.warnings.some((w) => w.kind === 'non-canonical'), true);
  const ok = validateProvisionRow({ type: 'TERMF', ai_favorability: 'pro-buyer', ai_metadata: { features: {} } });
  assert.equal(ok.warnings.length, 0); // synonym canonicalizes fine
});

test('validationSummary is null when clean (clean rows pay zero bytes)', () => {
  assert.equal(validationSummary({ errors: [], warnings: [] }), null);
  const s = validationSummary({ errors: [{ key: 'a' }], warnings: [{ key: 'b' }] });
  assert.equal(s.errors, 1);
  assert.equal(s.warnings, 1);
});
