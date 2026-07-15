import { useEffect, useMemo, useState } from 'react';
import AdminNav from '../../components/admin/AdminNav';
import ClusterPane from '../../components/admin/schema-loss/ClusterPane';
import DecisionRouter from '../../components/admin/schema-loss/DecisionRouter';
import FeatureResidualPane from '../../components/admin/schema-loss/FeatureResidualPane';
import IntegrityWarningPane from '../../components/admin/schema-loss/IntegrityWarningPane';
import QueueSidebar from '../../components/admin/schema-loss/QueueSidebar';

SchemaLossPage.noLayout = true;

async function fetchQueue(dimension) {
  const response = await fetch(`/api/admin/schema-loss/queue?dimension=${dimension}`);
  if (!response.ok) throw new Error(`Queue request failed: ${response.status}`);
  return response.json();
}

export default function SchemaLossPage() {
  const [dimension, setDimension] = useState('A');
  const [queue, setQueue] = useState({ entries: [] });
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  // GAP-E residual-capture plumbing (P7): Dimension C ("Feature residuals")
  // is flag-gated (RESIDUAL_CAPTURE_ENABLED) and stays entirely absent from
  // this page -- not just empty, absent -- when the flag is off. This is a
  // one-time probe fetch (independent of the `dimension` toggle state
  // above) purely to learn whether the tab should exist at all.
  const [residualCaptureEnabled, setResidualCaptureEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchQueue('C')
      .then((nextQueue) => {
        if (!cancelled) setResidualCaptureEnabled(Boolean(nextQueue.enabled));
      })
      .catch(() => {
        if (!cancelled) setResidualCaptureEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('');
    fetchQueue(dimension)
      .then((nextQueue) => {
        if (cancelled) return;
        setQueue(nextQueue);
        setSelected((nextQueue.entries || [])[0] || null);
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [dimension]);

  const selectedId = useMemo(() => selected?.id || selected?.claim_hash || null, [selected]);

  async function rerun() {
    setStatus('Re-running audit...');
    const response = await fetch(`/api/admin/schema-loss/rerun?dimension=${dimension}`, { method: 'POST' });
    if (!response.ok) {
      setStatus(`Re-run failed: ${response.status}`);
      return;
    }
    const nextQueue = await fetchQueue(dimension);
    setQueue(nextQueue);
    setSelected((nextQueue.entries || [])[0] || null);
    setStatus('Audit re-run complete.');
  }

  async function decide(decision) {
    if (!selected) return;
    const response = await fetch('/api/admin/schema-loss/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dimension,
        decision_type: decision,
        id: selected.id || selected.claim_hash,
        payload: selected,
      }),
    });
    setStatus(response.ok ? `Recorded ${decision}.` : `Decision failed: ${response.status}`);
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Schema loss audit</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-inkLight">
            Review uncovered text and suspect Claims, then route each item to the correct downstream queue.
          </p>
        </div>
        <button type="button" onClick={rerun} className="rounded border border-border bg-white px-4 py-2 text-sm text-inkLight hover:border-accent hover:text-ink">
          Re-run audit
        </button>
      </header>
      <div className="mb-4 flex gap-2">
        {[
          ['A', 'Uncovered text'],
          ['B', 'Suspect Claims'],
          ...(residualCaptureEnabled ? [['C', 'Feature residuals']] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDimension(value)}
            className={`rounded border px-4 py-2 text-sm ${
              dimension === value ? 'border-accent bg-accent text-white' : 'border-border bg-white text-inkLight hover:border-accent hover:text-ink'
            }`}
          >
            {label} ({queue.dimension === value ? queue.total || 0 : 0})
          </button>
        ))}
      </div>
      {queue.note ? <p className="mb-4 rounded border border-border bg-white p-3 text-sm text-inkLight">{queue.note}</p> : null}
      <main className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <QueueSidebar dimension={dimension} entries={queue.entries || []} selectedId={selectedId} onSelect={setSelected} />
        <div className="space-y-4">
          {dimension === 'C' ? (
            <FeatureResidualPane entry={selected} />
          ) : dimension === 'B' ? (
            <IntegrityWarningPane entry={selected} />
          ) : (
            <ClusterPane entry={selected} />
          )}
          {/* Dimension C is read-only by design (P7 scope line: a read path,
              not a new write requirement) -- no DecisionRouter, no route to
              force a code onto a residual. */}
          {dimension === 'C' ? null : <DecisionRouter dimension={dimension} entry={selected} onDecision={decide} status={status} />}
        </div>
      </main>
    </div>
  );
}
