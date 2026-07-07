function normalizeString(value, caseInsensitive) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    [caseInsensitive ? 'toLowerCase' : 'toString']();
}

const CASE_INSENSITIVE_FIELDS = new Set(['defined_term', 'definedTerm', 'term', 'definition']);

function scalarDelta(field, a, b, kind) {
  if (a == null && b == null) return { isDelta: false, severity: 'NONE' };
  if (a == null || b == null) return { isDelta: true, severity: 'MAJOR' };
  if (kind === 'number' || kind === 'decimal' || kind === 'int' || kind === 'currency' || kind === 'percentage' || kind === 'duration' || kind === 'usd' || kind === 'percent') {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { isDelta: String(a) !== String(b), severity: 'MINOR' };
    if (Math.min(Math.abs(x), Math.abs(y)) === 0 && x !== y) return { isDelta: true, severity: 'MAJOR' };
    const ratio = Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y));
    if (ratio > 0.2) return { isDelta: true, severity: 'MAJOR' };
    if (ratio > 0.05) return { isDelta: true, severity: 'MINOR' };
    return { isDelta: false, severity: 'NONE' };
  }
  if (kind === 'boolean' || kind === 'enum') {
    return String(a) === String(b) ? { isDelta: false, severity: 'NONE' } : { isDelta: true, severity: 'MAJOR' };
  }
  if (kind === 'date') {
    return String(a) === String(b) ? { isDelta: false, severity: 'NONE' } : { isDelta: true, severity: 'MAJOR' };
  }
  const rawSame = String(a) === String(b);
  const normA = normalizeString(a, CASE_INSENSITIVE_FIELDS.has(field));
  const normB = normalizeString(b, CASE_INSENSITIVE_FIELDS.has(field));
  if (normA === normB) return rawSame ? { isDelta: false, severity: 'NONE' } : { isDelta: true, severity: 'TRIVIAL' };
  return { isDelta: true, severity: 'MINOR' };
}

function structuredDelta(aRows, bRows, structuralKey) {
  const a = Array.isArray(aRows) ? aRows : [];
  const b = Array.isArray(bRows) ? bRows : [];
  if (a.length !== b.length) return { isDelta: true, severity: 'MAJOR' };
  const keyFor = structuralKey || ((row) => JSON.stringify(row));
  const byKey = new Map(a.map((row) => [keyFor(row), row]));
  for (const row of b) {
    const key = keyFor(row);
    if (!byKey.has(key)) return { isDelta: true, severity: 'MAJOR' };
    const peer = byKey.get(key);
    if ((peer.verbatim_quote || peer.primary_quote) !== (row.verbatim_quote || row.primary_quote)) {
      return { isDelta: true, severity: 'MINOR' };
    }
  }
  return { isDelta: false, severity: 'NONE' };
}

const SEVERITY_RANK = { NONE: 0, TRIVIAL: 1, MINOR: 2, MAJOR: 3 };

function maxSeverity(values) {
  return values.reduce((best, value) => (SEVERITY_RANK[value] > SEVERITY_RANK[best] ? value : best), 'NONE');
}

module.exports = { scalarDelta, structuredDelta, maxSeverity, SEVERITY_RANK };
