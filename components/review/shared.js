import { useState, useRef, useContext, createContext } from 'react';
import {
  getAiMetadata,
  getStructuredFeatures,
  isTaggedItem,
  resolveTaggedLabel,
  isCitableValue,
  getCitableValue,
  getCitableQuotes,
  getCitableText,
  TOOLTIP_MAX,
} from '../../lib/citable';

/* Citation / evidence helpers (isCitableValue, getCitableValue,
 * getCitableQuotes, getCitableText, resolveEvidence, evidenceQuote) now live
 * in lib/citable.js (imported above). The EvidenceContext below lets any
 * nested renderer pop a quote into the full-doc view without prop-drilling. */
export const EvidenceContext = createContext({
  showEvidence: null,
  // P5 item 7: selection-mode for picking evidence by selecting text in the
  // FullDocumentView. selectionMode is { active, onSelect, label } or null.
  selectionMode: null,
  startSelectionMode: null,
  endSelectionMode: null,
});

export function useEvidenceSelectionMode() {
  return useContext(EvidenceContext);
}

export function useShowEvidence() {
  const ctx = useContext(EvidenceContext);
  return ctx && typeof ctx.showEvidence === 'function' ? ctx.showEvidence : null;
}

/* ── EvidenceQuote: small italic block beneath a citable value.
 *    Clicking jumps to the Full Document tab and highlights the quote.
 *    Renders an italic "(no evidence captured)" placeholder when empty.
 *    Multi-quote: pass `quotes={[...]}` to render an "N sources" pill that
 *    expands a stacked list, each quote independently clickable. */
export function EvidenceQuote({ text, quotes, dense }) {
  const showEvidence = useShowEvidence();
  const [expanded, setExpanded] = useState(false);

  // Normalize to array of quotes.
  const list = (() => {
    if (Array.isArray(quotes)) {
      return quotes.map((q) => String(q || '').trim()).filter(Boolean);
    }
    const t = (text || '').trim();
    return t ? [t] : [];
  })();

  if (list.length === 0) {
    return (
      <span className={`block ${dense ? 'text-[10px]' : 'text-[11px]'} font-ui italic text-inkFaint/70 mt-0.5`}>
        (no evidence captured)
      </span>
    );
  }

  const baseCls = `block ${dense ? 'text-[10px]' : 'text-[11px]'} font-ui italic mt-0.5 ${
    showEvidence
      ? 'text-amber-700 hover:text-amber-900 cursor-pointer hover:underline decoration-dotted'
      : 'text-amber-700'
  }`;

  // Single-quote: render exactly as before for backwards compatibility.
  if (list.length === 1) {
    const q = list[0];
    const display = q.length > 240 ? q.slice(0, 237) + '…' : q;
    return (
      <span
        className={baseCls}
        onClick={showEvidence ? () => showEvidence(q) : undefined}
        title={showEvidence ? 'Click to view in document' : q}
      >
        &ldquo;{display}&rdquo;
        {showEvidence ? <span className="not-italic text-amber-500 ml-1">&rarr;</span> : null}
      </span>
    );
  }

  // Multi-quote: small "N sources" pill that toggles a stacked list.
  return (
    <span className="block mt-0.5">
      <button
        type="button"
        className={`inline-flex items-center gap-1 text-[10px] font-ui px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 ${dense ? '' : ''}`}
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        title={`${list.length} supporting quotes`}
      >
        {list.length} sources
        <span className="not-italic">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <span className="block mt-1 space-y-1">
          {list.map((q, i) => {
            const display = q.length > 240 ? q.slice(0, 237) + '…' : q;
            return (
              <span
                key={i}
                className={baseCls}
                onClick={showEvidence ? (e) => { e.stopPropagation(); showEvidence(q); } : undefined}
                title={showEvidence ? 'Click to view in document' : q}
              >
                &ldquo;{display}&rdquo;
                {showEvidence ? <span className="not-italic text-amber-500 ml-1">&rarr;</span> : null}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

// Humanize a taxonomy code for display: "ACCELERATED_VESTING" → "Accelerated Vesting".
// Falls back to the raw code if it doesn't look like an UPPER_SNAKE code.
export function humanizeBadgeText(code) {
  if (!code) return '';
  // Case-insensitive UPPER_SNAKE / lower_snake detection: any token of letters/
  // digits separated by underscores gets title-cased so values like
  // "one_step_merger" and "ONE_STEP_MERGER" both render as "One Step Merger".
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code) || !/_/.test(code)) {
    if (/^[A-Z][A-Z0-9_]*$/.test(code)) {
      // Pure UPPER without underscores (rare) — title case it.
      return code[0] + code.slice(1).toLowerCase();
    }
    return code;
  }
  return code
    .toLowerCase()
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/* Small inline badge for a canonical taxonomy code (e.g. "WHOLLY_OWNED_SUB"). */
export function CodeBadge({ code, label }) {
  if (!code && !label) return null;
  return (
    <span className="inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
      {label || humanizeBadgeText(code)}
    </span>
  );
}

/* HoverSource — wraps any cell content and surfaces the row's source language
 * in a small amber popover that appears immediately on hover (no 1-second
 * native-title delay). Click-through still works via the wrapped children;
 * the popover is positioned absolutely below the trigger and uses pointer-
 * events:none so it never blocks the underlying click. On touch devices
 * (which never fire mouseenter), a touchstart on the wrapper reveals the
 * popover for ~2.5s — the underlying tap action still fires normally. */
export function HoverSource({ quote, children, as = 'span', className, align = 'left' }) {
  const [show, setShow] = useState(false);
  // Fixed-position coords computed from the trigger rect on show, so the
  // popover renders above the table's overflow clip rather than inside it.
  const [pos, setPos] = useState(null);
  const hideTimerRef = useRef(null);
  const triggerRef = useRef(null);
  const Tag = as;
  if (!quote || typeof quote !== 'string' || !quote.trim()) {
    return <Tag className={className}>{children}</Tag>;
  }
  const trimmed = quote.trim().replace(/\s+/g, ' ');
  const display = trimmed.length > TOOLTIP_MAX ? trimmed.slice(0, TOOLTIP_MAX) + '…' : trimmed;
  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  // Compute fixed coords from the trigger rect. Flip ABOVE the trigger when it
  // sits in the lower 45% of the viewport so the popover never falls off (or
  // gets clipped at) the bottom of the table / screen.
  const computePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const flipUp = r.bottom > window.innerHeight * 0.55;
    const left = align === 'right' ? undefined : Math.min(r.left, window.innerWidth - 500);
    const right = align === 'right' ? Math.max(8, window.innerWidth - r.right) : undefined;
    setPos({
      left,
      right,
      top: flipUp ? undefined : r.bottom + 4,
      bottom: flipUp ? window.innerHeight - r.top + 4 : undefined,
    });
  };
  const open = () => { clearHideTimer(); computePos(); setShow(true); };
  const handleTouchStart = () => {
    open();
    // Auto-hide after 2.5s so the popover doesn't linger after the user taps
    // through to the evidence view.
    hideTimerRef.current = setTimeout(() => setShow(false), 2500);
  };
  return (
    <Tag
      ref={triggerRef}
      className={className}
      onMouseEnter={open}
      onMouseLeave={() => setShow(false)}
      onTouchStart={handleTouchStart}
    >
      {children}
      {show && pos && (
        <span
          role="tooltip"
          className="fixed z-[100] max-w-[480px] min-w-[280px] bg-amber-50 border border-amber-300 rounded shadow-lg px-3 py-2 text-[11px] italic text-amber-900 font-body whitespace-pre-wrap break-words leading-relaxed"
          style={{
            pointerEvents: 'none',
            left: pos.left,
            right: pos.right,
            top: pos.top,
            bottom: pos.bottom,
          }}
        >
          &ldquo;{display}&rdquo;
        </span>
      )}
    </Tag>
  );
}

/* ── Standard left label-column width for all review tables (block 8).
 *    Matches the Closing Conditions table's Condition column so the label
 *    column lines up as the eye moves from table to table. */
export const REVIEW_LABEL_COL_W = 'w-[240px]';

/* ── Pill: canonical inline chip for a resolved, plain-English value
 *    (dollar amount, standard, taxonomy code, person, materiality
 *    qualifier). Consolidates several near-identical local `Pill` helpers
 *    that had drifted in size/padding across TERMR/TERMF/knowledge/
 *    materiality cells — same visual weight everywhere now. Per the table
 *    design contract, the pill carries the plain-English label; the
 *    verbatim source text is reachable only via hover (and click-to-source
 *    when `quote` + EvidenceContext are both available). `tone` picks the
 *    color family; unrecognized tones fall back to `neutral`. */
const PILL_TONES = {
  neutral: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  standard: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  person: 'bg-sky-50 text-sky-700 border-sky-200',
  materiality: 'bg-rose-50 text-rose-700 border-rose-200',
  amount: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function Pill({ text, quote, tone = 'neutral', onClick, className = '' }) {
  const showEvidence = useShowEvidence();
  if (text === null || text === undefined || text === '') return null;
  const colorCls = PILL_TONES[tone] || PILL_TONES.neutral;
  const inner = (
    <span className={`inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${colorCls} ${className}`}>
      {text}
    </span>
  );
  const handler = onClick || (quote && showEvidence ? () => showEvidence(quote) : null);
  const body = handler ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handler(e); }}
      className="cursor-pointer hover:opacity-80"
    >
      {inner}
    </button>
  ) : inner;
  return quote ? <HoverSource quote={quote}>{body}</HoverSource> : body;
}

// P7 item 25: render a list-valued cell as a real <ul> of bullets. Tagged
// items resolve to their label (with optional code badge). Strings render
// as-is. Citable items inside the array are unwrapped to the inner value
// and the quote shows under the bullet.
export function renderListAsBullets(featureKey, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  // If long, summarize with an "N items" pill (caller can swap to a
  // collapsible). Threshold: 6.
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {items.map((item, idx) => {
        // Unwrap citable
        const innerRaw = isCitableValue(item) ? getCitableValue(item) : item;
        const quotes = isCitableValue(item) ? getCitableQuotes(item) : [];
        let body;
        if (isTaggedItem(innerRaw)) {
          // ONE canonical pill carrying the resolved label — do NOT also render
          // the code-humanized badge + a separate label span (that produced the
          // doubled "Risk Factors / Risk Factors" display).
          const label = resolveTaggedLabel(featureKey, innerRaw) || humanizeBadgeText(innerRaw.code);
          body = <CodeBadge code={innerRaw.code} label={label} />;
        } else if (innerRaw === null || innerRaw === undefined || innerRaw === '') {
          return null;
        } else {
          body = <span>{String(innerRaw)}</span>;
        }
        return (
          <li key={idx} className="whitespace-pre-wrap break-words">
            {body}
            {quotes && quotes.length > 0 ? <EvidenceQuote quotes={quotes} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

// Pull the first non-empty value across `provisions` for any of `keys`.
export function pickFirstNonEmpty(provisions, keys) {
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    for (const k of keys) {
      const v = f[k];
      if (v === null || v === undefined || v === '' || v === false) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      return { value: v, key: k, provision: p };
    }
  }
  return null;
}

// Render a single row's value cell. Returns either a React node (for italic
// "Not present" placeholder, list count+snippet, or tagged label) or a string.
export function renderSummaryRowValue(hit, featureKeyForLookup) {
  if (hit === null || hit === undefined) {
    return (
      <span className="italic text-inkFaint">Not present in this agreement</span>
    );
  }
  let v = hit.value;
  const key = hit.key || featureKeyForLookup;

  // Unwrap citable wrapper.
  if (isCitableValue(v)) v = getCitableValue(v);

  // Tagged single value → show the resolved label.
  if (isTaggedItem(v)) {
    const label = resolveTaggedLabel(key, v) || v.label || v.code;
    return <span>{prettifyEnumValue(key, label)}</span>;
  }

  // List value → bullets (P8 item 6: universal list-as-bullets).
  // Previously rendered as comma-joined "N items · first, second, third…"
  // which hid the per-item structure on NosolMiniTable rows. Now we delegate
  // to the same renderListAsBullets helper used by renderFeatureCell so the
  // two paths stay consistent.
  if (Array.isArray(v)) {
    if (v.length === 0) {
      return <span className="italic text-inkFaint">Not present in this agreement</span>;
    }
    const bullets = renderListAsBullets(key, v);
    if (bullets) return bullets;
    return <span className="italic text-inkFaint">Not present in this agreement</span>;
  }

  // Boolean / scalar.
  if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
  if (v === null || v === undefined || v === '') {
    return <span className="italic text-inkFaint">Not present in this agreement</span>;
  }
  return <span>{prettifyEnumValue(key, String(v))}</span>;
}

/* Lowercase taxonomy enum strings ("cash-with-cvr", "all-cash") leak into the
 * summary tables verbatim when the rubric value is a plain string rather than
 * a tagged item. Map them to readable labels here so e.g. CVR stays capitalized
 * in the Consideration Type cell. Only the keys we've explicitly catalogued
 * are remapped — anything else passes through. */
export function prettifyEnumValue(key, raw) {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  if (key === 'considerationType') {
    const map = {
      'all-cash': 'All cash',
      'all-stock': 'All stock',
      'mixed-cash-and-stock': 'Mixed cash and stock',
      'cash-with-cvr': 'Cash with CVR',
    };
    const hit = map[raw.toLowerCase()];
    if (hit) return hit;
    return raw.replace(/\bcvr\b/gi, 'CVR');
  }
  return raw;
}

/* ── Provision Type Colors (pastel backgrounds for highlights) ── */
const TYPE_COLORS = {
  'MAE':    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'MAE-T':  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'MAE-B':  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'IOC':    { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'IOC-T':  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'IOC-B':  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'COND':   { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400',   hex: '#eff6ff' },
  'COND-M': { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400',   hex: '#eff6ff' },
  'COND-B': { bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-800',    dot: 'bg-sky-400',    hex: '#f0f9ff' },
  'COND-S': { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-400', hex: '#eef2ff' },
  'NOSOL':  { bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400', hex: '#faf5ff' },
  'NOSOL-T':{ bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400', hex: '#faf5ff' },
  'NOSOL-B':{ bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400', hex: '#faf5ff' },
  'ANTI':   { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-800',   dot: 'bg-teal-400',   hex: '#f0fdfa' },
  'TERMR':  { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-M':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-B':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-T':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMF':  { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-800',   dot: 'bg-rose-400',   hex: '#fff1f2' },
  'REP':    { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-T':  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-B':  { bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-400',  hex: '#f0fdf4' },
  'COV':    { bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-800',   dot: 'bg-cyan-400',   hex: '#ecfeff' },
  'DEF':    { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
  'STRUCT': { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-400', hex: '#f5f3ff' },
  'CONSID': { bg: 'bg-lime-50',    border: 'border-lime-200',   text: 'text-lime-800',   dot: 'bg-lime-400',   hex: '#f7fee7' },
  'MISC':   { bg: 'bg-stone-50',   border: 'border-stone-200',  text: 'text-stone-700',  dot: 'bg-stone-400',  hex: '#fafaf9' },
  'OTHER':  { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
};

/* ── Recital provision-type hex colors (used for dots, ref chips, section heads) ── */
const TYPE_HEX = {
  STRUCT:   '#7459A6',
  CONSID:   '#2F8B7E',
  DEF:      '#4E6FA6',
  IOC:      '#B5862E',
  'IOC-T':  '#B5862E',
  'IOC-B':  '#B5862E',
  NOSOL:    '#A8538C',
  'NOSOL-T':'#A8538C',
  'NOSOL-B':'#A8538C',
  ANTI:     '#2F8FA8',
  COND:     '#5660B0',
  'COND-M': '#5660B0',
  'COND-B': '#5660B0',
  'COND-S': '#5660B0',
  TERMR:    '#C0673A',
  'TERMR-M':'#C0673A',
  'TERMR-B':'#C0673A',
  'TERMR-T':'#C0673A',
  TERMF:    '#B14E63',
  REP:      '#3F8A6A',
  'REP-T':  '#3F8A6A',
  'REP-B':  '#3F8A6A',
  COV:      '#6E8AA8',
  MAE:      '#8B5B3A',
  'MAE-T':  '#8B5B3A',
  'MAE-B':  '#8B5B3A',
  'MAE-DEF':'#8B5B3A',
  'MAE-DEF-P':'#8B5B3A',
  MISC:     '#8A8782',
  OTHER:    '#8A8782',
};

export function typeHex(code) {
  return TYPE_HEX[code] || '#8A8782';
}

export function typeColor(code) {
  return TYPE_COLORS[code] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400', hex: '#f9fafb' };
}

/* ── Sidebar grouping — parent groups with optional sub-types ── */
export const SIDEBAR_GROUPS = [
  { label: 'Structure & Mechanics', types: ['STRUCT'] },
  { label: 'Consideration', types: ['CONSID'] },
  { label: 'Representations', children: [
    { label: 'Company / Target', type: 'REP-T' },
    { label: 'Buyer / Parent', type: 'REP-B' },
    { label: 'Material Contracts', type: '__MATERIAL_CONTRACTS' },
  ]},
  { label: 'Material Adverse Effect', children: [
    { label: 'Company Material Adverse Effect', type: 'MAE-DEF' },
    { label: 'Parent Material Adverse Effect', type: 'MAE-DEF-P' },
  ]},
  { label: 'Interim Operating Covenants', children: [
    { label: 'Company / Target', type: 'IOC-T' },
    { label: 'Buyer / Parent', type: 'IOC-B' },
  ]},
  { label: 'No-Solicitation / No-Shop', children: [
    { label: 'Company / Target', type: 'NOSOL-T' },
    { label: 'Buyer / Parent', type: 'NOSOL-B' },
  ]},
  { label: 'Antitrust / Regulatory', types: ['ANTI'] },
  { label: 'Conditions to Closing', types: ['COND-M', 'COND-B', 'COND-S', 'COND'], singleType: 'COND-M' },
  { label: 'Termination Rights', types: ['TERMR-M', 'TERMR-B', 'TERMR-T', 'TERMR'], singleType: 'TERMR-M' },
  { label: 'Termination Fees', types: ['TERMF'] },
  { label: 'Other Covenants', types: ['COV'] },
  { label: 'Definitions', types: ['DEF'] },
  { label: 'Miscellaneous / Boilerplate', types: ['MISC'] },
  { label: 'Other', types: ['OTHER'] },
];

/* Synthetic, single-page sidebar types: the child label itself IS the page
 * (a curated summary), so the sidebar should NOT show a count or a nested
 * per-provision sub-list under it. */
export const SYNTHETIC_SINGLE_PAGE_TYPES = new Set(['MAE-DEF', 'MAE-DEF-P', '__MATERIAL_CONTRACTS']);

export function getProvisionStatus(p) {
  if (p._status === 'approved') return 'approved';
  if (p._status === 'flagged') return 'flagged';
  return 'unreviewed';
}

/* ── Type & Term Labels ── */
const TYPE_LABELS = {
  'MAE-T': 'Material Adverse Effect (Target)',
  'MAE-B': 'Material Adverse Effect (Buyer)',
  'MAE': 'Material Adverse Effect',
  'MAE-DEF': 'Material Adverse Effect (Company)',
  'MAE-DEF-P': 'Material Adverse Effect (Parent)',
  // P8 item 3: synthetic UI-only type — surfaces matching REP-T provisions
  // (Material Contracts checklist) on their own sidebar page so the buckets
  // table isn't buried inline on the REP-T page.
  '__MATERIAL_CONTRACTS': 'Material Contracts',
  'IOC-T': 'Interim Operating Covenants (Target)',
  'IOC-B': 'Interim Operating Covenants (Buyer)',
  'IOC': 'Interim Operating Covenants',
  'COND-M': 'Conditions to Closing (Mutual)',
  'COND-B': 'Conditions to Closing (Buyer)',
  'COND-S': 'Conditions to Closing (Seller)',
  'COND': 'Conditions to Closing',
  'NOSOL': 'No-Solicitation / No-Shop',
  'NOSOL-T': 'No-Solicitation (Target / Company)',
  'NOSOL-B': 'No-Solicitation (Buyer / Parent)',
  'ANTI': 'Antitrust / Regulatory',
  'TERMR-M': 'Termination Rights (Mutual)',
  'TERMR-B': 'Termination Rights (Buyer)',
  'TERMR-T': 'Termination Rights (Target)',
  'TERMR': 'Termination Rights',
  'TERMF': 'Termination Fees & Expenses',
  'REP-T': 'Representations & Warranties (Target)',
  'REP-B': 'Representations & Warranties (Buyer)',
  'REP': 'Representations & Warranties',
  'COV': 'Other Covenants',
  'DEF': 'Definitions',
  'STRUCT': 'Structure & Mechanics',
  'CONSID': 'Consideration',
  'MISC': 'Miscellaneous / Boilerplate',
  'OTHER': 'Other Provisions',
};

export function typeLabel(code) {
  return TYPE_LABELS[code] || code;
}

export { TYPE_LABELS };

const FAV_LABELS = {
  'strong-buyer': { label: 'Strong Buyer', cls: 'bg-buyer/10 text-buyer', pos:  2 },
  'mod-buyer':    { label: 'Mod. Buyer',   cls: 'bg-buyer/10 text-buyer', pos:  1 },
  'buyer':        { label: 'Buyer',        cls: 'bg-buyer/10 text-buyer', pos:  1 },
  'neutral':      { label: 'Balanced',     cls: 'bg-gray-100 text-inkLight', pos: 0 },
  'mod-seller':   { label: 'Mod. Seller',  cls: 'bg-seller/10 text-seller', pos: -1 },
  'strong-seller':{ label: 'Strong Seller',cls: 'bg-seller/10 text-seller', pos: -2 },
  'seller':       { label: 'Seller',       cls: 'bg-seller/10 text-seller', pos: -1 },
};

export function favBadge(fav) {
  return FAV_LABELS[(fav || '').toLowerCase()] || FAV_LABELS.neutral;
}

/* ── Parse features from ai_metadata (flat chip list for backward-compat) ── */
export function getFeatures(provision) {
  const meta = getAiMetadata(provision);
  if (!meta) return [];
  if (meta.key_terms) return meta.key_terms;
  if (meta.features && typeof meta.features === 'object' && !Array.isArray(meta.features)) {
    return Object.entries(meta.features)
      .filter(([, v]) => {
        if (v === null || v === undefined || v === '' || v === false) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      })
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.length} item${v.length === 1 ? '' : 's'}`;
        if (typeof v === 'boolean') return k;
        if (v && typeof v === 'object' && 'code' in v) {
          return `${k}: ${v.label || v.code}`;
        }
        return `${k}: ${v}`;
      });
  }
  return [];
}

/* P5 item 8: deal-scoped custom taxonomy extensions.
 *   Shape: { [featureKey]: [{ code, label, synonyms? }] }
 *   Stored on deals.metadata.custom_taxonomy_extensions and threaded into
 *   render paths via CustomTaxonomyContext so the picker can show + resolve
 *   custom options alongside canonical taxonomy entries. */
export const CustomTaxonomyContext = createContext({ extensions: {} });
export function useCustomTaxonomy() {
  return useContext(CustomTaxonomyContext).extensions || {};
}
export function getCustomExtensionsForKey(extensions, featureKey) {
  if (!extensions || typeof extensions !== 'object') return [];
  const list = extensions[featureKey];
  return Array.isArray(list) ? list : [];
}

/* ── Friendly label conversion (camelCase / snake_case → Title Case) ── */
// Feature keys whose human-readable label should override the default
// camelCase humanization. Keeps the underlying data key intact (e.g.
// `mainConcept` in the rubric / DB) while presenting "Provision" in the UI.
const HUMANIZE_KEY_OVERRIDES = {
  mainConcept: 'Provision',
  // P3 item 15: drop the "Linked" prefix — the derived value is the bring-
  // down standard for this rep, not a "linked" copy.
  linkedBringDownStandard: 'Bring Down Standard',
};

export function humanizeKey(key) {
  if (HUMANIZE_KEY_OVERRIDES[key]) return HUMANIZE_KEY_OVERRIDES[key];
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/* Returns true when a feature value is considered "empty" for display. */
export function isEmptyValue(raw) {
  if (raw === null || raw === undefined) return true;
  if (raw === '') return true;
  if (Array.isArray(raw) && raw.length === 0) return true;
  // Citable shape — empty if the inner value is empty AND there is no quote.
  if (isCitableValue(raw)) {
    const inner = getCitableValue(raw);
    const hasInner = !(inner === null || inner === undefined || inner === '');
    if (hasInner) return false;
    return !getCitableText(raw);
  }
  return false;
}
