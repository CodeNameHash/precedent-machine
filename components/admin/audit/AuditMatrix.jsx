import { useState } from 'react';
import AuditCellDrawer from './AuditCellDrawer';

const COLOURS = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  grey: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export default function AuditMatrix({ matrix }) {
  const [selected, setSelected] = useState(null);
  const rows = matrix?.rows || [];
  const columns = matrix?.columns || [];
  return (
    <div className="w-full">
      <div className="overflow-auto rounded border border-border bg-white" data-testid="audit-matrix">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg">
              <th className="sticky left-0 bg-bg px-3 py-2 text-left font-ui text-xs text-inkLight">Deal</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 text-left font-ui text-xs text-inkLight">{column.label || column.key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.deal_id} className="border-b border-border">
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-ui text-xs text-ink">{row.deal_name}</th>
                {columns.map((column) => {
                  const cell = row.cells?.[column.key] || { status: 'grey', field: column.key };
                  return (
                    <td key={column.key} className="px-3 py-2">
                      <button
                        type="button"
                        className={`min-w-20 rounded border px-2 py-1 text-xs ${COLOURS[cell.status] || COLOURS.grey}`}
                        onClick={() => setSelected({ ...cell, field: column.key, deal: row.deal_name })}
                      >
                        {cell.status || 'grey'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AuditCellDrawer cell={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
