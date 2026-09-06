'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { validateLegalSchema } = require('../lib/product/legal-schema');
const { substantiveSections } = require('../lib/product/source-context');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_TEXT = [
  'ARTICLE VII',
  'TERMINATION',
  'Section 7.1 Termination Rights.',
  'Either party may terminate this Agreement by mutual written consent.',
  'Section 7.2 Effect of Termination.',
  'Upon a proper termination under Section 7.1, the terminating party shall give written notice to the other party specifying the provision relied upon and the basis in reasonable detail.',
  'This Agreement shall become void and have no further force or effect, except that Sections 7.2 and 7.3 shall survive termination.',
  'There shall be no liability or obligation on the part of Parent, Merger Sub, the Company or their Representatives, except with respect to Sections 7.2 and 7.3.',
  'Subject to Section 7.3, nothing shall relieve a party from liabilities or damages resulting from a Willful and Material Breach before termination, and those damages are not limited to expenses or out-of-pocket costs and, when payable by Parent or Merger Sub, may include lost transaction benefits and stockholder premium.',
  'Subject to Section 7.3, the aggrieved party shall be entitled to all remedies available at law or in equity.',
  'Section 7.3 Fees and Expenses.',
  'Each party shall bear its own expenses except as expressly provided in this Agreement.',
].join('\n\n');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function readSchema() {
  return validateLegalSchema(JSON.parse(fs.readFileSync(
    path.join(ROOT, 'contracts/product/legal-schema.v1.json'),
    'utf8',
  )));
}

function sourceFixture() {
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
    source_map_id: sha256('termination-effect-source-map'),
  };
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocumentId,
    canonical_text: SOURCE_TEXT,
    canonical_text_sha256: sourceDocumentId,
  });
  const node = substantiveSections(agreementStructure)
    .find((candidate) => candidate.reference === '7.2');
  assert.ok(node);
  return { sourceDocument, agreementStructure, node };
}

const EFFECTS = [
  {
    ref: 'notice',
    subtype: 'TERMINATION_NOTICE',
    quote: 'Upon a proper termination under Section 7.1, the terminating party shall give written notice to the other party specifying the provision relied upon and the basis in reasonable detail.',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'the terminating party',
      LEGAL_OPERATION: 'shall give written notice',
      OPERATIVE_OBJECT: 'notice specifying the provision relied upon and the basis in reasonable detail',
      TEMPORAL_OR_TRIGGER_SCOPE: 'upon a proper termination under Section 7.1',
      QUALIFICATIONS: 'written notice to the other party',
    },
  },
  {
    ref: 'voiding',
    subtype: 'AGREEMENT_VOIDING',
    quote: 'This Agreement shall become void and have no further force or effect',
    evidenceQuote: 'This Agreement shall become void and have no further force or effect, except that Sections 7.2 and 7.3 shall survive termination.',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'This Agreement',
      LEGAL_OPERATION: 'shall become void and have no further force or effect',
      OPERATIVE_OBJECT: 'the continuing force and effect of this Agreement',
      TEMPORAL_OR_TRIGGER_SCOPE: 'upon termination',
      QUALIFICATIONS: 'except that Sections 7.2 and 7.3 shall survive termination',
    },
  },
  {
    ref: 'survival',
    subtype: 'PROVISION_SURVIVAL',
    quote: 'except that Sections 7.2 and 7.3 shall survive termination',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'Sections 7.2 and 7.3',
      LEGAL_OPERATION: 'shall survive',
      OPERATIVE_OBJECT: 'termination of this Agreement',
      TEMPORAL_OR_TRIGGER_SCOPE: 'after termination',
      QUALIFICATIONS: 'except that Sections 7.2 and 7.3 shall survive termination',
    },
  },
  {
    ref: 'release',
    subtype: 'LIABILITY_RELEASE',
    quote: 'There shall be no liability or obligation on the part of Parent, Merger Sub, the Company or their Representatives',
    evidenceQuote: 'There shall be no liability or obligation on the part of Parent, Merger Sub, the Company or their Representatives, except with respect to Sections 7.2 and 7.3.',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'Parent, Merger Sub, the Company or their Representatives',
      LEGAL_OPERATION: 'shall have no liability or obligation',
      OPERATIVE_OBJECT: 'liability or obligation after termination',
      TEMPORAL_OR_TRIGGER_SCOPE: 'after termination',
      QUALIFICATIONS: 'except with respect to Sections 7.2 and 7.3',
    },
  },
  {
    ref: 'breach',
    subtype: 'WILLFUL_MATERIAL_BREACH_CARVEOUT',
    quote: 'Subject to Section 7.3, nothing shall relieve a party from liabilities or damages resulting from a Willful and Material Breach before termination, and those damages are not limited to expenses or out-of-pocket costs and, when payable by Parent or Merger Sub, may include lost transaction benefits and stockholder premium.',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'a party responsible for a Willful and Material Breach',
      LEGAL_OPERATION: 'shall not be relieved from liabilities or damages',
      OPERATIVE_OBJECT: 'liabilities or damages resulting from a Willful and Material Breach',
      TEMPORAL_OR_TRIGGER_SCOPE: 'a Willful and Material Breach before termination',
      QUALIFICATIONS: 'Subject to Section 7.3',
      DAMAGES_SCOPE: 'not limited to expenses or out-of-pocket costs; when payable by Parent or Merger Sub, may include lost transaction benefits and stockholder premium',
    },
  },
  {
    ref: 'remedies',
    subtype: 'REMEDY_ENTITLEMENT',
    quote: 'Subject to Section 7.3, the aggrieved party shall be entitled to all remedies available at law or in equity.',
    roles: {
      LEGAL_ACTOR_OR_SUBJECT: 'the aggrieved party',
      LEGAL_OPERATION: 'shall be entitled to',
      OPERATIVE_OBJECT: 'all remedies available at law or in equity',
      TEMPORAL_OR_TRIGGER_SCOPE: 'following a Willful and Material Breach before termination',
      QUALIFICATIONS: 'Subject to Section 7.3',
    },
  },
];

function createModel(observed = {}) {
  return {
    async complete({ call_kind: callKind, prompt_version: promptVersion, request }) {
      let response;
      if (callKind === 'ROUTING') {
        response = {
          families: ['TERMINATION'],
          disposition: 'FAMILY_ASSIGNED',
          rationale: 'The section states distinct effects of termination.',
          deterministic_disagreements: (request.deterministic_family_evidence || [])
            .filter((evidence) => evidence.section_family !== 'TERMINATION')
            .map((evidence) => ({
              family_key: evidence.section_family,
              reason: 'The fixture isolates termination effects and does not state a fee amount or fee trigger.',
            })),
        };
      } else if (callKind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({
          source_span_id: paragraph.source_span_id,
          disposition: 'KNOWN_FAMILY',
          family_keys: ['TERMINATION'],
          rationale: 'The paragraph states a termination effect.',
        })) };
      } else {
        observed.promptVersion = promptVersion;
        observed.request = request;
        const components = [
          ...request.source_closure.operative,
          ...request.source_closure.chapeau,
          request.source_closure.full_section,
        ];
        const proposals = EFFECTS.map((effect) => {
          const evidenceQuote = effect.evidenceQuote || effect.quote;
          const component = components.find((candidate) => candidate.exact_text.includes(evidenceQuote));
          assert.ok(component);
          return {
            client_ref: effect.ref,
            group_ref: `group-${effect.ref}`,
            family_key: 'TERMINATION',
            subtype_key: effect.subtype,
            fact_type: 'TERMINATION_EFFECT',
            statement: effect.quote,
            roles: effect.roles,
            value: null,
            evidence_quotes: [{
              quote: evidenceQuote,
              source_span_id: component.span_id,
              occurrence: 0,
            }],
          };
        });
        response = {
          proposals,
          groups: proposals.map((proposal) => ({
            client_ref: proposal.group_ref,
            family_key: proposal.family_key,
            subtype_key: proposal.subtype_key,
          })),
          links: [
            {
              from_ref: 'survival',
              to_ref: 'voiding',
              relationship_type: 'EXCEPTS',
              source_span_ids: [],
            },
            {
              from_ref: 'breach',
              to_ref: 'release',
              relationship_type: 'EXCEPTS',
              source_span_ids: [],
            },
            {
              from_ref: 'remedies',
              to_ref: 'breach',
              relationship_type: 'REQUIRES',
              source_span_ids: [],
            },
          ],
          cross_section_links: [],
          coverage: { TERMINATION: 'FOUND' },
          fact_type_coverage: {
            TERMINATION: {
              TERMINATION_RIGHT: 'NOT_FOUND',
              OUTSIDE_DATE: 'NOT_FOUND',
              CURE_OR_NOTICE_PERIOD: 'NOT_FOUND',
              TERMINATION_EFFECT: 'FOUND',
            },
          },
        };
      }
      return {
        provider_id: 'TERMINATION_EFFECT_TEST',
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

async function compile(schema, model) {
  const { sourceDocument, agreementStructure, node } = sourceFixture();
  return buildAgreementSectionDraft({
    sourceDocument,
    agreementStructure,
    legalSchema: schema,
    model,
    node,
  });
}

test('the revised termination contract compiles each termination effect without forcing a termination grant or specific performance', async () => {
  const observed = {};
  const result = await compile(readSchema(), createModel(observed));
  assert.equal(observed.promptVersion, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V6');
  assert.equal(observed.request.schema_revision, 'LEGAL_SCHEMA/V1.2');
  assert.deepEqual(
    observed.request.response_contract.allowed_fact_types_by_family.TERMINATION,
    ['TERMINATION_RIGHT', 'OUTSIDE_DATE', 'CURE_OR_NOTICE_PERIOD', 'TERMINATION_EFFECT'],
  );
  assert.deepEqual(
    result.proposals.map((proposal) => proposal.subtype_key).sort(),
    EFFECTS.map((effect) => effect.subtype).sort(),
  );
  assert.equal(result.proposals.every((proposal) => (
    proposal.fact_type === 'TERMINATION_EFFECT'
      && proposal.validation_status === 'VALID'
      && proposal.state === 'PROPOSED'
      && proposal.source_span_ids.length === 1
  )), true);
  assert.equal(result.proposals.some((proposal) => (
    proposal.fact_type === 'TERMINATION_RIGHT'
      || proposal.family_key === 'SPECIFIC_PERFORMANCE_REMEDIES'
  )), false);

  const bySubtype = new Map(result.proposals.map((proposal) => [proposal.subtype_key, proposal]));
  assert.match(bySubtype.get('WILLFUL_MATERIAL_BREACH_CARVEOUT').roles.QUALIFICATIONS, /Section 7\.3/);
  assert.match(bySubtype.get('WILLFUL_MATERIAL_BREACH_CARVEOUT').roles.DAMAGES_SCOPE, /lost transaction benefits/);
  assert.match(bySubtype.get('WILLFUL_MATERIAL_BREACH_CARVEOUT').roles.DAMAGES_SCOPE, /when payable by Parent or Merger Sub/);
  assert.match(bySubtype.get('REMEDY_ENTITLEMENT').roles.OPERATIVE_OBJECT, /law or in equity/);
  assert.equal(result.links.some((link) => (
    link.from_proposal_id === bySubtype.get('PROVISION_SURVIVAL').proposal_id
      && link.to_proposal_id === bySubtype.get('AGREEMENT_VOIDING').proposal_id
      && link.relationship_type === 'EXCEPTS'
  )), true);
  assert.equal(result.links.some((link) => (
    link.from_proposal_id === bySubtype.get('WILLFUL_MATERIAL_BREACH_CARVEOUT').proposal_id
      && link.to_proposal_id === bySubtype.get('LIABILITY_RELEASE').proposal_id
      && link.relationship_type === 'EXCEPTS'
  )), true);
});

test('the former termination contract rejects termination effects instead of misclassifying them', async () => {
  const former = structuredClone(readSchema());
  former.schema_revision = 'LEGAL_SCHEMA/V1.1';
  const termination = former.families.find((family) => family.family_key === 'TERMINATION');
  termination.required_fact_types = termination.required_fact_types.filter((factType) => (
    factType !== 'TERMINATION_EFFECT'
  ));
  termination.subtypes = termination.subtypes.filter((subtype) => (
    !EFFECTS.some((effect) => effect.subtype === subtype.subtype_key)
  ));

  const result = await compile(former, createModel());
  assert.equal(result.proposals.length, 0);
  assert.equal(result.issues.filter((issue) => issue.code === 'UNSUPPORTED_SUBTYPE').length, 6);
  assert.equal(result.proposals.some((proposal) => (
    proposal.fact_type === 'TERMINATION_RIGHT'
      || proposal.family_key === 'SPECIFIC_PERFORMANCE_REMEDIES'
  )), false);
});
