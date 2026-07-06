import { useState } from 'react';
import FlagBadge from './FlagBadge';

function compact(value) {
  if (value == null || value === '') return '-';
  return String(value);
}

function decisionTone(decision) {
  if (!decision) return 'PENDING_REVIEW';
  if (decision === 'approve') return 'APPROVED';
  if (decision === 'reject') return 'REJECTED';
  if (decision === 'merge') return 'MERGED';
  if (decision === 'rename') return 'RENAMED';
  if (decision === 'defer') return 'DEFERRED';
  return 'PENDING_REVIEW';
}

function suggestedTarget(field) {
  if (field.proposed_canonical_key) return field.proposed_canonical_key;
  const match = String(field.proposed_action || '').match(/^merge into (.+)$/);
  return match ? match[1] : null;
}

export default function RegistryMergeBoard({ fields, decisions, onDecision }) {
  const [draggedKey, setDraggedKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const byKey = new Map(fields.map((field) => [field.key, field]));

  async function save(payload) {
    setSavingKey(payload.key);
    setError(null);
    try {
      await onDecision(payload);
    } catch (err) {
      setError(err.message || 'Decision save failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function dropOn(targetKey) {
    const sourceKey = draggedKey;
    setDraggedKey(null);
    if (!sourceKey || sourceKey === targetKey) return;
    const source = byKey.get(sourceKey);
    if (!source) return;
    await save({
      key: source.key,
      decision: 'merge',
      merge_into: targetKey,
      rename_to: source.key,
      defer_to_phase: '',
    });
  }

  return (
    <div data-testid="registry-merge-board">
      {error && <div className="mb-3 text-xs font-ui text-seller">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {fields.map((field) => {
          const decision = decisions[field.key]?.decision;
          const target = suggestedTarget(field);
          const isDragging = draggedKey === field.key;
          return (
            <article
              key={field.key}
              draggable
              onDragStart={(event) => {
                setDraggedKey(field.key);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', field.key);
              }}
              onDragEnd={() => setDraggedKey(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(field.key);
              }}
              className={`min-h-[168px] rounded border bg-white p-3 shadow-sm transition-colors ${
                isDragging ? 'border-accent opacity-60' : 'border-border hover:border-accent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 break-words font-ui text-sm font-semibold leading-5 text-ink">{field.key}</h2>
                <FlagBadge value={decisionTone(decision)} />
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-inkLight">{compact(field.label || field.description || field.main_concept)}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {field.review_flag && <FlagBadge value={field.review_flag} />}
                {target && <span className="rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-ui text-accent">{target}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={savingKey === field.key}
                  onClick={() => save({ key: field.key, decision: 'approve', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                  className="rounded border border-border px-2 py-1.5 text-xs font-ui text-inkLight hover:border-buyer hover:text-buyer disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={savingKey === field.key}
                  onClick={() => save({ key: field.key, decision: 'reject', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                  className="rounded border border-border px-2 py-1.5 text-xs font-ui text-inkLight hover:border-seller hover:text-seller disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
              {decisions[field.key]?.merge_into && (
                <div className="mt-2 truncate text-[11px] font-ui text-inkFaint">merged into {decisions[field.key].merge_into}</div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
