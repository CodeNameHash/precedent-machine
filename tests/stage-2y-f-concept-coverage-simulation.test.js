'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function subject() {
  return import(path.join(ROOT, 'scripts/stage-2y-f-concept-coverage-simulation.mjs'));
}

function root(id, classification, decision = {}) {
  return {
    root_id: id,
    evidence_fingerprint: `sha256:evidence-${id}`,
    run_name: `run-${id}`,
    deal: `deal-${id}`,
    family: 'INTERIM_OPERATING',
    section_reference: '6.1',
    concept_key: `CONCEPT-${id}`,
    classification,
    classification_source: classification === 'AMBIGUOUS_NEEDS_REVIEW' ? 'DEFAULT_FAIL_CLOSED' : 'TERRA_ADJUDICATION',
    decision_error: classification === 'AMBIGUOUS_NEEDS_REVIEW' ? ['DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH'] : null,
    decision: {
      root_id: id,
      terra_artifact_id: 'sha256:terra',
      terra_call_id: `call-${id}`,
      terra_decision_id: `decision-${id}`,
      covered_claim_revision_ids: [`claim-${id}`],
      covered_disagreement_ids: [`disagreement-${id}`],
      follow_up_id: `LEXICAL-GAP:${id}`,
      proving_disagreement_ids: [`disagreement-${id}`],
      ...decision,
    },
  };
}

function fixture() {
  const appliedRoots = [
    root('same', 'SAME_CONCEPT_REPEAT'),
    root('genuine', 'GENUINE_UNCAPTURED_ITEM'),
    root('ambiguous', 'AMBIGUOUS_NEEDS_REVIEW', { classification: 'SAME_CONCEPT_REPEAT' }),
    root('review', 'AMBIGUOUS_NEEDS_REVIEW', { classification: 'AMBIGUOUS_NEEDS_REVIEW' }),
  ];
  return {
    inventory: { roots: appliedRoots.map((item) => ({ root_id: item.root_id })) },
    artifact: {
      artifact_id: 'sha256:terra',
      inventory_digest: 'sha256:inventory',
      decisions: [
        { classification: 'SAME_CONCEPT_REPEAT' },
        { classification: 'GENUINE_UNCAPTURED_ITEM' },
        { classification: 'SAME_CONCEPT_REPEAT' },
        { classification: 'AMBIGUOUS_NEEDS_REVIEW' },
      ],
    },
    validateArtifact: () => ({
      ok: true,
      errors: [],
      decision_validation_errors: ['DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH'],
      terra_authority: { kind: 'STAGE_2Y_F_TERRA_ADJUDICATION_AUTHORITY/V1' },
      applied: {
        roots: appliedRoots,
        classification_counts: {
          SAME_CONCEPT_REPEAT: 1,
          GENUINE_UNCAPTURED_ITEM: 1,
          AMBIGUOUS_NEEDS_REVIEW: 2,
          INVALID_INPUT: 0,
        },
      },
    }),
  };
}

test('only verified SAME_CONCEPT_REPEAT roots become report-only concept coverage', async () => {
  const { buildConceptCoverageSimulation } = await subject();
  const input = fixture();
  const output = buildConceptCoverageSimulation(input);

  assert.equal(output.mode, 'REPORT_ONLY');
  assert.equal(output.model_calls, 0);
  assert.equal(output.resolver_reinvoked, false);
  assert.equal(output.matcher_change_authorisation, false);
  assert.equal(output.publication_authorisation, 'NONE');
  assert.equal(output.counts.concept_covered_report_only, 1);
  assert.equal(output.counts.held_genuine_uncaptured_item, 1);
  assert.equal(output.counts.held_ambiguous_needs_review, 2);
  assert.deepEqual(output.concept_covered_root_ids, ['same']);
  assert.deepEqual(output.held_ambiguous_root_ids, ['ambiguous', 'review']);
  assert.equal(output.covered_concepts[0].root_id, 'same');
  assert.deepEqual(output.covered_concepts[0].covered_claim_revision_ids, ['claim-same']);
  assert.deepEqual(output.fail_closed_reclassifications, [{
    root_id: 'ambiguous',
    raw_classification: 'SAME_CONCEPT_REPEAT',
    applied_classification: 'AMBIGUOUS_NEEDS_REVIEW',
    decision_errors: ['DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH'],
  }]);
});

test('an invalid Terra artifact cannot create concept coverage', async () => {
  const { buildConceptCoverageSimulation } = await subject();
  const input = fixture();
  input.validateArtifact = () => ({ ok: false, errors: ['ARTIFACT_ID_MISMATCH'] });
  assert.throws(() => buildConceptCoverageSimulation(input), /TERRA_ARTIFACT_INVALID:ARTIFACT_ID_MISMATCH/);
});

test('artifact writing and checking are deterministic and do not use a live invoker', async () => {
  const { buildConceptCoverageSimulation, writeConceptCoverageSimulation, checkConceptCoverageSimulation } = await subject();
  const input = fixture();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-f-concept-coverage-'));
  const outputPath = path.join(scratch, 'simulation.json');
  try {
    const first = buildConceptCoverageSimulation(input);
    const second = buildConceptCoverageSimulation({ ...input, validateArtifact: input.validateArtifact });
    assert.deepEqual(first, second);
    writeConceptCoverageSimulation({ outputPath, simulation: first });
    assert.equal(checkConceptCoverageSimulation({ outputPath, simulation: second }), true);
    const tampered = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    tampered.model_calls = 1;
    fs.writeFileSync(outputPath, `${JSON.stringify(tampered)}\n`);
    assert.equal(checkConceptCoverageSimulation({ outputPath, simulation: second }), false);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('simulation code neither invokes the resolver nor authorises a matcher or publication change', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-f-concept-coverage-simulation.mjs'), 'utf8');
  assert.doesNotMatch(source, /resolveCandidates|applyLexicalDisagreementWiring|createCodexCliClient/);
  assert.match(source, /publication_authorisation: 'NONE'/);
  assert.match(source, /matcher_change_authorisation: false/);
});
