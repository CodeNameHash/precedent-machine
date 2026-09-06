'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const { substantiveSections } = require('../lib/product/source-context');

const SENTENCES = {
  exchange: 'No holder of Book-Entry Shares shall be required to deliver a Certificate or an executed letter of transmittal to receive the Merger Consideration.',
  payment: 'Parent shall cause the Surviving Corporation to pay the award holders through its payroll system within five Business Days after Closing.',
  appraisal: 'The Company shall not voluntarily pay, settle or compromise, or offer to settle or compromise, any appraisal demand without Parent consent.',
  control: 'The Paying Agent shall deliver the Merger Consideration to each entitled holder.',
};
const TEXT = ['ARTICLE II', 'CONSIDERATION', 'Section 2.1 Exchange Mechanics.', ...Object.values(SENTENCES)].join('\n\n');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function fixture() {
  const id = sha256(TEXT);
  const raw = Buffer.from(TEXT, 'utf8');
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: id, agreement_id: id,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/collision.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/collision.htm',
    filing_accession: '0000000000-00-000001', exhibit_filename: 'collision.htm',
    raw_sha256: id, raw_bytes_base64: raw.toString('base64'), raw_byte_length: raw.length,
    canonical_text: TEXT, canonical_text_sha256: id, canonical_text_byte_length: raw.length,
    source_map_id: sha256('collision-map'),
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: id, canonical_text: TEXT, canonical_text_sha256: id });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '2.1');
  return { sourceDocument, agreementStructure, node };
}

function roles(actor, operation, object) {
  return {
    LEGAL_ACTOR_OR_SUBJECT: actor,
    LEGAL_OPERATION: operation,
    OPERATIVE_OBJECT: object,
    TEMPORAL_OR_TRIGGER_SCOPE: 'as stated in the cited sentence',
    QUALIFICATIONS: 'as stated in the cited sentence',
  };
}

function model() {
  return { async complete({ call_kind: kind, request }) {
    let response;
    if (kind === 'ROUTING') response = {
      families: ['CONSIDERATION', 'APPRAISAL_DISSENTERS_RIGHTS'], disposition: 'FAMILY_ASSIGNED',
      rationale: 'The section contains exchange and appraisal mechanics.', deterministic_disagreements: [],
    };
    else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({
      source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY',
      family_keys: ['CONSIDERATION', 'APPRAISAL_DISSENTERS_RIGHTS'], rationale: 'Covered.',
    })) };
    else {
      const specs = [
        ['certificate', 'CONSIDERATION', 'EXCHANGE_MECHANICS', 'PER_SHARE_CASH_CONSIDERATION', SENTENCES.exchange, roles('Book-Entry holder', 'need not deliver', 'a Certificate')],
        ['transmittal', 'CONSIDERATION', 'EXCHANGE_MECHANICS', 'PER_SHARE_CASH_CONSIDERATION', SENTENCES.exchange, roles('Book-Entry holder', 'need not deliver', 'a letter of transmittal')],
        ['surviving-pay', 'CONSIDERATION', 'EXCHANGE_MECHANICS', 'PER_SHARE_CASH_CONSIDERATION', SENTENCES.payment, roles('Surviving Corporation', 'shall pay', 'award holders')],
        ['parent-cause', 'CONSIDERATION', 'EXCHANGE_MECHANICS', 'PER_SHARE_CASH_CONSIDERATION', SENTENCES.payment, roles('Parent', 'shall cause payment', 'award holders')],
        ['appraisal-pay', 'APPRAISAL_DISSENTERS_RIGHTS', 'SETTLEMENT_CONSENT', 'APPRAISAL_SETTLEMENT_CONSENT', SENTENCES.appraisal, roles('Company', 'shall not voluntarily pay', 'appraisal demand')],
        ['appraisal-settle', 'APPRAISAL_DISSENTERS_RIGHTS', 'SETTLEMENT_CONSENT', 'APPRAISAL_SETTLEMENT_CONSENT', SENTENCES.appraisal, roles('Company', 'shall not settle or compromise', 'appraisal demand')],
        ['appraisal-umbrella', 'APPRAISAL_DISSENTERS_RIGHTS', 'SETTLEMENT_CONSENT', 'APPRAISAL_SETTLEMENT_CONSENT', SENTENCES.appraisal, roles('Company', 'shall not pay or settle', 'appraisal demand')],
        ['control', 'CONSIDERATION', 'EXCHANGE_MECHANICS', 'PER_SHARE_CASH_CONSIDERATION', SENTENCES.control, roles('Paying Agent', 'shall deliver', 'Merger Consideration')],
      ];
      const components = [...request.source_closure.operative, ...request.source_closure.chapeau, request.source_closure.full_section];
      const proposals = specs.map(([ref, family, subtype, factType, quote, factRoles]) => ({
        client_ref: ref, group_ref: `g-${ref}`, family_key: family, subtype_key: subtype,
        fact_type: factType, statement: `${factRoles.LEGAL_ACTOR_OR_SUBJECT} ${factRoles.LEGAL_OPERATION} ${factRoles.OPERATIVE_OBJECT}.`,
        roles: factRoles, value: null, evidence_quotes: [{ quote,
          source_span_id: components.find((item) => item.exact_text.includes(quote)).span_id, occurrence: 0 }],
      }));
      response = {
        proposals,
        groups: proposals.map((item) => ({ client_ref: item.group_ref, family_key: item.family_key, subtype_key: item.subtype_key })),
        links: [{
          from_ref: 'parent-cause', to_ref: 'surviving-pay', relationship_type: 'REQUIRES',
          source_span_ids: proposals.find((item) => item.client_ref === 'parent-cause')
            .evidence_quotes.map((item) => item.source_span_id),
        }],
        cross_section_links: [],
        coverage: { CONSIDERATION: 'FOUND', APPRAISAL_DISSENTERS_RIGHTS: 'FOUND' },
        fact_type_coverage: {
          CONSIDERATION: { APPRAISAL_RIGHTS_STATUS: 'NOT_FOUND', PER_SHARE_CASH_CONSIDERATION: 'FOUND' },
          APPRAISAL_DISSENTERS_RIGHTS: { APPRAISAL_SETTLEMENT_CONSENT: 'FOUND', APPRAISAL_WITHDRAWAL_RECONVERSION: 'NOT_FOUND' },
        },
      };
    }
    return { provider_id: 'TEST', model_id: 'TEST/V1', raw_request: request, raw_response: response,
      response, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
  } };
}

async function compile() {
  const source = fixture();
  return { ...source, result: await buildAgreementSectionDraft({ ...source, legalSchema, model: model() }) };
}

test('real collision shapes are retained as deterministic held candidates without cross-binding links', async () => {
  const first = await compile();
  const second = await compile();
  assert.deepEqual(first.result, second.result);
  assert.equal(first.result.proposals.length, 8);
  assert.equal(new Set(first.result.proposals.map((item) => item.fact_occurrence_id)).size, 8);
  assert.equal(first.result.proposals.filter((item) => item.validation_status === 'INVALID').length, 7);
  const issues = first.result.issues.filter((item) => item.code === 'DUPLICATE_FACT_OCCURRENCE');
  assert.equal(issues.length, 3);
  for (const issue of issues) {
    const detail = JSON.parse(issue.message);
    assert.match(detail.shared_fact_occurrence_id, /^[0-9a-f]{64}$/);
    assert.ok(detail.candidates.length >= 2);
    assert.ok(issue.source_closure_id);
    assert.ok(issue.source_span_ids.length > 0);
  }
  const control = first.result.proposals.find((item) => item.statement.startsWith('Paying Agent'));
  assert.equal(control.validation_status, 'VALID');
  assert.equal(control.fact_occurrence_id, contentId('PRODUCT_FACT_OCCURRENCE/V1', {
    source_document_id: first.sourceDocument.source_document_id,
    family_key: control.family_key,
    subtype_key: control.subtype_key,
    fact_type: control.fact_type,
    source_span_ids: control.source_span_ids,
  }));
  const cause = first.result.proposals.find((item) => item.statement.startsWith('Parent'));
  const pay = first.result.proposals.find((item) => item.statement.startsWith('Surviving Corporation'));
  assert.equal(first.result.links.length, 1);
  assert.equal(first.result.links[0].from_proposal_id, cause.proposal_id);
  assert.equal(first.result.links[0].to_proposal_id, pay.proposal_id);
});

test('lawyer review can edit or reject collided candidates and resolve every collision hold', async () => {
  const { sourceDocument, agreementStructure, result } = await compile();
  const analysis = {
    kind: 'draftAnalysis', draft_analysis_id: sha256('collision-draft'), analysis_run_id: crypto.randomUUID(),
    agreement_structure: agreementStructure, proposals: result.proposals, proposition_groups: result.groups,
    fact_links: result.links, issues: result.issues, coverage_assertions: [], sections: [],
    source_closures: [result.source_closure], spans: result.spans, source_document: sourceDocument,
  };
  let state = initialiseReviewState(analysis);
  const invalid = state.items.filter((item) => item.kind === 'PROPOSAL' && item.original.validation_status === 'INVALID');
  const retained = invalid.filter((item) => (
    item.original.statement.startsWith('Parent')
      || item.original.statement.startsWith('Surviving Corporation')
  ));
  assert.equal(retained.length, 2);
  for (const item of retained) state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED', statement: item.original.statement,
    roles: item.original.roles, source_span_ids: item.original.source_span_ids,
  }, { analysis, legalSchema });
  for (const item of invalid.filter((candidate) => !retained.includes(candidate))) state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED',
  }, { analysis, legalSchema });
  const relationship = state.items.find((item) => item.kind === 'RELATIONSHIP');
  state = applyReviewCommand(state, {
    type: 'DECIDE_ITEM', item_id: relationship.item_id, decision: 'ACCEPTED',
  }, { analysis, legalSchema });
  for (const item of state.items.filter((entry) => entry.kind === 'ISSUE' && entry.original.code === 'DUPLICATE_FACT_OCCURRENCE')) {
    state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  }
  assert.equal(state.items.filter((item) => item.kind === 'ISSUE' && item.decision === 'PENDING').length, 0);
  assert.deepEqual(retained.map((item) => state.items.find((entry) => entry.item_id === item.item_id).decision),
    ['EDITED', 'EDITED']);
  assert.equal(state.items.find((item) => item.item_id === relationship.item_id).decision, 'ACCEPTED');
});

module.exports = { compileCollisionFixture: compile, collisionSourceFixture: fixture };
