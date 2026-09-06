'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const {
  buildAgreementDraft, validateAgreementDraft,
} = require('../lib/product/agreement-draft');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_TEXT = [
  'ARTICLE V',
  'COVENANTS',
  'Section 5.3 No Solicitation.',
  'The Company shall not solicit a Competing Proposal.',
  'The Company Board may change its recommendation for a Superior Proposal.',
].join('\n\n');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function frozenV11Schema() {
  const schema = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'contracts/product/legal-schema.v1.json'),
    'utf8',
  ));
  schema.schema_revision = 'LEGAL_SCHEMA/V1.1';
  const termination = schema.families.find((family) => family.family_key === 'TERMINATION');
  termination.required_fact_types = termination.required_fact_types
    .filter((factType) => factType !== 'TERMINATION_EFFECT');
  termination.subtypes = termination.subtypes.filter((subtype) => ![
    'TERMINATION_NOTICE',
    'AGREEMENT_VOIDING',
    'PROVISION_SURVIVAL',
    'LIABILITY_RELEASE',
    'WILLFUL_MATERIAL_BREACH_CARVEOUT',
    'REMEDY_ENTITLEMENT',
  ].includes(subtype.subtype_key));
  return schema;
}

function fixture() {
  const sourceDocumentId = sha256(SOURCE_TEXT);
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1',
    source_document_id: sourceDocumentId,
    agreement_id: sourceDocumentId,
    retrieval_url: 'https://example.test/agreement.htm',
    final_url: 'https://example.test/agreement.htm',
    filing_accession: '0000000000-00-000000',
    exhibit_filename: 'agreement.htm',
    canonical_text: SOURCE_TEXT,
    canonical_text_sha256: sourceDocumentId,
    source_map_id: sha256('disallowed-link-source-map'),
  };
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocumentId,
    canonical_text: SOURCE_TEXT,
    canonical_text_sha256: sourceDocumentId,
  });
  return { sourceDocument, agreementStructure };
}

function model() {
  return {
    async complete({ call_kind: callKind, request }) {
      let response;
      if (callKind === 'ROUTING') {
        response = {
          families: ['NO_SHOP'],
          disposition: 'FAMILY_ASSIGNED',
          rationale: 'The section contains a no-shop covenant and recommendation-change right.',
          deterministic_disagreements: (request.deterministic_family_evidence || [])
            .filter((evidence) => evidence.section_family !== 'NO_SHOP')
            .map((evidence) => ({
              family_key: evidence.section_family,
              reason: 'The fixture contains no fact in this family.',
            })),
        };
      } else if (callKind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({
          source_span_id: paragraph.source_span_id,
          disposition: 'KNOWN_FAMILY',
          family_keys: ['NO_SHOP'],
          rationale: 'The paragraph belongs to the no-shop family.',
        })) };
      } else {
        const components = [
          ...request.source_closure.operative,
          ...request.source_closure.chapeau,
          request.source_closure.full_section,
        ];
        const evidence = (quote) => {
          const component = components.find((candidate) => candidate.exact_text.includes(quote));
          assert.ok(component);
          return [{ quote, source_span_id: component.span_id, occurrence: 0 }];
        };
        response = {
          groups: [
            { client_ref: 'prohibition-group', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' },
            { client_ref: 'change-group', family_key: 'NO_SHOP', subtype_key: 'RECOMMENDATION_CHANGE' },
          ],
          proposals: [
            {
              client_ref: 'prohibition',
              group_ref: 'prohibition-group',
              family_key: 'NO_SHOP',
              subtype_key: 'PROHIBITED_ACTION',
              fact_type: 'PROHIBITED_ACTION',
              statement: 'The Company shall not solicit a Competing Proposal.',
              roles: { covenant_obligor: 'Company', prohibited_action: 'solicit a Competing Proposal' },
              value: null,
              evidence_quotes: evidence('The Company shall not solicit a Competing Proposal.'),
            },
            {
              client_ref: 'change',
              group_ref: 'change-group',
              family_key: 'NO_SHOP',
              subtype_key: 'RECOMMENDATION_CHANGE',
              fact_type: 'RECOMMENDATION_CHANGE',
              statement: 'The Company Board may change its recommendation for a Superior Proposal.',
              roles: {
                decision_maker: 'Company Board',
                action: 'change its recommendation',
                permitted_trigger: 'a Superior Proposal',
              },
              value: null,
              evidence_quotes: evidence('The Company Board may change its recommendation for a Superior Proposal.'),
            },
          ],
          links: [{
            from_ref: 'change',
            to_ref: 'prohibition',
            relationship_type: 'QUALIFIES',
            source_span_ids: [],
          }],
          cross_section_links: [],
          coverage: { NO_SHOP: 'FOUND' },
          fact_type_coverage: { NO_SHOP: {
            PROHIBITED_ACTION: 'FOUND',
            EXCEPTION_PREREQUISITE: 'NOT_FOUND',
            NOTICE_PERIOD: 'NOT_FOUND',
            NOTICE_UPDATE_OBLIGATION: 'NOT_FOUND',
            INITIAL_MATCH_PERIOD: 'NOT_FOUND',
            SUBSEQUENT_MATCH_PERIOD: 'NOT_FOUND',
            RECOMMENDATION_CHANGE: 'FOUND',
          } },
        };
      }
      return {
        provider_id: 'DISALLOWED_LINK_TEST',
        model_id: 'SYNTHETIC_MODEL/V1',
        raw_request: request,
        raw_response: response,
        response,
        input_tokens: 1,
        output_tokens: 1,
        cost_microusd: 0,
        duration_ms: 1,
      };
    },
  };
}

test('a frozen V1.1 draft retains a disallowed link only with its exact open finding', async () => {
  const legalSchema = frozenV11Schema();
  const { sourceDocument, agreementStructure } = fixture();
  const draft = await buildAgreementDraft({
    sourceDocument,
    agreementStructure,
    legalSchema,
    model: model(),
  });
  const link = draft.fact_links[0];
  const from = draft.proposals.find((proposal) => proposal.proposal_id === link.from_proposal_id);
  const finding = draft.issues.find((issue) => issue.code === 'RELATIONSHIP_NOT_ALLOWED');

  assert.equal(draft.legal_schema_revision, 'LEGAL_SCHEMA/V1.1');
  assert.equal(link.relationship_type, 'QUALIFIES');
  assert.deepEqual({
    kind: finding.kind,
    code: finding.code,
    message: finding.message,
    family_key: finding.family_key,
    subtype_key: finding.subtype_key,
    structure_node_id: finding.structure_node_id,
    proposal_id: finding.proposal_id,
    state: finding.state,
  }, {
    kind: 'VALIDATION',
    code: 'RELATIONSHIP_NOT_ALLOWED',
    message: link.relationship_type,
    family_key: from.family_key,
    subtype_key: from.subtype_key,
    structure_node_id: from.structure_node_id,
    proposal_id: from.proposal_id,
    state: 'OPEN',
  });
  assert.equal(validateAgreementDraft(draft, {
    sourceDocument, agreementStructure, legalSchema,
  }), draft);

  const analysis = { ...draft, kind: 'draftAnalysis' };
  const review = initialiseReviewState(analysis, {
    clock: () => new Date('2026-09-05T12:00:00Z'),
  });
  const relationship = review.items.find((item) => item.source_id === link.fact_link_id);
  assert.throws(() => applyReviewCommand(review, {
    type: 'DECIDE_ITEM', item_id: relationship.item_id, decision: 'ACCEPTED',
  }, {
    analysis,
    legalSchema,
    clock: () => new Date('2026-09-05T12:01:00Z'),
  }), /REVIEW_RELATIONSHIP_TYPE/);

  const withoutFinding = structuredClone(draft);
  withoutFinding.issues = withoutFinding.issues
    .filter((issue) => issue.issue_id !== finding.issue_id);
  assert.throws(() => validateAgreementDraft(withoutFinding, {
    sourceDocument, agreementStructure, legalSchema,
  }), /DRAFT_FACT_LINK/);

  const wrongFinding = structuredClone(draft);
  wrongFinding.issues = wrongFinding.issues.map((issue) => (
    issue.issue_id === finding.issue_id ? { ...issue, proposal_id: link.to_proposal_id } : issue
  ));
  assert.throws(() => validateAgreementDraft(wrongFinding, {
    sourceDocument, agreementStructure, legalSchema,
  }), /DRAFT_NESTED_IDENTITY/);
});
