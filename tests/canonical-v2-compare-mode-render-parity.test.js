'use strict';

// Compare-mode render parity: an audit found components/review-v2/
// CompareColumn.jsx's UnifiedCompareSection (the ?compare=<dealId> unified
// table pages/review/[id].js renders per section) silently dropped two
// things ProvisionTable.jsx provides in single-deal mode:
//
//   Bug 1: config.renderFooter (conditions.config.js, material-contracts.
//   config.js) was never called -- the "N of M present" coverage strip
//   disappeared from the PRIMARY deal's own column too, not only compared
//   ones, the instant a review page entered compare mode.
//
//   Bug 2: the two configs with a custom config.renderBody (mae-
//   definitions, representations-qualifiers) lost that structure -- MAE's
//   party-split test/carve-out tables collapsed to one flat table with
//   un-stripped "Company: MAE Test" labels, and representations' General
//   Exceptions / Knowledge blocks (and the per-rep bring-down pill) simply
//   rendered a bare "-" in every deal's column.
//
// See CompareColumn.jsx's own comments directly ahead of
// generalExceptionsAnswerPairs()/withMaeSideDividers() (both inside
// UnifiedCompareSection) for the full investigation and the (a)/(b)/(c)
// call this suite pins: both families landed on (b) -- a compare-mode-
// specific presentation that preserves the underlying facts and their
// grouping without reusing renderBody verbatim (renderBody's own private
// table-builders assume one deal/one table and have no per-deal-answer-
// column concept; MAE's renderBody is not even reachable in production --
// pages/review/[id].js routes MAE_SECTION_ID straight to <MaeSection>).

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// -- ESM/JSX loader -- copied verbatim from tests/canonical-v2-review-
// preview-lane.test.js / tests/canonical-v2-review-preview-end-to-end.
// test.js ("the loadEsmModule helper already used by all four existing
// dark-bridge suites"). Reused exactly rather than inventing a second one.
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

const { default: ProvisionTable } = loadEsmModule('../components/review/ProvisionTable.jsx');
const { UnifiedCompareSection } = loadEsmModule('../components/review-v2/CompareColumn.jsx');
const { conditionsConfig } = loadEsmModule('../components/review/table-configs/conditions.config.js');
const { materialContractsConfig } = loadEsmModule('../components/review/table-configs/material-contracts.config.js');
const { maeDefinitionsConfig } = loadEsmModule('../components/review/table-configs/mae-definitions.config.js');
const { representationsQualifiersConfig } = loadEsmModule('../components/review/table-configs/representations-qualifiers.config.js');

// -- render + extraction helpers -----------------------------------------

function html(element) {
  return renderToStaticMarkup(element);
}

function compareSection(configId, config, primaryReviewDeal, comparedColumns = [], primaryName = 'Deal A') {
  return React.createElement(UnifiedCompareSection, {
    section: { id: configId, config },
    primaryName,
    primaryReviewDeal,
    comparedColumns,
  });
}

// Pulls "N of M <label>" out of the html following a given data-testid --
// CoverageFooter's own markup (<span ...>N of M label</span>) always sits
// within a small window after its wrapper's opening tag.
function footerCounts(markup, testId) {
  const marker = `data-testid="${testId}"`;
  const start = markup.indexOf(marker);
  if (start === -1) return null;
  const window = markup.slice(start, start + 6000);
  const match = window.match(/(\d+) of (\d+) ([^<]+)</);
  return match ? { present: Number(match[1]), total: Number(match[2]), label: match[3].trim() } : null;
}

// ==========================================================================
// Bug 1: coverage footer -- material-contracts.config.js (dark-row angle)
// ==========================================================================

function materialContractsLiveCard(overrides = {}) {
  return {
    id: 'live-mc',
    provision_instance_id: 'live-mc',
    section_ref: '3.13',
    short_title: 'Material Contracts',
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
    primary_quote: 'Section 3.13 lists each Contract involving a joint venture or partnership arrangement.',
    features: {
      materialContractsBuckets: [{
        code: 'JV_PARTNERSHIPS',
        label: 'Joint ventures / partnerships',
        quotes: ['each Contract involving a joint venture or partnership arrangement'],
      }],
    },
    ...overrides,
  };
}

// Same fixture SHAPE as tests/canonical-v2-review-preview-lane.test.js's
// own proven materialContractsCards() dark card -- authority_state
// VALIDATED_NOT_SERVED is what material-contracts.config.js's darkPreviewRows
// stamps comparisonState 'NOT_ADMITTED' / marketState 'DARK_REVIEW_ONLY' off
// of, which is exactly the flag combination the footer must exclude.
function materialContractsDarkCard() {
  return {
    ...materialContractsLiveCard(),
    id: 'dark-mc',
    provision_instance_id: 'dark-mc',
    primary_quote: 'Section 3.13 lists each Contract involving Indebtedness in excess of $100,000.',
    features: {
      materialContractsBuckets: [{
        code: 'INDEBTEDNESS',
        label: 'Indebtedness',
        quotes: ['each Contract involving Indebtedness in excess of $100,000'],
        threshold: '$100,000',
      }],
    },
    authority_state: 'VALIDATED_NOT_SERVED',
  };
}

test('bug 1 / material-contracts: compare-mode primary column footer matches single-deal footer exactly', () => {
  const reviewDeal = { cards: [materialContractsLiveCard()] };
  const singleHtml = html(React.createElement(ProvisionTable, { config: materialContractsConfig, reviewDeal, isEdit: false }));
  const compareHtml = html(compareSection('material-contracts', materialContractsConfig, reviewDeal, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: { cards: [] }, loading: false, error: null },
  ]));

  const single = footerCounts(singleHtml, 'provision-table-footer-material-contracts');
  const primary = footerCounts(compareHtml, 'provision-table-footer-unified-material-contracts-primary');

  assert.ok(single, 'single-deal footer must render');
  assert.ok(primary, 'compare-mode primary-column footer must render (this is bug 1 -- it silently did not before)');
  assert.deepEqual(primary, single, 'compare-mode primary column counts must match single-deal mode for the same deal');
  assert.equal(single.present, 1);
  assert.ok(single.total > single.present, 'fixture must exercise a genuine N of M with some absent');
});

test('bug 1 / material-contracts: dark Canonical V2 preview rows stay excluded from the coverage count in BOTH single-deal and compare mode', () => {
  const dealFlagOff = { cards: [materialContractsLiveCard(), materialContractsDarkCard()] };
  const dealFlagOn = { ...dealFlagOff, canonical_v2_preview_enabled: true };

  // The dark row only ever enters config.selectRows()'s output once the
  // flag is on -- confirms the fixture actually exercises a dark row, not
  // an accidentally-absent one.
  assert.equal(materialContractsConfig.selectRows(dealFlagOff).length, 1);
  const rowsFlagOn = materialContractsConfig.selectRows(dealFlagOn);
  assert.equal(rowsFlagOn.length, 2);
  const darkRow = rowsFlagOn.find((row) => row.code === 'INDEBTEDNESS');
  assert.ok(darkRow, 'fixture must produce the dark INDEBTEDNESS row');
  assert.equal(darkRow.authorityState, 'VALIDATED_NOT_SERVED');
  assert.equal(darkRow.marketState, 'DARK_REVIEW_ONLY');
  assert.equal(darkRow.comparisonState, 'NOT_ADMITTED');

  const singleFlagOff = footerCounts(
    html(React.createElement(ProvisionTable, { config: materialContractsConfig, reviewDeal: dealFlagOff, isEdit: false })),
    'provision-table-footer-material-contracts',
  );
  const singleFlagOn = footerCounts(
    html(React.createElement(ProvisionTable, { config: materialContractsConfig, reviewDeal: dealFlagOn, isEdit: false })),
    'provision-table-footer-material-contracts',
  );
  const compareFlagOn = footerCounts(
    html(compareSection('material-contracts', materialContractsConfig, dealFlagOn)),
    'provision-table-footer-unified-material-contracts-primary',
  );

  // The dark row EXISTS (rowsFlagOn.length === 2) but must never count as
  // present -- same coverage number whether or not the preview flag is on,
  // and identical between single-deal and compare mode.
  assert.equal(singleFlagOff.present, 1);
  assert.equal(singleFlagOn.present, 1, 'a dark row present in the row set must not inflate the single-deal coverage count');
  assert.equal(compareFlagOn.present, 1, 'a dark row present in the row set must not inflate the COMPARE-mode coverage count');
  assert.deepEqual(compareFlagOn, singleFlagOn, 'compare mode must match single-deal mode even with a dark row on the deal');
});

test('bug 1 / material-contracts: each compared column gets its OWN footer, not one shared strip', () => {
  const dealA = { cards: [materialContractsLiveCard()] };
  const dealB = {
    cards: [
      materialContractsLiveCard({
        id: 'live-mc-b',
        provision_instance_id: 'live-mc-b',
        features: {
          materialContractsBuckets: [
            { code: 'JV_PARTNERSHIPS', label: 'Joint ventures / partnerships', quotes: ['jv clause'] },
            { code: 'SUPPLY', label: 'Supply agreements', quotes: ['supply clause'] },
          ],
        },
      }),
    ],
  };
  const compareHtml = html(compareSection('material-contracts', materialContractsConfig, dealA, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: dealB, loading: false, error: null },
  ]));

  const primary = footerCounts(compareHtml, 'provision-table-footer-unified-material-contracts-primary');
  const compared = footerCounts(compareHtml, 'provision-table-footer-unified-material-contracts-deal-b');
  assert.ok(primary);
  assert.ok(compared);
  assert.equal(primary.present, 1);
  assert.equal(compared.present, 2, "deal B's own footer must reflect deal B's own coverage, not the primary's");
  assert.notDeepEqual(primary, compared);

  // Each footer is captioned with its own deal name -- a shared, unlabelled
  // strip would misdescribe every column but one.
  const primaryIdx = compareHtml.indexOf('data-testid="provision-table-footer-unified-material-contracts-primary"');
  const dealBIdx = compareHtml.indexOf('data-testid="provision-table-footer-unified-material-contracts-deal-b"');
  assert.ok(primaryIdx > -1 && dealBIdx > -1);
  assert.match(compareHtml.slice(primaryIdx, primaryIdx + 200), /Deal A/);
  assert.match(compareHtml.slice(dealBIdx, dealBIdx + 200), /Deal B/);
});

// ==========================================================================
// Bug 1: coverage footer -- conditions.config.js (no dark-row concept; this
// config has no Canonical V2 preview handling at all, confirmed by reading
// conditions.config.js / conditions-m.config.js -- the second proof that
// the fix is config-shape-agnostic, not material-contracts-specific).
// ==========================================================================

function conditionsCard(overrides = {}) {
  return {
    id: overrides.id || 'vote',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: overrides.provision_subtype || 'COND-M-STOCKHOLDER',
    section_ref: overrides.section_ref || 'Section 7.01',
    short_title: overrides.short_title || 'Stockholder Approval',
    primary_quote: overrides.primary_quote || 'The Company Stockholder Approval shall have been obtained.',
    ...overrides,
  };
}

test('bug 1 / conditions: compare-mode primary column footer matches single-deal footer, and a compared column with more present conditions gets its own higher count', () => {
  const dealA = { cards: [conditionsCard()] };
  const dealB = {
    cards: [
      conditionsCard({ id: 'vote-b' }),
      conditionsCard({ id: 'legal-b', provision_subtype: 'COND-M-LEGAL', short_title: 'No Legal Impediment', primary_quote: 'No injunction shall be in effect.' }),
    ],
  };

  const singleA = footerCounts(
    html(React.createElement(ProvisionTable, { config: conditionsConfig, reviewDeal: dealA, isEdit: false })),
    'provision-table-footer-conditions',
  );
  const compareHtml = html(compareSection('conditions', conditionsConfig, dealA, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: dealB, loading: false, error: null },
  ]));
  const primary = footerCounts(compareHtml, 'provision-table-footer-unified-conditions-primary');
  const compared = footerCounts(compareHtml, 'provision-table-footer-unified-conditions-deal-b');

  assert.ok(singleA);
  assert.ok(primary, 'compare-mode primary-column footer must render for conditions too');
  assert.deepEqual(primary, singleA);
  assert.equal(singleA.present, 1);
  assert.equal(compared.present, 2);
  assert.ok(singleA.total > singleA.present);
});

// ==========================================================================
// Bug 2(a): single-deal mode is unchanged -- neither ProvisionTable.jsx,
// MaeSection.jsx, nor any table-config file was touched by this change, so
// true single-deal mode (?compare absent entirely) is unchanged by
// construction; this pins the SAME-fixture, SAME-output contract for the
// two families this task's changes are actually near, and doubles as the
// "unified with zero compared columns" parity check for a config bug 2
// never touches (material-contracts) and one it does (representations).
// ==========================================================================

test('single-deal mode unchanged: material-contracts body + footer are identical whether reached via ProvisionTable or via UnifiedCompareSection with zero compared columns', () => {
  const reviewDeal = { cards: [materialContractsLiveCard()] };
  const singleHtml = html(React.createElement(ProvisionTable, { config: materialContractsConfig, reviewDeal, isEdit: false }));
  const noCompareHtml = html(compareSection('material-contracts', materialContractsConfig, reviewDeal, []));

  // 'evidence' is one of material-contracts.config.js's FULL_TEXT_COLUMNS
  // in BOTH renderers -- the raw quote sits behind a "See provision" click
  // (expandedRowId starts null in both), so it never appears in either
  // renderer's static-rendered initial HTML; only the always-visible pill
  // label and threshold are meaningful to compare here.
  for (const needle of ['Joint ventures / partnerships', '>Any<']) {
    assert.ok(singleHtml.includes(needle), `single-deal html missing ${JSON.stringify(needle)}`);
    assert.ok(noCompareHtml.includes(needle), `zero-compared-columns html missing ${JSON.stringify(needle)}`);
  }
  assert.deepEqual(
    footerCounts(noCompareHtml, 'provision-table-footer-unified-material-contracts-primary'),
    footerCounts(singleHtml, 'provision-table-footer-material-contracts'),
  );
});

test('single-deal mode unchanged: representations-qualifiers renderBody output (the actual live single-deal renderer) is untouched -- General Exceptions / Knowledge / per-rep table still render via ProvisionTable exactly as before', () => {
  const reviewDeal = {
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: {
          secFilingsExceptionLookback: 'since January 1, 2024',
          secFilingsExcludedSections: [{ code: 'RISK_FACTORS', text: 'disclosures contained in any part entitled "Risk Factors"' }],
          disclosureLetterReference: 'the Company Disclosure Letter',
        },
      },
      {
        id: 'org',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization',
        primary_quote: 'Organization representation text.',
        features: { materialityQualifier: 'in all material respects' },
      },
    ],
  };
  const singleHtml = html(React.createElement(ProvisionTable, { config: representationsQualifiersConfig, reviewDeal, isEdit: false }));
  // renderBody's own single-deal shape: General Exceptions + per-rep table
  // as two SEPARATE <table> elements (this is the exact assertion the
  // existing "renders General Exceptions as its OWN table" test in
  // tests/provision-table-configs.test.js pins -- reproduced here scoped
  // to this suite so it stands on its own).
  assert.equal((singleHtml.match(/<table/g) || []).length, 2);
  assert.match(singleHtml, /General Exceptions/);
  assert.match(singleHtml, /since January 1, 2024/);
  assert.match(singleHtml, /Risk Factors/);
  assert.match(singleHtml, /the Company Disclosure Letter/);
});

// ==========================================================================
// Bug 2(b): mae-definitions -- party split preserved via divider bands +
// stripped labels; the per-item carve-out/limb content was ALREADY correct
// in compare mode before this change (traced to mae-definitions.config.js's
// own 'signals' column renderCell already running unmodified through the
// generic flat body -- see CompareColumn.jsx's comment), so this pins that
// it stays correct, plus the two things that were actually broken: the
// unstripped "Company: "/"Parent: " label prefix, and the missing party
// grouping a unified single flat table has no other way to show.
// ==========================================================================

function maeCard(overrides = {}) {
  return {
    id: overrides.id,
    provision_type: 'DEFINITION',
    provision_subtype: 'DEF-MAE',
    short_title: 'Material Adverse Effect',
    ...overrides,
  };
}

test('bug 2 / mae-definitions: compare mode groups Company vs Parent rows under explicit divider bands with stripped labels, preserving the party split a single flat table has no other way to show', () => {
  const dealA = {
    cards: [
      maeCard({
        id: 'mae-company', defined_term: 'Company Material Adverse Effect', primary_quote: 'Company MAE definition text.',
        features: { maeLimbs: 'TWO_LIMB', carveouts: [{ code: 'ECONOMY_GENERAL', label: 'General economy', text: 'general economic conditions' }] },
      }),
      maeCard({
        id: 'mae-parent', defined_term: 'Parent Material Adverse Effect', primary_quote: 'Parent MAE definition text.',
        features: { maeLimbs: 'ONE_LIMB', carveouts: [{ code: 'PANDEMIC', label: 'Pandemic', text: 'pandemics or other public health events' }] },
      }),
    ],
  };
  const dealB = {
    cards: [
      maeCard({
        id: 'mae-company-b', defined_term: 'Company Material Adverse Effect', primary_quote: 'Compared deal Company MAE text.',
        features: { maeLimbs: 'ONE_LIMB', carveouts: [{ code: 'ECONOMY_GENERAL', label: 'General economy', text: 'general economic conditions' }] },
      }),
      maeCard({
        id: 'mae-parent-b', defined_term: 'Parent Material Adverse Effect', primary_quote: 'Compared deal Parent MAE text.',
        features: { maeLimbs: 'TWO_LIMB' }, // deliberately no carve-outs for Parent on this deal
      }),
    ],
  };

  const compareHtml = html(compareSection('mae-definitions', maeDefinitionsConfig, dealA, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: dealB, loading: false, error: null },
  ]));

  // Divider bands present, exactly two, one per side.
  assert.match(compareHtml, /Company MAE</);
  assert.match(compareHtml, /Parent MAE</);
  assert.equal((compareHtml.match(/ MAE</g) || []).length, 2, 'exactly one divider band per side');

  // Labels are stripped for display -- the raw "Company: "/"Parent: "
  // data-layer prefix (mae-definitions.config.js's row.label) must never
  // leak into the rendered row label now that the divider band is
  // carrying that context instead.
  assert.doesNotMatch(compareHtml, /Company: MAE Test/);
  assert.doesNotMatch(compareHtml, /Parent: MAE Test/);
  assert.doesNotMatch(compareHtml, /Company: Carve-outs/);
  assert.doesNotMatch(compareHtml, /Parent: Carve-outs/);
  assert.match(compareHtml, />MAE Test</);
  assert.match(compareHtml, />Carve-outs</);

  // Per-deal answer-cell content: the limb-type translation and per-item
  // carve-out rendering (name + carveback pill) were already correct via
  // the generic flat body's normal column-render path -- still correct.
  assert.match(compareHtml, /Two limbs/);
  assert.match(compareHtml, /One limb/);
  assert.match(compareHtml, /General economic conditions/);
  assert.match(compareHtml, /Pandemic \/ epidemic \/ public health crisis/);
  assert.match(compareHtml, /Not established/); // carveback pill, neither item flagged disproportionate

  // Deal B has no Parent carve-outs of its own -- its cell in the unioned
  // "Carve-outs" (Parent) row must say so, not silently show deal A's.
  assert.match(compareHtml, /Not extracted for this deal/);
});

test('bug 2 / mae-definitions: a single-party MAE (no side split) renders with no divider band at all', () => {
  const dealA = { cards: [maeCard({ id: 'mae-single', features: { maeLimbs: 'TWO_LIMB' } })] };
  const compareHtml = html(compareSection('mae-definitions', maeDefinitionsConfig, dealA));
  assert.doesNotMatch(compareHtml, /Company MAE</);
  assert.doesNotMatch(compareHtml, /Parent MAE</);
  assert.match(compareHtml, /Two limbs/);
});

// ==========================================================================
// Bug 2(c): representations-qualifiers -- General Exceptions / Knowledge
// facts restored (previously a bare "-"), and the per-rep bring-down pill
// (previously dropped entirely -- it only ever rendered via renderTerm, the
// LABEL column's own renderCell, which the unified table deliberately never
// calls per-deal since the label column is shared across every deal).
// ==========================================================================

function repsDealPrimary() {
  return {
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: {
          secFilingsExceptionLookback: 'since January 1, 2024',
          secFilingsExcludedSections: [{ code: 'RISK_FACTORS', text: 'disclosures contained in any part entitled "Risk Factors"' }],
          disclosureLetterReference: 'the Company Disclosure Letter',
        },
      },
      {
        // UUID-shaped id so compareRowUnion's rowIdentityKey falls through
        // to label matching -- the same fallback path two REAL deals'
        // distinct database-id rep cards take in production (see
        // compareRowUnion.js's own doc comment on DEAL_SPECIFIC_ID_RE).
        id: 'aaaaaaaa-0000-4000-8000-000000000001',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization',
        primary_quote: 'The Company is duly organized under Delaware law.',
        features: {
          materialityQualifier: 'in all material respects',
          knowledgeQualifier: 'Company knowledge',
          knowledgeStandard: 'actual-knowledge',
          knowledgePersons: ['EXECUTIVE_OFFICERS'],
        },
      },
      {
        id: 'condition-reps',
        provision_type: 'CLOSING_CONDITION',
        provision_subtype: 'COND-B-REP',
        features: { bringDownTiers: [{ standard: 'MAT_ALL_MATERIAL', reps_covered: 'Organization' }] },
      },
    ],
  };
}

function repsDealCompared() {
  return {
    cards: [
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000002',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization',
        primary_quote: 'The Company is duly organized under New York law.',
        features: { materialityQualifier: 'in all respects' },
      },
    ],
  };
}

test('bug 2 / representations-qualifiers: General Exceptions and Knowledge facts render per-deal in compare mode instead of a bare "-"', () => {
  const dealA = repsDealPrimary();
  const dealB = repsDealCompared();
  const compareHtml = html(compareSection('representations-qualifiers', representationsQualifiersConfig, dealA, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: dealB, loading: false, error: null },
  ]));

  assert.match(compareHtml, /General Exceptions/);
  assert.match(compareHtml, /since January 1, 2024/, 'SEC cut-off fact must render, not a bare em dash');
  assert.match(compareHtml, /Risk Factors/, 'portions-excluded pill must render');
  assert.match(compareHtml, /the Company Disclosure Letter/, 'disclosure letter fact must render');
  assert.match(compareHtml, />Knowledge</);
  assert.match(compareHtml, /Actual knowledge/, 'knowledge standard fact must render');
  assert.match(compareHtml, /Executive officers/, 'knowledge persons fact must render');

  // Deal B has neither a preamble nor knowledge data of its own -- its
  // cells for those two rows must say so, never silently show deal A's or
  // repeat a bare "-" that looks like "nothing here" rather than "not
  // extracted".
  assert.match(compareHtml, /Not extracted for this deal/);
});

test('bug 2 / representations-qualifiers: the per-rep bring-down pill renders in the answer cell (never the shared label), and each deal still resolves its OWN materiality independently', () => {
  const dealA = repsDealPrimary();
  const dealB = repsDealCompared();
  const compareHtml = html(compareSection('representations-qualifiers', representationsQualifiersConfig, dealA, [
    { id: 'deal-b', name: 'Deal B', reviewDeal: dealB, loading: false, error: null },
  ]));

  assert.match(compareHtml, /In all material respects/, "deal A's bring-down pill (from its COND-B-REP bringDownTiers) must render");
  assert.match(compareHtml, /in all material respects/, "deal A's own materiality qualifier must render");
  assert.match(compareHtml, /in all respects/, "deal B's own (different) materiality qualifier must render");

  // The shared label column renders the row's plain label exactly once --
  // it must never carry deal A's bring-down pill text (that would
  // misattribute deal-specific data to the row identity itself, exactly
  // the failure mode flatLabelNode's own comment documents).
  const labelCellMatch = compareHtml.match(/<td class="px-3 py-2 whitespace-normal break-words text-ink font-medium">Organization<\/td>/);
  assert.ok(labelCellMatch, 'the shared label cell must be the plain "Organization" text with no decoration');
});

test('bug 2 / representations-qualifiers: a deal with only a rep row (no General Exceptions / Knowledge of its own) still renders correctly as the PRIMARY column', () => {
  const dealB = repsDealCompared();
  const compareHtml = html(compareSection('representations-qualifiers', representationsQualifiersConfig, dealB));
  assert.match(compareHtml, /Organization/);
  assert.match(compareHtml, /in all respects/);
  assert.doesNotMatch(compareHtml, /General Exceptions/);
});
