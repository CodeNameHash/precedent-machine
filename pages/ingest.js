import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals } from '../lib/useSupabaseData';

IngestPage.noLayout = true;

// Friendly labels for type-group codes returned by /api/ingest/run-all.
const TYPE_LABELS = {
  'REP-T': 'Target reps',
  'REP-B': 'Buyer reps',
  IOC: 'Interim operating covenants',
  NOSOL: 'No-solicitation',
  ANTI: 'Antitrust / regulatory',
  COND: 'Closing conditions',
  TERMR: 'Termination rights',
  TERMF: 'Termination fees',
  STRUCT: 'Structure',
  CONSID: 'Consideration',
  COV: 'Other covenants',
  MISC: 'Miscellaneous',
  DEF: 'Definitions',
  MAE: 'Material adverse effect',
  OTHER: 'Other / unclassified',
};

const typeLabel = (t) => TYPE_LABELS[t] || t;

export default function IngestPage() {
  const router = useRouter();
  const { user } = useUser({ redirectTo: '/login' });
  const { deals: allDeals, loading: dealsLoading } = useDeals();

  // Preselect deal if ?deal_id= is in the URL (deep link from deal list).
  const queryDealId =
    typeof router.query.deal_id === 'string' ? router.query.deal_id : '';

  const [mode, setMode] = useState('quick'); // 'quick' | 'split'
  const [url, setUrl] = useState('');
  const [dealId, setDealId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { kind, msg, extras }

  // Split-mode state
  const [classifySummary, setClassifySummary] = useState(null); // { section_count, by_type, types_to_extract }
  const [typeStates, setTypeStates] = useState({}); // { TYPE: { status, inserted, deleted, timing_ms, error } }
  const [runAllInFlight, setRunAllInFlight] = useState(false);

  useEffect(() => {
    if (queryDealId && !dealId) setDealId(queryDealId);
  }, [queryDealId, dealId]);

  const canSubmit = !busy && (url.trim() || dealId);

  const onQuickIngest = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setStatus({ kind: 'info', msg: url ? 'Fetching, extracting metadata, parsing…' : 'Re-parsing stored text…' });
    try {
      const resp = await fetch('/api/ingest/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim() || undefined,
          deal_id: dealId || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Ingest failed');
      }
      setStatus({
        kind: 'ok',
        msg: data.created
          ? `Created deal · ${data.provisions_inserted} provisions · ${data.advisors_found} advisors`
          : `Re-ingested · ${data.provisions_inserted} provisions (${data.provisions_deleted} previous removed) · ${data.advisors_found} advisors`,
        extras: { deal_id: data.deal_id, metadata: data.metadata },
      });
      setTimeout(() => router.push(`/review/${data.deal_id}`), 1200);
    } catch (e) {
      setStatus({ kind: 'err', msg: e.message });
    }
    setBusy(false);
  };

  const onClassify = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setClassifySummary(null);
    setTypeStates({});
    setStatus({ kind: 'info', msg: 'Classifying sections…' });
    try {
      // Step-by-step assumes an existing deal_id (or url that lands in an
      // existing deal via run-all). Use run-all to handle both cases — it
      // also returns the types_to_extract list we render below.
      let targetDealId = dealId || null;

      // If we only have a URL and no deal_id, fall through to from-url to
      // create the deal first, then call classify.
      if (!targetDealId && url.trim()) {
        // Use from-url with a *minimal* path: just create the deal record,
        // but we don't actually expose a "create only" endpoint — easiest
        // path is to call classify with the url, which will fail because
        // classify requires deal_id. So: route through the existing
        // from-url flow as a one-shot, then surface a hint that split mode
        // only works on existing deals.
        setStatus({
          kind: 'err',
          msg: 'Split mode requires an existing deal. Use Quick mode to create the deal, then return here to step through.',
        });
        setBusy(false);
        return;
      }

      const resp = await fetch('/api/ingest/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: targetDealId,
          url: url.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Classify failed');

      setClassifySummary({
        deal_id: data.deal_id,
        section_count: data.classify.section_count,
        article_count: data.classify.article_count,
        by_type: data.classify.by_type,
        types_to_extract: data.types_to_extract,
      });
      // Initialize per-type state to 'pending'
      const init = {};
      for (const { type } of data.types_to_extract) {
        init[type] = { status: 'pending' };
      }
      setTypeStates(init);
      setStatus({
        kind: 'ok',
        msg: `Classified ${data.classify.section_count} sections across ${data.classify.article_count} articles. Pick types to extract below.`,
      });
    } catch (e) {
      setStatus({ kind: 'err', msg: e.message });
    }
    setBusy(false);
  };

  const extractType = async (type) => {
    if (!classifySummary?.deal_id) return;
    setTypeStates((prev) => ({
      ...prev,
      [type]: { ...(prev[type] || {}), status: 'extracting', start: Date.now() },
    }));
    try {
      const resp = await fetch('/api/ingest/extract-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: classifySummary.deal_id, type }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Extract failed');
      setTypeStates((prev) => ({
        ...prev,
        [type]: {
          status: 'done',
          inserted: data.provisions_inserted,
          deleted: data.provisions_deleted,
          timing_ms: data.timing_ms,
        },
      }));
    } catch (e) {
      setTypeStates((prev) => ({
        ...prev,
        [type]: { status: 'failed', error: e.message },
      }));
    }
  };

  const extractAllRemaining = async () => {
    if (!classifySummary) return;
    setRunAllInFlight(true);
    // Snapshot of types currently pending or failed (we re-try failed too).
    const queue = classifySummary.types_to_extract.filter(
      (t) => !typeStates[t.type] || typeStates[t.type].status === 'pending' || typeStates[t.type].status === 'failed',
    );
    for (const { type } of queue) {
      // eslint-disable-next-line no-await-in-loop
      await extractType(type);
    }
    setRunAllInFlight(false);
  };

  return (
    <>
      <Head>
        <title>Ingest · Precedent Machine</title>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          background: 'var(--paper)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TopBar user={user} />

        <main
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            padding: '48px 22px 80px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 720 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="rec-deal-eyebrow">Ingest</div>
              <h1 className="rec-deal-title" style={{ margin: '4px 0 6px' }}>
                Pull a deal from a URL
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ink-light)', lineHeight: 1.55, margin: 0 }}>
                Paste a SEC EDGAR filing URL or pick an existing deal. Choose Quick to run the full
                pipeline in one shot, or Step-by-step to classify first then extract each provision
                type on its own.
              </p>
            </div>

            <ModeTabs mode={mode} onChange={setMode} />

            <section
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <Field
                label="Agreement URL"
                hint="Direct EDGAR exhibit (e.g. Form DEFM14A Exhibit A) or any plain-text/HTML page"
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.sec.gov/Archives/edgar/…"
                  disabled={busy}
                  style={inputStyle()}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                }}
              >
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span>and / or</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              <Field
                label="Existing deal"
                hint="Pick to re-ingest. Required for Step-by-step mode."
              >
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  disabled={busy || dealsLoading}
                  style={inputStyle()}
                >
                  <option value="">— New deal (use URL) —</option>
                  {(allDeals || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.acquirer} / {d.target}
                      {d.announce_date ? ` · ${d.announce_date}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              {mode === 'quick' ? (
                <button onClick={onQuickIngest} disabled={!canSubmit} style={btnStyle(canSubmit)}>
                  {busy ? 'Working…' : dealId && !url ? 'Re-parse stored text' : 'Run full pipeline'}
                </button>
              ) : (
                <button onClick={onClassify} disabled={!canSubmit} style={btnStyle(canSubmit)}>
                  {busy ? 'Classifying…' : 'Classify'}
                </button>
              )}

              {status && <StatusBlock status={status} />}
            </section>

            {mode === 'split' && classifySummary && (
              <ClassifyResults
                summary={classifySummary}
                typeStates={typeStates}
                onExtract={extractType}
                onExtractAll={extractAllRemaining}
                runAllInFlight={runAllInFlight}
              />
            )}

            <p
              style={{
                marginTop: 18,
                fontSize: 11.5,
                color: 'var(--ink-faint)',
                lineHeight: 1.5,
              }}
            >
              Quick mode runs every phase in one Vercel call (~5 min budget). Step-by-step keeps
              each call short — classify first, then run extract per provision type — giving you
              visibility into which type took how long and which (if any) failed.
            </p>

            <div style={{ marginTop: 20 }}>
              <Link
                href="/"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-light)',
                  textDecoration: 'none',
                }}
              >
                ← Back to deals
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function ModeTabs({ mode, onChange }) {
  const tab = (key, label, sub) => (
    <button
      onClick={() => onChange(key)}
      style={{
        flex: 1,
        padding: '10px 14px',
        border: '1px solid var(--line)',
        background: mode === key ? 'var(--surface)' : 'var(--paper)',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: mode === key ? 'var(--ink)' : 'var(--ink-light)',
        outline: 'none',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: mode === key ? 'var(--accent-deep)' : 'var(--ink-faint)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{sub}</div>
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
      {tab('quick', 'Quick', 'Run the full pipeline in one call')}
      {tab('split', 'Step-by-step', 'Classify, then extract per type')}
    </div>
  );
}

function ClassifyResults({ summary, typeStates, onExtract, onExtractAll, runAllInFlight }) {
  const types = summary.types_to_extract || [];
  const anyDone = Object.values(typeStates).some((s) => s.status === 'done');
  const allDone = types.length > 0 && types.every((t) => typeStates[t.type]?.status === 'done');

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 22,
        marginTop: 18,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          marginBottom: 4,
        }}
      >
        Classification
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 16,
          color: 'var(--ink)',
          marginBottom: 16,
        }}
      >
        Found {summary.section_count} sections across {summary.article_count} articles
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {types.map(({ type, section_count, estimate }) => (
          <TypeRow
            key={type}
            type={type}
            sectionCount={section_count}
            estimate={estimate}
            state={typeStates[type] || { status: 'pending' }}
            onExtract={() => onExtract(type)}
            disabled={runAllInFlight}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <button
          onClick={onExtractAll}
          disabled={runAllInFlight || allDone}
          style={btnStyle(!runAllInFlight && !allDone)}
        >
          {runAllInFlight ? 'Extracting all…' : allDone ? 'All extracted' : 'Extract all remaining'}
        </button>
        {anyDone && (
          <Link
            href={`/review/${summary.deal_id}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--accent-deep)',
              textDecoration: 'none',
            }}
          >
            Open review →
          </Link>
        )}
      </div>
    </section>
  );
}

function TypeRow({ type, sectionCount, estimate, state, onExtract, disabled }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        border: '1px solid var(--line)',
        borderRadius: 7,
        background: 'var(--paper)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
          {typeLabel(type)}
          <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 8 }}>
            ({type})
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>
          {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
          {/* P7 item 19: surface estimated sub-clauses / definitions (~). */}
          {estimate && type === 'DEF' && typeof estimate.definitions === 'number' && estimate.definitions > 0 && (
            <> · ~{estimate.definitions} definitions detected</>
          )}
          {estimate && type !== 'DEF' && estimate.sub_clauses > 0 && (
            <> · ~{estimate.sub_clauses} sub-clauses</>
          )}
          {state.status === 'done' && (
            <>
              {' '}· {state.inserted} provisions
              {typeof state.timing_ms === 'number' && (
                <> · {(state.timing_ms / 1000).toFixed(1)}s</>
              )}
            </>
          )}
          {state.status === 'failed' && state.error && (
            <> · <span style={{ color: 'var(--seller)' }}>{state.error}</span></>
          )}
        </div>
      </div>
      <StatusPill status={state.status} />
      <button
        onClick={onExtract}
        disabled={disabled || state.status === 'extracting'}
        style={smallBtnStyle(!disabled && state.status !== 'extracting')}
      >
        {state.status === 'extracting'
          ? '…'
          : state.status === 'done'
          ? 'Re-extract'
          : 'Extract'}
      </button>
    </div>
  );
}

function StatusPill({ status }) {
  const palette = {
    pending: { bg: 'var(--paper)', fg: 'var(--ink-faint)', border: 'var(--line)', label: 'Pending' },
    extracting: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)', border: 'var(--accent)', label: 'Extracting' },
    done: { bg: 'color-mix(in srgb, var(--accent) 14%, transparent)', fg: 'var(--accent-deep)', border: 'var(--accent)', label: 'Done' },
    failed: { bg: 'color-mix(in srgb, var(--seller) 12%, transparent)', fg: 'var(--seller)', border: 'var(--seller)', label: 'Failed' },
  };
  const p = palette[status] || palette.pending;
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        padding: '3px 7px',
        borderRadius: 4,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {p.label}
    </span>
  );
}

function smallBtnStyle(enabled) {
  return {
    border: '1px solid var(--line)',
    background: enabled ? 'var(--surface)' : 'var(--paper)',
    color: enabled ? 'var(--ink)' : 'var(--ink-faint)',
    padding: '5px 10px',
    borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
}

function StatusBlock({ status }) {
  const palette =
    status.kind === 'ok'
      ? { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)', border: 'var(--accent)' }
      : status.kind === 'err'
        ? { bg: 'color-mix(in srgb, var(--seller) 12%, transparent)', fg: 'var(--seller)', border: 'var(--seller)' }
        : { bg: 'var(--paper)', fg: 'var(--ink-mid)', border: 'var(--line)' };
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600 }}>{status.msg}</div>
      {status.extras?.metadata && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            opacity: 0.85,
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          {status.extras.metadata.acquirer && (
            <span>Buyer: {status.extras.metadata.acquirer}</span>
          )}
          {status.extras.metadata.target && <span>Target: {status.extras.metadata.target}</span>}
          {status.extras.metadata.signing_date && (
            <span>Date: {status.extras.metadata.signing_date}</span>
          )}
          {status.extras.metadata.merger_form && (
            <span>Form: {status.extras.metadata.merger_form}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.5 }}>{hint}</span>
      )}
    </label>
  );
}

function inputStyle() {
  return {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    background: 'var(--paper)',
    color: 'var(--ink)',
    fontFamily: 'inherit',
    fontSize: 13.5,
    outline: 'none',
  };
}

function btnStyle(enabled) {
  return {
    border: 'none',
    background: enabled ? 'var(--accent)' : 'var(--line)',
    color: enabled ? 'white' : 'var(--ink-faint)',
    padding: '10px 16px',
    borderRadius: 8,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    alignSelf: 'flex-start',
  };
}

function TopBar({ user }) {
  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        padding: '0 22px',
        flexShrink: 0,
      }}
    >
      <Link href="/" className="rec-wordmark">
        <span className="mark" />
        Recital
        <span className="tag">Precedent</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>{user.name}</span>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent-deep)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {(user.name || 'U')
                .split(/\s+/)
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
