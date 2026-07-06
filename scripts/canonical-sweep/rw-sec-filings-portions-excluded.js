const {
  addPhrase,
  fetchProvisions,
  featuresOf,
  writeReport,
} = require('./_shared');

function collect(map, value, context) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collect(map, item, context));
    return;
  }
  if (typeof value === 'object') {
    addPhrase(map, value, context);
    collect(map, value.portionsExcluded, context);
    collect(map, value.portions_excluded, context);
    collect(map, value.excludedPortions, context);
    collect(map, value.excluded_portions, context);
    return;
  }
  addPhrase(map, value, context);
}

async function main() {
  const { rows, note } = await fetchProvisions(['REP-T', 'REP-B']);
  const phrases = new Map();
  for (const row of rows) {
    const f = featuresOf(row);
    const context = `${row.deal?.target || row.deal_id} ${row.category || row.type}`;
    collect(phrases, f.secFilingsPortionsExcluded, context);
    collect(phrases, f.sec_filings_portions_excluded, context);
    collect(phrases, f.secFilingsExcludedPortions, context);
    collect(phrases, f.secFilingsExceptionScope, context);
  }
  const entries = [...phrases.values()].sort((a, b) => b.count - a.count || a.norm.localeCompare(b.norm));
  writeReport('reports/canonical-sweep/rw-sec-filings-portions-excluded.md', 'R&W SEC Filings Portions Excluded Sweep', entries, note);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
