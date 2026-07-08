const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FAMILIES,
  buildInventory,
  extractConfigKeys,
  markdown,
} = require('../../scripts/audit/schema-augmentation-inventory');

test('schema augmentation inventory includes every planned M2-09 family', () => {
  const rows = buildInventory();
  assert.equal(rows.length, FAMILIES.length);
  assert.ok(rows.some((row) => row.family === 'Conditions'));
  assert.ok(rows.some((row) => row.family === 'Antitrust / Regulatory'));
  assert.ok(rows.some((row) => row.family === 'Structure / Mechanics'));
});

test('schema augmentation inventory preserves required baseline augmentations', () => {
  const rows = buildInventory();
  const conditions = rows.find((row) => row.family === 'Conditions');
  const mae = rows.find((row) => row.family === 'MAE / Definitions');
  const antitrust = rows.find((row) => row.family === 'Antitrust / Regulatory');
  assert.ok(conditions.augmentations.some((item) => item.field === 'canonicalCode' && item.required));
  assert.ok(conditions.augmentations.some((item) => item.field === 'materialityScrapeBoolean' && item.required));
  assert.ok(mae.augmentations.some((item) => item.field === 'disproportionateImpactClause' && item.required));
  assert.ok(antitrust.augmentations.some((item) => item.field === 'burdensomeConditionLimit' && item.required));
});

test('config-key extractor ignores row ids and keeps feature keys', () => {
  const source = "['ordinary-course', 'Ordinary-course covenant', 'Interim operating', ['ordinaryCourseConduct', 'absenceConductedOrdinaryCourse']]";
  assert.deepEqual(extractConfigKeys(source), ['absenceConductedOrdinaryCourse', 'ordinaryCourseConduct']);
});

test('schema augmentation markdown cites sources and cross-cutting provenance', () => {
  const text = markdown(buildInventory(), '2026-07-08T00:00:00.000Z');
  assert.match(text, /Cross-cutting augmentation/);
  assert.match(text, /components\/review\/table-configs\/antitrust-regulatory\.config\.js/);
  assert.match(text, /MATERIAL_CONTRACT_BUCKET_META\.synonyms/);
});
