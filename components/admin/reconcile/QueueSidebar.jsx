export default function QueueSidebar({ entries = [], selectedId, onSelect }) {
  return (
    <aside className="border-r border-border bg-white p-3" data-testid="reconcile-queue">
      <h2 className="font-display text-lg text-ink">Queue</h2>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? <p className="text-sm text-inkLight">No unresolved entries</p> : null}
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`block w-full rounded border px-3 py-2 text-left text-sm ${selectedId === entry.id ? 'border-accent bg-accent text-white' : 'border-border text-ink'}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className="block font-ui text-xs">{entry.field}</span>
            <span>{entry.rawValue}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
