'use strict';

// Groups accepted FACT_COMPONENTS/V2 facts for the published reader view.
// Contract: contracts/product/fact-components.v2.json. Pure function; no
// database or model access.

function groupPublishedFacts(facts, legalSchema) {
  const familyOrder = (legalSchema?.families || []).map((family) => family.family_key);
  const byFamily = new Map();
  for (const fact of facts || []) {
    if (!fact || fact.coverage_only) continue;
    if (!byFamily.has(fact.family_key)) byFamily.set(fact.family_key, []);
    byFamily.get(fact.family_key).push(fact);
  }
  const groups = [];
  for (const family_key of familyOrder) {
    const familyFacts = byFamily.get(family_key);
    if (!familyFacts || familyFacts.length === 0) continue;
    const facts_in_order = [...familyFacts].sort((left, right) => (
      String(left.section_reference || '').localeCompare(String(right.section_reference || ''), undefined, { numeric: true })
    ));
    groups.push({ family_key, facts: facts_in_order });
  }
  return groups;
}

module.exports = { groupPublishedFacts };
