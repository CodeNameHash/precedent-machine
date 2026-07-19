import CrossDealPreview from './CrossDealPreview';
import SplitFlow from './SplitFlow';

const LABEL_OVERRIDES = {
  MAE: 'MAE',
};

export function formatRegistryLabel(value) {
  const text = String(value || '');
  if (!text) return '';
  if (LABEL_OVERRIDES[text]) return LABEL_OVERRIDES[text];
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function EntryPane({
  entry,
  rawGroups = [],
  selectedRawId,
  suggestions = [],
  selectedCandidate,
  message,
  isResolving = false,
  onSelectRaw,
  onSelectCandidate,
  onResolve,
  rationale = '',
  onRationaleChange,
  decidedByName = '',
  onDecidedByNameChange,
  editorKey = '',
  onEditorKeyChange,
}) {
  if (!entry) {
    return <main className="p-6 text-sm text-inkLight">Select a queue entry.</main>;
  }
  return (
    <main className="space-y-4 p-6">
      {rawGroups.length > 1 ? (
        <section className="rounded border border-border bg-white p-4">
          <h2 className="font-display text-lg text-ink">{entry.field_key}</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {rawGroups.map((rawGroup) => (
              <button
                key={rawGroup.id}
                type="button"
                className={`rounded border px-3 py-2 text-left text-sm ${(selectedRawId || entry.id) === rawGroup.id ? 'border-accent bg-accent text-white' : 'border-border text-ink'}`}
                onClick={() => onSelectRaw(rawGroup.id)}
              >
                <span className="block truncate">{formatRegistryLabel(rawGroup.raw_value)}</span>
                <span className="mt-1 block truncate font-mono text-[11px] opacity-60">{rawGroup.raw_value}</span>
                <span className="mt-1 block text-xs opacity-75">{rawGroup.count} entries across {rawGroup.deal_count} deal{rawGroup.deal_count === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="inline-flex rounded border border-accent bg-accent px-3 py-1 text-sm font-semibold text-white">
        {formatRegistryLabel(entry.raw_value)}
      </div>
      <div className="font-mono text-[11px] text-inkFaint">{entry.raw_value}</div>
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
              <span className="block font-ui">{formatRegistryLabel(candidate.canonicalKey || candidate.key)}</span>
              <span className="mt-1 block font-mono text-[11px] opacity-60">{candidate.canonicalKey || candidate.key} ({candidate.total ?? candidate.score?.total})</span>
            </button>
          ))}
        </div>
        {selectedCandidate ? (
          <p className="mt-3 text-sm text-inkLight">Selected: {formatRegistryLabel(selectedCandidate.canonicalKey || selectedCandidate.key)}</p>
        ) : (
          <p className="mt-3 text-sm text-inkLight">Select a suggested match before Merge or Promote.</p>
        )}
      </section>
      <CrossDealPreview entry={entry} />
      <section className="rounded border border-border bg-white p-4">
        <h2 className="font-display text-lg text-ink">Decision</h2>
        <div className="mt-3">
          <label className="block text-xs font-semibold text-inkLight" htmlFor="reconcile-rationale">Rationale (required)</label>
          <textarea
            id="reconcile-rationale"
            className="mt-1 w-full min-h-[50px] resize-y rounded border border-border px-2 py-1 text-sm"
            value={rationale}
            onChange={(e) => onRationaleChange && onRationaleChange(e.target.value)}
            placeholder="Why is this the right resolution?"
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-inkLight" htmlFor="reconcile-decided-by">Your name</label>
            <input
              id="reconcile-decided-by"
              className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
              value={decidedByName}
              onChange={(e) => onDecidedByNameChange && onDecidedByNameChange(e.target.value)}
              placeholder="used if no editor key is set"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-inkLight" htmlFor="reconcile-editor-key">Editor key</label>
            <input
              id="reconcile-editor-key"
              type="password"
              className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
              value={editorKey}
              onChange={(e) => onEditorKeyChange && onEditorKeyChange(e.target.value)}
              placeholder="approved editors only"
            />
          </div>
        </div>
      </section>
      {message ? (
        <div className={`rounded border px-3 py-2 text-sm ${message.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {message.text}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!selectedCandidate || !rationale.trim() || isResolving} onClick={() => onResolve('MERGE')}>Merge</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!selectedCandidate || !rationale.trim() || isResolving} onClick={() => onResolve('PROMOTE')}>Promote</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!rationale.trim() || isResolving} onClick={() => onResolve('SPLIT')}>Split</button>
        <button type="button" className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50" disabled={!rationale.trim() || isResolving} onClick={() => onResolve('FREEFORM')}>Freeform</button>
      </div>
      <SplitFlow entry={entry} />
    </main>
  );
}
