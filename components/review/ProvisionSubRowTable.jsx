export function ProvisionSubRowTable({
  rows = [],
  leftColumnWidthPct = 40,
  headerLeft = 'Term',
  headerRight = 'Provision',
  testId,
}) {
  const leftWidth = Math.min(Math.max(Number(leftColumnWidthPct) || 40, 1), 50);
  const visibleRows = (rows || []).filter((row) => row && row.renderIf !== false);

  const renderRow = (row, isSubrow = false, isLast = false) => (
    <tr
      key={row.id}
      data-testid={row.testId}
      className={`align-top ${row.warning ? 'bg-amber-50' : ''}`}
    >
      <td
        data-testid={isSubrow ? undefined : 'col-term'}
        className={`px-3 py-2 whitespace-normal break-words ${isSubrow ? 'pl-8 text-inkMid provision-subrow-term' : 'text-ink font-medium'}`}
        style={{ width: `${leftWidth}%` }}
      >
        {isSubrow ? (
          <span className="inline-flex items-start gap-1">
            <span aria-hidden="true" className="text-inkFaint">{isLast ? '└' : '├'}</span>
            <span>{row.term}</span>
          </span>
        ) : row.term}
        {row.party ? (
          <span className="ml-1 inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
            {row.party}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-ink">
        {row.provision === null || row.provision === undefined
          ? (row.subrows && row.subrows.length ? null : <span className="italic text-inkFaint">— not addressed —</span>)
          : row.provision}
      </td>
    </tr>
  );

  return (
    <table data-testid={testId} className="min-w-full text-xs font-ui provision-subrow-table">
      <thead className="bg-bg/60 border-b border-border">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap" style={{ width: `${leftWidth}%` }}>
            {headerLeft}
          </th>
          <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">
            {headerRight}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {visibleRows.flatMap((row) => {
          const out = [renderRow(row)];
          const subrows = (row.subrows || []).filter((sub) => sub && sub.renderIf !== false);
          subrows.forEach((sub, idx) => out.push(renderRow(sub, true, idx === subrows.length - 1)));
          return out;
        })}
      </tbody>
    </table>
  );
}
