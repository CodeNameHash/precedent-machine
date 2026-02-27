import { useState, useEffect, useMemo } from 'react';
import { useDeals } from '../lib/useSupabaseData';

/* ── Word-level diff ── */
function diffWords(base, compare) {
  const a = (base || '').split(/\s+/);
  const b = (compare || '').split(/\s+/);

  // Simple LCS-based diff
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to get diff
  const result = [];
  let i = m, j = n;
  const stack = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'same', word: b[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', word: b[j - 1] });
      j--;
    } else {
      stack.push({ type: 'del', word: a[i - 1] });
      i--;
    }
  }
  stack.reverse();
  return stack;
}

function DiffDisplay({ base, compare }) {
  const tokens = useMemo(() => diffWords(base, compare), [base, compare]);

  return (
    <div className="font-body text-sm leading-relaxed whitespace-pre-wrap">
      {tokens.map((t, i) => {
        if (t.type === 'add') {
          return <span key={i} className="bg-buyer/15 text-buyer">{t.word} </span>;
        }
        if (t.type === 'del') {
          return <span key={i} className="bg-seller/15 text-seller line-through">{t.word} </span>;
        }
        return <span key={i}>{t.word} </span>;
      })}
    </div>
  );
}

export default function Compare() {
  const { deals, loading: dealsLoading } = useDeals();
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [provisionsByDeal, setProvisionsByDeal] = useState({});
  const [loadingProvisions, setLoadingProvisions] = useState(false);

  // Fetch provisions for selected deals
  useEffect(() => {
    if (selectedIds.length === 0) {
      setProvisionsByDeal({});
      return;
    }
    setLoadingProvisions(true);
    Promise.all(
      selectedIds.map((did) =>
        fetch(`/api/provisions?deal_id=${did}`)
          .then((r) => r.json())
          .then((d) => ({ deal_id: did, provisions: d.provisions || [] }))
      )
    ).then((results) => {
      const map = {};
      results.forEach((r) => { map[r.deal_id] = r.provisions; });
      setProvisionsByDeal(map);
      setLoadingProvisions(false);
    });
  }, [selectedIds]);

  // Toggle deal selection (max 3)
  const toggleDeal = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  // Derive all categories across selected deals
  const allCategories = useMemo(() => {
    const cats = new Set();
    Object.values(provisionsByDeal).forEach((provs) =>
      provs.forEach((p) => p.category && cats.add(p.category))
    );
    return Array.from(cats).sort();
  }, [provisionsByDeal]);

  // Filter provisions per deal
  const filteredByDeal = useMemo(() => {
    const out = {};
    selectedIds.forEach((did) => {
      const provs = provisionsByDeal[did] || [];
      out[did] = categoryFilter
        ? provs.filter((p) => p.category === categoryFilter)
        : provs;
    });
    return out;
  }, [provisionsByDeal, selectedIds, categoryFilter]);

  // Group provisions by type
  const groupByType = (provisions) => {
    const mae = provisions.filter((p) => p.type === 'MAE');
    const ioc = provisions.filter((p) => p.type === 'IOC');
    return { mae, ioc };
  };

  // Get deal label
  const dealLabel = (id) => {
    const d = deals.find((x) => x.id === id);
    return d ? `${d.acquirer} / ${d.target}` : id.slice(0, 8);
  };

  // Base provisions (first selected deal) for diff comparison
  const baseId = selectedIds[0];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Compare Provisions</h1>

      {/* Deal Selector */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-ui font-medium text-inkMid">
            Select 2–3 Deals to Compare
          </label>
          <span className="text-xs text-inkFaint font-ui">
            {selectedIds.length}/3 selected
          </span>
        </div>

        {dealsLoading ? (
          <p className="text-sm text-inkFaint font-ui">Loading deals…</p>
        ) : deals.length === 0 ? (
          <p className="text-sm text-inkFaint font-ui">No deals available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {deals.map((d) => {
              const isSelected = selectedIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDeal(d.id)}
                  disabled={!isSelected && selectedIds.length >= 3}
                  className={`px-3 py-1.5 text-sm font-ui rounded border transition-colors ${
                    isSelected
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-inkMid border-border hover:border-accent disabled:opacity-40'
                  }`}
                >
                  {d.acquirer} / {d.target}
                </button>
              );
            })}
          </div>
        )}

        {/* Category Filter */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <label className="text-sm font-ui text-inkLight">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Comparison Grid */}
      {selectedIds.length < 2 ? (
        <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center">
          <p className="text-inkFaint font-ui text-sm">Select at least 2 deals to compare provisions.</p>
        </div>
      ) : loadingProvisions ? (
        <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center">
          <p className="text-inkFaint font-ui text-sm">Loading provisions…</p>
        </div>
      ) : (
        ['MAE', 'IOC'].map((type) => {
          const hasAny = selectedIds.some((did) =>
            (filteredByDeal[did] || []).some((p) => p.type === type)
          );
          if (!hasAny) return null;

          return (
            <div key={type} className="space-y-3">
              <h2 className="font-display text-lg text-ink">{type} Provisions</h2>
              <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${selectedIds.length}, 1fr)` }}>
                {/* Column Headers */}
                {selectedIds.map((did) => (
                  <div key={did} className="bg-bg rounded-t px-3 py-2">
                    <span className="font-ui text-sm font-medium text-inkMid">{dealLabel(did)}</span>
                    {did === baseId && (
                      <span className="ml-2 text-[10px] text-inkFaint font-ui">(base)</span>
                    )}
                  </div>
                ))}

                {/* Provisions per deal */}
                {(() => {
                  // Get max number of provisions of this type across deals
                  const maxCount = Math.max(
                    ...selectedIds.map((did) =>
                      (filteredByDeal[did] || []).filter((p) => p.type === type).length
                    )
                  );

                  const rows = [];
                  for (let idx = 0; idx < maxCount; idx++) {
                    selectedIds.forEach((did) => {
                      const provisions = (filteredByDeal[did] || []).filter((p) => p.type === type);
                      const prov = provisions[idx];
                      const baseProv = (filteredByDeal[baseId] || []).filter((p) => p.type === type)[idx];

                      rows.push(
                        <div key={`${did}-${idx}`} className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-2">
                          {prov ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-ui text-inkLight">{prov.category || '—'}</span>
                                {prov.ai_favorability && (
                                  <span className={`text-[10px] font-ui px-1.5 py-0.5 rounded capitalize ${
                                    (prov.ai_favorability || '').toLowerCase() === 'buyer'
                                      ? 'bg-buyer/10 text-buyer'
                                      : (prov.ai_favorability || '').toLowerCase() === 'seller'
                                      ? 'bg-seller/10 text-seller'
                                      : 'bg-gray-100 text-inkLight'
                                  }`}>
                                    {prov.ai_favorability}
                                  </span>
                                )}
                              </div>
                              {did !== baseId && baseProv ? (
                                <DiffDisplay base={baseProv.full_text} compare={prov.full_text} />
                              ) : (
                                <p className="font-body text-sm leading-relaxed text-ink whitespace-pre-wrap">
                                  {prov.full_text || '—'}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-inkFaint font-ui italic">No corresponding provision</p>
                          )}
                        </div>
                      );
                    });
                  }
                  return rows;
                })()}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
