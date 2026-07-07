import { Fragment, useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';

const COLUMNS = [
  { key: 'field_key', label: 'field_key' },
  { key: 'raw_value', label: 'raw_value' },
  { key: 'rationale', label: 'rationale' },
  { key: 'source_deals', label: 'source deals' },
  { key: 'resolved_at', label: 'resolved_at' },
];

DroppedReconciliationPage.noLayout = true;

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function textValue(row, key) {
  const value = row[key];
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
}

function csvEscape(value) {
  const string = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(string)) return `"${string.replace(/"/g, '""')}"`;
  return string;
}

function rowsToCsv(rows) {
  return [
    COLUMNS.map((column) => csvEscape(column.label)).join(','),
    ...rows.map((row) => COLUMNS.map((column) => csvEscape(row[column.key])).join(',')),
  ].join('\n');
}

export default function DroppedReconciliationPage({ rows }) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ key: 'field_key', direction: 'asc' });
  const [expandedId, setExpandedId] = useState(null);

  const visibleRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => COLUMNS.some((column) => textValue(row, column.key).toLowerCase().includes(needle)))
      : rows.slice();
    filtered.sort((a, b) => {
      const left = textValue(a, sort.key);
      const right = textValue(b, sort.key);
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? result : -result;
    });
    return filtered;
  }, [filter, rows, sort]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  return (
    <div className="min-h-screen bg-bg p-6" data-testid="reconciliation-dropped-page">
      <AdminNav className="mb-6" />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Dropped reconciliation</h1>
          <p className="mt-2 text-sm leading-6 text-inkLight">{rows.length} moved or dropped entries.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv('moved-or-dropped-cleanup.csv', rowsToCsv(rows))}
          className="rounded border border-border bg-white px-4 py-2 text-sm text-inkLight hover:border-accent hover:text-ink"
        >
          Download CSV
        </button>
      </header>
      <div className="mb-4 max-w-xl">
        <label className="block text-xs font-ui uppercase tracking-wide text-inkFaint" htmlFor="dropped-filter">
          Filter
        </label>
        <input
          id="dropped-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <div className="overflow-x-auto rounded border border-border bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-bg">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className="border-b border-border px-3 py-2 font-ui text-xs text-inkLight">
                  <button type="button" onClick={() => changeSort(column.key)} className="text-left hover:text-ink">
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                  className="cursor-pointer border-b border-border align-top hover:bg-bg"
                >
                  <td className="px-3 py-2 font-mono text-xs text-ink">{row.field_key}</td>
                  <td className="max-w-[340px] px-3 py-2 text-ink">{row.raw_value}</td>
                  <td className="max-w-[420px] px-3 py-2 text-inkLight">{row.rationale}</td>
                  <td className="px-3 py-2 font-mono text-xs text-inkLight">{row.source_deals.join(', ')}</td>
                  <td className="px-3 py-2 font-mono text-xs text-inkLight">{row.resolved_at}</td>
                </tr>
                {expandedId === row.id ? (
                  <tr className="border-b border-border bg-bg">
                    <td colSpan={COLUMNS.length} className="px-3 py-3">
                      <div className="mb-2 text-xs text-inkLight">
                        Reconciliation queue:{' '}
                        <a
                          className="text-accent underline"
                          href={`/admin/registry/reconcile?entry_id=${encodeURIComponent(row.queue_entry_id || row.id)}&line=${row.queue_line || ''}`}
                        >
                          docs/schema-shape/reconciliation-queue.json:{row.queue_line || 'n/a'}
                        </a>
                      </div>
                      <pre className="max-h-[420px] overflow-auto rounded border border-border bg-white p-3 text-xs leading-5 text-ink">
                        {JSON.stringify(row.queue_entry || row, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const { readDroppedRows } = require('../../../lib/reprocess/reconciliation-surfaces');
  const rows = readDroppedRows();
  return { props: { rows } };
}
