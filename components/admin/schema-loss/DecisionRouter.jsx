const A_DECISIONS = ['noise', 'promote-attribute', 'promote-canonical', 'promote-rule', 'route-to-learn', 'defer'];
const B_DECISIONS = ['confirm-correct', 'reassign-attribute', 'reassign-party', 'reassign-canonical', 'quarantine', 'extractor-bug'];

export default function DecisionRouter({ dimension, entry, onDecision, status }) {
  const decisions = dimension === 'B' ? B_DECISIONS : A_DECISIONS;
  const disabled = !entry;
  return (
    <section className="rounded border border-border bg-white p-4">
      <h3 className="mb-3 font-ui text-sm text-ink">Decision</h3>
      <div className="flex flex-wrap gap-2">
        {decisions.map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={disabled}
            onClick={() => onDecision(decision)}
            className="rounded border border-border px-3 py-2 text-xs text-inkLight transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {decision}
          </button>
        ))}
      </div>
      {status ? <p className="mt-3 text-sm text-inkLight">{status}</p> : null}
    </section>
  );
}
