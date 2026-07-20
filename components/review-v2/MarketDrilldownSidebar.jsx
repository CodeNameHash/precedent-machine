import Link from 'next/link';
import { formatNumericMarketSummary } from './marketNumericFormat';

function pct(count, denominator) {
  if (!Number.isFinite(count) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return `${Math.round((count / denominator) * 100)}%`;
}

function CountLine({ count, denominator }) {
  const percent = pct(count, denominator);
  return (
    <span className="text-[10px] tabular-nums text-inkLight">
      {Number.isFinite(count) ? count : '—'}
      {Number.isFinite(denominator) ? ` of ${denominator}` : ''}
      {percent ? ` · ${percent}` : ''}
    </span>
  );
}

function DealLink({ deal }) {
  const id = deal.dealId || deal.deal_id || deal.id;
  const name = deal.dealName || deal.name || [deal.acquirer, deal.target].filter(Boolean).join(' / ') || id;
  const cardId = deal.cardId || deal.card_id;
  const href = id ? `/review/${id}${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}` : null;
  if (!href) return <span>{name || 'Unnamed deal'}</span>;
  return <Link href={href} className="hover:underline">{name}</Link>;
}

function CategoricalDistribution({ summary, defaultDenominator }) {
  const values = Array.isArray(summary.values) ? summary.values : [];
  if (!values.length) return <p className="text-[11px] italic text-inkFaint">No treatments captured.</p>;
  return (
    <div className="divide-y divide-border">
      {values.map((value, index) => {
        const denominator = Number.isFinite(value.denominator) ? value.denominator : defaultDenominator;
        const deals = Array.isArray(value.deals) ? value.deals : [];
        return (
          <details key={`${summary.attribute || 'value'}-${value.value || value.label || index}`} className="py-2" open={index === 0}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-medium text-ink">{value.label || value.value || 'Not captured'}</span>
                <CountLine count={value.count} denominator={denominator} />
              </div>
            </summary>
            {deals.length ? (
              <div className="mt-2 space-y-1 pl-2 border-l border-border text-[10px] text-inkLight">
                {deals.map((deal, dealIndex) => <div key={deal.dealId || deal.deal_id || deal.id || dealIndex}><DealLink deal={deal} /></div>)}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

function NumericDistribution({ summary }) {
  const formatted = formatNumericMarketSummary(summary);
  if (!formatted) return <p className="text-[11px] italic text-inkFaint">No numeric market data captured.</p>;
  return (
    <div className="border border-border bg-paper2 px-3 py-2">
      <div className="text-sm font-semibold text-ink">{formatted.headline}</div>
      {formatted.range ? <div className="mt-1 text-[10px] text-inkLight">{formatted.range}</div> : null}
      {Number.isFinite(summary.count) ? <div className="mt-1 text-[9px] uppercase tracking-wider text-inkFaint">{summary.count} deals with a captured value</div> : null}
    </div>
  );
}

function DistributionSection({ title, summaries, denominator }) {
  if (!Array.isArray(summaries) || !summaries.length) return null;
  return (
    <section className="border-t border-border pt-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink mb-2">{title}</h3>
      <div className="space-y-4">
        {summaries.map((summary, index) => (
          <div key={summary.attribute || index}>
            {summaries.length > 1 && summary.label ? <div className="mb-1 text-[10px] font-medium text-inkLight">{summary.label}</div> : null}
            {summary.kind === 'numeric'
              ? <NumericDistribution summary={summary} />
              : <CategoricalDistribution summary={summary} defaultDenominator={denominator} />}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MarketDrilldownSidebar({ context, onClose }) {
  if (!context) {
    return (
      <aside className="hidden lg:block w-[340px] shrink-0 border-l border-border bg-white sticky top-[var(--mtx-head-h,72px)] h-[calc(100vh-var(--mtx-head-h,72px))]" data-testid="market-drilldown-sidebar">
        <div className="p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink">Market detail</div>
          <p className="mt-3 text-[11px] leading-5 text-inkLight">Select a market cell to see every captured treatment, exception, and underlying deal.</p>
        </div>
      </aside>
    );
  }

  const termDenominator = Number.isFinite(context.termDealCount) ? context.termDealCount : context.peerSetSize;
  return (
    <aside className="hidden lg:block w-[340px] shrink-0 border-l border-border bg-white sticky top-[var(--mtx-head-h,72px)] h-[calc(100vh-var(--mtx-head-h,72px))] overflow-y-auto" data-testid="market-drilldown-sidebar">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-inkFaint">Market detail</div>
            <h2 className="mt-1 text-base font-bold leading-tight text-ink">{context.label || 'Selected term'}</h2>
          </div>
          {onClose ? <button type="button" onClick={onClose} aria-label="Close market detail" className="text-lg leading-none text-inkLight hover:text-ink">×</button> : null}
        </div>

        <div className="border border-border bg-paper2 px-3 py-2">
          <div className="text-[11px] font-medium text-ink">
            {Number.isFinite(context.termDealCount) && Number.isFinite(context.peerSetSize)
              ? `${context.termDealCount} of ${context.peerSetSize} deals contain this term`
              : 'Corpus prevalence unavailable'}
          </div>
          {context.scopeNote ? <div className="mt-1 text-[9px] text-inkFaint">{context.scopeNote}</div> : null}
          {context.truncated ? <div className="mt-1 text-[9px] font-medium text-[#B14E63]">Some underlying records may be truncated.</div> : null}
        </div>

        <DistributionSection title="Treatments" summaries={context.treatments} denominator={termDenominator} />
        <DistributionSection title="Exceptions" summaries={context.exceptions} denominator={termDenominator} />
        <DistributionSection title="Market ranges" summaries={context.metrics} denominator={termDenominator} />

        {Array.isArray(context.deals) && context.deals.length ? (
          <section className="border-t border-border pt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink mb-2">All supporting deals</h3>
            <div className="space-y-1 text-[10px] text-inkLight">
              {context.deals.map((deal, index) => <div key={deal.dealId || deal.deal_id || deal.id || index}><DealLink deal={deal} /></div>)}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

export { CategoricalDistribution, CountLine, DistributionSection, NumericDistribution, pct };
