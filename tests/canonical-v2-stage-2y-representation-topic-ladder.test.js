'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  REPRESENTATION_TOPIC_REGISTRY_BINDING_V1,
  compileFixtureContractV42,
} = require('../lib/canonical-v2/contract-bundle');
const {
  REPRESENTATION_TOPIC_LADDER_MODES,
  REPRESENTATION_TOPIC_LADDER_RUNGS,
  classifyRepresentationTopicAtRung,
} = require('../lib/canonical-v2/native-producer/representation-topic-ladder');
const {
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  projectRepresentationClaims,
} = require('../lib/canonical-v2/representations-product-projection');

const ROOT = path.resolve(__dirname, '..');
const RUN = 'concho-representations-r1a-20260809-2xk-final';

function exactInput(rawValue, subject = null) {
  return {
    family: 'REPRESENTATIONS',
    generic_claim_key: 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE',
    raw_value: rawValue,
    subject,
    evidence: {
      source_text: rawValue,
      spans: [{ absolute_start: 0, absolute_end: Buffer.byteLength(rawValue, 'utf8') }],
    },
  };
}

function finalRun(name = RUN) {
  const directory = path.join(ROOT, 'evidence', 'canonical-v2', name);
  return {
    run_receipt: JSON.parse(fs.readFileSync(path.join(directory, 'run-receipt.json'), 'utf8')),
    admitted_source_context: JSON.parse(fs.readFileSync(path.join(directory, 'adapter-result.json'), 'utf8')).admitted_source_contexts[0],
    contract_vocabulary: compileFixtureContractV42(),
  };
}

function withoutTopicReport(result) {
  const { representation_topic_ladder: ignored, ...rest } = result;
  return rest;
}

test('topic ladder is cumulative and rung 0 never invokes the classifier', () => {
  const exact = exactInput('The Company is duly organized and validly existing.', 'Organisation and standing');
  const highConfidence = exactInput('Each employee plan is maintained for every employee.', 'miscellaneous');
  const evidenceOnly = exactInput('The Company has liabilities.', 'miscellaneous');

  const rung0 = classifyRepresentationTopicAtRung(exact, REPRESENTATION_TOPIC_LADDER_RUNGS.OFF);
  assert.deepEqual(rung0, {
    topic_rung: 0,
    classifier_invoked: false,
    state: 'UNCLASSIFIED',
    canonical_value: null,
    reason: 'REPRESENTATION_TOPIC_CLASSIFIER_OFF',
    registry_version: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version,
    registry_digest: REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest,
    model_calls: 0,
  });

  assert.equal(classifyRepresentationTopicAtRung(exact, 1).state, 'CLASSIFIED');
  assert.equal(classifyRepresentationTopicAtRung(highConfidence, 1).reason, 'REPRESENTATION_TOPIC_BELOW_RUNG_THRESHOLD');
  assert.equal(classifyRepresentationTopicAtRung(highConfidence, 2).state, 'CLASSIFIED');
  assert.equal(classifyRepresentationTopicAtRung(evidenceOnly, 2).reason, 'REPRESENTATION_TOPIC_BELOW_RUNG_THRESHOLD');
  assert.equal(classifyRepresentationTopicAtRung(evidenceOnly, 3).state, 'CLASSIFIED');
});

test('resolver topic ladder is default-off, report-only, V43-bound, and never changes resolution', () => {
  const input = finalRun();
  const omitted = resolveCandidates(input);
  const explicitOff = resolveCandidates({
    ...input,
    representation_topic_ladder_mode: REPRESENTATION_TOPIC_LADDER_MODES.OFF,
    representation_topic_rung: REPRESENTATION_TOPIC_LADDER_RUNGS.OFF,
  });
  assert.equal(canonicalJson(explicitOff), canonicalJson(omitted));
  assert.equal(Object.hasOwn(omitted, 'representation_topic_ladder'), false);

  for (const rung of [0, 1, 2, 3]) {
    const report = resolveCandidates({
      ...input,
      representation_topic_ladder_mode: REPRESENTATION_TOPIC_LADDER_MODES.REPORT_ONLY,
      representation_topic_rung: rung,
    });
    assert.equal(canonicalJson(withoutTopicReport(report)), canonicalJson(omitted));
    assert.equal(report.representation_topic_ladder.topic_rung, rung);
    assert.deepEqual(report.representation_topic_ladder.registry_binding, REPRESENTATION_TOPIC_REGISTRY_BINDING_V1);
    assert.deepEqual(report.representation_topic_ladder.activation, {
      eligible: false,
      blocker: 'ORDINARY_REVIEW_PENDING',
    });
    assert.ok(report.representation_topic_ladder.records.length > 0);
    assert.equal(report.representation_topic_ladder.records.every((row) => row.classifier_invoked === (rung !== 0)), true);
    assert.equal(report.representation_topic_ladder.records.every((row) => row.proposed_claim == null || (
      row.proposed_claim.claim_definition_key === 'REPRESENTATION_TOPIC_PRESENT'
      && ['REP-T-TOPIC', 'REP-B-TOPIC'].includes(row.proposed_claim.concept_key)
      && REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version === row.proposed_claim.attributes.topic_registry_version
      && REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest === row.proposed_claim.attributes.topic_registry_digest
      && ['TARGET', 'PARENT'].includes(row.proposed_claim.attributes.representation_side)
      && row.proposed_claim.attributes.party_making === row.proposed_claim.party.value
    )), true);
  }

  const report = resolveCandidates({
    ...input,
    representation_topic_ladder_mode: REPRESENTATION_TOPIC_LADDER_MODES.REPORT_ONLY,
    representation_topic_rung: REPRESENTATION_TOPIC_LADDER_RUNGS.EVIDENCE_CLASSIFICATION,
  });
  const record = report.representation_topic_ladder.records.find((row) => row.proposed_claim);
  assert.ok(record);
  const proposal = record.proposed_claim;
  const provisionId = 'report-only-topic-provision';
  const projection = projectRepresentationClaims({
    resolved_entries: [{
      resolved_claim_definition_key: proposal.claim_definition_key,
      concept_key: proposal.concept_key,
      section_reference: record.section_reference,
      provision_instance: {
        schema_version: 'PROVISION_INSTANCE/V1',
        provision_instance_id: provisionId,
        party: proposal.party,
      },
      claim: {
        schema_version: 'CLAIM/V1',
        claim_revision_id: 'report-only-topic-claim',
        subject_occurrence_id: provisionId,
        claim_definition_key: proposal.claim_definition_key,
        state: proposal.state,
        canonical_value: proposal.canonical_value,
        raw_value: proposal.raw_value,
        evidence: proposal.evidence,
        attributes: proposal.attributes,
      },
    }],
  });
  assert.equal(projection.records.length, 1);
  assert.equal(projection.records[0].market.canonical_unit, 'REPRESENTATION_TOPIC_CODE');

  assert.throws(() => resolveCandidates({ ...input, representation_topic_rung: 4 }), /integer from 0 through 3/);
  assert.throws(() => resolveCandidates({ ...input, representation_topic_ladder_mode: 'ENFORCE' }), /OFF or REPORT_ONLY/);
  assert.throws(() => resolveCandidates({
    ...input,
    representation_topic_ladder_mode: REPRESENTATION_TOPIC_LADDER_MODES.OFF,
    representation_topic_rung: 1,
  }), /rung 0 when representation_topic_ladder_mode is OFF/);
});

test('623-row replay is deterministic, cumulative, V42-only, and blocked on human review', () => {
  const script = path.join(ROOT, 'scripts', 'stage-2y-h-representation-topic-replay.mjs');
  const check = spawnSync(process.execPath, [script, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'canonical-v2', 'stage-2y-h-representation-topic-replay.json'), 'utf8'));
  assert.equal(evidence.schema_version, 'STAGE_2Y_H_REPRESENTATION_TOPIC_REPLAY_LEDGER/V2');
  assert.deepEqual(evidence.rungs.map((rung) => [rung.classified_rows, rung.unclassified_rows]), [
    [0, 623],
    [152, 471],
    [231, 392],
    [324, 299],
  ]);
  assert.deepEqual(evidence.rung_diffs.map((diff) => [diff.newly_classified_count, diff.regressed_count]), [
    [152, 0],
    [79, 0],
    [93, 0],
  ]);
  assert.equal(evidence.representation_rows.length, 623);
  assert.equal(evidence.representation_rows.every((row) => row.rung_outcomes.length === 4), true);
  assert.deepEqual(evidence.activation, { eligible: false, blocker: 'ORDINARY_REVIEW_PENDING', human_ledger_decisions: 0 });
  assert.equal(evidence.resolver_contract.compiler, 'compileFixtureContractV42');
  assert.equal(evidence.resolver_contract.topic_claim_available, false);
  assert.equal(evidence.publication.serving_activated, false);
});
