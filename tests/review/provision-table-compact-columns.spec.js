const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Phase B compact-column reshaping. ProvisionTable.jsx and
// ProvisionTablePrimitives.jsx use JSX syntax the plain `node --test`
// runner can't import directly (see tests/review/provision-table-
// primitives.spec.js's pre-existing source-matching style, which this
// file follows for the same reason). The truncation MATH is exercised
// as real, importable JS via card-utils.js's splitForCell(); the wiring
// into the two files above is asserted via source pattern-matching.

const provisionTablePath = path.join(__dirname, '..', '..', 'components', 'review', 'ProvisionTable.jsx');
const primitivesPath = path.join(__dirname, '..', '..', 'components', 'review', 'primitives', 'ProvisionTablePrimitives.jsx');

function readSource(p) {
  return fs.readFileSync(p, 'utf8');
}

// -- splitForCell(): the plain-JS truncation math ---------------------------

const { splitForCell } = require('../../components/review/table-configs/card-utils.js');

test('splitForCell leaves short text untouched (no truncation, no data loss)', () => {
  const result = splitForCell('12 months', 160);
  assert.equal(result.value, '12 months');
  assert.equal(result.short, '12 months');
  assert.equal(result.truncated, false);
});

test('splitForCell truncates long text at a word boundary and flags it', () => {
  const long = 'A'.repeat(50) + ' ' + 'B'.repeat(50) + ' ' + 'C'.repeat(100);
  const result = splitForCell(long, 100);
  assert.equal(result.value, long, 'full untruncated text must survive for the "see text" expander');
  assert.equal(result.truncated, true);
  assert.ok(result.short.length <= 100, 'preview must respect the max length');
  assert.ok(!result.short.endsWith('C'.repeat(100).slice(0, 10)), 'must not cut mid-word into the long run');
  assert.ok(long.startsWith(result.short), 'preview must be a genuine prefix of the full text, not a rewrite');
});

test('splitForCell falls back to a hard cut when the first token alone exceeds max', () => {
  const long = 'X'.repeat(500);
  const result = splitForCell(long, 100);
  assert.equal(result.truncated, true);
  assert.equal(result.short.length, 100);
  assert.equal(result.value, long);
});

test('splitForCell treats null/undefined/empty as empty, never throws', () => {
  assert.deepEqual(splitForCell(null), { value: '', short: '', truncated: false });
  assert.deepEqual(splitForCell(undefined), { value: '', short: '', truncated: false });
  assert.deepEqual(splitForCell(''), { value: '', short: '', truncated: false });
});

// -- FULL_TEXT_COLUMNS wiring (whole-column relocation) ---------------------

test('FULL_TEXT_COLUMNS registers the "signals already carry the value" families added in Phase B', () => {
  const body = readSource(provisionTablePath);
  for (const id of [
    'mae-definitions',
    'antitrust-regulatory',
    'representations-qualifiers',
    'structure-mechanics',
    'sec-meeting',
    'nosol-noshop',
    'nosol-intervening',
  ]) {
    assert.match(
      body,
      new RegExp(`'${id}':\\s*\\['detail'\\]`),
      `${id} should relocate its 'detail' column behind the see-text expander`,
    );
  }
});

test('FULL_TEXT_COLUMNS still carries every pre-Phase-B entry (no regression)', () => {
  const body = readSource(provisionTablePath);
  for (const [id, column] of [
    ['conditions-m', 'provision'],
    ['conditions-b', 'provision'],
    ['conditions-s', 'provision'],
    ['material-contracts', 'evidence'],
    ['tail-fee', 'evidence'],
    ['employee-benefits', 'detail'],
    ['no-other-reps-fraud', 'detail'],
  ]) {
    assert.match(body, new RegExp(`'${id}':\\s*\\['${column}'\\]`));
  }
});

test('mixed-shape families (termination-fees, general-covenants, consideration-hero, approvals-votes) are NOT wholesale-relocated', () => {
  // These families have at least one row whose 'detail'/'value' is the ONLY
  // visible copy of the value (no redundant signal pill mirrors it) --
  // hiding the whole column would drop that value from the compact view.
  // They use the per-cell TruncatedWithSeeText primitive instead (see below).
  const body = readSource(provisionTablePath);
  for (const id of ['termination-fees', 'general-covenants', 'consideration-hero', 'approvals-votes']) {
    assert.doesNotMatch(body, new RegExp(`'${id}':\\s*\\[`), `${id} must not be column-relocated -- it needs per-cell truncation, not whole-column hiding`);
  }
});

// -- TruncatedWithSeeText primitive wiring -----------------------------------

test('TruncatedWithSeeText primitive is exported and built on splitForCell', () => {
  const body = readSource(primitivesPath);
  assert.match(body, /export function TruncatedWithSeeText/);
  assert.match(body, /import \{ splitForCell \} from '\.\.\/table-configs\/card-utils\.js';/);
  assert.match(body, /splitForCell\(text, max\)/);
  assert.match(body, /see text/);
  assert.match(body, /<details/);
});

// -- Category-2 config files wire the new primitive into their compact column -

test('per-cell truncation is wired into every mixed-shape family\'s render function', () => {
  const configs = [
    ['termination-fees', 'termination-fees.config.js'],
    ['general-covenants', 'general-covenants.config.js'],
    ['tail-fee', 'tail-fee.config.js'],
    ['consideration-hero', 'consideration-hero.config.js'],
    ['approvals-votes', 'approvals-votes.config.js'],
  ];
  for (const [, file] of configs) {
    const body = readSource(path.join(__dirname, '..', '..', 'components', 'review', 'table-configs', file));
    assert.match(body, /ctx\?\.primitives\?\.TruncatedWithSeeText/, `${file} should route its compact value column through TruncatedWithSeeText`);
  }
});

// -- Behavioral: real config modules actually hand the long value to the
//    primitive (not just a source-level match) ------------------------------

test('general-covenants perClauseRows detail is routed through TruncatedWithSeeText with the full clause text', async () => {
  const { generalCovenantsConfig } = await import('../../components/review/table-configs/general-covenants.config.js');
  const longClause = 'The Company shall not, and shall cause its Subsidiaries not to, '.repeat(20).trim();
  const rows = generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-1',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-OTHER',
      short_title: 'Insurance Covenant',
      primary_quote: longClause,
      features: {},
    }],
  });
  const row = rows.find((r) => r.id === 'general-covenants-clause-cov-1');
  assert.ok(row, 'expected the per-clause fallback row to render from raw card text');
  assert.equal(row.detail, longClause, 'row.detail must still carry the FULL text -- truncation happens only at render time');

  // renderCell returns a React.createElement(...) descriptor -- inspecting
  // .type/.props tells us exactly what it would hand to the real primitive
  // without needing a JSX-capable renderer (see file header).
  const TruncatedWithSeeText = () => null;
  const detailColumn = generalCovenantsConfig.columns.find((c) => c.id === 'detail');
  const element = detailColumn.renderCell(row, { primitives: { TruncatedWithSeeText } });
  assert.equal(element.type, TruncatedWithSeeText);
  assert.equal(element.props.text, longClause, 'the primitive must receive the untruncated text so it alone decides what to cut');
});

test('termination-fees fee-amount detail is routed through TruncatedWithSeeText (protects the amount row, not just scalar rows)', async () => {
  const { terminationFeesConfig } = await import('../../components/review/table-configs/termination-fees.config.js');
  const rows = terminationFeesConfig.selectRows({
    cards: [{
      id: 'termf',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TARGET',
      primary_quote: 'The Company shall pay a termination fee of $190,000,000.',
      features: { terminationFees: { amount: '$190,000,000' } },
    }],
  });
  const amountRow = rows.find((r) => r.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(amountRow);
  const TruncatedWithSeeText = () => null;
  const detailColumn = terminationFeesConfig.columns.find((c) => c.id === 'detail');
  const element = detailColumn.renderCell(amountRow, { primitives: { TruncatedWithSeeText } });
  assert.equal(element.type, TruncatedWithSeeText);
  assert.match(element.props.text, /\$190,000,000/);
});

test('tail-fee Mechanic column truncates the arming-clauses row but leaves the threshold row on its dedicated primitive', async () => {
  const { tailFeeConfig } = await import('../../components/review/table-configs/tail-fee.config.js');
  const longTrigger = 'if the Company enters into, or the Company Board approves or recommends, a Company Takeover Proposal '.repeat(10).trim();
  const rows = tailFeeConfig.selectRows({
    cards: [{
      id: 'tail',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TAIL',
      primary_quote: longTrigger,
      features: {
        tailProvision: { period_months: 12, threshold_percentage: 50, triggers: [longTrigger] },
      },
    }],
  });
  const armingRow = rows.find((r) => r.id === 'tail-arming');
  const thresholdRow = rows.find((r) => r.id === 'tail-threshold');
  assert.ok(armingRow && thresholdRow);

  const TruncatedWithSeeText = () => null;
  const ThresholdCellWithHoverQuote = () => null;
  const primitives = { TruncatedWithSeeText, ThresholdCellWithHoverQuote };
  const mechanicColumn = tailFeeConfig.columns.find((c) => c.id === 'value');
  const armingElement = mechanicColumn.renderCell(armingRow, { primitives });
  const thresholdElement = mechanicColumn.renderCell(thresholdRow, { primitives });
  assert.equal(armingElement.type, TruncatedWithSeeText, 'only the arming-clauses row should go through the truncation primitive');
  assert.equal(armingElement.props.text, armingRow.value);
  assert.equal(thresholdElement.type, ThresholdCellWithHoverQuote, 'the threshold row keeps its dedicated ThresholdCellWithHoverQuote, unaffected by Phase B');
});

test('consideration-hero and approvals-votes route their sole detail column through TruncatedWithSeeText', async () => {
  const { considerationHeroConfig } = await import('../../components/review/table-configs/consideration-hero.config.js');
  const { approvalsVotesConfig } = await import('../../components/review/table-configs/approvals-votes.config.js');

  const considRows = considerationHeroConfig.selectRows({
    cards: [{
      id: 'consid-equity',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      primary_quote: 'Equity awards convert as follows.',
      features: {
        considerationType: 'CASH',
        perShareAmount: '$47.50',
        equityAwardTreatment: {
          espp: 'Terminated and refunded prior to Closing',
          stockOptions: 'Cancelled and converted into the right to receive the Option Consideration',
          restrictedStock: 'Vest in full immediately prior to the Effective Time',
        },
      },
    }],
  });
  const equityRow = considRows.find((r) => r.label === 'Equity-award treatment');
  assert.ok(equityRow, 'expected an equity-award-treatment row');
  const TruncatedWithSeeText = () => null;
  const considElement = considerationHeroConfig.columns.find((c) => c.id === 'detail').renderCell(equityRow, {
    primitives: { TruncatedWithSeeText },
  });
  assert.equal(considElement.type, TruncatedWithSeeText);
  assert.equal(considElement.props.text, equityRow.detail);

  const voteRows = approvalsVotesConfig.selectRows({
    cards: [{
      id: 'vote-1',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-VOTE',
      short_title: 'Stockholder Vote',
      primary_quote: 'The affirmative vote of a majority of outstanding shares is required.',
      features: { voteThreshold: 'Majority of outstanding shares entitled to vote' },
    }],
  });
  const voteRow = voteRows.find((r) => r.id === 'approvals-votes-vote-threshold');
  assert.ok(voteRow);
  const VoteTruncated = () => null;
  const voteElement = approvalsVotesConfig.columns.find((c) => c.id === 'detail').renderCell(voteRow, {
    primitives: { TruncatedWithSeeText: VoteTruncated },
  });
  assert.equal(voteElement.type, VoteTruncated);
  assert.equal(voteElement.props.text, voteRow.detail);
});
