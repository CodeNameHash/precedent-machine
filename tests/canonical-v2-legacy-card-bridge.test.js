'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { MATERIAL_CONTRACT_BUCKET_CODES } = require('../lib/taxonomy');
const { compileFixtureContractV27 } = require('../lib/canonical-v2/contract-bundle');
const {
  BRIDGE_SCHEMA,
  AUTHORITY_STATE,
  ID_PREFIX,
  LegacyCardBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  bridgeMaterialContractsCardsToLegacyShape,
  mergeCanonicalV2CardsIntoReviewDeal,
  validateBridgeEnvelope,
} = require('../lib/canonical-v2/legacy-card-bridge');
const { DarkBridgeGateError } = require('../lib/canonical-v2/dark-bridge-gate');
const {
  PROJECTION_SCHEMA,
  projectMaterialContractsProductSurfaces,
} = require('../lib/canonical-v2/material-contracts-product-projection');
const {
  shapeMaterialContractsProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  runNativeExtraction,
} = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
// Cross-family regression coverage (see the "excerpt_id is not identity"
// tests near the end of this file): the No Other Reps / Fraud bridge is the
// exemplar this programme-wide rule is modelled on, and its own non-reliance
// / extra-contractual-disclaimer pair is the real-world case of two distinct
// cards legitimately sharing one excerpt_id.
const {
  shapeNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-producer');
const {
  resolveNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-resolution');
const {
  projectNoOtherRepsFraudProduct,
} = require('../lib/canonical-v2/no-other-reps-fraud-product-projection');
const {
  bridgeNoOtherRepsFraudCardsToLegacyShape,
  mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal,
} = require('../lib/canonical-v2/no-other-reps-fraud-dark-bridge');

const CONTRACT = compileFixtureContractV27();
const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'legacy-card-bridge',
  'material-contracts-dark-review.json',
);
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const NORF_FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'dark-bridge',
  'no-other-reps-fraud-dark-review.json',
);
const NORF_FIXTURE = JSON.parse(fs.readFileSync(NORF_FIXTURE_PATH, 'utf8'));
const DARK_BRIDGE_ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });

function bridgeError(code) {
  return (error) => error instanceof LegacyCardBridgeError && error.code === code;
}

function resealProjection(projection) {
  projection.projection_id = contentId(PROJECTION_SCHEMA, {
    deal_id: projection.deal_id,
    source: projection.source,
    cards: projection.cards,
    claims: projection.claims,
    open_items: projection.open_items,
  });
  return projection;
}

function resealBridge(bridge) {
  bridge.bridge_id = contentId(BRIDGE_SCHEMA, {
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
    source_projection_schema: bridge.source_projection_schema,
    source_projection_id: bridge.source_projection_id,
    deal_id: bridge.deal_id,
    cards: bridge.cards,
    claims: bridge.claims,
    open_items: bridge.open_items,
  });
  return bridge;
}

// Mirrors legacy-card-bridge.js's own (private, unexported)
// sourceProjectionBodyFromBridge -- validateBridgeEnvelope reconstructs a
// bridge's bound source projection from its own cards/claims and checks it
// against source_projection_id (SOURCE_PROJECTION_MISMATCH otherwise). A
// hand-built bridge envelope (as opposed to one produced by
// bridgeMaterialContractsCardsToLegacyShape) has to compute a matching
// source_projection_id itself, exactly the way the real bridge does.
function reconstructedSourceProjectionId(bridgeLike) {
  const cards = bridgeLike.cards.map((card) => ({
    id: card.id.slice(ID_PREFIX.length),
    ...(card.canonical_v2_lineage.source === 'CANONICAL_V2_NATIVE_CLAIM'
      ? { provision_instance_id: card.provision_instance_id.slice(ID_PREFIX.length) }
      : {}),
    deal_id: card.deal_id,
    excerpt_id: card.excerpt_id.slice(ID_PREFIX.length),
    type: card.type,
    provision_type: card.provision_type,
    provision_subtype: card.provision_subtype,
    section_ref: card.section_ref,
    short_title: card.short_title,
    primary_quote: card.primary_quote,
    region_full_text: card.region_full_text,
    full_text: card.full_text,
    features: card.features,
    ai_metadata: card.ai_metadata,
    canonical_v2_lineage: card.canonical_v2_lineage,
  }));
  const claims = bridgeLike.claims.map((claim) => ({
    id: claim.id.slice(ID_PREFIX.length),
    deal_id: claim.deal_id,
    excerpt_id: claim.excerpt_id.slice(ID_PREFIX.length),
    attribute: claim.attribute,
    canonical: claim.canonical,
    verbatim: claim.verbatim,
    evidence_quote: claim.evidence_quote,
    provenance: {
      code: claim.provenance.code,
      source: claim.provenance.source,
      source_claim_revision_ids: claim.provenance.source_claim_revision_ids,
    },
  }));
  return contentId(PROJECTION_SCHEMA, {
    deal_id: bridgeLike.deal_id,
    source: 'CANONICAL_V2_NATIVE_CLAIM',
    cards,
    claims,
    open_items: bridgeLike.open_items,
  });
}

function realSourceText() {
  const agreementPath = path.join(__dirname, '..', FIXTURE.real_source_file);
  const agreement = fs.readFileSync(agreementPath, 'utf8');
  assert.ok(agreement.includes(FIXTURE.material_contract_criterion.quote));
  return `Section ${FIXTURE.section_reference} Contracts.\n\n${FIXTURE.material_contract_criterion.quote}\n`;
}

async function buildRealProjection({ includeOpenWorld = false } = {}) {
  const sourceText = realSourceText();
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-material-contracts-dark-bridge',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${FIXTURE.deal_id}`,
    deal_admission_id: sha256Hex(`deal-admission:${FIXTURE.deal_id}`),
    source_ordinal: 0,
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [FIXTURE.section_reference],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals({
        material_contract_criteria: [{
          section_reference: FIXTURE.section_reference,
          ...FIXTURE.material_contract_criterion,
        }],
        open_world_candidates: includeOpenWorld ? [{
          observed_quote: FIXTURE.material_contract_criterion.quote,
          why_unmapped: 'MATERIAL_CONTRACT_NOVEL_RELATIONSHIP',
          nearest_concept: 'REP-T-CONTRACTS',
        }] : [],
      }, governedScope.source_text);
      return {
        provider_id: 'material-contracts-dark-bridge-fixture/v1',
        model_id: 'recorded-fixture',
        prompt: 'material-contracts-dark-bridge-fixture/v1',
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
  return projectMaterialContractsProductSurfaces({
    resolution,
    deal_id: FIXTURE.deal_id,
  });
}

function buildLegacyReviewDeal() {
  return shapeReviewDealRows(FIXTURE.deal_id, structuredClone(FIXTURE.legacy_cards), {
    claims: [],
  });
}

// Canonical V2 preview gate (components/review/table-configs/canonical-v2-
// preview-lane.js): material-contracts.config.js had NO gate at all before
// this task -- its dark rows rendered the instant a dark card reached
// reviewDeal.cards, which is exactly what every call below exercises. The
// config now requires an explicit, server-stamped canonical_v2_preview_
// enabled boolean on the reviewDeal payload (never process.env, which the
// client-rendered review page can't see) before it will render them, so
// every assertion below that expects a dark row now asks for the flag
// explicitly instead of relying on that gap.
function withPreviewEnabled(reviewDeal) {
  return { ...reviewDeal, canonical_v2_preview_enabled: true };
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

function loadEsmModule(relativePath) {
  const swc = require('next/dist/build/swc');
  const transform = ({ source, filename }) => {
    try {
      const result = swc.transformSync(source, {
        filename,
        jsc: {
          parser: { syntax: 'ecmascript', jsx: true, dynamicImport: true },
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'commonjs' },
      });
      return { code: result.code };
    } catch (error) {
      return { code: '', error };
    }
  };
  const jiti = require('jiti')(__filename, {
    interopDefault: true,
    extensions: ['.js', '.jsx', '.json'],
    transform,
    cache: false,
  });
  return jiti(relativePath);
}

function loadReviewV2Sections() {
  return loadEsmModule('../components/review-v2/sectionList.js');
}

test('a real Material Contracts V2 result joins a legacy reviewDeal and reaches the real review sections', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const legacyReviewDeal = buildLegacyReviewDeal();
  const originalCards = [...legacyReviewDeal.cards];
  const originalSnapshots = legacyReviewDeal.cards.map((card) => structuredClone(card));
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: DARK_BRIDGE_ENABLED_ENV });
  const mergedWithPreview = withPreviewEnabled(merged);

  assert.equal(bridge.authority_state, AUTHORITY_STATE);
  assert.equal(bridge.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  assert.equal(bridge.cards.length, 1);
  assert.equal(bridge.claims.length, 1);
  assert.equal(merged.dealId, FIXTURE.deal_id);
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + bridge.cards.length);
  assert.equal(merged.claims.length, (legacyReviewDeal.claims?.length || 0) + bridge.claims.length);
  assert.equal(merged.claims.some((claim) => claim.id === bridge.claims[0].id), true);
  assert.deepEqual(legacyReviewDeal.cards, originalSnapshots);
  originalCards.forEach((card) => {
    const mergedCard = merged.cards.find((candidate) => candidate.id === card.id);
    assert.ok(mergedCard);
    assert.notEqual(mergedCard, card);
    assert.deepEqual(mergedCard, JSON.parse(JSON.stringify(card)));
    assert.equal(Object.isFrozen(mergedCard), true);
  });
  for (const card of bridge.cards) {
    assert.ok(card.id.startsWith('cv2:'));
    assert.ok(card.provision_instance_id.startsWith('cv2:'));
    assert.ok(card.excerpt_id.startsWith('cv2:'));
    assert.equal(card.authority_state, AUTHORITY_STATE);
    assert.equal(card.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  }
  assert.ok(merged.sections.some((section) => (
    section.sectionRef === FIXTURE.section_reference
      && section.cards.some((card) => card.id === bridge.cards[0].id)
  )));
  assert.equal(merged.definitions.length, legacyReviewDeal.definitions.length);

  const reviewV2Module = loadReviewV2Sections();
  const materialContractsConfig = reviewV2Module.REVIEW_V2_CONFIGS.find((config) => (
    config.id === 'material-contracts'
  ));
  assert.ok(materialContractsConfig);
  const rows = materialContractsConfig.selectRows(mergedWithPreview);
  const indebtedness = rows.find((row) => row.code === 'INDEBTEDNESS');
  assert.ok(indebtedness);
  assert.equal(indebtedness.threshold, '$100,000');
  assert.equal(indebtedness.evidence, FIXTURE.material_contract_criterion.quote);
  assert.equal(indebtedness.authorityState, AUTHORITY_STATE);
  assert.equal(indebtedness.comparisonState, 'NOT_ADMITTED');
  assert.equal(indebtedness.marketState, 'DARK_REVIEW_ONLY');
  assert.equal(indebtedness.marketSkip, true);

  function CoverageFooter() { return null; }
  const footer = materialContractsConfig.renderFooter(rows, { primitives: { CoverageFooter } });
  assert.equal(footer.props.presentCount, 0);
  const { enumerateMarketSectionRows } = loadEsmModule('../lib/market-metrics/section-rows.js');
  assert.deepEqual(enumerateMarketSectionRows({
    id: 'material-contracts',
    config: materialContractsConfig,
  }, mergedWithPreview), []);

  const { buildReviewV2Sections } = reviewV2Module;
  const sections = buildReviewV2Sections(mergedWithPreview, { announce_date: '2025-07-27' });
  assert.ok(sections.some((section) => section.id === 'material-contracts'));

  const representationsConfig = reviewV2Module.REVIEW_V2_CONFIGS.find((config) => (
    config.id === 'representations-qualifiers'
  ));
  const representationRows = representationsConfig.selectRows(merged);
  assert.equal(representationRows.some((row) => row.card?.id === bridge.cards[0].id), false);
  const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');
  const safeRepresentationRows = safeRows(representationsConfig, merged);
  assert.equal(safeRepresentationRows
    .some((row) => row.card?.id === bridge.cards[0].id), false);
  const { unionRows } = loadEsmModule('../components/review-v2/compareRowUnion.js');
  const unioned = unionRows([safeRepresentationRows, safeRepresentationRows]);
  assert.equal(unioned.some((entry) => entry.rows.some((row) => (
    row?.card?.source_authentication_state === SOURCE_AUTHENTICATION_STATE
  ))), false);
  assert.equal(enumerateMarketSectionRows({
    id: 'representations-qualifiers',
    config: representationsConfig,
  }, merged).some(({ row }) => row.card?.id === bridge.cards[0].id), false);
});

// --- F3 regression coverage: chained-merge receipt accumulation ------------
// lib/canonical-v2/review-preview-assembly.js merges all four families'
// dark bridges into ONE review deal, in a fixed order. Before the fix, each
// of three families' merges (this one, general-covenants-dark-bridge.js,
// representations-dark-bridge.js) wrote canonical_v2_bridge_receipts by
// REPLACEMENT, so only the last of the three to merge kept its receipt --
// the other two's provenance binding was silently lost. canonical_v2_bridge_
// receipts now accumulates across the chain instead.

test("canonical_v2_bridge_receipts: a virgin merge yields exactly one receipt bearing this bridge's own identity (F3)", async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const legacyReviewDeal = buildLegacyReviewDeal();
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: DARK_BRIDGE_ENABLED_ENV });

  assert.ok(Array.isArray(merged.canonical_v2_bridge_receipts));
  assert.equal(merged.canonical_v2_bridge_receipts.length, 1);
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], {
    schema_version: BRIDGE_SCHEMA,
    bridge_id: bridge.bridge_id,
    source_projection_id: bridge.source_projection_id,
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
  });
  assert.equal(Object.isFrozen(merged.canonical_v2_bridge_receipts), true);
  assert.equal(Object.isFrozen(merged.canonical_v2_bridge_receipts[0]), true);
});

test('canonical_v2_bridge_receipts: appends to receipts a prior family already left, preserving them in order, rather than replacing them (F3)', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const priorReceipt = Object.freeze({
    schema_version: 'CANONICAL_V2_GENERAL_COVENANTS_DARK_BRIDGE/V1',
    bridge_id: 'a'.repeat(64),
    source_projection_id: 'b'.repeat(64),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
  const legacyReviewDeal = {
    ...buildLegacyReviewDeal(),
    canonical_v2_bridge_receipts: [priorReceipt],
  };
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: DARK_BRIDGE_ENABLED_ENV });

  assert.equal(
    merged.canonical_v2_bridge_receipts.length,
    2,
    "the prior receipt must survive, and this bridge's own must be appended, not replace it",
  );
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceipt);
  assert.equal(merged.canonical_v2_bridge_receipts[1].bridge_id, bridge.bridge_id);
  assert.equal(merged.canonical_v2_bridge_receipts[1].schema_version, BRIDGE_SCHEMA);
});

test('canonical_v2_bridge_receipts: merging the same bridge twice does not duplicate its receipt (F3)', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  // A reviewDeal that already carries a receipt for THIS EXACT bridge_id --
  // the same content-addressed identity a real repeat merge would produce --
  // but whose cards do not yet include this bridge's own cards, isolating
  // the receipts-array dedup rule from the (separate, already-covered)
  // card/claim ID_COLLISION guard, which would otherwise fire first on a
  // literal double-merge of the identical bridge object into the identical
  // accumulating reviewDeal.
  const priorReceiptForSameBridge = Object.freeze({
    schema_version: bridge.schema_version,
    bridge_id: bridge.bridge_id,
    source_projection_id: bridge.source_projection_id,
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
  });
  const legacyReviewDeal = {
    ...buildLegacyReviewDeal(),
    canonical_v2_bridge_receipts: [priorReceiptForSameBridge],
  };
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: DARK_BRIDGE_ENABLED_ENV });
  assert.equal(merged.canonical_v2_bridge_receipts.length, 1, 'a receipt already present for this bridge_id must not be duplicated');
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceiptForSameBridge);
});

test('open-world Material Contracts evidence stays reasoned, feature-empty and dark', async () => {
  const projection = await buildRealProjection({ includeOpenWorld: true });
  const evidenceCard = projection.cards.find((card) => (
    card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'
  ));
  assert.ok(evidenceCard);
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const bridgedEvidence = bridge.cards.find((card) => (
    card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'
  ));
  assert.ok(bridgedEvidence);
  assert.ok(bridgedEvidence.provision_instance_id.startsWith('cv2:'));
  assert.equal(bridgedEvidence.canonical_v2_lineage.reason, 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.deepEqual(bridgedEvidence.features, {});
  assert.equal(bridgedEvidence.authority_state, AUTHORITY_STATE);

  const merged = mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), bridge, { env: DARK_BRIDGE_ENABLED_ENV });
  const mergedWithPreview = withPreviewEnabled(merged);
  const reviewV2Module = loadReviewV2Sections();
  const materialContractsConfig = reviewV2Module.REVIEW_V2_CONFIGS.find((config) => (
    config.id === 'material-contracts'
  ));
  const evidenceRow = materialContractsConfig.selectRows(mergedWithPreview).find((row) => (
    row.sourceCard?.id === bridgedEvidence.id
  ));
  assert.ok(evidenceRow);
  assert.equal(evidenceRow.comparisonState, 'NOT_ADMITTED');
  assert.equal(evidenceRow.marketState, 'DARK_REVIEW_ONLY');
  assert.equal(evidenceRow.marketSkip, true);
  const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');
  const compareRows = safeRows(materialContractsConfig, mergedWithPreview);
  assert.equal(compareRows.some((row) => row.sourceCard?.id === bridgedEvidence.id), false);
  const { unionRows } = loadEsmModule('../components/review-v2/compareRowUnion.js');
  assert.equal(unionRows([compareRows]).some(({ rows: unionedRows }) => (
    unionedRows.some((row) => row?.sourceCard?.id === bridgedEvidence.id)
  )), false);
  const {
    enumerateMarketSectionRows,
    resolveMarketSectionRows,
  } = loadEsmModule('../lib/market-metrics/section-rows.js');
  const materialContractsSection = {
    id: 'material-contracts',
    config: materialContractsConfig,
  };
  assert.equal(enumerateMarketSectionRows(
    materialContractsSection,
    mergedWithPreview,
  ).some(({ row }) => row.sourceCard?.id === bridgedEvidence.id), false);
  assert.equal(resolveMarketSectionRows(materialContractsSection, mergedWithPreview).rowCount, 0);
  assert.throws(
    () => executeDealCompare({
      deal_ids: [FIXTURE.deal_id],
      provision_types: ['REPRESENTATION'],
      included_field_groups: ['all'],
      highlight_deltas: false,
    }, {
      deals: [{ id: FIXTURE.deal_id }],
      provisions: bridge.cards,
    }),
    (error) => error?.code === 'DARK_AUTHORITY_NOT_SERVABLE',
  );
  function CoverageFooter() { return null; }
  const footer = materialContractsConfig.renderFooter(
    materialContractsConfig.selectRows(mergedWithPreview),
    { primitives: { CoverageFooter } },
  );
  assert.equal(footer.props.presentCount, 0);

  const governedLeak = structuredClone(projection);
  const leakedEvidence = governedLeak.cards.find((card) => (
    card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'
  ));
  leakedEvidence.features = { materialContractsBuckets: [{ code: 'INDEBTEDNESS' }] };
  resealProjection(governedLeak);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(governedLeak, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('OPEN_WORLD_FEATURES_NOT_EMPTY'),
  );

  const reasonless = structuredClone(projection);
  const reasonlessEvidence = reasonless.cards.find((card) => (
    card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'
  ));
  reasonlessEvidence.canonical_v2_lineage.reason = '';
  resealProjection(reasonless);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(reasonless, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('OPEN_WORLD_REASON_REQUIRED'),
  );
});

test('the bridge rejects missing fields, wrong authority and identity collisions', async () => {
  const projection = await buildRealProjection();

  const missingField = structuredClone(projection);
  delete missingField.cards[0].primary_quote;
  resealProjection(missingField);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(missingField, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('MISSING_REQUIRED_FIELD'),
  );

  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const wrongAuthority = structuredClone(bridge);
  wrongAuthority.authority_state = 'SERVED';
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), wrongAuthority, { env: DARK_BRIDGE_ENABLED_ENV }),
    bridgeError('WRONG_AUTHORITY'),
  );

  const legacyReviewDeal = buildLegacyReviewDeal();
  const collidingLegacyCard = {
    ...legacyReviewDeal.cards[0],
    id: bridge.cards[0].provision_instance_id,
  };
  const collisionDeal = {
    ...legacyReviewDeal,
    cards: [collidingLegacyCard, ...legacyReviewDeal.cards.slice(1)],
  };
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(collisionDeal, bridge, { env: DARK_BRIDGE_ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge.cards, { env: DARK_BRIDGE_ENABLED_ENV }),
    bridgeError('INVALID_BRIDGE_ENVELOPE'),
  );
});

test('the bridge remains a pure dark module with no page import', () => {
  const bridgePath = path.join(__dirname, '..', 'lib', 'canonical-v2', 'legacy-card-bridge.js');
  const source = fs.readFileSync(bridgePath, 'utf8');
  assert.doesNotMatch(source, /supabase|\bfetch\b|pages\//i);
  assert.doesNotMatch(source, /\.(?:insert|upsert|update)\s*\(/i);

  const pagesDirectory = path.join(__dirname, '..', 'pages');
  const pageImports = listFiles(pagesDirectory)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => /(?:require\s*\(|from\s+)[^\n]*legacy-card-bridge/.test(
      fs.readFileSync(file, 'utf8'),
    ));
  assert.deepEqual(pageImports, []);
});

test('the bridge rejects identity drift, hostile review inputs and numeric byte-budget bypasses', async () => {
  const projection = await buildRealProjection();

  const distinctCardId = structuredClone(projection);
  distinctCardId.cards[0].id = 'a'.repeat(64);
  resealProjection(distinctCardId);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(distinctCardId, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_CARD_IDENTITY'),
  );

  const distinctExcerpt = structuredClone(projection);
  const unrelatedExcerpt = `native:${'b'.repeat(64)}`;
  distinctExcerpt.cards[0].excerpt_id = unrelatedExcerpt;
  distinctExcerpt.claims[0].excerpt_id = unrelatedExcerpt;
  resealProjection(distinctExcerpt);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(distinctExcerpt, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_CARD_IDENTITY'),
  );

  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(new Proxy(buildLegacyReviewDeal(), {}), bridge, { env: DARK_BRIDGE_ENABLED_ENV }),
    bridgeError('INVALID_PLAIN_DATA'),
  );

  const oversized = structuredClone(projection);
  oversized.numeric_padding = Array.from({ length: 4 }, (_, group) => Object.fromEntries(
    Array.from({ length: 45000 }, (_, index) => [
      `g${group}k${String(index).padStart(5, '0')}`,
      1.2345678901234567e+200,
    ]),
  ));
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(oversized, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_PLAIN_DATA'),
  );

  const withOpenWorld = await buildRealProjection({ includeOpenWorld: true });
  const authorityLaundering = structuredClone(withOpenWorld);
  authorityLaundering.open_items[0].authority_state = 'SERVED';
  resealProjection(authorityLaundering);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(authorityLaundering, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_ENVELOPE_FIELDS'),
  );

  const fabricatedBucketEvidence = structuredClone(projection);
  const fabricated = 'fabricated bucket evidence';
  const fabricatedBucket = fabricatedBucketEvidence.cards[0].features.materialContractsBuckets[0];
  fabricatedBucket.text = fabricated;
  fabricatedBucket.quotes = [fabricated];
  fabricatedBucketEvidence.cards[0].ai_metadata.features = fabricatedBucketEvidence.cards[0].features;
  fabricatedBucketEvidence.claims[0].canonical = fabricatedBucketEvidence.cards[0].features.materialContractsBuckets;
  fabricatedBucketEvidence.claims[0].id = contentId(
    'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1',
    {
      provision_instance_id: fabricatedBucketEvidence.cards[0].provision_instance_id,
      materialContractsBuckets: fabricatedBucketEvidence.cards[0].features.materialContractsBuckets,
    },
  );
  resealProjection(fabricatedBucketEvidence);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(fabricatedBucketEvidence, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );

  const coordinatedQuoteForgery = structuredClone(projection);
  const forgedCard = coordinatedQuoteForgery.cards[0];
  forgedCard.primary_quote = fabricated;
  forgedCard.features.materialContractsBuckets[0].text = fabricated;
  forgedCard.features.materialContractsBuckets[0].quotes = [fabricated];
  forgedCard.features.materialContractsBuckets[0].threshold = null;
  forgedCard.features.materialContractsBuckets[0].threshold_kind = null;
  forgedCard.features.materialContractsBuckets[0].cadence_kind = null;
  forgedCard.ai_metadata.features = forgedCard.features;
  coordinatedQuoteForgery.claims[0].canonical = forgedCard.features.materialContractsBuckets;
  coordinatedQuoteForgery.claims[0].verbatim = fabricated;
  coordinatedQuoteForgery.claims[0].evidence_quote = fabricated;
  coordinatedQuoteForgery.claims[0].id = contentId(
    'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1',
    {
      provision_instance_id: forgedCard.provision_instance_id,
      materialContractsBuckets: forgedCard.features.materialContractsBuckets,
    },
  );
  resealProjection(coordinatedQuoteForgery);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(coordinatedQuoteForgery, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );

  const internallyConsistentForgery = structuredClone(coordinatedQuoteForgery);
  internallyConsistentForgery.cards[0].region_full_text = fabricated;
  internallyConsistentForgery.cards[0].full_text = fabricated;
  resealProjection(internallyConsistentForgery);
  const unauthenticatedBridge = bridgeMaterialContractsCardsToLegacyShape(
    internallyConsistentForgery, DARK_BRIDGE_ENABLED_ENV);
  assert.equal(
    unauthenticatedBridge.source_authentication_state,
    SOURCE_AUTHENTICATION_STATE,
  );
  assert.throws(
    () => executeDealCompare({
      deal_ids: [FIXTURE.deal_id],
      provision_types: ['MATERIAL_CONTRACT'],
      included_field_groups: ['all'],
      highlight_deltas: false,
    }, { provisions: unauthenticatedBridge.cards }),
    (error) => error?.code === 'DARK_AUTHORITY_NOT_SERVABLE',
  );
  const unauthenticatedMerged = mergeCanonicalV2CardsIntoReviewDeal(
    buildLegacyReviewDeal(),
    unauthenticatedBridge, { env: DARK_BRIDGE_ENABLED_ENV });
  const unauthenticatedMergedWithPreview = withPreviewEnabled(unauthenticatedMerged);
  const reviewV2Module = loadReviewV2Sections();
  const materialContractsConfig = reviewV2Module.REVIEW_V2_CONFIGS.find((config) => (
    config.id === 'material-contracts'
  ));
  const selectedRows = materialContractsConfig.selectRows(unauthenticatedMergedWithPreview);
  const unauthenticatedRow = selectedRows.find((row) => (
    row.sourceCard?.source_authentication_state === SOURCE_AUTHENTICATION_STATE
  ));
  assert.ok(unauthenticatedRow);
  const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');
  assert.equal(safeRows(materialContractsConfig, unauthenticatedMergedWithPreview).some((row) => (
    row?.sourceCard?.id === unauthenticatedRow.sourceCard?.id
  )), false);
  const { resolveMarketMetricSpecs } = loadEsmModule('../lib/market-metrics/adapter.js');
  assert.throws(
    () => resolveMarketMetricSpecs(unauthenticatedRow, { configId: 'material-contracts' }),
    (error) => error?.code === 'DARK_AUTHORITY_NOT_SERVABLE',
  );
});

test('the bridge accepts every governed Material Contracts bucket and keeps OTHER open-world', async () => {
  const projection = await buildRealProjection();
  assert.equal(Object.keys(MATERIAL_CONTRACT_BUCKET_CODES).length, 29);
  for (const [code, label] of Object.entries(MATERIAL_CONTRACT_BUCKET_CODES)
    .filter(([candidateCode]) => candidateCode !== 'OTHER')) {
    const candidate = structuredClone(projection);
    const card = candidate.cards[0];
    const bucket = card.features.materialContractsBuckets[0];
    bucket.code = code;
    bucket.label = label;
    card.ai_metadata.features = card.features;
    candidate.claims[0].canonical = card.features.materialContractsBuckets;
    candidate.claims[0].id = contentId(
      'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1',
      {
        provision_instance_id: card.provision_instance_id,
        materialContractsBuckets: card.features.materialContractsBuckets,
      },
    );
    resealProjection(candidate);
    assert.doesNotThrow(
      () => bridgeMaterialContractsCardsToLegacyShape(candidate, DARK_BRIDGE_ENABLED_ENV),
      `${code} must remain bridgeable with its authoritative label`,
    );
  }
  const other = structuredClone(projection);
  const otherCard = other.cards[0];
  otherCard.features.materialContractsBuckets[0].code = 'OTHER';
  otherCard.features.materialContractsBuckets[0].label = MATERIAL_CONTRACT_BUCKET_CODES.OTHER;
  otherCard.ai_metadata.features = otherCard.features;
  other.claims[0].canonical = otherCard.features.materialContractsBuckets;
  other.claims[0].id = contentId(
    'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1',
    {
      provision_instance_id: otherCard.provision_instance_id,
      materialContractsBuckets: otherCard.features.materialContractsBuckets,
    },
  );
  resealProjection(other);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(other, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('UNGOVERNED_MATERIAL_BUCKET'),
  );
});

// --- excerpt_id is not identity (programme-wide rule) -----------------------
// excerpt_id is carried citation data, never a unique card identity: card
// identity binds the deal, the provision, the exact source span, the
// occurrence and the source revision -- provision_instance_id (plus id),
// never excerpt_id. See lib/canonical-v2/no-other-reps-fraud-dark-bridge.js
// (the exemplar) for why: a non-reliance acknowledgment and its auto-derived
// extra-contractual sibling legitimately quote the SAME source sentence.

test('excerpt_id is not identity: two distinct cards may legitimately share one excerpt_id, and bridge+merge succeed', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const [card] = bridge.cards;
  const [claim] = bridge.claims;

  // A hand-built sibling card: a FRESH, distinct id/provision_instance_id
  // and claim_revision_id, but the SAME excerpt_id as the first card --
  // exactly the shape a legitimate excerpt-sharing pair takes. This must
  // bridge and merge cleanly, never throw ID_COLLISION on the shared
  // excerpt_id.
  const siblingRawProvisionId = sha256Hex(`${card.id}:excerpt-sharing-sibling`);
  const siblingClaimRevisionId = sha256Hex(`${card.id}:excerpt-sharing-sibling:claim-revision`);
  const siblingId = `${ID_PREFIX}${siblingRawProvisionId}`;
  const siblingCard = {
    ...card,
    id: siblingId,
    provision_instance_id: siblingId,
    canonical_v2_lineage: {
      ...card.canonical_v2_lineage,
      claim_revision_ids: [siblingClaimRevisionId],
    },
  };
  const siblingClaimId = `${ID_PREFIX}${contentId(
    'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1',
    {
      provision_instance_id: siblingRawProvisionId,
      materialContractsBuckets: siblingCard.features.materialContractsBuckets,
    },
  )}`;
  const siblingClaim = {
    ...claim,
    id: siblingClaimId,
    excerpt_id: card.excerpt_id,
    provision_instance_id: siblingId,
    provenance: {
      ...claim.provenance,
      source_claim_revision_ids: [siblingClaimRevisionId],
    },
  };
  assert.equal(siblingCard.excerpt_id, card.excerpt_id);
  assert.notEqual(siblingCard.id, card.id);
  assert.notEqual(siblingCard.provision_instance_id, card.provision_instance_id);

  const combinedBridgeDraft = {
    ...bridge,
    cards: [card, siblingCard],
    claims: [claim, siblingClaim],
  };
  combinedBridgeDraft.source_projection_id = reconstructedSourceProjectionId(combinedBridgeDraft);
  const combinedBridge = resealBridge(combinedBridgeDraft);

  const legacyReviewDeal = buildLegacyReviewDeal();
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, combinedBridge, { env: DARK_BRIDGE_ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + 2);
  assert.equal(merged.claims.length, (legacyReviewDeal.claims?.length || 0) + 2);
  assert.ok(merged.cards.some((candidate) => candidate.id === card.id));
  assert.ok(merged.cards.some((candidate) => candidate.id === siblingCard.id));

  // Genuine identity collisions must still fail closed: forcing the
  // sibling's provision_instance_id (not just its excerpt_id) to collide
  // with the first card must still throw ID_COLLISION.
  const collidingSiblingCard = { ...siblingCard, id: card.id, provision_instance_id: card.provision_instance_id };
  const collidingSiblingClaim = { ...siblingClaim, provision_instance_id: card.provision_instance_id };
  const genuineCollisionDraft = {
    ...bridge,
    cards: [card, collidingSiblingCard],
    claims: [claim, collidingSiblingClaim],
  };
  genuineCollisionDraft.source_projection_id = reconstructedSourceProjectionId(genuineCollisionDraft);
  const genuineCollision = resealBridge(genuineCollisionDraft);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), genuineCollision, { env: DARK_BRIDGE_ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
});

test('cross-family merge: No Other Reps / Fraud bridge output (whose own non-reliance/extra-contractual pair legitimately shares one excerpt_id) merges first, then Material Contracts bridge output merges into the SAME reviewDeal without ID_COLLISION', async () => {
  const legacyReviewDeal = buildLegacyReviewDeal();

  const norfSourceText = [
    NORF_FIXTURE.assertions.no_other_reps.assertion_quote,
    NORF_FIXTURE.assertions.non_reliance.assertion_quote,
    NORF_FIXTURE.assertions.independent_investigation.assertion_quote,
    NORF_FIXTURE.assertions.fraud_carveout.assertion_quote,
    NORF_FIXTURE.assertions.willful_breach_definition.definition_quote,
  ].join('\n');
  const a = NORF_FIXTURE.assertions;
  const { proposals } = shapeNoOtherRepsFraudProposals({
    no_other_reps_assertions: [a.no_other_reps],
    non_reliance_assertions: [a.non_reliance],
    independent_investigation_assertions: [a.independent_investigation],
    fraud_carveout_assertions: [a.fraud_carveout],
    willful_breach_definitions: [a.willful_breach_definition],
    open_world_candidates: [],
  }, norfSourceText);
  const receipt = resolveNoOtherRepsFraudProposals({
    proposals, source_text: norfSourceText, source_id: NORF_FIXTURE.deal_id,
  });
  const norfProjection = projectNoOtherRepsFraudProduct({ resolved: receipt.resolved });
  // Deliberately bridged under the MATERIAL CONTRACTS deal_id (not NORF's
  // own fixture deal_id) so both families' output lands in the SAME
  // reviewDeal below -- deal_id is bridge-time-supplied for this family,
  // never baked into its projection.
  const norfBridge = bridgeNoOtherRepsFraudCardsToLegacyShape(norfProjection, {
    deal_id: FIXTURE.deal_id, resolved: receipt.resolved, env: DARK_BRIDGE_ENABLED_ENV,
  });
  assert.equal(norfBridge.cards.length, 6);

  const nonReliance = norfBridge.cards.find((card) => card.short_title === 'Non-reliance');
  const extraContractual = norfBridge.cards.find((card) => card.short_title === 'Extra-contractual disclaimer');
  assert.ok(nonReliance);
  assert.ok(extraContractual);
  // The exact precondition the bug description names: two distinct cards
  // from the SAME family sharing one excerpt_id, already present in the
  // reviewDeal before Material Contracts ever merges.
  assert.equal(nonReliance.excerpt_id, extraContractual.excerpt_id);
  assert.notEqual(nonReliance.id, extraContractual.id);

  const afterNorf = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(
    legacyReviewDeal,
    norfBridge,
    { env: DARK_BRIDGE_ENABLED_ENV },
  );
  assert.equal(afterNorf.cardCount, legacyReviewDeal.cardCount + 6);

  const projection = await buildRealProjection();
  const materialContractsBridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);

  // This is the regression: before the fix, merge reserved excerpt_id
  // across the WHOLE reviewDeal before looking at its own incoming cards,
  // so this threw ID_COLLISION the moment it reached the second card of the
  // NORF pair above. It must now succeed.
  const afterBoth = mergeCanonicalV2CardsIntoReviewDeal(afterNorf, materialContractsBridge, { env: DARK_BRIDGE_ENABLED_ENV });
  assert.equal(afterBoth.cardCount, afterNorf.cardCount + materialContractsBridge.cards.length);
  assert.ok(afterBoth.cards.some((card) => card.id === materialContractsBridge.cards[0].id));
  assert.ok(afterBoth.cards.some((card) => card.id === nonReliance.id));
  assert.ok(afterBoth.cards.some((card) => card.id === extraContractual.id));
});

// --- gate-integrity regression coverage (F1/F6/F9) --------------------------
// This module carried NO dark-bridge gate at all before this fix (F1): its
// builder and merge ran unconditionally, under a full production
// environment, before any of the other checks above. This section proves
// every exported function that mints or validates a record -- the builder,
// validateBridgeEnvelope, and merge -- now refuses under production, and
// that an explicit falsy env (or a missing env key on merge's options
// object) refuses rather than silently falling back to an enabled ambient
// process.env.

function withAmbientDarkBridgeEnabled(fn) {
  const key = 'CANONICAL_V2_DARK_BRIDGE';
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const previous = process.env[key];
  process.env[key] = 'ENABLED_LOCAL_PREPRODUCTION';
  try {
    return fn();
  } finally {
    if (had) process.env[key] = previous;
    else delete process.env[key];
  }
}

function gateRefusal(error) {
  return error instanceof DarkBridgeGateError && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED';
}

test('every minting/validating export refuses under a production env, flag or no flag', () => {
  const dummyProjection = {};
  const dummyBridge = {};
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };

  for (const productionEnv of [
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'production' },
    { VERCEL: '1', VERCEL_ENV: 'production' },
  ]) {
    assert.throws(
      () => bridgeMaterialContractsCardsToLegacyShape(dummyProjection, productionEnv),
      gateRefusal,
      `bridgeMaterialContractsCardsToLegacyShape must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => validateBridgeEnvelope(dummyBridge, productionEnv),
      gateRefusal,
      `validateBridgeEnvelope must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env: productionEnv }),
      gateRefusal,
      `mergeCanonicalV2CardsIntoReviewDeal must refuse under ${JSON.stringify(productionEnv)}`,
    );
  }
});

test('an explicit undefined/null env, or a merge options object missing its env key, refuses rather than falling back to an enabled ambient process.env', () => {
  const dummyProjection = {};
  const dummyBridge = {};
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };

  withAmbientDarkBridgeEnabled(() => {
    for (const env of [undefined, null]) {
      assert.throws(
        () => bridgeMaterialContractsCardsToLegacyShape(dummyProjection, env),
        gateRefusal,
        `bridgeMaterialContractsCardsToLegacyShape must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => validateBridgeEnvelope(dummyBridge, env),
        gateRefusal,
        `validateBridgeEnvelope must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env }),
        gateRefusal,
        `mergeCanonicalV2CardsIntoReviewDeal must refuse on explicit env=${env}`,
      );
    }
    // A provided options object with no env key at all -- merge's only
    // caller-facing options bag -- must refuse the same way, never treated
    // as "env not specified, fall back to ambient".
    assert.throws(
      () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, {}),
      gateRefusal,
      'mergeCanonicalV2CardsIntoReviewDeal must refuse when the options object has no env key',
    );

    // Sanity check on the ambient fallback itself: a genuinely omitted env
    // argument (arguments.length below the env-carrying position) really
    // does read the now-enabled ambient process.env, proving the calls
    // above threw because of the explicit/missing env, not because the
    // gate is unconditionally broken. bridgeMaterialContractsCardsToLegacyShape
    // gets past the gate and fails on projection shape instead.
    assert.throws(
      () => bridgeMaterialContractsCardsToLegacyShape(dummyProjection),
      (error) => !(error instanceof DarkBridgeGateError),
      'omitting env entirely must fall back to the now-enabled ambient process.env',
    );
  });
});

// --- hostile grounding tests (exact-segment equality vs anchored containment) --
// bucket.text/bucket.quotes are checked against card.primary_quote via
// isExactJoinedSegment: candidate must equal one of the '\n'-delimited units
// that were joined to build primary_quote (see material-contracts-product-
// projection.js's `[...new Set(quotes)].join('\n')`), never merely occur
// somewhere inside it. With exactly one governed bucket in this fixture,
// that unit is the WHOLE original quote, so any fragment shorter than or
// different from it is rejected outright -- this is airtight against every
// pattern below, including negation-stripping, because there is no
// containment fallback for bucket text/quotes at all. threshold is
// different: it is a genuine sub-phrase within a bucket's own text with no
// offset anywhere in the pipeline, so it is checked via word-boundary-
// anchored containment (tier 3) -- the same ceiling, and the same
// documented gap against negation-stripping, as representations-dark-
// bridge.js's own KNOWN LIMITATION tests.

test('quote grounding: a negation-style truncation of a bucket\'s own text (dropping its leading qualifying phrase) is rejected', async () => {
  const projection = await buildRealProjection();
  const original = FIXTURE.material_contract_criterion.quote;
  assert.equal(projection.cards[0].features.materialContractsBuckets[0].text, original);
  // Drops the leading "any Company Contract relating to Indebtedness " --
  // structurally the same attack as dropping a preceding "not"/"would not":
  // a genuine, word-boundary-aligned, contiguous SUFFIX of the real quote
  // that reads as self-contained but silently drops what it was about.
  const truncated = 'in excess of $100,000 (whether incurred, assumed, guaranteed, or secured by\nany asset) of the Company or any Company Subsidiary;';
  assert.ok(original.endsWith(truncated));
  assert.notEqual(truncated, original);

  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  bucket.text = truncated;
  bucket.quotes = [truncated];
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: a word-boundary flip ("debtedness" sliced out of "Indebtedness") is rejected', async () => {
  const projection = await buildRealProjection();
  const original = FIXTURE.material_contract_criterion.quote;
  assert.ok(original.includes('Indebtedness'));
  const flipped = original.replace('Indebtedness', 'debtedness');
  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  bucket.text = flipped;
  bucket.quotes = [flipped];
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: a truncated prefix ("any C" sliced out of "any Company Contract") is rejected', async () => {
  const projection = await buildRealProjection();
  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  assert.ok(bucket.text.startsWith('any C'));
  bucket.text = 'any C';
  bucket.quotes = ['any C'];
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: an arbitrary mid-quote substring is rejected', async () => {
  const projection = await buildRealProjection();
  const original = FIXTURE.material_contract_criterion.quote;
  const midWord = 'elating to Indebtedness in excess o';
  assert.ok(original.includes(midWord));
  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  bucket.text = midWord;
  bucket.quotes = [midWord];
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test("quote grounding: a fragment that appears only in a DIFFERENT card's text (the legacy MAE definition) is rejected against this bucket's own quote", async () => {
  const projection = await buildRealProjection();
  const foreignFragment = 'an effect materially adverse to the Company';
  assert.ok(FIXTURE.legacy_cards[0].primary_quote.includes(foreignFragment));
  assert.ok(!FIXTURE.material_contract_criterion.quote.includes(foreignFragment));
  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  bucket.text = foreignFragment;
  bucket.quotes = [foreignFragment];
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: region_full_text/full_text no longer equal to primary_quote is rejected by exact equality, not mere containment', async () => {
  const projection = await buildRealProjection();
  const tampered = structuredClone(projection);
  // A LARGER, fabricated surrounding text that still CONTAINS primary_quote
  // verbatim -- accepted under plain .includes(), rejected under exact
  // equality (region_full_text/full_text must be primary_quote, not merely
  // contain it, since the native projection always constructs all three
  // from the same variable).
  const largerFabrication = `Preamble text that was never in the source. ${tampered.cards[0].primary_quote} Trailing text that was never in the source either.`;
  tampered.cards[0].region_full_text = largerFabrication;
  tampered.cards[0].full_text = largerFabrication;
  resealProjection(tampered);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: threshold scoped to a sibling bucket\'s unrelated text is rejected, not accepted via the whole (multi-bucket) primary_quote', async () => {
  const projection = await buildRealProjection();
  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  // A second, sibling bucket whose OWN text carries a $100,000 figure the
  // FIRST bucket's threshold could try to ground against if the check were
  // scoped to the whole (joined) primary_quote instead of the owning
  // bucket's own text.
  const siblingText = 'a separate, unrelated obligation not to exceed $100,000 in the aggregate.';
  const sibling = {
    code: 'IP_LICENSES_IN', label: MATERIAL_CONTRACT_BUCKET_CODES.IP_LICENSES_IN,
    text: siblingText, quotes: [siblingText], threshold: null, threshold_kind: null, cadence_kind: null,
  };
  tampered.cards[0].features.materialContractsBuckets = [bucket, sibling].sort((a, b) => a.code.localeCompare(b.code));
  tampered.cards[0].primary_quote = [bucket.text, siblingText].join('\n');
  tampered.cards[0].region_full_text = tampered.cards[0].primary_quote;
  tampered.cards[0].full_text = tampered.cards[0].primary_quote;
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].verbatim = tampered.cards[0].primary_quote;
  tampered.claims[0].evidence_quote = tampered.cards[0].primary_quote;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  // Sanity: this construction is internally self-consistent (both buckets'
  // own text/quotes genuinely occur as exact joined segments) up to this
  // point -- resealProjection alone would otherwise mask a shape mistake.
  resealProjection(tampered);
  const sane = bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV);
  assert.ok(sane);

  // Now move the INDEBTEDNESS bucket's own threshold-bearing text away so
  // its threshold ($100,000) no longer occurs in ITS OWN bucket.text, while
  // the SIBLING bucket's text still carries an (unrelated) $100,000 figure
  // within the SAME joined primary_quote.
  const misscoped = structuredClone(tampered);
  const indebtedness = misscoped.cards[0].features.materialContractsBuckets.find((b) => b.code === 'INDEBTEDNESS');
  const strippedText = indebtedness.text.replace('$100,000', 'the applicable threshold');
  indebtedness.text = strippedText;
  indebtedness.quotes = [strippedText];
  misscoped.cards[0].features.materialContractsBuckets = misscoped.cards[0].features.materialContractsBuckets
    .map((b) => (b.code === 'INDEBTEDNESS' ? indebtedness : b));
  const rejoined = misscoped.cards[0].features.materialContractsBuckets.map((b) => b.text).join('\n');
  misscoped.cards[0].primary_quote = rejoined;
  misscoped.cards[0].region_full_text = rejoined;
  misscoped.cards[0].full_text = rejoined;
  misscoped.cards[0].ai_metadata.features = misscoped.cards[0].features;
  misscoped.claims[0].verbatim = rejoined;
  misscoped.claims[0].evidence_quote = rejoined;
  misscoped.claims[0].canonical = misscoped.cards[0].features.materialContractsBuckets;
  misscoped.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: misscoped.cards[0].provision_instance_id,
    materialContractsBuckets: misscoped.cards[0].features.materialContractsBuckets,
  });
  resealProjection(misscoped);
  assert.throws(
    () => bridgeMaterialContractsCardsToLegacyShape(misscoped, DARK_BRIDGE_ENABLED_ENV),
    bridgeError('INVALID_NATIVE_FEATURES'),
  );
});

test('quote grounding: the legitimate bucket text, quotes and threshold all still pass', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeMaterialContractsCardsToLegacyShape(projection, DARK_BRIDGE_ENABLED_ENV);
  const bucket = bridge.cards[0].features.materialContractsBuckets[0];
  assert.equal(bucket.code, 'INDEBTEDNESS');
  assert.equal(bucket.text, FIXTURE.material_contract_criterion.quote);
  assert.equal(bucket.threshold, '$100,000');
  assert.equal(bridge.cards[0].region_full_text, bridge.cards[0].primary_quote);
  assert.equal(bridge.cards[0].full_text, bridge.cards[0].primary_quote);
  assert.doesNotThrow(() => validateBridgeEnvelope(bridge, DARK_BRIDGE_ENABLED_ENV));
});

// KNOWN LIMITATION, documented rather than hidden (see the isExactJoinedSegment/
// anchoredContains header comment in lib/canonical-v2/legacy-card-bridge.js):
// threshold is a genuine sub-phrase within a bucket's own text, with no
// offset anywhere in this family's pipeline (material-contracts-product-
// projection.js keeps only claim.raw_value, never claim.evidence). Word-
// boundary-anchored containment -- the ceiling here -- cannot close a
// word-boundary-aligned negation drop, because dropping a whole preceding
// word can never itself violate a word boundary. This test pins the
// CURRENT, honest behaviour -- it documents a real gap, not a proof of
// safety.
test('KNOWN LIMITATION: threshold containment does not detect that its own bucket text negates the threshold ("not in excess of" vs "in excess of")', async () => {
  const projection = await buildRealProjection();
  const original = FIXTURE.material_contract_criterion.quote;
  assert.ok(original.includes('in excess of $100,000'));

  // bucket.text is rewritten to say the OPPOSITE -- "that is not in excess
  // of $100,000" -- and kept fully self-consistent (quotes/primary_quote/
  // region_full_text/full_text/claim.verbatim all updated together), so
  // isExactJoinedSegment (which DOES defeat negation-stripping on bucket
  // text itself, see the tests above) has nothing to catch: this bucket's
  // text genuinely, consistently IS this new string now. threshold stays
  // "$100,000", USD, and is still word-boundary-anchored-contained in the
  // negated text -- containment never looks at the "not" three words
  // earlier, so the structured threshold field is accepted as "grounded"
  // even though the sentence it is grounded in now says the reverse of
  // what a $100,000 USD threshold implies.
  const negatedText = original.replace('in excess of $100,000', 'that is not in excess of $100,000');
  assert.notEqual(negatedText, original);

  const tampered = structuredClone(projection);
  const bucket = tampered.cards[0].features.materialContractsBuckets[0];
  bucket.text = negatedText;
  bucket.quotes = [negatedText];
  tampered.cards[0].primary_quote = negatedText;
  tampered.cards[0].region_full_text = negatedText;
  tampered.cards[0].full_text = negatedText;
  tampered.cards[0].ai_metadata.features = tampered.cards[0].features;
  tampered.claims[0].verbatim = negatedText;
  tampered.claims[0].evidence_quote = negatedText;
  tampered.claims[0].canonical = tampered.cards[0].features.materialContractsBuckets;
  tampered.claims[0].id = contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
    provision_instance_id: tampered.cards[0].provision_instance_id,
    materialContractsBuckets: tampered.cards[0].features.materialContractsBuckets,
  });
  resealProjection(tampered);
  // Documented as NOT throwing today -- this assertion records the residual
  // gap; it is not a claim that this input is safe.
  assert.doesNotThrow(
    () => bridgeMaterialContractsCardsToLegacyShape(tampered, DARK_BRIDGE_ENABLED_ENV),
  );
});
