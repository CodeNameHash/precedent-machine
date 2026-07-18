const test = require('node:test');
const assert = require('node:assert/strict');
const { mockSupabase } = require('./helpers/mock-supabase');
const { handleReviewAction } = require('../lib/corrections/review');

process.env.EDITOR_KEYS = 'ben:sekrit1';

function pendingRow(overrides = {}) {
  return {
    id: 'corr-1',
    deal_id: 'deal-1',
    provision_id: 'prov-1',
    status: 'pending',
    correction_type: 'pending_submission',
    context: { target: { kind: 'quote' }, proposed: 'The corrected clause text.' },
    reason: 'Extractor missed a carve-out.',
    submitted_by: 'Anonymous Reader',
    card_id: 'card-1',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test('review requires a valid editor key for both approve and reject', async () => {
  const sb = mockSupabase({ corrections: [pendingRow()] });
  const noKey = await handleReviewAction(sb, { id: 'corr-1', action: 'approve' }, { editorKeyHeader: undefined });
  assert.equal(noKey.httpStatus, 403);
  const wrongKey = await handleReviewAction(sb, { id: 'corr-1', action: 'approve' }, { editorKeyHeader: 'nope' });
  assert.equal(wrongKey.httpStatus, 403);
});

test('approve with a mappable target runs the apply path: patches provisions AND flips the row to applied', async () => {
  const sb = mockSupabase({
    provisions: [{ id: 'prov-1', deal_id: 'deal-1', full_text: 'old text' }],
    corrections: [pendingRow()],
  });
  const result = await handleReviewAction(sb, { id: 'corr-1', action: 'approve' }, { editorKeyHeader: 'sekrit1' });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.outcome, 'applied');
  assert.equal(sb.tables.provisions[0].full_text, 'The corrected clause text.');
  assert.equal(result.correction.status, 'applied');
  assert.equal(result.correction.reviewed_by, 'ben');
  assert.ok(result.correction.reviewed_at);
  assert.equal(sb.tables.corrections.length, 1, 'approve updates the existing row in place, does not insert a second one');
});

test('approve on a non-mappable (manual_review) proposal still marks applied/reviewed without writing to provisions', async () => {
  const sb = mockSupabase({
    provisions: [],
    corrections: [pendingRow({ context: { target: { kind: 'other' }, proposed: 'free text note' }, correction_type: 'manual_review' })],
  });
  const result = await handleReviewAction(sb, { id: 'corr-1', action: 'approve' }, { editorKeyHeader: 'sekrit1' });

  assert.equal(result.outcome, 'applied');
  assert.equal(result.correction.reviewed_by, 'ben');
  assert.equal(sb.tables.provisions.length, 0);
});

test('reject requires a note and appends it to context', async () => {
  const sb = mockSupabase({ corrections: [pendingRow()] });
  const missingNote = await handleReviewAction(sb, { id: 'corr-1', action: 'reject' }, { editorKeyHeader: 'sekrit1' });
  assert.equal(missingNote.httpStatus, 400);

  const result = await handleReviewAction(sb, { id: 'corr-1', action: 'reject', note: 'Not supported by the filing.' }, { editorKeyHeader: 'sekrit1' });
  assert.equal(result.outcome, 'rejected');
  assert.equal(result.correction.status, 'rejected');
  assert.equal(result.correction.context.rejection_note, 'Not supported by the filing.');
  assert.equal(result.correction.reviewed_by, 'ben');
});

test('acting on an already-resolved correction is rejected with 409', async () => {
  const sb = mockSupabase({ corrections: [pendingRow({ status: 'applied' })] });
  const result = await handleReviewAction(sb, { id: 'corr-1', action: 'approve' }, { editorKeyHeader: 'sekrit1' });
  assert.equal(result.httpStatus, 409);
});
