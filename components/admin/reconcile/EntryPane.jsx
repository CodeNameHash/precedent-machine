import CrossDealPreview from './CrossDealPreview';
import SplitFlow from './SplitFlow';

export default function EntryPane({ entry, suggestions = [], selectedCandidate, message, isResolving = false, onSelectCandidate, onResolve }) {
  if (!entry) {
    return <main className="p-6 text-sm text-inkLight">Select a queue entry.</main>;
  }
  return (
    <main className="space-y-4 p-6">
      <div className="inline-flex rounded border border-accent bg-accent px-3 py-1 text-sm font-semibold text-white">
        {entry.raw_value}
      </div>
      {entry.count ? (
        <p className="text-sm text-inkLight">
          {entry.count} unresolved entries across {entry.deal_count} deal{entry.deal_count === 1 ? '' : 's'}.
        </p>
      ) : null}
      <section className="rounded border border-border bg-white p-4">
        <h2 className="font-display text-lg text-ink">Suggested Match</h2>
        <div className="mt-3 space-y-2">
          {suggestions.map((candidate) => (
            <button
              key={candidate.canonicalKey || candidate.key}
              type="button"
              className={`block w-full rounded border px-3 py-2 text-left text-sm ${(selectedCandidate?.canonicalKey || selectedCandidate?.key) === (candidate.canonicalKey || candidate.key) ? 'border-accent bg-accent text-white' : 'border-border'}`}
              onClick={() => onSelectCandidate(candidate)}
            >
              {candidate.canonicalKey || candidate.key} ({candidate.total ?? candidate.score?.total})
            </button>
          ))}
        </div>
        {selectedCandidate ? (
          <p className="mt-3 text-sm text-inkLight">Selected: {selectedCandidate.canonicalKey || selectedCandidate.key}</p>
        ) : (
          <p className="mt-3 text-sm text-inkLight">Select a suggested match before Merge or Promote.</p>
        )}
      </section>
      <CrossDealPreview entry={entry} />
      {message ? (
        <div className={`rounded border px-3 py-2 text-sm ${message.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {message.text}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!selectedCandidate || isResolving} onClick={() => onResolve('MERGE')}>Merge</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!selectedCandidate || isResolving} onClick={() => onResolve('PROMOTE')}>Promote</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={isResolving} onClick={() => onResolve('SPLIT')}>Split</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={isResolving} onClick={() => onResolve('FREEFORM')}>Freeform</button>
      </div>
      <SplitFlow entry={entry} />
    </main>
  );
}
