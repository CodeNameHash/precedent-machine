'use strict';

// Validates contracts/product/table-shapes.v1.json (built by
// scripts/product/build-table-shapes.js): the shape and vocabulary of the
// legacy review-page tables (docs/core/CODEBASE-GUIDE.md "Layered fact
// model, V2"), carried forward so the published page and the Query page can
// show the same headline-pill tables the review page shows today.

const SCHEMA_VERSION = 'PRODUCT_TABLE_SHAPES/V1';
const RENDER_KINDS = Object.freeze(['vocabulary', 'value', 'verbatim', 'term', 'list', 'boolean']);
const VALUE_KINDS = Object.freeze(['AMOUNT', 'PERCENTAGE', 'PERIOD', 'DATE', 'COUNT']);
const TONES = Object.freeze(['neutral', 'present', 'missing', 'warning', 'info', 'buyer', 'seller']);
const CONFIDENCES = Object.freeze(['high', 'low']);
// 'one per agreement': the table has a single row for the agreement (the
// legacy Structure & Mechanics grid, TERM / PROVISION); every fact of the
// family contributes the cells it can and the page renders the row as an
// attribute grid (`layout: 'attribute grid'`), one line per column.
const ROWS_ARE = Object.freeze(['one per subject', 'fixed list', 'one per agreement']);
const LAYOUTS = Object.freeze(['attribute grid']);

class TableShapesError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'TableShapesError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new TableShapesError(code, detail);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function validateVocabularyEntry(entry, where) {
  if (!entry || typeof entry !== 'object') fail('TABLE_SHAPES_VOCAB_ENTRY', where);
  if (!isNonEmptyString(entry.code)) fail('TABLE_SHAPES_VOCAB_CODE', where);
  if (!isNonEmptyString(entry.label)) fail('TABLE_SHAPES_VOCAB_LABEL', where);
  if (entry.tone !== undefined && entry.tone !== null && !TONES.includes(entry.tone)) {
    fail('TABLE_SHAPES_VOCAB_TONE', `${where}: ${entry.tone}`);
  }
}

function validateColumn(column, where, seenColumnIds) {
  if (!column || typeof column !== 'object') fail('TABLE_SHAPES_COLUMN', where);
  if (!isNonEmptyString(column.column_id)) fail('TABLE_SHAPES_COLUMN_ID', where);
  if (seenColumnIds.has(column.column_id)) fail('TABLE_SHAPES_DUPLICATE_COLUMN_ID', `${where}: ${column.column_id}`);
  seenColumnIds.add(column.column_id);
  if (typeof column.header !== 'string') fail('TABLE_SHAPES_COLUMN_HEADER', where);
  if (!RENDER_KINDS.includes(column.render)) fail('TABLE_SHAPES_RENDER_KIND', `${where}: ${column.render}`);
  if (column.value_kind !== undefined) {
    if (column.render !== 'value') fail('TABLE_SHAPES_VALUE_KIND_WITHOUT_VALUE_RENDER', where);
    if (!VALUE_KINDS.includes(column.value_kind)) fail('TABLE_SHAPES_VALUE_KIND', `${where}: ${column.value_kind}`);
  }
  if (column.vocabulary !== undefined) {
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_VOCAB_WITHOUT_VOCAB_RENDER', where);
    if (!Array.isArray(column.vocabulary) || column.vocabulary.length === 0) {
      fail('TABLE_SHAPES_VOCAB_LIST', where);
    }
    column.vocabulary.forEach((entry, index) => validateVocabularyEntry(entry, `${where}.vocabulary[${index}]`));
  } else if (column.render === 'vocabulary') {
    fail('TABLE_SHAPES_VOCAB_RENDER_WITHOUT_VOCAB', where);
  }
}

function validateTermColumn(termColumn, where) {
  if (termColumn === null || termColumn === undefined) return;
  if (typeof termColumn !== 'object') fail('TABLE_SHAPES_TERM_COLUMN', where);
  if (typeof termColumn.header !== 'string') fail('TABLE_SHAPES_TERM_COLUMN_HEADER', where);
  if (termColumn.source !== 'subject') fail('TABLE_SHAPES_TERM_COLUMN_SOURCE', where);
}

function validateTable(table, where, seenTableKeys, familyKeySet) {
  if (!table || typeof table !== 'object') fail('TABLE_SHAPES_TABLE', where);
  if (!isNonEmptyString(table.table_key)) fail('TABLE_SHAPES_TABLE_KEY', where);
  if (seenTableKeys.has(table.table_key)) fail('TABLE_SHAPES_DUPLICATE_TABLE_KEY', table.table_key);
  seenTableKeys.add(table.table_key);
  if (table.group_header !== null && !isNonEmptyString(table.group_header)) {
    fail('TABLE_SHAPES_GROUP_HEADER', where);
  }
  validateTermColumn(table.term_column, `${where}.term_column`);
  if (!Array.isArray(table.columns)) fail('TABLE_SHAPES_COLUMNS', where);
  const seenColumnIds = new Set();
  table.columns.forEach((column, index) => validateColumn(column, `${where}.columns[${index}]`, seenColumnIds));
  if (!ROWS_ARE.includes(table.rows_are)) fail('TABLE_SHAPES_ROWS_ARE', `${where}: ${table.rows_are}`);
  if (table.layout !== undefined && !LAYOUTS.includes(table.layout)) fail('TABLE_SHAPES_LAYOUT', `${where}: ${table.layout}`);
  if (table.guidance !== undefined && !isNonEmptyString(table.guidance)) fail('TABLE_SHAPES_GUIDANCE', where);
  if (table.open_rows !== undefined && typeof table.open_rows !== 'boolean') fail('TABLE_SHAPES_OPEN_ROWS', where);
  if (table.row_from_subtype !== undefined) {
    if (typeof table.row_from_subtype !== 'boolean') fail('TABLE_SHAPES_ROW_FROM_SUBTYPE', where);
    if (table.row_from_subtype && (!table.subtype_rows || typeof table.subtype_rows !== 'object'
      || Object.values(table.subtype_rows).some((label) => !isNonEmptyString(label)))) fail('TABLE_SHAPES_SUBTYPE_ROWS', where);
  }
  if (table.open_rows === true && table.rows_are !== 'fixed list') fail('TABLE_SHAPES_OPEN_ROWS_WITHOUT_FIXED_LIST', where);
  // A fact with no readout takes the row its fact type names (the key is
  // FACT_TYPE or FACT_TYPE:SUBTYPE) on the table whose statement_words
  // (a regular expression) match its statement.
  if (table.fact_type_rows !== undefined) {
    if (!table.fact_type_rows || typeof table.fact_type_rows !== 'object' || Array.isArray(table.fact_type_rows)
      || Object.entries(table.fact_type_rows).some(([key, label]) => !/^[A-Z0-9_]+(:[A-Z0-9_]+)?$/.test(key) || !isNonEmptyString(label))) fail('TABLE_SHAPES_FACT_TYPE_ROWS', where);
    if (table.rows_are === 'fixed list' && table.open_rows !== true) {
      const legal = new Set([...(table.fixed_row_labels || []), ...((table.additional_fixed_row_labels || []).map((row) => row.label))]);
      for (const label of Object.values(table.fact_type_rows)) if (!legal.has(label)) fail('TABLE_SHAPES_FACT_TYPE_ROWS', `${where}: ${label} is not a fixed row`);
    }
  }
  if (table.statement_words !== undefined) {
    if (!isNonEmptyString(table.statement_words)) fail('TABLE_SHAPES_STATEMENT_WORDS', where);
    try { new RegExp(table.statement_words, 'i'); } catch { fail('TABLE_SHAPES_STATEMENT_WORDS', where); }
  }
  // Decision 25 (MAE): a fixed row with no fact renders as this label
  // ("None"); a table footer sourced from one subtype's facts.
  if (table.absent_row_label !== undefined) {
    if (!isNonEmptyString(table.absent_row_label)) fail('TABLE_SHAPES_ABSENT_ROW_LABEL', where);
    if (table.rows_are !== 'fixed list') fail('TABLE_SHAPES_ABSENT_ROW_LABEL_WITHOUT_FIXED_LIST', where);
  }
  if (table.detail_labels !== undefined && (!Array.isArray(table.detail_labels) || table.detail_labels.length === 0
    || table.detail_labels.some((label) => !isNonEmptyString(label)))) fail('TABLE_SHAPES_DETAIL_LABELS', where);
  if (table.detail_labels_by_row !== undefined) {
    const byRow = table.detail_labels_by_row;
    if (!byRow || typeof byRow !== 'object' || Array.isArray(byRow)) fail('TABLE_SHAPES_DETAIL_LABELS_BY_ROW', where);
    for (const [rowLabel, labels] of Object.entries(byRow)) {
      if (!(table.fixed_row_labels || []).includes(rowLabel)) fail('TABLE_SHAPES_DETAIL_LABELS_BY_ROW_UNKNOWN_ROW', `${where}: ${rowLabel}`);
      if (!Array.isArray(labels) || labels.length === 0 || labels.some((label) => !isNonEmptyString(label))) fail('TABLE_SHAPES_DETAIL_LABELS_BY_ROW_LIST', `${where}: ${rowLabel}`);
    }
  }
  if (table.row_from_column !== undefined && !(table.columns || []).some((column) => column.column_id === table.row_from_column && column.render === 'vocabulary')) {
    fail('TABLE_SHAPES_ROW_FROM_COLUMN', where);
  }
  if (table.only_subtype_keys !== undefined && (!Array.isArray(table.only_subtype_keys) || table.only_subtype_keys.length === 0
    || table.only_subtype_keys.some((key) => !isNonEmptyString(key)))) fail('TABLE_SHAPES_ONLY_SUBTYPE_KEYS', where);
  for (const column of table.columns) {
    if (column.from_subtype_keys !== undefined && (!Array.isArray(column.from_subtype_keys) || column.from_subtype_keys.length === 0
      || column.from_subtype_keys.some((key) => !isNonEmptyString(key)))) fail('TABLE_SHAPES_FROM_SUBTYPE_KEYS', `${where}.${column.column_id}`);
  }
  if (table.combined_definition_from !== undefined) {
    const combined = table.combined_definition_from;
    if (!combined || typeof combined !== 'object' || !isNonEmptyString(combined.family_key) || !isNonEmptyString(combined.subtype_key) || !isNonEmptyString(combined.label)) {
      fail('TABLE_SHAPES_COMBINED_DEFINITION_FROM', where);
    }
  }
  if (table.sub_rows_label !== undefined && !isNonEmptyString(table.sub_rows_label)) fail('TABLE_SHAPES_SUB_ROWS_LABEL', where);
  if (table.footer_from_subtype !== undefined) {
    const footer = table.footer_from_subtype;
    if (!footer || typeof footer !== 'object' || !isNonEmptyString(footer.subtype_key) || !isNonEmptyString(footer.label)
      || (footer.style !== undefined && !['footer', 'other_provisions'].includes(footer.style))) {
      fail('TABLE_SHAPES_FOOTER_FROM_SUBTYPE', where);
    }
  }
  // The rows fold behind a toggle on the page (the interim restriction list).
  if (table.collapsible_rows !== undefined && typeof table.collapsible_rows !== 'boolean') fail('TABLE_SHAPES_COLLAPSIBLE_ROWS', where);
  for (const column of table.columns) {
    if (column.absent_code === undefined) continue;
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_ABSENT_CODE_WITHOUT_VOCAB_RENDER', `${where}.${column.column_id}`);
    if (Array.isArray(column.vocabulary) && !column.vocabulary.some((entry) => entry.code === column.absent_code)) {
      fail('TABLE_SHAPES_ABSENT_CODE_UNKNOWN', `${where}.${column.column_id}: ${column.absent_code}`);
    }
  }
  if (table.subtype_keys !== undefined && (!Array.isArray(table.subtype_keys) || table.subtype_keys.some((key) => !isNonEmptyString(key)))) {
    fail('TABLE_SHAPES_SUBTYPE_KEYS', where);
  }
  if (table.layout === 'attribute grid' && table.rows_are !== 'one per agreement') fail('TABLE_SHAPES_LAYOUT_ROWS', where);
  if (table.rows_are === 'fixed list') {
    if (!Array.isArray(table.fixed_row_labels) || table.fixed_row_labels.length === 0
      || table.fixed_row_labels.some((label) => !isNonEmptyString(label))) {
      fail('TABLE_SHAPES_FIXED_ROW_LABELS', where);
    }
  } else if (table.fixed_row_labels !== undefined) {
    fail('TABLE_SHAPES_FIXED_ROW_LABELS_WITHOUT_FIXED_LIST', where);
  }
}

function validateSection(section, index, seenSectionKeys, seenTableKeys, familyKeySet) {
  const where = `sections[${index}]`;
  if (!section || typeof section !== 'object') fail('TABLE_SHAPES_SECTION', where);
  if (!isNonEmptyString(section.section_key)) fail('TABLE_SHAPES_SECTION_KEY', where);
  if (seenSectionKeys.has(section.section_key)) fail('TABLE_SHAPES_DUPLICATE_SECTION_KEY', section.section_key);
  seenSectionKeys.add(section.section_key);
  if (!isNonEmptyString(section.title)) fail('TABLE_SHAPES_SECTION_TITLE', where);
  if (!isNonEmptyString(section.legacy_config)) fail('TABLE_SHAPES_LEGACY_CONFIG', where);
  if (section.rail !== undefined && (!section.rail || typeof section.rail !== 'object' || !isNonEmptyString(section.rail.group)
    || !isNonEmptyString(section.rail.label) || !/^#[0-9A-Fa-f]{6}$/.test(String(section.rail.hex)))) fail('TABLE_SHAPES_SECTION_RAIL', where);
  if (section.no_conclusions_subtype_keys !== undefined && (!Array.isArray(section.no_conclusions_subtype_keys)
    || section.no_conclusions_subtype_keys.some((key) => !isNonEmptyString(key)))) fail('TABLE_SHAPES_NO_CONCLUSIONS_SUBTYPES', where);
  if (!Array.isArray(section.v2_family_keys) || section.v2_family_keys.length === 0) {
    fail('TABLE_SHAPES_FAMILY_KEYS', where);
  }
  for (const entry of section.v2_family_keys) {
    if (!entry || !isNonEmptyString(entry.key) || !CONFIDENCES.includes(entry.confidence)) {
      fail('TABLE_SHAPES_FAMILY_KEY_ENTRY', `${where}: ${JSON.stringify(entry)}`);
    }
    if (!familyKeySet.has(entry.key)) fail('TABLE_SHAPES_FAMILY_KEY_UNKNOWN', `${where}: ${entry.key}`);
  }
  if (!Array.isArray(section.tables) || section.tables.length === 0) fail('TABLE_SHAPES_TABLES', where);
  section.tables.forEach((table, tableIndex) => validateTable(table, `${where}.tables[${tableIndex}]`, seenTableKeys, familyKeySet));
}

// `legalSchema` is the parsed contracts/product/legal-schema.v2.json (or any
// object exposing the same `families[].family_key` shape) -- required so
// v2_family_keys can be checked against the real V2 taxonomy rather than an
// inline copy that could drift from it.
function validateTableShapes(doc, legalSchema) {
  if (!doc || doc.schema_version !== SCHEMA_VERSION) {
    fail('TABLE_SHAPES_VERSION', `expected ${SCHEMA_VERSION}`);
  }
  if (doc.status !== 'DRAFT_FOR_BEN_REVIEW') fail('TABLE_SHAPES_STATUS', String(doc.status));
  if (!Array.isArray(doc.generated_from) || doc.generated_from.length === 0
    || doc.generated_from.some((file) => !isNonEmptyString(file))) {
    fail('TABLE_SHAPES_GENERATED_FROM', 'expected a non-empty list of source file paths');
  }
  if (!Array.isArray(doc.sections) || doc.sections.length === 0) fail('TABLE_SHAPES_SECTIONS', 'expected at least one section');

  if (!legalSchema || !Array.isArray(legalSchema.families)) {
    fail('TABLE_SHAPES_LEGAL_SCHEMA', 'a V2 legal schema with families[] is required to validate against');
  }
  const familyKeySet = new Set(legalSchema.families.map((f) => f.family_key));

  const seenSectionKeys = new Set();
  const seenTableKeys = new Set();
  doc.sections.forEach((section, index) => validateSection(section, index, seenSectionKeys, seenTableKeys, familyKeySet));

  return doc;
}

// ---------------------------------------------------------------------------
// V2 (pass 2, docs/core/CODEBASE-GUIDE.md "Layered fact model, V2"): the
// print-harvested vocabulary in contracts/product/table-shapes.v2.json adds
// a source and print evidence to every vocabulary entry, lets a column or
// vocabulary code be marked as a Part-2 addition (schema/layer-rule-driven
// structure the old page never had), and requires every column to say which
// FACT_COMPONENTS/V2 component kinds would fill it. Kept as separate
// functions from the V1 validator above so pass 1's contract and tests are
// untouched.
// ---------------------------------------------------------------------------

const SCHEMA_VERSION_V2 = 'PRODUCT_TABLE_SHAPES/V2';
const SOURCES = Object.freeze(['print', 'legacy_map', 'both']);

function validatePrintEvidence(evidence, where) {
  if (!evidence || typeof evidence !== 'object') fail('TABLE_SHAPES_PRINT_EVIDENCE', where);
  if (!Number.isInteger(evidence.page) || evidence.page <= 0) fail('TABLE_SHAPES_PRINT_EVIDENCE_PAGE', where);
  if (!isNonEmptyString(evidence.row_label)) fail('TABLE_SHAPES_PRINT_EVIDENCE_ROW_LABEL', where);
}

function validateVocabularyEntryV2(entry, where) {
  if (!entry || typeof entry !== 'object') fail('TABLE_SHAPES_VOCAB_ENTRY', where);
  if (!isNonEmptyString(entry.code)) fail('TABLE_SHAPES_VOCAB_CODE', where);
  if (!isNonEmptyString(entry.label)) fail('TABLE_SHAPES_VOCAB_LABEL', where);
  if (entry.tone !== undefined && entry.tone !== null && !TONES.includes(entry.tone)) {
    fail('TABLE_SHAPES_VOCAB_TONE', `${where}: ${entry.tone}`);
  }
  if (entry.addition) {
    if (entry.source !== undefined) fail('TABLE_SHAPES_ADDITION_VOCAB_HAS_SOURCE', where);
    if (!isNonEmptyString(entry.reason)) fail('TABLE_SHAPES_ADDITION_REASON', where);
    if (entry.print_evidence !== undefined) fail('TABLE_SHAPES_ADDITION_VOCAB_HAS_PRINT_EVIDENCE', where);
    return;
  }
  if (!SOURCES.includes(entry.source)) fail('TABLE_SHAPES_VOCAB_SOURCE', `${where}: ${entry.source}`);
  if (entry.source === 'legacy_map') {
    if (entry.print_evidence !== undefined) fail('TABLE_SHAPES_LEGACY_VOCAB_HAS_PRINT_EVIDENCE', where);
  } else {
    validatePrintEvidence(entry.print_evidence, `${where}.print_evidence`);
  }
}

function validateFillFrom(fillFrom, componentKindSet, where) {
  if (!Array.isArray(fillFrom) || fillFrom.length === 0) fail('TABLE_SHAPES_FILL_FROM', where);
  for (const kind of fillFrom) {
    if (!isNonEmptyString(kind) || !componentKindSet.has(kind)) {
      fail('TABLE_SHAPES_FILL_FROM_UNKNOWN_KIND', `${where}: ${kind}`);
    }
  }
}

function validateColumnV2(column, where, seenColumnIds, componentKindSet) {
  if (!column || typeof column !== 'object') fail('TABLE_SHAPES_COLUMN', where);
  if (!isNonEmptyString(column.column_id)) fail('TABLE_SHAPES_COLUMN_ID', where);
  if (seenColumnIds.has(column.column_id)) fail('TABLE_SHAPES_DUPLICATE_COLUMN_ID', `${where}: ${column.column_id}`);
  seenColumnIds.add(column.column_id);
  if (typeof column.header !== 'string') fail('TABLE_SHAPES_COLUMN_HEADER', where);
  if (!RENDER_KINDS.includes(column.render)) fail('TABLE_SHAPES_RENDER_KIND', `${where}: ${column.render}`);
  if (column.value_kind !== undefined) {
    if (column.render !== 'value') fail('TABLE_SHAPES_VALUE_KIND_WITHOUT_VALUE_RENDER', where);
    if (!VALUE_KINDS.includes(column.value_kind)) fail('TABLE_SHAPES_VALUE_KIND', `${where}: ${column.value_kind}`);
  }
  if (column.vocabulary !== undefined) {
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_VOCAB_WITHOUT_VOCAB_RENDER', where);
    if (!Array.isArray(column.vocabulary) || column.vocabulary.length === 0) {
      fail('TABLE_SHAPES_VOCAB_LIST', where);
    }
    column.vocabulary.forEach((entry, index) => validateVocabularyEntryV2(entry, `${where}.vocabulary[${index}]`));
  } else if (column.render === 'vocabulary') {
    fail('TABLE_SHAPES_VOCAB_RENDER_WITHOUT_VOCAB', where);
  }
  if (column.trigger !== undefined) {
    if (!column.trigger || !Array.isArray(column.trigger.vocabulary) || column.trigger.vocabulary.length === 0) {
      fail('TABLE_SHAPES_TRIGGER_VOCAB', where);
    }
    column.trigger.vocabulary.forEach((entry, index) => validateVocabularyEntryV2(entry, `${where}.trigger.vocabulary[${index}]`));
  }
  if (column.addition) {
    if (!isNonEmptyString(column.reason)) fail('TABLE_SHAPES_ADDITION_REASON', where);
  } else if (column.reason !== undefined) {
    fail('TABLE_SHAPES_REASON_WITHOUT_ADDITION', where);
  }
  validateFillFrom(column.fill_from, componentKindSet, `${where}.fill_from`);
}

function validateTermColumnV2(termColumn, where) {
  if (termColumn === null || termColumn === undefined) return;
  if (typeof termColumn !== 'object') fail('TABLE_SHAPES_TERM_COLUMN', where);
  if (typeof termColumn.header !== 'string') fail('TABLE_SHAPES_TERM_COLUMN_HEADER', where);
  if (termColumn.source !== 'subject') fail('TABLE_SHAPES_TERM_COLUMN_SOURCE', where);
}

function validateTableV2(table, where, seenTableKeys, componentKindSet) {
  if (!table || typeof table !== 'object') fail('TABLE_SHAPES_TABLE', where);
  if (!isNonEmptyString(table.table_key)) fail('TABLE_SHAPES_TABLE_KEY', where);
  if (seenTableKeys.has(table.table_key)) fail('TABLE_SHAPES_DUPLICATE_TABLE_KEY', table.table_key);
  seenTableKeys.add(table.table_key);
  if (table.group_header !== null && !isNonEmptyString(table.group_header)) {
    fail('TABLE_SHAPES_GROUP_HEADER', where);
  }
  validateTermColumnV2(table.term_column, `${where}.term_column`);
  if (!Array.isArray(table.columns)) fail('TABLE_SHAPES_COLUMNS', where);
  const seenColumnIds = new Set();
  table.columns.forEach((column, index) => validateColumnV2(column, `${where}.columns[${index}]`, seenColumnIds, componentKindSet));
  if (!ROWS_ARE.includes(table.rows_are)) fail('TABLE_SHAPES_ROWS_ARE', `${where}: ${table.rows_are}`);
  if (table.rows_are === 'fixed list') {
    if (!Array.isArray(table.fixed_row_labels) || table.fixed_row_labels.length === 0
      || table.fixed_row_labels.some((label) => !isNonEmptyString(label))) {
      fail('TABLE_SHAPES_FIXED_ROW_LABELS', where);
    }
  } else if (table.fixed_row_labels !== undefined) {
    fail('TABLE_SHAPES_FIXED_ROW_LABELS_WITHOUT_FIXED_LIST', where);
  }
  if (table.additional_fixed_row_labels !== undefined) {
    if (table.rows_are !== 'fixed list') fail('TABLE_SHAPES_ADDITIONAL_ROWS_WITHOUT_FIXED_LIST', where);
    if (!Array.isArray(table.additional_fixed_row_labels)) fail('TABLE_SHAPES_ADDITIONAL_ROWS', where);
    table.additional_fixed_row_labels.forEach((row, index) => {
      if (!row || !isNonEmptyString(row.label) || !isNonEmptyString(row.reason)) {
        fail('TABLE_SHAPES_ADDITIONAL_ROW_ENTRY', `${where}.additional_fixed_row_labels[${index}]`);
      }
    });
  }
}

function validateSectionV2(section, index, seenSectionKeys, seenTableKeys, familyKeySet, componentKindSet) {
  const where = `sections[${index}]`;
  if (!section || typeof section !== 'object') fail('TABLE_SHAPES_SECTION', where);
  if (!isNonEmptyString(section.section_key)) fail('TABLE_SHAPES_SECTION_KEY', where);
  if (seenSectionKeys.has(section.section_key)) fail('TABLE_SHAPES_DUPLICATE_SECTION_KEY', section.section_key);
  seenSectionKeys.add(section.section_key);
  if (!isNonEmptyString(section.title)) fail('TABLE_SHAPES_SECTION_TITLE', where);
  if (section.legacy_config !== null && !isNonEmptyString(section.legacy_config)) {
    fail('TABLE_SHAPES_LEGACY_CONFIG', where);
  }
  if (section.print_pages !== undefined) {
    if (!Array.isArray(section.print_pages) || section.print_pages.some((p) => !Number.isInteger(p) || p <= 0)) {
      fail('TABLE_SHAPES_PRINT_PAGES', where);
    }
  }
  if (!Array.isArray(section.v2_family_keys) || section.v2_family_keys.length === 0) {
    fail('TABLE_SHAPES_FAMILY_KEYS', where);
  }
  for (const entry of section.v2_family_keys) {
    if (!entry || !isNonEmptyString(entry.key) || !CONFIDENCES.includes(entry.confidence)) {
      fail('TABLE_SHAPES_FAMILY_KEY_ENTRY', `${where}: ${JSON.stringify(entry)}`);
    }
    if (!familyKeySet.has(entry.key)) fail('TABLE_SHAPES_FAMILY_KEY_UNKNOWN', `${where}: ${entry.key}`);
  }
  if (!Array.isArray(section.tables) || section.tables.length === 0) fail('TABLE_SHAPES_TABLES', where);
  section.tables.forEach((table, tableIndex) => validateTableV2(table, `${where}.tables[${tableIndex}]`, seenTableKeys, componentKindSet));
}

// `factComponents` is the parsed contracts/product/fact-components.v2.json
// (or any object exposing the same `component.component_kinds` shape) --
// required so every column's fill_from can be checked against the real V2
// component-kind list rather than an inline copy that could drift from it.
function validateTableShapesV2(doc, legalSchema, factComponents) {
  if (!doc || doc.schema_version !== SCHEMA_VERSION_V2) {
    fail('TABLE_SHAPES_VERSION', `expected ${SCHEMA_VERSION_V2}`);
  }
  if (doc.status !== 'DRAFT_FOR_BEN_REVIEW') fail('TABLE_SHAPES_STATUS', String(doc.status));
  if (!Array.isArray(doc.generated_from) || doc.generated_from.length === 0
    || doc.generated_from.some((file) => !isNonEmptyString(file))) {
    fail('TABLE_SHAPES_GENERATED_FROM', 'expected a non-empty list of source file paths');
  }
  if (!Array.isArray(doc.sections) || doc.sections.length === 0) fail('TABLE_SHAPES_SECTIONS', 'expected at least one section');

  if (!legalSchema || !Array.isArray(legalSchema.families)) {
    fail('TABLE_SHAPES_LEGAL_SCHEMA', 'a V2 legal schema with families[] is required to validate against');
  }
  const familyKeySet = new Set(legalSchema.families.map((f) => f.family_key));

  if (!factComponents || !factComponents.component || !Array.isArray(factComponents.component.component_kinds)) {
    fail('TABLE_SHAPES_FACT_COMPONENTS', 'the FACT_COMPONENTS/V2 contract with component.component_kinds[] is required to validate fill_from against');
  }
  const componentKindSet = new Set(factComponents.component.component_kinds);

  const seenSectionKeys = new Set();
  const seenTableKeys = new Set();
  doc.sections.forEach((section, index) => validateSectionV2(section, index, seenSectionKeys, seenTableKeys, familyKeySet, componentKindSet));

  return doc;
}

// ---------------------------------------------------------------------------
// V3 (pass 3, Ben's answers of 2026-09-13 to the twenty questions pass 2's
// readout asked): encodes Ben's decisions as data on top of the V2 shape --
// display variants (one code, several literal print/legacy renderings),
// shared vocabularies referenced by id (one vocabulary used by several
// columns, e.g. the bring-down tiers), a per-step structure for double
// mergers, a per-row trigger vocabulary (Votes), `hover`, `full_text_on_click`,
// `empty_band_is_error`, `split_combined_elements`, `show_only_when_populated`
// and a section `kind` (e.g. `reference_appendix` for Defined Terms). Kept as
// separate functions from the V1/V2 validators so those contracts and tests
// stay untouched.
// ---------------------------------------------------------------------------

const SCHEMA_VERSION_V3 = 'PRODUCT_TABLE_SHAPES/V3';
const STATUS_V3 = 'DECIDED';
const SECTION_KINDS = Object.freeze(['fact_table', 'reference_appendix']);
const HOVER_KINDS = Object.freeze(['date']);

function validateDisplayVariant(variant, where) {
  if (!variant || typeof variant !== 'object') fail('TABLE_SHAPES_DISPLAY_VARIANT', where);
  if (!isNonEmptyString(variant.label)) fail('TABLE_SHAPES_DISPLAY_VARIANT_LABEL', where);
  if (!SOURCES.includes(variant.source)) fail('TABLE_SHAPES_DISPLAY_VARIANT_SOURCE', `${where}: ${variant.source}`);
  if (variant.source === 'legacy_map') {
    if (variant.print_evidence !== undefined) fail('TABLE_SHAPES_LEGACY_VOCAB_HAS_PRINT_EVIDENCE', where);
  } else {
    validatePrintEvidence(variant.print_evidence, `${where}.print_evidence`);
  }
}

function validateVocabularyEntryV3(entry, where) {
  validateVocabularyEntryV2(entry, where);
  if (entry.display_variants !== undefined) {
    if (!Array.isArray(entry.display_variants) || entry.display_variants.length === 0) {
      fail('TABLE_SHAPES_DISPLAY_VARIANTS', where);
    }
    entry.display_variants.forEach((variant, index) => validateDisplayVariant(variant, `${where}.display_variants[${index}]`));
  }
  // A code may list the words that contradict it (`contradicted_by`): a
  // readout carrying the code on a fact whose components hold those words
  // is a validation problem (lib/product/fact-conclusions.js C15), so the
  // rule holds the extractor on every deal rather than a page remap on one.
  // Ben, 2026-09-14: "do you have an agent looking at all of our tweaks and
  // seeing if they should be made systematically/throughout the code base
  // back to extraction? I don't want to make surface level/one deal level
  // fixes".
  if (entry.contradicted_by !== undefined) {
    if (!Array.isArray(entry.contradicted_by) || entry.contradicted_by.length === 0 || !entry.contradicted_by.every(isNonEmptyString)) {
      fail('TABLE_SHAPES_VOCAB_CONTRADICTED_BY', where);
    }
  }
}

function validateSharedVocabularies(sharedVocabularies, where) {
  const idSet = new Set();
  if (sharedVocabularies === undefined) return idSet;
  if (!sharedVocabularies || typeof sharedVocabularies !== 'object' || Array.isArray(sharedVocabularies)) {
    fail('TABLE_SHAPES_SHARED_VOCABULARIES', where);
  }
  for (const [id, vocabulary] of Object.entries(sharedVocabularies)) {
    if (!Array.isArray(vocabulary) || vocabulary.length === 0) fail('TABLE_SHAPES_SHARED_VOCABULARY_LIST', `${where}.${id}`);
    vocabulary.forEach((entry, index) => validateVocabularyEntryV3(entry, `${where}.${id}[${index}]`));
    idSet.add(id);
  }
  return idSet;
}

function validateTriggerV3(trigger, where) {
  if (!trigger || typeof trigger !== 'object') fail('TABLE_SHAPES_TRIGGER_VOCAB', where);
  if (trigger.per_row) {
    if (!trigger.by_row_label || typeof trigger.by_row_label !== 'object' || Array.isArray(trigger.by_row_label)) {
      fail('TABLE_SHAPES_TRIGGER_BY_ROW_LABEL', where);
    }
    const rowLabels = Object.keys(trigger.by_row_label);
    if (rowLabels.length === 0) fail('TABLE_SHAPES_TRIGGER_BY_ROW_LABEL', where);
    for (const rowLabel of rowLabels) {
      const vocabulary = trigger.by_row_label[rowLabel];
      if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
        fail('TABLE_SHAPES_TRIGGER_BY_ROW_LABEL_VOCAB', `${where}.by_row_label[${rowLabel}]`);
      }
      vocabulary.forEach((entry, index) => validateVocabularyEntryV3(entry, `${where}.by_row_label[${rowLabel}][${index}]`));
    }
  } else {
    if (!Array.isArray(trigger.vocabulary) || trigger.vocabulary.length === 0) fail('TABLE_SHAPES_TRIGGER_VOCAB', where);
    trigger.vocabulary.forEach((entry, index) => validateVocabularyEntryV3(entry, `${where}.vocabulary[${index}]`));
  }
}

function validateColumnV3(column, where, seenColumnIds, componentKindSet, sharedVocabularyIds) {
  if (column.basis_kinds !== undefined && (!Array.isArray(column.basis_kinds) || column.basis_kinds.length === 0
    || column.basis_kinds.some((kind) => !componentKindSet.has(kind)))) fail('TABLE_SHAPES_BASIS_KINDS', where);
  if (column.display !== undefined && !['resolved_reference', 'fact_text', 'party', 'subject_note'].includes(column.display)) fail('TABLE_SHAPES_COLUMN_DISPLAY', `${where}: ${column.display}`);
  // Decision 34: a vocabulary column may restrict its codes per fixed row
  // (the Provision column of a Term / Provision table: the efforts codes on
  // the Efforts standard row, the control codes on the Strategy control
  // row). Every listed code belongs to the column's vocabulary.
  if (column.vocabulary_by_row !== undefined) {
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_VOCAB_BY_ROW_WITHOUT_VOCAB_RENDER', where);
    const byRow = column.vocabulary_by_row;
    if (!byRow || typeof byRow !== 'object' || Array.isArray(byRow) || Object.keys(byRow).length === 0) fail('TABLE_SHAPES_VOCAB_BY_ROW', where);
    const codes = new Set((column.vocabulary || []).map((entry) => entry.code));
    for (const [rowLabel, rowCodes] of Object.entries(byRow)) {
      if (!Array.isArray(rowCodes) || rowCodes.length === 0 || rowCodes.some((code) => !isNonEmptyString(code))) fail('TABLE_SHAPES_VOCAB_BY_ROW_LIST', `${where}: ${rowLabel}`);
      if (Array.isArray(column.vocabulary) && rowCodes.some((code) => !codes.has(code))) fail('TABLE_SHAPES_VOCAB_BY_ROW_UNKNOWN_CODE', `${where}: ${rowLabel}`);
    }
  }
  // Decision 34: a derived column is filled by the page from another
  // family's facts, never by the extractor: by cross-reference (the
  // bring-down standard on a representation row, decision 20) or by
  // presence (a Yes pill, or the fact as drafted when display is
  // fact_text, whenever a fact of that family and subtype exists).
  if (column.derived !== undefined) {
    const spec = column.derived;
    if (!spec || typeof spec !== 'object' || !isNonEmptyString(spec.from_family)) fail('TABLE_SHAPES_DERIVED', where);
    if (!['cross_reference', 'presence', 'limbs'].includes(spec.join)) fail('TABLE_SHAPES_DERIVED_JOIN', `${where}: ${spec.join}`);
    // limbs: the row's own prong facts counted and sorted by their words
    // (the MAE summary); codes names the vocabulary code for EFFECT,
    // ABILITY and BOTH.
    if (spec.join === 'limbs') {
      if (!isNonEmptyString(spec.ability_words) || !spec.codes || typeof spec.codes !== 'object'
        || ['EFFECT', 'ABILITY', 'BOTH'].some((key) => !isNonEmptyString(spec.codes[key]))) fail('TABLE_SHAPES_DERIVED_LIMBS', where);
      const codes = new Set((column.vocabulary || []).map((entry) => entry.code));
      if (Object.values(spec.codes).some((code) => !codes.has(code))) fail('TABLE_SHAPES_DERIVED_LIMBS', `${where}: code not in the vocabulary`);
    }
    // Fallback sources, tried in order when the primary family has no fact
    // (the appraisal provision as CONSIDERATION/APPRAISAL_LINK, else
    // APPRAISAL_DISSENTERS_RIGHTS/APPRAISAL_STATUS).
    if (spec.alternatives !== undefined && (!Array.isArray(spec.alternatives) || spec.alternatives.some((alt) => !alt || !isNonEmptyString(alt.from_family)
      || (alt.from_subtype !== undefined && !isNonEmptyString(alt.from_subtype))))) fail('TABLE_SHAPES_DERIVED_ALTERNATIVES', where);
    if (spec.join === 'cross_reference' && !isNonEmptyString(spec.from_column)) fail('TABLE_SHAPES_DERIVED_FROM_COLUMN', where);
    if (spec.from_subtype !== undefined && !isNonEmptyString(spec.from_subtype)) fail('TABLE_SHAPES_DERIVED_FROM_SUBTYPE', where);
    if (spec.rows !== undefined && (!Array.isArray(spec.rows) || spec.rows.length === 0 || spec.rows.some((label) => !isNonEmptyString(label)))) fail('TABLE_SHAPES_DERIVED_ROWS', where);
  }
  if (!column || typeof column !== 'object') fail('TABLE_SHAPES_COLUMN', where);
  if (!isNonEmptyString(column.column_id)) fail('TABLE_SHAPES_COLUMN_ID', where);
  if (seenColumnIds.has(column.column_id)) fail('TABLE_SHAPES_DUPLICATE_COLUMN_ID', `${where}: ${column.column_id}`);
  seenColumnIds.add(column.column_id);
  if (typeof column.header !== 'string') fail('TABLE_SHAPES_COLUMN_HEADER', where);
  if (!RENDER_KINDS.includes(column.render)) fail('TABLE_SHAPES_RENDER_KIND', `${where}: ${column.render}`);
  if (column.value_kind !== undefined) {
    if (column.render !== 'value') fail('TABLE_SHAPES_VALUE_KIND_WITHOUT_VALUE_RENDER', where);
    if (!VALUE_KINDS.includes(column.value_kind)) fail('TABLE_SHAPES_VALUE_KIND', `${where}: ${column.value_kind}`);
  }
  if (column.vocabulary !== undefined && column.vocabulary_ref !== undefined) {
    fail('TABLE_SHAPES_VOCAB_AND_VOCAB_REF', where);
  }
  if (column.vocabulary !== undefined) {
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_VOCAB_WITHOUT_VOCAB_RENDER', where);
    if (!Array.isArray(column.vocabulary) || column.vocabulary.length === 0) {
      fail('TABLE_SHAPES_VOCAB_LIST', where);
    }
    column.vocabulary.forEach((entry, index) => validateVocabularyEntryV3(entry, `${where}.vocabulary[${index}]`));
  } else if (column.vocabulary_ref !== undefined) {
    if (column.render !== 'vocabulary') fail('TABLE_SHAPES_VOCAB_WITHOUT_VOCAB_RENDER', where);
    if (!isNonEmptyString(column.vocabulary_ref) || !sharedVocabularyIds.has(column.vocabulary_ref)) {
      fail('TABLE_SHAPES_VOCAB_REF_UNKNOWN', `${where}: ${column.vocabulary_ref}`);
    }
  } else if (column.render === 'vocabulary') {
    fail('TABLE_SHAPES_VOCAB_RENDER_WITHOUT_VOCAB', where);
  }
  if (column.trigger !== undefined) validateTriggerV3(column.trigger, `${where}.trigger`);
  if (column.hover !== undefined && !HOVER_KINDS.includes(column.hover)) {
    fail('TABLE_SHAPES_HOVER', `${where}: ${column.hover}`);
  }
  if (column.full_text_on_click !== undefined && typeof column.full_text_on_click !== 'boolean') {
    fail('TABLE_SHAPES_FULL_TEXT_ON_CLICK', where);
  }
  if (column.addition) {
    if (!isNonEmptyString(column.reason)) fail('TABLE_SHAPES_ADDITION_REASON', where);
  } else if (column.reason !== undefined) {
    fail('TABLE_SHAPES_REASON_WITHOUT_ADDITION', where);
  }
  validateFillFrom(column.fill_from, componentKindSet, `${where}.fill_from`);
}

function validatePerStepStructure(structure, where, columnIds) {
  if (!structure || typeof structure !== 'object') fail('TABLE_SHAPES_PER_STEP_STRUCTURE', where);
  if (!isNonEmptyString(structure.applies_when)) fail('TABLE_SHAPES_PER_STEP_APPLIES_WHEN', where);
  if (!Array.isArray(structure.steps) || structure.steps.length < 2) fail('TABLE_SHAPES_PER_STEP_STEPS', where);
  structure.steps.forEach((step, index) => {
    const stepWhere = `${where}.steps[${index}]`;
    if (!step || !Number.isInteger(step.step) || step.step <= 0) fail('TABLE_SHAPES_PER_STEP_NUMBER', stepWhere);
    if (!isNonEmptyString(step.form_column_id) || !columnIds.has(step.form_column_id)) {
      fail('TABLE_SHAPES_PER_STEP_FORM_COLUMN', `${stepWhere}: ${step.form_column_id}`);
    }
    if (!isNonEmptyString(step.surviving_entity_column_id) || !columnIds.has(step.surviving_entity_column_id)) {
      fail('TABLE_SHAPES_PER_STEP_SURVIVING_ENTITY_COLUMN', `${stepWhere}: ${step.surviving_entity_column_id}`);
    }
  });
}

function validateTableV3(table, where, seenTableKeys, componentKindSet, sharedVocabularyIds) {
  if (!table || typeof table !== 'object') fail('TABLE_SHAPES_TABLE', where);
  if (!isNonEmptyString(table.table_key)) fail('TABLE_SHAPES_TABLE_KEY', where);
  if (seenTableKeys.has(table.table_key)) fail('TABLE_SHAPES_DUPLICATE_TABLE_KEY', table.table_key);
  seenTableKeys.add(table.table_key);
  if (table.group_header !== null && !isNonEmptyString(table.group_header)) {
    fail('TABLE_SHAPES_GROUP_HEADER', where);
  }
  validateTermColumnV2(table.term_column, `${where}.term_column`);
  if (!Array.isArray(table.columns)) fail('TABLE_SHAPES_COLUMNS', where);
  const seenColumnIds = new Set();
  table.columns.forEach((column, index) => validateColumnV3(column, `${where}.columns[${index}]`, seenColumnIds, componentKindSet, sharedVocabularyIds));
  if (!ROWS_ARE.includes(table.rows_are)) fail('TABLE_SHAPES_ROWS_ARE', `${where}: ${table.rows_are}`);
  if (table.rows_are === 'fixed list') {
    if (!Array.isArray(table.fixed_row_labels) || table.fixed_row_labels.length === 0
      || table.fixed_row_labels.some((label) => !isNonEmptyString(label))) {
      fail('TABLE_SHAPES_FIXED_ROW_LABELS', where);
    }
  } else if (table.fixed_row_labels !== undefined) {
    fail('TABLE_SHAPES_FIXED_ROW_LABELS_WITHOUT_FIXED_LIST', where);
  }
  if (table.additional_fixed_row_labels !== undefined) {
    if (table.rows_are !== 'fixed list') fail('TABLE_SHAPES_ADDITIONAL_ROWS_WITHOUT_FIXED_LIST', where);
    if (!Array.isArray(table.additional_fixed_row_labels)) fail('TABLE_SHAPES_ADDITIONAL_ROWS', where);
    table.additional_fixed_row_labels.forEach((row, index) => {
      if (!row || !isNonEmptyString(row.label) || !isNonEmptyString(row.reason)) {
        fail('TABLE_SHAPES_ADDITIONAL_ROW_ENTRY', `${where}.additional_fixed_row_labels[${index}]`);
      }
    });
  }
  for (const column of table.columns) {
    if (column.vocabulary_by_row === undefined) continue;
    for (const rowLabel of Object.keys(column.vocabulary_by_row)) {
      if (!(table.fixed_row_labels || []).includes(rowLabel)) fail('TABLE_SHAPES_VOCAB_BY_ROW_UNKNOWN_ROW', `${where}.${column.column_id}: ${rowLabel}`);
    }
    if (column.vocabulary_ref !== undefined) fail('TABLE_SHAPES_VOCAB_BY_ROW_WITH_VOCAB_REF', `${where}.${column.column_id}`);
  }
  for (const column of table.columns) {
    if (column.derived && Array.isArray(column.derived.rows)) {
      for (const rowLabel of column.derived.rows) {
        if (!(table.fixed_row_labels || []).includes(rowLabel)) fail('TABLE_SHAPES_DERIVED_ROWS_UNKNOWN_ROW', `${where}.${column.column_id}: ${rowLabel}`);
      }
    }
  }
  // The rows the page fills from stored generations' facts by a rule over
  // their words (lib/product/table-view.js): an article introduction's
  // facts go to intro_facts_row, the knowledge definition to
  // knowledge_facts_row (Ben, 2026-09-14: "look at the old system - we
  // should be able to show the reader the general categories of the
  // exceptions (SEC filings) and as they click into deeper levels show
  // more detail (last X days) etc"). Each names one of the fixed rows.
  for (const key of ['intro_facts_row', 'knowledge_facts_row']) {
    if (table[key] === undefined) continue;
    if (!isNonEmptyString(table[key]) || !(table.fixed_row_labels || []).includes(table[key])) fail('TABLE_SHAPES_PAGE_RULE_ROW_UNKNOWN', `${where}.${key}: ${table[key]}`);
  }
  // The capitalization table (Ben, 2026-09-14: "sure add a table"): a
  // stored generation's fact without a readout is placed by the page on
  // the fixed row of the security class its words name.
  if (table.row_from_security_class !== undefined) {
    if (typeof table.row_from_security_class !== 'boolean') fail('TABLE_SHAPES_ROW_FROM_SECURITY_CLASS', where);
    if (table.row_from_security_class && table.rows_are !== 'fixed list') fail('TABLE_SHAPES_ROW_FROM_SECURITY_CLASS_WITHOUT_FIXED_LIST', where);
  }
  if (table.show_only_when_populated !== undefined) {
    if (table.rows_are !== 'fixed list') fail('TABLE_SHAPES_SHOW_ONLY_WHEN_POPULATED_WITHOUT_FIXED_LIST', where);
    if (typeof table.show_only_when_populated !== 'boolean') fail('TABLE_SHAPES_SHOW_ONLY_WHEN_POPULATED', where);
  }
  if (table.split_combined_elements !== undefined && typeof table.split_combined_elements !== 'boolean') {
    fail('TABLE_SHAPES_SPLIT_COMBINED_ELEMENTS', where);
  }
  if (table.empty_band_is_error !== undefined && typeof table.empty_band_is_error !== 'boolean') {
    fail('TABLE_SHAPES_EMPTY_BAND_IS_ERROR', where);
  }
  if (table.per_step_structure !== undefined) {
    const columnIds = new Set(table.columns.map((c) => c.column_id));
    validatePerStepStructure(table.per_step_structure, `${where}.per_step_structure`, columnIds);
  }
}

function validateSectionV3(section, index, seenSectionKeys, seenTableKeys, familyKeySet, componentKindSet, sharedVocabularyIds) {
  const where = `sections[${index}]`;
  if (!section || typeof section !== 'object') fail('TABLE_SHAPES_SECTION', where);
  if (!isNonEmptyString(section.section_key)) fail('TABLE_SHAPES_SECTION_KEY', where);
  if (seenSectionKeys.has(section.section_key)) fail('TABLE_SHAPES_DUPLICATE_SECTION_KEY', section.section_key);
  seenSectionKeys.add(section.section_key);
  if (!isNonEmptyString(section.title)) fail('TABLE_SHAPES_SECTION_TITLE', where);
  if (section.legacy_config !== null && !isNonEmptyString(section.legacy_config)) {
    fail('TABLE_SHAPES_LEGACY_CONFIG', where);
  }
  if (section.print_pages !== undefined) {
    if (!Array.isArray(section.print_pages) || section.print_pages.some((p) => !Number.isInteger(p) || p <= 0)) {
      fail('TABLE_SHAPES_PRINT_PAGES', where);
    }
  }
  if (!Array.isArray(section.v2_family_keys) || section.v2_family_keys.length === 0) {
    fail('TABLE_SHAPES_FAMILY_KEYS', where);
  }
  for (const entry of section.v2_family_keys) {
    if (!entry || !isNonEmptyString(entry.key) || !CONFIDENCES.includes(entry.confidence)) {
      fail('TABLE_SHAPES_FAMILY_KEY_ENTRY', `${where}: ${JSON.stringify(entry)}`);
    }
    if (!familyKeySet.has(entry.key)) fail('TABLE_SHAPES_FAMILY_KEY_UNKNOWN', `${where}: ${entry.key}`);
  }
  if (section.kind !== undefined && !SECTION_KINDS.includes(section.kind)) {
    fail('TABLE_SHAPES_SECTION_KIND', `${where}: ${section.kind}`);
  }
  if (section.excluded_from_fact_tables !== undefined && typeof section.excluded_from_fact_tables !== 'boolean') {
    fail('TABLE_SHAPES_EXCLUDED_FROM_FACT_TABLES', where);
  }
  if (section.note !== undefined && !isNonEmptyString(section.note)) {
    fail('TABLE_SHAPES_SECTION_NOTE', where);
  }
  if (!Array.isArray(section.tables) || section.tables.length === 0) fail('TABLE_SHAPES_TABLES', where);
  section.tables.forEach((table, tableIndex) => validateTableV3(table, `${where}.tables[${tableIndex}]`, seenTableKeys, componentKindSet, sharedVocabularyIds));
}

// `factComponents` is the parsed contracts/product/fact-components.v2.json
// (or any object exposing the same `component.component_kinds` shape) --
// required so every column's fill_from can be checked against the real V2
// component-kind list rather than an inline copy that could drift from it.
function validateTableShapesV3(doc, legalSchema, factComponents) {
  if (!doc || doc.schema_version !== SCHEMA_VERSION_V3) {
    fail('TABLE_SHAPES_VERSION', `expected ${SCHEMA_VERSION_V3}`);
  }
  if (doc.status !== STATUS_V3) fail('TABLE_SHAPES_STATUS', String(doc.status));
  if (!Array.isArray(doc.generated_from) || doc.generated_from.length === 0
    || doc.generated_from.some((file) => !isNonEmptyString(file))) {
    fail('TABLE_SHAPES_GENERATED_FROM', 'expected a non-empty list of source file paths');
  }
  if (!Array.isArray(doc.sections) || doc.sections.length === 0) fail('TABLE_SHAPES_SECTIONS', 'expected at least one section');

  if (!legalSchema || !Array.isArray(legalSchema.families)) {
    fail('TABLE_SHAPES_LEGAL_SCHEMA', 'a V2 legal schema with families[] is required to validate against');
  }
  const familyKeySet = new Set(legalSchema.families.map((f) => f.family_key));

  if (!factComponents || !factComponents.component || !Array.isArray(factComponents.component.component_kinds)) {
    fail('TABLE_SHAPES_FACT_COMPONENTS', 'the FACT_COMPONENTS/V2 contract with component.component_kinds[] is required to validate fill_from against');
  }
  const componentKindSet = new Set(factComponents.component.component_kinds);

  const sharedVocabularyIds = validateSharedVocabularies(doc.shared_vocabularies, 'shared_vocabularies');

  const seenSectionKeys = new Set();
  const seenTableKeys = new Set();
  doc.sections.forEach((section, index) => validateSectionV3(
    section, index, seenSectionKeys, seenTableKeys, familyKeySet, componentKindSet, sharedVocabularyIds,
  ));

  return doc;
}

module.exports = {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
  STATUS_V3,
  SECTION_KINDS,
  HOVER_KINDS,
  RENDER_KINDS,
  VALUE_KINDS,
  TONES,
  CONFIDENCES,
  ROWS_ARE,
  SOURCES,
  TableShapesError,
  validateTableShapes,
  validateTableShapesV2,
  validateTableShapesV3,
};
