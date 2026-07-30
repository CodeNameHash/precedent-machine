export default function ProcessBrowse({ navigation, selectedPattern, onSelectPattern, disabled = false }) {
  const topics = Array.isArray(navigation?.topics) ? navigation.topics : [];
  return (
    <section className="rounded border border-border bg-white p-4" aria-labelledby="process-browse-heading">
      <h2 id="process-browse-heading" className="text-sm font-medium text-ink">Browse Process research</h2>
      <p className="mt-1 text-xs text-inkLight">Choose a topic, then a pattern. Browse stops at Pattern.</p>
      <div className="mt-3 space-y-4">
        {topics.map((topic) => (
          <section key={topic.key || topic.label} aria-label={topic.label}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-inkLight">{topic.label}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(topic.patterns || []).map((pattern) => {
                const selected = selectedPattern === pattern.key;
                return <button key={pattern.key} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onSelectPattern?.(pattern)} className={`rounded border px-3 py-2 text-sm ${selected ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-bg'}`}>{pattern.label}</button>;
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
