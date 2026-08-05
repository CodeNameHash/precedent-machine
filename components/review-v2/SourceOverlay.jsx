// Review V2 ("Mergertrace") — WP-5 (M5-03): full-document overlay with
// exact span highlight.
//
// SEAM (spec item 4): this component takes `{ start, end }` — offsets into
// the marker-stripped rendering of `fullText` — NOT a card. Callers resolve
// a card's span with lib/parser-v2/resolve-source-span.js's
// resolveSourceSpan()/resolveCardSourceSpan() BEFORE opening the overlay.
// That keeps this component ignorant of card shape, so when the unmerged
// span-accounting branch (per-claim, section-relative offsets — see
// docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md) lands, a claim chip can
// resolve its own {start, end} and open the SAME overlay with no changes
// here.
//
// Scope decision (per docs/archive/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md
// §6): renders the deal's full_text in a single offset-faithful pane
// (marker tags stripped, offsets tracked) rather than reusing
// parseFormattedDocument's lossy block parse — that parser has no
// offset-addressable anchors to <mark> against. Pattern-matched against
// components/admin/schema-loss/ResidualHighlighter.jsx (quote-preview
// styling) scaled up to a full-screen reader.

import { useEffect, useMemo, useRef } from 'react';
import { stripWithOffsetMap } from '../../lib/parser-v2/resolve-source-span';

function sectionRefLabel(ref) {
  const first = String(ref || '').split('|')[0].trim();
  return first ? `§${first}` : '';
}

export default function SourceOverlay({
  open,
  onClose,
  fullText,
  start,
  end,
  status,
  sectionRef,
  title,
  agreementTitle,
  unresolvedCount = 0,
  loading = false,
}) {
  const markRef = useRef(null);
  const scrolledRef = useRef(false);

  const { strippedText } = useMemo(
    () => stripWithOffsetMap(fullText || ''),
    [fullText],
  );

  const hasSpan = Number.isInteger(start) && Number.isInteger(end) && end > start;
  const unresolved = open && !hasSpan;

  useEffect(() => {
    if (!open) { scrolledRef.current = false; return undefined; }
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while the overlay is open — matches the drawer
    // pattern (.mtx-drawer-backdrop) but full-bleed.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !hasSpan || scrolledRef.current) return;
    if (markRef.current) {
      markRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasSpan, start, end, strippedText]);

  if (!open) return null;

  const before = hasSpan ? strippedText.slice(0, start) : strippedText;
  const marked = hasSpan ? strippedText.slice(start, end) : '';
  const after = hasSpan ? strippedText.slice(end) : '';

  return (
    <div
      className="mtx-source-overlay-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div className="mtx-source-overlay" role="dialog" aria-modal="true" aria-label="Source agreement">
        <div className="mtx-source-overlay-header">
          <div className="min-w-0">
            <p className="mtx-meta-label text-[9px] tracking-[0.16em]">
              {agreementTitle || 'Source document'} · Verbatim text
            </p>
            <h2 className="mtx-serif text-lg font-bold text-[#1F1F1F] truncate">
              {title || 'Agreement'}
              {sectionRef ? <span className="mtx-mono text-[12px] font-normal text-[#6B6B6B] ml-2">{sectionRefLabel(sectionRef)}</span> : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source overlay"
            className="shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] hover:text-[#1F1F1F] border border-[#E0E0E0] hover:border-[#1F1F1F]"
          >
            Esc ✕
          </button>
        </div>

        {unresolved ? (
          <div className="mtx-source-overlay-notice" data-testid="span-unresolved-notice">
            Span unresolved — this card&apos;s quote could not be located verbatim in the source document.
            Showing the full agreement unscrolled.
          </div>
        ) : null}

        <div className="mtx-source-overlay-body mtx-scrollbar-thin">
          {!strippedText ? (
            // Q4 (perf quick-wins): source text is fetched lazily; the
            // overlay can open before it arrives (cold on-demand fetch) —
            // show a loading state rather than claiming there's no source.
            <p className="mtx-meta-label text-[10px] tracking-[0.14em]" data-testid={loading ? 'source-overlay-loading' : undefined}>
              {loading ? 'Loading source document…' : 'No source text available for this deal.'}
            </p>
          ) : (
            <pre className="mtx-doc-pane">
              {before}
              {hasSpan ? (
                <mark ref={markRef} className="mtx-doc-highlight">{marked}</mark>
              ) : null}
              {after}
            </pre>
          )}
        </div>

        <div className="mtx-source-overlay-footer">
          <span>{strippedText.length.toLocaleString('en-US')} characters</span>
          <span>
            {hasSpan
              ? `Highlight resolved via ${status || 'match'}`
              : `${unresolvedCount} unresolved span${unresolvedCount === 1 ? '' : 's'} this session`}
          </span>
        </div>
      </div>
    </div>
  );
}
