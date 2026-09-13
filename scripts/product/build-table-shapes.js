#!/usr/bin/env node
'use strict';

// Builds contracts/product/table-shapes.v1.json from the legacy review-page
// table configs under components/review/table-configs/. Those configs hold
// the shapes and vocabularies the current site uses (small per-subject
// tables of headline pills, grouped sub-tables, fixed row lists) but the V2
// legal schema does not model them. This script harvests, verbatim, what the
// legacy configs actually declare and render -- it never invents a code or a
// label.
//
// DECISION (deviating from a require()-per-file / text-fallback split): every
// config is read as source text and parsed into an AST (Babel's parser,
// vendored by Next.js -- this repo has no other JS parser dependency), never
// require()'d. All 34 files under table-configs/ parse cleanly (none uses
// real JSX; they all call React.createElement directly), so require() would
// have worked for module *shape* -- but these modules compute their pill
// vocabularies inside closures fed by live review-deal data (cardFeatures,
// classifier functions keyed off card text), not from a value the module
// exports. Requiring them would run pipeline code with no card to feed it,
// which is either a crash or a meaningless empty result, and it would make
// the generator's determinism depend on module side effects. Static parsing
// reads the same literal titles, column headers and label maps a require()
// would eventually bottom out at, without executing anything -- so every
// section in this file was extracted the same, deterministic, text-based
// way; see the report printed at the end for exactly what could and could
// not be recovered per file.

const fs = require('node:fs');
const path = require('node:path');
const parser = require('next/dist/compiled/babel/parser');
const traverseModule = require('next/dist/compiled/babel/traverse');
const traverse = traverseModule.default || traverseModule;

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_DIR = path.join(ROOT, 'components/review/table-configs');
const OUT_PATH = path.join(ROOT, 'contracts/product/table-shapes.v1.json');
const LEGAL_SCHEMA_PATH = path.join(ROOT, 'contracts/product/legal-schema.v2.json');

const RENDER_KINDS = ['vocabulary', 'value', 'verbatim', 'term', 'list', 'boolean'];
const VALUE_KINDS = ['AMOUNT', 'PERCENTAGE', 'PERIOD', 'DATE', 'COUNT'];
const TONES = ['neutral', 'present', 'missing', 'warning', 'info', 'buyer', 'seller'];

// One entry per legacy section config, in the order the review page mounts
// them (components/review/shared.js SIDEBAR_GROUPS / pages/review/[id].js).
// A best-guess V2 family mapping and a confidence travel with each -- these
// are judgment calls for Ben to correct, not derived facts.
const SECTION_ORDER = [
  ['consideration-hero.config.js', 'CONSIDERATION', 'high'],
  ['equity-awards.config.js', 'CONSIDERATION', 'high'],
  ['structure-mechanics.config.js', 'MERGER_STRUCTURE_CLOSING', 'high'],
  ['conditions.config.js', 'CLOSING_CONDITIONS', 'high'],
  ['conditions-m.config.js', 'CLOSING_CONDITIONS', 'high'],
  ['approvals-votes.config.js', 'TERMINATION', 'low'],
  ['votes-approvals-meeting.config.js', 'PROXY_MEETING', 'high'],
  ['sec-meeting.config.js', 'PROXY_MEETING', 'high'],
  ['termination-rights.config.js', 'TERMINATION', 'high'],
  ['termination-fees.config.js', 'TERMINATION_FEE', 'high'],
  ['tail-fee.config.js', 'TERMINATION_FEE', 'high'],
  ['nosol-section.config.js', 'NO_SHOP', 'high'],
  ['nosol-noshop.config.js', 'NO_SHOP', 'high'],
  ['nosol-fiduciary.config.js', 'NO_SHOP', 'high'],
  ['nosol-intervening.config.js', 'NO_SHOP', 'high'],
  ['nosol-superior.config.js', 'NO_SHOP', 'high'],
  ['ioc-exceptions.config.js', 'INTERIM_OPERATING', 'high'],
  ['general-covenants.config.js', 'GENERAL_COVENANTS', 'high'],
  ['employee-benefits.config.js', 'EMPLOYEE_MATTERS', 'high'],
  ['antitrust-regulatory.config.js', 'ANTITRUST_REGULATORY', 'high'],
  ['representations-qualifiers.config.js', 'REPRESENTATIONS', 'high'],
  ['no-other-reps-fraud.config.js', 'NO_OTHER_REPS_FRAUD', 'high'],
  ['mae-definitions.config.js', 'MAE_DEFINITION', 'high'],
  ['material-contracts.config.js', 'MATERIAL_CONTRACTS', 'high'],
  ['advisers-fees-expenses.config.js', 'GENERAL_COVENANTS', 'low'],
  ['misc-boilerplate.config.js', 'MISC_BOILERPLATE', 'high'],
];

// Shared label/standard modules that several configs import. Harvested once
// and made available to every config file that imports them, same as the
// site itself shares one definition across tables.
const SHARED_VOCAB_FILES = ['fiduciary-standard-labels.js', 'board-change-standard.js', 'vote-standard.js'];

function readSrc(file) {
  return fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8');
}

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

function getProp(objNode, name) {
  if (!objNode || objNode.type !== 'ObjectExpression') return null;
  const prop = objNode.properties.find((p) => (p.type === 'ObjectProperty' || p.type === 'ObjectMethod') && keyName(p) === name);
  if (!prop) return null;
  return prop.type === 'ObjectMethod' ? prop : prop.value;
}

function slug(label) {
  return String(label || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'CODE';
}

function wordsOf(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

// --- Pass 1: top-level declarations (consts, functions) -------------------

function collectTopLevel(ast) {
  const consts = new Map(); // name -> init node
  const funcs = new Map(); // name -> function node (params, body)
  for (const stmt of ast.program.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type !== 'Identifier' || !decl.init) continue;
        consts.set(decl.id.name, decl.init);
        if (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') {
          funcs.set(decl.id.name, decl.init);
        }
      }
    } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      funcs.set(stmt.id.name, stmt);
    }
  }
  return { consts, funcs };
}

function resolveArray(node, consts) {
  if (!node) return null;
  if (node.type === 'ArrayExpression') return node;
  if (node.type === 'Identifier' && consts.has(node.name)) return resolveArray(consts.get(node.name), consts);
  return null;
}

function functionReturnObject(fnNode) {
  let found = null;
  if (!fnNode) return null;
  const body = fnNode.body;
  if (body.type !== 'BlockStatement') {
    if (body.type === 'ObjectExpression') return body;
    return null;
  }
  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement' && stmt.argument && stmt.argument.type === 'ObjectExpression') {
      found = stmt.argument;
    }
  }
  return found;
}

// --- Pass 2: find every exported table-config instance ---------------------
// A "config instance" is either `const xConfig = { ...columns... }` directly,
// or `const xConfig = someFactory({ title: '...', id: '...' })` where
// someFactory is a locally defined function whose own return object carries
// `columns`. Call-site literals (title/id/etc.) win over the factory's own
// (parameterised) values.

function findConfigInstances(ast, consts, funcs) {
  const instances = [];
  for (const [name, init] of consts) {
    if (init.type === 'ObjectExpression' && getProp(init, 'columns')) {
      instances.push({ name, callArgs: init, bodyObject: init });
    } else if (init.type === 'CallExpression' && init.callee.type === 'Identifier' && funcs.has(init.callee.name)) {
      const factory = funcs.get(init.callee.name);
      const returned = functionReturnObject(factory);
      if (returned && getProp(returned, 'columns')) {
        const callArgs = init.arguments[0] && init.arguments[0].type === 'ObjectExpression' ? init.arguments[0] : null;
        instances.push({ name, callArgs: callArgs || returned, bodyObject: returned, factoryName: init.callee.name });
      }
    }
  }
  return instances;
}

// --- Pass 3: vocabulary maps (*_META / *_LABELS / *_COLORS) ---------------

function harvestLabelMaps(consts) {
  const maps = [];
  for (const [name, init] of consts) {
    if (!/_(META|LABELS|COLORS)$/i.test(name)) continue;
    if (init.type !== 'ObjectExpression') continue;
    const entries = [];
    for (const prop of init.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      const code = keyName(prop);
      if (!code) continue;
      if (prop.value.type === 'ObjectExpression') {
        const label = strOf(getProp(prop.value, 'label'));
        const tone = strOf(getProp(prop.value, 'tone'));
        if (label) entries.push({ code, label, tone: TONES.includes(tone) ? tone : 'neutral' });
      } else {
        const label = strOf(prop.value);
        if (label) entries.push({ code, label, tone: 'neutral' });
      }
    }
    if (entries.length) maps.push({ name, entries });
  }
  return maps;
}

// A classifier function whose body is a flat if/return chain of string
// literals (e.g. voteStandard()) is itself a vocabulary source: the literal
// strings ARE the pill labels, not lookup codes. Detected structurally, not
// by name, so it generalises past the four shared helper files.
function harvestClassifierLabelFns(funcs) {
  const maps = [];
  for (const [name, fn] of funcs) {
    if (fn.body.type !== 'BlockStatement') continue;
    const labels = [];
    let sawNonLiteralReturn = false;
    for (const stmt of fn.body.body) {
      let consequentReturn = null;
      if (stmt.type === 'IfStatement') {
        const cons = stmt.consequent;
        if (cons.type === 'ReturnStatement') consequentReturn = cons;
        else if (cons.type === 'BlockStatement' && cons.body.length === 1 && cons.body[0].type === 'ReturnStatement') consequentReturn = cons.body[0];
      }
      if (!consequentReturn) continue;
      const arg = consequentReturn.argument;
      if (!arg) continue;
      const str = strOf(arg);
      if (str !== null) {
        if (/[a-z]/.test(str)) labels.push(str);
      } else {
        sawNonLiteralReturn = true;
      }
    }
    if (labels.length >= 2 && !sawNonLiteralReturn) {
      maps.push({ name, entries: labels.map((label) => ({ code: slug(label), label, tone: 'neutral' })) });
    }
  }
  return maps;
}

// --- Pass 4: grouped sub-tables (arrays of { label, rows } literals) -------
// The site renders these bands with an uppercase CSS class over a mixed-case
// label (e.g. ioc-exceptions.config.js's "Affirmative covenants" / "Other
// restrictions" bands); this records the label verbatim and the schema
// upper-cases it, matching what a reader actually sees.

function harvestGroupLabels(ast) {
  const labels = [];
  const seen = new Set();
  traverse(ast, {
    ObjectExpression(nodePath) {
      const node = nodePath.node;
      if (!Array.isArray(nodePath.parentPath && nodePath.parentPath.node && nodePath.parentPath.node.elements)) return;
      const labelNode = getProp(node, 'label');
      const rowsNode = getProp(node, 'rows');
      if (!labelNode || !rowsNode) return;
      const label = strOf(labelNode);
      if (label && !seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    },
  });
  return labels;
}

// --- Pass 5: fixed row-label tuple arrays (e.g. FALLBACK_ITEMS) -----------

function harvestFixedRowLabelArrays(consts) {
  const found = [];
  for (const [name, init] of consts) {
    if (init.type !== 'ArrayExpression' || init.elements.length === 0) continue;
    const tuples = init.elements.filter((el) => el && el.type === 'ArrayExpression' && el.elements.length >= 2);
    if (tuples.length !== init.elements.length) continue;
    const labels = [];
    let ok = true;
    for (const tuple of tuples) {
      const codeNode = tuple.elements[0];
      const labelNode = tuple.elements[1];
      const code = strOf(codeNode);
      const label = strOf(labelNode);
      if (!code || !/^[A-Z][A-Z0-9_]*$/.test(code) || !label || !/[a-z]/.test(label)) { ok = false; break; }
      labels.push(label);
    }
    if (ok && labels.length) found.push({ name, labels });
  }
  return found;
}

// --- Column render/value-kind classification --------------------------

// renderCell is often a bare identifier pointing at a function defined
// elsewhere in the file (`renderCell: renderSignals`), so the column
// object's own source text never mentions PillCell even though the column
// renders pills. Resolve one hop through the function table before reading
// source text for the pill/long-text signal.
function renderCellSourceText(src, colNode, funcs) {
  const renderProp = getProp(colNode, 'renderCell') || getProp(colNode, 'render');
  if (renderProp && renderProp.type === 'Identifier' && funcs.has(renderProp.name)) {
    const fn = funcs.get(renderProp.name);
    return src.slice(fn.start, fn.end);
  }
  return src.slice(colNode.start, colNode.end);
}

function classifyColumn(src, colNode, id, header, vocabMaps, funcs) {
  const renderText = renderCellSourceText(src, colNode, funcs);
  const idHeader = `${id || ''} ${header || ''}`;

  const usesPill = /\bpill\(|\bpillCell\(|PillCell,/.test(renderText);
  const usesLongText = /TruncatedWithSeeText|longTextCell\(/.test(renderText);

  if (usesPill) {
    const colWords = wordsOf(idHeader);
    let best = null;
    let bestScore = 0;
    for (const map of vocabMaps) {
      const mapWords = wordsOf(map.name.replace(/_(META|LABELS|COLORS)$/i, ''));
      const score = colWords.filter((w) => mapWords.some((mw) => mw.includes(w) || w.includes(mw))).length;
      if (score > bestScore) { bestScore = score; best = map; }
    }
    if (!best && vocabMaps.length === 1) best = vocabMaps[0];
    if (best && best.entries.length) {
      return { render: 'vocabulary', vocabulary: best.entries, matchedFrom: best.name };
    }
    // No map keys to this column by name, and more than one candidate map
    // exists in the file (so guessing one, or unioning all of them, risks
    // attaching a real but WRONG vocabulary to this column -- worse than
    // leaving it verbatim; tried unioning during development and it visibly
    // mis-attached representations-qualifiers.config.js's materiality-qualifier
    // labels onto the unrelated Lookback column). Left verbatim and flagged
    // as a composite-cell column needing Ben's review.
    if (vocabMaps.length > 1) {
      return { render: 'verbatim', ambiguousComposite: true };
    }
    return { render: 'verbatim' };
  }

  if (usesLongText) return { render: 'verbatim' };

  if (/period|\bdays?\b|\bmonths?\b|\byears?\b|window|deadline/i.test(idHeader)) return { render: 'value', value_kind: 'PERIOD' };
  if (/\bdate\b/i.test(idHeader)) return { render: 'value', value_kind: 'DATE' };
  if (/percent|%|\brate\b/i.test(idHeader)) return { render: 'value', value_kind: 'PERCENTAGE' };
  if (/\bfee\b|amount|price|\bcap\b|threshold/i.test(idHeader)) return { render: 'value', value_kind: 'AMOUNT' };
  if (/count|number of/i.test(idHeader)) return { render: 'value', value_kind: 'COUNT' };

  return { render: 'verbatim' };
}

// --- Per-file extraction ----------------------------------------------

function extractSharedVocab() {
  const shared = [];
  for (const file of SHARED_VOCAB_FILES) {
    const src = readSrc(file);
    const ast = parseAst(src);
    const { consts, funcs } = collectTopLevel(ast);
    shared.push(...harvestLabelMaps(consts), ...harvestClassifierLabelFns(funcs));
  }
  return shared;
}

function extractFile(file, sharedVocab, notes) {
  const src = readSrc(file);
  const ast = parseAst(src);
  const { consts, funcs } = collectTopLevel(ast);
  const instances = findConfigInstances(ast, consts, funcs);
  if (!instances.length) {
    notes.push(`${file}: no table-config object found (columns property not located) -- skipped`);
    return [];
  }

  const localVocabMaps = harvestLabelMaps(consts);
  const localClassifierMaps = harvestClassifierLabelFns(funcs);
  const importsShared = /from\s+'\.\/(fiduciary-standard-labels|board-change-standard|vote-standard)\.js'/.test(src);
  const vocabMaps = [...localVocabMaps, ...localClassifierMaps, ...(importsShared ? sharedVocab : [])];

  const groupLabels = harvestGroupLabels(ast);
  const fixedRowArrays = harvestFixedRowLabelArrays(consts);

  const sections = [];
  for (const instance of instances) {
    const id = strOf(getProp(instance.callArgs, 'id')) || strOf(getProp(instance.bodyObject, 'id')) || instance.name;
    const title = strOf(getProp(instance.callArgs, 'title')) || strOf(getProp(instance.bodyObject, 'title'));
    if (!title) {
      notes.push(`${file}#${instance.name}: title is not a plain string literal -- skipped`);
      continue;
    }
    let columnsNode = resolveArray(getProp(instance.bodyObject, 'columns'), consts);
    if (!columnsNode) {
      notes.push(`${file}#${instance.name} (${title}): columns is not a resolvable array literal -- skipped`);
      continue;
    }

    const rawColumns = columnsNode.elements
      .filter((el) => el && el.type === 'ObjectExpression')
      .map((el, index) => {
        const colId = strOf(getProp(el, 'id')) || `col${index}`;
        const header = strOf(getProp(el, 'header')) || '';
        return { colId, header, node: el };
      })
      // A column with no header string is a hidden/full-text column the site
      // relocates behind a "see text" affordance rather than a visible grid
      // column (e.g. employee-benefits.config.js's 'detail') -- not one of
      // "the columns the site shows".
      .filter((col, index) => index === 0 || col.header);

    let termColumn = null;
    let bodyColumns = rawColumns;
    if (rawColumns.length > 1) {
      termColumn = { header: rawColumns[0].header, source: 'subject' };
      bodyColumns = rawColumns.slice(1);
    } else if (rawColumns.length === 1) {
      notes.push(`${file}#${instance.name} (${title}): single-column layout (likely a composed body/group render, not a flat pill table) -- no term_column split`);
    }

    const columns = bodyColumns.map((col) => {
      const classified = classifyColumn(src, col.node, col.colId, col.header, vocabMaps, funcs);
      if (classified.ambiguousComposite) {
        notes.push(`${file}#${instance.name} (${title}): column '${col.header || col.colId}' renders pills but this generator found ${vocabMaps.length} candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns`);
      }
      const out = { column_id: col.colId, header: col.header, render: classified.render };
      if (classified.value_kind) out.value_kind = classified.value_kind;
      if (classified.render === 'vocabulary') out.vocabulary = classified.vocabulary;
      return out;
    });

    const tables = [];
    if (groupLabels.length) {
      for (const label of groupLabels) {
        tables.push({
          table_key: `${id}-${slug(label).toLowerCase().replace(/_/g, '-')}`,
          group_header: label.toUpperCase(),
          term_column: termColumn,
          columns,
          rows_are: 'one per subject',
        });
      }
    } else if (fixedRowArrays.length === 1) {
      tables.push({
        table_key: `${id}-table`,
        group_header: null,
        term_column: termColumn,
        columns,
        rows_are: 'fixed list',
        fixed_row_labels: fixedRowArrays[0].labels,
      });
    } else {
      if (fixedRowArrays.length > 1) {
        notes.push(`${file}#${instance.name} (${title}): ${fixedRowArrays.length} candidate fixed-row-label arrays found (${fixedRowArrays.map((f) => f.name).join(', ')}) -- ambiguous, left as 'one per subject'`);
      }
      tables.push({
        table_key: `${id}-table`,
        group_header: null,
        term_column: termColumn,
        columns,
        rows_are: 'one per subject',
      });
    }

    sections.push({ id, title, tables });
  }
  return sections;
}

function build() {
  const legalSchema = require(LEGAL_SCHEMA_PATH);
  const familyKeys = new Set(legalSchema.families.map((f) => f.family_key));
  const notes = [];
  const sharedVocab = extractSharedVocab();

  const sections = [];
  const generatedFrom = [];
  for (const [file, familyKey, confidence] of SECTION_ORDER) {
    generatedFrom.push(`components/review/table-configs/${file}`);
    if (!familyKeys.has(familyKey)) {
      throw new Error(`SECTION_ORDER maps ${file} to unknown V2 family key ${familyKey}`);
    }
    const fileSections = extractFile(file, sharedVocab, notes);
    for (const section of fileSections) {
      sections.push({
        section_key: section.id,
        title: section.title,
        legacy_config: `components/review/table-configs/${file}`,
        v2_family_keys: [{ key: familyKey, confidence }],
        tables: section.tables,
      });
    }
  }
  for (const file of SHARED_VOCAB_FILES) generatedFrom.push(`components/review/table-configs/${file}`);

  return {
    doc: {
      schema_version: 'PRODUCT_TABLE_SHAPES/V1',
      status: 'DRAFT_FOR_BEN_REVIEW',
      generated_from: generatedFrom,
      sections,
    },
    notes,
  };
}

if (require.main === module) {
  const { doc, notes } = build();
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  const tableCount = doc.sections.reduce((n, s) => n + s.tables.length, 0);
  console.log(`wrote ${OUT_PATH}: ${doc.sections.length} sections, ${tableCount} tables`);
  if (notes.length) {
    console.log(`${notes.length} extraction notes:`);
    for (const note of notes) console.log(`  - ${note}`);
  }
}

module.exports = { build };
