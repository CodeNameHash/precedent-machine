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
import { getCorpusVersion } from '../../lib/client/corpus-version.js';

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

// "This deal" lead line (sidebar r6, Ben: "clearer on what this deal's
// treatment is, as compared to alternatives") -- a bold, left-accented block
// that always sits above the peer-set distribution, distinct from it.
function ThisDealLead({ children }) {
  if (!children) return null;
  return (
    <div className="mb-2 pl-2 border-l-2 border-[#1F1F1F]" data-testid="this-deal-lead">
      {children}
    </div>
  );
}

// One deal row inside an expanded option -- deal name + two quiet links.
// "See provision →" only renders when a cardId resolved server-side (not
// every claim has one -- see pages/api/corpus-stats.js's cardIdForClaim).
function DealsExpandList({ deals }) {
  if (!deals || !deals.length) return null;
  return (
    <div className="mt-1 mb-1.5 pl-3 border-l-2 border-[#E0E0E0] space-y-1" data-testid="option-deals-list">
      {deals.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 text-[12px] text-[#1F1F1F] py-0.5">
          <span className="min-w-0 truncate pr-2">
            {d.name}
            {d.value ? <span className="mtx-mono text-[#9A9A9A]"> · {d.value}</span> : null}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <Link href={`/review/${d.id}`} className="text-[10.5px] text-[#9A9A9A] hover:text-[#1F1F1F]" data-testid="see-deal-link">
              See deal →
            </Link>
            {d.cardId ? (
              <Link href={`/review/${d.id}?card=${d.cardId}`} className="text-[10.5px] text-[#9A9A9A] hover:text-[#1F1F1F]" data-testid="see-provision-link">
                See provision →
              </Link>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

// One clickable/expandable distribution option row (sidebar r6, item 1b):
// click -> indented DealsExpandList of the deals behind this option.
// Options with no resolvable deals list (shouldn't normally happen -- every
// counted value comes from at least one claim) render inert, no chevron.
function OptionRow({ label, count, isThisDeal, deals, open, onToggle }) {
  const hasDeals = Array.isArray(deals) && deals.length > 0;
  return (
    <div>
      <button
        type="button"
        onClick={hasDeals ? onToggle : undefined}
        aria-expanded={hasDeals ? open : undefined}
        disabled={!hasDeals}
        className={`w-full flex items-center justify-between gap-2 text-left py-0.5 ${hasDeals ? 'cursor-pointer hover:bg-[#F6F6F6]' : 'cursor-default'}`}
        data-testid="distribution-option-row"
      >
        <span className={`${BODY} ${isThisDeal ? 'font-bold' : ''} text-[#1F1F1F]`}>
          {label} — {count}
          {isThisDeal ? <span className="text-[9px] text-[#2F6DB5] font-bold uppercase ml-1">This deal</span> : null}
        </span>
        {hasDeals ? (
          <span
            className="text-[9px] text-[#9A9A9A] shrink-0 transition-transform inline-block"
            style={open ? { transform: 'rotate(90deg)' } : undefined}
            aria-hidden="true"
          >
            ›
          </span>
        ) : null}
      </button>
      {hasDeals && open ? <DealsExpandList deals={deals} /> : null}
    </div>
  );
}

function useOpenOptions() {
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const toggle = (key) => setOpenKeys((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return [openKeys, toggle];
}

// (b) CORPUS CONTEXT — one categorical or numeric feature's distribution
// across the peer set, from /api/corpus-stats' rowContext.features[]. This
// deal's own treatment leads as a bold, left-accented line; the distribution
// itself sits under an "Across the peer set" micro-label, and every option
// is now a clickable row that expands to the deals behind it (sidebar r6).
function FeatureDistribution({ feature }) {
  const [openKeys, toggle] = useOpenOptions();
  if (!feature) return null;
  if (feature.kind === 'numeric') {
    if (feature.min === null || feature.min === undefined) return null;
    const fmtN = (n) => {
      if (n === null || n === undefined) return '—';
      if (feature.unit) return `${Math.round(n).toLocaleString('en-US')} ${feature.unit}`;
      return fmtValue(n) || Math.round(n).toLocaleString('en-US');
    };
    const hasValues = Array.isArray(feature.values) && feature.values.length > 0;
    const allPointsDeals = hasValues
      ? feature.values.map((v) => ({ id: v.dealId, name: v.dealName, cardId: v.cardId, value: fmtN(v.value) }))
      : [];
    return (
      <div className="mb-3" data-testid="feature-distribution-numeric">
        {feature.thisDealValue !== null && feature.thisDealValue !== undefined ? (
          <ThisDealLead>
            <div className="text-[13px] font-bold text-[#1F1F1F]">This deal: {fmtN(feature.thisDealValue)}</div>
            {feature.thisDealRank !== null && feature.count > 1 ? (
              <div className="text-[10px] text-[#6B6B6B]">
                higher than {Math.max(0, feature.thisDealRank - 1)} of {feature.count - 1} other peers
              </div>
            ) : null}
          </ThisDealLead>
        ) : null}
        <div className={LAB_SM}>Across the peer set</div>
        <div className="text-[10px] text-[#6B6B6B] mb-1 mt-1">{feature.label}</div>
        <div className={`${BODY} text-[#1F1F1F]`}>
          Min {fmtN(feature.min)} <span className="text-[#B0B0B0]">·</span> Median {fmtN(feature.median)} <span className="text-[#B0B0B0]">·</span> Max {fmtN(feature.max)}
        </div>
        <div className="text-[9px] text-[#9A9A9A] mt-0.5 mb-1">{feature.count} peer deals with a captured value</div>
        {hasValues ? (
          <OptionRow
            label="All data points"
            count={allPointsDeals.length}
            isThisDeal={false}
            deals={allPointsDeals}
            open={openKeys.has('__all__')}
            onToggle={() => toggle('__all__')}
          />
        ) : null}
      </div>
    );
  }
  if (!feature.values || !feature.values.length) return null;
  const shown = feature.values.slice(0, 6);
  return (
    <div className="mb-3" data-testid="feature-distribution-categorical">
      {feature.thisDealValue ? (
        <ThisDealLead>
          <div className="text-[13px] font-bold text-[#1F1F1F]">This deal: {feature.thisDealValue}</div>
        </ThisDealLead>
      ) : null}
      <div className={LAB_SM}>Across the peer set</div>
      <div className="text-[10px] text-[#6B6B6B] mb-1 mt-1">{feature.label}</div>
      <div>
        {shown.map((v) => (
          <OptionRow
            key={v.value}
            label={v.label}
            count={v.count}
            isThisDeal={v.isThisDeal}
            deals={v.deals}
            open={openKeys.has(v.value)}
            onToggle={() => toggle(v.value)}
          />
        ))}
      </div>
      <div className="text-[9px] text-[#9A9A9A] mt-0.5">of {feature.total} peer deals with a captured value</div>
    </div>
  );
}

// Instrument-scoped equity distribution (item 2) — the PSU example from
// Ben's feedback: consideration/vesting treatment counts for ONE instrument
// (e.g. Stock Options / PSUs), never blended with other instruments.
// rowContext.instrument comes from re-running equity-awards.config.js's own
// classification against every peer deal — see pages/api/corpus-stats.js's
// buildInstrumentDistribution. This deal's own consideration/vesting labels
// lead the block (r6); every other label is a clickable option row.
function InstrumentDistribution({ instrument }) {
  const [openKeys, toggle] = useOpenOptions();
  if (!instrument || !instrument.dealsWithInstrument) return null;
  const list = (items, prefix) => (
    <div>
      {items.map((v) => {
        const key = `${prefix}:${v.label}`;
        return (
          <OptionRow
            key={key}
            label={v.label}
            count={v.count}
            isThisDeal={Boolean(v.isThisDeal)}
            deals={v.deals}
            open={openKeys.has(key)}
            onToggle={() => toggle(key)}
          />
        );
      })}
    </div>
  );
  const thisDeal = instrument.thisDeal;
  return (
    <div data-testid="instrument-distribution">
      {thisDeal ? (
        <ThisDealLead>
          <div className="text-[13px] font-bold text-[#1F1F1F]">
            This deal:{' '}
            {[thisDeal.considerationLabel, thisDeal.vestingLabel].filter(Boolean).join(' · ') || '—'}
          </div>
        </ThisDealLead>
      ) : null}
      <div className={LAB_SM}>Across the peer set</div>
      {instrument.considerationDistribution.length ? (
        <div className="mb-2 mt-1.5">
          <div className="text-[10px] text-[#6B6B6B] mb-1">Consideration</div>
          {list(instrument.considerationDistribution, 'consid')}
        </div>
      ) : null}
      {instrument.vestingDistribution.length ? (
        <div className="mb-2">
          <div className="text-[10px] text-[#6B6B6B] mb-1">Vesting treatment</div>
          {list(instrument.vestingDistribution, 'vest')}
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

// r13 (Ben, "No corpus comparison captured" investigation): a row only ever
// gets a rowContext.features/instrument answer when it actually ASKED for
// one -- resolveRowFocus (provisionIndexHelpers.js) only sends featureKeys/
// itemCode to /api/corpus-stats when the row carries them. Some row shapes
// (a bundled negative-covenant row spanning several taxonomy attributes,
// GroupedSubRows fragment rows sniffed from deal-specific quote text) never
// carry either -- for those, "no corpus comparison" was never really TRUE or
// FALSE, the question was simply never asked. Distinguishing that from a row
// that DID ask and came back empty (a genuine, honest gap -- e.g. an
// attribute with fewer than 2 peer deals of coverage) matters: the former is
// a quieter, lower-alarm line; the latter keeps the original wording.
function rowRequestedCorpusContext(rowFocus) {
  if (!rowFocus) return false;
  if (Array.isArray(rowFocus.featureKeys) && rowFocus.featureKeys.length) return true;
  if (rowFocus.itemCode) return true;
  return false;
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
  const requested = rowRequestedCorpusContext(rowFocus);
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
      ) : requested ? (
        <div className="text-[11px] text-[#9A9A9A]" data-testid="row-corpus-context-empty-genuine">No corpus comparison captured for this row yet.</div>
      ) : (
        <div className="text-[10px] text-[#B0B0B0]" data-testid="row-corpus-context-empty-uncomparable">This row doesn&apos;t map to a single comparable feature.</div>
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
        className={`cursor-pointer select-none px-3.5 py-2.5 border-b border-[#E0E0E0] ${LAB_SM} hover:text-[#1F1F1F] flex items-center justify-between`}
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
        {/* E (truncation sweep): this box already scrolls (max-h-56
            overflow-y-auto) so slicing the quote at 1600 chars and
            appending a literal "…" both hid text AND showed the banned
            ellipsis for no reason -- the scroll affordance already lets a
            long quote be read in full. Render the whole quote. */}
        <div className="text-[11px] leading-5 text-[#1F1F1F] whitespace-pre-wrap break-words border-l-2 border-[#1F1F1F] bg-[#F6F6F6] px-2.5 py-2 max-h-56 overflow-y-auto mtx-scrollbar-thin">
          {quote}
        </div>
      </div>
    </details>
  );
}

// Visible failure state (Ben, DB-down incident): the corpus-stats fetch
// used to fail silently-empty whenever the focused row had no rowFocus (the
// only error surface was inside the collapsed "Refine the peer set"
// disclosure, invisible unless a user happened to expand it). This renders
// right under the row identity, always mounted regardless of rowFocus, so a
// failed or timed-out fetch is never silent: a quiet retry line on error, a
// subtle loading indicator while in flight, nothing when idle/succeeded.
function CorpusContextStatus({ loading, error, onRetry }) {
  if (error) {
    return (
      <div className="px-3.5 py-2 border-b border-[#E0E0E0] flex items-center justify-between gap-2" data-testid="corpus-context-status-error">
        <span className="text-[10px] text-[#B14E63]">Couldn&apos;t load corpus context</span>
        <button
          type="button"
          onClick={onRetry}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline shrink-0"
          data-testid="corpus-context-retry"
        >
          Retry
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="px-3.5 py-2 border-b border-[#E0E0E0] flex items-center gap-1.5" data-testid="corpus-context-status-loading">
        <span className="mtx-loading-dot" aria-hidden="true" />
        <span className="text-[9.5px] text-[#9A9A9A]">Loading corpus context…</span>
      </div>
    );
  }
  return null;
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

  // Bumped by retry() to force a re-fetch of the current query, bypassing
  // the response cache -- the DB-down incident showed a failed fetch had no
  // visible recovery path (see CorpusContextStatus below).
  const [retryNonce, setRetryNonce] = useState(0);

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

  // Corpus-stats fetch timeout: the DB-down incident showed a stalled
  // request just spins forever with no visible failure -- bound it so a
  // hung backend surfaces as a retryable error instead of infinite loading.
  const CORPUS_STATS_TIMEOUT_MS = 15000;

  useEffect(() => {
    if (!query) { setStats(null); setError(null); setLoading(false); return undefined; }
    // retryNonce > 0 means the user explicitly asked to retry -- always
    // bypass the cache in that case so a stale failure/hang isn't replayed.
    const cached = retryNonce === 0 ? cacheRef.current.get(query) : null;
    if (cached) { setStats(cached); setError(null); setLoading(false); return undefined; }
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CORPUS_STATS_TIMEOUT_MS);
    setLoading(true);
    setError(null);
    // r13 (corpus-version cache token): never block this fetch on the
    // version probe -- getCorpusVersion() itself always resolves within its
    // own ~2s cap (null on failure/timeout), so awaiting it here adds at
    // most that cap, then proceeds tokenless exactly like before.
    getCorpusVersion()
      .then((version) => fetch(`/api/corpus-stats?${query}${version ? `&v=${encodeURIComponent(version)}` : ''}`, { signal: controller.signal }))
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
      .catch((e) => {
        if (cancelled) return;
        setStats(null);
        setError(e.name === 'AbortError' ? 'Timed out' : (e.message || 'Request failed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort(); };
  }, [query, retryNonce]);

  const retry = () => setRetryNonce((n) => n + 1);

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
  // Ancillary, muted, END-of-identity-block only -- the machine type code
  // (e.g. CONSID-EQUITY) never renders; the section ref may, small and quiet.
  const sectionRefText = card ? sectionRefLabel(card.section_ref) : '';
  const rowContext = stats && stats.rowContext;

  // Item 3 (r5): the panel is always mounted now (pages/review/[id].js keeps
  // ClauseSidebar rendered unconditionally) so selecting/clearing a row swaps
  // content in place instead of the whole <aside> mounting/unmounting --
  // no layout jump. The empty state below is the "nothing selected" content.
  const fullBody = card ? (
    <>
      <div className="px-3.5 py-3 border-b border-[#E0E0E0]" data-testid="row-identity">
        <div className="text-[15px] font-bold text-[#1F1F1F] leading-tight">{identityLabel}</div>
        {sectionRefText ? (
          <div className="mtx-mono text-[9px] text-[#9A9A9A] mt-1" data-testid="row-identity-section-ref">{sectionRefText}</div>
        ) : null}
      </div>

      <CorpusContextStatus loading={loading} error={error} onRetry={retry} />

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
