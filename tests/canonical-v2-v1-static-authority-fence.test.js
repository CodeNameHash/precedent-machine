'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const ACTIVE_CONSUMERS = [
  'lib/canonical-v2/metsera-pilot-extension-readiness.js',
  'lib/canonical-v2/metsera-comprehensive-selection-review-writer.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js',
  'lib/canonical-v2/native-producer/m3-certification-control.js',
  'lib/canonical-v2/native-producer/m3-family-parity-register.js',
  'lib/programme-gates/p9-acceptance-evidence-inventory.js',
  'lib/programme-gates/p9-acceptance-evidence-engineering-queue.js',
];

test('active readiness, pilot, cost, certification and programme plans cannot consume static V1 corroboration', () => {
  for (const relativePath of ACTIVE_CONSUMERS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    for (const forbidden of ['normalized-v1.json', 'parity-data-sweep-2026-07-15', 'home-search-index-v1.json', 'collectEvidenceRecords', 'PARITY_RENDER_EXPORT']) {
      assert.equal(source.includes(forbidden), false, `${relativePath} imports or treats ${forbidden} as authority`);
    }
  }
});

test('the only Metsera V1 dependency is the static-incomplete acquisition plan', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/metsera-comprehensive-selection-review.js'), 'utf8');
  assert.match(source, /buildV1RenderedSurfaceAcquisitionPlan/);
  for (const forbidden of ['collectEvidenceRecords', 'v1_governed_family_evidence', 'v1_output_inventory_digest', 'v1_evidence_records_digest']) assert.equal(source.includes(forbidden), false);
  assert.match(source, /STATIC_EVIDENCE_INCOMPLETE/);
});
