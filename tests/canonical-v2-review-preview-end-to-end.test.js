'use strict';

// End-to-end proof that the REAL Canonical V2 preview assembler output flows,
// unmodified, through all four table configs and into the shared preview
// lane -- closing the gap between two existing suites that both pass but
// never touch each other:
//
//   - tests/canonical-v2-review-preview-route.test.js proves the server
//     assembler (attachCanonicalV2Preview, lib/canonical-v2/review-preview-
//     assembly.js) merges all four families' dark cards into a reviewDeal
//     and stamps canonical_v2_preview_enabled -- but it never calls a single
//     table config and never renders anything.
//   - tests/canonical-v2-review-preview-lane.test.js proves the shared
//     "Canonical V2 Preview" lane renders and partitions correctly -- but,
//     by its own header comment, it deliberately hand-crafts minimal dark
//     card shapes rather than driving them through the real assembler.
//
// Neither suite proves the two halves actually fit together: that the
// assembler's real card shape is what each config's own dark-card
// recognition logic (isDarkV2Card / isMaterialContractsRepCard /
// isNoOtherRepsFraudDarkCard / selectDarkRepCards, etc.) actually matches,
// and that the flag name the assembler stamps (canonical_v2_preview_enabled)
// is the exact one each config's isCanonicalV2PreviewEnabled() reads. If
// either drifted, both existing suites would stay green while the feature
// stayed dead in the browser. This suite calls the real assembler, feeds its
// real output into the real configs' selectRows(), and renders through the
// real ProvisionTable -- no hand-crafted card shapes anywhere in this file.

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  attachCanonicalV2Preview,
  assembleCanonicalV2Preview,
  CANONICAL_V2_PREVIEW_STATE,
} = require('../lib/canonical-v2/review-preview-assembly');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
// Each family's own BRIDGE_SCHEMA, imported for the F3 receipts-chain proof
// below -- the real, authoritative constants each bridge module stamps on
// its own canonical_v2_bridge_receipts entry, not re-typed string literals.
const { BRIDGE_SCHEMA: MATERIAL_CONTRACTS_BRIDGE_SCHEMA } = require('../lib/canonical-v2/legacy-card-bridge');
const { BRIDGE_SCHEMA: GENERAL_COVENANTS_BRIDGE_SCHEMA } = require('../lib/canonical-v2/general-covenants-dark-bridge');
const { BRIDGE_SCHEMA: NO_OTHER_REPS_FRAUD_BRIDGE_SCHEMA } = require('../lib/canonical-v2/no-other-reps-fraud-dark-bridge');
const { BRIDGE_SCHEMA: REPRESENTATIONS_BRIDGE_SCHEMA } = require('../lib/canonical-v2/representations-dark-bridge');

// -- ESM/JSX loader -- copied verbatim from tests/canonical-v2-review-
// preview-lane.test.js (its own header calls this "the loadEsmModule helper
// already used by all four existing dark-bridge suites"). Reused exactly,
// per this task's brief, rather than inventing a second loading mechanism.
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

const {
  CANONICAL_V2_PREVIEW_LANE_LABEL,
  DARK_PREVIEW_MARKET_STATE,
  isCanonicalV2PreviewRow,
  partitionCanonicalV2PreviewRows,
} = loadEsmModule('../components/review/table-configs/canonical-v2-preview-lane.js');

const { materialContractsConfig } = loadEsmModule('../components/review/table-configs/material-contracts.config.js');
const { generalCovenantsConfig } = loadEsmModule('../components/review/table-configs/general-covenants.config.js');
const { noOtherRepsFraudConfig } = loadEsmModule('../components/review/table-configs/no-other-reps-fraud.config.js');
const { representationsQualifiersConfig, EXCLUDED_CONCEPTS } = loadEsmModule('../components/review/table-configs/representations-qualifiers.config.js');
const { default: ProvisionTable } = loadEsmModule('../components/review/ProvisionTable.jsx');
const { enumerateMarketSectionRows } = loadEsmModule('../lib/market-metrics/section-rows.js');
const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');

// Explicit env objects only -- never ambient process.env -- so this suite is
// unaffected by concurrent edits to the four *-dark-bridge.js modules and
// legacy-card-bridge.js elsewhere in this worktree. Matches tests/canonical-
// v2-review-preview-route.test.js's ENABLED_ENV exactly: no Vercel/CI/
// production keys, just the one flag the dark-bridge gate reads.
const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const DISABLED_ENV = Object.freeze({});

const DEAL_ID = 'e2e-preview-fixture-deal';
const PREVIEW_SUFFIX_RE = /\(Canonical V2 preview\)/;

// -- one real, live (non-dark) card per area, reused verbatim from tests/
// canonical-v2-review-preview-lane.test.js's own per-area fixtures -- each
// already independently verified there against that config's own selection
// logic. Reusing them here means this suite spends its own effort on what's
// actually new: real assembler-produced dark cards feeding the real configs,
// not on re-deriving hand-rolled live cards that add no coverage of their
// own. The no-other-reps-fraud live card is deliberately signal-free -- see
// the lane test's own comment on why a correctly-EMPTY live-row baseline is
// still a valid "legacy rows unchanged" proof for that config.
function liveFixtureCards() {
  return [
    {
      id: 'live-material-contracts-rep',
      deal_id: DEAL_ID,
      provision_instance_id: 'live-material-contracts-rep',
      excerpt_id: 'live-material-contracts-rep:0',
      section_ref: '3.13',
      short_title: 'Material Contracts',
      kind: 'standard',
      type: 'REPRESENTATION',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      primary_quote: 'Section 3.13 lists each Contract involving a joint venture or partnership arrangement.',
      region_full_text: 'Section 3.13 lists each Contract involving a joint venture or partnership arrangement.',
      features: {
        materialContractsBuckets: [{
          code: 'JV_PARTNERSHIPS',
          label: 'Joint ventures / partnerships',
          quotes: ['each Contract involving a joint venture or partnership arrangement'],
        }],
      },
      ai_metadata: {},
    },
    {
      id: 'live-general-covenant-notify',
      deal_id: DEAL_ID,
      provision_instance_id: 'live-general-covenant-notify',
      excerpt_id: 'live-general-covenant-notify:0',
      section_ref: '6.05',
      short_title: 'Notification of Certain Matters',
      kind: 'standard',
      type: 'COVENANT_OTHER',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-NOTIFY',
      primary_quote: 'Each party shall promptly notify the other of any fact that would cause a closing condition to fail.',
      region_full_text: 'Each party shall promptly notify the other of any fact that would cause a closing condition to fail.',
      features: {},
      ai_metadata: {},
    },
    {
      id: 'live-unrelated-notices',
      deal_id: DEAL_ID,
      provision_instance_id: 'live-unrelated-notices',
      excerpt_id: 'live-unrelated-notices:0',
      section_ref: '10.2',
      short_title: 'Notices',
      kind: 'standard',
      type: 'MISC_BOILERPLATE',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-NOTICES',
      primary_quote: 'All notices under this Agreement shall be in writing and delivered by hand or electronic mail.',
      region_full_text: 'All notices under this Agreement shall be in writing and delivered by hand or electronic mail.',
      features: {},
      ai_metadata: {},
    },
    {
      id: 'live-rep-t-capitalization',
      deal_id: DEAL_ID,
      provision_instance_id: 'live-rep-t-capitalization',
      excerpt_id: 'live-rep-t-capitalization:0',
      section_ref: '3.2',
      short_title: 'Capitalization',
      kind: 'standard',
      type: 'REPRESENTATION',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-CAPITALIZATION',
      primary_quote: 'The authorized capital stock of the Company consists of 100,000,000 shares of common stock.',
      region_full_text: 'The authorized capital stock of the Company consists of 100,000,000 shares of common stock.',
      features: {},
      ai_metadata: {},
    },
  ];
}

function buildBaseReviewDeal() {
  return shapeReviewDealRows(DEAL_ID, liveFixtureCards(), { claims: [] });
}

const LIVE_CARD_IDS = new Set(liveFixtureCards().map((card) => card.id));

const AREAS = [
  { config: materialContractsConfig },
  { config: generalCovenantsConfig },
  { config: noOtherRepsFraudConfig },
  { config: representationsQualifiersConfig },
];

// A preview row's traceable pointer back to the card it was built from --
// field name varies by config (material-contracts/no-other-reps-fraud use
// source/sourceCard, general-covenants uses sourceCard only, representations-
// qualifiers uses card), but exactly one of the three is always present.
function rowSourceCard(row) {
  return row.card || row.sourceCard || row.source || null;
}

// lib/queries/review-deal.js's shapeReviewDealRows() is not permitted to be
// touched by this task, and is not deterministic in which OWN keys it stamps
// on a re-shaped card across separate invocations of the same logical input:
// confirmed directly (two back-to-back shapeReviewDealRows(dealId, [card],
// {claims:[]}) calls, no assembler, no table config, no dark cards at all
// involved) that a card can come back with an explicit `defined_term:
// undefined` / `defined_value: undefined` own-key pair present on one call
// and absent on another, while remaining JSON-value-identical either way.
// The same symptom reproduces on general-covenants.config.js's legacy row
// below -- a config this task's two fixes never touch -- which is what rules
// out materialContractsConfig/representationsQualifiersConfig's own changes
// as the cause. An `undefined`-valued key and an absent key carry no
// semantic difference anywhere this codebase reads a card, so the byte-
// identity check below compares through a pass that drops undefined-valued
// keys -- preserving its real job (catching an actual row/content/order
// regression) without failing on this unrelated, pre-existing artifact.
function withoutUndefinedKeys(value) {
  if (Array.isArray(value)) return value.map(withoutUndefinedKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      out[key] = withoutUndefinedKeys(val);
    }
    return out;
  }
  return value;
}

let disabledInputDeal;
let disabledResult;
let enabledResult;
let addedCards;
// The gate is open, but the canonical path throws (one deliberately invalid
// family fixture). Used by the render-survival proof at the end of this file.
let failedInputDeal;
let failedResult;
let failedOutcome;

test.before(async () => {
  disabledInputDeal = buildBaseReviewDeal();
  disabledResult = await attachCanonicalV2Preview(disabledInputDeal, { env: DISABLED_ENV });
  enabledResult = await attachCanonicalV2Preview(buildBaseReviewDeal(), { env: ENABLED_ENV });
  addedCards = (enabledResult.cards || []).filter((card) => !LIVE_CARD_IDS.has(card.id));

  failedInputDeal = buildBaseReviewDeal();
  const failed = await assembleCanonicalV2Preview(failedInputDeal, {
    env: ENABLED_ENV,
    fixtures: { materialContracts: { section_reference: '3.13' } },
    logger: { warn: () => {}, error: () => {} },
  });
  failedResult = failed.reviewDeal;
  failedOutcome = failed.outcome;
});

// =============================================================================
// Chain links 1 + 2 + 9: the real assembler, gate ENABLED.
// =============================================================================

test('assembler (gate ENABLED): attaches real dark cards for all four areas, every one VALIDATED_NOT_SERVED', () => {
  // Sanity precondition: the shared constants this suite's expectations are
  // written against really are the values the brief specifies.
  assert.equal(CANONICAL_V2_PREVIEW_LANE_LABEL, 'Canonical V2 Preview');
  assert.equal(DARK_PREVIEW_MARKET_STATE, 'DARK_REVIEW_ONLY');

  assert.equal(enabledResult.canonical_v2_preview_enabled, true);
  assert.ok(addedCards.length > 0, 'attachCanonicalV2Preview must have added at least one dark card with the gate enabled');
  assert.ok(
    addedCards.every((card) => card.authority_state === 'VALIDATED_NOT_SERVED'),
    `every assembler-added card must carry authority_state VALIDATED_NOT_SERVED; got: ${
      JSON.stringify(addedCards.map((c) => ({ id: c.id, authority_state: c.authority_state })))}`,
  );
});

// =============================================================================
// Chain link 7 (assembler half): gate DISABLED.
// =============================================================================

test('assembler (gate DISABLED): returns the identical reviewDeal reference, no dark cards, no flag', () => {
  assert.equal(disabledResult, disabledInputDeal, 'gate-off must return the identical object reference, not a copy');
  assert.equal(
    Object.prototype.hasOwnProperty.call(disabledResult, 'canonical_v2_preview_enabled'),
    false,
    'gate-off must never add canonical_v2_preview_enabled',
  );
});

// =============================================================================
// F3/F11 regression coverage: the real assembler chains all four families'
// dark bridges into ONE reviewDeal, in the fixed order material-contracts ->
// general-covenants -> no-other-reps-fraud -> representations. Before the
// fix, three of those four merges wrote canonical_v2_bridge_receipts by
// REPLACEMENT (only the last-merged family's receipt survived: fourteen
// dark cards from four families, two receipt keys, one of them holding a
// single receipt), and the no-other-reps-fraud merge never recomputed
// sections/definitions once chained after another family had already
// populated them. Both are fixed now; proven here against the REAL
// assembler output, not a hand-rolled chain.
// =============================================================================

test("canonical_v2_bridge_receipts: chaining all four real families produces exactly four receipts, one per family, in the assembler's fixed merge order", () => {
  const receipts = enabledResult.canonical_v2_bridge_receipts;
  assert.ok(Array.isArray(receipts), 'canonical_v2_bridge_receipts must be an array');
  assert.equal(
    receipts.length,
    4,
    `expected exactly 4 receipts (one per family), got ${receipts.length}: ${JSON.stringify(receipts, null, 2)}`,
  );
  assert.deepEqual(
    receipts.map((receipt) => receipt.schema_version),
    [
      MATERIAL_CONTRACTS_BRIDGE_SCHEMA,
      GENERAL_COVENANTS_BRIDGE_SCHEMA,
      NO_OTHER_REPS_FRAUD_BRIDGE_SCHEMA,
      REPRESENTATIONS_BRIDGE_SCHEMA,
    ],
    "receipts must appear in the assembler's fixed family merge order: material-contracts, general-covenants, no-other-reps-fraud, representations",
  );
  for (const receipt of receipts) {
    assert.equal(receipt.authority_state, 'VALIDATED_NOT_SERVED');
    assert.equal(receipt.source_authentication_state, 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY');
    assert.match(receipt.bridge_id, /^[0-9a-f]{64}$/, 'bridge_id must be a lower-case SHA-256');
    assert.match(receipt.source_projection_id, /^[0-9a-f]{64}$/, 'source_projection_id must be a lower-case SHA-256');
  }
  assert.equal(
    new Set(receipts.map((receipt) => receipt.bridge_id)).size,
    4,
    'every receipt must have a distinct bridge_id',
  );

  // The retired No Other Reps / Fraud-only key must not reappear now that
  // it appends to the shared key like the other three families.
  assert.equal(
    Object.prototype.hasOwnProperty.call(enabledResult, 'canonical_v2_no_other_reps_fraud_bridge_receipts'),
    false,
    'the retired distinct receipts key must not reappear',
  );
});

test('canonical_v2_bridge_receipts: receipt order and content are deterministic across independent runs of the real assembler', async () => {
  const secondRun = await attachCanonicalV2Preview(buildBaseReviewDeal(), { env: ENABLED_ENV });
  assert.equal(
    canonicalJson(secondRun.canonical_v2_bridge_receipts),
    canonicalJson(enabledResult.canonical_v2_bridge_receipts),
    'two independent runs of the real assembler, same inputs, must produce a byte-identical receipts array',
  );
});

test('after the real four-family chained merge, cardCount, cards, claims, sections and definitions are all mutually consistent', () => {
  assert.equal(enabledResult.cards.length, enabledResult.cardCount, 'cards.length must equal cardCount');

  const sectionTotal = enabledResult.sections.reduce((total, section) => total + section.cards.length, 0);
  assert.equal(
    sectionTotal,
    enabledResult.cardCount,
    `sections must cover every card exactly once (got ${sectionTotal} section cards, ${enabledResult.cardCount} total cards)`,
  );
  const sectionCardIds = enabledResult.sections.flatMap((section) => section.cards.map((card) => card.id));
  assert.deepEqual(
    [...sectionCardIds].sort(),
    enabledResult.cards.map((card) => card.id).sort(),
    'sections must contain exactly the same card ids as cards, no more and no fewer',
  );

  assert.deepEqual(
    enabledResult.definitions,
    enabledResult.cards.filter((card) => card.kind === 'definition'),
    'definitions must be exactly the subset of cards carrying kind === "definition"',
  );

  // Every real added card from all four families must be traceable inside
  // the recomputed sections view -- not just the pre-existing legacy cards.
  for (const card of addedCards) {
    assert.ok(
      enabledResult.sections.some((section) => section.cards.some((sectionCard) => sectionCard.id === card.id)),
      `added card ${card.id} (family marker: ${card.provision_subtype || card.type}) must appear in the recomputed sections view`,
    );
  }

  // claims: every claim with a provision_instance_id must bind to a card
  // that is actually present -- no orphaned claims left over from a stale
  // intermediate merge.
  const cardIds = new Set(enabledResult.cards.map((card) => card.id));
  const orphanedClaims = (enabledResult.claims || []).filter((claim) => (
    typeof claim.provision_instance_id === 'string'
      && claim.provision_instance_id.length > 0
      && !cardIds.has(claim.provision_instance_id)
  ));
  assert.deepEqual(orphanedClaims, [], 'every claim with a provision_instance_id must bind to a card present in the merged deal');
});

// =============================================================================
// Per-area chain links 3, 4, 5, 9 (per-row) and 10.
// =============================================================================

for (const area of AREAS) {
  const { config } = area;
  test(`${config.id}: real assembler dark cards produce recognised preview rows carrying every required invariant`, () => {
    const rows = config.selectRows(enabledResult);
    const { legacyRows, previewRows } = partitionCanonicalV2PreviewRows(rows);

    assert.ok(
      previewRows.length > 0,
      `${config.id}: selectRows(enabledResult) produced no preview rows -- broken link between the real ` +
      `assembler cards and this config's own dark-card recognition logic. Full selectRows() output: ` +
      `${JSON.stringify(rows, null, 2)}. Assembler-added cards available: ` +
      `${JSON.stringify(addedCards.map((c) => ({ id: c.id, provision_type: c.provision_type, provision_subtype: c.provision_subtype, type: c.type, claim_definition_key: c.claim_definition_key, authority_state: c.authority_state })), null, 2)}`,
    );

    for (const row of previewRows) {
      // Assertion 4 at object-identity strength: this row must trace back to
      // one of the assembler's REAL added cards, not merely resemble one.
      const src = rowSourceCard(row);
      assert.ok(src, `${config.id}: preview row "${row.id}" must carry a traceable source-card reference`);
      assert.ok(
        addedCards.includes(src),
        `${config.id}: preview row "${row.id}"'s source card is not one of the assembler's real added cards (object identity check failed)`,
      );

      // Assertion 5: recognised by the shared partition rule.
      assert.equal(isCanonicalV2PreviewRow(row), true, `${config.id}: every partitioned preview row must satisfy isCanonicalV2PreviewRow`);

      // Assertion 10 (row invariants).
      assert.equal(row.marketSkip, true, `${config.id}: preview row "${row.id}" must carry marketSkip: true`);
      assert.equal(row.marketState, DARK_PREVIEW_MARKET_STATE, `${config.id}: preview row "${row.id}" must carry marketState: DARK_REVIEW_ONLY`);
      assert.equal(row.comparisonState, 'NOT_ADMITTED', `${config.id}: preview row "${row.id}" must carry comparisonState: NOT_ADMITTED`);
    }
    for (const row of legacyRows) {
      assert.equal(isCanonicalV2PreviewRow(row), false, `${config.id}: a legacy row must never satisfy isCanonicalV2PreviewRow`);
    }

    // Assertion 10 (coverage/covered-count exclusion): both the shared
    // market-coverage enumerator and compare mode's safeRows operate on
    // config.selectRows()'s FULL (unpartitioned) output, exactly as the live
    // app does -- mirrors tests/canonical-v2-review-preview-lane.test.js.
    const section = { id: config.id, config };
    const enumerated = enumerateMarketSectionRows(section, enabledResult);
    assert.equal(
      enumerated.some(({ row }) => isCanonicalV2PreviewRow(row)),
      false,
      `${config.id}: enumerateMarketSectionRows must drop every preview row from the coverage/covered count`,
    );
    const safe = safeRows(config, enabledResult);
    assert.equal(
      safe.some((row) => isCanonicalV2PreviewRow(row)),
      false,
      `${config.id}: CompareColumn.safeRows must drop every preview row`,
    );
  });
}

// =============================================================================
// Per-area chain links 7 (config half) + 8.
// =============================================================================

for (const area of AREAS) {
  const { config } = area;
  test(`${config.id}: gate DISABLED yields zero preview rows, and legacy rows are byte-identical to the gate-ON run's legacy half`, () => {
    const disabledRows = config.selectRows(disabledResult);
    const { previewRows: disabledPreviewRows } = partitionCanonicalV2PreviewRows(disabledRows);
    assert.equal(disabledPreviewRows.length, 0, `${config.id}: gate-off must never produce a preview row`);

    const enabledRows = config.selectRows(enabledResult);
    const { legacyRows: enabledLegacyRows } = partitionCanonicalV2PreviewRows(enabledRows);
    assert.deepEqual(
      withoutUndefinedKeys(enabledLegacyRows),
      withoutUndefinedKeys(disabledRows),
      `${config.id}: legacy rows must be byte-identical whether the gate is on or off -- the preview must be provably additive`,
    );
  });
}

// =============================================================================
// Per-area chain link 6: the real render path.
// =============================================================================

for (const area of AREAS) {
  const { config } = area;
  test(`${config.id}: ProvisionTable renders exactly one default-collapsed "Canonical V2 Preview" lane, and no preview row leaks into the legacy table body`, () => {
    const laneTestId = `provision-table-preview-lane-${config.id}`;

    const html = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: enabledResult, isEdit: false }),
    );
    const laneMatches = html.match(new RegExp(`data-testid="${laneTestId}"`, 'g')) || [];
    assert.equal(laneMatches.length, 1, `${config.id}: exactly one lane must render (found ${laneMatches.length})`);

    const laneStartIndex = html.indexOf(`data-testid="${laneTestId}"`);
    assert.ok(laneStartIndex > -1, `${config.id}: the lane must be present in the rendered output`);
    const beforeLane = html.slice(0, laneStartIndex);
    const fromLaneOnward = html.slice(laneStartIndex);

    assert.doesNotMatch(
      beforeLane,
      PREVIEW_SUFFIX_RE,
      `${config.id}: a dark preview row must not render inline in the legacy table body`,
    );
    assert.match(
      fromLaneOnward,
      PREVIEW_SUFFIX_RE,
      `${config.id}: the dark preview row must render inside the lane`,
    );
    assert.match(
      fromLaneOnward,
      new RegExp(CANONICAL_V2_PREVIEW_LANE_LABEL),
      `${config.id}: the lane's exact label must render`,
    );

    const detailsTagMatch = html.match(new RegExp(`<details[^>]*data-testid="${laneTestId}"[^>]*>`));
    assert.ok(detailsTagMatch, `${config.id}: the lane must be a <details> element`);
    assert.doesNotMatch(detailsTagMatch[0], /\bopen\b/, `${config.id}: the lane must be default-collapsed`);

    // Gate-off render, same config, byte-different reviewDeal (disabledResult
    // never saw a dark card): no lane, no preview-suffixed text, at all.
    const gateOffHtml = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: disabledResult, isEdit: false }),
    );
    assert.doesNotMatch(gateOffHtml, new RegExp(`data-testid="${laneTestId}"`), `${config.id}: gate-off must render no lane`);
    assert.doesNotMatch(gateOffHtml, PREVIEW_SUFFIX_RE, `${config.id}: gate-off must render no preview-suffixed row`);
  });
}

// =============================================================================
// Bug 1: material-contracts.config.js's evidenceOnlyRows() used to match ANY
// card anywhere on the deal carrying canonical_v2_lineage.source ===
// CANONICAL_V2_OPEN_WORLD_EVIDENCE, with no family scoping -- so once the real
// assembler merges all four families onto one reviewDeal, General Covenants'
// and Representations' own open-world evidence residual cards leaked into the
// Material Contracts lane too. Proven against the REAL assembler-added cards,
// never a hand-crafted shape, same discipline as every other test above.
// =============================================================================

test('material-contracts.config.js: does not claim General Covenants\' open-world evidence card', () => {
  const generalCovenantsEvidenceCard = addedCards.find((card) => card.provision_subtype === 'COV-UNTYPED-EVIDENCE');
  assert.ok(
    generalCovenantsEvidenceCard,
    'sanity: the real assembler must have added a General Covenants evidence card for this proof to mean anything',
  );
  assert.equal(generalCovenantsEvidenceCard.short_title, 'Deferred general-covenant evidence');

  const materialContractsRows = materialContractsConfig.selectRows(enabledResult);
  assert.ok(
    materialContractsRows.every((row) => rowSourceCard(row) !== generalCovenantsEvidenceCard),
    'material-contracts.config.js must never claim General Covenants\' own evidence card',
  );

  // Not over-broad the other way: the same card is still exactly where it
  // belongs, in General Covenants' own selectRows() output.
  const generalCovenantsRows = generalCovenantsConfig.selectRows(enabledResult);
  assert.ok(
    generalCovenantsRows.some((row) => rowSourceCard(row) === generalCovenantsEvidenceCard),
    'General Covenants\' own evidence card must still render in its own lane',
  );
});

test('material-contracts.config.js: does not claim Representations\' open-world evidence card', () => {
  const representationsEvidenceCard = addedCards.find((card) => card.provision_subtype === 'REP-EVIDENCE-OPEN-WORLD');
  assert.ok(
    representationsEvidenceCard,
    'sanity: the real assembler must have added a Representations open-world evidence card for this proof to mean anything',
  );
  // representations-dark-bridge.js stamps no short_title on an open-world
  // card by design -- this is precisely why, pre-fix, it fell through to
  // material-contracts.config.js's own "Deferred material-contract evidence"
  // fallback label instead of simply not matching at all.
  assert.equal(representationsEvidenceCard.short_title, null);

  const materialContractsRows = materialContractsConfig.selectRows(enabledResult);
  assert.ok(
    materialContractsRows.every((row) => rowSourceCard(row) !== representationsEvidenceCard),
    'material-contracts.config.js must never claim Representations\' own open-world evidence card',
  );
  assert.ok(
    materialContractsRows.every((row) => row.label !== 'Deferred material-contract evidence'),
    'no row may render this config\'s own evidence-only fallback label when the real source is a foreign card',
  );
});

test('material-contracts.config.js: still renders its own genuine open-world evidence card (positive match is not over-narrow)', () => {
  // The real assembler's own Material Contracts fixture (lib/canonical-v2/
  // review-preview-assembly.js's buildMaterialContractsBridge) passes
  // open_world_candidates: [] -- its one grounded criterion resolves fully,
  // so addedCards has no Material Contracts evidence card to find here. The
  // shape below is not invented: it is copied verbatim from material-
  // contracts-product-projection.js's own evidenceCards builder (type
  // 'REP-T', provision_type 'REPRESENTATION', provision_subtype 'REP-T-
  // CONTRACTS-EVIDENCE') -- the same shape tests/canonical-v2-material-
  // contracts-family-parity.test.js already pins end-to-end through the real
  // native-extraction pipeline. This is a fast, minimal corroboration of the
  // same positive-match contract, not a replacement for that coverage.
  const genuineEvidenceCard = {
    id: 'genuine-material-contracts-evidence',
    deal_id: DEAL_ID,
    provision_instance_id: 'genuine-material-contracts-evidence',
    excerpt_id: 'open-world:genuine-material-contracts-evidence',
    type: 'REP-T',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-CONTRACTS-EVIDENCE',
    section_ref: '3.13',
    short_title: 'Deferred material-contract evidence',
    primary_quote: 'Section 3.13 also references undefined ancillary supply arrangements.',
    region_full_text: 'Section 3.13 also references undefined ancillary supply arrangements.',
    features: {},
    ai_metadata: { features: {} },
    canonical_v2_lineage: {
      source: 'CANONICAL_V2_OPEN_WORLD_EVIDENCE',
      reason: 'MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED',
      claim_revision_ids: [],
    },
  };
  const reviewDealWithEvidence = shapeReviewDealRows(DEAL_ID, [genuineEvidenceCard], { claims: [] });
  const rows = materialContractsConfig.selectRows(reviewDealWithEvidence);
  const evidenceRow = rows.find((row) => rowSourceCard(row)?.id === 'genuine-material-contracts-evidence');
  assert.ok(evidenceRow, 'a genuine Material Contracts evidence-only card must still produce a row');
  assert.equal(evidenceRow.label, 'Deferred material-contract evidence');
});

// =============================================================================
// Bug 2: No Other Reps / Fraud's own dark bridge deliberately, correctly
// stamps its non-willful-breach cards provision_type REPRESENTATION with
// REP-T-/REP-B- coded subtypes (no-other-reps-fraud-dark-bridge.js, ~line
// 411-412) -- correct for its own domain, but representations-qualifiers.
// config.js's isPartyRepresentationCard() matched purely on provision_type +
// code prefix, with no exclusion, so the SAME card rendered in both lanes at
// once. Proven against the REAL assembler-added card.
// =============================================================================

test('representations-qualifiers.config.js: does not claim a No Other Reps / Fraud card, which renders in exactly one lane', () => {
  const noOtherRepsCard = addedCards.find((card) => card.provision_subtype === 'REP-T-NOOTHERREPS');
  assert.ok(
    noOtherRepsCard,
    'sanity: the real assembler must have added a No Other Reps / Fraud "no other representations" card for this proof to mean anything',
  );
  assert.equal(noOtherRepsCard.provision_type, 'REPRESENTATION');

  const representationsRows = representationsQualifiersConfig.selectRows(enabledResult);
  assert.ok(
    representationsRows.every((row) => rowSourceCard(row) !== noOtherRepsCard),
    'representations-qualifiers.config.js must not claim a card owned by the No Other Reps / Fraud family',
  );

  const claimingAreaIds = AREAS
    .filter(({ config }) => config.selectRows(enabledResult).some((row) => rowSourceCard(row) === noOtherRepsCard))
    .map(({ config }) => config.id);
  assert.deepEqual(
    claimingAreaIds,
    ['no-other-reps-fraud'],
    'the "no other representations" card must render in exactly one area\'s selectRows() output, and it must be No Other Reps / Fraud\'s own',
  );
});

test('representations-qualifiers.config.js: genuine Representations dark preview rows still render (exclusion is not over-broad)', () => {
  const rows = representationsQualifiersConfig.selectRows(enabledResult);
  const { previewRows } = partitionCanonicalV2PreviewRows(rows);
  const repPreviewRows = previewRows.filter((row) => row.kind === 'rep');
  assert.ok(repPreviewRows.length > 0, 'a genuine Representations dark preview row must still render');
  for (const row of repPreviewRows) {
    const src = rowSourceCard(row);
    assert.ok(src, `${row.id}: each genuine rep row must trace back to a real card`);
    assert.ok(
      !EXCLUDED_CONCEPTS.has(src.provision_subtype),
      `${row.id}: its source card's own concept (${src.provision_subtype}) should not itself be excluded -- the fix must not be over-broad`,
    );
  }
});

test('representations-qualifiers.config.js: EXCLUDED_CONCEPTS mirror matches the real upstream authority in representations-product-projection.js', () => {
  // representations-product-projection.js does not export EXCLUDED_CONCEPTS
  // (it is a module-private const -- see its own module.exports list, and
  // representations-dark-bridge.js's identical "Mirrors (does NOT import...)"
  // comment for its own independent copy of the same set), so representations-
  // qualifiers.config.js mirrors it locally rather than importing it. This
  // test is the verification that mirror deserves: drive the real, exported
  // projectRepresentationClaims() with a minimal synthetic entry naming each
  // mirrored concept, and confirm the upstream module's own
  // EXCLUDED_FAMILY_OWNERSHIP guard fires for every single one -- so drift
  // between the mirror and its source of truth is caught here, not silent.
  const { projectRepresentationClaims } = require('../lib/canonical-v2/representations-product-projection');
  function probeErrorCode(conceptKey) {
    try {
      projectRepresentationClaims({
        resolved_entries: [{ resolved_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD', concept_key: conceptKey }],
      });
      return null;
    } catch (error) {
      return error.code;
    }
  }

  assert.ok(EXCLUDED_CONCEPTS.size > 0, 'sanity: the mirrored set must not be empty');
  for (const conceptKey of EXCLUDED_CONCEPTS) {
    assert.equal(
      probeErrorCode(conceptKey),
      'EXCLUDED_FAMILY_OWNERSHIP',
      `representations-qualifiers.config.js's mirrored EXCLUDED_CONCEPTS entry "${conceptKey}" is not excluded by the real ` +
      'representations-product-projection.js -- the mirror has drifted from its source of truth',
    );
  }

  // Negative control: the probe mechanism itself discriminates on concept
  // identity, rather than always throwing regardless of input -- a genuine
  // Representations concept must NOT trip EXCLUDED_FAMILY_OWNERSHIP (it still
  // fails, but for an unrelated reason: this synthetic entry has no claim
  // body at all).
  assert.equal(probeErrorCode('REP-T-CAPITALIZATION'), 'INVALID_GOVERNED_CLAIM');
});

// =============================================================================
// Legacy byte-identity: neither fix may change behaviour for a card that
// genuinely belongs to the config rendering it.
// =============================================================================

test('material-contracts.config.js: a reviewDeal with no dark/evidence cards at all still produces zero evidence-only rows', () => {
  const rows = materialContractsConfig.selectRows(disabledResult);
  assert.ok(
    rows.every((row) => row.threshold !== 'Evidence only'),
    'none of the shared live fixture cards carry canonical_v2_lineage, so evidenceOnlyRows() must still find nothing to do',
  );
});

test('representations-qualifiers.config.js: a genuinely-owned live rep card is completely unaffected by the EXCLUDED_CONCEPTS fix', () => {
  const rows = representationsQualifiersConfig.selectRows(disabledResult);
  const capitalizationRow = rows.find((row) => row.kind === 'rep' && rowSourceCard(row)?.id === 'live-rep-t-capitalization');
  assert.ok(capitalizationRow, 'REP-T-CAPITALIZATION is not in EXCLUDED_CONCEPTS -- its row must render exactly as before this fix');
  assert.equal(capitalizationRow.label, 'Capitalization');
});

// This is the one case legacy output is NOT byte-identical before and after
// this fix, and deliberately so. live-material-contracts-rep (provision_
// subtype REP-T-MATERIAL-CONTRACTS) is part of this suite's own shared
// liveFixtureCards() -- a fully live, non-dark, non-preview card -- and
// before this fix it ALSO satisfied isPartyRepresentationCard(card, 'REP-T-')
// (provision_type REPRESENTATION, code starts with 'REP-T-', no exclusion
// existed), so it already rendered a second, qualifier-less "Material
// Contracts" row inside the Representations & Warranties -- Company table on
// every deal where Material Contracts extracts as its own REP-T-MATERIAL-
// CONTRACTS card (material-contracts.config.js's own "FIX 1" comment cites a
// real example of that shape: QXO/TopBuild Section 3.1(p)). That is the exact
// same domain-boundary defect this task describes for the dark No Other Reps
// / Fraud card, just reachable without any Canonical V2 preview machinery at
// all -- confirming the brief's own note that this is a real, pre-existing
// defect in the live config, not something the preview introduced.
// =============================================================================
// Silent-failure fix, render half: when the canonical path throws with the
// gate OPEN, the real review page must still render exactly as it does with
// the gate off -- that is why the catch exists and it stays true. What
// changes is that the failure is no longer invisible: the served deal says
// the preview is off, and the outcome record says why. Rendered through the
// real ProvisionTable and the real configs, same as every other proof here.
// =============================================================================

test('canonical path throws with the gate OPEN: the outcome is FAILED, and the served deal is the legacy deal, not a partial merge', () => {
  assert.equal(failedOutcome.state, CANONICAL_V2_PREVIEW_STATE.FAILED);
  assert.equal(failedOutcome.gate.enabled, true, 'the gate was open: this is a failure, not a refusal');
  assert.equal(failedOutcome.failure.phase, 'MATERIAL_CONTRACTS');
  assert.equal(failedOutcome.attached_card_count, 0);

  assert.equal(failedResult.cardCount, failedInputDeal.cardCount);
  assert.deepEqual(
    failedResult.cards.map((card) => card.id).sort(),
    failedInputDeal.cards.map((card) => card.id).sort(),
    'a failed preview must serve exactly the legacy cards, no dark card from an earlier family',
  );
  assert.equal(
    failedResult.cards.some((card) => card.authority_state === 'VALIDATED_NOT_SERVED'),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(failedResult, 'canonical_v2_bridge_receipts'),
    false,
    'a failed preview must leave no bridge receipt behind',
  );

  // The distinguishing bit: a clean gate-off no-op carries no flag at all; a
  // failure carries an explicit false plus the reason. A comparison harness
  // that saw only the deal can now tell these apart.
  assert.equal(Object.prototype.hasOwnProperty.call(disabledResult, 'canonical_v2_preview_enabled'), false);
  assert.equal(failedResult.canonical_v2_preview_enabled, false);
  assert.equal(failedResult.canonical_v2_preview_status.state, CANONICAL_V2_PREVIEW_STATE.FAILED);
});

for (const area of AREAS) {
  const { config } = area;
  test(`${config.id}: the review page survives a canonical throw -- renders no lane, no preview row, and legacy rows byte-identical to the gate-off render`, () => {
    const failedRows = config.selectRows(failedResult);
    const { previewRows } = partitionCanonicalV2PreviewRows(failedRows);
    assert.equal(previewRows.length, 0, `${config.id}: a failed preview must produce no preview row`);
    assert.deepEqual(
      withoutUndefinedKeys(failedRows),
      withoutUndefinedKeys(config.selectRows(disabledResult)),
      `${config.id}: a failed preview must leave the legacy rows exactly as the gate-off render has them`,
    );

    const html = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: failedResult, isEdit: false }),
    );
    assert.doesNotMatch(
      html,
      new RegExp(`data-testid="provision-table-preview-lane-${config.id}"`),
      `${config.id}: a failed preview must render no lane`,
    );
    assert.doesNotMatch(html, PREVIEW_SUFFIX_RE, `${config.id}: a failed preview must render no preview-suffixed row`);
    assert.equal(
      html,
      renderToStaticMarkup(React.createElement(ProvisionTable, { config, reviewDeal: disabledResult, isEdit: false })),
      `${config.id}: the page a reviewer sees after a canonical throw must be identical to the gate-off page`,
    );
  });
}

test('representations-qualifiers.config.js: a live Material Contracts rep card no longer leaks into the Representations lane (pre-existing defect, not preview-only)', () => {
  const rows = representationsQualifiersConfig.selectRows(disabledResult);
  assert.ok(
    rows.every((row) => rowSourceCard(row)?.id !== 'live-material-contracts-rep'),
    'a card owned by Material Contracts must never render inside the Representations table, dark or live',
  );
});
