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
  'ARTICLE I',
  'CLOSING',
  'Section 1.1 Closing Conditions.',
  'The Closing shall not occur until 20 calendar days after the Information Statement is mailed to the stockholders.',
  'At the Closing, the TRA Waiver shall remain in full force and effect and shall not have been amended, repudiated, revoked or withdrawn.',
  'If this Agreement is terminated, the Company shall pay Parent the Termination Fee.',
  'Following payment of the Termination Fee, Parent and its related parties shall have that fee as their sole and exclusive remedy and shall have no further monetary, equitable or specific-performance remedy against Company and its related parties for claims arising from termination or the transaction, except that liability for fraud survives.',
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
    source_map_id: sha256('schema-extension-source-map'),
  };
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocumentId,
    canonical_text: SOURCE_TEXT,
    canonical_text_sha256: sourceDocumentId,
  });
  const node = substantiveSections(agreementStructure)
    .find((candidate) => candidate.reference === '1.1');
  assert.ok(node);
  return { sourceDocument, agreementStructure, node };
}

function proposal(clientRef, familyKey, subtypeKey, factType, statement, roles, quote) {
  return {
    client_ref: clientRef,
    group_ref: `group-${clientRef}`,
    family_key: familyKey,
    subtype_key: subtypeKey,
    fact_type: factType,
    statement,
    roles,
    value: null,
    evidence_quotes: [{ quote, occurrence: 0 }],
  };
}

function createModel({ omitWaiverQualification = false } = {}) {
  return {
    async complete({ call_kind: callKind, request }) {
      let response;
      if (callKind === 'ROUTING') {
        response = {
          families: ['CLOSING_CONDITIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TERMINATION_FEE'],
          disposition: 'FAMILY_ASSIGNED',
          rationale: 'The section contains closing conditions, a termination fee, and a remedy limitation.',
          deterministic_disagreements: [],
        };
      } else if (callKind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({
          source_span_id: paragraph.source_span_id,
          disposition: 'KNOWN_FAMILY',
          family_keys: ['CLOSING_CONDITIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TERMINATION_FEE'],
          rationale: 'Covered by a routed family.',
        })) };
      } else {
        const waitingQuote = 'The Closing shall not occur until 20 calendar days after the Information Statement is mailed to the stockholders.';
        const waiverQuote = 'At the Closing, the TRA Waiver shall remain in full force and effect and shall not have been amended, repudiated, revoked or withdrawn.';
        const feeQuote = 'If this Agreement is terminated, the Company shall pay Parent the Termination Fee.';
        const remedyQuote = 'Following payment of the Termination Fee, Parent and its related parties shall have that fee as their sole and exclusive remedy and shall have no further monetary, equitable or specific-performance remedy against Company and its related parties for claims arising from termination or the transaction, except that liability for fraud survives.';
        const waiverRoles = {
          LEGAL_ACTOR_OR_SUBJECT: 'TRA Waiver',
          LEGAL_OPERATION: 'shall remain in full force and effect',
          OPERATIVE_OBJECT: 'condition to Closing',
          TEMPORAL_OR_TRIGGER_SCOPE: 'at the Closing',
          QUALIFICATIONS: 'not amended, repudiated, revoked or withdrawn',
        };
        if (omitWaiverQualification) delete waiverRoles.QUALIFICATIONS;
        const proposals = [
          proposal('waiting', 'CLOSING_CONDITIONS', 'GENERAL_CLOSING_CONDITION', 'GENERAL_CLOSING_CONDITION', waitingQuote, {
            LEGAL_ACTOR_OR_SUBJECT: 'Closing',
            LEGAL_OPERATION: 'shall not occur',
            OPERATIVE_OBJECT: 'Information Statement waiting condition',
            TEMPORAL_OR_TRIGGER_SCOPE: 'until 20 calendar days after mailing',
            QUALIFICATIONS: 'mailed to the stockholders',
          }, waitingQuote),
          proposal('waiver', 'CLOSING_CONDITIONS', 'GENERAL_CLOSING_CONDITION', 'GENERAL_CLOSING_CONDITION', waiverQuote, waiverRoles, waiverQuote),
          proposal('fee', 'TERMINATION_FEE', 'FEE_TRIGGER', 'FEE_TRIGGER', feeQuote, {
            payer: 'Company',
            payee: 'Parent',
            payment_action: 'pay the Termination Fee',
            trigger: 'termination of the Agreement',
          }, feeQuote),
          proposal('remedy', 'SPECIFIC_PERFORMANCE_REMEDIES', 'PAID_FEE_EXCLUSIVE_REMEDY', 'REMEDY_LIMITATION', remedyQuote, {
            fee_payment_condition: 'following payment of the Termination Fee',
            remedy_holders: 'Parent and its related parties',
            protected_parties: 'Company and its related parties',
            limited_claim_scope: 'claims arising from termination or the transaction',
            exclusive_remedy_effect: 'the fee is the sole and exclusive remedy',
            barred_remedy_scope: 'no further monetary, equitable or specific-performance remedy',
            surviving_exceptions: 'liability for fraud survives',
          }, remedyQuote),
        ];
        const components = [
          ...request.source_closure.operative,
          ...request.source_closure.chapeau,
          request.source_closure.full_section,
        ];
        for (const item of proposals) {
          const component = components.find((candidate) => (
            candidate.exact_text.includes(item.evidence_quotes[0].quote)
          ));
          assert.ok(component);
          item.evidence_quotes[0].source_span_id = component.span_id;
        }
        const coverage = Object.fromEntries(request.family_contracts.map((family) => (
          [family.family_key, 'FOUND']
        )));
        const factTypeCoverage = Object.fromEntries(request.family_contracts.map((family) => (
          [family.family_key, Object.fromEntries(family.required_fact_types.map((factType) => [
            factType,
            proposals.some((item) => item.family_key === family.family_key
              && item.fact_type === factType) ? 'FOUND' : 'NOT_FOUND',
          ]))]
        )));
        response = {
          proposals,
          groups: proposals.map((item) => ({
            client_ref: item.group_ref,
            family_key: item.family_key,
            subtype_key: item.subtype_key,
          })),
          links: [{
            from_ref: 'remedy',
            to_ref: 'fee',
            relationship_type: 'REQUIRES',
            source_span_ids: [],
          }],
          coverage,
          fact_type_coverage: factTypeCoverage,
        };
      }
      return {
        provider_id: 'SCHEMA_EXTENSION_TEST',
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

async function compile(schema, model = createModel()) {
  const { sourceDocument, agreementStructure, node } = sourceFixture();
  return buildAgreementSectionDraft({
    sourceDocument,
    agreementStructure,
    legalSchema: schema,
    model,
    node,
  });
}

test('the revised schema preserves the source conditions and paid-fee remedy polarity', async () => {
  const result = await compile(readSchema());
  const byFactType = new Map(result.proposals.map((item) => [item.fact_type, item]));
  const generalConditions = result.proposals.filter((item) => (
    item.fact_type === 'GENERAL_CLOSING_CONDITION'
  ));
  assert.equal(generalConditions.length, 2);
  assert.equal(generalConditions.every((item) => item.validation_status === 'VALID'), true);
  assert.equal(generalConditions.every((item) => item.source_span_ids.length === 1), true);
  assert.equal(generalConditions.every((item) => item.state === 'PROPOSED'), true);
  const waiting = generalConditions.find((item) => item.roles.LEGAL_ACTOR_OR_SUBJECT === 'Closing');
  const waiver = generalConditions.find((item) => item.roles.LEGAL_ACTOR_OR_SUBJECT === 'TRA Waiver');
  assert.match(waiting.roles.TEMPORAL_OR_TRIGGER_SCOPE, /20 calendar days/);
  assert.match(waiver.roles.QUALIFICATIONS, /not amended.+revoked.+withdrawn/);

  const remedy = byFactType.get('REMEDY_LIMITATION');
  assert.equal(remedy.validation_status, 'VALID');
  assert.equal(remedy.state, 'PROPOSED');
  assert.equal(remedy.source_span_ids.length, 1);
  assert.match(remedy.roles.fee_payment_condition, /following payment/);
  assert.match(remedy.roles.barred_remedy_scope, /no further.+specific-performance/);
  assert.equal(result.links.some((link) => (
    link.from_proposal_id === remedy.proposal_id
    && link.to_proposal_id === byFactType.get('FEE_TRIGGER').proposal_id
    && link.relationship_type === 'REQUIRES'
  )), true);
});

test('the former schema rejects the new facts and a missing condition role stays unresolved', async () => {
  const current = readSchema();
  const former = structuredClone(current);
  delete former.schema_revision;
  const closing = former.families.find((family) => family.family_key === 'CLOSING_CONDITIONS');
  closing.required_fact_types = closing.required_fact_types.filter((item) => (
    item !== 'GENERAL_CLOSING_CONDITION'
  ));
  closing.subtypes = closing.subtypes.filter((item) => item.subtype_key !== 'GENERAL_CLOSING_CONDITION');
  const remedies = former.families.find((family) => family.family_key === 'SPECIFIC_PERFORMANCE_REMEDIES');
  remedies.required_fact_types = remedies.required_fact_types.filter((item) => item !== 'REMEDY_LIMITATION');
  remedies.subtypes = remedies.subtypes.filter((item) => item.subtype_key !== 'PAID_FEE_EXCLUSIVE_REMEDY');

  const rejected = await compile(former);
  assert.equal(rejected.proposals.some((item) => (
    item.fact_type === 'GENERAL_CLOSING_CONDITION' || item.fact_type === 'REMEDY_LIMITATION'
  )), false);
  assert.equal(rejected.issues.filter((item) => item.code === 'UNSUPPORTED_SUBTYPE').length, 3);

  const missingRole = await compile(current, createModel({ omitWaiverQualification: true }));
  const waiver = missingRole.proposals.find((item) => item.statement.startsWith('At the Closing'));
  assert.equal(waiver.validation_status, 'INVALID');
  assert.ok(missingRole.issues.some((item) => (
    item.code === 'MISSING_REQUIRED_ROLE'
    && item.subtype_key === 'GENERAL_CLOSING_CONDITION'
    && item.message === 'QUALIFICATIONS'
  )));
  assert.equal(missingRole.coverage.some((item) => (
    item.subject_kind === 'ROLE'
    && item.required_role === 'QUALIFICATIONS'
    && item.state === 'UNRESOLVED'
  )), true);
});
