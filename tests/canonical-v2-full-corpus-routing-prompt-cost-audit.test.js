'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  AUDIT_STATUS,
  ACCEPTED_DETERMINISTIC_PROVENANCE,
  EXPECTED_RECEIPT_COHORT_COUNT,
  UNRESOLVED_DISPOSITION,
  buildAuditFromCaptureRecords,
  buildFullCorpusRoutingPromptCostAudit,
  buildExplicitPriceTimePolicy,
  evaluateExplicitPriceTimePolicy,
  validateFullCorpusRoutingPromptCostAudit,
} = require('../lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit');
const {
  buildFullCorpusRoutingAuditFixture,
  writeFullCorpusRoutingAuditFixtureRoot,
} = require('./helpers/full-corpus-routing-audit-fixture');

const fixture = buildFullCorpusRoutingAuditFixture;

test('keeps each captured occurrence and records only positive deterministic routing signals', () => {
  const audit = buildAuditFromCaptureRecords(fixture());
  assert.equal(audit.status, AUDIT_STATUS);
  assert.equal(audit.totals.source_count, EXPECTED_RECEIPT_COHORT_COUNT);
  assert.equal(audit.source_family_matrix.length, EXPECTED_RECEIPT_COHORT_COUNT * audit.registered_families.length);
  assert.equal(audit.sources.filter((row) => row.deal_id === 'topbuild').length, 2);
  assert.ok(audit.work_items.every((item) => ACCEPTED_DETERMINISTIC_PROVENANCE.includes(item.classifier_provenance)));
  assert.ok(audit.source_family_matrix.some((cell) => cell.disposition === UNRESOLVED_DISPOSITION));
  assert.equal(JSON.stringify(audit).includes('NOT_PRESENT'), false);
  assert.equal(validateFullCorpusRoutingPromptCostAudit(audit), true);
  const stale = { ...audit, implementation_bindings: { ...audit.implementation_bindings, implementation_digest: '0'.repeat(64) } };
  stale.audit_id = contentId('M3_FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT/V1', (() => { const copy = { ...stale }; delete copy.audit_id; return copy; })());
  assert.throws(() => validateFullCorpusRoutingPromptCostAudit(stale), (error) => error.code === 'AUDIT_INVALID');
  const countTamper = { ...audit, totals: { ...audit.totals, positive_work_item_count: 1 } };
  countTamper.audit_id = contentId('M3_FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT/V1', (() => { const copy = { ...countTamper }; delete copy.audit_id; return copy; })());
  const artifactRoot = writeFullCorpusRoutingAuditFixtureRoot();
  try {
    assert.throws(
      () => validateFullCorpusRoutingPromptCostAudit(countTamper, { artifact_root: artifactRoot }),
      (error) => error.code === 'AUDIT_REBUILD_MISMATCH',
    );
  } finally {
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test('emits one work item per justified section-family pair and keeps TopBuild occurrences distinct', () => {
  const audit = buildAuditFromCaptureRecords(fixture());
  const occurrenceIds = [
    'METADATA/7dc3a05f-b170-4d59-a255-b7103cca16e1',
    'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE',
  ];
  const expectedFamilies = ['KEY_DEFINED_TERMS', 'MAE_DEFINITION', 'SPECIFIC_PERFORMANCE_REMEDIES'];
  const itemIdsByOccurrence = [];
  for (const occurrenceId of occurrenceIds) {
    const items = audit.work_items.filter((item) => item.occurrence_id === occurrenceId);
    assert.deepEqual(items.map((item) => item.family_id).sort(), expectedFamilies);
    assert.equal(new Set(items.map((item) => `${item.occurrence_id}/${item.section_id}/${item.family_id}`)).size, items.length);
    itemIdsByOccurrence.push(new Set(items.map((item) => item.work_item_id)));
  }
  assert.equal([...itemIdsByOccurrence[0]].some((id) => itemIdsByOccurrence[1].has(id)), false);
});

test('fails closed if any one of the 41 receipt occurrences is dropped', () => {
  const input = fixture();
  input.capture_records.pop();
  assert.throws(
    () => buildAuditFromCaptureRecords(input),
    (error) => error.code === 'RECEIPT_COHORT_MISMATCH',
  );
});

test('the captured 41-receipt cohort binds both TopBuild occurrences and has no execution authority', () => {
  const artifactRoot = writeFullCorpusRoutingAuditFixtureRoot();
  try {
    const audit = buildFullCorpusRoutingPromptCostAudit({ artifact_root: artifactRoot });
    assert.equal(audit.receipt_cohort.receipt_count, 41);
    assert.deepEqual(
      audit.sources.filter((row) => row.occurrence_id.includes('TOPBUILD') || row.occurrence_id.includes('7dc3a05f')).map((row) => row.occurrence_id),
      ['METADATA/7dc3a05f-b170-4d59-a255-b7103cca16e1', 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE'],
    );
    assert.ok(Object.values(audit.authority).every((value) => value === 'NONE'));
    assert.equal(audit.status, 'AUDIT_ONLY_NOT_EXECUTION_MANIFEST');
  } finally {
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test('does not import or call a provider, or execute a manifest', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js'), 'utf8');
  for (const forbidden of ['createCodex', 'produceCandidate', 'loadAdmittedSource', 'captureDiscoveryRecords', 'fetch(']) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not appear in the audit module`);
  }
});

test('evaluates price and lane time only from explicit caller-supplied rates without changing audit authority', () => {
  const audit = buildAuditFromCaptureRecords(fixture());
  const policy = buildExplicitPriceTimePolicy({
    policy_id: 'TEST_EXPLICIT_PRICE_AND_TIME',
    currency: 'USD',
    prompt_price_per_byte: 0.25,
    prompt_bytes_per_second_per_lane: 100,
    lane_count: 2,
  });
  const evaluation = evaluateExplicitPriceTimePolicy({ audit, policy });
  assert.equal(evaluation.status, AUDIT_STATUS);
  assert.equal(evaluation.prompt_api_equivalent.computed_cost, audit.totals.prompt_bytes * 0.25);
  assert.equal(evaluation.lane_time.computed_service_seconds, audit.totals.prompt_bytes / 200);
  assert.ok(Object.values(evaluation.authority).every((value) => value === 'NONE'));
  assert.throws(
    () => evaluateExplicitPriceTimePolicy({ audit, policy: { ...policy, prompt_price_per_byte: 1 } }),
    (error) => error.code === 'EXPLICIT_PRICE_TIME_POLICY_DIGEST_INVALID',
  );
});
