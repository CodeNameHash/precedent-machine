'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV27, validateContractBundle } = require('../lib/canonical-v2/contract-bundle');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
  MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
  shapeMaterialContractsProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, MAPPING_TABLE_VERSION } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  buildMaterialContractsProducerPrompt,
  MATERIAL_CONTRACT_BUCKET_KINDS,
} = require('../lib/canonical-v2/native-producer/material-contracts-producer-prompt');
const { classifySectionFamily, SECTION_FAMILY_RULE_CLASSIFIED } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const {
  EVIDENCE_SOURCE,
  projectMaterialContractsProductSurfaces,
} = require('../lib/canonical-v2/material-contracts-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');

const CONTRACT = compileFixtureContractV27();
const DEAL_ID = 'material-contracts-family-deal';
const SECTION_REFERENCE = '3.13';
const GROUNDED_QUOTE = 'any supply agreement requiring annual payments by the Company of more than $10,000,000;';
const DEFINITION_QUOTE = 'any supply agreement that is a Specified Customer Contract;';
const SOURCE_TEXT = `Section 3.13 Material Contracts.\n\n${GROUNDED_QUOTE}\n${DEFINITION_QUOTE}\n`;

function criterion(overrides = {}) {
  return {
    section_reference: SECTION_REFERENCE,
    party_making: 'the Company',
    bucket_code: 'SUPPLY',
    threshold_kind: 'USD',
    threshold_value: '$10,000,000',
    cadence_kind: 'ANNUAL',
    definition_cross_references: [],
    quote: GROUNDED_QUOTE,
    ...overrides,
  };
}

async function resolveFixture() {
  const documentHash = sha256Hex(Buffer.from(SOURCE_TEXT, 'utf8'));
  const source = buildImmutableSource({
    sourceBytes: SOURCE_TEXT,
    sourceOccurrenceKey: 'material-contracts-family-test',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${DEAL_ID}`,
    deal_admission_id: sha256Hex(`deal-admission:${DEAL_ID}`),
    source_ordinal: 0,
  });
  const response = {
    material_contract_criteria: [
      criterion(),
      criterion({
        threshold_kind: null,
        threshold_value: null,
        cadence_kind: null,
        definition_cross_references: ['Specified Customer Contract'],
        quote: DEFINITION_QUOTE,
      }),
    ],
    open_world_candidates: [],
  };
  const receipt = await runNativeExtraction({
    source_text: SOURCE_TEXT,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals(response, governedScope.source_text);
      return {
        provider_id: 'material-contracts-test/v1',
        model_id: 'stub-model',
        prompt: 'material-contracts-test-prompt/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution };
}

test('Material Contracts registers its exact contract, producer and title route', async () => {
  assert.equal(validateContractBundle(CONTRACT), true);
  assert.ok(CONTRACT.claim_definitions.some((row) => row.claim_definition_key === 'MATERIAL_CONTRACT_BUCKET_PRESENT'));
  assert.ok(CONTRACT.claim_definitions.some((row) => row.claim_definition_key === 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE'));
  assert.equal(getProducerPromptModule('MATERIAL_CONTRACTS'), buildMaterialContractsProducerPrompt);
  assert.ok(MATERIAL_CONTRACT_BUCKET_KINDS.includes('SUPPLY'));
  assert.equal(MATERIAL_CONTRACT_BUCKET_KINDS.includes('OTHER'), false);
  assert.equal(MAPPING_TABLE_VERSION, 16);
  const classification = await classifySectionFamily({ title: 'Material Contracts' });
  assert.equal(classification.section_family, 'MATERIAL_CONTRACTS');
  assert.equal(classification.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
});

test('the producer and resolver publish grounded buckets and keep unresolved definitions open-world', async () => {
  const { receipt, resolution } = await resolveFixture();
  assert.equal(receipt.resolved_sections[0].section_family, 'MATERIAL_CONTRACTS');
  assert.deepEqual(receipt.compiled_candidates.filter((row) => row.ok).map((row) => row.candidate.claim.claim_definition_key), [
    MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
    MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
    MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
  ]);
  assert.deepEqual(resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(), [
    'MATERIAL_CONTRACT_BUCKET_PRESENT',
    'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE',
  ]);
  assert.equal(resolution.resolved.every((entry) => entry.concept_key === 'REP-T-CONTRACTS'), true);
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].reason, 'MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED');
});

test('governed Material Contracts claims reach Review, Query, Compare and market statistics', async () => {
  const { resolution } = await resolveFixture();
  const projection = projectMaterialContractsProductSurfaces({ resolution, deal_id: DEAL_ID });
  const governedCard = projection.cards.find((card) => card.provision_subtype === 'REP-T-MATERIAL-CONTRACTS');
  assert.equal(governedCard.features.materialContractsBuckets.length, 1);
  assert.deepEqual(governedCard.features.materialContractsBuckets[0], {
    code: 'SUPPLY',
    label: 'Supplier agreements',
    text: GROUNDED_QUOTE,
    quotes: [GROUNDED_QUOTE],
    threshold: '$10,000,000',
    threshold_kind: 'USD',
    cadence_kind: 'ANNUAL',
  });
  const evidenceCard = projection.cards.find((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.ok(evidenceCard);
  assert.deepEqual(evidenceCard.features, {});

  const config = await import('../components/review/table-configs/material-contracts.config.js');
  const rows = config.materialContractsConfig.selectRows({ cards: projection.cards });
  const supplyRow = rows.find((row) => row.code === 'SUPPLY');
  assert.equal(supplyRow.threshold, '$10,000,000');
  const evidenceRow = rows.find((row) => row.marketState === 'OPEN_NATIVE_FIELD');
  assert.ok(evidenceRow);

  const compared = executeDealCompare({
    deal_ids: [DEAL_ID],
    provision_types: ['MATERIAL_CONTRACT'],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: [governedCard],
  });
  const compareField = compared.rows[0].cells[0].key_fields.find((field) => field.field === 'materialContractsBuckets');
  assert.match(compareField.value, /Supplier agreements/);

  const adapter = await import('../lib/market-metrics/adapter.js');
  assert.equal(adapter.resolveMarketMetricRow(evidenceRow, { configId: 'material-contracts' }).resolution, 'evidence_only');
  const specs = adapter.resolveMarketMetricSpecs(supplyRow, { configId: 'material-contracts' });
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', value_usd: 17000000000, metadata: {} }],
    cards: [governedCard],
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow).flatMap((row) => Object.values(row.metrics))
    .some((result) => result.coverage?.observedCount === 1));
});
