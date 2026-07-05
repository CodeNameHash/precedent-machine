import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '../../lib/useUser';

IngestRunsPage.noLayout = true;

const STATUS_CLASS = {
  pending: 'border-neutral-300 bg-white text-neutral-700',
  queued: 'border-neutral-300 bg-white text-neutral-700',
  running: 'border-blue-200 bg-blue-50 text-blue-800',
  succeeded: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
  cancelled: 'border-neutral-300 bg-neutral-100 text-neutral-600',
};

function fmtDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortId(value) {
  return value ? String(value).slice(0, 18) : '';
}

async function readJson(resp) {
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(text || `HTTP ${resp.status}`);
  }
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

function StatusPill({ status }) {
  const key = status || 'unknown';
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[key] || STATUS_CLASS.pending}`}>
      {key}
    </span>
  );
}

function CountPills({ counts }) {
  const entries = Object.entries(counts || {}).filter(([key, value]) => key !== 'total' && value);
  if (entries.length === 0) return <span className="text-neutral-500">No jobs</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([status, value]) => (
        <span key={status} className={`inline-flex gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[status] || STATUS_CLASS.pending}`}>
          <span>{status}</span>
          <span>{value}</span>
        </span>
      ))}
    </div>
  );
}

export default function IngestRunsPage() {
  useUser({ redirectTo: '/login' });
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const selectedRun = detail?.run || runs.find((run) => run.id === selectedRunId) || null;
  const retryableJobs = useMemo(
    () => (detail?.jobs || []).filter((job) => job.status === 'failed' || job.status === 'needs_review'),
    [detail],
  );

  async function loadRuns() {
    setLoadingRuns(true);
    setMessage(null);
    try {
      const data = await readJson(await fetch('/api/admin/ingest-runs'));
      setRuns(data.runs || []);
      setUnavailable(data.unavailable || null);
      setSelectedRunId((current) => current || data.runs?.[0]?.id || null);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadDetail(runId) {
    if (!runId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setMessage(null);
    try {
      const data = await readJson(await fetch(`/api/admin/ingest-runs?run_id=${encodeURIComponent(runId)}`));
      setDetail(data);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    loadDetail(selectedRunId);
  }, [selectedRunId]);

  async function retryJob(jobId) {
    setRetrying(jobId);
    setMessage(null);
    try {
      await readJson(await fetch('/api/admin/ingest-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', job_id: jobId }),
      }));
      await Promise.all([loadRuns(), loadDetail(selectedRunId)]);
      setMessage({ kind: 'ok', text: 'Job queued for retry' });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setRetrying(null);
    }
  }

  return (
    <>
      <Head><title>Ingest Runs | Precedent Machine</title></Head>
      <main className="min-h-screen bg-neutral-50 text-neutral-950">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin</p>
              <h1 className="text-xl font-semibold">Ingest runs</h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link className="text-neutral-600 hover:text-neutral-950" href="/admin/candidates">Deal candidates</Link>
              <Link className="text-neutral-600 hover:text-neutral-950" href="/ingest">Ingest</Link>
              <button
                type="button"
                onClick={loadRuns}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-100 disabled:opacity-60"
                disabled={loadingRuns}
              >
                {loadingRuns ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(560px,1.3fr)]">
          <div>
            {message ? (
              <p className={message.kind === 'error' ? 'mb-3 text-sm font-medium text-red-700' : 'mb-3 text-sm font-medium text-emerald-700'}>
                {message.text}
              </p>
            ) : null}
            {unavailable ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">{unavailable.message}</div>
                {unavailable.detail ? <div className="mt-1 text-xs">{unavailable.detail}</div> : null}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-500">
                    <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Run</th>
                    <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Status</th>
                    <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Jobs</th>
                    <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className={selectedRunId === run.id ? 'cursor-pointer bg-blue-50 align-top' : 'cursor-pointer align-top hover:bg-neutral-50'}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <td className="border-b border-neutral-200 px-3 py-3">
                        <div className="font-mono text-xs">{shortId(run.id)}</div>
                        <div className="mt-1 text-xs text-neutral-500">{run.backend || 'backend'} {run.model || ''}</div>
                      </td>
                      <td className="border-b border-neutral-200 px-3 py-3"><StatusPill status={run.status} /></td>
                      <td className="border-b border-neutral-200 px-3 py-3"><CountPills counts={run.job_counts} /></td>
                      <td className="border-b border-neutral-200 px-3 py-3 text-xs text-neutral-500">{fmtDate(run.created_at)}</td>
                    </tr>
                  ))}
                  {!loadingRuns && runs.length === 0 ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-neutral-500" colSpan={4}>
                        No ingest runs yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            {selectedRun ? (
              <div className="rounded-md border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Run {shortId(selectedRun.id)}</h2>
                    <div className="mt-1 font-mono text-xs text-neutral-500">{selectedRun.id}</div>
                  </div>
                  <StatusPill status={selectedRun.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-neutral-500">Mode</span><div className="font-medium">{selectedRun.mode || 'Not set'}</div></div>
                  <div><span className="text-neutral-500">Jobs</span><div className="font-medium">{selectedRun.job_counts?.total || 0}</div></div>
                  <div><span className="text-neutral-500">Started</span><div className="font-medium">{fmtDate(selectedRun.started_at)}</div></div>
                  <div><span className="text-neutral-500">Completed</span><div className="font-medium">{fmtDate(selectedRun.completed_at)}</div></div>
                </div>
              </div>
            ) : null}

            {retryableJobs.length > 0 ? (
              <div className="rounded-md border border-neutral-200 bg-white p-4">
                <h2 className="text-base font-semibold">Needs attention</h2>
                <div className="mt-3 space-y-2">
                  {retryableJobs.map((job) => (
                    <div key={job.id} className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{job.kind} {job.family ? `(${job.family})` : ''}</div>
                        <div className="mt-1 break-words font-mono text-xs text-red-700">{job.error_message || job.id}</div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-60"
                        disabled={retrying === job.id}
                        onClick={() => retryJob(job.id)}
                      >
                        {retrying === job.id ? 'Retrying' : 'Retry'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-4 py-3">
                <h2 className="text-base font-semibold">Jobs</h2>
              </div>
              {loadingDetail ? (
                <div className="p-6 text-center text-sm text-neutral-500">Loading jobs.</div>
              ) : (detail?.jobs || []).length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-500">No jobs for this run.</div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-neutral-500">
                      <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Job</th>
                      <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Status</th>
                      <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Attempt</th>
                      <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Lock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail?.jobs || []).map((job) => (
                      <tr key={job.id} className="align-top hover:bg-neutral-50">
                        <td className="border-b border-neutral-200 px-3 py-3">
                          <div className="font-medium">{job.kind} {job.family ? `(${job.family})` : ''}</div>
                          <div className="mt-1 font-mono text-xs text-neutral-500">{shortId(job.id)}</div>
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-3"><StatusPill status={job.status} /></td>
                        <td className="border-b border-neutral-200 px-3 py-3 text-neutral-700">{job.attempts || 0}/{job.max_attempts || 1}</td>
                        <td className="border-b border-neutral-200 px-3 py-3 text-xs text-neutral-500">
                          {job.locked_by ? `${job.locked_by} until ${fmtDate(job.locked_until)}` : 'Unlocked'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 px-4 py-3">
                  <h2 className="text-base font-semibold">Events</h2>
                </div>
                <div className="divide-y divide-neutral-200">
                  {(detail?.events || []).slice(0, 20).map((event) => (
                    <div key={event.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{event.event}</span>
                        <span className="text-xs text-neutral-500">{fmtDate(event.created_at)}</span>
                      </div>
                      {event.message ? <div className="mt-1 text-xs text-neutral-600">{event.message}</div> : null}
                    </div>
                  ))}
                  {(detail?.events || []).length === 0 ? <div className="p-6 text-center text-sm text-neutral-500">No events.</div> : null}
                </div>
              </div>

              <div className="rounded-md border border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 px-4 py-3">
                  <h2 className="text-base font-semibold">Artifacts</h2>
                </div>
                <div className="divide-y divide-neutral-200">
                  {(detail?.artifacts || []).slice(0, 20).map((artifact) => (
                    <div key={artifact.id} className="p-3 text-sm">
                      <div className="font-medium">{artifact.kind}</div>
                      <div className="mt-1 text-xs text-neutral-500">{artifact.label || fmtDate(artifact.created_at)}</div>
                    </div>
                  ))}
                  {(detail?.artifacts || []).length === 0 ? <div className="p-6 text-center text-sm text-neutral-500">No artifacts.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
