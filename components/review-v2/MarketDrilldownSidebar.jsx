import Link from 'next/link';
import { formatNumericMarketSummary } from './marketNumericFormat';
import { SeeProvisionDisclosure } from '../review/primitives/ProvisionTablePrimitives';

const SIDEBAR_CLASS = 'hidden lg:block w-56 xl:w-[280px] shrink-0 border-l border-border bg-white sticky top-[var(--mtx-head-h,72px)] h-[calc(100vh-var(--mtx-head-h,72px))] overflow-y-auto';

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

function CapturedCoverageNote({ summary }) {
  const coverage = summary?.coverage;
  if (!coverage) return null;
  const notes = [];
  if (coverage.valueUnknownCount) notes.push(`${coverage.valueUnknownCount} present deal${coverage.valueUnknownCount === 1 ? '' : 's'} not captured`);
  if (coverage.excludedCount) notes.push(`${coverage.excludedCount} excluded as non-comparable`);
  if (!notes.length) return null;
  return <p className="mt-2 text-[9px] leading-4 text-inkFaint">{notes.join(' · ')}</p>;
}

function CategoricalDistribution({ summary, defaultDenominator }) {
  const values = Array.isArray(summary.values) ? summary.values : [];
  if (!values.length) return <p className="text-[11px] italic text-inkFaint">No treatments captured.</p>;
  return (
    <div className="divide-y divide-border">
      {values.map((value, index) => {
        const denominator = Number.isFinite(value.denominator) ? value.denominator : defaultDenominator;
        const deals = Array.isArray(value.deals) ? value.deals : [];
        const valueLabel = (
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-medium text-ink">
              {value.label || value.value || 'Not captured'}
              {(summary.subjectValues || []).map(String).includes(String(value.value)) ? <span className="ml-1.5 text-[8px] font-bold uppercase tracking-wider text-[#2F6DB5]">Current deal</span> : null}
            </span>
            <CountLine count={value.count} denominator={denominator} />
          </div>
        );
        const key = `${summary.attribute || 'value'}-${value.value || value.label || index}`;
        // The value/count row itself always shows -- only the supporting-
        // deals list underneath is a disclosure, and it's genuinely absent
        // (not just collapsed) when this value carries no per-deal
        // breakdown, so SeeProvisionDisclosure's own "no children, don't
        // render anything" contract doesn't fit here; branch instead of
        // handing it empty children.
        if (!deals.length) {
          return (
            <div key={key} className="py-2">
              {valueLabel}
            </div>
          );
        }
        return (
          <SeeProvisionDisclosure
            key={key}
            as="div"
            className="py-2"
            triggerClassName="cursor-pointer"
            label={valueLabel}
            bodyClassName="mt-2 space-y-1 pl-2 border-l border-border text-[10px] text-inkLight"
          >
            {deals.map((deal, dealIndex) => <div key={deal.dealId || deal.deal_id || deal.id || dealIndex}><DealLink deal={deal} /></div>)}
          </SeeProvisionDisclosure>
        );
      })}
      <CapturedCoverageNote summary={summary} />
    </div>
  );
}

function NumericRangeScale({ summary, formatted }) {
  const min = Number(summary.min);
  const max = Number(summary.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  const position = (value) => `${Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100))}%`;
  const ticks = [
    { key: 'min', label: 'Min', value: summary.min },
    { key: 'p25', label: 'P25', value: summary.p25 },
    { key: 'median', label: 'Median', value: summary.median },
    { key: 'mean', label: 'Mean', value: summary.mean },
    { key: 'p75', label: 'P75', value: summary.p75 },
    { key: 'max', label: 'Max', value: summary.max },
  ].filter((tick) => Number.isFinite(Number(tick.value)));
  const formatTick = (tick) => {
    const unit = summary.unit;
    if (unit === 'percent') return `${Number(tick.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    if (unit === 'days_equivalent') return `${Number(tick.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}d`;
    return Number(tick.value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  };
  return (
    <div className="mt-3 mb-3" data-testid="market-range-scale">
      <div className="relative h-5">
        <div className="absolute left-0 right-0 top-2 h-[2px] bg-[#D7D7D7]" />
        {ticks.map((tick) => (
          <div key={tick.key} className="absolute top-0 -translate-x-1/2" style={{ left: position(tick.value) }} title={`${tick.label} ${formatTick(tick)}`}>
            <div className={`mx-auto h-4 ${tick.key === 'median' ? 'w-[2px] bg-[#1F1F1F]' : 'w-px bg-[#9A9A9A]'}`} />
          </div>
        ))}
        {Number.isFinite(Number(summary.subjectValue)) ? (
          <div className="absolute top-[3px] -translate-x-1/2" style={{ left: position(summary.subjectValue) }} title="Current deal">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2F6DB5] shadow" />
          </div>
        ) : null}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1">
        {ticks.map((tick) => (
          <div key={`legend-${tick.key}`} className="text-[8px] text-inkFaint">
            <span className="font-bold uppercase tracking-wide">{tick.label}</span> {formatTick(tick)}
          </div>
        ))}
      </div>
      {summary.subjectLabel ? <div className="mt-2 text-[9px] font-semibold text-[#2F6DB5]">Current deal · {summary.subjectLabel}</div> : null}
      {!summary.subjectLabel && formatted?.range ? <div className="mt-2 text-[9px] text-inkFaint">{formatted.range}</div> : null}
    </div>
  );
}

function NumericDistribution({ summary }) {
  const formatted = formatNumericMarketSummary(summary);
  if (!formatted) {
    return (
      <div className="border border-border bg-paper2 px-3 py-3">
        {summary.subjectLabel ? <div className="text-[11px] font-semibold text-[#2F6DB5]">Current deal · {summary.subjectLabel}</div> : null}
        <p className="mt-1 text-[10px] text-inkFaint">
          {summary.comparisonUnavailableReason || 'No same-basis peer percentage cohort is available.'}
        </p>
        <CapturedCoverageNote summary={summary} />
      </div>
    );
  }
  return (
    <div className="border border-border bg-paper2 px-3 py-3">
      <div className="text-sm font-semibold text-ink">{formatted.headline}</div>
      <NumericRangeScale summary={summary} formatted={formatted} />
      {Number.isFinite(summary.count) ? <div className="mt-1 text-[9px] uppercase tracking-wider text-inkFaint">{summary.count} deals with a captured value</div> : null}
      <CapturedCoverageNote summary={summary} />
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

function CurrentDealTerms({ terms }) {
  if (!Array.isArray(terms) || !terms.length) return null;
  return (
    <section className="border-t border-border pt-4" data-testid="market-current-deal-terms">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink mb-2">This deal</h3>
      <dl className="space-y-2">
        {terms.map((term, index) => (
          <div key={`${term.key || term.label || 'term'}-${index}`} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 text-[10px] leading-4">
            <dt className="font-bold text-inkFaint">{term.label}</dt>
            <dd className="text-ink">{term.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function MarketDrilldownSidebar({ context, onClose }) {
  if (!context) {
    return (
      <aside className={SIDEBAR_CLASS} data-testid="market-drilldown-sidebar">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink">Market detail</div>
            {onClose ? <button type="button" onClick={onClose} aria-label="Close market detail" className="text-lg leading-none text-inkLight hover:text-ink">×</button> : null}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-inkLight">Select a market cell to see every captured treatment, exception, and underlying deal.</p>
        </div>
      </aside>
    );
  }

  const termDenominator = Number.isFinite(context.termDealCount) ? context.termDealCount : context.peerSetSize;
  return (
    <aside className={SIDEBAR_CLASS} data-testid="market-drilldown-sidebar">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-inkFaint">Market detail</div>
            <h2 className="mt-1 text-base font-bold leading-tight text-ink">{context.label || 'Selected term'}</h2>
          </div>
          {onClose ? <button type="button" onClick={onClose} aria-label="Close market detail" className="text-lg leading-none text-inkLight hover:text-ink">×</button> : null}
        </div>

        <CurrentDealTerms terms={context.currentDealTerms} />
        <DistributionSection title="Market ranges" summaries={context.metrics} denominator={termDenominator} />
        <DistributionSection title="Treatments" summaries={context.treatments} denominator={termDenominator} />
        <DistributionSection title="Exceptions" summaries={context.exceptions} denominator={termDenominator} />

        <div className="border-t border-border pt-3 text-[9px] text-inkFaint">
          {Number.isFinite(context.termDealCount) && Number.isFinite(context.peerSetSize)
            ? `${context.termDealCount} of ${context.peerSetSize} deals contain this term`
            : 'Corpus prevalence unavailable'}
          {context.scopeNote ? <div className="mt-1">{context.scopeNote}</div> : null}
          {context.truncated ? <div className="mt-1 font-medium text-[#B14E63]">Some underlying records may be truncated.</div> : null}
        </div>

        {Array.isArray(context.deals) && context.deals.length ? (
          <SeeProvisionDisclosure
            as="div"
            className="border-t border-border pt-4"
            triggerClassName="cursor-pointer list-none text-[9px] font-bold uppercase tracking-[0.1em] text-inkLight"
            label={`Supporting deals (${context.deals.length})`}
            bodyClassName="mt-2 space-y-1 text-[10px] text-inkLight"
          >
            {context.deals.map((deal, index) => <div key={deal.dealId || deal.deal_id || deal.id || index}><DealLink deal={deal} /></div>)}
          </SeeProvisionDisclosure>
        ) : null}
      </div>
    </aside>
  );
}

export { CategoricalDistribution, CountLine, DistributionSection, NumericDistribution, pct };
