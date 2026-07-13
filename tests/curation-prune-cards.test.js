const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveCardRef,
  textCovered,
  buildDealPlan,
  buildRunPlan,
  plannedWrites,
  checkBackupGate,
  executeWrites,
  formatDealTable,
} = require('../scripts/curation/prune-cards');

const DEAL_A = '885edae5-49e8-464a-9f33-edd229119d7c';
const DEAL_B = 'c7c16365-c9cf-4bfb-93a6-1575084d717c';

function card(overrides = {}) {
  return {
    id: 'bdffefa4-1111-4000-8000-000000000001',
    excerpt_id: 'excerpt-1',
    provision_type: 'DEFINITION',
    short_title: 'Acquisition Proposal Definition',
    region_full_text: 'Section 1.01 "Acquisition Proposal" means any proposal.',
    ...overrides,
  };
}

function provision(overrides = {}) {
  return {
    id: 'prov-1',
    category: 'Superior Proposal Definition',
    full_text: 'Section 1.01(a) "Superior Proposal" means: Section 1.01 "Acquisition Proposal" means any proposal.',
    ai_metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Prefix resolution.
// ---------------------------------------------------------------------------

test('resolveCardRef: an 8-char prefix resolves to the single matching card', () => {
  const cards = [card()];
  const result = resolveCardRef('bdffefa4', cards);
  assert.equal(result.ok, true);
  assert.equal(result.card.id, cards[0].id);
});

test('resolveCardRef: an ambiguous prefix (matches two cards) is an error result, not a guess', () => {
  const cards = [
    card({ id: 'bdffefa4-1111-4000-8000-000000000001' }),
    card({ id: 'bdffefa4-2222-4000-8000-000000000002' }),
  ];
  const result = resolveCardRef('bdffefa4', cards);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ambiguous');
  assert.equal(result.candidates.length, 2);
});

test('resolveCardRef: no match is a missing error, not a guess', () => {
  const result = resolveCardRef('00000000', [card()]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing');
});

// ---------------------------------------------------------------------------
// 2. Delete verification.
// ---------------------------------------------------------------------------

test('buildDealPlan: delete verification covered -> PLANNED-DELETE with a delete write', () => {
  const cards = [card()];
  const provisions = [provision()];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'PLANNED-DELETE');
  assert.deepEqual(entry.write, { op: 'delete', table: 'provision_cards', id: cards[0].id });
  assert.deepEqual(entry.coveringProvisionIds, ['prov-1']);
});

test('buildDealPlan: delete verification NOT covered -> NEEDS-RECONFIRM, no delete planned, plan not clean', () => {
  const cards = [card()];
  const provisions = [provision({ full_text: 'Totally unrelated text with no overlap at all.' })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'NEEDS-RECONFIRM');
  assert.equal(entry.write, null);
});

// ---------------------------------------------------------------------------
// 3. Rehome plans a short_title-only patch, never a delete.
// ---------------------------------------------------------------------------

test('buildDealPlan: rehome plans an UPDATE with ONLY short_title in the patch, and never a delete', () => {
  const cards = [card({ short_title: 'Bidder Info Rights' })];
  const decisions = [{ card: 'bdffefa4', action: 'rehome', newTitle: 'Information Parity to Parent', note: 'x' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, [], []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'PLANNED-REHOME');
  assert.equal(entry.write.op, 'update');
  assert.deepEqual(Object.keys(entry.write.patch), ['short_title']);
  assert.equal(entry.write.patch.short_title, 'Information Parity to Parent');
  assert.notEqual(entry.write.op, 'delete');
});

// ---------------------------------------------------------------------------
// 4. verify-then-hold never writes, reports COVERED/NOT-COVERED.
// ---------------------------------------------------------------------------

test('buildDealPlan: verify-then-hold reports COVERED and plans no write when the substring is present', () => {
  const cards = [card()];
  const provisions = [provision({ full_text: 'It will be deemed to be a breach of this Section 5.05 by Kraft, for sure.' })];
  const decisions = [{
    card: 'bdffefa4',
    action: 'verify-then-hold',
    mustContainInKeptRow: 'will be deemed to be a breach of this Section 5.05 by Kraft',
    addToRow: { titleOfKeptCard: 'Solicitation Prohibition', text: 'x' },
    note: 'attribution rule',
  }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'COVERED');
  assert.equal(entry.write, null);
});

test('buildDealPlan: verify-then-hold reports NOT-COVERED and plans no write, marking the run not clean', () => {
  const cards = [card()];
  const provisions = [provision({ full_text: 'Nothing here relates to that at all.' })];
  const decisions = [{
    card: 'bdffefa4',
    action: 'verify-then-hold',
    mustContainInKeptRow: 'will be deemed to be a breach of this Section 5.05 by Kraft',
    addToRow: { titleOfKeptCard: 'Solicitation Prohibition', text: 'x' },
    note: 'attribution rule',
  }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'NOT-COVERED');
  assert.equal(entry.write, null);
});

// ---------------------------------------------------------------------------
// 5. Human-correction gate: skip + flag, never override.
// ---------------------------------------------------------------------------

test('buildDealPlan: a card whose matched provision has ai_metadata.user_corrected=true is skipped and flagged, even though it would otherwise be a clean delete', () => {
  const cards = [card()];
  const provisions = [provision({ ai_metadata: { user_corrected: true } })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'FLAGGED-HUMAN-CORRECTION');
  assert.equal(entry.flagged, true);
  assert.equal(entry.write, null);
});

test('buildDealPlan: a matching corrections-table row (by category, either side) also skips + flags a rehome', () => {
  const cards = [card({ short_title: 'No Restrictive Agreements' })];
  const provisions = [provision({ category: 'Something Else Entirely', full_text: 'unrelated' })];
  const corrections = [{ before: { category: 'No Restrictive Agreements' }, after: { category: 'Confidentiality Covenant' } }];
  const decisions = [{ card: 'bdffefa4', action: 'rehome', newTitle: 'New Title', note: 'x' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, corrections);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'FLAGGED-HUMAN-CORRECTION');
  assert.equal(entry.write, null);
});

test('buildDealPlan: keep is always a no-op, never gated, never flagged', () => {
  const cards = [card()];
  const provisions = [provision({ ai_metadata: { user_corrected: true } })];
  const decisions = [{ card: 'bdffefa4', action: 'keep', note: 'stays' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  assert.equal(plan.entries[0].status, 'KEEP');
  assert.equal(plan.entries[0].write, null);
});

// ---------------------------------------------------------------------------
// 6. All-or-nothing: one failed verification anywhere -> zero writes for the
//    WHOLE run, even for decisions/deals that individually resolved cleanly.
// ---------------------------------------------------------------------------

test('plannedWrites: one NEEDS-RECONFIRM in one deal zeroes out writes for an otherwise-clean second deal', () => {
  const cardsA = [card()];
  const provisionsA = [provision({ full_text: 'no overlap here whatsoever' })]; // fails verification
  const decisionsA = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];

  const cardB = card({ id: '11112222-0000-4000-8000-000000000009', short_title: 'Solicitation Prohibition' });
  const provisionB = provision({ id: 'prov-b', category: 'Solicitation Prohibition', full_text: cardB.region_full_text });
  const decisionsB = [{ card: '11112222', action: 'delete', note: 'clean dup' }];

  const runPlan = buildRunPlan(
    { label: 'test', deals: { [DEAL_A]: decisionsA, [DEAL_B]: decisionsB } },
    {
      [DEAL_A]: { cards: cardsA, provisions: provisionsA, corrections: [] },
      [DEAL_B]: { cards: [cardB], provisions: [provisionB], corrections: [] },
    },
  );

  assert.equal(runPlan.ok, false);
  // Deal B's own entry resolved cleanly...
  const dealBPlan = runPlan.dealPlans.find((p) => p.dealId === DEAL_B);
  assert.equal(dealBPlan.entries[0].status, 'PLANNED-DELETE');
  // ...but the run-level write list is empty because the WHOLE run isn't ok.
  assert.deepEqual(plannedWrites(runPlan), []);
});

test('executeWrites: zero DB calls happen when the plan is not ok', async () => {
  const calls = [];
  const sb = {
    from(table) {
      return {
        update: (...a) => { calls.push([table, 'update', ...a]); return { eq: () => Promise.resolve({ error: null }) }; },
        delete: (...a) => { calls.push([table, 'delete', ...a]); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
  const notOkPlan = { ok: false, dealPlans: [{ entries: [{ write: { op: 'delete', table: 'provision_cards', id: 'x' } }] }] };
  const result = await executeWrites(sb, notOkPlan);
  assert.deepEqual(result, { rehomed: 0, deleted: 0 });
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// 7. Backup gating: pure gate function.
// ---------------------------------------------------------------------------

test('checkBackupGate: --apply without --backup refuses', () => {
  const result = checkBackupGate({ apply: true, backup: null }, () => false);
  assert.equal(result.ok, false);
});

test('checkBackupGate: an existing backup path refuses', () => {
  const result = checkBackupGate({ apply: true, backup: 'reports/exists.json' }, (p) => p === 'reports/exists.json');
  assert.equal(result.ok, false);
});

test('checkBackupGate: a fresh backup path under --apply is ok; dry-run needs no backup at all', () => {
  const applyResult = checkBackupGate({ apply: true, backup: 'reports/fresh.json' }, () => false);
  assert.equal(applyResult.ok, true);
  const dryRunResult = checkBackupGate({ apply: false, backup: null }, () => false);
  assert.equal(dryRunResult.ok, true);
});

// ---------------------------------------------------------------------------
// 8. No writes ever against tables other than provision_cards.
// ---------------------------------------------------------------------------

test('executeWrites: only ever calls sb.from("provision_cards") — never any other table', async () => {
  const calls = [];
  function makeChain(table, op) {
    calls.push([table, op]);
    return { eq: () => Promise.resolve({ error: null }) };
  }
  const sb = {
    from(table) {
      return {
        update: (...a) => makeChain(table, 'update'),
        delete: (...a) => makeChain(table, 'delete'),
      };
    },
  };

  const cardsA = [card()];
  const provisionsA = [provision()];
  const decisionsA = [
    { card: 'bdffefa4', action: 'delete', note: 'dup' },
  ];
  const cardB = card({ id: 'aaaa9999-0000-4000-8000-000000000002', short_title: 'Info Parity' });
  const decisionsB = [{ card: 'aaaa9999', action: 'rehome', newTitle: 'Information Parity to Parent', note: 'x' }];

  const runPlan = buildRunPlan(
    { label: 'test', deals: { [DEAL_A]: decisionsA, [DEAL_B]: decisionsB } },
    {
      [DEAL_A]: { cards: cardsA, provisions: provisionsA, corrections: [] },
      [DEAL_B]: { cards: [cardB], provisions: [], corrections: [] },
    },
  );
  assert.equal(runPlan.ok, true);

  const result = await executeWrites(sb, runPlan);
  assert.equal(result.rehomed, 1);
  assert.equal(result.deleted, 1);
  assert.ok(calls.every(([table]) => table === 'provision_cards'));
  assert.equal(calls.length, 2);
});

// ---------------------------------------------------------------------------
// textCovered helper: whitespace/case normalization.
// ---------------------------------------------------------------------------

test('textCovered: whitespace and case differences do not defeat the substring check', () => {
  const provisions = [provision({ full_text: 'Line one\n   with   odd    spacing AND MiXeD Case here.' })];
  const { covered, coveringIds } = textCovered('with odd spacing and mixed case', provisions);
  assert.equal(covered, true);
  assert.deepEqual(coveringIds, ['prov-1']);
});

// ---------------------------------------------------------------------------
// 9. Explicit acknowledgment overrides (Ben sign-off follow-up).
// ---------------------------------------------------------------------------

const ACK_HC = 'ben 2026-07-13 — reviewed, delete anyway';
const ACK_UNCOV = 'ben 2026-07-13 — content loss confirmed';

test('ackHumanCorrection: converts FLAGGED-HUMAN-CORRECTION into a planned delete when the text IS covered', () => {
  const cards = [card()];
  const provisions = [provision({ ai_metadata: { user_corrected: true } })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup', ackHumanCorrection: ACK_HC }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'ACKED-HUMAN-CORRECTION');
  assert.equal(entry.flagged, true);
  assert.equal(entry.ackHumanCorrection, ACK_HC);
  assert.deepEqual(entry.write, { op: 'delete', table: 'provision_cards', id: cards[0].id });
});

test('ackHumanCorrection: converts the block, but the delete still needs its OWN coverage verification — uncovered text without ackUncovered stays blocked', () => {
  const cards = [card()];
  // category fallback keeps the human-correction match alive even though the
  // provision's full_text no longer overlaps the card's region text at all —
  // that's what makes the *delete's own* coverage check fail independently.
  const provisions = [provision({
    category: card().short_title,
    ai_metadata: { user_corrected: true },
    full_text: 'Totally unrelated text with no overlap at all.',
  })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup', ackHumanCorrection: ACK_HC }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'NEEDS-RECONFIRM');
  assert.equal(entry.flagged, true);
  assert.equal(entry.ackHumanCorrection, ACK_HC);
  assert.equal(entry.write, null);
});

test('ackHumanCorrection: without the field, behavior is exactly as today (still FLAGGED, still blocked)', () => {
  const cards = [card()];
  const provisions = [provision({ ai_metadata: { user_corrected: true } })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'FLAGGED-HUMAN-CORRECTION');
  assert.equal(entry.ackHumanCorrection, undefined);
  assert.equal(entry.write, null);
});

test('ackUncovered: converts NEEDS-RECONFIRM into PLANNED-DELETE-UNCOVERED with the delete write planned', () => {
  const cards = [card()];
  const provisions = [provision({ full_text: 'Totally unrelated text with no overlap at all.' })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup', ackUncovered: ACK_UNCOV }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'PLANNED-DELETE-UNCOVERED');
  assert.equal(entry.ackUncovered, ACK_UNCOV);
  assert.deepEqual(entry.write, { op: 'delete', table: 'provision_cards', id: cards[0].id });
  const line = formatDealTable(plan);
  assert.match(line, /verify: NOT-FOUND \(acked: ben 2026-07-13/);
});

test('ackUncovered: without the field, behavior is exactly as today (still NEEDS-RECONFIRM, still blocked)', () => {
  const cards = [card()];
  const provisions = [provision({ full_text: 'Totally unrelated text with no overlap at all.' })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup' }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'NEEDS-RECONFIRM');
  assert.equal(entry.ackUncovered, undefined);
});

test('both gates trip on one card: ackHumanCorrection ALONE still blocks (ackUncovered also required)', () => {
  const cards = [card()];
  const provisions = [provision({
    category: card().short_title,
    ai_metadata: { user_corrected: true },
    full_text: 'Totally unrelated text with no overlap at all.',
  })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup', ackHumanCorrection: ACK_HC }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  assert.equal(plan.entries[0].status, 'NEEDS-RECONFIRM');
});

test('both gates trip on one card: ackUncovered ALONE still blocks (ackHumanCorrection also required)', () => {
  const cards = [card()];
  const provisions = [provision({
    category: card().short_title,
    ai_metadata: { user_corrected: true },
    full_text: 'Totally unrelated text with no overlap at all.',
  })];
  const decisions = [{ card: 'bdffefa4', action: 'delete', note: 'dup', ackUncovered: ACK_UNCOV }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, false);
  assert.equal(plan.entries[0].status, 'FLAGGED-HUMAN-CORRECTION');
  assert.equal(plan.entries[0].write, null);
});

test('both gates trip on one card: BOTH acks together unblock fully (ok, write planned)', () => {
  const cards = [card()];
  const provisions = [provision({
    category: card().short_title,
    ai_metadata: { user_corrected: true },
    full_text: 'Totally unrelated text with no overlap at all.',
  })];
  const decisions = [{
    card: 'bdffefa4',
    action: 'delete',
    note: 'dup',
    ackHumanCorrection: ACK_HC,
    ackUncovered: ACK_UNCOV,
  }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'PLANNED-DELETE-UNCOVERED');
  assert.equal(entry.flagged, true);
  assert.equal(entry.ackHumanCorrection, ACK_HC);
  assert.equal(entry.ackUncovered, ACK_UNCOV);
  assert.deepEqual(entry.write, { op: 'delete', table: 'provision_cards', id: cards[0].id });
});

test('ackHumanCorrection on a rehome: converts the block and the title patch still plans', () => {
  const cards = [card({ short_title: 'No Restrictive Agreements' })];
  const provisions = [provision({ category: 'Something Else Entirely', full_text: 'unrelated' })];
  const corrections = [{ before: { category: 'No Restrictive Agreements' }, after: { category: 'Confidentiality Covenant' } }];
  const decisions = [{ card: 'bdffefa4', action: 'rehome', newTitle: 'New Title', note: 'x', ackHumanCorrection: ACK_HC }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, corrections);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'ACKED-HUMAN-CORRECTION');
  assert.deepEqual(entry.write, {
    op: 'update',
    table: 'provision_cards',
    id: cards[0].id,
    patch: { short_title: 'New Title' },
  });
});

test('acks are inert when the gate they target never trips: echoed on the entry, no status change', () => {
  const cards = [card()];
  const provisions = [provision()]; // covered, no human correction
  const decisions = [{
    card: 'bdffefa4',
    action: 'delete',
    note: 'dup',
    ackHumanCorrection: ACK_HC,
    ackUncovered: ACK_UNCOV,
  }];
  const plan = buildDealPlan(DEAL_A, decisions, cards, provisions, []);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'PLANNED-DELETE'); // unchanged status — neither gate tripped
  assert.equal(entry.flagged, false); // gate never tripped, so not flagged
  assert.equal(entry.ackHumanCorrection, ACK_HC); // still echoed — stale ack stays visible
  assert.equal(entry.ackUncovered, ACK_UNCOV);
});

test('whole-run ok is true when every gate that trips has a matching ack (fully-acked file)', () => {
  const cardHC = card({ id: 'aaaaaaaa-1111-4000-8000-000000000001' });
  const provisionsHC = [provision({ ai_metadata: { user_corrected: true } })];
  const decisionsHC = [{ card: 'aaaaaaaa', action: 'delete', note: 'dup', ackHumanCorrection: ACK_HC }];

  const cardBoth = card({ id: 'bbbbbbbb-2222-4000-8000-000000000002', short_title: 'Other Card' });
  const provisionsBoth = [provision({ id: 'prov-2', category: 'Other Card', ai_metadata: { user_corrected: true }, full_text: 'nothing overlapping whatsoever' })];
  const decisionsBoth = [{
    card: 'bbbbbbbb',
    action: 'delete',
    note: 'dup',
    ackHumanCorrection: ACK_HC,
    ackUncovered: ACK_UNCOV,
  }];

  const plan = buildDealPlan(DEAL_A, [...decisionsHC, ...decisionsBoth], [cardHC, cardBoth], [...provisionsHC, ...provisionsBoth], []);
  assert.equal(plan.ok, true);
  assert.ok(plan.entries.every((e) => e.ok));
});
