'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  projectRepresentationClaims,
} = require('../lib/canonical-v2/representations-product-projection');
const { DarkBridgeGateError } = require('../lib/canonical-v2/dark-bridge-gate');
const {
  AUTHORITY_STATE,
  BRIDGE_SCHEMA,
  ID_PREFIX,
  RepresentationsDarkBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  bridgeRepresentationRecordsToLegacyShape,
  mergeCanonicalV2CardsIntoReviewDeal,
  validateBridgeEnvelope,
} = require('../lib/canonical-v2/representations-dark-bridge');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
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

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'dark-bridge',
  'representations-dark-review.json',
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
const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const DISABLED_ENV = Object.freeze({});

function bridgeError(code) {
  return (error) => error instanceof RepresentationsDarkBridgeError && error.code === code;
}

function seedId(seed) {
  return sha256Hex(seed);
}

// -- fixture -> legacy reviewDeal --------------------------------------------

function legacyCardsFromFixture() {
  return FIXTURE.legacy_cards.map((card) => {
    const { id_seed, provision_instance_id_seed, ...rest } = card;
    const provisionInstanceId = seedId(provision_instance_id_seed);
    return {
      ...rest,
      id: provisionInstanceId,
      deal_id: FIXTURE.deal_id,
      provision_instance_id: provisionInstanceId,
    };
  });
}

function buildLegacyReviewDeal(cards = legacyCardsFromFixture()) {
  return shapeReviewDealRows(FIXTURE.deal_id, structuredClone(cards), { claims: [] });
}

// -- fixture -> representations-product-projection input --------------------

function buildResolvedEntry(spec) {
  const provisionInstanceId = seedId(spec.provision_instance_id_seed);
  const claimRevisionId = seedId(`${spec.provision_instance_id_seed}:${spec.claim_definition_key}:revision`);
  return {
    concept_key: spec.concept_key,
    section_reference: spec.section_reference,
    claim: {
      state: 'PRESENT',
      claim_definition_key: spec.claim_definition_key,
      claim_revision_id: claimRevisionId,
      canonical_value: spec.canonical_value,
      raw_value: spec.quote,
      evidence: [{ quote: spec.quote }],
      subject_occurrence_id: provisionInstanceId,
      attributes: {
        attachment: { position: 'CHAPEAU' },
        qualifier_kind: spec.qualifier_kind,
        ...(spec.knowledge_standard ? { knowledge_standard: spec.knowledge_standard } : {}),
      },
    },
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionInstanceId,
      party: {
        role: 'REPRESENTATION_MAKER',
        capacity: spec.representation_maker_capacity,
        value: spec.representation_maker,
      },
    },
  };
}

function buildOpenWorldEntry(spec) {
  return {
    section_reference: spec.section_reference,
    reason: spec.reason,
    raw_value: spec.raw_value,
    evidence: [{ quote: spec.raw_value }],
    attributes: {
      candidate_kind: 'ATTRIBUTE_OR_QUESTION',
      observed_category: spec.observed_category,
      why_unmapped: spec.why_unmapped,
      nearest_concept: spec.nearest_concept || null,
    },
  };
}

function targetAccuracyEntry() {
  const t = FIXTURE.target_representation;
  return buildResolvedEntry({
    provision_instance_id_seed: t.provision_instance_id_seed,
    concept_key: t.concept_key,
    section_reference: t.section_reference,
    representation_maker: t.representation_maker,
    representation_maker_capacity: t.representation_maker_capacity,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    canonical_value: t.accuracy.canonical_value,
    quote: t.accuracy.quote,
    qualifier_kind: t.accuracy.qualifier_kind,
  });
}

function targetKnowledgeEntry() {
  const t = FIXTURE.target_representation;
  return buildResolvedEntry({
    provision_instance_id_seed: t.provision_instance_id_seed,
    concept_key: t.concept_key,
    section_reference: t.section_reference,
    representation_maker: t.representation_maker,
    representation_maker_capacity: t.representation_maker_capacity,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    canonical_value: true,
    quote: t.knowledge.quote,
    qualifier_kind: t.knowledge.qualifier_kind,
    knowledge_standard: t.knowledge.knowledge_standard,
  });
}

function parentAccuracyEntry() {
  const p = FIXTURE.parent_representation;
  return buildResolvedEntry({
    provision_instance_id_seed: p.provision_instance_id_seed,
    concept_key: p.concept_key,
    section_reference: p.section_reference,
    representation_maker: p.representation_maker,
    representation_maker_capacity: p.representation_maker_capacity,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    canonical_value: p.accuracy.canonical_value,
    quote: p.accuracy.quote,
    qualifier_kind: p.accuracy.qualifier_kind,
  });
}

function novelAccuracyEntry() {
  const n = FIXTURE.novel_concept_representation;
  return buildResolvedEntry({
    provision_instance_id_seed: n.provision_instance_id_seed,
    concept_key: n.concept_key,
    section_reference: n.section_reference,
    representation_maker: n.representation_maker,
    representation_maker_capacity: n.representation_maker_capacity,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    canonical_value: n.accuracy.canonical_value,
    quote: n.accuracy.quote,
    qualifier_kind: n.accuracy.qualifier_kind,
  });
}

function buildProjection({
  includeTarget = true,
  includeKnowledge = true,
  includeParent = true,
  includeOpenWorld = true,
  includeNovel = false,
} = {}) {
  const resolvedEntries = [];
  if (includeTarget) resolvedEntries.push(targetAccuracyEntry());
  if (includeKnowledge) resolvedEntries.push(targetKnowledgeEntry());
  if (includeParent) resolvedEntries.push(parentAccuracyEntry());
  if (includeNovel) resolvedEntries.push(novelAccuracyEntry());
  const openWorldEntries = includeOpenWorld ? [buildOpenWorldEntry(FIXTURE.open_world_evidence)] : [];
  return projectRepresentationClaims({ resolved_entries: resolvedEntries, open_world_entries: openWorldEntries });
}

// -- reseal helpers (mirrors tests/canonical-v2-legacy-card-bridge.test.js) --

function resealRecordAt(projection, index) {
  const { projection_record_id, ...body } = projection.records[index];
  projection.records[index] = { ...body, projection_record_id: contentId(RECORD_SCHEMA, body) };
  return projection;
}

function resealProjection(projection) {
  const body = {
    schema_version: projection.schema_version,
    authority_state: projection.authority_state,
    records: projection.records,
    ...(Object.hasOwn(projection, 'open_items') ? { open_items: projection.open_items } : {}),
  };
  projection.projection_id = contentId(PROJECTION_SCHEMA, body);
  return projection;
}

function resealBridge(bridge) {
  const body = {
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
    source_projection_schema: bridge.source_projection_schema,
    source_projection_id: bridge.source_projection_id,
    deal_id: bridge.deal_id,
    cards: bridge.cards,
    claims: bridge.claims,
    open_items: bridge.open_items,
  };
  bridge.bridge_id = contentId(BRIDGE_SCHEMA, body);
  return bridge;
}

// -- ESM/JSX loader (mirrors tests/canonical-v2-legacy-card-bridge.test.js) --

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

function loadRepresentationsConfigModule() {
  return loadEsmModule('../components/review/table-configs/representations-qualifiers.config.js');
}

// Canonical V2 preview gate (components/review/table-configs/canonical-v2-
// preview-lane.js): representations-qualifiers.config.js now reads an
// explicit, server-stamped canonical_v2_preview_enabled boolean off the
// reviewDeal payload instead of isDarkBridgeIntegrationEnabled(process.env).
// The BRIDGE's own env gate (bridgeRepresentationRecordsToLegacyShape /
// mergeCanonicalV2CardsIntoReviewDeal, both still env-gated via their own
// `env` parameter) is unrelated and untouched.
function withPreviewEnabled(reviewDeal) {
  return { ...reviewDeal, canonical_v2_preview_enabled: true };
}

// =============================================================================

test('gate off: bridge construction is refused, and the existing selectRepCards exclusion still rejects a dark card whether or not it came from this bridge', () => {
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const legacyReviewDeal = buildLegacyReviewDeal();

  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, DISABLED_ENV),
    (error) => error instanceof DarkBridgeGateError && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED',
  );
  // Omitting env entirely falls back to process.env, which is not enabled in
  // this test run either.
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal),
    (error) => error instanceof DarkBridgeGateError && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED',
  );

  const { representationsQualifiersConfig, parentRepresentationsConfig, selectRepCards } = loadRepresentationsConfigModule();

  // A hand-spliced dark card, constructed WITHOUT ever going through this
  // bridge -- proves the exclusion in selectRepCards() is a property of the
  // card's own authority_state, not something only this bridge happens to
  // respect.
  const handSplicedDarkCard = {
    id: 'hand-spliced-dark-rep',
    deal_id: FIXTURE.deal_id,
    provision_instance_id: 'hand-spliced-dark-rep',
    excerpt_id: 'hand-spliced-dark-rep:0',
    section_ref: '3.99',
    short_title: 'Hand-spliced dark preview probe',
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-ORGANIZATION',
    primary_quote: 'Hand-spliced probe text.',
    region_full_text: 'Hand-spliced probe text.',
    features: { materialityQualifier: { code: 'MAT_ALL_RESPECTS', text: 'Hand-spliced probe text.' } },
    ai_metadata: { features: { materialityQualifier: { code: 'MAT_ALL_RESPECTS', text: 'Hand-spliced probe text.' } } },
    authority_state: 'VALIDATED_NOT_SERVED',
    source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
  };
  const dealWithDarkCard = {
    ...legacyReviewDeal,
    cards: [...legacyReviewDeal.cards, handSplicedDarkCard],
    cardCount: legacyReviewDeal.cardCount + 1,
  };

  const directlySelected = selectRepCards(dealWithDarkCard, 'REP-T-');
  assert.equal(directlySelected.some((card) => card.id === 'hand-spliced-dark-rep'), false);

  assert.equal(process.env.CANONICAL_V2_DARK_BRIDGE, undefined);
  const companyRows = representationsQualifiersConfig.selectRows(dealWithDarkCard);
  assert.equal(companyRows.some((row) => row.card?.id === 'hand-spliced-dark-rep'), false);
  const parentRows = parentRepresentationsConfig.selectRows(dealWithDarkCard);
  assert.equal(parentRows.some((row) => row.card?.id === 'hand-spliced-dark-rep'), false);
});

test('gate on: the bridge groups sibling claims onto one card per provision, resolves excerpt_id/deal_id via the legacy join, and merges additive, labelled, market-skipped preview rows -- the live rows and the exclusion are unaffected', () => {
  const projection = buildProjection({ includeNovel: true });
  const legacyReviewDeal = buildLegacyReviewDeal();
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);

  assert.equal(bridge.authority_state, AUTHORITY_STATE);
  assert.equal(bridge.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  assert.equal(bridge.deal_id, FIXTURE.deal_id);
  // 3 governed PROVISIONS (target org -- accuracy + knowledge grouped onto
  // ONE card, parent org, novel) + 1 open-world card = 4 cards.
  assert.equal(bridge.cards.length, 4);
  // But 4 CLAIMS -- one per governed record; the target org card carries two.
  assert.equal(bridge.claims.length, 4);
  for (const card of bridge.cards) {
    assert.equal(card.authority_state, AUTHORITY_STATE);
    assert.equal(card.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
    assert.ok(card.id.startsWith('cv2:'));
    assert.equal(card.provision_instance_id, card.id);
    assert.ok(card.excerpt_id.startsWith('cv2:'));
    assert.equal(card.deal_id, FIXTURE.deal_id);
  }
  for (const claim of bridge.claims) {
    assert.equal(claim.authority_state, AUTHORITY_STATE);
    assert.equal(claim.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
    assert.equal(claim.verbatim, claim.evidence_quote);
    assert.equal(claim.provenance.canonical_v2_authority_state, AUTHORITY_STATE);
  }

  const targetCard = bridge.cards.find((card) => (
    card.canonical_v2_lineage.source === 'CANONICAL_V2_NATIVE_CLAIM' && card.provision_subtype === 'REP-T-ORGANIZATION'
  ));
  assert.ok(targetCard);
  // ONE card, both governed claims -- never two cards for one real provision.
  assert.ok(targetCard.features.materialityQualifier);
  assert.equal(targetCard.features.knowledgeQualifier, true);
  assert.equal(targetCard.canonical_v2_lineage.claim_revision_ids.length, 2);
  const targetClaims = bridge.claims.filter((claim) => claim.excerpt_id === targetCard.excerpt_id);
  assert.equal(targetClaims.length, 2);
  assert.deepEqual(targetClaims.map((claim) => claim.attribute).sort(), ['knowledgeQualifier', 'materialityQualifier']);
  // short_title and excerpt_id are RESOLVED via the legacy provision join,
  // not fabricated: the legacy card's own short_title passes straight
  // through, and the excerpt_id traces back to the legacy card's own
  // excerpt_id.
  assert.equal(targetCard.short_title, 'Organization; Qualification; Standing');
  assert.ok(targetCard.excerpt_id.includes('legacy-rep-t-organization:0'));
  assert.equal(targetCard.section_ref, '3.1');

  const parentCard = bridge.cards.find((card) => card.provision_subtype === 'REP-B-ORGANIZATION');
  assert.ok(parentCard);
  assert.equal(Object.keys(parentCard.features).length, 1);
  assert.equal(parentCard.canonical_v2_lineage.claim_revision_ids.length, 1);

  const openWorldCard = bridge.cards.find((card) => card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE');
  assert.ok(openWorldCard);
  assert.equal(openWorldCard.provision_subtype, 'REP-EVIDENCE-OPEN-WORLD');
  assert.deepEqual(openWorldCard.features, {});
  assert.equal(openWorldCard.short_title, null);
  assert.equal(bridge.claims.some((claim) => claim.excerpt_id === openWorldCard.excerpt_id), false);

  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + bridge.cards.length);
  assert.equal(merged.claims.length, bridge.claims.length);
  // Canonical V2 preview gate (components/review/table-configs/canonical-v2-
  // preview-lane.js): representations-qualifiers.config.js now reads an
  // explicit, server-stamped canonical_v2_preview_enabled boolean off the
  // reviewDeal payload instead of isDarkBridgeIntegrationEnabled(process.env)
  // -- the BRIDGE's own env gate above (mergeCanonicalV2CardsIntoReviewDeal's
  // `env: ENABLED_ENV`) is unrelated and untouched.
  const mergedWithPreview = withPreviewEnabled(merged);

  const { representationsQualifiersConfig, parentRepresentationsConfig } = loadRepresentationsConfigModule();
  const { enumerateMarketSectionRows } = loadEsmModule('../lib/market-metrics/section-rows.js');
  const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');

  {
    const companyRows = representationsQualifiersConfig.selectRows(mergedWithPreview).filter((row) => row.kind === 'rep');
    // 2 live legacy reps (rep-t-organization, rep-t-novel; neither has
    // features, so no materiality/knowledge on them) + 2 dark preview rows
    // (target org -- ONE row carrying BOTH materiality and knowledge; novel).
    assert.equal(companyRows.length, 4);
    const darkCompanyRows = companyRows.filter((row) => row.marketSkip === true);
    assert.equal(darkCompanyRows.length, 2);
    for (const row of darkCompanyRows) {
      assert.match(row.label, / \(Canonical V2 preview\)$/);
      assert.equal(row.authorityState, 'VALIDATED_NOT_SERVED');
      assert.equal(row.comparisonState, 'NOT_ADMITTED');
      assert.equal(row.marketState, 'DARK_REVIEW_ONLY');
      assert.equal(row.card?.authority_state, 'VALIDATED_NOT_SERVED');
    }
    const liveCompanyRows = companyRows.filter((row) => !row.marketSkip);
    assert.equal(liveCompanyRows.length, 2);
    assert.deepEqual(
      liveCompanyRows.map((row) => row.card.provision_subtype).sort(),
      ['REP-T-ORGANIZATION', 'REP-T-BIOSIMILAR-EXCLUSIVITY-NOVEL'].sort(),
    );

    const targetPreviewRow = darkCompanyRows.find((row) => row.card?.id === targetCard.id);
    assert.ok(targetPreviewRow);
    assert.equal(targetPreviewRow.materiality?.label, 'MAE-qualified');
    assert.equal(targetPreviewRow.knowledge?.label, 'Knowledge-qualified');
    assert.equal(targetPreviewRow.label, 'Organization; Qualification; Standing (Canonical V2 preview)');

    // Open-world evidence has no party signal (no provision_instance_id to
    // join, hence no REP-T-/REP-B- code) -- it never surfaces in either
    // party's rows.
    assert.equal(companyRows.some((row) => row.card?.id === openWorldCard.id), false);

    const parentRows = parentRepresentationsConfig.selectRows(mergedWithPreview).filter((row) => row.kind === 'rep');
    assert.equal(parentRows.length, 2);
    const darkParentRows = parentRows.filter((row) => row.marketSkip === true);
    assert.equal(darkParentRows.length, 1);
    assert.equal(darkParentRows[0].materiality?.label, 'True in all material respects');
    assert.equal(darkParentRows[0].knowledge, null);
    assert.equal(parentRows.some((row) => row.card?.id === openWorldCard.id), false);

    // marketSkip + DARK_REVIEW_ONLY takes the row out of market coverage
    // entirely (lib/market-metrics/section-rows.js's generic mechanism --
    // the same one material-contracts.config.js relies on).
    const companySection = { id: 'representations-qualifiers', config: representationsQualifiersConfig };
    const marketRows = enumerateMarketSectionRows(companySection, mergedWithPreview);
    assert.equal(marketRows.length, 2);
    assert.equal(marketRows.every(({ row }) => !row.marketSkip), true);

    // Dark preview rows carry comparisonState NOT_ADMITTED -- safeRows()
    // (components/review-v2/CompareColumn.jsx) strips them before anything
    // reaches cross-deal comparison.
    const safeCompanyRows = safeRows(representationsQualifiersConfig, mergedWithPreview);
    assert.equal(safeCompanyRows.some((row) => row.marketSkip), false);
    assert.equal(safeCompanyRows.filter((row) => row.kind === 'rep').length, 2);
  }

  // Gate off again, SAME merged reviewDeal: dark rows vanish, live rows are
  // byte-for-byte the same rows as before -- proving the preview is purely
  // additive and purely gated, not baked into the merge itself.
  assert.equal(process.env.CANONICAL_V2_DARK_BRIDGE, undefined);
  const companyRowsGateOff = representationsQualifiersConfig.selectRows(merged).filter((row) => row.kind === 'rep');
  assert.equal(companyRowsGateOff.length, 2);
  assert.equal(companyRowsGateOff.some((row) => row.marketSkip), false);
  assert.equal(companyRowsGateOff.some((row) => /\(Canonical V2 preview\)/.test(row.label)), false);
});

// --- F3 regression coverage: chained-merge receipt accumulation ------------
// lib/canonical-v2/review-preview-assembly.js merges all four families'
// dark bridges into ONE review deal, in a fixed order. Before the fix, each
// of three families' merges (this one, legacy-card-bridge.js,
// general-covenants-dark-bridge.js) wrote canonical_v2_bridge_receipts by
// REPLACEMENT, so only the last of the three to merge kept its receipt --
// the other two's provenance binding was silently lost. canonical_v2_bridge_
// receipts now accumulates across the chain instead. (This family merges
// LAST in the real assembler's fixed order, which is exactly why its own
// receipt was the one that used to survive -- see
// tests/canonical-v2-review-preview-end-to-end.test.js for the full
// four-family proof.)

test("canonical_v2_bridge_receipts: a virgin merge yields exactly one receipt bearing this bridge's own identity (F3)", () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });

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

test('canonical_v2_bridge_receipts: appends to receipts a prior family already left, preserving them in order, rather than replacing them (F3)', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
  const priorReceipt = Object.freeze({
    schema_version: 'CANONICAL_V2_NO_OTHER_REPS_FRAUD_LEGACY_CARD_BRIDGE/V1',
    bridge_id: 'a'.repeat(64),
    source_projection_id: 'b'.repeat(64),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
  const reviewDealWithPriorReceipt = { ...legacyReviewDeal, canonical_v2_bridge_receipts: [priorReceipt] };
  const merged = mergeCanonicalV2CardsIntoReviewDeal(reviewDealWithPriorReceipt, bridge, { env: ENABLED_ENV });

  assert.equal(
    merged.canonical_v2_bridge_receipts.length,
    2,
    "the prior receipt must survive, and this bridge's own must be appended, not replace it",
  );
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceipt);
  assert.equal(merged.canonical_v2_bridge_receipts[1].bridge_id, bridge.bridge_id);
  assert.equal(merged.canonical_v2_bridge_receipts[1].schema_version, BRIDGE_SCHEMA);
});

test('canonical_v2_bridge_receipts: merging the same bridge twice does not duplicate its receipt (F3)', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
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
  const reviewDealWithPriorReceipt = { ...legacyReviewDeal, canonical_v2_bridge_receipts: [priorReceiptForSameBridge] };
  const merged = mergeCanonicalV2CardsIntoReviewDeal(reviewDealWithPriorReceipt, bridge, { env: ENABLED_ENV });
  assert.equal(merged.canonical_v2_bridge_receipts.length, 1, 'a receipt already present for this bridge_id must not be duplicated');
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceiptForSameBridge);
});

test('provision grouping: records that disagree within one provision group fail closed rather than being smoothed over', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeParent: false, includeOpenWorld: false });
  const targetProvisionInstanceId = seedId(FIXTURE.target_representation.provision_instance_id_seed);
  const siblingIndices = projection.records
    .map((record, index) => (record.provision_instance_id === targetProvisionInstanceId ? index : -1))
    .filter((index) => index !== -1);
  assert.equal(siblingIndices.length, 2, 'fixture must produce two sibling claims on the same provision');

  // Two records share provision_instance_id (both target org claims) but the
  // SECOND one's concept_key is mutated to something else entirely, then
  // resealed so only the semantic cross-record grouping check can catch it
  // (query/compare are kept internally consistent with each other, and the
  // record's own content hash is fixed up, so nothing but the group-level
  // agreement check fires).
  const mismatched = structuredClone(projection);
  const [, mutateIndex] = siblingIndices;
  mismatched.records[mutateIndex].query.value = { ...mismatched.records[mutateIndex].query.value, concept_key: 'REP-T-ORGANIZATION-DRIFTED' };
  mismatched.records[mutateIndex].compare.value = { ...mismatched.records[mutateIndex].compare.value, concept_key: 'REP-T-ORGANIZATION-DRIFTED' };
  resealRecordAt(mismatched, mutateIndex);
  resealProjection(mismatched);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(mismatched, legacyReviewDeal, ENABLED_ENV),
    bridgeError('PROVISION_GROUP_MISMATCH'),
  );
});

test('no closed representation-subject catalogue: a never-catalogued concept key bridges through the legacy join, not a hardcoded dictionary', () => {
  const projection = buildProjection({
    includeTarget: false, includeKnowledge: false, includeParent: false, includeOpenWorld: false, includeNovel: true,
  });
  const legacyReviewDeal = buildLegacyReviewDeal();
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
  assert.equal(bridge.cards.length, 1);
  const [card] = bridge.cards;
  // provision_subtype is the raw concept_key, verbatim -- not remapped
  // through any lookup table.
  assert.equal(card.provision_subtype, 'REP-T-BIOSIMILAR-EXCLUSIVITY-NOVEL');
  // short_title comes from the joined legacy card's OWN short_title, not
  // from any dictionary keyed on the concept code.
  assert.equal(card.short_title, 'Biosimilar Exclusivity Period');

  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  const { representationsQualifiersConfig } = loadRepresentationsConfigModule();
  {
    const rows = representationsQualifiersConfig.selectRows(withPreviewEnabled(merged)).filter((row) => row.kind === 'rep' && row.marketSkip);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, 'Biosimilar Exclusivity Period (Canonical V2 preview)');
  }

  const bridgeSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'canonical-v2', 'representations-dark-bridge.js'),
    'utf8',
  );
  // No dictionary anywhere in the bridge maps a representation SUBJECT code
  // to a hand-authored name (EXCLUDED_CONCEPTS and EXPECTED_MARKET_SHAPE are
  // closed QUALIFIER-kind/ownership vocabularies, not subject catalogues).
  assert.doesNotMatch(bridgeSource, /REP-T-ORGANIZATION['"]:\s*['"]/);
  assert.doesNotMatch(bridgeSource, /concept.{0,20}(?:label|title|name)s?\s*[:=]\s*\{/i);
});

test('the bridge fails closed on authority tampering, altered claim content, excluded family ownership, malformed identity, unresolved and ambiguous joins, and ungrounded quotes', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();

  // Wrong authority (bridge-envelope level, no reseal needed -- authority is
  // checked before the content-hash check).
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const baseBridge = bridgeRepresentationRecordsToLegacyShape(baseProjection, legacyReviewDeal, ENABLED_ENV);
  const wrongAuthority = structuredClone(baseBridge);
  wrongAuthority.authority_state = 'SERVED';
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, wrongAuthority, { env: ENABLED_ENV }),
    bridgeError('WRONG_AUTHORITY'),
  );

  // Malformed projection identity: mutate a field nothing else
  // cross-validates, without resealing -- must fail purely on the hash.
  const staleRecord = structuredClone(baseProjection);
  staleRecord.records[0].evidence.category = 'TAMPERED_CATEGORY';
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(staleRecord, legacyReviewDeal, ENABLED_ENV),
    bridgeError('STALE_RECORD_ID'),
  );

  const staleProjection = structuredClone(baseProjection);
  staleProjection.records[0].evidence.category = 'TAMPERED_CATEGORY';
  resealRecordAt(staleProjection, 0);
  // projection_id intentionally left stale.
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(staleProjection, legacyReviewDeal, ENABLED_ENV),
    bridgeError('STALE_PROJECTION_ID'),
  );

  // Altered claim content: query/compare diverge (resealed, so only the
  // semantic cross-check can catch it).
  const alteredCompare = structuredClone(baseProjection);
  alteredCompare.records[0].compare.value = { ...alteredCompare.records[0].compare.value, canonical_value: 'MAT_ALL_RESPECTS' };
  resealRecordAt(alteredCompare, 0);
  resealProjection(alteredCompare);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(alteredCompare, legacyReviewDeal, ENABLED_ENV),
    bridgeError('ALTERED_CLAIM_CONTENT'),
  );

  // Excluded family ownership: the upstream projection module itself
  // refuses to construct this, so the hostile input is assembled by
  // tampering with an otherwise-valid, already-projected record and
  // resealing it -- proving THIS bridge's own mirrored EXCLUDED_CONCEPTS
  // guard, independent of upstream.
  const excludedConcept = structuredClone(baseProjection);
  excludedConcept.records[0].query.value = { ...excludedConcept.records[0].query.value, concept_key: 'REP-T-MATERIAL-CONTRACTS' };
  excludedConcept.records[0].compare.value = { ...excludedConcept.records[0].compare.value, concept_key: 'REP-T-MATERIAL-CONTRACTS' };
  resealRecordAt(excludedConcept, 0);
  resealProjection(excludedConcept);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(excludedConcept, legacyReviewDeal, ENABLED_ENV),
    bridgeError('EXCLUDED_FAMILY_OWNERSHIP'),
  );

  // Malformed identity: provision_instance_id is not lower-case SHA-256.
  const badIdentity = structuredClone(baseProjection);
  badIdentity.records[0].provision_instance_id = 'not-a-sha256-value';
  resealRecordAt(badIdentity, 0);
  resealProjection(badIdentity);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(badIdentity, legacyReviewDeal, ENABLED_ENV),
    bridgeError('INVALID_IDENTITY'),
  );

  // Unresolved join: a validly-constructed projection whose provision does
  // not correspond to any legacy card in the target reviewDeal.
  const orphanEntry = buildResolvedEntry({
    provision_instance_id_seed: `${FIXTURE.deal_id}:rep-t-nonexistent`,
    concept_key: 'REP-T-NONEXISTENT',
    section_reference: '3.77',
    representation_maker: 'the Company',
    representation_maker_capacity: 'TARGET',
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    canonical_value: 'MAT_ALL_RESPECTS',
    quote: 'A representation with no corresponding legacy card.',
    qualifier_kind: 'ALL_RESPECTS_STANDARD',
  });
  const orphanProjection = projectRepresentationClaims({ resolved_entries: [orphanEntry], open_world_entries: [] });
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(orphanProjection, legacyReviewDeal, ENABLED_ENV),
    bridgeError('PROVISION_JOIN_NOT_FOUND'),
  );

  // Ambiguous join: two legacy cards share the same provision_instance_id.
  const duplicatedCards = legacyCardsFromFixture();
  const orgCard = duplicatedCards.find((card) => card.provision_subtype === 'REP-T-ORGANIZATION');
  duplicatedCards.push({ ...orgCard, id: `${orgCard.id}-duplicate`, excerpt_id: `${orgCard.excerpt_id}-duplicate` });
  const ambiguousReviewDeal = buildLegacyReviewDeal(duplicatedCards);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(baseProjection, ambiguousReviewDeal, ENABLED_ENV),
    bridgeError('AMBIGUOUS_PROVISION_JOIN'),
  );

  // Section reference mismatch: claim cites a different section than its
  // joined legacy provision.
  const sectionMismatch = structuredClone(baseProjection);
  sectionMismatch.records[0].review = { ...sectionMismatch.records[0].review, source_section_reference: '99.99' };
  resealRecordAt(sectionMismatch, 0);
  resealProjection(sectionMismatch);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(sectionMismatch, legacyReviewDeal, ENABLED_ENV),
    bridgeError('SECTION_REFERENCE_MISMATCH'),
  );

  // Quote not grounded: the claim's evidence quote does not occur verbatim
  // in its joined legacy provision's retained text.
  const ungroundedQuote = structuredClone(baseProjection);
  const fabricated = 'This sentence never appears anywhere in the legacy agreement text.';
  ungroundedQuote.records[0].evidence = { ...ungroundedQuote.records[0].evidence, quote: fabricated };
  resealRecordAt(ungroundedQuote, 0);
  resealProjection(ungroundedQuote);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(ungroundedQuote, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );

  // ID collision at merge time, and a wrong-shape bridge envelope.
  const collidingLegacyDeal = {
    ...legacyReviewDeal,
    cards: legacyReviewDeal.cards.map((card, index) => (index === 0 ? { ...card, id: baseBridge.cards[0].id } : card)),
  };
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(collidingLegacyDeal, baseBridge, { env: ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, baseBridge.cards, { env: ENABLED_ENV }),
    bridgeError('INVALID_BRIDGE_ENVELOPE'),
  );
});

test('open-world reconciliation: a bridge whose evidence card and open_items no longer correspond one-to-one fails closed', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: true });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
  const evidenceCard = bridge.cards.find((card) => card.canonical_v2_lineage.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE');
  assert.ok(evidenceCard);

  const droppedCard = structuredClone(bridge);
  droppedCard.cards = droppedCard.cards.filter((card) => card.id !== evidenceCard.id);
  resealBridge(droppedCard);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, droppedCard, { env: ENABLED_ENV }),
    bridgeError('OPEN_WORLD_RECONCILIATION_FAILED'),
  );

  const droppedItem = structuredClone(bridge);
  droppedItem.open_items = [];
  resealBridge(droppedItem);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, droppedItem, { env: ENABLED_ENV }),
    bridgeError('OPEN_WORLD_RECONCILIATION_FAILED'),
  );
});

test('the bridge remains a pure dark module with no page import, no database call and no network call', () => {
  const bridgePath = path.join(__dirname, '..', 'lib', 'canonical-v2', 'representations-dark-bridge.js');
  const source = fs.readFileSync(bridgePath, 'utf8');
  assert.doesNotMatch(source, /supabase|\bfetch\b|pages\//i);
  assert.doesNotMatch(source, /child_process/i);
  assert.doesNotMatch(source, /\.(?:insert|upsert|update)\s*\(/i);
  assert.doesNotMatch(source, /require\(['"]fs['"]\)|require\(['"]node:fs['"]\)/);

  function listFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : [target];
    });
  }
  const pagesDirectory = path.join(__dirname, '..', 'pages');
  const pageImports = listFiles(pagesDirectory)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => /(?:require\s*\(|from\s+)[^\n]*representations-dark-bridge/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(pageImports, []);
});

// The same gate-ordering defect found in the General Covenants bridge: merge validated the
// envelope before checking the gate, so a hand-authored self-consistent envelope could
// merge dark cards with the gate off without ever calling the builder that checks it.
test('every public bridge entry point refuses before any other validation when the gate is off', () => {
  const bridgeModule = require('../lib/canonical-v2/representations-dark-bridge');
  const disabled = {};
  for (const name of ['bridgeRepresentationRecordsToLegacyShape', 'mergeCanonicalV2CardsIntoReviewDeal']) {
    assert.throws(
      () => bridgeModule[name]({ dealId: 'deal-1', cards: [], claims: [] }, {}, { env: disabled }),
      (error) => error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED',
      `${name} must refuse on the gate before validating anything else`,
    );
  }
});

// --- excerpt_id is not identity (programme-wide rule) -----------------------
// excerpt_id is carried citation data, never a unique card identity: card
// identity binds the deal, the provision, the exact source span, the
// occurrence and the source revision -- provision_instance_id (which this
// family aliases onto id), never excerpt_id. See
// lib/canonical-v2/no-other-reps-fraud-dark-bridge.js (the exemplar) for
// why: a non-reliance acknowledgment and its auto-derived extra-contractual
// sibling legitimately quote the SAME source sentence.

// Builds a legacyReviewDeal with one EXTRA representation card, deliberately
// given the SAME excerpt_id as the fixture's own rep-t-organization card but
// a DISTINCT provision_instance_id -- exactly the real-world shape this
// bridge's own excerpt_id derivation (borrowed from the joined legacy card)
// produces whenever two different legacy provisions already share one
// excerpt_id (e.g. a merged-in non-reliance/extra-contractual pair).
function buildLegacyReviewDealWithExcerptSibling() {
  const baseCards = legacyCardsFromFixture();
  const orgCard = baseCards.find((card) => card.provision_subtype === 'REP-T-ORGANIZATION');
  const siblingSeed = `${FIXTURE.deal_id}:rep-t-organization-excerpt-sibling`;
  const siblingProvisionInstanceId = seedId(siblingSeed);
  const siblingCard = {
    id: siblingProvisionInstanceId,
    deal_id: FIXTURE.deal_id,
    provision_instance_id: siblingProvisionInstanceId,
    excerpt_id: orgCard.excerpt_id,
    section_ref: '3.1-sibling',
    short_title: 'Organization Sibling (excerpt-sharing probe)',
    kind: 'standard',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-ORGANIZATION-SIBLING',
    primary_quote: 'The Company additionally represents, in a wholly separate provision, that its sibling organizational status is likewise duly maintained.',
    region_full_text: 'The Company additionally represents, in a wholly separate provision, that its sibling organizational status is likewise duly maintained.',
    references: [],
  };
  const reviewDeal = buildLegacyReviewDeal([...baseCards, siblingCard]);
  return { reviewDeal, siblingSeed, siblingCard, orgCard };
}

test('excerpt_id is not identity: two distinct provisions may legitimately join to legacy cards sharing one excerpt_id, and bridge+merge succeed', () => {
  const { reviewDeal, siblingSeed, siblingCard } = buildLegacyReviewDealWithExcerptSibling();
  const siblingEntry = buildResolvedEntry({
    provision_instance_id_seed: siblingSeed,
    concept_key: siblingCard.provision_subtype,
    section_reference: siblingCard.section_ref,
    representation_maker: 'the Company',
    representation_maker_capacity: 'TARGET',
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    canonical_value: 'MAT_ALL_RESPECTS',
    quote: siblingCard.primary_quote,
    qualifier_kind: 'ALL_RESPECTS_STANDARD',
  });
  const projection = projectRepresentationClaims({
    resolved_entries: [targetAccuracyEntry(), siblingEntry],
    open_world_entries: [],
  });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal, ENABLED_ENV);
  assert.equal(bridge.cards.length, 2);

  const targetCard = bridge.cards.find((card) => card.provision_subtype === 'REP-T-ORGANIZATION');
  const siblingBridgeCard = bridge.cards.find((card) => card.provision_subtype === 'REP-T-ORGANIZATION-SIBLING');
  assert.ok(targetCard);
  assert.ok(siblingBridgeCard);
  assert.equal(targetCard.excerpt_id, siblingBridgeCard.excerpt_id);
  assert.notEqual(targetCard.id, siblingBridgeCard.id);
  assert.notEqual(targetCard.provision_instance_id, siblingBridgeCard.provision_instance_id);

  const merged = mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, reviewDeal.cardCount + 2);
  assert.equal(merged.claims.length, bridge.claims.length);
  assert.ok(merged.cards.some((card) => card.id === targetCard.id));
  assert.ok(merged.cards.some((card) => card.id === siblingBridgeCard.id));

  // Genuine identity collisions must still fail closed: re-merging the SAME
  // bridge cards into the reviewDeal that already carries them must still
  // throw ID_COLLISION on their id/provision_instance_id -- not be silently
  // waved through because their excerpt_id happens to be shared.
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(merged, bridge, { env: ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
});

test('cross-family merge: No Other Reps / Fraud bridge output (whose own non-reliance/extra-contractual pair legitimately shares one excerpt_id) merges first, then Representations bridge output merges into the SAME reviewDeal without ID_COLLISION', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();

  const a = NORF_FIXTURE.assertions;
  const norfSourceText = [
    a.no_other_reps.assertion_quote,
    a.non_reliance.assertion_quote,
    a.independent_investigation.assertion_quote,
    a.fraud_carveout.assertion_quote,
    a.willful_breach_definition.definition_quote,
  ].join('\n');
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
  // Deliberately bridged under the REPRESENTATIONS deal_id (not NORF's own
  // fixture deal_id) so both families' output lands in the SAME reviewDeal
  // below -- deal_id is bridge-time-supplied for this family, never baked
  // into its projection.
  const norfBridge = bridgeNoOtherRepsFraudCardsToLegacyShape(norfProjection, {
    deal_id: FIXTURE.deal_id, resolved: receipt.resolved, env: ENABLED_ENV,
  });
  assert.equal(norfBridge.cards.length, 6);

  const nonReliance = norfBridge.cards.find((card) => card.short_title === 'Non-reliance');
  const extraContractual = norfBridge.cards.find((card) => card.short_title === 'Extra-contractual disclaimer');
  assert.ok(nonReliance);
  assert.ok(extraContractual);
  // The exact precondition the bug description names: two distinct cards
  // from the SAME family sharing one excerpt_id, already present in the
  // reviewDeal before Representations ever merges.
  assert.equal(nonReliance.excerpt_id, extraContractual.excerpt_id);
  assert.notEqual(nonReliance.id, extraContractual.id);

  const afterNorf = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(
    legacyReviewDeal,
    norfBridge,
    { env: ENABLED_ENV },
  );
  assert.equal(afterNorf.cardCount, legacyReviewDeal.cardCount + 6);

  // The Representations bridge joins against afterNorf (not the original
  // legacyReviewDeal) -- proving the legacy provision join still resolves
  // correctly with unrelated dark cards from another family already mixed
  // into reviewDeal.cards.
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const representationsBridge = bridgeRepresentationRecordsToLegacyShape(projection, afterNorf, ENABLED_ENV);

  // This is the regression: before the fix, merge reserved excerpt_id
  // across the WHOLE reviewDeal before looking at its own incoming cards,
  // so this threw ID_COLLISION the moment it reached the second card of the
  // NORF pair above. It must now succeed.
  const afterBoth = mergeCanonicalV2CardsIntoReviewDeal(afterNorf, representationsBridge, { env: ENABLED_ENV });
  assert.equal(afterBoth.cardCount, afterNorf.cardCount + representationsBridge.cards.length);
  assert.ok(afterBoth.cards.some((card) => card.id === representationsBridge.cards[0].id));
  assert.ok(afterBoth.cards.some((card) => card.id === nonReliance.id));
  assert.ok(afterBoth.cards.some((card) => card.id === extraContractual.id));
});

// --- gate-integrity regression coverage (F2/F6/F9) --------------------------
// adaptProvisionGroupToLegacyCard and adaptOpenWorldRecordToLegacyCard used
// to be exported with no gate of their own, even though both mint fully
// authority-stamped records (F2) -- they are no longer exported (nothing
// outside this module called them; see the module's own module.exports
// comment). validateBridgeEnvelope had no gate at all (F6). merge used
// `env || process.env`, which cannot tell an explicit falsy env from one
// never supplied (F9); bridgeRepresentationRecordsToLegacyShape already used
// arguments.length correctly and is included here only for completeness.
// This section proves every exported function that mints or validates a
// record refuses under production, and that an explicit falsy env (or an
// options object missing its env key) refuses rather than silently falling
// back to an enabled ambient process.env.

function gateRefusal(error) {
  return error instanceof DarkBridgeGateError && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED';
}

// CI is cleared alongside the flag, and that is load-bearing rather than
// tidiness. The gate refuses on several independent clauses, one of which is
// a truthy CI. GitHub Actions sets CI=true, so a helper that enables only the
// flag produces an ambient environment the gate still refuses, and every test
// asserting "omitting env falls back to the enabled ambient env" fails on CI
// while passing on a developer machine where CI is unset. That is exactly what
// happened: these tests were green locally and red on the first pull request.
//
// This weakens nothing. The CI clause has its own dedicated tests in
// tests/canonical-v2-dark-bridge-gate.test.js, which assert it refuses for
// '1', 'true' and 'TRUE'. What these tests are about is the env-argument
// fallback, so the environment they construct must isolate that one variable.
function withAmbientDarkBridgeEnabled(fn) {
  const key = 'CANONICAL_V2_DARK_BRIDGE';
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const previous = process.env[key];
  const hadCi = Object.prototype.hasOwnProperty.call(process.env, 'CI');
  const previousCi = process.env.CI;
  process.env[key] = 'ENABLED_LOCAL_PREPRODUCTION';
  delete process.env.CI;
  try {
    return fn();
  } finally {
    if (had) process.env[key] = previous;
    else delete process.env[key];
    if (hadCi) process.env.CI = previousCi;
    else delete process.env.CI;
  }
}

test('every minting/validating export refuses under a production env, flag or no flag', () => {
  const dummyProjection = { records: [] };
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };
  const dummyBridge = {};

  for (const productionEnv of [
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'production' },
    { VERCEL: '1', VERCEL_ENV: 'production' },
  ]) {
    assert.throws(
      () => bridgeRepresentationRecordsToLegacyShape(dummyProjection, dummyReviewDeal, productionEnv),
      gateRefusal,
      `bridgeRepresentationRecordsToLegacyShape must refuse under ${JSON.stringify(productionEnv)}`,
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
  const dummyProjection = { records: [] };
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };
  const dummyBridge = {};

  withAmbientDarkBridgeEnabled(() => {
    for (const env of [undefined, null]) {
      assert.throws(
        () => bridgeRepresentationRecordsToLegacyShape(dummyProjection, dummyReviewDeal, env),
        gateRefusal,
        `bridgeRepresentationRecordsToLegacyShape must refuse on explicit env=${env}`,
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
    // above threw because of the explicit/missing env, not because the gate
    // is unconditionally broken. validateBridgeEnvelope gets past the gate
    // and fails on bridge shape instead.
    assert.throws(
      () => validateBridgeEnvelope(dummyBridge),
      (error) => !(error instanceof DarkBridgeGateError),
      'omitting env entirely must fall back to the now-enabled ambient process.env',
    );
  });
});

test('adaptProvisionGroupToLegacyCard and adaptOpenWorldRecordToLegacyCard are no longer part of the public surface', () => {
  const bridgeModule = require('../lib/canonical-v2/representations-dark-bridge');
  assert.equal(Object.hasOwn(bridgeModule, 'adaptProvisionGroupToLegacyCard'), false);
  assert.equal(Object.hasOwn(bridgeModule, 'adaptOpenWorldRecordToLegacyCard'), false);
});

// --- hostile grounding tests (word-boundary vs equality; slice not sound here) --
// Every check below defeats the same underlying flaw: plain String.includes()
// accepts any substring that occurs anywhere in the source text, regardless
// of whether the substring preserves the source's meaning. These cases probe
// both entry points the fix touches -- the fresh BUILD path
// (adaptProvisionGroupToLegacyCard, exercised via
// bridgeRepresentationRecordsToLegacyShape) and the untrusted-envelope
// RE-VALIDATION path (assertCardShape/assertClaimShape, exercised via
// validateBridgeEnvelope/mergeCanonicalV2CardsIntoReviewDeal) -- the second
// is the one this bridge's own threat model documents as reachable by a
// hand-tampered envelope that never went through the builder at all.

// FIXED (was "KNOWN LIMITATION (build path)"; see docs/codex-program/notes/
// negation-reversal.md): when a hostile PROJECTION presents an already-
// negation-stripped fragment as evidence.quote, adaptProvisionGroupToLegacyCard
// has no PRIOR, correct value to compare it against -- this IS the first
// time the bridge ever sees this claim. It used to ask only "does this
// candidate occur, word-boundary-anchored, in the legacy text", which a
// fragment like this satisfies by construction. locateGrounding now also
// requires lib/negation-boundary-guard.js's hasUnclosedNegationBeforeSpan to
// clear at the matched position -- a fragment whose immediate governing
// clause carries a negation it does not itself include is no longer
// "grounded" at all, at the SAME checkpoint that also computes verbatim_span,
// so the build path and the re-validation path (test directly below) now
// share one closed mechanism instead of the build path being the open half.
test('FIXED (build path): a negation-stripped fragment presented as a FRESH quote is rejected', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });

  // This fixture's own accuracy-standard quote equals its legacy card's
  // FULL region_full_text verbatim (see representations-dark-review.json),
  // so the fragment below is a genuine, word-boundary-aligned substring of
  // region_full_text (it starts right after "would not ", a real space
  // boundary, and ends right before a comma) -- word-boundary anchoring
  // alone would still accept it; only the negation guard closes this.
  const fragment = 'have a Company Material Adverse Effect';
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.includes(fragment));
  const negationStripped = structuredClone(baseProjection);
  negationStripped.records[0].evidence = { ...negationStripped.records[0].evidence, quote: fragment };
  resealRecordAt(negationStripped, 0);
  resealProjection(negationStripped);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(negationStripped, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test('quote grounding (re-validation path, tier 1): a negation-stripped fragment is rejected on a hand-tampered bridge envelope that leaves its span stale, independent of the builder', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);

  const fragment = 'have a Company Material Adverse Effect';
  const tampered = structuredClone(bridge);
  const card = tampered.cards.find((entry) => entry.provision_subtype === 'REP-T-ORGANIZATION');
  const claim = tampered.claims.find((entry) => entry.attribute === 'materialityQualifier');
  // Only the TEXT fields are tampered -- verbatim_span is left exactly as
  // the builder computed it against the ORIGINAL, genuine quote. This is
  // the realistic attack: an envelope that changes what a claim SAYS
  // without also recomputing the position that used to back it up.
  assert.ok(claim.verbatim_span);
  card.features.materialityQualifier = { ...card.features.materialityQualifier, text: fragment };
  card.ai_metadata = { ...card.ai_metadata, features: card.features };
  claim.verbatim = fragment;
  claim.evidence_quote = fragment;
  claim.canonical = { ...claim.canonical, text: fragment };
  resealBridge(tampered);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, tampered, { env: ENABLED_ENV }),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test('quote grounding: a word-boundary flip ("accurate" sliced out of "inaccurate") is rejected', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.includes('inaccurate'));
  const flipped = structuredClone(baseProjection);
  flipped.records[0].evidence = { ...flipped.records[0].evidence, quote: 'accurate' };
  resealRecordAt(flipped, 0);
  resealProjection(flipped);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(flipped, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test('quote grounding: a truncated prefix ("The C" sliced out of "The Company") is rejected', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.startsWith('The Company'));
  const truncated = structuredClone(baseProjection);
  truncated.records[0].evidence = { ...truncated.records[0].evidence, quote: 'The C' };
  resealRecordAt(truncated, 0);
  resealProjection(truncated);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(truncated, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test('quote grounding: an arbitrary mid-quote substring (word-boundary-violating on both edges) is rejected', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  // "ration duly organiz" -- a real substring of region_full_text (out of
  // "corporation duly organized"), but it starts and ends mid-word.
  const midWord = 'ration duly organiz';
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.includes(midWord));
  const arbitrary = structuredClone(baseProjection);
  arbitrary.records[0].evidence = { ...arbitrary.records[0].evidence, quote: midWord };
  resealRecordAt(arbitrary, 0);
  resealProjection(arbitrary);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(arbitrary, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test("quote grounding: a fragment that appears only in a DIFFERENT card's text is rejected against its own", () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  // Genuine substring of the PARENT card's own region_full_text, absent
  // from the TARGET card's own text -- records[0] here is the TARGET claim.
  const parentOnlyFragment = 'Parent is a corporation duly organized';
  assert.ok(FIXTURE.legacy_cards[1].region_full_text.includes(parentOnlyFragment));
  assert.ok(!FIXTURE.legacy_cards[0].region_full_text.includes(parentOnlyFragment));
  const crossCard = structuredClone(baseProjection);
  crossCard.records[0].evidence = { ...crossCard.records[0].evidence, quote: parentOnlyFragment };
  resealRecordAt(crossCard, 0);
  resealProjection(crossCard);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(crossCard, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});

test("quote grounding: canonical.text diverging from the claim's own verbatim is rejected even though both independently pass grounding on their own", () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: false, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);

  // claim.verbatim stays the genuine, fully-grounded quote (passes
  // QUOTE_NOT_GROUNDED on its own); claim.canonical.text -- and, kept
  // consistent with it, card.features.materialityQualifier.text -- are set
  // to a DIFFERENT sub-phrase that is ALSO independently grounded (word-
  // boundary anchored) in the same region_full_text. Keeping the card
  // feature consistent with claim.canonical isolates the NEW canonical-vs-
  // verbatim cross-check added in this fix from the pre-existing card-
  // feature-vs-canonical check (both share the INVALID_CLAIM_CONTRACT code,
  // so without this the pre-existing check would fire first and this test
  // would give the new check zero actual coverage).
  const tampered = structuredClone(bridge);
  const card = tampered.cards.find((entry) => entry.provision_subtype === 'REP-T-ORGANIZATION');
  const claim = tampered.claims.find((entry) => entry.attribute === 'materialityQualifier');
  const divergentButGrounded = 'have a Company Material Adverse Effect';
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.includes(divergentButGrounded));
  assert.notEqual(divergentButGrounded, claim.verbatim);
  card.features.materialityQualifier = { ...card.features.materialityQualifier, text: divergentButGrounded };
  card.ai_metadata = { ...card.ai_metadata, features: card.features };
  claim.canonical = { ...claim.canonical, text: divergentButGrounded };
  resealBridge(tampered);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, tampered, { env: ENABLED_ENV }),
    bridgeError('INVALID_CLAIM_CONTRACT'),
  );
});

test('quote grounding: the legitimate whole-text accuracy quote and a legitimate knowledge sub-phrase both still pass', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const projection = buildProjection({ includeKnowledge: true, includeParent: false, includeOpenWorld: false });
  const bridge = bridgeRepresentationRecordsToLegacyShape(projection, legacyReviewDeal, ENABLED_ENV);
  const targetCard = bridge.cards.find((card) => card.provision_subtype === 'REP-T-ORGANIZATION');

  // Accuracy: quote equals the card's full region_full_text -- the exact-
  // equality tier applies directly, no containment needed.
  assert.equal(targetCard.features.materialityQualifier.text, targetCard.region_full_text);

  // Knowledge: quote is a genuine, shorter sub-phrase of region_full_text --
  // this family has no sound offset source for this checkpoint (see the
  // groundedInSource header comment in representations-dark-bridge.js), so
  // this is verified at the anchored-containment tier, the honest ceiling.
  const knowledgeClaim = bridge.claims.find((claim) => claim.attribute === 'knowledgeQualifier');
  assert.ok(knowledgeClaim);
  assert.ok(targetCard.region_full_text.length > knowledgeClaim.verbatim.length);
  assert.ok(targetCard.region_full_text.includes(knowledgeClaim.verbatim));

  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + bridge.cards.length);
  // Re-validation path accepts the same legitimate bridge unchanged too.
  assert.doesNotThrow(() => validateBridgeEnvelope(bridge, ENABLED_ENV));
});

// FIXED (was "KNOWN LIMITATION"; see docs/codex-program/notes/negation-
// reversal.md): negation-stripping within a claim whose LEGITIMATE quote is
// a genuine sub-phrase (shorter than its card's region_full_text -- e.g.
// this fixture's knowledge qualifier) used to escape word-boundary-anchored
// containment, because dropping a whole preceding word can never itself
// violate a word boundary. locateGrounding's hasUnclosedNegationBeforeSpan
// check does not need an independently-captured start/end offset to catch
// THIS shape: "no" is the negation cue here (see NEGATION_LEAD_IN_RES's
// narrow "no <noun>" list, which includes "no fact"), and it sits in the
// SAME clause as the fragment, well inside the lookback window.
test('FIXED: negation-stripping within a genuine sub-phrase quote is rejected', () => {
  const legacyReviewDeal = buildLegacyReviewDeal();
  const baseProjection = buildProjection({ includeKnowledge: true, includeParent: false, includeOpenWorld: false });
  const knowledgeIndex = baseProjection.records.findIndex((record) => (
    record.query.value.claim_definition_key === 'KNOWLEDGE_QUALIFIER'
  ));
  assert.notEqual(knowledgeIndex, -1);
  const original = baseProjection.records[knowledgeIndex].evidence.quote;
  assert.equal(original, FIXTURE.target_representation.knowledge.quote);

  // Drop the leading "the Company has actual knowledge of no " (including
  // the negation word "no") and keep the rest as a genuine, contiguous,
  // word-boundary-aligned SUFFIX of the original quote.
  const negated = 'fact that would render this representation inaccurate';
  assert.ok(original.endsWith(negated));
  assert.notEqual(negated, original);
  assert.ok(FIXTURE.legacy_cards[0].region_full_text.includes(negated));

  const tampered = structuredClone(baseProjection);
  tampered.records[knowledgeIndex].evidence = { ...tampered.records[knowledgeIndex].evidence, quote: negated };
  resealRecordAt(tampered, knowledgeIndex);
  resealProjection(tampered);
  assert.throws(
    () => bridgeRepresentationRecordsToLegacyShape(tampered, legacyReviewDeal, ENABLED_ENV),
    bridgeError('QUOTE_NOT_GROUNDED'),
  );
});
