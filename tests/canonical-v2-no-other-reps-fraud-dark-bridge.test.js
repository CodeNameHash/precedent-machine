'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  shapeNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-producer');
const {
  resolveNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-resolution');
const {
  PRODUCT_PROJECTION_SCHEMA,
  projectNoOtherRepsFraudProduct,
} = require('../lib/canonical-v2/no-other-reps-fraud-product-projection');
const {
  AUTHORITY_STATE,
  BRIDGE_SCHEMA,
  NoOtherRepsFraudDarkBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  adaptReviewFactToLegacyCard,
  bridgeNoOtherRepsFraudCardsToLegacyShape,
  mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal,
  validateBridgeEnvelope,
} = require('../lib/canonical-v2/no-other-reps-fraud-dark-bridge');
const { DarkBridgeGateError } = require('../lib/canonical-v2/dark-bridge-gate');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'dark-bridge',
  'no-other-reps-fraud-dark-review.json',
);
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const DISABLED_ENV = Object.freeze({});

function bridgeError(code) {
  return (error) => error instanceof NoOtherRepsFraudDarkBridgeError && error.code === code;
}

function gateError() {
  return (error) => error instanceof DarkBridgeGateError && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED';
}

function sourceTextFor(fixture) {
  const a = fixture.assertions;
  return [
    a.no_other_reps.assertion_quote,
    a.non_reliance.assertion_quote,
    a.independent_investigation.assertion_quote,
    a.fraud_carveout.assertion_quote,
    a.willful_breach_definition.definition_quote,
  ].join('\n');
}

// Runs the REAL producer + resolver + projection pipeline (no hand-rolled
// projection JSON) against representative source text, mirroring how
// tests/canonical-v2-no-other-reps-fraud-follow-on.test.js already
// exercises this exact family. Returns both the projection (the bridge's
// first input) and the resolver's own `resolved` array (the bridge's
// second, required input -- see the module header for why both are
// needed).
function buildRealProjectionAndResolution(fixture = FIXTURE) {
  const sourceText = sourceTextFor(fixture);
  const a = fixture.assertions;
  const parsed = {
    no_other_reps_assertions: [a.no_other_reps],
    non_reliance_assertions: [a.non_reliance],
    independent_investigation_assertions: [a.independent_investigation],
    fraud_carveout_assertions: [a.fraud_carveout],
    willful_breach_definitions: [a.willful_breach_definition],
    open_world_candidates: [],
  };
  const { proposals } = shapeNoOtherRepsFraudProposals(parsed, sourceText);
  assert.equal(proposals.length, 6, 'fixture must yield all six governed claim types');
  const receipt = resolveNoOtherRepsFraudProposals({
    proposals, source_text: sourceText, source_id: fixture.deal_id,
  });
  assert.equal(receipt.residuals.length, 0, 'fixture must resolve cleanly with no residuals');
  const projection = projectNoOtherRepsFraudProduct({ resolved: receipt.resolved });
  return { projection, resolved: receipt.resolved };
}

function buildLegacyReviewDeal(fixture = FIXTURE) {
  return shapeReviewDealRows(fixture.deal_id, structuredClone(fixture.legacy_cards), { claims: [] });
}

function resealProjection(projection) {
  projection.projection_id = contentId(PRODUCT_PROJECTION_SCHEMA, {
    schema_version: projection.schema_version,
    authority_state: projection.authority_state,
    review: projection.review,
    query: projection.query,
    compare: projection.compare,
    market: projection.market,
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
  });
  return bridge;
}

// Canonical V2 preview gate (components/review/table-configs/canonical-v2-
// preview-lane.js): no-other-reps-fraud.config.js now reads an explicit,
// server-stamped canonical_v2_preview_enabled boolean off the reviewDeal
// payload instead of isDarkBridgeIntegrationEnabled(process.env). The
// BRIDGE's own env gate (bridgeNoOtherRepsFraudCardsToLegacyShape /
// mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal, both still env-gated
// via their own `env` parameter above) is unrelated and untouched.
function withPreviewEnabled(reviewDeal) {
  return { ...reviewDeal, canonical_v2_preview_enabled: true };
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

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

// --- the shape adapter, tested on its own ----------------------------------

test('adaptReviewFactToLegacyCard sources every legacy field from real projection/resolution data or the supplied deal_id', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const resolvedIndex = new Map(resolved.map((item) => [item.resolution_id, item]));
  const fraudIndex = projection.review.findIndex((fact) => fact.label === 'Fraud carve-out');
  const fraudFact = projection.review[fraudIndex];
  const card = adaptReviewFactToLegacyCard(fraudFact, fraudIndex, {
    dealId: FIXTURE.deal_id,
    resolvedIndex,
    env: ENABLED_ENV,
  });

  assert.equal(card.deal_id, FIXTURE.deal_id);
  assert.equal(card.primary_quote, fraudFact.evidence);
  assert.equal(card.region_full_text, fraudFact.evidence);
  assert.equal(card.full_text, fraudFact.evidence);
  assert.equal(card.section_ref, fraudFact.source_section_reference);
  assert.equal(card.short_title, fraudFact.label);
  assert.equal(card.concept_key, fraudFact.concept_key);
  assert.equal(card.owner_family, fraudFact.owner_family);
  assert.equal(card.claim_definition_key, 'FRAUD_CARVEOUT_PRESENT');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.type, 'REP-B');
  assert.deepEqual(card.attributes, fraudFact.attributes);
  assert.equal(card.id, card.provision_instance_id);
  assert.ok(card.id.startsWith('cv2:'));

  // excerpt_id and lineage come from the matched RESOLVED item, not from
  // the projection (which drops both) and not from a synthesized value.
  const matched = resolvedIndex.get(fraudFact.row_id.slice('no-other-reps-fraud-'.length));
  assert.equal(card.excerpt_id, `cv2:${matched.claim.evidence[0].excerpt_id}`);
  assert.deepEqual(card.canonical_v2_lineage, {
    source: 'CANONICAL_V2_NATIVE_CLAIM',
    claim_revision_ids: [matched.claim.claim_revision_id],
  });
  assert.equal(Object.isFrozen(card), true);

  // The willful breach fact takes the DEFINITION branch, not REPRESENTATION.
  const willfulIndex = projection.review.findIndex((fact) => fact.label === 'Willful breach definition');
  const willfulCard = adaptReviewFactToLegacyCard(projection.review[willfulIndex], willfulIndex, {
    dealId: FIXTURE.deal_id,
    resolvedIndex,
    env: ENABLED_ENV,
  });
  assert.equal(willfulCard.provision_type, 'DEFINITION');
  assert.equal(willfulCard.type, 'DEF');
  assert.equal(willfulCard.concept_key, 'DEF-WILLFUL');
  assert.equal(willfulCard.owner_family, 'KEY_DEFINED_TERMS');

  // Non-reliance and its auto-derived extra-contractual sibling legitimately
  // quote the SAME source sentence, so they legitimately share excerpt_id --
  // this is not a collision, and provision_instance_id (not excerpt_id) is
  // what distinguishes the two cards.
  const nonRelianceIndex = projection.review.findIndex((fact) => fact.label === 'Non-reliance');
  const extraContractualIndex = projection.review.findIndex((fact) => fact.label === 'Extra-contractual disclaimer');
  const nonRelianceCard = adaptReviewFactToLegacyCard(projection.review[nonRelianceIndex], nonRelianceIndex, {
    dealId: FIXTURE.deal_id, resolvedIndex, env: ENABLED_ENV,
  });
  const extraContractualCard = adaptReviewFactToLegacyCard(projection.review[extraContractualIndex], extraContractualIndex, {
    dealId: FIXTURE.deal_id, resolvedIndex, env: ENABLED_ENV,
  });
  assert.equal(nonRelianceCard.excerpt_id, extraContractualCard.excerpt_id);
  assert.notEqual(nonRelianceCard.id, extraContractualCard.id);
});

// --- gate off: default, and always in production ---------------------------

test('gate off (default): the config output is unchanged and both bridge entry points refuse to run', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const legacyReviewDeal = buildLegacyReviewDeal();
  const before = structuredClone(legacyReviewDeal);

  const configModule = loadEsmModule('../components/review/table-configs/no-other-reps-fraud.config.js');
  const { noOtherRepsFraudConfig } = configModule;

  // This fixture's legacy cards carry no No Other Reps / Fraud signal, so
  // the pre-change and post-change selectRows both return []: the dark
  // preview path never fires when there is nothing dark to preview, and
  // this proves the new dark-card exclusion filter is a true no-op on data
  // that looks like every review deal in production today.
  const rows = noOtherRepsFraudConfig.selectRows(legacyReviewDeal);
  assert.deepEqual(rows, []);
  assert.deepEqual(legacyReviewDeal, before, 'selectRows must not mutate the review deal');

  assert.notEqual(process.env.CANONICAL_V2_DARK_BRIDGE, 'ENABLED_LOCAL_PREPRODUCTION');
  assert.throws(
    () => bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
      deal_id: FIXTURE.deal_id, resolved, env: DISABLED_ENV,
    }),
    gateError(),
  );
  assert.throws(
    () => bridgeNoOtherRepsFraudCardsToLegacyShape(projection, { deal_id: FIXTURE.deal_id, resolved }),
    gateError(),
    'a provided options object with no env key must refuse outright (see F9), not fall back to ambient',
  );
  assert.throws(
    () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, {}, { env: DISABLED_ENV }),
    gateError(),
  );
});

// --- gate on: local / pre-production only -----------------------------------

test('gate on: the bridge builds six dark cards, the config previews them labelled and excluded from market coverage, and gate-off ignores them again', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  assert.equal(bridge.cards.length, 6);
  assert.equal(bridge.claims.length, 6);
  for (const card of bridge.cards) {
    assert.equal(card.authority_state, AUTHORITY_STATE);
    assert.equal(card.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  }
  for (const claim of bridge.claims) {
    assert.equal(claim.authority_state, AUTHORITY_STATE);
    assert.equal(claim.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  }

  const legacyReviewDeal = buildLegacyReviewDeal();
  const originalCardIds = legacyReviewDeal.cards.map((card) => card.id);
  const merged = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + 6);
  assert.deepEqual(merged.cards.filter((card) => originalCardIds.includes(card.id)).map((card) => card.id).sort(), originalCardIds.sort());

  const configModule = loadEsmModule('../components/review/table-configs/no-other-reps-fraud.config.js');
  const { noOtherRepsFraudConfig } = configModule;
  const mergedWithPreview = withPreviewEnabled(merged);
  const rows = noOtherRepsFraudConfig.selectRows(mergedWithPreview);
  assert.equal(rows.length, 6);
  for (const row of rows) {
    assert.match(row.label, /\(Canonical V2 preview\)$/);
    assert.equal(row.marketSkip, true);
    assert.equal(row.marketState, 'DARK_REVIEW_ONLY');
    assert.equal(row.comparisonState, 'NOT_ADMITTED');
    assert.equal(row.authorityState, AUTHORITY_STATE);
    assert.equal(row.present, true);
  }
  const willfulRow = rows.find((row) => row.label.startsWith('Willful breach definition'));
  assert.equal(willfulRow.status, 'Defined');
  const fraudRow = rows.find((row) => row.label.startsWith('Fraud carve-out'));
  assert.equal(fraudRow.status, 'Present');

  // "Excluded from the covered count": no-other-reps-fraud.config.js has no
  // renderFooter of its own, so the generic market-coverage layer
  // (lib/market-metrics/section-rows.js) is the real "covered count"
  // mechanism this app uses app-wide -- exactly what the Material Contracts
  // dark bridge test itself checks. Dark rows must contribute zero.
  const sectionRowsModule = loadEsmModule('../lib/market-metrics/section-rows.js');
  const section = { id: 'no-other-reps-fraud', config: noOtherRepsFraudConfig };
  const enumerated = sectionRowsModule.enumerateMarketSectionRows(section, mergedWithPreview);
  assert.deepEqual(enumerated, []);
  const resolvedSection = sectionRowsModule.resolveMarketSectionRows(section, mergedWithPreview);
  assert.equal(resolvedSection.rowCount, 0);

  // Defense in depth: the SAME merged reviewDeal (dark cards already
  // present in .cards), but with the gate back off, must show no dark rows
  // -- the config's own gate check, independent of whatever merged them in.
  const rowsGateOff = noOtherRepsFraudConfig.selectRows(merged);
  assert.deepEqual(rowsGateOff, []);
});

// --- F3/F11 regression coverage: chained-merge receipt accumulation and ----
// --- section/definition consistency -----------------------------------------
// lib/canonical-v2/review-preview-assembly.js merges all four families'
// dark bridges into ONE review deal. Before the fix, this merge (a) wrote
// canonical_v2_no_other_reps_fraud_bridge_receipts instead of the shared
// canonical_v2_bridge_receipts key every other family's merge writes, so
// this family's receipt alone survived a four-family chain while the other
// three overwrote each other (F3); and (b) never recomputed sections/
// definitions, so a reviewDeal this bridge merged into AFTER another family
// had already populated them (the normal path once chaining exists) kept a
// stale section view even though cards/cardCount stayed current (F11). Both
// are fixed on this family's own merge function now, independent of merge
// order or how many other families ran first -- proven below without
// needing the other three families' own bridge-building machinery.

test("canonical_v2_bridge_receipts: a virgin merge yields exactly one receipt bearing this bridge's own identity, on the shared key (F3)", () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const legacyReviewDeal = buildLegacyReviewDeal();
  const merged = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });

  assert.equal(
    Object.prototype.hasOwnProperty.call(merged, 'canonical_v2_no_other_reps_fraud_bridge_receipts'),
    false,
    'the retired distinct receipts key must not reappear',
  );
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
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const priorReceipt = Object.freeze({
    schema_version: 'CANONICAL_V2_MATERIAL_CONTRACTS_LEGACY_CARD_BRIDGE/V1',
    bridge_id: 'a'.repeat(64),
    source_projection_id: 'b'.repeat(64),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
  const legacyReviewDeal = {
    ...buildLegacyReviewDeal(),
    canonical_v2_bridge_receipts: [priorReceipt],
  };
  const merged = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });

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
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
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
  const merged = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.canonical_v2_bridge_receipts.length, 1, 'a receipt already present for this bridge_id must not be duplicated');
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceiptForSameBridge);
});

test('chained merge: sections/definitions/cardCount stay mutually consistent when this bridge merges into a reviewDeal that already populated them (F11)', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  // buildLegacyReviewDeal() (via shapeReviewDealRows) already populates
  // sections/definitions for the fixture's own pre-existing legacy cards --
  // exactly the "another family's merge has already populated sections"
  // precondition the fix's own header comment describes, reproduced here
  // without needing the other three families' bridge-building machinery.
  const legacyReviewDeal = buildLegacyReviewDeal();
  const preMergeSectionTotal = legacyReviewDeal.sections.reduce((total, section) => total + section.cards.length, 0);
  assert.equal(
    preMergeSectionTotal,
    legacyReviewDeal.cardCount,
    'sanity: the pre-merge fixture reviewDeal must itself already be internally consistent',
  );

  const merged = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + bridge.cards.length);
  assert.equal(merged.cards.length, merged.cardCount);

  const sectionTotal = merged.sections.reduce((total, section) => total + section.cards.length, 0);
  assert.equal(
    sectionTotal,
    merged.cardCount,
    `sections must cover every merged card, not stay stale at the pre-merge count (got ${sectionTotal}, expected ${merged.cardCount})`,
  );
  for (const card of bridge.cards) {
    assert.ok(
      merged.sections.some((section) => section.cards.some((sectionCard) => sectionCard.id === card.id)),
      `bridge card ${card.id} must appear in the recomputed sections view`,
    );
  }
  assert.deepEqual(merged.definitions, merged.cards.filter((card) => card.kind === 'definition'));
});

test('fail-closed: identity collisions between incoming dark cards and the existing review deal are rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const legacyReviewDeal = buildLegacyReviewDeal();
  const colliding = { ...legacyReviewDeal.cards[0], id: bridge.cards[0].id };
  const collisionDeal = { ...legacyReviewDeal, cards: [colliding, ...legacyReviewDeal.cards.slice(1)] };
  assert.throws(
    () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(collisionDeal, bridge, { env: ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
});

test('the array-reconciliation guard rejects a projection whose market facts have drifted from review', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const tampered = structuredClone(projection);
  tampered.market[0] = { ...tampered.market[0], breakdown: { representation_side: 'TARGET', fabricated: true } };
  resealProjection(tampered);
  assert.throws(
    () => bridgeNoOtherRepsFraudCardsToLegacyShape(tampered, { deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV }),
    bridgeError('PROJECTION_FACT_RECONCILIATION_FAILED'),
  );
});

// --- the five required fail-closed hostile cases ----------------------------

test('fail-closed guard: altered authority is rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const tampered = structuredClone(bridge);
  tampered.authority_state = 'SERVED';
  assert.throws(
    () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(buildLegacyReviewDeal(), tampered, { env: ENABLED_ENV }),
    bridgeError('WRONG_AUTHORITY'),
  );
});

test('fail-closed guard: altered claim content (short_title no longer matches its governed label) is rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const tampered = structuredClone(bridge);
  tampered.cards[0].short_title = 'A totally different, fabricated claim';
  resealBridge(tampered);
  assert.throws(
    () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(buildLegacyReviewDeal(), tampered, { env: ENABLED_ENV }),
    bridgeError('INVALID_CARD_KIND'),
  );
});

test('fail-closed guard: altered lineage (a claim_revision_id swapped without its bound claim identity changing) is rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV,
  });
  const tampered = structuredClone(bridge);
  tampered.cards[0].canonical_v2_lineage.claim_revision_ids = ['a'.repeat(64)];
  resealBridge(tampered);
  assert.throws(
    () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(buildLegacyReviewDeal(), tampered, { env: ENABLED_ENV }),
    bridgeError('LINEAGE_IDENTITY_MISMATCH'),
  );
});

test('fail-closed guard: a fabricated attribute value not present verbatim in the fact evidence is rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const tampered = structuredClone(projection);
  const index = tampered.review.findIndex((fact) => fact.label === 'Non-reliance');
  const fabricatedAttributes = {
    ...tampered.review[index].attributes,
    agreement_scope_quote: 'this text was never in the source evidence quote',
  };
  // Coordinated tamper: query/market must keep reconciling with review (see
  // assertProjectionFactsReconcile) so THIS test proves the verbatim guard
  // specifically, not the separate array-reconciliation guard.
  tampered.review[index] = { ...tampered.review[index], attributes: fabricatedAttributes };
  tampered.query[index] = { ...tampered.query[index], attributes: fabricatedAttributes };
  tampered.market[index] = { ...tampered.market[index], breakdown: { ...fabricatedAttributes } };
  resealProjection(tampered);
  assert.throws(
    () => bridgeNoOtherRepsFraudCardsToLegacyShape(tampered, { deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV }),
    bridgeError('ATTRIBUTE_NOT_VERBATIM'),
  );
});

test('fail-closed guard: a malformed fact identity (row_id not a real resolution hash) is rejected', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const tampered = structuredClone(projection);
  tampered.review[0] = { ...tampered.review[0], row_id: 'no-other-reps-fraud-not-a-real-hash' };
  resealProjection(tampered);
  assert.throws(
    () => bridgeNoOtherRepsFraudCardsToLegacyShape(tampered, { deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV }),
    bridgeError('INVALID_FACT_IDENTITY'),
  );
});

// --- purity -----------------------------------------------------------------

test('the bridge remains a pure dark module with no page import, database or network call', () => {
  const bridgePath = path.join(__dirname, '..', 'lib', 'canonical-v2', 'no-other-reps-fraud-dark-bridge.js');
  const source = fs.readFileSync(bridgePath, 'utf8');
  assert.doesNotMatch(source, /supabase|\bfetch\b|pages\/|child_process/i);
  assert.doesNotMatch(source, /\.(?:insert|upsert|update)\s*\(/i);

  const pagesDirectory = path.join(__dirname, '..', 'pages');
  const pageImports = listFiles(pagesDirectory)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => /(?:require\s*\(|from\s+)[^\n]*no-other-reps-fraud-dark-bridge/.test(
      fs.readFileSync(file, 'utf8'),
    ));
  assert.deepEqual(pageImports, []);
});

// --- gate-integrity regression coverage (F2/F6/F9) --------------------------
// adaptReviewFactToLegacyCard minted a legacy-shaped card with no gate at
// all (F2); validateBridgeEnvelope had no gate at all (F6); the builder and
// merge both used `env || process.env`, which cannot tell an explicit falsy
// env from one never supplied (F9). This section proves every exported
// function that mints or validates a record now refuses under production,
// and that an explicit falsy env (or an options object missing its env key)
// refuses rather than silently falling back to an enabled ambient
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

test('every minting/validating export refuses under a production env, flag or no flag', () => {
  const dummyFact = {};
  const dummyProjection = {};
  const dummyBridge = {};
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };
  const dummyResolvedIndex = new Map();

  for (const productionEnv of [
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'production' },
    { VERCEL: '1', VERCEL_ENV: 'production' },
  ]) {
    assert.throws(
      () => adaptReviewFactToLegacyCard(dummyFact, 0, {
        dealId: 'deal-1', resolvedIndex: dummyResolvedIndex, env: productionEnv,
      }),
      gateError(),
      `adaptReviewFactToLegacyCard must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => bridgeNoOtherRepsFraudCardsToLegacyShape(dummyProjection, {
        deal_id: 'deal-1', resolved: [], env: productionEnv,
      }),
      gateError(),
      `bridgeNoOtherRepsFraudCardsToLegacyShape must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => validateBridgeEnvelope(dummyBridge, productionEnv),
      gateError(),
      `validateBridgeEnvelope must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env: productionEnv }),
      gateError(),
      `mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal must refuse under ${JSON.stringify(productionEnv)}`,
    );
  }
});

test('an explicit undefined/null env, or an options object missing its env key, refuses rather than falling back to an enabled ambient process.env', () => {
  const dummyFact = {};
  const dummyProjection = {};
  const dummyBridge = {};
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };
  const dummyResolvedIndex = new Map();

  withAmbientDarkBridgeEnabled(() => {
    for (const env of [undefined, null]) {
      assert.throws(
        () => adaptReviewFactToLegacyCard(dummyFact, 0, {
          dealId: 'deal-1', resolvedIndex: dummyResolvedIndex, env,
        }),
        gateError(),
        `adaptReviewFactToLegacyCard must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => bridgeNoOtherRepsFraudCardsToLegacyShape(dummyProjection, { deal_id: 'deal-1', resolved: [], env }),
        gateError(),
        `bridgeNoOtherRepsFraudCardsToLegacyShape must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => validateBridgeEnvelope(dummyBridge, env),
        gateError(),
        `validateBridgeEnvelope must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env }),
        gateError(),
        `mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal must refuse on explicit env=${env}`,
      );
    }
    // A provided options object with no env key at all must refuse the same
    // way -- never treated as "env not specified, fall back to ambient".
    assert.throws(
      () => adaptReviewFactToLegacyCard(dummyFact, 0, { dealId: 'deal-1', resolvedIndex: dummyResolvedIndex }),
      gateError(),
      'adaptReviewFactToLegacyCard must refuse when its options object has no env key',
    );
    assert.throws(
      () => bridgeNoOtherRepsFraudCardsToLegacyShape(dummyProjection, { deal_id: 'deal-1', resolved: [] }),
      gateError(),
      'bridgeNoOtherRepsFraudCardsToLegacyShape must refuse when its options object has no env key',
    );
    assert.throws(
      () => mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(dummyReviewDeal, dummyBridge, {}),
      gateError(),
      'mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal must refuse when its options object has no env key',
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
