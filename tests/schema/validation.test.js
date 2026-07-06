const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  FEATURES,
  validation: {
    buildValidatorForFeature,
    buildValidatorForProvision,
    validateFeatures,
  },
} = require('../../lib/schema');
const legacy = require('../../lib/feature-validation');

const TOP_FEATURE_KEYS = [
  'materialityQualifier',
  'representativesStandard',
  'absenceOfChangesType',
  'acceptableConfidentialityAgreementDefinition',
  'antiClubbingWaiverPermitted',
  'bringDownStandard',
  'carveouts',
  'ceaseDiscussionsAffiliateStandard',
  'effortsStandard',
  'extendedNegotiatingPeriodDays',
  'fiduciaryEngageStandard',
  'fiduciaryFinalStandard',
  'forceTheVote',
  'forceTheVoteDetails',
  'goShopExcludedParties',
  'goShopPeriodDays',
  'goShopWindow',
  'initialMatchPeriodDays',
  'interveningEventDefinition',
  'interveningEventScope',
  'matchingPeriod',
  'materialContractsBuckets',
  'mergerForm',
  'mutualClosingDeadlineAfterConditionsDays',
  'noticeContent',
  'noticePeriod',
  'outsideDateMonths',
  'parentTerminationRightForNonsolicitBreach',
  'partyWhoCanTerminate',
  'permittedExceptions',
];

function pickTypeCode(feature) {
  const types = feature.provisionTypes || [];
  const codes = feature.provisionCodes || [];
  for (const type of types) {
    const code = codes.find((candidate) => candidate === type || candidate.startsWith(`${type}-`));
    if (code) return { type, code };
  }
  return { type: types[0], code: codes[0] || null };
}

function validValue(feature) {
  switch (feature.valueType) {
    case 'number':
      return 12;
    case 'enum':
      return feature.enumSet && feature.enumSet[0] ? feature.enumSet[0] : 'SAMPLE';
    case 'boolean':
      return true;
    case 'object':
      return { value: 'sample' };
    case 'list':
      return feature.listItemType === 'tag'
        ? [{ code: 'SAMPLE', label: 'Sample', text: 'sample' }]
        : [{ value: 'sample' }];
    case 'quote':
    case 'string':
    default:
      return 'sample';
  }
}

function invalidValue(feature) {
  switch (feature.valueType) {
    case 'list':
      return { not: 'a list' };
    case 'object':
      return ['not an object'];
    case 'boolean':
      return { not: true };
    case 'enum':
    case 'number':
    case 'quote':
    case 'string':
    default:
      return { not: 'a scalar' };
  }
}

test('schema validation exposes zod-backed feature and provision validators', () => {
  const feature = FEATURES.mainConcept;
  const featureValidator = buildValidatorForFeature(feature);
  const provisionValidator = buildValidatorForProvision('TERMF', 'TERMF-TARGET');

  assert.equal(featureValidator.safeParse('short summary').success, true);
  assert.equal(featureValidator.safeParse({ nested: true }).success, false);
  assert.equal(provisionValidator.safeParse({ mainConcept: 'summary' }).success, true);
});

test('schema validateFeatures returns ok/errors/warnings and legacy adapter preserves old shape', () => {
  const clean = validateFeatures('TERMF', 'TERMF-TARGET', {
    canonicalCode: 'TERMF-TARGET',
    mainConcept: 'Company pays fee on superior proposal termination',
  });
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.errors, []);
  assert.deepEqual(clean.warnings, []);

  const invalid = validateFeatures('TERMF', 'TERMF-TARGET', { mainConcept: { nested: true } });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].key, 'mainConcept');
  assert.equal(invalid.errors[0].severity, 'error');

  const oldShape = legacy.validateFeatures('TERMF', { canonicalCode: 'TERMF-TARGET', mainConcept: { nested: true } });
  assert.deepEqual(Object.keys(oldShape).sort(), ['errors', 'warnings']);
  assert.equal(oldShape.errors[0].kind, 'shape');
});

test('loose object features with cited array wrappers warn rather than error', () => {
  const result = validateFeatures('REP-T', null, {
    maeQualifiedRepsEvidence: {
      value: ['Real Property'],
      quotes: ['Except as would not have a Company Material Adverse Effect.'],
    },
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].key, 'maeQualifiedRepsEvidence');
  assert.equal(result.warnings[0].severity, 'warn');
});

test('top 30 high-appearance features accept valid samples and flag invalid shape samples', () => {
  for (const key of TOP_FEATURE_KEYS) {
    const feature = FEATURES[key];
    assert.ok(feature, `${key} must be present in registry`);
    const { type, code } = pickTypeCode(feature);
    assert.ok(type, `${key} must have a provision type`);

    const validBag = { ...(code ? { canonicalCode: code } : {}), [key]: validValue(feature) };
    const valid = validateFeatures(type, code, validBag);
    assert.equal(valid.errors.length, 0, `${key} valid sample should not error: ${JSON.stringify(valid.errors)}`);

    const invalidBag = { ...(code ? { canonicalCode: code } : {}), [key]: invalidValue(feature) };
    const invalid = validateFeatures(type, code, invalidBag);
    assert.ok(
      invalid.errors.length + invalid.warnings.length > 0,
      `${key} invalid sample should produce at least one validation issue`,
    );
  }
});

test('parser store write path calls schema validation directly', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'parser-v2', 'store.js'), 'utf8');
  assert.match(source, /require\('\.\.\/schema\/validation'\)/);
  assert.doesNotMatch(source, /require\('\.\.\/feature-validation'\)/);
});
