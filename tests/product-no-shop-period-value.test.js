'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const schema = require('../contracts/product/legal-schema.v1.json');
const { parseProductNoShopPeriod } = require('../lib/product/no-shop-period-value');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { substantiveSections } = require('../lib/product/source-context');

test('product no-shop period parser preserves verified hour units without conversion', () => {
  assert.deepEqual(parseProductNoShopPeriod('within forty-eight (48) hours'), {
    outcome: 'RESOLVED', canonical_value: '48', unit: 'HOURS', unit_phrase: 'hours', matched_text: '48',
  });
  assert.equal(parseProductNoShopPeriod('within 48 hours').canonical_value, '48');
});

async function compile({ quotes, unit = 'hours', value = '48', update = false }) {
  const canonicalText = ['ARTICLE V', 'COVENANTS', 'Section 5.3 No Solicitation.', ...quotes].join('\n\n');
  const id = createHash('sha256').update(canonicalText).digest('hex');
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: id, agreement_id: id,
    canonical_text: canonicalText, canonical_text_sha256: id,
    retrieval_url: 'https://example.test/no-shop.htm', final_url: 'https://example.test/no-shop.htm', source_map_id: id,
    filing_accession: '0000000000-00-000000', exhibit_filename: 'no-shop.htm',
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: id, canonical_text: canonicalText, canonical_text_sha256: id });
  const node = substantiveSections(agreementStructure)[0];
  return buildAgreementSectionDraft({ sourceDocument, agreementStructure, node, legalSchema: schema,
    model: { async complete({ call_kind, request }) {
      let response;
      if (call_kind === 'ROUTING') response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'No-shop notice', deterministic_disagreements: [] };
      else if (call_kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'No-shop notice' })) };
      else {
        const factType = update ? 'NOTICE_UPDATE_OBLIGATION' : 'NOTICE_PERIOD';
        const proposal = {
          client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP', subtype_key: factType, fact_type: factType,
          statement: quotes.join(' '), value: update ? null : value,
          roles: update ? { notice_giver: 'Company', notice_recipient: 'Parent', action: 'keep reasonably informed', scope: 'status and material changes' }
            : { notice_giver: 'Company', notice_recipient: 'Parent', notice_trigger: 'receipt of a proposal', period_value: value, period_unit: unit },
          evidence_quotes: quotes.map((quote) => ({ quote, occurrence: 0, source_span_id: request.source_closure.full_section.span_id })),
        };
        response = { proposals: [proposal], groups: [{ client_ref: 'g1', family_key: 'NO_SHOP', subtype_key: factType }], links: [], coverage: { NO_SHOP: 'FOUND' },
          fact_type_coverage: { NO_SHOP: Object.fromEntries(request.family_contracts[0].required_fact_types.map((type) => [type, type === factType ? 'FOUND' : 'NOT_FOUND'])) } };
      }
      return { provider_id: 'TEST', model_id: 'TEST', response, raw_request: request, raw_response: response, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
    } },
  });
}

for (const [name, input, reason] of [
  ['hours remain hours', { quotes: ['Company shall notify Parent within forty-eight (48) hours after receipt of a proposal.'] }, null],
  ['source-written business days', { quotes: ['Company shall notify Parent within four (4) Business Days.'], unit: 'Business Days', value: '4' }, null],
  ['model changes hours to days', { quotes: ['Company shall notify Parent within 48 hours.'], unit: 'days' }, 'VALUE_UNIT_MODEL_MISMATCH'],
  ['different values across quotes', { quotes: ['Company shall notify Parent within 48 hours.', 'The notice period is 72 hours.'] }, 'VALUE_EVIDENCE_CONFLICT'],
  ['same value with different units across quotes', { quotes: ['Company shall notify Parent within 48 hours.', 'The notice period is 48 days.'] }, 'VALUE_EVIDENCE_CONFLICT'],
  ['mixed units in one quote', { quotes: ['Company shall notify Parent within 48 hours or 48 days.'] }, 'VALUE_MULTIPLE_PERIOD_LITERALS'],
  ['two hour periods', { quotes: ['Company shall notify Parent within 48 hours or 72 hours.'] }, 'VALUE_MULTIPLE_PERIOD_LITERALS'],
  ['missing literal', { quotes: ['Company shall notify Parent promptly.'] }, 'VALUE_NO_NUMERIC_LITERAL'],
  ['malformed grouping', { quotes: ['Company shall notify Parent within 4,8 hours.'] }, 'VALUE_MALFORMED_GROUPING'],
  ['decimal cannot be read as integer suffix', { quotes: ['Company shall notify Parent within 1.5 hours.'], value: '5' }, 'VALUE_NON_INTEGER_PERIOD'],
  ['update duty has no invented duration', { quotes: ['Company shall keep Parent reasonably informed of status and material changes.'], update: true }, null],
]) {
  test(`real no-shop compilation: ${name}`, async () => {
    const result = await compile(input);
    assert.equal(result.proposals.length, 1);
    const [proposal] = result.proposals;
    assert.equal(proposal.validation_status, reason ? 'INVALID' : 'VALID');
    if (reason) assert.ok(result.issues.some((issue) => issue.code === reason), JSON.stringify(result.issues));
    else {
      assert.equal(proposal.canonical_value, input.update ? null : input.value || '48');
      if (!input.update) assert.equal(proposal.roles.period_unit, input.unit || 'hours');
    }
  });
}
