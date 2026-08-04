'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  FINAL_LEGAL_FINDING_PATHS,
  FINAL_REVIEW_PACKET_PATH,
  FINAL_STRICT_INDEPENDENT_REVIEW_INPUT_PATH,
  FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
  getFrozenFourDealLocalDemoResult,
  m3Rows,
} = require('../lib/four-deal-local-demo-preview');

const ARTIFACT_ROOT = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';

test('four-deal preview binds immutable M3 rows and the sealed Metsera Process result into one read-only contract', () => {
  const result = getFrozenFourDealLocalDemoResult();
  assert.equal(result.schema_version, FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA);
  assert.equal(result.mode, 'FROZEN_READ_ONLY_PREVIEW');
  assert.equal(result.write_authority, 'NONE');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.deals.length, 4);
  assert.equal(result.m3_artifact.relative_path, FINAL_REVIEW_PACKET_PATH);
  assert.equal(FINAL_REVIEW_PACKET_PATH, 'final-review-v6/sealed-final-pilot-review-packet.json');
  assert.equal(result.m3_artifact.final_review_packet_id, '39875619332f16886a7b884b79e5388d430321c3e9589760df450cfc79822f86');
  assert.equal(FINAL_STRICT_INDEPENDENT_REVIEW_INPUT_PATH,
    'final-review-v6/sealed-strict-independent-legal-review-input-source-bound-v6.json');
  assert.equal(result.m3_artifact.strict_independent_review_input.relative_path, FINAL_STRICT_INDEPENDENT_REVIEW_INPUT_PATH);
  assert.equal(result.m3_artifact.strict_independent_review_input.strict_independent_review_input_id,
    'a124735d163bf45b5e16cfa0ec7ff5cb680fc777b70c7c29c4ded9dcfcb9bdb7');
  assert.deepEqual(FINAL_LEGAL_FINDING_PATHS, [
    'final-review-v6/sealed-corrected-independent-legal-re-review-findings-v2.json',
  ]);
  assert.deepEqual(
    result.m3_artifact.final_legal_findings.map((finding) => finding.path),
    FINAL_LEGAL_FINDING_PATHS.map((relativePath) => path.join(ARTIFACT_ROOT, relativePath)),
  );

  const topBuild = result.deals.find((deal) => deal.deal_name === 'TopBuild');
  const skechers = result.deals.find((deal) => deal.deal_name === 'Skechers');
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  const metsera = result.deals.find((deal) => deal.deal_name === 'Metsera');
  assert.equal([topBuild, skechers, modiv].flatMap((deal) => deal.work_items).length, 12);
  for (const deal of [topBuild, skechers, modiv]) {
    assert.equal(deal.result_domain, 'M3_CANONICAL_REVIEW');
    assert.ok(deal.rows.some((row) => row.result_type === 'GOVERNED_VALUE'
      && row.source_quote && row.source_citation));
    assert.equal(deal.result_state, 'SEALED_FINAL_LEGAL_FINDINGS_BOUND');
    assert.ok(deal.rows.every((row) => row.legal_review_state === 'PASS'
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

test('four-deal preview retains an explicit no-findings path', () => {
  const result = getFrozenFourDealLocalDemoResult({
    artifact_root: ARTIFACT_ROOT,
    final_legal_finding_paths: [],
  });
  const topBuild = result.deals.find((deal) => deal.deal_name === 'TopBuild');
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  assert.equal(topBuild.result_state, 'PENDING_INDEPENDENT_REVIEW');
  assert.ok(topBuild.rows.every((row) => row.legal_review_state === 'PENDING_INDEPENDENT_REVIEW'));
  assert.ok(modiv.rows.some((row) => row.work_item_id === 'modiv-consideration-2-1'
    && row.legal_review_state === 'PENDING_INDEPENDENT_REVIEW'));
  assert.ok(modiv.rows.some((row) => row.work_item_id === 'modiv-antitrust-consents-5-5'
    && row.legal_review_state === 'PENDING_INDEPENDENT_REVIEW'));
});

test('four-deal preview rejects sealed V5 findings against the sealed V6 packet and strict input', () => {
  assert.throws(
    () => getFrozenFourDealLocalDemoResult({
      artifact_root: ARTIFACT_ROOT,
      final_legal_finding_paths: [path.join(
        ARTIFACT_ROOT,
        'final-review-v5/sealed-corrected-independent-legal-re-review-findings.json',
      )],
    }),
    (error) => error?.code === 'FINAL_FINDINGS_BINDING_MISMATCH',
  );
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
    final_legal_finding_paths: [],
  });
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  const formulas = modiv.rows.filter((row) => row.result_type === 'STRUCTURED_FORMULA');
  assert.equal(formulas.filter((row) => row.governed_field === 'CONDITIONAL_TERMINATION_FEE_VALUE').length, 6);
  assert.equal(formulas.filter((row) => row.governed_field === 'STRUCTURED_PER_SHARE_CASH_VALUE').length, 1);
  assert.ok(formulas.some((row) => /accrued and unpaid dividends/.test(row.source_quote)));
  assert.ok(formulas.some((row) => /not flattened/.test(row.warning)));
});

test('four-deal preview shows the sealed work-item review reason code as the legal basis', () => {
  const result = getFrozenFourDealLocalDemoResult();
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  assert.ok(modiv.rows.every((row) => row.legal_review_state === 'PASS'));
  assert.ok(modiv.rows.every((row) => row.legal_review_reason
    === 'ALL_GOVERNED_CLAIMS_ROUTES_AND_FORMULAS_VERIFIED'));
});
