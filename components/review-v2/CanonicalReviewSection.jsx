import { useCallback, useEffect, useMemo, useState } from 'react';

const ENABLED = ['1', 'true', 'on', 'yes'].includes(
  String(process.env.NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED || '').toLowerCase(),
);

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`);
  return body;
}

function exactText(detail) {
  if (typeof detail?.excerpt?.exact_text === 'string') return detail.excerpt.exact_text;
  if (Array.isArray(detail?.exact_excerpts)) {
    return detail.exact_excerpts.map((excerpt) => excerpt.exact_text).filter(Boolean).join('\n\n');
  }
  return '';
}

function RowFailure({ item }) {
  return (
    <div className="border border-[#D8B56A] bg-[#FFF9EC] px-3 py-2" data-canonical-row-failed={item.key}>
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6417]">Provision needs review</div>
      <p className="mt-1 text-[10px] leading-4 text-[#5F4A1E]">
        This row could not be rendered safely. Other certified provisions remain available.
      </p>
    </div>
  );
}

function SourceDetail({ envelope, rowKey, sourceAction }) {
  const [state, setState] = useState({ open: false, loading: false, error: null, text: '' });
  const toggle = useCallback(async () => {
    if (state.open) {
      setState((current) => ({ ...current, open: false }));
      return;
    }
    if (state.text) {
      setState((current) => ({ ...current, open: true }));
      return;
    }
    setState({ open: true, loading: true, error: null, text: '' });
    try {
      const query = new URLSearchParams({
        namespace: envelope.serving_namespace_id,
        release: envelope.corpus_release_id,
        dealId: envelope.application_deal_id,
        row: rowKey,
        source: sourceAction.source_detail_reference_id,
      });
      const body = await fetchJson(`/api/canonical-v2/exact-detail?${query.toString()}`);
      const text = exactText(body.detail);
      if (!text) throw new Error('Exact source is unavailable.');
      setState({ open: true, loading: false, error: null, text });
    } catch (error) {
      setState({ open: true, loading: false, error: error.message || String(error), text: '' });
    }
  }, [envelope, rowKey, sourceAction, state.open, state.text]);

  return (
    <div className="mt-2 border-t border-[#E6E4DF] pt-2">
      <button
        type="button"
        onClick={toggle}
        className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
        aria-expanded={state.open}
      >
        {state.open ? 'Hide provision' : 'See provision'}
      </button>
      {state.open ? (
        <div className="mt-2 border-l-2 border-[#2F6DB5] bg-[#F7F9FC] px-3 py-2 text-[10px] leading-4 text-[#1F1F1F]">
          {state.loading ? 'Loading exact source…' : null}
          {state.error ? <span className="text-[#9A2E2E]">{state.error}</span> : null}
          {state.text ? <p className="whitespace-pre-wrap">{state.text}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function CanonicalResult({ item, envelope }) {
  const adapted = item.prepared;
  const metricKey = adapted.resolution.metrics[0].metricKey;
  const metric = adapted.data.byRow[adapted.row_key].metrics[metricKey];
  return (
    <div className="grid grid-cols-1 border border-[#E6E4DF] bg-white md:grid-cols-[minmax(180px,0.75fr)_minmax(260px,1.25fr)]">
      <div className="border-b border-[#E6E4DF] px-3 py-3 md:border-b-0 md:border-r">
        <div className="text-[10px] font-bold text-[#1F1F1F]">{adapted.resolution.label}</div>
        <div className="mt-1 text-[11px] font-semibold text-[#2F6DB5]">{metric.subject.label}</div>
        <div className="mt-2 text-[9px] text-[#77736C]">
          {metric.coverage.comparableCount} comparable deal{metric.coverage.comparableCount === 1 ? '' : 's'}
        </div>
      </div>
      <div className="px-3 py-3">
        <dl className="space-y-1.5">
          {metric.subject.legalTerms.map((term) => (
            <div key={term.key} className="grid grid-cols-[96px_1fr] gap-3 text-[10px] leading-4">
              <dt className="font-bold text-[#77736C]">{term.label}</dt>
              <dd className="text-[#1F1F1F]">{term.value}</dd>
            </div>
          ))}
        </dl>
        {metric.source?.state === 'available' ? (
          <SourceDetail envelope={envelope} rowKey={adapted.row_key} sourceAction={metric.source.action} />
        ) : null}
      </div>
    </div>
  );
}

function SourceSpecificResult({ item, envelope }) {
  const adapted = item.prepared;
  const context = adapted.resolution.sourceSpecific;
  return (
    <div className="border border-[#D8B56A] bg-[#FFFCF4] px-3 py-3">
      <div className="text-[10px] font-bold text-[#1F1F1F]">{context.displayLabel}</div>
      <p className="mt-1 text-[10px] leading-4 text-[#6B5630]">{context.nonComparableReason}</p>
      {context.primitives.length ? (
        <dl className="mt-2 space-y-1.5 border-t border-[#E8D9B8] pt-2">
          {context.primitives.map((primitive) => (
            <div key={primitive.key} className="grid grid-cols-[110px_1fr] gap-3 text-[10px] leading-4">
              <dt className="font-bold text-[#77736C]">{primitive.kind.replaceAll('_', ' ').toLowerCase()}</dt>
              <dd className="text-[#1F1F1F]">{String(primitive.interpretedValue ?? primitive.rawValue)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {context.source?.state === 'available' ? (
        <SourceDetail envelope={envelope} rowKey={adapted.row_key} sourceAction={context.source.action} />
      ) : null}
    </div>
  );
}

function CanonicalRow({ item, envelope }) {
  if (item.render_kind !== 'ROW') return <RowFailure item={item} />;
  if (item.prepared.resolution.rowKind === 'REVIEWED_SOURCE_SPECIFIC') {
    return <SourceSpecificResult item={item} envelope={envelope} />;
  }
  return <CanonicalResult item={item} envelope={envelope} />;
}

export default function CanonicalReviewSection({ dealId }) {
  const [state, setState] = useState({ loading: false, error: null, envelope: null, items: [] });
  useEffect(() => {
    if (!ENABLED || !dealId) return undefined;
    let cancelled = false;
    setState({ loading: true, error: null, envelope: null, items: [] });
    fetchJson(`/api/canonical-v2/review-context?dealId=${encodeURIComponent(dealId)}`)
      .then((body) => {
        if (cancelled) return;
        const { items, ...envelope } = body;
        setState({ loading: false, error: null, envelope, items: items || [] });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, error: error.message || String(error), envelope: null, items: [] });
      });
    return () => { cancelled = true; };
  }, [dealId]);

  const validCount = useMemo(
    () => state.items.filter((item) => item.render_kind === 'ROW').length,
    [state.items],
  );
  if (!ENABLED) return null;
  if (state.loading) {
    return <p className="mtx-meta-label text-[10px] tracking-[0.14em]">Loading certified terms…</p>;
  }
  if (state.error) {
    return (
      <div className="border border-[#E6E4DF] bg-[#F7F5F0] px-3 py-2 text-[10px] text-[#6B6B6B]">
        Certified terms are unavailable. The existing review remains fully available.
      </div>
    );
  }
  if (!state.envelope || state.items.length === 0) return null;

  return (
    <section id="sec-canonical-v2" className="scroll-mt-28" data-canonical-v2-review>
      <details open className="mtx-section">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 border-b-2 border-black pb-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2F6DB5]" />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">Certified terms</h2>
          <span className="text-[9px] text-[#77736C]">{validCount} rows</span>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        <div className="mt-4 space-y-2">
          {state.items.map((item) => (
            <CanonicalRow key={item.key} item={item} envelope={state.envelope} />
          ))}
        </div>
      </details>
    </section>
  );
}

export { exactText };
