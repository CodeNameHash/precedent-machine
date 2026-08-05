'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV28 } = require('../lib/canonical-v2/contract-bundle');
const {
  AUTHORITY_STATE,
  BRIDGE_SCHEMA,
  ID_PREFIX,
  GeneralCovenantsDarkBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  bridgeGeneralCovenantsCardsToLegacyShape,
  mergeCanonicalV2CardsIntoReviewDeal,
  validateBridgeEnvelope,
} = require('../lib/canonical-v2/general-covenants-dark-bridge');
const {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  projectGeneralCovenantsProductSurfaces,
} = require('../lib/canonical-v2/general-covenants-product-projection');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../lib/canonical-v2/p0-product-surface-routing');
const { DarkBridgeGateError } = require('../lib/canonical-v2/dark-bridge-gate');
const {
  shapeGeneralCovenantsProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  runNativeExtraction,
} = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { rowHasDarkAuthority } = require('../lib/query/dark-authority-fence');
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

const CONTRACT = compileFixtureContractV28();
const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'dark-bridge',
  'general-covenants-dark-review.json',
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

function bridgeError(code) {
  return (error) => error instanceof GeneralCovenantsDarkBridgeError && error.code === code;
}

function gateError(code) {
  return (error) => error instanceof DarkBridgeGateError && error.code === code;
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

// Mirrors general-covenants-dark-bridge.js's own (private, unexported)
// sourceProjectionBodyFromBridge -- validateBridgeEnvelope reconstructs a
// bridge's bound source projection from its own cards/claims and checks it
// against source_projection_id (SOURCE_PROJECTION_MISMATCH otherwise). A
// hand-built bridge envelope (as opposed to one produced by
// bridgeGeneralCovenantsCardsToLegacyShape) has to compute a matching
// source_projection_id itself, exactly the way the real bridge does.
function reconstructedSourceProjectionId(bridgeLike) {
  const cards = bridgeLike.cards.map((card) => ({
    id: card.id.slice(ID_PREFIX.length),
    ...(card.canonical_v2_lineage.source === NATIVE_SOURCE
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
    source: NATIVE_SOURCE,
    cards,
    claims,
    open_items: bridgeLike.open_items,
  });
}

// Runs process.env[key] = value for the duration of a SYNCHRONOUS callback,
// then restores whatever was there before (including "was absent"). Used
// instead of mutating process.env directly so a failed assertion never
// leaks a stuck env value into whatever else runs in this shared worktree.
function withEnv(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const previous = process.env[key];
  try {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    return fn();
  } finally {
    if (had) process.env[key] = previous;
    else delete process.env[key];
  }
}

function sourceText() {
  const lines = [
    `Section ${FIXTURE.section_reference} ${FIXTURE.section_title}.`,
    '',
    ...FIXTURE.grounded_covenants.map((entry) => entry.quote),
    FIXTURE.unresolved_definition_reference.quote,
    FIXTURE.unsupported_code.quote,
  ];
  return `${lines.join('\n')}\n`;
}

// Builds a REAL General Covenants V2 projection through the actual
// production pipeline (runNativeExtraction -> resolveCandidates ->
// projectGeneralCovenantsProductSurfaces), the same pattern
// tests/canonical-v2-general-covenants-family-parity.test.js already uses
// for this exact projection function. Two grounded covenants resolve to
// native cards; an unresolved definition cross-reference and an unsupported
// covenant code both fall to open-world evidence.
async function buildRealProjection() {
  const text = sourceText();
  const source = buildImmutableSource({
    sourceBytes: text,
    sourceOccurrenceKey: 'general-covenants-dark-bridge-fixture',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${FIXTURE.deal_id}`,
    deal_admission_id: sha256Hex(`deal-admission:${FIXTURE.deal_id}`),
    source_ordinal: 0,
  });
  const response = {
    general_covenants: [
      ...FIXTURE.grounded_covenants.map((entry) => ({
        section_reference: FIXTURE.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: entry.covenant_code,
        definition_cross_references: [],
        quote: entry.quote,
      })),
      {
        section_reference: FIXTURE.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: FIXTURE.unresolved_definition_reference.covenant_code,
        definition_cross_references: FIXTURE.unresolved_definition_reference.definition_cross_references,
        quote: FIXTURE.unresolved_definition_reference.quote,
      },
      {
        section_reference: FIXTURE.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: FIXTURE.unsupported_code.covenant_code,
        definition_cross_references: [],
        quote: FIXTURE.unsupported_code.quote,
      },
    ],
    open_world_candidates: [],
  };
  const receipt = await runNativeExtraction({
    source_text: text,
    document_hash: sha256Hex(Buffer.from(text, 'utf8')),
    section_references: [FIXTURE.section_reference],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeGeneralCovenantsProposals(response, governedScope.source_text);
      return {
        provider_id: 'general-covenants-dark-bridge-fixture/v1',
        model_id: 'recorded-fixture',
        prompt: 'general-covenants-dark-bridge-fixture/v1',
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
  return projectGeneralCovenantsProductSurfaces({ resolution, deal_id: FIXTURE.deal_id });
}

function buildLegacyReviewDeal() {
  return shapeReviewDealRows(FIXTURE.deal_id, structuredClone(FIXTURE.legacy_cards), {
    claims: [],
  });
}

function loadConfig() {
  return import('../components/review/table-configs/general-covenants.config.js');
}

// Canonical V2 preview gate (components/review/table-configs/canonical-v2-
// preview-lane.js): general-covenants.config.js now reads an explicit,
// server-stamped canonical_v2_preview_enabled boolean off the reviewDeal
// payload instead of isDarkBridgeIntegrationEnabled(process.env) -- the
// BRIDGE's own env gate below (bridgeGeneralCovenantsCardsToLegacyShape /
// mergeCanonicalV2CardsIntoReviewDeal, both still env-gated on purpose) is
// unrelated and untouched. This mirrors withEnv() for the config-level gate.
function withPreviewEnabled(reviewDeal) {
  return { ...reviewDeal, canonical_v2_preview_enabled: true };
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

test('a real General Covenants V2 result reaches Review through the dark bridge behind the gate, and the bridge refuses to run with the gate off', async () => {
  const projection = await buildRealProjection();
  assert.equal(projection.cards.length, 4);
  assert.equal(projection.claims.length, 2);
  assert.equal(projection.open_items.length, 2);

  // Bridge refusal with the gate off. Always an explicit env object here,
  // never ambient process.env, so this is deterministic no matter what else
  // is running in this shared worktree.
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(projection, {}),
    gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
  );
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(projection, { NODE_ENV: 'test' }),
    gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
  );
  // The env parameter really does default to process.env -- prove that
  // exact pathway once, under a controlled/restored env.
  withEnv('CANONICAL_V2_DARK_BRIDGE', undefined, () => {
    assert.throws(
      () => bridgeGeneralCovenantsCardsToLegacyShape(projection),
      gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
    );
  });

  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
  assert.equal(bridge.schema_version, BRIDGE_SCHEMA);
  assert.equal(bridge.authority_state, AUTHORITY_STATE);
  assert.equal(bridge.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
  assert.equal(bridge.cards.length, 4);
  assert.equal(bridge.claims.length, 2);

  // Every emitted record -- card and claim alike -- carries dark-only
  // authority. No exceptions.
  for (const card of bridge.cards) {
    assert.equal(card.authority_state, AUTHORITY_STATE);
    assert.equal(card.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
    assert.ok(card.id.startsWith('cv2:'));
  }
  for (const claim of bridge.claims) {
    assert.equal(claim.authority_state, AUTHORITY_STATE);
    assert.equal(claim.source_authentication_state, SOURCE_AUTHENTICATION_STATE);
    assert.equal(claim.provenance.canonical_v2_authority_state, AUTHORITY_STATE);
  }

  // owner_id (the field the Material Contracts template's closed lineage
  // field set does not have room for) is admitted, validated against the
  // registered owner for the card's own code, and travels through
  // unmodified -- never silently stripped.
  const nativeCards = bridge.cards.filter((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE);
  assert.equal(nativeCards.length, 2);
  for (const card of nativeCards) {
    assert.equal(
      card.canonical_v2_lineage.owner_id,
      GENERAL_COVENANT_FOLLOW_ON_OWNERS[card.provision_subtype],
    );
    assert.equal(card.features.mainConcept, card.primary_quote);
  }
  const evidenceCards = bridge.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.equal(evidenceCards.length, 2);
  for (const card of evidenceCards) {
    assert.deepEqual(card.features, {});
    assert.equal('owner_id' in card.canonical_v2_lineage, false);
  }

  const legacyReviewDeal = buildLegacyReviewDeal();
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.dealId, FIXTURE.deal_id);
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + bridge.cards.length);

  const { generalCovenantsConfig } = await loadConfig();

  // Gate-off IDENTITY on a plain legacy reviewDeal that never saw a dark
  // card: exactly what this table produces without this task's changes.
  const baselineRows = generalCovenantsConfig.selectRows(legacyReviewDeal);
  assert.equal(baselineRows.length, 1);
  assert.equal(baselineRows[0].label, 'Further Assurances');
  assert.equal(baselineRows[0].marketSkip, undefined);
  assert.equal(baselineRows[0].authorityState, undefined);

  // Gate-off DEFENSE IN DEPTH: even once dark cards are merged into the
  // SAME reviewDeal, the gate being off must hide them completely -- not
  // just skip labelling them. (This is not hypothetical: it caught a real
  // bug during development, where dark cards fell through the generic
  // perClauseRows() fallback un-labelled whenever the gate was off but a
  // dark card happened to already be present.)
  const gateOffMergedRows = generalCovenantsConfig.selectRows(merged);
  assert.equal(gateOffMergedRows.length, baselineRows.length);
  assert.equal(gateOffMergedRows[0].label, baselineRows[0].label);
  assert.equal(gateOffMergedRows[0].marketSkip, undefined);
  assert.equal(gateOffMergedRows[0].authorityState, undefined);
  assert.equal(
    gateOffMergedRows.some((row) => row.sourceCard?.authority_state === AUTHORITY_STATE),
    false,
  );

  // Gate-on: dark rows labelled, excluded from the curated/covered set,
  // flagged marketSkip.
  const gateOnRows = generalCovenantsConfig.selectRows(withPreviewEnabled(merged));
  assert.equal(gateOnRows.length, baselineRows.length + bridge.cards.length);
  const [liveRow, ...darkRows] = gateOnRows;
  assert.equal(liveRow.label, baselineRows[0].label);
  assert.equal(liveRow.marketSkip, baselineRows[0].marketSkip);
  assert.equal(liveRow.authorityState, baselineRows[0].authorityState);
  assert.equal(darkRows.length, bridge.cards.length);
  for (const row of darkRows) {
    assert.match(row.label, / \(Canonical V2 preview\)$/);
    assert.equal(row.marketSkip, true);
    assert.equal(row.authorityState, AUTHORITY_STATE);
    assert.equal(row.comparisonState, 'NOT_ADMITTED');
    assert.equal(row.marketState, 'DARK_REVIEW_ONLY');
    assert.deepEqual(row.marketProvisionCodes, []);
    assert.equal(row.sourceCard.authority_state, AUTHORITY_STATE);
    assert.ok(row.id.startsWith('general-covenants-dark-'));
    // The shared dark-authority-fence guard used by query/market recognises
    // every dark row through its real sourceCard, independent of this
    // config's own camelCase presentational stamping.
    assert.equal(rowHasDarkAuthority(row), true);
  }
  assert.equal(rowHasDarkAuthority(liveRow), false);
});

// --- F3 regression coverage: chained-merge receipt accumulation ------------
// lib/canonical-v2/review-preview-assembly.js merges all four families'
// dark bridges into ONE review deal, in a fixed order. Before the fix, each
// of three families' merges (this one, legacy-card-bridge.js,
// representations-dark-bridge.js) wrote canonical_v2_bridge_receipts by
// REPLACEMENT, so only the last of the three to merge kept its receipt --
// the other two's provenance binding was silently lost. canonical_v2_bridge_
// receipts now accumulates across the chain instead.

test("canonical_v2_bridge_receipts: a virgin merge yields exactly one receipt bearing this bridge's own identity (F3)", async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
  const legacyReviewDeal = buildLegacyReviewDeal();
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

test('canonical_v2_bridge_receipts: appends to receipts a prior family already left, preserving them in order, rather than replacing them (F3)', async () => {
  const projection = await buildRealProjection();
  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
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
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });

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
  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
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
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, bridge, { env: ENABLED_ENV });
  assert.equal(merged.canonical_v2_bridge_receipts.length, 1, 'a receipt already present for this bridge_id must not be duplicated');
  assert.deepEqual(merged.canonical_v2_bridge_receipts[0], priorReceiptForSameBridge);
});

test('the dark bridge fails closed on altered authority, altered claim content/lineage, malformed projection identity, incomplete open-item reconciliation, unmappable provenance, and non-verbatim quotes', async () => {
  const projection = await buildRealProjection();

  // Missing required field.
  const missingField = structuredClone(projection);
  delete missingField.cards[0].primary_quote;
  resealProjection(missingField);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(missingField, ENABLED_ENV),
    bridgeError('MISSING_REQUIRED_FIELD'),
  );

  // Malformed projection identity: any tamper without resealing
  // projection_id must be rejected before anything else is even inspected.
  const staleProjection = structuredClone(projection);
  staleProjection.cards[0].short_title = 'Tampered without resealing the projection identity';
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(staleProjection, ENABLED_ENV),
    bridgeError('STALE_PROJECTION_ID'),
  );

  // Unmappable provenance (1): a native card's code has no registered
  // follow-on owner at all.
  const unknownCode = structuredClone(projection);
  const unknownCodeCard = unknownCode.cards.find((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE);
  unknownCodeCard.provision_subtype = 'COV-NOTREGISTERED';
  unknownCodeCard.ai_metadata.code = 'COV-NOTREGISTERED';
  resealProjection(unknownCode);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(unknownCode, ENABLED_ENV),
    bridgeError('UNKNOWN_COVENANT_CODE'),
  );

  // Unmappable provenance (2): a known, registered code, but the lineage
  // owner_id has drifted from that code's registered owner -- the
  // General-Covenants-specific guard the Material Contracts template has no
  // equivalent of, because it has no owner_id field at all.
  const ownerMismatch = structuredClone(projection);
  const ownerMismatchCard = ownerMismatch.cards.find((card) => card.provision_subtype === 'COV-ACCESS');
  ownerMismatchCard.canonical_v2_lineage.owner_id = 'WRONG_OWNER';
  resealProjection(ownerMismatch);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(ownerMismatch, ENABLED_ENV),
    bridgeError('UNMAPPABLE_OWNER'),
  );

  // Unmappable provenance (3): a lineage source entirely outside the known
  // enum -- never silently treated as either native or evidence.
  const unknownSource = structuredClone(projection);
  const unknownSourceCard = unknownSource.cards.find((card) => card.provision_subtype === 'COV-ACCESS');
  unknownSourceCard.canonical_v2_lineage.source = 'BOGUS_SOURCE';
  resealProjection(unknownSource);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(unknownSource, ENABLED_ENV),
    bridgeError('INVALID_LINEAGE'),
  );

  // Non-verbatim quote: mainConcept must equal primary_quote (and
  // region_full_text/full_text) exactly -- no paraphrase, no drift between
  // the feature value and what the retained source text actually says.
  const quoteDrift = structuredClone(projection);
  const quoteDriftCard = quoteDrift.cards.find((card) => card.provision_subtype === 'COV-PUBLICITY');
  quoteDriftCard.features.mainConcept = 'a paraphrase that does not occur verbatim in the source';
  quoteDriftCard.ai_metadata.features = quoteDriftCard.features;
  resealProjection(quoteDrift);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(quoteDrift, ENABLED_ENV),
    bridgeError('QUOTE_NOT_VERBATIM'),
  );

  // Altered claim content: the claim's canonical value no longer equals its
  // own card's mainConcept feature.
  const claimContentDrift = structuredClone(projection);
  const forgedClaim = claimContentDrift.claims.find((claim) => claim.attribute === 'mainConcept');
  forgedClaim.canonical = 'a forged claim value';
  resealProjection(claimContentDrift);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(claimContentDrift, ENABLED_ENV),
    bridgeError('INVALID_CLAIM_CONTRACT'),
  );

  // Altered claim lineage: the card's claim_revision_ids no longer match
  // what its own claim's provenance records.
  const lineageDrift = structuredClone(projection);
  const lineageDriftCard = lineageDrift.cards.find((card) => card.provision_subtype === 'COV-ACCESS');
  lineageDriftCard.canonical_v2_lineage.claim_revision_ids = ['a'.repeat(64)];
  resealProjection(lineageDrift);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(lineageDrift, ENABLED_ENV),
    bridgeError('INVALID_LINEAGE'),
  );

  // Incomplete open-item reconciliation: an evidence card with no matching
  // open item must never bridge.
  const missingOpenItem = structuredClone(projection);
  missingOpenItem.open_items = missingOpenItem.open_items.slice(0, 1);
  resealProjection(missingOpenItem);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(missingOpenItem, ENABLED_ENV),
    bridgeError('OPEN_WORLD_RECONCILIATION_FAILED'),
  );

  // Evidence-to-native laundering: general-covenants-source-disposition.js's
  // promotion boundary is respected by construction -- an open-world
  // evidence card can never be relabelled with a native-looking subtype
  // while keeping its EVIDENCE_SOURCE lineage.
  const evidenceLaundering = structuredClone(projection);
  const launderedCard = evidenceLaundering.cards.find((card) => (
    card.canonical_v2_lineage.source === EVIDENCE_SOURCE
  ));
  launderedCard.provision_subtype = 'COV-ACCESS';
  resealProjection(evidenceLaundering);
  assert.throws(
    () => bridgeGeneralCovenantsCardsToLegacyShape(evidenceLaundering, ENABLED_ENV),
    bridgeError('INVALID_EVIDENCE_SUBTYPE'),
  );

  // Altered authority: a bridge envelope's authority_state tampered after
  // the fact must never merge into a review deal.
  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
  const tamperedAuthority = structuredClone(bridge);
  tamperedAuthority.authority_state = 'SERVED';
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), tamperedAuthority, { env: ENABLED_ENV }),
    bridgeError('WRONG_AUTHORITY'),
  );

  // Identity collision: a legacy card that happens to already own an
  // incoming bridge card's identity must never merge silently.
  const legacyReviewDeal = buildLegacyReviewDeal();
  const collidingDeal = {
    ...legacyReviewDeal,
    cards: [
      { ...legacyReviewDeal.cards[1], id: bridge.cards[0].provision_instance_id },
      legacyReviewDeal.cards[0],
    ],
  };
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(collidingDeal, bridge, { env: ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );

  // A bare cards array (not a validated bridge envelope) must never merge.
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), bridge.cards, { env: ENABLED_ENV }),
    bridgeError('INVALID_BRIDGE_ENVELOPE'),
  );
});

test('the bridge remains a pure dark module with no page import, database call or network call', () => {
  const bridgePath = path.join(__dirname, '..', 'lib', 'canonical-v2', 'general-covenants-dark-bridge.js');
  const source = fs.readFileSync(bridgePath, 'utf8');
  assert.doesNotMatch(source, /supabase|\bfetch\b|pages\/|child_process/i);
  assert.doesNotMatch(source, /\.(?:insert|upsert|update)\s*\(/i);
  assert.doesNotMatch(source, /require\(\s*['"](?:node:)?fs['"]\s*\)/);

  const pagesDirectory = path.join(__dirname, '..', 'pages');
  const pageImports = listFiles(pagesDirectory)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => /(?:require\s*\(|from\s+)[^\n]*general-covenants-dark-bridge/.test(
      fs.readFileSync(file, 'utf8'),
    ));
  assert.deepEqual(pageImports, []);
});

// An independent probe found merge validated the reviewDeal and envelope BEFORE checking
// the gate, so a caller who hand-authored a self-consistent envelope could merge dark
// cards with the gate off, never having gone through the builder that checks it.
test('every public bridge entry point refuses before any other validation when the gate is off', () => {
  const disabled = {};
  for (const [name, entry] of Object.entries({
    bridgeGeneralCovenantsCardsToLegacyShape,
    mergeCanonicalV2CardsIntoReviewDeal,
  })) {
    assert.throws(
      () => entry({ dealId: 'deal-1', cards: [], claims: [] }, {}, { env: disabled }),
      (error) => error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED',
      `${name} must refuse on the gate before validating anything else`,
    );
  }
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
  const bridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);
  const card = bridge.cards.find((candidate) => candidate.canonical_v2_lineage.source === NATIVE_SOURCE);
  const claim = bridge.claims.find((candidate) => candidate.excerpt_id === card.excerpt_id);
  assert.ok(card);
  assert.ok(claim);

  // A hand-built sibling card: a FRESH, distinct id/provision_instance_id
  // and claim_revision_id, but the SAME excerpt_id as the first card.
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
    'CANONICAL_V2_GENERAL_COVENANT_PRODUCT_FEATURE_CLAIM/V1',
    {
      provision_instance_id: siblingRawProvisionId,
      code: siblingCard.provision_subtype,
      mainConcept: siblingCard.features.mainConcept,
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
    cards: [...bridge.cards, siblingCard],
    claims: [...bridge.claims, siblingClaim],
  };
  combinedBridgeDraft.source_projection_id = reconstructedSourceProjectionId(combinedBridgeDraft);
  const combinedBridge = resealBridge(combinedBridgeDraft);

  const legacyReviewDeal = buildLegacyReviewDeal();
  const merged = mergeCanonicalV2CardsIntoReviewDeal(legacyReviewDeal, combinedBridge, { env: ENABLED_ENV });
  assert.equal(merged.cardCount, legacyReviewDeal.cardCount + combinedBridge.cards.length);
  assert.ok(merged.cards.some((candidate) => candidate.id === card.id));
  assert.ok(merged.cards.some((candidate) => candidate.id === siblingCard.id));

  // Genuine identity collisions must still fail closed: forcing the
  // sibling's provision_instance_id (not just its excerpt_id) to collide
  // with the first card must still throw ID_COLLISION.
  const collidingSiblingCard = { ...siblingCard, id: card.id, provision_instance_id: card.provision_instance_id };
  const collidingSiblingClaim = { ...siblingClaim, provision_instance_id: card.provision_instance_id };
  const genuineCollisionDraft = {
    ...bridge,
    cards: [...bridge.cards, collidingSiblingCard],
    claims: [...bridge.claims, collidingSiblingClaim],
  };
  genuineCollisionDraft.source_projection_id = reconstructedSourceProjectionId(genuineCollisionDraft);
  const genuineCollision = resealBridge(genuineCollisionDraft);
  assert.throws(
    () => mergeCanonicalV2CardsIntoReviewDeal(buildLegacyReviewDeal(), genuineCollision, { env: ENABLED_ENV }),
    bridgeError('ID_COLLISION'),
  );
});

test('cross-family merge: No Other Reps / Fraud bridge output (whose own non-reliance/extra-contractual pair legitimately shares one excerpt_id) merges first, then General Covenants bridge output merges into the SAME reviewDeal without ID_COLLISION', async () => {
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
  // Deliberately bridged under the GENERAL COVENANTS deal_id (not NORF's own
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
  // reviewDeal before General Covenants ever merges.
  assert.equal(nonReliance.excerpt_id, extraContractual.excerpt_id);
  assert.notEqual(nonReliance.id, extraContractual.id);

  const afterNorf = mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(
    legacyReviewDeal,
    norfBridge,
    { env: ENABLED_ENV },
  );
  assert.equal(afterNorf.cardCount, legacyReviewDeal.cardCount + 6);

  const projection = await buildRealProjection();
  const generalCovenantsBridge = bridgeGeneralCovenantsCardsToLegacyShape(projection, ENABLED_ENV);

  // This is the regression: before the fix, merge reserved excerpt_id
  // across the WHOLE reviewDeal before looking at its own incoming cards,
  // so this threw ID_COLLISION the moment it reached the second card of the
  // NORF pair above. It must now succeed.
  const afterBoth = mergeCanonicalV2CardsIntoReviewDeal(afterNorf, generalCovenantsBridge, { env: ENABLED_ENV });
  assert.equal(afterBoth.cardCount, afterNorf.cardCount + generalCovenantsBridge.cards.length);
  assert.ok(afterBoth.cards.some((card) => card.id === generalCovenantsBridge.cards[0].id));
  assert.ok(afterBoth.cards.some((card) => card.id === nonReliance.id));
  assert.ok(afterBoth.cards.some((card) => card.id === extraContractual.id));
});

// --- gate-integrity regression coverage (F6/F9) -----------------------------
// bridgeGeneralCovenantsCardsToLegacyShape used a `env = process.env` DEFAULT
// PARAMETER (can't tell an omitted argument from an explicit `undefined`) and
// merge used `env || process.env` (can't tell an explicit falsy env from one
// never supplied); validateBridgeEnvelope had no gate at all. This section
// proves every exported function that mints or validates a record now
// refuses under production, and that an explicit falsy env (or a merge
// options object missing its env key) refuses rather than silently falling
// back to an enabled ambient process.env.

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
      () => bridgeGeneralCovenantsCardsToLegacyShape(dummyProjection, productionEnv),
      gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
      `bridgeGeneralCovenantsCardsToLegacyShape must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => validateBridgeEnvelope(dummyBridge, productionEnv),
      gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
      `validateBridgeEnvelope must refuse under ${JSON.stringify(productionEnv)}`,
    );
    assert.throws(
      () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env: productionEnv }),
      gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
      `mergeCanonicalV2CardsIntoReviewDeal must refuse under ${JSON.stringify(productionEnv)}`,
    );
  }
});

test('an explicit undefined/null env, or a merge options object missing its env key, refuses rather than falling back to an enabled ambient process.env', () => {
  const dummyProjection = {};
  const dummyBridge = {};
  const dummyReviewDeal = { dealId: 'deal-1', cards: [] };

  withEnv('CANONICAL_V2_DARK_BRIDGE', 'ENABLED_LOCAL_PREPRODUCTION', () => {
    for (const env of [undefined, null]) {
      assert.throws(
        () => bridgeGeneralCovenantsCardsToLegacyShape(dummyProjection, env),
        gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
        `bridgeGeneralCovenantsCardsToLegacyShape must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => validateBridgeEnvelope(dummyBridge, env),
        gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
        `validateBridgeEnvelope must refuse on explicit env=${env}`,
      );
      assert.throws(
        () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, { env }),
        gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
        `mergeCanonicalV2CardsIntoReviewDeal must refuse on explicit env=${env}`,
      );
    }
    // A provided options object with no env key at all -- merge's only
    // caller-facing options bag -- must refuse the same way, never treated
    // as "env not specified, fall back to ambient".
    assert.throws(
      () => mergeCanonicalV2CardsIntoReviewDeal(dummyReviewDeal, dummyBridge, {}),
      gateError('DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'),
      'mergeCanonicalV2CardsIntoReviewDeal must refuse when the options object has no env key',
    );

    // Sanity check on the ambient fallback itself: a genuinely omitted env
    // argument (arguments.length below the env-carrying position) really
    // does read the now-enabled ambient process.env, proving the calls
    // above threw because of the explicit/missing env, not because the gate
    // is unconditionally broken. bridgeGeneralCovenantsCardsToLegacyShape
    // gets past the gate and fails on projection shape instead.
    assert.throws(
      () => bridgeGeneralCovenantsCardsToLegacyShape(dummyProjection),
      (error) => !(error instanceof DarkBridgeGateError),
      'omitting env entirely must fall back to the now-enabled ambient process.env',
    );
  });
});
