'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV28,
  GENERAL_COVENANT_CODES_V1,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  GENERAL_COVENANT_CLAIM_KEYS,
  shapeGeneralCovenantsProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE,
  MAPPING_TABLE_VERSION,
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  GENERAL_COVENANT_CODES,
  buildGeneralCovenantsProducerPrompt,
} = require('../lib/canonical-v2/native-producer/general-covenants-producer-prompt');
const {
  GENERAL_COVENANT_FOLLOW_ON_OWNERS,
} = require('../lib/canonical-v2/p0-product-surface-routing');
const {
  SECTION_FAMILY_RULE_CLASSIFIED,
  classifySectionFamily,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');
const {
  EVIDENCE_SOURCE,
  projectGeneralCovenantsProductSurfaces,
} = require('../lib/canonical-v2/general-covenants-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');

const CONTRACT = compileFixtureContractV28();
const DEAL_ID = 'general-covenants-family-deal';
const SECTION_REFERENCE = '6.11';
const GROUNDED_QUOTE = 'The Company shall provide Parent reasonable access to information, books and records during normal business hours.';
const DEFINITION_QUOTE = 'The Company shall provide access to information in accordance with the Access Protocol.';
const UNKNOWN_CODE_QUOTE = 'The Company shall operate a new covenant process.';
const SOURCE_TEXT = `Section 6.11 Access to Information.\n\n${GROUNDED_QUOTE}\n${DEFINITION_QUOTE}\n${UNKNOWN_CODE_QUOTE}\n`;

async function resolveFixture() {
  const source = buildImmutableSource({
    sourceBytes: SOURCE_TEXT,
    sourceOccurrenceKey: 'general-covenants-family-test',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${DEAL_ID}`,
    deal_admission_id: sha256Hex(`deal-admission:${DEAL_ID}`),
    source_ordinal: 0,
  });
  const response = {
    general_covenants: [
      {
        section_reference: SECTION_REFERENCE,
        covenant_obligor: 'The Company',
        covenant_code: 'COV-ACCESS',
        definition_cross_references: [],
        quote: GROUNDED_QUOTE,
      },
      {
        section_reference: SECTION_REFERENCE,
        covenant_obligor: 'The Company',
        covenant_code: 'COV-ACCESS',
        definition_cross_references: ['Access Protocol'],
        quote: DEFINITION_QUOTE,
      },
      {
        section_reference: SECTION_REFERENCE,
        covenant_obligor: 'The Company',
        covenant_code: 'COV-NEW',
        definition_cross_references: [],
        quote: UNKNOWN_CODE_QUOTE,
      },
    ],
    open_world_candidates: [],
  };
  const receipt = await runNativeExtraction({
    source_text: SOURCE_TEXT,
    document_hash: sha256Hex(Buffer.from(SOURCE_TEXT, 'utf8')),
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeGeneralCovenantsProposals(response, governedScope.source_text);
      return {
        provider_id: 'general-covenants-test/v1',
        model_id: 'stub-model',
        prompt: 'general-covenants-test-prompt/v1',
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

test('General Covenants registers the exact 18-code contract, producer and title route', async () => {
  assert.equal(validateContractBundle(CONTRACT), true);
  assert.deepEqual(GENERAL_COVENANT_CODES, GENERAL_COVENANT_CODES_V1);
  assert.deepEqual(GENERAL_COVENANT_CODES, Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS).sort());
  assert.equal(getProducerPromptModule('GENERAL_COVENANTS'), buildGeneralCovenantsProducerPrompt);
  const prompt = buildGeneralCovenantsProducerPrompt({
    source_text: GROUNDED_QUOTE,
    governed_scope: { section_reference: SECTION_REFERENCE },
  });
  assert.match(prompt.messages[0].content, /Parent stockholder approval and Merger Sub stockholder approval are separate/);
  assert.match(prompt.messages[0].content, /Never encode either as COV-CONSENT or COV-MERGESUB/);
  assert.equal(MAPPING_TABLE_VERSION, 20);
  assert.equal(new Set(Object.values(GENERAL_COVENANT_CLAIM_KEYS)).size, 18);
  const mappingRows = GENERIC_CLAIM_KEY_RESOLUTION_TABLE.filter(
    (row) => Object.values(GENERAL_COVENANT_CLAIM_KEYS).includes(row.generic_claim_key),
  );
  assert.deepEqual(mappingRows.map((row) => row.concept_key).sort(), GENERAL_COVENANT_CODES);
  const classification = await classifySectionFamily({ title: 'Access to Information' });
  assert.equal(classification.section_family, 'GENERAL_COVENANTS');
  assert.equal(classification.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
});

test('the producer and resolver publish an exact code and keep unresolved definitions and unknown codes open-world', async () => {
  const { receipt, resolution } = await resolveFixture();
  assert.equal(receipt.resolved_sections[0].section_family, 'GENERAL_COVENANTS');
  assert.deepEqual(receipt.compiled_candidates.filter((row) => row.ok).map(
    (row) => row.candidate.claim.claim_definition_key,
  ), [
    GENERAL_COVENANT_CLAIM_KEYS['COV-ACCESS'],
    GENERAL_COVENANT_CLAIM_KEYS['COV-ACCESS'],
    'NATIVE_GENERAL_COVENANT_UNSUPPORTED_CANDIDATE',
  ]);
  assert.equal(resolution.resolved.length, 1);
  assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'GENERAL_COVENANT_PRESENT');
  assert.equal(resolution.resolved[0].concept_key, 'COV-ACCESS');
  assert.deepEqual(resolution.open_world.map((row) => row.reason).sort(), [
    'GENERAL_COVENANT_CODE_UNSUPPORTED',
    'GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED',
  ]);
});

test('governed General Covenants claims reach Review, Query, Compare and market statistics', async () => {
  const { resolution } = await resolveFixture();
  const projection = projectGeneralCovenantsProductSurfaces({ resolution, deal_id: DEAL_ID });
  const governedCard = projection.cards.find((card) => card.provision_subtype === 'COV-ACCESS');
  assert.equal(governedCard.features.mainConcept, GROUNDED_QUOTE);
  assert.equal(governedCard.canonical_v2_lineage.owner_id, 'ACCESS_INFORMATION_COVENANTS');
  const evidenceCard = projection.cards.find((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.ok(evidenceCard);
  assert.deepEqual(evidenceCard.features, {});

  const config = await import('../components/review/table-configs/general-covenants.config.js');
  const rows = config.generalCovenantsConfig.selectRows({ cards: projection.cards });
  const accessRow = rows.find((row) => row.sourceCard?.id === governedCard.id);
  assert.equal(accessRow.ownerFamily, 'ACCESS_INFORMATION_COVENANTS');
  assert.deepEqual(accessRow.marketProvisionCodes, ['COV-ACCESS']);
  const evidenceRow = rows.find((row) => row.marketState === 'OPEN_NATIVE_FIELD');
  assert.ok(evidenceRow);

  const compared = executeDealCompare({
    deal_ids: [DEAL_ID],
    provision_types: ['COVENANT_OTHER'],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: [governedCard],
  });
  const compareField = compared.rows[0].cells[0].key_fields.find((field) => field.field === 'mainConcept');
  assert.equal(compareField.value, GROUNDED_QUOTE);

  const adapter = await import('../lib/market-metrics/adapter.js');
  assert.equal(adapter.resolveMarketMetricRow(evidenceRow, { configId: 'general-covenants' }).resolution, 'evidence_only');
  const specs = adapter.resolveMarketMetricSpecs(accessRow, { configId: 'general-covenants' });
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    cards: [governedCard],
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow).flatMap((row) => Object.values(row.metrics))
    .some((result) => result.coverage?.presentCount === 1));
});
