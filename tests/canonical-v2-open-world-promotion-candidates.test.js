const test = require('node:test');
const assert = require('node:assert/strict');
const { collect, isFragment, labelOf, buildCompatibility, nativeProposal, appraisalProposal } = require('../lib/canonical-v2/open-world-promotion-candidates');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function collectAffirmativeCovenantFixture(rows) {
  const byRunId = new Map();
  const receipts = rows.map(({ deal_id, raw_value }, index) => {
    const receipt = {
      deal_id,
      family: 'TEST_FAMILY',
      run_id: `fixture-${deal_id}`,
      resolution_sha256: `resolution-${index}`,
      canonical_text_sha256: `canonical-${index}`,
    };
    byRunId.set(receipt.run_id, { receipt, raw_value, index });
    return receipt;
  });
  return collect({
    cohort: { cohort_id: 'independent-affirmative-covenant-fixture', receipts },
    loadReceipt(receipt) {
      const row = byRunId.get(receipt.run_id);
      return {
        resolution_sha256: row.receipt.resolution_sha256,
        canonical_text_sha256: row.receipt.canonical_text_sha256,
        source: { canonical_text: { text: row.raw_value } },
        runReceipt: { resolved_sections: [{ section_reference: '1.1', start: 0 }] },
        resolution: {
          resolved: [],
          open_world: [{
            section_reference: '1.1',
            reason: 'NATIVE_OPEN_WORLD_PROPOSAL',
            claim_definition_key: 'OPEN_WORLD_PROPOSITION',
            raw_value: row.raw_value,
            canonical_value: null,
            attributes: { why_unmapped: 'AFFIRMATIVE_COVENANT: independent literal fixture' },
            evidence: [{
              evidence_role: 'OPERATIVE_TEXT',
              excerpt_id: `fixture-excerpt-${row.index}`,
              absolute_start: 0,
              absolute_end: Buffer.byteLength(row.raw_value, 'utf8'),
            }],
          }],
        },
      };
    },
  });
}

test('fragment policy uses UTF-8 byte length and subordinate starts', () => {
  assert.equal(isFragment({ raw_value: 'é'.repeat(30) }), false);
  assert.equal(isFragment({ raw_value: 'é'.repeat(29) }), true);
  assert.equal(isFragment({ raw_value: 'other than a complete sentence that is deliberately long enough to exceed the byte boundary for this test.' }), true);
  assert.equal(isFragment({ raw_value: 'Nothing in this Agreement shall constitute a complete clause that is longer than the byte threshold.' }), false);
  assert.equal(isFragment({ raw_value: 'This Agreement (including the schedules) is a complete clause that is longer than the byte threshold.' }), false);
});
test('only a leading controlled label is recognised', () => {
  assert.equal(labelOf({ attributes: { why_unmapped: 'APPRAISAL_NOTICE: detail' } }), 'APPRAISAL_NOTICE');
  assert.equal(labelOf({ attributes: { why_unmapped: 'note: APPRAISAL_NOTICE' } }), null);
});

test('compatibility analysis does not invent a target tuple for a recurring native label', () => {
  const quote = 'The parties shall complete the recurring native proposal fixture in full.';
  const item = {
    raw_value: quote,
    evidence: [{ excerpt_id: 'native-open-world-fixture' }],
  };
  const compatibility = buildCompatibility({
    activeBundle: compileFixtureContractV42(),
    proposal: nativeProposal('RECURRING_NATIVE_FIXTURE', 'TEST_FAMILY'),
    rows: [{ item, selector_resolution: { open_world: [{ reason: 'NATIVE_OPEN_WORLD_PROPOSAL', claim_definition_key: 'OPEN_WORLD_PROPOSITION', raw_value: quote, evidence: [{ excerpt_id: 'native-open-world-fixture' }] }] } }],
  });
  assert.equal(compatibility.analysis_state, undefined);
  assert.equal(compatibility.collision, 'INSUFFICIENT_EVIDENCE');
  assert.ok(compatibility.reasons.includes('PROPOSED_TARGET_TUPLE_UNSPECIFIED'));
  assert.deepEqual(compatibility.selector_behaviour.current_replay_observations, [{ state: 'OPEN_WORLD', reason: 'NATIVE_OPEN_WORLD_PROPOSAL', claim_definition_key: 'OPEN_WORLD_PROPOSITION' }]);
  assert.equal(compatibility.activation_allowed, false);
});

test('compatibility analysis proves the appraisal tuple already exists without activating it', () => {
  const quote = 'The Company may not settle any appraisal claim without prior written consent.';
  const item = {
    raw_value: quote,
    evidence: [{ excerpt_id: 'appraisal-open-world-fixture' }],
  };
  const compatibility = buildCompatibility({
    activeBundle: compileFixtureContractV42(),
    proposal: appraisalProposal(),
    rows: [{ item, selector_resolution: { open_world: [{ reason: 'APPRAISAL_ASSERTION_OPEN_WORLD', claim_definition_key: 'NATIVE_APPRAISAL_CANDIDATE', raw_value: quote, evidence: [{ excerpt_id: 'appraisal-open-world-fixture' }] }] } }],
  });
  assert.equal(compatibility.collision, 'EXACT_ACTIVE_TUPLE');
  assert.deepEqual(compatibility.contract_schema.exact_concept_matches, ['APPR-SETTLE']);
  assert.equal(compatibility.contract_schema.exact_claim_definition_matches[0].claim_definition_key, 'APPRAISAL_SETTLEMENT_CONSENT');
  assert.equal(compatibility.contract_schema.value_shape, 'COMPATIBLE');
  assert.equal(compatibility.authoritative_tuple_association.state, 'VERIFIED');
  assert.equal(compatibility.authoritative_tuple_association.authority_export, 'APPRAISAL_CLAIMS');
  assert.equal(compatibility.selector_behaviour.exact_tuple_resolved_in_replay, false);
  assert.equal(compatibility.activation_allowed, false);
});

test('separate active concept and definition membership does not prove a tuple association', () => {
  const proposal = {
    proposal_kind: 'TYPED_OPEN_WORLD_ASSERTION',
    owner_family: 'APPRAISAL_DISSENTERS_RIGHTS',
    vocabulary_name: 'APPRAISAL_WITHDRAWAL_RECONVERSION',
    concept_key: 'APPR-SETTLE',
    claim_definition_key: 'APPRAISAL_WITHDRAWAL_RECONVERSION',
    canonical_value: true,
    promotion_mechanism: null,
    source_claim_definition_key: 'NATIVE_APPRAISAL_CANDIDATE',
  };
  const compatibility = buildCompatibility({
    activeBundle: compileFixtureContractV42(),
    proposal,
    rows: [],
  });
  assert.deepEqual(compatibility.contract_schema.exact_concept_matches, ['APPR-SETTLE']);
  assert.equal(compatibility.contract_schema.exact_claim_definition_matches[0].claim_definition_key, 'APPRAISAL_WITHDRAWAL_RECONVERSION');
  assert.equal(compatibility.authoritative_tuple_association.state, 'NOT_ASSOCIATED');
  assert.equal(compatibility.collision, 'NO_EXACT_ACTIVE_TUPLE');
  assert.ok(compatibility.reasons.includes('AUTHORITATIVE_TUPLE_ASSOCIATION_MISSING'));
});

test('public collector requires three eligible deals, not three raw deals, for a promotion candidate', () => {
  const belowThreshold = collectAffirmativeCovenantFixture([
    { deal_id: 'deal-a', raw_value: 'short fragment a' },
    { deal_id: 'deal-b', raw_value: 'short fragment b' },
    { deal_id: 'deal-c', raw_value: 'short fragment c' },
    { deal_id: 'deal-d', raw_value: 'short fragment d' },
    { deal_id: 'deal-e', raw_value: 'short fragment e' },
    { deal_id: 'deal-f', raw_value: 'This is a complete affirmative covenant fixture with more than sixty UTF-8 bytes.' },
  ]);
  assert.equal(belowThreshold.counts.raw_recurrence_labels_at_threshold, 1);
  assert.equal(belowThreshold.counts.eligible_concepts, 0);
  assert.equal(belowThreshold.candidates.some((candidate) => candidate.display_name === 'AFFIRMATIVE COVENANT'), false);

  const atThreshold = collectAffirmativeCovenantFixture([
    { deal_id: 'deal-a', raw_value: 'This complete affirmative covenant fixture is eligible and independently evidenced in deal A.' },
    { deal_id: 'deal-b', raw_value: 'This complete affirmative covenant fixture is eligible and independently evidenced in deal B.' },
    { deal_id: 'deal-c', raw_value: 'This complete affirmative covenant fixture is eligible and independently evidenced in deal C.' },
  ]);
  assert.equal(atThreshold.counts.eligible_concepts, 1);
  assert.equal(atThreshold.candidates.length, 1);
  assert.equal(atThreshold.candidates[0].display_name, 'AFFIRMATIVE COVENANT');
  assert.equal(atThreshold.candidates[0].recurrence.eligible_deal_count, 3);
});

test('full pinned corpus derives the documented Stage 2Y-J rule census', () => {
  const root = path.resolve(__dirname, '..');
  childProcess.execFileSync(process.execPath, ['scripts/audit/stage-2y-open-world-promotion-candidates.mjs', '--check'], { cwd: root, env: { ...process.env, CI: 'true' }, stdio: 'pipe' });
  const candidateRoot = path.join(root, 'evidence/canonical-v2/open-world-promotion/candidates');
  const directory = fs.readdirSync(candidateRoot).find((name) => fs.existsSync(path.join(candidateRoot, name, 'candidate-set.v1.json')));
  const snapshot = JSON.parse(fs.readFileSync(path.join(candidateRoot, directory, 'candidate-set.v1.json'), 'utf8'));
  assert.deepEqual(snapshot.counts, {
    native_open_world_occurrences: 1147,
    raw_recurrence_labels_at_threshold: 32,
    eligible_concepts: 14,
    eligible_occurrences: 130,
    resolved_claim_evidence_span_duplicates: 7,
    resolved_claim_citation_context_duplicates: 71,
    resolved_claim_duplicates: 78,
    later_same_run_identical_duplicates: 29,
    duplicate_exclusions: 107,
    fragment_exclusions: 756,
  });
  const derived = snapshot.exclusions.reduce((counts, row) => ({ ...counts, [row.reason]: (counts[row.reason] || 0) + 1 }), {});
  assert.equal(derived.RESOLVED_CLAIM_EVIDENCE_SPAN_DUPLICATE, 7);
  assert.equal(derived.RESOLVED_CLAIM_CITATION_CONTEXT_DUPLICATE, 71);
  assert.equal(derived.LATER_SAME_RUN_IDENTICAL_DUPLICATE, 29);
  assert.equal(derived.FRAGMENT, 756);
  assert.equal(snapshot.candidates.some((candidate) => candidate.display_name === 'AFFIRMATIVE COVENANT'), false);
});
