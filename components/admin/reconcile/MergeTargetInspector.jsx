function formatRegistryLabel(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text === 'MAE') return 'MAE';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function MergeTargetInspector({ candidate }) {
  const key = candidate?.canonicalKey || candidate?.key;
  const score = candidate?.total ?? candidate?.score?.total;
  return (
    <aside className="border-l border-border bg-white p-4">
      <h2 className="font-display text-lg text-ink">Merge Target</h2>
      {candidate ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="font-ui text-inkFaint">Key</dt><dd>{key}</dd></div>
          <div><dt className="font-ui text-inkFaint">Label</dt><dd>{candidate.label || formatRegistryLabel(key)}</dd></div>
          <div><dt className="font-ui text-inkFaint">Score</dt><dd>{score}</dd></div>
        </dl>
      ) : <p className="mt-3 text-sm text-inkLight">Select a suggestion.</p>}
    </aside>
  );
}
