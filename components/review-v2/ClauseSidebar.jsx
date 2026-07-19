// Review V2 ("Mergertrace") — right-hand clause sidebar (reader mode).
// Slides out when a provision is selected in the main content and answers
// "how does this deal's term compare to the peer set?"
//
// REDESIGN (Ben, corpus-context-not-verbatim, direct feedback): the sidebar
// is for CORPUS CONTEXT, not for restating the provision -- the table row
// already shows the value, "see provision" already shows verbatim. Clicking
// a row answers "how does this deal's term compare to the peer set?", not
// "what does this term say again?". Layout, top to bottom, when a row is
// focused:
//   (a) row identity        -- "Deal structure — One-step merger"
//   (b) CORPUS CONTEXT       -- value distribution across the peer set for
//                               exactly this row's feature(s)/instrument,
//                               this deal's own value highlighted; numeric
//                               features show min/median/max + position
//   (c) Refine the peer set -- the pre-existing filterable summary, kept
//                               but collapsed by default (secondary now)
//   (d) View clause          -- collapsed verbatim quote, on demand only
// List-type row values (e.g. NOSOL's prohibited acts) render as individually
// clickable items inside (b); clicking one drills the sidebar to that item
// (its own corpus frequency + its own "View clause"), with a back
// affordance -- depth is row -> item -> clause (see DrillItemsList/
// ItemDrillBlock below).
//
// TYPOGRAPHY RULE (Ben): Inter + IBM Plex Mono ONLY — no serif anywhere in
// this panel, including the clause quote. Body text bumped a notch (Ben:
// "text seems a bit small") to match the review table's own body size
// (text-xs / 12px) -- see BODY below.
//
// Filters cover the full deal-fact vocabulary: sector, signing year, deal
// size, law firm (either side; coverage is partial and labelled), buyer,
// merger form. Each change re-runs one small cached GET /api/corpus-stats --
// now ALSO carrying featureKeys/itemCode/itemLabel for the focused row, so a
// row click still costs exactly one request (see the `query` useMemo).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useViewMode } from '../ViewModeContext';
import { cardFeatureQuote } from './provisionIndexHelpers.js';

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

const LAB = 'text-[9px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A] mb-1.5';
const LAB_SM = 'text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A]';
const BODY = 'text-[12px] leading-5'; // matches ProvisionTable's td text-xs body size
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

// Row identity line (item 1a): "{row label} — {this deal's value}" when the
// row focuses on exactly ONE feature key (e.g. "Deal structure — One-step
// merger"); a multi-key row (e.g. a rep row spanning materiality/knowledge/
// lookback — no single scalar to append) or no rowFocus at all falls back
// to the row's own label, then the parent card's title.
function rowIdentityLabel(rowFocus, card) {
  if (!rowFocus) return (card && (card.short_title || card.defined_term)) || 'Provision';
  const singleKey = Array.isArray(rowFocus.featureKeys) && rowFocus.featureKeys.length === 1
    ? rowFocus.featureKeys[0]
    : null;
  if (singleKey) {
    const features = (card && card.features && typeof card.features === 'object') ? card.features : {};
    const valueText = featureValueText(features[singleKey]);
    if (valueText) return `${rowFocus.label} — ${valueText}`;
  }
  return rowFocus.label || (card && (card.short_title || card.defined_term)) || 'Provision';
}

// (b) CORPUS CONTEXT — one categorical or numeric feature's distribution
// across the peer set, from /api/corpus-stats' rowContext.features[]. Shown
// as a single wrapped line ("One-step merger — 24 · Two-step tender — 9 ·
// Double merger — 4", per Ben's spec) with this deal's own value bolded,
// or (numeric) min/median/max + this deal's own position.
function FeatureDistribution({ feature }) {
  if (!feature) return null;
  if (feature.kind === 'numeric') {
    if (feature.min === null || feature.min === undefined) return null;
    const fmtN = (n) => {
      if (n === null || n === undefined) return '—';
      if (feature.unit) return `${Math.round(n).toLocaleString('en-US')} ${feature.unit}`;
      return fmtValue(n) || Math.round(n).toLocaleString('en-US');
    };
    return (
      <div className="mb-2.5" data-testid="feature-distribution-numeric">
        <div className="text-[10px] text-[#6B6B6B] mb-1">{feature.label}</div>
        <div className={`${BODY} text-[#1F1F1F]`}>
          Min {fmtN(feature.min)} <span className="text-[#B0B0B0]">·</span> Median {fmtN(feature.median)} <span className="text-[#B0B0B0]">·</span> Max {fmtN(feature.max)}
        </div>
        {feature.thisDealValue !== null && feature.thisDealValue !== undefined ? (
          <div className="text-[11px] text-[#2F6DB5] font-semibold mt-1">
            This deal: {fmtN(feature.thisDealValue)}
            {feature.thisDealRank !== null && feature.count > 1
              ? ` — higher than ${Math.max(0, feature.thisDealRank - 1)} of ${feature.count - 1} other peers`
              : ''}
          </div>
        ) : null}
        <div className="text-[9px] text-[#9A9A9A] mt-0.5">{feature.count} peer deals with a captured value</div>
      </div>
    );
  }
  if (!feature.values || !feature.values.length) return null;
  const shown = feature.values.slice(0, 6);
  return (
    <div className="mb-2.5" data-testid="feature-distribution-categorical">
      <div className="text-[10px] text-[#6B6B6B] mb-1">{feature.label}</div>
      <div className={`${BODY} text-[#1F1F1F]`}>
        {shown.map((v, i) => (
          <span key={v.value} style={v.isThisDeal ? { fontWeight: 700, color: '#1F1F1F' } : undefined}>
            {v.label} — {v.count}
            {v.isThisDeal ? <span className="text-[9px] text-[#2F6DB5] font-bold uppercase"> (this deal)</span> : null}
            {i < shown.length - 1 ? <span className="text-[#B0B0B0]"> · </span> : null}
          </span>
        ))}
      </div>
      <div className="text-[9px] text-[#9A9A9A] mt-0.5">of {feature.total} peer deals with a captured value</div>
    </div>
  );
}

// Instrument-scoped equity distribution (item 2): consideration/vesting
// treatment counts for ONE instrument (e.g. Stock Options), never blended
// with other instruments. rowContext.instrument comes from re-running
// equity-awards.config.js's own classification against every peer deal —
// see pages/api/corpus-stats.js's buildInstrumentDistribution.
function InstrumentDistribution({ instrument }) {
  if (!instrument || !instrument.dealsWithInstrument) return null;
  const line = (list) => (
    <div className={`${BODY} text-[#1F1F1F]`}>
      {list.map((v, i) => (
        <span key={v.label}>
          {v.label} — {v.count}
          {i < list.length - 1 ? <span className="text-[#B0B0B0]"> · </span> : null}
        </span>
      ))}
    </div>
  );
  return (
    <div data-testid="instrument-distribution">
      {instrument.considerationDistribution.length ? (
        <div className="mb-2">
          <div className="text-[10px] text-[#6B6B6B] mb-1">Consideration</div>
          {line(instrument.considerationDistribution)}
        </div>
      ) : null}
      {instrument.vestingDistribution.length ? (
        <div className="mb-2">
          <div className="text-[10px] text-[#6B6B6B] mb-1">Vesting treatment</div>
          {line(instrument.vestingDistribution)}
        </div>
      ) : null}
      <div className="text-[9px] text-[#9A9A9A]">
        {instrument.dealsWithInstrument} of {instrument.peerSetSize} peer deals carry this instrument
      </div>
    </div>
  );
}

// (item 4) List-type row values (NOSOL prohibited acts, exceptions, ...)
// render as individually clickable items -- clicking drills the sidebar
// down to that one item's own corpus frequency + verbatim quote.
function DrillItemsList({ items, onDrillItem }) {
  if (!items || !items.length) return null;
  return (
    <div data-testid="drill-items-list">
      <div className="text-[10px] text-[#6B6B6B] mb-1">Items — click one for its own corpus frequency</div>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <button
            key={`${item.label}-${i}`}
            type="button"
            onClick={() => onDrillItem(item)}
            className="border px-1.5 py-0.5 text-[10.5px] text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white transition-colors"
            style={{ borderColor: 'rgba(31,31,31,.3)' }}
            data-testid="drill-item"
          >
            {item.label} ›
          </button>
        ))}
      </div>
    </div>
  );
}

// (b) full corpus-context block: instrument distribution (if any) + each
// requested feature's distribution (if any) + clickable drill-down items
// (if any). Distinct loading/error/empty states so a row that genuinely has
// no comparable corpus data (rare) says so honestly instead of rendering
// nothing with no explanation.
function RowCorpusContext({ rowFocus, rowContext, loading, error, onDrillItem }) {
  const hasInstrument = rowContext && rowContext.instrument && rowContext.instrument.dealsWithInstrument > 0;
  const hasFeatures = rowContext && Array.isArray(rowContext.features) && rowContext.features.some((f) => f);
  const hasItems = rowFocus && Array.isArray(rowFocus.items) && rowFocus.items.length > 0;
  return (
    <div className="px-3.5 py-3 border-b-2 border-[#1F1F1F]" data-testid="row-corpus-context">
      <div className={LAB}>Corpus context</div>
      {loading ? (
        <div className="text-[11px] text-[#9A9A9A]">Loading corpus…</div>
      ) : error ? (
        <div className="text-[11px] text-[#B14E63]">Corpus context unavailable: {error}</div>
      ) : hasInstrument || hasFeatures ? (
        <>
          {hasInstrument ? <InstrumentDistribution instrument={rowContext.instrument} /> : null}
          {hasFeatures ? rowContext.features.filter(Boolean).map((f) => <FeatureDistribution key={f.attribute} feature={f} />) : null}
        </>
      ) : (
        <div className="text-[11px] text-[#9A9A9A]">No corpus comparison captured for this row yet.</div>
      )}
      {hasItems ? <div className="mt-1"><DrillItemsList items={rowFocus.items} onDrillItem={onDrillItem} /></div> : null}
    </div>
  );
}

// (item 4, depth 2) One drilled-into item: its own identity, corpus
// frequency ("appears in N of M deals"), and a back affordance. The
// item's own "View clause" is rendered by the shared ViewClauseExpander
// below (same component the row level uses), keyed off the item's quote.
function ItemDrillBlock({ drill, rowContext, loading, error, onBack }) {
  const freq = rowContext && rowContext.itemFrequency;
  return (
    <div className="px-3.5 py-3 border-b-2 border-[#1F1F1F]" data-testid="item-drill-block">
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline mb-2"
        data-testid="drill-back"
      >
        ‹ Back to row
      </button>
      <div className={LAB}>Selected item</div>
      <div className="text-[13px] font-bold text-[#1F1F1F] mb-2">{drill.label}</div>
      {loading ? (
        <div className="text-[11px] text-[#9A9A9A]">Loading corpus…</div>
      ) : error ? (
        <div className="text-[11px] text-[#B14E63]">Corpus frequency unavailable: {error}</div>
      ) : freq ? (
        <div className={`${BODY} text-[#1F1F1F]`}>
          Appears in <strong>{freq.count} of {freq.peerSetSize}</strong> peer deals
        </div>
      ) : (
        <div className="text-[11px] text-[#9A9A9A]">Corpus frequency unavailable for this item.</div>
      )}
    </div>
  );
}

// (d) "View clause" — collapsed by default, revealed on demand. Prefers the
// row's (or drilled item's) own verbatim quote, only falling back to the
// parent card's primary_quote — clearly labelled as such — when no
// row-specific quote exists at all. Replaces both the old always-visible
// "This clause" block and RowFocusBlock's always-visible verbatim.
function ViewClauseExpander({ quote, usingParentFallback, onViewInAgreement, card }) {
  if (!quote) return null;
  return (
    <details data-testid="view-clause-expander">
      <summary
        className="cursor-pointer select-none px-3.5 py-2.5 border-b border-[#E0E0E0] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] hover:text-[#1F1F1F] flex items-center justify-between"
      >
        <span>View clause</span>
        {onViewInAgreement ? (
          <button
            type="button"
            className="mtx-view-in-agreement"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewInAgreement(card); }}
            data-testid="view-in-agreement"
          >
            View in agreement ↗
          </button>
        ) : null}
      </summary>
      <div className="px-3.5 py-3">
        {usingParentFallback ? (
          <div className="text-[9.5px] text-[#9A9A9A] mb-1">Parent provision text (row-specific quote unavailable)</div>
        ) : null}
        <div className="text-[11px] leading-5 text-[#1F1F1F] whitespace-pre-wrap break-words border-l-2 border-[#1F1F1F] bg-[#F6F6F6] px-2.5 py-2 max-h-56 overflow-y-auto mtx-scrollbar-thin">
          {quote.slice(0, 1600)}{quote.length > 1600 ? '…' : ''}
        </div>
      </div>
    </details>
  );
}

// Sidebar feedback package (Ben, r5), item 3: quiet .mtx empty state shown
// while the panel is open but nothing is selected -- the panel itself is
// always mounted (pages/review/[id].js no longer conditionally renders
// ClauseSidebar), so this replaces the old "just don't render" behaviour
// and keeps the layout from jumping when a selection is cleared.
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10" data-testid="clause-sidebar-empty">
      <p className="text-[10px] text-[#9A9A9A] text-center leading-relaxed" style={{ fontFamily: 'var(--mtx-sans)' }}>
        Click a row for corpus context.
      </p>
    </div>
  );
}

export default function ClauseSidebar({ card, rowFocus = null, dealId, dealSector, onClose, onViewInAgreement }) {
  const { isEdit } = useViewMode();
  const [tab, setTab] = useState('context');
  const [filters, setFilters] = useState({ sector: '', yearFrom: '', size: '', lawFirm: '', buyer: '', form: '' });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Progressive drill-down (item 4): row -> item -> clause. null at the row
  // level; { label, itemCode, quote } once an item's been clicked.
  const [drill, setDrill] = useState(null);
  // Per-query-string response cache so re-selecting a previously-seen row
  // (or backing out of a drill) never re-fetches -- "cache per feature key
  // client-side" per spec. Keyed by the exact query string, so different
  // filter/row/drill combinations each get their own cached response.
  const cacheRef = useRef(new Map());

  const code = card ? String(card.provision_subtype || '').toUpperCase() : null;
  const rowKey = rowFocus ? `${rowFocus.label || ''}|${rowFocus.itemCode || ''}` : '';

  // A new card/row selection always starts back at the row level.
  useEffect(() => {
    setDrill(null);
  }, [card ? (card.id || card.provision_instance_id) : null, rowKey]);

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
    // Sidebar redesign: fold the row-scoped corpus-context request into the
    // SAME query -- one batched /api/corpus-stats call per row click, not
    // a second round trip. See pages/api/corpus-stats.js's rowContext.
    const featureKeys = rowFocus && Array.isArray(rowFocus.featureKeys) ? rowFocus.featureKeys : null;
    if (featureKeys && featureKeys.length) params.set('featureKeys', featureKeys.join(','));
    if (drill) {
      params.set('itemLabel', drill.label);
      if (drill.itemCode) params.set('itemCode', drill.itemCode);
    } else if (rowFocus && rowFocus.itemCode) {
      params.set('itemCode', rowFocus.itemCode);
    }
    return params.toString();
  }, [code, dealId, filters, rowFocus, drill]);

  useEffect(() => {
    if (!query) { setStats(null); return undefined; }
    const cached = cacheRef.current.get(query);
    if (cached) { setStats(cached); setError(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/corpus-stats?${query}`)
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload.error || `HTTP ${r.status}`);
        return payload;
      })
      .then((next) => {
        if (cancelled) return;
        cacheRef.current.set(query, next);
        setStats(next);
      })
      .catch((e) => { if (!cancelled) { setStats(null); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const quote = card ? (card.primary_quote || card.region_full_text || '') : '';
  const opts = (stats && stats.options) || { sectors: [], buyers: [], lawFirms: [], forms: [], lawFirmCoverage: 0 };
  const setF = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  // Row-level quote resolution (unchanged priority order from the old
  // RowFocusBlock): the row's own evidence, then the specific claim's
  // quote, only falling back to the parent card's quote — clearly labelled.
  const rowQuote = rowFocus ? (rowFocus.quote || cardFeatureQuote(card, rowFocus.featureKeys)) : null;
  const displayQuote = drill ? (drill.quote || quote) : (rowQuote || quote);
  const usingParentFallback = drill ? (!drill.quote && Boolean(quote)) : (rowFocus ? (!rowQuote && Boolean(quote)) : false);

  const identityLabel = rowIdentityLabel(rowFocus, card);
  const rowContext = stats && stats.rowContext;

  // Item 3 (r5): the panel is always mounted now (pages/review/[id].js keeps
  // ClauseSidebar rendered unconditionally) so selecting/clearing a row swaps
  // content in place instead of the whole <aside> mounting/unmounting --
  // no layout jump. The empty state below is the "nothing selected" content.
  const fullBody = card ? (
    <>
      <div className="px-3.5 py-3 border-b border-[#E0E0E0]" data-testid="row-identity">
        <div className="mtx-mono text-[9.5px] text-[#6B6B6B]">{code} · {sectionRefLabel(card.section_ref)}</div>
        <div className="text-[14px] font-bold text-[#1F1F1F] mt-0.5">{identityLabel}</div>
      </div>

      {tab === 'correct' ? (
        <CorrectTab card={card} dealId={dealId} />
      ) : (
        <>
          {rowFocus ? (
            drill ? (
              <ItemDrillBlock drill={drill} rowContext={rowContext} loading={loading} error={error} onBack={() => setDrill(null)} />
            ) : (
              <RowCorpusContext rowFocus={rowFocus} rowContext={rowContext} loading={loading} error={error} onDrillItem={setDrill} />
            )
          ) : null}

          {/* (c) Refine the peer set — the pre-existing filterable summary
              (market position / filters / common values / comparable
              deals), kept intact but collapsed by default and visually
              secondary now that (b) above answers the comparison question
              directly for the clicked row. */}
          <details className="border-b border-[#E0E0E0]" data-testid="refine-peer-set-disclosure">
            <summary className={`cursor-pointer select-none px-3.5 py-2 ${LAB_SM} hover:text-[#1F1F1F]`}>
              Refine the peer set{stats ? ` · ${stats.peerSetSize} deals` : ''}
            </summary>

            <div className="px-3.5 py-3 border-t border-[#E0E0E0]">
              <div className={LAB}>Market position</div>
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

            <div className="px-3.5 py-3 border-t border-[#E0E0E0]">
              <div className={LAB}>Filters</div>
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
              <div className="px-3.5 py-3 border-t border-[#E0E0E0]">
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
              <div className="px-3.5 py-3 border-t border-[#E0E0E0]">
                <div className={LAB}>Comparable deals with this clause · ranked by sector, size, recency</div>
                {stats.peers.slice(0, 6).map((p) => (
                  <Link
                    key={p.deal_id}
                    href={`/review/${p.deal_id}`}
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
          </details>

          <ViewClauseExpander
            quote={displayQuote}
            usingParentFallback={usingParentFallback}
            onViewInAgreement={!rowFocus && !drill ? onViewInAgreement : null}
            card={card}
          />
        </>
      )}
    </>
  ) : null;

  return (
    <aside
      className="hidden lg:flex flex-col w-[320px] shrink-0 border-l border-[#E0E0E0] bg-white sticky overflow-y-auto mtx-scrollbar-thin"
      style={{ top: 'var(--mtx-head-h, 108px)', height: 'calc(100vh - var(--mtx-head-h, 108px))', fontFamily: 'var(--mtx-sans)' }}
      data-testid="clause-sidebar"
    >
      {card ? (
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
      ) : (
        <div className="border-b border-[#E0E0E0] px-3.5 py-2">
          <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A]">Corpus context</span>
        </div>
      )}

      {card ? fullBody : <EmptyState />}
    </aside>
  );
}
