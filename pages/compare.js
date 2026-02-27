import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useDeals } from '../lib/useSupabaseData';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';
import { Breadcrumbs, AIBadge, SkeletonCard } from '../components/UI';

/* ── Word-level diff ── */
function diffWords(base, compare) {
  const a = (base || '').split(/\s+/);
  const b = (compare || '').split(/\s+/);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  const stack = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { stack.push({ type: 'same', word: b[j-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { stack.push({ type: 'add', word: b[j-1] }); j--; }
    else { stack.push({ type: 'del', word: a[i-1] }); i--; }
  }
  stack.reverse();
  return stack;
}

function DiffDisplay({ base, compare }) {
  const tokens = useMemo(() => diffWords(base, compare), [base, compare]);
  return (
    <div className="font-body text-sm leading-relaxed whitespace-pre-wrap">
      {tokens.map((t, i) => {
        if (t.type === 'add') return <span key={i} className="bg-buyer/15 text-buyer">{t.word} </span>;
        if (t.type === 'del') return <span key={i} className="bg-seller/15 text-seller line-through">{t.word} </span>;
        return <span key={i}>{t.word} </span>;
      })}
    </div>
  );
}

export default function Compare() {
  const router = useRouter();
  const { user } = useUser({ redirectTo: '/login' });
  const { addToast } = useToast();
  const { deals, loading: dealsLoading } = useDeals();
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [provisionsByDeal, setProvisionsByDeal] = useState({});
  const [loadingProvisions, setLoadingProvisions] = useState(false);

  // AI Compare state
  const [aiComparing, setAiComparing] = useState(false);
  const [aiComparison, setAiComparison] = useState(null);

  // Save Comparison state
  const [saving, setSaving] = useState(false);

  // Load from URL params
  useEffect(() => {
    if (router.query.ids) {
      setSelectedIds(router.query.ids.split(',').filter(Boolean));
    }
    if (router.query.category) {
      setCategoryFilter(router.query.category);
    }
  }, [router.query]);

  // Fetch provisions for selected deals
  useEffect(() => {
    if (selectedIds.length === 0) { setProvisionsByDeal({}); return; }
    setLoadingProvisions(true);
    Promise.all(
      selectedIds.map(did =>
        fetch(`/api/provisions?deal_id=${did}`).then(r => r.json()).then(d => ({ deal_id: did, provisions: d.provisions || [] }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.deal_id] = r.provisions; });
      setProvisionsByDeal(map);
      setLoadingProvisions(false);
    });
  }, [selectedIds]);

  const toggleDeal = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setAiComparison(null); // Reset AI comparison on deal change
  };

  const allCategories = useMemo(() => {
    const cats = new Set();
    Object.values(provisionsByDeal).forEach(provs => provs.forEach(p => p.category && cats.add(p.category)));
    return Array.from(cats).sort();
  }, [provisionsByDeal]);

  const filteredByDeal = useMemo(() => {
    const out = {};
    selectedIds.forEach(did => {
      const provs = provisionsByDeal[did] || [];
      out[did] = categoryFilter ? provs.filter(p => p.category === categoryFilter) : provs;
    });
    return out;
  }, [provisionsByDeal, selectedIds, categoryFilter]);

  const dealLabel = (id) => {
    const d = deals.find(x => x.id === id);
    return d ? `${d.acquirer} / ${d.target}` : id.slice(0, 8);
  };

  const baseId = selectedIds[0];

  /* ── AI Compare ── */
  const handleAICompare = async () => {
    // Gather all provisions across selected deals
    const allProvs = [];
    selectedIds.forEach(did => {
      const provs = filteredByDeal[did] || [];
      provs.forEach(p => {
        allProvs.push({
          deal_label: dealLabel(did),
          type: p.type,
          category: p.category,
          full_text: p.full_text,
        });
      });
    });

    if (allProvs.length < 2) {
      addToast('Need at least 2 provisions to compare', 'error');
      return;
    }

    setAiComparing(true);
    setAiComparison(null);
    try {
      const resp = await fetch('/api/ai/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provisions: allProvs.slice(0, 6) }), // Limit to 6
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setAiComparison(data);
    } catch (err) {
      addToast(`AI error: ${err.message}`, 'error');
    }
    setAiComparing(false);
  };

  /* ── Save Comparison ── */
  const handleSaveComparison = async () => {
    setSaving(true);
    try {
      await fetch('/api/comparisons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_ids: selectedIds,
          category: categoryFilter || null,
          summary: aiComparison?.executive_summary || null,
          ai_generated_at: aiComparison ? new Date().toISOString() : null,
        }),
      });
      addToast('Comparison saved', 'success');
    } catch {
      addToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Compare' }]} />
      <h1 className="font-display text-2xl text-ink">Compare Provisions</h1>

      {/* Deal Selector */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-ui font-medium text-inkMid">Select 2–3 Deals to Compare</label>
          <span className="text-xs text-inkFaint font-ui">{selectedIds.length}/3 selected</span>
        </div>

        {dealsLoading ? (
          <p className="text-sm text-inkFaint font-ui">Loading deals…</p>
        ) : deals.length === 0 ? (
          <p className="text-sm text-inkFaint font-ui">No deals available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {deals.map(d => {
              const isSelected = selectedIds.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDeal(d.id)}
                  disabled={!isSelected && selectedIds.length >= 3}
                  className={`px-3 py-1.5 text-sm font-ui rounded border transition-colors ${
                    isSelected ? 'bg-accent text-white border-accent' : 'bg-white text-inkMid border-border hover:border-accent disabled:opacity-40'
                  }`}>
                  {d.acquirer} / {d.target}
                </button>
              );
            })}
          </div>
        )}

        {allCategories.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <label className="text-sm font-ui text-inkLight">Category</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setAiComparison(null); }}
              className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent">
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Action buttons */}
        {selectedIds.length >= 2 && (
          <div className="flex gap-3 pt-2 border-t border-border">
            <button onClick={handleAICompare} disabled={aiComparing}
              className="px-3 py-1.5 text-sm font-ui border border-accent/30 text-accent rounded hover:bg-accent/5 disabled:opacity-40 transition-colors">
              {aiComparing ? '⟳ Analyzing…' : '◇ AI Compare'}
            </button>
            <button onClick={handleSaveComparison} disabled={saving}
              className="px-3 py-1.5 text-sm font-ui border border-border rounded hover:bg-bg disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : '⊞ Save Comparison'}
            </button>
          </div>
        )}
      </div>

      {/* AI Comparison Summary */}
      {aiComparison && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AIBadge />
            <span className="font-ui text-sm font-medium text-ink">AI Comparison Summary</span>
          </div>

          <p className="font-body text-sm text-ink leading-relaxed">{aiComparison.executive_summary}</p>

          {aiComparison.key_differences?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-ui text-xs font-medium text-inkLight uppercase tracking-wider">Key Differences</h3>
              {aiComparison.key_differences.map((d, i) => (
                <div key={i} className="bg-white rounded p-3 border border-border space-y-1">
                  <div className="font-ui text-sm font-medium text-ink">{d.aspect}</div>
                  <p className="text-sm font-body text-inkMid">{d.description}</p>
                  <div className="flex gap-4 text-[10px] font-ui">
                    <span className="text-buyer">↑ Buyer: Provision {d.most_favorable_to_buyer}</span>
                    <span className="text-seller">↑ Seller: Provision {d.most_favorable_to_seller}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {aiComparison.practitioner_note && (
            <div className="bg-white rounded p-3 border border-accent/20">
              <span className="text-[10px] font-ui text-accent uppercase tracking-wider">Practitioner Note</span>
              <p className="text-sm font-body text-ink mt-1">{aiComparison.practitioner_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Comparison Grid */}
      {selectedIds.length < 2 ? (
        <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center">
          <p className="text-inkFaint font-ui text-sm">Select at least 2 deals to compare provisions.</p>
        </div>
      ) : loadingProvisions ? (
        <SkeletonCard />
      ) : (
        ['MAE', 'IOC'].map(type => {
          const hasAny = selectedIds.some(did => (filteredByDeal[did] || []).some(p => p.type === type));
          if (!hasAny) return null;

          return (
            <div key={type} className="space-y-3">
              <h2 className="font-display text-lg text-ink">{type} Provisions</h2>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedIds.length}, 1fr)` }}>
                {selectedIds.map(did => (
                  <div key={did} className="bg-bg rounded-t px-3 py-2">
                    <span className="font-ui text-sm font-medium text-inkMid">{dealLabel(did)}</span>
                    {did === baseId && <span className="ml-2 text-[10px] text-inkFaint font-ui">(base)</span>}
                  </div>
                ))}

                {(() => {
                  const maxCount = Math.max(
                    ...selectedIds.map(did => (filteredByDeal[did] || []).filter(p => p.type === type).length)
                  );
                  const rows = [];
                  for (let idx = 0; idx < maxCount; idx++) {
                    selectedIds.forEach(did => {
                      const provisions = (filteredByDeal[did] || []).filter(p => p.type === type);
                      const prov = provisions[idx];
                      const baseProv = (filteredByDeal[baseId] || []).filter(p => p.type === type)[idx];
                      rows.push(
                        <div key={`${did}-${idx}`} className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-2">
                          {prov ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-ui text-inkLight">{prov.category || '—'}</span>
                                {prov.ai_favorability && (
                                  <span className={`text-[10px] font-ui px-1.5 py-0.5 rounded capitalize ${
                                    prov.ai_favorability.toLowerCase() === 'buyer' ? 'bg-buyer/10 text-buyer'
                                    : prov.ai_favorability.toLowerCase() === 'seller' ? 'bg-seller/10 text-seller'
                                    : 'bg-gray-100 text-inkLight'
                                  }`}>{prov.ai_favorability}</span>
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
