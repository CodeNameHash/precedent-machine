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
const ROWS_ARE = Object.freeze(['one per subject', 'fixed list']);

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

module.exports = {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V2,
  RENDER_KINDS,
  VALUE_KINDS,
  TONES,
  CONFIDENCES,
  ROWS_ARE,
  SOURCES,
  TableShapesError,
  validateTableShapes,
  validateTableShapesV2,
};
