import { useState } from 'react';
import FlagBadge from './FlagBadge';

const DECISIONS = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'merge', label: 'Merge' },
  { value: 'rename', label: 'Rename' },
  { value: 'defer', label: 'Defer' },
];

function compact(value) {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
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

export default function RegistryCard({ field, decision, onDecision, onPreview }) {
  const [draft, setDraft] = useState(() => ({
    decision: decision?.decision || '',
    merge_into: decision?.merge_into || field.proposed_canonical_key || '',
    rename_to: decision?.rename_to || field.key,
    defer_to_phase: decision?.defer_to_phase || '',
  }));
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  function validationError(nextDecision = draft.decision) {
    if (nextDecision === 'merge' && !draft.merge_into.trim()) return 'Merge target required';
    if (nextDecision === 'rename' && !draft.rename_to.trim()) return 'Rename target required';
    if (nextDecision === 'defer' && !draft.defer_to_phase.trim()) return 'Deferral phase required';
    return null;
  }

  async function save(nextDecision) {
    const invalid = validationError(nextDecision);
    if (invalid) {
      setError(invalid);
      return;
    }
    const payload = {
      key: field.key,
      decision: nextDecision || draft.decision,
      merge_into: draft.merge_into.trim(),
      rename_to: draft.rename_to.trim(),
      defer_to_phase: draft.defer_to_phase.trim(),
    };
    setSaving(true);
    setError(null);
    try {
      await onDecision(payload);
      setDraft((current) => ({ ...current, decision: payload.decision }));
    } catch (err) {
      setError(err.message || 'Decision save failed');
    } finally {
      setSaving(false);
    }
  }

  async function previewField() {
    const result = await onPreview(field.key);
    setPreview(result);
  }

  const pending = !decision?.decision;
  const currentValidation = validationError();

  return (
    <article data-testid="registry-card" className="rounded border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words font-display text-lg text-ink">{field.key}</h2>
            <FlagBadge value={field.review_flag || field.status || 'PENDING_REVIEW'} />
            <FlagBadge value={decisionTone(decision?.decision)} />
          </div>
          <p className="mt-1 text-sm leading-5 text-inkLight">{field.label || field.description || field.main_concept || '-'}</p>
        </div>
        <button
          type="button"
          onClick={previewField}
          className="rounded border border-border px-3 py-1.5 text-xs font-ui text-inkLight hover:border-accent hover:text-ink"
        >
          Preview
        </button>
      </div>

      <dl className="mt-4 grid gap-3 text-xs md:grid-cols-4">
        <div>
          <dt className="font-ui uppercase tracking-wide text-inkFaint">Origin</dt>
          <dd className="mt-1 text-ink">{compact(field.origin)}</dd>
        </div>
        <div>
          <dt className="font-ui uppercase tracking-wide text-inkFaint">Type</dt>
          <dd className="mt-1 text-ink">{compact(field.applies_to || field.provision_type || field.provision_code)}</dd>
        </div>
        <div>
          <dt className="font-ui uppercase tracking-wide text-inkFaint">Data</dt>
          <dd className="mt-1 text-ink">{compact(field.data_type)}</dd>
        </div>
        <div>
          <dt className="font-ui uppercase tracking-wide text-inkFaint">Party</dt>
          <dd className="mt-1 text-ink">{compact(field.party_scope || field.party)}</dd>
        </div>
      </dl>

      {(field.proposed_action || field.merged_from?.length || field.also_matches_provision_codes?.length) && (
        <div className="mt-4 grid gap-3 rounded border border-border bg-bg/40 p-3 text-xs text-inkLight md:grid-cols-3">
          <div>
            <div className="font-ui uppercase tracking-wide text-inkFaint">Proposed</div>
            <div className="mt-1 text-ink">{compact(field.proposed_action)}</div>
          </div>
          <div>
            <div className="font-ui uppercase tracking-wide text-inkFaint">Merged from</div>
            <div className="mt-1 max-h-24 overflow-auto text-ink">{field.merged_from?.map((item) => item.key || item.origin || item).join(', ') || '-'}</div>
          </div>
          <div>
            <div className="font-ui uppercase tracking-wide text-inkFaint">Provision codes</div>
            <div className="mt-1 max-h-24 overflow-auto text-ink">{compact(field.also_matches_provision_codes)}</div>
          </div>
        </div>
      )}

      {preview && (
        <pre className="mt-4 max-h-44 overflow-auto whitespace-pre-wrap rounded border border-border bg-bg/40 p-3 text-xs leading-5 text-ink">
          {preview.available === false ? preview.message || 'not yet extracted' : JSON.stringify(preview, null, 2)}
        </pre>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_1fr_1fr_auto]">
        <label className="text-xs font-ui text-inkLight">
          Decision
          <select
            value={draft.decision}
            onChange={(event) => {
              setError(null);
              setDraft((current) => ({ ...current, decision: event.target.value }));
            }}
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Pending</option>
            {DECISIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-ui text-inkLight">
          Merge into
          <input
            value={draft.merge_into}
            onChange={(event) => setDraft((current) => ({ ...current, merge_into: event.target.value }))}
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="text-xs font-ui text-inkLight">
          Rename to
          <input
            value={draft.rename_to}
            onChange={(event) => setDraft((current) => ({ ...current, rename_to: event.target.value }))}
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="text-xs font-ui text-inkLight">
          Defer to
          <input
            value={draft.defer_to_phase}
            onChange={(event) => setDraft((current) => ({ ...current, defer_to_phase: event.target.value }))}
            placeholder="Phase N"
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <button
          type="button"
          disabled={saving || !draft.decision || Boolean(currentValidation)}
          onClick={() => save()}
          className="self-end rounded bg-accent px-3 py-2 text-xs font-ui text-white hover:bg-accent/90 disabled:opacity-40"
        >
          {saving ? 'Saving' : pending ? 'Save' : 'Update'}
        </button>
      </div>
      {(error || currentValidation) && (
        <div className="mt-3 text-xs font-ui text-seller">{error || currentValidation}</div>
      )}
    </article>
  );
}
