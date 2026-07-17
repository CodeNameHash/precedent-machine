const test = require('node:test');
const assert = require('node:assert/strict');
const { mockSupabase } = require('./helpers/mock-supabase');
const { handleCorrectionSubmission, resolveTargetUpdate } = require('../lib/corrections/submit');
const { resetRateLimitStore, MAX_PENDING_PER_HOUR } = require('../lib/corrections/rate-limit');

process.env.EDITOR_KEYS = 'ben:sekrit1';

test.beforeEach(() => resetRateLimitStore());

function baseBody(overrides = {}) {
  return {
    card_id: 'card-1',
    deal_id: 'deal-1',
    target: { kind: 'quote' },
    proposed: 'The revised clause text.',
    rationale: 'The extractor dropped a carve-out.',
    ...overrides,
  };
}

test('resolveTargetUpdate: quote maps to full_text, code maps to category', () => {
  assert.deepEqual(resolveTargetUpdate({ kind: 'quote' }, 'new text'), { updates: { full_text: 'new text' } });
  assert.deepEqual(resolveTargetUpdate({ kind: 'code' }, 'CONSID-CASH'), { updates: { category: 'CONSID-CASH' } });
});

test('resolveTargetUpdate: party and other never map (no column to write)', () => {
  assert.equal(resolveTargetUpdate({ kind: 'party' }, 'Parent'), null);
  assert.equal(resolveTargetUpdate({ kind: 'other' }, 'something free-form'), null);
});

test('resolveTargetUpdate: value maps only when a claim_attribute is given', () => {
  assert.equal(resolveTargetUpdate({ kind: 'value' }, '30 days'), null);
  assert.deepEqual(
    resolveTargetUpdate({ kind: 'value', claim_attribute: 'terminationFeeDays' }, '30 days'),
    { updates: { ai_metadata: { features: { terminationFeeDays: '30 days' } } } },
  );
});

test('approved editor + resolvable provision_id + mappable kind -> applied immediately', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'prov-1', deal_id: 'deal-1', type: 'X', category: 'OLD', full_text: 'old text' }] });
  const result = await handleCorrectionSubmission(sb, baseBody({ provision_id: 'prov-1' }), { editorKeyHeader: 'sekrit1', ip: '1.1.1.1' });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.outcome, 'applied');
  assert.equal(sb.tables.provisions[0].full_text, 'The revised clause text.');
  assert.equal(result.correction.status, 'applied');
  assert.equal(result.correction.submitted_by, 'ben');
});

test('approved editor but no provision_id -> queues pending, never writes provisions', async () => {
  const sb = mockSupabase({ provisions: [] });
  const result = await handleCorrectionSubmission(sb, baseBody(), { editorKeyHeader: 'sekrit1', ip: '1.1.1.1' });

  assert.equal(result.outcome, 'pending');
  assert.equal(sb.tables.provisions.length, 0);
  assert.equal(result.correction.status, 'pending');
  assert.equal(result.correction.submitted_by, 'ben');
});

test('approved editor with a non-mappable kind (other) always queues, flagged manual_review', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'prov-1', deal_id: 'deal-1' }] });
  const result = await handleCorrectionSubmission(
    sb,
    baseBody({ provision_id: 'prov-1', target: { kind: 'other' }, proposed: 'free text note' }),
    { editorKeyHeader: 'sekrit1', ip: '1.1.1.1' },
  );

  assert.equal(result.outcome, 'pending');
  assert.equal(result.correction.correction_type, 'manual_review');
  assert.equal(sb.tables.provisions[0].full_text, undefined);
});

test('unapproved submitter (no key) always queues, never writes, even with a mappable kind + valid provision_id', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'prov-1', deal_id: 'deal-1', full_text: 'old text' }] });
  const result = await handleCorrectionSubmission(
    sb,
    baseBody({ provision_id: 'prov-1', submitted_by: 'Anonymous Reader' }),
    { editorKeyHeader: undefined, ip: '2.2.2.2' },
  );

  assert.equal(result.outcome, 'pending');
  assert.equal(sb.tables.provisions[0].full_text, 'old text');
  assert.equal(result.correction.submitted_by, 'Anonymous Reader');
  assert.equal(result.correction.correction_type, 'pending_submission');
});

test('wrong editor key behaves identically to no key (queues, no distinguishing detail)', async () => {
  const sb = mockSupabase({ provisions: [{ id: 'prov-1', deal_id: 'deal-1', full_text: 'old text' }] });
  const result = await handleCorrectionSubmission(
    sb,
    baseBody({ provision_id: 'prov-1' }),
    { editorKeyHeader: 'totally-wrong-key', ip: '3.3.3.3' },
  );

  assert.equal(result.outcome, 'pending');
  assert.equal(sb.tables.provisions[0].full_text, 'old text');
});

test('validation: missing rationale is rejected before any write', async () => {
  const sb = mockSupabase();
  const result = await handleCorrectionSubmission(sb, baseBody({ rationale: '' }), { editorKeyHeader: 'sekrit1', ip: '1.1.1.1' });
  assert.equal(result.httpStatus, 400);
  assert.equal(sb.tables.corrections.length, 0);
});

test('rate limit: more than MAX_PENDING_PER_HOUR pending submissions from one IP are rejected', async () => {
  const sb = mockSupabase();
  const ip = '9.9.9.9';
  for (let i = 0; i < MAX_PENDING_PER_HOUR; i += 1) {
    const res = await handleCorrectionSubmission(sb, baseBody(), { editorKeyHeader: undefined, ip });
    assert.equal(res.outcome, 'pending', `submission ${i} should queue`);
  }
  const blocked = await handleCorrectionSubmission(sb, baseBody(), { editorKeyHeader: undefined, ip });
  assert.equal(blocked.httpStatus, 429);
  assert.equal(sb.tables.corrections.length, MAX_PENDING_PER_HOUR);
});

test('rate limit is per-IP: a different IP is unaffected', async () => {
  const sb = mockSupabase();
  for (let i = 0; i < MAX_PENDING_PER_HOUR; i += 1) {
    await handleCorrectionSubmission(sb, baseBody(), { editorKeyHeader: undefined, ip: '9.9.9.9' });
  }
  const other = await handleCorrectionSubmission(sb, baseBody(), { editorKeyHeader: undefined, ip: '8.8.8.8' });
  assert.equal(other.outcome, 'pending');
});
