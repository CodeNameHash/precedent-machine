import { useMemo, useState } from 'react';
import AdminNav from '../../../components/admin/AdminNav';
import QueueSidebar from '../../../components/admin/reconcile/QueueSidebar';
import EntryPane from '../../../components/admin/reconcile/EntryPane';
import MergeTargetInspector from '../../../components/admin/reconcile/MergeTargetInspector';

ReconcilePage.noLayout = true;

export default function ReconcilePage({ queue }) {
  const [entries, setEntries] = useState(queue.entries || []);
  const [selectedId, setSelectedId] = useState(entries[0]?.id || null);
  const [selectedRawId, setSelectedRawId] = useState(entries[0]?.raw_groups?.[0]?.id || entries[0]?.id || null);
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const selectedField = useMemo(() => entries.find((item) => item.id === selectedId) || null, [entries, selectedId]);
  const rawGroups = selectedField?.raw_groups || [];
  const entry = useMemo(() => rawGroups.find((item) => item.id === selectedRawId) || rawGroups[0] || selectedField, [rawGroups, selectedRawId, selectedField]);
  function selectField(id) {
    const nextField = entries.find((item) => item.id === id) || null;
    setSelectedId(id);
    setSelectedRawId(nextField?.raw_groups?.[0]?.id || id);
    setCandidate(null);
    setMessage(null);
  }
  function selectRaw(id) {
    setSelectedRawId(id);
    setCandidate(null);
    setMessage(null);
  }
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
      const nextEntries = entries.map((item) => {
        if (!item.raw_groups) return item.id === entry.id ? null : item;
        if (item.id !== selectedField?.id) return item;
        const nextRawGroups = item.raw_groups.filter((rawGroup) => rawGroup.id !== entry.id);
        if (!nextRawGroups.length) return null;
        return {
          ...item,
          raw_groups: nextRawGroups,
          raw_count: nextRawGroups.length,
          count: nextRawGroups.reduce((sum, rawGroup) => sum + (rawGroup.count || 0), 0),
          deal_count: new Set(nextRawGroups.flatMap((rawGroup) => rawGroup.deal_ids || [])).size,
        };
      }).filter(Boolean);
      const nextField = nextEntries.find((item) => item.id === selectedField?.id) || nextEntries[0] || null;
      setEntries(nextEntries);
      setSelectedId(nextField?.id || null);
      setSelectedRawId(nextField?.raw_groups?.[0]?.id || nextField?.id || null);
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
        <QueueSidebar entries={entries} selectedId={selectedId} total={queue.total} entryTotal={queue.entry_total} onSelect={selectField} />
        <EntryPane entry={entry} rawGroups={rawGroups} selectedRawId={selectedRawId} suggestions={entry?.similarity_candidates || []} selectedCandidate={candidate} message={message} isResolving={isResolving} onSelectRaw={selectRaw} onSelectCandidate={setCandidate} onResolve={resolveEntry} />
        <MergeTargetInspector candidate={candidate} />
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const { readQueueSlice } = await import('../../api/admin/reconcile/queue');
  return { props: { queue: readQueueSlice({ limit: 100, group: 'field_key', status: 'NEW' }) } };
}
