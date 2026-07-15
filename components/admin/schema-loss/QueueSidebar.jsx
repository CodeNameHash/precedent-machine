export default function QueueSidebar({ dimension, entries = [], selectedId, onSelect }) {
  return (
    <aside className="rounded border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-ui text-sm text-ink">
          {dimension === 'C' ? 'Feature residuals' : dimension === 'B' ? 'Suspect Claims' : 'Uncovered text'}
        </h2>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-inkLight">No queue entries.</p>
        ) : (
          entries.map((entry) => {
            const id = entry.id || entry.claim_hash;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(entry)}
                className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-bg ${
                  selectedId === id ? 'bg-bg text-ink' : 'bg-white text-inkLight'
                }`}
              >
                <span className="block font-ui text-xs uppercase text-inkFaint">{entry.attribute || entry.field_key || entry.suggested_routing || 'Cluster'}</span>
                <span className="mt-1 block truncate">{entry.cluster_signature || entry.verbatim || entry.raw_value || entry.claim_hash}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
