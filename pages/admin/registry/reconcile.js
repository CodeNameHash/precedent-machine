import { useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';
import QueueSidebar from '../../../components/admin/reconcile/QueueSidebar';
import EntryPane from '../../../components/admin/reconcile/EntryPane';
import MergeTargetInspector from '../../../components/admin/reconcile/MergeTargetInspector';

ReconcilePage.noLayout = true;

export default function ReconcilePage({ queue }) {
  const [entries, setEntries] = useState(queue.entries || []);
  const [selectedId, setSelectedId] = useState(entries[0]?.id || null);
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const entry = useMemo(() => entries.find((item) => item.id === selectedId) || null, [entries, selectedId]);
  async function resolveEntry(action) {
    if (!entry) return;
    setIsResolving(true);
    setMessage(null);
    const targetCanonicalKey = candidate?.canonicalKey || candidate?.key || null;
    try {
      const response = await fetch('/api/admin/reconcile/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          field_key: entry.field_key,
          raw_value: entry.raw_value,
          targetCanonicalKey,
          rationale: `Bulk ${action.toLowerCase()} from reconcile UI`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: 'error', text: result.error || 'Reconciliation action failed.' });
        return;
      }
      const nextEntries = entries.filter((item) => item.id !== entry.id);
      setEntries(nextEntries);
      setSelectedId(nextEntries[0]?.id || null);
      setCandidate(null);
      setMessage({ tone: 'success', text: `Resolved ${result.entries?.length || entry.count || 1} queued item${(result.entries?.length || entry.count || 1) === 1 ? '' : 's'}.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error.message || 'Reconciliation action failed.' });
    } finally {
      setIsResolving(false);
    }
  }
  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6"><AdminNav /></div>
      <div className="grid min-h-[calc(100vh-96px)] grid-cols-[260px_minmax(0,1fr)_300px]">
        <QueueSidebar entries={entries} selectedId={selectedId} total={queue.total} entryTotal={queue.entry_total} onSelect={setSelectedId} />
        <EntryPane entry={entry} suggestions={entry?.similarity_candidates || []} selectedCandidate={candidate} message={message} isResolving={isResolving} onSelectCandidate={setCandidate} onResolve={resolveEntry} />
        <MergeTargetInspector candidate={candidate} />
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const { readQueueSlice } = await import('../../api/admin/reconcile/queue');
  return { props: { queue: readQueueSlice({ limit: 50, group: 'raw_value', status: 'NEW' }) } };
}
