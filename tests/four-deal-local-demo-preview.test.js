'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
  getFrozenFourDealLocalDemoResult,
  m3Rows,
} = require('../lib/four-deal-local-demo-preview');

const ARTIFACT_ROOT = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const FINAL_LEGAL_FINDINGS = [
  path.join(ARTIFACT_ROOT, 'final-output', 'independent-first-six-review-findings.json'),
  path.join(ARTIFACT_ROOT, 'final-output', 'independent-last-six-review-findings.json'),
];

test('four-deal preview binds immutable M3 rows and the sealed Metsera Process result into one read-only contract', () => {
  const result = getFrozenFourDealLocalDemoResult();
  assert.equal(result.schema_version, FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA);
  assert.equal(result.mode, 'FROZEN_READ_ONLY_PREVIEW');
  assert.equal(result.write_authority, 'NONE');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.deals.length, 4);
  assert.equal(result.m3_artifact.relative_path, 'final-review/sealed-final-pilot-review-packet.json');

  const topBuild = result.deals.find((deal) => deal.deal_name === 'TopBuild');
  const skechers = result.deals.find((deal) => deal.deal_name === 'Skechers');
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  const metsera = result.deals.find((deal) => deal.deal_name === 'Metsera');
  for (const deal of [topBuild, skechers, modiv]) {
    assert.equal(deal.result_domain, 'M3_CANONICAL_REVIEW');
    assert.ok(deal.rows.some((row) => row.result_type === 'GOVERNED_VALUE'
      && row.source_quote && row.source_citation));
    assert.ok(deal.rows.every((row) => row.legal_review_state === 'PENDING_INDEPENDENT_REVIEW'
      && row.resolver_state && row.source_citation));
  }
  assert.ok(topBuild.rows.some((row) => row.result_type === 'OPEN_WORLD_WARNING'
    && row.warning));
  assert.equal(metsera.result_domain, 'PROCESS_PRODUCT');
  assert.equal(metsera.rows[0].legal_review_state, null);
  assert.equal(metsera.rows[0].product_result_state, 'INACTIVE_CANDIDATE');
  assert.equal(metsera.rows[0].governed_value, 'EXCLUSIVITY_GRANTED');
  assert.match(metsera.rows[0].source_citation, /Metsera DEFM14A/);
  assert.equal(metsera.product_component.slot_state, 'VALID');
});

test('four-deal preview binds PASS or FAIL only when sealed final legal findings are supplied', () => {
  const result = getFrozenFourDealLocalDemoResult({
    artifact_root: ARTIFACT_ROOT,
    final_legal_finding_paths: FINAL_LEGAL_FINDINGS,
  });
  const topBuild = result.deals.find((deal) => deal.deal_name === 'TopBuild');
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  assert.equal(topBuild.result_state, 'SEALED_FINAL_LEGAL_FINDINGS_BOUND');
  assert.ok(topBuild.rows.every((row) => row.legal_review_state === 'FAIL'));
  assert.ok(modiv.rows.some((row) => row.work_item_id === 'modiv-consideration-2-1'
    && row.legal_review_state === 'PASS'));
  assert.ok(modiv.rows.some((row) => row.work_item_id === 'modiv-antitrust-consents-5-5'
    && row.legal_review_state === 'FAIL'));
});

test('four-deal preview reads current-resolver replays instead of their retained prior results', () => {
  const workItems = [
    ['REPLAY_ONLY_CURRENT_RESOLVER_REPLAY', 'replay-only'],
    ['PASSED_ITERATION_2_CURRENT_RESOLVER_REPLAY', 'passed-iteration-2'],
  ].map(([sourceKind, suffix]) => ({
    work_item_id: `work-${suffix}`,
    source_kind: sourceKind,
    repaired_replay: {
      work_item_id: `work-${suffix}`,
      resolution: {
        resolved: [{
          section_reference: '6.3',
          source_citation: '6.3(a)(i)(A)',
          resolved_claim_definition_key: 'TERMINATION_RIGHT_PRESENT',
          claim: { claim_revision_id: `claim-${suffix}`, canonical_value: true, raw_value: 'current source quote' },
          triage: { reasons: [] },
        }],
        review_queue: [],
        open_world: [],
      },
    },
    replay_result: { work_item_id: `work-${suffix}`, resolution: { resolved: [] } },
    iteration_2_work_result: { work_item_id: `work-${suffix}`, resolution: { resolved: [] } },
  }));
  const rows = m3Rows(workItems, new Map());
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.source_citation === '6.3(a)(i)(A)'
    && row.source_quote === 'current source quote'));
});

test('four-deal preview keeps governed scope separate from a missing published citation', () => {
  const rows = m3Rows([{
    work_item_id: 'work-missing-citation',
    source_kind: 'REPAIRED_REPLAY',
    repaired_replay: {
      work_item_id: 'work-missing-citation',
      resolution: {
        resolved: [{
          section_reference: '4.3',
          resolved_claim_definition_key: 'NO_SHOP_DURATION',
          claim: { claim_revision_id: 'claim-missing-citation', canonical_value: '45', raw_value: '45 days' },
        }],
        review_queue: [],
        open_world: [],
      },
    },
  }], new Map());
  assert.equal(rows[0].source_citation, 'Published citation pending; governed scope 4.3');
});

test('four-deal preview exposes structured fee and consideration formulas without flattening them', () => {
  const result = getFrozenFourDealLocalDemoResult({
    artifact_root: ARTIFACT_ROOT,
    final_review_packet_path: 'final-review-v4/sealed-final-pilot-review-packet.json',
  });
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  const formulas = modiv.rows.filter((row) => row.result_type === 'STRUCTURED_FORMULA');
  assert.equal(formulas.filter((row) => row.governed_field === 'CONDITIONAL_TERMINATION_FEE_VALUE').length, 6);
  assert.equal(formulas.filter((row) => row.governed_field === 'STRUCTURED_PER_SHARE_CASH_VALUE').length, 1);
  assert.ok(formulas.some((row) => /accrued and unpaid dividends/.test(row.source_quote)));
  assert.ok(formulas.some((row) => /not flattened/.test(row.warning)));
});

test('four-deal preview shows the sealed work-item review note as the legal basis', () => {
  const result = getFrozenFourDealLocalDemoResult({
    artifact_root: ARTIFACT_ROOT,
    final_review_packet_path: 'final-review-v5/sealed-final-pilot-review-packet.json',
    final_legal_finding_paths: [path.join(ARTIFACT_ROOT, 'final-review-v5', 'sealed-corrected-independent-legal-re-review-findings.json')],
  });
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  assert.ok(modiv.rows.every((row) => row.legal_review_state === 'PASS'));
  assert.ok(modiv.rows.some((row) => /structured per-share cash value/.test(row.legal_review_reason)));
});
