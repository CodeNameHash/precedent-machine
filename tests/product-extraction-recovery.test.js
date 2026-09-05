'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { primaryProposalSource, presentReviewEvidence } = require('../lib/product/review-presentation');
const { substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const {
  conchoSource, createSyntheticConchoModel, schema,
} = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

test('one unknown evidence component stays invalid while usable proposals and role defects survive', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  let providerResponse;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION') return result;
      const byRef = new Map(result.response.proposals.map((proposal) => [proposal.client_ref, proposal]));
      const unknown = byRef.get('p-ns-exception');
      unknown.evidence_quotes[0].source_span_id = 'unknown-component-from-provider';

      const caseVariant = byRef.get('p-ns-notice');
      caseVariant.roles.NOTICE_GIVER = caseVariant.roles.notice_giver;
      delete caseVariant.roles.notice_giver;

      const collision = byRef.get('p-ns-initial');
      collision.roles.COVENANT_OBLIGOR = 'Conflicting provider value';

      const missing = byRef.get('p-ns-subsequent');
      const missingContract = schema.families.find((family) => family.family_key === missing.family_key)
        .subtypes.find((subtype) => subtype.subtype_key === missing.subtype_key);
      delete missing.roles[missingContract.required_roles[0]];

      result.response.groups.push({
        client_ref: 'g-empty', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION',
      });
      providerResponse = structuredClone(result.response);
      return { ...result, raw_response: result.response };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  const proposals = new Map(section.proposals.map((proposal) => [proposal.statement, proposal]));
  const good = proposals.get('The Company must not solicit or encourage a Company Competing Proposal.');
  const unknown = proposals.get('The Company may furnish information only after the stated proposal, confidentiality, adviser and fiduciary prerequisites are met.');
  const caseVariant = proposals.get('The Company must notify Parent within the shorter of one Business Day or 48 hours.');
  const collision = proposals.get('The Company must give Parent three Business Days before a recommendation change.');
  const missing = proposals.get('A material amendment starts a reduced one Business Day notice period.');

  assert.equal(good.validation_status, 'VALID');
  assert.equal(unknown.validation_status, 'INVALID');
  assert.deepEqual(unknown.source_span_ids, []);
  assert.deepEqual(unknown.unmatched_evidence, [{
    quote: providerResponse.proposals.find((proposal) => proposal.client_ref === 'p-ns-exception').evidence_quotes[0].quote,
    occurrence: 0,
    source_span_id: 'unknown-component-from-provider',
    component_kind: null,
    component_structure_node_id: node.node_id,
    fallback_source_span_id: section.source_closure.full_section_span_id,
    reason: 'UNKNOWN_SOURCE_COMPONENT',
  }]);
  assert.ok(section.issues.some((issue) => issue.code === 'UNKNOWN_SOURCE_COMPONENT'
    && issue.proposal_id === unknown.proposal_id));

  assert.equal(caseVariant.validation_status, 'VALID');
  assert.equal(caseVariant.roles.notice_giver, 'Company');
  assert.equal(Object.hasOwn(caseVariant.roles, 'NOTICE_GIVER'), false);

  assert.equal(collision.validation_status, 'INVALID');
  assert.equal(collision.roles.covenant_obligor, 'Company');
  assert.equal(collision.roles.COVENANT_OBLIGOR, 'Conflicting provider value');
  assert.ok(section.issues.some((issue) => issue.code === 'ROLE_KEY_COLLISION'
    && issue.proposal_id === collision.proposal_id));

  assert.equal(missing.validation_status, 'INVALID');
  assert.ok(section.issues.some((issue) => issue.code === 'MISSING_REQUIRED_ROLE'
    && issue.subtype_key === missing.subtype_key));
  assert.ok(section.issues.some((issue) => issue.code === 'EMPTY_PROPOSITION_GROUP'));

  const extraction = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.deepEqual(extraction.response, providerResponse);
  assert.equal(extraction.prompt_version, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V4');
  assert.match(extraction.request.instruction, /copy the exact required and optional role keys/i);
  assert.match(extraction.request.instruction, /copy only source_span_id values supplied in the source closure/i);
  assert.match(extraction.request.instruction, /do not generate or alter source span IDs/i);
});

test('unknown evidence opens the actual containing section with an explicit warning', () => {
  const reviewEvidence = presentReviewEvidence({ unmatched_evidence: [{
    quote: 'Claimed exact text.',
    occurrence: 0,
    source_span_id: 'provider-invented-id',
    fallback_source_span_id: 'actual-full-section-id',
    component_structure_node_id: 'section-node',
    component_kind: null,
    reason: 'UNKNOWN_SOURCE_COMPONENT',
  }] }, [{ node_id: 'section-node', reference: '3.12' }]);

  assert.equal(reviewEvidence.unmatched[0].source_span_id, 'provider-invented-id');
  assert.equal(reviewEvidence.unmatched[0].reason,
    'The claimed source component is not in the supplied source closure.');
  assert.deepEqual(primaryProposalSource([], reviewEvidence), {
    spanId: 'actual-full-section-id',
    reviewContext: reviewEvidence.unmatched[0].source_context,
  });
});

test('unsupported fact types and their links become visible unresolved issues without losing valid siblings', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  let unsupportedProviderProposal;
  let unsupportedProviderLink;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION') return result;
      const unsupported = result.response.proposals
        .find((proposal) => proposal.client_ref === 'p-ns-exception');
      unsupported.fact_type = 'WITHHOLDING_MECHANIC';
      unsupportedProviderProposal = structuredClone(unsupported);
      unsupportedProviderLink = structuredClone(result.response.links
        .find((link) => link.from_ref === unsupported.client_ref || link.to_ref === unsupported.client_ref));
      return { ...result, raw_response: result.response };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });

  assert.ok(section.proposals.some((proposal) => proposal.statement
    === 'The Company must not solicit or encourage a Company Competing Proposal.'
    && proposal.validation_status === 'VALID'));
  assert.equal(section.proposals.some((proposal) => proposal.fact_type === 'WITHHOLDING_MECHANIC'), false);
  const factTypeIssue = section.issues.find((issue) => issue.code === 'UNSUPPORTED_FACT_TYPE');
  assert.ok(factTypeIssue);
  assert.deepEqual(JSON.parse(factTypeIssue.message), unsupportedProviderProposal);
  assert.deepEqual(factTypeIssue.source_span_ids, [section.source_closure.full_section_span_id]);
  const linkIssue = section.issues.find((issue) => issue.code === 'UNSUPPORTED_FACT_LINK');
  assert.ok(linkIssue);
  assert.deepEqual(JSON.parse(linkIssue.message), unsupportedProviderLink);
  assert.equal(section.links.length, 0);
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY'
    && assertion.family_key === 'NO_SHOP').state, 'UNRESOLVED');
  const extraction = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.deepEqual(extraction.response.proposals.find((proposal) => proposal.client_ref === 'p-ns-exception'),
    unsupportedProviderProposal);
  assert.deepEqual(extraction.response.links.find((link) => link.from_ref === 'p-ns-exception'),
    unsupportedProviderLink);
});
