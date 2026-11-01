import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../components/UI';
import PwBar from '../../components/chrome/PwBar';
import HowCommon from '../../components/product/HowCommon';
import { UUID } from '../../lib/product/comparison-runs';

// The coded comparison (work package 55, note DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01):
// pick runs, pick tables, read the coded cells side by side. The rows are
// provisions (table_key + row_label); a run that does not answer a row reads
// "Not stated" rather than disappearing. The right-hand column says how many
// of the reference runs give each answer, with the not-stated count kept out
// of the denominator.

const MAX_RUNS = 6;
const MAX_TABLES = 8;

const TONES = {
  neutral: 'bg-[#F1F4F8] text-[#33475E]',
  standard: 'bg-[#EAF0F6] text-[#0B3D71]',
  value: 'bg-[#F1F4F8] text-[#33475E]',
  term: 'bg-[#F1F4F8] text-[#33475E]',
  condition: 'bg-white text-[#03203D] border border-[#B9C8DA]',
  present: 'bg-[#F1F4F8] text-[#03203D]',
  missing: 'bg-white text-[#6B7785] border border-dashed border-[#B9C8DA]',
  warning: 'bg-[#FBF3E2] text-[#6B4A12]',
  info: 'bg-[#EAF0F6] text-[#0B3D71]',
  buyer: 'bg-[#03203D] text-white',
  seller: 'bg-[#EAF0F6] text-[#0B3D71]',
};

function toneClass(tone) {
  return TONES[tone] || TONES.neutral;
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function short(value, length = 110) {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

function cellText(cell) {
  return clean(cell?.summary) || clean(cell?.statement) || clean(cell?.words);
}

function rowDistribution(distribution, rowLabel) {
  if (!distribution) return null;
  const found = (distribution.rows || []).find((row) => row.row_label === rowLabel);
  if (found) return found;
  return {
    row_label: rowLabel,
    answered: 0,
    runs_total: Number(distribution.runs_total) || 0,
    not_stated: Number(distribution.runs_total) || 0,
    entries: [],
  };
}

function queryList(value) {
  const text = Array.isArray(value) ? value.join(',') : String(value || '');
  return [...new Set(text.split(',').map((entry) => entry.trim()).filter(Boolean))];
}

function PhaseMark({ run }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-[6px] py-[1px] text-[8.5px] font-ui font-semibold uppercase tracking-[0.08em] ${run.phase === 'FINAL' ? 'bg-white/20 text-white' : 'bg-[#F1F4F8] text-[#0B3D71]'}`}>
      {run.phase === 'FINAL' ? 'Final' : 'Draft'}
    </span>
  );
}

function RunChip({ run, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(run.run_id)}
      aria-pressed={selected}
      data-testid="run-chip"
      data-run-id={run.run_id}
      data-comparable={run.comparable ? 'true' : 'false'}
      className={`inline-flex max-w-full items-center gap-[6px] rounded-full border px-[11px] py-[5px] text-left font-ui text-[11.5px] transition-colors ${selected ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-[#B9C8DA] bg-white text-[#33475E] hover:border-[#0B3D71]'}`}
      title={`${run.agreement_label} · ${run.phase_label} · ${run.status_label}`}
    >
      <PhaseMark run={run} />
      <span className="min-w-0 truncate">{run.agreement_label}</span>
      {run.released_with_warning ? <span className={selected ? 'text-[#F3D9A4]' : 'text-[#6B4A12]'} title={run.release_warning || 'Released with a health warning'}>▲</span> : null}
    </button>
  );
}

function Cell({ cell }) {
  const text = cellText(cell);
  return (
    <div className="space-y-[3px]" data-testid="compare-cell" data-fact-id={cell.fact_id || undefined} data-run-id={cell.run_id || undefined}>
      {cell.column_header ? <span className="font-ui text-[9px] font-medium uppercase tracking-[0.08em] text-[#6B7785]">{cell.column_header}</span> : null}
      {cell.answer ? <span className={`inline-flex items-center rounded-full px-[9px] py-[2px] text-[11px] font-ui font-semibold ${toneClass(cell.answer.tone)}`}>{cell.answer.text}</span> : null}
      {cell.condition ? <span className={`inline-flex items-center rounded-full px-[8px] py-[1px] text-[10px] font-ui ${toneClass('condition')}`}>{cell.condition.text}</span> : null}
      {cell.extras.slice(0, 2).map((extra, index) => (
        <span key={`${extra.text}-${index}`} className={`ml-[3px] inline-flex items-center rounded-full px-[8px] py-[1px] text-[10px] font-ui ${toneClass(extra.tone)}`}>{extra.text}</span>
      ))}
      {cell.row_detail ? <div className="font-ui text-[9.5px] uppercase tracking-[0.06em] text-[#6B7785]">{cell.row_detail}</div> : null}
      {text ? <p className="m-0 font-body text-[11px] leading-snug text-[#6B7785]" title={clean(cell.statement)}>{short(text)}</p> : null}
    </div>
  );
}

function Cells({ cells = [] }) {
  if (!cells.length) return <span className="font-ui text-[10.5px] text-[#6B7785]">Not stated</span>;
  return (
    <div className="space-y-[7px]">
      {cells.map((cell, index) => <Cell key={`${cell.fact_id || 'cell'}-${index}`} cell={cell} />)}
    </div>
  );
}

function CompareTable({ table, runs, distribution, distributionError }) {
  return (
    <section className="mt-[26px]" data-testid="compare-table" data-table-key={table.table_key}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#03203D] pb-[6px]">
        <div>
          <p className="m-0 font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">{table.section_title || 'Provision table'}</p>
          <h2 className="m-0 font-sans text-[19px] font-extrabold leading-tight tracking-[-.03em] text-[#03203D]">{table.label}</h2>
        </div>
        <p className="m-0 font-ui text-[10px] text-[#6B7785]">{table.row_count} row{table.row_count === 1 ? '' : 's'} · {table.table_key}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#DCE3E1]">
              <th className="w-[210px] px-[8px] py-[8px] font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">Provision</th>
              {runs.map((run) => (
                <th key={run.run_id} className="min-w-[180px] px-[8px] py-[8px] align-bottom">
                  <div className="font-sans text-[12px] font-bold leading-tight tracking-[-.02em] text-[#03203D]">{run.agreement_label}</div>
                  <div className="font-ui text-[9.5px] text-[#6B7785]">{run.phase_label}{run.status_label && run.status_label !== run.phase_label ? ` · ${run.status_label}` : ''}</div>
                  {run.released_with_warning ? <div className="font-ui text-[9px] text-[#6B4A12]" title={run.release_warning || 'Released with a health warning'}>▲ health warning</div> : null}
                </th>
              ))}
              <th className="w-[190px] px-[8px] py-[8px] align-bottom font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">How common</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.table_key}-${row.row_label}`} className="border-b border-[#DCE3E1] align-top" data-testid="compare-row" data-row-label={row.row_label}>
                <th scope="row" className="px-[8px] py-[10px] text-left">
                  <div className="font-ui text-[12px] font-semibold leading-snug text-[#03203D]">{row.row_label}</div>
                  {row.row_details?.length ? <div className="mt-[2px] font-ui text-[9.5px] leading-snug text-[#6B7785]">{row.row_details.slice(0, 3).join(' · ')}</div> : null}
                </th>
                {runs.map((run) => (
                  <td key={run.run_id} className="px-[8px] py-[10px]" data-testid="compare-run-cell" data-run-id={run.run_id}>
                    <Cells cells={row.by_run[run.run_id] || []} />
                  </td>
                ))}
                <td className="px-[8px] py-[10px]" data-testid="compare-how-common">
                  {distributionError
                    ? <span className="font-ui text-[10px] text-[#6B4A12]">How common could not be read.</span>
                    : distribution
                      ? <HowCommon distribution={rowDistribution(distribution, row.row_label)} variant="cell" showTitle={false} />
                      : <span className="font-ui text-[10px] text-[#6B7785]">Reading the reference set…</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AnalysedComparePage() {
  const { user } = useUser({ redirectTo: '/login' });
  const router = useRouter();
  const [runs, setRuns] = useState(null);
  const [runsError, setRunsError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [tablesError, setTablesError] = useState(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState([]);
  const [howCommonByTable, setHowCommonByTable] = useState({});
  const [howCommonErrors, setHowCommonErrors] = useState({});
  const [reference, setReference] = useState('all');
  const selectedInitialised = useRef(false);
  const tablesInitialised = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetch('/api/product/compare/runs', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setRuns(Array.isArray(body.runs) ? body.runs.filter((run) => run.analysed) : []); })
      .catch((failure) => { if (!cancelled) { setRuns([]); setRunsError(failure.message); } });
    return () => { cancelled = true; };
  }, [user]);

  // The page's selection is shareable: ?runs=id,id and ?tables=key,key. The
  // query is read once when the data arrives, then the URL follows the
  // reader's selection.
  useEffect(() => {
    if (!Array.isArray(runs) || selectedInitialised.current) return;
    const available = new Set(runs.map((run) => run.run_id));
    const fromQuery = queryList(router.query.runs).filter((id) => UUID.test(id) && available.has(id));
    // PR 490 review: a PARTIAL/FAILED/RUNNING run is not a default
    // comparison; it is only picked explicitly.
    const preferred = runs.filter((run) => run.comparable);
    const defaults = (preferred.length ? preferred : runs).slice(0, 2).map((run) => run.run_id);
    setSelected(fromQuery.length ? fromQuery.slice(0, MAX_RUNS) : defaults);
    selectedInitialised.current = true;
  }, [runs, router.query.runs]);

  useEffect(() => {
    if (!selectedInitialised.current || !router.isReady) return;
    const next = { ...router.query };
    if (selected.length) next.runs = selected.join(',');
    else delete next.runs;
    router.replace({ pathname: '/analysed/compare', query: next }, undefined, { shallow: true });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedKey = selected.join(',');

  useEffect(() => {
    if (!user || selected.length === 0) {
      setTableData(null);
      setTablesError(null);
      setTablesLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTablesLoading(true);
    setTablesError(null);
    fetch(`/api/product/compare/tables?runs=${selected.map((id) => encodeURIComponent(id)).join(',')}`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        if (cancelled) return;
        setTableData(body);
        setTablesLoading(false);
      })
      .catch((failure) => {
        if (cancelled) return;
        setTableData(null);
        setTablesError(failure.message);
        setTablesLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tableData || !Array.isArray(tableData.tables) || tablesInitialised.current) return;
    const available = new Set(tableData.tables.map((table) => table.table_key));
    const fromQuery = queryList(router.query.tables).filter((key) => available.has(key));
    setSelectedTables(fromQuery.length ? fromQuery.slice(0, MAX_TABLES) : tableData.tables.slice(0, 1).map((table) => table.table_key));
    tablesInitialised.current = true;
  }, [tableData, router.query.tables]);

  // A new run selection can remove every table that was picked.
  useEffect(() => {
    if (!tableData || !Array.isArray(tableData.tables)) return;
    const available = new Set(tableData.tables.map((table) => table.table_key));
    setSelectedTables((current) => {
      const kept = current.filter((key) => available.has(key));
      if (kept.length) return kept;
      return tableData.tables.length ? [tableData.tables[0].table_key] : [];
    });
  }, [tableData]);

  useEffect(() => {
    if (!tablesInitialised.current || !router.isReady) return;
    const next = { ...router.query };
    if (selectedTables.length) next.tables = selectedTables.join(',');
    else delete next.tables;
    router.replace({ pathname: '/analysed/compare', query: next }, undefined, { shallow: true });
  }, [selectedTables]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tableData || selectedTables.length === 0) {
      setHowCommonByTable({});
      setHowCommonErrors({});
      return undefined;
    }
    let cancelled = false;
    setHowCommonByTable({});
    setHowCommonErrors({});
    const runsQuery = reference === 'selected' && selected.length
      ? `&runs=${selected.map((id) => encodeURIComponent(id)).join(',')}`
      : '';
    Promise.all(selectedTables.map((tableKey) => fetch(`/api/product/compare/how-common?table=${encodeURIComponent(tableKey)}${runsQuery}`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => ({ tableKey, body, error: null }))
      .catch((failure) => ({ tableKey, body: null, error: failure.message }))))
      .then((results) => {
        if (cancelled) return;
        const next = {};
        const errors = {};
        for (const result of results) {
          if (result.body) next[result.tableKey] = result.body;
          else errors[result.tableKey] = result.error;
        }
        setHowCommonByTable(next);
        setHowCommonErrors(errors);
      });
    return () => { cancelled = true; };
  }, [tableData, selectedTables.join(','), reference, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tables = useMemo(() => (Array.isArray(tableData?.tables) ? tableData.tables : []), [tableData]);
  const visibleTables = tables.filter((table) => selectedTables.includes(table.table_key));
  const selectedRuns = (runs || []).filter((run) => selected.includes(run.run_id));
  const referenceTotal = Object.values(howCommonByTable).find((entry) => entry && entry.runs_total != null)?.runs_total ?? null;

  const toggleRun = (runId) => setSelected((current) => {
    if (current.includes(runId)) return current.filter((id) => id !== runId);
    if (current.length >= MAX_RUNS) return current;
    return [...current, runId];
  });

  const toggleTable = (tableKey) => setSelectedTables((current) => {
    if (current.includes(tableKey)) return current.filter((key) => key !== tableKey);
    if (current.length >= MAX_TABLES) return current;
    return [...current, tableKey];
  });

  const selectAllTables = () => setSelectedTables(tables.slice(0, MAX_TABLES).map((table) => table.table_key));

  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="analysed-compare-page">
      <PwBar active="analysed" />
      <div className="border-t-[10px] border-[#B9C8DA] px-[max(16px,min(6vw,96px))] py-[clamp(28px,4vw,56px)]">
        <Head><title>Compare analysed agreements · Corpus</title></Head>
        <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Analysed', href: '/analysed' }, { label: 'Compare' }]} />
        <p className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Comparison</p>
        <h1 className="mt-[10px] max-w-[18ch] font-sans font-extrabold leading-[.96] tracking-[-.05em]" style={{ fontSize: 'clamp(32px,4vw,56px)' }}>
          Compare the coded cells
        </h1>
        <p className="mt-[10px] max-w-[76ch] font-body text-[19px] leading-[1.35] text-[#33475E]">
          Pick runs, then pick the provision tables. Every row is a provision; every column is a run; a run that does not state it says so. How common counts the answering runs, never the missing ones.
        </p>
        {selectedRuns.some((run) => run.released_with_warning) ? (
          <p className="mt-2 font-ui text-[11px] text-[#6B4A12]">▲ One of the selected releases carries a health warning. Read it on the <Link href="/analysed" className="underline">analysed index</Link> before citing it.</p>
        ) : null}

        <section className="mt-[26px]" aria-labelledby="pick-runs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#DCE3E1] pb-[6px]">
            <h2 id="pick-runs" className="m-0 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-[#03203D]">1. Pick runs <span className="font-normal text-[#6B7785]">up to {MAX_RUNS}</span></h2>
            <span className="font-ui text-[10.5px] text-[#6B7785]">{selected.length} selected</span>
          </div>
          {runs === null ? <div className="mt-4"><SkeletonCard /></div> : null}
          {runsError ? <p className="mt-3 font-ui text-[12px] text-red-700">The run list could not be read ({runsError}).</p> : null}
          {runs && runs.length === 0 && !runsError ? (
            <div className="mt-4"><EmptyState icon="+" title="No analysed runs" description="Run an agreement first; a draft appears here as soon as its analysis starts." action={<Link href="/review" className="text-sm font-ui text-accent hover:underline">Open the run list</Link>} /></div>
          ) : null}
          {runs && runs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-[6px]" role="group" aria-label="Runs to compare">
              {runs.map((run) => <RunChip key={run.run_id} run={run} selected={selected.includes(run.run_id)} onToggle={toggleRun} />)}
            </div>
          ) : null}
        </section>

        <section className="mt-[24px]" aria-labelledby="pick-tables">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#DCE3E1] pb-[6px]">
            <h2 id="pick-tables" className="m-0 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-[#03203D]">2. Pick tables <span className="font-normal text-[#6B7785]">up to {MAX_TABLES}</span></h2>
            <div className="flex items-center gap-3">
              <span className="font-ui text-[10.5px] text-[#6B7785]">{selectedTables.length} selected</span>
              {tables.length > 1 ? <button type="button" onClick={selectAllTables} className="font-ui text-[10.5px] text-[#0B3D71] hover:underline">Select all</button> : null}
            </div>
          </div>
          {selected.length === 0 ? <p className="mt-3 font-ui text-[12px] text-[#6B7785]">Pick at least one run to see its tables.</p> : null}
          {tablesLoading ? <div className="mt-4"><SkeletonCard /></div> : null}
          {tablesError ? <p className="mt-3 font-ui text-[12px] text-red-700">The tables could not be read ({tablesError}).</p> : null}
          {!tablesLoading && !tablesError && tableData && tables.length === 0 ? <p className="mt-3 font-ui text-[12px] text-[#6B7785]">These runs have no coded table rows.</p> : null}
          {tables.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-[5px]" role="group" aria-label="Provision tables to compare">
              {tables.map((table) => {
                const active = selectedTables.includes(table.table_key);
                return (
                  <button
                    key={table.table_key}
                    type="button"
                    onClick={() => toggleTable(table.table_key)}
                    aria-pressed={active}
                    data-testid="table-chip"
                    data-table-key={table.table_key}
                    className={`inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[5px] font-ui text-[11px] ${active ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-[#B9C8DA] bg-white text-[#33475E] hover:border-[#0B3D71]'}`}
                    title={table.label}
                  >
                    <span className="min-w-0 max-w-[260px] truncate">{table.label}</span>
                    <span className={active ? 'text-[#B9C8DA]' : 'text-[#6B7785]'}>{table.row_count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="mt-[26px]" aria-labelledby="how-common-reference">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#DCE3E1] py-[7px]">
            <div className="flex flex-wrap items-center gap-2">
              <span id="how-common-reference" className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7785]">How common over</span>
              <button type="button" onClick={() => setReference('all')} aria-pressed={reference === 'all'} className={`rounded-full border px-[10px] py-[3px] font-ui text-[10.5px] ${reference === 'all' ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-[#B9C8DA] text-[#33475E]'}`}>All analysed runs</button>
              <button type="button" onClick={() => setReference('selected')} aria-pressed={reference === 'selected'} disabled={selected.length === 0} className={`rounded-full border px-[10px] py-[3px] font-ui text-[10.5px] disabled:opacity-50 ${reference === 'selected' ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-[#B9C8DA] text-[#33475E]'}`}>Selected runs</button>
            </div>
            <span className="font-ui text-[10.5px] text-[#6B7785]">{selectedTables.length === 0 ? 'No table selected' : referenceTotal == null ? 'Reading the reference set…' : `n = ${referenceTotal} run${referenceTotal === 1 ? '' : 's'}`}</span>
          </div>
        </section>

        {selected.length > 0 && !tablesLoading && tableData && visibleTables.length === 0 ? (
          <p className="mt-6 font-ui text-[12px] text-[#6B7785]">Pick at least one table to compare.</p>
        ) : null}

        {visibleTables.map((table) => (
          <CompareTable
            key={table.table_key}
            table={table}
            runs={(tableData.runs || []).filter((run) => selected.includes(run.run_id))}
            distribution={howCommonByTable[table.table_key] || null}
            distributionError={howCommonErrors[table.table_key] || null}
          />
        ))}

        {visibleTables.length > 0 ? (
          <p className="mt-5 max-w-[90ch] font-body text-[11px] leading-relaxed text-[#6B7785]">
            Every cell is the coded answer the deal page shows. A draft follows the current review; a final is read as released. “Not stated” is not a “No”: the how-common denominator counts only the runs that answer the row, and the not-stated count is shown beside it. Rows are table_key + row_label, so a fact inside a sub-item stays on its row.
          </p>
        ) : null}
      </div>
    </div>
  );
}

AnalysedComparePage.noLayout = true;
