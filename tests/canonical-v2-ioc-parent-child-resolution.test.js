'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { compileFixtureContractV25 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  CONCEPT_LABELS,
  IocWaveAProjectionError,
  projectIocWaveAClaims,
} = require('../lib/canonical-v2/ioc-wave-a-product-projection');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'ioc-parent-child', 'parent-merge-card.json'),
  'utf8',
));
const childQuote = '(x) acquire control (it being understood for the purposes of this Section 6.1(c) that obtaining the right to a board seat of a third party shall be deemed control),';
const sourceText = `Section 6.1 Interim Operations of Parent.\nThe Company shall not delay the Closing.\n${fixture.primary_quote}`;
const source = buildImmutableSource({
  sourceBytes: sourceText,
  sourceOccurrenceKey: 'IOC_PARENT_CHILD_FIXTURE',
});
const admittedSourceContext = Object.freeze({
  ...source,
  governed_deal_key: `deal:${fixture.deal_id}`,
  deal_admission_id: sha256Hex(`deal-admission:${fixture.deal_id}`),
  source_ordinal: 0,
});

test('IOC uses the nearest preceding chapeau party on a parent provision and a child restriction component', async () => {
  const runReceipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: source.document_hash,
    section_references: ['6.1'],
    contract_bundle: compileFixtureContractV25(),
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeIocProposals({
        ioc_restriction_assertions: [{
          section_reference: '6.1',
          assertion_kind: 'RESTRICTION_PRESENT',
          restriction_category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
          threshold_basis: null,
          quote: childQuote,
        }],
        open_world_candidates: [],
      }, governedScope.source_text, { covenant_side: 'BUYER' });
      return {
        provider_id: 'ioc-parent-child-test/v1',
        model_id: 'stub',
        prompt: 'ioc-parent-child-test',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });

  assert.equal(
    Object.hasOwn(runReceipt.compiled_candidates[0].candidate.claim.attributes, 'ioc_chapeau_party'),
    false,
    'the producer does not invent a limb-level party tuple',
  );

  const resolution = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV25(),
    admitted_source_context: admittedSourceContext,
  });

  assert.equal(resolution.review_queue.length, 1);
  assert.equal(resolution.review_queue[0].has_resolution, true);
  assert.equal(resolution.review_queue[0].materiality_rank, 65);
  assert.equal(resolution.review_queue[0].materiality_label, 'INTERIM_OPERATING_COVENANTS');
  assert.equal(resolution.review_queue[0].reasons.includes('IOC_PARTY_TUPLE_OMITTED'), false);
  assert.equal(resolution.resolved.length, 1);
  assert.equal(resolution.resolved[0].triage.materiality_rank, 65);
  assert.equal(resolution.resolved[0].triage.materiality_label, 'INTERIM_OPERATING_COVENANTS');
  assert.deepEqual(resolution.resolved[0].party, {
    role: 'IOC_COVENANT_OBLIGOR', value: 'Parent', capacity: 'BUYER',
  });
  assert.equal(resolution.resolved[0].provision_instance.absolute_start, 0);
  assert.equal(resolution.resolved[0].provision_instance.absolute_end, Buffer.byteLength(sourceText));
  assert.equal(
    sourceText.slice(
      resolution.resolved[0].party_source_span.absolute_start,
      resolution.resolved[0].party_source_span.absolute_end,
    ),
    'Parent and its Subsidiaries shall not',
  );
  assert.equal(resolution.ioc_restriction_components.length, 1);
  const component = resolution.ioc_restriction_components[0];
  assert.equal(component.parent_provision_instance_id, resolution.resolved[0].provision_instance.provision_instance_id);
  assert.equal(resolution.resolved[0].claim.subject_occurrence_id, component.provision_component_id);
  assert.equal(resolution.resolved[0].claim.attributes.inherited_party_from_provision_instance_id, component.parent_provision_instance_id);
  assert.equal(sourceText.slice(component.absolute_start, component.absolute_end), childQuote);
  assert.equal(resolution.resolution_receipt.counts.ioc_restriction_components, 1);

  const projection = projectIocWaveAClaims({
    resolved_entries: resolution.resolved,
    ioc_restriction_components: resolution.ioc_restriction_components,
  });
  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(projection.records.length, 1);
  assert.deepEqual(projection.records[0].query, {
    field_key: 'iocRestrictionPresent',
    value: { concept_key: 'IOC-MERGE', obligor_capacity: 'BUYER' },
  });
  assert.deepEqual(projection.records[0].compare, projection.records[0].query);
  assert.equal(projection.records[0].review.label, 'Mergers, acquisitions and dispositions');
  assert.deepEqual(projection.records[0].market, {
    metric_key: 'IOC_RESTRICTION_PRESENCE_BY_CONCEPT_AND_SIDE',
    metric_version: 1,
    value_dimension: 'BOOLEAN_PRESENCE',
    canonical_unit: 'PRESENT_TRUE',
    canonical_value: true,
    breakdown: { concept_key: 'IOC-MERGE', obligor_capacity: 'BUYER' },
    per_deal_rollup: 'ANY_TRUE',
    weighting: 'DEAL',
  });
  assert.equal(fieldsForCompareCell('COVENANT_INTERIM_OPERATING')[0], 'iocRestrictionPresent');
});

test('UTF-8 IOC review keeps the candidate citation, occurrence, and evidence exactly', async () => {
  const quote = 'Élan shall not take any action.';
  const sourceText = `Section 6.2 Interim Operations.\n${quote}`;
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'IOC_UTF8_EVIDENCE_FIXTURE' });
  const admitted = Object.freeze({
    ...source,
    governed_deal_key: 'deal:ioc-utf8-evidence',
    deal_admission_id: sha256Hex('deal-admission:ioc-utf8-evidence'),
    source_ordinal: 0,
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: source.document_hash,
    section_references: ['6.2'],
    contract_bundle: compileFixtureContractV25(),
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: scope }) => {
      const shaped = shapeIocProposals({
        ioc_restriction_assertions: [{
          section_reference: '6.2', assertion_kind: 'RESTRICTION_PRESENT',
          restriction_category: 'DIVIDENDS_DISTRIBUTIONS', threshold_basis: null, quote,
        }],
        open_world_candidates: [],
      }, scope.source_text, { covenant_side: 'TARGET' });
      return { provider_id: 'ioc-utf8-evidence/v1', model_id: 'stub', prompt: 'ioc-utf8-evidence', proposals: shaped.proposals, evidence_residuals: shaped.evidence_residuals };
    },
  });
  const hostileReceipt = JSON.parse(JSON.stringify(receipt));
  const original = hostileReceipt.compiled_candidates[0].candidate.claim;
  original.source_citation = '§6.2 original UTF-8 citation';
  const resolution = resolveCandidates({
    run_receipt: hostileReceipt,
    contract_vocabulary: compileFixtureContractV25(),
    admitted_source_context: admitted,
  });
  const review = resolution.review_queue.find((entry) => entry.has_resolution === false);
  assert.ok(review);
  assert.equal(review.source_citation, original.source_citation);
  assert.equal(review.raw_value, original.raw_value);
  assert.equal(review.canonical_value, original.canonical_value);
  assert.equal(review.original_claim_occurrence_id, original.claim_occurrence_id);
  assert.deepEqual(review.evidence, original.evidence);
  assert.equal(Buffer.byteLength(review.raw_value, 'utf8'), Buffer.byteLength(original.raw_value, 'utf8'));
});

// ─────────────────────────────────────────────────────────────────────────
// Step 3F1 (docs/core/PLAN.md, "give the marker a downstream contract"):
// projectIocWaveAClaims already refuses any party.capacity outside
// TARGET/BUYER -- including JOINT_MULTI_PARTY_CAPACITY
// ('JOINT_MULTI_PARTY', lib/canonical-v2/native-producer/candidate-
// resolution.js) -- with a typed, explicit throw. This is the "refuses it
// explicitly" side of the plan's acceptance criteria; unlike the
// termination and proxy-meeting projections, this one needed no code
// change, only this test proving the behaviour was never actually
// exercised before.
// ─────────────────────────────────────────────────────────────────────────

test('JOINT_MULTI_PARTY capacity: projectIocWaveAClaims throws INVALID_INHERITED_PARTY rather than silently accepting it', () => {
  const provisionInstanceId = 'ioc-joint-capacity-provision';
  const provisionComponentId = 'ioc-joint-capacity-component';
  const party = { role: 'IOC_COVENANT_OBLIGOR', value: 'Parent and Company Merger Sub', capacity: 'JOINT_MULTI_PARTY' };
  const entry = {
    concept_key: 'IOC-MERGE',
    resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
    section_reference: '6.1',
    party,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionInstanceId,
      party,
    },
    claim: {
      state: 'PRESENT',
      canonical_value: true,
      claim_definition_key: 'IOC_RESTRICTION_PRESENT',
      subject_occurrence_id: provisionComponentId,
    },
  };
  const iocRestrictionComponents = [{
    schema_version: 'PROVISION_COMPONENT/V1',
    provision_component_id: provisionComponentId,
    component_key: 'RESTRICTED_ACTION',
    parent_provision_instance_id: provisionInstanceId,
  }];
  assert.throws(
    () => projectIocWaveAClaims({ resolved_entries: [entry], ioc_restriction_components: iocRestrictionComponents }),
    (error) => error instanceof IocWaveAProjectionError && error.code === 'INVALID_INHERITED_PARTY',
  );
});

const CONCEPT_LABELS_EXPECTED = Object.freeze([
  'IOC-ACCOUNTING', 'IOC-AFFILIATE', 'IOC-CAPEX', 'IOC-CHARTER', 'IOC-COMP', 'IOC-CONTRACT',
  'IOC-DEBT', 'IOC-DIVIDEND', 'IOC-HIRE', 'IOC-INSURANCE', 'IOC-ISSUE', 'IOC-IP', 'IOC-LIEN',
  'IOC-MERGE', 'IOC-ORDINARY', 'IOC-REALPROP', 'IOC-REGAUTH', 'IOC-REPURCHASE', 'IOC-SETTLE', 'IOC-TAX',
]);

test('IOC product projection covers only governed presence concepts and rejects long-tail claims', () => {
  assert.deepEqual(Object.keys(CONCEPT_LABELS).sort(), [...CONCEPT_LABELS_EXPECTED].sort());
  assert.throws(
    () => projectIocWaveAClaims({
      resolved_entries: [{
        concept_key: 'IOC-WAIVE',
        resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
      }],
      ioc_restriction_components: [],
    }),
    (error) => error instanceof IocWaveAProjectionError && error.code === 'UNGOVERNED_IOC_CLAIM',
  );
});
