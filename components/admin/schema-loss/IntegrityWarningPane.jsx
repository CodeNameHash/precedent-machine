import ProvisionViewer from './ProvisionViewer';

export default function IntegrityWarningPane({ entry }) {
  if (!entry) return <div className="rounded border border-border bg-white p-6 text-sm text-inkLight">Select a suspect Claim.</div>;
  return (
    <div className="space-y-4">
      <section className="rounded border border-border bg-white p-4">
        <h2 className="font-display text-lg text-ink">{entry.field_key}</h2>
        <div className="mt-2 grid gap-2 text-sm text-inkLight sm:grid-cols-2">
          <div><span className="font-ui text-ink">Canonical:</span> {entry.canonicalKey || 'n/a'}</div>
          <div><span className="font-ui text-ink">Verbatim:</span> {entry.raw_value || 'n/a'}</div>
          <div><span className="font-ui text-ink">Checks:</span> {(entry.checks_failed || []).join(', ')}</div>
          <div><span className="font-ui text-ink">Status:</span> {entry.reviewer_status}</div>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto rounded bg-bg p-3 text-xs text-inkLight">
          {JSON.stringify(entry.check_details || {}, null, 2)}
        </pre>
      </section>
      <ProvisionViewer entry={entry} />
    </div>
  );
}
