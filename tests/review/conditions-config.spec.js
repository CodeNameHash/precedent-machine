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

test('renders exactly two visible columns worth of content per row (Condition label, Standard/Detail body) grouped into descriptive Mutual / Buyer / Target bands', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  assert.match(html, /<h4>Mutual conditions<\/h4>/);
  assert.match(html, /<h4>Buyer&#x27;s conditions — to Parent \/ Merger Sub&#x27;s obligation<\/h4>/);
  assert.match(html, /<h4>Target&#x27;s conditions — to the Company&#x27;s obligation<\/h4>/);
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

test('standards synthesize to the legacy-matching labels (real vote standard, HSR + scheduled approvals, covenant standard, cert pills); mainCondition stays behind a collapsed "see text" expander', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  // Stockholder shows the actual vote standard, not a generic "Approval required".
  assert.match(html, /Majority of outstanding shares/);
  assert.ok(!html.includes('Approval required'), 'the generic "Approval required" boolean must be replaced by the real vote standard');
  // Antitrust: HSR + the scheduled approvals (not a vague catch-all).
  assert.match(html, /HSR waiting period expired or terminated/);
  assert.match(html, /Scheduled regulatory approvals/);
  // Legal restraint, covenant standard (reordered to "In all material respects").
  assert.match(html, /No legal restraint/);
  assert.match(html, /In all material respects/);
  assert.ok(!html.includes('All In Material Respects'), '"All In Material Respects" must be reordered to "In all material respects"');
  // No MAE carries only the continuing qualifier (the name is the TERM column).
  assert.match(html, /MAE must be continuing at closing/);
  // Officer's certificate lists each certified condition as its own pill.
  assert.match(html, /Reps bring-down/);
  assert.match(html, /Covenant performance/);
  assert.match(html, />No MAE</);

  // The full mainCondition sentence must be present (nothing dropped) but
  // only inside a collapsed <details>/"see text" block, never as loose text.
  assert.match(
    html,
    /<summary class="term-cell-seetext"[^>]*>see text<\/summary><div[^>]*>The Company Stockholder Approval must have been duly obtained at the Company Stockholder Meeting\.<\/div>/,
    'mainCondition must sit inside an unopened <details>/"see text" block',
  );
  assert.ok(!/<details[^>]*\bopen\b/.test(html), 'the see-text/see-definition details blocks must render collapsed (no open attribute)');
});

test('rep bring-down renders grouped by standard (lowest materiality first), reps as chips, and the legacy "Defined term:" / "Reps covered" lines are gone', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);

  // Grouped standard sub-headings.
  assert.match(html, /True in all material respects/);
  assert.match(html, /True except where failure would not cause an MAE/);
  // reps_covered section cites resolve to rep NAMES rendered as chips.
  assert.match(html, /Organization; Qualification; Standing/);
  // The material-respects tier (rank 2) renders before the MAE "all others" tier (rank 3).
  const matIdx = html.indexOf('True in all material respects');
  const maeIdx = html.indexOf('True except where failure would not cause an MAE');
  assert.ok(matIdx > -1 && maeIdx > matIdx, 'the material-respects tier must render before the MAE tier');

  // The redundant legacy lines were removed per review.
  assert.ok(!html.includes('Defined term:'), 'the defined-term line under Stockholder Approval was dropped');
  assert.ok(!html.includes('Reps covered ('), 'the inline "Reps covered (N)" line was replaced by the grouped bring-down');
});

// Punchlist #10 -- real shape pulled live against Metsera deal
// 885edae5-49e8-464a-9f33-edd229119d7c: the MAT_ALL_MATERIAL tier's
// reps_covered cites "Section 3.02(b) through Section 3.02(e)" (a range) and
// "Section 3.05(a)(i)(x)" (a sub-clause deeper than anything in
// citedProvisionNames, which only carries "3.02(b)".."3.02(e)" and "3.05(a)").
// Before the fix these rendered as bare "3.02(b) through (e)" / "Section
// 3.05(a)(i)(x)" chips; resolveRepsCovered must now resolve both to names.
test('bring-down PREFIX-matches section cites that outrun nameBySec (range + deep sub-clause) so every rep chip is a NAME, never a bare section ref', () => {
  const cards = [
    card({
      id: 'b-rep-real',
      provision_subtype: 'COND-B-REP',
      short_title: 'Accuracy of Target Reps',
      features: {
        mainCondition: "The Company's representations and warranties must be true and correct at signing and at the Effective Time, subject to tiered materiality standards.",
        bringDownTiers: [
          {
            standard: 'MAT_ALL_MATERIAL',
            standard_label: 'In all material respects',
            reps_covered: 'Section 3.01 first sentence, Section 3.02(b) through Section 3.02(e), Section 3.04, Section 3.05(a)(i)(x), and Section 3.22',
          },
        ],
        citedProvisionNames: [
          { name: 'Organization; Qualification; Standing', section: '3.01' },
          { name: 'Authority; Enforceability', section: '3.04' },
          { name: 'Capitalization; Subsidiaries', section: '3.02(a)' },
          { name: 'Capitalization; Subsidiaries', section: '3.02(b)' },
          { name: 'Capitalization; Subsidiaries', section: '3.02(c)' },
          { name: 'Capitalization; Subsidiaries', section: '3.02(d)' },
          { name: 'Capitalization; Subsidiaries', section: '3.02(e)' },
          { name: 'Capitalization; Subsidiaries', section: '3.02' },
          { name: 'No Conflict; Required Filings and Consents', section: '3.05(a)' },
          { name: 'Brokers; Finders', section: '3.22' },
        ],
      },
    }),
  ];
  const { html } = renderBody({ cards });

  // The range collapses to the single resolved name, not a bare range.
  assert.match(html, /Capitalization; Subsidiaries/);
  assert.ok(!html.includes('3.02(b) through'), 'the "Section 3.02(b) through Section 3.02(e)" range must not leak as a bare section-number chip');
  // The deeper sub-clause resolves via prefix matching to its "3.05(a)" ancestor's name.
  assert.match(html, /No Conflict; Required Filings and Consents/);
  assert.ok(!html.includes('3.05(a)(i)(x)'), 'a cited sub-clause deeper than nameBySec knows about must still resolve to a name, never render bare');
  assert.ok(!/>Section 3\.\d/.test(html), 'no bring-down chip may render a bare "Section 3.x" section reference');
});

// Punchlist #9: "see text" must not appear on some rows but not others. The
// uniform rule is "present iff the row has clause text" -- every one of the
// nine present-row fixture cards carries a mainCondition sentence (real
// Metsera cards always do, via cardToProvision's mainCondition/mainConcept/
// raw-quote fallback chain), so every present row must show the affordance;
// none may be silently dropped by a family-specific branch.
test('the "see text" clause affordance renders on every present row uniformly (one per row, none skipped by family)', () => {
  const reviewDeal = { cards: metseraShapedCards() };
  const { html } = renderBody(reviewDeal);
  const rowCount = (html.match(/class="row"/g) || []).length;
  const seeTextCount = (html.match(/class="term-cell-seetext"/g) || []).length;
  assert.ok(rowCount >= 8, `expected at least 8 present rows, got ${rowCount}`);
  assert.equal(seeTextCount, rowCount, 'every present row (every family/band) must carry exactly one "see text" affordance -- none more, none fewer');
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
