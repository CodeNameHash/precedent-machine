export default function MergeTargetInspector({ candidate }) {
  return (
    <aside className="border-l border-border bg-white p-4">
      <h2 className="font-display text-lg text-ink">Merge Target</h2>
      {candidate ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="font-ui text-inkFaint">Key</dt><dd>{candidate.key}</dd></div>
          <div><dt className="font-ui text-inkFaint">Label</dt><dd>{candidate.label}</dd></div>
          <div><dt className="font-ui text-inkFaint">Score</dt><dd>{candidate.score?.total}</dd></div>
        </dl>
      ) : <p className="mt-3 text-sm text-inkLight">Select a suggestion.</p>}
    </aside>
  );
}
