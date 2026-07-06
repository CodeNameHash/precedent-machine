const test = require('node:test');
const assert = require('node:assert/strict');

const rubric = require('../../lib/rubric');
const schema = require('../../lib/schema');
const { validateFeatureDef, validateTagDef } = require('../../lib/schema/types');

test('schema registry loads without throwing', () => {
  assert.ok(schema);
  assert.ok(schema.FEATURES);
  assert.ok(schema.TAGS);
});

test('every FeatureDef passes the Phase 2 shape validator', () => {
  for (const feature of Object.values(schema.FEATURES)) {
    assert.deepEqual(validateFeatureDef(feature), [], feature.key);
  }
});

test('every TagDef passes the Phase 2 shape validator', () => {
  for (const tag of Object.values(schema.TAGS)) {
    assert.deepEqual(validateTagDef(tag), [], tag.code);
  }
});

test('feature keys and tag family-code pairs are unique', () => {
  const featureKeys = Object.values(schema.FEATURES).map((feature) => feature.key);
  assert.equal(new Set(featureKeys).size, featureKeys.length);

  const tagKeys = Object.values(schema.TAGS).map((tag) => `${tag.family}:${tag.code}`);
  assert.equal(new Set(tagKeys).size, tagKeys.length);
});

test('feature provisionTypes reference valid rubric provision types', () => {
  const validTypes = new Set((rubric.PROVISION_TYPES || []).map((entry) => entry.key));
  for (const feature of Object.values(schema.FEATURES)) {
    for (const type of feature.provisionTypes || []) {
      assert.ok(validTypes.has(type), `${feature.key} references unknown type ${type}`);
    }
  }
});

test('enum and list-tag features carry the required schema fields', () => {
  const tagFamilies = new Set(Object.values(schema.TAGS).map((tag) => tag.family));
  for (const feature of Object.values(schema.FEATURES)) {
    if (feature.valueType === 'enum') {
      assert.ok(Array.isArray(feature.enumSet) && feature.enumSet.length > 0, `${feature.key} needs enumSet`);
    }
    if (feature.listItemType === 'tag') {
      assert.ok(tagFamilies.has(feature.listItemTagFamily), `${feature.key} references unknown tag family`);
    }
  }
});

test('registry lookup helpers return safe defaults and populated type lists', () => {
  assert.equal(schema.getFeature('missing'), null);
  assert.ok(schema.getFeature('dealStructure'));
  assert.ok(schema.getFeaturesForType('STRUCT').length > 0);
  assert.ok(schema.getFeaturesForCode('STRUCT', 'STRUCT-MERGER').length > 0);
  assert.equal(schema.getTag('MISSING', 'NOPE'), null);
  assert.deepEqual(schema.getTagsForFamily('NOPE'), []);
});
