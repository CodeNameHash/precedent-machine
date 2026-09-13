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
      // Ben, 2026-09-13: "there should be a link to the MAE definition from
      // the MAE bringdown". The page renders a definition link on this pill.
      links_to_section: 'mae-definitions',
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
  const election = findTable(section, 'consideration-hero-election-mechanics');
  election.subtype_keys = ['ELECTION'];
  election.guidance = 'Only for a deal whose holders elect between forms of consideration. Never place a fact here when the agreement has no election.';
  // Ben, 2026-09-13 18:05 UTC: "there are no such mechanics, these are
  // payment mechanics that do not need to be summarized". Exchange and
  // payment mechanics stay as facts (evidence) with no table and no readout.
  section.no_conclusions_subtype_keys = ['EXCHANGE_MECHANICS'];
  section.tables = [structure, components, election];
}

// Ben, 2026-09-13 18:05 UTC, Metsera equity awards: "you say no CVR
// entitlement but your basis for that is out of the money options ... but
// you apply it to all options. The other options get a cvr". A class of
// award treated differently is its own row.
function applyDecision19EquityAwardClasses(doc) {
  const table = findTable(findSection(doc, 'equity-awards'), 'equity-awards-table');
  table.guidance = 'One row per award type and per class treated differently: an out-of-the-money option cancelled for no consideration is its own row, labelled to say so (for example "Underwater Company Stock Option"), never merged into the row for the in-the-money options; likewise vested and unvested awards when their treatment differs. A cell states only what its own fact says about its own row.';
}

// Ben, 2026-09-13 18:05 UTC, Metsera representations: "(i) a bringdown
// standard is what is said in the conditions, not the rep, so these should
// be empty now and (ii) the summaries on the left are (x) not the right
// vocabulary - see the precedent and (y) if we want to track more detail
// ... it should be a sub item underneath a more general organization rep
// that has sub items (which use the same columns) and then the general
// organization rep gives an overview". Rows are the legacy rep names
// (TopBuild print pp.17-19), open to a new name when no row fits; a limb
// is a sub-item (row_detail) under its rep; the bring-down column is
// derived from the CLOSING_CONDITIONS bring-down facts, never from a rep.
const REP_ROWS = [
  'Organization; Qualification; Standing', 'Capitalization; Subsidiaries', 'Authority; Enforceability',
  'No Conflict; Required Filings and Consents', 'SEC Documents; Financial Statements', 'Absence of Certain Changes or Events',
  'Litigation; Legal Proceedings', 'Employee Benefit Plans; ERISA', 'Compliance with Laws; Permits; Licenses',
  'Takeover Statutes; Anti-Takeover', 'Environmental Matters', 'Taxes; Tax Returns', 'Labor Matters; Relations',
  'Intellectual Property', 'Insurance', 'Real Property; Personal Property; Title', 'Top Customers and Suppliers',
  'Brokers; Finders', 'Information Supplied / Proxy Statement', 'Opinion of Financial Advisor',
];
function applyDecision20RepresentationRows(doc) {
  for (const [sectionKey, tableKey] of [['representations-qualifiers', 'representations-qualifiers-table'], ['parent-representations-qualifiers', 'parent-representations-qualifiers-table']]) {
    const table = findTable(findSection(doc, sectionKey), tableKey);
    table.rows_are = 'fixed list';
    table.fixed_row_labels = [...REP_ROWS];
    table.fixed_row_labels_source = 'TopBuild print pp.17-19, Representations & Warranties rows (legacy vocabulary)';
    table.open_rows = true;
    table.guidance = 'row_label is the representation as the precedent names it (one of fixed_row_labels); add a new row label only for a representation none of them covers (for example a regulatory or FDA representation). Each limb of a representation is a sub-item: set row_detail to the limb\'s own subject (for example "Company Subsidiaries: organization and good standing") so the page shows it under its representation, whose line gives the overview. The bringdown column is never filled from a representation: it comes from the closing conditions.';
    const bringdown = findColumn(table, 'bringdown');
    bringdown.derived = { from_family: 'CLOSING_CONDITIONS', from_column: 'standard', join: 'cross_reference' };
    bringdown.guidance = 'Derived by the page from the CLOSING_CONDITIONS bring-down facts whose cross-references name this representation. Never coded from the representation itself.';
  }
}

// Ben, 2026-09-13 19:00 UTC, on the general covenants table showing the
// access covenant as a row per grammatical subject with its verbs in two
// columns: "this is the access covenant....". The legacy "Other Covenants"
// was a link index, so nothing to harvest: the table is redesigned as one
// row per covenant (the V2 subtypes, open to a new name), with the obligor,
// the standard, the scope and the exceptions coded per covenant; a limb is
// a sub-item.
const GENERAL_COVENANT_ROWS = [
  'Access to information', 'Litigation notification', 'General notification', 'Section 16 matters', 'Stock exchange delisting',
  'Takeover laws', 'Merger Sub obligations', 'Public announcements', 'Resignations', 'CVR Agreement', 'Stock exchange listing',
  'Confidentiality', 'Transaction litigation', 'Financing cooperation', 'Director and officer indemnification',
];
function applyDecision21GeneralCovenants(doc) {
  const section = findSection(doc, 'general-covenants');
  const why = `${BEN} #21 (Metsera 6.07): a covenant reads as obligor, standard, scope and exceptions, never as its grammatical subjects and verbs.`;
  section.tables = [{
    table_key: 'general-covenants-table',
    group_header: null,
    term_column: { header: 'Covenant', source: 'subject', fill_from: ['TERM'] },
    columns: [
      {
        column_id: 'obligor', header: 'Obligor', render: 'vocabulary',
        vocabulary: [
          addition('Company', `${why} The Company (and its subsidiaries) is bound.`, { code: 'COMPANY' }),
          addition('Parent', `${why} Parent (and Merger Sub) is bound.`, { code: 'PARENT' }),
          addition('Each party', `${why} A mutual covenant.`, { code: 'EACH_PARTY' }),
        ],
        fill_from: ['ACTOR'],
      },
      { column_id: 'standard', header: 'Standard', render: 'verbatim', fill_from: ['EFFORTS_STANDARD', 'STANDARD', 'QUALIFIER', 'OPERATION'], addition: true, reason: `${why} The effort or conduct standard (reasonable access during normal business hours; commercially reasonable efforts; promptly).` },
      { column_id: 'scope', header: 'Scope', render: 'verbatim', fill_from: ['OBJECT', 'LIST', 'LITANY'], addition: true, reason: `${why} What is given, done or notified (properties, books, records and personnel; any Proceeding).` },
      { column_id: 'exceptions', header: 'Exceptions', render: 'verbatim', fill_from: ['EXCEPTION', 'CONDITION', 'QUALIFIER'], addition: true, reason: `${why} The carve-outs (privilege, confidentiality obligations, applicable Law, unreasonable interference).` },
    ],
    rows_are: 'fixed list',
    fixed_row_labels: [...GENERAL_COVENANT_ROWS],
    fixed_row_labels_source: 'LEGAL_SCHEMA/V2 GENERAL_COVENANTS subtypes plus the covenants the legacy Other Covenants index curated (financing cooperation, D&O indemnification, confidentiality, transaction litigation)',
    open_rows: true,
    // Ben, 2026-09-13 19:30 UTC: "the covenant column needs to give a
    // description of the type of covenant". The row is derived from the
    // fact's subtype (fixed by the schema), never from the words the model
    // chose as a subject; a model row label that differs becomes the
    // sub-item under that covenant.
    row_from_subtype: true,
    subtype_rows: {
      ACCESS: 'Access to information', LITIGATION_NOTIFICATION: 'Litigation notification', GENERAL_NOTIFICATION: 'General notification',
      SECTION_16: 'Section 16 matters', DELISTING: 'Stock exchange delisting', TAKEOVER_LAW: 'Takeover laws',
      MERGER_SUB_OBLIGATION: 'Merger Sub obligations', PUBLICITY: 'Public announcements', RESIGNATION: 'Resignations',
      CVR: 'CVR Agreement', LISTING: 'Stock exchange listing',
    },
    guidance: 'One row per covenant, named as the precedent would (fixed_row_labels), with a new name only when none fits. Each limb of a covenant is a sub-item (row_detail) with the same columns; the covenant\'s line gives the overview. The subject of the row is the covenant, never a party or a pronoun; the obligor is a coded cell.',
  }];
}

// Ben, 2026-09-13 19:10 UTC, on the employee benefits table (a row per
// grammatical subject, the comp covenant's benefit list as pills in the
// reference-group column): "this is also garbage - look at the precedent -
// we should be showing rows for each type of instrument vs standard and
// period and then for things that don't fit that rubric a simple 2 column
// table". The main table keeps the precedent's rows (one per benefit
// element) and its comparison / standard / period columns, with guidance
// that a covenant listing several elements yields one readout per element;
// everything else goes to a two-column Term / Provision table.
function applyDecision22EmployeeBenefits(doc) {
  const section = findSection(doc, 'employee-benefits');
  const main = findTable(section, 'employee-benefits-table');
  main.open_rows = true;
  main.guidance = 'One row per benefit element (the precedent\'s rows); a compensation covenant that lists several elements ("base salary, target cash incentive opportunities, equity opportunities and other benefits") yields one readout per element it names, each with the comparison group, the standard and the protection period, never one row for the whole list. A new row label only for an element none of the rows covers. Anything that is not a benefit element (plan amendment disclaimers, no third-party beneficiaries, no right to employment, service crediting exclusions) belongs to employee-benefits-other-protections.';
  const other = findTable(section, 'employee-benefits-other-protections');
  other.term_column = { header: 'Term', source: 'subject', fill_from: ['TERM'] };
  other.columns = [
    { column_id: 'provision', header: 'Provision', render: 'verbatim', fill_from: ['OPERATION', 'OBJECT', 'STANDARD', 'CONDITION', 'EXCEPTION'], addition: true, reason: `${BEN} #22: a simple two-column table for what does not fit the benefit-element rubric.` },
  ];
  other.fixed_row_labels = [...other.fixed_row_labels, 'No plan amendment', 'No third-party beneficiaries', 'No right to continued employment', 'Duplication of benefits'];
  other.open_rows = true;
  other.guidance = 'Term / Provision: one row per protection or disclaimer that is not a benefit element, named as the precedent would; the provision cell carries the operative words.';
}

// Ben, 2026-09-13 19:20 UTC: "you have a termination right under approvals.
// And then the votes section looks awful. And then so does the meeting
// section...just doesn't make sense". The legacy Approvals / Votes section
// mapped to TERMINATION (a harvest artefact; termination has its own
// section) and the SEC-meeting section had no printed shape, only a
// subject / signals / detail list. Both are removed; the print's Votes /
// Approvals / SEC Filing / Meeting Requirements table (p.114) is the one
// votes table, with the anchor of each period ("after mailing") and a
// detail column added, and a two-column Proxy statement & SEC table for the
// proxy and SEC facts.
function applyDecision23VotesAndMeeting(doc) {
  removeSection(doc, 'approvals-votes');
  removeSection(doc, 'sec-meeting');
  const section = findSection(doc, 'votes-approvals-meeting');
  const votes = findTable(section, 'votes-approvals-meeting-table');
  const why = `${BEN} #23 (Metsera): the votes and meeting section reads as the print's table, one line per requirement.`;
  const valueColumn = findColumn(votes, 'value');
  valueColumn.header = 'Period';
  valueColumn.fill_from = ['PERIOD', 'THRESHOLD', 'TRIGGER'];
  votes.columns = [
    findColumn(votes, 'voteStandard'),
    valueColumn,
    { column_id: 'anchor', header: 'After', render: 'verbatim', fill_from: ['TRIGGER', 'CONDITION', 'PERIOD'], addition: true, reason: `${why} The print shows each period with its anchor ("after mailing", "after effectiveness").` },
    { column_id: 'detail', header: 'Detail', render: 'verbatim', fill_from: ['OPERATION', 'OBJECT', 'QUALIFIER', 'STANDARD'], addition: true, reason: `${why} The print's Parent / Merger Sub approvals row is a sentence ("Merger Sub stockholders adopt by written consent").` },
    findColumn(votes, 'requirement'),
  ];
  votes.open_rows = true;
  votes.guidance = 'One line per requirement as the print names it: the stockholder approval and its vote standard; Parent / Merger Sub approvals; the proxy filing deadline, mailing and meeting each as a period with its anchor; record date and broker search as present or absent. A new row only for a requirement none covers.';
  const adjournment = findTable(section, 'votes-approvals-meeting-adjournment');
  adjournment.guidance = 'One row per party that may adjourn, with the permitted reasons, the controlling party and the restriction (how many times, how long, whose consent).';
  section.tables.push({
    table_key: 'votes-proxy-sec',
    group_header: 'PROXY STATEMENT & SEC',
    term_column: { header: 'Term', source: 'subject', fill_from: ['TERM'] },
    columns: [
      {
        column_id: 'who', header: 'Who', render: 'vocabulary',
        vocabulary: [
          addition('Company', `${why} The Company acts.`, { code: 'COMPANY' }),
          addition('Parent', `${why} Parent acts.`, { code: 'PARENT' }),
          addition('Each party', `${why} Both act or cooperate.`, { code: 'EACH_PARTY' }),
        ],
        fill_from: ['ACTOR'],
      },
      { column_id: 'provision', header: 'Provision', render: 'verbatim', fill_from: ['OPERATION', 'OBJECT', 'STANDARD', 'EFFORTS_STANDARD', 'CONDITION'], addition: true, reason: `${why} The operative words of the proxy or SEC step.` },
    ],
    rows_are: 'fixed list',
    fixed_row_labels: ['Proxy statement filing', 'Parent review and comment', 'SEC comments and correspondence', 'Amendment or supplement', 'Board recommendation in proxy', 'Solicitation of approval', 'Information supplied'],
    open_rows: true,
    subtype_keys: ['DOCUMENT_FILING', 'RECOMMENDATION_INCLUSION', 'MEETING_CALL_OR_HOLD'],
    guidance: 'Term / Provision for the proxy statement and SEC steps: one row per step as named, the party in the Who column, the operative words in Provision. Never a row per grammatical subject.',
  });
}

// Ben, 2026-09-13 19:40 UTC, on the buyer's conditions table: "(i) the
// titles of the reps, not their x-refs should be included, (ii) where is
// cov compliance, (iii) the Materiality Qualifiers Disregarded should be
// shown per row of reps and we should put row lines in there to clearly
// separate". The print (p.115) shows each bring-down tier as its own line
// with "Section 3.1(a) (Organization, Good Standing and Qualification)".
function linkMaeCodesToDefinition(doc) {
  const visit = (vocabulary) => {
    for (const entry of vocabulary || []) {
      if (/(^|_)MAE(_|$)/.test(entry.code) && !entry.links_to_section) entry.links_to_section = 'mae-definitions';
    }
  };
  for (const vocabulary of Object.values(doc.shared_vocabularies || {})) visit(vocabulary);
  for (const section of doc.sections) for (const table of section.tables || []) for (const column of table.columns || []) visit(column.vocabulary);
}

function applyDecision24ConditionTiers(doc) {
  linkMaeCodesToDefinition(doc);
  for (const [sectionKey, tableKey] of [['conditions-b', 'conditions-b-table'], ['conditions-s', 'conditions-s-table']]) {
    const table = findTable(findSection(doc, sectionKey), tableKey);
    if (!table.fixed_row_labels.includes('Performance of Covenants')) {
      table.fixed_row_labels.splice(1, 0, 'Performance of Covenants');
      table.additional_row_reasons = { ...(table.additional_row_reasons || {}), 'Performance of Covenants': `${BEN} #24: "where is cov compliance" -- the covenant performance condition is a row of its own.` };
    }
    const reference = findColumn(table, 'reference');
    reference.header = 'Representations covered';
    reference.display = 'resolved_reference';
    reference.guidance = 'Shown as the representation\'s title from the resolved cross-reference ("Section 3.01 (Organization, Standing and Corporate Power)"), never the bare section number.';
    table.sub_row_from_column = 'standard';
    table.guidance = 'One line per bring-down tier under Accuracy of Representations (each tier is a fact with its standard, the representations it covers as resolved CROSS_REFERENCE components, and whether materiality qualifiers are disregarded); the covenant performance condition, the no-MAE condition and the officer\'s certificate are rows of their own.';
  }
}

// ==========================================================================
// Decision 25 (MAE section). Ben, 2026-09-13, on the rendered Metsera MAE
// section: "if there is no MAE for parent just say none. And in the carve
// outs column we need to use generic titles. And the disproportionate carve
// out must say yes or no. Then we should show how the disproportionate carve
// out is drafted at the bottom of the table". Each is a rule over the
// shapes, applied the same way on every agreement:
//   (a) the definitions table keeps its fixed Parent / Company rows and a
//       row with no definition fact renders as "None" (absent_row_label);
//   (b) the carve-out tables become fixed lists of the generic carve-out
//       titles (the corpus taxonomy MAE_CARVEOUT_CODES, which contains the
//       print's ten), open to a new title when none fits, with the
//       carve-out's words in a verbatim column beside the title;
//   (c) the carve-back column says Yes or No and nothing else: a carve-out
//       row whose readout leaves it blank renders No (absent_code);
//   (d) the disproportionality carve-back fact is the table's footer
//       (footer_from_subtype), showing how it is drafted, never a row.
// ==========================================================================

const MAE_CARVEOUT_ROWS = [
  'General economic conditions',
  'Industry-wide conditions',
  'Financial / capital / credit market conditions',
  'Acts of war, armed hostilities, or terrorism',
  'Natural disasters or acts of God',
  'Pandemic / epidemic / public health crisis',
  'Announcement or pendency of the transaction',
  'Compliance with the terms of this Agreement',
  'Actions taken at the request or with consent of Parent',
  'Changes in applicable law or regulation',
  'Changes in GAAP or accounting principles',
  'Changes in the trading price or volume of stock',
  'Failure to meet internal projections or forecasts',
  'Most-favored-nation pricing actions',
  'Executive orders / sanctions / tariffs',
  'Tariffs / trade barriers',
  'Government shutdowns / civil unrest',
  'Clinical trial results (life sciences)',
  'FDA discussions or correspondence (life sciences)',
  'FDA approvals of competitor products / competitor entry',
  'Supply chain disruptions',
  'Pricing / reimbursement changes (healthcare)',
  'Statements by medical / scientific organizations',
  'Patent expirations / loss of exclusivity',
  'Acts or omissions of Parent / Buyer',
  'Loss of employees or executive departures',
  'Other carve-out',
];

function applyDecision25MaeSection(doc) {
  const section = findSection(doc, 'mae-definitions');
  const definitions = findTable(section, 'mae-definitions-table');
  definitions.absent_row_label = 'None';
  definitions.guidance = 'One row per party: the DEFINITION_PRONG fact defining that party\'s Material Adverse Effect, its operative test in the Test column. A party with no MAE definition in the agreement has no fact and the row shows "None"; never code a definition from the other party\'s.';
  section.no_conclusions_subtype_keys = [...new Set([...(section.no_conclusions_subtype_keys || []), 'DEFINITION_INSTANCE', 'UNDERLYING_CAUSE_RESTORATION'])];
  for (const [tableKey, party] of [['mae-carveouts-parent', 'Parent'], ['mae-carveouts-company', 'the Company']]) {
    const table = findTable(section, tableKey);
    table.rows_are = 'fixed list';
    table.fixed_row_labels = [...MAE_CARVEOUT_ROWS];
    table.open_rows = true;
    table.subtype_keys = ['EXCLUSION', 'DISPROPORTIONALITY_CARVEBACK'];
    table.term_column.header = 'Carve-out';
    table.columns = [
      {
        column_id: 'provision',
        header: 'As drafted',
        render: 'verbatim',
        fill_from: ['LIST_ELEMENT', 'OPERATION', 'LIST'],
      },
      {
        column_id: 'disproportionateCarveback',
        header: 'Disproportionate Carveback',
        render: 'vocabulary',
        vocabulary: [
          { code: 'YES', label: 'Yes', tone: 'neutral', source: 'print', print_evidence: { page: 77, row_label: 'Changes in GAAP or accounting principles' } },
          { code: 'NO', label: 'No', tone: 'neutral', addition: true, reason: `${BEN} #25: "the disproportionate carve out must say yes or no" -- the print's "Not established" is not an answer.` },
        ],
        absent_code: 'NO',
        fill_from: ['STANDARD', 'CROSS_REFERENCE'],
      },
    ];
    table.footer_from_subtype = { subtype_key: 'DISPROPORTIONALITY_CARVEBACK', label: 'Disproportionate carve-back as drafted' };
    table.guidance = `Carve-outs from ${party}'s Material Adverse Effect: one row per EXCLUSION fact, row_label the generic title from fixed_row_labels that names the carve-out's subject (a new generic title only when none fits, never the agreement's own words), the carve-out's words in the provision column, and disproportionateCarveback YES only when the disproportionality carve-back applies to this carve-out (cite the CROSS_REFERENCE that names it), otherwise NO. The DISPROPORTIONALITY_CARVEBACK fact goes to this table with row_label "Disproportionate carve-back" and its words in the provision column; the page shows it under the table, never as a row.`;
  }
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
  applyDecision19EquityAwardClasses(doc);
  applyDecision20RepresentationRows(doc);
  applyDecision21GeneralCovenants(doc);
  applyDecision22EmployeeBenefits(doc);
  applyDecision23VotesAndMeeting(doc);
  applyDecision24ConditionTiers(doc);
  applyDecision25MaeSection(doc);
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
