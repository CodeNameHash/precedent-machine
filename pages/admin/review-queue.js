import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminNav from '../../components/admin/AdminNav';
import ReviewQueueEntry from '../../components/admin/ReviewQueueEntry';

ReviewQueuePage.noLayout = true;

async function fetchQueue() {
  const response = await fetch('/api/admin/review-queue');
  if (!response.ok) throw new Error(`Queue request failed: ${response.status}`);
  return response.json();
}

export default function ReviewQueuePage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [resolving, setResolving] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const payload = await fetchQueue();
      setEntries(Array.isArray(payload.entries) ? payload.entries : []);
    } catch (error) {
      setStatus({ type: 'error', message: `Not saved: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const queueCount = useMemo(() => entries.length, [entries]);

  async function resolve(entry, choice) {
    setResolving(`${entry.id}:${choice.key}`);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/review-queue/${encodeURIComponent(entry.id)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice_key: choice.key, resolved_by: 'ben' }),
      });
      if (!response.ok) throw new Error(`Resolve failed: ${response.status}`);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setStatus({ type: 'success', message: `Saved: ${entry.title}.` });
    } catch (error) {
      setStatus({ type: 'error', message: `Not saved: ${error.message}` });
    } finally {
      setResolving('');
    }
  }

  return (
    <>
      <Head>
        <title>Review queue</title>
      </Head>
      <div data-testid="review-queue-page" className="min-h-screen bg-bg p-6">
        <AdminNav className="mb-6" />
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-ink">Review queue</h1>
            <p className="mt-2 text-sm leading-6 text-inkLight">{queueCount} unresolved</p>
          </div>
          <button
            type="button"
            onClick={loadQueue}
            className="rounded border border-border bg-white px-4 py-2 text-sm text-inkLight hover:border-accent hover:text-ink"
          >
            Refresh
          </button>
        </header>

        {status ? (
          <p
            role="status"
            aria-live="polite"
            className={`mb-4 rounded border p-3 text-sm ${
              status.type === 'success'
                ? 'border-buyer/30 bg-buyer/10 text-buyer'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {status.message}
          </p>
        ) : null}

        <main className="space-y-4">
          {loading ? <p className="rounded border border-border bg-white p-4 text-sm text-inkLight">Loading queue...</p> : null}
          {!loading && !entries.length ? (
            <p className="rounded border border-border bg-white p-4 text-sm text-inkLight">No unresolved review entries.</p>
          ) : null}
          {entries.map((entry) => (
            <ReviewQueueEntry
              key={entry.id}
              entry={entry}
              onResolve={resolve}
              resolvingChoice={resolving.startsWith(`${entry.id}:`) ? resolving.split(':')[1] : ''}
            />
          ))}
        </main>
      </div>
    </>
  );
}
