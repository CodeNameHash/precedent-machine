'use strict';

/*
 * Corroboration ladder shared by replay analysis and the resolver's explicit,
 * opt-in deterministic rung selection. This module does not import the
 * resolver, write set, storage, or serving code. Model rungs remain analysis
 * only because the resolver has no calibrated model-deferral adapter.
 */

const crypto = require('node:crypto');
const {
  corroborateGeneralCovenantCode,
  generalCovenantPrimaryMatchingCodes,
  applyGeneralCovenantSpecificity,
} = require('./general-covenant-corroboration');
const {
  corroborateRestrictionCategory,
  categoryMatches,
  normaliseRestrictionCategory,
  RESTRICTION_CATEGORY_TO_CONCEPT,
} = require('./ioc-corroboration');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../../vocab/resolution/general-covenant-registry');
const { MATERIAL_CONTRACT_BUCKET_META, MATERIAL_CONTRACT_BUCKET_CODES } = require('../../vocab/resolution/material-contract-registry');

const LADDER_VERSION = 'STAGE_2Y_CORROBORATION_LADDER/V1';
const FAMILIES = Object.freeze(['GENERAL_COVENANTS', 'MATERIAL_CONTRACTS', 'INTERIM_OPERATING']);
const RUNGS = Object.freeze(['EXACT_LITERAL', 'NORMALISED_FORM', 'ANCHOR_STEM', 'MODEL_IF_EMPTY', 'MODEL_UNLESS_POSITIVELY_CONTRADICTED']);
const DERIVATIONS = Object.freeze(['MATCH', 'POSITIVE_CONTRADICTION', 'AMBIGUOUS', 'EMPTY', 'INAPPLICABLE']);
const PUBLICATION_DISPOSITION = 'WITHHELD';
const MAX_RUNTIME_CORROBORATION_RUNG = 2;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function declaration(anchors, stems) {
  return Object.freeze({ anchors: Object.freeze(anchors), stems: Object.freeze(stems) });
}

// These are experimental declarations, not a change to the production tables.
const ANCHOR_STEM_DECLARATIONS = freeze({
  version: 'STAGE_2Y_ANCHOR_STEMS/V1',
  GENERAL_COVENANTS: {
    'COV-16B': declaration(['section', '16'], ['short']), 'COV-ACCESS': declaration(['access', 'records'], ['access']),
    'COV-CONSENT': declaration(['consent', 'required'], ['consent']), 'COV-CVR': declaration(['contingent', 'value'], ['conting']),
    'COV-DEBT': declaration(['credit', 'agreement'], ['indebt']), 'COV-DELIST': declaration(['delist'], ['delist']),
    'COV-FDACOMMS': declaration(['food', 'drug'], ['administr']), 'COV-FURTHER': declaration(['further', 'assurances'], ['assur']),
    'COV-INDEMN': declaration(['hold', 'harmless'], ['indemn']), 'COV-LIST': declaration(['listing', 'exchange'], ['list']),
    'COV-LITNOTIFY': declaration(['transaction', 'litigation'], ['litig']), 'COV-MERGESUB': declaration(['merger', 'sub'], ['perform']),
    'COV-NOTIFY': declaration(['prompt', 'notice'], ['notif']), 'COV-PAYAGENT': declaration(['paying', 'agent'], ['agent']),
    'COV-PUBLICITY': declaration(['press', 'release'], ['public']), 'COV-RESIGN': declaration(['director', 'resign'], ['resign']),
    'COV-SECREPORT': declaration(['sec', 'report'], ['report']), 'COV-TAKEOVER': declaration(['takeover', 'law'], ['take']),
  },
  INTERIM_OPERATING: {
    DIVIDENDS_DISTRIBUTIONS: declaration(['dividend'], ['dividend']), ACQUISITIONS_BUSINESS_COMBINATIONS: declaration(['merge'], ['merg']),
    DISPOSITIONS_ASSET_SALES: declaration(['asset', 'sale'], ['sale']), REAL_ESTATE_LEASES: declaration(['real', 'estate'], ['estate']),
    CAPITAL_EXPENDITURES: declaration(['capital', 'expenditure'], ['expend']), INDEBTEDNESS: declaration(['indebtedness'], ['indebt']),
    LIENS_ENCUMBRANCES: declaration(['lien'], ['lien']), EQUITY_ISSUANCES: declaration(['equity', 'issuance'], ['issu']),
    EQUITY_REPURCHASES: declaration(['repurchase', 'share'], ['repurchas']), CHARTER_BYLAW_AMENDMENTS: declaration(['certificate', 'incorporation'], ['incorpor']),
    ACCOUNTING_CHANGES: declaration(['accounting', 'policies'], ['account']), TAX_ELECTIONS: declaration(['tax', 'election'], ['elect']),
    LITIGATION_SETTLEMENTS: declaration(['settle', 'action'], ['settle']), MATERIAL_CONTRACTS: declaration(['material', 'contract'], ['contract']),
    IP_LICENSING: declaration(['intellectual', 'property'], ['licens']), EMPLOYEE_COMPENSATION: declaration(['compensation'], ['compens']),
    EMPLOYEE_HIRING_TERMINATION: declaration(['employment', 'hiring'], ['hir']), BENEFIT_PLANS: declaration(['benefit', 'plan'], ['benefit']),
    COLLECTIVE_BARGAINING: declaration(['collective', 'bargaining'], ['bargain']), INSURANCE: declaration(['insurance'], ['insur']),
    INTERCOMPANY_ARRANGEMENTS: declaration(['intercompany'], ['intercompany']), REGULATORY_FILINGS: declaration(['regulatory', 'filing'], ['fil']),
    DATA_PRIVACY_CYBER: declaration(['data', 'privacy'], ['privacy']), LOANS_INVESTMENTS: declaration(['loan'], ['loan']),
    OTHER_ORDINARY_COURSE: declaration(['ordinary', 'course'], ['ordinary']),
  },
  MATERIAL_CONTRACTS: {
    AGGREGATE_PAYMENTS: declaration(['aggregate', 'payment'], ['payment']), INDEBTEDNESS: declaration(['credit', 'agreement'], ['credit']),
    JV_PARTNERSHIPS: declaration(['joint', 'venture'], ['venture']), MA_AGREEMENTS: declaration(['merger', 'agreement'], ['merg']),
    IP_LICENSES_IN: declaration(['license', 'from'], ['licens']), IP_LICENSES_OUT: declaration(['license', 'to'], ['licens']),
    SUPPLY: declaration(['supply', 'agreement'], ['supply']), MANUFACTURE: declaration(['manufacturing', 'agreement'], ['manufactur']),
    DISTRIBUTION: declaration(['distribution', 'agreement'], ['distribut']), COLLABORATION: declaration(['collaboration'], ['collabor']),
    SETTLEMENT: declaration(['settlement', 'agreement'], ['settlement']), NONCOMPETE: declaration(['non', 'compete'], ['compet']),
    REAL_ESTATE: declaration(['real', 'estate'], ['estate']), EMPLOYMENT_KEY: declaration(['employment', 'agreement'], ['employ']),
    GOVERNMENT_CONTRACTS: declaration(['government', 'contract'], ['government']), AFFILIATE_TRANSACTIONS: declaration(['affiliate', 'transaction'], ['affiliate']),
    EXCLUSIVITY_MFN: declaration(['exclusive'], ['exclus']), CAPEX_COMMITMENTS: declaration(['capital', 'commitment'], ['capital']),
    DATA_PRIVACY: declaration(['data', 'privacy'], ['privacy']), VOTING_REGISTRATION_RIGHTS: declaration(['voting', 'right'], ['vot']),
    SEC_ITEM_601: declaration(['item', '601'], ['item']), IP_DEVELOPMENT: declaration(['intellectual', 'property'], ['develop']),
    SINGLE_SOURCE: declaration(['single', 'source'], ['source']), CRO: declaration(['clinical', 'research'], ['research']),
    MA_ONGOING_OBLIGATIONS: declaration(['merger', 'agreement'], ['ongoing']), ROFR_ROFN: declaration(['right', 'refusal'], ['refusal']),
    HEDGING: declaration(['hedging'], ['hedg']), EMPLOYEE_LOANS: declaration(['employee', 'loan'], ['loan']),
  },
});
const ANCHOR_STEM_DECLARATION_DIGEST = digest(ANCHOR_STEM_DECLARATIONS);

function normaliseForm(text) {
  return text.toLowerCase().replace(/[\u2018\u2019]/g, "'")
    .replace(/\b(?:shall|will|must|agrees?\s+to|is|required\s+to)\b/g, ' shall ')
    .replace(/\b(?:be|been|being)\s+([a-z]+ed)\b/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsWord(text, token) {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i').test(text);
}

function validEvidence(quote, evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || typeof evidence.source_text !== 'string' || !Array.isArray(evidence.spans) || evidence.spans.length !== 1) return false;
  const [span] = evidence.spans;
  if (!span || typeof span !== 'object' || Object.keys(span).sort().join(',') !== 'absolute_end,absolute_start,text_sha256'
    || !Number.isInteger(span.absolute_start) || !Number.isInteger(span.absolute_end)
    || span.absolute_start < 0 || span.absolute_end <= span.absolute_start || typeof span.text_sha256 !== 'string') return false;
  const bytes = Buffer.from(evidence.source_text, 'utf8');
  if (span.absolute_end > bytes.length) return false;
  const excerpt = bytes.subarray(span.absolute_start, span.absolute_end).toString('utf8');
  return excerpt === quote && crypto.createHash('sha256').update(Buffer.from(excerpt, 'utf8')).digest('hex') === span.text_sha256;
}

function validNonCorroborationGates(gates) {
  return gates && typeof gates === 'object' && !Array.isArray(gates)
    && Object.keys(gates).sort().join(',') === 'enum_passed,evidence_passed,structural_passed'
    && gates.structural_passed === true && gates.enum_passed === true && gates.evidence_passed === true;
}

function inapplicable(reason) { return { derivation: 'INAPPLICABLE', matched_codes: [], evidence: [{ kind: 'GATE', text: reason }] }; }
function result(derivation, matchedCodes, evidence) { return { derivation, matched_codes: [...matchedCodes].sort(), evidence }; }

function familyGate(family, claim) {
  const attrs = claim.attributes || {};
  if (Array.isArray(attrs.definition_cross_references) && attrs.definition_cross_references.length) return 'DEFINITION_REFERENCE_UNRESOLVED';
  if (family === 'GENERAL_COVENANTS') {
    const code = attrs.covenant_code;
    if (!Object.hasOwn(GENERAL_COVENANT_FOLLOW_ON_OWNERS, code)) return 'GENERAL_COVENANT_CODE_OUT_OF_ENUM';
    if (attrs.owner_id !== GENERAL_COVENANT_FOLLOW_ON_OWNERS[code]) return 'GENERAL_COVENANT_OWNER_MISMATCH';
    if (claim.canonical_value !== code) return 'GENERAL_COVENANT_CODE_VALUE_MISMATCH';
    return null;
  }
  if (family === 'MATERIAL_CONTRACTS') {
    if (!Object.hasOwn(MATERIAL_CONTRACT_BUCKET_CODES, attrs.bucket_code) || attrs.bucket_code === 'OTHER') return 'MATERIAL_CONTRACT_BUCKET_OUT_OF_ENUM';
    return null;
  }
  const category = normaliseRestrictionCategory(attrs.restriction_category, claim.raw_value);
  if (attrs.assertion_kind !== 'RESTRICTION_PRESENT') return 'IOC_ASSERTION_KIND_OUT_OF_ENUM';
  if (!Object.hasOwn(RESTRICTION_CATEGORY_TO_CONCEPT, category)) return 'RESTRICTION_CATEGORY_OUT_OF_ENUM';
  if ((category === 'ACQUISITIONS_BUSINESS_COMBINATIONS' && /purchasing an equity interest in or portion of the assets|joint venture/i.test(claim.raw_value))
    || (category === 'MATERIAL_CONTRACTS' && /agree, authorize or commit to do any of the foregoing/i.test(claim.raw_value))) return 'IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD';
  return null;
}

function exact(family, quote, code) {
  if (family === 'GENERAL_COVENANTS') {
    const current = corroborateGeneralCovenantCode({ quote, code });
    const matches = applyGeneralCovenantSpecificity(generalCovenantPrimaryMatchingCodes(quote));
    if (matches.length > 1) return result('AMBIGUOUS', matches, [{ kind: 'CURRENT_PATTERN', text: current.reason || 'multiple matches' }]);
    if (matches.length === 1 && matches[0] !== code) return result('POSITIVE_CONTRADICTION', matches, [{ kind: 'CURRENT_PATTERN', text: matches[0] }]);
    return current.outcome === 'RESOLVED' ? result('MATCH', [code], [{ kind: 'CURRENT_PATTERN', text: code }]) : result('EMPTY', [], [{ kind: 'CURRENT_PATTERN', text: current.reason }]);
  }
  if (family === 'INTERIM_OPERATING') {
    const current = corroborateRestrictionCategory({ quote, asserted_category: code }); const matches = categoryMatches(quote);
    if (matches.length > 1) return result('AMBIGUOUS', matches, [{ kind: 'CURRENT_PATTERN', text: current.reason }]);
    if (matches.length === 1 && matches[0] !== code) return result('POSITIVE_CONTRADICTION', matches, [{ kind: 'CURRENT_PATTERN', text: matches[0] }]);
    return current.outcome === 'RESOLVED' ? result('MATCH', [code], [{ kind: 'CURRENT_PATTERN', text: code }]) : result('EMPTY', [], [{ kind: 'CURRENT_PATTERN', text: current.reason }]);
  }
  const matches = Object.entries(MATERIAL_CONTRACT_BUCKET_META).filter(([bucket, meta]) => bucket !== 'OTHER' && (meta.synonyms || []).some((pattern) => pattern.test(quote))).map(([bucket]) => bucket);
  if (matches.includes(code) && matches.length === 1) return result('MATCH', [code], [{ kind: 'CURRENT_PATTERN', text: code }]);
  if (matches.length) return result('AMBIGUOUS', matches, [{ kind: 'CURRENT_PATTERN', text: 'non-exclusive material bucket hits' }]);
  return result('EMPTY', [], [{ kind: 'CURRENT_PATTERN', text: 'no bucket hit' }]);
}

function anchorStem(family, quote, code) {
  const declarations = ANCHOR_STEM_DECLARATIONS[family];
  const matches = Object.entries(declarations).filter(([, item]) => item.anchors.every((anchor) => containsWord(quote, anchor)) && item.stems.some((stem) => containsWord(quote, stem))).map(([key]) => key);
  if (family === 'MATERIAL_CONTRACTS') {
    if (matches.includes(code) && matches.length === 1) return result('MATCH', [code], [{ kind: 'ANCHOR_STEM', text: code }]);
    return matches.length ? result('AMBIGUOUS', matches, [{ kind: 'ANCHOR_STEM', text: 'non-exclusive material bucket hits' }]) : result('EMPTY', [], [{ kind: 'ANCHOR_STEM', text: 'no declared pair' }]);
  }
  const effective = family === 'GENERAL_COVENANTS' ? applyGeneralCovenantSpecificity(matches) : matches;
  if (effective.length > 1) return result('AMBIGUOUS', effective, [{ kind: 'ANCHOR_STEM', text: 'multiple declared pairs' }]);
  if (effective.length === 1 && effective[0] !== code) return result('POSITIVE_CONTRADICTION', effective, [{ kind: 'ANCHOR_STEM', text: effective[0] }]);
  return effective.length ? result('MATCH', [code], [{ kind: 'ANCHOR_STEM', text: code }]) : result('EMPTY', [], [{ kind: 'ANCHOR_STEM', text: 'no declared pair' }]);
}

function rung(number, name, assessment, proposedResolution) {
  return freeze({ rung: number, name, ...assessment, proposed_resolution: proposedResolution, publication_disposition: PUBLICATION_DISPOSITION });
}

function proposed(assessment) { return assessment.derivation === 'MATCH' ? 'RESOLVED' : 'WITHHELD'; }

function preserveStricter(strictAssessment, looserAssessment) {
  return strictAssessment.derivation === 'EMPTY' ? looserAssessment : strictAssessment;
}

function assessDeterministicCorroborationAtRung({ family, quote, code, selected_rung: selectedRung = 0 } = {}) {
  if (!FAMILIES.includes(family)) throw new TypeError('family is not supported by the corroboration ladder');
  if (typeof quote !== 'string' || !quote) throw new TypeError('quote must be a non-empty string');
  if (!Number.isInteger(selectedRung) || selectedRung < 0 || selectedRung > MAX_RUNTIME_CORROBORATION_RUNG) {
    throw new TypeError(`selected_rung must be an integer from 0 through ${MAX_RUNTIME_CORROBORATION_RUNG}`);
  }
  const first = exact(family, quote, code);
  if (selectedRung === 0) return rung(0, RUNGS[0], first, proposed(first));
  const second = preserveStricter(first, exact(family, normaliseForm(quote), code));
  if (selectedRung === 1) return rung(1, RUNGS[1], second, proposed(second));
  const third = preserveStricter(second, anchorStem(family, normaliseForm(quote), code));
  return rung(2, RUNGS[2], third, proposed(third));
}

function criterionIdentity({ deal_key: dealKey, section_reference: sectionReference, candidate } = {}) {
  const claim = candidate && candidate.claim;
  const bucket = claim?.attributes?.bucket_code;
  if (typeof dealKey !== 'string' || !dealKey || typeof sectionReference !== 'string' || !sectionReference
    || typeof claim?.raw_value !== 'string' || !claim.raw_value || typeof bucket !== 'string' || !bucket) {
    throw new TypeError('deal_key, section_reference, candidate.claim.raw_value, and bucket_code are required');
  }
  return digest([dealKey, sectionReference, claim.raw_value, bucket]);
}

function assessCorroborationLadder({ family, candidate, verified_evidence: evidence } = {}) {
  const claim = candidate && candidate.claim;
  if (!FAMILIES.includes(family) || !claim || typeof claim !== 'object' || typeof claim.raw_value !== 'string' || !claim.raw_value) throw new TypeError('family and candidate.claim.raw_value are required');
  const attrs = claim.attributes || {};
  const code = family === 'GENERAL_COVENANTS' ? attrs.covenant_code : family === 'MATERIAL_CONTRACTS' ? attrs.bucket_code : normaliseRestrictionCategory(attrs.restriction_category, claim.raw_value);
  const gate = !validEvidence(claim.raw_value, evidence)
    ? 'INVALID_BYTE_VERIFIED_EVIDENCE'
    : !validNonCorroborationGates(candidate.non_corroboration_gates)
      ? 'NON_CORROBORATION_GATE_FAILED'
      : familyGate(family, claim);
  const first = gate ? inapplicable(gate) : exact(family, claim.raw_value, code);
  const second = gate ? inapplicable(gate) : preserveStricter(first, exact(family, normaliseForm(claim.raw_value), code));
  const third = gate ? inapplicable(gate) : preserveStricter(second, anchorStem(family, normaliseForm(claim.raw_value), code));
  const allEmpty = [first, second, third].every((item) => item.derivation === 'EMPTY');
  const fourth = allEmpty ? result('EMPTY', [], [{ kind: 'MODEL', text: 'empty-only deferral eligible' }]) : third;
  const positive = [first, second, third].find((item) => item.derivation === 'POSITIVE_CONTRADICTION');
  const ambiguous = [first, second, third].find((item) => item.derivation === 'AMBIGUOUS');
  // IOC's existing multi-match hold is a classifier ambiguity, so it cannot
  // become model deferral in this slice. Other family ambiguities are not a
  // positive contradiction at rung 4.
  const iocAmbiguity = family === 'INTERIM_OPERATING' && ambiguous;
  const fifth = positive || iocAmbiguity || gate
    ? (positive || iocAmbiguity || inapplicable(gate))
    : third;
  const rungThreeResolution = allEmpty ? 'MODEL_DEFERRED' : proposed(fourth);
  const rungFourResolution = positive || iocAmbiguity || gate
    ? 'WITHHELD'
    : fifth.derivation === 'MATCH' ? 'RESOLVED' : 'MODEL_DEFERRED';
  return freeze({ schema_version: LADDER_VERSION, family, asserted_code: code || null, ladder_declaration_version: ANCHOR_STEM_DECLARATIONS.version, ladder_declaration_digest: ANCHOR_STEM_DECLARATION_DIGEST, publication_disposition: PUBLICATION_DISPOSITION, rungs: [
    rung(0, RUNGS[0], first, proposed(first)), rung(1, RUNGS[1], second, proposed(second)), rung(2, RUNGS[2], third, proposed(third)),
    rung(3, RUNGS[3], fourth, rungThreeResolution), rung(4, RUNGS[4], fifth, rungFourResolution),
  ] });
}

module.exports = freeze({
  LADDER_VERSION,
  FAMILIES,
  RUNGS,
  DERIVATIONS,
  PUBLICATION_DISPOSITION,
  MAX_RUNTIME_CORROBORATION_RUNG,
  ANCHOR_STEM_DECLARATIONS,
  ANCHOR_STEM_DECLARATION_DIGEST,
  normaliseForm,
  criterionIdentity,
  assessDeterministicCorroborationAtRung,
  assessCorroborationLadder,
});
