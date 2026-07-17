// Review V2 ("Mergertrace") — right-hand clause sidebar (reader mode).
// Slides out when a provision is selected in the main content and answers
// "how common is this?" from the corpus: prevalence within a refinable peer
// set, common feature values (friendly labels resolved server-side), and a
// similarity-ranked comparable-deal list.
//
// TYPOGRAPHY RULE (Ben): Inter + IBM Plex Mono ONLY — no serif anywhere in
// this panel, including the clause quote.
//
// Filters cover the full deal-fact vocabulary: sector, signing year, deal
// size, law firm (either side; coverage is partial and labelled), buyer,
// merger form. Each change re-runs one small cached GET /api/corpus-stats.

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

function sectionRefLabel(ref) {
  const first = String(ref || '').split('|')[0].trim();
  return first ? `§${first}` : '';
}

const LAB = 'text-[8px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A] mb-1.5';
const SEL = 'w-full border border-[#E0E0E0] bg-white text-[10px] px-1.5 py-1 text-[#1F1F1F]';
const INPUT = 'w-full border border-[#E0E0E0] bg-white text-[10px] px-1.5 py-1 text-[#1F1F1F] placeholder:text-[#B0B0B0]';

const EDITOR_KEY_STORAGE = 'mtx_editor_key';

const WRONG_KINDS = [
  { key: '', label: 'Select…' },
  { key: 'code', label: 'Code / classification' },
  { key: 'party', label: 'Party' },
  { key: 'value', label: 'Value' },
  { key: 'quote', label: 'Quote / clause text' },
  { key: 'other', label: 'Other' },
];

// Best-effort "attribute — current value" label for the claim dropdown.
// Mirrors the shapes lib/queries/claims-adapter.js's buildFeaturesForCard
// produces: tagged { code, label, text }, plain scalars, or arrays of
// either. Never throws on an unexpected shape — worst case shows "(set)".
function featureValueText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(featureValueText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    if (value.label) return String(value.label);
    if (value.text) return String(value.text);
    if (value.code) return String(value.code);
    return '(set)';
  }
  return String(value);
}

function cardClaimOptions(card) {
  const features = (card && card.features && typeof card.features === 'object') ? card.features : {};
  return Object.keys(features)
    .sort()
    .map((attribute) => ({ attribute, valueText: featureValueText(features[attribute]) }));
}

const SIZE_BUCKETS = [
  { key: '', label: 'Any size' },
  { key: 'lt1', label: '< $1B', minValue: null, maxValue: 1e9 },
  { key: '1to5', label: '$1–5B', minValue: 1e9, maxValue: 5e9 },
  { key: '5to20', label: '$5–20B', minValue: 5e9, maxValue: 20e9 },
  { key: 'gt20', label: '> $20B', minValue: 20e9, maxValue: null },
];

// The Correct tab: propose a fix, submitted through POST
// /api/corrections/submit. Approved editors (a valid x-editor-key, resolved
// server-side against the EDITOR_KEYS env var) apply immediately through
// the existing provisions PATCH + logCorrection machinery; everyone else's
// correction queues for the weekly review (pages/corrections-review.js).
// The response never distinguishes "no key" from "wrong key" — only
// applied-vs-queued is shown, per the spec.
function CorrectTab({ card, dealId }) {
  const [kind, setKind] = useState('');
  const [claimAttribute, setClaimAttribute] = useState('');
  const [proposed, setProposed] = useState('');
  const [rationale, setRationale] = useState('');
  const [name, setName] = useState('');
  const [editorKey, setEditorKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { outcome: 'applied' | 'pending' | 'error', text }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(EDITOR_KEY_STORAGE);
      if (stored) setEditorKey(stored);
    } catch {
      // localStorage unavailable — the key field just stays empty.
    }
  }, []);

  const claimOptions = useMemo(() => cardClaimOptions(card), [card]);
  const canSubmit = kind && proposed.trim() && rationale.trim() && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/corrections/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-editor-key': editorKey },
        body: JSON.stringify({
          card_id: card.id || card.provision_instance_id || null,
          deal_id: dealId,
          target: { kind, claim_attribute: kind === 'value' ? (claimAttribute || undefined) : undefined },
          proposed: proposed.trim(),
          rationale: rationale.trim(),
          submitted_by: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ outcome: 'error', text: data.error || 'Submission failed — try again.' });
        return;
      }
      if (editorKey.trim()) {
        try { window.localStorage.setItem(EDITOR_KEY_STORAGE, editorKey.trim()); } catch { /* ignore */ }
      }
      if (data.outcome === 'applied') {
        setResult({ outcome: 'applied', text: 'Applied to the corpus.' });
      } else {
        setResult({ outcome: 'pending', text: 'Queued for weekly review.' });
      }
      setProposed('');
      setRationale('');
    } catch (err) {
      setResult({ outcome: 'error', text: err.message || 'Submission failed — try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3.5 py-4" style={{ fontFamily: 'var(--mtx-sans)' }} data-testid="correct-tab">
      <div className="mb-3">
        <div className={LAB}>What&apos;s wrong</div>
        <select className={SEL} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What's wrong">
          {WRONG_KINDS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
        </select>
      </div>

      {kind === 'value' && claimOptions.length > 0 ? (
        <div className="mb-3">
          <div className={LAB}>Claim</div>
          <select className={SEL} value={claimAttribute} onChange={(e) => setClaimAttribute(e.target.value)} aria-label="Claim">
            <option value="">Select a claim…</option>
            {claimOptions.map((c) => (
              <option key={c.attribute} value={c.attribute}>{c.attribute} — {c.valueText || '(not set)'}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mb-3">
        <div className={LAB}>Proposed fix</div>
        <textarea
          className={`${INPUT} min-h-[60px] resize-y`}
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          placeholder="What should this say instead?"
        />
      </div>

      <div className="mb-3">
        <div className={LAB}>Rationale (required)</div>
        <textarea
          className={`${INPUT} min-h-[50px] resize-y`}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why is the current extraction wrong?"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <div>
          <div className={LAB}>Your name</div>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
        </div>
        <div>
          <div className={LAB}>Editor key</div>
          <input
            type="password"
            className={INPUT}
            value={editorKey}
            onChange={(e) => setEditorKey(e.target.value)}
            placeholder="approved editors only"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white bg-[#1F1F1F] disabled:bg-[#C7C7C7] disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting…' : 'Submit correction'}
      </button>

      {result ? (
        <div
          data-testid="correct-tab-result"
          data-outcome={result.outcome}
          className="mt-3 text-[10px] leading-relaxed px-2 py-1.5"
          style={{
            color: result.outcome === 'applied' ? '#1F6D3F' : result.outcome === 'pending' ? '#2F6DB5' : '#B14E63',
            background: result.outcome === 'applied' ? 'rgba(31,109,63,.08)' : result.outcome === 'pending' ? 'rgba(47,109,181,.08)' : 'rgba(177,78,99,.08)',
            border: `1px solid ${result.outcome === 'applied' ? 'rgba(31,109,63,.25)' : result.outcome === 'pending' ? 'rgba(47,109,181,.25)' : 'rgba(177,78,99,.25)'}`,
          }}
        >
          {result.text}
        </div>
      ) : null}
    </div>
  );
}

export default function ClauseSidebar({ card, dealId, dealSector, onClose }) {
  const { isEdit } = useViewMode();
  const [tab, setTab] = useState('context');
  const [filters, setFilters] = useState({ sector: '', yearFrom: '', size: '', lawFirm: '', buyer: '', form: '' });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const code = card ? String(card.provision_subtype || '').toUpperCase() : null;

  const query = useMemo(() => {
    if (!code) return null;
    const params = new URLSearchParams({ code });
    if (dealId) params.set('deal_id', dealId);
    if (filters.sector) params.set('sector', filters.sector);
    if (filters.yearFrom) params.set('yearFrom', filters.yearFrom);
    const bucket = SIZE_BUCKETS.find((b) => b.key === filters.size);
    if (bucket && bucket.minValue) params.set('minValue', String(bucket.minValue));
    if (bucket && bucket.maxValue) params.set('maxValue', String(bucket.maxValue));
    if (filters.lawFirm) params.set('lawFirm', filters.lawFirm);
    if (filters.buyer) params.set('buyer', filters.buyer);
    if (filters.form) params.set('form', filters.form);
    return params.toString();
  }, [code, dealId, filters]);

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
  const opts = (stats && stats.options) || { sectors: [], buyers: [], lawFirms: [], forms: [], lawFirmCoverage: 0 };
  const setF = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

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
        <CorrectTab card={card} dealId={dealId} />
      ) : (
        <>
          <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
            <div className={LAB}>Market position{stats ? ` · peer set: ${stats.peerSetSize} deals` : ''}</div>
            {loading && !stats ? (
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
            <div className="grid grid-cols-2 gap-1.5">
              <select className={SEL} value={filters.sector} onChange={setF('sector')} aria-label="Sector">
                <option value="">All sectors</option>
                {opts.sectors.map((s) => <option key={s} value={s}>{s}{s === dealSector ? ' (this deal)' : ''}</option>)}
              </select>
              <select className={SEL} value={filters.size} onChange={setF('size')} aria-label="Deal size">
                {SIZE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
              <select className={SEL} value={filters.yearFrom} onChange={setF('yearFrom')} aria-label="Signed from">
                <option value="">Any vintage</option>
                {['2024', '2022', '2020', '2016'].map((y) => <option key={y} value={y}>Signed {y}+</option>)}
              </select>
              <select className={SEL} value={filters.form} onChange={setF('form')} aria-label="Merger form">
                <option value="">Any structure</option>
                {opts.forms.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select className={SEL} value={filters.buyer} onChange={setF('buyer')} aria-label="Buyer">
                <option value="">Any buyer</option>
                {opts.buyers.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className={SEL} value={filters.lawFirm} onChange={setF('lawFirm')} aria-label="Law firm">
                <option value="">Any law firm</option>
                {opts.lawFirms.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {filters.lawFirm ? (
              <div className="text-[8.5px] text-[#9A9A9A] mt-1.5">
                Counsel data covers {opts.lawFirmCoverage} of 40 deals so far — treat firm filters as a floor, not a census.
              </div>
            ) : null}
          </div>

          {stats && stats.featureSummary && stats.featureSummary.length ? (
            <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
              <div className={LAB}>Common values across the peer set</div>
              {stats.featureSummary.slice(0, 4).map((f) => (
                <div key={f.attribute} className="mb-2">
                  <div className="text-[9px] text-[#6B6B6B] mb-1">{f.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {f.values.slice(0, 4).map((v) => (
                      <span key={v.value} className="border px-1.5 py-0.5 text-[8.5px]" style={{ color: '#2F6DB5', borderColor: 'rgba(47,109,181,.25)', background: 'rgba(47,109,181,.08)' }}>
                        {v.label} · {v.count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stats && stats.peers && stats.peers.length ? (
            <div className="px-3.5 py-3 border-b border-[#E0E0E0]">
              <div className={LAB}>Comparable deals with this clause · ranked by sector, size, recency</div>
              {stats.peers.slice(0, 6).map((p) => (
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
