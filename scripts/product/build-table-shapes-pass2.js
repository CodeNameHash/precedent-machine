#!/usr/bin/env node
'use strict';

// Pass 2 of 5B.8 (docs/core/CODEBASE-GUIDE.md "Layered fact model, V2"; plan
// entry 5B.8). Reads contracts/product/table-shapes.v1.json (the first pass'
// static harvest of components/review/table-configs/, which got sections and
// headers right but left most columns 'verbatim' because the legacy code
// composes pills inside render functions -- see build-table-shapes.js's own
// header) and layers in the vocabulary actually shown on Ben's printed
// TopBuild review page (fixtures/product/topbuild-review/print-text.v1.json)
// plus the label maps pass 1 never opened (lib/employee-benefits.js,
// components/review/table-configs/{fiduciary-standard-labels,vote-standard,
// board-change-standard}.js). Writes contracts/product/table-shapes.v2.json.
//
// DESIGN DECISION on how the print is harvested: the print is OCR-flattened
// text, not markup -- two adjacent lines can be a label then its value, or
// two pills in the same cell, or a wrapped sentence, with no structural cue
// in the text itself to tell them apart (page 114's "Proxy filing deadline /
// 30 / business days / after / agreement date" is one composed pill split
// across five lines by the renderer, not five rows). A generic line-grouping
// parser cannot recover that structure reliably. So this script, like pass
// 1's own bespoke-per-file extraction, encodes each table's vocabulary as
// literal data (read off the print by a person, not inferred by a heuristic)
// -- but every print-sourced vocabulary entry is passed through assertOnPage
// below, which throws unless the exact label text is found verbatim on the
// cited page of the COMMITTED print-text.v1.json fixture. That is the
// generator's actual guarantee: not "this script parsed the print", but "no
// vocabulary label can be committed here that does not literally appear on
// the page it claims to come from" -- the same never-invent guarantee pass 1
// gave a different way. Re-running this script against an unchanged fixture
// and unchanged legacy label files is deterministic (no dates, no randomness,
// no network) and produces byte-identical output, which is what
// tests/product-table-shapes.test.js's determinism check requires.
//
// Legacy labels maps (FIDUCIARY_STANDARD_LABELS, BOARD_CHANGE_STANDARD_LABELS,
// voteStandard()'s literal returns, lib/employee-benefits.js's
// COMP_ITEM_LABELS/COMP_ITEM_ORDER) are harvested the same way pass 1
// harvested table-configs -- static AST parsing, never require()/execute --
// because they are ES modules (`export const` / `import`) that this plain
// Node script cannot require() directly, and because pass 1 already
// established that discipline for this exact directory.

const fs = require('node:fs');
const path = require('node:path');
const parser = require('next/dist/compiled/babel/parser');
const traverseModule = require('next/dist/compiled/babel/traverse');
const traverse = traverseModule.default || traverseModule;

const ROOT = path.join(__dirname, '..', '..');
const PASS1_PATH = path.join(ROOT, 'contracts/product/table-shapes.v1.json');
const PRINT_PATH = path.join(ROOT, 'fixtures/product/topbuild-review/print-text.v1.json');
const OUT_PATH = path.join(ROOT, 'contracts/product/table-shapes.v2.json');
const LEGAL_SCHEMA_PATH = path.join(ROOT, 'contracts/product/legal-schema.v2.json');
const FACT_COMPONENTS_PATH = path.join(ROOT, 'contracts/product/fact-components.v2.json');
const CONFIG_DIR = path.join(ROOT, 'components/review/table-configs');
const EMPLOYEE_BENEFITS_LIB = path.join(ROOT, 'lib/employee-benefits.js');

// --------------------------------------------------------------------------
// Small AST helpers (subset of build-table-shapes.js's own -- kept local
// rather than imported so pass 1 stays untouched and independently
// reproducible per the task's instruction).
// --------------------------------------------------------------------------

function parseAst(src) {
  return parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
}

function strOf(node) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked).join('');
  }
  return null;
}

function keyName(prop) {
  if (!prop.key) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'StringLiteral') return prop.key.value;
  return null;
}

function collectTopLevel(ast) {
  const consts = new Map();
  const funcs = new Map();
  for (const stmt of ast.program.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type !== 'Identifier' || !decl.init) continue;
        consts.set(decl.id.name, decl.init);
        if (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') {
          funcs.set(decl.id.name, decl.init);
        }
      }
    } else if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) {
      const d = stmt.declaration;
      if (d.type === 'VariableDeclaration') {
        for (const decl of d.declarations) {
          if (decl.id.type !== 'Identifier' || !decl.init) continue;
          consts.set(decl.id.name, decl.init);
          if (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') {
            funcs.set(decl.id.name, decl.init);
          }
        }
      } else if (d.type === 'FunctionDeclaration' && d.id) {
        funcs.set(d.id.name, d);
      }
    } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      funcs.set(stmt.id.name, stmt);
    }
  }
  return { consts, funcs };
}

function objectLiteralToStringMap(node) {
  const out = {};
  if (!node || node.type !== 'ObjectExpression') return out;
  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    const code = keyName(prop);
    const value = strOf(prop.value);
    if (code && value !== null) out[code] = value;
  }
  return out;
}

function arrayLiteralOfStrings(node) {
  if (!node || node.type !== 'ArrayExpression') return [];
  return node.elements.map((el) => strOf(el)).filter((s) => s !== null);
}

// A classifier function whose body is a flat if/return chain of string
// literals is itself a vocabulary source (same structural test pass 1's
// harvestClassifierLabelFns uses) -- used here for vote-standard.js's
// voteStandard().
function literalReturnsOf(fn) {
  const labels = [];
  if (!fn || fn.body.type !== 'BlockStatement') return labels;
  for (const stmt of fn.body.body) {
    let consequentReturn = null;
    if (stmt.type === 'IfStatement') {
      const cons = stmt.consequent;
      if (cons.type === 'ReturnStatement') consequentReturn = cons;
      else if (cons.type === 'BlockStatement' && cons.body.length === 1 && cons.body[0].type === 'ReturnStatement') consequentReturn = cons.body[0];
    }
    if (!consequentReturn || !consequentReturn.argument) continue;
    const str = strOf(consequentReturn.argument);
    if (str !== null) labels.push(str);
  }
  return labels;
}

function readSrc(absPath) {
  return fs.readFileSync(absPath, 'utf8');
}

// --------------------------------------------------------------------------
// Legacy label-map harvest (the maps pass 1 never opened).
// --------------------------------------------------------------------------

function harvestLegacyMaps() {
  const fiduciarySrc = readSrc(path.join(CONFIG_DIR, 'fiduciary-standard-labels.js'));
  const fiduciaryAst = parseAst(fiduciarySrc);
  const { consts: fConsts } = collectTopLevel(fiduciaryAst);
  const fiduciaryLabels = Object.values(objectLiteralToStringMap(fConsts.get('FIDUCIARY_STANDARD_LABELS')));

  const boardSrc = readSrc(path.join(CONFIG_DIR, 'board-change-standard.js'));
  const boardAst = parseAst(boardSrc);
  const { consts: bConsts } = collectTopLevel(boardAst);
  const boardChangeLabels = Object.values(objectLiteralToStringMap(bConsts.get('BOARD_CHANGE_STANDARD_LABELS')));

  const voteSrc = readSrc(path.join(CONFIG_DIR, 'vote-standard.js'));
  const voteAst = parseAst(voteSrc);
  const { funcs: vFuncs } = collectTopLevel(voteAst);
  const voteStandardLabels = literalReturnsOf(vFuncs.get('voteStandard'));

  const ebSrc = readSrc(EMPLOYEE_BENEFITS_LIB);
  const ebAst = parseAst(ebSrc);
  const { consts: ebConsts } = collectTopLevel(ebAst);
  const compItemLabels = objectLiteralToStringMap(ebConsts.get('COMP_ITEM_LABELS'));
  const compItemOrder = arrayLiteralOfStrings(ebConsts.get('COMP_ITEM_ORDER'));

  const iocSrc = readSrc(path.join(CONFIG_DIR, 'ioc-exceptions.config.js'));
  const iocAst = parseAst(iocSrc);
  const { consts: iocConsts } = collectTopLevel(iocAst);
  // FRAGMENT_NAME_PATTERNS: [{ test: /regex/, label: 'string' }, ...] -- pull
  // the label strings only (the regex tests are extraction logic, not shown
  // vocabulary).
  const fragmentLabels = [];
  const fragNode = iocConsts.get('FRAGMENT_NAME_PATTERNS');
  if (fragNode && fragNode.type === 'ArrayExpression') {
    for (const el of fragNode.elements) {
      if (!el || el.type !== 'ObjectExpression') continue;
      const labelProp = el.properties.find((p) => p.type === 'ObjectProperty' && keyName(p) === 'label');
      const label = labelProp && strOf(labelProp.value);
      if (label) fragmentLabels.push(label);
    }
  }

  if (!fiduciaryLabels.length || !boardChangeLabels.length || voteStandardLabels.length < 3
    || !Object.keys(compItemLabels).length || !compItemOrder.length || !fragmentLabels.length) {
    throw new Error('LEGACY_MAP_HARVEST_EMPTY: one of the expected legacy label maps harvested no entries -- the source file shape has likely changed');
  }

  return { fiduciaryLabels, boardChangeLabels, voteStandardLabels, compItemLabels, compItemOrder, fragmentLabels };
}

// --------------------------------------------------------------------------
// Print fixture load + the never-invent guarantee: every print-sourced
// vocabulary label is asserted, at generation time, to appear verbatim on
// the page it cites in the committed fixture.
// --------------------------------------------------------------------------

function loadPrint() {
  const doc = JSON.parse(fs.readFileSync(PRINT_PATH, 'utf8'));
  const byPage = new Map(doc.pages.map((p) => [p.page, p.text]));
  return byPage;
}

// The print fixture wraps a single printed pill's text across several text
// lines (the extraction is line-per-visual-fragment, not line-per-sentence),
// so "verbatim" here means verbatim modulo whitespace: every run of
// whitespace (including newlines) collapses to one space before comparison.
// This never lets a label be invented -- it only lets a label that IS on the
// page match regardless of where the PDF extractor happened to wrap it.
function normalizeWhitespace(s) {
  return String(s)
    // A trailing hyphen at a PDF line wrap ("pre-\nclosing") is the SAME word
    // ("pre-closing"), not "pre- closing" -- join it with no space before
    // collapsing the rest of the whitespace normally.
    .replace(/-\s*\n\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertOnPage(byPage, page, label, where) {
  const text = byPage.get(page);
  if (text === undefined) throw new Error(`PRINT_PAGE_NOT_FOUND ${where}: page ${page} does not exist in the print fixture`);
  if (!normalizeWhitespace(text).includes(normalizeWhitespace(label))) {
    throw new Error(`PRINT_LABEL_NOT_ON_PAGE ${where}: "${label}" not found verbatim (modulo whitespace) on page ${page} of the print fixture`);
  }
}

function slug(label) {
  return String(label || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'CODE';
}

let PRINT_PAGES;

// Builds one print-sourced vocabulary entry, verified against the fixture.
function P(label, { page, row, tone = 'neutral', code } = {}) {
  if (!page || !row) throw new Error(`PRINT_EVIDENCE_REQUIRED for "${label}"`);
  assertOnPage(PRINT_PAGES, page, label, `vocabulary "${label}"`);
  return { code: code || slug(label), label, tone, source: 'print', print_evidence: { page, row_label: row } };
}

// A legacy-map-sourced vocabulary entry (no print_evidence: it comes from
// code, not from this one printed deal).
function L(label, { tone = 'neutral', code } = {}) {
  return { code: code || slug(label), label, tone, source: 'legacy_map' };
}

// A vocabulary entry the print AND a legacy map both attest to (same label
// text). Still requires print evidence (source 'both' means "seen in both
// places", not "seen in only one").
function B(label, { page, row, tone = 'neutral', code } = {}) {
  const entry = P(label, { page, row, tone, code });
  entry.source = 'both';
  return entry;
}

function addition(label, reason, { tone = 'neutral', code } = {}) {
  return { code: code || slug(label), label, tone, addition: true, reason };
}

// --------------------------------------------------------------------------
// fill_from: maps a column (by header/id) to FACT_COMPONENTS/V2 kinds. Rule-
// based, in header-keyword-match order (first match wins) -- same posture as
// pass 1's classifyColumn. `term_column`s are always TERM; explicit per-
// column overrides win over the generic rules.
// --------------------------------------------------------------------------

const FILL_FROM_RULES = [
  [/reference group/i, ['OBJECT']],
  [/vote(d)? threshold|vote standard/i, ['STANDARD', 'PERCENTAGE']],
  [/threshold|amount|fee\b|\$/i, ['THRESHOLD', 'AMOUNT']],
  [/percentage|%/i, ['PERCENTAGE']],
  [/\bperiod\b|\bwindow\b|\btail\b|days?\b|months?\b|years?\b/i, ['PERIOD']],
  [/outside date|\bdate\b/i, ['DATE']],
  [/trigger/i, ['TRIGGER']],
  [/exception|carve-?out/i, ['EXCEPTION']],
  [/qualifier|materiality|bringdown|bring-down|standard/i, ['STANDARD', 'MATERIALITY_QUALIFIER']],
  [/efforts/i, ['EFFORTS_STANDARD']],
  [/controlling party|payer|party|exercised by|actor/i, ['ACTOR']],
  [/reference|cross-reference|link|see /i, ['CROSS_REFERENCE']],
  [/definition\b/i, ['DEFINED_TERM']],
  [/list|litany/i, ['LIST', 'LITANY']],
  [/condition|restriction|prohibited/i, ['CONDITION']],
];

const VALUE_KIND_FILL_FROM = {
  AMOUNT: ['THRESHOLD', 'AMOUNT'],
  PERCENTAGE: ['PERCENTAGE'],
  PERIOD: ['PERIOD'],
  DATE: ['DATE'],
  COUNT: ['AMOUNT'],
};

function fillFromFor(column, overrides) {
  if (overrides && overrides[column.column_id]) return overrides[column.column_id];
  // value_kind is a more precise signal than a header-keyword guess (a
  // "Cure Period End" DATE column should not fall into PERIOD just because
  // its header contains the word "Period") -- it wins first for a `value`
  // render column.
  if (column.render === 'value' && column.value_kind && VALUE_KIND_FILL_FROM[column.value_kind]) {
    return VALUE_KIND_FILL_FROM[column.value_kind];
  }
  const probe = `${column.column_id || ''} ${column.header || ''}`;
  for (const [re, kinds] of FILL_FROM_RULES) {
    if (re.test(probe)) return kinds;
  }
  if (column.render === 'vocabulary') return ['STANDARD'];
  if (column.render === 'boolean') return ['CONDITION'];
  return ['OPERATION'];
}

function applyFillFrom(doc, overridesByColumnId) {
  for (const section of doc.sections) {
    for (const table of section.tables) {
      if (table.term_column) table.term_column.fill_from = ['TERM'];
      for (const column of table.columns) {
        column.fill_from = fillFromFor(column, overridesByColumnId);
      }
    }
  }
}

// ==========================================================================
// Section-by-section pass 2 content. Every table below either (a) fully
// replaces a pass-1 table because the print showed real structure pass 1
// could not recover, or (b) is left out of this map entirely, in which case
// the pass-1 table is carried over unchanged (no print evidence found for
// it in this deal's print -- recorded as such in the Part 4 readout).
// ==========================================================================

function buildOverrides(legacy) {
  const { fiduciaryLabels, boardChangeLabels, voteStandardLabels, compItemLabels, compItemOrder, fragmentLabels } = legacy;

  // Vote-standard vocabulary (vote-standard.js, shared by conditions.config.js,
  // votes-approvals-meeting.config.js and termination-rights.config.js).
  const VOTE_STANDARD_VOCAB = voteStandardLabels.map((label) => L(label));

  // Fiduciary-out engagement-standard vocabulary (fiduciary-standard-labels.js).
  // Only 'Engagement standard (coded)' shows the coded label in full on page
  // 97 -- 'Engagement standard' itself is truncated on the print ("...
  // constitutes or could reasonably be expected to lead to a" then a "SEE
  // PROVISION" marker in place of the rest), so that one stays legacy_map
  // only rather than being claimed as verbatim print evidence for text the
  // print does not actually show in full.
  const FIDUCIARY_PRINT_ROWS = {
    'Constitutes or could lead to a Superior Proposal': 'Engagement standard (coded)',
  };
  const FIDUCIARY_STANDARD_VOCAB = fiduciaryLabels.map((label) => (
    FIDUCIARY_PRINT_ROWS[label] ? B(label, { page: 97, row: FIDUCIARY_PRINT_ROWS[label] }) : L(label)
  ));

  // Board-change-standard vocabulary (board-change-standard.js).
  const BOARD_CHANGE_VOCAB = boardChangeLabels.map((label) => L(label));

  // The four closing-condition bring-down tiers, exactly as printed (ALL
  // CAPS) on the Closing Conditions page (115-116) -- a different literal
  // rendering of the same four-tier concept as the "Bringdown: ..." pills on
  // the Representations pages; both are recorded verbatim, never unified.
  const CLOSING_BRINGDOWN_VOCAB = [
    P('TRUE IN ALL RESPECTS', { page: 115, row: 'Accuracy of Representations' }),
    P('TRUE EXCEPT FOR DE MINIMIS INACCURACIES', { page: 115, row: 'Accuracy of Representations' }),
    P('TRUE IN ALL MATERIAL RESPECTS', { page: 115, row: 'Accuracy of Representations' }),
    P('TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE', { page: 115, row: 'Accuracy of Representations' }),
  ];

  // The reps-table bring-down tiers, lower-case "Bringdown: X" pill text
  // (pages 17-19, 47-48) -- same four-tier concept, distinct print rendering.
  const REPS_BRINGDOWN_VOCAB = [
    P('Bringdown: In all respects', { page: 18, row: 'Absence of Certain Changes or Events' }),
    P('Bringdown: De minimis', { page: 17, row: 'Capitalization; Subsidiaries' }),
    P('Bringdown: In all material respects', { page: 17, row: 'Organization; Qualification; Standing' }),
    P('Bringdown: MAE', { page: 18, row: 'No Conflict; Required Filings and Consents' }),
  ];

  const REPS_QUALIFIERS_VOCAB = [
    P('MAE (aggregate) (partial)', { page: 17, row: 'Organization; Qualification; Standing' }),
    P('MAE (aggregate)', { page: 18, row: 'Litigation; Legal Proceedings' }),
    P('Material (to the rep) (partial)', { page: 17, row: 'Capitalization; Subsidiaries' }),
    P('Material (to the rep)', { page: 18, row: 'SEC Documents; Financial Statements' }),
    P('Knowledge-qualified (partial)', { page: 18, row: 'No Conflict; Required Filings and Consents' }),
    P('True in all material respects (partial)', { page: 19, row: 'Information Supplied / Proxy Statement' }),
  ];

  const overrides = {};

  // -- Structure & Mechanics (page 1) --------------------------------------
  overrides['structure-mechanics'] = {
    print_pages: [1],
    tables: [{
      table_key: 'structure-mechanics-table',
      group_header: null,
      term_column: { header: 'Term', source: 'subject' },
      columns: [
        {
          column_id: 'dealStructure',
          header: 'Deal Structure',
          render: 'vocabulary',
          vocabulary: [
            P('One Step Merger', { page: 1, row: 'Deal structure' }),
            addition('Two Step Merger', 'the print\'s Deal structure axis names only the value shown on this deal; V2 MERGER_STRUCTURE_CLOSING/TRANSACTION_STEP supports a two-step structure as the complementary code for cross-deal comparability.'),
          ],
        },
        {
          column_id: 'signals',
          header: 'Merger Form',
          render: 'vocabulary',
          vocabulary: [
            L('Forward merger'),
            L('Reverse triangular merger'),
            P('Reverse triangular merger', { page: 1, row: 'Merger form' }),
            P('Forward triangular merger', { page: 1, row: 'Merger form' }),
          ],
        },
        { column_id: 'closingLocation', header: 'Closing Location', render: 'verbatim' },
        { column_id: 'closingTiming', header: 'Closing Timing', render: 'verbatim' },
        { column_id: 'effectiveTime', header: 'Effective Time', render: 'verbatim' },
        {
          column_id: 'effectsOfMerger',
          header: 'Effects of Merger',
          render: 'vocabulary',
          vocabulary: [
            P('DGCL', { page: 1, row: 'Effects of merger', code: 'DGCL' }),
            P('DLLCA', { page: 1, row: 'Effects of merger', code: 'DLLCA' }),
          ],
        },
      ],
      rows_are: 'one per subject',
    }],
  };

  // -- Consideration (pages 4-5) -------------------------------------------
  overrides['consideration-hero'] = {
    print_pages: [4, 5],
    tables: [
      {
        table_key: 'consideration-hero-summary',
        group_header: null,
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'value', header: 'Value', render: 'value', value_kind: 'AMOUNT' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Cash Election', 'Stock Election'],
      },
      {
        table_key: 'consideration-hero-election-mechanics',
        group_header: 'ELECTION MECHANICS',
        term_column: null,
        columns: [
          { column_id: 'body', header: '', render: 'verbatim' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Election caps', 'Election deadline', 'Oversubscription / proration', 'If no election'],
      },
      {
        table_key: 'consideration-hero-table',
        group_header: null,
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          {
            column_id: 'considerationType',
            header: 'Detail',
            render: 'vocabulary',
            vocabulary: [
              P('Mixed election', { page: 5, row: 'Consideration type' }),
              addition('All-cash election', 'CONSIDERATION/ELECTION supports an all-cash deal with no stock election; not shown on this mixed-election deal but needed for the axis to be comparable across deals.'),
              addition('All-stock election', 'CONSIDERATION/ELECTION supports an all-stock deal with no cash election; same reasoning.'),
            ],
          },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Consideration type', 'Appraisal rights', 'Withholding'],
      },
    ],
  };

  // -- Equity Awards (pages 15-17): keep pass-1 vocabulary, add print
  // evidence, and mark cvrEntitlement's absence as an addition opportunity.
  overrides['equity-awards'] = {
    print_pages: [15, 16, 17],
    tables: [{
      table_key: 'equity-awards-table',
      group_header: null,
      term_column: { header: 'Equity Type', source: 'subject' },
      columns: [
        {
          column_id: 'consideration',
          header: 'Consideration',
          render: 'vocabulary',
          vocabulary: [
            B('Cash', { page: 15, row: 'Stock Options' }),
            B('Parent stock / rollover', { page: 15, row: 'RSUs' }),
            L('Cancelled — no consideration'),
          ],
        },
        {
          column_id: 'vestingTreatment',
          header: 'Vesting Treatment',
          render: 'vocabulary',
          vocabulary: [
            L('Cancelled — no consideration'),
            B('Continues vesting (double-trigger protection)', { page: 15, row: 'PSUs' }),
            L('Assumed by Parent'),
            L('Pro-rata acceleration'),
            L('Rollover into Parent award'),
            B('Fully vested (accelerated)', { page: 15, row: 'Restricted Stock Awards' }),
            B('Cancelled for cash consideration', { page: 15, row: 'Stock Options' }),
          ],
        },
        {
          column_id: 'cvrEntitlement',
          header: 'CVR Entitlement',
          render: 'vocabulary',
          vocabulary: [
            addition('Entitled', 'CONSIDERATION/CVR_COMPONENT supports a CVR entitlement carried through to converted equity awards; this deal shows no CVR (all four rows print "—"), so only the absent/entitled axis is proposed, not a label drawn from this print.'),
            addition('Not entitled', 'complement of the above; matches the "—" seen on every row of this deal\'s CVR Entitlement column.'),
          ],
        },
      ],
      rows_are: 'one per subject',
    }],
  };

  // -- Representations & Warranties (Company: 17-19; Parent: 47-48) -------
  const repsTable = (termHeader) => ({
    table_key: undefined, // filled per section below
    group_header: null,
    term_column: { header: termHeader, source: 'subject' },
    columns: [
      { column_id: 'bringdown', header: 'Bring-down Standard', render: 'vocabulary', vocabulary: REPS_BRINGDOWN_VOCAB },
      { column_id: 'materiality', header: 'Qualifiers', render: 'vocabulary', vocabulary: REPS_QUALIFIERS_VOCAB },
      { column_id: 'lookback', header: 'Lookback', render: 'verbatim' },
    ],
    rows_are: 'one per subject',
  });
  overrides['representations-qualifiers'] = {
    print_pages: [17, 18, 19],
    tables: [{ ...repsTable('Term'), table_key: 'representations-qualifiers-table' }],
  };
  overrides['parent-representations-qualifiers'] = {
    print_pages: [47, 48],
    tables: [{ ...repsTable('Term'), table_key: 'parent-representations-qualifiers-table' }],
  };

  // -- Material Adverse Effect (pages 66-84): definition + carve-outs -----
  const MAE_CARVEOUT_VOCAB = [
    P('Failure to meet internal projections or forecasts', { page: 77, row: 'Failure to meet internal projections or forecasts' }),
    P('Compliance with the terms of this Agreement', { page: 77, row: 'Compliance with the terms of this Agreement' }),
    P('Other carve-out', { page: 77, row: 'Other carve-out' }),
    P('Changes in GAAP or accounting principles', { page: 77, row: 'Changes in GAAP or accounting principles' }),
    P('Industry-wide conditions', { page: 78, row: 'Industry-wide conditions' }),
    P('Announcement or pendency of the transaction', { page: 78, row: 'Announcement or pendency of the transaction' }),
    P('General economic conditions', { page: 79, row: 'General economic conditions' }),
    P('Changes in the trading price or volume of stock', { page: 79, row: 'Changes in the trading price or volume of stock' }),
    P('Changes in applicable law or regulation', { page: 80, row: 'Changes in applicable law or regulation' }),
    P('Acts of war, armed hostilities, or terrorism', { page: 80, row: 'Acts of war, armed hostilities, or terrorism' }),
  ];
  const DISPROPORTIONATE_CARVEBACK_VOCAB = [
    P('Yes', { page: 77, row: 'Changes in GAAP or accounting principles', code: 'YES' }),
    P('Not established', { page: 77, row: 'Failure to meet internal projections or forecasts', code: 'NOT_ESTABLISHED' }),
  ];
  overrides['mae-definitions'] = {
    print_pages: [66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
    tables: [
      {
        table_key: 'mae-definitions-table',
        group_header: null,
        term_column: { header: 'Party', source: 'subject' },
        columns: [
          { column_id: 'test', header: 'Test', render: 'verbatim' },
          {
            column_id: 'limbSummary',
            header: 'Summary',
            render: 'vocabulary',
            vocabulary: [P('One limb — effect on the business, condition or results of operations', { page: 67, row: 'Parent' })],
          },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Parent', 'Company'],
      },
      {
        table_key: 'mae-carveouts-parent',
        group_header: 'CARVE-OUTS — PARENT',
        term_column: { header: 'Carve-out', source: 'subject' },
        columns: [
          { column_id: 'disproportionateCarveback', header: 'Disproportionate Carveback', render: 'vocabulary', vocabulary: DISPROPORTIONATE_CARVEBACK_VOCAB },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: MAE_CARVEOUT_VOCAB.map((v) => v.label),
      },
      {
        table_key: 'mae-carveouts-company',
        group_header: 'CARVE-OUTS — COMPANY',
        term_column: { header: 'Carve-out', source: 'subject' },
        columns: [
          { column_id: 'disproportionateCarveback', header: 'Disproportionate Carveback', render: 'vocabulary', vocabulary: DISPROPORTIONATE_CARVEBACK_VOCAB },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: MAE_CARVEOUT_VOCAB.map((v) => v.label),
      },
    ],
  };

  // -- Material Contracts (pages 65-66) ------------------------------------
  const CONTRACT_TYPE_VOCAB = [
    P('M&A / acquisition agreements', { page: 65, row: 'M&A / acquisition agreements' }),
    P('Hedging and derivative contracts', { page: 65, row: 'Hedging and derivative contracts' }),
    P('Capital expenditure commitments', { page: 65, row: 'Capital expenditure commitments' }),
    P('Non-competition / non-solicitation agreements', { page: 65, row: 'Non-competition / non-solicitation agreements' }),
    P('Inbound IP licenses', { page: 65, row: 'Inbound IP licenses' }),
    P('Joint ventures / partnerships', { page: 65, row: 'Joint ventures / partnerships' }),
    P('Indebtedness contracts', { page: 65, row: 'Indebtedness contracts' }),
    P('Contracts above an aggregate-payments threshold', { page: 65, row: 'Contracts above an aggregate-payments threshold', code: 'AGGREGATE_PAYMENTS_THRESHOLD_10M_PER_ANNUM' }),
    P('Agreements with ROFO/ROFN', { page: 65, row: 'Agreements with ROFO/ROFN' }),
    P('Exclusivity / most-favored-nation / standstill', { page: 66, row: 'Exclusivity / most-favored-nation / standstill' }),
    P('M&A agreements with ongoing obligations', { page: 66, row: 'M&A agreements with ongoing obligations' }),
    P('Other material contracts', { page: 66, row: 'Other material contracts', code: 'OTHER_MATERIAL_CONTRACTS' }),
    P('Outbound IP licenses', { page: 66, row: 'Outbound IP licenses' }),
    P('Contracts above an aggregate-payments threshold', { page: 66, row: 'Contracts above an aggregate-payments threshold', code: 'AGGREGATE_PAYMENTS_THRESHOLD_10M', tone: 'info' }),
    P('Settlement / consent agreements', { page: 66, row: 'Settlement / consent agreements' }),
    P('SEC Item 601(b) contracts', { page: 66, row: 'SEC Item 601(b) contracts' }),
    P('Supplier agreements', { page: 66, row: 'Supplier agreements' }),
    P('Real estate leases', { page: 66, row: 'Real estate leases' }),
  ];
  const UNCOVERED_CONTRACT_BUCKET_VOCAB = [
    'Manufacturing agreements', 'Distribution / reseller agreements', 'Collaboration / R&D agreements',
    'Key employment / executive agreements', 'Government contracts', 'Affiliate / related-party transactions',
    'Data privacy / security agreements', 'Voting / registration-rights / stockholder agreements',
    'IP development contracts', 'Single source procurement contracts', 'Clinical research organization contracts',
    'Employee loans and advances',
  ].map((label) => P(label, { page: 66, row: label, tone: 'missing' }));
  overrides['material-contracts'] = {
    print_pages: [65, 66],
    tables: [{
      table_key: 'material-contracts-table',
      group_header: null,
      term_column: { header: 'Contract Type', source: 'subject' },
      columns: [
        { column_id: 'contractType', header: 'Contract Type', render: 'vocabulary', vocabulary: CONTRACT_TYPE_VOCAB },
        { column_id: 'threshold', header: 'Threshold', render: 'value', value_kind: 'AMOUNT' },
        {
          column_id: 'uncoveredBucket',
          header: 'Not Covered',
          render: 'vocabulary',
          vocabulary: UNCOVERED_CONTRACT_BUCKET_VOCAB,
        },
      ],
      rows_are: 'one per subject',
    }],
  };

  // -- Interim Operating Covenants (Target: 86-88; Parent: 94) -------------
  const IOC_EXCEPTION_VOCAB = [
    P('Ordinary course of business', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Other specific exception (see text)', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('As contemplated by this Agreement', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Existing credit facilities or indebtedness', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Transactions among wholly-owned subsidiaries', { page: 87, row: 'Issuance of Securities' }),
    P('Existing equity award exercises, vesting, or settlement', { page: 87, row: 'Issuance of Securities' }),
    P('Below monetary threshold', { page: 87, row: 'Capital Expenditures' }),
    P('Within budget / capex plan', { page: 87, row: 'Capital Expenditures' }),
    P('Below $10,000,000,', { page: 87, row: 'Commitments' }),
    P('Trade payables in ordinary course', { page: 87, row: 'Indebtedness' }),
    P('Intercompany transactions', { page: 87, row: 'Indebtedness' }),
    P('Below $10,000,000', { page: 87, row: 'Settlement of Claims', code: 'BELOW_10M_FLAT' }),
    P('As required by law', { page: 88, row: 'Accounting Changes' }),
    P('Pursuant to existing contracts as of signing', { page: 88, row: 'Compensation and Benefits' }),
    P('None specified', { page: 87, row: 'Charter / Bylaws Amendments' }),
  ];
  const IOC_RESTRICTION_CATEGORY_VOCAB = [
    P('Acquisitions / business combinations', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Merger / consolidation / liquidation / recapitalization', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Asset sales / divestitures / licenses', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Real estate / leases', { page: 87, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Capital expenditures', { page: 87, row: 'Capital Expenditures' }),
    P('Loans / advances / capital contributions', { page: 87, row: 'Commitments' }),
    P('Indebtedness / financing', { page: 87, row: 'Indebtedness' }),
    P('Guarantees / third-party obligations', { page: 87, row: 'Indebtedness' }),
  ];
  const IOC_AFFIRMATIVE_EFFORTS_VOCAB = [
    P('Commercially reasonable efforts', { page: 86, row: 'Maintain leases & material property' }),
  ];
  const IOC_AFFIRMATIVE_QUALIFIER_VOCAB = [
    P('Material items only', { page: 86, row: 'Maintain leases & material property' }),
    P('In all material respects', { page: 86, row: 'Conduct business in ordinary course' }),
  ];
  // Parent's own page (94) shows a smaller, distinct restriction/exception
  // set than the Target's (86-88) -- cited separately rather than reusing
  // the Target's page/row evidence for a Parent-section vocabulary claim.
  const PARENT_IOC_EFFORTS_VOCAB = [P('Commercially reasonable efforts', { page: 94, row: 'Maintain leases & material property' })];
  const PARENT_IOC_QUALIFIER_VOCAB = [
    P('Material items only', { page: 94, row: 'Maintain leases & material property' }),
    P('In all material respects', { page: 94, row: 'Conduct business in ordinary course' }),
  ];
  const PARENT_IOC_RESTRICTION_VOCAB = [
    P('Merger / consolidation / liquidation / recapitalization', { page: 94, row: 'Mergers, Acquisitions, Dispositions' }),
  ];
  const PARENT_IOC_EXCEPTION_VOCAB = [
    P('As contemplated by this Agreement', { page: 94, row: 'Mergers, Acquisitions, Dispositions' }),
    P('Transactions among wholly-owned subsidiaries', { page: 94, row: 'Issuance of Securities' }),
    P('Existing equity award exercises, vesting, or settlement', { page: 94, row: 'Issuance of Securities' }),
    P('Other specific exception (see text)', { page: 94, row: 'Issuance of Securities' }),
    P('Ordinary course of business', { page: 94, row: 'Dividends and Distributions' }),
    P('Tax withholding or similar mandated actions', { page: 94, row: 'Dividends and Distributions' }),
    P('None specified', { page: 94, row: 'Charter / Bylaws Amendments' }),
  ];

  const iocAffirmativeTable = (groupHeader, effortsVocab, qualifierVocab) => ({
    table_key: undefined,
    group_header: groupHeader,
    term_column: { header: 'Term', source: 'subject' },
    columns: [
      { column_id: 'body', header: 'Summary', render: 'verbatim' },
      { column_id: 'effortsStandard', header: 'Efforts Standard', render: 'vocabulary', vocabulary: effortsVocab },
      { column_id: 'qualifier', header: 'Qualifier', render: 'vocabulary', vocabulary: qualifierVocab },
    ],
    rows_are: 'fixed list',
    fixed_row_labels: [
      'Maintain leases & material property', 'Conduct business in ordinary course',
      'Preserve business organization & relationships', 'Maintain permits, franchises & authorizations',
    ],
  });
  const iocNegativeTable = (groupHeader, restrictionVocab, exceptionVocab) => ({
    table_key: undefined,
    group_header: groupHeader,
    term_column: { header: 'Term', source: 'subject' },
    columns: [
      { column_id: 'specificRestrictions', header: 'Specific Restrictions', render: 'vocabulary', vocabulary: restrictionVocab },
      { column_id: 'exceptions', header: 'Exceptions', render: 'vocabulary', vocabulary: exceptionVocab },
    ],
    rows_are: 'one per subject',
  });
  overrides['ioc-exceptions'] = {
    print_pages: [86, 87, 88],
    tables: [
      { ...iocAffirmativeTable('AFFIRMATIVE COVENANTS', IOC_AFFIRMATIVE_EFFORTS_VOCAB, IOC_AFFIRMATIVE_QUALIFIER_VOCAB), table_key: 'ioc-exceptions-affirmative-covenants' },
      { ...iocNegativeTable('NEGATIVE COVENANTS', IOC_RESTRICTION_CATEGORY_VOCAB, IOC_EXCEPTION_VOCAB), table_key: 'ioc-exceptions-negative-covenants' },
      {
        table_key: 'ioc-exceptions-exceptions',
        group_header: 'EXCEPTIONS',
        term_column: null,
        columns: [{ column_id: 'body', header: '', render: 'verbatim' }],
        rows_are: 'one per subject',
      },
      {
        table_key: 'ioc-exceptions-other-restrictions',
        group_header: 'OTHER RESTRICTIONS',
        term_column: null,
        columns: [
          { column_id: 'body', header: '', render: 'verbatim' },
          { column_id: 'fragmentName', header: 'Restriction', render: 'vocabulary', vocabulary: fragmentLabels.map((label) => L(label)) },
        ],
        rows_are: 'one per subject',
      },
    ],
  };
  overrides['parent-ioc-exceptions'] = {
    print_pages: [94],
    tables: [
      { ...iocAffirmativeTable('AFFIRMATIVE COVENANTS', PARENT_IOC_EFFORTS_VOCAB, PARENT_IOC_QUALIFIER_VOCAB), table_key: 'parent-ioc-exceptions-affirmative-covenants' },
      { ...iocNegativeTable('NEGATIVE COVENANTS', PARENT_IOC_RESTRICTION_VOCAB, PARENT_IOC_EXCEPTION_VOCAB), table_key: 'parent-ioc-exceptions-negative-covenants' },
      {
        table_key: 'parent-ioc-exceptions-exceptions',
        group_header: 'EXCEPTIONS',
        term_column: null,
        columns: [{ column_id: 'body', header: '', render: 'verbatim' }],
        rows_are: 'one per subject',
      },
      {
        table_key: 'parent-ioc-exceptions-other-restrictions',
        group_header: 'OTHER RESTRICTIONS',
        term_column: null,
        columns: [{ column_id: 'body', header: '', render: 'verbatim' }],
        rows_are: 'one per subject',
      },
    ],
  };

  // -- No-Solicitation / No-Shop (pages 97-99) -----------------------------
  // The print's own "No-shop / non-solicit restriction" row is ONE fused
  // litany sentence ("Solicit / initiate / knowingly encourage or facilitate
  // an Acquisition Proposal"), never per-verb pills -- so every verb here is
  // a Part-2 addition (FACT_COMPONENTS/V2 LITANY models the litany as one
  // component with `members`; a present/absent column per member is new
  // structure the old page never had, per Ben's "add to the table structure"
  // instruction), not a harvested vocabulary.
  const NOSHOP_LITANY_REASON = 'the print\'s "No-shop / non-solicit restriction" row is one fused litany sentence ("Solicit / initiate or knowingly encourage or facilitate ... an Acquisition Proposal"), never per-verb pills; FACT_COMPONENTS/V2 LITANY carries the litany\'s members, so a present/absent column per prohibited verb is new structure the old page lacked, per Ben\'s "add to the table structure" instruction.';
  const NOSHOP_PROHIBITED_VERBS = [
    addition('Solicit', NOSHOP_LITANY_REASON, { code: 'SOLICIT' }),
    addition('Initiate', NOSHOP_LITANY_REASON, { code: 'INITIATE' }),
    addition('Knowingly encourage', NOSHOP_LITANY_REASON, { code: 'KNOWINGLY_ENCOURAGE' }),
    addition('Facilitate', NOSHOP_LITANY_REASON, { code: 'FACILITATE' }),
  ];
  overrides['nosol-noshop'] = {
    print_pages: [97],
    tables: [
      {
        table_key: 'nosol-noshop-go-shop',
        group_header: 'GO-SHOP',
        term_column: { header: 'Term', source: 'subject' },
        columns: [{ column_id: 'goShop', header: 'Summary', render: 'vocabulary', vocabulary: [P('None', { page: 97, row: 'Go-shop' })] }],
        rows_are: 'fixed list',
        fixed_row_labels: ['Go-shop'],
      },
      {
        table_key: 'nosol-noshop-core-mechanics',
        group_header: 'NO-SHOP CORE MECHANICS',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'detail', header: 'Detail', render: 'verbatim' },
          {
            column_id: 'prohibitedVerb',
            header: 'Prohibited Verb',
            render: 'vocabulary',
            vocabulary: NOSHOP_PROHIBITED_VERBS,
          },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: [
          'Cease discussions', 'No-shop / non-solicit restriction', 'Representative control standard',
          'No-shop exceptions', "Don't-ask-don't-waive / standstill enforcement",
        ],
      },
      {
        table_key: 'nosol-noshop-notice',
        group_header: 'NOTICE',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'value', header: 'Value', render: 'value', value_kind: 'PERIOD' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Notice', 'Notice period', 'Notice content'],
      },
    ],
  };
  overrides['nosol-fiduciary'] = {
    print_pages: [97, 98],
    tables: [
      {
        table_key: 'nosol-fiduciary-table',
        group_header: 'FIDUCIARY-OUT / ENGAGEMENT',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'signals', header: 'Summary', render: 'vocabulary', vocabulary: FIDUCIARY_STANDARD_VOCAB },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Engagement standard', 'Final determination standard', 'Engagement standard (coded)'],
      },
      {
        table_key: 'nosol-fiduciary-change-of-recommendation',
        group_header: 'CHANGE OF RECOMMENDATION',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'value', header: 'Value', render: 'boolean' },
          {
            column_id: 'prohibitedAction',
            header: 'Prohibited Action',
            render: 'vocabulary',
            vocabulary: [
              P('Withhold / withdraw / qualify / modify the Board Recommendation adverse to Parent', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
              P('Fail to publicly reaffirm the Recommendation on request (within 10 business days)', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
              P('Approve / endorse / recommend / declare advisable a proposal', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
              P('Fail to include the Board Recommendation in the Proxy / 14D-9 / Info Statement', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
              P('Enter into an LOI / acquisition / merger agreement (other than an ACA)', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
              P('Fail to recommend against a tender / exchange offer within the required period (within 10 business days)', { page: 98, row: 'Change of Recommendation — prohibited actions' }),
            ],
          },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Board change right', 'Force the vote'],
      },
    ],
  };
  overrides['nosol-intervening'] = {
    print_pages: [98],
    tables: [{
      table_key: 'nosol-intervening-table',
      group_header: 'INTERVENING EVENT',
      term_column: { header: 'Term', source: 'subject' },
      columns: [
        { column_id: 'signals', header: 'Summary', render: 'boolean' },
        { column_id: 'detail', header: 'Detail', render: 'verbatim' },
      ],
      rows_are: 'fixed list',
      fixed_row_labels: ['Intervening Event provision', 'Definition', 'Scope', 'Exceptions', 'Termination right'],
    }],
  };
  overrides['nosol-superior'] = {
    print_pages: [97, 98],
    tables: [
      {
        table_key: 'nosol-superior-table',
        group_header: 'SUPERIOR PROPOSAL',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'signals', header: 'Summary', render: 'value', value_kind: 'PERCENTAGE' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Superior Proposal threshold', 'Superior Proposal test', 'Determiner'],
      },
      {
        table_key: 'nosol-superior-acquisition-proposal-definition',
        group_header: 'ACQUISITION PROPOSAL — DEFINITION',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'detail', header: 'Detail', render: 'verbatim' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Company Takeover Proposal', 'Acceptable Confidentiality Agreement'],
      },
      {
        table_key: 'nosol-superior-matching-rights',
        group_header: 'MATCHING RIGHTS',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'value', header: 'Value', render: 'value', value_kind: 'PERIOD' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Initial match period', 'Subsequent match period'],
      },
    ],
  };

  // -- Votes / Approvals / SEC Filing / Meeting Requirements (page 114) ---
  const PROXY_TRIGGER_VOCAB = [
    P('after agreement date', { page: 114, row: 'Proxy filing deadline', code: 'AFTER_AGREEMENT_DATE' }),
    P('after effectiveness', { page: 114, row: 'Mailing', code: 'AFTER_EFFECTIVENESS' }),
    P('after mailing', { page: 114, row: 'Meeting', code: 'AFTER_MAILING' }),
  ];
  const ADJOURNMENT_REASON_VOCAB = [
    P('Supplemental disclosure', { page: 114, row: 'Adjournment rights' }),
    P('Absence of quorum', { page: 114, row: 'Adjournment rights' }),
  ];
  const ADJOURNMENT_CONTROLLING_PARTY_VOCAB = [
    P('Company', { page: 114, row: 'Adjournment rights', code: 'COMPANY' }),
    P('Parent', { page: 114, row: 'Adjournment rights', code: 'PARENT' }),
  ];
  overrides['votes-approvals-meeting'] = {
    print_pages: [114],
    tables: [
      {
        table_key: 'votes-approvals-meeting-table',
        group_header: null,
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'voteStandard', header: 'Vote Standard', render: 'vocabulary', vocabulary: VOTE_STANDARD_VOCAB },
          { column_id: 'value', header: 'Value', render: 'value', value_kind: 'PERIOD', trigger: { vocabulary: PROXY_TRIGGER_VOCAB } },
          { column_id: 'requirement', header: 'Requirement', render: 'boolean' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: [
          'Company stockholder approval', 'Parent / Merger Sub approvals', 'Proxy filing deadline',
          'Mailing', 'Meeting', 'Meeting record date', 'Broker search',
        ],
      },
      {
        table_key: 'votes-approvals-meeting-adjournment',
        group_header: null,
        term_column: { header: 'Adjournment Rights', source: 'subject' },
        columns: [
          { column_id: 'permittedReason', header: 'Permitted Reason', render: 'vocabulary', vocabulary: ADJOURNMENT_REASON_VOCAB },
          { column_id: 'controllingParty', header: 'Controlling Party', render: 'vocabulary', vocabulary: ADJOURNMENT_CONTROLLING_PARTY_VOCAB },
          { column_id: 'restriction', header: 'Restriction', render: 'verbatim' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Company adjournment rights', 'Parent adjournment rights'],
      },
    ],
  };

  // -- Closing Conditions (pages 115-116) ----------------------------------
  overrides['conditions'] = {
    print_pages: [115],
    tables: [{
      table_key: 'conditions-table',
      group_header: 'MUTUAL CONDITIONS',
      term_column: { header: 'Condition', source: 'subject' },
      columns: [
        { column_id: 'voteStandard', header: 'Vote Standard', render: 'vocabulary', vocabulary: VOTE_STANDARD_VOCAB },
        { column_id: 'detail', header: 'Detail', render: 'verbatim' },
      ],
      rows_are: 'fixed list',
      fixed_row_labels: [
        'Stockholder Approval', 'No Legal Restraint', 'Antitrust / Regulatory Clearance',
        'S-4 / Proxy Effective', 'Stock Exchange Listing',
      ],
    }],
  };
  const conditionsPartyTable = (tableKey, groupHeader, fixedRows) => ({
    table_key: tableKey,
    group_header: groupHeader,
    term_column: { header: 'Condition', source: 'subject' },
    columns: [
      { column_id: 'standard', header: 'Standard', render: 'vocabulary', vocabulary: CLOSING_BRINGDOWN_VOCAB },
      { column_id: 'reference', header: 'Reference', render: 'verbatim' },
      {
        column_id: 'materialityQualifiersDisregarded',
        header: 'Materiality Qualifiers Disregarded',
        render: 'vocabulary',
        vocabulary: [P('Materiality qualifiers disregarded', { page: 115, row: 'Accuracy of Representations' })],
      },
    ],
    rows_are: 'fixed list',
    fixed_row_labels: fixedRows,
  });
  overrides['conditions-b'] = {
    print_pages: [115],
    tables: [conditionsPartyTable(
      'conditions-b-table',
      "BUYER'S CONDITIONS — TO PARENT / MERGER SUB'S OBLIGATION",
      ['Accuracy of Representations', 'No Material Adverse Effect', "Officer's Certificate"],
    )],
  };
  overrides['conditions-s'] = {
    print_pages: [116],
    tables: [conditionsPartyTable(
      'conditions-s-table',
      "TARGET'S CONDITIONS — TO THE COMPANY'S OBLIGATION",
      ['Accuracy of Representations', "Officer's Certificate"],
    )],
  };
  overrides['conditions-m'] = {
    print_pages: [116],
    tables: [{
      table_key: 'conditions-m-table',
      group_header: null,
      term_column: { header: 'Condition', source: 'subject' },
      columns: [
        { column_id: 'presence', header: 'Coverage', render: 'boolean' },
      ],
      rows_are: 'fixed list',
      fixed_row_labels: [
        'Condition Frustration / Prevention', 'Covenant Performance', 'Dissenting Shares Threshold',
        'No Material Adverse Effect (Parent)', 'Covenant Performance (Parent)', 'Financing / Sufficient Funds',
      ],
    }],
  };

  // -- Termination Rights (pages 119-122) ----------------------------------
  const EXERCISED_BY_VOCAB = [
    P('Either party may elect (not automatic)', { page: 120, row: 'Outside / End Date' }),
  ];
  overrides['termination-rights'] = {
    print_pages: [119, 120, 121, 122],
    tables: [
      {
        table_key: 'termination-rights-mutual',
        group_header: 'MUTUAL / EITHER PARTY',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'writtenConsent', header: 'Written Consent', render: 'boolean' },
          { column_id: 'outsideDate', header: 'Outside Date', render: 'value', value_kind: 'DATE' },
          { column_id: 'exercisedBy', header: 'Exercised By', render: 'vocabulary', vocabulary: EXERCISED_BY_VOCAB },
          { column_id: 'voteThreshold', header: 'Vote Threshold', render: 'vocabulary', vocabulary: VOTE_STANDARD_VOCAB },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Mutual consent', 'Outside / End Date', 'Legal restraint / order', 'Stockholder vote not obtained'],
      },
      {
        table_key: 'termination-rights-buyer-may-terminate',
        group_header: 'BUYER / PARENT MAY TERMINATE',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'faultBasedCarveOut', header: 'Fault-Based Carve-Out', render: 'boolean' },
          {
            column_id: 'trigger',
            header: 'Trigger',
            render: 'vocabulary',
            vocabulary: [P('Adverse Recommendation Change', { page: 120, row: 'Change of Recommendation' })],
          },
          {
            column_id: 'window',
            header: 'Window',
            render: 'vocabulary',
            vocabulary: [P('Pre-stockholder-vote only', { page: 120, row: 'Change of Recommendation' })],
          },
          addition_column('curePeriodValue', 'Cure Period Value', 'value', 'PERIOD', 'TERMINATION/BREACH supports a cure-period value distinct from the outside date; the print shows the breach right as a bare "No" fault-based-carve-out pill with the cure mechanics only in clause text (§6.3(b)).'),
          addition_column('curePeriodEnd', 'Cure Period End', 'value', 'DATE', 'companion to Cure Period Value -- the earlier-of date the cure window actually runs to.'),
          addition_column('curableOrNot', 'Curable or Not', 'boolean', null, 'TERMINATION layer_rules calls out "curable or not" as its own branch; not a distinct pill on this print.'),
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Company (Target) breach', 'Change of Recommendation'],
      },
      {
        table_key: 'termination-rights-company-may-terminate',
        group_header: 'COMPANY / TARGET MAY TERMINATE',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'faultBasedCarveOut', header: 'Fault-Based Carve-Out', render: 'boolean' },
          addition_column('terminatorBreachBar', 'Terminator-Breach Bar', 'boolean', null, "TERMINATION/BREACH's own condition (Ben, plan 5B.8 note): no termination where the terminator primarily caused the outside date to be missed -- present in clause text (§6.2(a) proviso) but not a pill on this print."),
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Parent (Buyer) breach'],
      },
      {
        table_key: 'termination-rights-remedies',
        group_header: 'REMEDIES (CROSS-REFERENCE)',
        term_column: { header: 'Term', source: 'subject' },
        columns: [
          { column_id: 'value', header: 'Value', render: 'boolean' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['Willful-breach carve-out', 'Willful-breach carve-out to sole remedy', 'Specific performance available to both parties'],
      },
    ],
  };

  // -- Termination Fees (page 122) -----------------------------------------
  overrides['termination-fees'] = {
    print_pages: [122],
    tables: [{
      table_key: 'termination-fees-table',
      group_header: null,
      term_column: { header: 'Term', source: 'subject' },
      columns: [
        { column_id: 'amount', header: 'Amount', render: 'value', value_kind: 'AMOUNT' },
        { column_id: 'trigger', header: 'Trigger', render: 'verbatim' },
        addition_column('payer', 'Payer', 'vocabulary', null, 'TERMINATION_FEE/FEE_AMOUNT names a payer role; this print shows the fee amount and trigger prose only, payer is implied by which row (Company/Reverse) rather than stated as its own pill.', [
          addition('Company', 'the "Company termination fee" row implies the Company as payer; not stated as its own pill on this print.', { code: 'COMPANY' }),
          addition('Parent', 'the "Reverse termination fee" row implies Parent as payer; same reasoning.', { code: 'PARENT' }),
        ]),
        addition_column('deemingRulePresent', 'Deeming Rule Present', 'boolean', null, 'TERMINATION_FEE/FEE_TRIGGER supports a "deemed" trigger variant (e.g. deemed acceptance of a proposal); not distinguished on this print.'),
      ],
      rows_are: 'fixed list',
      fixed_row_labels: ['Company termination fee', 'Reverse termination fee', 'Sole and exclusive remedy', 'Willful-breach carve-out', 'Willful-breach carve-out to sole remedy', 'Interest on late payment'],
    }],
  };
  overrides['tail-fee'] = {
    print_pages: [128],
    tables: [{
      table_key: 'tail-fee-table',
      group_header: null,
      term_column: { header: 'Term', source: 'subject' },
      columns: [
        { column_id: 'value', header: 'Value', render: 'value', value_kind: 'PERIOD' },
        addition_column('tailPeriod', 'Tail Period', 'value', 'PERIOD', 'TERMINATION_FEE/TAIL_PERIOD names the tail window as its own component; already present as this table\'s "Tail window" row, promoted here as an explicit reusable column for cross-deal comparison rather than a fixed-row value only.'),
      ],
      rows_are: 'fixed list',
      fixed_row_labels: ['Tail window', 'Threshold % for Company Takeover Proposal', 'Termination scenarios', 'Qualifying transaction scope'],
    }],
  };

  // -- Employee Compensation and Benefits (pages 128-129) ------------------
  const REFERENCE_GROUP_VOCAB = [
    L('Company pre-closing arrangements'),
    L('Similarly-situated buyer employees'),
  ];
  const BENEFIT_STANDARD_VOCAB = [
    P("At target's pre-closing levels", { page: 129, row: 'Severance / change-in-control protection' }),
    P('In the aggregate (rebalancing permitted)', { page: 129, row: 'Other benefits' }),
    P('No less favorable than current', { page: 129, row: 'Base salary' }),
    P("At buyer's discretion", { page: 129, row: 'Long-term incentive (LTI) / equity grants' }),
  ];
  const MAIN_BENEFIT_ROWS = ['Severance / change-in-control protection', 'Other benefits', 'Base salary', 'Long-term incentive (LTI) / equity grants', 'Target annual bonus / cash incentive', 'Retirement / 401(k) benefits'];
  const LEGACY_ONLY_BENEFIT_CODES = compItemOrder.filter((code) => {
    const label = compItemLabels[code];
    return label && !MAIN_BENEFIT_ROWS.includes(label);
  });
  overrides['employee-benefits'] = {
    print_pages: [128, 129],
    tables: [
      {
        table_key: 'employee-benefits-table',
        group_header: null,
        term_column: { header: 'Benefit', source: 'subject' },
        columns: [
          // Exactly the two legacy labels (lib/employee-benefits.js
          // COMPARISON_GROUP_PRE_CLOSING / COMPARISON_GROUP_BUYER_EMPLOYEES)
          // -- the print's "Not specified" on the LTI/Retirement rows is not
          // a third reference-group VALUE, it is the absence of one
          // (comparisonGroupForStandardCode returns null for BUYER_DISCRETION
          // standards), so it stays out of this column's vocabulary; noted
          // as an open question in the Part 4 readout instead.
          { column_id: 'comparison', header: 'Reference Group', render: 'vocabulary', vocabulary: REFERENCE_GROUP_VOCAB },
          { column_id: 'standard', header: 'Standard', render: 'vocabulary', vocabulary: BENEFIT_STANDARD_VOCAB },
          { column_id: 'period', header: 'Period', render: 'value', value_kind: 'PERIOD' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: MAIN_BENEFIT_ROWS,
        additional_fixed_row_labels: LEGACY_ONLY_BENEFIT_CODES.map((code) => ({
          label: compItemLabels[code],
          reason: `lib/employee-benefits.js's COMP_ITEM_LABELS/COMP_ITEM_ORDER carries this as a distinct comparable benefit element (code ${code}); this deal's print does not populate it (the table only shows populated rows), but the fixed table shape should include it so an agreement that DOES populate it lands on the same row across deals.`,
        })),
      },
      {
        table_key: 'employee-benefits-other-protections',
        group_header: 'OTHER PROTECTIONS',
        term_column: { header: 'Benefit', source: 'subject' },
        columns: [
          {
            column_id: 'comparison',
            header: 'Reference Group',
            render: 'vocabulary',
            vocabulary: [P('All covered employees', { page: 129, row: '401(k) plan continuation' })],
          },
          { column_id: 'standard', header: 'Standard', render: 'verbatim' },
          { column_id: 'period', header: 'Period', render: 'verbatim' },
        ],
        rows_are: 'fixed list',
        fixed_row_labels: ['401(k) plan continuation', 'Continued service crediting', 'Eligibility / waiting-period waiver', 'Severance protection'],
      },
    ],
  };

  // -- No Other Reps / Fraud (page 142) ------------------------------------
  overrides['no-other-reps-fraud'] = {
    print_pages: [142],
    tables: [{
      table_key: 'no-other-reps-fraud-table',
      group_header: null,
      term_column: { header: 'Question', source: 'subject' },
      columns: [
        {
          column_id: 'status',
          header: 'Status',
          render: 'vocabulary',
          vocabulary: [
            P('Yes', { page: 142, row: 'Buyer non-reliance', code: 'YES' }),
            P('Silent', { page: 142, row: 'Fraud carve-out' }),
            addition('No', 'complement of Yes -- V2 NO_OTHER_REPS_FRAUD/FRAUD_CARVEOUT is a yes/no/silent axis; this deal never shows an explicit "No" but the vocabulary should carry the full axis.'),
          ],
        },
        { column_id: 'detail', header: 'Detail', render: 'verbatim' },
      ],
      rows_are: 'fixed list',
      fixed_row_labels: ['Buyer non-reliance', 'Seller no-other-reps', 'Seller non-reliance', 'Buyer no-other-reps', 'Fraud carve-out'],
    }],
  };

  // -- Other Covenants (page 142) -------------------------------------------
  overrides['general-covenants'] = {
    print_pages: [142],
    tables: [{
      table_key: 'general-covenants-table',
      group_header: null,
      term_column: { header: 'Summary', source: 'subject' },
      columns: [{ column_id: 'detail', header: 'Link', render: 'verbatim' }],
      rows_are: 'one per subject',
    }],
  };

  // -- Miscellaneous / Boilerplate (pages 129-131) -------------------------
  overrides['misc-boilerplate'] = {
    print_pages: [129, 130, 131],
    tables: [{
      table_key: 'misc-boilerplate-table',
      group_header: null,
      term_column: { header: 'Term', source: 'subject' },
      columns: [
        {
          column_id: 'signals',
          header: 'Summary',
          render: 'vocabulary',
          vocabulary: [
            P('Yes', { page: 130, row: 'Specific performance', code: 'YES' }),
          ],
        },
        { column_id: 'detail', header: 'Detail', render: 'verbatim' },
      ],
      rows_are: 'fixed list',
      fixed_row_labels: [
        'Governing law', 'Forum / jurisdiction', 'Third-party beneficiaries', 'Fee / expense allocation',
        'Specific performance', 'Specific performance limitations', 'Jury trial waiver', 'Amendment formalities',
        'Severability', 'Counterparts and electronic execution', 'Assignment',
      ],
    }],
  };

  return overrides;
}

// A small helper used by the overrides above to declare a Part-2 addition
// column (as opposed to `addition(...)`, which declares a single addition
// vocabulary code inside an existing harvested column).
function addition_column(columnId, header, render, valueKind, reason, vocabulary) {
  const col = { column_id: columnId, header, render, addition: true, reason };
  if (valueKind) col.value_kind = valueKind;
  if (render === 'vocabulary') col.vocabulary = vocabulary || [];
  return col;
}

// New sections the print shows that no legacy config produced at all.
function buildNewSections() {
  return [
    {
      section_key: 'defined-terms',
      title: 'Defined Terms',
      legacy_config: null,
      print_pages: [170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180],
      v2_family_keys: [{ key: 'KEY_DEFINED_TERMS', confidence: 'low' }],
      tables: [{
        table_key: 'defined-terms-table',
        group_header: null,
        term_column: { header: 'Term', source: 'subject' },
        columns: [{ column_id: 'definition', header: 'Definition', render: 'verbatim' }],
        rows_are: 'one per subject',
      }],
    },
  ];
}

// --------------------------------------------------------------------------
// Assembly
// --------------------------------------------------------------------------

function build() {
  const pass1 = JSON.parse(fs.readFileSync(PASS1_PATH, 'utf8'));
  const legalSchema = JSON.parse(fs.readFileSync(LEGAL_SCHEMA_PATH, 'utf8'));
  const familyKeys = new Set(legalSchema.families.map((f) => f.family_key));
  PRINT_PAGES = loadPrint();
  const legacy = harvestLegacyMaps();
  const overrides = buildOverrides(legacy);
  const newSections = buildNewSections();

  const sections = pass1.sections.map((section) => {
    const override = overrides[section.section_key];
    if (!override) return { ...section, print_pages: [] };
    return {
      ...section,
      print_pages: override.print_pages || [],
      tables: override.tables,
    };
  });

  for (const section of newSections) {
    if (!familyKeys.has(section.v2_family_keys[0].key)) {
      throw new Error(`UNKNOWN_V2_FAMILY_KEY: ${section.section_key} -> ${section.v2_family_keys[0].key}`);
    }
    sections.push(section);
  }

  const generatedFrom = [
    ...pass1.generated_from,
    'contracts/product/table-shapes.v1.json',
    'fixtures/product/topbuild-review/print-text.v1.json',
    'lib/employee-benefits.js',
    'components/review/table-configs/fiduciary-standard-labels.js',
    'components/review/table-configs/vote-standard.js',
    'components/review/table-configs/board-change-standard.js',
    'components/review/table-configs/ioc-exceptions.config.js',
  ];

  const doc = {
    schema_version: 'PRODUCT_TABLE_SHAPES/V2',
    status: 'DRAFT_FOR_BEN_REVIEW',
    generated_from: [...new Set(generatedFrom)],
    sections,
  };

  applyFillFrom(doc, {});

  return doc;
}

if (require.main === module) {
  const doc = build();
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  const tableCount = doc.sections.reduce((n, s) => n + s.tables.length, 0);
  const columnCount = doc.sections.reduce((n, s) => n + s.tables.reduce((m, t) => m + t.columns.length, 0), 0);
  const vocabCount = doc.sections.reduce((n, s) => n + s.tables.reduce((m, t) => m + t.columns.reduce((k, c) => k + (c.vocabulary ? c.vocabulary.length : 0), 0), 0), 0);
  console.log(`wrote ${OUT_PATH}: ${doc.sections.length} sections, ${tableCount} tables, ${columnCount} columns, ${vocabCount} vocabulary entries`);
}

module.exports = { build };
