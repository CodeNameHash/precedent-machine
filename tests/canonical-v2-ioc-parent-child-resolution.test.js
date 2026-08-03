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
          restriction_category: 'MERGE',
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
  assert.equal(resolution.review_queue[0].reasons.includes('IOC_PARTY_TUPLE_OMITTED'), false);
  assert.equal(resolution.resolved.length, 1);
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

test('IOC product projection covers only governed presence concepts and rejects long-tail claims', () => {
  assert.deepEqual(Object.keys(CONCEPT_LABELS).sort(), [
    'IOC-ACCOUNTING', 'IOC-CAPEX', 'IOC-CHARTER', 'IOC-COMP', 'IOC-CONTRACT',
    'IOC-DEBT', 'IOC-DIVIDEND', 'IOC-ISSUE', 'IOC-MERGE', 'IOC-SETTLE', 'IOC-TAX',
  ]);
  assert.throws(
    () => projectIocWaveAClaims({
      resolved_entries: [{
        concept_key: 'IOC-REPURCHASE',
        resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
      }],
      ioc_restriction_components: [],
    }),
    (error) => error instanceof IocWaveAProjectionError && error.code === 'UNGOVERNED_IOC_CLAIM',
  );
});
