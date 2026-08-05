'use strict';

// Read-time, non-persisted merge of all four Canonical V2 dark-bridge
// preview areas (Material Contracts, General Covenants, No Other Reps /
// Fraud, Representations) into a served review deal -- ONLY when
// isDarkBridgeIntegrationEnabled() permits it (local or Vercel preview,
// never production). See docs/codex-program/ADR-001-dark-bridge-flattening-
// is-scaffolding.md: this is preview/equivalence scaffolding, never a
// serving or persistence path. Nothing in this module writes to
// provision_cards, claims, or any store -- every card it attaches stays
// authority_state: 'VALIDATED_NOT_SERVED', and it never calls a database or
// the network.
//
// Each family's dark cards are rebuilt, on every call, from a pinned
// __fixtures__/canonical-v2/preview/*.json scenario through that family's
// OWN real pipeline (shape proposals -> resolve -> project -> bridge) --
// the exact construction tests/canonical-v2-legacy-card-bridge.test.js /
// -general-covenants-dark-bridge.test.js / -no-other-reps-fraud-dark-
// bridge.test.js / -representations-dark-bridge.test.js already pin for
// their own copies of these fixtures, never a hand-rolled shortcut
// projection. The one deliberate difference from those tests: deal_id is
// stamped from the CALLER's real reviewDeal.dealId, not the fixture's own
// baked-in scenario deal_id, so each bridge's own deal_id equality check
// (DEAL_ID_MISMATCH otherwise) lets it merge into whatever real deal is
// being previewed. This is the same "deal_id is bridge-time-supplied, never
// baked into the projection" pattern the representations/no-other-reps-
// fraud cross-family regression test in tests/canonical-v2-representations-
// dark-bridge.test.js ("cross-family merge: No Other Reps / Fraud bridge
// output ... merges first, then Representations bridge output merges into
// the SAME reviewDeal") already proves safe for chaining two families into
// one reviewDeal; this module extends the same proof to all four.

const { sha256Hex } = require('./canonical-bytes');
const { buildImmutableSource } = require('./source-structure');
const { compileFixtureContractV27, compileFixtureContractV28 } = require('./contract-bundle');
const { runNativeExtraction } = require('./native-producer/native-extraction-run');
const { resolveCandidates } = require('./native-producer/candidate-resolution');
const {
  shapeMaterialContractsProposals,
  shapeGeneralCovenantsProposals,
} = require('./native-producer/anthropic-provider');
const { projectMaterialContractsProductSurfaces } = require('./material-contracts-product-projection');
const { projectGeneralCovenantsProductSurfaces } = require('./general-covenants-product-projection');
const { shapeNoOtherRepsFraudProposals } = require('./native-producer/no-other-reps-fraud-producer');
const { resolveNoOtherRepsFraudProposals } = require('./native-producer/no-other-reps-fraud-resolution');
const { projectNoOtherRepsFraudProduct } = require('./no-other-reps-fraud-product-projection');
const { projectRepresentationClaims } = require('./representations-product-projection');
const { shapeReviewDealRows } = require('../queries/review-deal');
const {
  describeDarkBridgeGate,
  isDarkBridgeIntegrationRequested,
} = require('./dark-bridge-gate');

// Namespaced (not destructured) require()s: general-covenants-dark-bridge.js
// and representations-dark-bridge.js both export a function literally named
// mergeCanonicalV2CardsIntoReviewDeal (same name as legacy-card-bridge.js's
// own export) -- destructuring all four into one scope would silently
// shadow one with another. Only no-other-reps-fraud-dark-bridge.js's merge
// export has a distinct name (mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal).
const materialContractsBridgeModule = require('./legacy-card-bridge');
const generalCovenantsBridgeModule = require('./general-covenants-dark-bridge');
const noOtherRepsFraudBridgeModule = require('./no-other-reps-fraud-dark-bridge');
const representationsBridgeModule = require('./representations-dark-bridge');

const materialContractsFixture = require('../../__fixtures__/canonical-v2/preview/material-contracts-dark-review.json');
const generalCovenantsFixture = require('../../__fixtures__/canonical-v2/preview/general-covenants-dark-review.json');
const noOtherRepsFraudFixture = require('../../__fixtures__/canonical-v2/preview/no-other-reps-fraud-dark-review.json');
const representationsFixture = require('../../__fixtures__/canonical-v2/preview/representations-dark-review.json');

// Governed vocabulary bundles are deal-independent and expensive-ish to
// compile; each is a pure function of a fixed input, so compiling once at
// module load (mirroring the `const CONTRACT = compileFixtureContractV27();`
// pattern the material-contracts/general-covenants dark-bridge tests use at
// their own module scope) is correct and avoids repeating the work on every
// request.
const MATERIAL_CONTRACTS_CONTRACT = compileFixtureContractV27();
const GENERAL_COVENANTS_CONTRACT = compileFixtureContractV28();

const PREVIEW_ENABLED_FIELD = 'canonical_v2_preview_enabled';
const PREVIEW_STATUS_FIELD = 'canonical_v2_preview_status';
const PREVIEW_STATUS_SCHEMA = 'CANONICAL_V2_PREVIEW_STATUS/V1';

// The four outcomes this assembler can have. They are mutually exclusive and
// jointly exhaustive over every path through assembleCanonicalV2Preview().
const CANONICAL_V2_PREVIEW_STATE = Object.freeze({
  // The gate refused and nobody asked for the preview in the first place --
  // the ordinary production/no-flag path. Byte-identical no-op.
  NOT_REQUESTED: 'NOT_REQUESTED',
  // The integration flag was set, and the gate refused anyway. Carries the
  // gate's own reason (e.g. CI_ENVIRONMENT_DETECTED, RUNTIME_NOT_PERMITTED).
  REFUSED: 'REFUSED',
  // The preview ran to completion. attached_card_count may legitimately be 0.
  ATTACHED: 'ATTACHED',
  // The preview ran and threw. The legacy deal is served unchanged, but the
  // failure is reported, never disguised as a successful no-op.
  FAILED: 'FAILED',
});

const DEFAULT_FIXTURES = Object.freeze({
  materialContracts: materialContractsFixture,
  generalCovenants: generalCovenantsFixture,
  noOtherRepsFraud: noOtherRepsFraudFixture,
  representations: representationsFixture,
});

async function declinedClassifier() {
  return { declined: true };
}

// -- Material Contracts -------------------------------------------------
// Mirrors tests/canonical-v2-legacy-card-bridge.test.js's buildRealProjection.
// legacy-card-bridge.js originally carried no internal gate at all, unlike its
// three siblings. An adversarial audit found that gap and it has since been
// closed, so both its builder and its merge now assert the gate themselves.
// The explicit env MUST therefore be threaded through here exactly as the other
// three families do. Omitting it does not merely skip a redundant check: the
// gate falls back to ambient process.env, which is unset under an explicit-env
// caller, so the whole family throws and the entire four-family preview
// collapses to the legacy deal. That collapse is now reported (state FAILED,
// phase MATERIAL_CONTRACTS) rather than silent, but it is still a collapse.

async function buildMaterialContractsBridge(dealId, env, fixture) {
  const sourceText = `Section ${fixture.section_reference} Contracts.\n\n${fixture.material_contract_criterion.quote}\n`;
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: `canonical-v2-preview:material-contracts:${dealId}`,
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${dealId}`,
    deal_admission_id: sha256Hex(`deal-admission:${dealId}`),
    source_ordinal: 0,
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [fixture.section_reference],
    contract_bundle: MATERIAL_CONTRACTS_CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: declinedClassifier,
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals({
        material_contract_criteria: [{
          section_reference: fixture.section_reference,
          ...fixture.material_contract_criterion,
        }],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'canonical-v2-preview/material-contracts/v1',
        model_id: 'canonical-v2-preview-fixture',
        prompt: 'canonical-v2-preview/material-contracts/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: MATERIAL_CONTRACTS_CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
  const projection = projectMaterialContractsProductSurfaces({ resolution, deal_id: dealId });
  return materialContractsBridgeModule.bridgeMaterialContractsCardsToLegacyShape(projection, env);
}

function mergeMaterialContractsBridge(reviewDeal, bridge, env) {
  return materialContractsBridgeModule.mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridge, { env });
}

// -- General Covenants ----------------------------------------------------
// Mirrors tests/canonical-v2-general-covenants-dark-bridge.test.js's
// buildRealProjection: two grounded covenants resolve to native cards; the
// unresolved definition cross-reference and the unsupported covenant code
// both fall to open-world evidence, exactly as they do in that suite.

async function buildGeneralCovenantsBridge(dealId, env, fixture) {
  const lines = [
    `Section ${fixture.section_reference} ${fixture.section_title}.`,
    '',
    ...fixture.grounded_covenants.map((entry) => entry.quote),
    fixture.unresolved_definition_reference.quote,
    fixture.unsupported_code.quote,
  ];
  const sourceText = `${lines.join('\n')}\n`;
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: `canonical-v2-preview:general-covenants:${dealId}`,
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${dealId}`,
    deal_admission_id: sha256Hex(`deal-admission:${dealId}`),
    source_ordinal: 0,
  });
  const response = {
    general_covenants: [
      ...fixture.grounded_covenants.map((entry) => ({
        section_reference: fixture.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: entry.covenant_code,
        definition_cross_references: [],
        quote: entry.quote,
      })),
      {
        section_reference: fixture.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: fixture.unresolved_definition_reference.covenant_code,
        definition_cross_references: fixture.unresolved_definition_reference.definition_cross_references,
        quote: fixture.unresolved_definition_reference.quote,
      },
      {
        section_reference: fixture.section_reference,
        covenant_obligor: 'The Company',
        covenant_code: fixture.unsupported_code.covenant_code,
        definition_cross_references: [],
        quote: fixture.unsupported_code.quote,
      },
    ],
    open_world_candidates: [],
  };
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [fixture.section_reference],
    contract_bundle: GENERAL_COVENANTS_CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: declinedClassifier,
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeGeneralCovenantsProposals(response, governedScope.source_text);
      return {
        provider_id: 'canonical-v2-preview/general-covenants/v1',
        model_id: 'canonical-v2-preview-fixture',
        prompt: 'canonical-v2-preview/general-covenants/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: GENERAL_COVENANTS_CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
  const projection = projectGeneralCovenantsProductSurfaces({ resolution, deal_id: dealId });
  return generalCovenantsBridgeModule.bridgeGeneralCovenantsCardsToLegacyShape(projection, env);
}

function mergeGeneralCovenantsBridge(reviewDeal, bridge, env) {
  return generalCovenantsBridgeModule.mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridge, { env });
}

// -- No Other Reps / Fraud -------------------------------------------------
// Mirrors tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js's
// buildRealProjectionAndResolution. This family's projection carries no
// deal_id at all (see the module header of no-other-reps-fraud-dark-
// bridge.js) -- deal_id is supplied only at bridge-build time, below.

function noOtherRepsFraudSourceText(fixture) {
  const a = fixture.assertions;
  return [
    a.no_other_reps.assertion_quote,
    a.non_reliance.assertion_quote,
    a.independent_investigation.assertion_quote,
    a.fraud_carveout.assertion_quote,
    a.willful_breach_definition.definition_quote,
  ].join('\n');
}

function buildNoOtherRepsFraudBridge(dealId, env, fixture) {
  const sourceText = noOtherRepsFraudSourceText(fixture);
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
  const receipt = resolveNoOtherRepsFraudProposals({
    proposals, source_text: sourceText, source_id: dealId,
  });
  const projection = projectNoOtherRepsFraudProduct({ resolved: receipt.resolved });
  return noOtherRepsFraudBridgeModule.bridgeNoOtherRepsFraudCardsToLegacyShape(projection, {
    deal_id: dealId, resolved: receipt.resolved, env,
  });
}

function mergeNoOtherRepsFraudBridge(reviewDeal, bridge, env) {
  return noOtherRepsFraudBridgeModule.mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(reviewDeal, bridge, { env });
}

// -- Representations --------------------------------------------------------
// Mirrors tests/canonical-v2-representations-dark-bridge.test.js's
// buildProjection/legacyCardsFromFixture/buildLegacyReviewDeal. Unlike the
// other three families, deal_id never reaches the projection (representations-
// product-projection.js has no deal_id concept at all); it is resolved
// entirely from the reviewDeal argument bridgeRepresentationRecordsToLegacyShape
// joins legacy provisions against. That join target is built fresh here from
// this family's OWN fixture-seeded legacy cards (deal_id-stamped to the real
// deal being previewed) -- it never needs the real reviewDeal's actual cards,
// or the other three families' dark cards, because this fixture's governed
// records only ever reference THIS fixture's own seeded provision_instance_ids.

function seedId(seed) {
  return sha256Hex(seed);
}

function representationsLegacyCards(dealId, fixture) {
  return fixture.legacy_cards.map((card) => {
    const { id_seed, provision_instance_id_seed, ...rest } = card;
    const provisionInstanceId = seedId(provision_instance_id_seed);
    return {
      ...rest,
      id: provisionInstanceId,
      deal_id: dealId,
      provision_instance_id: provisionInstanceId,
    };
  });
}

function buildRepresentationsResolvedEntry(spec) {
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

function buildRepresentationsOpenWorldEntry(spec) {
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

// Same defaults tests/canonical-v2-representations-dark-bridge.test.js's own
// buildProjection() uses when called with no overrides: target accuracy +
// target knowledge + parent accuracy + one open-world item. The fixture's
// novel_concept_representation is deliberately left out here -- it exists in
// that suite to probe novel/unmapped-concept handling, not to describe a
// typical preview row.
function buildRepresentationsProjection(fixture) {
  const t = fixture.target_representation;
  const p = fixture.parent_representation;
  const targetAccuracy = buildRepresentationsResolvedEntry({
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
  const targetKnowledge = buildRepresentationsResolvedEntry({
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
  const parentAccuracy = buildRepresentationsResolvedEntry({
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
  const openWorld = buildRepresentationsOpenWorldEntry(fixture.open_world_evidence);
  return projectRepresentationClaims({
    resolved_entries: [targetAccuracy, targetKnowledge, parentAccuracy],
    open_world_entries: [openWorld],
  });
}

function buildRepresentationsBridge(dealId, env, fixture) {
  const legacyCards = representationsLegacyCards(dealId, fixture);
  const joinReviewDeal = shapeReviewDealRows(dealId, structuredClone(legacyCards), { claims: [] });
  const projection = buildRepresentationsProjection(fixture);
  return representationsBridgeModule.bridgeRepresentationRecordsToLegacyShape(projection, joinReviewDeal, env);
}

function mergeRepresentationsBridge(reviewDeal, bridge, env) {
  return representationsBridgeModule.mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridge, { env });
}

// -- assembler ---------------------------------------------------------------

function buildOutcome({ state, gate, attachedCardCount = 0, failure = null }) {
  return Object.freeze({
    schema_version: PREVIEW_STATUS_SCHEMA,
    state,
    gate,
    attached_card_count: attachedCardCount,
    failure,
  });
}

function describeFailure(phase, error) {
  const isError = error !== null && typeof error === 'object';
  return Object.freeze({
    phase,
    error_name: isError && error.name ? String(error.name) : 'Error',
    error_code: isError && error.code !== undefined && error.code !== null ? String(error.code) : null,
    error_reason: isError && error.reason !== undefined && error.reason !== null ? String(error.reason) : null,
    error_message: isError && error.message ? String(error.message) : String(error),
  });
}

function cardCountOf(deal) {
  return deal && Array.isArray(deal.cards) ? deal.cards.length : 0;
}

// The one place an outcome is written onto a served review deal. `enabled`
// is the exact boolean components/review/table-configs/canonical-v2-preview-
// lane.js's isCanonicalV2PreviewEnabled() reads (it requires === true, so an
// explicit false fails closed there, same as absent). The difference between
// absent and explicit-false is the whole fix: absent means nobody asked;
// false means someone did and did not get it.
function stampOutcome(reviewDeal, enabled, outcome) {
  if (reviewDeal === null || typeof reviewDeal !== 'object') return reviewDeal;
  return { ...reviewDeal, [PREVIEW_ENABLED_FIELD]: enabled, [PREVIEW_STATUS_FIELD]: outcome };
}

// A refusal-against-intent or an outright failure is reported to the server
// log as well as onto the payload: on a Vercel preview the runtime log is
// where a verifier can see the reason without a debugger, and it is the only
// channel that survives a caller which looks at nothing but the rendered
// page. Injectable so tests can assert the report happened (and so a test
// run does not spray the real console).
function reportOutcome(logger, outcome) {
  const sink = logger || console;
  const line = `[canonical-v2-preview] ${outcome.state} gate_reason=${outcome.gate.reason}`;
  const detail = JSON.stringify(outcome);
  if (outcome.state === CANONICAL_V2_PREVIEW_STATE.FAILED) {
    if (typeof sink.error === 'function') sink.error(line, detail);
    return;
  }
  if (typeof sink.warn === 'function') sink.warn(line, detail);
}

// Assembles all four Canonical V2 dark-bridge preview areas onto `reviewDeal`,
// read-time only, when (and only when) the dark-bridge gate permits it, and
// returns BOTH the review deal to serve and an outcome record describing what
// actually happened. This is the entry point a verification harness should
// use: it is the only one that can tell "the canonical path ran and produced
// this" from "the canonical path blew up and you are looking at legacy".
//
// Returns { reviewDeal, outcome }:
//   NOT_REQUESTED -- gate refused, no integration flag set at all. reviewDeal
//     is the IDENTICAL reference, byte-identical, no field added. This is the
//     production path and it is unchanged.
//   REFUSED -- the integration flag was set and the gate still said no.
//     reviewDeal is the legacy deal plus canonical_v2_preview_enabled: false
//     and the status record naming the gate's reason (CI_ENVIRONMENT_DETECTED,
//     RUNTIME_NOT_PERMITTED, ...). Nothing canonical is attached.
//   ATTACHED -- each family's bridge was built from its own __fixtures__/
//     canonical-v2/preview/*.json scenario (or an injected override -- see
//     `fixtures` below) and merged into the SAME reviewDeal, in the fixed
//     order material-contracts -> general-covenants -> no-other-reps-fraud ->
//     representations, with canonical_v2_preview_enabled: true stamped on the
//     result. outcome.attached_card_count says how many cards that added; 0 is
//     a legitimate ATTACHED result and is NOT a failure.
//   FAILED -- anything in that sequence threw (a bridge construction/merge
//     throw, a corrupted fixture, an unexpected shape). The ORIGINAL, un-merged
//     reviewDeal is served -- a broken preview must never break the real review
//     page, which is why this still does not throw -- but it is stamped
//     canonical_v2_preview_enabled: false with the failing phase and error in
//     the status record, and reported to the log. It is never returned as an
//     untouched deal indistinguishable from a clean no-op.
//
// `fixtures` is an optional per-family override (keys: materialContracts,
// generalCovenants, noOtherRepsFraud, representations), defaulting to the
// four real pinned fixtures. It exists so callers -- in practice, tests --
// can substitute a deliberately invalid scenario for exactly one family
// without touching the real, checked-in fixture files.
async function assembleCanonicalV2Preview(reviewDeal, { env, fixtures, logger } = {}) {
  const resolvedEnv = env || process.env;
  const gate = describeDarkBridgeGate(resolvedEnv);

  if (!gate.enabled) {
    if (!isDarkBridgeIntegrationRequested(resolvedEnv)) {
      return { reviewDeal, outcome: buildOutcome({ state: CANONICAL_V2_PREVIEW_STATE.NOT_REQUESTED, gate }) };
    }
    const outcome = buildOutcome({ state: CANONICAL_V2_PREVIEW_STATE.REFUSED, gate });
    reportOutcome(logger, outcome);
    return { reviewDeal: stampOutcome(reviewDeal, false, outcome), outcome };
  }

  const resolvedFixtures = { ...DEFAULT_FIXTURES, ...fixtures };

  // Named before each step, reported on failure: which family broke is the
  // first thing anyone asks and the catch below is otherwise blind to it.
  let phase = 'DEAL_IDENTITY';
  try {
    const dealId = reviewDeal.dealId;

    phase = 'MATERIAL_CONTRACTS';
    const materialContractsBridge = await buildMaterialContractsBridge(dealId, resolvedEnv, resolvedFixtures.materialContracts);
    let merged = mergeMaterialContractsBridge(reviewDeal, materialContractsBridge, resolvedEnv);

    phase = 'GENERAL_COVENANTS';
    const generalCovenantsBridge = await buildGeneralCovenantsBridge(dealId, resolvedEnv, resolvedFixtures.generalCovenants);
    merged = mergeGeneralCovenantsBridge(merged, generalCovenantsBridge, resolvedEnv);

    phase = 'NO_OTHER_REPS_FRAUD';
    const noOtherRepsFraudBridge = buildNoOtherRepsFraudBridge(dealId, resolvedEnv, resolvedFixtures.noOtherRepsFraud);
    merged = mergeNoOtherRepsFraudBridge(merged, noOtherRepsFraudBridge, resolvedEnv);

    phase = 'REPRESENTATIONS';
    const representationsBridge = buildRepresentationsBridge(dealId, resolvedEnv, resolvedFixtures.representations);
    merged = mergeRepresentationsBridge(merged, representationsBridge, resolvedEnv);

    const outcome = buildOutcome({
      state: CANONICAL_V2_PREVIEW_STATE.ATTACHED,
      gate,
      attachedCardCount: cardCountOf(merged) - cardCountOf(reviewDeal),
    });
    return { reviewDeal: stampOutcome(merged, true, outcome), outcome };
  } catch (error) {
    const outcome = buildOutcome({
      state: CANONICAL_V2_PREVIEW_STATE.FAILED,
      gate,
      failure: describeFailure(phase, error),
    });
    reportOutcome(logger, outcome);
    // The ORIGINAL reviewDeal, never the partially-merged one: a half-merged
    // deal is not a legacy deal, and serving one would be its own silent
    // corruption.
    return { reviewDeal: stampOutcome(reviewDeal, false, outcome), outcome };
  }
}

// The deal-only view of the above, kept for the served route (pages/api/
// review/[id]/cards.js), whose job is to hand a review deal to the client
// and which cannot act on an outcome record. It still never throws, and the
// outcome it discards is not lost: it is stamped onto the deal it returns
// (canonical_v2_preview_enabled + canonical_v2_preview_status) and, for
// REFUSED/FAILED, reported to the log.
async function attachCanonicalV2Preview(reviewDeal, options) {
  const assembled = await assembleCanonicalV2Preview(reviewDeal, options);
  return assembled.reviewDeal;
}

module.exports = {
  attachCanonicalV2Preview,
  assembleCanonicalV2Preview,
  CANONICAL_V2_PREVIEW_STATE,
  PREVIEW_ENABLED_FIELD,
  PREVIEW_STATUS_FIELD,
};
