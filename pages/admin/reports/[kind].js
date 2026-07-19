import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../../lib/useUser';
import AdminNav from '../../../components/admin/AdminNav';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import { fmtDate } from '../../../lib/reports/format';
import {
  buildIngestQaRows,
  buildCoverageAuditView,
  buildMaterializeView,
  buildDemoDryrunSteps,
} from '../../../lib/reports/render-helpers';

ReportKindPage.noLayout = true;

// Pure data-shaping helpers (buildIngestQaRows, buildCoverageAuditView,
// buildMaterializeView, buildDemoDryrunSteps) live in
// lib/reports/render-helpers.js — not here — because this file is JSX and
// this repo's `node --test` runner can't require() JSX. See
// tests/admin/reports-kind-renderers.spec.js for their fixture tests.

/* ── presentational pieces ──────────────────────────────────────────────── */

function Pill({ ok, label }) {
  return <span className={`mtx-badge rk-pill ${ok ? 'rk-pill-good' : 'rk-pill-bad'}`}>{label || (ok ? 'PASS' : 'FAIL')}</span>;
}

function CheckList({ checks }) {
  if (!checks || checks.length === 0) return <span className="rk-muted">—</span>;
  return (
    <div className="rk-checks">
      {checks.map((c, i) => (
        <span key={`${c.label}-${i}`} className={`mtx-badge rk-pill ${c.pass ? 'rk-pill-good' : 'rk-pill-bad'}`} title={`${c.value} ${c.op || ''} ${c.threshold}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function IngestQaRenderer({ payload }) {
  const rows = buildIngestQaRows(payload);
  if (rows.length === 0) return <p className="rk-empty">No per-deal results in this report.</p>;
  return (
    <div className="rk-table-wrap">
      <table className="mtx-table">
        <thead>
          <tr>
            <th>Deal</th>
            <th>Status</th>
            <th>Gate checks</th>
            <th>Metadata checks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dealId || r.label}>
              <td>{r.label}{r.staging ? <span className="mtx-badge rk-staging">staging</span> : null}</td>
              <td>{r.error ? <Pill ok={false} label="ERROR" /> : <Pill ok={r.pass} />}</td>
              <td><CheckList checks={r.gateChecks} /></td>
              <td><CheckList checks={r.metaChecks} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverageAuditRenderer({ payload }) {
  const { flaggedExclusions, missedContent } = buildCoverageAuditView(payload);
  return (
    <div className="rk-sections">
      <section>
        <h3>Flagged exclusions ({flaggedExclusions.length})</h3>
        {flaggedExclusions.length === 0 ? <p className="rk-empty">None — no excluded region was flagged as substantive.</p> : (
          <ul className="rk-list">
            {flaggedExclusions.map((f, i) => (
              <li key={i}>
                <strong>{f.deal}</strong> — [{f.label}] {f.length} chars — {f.verdict && f.verdict.rationale}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Missed content ({missedContent.length})</h3>
        {missedContent.length === 0 ? <p className="rk-empty">None — no gap classified as missed substantive content.</p> : (
          <ul className="rk-list">
            {missedContent.map((g, i) => (
              <li key={i}>
                <strong>{g.deal}</strong> — {g.length} chars @{g.start} — {g.verdict && (g.verdict.substantive_kinds || []).join(', ')} — {g.verdict && g.verdict.rationale}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MaterializeRenderer({ payload }) {
  const view = buildMaterializeView(payload);
  return (
    <div>
      <div className="rk-apply-marker">
        <span className={`mtx-badge ${view.apply ? 'rk-pill-good' : 'rk-staging'}`}>{view.apply ? 'APPLIED' : 'DRY-RUN'}</span>
        {view.summary ? (
          <span className="rk-summary-inline">
            {Object.entries(view.summary).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </span>
        ) : null}
      </div>
      {view.deals.length === 0 ? <p className="rk-empty">No per-deal entries in this report.</p> : (
        <div className="rk-table-wrap">
          <table className="mtx-table">
            <thead>
              <tr><th>Deal</th><th>Status</th><th>Entries</th></tr>
            </thead>
            <tbody>
              {view.deals.map((d) => (
                <tr key={d.dealId}>
                  <td className="mtx-mono">{d.acquirer ? `${d.acquirer} / ${d.target}` : d.dealId}</td>
                  <td><Pill ok={d.ok} /></td>
                  <td>{d.entryCount === null ? '—' : d.entryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DemoDryrunRenderer({ payload }) {
  const steps = buildDemoDryrunSteps(payload);
  if (!steps) return <p className="rk-empty">No step data in this report.</p>;
  return (
    <div className="rk-table-wrap">
      <table className="mtx-table">
        <thead>
          <tr><th>Step</th><th>Status</th><th>Duration</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i}>
              <td>{s.name}</td>
              <td><Pill ok={s.ok} /></td>
              <td className="mtx-mono">{s.durationMs === null ? '—' : `${s.durationMs}ms`}</td>
              <td>{s.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RENDERERS = {
  'ingest-qa': IngestQaRenderer,
  'coverage-audit': CoverageAuditRenderer,
  'rematerialize-claims': MaterializeRenderer,
  'mint-cards': MaterializeRenderer,
  'demo-dryrun': DemoDryrunRenderer,
  // 'span-residual' has no dedicated shape yet — falls through to the raw
  // JSON fallback below, same as any future/unknown kind.
};

function RawJsonFallback({ payload }) {
  return (
    <details className="rk-raw">
      <summary>Raw JSON</summary>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </details>
  );
}

async function readJson(resp) {
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(text || `HTTP ${resp.status}`); }
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

export default function ReportKindPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const { kind, id } = router.query;

  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kind) return;
    setLoading(true);
    setError(null);
    readJson(fetch(`/api/admin/reports?kind=${encodeURIComponent(kind)}`).then((r) => r))
      .then((data) => {
        setHistory(data.reports || []);
        setUnavailable(data.unavailable || null);
        const initial = (typeof id === 'string' && id) || (data.reports && data.reports[0] && data.reports[0].id) || null;
        setSelectedId(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    if (!selectedId) { setReport(null); return; }
    readJson(fetch(`/api/admin/reports?id=${encodeURIComponent(selectedId)}`).then((r) => r))
      .then((data) => setReport(data.report || null))
      .catch((err) => setError(err.message));
  }, [selectedId]);

  const Renderer = kind ? RENDERERS[kind] : null;

  return (
    <>
      <Head><title>{kind || 'Report'} | Precedent Machine</title></Head>
      <MergertraceStyles />
      <div className="mtx rk">
        <header className="rk-header">
          <div>
            <p className="mtx-meta-label" style={{ fontSize: 10 }}><Link href="/admin/reports">Reports</Link> / {kind}</p>
            <h1>{kind}</h1>
          </div>
          <AdminNav />
        </header>

        {error ? <div className="rk-alert">{error}</div> : null}
        {unavailable ? (
          <div className="rk-alert rk-alert-warn">
            {unavailable.message} Run supabase/schema-06-run-reports.sql, then refresh.
          </div>
        ) : null}

        <div className="rk-body">
          <aside className="rk-history">
            <h2>History</h2>
            {history.length === 0 && !loading ? <p className="rk-empty">No runs yet.</p> : null}
            <ul>
              {history.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={row.id === selectedId ? 'rk-hist-btn rk-hist-btn-active' : 'rk-hist-btn'}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="mtx-mono">{fmtDate(row.generated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="rk-main">
            {!report ? (
              <p className="rk-empty">{loading ? 'Loading…' : 'Select a run.'}</p>
            ) : (
              <>
                <div className="rk-meta">
                  <span className="mtx-mono">{fmtDate(report.generated_at)}</span>
                  {report.git_ref ? <span className="mtx-mono rk-gitref">{report.git_ref.slice(0, 12)}</span> : null}
                </div>
                {Renderer ? <Renderer payload={report.payload} /> : (
                  <p className="rk-empty">No dedicated renderer for kind &quot;{kind}&quot; yet — see raw JSON below.</p>
                )}
                <RawJsonFallback payload={report.payload} />
              </>
            )}
          </main>
        </div>
      </div>
      <style jsx>{`
        .rk { min-height: 100vh; padding: 28px; max-width: 1280px; margin: 0 auto; }
        .rk-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .rk-header h1 { margin: 4px 0 0; font-size: 20px; font-family: var(--mtx-sans); text-transform: capitalize; }
        .rk-alert { border: 1px solid #E0E0E0; border-left: 3px solid #B14E63; background: #fff; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #B14E63; }
        .rk-alert-warn { border-left-color: #A87A2E; color: #A87A2E; }
        .rk-body { display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
        .rk-history h2 { font-size: 13px; margin: 0 0 8px; font-family: var(--mtx-sans); }
        .rk-history ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .rk-hist-btn { display: block; width: 100%; text-align: left; border: 1px solid #E0E0E0; background: #fff; padding: 8px 10px; font-size: 11px; cursor: pointer; }
        .rk-hist-btn:hover { background: #F6F6F6; }
        .rk-hist-btn-active { background: #1F1F1F; color: #fff; border-color: #1F1F1F; }
        .rk-main { min-width: 0; }
        .rk-meta { display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; color: #6B6B6B; }
        .rk-table-wrap { overflow-x: auto; }
        .rk-empty { color: #6B6B6B; font-size: 13px; }
        .rk-checks { display: flex; flex-wrap: wrap; gap: 4px; }
        .rk-pill-good { color: #2F6B43; background: rgba(47,107,67,0.08); border-color: rgba(47,107,67,0.25); }
        .rk-pill-bad { color: #B14E63; background: rgba(177,78,99,0.08); border-color: rgba(177,78,99,0.25); }
        .rk-staging { color: #A87A2E; background: rgba(168,122,46,0.08); border-color: rgba(168,122,46,0.25); margin-left: 6px; }
        .rk-sections section + section { margin-top: 20px; }
        .rk-sections h3 { font-size: 13px; margin: 0 0 8px; font-family: var(--mtx-sans); }
        .rk-list { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; }
        .rk-apply-marker { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 12px; }
        .rk-summary-inline { color: #4A4A4A; }
        .rk-raw { margin-top: 24px; border: 1px solid #E0E0E0; background: #fff; }
        .rk-raw summary { cursor: pointer; padding: 10px 12px; font-size: 12px; font-weight: 600; }
        .rk-raw pre { margin: 0; padding: 12px; font-size: 11px; overflow: auto; max-height: 480px; background: #F6F6F6; }
        .rk-muted { color: #9A9A9A; }
      `}</style>
    </>
  );
}
