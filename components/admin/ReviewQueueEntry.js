function formatDate(value) {
  if (!value) return 'Undated';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toISOString().slice(0, 10);
}

function kindLabel(kind) {
  return String(kind || 'review').replace(/-/g, ' ');
}

export default function ReviewQueueEntry({ entry, onResolve, resolvingChoice = '' }) {
  const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
  const choices = Array.isArray(entry?.choices) ? entry.choices : [];

  return (
    <article data-testid="review-queue-entry" className="rounded border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-border bg-bg px-2 py-1 font-ui text-[11px] uppercase text-inkFaint">
              {kindLabel(entry?.kind)}
            </span>
            <span className="font-ui text-xs text-inkFaint">{formatDate(entry?.created_at)}</span>
          </div>
          <h2 className="break-words font-display text-lg text-ink">{entry?.title || 'Untitled review'}</h2>
        </div>
        <span className="max-w-full truncate font-ui text-xs text-inkFaint">{entry?.id}</span>
      </div>

      <p className="mb-4 whitespace-pre-wrap break-words text-sm leading-6 text-inkLight">{entry?.summary}</p>

      {evidence.length ? (
        <div className="mb-4">
          <h3 className="mb-2 font-ui text-xs uppercase text-inkFaint">Evidence</h3>
          <div className="flex flex-wrap gap-2">
            {evidence.map((item, index) => (
              <a
                key={`${item.url}-${index}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-full truncate rounded border border-border bg-bg px-3 py-1.5 text-xs text-inkLight hover:border-accent hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const busy = resolvingChoice === choice.key;
          return (
            <button
              key={choice.key}
              type="button"
              data-testid="review-queue-choice"
              disabled={Boolean(resolvingChoice)}
              onClick={() => onResolve(entry, choice)}
              className={`rounded border px-3 py-2 text-sm ${
                busy
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-white text-inkLight hover:border-accent hover:text-ink disabled:cursor-wait disabled:opacity-60'
              }`}
            >
              {busy ? 'Resolving...' : choice.label}
            </button>
          );
        })}
      </div>
    </article>
  );
}
