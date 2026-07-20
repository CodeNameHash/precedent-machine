const FAMILY_RULES = Object.freeze({
  ANTI: { types: ['ANTITRUST_REGULATORY'], prefixes: ['ANTI'] },
  COND: { types: ['CLOSING_CONDITION'], prefixes: ['COND'] },
  CONSID: { types: ['CONSIDERATION'], prefixes: ['CONSID'] },
  COV: { types: ['COVENANT_OTHER'], prefixes: ['COV'] },
  EMPBEN: { types: ['EMPLOYEE_BENEFITS'], prefixes: ['EMPBEN'] },
  IOC: { types: ['COVENANT_INTERIM_OPERATING'], prefixes: ['IOC'] },
  MAE: { types: ['MAE'], prefixes: ['MAE'] },
  MISC: { types: ['MISC_BOILERPLATE'], prefixes: ['MISC'] },
  NOSOL: { types: ['COVENANT_NO_SOLICITATION'], prefixes: ['NOSOL'] },
  REP: { types: ['REPRESENTATION', 'MATERIAL_CONTRACT', 'NO_OTHER_REPS'], prefixes: ['REP'] },
  'REP-B': { types: ['REPRESENTATION'], prefixes: ['REP-B'] },
  'REP-T': { types: ['REPRESENTATION', 'MATERIAL_CONTRACT'], prefixes: ['REP-T'] },
  STRUCT: { types: ['STRUCTURE_MECHANICS'], prefixes: ['STRUCT'] },
  TERMF: { types: ['TERMINATION_FEE'], prefixes: ['TERMF'] },
  TERMR: { types: ['TERMINATION_RIGHT'], prefixes: ['TERMR'] },
  VOTE: { types: ['SEC_FILING_MEETING'], prefixes: ['VOTE', 'SEC'] },
});

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function familyRule(family) {
  const key = upper(family);
  return FAMILY_RULES[key] || { types: [key], prefixes: [key] };
}

function provisionTypesForFamily(family) {
  return familyRule(family).types;
}

function cardMatchesFamily(card, family) {
  const rule = familyRule(family);
  const type = upper(card && card.provision_type);
  const subtype = upper(card && card.provision_subtype);
  const familyKey = upper(family);
  if (familyKey === 'REP-B' || familyKey === 'REP-T') {
    return rule.prefixes.some((prefix) => subtype === prefix || subtype.startsWith(`${prefix}-`));
  }
  return rule.types.includes(type)
    || rule.prefixes.some((prefix) => subtype === prefix || subtype.startsWith(`${prefix}-`));
}

module.exports = {
  FAMILY_RULES,
  cardMatchesFamily,
  provisionTypesForFamily,
};
