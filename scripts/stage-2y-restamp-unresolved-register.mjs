#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTER_PATH = resolve('docs/codex-program/notes/stage-2y/unresolved-register.json');
const VALID_STATUSES = new Set([
  'MECHANISM_CONFIRMED',
  'LIKELY_MECHANISM',
  'CORRECT_ABSTENTION',
  'UNDIAGNOSED',
]);
const VALID_FIX_CLASSES = new Set([
  'RESOLVER_SIDE',
  'PROMPT_CHANGE',
  'TAXONOMY_DESIGN',
  'MIXED',
  'NO_FIX',
]);

const keyFor = (family, reasonCode) => `${family}\u0000${reasonCode}`;
const pairLines = (text) => text.trim().split('\n').map((line) => {
  const [family, reasonCode] = line.split('\t');
  if (!family || !reasonCode) throw new Error(`invalid pair mapping line: ${line}`);
  return [family, reasonCode];
});

const entries = [];
function add(status, text, update = {}) {
  for (const [family, reasonCode] of pairLines(text)) {
    entries.push({ family, reasonCode, diagnosis_status: status, ...update });
  }
}

add('MECHANISM_CONFIRMED', String.raw`
REPRESENTATIONS	UNMAPPED_GENERIC_CLAIM_KEY
REPRESENTATIONS	REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED
REPRESENTATIONS	NATIVE_OPEN_WORLD_PROPOSAL
NO_SHOP	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
CONSIDERATION	NATIVE_OPEN_WORLD_PROPOSAL
INTERIM_OPERATING	NATIVE_OPEN_WORLD_PROPOSAL
MAE_DEFINITION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
REPRESENTATIONS	QUALIFIER_KIND_UNCLASSIFIED
KEY_DEFINED_TERMS	NATIVE_OPEN_WORLD_PROPOSAL
MAE_DEFINITION	UNMAPPED_GENERIC_CLAIM_KEY
MATERIAL_CONTRACTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
INTERIM_OPERATING	CATEGORY_UNCORROBORATED
REPRESENTATIONS	REPRESENTATION_QUALIFIER_KIND_NOT_EXACT
INTERIM_OPERATING	IOC_ATTACHMENT_TARGET_QUOTE_MISSING
TERMINATION	NATIVE_OPEN_WORLD_PROPOSAL
DNO_INDEMNIFICATION	NATIVE_OPEN_WORLD_PROPOSAL
GENERAL_COVENANTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
ANTITRUST_REGULATORY	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
INTERIM_OPERATING	AMBIGUOUS_CATEGORY_CORROBORATION
PROXY_MEETING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
PROXY_MEETING	PROXY_MEETING_KIND_UNCORROBORATED
TERMINATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MISC_BOILERPLATE	NATIVE_OPEN_WORLD_PROPOSAL
INTERIM_OPERATING	IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED
PROXY_MEETING	PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED
EMPLOYEE_MATTERS	NATIVE_OPEN_WORLD_PROPOSAL
GENERAL_COVENANTS	NATIVE_OPEN_WORLD_PROPOSAL
TERMINATION_FEE	NATIVE_OPEN_WORLD_PROPOSAL
INTERIM_OPERATING	IOC_NUMERIC_OPERAND_NOT_EXACT
MATERIAL_CONTRACTS	NATIVE_OPEN_WORLD_PROPOSAL
FINANCING_COVENANTS	NATIVE_OPEN_WORLD_PROPOSAL
MERGER_STRUCTURE_CLOSING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
APPRAISAL_DISSENTERS_RIGHTS	NATIVE_OPEN_WORLD_PROPOSAL
TAX_MATTERS	NATIVE_OPEN_WORLD_PROPOSAL
GUARANTY_FINANCING_PARTY	NATIVE_OPEN_WORLD_PROPOSAL
NO_OTHER_REPS_FRAUD	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
NO_SHOP	NATIVE_OPEN_WORLD_PROPOSAL
SPECIFIC_PERFORMANCE_REMEDIES	NATIVE_OPEN_WORLD_PROPOSAL
EMPLOYEE_MATTERS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
CONSIDERATION	PER_SHARE_CONTEXT_UNCORROBORATED
CLOSING_CONDITIONS	NATIVE_OPEN_WORLD_PROPOSAL
CONSIDERATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
TERMINATION_FEE	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
INTERIM_OPERATING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MERGER_STRUCTURE_CLOSING	NATIVE_OPEN_WORLD_PROPOSAL
TAX_MATTERS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MAE_DEFINITION	NATIVE_OPEN_WORLD_PROPOSAL
MISC_BOILERPLATE	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
NO_OTHER_REPS_FRAUD	UNMAPPED_GENERIC_CLAIM_KEY
CONSIDERATION	NO_RATIO_LITERAL
PROXY_MEETING	CONTROL_PARTY_REF_ABSENT
DIVIDENDS	NATIVE_OPEN_WORLD_PROPOSAL
SPECIFIC_PERFORMANCE_REMEDIES	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
FINANCING_COVENANTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
PROXY_MEETING	ANCHOR_KIND_UNCORROBORATED
PROXY_MEETING	NATIVE_OPEN_WORLD_PROPOSAL
INTERIM_OPERATING	IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION
CLOSING_CONDITIONS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
APPRAISAL_DISSENTERS_RIGHTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
CONSIDERATION	ISSUER_STOCK_REF_NOT_IN_QUOTE
DNO_INDEMNIFICATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
ANTITRUST_REGULATORY	NATIVE_OPEN_WORLD_PROPOSAL
`);

add('LIKELY_MECHANISM', String.raw`
TERMINATION_FEE	FEE_SIDE_UNCORROBORATED
CLOSING_CONDITIONS	ACCURACY_STANDARD_OUT_OF_VOCABULARY
PROXY_MEETING	AMBIGUOUS_PROXY_MEETING_KIND
`);

add('MECHANISM_CONFIRMED', String.raw`
REPRESENTATIONS	REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED
`, {
  diagnosis: 'The resolver compares ACTUAL from the model with a null result from its literal-only quote parser. The checked corpus qualifiers omit the word "actual", while their agreement-level Knowledge definitions use it.',
  diagnosis_note: 'diag-gap-reps-mae.md',
  fix: 'When the local parser finds no standard, retain a valid model standard. Keep a real literal conflict as a review.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '91, replay-validatable from the recorded model value and existing cross-section evidence.',
});

add('MECHANISM_CONFIRMED', String.raw`
KEY_DEFINED_TERMS	MULTI_SPAN_COMPOSED
KEY_DEFINED_TERMS	NESTED_OR_CROSS_REFERENCED_EVIDENCE
`, {
  diagnosis: 'The checked producer emits DEFINITION plus OPERATIVE_TEXT evidence whenever a definition head differs from its fact-bearing limb. This one same-section, two-edge shape deterministically fires both gates.',
  diagnosis_note: 'diag-gap-defterms-contracts.md',
  fix: 'Do not treat a same-call DEFINITION plus OPERATIVE_TEXT pair as cross-provision composition. Keep genuine CROSS_REFERENCE and DERIVATION_INPUT evidence gated.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '152 reason occurrences, all from the checked head/limb evidence construction.',
});

add('MECHANISM_CONFIRMED', String.raw`
MATERIAL_CONTRACTS	MATERIAL_CONTRACT_BUCKET_UNCORROBORATED
`, {
  diagnosis: 'Checked quotes use valid bucket codes but legitimate drafting variants that the bucket synonym regexes do not match. Each criterion is emitted twice, so 66 occurrences represent 33 criteria.',
  diagnosis_note: 'diag-gap-defterms-contracts.md',
  fix: 'Broaden the affected bucket synonyms, including SEC Item 404, supplier, governmental-entity and bidirectional-licence wording. Treat parent-clause corroboration separately.',
  fix_class: 'MIXED',
  claims_recoverable: 'Up to 60 of 66 from verified drafting-variation misses; the parent-clause settlement case needs the shared context mechanism.',
});

add('MECHANISM_CONFIRMED', String.raw`
MATERIAL_CONTRACTS	MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED
`, {
  diagnosis: 'The resolver holds any definition cross-reference after the bucket has already passed. Checked Item 601 references are self-corroborating; internal defined terms need a cross-family definition lookup.',
  diagnosis_note: 'diag-gap-defterms-contracts.md',
  fix: 'Carve out self-referential Item 601 references, then design a cross-family definition lookup with CROSS_REFERENCE evidence for internal terms.',
  fix_class: 'MIXED',
  claims_recoverable: '6 of 15 via the Item 601 carve-out; the remaining 9 need the new cross-family mechanism.',
});

add('LIKELY_MECHANISM', String.raw`
MAE_DEFINITION	MAE_CARVEOUT_UNCORROBORATED
`, {
  diagnosis: 'The row mixes checked regex misses and null carveout codes with one explicitly uncertain compliance-with-agreement instance. It cannot truthfully have one fix.',
  diagnosis_note: 'diag-gap-reps-mae.md',
  fix: 'Split null-code abstentions from failed corroboration, widen the checked carveout patterns, and re-check the uncertain residual before changing it.',
  fix_class: 'MIXED',
  claims_recoverable: 'Most checked occurrences are resolver-side; one residual remains explicitly uncertain.',
});

add('CORRECT_ABSTENTION', String.raw`
MAE_DEFINITION	PARTY_UNRESOLVED
`, {
  diagnosis: 'The checked Concho source says "any Party" and the recorded field is populated with that bilateral subject. The resolver correctly declines to invent a target or buyer side.',
  diagnosis_note: 'diag-gap-reps-mae.md',
  fix: 'No resolver fix. A JOINT_MULTI_PARTY taxonomy decision is optional and needs downstream claim-definition review.',
  fix_class: 'NO_FIX',
  claims_recoverable: '0 without a new bilateral-party design decision.',
});

add('MECHANISM_CONFIRMED', String.raw`
REPRESENTATIONS	REPRESENTATION_SIDE_UNRESOLVED
MAE_DEFINITION	CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE
`, {
  diagnosis: 'The checked code has a second incomplete party/range parser: Merger Sub is absent from representationSideFor, and trailing-list validation cannot expand a clause-label range.',
  diagnosis_note: 'diag-gap-reps-mae.md',
  fix: 'Route Merger Sub through the existing party-capacity lexicon and recognise label ranges in trailing-list validation.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '2 occurrences, replay-validatable.',
});

add('MECHANISM_CONFIRMED', String.raw`
REPRESENTATIONS	QUALIFIER_KIND_DISAGREEMENT
`, {
  diagnosis: 'The checked quote is a representations ACCURACY code but the shared legacy lexicon classifies the same text as THRESHOLD. The two canonical vocabularies conflict.',
  diagnosis_note: 'diag-gap-reps-mae.md',
  fix: 'Reconcile the shared lexicon and representations taxonomy before adding any narrow exemption.',
  fix_class: 'TAXONOMY_DESIGN',
  claims_recoverable: '1 occurrence after the taxonomy decision.',
});

add('MECHANISM_CONFIRMED', String.raw`
NO_SHOP	NO_SHOP_PERIOD_ROLE_UNCORROBORATED
NO_SHOP	NO_SHOP_PREREQUISITE_UNCORROBORATED
NO_SHOP	RECOMMENDATION_CHANGE_ACTION_UNCORROBORATED
NO_SHOP	FIDUCIARY_ENGAGEMENT_STANDARD_UNCORROBORATED
NO_SHOP	STANDSTILL_ACTION_UNCORROBORATED
NO_SHOP	RECOMMENDATION_CHANGE_TRIGGER_UNCORROBORATED
NO_SHOP	RECOMMENDATION_SAFE_DISCLOSURE_UNCORROBORATED
NO_SHOP	RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD_UNCORROBORATED
NO_SHOP	REPRESENTATIVE_CONTROL_STANDARD_UNCORROBORATED
NO_SHOP	COVENANT_OBLIGOR_NOT_IN_QUOTE
NO_SHOP	NO_SHOP_ACTION_UNCORROBORATED
`, {
  diagnosis: 'Checked quotes are clipped enumerated sub-clauses. sourceParagraphForCandidate stops at the first canonical-text line break and excludes the governing chapeau that supplies the obligor, modal and role.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Recover the governing chapeau across enumerated sibling lines and use that context in every No-Shop corroboration path, including the action path.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '85 occurrences share the checked context-window mechanism.',
});

add('MECHANISM_CONFIRMED', String.raw`
DNO_INDEMNIFICATION	DNO_KIND_UNCORROBORATED
DNO_INDEMNIFICATION	PERCENT_UNRESOLVED
DNO_INDEMNIFICATION	YEAR_COUNT_UNRESOLVED
EMPLOYEE_MATTERS	ITEM_OR_STANDARD_UNCORROBORATED
EMPLOYEE_MATTERS	EMPLOYEE_KIND_UNCORROBORATED
EMPLOYEE_MATTERS	EMPLOYEE_ITEM_OR_STANDARD_OUT_OF_VOCABULARY
EMPLOYEE_MATTERS	MONTH_COUNT_UNRESOLVED
TERMINATION	TRIGGER_KIND_UNCORROBORATED
TERMINATION	TERMINATING_PARTY_REF_NOT_IN_QUOTE
TERMINATION	PERIOD_KIND_UNCORROBORATED
`, {
  diagnosis: 'Checked resolver tests receive clipped enumerated fragments or apply narrow literal number/vocabulary patterns. The missing corroboration is in the governing chapeau or an ordinary drafting variant.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Use governing context where required and widen the checked parsers and corroboration patterns.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '73 occurrences across the checked context and parser mechanisms.',
});

add('MECHANISM_CONFIRMED', String.raw`
ANTITRUST_REGULATORY	NOTIFICATION_OBLIGATION_UNCORROBORATED
ANTITRUST_REGULATORY	LITIGATION_OBLIGATION_UNCORROBORATED
ANTITRUST_REGULATORY	COOPERATION_OBLIGATION_UNCORROBORATED
ANTITRUST_REGULATORY	STRATEGY_CONTROL_UNCORROBORATED
ANTITRUST_REGULATORY	NON_IMPEDIMENT_COVENANT_UNCORROBORATED
ANTITRUST_REGULATORY	OBLIGOR_SCOPE_UNCORROBORATED
GENERAL_COVENANTS	GENERAL_COVENANT_CODE_UNCORROBORATED
INTERIM_OPERATING	IOC_ATTACHMENT_TARGET_ZERO_MATCHES
APPRAISAL_DISSENTERS_RIGHTS	APPRAISAL_ASSERTION_OPEN_WORLD
`, {
  diagnosis: 'The notes traced the checked quote and resolver path to narrow corroboration patterns, hard-coded mutual-party forms, or byte-identical component attachment. Appraisal settlement consent has no registered assertion kind.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Widen the checked resolver patterns and attachment comparison; add the appraisal settlement-consent claim shape.',
  fix_class: 'MIXED',
  claims_recoverable: 'At least 51 occurrences have an evidence-backed mechanism; appraisal needs taxonomy work.',
});

add('LIKELY_MECHANISM', String.raw`
ANTITRUST_REGULATORY	CONSULTATION_RIGHT_UNCORROBORATED
ANTITRUST_REGULATORY	INFORMATION_SHARING_OBLIGATION_UNCORROBORATED
ANTITRUST_REGULATORY	BURDEN_COMMITMENT_UNCORROBORATED
FINANCING_COVENANTS	ASSERTION_KIND_UNCORROBORATED
`, {
  diagnosis: 'Checked samples mix resolver misses with extractor misclassifications. The row grain cannot represent them as one confirmed fix.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Split the quoted resolver and prompt cases before implementation; do not apply one row-wide fix.',
  fix_class: 'MIXED',
  claims_recoverable: 'Mixed population; recoverability needs occurrence-level partitioning.',
});

add('CORRECT_ABSTENTION', String.raw`
ANTITRUST_REGULATORY	FILING_REGIME_NOT_SINGLE_NAMED_REGIME
PROXY_MEETING	NO_DAY_COUNT
FINANCING_COVENANTS	MULTIPLE_DAY_COUNTS
`, {
  diagnosis: 'The checked source text is compound or qualitative where the asserted claim requires one regime or one day count. The resolver refusal is correct.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Do not loosen the resolver. Route the upstream proposal to a multi-value or qualitative claim shape, or suppress it.',
  fix_class: 'TAXONOMY_DESIGN',
  claims_recoverable: '0 without an upstream claim-shape decision.',
});

add('MECHANISM_CONFIRMED', String.raw`
NO_SHOP	NON_LITERAL_NUMERAL
FINANCING_COVENANTS	NON_LITERAL_NUMERAL
TERMINATION_FEE	NON_LITERAL_NUMERAL
`, {
  diagnosis: 'The parser computes a spelled numeral but rejects it unless the source also supplies a parenthetical digit. Checked bare spelled day counts demonstrate the drafter-habit condition.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Resolve the already-computed spelled numeral when the parenthetical digit is absent.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '6 occurrences, replay-validatable.',
});

add('CORRECT_ABSTENTION', String.raw`
KEY_DEFINED_TERMS	DEFINED_TERM_REF_NOT_IN_HEAD
KEY_DEFINED_TERMS	NO_PERCENT_LITERAL
KEY_DEFINED_TERMS	RECORDED_DEFINITION_ENVELOPE_UNCORROBORATED
`, {
  diagnosis: 'The checked claims lack the required head reference, literal percentage or internally consistent envelope. The resolver correctly fails closed.',
  diagnosis_note: 'diag-gap-defterms-contracts.md',
  fix: 'Improve producer consistency and route qualitative thresholds to open-world claims. Do not weaken the resolver check.',
  fix_class: 'PROMPT_CHANGE',
  claims_recoverable: '0 without better upstream extraction.',
});

add('MECHANISM_CONFIRMED', String.raw`
KEY_DEFINED_TERMS	MULTIPLE_PERCENT_LITERALS
`, {
  diagnosis: 'The checked quote repeats the same 80% value for two tests, but the parser abstains on every second percent token.',
  diagnosis_note: 'diag-gap-defterms-contracts.md',
  fix: 'Deduplicate equal percentage values before treating multiple literals as ambiguous.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '2 occurrences, replay-validatable.',
});

add('LIKELY_MECHANISM', String.raw`
CLOSING_CONDITIONS	CONDITION_KIND_UNCORROBORATED
CLOSING_CONDITIONS	PARTY_UNRESOLVED
CLOSING_CONDITIONS	MAE_PARTY_UNCORROBORATED
CLOSING_CONDITIONS	APPROVAL_KIND_UNCORROBORATED
CLOSING_CONDITIONS	CERTIFIED_CONDITION_REF_NOT_IN_QUOTE
CLOSING_CONDITIONS	SCRAPE_QUOTE_NOT_IN_QUOTE
GENERAL_COVENANTS	PARTY_UNRESOLVED
GENERAL_COVENANTS	GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED
FINANCING_COVENANTS	FINANCING_SCOPE_UNCORROBORATED
TERMINATION	NO_CALENDAR_DATE
NO_SHOP	NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD
PROXY_MEETING	ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED
PROXY_MEETING	MEETING_REF_ABSENT
PROXY_MEETING	CONTROL_PARTY_REF_UNCORROBORATED
PROXY_MEETING	CONTROL_PARTY_REF_NOT_IN_QUOTE
PROXY_MEETING	DOCUMENT_REF_NOT_IN_QUOTE
ANTITRUST_REGULATORY	OBLIGOR_REF_NOT_IN_QUOTE
ANTITRUST_REGULATORY	PARTY_UNRESOLVED
ANTITRUST_REGULATORY	INFORMATION_PROTECTION_UNCORROBORATED
ANTITRUST_REGULATORY	WITHDRAWAL_EXCEPTION_PERIOD_UNCORROBORATED
ANTITRUST_REGULATORY	FILING_OBLIGATION_UNCORROBORATED
ANTITRUST_REGULATORY	OBLIGOR_REF_UNCORROBORATED
KEY_DEFINED_TERMS	STANDARD_CODE_OUT_OF_ENUM
KEY_DEFINED_TERMS	SUBSTITUTION_UNCORROBORATED
TERMINATION_FEE	ANNIVERSARY_PHRASE
CONSIDERATION	NO_MONEY_LITERAL
CONSIDERATION	RATIO_CONTEXT_UNCORROBORATED
GUARANTY_FINANCING_PARTY	GTY_KIND_UNCORROBORATED
MERGER_STRUCTURE_CLOSING	MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE
`, {
  diagnosis: 'A note identified the resolver location and a likely family mechanism, but did not verify every quote in this row. The status remains deliberately provisional.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Pull the individual recorded responses and source quotes before selecting a fix.',
  fix_class: 'MIXED',
  claims_recoverable: 'Unknown until occurrence-level verification.',
});

add('LIKELY_MECHANISM', String.raw`
TAX_MATTERS	TAX_TREATMENT_KIND_UNCORROBORATED
TAX_MATTERS	TAX_ASSERTION_OPEN_WORLD
TERMINATION_FEE	SOLE_REMEDY_FEE_CONTEXT_LINKED
TERMINATION_FEE	SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED
`, {
  diagnosis: 'The note explicitly leaves these quote populations uncertain after identifying their family and candidate resolver module.',
  diagnosis_note: 'diag-gap-remaining.md',
  fix: 'Read the cited corroboration module and verify each quoted occurrence before choosing resolver, prompt or taxonomy work.',
  fix_class: 'MIXED',
  claims_recoverable: 'Unknown pending individual quote verification.',
});

add('UNDIAGNOSED', String.raw`
INTERIM_OPERATING	IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD
`, {
  diagnosis: 'The required diagnostic notes do not establish a mechanism for this row.',
  diagnosis_note: null,
  fix: 'No supported fix yet.',
  fix_class: 'NO_FIX',
  claims_recoverable: 'Unknown.',
});

add('MECHANISM_CONFIRMED', String.raw`
CLOSING_CONDITIONS	REP_SIDE_UNCORROBORATED
CLOSING_CONDITIONS	OBLIGOR_REF_UNCORROBORATED
`, {
  diagnosis: 'Checked claims lose their chapeau context or hit hard-coded party/modal wording. The specific resolver checks and corpus forms were traced.',
  diagnosis_note: 'diag-closing-conditions.md',
  fix: 'Recover chapeau context and route party matching through the existing capacity lexicon with tense- and order-tolerant wording.',
  fix_class: 'RESOLVER_SIDE',
  claims_recoverable: '12 occurrences, replay-validatable.',
});

function restoreLegacyNotes(note, text) {
  for (const [family, reasonCode] of pairLines(text)) {
    const entry = entries.find((candidate) => candidate.family === family && candidate.reasonCode === reasonCode);
    if (!entry) throw new Error(`legacy note has no mapping: ${family}/${reasonCode}`);
    entry.diagnosis_note = note;
  }
}

restoreLegacyNotes('diag-unmapped-lexical.md', String.raw`
REPRESENTATIONS	UNMAPPED_GENERIC_CLAIM_KEY
NO_SHOP	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MAE_DEFINITION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MAE_DEFINITION	UNMAPPED_GENERIC_CLAIM_KEY
MATERIAL_CONTRACTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
GENERAL_COVENANTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
ANTITRUST_REGULATORY	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
PROXY_MEETING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
TERMINATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MERGER_STRUCTURE_CLOSING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
NO_OTHER_REPS_FRAUD	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
EMPLOYEE_MATTERS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
CONSIDERATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
TERMINATION_FEE	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
INTERIM_OPERATING	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
TAX_MATTERS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
MISC_BOILERPLATE	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
NO_OTHER_REPS_FRAUD	UNMAPPED_GENERIC_CLAIM_KEY
SPECIFIC_PERFORMANCE_REMEDIES	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
FINANCING_COVENANTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
CLOSING_CONDITIONS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
APPRAISAL_DISSENTERS_RIGHTS	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
DNO_INDEMNIFICATION	LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE
`);
restoreLegacyNotes('diag-qualifier-proxy.md', String.raw`
REPRESENTATIONS	REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED
REPRESENTATIONS	QUALIFIER_KIND_UNCLASSIFIED
REPRESENTATIONS	REPRESENTATION_QUALIFIER_KIND_NOT_EXACT
PROXY_MEETING	PROXY_MEETING_KIND_UNCORROBORATED
CLOSING_CONDITIONS	ACCURACY_STANDARD_OUT_OF_VOCABULARY
PROXY_MEETING	PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED
PROXY_MEETING	AMBIGUOUS_PROXY_MEETING_KIND
PROXY_MEETING	CONTROL_PARTY_REF_ABSENT
PROXY_MEETING	ANCHOR_KIND_UNCORROBORATED
`);
restoreLegacyNotes('diag-open-world.md', String.raw`
REPRESENTATIONS	NATIVE_OPEN_WORLD_PROPOSAL
CONSIDERATION	NATIVE_OPEN_WORLD_PROPOSAL
INTERIM_OPERATING	NATIVE_OPEN_WORLD_PROPOSAL
KEY_DEFINED_TERMS	NATIVE_OPEN_WORLD_PROPOSAL
TERMINATION	NATIVE_OPEN_WORLD_PROPOSAL
DNO_INDEMNIFICATION	NATIVE_OPEN_WORLD_PROPOSAL
MISC_BOILERPLATE	NATIVE_OPEN_WORLD_PROPOSAL
EMPLOYEE_MATTERS	NATIVE_OPEN_WORLD_PROPOSAL
GENERAL_COVENANTS	NATIVE_OPEN_WORLD_PROPOSAL
TERMINATION_FEE	NATIVE_OPEN_WORLD_PROPOSAL
MATERIAL_CONTRACTS	NATIVE_OPEN_WORLD_PROPOSAL
FINANCING_COVENANTS	NATIVE_OPEN_WORLD_PROPOSAL
APPRAISAL_DISSENTERS_RIGHTS	NATIVE_OPEN_WORLD_PROPOSAL
TAX_MATTERS	NATIVE_OPEN_WORLD_PROPOSAL
GUARANTY_FINANCING_PARTY	NATIVE_OPEN_WORLD_PROPOSAL
NO_SHOP	NATIVE_OPEN_WORLD_PROPOSAL
SPECIFIC_PERFORMANCE_REMEDIES	NATIVE_OPEN_WORLD_PROPOSAL
CLOSING_CONDITIONS	NATIVE_OPEN_WORLD_PROPOSAL
MERGER_STRUCTURE_CLOSING	NATIVE_OPEN_WORLD_PROPOSAL
MAE_DEFINITION	NATIVE_OPEN_WORLD_PROPOSAL
DIVIDENDS	NATIVE_OPEN_WORLD_PROPOSAL
PROXY_MEETING	NATIVE_OPEN_WORLD_PROPOSAL
ANTITRUST_REGULATORY	NATIVE_OPEN_WORLD_PROPOSAL
`);
restoreLegacyNotes('diag-ioc.md', String.raw`
INTERIM_OPERATING	CATEGORY_UNCORROBORATED
INTERIM_OPERATING	IOC_ATTACHMENT_TARGET_QUOTE_MISSING
INTERIM_OPERATING	AMBIGUOUS_CATEGORY_CORROBORATION
INTERIM_OPERATING	IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED
INTERIM_OPERATING	IOC_NUMERIC_OPERAND_NOT_EXACT
INTERIM_OPERATING	IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION
`);
restoreLegacyNotes('diag-termination-fee.md', String.raw`
TERMINATION_FEE	FEE_SIDE_UNCORROBORATED
`);
restoreLegacyNotes('diag-consideration.md', String.raw`
CONSIDERATION	PER_SHARE_CONTEXT_UNCORROBORATED
CONSIDERATION	NO_RATIO_LITERAL
CONSIDERATION	ISSUER_STOCK_REF_NOT_IN_QUOTE
`);
for (const [family, reasonCode] of pairLines(String.raw`
TERMINATION_FEE	FEE_SIDE_UNCORROBORATED
CLOSING_CONDITIONS	ACCURACY_STANDARD_OUT_OF_VOCABULARY
`)) {
  const entry = entries.find((candidate) => candidate.family === family && candidate.reasonCode === reasonCode);
  if (!entry) throw new Error(`mixed legacy row has no mapping: ${family}/${reasonCode}`);
  entry.fix_class = 'MIXED';
}

const PAIR_RESTAMPS = new Map();
for (const entry of entries) {
  if (!VALID_STATUSES.has(entry.diagnosis_status)) throw new Error(`invalid status in mapping: ${entry.diagnosis_status}`);
  const key = keyFor(entry.family, entry.reasonCode);
  if (PAIR_RESTAMPS.has(key)) throw new Error(`duplicate mapping key: ${entry.family}/${entry.reasonCode}`);
  PAIR_RESTAMPS.set(key, entry);
}

function restamp(register) {
  if (!Array.isArray(register.rows)) throw new Error('register rows are missing');
  if (register.rows.length !== 155) throw new Error(`row count drift: expected 155, got ${register.rows.length}`);
  const occurrenceSum = register.rows.reduce((sum, row) => sum + row.count, 0);
  if (occurrenceSum !== 4241) throw new Error(`occurrence sum drift: expected 4241, got ${occurrenceSum}`);
  const rowKeys = new Set();
  for (const row of register.rows) {
    const key = keyFor(row.family, row.reason_code);
    if (rowKeys.has(key)) throw new Error(`duplicate register key: ${row.family}/${row.reason_code}`);
    rowKeys.add(key);
    const mapping = PAIR_RESTAMPS.get(key);
    if (!mapping) throw new Error(`missing mapping key: ${row.family}/${row.reason_code}`);
    for (const [field, value] of Object.entries(mapping)) {
      if (field !== 'family' && field !== 'reasonCode') row[field] = value;
    }
    if (!VALID_STATUSES.has(row.diagnosis_status)) throw new Error(`invalid row status: ${row.family}/${row.reason_code}`);
    if (!VALID_FIX_CLASSES.has(row.fix_class)) throw new Error(`invalid fix class: ${row.family}/${row.reason_code}`);
    if (row.diagnosis_note != null && row.diagnosis === 'UNDIAGNOSED — this pair does not appear in a checked diagnostic note.') {
      throw new Error(`stale undiagnosed diagnosis with note: ${row.family}/${row.reason_code}`);
    }
  }
  for (const [key, mapping] of PAIR_RESTAMPS) {
    if (!rowKeys.has(key)) throw new Error(`mapping key absent from register: ${mapping.family}/${mapping.reasonCode}`);
  }
  const counts = Object.fromEntries([...VALID_STATUSES].map((status) => [status, { rows: 0, occurrences: 0 }]));
  for (const row of register.rows) {
    counts[row.diagnosis_status].rows += 1;
    counts[row.diagnosis_status].occurrences += row.count;
  }
  register._meta.diagnosis_status_counts = counts;
  register._meta.undiagnosed_rows_are_stale = {
    ...register._meta.undiagnosed_rows_are_stale,
    finding: 'The prior 90 UNDIAGNOSED rows / 732 occurrences were not a residual count. This restamp applies the checked pair-level evidence from the four Stage 2Y diagnostic notes.',
    consequence: 'The register now separates confirmed mechanisms, provisional mechanisms, confirmed correct refusals and the one row with no established mechanism.',
    what_is_still_open: `Exact post-restamp residual: ${counts.LIKELY_MECHANISM.rows} rows / ${counts.LIKELY_MECHANISM.occurrences} occurrences are likely mechanisms pending occurrence-level confirmation; ${counts.UNDIAGNOSED.rows} row / ${counts.UNDIAGNOSED.occurrences} occurrences remains undiagnosed.`,
  };
  register._meta.restamp = {
    generated: '2026-08-09',
    mapping: 'scripts/stage-2y-restamp-unresolved-register.mjs, keyed by family and reason_code',
    row_count: 155,
    occurrence_sum: 4241,
  };
  return register;
}

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
if ((write && check) || (!write && !check)) throw new Error('use exactly one of --write or --check');
const original = readFileSync(REGISTER_PATH, 'utf8');
const restamped = `${JSON.stringify(restamp(JSON.parse(original)), null, 2)}\n`;
if (check) {
  if (original !== restamped) throw new Error('register drift: run node scripts/stage-2y-restamp-unresolved-register.mjs --write');
  process.exit(0);
}
writeFileSync(REGISTER_PATH, restamped);
