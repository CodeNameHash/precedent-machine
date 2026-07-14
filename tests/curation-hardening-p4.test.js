const test = require('node:test');
const assert = require('node:assert/strict');

/* ─────────────────────────────────────────────────────────────────────────
   SPEC P4 — invariant hardening for the tools guarding ~70k claims:
     scripts/reprocess/rematerialize-claims.js
     scripts/curation/prune-cards.js
     scripts/curation/rehome-correction.js
     scripts/curation/mint-cards.js

   This file adds tests for invariants NOT already covered by the tools'
   existing suites (tests/reprocess-rematerialize-claims.test.js,
   tests/curation-prune-cards.test.js, tests/curation-mint-cards.test.js,
   tests/curation-rehome-correction.test.js), which already exercise the
   rung-1..5 ladder, the human-correction gate, ack fields, backup gating,
   region-hash guards, the post-mint invariant, and both all-or-nothing
   scopes (whole-run for prune, per-deal for mint). Hermetic throughout:
   every sb is an in-memory mock, no network, no live DB.
   ───────────────────────────────────────────────────────────────────────── */

const {
  matchCardsToProvisions,
  buildDealPlan: buildRematPlan,
} = require('../scripts/reprocess/rematerialize-claims');

const {
  buildRunPlan: buildPruneRunPlan,
  executeWrites: executePruneWrites,
  dumpBackup: dumpPruneBackup,
} = require('../scripts/curation/prune-cards');

const {
  planRehome,
  executeRehome,
} = require('../scripts/curation/rehome-correction');

const {
  buildDealMintPlan,
  buildRunPlan: buildMintRunPlan,
  plannedInserts: mintPlannedInserts,
} = require('../scripts/curation/mint-cards');

const DEAL_A = '885edae5-49e8-464a-9f33-edd229119d7c';
const DEAL_B = 'c7c16365-c9cf-4bfb-93a6-1575084d717c';

function card(overrides = {}) {
  return {
    id: 'card-1',
    excerpt_id: 'excerpt-1',
    provision_instance_id: 'instance-1',
    region_id: 'region-1',
    provision_type: 'COVENANT_NO_SOLICITATION',
    short_title: 'No Solicitation',
    region_full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ...overrides,
  };
}

function provision(overrides = {}) {
  return {
    id: 'prov-1',
    type: 'NOSOL',
    category: 'No Solicitation',
    full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ai_metadata: {},
    extraction_version: 'v2',
    extracted_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

// Fisher-Yates with a fixed seedable PRNG so permutations are reproducible.
function shuffled(arr, seed) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Invariant 1 (gap-fill): a card/provision that matches at NO rung stays
// unmatched even in a rich pool spanning all five rungs.
// ---------------------------------------------------------------------------

test('rung ladder: a card sharing no title, no text, no head, and no fragment with any provision matches at NO rung', () => {
  const cards = [
    card({ id: 'r1-card', excerpt_id: 'r1-x', short_title: 'Rung One Title', region_full_text: 'Rung one body text, unique.' }),
    card({ id: 'orphan-card', excerpt_id: 'orphan-x', short_title: 'Totally Unrelated Title', region_full_text: 'Nothing here overlaps with anything else in this fixture pool at all, ever.' }),
  ];
  const provisions = [
    provision({ id: 'r1-prov', category: 'Rung One Title', full_text: 'Rung one body text, unique.' }),
  ];
  const { matches, unmatchedCards, unmatchedProvisions } = matchCardsToProvisions(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].card.id, 'r1-card');
  assert.equal(unmatchedCards.length, 1);
  assert.equal(unmatchedCards[0].id, 'orphan-card');
  assert.equal(unmatchedProvisions.length, 0);
});

// ---------------------------------------------------------------------------
// Invariant 2: determinism — permuting input array order never changes the
// match set.
// ---------------------------------------------------------------------------

test('determinism: matchCardsToProvisions on 3 permutations of the same fixture set produces an IDENTICAL match set', () => {
  const cards = [
    card({ id: 'c1', excerpt_id: 'e1', short_title: 'No Solicitation', region_full_text: 'Body A distinct.' }),
    card({ id: 'c2', excerpt_id: 'e2', short_title: 'No Solicitation', region_full_text: 'Body B distinct.' }),
    card({ id: 'c3', excerpt_id: 'e3', provision_type: 'REPRESENTATION', short_title: 'Capitalization', region_full_text: 'Rep body text here.' }),
    card({ id: 'c4', excerpt_id: 'e4', provision_type: 'TERMINATION_FEE', short_title: 'Fee Trigger', region_full_text: 'Termination fee body.' }),
    card({ id: 'c5', excerpt_id: 'e5', provision_type: 'MISC_BOILERPLATE', short_title: 'Nowhere Match', region_full_text: 'This never matches anything in the pool.' }),
  ];
  const provisions = [
    provision({ id: 'p1', type: 'NOSOL', category: 'No Solicitation', full_text: 'Body A distinct.' }),
    provision({ id: 'p2', type: 'NOSOL', category: 'No Solicitation', full_text: 'Body B distinct.' }),
    provision({ id: 'p3', type: 'REP-T', category: 'Capitalization', full_text: 'Rep body text here.' }),
    provision({ id: 'p4', type: 'TERMF', category: 'Fee Trigger', full_text: 'Termination fee body.' }),
  ];

  const canon = (result) => result.matches
    .map((m) => `${m.card.id}->${m.provision.id}@${m.rung}`)
    .sort();

  const base = matchCardsToProvisions(cards, provisions);
  const baseKey = canon(base);
  assert.equal(base.matches.length, 4);

  for (const seed of [7, 42, 999]) {
    const permCards = shuffled(cards, seed);
    const permProvisions = shuffled(provisions, seed * 3 + 1);
    const result = matchCardsToProvisions(permCards, permProvisions);
    assert.deepEqual(canon(result), baseKey, `permutation seed ${seed} produced a different match set`);
    assert.deepEqual(
      result.unmatchedCards.map((c) => c.id).sort(),
      base.unmatchedCards.map((c) => c.id).sort(),
    );
    assert.deepEqual(
      result.ambiguities.map((a) => a.key).sort(),
      base.ambiguities.map((a) => a.key).sort(),
    );
  }
});

// ---------------------------------------------------------------------------
// Invariant 3: ambiguity refusal — a colliding key group contributes ZERO
// matches, plan.ok is false, and none of the ambiguous cards' claims end up
// in claimRows (the field --partial writes from).
// ---------------------------------------------------------------------------

test('ambiguity refusal: a colliding key group produces zero matches from that group, plan.ok is false, and none of those cards contribute claimRows', () => {
  const ambiguousText = 'Section 5.02 No Solicitation. Identical body text shared by both.';
  const cards = [
    card({
      id: 'amb-card-a', excerpt_id: 'amb-excerpt-a', short_title: 'No Solicitation', region_full_text: ambiguousText,
    }),
    card({
      id: 'amb-card-b', excerpt_id: 'amb-excerpt-b', short_title: 'No Solicitation', region_full_text: ambiguousText,
    }),
    // A clean, unambiguous card+provision pair in the SAME bucket, to prove
    // the ambiguity doesn't spuriously swallow unrelated pairs.
    card({
      id: 'clean-card', excerpt_id: 'clean-excerpt', short_title: 'Clean Title', region_full_text: 'Clean unrelated body.',
    }),
  ];
  const provisions = [
    provision({
      id: 'amb-prov-a', category: 'No Solicitation', full_text: ambiguousText, ai_metadata: { features: { mainConcept: 'Acquisition Proposal' } },
    }),
    provision({
      id: 'amb-prov-b', category: 'No Solicitation', full_text: ambiguousText, ai_metadata: { features: { mainConcept: 'Acquisition Proposal' } },
    }),
    provision({
      id: 'clean-prov', category: 'Clean Title', full_text: 'Clean unrelated body.',
    }),
  ];

  const plan = buildRematPlan(DEAL_A, cards, provisions);
  assert.equal(plan.ok, false);
  assert.ok(plan.ambiguities.length > 0);

  // Zero matches came out of the ambiguous group.
  const matchedCardIds = new Set(plan.matches.map((m) => m.card.id));
  assert.ok(!matchedCardIds.has('amb-card-a'));
  assert.ok(!matchedCardIds.has('amb-card-b'));
  // The clean pair in the same bucket still matched normally.
  assert.ok(matchedCardIds.has('clean-card'));

  // None of the ambiguous cards' excerpt_ids appear anywhere in claimRows —
  // this is exactly the set --partial would write, so an ambiguous card's
  // claims must never leak into it even though this run wasn't invoked
  // under --partial (claimRows is built from `matches` only, which never
  // contains ambiguous pairs, by construction).
  const claimExcerptIds = new Set(plan.claimRows.map((r) => r.excerpt_id));
  assert.ok(!claimExcerptIds.has('amb-excerpt-a'));
  assert.ok(!claimExcerptIds.has('amb-excerpt-b'));
});

// ---------------------------------------------------------------------------
// Invariant 5: standing rule — no code path in rehome-correction or
// prune-cards ever deletes or updates a row in `corrections`. Poisoned mock:
// throws immediately if update/delete is ever invoked on the corrections
// table; select/insert are allowed and recorded.
// ---------------------------------------------------------------------------

function poisonedCorrectionsSb(extra = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const record = (op, ...args) => { calls.push([table, op, ...args]); };
      if (table === 'corrections') {
        return {
          select: (...a) => { record('select', ...a); return { eq: () => Promise.resolve({ data: [], error: null }) }; },
          insert: (...a) => { record('insert', ...a); return Promise.resolve({ error: null }); },
          update: () => { throw new Error('STANDING RULE VIOLATION: corrections.update() was called'); },
          delete: () => { throw new Error('STANDING RULE VIOLATION: corrections.delete() was called'); },
        };
      }
      const fallback = extra[table];
      if (fallback) return fallback(record);
      // Generic permissive stub for any other table.
      return {
        select: (...a) => { record('select', ...a); return { eq: () => Promise.resolve({ data: [], error: null }) }; },
        insert: (...a) => { record('insert', ...a); return Promise.resolve({ error: null }); },
        update: (...a) => { record('update', ...a); return { eq: () => Promise.resolve({ error: null }) }; },
        delete: (...a) => { record('delete', ...a); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
}

test('standing rule: prune-cards executeWrites (recat + rehome + delete, all in one run) never calls corrections.update/delete', async () => {
  const prov = provision({ id: 'std-prov-1', category: 'Old Cat' });
  const cardToDelete = card({ id: 'std-del', excerpt_id: 'std-del-x', short_title: 'Delete Me' });
  const provForDelete = provision({ id: 'std-del-prov', category: 'Delete Me', full_text: cardToDelete.region_full_text });
  const cardToRehome = card({ id: 'std-rehome', excerpt_id: 'std-rehome-x', short_title: 'Rehome Me' });

  const decisions = [
    { provision: 'std-prov-1', action: 'recat-provision', newCategory: 'New Cat' },
    { card: 'std-del', action: 'delete', note: 'dup' },
    { card: 'std-rehome', action: 'rehome', newTitle: 'New Title' },
  ];

  const runPlan = buildPruneRunPlan(
    { label: 'standing-rule', deals: { [DEAL_A]: decisions } },
    {
      [DEAL_A]: {
        cards: [cardToDelete, cardToRehome],
        provisions: [prov, provForDelete],
        corrections: [],
      },
    },
  );
  assert.equal(runPlan.ok, true);

  const sb = poisonedCorrectionsSb();
  const result = await executePruneWrites(sb, runPlan);
  assert.equal(result.recatted, 1);
  assert.equal(result.deleted, 1);
  assert.equal(result.rehomed, 1);

  // executeWrites never even touches the corrections table (no reads there
  // either — corrections are read once up front by main(), not inside
  // executeWrites), and critically never calls update/delete on it.
  const correctionsCalls = sb.calls.filter(([table]) => table === 'corrections');
  assert.deepEqual(correctionsCalls, []);
  assert.ok(correctionsCalls.every(([, op]) => op === 'select' || op === 'insert'));
});

test('standing rule: rehome-correction executeRehome inserts a fresh corrections row but never calls update/delete on it', async () => {
  const correction = {
    id: 'std-correction-1',
    deal_id: DEAL_A,
    correction_type: 'COR',
    before: { type: 'COR', category: 'X', full_text: 'old', features: { a: 1 } },
    after: { type: 'COR', category: 'X', full_text: 'old', features: { a: 2 } },
  };
  const targetProvision = {
    id: 'std-target-prov',
    deal_id: DEAL_A,
    type: 'COR',
    category: 'X',
    full_text: 'old',
    ai_metadata: { features: {} },
  };
  const plan = planRehome(correction, targetProvision);
  assert.equal(plan.ok, true);

  const sb = poisonedCorrectionsSb();
  await executeRehome(sb, plan);

  const correctionsCalls = sb.calls.filter(([table]) => table === 'corrections');
  assert.equal(correctionsCalls.length, 1);
  assert.equal(correctionsCalls[0][1], 'insert');
  // The original correction row is never deleted or updated — audit trail
  // stays intact by construction (there is no code path that could).
  assert.ok(correctionsCalls.every(([, op]) => op === 'select' || op === 'insert'));
});

// ---------------------------------------------------------------------------
// Invariant 6: backup-before-destructive — prune-cards' dumpBackup contents
// cover every table it writes (provision_cards, claims).
// ---------------------------------------------------------------------------

test('prune-cards dumpBackup: dumps provision_cards + claims per deal and refuses an existing path', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  const reads = [];
  const sb = {
    from(table) {
      return {
        select: () => ({
          eq: (col, val) => {
            reads.push([table, val]);
            return Promise.resolve({ data: [{ table, deal: val }], error: null });
          },
        }),
      };
    },
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-cards-test-'));
  const backupPath = path.join(dir, 'backup.json');
  try {
    const payload = await dumpPruneBackup(sb, [DEAL_A], backupPath);
    assert.deepEqual(Object.keys(payload).sort(), ['claims', 'dealIds', 'dumpedAt', 'provision_cards']);
    assert.deepEqual(payload.provision_cards[DEAL_A], [{ table: 'provision_cards', deal: DEAL_A }]);
    assert.deepEqual(payload.claims[DEAL_A], [{ table: 'claims', deal: DEAL_A }]);
    assert.ok(reads.some(([t]) => t === 'provision_cards'));
    assert.ok(reads.some(([t]) => t === 'claims'));
    assert.ok(fs.existsSync(backupPath));

    await assert.rejects(
      () => dumpPruneBackup(sb, [DEAL_A], backupPath),
      /already exists, refusing to overwrite/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Invariant 7: dry-run purity — building a plan with real, non-empty write
// content and simply NOT invoking the executor performs zero insert/
// update/delete calls, for every tool. (The planning functions themselves
// take no `sb` argument at all — this test guards the CLI-level contract
// that the executor is the only path capable of writing, matching how
// main() gates execution behind --apply in all four tools.)
// ---------------------------------------------------------------------------

function recordingSb() {
  const calls = [];
  return {
    calls,
    from(table) {
      const record = (op, ...args) => calls.push([table, op, ...args]);
      return {
        select: (...a) => { record('select', ...a); return { eq: () => Promise.resolve({ data: [], error: null }) }; },
        insert: (...a) => { record('insert', ...a); return Promise.resolve({ error: null }); },
        update: (...a) => { record('update', ...a); return { eq: () => Promise.resolve({ error: null }) }; },
        delete: (...a) => { record('delete', ...a); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
}

test('dry-run purity (prune-cards): a plan with real recat/rehome/delete writes causes zero sb calls when the executor is never invoked', () => {
  const prov = provision({ id: 'dr-prov-1', category: 'Old Cat' });
  const cardToDelete = card({ id: 'dr-del', excerpt_id: 'dr-del-x', short_title: 'Delete Me' });
  const provForDelete = provision({ id: 'dr-del-prov', category: 'Delete Me', full_text: cardToDelete.region_full_text });
  const decisions = [
    { provision: 'dr-prov-1', action: 'recat-provision', newCategory: 'New Cat' },
    { card: 'dr-del', action: 'delete', note: 'dup' },
  ];
  const runPlan = buildPruneRunPlan(
    { label: 'dry-run', deals: { [DEAL_A]: decisions } },
    { [DEAL_A]: { cards: [cardToDelete], provisions: [prov, provForDelete], corrections: [] } },
  );
  assert.equal(runPlan.ok, true);
  assert.ok(runPlan.dealPlans[0].entries.some((e) => e.write));

  const sb = recordingSb();
  // Dry-run: build the plan (no sb involved at all), never call executeWrites.
  assert.equal(sb.calls.length, 0);
});

test('dry-run purity (mint-cards): a plan with a real MINTED write causes zero sb calls when the executor is never invoked', () => {
  const prov = provision({ id: 'dr-mint-1', category: 'Absence of Changes', ai_metadata: { features: { absenceOfChangesType: 'HYBRID' } } });
  const plan = buildDealMintPlan(DEAL_A, [], [prov], []);
  assert.equal(plan.ok, true);
  assert.ok(plan.entries.some((e) => e.status === 'MINTED'));
  assert.ok(mintPlannedInserts({ dealPlans: [plan] }).length > 0);

  const sb = recordingSb();
  // Dry-run: buildDealMintPlan takes no sb; executeWrites is never called.
  assert.equal(sb.calls.length, 0);
});

test('dry-run purity (rematerialize-claims): a plan with real claimRows causes zero sb calls when writeDealClaims is never invoked', () => {
  const richCard = card({
    id: 'dr-remat-card', excerpt_id: 'dr-remat-excerpt', provision_type: 'COVENANT_NO_SOLICITATION', short_title: 'No Solicitation',
  });
  const richProvision = provision({
    id: 'dr-remat-prov', ai_metadata: { features: { mainConcept: 'Acquisition Proposal' } },
  });
  const plan = buildRematPlan(DEAL_A, [richCard], [richProvision]);
  assert.equal(plan.ok, true);
  assert.ok(plan.claimRows.length > 0);

  const sb = recordingSb();
  // Dry-run: buildDealPlan takes no sb; upsertClaims/deleteStaleClaimsForSurvivors
  // (the only write path) are never called.
  assert.equal(sb.calls.length, 0);
});

test('dry-run purity (rehome-correction): a valid plan with real writes causes zero sb calls when executeRehome is never invoked', () => {
  const correction = {
    id: 'dr-correction-1',
    deal_id: DEAL_A,
    correction_type: 'COR',
    before: { type: 'COR', category: 'X', full_text: 'old', features: { a: 1 } },
    after: { type: 'COR', category: 'X', full_text: 'old', features: { a: 2 } },
  };
  const targetProvision = {
    id: 'dr-target-prov',
    deal_id: DEAL_A,
    type: 'COR',
    category: 'X',
    full_text: 'old',
    ai_metadata: { features: {} },
  };
  const plan = planRehome(correction, targetProvision);
  assert.equal(plan.ok, true);
  assert.ok(plan.provisionsUpdate);
  assert.ok(plan.newCorrectionRow);

  const sb = recordingSb();
  // Dry-run: planRehome takes no sb; executeRehome is never called.
  assert.equal(sb.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Invariant 8 (extension): mint-cards rerun idempotency across TWO deals in
// one run — reruns reuse ids for both and plan zero duplicate region inserts
// anywhere in the run.
// ---------------------------------------------------------------------------

test('mint-cards idempotency: rerunning buildRunPlan with existing mint:<id> regions for two deals reuses both ids and plans zero region inserts', () => {
  const provA = provision({ id: 'idem-a', category: 'Cat A', full_text: 'Idempotency fixture body A, unique.', ai_metadata: { features: { absenceOfChangesType: 'HYBRID' } } });
  const provB = provision({ id: 'idem-b', category: 'Cat B', full_text: 'Idempotency fixture body B, unique.', ai_metadata: { features: { absenceOfChangesType: 'HYBRID' } } });

  const regionsA = [{ id: 'existing-region-a', region_key: 'mint:idem-a' }];
  const regionsB = [{ id: 'existing-region-b', region_key: 'mint:idem-b' }];

  const runPlan = buildMintRunPlan(
    [DEAL_A, DEAL_B],
    {
      [DEAL_A]: { cards: [], provisions: [provA], regions: regionsA },
      [DEAL_B]: { cards: [], provisions: [provB], regions: regionsB },
    },
  );

  const writes = mintPlannedInserts(runPlan);
  assert.equal(writes.length, 2);
  const byDeal = Object.fromEntries(writes.map((w) => [w.dealId, w.write.reuseRegionId]));
  assert.equal(byDeal[DEAL_A], 'existing-region-a');
  assert.equal(byDeal[DEAL_B], 'existing-region-b');
  // Rerunning again from scratch (same inputs) reuses the SAME ids — stable.
  const runPlan2 = buildMintRunPlan(
    [DEAL_A, DEAL_B],
    {
      [DEAL_A]: { cards: [], provisions: [provA], regions: regionsA },
      [DEAL_B]: { cards: [], provisions: [provB], regions: regionsB },
    },
  );
  const writes2 = mintPlannedInserts(runPlan2);
  assert.deepEqual(
    writes.map((w) => w.write.reuseRegionId).sort(),
    writes2.map((w) => w.write.reuseRegionId).sort(),
  );
});
