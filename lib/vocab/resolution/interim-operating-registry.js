'use strict';
const { IOC_CATEGORIES_CANONICAL } = require('../../vocab/ioc-categories');
const { freeze, registryFingerprint } = require('./registry-fingerprint');
const VERSION = 'RESOLUTION_INTERIM_OPERATING_REGISTRY/V1';
const RESTRICTION_CATEGORY_TO_CONCEPT = Object.freeze({
  DIVIDENDS_DISTRIBUTIONS: 'IOC-DIVIDEND',
  ACQUISITIONS_BUSINESS_COMBINATIONS: 'IOC-MERGE',
  DISPOSITIONS_ASSET_SALES: 'IOC-MERGE',
  REAL_ESTATE_LEASES: 'IOC-REALPROP',
  CAPITAL_EXPENDITURES: 'IOC-CAPEX',
  INDEBTEDNESS: 'IOC-DEBT',
  LIENS_ENCUMBRANCES: 'IOC-LIEN',
  EQUITY_ISSUANCES: 'IOC-ISSUE',
  EQUITY_REPURCHASES: 'IOC-REPURCHASE',
  CHARTER_BYLAW_AMENDMENTS: 'IOC-CHARTER',
  ACCOUNTING_CHANGES: 'IOC-ACCOUNTING',
  TAX_ELECTIONS: 'IOC-TAX',
  LITIGATION_SETTLEMENTS: 'IOC-SETTLE',
  MATERIAL_CONTRACTS: 'IOC-CONTRACT',
  IP_LICENSING: 'IOC-IP',
  EMPLOYEE_COMPENSATION: 'IOC-COMP',
  EMPLOYEE_HIRING_TERMINATION: 'IOC-HIRE',
  BENEFIT_PLANS: 'IOC-COMP',
  COLLECTIVE_BARGAINING: 'IOC-COMP',
  INSURANCE: 'IOC-INSURANCE',
  INTERCOMPANY_ARRANGEMENTS: 'IOC-AFFILIATE',
  REGULATORY_FILINGS: 'IOC-REGAUTH',
  DATA_PRIVACY_CYBER: 'IOC-REGAUTH',
  LOANS_INVESTMENTS: 'IOC-DEBT',
  OTHER_ORDINARY_COURSE: 'IOC-ORDINARY',
});

const LEGACY_RESTRICTION_CATEGORY_ALIASES = Object.freeze({
  TAX: Object.freeze({
    canonical_category: 'TAX_ELECTIONS',
    source_quote: 'consent to any extension or waiver of any limitation period with respect to any material Tax claim or assessment',
  }),
  SETTLE: Object.freeze({
    canonical_category: 'INSURANCE',
    source_quote: 'settle any insurance claim, make any election under a Company Lease relating to such casualty or enter into any agreement relating to the restoration of such casualty',
  }),
  COMP: Object.freeze({
    canonical_category: 'EMPLOYEE_COMPENSATION',
    source_quote: 'enter into any change in control, severance or similar agreement or any retention or similar agreement with any officer, employee, director, individual independent contractor, individual consultant, or other individual service provider of the Company Group',
  }),
  MERGE: Object.freeze({
    canonical_category: 'ACQUISITIONS_BUSINESS_COMBINATIONS',
    source_quote: 'merge or consolidate the Company or any Company Subsidiary with any Person or adopt a plan of complete or partial liquidation, dissolution, restructuring, recapitalization or other reorganization of the Company or any Company Subsidiary',
  }),
});

const CATEGORY_TESTS = Object.freeze({
  DIVIDENDS_DISTRIBUTIONS: (quote) => /\bdividends?\b/i.test(quote)
    || /declare, set aside/i.test(quote)
    || /\bredemptions?\b/i.test(quote),
  ACQUISITIONS_BUSINESS_COMBINATIONS: (quote) => /\bmerge with\b/i.test(quote)
    || /\bconsolidation with\b/i.test(quote)
    || /\bmerge or consolidate\b/i.test(quote)
    || /including by merger/i.test(quote)
    || /\bbusiness combinations?\b/i.test(quote)
    || /\bacquisitions?\b/i.test(quote)
    || /\bmergers?\b/i.test(quote)
    || /\bjoint ventures?\b/i.test(quote)
    || /\bacquire control\b/i.test(quote)
    || /acquire a substantial portion of the assets/i.test(quote)
    || /complete any acquisition of any corporation/i.test(quote),
  DISPOSITIONS_ASSET_SALES: (quote) => /\bdispositions?\b/i.test(quote)
    || /\basset sales?\b/i.test(quote)
    || /transfer, sell, lease/i.test(quote),
  REAL_ESTATE_LEASES: (quote) => /\breal estate\b/i.test(quote),
  CAPITAL_EXPENDITURES: (quote) => /\bcapital expenditures?\b/i.test(quote) || /\bcapex\b/i.test(quote),
  INDEBTEDNESS: (quote) => /\bindebtedness\b/i.test(quote) || /\bdebt securities\b/i.test(quote)
    || /\bIndenture\b/.test(quote) || /\bSenior Notes\b/.test(quote),
  LIENS_ENCUMBRANCES: (quote) => /\bliens?\b/i.test(quote) || /\bencumbrances?\b/i.test(quote),
  EQUITY_ISSUANCES: (quote) => /\bissue, (deliver|sell)\b/i.test(quote) || /\bissuance\b/i.test(quote)
    || /\bequity issuances?\b/i.test(quote),
  EQUITY_REPURCHASES: (quote) => /\bequity repurchases?\b/i.test(quote)
    || /\brepurchase.*shares?\b/i.test(quote) || /\bredeem.*shares?\b/i.test(quote),
  CHARTER_BYLAW_AMENDMENTS: (quote) => /certificate of incorporation|certificate of formation|bylaws|governing documents|organizational documents/i.test(quote)
    || /\bcharter\b/i.test(quote),
  ACCOUNTING_CHANGES: (quote) => /accounting (policies|practices|procedures)/i.test(quote) || /\bGAAP\b/.test(quote),
  TAX_ELECTIONS: (quote) => /\bTax elections?\b/.test(quote)
    || /election relating to Taxes/.test(quote)
    || /\bTax Returns?\b/.test(quote)
    || /method of Tax accounting/.test(quote)
    || /\b(?:audit|proceeding) relating to a material Tax\b/.test(quote)
    || /\bmaterial Tax claim(?: or assessment)?\b/.test(quote)
    || /\bTax sharing agreement\b/.test(quote)
    || /\bTax ruling\b/.test(quote),
  LITIGATION_SETTLEMENTS: (quote) => (/\b(settle|compromise)\b/i.test(quote) && /\bActions?\b/.test(quote))
    || /\bwaive any claims\b/i.test(quote)
    || /\blitigation\b/i.test(quote),
  MATERIAL_CONTRACTS: (quote) => /\bMaterial Contract\b/.test(quote),
  IP_LICENSING: (quote) => /\bintellectual property\b/i.test(quote) || /\bIP\b/.test(quote) || /\blicens/i.test(quote),
  EMPLOYEE_COMPENSATION: (quote) => /\bcompensation\b/i.test(quote)
    && !/\bBenefit Plan\b/.test(quote)
    || /\bseverance(?: or termination)? (?:payments|benefits)\b/i.test(quote)
    || /\b(?:change in control|severance|retention)(?: or similar)? agreement\b/i.test(quote),
  EMPLOYEE_HIRING_TERMINATION: (quote) => /\b(?:hire|promote|terminate) the employment\b/i.test(quote)
    || /\bhiring\b/i.test(quote),
  BENEFIT_PLANS: (quote) => /\bBenefit Plan\b/.test(quote) || /\bEmployee Plan\b/.test(quote) || /\bERISA\b/.test(quote),
  COLLECTIVE_BARGAINING: (quote) => /\bcollective bargaining\b/i.test(quote)
    && !/\bBenefit Plan\b/.test(quote),
  INSURANCE: (quote) => /\binsurance\b/i.test(quote),
  INTERCOMPANY_ARRANGEMENTS: (quote) => /\bintercompany\b/i.test(quote)
    || /\baffiliate transaction/i.test(quote),
  REGULATORY_FILINGS: (quote) => /\bregulatory\b/i.test(quote)
    || /\bfilings?\b/i.test(quote) || /\bpermits?\b/i.test(quote),
  DATA_PRIVACY_CYBER: (quote) => /\bprivacy\b/i.test(quote) || /\bcyber\b/i.test(quote) || /\bdata security\b/i.test(quote),
  LOANS_INVESTMENTS: (quote) => /\bloans?\b/i.test(quote) || /\badvances?\b/i.test(quote)
    || /\bcapital contributions?\b/i.test(quote)
    || /\binvestments?\s+in\b/i.test(quote) || /\bmake\s+(?:any\s+)?investments?\b/i.test(quote),
  OTHER_ORDINARY_COURSE: (quote) => /\bordinary course\b/i.test(quote) && !/\bBenefit Plan\b/.test(quote),
});

const V2_CATEGORY_TO_V1_KEYS = Object.freeze(Object.fromEntries(
  IOC_CATEGORIES_CANONICAL.map(({ key }) => [key, Object.freeze([key])]),
));
const SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE = LEGACY_RESTRICTION_CATEGORY_ALIASES.SETTLE.source_quote;
const FINGERPRINT_INPUT_V1 = freeze({ version: VERSION, restriction_category_to_concept: RESTRICTION_CATEGORY_TO_CONCEPT, legacy_restriction_category_aliases: LEGACY_RESTRICTION_CATEGORY_ALIASES, category_tests: Object.fromEntries(Object.entries(CATEGORY_TESTS).map(([key, test]) => [key, test.toString()])), v2_category_to_v1_keys: V2_CATEGORY_TO_V1_KEYS, near_miss_anchor: ['ordinary', 'course'] });
const DIGEST = registryFingerprint(FINGERPRINT_INPUT_V1);
module.exports = freeze({ VERSION, RESTRICTION_CATEGORY_TO_CONCEPT, LEGACY_RESTRICTION_CATEGORY_ALIASES, SETTLE_INSURANCE_CASUALTY_REPLAY_QUOTE, CATEGORY_TESTS, V2_CATEGORY_TO_V1_KEYS, FINGERPRINT_INPUT_V1, DIGEST });
