// Review page market mode (?market=1). Two pieces:
//
//   - MarketSectionColumn — the per-section "Market" column beside each
//     primary section: prevalence ("N of M deals carry this provision") +
//     the corpus's common values for the section's dominant subtype, from
//     one edge-cached GET /api/corpus-stats per section (see
//     useSectionMarketStats in compareData.js). The chip treatment mirrors
//     ClauseSidebar's "Common values across the peer set" block —
//     ClauseSidebar keeps its own inline copy (its internals aren't
//     exported and that file is owned elsewhere), the DATA path is shared:
//     both consume the same corpus-stats featureSummary shape.
//
//   - OffMarketSection — the "Off-market terms" section pinned above the
//     section list: the DEAL_TO_MARKET executor's off-market/unusual rows
//     (commercial fields excluded — see compareData.js), rendered as a
//     review-style section: field label + this deal's value + market norm.
//     Hidden entirely when there are no rows.

const { prettifyEnumValue } = require('../review/shared');

const LAB = 'text-[9px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A] mb-1.5';

function roundNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  return `${sign}$${(abs / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

const RAW_CODE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

function humanizeCode(raw) {
  const spaced = String(raw || '').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : String(raw || '');
}

// Same value treatment the query surface uses (bool -> Yes/No, >=1e6 ->
// money, enum codes -> the review page's own label path, raw UPPER_SNAKE
// never reaches the page).
export function formatMarketValue(value, fieldPath) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6) return formatMoney(value);
    return roundNum(value);
  }
  const pretty = prettifyEnumValue(fieldPath || '', String(value));
  if (typeof pretty === 'string' && RAW_CODE_RE.test(pretty)) return humanizeCode(pretty);
  return pretty;
}

// "Market norm" text off a DEAL_TO_MARKET row's baseline_stats: numeric ->
// p25–p75 band; categorical -> the modal value.
export function baselineText(stats, fieldPath) {
  if (!stats) return '—';
  if (stats.p25 != null || stats.p75 != null) return `${roundNum(stats.p25)}–${roundNum(stats.p75)}`;
  if (Array.isArray(stats.distribution) && stats.distribution[0]) {
    const top = stats.distribution[0];
    const label = formatMarketValue(top.value, fieldPath);
    return top.count != null && stats.n ? `${label} (${top.count} of ${stats.n})` : label;
  }
  return '—';
}

function StatusNote({ children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em]">{children}</p>
    </div>
  );
}

// C (deal-to-market/compare robustness, Supabase-degraded incident): a
// failed/timed-out corpus-stats fetch used to leave "Loading market data…"
// on screen forever, or (once compareData.js's fetch DID reject) a dead-end
// error with no retry. compareData.js's fetchJson now bounds every request
// with a 15s AbortController timeout, and useSectionMarketStats/
// useDealToMarket both expose retry() -- this renders the friendly,
// retryable error state for both.
function ErrorNote({ onRetry, children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4 flex items-center justify-between gap-2">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em] text-[#B14E63]">{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline shrink-0"
          data-testid="market-column-retry"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

// Per-section market cell. `entry` from useSectionMarketStats:
// { code, stats, loading, error }.
export function MarketSectionColumn({ entry, onRetry }) {
  if (!entry || !entry.code) return <StatusNote>No market data for this section.</StatusNote>;
  if (entry.loading) return <StatusNote>Loading market data…</StatusNote>;
  if (entry.error) return <ErrorNote onRetry={onRetry}>Market data unavailable right now — retry</ErrorNote>;
  const stats = entry.stats;
  if (!stats) return <StatusNote>No market data for this section.</StatusNote>;
  const featureSummary = Array.isArray(stats.featureSummary) ? stats.featureSummary : [];
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-3" style={{ fontFamily: 'var(--mtx-sans)' }} data-testid="market-section-column">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] text-[#6B6B6B]">Deals with this provision</span>
        <span className="text-[13px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stats.dealsWithCode} of {stats.peerSetSize}
        </span>
      </div>
      {featureSummary.length ? (
        <div>
          <div className={LAB}>Common values across the corpus</div>
          {featureSummary.slice(0, 5).map((f) => (
            <div key={f.attribute} className="mb-2">
              <div className="text-[9px] text-[#6B6B6B] mb-1">{f.label}</div>
              <div className="flex flex-wrap gap-1">
                {(f.values || []).slice(0, 4).map((v) => (
                  <span
                    key={v.value}
                    className="border px-1.5 py-0.5 text-[8.5px]"
                    style={{ color: '#2F6DB5', borderColor: 'rgba(47,109,181,.25)', background: 'rgba(47,109,181,.08)' }}
                  >
                    {v.label} · {v.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#9A9A9A]">No common-value summary captured for this provision type.</p>
      )}
    </div>
  );
}

// "Off-market terms" — review-style section at the top of the section
// list. `data` from useDealToMarket: { rows, loading, error }. Renders
// nothing at all when resolved-and-empty (per spec: "if none, hide it").
export function OffMarketSection({ data }) {
  if (!data) return null;
  const { rows, loading, error } = data;
  if (!loading && !error && (!rows || !rows.length)) return null;
  return (
    <section id="sec-off-market" className="scroll-mt-28" data-testid="off-market-section">
      <details open className="mtx-section">
        <summary
          className="flex items-center gap-2.5 pb-2 border-b-2 border-black cursor-pointer select-none"
          style={{ listStyle: 'none' }}
        >
          <span className="w-2.5 h-2.5" style={{ background: '#B14E63', borderRadius: '9999px' }} />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">Off-market terms</h2>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        <div className="mt-4">
          {loading ? (
            <StatusNote>Comparing this deal to the market…</StatusNote>
          ) : error ? (
            <ErrorNote onRetry={data.retry}>Market data unavailable right now — retry</ErrorNote>
          ) : (
            <div className="rounded border border-border bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-xs" style={{ fontFamily: 'var(--mtx-sans)' }}>
                <thead>
                  <tr className="border-b border-[#E0E0E0]">
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">Term</th>
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">This deal</th>
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">Market norm</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.provision_type}-${row.field_path}`}
                      className="border-b border-[#EDEDEC] last:border-b-0 align-top"
                      style={row.status === 'UNUSUAL' ? { background: 'rgba(177, 78, 99, 0.06)' } : { background: 'rgba(168, 122, 46, 0.06)' }}
                    >
                      <td className="px-3 py-2 text-[#1F1F1F]">{row.field_label}</td>
                      <td className="px-3 py-2 mtx-mono font-bold text-[#1F1F1F]">{formatMarketValue(row.deal_value, row.field_path)}</td>
                      <td className="px-3 py-2 mtx-mono text-[#6B6B6B]">{baselineText(row.baseline_stats, row.field_path)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
