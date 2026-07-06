const assert = require('node:assert/strict');
const fs = require('fs');
const test = require('node:test');
const { dedupeRegistry, reportMarkdown } = require('../../scripts/registry/dedupe');

const source = JSON.parse(fs.readFileSync('docs/market-registry/generated-v1.json', 'utf8'));

test('registry dedupe stays in reviewer-sized range with provenance', () => {
  const { registry, report } = dedupeRegistry(source);
  assert.equal(registry.fields.length, registry.field_count);
  assert.ok(registry.fields.length >= 650, `too few rows: ${registry.fields.length}`);
  assert.ok(registry.fields.length <= 800, `too many rows: ${registry.fields.length}`);
  assert.ok(registry.fields.every((field) => Array.isArray(field.merged_from)));
  assert.match(reportMarkdown(report), /REQUIRES_REVIEWER_DECISION/);
});

test('mainConcept absorbs per-provision rubric concepts', () => {
  const { registry } = dedupeRegistry(source);
  const mainConceptRows = registry.fields.filter((field) => field.key === 'mainConcept');
  assert.equal(mainConceptRows.length, 1);
  assert.ok(mainConceptRows[0].also_matches_provision_codes.length >= 15);
});

test('review-sensitive near duplicates remain separate and flagged', () => {
  const { registry, report } = dedupeRegistry(source);
  const carveoutRows = registry.fields.filter((field) => /carveout/i.test(field.key));
  assert.ok(carveoutRows.length > 1);
  assert.ok(carveoutRows.some((field) => field.review_flag === 'REQUIRES_REVIEWER_DECISION'));
  assert.match(reportMarkdown(report), /flagged near-duplicates/);
});

test('rubric suffix merges prefer current canonical keys over legacy aliases', () => {
  const { registry } = dedupeRegistry(source);
  const carveouts = registry.fields.find((field) => field.key === 'carveouts');
  const carveOuts = registry.fields.find((field) => field.key === 'carveOuts');
  const materialityQualifier = registry.fields.find((field) => field.key === 'materialityQualifier');
  const materialityQualifiers = registry.fields.find((field) => field.key === 'materialityQualifiers');

  assert.ok(carveouts.merged_from.some((item) => item.key === 'rubric.def.carveouts'));
  assert.equal(carveOuts.merged_from.length, 0);
  assert.ok(materialityQualifier.merged_from.some((item) => item.key === 'rubric.rep_t.materiality_qualifier'));
  assert.equal(materialityQualifiers.merged_from.length, 0);
});

test('reviewer split adds tenderOffer boolean without changing parser sources', () => {
  const { registry } = dedupeRegistry(source);
  const tenderOffer = registry.fields.find((field) => field.key === 'tenderOffer');
  const divestitureInCondition = registry.fields.find((field) => field.key === 'divestitureInCondition');
  assert.equal(tenderOffer.data_type, 'BOOLEAN');
  assert.equal(tenderOffer.origin, 'reviewer-added');
  assert.ok(tenderOffer.merged_from.some((item) => item.key === 'dealStructure'));
  assert.equal(divestitureInCondition.data_type, 'BOOLEAN');
  assert.equal(divestitureInCondition.origin, 'reviewer-added');
  assert.ok(divestitureInCondition.merged_from.some((item) => item.key === 'burdensomeConditionPresent'));
});
