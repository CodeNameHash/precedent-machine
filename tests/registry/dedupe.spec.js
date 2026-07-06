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
