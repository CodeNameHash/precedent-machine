'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, sha256Hex, utf8ByteLength, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { findSectionByReference, sectionizeAdmittedSource } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { projectIocEvidenceProductSurfaces } = require('../lib/canonical-v2/consideration-ioc-evidence-product-projection');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  ATTACHMENT_SCHEMA,
  locateNormalisedContainment,
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
const MODIV_RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const MODIV_RECORDED_RESPONSE_PATH = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-interim-operating-20260806', 'native-producer-recorded-response-5.1.json');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

let cachedModiv51 = null;

function modiv51() {
  if (cachedModiv51) return cachedModiv51;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T10:30:00.000Z',
    retrieval_policy_digest: sha256Hex('ioc-mechanic-normalised-containment-regression'),
    redirect_count: 0,
    response_bytes: fs.readFileSync(MODIV_RAW_HTML_PATH),
  });
  const sourceText = convertSecHtmlToCanonicalText(capture).canonical_text;
  const section = findSectionByReference(sectionizeAdmittedSource({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
  }), '5.1');
  assert.ok(section, 'the committed Modiv fixture must contain section 5.1');
  const recorded = JSON.parse(fs.readFileSync(MODIV_RECORDED_RESPONSE_PATH, 'utf8'));
  const mechanics = JSON.parse(recorded.raw_response_text).ioc_mechanics;
  const parent = mechanics.find((item) => item.attachment_scope === 'PARENT_COVENANT'
    && /^nothing in this Section 5\.1 shall prohibit/i.test(item.quote));
  const limb = mechanics.find((item) => item.attachment_scope === 'RESTRICTION_LIMB'
    && item.target_restriction_quote?.startsWith('make, enter into any Contract for, or otherwise commit to, any capital expenditures'));
  assert.ok(parent, 'the committed Modiv response must contain the parent-covenant fixture');
  assert.ok(limb, 'the committed Modiv response must contain the restriction-limb fixture');
  cachedModiv51 = { sourceText, section, parent, limb };
  return cachedModiv51;
}

function whitespaceVariant(value) {
  const firstSpace = value.indexOf(' ');
  assert.ok(firstSpace > 0, 'fixture quote must contain whitespace');
  return `${value.slice(0, firstSpace)}\n ${value.slice(firstSpace + 1)}`;
}

function resolvedRestriction({ sectionReference, componentId, provisionId = 'provision:modiv-5.1' }) {
  return {
    section_reference: sectionReference,
    resolved_claim_definition_key: 'IOC_RESTRICTION_PRESENT',
    party: { role: 'IOC_COVENANT_OBLIGOR', value: 'the Company', capacity: 'TARGET' },
    provision_instance: { provision_instance_id: provisionId, canonical_text_id: 'text:modiv' },
    claim: { subject_occurrence_id: componentId },
  };
}

function mechanicItem({ quote, attachmentScope, targetQuote = null, closureId }) {
  return {
    section_reference: '5.1', source_citation: '5.1', closure_id: closureId,
    claim_definition_key: 'OPEN_WORLD_PROPOSITION', raw_value: quote,
    attributes: { structured_mechanic: {
      surface: 'EXCEPTION', section_reference: '5.1', attachment_scope: attachmentScope,
      target_restriction_quote: targetQuote, value_literal: null, unit_literal: null,
      basis_literal: null, period_literal: null, unverified_operand_fields: [],
    } },
  };
}

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
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'INDEBTEDNESS', quote: DEBT },
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'CAPITAL_EXPENDITURES', quote: CAPEX },
          { section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'LITIGATION_SETTLEMENTS', quote: SETTLE },
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

test('a unique target subquote attaches to its containing restriction component', async () => {
  const resolution = await resolvedIocMechanics();
  const item = mechanics(resolution).find((entry) => (
    entry.attributes.structured_mechanic.proposed_target_restriction_quote === 'incur any indebtedness'
  ));
  const attachment = item.attributes.structured_mechanic.attachment;
  assert.equal(attachment.state, 'RESOLVED');
  assert.equal(attachment.target.provision_component_id != null, true);
  assert.equal(
    utf8Slice(SOURCE, attachment.target.span.absolute_start, attachment.target.span.absolute_end),
    'incur any indebtedness',
  );
  assert.equal(resolution.review_queue.some((entry) => entry.closure_id === item.closure_id), false);
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

test('one full mechanic quote contained inside a wider component attaches at the exact UTF-8 byte span', () => {
  const target = 'incur indebtedness above €20 million';
  const prefix = 'Préface: ';
  const sourceText = `${prefix}${target}; other restriction text.`;
  const component = {
    provision_component_id: 'component:contained',
    parent_provision_instance_id: 'provision:contained',
    component_key: 'RESTRICTED_ACTION',
    canonical_text_id: 'text:contained',
    absolute_start: 0,
    absolute_end: utf8ByteLength(sourceText),
  };
  const output = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: target,
      attachmentScope: 'RESTRICTION_LIMB',
      targetQuote: target,
      closureId: 'contained:one',
    })],
    resolved: [resolvedRestriction({
      sectionReference: '5.1',
      componentId: component.provision_component_id,
      provisionId: component.parent_provision_instance_id,
    })],
    ioc_restriction_components: [component],
    resolved_sections: [{ section_reference: '5.1', start: 0, end: utf8ByteLength(sourceText) }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });

  const attachment = output.open_world[0].attributes.structured_mechanic.attachment;
  assert.equal(attachment.state, 'RESOLVED');
  assert.deepEqual(attachment.target.span, {
    canonical_text_id: 'text:contained',
    absolute_start: utf8ByteLength(prefix),
    absolute_end: utf8ByteLength(`${prefix}${target}`),
  });
});

test('one target subquote inside a wider mechanic and component attaches at the exact UTF-8 byte span', () => {
  const target = 'incur indebtedness above €20 million';
  const mechanicQuote = `except with consent, ${target}, in the aggregate`;
  const prefix = 'Préface: ';
  const sourceText = `${prefix}${mechanicQuote}; other restriction text.`;
  const component = {
    provision_component_id: 'component:wider-contained',
    parent_provision_instance_id: 'provision:wider-contained',
    component_key: 'RESTRICTED_ACTION',
    canonical_text_id: 'text:wider-contained',
    absolute_start: 0,
    absolute_end: utf8ByteLength(sourceText),
  };
  const output = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: mechanicQuote,
      attachmentScope: 'RESTRICTION_LIMB',
      targetQuote: target,
      closureId: 'contained:wider',
    })],
    resolved: [resolvedRestriction({
      sectionReference: '5.1',
      componentId: component.provision_component_id,
      provisionId: component.parent_provision_instance_id,
    })],
    ioc_restriction_components: [component],
    resolved_sections: [{ section_reference: '5.1', start: 0, end: utf8ByteLength(sourceText) }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });

  const attachment = output.open_world[0].attributes.structured_mechanic.attachment;
  const targetPrefix = `${prefix}except with consent, `;
  assert.equal(attachment.state, 'RESOLVED');
  assert.deepEqual(attachment.target.span, {
    canonical_text_id: 'text:wider-contained',
    absolute_start: utf8ByteLength(targetPrefix),
    absolute_end: utf8ByteLength(`${targetPrefix}${target}`),
  });
});

test('two normalised occurrences inside one component abstain as ambiguous', () => {
  const target = 'incur indebtedness';
  const sourceText = `${target}; and later ${target}.`;
  const component = {
    provision_component_id: 'component:duplicate-within',
    parent_provision_instance_id: 'provision:duplicate-within',
    component_key: 'RESTRICTED_ACTION',
    canonical_text_id: 'text:duplicate-within',
    absolute_start: 0,
    absolute_end: utf8ByteLength(sourceText),
  };
  const output = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: target,
      attachmentScope: 'RESTRICTION_LIMB',
      targetQuote: target,
      closureId: 'contained:duplicate-within',
    })],
    resolved: [resolvedRestriction({
      sectionReference: '5.1',
      componentId: component.provision_component_id,
      provisionId: component.parent_provision_instance_id,
    })],
    ioc_restriction_components: [component],
    resolved_sections: [{ section_reference: '5.1', start: 0, end: utf8ByteLength(sourceText) }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });

  const attachment = output.open_world[0].attributes.structured_mechanic.attachment;
  assert.equal(attachment.state, 'REVIEW_REQUIRED');
  assert.equal(attachment.reason, 'IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES');
  assert.equal(attachment.target, null);
});

test('real Modiv 5.1 parent and limb whitespace variants locate the original UTF-8 spans', () => {
  const { sourceText, section, parent, limb } = modiv51();
  const parentVariant = whitespaceVariant(parent.quote);
  const limbVariant = whitespaceVariant(limb.target_restriction_quote);
  const parentExact = locateNormalisedContainment(
    utf8Slice(sourceText, section.start, section.end), parent.quote, section.start,
  );
  const parentLocated = locateNormalisedContainment(
    utf8Slice(sourceText, section.start, section.end), parentVariant, section.start,
  );
  const limbExact = locateNormalisedContainment(sourceText, limb.target_restriction_quote);
  const limbLocated = locateNormalisedContainment(sourceText, limbVariant);
  assert.equal(parentExact.outcome, 'UNIQUE');
  assert.deepEqual(parentLocated, parentExact, 'normalised parent lookup must retain the exact source span');
  assert.equal(limbExact.outcome, 'UNIQUE');
  assert.deepEqual(limbLocated, limbExact, 'normalised limb lookup must retain the exact source span');
  assert.equal(
    utf8Slice(sourceText, parentLocated.spans[0].absolute_start, parentLocated.spans[0].absolute_end),
    parent.quote,
  );
  assert.equal(
    utf8Slice(sourceText, limbLocated.spans[0].absolute_start, limbLocated.spans[0].absolute_end),
    limb.target_restriction_quote,
  );

  const parentOutput = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: parentVariant, attachmentScope: 'PARENT_COVENANT', closureId: 'modiv:parent',
    })],
    resolved: [resolvedRestriction({ sectionReference: '5.1', componentId: 'component:parent' })],
    ioc_restriction_components: [],
    resolved_sections: [{ ...section, section_reference: '5.1' }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });
  assert.equal(parentOutput.review_queue.length, 0);
  assert.equal(parentOutput.open_world[0].attributes.structured_mechanic.attachment.state, 'RESOLVED');

  const component = {
    provision_component_id: 'component:limb', parent_provision_instance_id: 'provision:modiv-5.1',
    component_key: 'RESTRICTED_ACTION', canonical_text_id: 'text:modiv',
    absolute_start: limbExact.spans[0].absolute_start,
    absolute_end: limbExact.spans[0].absolute_end,
  };
  const limbOutput = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: limbVariant, attachmentScope: 'RESTRICTION_LIMB',
      targetQuote: limb.target_restriction_quote, closureId: 'modiv:limb',
    })],
    resolved: [resolvedRestriction({ sectionReference: '5.1', componentId: component.provision_component_id })],
    ioc_restriction_components: [component],
    resolved_sections: [{ ...section, section_reference: '5.1' }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });
  const attachment = limbOutput.open_world[0].attributes.structured_mechanic.attachment;
  assert.equal(limbOutput.review_queue.length, 0);
  assert.equal(attachment.state, 'RESOLVED');
  assert.deepEqual(attachment.target.span, {
    canonical_text_id: 'text:modiv',
    absolute_start: limbExact.spans[0].absolute_start,
    absolute_end: limbExact.spans[0].absolute_end,
  });
});

test('normalised duplicate containment remains review-only and never selects an occurrence', () => {
  const { parent, limb } = modiv51();
  const target = limb.target_restriction_quote;
  const variant = whitespaceVariant(target);
  const sourceText = `${target}\n${variant}`;
  const firstEnd = utf8ByteLength(target);
  const secondStart = utf8ByteLength(`${target}\n`);
  const components = [
    {
      provision_component_id: 'component:duplicate:1', parent_provision_instance_id: 'provision:duplicate:1',
      component_key: 'RESTRICTED_ACTION', canonical_text_id: 'text:duplicate',
      absolute_start: 0, absolute_end: firstEnd,
    },
    {
      provision_component_id: 'component:duplicate:2', parent_provision_instance_id: 'provision:duplicate:2',
      component_key: 'RESTRICTED_ACTION', canonical_text_id: 'text:duplicate',
      absolute_start: secondStart, absolute_end: utf8ByteLength(sourceText),
    },
  ];
  const located = locateNormalisedContainment(sourceText, target);
  assert.equal(located.outcome, 'MULTIPLE');
  assert.equal(located.spans.length, 2);
  const output = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: target, attachmentScope: 'RESTRICTION_LIMB', targetQuote: target, closureId: 'modiv:duplicate',
    })],
    resolved: components.map((component) => resolvedRestriction({
      sectionReference: '5.1', componentId: component.provision_component_id,
      provisionId: component.parent_provision_instance_id,
    })),
    ioc_restriction_components: components,
    resolved_sections: [{ section_reference: '5.1', start: 0, end: utf8ByteLength(sourceText) }],
    admitted_source_context: { canonical_text: { text: sourceText } },
  });
  const attachment = output.open_world[0].attributes.structured_mechanic.attachment;
  assert.equal(attachment.state, 'REVIEW_REQUIRED');
  assert.equal(attachment.reason, 'IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES');
  assert.equal(attachment.target, null);
  assert.deepEqual(output.review_queue[0].reasons, ['IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES']);

  const parentSource = `${parent.quote}\n${whitespaceVariant(parent.quote)}`;
  const parentOutput = resolveIocMechanics({
    open_world: [mechanicItem({
      quote: parent.quote, attachmentScope: 'PARENT_COVENANT', closureId: 'modiv:parent-duplicate',
    })],
    resolved: [resolvedRestriction({ sectionReference: '5.1', componentId: 'component:parent-duplicate' })],
    ioc_restriction_components: [],
    resolved_sections: [{ section_reference: '5.1', start: 0, end: utf8ByteLength(parentSource) }],
    admitted_source_context: { canonical_text: { text: parentSource } },
  });
  assert.equal(parentOutput.open_world[0].attributes.structured_mechanic.attachment.state, 'REVIEW_REQUIRED');
  assert.equal(
    parentOutput.open_world[0].attributes.structured_mechanic.attachment.reason,
    'IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION',
  );
});

test('IOC mechanic resolution is byte-stable', async () => {
  assert.equal(canonicalJson(await resolvedIocMechanics()), canonicalJson(await resolvedIocMechanics()));
});
