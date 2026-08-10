const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DECISION_RECONCILIATION_BINDINGS,
  DECISION_GROUPS,
  DECISIONS,
  DISSENT_THRESHOLD_RETIREMENT_PROVENANCE,
  M3_STAGES,
  RECORDED_RULINGS,
  decisionById,
  mergeRecordedRulings,
  recommendedChoice,
} = require('../lib/programme-decision-console');

test('decision console has one complete, unique recommendation per decision', () => {
  assert.ok(DECISIONS.length >= 15);
  assert.equal(new Set(DECISIONS.map((decision) => decision.id)).size, DECISIONS.length);

  for (const decision of DECISIONS) {
    assert.ok(DECISION_GROUPS.some((group) => group.id === decision.group));
    assert.ok(decision.question);
    assert.ok(decision.evidence);
    assert.ok(decision.current);
    assert.ok(decision.recommendation);
    assert.ok(decision.consequence);
    assert.ok(decision.source);
    assert.equal(decision.options.filter((option) => option.recommended).length, 1);
    assert.ok(decision.options.some((option) => option.id === recommendedChoice(decision)));
    assert.equal(decisionById(decision.id), decision);
  }
});

test('recorded rulings stay fixed and follow-on rulings are added without duplicates', () => {
  assert.equal(Object.keys(RECORDED_RULINGS).length, 41);
  assert.deepEqual(
    DECISIONS.filter((decision) => !RECORDED_RULINGS[decision.id]).map((decision) => decision.id),
    [
      'antitrust-core-taxonomy',
      'employee-dno-follow-on',
      'financing-follow-on',
      'defined-term-relationship-model',
      'merger-mechanics-follow-on',
      'remedies-boilerplate-follow-on',
      'tax-dividend-appraisal-details',
      'termination-wave-b-promotion',
    ],
  );
  for (const [decisionId, optionId] of Object.entries(RECORDED_RULINGS)) {
    assert.ok(decisionById(decisionId).options.some((option) => option.id === optionId));
  }
});

test('the dissent-threshold retirement is recorded once and reconciled to its consumers', () => {
  const decisionId = 'closing-dissent-threshold-retirement';
  const choice = 'APPROVED_RETIRED_OPEN_WORLD';
  const decision = decisionById(decisionId);
  assert.ok(decision);
  assert.equal(RECORDED_RULINGS[decisionId], choice);
  assert.equal(decision.options.find((option) => option.recommended).id, choice);
  assert.equal(decision.provenance, DISSENT_THRESHOLD_RETIREMENT_PROVENANCE);
  assert.deepEqual(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE, {
    assistant_prompt_timestamp: '2026-08-04T13:13:05.876Z',
    response_timestamp: '2026-08-04T13:21:06.252Z',
    session_log_path: '/Users/bengoodchild/.codex/sessions/2026/08/03/rollout-2026-08-03T06-01-47-019fc5ff-dc06-70b3-bc8a-6f6afc627632.jsonl',
    assistant_prompt_line: 21490,
    response_line: 21496,
    assistant_prompt_excerpt: 'One decision is needed now: approve retiring `DISSENT_THRESHOLD` as a comparable M3 field. Exact future language remains preserved as open-world evidence. My recommendation remains to approve.',
    response_excerpt: 'Approved. Proceed with all speed, using agents to maximize speed and manage cost',
  });

  const binding = DECISION_RECONCILIATION_BINDINGS[decisionId];
  assert.equal(binding.recorded_choice, choice);
  assert.equal(binding.field, 'DISSENT_THRESHOLD');
  assert.equal(binding.product_surface_id, 'closing-conditions-dissent-threshold');
  assert.ok(binding.consumers.every((consumer) => (
    fs.existsSync(path.resolve(__dirname, '..', consumer))
  )));
});

test('follow-on rulings carry corpus counts, clause examples and a promotion horizon', () => {
  const followOn = DECISIONS.filter((decision) => decision.origin === 'follow-on');
  assert.equal(followOn.length, 27);
  assert.deepEqual(
    followOn.filter((decision) => decision.horizon === 'now').map((decision) => decision.id),
    [
      'proxy-record-date-broker-search',
      'proxy-parent-adoption',
      'proxy-adjournment-reasons',
      'appraisal-dispatch-ownership',
      'dividend-concept-scope',
      'rank-85-dividend-dno',
      'consideration-mechanics-promotion',
      'appraisal-necessary-implication',
      'ioc-qualifier-attachment',
      'ioc-numeric-shape',
      'derived-comparison-layer',
      'remaining-family-ranks',
      'outside-date-extension-shape',
      'restraint-finality-states',
      'sole-remedy-ownership',
      'fee-tail-shape',
      'late-interest-shape',
      'key-defined-terms-ranks',
      'family-routing-key',
    ],
  );
  assert.equal(followOn.filter((decision) => decision.horizon === 'later').length, 8);
  for (const decision of followOn) {
    assert.match(decision.corpus, /\d/);
    assert.ok(Array.isArray(decision.examples));
    assert.ok(decision.examples.length > 0);
    assert.ok(decision.examples.every((example) => typeof example === 'string' && example.length > 20));
  }
});

test('recorded family rulings retain their controlling legal distinctions', () => {
  const approvals = decisionById('proxy-parent-adoption');
  assert.match(approvals.recommendation, /separate Parent approval and Merger Sub approval concepts/);
  assert.equal(RECORDED_RULINGS[approvals.id], 'split-concepts');

  const numeric = decisionById('ioc-numeric-shape');
  assert.ok(numeric.examples.some((example) => /25000000/.test(example)));
  assert.match(numeric.recommendation, /exact literal plus normalised amount, currency, basis and period/);
  assert.match(numeric.recommendation, /separately traced derived layer/);

  const derived = decisionById('derived-comparison-layer');
  for (const field of ['source literal', 'source unit', 'FX source', 'rate and signing date', 'target unit', 'output', 'derived status']) {
    assert.match(derived.recommendation, new RegExp(field, 'i'));
  }
  assert.match(derived.recommendation, /Never overwrite the raw claim/);
  assert.equal(RECORDED_RULINGS[derived.id], 'approve-layer');
  assert.match(derived.recommendation, /signing date/i);
  assert.match(derived.recommendation, /clearly label.*derived/i);

  assert.equal(RECORDED_RULINGS['remaining-family-ranks'], 'approve-ranks');
  assert.match(decisionById('remaining-family-ranks').recommendation, /Guaranty 74.*Financing 75.*Proxy 80.*Tax 81.*Employee 82.*Dividends 84.*D&O 85/);
  assert.equal(RECORDED_RULINGS['family-routing-key'], 'type-plus-subtype');
  assert.match(decisionById('family-routing-key').question, /wider definition/i);
  assert.match(decisionById('family-routing-key').examples.join(' '), /TERMR-VOTE/);
  assert.equal(RECORDED_RULINGS['consideration-mechanics-promotion'], 'ratify-core');
  assert.equal(RECORDED_RULINGS['termination-wave-b-promotion'], undefined);
  assert.equal(RECORDED_RULINGS['sole-remedy-ownership'], 'remedies-owner');
  assert.match(decisionById('sole-remedy-ownership').recommendation, /Route the sole-remedy legal effect and exceptions to Remedies/);
  assert.match(decisionById('sole-remedy-ownership').recommendation, /payment context and source evidence with Termination Fees/);
  assert.match(decisionById('sole-remedy-ownership').recommendation, /Fraud and Willful Breach as separate quoted carve-outs/);
});

test('prior rulings are represented once and remain recorded', () => {
  for (const id of ['topbuild-mae', 'tax-opinion', 'rank-88', 'guaranty-codes']) {
    assert.equal(DECISIONS.filter((decision) => decision.id === id).length, 1);
    assert.ok(RECORDED_RULINGS[id]);
  }
});

test('saved open answers survive while recorded rulings remain authoritative', () => {
  const choices = mergeRecordedRulings({
    'antitrust-core-taxonomy': 'adopt-core',
    'db-apply': 'hold',
  });
  assert.equal(choices['antitrust-core-taxonomy'], 'adopt-core');
  assert.equal(choices['db-apply'], 'fixture-go');
});

test('M3 route ends at certification and keeps production import outside M3', () => {
  assert.deepEqual(M3_STAGES.map((stage) => stage.number), ['01', '02', '03', '04', '05', '06', '07']);
  assert.match(M3_STAGES.at(-1).exit, /M3_FULL_CORPUS_CERTIFICATION/);
  assert.match(M3_STAGES.at(-1).exit, /Production import remains an M4 step/);
});
