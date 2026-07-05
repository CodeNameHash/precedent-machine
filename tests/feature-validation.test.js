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

test('taxonomy-backed enum fields accept tagged and citable-tagged values', () => {
  const anti = validateFeatures('ANTI', {
    effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
  });
  assert.deepEqual(anti, { errors: [], warnings: [] });

  const nosol = validateFeatures('NOSOL', {
    canonicalCode: 'NOSOL-PROHIBIT',
    representativesStandard: {
      value: { code: 'RBE_NOT_TO', label: 'Reasonable best efforts to cause not to', text: 'reasonable best efforts to cause' },
      quotes: [],
    },
    interveningEventScope: {
      value: { code: 'POSITIVE_ONLY', label: 'Positive only', text: 'shall not include any Company Takeover Proposal' },
      quotes: [],
    },
  });
  assert.deepEqual(nosol, { errors: [], warnings: [] });

  const rep = validateFeatures('REP-T', {
    canonicalCode: 'REP-T-NOCHANGE',
    absenceOfChangesType: {
      value: { code: 'GENERAL_ORDINARY_COURSE', label: 'General operating covenant', text: 'ordinary course' },
      quotes: [],
    },
  });
  assert.deepEqual(rep, { errors: [], warnings: [] });
});

test('taxonomy-backed text fields accept tagged standard objects', () => {
  const r = validateFeatures('NOSOL', {
    canonicalCode: 'NOSOL-CEASE',
    ceaseDiscussionsAffiliateStandard: {
      code: 'RBE_NOT_TO',
      label: 'Reasonable best efforts to cause',
      text: 'shall use reasonable best efforts to cause its Representatives to cease',
    },
  });
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test('taxonomy-backed legacy enum fields accept newer materiality and knowledge codes', () => {
  const bringDown = validateFeatures('REP-B', {
    canonicalCode: 'REP-B-LIT',
    bringDownStandard: {
      code: 'MAT_MAE_AGGREGATE',
      label: 'Would not, individually or in aggregate, have MAE',
      text: 'except as would not, individually or in the aggregate, reasonably be expected to have a Parent Material Adverse Effect',
    },
  });
  assert.deepEqual(bringDown, { errors: [], warnings: [] });

  const knowledge = validateFeatures('DEF', {
    canonicalCode: 'DEF-KNOWLEDGE',
    knowledgeStandard: { code: 'ACTUAL', label: 'Actual knowledge', text: 'actual knowledge' },
  });
  assert.deepEqual(knowledge, { errors: [], warnings: [] });
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

test('flags novelty channel is valid on every type, but must be a list', () => {
  const ok = validateFeatures('NOSOL', {
    flags: [{ concern: 'Two-tier match right with asymmetric windows', text: 'verbatim…' }],
  });
  assert.deepEqual(ok, { errors: [], warnings: [] });
  const alsoOk = validateFeatures('TERMF', { flags: [] });
  assert.equal(alsoOk.warnings.length, 0);
  const bad = validateFeatures('TERMF', { flags: { concern: 'not-a-list' } });
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.errors[0].key, 'flags');
});
