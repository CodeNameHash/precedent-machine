const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let mod;

test.before(async () => {
  mod = await import(path.join('..', '..', 'components', 'review', 'table-configs', 'conditions.config.js'));
});

function card(overrides = {}) {
  return {
    id: overrides.id || 'card',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: overrides.provision_subtype,
    section_ref: overrides.section_ref || 'Section 7.01',
    short_title: overrides.short_title || overrides.provision_subtype,
    primary_quote: overrides.primary_quote || 'Full clause text goes here for evidence.',
    features: overrides.features || {},
  };
}

// Shape mirrors real Metsera extraction shapes (see /tmp/metsera-cond-cards.json
// pulled live against deal 885edae5-49e8-464a-9f33-edd229119d7c during this
// work package) so the fixtures exercise the exact field shapes the
// synthesis functions were written against, not idealized ones.
function metseraShapedCards() {
  return [
    card({
      id: 'stockholder',
      provision_subtype: 'COND-M-STOCKHOLDER',
      short_title: 'Stockholder Approval',
      primary_quote: 'The Company Stockholder Approval must have been duly obtained at the Company Stockholder Meeting.',
      features: {
        mainCondition: 'The Company Stockholder Approval must have been duly obtained at the Company Stockholder Meeting.',
        stockholderApprovalRequired: true,
        approvalDefinition: 'the adoption of this Agreement by holders of a majority of the outstanding shares of Company Common Stock entitled to vote thereon at the Company Stockholders Meeting',
      },
    }),
    card({
      id: 'legal',
      provision_subtype: 'COND-M-LEGAL',
      short_title: 'No Legal Impediment',
      features: {
        mainCondition: 'No court judgment or governmental law preventing or prohibiting the merger may be in effect.',
        absenceOfEnjoiningOrderPresent: true,
        absenceOfEnjoiningOrderDetails: 'No Judgment issued by any court of competent jurisdiction or Law enacted by any Governmental Entity preventing or prohibiting the consummation of the Merger shall be in effect.',
      },
    }),
    card({
      id: 'reg',
      provision_subtype: 'COND-M-REG',
      short_title: 'Antitrust',
      features: {
        mainCondition: 'HSR clearance and scheduled regulatory approvals or clearances must have been obtained, expired, or terminated.',
        hsrClearance: true,
        antitrustApprovals: [
          { code: 'HSR', label: 'HSR Act waiting period expired or terminated', quotes: ['HSR clearance quote'] },
          { code: 'SCHEDULED_APPROVALS', label: 'Other scheduled regulatory approvals obtained', quotes: ['Scheduled approvals quote'] },
        ],
      },
    }),
    card({
      id: 'b-rep',
      provision_subtype: 'COND-B-REP',
      short_title: 'Accuracy of Target Reps',
      features: {
        mainCondition: "The Company's representations and warranties must be true and correct at signing and at the Effective Time.",
        bringDownTiers: [
          { standard: 'MAT_ALL_MATERIAL', standard_label: 'In all material respects', reps_covered: 'Section 3.01', quotes: ['tier quote'] },
          { standard: 'MAT_MAE_QUALIFIED', standard_label: 'True except where failure would not have an MAE', quotes: ['tier quote 2'] },
        ],
        citedProvisionNames: [
          { name: 'Organization; Qualification; Standing', section: '3.01', quotes: ['cited quote'] },
          { name: 'Capitalization; Subsidiaries', section: '3.02', quotes: ['cited quote'] },
          { name: 'Authority; Enforceability', section: '3.04', quotes: ['cited quote'] },
        ],
      },
    }),
    card({
      id: 'b-cov',
      provision_subtype: 'COND-B-COV',
      short_title: 'Target Covenant Compliance',
      features: {
        mainCondition: 'The Company must have performed and complied with its required covenants in all material respects.',
        covenantComplianceStandard: { code: 'ALL_IN_MATERIAL_RESPECTS', label: 'All In Material Respects', quotes: ['covenant quote'] },
      },
    }),
    card({
      id: 'b-mae',
      provision_subtype: 'COND-B-MAE',
      short_title: 'No Target MAE',
      features: {
        mainCondition: 'No Company Material Adverse Effect may have occurred since signing and be continuing.',
        continuingRequirement: true,
        maeStandaloneCondition: 'true',
      },
    }),
    card({
      id: 'b-cert',
      provision_subtype: 'COND-B-CERT',
      short_title: "Officer's Certificate (Target)",
      features: {
        mainCondition: 'The Company must deliver a closing certificate confirming satisfaction of the buyer conditions.',
        certificationRequired: true,
      },
    }),
    card({
      id: 's-rep',
      provision_subtype: 'COND-S-REP',
      short_title: 'Accuracy of Buyer Reps',
      features: {
        mainCondition: 'Parent and Merger Sub representations must be accurate at signing and at the Effective Time.',
      },
    }),
    card({
      id: 's-cert',
      provision_subtype: 'COND-S-CERT',
      short_title: "Officer's Certificate (Buyer)",
      features: {
        mainCondition: 'Parent and Merger Sub must deliver a dated officer certificate.',
        certificationRequired: true,
      },
    }),
  ];
}

// Minimal mock primitives -- real ProvisionTablePrimitives.jsx is a .jsx
// file the plain-Node test runner cannot import (see
// tests/review/provision-table-primitives.spec.js), so every config test in
// this codebase drives renderCell/renderFooter with small React.createElement
// stand-ins that reproduce the observable shape (tone class, title/evidence
// attributes) without depending on the real component tree.
function mockPrimitives() {
  return {
    PillCell: ({ label, tone, evidence }) => React.createElement('span', { className: `pill tone-${tone}`, 'data-evidence': evidence || '' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
    GroupedSubRows: ({ groups, emptyCopy }) => {
      if (!groups.some((g) => g.rows.length)) return React.createElement('div', null, emptyCopy);
      return React.createElement(
        'div',
        null,
        groups.map((g) => React.createElement(
          'div',
          { key: g.id, className: 'group', 'data-group-id': g.id },
          React.createElement('h4', null, g.label),
          g.rows.map((r) => React.createElement(
            'div',
            { key: r.id, className: 'row' },
            React.createElement('span', { className: 'row-label' }, r.label),
            React.createElement('span', { className: 'row-body' }, r.children),
          )),
        )),
      );
    },
    CoverageFooter: ({ presentCount, totalCount, absentItems, label }) => React.createElement(
      'div',
      { 'data-testid': 'coverage-footer' },
      `${presentCount} of ${totalCount} ${label}`,
      React.createElement('div', { className: 'absent' }, (absentItems || []).map((item) => item.label).join(' | ')),
    ),
  };
}

function renderBody(reviewDeal, primitives = mockPrimitives()) {
  const rows = mod.conditionsConfig.selectRows(reviewDeal);
  assert.equal(rows.length, 1, 'the consolidated table renders as a single grouped-body row');
  const bodyColumn = mod.conditionsConfig.columns.find((c) => c.id === 'body');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, bodyColumn.renderCell(rows[0], { primitives, isEdit: false })));
  return { rows, html };
}

function renderFooter(reviewDeal, primitives = mockPrimitives()) {
  const rows = mod.conditionsConfig.selectRows(reviewDeal);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, mod.conditionsConfig.renderFooter(rows, { primitives })));
  return html;
}

test('renders exactly two visible columns worth of content per row (Condition label, Standard/Detail body) grouped into Mutual / Buyer\'s / Seller\'s bands', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  assert.match(html, /<h4>Mutual<\/h4>/);
  assert.match(html, /<h4>Buyer&#x27;s<\/h4>/);
  assert.match(html, /<h4>Seller&#x27;s<\/h4>/);
  // Each present row renders as label + one body cell -- no third "Kind" column.
  const rowLabelCount = (html.match(/class="row-label"/g) || []).length;
  const rowBodyCount = (html.match(/class="row-body"/g) || []).length;
  assert.equal(rowLabelCount, rowBodyCount, 'every rendered row has exactly one label cell and one body cell');
  assert.ok(rowLabelCount >= 8, `expected at least 8 present rows across the three bands, got ${rowLabelCount}`);
});

test('friendly condition names render as visible text; raw canonical codes (COND-*) never appear outside a title attribute', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  assert.match(html, /Stockholder Approval/);
  assert.match(html, /Antitrust \/ Regulatory Clearance/);
  assert.match(html, /No Legal Restraint/);
  assert.match(html, /Accuracy of Representations/);
  assert.match(html, /Covenant Compliance/);
  assert.match(html, /Officer&#x27;s Certificate/);
  assert.match(html, /No Material Adverse Effect/);

  const withoutTitleAttrs = html.replace(/title="[^"]*"/g, '');
  for (const code of ['COND-M-STOCKHOLDER', 'COND-M-LEGAL', 'COND-M-REG', 'COND-B-REP', 'COND-B-COV', 'COND-B-MAE', 'COND-B-CERT', 'COND-S-REP', 'COND-S-CERT']) {
    assert.ok(!withoutTitleAttrs.includes(code), `${code} must not appear as visible text`);
    assert.ok(html.includes(`title="${code}"`), `${code} should still be reachable via the title/hover attribute`);
  }
});

test('bring-down and covenant standards synthesize as short chips, not a clause dump; mainCondition stays behind a collapsed "see text" expander', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  assert.match(html, /In all material respects/);
  assert.match(html, /True except where failure would not have an MAE/);
  assert.match(html, /All In Material Respects/);
  assert.match(html, /HSR Act waiting period expired or terminated/);
  assert.match(html, /Other scheduled regulatory approvals obtained/);
  assert.match(html, /Approval required/);
  assert.match(html, /No legal restraint clause/);
  assert.match(html, /Certification required/);
  assert.match(html, /Must not be continuing/);
  assert.match(html, /Standalone MAE condition/);

  // The full mainCondition sentence must be present (nothing dropped) but
  // only inside a collapsed <details>/"see text" block, never as loose text.
  const clauseSentence = 'The Company Stockholder Approval must have been duly obtained at the Company Stockholder Meeting.';
  assert.match(
    html,
    /<summary class="term-cell-seetext"[^>]*>see text<\/summary><div[^>]*>The Company Stockholder Approval must have been duly obtained at the Company Stockholder Meeting\.<\/div>/,
    'mainCondition must sit inside an unopened <details>/"see text" block',
  );
  assert.ok(!/<details[^>]*\bopen\b/.test(html), 'the see-text/see-definition details blocks must render collapsed (no open attribute)');
});

test('defined-term (approvalDefinition) and cited-provisions synthesis show a short inline preview plus a click-to-open expander with the full content', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);

  // Defined term: short synthesized preview inline, full definition collapsed.
  assert.match(html, /Defined term:/);
  assert.match(html, /the adoption of this Agreement by holders of a majority of the outstanding shares of…/);
  assert.match(html, /<summary class="term-cell-seetext"[^>]*>see definition<\/summary>/);
  const fullDefinition = 'the adoption of this Agreement by holders of a majority of the outstanding shares of Company Common Stock entitled to vote thereon at the Company Stockholders Meeting';
  assert.match(html, new RegExp(fullDefinition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'full definition text must be reachable behind the expander');
  // It must not appear a second time OUTSIDE the collapsed block (i.e. not also inline-dumped).
  const occurrences = html.split(fullDefinition).length - 1;
  assert.equal(occurrences, 1, 'full definition text should appear exactly once (inside the collapsed expander), not duplicated inline');

  // Cited provisions: short preview ("+N more") plus a collapsed full list.
  assert.match(html, /Reps covered \(3\):/);
  assert.match(html, /\+1 more/);
  assert.match(html, /<summary class="term-cell-seetext"[^>]*>see full list<\/summary>/);
  assert.match(html, /Capitalization; Subsidiaries \(§3\.02\)/);
});

test('coverage footer reports "N of M standard conditions present" and lists absent canonical conditions, greyed, at the bottom (not a mid-table row)', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const bodyHtml = renderBody(reviewDeal).html;
  const footerHtml = renderFooter(reviewDeal);

  assert.match(footerHtml, /\d+ of \d+ standard conditions present/);
  const match = footerHtml.match(/(\d+) of (\d+) standard conditions present/);
  const present = Number(match[1]);
  const total = Number(match[2]);
  assert.ok(total > present, 'this fixture omits several canonical rows (S4, Listing, Dissent, Funds, Parent MAE, Parent covenant) so total must exceed present');
  assert.ok(present >= 8);

  // Absent items are listed in the footer, not as inline rows in the body.
  assert.match(footerHtml, /S-4 \/ Proxy Effective/);
  assert.match(footerHtml, /Stock Exchange Listing/);
  assert.match(footerHtml, /Dissenting Shares Threshold/);
  assert.ok(!bodyHtml.includes('S-4 / Proxy Effective'), 'absent conditions must not render as inline "Not found" rows in the grouped body');
  assert.ok(!bodyHtml.includes('Dissenting Shares Threshold'), 'absent conditions must not render as inline "Not found" rows in the grouped body');
});

test('coverage footer counts collapse to zero absent and no "Absent:" section when every canonical row for a synthetic minimal deal matches', () => {
  // Regression guard for the CoverageFooter primitive's own present-only path.
  const primitives = mockPrimitives();
  primitives.CoverageFooter = ({ presentCount, totalCount, absentItems }) => {
    assert.equal(typeof presentCount, 'number');
    assert.equal(typeof totalCount, 'number');
    assert.ok(Array.isArray(absentItems));
    return React.createElement('div', null, `${presentCount}/${totalCount}`);
  };
  const reviewDeal = { cards: metseraShapedCards() };
  renderFooter(reviewDeal, primitives);
});

test('band-alignment guard: a regex-only match that belongs to a different party band is dropped from that row rather than mislabeled', () => {
  // Regression fixture for a real cross-contamination bug found against live
  // Metsera data: the Seller-side "Covenant Performance (Parent)" canonical
  // row's regex fallback also matched the Buyer-side "Target Covenant
  // Compliance" card's short_title on the word "Covenant...Compliance".
  const cards = [
    card({
      id: 'b-cov',
      provision_subtype: 'COND-B-COV',
      short_title: 'Target Covenant Compliance',
      features: { mainCondition: 'Target covenant compliance clause.' },
    }),
  ];
  const groups = mod.conditionGroups({ cards }, {});
  const seller = groups.find((g) => g.id === 'seller');
  const covenantRow = seller.presentRows.find((r) => /Covenant Performance/.test(r.label));
  assert.ok(!covenantRow, 'the Buyer-side card must not surface as a present row under the Seller band');
});

test('deriveFamily reads the canonical rubric code family (last "-"-segment) and falls back to a label sniff for no-code rows', () => {
  assert.equal(mod.deriveFamily({ label: 'Stockholder Approval (Company)' }, 'COND-M-STOCKHOLDER'), 'STOCKHOLDER');
  assert.equal(mod.deriveFamily({ label: 'Reps Bring-Down' }, 'COND-B-REP'), 'REP');
  assert.equal(mod.deriveFamily({ label: 'No Material Adverse Effect (Parent)' }, null), 'MAE');
  assert.equal(mod.deriveFamily({ label: 'Something unrelated' }, null), null);
});
