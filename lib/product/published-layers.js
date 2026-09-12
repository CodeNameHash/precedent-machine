'use strict';

// Groups accepted FACT_COMPONENTS/V2 facts for the published reader view.
// Contract: contracts/product/fact-components.v2.json. Pure function; no
// database or model access. Coverage-only facts (boilerplate) are grouped
// last as collapsed groups (Ben, 2026-09-12: an expandable section).

function groupPublishedFacts(facts, legalSchema) {
  const familyOrder = (legalSchema?.families || []).map((family) => family.family_key);
  const byFamily = new Map();
  const coverageByFamily = new Map();
  for (const fact of facts || []) {
    if (!fact) continue;
    const target = fact.coverage_only ? coverageByFamily : byFamily;
    if (!target.has(fact.family_key)) target.set(fact.family_key, []);
    target.get(fact.family_key).push(fact);
  }
  const ordered = (familyFacts) => [...familyFacts].sort((left, right) => (
    String(left.section_reference || '').localeCompare(String(right.section_reference || ''), undefined, { numeric: true })
  ));
  const groups = [];
  for (const family_key of familyOrder) {
    const familyFacts = byFamily.get(family_key);
    if (!familyFacts || familyFacts.length === 0) continue;
    groups.push({ family_key, collapsed: false, facts: ordered(familyFacts) });
  }
  for (const family_key of familyOrder) {
    const familyFacts = coverageByFamily.get(family_key);
    if (!familyFacts || familyFacts.length === 0) continue;
    groups.push({ family_key, collapsed: true, facts: ordered(familyFacts) });
  }
  return groups;
}

module.exports = { groupPublishedFacts };
