import fs from 'fs';
import { useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';
import QueueSidebar from '../../../components/admin/reconcile/QueueSidebar';
import EntryPane from '../../../components/admin/reconcile/EntryPane';
import MergeTargetInspector from '../../../components/admin/reconcile/MergeTargetInspector';
import { rankCandidates } from '../../../lib/schema-shape/similarity';

ReconcilePage.noLayout = true;

export default function ReconcilePage({ queue, suggestionsById }) {
  const entries = queue.entries || [];
  const [selectedId, setSelectedId] = useState(entries[0]?.id || null);
  const [candidate, setCandidate] = useState(null);
  const entry = useMemo(() => entries.find((item) => item.id === selectedId) || null, [entries, selectedId]);
  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6"><AdminNav /></div>
      <div className="grid min-h-[calc(100vh-96px)] grid-cols-[260px_minmax(0,1fr)_300px]">
        <QueueSidebar entries={entries} selectedId={selectedId} onSelect={setSelectedId} />
        <EntryPane entry={entry} suggestions={suggestionsById[selectedId] || []} onSelectCandidate={setCandidate} />
        <MergeTargetInspector candidate={candidate} />
      </div>
    </div>
  );
}

export function getStaticProps() {
  const queue = JSON.parse(fs.readFileSync('docs/schema-shape/reconciliation-queue.json', 'utf8'));
  const suggestionsById = Object.fromEntries((queue.entries || []).map((entry) => [
    entry.id,
    rankCandidates(entry.rawValue, { vocab: entry.vocab, shape: entry.field }).slice(0, 3),
  ]));
  return { props: { queue, suggestionsById } };
}
