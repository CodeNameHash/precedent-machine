// Regression coverage for extracting pages/api/provisions.js's PATCH logic
// into lib/provisions/apply-patch.js (done so the Correct-tab submit/review
// routes could reuse it — docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md).
// Asserts the shared core still does what the inline PATCH handler used to:
// snapshot before/after, merge ai_metadata, and log a correction row with
// the same shape reapply-corrections.js expects.
const test = require('node:test');
const assert = require('node:assert/strict');
const { mockSupabase } = require('./helpers/mock-supabase');
const { applyProvisionPatch, writeProvisionUpdate, snapshot, provisionExists } = require('../lib/provisions/apply-patch');

test('applyProvisionPatch updates the row and logs a correction with before/after snapshots', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'p1', deal_id: 'd1', type: 'REP', category: 'OLD', full_text: 'old' }] });
  const { provision, correction } = await applyProvisionPatch(sb, {
    id: 'p1',
    updates: { category: 'NEW' },
    reason: 'typo fix',
    user_id: null,
  });

  assert.equal(provision.category, 'NEW');
  assert.equal(correction.correction_type, 'category_change');
  assert.equal(correction.before.category, 'OLD');
  assert.equal(correction.after.category, 'NEW');
  assert.equal(correction.status, 'applied', 'default column status applies with no extra fields, matching the v1 PATCH flow unchanged');
  assert.equal(correction.reason, 'typo fix');
});

test('applyProvisionPatch merges ai_metadata.features rather than clobbering existing metadata', async () => {
  const sb = mockSupabase({
    provisions: [{ id: 'p1', deal_id: 'd1', ai_metadata: { rubric_code: 'X1', features: { a: 1, b: 2 } } }],
  });
  const { provision } = await applyProvisionPatch(sb, {
    id: 'p1',
    updates: { ai_metadata: { features: { b: 99 } } },
  });

  assert.equal(provision.ai_metadata.rubric_code, 'X1');
  assert.equal(provision.ai_metadata.features.a, 1);
  assert.equal(provision.ai_metadata.features.b, 99);
});

test('applyProvisionPatch extra fields (submitted_by/card_id/claim_attribute) land on the correction row', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'p1', deal_id: 'd1', full_text: 'old' }] });
  const { correction } = await applyProvisionPatch(sb, {
    id: 'p1',
    updates: { full_text: 'new' },
    extra: { submitted_by: 'ben', card_id: 'card-9', claim_attribute: 'terminationFeeDays' },
  });

  assert.equal(correction.submitted_by, 'ben');
  assert.equal(correction.card_id, 'card-9');
  assert.equal(correction.claim_attribute, 'terminationFeeDays');
});

test('applyProvisionPatch with no actual field change logs nothing (matches diffCorrectionType returning null)', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'p1', deal_id: 'd1', category: 'SAME' }] });
  const { correction } = await applyProvisionPatch(sb, { id: 'p1', updates: { category: 'SAME' } });
  assert.equal(correction, null);
  assert.equal(sb.tables.corrections.length, 0);
});

test('writeProvisionUpdate alone does not touch the corrections table (used by review-approve to update the existing row instead)', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'p1', deal_id: 'd1', full_text: 'old' }] });
  const { provision } = await writeProvisionUpdate(sb, { id: 'p1', updates: { full_text: 'new' } });
  assert.equal(provision.full_text, 'new');
  assert.equal(sb.tables.corrections.length, 0);
});

test('provisionExists reflects whether a legacy provisions row is resolvable', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'p1', deal_id: 'd1' }] });
  assert.equal(await provisionExists(sb, 'p1'), true);
  assert.equal(await provisionExists(sb, 'does-not-exist'), false);
  assert.equal(await provisionExists(sb, null), false);
});

test('snapshot hoists ai_metadata.features to the top level for diffCorrectionType', () => {
  const snap = snapshot({ type: 'REP', ai_metadata: { features: { a: 1 } } });
  assert.deepEqual(snap.features, { a: 1 });
  assert.equal(snap.type, 'REP');
});
