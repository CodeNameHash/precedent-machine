/* ─────────────────────────────────────────────────────────────────────────
   /search — cross-deal precedent search.
   ───────────────────────────────────────────────────────────────────────────
   A single surface to query EVERY provision across EVERY deal: free-text over
   clause language, plus filter chips for provision family (TERMR, COND, …),
   canonical code, favorability, and structured feature presence. Results are
   grouped by deal and link back into the review page. Talks to
   /api/search/facets (chips) and /api/search/provisions (results).
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { canonicalFavorability } from '../lib/search';

const FAMILY_LABELS = {
  DEF: 'Definitions',
  REP: 'Representations',
  IOC: 'Interim covenants',
  COV: 'Covenants',
  MISC: 'Miscellaneous',
  COND: 'Closing conditions',
  TERMR: 'Termination rights',
  TERMF: 'Termination fees',
  CONSID: 'Consideration',
  STRUCT: 'Deal structure',
  ANTI: 'Antitrust / regulatory',
  NOSOL: 'No-shop',
  OTHER: 'Other',
};

// Handy structured-feature shortcuts — find every deal that populates a field.
// Keys verified to actually exist in stored ai_metadata.features.
const FEATURE_SHORTCUTS = [
  { key: 'carveouts', label: 'MAE carve-outs' },
  { key: 'tailProvision', label: 'Tail provision' },
  { key: 'companyTerminationFee', label: 'Company term. fee' },
  { key: 'nakedNoVoteFee', label: 'Naked no-vote fee' },
  { key: 'expenseReimbursement', label: 'Expense reimbursement' },
];

// Canonical favorability buckets the chips filter on (matching the stored
// synonyms via lib/search expandFavorability).
const FAV_FILTERS = [
  { value: 'buyer-favorable', label: 'Buyer-favorable' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'seller-favorable', label: 'Seller-favorable' },
];

const FAV_COLORS = {
  'buyer-favorable': { bg: '#e7eefb', fg: '#1b3fa0' },
  'seller-favorable': { bg: '#fbeaea', fg: '#a23030' },
  neutral: { bg: '#eef0f2', fg: '#5a6470' },
};

function Chip({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--accent-deep)' : 'var(--line)'}`,
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent-deep)' : 'var(--ink-light)',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {count != null && (
        <span style={{ fontSize: 10.5, opacity: 0.7 }}>{count}</span>
      )}
    </button>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [facets, setFacets] = useState(null);
  const [family, setFamily] = useState(null);
  const [code, setCode] = useState(null);
  const [fav, setFav] = useState(null);
  const [feature, setFeature] = useState(null);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [ranked, setRanked] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  // Load facets once.
  useEffect(() => {
    fetch('/api/search/facets')
      .then((r) => r.json())
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  const runSearch = useMemo(
    () => (params) => {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.family) sp.set('type', params.family);
      if (params.code) sp.set('code', params.code);
      if (params.fav) sp.set('favorability', params.fav);
      if (params.feature) sp.set('feature', params.feature);
      sp.set('limit', '100');
      setLoading(true);
      fetch(`/api/search/provisions?${sp.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setResults(d.results || []);
          setTotal(d.total || 0);
          setRanked(!!d.ranked);
        })
        .catch(() => {
          setResults([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    },
    [],
  );

  // Re-run on any filter change (debounced for typing).
  useEffect(() => {
    const params = { q, family, code, fav, feature };
    const hasAny = q || family || code || fav || feature;
    if (!hasAny) {
      setResults([]);
      setTotal(0);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(params), 220);
    return () => clearTimeout(debounce.current);
  }, [q, family, code, fav, feature, runSearch]);

  // Group results by deal for display.
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of results) {
      const k = r.deal?.id || 'unknown';
      if (!m.has(k)) m.set(k, { deal: r.deal, items: [] });
      m.get(k).items.push(r);
    }
    return [...m.values()];
  }, [results]);

  const topCodes = useMemo(() => {
    if (!facets?.codes) return [];
    let list = facets.codes.filter((c) => c.code);
    if (family) list = list.filter((c) => (c.code || '').startsWith(family));
    return list.slice(0, 14);
  }, [facets, family]);

  const toggle = (cur, val, setter) => setter(cur === val ? null : val);

  return (
    <>
      <Head>
        <title>Search precedents · Precedent Machine</title>
      </Head>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Search precedents
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 16 }}>
          Query every provision across all deals — by clause language, provision type, canonical
          code, or structured feature.
        </p>

        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clause text… e.g. “hell or high water”, “termination fee”, “Material Adverse Effect”"
          style={{
            width: '100%',
            padding: '11px 14px',
            fontSize: 14.5,
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--surface)',
            color: 'var(--ink)',
            outline: 'none',
            marginBottom: 14,
          }}
        />

        {/* Family chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {(facets?.families || []).map((f) => (
            <Chip
              key={f.base}
              active={family === f.base}
              count={f.count}
              onClick={() => {
                toggle(family, f.base, setFamily);
                setCode(null);
              }}
            >
              {FAMILY_LABELS[f.base] || f.base}
            </Chip>
          ))}
        </div>

        {/* Feature + favorability shortcuts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {FEATURE_SHORTCUTS.map((f) => (
            <Chip key={f.key} active={feature === f.key} onClick={() => toggle(feature, f.key, setFeature)}>
              ⚑ {f.label}
            </Chip>
          ))}
          {FAV_FILTERS.map((f) => (
            <Chip key={f.value} active={fav === f.value} onClick={() => toggle(fav, f.value, setFav)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {/* Code chips (scoped to family when one is picked) */}
        {topCodes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
            {topCodes.map((c) => (
              <Chip key={c.code} active={code === c.code} count={c.count} onClick={() => toggle(code, c.code, setCode)}>
                {c.label || c.code}
              </Chip>
            ))}
          </div>
        )}

        {/* Results */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
            {loading ? 'Searching…' : total ? `${total} provision${total === 1 ? '' : 's'} across ${grouped.length} deal${grouped.length === 1 ? '' : 's'}` : ''}
            {ranked && total ? ' · ranked' : ''}
          </span>
        </div>

        {grouped.map(({ deal, items }) => (
          <div key={deal?.id || 'x'} style={{ marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
                marginBottom: 8,
              }}
            >
              <Link
                href={`/review/${deal?.id}`}
                style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-deep)', textDecoration: 'none' }}
              >
                {deal?.acquirer} → {deal?.target}
              </Link>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                {deal?.sector}
                {deal?.announce_date ? ` · ${deal.announce_date}` : ''} · {items.length} hit{items.length === 1 ? '' : 's'}
              </span>
            </div>
            {items.map((r) => {
              const favBucket = canonicalFavorability(r.favorability) || 'neutral';
              const c = FAV_COLORS[favBucket] || FAV_COLORS.neutral;
              return (
                <Link
                  key={r.id}
                  href={`/review/${deal?.id}`}
                  style={{
                    display: 'block',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    marginBottom: 7,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 5,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-deep)',
                      }}
                    >
                      {r.type}
                    </span>
                    {r.code && (
                      <span style={{ fontSize: 11, color: 'var(--ink-light)', fontFamily: 'monospace' }}>{r.code}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{r.category}</span>
                    {r.favorability && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: c.bg, color: c.fg }}>
                        {favBucket}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-light)', lineHeight: 1.5 }}>{r.snippet}</div>
                </Link>
              );
            })}
          </div>
        ))}

        {!loading && total === 0 && (q || family || code || fav || feature) && (
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 24, textAlign: 'center' }}>
            No provisions match these filters.
          </p>
        )}
      </div>
    </>
  );
}
