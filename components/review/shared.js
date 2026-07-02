import { useState, useRef, useContext, createContext } from 'react';
import {
  getStructuredFeatures,
  isTaggedItem,
  resolveTaggedLabel,
  isCitableValue,
  getCitableValue,
  getCitableQuotes,
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
