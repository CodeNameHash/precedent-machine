const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUGUST_4_FINAL_RATIFICATION_PROVENANCE,
  AUGUST_4_PACKAGE_RULING_PROVENANCE,
  DECISION_GROUPS,
  DECISIONS,
  DISSENT_THRESHOLD_RETIREMENT_PROVENANCE,
  M3_STAGES,
  PENDING_USER_RATIFICATION_RULING_IDS,
  PRIMARY_RULING_PROVENANCE_BY_ID,
  PRIMARY_RULING_PROVENANCE_GROUPS,
  RECORDED_RULINGS,
  VALIDATED_RULING_CHOICES,
  decisionById,
  mergeRecordedRulings,
  recommendedChoice,
  validateRecordedRulingProvenance,
} = require('../lib/programme-decision-console');

const PORTABLE_PROVENANCE_FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'programme-decision-provenance.json'),
  'utf8',
));

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
  assert.equal(Object.keys(RECORDED_RULINGS).length, 54);
  assert.deepEqual(
    DECISIONS.filter((decision) => !RECORDED_RULINGS[decision.id]).map((decision) => decision.id),
    [
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

test('the dissent-threshold retirement has an exact recorded option and primary provenance', () => {
  const decision = decisionById('closing-dissent-threshold-retirement');
  assert.equal(RECORDED_RULINGS[decision.id], 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(recommendedChoice(decision), 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(decision.provenance, DISSENT_THRESHOLD_RETIREMENT_PROVENANCE);
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.authority, 'NONE');
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.response_role, 'USER');
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.response_message_type, 'input_text');
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.assistant_prompt_role, 'ASSISTANT');
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.assistant_prompt_message_type, 'output_text');
  assert.equal(DISSENT_THRESHOLD_RETIREMENT_PROVENANCE.external_session_log_locator.startsWith('/'), false);
});

test('primary ruling provenance is complete after the final two ratifications', () => {
  assert.equal(validateRecordedRulingProvenance(), true);
  assert.deepEqual(PENDING_USER_RATIFICATION_RULING_IDS, []);
  assert.equal(Object.keys(PRIMARY_RULING_PROVENANCE_BY_ID).length, 54);
  assert.equal(Object.keys(VALIDATED_RULING_CHOICES).length, 54);
  assert.equal(AUGUST_4_FINAL_RATIFICATION_PROVENANCE.response_excerpt, 'Okay on all\n');
  assert.deepEqual(AUGUST_4_FINAL_RATIFICATION_PROVENANCE.ruling_ids, ['rem-cap', 'closing-revisit']);

  for (const [rulingId, optionId] of Object.entries(RECORDED_RULINGS)) {
    const decision = decisionById(rulingId);
    assert.equal(decision.provenance, PRIMARY_RULING_PROVENANCE_BY_ID[rulingId]);
    assert.equal(decision.provenance_status, 'PRIMARY_USER_EVIDENCE');
    assert.equal(decision.provenance.selected_options[rulingId], optionId);
  }
});

test('primary provenance is portable, evidence-only and has exact response identity', () => {
  for (const provenance of PRIMARY_RULING_PROVENANCE_GROUPS) {
    assert.equal(provenance.authority, 'NONE');
    assert.equal(provenance.response_role, 'USER');
    assert.equal(provenance.response_message_type, 'input_text');
    assert.equal(provenance.external_session_log_locator.startsWith('/'), false);
    assert.match(provenance.external_session_log_locator, /^sessions\/2026\/08\/0[34]\//);
    assert.ok(Number.isInteger(provenance.response_line));
    assert.match(provenance.response_message_id, /^msg_/);
    assert.match(provenance.response_turn_id, /^[0-9a-f-]{36}$/);
    assert.match(provenance.response_line_sha256, /^[a-f0-9]{64}$/);
    if (provenance.assistant_prompt_line !== undefined) {
      assert.equal(provenance.assistant_prompt_role, 'ASSISTANT');
      assert.equal(provenance.assistant_prompt_message_type, 'output_text');
      assert.match(provenance.assistant_prompt_message_id, /^msg_/);
      assert.match(provenance.assistant_prompt_turn_id, /^[0-9a-f-]{36}$/);
      assert.match(provenance.assistant_prompt_line_sha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(Object.keys(provenance.selected_options).length, provenance.ruling_ids.length);
  }
  assert.equal('condition_terminal_disposition' in AUGUST_4_PACKAGE_RULING_PROVENANCE, false);
});

test('portable JSONL fixture verifies exact excerpts and raw-line hashes without a home-session read', () => {
  assert.equal(PORTABLE_PROVENANCE_FIXTURE.schema_version, 'CANONICAL_V2_PROGRAMME_DECISION_PROVENANCE_FIXTURE/V2');
  const recordKey = (locator, line) => `${locator}:${line}`;
  const recordsByKey = new Map(PORTABLE_PROVENANCE_FIXTURE.records.map((record) => [recordKey(record.locator, record.line), record]));
  assert.equal(recordsByKey.size, PORTABLE_PROVENANCE_FIXTURE.records.length);
  const expectedKeys = new Set();
  for (const record of recordsByKey.values()) {
    assert.equal(crypto.createHash('sha256').update(record.raw_line, 'utf8').digest('hex'), record.sha256);
    assert.match(record.locator, /^sessions\/2026\/08\/0[34]\//);
    assert.ok(Number.isInteger(record.line));
    assert.match(record.message_id, /^msg_/);
    assert.match(record.turn_id, /^[0-9a-f-]{36}$/);
    assert.ok(['user', 'assistant'].includes(record.role));
    assert.ok(['input_text', 'output_text'].includes(record.message_type));
  }
  for (const provenance of PRIMARY_RULING_PROVENANCE_GROUPS) {
    for (const kind of ['response', 'assistant_prompt']) {
      if (!Number.isInteger(provenance[`${kind}_line`])) continue;
      const key = recordKey(provenance.external_session_log_locator, provenance[`${kind}_line`]);
      expectedKeys.add(key);
      const record = recordsByKey.get(key);
      assert.ok(record, `missing fixture record ${key}`);
      const parsed = JSON.parse(record.raw_line);
      const content = parsed.payload.content[0].text;
      assert.equal(record.sha256, provenance[`${kind}_line_sha256`]);
      assert.equal(record.message_id, provenance[`${kind}_message_id`]);
      assert.equal(record.turn_id, provenance[`${kind}_turn_id`]);
      assert.equal(record.role, provenance[`${kind}_role`].toLowerCase());
      assert.equal(record.message_type, provenance[`${kind}_message_type`]);
      assert.equal(parsed.payload.id, provenance[`${kind}_message_id`]);
      assert.equal(parsed.payload.role, record.role);
      assert.equal(parsed.payload.content[0].type, record.message_type);
      assert.equal(parsed.payload.internal_chat_message_metadata_passthrough.turn_id, provenance[`${kind}_turn_id`]);
      assert.ok(content.includes(provenance[`${kind}_excerpt`]), key);
    }
  }
  assert.deepEqual([...recordsByKey.keys()].sort(), [...expectedKeys].sort());
});

test('provenance validator rejects hostile option, identity, role, excerpt, scope and override tampering', () => {
  const first = PRIMARY_RULING_PROVENANCE_GROUPS[0];
  const alteredOption = Object.freeze({
    ...first,
    selected_options: Object.freeze({ ...first.selected_options, 'db-apply': 'hold' }),
  });
  assert.throws(
    () => validateRecordedRulingProvenance({ provenanceGroups: [alteredOption, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }),
    /identity mismatch for db-apply/,
  );

  const alteredIdentity = Object.freeze({ ...first, response_line_sha256: '0'.repeat(64) });
  assert.throws(
    () => validateRecordedRulingProvenance({ provenanceGroups: [alteredIdentity, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }),
    /identity mismatch for db-apply/,
  );

  const alteredRole = Object.freeze({
    ...first,
    response_role: 'ASSISTANT',
  });
  assert.throws(
    () => validateRecordedRulingProvenance({ provenanceGroups: [alteredRole, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }),
    /exact user response/,
  );
  const alteredExcerpt = Object.freeze({ ...first, response_excerpt: 'paraphrase' });
  assert.throws(() => validateRecordedRulingProvenance({ provenanceGroups: [alteredExcerpt, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }), /identity mismatch/);
  const alteredAuthority = Object.freeze({ ...first, authority: 'READ' });
  assert.throws(() => validateRecordedRulingProvenance({ provenanceGroups: [alteredAuthority, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }), /evidence only/);
  const prompted = PRIMARY_RULING_PROVENANCE_GROUPS.find((provenance) => provenance.assistant_prompt_line !== undefined);
  const alteredPromptRole = Object.freeze({ ...prompted, assistant_prompt_role: 'USER' });
  assert.throws(
    () => validateRecordedRulingProvenance({ provenanceGroups: PRIMARY_RULING_PROVENANCE_GROUPS.map((provenance) => (provenance === prompted ? alteredPromptRole : provenance)) }),
    /cited assistant prompt/,
  );
  const scopeLeak = Object.freeze({
    ...first,
    ruling_ids: Object.freeze([...first.ruling_ids, 'rem-cap']),
    selected_options: Object.freeze({ ...first.selected_options, 'rem-cap': 'ratify' }),
  });
  assert.throws(() => validateRecordedRulingProvenance({ provenanceGroups: [scopeLeak, ...PRIMARY_RULING_PROVENANCE_GROUPS.slice(1)] }), /identity mismatch/);
  assert.throws(() => validateRecordedRulingProvenance({ pending_user_ratification_ruling_ids: [] }), /override is forbidden/);
});

test('follow-on rulings carry corpus counts, clause examples and a promotion horizon', () => {
  const followOn = DECISIONS.filter((decision) => decision.origin === 'follow-on');
  assert.equal(followOn.length, 34);
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
      'consideration-cvr-presence',
      'consideration-election-mechanism',
      'closing-termination-linking',
      'defined-terms-first-comparable',
      'defined-terms-neutral-long-tail',
      'defined-terms-misclassified-reclassification',
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
  assert.equal(followOn.filter((decision) => decision.horizon === 'later').length, 9);
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
    'antitrust-expanded-taxonomy': 'explicit-open-world-deferrals',
    'db-apply': 'hold',
  });
  assert.equal(choices['antitrust-expanded-taxonomy'], 'adopt-expanded-package');
  assert.equal(choices['db-apply'], 'fixture-go');
});

test('later Ben rulings are recorded without claiming missing implementation', () => {
  assert.equal(RECORDED_RULINGS['consideration-cvr-presence'], 'presence-only');
  assert.equal(RECORDED_RULINGS['consideration-election-mechanism'], 'structured-mechanism');
  assert.equal(RECORDED_RULINGS['closing-termination-linking'], 'preserve-distinct-link-xref');
  assert.equal(RECORDED_RULINGS['defined-terms-first-comparable'], 'adopt-five');
  assert.equal(RECORDED_RULINGS['defined-terms-next-slices'], 'adopt-later-slices');
  assert.equal(RECORDED_RULINGS['defined-terms-neutral-long-tail'], 'neutral-exact-comparable-by-term');
  assert.equal(RECORDED_RULINGS['defined-terms-misclassified-reclassification'], 'content-reviewed');
  assert.match(decisionById('consideration-election-mechanism').current, /approved/i);
  assert.match(decisionById('defined-terms-next-slices').current, /approved/i);
});

test('records the approved programme foundations without granting production authority', () => {
  assert.equal(RECORDED_RULINGS['p9-programme-completion-terminal'], 'ratify-bundle-frozen-terminal');
  assert.equal(RECORDED_RULINGS['p9-security-production-access'], 'require-before-production-access');
  assert.equal(RECORDED_RULINGS['identity-initial-import-foundation'], 'adopt-v2-namespace-seeds-and-tx-sequence');
  assert.equal(RECORDED_RULINGS['identity-batch-mapping-signature'], 'one-ben-batch-signature');
  assert.equal(RECORDED_RULINGS['production-policy-package-v2'], 'adopt-policy-direction');
  assert.match(decisionById('identity-initial-import-foundation').current, /No mapping, receipt, bridge or identity was issued/);
  assert.match(decisionById('identity-batch-mapping-signature').recommendation, /40 machine receipts.*40 serialisable CAS proofs.*reviewed bridge.*current-head verification.*full-chain verification/);
  assert.match(decisionById('production-policy-package-v2').current, /Exact policy-manifest digest adoption and successor M1 approval remain pending/);
  assert.match(decisionById('p9-security-production-access').current, /grants no credential, import or activation authority/);
});

test('obsolete antitrust core question is replaced by the approved expanded docket', () => {
  assert.equal(decisionById('antitrust-core-taxonomy'), null);
  const decision = decisionById('antitrust-expanded-taxonomy');
  assert.equal(RECORDED_RULINGS[decision.id], 'adopt-expanded-package');
  assert.match(decision.current, /Ben approved the expanded package/);
  assert.match(decision.current, /ANTI-FOREIGN.*ANTI-FILING/);
  assert.deepEqual(decision.resolved_topics.map((topic) => topic.topic_id), [
    'agreements-name-and-claims',
    'strategy-control-and-consultation',
    'filing-regimes-and-deadlines',
    'rendered-v1-terminal-dispositions',
  ]);
  assert.deepEqual(decision.resolved_topics.at(-1).rendered_v1_surfaces, [
    'ANTI-BURDEN', 'ANTI-CONSULT', 'ANTI-COOPERATE', 'ANTI-EFFORTS',
    'ANTI-FILING', 'ANTI-FOREIGN', 'ANTI-INFO', 'ANTI-INTERIM',
    'ANTI-LITIGATION', 'ANTI-NOACTION', 'ANTI-NOTIFY', 'ANTI-TIMING',
    'UNCLASSIFIED_NULL_SUBTYPE',
  ]);
});

test('M3 route ends at certification and keeps production import outside M3', () => {
  assert.deepEqual(M3_STAGES.map((stage) => stage.number), ['01', '02', '03', '04', '05', '06', '07']);
  assert.match(M3_STAGES.at(-1).exit, /M3_FULL_CORPUS_CERTIFICATION/);
  assert.match(M3_STAGES.at(-1).exit, /Production import remains an M4 step/);
});
