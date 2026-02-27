import { useState, useEffect, useMemo } from 'react';
import { useDeals, useProvisions } from '../lib/useSupabaseData';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../components/UI';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';

export default function Frankenstein() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals } = useDeals();
  const { provisions, loading } = useProvisions();
  const { addToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('MAE');
  const [selectedSentences, setSelectedSentences] = useState([]); // { provisionId, sentenceIndex, text, dealLabel }
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  // Derive categories
  const categories = useMemo(() => {
    const cats = new Set();
    provisions.forEach(p => p.category && cats.add(p.category));
    return Array.from(cats).sort();
  }, [provisions]);

  // Filter provisions by type + category
  const filtered = useMemo(() => {
    return provisions.filter(p => {
      if (p.type !== selectedType) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      return true;
    });
  }, [provisions, selectedType, selectedCategory]);

  // Split each provision's text into sentences
  const provisionSentences = useMemo(() => {
    return filtered.map(p => {
      const dealInfo = deals.find(d => d.id === p.deal_id);
      const label = dealInfo ? `${dealInfo.acquirer} / ${dealInfo.target}` : 'Unknown Deal';
      // Split on sentence boundaries (period + space, semicolon + space for legal text)
      const sentences = (p.full_text || '')
        .split(/(?<=[.;])\s+/)
        .filter(s => s.trim().length > 10);
      return { provision: p, dealLabel: label, sentences };
    });
  }, [filtered, deals]);

  // Toggle sentence selection
  const toggleSentence = (provisionId, sentenceIndex, text, dealLabel) => {
    setSelectedSentences(prev => {
      const key = `${provisionId}-${sentenceIndex}`;
      const existing = prev.find(s => `${s.provisionId}-${s.sentenceIndex}` === key);
      if (existing) return prev.filter(s => `${s.provisionId}-${s.sentenceIndex}` !== key);
      return [...prev, { provisionId, sentenceIndex, text, dealLabel }];
    });
  };

  const isSelected = (provisionId, sentenceIndex) => {
    return selectedSentences.some(s => s.provisionId === provisionId && s.sentenceIndex === sentenceIndex);
  };

  // Assemble composite text
  const compositeText = useMemo(() => {
    return selectedSentences.map(s => s.text).join(' ');
  }, [selectedSentences]);

  // Move sentence up/down in selection
  const moveSentence = (index, direction) => {
    setSelectedSentences(prev => {
      const arr = [...prev];
      const newIdx = index + direction;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
      return arr;
    });
  };

  const removeSentence = (index) => {
    setSelectedSentences(prev => prev.filter((_, i) => i !== index));
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(compositeText);
      addToast('Copied to clipboard', 'success');
    } catch {
      addToast('Failed to copy', 'error');
    }
  };

  // Save as template provision
  const saveAsTemplate = async () => {
    if (!compositeText || !templateName) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/provisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          category: selectedCategory || 'Frankenstein Template',
          full_text: compositeText,
          ai_favorability: 'neutral',
        }),
      });
      if (resp.ok) {
        addToast('Template saved', 'success');
        setTemplateName('');
      } else {
        addToast('Failed to save', 'error');
      }
    } catch {
      addToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Frankenstein Builder' }]} />
      <div>
        <h1 className="font-display text-2xl text-ink">Frankenstein Builder</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Select clauses from multiple deals to assemble a composite "best of" provision.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-bg rounded-lg p-0.5">
          {['MAE', 'IOC'].map(t => (
            <button key={t} onClick={() => setSelectedType(t)}
              className={`px-3 py-1 text-sm font-ui rounded transition-colors ${
                selectedType === t ? 'bg-white text-ink shadow-sm' : 'text-inkLight hover:text-ink'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
          className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-inkFaint font-ui ml-auto">
          {filtered.length} provisions · {selectedSentences.length} clauses selected
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Provisions */}
        <div className="space-y-4">
          <h2 className="font-display text-lg text-ink">Source Provisions</h2>
          {loading ? (
            <SkeletonCard />
          ) : provisionSentences.length === 0 ? (
            <EmptyState title="No provisions" description="Select a type and category to see provisions." />
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {provisionSentences.map(({ provision, dealLabel, sentences }) => (
                <div key={provision.id} className="bg-white border border-border rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-ui text-sm font-medium text-ink">{dealLabel}</span>
                    <span className="text-[10px] font-ui text-inkFaint">{provision.category || '—'}</span>
                  </div>
                  <div className="space-y-1">
                    {sentences.map((s, i) => {
                      const sel = isSelected(provision.id, i);
                      return (
                        <button key={i} onClick={() => toggleSentence(provision.id, i, s, dealLabel)}
                          className={`block w-full text-left px-3 py-2 rounded text-sm font-body leading-relaxed transition-colors ${
                            sel
                              ? 'bg-accent/10 text-ink ring-1 ring-accent/30'
                              : 'hover:bg-bg/60 text-inkMid'
                          }`}>
                          {sel && <span className="text-accent text-xs font-ui mr-1">✓</span>}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composite Builder */}
        <div className="space-y-4">
          <h2 className="font-display text-lg text-ink">Composite Provision</h2>

          {selectedSentences.length === 0 ? (
            <div className="bg-white border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-inkFaint font-ui">Click sentences from the left to add them here.</p>
            </div>
          ) : (
            <>
              {/* Selected sentences — reorderable */}
              <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {selectedSentences.map((s, i) => (
                  <div key={`${s.provisionId}-${s.sentenceIndex}`}
                    className="flex items-start gap-2 px-3 py-2 rounded bg-bg/50 group">
                    <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                      <button onClick={() => moveSentence(i, -1)} disabled={i === 0}
                        className="text-[10px] text-inkFaint hover:text-ink disabled:opacity-20">▲</button>
                      <button onClick={() => moveSentence(i, 1)} disabled={i === selectedSentences.length - 1}
                        className="text-[10px] text-inkFaint hover:text-ink disabled:opacity-20">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-ink leading-relaxed">{s.text}</p>
                      <span className="text-[10px] text-inkFaint font-ui">{s.dealLabel}</span>
                    </div>
                    <button onClick={() => removeSentence(i)}
                      className="text-xs text-inkFaint hover:text-seller shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="bg-white border border-border rounded-lg shadow-sm p-4">
                <h3 className="font-ui text-xs font-medium text-inkLight mb-2">Preview</h3>
                <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap">{compositeText}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button onClick={copyToClipboard}
                  className="px-4 py-2 text-sm font-ui border border-border rounded hover:border-accent transition-colors">
                  Copy to Clipboard
                </button>
                <div className="flex gap-2 flex-1 min-w-[200px]">
                  <input value={templateName} onChange={e => setTemplateName(e.target.value)}
                    placeholder="Template name…"
                    className="flex-1 border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
                  <button onClick={saveAsTemplate} disabled={saving || !templateName}
                    className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
                    {saving ? 'Saving…' : 'Save Template'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
