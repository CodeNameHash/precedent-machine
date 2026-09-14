'use strict';

// Validation and rendering helpers for FACT_CONCLUSIONS/V1, the coded
// per-table readout decided 2026-09-12/13 (Ben) as an additional, optional
// layer on top of FACT_COMPONENTS/V2. Contract:
// contracts/product/fact-conclusions.v1.json. Table shapes and vocabularies:
// contracts/product/table-shapes.v3.json, validated by lib/product/table-shapes.js.
// Pure functions; no database or model access.

const contract = require('../../contracts/product/fact-conclusions.v1.json');
const { walk, parseComponentValue } = require('./fact-components');

const VALUE_RENDER_KINDS = new Set(['verbatim', 'term']);

// Every column of `table`, resolving a shared vocabulary reference to the
// actual vocabulary entries so callers never need `table-shapes.json`'s
// top-level `shared_vocabularies` separately.
function columnVocabulary(column, tableShapes) {
  if (Array.isArray(column.vocabulary)) return column.vocabulary;
  if (column.vocabulary_ref) return (tableShapes.shared_vocabularies || {})[column.vocabulary_ref] || [];
  return [];
}

function findTableByKey(tableShapes, tableKey) {
  for (const section of tableShapes.sections || []) {
    for (const table of section.tables || []) {
      if (table.table_key === tableKey) return { table, section };
    }
  }
  return null;
}

// Every { table, section } whose section covers `familyKey`.
function tablesForFamily(familyKey, tableShapes) {
  const candidates = [];
  for (const section of tableShapes.sections || []) {
    if (!(section.v2_family_keys || []).some((entry) => entry.key === familyKey)) continue;
    for (const table of section.tables || []) candidates.push({ table, section });
  }
  return candidates;
}

function familyHasTableShape(familyKey, tableShapes) {
  return tablesForFamily(familyKey, tableShapes).length > 0;
}

// Resolves the one table `fact.conclusions` targets (or would target): by
// explicit table_key when given, checked against the fact's family_key
// through the table's section.v2_family_keys; otherwise by family_key alone
// when it names exactly one table, or by row_label against a fixed-list
// table's row labels when the family has more than one. Returns
// { table, section } or null when no table resolves.
function tableForFact(fact, tableShapes) {
  const conclusions = fact.conclusions || null;
  if (conclusions && conclusions.table_key) {
    const found = findTableByKey(tableShapes, conclusions.table_key);
    if (!found) return null;
    if (!(found.section.v2_family_keys || []).some((entry) => entry.key === fact.family_key)) return null;
    return found;
  }
  const candidates = tablesForFamily(fact.family_key, tableShapes);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && conclusions && conclusions.row_label) {
    const matches = candidates.filter(({ table }) => (
      (table.fixed_row_labels || []).includes(conclusions.row_label)
      || (table.additional_fixed_row_labels || []).some((row) => row.label === conclusions.row_label)
    ));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function rowLabelProblem(table, rowLabel) {
  if (table.rows_are !== 'fixed list' || table.open_rows === true) return null;
  const legal = [
    ...(table.fixed_row_labels || []),
    ...((table.additional_fixed_row_labels || []).map((row) => row.label)),
  ];
  return legal.includes(rowLabel) ? null : `row_label "${rowLabel}" is not one of ${table.table_key}'s fixed row labels`;
}

// Returns a list of problems; an empty list means `fact.conclusions`
// satisfies the contract (rules C1-C9), or `fact` carries no conclusions at
// all (optional layer -- nothing to check).
// C4: a verbatim/term cell's text is the cited component's exact text or a
// contiguous run of whole words cut from it (no paraphrase, no added words).
function verbatimRun(componentText, cellText) {
  if (typeof componentText !== 'string' || typeof cellText !== 'string' || !cellText.trim()) return false;
  if (componentText === cellText) return true;
  const index = componentText.indexOf(cellText);
  if (index < 0) return false;
  const before = index === 0 ? '' : componentText[index - 1];
  const after = componentText[index + cellText.length] || '';
  return /^[\s([“"'‘,;:.]?$/.test(before) && /^[\s)\]”"'’,;:.]?$/.test(after);
}

// A cell may cite several components and quote the source run they span
// together (a Material Contract category with its exception, "... under
// or with respect to Intellectual Property, except for Standard
// Contracts"). Joining component texts with a space loses the punctuation
// between them (Metsera generation 5: thirteen 3.13 readouts dropped), so
// the run is compared word by word, over the cited components in source
// order, a component nested inside another's
// byte range contributing nothing twice. Words are never added or changed
// by this: only the characters between them.
const RUN_WORD = /[\p{L}\p{N}$%]+/gu;
const wordsOf = (text) => String(text || '').match(RUN_WORD) || [];
function citedRun(citedComponents, cellText) {
  const anchored = citedComponents
    .filter((component) => Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
    .sort((left, right) => left.start_byte - right.start_byte || right.end_byte - left.end_byte);
  const ordered = anchored.length === citedComponents.length ? anchored : citedComponents;
  const pieces = [];
  let coveredTo = -1;
  for (const component of ordered) {
    if (ordered === anchored) {
      if (component.end_byte <= coveredTo) continue;
      coveredTo = component.end_byte;
    }
    pieces.push(String(component.text || ''));
  }
  // Whole words only: the cell is a contiguous run of the components' words.
  const haystack = wordsOf(pieces.join(' '));
  const needle = wordsOf(cellText);
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, index) => haystack[start + index] === word)) return true;
  }
  return false;
}

// The first `contradicted_by` phrase of a vocabulary entry found, whole
// words, case-insensitively, in any of the fact's components; null when
// the entry lists none or none is present.
function contradictingWords(entry, components) {
  const phrases = Array.isArray(entry?.contradicted_by) ? entry.contradicted_by : [];
  if (phrases.length === 0) return null;
  const texts = [...components].map((component) => String(component?.text || ''));
  for (const phrase of phrases) {
    const escaped = String(phrase).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (!escaped) continue;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
    if (texts.some((text) => pattern.test(text))) return phrase;
  }
  return null;
}

function validateFactConclusions(fact, { tableShapes } = {}) {
  const problems = [];
  const conclusions = fact?.conclusions;
  if (!conclusions) return problems;
  if (!tableShapes) return ['tableShapes required to validate conclusions'];
  if (typeof conclusions.table_key !== 'string' || !conclusions.table_key) problems.push('table_key missing');
  if (typeof conclusions.row_label !== 'string' || !conclusions.row_label.trim()) problems.push('row_label missing');
  if (conclusions.row_detail !== undefined && (typeof conclusions.row_detail !== 'string' || !conclusions.row_detail.trim())) problems.push('row_detail must be a non-empty string when present');
  if (!Array.isArray(conclusions.cells)) {
    problems.push('cells missing');
    return problems;
  }
  const resolved = tableForFact(fact, tableShapes);
  if (!resolved) {
    problems.push(`no table-shapes table "${conclusions.table_key}" for family ${fact.family_key}`);
    return problems;
  }
  const { table } = resolved;
  // C11: a table that names the subtypes it takes drops a readout from any
  // other subtype (exchange mechanics never a per-share consideration row;
  // Ben, 2026-09-13).
  if (Array.isArray(table.only_subtype_keys) && !table.only_subtype_keys.includes(fact.subtype_key)) {
    problems.push(`subtype ${fact.subtype_key} does not belong in ${table.table_key} (only ${table.only_subtype_keys.join(', ')})`);
  }
  if (conclusions.row_label) {
    const problem = rowLabelProblem(table, conclusions.row_label);
    if (problem) problems.push(problem);
  }
  const columnsById = new Map((table.columns || []).map((column) => [column.column_id, column]));
  const componentsById = new Map([...walk(fact.components || [])].map(([component]) => [component.component_id, component]));
  const seenColumns = new Set();

  conclusions.cells.forEach((cell, index) => {
    const where = `cells[${index}]`;
    if (!cell || typeof cell !== 'object') { problems.push(`${where}: not an object`); return; }
    const column = columnsById.get(cell.column_id);
    if (!column) { problems.push(`${where}: unknown column ${cell.column_id}`); return; }
    // A vocabulary column may carry several cells with distinct codes: a
    // representation qualified both by knowledge and by materiality has two
    // readings in its Qualifiers cell (Metsera generation 3, 2026-09-13:
    // fifteen readouts dropped as "duplicate column materiality"). Any
    // other column, or the same code twice, is still a duplicate.
    const duplicate = seenColumns.has(cell.column_id)
      && !(column && column.render === 'vocabulary' && typeof cell.code === 'string'
        && !conclusions.cells.slice(0, index).some((earlier) => earlier && earlier.column_id === cell.column_id && earlier.code === cell.code));
    if (duplicate) problems.push(`${where}: duplicate column ${cell.column_id}`);
    seenColumns.add(cell.column_id);
    // C12: a column that names the subtypes that may fill it (appraisal
    // rights from the appraisal provision only) rejects a cell from any
    // other subtype.
    if (Array.isArray(column.from_subtype_keys) && !column.from_subtype_keys.includes(fact.subtype_key)) {
      problems.push(`${where}: column ${cell.column_id} is filled only by ${column.from_subtype_keys.join(', ')} facts, not ${fact.subtype_key}`);
    }
    // C14: a derived column (or a derived row of a column) is filled by the
    // page from another family's facts (decision 34); an extractor cell on
    // it is a problem.
    if (column.derived && (!Array.isArray(column.derived.rows) || column.derived.rows.includes(conclusions.row_label))) {
      problems.push(`${where}: column ${cell.column_id} is derived by the page from ${column.derived.from_family} facts, never filled from this fact`);
    }

    const componentIds = Array.isArray(cell.component_ids) ? cell.component_ids : [];
    if (componentIds.length === 0) problems.push(`${where}: needs at least one component_id`);
    // C6: every cited component belongs to this fact. The column's fill_from
    // kinds are advisory (they drive the no-conclusions fallback rendering);
    // a component of another kind is accepted.
    const citedComponents = [];
    for (const componentId of componentIds) {
      const component = componentsById.get(componentId);
      if (!component) { problems.push(`${where}: component ${componentId} is not part of this fact`); continue; }
      citedComponents.push(component);
    }

    if (column.render === 'vocabulary') {
      const entry = columnVocabulary(column, tableShapes).find((candidate) => candidate.code === cell.code);
      if (typeof cell.code !== 'string' || !cell.code) problems.push(`${where}: vocabulary column needs a code`);
      else if (!entry) {
        problems.push(`${where}: unknown code "${cell.code}" for column ${cell.column_id}`);
      } else if (column.vocabulary_by_row && typeof conclusions.row_label === 'string' && column.vocabulary_by_row[conclusions.row_label]
        && !column.vocabulary_by_row[conclusions.row_label].includes(cell.code)) {
        // C13: a column that restricts its codes per row (decision 34: the
        // efforts codes on the Efforts standard row, the control codes on
        // the Strategy control row) rejects a code from another row's set.
        problems.push(`${where}: code "${cell.code}" is not one of the ${cell.column_id} codes for row "${conclusions.row_label}" (${column.vocabulary_by_row[conclusions.row_label].join(', ')})`);
      } else {
        // C15: a vocabulary code the shape marks as contradicted by certain
        // words (contradicted_by) is a problem when any component of the
        // fact carries those words: "Fully vested (accelerated)" on an
        // award whose payments vest "subject to continued service" is the
        // conditional-upon-service code, not this one. Ben, 2026-09-14, on
        // the unvested option sub-row: "While fully vested is normally
        // right I know why this is coded as such but it should say Fully
        // Vested (Conditional Upon Service) or similar"; and on the fix:
        // "do you have an agent looking at all of our tweaks and seeing if
        // they should be made systematically/throughout the code base back
        // to extraction? I don't want to make surface level/one deal level
        // fixes". The page's remap of a stored cell stays as the safety
        // net; from here the extractor is held to it on every deal.
        const contradiction = contradictingWords(entry, componentsById.values());
        if (contradiction) problems.push(`${where}: code "${cell.code}" is contradicted by the fact's own words "${contradiction}" (the shape lists it under contradicted_by)`);
      }
    } else if (column.render === 'value') {
      if (!cell.value || typeof cell.value !== 'object' || cell.value.canonical === undefined) {
        problems.push(`${where}: value column needs { canonical, unit }`);
      } else if (!citedComponents.some((component) => {
        // The number is parsed from the cited words as the column's own value
        // kind (a period cited from a TRIGGER component still parses as a
        // PERIOD), falling back to the component's kind.
        const kinds = [...new Set([column.value_kind, component.kind].filter(Boolean))];
        return kinds.some((kind) => {
          const parsed = parseComponentValue(kind, component.text);
          return parsed && parsed.canonical === cell.value.canonical && parsed.unit === cell.value.unit;
        });
      })) {
        problems.push(`${where}: value does not match parseComponentValue of any cited component`);
      }
    } else if (VALUE_RENDER_KINDS.has(column.render)) {
      if (typeof cell.text !== 'string' || !cell.text) problems.push(`${where}: ${column.render} column needs text`);
      // An as-drafted column shows the fact's own words, never the cell
      // text, so the cell only has to cite the words (Metsera generation
      // 5: eight readouts dropped on a paraphrased as-drafted cell).
      else if (column.display === 'fact_text') { /* cited components suffice */ }
      else if (!citedComponents.some((component) => verbatimRun(component.text, cell.text))
        && !verbatimRun(citedComponents.map((component) => component.text).join(' '), cell.text)
        && !citedRun(citedComponents, cell.text)) {
        problems.push(`${where}: text is not the verbatim text, or a run of words cut from it, of any cited component`);
      }
    } else if (column.render === 'boolean') {
      if (typeof cell.present !== 'boolean') problems.push(`${where}: boolean column needs present`);
    } else {
      problems.push(`${where}: unsupported render kind ${column.render}`);
    }
    // C10: a column with basis_kinds is a reading of several components
    // together (a merger form from the merging party, the "with and into"
    // operation, the party merged into and the survivor); the cell cites
    // one component of every such kind the fact has (Ben, 2026-09-13).
    if (Array.isArray(column.basis_kinds)) {
      const factKinds = new Set([...componentsById.values()].map((component) => component.kind));
      const citedKinds = new Set(citedComponents.map((component) => component.kind));
      const missing = column.basis_kinds.filter((kind) => factKinds.has(kind) && !citedKinds.has(kind));
      if (missing.length) problems.push(`${where}: basis incomplete, no cited ${missing.join(' / ')} component although the fact has one`);
    }
  });

  return problems;
}

// A value cell's number is parsed by code from the cited words, never taken
// from the model (component contract R6 applied to the readout). The first
// cited component that parses as the column's value kind, or as its own
// kind, supplies the value: a lookback cited as a DATE ("since January 1,
// 2023") becomes that date, a counted instrument ("one (1) CVR") a COUNT.
// Metsera generation 3, 2026-09-13: ten representation readouts were
// dropped because the model wrote { 2023, year } for a date.
//
// A value column the readout omitted is completed from the fact's own words
// when exactly one of the fact's own components of the column's fill_from
// kinds parses as the column's value (Metsera generation 6, 3.08: the
// absence-of-changes fact cited "Since January 1, 2025" as a DATE and the
// Lookback cell was left out). The completion happens here, at extraction,
// so the stored readout carries the cell on every deal and every reader of
// it (the tables, Query, Compare) sees the same value; the page's own
// derivedValueCell stays as the safety net for stored generations. Ben,
// 2026-09-14: "do you have an agent looking at all of our tweaks and seeing
// if they should be made systematically/throughout the code base back to
// extraction? I don't want to make surface level/one deal level fixes".
// Never a column the page derives, never a column another subtype fills,
// never when two candidate components would make the choice a guess.
function completeOmittedValueCells({ table, rowLabel, subtypeKey, cells, components }) {
  const present = new Set(cells.map((cell) => cell && cell.column_id));
  const own = [...components].filter((component) => component && (component.origin === 'OWN' || !component.origin));
  // A component already read into a value column of the same kind is not
  // read into another: Metsera generation 6, 8.01 gave the outside date
  // (March 21, 2026) as its own extension and the extension (June 21,
  // 2026) as an outside date, each fact's one DATE filling both columns.
  const columnsById = new Map((table.columns || []).map((column) => [column.column_id, column]));
  const readByKind = new Map();
  for (const cell of cells) {
    const column = cell && columnsById.get(cell.column_id);
    if (!column || column.render !== 'value' || !column.value_kind) continue;
    if (!readByKind.has(column.value_kind)) readByKind.set(column.value_kind, new Set());
    for (const id of Array.isArray(cell.component_ids) ? cell.component_ids : []) readByKind.get(column.value_kind).add(id);
  }
  const completed = [];
  for (const column of table.columns || []) {
    if (column.render !== 'value' || !column.value_kind || present.has(column.column_id)) continue;
    if (column.derived && (!Array.isArray(column.derived.rows) || column.derived.rows.includes(rowLabel))) continue;
    if (Array.isArray(column.from_subtype_keys) && !column.from_subtype_keys.includes(subtypeKey)) continue;
    const candidates = [];
    const alreadyRead = readByKind.get(column.value_kind) || new Set();
    for (const component of own.filter((candidate) => (column.fill_from || []).includes(candidate.kind) && !alreadyRead.has(candidate.component_id))) {
      for (const kind of [...new Set([column.value_kind, component.kind])]) {
        const parsed = parseComponentValue(kind, component.text);
        if (parsed) { candidates.push({ component, value: { canonical: parsed.canonical, unit: parsed.unit } }); break; }
      }
    }
    if (candidates.length !== 1) continue;
    completed.push({ column_id: column.column_id, value: candidates[0].value, component_ids: [candidates[0].component.component_id] });
  }
  return completed;
}

// The readout a fact with none takes from the shapes: the row its fact
// type names (fact_type_rows; "FACT_TYPE:SUBTYPE" wins over "FACT_TYPE")
// on the one table of its family that names it, or, when several do, on
// the table whose statement_words match the fact's statement. Metsera
// generation 6, 7.02 (2026-09-14): the extractor returned the second
// bring-down tier and the officer's certificate without conclusions and
// both fell under "without a readout" though their rows are fixed.
function defaultConclusions(fact, tableShapes) {
  if (!fact || !fact.family_key || !fact.fact_type) return null;
  const rowOf = (table) => {
    const rows = table.fact_type_rows;
    if (!rows || typeof rows !== 'object') return null;
    return rows[`${fact.fact_type}:${fact.subtype_key}`] || rows[fact.fact_type] || null;
  };
  let candidates = tablesForFamily(fact.family_key, tableShapes).filter(({ table }) => rowOf(table));
  if (candidates.length > 1) {
    const statement = typeof fact.statement === 'string' ? fact.statement : '';
    candidates = candidates.filter(({ table }) => typeof table.statement_words === 'string'
      && new RegExp(table.statement_words, 'i').test(statement));
  }
  if (candidates.length !== 1) return null;
  const { table } = candidates[0];
  return { table_key: table.table_key, row_label: rowOf(table), cells: [] };
}

function normaliseConclusionValues(fact, tableShapes) {
  const conclusions = fact?.conclusions;
  if (!conclusions || !Array.isArray(conclusions.cells)) return conclusions;
  const resolved = tableForFact(fact, tableShapes);
  if (!resolved) return conclusions;
  const columnsById = new Map((resolved.table.columns || []).map((column) => [column.column_id, column]));
  const componentsById = new Map([...walk(fact.components || [])].map(([component]) => [component.component_id, component]));
  const omitted = completeOmittedValueCells({
    table: resolved.table, rowLabel: conclusions.row_label, subtypeKey: fact.subtype_key, cells: conclusions.cells, components: componentsById.values(),
  });
  return {
    ...conclusions,
    cells: [...conclusions.cells, ...omitted].map((cell) => {
      const column = cell && columnsById.get(cell.column_id);
      if (!column || column.render !== 'value') return cell;
      for (const componentId of Array.isArray(cell.component_ids) ? cell.component_ids : []) {
        const component = componentsById.get(componentId);
        if (!component) continue;
        for (const kind of [...new Set([column.value_kind, component.kind].filter(Boolean))]) {
          const parsed = parseComponentValue(kind, component.text);
          if (parsed) return { ...cell, value: { canonical: parsed.canonical, unit: parsed.unit } };
        }
      }
      return cell;
    }),
  };
}

function formatValue(value, valueKind) {
  if (!value || value.canonical === undefined || value.canonical === null) return null;
  if (value.unit === 'ISO_DATE') {
    const [year, month, day] = String(value.canonical).split('-').map(Number);
    if (year && month && day) return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return String(value.canonical);
  }
  if (value.unit === 'COUNT') return Number.isFinite(Number(value.canonical)) ? Number(value.canonical).toLocaleString('en-US') : String(value.canonical);
  if (valueKind === 'AMOUNT') return `$${Number(value.canonical).toLocaleString('en-US')}`;
  if (valueKind === 'PERCENTAGE') return `${value.canonical}%`;
  if (valueKind === 'PERIOD') {
    // "6 years", "1 business day": the unit reads as a word, plural past one
    // (generation 6: the benefit-plan look-back read "6 year").
    const unit = String(value.unit || '').toLowerCase().replace(/_/g, ' ');
    const count = Number(value.canonical);
    const plural = unit && Number.isFinite(count) && count !== 1 && !/s$/.test(unit) ? `${unit}s` : unit;
    return `${value.canonical} ${plural}`.trim();
  }
  return String(value.canonical);
}

// One row for the published/Query page: { column_id, header, pill_label |
// value_text | text | '—' } per column of the fact's resolved table, in
// column order. Returns [] when no table resolves for the fact.
function renderConclusionCells(fact, tableShapes) {
  const resolved = tableForFact(fact, tableShapes);
  if (!resolved) return [];
  const { table } = resolved;
  // The contract shape is an array of cells; a fact carrying any other shape renders as absent cells.
  const cells = Array.isArray(fact.conclusions?.cells) ? fact.conclusions.cells : [];
  const cellsByColumn = new Map(cells.map((cell) => [cell.column_id, cell]));
  return (table.columns || []).map((column) => {
    const header = column.header;
    const cell = cellsByColumn.get(column.column_id);
    if (!cell) return { column_id: column.column_id, header, text: '—' };
    if (column.render === 'vocabulary') {
      const entry = columnVocabulary(column, tableShapes).find((item) => item.code === cell.code);
      return { column_id: column.column_id, header, pill_label: entry ? entry.label : cell.code };
    }
    if (column.render === 'value') {
      return { column_id: column.column_id, header, value_text: formatValue(cell.value, column.value_kind) || '—' };
    }
    if (VALUE_RENDER_KINDS.has(column.render)) {
      return { column_id: column.column_id, header, text: cell.text || '—' };
    }
    if (column.render === 'boolean') {
      return { column_id: column.column_id, header, text: cell.present ? 'Present' : '—' };
    }
    return { column_id: column.column_id, header, text: '—' };
  });
}

module.exports = {
  defaultConclusions,
  contract,
  columnVocabulary,
  findTableByKey,
  tablesForFamily,
  familyHasTableShape,
  tableForFact,
  validateFactConclusions,
  normaliseConclusionValues,
  renderConclusionCells,
  formatValue,
  parseComponentValue,
};
