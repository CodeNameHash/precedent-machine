const test = require('node:test');
const assert = require('node:assert/strict');

const { FEATURES, TAGS } = require('../lib/schema');
const { summarizeSchemaCoverage } = require('../lib/schema/coverage');
const {
  buildAudit,
  candidateFlags,
  proposedWhenEmpty,
} = require('../scripts/schema-empty-audit');

test('P7B registry decisions classify high-value empties semantically', () => {
  assert.equal(FEATURES.scheduleReference.whenEmpty, 'silent');
  assert.equal(FEATURES.mainConcept.whenEmpty, 'extraction_pending');

  assert.equal(FEATURES.permittedExceptions.whenEmpty, 'extraction_pending');
  assert.equal(FEATURES.permittedExceptions.listItemType, 'tag');
  assert.equal(FEATURES.permittedExceptions.listItemTagFamily, 'EXCEPTION_CODES');
  assert.equal(FEATURES.permittedExceptions.requiredEvidence, true);
  assert.equal(FEATURES.permittedExceptions.citable, true);

  assert.equal(FEATURES.negativePreambleExceptions.whenEmpty, 'extraction_pending');
  assert.equal(FEATURES.negativePreambleExceptions.listItemTagFamily, 'EXCEPTION_CODES');

  assert.equal(FEATURES.materialContractsBuckets.whenEmpty, 'needs_review');
  assert.deepEqual(FEATURES.materialContractsBuckets.provisionCodes, ['REP-T-MATERIAL-CONTRACTS']);
  assert.equal(FEATURES.materialContractsBuckets.listItemTagFamily, 'MATERIAL_CONTRACT_BUCKET_CODES');
  assert.equal(FEATURES.materialContractsBuckets.requiredEvidence, true);

  assert.equal(FEATURES.materialContractsDollarThresholds.whenEmpty, 'silent');
  assert.deepEqual(FEATURES.materialContractsDollarThresholds.provisionCodes, ['REP-T-MATERIAL-CONTRACTS']);
  assert.equal(FEATURES.materialContractsDollarThresholds.listItemType, 'object');
  assert.deepEqual(FEATURES.materialContractsDollarThresholds.objectShape, {
    bucket: 'string',
    threshold: 'number',
    text: 'string',
  });

  assert.deepEqual(FEATURES.materialContractsRedactionsPermitted.provisionCodes, ['REP-T-MATERIAL-CONTRACTS']);
  assert.deepEqual(FEATURES.materialContractsBucketsSource.provisionCodes, ['REP-T-MATERIAL-CONTRACTS']);

  assert.equal(FEATURES.parentBuyerIocBuckets.whenEmpty, 'not_applicable');
  assert.deepEqual(FEATURES.iocAffirmativeScope.provisionTypes, ['IOC']);
  assert.deepEqual(FEATURES.iocAffirmativeStandard.provisionTypes, ['IOC']);
  assert.equal(FEATURES.iocAffirmativeScope.whenEmpty, 'silent');
  assert.equal(FEATURES.iocAffirmativeStandard.whenEmpty, 'silent');
});

test('permittedExceptions is part of the exception tag family', () => {
  const exceptionTags = Object.values(TAGS).filter((tag) => tag.family === 'EXCEPTION_CODES');
  assert.equal(exceptionTags.length > 0, true);
  for (const tag of exceptionTags) {
    assert.equal(tag.appearsOn.includes('permittedExceptions'), true, tag.code);
  }
});

test('legacy or deprecated standalone fields do not create lawyer review queues', () => {
  for (const key of [
    'iocAffirmativeScope',
    'iocAffirmativeStandard',
    'materialContractsDollarThresholds',
  ]) {
    assert.notEqual(FEATURES[key].whenEmpty, 'needs_review', key);
    assert.equal(candidateFlags(FEATURES[key], { total: 30, populated: 0 }).length, 0, key);
  }
  assert.equal(FEATURES.willfulBreachDefinition.valueType, 'boolean');
  assert.equal(FEATURES.willfulBreachDefinition.whenEmpty, 'silent');
});

test('coverage counts P7B empty states for targeted fields', () => {
  const features = [
    FEATURES.mainConcept,
    FEATURES.materialContractsBuckets,
    FEATURES.materialContractsDollarThresholds,
    FEATURES.negativePreambleExceptions,
    FEATURES.parentBuyerIocBuckets,
    FEATURES.permittedExceptions,
    FEATURES.scheduleReference,
  ];
  const provisions = [
    {
      id: 'rep-material-contracts',
      type: 'REP-T',
      ai_metadata: { features: { canonicalCode: 'REP-T-MATERIAL-CONTRACTS', scheduleReference: 'Section 4.12' } },
    },
    {
      id: 'rep-auth',
      type: 'REP-T',
      ai_metadata: { features: { canonicalCode: 'REP-T-AUTH' } },
    },
    {
      id: 'ioc-ordinary',
      type: 'IOC',
      ai_metadata: { features: { canonicalCode: 'IOC-ORDINARY' } },
    },
    {
      id: 'anti-efforts',
      type: 'ANTI',
      ai_metadata: { features: { canonicalCode: 'ANTI-EFFORTS' } },
    },
  ];

  const summary = summarizeSchemaCoverage(provisions, { features });
  const byKey = new Map(summary.features.map((row) => [row.feature_key, row]));

  assert.equal(byKey.get('materialContractsBuckets').total, 1);
  assert.equal(byKey.get('materialContractsBuckets').needs_review, 1);
  assert.equal(byKey.get('materialContractsDollarThresholds').total, 1);
  assert.equal(byKey.get('materialContractsDollarThresholds').silent, 1);
  assert.equal(byKey.get('permittedExceptions').extraction_pending, 1);
  assert.equal(byKey.get('parentBuyerIocBuckets').not_applicable, 1);
  assert.equal(byKey.get('mainConcept').extraction_pending, 3);
  assert.equal(byKey.get('scheduleReference').silent, 2);
});

test('schema empty audit proposes curated classifications only', () => {
  assert.equal(proposedWhenEmpty(FEATURES.scheduleReference, { total: 20, populated: 0 }), 'silent');
  assert.equal(proposedWhenEmpty(FEATURES.mainConcept, { total: 20, populated: 0 }), 'extraction_pending');
  assert.equal(proposedWhenEmpty(FEATURES.materialContractsBuckets, { total: 20, populated: 0 }), 'needs_review');
  assert.equal(proposedWhenEmpty(FEATURES.materialContractsDollarThresholds, { total: 20, populated: 0 }), 'silent');
  assert.equal(proposedWhenEmpty(FEATURES.permittedExceptions, { total: 20, populated: 0 }), 'extraction_pending');
  assert.equal(proposedWhenEmpty(FEATURES.negativePreambleExceptions, { total: 20, populated: 0 }), 'extraction_pending');
  assert.equal(proposedWhenEmpty(FEATURES.parentBuyerIocBuckets, { total: 20, populated: 0 }), 'not_applicable');
  assert.equal(proposedWhenEmpty(FEATURES.goShopPresent, { total: 20, populated: 0 }), 'silent');
  assert.deepEqual(
    candidateFlags(FEATURES.goShopPresent, { total: 30, populated: 0 }),
    ['benchmarkable_zero_populated', 'benchmarkable_low_population', 'citable_zero_populated'],
  );

  const audit = buildAudit({
    deals: [{ id: 'deal-1' }],
    provisions: [
      { id: 'p1', deal_id: 'deal-1', type: 'REP-T', ai_metadata: { features: { canonicalCode: 'REP-T-MATERIAL-CONTRACTS' } } },
      { id: 'p2', deal_id: 'deal-1', type: 'IOC', ai_metadata: { features: { canonicalCode: 'IOC-ORDINARY' } } },
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `nosol-${index}`,
        deal_id: 'deal-1',
        type: 'NOSOL',
        ai_metadata: { features: { canonicalCode: 'NOSOL-PROHIBIT' } },
      })),
    ],
  }, { samples: false });

  const rows = new Map(audit.rows.map((row) => [row.feature_key, row]));
  assert.equal(rows.get('materialContractsBuckets').proposed_when_empty, 'needs_review');
  assert.equal(rows.get('materialContractsDollarThresholds').proposed_when_empty, 'silent');
  assert.equal(rows.get('permittedExceptions').proposed_when_empty, 'extraction_pending');
  assert.equal(rows.get('parentBuyerIocBuckets').proposed_when_empty, 'not_applicable');
  assert.equal(rows.get('mainConcept').proposed_when_empty, 'extraction_pending');
  assert.equal(rows.get('goShopPresent').proposed_when_empty, 'silent');
  assert.equal(rows.get('goShopPresent').candidate_flags.includes('benchmarkable_zero_populated'), true);
});
