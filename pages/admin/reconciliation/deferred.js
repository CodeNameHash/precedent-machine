import { useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';

const COLUMNS = [
  { key: 'raw_value', label: 'raw_value' },
  { key: 'field_key', label: 'field_key' },
  { key: 'source_deals', label: 'source deals' },
  { key: 'resolved_at', label: 'resolved_at' },
];

DeferredReconciliationPage.noLayout = true;

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

function rowsToCsv(groups) {
  const rows = groups.flatMap((group) => group.rows);
  return [
    COLUMNS.map((column) => csvEscape(column.label)).join(','),
    ...rows.map((row) => COLUMNS.map((column) => csvEscape(row[column.key])).join(',')),
  ].join('\n');
}

function StatusBadge({ value }) {
  return (
    <span className="rounded border border-border bg-white px-2 py-1 text-xs font-ui text-inkLight">
      {value || 'Unassigned'}
    </span>
  );
}

export default function DeferredReconciliationPage({ groups }) {
  const [filter, setFilter] = useState('');
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.map((group) => group.waiting_on)));

  const visibleGroups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => COLUMNS.some((column) => textValue(row, column.key).toLowerCase().includes(needle))),
      }))
      .filter((group) => group.rows.length || group.waiting_on.toLowerCase().includes(needle));
  }, [filter, groups]);

  function toggleGroup(waitingOn) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(waitingOn)) next.delete(waitingOn);
      else next.add(waitingOn);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-bg p-6" data-testid="reconciliation-deferred-page">
      <AdminNav className="mb-6" />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Deferred reconciliation</h1>
          <p className="mt-2 text-sm leading-6 text-inkLight">
            {groups.reduce((total, group) => total + group.count, 0)} schema-deferred entries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv('schema-deferred-waitlist.csv', rowsToCsv(groups))}
          className="rounded border border-border bg-white px-4 py-2 text-sm text-inkLight hover:border-accent hover:text-ink"
        >
          Download CSV
        </button>
      </header>
      <div className="mb-4 max-w-xl">
        <label className="block text-xs font-ui uppercase tracking-wide text-inkFaint" htmlFor="deferred-filter">
          Filter
        </label>
        <input
          id="deferred-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <main className="space-y-4">
        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.waiting_on);
          return (
            <section key={group.waiting_on} className="rounded border border-border bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(group.waiting_on)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg"
              >
                <span>
                  <span className="block font-ui text-sm text-ink">{group.waiting_on}</span>
                  <span className="mt-1 block text-xs text-inkLight">
                    {group.rows.length} shown of {group.count} entries, target {group.target_wp || 'unassigned'}
                  </span>
                </span>
                <StatusBadge value={group.drain_status} />
              </button>
              {isOpen ? (
                <div className="overflow-x-auto border-t border-border">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-bg">
                      <tr>
                        {COLUMNS.map((column) => (
                          <th key={column.key} className="border-b border-border px-3 py-2 font-ui text-xs text-inkLight">
                            {column.label}
                          </th>
                        ))}
                        <th className="border-b border-border px-3 py-2 font-ui text-xs text-inkLight">queue line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.queue_entry_id} className="border-b border-border align-top hover:bg-bg">
                          <td className="max-w-[560px] px-3 py-2 text-ink">{row.raw_value}</td>
                          <td className="px-3 py-2 font-mono text-xs text-ink">{row.field_key}</td>
                          <td className="px-3 py-2 font-mono text-xs text-inkLight">{row.source_deals}</td>
                          <td className="px-3 py-2 font-mono text-xs text-inkLight">{row.resolved_at}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            <a
                              className="text-accent underline"
                              href={`/admin/registry/reconcile?entry_id=${encodeURIComponent(row.queue_entry_id || row.id)}&line=${row.queue_line || ''}`}
                            >
                              {row.queue_line || 'n/a'}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}

export async function getStaticProps() {
  const { groupDeferredRows, readDeferredRows } = require('../../../lib/reprocess/reconciliation-surfaces');
  const rows = readDeferredRows().map((row) => ({
    raw_value: row.raw_value,
    field_key: row.field_key,
    source_deals: row.source_deals.join(', '),
    resolved_at: row.resolved_at,
    waiting_on: row.waiting_on,
    target_wp: row.target_wp,
    drain_status: row.drain_status,
    queue_entry_id: row.queue_entry_id,
    queue_line: row.queue_line,
  }));
  const groups = groupDeferredRows(rows);
  return { props: { groups } };
}
