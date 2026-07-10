import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { stripFormattingMarkers } from '../../lib/parser-v2/format-renderer';
import { locateQuoteInText, buildWindow, WINDOW_EXPAND_STEP } from '../../lib/doc-match';
import { typeLabel } from './shared';

/* ═══════════════════════════════════════════════════════════
   FB3 Surface 2 — in-place document pop-under.

   A half-screen bottom sheet that shows the FULL agreement text
   auto-scrolled + highlighted to one provision's span, WITHOUT
   navigating away from (or losing scroll position in) the table
   underneath. Mounted once at the page level (pages/review/[id].js)
   and opened via DealNavContext.openSeeText — see TermCell.js.

   Performance: the stored agreement text runs ~300-500k chars.
   Rather than rendering the whole document in one node (as the
   Document tab / FullDocumentView does), this renders only a
   window around the matched span, with "show more" affordances to
   walk outward — see lib/doc-match.js.
   ═══════════════════════════════════════════════════════════ */
export function DocPopUnder({ open, dealId, provision, quote, sourceText, docTitle, isEdit, onEditProvision, onClose }) {
  const [padBefore, setPadBefore] = useState(6000);
  const [padAfter, setPadAfter] = useState(6000);
  const markRef = useRef(null);
  const bodyRef = useRef(null);

  // Reset window size each time a new provision/quote is opened.
  useEffect(() => {
    if (open) { setPadBefore(6000); setPadAfter(6000); }
  }, [open, provision?.id, quote]);

  // Esc closes — consistent with the rest of the review page (pm:escape).
  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = () => onClose && onClose();
    document.addEventListener('pm:escape', handleEscape);
    return () => document.removeEventListener('pm:escape', handleEscape);
  }, [open, onClose]);

  const plainText = useMemo(() => {
    if (!sourceText) return '';
    return sourceText.includes('[[') ? stripFormattingMarkers(sourceText) : sourceText;
  }, [sourceText]);

  const needle = (quote && String(quote).trim()) || (provision && provision.full_text) || '';

  const match = useMemo(() => {
    if (!plainText || !needle) return null;
    return locateQuoteInText(plainText, needle);
  }, [plainText, needle]);

  const window_ = useMemo(() => {
    if (!plainText || !match) return null;
    return buildWindow(plainText, match.start, match.end, { before: padBefore, after: padAfter });
  }, [plainText, match, padBefore, padAfter]);

  // Auto-scroll the highlighted span into view whenever a fresh window
  // resolves it (covers both the initial open and "show more" re-centers).
  useEffect(() => {
    if (!open || !markRef.current) return;
    markRef.current.scrollIntoView({ block: 'center' });
  }, [open, window_?.windowStart, window_?.windowEnd]);

  if (!open) return null;

  const before = window_ ? window_.text.slice(0, window_.matchStart) : '';
  const highlighted = window_ ? window_.text.slice(window_.matchStart, window_.matchEnd) : '';
  const after = window_ ? window_.text.slice(window_.matchEnd) : '';

  return (
    <>
      {/* Backdrop — click-away closes; doesn't touch the table's own scroll. */}
      <div
        className="fixed inset-0 bg-black/30 z-[70]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agreement text"
        className="fixed inset-x-0 bottom-0 z-[71] h-[55vh] md:h-[60vh] bg-surface border-t border-line rounded-t-2xl shadow-2xl flex flex-col animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-ui uppercase tracking-wider text-inkFaint">
              {docTitle || 'Agreement'} &middot; See provision
            </p>
            {provision && (
              <p className="text-sm font-ui text-ink truncate">
                {typeLabel(provision.type)} &middot; {provision.category || 'General'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {provision && dealId && (
              <Link
                href={`/review/${dealId}/provision/${provision.id}${isEdit ? '?mode=edit' : ''}`}
                className="px-2.5 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors"
              >
                Open provision card
              </Link>
            )}
            {isEdit && provision && onEditProvision && (
              <button
                type="button"
                onClick={() => { onEditProvision(provision); onClose && onClose(); }}
                className="px-2.5 py-1 text-[11px] font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-inkLight hover:text-ink transition-colors rounded hover:bg-bg"
              title="Close (Esc)"
              aria-label="Close"
            >
              &#x2715;
            </button>
          </div>
        </div>

        {/* Body — windowed document excerpt, not the whole 300-500k char string. */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto rec-doc px-4 md:px-10 py-6">
          {!plainText ? (
            <p className="text-inkFaint font-ui text-sm text-center py-8">
              No raw agreement text stored for this deal.
            </p>
          ) : !match || !window_ ? (
            <p className="text-inkFaint font-ui text-sm text-center py-8">
              Couldn&apos;t locate this passage in the stored document text.
            </p>
          ) : (
            <div className="rec-doc-prose max-w-3xl mx-auto whitespace-pre-wrap break-words">
              {window_.canExpandBefore && (
                <button
                  type="button"
                  onClick={() => setPadBefore((p) => p + WINDOW_EXPAND_STEP)}
                  className="block mx-auto mb-4 text-[11px] font-ui text-inkFaint hover:text-ink underline decoration-dotted"
                >
                  Show earlier text &uarr;
                </button>
              )}
              <span>{before}</span>
              <mark ref={markRef} className="mk">{highlighted}</mark>
              <span>{after}</span>
              {window_.canExpandAfter && (
                <button
                  type="button"
                  onClick={() => setPadAfter((p) => p + WINDOW_EXPAND_STEP)}
                  className="block mx-auto mt-4 text-[11px] font-ui text-inkFaint hover:text-ink underline decoration-dotted"
                >
                  Show later text &darr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
