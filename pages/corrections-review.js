// Weekly review queue for corrections submitted through the Correct tab
// (components/review-v2/ClauseSidebar.jsx) by non-approved editors, plus
// any approved-editor proposal that couldn't be auto-applied (free-text
// 'other', or no resolvable provision_id — see lib/corrections/submit.js).
// Spec: docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md's "Review queue"
// section. Edit-gated per the spec, same UX-only convention as the rest of
// isEdit (components/ViewModeContext.js) — Approve/Reject are enforced
// server-side by requiring a valid EDITOR_KEYS key, not by this gate.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../lib/useUser';
import { useViewMode } from '../components/ViewModeContext';
import { Breadcrumbs, SkeletonCard, ErrorState } from '../components/UI';

const EDITOR_KEY_STORAGE = 'mtx_editor_key';
const CORRECTIONS_QUEUE_CONTAINED = true;

function ageDays(createdAt) {
  if (!createdAt) return null;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function targetSummary(row) {
  const ctx = row.context && typeof row.context === 'object' ? row.context : {};
  const target = ctx.target || {};
  const kind = target.kind || row.correction_type || 'unknown';
  const attr = target.claim_attribute ? ` · ${target.claim_attribute}` : '';
  return `${kind}${attr}`;
}

function proposedSummary(row) {
  const ctx = row.context && typeof row.context === 'object' ? row.context : {};
  if (ctx.proposed !== undefined) return String(ctx.proposed);
  return '';
}

export default function CorrectionsReviewPage() {
  useUser({ redirectTo: '/login' });
  const { isEdit } = useViewMode();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorKey, setEditorKey] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(EDITOR_KEY_STORAGE);
      if (stored) setEditorKey(stored);
    } catch {
      // ignore — localStorage unavailable
    }
  }, []);

  const load = useCallback(() => {
    if (CORRECTIONS_QUEUE_CONTAINED) {
      setRows([]);
      setLoading(false);
      setError(new Error('The broad corrections queue is temporarily unavailable while its bounded serving projection is rebuilt.'));
      return;
    }
    setLoading(true);
    setError(null);
    fetch('/api/corrections?status=pending&order=asc&limit=500')
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data.corrections) ? data.corrections : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (id, action) => {
    let note;
    if (action === 'reject') {
      note = window.prompt('Rejection note (required):');
      if (!note || !note.trim()) return;
    }
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch('/api/corrections/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-editor-key': editorKey },
        body: JSON.stringify({ id, action, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.error || `${action} failed` });
      } else {
        setMessage({ tone: 'ok', text: action === 'approve' ? 'Applied.' : 'Rejected.' });
        setRows((cur) => cur.filter((r) => r.id !== id));
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e.message });
    } finally {
      setBusyId(null);
    }
  }, [editorKey]);

  const oldest = rows.length ? Math.max(...rows.map((r) => ageDays(r.created_at) || 0)) : 0;

  if (!isEdit) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Corrections review' }]} />
        <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
          Editors only — switch to edit mode to review the pending corrections queue.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Corrections review' }]} />

      <div>
        <h1 className="font-display text-2xl text-ink">Corrections review</h1>
        <p className="mt-1 text-sm font-ui text-inkLight">
          {rows.length} pending{rows.length ? ` · oldest ${oldest} day${oldest === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-ui text-inkLight" htmlFor="editor-key-input">Editor key</label>
        <input
          id="editor-key-input"
          type="password"
          value={editorKey}
          onChange={(e) => {
            const v = e.target.value;
            setEditorKey(v);
            try { window.localStorage.setItem(EDITOR_KEY_STORAGE, v); } catch { /* ignore */ }
          }}
          placeholder="required to Approve/Reject"
          className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
        />
      </div>

      {message ? (
        <div className={`text-sm font-ui ${message.tone === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</div>
      ) : null}

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorState message={error.message} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
          Nothing pending.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-sm divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/review/${row.deal_id}`} className="text-sm font-ui font-medium text-ink hover:underline">
                  Deal {String(row.deal_id || '').slice(0, 8)}
                </Link>
                <span className="text-xs font-mono text-inkFaint">
                  {targetSummary(row)} · {ageDays(row.created_at)} day{ageDays(row.created_at) === 1 ? '' : 's'} old
                </span>
              </div>
              <div className="text-sm font-ui text-ink">
                <span className="text-inkFaint">Proposed: </span>{proposedSummary(row)}
              </div>
              <div className="text-sm font-ui text-inkLight">
                <span className="text-inkFaint">Rationale: </span>{row.reason || '—'}
              </div>
              <div className="text-xs font-mono text-inkFaint">
                Submitted by {row.submitted_by || 'anonymous'} · card {String(row.card_id || row.provision_id || '').slice(0, 8) || '—'}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyId === row.id || !editorKey}
                  onClick={() => act(row.id, 'approve')}
                  className="px-3 py-1.5 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id || !editorKey}
                  onClick={() => act(row.id, 'reject')}
                  className="px-3 py-1.5 text-xs font-ui border border-border rounded hover:border-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
