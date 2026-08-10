'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

test('a governed D&O claim reaches the existing general-covenants review section', () => {
  const runDir = path.join(ROOT, 'evidence/canonical-v2/concho-dno-indemnification-20260809-2xk-final');
  const run = {
    manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(runDir, 'resolution.json'), 'utf8')),
  };
  const entry = run.resolution.resolved.find(
    (candidate) => candidate.resolved_claim_definition_key === 'TAIL_POLICY_PERIOD_YEARS',
  );

  assert.ok(entry);
  const preview = previewClaimSection({ run, resolved_entry: entry });

  assert.equal(preview.family_id, 'DNO_INDEMNIFICATION');
  assert.equal(preview.section.id, 'general-covenants');
  assert.equal(preview.row_count, 1);
  assert.match(preview.rows[0].label, /D&O \/ insurance covenant/i);
  assert.match(preview.rows[0].cells.map((cell) => cell.text).join(' '), /D&O \/ insurance covenant/i);
});
