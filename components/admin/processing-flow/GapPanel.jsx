const STATUS_STYLES = {
  open: 'border-border text-inkLight',
  proposed: 'border-border text-inkLight',
  scheduled: 'border-accent text-accent',
  'in-progress': 'border-accent text-accent',
  partial: 'border-amber-400 text-amber-600',
  done: 'border-emerald-400 text-emerald-600',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'border-border text-inkLight';
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase ${style}`}>
      {status}
    </span>
  );
}

// Collapsed by default per WP-PROCESSING-FLOW-MAP-01 spec (§ 5.3) — a plain
// <details> element renders closed unless `open` is set, so this needs no
// client-side state.
export default function GapPanel({ gaps }) {
  return (
    <details className="rounded border border-border bg-white" data-testid="processing-flow-gap-panel">
      <summary className="cursor-pointer select-none px-4 py-3 font-display text-lg text-ink">
        Gaps and improvements ({(gaps || []).length})
      </summary>
      <div className="overflow-auto border-t border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-bg text-xs uppercase text-inkFaint">
            <tr>
              <th className="p-3">Gap</th>
              <th className="p-3">Issue</th>
              <th className="p-3">Owning WP</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(gaps || []).map((gap) => (
              <tr key={gap.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs text-inkLight">{gap.id}</td>
                <td className="p-3">
                  <b className="text-ink">{gap.title}</b>
                  <p className="mt-1 text-xs leading-5 text-inkLight">{gap.problem}</p>
                </td>
                <td className="p-3 text-inkLight">{gap.owning_wp}</td>
                <td className="p-3"><StatusBadge status={gap.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
