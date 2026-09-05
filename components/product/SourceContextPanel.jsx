import { useEffect, useMemo, useRef } from 'react';

function byteToStringIndex(text, byteOffset) {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(bytes.slice(0, byteOffset)).length;
}

export default function SourceContextPanel({ open, onClose, source, span, closureSpans = [], loading, reviewContext = null }) {
  const mark = useRef(null);
  const parts = useMemo(() => {
    if (!source?.canonical_text || !span) return null;
    const start = byteToStringIndex(source.canonical_text, span.start_byte);
    const end = byteToStringIndex(source.canonical_text, span.end_byte);
    return {
      before: source.canonical_text.slice(0, start),
      selected: source.canonical_text.slice(start, end),
      after: source.canonical_text.slice(end),
    };
  }, [source, span]);
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
          {loading ? <p>Loading source…</p> : <div className="space-y-4">{closureSpans.map((item) => <article key={item.span_id} ref={item.span_id === span?.span_id ? mark : null} className={`rounded-lg border p-4 ${item.span_id === span?.span_id ? 'border-amber-400 bg-amber-50' : 'border-border'}`}><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">{item.kind} · bytes {item.start_byte}-{item.end_byte}</p><pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-ink">{item.span_id === span?.span_id ? <mark className="bg-amber-200">{item.exact_text}</mark> : item.exact_text}</pre></article>)}</div>}
          {!loading && parts && span && parts.selected !== span.exact_text ? <p role="alert" className="mt-4 text-xs text-red-700">The canonical source bytes do not match the stored exact span.</p> : null}
        </div>
      </section>
    </div>
  );
}

export { byteToStringIndex };
