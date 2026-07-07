import { useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';
import QueueSidebar from '../../../components/admin/reconcile/QueueSidebar';
import EntryPane from '../../../components/admin/reconcile/EntryPane';
import MergeTargetInspector from '../../../components/admin/reconcile/MergeTargetInspector';

ReconcilePage.noLayout = true;

export default function ReconcilePage({ queue }) {
  const entries = queue.entries || [];
  const [selectedId, setSelectedId] = useState(entries[0]?.id || null);
  const [candidate, setCandidate] = useState(null);
  const entry = useMemo(() => entries.find((item) => item.id === selectedId) || null, [entries, selectedId]);
  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6"><AdminNav /></div>
      <div className="grid min-h-[calc(100vh-96px)] grid-cols-[260px_minmax(0,1fr)_300px]">
        <QueueSidebar entries={entries} selectedId={selectedId} total={queue.total} onSelect={setSelectedId} />
        <EntryPane entry={entry} suggestions={entry?.similarity_candidates || []} onSelectCandidate={setCandidate} />
        <MergeTargetInspector candidate={candidate} />
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const { readQueueSlice } = await import('../../api/admin/reconcile/queue');
  return { props: { queue: readQueueSlice({ limit: 100 }) } };
}
