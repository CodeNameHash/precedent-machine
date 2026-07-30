const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  DEAL_SCOPE_RUN,
  EXECUTION_AUTHORITY,
  EXECUTION_BOUNDARY,
  QXO_CAPITALISATION_F28_WRITER_LINK_SCHEMA,
  buildQxoCapitalisationF28WriterLink,
} = require('../lib/canonical-v2/qxo-capitalisation-f28-writer-link');
const {
  buildQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  buildF27Inputs,
  buildWriterAdmittedSourceContext,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function admittedFixtureContext() {
  return buildWriterAdmittedSourceContext();
}

function inputs() {
  const f27 = buildF27Inputs();
  const sourceContext = admittedFixtureContext();
  const reviewedGraph = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f28')
    .buildQxoReviewedCapitalisationF28({
      sourceContext,
      parserSourceClosure: f27.parserSourceClosure,
      contractBundle: f27.contractBundle,
    });
  return {
    reviewed_graph: reviewedGraph,
    source_context: sourceContext,
    parser_source_closure: f27.parserSourceClosure,
    contract_bundle: f27.contractBundle,
    idempotency_key: 'qxo-capitalisation-f28-deal-scope-v1',
  };
}

test('builds one frozen exact F28 DEAL_SCOPE_RUN input with no residual world', () => {
  const plan = buildQxoCapitalisationF28WriterLink(inputs());
  const writeSet = plan.deal_scope_run_input.writeSet;
  assert.equal(plan.schema_version, QXO_CAPITALISATION_F28_WRITER_LINK_SCHEMA);
  assert.equal(plan.execution_authority, EXECUTION_AUTHORITY);
  assert.equal(plan.execution_boundary, EXECUTION_BOUNDARY);
  assert.equal(plan.deal_scope_run_input.operation, DEAL_SCOPE_RUN);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(writeSet.source_references.length, 1);
  assert.equal(writeSet.excerpts.length, 23);
  assert.equal(writeSet.definition_occurrences.length, 1);
  assert.equal(writeSet.provisions.length, 2);
  assert.equal(writeSet.components.length, 5);
  assert.equal(writeSet.condition_groups.length, 2);
  assert.equal(writeSet.claims.length, 7);
  assert.equal(writeSet.relationships.length, 3);
  const definition = writeSet.definition_occurrences[0];
  const definitionUse = writeSet.relationships.find(
    (row) => row.relationship_definition_key === 'USES_DEFINITION',
  );
  assert.equal(definitionUse.target_occurrence_ids[0], definition.definition_occurrence_id);
  assert.equal(
    definitionUse.effect.selected_definition_occurrence_id,
    definition.definition_occurrence_id,
  );
  for (const key of [
    'validated_semantic_graphs', 'open_world_candidates',
    'open_world_candidate_occurrences', 'open_world_evidence_references',
    'open_world_candidate_dispositions', 'open_world_primitives',
    'semantic_impact_closures', 'reviewed_source_specific_rows',
    'incomplete_canonical_result_rows',
  ]) assert.deepEqual(writeSet[key], []);
  for (const kind of ['excerpts', 'definition_occurrences', 'provisions', 'components', 'condition_groups', 'claims', 'relationships']) {
    for (const row of writeSet[kind]) assert.equal(row.closure_id, plan.closure_id);
  }
  assert.equal(plan.receipt.validation_state, 'ACCEPTED');
  assert.equal(plan.receipt.schema_rejection, null);
  assert.deepEqual(plan.receipt.validation_counts, {
    publishable: 43,
    residuals: 0,
    quarantinedClosures: 0,
  });
});

test('same exact input has an idempotent identity and conflicting input fails closed', () => {
  const first = buildQxoCapitalisationF28WriterLink(inputs());
  const replay = buildQxoCapitalisationF28WriterLink(inputs());
  assert.equal(canonicalJson(first), canonicalJson(replay));

  const conflict = inputs();
  conflict.idempotency_key = first.deal_scope_run_input.idempotencyKey;
  conflict.reviewed_graph = clone(conflict.reviewed_graph);
  conflict.reviewed_graph.relationships.pop();
  assert.throws(
    () => buildQxoCapitalisationF28WriterLink(conflict),
    /drifted|relationship inventory|F28/i,
  );
});

test('rejects F27, forged F28, source drift and a missing relationship before a write can be formed', () => {
  const f27 = inputs();
  f27.reviewed_graph = buildQxoReviewedCapitalisationF27({
    sourceContext: f27.source_context,
    parserSourceClosure: f27.parser_source_closure,
    contractBundle: f27.contract_bundle,
  });
  assert.throws(() => buildQxoCapitalisationF28WriterLink(f27), /F28|reviewed/i);

  const forged = inputs();
  forged.reviewed_graph = clone(forged.reviewed_graph);
  forged.reviewed_graph.authority.corpus_write_authority = 'PASS';
  assert.throws(() => buildQxoCapitalisationF28WriterLink(forged), /drifted|F28/i);

  const sourceDrift = inputs();
  sourceDrift.source_context = clone(sourceDrift.source_context);
  sourceDrift.source_context.canonical_text.text = `${sourceDrift.source_context.canonical_text.text} `;
  assert.throws(() => buildQxoCapitalisationF28WriterLink(sourceDrift), /source|canonical|F28/i);

  const missingRelationship = inputs();
  missingRelationship.reviewed_graph = clone(missingRelationship.reviewed_graph);
  missingRelationship.reviewed_graph.relationships.pop();
  assert.throws(
    () => buildQxoCapitalisationF28WriterLink(missingRelationship),
    /drifted|relationship inventory|F28/i,
  );
});
