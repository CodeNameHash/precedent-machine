const IOC_CATEGORIES_CANONICAL = [
  { key: 'DIVIDENDS_DISTRIBUTIONS', label: 'Dividends & distributions' },
  { key: 'ACQUISITIONS_BUSINESS_COMBINATIONS', label: 'Acquisitions & business combinations' },
  { key: 'DISPOSITIONS_ASSET_SALES', label: 'Dispositions & asset sales' },
  { key: 'REAL_ESTATE_LEASES', label: 'Real estate & leases' },
  { key: 'CAPITAL_EXPENDITURES', label: 'Capital expenditures' },
  { key: 'INDEBTEDNESS', label: 'Indebtedness' },
  { key: 'LIENS_ENCUMBRANCES', label: 'Liens & encumbrances' },
  { key: 'EQUITY_ISSUANCES', label: 'Equity issuances' },
  { key: 'EQUITY_REPURCHASES', label: 'Equity repurchases' },
  { key: 'CHARTER_BYLAW_AMENDMENTS', label: 'Charter/bylaw amendments' },
  { key: 'ACCOUNTING_CHANGES', label: 'Accounting changes' },
  { key: 'TAX_ELECTIONS', label: 'Tax elections' },
  { key: 'LITIGATION_SETTLEMENTS', label: 'Litigation settlements' },
  { key: 'MATERIAL_CONTRACTS', label: 'Material contracts' },
  { key: 'IP_LICENSING', label: 'IP licensing' },
  { key: 'EMPLOYEE_COMPENSATION', label: 'Employee compensation' },
  { key: 'EMPLOYEE_HIRING_TERMINATION', label: 'Hiring & termination' },
  { key: 'BENEFIT_PLANS', label: 'Benefit plans' },
  { key: 'COLLECTIVE_BARGAINING', label: 'Collective bargaining' },
  { key: 'INSURANCE', label: 'Insurance' },
  { key: 'INTERCOMPANY_ARRANGEMENTS', label: 'Intercompany arrangements' },
  { key: 'REGULATORY_FILINGS', label: 'Regulatory filings' },
  { key: 'DATA_PRIVACY_CYBER', label: 'Data privacy & cyber' },
  { key: 'LOANS_INVESTMENTS', label: 'Loans & investments' },
  { key: 'OTHER_ORDINARY_COURSE', label: 'Other - ordinary course' },
];

const IOC_CATEGORY_BY_KEY = Object.fromEntries(
  IOC_CATEGORIES_CANONICAL.map((entry) => [entry.key, entry]),
);

const HEADING_TO_IOC_CATEGORY = [
  { pattern: /\bdividends?\b|\bdistributions?\b|\bredemptions?\b|\brepurchases?\b/i, key: 'DIVIDENDS_DISTRIBUTIONS' },
  { pattern: /\bacquisitions?\b|\bmergers?\b|\bconsolidations?\b|\bbusiness combinations?\b|\bjoint ventures?\b/i, key: 'ACQUISITIONS_BUSINESS_COMBINATIONS' },
  { pattern: /\bdispositions?\b|\basset sales?\b|\bsales? of assets?\b/i, key: 'DISPOSITIONS_ASSET_SALES' },
  { pattern: /\breal estate\b|\bleases?\b/i, key: 'REAL_ESTATE_LEASES' },
  { pattern: /\bcapital expenditures?\b|\bcapex\b/i, key: 'CAPITAL_EXPENDITURES' },
  { pattern: /\bindebtedness\b|\bdebt\b|\bborrowings?\b/i, key: 'INDEBTEDNESS' },
  { pattern: /\bliens?\b|\bencumbrances?\b/i, key: 'LIENS_ENCUMBRANCES' },
  { pattern: /\bequity issuances?\b|\bissuance of.*shares?\b|\bcapital stock\b/i, key: 'EQUITY_ISSUANCES' },
  { pattern: /\bequity repurchases?\b|\brepurchase.*shares?\b|\bredeem.*shares?\b/i, key: 'EQUITY_REPURCHASES' },
  { pattern: /\bcharter\b|\bbylaws?\b|\borganizational documents?\b/i, key: 'CHARTER_BYLAW_AMENDMENTS' },
  { pattern: /\baccounting\b/i, key: 'ACCOUNTING_CHANGES' },
  { pattern: /\btax\b|\btaxes\b/i, key: 'TAX_ELECTIONS' },
  { pattern: /\blitigation\b|\bsettlements?\b|\bclaims?\b/i, key: 'LITIGATION_SETTLEMENTS' },
  { pattern: /\bmaterial contracts?\b|\bcontracts?\b/i, key: 'MATERIAL_CONTRACTS' },
  { pattern: /\bintellectual property\b|\bIP\b|\blicens/i, key: 'IP_LICENSING' },
  { pattern: /\bcompensation\b|\bsalary\b|\bbonus\b|\bequity awards?\b/i, key: 'EMPLOYEE_COMPENSATION' },
  { pattern: /\bhiring\b|\btermination\b|\bemployees?\b|\bofficers?\b/i, key: 'EMPLOYEE_HIRING_TERMINATION' },
  { pattern: /\bbenefit plans?\b|\bemployee plans?\b|\bERISA\b/i, key: 'BENEFIT_PLANS' },
  { pattern: /\bcollective bargaining\b|\bunion\b|\blabor agreement\b/i, key: 'COLLECTIVE_BARGAINING' },
  { pattern: /\binsurance\b/i, key: 'INSURANCE' },
  { pattern: /\baffiliate\b|\bintercompany\b/i, key: 'INTERCOMPANY_ARRANGEMENTS' },
  { pattern: /\bregulatory\b|\bfilings?\b|\bpermits?\b/i, key: 'REGULATORY_FILINGS' },
  { pattern: /\bprivacy\b|\bcyber\b|\bdata security\b/i, key: 'DATA_PRIVACY_CYBER' },
  // Appended last (never overrides an earlier, more specific rule — e.g. a
  // clause pairing "investments in ... Person" with "acquisition" still
  // resolves to ACQUISITIONS_BUSINESS_COMBINATIONS above). Guards against
  // the CAPITAL_EXPENDITURES overlap by requiring "capital contributions"
  // (not bare "capital") — a capex-only clause never matches this.
  { pattern: /\bloans?\b|\badvances?\b|\bcapital contributions?\b|\binvestments?\s+in\b|\bmake\s+(?:any\s+)?investments?\b/i, key: 'LOANS_INVESTMENTS' },
];

function canonicalIocCategoryFromHeading(heading) {
  const text = String(heading || '').trim();
  if (!text) return null;
  const hit = HEADING_TO_IOC_CATEGORY.find((entry) => entry.pattern.test(text));
  return hit ? hit.key : null;
}

function iocCategoryLabel(key) {
  return (IOC_CATEGORY_BY_KEY[key] && IOC_CATEGORY_BY_KEY[key].label) || IOC_CATEGORY_BY_KEY.OTHER_ORDINARY_COURSE.label;
}

module.exports = {
  IOC_CATEGORIES_CANONICAL,
  IOC_CATEGORY_BY_KEY,
  HEADING_TO_IOC_CATEGORY,
  canonicalIocCategoryFromHeading,
  iocCategoryLabel,
};
