import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs } from '../../components/UI';
import AdminNav from '../../components/admin/AdminNav';

const DEFAULT_LIMIT = 100;
const DEFAULT_CODING_ACTION = 'propose_new_code';
const CODING_ACTIONS = [
  { value: 'propose_new_code', label: 'Propose new code' },
  { value: 'assign_existing', label: 'Assign existing' },
  { value: 'split', label: 'Split' },
  { value: 'ignore', label: 'Ignore' },
];

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

function NeedsCodeReference({ summary, item }) {
  return [
    `deal_id=${summary.deal_id}`,
    `needs_code=${item.id}`,
    item.provision_id ? `provision_id=${item.provision_id}` : null,
    item.type ? `type=${item.type}` : null,
    item.category ? `category=${item.category}` : null,
    item.code ? `code=${item.code}` : null,
  ].filter(Boolean).join(' | ');
}

function FullText({ item }) {
  return (
    <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded border border-border bg-bg/40 p-4 text-[13px] leading-6 text-ink">
      {item.full_text || item.text || item.preview || ''}
    </pre>
  );
}

function GapText({ gap }) {
  return <FullText item={gap} />;
}

function NeedsCodeText({ item }) {
  return <FullText item={item} />;
}

function NeedsCodeTaskForm({ draft, status, submitting, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="rounded border border-border bg-bg/40 p-3">
      <div className="grid gap-3 md:grid-cols-[180px_minmax(160px,1fr)]">
        <label className="text-xs font-ui text-inkLight">
          Action
          <select
            value={draft.suggested_action}
            onChange={(e) => onChange({ suggested_action: e.target.value })}
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {CODING_ACTIONS.map((action) => (
              <option key={action.value} value={action.value}>{action.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-ui text-inkLight">
          Existing code
          <input
            type="text"
            value={draft.suggested_code}
            onChange={(e) => onChange({ suggested_code: e.target.value })}
            placeholder="Optional"
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-ui text-inkLight">
        Ben note
        <textarea
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm leading-5 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-accent px-3 py-1.5 text-xs font-ui text-white hover:bg-accent/90 disabled:opacity-40"
        >
          {submitting ? 'Queueing' : 'Queue for CLI'}
        </button>
        {status?.message && (
          <span className={`text-xs font-ui ${status.ok ? 'text-buyer' : 'text-seller'}`}>
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}

function LoadingRows({ rows = 4 }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_2fr]">
            <div className="h-4 rounded bg-bg" />
            <div className="h-4 rounded bg-bg" />
            <div className="h-4 rounded bg-bg" />
            <div className="h-4 rounded bg-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GapReviewAdmin() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const selectedDealId = typeof router.query.deal_id === 'string' ? router.query.deal_id : null;
  const selectedGapId = typeof router.query.gap === 'string' ? router.query.gap : null;
  const selectedNeedsCodeId = typeof router.query.needs_code === 'string'
    ? router.query.needs_code
    : (typeof router.query.uncoded === 'string' ? router.query.uncoded : null);
  const readerRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [minCoverage, setMinCoverage] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [copiedGap, setCopiedGap] = useState(null);
  const [copiedNeedsCode, setCopiedNeedsCode] = useState(null);
  const [expandedGapIds, setExpandedGapIds] = useState(() => new Set());
  const [expandedNeedsCodeIds, setExpandedNeedsCodeIds] = useState(() => new Set());
  const [taskDrafts, setTaskDrafts] = useState({});
  const [taskStatuses, setTaskStatuses] = useState({});
  const [taskSubmitting, setTaskSubmitting] = useState(null);

  const selectedSummary = detail?.summary || rows.find(row => row.deal_id === selectedDealId) || null;
  const gaps = detail?.gaps || [];
  const selectedGap = gaps.find((gap) => gap.id === selectedGapId) || gaps[0] || null;
  const selectedGapKey = selectedGap ? selectedGap.id : null;
  const needsCodeItems = detail?.needs_code || detail?.uncoded || [];
  const selectedNeedsCode = needsCodeItems.find((item) => item.id === selectedNeedsCodeId) || needsCodeItems[0] || null;
  const selectedNeedsCodeKey = selectedNeedsCode ? selectedNeedsCode.id : null;
  const parserReview = detail?.parser_review || null;
  const parserSummary = parserReview?.summary || {};
  const structuralGaps = detail?.structural_gaps || parserReview?.structural_gaps || [];
  const definitionWarnings = detail?.definition_warnings || parserReview?.definition_warnings || [];
  const dataModelFlags = detail?.data_model_flags || parserReview?.data_model_flags || [];

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

  useEffect(() => {
    if (!detail) return;
    setExpandedGapIds(new Set((detail.gaps || []).map((gap) => gap.id)));
    setExpandedNeedsCodeIds(new Set());
  }, [detail?.summary?.deal_id]);

  useEffect(() => {
    if (!selectedDealId || !detail || !readerRef.current) return;
    readerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedDealId, detail]);

  const copyReference = async (gap) => {
    if (!selectedSummary || !gap) return;
    const ref = GapReference({ summary: selectedSummary, gap });
    await navigator.clipboard.writeText(ref);
    setCopiedGap(gap.id);
    setTimeout(() => setCopiedGap(null), 1200);
  };

  const copyGapText = async (gap) => {
    if (!gap) return;
    await navigator.clipboard.writeText(gap.full_text || gap.text || gap.preview || '');
    setCopiedGap(`${gap.id}:text`);
    setTimeout(() => setCopiedGap(null), 1200);
  };

  const copyNeedsCodeReference = async (item) => {
    if (!selectedSummary || !item) return;
    const ref = NeedsCodeReference({ summary: selectedSummary, item });
    await navigator.clipboard.writeText(ref);
    setCopiedNeedsCode(item.id);
    setTimeout(() => setCopiedNeedsCode(null), 1200);
  };

  const copyNeedsCodeText = async (item) => {
    if (!item) return;
    await navigator.clipboard.writeText(item.full_text || item.text || item.preview || '');
    setCopiedNeedsCode(`${item.id}:text`);
    setTimeout(() => setCopiedNeedsCode(null), 1200);
  };

  const expandAll = () => {
    setExpandedGapIds(new Set(gaps.map((gap) => gap.id)));
  };

  const collapseAll = () => {
    setExpandedGapIds(new Set());
  };

  const toggleGap = (gapId) => {
    setExpandedGapIds((current) => {
      const next = new Set(current);
      if (next.has(gapId)) next.delete(gapId);
      else next.add(gapId);
      return next;
    });
  };

  const expandAllNeedsCode = () => {
    setExpandedNeedsCodeIds(new Set(needsCodeItems.map((item) => item.id)));
  };

  const collapseAllNeedsCode = () => {
    setExpandedNeedsCodeIds(new Set());
  };

  const toggleNeedsCode = (itemId) => {
    setExpandedNeedsCodeIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const needsCodeTaskKey = (item) => item ? (item.provision_id || item.id) : '';

  const taskDraftFor = (item) => {
    const key = needsCodeTaskKey(item);
    return taskDrafts[key] || { suggested_action: DEFAULT_CODING_ACTION, suggested_code: '', note: '' };
  };

  const taskStatusFor = (item) => taskStatuses[needsCodeTaskKey(item)] || null;

  const updateTaskDraft = (item, patch) => {
    const key = needsCodeTaskKey(item);
    setTaskDrafts((current) => ({
      ...current,
      [key]: {
        suggested_action: DEFAULT_CODING_ACTION,
        suggested_code: '',
        note: '',
        ...(current[key] || {}),
        ...patch,
      },
    }));
  };

  const submitNeedsCodeTask = async (event, item) => {
    event.preventDefault();
    if (!selectedSummary || !item) return;
    const key = needsCodeTaskKey(item);
    const draft = taskDraftFor(item);
    setTaskSubmitting(key);
    setTaskStatuses((current) => ({ ...current, [key]: null }));
    setError(null);
    try {
      const data = await readJson(await fetch('/api/admin/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: selectedSummary.deal_id,
          needs_code_id: item.id,
          provision_id: item.provision_id || null,
          suggested_action: draft.suggested_action,
          suggested_code: draft.suggested_code,
          note: draft.note,
        }),
      }));
      setTaskStatuses((current) => ({
        ...current,
        [key]: { ok: true, message: `Queued ${shortId(data.task?.id)}` },
      }));
    } catch (err) {
      setTaskStatuses((current) => ({
        ...current,
        [key]: { ok: false, message: err.message },
      }));
    } finally {
      setTaskSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Admin', href: '/admin' }, { label: 'Gap Review' }]} />
      <AdminNav />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Gap Review</h1>
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
        <LoadingRows rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
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
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Parser</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Def</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Data</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Needs Code</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Largest</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Canonical</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Quotes</th>
                  <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Ingest</th>
                  <th className="px-4 py-3 text-right font-ui font-medium text-inkLight">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.deal_id}
                    className={`border-b border-border last:border-0 hover:bg-bg/40 ${selectedDealId === row.deal_id ? 'bg-accent/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={{ pathname: '/admin/gaps', query: { deal_id: row.deal_id } }}
                        className="block text-left font-ui text-ink hover:text-accent"
                      >
                        <span className="block font-medium">{row.acquirer || '?'} / {row.target || '?'}</span>
                        <span className="block text-[10px] text-inkFaint">{row.deal_id}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-ui text-ink">{pct(row.coverage_pct)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.gap_count)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.parser_structural_gap_count)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.definition_warning_count)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.data_model_flag_count)}</td>
                    <td className="px-4 py-3 font-ui text-ink">{num(row.needs_code_count ?? row.uncoded_count)}</td>
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={{ pathname: '/admin/gaps', query: { deal_id: row.deal_id } }}
                        className="inline-flex rounded bg-accent px-3 py-1.5 text-xs font-ui text-white hover:bg-accent/90"
                      >
                        Read
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedDealId && (
        <div ref={readerRef} className="space-y-4">
          {detailLoading ? (
            <LoadingRows rows={3} />
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
                      href={`/review/${selectedSummary.deal_id}`}
                      className="rounded bg-accent px-3 py-1.5 text-sm font-ui text-white hover:bg-accent/90"
                    >
                      Open deal
                    </Link>
                    <Link
                      href={`/api/trust/report?deal_id=${selectedSummary.deal_id}`}
                      className="rounded border border-border px-3 py-1.5 text-sm font-ui text-inkLight hover:border-accent hover:text-ink"
                    >
                      Trust report
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-9">
                  <Metric label="Coverage" value={pct(selectedSummary.coverage_pct)} />
                  <Metric label="Gaps" value={num(selectedSummary.gap_count)} />
                  <Metric label="Needs Code" value={num(selectedSummary.needs_code_count ?? selectedSummary.uncoded_count)} />
                  <Metric label="Largest gap" value={`${num(selectedSummary.largest_gap_chars)} chars`} />
                  <Metric label="Canonical" value={rate(selectedSummary.canonical_rate)} />
                  <Metric label="Unverified quotes" value={num(selectedSummary.unverified_quotes)} />
                  <Metric label="Parser gaps" value={num(parserSummary.structural_gap_count)} />
                  <Metric label="Definition warnings" value={num(parserSummary.definition_warning_count)} />
                  <Metric label="Data flags" value={num(parserSummary.data_model_flag_count)} />
                </div>
              </div>

              {gaps.length === 0 ? (
                <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
                  No coverage gaps above the threshold.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="rounded-lg border border-border bg-white shadow-sm">
                      <div className="border-b border-border bg-bg/50 px-4 py-3">
                        <h3 className="font-display text-lg text-ink">Gaps</h3>
                      </div>
                      <div className="max-h-[620px] overflow-auto p-2">
                        {gaps.map((gap) => (
                          <Link
                            key={gap.id}
                            href={{ pathname: '/admin/gaps', query: { deal_id: selectedSummary.deal_id, gap: gap.id } }}
                            className={`block rounded border px-3 py-2 text-left hover:border-accent ${
                              selectedGapKey === gap.id ? 'border-accent bg-accent/5' : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-accent">{gap.id}</span>
                              <SuggestionPill type={gap.suggested_type} />
                            </div>
                            <div className="mt-1 truncate text-xs font-ui text-ink">
                              {gap.rough_heading || gap.preview || gap.id}
                            </div>
                            <div className="mt-1 text-[10px] font-ui text-inkFaint">
                              {num(gap.length)} chars, start {num(gap.start)}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
                      {selectedGap ? (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-accent">{selectedGap.id}</span>
                                <SuggestionPill type={selectedGap.suggested_type} />
                                <span className="text-xs font-ui text-inkFaint">
                                  start {num(selectedGap.start)} - {num(selectedGap.length)} chars
                                </span>
                              </div>
                              <h3 className="mt-2 font-display text-xl text-ink">
                                {selectedGap.rough_heading || selectedGap.id}
                              </h3>
                              <p className="mt-1 text-sm font-ui text-inkLight">{selectedGap.suggested_reason}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copyReference(selectedGap)}
                                className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                              >
                                {copiedGap === selectedGap.id ? 'Copied' : 'Copy reference'}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyGapText(selectedGap)}
                                className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                              >
                                {copiedGap === `${selectedGap.id}:text` ? 'Copied' : 'Copy text'}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded border border-border bg-bg/40 p-3">
                              <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">Before</div>
                              <p className="max-h-44 overflow-auto whitespace-pre-wrap text-xs font-ui leading-relaxed text-inkLight">
                                {selectedGap.before_context || '-'}
                              </p>
                            </div>
                            <div className="rounded border border-border bg-bg/40 p-3">
                              <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">After</div>
                              <p className="max-h-44 overflow-auto whitespace-pre-wrap text-xs font-ui leading-relaxed text-inkLight">
                                {selectedGap.after_context || '-'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <GapText gap={selectedGap} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/50 px-4 py-3">
                      <h3 className="font-display text-lg text-ink">All Gap Text</h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={expandAll}
                          className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={collapseAll}
                          className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                        >
                          Collapse all
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {gaps.map((gap, index) => {
                        const open = expandedGapIds.has(gap.id);
                        return (
                          <div key={gap.id} className="p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-accent">{gap.id}</span>
                                  <SuggestionPill type={gap.suggested_type} />
                                  <span className="text-xs font-ui text-inkFaint">
                                    start {num(gap.start)} - {num(gap.length)} chars
                                  </span>
                                </div>
                                <h4 className="mt-2 font-display text-lg text-ink">
                                  {gap.rough_heading || `Gap ${index + 1}`}
                                </h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleGap(gap.id)}
                                  className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                                >
                                  {open ? 'Collapse' : 'Expand'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyGapText(gap)}
                                  className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                                >
                                  {copiedGap === `${gap.id}:text` ? 'Copied' : 'Copy text'}
                                </button>
                              </div>
                            </div>
                            {open ? (
                              <div className="mt-4">
                                <GapText gap={gap} />
                              </div>
                            ) : (
                              <p className="mt-3 truncate text-sm font-ui text-inkLight">{gap.preview}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </>
              )}

              {(structuralGaps.length > 0 || definitionWarnings.length > 0 || dataModelFlags.length > 0) && (
                <div className="rounded-lg border border-border bg-white shadow-sm">
                  <div className="border-b border-border bg-bg/50 px-4 py-3">
                    <h3 className="font-display text-lg text-ink">Parser Review</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {structuralGaps.map((gap) => (
                      <div key={gap.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-accent">{gap.id}</span>
                          <SuggestionPill type={gap.region_type} />
                          <span className="text-xs font-ui text-inkFaint">
                            start {num(gap.start)} - {num(gap.length)} chars
                          </span>
                        </div>
                        <FullText item={gap} />
                      </div>
                    ))}
                    {definitionWarnings.map((warning) => (
                      <div key={warning.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-accent">{warning.id}</span>
                          <SuggestionPill type={warning.code} />
                          <span className="text-xs font-ui text-inkFaint">
                            {warning.section_number || '-'} {warning.term ? `- ${warning.term}` : ''}
                          </span>
                        </div>
                        <h4 className="mt-2 font-display text-lg text-ink">
                          {warning.section_title || warning.term || warning.id}
                        </h4>
                        <p className="mt-1 text-sm font-ui text-inkLight">{warning.message}</p>
                        <p className="mt-3 rounded border border-border bg-bg/40 p-3 text-sm font-ui leading-6 text-ink">
                          {warning.preview}
                        </p>
                      </div>
                    ))}
                    {dataModelFlags.map((flag) => (
                      <div key={flag.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-accent">{flag.id}</span>
                          <SuggestionPill type={flag.flag} />
                          <span className="text-xs font-ui text-inkFaint">
                            {flag.section_number || '-'}
                          </span>
                        </div>
                        <h4 className="mt-2 font-display text-lg text-ink">
                          {flag.section_title || flag.id}
                        </h4>
                        <p className="mt-3 rounded border border-border bg-bg/40 p-3 text-sm font-ui leading-6 text-ink">
                          {flag.preview}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {needsCodeItems.length === 0 ? (
                <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
                  No Needs Code sections.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="rounded-lg border border-border bg-white shadow-sm">
                      <div className="border-b border-border bg-bg/50 px-4 py-3">
                        <h3 className="font-display text-lg text-ink">Needs Code</h3>
                      </div>
                      <div className="max-h-[620px] overflow-auto p-2">
                        {needsCodeItems.map((item) => (
                          <Link
                            key={item.id}
                            href={{ pathname: '/admin/gaps', query: { deal_id: selectedSummary.deal_id, needs_code: item.id } }}
                            className={`block rounded border px-3 py-2 text-left hover:border-accent ${
                              selectedNeedsCodeKey === item.id ? 'border-accent bg-accent/5' : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-accent">{item.id}</span>
                              <SuggestionPill type={item.family_type || item.type || 'NEEDS CODE'} />
                            </div>
                            <div className="mt-1 truncate text-xs font-ui text-ink">
                              {item.rough_heading || item.preview || item.id}
                            </div>
                            <div className="mt-1 truncate text-[10px] font-ui text-inkFaint">
                              {num(item.length)} chars - {item.category || item.code || 'missing code'}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
                      {selectedNeedsCode ? (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-accent">{selectedNeedsCode.id}</span>
                                <SuggestionPill type={selectedNeedsCode.family_type || selectedNeedsCode.type || 'NEEDS CODE'} />
                                {selectedNeedsCode.provision_id && (
                                  <span className="text-xs font-ui text-inkFaint">prov {shortId(selectedNeedsCode.provision_id)}</span>
                                )}
                              </div>
                              <h3 className="mt-2 font-display text-xl text-ink">
                                {selectedNeedsCode.rough_heading || selectedNeedsCode.id}
                              </h3>
                              <p className="mt-1 text-sm font-ui text-inkLight">{selectedNeedsCode.suggested_reason}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copyNeedsCodeReference(selectedNeedsCode)}
                                className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                              >
                                {copiedNeedsCode === selectedNeedsCode.id ? 'Copied' : 'Copy reference'}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyNeedsCodeText(selectedNeedsCode)}
                                className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                              >
                                {copiedNeedsCode === `${selectedNeedsCode.id}:text` ? 'Copied' : 'Copy text'}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded border border-border bg-bg/40 p-3">
                              <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">Type</div>
                              <p className="truncate text-xs font-ui text-inkLight">{selectedNeedsCode.type || '-'}</p>
                            </div>
                            <div className="rounded border border-border bg-bg/40 p-3">
                              <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">Category</div>
                              <p className="truncate text-xs font-ui text-inkLight">{selectedNeedsCode.category || '-'}</p>
                            </div>
                            <div className="rounded border border-border bg-bg/40 p-3">
                              <div className="mb-1 text-[10px] font-ui uppercase tracking-wide text-inkFaint">Stored code</div>
                              <p className="truncate text-xs font-ui text-inkLight">{selectedNeedsCode.code || '-'}</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <NeedsCodeTaskForm
                              draft={taskDraftFor(selectedNeedsCode)}
                              status={taskStatusFor(selectedNeedsCode)}
                              submitting={taskSubmitting === needsCodeTaskKey(selectedNeedsCode)}
                              onChange={(patch) => updateTaskDraft(selectedNeedsCode, patch)}
                              onSubmit={(event) => submitNeedsCodeTask(event, selectedNeedsCode)}
                            />
                          </div>

                          <div className="mt-4">
                            <NeedsCodeText item={selectedNeedsCode} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/50 px-4 py-3">
                      <h3 className="font-display text-lg text-ink">All Needs Code Text</h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={expandAllNeedsCode}
                          className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={collapseAllNeedsCode}
                          className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                        >
                          Collapse all
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {needsCodeItems.map((item, index) => {
                        const open = expandedNeedsCodeIds.has(item.id);
                        return (
                          <div key={item.id} className="p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-accent">{item.id}</span>
                                  <SuggestionPill type={item.family_type || item.type || 'NEEDS CODE'} />
                                  <span className="text-xs font-ui text-inkFaint">{num(item.length)} chars</span>
                                </div>
                                <h4 className="mt-2 font-display text-lg text-ink">
                                  {item.rough_heading || `Needs Code ${index + 1}`}
                                </h4>
                                <p className="mt-1 text-xs font-ui text-inkLight">
                                  {item.category || item.code || item.suggested_reason}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleNeedsCode(item.id)}
                                  className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                                >
                                  {open ? 'Collapse' : 'Expand'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyNeedsCodeText(item)}
                                  className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
                                >
                                  {copiedNeedsCode === `${item.id}:text` ? 'Copied' : 'Copy text'}
                                </button>
                              </div>
                            </div>
                            {open ? (
                              <div className="mt-4">
                                <NeedsCodeText item={item} />
                              </div>
                            ) : (
                              <p className="mt-3 truncate text-sm font-ui text-inkLight">{item.preview}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
