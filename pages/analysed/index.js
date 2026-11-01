import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../components/UI';
import PwBar from '../../components/chrome/PwBar';

// The analysed index (work package 55, note DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01):
// every run that has analysis, draft and final together. The old comparison
// could only see published releases; this page is the way to the draft runs,
// and the way from any run into a coded comparison.

const MAX_COMPARE_RUNS = 6;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function openHref(run) {
  if (run.phase === 'FINAL' && run.source_document_id) return `/deals/v2/${run.source_document_id}`;
  return `/review/product/${run.run_id}/provisions`;
}

function compareHref(selected) {
  return `/analysed/compare?runs=${selected.map((id) => encodeURIComponent(id)).join(',')}`;
}

function runMatches(run, query) {
  const text = String(query || '').trim().toLowerCase();
  if (!text) return true;
  return [
    run.agreement_label,
    run.retrieval_url,
    run.run_id,
    run.generation == null ? '' : `generation ${run.generation}`,
    run.provider,
    ...(run.parties || []).map((party) => (typeof party === 'string' ? party : party?.name)),
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text));
}

function PhaseBadge({ run }) {
  const final = run.phase === 'FINAL';
  return (
    <span
      className={`inline-flex items-center rounded-full px-[9px] py-[2px] text-[10px] font-ui font-semibold uppercase tracking-[0.08em] ${final ? 'bg-[#03203D] text-white' : 'border border-[#B9C8DA] bg-white text-[#0B3D71]'}`}
      data-testid="run-phase"
      data-phase={run.phase}
    >
      {final ? 'Final' : 'Draft'}
    </span>
  );
}

export function AnalysedIndexBody({
  runs = null,
  error = null,
  filter = 'all',
  search = '',
  selected = [],
  onFilterChange = () => {},
  onSearchChange = () => {},
  onToggle = () => {},
}) {
  const all = Array.isArray(runs) ? runs : [];
  const counts = useMemo(() => ({
    all: all.length,
    draft: all.filter((run) => run.phase !== 'FINAL').length,
    final: all.filter((run) => run.phase === 'FINAL').length,
  }), [all]);
  const visible = all.filter((run) => (filter === 'draft' ? run.phase !== 'FINAL' : filter === 'final' ? run.phase === 'FINAL' : true))
    .filter((run) => runMatches(run, search));
  const coded = all.reduce((total, run) => total + (Number(run.coded_fact_count) || 0), 0);
  const tables = all.reduce((total, run) => total + (Number(run.table_count) || 0), 0);
  const canCompare = selected.length >= 2;
  const FILTERS = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'draft', label: 'Draft', count: counts.draft },
    { key: 'final', label: 'Final', count: counts.final },
  ];

  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="analysed-page">
      <PwBar active="analysed" />
      <div className="border-t-[10px] border-[#B9C8DA] px-[max(16px,min(6vw,96px))] py-[clamp(28px,4vw,56px)]">
        <Head><title>Analysed agreements · Corpus</title></Head>
        <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Analysed' }]} />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Analysed agreements</p>
            <h1 className="mt-[10px] font-sans font-extrabold leading-[.96] tracking-[-.05em]" style={{ fontSize: 'clamp(32px,4vw,56px)' }}>
              Every run, draft and final
            </h1>
            <p className="mt-[10px] max-w-[70ch] font-body text-[19px] leading-[1.35] text-[#33475E]">
              A draft is the run as it stands, analysis and review together; a final is the agreement as it was released. Pick two or more and compare their coded cells, table by table.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-ui sm:grid-cols-4" aria-label="Analysed counts">
            {[
              ['Agreements', counts.all],
              ['Draft', counts.draft],
              ['Final', counts.final],
              ['Coded cells', coded],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6B7785]">{label}</dt>
                <dd className="m-0 font-sans text-[28px] font-extrabold leading-none tracking-[-.04em] text-[#03203D]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-[26px] flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3E1] pb-[10px]">
          <div className="flex flex-wrap items-center gap-[4px]" role="tablist" aria-label="Filter analysed runs">
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={filter === entry.key}
                onClick={() => onFilterChange(entry.key)}
                className={`rounded-[2px] border px-[11px] py-[6px] text-[12px] font-ui leading-none ${filter === entry.key ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-transparent text-[#33475E] hover:border-[#B9C8DA]'}`}
              >
                {entry.label}
                <span className={`ml-[5px] ${filter === entry.key ? 'text-[#B9C8DA]' : 'text-[#6B7785]'}`}>{entry.count}</span>
              </button>
            ))}
          </div>
          <label className="flex min-w-[240px] flex-1 items-center gap-2 border-b border-[#03203D] pb-[4px] font-ui text-[12px] text-[#6B7785]" htmlFor="analysed-search">
            <span className="sr-only">Search analysed agreements</span>
            <input
              id="analysed-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search agreement, party, URL or run id"
              className="w-full bg-transparent font-body text-[14px] text-[#03203D] outline-none placeholder:text-[#6B7785]"
            />
          </label>
        </div>

        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-ui text-[12px] text-[#6B7785]">
            {visible.length} run{visible.length === 1 ? '' : 's'} · {tables} coded table{tables === 1 ? '' : 's'} · draft runs follow the current review · partly analysed runs are left out of the default comparison
          </p>
          <div className="flex items-center gap-3">
            <span className="font-ui text-[11px] text-[#6B7785]">{selected.length} selected · up to {MAX_COMPARE_RUNS}</span>
            {canCompare ? (
              <Link href={compareHref(selected)} className="inline-flex items-center rounded-[2px] bg-[#03203D] px-[13px] py-[7px] text-[12px] font-ui font-semibold text-white hover:bg-[#0B3D71]" data-testid="compare-selected">
                Compare selected →
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center rounded-[2px] border border-[#DCE3E1] px-[13px] py-[7px] text-[12px] font-ui text-[#6B7785]" title="Pick at least two runs" data-testid="compare-selected-disabled">
                Compare selected
              </span>
            )}
          </div>
        </div>

        {runs === null && !error ? <div className="mt-6"><SkeletonCard /></div> : null}
        {error ? <p className="mt-6 text-sm font-ui text-red-700">The analysed runs could not be read ({error}).</p> : null}
        {runs && all.length === 0 && !error ? (
          <div className="mt-6">
            <EmptyState
              icon="+"
              title="No analysed runs yet"
              description="A run appears here once its analysis has started. A published release appears as Final."
              action={<Link href="/review" className="text-sm font-ui text-accent hover:underline">Open the run list</Link>}
            />
          </div>
        ) : null}

        {all.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left" data-testid="analysed-table">
              <thead>
                <tr className="border-y-2 border-[#03203D]">
                  <th className="w-[34px] px-[8px] py-[9px]" aria-label="Select run" />
                  <th className="px-[8px] py-[9px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Agreement</th>
                  <th className="px-[8px] py-[9px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">State</th>
                  <th className="px-[8px] py-[9px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Analysed</th>
                  <th className="px-[8px] py-[9px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Generation</th>
                  <th className="px-[8px] py-[9px] text-right font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Coded</th>
                  <th className="px-[8px] py-[9px] text-right font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Tables</th>
                  <th className="px-[8px] py-[9px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Read</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((run) => {
                  const checked = selected.includes(run.run_id);
                  const disabled = !checked && selected.length >= MAX_COMPARE_RUNS;
                  return (
                    <tr key={run.run_id} className="border-b border-[#DCE3E1] align-top hover:bg-[#F8FAFC]" data-testid="analysed-run" data-phase={run.phase} data-comparable={run.comparable ? 'true' : 'false'}>
                      <td className="px-[8px] py-[11px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onToggle(run.run_id)}
                          aria-label={`Compare ${run.agreement_label}`}
                          className="h-[14px] w-[14px] accent-[#03203D]"
                        />
                      </td>
                      <td className="px-[8px] py-[11px]">
                        <Link href={openHref(run)} className="font-sans text-[13.5px] font-semibold leading-snug text-[#03203D] underline-offset-2 hover:underline">
                          {run.agreement_label}
                        </Link>
                        {run.released_with_warning ? <span className="ml-2 align-middle text-[11px] text-[#6B4A12]" title={run.release_warning || 'Released with a health warning'}>▲</span> : null}
                        <div className="mt-[2px] truncate font-ui text-[10px] text-[#6B7785]" title={run.retrieval_url || run.run_id}>{run.retrieval_url || run.run_id}</div>
                      </td>
                      <td className="px-[8px] py-[11px]"><PhaseBadge run={run} /><div className="mt-[3px] font-ui text-[10px] text-[#6B7785]">{run.status_label}{run.run_status_label ? ` · ${run.run_status_label}` : ''}</div></td>
                      <td className="whitespace-nowrap px-[8px] py-[11px] font-ui text-[11px] text-[#33475E]">{formatDate(run.released_at || run.created_at)}</td>
                      <td className="px-[8px] py-[11px] font-ui text-[11px] text-[#33475E]">{run.generation == null ? '—' : run.generation}</td>
                      <td className="px-[8px] py-[11px] text-right font-ui text-[11px] tabular-nums text-[#33475E]">{run.coded_fact_count == null ? '—' : run.coded_fact_count}</td>
                      <td className="px-[8px] py-[11px] text-right font-ui text-[11px] tabular-nums text-[#33475E]">{run.table_count == null ? '—' : run.table_count}</td>
                      <td className="whitespace-nowrap px-[8px] py-[11px] font-ui text-[11px]">
                        <Link href={openHref(run)} className="text-[#0B3D71] hover:underline">{run.phase === 'FINAL' ? 'Agreement' : 'Preview'}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 ? <p className="mt-4 font-ui text-[12px] text-[#6B7785]">No runs match this filter and search.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AnalysedPage() {
  const { user } = useUser({ redirectTo: '/login' });
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetch('/api/product/compare/runs', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setRuns(Array.isArray(body.runs) ? body.runs : []); })
      .catch((failure) => { if (!cancelled) { setRuns([]); setError(failure.message); } });
    return () => { cancelled = true; };
  }, [user]);

  const toggle = (runId) => setSelected((current) => {
    if (current.includes(runId)) return current.filter((id) => id !== runId);
    if (current.length >= MAX_COMPARE_RUNS) return current;
    return [...current, runId];
  });

  return (
    <AnalysedIndexBody
      runs={runs}
      error={error}
      filter={filter}
      search={search}
      selected={selected}
      onFilterChange={setFilter}
      onSearchChange={setSearch}
      onToggle={toggle}
    />
  );
}

AnalysedPage.noLayout = true;
