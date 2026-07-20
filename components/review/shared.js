import { useState, useContext, createContext } from 'react';
import { renderFeatureValue as schemaRenderFeatureValue } from '../../lib/schema';
import {
  getAiMetadata,
  getStructuredFeatures,
  isTaggedItem,
  resolveTaggedLabel,
  isCitableValue,
  getCitableValue,
  getCitableQuotes,
  getCitableText,
} from '../../lib/citable';
import { taxonomyForFeatureKey, labelForCode } from '../../lib/taxonomy';
import { isFlagItem } from '../../lib/flag-item';

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
    // E (truncation sweep): drop the literal "…" -- the quote is already
    // click-to-view-in-document (showEvidence) and carries the full text in
    // its `title` tooltip, so a clean cut needs no ellipsis marker.
    const display = q.length > 240 ? q.slice(0, 237).trim() : q;
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
            // E (truncation sweep): drop the literal "…" -- the quote is already
    // click-to-view-in-document (showEvidence) and carries the full text in
    // its `title` tooltip, so a clean cut needs no ellipsis marker.
    const display = q.length > 240 ? q.slice(0, 237).trim() : q;
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

// Acronyms that should stay fully capitalized when a code is split into
// words (e.g. "CashCvr" → "Cash CVR", not "Cash Cvr").
const HUMANIZE_ACRONYMS = new Set(['CVR', 'MAE', 'IOC', 'IP', 'FDA', 'HSR', 'CEO', 'CFO', 'ESPP', 'RSU', 'PSU', 'SAR', 'DGCL']);
const titleCaseWord = (w) => {
  if (!w) return '';
  const upper = w.toUpperCase();
  return HUMANIZE_ACRONYMS.has(upper) ? upper : w[0].toUpperCase() + w.slice(1).toLowerCase();
};

// Humanize a taxonomy code for display: "ACCELERATED_VESTING" → "Accelerated Vesting".
// Falls back to the raw code if it doesn't look like a recognizable code shape.
export function humanizeBadgeText(code) {
  if (!code) return '';
  // Case-insensitive UPPER_SNAKE / lower_snake detection: any token of letters/
  // digits separated by underscores gets title-cased so values like
  // "one_step_merger" and "ONE_STEP_MERGER" both render as "One Step Merger".
  if (/_/.test(code) && /^[A-Za-z][A-Za-z0-9_]*$/.test(code)) {
    return code.split('_').map(titleCaseWord).join(' ');
  }
  if (/^[A-Z][A-Z0-9]*$/.test(code)) {
    // Pure UPPER without underscores (rare) — title case it, unless it's a
    // known acronym that must stay fully capitalized (e.g. "CVR" must not
    // become "Cvr" — this is what let a bare CodeBadge code="CVR" render
    // as "Cvr" and run together with an adjacent "Cash" badge as "CashCvr").
    return HUMANIZE_ACRONYMS.has(code) ? code : code[0] + code.slice(1).toLowerCase();
  }
  // PascalCase / camelCase without underscores (e.g. "CashCvr") — split at
  // capital-letter boundaries and title-case each word so a raw slug never
  // leaks into the UI unchanged (audit block 6b).
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(code) && /[a-z]/.test(code) && /[A-Z]/.test(code.slice(1))) {
    return code.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').map(titleCaseWord).join(' ');
  }
  return code;
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

/* Audit block 9b: split `text` on case-insensitive occurrences of
 * `highlight`, wrapping matches in <strong> so the reader can spot the
 * applicable phrase inside a long verbatim quote at a glance. Returns the
 * plain string unchanged when there's no highlight, no match, or the
 * highlight is too short to be meaningful (avoids over-matching). */
export function renderHighlighted(text, highlight) {
  if (typeof text !== 'string' || !text) return text;
  if (!highlight || typeof highlight !== 'string') return text;
  const needle = highlight.trim();
  if (needle.length < 2) return text;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let parts;
  try {
    parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  } catch {
    return text;
  }
  if (parts.length <= 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/* HoverSource — wraps any cell content and surfaces the row's source language
 * in a small amber popover that appears immediately on hover (no 1-second
 * native-title delay). Click-through still works via the wrapped children;
 * the popover is positioned absolutely below the trigger and uses pointer-
 * events:none so it never blocks the underlying click. On touch devices
 * (which never fire mouseenter), a touchstart on the wrapper reveals the
 * popover for ~2.5s — the underlying tap action still fires normally.
 * `highlight` (audit block 9b): an optional string (the cell's resolved
 * value/qualifier text) — case-insensitive matches inside the popover quote
 * render in <strong> so the applicable phrase jumps out.
 * `sourceLabel` (Item 13): an optional short string identifying WHICH
 * provision/rep the quote belongs to (e.g. "§3.6 Compliance — MAE
 * qualifier").
 *
 * Item 8 (round 3, stage 2): the mouse-over popover is DEAD. Rows with only
 * pills (equity-awards, termination-fees, votes deadlines, ...) used to
 * expose their underlying clause ONLY through this hover -- no click-
 * through, invisible on touch/keyboard nav. That affordance is replaced
 * corpus-wide by the left-column "See provision" expander (ProvisionTable.jsx,
 * MaeSection.jsx, GroupedSubRows' row.seeText, reps' clauseSeeText/
 * sectionBox), which is always reachable and shows the full untruncated
 * text (so the sourceLabel/highlight-centering machinery added for Item 13
 * has nothing left to serve here -- the expander body IS the full context).
 * HoverSource keeps its full prop signature (quote/highlight/sourceLabel/
 * align) so its 50+ call sites need no changes, but renders children with NO
 * popover, no hover/touch listeners, and no popover-only state -- a plain
 * pass-through wrapper. Do NOT delete the component; only its rendering. */
export function HoverSource({ quote, children, as = 'span', className }) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}

/* ── Label-column CAP for review tables. Per review feedback the columns
 *    are CONTENT-SIZED (auto table layout — each column as small as its
 *    content needs); this class only caps the label column so a long label
 *    wraps at 240px instead of ballooning the column. No fixed/min width. */
export const REVIEW_LABEL_COL_W = 'max-w-[240px]';

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

// `highlight` (audit block 9b, opt-in): forwarded to HoverSource so the
// popover bolds case-insensitive matches of this string inside the quote.
// Defaults to `text` (the pill's own label) when not explicitly overridden
// — most pills exist precisely to surface a phrase the source quote also
// contains, so bolding it there is the useful default; pass `highlight={null}`
// to opt out.
export function Pill({ text, quote, tone = 'neutral', onClick, className = '', highlight }) {
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
  return quote ? <HoverSource quote={quote} highlight={highlight === undefined ? text : highlight}>{body}</HoverSource> : body;
}

/* ── CitableHover: table-cell wrapper enforcing the design contract — the
 *    cell shows only the resolved value; the verbatim quote surfaces on
 *    hover and (when EvidenceContext provides showEvidence) click jumps to
 *    the document highlight. Replaces the in-cell EvidenceQuote block for
 *    table content. */
export function CitableHover({ quotes, children }) {
  const showEvidence = useShowEvidence();
  const list = (Array.isArray(quotes) ? quotes : [quotes])
    .map((q) => String(q || '').trim())
    .filter(Boolean);
  if (list.length === 0) return children;
  const joined = list.join('\n\n');
  return (
    <HoverSource quote={joined}>
      <span
        className={showEvidence ? 'cursor-pointer' : undefined}
        onClick={showEvidence ? (e) => { e.stopPropagation(); showEvidence(list[0]); } : undefined}
      >
        {children}
      </span>
    </HoverSource>
  );
}

// P7 item 25: render a list-valued cell as a real <ul> of bullets. Tagged
// items resolve to their label (with optional code badge). Strings render
// as-is. Citable items are unwrapped to the inner value; per the table
// design contract the quote is hover-only (CitableHover), never printed
// beneath the bullet.
export function renderListAsBullets(featureKey, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
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
          // Tagged items carry their own verbatim `text` — hover-only too.
          if (quotes.length === 0 && innerRaw.text) quotes.push(innerRaw.text);
        } else if (isFlagItem(innerRaw)) {
          // A "flags" entry: { concern, text } — the novelty/off-market escape
          // valve. Show the one-sentence concern as the body; the verbatim
          // quote is hover-only, same as every other list item.
          body = <span>{innerRaw.concern}</span>;
          if (quotes.length === 0 && innerRaw.text) quotes.push(innerRaw.text);
        } else if (innerRaw === null || innerRaw === undefined || innerRaw === '') {
          return null;
        } else {
          // FIX BATCH item 4 sweep: plain-string list items (no {code,label}
          // wrapper) get the same bare-enum guard as the scalar-cell path.
          body = <span>{prettifyEnumValue(featureKey, String(innerRaw))}</span>;
        }
        return (
          <li key={idx} className="whitespace-pre-wrap break-words">
            <CitableHover quotes={quotes}>{body}</CitableHover>
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

function schemaEmptyState(featureKey, value) {
  if (!featureKey) return null;
  const rendered = schemaRenderFeatureValue(featureKey, value);
  if (rendered && typeof rendered === 'object' && rendered.kind === 'empty') return rendered;
  return null;
}

export function EmptyFeatureState({ state }) {
  if (!state) return null;
  const toneClass = state.tone === 'warning'
    ? 'border-amber-300 bg-amber-50 text-amber-700'
    : state.tone === 'info'
      ? 'border-accent/30 bg-accent/5 text-accent'
      : 'border-border bg-bg text-inkFaint';
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-ui italic ${toneClass}`}
      title={state.title || undefined}
    >
      {state.label}
    </span>
  );
}

function EmptySummaryValue({ featureKey, value }) {
  const state = schemaEmptyState(featureKey, value);
  if (state) return <EmptyFeatureState state={state} />;
  return <span className="italic text-inkFaint">Not present in this agreement</span>;
}

// Render a single row's value cell. Returns either a React node (for italic
// "Not present" placeholder, list count+snippet, or tagged label) or a string.
export function renderSummaryRowValue(hit, featureKeyForLookup) {
  if (hit === null || hit === undefined) {
    return <EmptySummaryValue featureKey={featureKeyForLookup} value={null} />;
  }
  let v = hit.value;
  const key = hit.key || featureKeyForLookup;
  const emptyState = schemaEmptyState(key, v);
  if (emptyState) return <EmptyFeatureState state={emptyState} />;

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
      return <EmptySummaryValue featureKey={key} value={v} />;
    }
    const bullets = renderListAsBullets(key, v);
    if (bullets) return bullets;
    return <EmptySummaryValue featureKey={key} value={null} />;
  }

  // Boolean / scalar.
  if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
  if (v === null || v === undefined || v === '') {
    return <EmptySummaryValue featureKey={key} value={v} />;
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
    // Normalize away case/format drift (hyphens, underscores, PascalCase)
    // before matching — the extractor's enum contract is lower-hyphenated
    // ("cash-with-cvr") but live data sometimes drifts to other shapes
    // ("CashCvr"). Audit block 6a/6b.
    const norm = raw.toLowerCase().replace(/[^a-z]/g, '');
    const map = {
      allcash: 'All cash',
      allstock: 'All stock',
      mixed: 'Mixed cash / stock',
      mixedcashandstock: 'Mixed cash and stock',
      mixedelection: 'Election',
      cashorstock: 'Cash / stock election',
      cashorstockormixed: 'Cash / stock / mixed election',
      cashelection: 'Cash election',
      stockelection: 'Stock election',
      cashwithcvr: 'Cash + CVR',
      cashcvr: 'Cash + CVR',
    };
    const hit = map[norm];
    if (hit) return hit;
    return raw.replace(/\bcvr\b/gi, 'CVR');
  }
  // FIX BATCH item 4: generic bare-enum leak guard. A feature value that
  // slipped through UN-tagged (a plain enum string like "RBE_NOT_TO" /
  // "POSITIVE_ONLY" rather than a {code,label} object) never went through
  // resolveTaggedLabel, so it rendered verbatim. Route ANY UPPER_SNAKE-shaped
  // value through this key's taxonomy dictionary first; if the key has no
  // dictionary (or the code isn't in it), humanize it to Title Case rather
  // than let the raw token reach the page. Real prose values (lowercase,
  // spaced) never match this shape and pass through untouched.
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(raw)) {
    const dict = taxonomyForFeatureKey(key);
    const label = dict && labelForCode(raw, dict);
    return label || humanizeBadgeText(raw);
  }
  return raw;
}

/* ── NotIncludedStrip: shared collapsed-by-default "not included" summary.
 *    Canonical items a deal's provisions don't cover (termination rights,
 *    conditions, reps, equity instruments, termination fee types, …) used to
 *    render as an always-expanded strikethrough pill row. Per FB3 chrome
 *    feedback, every instance now starts COLLAPSED as a single summary line
 *    ("N <noun> not included ▸") and expands on click — one shared component
 *    so the behavior is consistent everywhere it's used.
 *    `as="tr"` renders inside an existing <table><tbody> (pass `colSpan`);
 *    the default renders a standalone bordered block for use outside a
 *    table (e.g. under the Equity Treatment table, or in the TERMF stack). */
export function NotIncludedStrip({ items, noun, colSpan = 2, as = 'div', title }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;
  const count = items.length;
  const summary = count === 1 && /s$/.test(noun)
    ? `1 ${noun.slice(0, -1)} not included`
    : `${count} ${noun} not included`;
  const body = (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider hover:text-inkMid"
      >
        <span>{summary}</span>
        <span className="not-italic normal-case">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <span className="flex flex-wrap gap-1.5 mt-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center text-[10px] font-ui px-1.5 py-0.5 rounded border bg-bg/40 text-inkFaint/70 border-border line-through"
              title={title}
            >
              {item}
            </span>
          ))}
        </span>
      )}
    </>
  );
  if (as === 'tr') {
    return (
      <tr className="bg-bg/20">
        <td colSpan={colSpan} className="px-3 py-2">{body}</td>
      </tr>
    );
  }
  return <div className="bg-bg/20 border border-border rounded-lg px-3 py-2">{body}</div>;
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
  'NOSOL-M':{ bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400', hex: '#faf5ff' },
  'ANTI':   { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-800',   dot: 'bg-teal-400',   hex: '#f0fdfa' },
  'TERMR':  { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-M':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-B':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-T':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMF':  { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-800',   dot: 'bg-rose-400',   hex: '#fff1f2' },
  'REP':    { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-T':  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-B':  { bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-400',  hex: '#f0fdf4' },
  '__ABRY': { bg: 'bg-stone-50',   border: 'border-stone-200',  text: 'text-stone-700',  dot: 'bg-stone-400',  hex: '#fafaf9' },
  'COV':    { bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-800',   dot: 'bg-cyan-400',   hex: '#ecfeff' },
  'DEF':    { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
  'STRUCT': { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-400', hex: '#f5f3ff' },
  'CONSID': { bg: 'bg-lime-50',    border: 'border-lime-200',   text: 'text-lime-800',   dot: 'bg-lime-400',   hex: '#f7fee7' },
  'MISC':   { bg: 'bg-stone-50',   border: 'border-stone-200',  text: 'text-stone-700',  dot: 'bg-stone-400',  hex: '#fafaf9' },
  'OTHER':  { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
};

/* ── Corpus provision-type hex colors (used for dots, ref chips, section heads) ── */
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
  'NOSOL-M':'#A8538C',
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
  '__ABRY': '#8A8782',
  '__SEC_MEETING': '#6E8AA8',
  '__EMPLOYEE_BENEFITS': '#6E8AA8',
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

/* ── Sidebar grouping — parent groups with optional sub-types ──
 *    Metsera fb2 block 4a: this array is ALSO the review page's section
 *    order (TYPE_SORT_ORDER derives from it). Canonical reading order:
 *    Structure → Consideration → Reps → Material Contracts → MAE → IOC →
 *    No-Sol → Antitrust → Closing Conditions → Termination Rights →
 *    Termination Fees → rest. Seller/Target children always sit before
 *    Buyer/Parent (block 4b).
 *    O1 (Feedback round 4): Material Contracts moved to render immediately
 *    UNDER Reps (it's a Company-reps checklist), ahead of MAE. */
export const SIDEBAR_GROUPS = [
  { label: 'Structure & Mechanics', types: ['STRUCT'] },
  { label: 'Consideration', types: ['CONSID'] },
  { label: 'Representations', children: [
    { label: 'Company / Target', type: 'REP-T' },
    { label: 'Buyer / Parent', type: 'REP-B' },
  ]},
  { label: 'Material Contracts', types: ['__MATERIAL_CONTRACTS'] },
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
    { label: 'Mutual / Reciprocal', type: 'NOSOL-M' },
  ]},
  { label: 'Antitrust / Regulatory', types: ['ANTI'] },
  { label: 'SEC Filing / Meeting Requirements', types: ['__SEC_MEETING'] },
  { label: 'Conditions to Closing', types: ['COND-M', 'COND-B', 'COND-S', 'COND'], singleType: 'COND-M' },
  { label: 'Termination Rights', types: ['TERMR-M', 'TERMR-B', 'TERMR-T', 'TERMR'], singleType: 'TERMR-M' },
  { label: 'Termination Fees', types: ['TERMF'] },
  // FB3 missed item 1: Employee Benefits — new dedicated synthetic section,
  // registered exactly like SEC Filing / Meeting Requirements above, placed
  // immediately BEFORE Other Covenants per owner's spec.
  { label: 'Employee Benefits', types: ['__EMPLOYEE_BENEFITS'] },
  { label: 'Other Covenants', types: ['COV'] },
  { label: 'Miscellaneous / Boilerplate', types: ['MISC'] },
  // No Other Reps / Fraud (Abry) is a curated legal-risk summary rather than
  // an ordinary R&W table. Keep it near the end, immediately before DEF.
  { label: 'No Other Reps / Fraud / Willful Breach (Abry)', types: ['__ABRY'] },
  // FB3 chrome: Definitions moved to the bottom of the page (after Misc) —
  // it's a reference glossary, not something read in document order.
  { label: 'Definitions', types: ['DEF'] },
  { label: 'Other', types: ['OTHER'] },
];

/* Synthetic, single-page sidebar types: the child label itself IS the page
 * (a curated summary), so the sidebar should NOT show a count or a nested
 * per-provision sub-list under it. */
export const SYNTHETIC_SINGLE_PAGE_TYPES = new Set(['MAE-DEF', 'MAE-DEF-P', '__MATERIAL_CONTRACTS', '__ABRY', '__SEC_MEETING', '__EMPLOYEE_BENEFITS']);

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
  // Synthetic UI-only type — the No Other Reps / Fraud (Abry) four-question
  // summary; see the SIDEBAR_GROUPS comment above for what feeds it.
  '__ABRY': 'No Other Reps / Fraud / Willful Breach (Abry)',
  '__SEC_MEETING': 'SEC Filing / Meeting Requirements',
  '__EMPLOYEE_BENEFITS': 'Employee Benefits',
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
  'NOSOL-M': 'No-Solicitation (Mutual / Reciprocal)',
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
