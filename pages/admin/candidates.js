import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '../../lib/useUser';
import AdminNav from '../../components/admin/AdminNav';

CandidatesPage.noLayout = true;

const STATUSES = ['all', 'pending', 'queued', 'ingested', 'needs_review', 'skipped', 'error'];
const CANDIDATE_ADMIN_CONTAINED = true;

function money(value) {
  if (!value) return 'Not parsed';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(value) {
  if (!value) return 'Not parsed';
  return value;
}

function shortHash(value) {
  return value ? value.slice(0, 12) : '';
}

export default function CandidatesPage() {
  useUser({ redirectTo: '/login' });
  const [status, setStatus] = useState('pending');
  const [limit, setLimit] = useState(100);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('status', status);
    params.set('limit', String(limit));
    return params.toString();
  }, [status, limit]);

  async function load() {
    if (CANDIDATE_ADMIN_CONTAINED) {
      setRows([]);
      setStats({});
      setMessage({ kind: 'error', text: 'Candidate administration is temporarily read-only while authenticated corpus writes are being rebuilt.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/admin/candidates?${query}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load candidates');
      setRows(data.candidates || []);
      setStats(data.stats || {});
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  async function updateCandidate(id, updates) {
    setMessage(null);
    try {
      const resp = await fetch('/api/admin/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to update candidate');
      setRows((prev) => prev.map((row) => (row.id === id ? data.candidate : row)));
      setMessage({ kind: 'ok', text: 'Candidate updated' });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
  }

  return (
    <>
      <Head><title>Deal Candidates | Precedent Machine</title></Head>
      <main className="min-h-screen bg-neutral-50 text-neutral-950">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin</p>
              <h1 className="text-xl font-semibold">Deal candidates</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
              <AdminNav className="justify-end" />
              <button
                type="button"
                onClick={load}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-100 disabled:opacity-60"
                disabled={CANDIDATE_ADMIN_CONTAINED || loading}
              >
                {loading ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium text-neutral-600">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'All' : `${s} (${stats[s] || 0})`}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium text-neutral-600">Limit</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2"
              >
                {[50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {message ? (
              <p className={message.kind === 'error' ? 'text-sm font-medium text-red-700' : 'text-sm font-medium text-emerald-700'}>
                {message.text}
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-neutral-500">
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Filed</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Filed by</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Parties</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Value</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Filing</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Status</th>
                  <th className="border-b border-neutral-200 px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-white">
                    <td className="border-b border-neutral-200 px-3 py-3 whitespace-nowrap">{fmtDate(row.filing_date)}</td>
                    <td className="border-b border-neutral-200 px-3 py-3 min-w-52">
                      <div className="font-medium">{row.filed_by_party || row.cik}</div>
                      <div className="mt-1 text-xs text-neutral-500">Discovered {fmtDate(row.discovered_at?.slice(0, 10))}</div>
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-3 min-w-64">
                      <div>{row.acquirer_name || 'Buyer not parsed'}</div>
                      <div className="text-neutral-500">to acquire {row.target_name || 'target not parsed'}</div>
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-3 whitespace-nowrap">{money(row.deal_value_usd)}</td>
                    <td className="border-b border-neutral-200 px-3 py-3 min-w-72">
                      <div className="font-mono text-xs">{row.filing_accession}</div>
                      <div className="mt-1 font-mono text-xs text-neutral-500">{shortHash(row.agreement_text_hash)}</div>
                      <a
                        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:text-blue-900"
                        href={row.agreement_exhibit_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open exhibit
                      </a>
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-3">
                      <span className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold">
                        {row.status}
                      </span>
                      {row.skip_reason ? <div className="mt-2 text-xs text-neutral-500">{row.skip_reason}</div> : null}
                      {row.review_notes ? <div className="mt-2 text-xs text-amber-700">{row.review_notes}</div> : null}
                      {row.last_error ? <div className="mt-2 text-xs text-red-700">{row.last_error}</div> : null}
                      {row.ingested_deal_id ? (
                        <Link
                          className="mt-2 inline-block text-xs font-medium text-blue-700 hover:text-blue-900"
                          href={`/review/${row.ingested_deal_id}`}
                        >
                          Open deal
                        </Link>
                      ) : null}
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium hover:bg-neutral-100"
                          onClick={() => updateCandidate(row.id, { status: 'queued', skip_reason: null })}
                          disabled={CANDIDATE_ADMIN_CONTAINED}
                        >
                          Queue
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium hover:bg-neutral-100"
                          onClick={() => updateCandidate(row.id, { status: 'skipped', skip_reason: 'Skipped after admin review' })}
                          disabled={CANDIDATE_ADMIN_CONTAINED}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium hover:bg-neutral-100"
                          onClick={() => updateCandidate(row.id, { status: 'pending', skip_reason: null })}
                          disabled={CANDIDATE_ADMIN_CONTAINED}
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-10 text-center text-neutral-500" colSpan={7}>
                      No candidates in this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
