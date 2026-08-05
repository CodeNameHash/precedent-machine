'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { projectIocEvidenceProductSurfaces } = require('../lib/canonical-v2/consideration-ioc-evidence-product-projection');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  ATTACHMENT_SCHEMA,
  NUMERIC_SCHEMA,
  resolveIocMechanics,
} = require('../lib/canonical-v2/native-producer/ioc-mechanic-resolution');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const CONTRACT = compileFixtureContractV38();
const DEBT = '(a) incur any indebtedness in excess of $25 million in the aggregate, except with Parent consent;';
const CAPEX = '(b) make capital expenditures in excess of €20 million in any fiscal year;';
const SETTLE = '(c) settle any Action for more than $1 million individually or $2 million in the aggregate;';
const PARENT_EXCEPTION = 'Nothing in this Section 5.1 shall prohibit any action required by Law.';
const SOURCE = [
  'Section 5.1 Conduct of Business.',
  'The Company shall not:',
  DEBT,
  CAPEX,
  SETTLE,
  PARENT_EXCEPTION,
].join('\n');

async function resolvedIocMechanics() {
  const dealKey = 'deal:ioc-mechanic-resolution';
  const admitted = buildIdentityAdmittedSourceContext(SOURCE, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const receipt = await runNativeExtraction({
    source_text: SOURCE,
    document_hash: sha256Hex(Buffer.from(SOURCE, 'utf8')),
    section_references: ['5.1'],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeIocProposals({
        ioc_restriction_assertions: [
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'DEBT', quote: DEBT },
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'CAPEX', quote: CAPEX },
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'SETTLE', quote: SETTLE },
        ],
        ioc_mechanics: [
          {
            section_reference: '5.1', surface: 'EXCEPTION', quote: DEBT,
            detail: 'debt threshold and consent exception', attachment_scope: 'RESTRICTION_LIMB',
            target_restriction_quote: DEBT, value_literal: '$25 million', unit_literal: 'million',
            basis_literal: 'in the aggregate', period_literal: null,
          },
          {
            section_reference: '5.1', surface: 'THRESHOLD_OR_NOTICE_WINDOW', quote: CAPEX,
            detail: 'non-USD capital expenditure threshold', attachment_scope: 'RESTRICTION_LIMB',
            target_restriction_quote: CAPEX, value_literal: '€20 million', unit_literal: 'million',
            basis_literal: null, period_literal: 'in any fiscal year',
          },
          {
            section_reference: '5.1', surface: 'THRESHOLD_OR_NOTICE_WINDOW', quote: SETTLE,
            detail: 'two settlement baskets', attachment_scope: 'RESTRICTION_LIMB',
            target_restriction_quote: SETTLE, value_literal: '$1 million', unit_literal: 'million',
            basis_literal: 'individually', period_literal: null,
          },
          {
            section_reference: '5.1', surface: 'EXCEPTION', quote: DEBT,
            detail: 'hostile unmatched target', attachment_scope: 'RESTRICTION_LIMB',
            target_restriction_quote: 'incur any indebtedness', value_literal: null,
          },
          {
            section_reference: '5.1', surface: 'THRESHOLD_OR_NOTICE_WINDOW', quote: DEBT,
            detail: 'hostile unquoted period operand', attachment_scope: 'RESTRICTION_LIMB',
            target_restriction_quote: DEBT, value_literal: '$25 million', unit_literal: 'million',
            basis_literal: 'in the aggregate', period_literal: 'per annum',
          },
          {
            section_reference: '5.1', surface: 'EXCEPTION', quote: PARENT_EXCEPTION,
            detail: 'parent-wide required-law exception', attachment_scope: 'PARENT_COVENANT',
            target_restriction_quote: null, value_literal: null,
          },
        ],
        open_world_candidates: [],
      }, governedScope.source_text, { covenant_side: 'TARGET' });
      return {
        provider_id: 'ioc-mechanic-resolution-test/v1', model_id: 'recorded-response',
        prompt: 'ioc-mechanic-resolution-test/v1', proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admitted,
  });
}

function mechanics(resolution) {
  return resolution.open_world.filter((item) => (
    item.attributes?.structured_mechanic?.numeric_resolution !== undefined
  ));
}

test('scale-word money resolves beside unchanged raw operands and an exact child attachment', async () => {
  const resolution = await resolvedIocMechanics();
  const item = mechanics(resolution).find((entry) => entry.raw_value === DEBT
    && entry.attributes.structured_mechanic.value_literal === '$25 million');
  const mechanic = item.attributes.structured_mechanic;
  assert.equal(mechanic.value_literal, '$25 million');
  assert.equal(mechanic.unit_literal, 'million');
  assert.equal(mechanic.basis_literal, 'in the aggregate');
  assert.deepEqual(mechanic.numeric_resolution, {
    schema_version: NUMERIC_SCHEMA, state: 'RESOLVED', reason: null,
    parser_version: 2, canonical_value: '25000000', canonical_unit: 'MONEY',
    currency: 'USD', scale: 'million',
  });
  assert.equal(mechanic.attachment.schema_version, ATTACHMENT_SCHEMA);
  assert.equal(mechanic.attachment.scope, 'RESTRICTION_COMPONENT');
  assert.equal(mechanic.attachment.target.component_key, 'RESTRICTED_ACTION');
  assert.equal(mechanic.attachment.target.path.length, 3);
  assert.deepEqual(mechanic.attachment.inherited_party, {
    role: 'IOC_COVENANT_OBLIGOR', value: 'The Company', capacity: 'TARGET',
  });
  assert.equal(mechanic.attachment.target.span.absolute_end
    - mechanic.attachment.target.span.absolute_start, Buffer.byteLength(DEBT));
  assert.equal(Object.hasOwn(mechanic, 'attachment_scope'), false);
  assert.equal(resolution.resolution_receipt.ioc_mechanic_resolution_schema, 'NATIVE_IOC_MECHANIC_RESOLUTION/V1');
});

test('multiple amounts and non-USD amounts remain raw open world with no canonical value', async () => {
  const resolution = await resolvedIocMechanics();
  const nonUsd = mechanics(resolution).find((entry) => entry.raw_value === CAPEX)
    .attributes.structured_mechanic;
  assert.equal(nonUsd.value_literal, '€20 million');
  assert.equal(nonUsd.numeric_resolution.state, 'OPEN_WORLD');
  assert.equal(nonUsd.numeric_resolution.reason, 'NON_USD_CURRENCY');
  assert.equal(nonUsd.numeric_resolution.canonical_value, null);

  const multiple = mechanics(resolution).find((entry) => entry.raw_value === SETTLE)
    .attributes.structured_mechanic;
  assert.equal(multiple.value_literal, '$1 million');
  assert.equal(multiple.numeric_resolution.state, 'OPEN_WORLD');
  assert.equal(multiple.numeric_resolution.reason, 'MULTIPLE_MONEY_LITERALS');
  assert.equal(multiple.numeric_resolution.canonical_value, null);
});

test('zero attachment matches enter legal review and never attach to the nearest limb', async () => {
  const resolution = await resolvedIocMechanics();
  const item = mechanics(resolution).find((entry) => (
    entry.attributes.structured_mechanic.proposed_target_restriction_quote === 'incur any indebtedness'
  ));
  assert.equal(item.attributes.structured_mechanic.attachment.state, 'REVIEW_REQUIRED');
  assert.equal(item.attributes.structured_mechanic.attachment.reason, 'IOC_ATTACHMENT_TARGET_ZERO_MATCHES');
  assert.ok(resolution.review_queue.some((entry) => (
    entry.closure_id === item.closure_id
      && entry.reasons.includes('IOC_ATTACHMENT_TARGET_ZERO_MATCHES')
  )));
});

test('a non-exact operand blocks numeric normalisation and stays in review', async () => {
  const resolution = await resolvedIocMechanics();
  const item = mechanics(resolution).find((entry) => (
    entry.attributes.structured_mechanic.unverified_operand_fields.includes('period_literal')
  ));
  const numeric = item.attributes.structured_mechanic.numeric_resolution;
  assert.equal(item.attributes.structured_mechanic.period_literal, null);
  assert.equal(numeric.state, 'REVIEW_REQUIRED');
  assert.equal(numeric.reason, 'IOC_NUMERIC_OPERAND_NOT_EXACT');
  assert.equal(numeric.canonical_value, null);
  assert.ok(resolution.review_queue.some((entry) => (
    entry.closure_id === item.closure_id
      && entry.reasons.includes('IOC_NUMERIC_OPERAND_NOT_EXACT')
  )));
});

test('a parent-wide exception targets the exact covenant path and inherits the parent party once', async () => {
  const resolution = await resolvedIocMechanics();
  const item = mechanics(resolution).find((entry) => entry.raw_value === PARENT_EXCEPTION);
  const attachment = item.attributes.structured_mechanic.attachment;
  assert.equal(attachment.scope, 'PARENT_COVENANT');
  assert.deepEqual(attachment.target.path, ['section:5.1', 'parent-covenant']);
  assert.equal(attachment.target.provision_instance_ids.length, 3);
  assert.equal(attachment.inherited_party.capacity, 'TARGET');
  assert.equal(item.attributes.structured_mechanic.proposed_target_restriction_quote, null);
});

test('finished IOC product data exposes the safe normalisation and exact attachment without a market amount', async () => {
  const resolution = await resolvedIocMechanics();
  const output = projectIocEvidenceProductSurfaces({ resolution, deal_id: 'ioc-mechanic-resolution' });
  const card = output.cards.find((candidate) => (
    candidate.features.iocEvidenceNumeric?.normalised?.canonical_value === '25000000'
  ));
  assert.equal(card.features.iocEvidenceNumeric.value_literal, '$25 million');
  assert.equal(card.features.iocEvidenceAttachment.target.component_key, 'RESTRICTED_ACTION');
  assert.equal(card.features.iocEvidenceInheritedParty.capacity, 'TARGET');
  assert.equal(output.market.some((entry) => entry.canonical_value === '25000000'), false);
});

test('two exact component matches enter review and do not select by order', () => {
  const sourceText = 'same target';
  const party = { role: 'IOC_COVENANT_OBLIGOR', value: 'Company', capacity: 'TARGET' };
  const components = ['component:1', 'component:2'].map((id, ordinal) => ({
    provision_component_id: id, parent_provision_instance_id: `provision:${ordinal}`,
    component_key: 'RESTRICTED_ACTION', canonical_text_id: 'text:1',
    absolute_start: 0, absolute_end: Buffer.byteLength(sourceText),
  }));
  const resolved = components.map((component, ordinal) => ({
    section_reference: '5.1', resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
    party, provision_instance: {
      provision_instance_id: `provision:${ordinal}`, canonical_text_id: 'text:1',
    },
    claim: { subject_occurrence_id: component.provision_component_id },
  }));
  const item = {
    section_reference: '5.1', source_citation: '5.1', closure_id: 'open:multi',
    claim_definition_key: 'OPEN_WORLD_PROPOSITION', raw_value: sourceText,
    attributes: { structured_mechanic: {
      surface: 'EXCEPTION', section_reference: '5.1', attachment_scope: 'RESTRICTION_LIMB',
      target_restriction_quote: sourceText, value_literal: null, unit_literal: null,
      basis_literal: null, period_literal: null, unverified_operand_fields: [],
    } },
  };
  const output = resolveIocMechanics({
    open_world: [item], resolved, ioc_restriction_components: components,
    resolved_sections: [{ section_reference: '5.1', start: 0, end: Buffer.byteLength(sourceText) }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });
  assert.equal(output.open_world[0].attributes.structured_mechanic.attachment.target, null);
  assert.equal(
    output.open_world[0].attributes.structured_mechanic.attachment.reason,
    'IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES',
  );
  assert.deepEqual(output.review_queue[0].reasons, ['IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES']);
});

test('IOC mechanic resolution is byte-stable', async () => {
  assert.equal(canonicalJson(await resolvedIocMechanics()), canonicalJson(await resolvedIocMechanics()));
});
