'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  humanVisibleTextFromHtml,
  previewClaimSection,
  previewResolvedClaimRow,
  previewReviewDealRow,
} = require('../lib/review-parity/rendered-row-preview');
const { loadEsmModule, resolveRepoPath } = require('../lib/review-parity/views');

const ROOT = path.resolve(__dirname, '..');
const ABSENCE_COPY = 'Not found (may not be present, or not yet extracted)';

function reviewDeal(cards) {
  return { dealId: 'preview-test', cardCount: cards.length, cards, definitions: [] };
}

function conditionCard(overrides = {}) {
  return {
    id: 'buyer-covenant',
    provision_instance_id: 'buyer-covenant',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: 'COND-B-COV',
    short_title: 'Target Covenant Compliance',
    primary_quote: 'Target covenant compliance clause.',
    full_text: 'Target covenant compliance clause.',
    features: {
      canonicalCode: 'COND-B-COV',
      mainCondition: 'Target covenant compliance clause.',
    },
    ...overrides,
  };
}

function terminationCard() {
  return {
    id: 'outside-date',
    provision_instance_id: 'outside-date',
    provision_type: 'TERMINATION_RIGHT',
    provision_subtype: 'TERMR-OUTSIDE',
    short_title: 'Outside Date',
    primary_quote: 'The outside date is 31 December 2026.',
    full_text: 'The outside date is 31 December 2026.',
    features: { outsideDate: '2026-12-31' },
  };
}

test('a known absence-copy defect class is visible in the rendered row preview', () => {
  const card = terminationCard();
  const preview = previewReviewDealRow({
    family_id: 'TERMINATION',
    review_deal: reviewDeal([card]),
    target_card_id: card.id,
  });

  assert.equal(preview.section.id, 'termination-rights');
  assert.equal(preview.row.id, 'termination-rights-body');
  assert.match(preview.row.cells[0].text, new RegExp(ABSENCE_COPY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(preview.row.cells[0].text, /Mutual consent/);
  assert.match(preview.row.cells[0].text, /Legal restraint \/ order/);
});

test('bandAligned prevents a Buyer condition from appearing in the Target band', () => {
  const correct = conditionCard();
  const preview = previewReviewDealRow({
    family_id: 'CLOSING_CONDITIONS',
    review_deal: reviewDeal([correct]),
    target_card_id: correct.id,
  });

  assert.match(preview.row.cells[0].text, /Buyer's conditions/);
  assert.doesNotMatch(preview.row.cells[0].text, /Target's conditions/);
});

test('the preview exposes the wrong party row when the row model loses its canonical code', () => {
  const wrong = conditionCard({
    provision_subtype: null,
    features: { mainCondition: 'Target covenant compliance clause.' },
  });
  const preview = previewReviewDealRow({
    family_id: 'CLOSING_CONDITIONS',
    review_deal: reviewDeal([wrong]),
    target_card_id: wrong.id,
  });

  assert.match(preview.row.cells[0].text, /Buyer's conditions/);
  assert.match(preview.row.cells[0].text, /Target's conditions/);
  assert.match(preview.row.cells[0].text, /Covenant Performance \(Parent\)/);
});

test('preview cells match the live decorated config and real primitives cell for cell', () => {
  const card = conditionCard();
  const deal = reviewDeal([card]);
  const sectionList = loadEsmModule(resolveRepoPath('components/review-v2/sectionList.js'));
  const decorations = loadEsmModule(resolveRepoPath('components/review-v2/configDecorations.js'));
  const primitives = loadEsmModule(resolveRepoPath('components/review/primitives/ProvisionTablePrimitives.jsx'));
  const provisionTable = loadEsmModule(resolveRepoPath('components/review/ProvisionTable.jsx'));
  const baseConfig = sectionList.REVIEW_V2_CONFIGS.find((config) => config.id === 'conditions');
  const config = decorations.decorateConfigForV2(baseConfig, { agreementIso: null });
  const rows = config.selectRows(deal);
  const fullTextIds = provisionTable.FULL_TEXT_COLUMNS[config.id] || [];
  const columns = config.columns.filter((column) => !fullTextIds.includes(column.id));
  const ctx = { reviewDeal: deal, config, primitives, isEdit: false, resolveCard: () => card, onSelectCard: null, selectedCardId: null };
  const expected = columns.map((column) => ({
    id: column.id,
    header: humanVisibleTextFromHtml(renderToStaticMarkup(React.createElement(React.Fragment, null, column.header || ''))),
    text: humanVisibleTextFromHtml(renderToStaticMarkup(React.createElement(React.Fragment, null, column.renderCell(rows[0], ctx)))),
  }));

  const preview = previewReviewDealRow({
    family_id: 'CLOSING_CONDITIONS',
    review_deal: deal,
    target_card_id: card.id,
  });
  assert.deepEqual(preview.row.cells, expected);
});

test('a recorded claim uses the real family product projection before rendering', () => {
  const runDir = path.join(ROOT, 'evidence/canonical-v2/concho-closing-conditions-20260809-2xk-final');
  const run = {
    run: path.basename(runDir),
    manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(runDir, 'resolution.json'), 'utf8')),
  };
  const resolvedEntry = run.resolution.resolved.find((entry) => entry.concept_key === 'COND-M-STOCKHOLDER');
  assert.ok(resolvedEntry);

  const preview = previewResolvedClaimRow({ run, resolved_entry: resolvedEntry });
  assert.equal(preview.claim_revision_id, resolvedEntry.claim.claim_revision_id);
  assert.equal(preview.provision_instance_id, resolvedEntry.provision_instance.provision_instance_id);
  assert.equal(preview.section.id, 'conditions');
  assert.equal(preview.row.label, 'Stockholder Approval');
  assert.match(preview.row.cells[0].text, /Stockholder Approval/);
});

test('an unsupported family fails closed', () => {
  assert.throws(
    () => previewResolvedClaimRow({
      run: { manifest: { section_family: 'REPRESENTATIONS' }, resolution: { resolved: [] } },
      claim_revision_id: 'claim',
    }),
    (error) => error.code === 'FAMILY_NOT_RENDERABLE',
  );
});

test('Material Contracts claim previews match exactly one bucket row', () => {
  for (const [deal, runName, expectedRows] of [
    ['metsera', 'metsera-material-contracts-20260809-2xk-final', 15],
    ['skywater', 'skywater-material-contracts-20260809-2xk-final', 8],
    ['topbuild', 'topbuild-material-contracts-20260809-2xk-r3-final', 10],
  ]) {
    const runDir = path.join(ROOT, 'evidence/canonical-v2', runName);
    const run = {
      manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'run-manifest.json'), 'utf8')),
      resolution: JSON.parse(fs.readFileSync(path.join(runDir, 'resolution.json'), 'utf8')),
    };
    const signatures = new Set();
    for (const entry of run.resolution.resolved) {
      const preview = previewClaimSection({ run, resolved_entry: entry });
      const matches = preview.rows.filter((row) => row.matches_claim_key);
      assert.equal(matches.length, 1, `${deal}:${entry.claim.claim_revision_id}`);
      assert.equal(matches[0].id.includes(entry.claim.attributes.bucket_code), true);
      signatures.add(matches[0].id);
    }
    assert.equal(signatures.size, expectedRows, deal);
  }
});
