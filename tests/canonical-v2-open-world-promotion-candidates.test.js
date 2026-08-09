const test = require('node:test');
const assert = require('node:assert/strict');
const { isFragment, labelOf } = require('../lib/canonical-v2/open-world-promotion-candidates');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

test('fragment policy uses UTF-8 byte length and subordinate starts', () => {
  assert.equal(isFragment({ raw_value: 'é'.repeat(30) }), false);
  assert.equal(isFragment({ raw_value: 'é'.repeat(29) }), true);
  assert.equal(isFragment({ raw_value: 'other than a complete sentence that is deliberately long enough to exceed the byte boundary for this test.' }), true);
  assert.equal(isFragment({ raw_value: 'Nothing in this Agreement shall constitute a complete clause that is longer than the byte threshold.' }), false);
  assert.equal(isFragment({ raw_value: 'This Agreement (including the schedules) is a complete clause that is longer than the byte threshold.' }), false);
});
test('only a leading controlled label is recognised', () => {
  assert.equal(labelOf({ attributes: { why_unmapped: 'APPRAISAL_NOTICE: detail' } }), 'APPRAISAL_NOTICE');
  assert.equal(labelOf({ attributes: { why_unmapped: 'note: APPRAISAL_NOTICE' } }), null);
});

test('full pinned corpus derives the documented Stage 2Y-J rule census', () => {
  const root = path.resolve(__dirname, '..');
  childProcess.execFileSync(process.execPath, ['scripts/audit/stage-2y-open-world-promotion-candidates.mjs', '--check'], { cwd: root, env: { ...process.env, CI: 'true' }, stdio: 'pipe' });
  const candidateRoot = path.join(root, 'evidence/canonical-v2/open-world-promotion/candidates');
  const directory = fs.readdirSync(candidateRoot).find((name) => fs.existsSync(path.join(candidateRoot, name, 'candidate-set.v1.json')));
  const snapshot = JSON.parse(fs.readFileSync(path.join(candidateRoot, directory, 'candidate-set.v1.json'), 'utf8'));
  assert.deepEqual(snapshot.counts, {
    native_open_world_occurrences: 1147,
    raw_recurrence_labels_at_threshold: 32,
    eligible_concepts: 22,
    eligible_occurrences: 147,
    resolved_claim_evidence_span_duplicates: 7,
    resolved_claim_citation_context_duplicates: 71,
    resolved_claim_duplicates: 78,
    later_same_run_identical_duplicates: 29,
    duplicate_exclusions: 107,
    fragment_exclusions: 756,
  });
  const derived = snapshot.exclusions.reduce((counts, row) => ({ ...counts, [row.reason]: (counts[row.reason] || 0) + 1 }), {});
  assert.equal(derived.RESOLVED_CLAIM_EVIDENCE_SPAN_DUPLICATE, 7);
  assert.equal(derived.RESOLVED_CLAIM_CITATION_CONTEXT_DUPLICATE, 71);
  assert.equal(derived.LATER_SAME_RUN_IDENTICAL_DUPLICATE, 29);
  assert.equal(derived.FRAGMENT, 756);
  assert.equal(snapshot.candidates.some((candidate) => candidate.display_name === 'AFFIRMATIVE COVENANT'), true);
});
