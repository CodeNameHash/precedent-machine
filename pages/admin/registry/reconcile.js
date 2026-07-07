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
  const entry = useMemo(() => entries.find((item) => item.id === selectedId) || null, [entries, selectedId]);
  async function resolveEntry(action) {
    if (!entry) return;
    const targetCanonicalKey = candidate?.canonicalKey || candidate?.key || null;
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
    if (!response.ok) return;
    const nextEntries = entries.filter((item) => item.id !== entry.id);
    setEntries(nextEntries);
    setSelectedId(nextEntries[0]?.id || null);
    setCandidate(null);
  }
  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6"><AdminNav /></div>
      <div className="grid min-h-[calc(100vh-96px)] grid-cols-[260px_minmax(0,1fr)_300px]">
        <QueueSidebar entries={entries} selectedId={selectedId} total={queue.total} entryTotal={queue.entry_total} onSelect={setSelectedId} />
        <EntryPane entry={entry} suggestions={entry?.similarity_candidates || []} selectedCandidate={candidate} onSelectCandidate={setCandidate} onResolve={resolveEntry} />
        <MergeTargetInspector candidate={candidate} />
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const { readQueueSlice } = await import('../../api/admin/reconcile/queue');
  return { props: { queue: readQueueSlice({ limit: 50, group: 'raw_value', status: 'NEW' }) } };
}
