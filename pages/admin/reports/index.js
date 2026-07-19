import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '../../../lib/useUser';
import AdminNav from '../../../components/admin/AdminNav';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import { fmtDate } from '../../../lib/reports/format';
import { REPORT_KINDS, summaryStatus } from '../../../lib/reports/render-helpers';

ReportsIndexPage.noLayout = true;

function StatusBadge({ summary }) {
  const status = summaryStatus(summary);
  return <span className={`mtx-badge rb-status rb-status-${status.tone}`}>{status.label}</span>;
}

function SummaryLine({ summary }) {
  if (!summary || typeof summary !== 'object') return <span className="rb-muted">no summary</span>;
  const entries = Object.entries(summary).filter(([k]) => k !== 'pass');
  if (entries.length === 0) return <span className="rb-muted">no summary</span>;
  return (
    <span className="rb-summary-line">
      {entries.map(([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? 'yes' : 'no') : v}`).join(' · ')}
    </span>
  );
}

export default function ReportsIndexPage() {
  useUser({ redirectTo: '/login' });
  const [latest, setLatest] = useState({});
  const [history, setHistory] = useState([]);
  const [unavailable, setUnavailable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/reports');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setLatest(data.latest || {});
      setHistory(data.history || []);
      setUnavailable(data.unavailable || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <Head><title>Reports | Precedent Machine</title></Head>
      <MergertraceStyles />
      <div className="mtx rb">
        <header className="rb-header">
          <div>
            <p className="mtx-meta-label" style={{ fontSize: 10 }}>Admin</p>
            <h1>Run reports</h1>
            <p className="rb-sub">Persisted producer runs — ingest QA, coverage audit, rematerialize, mint-cards.</p>
          </div>
          <div className="rb-header-actions">
            <AdminNav />
            <button type="button" className="mtx-btn" onClick={load} disabled={loading}>
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        {error ? <div className="rb-alert rb-alert-error">{error}</div> : null}
        {unavailable ? (
          <div className="rb-alert rb-alert-warn">
            <div className="rb-alert-title">{unavailable.message}</div>
            {unavailable.detail ? <div className="rb-alert-detail">{unavailable.detail}</div> : null}
            <div className="rb-alert-detail">Run supabase/schema-06-run-reports.sql, then refresh.</div>
          </div>
        ) : null}

        <section className="rb-cards">
          {REPORT_KINDS.map(({ kind, label, description }) => {
            const row = latest[kind];
            return (
              <Link key={kind} href={`/admin/reports/${kind}`} className="rb-card" data-testid="report-kind-card">
                <div className="rb-card-top">
                  <h2>{label}</h2>
                  {row ? <StatusBadge summary={row.summary} /> : <span className="mtx-badge rb-status-neutral">NO RUNS</span>}
                </div>
                <p className="rb-card-desc">{description}</p>
                <div className="rb-card-meta">
                  <span>{fmtDate(row && row.generated_at)}</span>
                </div>
                {row ? <div className="rb-card-summary"><SummaryLine summary={row.summary} /></div> : null}
              </Link>
            );
          })}
        </section>

        <section className="rb-history">
          <h2>Run history</h2>
          <div className="rb-history-table-wrap">
            <table className="mtx-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Generated</th>
                  <th>Git ref</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/reports/${row.kind}?id=${row.id}`}>{row.kind}</Link>
                    </td>
                    <td className="mtx-mono">{fmtDate(row.generated_at)}</td>
                    <td className="mtx-mono">{row.git_ref ? row.git_ref.slice(0, 10) : '—'}</td>
                    <td><StatusBadge summary={row.summary} /></td>
                    <td><SummaryLine summary={row.summary} /></td>
                  </tr>
                ))}
                {!loading && history.length === 0 && !unavailable ? (
                  <tr><td colSpan={5} className="rb-empty">No reports persisted yet — run a producer with --report-db.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <style jsx>{`
        .rb { min-height: 100vh; padding: 28px; max-width: 1280px; margin: 0 auto; }
        .rb-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
        .rb-header h1 { margin: 4px 0 0; font-size: 20px; font-family: var(--mtx-sans); }
        .rb-sub { margin: 4px 0 0; color: #6B6B6B; font-size: 12px; }
        .rb-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .rb-alert { border: 1px solid #E0E0E0; background: #fff; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; }
        .rb-alert-error { border-left: 3px solid #B14E63; color: #B14E63; }
        .rb-alert-warn { border-left: 3px solid #A87A2E; }
        .rb-alert-title { font-weight: 600; }
        .rb-alert-detail { margin-top: 4px; font-size: 12px; color: #6B6B6B; }
        .rb-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 32px; }
        .rb-card { display: block; border: 1px solid #E0E0E0; background: #fff; padding: 14px; text-decoration: none; color: #1F1F1F; }
        .rb-card:hover { background: #F6F6F6; }
        .rb-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .rb-card-top h2 { margin: 0; font-size: 14px; font-weight: 650; font-family: var(--mtx-sans); }
        .rb-card-desc { margin: 8px 0 0; font-size: 12px; color: #6B6B6B; line-height: 1.4; }
        .rb-card-meta { margin-top: 10px; font-size: 11px; color: #9A9A9A; }
        .rb-card-summary { margin-top: 6px; font-size: 11px; color: #4A4A4A; }
        .rb-status-good { color: #2F6B43; background: rgba(47,107,67,0.08); border-color: rgba(47,107,67,0.25); }
        .rb-status-bad { color: #B14E63; background: rgba(177,78,99,0.08); border-color: rgba(177,78,99,0.25); }
        .rb-status-neutral { color: #4A4A4A; }
        .rb-history h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; font-family: var(--mtx-sans); }
        .rb-history-table-wrap { overflow-x: auto; }
        .rb-empty { text-align: center; color: #6B6B6B; padding: 24px !important; }
        .rb-muted { color: #9A9A9A; }
        .rb-summary-line { color: #4A4A4A; }
      `}</style>
    </>
  );
}
