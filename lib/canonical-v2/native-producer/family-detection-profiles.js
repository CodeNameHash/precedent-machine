'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { listRegisteredSectionFamilies } = require('./producer-prompt-registry');

const DRAFT_DETECTION_PROFILE_SCHEMA = 'NATIVE_FAMILY_DRAFT_DETECTION_PROFILE/V1';
const DRAFT_DETECTION_PROFILE_VERSION = 1;

const PROFILE_TERMS = Object.freeze({
  ANTITRUST_REGULATORY: Object.freeze({ heading_terms: ['antitrust', 'approvals', 'consents', 'filings', 'regulatory'], lexical_terms: ['antitrust', 'competition authority', 'consent', 'filing', 'hsr', 'regulatory approval'] }),
  APPRAISAL_DISSENTERS_RIGHTS: Object.freeze({ heading_terms: ['appraisal', 'dissenting'], lexical_terms: ['appraisal rights', 'dissenting shares', 'dissenters rights', 'section 262'] }),
  CAPITALISATION: Object.freeze({ heading_terms: ['capitalisation', 'capitalization'], lexical_terms: ['capital stock', 'fully diluted', 'issued and outstanding', 'outstanding shares'] }),
  CLOSING_CONDITIONS: Object.freeze({ heading_terms: ['conditions', 'condition precedent'], lexical_terms: ['condition to', 'conditions precedent', 'closing condition'] }),
  CONSIDERATION: Object.freeze({ heading_terms: ['consideration', 'conversion', 'treatment'], lexical_terms: ['per share', 'merger consideration', 'exchange ratio', 'right to receive'] }),
  DIVIDENDS: Object.freeze({ heading_terms: ['dividend', 'dividends'], lexical_terms: ['dividend', 'distribution', 'record date'] }),
  DNO_INDEMNIFICATION: Object.freeze({ heading_terms: ['d&o', 'director', 'indemnification', 'officer'], lexical_terms: ['advancement of expenses', 'director and officer', 'indemnify and hold harmless', 'tail policy'] }),
  EMPLOYEE_MATTERS: Object.freeze({ heading_terms: ['employee', 'employment', 'personnel'], lexical_terms: ['company employee', 'employee benefit', 'employees', 'employment'] }),
  FINANCING_COVENANTS: Object.freeze({ heading_terms: ['financing', 'payoff'], lexical_terms: ['debt financing', 'financing commitment', 'financing source', 'marketing period'] }),
  GENERAL_COVENANTS: Object.freeze({ heading_terms: ['access', 'announcements', 'covenants', 'publicity'], lexical_terms: ['access to information', 'further assurances', 'public announcement', 'publicity'] }),
  GUARANTY_FINANCING_PARTY: Object.freeze({ heading_terms: ['guaranty', 'guarantee'], lexical_terms: ['financing source', 'guarantor', 'limited guarantee', 'performance guaranty'] }),
  INTERIM_OPERATING: Object.freeze({ heading_terms: ['conduct', 'interim', 'operations'], lexical_terms: ['ordinary course', 'prior written consent', 'shall not', 'until the effective time'] }),
  KEY_DEFINED_TERMS: Object.freeze({ heading_terms: ['definitions', 'defined terms'], lexical_terms: ['"acquisition proposal"', 'means', 'superior proposal', 'willful breach'] }),
  MAE_DEFINITION: Object.freeze({ heading_terms: ['material adverse', 'mae'], lexical_terms: ['material adverse effect', 'material adverse change', 'mae'] }),
  MATERIAL_CONTRACTS: Object.freeze({ heading_terms: ['contract', 'contracts'], lexical_terms: ['material contract', 'material contracts', 'scheduled contract'] }),
  MERGER_STRUCTURE_CLOSING: Object.freeze({ heading_terms: ['closing', 'effective time', 'merger'], lexical_terms: ['certificate of merger', 'effective time', 'surviving corporation'] }),
  MISC_BOILERPLATE: Object.freeze({ heading_terms: ['assignment', 'governing law', 'notices'], lexical_terms: ['counterparts', 'governing law', 'notices', 'successors and assigns'] }),
  NO_OTHER_REPS_FRAUD: Object.freeze({ heading_terms: ['non-reliance', 'representations'], lexical_terms: ['fraud', 'no other representations', 'non-reliance', 'solely on'] }),
  NO_SHOP: Object.freeze({ heading_terms: ['no shop', 'no solicitation', 'non-solicitation'], lexical_terms: ['acquisition proposal', 'no solicitation', 'superior proposal'] }),
  PROXY_MEETING: Object.freeze({ heading_terms: ['meeting', 'proxy'], lexical_terms: ['proxy statement', 'stockholder meeting', 'stockholder vote'] }),
  REPRESENTATIONS: Object.freeze({ heading_terms: ['representations', 'warranties'], lexical_terms: ['represents and warrants', 'representation and warranty'] }),
  SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze({ heading_terms: ['remedies', 'specific performance'], lexical_terms: ['equitable relief', 'specific performance', 'sole and exclusive remedy'] }),
  TAX_MATTERS: Object.freeze({ heading_terms: ['tax', 'tax matters'], lexical_terms: ['tax return', 'taxes', 'tax opinion'] }),
  TERMINATION: Object.freeze({ heading_terms: ['termination', 'terminating'], lexical_terms: ['outside date', 'right to terminate', 'terminate this agreement'] }),
  TERMINATION_FEE: Object.freeze({ heading_terms: ['break-up', 'fee', 'termination fee'], lexical_terms: ['expense reimbursement', 'termination fee', 'termination payment'] }),
});

function exactTerms(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((term) => typeof term === 'string' && term.trim() === term && term.length > 0)
    && new Set(value).size === value.length;
}

function profileFor(familyId) {
  const terms = PROFILE_TERMS[familyId];
  if (!terms || !exactTerms(terms.heading_terms) || !exactTerms(terms.lexical_terms)) return null;
  const body = {
    schema_version: DRAFT_DETECTION_PROFILE_SCHEMA,
    profile_id: `DRAFT_FAMILY:${familyId}`,
    profile_version: DRAFT_DETECTION_PROFILE_VERSION,
    family_id: familyId,
    heading_terms: Object.freeze([...terms.heading_terms].sort()),
    lexical_terms: Object.freeze([...terms.lexical_terms].sort()),
  };
  return Object.freeze({ ...body, profile_digest: contentId(DRAFT_DETECTION_PROFILE_SCHEMA, body) });
}

function getFamilyDetectionProfile(familyId) {
  return profileFor(familyId);
}

function listFamilyDetectionProfiles() {
  const registered = listRegisteredSectionFamilies();
  const profiles = registered.map((familyId) => profileFor(familyId));
  if (profiles.some((profile) => profile === null)
    || Object.keys(PROFILE_TERMS).some((familyId) => !registered.includes(familyId))) {
    throw new Error('family detection profiles must cover exactly the registered producer families');
  }
  return Object.freeze(profiles);
}

module.exports = {
  DRAFT_DETECTION_PROFILE_SCHEMA,
  DRAFT_DETECTION_PROFILE_VERSION,
  getFamilyDetectionProfile,
  listFamilyDetectionProfiles,
};
