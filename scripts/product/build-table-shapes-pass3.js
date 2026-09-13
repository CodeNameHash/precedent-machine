#!/usr/bin/env node
'use strict';

// Pass 3 of 5B.8 (docs/core/CODEBASE-GUIDE.md "Layered fact model, V2"; plan
// entry 5B.8). Reads contracts/product/table-shapes.v2.json (pass 2's print-
// harvested vocabulary, docs/codex-program/notes/
// TABLE-SHAPES-AND-VOCABULARIES-FOR-BEN-2026-09-12.md) and applies Ben's
// answers to that note's twenty questions -- recorded in the same note under
// "Ben's answers, 2026-09-13" -- as data: new/changed vocabulary, shared
// vocabularies referenced by id, a per-step structure for double mergers, a
// per-row trigger vocabulary, and table/section-level rules. Writes
// contracts/product/table-shapes.v3.json.
//
// Deterministic like pass 1 and pass 2: reads only the committed V2 contract
// (no network, no dates, no randomness), so re-running against an unchanged
// V2 contract produces byte-identical output -- what
// tests/product-table-shapes.test.js's V3 determinism check requires.

const fs = require('node:fs');
const path = require('node:path');
const { validateTableShapesV3 } = require('../../lib/product/table-shapes');

const ROOT = path.join(__dirname, '..', '..');
const PASS2_PATH = path.join(ROOT, 'contracts/product/table-shapes.v2.json');
const OUT_PATH = path.join(ROOT, 'contracts/product/table-shapes.v3.json');
const LEGAL_SCHEMA_PATH = path.join(ROOT, 'contracts/product/legal-schema.v2.json');
const FACT_COMPONENTS_PATH = path.join(ROOT, 'contracts/product/fact-components.v2.json');
const BEN_NOTE = 'docs/codex-program/notes/TABLE-SHAPES-AND-VOCABULARIES-FOR-BEN-2026-09-12.md';

// --------------------------------------------------------------------------
// Small helpers.
// --------------------------------------------------------------------------

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findSection(doc, key) {
  const section = doc.sections.find((s) => s.section_key === key);
  if (!section) throw new Error(`SECTION_NOT_FOUND: ${key}`);
  return section;
}

function findTable(section, key) {
  const table = section.tables.find((t) => t.table_key === key);
  if (!table) throw new Error(`TABLE_NOT_FOUND: ${section.section_key}.${key}`);
  return table;
}

function findColumn(table, columnId) {
  const column = table.columns.find((c) => c.column_id === columnId);
  if (!column) throw new Error(`COLUMN_NOT_FOUND: ${table.table_key}.${columnId}`);
  return column;
}

function removeSection(doc, key) {
  const index = doc.sections.findIndex((s) => s.section_key === key);
  if (index === -1) throw new Error(`SECTION_NOT_FOUND: ${key}`);
  doc.sections.splice(index, 1);
}

function slug(label) {
  return String(label || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'CODE';
}

function addition(label, reason, { code, tone = 'neutral' } = {}) {
  return { code: code || slug(label), label, tone, addition: true, reason };
}

const BEN = "Ben's decision 2026-09-13";

// ==========================================================================
// Decision 1 (Structure & Mechanics): deal-structure vocabulary of One-step
// merger / Double merger / Tender offer with back-end merger; merger-form
// vocabulary of Reverse triangular / Forward triangular / Forward merger,
// shared by id and reused per step; a per-step structure (first-step form,
// second-step form, surviving entity per step) for double mergers.
// ==========================================================================

function applyDecision1StructureMechanics(doc) {
  const section = findSection(doc, 'structure-mechanics');
  const table = findTable(section, 'structure-mechanics-table');

  const dealStructureColumn = findColumn(table, 'dealStructure');
  dealStructureColumn.vocabulary = [
    {
      code: 'ONE_STEP_MERGER',
      label: 'One-step merger',
      tone: 'neutral',
      source: 'legacy_map',
      display_variants: [
        { label: 'One Step Merger', source: 'print', print_evidence: { page: 1, row_label: 'Deal structure' } },
      ],
    },
    addition(
      'Double merger (reverse triangular merger followed by a second-step forward merger)',
      `${BEN} #1: a merger sub merging into the target followed by the surviving corporation merging into a `
        + "second merger sub is a double merger, not a one-step merger -- Cadwalader, 'Multiple Step Acquisitions' "
        + '(the IRS Double Merger Ruling), and the second step is a Second-Step Forward Merger (Law Insider sample '
        + "clause language). TopBuild's print used the legacy 'One Step Merger' pill for this deal; that label "
        + 'survives only as a display variant of ONE_STEP_MERGER for a deal that is genuinely one-step, per '
        + "Ben's correction, and is removed from this deal's own coding.",
      { code: 'DOUBLE_MERGER' },
    ),
    addition(
      'Tender offer with back-end merger',
      `${BEN} #1: the deal-structure axis must also cover a tender offer followed by a back-end merger, distinct `
        + "from a double merger; 'two-step merger' is avoided as a name because practitioners use it for both shapes.",
      { code: 'TENDER_OFFER_BACK_END_MERGER' },
    ),
  ];
  dealStructureColumn.fill_from = ['STANDARD'];

  // v1/v2 carried "Reverse triangular merger" twice (once legacy-map, once
  // print evidence) -- decision #2 fixes the axis at exactly three distinct
  // forms, each attested once, shared by id so the per-step columns below
  // reuse the identical vocabulary rather than a second inline copy.
  doc.shared_vocabularies.MERGER_FORM = [
    {
      code: 'REVERSE_TRIANGULAR_MERGER',
      label: 'Reverse triangular merger',
      tone: 'neutral',
      source: 'both',
      print_evidence: { page: 1, row_label: 'Merger form' },
    },
    {
      code: 'FORWARD_TRIANGULAR_MERGER',
      label: 'Forward triangular merger',
      tone: 'neutral',
      source: 'print',
      print_evidence: { page: 1, row_label: 'Merger form' },
    },
    { code: 'FORWARD_MERGER', label: 'Forward merger', tone: 'neutral', source: 'legacy_map' },
  ];

  const mergerFormColumn = findColumn(table, 'signals');
  delete mergerFormColumn.vocabulary;
  mergerFormColumn.vocabulary_ref = 'MERGER_FORM';
  // Decision #2: the structure family records which form applies from the
  // operative "merge with and into" language and which entity survives.
  mergerFormColumn.fill_from = ['OPERATION', 'ACTOR', 'OBJECT'];

  table.columns.push(
    {
      column_id: 'mergerFormStep1',
      header: 'Merger Form (Step 1)',
      render: 'vocabulary',
      vocabulary_ref: 'MERGER_FORM',
      addition: true,
      reason: `${BEN} #2: a double merger carries one merger form per step; Step 1 is the reverse triangular `
        + 'merger of merger sub into the target.',
      fill_from: ['OPERATION', 'ACTOR', 'OBJECT'],
    },
    {
      column_id: 'survivingEntityStep1',
      header: 'Surviving Entity (Step 1)',
      render: 'term',
      addition: true,
      reason: `${BEN} #2: the structure family must record which entity survives each step, not just the form.`,
      fill_from: ['TERM'],
    },
    {
      column_id: 'mergerFormStep2',
      header: 'Merger Form (Step 2)',
      render: 'vocabulary',
      vocabulary_ref: 'MERGER_FORM',
      addition: true,
      reason: `${BEN} #1-#2: the second step of a double merger is a second-step forward merger of the surviving `
        + 'corporation into a second merger sub.',
      fill_from: ['OPERATION', 'ACTOR', 'OBJECT'],
    },
    {
      column_id: 'survivingEntityStep2',
      header: 'Surviving Entity (Step 2)',
      render: 'term',
      addition: true,
      reason: `${BEN} #2: companion to Surviving Entity (Step 1) for the second step.`,
      fill_from: ['TERM'],
    },
  );

  table.per_step_structure = {
    applies_when: "dealStructure === 'DOUBLE_MERGER'",
    steps: [
      { step: 1, form_column_id: 'mergerFormStep1', surviving_entity_column_id: 'survivingEntityStep1' },
      { step: 2, form_column_id: 'mergerFormStep2', surviving_entity_column_id: 'survivingEntityStep2' },
    ],
  };
}

// ==========================================================================
// Decision 2 (Equity Awards): CVR entitlement is Entitled / Not entitled /
// Entitled if a milestone brings the award into the money.
// ==========================================================================

function applyDecision2CvrEntitlement(doc) {
  const section = findSection(doc, 'equity-awards');
  const table = findTable(section, 'equity-awards-table');
  const column = findColumn(table, 'cvrEntitlement');
  column.vocabulary = [
    addition('Entitled', `${BEN} #3: CONSIDERATION/CVR_COMPONENT supports a CVR entitlement carried through to `
      + 'converted equity awards; this deal shows no CVR, so the axis is proposed rather than drawn from this print.', { code: 'ENTITLED' }),
    addition('Not entitled', `${BEN} #3: complement of Entitled; matches the "—" seen on every row of this `
      + "deal's CVR Entitlement column.", { code: 'NOT_ENTITLED' }),
    addition(
      'Entitled if a milestone brings the award into the money (spread over exercise price on cash plus CVR)',
      `${BEN} #3: a milestone-linked entitlement -- the extractor looks for the earn-in language that puts the `
        + 'award in the money, valued as the spread over the exercise price on cash plus CVR.',
      { code: 'ENTITLED_IF_MILESTONE_IN_THE_MONEY' },
    ),
  ];
}

// ==========================================================================
// Decision 3 (Representations & Closing Conditions): one shared bring-down
// vocabulary (code set), each code carrying both print renderings as display
// variants, used by both reps tables and both closing-conditions tables. The
// rep's own qualifier standard (`materiality`) stays a separate column,
// untouched.
// ==========================================================================

function applyDecision3BringDown(doc) {
  doc.shared_vocabularies.BRING_DOWN_STANDARD = [
    {
      code: 'TRUE_IN_ALL_RESPECTS',
      label: 'True in all respects',
      tone: 'neutral',
      source: 'legacy_map',
      display_variants: [
        { label: 'Bringdown: In all respects', source: 'print', print_evidence: { page: 18, row_label: 'Absence of Certain Changes or Events' } },
        { label: 'TRUE IN ALL RESPECTS', source: 'print', print_evidence: { page: 115, row_label: 'Accuracy of Representations' } },
      ],
    },
    {
      code: 'TRUE_EXCEPT_DE_MINIMIS',
      label: 'True except for de minimis inaccuracies',
      tone: 'neutral',
      source: 'legacy_map',
      display_variants: [
        { label: 'Bringdown: De minimis', source: 'print', print_evidence: { page: 17, row_label: 'Capitalization; Subsidiaries' } },
        { label: 'TRUE EXCEPT FOR DE MINIMIS INACCURACIES', source: 'print', print_evidence: { page: 115, row_label: 'Accuracy of Representations' } },
      ],
    },
    {
      code: 'TRUE_IN_ALL_MATERIAL_RESPECTS',
      label: 'True in all material respects',
      tone: 'neutral',
      source: 'legacy_map',
      display_variants: [
        { label: 'Bringdown: In all material respects', source: 'print', print_evidence: { page: 17, row_label: 'Organization; Qualification; Standing' } },
        { label: 'TRUE IN ALL MATERIAL RESPECTS', source: 'print', print_evidence: { page: 115, row_label: 'Accuracy of Representations' } },
      ],
    },
    {
      code: 'TRUE_EXCEPT_NO_MAE',
      label: 'True except where failure would not cause an MAE',
      tone: 'neutral',
      source: 'legacy_map',
      display_variants: [
        { label: 'Bringdown: MAE', source: 'print', print_evidence: { page: 18, row_label: 'No Conflict; Required Filings and Consents' } },
        { label: 'TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE', source: 'print', print_evidence: { page: 115, row_label: 'Accuracy of Representations' } },
      ],
    },
  ];

  const promote = (sectionKey, tableKey, columnId) => {
    const section = findSection(doc, sectionKey);
    const table = findTable(section, tableKey);
    const column = findColumn(table, columnId);
    delete column.vocabulary;
    column.vocabulary_ref = 'BRING_DOWN_STANDARD';
  };
  promote('representations-qualifiers', 'representations-qualifiers-table', 'bringdown');
  promote('parent-representations-qualifiers', 'parent-representations-qualifiers-table', 'bringdown');
  promote('conditions-b', 'conditions-b-table', 'standard');
  promote('conditions-s', 'conditions-s-table', 'standard');
}

// ==========================================================================
// Decision 4 (Lookback): a relative period computed from a date, the date on
// hover.
// ==========================================================================

function applyDecision4Lookback(doc) {
  for (const sectionKey of ['representations-qualifiers', 'parent-representations-qualifiers']) {
    const section = findSection(doc, sectionKey);
    const table = section.tables[0];
    const column = findColumn(table, 'lookback');
    column.render = 'value';
    column.value_kind = 'PERIOD';
    column.hover = 'date';
    column.fill_from = ['PERIOD', 'DATE'];
  }
}

// ==========================================================================
// Decision 5 (MAE carve-outs): parent and company tables are not forced to
// the same fixed rows -- each table's carve-out rows are whatever the deal
// shows, not a hard-coded shared list.
// ==========================================================================

// Ben, 2026-09-13 17:30 UTC, on the first Metsera V9 tables: "we designed
// something that was a bespoke grid here not this weird table". The legacy
// Structure & Mechanics is a TERM / PROVISION grid for the deal (print p.1),
// not a row per fact: one row for the agreement, every structure fact
// contributing the cells it can, rendered as an attribute grid.
function applyDecision17StructureGrid(doc) {
  const table = findTable(findSection(doc, 'structure-mechanics'), 'structure-mechanics-table');
  table.rows_are = 'one per agreement';
  table.layout = 'attribute grid';
  table.subject_label = 'The deal';
  table.guidance = 'One row for the whole agreement. dealStructure codes the transaction as a whole from the merger provisions: ONE_STEP_MERGER when one merger sub merges with and into the Company (or the Company into the merger sub) and no second merger follows; DOUBLE_MERGER when a second-step merger of the surviving corporation follows; TENDER_OFFER_BACK_END_MERGER when an offer precedes the merger. mergerFormStep1 codes the form of the first (or only) merger from the "with and into" words and which entity survives; the step-2 columns are used only for a DOUBLE_MERGER. Every fact of the family contributes the cells it can; the fact stating the merger itself carries dealStructure and mergerFormStep1.';
}

// Ben, 2026-09-13 17:45 UTC, on Metsera (cash plus CVR, no election): "cash
// election - (i) there is no cash election and (ii) you missed the CVR
// portion of the consideration". The legacy consideration tables were
// harvested from TopBuild, an election deal, so their only row labels were
// "Cash Election" / "Stock Election" and their only detail codes election
// codes; the model had nowhere else to put a $47.50 cash limb or a CVR.
// Deal-agnostic shape: a consideration-structure attribute grid for the
// deal, a consideration-components table with one row per limb (cash, stock,
// CVR, ...), an exchange-mechanics table for the paying-agent steps, and the
// election-mechanics table kept for election deals only.
function applyDecision18ConsiderationDealAgnostic(doc) {
  const section = findSection(doc, 'consideration-hero');
  const legacy = findTable(section, 'consideration-hero-table');
  const legacyDetail = findColumn(legacy, 'considerationType');
  const why = `${BEN} #18 (Metsera, cash plus CVR): the consideration axis must describe any deal, not only an election deal.`;
  const structure = {
    table_key: 'consideration-structure',
    group_header: null,
    term_column: { header: 'Term', source: 'subject', fill_from: ['TERM'] },
    columns: [
      {
        column_id: 'considerationType', header: 'Consideration type', render: 'vocabulary',
        vocabulary: [
          addition('All cash', `${why} A fixed cash price per share.`, { code: 'ALL_CASH' }),
          addition('All stock', `${why} A fixed exchange ratio into acquirer stock.`, { code: 'ALL_STOCK' }),
          addition('Cash and stock (fixed mix)', `${why} A fixed cash amount plus a fixed number of acquirer shares, no election.`, { code: 'CASH_AND_STOCK_FIXED' }),
          addition('Cash plus CVR', `${why} Cash plus a contingent value right per share (Metsera).`, { code: 'CASH_AND_CVR' }),
          addition('Stock plus CVR', `${why} Acquirer stock plus a contingent value right per share.`, { code: 'STOCK_AND_CVR' }),
          ...legacyDetail.vocabulary.map(clone),
        ],
        fill_from: ['STANDARD', 'OBJECT', 'AMOUNT', 'TERM'],
      },
      { column_id: 'appraisalRights', header: 'Appraisal rights', render: 'verbatim', fill_from: ['EXCEPTION', 'OPERATION', 'OBJECT'], addition: true, reason: `${why} The legacy "Appraisal rights" row, as one line of the grid.` },
      { column_id: 'withholding', header: 'Withholding', render: 'boolean', fill_from: ['OPERATION', 'OBJECT'], addition: true, reason: `${why} The legacy "Withholding" row, present or absent.` },
      { column_id: 'withoutInterest', header: 'Without interest', render: 'boolean', fill_from: ['QUALIFIER'], addition: true, reason: `${why} Whether the consideration is stated to be paid without interest.` },
    ],
    rows_are: 'one per agreement',
    layout: 'attribute grid',
    subject_label: 'The deal',
    subtype_keys: ['CONSIDERATION_PACKAGE', 'ELECTION', 'APPRAISAL_LINK', 'WITHHOLDING', 'EXCLUSION'],
    guidance: 'One row for the whole agreement. The consideration-type code describes the package as a whole (cash, stock, cash plus CVR, an election).',
  };
  const components = {
    table_key: 'consideration-components',
    group_header: 'CONSIDERATION PER SHARE',
    term_column: { header: 'Component', source: 'subject', fill_from: ['TERM', 'DEFINED_TERM', 'OBJECT', 'AMOUNT'] },
    columns: [
      {
        column_id: 'form', header: 'Form', render: 'vocabulary',
        vocabulary: [
          addition('Cash', `${why} A cash limb.`, { code: 'CASH' }),
          addition('Acquirer stock', `${why} A stock limb.`, { code: 'PARENT_STOCK' }),
          addition('CVR', `${why} A contingent value right limb.`, { code: 'CVR' }),
          addition('Cash election', `${why} The cash side of an election.`, { code: 'CASH_ELECTION' }),
          addition('Stock election', `${why} The stock side of an election.`, { code: 'STOCK_ELECTION' }),
          addition('Other', `${why} Any other form of consideration.`, { code: 'OTHER' }),
        ],
        fill_from: ['OBJECT', 'AMOUNT', 'TERM', 'DEFINED_TERM'],
      },
      { column_id: 'amount', header: 'Amount / ratio', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT', 'THRESHOLD', 'PERCENTAGE'], addition: true, reason: `${why} The per-share cash amount, exchange ratio or CVR count, as stated.` },
      { column_id: 'per', header: 'Per', render: 'verbatim', fill_from: ['ACTOR', 'OBJECT', 'QUALIFIER'], addition: true, reason: `${why} The unit the amount attaches to (per share of Company Common Stock).` },
      { column_id: 'contingency', header: 'Contingent on', render: 'verbatim', fill_from: ['CONDITION', 'OBJECT', 'QUALIFIER', 'CROSS_REFERENCE'], addition: true, reason: `${why} What a contingent limb depends on (the Milestone Payments under the CVR Agreement).` },
      { column_id: 'definedAs', header: 'Defined as', render: 'term', fill_from: ['DEFINED_TERM', 'TERM'], addition: true, reason: `${why} The defined term the agreement gives the limb ("Closing Amount", "CVR", "Merger Consideration").` },
    ],
    rows_are: 'one per subject',
    subtype_keys: ['CASH_COMPONENT', 'STOCK_COMPONENT', 'CVR_COMPONENT', 'CONSIDERATION_PACKAGE'],
    guidance: 'One row per limb of the per-share consideration: the cash limb, the stock limb, the CVR limb, each side of an election. A package fact that states several limbs in one sentence contributes to each limb it names.',
  };
  const exchange = {
    table_key: 'consideration-exchange-mechanics',
    group_header: 'EXCHANGE MECHANICS',
    term_column: { header: 'Step', source: 'subject', fill_from: ['OBJECT', 'ACTOR', 'TERM'] },
    columns: [
      { column_id: 'body', header: 'Provision', render: 'verbatim', fill_from: ['OPERATION', 'OBJECT'], addition: true, reason: `${why} The operative words of the exchange step.` },
      { column_id: 'timing', header: 'Timing', render: 'verbatim', fill_from: ['TRIGGER', 'PERIOD', 'DATE'], addition: true, reason: `${why} When the step happens (after the Effective Time, within five business days).` },
      { column_id: 'who', header: 'Who', render: 'verbatim', fill_from: ['ACTOR'], addition: true, reason: `${why} The party or agent that acts.` },
    ],
    rows_are: 'one per subject',
    subtype_keys: ['EXCHANGE_MECHANICS'],
    guidance: 'One row per exchange step: paying agent appointment, deposit of funds, letter of transmittal, surrender, lost certificates, unclaimed funds, payroll payment of award amounts.',
  };
  const election = findTable(section, 'consideration-hero-election-mechanics');
  election.subtype_keys = ['ELECTION'];
  election.guidance = 'Only for a deal whose holders elect between forms of consideration. Never place a fact here when the agreement has no election.';
  section.tables = [structure, components, exchange, election];
}

function applyDecision5MaeCarveouts(doc) {
  const section = findSection(doc, 'mae-definitions');
  for (const tableKey of ['mae-carveouts-parent', 'mae-carveouts-company']) {
    const table = findTable(section, tableKey);
    table.rows_are = 'one per subject';
    delete table.fixed_row_labels;
  }
}

// Decision 6 (Material Contracts): rows with the same header and different
// thresholds stay separate buckets -- already true in the V2 contract (two
// distinct codes, AGGREGATE_PAYMENTS_THRESHOLD_10M_PER_ANNUM and
// AGGREGATE_PAYMENTS_THRESHOLD_10M, share the label "Contracts above an
// aggregate-payments threshold"); no structural change, carried forward as-is
// and covered by a regression test.

// ==========================================================================
// Decision 7 (Interim Operating Covenants): the negative-covenants table
// already carries two columns per row (Specific Restrictions, Exceptions),
// each with its own vocabulary from the print and ioc-exceptions.config.js --
// carried forward unchanged. New: an empty Exceptions or Other Restrictions
// band is never a silent omission -- table-level empty_band_is_error.
// ==========================================================================

function applyDecision7InterimCovenants(doc) {
  for (const sectionKey of ['ioc-exceptions', 'parent-ioc-exceptions']) {
    const section = findSection(doc, sectionKey);
    for (const suffix of ['-exceptions', '-other-restrictions']) {
      const table = findTable(section, `${sectionKey}${suffix}`);
      table.empty_band_is_error = true;
    }
  }
}

// ==========================================================================
// Decision 8 (No-Shop): Solicit / Initiate / Knowingly encourage / Facilitate
// as four separate present/absent (boolean) columns, not one vocabulary
// column with four codes. Fiduciary-out: one Engagement standard row
// carrying the coded label, full sentence on click.
// ==========================================================================

function applyDecision8NoShop(doc) {
  const noShopSection = findSection(doc, 'nosol-noshop');
  const coreTable = findTable(noShopSection, 'nosol-noshop-core-mechanics');
  const prohibitedVerbColumn = findColumn(coreTable, 'prohibitedVerb');
  const reason = prohibitedVerbColumn.vocabulary[0].reason;
  const index = coreTable.columns.findIndex((c) => c.column_id === 'prohibitedVerb');
  coreTable.columns.splice(
    index,
    1,
    { column_id: 'solicit', header: 'Solicit', render: 'boolean', addition: true, reason, fill_from: ['CONDITION'] },
    { column_id: 'initiate', header: 'Initiate', render: 'boolean', addition: true, reason, fill_from: ['CONDITION'] },
    {
      column_id: 'knowinglyEncourage', header: 'Knowingly Encourage', render: 'boolean', addition: true, reason, fill_from: ['CONDITION'],
    },
    { column_id: 'facilitate', header: 'Facilitate', render: 'boolean', addition: true, reason, fill_from: ['CONDITION'] },
  );

  const fiduciarySection = findSection(doc, 'nosol-fiduciary');
  const fiduciaryTable = findTable(fiduciarySection, 'nosol-fiduciary-table');
  const signalsColumn = findColumn(fiduciaryTable, 'signals');
  signalsColumn.full_text_on_click = true;
  fiduciaryTable.fixed_row_labels = ['Engagement standard', 'Final determination standard'];
}

// ==========================================================================
// Decision 9 (Votes): Proxy filing deadline / Mailing / Meeting each carry
// their own trigger vocabulary (per row), not one shared set across all
// three rows.
// ==========================================================================

function applyDecision9VotesTrigger(doc) {
  const section = findSection(doc, 'votes-approvals-meeting');
  const table = findTable(section, 'votes-approvals-meeting-table');
  const column = findColumn(table, 'value');
  const flat = column.trigger.vocabulary;
  const byRowLabel = new Map(flat.map((entry) => [entry.print_evidence.row_label, entry]));
  column.trigger = {
    per_row: true,
    by_row_label: {
      'Proxy filing deadline': [byRowLabel.get('Proxy filing deadline')],
      Mailing: [byRowLabel.get('Mailing')],
      Meeting: [byRowLabel.get('Meeting')],
    },
  };
}

// Decision 10 (Closing Conditions): drop the "x of y standard conditions"
// checklist table -- the entire conditions-m section existed only for it.

function applyDecision10ClosingConditions(doc) {
  removeSection(doc, 'conditions-m');
}

// ==========================================================================
// Decision 11 (Termination for breach): Curable or not becomes a vocabulary
// (Curable / Not curable / Curable in part); Cure period stays a value/PERIOD
// column; Cure period end becomes a vocabulary describing what the end point
// IS (Outside date / Fixed date / Earlier of notice period and outside
// date), not a literal date; Terminator-breach bar becomes a Yes/No
// vocabulary. fill_from spans CONDITION, PERIOD, EXCEPTION, CROSS_REFERENCE
// across this group of columns.
// ==========================================================================

function applyDecision11TerminationForBreach(doc) {
  const section = findSection(doc, 'termination-rights');
  const buyerTable = findTable(section, 'termination-rights-buyer-may-terminate');

  const curableColumn = findColumn(buyerTable, 'curableOrNot');
  curableColumn.render = 'vocabulary';
  delete curableColumn.value_kind;
  curableColumn.vocabulary = [
    addition('Curable', `${BEN} #14: termination for breach records whether the breach is curable, not curable, or `
      + 'curable in part.', { code: 'CURABLE' }),
    addition('Not curable', `${BEN} #14: complement of Curable.`, { code: 'NOT_CURABLE' }),
    addition('Curable in part', `${BEN} #14: a breach can be curable as to part of the underlying failure only.`, { code: 'CURABLE_IN_PART' }),
  ];
  curableColumn.fill_from = ['CONDITION'];

  const curePeriodColumn = findColumn(buyerTable, 'curePeriodValue');
  curePeriodColumn.header = 'Cure Period';
  curePeriodColumn.fill_from = ['PERIOD'];

  const curePeriodEndColumn = findColumn(buyerTable, 'curePeriodEnd');
  curePeriodEndColumn.render = 'vocabulary';
  delete curePeriodEndColumn.value_kind;
  curePeriodEndColumn.vocabulary = [
    addition('Outside date', `${BEN} #14: the cure period can run to the outside date itself.`, { code: 'OUTSIDE_DATE' }),
    addition('Fixed date', `${BEN} #14: the cure period can run to a fixed date stated in the agreement.`, { code: 'FIXED_DATE' }),
    addition(
      'Earlier of notice period and outside date',
      `${BEN} #14: the cure period can run to whichever of a stated notice period or the outside date comes first.`,
      { code: 'EARLIER_OF_NOTICE_PERIOD_AND_OUTSIDE_DATE' },
    ),
  ];
  curePeriodEndColumn.fill_from = ['EXCEPTION'];

  const companyTable = findTable(section, 'termination-rights-company-may-terminate');
  const terminatorBreachBarColumn = findColumn(companyTable, 'terminatorBreachBar');
  terminatorBreachBarColumn.render = 'vocabulary';
  terminatorBreachBarColumn.vocabulary = [
    addition('Yes', `${BEN} #14: no termination where the terminator primarily caused the outside date to be missed.`, { code: 'YES' }),
    addition('No', `${BEN} #14: complement of Yes.`, { code: 'NO' }),
  ];
  terminatorBreachBarColumn.fill_from = ['CROSS_REFERENCE'];
}

// Decision 12 (Termination Fees): Payer (Company; Parent) already exists in
// the V2 contract as a proposed-addition column with that exact two-code
// vocabulary; carried forward unchanged (Ben is indifferent on this one, the
// column keeps the comparison explicit).

// ==========================================================================
// Decision 13 (Employee benefits): "Not specified" stays the absence of a
// Reference Group value (already true in V2, carried forward); the fixed
// rows become the full ten canonical benefit elements
// (lib/employee-benefits.js COMP_ITEM_ORDER), shown only when found in the
// deal; split_combined_elements records that a sentence combining several
// elements is split across the table's rows.
// ==========================================================================

function applyDecision13EmployeeBenefits(doc) {
  const section = findSection(doc, 'employee-benefits');
  const table = findTable(section, 'employee-benefits-table');
  const additionalLabels = (table.additional_fixed_row_labels || []).map((row) => row.label);
  table.fixed_row_labels = [...table.fixed_row_labels, ...additionalLabels];
  delete table.additional_fixed_row_labels;
  table.show_only_when_populated = true;
  table.split_combined_elements = true;
}

// Decision 14 (No Other Reps / Fraud): Status is Yes / No / Silent -- already
// true in the V2 contract (Yes and Silent from the print, No as the
// completing addition); carried forward unchanged.

// ==========================================================================
// Decision 15 (Defined Terms): a reference appendix, not a fact table --
// cross-deal comparison of a definition is a later feature.
// ==========================================================================

function applyDecision15DefinedTerms(doc) {
  const section = findSection(doc, 'defined-terms');
  section.kind = 'reference_appendix';
  section.excluded_from_fact_tables = true;
  section.note = `${BEN} #19: a reference appendix, not a fact table. Cross-deal comparison of a definition `
    + '(e.g. how "Law" is defined across two deals) is a later feature.';
}

// Decision 16 (Approvals / Votes; Antitrust / Regulatory; Advisers / Fees /
// Expenses; Shareholder Meeting / Proxy / Tender Offer): stay as sections --
// no removal. Nothing to do; carried forward unchanged from V2.

// --------------------------------------------------------------------------
// Assembly
// --------------------------------------------------------------------------

function build() {
  const pass2 = JSON.parse(fs.readFileSync(PASS2_PATH, 'utf8'));

  const doc = clone(pass2);
  doc.schema_version = 'PRODUCT_TABLE_SHAPES/V3';
  doc.status = 'DECIDED';
  doc.generated_from = [...new Set([...doc.generated_from, 'contracts/product/table-shapes.v2.json', BEN_NOTE])];
  doc.shared_vocabularies = {};

  applyDecision1StructureMechanics(doc);
  applyDecision2CvrEntitlement(doc);
  applyDecision3BringDown(doc);
  applyDecision4Lookback(doc);
  applyDecision5MaeCarveouts(doc);
  applyDecision17StructureGrid(doc);
  applyDecision18ConsiderationDealAgnostic(doc);
  applyDecision7InterimCovenants(doc);
  applyDecision8NoShop(doc);
  applyDecision9VotesTrigger(doc);
  applyDecision10ClosingConditions(doc);
  applyDecision11TerminationForBreach(doc);
  applyDecision13EmployeeBenefits(doc);
  applyDecision15DefinedTerms(doc);

  return doc;
}

if (require.main === module) {
  const doc = build();
  const legalSchema = JSON.parse(fs.readFileSync(LEGAL_SCHEMA_PATH, 'utf8'));
  const factComponents = JSON.parse(fs.readFileSync(FACT_COMPONENTS_PATH, 'utf8'));
  validateTableShapesV3(doc, legalSchema, factComponents);
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  const tableCount = doc.sections.reduce((n, s) => n + s.tables.length, 0);
  const columnCount = doc.sections.reduce((n, s) => n + s.tables.reduce((m, t) => m + t.columns.length, 0), 0);
  console.log(`wrote ${OUT_PATH}: ${doc.sections.length} sections, ${tableCount} tables, ${columnCount} columns`);
}

module.exports = { build };
