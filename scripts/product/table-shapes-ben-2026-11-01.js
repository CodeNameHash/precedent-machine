'use strict';

// Ben, 2026-11-01, reading the provisions page of the three Sonnet runs
// (Apogee, Skechers, QXO): "No more feedback. Just go and do these, and make
// sure all these changes are systemic, right? Don't just fix one. Create
// changes that would go through all three of them." Every change below is
// a rule of the shapes that lib/product/table-view.js and
// components/product/ProvisionTables.jsx apply to every agreement; his
// words are quoted at the rule they set.
//
// Applied by scripts/product/build-table-shapes-pass3.js after decision 27
// (the section order), which it amends. Deterministic: reads nothing but the
// document it is handed.

const BEN = 'Ben, 2026-11-01, on the provisions page';

function findSection(doc, key) {
  const section = doc.sections.find((s) => s.section_key === key);
  if (!section) throw new Error(`SECTION_NOT_FOUND: ${key}`);
  return section;
}

function findTable(doc, key) {
  const table = doc.sections.flatMap((s) => s.tables).find((t) => t.table_key === key);
  if (!table) throw new Error(`TABLE_NOT_FOUND: ${key}`);
  return table;
}

function findColumn(table, columnId) {
  const column = table.columns.find((c) => c.column_id === columnId);
  if (!column) throw new Error(`COLUMN_NOT_FOUND: ${table.table_key}.${columnId}`);
  return column;
}

function moveSectionBefore(doc, key, beforeKey) {
  const index = doc.sections.findIndex((s) => s.section_key === key);
  if (index === -1) throw new Error(`SECTION_NOT_FOUND: ${key}`);
  const [section] = doc.sections.splice(index, 1);
  const target = doc.sections.findIndex((s) => s.section_key === beforeKey);
  if (target === -1) throw new Error(`SECTION_NOT_FOUND: ${beforeKey}`);
  doc.sections.splice(target, 0, section);
}

// 1. Section order. "I'd always put intervening event after superior
// proposal."; "capitalization. I stick it right at the bottom, like it
// wouldn't have its own section. If I did, I think you kind of have to. I
// put it right at the bottom, above definition or below definition."
function applySectionOrder(doc) {
  moveSectionBefore(doc, 'nosol-superior', 'nosol-intervening');
  findSection(doc, 'nosol-superior').placement_reason = `${BEN}: "I'd always put intervening event after superior proposal."`;
  moveSectionBefore(doc, 'capitalization', 'defined-terms');
  const capitalization = findSection(doc, 'capitalization');
  capitalization.rail = { group: 'Capitalization', label: 'Capitalization', hex: '#3F8A6A' };
  capitalization.placement_reason = `${BEN}: "capitalization. I stick it right at the bottom ... above definition or below definition." Placed last, above Defined Terms.`;
}

// 2. Structure & Mechanics: two headline lines, the rest under Other
// provisions. "In this first section, structure mechanics, I just show deal
// structure, merger form, and then just say 'Other provisions.' I put the
// other ones into 'Other provisions' and just show those too."
function applyStructureHeadline(doc) {
  const table = findTable(doc, 'structure-mechanics-table');
  table.headline_columns = ['dealStructure', 'mergerFormStep1', 'mergerFormStep2'];
  table.headline_reason = `${BEN}: "I just show deal structure, merger form, and then just say 'Other provisions.' I put the other ones into 'Other provisions' and just show those too." Every other attribute line of the grid is an Other provisions line (lib/product/table-view.js moveHeadlineRest).`;
}

// 3. The consideration grid: the type and the appraisal line stay; the type
// is read from the per-share forms when no fact codes it; withholding and
// without-interest go under Other provisions. "In consideration, why is
// consideration type empty? We know it's cash below. Phrase it right.
// Withholding without interest: those should go into 'Other provisions.'
// What are you trying to get at with 'without interest'? I'm not quite
// sure."
function applyConsiderationGrid(doc) {
  const table = findTable(doc, 'consideration-structure');
  table.headline_columns = ['considerationType', 'appraisalRights'];
  table.headline_reason = `${BEN}: "Withholding without interest: those should go into 'Other provisions.' What are you trying to get at with 'without interest'? I'm not quite sure."`;
  table.type_from_components = {
    column_id: 'considerationType',
    components_table_key: 'consideration-components',
    form_column: 'form',
    options_table_key: 'consideration-election-options',
    reason: `${BEN}: "why is consideration type empty? We know it's cash below. Phrase it right." When no fact codes the type, the page reads it from the per-share forms (and the election options) below (lib/product/table-view.js deriveConsiderationType).`,
  };
}

// 4. The per-share table. "In cash in consideration, you got component, and
// then the next thing is form cash. It's a bit weird, and the 'per' is kind
// of weird as well. Think about that." The Form column names the row and
// is not shown again; "Per" is said after the amount. On an election: "I
// think you have to make it so clear it's an election. You do say 'mixed
// election.' In 'consideration per share,' I think it needs to be really
// clear: there's an election. It's this thing or it's this thing. I'm even
// thinking maybe put 'consideration type: mixed election' immediately below
// it. That's where you put the per-share action mechanic."
function applyPerShareTable(doc) {
  const table = findTable(doc, 'consideration-components');
  table.show_row_column = false;
  table.show_row_column_reason = `${BEN}: "you got component, and then the next thing is form cash. It's a bit weird". The form names the row; it is not a cell as well.`;
  const per = findColumn(table, 'per');
  per.display = 'suffix_of';
  per.suffix_of = 'amount';
  per.display_reason = `${BEN}: "the 'per' is kind of weird as well. Think about that." Said after the amount ("$135.11 per share of Company Common Stock"), never a cell of its own.`;
  table.row_column_words_fill = 'amount';
  table.row_column_words_fill_reason = 'A stock leg whose ratio is words ("one Parent Unit") shows those words where the amount would be, so the row is never blank.';
  table.election_note = { reason: `${BEN}: "I think you have to make it so clear it's an election ... maybe put 'consideration type: mixed election' immediately below it. That's where you put the per-share action mechanic." (lib/product/table-view.js electionGroupsFor)` };
}

// 5. The votes table: the anchor is said after the period. "I don't think
// you need all the detail columns immediately: 'votes,' 'approvals.' It's
// weird to have 14 calendar days, then a separate column after the
// agreement date. I think those two things need to be shown together."
function applyVotesAnchor(doc) {
  const table = findTable(doc, 'votes-approvals-meeting-table');
  const anchor = findColumn(table, 'anchor');
  anchor.display = 'suffix_of';
  anchor.suffix_of = 'value';
  anchor.display_reason = `${BEN}: "It's weird to have 14 calendar days, then a separate column after the agreement date. I think those two things need to be shown together."`;
}

// 6. Representations: the General Exceptions and Knowledge rows are a table
// of their own, first, without the bring-down column, its code column
// called Terms. "Directly under reps and warranties, you have this text ...
// Get rid of that because that's what you have under the general
// exceptions, and you need it twice. Have [a] separate table first. It's
// like general exception ... SEC filings, disclosure, which makes sense.
// There isn't a bring-down standard for the exceptions, though, so those
// columns should be empty. The qualifiers: it's not really a qualifier,
// right? It's more like, I don't know, a different word."
function applyExceptionsTable(doc) {
  for (const key of ['representations-qualifiers-table', 'parent-representations-qualifiers-table']) {
    const table = findTable(doc, key);
    table.leading_table = {
      table_key: `${key}-exceptions`,
      group_header: 'GENERAL EXCEPTIONS',
      from_rows: ['General Exceptions', 'Knowledge'],
      rows_from_sub_rows: ['General Exceptions'],
      drop_columns: ['bringdown'],
      column_headers: { materiality: 'Terms' },
      term_header: 'Exception',
      reason: `${BEN}: "have a separate table first ... general exception ... SEC filings, disclosure ... There isn't a bring-down standard for the exceptions, though, so those columns should be empty. The qualifiers: it's not really a qualifier, right?" (lib/product/table-view.js splitLeadingTable)`,
    };
  }
}

// 7. Registration rights: the summary, the coded columns behind "Show
// specifics". "[Registration] rights. Need a summary here. You don't need
// it as drafted."
function applyRegistrationRightsSummary(doc) {
  const table = findTable(doc, 'consideration-registration-rights');
  table.summary_only = true;
  table.summary_only_reason = `${BEN}: "[Registration] rights. Need a summary here. You don't need it as drafted."`;
}

function applyBen20261101(doc) {
  applySectionOrder(doc);
  applyStructureHeadline(doc);
  applyConsiderationGrid(doc);
  applyPerShareTable(doc);
  applyVotesAnchor(doc);
  applyExceptionsTable(doc);
  applyRegistrationRightsSummary(doc);
}

module.exports = { applyBen20261101 };
