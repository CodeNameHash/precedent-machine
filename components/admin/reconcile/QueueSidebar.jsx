export default function QueueSidebar({ entries = [], selectedId, total = entries.length, entryTotal = entries.length, onSelect }) {
  return (
    <aside className="border-r border-border bg-white p-3" data-testid="reconcile-queue">
      <h2 className="font-display text-lg text-ink">Fields</h2>
      <p className="mt-1 text-xs text-inkLight">{entries.length} of {total} fields, {entryTotal} entries</p>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? <p className="text-sm text-inkLight">No unresolved entries</p> : null}
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`block w-full rounded border px-3 py-2 text-left text-sm ${selectedId === entry.id ? 'border-accent bg-accent text-white' : 'border-border text-ink'}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className="block truncate font-ui text-xs">{entry.field_key}</span>
            {entry.raw_count ? <span className="block truncate">{entry.raw_count} unresolved value{entry.raw_count === 1 ? '' : 's'}</span> : <span className="block truncate">{entry.raw_value}</span>}
            {entry.count ? <span className="mt-1 block text-xs opacity-75">{entry.count} entries across {entry.deal_count} deals</span> : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
