import CrossDealPreview from './CrossDealPreview';
import SplitFlow from './SplitFlow';

export default function EntryPane({ entry, suggestions = [], onSelectCandidate }) {
  if (!entry) {
    return <main className="p-6 text-sm text-inkLight">Select a queue entry.</main>;
  }
  return (
    <main className="space-y-4 p-6">
      <div className="inline-flex rounded border border-accent bg-accent px-3 py-1 text-sm font-semibold text-white">
        {entry.raw_value}
      </div>
      <section className="rounded border border-border bg-white p-4">
        <h2 className="font-display text-lg text-ink">Suggested Match</h2>
        <div className="mt-3 space-y-2">
          {suggestions.map((candidate) => (
            <button
              key={candidate.canonicalKey || candidate.key}
              type="button"
              className="block w-full rounded border border-border px-3 py-2 text-left text-sm"
              onClick={() => onSelectCandidate(candidate)}
            >
              {candidate.canonicalKey || candidate.key} ({candidate.total ?? candidate.score?.total})
            </button>
          ))}
        </div>
      </section>
      <CrossDealPreview entry={entry} />
      <div className="flex flex-wrap gap-2">
        {['Merge', 'Promote', 'Split', 'Freeform'].map((verb) => (
          <button key={verb} className="rounded border border-border px-3 py-1 text-sm">{verb}</button>
        ))}
      </div>
      <SplitFlow entry={entry} />
    </main>
  );
}
