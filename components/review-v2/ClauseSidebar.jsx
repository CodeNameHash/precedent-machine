// Review V2 ("Mergertrace") — right-hand clause sidebar (reader mode).
// Slides out when a provision is selected in the main content and answers
// "how common is this?" from the corpus: prevalence within a refinable peer
// set, common feature values, and closest-precedent links.
//
// TYPOGRAPHY RULE (Ben): Inter + IBM Plex Mono ONLY — no serif anywhere in
// this panel, including the clause quote (12px sans, matching the tooltip /
// "see provision" voice).
//
// Data: one lazy GET /api/corpus-stats per (code, filters) — nothing is
// fetched until a provision is clicked; responses are edge-cached upstream.
// The "Correct ✎" tab renders for editors only (phase 2 wires it to the
// corrections plumbing; it is a labelled stub until then).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useViewMode } from '../ViewModeContext';

function fmtValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtYear(date) {
  return date ? String(date).slice(0, 4) : null;
}

function humanize(code) {
  const s = String(code || '').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : code;
}

function sectionRefLabel(ref) {
  const first = String(ref || '').split('|')[0].trim();
  return first ? `§${first}` : '';
}

const LAB = 'text-[8px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A] mb-1.5';

export default function ClauseSidebar({ card, dealId, dealSector, onClose }) {
  const { isEdit } = useViewMode();
  const [tab, setTab] = useState('context');
  const [sectorOnly, setSectorOnly] = useState(false);
  const [yearRecent, setYearRecent] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const code = card ? String(card.provision_subtype || '').toUpperCase() : null;

  const query = useMemo(() => {
    if (!code) return null;
    const params = new URLSearchParams({ code });
    if (sectorOnly && dealSector) params.set('sector', dealSector);
    if (yearRecent) params.set('yearFrom', '2023');
    return params.toString();
  }, [code, sectorOnly, yearRecent, dealSector]);

  useEffect(() => {
    if (!query) { setStats(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/corpus-stats?${query}`)
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload.error || `HTTP ${r.status}`);
        return payload;
      })
      .then((next) => { if (!cancelled) setStats(next); })
      .catch((e) => { if (!cancelled) { setStats(null); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  if (!card) return null;
  const quote = card.primary_quote || card.region_full_text || '';

  return (
    <aside
      className="hidden lg:flex flex-col w-[320px] shrink-0 border-l border-[#E0E0E0] bg-white sticky overflow-y-auto mtx-scrollbar-thin"
      style={{ top: 'var(--mtx-head-h, 108px)', height: 'calc(100vh - var(--mtx-head-h, 108px))', fontFamily: 'var(--mtx-sans)' }}
      data-testid="clause-sidebar"
    >
      <div className="flex border-b border-[#E0E0E0]">
        <button
          type="button"
          onClick={() => setTab('context')}
          className={`flex-1 py-2 text-[8.5px] font-bold uppercase tracking-[0.14em] border-b-2 ${tab === 'context' ? 'text-[#1F1F1F] border-black' : 'text-[#9A9A9A] border-transparent'}`}
        >
          Corpus context
        </button>
        {isEdit ? (
          <button
            type="button"
            onClick={() => setTab('correct')}
            className={`flex-1 py-2 text-[8.5px] font-bold uppercase tracking-[0.14em] border-b-2 ${tab === 'correct' ? 'text-[#1F1F1F] border-black' : 'text-[#9A9A9A] border-transparent'}`}
          >
            Correct ✎
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close sidebar" className="px-3 text-[#9A9A9A] hover:text-[#1F1F1F] text-xs">✕</button>
      </div>

      <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
        <div className="mtx-mono text-[9px] text-[#6B6B6B]">{code} · {sectionRefLabel(card.section_ref)}</div>
        <div className="text-[13px] font-bold text-[#1F1F1F] mt-0.5">{card.short_title || card.defined_term}</div>
      </div>

      {tab === 'correct' ? (
        <div className="px-3.5 py-4 text-[11px] text-[#6B6B6B] leading-relaxed">
          <div className={LAB}>Correction panel — phase 2</div>
          Live correction lands here next: what&apos;s wrong (code / party / value / quote),
          the fix, and the rationale that feeds the weekly review queue. Wired to the
          existing corrections log so nothing is lost in the meantime — for now, use the
          v1 edit page for urgent fixes.
        </div>
      ) : (
        <>
          <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
            <div className={LAB}>Market position{stats ? ` · ${stats.peerSetSize} deals in peer set` : ''}</div>
            {loading ? (
              <div className="text-[10px] text-[#9A9A9A]">Loading corpus…</div>
            ) : error ? (
              <div className="text-[10px] text-[#B14E63]">Corpus stats unavailable: {error}</div>
            ) : stats ? (
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-[#6B6B6B]">Deals with this provision</span>
                <span className="text-[13px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {stats.dealsWithCode} of {stats.peerSetSize}
                </span>
              </div>
            ) : null}
          </div>

          <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
            <div className={LAB}>Refine the peer set</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSectorOnly((v) => !v)}
                disabled={!dealSector}
                className={`border px-2 py-0.5 text-[8.5px] ${sectorOnly ? 'border-[#1F1F1F] text-[#1F1F1F] font-semibold' : 'border-[#E0E0E0] text-[#6B6B6B]'}`}
              >
                {dealSector || 'Sector n/a'}
              </button>
              <button
                type="button"
                onClick={() => setYearRecent((v) => !v)}
                className={`border px-2 py-0.5 text-[8.5px] ${yearRecent ? 'border-[#1F1F1F] text-[#1F1F1F] font-semibold' : 'border-[#E0E0E0] text-[#6B6B6B]'}`}
              >
                2023 onward
              </button>
            </div>
          </div>

          {stats && stats.featureSummary && stats.featureSummary.length ? (
            <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
              <div className={LAB}>Common values across the peer set</div>
              {stats.featureSummary.slice(0, 4).map((f) => (
                <div key={f.attribute} className="mb-2">
                  <div className="text-[9px] text-[#6B6B6B] mb-1">{humanize(f.attribute)}</div>
                  <div className="flex flex-wrap gap-1">
                    {f.values.slice(0, 4).map((v) => (
                      <span key={v.value} className="border px-1.5 py-0.5 text-[8.5px]" style={{ color: '#2F6DB5', borderColor: 'rgba(47,109,181,.25)', background: 'rgba(47,109,181,.08)' }}>
                        {humanize(v.value)} · {v.count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stats && stats.peers && stats.peers.length ? (
            <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
              <div className={LAB}>Closest precedents</div>
              {stats.peers.filter((p) => p.deal_id !== dealId).slice(0, 6).map((p) => (
                <Link
                  key={p.deal_id}
                  href={`/review-v2/${p.deal_id}`}
                  className="flex items-baseline justify-between py-1 border-b border-dotted border-[#E0E0E0] last:border-b-0 hover:bg-[#F6F6F6]"
                >
                  <span className="text-[10px] text-[#1F1F1F] min-w-0 truncate pr-2">{p.acquirer} / {p.target}</span>
                  <span className="mtx-mono text-[8.5px] text-[#6B6B6B] whitespace-nowrap">
                    {[p.sector, fmtValue(p.value_usd), fmtYear(p.announce_date)].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          {quote ? (
            <div className="px-3.5 py-3">
              <div className={LAB}>This clause</div>
              <div className="text-[11px] leading-5 text-[#1F1F1F] whitespace-pre-wrap break-words border-l-2 border-[#1F1F1F] bg-[#F6F6F6] px-2.5 py-2 max-h-56 overflow-y-auto mtx-scrollbar-thin">
                {quote.slice(0, 1600)}{quote.length > 1600 ? '…' : ''}
              </div>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}
