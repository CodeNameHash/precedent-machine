'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function subject() {
  return import(path.join(ROOT, 'scripts/stage-2y-l-target-cohort-audit.mjs'));
}

function sourceCard({ id, deal = 'deal', family = 'FINANCING_COVENANTS', section = '1.1', reason = 'ASSERTION_KIND_UNCORROBORATED', mechanism = 'PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', start = 10, end = 20 }) {
  return {
    id,
    deal,
    family,
    section_reference: section,
    reason_code: reason,
    mechanism_verdict: mechanism,
    run_path: `baseline/${deal}/${family}`,
    raw_quote: `quote-${id}`,
    source_evidence_byte_spans: [{ absolute_start: start, absolute_end: end }],
  };
}

function resolution(rows) {
  return {
    resolved: [],
    review_queue: rows.filter((row) => row.state !== 'OPEN_WORLD').map((row) => ({
      has_resolution: row.state === 'RESOLVED',
      reasons: row.state.startsWith('HELD:') ? [row.state.slice(5)] : [],
      original_claim_occurrence_id: row.id,
      evidence: [{ absolute_start: row.start, absolute_end: row.end }],
    })),
    open_world: rows.filter((row) => row.state === 'OPEN_WORLD').map((row) => ({
      original_claim_occurrence_id: row.id,
      evidence: [{ absolute_start: row.start, absolute_end: row.end }],
    })),
  };
}

function fixture() {
  const financing = sourceCard({ id: 'financing' });
  const accuracy = sourceCard({ id: 'accuracy', family: 'CLOSING_CONDITIONS', reason: 'ACCURACY_STANDARD_OUT_OF_VOCABULARY' });
  const obligor = sourceCard({ id: 'obligor', family: 'CLOSING_CONDITIONS', reason: 'PARTY_UNRESOLVED', mechanism: 'PRODUCER_CONDITION_OBLIGOR_OMITTED', start: 30, end: 40 });
  const proxy = sourceCard({ id: 'proxy', family: 'PROXY_MEETING', reason: 'NO_DAY_COUNT' });
  const noFix = sourceCard({ id: 'condition-residual', deal: 'redhat', family: 'CLOSING_CONDITIONS', reason: 'PARTY_UNRESOLVED', mechanism: 'CORRECT_ABSTENTION_PARTYLESS_BURDENSOME_FRAGMENT', start: 50, end: 60 });
  const diffArtifact = {
    schema_version: 'STAGE_2Y_L_PER_FAMILY_DIFF/V1', artifact_id: 'diff-id', actual_call_count: 5,
    sections: [
      { deal: 'deal', family: 'FINANCING_COVENANTS', section_reference: '1.1', current_directory: 'runs/financing' },
      { deal: 'deal', family: 'CLOSING_CONDITIONS', section_reference: '1.1', current_directory: 'runs/accuracy' },
      { deal: 'deal', family: 'PROXY_MEETING', section_reference: '1.1', current_directory: 'runs/proxy' },
      { deal: 'redhat', family: 'CLOSING_CONDITIONS', section_reference: '1.1', current_directory: 'runs/nofix' },
    ],
  };
  const resolutions = {
    'runs/financing': resolution([{ id: 'financing-current', state: 'RESOLVED', start: 10, end: 20 }]),
    'runs/accuracy': resolution([{ id: 'accuracy-current', state: 'HELD:COVERED_SCOPE_REF_NOT_IN_QUOTE', start: 8, end: 22 }, { id: 'obligor-current', state: 'RESOLVED', start: 30, end: 40 }]),
    'runs/proxy': resolution([{ id: 'proxy-current', state: 'OPEN_WORLD', start: 10, end: 20 }]),
    'runs/nofix': resolution([{ id: 'nofix-current', state: 'OPEN_WORLD', start: 50, end: 60 }]),
  };
  return {
    batchArtifact: { schema_version: 'STAGE_2Y_L_LIVE_BATCH/V1', artifact_id: 'batch-id', actual_call_count: 5 },
    diffArtifact,
    residualA: { occurrences: [accuracy, obligor, noFix] },
    residualB: { occurrences: [financing] },
    proxyCards: [proxy],
    readResolution: (directory) => resolutions[directory],
  };
}

test('the audit uses an exact evidence-span match before recording a containment fallback', async () => {
  const { auditTargetCohort } = await subject();
  const output = auditTargetCohort(fixture());
  const financing = output.cohorts.financing.cards[0];
  const accuracy = output.cohorts.closing_accuracy.cards[0];
  assert.equal(financing.match.method, 'EXACT_EVIDENCE_SPAN');
  assert.equal(financing.state, 'RESOLVED');
  assert.equal(accuracy.match.method, 'CONTAINMENT_FALLBACK');
  assert.equal(accuracy.state, 'HELD:COVERED_SCOPE_REF_NOT_IN_QUOTE');
  assert.deepEqual(output.cohorts.closing_obligor.cards.map((card) => card.state), ['RESOLVED']);
  assert.deepEqual(output.cohorts.proxy_qualitative_day_count.cards.map((card) => card.state), ['OPEN_WORLD']);
  assert.deepEqual(output.redhat_no_fix.cards.map((card) => card.state), ['OPEN_WORLD']);
});

test('missing current output remains NOT_EMITTED and is never folded into review or resolution', async () => {
  const { auditTargetCohort } = await subject();
  const input = fixture();
  input.readResolution = () => resolution([]);
  const output = auditTargetCohort(input, { validateExpectations: false });
  assert.equal(output.cohorts.financing.cards[0].state, 'NOT_EMITTED');
  assert.equal(output.cohorts.financing.counts.not_emitted, 1);
  assert.equal(output.cohorts.financing.counts.resolved, 0);
  assert.equal(output.cohorts.financing.counts.held, 0);
});

test('the committed 2Y-L evidence yields the exact fixed cohort states and two new financing holds', async () => {
  const { buildTargetCohortAudit } = await subject();
  const output = buildTargetCohortAudit({ repoRoot: ROOT });
  assert.deepEqual(output.cohorts.financing.counts, { target_cards: 8, resolved: 2, held: 4, open_world: 0, not_emitted: 2 });
  assert.equal(output.cohorts.financing.new_current_holds.length, 2);
  assert.deepEqual(output.cohorts.closing_accuracy.counts, { target_cards: 26, resolved: 24, held: 1, open_world: 1, not_emitted: 0 });
  assert.deepEqual(output.cohorts.closing_obligor.counts, { target_cards: 7, resolved: 7, held: 0, open_world: 0, not_emitted: 0 });
  assert.deepEqual(output.cohorts.proxy_qualitative_day_count.counts, { target_cards: 3, resolved: 0, held: 0, open_world: 3, not_emitted: 0 });
  assert.equal(output.redhat_no_fix.cards.length, 2);
  assert.ok(output.redhat_no_fix.cards.every((card) => card.state === 'OPEN_WORLD'));
});

test('the evidence write and check seams are deterministic and cannot use a model client', async () => {
  const { buildTargetCohortAudit, writeTargetCohortAudit, checkTargetCohortAudit } = await subject();
  const output = buildTargetCohortAudit({ repoRoot: ROOT });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-l-cohort-audit-'));
  const outputPath = path.join(scratch, 'audit.json');
  try {
    writeTargetCohortAudit({ outputPath, artifact: output });
    assert.equal(checkTargetCohortAudit({ outputPath, artifact: output }), true);
    const tampered = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    tampered.model_calls = 1;
    fs.writeFileSync(outputPath, `${JSON.stringify(tampered)}\n`);
    assert.equal(checkTargetCohortAudit({ outputPath, artifact: output }), false);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-l-target-cohort-audit.mjs'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliClient|resolveSourceRun|resolveCandidates/);
});
