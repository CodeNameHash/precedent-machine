export default function AuditCellDrawer({ cell, onClose }) {
  if (!cell) return null;
  return (
    <aside className="border-l border-border bg-white p-4" data-testid="audit-cell-drawer">
      <button type="button" className="mb-3 text-xs text-inkLight" onClick={onClose}>Close</button>
      <h2 className="font-display text-lg text-ink">{cell.field}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="font-ui text-inkFaint">Deal</dt><dd>{cell.deal || 'Corpus baseline'}</dd></div>
        <div><dt className="font-ui text-inkFaint">Canonical key</dt><dd>{cell.canonicalKey || 'Not set'}</dd></div>
        <div><dt className="font-ui text-inkFaint">Raw value</dt><dd>{cell.extractorRawValue || 'Not recovered'}</dd></div>
        <div><dt className="font-ui text-inkFaint">Source provision</dt><dd>{cell.sourceProvisionId || 'Not linked'}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded border border-border px-3 py-1 text-xs">Approve gap</button>
        <button className="rounded border border-border px-3 py-1 text-xs">Mark for Phase 1 re-extraction</button>
        <button className="rounded border border-border px-3 py-1 text-xs">Fix inline</button>
        <button className="rounded border border-border px-3 py-1 text-xs">Open source</button>
      </div>
    </aside>
  );
}
