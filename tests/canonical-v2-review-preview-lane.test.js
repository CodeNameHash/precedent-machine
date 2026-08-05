'use strict';

// Proves Ben's ruling: ONE shared, read-only, default-collapsed "Canonical
// V2 Preview" lane for all four areas (material-contracts, general-
// covenants, no-other-reps-fraud, representations-qualifiers), replacing
// today's four bespoke "append a dark row inline, suffix its own label"
// implementations. See components/review/table-configs/canonical-v2-
// preview-lane.js (the shared mechanism) and components/review/
// ProvisionTable.jsx (the render-time wiring).
//
// Deliberately does NOT re-derive dark rows through the full native-
// extraction pipeline the way tests/canonical-v2-legacy-card-bridge.test.js
// / tests/canonical-v2-general-covenants-dark-bridge.test.js / tests/
// canonical-v2-no-other-reps-fraud-dark-bridge.test.js / tests/canonical-v2-
// representations-dark-bridge.test.js do -- that pipeline's correctness is
// already exhaustively covered by those four pinned suites, which this task
// must not disturb. This suite instead hand-crafts minimal, directly-
// verified card shapes (mirroring the "hand-spliced dark card" pattern
// already used inside tests/canonical-v2-representations-dark-bridge.test.js)
// so it can focus on what's actually new here: the shared lane.

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const { shapeReviewDealRows } = require('../lib/queries/review-deal');

// -- preview-flag helper -----------------------------------------------------
// The gate is now an explicit, server-stamped boolean on the reviewDeal
// payload (canonical_v2_preview_enabled), never process.env -- see
// components/review/table-configs/canonical-v2-preview-lane.js's
// isCanonicalV2PreviewEnabled(). withPreviewEnabled() replaces the withEnv
// helper this file used to gate the render layer with (tests/canonical-v2-
// general-covenants-dark-bridge.test.js and tests/canonical-v2-no-other-
// reps-fraud-dark-bridge.test.js still use withEnv, but only for the
// separate, unchanged BRIDGE-level env gate -- not this one): a shallow copy
// of a reviewDeal with the flag set, so a test can turn the preview on for
// exactly one selectRows()/render call without mutating the deal object
// other assertions still read.

function withPreviewEnabled(reviewDeal) {
  return { ...reviewDeal, canonical_v2_preview_enabled: true };
}

// -- ESM/JSX loader (mirrors the loadEsmModule helper already used by all
// four existing dark-bridge suites) --------------------------------------

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

const previewLaneMod = loadEsmModule('../components/review/table-configs/canonical-v2-preview-lane.js');
const {
  CANONICAL_V2_PREVIEW_LANE_LABEL,
  DARK_PREVIEW_MARKET_STATE,
  buildCanonicalV2PreviewLane,
  isCanonicalV2PreviewEnabled,
  isCanonicalV2PreviewRow,
  partitionCanonicalV2PreviewRows,
} = previewLaneMod;

const { enumerateMarketSectionRows } = loadEsmModule('../lib/market-metrics/section-rows.js');
const { safeRows } = loadEsmModule('../components/review-v2/CompareColumn.jsx');
const primitivesMod = loadEsmModule('../components/review/primitives/ProvisionTablePrimitives.jsx');

const DEAL_ID = 'preview-lane-fixture-deal';

// -- per-area fixtures: one live card the legacy table already renders
// today, one dark card (authority_state VALIDATED_NOT_SERVED) each config's
// own, UNCHANGED selection logic recognises as a Canonical V2 preview
// source. Every field used here was verified directly against each config
// file's own selectRows()/isDarkV2Card()-equivalent logic, and against
// lib/canonical-v2/p0-product-surface-routing.js (general-covenants' code
// router never throws on an unrecognised code, so any COV- code is safe). --

function materialContractsCards() {
  const live = {
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
  };
  const dark = {
    ...live,
    id: 'dark-material-contracts-rep',
    provision_instance_id: 'dark-material-contracts-rep',
    excerpt_id: 'dark-material-contracts-rep:0',
    primary_quote: 'Section 3.13 lists each Contract involving Indebtedness in excess of $100,000.',
    region_full_text: 'Section 3.13 lists each Contract involving Indebtedness in excess of $100,000.',
    features: {
      materialContractsBuckets: [{
        code: 'INDEBTEDNESS',
        label: 'Indebtedness',
        quotes: ['each Contract involving Indebtedness in excess of $100,000'],
        threshold: '$100,000',
      }],
    },
    authority_state: 'VALIDATED_NOT_SERVED',
    source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
  };
  return { live, dark };
}

function generalCovenantsCards() {
  const live = {
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
  };
  const dark = {
    id: 'dark-general-covenant-access',
    deal_id: DEAL_ID,
    provision_instance_id: 'dark-general-covenant-access',
    excerpt_id: 'dark-general-covenant-access:0',
    section_ref: '6.02',
    short_title: 'Access to Information',
    kind: 'standard',
    type: 'COVENANT_OTHER',
    provision_type: 'COVENANT_OTHER',
    provision_subtype: 'COV-ACCESS',
    primary_quote: 'The Company shall afford Parent reasonable access to its books, records and personnel.',
    region_full_text: 'The Company shall afford Parent reasonable access to its books, records and personnel.',
    features: {},
    ai_metadata: {},
    authority_state: 'VALIDATED_NOT_SERVED',
    source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
  };
  return { live, dark };
}

function noOtherRepsFraudCards() {
  // hasAbrySignal() finds nothing in this Notices clause, so it never
  // becomes a live row -- matching the shape of the existing pinned fixture
  // (tests/fixtures/canonical-v2/dark-bridge/no-other-reps-fraud-dark-
  // review.json), whose own legacy_cards ALSO carry no ABRY signal (a
  // Parent MAE definition and a Notices clause). "Legacy rows unchanged" is
  // proven on the correctly-empty baseline this config already produces for
  // a deal with no No Other Reps / Fraud content.
  const live = {
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
  };
  const dark = {
    id: 'dark-no-other-reps-fraud-fraud',
    deal_id: DEAL_ID,
    provision_instance_id: 'dark-no-other-reps-fraud-fraud',
    excerpt_id: 'dark-no-other-reps-fraud-fraud:0',
    section_ref: '9.07',
    short_title: 'Fraud carve-out',
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-B-FRAUDCARVEOUT',
    primary_quote: 'Nothing in this Section 9.07 shall limit or otherwise affect the liability of either party for Fraud.',
    region_full_text: 'Nothing in this Section 9.07 shall limit or otherwise affect the liability of either party for Fraud.',
    claim_definition_key: 'FRAUD_CARVEOUT_PRESENT',
    features: {},
    ai_metadata: {},
    authority_state: 'VALIDATED_NOT_SERVED',
    source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
  };
  return { live, dark };
}

function representationsCards() {
  const live = {
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
  };
  const dark = {
    id: 'dark-rep-t-organization',
    deal_id: DEAL_ID,
    provision_instance_id: 'dark-rep-t-organization',
    excerpt_id: 'dark-rep-t-organization:0',
    section_ref: '3.1',
    short_title: 'Organization; Qualification; Standing',
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-ORGANIZATION',
    primary_quote: 'The Company is a corporation duly organized, validly existing and in good standing.',
    region_full_text: 'The Company is a corporation duly organized, validly existing and in good standing.',
    features: { materialityQualifier: { code: 'MAT_ALL_RESPECTS', text: 'The Company is a corporation duly organized, validly existing and in good standing.' } },
    ai_metadata: { features: { materialityQualifier: { code: 'MAT_ALL_RESPECTS', text: 'The Company is a corporation duly organized, validly existing and in good standing.' } } },
    authority_state: 'VALIDATED_NOT_SERVED',
    source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
  };
  return { live, dark };
}

// All four areas now share ONE gate -- isCanonicalV2PreviewEnabled(reviewDeal)
// (canonical-v2-preview-lane.js), read off an explicit
// canonical_v2_preview_enabled boolean the SERVER stamps onto the reviewDeal
// payload, never process.env. pages/review-v1/[id].js is a client component
// (no getServerSideProps, uses useState/useEffect), so a browser-side
// process.env read could never see CANONICAL_V2_DARK_BRIDGE in the first
// place (it is deliberately not a NEXT_PUBLIC_ variable -- see lib/
// canonical-v2/dark-bridge-gate.js) -- the old per-config env reads were
// permanently false client-side, so the lane could never actually render for
// a real reviewer. material-contracts.config.js previously had NO gate at
// all here -- it imported no dark-bridge-gate module, and its dark rows
// rendered unconditionally the instant a dark card reached reviewDeal.cards
// (see the standalone "material-contracts.config.js now honours the flag"
// test below, and the equivalent fix in tests/canonical-v2-legacy-card-
// bridge.test.js) -- closed by this task so all four configs behave
// uniformly, which is why every area below runs through the identical
// assertions rather than branching on a per-area flag.
const AREAS = [
  {
    name: 'material-contracts',
    configPath: '../components/review/table-configs/material-contracts.config.js',
    configExport: 'materialContractsConfig',
    cards: materialContractsCards,
  },
  {
    name: 'general-covenants',
    configPath: '../components/review/table-configs/general-covenants.config.js',
    configExport: 'generalCovenantsConfig',
    cards: generalCovenantsCards,
  },
  {
    name: 'no-other-reps-fraud',
    configPath: '../components/review/table-configs/no-other-reps-fraud.config.js',
    configExport: 'noOtherRepsFraudConfig',
    cards: noOtherRepsFraudCards,
  },
  {
    name: 'representations-qualifiers',
    configPath: '../components/review/table-configs/representations-qualifiers.config.js',
    configExport: 'representationsQualifiersConfig',
    cards: representationsCards,
  },
];

function loadAreaConfig(area) {
  const configModule = loadEsmModule(area.configPath);
  return configModule[area.configExport];
}

function buildDeals(area) {
  const { live, dark } = area.cards();
  const legacyDeal = shapeReviewDealRows(DEAL_ID, [structuredClone(live)], { claims: [] });
  const merged = shapeReviewDealRows(DEAL_ID, [structuredClone(live), structuredClone(dark)], { claims: [] });
  return { legacyDeal, merged };
}

// =============================================================================
// 1. The partition rule itself, in isolation -- no config, no reviewDeal.
// =============================================================================

test('partitionCanonicalV2PreviewRows / isCanonicalV2PreviewRow split purely on the shared marketState constant, preserve order, and never mutate', () => {
  assert.equal(CANONICAL_V2_PREVIEW_LANE_LABEL, 'Canonical V2 Preview');
  assert.equal(DARK_PREVIEW_MARKET_STATE, 'DARK_REVIEW_ONLY');

  const rows = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', marketState: DARK_PREVIEW_MARKET_STATE, marketSkip: true },
    { id: 'c', label: 'C', marketState: 'OPEN_NATIVE_FIELD' },
    { id: 'd', label: 'D', marketState: DARK_PREVIEW_MARKET_STATE, marketSkip: true },
  ];
  const snapshot = structuredClone(rows);

  assert.equal(isCanonicalV2PreviewRow(rows[0]), false);
  assert.equal(isCanonicalV2PreviewRow(rows[1]), true);
  assert.equal(isCanonicalV2PreviewRow(rows[2]), false);
  assert.equal(isCanonicalV2PreviewRow(null), false);
  assert.equal(isCanonicalV2PreviewRow(undefined), false);

  const { legacyRows, previewRows } = partitionCanonicalV2PreviewRows(rows);
  assert.deepEqual(legacyRows, [rows[0], rows[2]]);
  assert.deepEqual(previewRows, [rows[1], rows[3]]);
  assert.deepEqual(rows, snapshot, 'partitioning must never mutate the input rows');

  assert.deepEqual(partitionCanonicalV2PreviewRows(null), { legacyRows: [], previewRows: [] });
  assert.deepEqual(partitionCanonicalV2PreviewRows(undefined), { legacyRows: [], previewRows: [] });
  assert.equal(buildCanonicalV2PreviewLane([], [], {}), null, 'an empty preview-row list must render no lane at all');
});

// =============================================================================
// 2 & 3. Per-area: gate off is a no-op; gate on produces exactly one lane
//        without disturbing the legacy rows.
// =============================================================================

for (const area of AREAS) {
  test(`${area.name}: flag absent -- no lane, and rows are identical to today whether or not a dark card is present`, () => {
    const config = loadAreaConfig(area);
    const { legacyDeal, merged } = buildDeals(area);

    const before = config.selectRows(legacyDeal);

    // Defense in depth, uniform across all four areas: a dark card already
    // physically present in reviewDeal.cards, but with no
    // canonical_v2_preview_enabled flag, must be byte-identical to a
    // reviewDeal that never saw a dark card at all -- not merely "no lane",
    // but no trace of the dark card anywhere in the row output.
    const afterMergedFlagAbsent = config.selectRows(merged);
    assert.deepEqual(afterMergedFlagAbsent, before, 'flag-absent output must be byte-identical whether or not a dark card is present');
    const { legacyRows, previewRows } = partitionCanonicalV2PreviewRows(afterMergedFlagAbsent);
    assert.deepEqual(legacyRows, afterMergedFlagAbsent);
    assert.equal(previewRows.length, 0);
    assert.equal(
      buildCanonicalV2PreviewLane(previewRows, config.columns, { reviewDeal: merged, config }),
      null,
      'flag absent must render no lane',
    );
  });

  test(`${area.name}: flag true -- exactly one lane labelled "Canonical V2 Preview", default-collapsed, legacy rows unchanged`, () => {
    const config = loadAreaConfig(area);
    const { legacyDeal, merged } = buildDeals(area);
    const mergedWithPreview = withPreviewEnabled(merged);

    const baseline = config.selectRows(legacyDeal);
    const gateOnRows = config.selectRows(mergedWithPreview);
    const { legacyRows, previewRows } = partitionCanonicalV2PreviewRows(gateOnRows);

    assert.deepEqual(legacyRows, baseline, 'legacy rows must be byte-identical with the lane present versus absent');
    assert.ok(previewRows.length > 0, 'fixture must actually produce a preview row to test against');

    for (const row of previewRows) {
      assert.equal(row.marketSkip, true);
      assert.equal(row.marketState, DARK_PREVIEW_MARKET_STATE);
      assert.equal(row.comparisonState, 'NOT_ADMITTED');
      assert.equal(row.authorityState, 'VALIDATED_NOT_SERVED');
    }

    const lane = buildCanonicalV2PreviewLane(previewRows, config.columns, {
      reviewDeal: mergedWithPreview,
      config,
      primitives: primitivesMod,
    }, { testId: `test-lane-${area.name}` });

    assert.ok(lane, 'flag true with a dark card present must render exactly one lane');
    assert.equal(lane.type, 'details');
    assert.equal(lane.props.open, false, 'the lane must be default-collapsed');

    const [summary, rowsContainer] = lane.props.children;
    assert.equal(summary.type, 'summary');
    const [labelSpan] = summary.props.children;
    assert.equal(labelSpan.props.children, 'Canonical V2 Preview');
    assert.equal(Array.isArray(rowsContainer.props.children) ? rowsContainer.props.children.length : 1, previewRows.length);

    const html = renderToStaticMarkup(lane);
    assert.match(html, /Canonical V2 Preview/);
    assert.doesNotMatch(html, /<input|<textarea|<select|<button|<form/i);

    // Excluded from the covered/coverage count and dropped by both the
    // shared market-coverage enumerator and compare mode's safeRows -- both
    // operate on config.selectRows()'s FULL (unpartitioned) output, exactly
    // as the live app does.
    const section = { id: area.name, config };
    const enumerated = enumerateMarketSectionRows(section, mergedWithPreview);
    assert.equal(
      enumerated.some(({ row }) => isCanonicalV2PreviewRow(row)),
      false,
      'enumerateMarketSectionRows must drop every preview row',
    );
    const safe = safeRows(config, mergedWithPreview);
    assert.equal(safe.some((row) => isCanonicalV2PreviewRow(row)), false, 'CompareColumn.safeRows must drop every preview row');
  });
}

// =============================================================================
// 4. Read-only, structurally -- no mutation affordance anywhere in the lane,
//    even when handed a fully "hot" (interactive) rendering context.
// =============================================================================

const FORBIDDEN_TAG_RE = /^(input|textarea|select|form)$/i;
const FORBIDDEN_PROP_RE = /^on(Change|Submit|Input|Save|Edit|Delete|Mutate|SelectCard|SelectCanonicalBinding)$/;

function assertNoMutationAffordance(node, label) {
  if (node === null || node === undefined) return;
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) assertNoMutationAffordance(child, label);
    return;
  }
  if (typeof node !== 'object' || !('type' in node)) return;
  if (typeof node.type === 'string') {
    assert.equal(FORBIDDEN_TAG_RE.test(node.type), false, `${label}: lane must not render a <${node.type}> element`);
  }
  const props = node.props || {};
  for (const key of Object.keys(props)) {
    assert.equal(FORBIDDEN_PROP_RE.test(key), false, `${label}: lane must not carry a "${key}" prop anywhere in its tree`);
  }
  assertNoMutationAffordance(props.children, label);
}

test('the lane exposes no mutation affordance, even when handed a fully interactive ctx', () => {
  for (const area of AREAS) {
    const config = loadAreaConfig(area);
    const { merged } = buildDeals(area);
    const mergedWithPreview = withPreviewEnabled(merged);
    const gateOnRows = config.selectRows(mergedWithPreview);
    const { previewRows } = partitionCanonicalV2PreviewRows(gateOnRows);
    assert.ok(previewRows.length > 0, `${area.name}: fixture must produce a preview row to test against`);

    const hotCtx = {
      reviewDeal: mergedWithPreview,
      config,
      primitives: primitivesMod,
      isEdit: true,
      onSelectCard: () => { throw new Error(`${area.name}: onSelectCard must never be reachable from inside the lane`); },
      onSelectCanonicalBinding: () => { throw new Error(`${area.name}: onSelectCanonicalBinding must never be reachable from inside the lane`); },
      canonicalBindingForRow: () => ({ binding_key: 'should-never-be-reachable' }),
      selectedCardId: 'some-card-id',
      selectedCanonicalBindingKey: 'some-binding-key',
      SeeProvisionToggle: () => { throw new Error(`${area.name}: SeeProvisionToggle must never render inside the lane`); },
      ExpansionRow: () => { throw new Error(`${area.name}: ExpansionRow must never render inside the lane`); },
      expandedRowId: previewRows[0].id,
      setExpandedRowId: () => { throw new Error(`${area.name}: setExpandedRowId must never be reachable from inside the lane`); },
    };

    const lane = buildCanonicalV2PreviewLane(previewRows, config.columns, hotCtx, { testId: `hot-lane-${area.name}` });
    assert.ok(lane);
    assertNoMutationAffordance(lane, area.name);
    // Proves those handlers are never wired up (not merely untested): if
    // any were reachable, rendering would throw.
    assert.doesNotThrow(() => renderToStaticMarkup(lane), `${area.name}: rendering the lane must never invoke a mutation handler`);
  }
});

// =============================================================================
// 5. End-to-end through the real ProvisionTable component: exactly one lane
//    renders per section, and the dark row never ALSO renders inline in the
//    legacy table body -- covering both of ProvisionTable's render paths
//    (the generic columns loop for material-contracts/general-covenants/
//    no-other-reps-fraud, and the custom renderBody path for
//    representations-qualifiers).
// =============================================================================

test('ProvisionTable renders exactly one Canonical V2 Preview lane per area, and never duplicates a preview row inside the legacy table body', () => {
  const { default: ProvisionTable } = loadEsmModule('../components/review/ProvisionTable.jsx');

  for (const area of AREAS) {
    const config = loadAreaConfig(area);
    const { merged } = buildDeals(area);
    const mergedWithPreview = withPreviewEnabled(merged);

    const html = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: mergedWithPreview, isEdit: false }),
    );

    const laneTestId = `provision-table-preview-lane-${area.name}`;
    const laneMatches = html.match(new RegExp(`data-testid="${laneTestId}"`, 'g')) || [];
    assert.equal(laneMatches.length, 1, `${area.name}: exactly one lane must render`);

    const laneStartIndex = html.indexOf(`data-testid="${laneTestId}"`);
    assert.ok(laneStartIndex > -1, `${area.name}: the lane must be present in the rendered output`);
    const beforeLane = html.slice(0, laneStartIndex);
    const fromLaneOnward = html.slice(laneStartIndex);

    // The dark row's distinguishing "(Canonical V2 preview)" text (every
    // config's own dark-row builder stamps this suffix -- unchanged by this
    // task) must appear ONLY inside the lane, proving it moved out of the
    // legacy table rather than being merely labelled in place beside it.
    assert.doesNotMatch(
      beforeLane,
      /\(Canonical V2 preview\)/,
      `${area.name}: the dark row must not render inline in the legacy table body`,
    );
    assert.match(
      fromLaneOnward,
      /\(Canonical V2 preview\)/,
      `${area.name}: the dark row must render inside the lane`,
    );
    assert.match(fromLaneOnward, /Canonical V2 Preview/, `${area.name}: the lane's exact label must render`);

    // <details> with no "open" attribute renders collapsed by default.
    // data-testid is just one attribute among several on the tag (attribute
    // order isn't guaranteed), so search the whole opening tag for it
    // rather than assuming it's the first thing after "<details".
    const detailsTagMatch = html.match(new RegExp(`<details[^>]*data-testid="${laneTestId}"[^>]*>`));
    assert.ok(detailsTagMatch, `${area.name}: the lane must be a <details> element`);
    assert.doesNotMatch(detailsTagMatch[0], /\bopen\b/, `${area.name}: the lane must be default-collapsed`);

    // A flag-absent render must show no lane at all -- defense in depth,
    // uniform across all four areas now: the SAME merged reviewDeal (dark
    // card already physically present in .cards), just without
    // canonical_v2_preview_enabled set, independent of whatever merged the
    // dark card in.
    const gateOffHtml = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: merged, isEdit: false }),
    );
    assert.doesNotMatch(gateOffHtml, new RegExp(`data-testid="${laneTestId}"`));
    assert.doesNotMatch(gateOffHtml, /\(Canonical V2 preview\)/);
  }
});

// =============================================================================
// 6. Flag present but no dark cards -- there is nothing to preview, so this
//    must render no lane and never error, for every area.
// =============================================================================

for (const area of AREAS) {
  test(`${area.name}: flag true but no dark cards present -- no lane, no error`, () => {
    const config = loadAreaConfig(area);
    const { legacyDeal } = buildDeals(area);
    const legacyDealWithPreview = withPreviewEnabled(legacyDeal);

    const rows = config.selectRows(legacyDealWithPreview);
    const { legacyRows, previewRows } = partitionCanonicalV2PreviewRows(rows);
    assert.equal(previewRows.length, 0, 'no dark card present, so the flag alone must produce no preview rows');
    assert.deepEqual(legacyRows, rows);

    assert.equal(
      buildCanonicalV2PreviewLane(previewRows, config.columns, { reviewDeal: legacyDealWithPreview, config }),
      null,
      'flag true with no dark cards must render no lane',
    );

    const { default: ProvisionTable } = loadEsmModule('../components/review/ProvisionTable.jsx');
    assert.doesNotThrow(() => renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: legacyDealWithPreview, isEdit: false }),
    ), `${area.name}: rendering with the flag on but no dark cards must never throw`);
    const html = renderToStaticMarkup(
      React.createElement(ProvisionTable, { config, reviewDeal: legacyDealWithPreview, isEdit: false }),
    );
    assert.doesNotMatch(html, /Canonical V2 Preview/, `${area.name}: no dark cards means no lane, even with the flag on`);
  });
}

// =============================================================================
// 7. Spoof resistance -- isCanonicalV2PreviewEnabled must treat anything
//    other than an OWN, strict boolean `true` as false. Proven directly
//    against the accessor (unit-level) and through every area's full
//    selectRows()/lane pipeline (integration-level), so a hostile or
//    malformed reviewDeal payload can never coerce its way into the lane.
// =============================================================================

test('isCanonicalV2PreviewEnabled treats anything other than an own, strict boolean true as false', () => {
  assert.equal(isCanonicalV2PreviewEnabled(undefined), false);
  assert.equal(isCanonicalV2PreviewEnabled(null), false);
  assert.equal(isCanonicalV2PreviewEnabled('reviewDeal'), false);
  assert.equal(isCanonicalV2PreviewEnabled(42), false);
  assert.equal(isCanonicalV2PreviewEnabled(true), false);
  assert.equal(isCanonicalV2PreviewEnabled([]), false);
  assert.equal(isCanonicalV2PreviewEnabled({}), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: undefined }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: false }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: 'true' }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: 1 }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: {} }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: [true] }), false);
  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: null }), false);

  const proto = { canonical_v2_preview_enabled: true };
  const prototypeOnly = Object.create(proto);
  assert.equal(prototypeOnly.canonical_v2_preview_enabled, true, 'sanity: the value really is reachable via the prototype chain');
  assert.equal(isCanonicalV2PreviewEnabled(prototypeOnly), false, 'a prototype-only value must never enable the preview');

  assert.equal(isCanonicalV2PreviewEnabled({ canonical_v2_preview_enabled: true }), true);
});

for (const area of AREAS) {
  test(`${area.name}: spoofed preview flags ('true' string, 1, {}, prototype-only) never surface a preview row`, () => {
    const config = loadAreaConfig(area);
    const { merged } = buildDeals(area);

    for (const spoofed of ['true', 1, {}, [true], null]) {
      const spoofedDeal = { ...merged, canonical_v2_preview_enabled: spoofed };
      const rows = config.selectRows(spoofedDeal);
      const { previewRows } = partitionCanonicalV2PreviewRows(rows);
      assert.equal(previewRows.length, 0, `${area.name}: canonical_v2_preview_enabled: ${JSON.stringify(spoofed)} must not enable the preview`);
    }

    // Present only on the prototype, never as the reviewDeal's own property.
    const prototypeOnlyDeal = Object.create({ ...merged, canonical_v2_preview_enabled: true });
    assert.equal(prototypeOnlyDeal.canonical_v2_preview_enabled, true, 'sanity: still reachable via the prototype chain');
    const prototypeRows = config.selectRows(prototypeOnlyDeal);
    const { previewRows: prototypePreviewRows } = partitionCanonicalV2PreviewRows(prototypeRows);
    assert.equal(prototypePreviewRows.length, 0, `${area.name}: a prototype-only flag must not enable the preview`);
  });
}

// =============================================================================
// 8. material-contracts.config.js specifically: verified (see the AREAS
//    doc comment above) to have had NO gate at all before this task -- it
//    imported no dark-bridge-gate module, and a dark card rendered the
//    instant it reached reviewDeal.cards. Called out explicitly, on top of
//    its now-uniform coverage in every numbered section above, because
//    closing that gap is this task's second defect fix.
// =============================================================================

test('material-contracts.config.js now honours canonical_v2_preview_enabled -- it previously had no gate at all', () => {
  const area = AREAS.find((candidate) => candidate.name === 'material-contracts');
  assert.ok(area, 'material-contracts must be one of the covered areas');
  const config = loadAreaConfig(area);
  const { merged } = buildDeals(area);

  const flagAbsentRows = config.selectRows(merged);
  assert.equal(
    partitionCanonicalV2PreviewRows(flagAbsentRows).previewRows.length,
    0,
    'material-contracts: a dark card physically present in reviewDeal.cards must not render a preview row without the flag',
  );

  const flagPresentRows = config.selectRows(withPreviewEnabled(merged));
  const { previewRows: flagPresentPreviewRows } = partitionCanonicalV2PreviewRows(flagPresentRows);
  assert.ok(
    flagPresentPreviewRows.length > 0,
    'material-contracts: the SAME dark card must render a preview row once the flag is set',
  );
  for (const row of flagPresentPreviewRows) {
    assert.equal(row.marketSkip, true);
    assert.equal(row.marketState, DARK_PREVIEW_MARKET_STATE);
    assert.equal(row.comparisonState, 'NOT_ADMITTED');
    assert.equal(row.authorityState, 'VALIDATED_NOT_SERVED');
  }
});
