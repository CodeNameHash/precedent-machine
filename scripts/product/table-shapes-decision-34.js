'use strict';

// Decision 34 (2026-09-14). Ben, on the generation-3 Antitrust / Regulatory
// table: "while it does produce, it doesn't create terms with usable names.
// Also meaning is lost ... Also why wasn't the ordering/provisions from the
// precedent used? ... I've had to point out and fix every row"; on the
// no-shop: "the term and prohibited actions are from wholly different
// sections and then a ton of detail is missing from the no shop / fiduciary
// section ... they also don't answer their own questions - e.g. what is the
// representative control standard?"; on Intervening Event: "completely
// misleading ... it doesn't talk about the match periods etc"; and on the
// specification to build to: "why would you use top build? You know it is
// missing many provisions. Use bain/envestnet".
//
// The rule, applied to every section below: each table is the precedent's
// row list (the old app's Envestnet review page, replayed by
// scripts/product/legacy-review-print.js as data) and every column is
// exactly one of a coded vocabulary, a number, a yes / no, or the fact as
// drafted (its own words in full). No column shows a cited fragment. Rows
// whose answer comes from another family (the Company's termination right
// for a Superior Proposal on the no-shop table; the appraisal provision on
// the consideration grid) are derived by the page from that family's facts,
// never coded by the extractor.
//
// Applied by scripts/product/build-table-shapes-pass3.js after decisions
// 1-33 and before the section order (decision 27). Deterministic: no dates,
// no randomness, reads nothing but the document it is handed.

const BEN = "Ben's decision 2026-09-14 (decision 34)";
const WP13 = 'Work package 13 (c), 2026-10-18 (plan finding (79), NCS generation 5, 2.1)';
const WP16 = 'Work package 16, 2026-10-18 (plan finding (85), Ben on the election options table)';

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

function code(label, reason, options = {}) {
  return { code: options.code || slug(label), label, tone: options.tone || 'neutral', addition: true, reason };
}

function ensureFamily(section, familyKey) {
  if (!section.v2_family_keys.some((entry) => entry.key === familyKey)) {
    section.v2_family_keys.push({ key: familyKey, confidence: 'high' });
  }
}

// The fact as drafted: its own words in full, the cited words the click
// target (decision 26 made this the rule for detail columns).
// Work package 18 (g): a verbatim column the page fills from the fact's own
// components of the named kinds when the readout leaves it empty
// (fill_from_components), hidden when no row fills it.
function byWhenColumn(reason) {
  return {
    column_id: 'byWhen',
    header: 'By when',
    render: 'verbatim',
    fill_from: ['TRIGGER', 'PERIOD'],
    fill_from_components: true,
    addition: true,
    reason,
    guidance: 'The deadline or trigger the covenant states (a period before or after a date; "promptly following the Closing Date"), the TRIGGER and PERIOD components\' words in source order; the page fills it from the components when the readout has no cell.',
  };
}

function asDrafted(reason, fillFrom = ['OPERATION', 'OBJECT', 'CONDITION', 'STANDARD', 'EXCEPTION', 'QUALIFIER']) {
  return {
    column_id: 'asDrafted',
    header: 'As drafted',
    render: 'verbatim',
    display: 'fact_text',
    fill_from: fillFrom,
    addition: true,
    reason,
    guidance: 'Shown as the fact\'s own words as drafted (every component in source order); cite the operative words.',
  };
}

function periodColumn(header, reason, columnId = 'period') {
  return { column_id: columnId, header, render: 'value', value_kind: 'PERIOD', fill_from: ['PERIOD', 'TRIGGER', 'DATE'], addition: true, reason };
}

function yesNo(reason) {
  return [code('Yes', reason, { code: 'YES' }), code('No', reason, { code: 'NO' })];
}

// A Term / Provision table: the precedent's rows, one coded Provision
// column whose codes are listed per row, optional number columns, and the
// fact as drafted. `rows` is [[rowLabel, [entries]]] in the precedent's
// order; an entry is a vocabulary entry from code().
function provisionTable({ tableKey, groupHeader = null, termHeader = 'Term', rows, numberColumns = [], reason, guidance, subtypeRows, openRows = false, subtypeKeys, absentRowLabel }) {
  const vocabulary = [];
  const byRow = {};
  for (const [rowLabel, entries] of rows) {
    if (!entries || entries.length === 0) continue;
    byRow[rowLabel] = entries.map((entry) => entry.code);
    for (const entry of entries) {
      if (!vocabulary.some((existing) => existing.code === entry.code)) vocabulary.push(entry);
    }
  }
  const table = {
    table_key: tableKey,
    group_header: groupHeader,
    term_column: { header: termHeader, source: 'subject', fill_from: ['TERM'] },
    columns: [
      {
        column_id: 'provision',
        header: 'Summary',
        render: 'vocabulary',
        vocabulary,
        vocabulary_by_row: byRow,
        fill_from: ['STANDARD', 'EFFORTS_STANDARD', 'OPERATION', 'CONDITION', 'EXCEPTION', 'QUALIFIER', 'ACTOR', 'FORUM'],
        addition: true,
        reason,
        guidance: 'One code from this row\'s own list (vocabulary_by_row); several cells with distinct codes when the clause states several of them (the acts a no-shop prohibits, the events an intervening-event definition excludes); never a code from another row\'s list.',
      },
      ...numberColumns,
      asDrafted(reason),
    ],
    rows_are: 'fixed list',
    fixed_row_labels: rows.map(([rowLabel]) => rowLabel),
    ...(openRows ? { open_rows: true } : {}),
    ...(subtypeRows ? { row_from_subtype: true, subtype_rows: subtypeRows } : {}),
    ...(subtypeKeys ? { subtype_keys: subtypeKeys } : {}),
    ...(absentRowLabel ? { absent_row_label: absentRowLabel } : {}),
    guidance,
  };
  return table;
}

// ==========================================================================
// Antitrust / Regulatory: the Envestnet rows (Efforts standard, Divestiture
// cap, Regulatory litigation, HSR filing deadline, Non-HSR filings, Strategy
// control, Consultation rights) plus the schema's other regulatory subtypes,
// each row named from the fact's subtype.
// ==========================================================================

function applyAntitrust(doc) {
  const section = findSection(doc, 'antitrust-regulatory');
  const why = `${BEN}: the Antitrust / Regulatory table is the precedent's row list with a coded Provision per row, a period where the row is a deadline, and the covenant as drafted.`;
  const rows = [
    ['Efforts standard', [
      code('Reasonable best efforts', why, { code: 'REASONABLE_BEST_EFFORTS' }),
      code('Best efforts', why, { code: 'BEST_EFFORTS' }),
      code('Commercially reasonable efforts', why, { code: 'COMMERCIALLY_REASONABLE_EFFORTS' }),
      code('Hell or high water (take all actions necessary)', why, { code: 'HELL_OR_HIGH_WATER' }),
    ]],
    ['Filing deadline', [
      code('HSR filing within a stated period', why, { code: 'HSR_FILING_WITHIN_STATED_PERIOD' }),
      code('HSR filing as promptly as practicable', why, { code: 'HSR_FILING_AS_PROMPTLY_AS_PRACTICABLE' }),
    ]],
    ['Other regulatory filings', [
      code('Required, as promptly as practicable', why, { code: 'REQUIRED_AS_PROMPTLY_AS_PRACTICABLE' }),
      code('Required, within a stated period', why, { code: 'REQUIRED_WITHIN_STATED_PERIOD' }),
      code('None required', why, { code: 'NONE_REQUIRED' }),
    ]],
    ['Remedy commitment (divestiture cap)', [
      code('No remedy required', why, { code: 'NO_REMEDY_REQUIRED' }),
      code('Remedy required up to a stated threshold', why, { code: 'REMEDY_UP_TO_STATED_THRESHOLD' }),
      code('Remedy required unless material to the combined company', why, { code: 'REMEDY_UNLESS_MATERIAL_TO_COMBINED_COMPANY' }),
      code('Express hell or high water (take all steps)', why, { code: 'EXPRESS_HELL_OR_HIGH_WATER' }),
      code('Remedy only if conditioned on Closing', why, { code: 'REMEDY_ONLY_IF_CONDITIONED_ON_CLOSING' }),
      code('Silent', why, { code: 'SILENT' }),
    ]],
    ['Regulatory litigation', [
      code('Must defend (including appeals / final judgment)', why, { code: 'MUST_DEFEND_INCLUDING_APPEALS' }),
      code('Must defend', why, { code: 'MUST_DEFEND' }),
      code('May defend', why, { code: 'MAY_DEFEND' }),
      code('No obligation to litigate', why, { code: 'NO_OBLIGATION_TO_LITIGATE' }),
    ]],
    ['Strategy control', [
      code('Parent controls strategy', why, { code: 'PARENT_CONTROLS' }),
      code('Company controls strategy', why, { code: 'COMPANY_CONTROLS' }),
      code('Joint control', why, { code: 'JOINT_CONTROL' }),
    ]],
    ['Consultation and participation', [
      code('Reasonable opportunity to participate in meetings', why, { code: 'REASONABLE_OPPORTUNITY_TO_PARTICIPATE' }),
      code('Consult in advance', why, { code: 'CONSULT_IN_ADVANCE' }),
      code('Notice only', why, { code: 'NOTICE_ONLY' }),
    ]],
    ['Information sharing', [
      code('Copies and advance review of filings and communications', why, { code: 'COPIES_AND_ADVANCE_REVIEW' }),
      code('Outside counsel only for competitively sensitive material', why, { code: 'OUTSIDE_COUNSEL_ONLY_FOR_COMPETITIVELY_SENSITIVE' }),
      code('Notice of communications', why, { code: 'NOTICE_OF_COMMUNICATIONS' }),
    ]],
    ['Timing agreements and pull-and-refile', [
      code('Prohibited without the other party\'s consent', why, { code: 'PROHIBITED_WITHOUT_CONSENT' }),
      code('Parent may agree with a regulator', why, { code: 'PARENT_MAY_AGREE' }),
      code('Pull and refile prohibited without consent', why, { code: 'PULL_AND_REFILE_PROHIBITED_WITHOUT_CONSENT' }),
      code('Pull and refile permitted', why, { code: 'PULL_AND_REFILE_PERMITTED' }),
    ]],
    ['Non-impediment covenant', [
      code('No acquisitions that would delay or impede clearance', why, { code: 'NO_ACQUISITIONS_THAT_DELAY_CLEARANCE' }),
      code('No action inconsistent with obtaining approvals', why, { code: 'NO_ACTION_INCONSISTENT_WITH_APPROVALS' }),
    ]],
    ['Third-party consents', [
      code('Efforts required, no payment required', why, { code: 'EFFORTS_NO_PAYMENT_REQUIRED' }),
      code('Payment only as agreed with Parent', why, { code: 'PAYMENT_ONLY_AS_AGREED' }),
      code('Silent', why, { code: 'SILENT' }),
    ]],
    ['Regulatory request response', [
      code('As promptly as practicable', why, { code: 'AS_PROMPTLY_AS_PRACTICABLE' }),
      code('Within a stated period', why, { code: 'WITHIN_STATED_PERIOD' }),
    ]],
  ];
  section.tables = [provisionTable({
    tableKey: 'antitrust-regulatory-table',
    rows,
    numberColumns: [periodColumn('Period', `${why} The filing deadline or response period as a number.`)],
    reason: why,
    subtypeRows: {
      EFFORTS: 'Efforts standard',
      FILING_DEADLINE: 'Filing deadline',
      FILING_OBLIGATION: 'Other regulatory filings',
      REMEDY_LIMITATION: 'Remedy commitment (divestiture cap)',
      REMEDY_RESTRICTION: 'Remedy commitment (divestiture cap)',
      LITIGATION_OBLIGATION: 'Regulatory litigation',
      STRATEGY_CONTROL: 'Strategy control',
      CONSULTATION: 'Consultation and participation',
      INFORMATION_SHARING: 'Information sharing',
      TIMING_AGREEMENT: 'Timing agreements and pull-and-refile',
      NON_IMPEDIMENT: 'Non-impediment covenant',
      THIRD_PARTY_CONSENTS: 'Third-party consents',
      REGULATORY_REQUEST_RESPONSE: 'Regulatory request response',
    },
    guidance: 'One row per regulatory term as the precedent names it; the row follows from the fact\'s subtype (subtype_rows). The Provision cell is the code from that row\'s list that the clause establishes (an efforts covenant that says "reasonable best efforts" is REASONABLE_BEST_EFFORTS; a proviso that no party need take any action not conditioned on Closing is REMEDY_ONLY_IF_CONDITIONED_ON_CLOSING); period carries the number of days of a filing deadline or response period; asDrafted shows the covenant\'s words. A limb of a row (the HSR filing and the foreign filings on Other regulatory filings) is a sub-item (row_detail naming the regime) with the same columns.',
  })];
}

// ==========================================================================
// No-shop: the Envestnet groups (Go-Shop; Core mechanics; Fiduciary-Out /
// Engagement; Notice; Matching Rights; Superior Proposal; Intervening
// Event; Change of Recommendation), each row answering its own question
// with a code and the clause as drafted. The overview section (nosol) is
// removed: its content is these tables.
// ==========================================================================

const FIDUCIARY_STANDARDS = (why) => [
  code('Is a Superior Proposal', why, { code: 'IS_A_SUPERIOR_PROPOSAL' }),
  code('Constitutes or could lead to a Superior Proposal', why, { code: 'CONSTITUTES_OR_COULD_LEAD_TO_A_SUPERIOR_PROPOSAL' }),
  code('Constitutes or could reasonably be expected to lead to a Superior Proposal', why, { code: 'CONSTITUTES_OR_COULD_REASONABLY_BE_EXPECTED_TO_LEAD_TO_A_SUPERIOR_PROPOSAL' }),
  code('Continues to constitute a Superior Proposal', why, { code: 'CONTINUES_TO_CONSTITUTE_A_SUPERIOR_PROPOSAL' }),
];

const BOARD_STANDARDS = (why) => [
  code('Inconsistent with fiduciary duties', why, { code: 'INCONSISTENT_WITH_FIDUCIARY_DUTIES' }),
  code('Reasonably likely to be inconsistent with fiduciary duties', why, { code: 'REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES' }),
  code('Would violate fiduciary duties', why, { code: 'WOULD_VIOLATE_FIDUCIARY_DUTIES' }),
  code('Required by fiduciary duties', why, { code: 'REQUIRED_BY_FIDUCIARY_DUTIES' }),
];

// Work package 7 (manager, 2026-10-18, generation 8's 5.02 against Ben's
// comments): the Board determination standard rows carried no code when
// the model returned none though the fact's STANDARD words name it. The
// page derives the code from the words when the cell is empty
// (code_from_words_by_row, lib/product/table-view.js), first match wins:
// "reasonably likely to be inconsistent" before "inconsistent" alone, the
// stricter reading; the derivation is marked on the cell.
const BOARD_STANDARD_WORDS = Object.freeze([
  { code: 'REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES', words: 'reasonably likely to be[\\s\\S]{0,20}inconsistent' },
  { code: 'INCONSISTENT_WITH_FIDUCIARY_DUTIES', words: 'inconsistent with[\\s\\S]{0,40}fiduciary' },
  { code: 'WOULD_VIOLATE_FIDUCIARY_DUTIES', words: 'violat[\\s\\S]{0,30}fiduciary' },
  { code: 'REQUIRED_BY_FIDUCIARY_DUTIES', words: 'required (?:by|under)[\\s\\S]{0,30}fiduciary' },
]);
const PERMITTED_CONTACT_ROW = 'Permitted contact: clarification and the no-shop\'s terms';
const NOT_A_CHANGE_ROW = 'Not a Change of Recommendation';

function applyNoShop(doc) {
  removeSection(doc, 'nosol');
  const why = `${BEN}: every no-shop row answers its own question with a code from its row's list and the clause as drafted.`;

  // --- Core mechanics -----------------------------------------------------
  const noShop = findSection(doc, 'nosol-noshop');
  noShop.title = 'No-Shop Core Mechanics';
  const core = provisionTable({
    tableKey: 'nosol-noshop-core-mechanics',
    rows: [
      ['Go-shop', yesNo(why)],
      ['Cease existing discussions', [
        code('Required immediately', why, { code: 'REQUIRED_IMMEDIATELY' }),
        code('Required', why, { code: 'REQUIRED' }),
        code('Not required', why, { code: 'NOT_REQUIRED' }),
      ]],
      ['Return or destruction of information', [code('Required', why, { code: 'REQUIRED' }), code('Not required', why, { code: 'NOT_REQUIRED' })]],
      ['Data-room access terminated', [code('Required', why, { code: 'REQUIRED' }), code('Not required', why, { code: 'NOT_REQUIRED' })]],
      ['No-shop restriction (prohibited acts)', [
        code('Solicit', why, { code: 'SOLICIT' }),
        code('Initiate', why, { code: 'INITIATE' }),
        code('Knowingly encourage', why, { code: 'KNOWINGLY_ENCOURAGE' }),
        code('Knowingly facilitate', why, { code: 'KNOWINGLY_FACILITATE' }),
        code('Furnish non-public information / afford access', why, { code: 'FURNISH_INFORMATION' }),
        code('Engage in discussions or negotiations', why, { code: 'ENGAGE_IN_DISCUSSIONS_OR_NEGOTIATIONS' }),
        code('Approve, endorse or recommend a proposal', why, { code: 'APPROVE_OR_RECOMMEND' }),
        code('Enter into an LOI or acquisition agreement', why, { code: 'ENTER_INTO_AGREEMENT' }),
        code('Waive or release a standstill', why, { code: 'WAIVE_STANDSTILL' }),
        code('Amend or exempt from takeover defenses', why, { code: 'AMEND_TAKEOVER_DEFENSES' }),
      ]],
      // Work package 7 (d): 5.02's permission to contact a bidder solely to
      // clarify its proposal's terms, and to tell it the no-shop's terms,
      // is one row answering Yes.
      [PERMITTED_CONTACT_ROW, yesNo(why)],
      ['Representative control standard', [
        code('Shall cause its Representatives not to', why, { code: 'SHALL_CAUSE_REPRESENTATIVES' }),
        code('Shall direct and use reasonable best efforts to cause', why, { code: 'SHALL_DIRECT_AND_USE_REASONABLE_BEST_EFFORTS' }),
        code('Shall not authorize or permit its Representatives to', why, { code: 'SHALL_NOT_AUTHORIZE_OR_PERMIT' }),
        code('Shall instruct its Representatives', why, { code: 'SHALL_INSTRUCT' }),
        // Finding (44), Ben: "yes to both". The sub-item "Representative
        // breach is Company breach" answers Yes / No on this row.
        ...yesNo(why),
      ]],
      ['Standstill enforcement (don\'t ask, don\'t waive)', [
        code('Standstill waivable only on a fiduciary-duty determination', why, { code: 'STANDSTILL_WAIVABLE_ON_FIDUCIARY_DETERMINATION' }),
        code('Standstill must be enforced', why, { code: 'STANDSTILL_MUST_BE_ENFORCED' }),
        code('Standstill not enforced to permit private proposals', why, { code: 'STANDSTILL_NOT_ENFORCED_FOR_PRIVATE_PROPOSALS' }),
        code('Silent', why, { code: 'SILENT' }),
      ]],
    ],
    reason: why,
    subtypeKeys: ['PROHIBITED_ACTION', 'CEASE_DISCUSSIONS_REQUIREMENT', 'RETURN_OR_DESTROY_REQUIREMENT', 'SUBSEQUENT_VDR_REMOVAL'],
    guidance: 'The core no-shop mechanics, one row per question. Go-shop: YES only when the agreement grants a go-shop period. Cease existing discussions, Return or destruction of information and Data-room access terminated: from the cease-discussions clause (CEASE_DISCUSSIONS_REQUIREMENT, RETURN_OR_DESTROY_REQUIREMENT, SUBSEQUENT_VDR_REMOVAL). No-shop restriction (prohibited acts): the PROHIBITED_ACTION facts, one cell per act the clause prohibits (a clause that prohibits soliciting, initiating, knowingly encouraging and furnishing information yields four cells). Representative control standard: the words that bind the Company\'s Representatives ("shall cause its Representatives not to" is SHALL_CAUSE_REPRESENTATIVES; "shall not authorize or permit" is SHALL_NOT_AUTHORIZE_OR_PERMIT). Standstill enforcement: the clause on waiving or enforcing standstills. Omit a row the agreement does not address.',
  });
  // Ben, 2026-10-17 (plan finding (42)), on generation 7's notice table:
  // "odd under ongoing updates to have required within a stated period
  // and required promptly. Also weird to have the 48 hours there" and
  // "need ot include the detail of what info of what must be shared in
  // the no shop (i.e. just contracts, etc) and when and orally etc. A lot
  // more detail required". The table is 5.02(d)'s own mechanics as fixed
  // rows, each its own fact with a readout; one timing code per row
  // ("promptly, and in any event within 48 hours" codes as the stated
  // period and the summary says promptly); the period column carries the
  // hours and folds into a row when one row alone states it (table-view
  // applyColumnRules). Finding (44), Ben "yes to both": the covenant not
  // to enter into an agreement restricting information to Parent is a row
  // here.
  const TIMING = [
    code('Required promptly', why, { code: 'REQUIRED_PROMPTLY' }),
    code('Required within a stated period', why, { code: 'REQUIRED_WITHIN_STATED_PERIOD' }),
    code('Not required', why, { code: 'NOT_REQUIRED' }),
  ];
  const CONTENTS = [
    code('Identity of the person', why, { code: 'IDENTITY_OF_PERSON' }),
    code('Copy of a written proposal, inquiry or request', why, { code: 'COPY_OF_WRITTEN_PROPOSAL' }),
    code('Material terms and conditions when oral', why, { code: 'MATERIAL_TERMS_WHEN_ORAL' }),
    code('Modifications', why, { code: 'MODIFICATIONS' }),
    code('Draft documentation', why, { code: 'DRAFT_DOCUMENTATION' }),
    code('Status and developments', why, { code: 'STATUS_AND_DEVELOPMENTS' }),
  ];
  const notice = provisionTable({
    tableKey: 'nosol-noshop-notice',
    groupHeader: 'NOTICE',
    rows: [
      ['Initial notice', [
        ...TIMING,
        code('On knowledge of an executive officer or director', why, { code: 'ON_KNOWLEDGE_OF_OFFICER_OR_DIRECTOR' }),
        code('On receipt', why, { code: 'ON_RECEIPT' }),
      ]],
      ['Notice contents', CONTENTS],
      ['Ongoing updates', [...TIMING, CONTENTS[4], CONTENTS[5]]],
      ['Notice of a decision to engage', TIMING],
      ['Oral proposals', [
        code('Company may ask that an oral proposal be made in writing', why, { code: 'MAY_REQUEST_WRITTEN_PROPOSAL' }),
        code('Not addressed', why, { code: 'SILENT' }),
      ]],
      // Finding (44), Ben: "yes to both". Yes when the Company covenants not
      // to enter into an agreement restricting what it may give Parent.
      ['No agreement restricting information to Parent', yesNo(why)],
    ],
    numberColumns: [periodColumn('Period', `${why} The hours or business days a notice or update must be given within (48 hours; two business days).`)],
    reason: why,
    subtypeKeys: ['NOTICE_PERIOD', 'NOTICE_UPDATE_OBLIGATION', 'PROHIBITED_ACTION'],
    guidance: 'Notice to Parent under the no-shop, one fact and one readout per row, each row\'s timing one code (never "Required within a stated period" beside "Required promptly": "promptly, and in any event within 48 hours" is REQUIRED_WITHIN_STATED_PERIOD with 48 hours in the period column and promptly in the summary). Initial notice: the NOTICE_PERIOD fact giving notice of a proposal, inquiry or request (its trigger, knowledge of receipt by an executive officer or director, as a second code; its period). Notice contents: the NOTICE_UPDATE_OBLIGATION or NOTICE_PERIOD fact listing what the notice carries, one cell per item (the identity of the person; a copy of a written proposal, inquiry or request; the material terms and conditions when oral; modifications). Ongoing updates: the NOTICE_UPDATE_OBLIGATION fact keeping Parent reasonably informed (its timing; status and developments and draft documentation as content cells). Notice of a decision to engage: the NOTICE_PERIOD fact giving notice that the Company will provide information or negotiate (its period). Oral proposals: the clause letting the Company ask that an oral proposal be made in writing. No agreement restricting information to Parent: YES for the PROHIBITED_ACTION fact that the Company "will not ... enter into any agreement with any Person subsequent to the date of this Agreement that would restrict the Company\'s ability to provide such information to Parent" (Ben, 2026-10-17: "yes to both"). The notice and match periods of the superior-proposal path belong to the matching-rights table; those of the intervening-event path to the intervening-event table.',
  });
  // Finding (44), Ben "yes to both": the sentence deeming a Representative's
  // breach a breach by the Company is a sub-item under the control standard.
  core.detail_labels_by_row = { 'Representative control standard': ['Representative breach is Company breach'] };
  core.guidance += ' The sentence deeming a breach by a Representative a breach by the Company ("any violation of the restrictions ... by any Representative of the Company ... acting in its authorized capacity on behalf of the Company ... shall be a breach of this Section 5.02(a) by the Company") is a PROHIBITED_ACTION fact on the Representative control standard row with row_detail "Representative breach is Company breach" and the code YES (Ben, 2026-10-17: "yes to both").';
  // A stored readout-less PROHIBITED_ACTION fact whose words are that
  // sentence takes the row by default (generation 7's, if any).
  // Work package 7 (d): the permitted-contact permissions (EXCEPTION_PREREQUISITE
  // facts whose words say clarify, or the existence or terms of this
  // Section) take their row by default; fact_type_rows_when is one gate
  // per fact type.
  core.fact_type_rows = { PROHIBITED_ACTION: 'Representative control standard', EXCEPTION_PREREQUISITE: PERMITTED_CONTACT_ROW };
  core.fact_type_rows_when = {
    PROHIBITED_ACTION: '(?=[\\s\\S]*Representative)(?=[\\s\\S]*(?:shall be|constitute|deemed)[^.]{0,60}breach)',
    EXCEPTION_PREREQUISITE: '(?:clarif|existence (?:of|and) (?:the )?(?:provisions|terms)|(?:terms|provisions) of (?:this|these|the) (?:Section|no-shop|non-solicitation|no-solicitation)|inform[\\s\\S]{0,80}(?:provisions|terms) of this Section)',
  };
  findColumn(core, 'provision').code_from_words_by_row = { [PERMITTED_CONTACT_ROW]: [{ code: 'YES', words: '[\\s\\S]' }] };
  core.guidance += ` ${PERMITTED_CONTACT_ROW}: YES for the EXCEPTION_PREREQUISITE facts permitting the Company (or its Representatives) to contact a bidder solely to clarify the terms of its proposal, and to inform a bidder of the existence or terms of these no-solicitation provisions, one fact per permission, each on this row (work package 7, 2026-10-18).`;
  notice.fact_type_rows = { PROHIBITED_ACTION: 'No agreement restricting information to Parent' };
  notice.fact_type_rows_when = '(?=[\\s\\S]*agreement)(?=[\\s\\S]*restrict)(?=[\\s\\S]*Parent)';
  noShop.tables = [core, notice];

  // --- Fiduciary-out / engagement and change of recommendation ------------
  const fiduciary = findSection(doc, 'nosol-fiduciary');
  fiduciary.title = 'Fiduciary-Out / Engagement';
  const engagement = provisionTable({
    tableKey: 'nosol-fiduciary-table',
    rows: [
      ['Engagement standard', FIDUCIARY_STANDARDS(why)],
      ['Board determination standard', BOARD_STANDARDS(why)],
      ['Unsolicited proposal required', yesNo(why)],
      ['No breach of the no-shop required', yesNo(why)],
      ['Acceptable confidentiality agreement required', yesNo(why)],
      ['Information parity with Parent', yesNo(why)],
      // Work package 17 (manager, 2026-10-18 19:10 UTC, from the NCS read,
      // finding (83)): the no-shop savings clause. NCS 5.2(d): "Parent and
      // Merger Sub acknowledge and agree that any determination or action
      // by the Company or the Company Board in accordance with Section
      // 5.2(c) shall not be deemed to be a breach or violation of Section
      // 5.2(a)" had no row and sat under "without a readout"; Metsera's
      // 5.02 has the "shall not constitute a breach" form. Yes when the
      // agreement says so; the words place the fact (words_rows).
      ['Fiduciary actions are not a breach', yesNo(why)],
    ],
    reason: why,
    subtypeKeys: ['EXCEPTION_PREREQUISITE'],
    guidance: 'The conditions on which the Company may engage with a bidder (EXCEPTION_PREREQUISITE facts): the standard the proposal must meet (Engagement standard), the board\'s determination standard, and whether the proposal must be unsolicited, must not result from a breach, must be under an acceptable confidentiality agreement, and whether Parent must receive the same information (Information parity). Each is its own fact and row.',
  });
  // Work package 7 (c) and (d): the Board determination standard's code is
  // read from the words when the model gives none; the permission to
  // negotiate with the Person making a Qualifying Company Takeover Proposal
  // is the Engagement standard row.
  findColumn(engagement, 'provision').code_from_words_by_row = {
    'Board determination standard': BOARD_STANDARD_WORDS.map((rule) => ({ ...rule })),
    'Engagement standard': [
      { code: 'CONTINUES_TO_CONSTITUTE_A_SUPERIOR_PROPOSAL', words: 'continues to constitute' },
      { code: 'CONSTITUTES_OR_COULD_REASONABLY_BE_EXPECTED_TO_LEAD_TO_A_SUPERIOR_PROPOSAL', words: 'could reasonably be expected to (?:lead to|result in)' },
      { code: 'CONSTITUTES_OR_COULD_LEAD_TO_A_SUPERIOR_PROPOSAL', words: 'could lead to' },
      { code: 'IS_A_SUPERIOR_PROPOSAL', words: '(?:is|constitutes) a Superior Proposal' },
    ],
  };
  // The savings clause by its words, whatever the fact type the model
  // chose (NCS: EXCEPTION_PREREQUISITE; the words are the rule): an action
  // or determination under the fiduciary exception that "shall not be
  // deemed to be", "shall not constitute" or "is not" a breach. "did not
  // result from a breach" (the prerequisite) is not this row.
  engagement.words_rows = [{
    row_label: 'Fiduciary actions are not a breach',
    when: '(?:shall|will|does|do|is|are)\\s+not\\s+(?:be\\s+deemed\\s+(?:to\\s+be\\s+|to\\s+constitute\\s+)?|constitute\\s+|be\\s+)(?:a\\s+|an\\s+)?(?:breach|violation)',
    code: 'YES',
  }];
  findColumn(engagement, 'provision').code_from_words_by_row['Fiduciary actions are not a breach'] = [{ code: 'YES', words: 'not\\s+(?:be\\s+deemed|constitute|be)[\\s\\S]{0,40}(?:breach|violation)' }];
  engagement.fact_type_rows = { EXCEPTION_PREREQUISITE: 'Engagement standard' };
  engagement.fact_type_rows_when = { EXCEPTION_PREREQUISITE: '(?=[\\s\\S]*negotiat)(?=[\\s\\S]*(?:Qualifying|Superior Proposal|could (?:reasonably be expected to )?lead))' };
  engagement.guidance += ' Fiduciary actions are not a breach: the savings clause, YES when the agreement says that a determination or action by the Company or its Board under the fiduciary exception shall not be deemed to be, or shall not constitute, a breach of the no-shop (work package 17, 2026-10-18); never the prerequisite that the proposal did not result from a breach, which is its own row.';
  engagement.guidance += ' Board determination standard: always one code, from the words of the standard: "would be, or would be reasonably likely to be, inconsistent with its fiduciary duties" is REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES; "inconsistent with its fiduciary duties" alone is INCONSISTENT_WITH_FIDUCIARY_DUTIES; "would violate" WOULD_VIOLATE_FIDUCIARY_DUTIES; "required by" REQUIRED_BY_FIDUCIARY_DUTIES; never a readout without the code (generation 8, 5.02(f): the row read with no code). Engagement standard: also the permission to negotiate with (or furnish information to) the Person making a Qualifying Company Takeover Proposal or a proposal that constitutes or could reasonably be expected to lead to a Superior Proposal, the code the standard the proposal must meet (work package 7, 2026-10-18).';
  const change = provisionTable({
    tableKey: 'nosol-fiduciary-change-of-recommendation',
    groupHeader: 'CHANGE OF RECOMMENDATION',
    rows: [
      ['Board change right', [
        code('Yes, for a Superior Proposal or an Intervening Event', why, { code: 'YES_SUPERIOR_PROPOSAL_OR_INTERVENING_EVENT' }),
        code('Yes, for a Superior Proposal only', why, { code: 'YES_SUPERIOR_PROPOSAL_ONLY' }),
        code('Yes, for an Intervening Event only', why, { code: 'YES_INTERVENING_EVENT_ONLY' }),
        code('No', why, { code: 'NO' }),
      ]],
      ['Change of Recommendation: prohibited actions', [
        code('Withhold / withdraw / qualify / modify the Board Recommendation adverse to Parent', why, { code: 'WITHHOLD_WITHDRAW_QUALIFY_MODIFY_THE_BOARD_RECOMMENDATION_ADVERSE_TO_PARENT' }),
        code('Fail to include the Board Recommendation in the Proxy / 14D-9 / Info Statement', why, { code: 'FAIL_TO_INCLUDE_THE_BOARD_RECOMMENDATION_IN_THE_PROXY_14D_9_INFO_STATEMENT' }),
        code('Approve / endorse / recommend / declare advisable a proposal', why, { code: 'APPROVE_ENDORSE_RECOMMEND_DECLARE_ADVISABLE_A_PROPOSAL' }),
        code('Fail to publicly reaffirm the Recommendation on request', why, { code: 'FAIL_TO_PUBLICLY_REAFFIRM_THE_RECOMMENDATION_ON_REQUEST' }),
        code('Fail to recommend against a tender / exchange offer within the required period', why, { code: 'FAIL_TO_RECOMMEND_AGAINST_A_TENDER_EXCHANGE_OFFER_WITHIN_THE_REQUIRED_PERIOD' }),
        code('Enter into an LOI / acquisition / merger agreement (other than an ACA)', why, { code: 'ENTER_INTO_AN_LOI_ACQUISITION_MERGER_AGREEMENT_OTHER_THAN_AN_ACA' }),
        code('Publicly propose any of the foregoing', why, { code: 'PUBLICLY_PROPOSE_ANY_OF_THE_FOREGOING' }),
      ]],
      [NOT_A_CHANGE_ROW, [
        code('Delivery of a notice to Parent', why, { code: 'DELIVERY_OF_NOTICE_TO_PARENT' }),
        code('Determination that a proposal is or could lead to a Superior Proposal', why, { code: 'DETERMINATION_THAT_PROPOSAL_IS_SUPERIOR' }),
        code('Factually accurate public statement', why, { code: 'FACTUALLY_ACCURATE_PUBLIC_STATEMENT' }),
        code('Stop, look and listen communication', why, { code: 'STOP_LOOK_AND_LISTEN_COMMUNICATION' }),
        // Work package 7 (d): 5.02's disclosure permissions beside the two above.
        code('Disclosure required by applicable Law', why, { code: 'DISCLOSURE_REQUIRED_BY_LAW' }),
        code('A disclosure permission alone does not permit a change', why, { code: 'DISCLOSURE_PERMISSION_NOT_A_CHANGE' }),
      ]],
      ['Force the vote', yesNo(why)],
    ],
    numberColumns: [periodColumn('Period', `${why} The reaffirmation period ("within ten business days of a request").`)],
    reason: why,
    subtypeKeys: ['RECOMMENDATION_CHANGE'],
    guidance: 'Change of recommendation (RECOMMENDATION_CHANGE facts): whether and when the board may change its recommendation (Board change right); the acts the agreement defines as an Adverse Recommendation Change, one cell per act, from the definition wherever it sits; what the agreement says is not such a change; and whether the stockholder meeting must be held even after a change (Force the vote). The period column carries a reaffirmation period.',
  });
  // Work package 7 (d): the required-by-Law disclosure permission and the
  // sentence that a disclosure permission alone permits no change of
  // recommendation take the Not a Change of Recommendation row by default,
  // their code from their words; the sentence that an Adverse
  // Recommendation Change does not withdraw the board's approval for the
  // takeover statutes is an Other provisions entry of this table, never a
  // row.
  change.fact_type_rows = { EXCEPTION_PREREQUISITE: NOT_A_CHANGE_ROW, RECOMMENDATION_CHANGE: NOT_A_CHANGE_ROW };
  change.fact_type_rows_when = {
    EXCEPTION_PREREQUISITE: '(?=[\\s\\S]*disclos)(?=[\\s\\S]*required (?:by|under) (?:applicable )?Law)',
    RECOMMENDATION_CHANGE: '(?=[\\s\\S]*(?:disclos|communicat|public statement|Rule 14d-9|14e-2))(?=[\\s\\S]*(?:not|no|nor)[\\s\\S]{0,80}(?:permit|constitute|authoriz))(?=[\\s\\S]*[Rr]ecommendation)',
  };
  findColumn(change, 'provision').code_from_words_by_row = {
    [NOT_A_CHANGE_ROW]: [
      { code: 'DISCLOSURE_REQUIRED_BY_LAW', words: 'required (?:by|under) (?:applicable )?Law' },
      { code: 'DISCLOSURE_PERMISSION_NOT_A_CHANGE', words: '(?:not|no|nor)[\\s\\S]{0,80}(?:permit|constitute|authoriz)' },
    ],
  };
  change.other_provisions_from_subtype = {
    subtype_keys: ['RECOMMENDATION_CHANGE'],
    when: '(?:[Tt]akeover (?:[Ss]tatute|[Ll]aw)|[Aa]nti-?takeover|Section 203|DGCL)',
    label: 'Other provisions',
  };
  change.guidance += ` ${NOT_A_CHANGE_ROW}: also the permission to make disclosures the Board determines are required by applicable Law (an EXCEPTION_PREREQUISITE fact, DISCLOSURE_REQUIRED_BY_LAW) and the sentence that such a disclosure permission alone does not permit an Adverse Recommendation Change (a RECOMMENDATION_CHANGE fact, DISCLOSURE_PERMISSION_NOT_A_CHANGE). The sentence that an Adverse Recommendation Change does not withdraw the board's approval for the purposes of the takeover statutes is a RECOMMENDATION_CHANGE fact with no readout: the page shows it beneath this table as an other provision (work package 7, 2026-10-18).`;
  fiduciary.tables = [engagement, change];

  // --- Intervening event --------------------------------------------------
  const intervening = findSection(doc, 'nosol-intervening');
  ensureFamily(intervening, 'KEY_DEFINED_TERMS');
  ensureFamily(intervening, 'TERMINATION');
  const interveningTable = provisionTable({
    tableKey: 'nosol-intervening-table',
    rows: [
      ['Intervening Event provision', yesNo(why)],
      ['Definition', []],
      ['Excluded events', [
        code('Events relating to an Acquisition Proposal', why, { code: 'ACQUISITION_PROPOSAL_RELATED' }),
        code('Meeting or exceeding projections', why, { code: 'MEETING_OR_EXCEEDING_PROJECTIONS' }),
        code('Changes in the stock price', why, { code: 'CHANGE_IN_STOCK_PRICE' }),
        code('Changes in credit rating', why, { code: 'CHANGE_IN_CREDIT_RATING' }),
        code('Changes in law or GAAP', why, { code: 'CHANGES_IN_LAW_OR_GAAP' }),
        code('Regulatory, clinical or product developments', why, { code: 'REGULATORY_OR_CLINICAL_DEVELOPMENTS' }),
      ]],
      // Ben, 2026-10-17 (plan finding (42)): "you're missing the fiduciary
      // standard required (which we do have in the change of rec for
      // superior proposal section)". The row carries the fiduciary table's
      // name and vocabulary; 5.02(f)'s standard is this row.
      ['Board determination standard', BOARD_STANDARDS(why)],
      ['Notice period', []],
      ['Matching period', []],
      ['Parent termination right on a change', []],
    ],
    numberColumns: [periodColumn('Period', `${why} The notice or match period of the intervening-event path.`)],
    reason: why,
    guidance: 'The intervening-event path. Intervening Event provision: YES when the board may change its recommendation for an Intervening Event (a RECOMMENDATION_CHANGE or EXCEPTION_PREREQUISITE fact on that path). Definition: the KEY_DEFINED_TERMS/INTERVENING_EVENT fact, as drafted, no code. Excluded events: one cell per event the definition excludes. Board determination standard: the fiduciary standard the board must meet to change its recommendation for an Intervening Event, one code (a clause such as "has concluded in good faith, after consultation with its outside counsel, that failure to make an Adverse Recommendation Change on account of the Intervening Event would be, or would be reasonably likely to be, inconsistent with its fiduciary duties" is REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES on this row; the consultation is content of the summary). Notice period and Matching period: the NOTICE_PERIOD and INITIAL_MATCH_PERIOD facts that govern a change for an Intervening Event (the superior-proposal path\'s periods go to the matching-rights table), the number in the period column. Parent termination right on a change is derived by the page from the TERMINATION/RECOMMENDATION_CHANGE fact; never fill it.',
  });
  findColumn(interveningTable, 'provision').derived = { from_family: 'TERMINATION', from_subtype: 'RECOMMENDATION_CHANGE', join: 'presence', rows: ['Parent termination right on a change'] };
  // A readout-less fiduciary-standard fact of the intervening-event path
  // (an EXCEPTION_PREREQUISITE or RECOMMENDATION_CHANGE fact whose
  // statement names the Intervening Event) takes this row by default, so a
  // stored generation shows it too (generation 7 extracted 5.02(f)'s
  // standard without a readout).
  interveningTable.fact_type_rows = { EXCEPTION_PREREQUISITE: 'Board determination standard', RECOMMENDATION_CHANGE: 'Board determination standard' };
  findColumn(interveningTable, 'provision').code_from_words_by_row = { 'Board determination standard': BOARD_STANDARD_WORDS.map((rule) => ({ ...rule })) };
  interveningTable.guidance += ' Board determination standard: always one code from the words of the standard (REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES for "would be, or would be reasonably likely to be, inconsistent"; INCONSISTENT_WITH_FIDUCIARY_DUTIES for "inconsistent" alone; WOULD_VIOLATE_FIDUCIARY_DUTIES; REQUIRED_BY_FIDUCIARY_DUTIES), never a readout without it (generation 8, 5.02(f); work package 7).';
  interveningTable.fact_type_rows_when = '(?=[\\s\\S]*Intervening Event)(?=[\\s\\S]*fiduciary dut)';
  intervening.tables = [interveningTable];

  // --- Superior proposal --------------------------------------------------
  const superior = findSection(doc, 'nosol-superior');
  ensureFamily(superior, 'KEY_DEFINED_TERMS');
  ensureFamily(superior, 'TERMINATION');
  const superiorTable = provisionTable({
    tableKey: 'nosol-superior-table',
    rows: [
      ['Superior Proposal threshold', []],
      ['Superior Proposal test', [
        code('More favorable to stockholders from a financial point of view', why, { code: 'MORE_FAVORABLE_FINANCIALLY' }),
        code('Reasonably likely to be consummated (financing, regulatory, timing)', why, { code: 'REASONABLY_LIKELY_TO_BE_CONSUMMATED' }),
        code('Taking into account all terms and conditions', why, { code: 'TAKING_INTO_ACCOUNT_ALL_TERMS' }),
        code('Taking into account Parent\'s revised proposal', why, { code: 'TAKING_INTO_ACCOUNT_PARENT_REVISIONS' }),
      ]],
      ['Determiner', [
        code('Board, in good faith, after consulting outside legal counsel and financial advisor', why, { code: 'BOARD_IN_GOOD_FAITH_AFTER_ADVISORS' }),
        code('Board, in good faith', why, { code: 'BOARD_IN_GOOD_FAITH' }),
        code('Special committee', why, { code: 'SPECIAL_COMMITTEE' }),
      ]],
      ['Company termination for Superior Proposal', []],
    ],
    numberColumns: [{ column_id: 'threshold', header: 'Threshold', render: 'value', value_kind: 'PERCENTAGE', fill_from: ['PERCENTAGE', 'THRESHOLD'], addition: true, reason: `${why} The percentage of shares or assets a Superior Proposal must reach.` }],
    reason: why,
    guidance: 'The Superior Proposal definition (KEY_DEFINED_TERMS/SUPERIOR_PROPOSAL): its threshold (the percentage in the threshold column), its test (one cell per limb of the test) and who determines it. Company termination for Superior Proposal is derived by the page from the TERMINATION/SUPERIOR_PROPOSAL fact; never fill it.',
  });
  findColumn(superiorTable, 'provision').derived = { from_family: 'TERMINATION', from_subtype: 'SUPERIOR_PROPOSAL', join: 'presence', rows: ['Company termination for Superior Proposal'] };
  const definitions = {
    table_key: 'nosol-superior-acquisition-proposal-definition',
    group_header: 'DEFINITIONS',
    term_column: { header: 'Term', source: 'subject', fill_from: ['TERM'] },
    columns: [
      { column_id: 'threshold', header: 'Threshold', render: 'value', value_kind: 'PERCENTAGE', fill_from: ['PERCENTAGE', 'THRESHOLD'], addition: true, reason: `${why} The percentage in the Acquisition Proposal definition.` },
      asDrafted(why),
    ],
    rows_are: 'fixed list',
    fixed_row_labels: ['Acquisition Proposal', 'Acceptable Confidentiality Agreement'],
    row_from_subtype: true,
    subtype_rows: { ACQUISITION_PROPOSAL: 'Acquisition Proposal', ACCEPTABLE_CONFIDENTIALITY_AGREEMENT: 'Acceptable Confidentiality Agreement' },
    guidance: 'The Acquisition Proposal (Company Takeover Proposal) and Acceptable Confidentiality Agreement definitions, each as drafted, the percentage threshold as a number.',
  };
  const matching = {
    table_key: 'nosol-superior-matching-rights',
    group_header: 'MATCHING RIGHTS',
    term_column: { header: 'Term', source: 'subject', fill_from: ['TERM'] },
    columns: [
      periodColumn('Period', `${why} The match period in business days.`),
      asDrafted(why),
    ],
    rows_are: 'fixed list',
    fixed_row_labels: ['Notice period', 'Initial match period', 'Subsequent match period'],
    row_from_subtype: true,
    subtype_rows: { INITIAL_MATCH_PERIOD: 'Initial match period', SUBSEQUENT_MATCH_PERIOD: 'Subsequent match period' },
    guidance: 'The superior-proposal path\'s notice and match periods (NOTICE_PERIOD, INITIAL_MATCH_PERIOD, SUBSEQUENT_MATCH_PERIOD facts on that path), the number in the period column.',
  };
  superior.tables = [superiorTable, definitions, matching];
}

// ==========================================================================
// Interim operating covenants: the negative covenants are one row per
// restriction category (the corpus taxonomy's IOC categories, open to a new
// one), the restriction as drafted, its threshold, its exceptions coded and
// the consent standard; the general terms (consent standard, general
// exceptions, ordinary-course standard) are a Term / Provision table. The
// separate Exceptions and Other Restrictions bands fold into those.
// ==========================================================================

const IOC_CATEGORIES = [
  'Charter / Bylaws Amendments', 'Acquisition / Disposition Covenant', 'Issuance of Securities', 'Share Repurchases',
  'Dividends and Distributions', 'Stock Splits / Reclassifications', 'Indebtedness', 'Liens and Encumbrances',
  'Capital Expenditures', 'Compensation and Benefits', 'Hiring and Termination', 'Settlement of Claims',
  'Tax Elections and Filings', 'Accounting Changes', 'Material Contracts', 'Intellectual Property', 'Insurance Policies',
  'Real Property', 'Waiver of Rights', 'Affiliate Transactions', 'Environmental', 'Commitments', 'Clinical Trials',
  'Product Development', 'Regulatory Authorizations', 'New Lines of Business', 'Loans and Investments',
  'Collective Bargaining', 'Liquidation / Dissolution', 'Privacy and Data', 'Government Filings',
];

function applyInterimCovenants(doc) {
  for (const sectionKey of ['ioc-exceptions', 'parent-ioc-exceptions']) {
    const section = findSection(doc, sectionKey);
    const why = `${BEN}: an interim operating covenant reads as its category, the restriction as drafted, its threshold, its coded exceptions and the consent standard.`;
    const affirmative = findTable(section, `${sectionKey}-affirmative-covenants`);
    const efforts = findColumn(affirmative, 'effortsStandard');
    for (const entry of [
      code('Reasonable best efforts', why, { code: 'REASONABLE_BEST_EFFORTS' }),
      code('Best efforts', why, { code: 'BEST_EFFORTS' }),
      code('Unqualified obligation (shall)', why, { code: 'UNQUALIFIED_OBLIGATION' }),
    ]) if (!efforts.vocabulary.some((existing) => existing.code === entry.code)) efforts.vocabulary.push(entry);
    affirmative.columns = [efforts, findColumn(affirmative, 'qualifier'), asDrafted(why)];
    affirmative.open_rows = true;
    affirmative.subtype_keys = ['AFFIRMATIVE_COVENANT'];
    affirmative.guidance = 'One row per affirmative covenant as the precedent names it (conduct in the ordinary course; preserve the business organization and relationships; maintain permits; maintain property), a new name only when none fits; the efforts standard and any materiality qualifier coded, the covenant as drafted.';

    const negative = findTable(section, `${sectionKey}-negative-covenants`);
    const exceptions = findColumn(negative, 'exceptions');
    negative.rows_are = 'fixed list';
    negative.fixed_row_labels = [...IOC_CATEGORIES];
    negative.fixed_row_labels_source = 'lib/rubric.js IOC-* category labels (the corpus taxonomy), decision 34';
    negative.open_rows = true;
    negative.term_column = { header: 'Restriction', source: 'subject', fill_from: ['TERM'] };
    negative.subtype_keys = ['RESTRICTIVE_COVENANT', 'THRESHOLD', 'EXCEPTION'];
    negative.columns = [
      asDrafted(why, ['OPERATION', 'OBJECT', 'LIST', 'LITANY', 'CONDITION']),
      { column_id: 'threshold', header: 'Threshold', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT', 'THRESHOLD'], addition: true, reason: `${why} The dollar floor of the restriction (a capex or indebtedness basket).` },
      exceptions,
    ];
    // Ben, 2026-09-14: "we don't need to show 'consent' for each row of the
    // negative covenant" (the chapeau's consent standard is a general term)
    // and "make negative covenant list collapsable (if it is within the
    // covenant section)": the restriction rows fold behind a toggle.
    negative.collapsible_rows = true;
    negative.guidance = 'One row per restriction category the covenant names (row_label from fixed_row_labels, a new category only when none fits, never the clause\'s own words): each lettered restriction is a RESTRICTIVE_COVENANT fact on its category\'s row, as drafted; a dollar basket is the threshold; each carve-out from the restriction is one exceptions code (several cells when the clause has several); the consent standard is a general term, never a cell of a restriction. Two restrictions of one category (5.01(d) acquisitions and 5.01(g) dispositions) are two facts on the same row, each a sub-item (row_detail: Acquisitions; Dispositions).';

    const general = provisionTable({
      tableKey: `${sectionKey}-general-terms`,
      groupHeader: 'GENERAL TERMS',
      rows: [
        ['Consent standard', [
          code('Not to be unreasonably withheld, conditioned or delayed', why, { code: 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED' }),
          code('Sole discretion', why, { code: 'SOLE_DISCRETION' }),
          code('Deemed given after a stated period', why, { code: 'DEEMED_GIVEN_AFTER_STATED_PERIOD' }),
        ]],
        ['General exceptions', [
          code('Disclosure letter', why, { code: 'DISCLOSURE_LETTER' }),
          code('Required by applicable law', why, { code: 'REQUIRED_BY_LAW' }),
          code('Required or contemplated by the agreement', why, { code: 'REQUIRED_BY_AGREEMENT' }),
          code('With Parent\'s consent', why, { code: 'PARENT_CONSENT' }),
          code('Pandemic or emergency measures', why, { code: 'PANDEMIC_MEASURES' }),
        ]],
        ['Ordinary course standard', [
          code('Ordinary course consistent with past practice', why, { code: 'ORDINARY_COURSE_CONSISTENT_WITH_PAST_PRACTICE' }),
          code('Ordinary course', why, { code: 'ORDINARY_COURSE' }),
          code('Commercially reasonable efforts to conduct in the ordinary course', why, { code: 'COMMERCIALLY_REASONABLE_EFFORTS_ORDINARY_COURSE' }),
        ]],
        // Metsera generation 7, 5.01 (2026-09-14): "no action with respect
        // to matters specifically addressed by Section 5.01(a) through (r)
        // shall be deemed a breach of the ordinary course covenant" had no
        // row and fell off the page.
        ['Specific restrictions govern', [
          code('Action addressed by a specific restriction is not a breach of the general covenant', why, { code: 'SPECIFIC_RESTRICTIONS_GOVERN_GENERAL_COVENANT' }),
        ]],
      ],
      numberColumns: [periodColumn('Period', `${why} The deemed-consent period.`)],
      reason: why,
      subtypeKeys: ['CONSENT_STANDARD', 'EXCEPTION'],
      guidance: 'The covenant introductions, from the section\'s opening words (the chapeau, limb (a) when it runs on from the heading): the affirmative introduction ("shall conduct its business in the ordinary course") gives the Ordinary course standard; the negative introduction ("shall not, without Parent\'s consent, ... ") gives the Consent standard (CONSENT_STANDARD) and the exceptions that apply to every restriction (an EXCEPTION fact from the chapeau, one cell per exception) as General exceptions.',
    });
    // A fact of these types returned without a readout takes its row
    // (generation 7, 5.01: the dividend coordination covenant and the
    // specific-restrictions carve-out had none).
    general.fact_type_rows = { 'IOC_RESTRICTION_PRESENT:EXCEPTION': 'Specific restrictions govern', 'IOC_RESTRICTION_PRESENT:CONSENT_STANDARD': 'Consent standard' };
    negative.fact_type_rows = { DIVIDEND_COORDINATION_COVENANT: 'Dividends and Distributions' };
    // The Company's covenant or Parent's, by the statement's subject.
    const words = sectionKey === 'ioc-exceptions' ? '\\bthe Company\\b' : '\\bParent\\b(?![^.]*\\bthe Company\\b)';
    general.statement_words = words;
    negative.statement_words = words;
    // The dividend coordination facts (DIVIDENDS family) are interim
    // restrictions on the Company's distributions and belong here.
    if (sectionKey === 'ioc-exceptions') ensureFamily(section, 'DIVIDENDS');
    // Ben, 2026-09-14: "we do need the general affirmative and negative
    // covenant intros in the IOCs which I don't see (look at prior
    // version)". The introductions open the section, before the
    // affirmative covenants and the restriction list.
    section.tables = [general, affirmative, negative];
  }
}

// ==========================================================================
// Closing conditions: the frustration rule is a row of the mutual table; the
// buyer's and seller's tables show each condition as drafted.
// ==========================================================================

// Work package 30 (plan finding (243), Ben 2026-10-23): the closing
// conditions are two tables by the side whose obligation is conditioned.
// The Company's table takes the facts whose own words are "The obligation of
// the Company ... (or waiver by the Company ..."; Parent's table takes
// "... waiver by Parent, on its own behalf and on behalf of Merger Sub ...".
// The side is read from the fact's words in lib/product/table-view.js, never
// from the section number. Ben's decision on the catch-all: "Do not leave a
// catch-all row that can silently absorb unrelated facts; if the shape needs
// a genuine catch-all for future facts, name it so a reader knows what it
// is." The 5.9 negative is its own row on Parent's table rather than hidden
// under "Other conditions".
const CONDITIONS_CATCH_ALL_ROW = 'Other conditions (not otherwise classified)';
const CONDITIONS_NEGATIVE_ROW = 'Filing, notice or consent — expressly not a condition precedent';

function applyConditions(doc) {
  const why = `${BEN}: every condition shows as drafted beside its coded tier.`;
  // The two titles name the side whose obligation is conditioned: the
  // existing conditions-b table (the buyer / Parent side) and conditions-s
  // table (the seller / Company side), each keeping its key so stored
  // readouts and the page's anchors stay stable.
  const parentSection = findSection(doc, 'conditions-b');
  const companySection = findSection(doc, 'conditions-s');
  parentSection.title = "Conditions to Parent's Obligations";
  companySection.title = "Conditions to the Company's Obligations";
  const mutual = findTable(findSection(doc, 'conditions'), 'conditions-table');
  if (!mutual.fixed_row_labels.includes('Frustration of conditions')) mutual.fixed_row_labels.push('Frustration of conditions');
  mutual.guidance = 'One row per mutual condition as the precedent names it (Stockholder Approval with its vote standard; No Legal Restraint; Antitrust / Regulatory Clearance, each regime a sub-item; S-4 / Proxy Effective; Stock Exchange Listing) and the frustration rule (a FRUSTRATION fact: no party may rely on a failed condition its own breach caused) as a row, each as drafted.';
  // Metsera generation 6, 7.01 and 7.02 (2026-09-14): the extractor gave
  // no readout for the second bring-down tier and the buyer's officer
  // certificate, and they fell under "without a readout". A closing
  // condition's row follows from its fact type (a bring-down is Accuracy
  // of Representations whatever the tier), so a fact with no readout takes
  // that row (fact_type_rows, "FACT_TYPE:SUBTYPE" the more specific key);
  // the party's table follows from the statement's words (statement_words).
  mutual.fact_type_rows = {
    STOCKHOLDER_APPROVAL_CONDITION: 'Stockholder Approval',
    LEGAL_RESTRAINT_CONDITION: 'No Legal Restraint',
    GOVERNMENT_PROCEEDING_CONDITION: 'No Legal Restraint',
    REGULATORY_APPROVAL_CONDITION: 'Antitrust / Regulatory Clearance',
    S4_CONDITION_COMPONENT: 'S-4 / Proxy Effective',
    LISTING_CONDITION: 'Stock Exchange Listing',
    FRUSTRATION_BREACH_STANDARD: 'Frustration of conditions',
    METSERA_7_04_FRUSTRATION_BRANCH: 'Frustration of conditions',
    // Work package 19 (d) (NCS generation 5, 6.1: the Information Statement
    // mailed at least 20 Business Days before Closing had no row): a mutual
    // condition the fixed list does not name.
    GENERAL_CLOSING_CONDITION: 'Other mutual conditions',
  };
  if (!mutual.fixed_row_labels.includes('Other mutual conditions')) mutual.fixed_row_labels.push('Other mutual conditions');
  // The party's table follows from the statement's words, written either
  // way round ("the obligations of the Company"; "the Company's obligation"),
  // including the waiver the condition's own chapeau names (finding (243):
  // "waiver by Parent", "waiver by the Company").
  mutual.statement_words = "obligations? of each (party|of the parties)|each (party|of the parties)'?s obligations?";
  const parentSide = { sectionKey: 'conditions-b', tableKey: 'conditions-b-table', words: "obligations? of (each of )?Parent|Parent'?s obligations?|waiver by Parent" };
  const companySide = { sectionKey: 'conditions-s', tableKey: 'conditions-s-table', words: "obligations? of the Company|Company'?s obligations?|waiver by the Company" };
  for (const { sectionKey, tableKey, words } of [parentSide, companySide]) {
    const table = findTable(findSection(doc, sectionKey), tableKey);
    if (!table.columns.some((column) => column.column_id === 'asDrafted')) table.columns.push(asDrafted(why));
    // Work package 19 (d) (NCS generation 5, 6.3: the Closing Tax Opinion,
    // the Canadian tax-deposit condition and the no-Parent-MAE condition of
    // a stock deal had no row on the Company's table): a tax opinion row and
    // the No Material Adverse Effect row the mapping already named on both
    // party tables. Work package 30 (finding (243)) names the catch-all.
    for (const label of ['No Material Adverse Effect', 'Tax opinion']) {
      if (!table.fixed_row_labels.includes(label)) table.fixed_row_labels.push(label);
    }
    // Work package 30 (finding (243)): the catch-all says what it is, and
    // the 5.9 negative has its own named row on Parent's table. The row
    // order keeps the specific negative before the general catch-all.
    table.fixed_row_labels = table.fixed_row_labels.filter((label) => label !== 'Other conditions'
      && label !== CONDITIONS_CATCH_ALL_ROW && label !== CONDITIONS_NEGATIVE_ROW);
    if (sectionKey === 'conditions-b') table.fixed_row_labels.push(CONDITIONS_NEGATIVE_ROW);
    table.fixed_row_labels.push(CONDITIONS_CATCH_ALL_ROW);
    table.fact_type_rows = {
      'GENERAL_CLOSING_CONDITION:BRINGDOWN': 'Accuracy of Representations',
      'GENERAL_CLOSING_CONDITION:TAX_OPINION': 'Tax opinion',
      GENERAL_CLOSING_CONDITION: CONDITIONS_CATCH_ALL_ROW,
      COVENANT_COMPLIANCE_STANDARD: 'Performance of Covenants',
      NO_MAE_CONDITION: 'No Material Adverse Effect',
      NO_MAE_CONDITION_CONTINUING: 'No Material Adverse Effect',
      OFFICER_CERTIFICATE_REQUIRED: "Officer's Certificate",
    };
    table.statement_words = words;
    table.guidance = `${table.guidance || ''} Work package 30 (plan finding (243)): this is the ${sectionKey === 'conditions-b' ? "Parent's" : "Company's"} obligations table; a condition fact whose own words name the other side belongs on the other table, and the page routes it there by those words, never by the section number or the fact's actor.`.trim();
  }
}

// ==========================================================================
// Termination rights: the Envestnet groups (mutual; buyer may terminate;
// company may terminate) with the row from the fact's subtype, each right as
// drafted; the effect of termination as a Term / Provision table. Specific
// performance moves to Miscellaneous / Boilerplate.
// ==========================================================================

function applyTerminationRights(doc) {
  const section = findSection(doc, 'termination-rights');
  const why = `${BEN}: each termination right is its precedent row, named from the fact's subtype, its terms coded and the right as drafted.`;

  const mutual = findTable(section, 'termination-rights-mutual');
  mutual.row_from_subtype = true;
  mutual.subtype_rows = { MUTUAL_CONSENT: 'Mutual consent', OUTSIDE_DATE: 'Outside / End Date', LEGAL_RESTRAINT: 'Legal restraint / order', VOTE_FAILURE: 'Stockholder vote not obtained' };
  mutual.columns = [
    findColumn(mutual, 'exercisedBy'),
    findColumn(mutual, 'outsideDate'),
    { column_id: 'outsideDateExtension', header: 'Extended To', render: 'value', value_kind: 'DATE', fill_from: ['DATE', 'PERIOD'], addition: true, reason: `${why} The extended outside date (automatic or elective).` },
    findColumn(mutual, 'writtenConsent'),
    findColumn(mutual, 'voteThreshold'),
    asDrafted(why),
  ];
  mutual.guidance = 'Mutual termination rights, the row from the subtype: Mutual consent (written consent required or not); Outside / End Date (the initial date in outsideDate, an extension date in outsideDateExtension, the extension mechanism a sub-item as drafted); Legal restraint / order (final and non-appealable); Stockholder vote not obtained. exercisedBy codes who may elect.';

  const buyer = findTable(section, 'termination-rights-buyer-may-terminate');
  // Work package 19 (d) (NCS generation 5, 7.1: Parent's rights to
  // terminate when the Written Consent or the Support Agreement is not
  // delivered by the Consent Time had no row): the written-consent deal's
  // two rights, each its row.
  buyer.fixed_row_labels = ['Company (Target) breach', 'Change of Recommendation', 'Breach of the no-shop', 'Written consent not delivered', 'Support agreement not delivered'];
  buyer.row_from_subtype = true;
  buyer.subtype_rows = { BREACH: 'Company (Target) breach', RECOMMENDATION_CHANGE: 'Change of Recommendation', NO_SOLICITATION_BREACH: 'Breach of the no-shop', WRITTEN_CONSENT_NOT_DELIVERED: 'Written consent not delivered', SUPPORT_AGREEMENT_NOT_DELIVERED: 'Support agreement not delivered' };
  buyer.fact_type_rows = { 'TERMINATION_RIGHT:WRITTEN_CONSENT_NOT_DELIVERED': 'Written consent not delivered', 'TERMINATION_RIGHT:SUPPORT_AGREEMENT_NOT_DELIVERED': 'Support agreement not delivered' };
  if (!buyer.columns.some((column) => column.column_id === 'asDrafted')) buyer.columns.push(asDrafted(why));
  buyer.guidance = 'Parent\'s termination rights, the row from the subtype: Company breach (cure period, its end, whether curable, the terminator-breach bar as faultBasedCarveOut); Change of Recommendation (trigger, window); breach of the no-shop. A BREACH fact in this table is Parent terminating for the Company\'s breach; the Company\'s right for Parent\'s breach goes to the company table.';

  const company = findTable(section, 'termination-rights-company-may-terminate');
  company.fixed_row_labels = ['Parent (Buyer) breach', 'Superior Proposal', 'Failure to close'];
  company.open_rows = true;
  company.row_from_subtype = true;
  company.subtype_rows = { BREACH: 'Parent (Buyer) breach', SUPERIOR_PROPOSAL: 'Superior Proposal', BESPOKE_DATE_RIGHT: 'Failure to close' };
  company.columns = [
    findColumn(company, 'faultBasedCarveOut'),
    findColumn(company, 'terminatorBreachBar'),
    periodColumn('Cure Period', `${why} The cure period for Parent's breach.`, 'curePeriodValue'),
    {
      column_id: 'window', header: 'Window', render: 'vocabulary',
      vocabulary: [code('Before the stockholder vote only', why, { code: 'PRE_STOCKHOLDER_VOTE_ONLY' }), code('Any time before the Effective Time', why, { code: 'ANY_TIME_BEFORE_EFFECTIVE_TIME' })],
      fill_from: ['PERIOD', 'CONDITION'], addition: true, reason: `${why} When the Company may exercise the right.`,
    },
    {
      column_id: 'feeOnExercise', header: 'Fee On Exercise', render: 'vocabulary',
      vocabulary: [code('Fee payable concurrently', why, { code: 'FEE_PAYABLE_CONCURRENTLY' }), code('No fee', why, { code: 'NO_FEE' })],
      fill_from: ['CONDITION', 'CROSS_REFERENCE'], addition: true, reason: `${why} Whether the termination fee must be paid on exercise (a Superior Proposal termination).`,
    },
    asDrafted(why),
  ];
  company.guidance = 'The Company\'s termination rights, the row from the subtype: Parent breach (cure period, terminator-breach bar); Superior Proposal (window before the vote, fee payable concurrently, compliance with the no-shop as a sub-item as drafted; the conditions on the right stated in a later section are facts on this row); Failure to close (a BESPOKE_DATE_RIGHT or failure-to-consummate right).';

  const effect = provisionTable({
    tableKey: 'termination-rights-effect',
    groupHeader: 'EFFECT OF TERMINATION',
    rows: [
      ['Agreement void on termination', yesNo(why)],
      ['Release of liability', [
        code('No liability', why, { code: 'NO_LIABILITY' }),
        code('No liability except for willful and material breach', why, { code: 'NO_LIABILITY_EXCEPT_WILLFUL_BREACH' }),
        code('No liability except for fraud', why, { code: 'NO_LIABILITY_EXCEPT_FRAUD' }),
      ]],
      ['Willful and material breach carve-out', yesNo(why)],
      ['Surviving provisions', [code('Specified sections survive', why, { code: 'SPECIFIED_SECTIONS_SURVIVE' })]],
      ['Termination formalities', [
        code('Written notice required', why, { code: 'WRITTEN_NOTICE_REQUIRED' }),
        code('Board action required', why, { code: 'BOARD_ACTION_REQUIRED' }),
        code('Stockholder approval not required', why, { code: 'STOCKHOLDER_APPROVAL_NOT_REQUIRED' }),
      ]],
      // Work package 19 (d) (NCS generation 5, 7.2): the non-breaching
      // party's remedies preserved where fraud or willful breach liability is.
      ['Remedies preserved', yesNo(why)],
    ],
    reason: why,
    subtypeRows: { AGREEMENT_VOIDING: 'Agreement void on termination', LIABILITY_RELEASE: 'Release of liability', WILLFUL_MATERIAL_BREACH_CARVEOUT: 'Willful and material breach carve-out', PROVISION_SURVIVAL: 'Surviving provisions', TERMINATION_NOTICE: 'Termination formalities', REMEDY_ENTITLEMENT: 'Remedies preserved' },
    guidance: 'The effect of termination, the row from the subtype: the agreement becoming void; the release of liability and its carve-outs; the willful and material breach carve-out; the surviving provisions; and the formalities of terminating (notice, board action, no stockholder approval), one cell per formality.',
  });
  effect.fact_type_rows = { 'TERMINATION_EFFECT:REMEDY_ENTITLEMENT': 'Remedies preserved' };
  section.tables = [mutual, buyer, company, effect];
}

// ==========================================================================
// Termination fees and tail: the Envestnet rows, the fee amount and payer,
// the triggers coded (one cell per trigger), the remedy rows Yes / No, the
// late-payment interest coded, and the fee provision as drafted.
// ==========================================================================

function applyTerminationFees(doc) {
  const section = findSection(doc, 'termination-fees');
  ensureFamily(section, 'SPECIFIC_PERFORMANCE_REMEDIES');
  const why = `${BEN}: a termination fee reads as its amount, its payer, its coded triggers and the clause as drafted.`;
  const legacy = findTable(section, 'termination-fees-table');
  const payer = findColumn(legacy, 'payer');
  const triggers = [
    code('Parent terminates for a Change of Recommendation', why, { code: 'CHANGE_OF_RECOMMENDATION_TERMINATION' }),
    code('Company terminates to enter a Superior Proposal agreement', why, { code: 'SUPERIOR_PROPOSAL_TERMINATION' }),
    code('Parent terminates for a breach of the no-shop', why, { code: 'NO_SHOP_BREACH_TERMINATION' }),
    code('Tail: alternative transaction after a qualifying termination', why, { code: 'TAIL_ALTERNATIVE_TRANSACTION' }),
    code('Regulatory failure (antitrust termination)', why, { code: 'REGULATORY_FAILURE' }),
    code('Financing failure', why, { code: 'FINANCING_FAILURE' }),
    code('Parent breach', why, { code: 'PARENT_BREACH' }),
    code('Failure to close when required', why, { code: 'FAILURE_TO_CLOSE' }),
    code('Failure to pay when due (enforcement costs)', why, { code: 'FAILURE_TO_PAY' }),
  ];
  const table = provisionTable({
    tableKey: 'termination-fees-table',
    rows: [
      ['Company termination fee', []],
      ['Reverse termination fee', []],
      ['Expense reimbursement', []],
      ['Payment timing', [
        code('Within two business days of termination', why, { code: 'WITHIN_TWO_BUSINESS_DAYS' }),
        code('Concurrently with termination', why, { code: 'CONCURRENTLY_WITH_TERMINATION' }),
        code('On consummation or signing of the alternative transaction', why, { code: 'ON_ALTERNATIVE_TRANSACTION' }),
        code('Within a stated period', why, { code: 'WITHIN_STATED_PERIOD' }),
      ]],
      ['Sole and exclusive remedy', yesNo(why)],
      ['Willful-breach carve-out to sole remedy', yesNo(why)],
      ['Interest on late payment', [
        code('Prime rate', why, { code: 'PRIME_RATE' }),
        code('Prime rate plus a spread', why, { code: 'PRIME_RATE_PLUS_SPREAD' }),
        code('Statutory or other rate', why, { code: 'OTHER_RATE' }),
      ]],
    ],
    numberColumns: [
      { column_id: 'amount', header: 'Amount', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT'], addition: true, reason: `${why} The fee amount.` },
      { ...payer, addition: true, reason: `${why} Who pays.` },
      { column_id: 'trigger', header: 'Triggers', render: 'vocabulary', vocabulary: triggers, fill_from: ['TRIGGER', 'CONDITION', 'CROSS_REFERENCE'], addition: true, reason: `${why} One cell per termination scenario that triggers the fee.` },
    ],
    reason: why,
    subtypeKeys: ['FEE_AMOUNT', 'FEE_TRIGGER', 'EXPENSE_REIMBURSEMENT', 'LATE_INTEREST', 'PAID_FEE_EXCLUSIVE_REMEDY'],
    guidance: 'Company termination fee: the FEE_AMOUNT fact (amount, payer COMPANY) and each FEE_TRIGGER fact (one trigger code per scenario, the scenario a sub-item as drafted); Reverse termination fee: the same for a fee Parent pays; Expense reimbursement (amount or cap, the trigger); Payment timing: when each fee falls due, one cell per rule; Sole and exclusive remedy: the PAID_FEE_EXCLUSIVE_REMEDY fact (SPECIFIC_PERFORMANCE_REMEDIES) as YES; Willful-breach carve-out to sole remedy: YES when the exclusivity does not cover willful breach; Interest on late payment: the LATE_INTEREST fact. The tail period goes to the tail-fee table.',
  });
  delete payer.reason; delete payer.addition;
  // Generation 7, 8.02: "in no event shall the Company be required to pay
  // the Company Termination Fee on more than one occasion" came back as a
  // PAID_FEE_EXCLUSIVE_REMEDY fact without a readout; it is a line of the
  // Sole and exclusive remedy row.
  table.fact_type_rows = { 'REMEDY_LIMITATION:PAID_FEE_EXCLUSIVE_REMEDY': 'Sole and exclusive remedy' };
  section.tables = [table];

  const tailSection = findSection(doc, 'tail-fee');
  const tail = provisionTable({
    tableKey: 'tail-fee-table',
    rows: [
      ['Tail window', []],
      ['Threshold % for Company Takeover Proposal', []],
      ['Termination scenarios', [
        code('Outside date termination', why, { code: 'OUTSIDE_DATE_TERMINATION' }),
        code('Stockholder vote failure termination', why, { code: 'VOTE_FAILURE_TERMINATION' }),
        code('Company breach termination', why, { code: 'COMPANY_BREACH_TERMINATION' }),
        code('Legal restraint termination', why, { code: 'LEGAL_RESTRAINT_TERMINATION' }),
      ]],
      ['Qualifying transaction scope', [
        code('Any qualifying transaction signed or consummated within the tail', why, { code: 'SIGNED_OR_CONSUMMATED_WITHIN_TAIL' }),
        code('Consummated within the tail only', why, { code: 'CONSUMMATED_WITHIN_TAIL_ONLY' }),
        code('Same bidder as the pre-termination proposal only', why, { code: 'SAME_BIDDER_ONLY' }),
        code('Any bidder', why, { code: 'ANY_BIDDER' }),
      ]],
    ],
    numberColumns: [
      periodColumn('Period', `${why} The tail window (twelve months).`),
      { column_id: 'threshold', header: 'Threshold', render: 'value', value_kind: 'PERCENTAGE', fill_from: ['PERCENTAGE', 'THRESHOLD'], addition: true, reason: `${why} The percentage substituted into the Company Takeover Proposal definition for the tail (more than 50%).` },
    ],
    reason: why,
    subtypeKeys: ['TAIL_PERIOD', 'FEE_TRIGGER'],
    guidance: 'The tail: its window (TAIL_PERIOD, months in the period column); the percentage the tail substitutes into the takeover-proposal definition; the terminations after which the tail applies, one cell per scenario; and whether a transaction must be signed, consummated, or with the same bidder within the window.',
  });
  tailSection.tables = [tail];
}

// ==========================================================================
// Employee benefits: the comparison codes the corpus uses; the other
// protections as drafted.
// ==========================================================================

// Ben, 2026-09-14, on the option row: "it doesn't show what happens to
// options that are vested or vest by their terms and are in the money.
// Consider showing those as the main row (don't change name) and then say
// 'Exceptions' and show the sub rows?" The row's line is the general case;
// its sub-items are labelled Exceptions.
function applyEquityAwards(doc) {
  const table = findTable(findSection(doc, 'equity-awards'), 'equity-awards-table');
  table.sub_rows_label = 'Exceptions';
  table.guidance = `${table.guidance} The treatment of an award class in the general case (a vested or vesting, in-the-money option) is the row itself, with no row_detail; each exception (unvested awards, out-of-the-money options, awards held by a named group) is a sub-item with row_detail naming the exception.`;
  // Ben, 2026-09-14, on the unvested option sub-row coded "Fully vested
  // (accelerated)" where the payments vest at the first anniversary of the
  // Closing subject to continued service: "While fully vested is normally
  // right I know why this is coded as such but it should say Fully Vested
  // (Conditional Upon Service) or similar". A converted award that vests
  // in full at a later date, or on the original schedule, subject to the
  // holder's continued service is that code; "accelerated" is vesting at
  // the Effective Time with no service condition.
  const vesting = findColumn(table, 'vestingTreatment');
  const conditional = code('Fully vested (conditional upon service)', `${BEN}: "While fully vested is normally right I know why this is coded as such but it should say Fully Vested (Conditional Upon Service) or similar" (an unvested option whose converted payments vest at the first anniversary of the Closing subject to continued service).`, { code: 'FULLY_VESTED_CONDITIONAL_UPON_SERVICE' });
  if (!vesting.vocabulary.some((existing) => existing.code === conditional.code)) vesting.vocabulary.push(conditional);
  table.guidance = `${table.guidance} Vesting Treatment: FULLY_VESTED_CONDITIONAL_UPON_SERVICE when the converted award or its payments vest in full at a later date or on the original schedule subject to the holder's continued service or employment; FULLY_VESTED_ACCELERATED only when vesting occurs at the Effective Time with no continued-service condition.`;
  // The same rule as a validator, not a page remap: FULLY_VESTED_ACCELERATED
  // on a fact whose own words say "continued service" or "continued
  // employment" is a problem (fact-conclusions.js C15, `contradicted_by`),
  // so the readout is dropped with a note and the extractor is held to the
  // conditional code on every deal. Ben, 2026-09-14: "do you have an agent
  // looking at all of our tweaks and seeing if they should be made
  // systematically/throughout the code base back to extraction? I don't
  // want to make surface level/one deal level fixes".
  const accelerated = vesting.vocabulary.find((existing) => existing.code === 'FULLY_VESTED_ACCELERATED');
  if (accelerated) accelerated.contradicted_by = ['continued service', 'continued employment', 'continuous service', 'continuous employment'];
}

function applyEmployeeBenefits(doc) {
  const section = findSection(doc, 'employee-benefits');
  const why = `${BEN}: the benefit standards the corpus states, and the other protections as drafted.`;
  const main = findTable(section, 'employee-benefits-table');
  const standard = findColumn(main, 'standard');
  for (const entry of [
    code('Substantially comparable in the aggregate', why, { code: 'SUBSTANTIALLY_COMPARABLE_IN_THE_AGGREGATE' }),
    code('No less favorable than similarly situated Parent employees', why, { code: 'NO_LESS_FAVORABLE_THAN_SIMILARLY_SITUATED_BUYER_EMPLOYEES' }),
  ]) if (!standard.vocabulary.some((existing) => existing.code === entry.code)) standard.vocabulary.push(entry);
  const other = findTable(section, 'employee-benefits-other-protections');
  other.columns = [asDrafted(why)];
}

// ==========================================================================
// Miscellaneous / Boilerplate: the Envestnet rows with a coded Provision per
// row and the clause as drafted; specific performance (the
// SPECIFIC_PERFORMANCE_REMEDIES family) lives here.
// ==========================================================================

function applyMisc(doc) {
  const section = findSection(doc, 'misc-boilerplate');
  ensureFamily(section, 'SPECIFIC_PERFORMANCE_REMEDIES');
  const why = `${BEN}: each boilerplate row answers with a code from its own list and the clause as drafted.`;
  const table = provisionTable({
    tableKey: 'misc-boilerplate-table',
    rows: [
      ['Governing law', [
        code('Delaware', why, { code: 'DELAWARE' }),
        code('New York', why, { code: 'NEW_YORK' }),
        code('Other state', why, { code: 'OTHER_STATE' }),
        code('Split (primary state; another for financing-source claims)', why, { code: 'SPLIT_GOVERNING_LAW' }),
      ]],
      ['Forum / jurisdiction', [
        code('Delaware Court of Chancery (federal or state court if unavailable)', why, { code: 'DELAWARE_COURT_OF_CHANCERY' }),
        code('Delaware federal or state courts', why, { code: 'DELAWARE_FEDERAL_OR_STATE' }),
        code('New York courts', why, { code: 'NEW_YORK_COURTS' }),
        code('Other forum', why, { code: 'OTHER_FORUM' }),
      ]],
      ['Jury trial waiver', yesNo(why)],
      ['Specific performance', yesNo(why)],
      ['Specific performance limitations', yesNo(why)],
      ['Third-party beneficiaries', [
        code('None, except stated carve-outs (D&O indemnitees, holders\' right to payment)', why, { code: 'NONE_EXCEPT_STATED_CARVE_OUTS' }),
        code('None', why, { code: 'NONE' }),
        code('Stated beneficiaries', why, { code: 'STATED_BENEFICIARIES' }),
      ]],
      ['Fee / expense allocation', [
        code('Each party bears its own', why, { code: 'EACH_PARTY_BEARS_OWN' }),
        code('Specified sharing', why, { code: 'SPECIFIED_SHARING' }),
      ]],
      ['Amendment formalities', [
        code('Writing signed by all parties', why, { code: 'WRITING_SIGNED_BY_ALL_PARTIES' }),
        code('Board action required', why, { code: 'BOARD_ACTION_REQUIRED' }),
        code('Stockholder approval required after the vote where law requires', why, { code: 'STOCKHOLDER_APPROVAL_AFTER_VOTE' }),
        code('No waiver by failure to assert', why, { code: 'NO_WAIVER_BY_FAILURE_TO_ASSERT' }),
      ]],
      ['Assignment', [
        code('No assignment without the other party\'s prior written consent', why, { code: 'NO_ASSIGNMENT_WITHOUT_CONSENT' }),
        code('Merger Sub may assign to Parent or a wholly owned subsidiary', why, { code: 'MERGER_SUB_MAY_ASSIGN_TO_PARENT_AFFILIATE' }),
        code('Parent may assign to an affiliate', why, { code: 'PARENT_MAY_ASSIGN_TO_AFFILIATE' }),
        code('Assignment does not relieve the assignor', why, { code: 'ASSIGNOR_NOT_RELIEVED' }),
      ]],
      ['Notices', [
        code('Writing required', why, { code: 'WRITING_REQUIRED' }),
        code('Email permitted', why, { code: 'EMAIL_PERMITTED' }),
        code('Overnight courier', why, { code: 'OVERNIGHT_COURIER' }),
        code('Personal delivery', why, { code: 'PERSONAL_DELIVERY' }),
      ]],
      ['Entire agreement', yesNo(why)],
      ['Severability', yesNo(why)],
      ['Counterparts and electronic execution', yesNo(why)],
      ['Survival', [
        code('Representations do not survive the Effective Time', why, { code: 'REPS_DO_NOT_SURVIVE' }),
        code('Specified covenants survive', why, { code: 'SPECIFIED_COVENANTS_SURVIVE' }),
      ]],
      ['Construction', yesNo(why)],
      // Work package 19 (d) (NCS generation 5, 7.5): the parties' rights and
      // remedies cumulative and not exclusive.
      ['Cumulative remedies', yesNo(why)],
    ],
    reason: why,
    subtypeKeys: ['GOVERNING_LAW', 'FORUM', 'ASSIGNMENT', 'AMENDMENT_WAIVER', 'NOTICE', 'ENTIRE_AGREEMENT', 'THIRD_PARTY_BENEFICIARY', 'SEVERABILITY', 'COUNTERPARTS', 'SURVIVAL', 'CONSTRUCTION', 'EXPENSES'],
    guidance: 'One row per boilerplate term as the precedent names it; the row is the term the fact addresses (a FORUM fact on the jury waiver is Jury trial waiver; a SPECIFIC_PERFORMANCE_REMEDIES fact on equitable relief, irreparable harm, the bond waiver or closing enforcement is Specific performance, each a sub-item; a REMEDY_COORDINATION or REMEDY_ACTION_EXTENSION fact is Specific performance limitations; an EXPENSES or COST_SHIFT fact is Fee / expense allocation). The Provision cell is the code from that row\'s list (several cells when the clause states several: the amendment formalities, the notice methods); the clause as drafted beside it. A row the agreement does not address is omitted.',
  });
  // Work package 19 (d): a readout-less CONSTRUCTION fact (NCS 7.3) and a
  // CUMULATIVE_RIGHTS fact (NCS 7.5) take their rows by default.
  table.fact_type_rows = { 'MISC_BOILERPLATE_MECHANIC_PRESENT:CONSTRUCTION': 'Construction', 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT:CUMULATIVE_RIGHTS': 'Cumulative remedies' };
  section.tables = [table];
}

// ==========================================================================
// Director and officer indemnification: a section of its own (the old
// app's Other Covenants linked to it), one row per limb from the subtype.
// ==========================================================================

function applyDnoIndemnification(doc) {
  const why = `${BEN}: the D&O covenant is one row per limb (indemnification, advancement, continuation, the tail, claims, successors, enforcement), coded, with its period and premium cap.`;
  const table = provisionTable({
    tableKey: 'dno-indemnification-table',
    rows: [
      ['Indemnification and exculpation', [
        code('To the fullest extent permitted by law', why, { code: 'FULLEST_EXTENT_PERMITTED_BY_LAW' }),
        code('As provided in the charter, by-laws and indemnification agreements', why, { code: 'AS_PROVIDED_IN_ORGANIZATIONAL_DOCUMENTS' }),
      ]],
      ['Expense advancement', [
        code('Required, on an undertaking to repay', why, { code: 'REQUIRED_WITH_UNDERTAKING' }),
        code('Required', why, { code: 'REQUIRED' }),
        code('Not provided', why, { code: 'NOT_PROVIDED' }),
      ]],
      ['Charter and contract continuation', [
        code('No adverse amendment for the stated period', why, { code: 'NO_ADVERSE_AMENDMENT_FOR_STATED_PERIOD' }),
        code('Assumed by the Surviving Corporation', why, { code: 'ASSUMED_BY_SURVIVING_CORPORATION' }),
      ]],
      ['D&O insurance tail', [
        code('Parent purchases or maintains a tail', why, { code: 'PARENT_PURCHASES_TAIL' }),
        code('Company may purchase a tail before Closing', why, { code: 'COMPANY_MAY_PURCHASE_TAIL' }),
        code('Existing policy maintained', why, { code: 'MAINTAIN_EXISTING_POLICY' }),
        code('Premium capped at a multiple of the current premium', why, { code: 'PREMIUM_CAPPED' }),
      ]],
      ['Claims procedure', [
        code('Indemnified party controls the defense', why, { code: 'INDEMNIFIED_PARTY_CONTROLS_DEFENSE' }),
        code('Parent controls the defense', why, { code: 'PARENT_CONTROLS_DEFENSE' }),
        code('Cooperation in the defense', why, { code: 'COOPERATION_IN_DEFENSE' }),
      ]],
      ['Successor assumption', [code('Successors must assume the obligations', why, { code: 'SUCCESSORS_MUST_ASSUME' })]],
      ['Third-party enforcement', [code('Enforceable by the indemnified parties', why, { code: 'ENFORCEABLE_BY_INDEMNIFIED_PARTIES' })]],
    ],
    numberColumns: [
      periodColumn('Period', `${why} The period of the obligation (six years).`),
      { column_id: 'premiumCap', header: 'Premium Cap', render: 'value', value_kind: 'PERCENTAGE', fill_from: ['PERCENTAGE', 'AMOUNT'], addition: true, reason: `${why} The tail premium cap as a percentage of the current premium (300%).` },
    ],
    reason: why,
    subtypeRows: {
      INDEMNIFICATION_AND_EXCULPATION: 'Indemnification and exculpation', EXPENSE_ADVANCEMENT: 'Expense advancement',
      CHARTER_AND_CONTRACT_CONTINUATION: 'Charter and contract continuation', DNO_INSURANCE_TAIL: 'D&O insurance tail',
      CLAIMS_PROCEDURE: 'Claims procedure', SUCCESSOR_ASSUMPTION: 'Successor assumption', THIRD_PARTY_ENFORCEMENT: 'Third-party enforcement',
    },
    guidance: 'One row per limb of the D&O covenant, from the fact\'s subtype; the code from that row\'s list (several cells when the limb states several), the period (six years) and the premium cap as numbers, the limb as drafted. Several facts of one limb are sub-items of the row.',
  });
  doc.sections.push({
    section_key: 'dno-indemnification',
    title: 'Director and Officer Indemnification',
    legacy_config: null,
    v2_family_keys: [{ key: 'DNO_INDEMNIFICATION', confidence: 'high' }],
    tables: [table],
    print_pages: [],
  });
}

// ==========================================================================
// Consideration: the appraisal line is derived by the page from the
// APPRAISAL_DISSENTERS_RIGHTS provision (the family that carries it),
// shown as drafted. Decision 33's from_subtype_keys named a CONSIDERATION
// subtype the extractor never produces for it (Metsera generation 3: the
// appraisal facts are APPRAISAL_DISSENTERS_RIGHTS/APPRAISAL_STATUS).
// ==========================================================================

function applyConsideration(doc) {
  const section = findSection(doc, 'consideration-hero');
  const why = `${BEN}: no column shows a cited fragment.`;
  const structure = findTable(section, 'consideration-structure');
  const appraisal = findColumn(structure, 'appraisalRights');
  delete appraisal.from_subtype_keys;
  // The appraisal provision arrives as CONSIDERATION/APPRAISAL_LINK when the
  // extractor reads it that way and as APPRAISAL_DISSENTERS_RIGHTS otherwise
  // (Metsera generation 5 had both, the second one invalid).
  appraisal.derived = { from_family: 'CONSIDERATION', from_subtype: 'APPRAISAL_LINK', join: 'presence', alternatives: [{ from_family: 'APPRAISAL_DISSENTERS_RIGHTS', from_subtype: 'APPRAISAL_STATUS' }, { from_family: 'APPRAISAL_DISSENTERS_RIGHTS', from_subtype: 'APPRAISAL_ENTITLEMENT' }] };
  // Ben, 2026-09-14: "this should just say 'present'".
  appraisal.render = 'boolean';
  delete appraisal.display;
  appraisal.guidance = 'Derived by the page from the appraisal provision itself (the CONSIDERATION/APPRAISAL_LINK fact, else the APPRAISAL_DISSENTERS_RIGHTS facts): Present when the agreement has one. Never filled from a readout.';
  // Metsera generation 7, 2.01 (2026-09-14): the six appraisal mechanics
  // (status, entitlement, withdrawal and reconversion, notice to Parent,
  // negotiation control, settlement consent) had no section at all and
  // fell off the page. They are the consideration grid's Other provisions,
  // one line each with its summary.
  ensureFamily(section, 'APPRAISAL_DISSENTERS_RIGHTS');
  structure.guidance = `${structure.guidance} An APPRAISAL_LINK fact carries no cells at all (its line is derived); the consideration type is coded from the CONSIDERATION_PACKAGE fact (the Merger Consideration definition or conversion clause), never from an appraisal, exclusion or Merger Sub share fact.`;
  const components = findTable(section, 'consideration-components');
  components.guidance = `${components.guidance} The conversion of Merger Sub's shares into shares of the Surviving Corporation is a MERGER_STRUCTURE_CLOSING/LEGAL_EFFECT fact, never a row here.`;
  const per = findColumn(components, 'per');
  per.render = 'vocabulary';
  per.vocabulary = [
    code('Per share of Company Common Stock', why, { code: 'PER_SHARE_OF_COMPANY_COMMON_STOCK' }),
    code('Per share of Company Preferred Stock', why, { code: 'PER_SHARE_OF_COMPANY_PREFERRED_STOCK' }),
    code('Per unit or other interest', why, { code: 'PER_UNIT_OR_OTHER_INTEREST' }),
  ];
  // Ben, 2026-09-14, on the per-share grid: "I'd get rid of 'as drafted'
  // unless you think it is offering something I'm missing". The words stay
  // behind "See provision"; the column goes.
  components.columns = components.columns.filter((column) => column.column_id !== 'contingency');
  // Ben, 2026-09-14: "I also don't mind the definitions but I'd put them
  // under the word 'cash' and 'CVR' in component and also present the
  // combined definition". The defined term sits under the component name;
  // the package's own term (the “Merger Consideration”) closes the table.
  const definedAs = findColumn(components, 'definedAs');
  definedAs.display = 'subject_note';
  // Work package 13 (c) (NCS generation 5, 2.1): the package fact's first
  // defined term was "Eligible Shares"; the “Merger Consideration” sits in
  // its OBJECT's words. The combined term is the quoted term matching
  // term_words, a DEFINED_TERM component first, else no combined definition.
  components.combined_definition_from = { family_key: 'CONSIDERATION', subtype_key: 'CONSIDERATION_PACKAGE', label: 'Combined definition', term_words: 'Consideration$' };
  const election = findTable(section, 'consideration-hero-election-mechanics');
  for (const column of election.columns) if (column.render === 'verbatim') { column.display = 'fact_text'; column.header = 'As drafted'; }
  // Work package 13 (c) (manager, 2026-10-18, plan finding (79), NCS
  // generation 5, 2.1): "The consideration tables carry the election type
  // (Mixed election) and the mechanics rows but no per-share economics: the
  // three exchange ratios and the cash value sit in Defined Terms while the
  // consideration-components table shows 'Stock election' and 'Acquirer
  // stock' rows with no ratio or value. The shape needs the election
  // options as rows (cash election, share election, mixed election: ratio,
  // cash, value per share) filled from the facts, with a value fallback
  // from a defined ratio that carries a number". One table, one row per
  // election a holder may make, each row the option's exchange ratio, its
  // cash per share and the value terms the agreement defines for it. The
  // extractor may fill it like any fixed-list table; the page
  // (lib/product/table-view.js, fillElectionOptions) also builds the rows
  // from the stored facts by the election_options rule: a component fact is
  // an option's when its readout carries the option's form code or its
  // words name that election (never a no-election default, which is the
  // mechanics table's "If no election" row); the ratio and cash come from
  // the fact's own value cells or numeric components, and every value term
  // the fact names whose Defined Terms entry is a bare number fills the
  // empty ratio (a count) or cash (dollars) cell, else is shown with its
  // definition under Value terms, with the numbers of the terms that
  // definition names in turn. Ben decides the row wording ("Stock election"
  // as the components table has it, or "Share election" as NCS drafts it)
  // and whether an unfilled option should read as not offered; until then
  // an option with no fact has no row.
  // Ben, 2026-10-18 (plan finding (85)), on the four questions, verbatim:
  // (1) "STOCK"; (2) "I'D SAY \"NOT A DEAL FEATURE\""; (3) "KEEP ELECTIONS
  // BUT ONLY WHEN THERE IS AN ELECTIOB"; (4) "WHAT DO YOU MEAN MINE TO SAY?
  // SHOYUULDN'T ALL THE INFO BE LINKED/ACCURTE?". So (work package 16): the
  // row is "Stock election"; an option no fact of the run is for reads "Not
  // a deal feature", and one whose only fact is held by validation reads
  // held, never "not a feature" (the held fact's own words place it); the
  // components table keeps its election rows only when the deal has an
  // election (this table has a filled row), else the fixed forms alone;
  // and a value term whose definition names an option's own term or one
  // of its ratio terms is linked to that option's row by the code reading
  // the definitions, its derivation cited: under Value terms, and in the
  // value-per-share cell when its definition is a bare number.
  const options = {
    table_key: 'consideration-election-options',
    group_header: 'ELECTION OPTIONS',
    term_column: { header: 'Election', source: 'subject', fill_from: ['TERM', 'DEFINED_TERM', 'CONDITION'] },
    rows_are: 'fixed list',
    fixed_row_labels: ['Cash election', 'Stock election', 'Mixed election'],
    absent_row_label: 'Not a deal feature',
    subtype_keys: ['CASH_COMPONENT', 'STOCK_COMPONENT', 'ELECTION'],
    guidance: 'Only for a deal whose holders elect between forms of consideration; never a row when the agreement has no election. One row per option a holder may elect (cash only, stock only, a stated mix), from the conversion clause: the exchange ratio (Parent shares per Company share) and the cash per share that option receives, and the defined term the agreement gives it. A no-election default is the election mechanics table\'s "If no election" row, never an option here. The page fills an empty ratio or cash cell from the agreement\'s own definition of a term the option names when that definition is a bare number (a "Cash Exchange Ratio" that "means 0.1371"), links every value term whose definition names the option\'s term or ratio term, and shows an option no fact is for as "Not a deal feature".',
    columns: [
      { column_id: 'exchangeRatio', header: 'Exchange ratio', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT', 'THRESHOLD'], addition: true, reason: `${WP13}: the Parent shares each Company share receives under the option, as stated.` },
      { column_id: 'cashPerShare', header: 'Cash per share', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT', 'THRESHOLD'], addition: true, reason: `${WP13}: the cash each Company share receives under the option, as stated.` },
      { column_id: 'valuePerShare', header: 'Value per share', render: 'value', value_kind: 'AMOUNT', fill_from: ['AMOUNT', 'THRESHOLD'], addition: true, reason: `${WP16}: the value per share the agreement states for the option, as a number: a linked value term whose definition is a bare number (the manager, 18:05 UTC: "in the value-per-share cell when the definition is a bare number"); a value defined as a formula is a Value terms entry.` },
      { column_id: 'valueTerms', header: 'Value terms', render: 'verbatim', display: 'fact_text', fill_from: ['DEFINED_TERM', 'OPERATION', 'OBJECT'], addition: true, reason: `${WP13}: the value terms the option names (a "Cash Consideration" defined as a ratio times a closing price), each with its definition, when the option's value is a formula rather than a number.` },
      { column_id: 'definedAs', header: 'Defined as', render: 'term', fill_from: ['DEFINED_TERM', 'TERM'], display: 'subject_note', addition: true, reason: `${WP13}: the defined term the agreement gives the option's consideration ("Share Consideration", "Mixed Consideration").` },
    ],
    election_options: {
      rows: {
        'Cash election': { form_code: 'CASH_ELECTION', words: 'election to receive (?:only |solely )?(?:the )?cash' },
        'Stock election': { form_code: 'STOCK_ELECTION', words: 'election to receive (?:only |solely )?(?:the )?(?:share|stock)' },
        'Mixed election': { form_code: 'MIXED_ELECTION', words: 'election to receive (?:a |the )?mixed|\\bmixed (?:consideration|election)' },
      },
      unless: '\\bno election\\b',
      ratio_column: 'exchangeRatio',
      cash_column: 'cashPerShare',
      terms_column: 'valueTerms',
      term_column: 'definedAs',
      value_terms: '(?:Consideration|Value|Amount|Price|Ratio)$',
      // Work package 16: the value cell a linked bare-number definition
      // fills, and the words of a row whose only fact is held.
      value_column: 'valuePerShare',
      held_row_label: 'Held: this option\'s fact is held by validation',
    },
  };
  section.tables.splice(section.tables.indexOf(components) + 1, 0, options);
  // Ben, 2026-10-18 (plan finding (85)): "KEEP ELECTIONS BUT ONLY WHEN
  // THERE IS AN ELECTIOB". When the election options table has no filled
  // row, a per-share row coded as an election form folds into its plain
  // form on the page (lib/product/table-view.js foldElectionForms).
  components.election_forms = { options_table_key: 'consideration-election-options', plain_form_by_code: { CASH_ELECTION: 'CASH', STOCK_ELECTION: 'PARENT_STOCK' } };
  components.guidance = `${components.guidance} The election forms (Cash election, Stock election) are for a deal whose holders elect between forms of consideration only; in any other deal code the form itself (Cash, Acquirer stock).`;
  const mae = findSection(doc, 'mae-definitions');
  for (const table of mae.tables) for (const column of table.columns) if (column.render === 'verbatim') column.display = 'fact_text';
}

// ==========================================================================
// Representations: the old app's full canonical row list (the Envestnet
// print shows rows TopBuild's did not: No Undisclosed Liabilities, Internal
// Controls, Consents and Approvals, Regulatory Status), and the
// capitalization representation's limbs (the CAPITALISATION family) as
// sub-items of Capitalization; Subsidiaries.
// ==========================================================================

const EXTRA_REP_ROWS = [
  'No Undisclosed Liabilities', 'Internal Controls; Disclosure Controls', 'Consents and Approvals (separate from No Conflict)',
  'Regulatory Status', 'FDA / Healthcare Regulatory', 'Product Liability; Product Recall; Quality & Safety',
  'Data Privacy; Information Security; Cybersecurity', 'Anti-Corruption; Sanctions', 'Global Trade Control Laws; Sanctions',
  'Related Party / Affiliate / Interested-Party Transactions', 'Material Contracts', 'Suppliers', 'Clinical Trials; Clinical Data',
  'Healthcare Compliance', 'Government Contracts', 'Sufficiency of Assets', 'Investment Company Act Status',
  'Sufficient / Available Funds; Financing', 'Ownership of Company Stock; No Interested Stockholder', 'Merger Sub Operations',
];

const CAPITALISATION_LIMBS = [
  'Authorized capital stock', 'Issued and outstanding shares', 'Reserved or issuable securities', 'Equity award inventory',
  'Subsidiary equity interests', 'No other securities, options or voting agreements', 'Valid issuance, fully paid and nonassessable',
];

// The general exceptions and knowledge rows at the head of each
// representations table, as the old app had them. Ben, 2026-09-14, on the
// Article III introduction rendered as seven status and document
// representations: "all of this is miscoded. THis is the standard intro to
// the reps that provides the exceptions for all reps - look at the old
// system - we should be able to show the reader the general categories of
// the exceptions (SEC filings) and as they click into deeper levels show
// more detail (last X days) etc"; and, on the separate general
// qualifications table that followed: "by miscoded I meant oyu currentl
// have it messed up and you need to move it over to what we had in the old
// vesrion....". The old version (the Envestnet print,
// scripts/product/legacy-review-print.js) opened the table with a "General
// Exceptions" row (SEC Filings: Cut-off, Portions excluded; Disclosure
// Letter) and a "Knowledge" row (Standard, Persons), ahead of the
// representations. So: those two fixed rows first, their categories as
// sub-items behind "More detail", the cut-off in the Lookback column and
// the excluded portions, the arrangement rule and the knowledge standard as
// codes in the Qualifiers column. The separate general-qualifications table
// is retired; the REPRESENTATION_QUALIFICATION subtype stays.
const GENERAL_EXCEPTIONS_ROW = 'General Exceptions';
const KNOWLEDGE_ROW = 'Knowledge';
const GENERAL_EXCEPTION_DETAILS = ['SEC Filings', 'Disclosure Letter', 'Other'];
const KNOWLEDGE_DETAILS = ['Standard', 'Persons'];

function generalExceptionCodes(why) {
  return [
    code('Except as disclosed in SEC filings', why, { code: 'EXCEPT_AS_DISCLOSED_IN_SEC_FILINGS' }),
    code('Forward-looking statements excluded', why, { code: 'EXCLUDES_FORWARD_LOOKING_STATEMENTS' }),
    code('Risk Factors excluded', why, { code: 'EXCLUDES_RISK_FACTORS' }),
    code('Exhibits excluded', why, { code: 'EXCLUDES_EXHIBITS' }),
    code('Specific historical facts still count', why, { code: 'SPECIFIC_HISTORICAL_FACTS_NOT_EXCLUDED' }),
    code('Except as set forth in the Disclosure Letter', why, { code: 'EXCEPT_AS_SET_FORTH_IN_DISCLOSURE_LETTER' }),
    code('Arranged by section', why, { code: 'ARRANGED_BY_SECTION' }),
    code('Disclosure qualifies other sections where reasonably apparent', why, { code: 'CROSS_SECTION_WHERE_REASONABLY_APPARENT' }),
    code('Disclosure qualifies only the section it is made against', why, { code: 'SECTION_SPECIFIC_ONLY' }),
    code('Materiality standard for the article', why, { code: 'ARTICLE_MATERIALITY_STANDARD' }),
  ];
}

function knowledgeCodes(why) {
  return [
    code('Knowledge after reasonable inquiry', why, { code: 'KNOWLEDGE_AFTER_REASONABLE_INQUIRY' }),
    code('Actual knowledge', why, { code: 'ACTUAL_KNOWLEDGE' }),
    code('Constructive knowledge (should have known)', why, { code: 'CONSTRUCTIVE_KNOWLEDGE' }),
    code('Persons listed on Disclosure Letter', why, { code: 'PERSONS_LISTED_ON_DISCLOSURE_LETTER' }),
    code('Named individuals', why, { code: 'NAMED_INDIVIDUALS' }),
    code('Officers', why, { code: 'OFFICERS' }),
  ];
}

function applyRepresentations(doc) {
  for (const sectionKey of ['representations-qualifiers', 'parent-representations-qualifiers']) {
    const section = findSection(doc, sectionKey);
    ensureFamily(section, 'CAPITALISATION');
    // The Knowledge row takes the knowledge definition (KEY_DEFINED_TERMS/KNOWLEDGE).
    section.v2_family_keys.push({ key: 'KEY_DEFINED_TERMS', confidence: 'low' });
    const table = section.tables[0];
    for (const label of EXTRA_REP_ROWS) if (!table.fixed_row_labels.includes(label)) table.fixed_row_labels.push(label);
    table.fixed_row_labels = [GENERAL_EXCEPTIONS_ROW, KNOWLEDGE_ROW, ...table.fixed_row_labels.filter((label) => label !== GENERAL_EXCEPTIONS_ROW && label !== KNOWLEDGE_ROW)];
    table.fixed_row_labels_source = `${table.fixed_row_labels_source}; lib/rubric.js REP-T-* labels (decision 34); Envestnet print General Exceptions and Knowledge rows (Ben, 2026-09-14)`;
    table.detail_labels_by_row = {
      [GENERAL_EXCEPTIONS_ROW]: [...GENERAL_EXCEPTION_DETAILS],
      [KNOWLEDGE_ROW]: [...KNOWLEDGE_DETAILS],
      ...(table.detail_labels_by_row || {}),
      'Capitalization; Subsidiaries': [...CAPITALISATION_LIMBS],
    };
    const why = `${BEN}: "look at the old system - we should be able to show the reader the general categories of the exceptions (SEC filings) and as they click into deeper levels show more detail (last X days) etc" (the General Exceptions and Knowledge rows of the old version's representations table).`;
    const qualifiers = findColumn(table, 'materiality');
    for (const entry of [...generalExceptionCodes(why), ...knowledgeCodes(why)]) {
      if (!qualifiers.vocabulary.some((existing) => existing.code === entry.code)) qualifiers.vocabulary.push(entry);
    }
    qualifiers.vocabulary_by_row = {
      ...(qualifiers.vocabulary_by_row || {}),
      [GENERAL_EXCEPTIONS_ROW]: generalExceptionCodes(why).map((entry) => entry.code),
      [KNOWLEDGE_ROW]: knowledgeCodes(why).map((entry) => entry.code),
    };
    qualifiers.guidance = 'On a representation row: the materiality or knowledge qualifier the representation carries. On the General Exceptions row: the codes the article introduction establishes for that source of exception (the portions of the SEC filings excluded, the arrangement and cross-section rule of the Disclosure Letter), several cells when it establishes several. On the Knowledge row: the knowledge standard (Standard) and whose knowledge counts (Persons).';
    const lookback = findColumn(table, 'lookback');
    lookback.guidance = 'On a representation row: the look-back date or period the representation states. On the General Exceptions row, SEC Filings sub-item: the cut-off of the SEC filings exception (filed since a date; at least one business day before signing), as the cited words parse.';
    // The rows the page fills from stored generations' facts (the page rule in
    // lib/product/table-view.js): the article introduction's facts go to
    // intro_facts_row, the knowledge definition to knowledge_facts_row.
    table.intro_facts_row = GENERAL_EXCEPTIONS_ROW;
    table.knowledge_facts_row = KNOWLEDGE_ROW;
    table.guidance = `${table.guidance} A CAPITALISATION fact (authorized capital, issued and outstanding shares, reserved securities, the award inventory, subsidiary equity) is a limb of Capitalization; Subsidiaries: row_label that representation, row_detail the limb from its list; a fact that states a count of a security class is coded to the capitalization table instead (see capitalization-table). The article's introductory sentence (the disclosure-letter and SEC-document exceptions to every representation) is the ${GENERAL_EXCEPTIONS_ROW} row, the first row of this table: each REPRESENTATION_QUALIFICATION fact carries row_label "${GENERAL_EXCEPTIONS_ROW}" and row_detail the source of exception from its list ("SEC Filings" for the Filed SEC Documents exception, "Disclosure Letter" for the Disclosure Letter exception, "Other" for any other article-wide qualification), its Qualifiers cells the codes the clause establishes (EXCLUDES_FORWARD_LOOKING_STATEMENTS, EXCLUDES_RISK_FACTORS, EXCLUDES_EXHIBITS, SPECIFIC_HISTORICAL_FACTS_NOT_EXCLUDED on the SEC filings exception; ARRANGED_BY_SECTION, CROSS_SECTION_WHERE_REASONABLY_APPARENT or SECTION_SPECIFIC_ONLY on the Disclosure Letter exception) and its lookback cell the SEC filings cut-off (the date filed since, or the period before signing). The knowledge standard is the ${KNOWLEDGE_ROW} row, the second row: a KEY_DEFINED_TERMS/KNOWLEDGE fact (the "Knowledge" definition) or an article-wide knowledge standard from the introduction carries row_label "${KNOWLEDGE_ROW}", row_detail "Standard" (the standard: KNOWLEDGE_AFTER_REASONABLE_INQUIRY, ACTUAL_KNOWLEDGE, CONSTRUCTIVE_KNOWLEDGE) or "Persons" (whose knowledge counts: PERSONS_LISTED_ON_DISCLOSURE_LETTER, NAMED_INDIVIDUALS, OFFICERS); a single fact that states both carries no row_detail and both codes. Never a numbered representation on either row.`;
    table.only_subtype_keys = ['STATUS_REPRESENTATION', 'COMPLIANCE_REPRESENTATION', 'DOCUMENT_REPRESENTATION', 'CONTRACT_REPRESENTATION', 'FINANCIAL_REPRESENTATION', 'NEGATIVE_REPRESENTATION', 'REPRESENTATION_QUALIFICATION', 'KNOWLEDGE', ...CAPITALISATION_SUBTYPES];
    // The separate general-qualifications table (an earlier reading of the
    // same instruction) is retired: its rows are the General Exceptions row.
    section.tables = section.tables.filter((candidate) => !/general-qualifications$/.test(candidate.table_key));
  }
}

// ==========================================================================
// Capitalization: the capitalization representation's counts by security
// class. Ben, 2026-09-14, asked whether the counts should have a table of
// their own rather than sub-items of Capitalization; Subsidiaries: "sure
// add a table". Rows are the security classes (open to a new one), the
// columns the authorised, issued and outstanding and reserved counts and
// the date they speak to, every number parsed from the cited words; the
// absence facts (no other securities, no voting agreements) sit under the
// table as drafted; the representations row keeps its sub-items.
// ==========================================================================

const CAPITALISATION_SUBTYPES = ['AUTHORISED_CAPITAL', 'ISSUED_AND_OUTSTANDING', 'RESERVED_OR_ISSUABLE_SECURITIES', 'EQUITY_AWARD_INVENTORY', 'VALID_ISSUANCE_STATUS', 'CAPITALISATION_ABSENCE', 'PARTNERSHIP_OR_SUBSIDIARY_EQUITY'];
const CAPITALIZATION_ROWS = ['Common Stock', 'Preferred Stock', 'Company Stock Options', 'Company RSUs', 'Company PSUs', 'Company Restricted Stock Awards', 'ESPP', 'Warrants', 'Merger Sub capital stock', 'Subsidiary equity'];

function applyCapitalization(doc) {
  const why = `${BEN}: "sure add a table" (the capitalization counts by security class).`;
  const countColumn = (columnId, header, subtypes, guidance) => ({
    column_id: columnId,
    header,
    render: 'value',
    value_kind: 'COUNT',
    fill_from: ['AMOUNT', 'THRESHOLD'],
    from_subtype_keys: subtypes,
    addition: true,
    reason: why,
    guidance,
  });
  const table = {
    table_key: 'capitalization-table',
    group_header: null,
    term_column: { header: 'Security class', source: 'subject', fill_from: ['TERM', 'OBJECT', 'DEFINED_TERM'] },
    columns: [
      countColumn('authorised', 'Authorised', ['AUTHORISED_CAPITAL'], 'The number of shares of this class the charter authorises (an AUTHORISED_CAPITAL fact), parsed from the cited count.'),
      countColumn('issued', 'Issued and outstanding', ['ISSUED_AND_OUTSTANDING', 'EQUITY_AWARD_INVENTORY'], 'The number of shares of this class issued and outstanding (an ISSUED_AND_OUTSTANDING fact), or, on an award class, the shares subject to outstanding awards of that class (an EQUITY_AWARD_INVENTORY fact), parsed from the cited count.'),
      countColumn('reserved', 'Reserved for issuance', ['RESERVED_OR_ISSUABLE_SECURITIES'], 'The number of shares reserved for issuance under this class or plan (a RESERVED_OR_ISSUABLE_SECURITIES fact), parsed from the cited count.'),
      {
        column_id: 'asOf',
        header: 'As of',
        render: 'value',
        value_kind: 'DATE',
        fill_from: ['DATE', 'TRIGGER'],
        addition: true,
        reason: why,
        guidance: 'The date the count speaks to (the Measurement Date or capitalization date), as the cited words parse; cite the chapeau\'s date when the limb inherits it.',
      },
      {
        column_id: 'validIssuance',
        header: 'Validly issued',
        render: 'boolean',
        fill_from: ['LITANY', 'OPERATION', 'STANDARD'],
        from_subtype_keys: ['VALID_ISSUANCE_STATUS'],
        addition: true,
        reason: why,
        guidance: 'Present when the representation states that the class is duly authorized, validly issued, fully paid and nonassessable (a VALID_ISSUANCE_STATUS fact on that class\'s row).',
      },
      asDrafted(why, ['OPERATION', 'OBJECT', 'AMOUNT', 'QUALIFIER', 'EXCEPTION', 'LIST', 'LITANY']),
    ],
    rows_are: 'fixed list',
    fixed_row_labels: [...CAPITALIZATION_ROWS],
    open_rows: true,
    only_subtype_keys: [...CAPITALISATION_SUBTYPES],
    // Stored generations' facts without a readout are placed by the page
    // by the security class their words name (lib/product/table-view.js).
    row_from_security_class: true,
    // Ben, 2026-09-14, on the "No other securities" lines under the table:
    // "can we tidy up this no other securities other provisions like in the
    // other sections?" The absence facts are the table's Other provisions
    // (a Term / Summary table with branch rows), titled No other securities.
    footer_from_subtype: { subtype_key: 'CAPITALISATION_ABSENCE', label: 'No other securities', style: 'other_provisions' },
    guidance: `One row per security class as the precedent names it (fixed_row_labels; a new class label only when none fits, in the same style). The extractor cuts one fact per class and count: an AUTHORISED_CAPITAL fact goes to the class's row with its authorised count, an ISSUED_AND_OUTSTANDING fact with its issued count, a RESERVED_OR_ISSUABLE_SECURITIES fact with its reserved count (the ESPP reserve on the ESPP row), an EQUITY_AWARD_INVENTORY fact to the award class's row (Company Stock Options, Company RSUs, Company PSUs, Company Restricted Stock Awards) with the shares subject to outstanding awards in the issued column; a sentence that counts two classes is two facts. Every count is parsed by code from the cited words (never written by the model); asOf is the date the count speaks to. A VALID_ISSUANCE_STATUS fact marks its class Validly issued. A CAPITALISATION_ABSENCE fact (no other securities, options, voting agreements or voting debt; no rights plan) is never a row: it carries row_label "No other securities" and no cells, and the page shows it as drafted under the table. A PARTNERSHIP_OR_SUBSIDIARY_EQUITY fact is the Subsidiary equity row, or the Subsidiary equity interests limb of Capitalization; Subsidiaries on the representations table. Merger Sub's own capital stock (Article IV) is the "Merger Sub capital stock" row, never the Company's Common Stock.`,
  };
  const section = {
    section_key: 'capitalization',
    title: 'Capitalization',
    legacy_config: 'components/review/table-configs/representations-qualifiers.config.js',
    note: 'Added 2026-09-14 (Ben: "sure add a table"); the old app carried the capitalization counts inside the Capitalization; Subsidiaries representation row.',
    v2_family_keys: [{ key: 'CAPITALISATION', confidence: 'high' }],
    tables: [table],
  };
  const index = doc.sections.findIndex((candidate) => candidate.section_key === 'parent-representations-qualifiers');
  doc.sections.splice(index + 1, 0, section);
}

// ==========================================================================
// Votes, general covenants and the advisers section: no fragment columns.
// ==========================================================================

// Work package 18 (c) (plan finding (91); NCS generation 5, 5.14;
// 2026-10-18): twelve GENERAL_COVENANTS/PUBLICITY facts landed on one
// "Public announcements" row, "correct and unreadable". The row's sub-items,
// named by the facts' own words (detail_from_words_by_row, first match
// wins), so a sponsor-backed seller's carve-outs read as a line of their
// own. The labels were the code's proposal; Ben, 2026-10-18 (plan finding
// (166)): "all sounds fine", so the ten are final. Order of the rules: the carve-outs and
// the consistency proviso before the duties they qualify, so "without
// providing ... the opportunity for such consultation and review, issue a
// press release ... consistent with prior press releases" is the
// consistency line, not consultation; the Law or exchange exception last,
// since every duty repeats it.
const PUBLICITY_ROW = 'Public announcements';
const PUBLICITY_DETAILS = [
  'Announcement release',
  'Consent to releases',
  'Consultation and review',
  'Consistent with prior statements',
  'Carve-out: ordinary course',
  'Carve-out: employees',
  'Carve-out: disputes',
  'Carve-out: investor and media communications',
  'Carve-out: sponsor disclosure',
  'Law or exchange exception',
];
const PUBLICITY_WORDS = [
  { detail: 'Carve-out: sponsor disclosure', words: 'Specified\\s+Stockholders?|limited\\s+partners|investment\\s+funds?|\\bsponsors?\\b' },
  { detail: 'Carve-out: employees', words: '\\bemployees\\b' },
  { detail: 'Carve-out: disputes', words: '\\bdisputes?\\b|\\blitigation\\b' },
  { detail: 'Carve-out: investor and media communications', words: '\\banalysts\\b|\\binvestors\\b|\\bmedia\\b' },
  { detail: 'Carve-out: ordinary course', words: 'ordinary\\s+course' },
  { detail: 'Consistent with prior statements', words: 'consistent\\s+with\\s+(?:prior|previous)|previously\\s+(?:approved|issued|made)|substantially\\s+similar\\s+to' },
  { detail: 'Announcement release', words: 'press\\s+release\\s+announcing|initial\\s+(?:press\\s+)?release|joint\\s+(?:press\\s+)?release|(?:execution|signing)\\s+(?:and\\s+delivery\\s+)?of\\s+this\\s+Agreement' },
  { detail: 'Consent to releases', words: 'prior\\s+written\\s+consent|consent\\s+shall\\s+not\\s+be\\s+unreasonably' },
  { detail: 'Consultation and review', words: '\\bconsult|opportunity\\s+to\\s+review|review\\s+and\\s+comment' },
  { detail: 'Law or exchange exception', words: 'required\\s+by\\s+(?:applicable\\s+)?Law|listing\\s+agreement|court\\s+process|securities\\s+exchange' },
];

// Work package 18 (d) (plan finding (93); NCS generation 5, 5.17;
// 2026-10-18): the Specified Stockholders' registration rights came back
// as 41 facts scattered over "General notification" (13), "Access to
// information", "Stock exchange listing", "Litigation notification" and
// three open rows. The general covenants table gets a fixed "Registration
// rights" row; a words_rows rule naming the Registration Statement,
// Registrable Securities, a prospectus, Rule 144 or Rule 415 places a
// covenant there, over the row the model chose (over_readout), and the
// row's sub-items follow from the words. The labels are the code's
// proposal; Ben names them ("he decides the names; the code only
// proposes"). Metsera generation 8 has no covenant with these words and
// is unchanged.
const REGISTRATION_ROW = 'Registration rights';
// Ben, 2026-10-18 (plan finding (163)): "reg rights I think goes with
// consideration (but at bottom)": the row is the one row of a table at the
// bottom of the Consideration section, not of the general covenants table;
// the covenants table's words rule sends the facts there (table_key).
const REGISTRATION_TABLE_KEY = 'consideration-registration-rights';
const REGISTRATION_WORDS = 'Registration\\s+Statement|Registrable\\s+Securities|\\bprospectus|Rule\\s+144|Rule\\s+415';
// Ben, 2026-10-18 (plan finding (166)), on the proposed sub-items: "are
// these from a reg rights agreement? I wouldn't go into anywhere near this
// depth in this product". The row is one line: present or absent, the
// as-drafted summary and its facts behind it, no sub-items (no_sub_items);
// the seven proposed labels are withdrawn.

function applyVotesAndCovenants(doc) {
  const why = `${BEN}: no column shows a cited fragment.`;
  const votesSection = findSection(doc, 'votes-approvals-meeting');
  const votes = findTable(votesSection, 'votes-approvals-meeting-table');
  const anchor = findColumn(votes, 'anchor');
  anchor.render = 'vocabulary';
  anchor.vocabulary = [
    code('After the agreement date', why, { code: 'AFTER_AGREEMENT_DATE' }),
    code('After SEC clearance of the proxy statement', why, { code: 'AFTER_SEC_CLEARANCE' }),
    code('After the proxy statement is filed', why, { code: 'AFTER_PROXY_FILING' }),
    code('After mailing', why, { code: 'AFTER_MAILING' }),
    code('After S-4 effectiveness', why, { code: 'AFTER_S4_EFFECTIVENESS' }),
  ];
  const detail = findColumn(votes, 'detail');
  detail.header = 'As drafted';
  detail.display = 'fact_text';
  const adjournment = findTable(votesSection, 'votes-approvals-meeting-adjournment');
  const restriction = findColumn(adjournment, 'restriction');
  restriction.header = 'As drafted';
  restriction.display = 'fact_text';
  // Metsera generation 6, 6.11 (2026-09-14): the Company must adjourn when
  // "there are not sufficient affirmative votes", the commonest permitted
  // reason, and the precedent's two codes could not say so (the cell was
  // empty). Parent's request is the other reason the corpus uses.
  const permittedReason = findColumn(adjournment, 'permittedReason');
  permittedReason.vocabulary = [
    ...permittedReason.vocabulary,
    code('Insufficient votes', 'Metsera generation 6, 6.11: adjournment when there are not sufficient affirmative votes to adopt the agreement; the precedent named only supplemental disclosure and absence of quorum.', { code: 'INSUFFICIENT_VOTES' }),
    code("At Parent's request", 'Metsera generation 6, 6.11: the row also takes an adjournment made because Parent asked for it.', { code: 'PARENT_REQUEST' }),
  ];
  const proxy = findTable(votesSection, 'votes-proxy-sec');
  const provision = findColumn(proxy, 'provision');
  provision.header = 'As drafted';
  provision.display = 'fact_text';

  const covenants = findTable(findSection(doc, 'general-covenants'), 'general-covenants-table');
  const standard = findColumn(covenants, 'standard');
  standard.render = 'vocabulary';
  standard.vocabulary = [
    code('Reasonable best efforts', why, { code: 'REASONABLE_BEST_EFFORTS' }),
    code('Commercially reasonable efforts', why, { code: 'COMMERCIALLY_REASONABLE_EFFORTS' }),
    code('Best efforts', why, { code: 'BEST_EFFORTS' }),
    code('Unqualified obligation (shall)', why, { code: 'UNQUALIFIED_OBLIGATION' }),
    code('Promptly / as promptly as practicable', why, { code: 'PROMPTLY' }),
    code('Reasonable access during normal business hours', why, { code: 'REASONABLE_ACCESS' }),
  ];
  standard.guidance = 'The efforts or conduct standard the covenant states, coded; the words themselves are in the as-drafted column.';
  covenants.columns = [findColumn(covenants, 'obligor'), standard, asDrafted(why)];
  covenants.guidance = `${covenants.guidance} The covenant as drafted replaces the scope and exceptions fragments. By when: the covenant's deadline or trigger, from its TRIGGER and PERIOD components.`;
  covenants.detail_labels_by_row = { ...(covenants.detail_labels_by_row || {}), [PUBLICITY_ROW]: [...PUBLICITY_DETAILS] };
  covenants.detail_from_words_by_row = { ...(covenants.detail_from_words_by_row || {}), [PUBLICITY_ROW]: PUBLICITY_WORDS.map((rule) => ({ ...rule })) };
  // Work package 18 (f) (Ben, 2026-10-18, plan finding (163): "on A - if
  // the shareholders have to do something, okay for them to be an
  // obligor"): a covenant that binds a party that is neither the Company
  // nor Parent (the Specified Stockholders on NCS 5.17; a sponsor or
  // guarantor elsewhere) is coded OTHER_PARTY and the page shows the
  // party's own words in the cell (other_party_code).
  const obligor = findColumn(covenants, 'obligor');
  if (!obligor.vocabulary.some((entry) => entry.code === 'OTHER_PARTY')) {
    obligor.vocabulary.push(code('Other party (named in the words)', 'Ben, 2026-10-18 (plan finding (163)): "on A - if the shareholders have to do something, okay for them to be an obligor". The cell shows the party\'s own words (the Specified Stockholders; a sponsor; a guarantor).', { code: 'OTHER_PARTY' }));
  }
  obligor.other_party_code = 'OTHER_PARTY';
  obligor.guidance = `${obligor.guidance ? `${obligor.guidance} ` : ''}OTHER_PARTY when the words bind a party that is neither the Company nor Parent (stockholders, a sponsor, a guarantor); cite the party's own words, which the page shows in the cell.`;
  // Work package 18 (g) (Ben, 2026-10-18, plan finding (163): "Ok on ETA on
  // covenants"): a "By when" column filled from the covenant's TRIGGER and
  // PERIOD components ("Promptly following the Closing Date (and in any
  // event no later than two Business Days thereafter)"; a payoff letter
  // "at least three (3) Business Days prior to the Closing Date"), hidden
  // when no row fills it; the as-drafted column cites them too.
  const byWhenReason = 'Ben, 2026-10-18 (plan finding (163)): "Ok on ETA on covenants".';
  const drafted = asDrafted(why, ['OPERATION', 'OBJECT', 'CONDITION', 'STANDARD', 'EXCEPTION', 'QUALIFIER', 'TRIGGER', 'PERIOD']);
  covenants.columns = [obligor, standard, byWhenColumn(byWhenReason), drafted];
  covenants.words_rows = [...(covenants.words_rows || []), { row_label: REGISTRATION_ROW, when: REGISTRATION_WORDS, over_readout: true, table_key: REGISTRATION_TABLE_KEY }];
  const registration = {
    table_key: REGISTRATION_TABLE_KEY,
    group_header: 'REGISTRATION RIGHTS',
    term_column: { header: 'Covenant', source: 'subject', fill_from: ['TERM'] },
    columns: [JSON.parse(JSON.stringify(obligor)), JSON.parse(JSON.stringify(standard)), byWhenColumn(byWhenReason), asDrafted(why, drafted.fill_from)],
    rows_are: 'fixed list',
    fixed_row_labels: [REGISTRATION_ROW],
    accepts_families: ['GENERAL_COVENANTS'],
    no_sub_items: true,
    addition: true,
    reason: 'Ben, 2026-10-18 (plan finding (163)): "reg rights I think goes with consideration (but at bottom)"; on sub-items (plan finding (166)): "are these from a reg rights agreement? I wouldn\'t go into anywhere near this depth in this product". NCS generation 5, 5.17: the Specified Stockholders\' registration rights came back as covenants spread over five rows of the general covenants table.',
    guidance: `Every covenant of a registration-rights package for the stock consideration (the resale registration statement or shelf, keeping it effective and amending it, the holders' information and approval rights, the indemnities, the expenses, Rule 144 and legend removal, the listing and reporting covenants for the resale period) is on this table's one row, one fact per operative unit, with no row_detail: the row is present or absent, its facts behind it; the code moves a general covenant whose words name the Registration Statement, Registrable Securities, a prospectus, Rule 144 or Rule 415 here from the general covenants table (work package 18, 2026-10-18). A deal without registration rights shows no such table.`,
  };
  const consideration = findSection(doc, 'consideration-hero');
  consideration.tables = [...consideration.tables.filter((table) => table.table_key !== REGISTRATION_TABLE_KEY), registration];
  covenants.guidance = `${covenants.guidance} ${PUBLICITY_ROW}: every publicity fact is on this row, one fact per operative unit (the announcement release and its approval; the consent, consultation and review duties; the consistency proviso; each carve-out; the Law, court-process or listing-agreement exception), each a sub-item with row_detail from the row's detail_labels_by_row; the code names the sub-item from the fact's own words when a label's words are present (work package 18, 2026-10-18).`;

  removeSection(doc, 'advisers-fees-expenses');
}

// ==========================================================================
// Work package 5 (plan finding (52), Metsera generation 8, 2026-10-18):
// three families had no table in the shapes (TAX_MATTERS,
// FINANCING_COVENANTS, GUARANTY_FINANCING_PARTY), so 2.02's transfer-tax
// allocation fact was on no page at all. A Tax Matters section and a
// Financing section, each table's rows from the fact's subtype, with page
// defaults for the stored facts (fact_type_rows for the families' required
// fact types; default_rows_from_subtype for every other subtype).
// ==========================================================================

function subtypeSection(doc, { sectionKey, title, familyKeys, tables }) {
  doc.sections.push({
    section_key: sectionKey,
    title,
    legacy_config: null,
    v2_family_keys: familyKeys.map((key) => ({ key, confidence: 'high' })),
    tables,
    print_pages: [],
  });
}

function applyTaxMatters(doc) {
  const why = `${BEN}: every covenant reads as a code from its row's list and the clause as drafted; work package 5, 2026-10-18.`;
  const table = provisionTable({
    tableKey: 'tax-matters-table',
    rows: [
      ['Intended tax treatment', [
        code('Taxable acquisition', why, { code: 'TAXABLE_ACQUISITION' }),
        code('Tax-free reorganization (Section 368(a))', why, { code: 'REORGANIZATION_368A' }),
        code('Other intended treatment', why, { code: 'OTHER_INTENDED_TREATMENT' }),
      ]],
      ['Tax treatment protection', [code('No action inconsistent with the intended treatment', why, { code: 'NO_INCONSISTENT_ACTION' }), code('Not addressed', why, { code: 'SILENT' })]],
      ['Tax reporting consistency', [code('Report consistently with the intended treatment', why, { code: 'CONSISTENT_REPORTING_REQUIRED' }), code('Not addressed', why, { code: 'SILENT' })]],
      ['Tax opinion cooperation', [code('Cooperation and representation letters required', why, { code: 'COOPERATION_REQUIRED' }), code('Not addressed', why, { code: 'SILENT' })]],
      ['Transfer tax allocation', [
        code('Paid by Parent', why, { code: 'PAID_BY_PARENT' }),
        code('Paid by the Company', why, { code: 'PAID_BY_COMPANY' }),
        code('Paid by the Surviving Corporation', why, { code: 'PAID_BY_SURVIVING_CORPORATION' }),
        code('Shared equally', why, { code: 'SHARED_EQUALLY' }),
        code('Paid by the holder', why, { code: 'PAID_BY_HOLDER' }),
      ]],
      ['Withholding', [code('Withholding permitted', why, { code: 'WITHHOLDING_PERMITTED' }), code('Withheld amounts treated as paid', why, { code: 'WITHHELD_AMOUNTS_TREATED_AS_PAID' })]],
      ['FIRPTA certificate', [code('Required', why, { code: 'REQUIRED' }), code('Not required', why, { code: 'NOT_REQUIRED' })]],
      ['Special tax mechanic', yesNo(why)],
    ],
    reason: why,
    subtypeRows: {
      INTENDED_TAX_TREATMENT: 'Intended tax treatment', TAX_TREATMENT_PROTECTION: 'Tax treatment protection', TAX_REPORTING_CONSISTENCY: 'Tax reporting consistency',
      TAX_OPINION_COOPERATION: 'Tax opinion cooperation', TRANSFER_TAX_ALLOCATION: 'Transfer tax allocation', WITHHOLDING_MECHANIC: 'Withholding',
      FIRPTA_CERTIFICATE: 'FIRPTA certificate', TAX_INTEGRATION_OR_SPECIAL_MECHANIC: 'Special tax mechanic',
    },
    guidance: 'The tax covenants, the row from the fact\'s subtype (subtype_rows): the intended tax treatment and the covenants protecting and reporting it, cooperation on tax opinions, who bears transfer taxes (one code), withholding, the FIRPTA certificate and any special mechanic; the code from that row\'s list, the clause as drafted.',
  });
  table.fact_type_rows = {
    INTENDED_TAX_TREATMENT_KIND: 'Intended tax treatment', TAX_OPINION_COOPERATION_COVENANT: 'Tax opinion cooperation',
    TAX_TREATMENT_PROTECTION_COVENANT: 'Tax treatment protection', TRANSFER_TAX_ALLOCATION: 'Transfer tax allocation',
  };
  table.default_rows_from_subtype = true;
  subtypeSection(doc, { sectionKey: 'tax-matters', title: 'Tax Matters', familyKeys: ['TAX_MATTERS'], tables: [table] });
}

function applyFinancing(doc) {
  const why = `${BEN}: every covenant reads as a code from its row's list and the clause as drafted; work package 5, 2026-10-18.`;
  const efforts = [
    code('Reasonable best efforts', why, { code: 'REASONABLE_BEST_EFFORTS' }),
    code('Best efforts', why, { code: 'BEST_EFFORTS' }),
    code('Commercially reasonable efforts', why, { code: 'COMMERCIALLY_REASONABLE_EFFORTS' }),
  ];
  const required = [code('Required', why, { code: 'REQUIRED' }), code('Not required', why, { code: 'NOT_REQUIRED' })];
  // One table for the two families (the manager's work package 5 terms):
  // the financing covenants, then the guaranty and the financing sources'
  // protections, each row named from the fact's subtype. The period column
  // is the one number a subtype carries (the payoff letter lead time).
  const table = provisionTable({
    tableKey: 'financing-table',
    groupHeader: 'FINANCING',
    rows: [
      ['Obtain financing', [...efforts, code('No financing covenant', why, { code: 'NO_FINANCING_COVENANT' })]],
      ['Alternative financing', required],
      ['Target cooperation', [...efforts, code('Not required', why, { code: 'NOT_REQUIRED' })]],
      ['Payoff letters', required],
      ['No financing condition', yesNo(why)],
      ['Note offer or consent', required],
      ['Cost and risk allocation', [
        code('Parent bears financing costs', why, { code: 'PARENT_BEARS_COSTS' }),
        code('Company indemnified for cooperation', why, { code: 'COMPANY_INDEMNIFIED' }),
        code('Shared', why, { code: 'SHARED' }),
      ]],
      ['Performance guaranty', yesNo(why)],
      ['Limited guaranty delivered', yesNo(why)],
      ['Guaranty not in default', yesNo(why)],
      ['Financing source protection', [
        code('No recourse against financing sources', why, { code: 'NO_RECOURSE_AGAINST_FINANCING_SOURCES' }),
        code('Financing sources forum and jury waiver', why, { code: 'FINANCING_SOURCE_FORUM_AND_JURY_WAIVER' }),
        code('Financing sources as third-party beneficiaries', why, { code: 'FINANCING_SOURCES_THIRD_PARTY_BENEFICIARIES' }),
      ]],
    ],
    numberColumns: [periodColumn('Period', `${why} The payoff letter lead time in business days, or a financing deadline.`)],
    reason: why,
    subtypeRows: {
      OBTAIN_FINANCING: 'Obtain financing', ALTERNATIVE_FINANCING: 'Alternative financing', TARGET_COOPERATION: 'Target cooperation', PAYOFF: 'Payoff letters',
      NO_FINANCING_CONDITION: 'No financing condition', NOTE_OFFER_OR_CONSENT: 'Note offer or consent', COST_AND_RISK_ALLOCATION: 'Cost and risk allocation',
      PERFORMANCE_GUARANTY: 'Performance guaranty', LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP: 'Limited guaranty delivered',
      GUARANTY_NO_DEFAULT_REP: 'Guaranty not in default', FINANCING_SOURCE_PROTECTION: 'Financing source protection',
    },
    guidance: 'The financing covenants and the guaranty, the row from the fact\'s subtype (subtype_rows): the efforts to obtain the financing and any alternative financing, the Company\'s cooperation, payoff letters (the lead time in the period column), the acknowledgment that financing is not a condition, note offers or consents, who bears the costs and risks; then a parent performance guaranty, the limited guaranty\'s delivery and status, the no-default representation, and the provisions protecting the financing sources (no recourse, their forum and jury waiver, their third-party beneficiary rights), one cell per protection; the code from that row\'s list, the clause as drafted. A deal without financing has no facts here and no section.',
  });
  // Work package 18 (g) (Ben: "Ok on ETA on covenants"): a By when column
  // from TRIGGER and PERIOD, beside the Period number (a component the
  // Period column reads is not repeated here); the as-drafted column cites
  // TRIGGER and PERIOD too.
  const financingDrafted = table.columns.find((column) => column.column_id === 'asDrafted');
  financingDrafted.fill_from = [...financingDrafted.fill_from, 'TRIGGER', 'PERIOD'];
  table.columns.splice(table.columns.indexOf(financingDrafted), 0, byWhenColumn('Ben, 2026-10-18 (plan finding (163)): "Ok on ETA on covenants".'));
  table.fact_type_rows = {
    FINANCING_OBTAIN_EFFORTS_STANDARD: 'Obtain financing', NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'No financing condition', PAYOFF_DELIVERY_LEAD_TIME_DAYS: 'Payoff letters',
    LIMITED_GUARANTY_DELIVERED: 'Limited guaranty delivered',
  };
  table.default_rows_from_subtype = true;
  subtypeSection(doc, { sectionKey: 'financing', title: 'Financing', familyKeys: ['FINANCING_COVENANTS', 'GUARANTY_FINANCING_PARTY'], tables: [table] });
}

// ==========================================================================
// Work package 6 (manager, 2026-10-18, on generation 8's 3.13(b) and (c)):
// the material contracts representation's own limbs (the Disclosure Letter
// list, validity and enforceability, no default) were UNPLACED: not on the
// material contracts list table, not on the representations table. They
// are the representation's limbs, so they are sub-items of the
// representations table's "Material Contracts" row, the way the Knowledge
// definition (KEY_DEFINED_TERMS) sits on its Knowledge row: the family
// joins the section, the limbs are its detail labels, the subtypes are
// admitted, and limb_rows_from_subtype tells the page where a stored fact
// without a readout goes (lib/product/table-view.js). The list table says
// these subtypes are never its rows.
// ==========================================================================
const MATERIAL_CONTRACTS_ROW = 'Material Contracts';
const MATERIAL_CONTRACT_LIMBS = Object.freeze({
  MATERIAL_CONTRACT_DISCLOSURE_LIST: 'Disclosure list',
  MATERIAL_CONTRACT_STATUS_REPRESENTATION: 'Validity and enforceability',
  MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT: 'No default',
});

function applyMaterialContractLimbs(doc) {
  const section = findSection(doc, 'representations-qualifiers');
  if (!section.v2_family_keys.some((entry) => entry.key === 'MATERIAL_CONTRACTS')) {
    section.v2_family_keys.push({ key: 'MATERIAL_CONTRACTS', confidence: 'low' });
  }
  const table = section.tables[0];
  if (!table.fixed_row_labels.includes(MATERIAL_CONTRACTS_ROW)) throw new Error(`MATERIAL_CONTRACTS_ROW_MISSING: ${table.table_key}`);
  table.detail_labels_by_row = { ...(table.detail_labels_by_row || {}), [MATERIAL_CONTRACTS_ROW]: Object.values(MATERIAL_CONTRACT_LIMBS) };
  for (const subtype of Object.keys(MATERIAL_CONTRACT_LIMBS)) if (!table.only_subtype_keys.includes(subtype)) table.only_subtype_keys.push(subtype);
  table.limb_rows_from_subtype = {
    MATERIAL_CONTRACTS: Object.fromEntries(Object.entries(MATERIAL_CONTRACT_LIMBS).map(([subtype, detail]) => [subtype, { row_label: MATERIAL_CONTRACTS_ROW, row_detail: detail }])),
  };
  table.guidance = `${table.guidance} The material contracts representation's own limbs are MATERIAL_CONTRACTS facts on the "${MATERIAL_CONTRACTS_ROW}" row, never on the material contracts list table: row_detail "${MATERIAL_CONTRACT_LIMBS.MATERIAL_CONTRACT_DISCLOSURE_LIST}" for the Disclosure Letter list of the Company's material contracts (MATERIAL_CONTRACT_DISCLOSURE_LIST), "${MATERIAL_CONTRACT_LIMBS.MATERIAL_CONTRACT_STATUS_REPRESENTATION}" for the statement that they are valid, binding, enforceable and in full force (MATERIAL_CONTRACT_STATUS_REPRESENTATION), "${MATERIAL_CONTRACT_LIMBS.MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT}" for the no-default and no-event-of-default statements (MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT, one fact per sentence); the Qualifiers cell is the MAE or materiality qualifier the limb carries (MAE_AGGREGATE for "except as would not have a Material Adverse Effect"), as on any representation row; a category of the Material Contract definition is never on this row.`;
  const list = findTable(findSection(doc, 'material-contracts'), 'material-contracts-table');
  list.guidance = `${list.guidance} The representation's own limbs (MATERIAL_CONTRACT_DISCLOSURE_LIST, MATERIAL_CONTRACT_STATUS_REPRESENTATION, MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT) are never rows here: their readouts go to the representations table's "${MATERIAL_CONTRACTS_ROW}" row as its sub-items (Disclosure list; Validity and enforceability; No default).`;
}

// ==========================================================================
// Work package C4 (2026-10-18, plan finding (128)): the rows a two-step
// tender offer and a stock merger of equals need and the shapes did not
// have, read from GSK / Nuvalent (Agreement and Plan of Merger, 2026-06-09)
// and Indivior / Supernus (Agreement and Plan of Merger, 2026-08-01). Rows
// and codes only, each for a subtype the schema already has; the provisions
// that need a new subtype or fact type (the Offer's own mechanics, the
// combined-company governance, Parent's reciprocal no-shop, the ratio's
// form) are proposed to Ben in
// docs/codex-program/notes/TENDER-OFFER-AND-STOCK-DEAL-SCHEMA-GAPS-2026-10-18.md
// and not built here.
// ==========================================================================

const C4 = 'Work package C4, 2026-10-18 (plan finding (128)): tender-offer and stock-deal rows read from GSK / Nuvalent and Indivior / Supernus';

const C4_ROWS = Object.freeze({
  // Nuvalent Annex I 1(a): "that number of Class A Shares that ... represents at least a majority of the Class A Shares outstanding as of the consummation of the Offer (such condition ... the “Minimum Tender Condition”)".
  MINIMUM_TENDER_CONDITION: 'Minimum tender condition',
  // Nuvalent 7.1: the Merger's own condition that Purchaser "shall have accepted for payment all Shares validly tendered" (the Acceptance Time).
  OFFER_CONSUMMATED: 'Offer consummated (Acceptance Time)',
  // Supernus 7.1(a): "the Indivior Stockholder Approval shall have been attained", beside 7.1(b) the Supernus approval.
  PARENT_STOCKHOLDER_APPROVAL: 'Parent stockholder approval',
  // Supernus 8.1(d)(iv): termination by either party when "the Indivior Stockholder Approval ... shall not have been obtained".
  PARENT_VOTE_NOT_OBTAINED: 'Parent stockholder vote not obtained',
  // Nuvalent 8.4(c): Parent may terminate if "due to the failure of an Offer Condition to be satisfied, the Offer has expired or has been terminated without Purchaser having accepted for purchase the Shares".
  OFFER_EXPIRED_ON_FAILED_CONDITION: 'Offer expired on a failed Offer Condition',
  // Nuvalent 8.3(a)(i) to (iii): the Company may terminate if "Purchaser fails to timely commence the Offer", "the Offer has expired or has been terminated without Purchaser having accepted for purchase the Shares" or Purchaser "fails to accept for purchase Shares validly tendered".
  OFFER_NOT_COMMENCED_OR_CONSUMMATED: 'Offer not commenced or not consummated',
  // Supernus 8.1(c)(ii): Supernus may terminate if "the Indivior Board or any committee thereof (A) shall make an Indivior Adverse Recommendation Change".
  PARENT_RECOMMENDATION_CHANGE: 'Parent change of recommendation',
  // Nuvalent 2.6: "The Merger will be governed by Section 251(h) of the DGCL ... without a vote of the holders of any Shares".
  MERGER_WITHOUT_A_VOTE: 'Merger without a vote (Section 251(h))',
  // Supernus 6.3(b): Indivior shall "convene and hold a meeting of the Indivior Stockholders ... for the purpose of obtaining the Indivior Stockholder Approval".
  PARENT_STOCKHOLDERS_MEETING: "Parent stockholders' meeting",
  // Nuvalent 1.1(c): "Parent and Purchaser will file or cause to be filed with the SEC a Tender Offer Statement on Schedule TO ... (collectively ... the “Offer Documents”)".
  SCHEDULE_TO: 'Schedule TO (Offer Documents)',
  // Nuvalent 1.2: "the Company will file with the SEC a Solicitation/Recommendation Statement on Schedule 14D-9 ... containing ... the Company Board Recommendation".
  SCHEDULE_14D9: 'Schedule 14D-9',
  // Supernus 6.2(b): Indivior shall "prepare and file with the SEC ... a registration statement on Form S-4, in which the Joint Proxy Statement shall be included".
  REGISTRATION_STATEMENT: 'Registration Statement (Form S-4)',
  // Supernus 2.8(b): "no fractional Indivior Shares shall be issued ... shall, in lieu of such fraction of a share ... be paid in cash the dollar amount ... determined by multiplying such fraction by the Average Indivior Stock Price".
  FRACTIONAL_SHARES: 'Cash in lieu of fractional shares',
});

// Supernus 4.27(b): "The affirmative vote of a majority in voting power of the outstanding Indivior Shares present in person or represented by proxy at the Indivior Stockholders' Meeting and entitled to vote on the proposal to approve the Indivior Share Issuance" (the Nasdaq share-issuance standard).
const C4_VOTES_CAST_CODE = 'MAJORITY_OF_VOTES_CAST';
// Nuvalent 8.2, 8.3, 8.4: every right is exercisable "at any time prior to the Acceptance Time"; 8.4(b) "no later than two (2) Business Days after the Expiration Date following the Change of Board Recommendation".
const C4_WINDOW_CODE = 'BEFORE_ACCEPTANCE_TIME';

function addRow(table, label) {
  if (!table.fixed_row_labels.includes(label)) table.fixed_row_labels.push(label);
}

function addCode(column, label, codeValue, why) {
  if (!column.vocabulary.some((entry) => entry.code === codeValue)) column.vocabulary.push(code(label, why, { code: codeValue }));
}

function applyTenderOfferAndStockDealRows(doc) {
  const conditions = findTable(findSection(doc, 'conditions'), 'conditions-table');
  addRow(conditions, C4_ROWS.MINIMUM_TENDER_CONDITION);
  addRow(conditions, C4_ROWS.OFFER_CONSUMMATED);
  addRow(conditions, C4_ROWS.PARENT_STOCKHOLDER_APPROVAL);
  conditions.guidance = `${conditions.guidance} ${C4}: in a tender offer the Offer's conditions (an Annex I) are closing conditions with the Offer as their subject: the Minimum Tender Condition is its own row (the share count or percentage that must be tendered in the words), the Merger's condition that the Offer was consummated is "${C4_ROWS.OFFER_CONSUMMATED}", the Offer's bring-down, officer certificate and no-MAE conditions take the Parent-side table's rows as a one-step deal's do, and "Stockholder Approval" reads as not required when the merger is under Section 251(h). In a stock deal Parent's own stockholder approval (of the share issuance) is "${C4_ROWS.PARENT_STOCKHOLDER_APPROVAL}" with its vote standard, beside the Company's.`;

  const section = findSection(doc, 'termination-rights');
  const mutual = findTable(section, 'termination-rights-mutual');
  addRow(mutual, C4_ROWS.PARENT_VOTE_NOT_OBTAINED);
  mutual.guidance = `${mutual.guidance} ${C4}: a stock deal's second vote has its own row, "${C4_ROWS.PARENT_VOTE_NOT_OBTAINED}"; in a tender offer the outside date and every right run to the Acceptance Time, not the Effective Time.`;
  const buyer = findTable(section, 'termination-rights-buyer-may-terminate');
  // Before the written-consent deal's two rows, which work package 19 (d)
  // pins as the list's last two.
  if (!buyer.fixed_row_labels.includes(C4_ROWS.OFFER_EXPIRED_ON_FAILED_CONDITION)) {
    buyer.fixed_row_labels.splice(buyer.fixed_row_labels.indexOf('Written consent not delivered'), 0, C4_ROWS.OFFER_EXPIRED_ON_FAILED_CONDITION);
  }
  buyer.guidance = `${buyer.guidance} ${C4}: Parent's right to terminate when the Offer expired or was terminated because an Offer Condition failed is "${C4_ROWS.OFFER_EXPIRED_ON_FAILED_CONDITION}"; a window that runs to the Acceptance Time is coded ${C4_WINDOW_CODE}.`;
  addCode(findColumn(buyer, 'window'), 'Before the Acceptance Time', C4_WINDOW_CODE, `${C4}. Nuvalent 8.4: "at any time prior to the Acceptance Time"; 8.4(b): no later than two Business Days after the Expiration Date following the Change of Board Recommendation.`);
  const company = findTable(section, 'termination-rights-company-may-terminate');
  addRow(company, C4_ROWS.OFFER_NOT_COMMENCED_OR_CONSUMMATED);
  addRow(company, C4_ROWS.PARENT_RECOMMENDATION_CHANGE);
  company.guidance = `${company.guidance} ${C4}: the Company's right when Purchaser fails to commence the Offer, lets it expire or fails to accept tendered Shares is "${C4_ROWS.OFFER_NOT_COMMENCED_OR_CONSUMMATED}"; in a stock deal the Company's right on Parent's adverse recommendation change is "${C4_ROWS.PARENT_RECOMMENDATION_CHANGE}", and its right to terminate for its own Superior Proposal stays on "Superior Proposal".`;
  addCode(findColumn(company, 'window'), 'Before the Acceptance Time', C4_WINDOW_CODE, `${C4}. Nuvalent 8.3: "at any time prior to the Acceptance Time".`);
  for (const column of [findColumn(mutual, 'voteThreshold'), findColumn(conditions, 'voteStandard')]) {
    addCode(column, 'Majority of votes cast', C4_VOTES_CAST_CODE, `${C4}. Supernus 4.27(b): a majority in voting power of the outstanding shares present in person or represented by proxy and entitled to vote, the Nasdaq share-issuance standard.`);
  }

  const votesSection = findSection(doc, 'votes-approvals-meeting');
  const votes = findTable(votesSection, 'votes-approvals-meeting-table');
  addRow(votes, C4_ROWS.MERGER_WITHOUT_A_VOTE);
  addRow(votes, C4_ROWS.PARENT_STOCKHOLDERS_MEETING);
  addCode(findColumn(votes, 'voteStandard'), 'Majority of votes cast', C4_VOTES_CAST_CODE, `${C4}. Supernus 4.27(b).`);
  votes.guidance = `${votes.guidance || ''} ${C4}: a merger under Section 251(h) without a stockholder vote is the "${C4_ROWS.MERGER_WITHOUT_A_VOTE}" row (the Company stockholder approval row then reads as not required); a stock deal's Parent meeting is "${C4_ROWS.PARENT_STOCKHOLDERS_MEETING}" with its own deadline and anchor.`.trim();
  const proxy = findTable(votesSection, 'votes-proxy-sec');
  addRow(proxy, C4_ROWS.SCHEDULE_TO);
  addRow(proxy, C4_ROWS.SCHEDULE_14D9);
  addRow(proxy, C4_ROWS.REGISTRATION_STATEMENT);
  proxy.guidance = `${proxy.guidance || ''} ${C4}: in a tender offer Parent's Schedule TO and the Offer Documents are "${C4_ROWS.SCHEDULE_TO}" (who: Parent) and the Company's Schedule 14D-9 with the Company Board Recommendation is "${C4_ROWS.SCHEDULE_14D9}" (who: Company); in a stock deal Parent's Form S-4 with the proxy statement included is "${C4_ROWS.REGISTRATION_STATEMENT}" (who: Parent), its effectiveness efforts and mailing after effectiveness on the same row.`.trim();

  const components = findTable(findSection(doc, 'consideration-hero'), 'consideration-components');
  addRow(components, C4_ROWS.FRACTIONAL_SHARES);
  components.guidance = `${components.guidance || ''} ${C4}: in a stock deal the cash paid in lieu of fractional Parent shares is its own row, "${C4_ROWS.FRACTIONAL_SHARES}" (form CASH, the price it is measured at in the words); the exchange ratio itself is the Parent stock row's amount.`.trim();
}

function applyDecision34(doc) {
  applyAntitrust(doc);
  applyEquityAwards(doc);
  applyNoShop(doc);
  applyInterimCovenants(doc);
  applyConditions(doc);
  applyTerminationRights(doc);
  applyTerminationFees(doc);
  applyEmployeeBenefits(doc);
  applyMisc(doc);
  applyDnoIndemnification(doc);
  applyTaxMatters(doc);
  applyFinancing(doc);
  applyConsideration(doc);
  applyRepresentations(doc);
  applyMaterialContractLimbs(doc);
  applyCapitalization(doc);
  applyVotesAndCovenants(doc);
  applyTenderOfferAndStockDealRows(doc);
  return doc;
}

module.exports = { applyDecision34, C4_ROWS, C4_VOTES_CAST_CODE, C4_WINDOW_CODE, IOC_CATEGORIES, EXTRA_REP_ROWS, CAPITALISATION_LIMBS, CAPITALISATION_SUBTYPES, CAPITALIZATION_ROWS, GENERAL_EXCEPTIONS_ROW, KNOWLEDGE_ROW, GENERAL_EXCEPTION_DETAILS, KNOWLEDGE_DETAILS };
