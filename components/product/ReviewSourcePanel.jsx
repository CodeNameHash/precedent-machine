import { displayReviewLabel } from '../../lib/product/review-labels';

// PW redesign: the right-hand source panel for the selected fact. It shows
// the exact selected span, then hands off to the full source dialog for the
// whole closure. The panel is a reading aid, not a second decision surface.
export default function ReviewSourcePanel({ selection, source, loading, onOpenFull }) {
  if (!selection?.span) {
    return (
      <aside className="pw-review-source" data-testid="review-source-panel">
        <p className="pw-rail-kicker">Source</p>
        <p className="pw-source-empty">Select a fact or a citation to read the exact words behind it.</p>
        <div className="pw-source-rule" />
        <p className="pw-source-note">Every proposal opens on the clause it came from. The comparison and market read use accepted facts only.</p>
      </aside>
    );
  }
  const span = selection.span;
  return (
    <aside className="pw-review-source" data-testid="review-source-panel">
      <div className="pw-source-head">
        <p className="pw-rail-kicker">Source · {displayReviewLabel(span.kind)}</p>
        <button type="button" onClick={onOpenFull} className="pw-source-open">Full source</button>
      </div>
      <h2 className="pw-source-title">{selection.reviewContext?.section_reference || span.section_reference || 'Selected passage'}</h2>
      <p className="pw-source-sub">The exact words behind the selected proposal.</p>
      {loading ? <p className="pw-source-empty">Loading source…</p> : (
        <blockquote className="pw-source-quote" data-testid="review-source-quote">{span.exact_text}</blockquote>
      )}
      <p className="pw-source-meta">Bytes {span.start_byte}–{span.end_byte}</p>
      <div className="pw-source-rule" />
      <p className="pw-source-note"><b>Descriptive, not advice.</b> The source is shown verbatim. A decision records the reviewer's reading against these words.</p>
    </aside>
  );
}
