const {
  addPhrase,
  fetchProvisions,
  featuresOf,
  writeReport,
} = require('./_shared');

function collectFromFeature(map, value, context) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectFromFeature(map, item, context));
    return;
  }
  if (typeof value === 'object') {
    if (value.code && /OTHER|SPECIFIC|FREEFORM/i.test(String(value.code))) addPhrase(map, value, context);
    if (value.other) collectFromFeature(map, value.other, context);
    if (value.otherSpecific) collectFromFeature(map, value.otherSpecific, context);
    if (value.other_specific) collectFromFeature(map, value.other_specific, context);
    return;
  }
  addPhrase(map, value, context);
}

async function main() {
  const { rows, note } = await fetchProvisions(['IOC', 'IOC-T', 'IOC-B']);
  const phrases = new Map();
  for (const row of rows) {
    const f = featuresOf(row);
    const context = `${row.deal?.target || row.deal_id} ${row.category || row.type}`;
    collectFromFeature(phrases, f.otherSpecificExclusions, context);
    collectFromFeature(phrases, f.other_specific_exclusions, context);
    collectFromFeature(phrases, f.otherSpecificExceptions, context);
    collectFromFeature(phrases, f.permittedExceptions, context);
    collectFromFeature(phrases, f.exceptions && f.exceptions.other, context);
  }
  const entries = [...phrases.values()].sort((a, b) => b.count - a.count || a.norm.localeCompare(b.norm));
  writeReport('reports/canonical-sweep/ioc-other-exclusions.md', 'IOC Other Specific Exclusions Sweep', entries, note);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
