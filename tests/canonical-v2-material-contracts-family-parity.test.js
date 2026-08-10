'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

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
  PROMPT_VERSION,
} = require('../lib/canonical-v2/native-producer/material-contracts-producer-prompt');
const { classifySectionFamily, SECTION_FAMILY_RULE_CLASSIFIED } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const {
  EVIDENCE_SOURCE,
  projectMaterialContractsProductSurfaces,
} = require('../lib/canonical-v2/material-contracts-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');
const {
  LEXICAL_FAMILY_LEXICON,
  LEXICAL_FAMILY_LEXICON_VERSION,
  buildLexicalDisagreementReceipt,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

const CONTRACT = compileFixtureContractV27();
const DEAL_ID = 'material-contracts-family-deal';
const SECTION_REFERENCE = '3.13';
const GROUNDED_QUOTE = 'any supply agreement requiring annual payments by the Company of more than $10,000,000;';
const EXCLUDED_QUOTE = 'each contract for lease of personal property or real property (other than Oil and Gas Properties) involving payments in excess of $100,000,000';
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
    scope_exclusions: [],
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

async function resolveLandosFixture() {
  const agreement = fs.readFileSync(path.join(__dirname, '../__fixtures__/demo-deal/landos-abbvie-agreement.txt'), 'utf8');
  const match = agreement.match(/any Company Contract relating to Indebtedness[\s\S]*?Company Subsidiary;/);
  assert.ok(match, 'committed Landos/AbbVie Material Contracts clause');
  const quote = match[0];
  const sourceText = `Section 3.13 Contracts.\n\n${quote}\n`;
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'landos-material-contracts-real-replay' });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: 'deal:landos-abbvie',
    deal_admission_id: sha256Hex('deal-admission:landos-abbvie'),
    source_ordinal: 0,
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: ['3.13'],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals({
        material_contract_criteria: [{
          section_reference: '3.13',
          party_making: 'the Company',
          bucket_code: 'INDEBTEDNESS',
          threshold_kind: 'USD',
          threshold_value: '$100,000',
          cadence_kind: null,
          definition_cross_references: [],
          quote,
        }],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'material-contracts-landos-replay/v1', model_id: 'stub-model',
        prompt: 'material-contracts-landos-replay/v1', proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
  return { quote, receipt, resolution };
}

test('Material Contracts registers its exact contract, producer and title route', async () => {
  assert.equal(validateContractBundle(CONTRACT), true);
  assert.ok(CONTRACT.claim_definitions.some((row) => row.claim_definition_key === 'MATERIAL_CONTRACT_BUCKET_PRESENT'));
  assert.ok(CONTRACT.claim_definitions.some((row) => row.claim_definition_key === 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE'));
  assert.equal(getProducerPromptModule('MATERIAL_CONTRACTS'), buildMaterialContractsProducerPrompt);
  assert.ok(MATERIAL_CONTRACT_BUCKET_KINDS.includes('SUPPLY'));
  assert.equal(MATERIAL_CONTRACT_BUCKET_KINDS.includes('OTHER'), false);
  assert.equal(PROMPT_VERSION, 3);
  const prompt = buildMaterialContractsProducerPrompt({
    source_text: GROUNDED_QUOTE,
    governed_scope: { section_reference: SECTION_REFERENCE },
  });
  assert.match(prompt.messages[0].content, /Every discrete contract-inclusion list item without a quantitative floor is an ANY threshold/);
  assert.match(prompt.messages[0].content, /Never list a term merely because it is capitalised, appears in the quote, or affects only the parties or scope/);
  assert.match(prompt.messages[0].content, /scope_exclusions/);
  assert.match(prompt.messages[0].content, /extracted detail/i);
  assert.equal(MAPPING_TABLE_VERSION, 21);
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
  const supplyBucket = governedCard.features.materialContractsBuckets[0];
  assert.deepEqual({ ...supplyBucket, criteria: undefined }, {
    code: 'SUPPLY',
    label: 'Supplier agreements',
    text: GROUNDED_QUOTE,
    quotes: [GROUNDED_QUOTE],
    threshold: '$10,000,000',
    threshold_kind: 'USD',
    cadence_kind: 'ANNUAL',
    scope_exclusions: [],
    criteria: undefined,
  });
  assert.equal(supplyBucket.criteria.length, 1);
  assert.equal(supplyBucket.criteria[0].text, GROUNDED_QUOTE);
  assert.deepEqual(supplyBucket.criteria[0].source_claim_revision_ids, governedCard.canonical_v2_lineage.claim_revision_ids);
  assert.deepEqual(governedCard.canonical_v2_lineage.bucket_claim_revision_ids, {
    SUPPLY: governedCard.canonical_v2_lineage.claim_revision_ids,
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

test('Concho scope exclusions stay structured, grounded and visible without a new column', async () => {
  const response = {
    material_contract_criteria: [criterion({
      bucket_code: 'REAL_ESTATE',
      threshold_value: '$100,000,000',
      cadence_kind: null,
      scope_exclusions: ['Oil and Gas Properties'],
      quote: EXCLUDED_QUOTE,
    })],
    open_world_candidates: [],
  };
  const sourceText = `Section ${SECTION_REFERENCE} Material Contracts.\n\n${EXCLUDED_QUOTE}`;
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'concho-exclusion-test' });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals(response, governedScope.source_text);
      return {
        provider_id: 'material-contracts-exclusion-test/v1',
        model_id: 'stub-model',
        prompt: 'material-contracts-exclusion-test/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: Object.freeze({
      ...source,
      governed_deal_key: 'deal:concho-exclusion-test',
      deal_admission_id: sha256Hex('deal-admission:concho-exclusion-test'),
      source_ordinal: 0,
    }),
  });
  assert.equal(resolution.open_world.length, 0);
  assert.ok(resolution.resolved.every((entry) => (
    entry.claim.attributes.scope_exclusions[0] === 'Oil and Gas Properties'
  )));
  const projection = projectMaterialContractsProductSurfaces({ resolution, deal_id: 'concho-exclusion-test' });
  const bucket = projection.cards[0].features.materialContractsBuckets[0];
  assert.deepEqual(bucket.scope_exclusions, ['Oil and Gas Properties']);
  const config = await import('../components/review/table-configs/material-contracts.config.js');
  const rows = config.materialContractsConfig.selectRows({ cards: projection.cards });
  assert.deepEqual(rows[0].scopeExclusions, ['Oil and Gas Properties']);
  assert.match(config.renderEvidence(rows[0], {}), /Excludes: Oil and Gas Properties/);
  const markup = renderToStaticMarkup(config.renderEvidence(rows[0], {
    primitives: {
      EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
    },
  }));
  assert.match(markup, /<div><span>.*<\/span><\/div><div>Excludes: Oil and Gas Properties<\/div>/);
});

test('the committed Concho cohort replays its recorded oil and gas exclusion', async () => {
  const { replayRun } = await import('../scripts/stage-2y-resolution-set-diff.mjs');
  const { replayed: resolution } = await replayRun('concho-material-contracts-20260809-2xk-final');
  const projection = projectMaterialContractsProductSurfaces({ resolution, deal_id: 'concho' });
  const config = await import('../components/review/table-configs/material-contracts.config.js');
  const row = config.materialContractsConfig.selectRows({ cards: projection.cards })
    .find((candidate) => candidate.code === 'REAL_ESTATE');
  assert.deepEqual(row.scopeExclusions, ['Oil and Gas Properties']);
  assert.match(renderToStaticMarkup(config.renderTerm(row, {})), /Excludes: Oil and Gas Properties/);
  assert.match(config.renderEvidence(row, {}), /Excludes: Oil and Gas Properties/);
  const manifest = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../evidence/canonical-v2/concho-material-contracts-20260809-2xk-final/run-manifest.json',
  ), 'utf8'));
  const entry = resolution.resolved.find((candidate) => candidate.claim.attributes.bucket_code === 'REAL_ESTATE');
  const preview = previewClaimSection({ run: { manifest, resolution }, resolved_entry: entry });
  const rendered = preview.rows.find((candidate) => candidate.matches_claim_key);
  assert.match(rendered.cells.find((cell) => cell.id === 'bucket').text, /Excludes: Oil and Gas Properties/);
});

test('legacy omission derives only a byte-explicit parenthetical exclusion at the provider boundary', () => {
  const legacyCriterion = criterion({
    bucket_code: 'REAL_ESTATE',
    threshold_value: '$100,000,000',
    cadence_kind: null,
    quote: EXCLUDED_QUOTE,
  });
  delete legacyCriterion.scope_exclusions;
  const shaped = shapeMaterialContractsProposals({
    material_contract_criteria: [legacyCriterion],
    open_world_candidates: [],
  }, EXCLUDED_QUOTE);
  assert.ok(shaped.proposals.length > 0);
  assert.ok(shaped.proposals.every((proposal) => (
    proposal.raw_value === EXCLUDED_QUOTE
      && JSON.stringify(proposal.attributes.scope_exclusions) === JSON.stringify(['Oil and Gas Properties'])
  )));

  const nonParentheticalQuote = 'each real property contract other than Oil and Gas Properties';
  const noCueCriterion = criterion({
    bucket_code: 'REAL_ESTATE',
    threshold_kind: 'ANY',
    threshold_value: 'Any',
    cadence_kind: null,
    quote: nonParentheticalQuote,
  });
  delete noCueCriterion.scope_exclusions;
  const noCue = shapeMaterialContractsProposals({
    material_contract_criteria: [noCueCriterion],
    open_world_candidates: [],
  }, nonParentheticalQuote);
  assert.ok(noCue.proposals.every((proposal) => !Object.hasOwn(proposal.attributes, 'scope_exclusions')));
});

test('explicit empty exclusions remain empty and the projection does not infer from raw text', async () => {
  const shaped = shapeMaterialContractsProposals({
    material_contract_criteria: [criterion({
      bucket_code: 'REAL_ESTATE',
      threshold_value: '$100,000,000',
      cadence_kind: null,
      scope_exclusions: [],
      quote: EXCLUDED_QUOTE,
    })],
    open_world_candidates: [],
  }, EXCLUDED_QUOTE);
  assert.ok(shaped.proposals.length > 0);
  assert.ok(shaped.proposals.every((proposal) => (
    Object.hasOwn(proposal.attributes, 'scope_exclusions')
      && proposal.attributes.scope_exclusions.length === 0
  )));

  const { resolution } = await resolveFixture();
  const explicitEmpty = structuredClone(resolution);
  for (const entry of explicitEmpty.resolved) {
    entry.claim.raw_value = EXCLUDED_QUOTE;
    entry.claim.attributes.bucket_code = 'REAL_ESTATE';
    entry.claim.attributes.scope_exclusions = [];
  }
  const explicitProjection = projectMaterialContractsProductSurfaces({ resolution: explicitEmpty, deal_id: 'explicit-empty' });
  assert.ok(explicitProjection.cards.flatMap((card) => card.features.materialContractsBuckets || [])
    .every((bucket) => bucket.scope_exclusions.length === 0
      && bucket.criteria.every((item) => item.scope_exclusions.length === 0)));

  for (const entry of explicitEmpty.resolved) delete entry.claim.attributes.scope_exclusions;
  const absentProjection = projectMaterialContractsProductSurfaces({ resolution: explicitEmpty, deal_id: 'absent-field' });
  assert.ok(absentProjection.cards.flatMap((card) => card.features.materialContractsBuckets || [])
    .every((bucket) => bucket.scope_exclusions.length === 0
      && bucket.criteria.every((item) => item.scope_exclusions.length === 0)));
});

test('ungrounded Material Contracts exclusions fail closed', async () => {
  const positiveMention = 'any supply agreement concerning Oil and Gas Properties requiring annual payments of more than $10,000,000;';
  const sourceText = `Section ${SECTION_REFERENCE} Material Contracts.\n\n${positiveMention}`;
  const shaped = shapeMaterialContractsProposals({
    material_contract_criteria: [criterion({
      scope_exclusions: ['Oil and Gas Properties'],
      quote: positiveMention,
    })],
    open_world_candidates: [],
  }, sourceText);
  const source = buildImmutableSource({ sourceBytes: sourceText, sourceOccurrenceKey: 'ungrounded-exclusion-test' });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async () => ({
      provider_id: 'ungrounded-exclusion-test/v1', model_id: 'stub-model', prompt: 'test',
      proposals: shaped.proposals, evidence_residuals: shaped.evidence_residuals,
    }),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: Object.freeze({
      ...source,
      governed_deal_key: 'deal:ungrounded-exclusion-test',
      deal_admission_id: sha256Hex('deal-admission:ungrounded-exclusion-test'),
      source_ordinal: 0,
    }),
  });
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.open_world.length, 2);
  assert.ok(resolution.open_world.every((entry) => entry.reason === 'MATERIAL_CONTRACT_EXCLUSION_UNCORROBORATED'));
});

test('historical Material Contracts candidates without the V3 exclusion field keep their semantic resolution', async () => {
  const { receipt, resolution: current } = await resolveFixture();
  const legacyReceipt = structuredClone(receipt);
  for (const row of legacyReceipt.compiled_candidates) {
    if (row?.ok && row.candidate?.claim?.attributes) delete row.candidate.claim.attributes.scope_exclusions;
  }
  const source = buildImmutableSource({
    sourceBytes: SOURCE_TEXT,
    sourceOccurrenceKey: 'material-contracts-family-test',
  });
  const legacy = resolveCandidates({
    run_receipt: legacyReceipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: Object.freeze({
      ...source,
      governed_deal_key: `deal:${DEAL_ID}`,
      deal_admission_id: sha256Hex(`deal-admission:${DEAL_ID}`),
      source_ordinal: 0,
    }),
  });
  const semantics = (resolution) => resolution.resolved.map((entry) => ({
    definition: entry.resolved_claim_definition_key,
    state: entry.claim.state,
    value: entry.claim.canonical_value,
    raw: entry.claim.raw_value,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.deepEqual(semantics(legacy), semantics(current));
  assert.deepEqual(legacy.open_world.map((entry) => entry.reason), current.open_world.map((entry) => entry.reason));
});

test('the projector keeps contract-excluded OTHER material exact and open-world', async () => {
  const { resolution } = await resolveFixture();
  const crafted = structuredClone(resolution);
  const sourceEntry = crafted.resolved.find((entry) => (
    entry.resolved_claim_definition_key === 'MATERIAL_CONTRACT_BUCKET_PRESENT'
  ));
  const otherEntry = structuredClone(sourceEntry);
  otherEntry.claim.attributes.bucket_code = 'OTHER';
  otherEntry.claim.canonical_value = 'OTHER';
  crafted.resolved.push(otherEntry);
  const openItem = structuredClone(crafted.open_world[0]);
  openItem.section_reference = otherEntry.section_reference;
  openItem.raw_value = otherEntry.claim.raw_value;
  openItem.closure_id = otherEntry.claim.closure_id;
  openItem.reason = 'MATERIAL_CONTRACT_BUCKET_UNSUPPORTED';
  crafted.open_world.push(openItem);

  const projection = projectMaterialContractsProductSurfaces({ resolution: crafted, deal_id: DEAL_ID });
  assert.equal(projection.cards.some((card) => (
    card.features.materialContractsBuckets?.some((bucket) => bucket.code === 'OTHER')
  )), false);
  assert.ok(projection.cards.some((card) => (
    card.canonical_v2_lineage.source === EVIDENCE_SOURCE
      && card.primary_quote === otherEntry.claim.raw_value
  )));
});

test('committed Landos/AbbVie text replays through native resolution and the lexical net', async () => {
  const { quote, receipt, resolution } = await resolveLandosFixture();
  assert.equal(receipt.compiled_candidates.length, 2);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok));
  assert.deepEqual(resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(), [
    'MATERIAL_CONTRACT_BUCKET_PRESENT',
    'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE',
  ]);
  assert.equal(resolution.open_world.length, 0);

  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 16);
  assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === 'REP-T-CONTRACTS'));
  const bytes = Buffer.from(quote, 'utf8');
  const lexical = buildLexicalDisagreementReceipt({
    governed_section: { section_ref: '3.13', text: quote, text_sha256: sha256Hex(bytes) },
    candidates: [{
      closure_id: 'landos-material-contracts',
      section_reference: '3.13',
      family: 'REP-T-CONTRACTS',
      evidence: [{ start: 0, end: bytes.length }],
    }],
  });
  const family = lexical.family_outcomes.find((entry) => entry.family === 'REP-T-CONTRACTS');
  assert.equal(family.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED');
  assert.ok(family.matched_count > 0);
});
