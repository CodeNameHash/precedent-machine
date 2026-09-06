import { useEffect, useMemo, useRef } from 'react';

function byteToStringIndex(text, byteOffset) {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(bytes.slice(0, byteOffset)).length;
}

function surroundingSourceSpan(span, closureSpans) {
  if (!span) return null;
  if (span.kind !== 'SUPPORTING_EVIDENCE') return span;
  const containing = closureSpans.filter((candidate) => (
    candidate.span_id !== span.span_id
    && candidate.kind !== 'SUPPORTING_EVIDENCE'
    && Number.isSafeInteger(candidate.start_byte)
    && Number.isSafeInteger(candidate.end_byte)
    && candidate.start_byte <= span.start_byte
    && candidate.end_byte >= span.end_byte
  ));
  const authoredUnits = containing.filter((candidate) => (
    ['OPERATIVE', 'DEFINITION', 'FULL_SECTION'].includes(candidate.kind)
  ));
  return (authoredUnits.length > 0 ? authoredUnits : containing)
    .sort((left, right) => (left.end_byte - left.start_byte) - (right.end_byte - right.start_byte)
    || left.start_byte - right.start_byte
    || left.span_id.localeCompare(right.span_id))[0] || span;
}

function surroundingLabel(span) {
  if (span?.kind === 'RESIDUAL_PARAGRAPH') return 'Stored surrounding passage';
  if (span?.kind === 'FULL_SECTION') return 'Full surrounding section';
  if (span?.kind === 'DEFINITION') return 'Full surrounding definition';
  return span?.kind === 'SUPPORTING_EVIDENCE' ? 'Exact supporting words' : 'Full surrounding clause';
}

export default function SourceContextPanel({ open, onClose, source, span, closureSpans = [], loading, reviewContext = null }) {
  const mark = useRef(null);
  const contextSpan = useMemo(() => surroundingSourceSpan(span, closureSpans), [span, closureSpans]);
  const parts = useMemo(() => {
    if (!source?.canonical_text || !span || !contextSpan) return null;
    const contextStart = byteToStringIndex(source.canonical_text, contextSpan.start_byte);
    const contextEnd = byteToStringIndex(source.canonical_text, contextSpan.end_byte);
    const selectedStart = byteToStringIndex(source.canonical_text, span.start_byte);
    const selectedEnd = byteToStringIndex(source.canonical_text, span.end_byte);
    return {
      before: source.canonical_text.slice(contextStart, selectedStart),
      selected: source.canonical_text.slice(selectedStart, selectedEnd),
      after: source.canonical_text.slice(selectedEnd, contextEnd),
      context: source.canonical_text.slice(contextStart, contextEnd),
    };
  }, [source, span, contextSpan]);
  useEffect(() => {
    if (!open) return undefined;
    const key = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    setTimeout(() => mark.current?.scrollIntoView({ block: 'center' }), 0);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose, parts]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Exact agreement source" className="mx-auto flex h-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-inkLight">Exact source</p><p className="font-mono text-xs text-inkMid">{span ? `${span.kind} · bytes ${span.start_byte}-${span.end_byte}` : 'Loading'}</p></div>
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1 text-sm">Close</button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          {reviewContext?.kind === 'UNMATCHED' ? <section className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-950"><h2 className="font-semibold">Attempted quote, not an exact source citation</h2><blockquote className="mt-2 border-l-2 border-red-300 pl-3 font-mono text-xs">{reviewContext.attempted_quote}</blockquote><p className="mt-2">{reviewContext.reason} {reviewContext.section_reference}</p><p className="mt-2 font-semibold">The highlighted text is the declared containing context. It is not an automatic citation for the attempted quote.</p></section> : null}
          {reviewContext?.kind === 'CONTEXT_ONLY' ? <section className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-semibold">Supporting context outside the owned section</h2><blockquote className="mt-2 border-l-2 border-amber-300 pl-3 font-mono text-xs">{reviewContext.attempted_quote}</blockquote><p className="mt-2">{reviewContext.reason} {reviewContext.section_reference}</p><p className="mt-2 font-semibold">The highlighted text is supporting context. It is not owned evidence for this proposal.</p></section> : null}
          {loading ? <p>Loading source…</p> : <>{parts ? <article className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-4" data-testid="highlighted-source-context"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">{surroundingLabel(contextSpan)} · {contextSpan.kind} · bytes {contextSpan.start_byte}-{contextSpan.end_byte}</p><pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-ink">{parts.before}<mark ref={mark} className="bg-amber-200">{parts.selected}</mark>{parts.after}</pre></article> : null}<details><summary className="cursor-pointer text-xs font-semibold text-accent">Show all source passages in this closure</summary><div className="mt-3 space-y-4">{closureSpans.map((item) => <article key={item.span_id} className={`rounded-lg border p-4 ${item.span_id === span?.span_id ? 'border-amber-400 bg-amber-50' : 'border-border'}`}><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">{item.kind} · bytes {item.start_byte}-{item.end_byte}</p><pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-ink">{item.span_id === span?.span_id ? <mark className="bg-amber-200">{item.exact_text}</mark> : item.exact_text}</pre></article>)}</div></details></>}
          {!loading && parts && span && (parts.selected !== span.exact_text || parts.context !== contextSpan.exact_text) ? <p role="alert" className="mt-4 text-xs text-red-700">The canonical source bytes do not match the stored exact span.</p> : null}
        </div>
      </section>
    </div>
  );
}

export { byteToStringIndex, surroundingSourceSpan };
