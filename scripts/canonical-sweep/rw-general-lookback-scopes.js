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
    collect(map, value.scope, context);
    collect(map, value.lookbackScope, context);
    collect(map, value.lookback_scope, context);
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
    collect(phrases, f.lookbackScope, context);
    collect(phrases, f.lookback_scope, context);
    collect(phrases, f.lookbackAnchor, context);
    collect(phrases, f.secFilingsExceptionScope, context);
    collect(phrases, f.absenceOfChangesType, context);
  }
  const entries = [...phrases.values()].sort((a, b) => b.count - a.count || a.norm.localeCompare(b.norm));
  writeReport('reports/canonical-sweep/rw-general-lookback-scopes.md', 'R&W General Lookback Scopes Sweep', entries, note);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
