export default function QueueSidebar({ entries = [], selectedId, total = entries.length, entryTotal = entries.length, onSelect }) {
  return (
    <aside className="border-r border-border bg-white p-3" data-testid="reconcile-queue">
      <h2 className="font-display text-lg text-ink">Queue</h2>
      <p className="mt-1 text-xs text-inkLight">{entries.length} of {total} groups, {entryTotal} entries</p>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? <p className="text-sm text-inkLight">No unresolved entries</p> : null}
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`block w-full rounded border px-3 py-2 text-left text-sm ${selectedId === entry.id ? 'border-accent bg-accent text-white' : 'border-border text-ink'}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className="block font-ui text-xs">{entry.field_key}</span>
            <span className="block truncate">{entry.raw_value}</span>
            {entry.count ? <span className="mt-1 block text-xs opacity-75">{entry.count} values across {entry.deal_count} deals</span> : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
