const test = require('node:test');
const assert = require('node:assert/strict');

const { parseNumeric, parseDuration, classifyNullReason, wordsToNumber, CLOSED_UNITS } = require('../lib/normalize-numeric');
const {
  ATTRIBUTES,
  ALLOWLISTED_ATTRIBUTES,
  extractCandidate,
  decideRow,
  buildBackfillPlan,
  formatPlanReport,
  ensureColumnGuard,
  applyWrites,
  parseArgs,
} = require('../scripts/backfill/normalize-numeric-claims');

// ---------------------------------------------------------------------------
// 1. parseNumeric — round-trip fixtures for every form the spec lists.
// ---------------------------------------------------------------------------

test('parseNumeric: dollar amount with commas', () => {
  assert.deepEqual(parseNumeric('$5,000,000'), { value: 5000000, unit: 'USD' });
});

test('parseNumeric: dollar amount with a "million" multiplier', () => {
  assert.deepEqual(parseNumeric('$5.0 million'), { value: 5000000, unit: 'USD' });
});

test('parseNumeric: dollar amount with a trailing .00', () => {
  assert.deepEqual(parseNumeric('$5,000,000.00'), { value: 5000000, unit: 'USD' });
});

test('parseNumeric: spelled-out dollar amount ("five million dollars")', () => {
  assert.deepEqual(parseNumeric('five million dollars'), { value: 5000000, unit: 'USD' });
});

test('parseNumeric: spelled number + parenthetical numeral in agreement ("twenty-four (24) months")', () => {
  assert.deepEqual(parseNumeric('twenty-four (24) months'), { value: 24, unit: 'months' });
});

test('parseNumeric: "three (3) business days" -> business_days', () => {
  assert.deepEqual(parseNumeric('three (3) business days'), { value: 3, unit: 'business_days' });
});

test('parseNumeric: unit-word casing does not matter ("three (3) Business Days")', () => {
  assert.deepEqual(parseNumeric('three (3) Business Days'), { value: 3, unit: 'business_days' });
});

test('parseNumeric: plain "45 days"', () => {
  assert.deepEqual(parseNumeric('45 days'), { value: 45, unit: 'calendar_days' });
});

test('parseNumeric: explicit calendar days and elapsed hours retain different clocks', () => {
  assert.deepEqual(parseNumeric('four (4) calendar days'), { value: 4, unit: 'calendar_days' });
  assert.deepEqual(parseNumeric('ninety-six (96) hours'), { value: 96, unit: 'elapsed_hours' });
});

test('parseDuration: legal ordinal and hyphenated business-day forms remain business days', () => {
  assert.deepEqual(parseDuration('the third (3rd) Business Day following delivery'), { value: 3, unit: 'business_days' });
  assert.deepEqual(parseDuration('during the five (5)-Business-Day period'), { value: 5, unit: 'business_days' });
});

test('parseNumeric: "2.5%"', () => {
  assert.deepEqual(parseNumeric('2.5%'), { value: 2.5, unit: 'percent' });
});

test('parseNumeric: spelled + parenthetical percent in agreement ("two percent (2%)")', () => {
  assert.deepEqual(parseNumeric('two percent (2%)'), { value: 2, unit: 'percent' });
});

test('parseNumeric: spelled tens word alone with a unit ("thirty days")', () => {
  assert.deepEqual(parseNumeric('thirty days'), { value: 30, unit: 'calendar_days' });
});

test('parseNumeric: spelled compound tens+ones with a unit ("forty-five days")', () => {
  assert.deepEqual(parseNumeric('forty-five days'), { value: 45, unit: 'calendar_days' });
});

test('parseNumeric: parenthetical-numeral CONFLICT with spelled word -> null ("twenty (24) months")', () => {
  assert.equal(parseNumeric('twenty (24) months'), null);
});

test('parseNumeric: a range ("20 to 30 days") is ambiguous -> null', () => {
  assert.equal(parseNumeric('20 to 30 days'), null);
});

test('parseNumeric: a hyphenated range ("20-30 days") is ambiguous -> null', () => {
  assert.equal(parseNumeric('20-30 days'), null);
});

test('parseNumeric: vague language ("promptly") -> null', () => {
  assert.equal(parseNumeric('promptly'), null);
});

test('parseNumeric: vague language ("a reasonable period") -> null', () => {
  assert.equal(parseNumeric('a reasonable period'), null);
});

test('parseNumeric: a naked number with no unit at all -> null (never guess a unit)', () => {
  assert.equal(parseNumeric('45'), null);
});

test('parseNumeric: non-string / empty input -> null, never throws', () => {
  assert.equal(parseNumeric(null), null);
  assert.equal(parseNumeric(undefined), null);
  assert.equal(parseNumeric(42), null);
  assert.equal(parseNumeric(''), null);
  assert.equal(parseNumeric('   '), null);
});

test('parseNumeric: conflicting dollar amounts in one value -> null', () => {
  assert.equal(
    parseNumeric('up to a maximum of $30,000,000 in the event such expenses are paid, and $50,000,000 in all other cases'),
    null,
  );
});

test('parseNumeric: two distinct duration mentions in free text -> null (ambiguous)', () => {
  const text = 'Eighteen (18) months after the Closing Date for non-fundamental representations; for the '
    + 'Fundamental Representations, the applicable statutes of limitations plus 60 days.';
  assert.equal(parseNumeric(text), null);
});

test('parseNumeric: a single unambiguous duration inside a longer sentence still resolves', () => {
  assert.deepEqual(parseNumeric('Twelve (12) months following the Closing Date.'), { value: 12, unit: 'months' });
});

test('wordsToNumber: rejects a phrase containing a non-number word', () => {
  assert.equal(wordsToNumber('twenty banana'), null);
});

test('CLOSED_UNITS: time clocks are explicit and generic days is not canonical', () => {
  assert.deepEqual(
    [...CLOSED_UNITS].sort(),
    ['USD', 'business_days', 'calendar_days', 'elapsed_hours', 'months', 'percent', 'shares', 'years'].sort(),
  );
});

// ---------------------------------------------------------------------------
// 2. Performance guard — long free text must resolve near-instantly (this
//    caught a real catastrophic-backtracking bug during development).
// ---------------------------------------------------------------------------

test('parseNumeric: does not catastrophically backtrack on long free text with no unit at all', () => {
  const longText = 'shall survive until (but not beyond) the Effective Time and no representations or warranties '.repeat(20);
  const start = Date.now();
  const result = parseNumeric(longText);
  assert.equal(result, null);
  assert.ok(Date.now() - start < 500, 'parseNumeric took too long on long free text');
});

test('parseNumeric: does not catastrophically backtrack on long text ending in "dollars" with no valid number phrase', () => {
  const longText = `${'the quick brown fox jumps over the lazy dog '.repeat(30)}dollars`;
  const start = Date.now();
  const result = parseNumeric(longText);
  assert.equal(result, null);
  assert.ok(Date.now() - start < 500, 'parseNumeric took too long on long dollars text');
});

// ---------------------------------------------------------------------------
// 3. classifyNullReason — buckets a null result for reporting only.
// ---------------------------------------------------------------------------

test('classifyNullReason: a naked number with no unit -> null-unit', () => {
  assert.equal(classifyNullReason('45'), 'null-unit');
});

test('classifyNullReason: vague language with no number at all -> null-ambiguous', () => {
  assert.equal(classifyNullReason('promptly'), 'null-ambiguous');
});

test('classifyNullReason: a range -> null-ambiguous', () => {
  assert.equal(classifyNullReason('20 to 30 days'), 'null-ambiguous');
});

// ---------------------------------------------------------------------------
// 4. Attribute allowlist / extraction strategies — real corpus shapes
//    (verified against the live claims.attribute column; see session report
//    for the query and the reasoning behind every substitution).
// ---------------------------------------------------------------------------

test('allowlist: exactly the thirteen real attributes settled on after live verification', () => {
  assert.deepEqual(
    [...ALLOWLISTED_ATTRIBUTES].sort(),
    [
      'arcReaffirmDeadlineDays',
      'companyTerminationFee',
      'discussionInitiationNoticeHours',
      'expenseReimbursement',
      'initialMatchPeriodDays',
      'matchingPeriod',
      'noticePeriod',
      'outsideDateMonthsPostSigning',
      'repsSurvivalDuration',
      'reverseTerminationFee',
      'subsequentMatchPeriodDays',
      'superiorProposalThresholdPct',
      'tailProvision',
    ].sort(),
  );
});

test('extractCandidate: companyTerminationFee pulls .amount out of the structured object verbatim', () => {
  const verbatim = JSON.stringify({ amount: '$7,000,000', triggers: [], payment_deadline: 'promptly' });
  assert.deepEqual(extractCandidate('companyTerminationFee', verbatim), {
    result: { value: 7000000, unit: 'USD' },
    reason: 'parsed',
  });
});

test('extractCandidate: reverseTerminationFee null .amount -> null-ambiguous, not a crash', () => {
  const verbatim = JSON.stringify({ amount: null, triggers: [] });
  assert.deepEqual(extractCandidate('reverseTerminationFee', verbatim), { result: null, reason: 'null-ambiguous' });
});

test('extractCandidate: expenseReimbursement pulls .amount_cap, and a two-tier cap description is ambiguous', () => {
  const clean = JSON.stringify({ triggers: [], amount_cap: '$20,000,000' });
  assert.deepEqual(extractCandidate('expenseReimbursement', clean), {
    result: { value: 20000000, unit: 'USD' },
    reason: 'parsed',
  });

  const twoTier = JSON.stringify({
    triggers: [],
    amount_cap: 'up to a maximum of $30,000,000 in the event such expenses are paid in connection with a '
      + 'termination pursuant to Section 7.01(b)(iii), and $50,000,000 in all other cases',
  });
  assert.deepEqual(extractCandidate('expenseReimbursement', twoTier), { result: null, reason: 'null-ambiguous' });
});

test('extractCandidate: tailProvision reads .period_months directly (already a JSON number)', () => {
  const verbatim = JSON.stringify({ triggers: [], period_months: 12, threshold_percentage: '50%' });
  assert.deepEqual(extractCandidate('tailProvision', verbatim), { result: { value: 12, unit: 'months' }, reason: 'parsed' });
});

test('extractCandidate: malformed JSON verbatim on an object-shaped attribute never throws', () => {
  assert.deepEqual(extractCandidate('companyTerminationFee', 'not valid json{{'), { result: null, reason: 'null-ambiguous' });
});

test('extractCandidate: bare notice and match values fail closed without an explicit clock', () => {
  assert.deepEqual(extractCandidate('matchingPeriod', '4'), { result: null, reason: 'null-unit' });
  assert.deepEqual(extractCandidate('noticePeriod', '5'), { result: null, reason: 'null-unit' });
  assert.deepEqual(extractCandidate('noticePeriod', '4', {
    evidence_quote: null,
    provenance: { code: 'NOSOL-NEGOTIATE', feature_key: 'noticePeriod', feature_value: 4 },
  }), { result: null, reason: 'null-unit' });
});

test('extractCandidate: evidence preserves business-day, calendar-day and elapsed-hour clocks', () => {
  assert.deepEqual(
    extractCandidate('initialMatchPeriodDays', '5', { evidence_quote: 'during the five (5) Business Day period' }),
    { result: { value: 5, unit: 'business_days' }, reason: 'parsed' },
  );
  assert.deepEqual(
    extractCandidate('matchingPeriod', '4', { evidence_quote: 'at least four calendar days prior written notice' }),
    { result: { value: 4, unit: 'calendar_days' }, reason: 'parsed' },
  );
  assert.deepEqual(
    extractCandidate('noticePeriod', '96', { evidence_quote: 'at least 96 hours written notice' }),
    { result: { value: 96, unit: 'elapsed_hours' }, reason: 'parsed' },
  );
});

test('extractCandidate: structured provenance can supply a clock, but conflicting context fails closed', () => {
  const businessProvenance = { provenance: { feature_value: { value: 4, unit: 'business_days' } } };
  assert.deepEqual(
    extractCandidate('noticePeriod', '4', businessProvenance),
    { result: { value: 4, unit: 'business_days' }, reason: 'parsed' },
  );
  assert.deepEqual(
    extractCandidate('noticePeriod', '4', {
      evidence_quote: 'four Business Days prior notice',
      provenance: { feature_value: { value: 4, unit: 'calendar_days' } },
    }),
    { result: null, reason: 'null-ambiguous' },
  );
});

test('extractCandidate: fixed non-clock attributes retain their explicit units', () => {
  assert.deepEqual(extractCandidate('superiorProposalThresholdPct', '50'), { result: { value: 50, unit: 'percent' }, reason: 'parsed' });
  assert.deepEqual(extractCandidate('outsideDateMonthsPostSigning', '6'), { result: { value: 6, unit: 'months' }, reason: 'parsed' });
});

test('extractCandidate: discussionInitiationNoticeHours remains elapsed hours without lossy conversion', () => {
  assert.deepEqual(extractCandidate('discussionInitiationNoticeHours', '24'), { result: { value: 24, unit: 'elapsed_hours' }, reason: 'parsed' });
  assert.deepEqual(extractCandidate('discussionInitiationNoticeHours', '36'), { result: { value: 36, unit: 'elapsed_hours' }, reason: 'parsed' });
  assert.deepEqual(extractCandidate('discussionInitiationNoticeHours', '48 hours'), { result: { value: 48, unit: 'elapsed_hours' }, reason: 'parsed' });
});

test('extractCandidate: repsSurvivalDuration runs the generic free-text parser and correctly nulls multi-clause values', () => {
  const multiClause = 'Eighteen (18) months after the Closing Date for non-fundamental Article III/Article IV '
    + 'representations and warranties; for the Cabot Fundamental Representations and Columbus Fundamental '
    + 'Representations, the applicable statutes of limitations (giving effect to any waiver, mitigation or '
    + 'extension thereof) plus 60 days.';
  assert.deepEqual(extractCandidate('repsSurvivalDuration', multiClause), { result: null, reason: 'null-ambiguous' });

  const simple = 'Twelve (12) months following the Closing Date.';
  assert.deepEqual(extractCandidate('repsSurvivalDuration', simple), { result: { value: 12, unit: 'months' }, reason: 'parsed' });

  const noNumber = 'shall survive until (but not beyond) the Effective Time';
  assert.deepEqual(extractCandidate('repsSurvivalDuration', noNumber), { result: null, reason: 'null-ambiguous' });
});

test('extractCandidate: an attribute outside the allowlist is a defined no-op, not a crash', () => {
  assert.deepEqual(extractCandidate('someRandomAttribute', '5'), { result: null, reason: 'skip-unknown-attribute' });
});

// ---------------------------------------------------------------------------
// 5. Backfill planner — idempotency, never-overwrite-differing, dry-run
//    purity (mock sb conventions per tests/curation-prune-cards.test.js).
// ---------------------------------------------------------------------------

function row(overrides = {}) {
  return {
    id: 'claim-1',
    deal_id: 'deal-a',
    attribute: 'initialMatchPeriodDays',
    verbatim: '5',
    evidence_quote: 'during the five (5) Business Day period',
    provenance: null,
    canonical_numeric: null,
    ...overrides,
  };
}

test('decideRow: fresh parse with no existing value -> planned write, status parsed', () => {
  const r = decideRow(row());
  assert.equal(r.status, 'parsed');
  assert.deepEqual(r.write, { value: 5, unit: 'business_days' });
});

test('decideRow: idempotent — identical existing value -> no write planned, still counted parsed', () => {
  const r = decideRow(row({ canonical_numeric: { value: 5, unit: 'business_days' } }));
  assert.equal(r.status, 'parsed');
  assert.equal(r.write, null);
  assert.equal(r.note, 'idempotent-already-set');
});

test('decideRow: never overwrites a DIFFERING existing value — reported as skipped-existing, no write', () => {
  const r = decideRow(row({ canonical_numeric: { value: 4, unit: 'business_days' } }));
  assert.equal(r.status, 'skipped-existing');
  assert.equal(r.write, null);
  assert.deepEqual(r.conflict, { existing: { value: 4, unit: 'business_days' }, parsed: { value: 5, unit: 'business_days' } });
});

test('decideRow: a value that fails to parse never touches an existing value, regardless of what it is', () => {
  const r = decideRow(row({ verbatim: 'promptly', canonical_numeric: { value: 4, unit: 'business_days' } }));
  assert.equal(r.status, 'null-ambiguous');
  assert.equal(r.write, null);
});

test('buildBackfillPlan: aggregates per-attribute counters across a batch and never mutates input rows', () => {
  const rows = [
    row({ id: 'c1', verbatim: '5' }), // parsed
    row({ id: 'c2', verbatim: 'promptly' }), // null-ambiguous
    row({ id: 'c3', verbatim: '45', evidence_quote: null, attribute: 'matchingPeriod' }), // null-unit
    row({ id: 'c4', verbatim: '5', canonical_numeric: { value: 4, unit: 'business_days' } }), // skipped-existing
  ];
  const snapshot = JSON.parse(JSON.stringify(rows));
  const plan = buildBackfillPlan(rows);

  assert.deepEqual(rows, snapshot); // pure — no mutation

  assert.equal(plan.counters.initialMatchPeriodDays.parsed, 1);
  assert.equal(plan.counters.initialMatchPeriodDays['null-ambiguous'], 1);
  assert.equal(plan.counters.initialMatchPeriodDays['skipped-existing'], 1);
  assert.equal(plan.counters.matchingPeriod['null-unit'], 1);

  assert.equal(plan.toWrite.length, 1);
  assert.equal(plan.toWrite[0].id, 'c1');

  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].id, 'c4');
});

test('buildBackfillPlan: dry-run purity — planning never calls any DB method (the plan object carries no sb reference)', () => {
  const rows = [row({ id: 'c1' })];
  const plan = buildBackfillPlan(rows);
  assert.equal(typeof plan.toWrite, 'object');
  assert.equal(Object.prototype.hasOwnProperty.call(plan, 'sb'), false);
  // formatPlanReport is pure formatting, also DB-free.
  const text = formatPlanReport(plan);
  assert.match(text, /planned writes: 1/);
});

// ---------------------------------------------------------------------------
// 6. DB plumbing — mock sb conventions (tests/curation-prune-cards.test.js style).
// ---------------------------------------------------------------------------

test('ensureColumnGuard: column present -> ok, no writes attempted', async () => {
  const sb = {
    from: () => ({
      select: () => ({ limit: () => Promise.resolve({ error: null }) }),
    }),
  };
  const result = await ensureColumnGuard(sb);
  assert.equal(result.ok, true);
});

test('ensureColumnGuard: column absent -> not ok, never throws, caller must stop', async () => {
  const sb = {
    from: () => ({
      select: () => ({ limit: () => Promise.resolve({ error: { message: 'column "canonical_numeric" does not exist' } }) }),
    }),
  };
  const result = await ensureColumnGuard(sb);
  assert.equal(result.ok, false);
});

test('applyWrites: writes are scoped to .is("canonical_numeric", null) — belt-and-braces never-clobber', async () => {
  const calls = [];
  const sb = {
    from: (table) => ({
      update: (patch) => ({
        eq: (col, id) => ({
          is: (col2, val) => {
            calls.push({ table, patch, id, guard: [col2, val] });
            return Promise.resolve({ error: null });
          },
        }),
      }),
    }),
  };
  const toWrite = [{ id: 'c1', write: { value: 5, unit: 'business_days' } }];
  const result = await applyWrites(sb, toWrite);
  assert.deepEqual(result, { applied: 1, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'claims');
  assert.deepEqual(calls[0].patch, { canonical_numeric: { value: 5, unit: 'business_days' } });
  assert.deepEqual(calls[0].guard, ['canonical_numeric', null]);
});

test('applyWrites: a failed write is counted, not thrown', async () => {
  const sb = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => Promise.resolve({ error: { message: 'boom' } }),
        }),
      }),
    }),
  };
  const result = await applyWrites(sb, [{ id: 'c1', write: { value: 5, unit: 'business_days' } }]);
  assert.deepEqual(result, { applied: 0, failed: 1 });
});

// ---------------------------------------------------------------------------
// 7. CLI arg parsing.
// ---------------------------------------------------------------------------

test('parseArgs: --deal accepts a comma-separated list', () => {
  const args = parseArgs(['node', 'script', '--deal', 'a,b,c']);
  assert.deepEqual(args.deals, ['a', 'b', 'c']);
  assert.equal(args.all, false);
  assert.equal(args.apply, false);
});

test('parseArgs: --all and --apply and --json flags', () => {
  const args = parseArgs(['node', 'script', '--all', '--apply', '--json']);
  assert.equal(args.all, true);
  assert.equal(args.apply, true);
  assert.equal(args.json, true);
});

test('ATTRIBUTES config: every allowlisted attribute has a known extraction strategy', () => {
  const knownStrategies = new Set(['bare-number', 'contextual-duration', 'text', 'json-field-text', 'json-field-number']);
  for (const attr of ALLOWLISTED_ATTRIBUTES) {
    assert.ok(knownStrategies.has(ATTRIBUTES[attr].strategy), `${attr} has an unknown strategy`);
  }
});
