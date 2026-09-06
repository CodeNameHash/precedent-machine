'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
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

  assert.equal(caseVariant.validation_status, 'INVALID');
  assert.ok(section.issues.some((issue) => issue.code === 'VALUE_MULTIPLE_PERIOD_LITERALS'));
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
  assert.equal(extraction.prompt_version, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V6');
  assert.equal(extraction.request.schema_version, schema.schema_version);
  assert.equal(extraction.request.schema_revision, schema.schema_revision);
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

test('a proposal with an undeclared group is held without losing valid siblings', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  let originalResponse;
  let held;
  let heldFactType;
  let heldLink;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind === 'EXTRACTION') {
        const proposal = result.response.proposals.find((item) => item.client_ref === 'p-ns-exception');
        proposal.group_ref = 'missing-group';
        held = structuredClone(proposal);
        heldFactType = proposal.fact_type;
        heldLink = structuredClone(result.response.links.find((link) => link.from_ref === proposal.client_ref || link.to_ref === proposal.client_ref));
        originalResponse = structuredClone(result.response);
      }
      return { ...result, raw_response: result.response };
    },
  };
  const section = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model, node });
  assert.ok(section.proposals.some((proposal) => proposal.statement
    === 'The Company must not solicit or encourage a Company Competing Proposal.'
    && proposal.validation_status === 'VALID'));
  const issue = section.issues.find((item) => item.code === 'UNSUPPORTED_PROPOSITION_GROUP_MEMBER');
  assert.ok(issue);
  assert.equal(issue.state, 'OPEN');
  assert.deepEqual(JSON.parse(issue.message), held);
  assert.deepEqual(issue.source_span_ids, [section.source_closure.full_section_span_id]);
  const linkIssue = section.issues.find((item) => item.code === 'UNSUPPORTED_FACT_LINK');
  assert.ok(linkIssue);
  assert.equal(linkIssue.state, 'OPEN');
  assert.deepEqual(JSON.parse(linkIssue.message), heldLink);
  assert.equal(section.coverage.find((item) => item.subject_kind === 'SECTION_FAMILY' && item.family_key === 'NO_SHOP').state, 'UNRESOLVED');
  assert.equal(section.coverage.find((item) => item.subject_kind === 'FACT_TYPE'
    && item.family_key === held.family_key && item.subject_id.endsWith(`:${heldFactType}`)).state, 'UNRESOLVED');
  const extraction = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.deepEqual(extraction.response, originalResponse);
  const analysis = {
    kind: 'draftAnalysis', draft_analysis_id: 'undeclared-group-draft',
    analysis_run_id: 'undeclared-group-run', proposals: section.proposals,
    fact_links: section.links, issues: section.issues, coverage_assertions: section.coverage,
    spans: section.spans, source_closures: [section.source_closure], sections: [section.routing],
  };
  const review = initialiseReviewState(analysis);
  assert.equal(review.items.find((item) => item.source_id === issue.issue_id).decision, 'PENDING');
  assert.throws(() => applyReviewCommand(review, { type: 'PUBLISH' }, {
    analysis, legalSchema: schema,
  }), /REVIEW_PENDING_ITEMS/);
});

test('unsupported subtype groups become visible unresolved issues without losing valid siblings', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  let unsupportedGroup;
  let unsupportedProposal;
  let unsupportedLink;
  let providerResponse;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION') return result;
      const proposal = result.response.proposals.find((item) => item.client_ref === 'p-ns-exception');
      const group = result.response.groups.find((item) => item.client_ref === proposal.group_ref);
      proposal.subtype_key = 'MODEL_INVENTED_SUBTYPE';
      proposal.fact_type = 'PROHIBITED_ACTION';
      group.subtype_key = 'MODEL_INVENTED_SUBTYPE';
      unsupportedGroup = structuredClone(group);
      unsupportedProposal = structuredClone(proposal);
      unsupportedLink = structuredClone(result.response.links.find((link) => (
        link.from_ref === proposal.client_ref || link.to_ref === proposal.client_ref
      )));
      providerResponse = structuredClone(result.response);
      return { ...result, raw_response: providerResponse };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  assert.ok(section.proposals.some((proposal) => proposal.validation_status === 'VALID'));
  assert.equal(section.proposals.some((proposal) => proposal.subtype_key === 'MODEL_INVENTED_SUBTYPE'), false);
  const issue = section.issues.find((item) => item.code === 'UNSUPPORTED_SUBTYPE');
  assert.ok(issue);
  assert.deepEqual(JSON.parse(issue.message), unsupportedGroup);
  assert.deepEqual(issue.source_span_ids, [section.source_closure.full_section_span_id]);
  const heldProposal = section.issues.find((item) => item.code === 'UNSUPPORTED_PROPOSITION_GROUP_MEMBER');
  assert.deepEqual(JSON.parse(heldProposal.message), unsupportedProposal);
  const heldLink = section.issues.find((item) => item.code === 'UNSUPPORTED_FACT_LINK');
  assert.deepEqual(JSON.parse(heldLink.message), unsupportedLink);
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY'
    && assertion.family_key === 'NO_SHOP').state, 'UNRESOLVED');
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'FACT_TYPE'
    && assertion.family_key === 'NO_SHOP' && assertion.reason === 'FACT_TYPE:PROHIBITED_ACTION').state,
  'UNRESOLVED');
  const extraction = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.deepEqual(extraction.response, providerResponse);

  const analysis = {
    kind: 'draftAnalysis', draft_analysis_id: 'unsupported-subtype-draft',
    analysis_run_id: 'unsupported-subtype-run', proposals: section.proposals,
    fact_links: section.links, issues: section.issues, coverage_assertions: section.coverage,
    spans: section.spans, source_closures: [section.source_closure], sections: [section.routing],
  };
  const review = initialiseReviewState(analysis);
  const heldReviewItem = review.items.find((item) => item.source_id === heldProposal.issue_id);
  assert.equal(JSON.parse(heldReviewItem.original.message).statement, unsupportedProposal.statement);
  assert.deepEqual(heldReviewItem.source_span_ids, [section.source_closure.full_section_span_id]);
});

test('an unsupported proposal subtype holds only that proposal and preserves its supported sibling group identity', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const baseline = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema,
    model: createSyntheticConchoModel(), node,
  });
  const baselineSibling = baseline.proposals.find((proposal) => (
    proposal.statement === 'The Company must not solicit or encourage a Company Competing Proposal.'
  ));
  const baselineGroup = baseline.groups.find((group) => (
    group.proposition_group_id === baselineSibling.proposition_group_id
  ));
  const base = createSyntheticConchoModel();
  let heldProviderProposal;
  let heldProviderLink;
  let providerResponse;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION') return result;
      const held = result.response.proposals.find((item) => item.client_ref === 'p-ns-exception');
      held.group_ref = 'g-ns-prohibited';
      held.subtype_key = 'MODEL_INVENTED_SUBTYPE';
      held.fact_type = 'PROHIBITED_ACTION';
      result.response.groups = result.response.groups
        .filter((group) => group.client_ref !== 'g-ns-exception');
      heldProviderProposal = structuredClone(held);
      heldProviderLink = structuredClone(result.response.links.find((link) => (
        link.from_ref === held.client_ref || link.to_ref === held.client_ref
      )));
      providerResponse = structuredClone(result.response);
      return { ...result, raw_response: providerResponse };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  const sibling = section.proposals.find((proposal) => proposal.statement === baselineSibling.statement);
  const group = section.groups.find((candidate) => candidate.proposition_group_id
    === sibling.proposition_group_id);
  assert.equal(sibling.fact_occurrence_id, baselineSibling.fact_occurrence_id);
  assert.equal(group.proposition_group_id, baselineGroup.proposition_group_id);
  assert.deepEqual(group.fact_occurrence_ids, [sibling.fact_occurrence_id]);
  assert.equal(group.family_key, baselineGroup.family_key);
  assert.equal(group.subtype_key, baselineGroup.subtype_key);
  const heldIssue = section.issues.find((issue) => issue.code === 'UNSUPPORTED_SUBTYPE'
    && JSON.parse(issue.message).client_ref === heldProviderProposal.client_ref);
  assert.deepEqual(JSON.parse(heldIssue.message), heldProviderProposal);
  const linkIssue = section.issues.find((issue) => issue.code === 'UNSUPPORTED_FACT_LINK');
  assert.deepEqual(JSON.parse(linkIssue.message), heldProviderLink);
  assert.deepEqual(heldIssue.source_span_ids, [section.source_closure.full_section_span_id]);
  assert.deepEqual(linkIssue.source_span_ids, [section.source_closure.full_section_span_id]);
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'FACT_TYPE'
    && assertion.reason === 'FACT_TYPE:PROHIBITED_ACTION').state, 'UNRESOLVED');
  assert.deepEqual(section.model_calls.find((call) => call.call_kind === 'EXTRACTION').response,
    providerResponse);
});

test('duplicate group references hold every ambiguous member and touching link for review', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  let heldProviderProposals;
  let touchingProviderLinks;
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION') return result;
      const duplicated = result.response.groups[0];
      result.response.groups.push({ ...duplicated, subtype_key: 'MODEL_INVENTED_SUBTYPE' });
      const heldRefs = new Set(result.response.proposals
        .filter((proposal) => proposal.group_ref === duplicated.client_ref)
        .map((proposal) => proposal.client_ref));
      heldProviderProposals = structuredClone(result.response.proposals
        .filter((proposal) => heldRefs.has(proposal.client_ref)));
      touchingProviderLinks = structuredClone(result.response.links
        .filter((link) => heldRefs.has(link.from_ref) || heldRefs.has(link.to_ref)));
      return { ...result, raw_response: structuredClone(result.response) };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  const heldIssues = section.issues.filter((issue) => issue.code
    === 'UNSUPPORTED_PROPOSITION_GROUP_MEMBER');
  assert.equal(heldIssues.length, heldProviderProposals.length);
  assert.deepEqual(new Set(heldIssues.map((issue) => JSON.parse(issue.message).statement)),
    new Set(heldProviderProposals.map((proposal) => proposal.statement)));
  assert.equal(section.issues.filter((issue) => issue.code === 'DUPLICATE_PROPOSITION_GROUP').length, 2);
  assert.equal(section.issues.filter((issue) => issue.code === 'UNSUPPORTED_FACT_LINK').length,
    touchingProviderLinks.length);
  assert.equal(section.proposals.some((proposal) => heldProviderProposals
    .some((held) => held.statement === proposal.statement)), false);
  assert.ok(section.proposals.some((proposal) => proposal.validation_status === 'VALID'));
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY'
    && assertion.family_key === 'NO_SHOP').state, 'UNRESOLVED');
});

test('missing extraction coverage becomes source-linked unresolved review work without losing usable facts', async () => {
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
      delete result.response.coverage;
      delete result.response.fact_type_coverage;
      providerResponse = structuredClone(result.response);
      return { ...result, raw_response: providerResponse };
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  assert.ok(section.proposals.some((proposal) => proposal.validation_status === 'VALID'));
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY'
    && assertion.family_key === 'NO_SHOP').state, 'UNRESOLVED');
  const requiredFactTypes = schema.families.find((family) => family.family_key === 'NO_SHOP').required_fact_types;
  const missingIssues = section.issues.filter((issue) => issue.code === 'MODEL_COVERAGE_KEY_OMITTED');
  assert.equal(missingIssues.length, 1 + requiredFactTypes.length);
  assert.deepEqual(new Set(missingIssues.map((issue) => issue.message)), new Set([
    'Required model response field/key was absent: coverage.NO_SHOP',
    ...requiredFactTypes.map((factType) => (
      `Required model response field/key was absent: fact_type_coverage.NO_SHOP.${factType}`
    )),
  ]));
  assert.equal(missingIssues.every((issue) => issue.source_closure_id === section.source_closure.source_closure_id), true);
  assert.equal(missingIssues.every((issue) => (
    issue.source_span_ids.length === 1
    && issue.source_span_ids[0] === section.source_closure.full_section_span_id
  )), true);
  assert.equal(section.coverage.filter((assertion) => assertion.subject_kind === 'FACT_TYPE'
    && assertion.family_key === 'NO_SHOP').every((assertion) => assertion.state === 'UNRESOLVED'), true);
  const extraction = section.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.deepEqual(extraction.response, providerResponse);
  assert.equal(Object.hasOwn(extraction.response, 'coverage'), false);
  assert.equal(Object.hasOwn(extraction.response, 'fact_type_coverage'), false);
});

test('one omitted fact-type coverage key becomes one unresolved source-linked issue', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  const family = schema.families.find((item) => item.family_key === 'NO_SHOP');
  const omittedFactType = family.required_fact_types[0];
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind === 'EXTRACTION') {
        delete result.response.fact_type_coverage.NO_SHOP[omittedFactType];
        return { ...result, raw_response: structuredClone(result.response) };
      }
      return result;
    },
  };

  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  const omission = section.issues.filter((issue) => issue.code === 'MODEL_COVERAGE_KEY_OMITTED');
  assert.equal(omission.length, 1);
  assert.equal(omission[0].message,
    `Required model response field/key was absent: fact_type_coverage.NO_SHOP.${omittedFactType}`);
  assert.deepEqual(omission[0].source_span_ids, [section.source_closure.full_section_span_id]);
  assert.equal(section.coverage.find((assertion) => assertion.subject_id
    === `${node.node_id}:NO_SHOP:${omittedFactType}`).state, 'UNRESOLVED');
  assert.equal(section.coverage.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY'
    && assertion.family_key === 'NO_SHOP').state, 'UNRESOLVED');
});

test('complete provider coverage cannot hide an unsupported mixed-unit period', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema,
    model: createSyntheticConchoModel(), node,
  });
  const noShop = section.coverage.filter((assertion) => assertion.family_key === 'NO_SHOP');
  assert.equal(section.issues.some((issue) => issue.code === 'MODEL_COVERAGE_KEY_OMITTED'), false);
  assert.equal(noShop.find((assertion) => assertion.subject_kind === 'SECTION_FAMILY').state, 'UNRESOLVED');
  const factTypes = noShop.filter((assertion) => assertion.subject_kind === 'FACT_TYPE');
  assert.equal(factTypes.find((assertion) => assertion.reason === 'FACT_TYPE:NOTICE_PERIOD').state, 'UNRESOLVED');
  assert.equal(factTypes.find((assertion) => assertion.reason === 'FACT_TYPE:NOTICE_UPDATE_OBLIGATION').state, 'NOT_FOUND');
  assert.equal(factTypes.filter((assertion) => !['FACT_TYPE:NOTICE_PERIOD', 'FACT_TYPE:NOTICE_UPDATE_OBLIGATION'].includes(assertion.reason))
    .every((assertion) => assertion.state === 'FOUND'), true);
  const held = section.proposals.filter((proposal) => proposal.validation_status === 'INVALID');
  assert.equal(held.length, 1);
  assert.equal(held[0].fact_type, 'NOTICE_PERIOD');
  assert.ok(section.issues.some((issue) => issue.code === 'VALUE_MULTIPLE_PERIOD_LITERALS'));
});

test('explicit invalid coverage values and malformed coverage objects still fail closed', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  for (const [mutate, pattern] of [
    [(response) => { response.coverage = null; }, /MODEL_RESPONSE_SHAPE: extraction:6\.3:coverage/],
    [(response) => { response.fact_type_coverage.NO_SHOP = []; }, /MODEL_RESPONSE_SHAPE: extraction:6\.3:fact_type_coverage\.NO_SHOP/],
    [(response) => { response.coverage.NO_SHOP = 'NOT_PRESENT'; }, /COVERAGE_STATE: 6\.3:NO_SHOP/],
  ]) {
    const base = createSyntheticConchoModel();
    const model = {
      async complete(input) {
        const result = await base.complete(input);
        if (input.call_kind === 'EXTRACTION') mutate(result.response);
        return result;
      },
    };
    await assert.rejects(() => buildAgreementSectionDraft({
      sourceDocument, agreementStructure, legalSchema: schema, model, node,
    }), pattern);
  }
});

test('coverage recovery keeps invalid citation findings and blocks publication while coverage is pending', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const base = createSyntheticConchoModel();
  const model = {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind === 'EXTRACTION') {
        result.response.proposals[0].evidence_quotes[0].quote = 'Not exact source text.';
        delete result.response.coverage;
        delete result.response.fact_type_coverage;
        return { ...result, raw_response: structuredClone(result.response) };
      }
      return result;
    },
  };
  const section = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure, legalSchema: schema, model, node,
  });
  assert.ok(section.proposals.some((proposal) => proposal.validation_status === 'INVALID'));
  assert.ok(section.issues.some((issue) => issue.code === 'PROPOSAL_EVIDENCE_NOT_EXACT'));
  assert.ok(section.issues.some((issue) => issue.code === 'MODEL_COVERAGE_KEY_OMITTED'));

  const analysis = {
    kind: 'draftAnalysis',
    draft_analysis_id: 'coverage-recovery-draft',
    analysis_run_id: 'coverage-recovery-run',
    proposals: section.proposals,
    fact_links: section.links,
    issues: section.issues,
    coverage_assertions: section.coverage,
    spans: section.spans,
    source_closures: [section.source_closure],
    sections: [section.routing],
  };
  let state = initialiseReviewState(analysis);
  const pendingCoverage = state.items.find((item) => item.kind === 'COVERAGE'
    && item.original.state === 'UNRESOLVED');
  assert.ok(pendingCoverage);
  const relationshipKinds = new Set(['EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP']);
  const closureSpans = new Map(analysis.source_closures.map((closure) => [
    closure.source_closure_id,
    new Set([
      ...(closure.spans || []).map((span) => span.span_id),
      ...analysis.spans.filter((span) => (span.source_closure_ids || [])
        .includes(closure.source_closure_id)).map((span) => span.span_id),
    ]),
  ]));
  const invalidRelationshipIds = new Set(state.items.filter((item) => {
    if (!relationshipKinds.has(item.kind)) return false;
    const validSpanIds = closureSpans.get(item.source_closure_id);
    return !validSpanIds || item.source_span_ids.length === 0
      || new Set(item.source_span_ids).size !== item.source_span_ids.length
      || item.source_span_ids.some((spanId) => !validSpanIds.has(spanId));
  }).map((item) => item.item_id));
  assert.ok(invalidRelationshipIds.size > 0);
  for (const item of state.items.filter((candidate) => candidate.item_id !== pendingCoverage.item_id)) {
    state = applyReviewCommand(state, {
      type: 'DECIDE_ITEM', item_id: item.item_id,
      decision: (item.kind === 'PROPOSAL' && item.original.validation_status !== 'VALID')
        || invalidRelationshipIds.has(item.item_id)
        ? 'REJECTED' : 'ACCEPTED',
    }, { analysis, legalSchema: schema });
  }
  assert.ok(state.items.filter((item) => invalidRelationshipIds.has(item.item_id))
    .every((item) => item.decision === 'REJECTED'));
  state = applyReviewCommand(state, {
    type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true,
  }, { analysis, legalSchema: schema });
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis, legalSchema: schema,
  }), /REVIEW_PENDING_ITEMS/);
});
