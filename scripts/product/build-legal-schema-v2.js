#!/usr/bin/env node
'use strict';

// Builds contracts/product/legal-schema.v2.json from V1 plus the V2 overlay.
// V2 is the layered fact model decided on 2026-09-12 (plan Phase 5B). The
// transformation is deterministic so the output can be regenerated and
// diffed; legal content lives in the overlay below, not in the code.

const fs = require('node:fs');
const path = require('node:path');

const v1 = require('../../contracts/product/legal-schema.v1.json');

const GENERIC = ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT', 'TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS'];
const COVENANT_FAMILIES = new Set(['GENERAL_COVENANTS', 'ANTITRUST_REGULATORY', 'NO_SHOP', 'INTERIM_OPERATING', 'FINANCING_COVENANTS', 'EMPLOYEE_MATTERS', 'DNO_INDEMNIFICATION', 'TAX_MATTERS', 'PROXY_MEETING']);

function titleCase(key) {
  return key.toLowerCase().split('_').map((word, index) => (index === 0 ? word[0].toUpperCase() + word.slice(1) : word)).join(' ')
    .replace(/\bmae\b/i, 'MAE').replace(/\bdno\b/i, 'D&O').replace(/\bs4\b/i, 'S-4').replace(/\bcvr\b/i, 'CVR').replace(/\bhsr\b/i, 'HSR').replace(/\bfirpta\b/i, 'FIRPTA').replace(/\bvdr\b/i, 'VDR');
}

// Overlay: Ben's names and decisions from the 2026-09-12 review, and the
// headline and layer rules per family. `rename` maps V1 subtype to V2 key.
// `add` lists new subtypes. `labels` are human headline labels.
const OVERLAY = {
  TERMINATION: {
    layers: 'One fact per termination right. Layer 1: trigger, terminating party, conditions to exercise, expiry of the right. Cure mechanics as a branch: breach that would fail a condition; curable or not; cure window measured from notice and capped at the outside date. Cross-reference the closing conditions the breach must fail.',
    headline: { distinguishing: ['TRIGGER', 'ACTOR', 'CONDITION', 'EXCEPTION'], note: 'trigger, terminating party, cure right, and any condition or exception to exercise (Ben, 2026-09-12: e.g. no termination where the terminator primarily caused the outside date to be missed)' },
    rename: { VOTE_FAILURE: 'VOTE_FAILURE' },
    add: [
      { subtype_key: 'WRITTEN_CONSENT_NOT_DELIVERED', label: 'Written consent not delivered', required_roles: ['terminating_party', 'action', 'consent_deadline'], optional_roles: ['right_expiry', 'consenting_stockholders'], relationships: ['QUALIFIES', 'EXCEPTS', 'REQUIRES'] },
      { subtype_key: 'SUPPORT_AGREEMENT_NOT_DELIVERED', label: 'Support agreement not delivered', required_roles: ['terminating_party', 'action', 'delivery_deadline'], optional_roles: ['right_expiry', 'consenting_stockholders'], relationships: ['QUALIFIES', 'EXCEPTS', 'REQUIRES'] },
      { subtype_key: 'BESPOKE_DATE_RIGHT', label: 'Date-based termination right', required_roles: ['terminating_party', 'action', 'date_or_event', 'unmet_condition'], optional_roles: ['right_expiry'], relationships: ['QUALIFIES', 'EXCEPTS', 'REQUIRES'] },
    ],
    roles: {
      BREACH: { required_roles: ['terminating_party', 'breaching_party', 'action', 'breach_subject', 'closing_condition_failure_standard'], optional_roles: ['curability', 'cure_period', 'cure_period_end', 'terminator_breach_bar'], note: 'notice_period removed (the cure window runs from notice); outside_date_cap renamed cure_period_end; curability is a branch: curable or not.' },
    },
    labels: { VOTE_FAILURE: 'Stockholder vote failed', BREACH: 'Termination for breach', OUTSIDE_DATE: 'Outside date', LEGAL_RESTRAINT: 'Final legal restraint', SUPERIOR_PROPOSAL: 'Superior proposal', RECOMMENDATION_CHANGE: 'Adverse recommendation change', MUTUAL_CONSENT: 'Mutual consent' },
  },
  TERMINATION_FEE: {
    layers: 'One fact per fee amount, per trigger and per tail. A trigger with several limbs is one fact with one LIST_ELEMENT per limb; the tail is one fact whose components are the period, the qualifying event, the look-back condition and any deeming rule. The fee amount fact is cross-referenced from every trigger.',
    headline: { distinguishing: ['AMOUNT', 'ACTOR', 'TRIGGER', 'PERIOD'], note: 'amount, payer and trigger; a tail headline names its deeming mechanism when one exists (Ben, 2026-09-12: unusual, so flag it)' },
    add: [
      { subtype_key: 'FEE_ELECTION', label: 'Election to accept or decline fee', required_roles: ['electing_party', 'election_deadline', 'default_outcome'], optional_roles: ['waiver_scope'], relationships: ['QUALIFIES', 'TRIGGERS'] },
    ],
    labels: { FEE_AMOUNT: 'Termination fee amount', FEE_TRIGGER: 'Fee trigger', TAIL_PERIOD: 'Tail', EXPENSE_REIMBURSEMENT: 'Expense allocation', LATE_INTEREST: 'Late interest' },
  },
  NO_SHOP: {
    layers: 'One fact per duty. Prohibited actions are one LIST with one LIST_ELEMENT per verb (solicit, initiate, endorse, encourage, facilitate). Clean-up duties are their own subtypes. Notice duties carry the notice contents as LIST_ELEMENTs. Fiduciary exceptions carry each prerequisite as a CONDITION component. Periods are PERIOD components with canonical values.',
    headline: { distinguishing: ['OPERATION', 'PERIOD', 'LIST'], note: 'the duty or permission and its period' },
    add: [
      { subtype_key: 'CEASE_DISCUSSIONS_REQUIREMENT', label: 'Cease existing discussions', required_roles: ['covenant_obligor', 'required_action'], optional_roles: ['covered_representatives', 'timing'], relationships: ['QUALIFIES'] },
      { subtype_key: 'RETURN_OR_DESTROY_REQUIREMENT', label: 'Return or destroy confidential information', required_roles: ['covenant_obligor', 'required_action'], optional_roles: ['covered_representatives', 'look_back_period', 'timing'], relationships: ['QUALIFIES'] },
      { subtype_key: 'SUBSEQUENT_VDR_REMOVAL', label: 'Subsequent removal of data room access', required_roles: ['covenant_obligor', 'required_action', 'trigger'], optional_roles: ['covered_representatives', 'timing'], relationships: ['QUALIFIES'] },
    ],
    labels: { PROHIBITED_ACTION: 'No-shop prohibition', EXCEPTION_PREREQUISITE: 'Fiduciary exception', NOTICE_PERIOD: 'Notice of proposals', NOTICE_UPDATE_OBLIGATION: 'Keep informed', INITIAL_MATCH_PERIOD: 'Match right', SUBSEQUENT_MATCH_PERIOD: 'Subsequent match right', RECOMMENDATION_CHANGE: 'Change of recommendation' },
  },
  KEY_DEFINED_TERMS: {
    layers: 'Each definition is one fact. Layer 1: the defined term, the operation ("means"), the object, thresholds and deeming rules. Lists inside a definition are LISTs with LIST_ELEMENTs.',
    headline: { distinguishing: ['DEFINED_TERM', 'THRESHOLD', 'PERCENTAGE'], note: 'the term and its threshold' },
    add: [
      { subtype_key: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT', label: 'Acceptable Confidentiality Agreement', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM'], relationships: ['QUALIFIES', 'EXCEPTS', 'DEFINED_BY'] },
    ],
  },
  ANTITRUST_REGULATORY: {
    layers: 'Every covenant fact carries an EFFORTS_STANDARD component (a flat "agrees to take" is recorded as such) and a MATERIALITY_QUALIFIER when present. Remedy limitations are one LIST with one LIST_ELEMENT per action (sale, divestiture, licence, other disposition; restriction, limitation, condition; commence, participate in, defend). Deadlines are PERIOD components. Present every obligation as its own fact; the pre-product key-provisions page is the guide to the cut (Ben, 2026-09-12).',
    headline: { distinguishing: ['EFFORTS_STANDARD', 'LIST', 'PERIOD'], note: 'the obligation and its standard' },
    rename: { BURDEN: 'REMEDY_LIMITATION', LITIGATION: 'LITIGATION_OBLIGATION', COOPERATION: 'THIRD_PARTY_CONSENTS' },
    add: [
      { subtype_key: 'REMEDY_RESTRICTION', label: 'Restriction on proposing or agreeing to remedies', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'consent_requirement'], relationships: ['QUALIFIES', 'EXCEPTS', 'REQUIRES'] },
    ],
    labels: { EFFORTS: 'Efforts standard', REMEDY_LIMITATION: 'No divestiture, conduct or litigation commitment', LITIGATION_OBLIGATION: 'Obligation to litigate', THIRD_PARTY_CONSENTS: 'Third-party consents', STRATEGY_CONTROL: 'Regulatory strategy control', FILING_DEADLINE: 'Filing deadline', FILING_OBLIGATION: 'Filing obligation', CONSULTATION: 'Consultation right', INFORMATION_SHARING: 'Information sharing', NON_IMPEDIMENT: 'Non-impediment', REGULATORY_REQUEST_RESPONSE: 'Response to regulatory requests', TIMING_AGREEMENT: 'Timing agreement' },
  },
  SPECIFIC_PERFORMANCE_REMEDIES: {
    layers: 'One fact per clause. No timing or qualification is invented; the court is a FORUM component. Track "would occur" versus "may occur" as a STANDARD component.',
    headline: { distinguishing: ['STANDARD', 'FORUM'], note: 'the agreement or waiver and its standard' },
    rename: { GENERAL_EQUITABLE_RELIEF: 'AGREEMENT_TO_EQUITABLE_RELIEF', NON_OBJECTION: 'ADEQUATE_REMEDY_DEFENCE_WAIVER' },
    add: [
      { subtype_key: 'AGREEMENT_OF_IRREPARABLE_DAMAGE', label: 'Agreement of irreparable damage', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM'], relationships: ['QUALIFIES', 'EXTENDS'] },
      { subtype_key: 'CUMULATIVE_RIGHTS', label: 'Rights are cumulative', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM'], relationships: ['QUALIFIES', 'EXTENDS'] },
    ],
    labels: { AGREEMENT_TO_EQUITABLE_RELIEF: 'Agreement to equitable relief', ADEQUATE_REMEDY_DEFENCE_WAIVER: 'Waiver of adequate-remedy defence', BOND_SECURITY_WAIVER: 'Waiver of bond or security', REMEDY_COORDINATION: 'Fee and performance coordination', PAID_FEE_EXCLUSIVE_REMEDY: 'Fee as exclusive remedy', CLOSING_ENFORCEMENT: 'Enforcement of closing', REMEDY_ACTION_EXTENSION: 'Remedy action extension', COST_SHIFT: 'Cost shifting' },
  },
  CLOSING_CONDITIONS: {
    layers: 'Bring-down: one fact per tier. Components: the reps covered (one CROSS_REFERENCE per rep, resolved to the rep heading words), the standard ("in all respects", "in all material respects", "de minimis", MAE), the as-of date rule, and any scrape. A "remaining" or "other representations" tier keeps the words of the text in its headline, and its components carry one resolved CROSS_REFERENCE per representation in the complement so the system knows the standard each representation is brought down to (Ben, 2026-09-12: the rep table shows it). A tax opinion condition carries its exclusions as QUALIFIER components, not separate conditions. A chapeau is never a fact.',
    headline: { distinguishing: ['STANDARD', 'CROSS_REFERENCE'], note: 'the condition and its standard' },
    labels: { BRINGDOWN: 'Bring-down of representations', GENERAL_CLOSING_CONDITION: 'Closing condition', STOCKHOLDER_APPROVAL: 'Stockholder approval', REGULATORY_APPROVAL: 'Regulatory approval', LEGAL_RESTRAINT: 'No legal restraint', S4_EFFECTIVENESS: 'Form S-4 effective', OFFICER_CERTIFICATE: 'Officer certificate', FRUSTRATION: 'No material adverse effect', TAX_OPINION: 'Tax opinion' },
    add: [
      { subtype_key: 'LISTING', label: 'Listing of shares', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS'], relationships: ['QUALIFIES', 'REQUIRES'] },
    ],
  },
  MAE_DEFINITION: {
    layers: 'The definition prong is one fact with components: the affected-matters LITANY, the aggregation standard ("individually or in the aggregate"), the probability standard ("is or would reasonably be expected to be"), the materiality term, the affected-business LIST (business, assets, liabilities, condition, results of operations), and "taken as a whole". Each carve-out is one fact whose distinguishing component is the carve-out subject; list elements are LIST_ELEMENTs with nested inclusions nested. The disproportionality carve-back lists the clauses it applies to as CROSS_REFERENCEs.',
    headline: { distinguishing: ['LIST', 'LIST_ELEMENT', 'TERM'], note: 'the carve-out subject' },
    labels: { DEFINITION_PRONG: 'MAE definition', EXCLUSION: 'MAE carve-out', DISPROPORTIONALITY_CARVEBACK: 'Disproportionate effect carve-back', UNDERLYING_CAUSE_RESTORATION: 'Underlying cause counts', DEFINITION_INSTANCE: 'MAE definition instance' },
  },
  MATERIAL_CONTRACTS: {
    layers: 'Each category is one fact. Components: the category term, each THRESHOLD with its canonical value, each carve-out as EXCEPTION, and the disclosure-letter and SEC-document limitations inherited from the chapeau with origin CHAPEAU. Actor is the Company and its Subsidiaries (and the counterparty where the category names one); object is the contract. Status representations carry the materiality qualifier and knowledge qualifier as components.',
    headline: { distinguishing: ['TERM', 'THRESHOLD', 'EXCEPTION'], note: 'category plus threshold plus carve-out' },
    labels: { MATERIAL_CONTRACT_CATEGORY_CRITERION: 'Material contract category', MATERIAL_CONTRACT_DISCLOSURE_LIST: 'Material contract disclosure', MATERIAL_CONTRACT_STATUS_REPRESENTATION: 'Material contract status', MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT: 'No default under material contracts' },
  },
  PROXY_MEETING: {
    layers: 'Written-consent deals use the consent subtypes; meeting deals use the meeting subtypes. Deadlines are PERIOD or DATE components. Track the Consenting Stockholders identity or percentage as a component. Consent facts do not cross-reference the termination, condition or fee provisions that depend on them (Ben, 2026-09-12).',
    headline: { distinguishing: ['OPERATION', 'DATE', 'PERIOD'], note: 'the mechanic and its deadline' },
    add: [
      { subtype_key: 'WRITTEN_CONSENT_SOLICITATION', label: 'Written consent solicitation', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'consenting_stockholders'], relationships: ['QUALIFIES', 'REQUIRES', 'TRIGGERS'] },
      { subtype_key: 'WRITTEN_CONSENT_DELIVERY', label: 'Written consent delivery', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'consenting_stockholders'], relationships: ['QUALIFIES', 'REQUIRES', 'TRIGGERS'] },
      { subtype_key: 'SUPPORT_AGREEMENT_DELIVERY', label: 'Support agreement delivery', required_roles: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'], optional_roles: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'consenting_stockholders'], relationships: ['QUALIFIES', 'REQUIRES', 'TRIGGERS'] },
    ],
  },
  MISC_BOILERPLATE: {
    coverage_only: true,
    layers: 'Coverage only: shown to the reader as one collapsed, expandable section after the operative families (Ben, 2026-09-12). Every construction rule gets a category label so boilerplate can be compared later.',
    headline: { distinguishing: ['TERM'], note: 'the rule category' },
  },
  REPRESENTATIONS: {
    layers: 'Each representation limb is one fact. Components: the subject, the standard, each materiality or knowledge qualifier, thresholds, look-back periods and carve-outs as separate components; disclosure-letter and SEC-document limitations inherited from the article intro with origin INTRO.',
    headline: { distinguishing: ['TERM', 'THRESHOLD', 'MATERIALITY_QUALIFIER'], note: 'subject plus qualifier plus threshold' },
  },
};

const GENERIC_LAYERS = 'One fact per independently operative unit. Components follow the sentence: actor, operation, object, then each condition, exception, threshold, period and qualifier as its own component; lists that vary between deals as LIST with LIST_ELEMENTs; synonym litanies as one LITANY. Nothing is invented for an absent timing, qualification or forum.';

function transformSubtype(family, subtype) {
  const overlay = OVERLAY[family.family_key] || {};
  const renamed = overlay.rename?.[subtype.subtype_key] || subtype.subtype_key;
  const isGeneric = GENERIC.every((role) => subtype.required_roles.includes(role));
  let required = subtype.required_roles;
  let optional = subtype.optional_roles || [];
  if (isGeneric) {
    required = ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'];
    optional = [...new Set([...optional.filter((r) => !GENERIC.includes(r)), 'TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM'])];
  }
  const roleOverride = overlay.roles?.[subtype.subtype_key];
  if (roleOverride) { required = roleOverride.required_roles; optional = roleOverride.optional_roles; }
  const label = overlay.labels?.[renamed] || titleCase(renamed);
  const out = {
    subtype_key: renamed,
    ...(renamed !== subtype.subtype_key ? { renamed_from: subtype.subtype_key } : {}),
    label,
    ...(subtype.claim_definition_keys ? { claim_definition_keys: subtype.claim_definition_keys } : {}),
    required_roles: required,
    optional_roles: optional,
    ...(COVENANT_FAMILIES.has(family.family_key) ? { standard_components: ['EFFORTS_STANDARD', 'MATERIALITY_QUALIFIER'] } : {}),
    relationships: subtype.relationships,
    ...(roleOverride?.note ? { note: roleOverride.note } : {}),
  };
  return out;
}

function build() {
  const families = v1.families.map((family) => {
    const overlay = OVERLAY[family.family_key] || {};
    const subtypes = family.subtypes.map((subtype) => transformSubtype(family, subtype));
    for (const added of overlay.add || []) subtypes.push({ ...added, added_in: 'V2' });
    const keys = subtypes.map((subtype) => subtype.subtype_key);
    if (new Set(keys).size !== keys.length) throw new Error(`duplicate subtype in ${family.family_key}`);
    return {
      family_key: family.family_key,
      state: family.state,
      coverage_only: overlay.coverage_only === true,
      required_fact_types: family.required_fact_types,
      materiality_rules: overlay.coverage_only
        ? ['Coverage only. Categorise every rule for later comparison; do not show to the reader.']
        : ['Every independently operative unit is captured as one fact with its components. Reader-facing headline: ' + (overlay.headline?.note || 'the operative term and what distinguishes it from other deals') + '.'],
      layer_rules: overlay.layers || GENERIC_LAYERS,
      headline: { label_source: 'subtype_label', distinguishing_kinds: overlay.headline?.distinguishing || ['TERM', 'THRESHOLD', 'STANDARD', 'TRIGGER'], note: overlay.headline?.note || null },
      subtypes,
      summary_grammar: 'Headline: [subtype label]: [distinguishing components]. Layers beneath are verbatim components.',
      compact_omissions: family.compact_omissions,
      absence_semantics: family.absence_semantics,
      prompt_audit: family.prompt_audit,
    };
  });
  return {
    schema_version: 'LEGAL_SCHEMA/V2',
    schema_revision: 'LEGAL_SCHEMA/V2.0',
    based_on: 'LEGAL_SCHEMA/V1.2',
    status: 'DRAFT_FOR_BEN_REVIEW',
    decided: '2026-09-12, Ben: rebuild the fact model as layered components; plan Phase 5B',
    fact_rule: 'A fact is a headline plus an ordered tree of verbatim components (contracts/product/fact-components.v2.json). One independently operative unit is one fact. No role or component is forced: an absent timing, qualification or forum is absent, never invented. The V1 statement and roles are retained for comparison during Phase 5B only.',
    component_contract: 'FACT_COMPONENTS/V2',
    roles: {
      generic_required: ['LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT'],
      generic_optional: ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM'],
      covenant_standard_components: ['EFFORTS_STANDARD', 'MATERIALITY_QUALIFIER'],
      empty_role_allowed: true,
      forbidden_role_text: ['none', 'not applicable', 'n/a', 'none stated', 'section references alone'],
    },
    families,
    coverage: v1.coverage,
    issues: v1.issues,
  };
}

const schema = build();
const target = path.join(__dirname, '../../contracts/product/legal-schema.v2.json');
fs.writeFileSync(target, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`wrote ${target}: ${schema.families.length} families, ${schema.families.reduce((n, f) => n + f.subtypes.length, 0)} subtypes`);
