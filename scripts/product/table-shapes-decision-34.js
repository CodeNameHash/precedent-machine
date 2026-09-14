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
        header: 'Provision',
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
      ['Representative control standard', [
        code('Shall cause its Representatives not to', why, { code: 'SHALL_CAUSE_REPRESENTATIVES' }),
        code('Shall direct and use reasonable best efforts to cause', why, { code: 'SHALL_DIRECT_AND_USE_REASONABLE_BEST_EFFORTS' }),
        code('Shall not authorize or permit its Representatives to', why, { code: 'SHALL_NOT_AUTHORIZE_OR_PERMIT' }),
        code('Shall instruct its Representatives', why, { code: 'SHALL_INSTRUCT' }),
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
  const notice = provisionTable({
    tableKey: 'nosol-noshop-notice',
    groupHeader: 'NOTICE',
    rows: [
      ['Notice of a proposal', [code('Required', why, { code: 'REQUIRED' }), code('Not required', why, { code: 'NOT_REQUIRED' })]],
      ['Notice period', []],
      ['Notice content', [
        code('Identity of the bidder', why, { code: 'IDENTITY_OF_BIDDER' }),
        code('Material terms and conditions', why, { code: 'MATERIAL_TERMS' }),
        code('Copies of the proposal and draft agreements', why, { code: 'COPIES_OF_PROPOSAL' }),
        code('Status updates and amendments', why, { code: 'STATUS_UPDATES' }),
      ]],
      ['Ongoing updates', [
        code('Required promptly', why, { code: 'REQUIRED_PROMPTLY' }),
        code('Required within a stated period', why, { code: 'REQUIRED_WITHIN_STATED_PERIOD' }),
        code('Not required', why, { code: 'NOT_REQUIRED' }),
      ]],
    ],
    numberColumns: [periodColumn('Period', `${why} The notice period (24 hours; 48 hours; two business days).`)],
    reason: why,
    subtypeKeys: ['NOTICE_PERIOD', 'NOTICE_UPDATE_OBLIGATION'],
    guidance: 'Notice to Parent of a proposal: whether it is required, within what period (NOTICE_PERIOD; the period column carries the hours or days), what it must contain (one cell per item), and whether the Company must keep Parent informed (NOTICE_UPDATE_OBLIGATION). The notice and match periods of the superior-proposal path belong to the matching-rights table; those of the intervening-event path to the intervening-event table.',
  });
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
    ],
    reason: why,
    subtypeKeys: ['EXCEPTION_PREREQUISITE'],
    guidance: 'The conditions on which the Company may engage with a bidder (EXCEPTION_PREREQUISITE facts): the standard the proposal must meet (Engagement standard), the board\'s determination standard, and whether the proposal must be unsolicited, must not result from a breach, must be under an acceptable confidentiality agreement, and whether Parent must receive the same information (Information parity). Each is its own fact and row.',
  });
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
      ['Not a Change of Recommendation', [
        code('Delivery of a notice to Parent', why, { code: 'DELIVERY_OF_NOTICE_TO_PARENT' }),
        code('Determination that a proposal is or could lead to a Superior Proposal', why, { code: 'DETERMINATION_THAT_PROPOSAL_IS_SUPERIOR' }),
        code('Factually accurate public statement', why, { code: 'FACTUALLY_ACCURATE_PUBLIC_STATEMENT' }),
        code('Stop, look and listen communication', why, { code: 'STOP_LOOK_AND_LISTEN_COMMUNICATION' }),
      ]],
      ['Force the vote', yesNo(why)],
    ],
    numberColumns: [periodColumn('Period', `${why} The reaffirmation period ("within ten business days of a request").`)],
    reason: why,
    subtypeKeys: ['RECOMMENDATION_CHANGE'],
    guidance: 'Change of recommendation (RECOMMENDATION_CHANGE facts): whether and when the board may change its recommendation (Board change right); the acts the agreement defines as an Adverse Recommendation Change, one cell per act, from the definition wherever it sits; what the agreement says is not such a change; and whether the stockholder meeting must be held even after a change (Force the vote). The period column carries a reaffirmation period.',
  });
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
      ['Board-change standard', BOARD_STANDARDS(why)],
      ['Notice period', []],
      ['Matching period', []],
      ['Parent termination right on a change', []],
    ],
    numberColumns: [periodColumn('Period', `${why} The notice or match period of the intervening-event path.`)],
    reason: why,
    guidance: 'The intervening-event path. Intervening Event provision: YES when the board may change its recommendation for an Intervening Event (a RECOMMENDATION_CHANGE or EXCEPTION_PREREQUISITE fact on that path). Definition: the KEY_DEFINED_TERMS/INTERVENING_EVENT fact, as drafted, no code. Excluded events: one cell per event the definition excludes. Board-change standard: the determination standard on this path. Notice period and Matching period: the NOTICE_PERIOD and INITIAL_MATCH_PERIOD facts that govern a change for an Intervening Event (the superior-proposal path\'s periods go to the matching-rights table), the number in the period column. Parent termination right on a change is derived by the page from the TERMINATION/RECOMMENDATION_CHANGE fact; never fill it.',
  });
  findColumn(interveningTable, 'provision').derived = { from_family: 'TERMINATION', from_subtype: 'RECOMMENDATION_CHANGE', join: 'presence', rows: ['Parent termination right on a change'] };
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
      {
        column_id: 'consent',
        header: 'Consent',
        render: 'vocabulary',
        vocabulary: [
          code('Consent not to be unreasonably withheld, conditioned or delayed', why, { code: 'CONSENT_NOT_UNREASONABLY_WITHHELD' }),
          code('Consent in Parent\'s sole discretion', why, { code: 'CONSENT_SOLE_DISCRETION' }),
          code('No consent exception', why, { code: 'NO_CONSENT_EXCEPTION' }),
        ],
        fill_from: ['CONDITION', 'STANDARD', 'QUALIFIER'],
        addition: true,
        reason: `${why} A consent standard stated on the restriction itself (the chapeau's standard goes to the general-terms table).`,
      },
    ];
    negative.guidance = 'One row per restriction category the covenant names (row_label from fixed_row_labels, a new category only when none fits, never the clause\'s own words): each lettered restriction is a RESTRICTIVE_COVENANT fact on its category\'s row, as drafted; a dollar basket is the threshold; each carve-out from the restriction is one exceptions code (several cells when the clause has several); a consent standard stated on that restriction is the consent code. Two restrictions of one category (5.01(d) acquisitions and 5.01(g) dispositions) are two facts on the same row, each a sub-item (row_detail: Acquisitions; Dispositions).';

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
      ],
      numberColumns: [periodColumn('Period', `${why} The deemed-consent period.`)],
      reason: why,
      subtypeKeys: ['CONSENT_STANDARD', 'EXCEPTION'],
      guidance: 'The chapeau\'s general terms: the consent standard (CONSENT_STANDARD), the exceptions that apply to every restriction (an EXCEPTION fact from the chapeau, one cell per exception), and the ordinary-course standard of the affirmative covenant.',
    });
    section.tables = [affirmative, negative, general];
  }
}

// ==========================================================================
// Closing conditions: the frustration rule is a row of the mutual table; the
// buyer's and seller's tables show each condition as drafted.
// ==========================================================================

function applyConditions(doc) {
  const why = `${BEN}: every condition shows as drafted beside its coded tier.`;
  const mutual = findTable(findSection(doc, 'conditions'), 'conditions-table');
  if (!mutual.fixed_row_labels.includes('Frustration of conditions')) mutual.fixed_row_labels.push('Frustration of conditions');
  mutual.guidance = 'One row per mutual condition as the precedent names it (Stockholder Approval with its vote standard; No Legal Restraint; Antitrust / Regulatory Clearance, each regime a sub-item; S-4 / Proxy Effective; Stock Exchange Listing) and the frustration rule (a FRUSTRATION fact: no party may rely on a failed condition its own breach caused) as a row, each as drafted.';
  for (const [sectionKey, tableKey] of [['conditions-b', 'conditions-b-table'], ['conditions-s', 'conditions-s-table']]) {
    const table = findTable(findSection(doc, sectionKey), tableKey);
    if (!table.columns.some((column) => column.column_id === 'asDrafted')) table.columns.push(asDrafted(why));
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
  buyer.fixed_row_labels = ['Company (Target) breach', 'Change of Recommendation', 'Breach of the no-shop'];
  buyer.row_from_subtype = true;
  buyer.subtype_rows = { BREACH: 'Company (Target) breach', RECOMMENDATION_CHANGE: 'Change of Recommendation', NO_SOLICITATION_BREACH: 'Breach of the no-shop' };
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
    ],
    reason: why,
    subtypeRows: { AGREEMENT_VOIDING: 'Agreement void on termination', LIABILITY_RELEASE: 'Release of liability', WILLFUL_MATERIAL_BREACH_CARVEOUT: 'Willful and material breach carve-out', PROVISION_SURVIVAL: 'Surviving provisions', TERMINATION_NOTICE: 'Termination formalities' },
    guidance: 'The effect of termination, the row from the subtype: the agreement becoming void; the release of liability and its carve-outs; the willful and material breach carve-out; the surviving provisions; and the formalities of terminating (notice, board action, no stockholder approval), one cell per formality.',
  });
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
    ],
    reason: why,
    subtypeKeys: ['GOVERNING_LAW', 'FORUM', 'ASSIGNMENT', 'AMENDMENT_WAIVER', 'NOTICE', 'ENTIRE_AGREEMENT', 'THIRD_PARTY_BENEFICIARY', 'SEVERABILITY', 'COUNTERPARTS', 'SURVIVAL', 'CONSTRUCTION', 'EXPENSES'],
    guidance: 'One row per boilerplate term as the precedent names it; the row is the term the fact addresses (a FORUM fact on the jury waiver is Jury trial waiver; a SPECIFIC_PERFORMANCE_REMEDIES fact on equitable relief, irreparable harm, the bond waiver or closing enforcement is Specific performance, each a sub-item; a REMEDY_COORDINATION or REMEDY_ACTION_EXTENSION fact is Specific performance limitations; an EXPENSES or COST_SHIFT fact is Fee / expense allocation). The Provision cell is the code from that row\'s list (several cells when the clause states several: the amendment formalities, the notice methods); the clause as drafted beside it. A row the agreement does not address is omitted.',
  });
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
  components.combined_definition_from = { family_key: 'CONSIDERATION', subtype_key: 'CONSIDERATION_PACKAGE', label: 'Combined definition' };
  const election = findTable(section, 'consideration-hero-election-mechanics');
  for (const column of election.columns) if (column.render === 'verbatim') { column.display = 'fact_text'; column.header = 'As drafted'; }
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
const CAPITALIZATION_ROWS = ['Common Stock', 'Preferred Stock', 'Company Stock Options', 'Company RSUs', 'Company PSUs', 'Company Restricted Stock Awards', 'ESPP', 'Warrants', 'Subsidiary equity'];

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
    footer_from_subtype: { subtype_key: 'CAPITALISATION_ABSENCE', label: 'No other securities' },
    guidance: `One row per security class as the precedent names it (fixed_row_labels; a new class label only when none fits, in the same style). The extractor cuts one fact per class and count: an AUTHORISED_CAPITAL fact goes to the class's row with its authorised count, an ISSUED_AND_OUTSTANDING fact with its issued count, a RESERVED_OR_ISSUABLE_SECURITIES fact with its reserved count (the ESPP reserve on the ESPP row), an EQUITY_AWARD_INVENTORY fact to the award class's row (Company Stock Options, Company RSUs, Company PSUs, Company Restricted Stock Awards) with the shares subject to outstanding awards in the issued column; a sentence that counts two classes is two facts. Every count is parsed by code from the cited words (never written by the model); asOf is the date the count speaks to. A VALID_ISSUANCE_STATUS fact marks its class Validly issued. A CAPITALISATION_ABSENCE fact (no other securities, options, voting agreements or voting debt; no rights plan) is never a row: it carries row_label "No other securities" and no cells, and the page shows it as drafted under the table. A PARTNERSHIP_OR_SUBSIDIARY_EQUITY fact is the Subsidiary equity row, or the Subsidiary equity interests limb of Capitalization; Subsidiaries on the representations table.`,
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
  covenants.guidance = `${covenants.guidance} The covenant as drafted replaces the scope and exceptions fragments.`;

  removeSection(doc, 'advisers-fees-expenses');
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
  applyConsideration(doc);
  applyRepresentations(doc);
  applyCapitalization(doc);
  applyVotesAndCovenants(doc);
  return doc;
}

module.exports = { applyDecision34, IOC_CATEGORIES, EXTRA_REP_ROWS, CAPITALISATION_LIMBS, CAPITALISATION_SUBTYPES, CAPITALIZATION_ROWS, GENERAL_EXCEPTIONS_ROW, KNOWLEDGE_ROW, GENERAL_EXCEPTION_DETAILS, KNOWLEDGE_DETAILS };
