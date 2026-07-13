const test = require('node:test');
const assert = require('node:assert/strict');

const {
  planRehome,
  runRehome,
} = require('../scripts/curation/rehome-correction');

const DEAL_A = '885edae5-49e8-464a-9f33-edd229119d7c';
const DEAL_B = 'c7c16365-c9cf-4bfb-93a6-1575084d717c';

function correction(overrides = {}) {
  return {
    id: '91b36d89-1111-4000-8000-000000000001',
    deal_id: DEAL_A,
    correction_type: 'COR',
    before: {
      type: 'COR',
      category: 'Change of Recommendation',
      full_text: 'old text',
      features: { materiality_threshold: 'MAE' },
    },
    after: {
      type: 'COR',
      category: 'Change of Recommendation',
      full_text: 'old text',
      features: { materiality_threshold: 'FIDUCIARY-OUT' },
    },
    ...overrides,
  };
}

function provisionRow(overrides = {}) {
  return {
    id: 'aaaa0000-1111-4000-8000-000000000009',
    deal_id: DEAL_A,
    type: 'COR',
    category: 'Breach by Representatives',
    full_text: 'Representatives-violation-is-breach attribution text.',
    ai_metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// (a) deal mismatch refuses
// ---------------------------------------------------------------------------

test('planRehome: a deal_id mismatch between correction and provision refuses', () => {
  const c = correction({ deal_id: DEAL_A });
  const p = provisionRow({ deal_id: DEAL_B });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /deal_id mismatch/);
});

// ---------------------------------------------------------------------------
// (b) empty delta refuses
// ---------------------------------------------------------------------------

test('planRehome: an empty computeUserDelta(before, after) refuses — nothing to re-home', () => {
  const c = correction({
    before: { type: 'COR', category: 'X', full_text: 'same', features: { a: 1 } },
    after: { type: 'COR', category: 'X', full_text: 'same', features: { a: 1 } },
  });
  const p = provisionRow();
  const plan = planRehome(c, p);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /empty/);
});

// ---------------------------------------------------------------------------
// (c) conflict (current non-null and != before) refuses
// ---------------------------------------------------------------------------

test('planRehome: a current feature value that has diverged from the correction\'s BEFORE value refuses with a conflict report', () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: { materiality_threshold: 'SOMETHING-ELSE' } } });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /conflict/);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].key, 'materiality_threshold');
  assert.equal(plan.conflicts[0].current, 'SOMETHING-ELSE');
  assert.equal(plan.conflicts[0].before, 'MAE');
});

test('planRehome: a null/absent current feature value is fine (the expected case) — no conflict', () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: { materiality_threshold: null } } });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, true);
});

// ---------------------------------------------------------------------------
// (d) clean plan produces the merged ai_metadata payload and the new
//     corrections row with full_text in before.
// ---------------------------------------------------------------------------

test('planRehome: a clean plan merges the feature delta into ai_metadata.features and mirrors the identity fields into the new correction row', () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: { unrelated_feature: 'keep-me' } } });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, true);
  assert.equal(plan.correctionId, c.id);
  assert.equal(plan.provisionId, p.id);
  assert.equal(plan.dealId, DEAL_A);

  assert.deepEqual(plan.provisionsUpdate.ai_metadata.features, {
    unrelated_feature: 'keep-me',
    materiality_threshold: 'FIDUCIARY-OUT',
  });
  assert.deepEqual(plan.provisionsUpdate.ai_metadata.reapplied_corrections, [c.id]);
  // TRACKED_SCALARS delta.set applied too (mirroring reapplyCorrections'
  // shape) — none differ here since before/after share type/category/full_text.
  assert.deepEqual(plan.delta.set, {});

  assert.equal(plan.newCorrectionRow.deal_id, DEAL_A);
  assert.equal(plan.newCorrectionRow.provision_id, p.id);
  assert.equal(plan.newCorrectionRow.correction_type, 'COR');
  assert.equal(plan.newCorrectionRow.before.full_text, p.full_text);
  assert.equal(plan.newCorrectionRow.before.type, p.type);
  assert.equal(plan.newCorrectionRow.before.category, p.category);
  assert.deepEqual(plan.newCorrectionRow.before.features, { materiality_threshold: null });
  assert.equal(plan.newCorrectionRow.after.full_text, p.full_text);
  assert.deepEqual(plan.newCorrectionRow.after.features, { materiality_threshold: 'FIDUCIARY-OUT' });
  assert.equal(plan.newCorrectionRow.reason, `re-homed correction ${c.id} onto provision ${p.id}`);
  assert.deepEqual(plan.newCorrectionRow.context, {
    kind: 'correction_rehome',
    original_correction_id: c.id,
    tool: 'rehome-correction.js',
  });
});

// ---------------------------------------------------------------------------
// (e) reapplied_corrections appends + dedups
// ---------------------------------------------------------------------------

test('planRehome: reapplied_corrections appends the new correction id to the prior array', () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: {}, reapplied_corrections: ['old-correction-1', 'old-correction-2'] } });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.provisionsUpdate.ai_metadata.reapplied_corrections, ['old-correction-1', 'old-correction-2', c.id]);
});

test('planRehome: reapplied_corrections dedups if this correction id is already present', () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: {}, reapplied_corrections: ['old-correction-1', c.id] } });
  const plan = planRehome(c, p);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.provisionsUpdate.ai_metadata.reapplied_corrections, ['old-correction-1', c.id]);
});

// ---------------------------------------------------------------------------
// (f) dry-run plans zero writes
// ---------------------------------------------------------------------------

function makeMockSb({ correctionRow, provisionRow: provRow }) {
  const calls = [];
  const sb = {
    from(table) {
      return {
        select() {
          return {
            eq(_col, id) {
              return {
                maybeSingle: async () => {
                  if (table === 'corrections') return { data: correctionRow && correctionRow.id === id ? correctionRow : null, error: null };
                  if (table === 'provisions') return { data: provRow && provRow.id === id ? provRow : null, error: null };
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(payload) {
          calls.push({ table, op: 'update', payload });
          return { eq: async () => ({ error: null }) };
        },
        insert(row) {
          calls.push({ table, op: 'insert', row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { sb, calls };
}

test('runRehome: dry-run (no --apply) plans the write but performs zero DB writes', async () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: {} } });
  const { sb, calls } = makeMockSb({ correctionRow: c, provisionRow: p });

  const plan = await runRehome(sb, { correction: c.id, provision: p.id, apply: false });
  assert.equal(plan.ok, true);
  assert.equal(plan.applied, false);
  assert.equal(calls.length, 0);
});

test('runRehome: --apply performs exactly the update + insert writes and nothing else', async () => {
  const c = correction();
  const p = provisionRow({ ai_metadata: { features: {} } });
  const { sb, calls } = makeMockSb({ correctionRow: c, provisionRow: p });

  const plan = await runRehome(sb, { correction: c.id, provision: p.id, apply: true });
  assert.equal(plan.ok, true);
  assert.equal(plan.applied, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].table, 'provisions');
  assert.equal(calls[0].op, 'update');
  assert.equal(calls[1].table, 'corrections');
  assert.equal(calls[1].op, 'insert');
});

test('runRehome: a refused plan (e.g. missing rows) never reaches --apply writes', async () => {
  const { sb, calls } = makeMockSb({ correctionRow: null, provisionRow: null });
  const plan = await runRehome(sb, { correction: 'missing-correction', provision: 'missing-provision', apply: true });
  assert.equal(plan.ok, false);
  assert.equal(plan.applied, false);
  assert.equal(calls.length, 0);
});
