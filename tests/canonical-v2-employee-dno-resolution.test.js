'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV30 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeGovernedEmployeeMattersProposals, shapeGovernedDnoProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, materialityFor } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

function card(family, id) { return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', family, 'corpus-cards.json'))).cards.find((entry) => entry.id === id); }
const EMPLOYEE = card('employee-matters-live-run', '470c560c-1534-452c-890a-f9403bb189b5');
const DNO = card('dno-live-run', '01d091dc-03b3-4e25-8551-0ca5ecea3a12');
const BUNDLE = compileFixtureContractV30();
async function replay({ source, reference, parsed, shape, dealKey }) {
  const receipt = await runNativeExtraction({ source_text: source, document_hash: sha256Hex(Buffer.from(source)), section_references: [reference], contract_bundle: BUNDLE, definitions: {}, section_family_classifier: async () => ({ declined: true }), provider: async ({ governed_scope }) => ({ provider_id: 'recorded-employee-dno-replay/v1', model_id: 'recorded-fixture', prompt: 'recorded-employee-dno-replay/v1', ...shape(parsed, governed_scope.source_text) }) });
  return { receipt, resolution: resolveCandidates({ run_receipt: receipt, contract_vocabulary: BUNDLE, admitted_source_context: buildIdentityAdmittedSourceContext(source, { dealKey, dealAdmissionId: sha256Hex(`M3-${dealKey}`) }) }) };
}
test('recorded employee fixture replays a governed benefits-continuation period', async () => {
  const quote = 'for a period of twelve\n (12) months after the Effective Time'; assert.ok(EMPLOYEE.region_full_text.includes(quote));
  const { receipt, resolution } = await replay({ source: EMPLOYEE.region_full_text, reference: '7.03', dealKey: EMPLOYEE.deal_id, shape: shapeGovernedEmployeeMattersProposals, parsed: { employee_matters_assertions: [{ section_reference: '7.03', assertion_kind: 'CONTINUATION_PERIOD', comp_item: null, standard_kind: null, aggregation: null, benchmark: null, period_term: null, relief_kind: null, quote }], open_world_candidates: [] } });
  assert.equal(receipt.resolved_sections[0].section_family, 'EMPLOYEE_MATTERS'); assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'BENEFITS_CONTINUATION_PERIOD_MONTHS'); assert.equal(resolution.resolved[0].claim.canonical_value, '12');
});
test('recorded D&O fixture replays a governed indemnification continuation', async () => {
  const quote = 'it will indemnify and hold harmless, to the fullest extent permitted under applicable Laws'; assert.ok(DNO.region_full_text.includes(quote));
  const { receipt, resolution } = await replay({ source: DNO.region_full_text, reference: '4.13', dealKey: DNO.deal_id, shape: shapeGovernedDnoProposals, parsed: { dno_assertions: [{ section_reference: '4.13', assertion_kind: 'INDEM_CONTINUATION', cap_basis: null, cap_term: null, schedule_reference_phrase: null, quote }], open_world_candidates: [] } });
  assert.equal(receipt.resolved_sections[0].section_family, 'DNO_INDEMNIFICATION'); assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'INDEMNIFICATION_CONTINUATION'); assert.equal(resolution.resolved[0].concept_key, 'DNO-INDEM');
});
test('approved Employee and D&O ranks are fixed', () => { assert.equal(materialityFor({ conceptKey: 'COV-EMPLOYEE' }).rank, 82); assert.equal(materialityFor({ conceptKey: 'DNO-TAIL' }).rank, 85); });
