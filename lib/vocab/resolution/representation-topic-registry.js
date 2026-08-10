'use strict';

const { canonicalJson, sha256Hex, utf8Slice } = require('../../canonical-v2/canonical-bytes');

const REGISTRY_VERSION = 'REPRESENTATION_TOPIC_REGISTRY/V1';
const NATIVE_LIMB_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';
const CLASSIFIED = 'CLASSIFIED';
const UNCLASSIFIED = 'UNCLASSIFIED';

const UNCLASSIFIED_REASONS = Object.freeze({
  NO_RAW_ANCHOR: 'REPRESENTATION_TOPIC_NO_RAW_ANCHOR',
  NON_HIERARCHICAL_TIE: 'REPRESENTATION_TOPIC_NON_HIERARCHICAL_TIE',
  SUBJECT_RAW_CONFLICT: 'REPRESENTATION_TOPIC_SUBJECT_RAW_CONFLICT',
  CLIPPED_EVIDENCE: 'REPRESENTATION_TOPIC_CLIPPED_EVIDENCE',
  WRONG_FAMILY: 'REPRESENTATION_TOPIC_WRONG_FAMILY',
  WRONG_KEY: 'REPRESENTATION_TOPIC_WRONG_KEY',
  INVALID_EVIDENCE: 'REPRESENTATION_TOPIC_INVALID_EVIDENCE',
});

function rule(id, anchors, subjectAnchors = []) {
  return Object.freeze({ id, anchors: Object.freeze(anchors), subject_anchors: Object.freeze(subjectAnchors) });
}

const TOPIC_RULES = Object.freeze([
  rule('REP_TOPIC_V1_CORPORATE_ORGANISATION', ['duly organized', 'validly existing', 'good standing', 'organizational documents', 'qualified to do business'], ['organisation', 'organization', 'standing', 'governing documents']),
  rule('REP_TOPIC_V1_CAPITALISATION_SECURITIES', ['common stock', '\\bshares?\\b', 'equity awards?', '\\bsecurities\\b', 'stockholder vote', 'beneficial ownership'], ['capital', 'securities', 'stock', 'equity', 'ownership', 'vote']),
  rule('REP_TOPIC_V1_AUTHORITY_ENFORCEABILITY', ['power and authority', 'duly authorized', 'executed and delivered', 'valid and binding', 'enforceable'], ['authority', 'enforceability', 'execution', 'delivery']),
  rule('REP_TOPIC_V1_NONCONTRAVENTION_CONSENTS', ['contravene', 'conflict with', 'default under', 'required.{0,80}consent', 'governmental.{0,80}filing'], ['no violation', 'non-contravention', 'consent', 'approval']),
  rule('REP_TOPIC_V1_SEC_DISCLOSURE', ['\\bsec\\b', 'exchange act', 'securities act', 'proxy statement', 'registration statement', 'form s-4'], ['sec', 'securities filing', 'disclosure', 'proxy']),
  rule('REP_TOPIC_V1_FINANCIAL_REPORTING', ['financial statements', '\\bgaap\\b', 'internal control', 'accounting records', 'audit committee'], ['financial statement', 'financial reporting', 'accounting', 'audit']),
  rule('REP_TOPIC_V1_LIABILITIES', ['\\bliabilities\\b', '\\bobligations\\b', '\\baccrued\\b', 'off-balance-sheet'], ['liabilities', 'obligations']),
  rule('REP_TOPIC_V1_BUSINESS_CONDUCT_CHANGES', ['ordinary course', 'absence of.{0,100}changes', 'material adverse effect', 'conduct of business'], ['ordinary course', 'changes', 'business conduct']),
  rule('REP_TOPIC_V1_COMPLIANCE_PERMITS', ['compliance with.{0,100}law', '\\bpermits?\\b', '\\bauthori[sz]ation\\b', '\\blicen[sc]e\\b', 'notice of noncompliance'], ['compliance', 'permit', 'licence', 'license']),
  rule('REP_TOPIC_V1_LITIGATION_ORDERS', ['\\bproceeding\\b', '\\blitigation\\b', 'action or claim', '\\bjudg(?:ment|ments)\\b', '\\border\\b'], ['litigation', 'proceeding', 'claim', 'order']),
  rule('REP_TOPIC_V1_TAX', ['tax return', '\\btaxes\\b', 'tax lien', 'tax audit', 'section 355', '\\bfirpta\\b'], ['tax', 'firpta']),
  rule('REP_TOPIC_V1_EMPLOYMENT_BENEFITS', ['employee plan', '\\berisa\\b', '\\bemployee\\b', '\\blabor\\b', '\\bunion\\b', 'section 409a'], ['employee', 'benefit', 'labour', 'labor', 'erisa']),
  rule('REP_TOPIC_V1_ENVIRONMENTAL', ['environmental law', '\\bhazardous\\b', '\\brelease\\b', '\\bcontaminated\\b', 'environmental permit'], ['environmental', 'hazardous']),
  rule('REP_TOPIC_V1_INTELLECTUAL_PROPERTY', ['intellectual property', '\\bpatent\\b', 'trade secret', '\\binfringement\\b', 'ip license'], ['intellectual property', 'patent', 'trade secret', 'infringement']),
  rule('REP_TOPIC_V1_DATA_PRIVACY_TECHNOLOGY', ['personal information', 'personal data', 'data breach', '\\bcyber\\b', 'company systems', '\\bhipaa\\b'], ['privacy', 'data', 'cyber', 'technology', 'systems']),
  rule('REP_TOPIC_V1_REAL_PROPERTY', ['real property', '\\bleases?\\b', 'rights-of-way', '\\bcondemnation\\b', '\\bleasehold\\b'], ['real property', 'lease', 'rights-of-way']),
  rule('REP_TOPIC_V1_MATERIAL_CONTRACTS', ['material contract', 'specified contract', 'contract.{0,80}default', 'termination notice'], ['material contract', 'contracts']),
  rule('REP_TOPIC_V1_INSURANCE', ['insurance policy', '\\bcoverage\\b', '\\bpremium\\b', 'cancellation notice'], ['insurance', 'coverage']),
  rule('REP_TOPIC_V1_RELATED_PARTIES_ADVISERS', ['\\bbroker\\b', 'financial advisor', 'fairness opinion', 'related party'], ['broker', 'adviser', 'advisor', 'fairness', 'related party']),
  rule('REP_TOPIC_V1_ANTI_CORRUPTION_TRADE', ['anti-corruption', '\\bsanctions\\b', 'money laundering', 'trade controls', 'restricted party'], ['anti-corruption', 'sanctions', 'money laundering', 'trade']),
  rule('REP_TOPIC_V1_REGULATED_PRODUCTS', ['clinical trial', '\\bfda\\b', '\\bind\\b', 'health care submission', '\\bdebarment\\b'], ['clinical', 'fda', 'health care', 'healthcare', 'regulated product']),
  rule('REP_TOPIC_V1_GOVERNMENT_CONTRACTS', ['government contract', '\\bbids?\\b', 'facility security clearance', 'classified information', 'cost or pricing'], ['government contract', 'procurement', 'clearance']),
  rule('REP_TOPIC_V1_FINANCING', ['commitment letter', 'debt financing', 'equity commitment', '\\bguaranty\\b', '\\bsolvency\\b', 'sufficient funds'], ['financing', 'commitment', 'guaranty', 'solvency']),
  rule('REP_TOPIC_V1_CUSTOMERS_SUPPLIERS', ['top customer', 'top supplier', 'ceased.{0,80}supply', 'relationship.{0,80}purchase'], ['customer', 'supplier', 'supply']),
  rule('REP_TOPIC_V1_TRANSACTION_PROCESS', ['board recommendation', 'merger sub', 'consummation of the merger', 'transaction.{0,80}approval'], ['board', 'recommendation', 'merger', 'transaction process']),
]);

const CODE_BY_RULE_ID = Object.freeze(Object.fromEntries(TOPIC_RULES.map((entry) => [entry.id, entry.id.replace('REP_TOPIC_V1_', '')])));
const PRECEDENCE = Object.freeze([
  ['TAX', 'LIABILITIES'], ['EMPLOYMENT_BENEFITS', 'LIABILITIES'],
  ['TAX', 'COMPLIANCE_PERMITS'], ['EMPLOYMENT_BENEFITS', 'COMPLIANCE_PERMITS'],
  ['ENVIRONMENTAL', 'COMPLIANCE_PERMITS'], ['INTELLECTUAL_PROPERTY', 'COMPLIANCE_PERMITS'],
  ['DATA_PRIVACY_TECHNOLOGY', 'COMPLIANCE_PERMITS'], ['ANTI_CORRUPTION_TRADE', 'COMPLIANCE_PERMITS'],
  ['REGULATED_PRODUCTS', 'COMPLIANCE_PERMITS'], ['GOVERNMENT_CONTRACTS', 'COMPLIANCE_PERMITS'],
  ['GOVERNMENT_CONTRACTS', 'MATERIAL_CONTRACTS'], ['CUSTOMERS_SUPPLIERS', 'MATERIAL_CONTRACTS'],
  ['FINANCING', 'CAPITALISATION_SECURITIES'], ['CAPITALISATION_SECURITIES', 'CORPORATE_ORGANISATION'],
  ['AUTHORITY_ENFORCEABILITY', 'CORPORATE_ORGANISATION'], ['NONCONTRAVENTION_CONSENTS', 'AUTHORITY_ENFORCEABILITY'],
  ['SEC_DISCLOSURE', 'CAPITALISATION_SECURITIES'],
  ['DATA_PRIVACY_TECHNOLOGY', 'INTELLECTUAL_PROPERTY'],
]);
const SUBJECT_TIE_BREAKS = Object.freeze([
  ['SEC_DISCLOSURE', 'FINANCIAL_REPORTING'],
  ['LIABILITIES', 'FINANCIAL_REPORTING'],
  ['LIABILITIES', 'EMPLOYMENT_BENEFITS'],
]);
const EXCLUSIONS = Object.freeze([
  Object.freeze({ id: 'REP_TOPIC_V1_EXCLUDE_MAE_DEFINITION', codes: Object.freeze(['BUSINESS_CONDUCT_CHANGES']), anchors: Object.freeze(['material adverse effect means', 'definition of material adverse effect']) }),
  Object.freeze({ id: 'REP_TOPIC_V1_EXCLUDE_ADVISER_FEE_DISCLOSURE', codes: Object.freeze(['RELATED_PARTIES_ADVISERS']), anchors: Object.freeze(['adviser fee', 'advisor fee']) }),
]);
const NEAR_MISS_ANCHORS = Object.freeze({
  CORPORATE_ORGANISATION: ['organised', 'incorporated'], CAPITALISATION_SECURITIES: ['equity'],
  AUTHORITY_ENFORCEABILITY: ['authority'], NONCONTRAVENTION_CONSENTS: ['consent'],
  SEC_DISCLOSURE: ['filing'], FINANCIAL_REPORTING: ['financial'], LIABILITIES: ['liable'],
  BUSINESS_CONDUCT_CHANGES: ['business'], COMPLIANCE_PERMITS: ['lawful'], LITIGATION_ORDERS: ['dispute'],
  TAX: ['tax'], EMPLOYMENT_BENEFITS: ['benefits'], ENVIRONMENTAL: ['environment'],
  INTELLECTUAL_PROPERTY: ['intellectual'], DATA_PRIVACY_TECHNOLOGY: ['privacy'], REAL_PROPERTY: ['property'],
  MATERIAL_CONTRACTS: ['contract'], INSURANCE: ['insurance'], RELATED_PARTIES_ADVISERS: ['adviser'],
  ANTI_CORRUPTION_TRADE: ['corruption'], REGULATED_PRODUCTS: ['regulatory'], GOVERNMENT_CONTRACTS: ['government'],
  FINANCING: ['funding'], CUSTOMERS_SUPPLIERS: ['customer'], TRANSACTION_PROCESS: ['transaction'],
});

const REGISTRY_PAYLOAD = Object.freeze({ schema_version: REGISTRY_VERSION, native_limb_key: NATIVE_LIMB_KEY, topic_rules: TOPIC_RULES, exclusions: EXCLUSIONS, precedence: PRECEDENCE, subject_tie_breaks: SUBJECT_TIE_BREAKS, near_miss_anchors: NEAR_MISS_ANCHORS });
const REGISTRY_DIGEST = sha256Hex(canonicalJson(REGISTRY_PAYLOAD));
const VERSION = REGISTRY_VERSION;
const DIGEST = `sha256:${REGISTRY_DIGEST}`;

function normaliseForMatching(value) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();
}
function testAnchor(text, anchor) { return new RegExp(anchor, 'u').test(text); }
function pairKey(left, right) { return [left, right].sort().join('\0'); }
const PRECEDENCE_SET = new Set(PRECEDENCE.map(([specific, general]) => `${specific}\0${general}`));
const SUBJECT_TIE_SET = new Set(SUBJECT_TIE_BREAKS.map(([left, right]) => pairKey(left, right)));

function invalidEvidence(evidence, rawValue) {
  const sourceText = evidence?.source_text ?? evidence?.text ?? evidence?.canonical_text;
  const spans = evidence?.spans ?? evidence?.evidence;
  if (typeof sourceText !== 'string' || !Array.isArray(spans) || spans.length !== 1) return true;
  const span = spans[0];
  const start = span?.absolute_start ?? span?.start;
  const end = span?.absolute_end ?? span?.end;
  try { return utf8Slice(sourceText, start, end) !== rawValue; } catch { return true; }
}
function result(fields) { return Object.freeze({ registry_version: REGISTRY_VERSION, registry_digest: REGISTRY_DIGEST, model_calls: 0, ...fields }); }
function unclassified(reason, matchedRuleIds = []) { return result({ state: UNCLASSIFIED, canonical_value: null, reason, matched_rule_ids: Object.freeze([...matchedRuleIds].sort()), topic_match_rule_id: null }); }
function ruleMatches(text) {
  return TOPIC_RULES.map((entry) => ({ entry, matched: entry.anchors.filter((anchor) => testAnchor(text, anchor)) }))
    .filter((item) => item.matched.length > 0)
    .filter((item) => !EXCLUSIONS.some((exclusion) => exclusion.codes.includes(CODE_BY_RULE_ID[item.entry.id]) && exclusion.anchors.some((anchor) => testAnchor(text, anchor))));
}
function subjectRuleMatches(text) {
  if (!text) return [];
  return TOPIC_RULES.map((entry) => ({ entry, matched: entry.subject_anchors.filter((anchor) => testAnchor(text, anchor)) }))
    .filter((item) => item.matched.length > 0);
}
function removeGeneralMatches(matches) {
  const codes = new Set(matches.map((item) => CODE_BY_RULE_ID[item.entry.id]));
  return matches.filter((item) => ![...codes].some((specific) => PRECEDENCE_SET.has(`${specific}\0${CODE_BY_RULE_ID[item.entry.id]}`)));
}
function selectedRule(matches) {
  return matches.length === 1 ? matches[0] : null;
}
function sameRule(left, right) {
  return left?.entry.id === right?.entry.id;
}
function matchedRuleIds(matches) {
  return [...new Set(matches.map((item) => item.entry.id))];
}
function subjectCanBreakRawTie(rawMatches, subjectSelected) {
  if (rawMatches.length !== 2 || !subjectSelected) return false;
  const codes = rawMatches.map((item) => CODE_BY_RULE_ID[item.entry.id]);
  return SUBJECT_TIE_SET.has(pairKey(...codes))
    && rawMatches.some((item) => sameRule(item, subjectSelected));
}

function classifyRepresentationTopic({ subject = null, raw_value, family, generic_claim_key, claim_definition_key, evidence } = {}) {
  const key = generic_claim_key ?? claim_definition_key;
  if (family !== 'REPRESENTATIONS') return unclassified(UNCLASSIFIED_REASONS.WRONG_FAMILY);
  if (key !== NATIVE_LIMB_KEY) return unclassified(UNCLASSIFIED_REASONS.WRONG_KEY);
  if (typeof raw_value !== 'string' || raw_value.trim().length === 0 || invalidEvidence(evidence, raw_value)) return unclassified(UNCLASSIFIED_REASONS.INVALID_EVIDENCE);
  if (evidence?.clipped === true || evidence?.is_clipped === true || /^\s*(?:\.\.\.|…)/u.test(raw_value) || /(?:\.\.\.|…)\s*$/u.test(raw_value)) return unclassified(UNCLASSIFIED_REASONS.CLIPPED_EVIDENCE);
  const rawSurviving = removeGeneralMatches(ruleMatches(normaliseForMatching(raw_value)));
  const subjectSurviving = removeGeneralMatches(subjectRuleMatches(normaliseForMatching(subject)));
  const rawSelected = selectedRule(rawSurviving);
  const subjectSelected = selectedRule(subjectSurviving);
  if (!rawSurviving.length && !subjectSurviving.length) return unclassified(UNCLASSIFIED_REASONS.NO_RAW_ANCHOR);
  if (rawSelected && subjectSelected && !sameRule(rawSelected, subjectSelected)) {
    return unclassified(UNCLASSIFIED_REASONS.SUBJECT_RAW_CONFLICT, [rawSelected.entry.id, subjectSelected.entry.id]);
  }
  if (rawSurviving.length > 1 && subjectSelected && !rawSurviving.some((item) => sameRule(item, subjectSelected))) {
    return unclassified(UNCLASSIFIED_REASONS.SUBJECT_RAW_CONFLICT, [...rawSurviving.map((item) => item.entry.id), subjectSelected.entry.id]);
  }
  const selected = rawSelected
    || (rawSurviving.length === 0 ? subjectSelected : null)
    || (subjectCanBreakRawTie(rawSurviving, subjectSelected) ? subjectSelected : null);
  if (!selected) {
    return unclassified(UNCLASSIFIED_REASONS.NON_HIERARCHICAL_TIE, matchedRuleIds([...rawSurviving, ...subjectSurviving]));
  }
  if (rawSurviving.length > 1 && subjectCanBreakRawTie(rawSurviving, subjectSelected)) {
    const subjectSelectionInRaw = rawSurviving.find((item) => sameRule(item, subjectSelected));
    if (subjectSelectionInRaw) {
      const code = CODE_BY_RULE_ID[subjectSelectionInRaw.entry.id];
      return result({ state: CLASSIFIED, canonical_value: code, reason: null, matched_rule_ids: Object.freeze(rawSurviving.map((item) => item.entry.id).sort()), topic_match_rule_id: subjectSelectionInRaw.entry.id, raw_anchor_matches: Object.freeze(subjectSelectionInRaw.matched.sort()), subject_corroborated: true });
    }
  }
  const code = CODE_BY_RULE_ID[selected.entry.id];
  const rawMatch = rawSurviving.find((item) => sameRule(item, selected));
  return result({ state: CLASSIFIED, canonical_value: code, reason: null, matched_rule_ids: Object.freeze((rawSurviving.length ? rawSurviving : subjectSurviving).map((item) => item.entry.id).sort()), topic_match_rule_id: selected.entry.id, raw_anchor_matches: Object.freeze((rawMatch?.matched || []).sort()), subject_corroborated: subjectSurviving.some((item) => sameRule(item, selected)) });
}

module.exports = Object.freeze({
  VERSION, DIGEST, REGISTRY_VERSION, REGISTRY_DIGEST, NATIVE_LIMB_KEY, CLASSIFIED, UNCLASSIFIED, UNCLASSIFIED_REASONS,
  TOPIC_RULES, EXCLUSIONS, PRECEDENCE, SUBJECT_TIE_BREAKS, NEAR_MISS_ANCHORS, normaliseForMatching, classifyRepresentationTopic,
});
