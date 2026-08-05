'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(
  'scripts/canonical-v2-f28-third-live-extraction-run.mjs',
  'utf8',
);

test('the non-writing third live-run driver opts into registered family dispatch only when explicitly requested', () => {
  assert.match(source, /--section-family-classifier-live/);
  assert.match(source, /--section-family-classifier-replay/);
  assert.match(source, /registered_families/);
  assert.match(source, /section_family_classifier: sectionFamilyClassifier/);
  assert.match(source, /stage: 'section_family_classifier'/);
  assert.match(source, /Return JSON only/);
  assert.match(source, /input\.registered_families\.includes\(parsed\.section_family\)/);
  assert.doesNotMatch(source, /canonical_v2_write|supabase|postgresql:\/\//i);
});

test('the replay classifier flag cannot silently fall back when its file path is missing', () => {
  const result = spawnSync(process.execPath, [
    'scripts/canonical-v2-f28-third-live-extraction-run.mjs',
    '--raw-html', 'unused',
    '--retrieval-url', 'https://example.test/unused',
    '--section-ref', 'unused',
    '--out-dir', 'unused',
    '--fixture-out', 'unused',
    '--section-family-classifier-replay',
  ], { cwd: process.cwd(), encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a JSON file path/);
  assert.doesNotMatch(result.stderr, /starting LIVE extraction call/);
});
