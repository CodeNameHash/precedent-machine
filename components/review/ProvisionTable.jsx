import * as ProvisionTablePrimitives from './primitives/ProvisionTablePrimitives';

/*
Config shape:
{
  id: string,
  title: string,
  layoutSlot: string,
  selectRows: (reviewDeal) => rows[],
  columns: [{ id: string, header: string, renderCell: (row, ctx) => ReactNode, width?: string }],
  empty?: { copy: string },
}
*/
export default function ProvisionTable({ config, reviewDeal }) {
  if (!config || typeof config.selectRows !== 'function') return null;
  const rows = config.selectRows(reviewDeal);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const columns = Array.isArray(config.columns) ? config.columns : [];
  const ctx = { reviewDeal, config, primitives: ProvisionTablePrimitives };

  return (
    <section data-testid={`provision-table-${config.id}`} className="rounded border border-border bg-white shadow-sm">
      <div className="border-b border-border bg-bg/60 px-3 py-2">
        <p className="font-ui text-[10px] font-medium uppercase tracking-wider text-inkFaint">
          {config.title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="border-b border-border bg-bg/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint"
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id || row.label} className={row.present ? 'align-top hover:bg-bg/40' : 'align-top bg-bg/30 text-inkFaint'}>
                {columns.map((column) => (
                  <td key={`${row.id || row.label}-${column.id}`} className="px-3 py-2 whitespace-pre-wrap break-words text-ink">
                    {column.renderCell ? column.renderCell(row, ctx) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
