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

// ---------------------------------------------------------------------------
// Round 2, the same day, on the page after the rules above ("Overall, this is
// better for sure. It's not good, but it's better."). Each rule is data on
// the shape; lib/product/table-view.js applies it to every agreement.
// ---------------------------------------------------------------------------
const BEN2 = 'Ben, 2026-11-01, second read of the provisions page';

function allTables(doc) {
  return doc.sections.flatMap((s) => s.tables);
}

// 8. The General Exceptions: a disclosure that qualifies other sections
// where reasonably apparent is not "only" the section it is made against.
// "In the disclosure letter, under representations and warranties, in the
// general exceptions, you say, 'disclosure qualifies only the section
// against which it's made,' and then you next say, 'disqualify: disclosure
// qualifies other sections where reason is apparent.' You can't have the
// 'only' right." A column's drop_when_present removes the first code from a
// cell that also carries the second (lib/product/table-view.js
// resolveCodeConflicts).
function applyDisclosureOnlyConflict(doc) {
  for (const key of ['representations-qualifiers-table', 'parent-representations-qualifiers-table']) {
    const column = findColumn(findTable(doc, key), 'materiality');
    column.drop_when_present = [{
      drop: 'SECTION_SPECIFIC_ONLY',
      when: 'CROSS_SECTION_WHERE_REASONABLY_APPARENT',
      reason: `${BEN2}: "You can't have the 'only' right."`,
    }];
  }
}

// 9. Several bring-down standards on one representation read "Various".
// "In the table of reps, where it says 'bring down standard' and there are
// multiple standards for one thing, I would say 'various'." A column's
// many_as is the word a cell of several distinct readings shows; the
// readings stay behind it (lib/product/table-view.js collapseManyAs).
function applyBringDownVarious(doc) {
  for (const key of ['representations-qualifiers-table', 'parent-representations-qualifiers-table']) {
    const column = findColumn(findTable(doc, key), 'bringdown');
    // Round 4 (Ben, 2026-11-01 afternoon) supersedes "Various": "I don't
    // think the 'bring down standard' as 'various' is correct - only a small
    // number of reps come down de minimis or material, the vast majority are
    // MAE and they're not subdivided within the reps except in very special
    // situations ... where they are multiple qualifiers try and say Generally
    // X but certain portions Y". The bring-down is derived per rep
    // (lib/product/table-view.js deriveBringDownForRow); a cell that still
    // carries several readings reads "Generally X; certain portions Y".
    column.many_as = 'generally';
    column.many_as_reason = `Ben, 2026-11-01, round 4: "where they are multiple qualifiers try and say Generally X but certain portions Y".`;
    column.bring_down_default = { side_table: key === 'representations-qualifiers-table' ? 'conditions-b-table' : 'conditions-s-table', reason: `Ben, 2026-11-01, round 4: "the vast majority are MAE": every rep takes the agreement's general bring-down unless a specific tier names it.` };
    const qualifiers = findColumn(findTable(doc, key), 'materiality');
    qualifiers.many_as = 'generally';
    qualifiers.many_as_reason = `Ben, 2026-11-01, round 4: "The same is true of the qualifiers ... where they are multiple qualifiers try and say Generally X but certain portions Y".`;
  }
}

// 10. No-shop mechanics. "In no-shop… return or destruction information, it
// should say 'required' and the time period. Same on the data room: it
// should say 'immediately.'" A coded cell is refined by the fact's own
// words (refine_by_words: REQUIRED read beside "immediately" is REQUIRED_
// IMMEDIATELY) and a table with period_suffix_from_words says the stated
// period after the answer ("Required, within two (2) business days") when
// it has no period column of its own. "You have two different ones…
// 'shall cause' and… 'shall instruct.' Why do we get two different things?
// It is because there are different obligations, which should be clear."
// and "I'd say 'representative breach' is 'company breach.' I'd have that
// showing at the same time.": the sub-row is a row of its own
// (sub_rows_as_rows); each reading of a cell read from different facts
// carries that fact's summary as its qualifier (table-view qualifyReadings).
function applyNoShopMechanics(doc) {
  const table = findTable(doc, 'nosol-noshop-core-mechanics');
  const provision = findColumn(table, 'provision');
  provision.refine_by_words = [{
    code: 'REQUIRED', when: '\\bimmediately\\b', to: 'REQUIRED_IMMEDIATELY',
    reason: `${BEN2}: "Same on the data room: it should say 'immediately.'"`,
  }];
  table.period_suffix_from_words = { column_id: 'provision', codes: ['REQUIRED', 'REQUIRED_WITHIN_STATED_PERIOD'], reason: `${BEN2}: "return or destruction information, it should say 'required' and the time period."` };
  table.sub_rows_as_rows = true;
  table.qualify_readings = true;
  table.qualify_readings_reason = `${BEN2}: "'shall cause' and… 'shall instruct.' Why do we get two different things? It is because there are different obligations, which should be clear."`;
  table.sub_rows_as_rows_reason = `${BEN2}: "I'd say 'representative breach' is 'company breach.' I'd have that showing at the same time."`;
}

// 11. Antitrust. "Change the words to 'vestiture cap' in answers regulatory
// to 'remedies cap.'" The row is renamed everywhere the shape names it and
// the old label is kept as an alias so stored readouts still land on it.
// "In regulatory litigation, you say 'must defend,' but it also says
// 'contest and resist.' I think that includes appeals.": MUST_DEFEND read
// beside "contest and resist" (or "appeal") is MUST_DEFEND_INCLUDING_APPEALS.
const REMEDY_ROW_OLD = 'Remedy commitment (divestiture cap)';
const REMEDY_ROW_NEW = 'Remedies cap';

function renameRow(table, from, to) {
  const swap = (value) => (value === from ? to : value);
  if (Array.isArray(table.fixed_row_labels)) table.fixed_row_labels = table.fixed_row_labels.map(swap);
  if (table.subtype_rows) for (const key of Object.keys(table.subtype_rows)) table.subtype_rows[key] = swap(table.subtype_rows[key]);
  if (table.detail_labels_by_row && table.detail_labels_by_row[from]) { table.detail_labels_by_row[to] = table.detail_labels_by_row[from]; delete table.detail_labels_by_row[from]; }
  for (const rule of table.words_rows || []) rule.row_label = swap(rule.row_label);
  for (const column of table.columns || []) {
    for (const field of ['code_from_words_by_row', 'vocabulary_by_row', 'detail_from_words_by_row']) {
      const byRow = column[field];
      if (byRow && byRow[from]) { byRow[to] = byRow[from]; delete byRow[from]; }
    }
  }
  table.row_aliases = { ...(table.row_aliases || {}), [from]: to };
}

function applyAntitrust(doc) {
  const table = findTable(doc, 'antitrust-regulatory-table');
  renameRow(table, REMEDY_ROW_OLD, REMEDY_ROW_NEW);
  table.row_aliases_reason = `${BEN2}: "Change the words to 'vestiture cap' in answers regulatory to 'remedies cap.'"`;
  const provision = findColumn(table, 'provision');
  provision.refine_by_words = [{
    code: 'MUST_DEFEND', when: 'contest\\s+and\\s+resist|\\bappeals?\\b', to: 'MUST_DEFEND_INCLUDING_APPEALS',
    reason: `${BEN2}: "In regulatory litigation, you say 'must defend,' but it also says 'contest and resist.' I think that includes appeals."`,
  }];
}

// 12. Interim operating covenants. "Informative covenants: this is actually
// a coding error. You have this control of operations by the company.
// That's not in the general intro. That language is coming from right at
// the end of the provision. It's boilerplate… so it's in the wrong place."
// A fact whose own words are the control-of-operations boilerplate is not
// an affirmative covenant row: route_by_words sends it to the table's Other
// provisions (lib/product/table-view.js applyPageRules).
function applyControlOfOperations(doc) {
  for (const key of ['ioc-exceptions-affirmative-covenants', 'parent-ioc-exceptions-affirmative-covenants', 'ioc-exceptions-negative-covenants', 'parent-ioc-exceptions-negative-covenants']) {
    const table = findTable(doc, key);
    table.route_by_words = [{
      when: 'complete\\s+control\\s+and\\s+supervision|(?:give|grant)s?\\s+(?:to\\s+)?(?:Parent|Buyer|Purchaser|Acquiror|Acquirer)[^.]{0,80}\\bcontrol\\b',
      to: 'other_provisions',
      reason: `${BEN2}: "You have this control of operations by the company. That's not in the general intro. That language is coming from right at the end of the provision. It's boilerplate… so it's in the wrong place."`,
    }];
  }
}

// 13. The board determination standard. "In the board determination
// standard, you need to capture the 'would' as well, not just go straight
// to 'inconsistent.'" The code's label, wherever the vocabulary carries it.
function applyWouldBeInconsistent(doc) {
  for (const table of allTables(doc)) {
    for (const column of table.columns || []) {
      const lists = [column.vocabulary, ...Object.values(column.vocabulary_by_row || {})].filter(Array.isArray);
      for (const list of lists) {
        for (const entry of list) {
          if (entry.code === 'INCONSISTENT_WITH_FIDUCIARY_DUTIES' && entry.label === 'Inconsistent with fiduciary duties') {
            entry.label = 'Would be inconsistent with fiduciary duties';
            entry.label_reason = `${BEN2}: "you need to capture the 'would' as well, not just go straight to 'inconsistent.'"`;
          }
        }
      }
    }
  }
}

// 14. Registration rights. "'Registration rights,' I sort of hide as an
// other thing." The table's facts are its Other provisions block, nothing
// else (supersedes rule 7's summary_only).
function applyRegistrationRightsAsOther(doc) {
  const table = findTable(doc, 'consideration-registration-rights');
  delete table.summary_only;
  delete table.summary_only_reason;
  table.rows_as_other_provisions = { label: 'Registration rights', reason: `${BEN2}: "'Registration rights,' I sort of hide as an other thing."` };
}

// 15. The consideration type with its components laid out under it. "As I
// said before, I'd rather have 'consideration type' and then, immediately
// under it, have the components laid out. I think that would be much
// better, maybe as a subrow or something" and, on Skechers, "I still think
// this consideration thing sucks… think visually about how to make this
// mix selection, cast selection thing clearer. There are two options."
// embed_components: the per-share rows (grouped by election option) become
// sub-lines of the type cell; the per-share and options tables go behind
// "Show specifics" (lib/product/table-view.js embedConsiderationOptions).
function applyConsiderationEmbed(doc) {
  const table = findTable(doc, 'consideration-structure');
  table.type_from_components.embed_components = true;
  table.type_from_components.embed_reason = `${BEN2}: "I'd rather have 'consideration type' and then, immediately under it, have the components laid out ... maybe as a subrow or something"; "There are two options."`;
}

// 16. Election mechanics. "'Election mechanics' really suck… completely new
// look at that sort of ab initio." First step of that look: the table had
// no term column, so its rows (Election caps, Election deadline,
// Oversubscription / proration, If no election) ran together as an unnamed
// list of sentences. Each row is now named; the coded rows (election form,
// deadline, revocation, non-election default, proration cap, allocation
// timing) are the next piece of shape work, recorded as not done in plan
// finding (309).
function applyElectionMechanicsTerms(doc) {
  const table = findTable(doc, 'consideration-hero-election-mechanics');
  table.term_column = { header: 'Term', source: 'subject' };
  table.term_column_reason = `${BEN2}: "'Election mechanics' really suck… completely new look at that sort of ab initio." The rows are named; the coded rows are the next piece.`;
}

// 17. Round 3, 2026-11-01, Ben on the phone: "Is there no cap on election in
// Sketchers": the cap is a defined term ("Maximum Equity Election Cap"
// means 29,920,623 shares) no mechanics fact carried; the caps row reads
// such terms (lib/product/table-view.js, caps_from_defined_terms).
function applyElectionCapsFromDefinedTerms(doc) {
  const table = findTable(doc, 'consideration-hero-election-mechanics');
  table.caps_from_defined_terms = {
    row_label: 'Election caps',
    term_words: '(?:Election|Equity|Cash|Stock)\\s+(?:Election\\s+)?(?:Cap|Number|Maximum|Limit)|Maximum\\s+(?:\\w+\\s+){0,3}Election',
    reason: `${BEN2} (round 3): "Is there no cap on election in Sketchers"`,
  };
}

// 18. Round 3: "In the employee matters or the other protections section,
// I'd have the other protections sort of hidden. You have to click to open
// them." The table's rows fold behind the toggle, closed to start.
function applyOtherProtectionsHidden(doc) {
  const table = findTable(doc, 'employee-benefits-other-protections');
  table.collapsible_rows = true;
  table.rows_start_collapsed = true;
  table.rows_start_collapsed_reason = `${BEN2} (round 3): "I'd have the other protections sort of hidden. You have to click to open them."`;
}

// 19. Plan finding (311), the persistence audit ("make sure that what you've
// built is a persistent system, and that we haven't just put protections or
// UI tweaks on top of systemic failures below ... if you did reextract this
// stuff, it would work properly"). Where a (309) page rule stood in for a
// gap in what the extractor is asked, the shape now asks for it, so a
// re-extraction stores the right thing and the page rule is a repair for
// older facts only.
function applyPersistence(doc) {
  // (a) The no-shop rows the page refines to REQUIRED_IMMEDIATELY may carry
  // that code at extraction, and the table has a period column for "within
  // two (2) business days" (the notice table's column, as decision 34
  // added it there).
  const core = findTable(doc, 'nosol-noshop-core-mechanics');
  const provision = findColumn(core, 'provision');
  for (const row of ['Return or destruction of information', 'Data-room access terminated']) {
    const list = provision.vocabulary_by_row[row];
    if (list && !list.includes('REQUIRED_IMMEDIATELY')) list.unshift('REQUIRED_IMMEDIATELY');
  }
  if (!core.columns.some((column) => column.column_id === 'period')) {
    const notice = findColumn(findTable(doc, 'nosol-noshop-notice'), 'period');
    core.columns.splice(core.columns.findIndex((column) => column.display === 'fact_text'), 0, {
      ...notice,
      reason: `${BEN2} (persistence audit): "it should say 'required' and the time period." The period a return or destruction must be requested within, read at extraction from the PERIOD component; shown after the answer.`,
    });
  }
  core.guidance = `${core.guidance} "Immediately" (immediately cease, immediately discontinue access) is REQUIRED_IMMEDIATELY on its row, never plain REQUIRED; a period the clause states ("within two (2) business days") fills the period column.`;

  // (b) Antitrust: Ben's reading of "contest and resist".
  const antitrust = findTable(doc, 'antitrust-regulatory-table');
  antitrust.guidance = `${antitrust.guidance} On Regulatory litigation, a covenant to contest and resist (or to contest, resist or appeal) any proceeding is MUST_DEFEND_INCLUDING_APPEALS, not MUST_DEFEND (Ben, 2026-11-01: "it also says 'contest and resist.' I think that includes appeals").`;

  // (c) The control-of-operations boilerplate is not a covenant row.
  for (const key of ['ioc-exceptions-affirmative-covenants', 'parent-ioc-exceptions-affirmative-covenants', 'ioc-exceptions-negative-covenants', 'parent-ioc-exceptions-negative-covenants']) {
    const table = findTable(doc, key);
    table.guidance = `${table.guidance || ''} The control-of-operations boilerplate at the end of the covenant ("nothing in this Agreement gives Parent the right to control or direct the Company's operations"; "the Company shall exercise complete control and supervision over its operations") is not a covenant row of this table: give it no row_label here; the page lists it under Other provisions (Ben, 2026-11-01: "It's boilerplate… so it's in the wrong place").`.trim();
  }

  // (d) The election cap. A consideration fact whose words state a maximum
  // election number or cap is the Election caps row; the §1.1 definition
  // of a cap reaches the row through caps_from_defined_terms.
  const mechanics = findTable(doc, 'consideration-hero-election-mechanics');
  mechanics.words_rows = [...(mechanics.words_rows || []), {
    row_label: 'Election caps',
    when: 'Maximum\\s+(?:\\w+\\s+){0,3}Election\\s+(?:Cap|Number|Amount)|(?:Cash|Stock|Equity|Mixed)\\s+Election\\s+(?:Cap|Number)|election[^.]{0,80}\\b(?:capped|cap of|not exceed|maximum)',
    reason: `${BEN2} (round 3): "Is there no cap on election in Sketchers"`,
  }];
  mechanics.guidance = `${mechanics.guidance} A cap or maximum on an election (the Maximum Cash Election Number; "Maximum Equity Election Cap" means 29,920,623 shares) is the Election caps row, its as-drafted cell the words that state the number.`;

  // (e) The Disclosure Letter code's label says what the clause says.
  for (const table of allTables(doc)) {
    for (const column of table.columns || []) {
      for (const entry of column.vocabulary || []) {
        if (entry.code === 'SECTION_SPECIFIC_ONLY' && entry.label === 'Disclosure qualifies only the section it is made against') {
          entry.label = 'Disclosure qualifies the section it is made against';
          entry.label_reason = `${BEN2}: "You can't have the 'only' right." The clause that arranges disclosure by section says that; whether it also reaches other sections is CROSS_SECTION_WHERE_REASONABLY_APPARENT.`;
        }
      }
    }
  }
}

function applyBen20261101(doc) {
  applySectionOrder(doc);
  applyStructureHeadline(doc);
  applyConsiderationGrid(doc);
  applyPerShareTable(doc);
  applyVotesAnchor(doc);
  applyExceptionsTable(doc);
  applyRegistrationRightsSummary(doc);
  applyDisclosureOnlyConflict(doc);
  applyBringDownVarious(doc);
  applyNoShopMechanics(doc);
  applyAntitrust(doc);
  applyControlOfOperations(doc);
  applyWouldBeInconsistent(doc);
  applyRegistrationRightsAsOther(doc);
  applyConsiderationEmbed(doc);
  applyElectionMechanicsTerms(doc);
  applyElectionCapsFromDefinedTerms(doc);
  applyOtherProtectionsHidden(doc);
  applyPersistence(doc);
  applyClearSkies(doc);
  applyNoOtherRepsSides(doc);
  applyCarveOutProvisos(doc);
}

// 22. Round 4 (Ben: "Carve-back provisos as drafted - why is this showing
// up?"): the footer is the provisos to the carve-outs, each named by what it
// is and each distinct one once (lib/product/table-view.js
// groupFooterEntries).
function applyCarveOutProvisos(doc) {
  for (const table of allTables(doc)) {
    const footer = table.footer_from_subtype;
    if (!footer || !Array.isArray(footer.subtype_keys) || !footer.subtype_keys.includes('DISPROPORTIONALITY_CARVEBACK')) continue;
    footer.label = 'Provisos to the carve-outs';
    footer.kind_labels = { DISPROPORTIONALITY_CARVEBACK: 'Disproportionality carve-back', UNDERLYING_CAUSE_RESTORATION: 'Underlying cause still counts' };
    footer.label_reason = `Ben, 2026-11-01, round 4: "Carve-back provisos as drafted - why is this showing up?" The underlying-cause proviso is not a carve-back; each distinct proviso is shown once.`;
  }
}

// 21. Round 4 (Ben, 2026-11-01): "for no other reps/fraud, why does that not
// show resulting rows in QXO? Check the basic requirements you need from
// Abry partners but I think it is each party giving a rep (i) they
// acknowledge the other side has given no reps than in the agreement and
// (ii) they have relied on no other reps than those in the agreement. But
// maybe there is one or two other things?" QXO's five facts came back
// without a readout and the table had no rule to place one. side_rows
// places a fact by its subtype and by whose representations it is about:
// a no-other-reps disclaimer is the maker's (the party that "disclaims" or
// that "neither ... makes"), a non-reliance or investigation acknowledgment
// the acknowledging party's (lib/product/fact-conclusions.js
// defaultConclusions, so at extraction and on the page alike). The ABRY
// rows beyond Ben's two: the buyer's independent investigation, and the
// fraud carve-out (ABRY Partners v. F&W Acquisition (Del. Ch. 2006): a
// party cannot contract out of liability for its own fraud in the
// agreement's representations; a non-reliance clause in the buyer's own
// voice is what bars extra-contractual fraud claims).
function applyNoOtherRepsSides(doc) {
  const table = findTable(doc, 'no-other-reps-fraud-table');
  for (const label of ['Buyer independent investigation', 'Seller independent investigation']) {
    if (!table.fixed_row_labels.includes(label)) table.fixed_row_labels.splice(table.fixed_row_labels.indexOf('Fraud carve-out'), 0, label);
  }
  const status = table.columns.find((column) => column.column_id === 'status');
  if (status && status.vocabulary_by_row) {
    for (const label of ['Buyer independent investigation', 'Seller independent investigation']) status.vocabulary_by_row[label] = status.vocabulary_by_row[label] || ['YES', 'SILENT', 'NO'];
  }
  table.side_rows = {
    seller_words: '\\b(?:the\\s+)?(?:Company|Target|Seller|Sellers)\\b',
    buyer_words: '\\b(?:the\\s+)?(?:Parent|Buyer|Buyers|Buyer Parties|Purchaser|Acquir(?:o|e)r|Guarantor|(?:[A-Z][a-z]+\\s+)?Merger Subs?)\\b',
    column_id: 'status',
    code: 'YES',
    by_subtype: {
      NO_OTHER_REPRESENTATIONS_DISCLAIMER: { side: 'maker', rows: { seller: 'Seller no-other-reps', buyer: 'Buyer no-other-reps' } },
      NON_RELIANCE_ACKNOWLEDGMENT: { side: 'actor', rows: { seller: 'Seller non-reliance', buyer: 'Buyer non-reliance' } },
      INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT: { side: 'actor', rows: { seller: 'Seller independent investigation', buyer: 'Buyer independent investigation' } },
    },
    reason: `Ben, 2026-11-01, round 4: "why does that not show resulting rows in QXO? ... (i) they acknowledge the other side has given no reps than in the agreement and (ii) they have relied on no other reps".`,
  };
  table.guidance = `${table.guidance || ''} Rows by whose representations the clause concerns: a disclaimer of other representations is the maker's no-other-reps row (Seller for the Company's reps, Buyer for Parent's and the merger subs'); an acknowledgment that one is not relying on other representations is that party's non-reliance row; an acknowledgment of one's own independent investigation is that party's independent investigation row; a clause preserving claims for fraud is Fraud carve-out.`.trim();
}

// 20. Round 4 (Ben, 2026-11-01): "on AT for the non-impediment covenant (i)
// add 'Clear Skies' after it and then in period you should say outside date
// rather than giving the date". The row is renamed (the old label an alias
// for stored readouts); a period that is the agreement's Outside Date reads
// "Outside Date" (lib/product/table-view.js, outside_date_words).
function applyClearSkies(doc) {
  const table = findTable(doc, 'antitrust-regulatory-table');
  renameRow(table, 'Non-impediment covenant', 'Non-impediment covenant (clear skies)');
  table.outside_date_words = { column_id: 'period', label: 'Outside Date', reason: `Ben, 2026-11-01, round 4: "in period you should say outside date rather than giving the date".` };
}

module.exports = { applyBen20261101 };
