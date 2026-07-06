import { useMemo, useState } from 'react';
import FlagBadge from './FlagBadge';

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

function shortLabel(field) {
  return field.label || field.description || field.main_concept || '-';
}

function scrollNearViewportEdge(event) {
  const edge = 96;
  const step = 22;
  if (event.clientY < edge) window.scrollBy({ top: -step, behavior: 'auto' });
  if (window.innerHeight - event.clientY < edge) window.scrollBy({ top: step, behavior: 'auto' });
}

function buildRows(fields, decisions) {
  const childrenByTarget = new Map();
  for (const field of fields) {
    const target = decisions[field.key]?.decision === 'merge' ? decisions[field.key].merge_into : null;
    if (!target) continue;
    if (!childrenByTarget.has(target)) childrenByTarget.set(target, []);
    childrenByTarget.get(target).push(field);
  }

  const childKeys = new Set();
  for (const children of childrenByTarget.values()) {
    for (const child of children) childKeys.add(child.key);
  }

  const rows = [];
  for (const field of fields) {
    if (childKeys.has(field.key)) continue;
    rows.push({ field, depth: 0 });
    for (const child of childrenByTarget.get(field.key) || []) {
      rows.push({ field: child, depth: 1, parentKey: field.key });
    }
  }

  for (const [target, children] of childrenByTarget.entries()) {
    if (fields.some((field) => field.key === target)) continue;
    rows.push({ field: { key: target, label: 'External merge target' }, depth: 0, virtual: true });
    for (const child of children) rows.push({ field: child, depth: 1, parentKey: target });
  }

  return rows;
}

export default function RegistryMergeBoard({ fields, decisions, onDecision }) {
  const [draggedKey, setDraggedKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const rows = useMemo(() => buildRows(fields, decisions), [fields, decisions]);

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
      <div className="overflow-hidden rounded border border-border bg-white">
        <div className="grid grid-cols-[minmax(220px,1.1fr)_minmax(260px,1.5fr)_120px_180px_96px] border-b border-border bg-bg/60 px-3 py-2 text-[10px] font-ui uppercase tracking-wide text-inkFaint">
          <div>Key</div>
          <div>Label</div>
          <div>Status</div>
          <div>Merge target</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map(({ field, depth, parentKey, virtual }) => {
            const decision = decisions[field.key]?.decision;
            const mergeInto = decisions[field.key]?.merge_into || suggestedTarget(field) || '';
            const saving = savingKey === field.key;
            const dragging = draggedKey === field.key;
            return (
              <div
                key={`${parentKey || 'root'}:${field.key}`}
                draggable={!virtual}
                onDragStart={(event) => {
                  if (virtual) return;
                  setDraggedKey(field.key);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', field.key);
                }}
                onDragEnd={() => setDraggedKey(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  scrollNearViewportEdge(event);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropOn(field.key);
                }}
                className={`grid min-h-[38px] grid-cols-[minmax(220px,1.1fr)_minmax(260px,1.5fr)_120px_180px_96px] items-center gap-3 px-3 py-1.5 text-xs transition-colors ${
                  dragging ? 'bg-accent/10 opacity-70' : depth ? 'bg-bg/30' : 'bg-white hover:bg-bg/40'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-inkFaint">{depth ? '->' : '::'}</span>
                  <span className={`truncate font-ui font-semibold ${virtual ? 'text-inkFaint' : 'text-ink'}`}>{field.key}</span>
                </div>
                <div className="truncate text-inkLight" title={shortLabel(field)}>{shortLabel(field)}</div>
                <div className="flex items-center gap-1">
                  <FlagBadge value={decisionTone(decision)} />
                </div>
                <div className="truncate text-inkFaint" title={mergeInto}>
                  {decision === 'merge' ? mergeInto : mergeInto ? `suggested: ${mergeInto}` : '-'}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="Approve"
                    disabled={saving || virtual}
                    onClick={() => save({ key: field.key, decision: 'approve', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                    className="h-7 w-7 rounded border border-border text-xs font-ui text-buyer hover:border-buyer disabled:opacity-40"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    title="Reject"
                    disabled={saving || virtual}
                    onClick={() => save({ key: field.key, decision: 'reject', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                    className="h-7 w-7 rounded border border-border text-xs font-ui text-seller hover:border-seller disabled:opacity-40"
                  >
                    R
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
