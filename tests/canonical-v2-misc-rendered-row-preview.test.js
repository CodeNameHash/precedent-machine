'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

test('each generic boilerplate claim renders its own governed mechanic row', () => {
  const runDir = path.join(ROOT, 'evidence/canonical-v2/concho-misc-boilerplate-20260809-2xk-final');
  const run = {
    manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(runDir, 'resolution.json'), 'utf8')),
  };

  for (const entry of run.resolution.resolved) {
    const preview = previewClaimSection({ run, resolved_entry: entry });
    const content = preview.rows.flatMap((row) => row.cells.map((cell) => cell.text)).join(' ');
    assert.equal(preview.family_id, 'MISC_BOILERPLATE');
    assert.equal(preview.section.id, 'misc-boilerplate');
    assert.equal(preview.row_count, 1, entry.claim.claim_revision_id);
    assert.match(content, new RegExp(entry.claim.raw_value.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});
