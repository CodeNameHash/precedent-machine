import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, SkeletonTable } from '../../components/UI';
import AdminNav from '../../components/admin/AdminNav';

const DEFAULT_LIMIT = 100;

async function readJson(resp) {
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(text || `HTTP ${resp.status}`);
  }
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : '-';
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(1)}%`;
}

function rate(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Math.round(Number(value) * 100)}%`;
}

function num(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString();
}

function typeStyle(type) {
  if (type === 'NOSOL') return 'bg-seller/10 text-seller border-seller/20';
  if (type === 'COV') return 'bg-buyer/10 text-buyer border-buyer/20';
  if (type === 'MISC') return 'bg-neutral/10 text-inkMid border-neutral/20';
  if (type === 'IGNORE/ANCILLARY') return 'bg-gray-100 text-inkFaint border-border';
  return 'bg-bg text-inkLight border-border';
}

function SuggestionPill({ type }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-ui font-semibold uppercase tracking-wide ${typeStyle(type)}`}>
      {type || 'UNKNOWN'}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded border border-border bg-white p-3">
      <div className="text-[10px] font-ui uppercase tracking-wide text-inkFaint">{label}</div>
      <div className="mt-1 font-display text-xl text-ink">{value}</div>
    </div>
  );
}

function GapReference({ summary, gap }) {
  return [
    `deal_id=${summary.deal_id}`,
    `gap=${gap.id}`,
    `start=${gap.start}`,
    `length=${gap.length}`,
    gap.rough_heading ? `heading=${gap.rough_heading}` : null,
    gap.suggested_type ? `suggested=${gap.suggested_type}` : null,
  ].filter(Boolean).join(' | ');
}

export default function GapReviewAdmin() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const selectedDealId = typeof router.query.deal_id === 'string' ? router.query.deal_id : null;
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [minCoverage, setMinCoverage] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [copiedGap, setCopiedGap] = useState(null);

  const selectedSummary = detail?.summary || rows.find(row => row.deal_id === selectedDealId) || null;

  const summaryUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('limit', String(limit || DEFAULT_LIMIT));
    if (minCoverage !== '') sp.set('min_coverage', String(minCoverage));
    return `/api/admin/gaps?${sp.toString()}`;
  }, [limit, minCoverage]);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson(await fetch(summaryUrl));
      setRows(data.rows || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (dealId) => {
    if (!dealId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    try {
      const data = await readJson(await fetch(`/api/admin/gaps?deal_id=${encodeURIComponent(dealId)}`));
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [summaryUrl]);

  useEffect(() => {
    if (!router.isReady) return;
    loadDetail(selectedDealId);
  }, [router.isReady, selectedDealId]);

  const openDeal = (dealId) => {
    router.push({ pathname: '/admin/gaps', query: { deal_id: dealId } }, undefined, { shallow: true });
  };

  const copyReference = async (gap) => {
    if (!selectedSummary || !gap) return;
    const ref = GapReference({ summary: selectedSummary, gap });
    await navigator.clipboard.writeText(ref);
    setCopiedGap(gap.id);
    setTimeout(() => setCopiedGap(null), 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Admin', href: '/admin' }, { label: 'Gap Review' }]} />
      <AdminNav />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Gap Review</h1>
          <p className="mt-1 text-sm font-ui text-inkLight">
            Coverage gaps sorted low first, with one-deal detail loaded on demand.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-ui text-inkLight">
            Limit
            <input
              type="number"
              min="1"
              max="100"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              className="ml-2 w-20 rounded border border-border px-2 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="text-xs font-ui text-inkLight">
            Max coverage
            <input
              type="number"
              min="0"
              max="100"
              value={minCoverage}
              onChange={e => setMinCoverage(e.target.value)}
              placeholder="Any"
              className="ml-2 w-24 rounded border border-border px-2 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <button
            onClick={loadSummary}
            disabled={loading}
            className="rounded border border-border px-3 py-1.5 text-sm font-ui text-inkLight hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-seller/20 bg-seller/5 p-3 text-sm font-ui text-seller">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-bg/50 px-4 py-3">
            <h2 className="font-display text-lg text-ink">Deals</h2>
            {pagination && (
              <span className="text-xs font-ui text-inkFaint">
                {pagination.returned} shown - {pagination.scanned} scanned - {pagination.total} total
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm font-ui text-inkFaint">No deals match the current filter.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Deal</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Coverage</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Gaps</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Largest</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Canonical</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Quotes</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Ingest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.deal_id}
                    className={`border-b border-border last:border-0 hover:bg-bg/40 ${selectedDealId === row.deal_id ? 'bg-accent/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDeal(row.deal_id)}
                        className="text-left font-ui text-ink hover:text-accent"
                      >
                        <span className="block font-medium">{row.acquirer || '?'} / {row.target || '?'}</span>
                        <span className="block text-[10px] text-inkFaint">{row.deal_id}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-ui text-ink">{pct(row.coverage_pct)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.gap_count)}</td>
                    <td className="max-w-md px-4 py-3">
                      <div className="font-ui text-ink">{num(row.largest_gap_chars)} chars</div>
                      <div className="mt-0.5 truncate text-xs font-ui text-inkLight">{row.largest_gap_preview || '-'}</div>
                    </td>
                    <td className="px-4 py-3 font-ui text-ink">{rate(row.canonical_rate)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.unverified_quotes)}</td>
                    <td className="px-4 py-3">
                      <div className="font-ui text-xs text-inkMid">{row.metadata?.ingest_status || row.latest_ingest_run_status || '-'}</div>
                      <div className="text-[10px] text-inkFaint">
                        run {shortId(row.latest_ingest_run_id)} - cand {shortId(row.latest_ingest_candidate_id)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedDealId && (
        <div className="space-y-4">
          {detailLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : selectedSummary ? (
            <>
              <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl text-ink">
                      {selectedSummary.acquirer || '?'} / {selectedSummary.target || '?'}
                    </h2>
                    <p className="mt-1 text-xs font-ui text-inkFaint">{selectedSummary.deal_id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/review/${selectedSummary.deal_id}?tab=document`}
                      className="rounded bg-accent px-3 py-1.5 text-sm font-ui text-white hover:bg-accent/90"
                    >
                      Review document
                    </Link>
                    <Link
                      href={`/api/trust/report?deal_id=${selectedSummary.deal_id}`}
                      className="rounded border border-border px-3 py-1.5 text-sm font-ui text-inkLight hover:border-accent hover:text-ink"
                    >
                      Trust report
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Metric label="Coverage" value={pct(selectedSummary.coverage_pct)} />
                  <Metric label="Gaps" value={num(selectedSummary.gap_count)} />
                  <Metric label="Largest gap" value={`${num(selectedSummary.largest_gap_chars)} chars`} />
                  <Metric label="Canonical" value={rate(selectedSummary.canonical_rate)} />
                  <Metric label="Unverified quotes" value={num(selectedSummary.unverified_quotes)} />
                </div>
              </div>

              {(detail?.gaps || []).length === 0 ? (
                <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
                  No coverage gaps above the threshold.
                </div>
              ) : (
                <div className="space-y-3">
                  {(detail?.gaps || []).map((gap, index) => (
                    <div key={gap.id} className="rounded-lg border border-border bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-accent">{gap.id}</span>
                            <SuggestionPill type={gap.suggested_type} />
                            <span className="text-xs font-ui text-inkFaint">
                              start {num(gap.start)} - {num(gap.length)} chars
                            </span>
                          </div>
                          <h3 className="mt-2 font-display text-lg text-ink">
                            {gap.rough_heading || `Gap ${index + 1}`}
                          </h3>
                          <p className="mt-1 text-sm font-ui text-inkLight">{gap.suggested_reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyReference(gap)}
                            className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                          >
                            {copiedGap === gap.id ? 'Copied' : 'Copy reference'}
                          </button>
                          <Link
                            href={`/review/${selectedSummary.deal_id}?tab=document&mode=edit&gap=${encodeURIComponent(gap.id)}`}
                            className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                          >
                            Review gap
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded border border-border bg-bg/40 p-3">
                          <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">Before</div>
                          <p className="max-h-36 overflow-auto whitespace-pre-wrap text-xs font-ui leading-relaxed text-inkLight">
                            {gap.before_context || '-'}
                          </p>
                        </div>
                        <div className="rounded border border-border bg-bg/40 p-3">
                          <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">After</div>
                          <p className="max-h-36 overflow-auto whitespace-pre-wrap text-xs font-ui leading-relaxed text-inkLight">
                            {gap.after_context || '-'}
                          </p>
                        </div>
                      </div>

                      <details className="mt-4 rounded border border-border bg-white" open={index === 0}>
                        <summary className="cursor-pointer px-3 py-2 text-sm font-ui font-medium text-ink">
                          Full gap text
                        </summary>
                        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap border-t border-border bg-bg/40 p-3 text-xs leading-relaxed text-ink">
                          {gap.full_text}
                        </pre>
                      </details>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-ui text-inkFaint">
                        <span>
                          Before provision: {gap.adjacent_provisions?.before
                            ? `${shortId(gap.adjacent_provisions.before.provision_id)} - ${gap.adjacent_provisions.before.type || '?'} - ${gap.adjacent_provisions.before.category || '?'}`
                            : '-'}
                        </span>
                        <span>
                          After provision: {gap.adjacent_provisions?.after
                            ? `${shortId(gap.adjacent_provisions.after.provision_id)} - ${gap.adjacent_provisions.after.type || '?'} - ${gap.adjacent_provisions.after.category || '?'}`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
