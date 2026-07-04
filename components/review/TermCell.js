import { createContext, useContext } from 'react';
import Link from 'next/link';
import { useViewMode } from '../ViewModeContext';

/* ═══════════════════════════════════════════════════════════
   FB3 — DealNavContext: the ONE place a table cell learns (a)
   which deal it's in, so it can build a link to the per-provision
   card page (Surface 1), and (b) how to pop open the in-place
   document sheet (Surface 2). Mounted once at the top of
   pages/review/[id].js; every <TermCell> below reads from it so
   no table needs its own click-through wiring.
   ═══════════════════════════════════════════════════════════ */
export const DealNavContext = createContext({
  dealId: null,
  openSeeText: null,
});

export function useDealNav() {
  return useContext(DealNavContext);
}

/**
 * TermCell — wraps a term/label so it uniformly gets:
 *   1. click-through to the per-provision card (Surface 1), and
 *   2. a small "see text" link that pops the in-place document
 *      sheet (Surface 2) without navigating away.
 *
 * Usage: <TermCell provision={p} quote={quote}>{labelNode}</TermCell>
 *
 * `provision` is the row this term belongs to. `quote` is the specific
 * verbatim excerpt this cell is showing (falls back to provision.full_text
 * for "see text" when omitted — the card page always shows the whole
 * provision regardless). Renders children unwrapped (no link, no "see
 * text") when there's no provision id or no DealNavContext provider
 * upstream, so it degrades safely if ever used outside the review page.
 */
export function TermCell({ provision, quote, children, className = '', seeText = true, as: Tag = 'span' }) {
  const { dealId, openSeeText } = useDealNav();
  const { isEdit } = useViewMode();

  if (!provision || !provision.id || !dealId) {
    return <Tag className={className}>{children}</Tag>;
  }

  const href = `/review/${dealId}/provision/${provision.id}${isEdit ? '?mode=edit' : ''}`;
  const hasText = !!(quote && String(quote).trim()) || !!(provision.full_text && provision.full_text.trim());
  const showSeeText = seeText && hasText && typeof openSeeText === 'function';

  return (
    <Tag className={`term-cell ${className}`.trim()}>
      <Link
        href={href}
        className="term-cell-label"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Link>
      {showSeeText && (
        <button
          type="button"
          className="term-cell-seetext"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            openSeeText({ provision, quote: quote || provision.full_text });
          }}
          title="Show this passage in the full agreement text"
        >
          see text
        </button>
      )}
    </Tag>
  );
}
